/* ================= Repartição do pavimento tipo pelos partidos =================
   Pedido do Luiz: "nossa ferramenta não fica criando qualquer tipo de layout só para caber, ela começa a respeitar regras
   e padrões de mercado". O pavimento tipo (tipoLayout em src/layout.js, blcLayFaixa em blocos.js, alasUnidades em alas.js)
   reparte cada trecho de fachada em unidades. Antes: unidades distribuídas só pela área (a maior primeiro no trecho com mais
   folga) e cortadas na proporção da área — saíam unidades em L em volta do núcleo e frentes que nenhum partido aceita.
   Agora a repartição é escolhida por uma nota de custo (menor = melhor), por unidade:
   - faixa dos partidos permitidos da tipologia (comPartidosDe: os marcados, o catálogo e os modelos do usuário): metros
     fora de faixaW/faixaD do partido que melhor cabe (o retângulo inscrito da unidade, como o encaixe "inscrito" do gerador);
     partido "de canto" (janela lateral) só conta onde a unidade tem a fachada lateral;
   - forma: a fração da unidade fora do retângulo inscrito (L em volta do núcleo); pesa mais com 3+ dormitórios;
   - área: desvio da área-alvo do mix além de 3% (a quantidade e a área-alvo vêm do mix; o que muda é COMO o andar é repartido);
   - ponta: a tipologia maior ganha um pouco na ponta do andar (esquina, duas fachadas) quando cabe.
   Busca: todas as distribuições das unidades (por tipologia) entre os trechos (sem deixar trecho vazio quando a distribuição
   antiga não deixava), as ordens distintas em cada trecho e, nas melhores, os cortes ajustados (±0,05…0,6 m) para entrar na
   faixa dos partidos. Muitas combinações → só a distribuição antiga, com ordem e cortes otimizados. Puro (vai ao Worker).
   Saída de repReparte: {regs:[{list:[unidades na ordem], cuts:[u0…u1]}], custo, antigo} ou null (sem estado: fica o antigo).
   repNotaGeo(T, med) é a mesma conta para quem já tem a unidade medida (alas). */
const REP_PESO = { area:30, areaTol:0.03, faixa:12, foraMax:1.2, semPartido:60, raso:30, encolhe:60, fresta:200, forma:25, forma3:60, ponta:1.5, semRecorte:4 };
const REP_LIM = { dist:6000, seq:120, top:4, minW:2.4 };
const _repTipoCache=new Map(), _repCache=new Map();
const repDorms = tip=>({studio:0, "1d":1, "1s":1, "2d":2, "2d1s":2, "2s":2, "3d1s":3, "3s":3, "4d1s":4})[tip] ?? 2;
/* tipologia de uma unidade do mix: partidos permitidos (só as faixas) e número de dormitórios */
function repTipo(st, nome, alvo){
  if(!st || typeof comPartidosDe!=="function" || typeof comModeloDe!=="function") return null;
  const cfg=(typeof comTipoCfg==="function" && comTipoCfg(st, nome))||{}, us=(st.comodos && st.comodos.modelos)||[];
  const key=[nome, Math.round((+alvo||0)*10), (cfg.partidos||[]).join(","), cfg.modelo||"", us.map(m=>m && (m.id+":"+(m.atualizado||0))).join(",")].join("|");
  let T=_repTipoCache.get(key); if(T) return T;
  const tip=comModeloDe(st, nome, alvo), cands=comPartidosDe(st, nome, alvo);
  T={tip, dorms:repDorms(tip), mods:cands.map(({mod,pen})=>({id:mod.id, fw:mod.faixaW||{}, fd:mod.faixaD||{}, lat:!!(mod.lateral && (mod.lateral.xW || mod.lateral.x0)), pen:+pen||0}))};
  if(_repTipoCache.size>400) _repTipoCache.clear(); _repTipoCache.set(key, T); return T;
}
/* metros fora da faixa do partido que melhor cabe (0 = cabe) */
function repFora(T, W, D, lat, det){
  if(!T || !T.mods.length) return det? {o:0, g:0} : 0;
  const FW=APTO_FAIXA_FOLGA.W, FD=APTO_FAIXA_FOLGA.D; let best={o:Infinity, g:Infinity};
  // g = metros fora da faixa (o que o gerador exige: < 2,5 cm); o = g + preferências (acima do máximo, alternativa sem/com suíte, virado)
  const um=(m, W, D, extra)=>{ const mnW=m.fw.min??0, mxW=m.fw.max??99, mnD=m.fd.min??0, mxD=m.fd.max??99;
    const g=Math.max(0,mnW-W)+Math.max(0,W-mxW*FW)+Math.max(0,mnD-D)+Math.max(0,D-mxD*FD); return {g, o:g+0.15*Math.max(0,W-mxW)+0.15*Math.max(0,D-mxD)+m.pen*0.05+extra} };
  for(const m of T.mods){ const cs=[um(m, W, D, 0)]; if(m.lat && !lat){ cs[0].g+=1.5; cs[0].o+=1.5 }
    // unidade de ponta (fachada lateral): o gerador também tenta o partido virado para a fachada lateral
    if(lat && !m.lat) cs.push(um(m, D, W, 0.1));
    cs.forEach(c=>{ if(c.o<best.o) best=c }) }
  return det? best : best.o;
}
/* medidas de uma unidade no referencial (ux ao longo da fachada, vy para o corredor): área, retângulo inscrito */
function repMede(poly, ux, vy){
  if(!poly || poly.length<3) return null;
  const L=poly.map(q=>[G.dot(q,ux), G.dot(q,vy)]), A=G.area(poly);
  let x0=Infinity, x1=-Infinity, y0=Infinity, y1=-Infinity; L.forEach(q=>{ if(q[0]<x0)x0=q[0]; if(q[0]>x1)x1=q[0]; if(q[1]<y0)y0=q[1]; if(q[1]>y1)y1=q[1] });
  if(L.length===4 && Math.abs(A-(x1-x0)*(y1-y0))<0.02) return {A, W:x1-x0, D:y1-y0, Ai:A, u0:x0, u1:x1};
  const r=typeof aptoMaiorRet==="function"? aptoMaiorRet(L) : null;
  return r? {A, W:r[2]-r[0], D:r[3]-r[1], Ai:(r[2]-r[0])*(r[3]-r[1]), u0:x0, u1:x1} : {A, W:x1-x0, D:y1-y0, Ai:A, u0:x0, u1:x1};
}
/* custo de uma unidade medida: {A, W, D, Ai}, lat = tem fachada lateral, maior = é a tipologia maior do andar */
function repNotaGeo(T, alvo, med, lat, maior){
  if(!med) return 50;
  const P=REP_PESO, dev=alvo>0? Math.abs(med.A/alvo-1) : 0, F=repFora(T, med.W, med.D, lat, true), fora=F.o, forma=med.A>0? Math.max(0, 1-med.Ai/med.A) : 0;
  // unidade degenerada (só uma tira rasa, ou muito menor que a área-alvo): pesa como várias sem partido
  // (o que conta é QUANTAS unidades ficam sem partido: passar do limite por 0,7 m ou por 5 m dá no mesmo — o aviso)
  // estreita demais para a tipologia (menos de 60% da frente mínima dos partidos): absurda, mesmo marcada como sem partido
  const wMin = T && T.mods.length ? Math.min(...T.mods.map(m=>m.fw.min??0)) : 0, fresta = med.W < 0.6*wMin && !(lat && med.D>=0.6*wMin) ? P.fresta : 0;
  const raso = med.D<4.5 ? P.raso*Math.min(1.5, 4.5-med.D) : 0, encolhe = dev>0.25 ? P.encolhe*(dev-0.25) : 0;
  return fresta + P.area*Math.max(0, dev-P.areaTol) + encolhe + P.faixa*Math.min(P.foraMax, fora) + (F.g>0.025? P.semPartido : 0) + raso + forma*((T && T.dorms>=3)? P.forma3 : P.forma) - (lat && maior? P.ponta : 0);
}
/* multiset → sequências distintas (no máximo lim) */
function repPerms(arr, lim){
  const out=[], cnt=new Map(); arr.forEach(k=>cnt.set(k,(cnt.get(k)||0)+1)); const ks=[...cnt.keys()], cur=[];
  const rec=()=>{ if(out.length>=lim) return; if(cur.length===arr.length){ out.push(cur.slice()); return }
    for(const k of ks){ const c=cnt.get(k); if(!c) continue; cnt.set(k,c-1); cur.push(k); rec(); cur.pop(); cnt.set(k,c) } };
  rec(); return out;
}
/* composições de n em k partes (vetores) */
function repComp(n, k){ const out=[]; const rec=(i, rest, cur)=>{ if(i===k-1){ out.push([...cur, rest]); return } for(let v=0; v<=rest; v++) rec(i+1, rest-v, [...cur, v]) }; rec(0, n, []); return out }

/* Repartição de trechos retos (o corte é perpendicular a ux): R = [{p, fac}] na ordem do layout, us = [{nome, alvo, sac, i}],
   ctx = {ux, vy, st, u0, u1 (extensão do andar em ux, para achar as pontas), antigo: [[índices de us por trecho]] (a distribuição
   da regra antiga, que manda quando não há estado), vazioOk (aceita trecho vazio, como a antiga)} */
function repReparte(R, us, ctx){
  const st=ctx.st; if(!st || !R.length || !us.length || typeof comPartidosDe!=="function") return null;
  const {ux, vy}=ctx, P=REP_PESO, k=R.length;
  const tipos=new Map(); us.forEach(u=>{ const key=u.nome+"|"+(+u.alvo).toFixed(3)+"|"+(+u.sac||0); if(!tipos.has(key)) tipos.set(key, {key, nome:u.nome, alvo:+u.alvo, us:[]}); tipos.get(key).us.push(u) });
  const TT=[...tipos.values()]; TT.forEach(t=>{ t.T=repTipo(st, t.nome, t.alvo) });
  const maiorA=Math.max(...TT.map(t=>t.alvo));
  const sig=JSON.stringify([R.map(r=>r.p.map(q=>[+q[0].toFixed(3), +q[1].toFixed(3)])), TT.map(t=>[t.key, t.us.length, t.T && t.T.mods.map(m=>m.id)]), ctx.u0, ctx.u1, ux, ctx.antigo, !!ctx.vazioOk]);
  // unidades concretas: dentro de cada tipologia, na ordem original
  const concreto=res=>{ const fila=TT.map(t=>t.us.slice().sort((a,b)=>a.i-b.i)); return {...res, regs:res.regs.map(r=>({list:r.seq.map(ti=>fila[ti].shift()), cuts:r.cuts}))} };
  const hit=_repCache.get(sig); if(hit) return concreto(hit);
  const ext=R.map(r=>G.extent(r.p, ux)), area=R.map(r=>G.area(r.p));
  const lado=(a,b)=>Math.abs(a-ctx.u0)<0.06 || Math.abs(b-ctx.u1)<0.06;
  // custo de um trecho com uma sequência de tipologias e cortes dados
  const medC=new Map(), mede=(ri,a,b)=>{ const k=ri+"|"+a.toFixed(3)+"|"+b.toFixed(3); let r=medC.get(k); if(r===undefined){ r=repMede(G.band(R[ri].p, ux, a, b), ux, vy); medC.set(k, r) } return r };
  const notaC=new Map(), notaU=(ri, ti, a, b)=>{ const k=ri+"|"+ti+"|"+a.toFixed(3)+"|"+b.toFixed(3); let r=notaC.get(k); if(r===undefined){ const t=TT[ti], med=mede(ri,a,b);
      // unidade degenerada (só a tira rasa atrás da escada, ou uma fresta): não vale
      r = !med || med.W<REP_LIM.minW || med.D<3.5 ? 1e6 : repNotaGeo(t.T, t.alvo, med, lado(a,b), t.alvo>=maiorA-1e-6); notaC.set(k, r) } return r };
  const custoCortes=(ri, seq, cuts)=>{ let s=0; for(let j=0;j<seq.length;j++){ const a=cuts[j], b=cuts[j+1]; if(b-a<REP_LIM.minW) return 1e6; s+=notaU(ri, seq[j], a, b) } return s };
  const cutC=new Map(), corte=(ri, f)=>{ const k=ri+"|"+f.toFixed(6); let r=cutC.get(k); if(r===undefined){ r=G.cutAt(R[ri].p, ux, f); cutC.set(k, r) } return r };
  const cortesArea=(ri, seq)=>{ const tot=seq.reduce((s,ti)=>s+TT[ti].alvo,0), [mn,mx]=ext[ri], c=[mn]; let acc=0;
    for(let j=0;j<seq.length-1;j++){ acc+=TT[seq[j]].alvo; c.push(corte(ri, acc/tot)) } c.push(mx); return c };
  const refina=(ri, seq, cuts0)=>{ let cuts=cuts0.slice(), best=custoCortes(ri, seq, cuts);
    for(const d of [0.6, 0.3, 0.15, 0.05]) for(let pass=0; pass<2; pass++){ let mel=false;
      for(let j=1;j<cuts.length-1;j++) for(const sgn of [-1,1]){ const c=cuts.slice(); c[j]+=sgn*d; if(c[j]<=c[j-1]+REP_LIM.minW || c[j]>=c[j+1]-REP_LIM.minW) continue; const v=custoCortes(ri, seq, c); if(v<best-1e-9){ best=v; cuts=c; mel=true } }
      if(!mel) break }
    return {cuts, custo:best} };
  // melhor sequência de um trecho para um multiset de tipologias (memo)
  const memo=new Map();
  const melhorTrecho=(ri, cont)=>{ const key=ri+":"+cont.join(","); let r=memo.get(key); if(r) return r;
    const arr=[]; cont.forEach((n,ti)=>{ for(let q=0;q<n;q++) arr.push(ti) });
    if(!arr.length){ r={seq:[], cuts:null, custo: ctx.vazioOk? 0 : 1e6}; memo.set(key, r); return r }
    const seqs=repPerms(arr, REP_LIM.seq); let best=null;
    seqs.forEach(seq=>{ const cuts=cortesArea(ri, seq), c=custoCortes(ri, seq, cuts); if(!best || c<best.custo) best={seq, cuts, custo:c} });
    memo.set(key, best); return best };
  // distribuições: todas (por tipologia), senão só a antiga
  const comps=TT.map(t=>repComp(t.us.length, k)); let nDist=comps.reduce((s,c)=>s*c.length,1);
  const antigoCont = ctx.antigo? ctx.antigo.map(ix=>TT.map(t=>ix.filter(i=>t.us.some(u=>u.i===i)).length)) : null;
  const cand=[];
  const avalia=cont=>{ let c=0; const parts=[]; for(let ri=0;ri<k;ri++){ const r=melhorTrecho(ri, cont[ri]); c+=r.custo; parts.push(r); if(c>=1e6) return } cand.push({cont, parts, custo:c}) };
  if(nDist<=REP_LIM.dist){ const rec=(ti, acc)=>{ if(ti===TT.length){ const cont=Array.from({length:k}, (_,ri)=>TT.map((t,j)=>acc[j][ri])); avalia(cont); return } comps[ti].forEach(cp=>rec(ti+1, [...acc, cp])) }; rec(0, []) }
  else if(antigoCont) avalia(antigoCont);
  if(!cand.length) return null;
  cand.sort((a,b)=>a.custo-b.custo);
  if(typeof REP_DEBUG!=="undefined" && REP_DEBUG) REP_DEBUG.push({tipos:TT.map(t=>t.nome), cands:cand.slice(0,8).map(c=>({cont:c.cont, custo:+c.custo.toFixed(2), seqs:c.parts.map(p=>p.seq), cortes:c.parts.map(p=>p.cuts&&p.cuts.map(x=>+x.toFixed(2)))}))});
  // as melhores: cortes refinados (faixa dos partidos)
  let best=null; cand.slice(0, REP_LIM.top).forEach(cd=>{ let c=0; const regs=cd.parts.map((p,ri)=>{ if(!p.seq.length) return {seq:[], cuts:null}; const f=refina(ri, p.seq, p.cuts); c+=f.custo; return {seq:p.seq, cuts:f.cuts} });
    if(!best || c<best.custo-1e-9) best={custo:c, regs, cont:cd.cont} });
  const out={custo:best.custo, regs:best.regs, nDist, antigo: antigoCont? JSON.stringify(antigoCont)===JSON.stringify(best.cont) : null};
  if(_repCache.size>200) _repCache.clear(); _repCache.set(sig, out);
  return concreto(out);
}
