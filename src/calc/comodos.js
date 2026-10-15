/* ================= 1.2 unidades por dentro: plantas de apartamento (cômodos) =================
   Motor por PARTIDOS (docs/APTOS.md): cada unidade do pavimento tipo testa os partidos permitidos da tipologia
   (S.comodos.tipos[i].partidos; vazio = todos os do catálogo daquela tipologia + os modelos do usuário copiados em
   S.comodos.modelos), aplica (aptoAplica: estica por faixas, encaixa em unidade não retangular, recorta a sacada), valida
   (aptoValida: círculo inscrito, áreas, proporção, acessos, iluminação, mobiliário) e fica com a melhor nota. Referenciais
   testados: fachada principal (os dois sentidos = espelhado) e, se nada passar, a fachada lateral das unidades de ponta.
   A janela lateral é aproveitada sempre (as bordas da unidade dizem o que é fachada). Planta com problema grave só sai se
   nenhum partido cabe — então a unidade fica com a menos ruim e o aviso "nenhum partido cabe" com o motivo.
   Edição manual: arrastar as linhas da grade do partido (S.comodos.tipos[{nome, partido, cortes:{x1…, y1…}}], frações; vale
   para todas as unidades da tipologia, com o partido fixado). Variações salvas: S.comodos.variantes[{tipo, nome, modelo,
   partido, cortes}]. Saída: u.com em cada unidade de m.tipo[i].units e o resumo m.comodos. Não muda áreas vendáveis. */
extendDEF("comodos", {
  on: true,          // plantas visíveis na planta tipo e nos andares
  movel: true,       // camada de mobiliário
  // mínimos de referência (área m², menor dimensão m) — conferir no código de obras do município
  min: { sala:{a:10,l:2.6}, suite:{a:9,l:2.5}, dorm:{a:7,l:2.3}, office:{a:4,l:1.8}, cozinha:{a:4,l:1.5}, serv:{a:1.8,l:1.0}, banho:{a:2.2,l:1.1}, lavabo:{a:1.2,l:0.9}, circ:{a:0,l:0.9} },
  jan: { frac: 6, h: 1.2, hSala: 2.1 },   // iluminação/ventilação ≥ 1/frac da área do piso; altura útil da janela (sala: porta-janela)
  regras: { circ:{...APTO_REGRAS.circ}, prop:{...APTO_REGRAS.prop}, porta:{...APTO_REGRAS.porta} },   // círculo inscrito, proporção, portas (docs/APTOS.md §1)
  tipos: [],         // por tipologia: {nome, modelo:"auto"|programa, partidos:[ids] (vazio = automático), partido:id|null (fixado ao arrastar), cortes:{}, sel:-1, lavabo}
  variantes: [],     // variações salvas: {tipo, nome, modelo, partido, cortes}
  modelos: []        // modelos do usuário escolhidos neste estudo (cópias, formato §2 — o estudo fica completo no link e no Worker)
});

const COM_K = APTO_AMB;
const COM_MODELOS = {
  studio: {nome:"Studio", dorms:0, suite:false, serv:false},
  "1d":   {nome:"1 dormitório", dorms:1, suite:false, serv:true},
  "1s":   {nome:"1 suíte", dorms:0, suite:true, serv:true},
  "2d":   {nome:"2 dormitórios", dorms:2, suite:false, serv:true},
  "2d1s": {nome:"2 dorm. (1 suíte)", dorms:1, suite:true, serv:true},
  "2s":   {nome:"2 suítes", dorms:0, suite:true, nSuites:2, serv:true, lavabo:"fixo"},
  "3d1s": {nome:"3 dorm. (1 suíte)", dorms:2, suite:true, serv:true, lavabo:"opc"},
  "3s":   {nome:"3 suítes", dorms:0, suite:true, nSuites:3, serv:true, lavabo:"fixo"},
  "4d1s": {nome:"4 dorm. (1 suíte)", dorms:3, suite:true, serv:true, lavabo:"opc", banhos:2}
};
const comTemLavabo = (M, cfg)=> M.lavabo==="fixo" || (M.lavabo==="opc" && !!(cfg && cfg.lavabo));
const COM_DOOR = 0.8, COM_WALL = APTO_PAREDE;

/* modelo (programa) automático pelo nome e pela área da tipologia */
function comModeloAuto(nome, area){
  const s=String(nome||"").toLowerCase();
  if(/studio|st[uú]dio|kit|loft/.test(s)) return "studio";
  const md=s.match(/(\d)\s*(d\b|d\.|q\b|q\.|dorm|quarto|dt)/), ms=s.match(/(\d)\s*su/), su=/su[ií]te/.test(s);
  let n = md? +md[1] : ms? +ms[1] : null;
  if(n===null){ if(area<38) return "studio"; if(area<50) return "1d"; if(area<78) return "2d1s"; return "3d1s" }
  if(n<=0) return "studio";
  const suite = ms? +ms[1]>0 : su || (n>=2 && area>=55);
  if(n===1) return suite? "1s" : "1d";
  if(n===2) return ms && +ms[1]>=2? "2s" : suite? "2d1s" : "2d";
  if(n>=4) return "4d1s";
  return ms && +ms[1]>=3? "3s" : "3d1s";
}
const comTipoCfg = (st, nome)=> (st.comodos && (st.comodos.tipos||[]).find(t=>t.nome===nome)) || null;
function comModeloDe(st, nome, area){ const c=comTipoCfg(st,nome); return c && c.modelo && c.modelo!=="auto" && COM_MODELOS[c.modelo] ? c.modelo : comModeloAuto(nome, area) }
const COM_ALT = {"2d1s":"2d","2d":"2d1s","1d":"1s","1s":"1d"};
const comCortesDe = cfg=> Object.fromEntries(Object.entries((cfg && cfg.cortes)||{}).filter(([k,v])=>/^[xy]\d+$/.test(k) && isFinite(v)));
/* partidos a testar numa tipologia: [{mod, pen}] (pen = penalidade na escolha: a alternativa sem/com suíte do automático) */
function comPartidosDe(st, nome, area){
  const cfg=comTipoCfg(st,nome)||{}, us=(st.comodos && st.comodos.modelos)||[];
  if(Array.isArray(cfg.partidos) && cfg.partidos.length){ const l=cfg.partidos.map(id=>aptoModelo(id, st)).filter(Boolean).map(mod=>({mod, pen:0})); if(l.length) return l }
  const tip=comModeloDe(st, nome, area), auto=!(cfg.modelo && cfg.modelo!=="auto" && COM_MODELOS[cfg.modelo]), out=[];
  APTO_CAT.filter(m=>m.tipologia===tip).forEach(mod=>out.push({mod, pen:0})); us.filter(m=>m && m.tipologia===tip).forEach(mod=>out.push({mod, pen:0}));
  const alt=auto && COM_ALT[tip]; if(alt){ APTO_CAT.filter(m=>m.tipologia===alt).forEach(mod=>out.push({mod, pen:4})); us.filter(m=>m && m.tipologia===alt).forEach(mod=>out.push({mod, pen:4})) }
  // lavabo pedido na tipologia: os partidos que não o têm ficam para depois (a repartição do andar também os pesa menos)
  if(cfg.lavabo) out.forEach(x=>{ if(!(x.mod.ambientes||[]).some(a=>a.k==="lavabo" || a.opc==="lavabo")) x.pen+=10 });
  return out;
}

/* ---------- geometria auxiliar ---------- */
const comLimpa = aptoLimpa;
const comInset = aptoInset;
/* classe do que está do outro lado de um ponto de borda (sonda para fora) */
function comLado(pt, nOut, unitPoly, ctx){
  const pr=[pt[0]+nOut[0]*0.08, pt[1]+nOut[1]*0.08];
  if(unitPoly && G.pip(pr, unitPoly)) return "interna";
  if(!G.pip(pr, ctx.plate)) return "fachada";
  if(ctx.corridor && ctx.corridor.length && G.pip(pr, ctx.corridor)) return "corredor";
  if(ctx.core && ctx.core.length && G.pip(pr, ctx.core)) return "nucleo";
  return "divisa";
}
const comOut=(p,i)=>{ const a=p[i], b=p[(i+1)%p.length], dx=b[0]-a[0], dy=b[1]-a[1], l=Math.hypot(dx,dy)||1, s=G.sArea(p)>0?1:-1; return s>0? [dy/l,-dx/l] : [-dy/l,dx/l] };
/* arestas de um polígono com a classe do vizinho (sub-trechos de ~0,4 m) */
function comBordas(poly, unitPoly, ctx){
  const out=[];
  for(let i=0;i<poly.length;i++){ const a=poly[i], b=poly[(i+1)%poly.length], L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<0.05) continue; const n=comOut(poly,i), k=Math.max(1,Math.round(L/0.4));
    let cur=null;
    if(unitPoly && k>1){ const q=t=>{ const pm=[a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t]; return G.pip([pm[0]+n[0]*0.08, pm[1]+n[1]*0.08], unitPoly) };
      if(q(0.5) && q(0.5/k) && q(1-0.5/k)){ out.push({i, c:"interna", t0:0, t1:1, n}); continue } }
    for(let j=0;j<k;j++){ const t0=j/k, t1=(j+1)/k, tm=(t0+t1)/2, pm=[a[0]+(b[0]-a[0])*tm, a[1]+(b[1]-a[1])*tm], c=comLado(pm, n, unitPoly, ctx);
      if(cur && cur.c===c){ cur.t1=t1 } else { cur={i, c, t0, t1, n}; out.push(cur) } }
  }
  return out.map(s=>{ const a=poly[s.i], b=poly[(s.i+1)%poly.length]; return {i:s.i, c:s.c, n:s.n, a:[a[0]+(b[0]-a[0])*s.t0, a[1]+(b[1]-a[1])*s.t0], b:[a[0]+(b[0]-a[0])*s.t1, a[1]+(b[1]-a[1])*s.t1], len:Math.hypot(b[0]-a[0],b[1]-a[1])*(s.t1-s.t0)} });
}

/* ---------- referencial da unidade ---------- */
function comFrame(P, ax, dn, lado){
  const as=P.map(q=>G.dot(q,ax)), ds=P.map(q=>G.dot(q,dn)), a0=Math.min(...as), a1=Math.max(...as), d0=Math.min(...ds), D=Math.max(...ds)-d0, W=a1-a0;
  const A = x=> lado==="b"? a1-x : a0+x;                    // x = distância desde a ponta (lado "b" = espelhado)
  const w = (x,d)=>{ const a=A(x); return [ax[0]*a+dn[0]*(d+d0), ax[1]*a+dn[1]*(d+d0)] };
  const loc = q=>{ const a=G.dot(q,ax); return [lado==="b"? a1-a : a-a0, G.dot(q,dn)-d0] };
  const clip = (x0,x1,y0,y1)=>{ const aa=A(x0), bb=A(x1); let r=G.band(P, ax, Math.min(aa,bb), Math.max(aa,bb)); if(!r.length) return []; r=G.band(r, dn, d0+y0, d0+y1); return comLimpa(r) };
  return {ax, dn, lado, a0, a1, d0, D, W, A, w, loc, clip};
}
const comVet=(F,p,v)=>{ const a=F.w(p[0],p[1]), b=F.w(p[0]+v[0],p[1]+v[1]); return [b[0]-a[0], b[1]-a[1]] };
const comNf=(v,d=1)=>(+v).toFixed(d).replace(".",",");

/* por que um partido não cabe na unidade: a faixa que ele pede (frente/profundidade) — {motivo, falta (m)} */
function comMotivoFaixa(mod, dm){
  const fw=mod.faixaW||{}, fd=mod.faixaD||{}, F=APTO_FAIXA_FOLGA, W=dm? dm[0] : 0, D=dm? dm[1] : 0;
  if(fw.min!=null && W<fw.min-0.025) return {motivo:`pede frente ≥ ${comNf(fw.min)} m`, falta:fw.min-W};
  if(fw.max!=null && W>fw.max*F.W+0.025) return {motivo:`pede frente ≤ ${comNf(fw.max*F.W)} m`, falta:W-fw.max*F.W};
  if(fd.min!=null && D<fd.min-0.025) return {motivo:`pede profundidade ≥ ${comNf(fd.min)} m`, falta:fd.min-D};
  if(fd.max!=null && D>fd.max*F.D+0.025) return {motivo:`pede profundidade ≤ ${comNf(fd.max*F.D)} m`, falta:D-fd.max*F.D};
  return {motivo:"não cabe", falta:9};
}
/* o problema grave que derruba um partido, em poucas palavras ("Cozinha estreita", "falta banheiro da suíte") */
const COM_FEM = {suite:1, cozinha:1, serv:1, circ:1, sacada:1};
function comMotivoCurto(probs, pl){
  const p=(probs||[]).find(x=>x.nivel==="bad"); if(!p) return "";
  const amb=pl && p.amb ? (pl.ambientes||[]).find(r=>r.id===p.amb) : null, nome=amb? (amb.longo||APTO_AMB[amb.k].longo) : "", f=amb && COM_FEM[amb.k];
  const adj={area: f? "pequena" : "pequeno", circulo: f? "estreita" : "estreito", proporcao: f? "comprida" : "comprido"}[p.k];
  if(adj && nome) return `${nome} ${adj}`;
  if(p.k==="janela" && nome) return `${nome} sem janela`;
  if((p.k==="acesso" || p.k==="passagem") && nome) return `${nome}: acesso ruim`;
  if(p.k==="movel"){ const t=String(p.msg).split(": ")[1]||p.msg; return t.split(" (")[0].split(" com ")[0] }
  if(p.k==="sala") return "sala menor que o quarto";
  if(p.k==="faixa") return "fora da faixa do partido";
  return String(p.msg).split(" (")[0];
}

/* ---------- uma unidade: testa os partidos e escolhe ---------- */
const _comCache = new Map();
function comUnidade(u, lay, st, ctx){
  const P=comLimpa(u.poly); if(P.length<3 || G.area(P)<12) return null;
  const C=st.comodos||DEF.comodos, cfg=comTipoCfg(st, u.nome)||{}, ov=comCortesDe(cfg), cands=comPartidosDe(st, u.nome, u.alvo);
  const fixo = cfg.partido && Object.keys(ov).length ? aptoModelo(cfg.partido, st) : null;
  const sacEmb = u.sac && u.sac.area>0.5 && u.sac.tipo!=="balanco" ? {area:u.sac.area, prof:(st.produto&&st.produto.sacProf)||1.6} : null;
  const ba=[P.map(q=>[+q[0].toFixed(3),+q[1].toFixed(3)]), u.fac, u.ux||0, u.vy||0, u.alvo, sacEmb && +sacEmb.area.toFixed(2), sacEmb && sacEmb.prof, cands.map(c=>[c.mod.id, c.mod.atualizado||0, c.pen]), fixo&&fixo.id, C.min, C.jan, C.regras, ctx.sig, !!cfg.lavabo];
  const sig=JSON.stringify([...ba, ov]), sigA=JSON.stringify([...ba, "auto"]);
  const hit=_comCache.get(sig); if(hit) return hit;
  const ux=u.ux||lay.ux, vy=u.vy||lay.vy;   // C3: unidade de uma ala traz o referencial da ala
  const bordW=comBordas(P, null, ctx), locais=new Map();
  const local=(fm, lado)=>{ const key=fm.fr+fm.ax.join()+lado; let r=locais.get(key); if(r) return r; const F=comFrame(P, fm.ax, fm.dn, lado);
    r={F, PL:P.map(F.loc), bl:bordW.map(b=>({a:F.loc(b.a), b:F.loc(b.b), c:b.c}))}; r.ret = P.length===4 && Math.abs(G.area(P)-F.W*F.D)<0.05; locais.set(key, r); return r };
  const aplica=(mod, fm, lado, enc, cortes)=>{ const Lc=local(fm, lado), F=Lc.F; if(F.W<2 || F.D<2) return null;
    const planta=aptoAplica(mod, F.W, F.D, {contorno:Lc.PL, bordas:Lc.bl, encaixe:enc, sacada:sacEmb, lavabo:!!cfg.lavabo, cortes, st}); return planta? {planta, F} : null };
  const frames=[{fr:"f", ax:ux, dn: u.fac==="max"? [-vy[0],-vy[1]] : [vy[0],vy[1]]}];
  const lat=bordW.filter(b=>b.c==="fachada" && b.len>=3 && Math.abs(G.dot([(b.b[0]-b.a[0])/b.len,(b.b[1]-b.a[1])/b.len],ux))<0.35);
  lat.forEach(b=>{ const d=[(b.b[0]-b.a[0])/b.len,(b.b[1]-b.a[1])/b.len]; frames.push({fr:"l", ax:d, dn:[-b.n[0],-b.n[1]]}) });
  const finaliza=b=>{ if(_comCache.size>600) _comCache.clear(); return b };
  // escolha automática (sem os ajustes manuais): barata para todos; mobiliário só nos melhores (a nota completa nunca passa da barata)
  // faixa do partido: frente × profundidade da região em que ele é aplicado (retângulo envolvente ou o maior inscrito)
  const dims=(Lc,enc)=>{ if(enc!=="inscrito") return [Lc.F.W, Lc.F.D]; if(Lc.mr===undefined) Lc.mr=aptoMaiorRet(Lc.PL); return Lc.mr? [Lc.mr[2]-Lc.mr[0], Lc.mr[3]-Lc.mr[1]] : null };
  const foraDe=(mod,dm)=>{ if(!dm) return 99; const fw=mod.faixaW||{}, fd=mod.faixaD||{}, o=(v,a,b)=>Math.max(0,(a!=null? a-v : 0), (b!=null? v-b : 0)); return o(dm[0],fw.min,fw.max!=null? fw.max*APTO_FAIXA_FOLGA.W : null)+o(dm[1],fd.min,fd.max!=null? fd.max*APTO_FAIXA_FOLGA.D : null) };
  // escolha automática (sem os ajustes manuais): barata para todos; mobiliário só nos melhores (a nota completa nunca passa da barata)
  const escolhe=(lista)=>{ const cs=[]; let n=0;
    const testa=(fms, aceita)=>fms.forEach(fm=>["a","b"].forEach(lado=>{ const Lc=local(fm,lado); const encs=Lc.ret? ["caixa"] : ["caixa","inscrito"];
      lista.forEach(({mod,pen})=>encs.forEach(enc=>{ if(!aceita(mod, dims(Lc,enc))) return; const r=aplica(mod, fm, lado, enc, null); n++; if(!r) return; const v=aptoValida(r.planta, st, {rapido:true});
        cs.push({...r, mod, pen, fr:fm.fr, fm, lado, enc, s0:v.nota-pen-(fm.fr==="l"?3:0)-(enc==="inscrito"?0.5:0)-(lado==="b"?0.01:0), v0:v}) })) }));
    const naFaixa=(mod,dm)=>foraDe(mod,dm)<0.025;
    testa(frames.slice(0,1), naFaixa);
    if(!cs.some(c=>c.v0.ok) && frames.length>1) testa(frames.slice(1), naFaixa);
    if(!cs.length){ // nada na faixa: a menos ruim entre os partidos mais próximos da faixa (só para mostrar, com o aviso)
      const Lc=local(frames[0],"a"), dm=dims(Lc,"caixa"), mins=lista.map(x=>foraDe(x.mod,dm)), m0=Math.min(...mins);
      testa(frames.slice(0,1), (mod,d)=>foraDe(mod,dm)<=m0+0.5) }
    cs.sort((a,b)=>b.s0-a.s0);
    const lim = cs.length && cs[0].v0.ok? 4 : 2;
    let best=null; for(let i=0;i<cs.length && i<lim;i++){ const c=cs[i]; if(best && c.s0<=best.s) break; const v=aptoValida(c.planta, st); const s=v.nota-(c.s0-c.v0.nota); if(!best || s>best.s) best={...c, val:v, s} }
    if(best){ best.nVar=n; best.notas={}; cs.forEach(c=>{ const id=c.mod.id; if(best.notas[id]==null || c.v0.nota>best.notas[id]) best.notas[id]=c.v0.nota }); best.notas[best.mod.id]=best.val.nota;
      // galeria (ui/comodos.js): cada partido cabe (nota, sem grave) ou não cabe (o que pede a faixa, ou o problema que o derruba)
      best.info={}; cs.forEach(c=>{ const id=c.mod.id, I=best.info[id]; if(I && I.nota>=c.v0.nota) return; best.info[id]={nota:c.v0.nota, ok:c.v0.ok, motivo: c.v0.ok? "" : comMotivoCurto(c.v0.problemas, c.planta)} });
      best.info[best.mod.id]={nota:best.val.nota, ok:best.val.ok, motivo: best.val.ok? "" : comMotivoCurto(best.val.problemas, best.planta)};
      { const Lc=local(frames[0],"a"), dC=dims(Lc,"caixa"), dI=Lc.ret? dC : dims(Lc,"inscrito");
        lista.forEach(({mod})=>{ if(best.info[mod.id]) return; const dm= dI && foraDe(mod,dI)<foraDe(mod,dC)? dI : dC; best.info[mod.id]={nota:null, ok:false, ...comMotivoFaixa(mod, dm)} }) }
      const Lm=local(frames[0],"a"); best.Wf=Lm.F.W; best.Df=Lm.F.D; const mr=dims(Lm,"inscrito"); best.Wi=mr? mr[0] : Lm.F.W; best.Di=mr? mr[1] : Lm.F.D }
    return best };
  let best=_comCache.get(sigA);
  if(!best){ best=escolhe(fixo? [{mod:fixo, pen:0}] : cands); if(!best) return null; best=comMonta(best, u, st, cands); _comCache.set(sigA, best) }
  // ajuste manual: o partido e o referencial escolhidos ficam (não pula de arranjo ao arrastar); só a grade muda
  if(Object.keys(ov).length){ const r=aplica(best.mod, best.fm, best.lado, best.enc, ov); if(r){ const v=aptoValida(r.planta, st); best=comMonta({...best, ...r, val:v, s:v.nota}, u, st, cands) } }
  _comCache.set(sig, best);
  return finaliza(best);
}
/* resultado interno de uma unidade (L): planta + validação + alertas no formato antigo (erro/aviso/nota) */
function comMonta(c, u, st, cands){
  const pl=c.planta, v=c.val, F=c.F;
  const fr=c.fr||c.frame;
  const L={F, planta:pl, val:v, mk:c.mod.tipologia, mod:c.mod, frame:fr, fm:c.fm, lado:c.lado, enc:c.enc, prm:{fr, ax:c.fm.ax, dn:c.fm.dn, lado:c.lado}, nVar:c.nVar, notas:c.notas||{}, info:c.info||{}, score:v.nota, nota:v.nota};
  L.alertas=v.problemas.map(p=>({nivel:p.nivel==="bad"? "erro" : "aviso", msg:p.msg, k:p.k, amb:p.amb}));
  if(!v.ok){ // nenhum partido passa: o motivo e o que faria caber
    const mods=[...new Map(cands.map(x=>[x.mod.id,x.mod])).values()], W=c.Wi||F.W, D=c.Di||F.D;
    const wMin=Math.min(...mods.map(m=>(m.faixaW||{}).min||0)), wMax=Math.max(...mods.map(m=>((m.faixaW||{}).max||99)*APTO_FAIXA_FOLGA.W)), dMin=Math.min(...mods.map(m=>(m.faixaD||{}).min||0)), dMax=Math.max(...mods.map(m=>((m.faixaD||{}).max||99)*APTO_FAIXA_FOLGA.D));
    const nm=(COM_MODELOS[L.mk]||{}).nome||L.mk;
    const fu = Math.abs(W-F.W)>0.05? "frente útil" : "frente";   // unidade em L: a parte com a profundidade inteira
    const n2=(a,b)=>{ const d=Math.abs(a-b)<0.1? 2 : 1; return [comNf(a,d), comNf(b,d)] };   // casas para que os dois números não pareçam iguais
    let msg = W<wMin-0.02? (([a,b])=>`${fu} de ${a} m; os partidos de ${nm.toLowerCase()} pedem ${b} m ou mais`)(n2(W,wMin)) : D<dMin-0.02? (([a,b])=>`profundidade de ${a} m; os partidos de ${nm.toLowerCase()} pedem ${b} m ou mais`)(n2(D,dMin)) :
      W>wMax+0.02? (([a,b])=>`${fu} de ${a} m; os partidos de ${nm.toLowerCase()} vão até ${b} m`)(n2(W,wMax)) : D>dMax+0.02? (([a,b])=>`profundidade de ${a} m; os partidos vão até ${b} m`)(n2(D,dMax)) : ((v.problemas.find(p=>p.nivel==="bad" && p.k!=="faixa")||{}).msg||"conferir");
    // o mesmo em poucas palavras (rótulo na planta)
    L.motivo = W<wMin-0.02? (([a,b])=>`${fu} ${a} m · pedem ≥ ${b} m`)(n2(W,wMin)) : D<dMin-0.02? (([a,b])=>`profundidade ${a} m · pedem ≥ ${b} m`)(n2(D,dMin)) :
      W>wMax+0.02? (([a,b])=>`${fu} ${a} m · até ${b} m`)(n2(W,wMax)) : D>dMax+0.02? (([a,b])=>`profundidade ${a} m · até ${b} m`)(n2(D,dMax)) : comMotivoCurto(v.problemas, pl);
    L.semPartido=true; L.aviso=`nenhum partido cabe nesta unidade: ${msg}`; L.alertas.unshift({nivel:"erro", msg:L.aviso, k:"partido"}) }
  if(v.dutos && v.dutos.length) L.alertas.push({nivel:"nota", msg:"cozinha, serviço e banheiros sem fachada: ventilação por duto ou shaft (conferir)", k:"duto"});
  L.erros=L.alertas.filter(a=>a.nivel==="erro").length; L.avisos=L.alertas.filter(a=>a.nivel==="aviso").length; L.ok=v.ok;
  L.soma=pl.ambientes.reduce((s,r)=>s+r.area,0);
  return L;
}

/* sacada em balanço: na frente da sala, mesma área */
function comSacBalanco(L, u){
  const s=u.sac; if(!s || s.tipo!=="balanco" || !L.planta) return;
  const sala=L.planta.ambientes.find(r=>r.k==="sala"); if(!sala) return;
  const ext=s.poly.map(q=>G.dot(q,L.F.ax)), w=Math.max(...ext)-Math.min(...ext), pr=s.area/Math.max(0.1,w);
  const fr=sala.poly.filter(q=>q[1]<0.05).map(q=>q[0]), x0=fr.length? Math.min(...fr) : 0, x1=fr.length? Math.max(...fr) : L.F.W;
  const xc=Math.min(Math.max((x0+x1)/2, w/2), L.F.W-w/2);
  const a=[L.F.w(xc-w/2,0),L.F.w(xc+w/2,0),L.F.w(xc+w/2,-pr),L.F.w(xc-w/2,-pr)];
  s.poly=a; s.area=G.area(a);
}

/* ---------- mobiliário (posições achadas na validação) → desenho no mundo ---------- */
function comMoveis(L){
  const F=L.F, out=[], its=(L.val && L.val.moveis)||[];
  its.forEach(it=>{ const [x0,y0,x1,y1]=it.ret, r=it.rot, Wd= r%2? y1-y0 : x1-x0, Hd= r%2? x1-x0 : y1-y0;
    const P=(u,v)=>{ const q= r===0? [x0+u, y0+v] : r===2? [x1-u, y1-v] : r===1? [x1-v, y0+u] : [x0+v, y1-u]; return F.w(q[0], q[1]) };
    const R=(u0,v0,u1,v1,k)=>out.push({t:"r", k, pts:[P(u0,v0),P(u1,v0),P(u1,v1),P(u0,v1)]}), Cc=(u,v,rr,k)=>out.push({t:"c", k, c:P(u,v), r:rr}), Ln=(u0,v0,u1,v1,k)=>out.push({t:"l", k, pts:[P(u0,v0),P(u1,v1)]});
    const k=it.k; R(0,0,Wd,Hd,k);
    if(k==="cama"){ if(Wd>1.2){ R(0.1,0.08,Wd/2-0.05,0.45,"trav"); R(Wd/2+0.05,0.08,Wd-0.1,0.45,"trav") } else R(0.12,0.08,Wd-0.12,0.45,"trav"); Ln(0,0.6,Wd,0.6,"cama") }
    else if(k==="armario"){ Ln(0,Hd/2,Wd,Hd/2,"armario") }
    else if(k==="sofa"){ R(0,0,Wd,0.2,"sofa"); R(0,0.2,0.18,Hd,"sofa"); R(Wd-0.18,0.2,Wd,Hd,"sofa") }
    else if(k==="mesa"){ [[Wd/2,-0.28],[Wd/2,Hd+0.28],[-0.28,Hd/2],[Wd+0.28,Hd/2]].forEach(([u,v])=>R(u-0.2,v-0.2,u+0.2,v+0.2,"cadeira")) }
    else if(k==="bancada"){ R(Wd*0.42,0.1,Wd*0.42+0.5,0.5,"pia"); Cc(Wd-0.32,0.18,0.1,"fogao"); Cc(Wd-0.32,0.43,0.1,"fogao"); Cc(Wd-0.62,0.18,0.1,"fogao"); Cc(Wd-0.62,0.43,0.1,"fogao") }
    else if(k==="maquina"){ Cc(Wd/2,Hd/2,Math.min(Wd,Hd)*0.33,"maquina") }
    else if(k==="tanque"){ R(0.08,0.08,Wd-0.08,Hd-0.12,"tanque") }
    else if(k==="box"){ Ln(0,0,Wd,Hd,"box") }
    else if(k==="vaso"){ Cc(Wd/2, Hd*0.62, Math.min(0.18,Wd*0.42), "vaso"); R(0.04,0,Wd-0.04,0.18,"vaso") }
    else if(k==="lav"){ Cc(Wd/2, Hd/2, Math.min(Wd,Hd)*0.3, "lav") }
    else if(k==="trab"){ R(Wd/2-0.22,Hd+0.12,Wd/2+0.22,Hd+0.55,"cadeira") } });
  return out;
}

/* forma enxuta guardada na unidade (sem referências cruzadas: viaja do Worker por structured clone) */
function comExporta(L){
  const F=L.F, pl=L.planta, idx=new Map(pl.ambientes.map((r,i)=>[r.id,i])), W=pts=>pts.map(q=>F.w(q[0],q[1]));
  const probs=L.val.problemas, nv={}; probs.forEach(p=>{ if(p.amb && nv[p.amb]!=="bad") nv[p.amb]=p.nivel });
  const integ=new Set(pl.portas.filter(p=>p.k==="integ").flatMap(p=>[p.a,p.b]));
  const rooms=pl.ambientes.map(r=>{ const ci=aptoCirculoInscrito(r.poly), bb=aptoBBox(r.poly);
    const jan=pl.janelas.filter(j=>j.amb===r.id).reduce((s,j)=>s+j.w*j.h,0)+pl.portas.filter(p=>p.k==="pj" && p.a===r.id).reduce((s,p)=>s+p.w*((L.janH)||2.1),0);
    return {id:r.id, k:r.k, nome:r.nome, longo:r.longo, poly:W(r.poly), area:r.area, alvo:r.alvo, larg:Math.min(bb[2]-bb[0], bb[3]-bb[1]), d:r._d||ci.d, jan, janReq:0, duto:(L.val.dutos||[]).includes(r.id), integ:integ.has(r.id),
      bordas:r.bordas.map(b=>({i:b.i, c:b.c})), alertas:probs.filter(p=>p.amb===r.id).map(p=>({nivel:p.nivel==="bad"?"erro":"aviso", msg:p.msg})), nivel:nv[r.id]||null, c:F.w(ci.c[0],ci.c[1]), rc:F.w(ci.c[0],ci.c[1])} });
  const doors=pl.portas.map(p=>{ const into = p.k==="porta"? idx.get(p.abre) : p.k==="entrada"? idx.get(p.b) : idx.get(p.b), from = p.k==="entrada"? undefined : (p.k==="porta"? idx.get(p.abre===p.a? p.b : p.a) : idx.get(p.a));
    const n=comVet(F, p.p0, p.n||[0,1]), l=Math.hypot(n[0],n[1])||1;
    return {k:p.k, p0:F.w(p.p0[0],p.p0[1]), p1:F.w(p.p1[0],p.p1[1]), n:[n[0]/l,n[1]/l], hinge: p.dob==="p1"? "hi" : "lo", from, into} });
  const windows=pl.janelas.map(j=>{ const n=comVet(F, j.p0, j.n), l=Math.hypot(n[0],n[1])||1; return {p0:F.w(j.p0[0],j.p0[1]), p1:F.w(j.p1[0],j.p1[1]), n:[n[0]/l,n[1]/l], room:idx.get(j.amb)} });
  // divisões arrastáveis: linhas da grade do partido que são parede de verdade
  const gd=pl.grade, divs=[], cortes={}, R=gd.R, Wr=R[2]-R[0], Dr=R[3]-R[1];
  const lado=(ax,k,v)=>{ let lo=Infinity, hi=-Infinity; pl.ambientes.forEach(r=>r.poly.forEach((p,i)=>{ const q=r.poly[(i+1)%r.poly.length], c= ax==="x"? 0 : 1, o=1-c; if(Math.abs(p[c]-v)<1e-3 && Math.abs(q[c]-v)<1e-3 && Math.abs(p[o]-q[o])>0.05){ lo=Math.min(lo,p[o],q[o]); hi=Math.max(hi,p[o],q[o]) } })); return hi-lo>0.3? [lo,hi] : null };
  [["x",gd.xs,Wr,R[0]],["y",gd.ys,Dr,R[1]]].forEach(([ax,vs,tot,o0])=>{ for(let k=1;k<vs.length-1;k++){ const v=vs[k]; cortes[ax+k]=+((v-o0)/tot).toFixed(4); const sp=lado(ax,k,v); if(!sp) continue;
    const d={id:ax+k, ax, lo:vs[k-1]+0.5, hi:vs[k+1]-0.5, o0, tot}; if(ax==="x"){ d.x=v; d.y0=sp[0]; d.y1=sp[1]; d.p0=F.w(v,sp[0]); d.p1=F.w(v,sp[1]) } else { d.y=v; d.x0=sp[0]; d.x1=sp[1]; d.p0=F.w(sp[0],v); d.p1=F.w(sp[1],v) } divs.push(d) } });
  return {
    modelo:L.mk, partido:L.mod.id, partidoNome:L.mod.nome, origem:L.mod.origem||"catalogo", encaixe:L.enc, frame:L.frame, lado:F.lado, nVar:L.nVar, score:L.nota, nota:L.nota, notas:L.notas,
    ok:L.ok, erros:L.erros, avisos:L.avisos, soma:L.soma, semPartido:!!L.semPartido, aviso:L.aviso||"", motivo:L.motivo||"",
    ax:F.ax, dn:F.dn, a0:F.a0, a1:F.a1, d0:F.d0, W:F.W, D:F.D, R,
    rooms, doors, windows, movel:L.movel||comMoveis(L), divs:divs.map(d=>({id:d.id, ax:d.ax, p0:d.p0, p1:d.p1, lo:d.lo, hi:d.hi, o0:d.o0, tot:d.tot, v: d.ax==="x"? d.x : d.y})),
    cortes, alertas:L.alertas, problemas:probs
  };
}

/* ---------- todas as unidades do pavimento tipo ---------- */
function comodosCalc(m, st){
  const out={unidades:0, validas:0, erros:0, avisos:0, semPartido:0, nota:0, porTipo:{}, lista:[]};
  (m.tipo||[]).forEach((lay,ti)=>{ if(!lay) return;
    const ctx={plate:(m.T[ti]||{}).plate||[], corridor:lay.corridor, core:lay.coreOut||lay.core}; ctx.sig=JSON.stringify([ctx.plate, ctx.corridor, ctx.core].map(p=>(p||[]).map(q=>[+q[0].toFixed(2),+q[1].toFixed(2)])));
    lay.units.forEach((u,ui)=>{ if(u.livre){ u.com=null; return }
      let L=null; try{ L=comUnidade(u, lay, st, ctx) }catch(e){ console.error("[comodos]", e) }
      if(!L){ u.com=null; return }
      if(st.comodos && st.comodos.on){ const sac=L.planta.ambientes.find(r=>r.k==="sacada"); if(sac && u.sac && u.sac.tipo!=="balanco"){ u.sac.poly=sac.poly.map(q=>L.F.w(q[0],q[1])); u.sac.area=sac.area } else comSacBalanco(L, u) }
      u.com=comExporta(L);
      out.unidades++; if(L.ok) out.validas++; if(L.semPartido) out.semPartido++; out.erros+=L.erros; out.avisos+=L.avisos; out.nota+=L.nota;
      const T=out.porTipo[u.nome]=out.porTipo[u.nome]||{nome:u.nome, modelo:L.mk, partido:L.mod.id, partidoNome:L.mod.nome, n:0, validas:0, nota:0, ex:{ti,ui}, usados:{}, notas:{}};
      T.n++; if(L.ok) T.validas++; T.nota+=L.nota; T.usados[L.mod.id]=(T.usados[L.mod.id]||0)+1; T.notaUso=T.notaUso||{}; T.notaUso[L.mod.id]=(T.notaUso[L.mod.id]||0)+L.nota;
      Object.entries(L.notas||{}).forEach(([id,n])=>{ if(T.notas[id]==null || n<T.notas[id]) T.notas[id]=n });   // nota do partido na pior unidade da tipologia
      // cabe / não cabe por partido (galeria): vale a pior unidade — não cabe numa, não cabe na tipologia
      T.info=T.info||{}; Object.entries(L.info||{}).forEach(([id,I])=>{ const J=T.info[id], ruim=x=>x.nota==null? 2 : !x.ok? 1 : 0;
        if(!J || ruim(I)>ruim(J) || (ruim(I)===ruim(J) && (I.nota==null? (I.falta||0)>(J.falta||0) : I.nota<J.nota))) T.info[id]={...I} });
      if(L.semPartido && !T.aviso) T.aviso=L.aviso;
      out.lista.push({ti, ui, nome:u.nome, ok:L.ok, nota:L.nota, alertas:L.alertas});
    });
  });
  Object.values(out.porTipo).forEach(T=>{ T.nota=Math.round(T.nota/Math.max(1,T.n)); Object.keys(T.notaUso||{}).forEach(id=>{ T.notaUso[id]=Math.round(T.notaUso[id]/T.usados[id]) }); const us=Object.entries(T.usados).sort((a,b)=>b[1]-a[1]); if(us.length){ T.partido=us[0][0]; const md=aptoModelo(T.partido, st); if(md) T.partidoNome=md.nome } });
  out.nota=out.unidades? Math.round(out.nota/out.unidades) : 0;
  // sacadas embutidas reposicionadas na frente da sala: refaz a soma (só informativa; a área vendável não muda)
  if(st.comodos && st.comodos.on){ m.sacA=0; (m.T||[]).forEach((t,i)=>{ const l=m.tipo[i]; if(l) l.units.forEach(u=>{ if(u.sac) m.sacA+=u.sac.area*t.tipoFloors }) }) }
  m.comodos=out; return out;
}
HOOK.compute.push((m, st, opt)=>{ if(opt && opt.quick && opt.layouts!==false) return; comodosCalc(m, st) });

/* quadro de áreas (para o inspetor, o PDF e os testes): por tipologia, a primeira unidade como representante */
function comQuadro(m){
  const out=[];
  Object.values((m.comodos||{}).porTipo||{}).forEach(T=>{ const lay=m.tipo[T.ex.ti], u=lay&&lay.units[T.ex.ui]; if(!u||!u.com) return;
    const rooms=u.com.rooms.slice().sort((a,b)=>{ const o=k=>["sala","sacada","lavabo","cozinha","serv","desp","circ","office","suite","bsuite","closet","dorm","banho"].indexOf(k); return o(a.k)-o(b.k) || a.nome.localeCompare(b.nome) });
    out.push({nome:u.nome, modelo:u.com.partidoNome || (COM_MODELOS[u.com.modelo]||{}).nome || u.com.modelo, programa:(COM_MODELOS[u.com.modelo]||{}).nome||u.com.modelo, nota:T.nota, area:u.area, alvo:u.alvo, n:T.n, validas:T.validas,
      rooms:rooms.map(r=>({nome:r.longo, k:r.k, area:r.area, larg:r.larg, st: r.alertas.some(a=>a.nivel==="erro")? "bad" : r.alertas.length? "warn" : "ok"})), soma:u.com.soma}) });
  return out;
}
/* página do PDF: quadro de áreas por cômodo (registrada em src/ui/comodos.js) */
async function comPdf(ctx){
  const m=ctx.m; if(!m || !m.comodos || !m.comodos.unidades) return;
  const Q=comQuadro(m); if(!Q.length) return;
  ctx.newPage(); ctx.h2("Quadro de áreas por cômodo");
  const doc=ctx.doc; doc.setFontSize(8.5); doc.setTextColor(...(ctx.mut||[110,110,115]));
  doc.text(ctx.T(`${m.comodos.validas} de ${m.comodos.unidades} unidades do pavimento tipo com planta sem problema grave (nota média ${m.comodos.nota}). Áreas de eixo a eixo (somam a área da unidade).`), ctx.M, ctx.y()); ctx.setY(ctx.y()+6);
  Q.forEach(q=>{ if(ctx.y()>235) ctx.newPage();
    doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(...(ctx.ink||[29,29,31])); doc.text(ctx.T(`${q.nome}  ·  ${q.modelo}  ·  nota ${q.nota}  ·  ${q.validas} de ${q.n} unidades sem problema grave`), ctx.M, ctx.y()); doc.setFont("helvetica","normal"); ctx.setY(ctx.y()+5);
    ctx.rows(q.rooms.map(r=>[r.nome, `${nf(r.area,2)} m²  ·  ${nf(r.larg,2)} m`, r.st]).concat([["Total da unidade", `${nf(q.soma,2)} m²`]]), {bold:["Total da unidade"]});
  });
  doc.setFontSize(7.5); doc.setTextColor(...(ctx.mut||[110,110,115])); if(ctx.y()<282) doc.text(ctx.T("Partidos de mercado conferidos por regras de projeto (círculo inscrito, áreas mínimas, acessos, iluminação de 1/"+((S.comodos&&S.comodos.jan&&S.comodos.jan.frac)||6)+" do piso, mobiliário). Mínimos de referência: conferir no código de obras do município."), ctx.M, Math.min(286, ctx.y()+2));
  ctx.setY(ctx.y()+8);
}

/* ---------- exportação (puras: recebem o construtor do DXF / devolvem geometria) ---------- */
function comArco(c, r, a0, a1, n=8){ const out=[]; for(let i=0;i<=n;i++){ const a=a0+(a1-a0)*i/n; out.push([c[0]+r*Math.cos(a), c[1]+r*Math.sin(a)]) } return out }
const COM_PORTA_H = 2.1;   // altura dos vãos de porta e passagem
/* vãos de porta e passagem da unidade, no mundo: p0/p1 na linha de referência do vão, n = lado para onde a porta abre e
   [o0,o1] = espessura da parede medida a partir dessa linha, no sentido de n (porta interna: centrada; entrada: da face do corredor para dentro) */
function comVaos(u){
  const c=u.com; if(!c) return [];
  return c.doors.map((d,i)=>{ const ent=d.k==="entrada", t=ent? COM_WALL.corredor : COM_WALL.interna;
    return {i, k:d.k, p0:d.p0, p1:d.p1, n:d.n, o0: ent? 0 : -t, o1: ent? t : t, w:Math.hypot(d.p1[0]-d.p0[0], d.p1[1]-d.p0[1]), h:COM_PORTA_H, hinge:d.hinge} });
}
/* contorno de um cômodo (ou da unidade) interrompido nos vãos: devolve polilinhas {pts, aberta} — aberta=false só quando o contorno inteiro fica */
function comCortaContorno(P, vaos){
  const n=P.length, segs=[]; let algum=false;
  for(let i=0;i<n;i++){ const A=P[i], B=P[(i+1)%n], dx=B[0]-A[0], dy=B[1]-A[1], L=Math.hypot(dx,dy); if(L<1e-6){ segs.push(null); continue }
    const d=[dx/L,dy/L], cuts=[];
    vaos.forEach(v=>{ const vx=v.p1[0]-v.p0[0], vy=v.p1[1]-v.p0[1], vl=Math.hypot(vx,vy); if(vl<1e-6 || Math.abs(d[0]*vy-d[1]*vx)/vl>0.03) return;
      const f=(A[0]-v.p0[0])*v.n[0]+(A[1]-v.p0[1])*v.n[1]; if(f<v.o0-0.02 || f>v.o1+0.02) return;
      const a=(v.p0[0]-A[0])*d[0]+(v.p0[1]-A[1])*d[1], b=(v.p1[0]-A[0])*d[0]+(v.p1[1]-A[1])*d[1], lo=Math.max(0,Math.min(a,b)), hi=Math.min(L,Math.max(a,b));
      if(hi-lo>0.02) cuts.push([lo,hi]) });
    cuts.sort((x,y)=>x[0]-y[0]); const keep=[]; let x=0;
    cuts.forEach(([lo,hi])=>{ if(lo-x>0.01) keep.push([x,lo]); x=Math.max(x,hi) }); if(L-x>0.01) keep.push([x,L]);
    if(cuts.length) algum=true;
    segs.push({A,d,L,keep}) }
  if(!algum) return [{pts:P, aberta:false}];
  const chains=[]; let cur=null, prevEdge=-2, prevFull=false, primeiraNoVertice=false;
  segs.forEach((e,i)=>{ if(!e) return;
    e.keep.forEach(([s0,s1],k)=>{ const p0=[e.A[0]+e.d[0]*s0, e.A[1]+e.d[1]*s0], p1=[e.A[0]+e.d[0]*s1, e.A[1]+e.d[1]*s1];
      if(cur && k===0 && s0<=1e-6 && prevEdge===i-1 && prevFull) cur.pts.push(p1);
      else { if(cur) chains.push(cur); cur={pts:[p0,p1]}; if(!chains.length && i===0 && k===0 && s0<=1e-6) primeiraNoVertice=true }
      prevEdge=i; prevFull=s1>=e.L-1e-6 }) });
  if(cur) chains.push(cur);
  // a cadeia do fim e a do começo se encontram no vértice 0
  if(chains.length>1 && primeiraNoVertice && prevEdge===n-1 && prevFull){ const ult=chains.pop(); chains[0].pts=ult.pts.concat(chains[0].pts.slice(1)) }
  return chains.map(c=>({pts:c.pts, aberta:true}));
}
/* DXF por camada: PAREDES (faces internas dos cômodos e face externa da unidade, interrompidas nos vãos, com as ombreiras),
   PORTAS (folha e arco de abertura), JANELAS, MOBILIARIO, TEXTOS */
function comDxf(d, lay){
  (lay.units||[]).forEach(u=>{ const c=u.com; if(!c) return;
    if(c.semPartido){ d.poly("PAREDES", u.poly, 7); d.text("TEXTOS", G.centroid(u.poly), 0.22, "SEM PARTIDO QUE CAIBA"); return }   // nada de planta "só para caber"
    const vaos=comVaos(u), corta=(layer, pts, cor)=>comCortaContorno(pts, vaos).forEach(ch=>d.poly(layer, ch.pts, cor, ch.aberta));
    corta("PAREDES", u.poly, 7);
    c.rooms.forEach(r=>{ const ins=comInsetRoom(r);
      if(r.k==="sacada") d.poly("GUARDA-CORPO", ins, 4); else corta("PAREDES", ins, 7);
      const p=G.pip(r.c, r.poly)? r.c : r.rc; d.text("TEXTOS", p, 0.22, r.longo||r.nome); d.text("TEXTOS", [p[0], p[1]-0.32], 0.16, `${nf(r.area,2)} m2`) });
    vaos.forEach(v=>[v.p0,v.p1].forEach(q=>d.poly("PAREDES", [[q[0]+v.n[0]*v.o0, q[1]+v.n[1]*v.o0],[q[0]+v.n[0]*v.o1, q[1]+v.n[1]*v.o1]], 7, true)));   // ombreiras
    c.doors.forEach(dr=>{ if(dr.k==="vao"||dr.k==="integ") return;
      if(dr.k==="pj"){ d.poly("JANELAS",[dr.p0,dr.p1],5); return }
      const H= dr.hinge==="hi"? dr.p1 : dr.p0, O= dr.hinge==="hi"? dr.p0 : dr.p1, w=Math.hypot(O[0]-H[0],O[1]-H[1]), L=[H[0]+dr.n[0]*w, H[1]+dr.n[1]*w];
      d.poly("PORTAS",[H,L],3); const a0=Math.atan2(L[1]-H[1],L[0]-H[0]); let da=Math.atan2(O[1]-H[1],O[0]-H[0])-a0; while(da>Math.PI) da-=2*Math.PI; while(da<-Math.PI) da+=2*Math.PI; d.poly("PORTAS", comArco(H,w,a0,a0+da), 3, true) });
    c.windows.forEach(wd=>{ const t=COM_WALL.fachada, nI=[-wd.n[0],-wd.n[1]], o=k=>[[wd.p0[0]+nI[0]*k, wd.p0[1]+nI[1]*k],[wd.p1[0]+nI[0]*k, wd.p1[1]+nI[1]*k]];
      d.poly("JANELAS", o(t*0.38), 5); d.poly("JANELAS", o(t*0.62), 5) });
    (c.movel||[]).forEach(f=>{ if(f.t==="c") d.poly("MOBILIARIO", comArco(f.c, f.r, 0, 2*Math.PI, 16).slice(0,-1), 8); else d.poly("MOBILIARIO", f.pts, 8) });
  });
}
/* paredes como retângulos (IFC): externas recuadas para dentro da unidade; internas centradas, uma por reta (os trechos
   de cômodos vizinhos que se encostam viram uma parede só). Cada parede leva os seus vãos (w.vaos = [{v, s0, s1}], distâncias
   ao longo de a→b); o que não achou parede fica em out.orfas. Os retângulos são inteiros: o vão se faz por IfcOpeningElement */
function comParedes(u){
  const c=u.com, out=[]; out.orfas=[]; if(!c) return out;
  const rect=(a,b,n,t0,t1)=>[[a[0]+n[0]*t0,a[1]+n[1]*t0],[b[0]+n[0]*t0,b[1]+n[1]*t0],[b[0]+n[0]*t1,b[1]+n[1]*t1],[a[0]+n[0]*t1,a[1]+n[1]*t1]];
  const linhas=[];
  c.rooms.forEach(r=>{ const cls=comEdgeClsPuro(r), p=r.poly, rs=G.sArea(p)>0?1:-1;
    for(let i=0;i<p.length;i++){ const a=p[i], b=p[(i+1)%p.length], L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<0.05) continue; const k=cls[i]||"interna", nIn= rs>0? [-(b[1]-a[1])/L,(b[0]-a[0])/L] : [(b[1]-a[1])/L,-(b[0]-a[0])/L];
      if(k==="interna"){ let d=[(b[0]-a[0])/L,(b[1]-a[1])/L]; if(d[0]<-1e-6 || (Math.abs(d[0])<=1e-6 && d[1]<0)) d=[-d[0],-d[1]];
        const nr=[-d[1],d[0]], off=a[0]*nr[0]+a[1]*nr[1], s0=a[0]*d[0]+a[1]*d[1], s1=b[0]*d[0]+b[1]*d[1];
        let ln=linhas.find(l=>Math.abs(l.d[0]*d[1]-l.d[1]*d[0])<2e-3 && Math.abs(l.off-off)<0.03); if(!ln) linhas.push(ln={d,nr,off,iv:[]}); ln.iv.push([Math.min(s0,s1),Math.max(s0,s1)]) }
      else { const t= k==="fachada"? (r.k==="sacada"? COM_WALL.guarda : COM_WALL.fachada) : COM_WALL[k]; out.push({key:null, tipo: k==="fachada"? (r.k==="sacada"? "guarda" : "fachada") : "divisa", poly:rect(a,b,nIn,0,t), len:L, a, b, n:nIn, o0:0, o1:t, vaos:[]}) } } });
  linhas.forEach(ln=>{ ln.iv.sort((x,y)=>x[0]-y[0]); const mer=[]; ln.iv.forEach(v=>{ const ult=mer[mer.length-1]; if(ult && v[0]<=ult[1]+0.05) ult[1]=Math.max(ult[1],v[1]); else mer.push([v[0],v[1]]) });
    mer.forEach(([s0,s1])=>{ if(s1-s0<0.05) return; const a=[ln.d[0]*s0+ln.nr[0]*ln.off, ln.d[1]*s0+ln.nr[1]*ln.off], b=[ln.d[0]*s1+ln.nr[0]*ln.off, ln.d[1]*s1+ln.nr[1]*ln.off], h=COM_WALL.interna;
      out.push({key:null, tipo:"interna", poly:rect(a,b,ln.nr,-h,h), len:s1-s0, a, b, n:ln.nr, o0:-h, o1:h, vaos:[]}) }) });
  // vãos → parede que os contém (a linha do vão dentro da espessura e o vão dentro do comprimento)
  comVaos(u).forEach(v=>{ let ach=null;
    for(const w of out){ if(w.tipo==="guarda") continue; const wd=[(w.b[0]-w.a[0])/w.len,(w.b[1]-w.a[1])/w.len], vx=v.p1[0]-v.p0[0], vy=v.p1[1]-v.p0[1];
      if(Math.abs(wd[0]*vy-wd[1]*vx)/(v.w||1)>0.03) continue;
      const f=(v.p0[0]-w.a[0])*w.n[0]+(v.p0[1]-w.a[1])*w.n[1]; if(f<w.o0-0.03 || f>w.o1+0.03) continue;
      const sA=(v.p0[0]-w.a[0])*wd[0]+(v.p0[1]-w.a[1])*wd[1], sB=(v.p1[0]-w.a[0])*wd[0]+(v.p1[1]-w.a[1])*wd[1], s0=Math.min(sA,sB), s1=Math.max(sA,sB);
      if((s0+s1)/2<0 || (s0+s1)/2>w.len || Math.min(w.len,s1)-Math.max(0,s0)<0.6*(s1-s0)) continue;   // o centro cai na parede; pontas que sobram (parede inclinada) são aparadas
      ach={w, s0:Math.max(0,s0), s1:Math.min(w.len,s1)}; break }
    if(ach) ach.w.vaos.push({v, s0:ach.s0, s1:ach.s1}); else out.orfas.push(v) });
  return out;
}
/* a parede sem os vãos: retângulos que sobram (para quem não usa IfcOpeningElement) */
function comParedeRecortada(w){
  const wd=[(w.b[0]-w.a[0])/w.len,(w.b[1]-w.a[1])/w.len], P=(s,o)=>[w.a[0]+wd[0]*s+w.n[0]*o, w.a[1]+wd[1]*s+w.n[1]*o], out=[];
  const cuts=(w.vaos||[]).map(x=>[x.s0,x.s1]).sort((p,q)=>p[0]-q[0]); let x=0;
  const rc=(s0,s1)=>{ if(s1-s0>0.02) out.push([P(s0,w.o0),P(s1,w.o0),P(s1,w.o1),P(s0,w.o1)]) };
  cuts.forEach(([lo,hi])=>{ rc(x,lo); x=Math.max(x,hi) }); rc(x,w.len);
  return out;
}
/* IFC: IfcWall por parede + IfcOpeningElement por vão (IfcRelVoidsElement) + IfcDoor na abertura (IfcRelFillsElement).
   B = construtores do export.js: {add, lp, solid, str, guid, st (pavimento), cod (código da unidade)}. Passagens ficam só com a abertura */
function comIfcParedes(u, B){
  const ws=comParedes(u), rl=v=>{ const t=String(+(+v).toFixed(4)); return /[.eE]/.test(t)? t : t+"." }; let nd=0;
  ws.forEach((w,k)=>{
    const wall=B.add(`IFCWALL('${B.guid()}',$,${B.str(`${B.cod} parede ${k+1}`)},$,${B.str(w.tipo==="interna"?"Parede interna":w.tipo==="guarda"?"Guarda-corpo":w.tipo==="fachada"?"Parede de fachada":"Parede de divisa")},${B.lp(B.st.p,0)},${B.solid(w.poly, w.tipo==="guarda"? 1.1 : 2.8)},$,${w.tipo==="interna"?".PARTITIONING.":".STANDARD."})`);
    B.st.els.push(wall);
    const wd=[(w.b[0]-w.a[0])/w.len,(w.b[1]-w.a[1])/w.len], Q=(s,o)=>[w.a[0]+wd[0]*s+w.n[0]*o, w.a[1]+wd[1]*s+w.n[1]*o];
    (w.vaos||[]).forEach(x=>{ const v=x.v; nd++;
      const nome=`${B.cod} ${v.k==="porta"||v.k==="entrada"? "porta" : v.k==="pj"? "porta-janela" : "passagem"} ${nd}`, e=0.02;
      const poly=[Q(x.s0,w.o0-e),Q(x.s1,w.o0-e),Q(x.s1,w.o1+e),Q(x.s0,w.o1+e)];
      const abertura=B.add(`IFCOPENINGELEMENT('${B.guid()}',$,${B.str(nome+" - vao")},$,$,${B.lp(B.st.p,0)},${B.solid(poly, v.h)},$,.OPENING.)`);
      B.add(`IFCRELVOIDSELEMENT('${B.guid()}',$,$,$,${wall},${abertura})`);
      if(v.k==="vao"||v.k==="integ") return;   // passagem sem folha
      const m=(w.o0+w.o1)/2, folha=[Q(x.s0,m-0.02),Q(x.s1,m-0.02),Q(x.s1,m+0.02),Q(x.s0,m+0.02)];
      const op= v.k==="pj"? ".SLIDING_TO_LEFT." : v.hinge==="hi"? ".SINGLE_SWING_RIGHT." : ".SINGLE_SWING_LEFT.";
      const porta=B.add(`IFCDOOR('${B.guid()}',$,${B.str(nome)},$,$,${B.lp(B.st.p,0)},${B.solid(folha, v.h)},$,${rl(v.h)},${rl(x.s1-x.s0)},.DOOR.,${op},$)`);
      B.add(`IFCRELFILLSELEMENT('${B.guid()}',$,$,$,${abertura},${porta})`); B.st.els.push(porta) }) });
  return nd;
}
function comEdgeClsPuro(r){ const pr={fachada:4, corredor:3, nucleo:3, divisa:3, interna:1}, cls=[]; (r.bordas||[]).forEach(b=>{ if(!cls[b.i] || pr[b.c]>pr[cls[b.i]]) cls[b.i]=b.c }); return cls }
/* contorno interno do cômodo (face das paredes): recuo por aresta conforme o vizinho */
function comInsetRoom(r){ const cls=comEdgeClsPuro(r); return comInset(r.poly, i=>{ const c=cls[i]||"interna"; return c==="fachada"? (r.k==="sacada"? COM_WALL.guarda : COM_WALL.fachada) : COM_WALL[c]||COM_WALL.interna }) }
