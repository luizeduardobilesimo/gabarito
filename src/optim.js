/* ================= potencial do terreno e otimizador de produto ================= */
const MIX_PRESETS = {
  atual:   { nome:"Tipologias atuais", tips:null },
  compacto:{ nome:"Compacto", tips:[{nome:"Studio",area:30,w:0.45,pf:1.14,sac:3},{nome:"1 dorm.",area:44,w:0.55,pf:1.07,sac:4}] },
  familia: { nome:"Família", tips:[{nome:"2 dorm.",area:64,w:0.6,pf:1.0,sac:6},{nome:"3 dorm.",area:88,w:0.4,pf:0.97,sac:9}] },
  alto:    { nome:"Alto padrão", tips:[{nome:"3 suítes",area:125,w:0.6,pf:1.1,sac:14},{nome:"4 suítes",area:170,w:0.4,pf:1.14,sac:22}] }
};
function basePrice(st){ const mx=st.produto.mix, a=mx.reduce((s,u)=>s+u.area*u.qtd,0); return a? mx.reduce((s,u)=>s+u.area*u.qtd*u.preco,0)/a : 10000 }
function presetMix(st, key, N){
  const pr=MIX_PRESETS[key]; if(!pr.tips){ const cur=st.produto.mix, tot=cur.reduce((s,u)=>s+u.qtd,0)||1; return distrib(cur.map(u=>({...u, w:u.qtd/tot})), N, u=>({nome:u.nome,area:u.area,preco:u.preco,sac:u.sac||0})) }
  const bp=basePrice(st); return distrib(pr.tips, N, t=>({nome:t.nome,area:t.area,preco:Math.round(bp*t.pf/50)*50,sac:t.sac}));
}
function distrib(tips, N, mk){
  const raw=tips.map(t=>t.w*N), q=raw.map(Math.floor); let rest=N-q.reduce((a,b)=>a+b,0);
  raw.map((r,i)=>[r-q[i],i]).sort((a,b)=>b[0]-a[0]).forEach(([_,i])=>{ if(rest>0){ q[i]++; rest-- } });
  return tips.map((t,i)=>({...mk(t), qtd:q[i]})).filter(u=>u.qtd>0);
}
/* Potencial do terreno (Fase D). Dois olhares sobre o privativo possível:
   - pelo ANDAR (priv0, o cálculo antigo): área bruta de pavimentos tipo × eficiência do andar. Não conta garagem, hall nem lazer — superestima;
   - GLOBAL (priv, o que vale): área total construída possível × eficiência global do estudo (privativa ÷ ATC, `m.eficGlobal`), a mesma
     da "Saúde do negócio". A ATC possível é o menor entre o limite do CA (computável máx. × ATC ÷ computável do estudo, que carrega
     subsolos, garagem e áreas comuns na mesma proporção) e o da altura (cada torre sobe até o gabarito: + andares × área do andar).
   A altura-limite é m.hLim (gabarito da zona ou plano do aeródromo — src/calc/forma.js), não só R.hMax. */
function potencial(st, m){
  const R=st.regras, P=st.produto, A=m.A, hLim=m.hLim ?? R.hMax, hEmb=P.peTerreo+P.garAcima*P.peGar;
  const compMax=R.caMax*A, compBas=R.caBas*A;
  const pavH=Math.max(0,Math.floor((hLim-hEmb)/P.pe));
  const brutoPorCA = compMax/(1-R.ncTipo) - m.lojaA; // área bruta de pavimentos tipo que o CA permite
  const brutoPorVol = R.toTorre*A*pavH;           // limite pela projeção x altura
  const bruto=Math.max(0,Math.min(brutoPorCA, brutoPorVol)), limita = brutoPorCA<=brutoPorVol? "ca" : "altura";
  const area=(m.mixPriv/Math.max(1,m.mixUn))||70, preco=basePrice(st);
  // pelo andar (antigo)
  const priv0=bruto*P.efic + m.lojaPriv, un0=Math.floor(bruto*P.efic/area), vgv0=bruto*P.efic*preco + m.lojaPriv*st.fin.precoLoja;
  // global
  const eficGlobal = m.constr>0 ? m.priv/m.constr : 0;
  const atcCA = m.comp>0 ? m.constr*compMax/m.comp : 0;
  // torre desenhada: os andares a mais são do último bloco (ele estica), não do bloco de referência
  const atcAlt = m.constr + (m.T||[]).reduce((s,t)=>s+Math.max(0,pavH-(+t.pav||0))*(+(t.desenhada? t.Atop : t.A)||0),0);
  let priv=priv0, un=un0, vgv=vgv0, atc=0, lim=limita;
  if(eficGlobal>0 && atcCA>0){
    atc=Math.min(atcCA, atcAlt); lim = atcCA<=atcAlt? "ca" : "altura";
    priv=atc*eficGlobal; const res=Math.max(0, priv-m.lojaPriv); un=Math.floor(res/area); vgv=res*preco + m.lojaPriv*st.fin.precoLoja;
  }
  return {compMax, compBas, pavH, hLim, bruto, priv, un, limita:lim, vgv, atc, eficGlobal, priv0, un0, vgv0, limita0:limita,
    uso:{ ca:m.CA/Math.max(1e-9,R.caMax), to:m.TO/Math.max(1e-9,R.toEmb), h:m.H/Math.max(1e-9,hLim), priv:m.priv/Math.max(1,priv) } };
}
/* maior nº de pavimentos (iguais) que respeita gabarito (m.hLim) e CA — bisseção em 1..80. `teto` (opcional) é um limite superior EXATO do
   que o gabarito permite (cada pavimento custa ao menos P.pe): acima dele ok(n) é falso sem precisar do massing(), que é o que custa.
   O resultado é o mesmo da bisseção sem teto (a função não é monótona: a planta encolhe com a altura; por isso não se usa galope). */
function hLimDe(st){ return typeof formaHLim==="function" ? formaHLim(st) : st.regras.hMax }
function maxPavFast(st, teto=80){
  const ok=n=>{ if(n>teto) return false; const m=massing(st,{pav:n}); return m.H<=(m.hLim ?? st.regras.hMax)+1e-6 && m.CA<=st.regras.caMax+1e-6 && m.T.every(t=>t.A>1) };
  if(!ok(1)) return 0; let lo=1, hi=80; while(lo<hi){ const mid=Math.ceil((lo+hi)/2); if(ok(mid)) lo=mid; else hi=mid-1 } return lo;
}
const OBJ = { lucro:["Lucro",f=>f.lucro,"lucro"], margem:["Margem s/ VGV",f=>f.margemVGV,"margem s/ VGV"], tir:["TIR",f=>f.tirA??-1,"TIR"], vpl:["VPL",f=>f.vpl,"VPL"] };
/* números que cada combinação guarda (estimada ou conferida): margem = s/ VGV; eficiência global e V/C vêm da "Saúde do negócio" (f.saude) */
function otimNum(f, m, forma){ const sd=f.saude;
  return { lucro:f.lucro, margem:f.margemVGV, margemReceita:f.margem, tir:f.tirA, vpl:f.vpl, vgv:f.vgv,
    efic: sd? sd.eficGlobal : (m.constr>0? m.priv/m.constr : 0), vc: sd? sd.vc : null,
    ...(forma? {dev:otimDesvio(m), forma:true} : {}) } }

/* ---------- otimizar para uma forma desenhada (Fase C + D) ----------
   Com S.blocos.modo "desenhada" (e ao menos uma torre com bloco válido) a forma é do usuário: o otimizador NÃO muda o nº de torres
   nem os blocos. Varia só tipologias, unidades por andar, pavimentos (o último bloco estica), subsolos e garagens.
   A planta não encolhe nem cresce para o mix: as unidades é que crescem (fator t.r ≥ 1; abaixo de 1 o mix não cabe e a combinação
   cai). Por isso as unidades por andar são escolhidas para PREENCHER o bloco de referência (r perto de 1), a tolerância é S.otim.rTol
   (padrão 10%, o mesmo limite do aviso "o mix ocupa X% do pavimento") e a nota das combinações é penalizada pelo desvio. */
const OTIM_PEN = 2;   // nota ajustada = nota × (1 − OTIM_PEN × desvio)
function otimFormaAtiva(st){ return typeof blcAtivo==="function" && blcAtivo(st) && (st.blocos.torres||[]).some(t=>t && (t.blocos||[]).some(blcValido)) }
/* desvio médio do tamanho das unidades frente ao mix (|r − 1|), ponderado pela área privativa de cada faixa de andares tipo */
function otimDesvio(m){ let s=0, w=0;
  (m.T||[]).forEach(t=>(t.faixas||[]).forEach(f=>{ const p=(f.nTipo||0)*(f.priv||0); if(p>0 && f.r>0){ s+=p*Math.abs(f.r-1); w+=p } }));
  return w? s/w : 0 }
/* andar em que começa o último bloco válido de cada torre desenhada: abaixo dele o bloco ficaria de fora */
function otimPavMinForma(st){ const L=st.lote.pts; let pm=1;
  (st.produto.torres||[]).forEach((_,i)=>{ const R=blcPilha(st, i, L, 999); if(R && R.pil.length) pm=Math.max(pm, R.pil[R.pil.length-1].de) });
  return pm }
/* unidades por andar candidatas para um preset: as que preenchem o bloco de referência de todas as torres desenhadas
   (r entre 1 e 1 + tol), as mais justas primeiro; sempre inclui o nº de unidades atual */
function otimNsForma(st, pk, caps, tol, curN, effs){
  const efic=st.produto.efic, cand=[];   // effs[k]: eficiência real da planta da torre k (blcPrivReal); sem ela, a informada
  for(let N=1; N<=16; N++){ const mix=presetMix(st, pk, N); if(!mix.length) continue;
    const mp=mix.reduce((s,u)=>s+u.area*u.qtd,0); if(!(mp>0)) continue;
    // com a eficiência real (que muda um pouco com o mix e o núcleo) a janela é mais larga: a estimativa de cada combinação filtra
    const rs=caps.map((c,k)=>c*((effs && effs[k]>0) ? effs[k] : efic)/mp); if(Math.min(...rs)<(effs? 0.97 : 0.996)) continue;     // tem de caber em todas as torres
    const dv=rs.reduce((s,r)=>s+Math.abs(r-1),0)/rs.length; if(dv<=tol*1.5+(effs? 0.05 : 0)) cand.push({N, dv}) }
  cand.sort((a,b)=>a.dv-b.dv || a.N-b.N);
  return [...new Set([...cand.slice(0,4).map(c=>c.N), curN])] }

/* ---------- critérios extras (item 1.3) ----------
   Sol médio das unidades: usa unidadesSolMedio(st, m) quando existir (módulo de unidades).
   Sem ela, um PROXY documentado: horas de sol direto no solstício de inverno do hemisfério do lote (6h–18h, a cada 30 min),
   nas fachadas das torres (média ponderada pelo comprimento de cada fachada, a 15%, 50% e 85% da altura dos pavimentos tipo),
   com sombra das outras torres e do entorno. Não considera a posição de cada unidade nem o interior. */
function otimSolVetores(st){
  const lat=(+st.lote.lat||0)*Math.PI/180, n= st.lote.lat<0? 172 : 355; // 21/jun ou 21/dez
  const dec=23.44*Math.PI/180*Math.sin(2*Math.PI*(284+n)/365), th=(+st.lote.norte||0)*Math.PI/180;
  const north=[Math.sin(th),Math.cos(th)], east=[Math.cos(th),-Math.sin(th)], out=[];
  for(let h=6; h<=18+1e-9; h+=0.5){ const H=(h-12)*15*Math.PI/180;
    const alt=Math.asin(Math.sin(lat)*Math.sin(dec)+Math.cos(lat)*Math.cos(dec)*Math.cos(H)); if(alt<0.05) continue;
    const az=Math.atan2(Math.sin(H), Math.cos(H)*Math.sin(lat)-Math.tan(dec)*Math.cos(lat))+Math.PI;
    const e=Math.sin(az)*Math.cos(alt), nn=Math.cos(az)*Math.cos(alt);
    out.push({x:east[0]*e+north[0]*nn, y:east[1]*e+north[1]*nn, z:Math.sin(alt), t:Math.tan(alt)}) }
  return out;
}
const otimBox=p=>{ const xs=p.map(q=>q[0]), ys=p.map(q=>q[1]); return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)] };
/* prismas do entorno (polígono com ponte, altura e caixa) — o otimizador calcula uma vez por rodada e passa a cada otimSolProxy */
function otimEntorno(st){ return (st.entorno||[]).filter(e=>e.pts&&e.pts.length>2).map(e=>{ const poly=entPoly(e); return {poly, z1:+e.h||0, own:-1, bb:otimBox(poly)} }) }
function otimSolProxy(st, m, ent){
  const suns=otimSolVetores(st), P=st.produto, T=(m.T||[]).filter(t=>t.plate&&t.plate.length>2);
  if(!T.length || !suns.length) return 0;
  // por faixa de andares (torre escalonada 2.4 / pilha de blocos C2): um prisma e uma lista de fachadas por faixa, cada uma com a sua planta e
  // a sua altura (prisma do chão até o topo da faixa — exato quando a faixa de cima fica dentro da de baixo). Torre de uma faixa só = como antes.
  // A sombra entre faixas da MESMA torre não conta (a faixa de cima só sombreia a de baixo se avançar sobre ela)
  const fxOf=t=>{ const fx=(t.faixas||[]).filter(f=>f.plate && f.plate.length>2); return fx.length>1? fx : null };
  const segs=[], prs=[];
  T.forEach(t=>{ const fx=fxOf(t);
    if(!fx){ segs.push({t, pl:t.plate, z0:m.hEmb, h:Math.max(P.pe, t.pav*P.pe), w:1}); prs.push({poly:t.plate, z1:t.H, own:t.i, bb:otimBox(t.plate)}); return }
    fx.forEach((f,k)=>{ segs.push({t, pl:f.plate, z0:m.hEmb+(f.de-1)*P.pe, h:Math.max(P.pe, f.n*P.pe), w:f.n/Math.max(1,t.pav)});
      prs.push({poly:f.plate, z1:k===fx.length-1? t.H : f.z1, own:t.i, bb:otimBox(f.plate)}) }) });
  prs.push(...(ent || otimEntorno(st)));
  // por raio de sol, só os prismas que podem sombrear algum ponto de partida: dentro do corredor da sombra (perpendicular ≤ raios somados,
  // ao longo de [−raios, alcance]). Conservador: descarta apenas quem nunca é atingido, então o resultado é o mesmo, bem mais rápido
  const vs=segs.flatMap(g=>g.pl), cx=vs.reduce((a,q)=>a+q[0],0)/vs.length, cy=vs.reduce((a,q)=>a+q[1],0)/vs.length, rT=1+Math.max(...vs.map(q=>Math.hypot(q[0]-cx,q[1]-cy)));
  const info=prs.map(q=>({q, bx:(q.bb[0]+q.bb[2])/2-cx, by:(q.bb[1]+q.bb[3])/2-cy, r:Math.hypot(q.bb[2]-q.bb[0], q.bb[3]-q.bb[1])/2+rT}));
  const hzs=suns.map(s=>Math.hypot(s.x,s.y)||1);
  const cor=suns.map((s,si)=>{ const ux=s.x/hzs[si], uy=s.y/hzs[si]; return info.filter(o=>{ const al=o.bx*ux+o.by*uy, pe=Math.abs(o.bx*uy-o.by*ux); return pe<=o.r && al>=-o.r && al<=o.q.z1/s.t+o.r }).map(o=>o.q) });
  let sum=0, wsum=0;
  segs.forEach(({t, pl, z0, h, w})=>{ const ccw=G.sArea(pl)>0;
    for(let i=0;i<pl.length;i++){ const a=pl[i], b=pl[(i+1)%pl.length], dx=b[0]-a[0], dy=b[1]-a[1], L=Math.hypot(dx,dy); if(L<1) continue;
      const n= ccw? [dy/L,-dx/L] : [-dy/L,dx/L], mid=[(a[0]+b[0])/2+n[0]*0.2, (a[1]+b[1])/2+n[1]*0.2];
      for(const fz of [0.15,0.5,0.85]){ const z=z0+fz*h; let lit=0;
        for(let si=0; si<suns.length; si++){ const s=suns[si]; if(n[0]*s.x+n[1]*s.y<0.05) continue; let sh=false;
          for(const q of cor[si]){ if(q.own===t.i || q.z1<=z) continue; const d=(q.z1-z)/s.t, hz=hzs[si], e=[mid[0]+s.x/hz*d, mid[1]+s.y/hz*d];
            if(Math.max(mid[0],e[0])<q.bb[0]||Math.min(mid[0],e[0])>q.bb[2]||Math.max(mid[1],e[1])<q.bb[1]||Math.min(mid[1],e[1])>q.bb[3]) continue;
            if(G.segPolyHit(mid,e,q.poly)){ sh=true; break } }
          if(!sh) lit++ }
        sum+=lit*0.5*L*w; wsum+=L*w } } });
  return wsum? sum/wsum : 0;
}
function otimSol(st, m, real){
  if(real && typeof unidadesSolMedio==="function"){ try{ const v=unidadesSolMedio(st,m); const h= typeof v==="number"? v : v && +(v.media ?? v.sol ?? v.h); if(isFinite(h)) return {h, fonte:"unidades"} }catch(e){} }
  return {h:otimSolProxy(st,m), fonte:"proxy"};
}
/* índice de conforto ao vento (opcional e lento): vento 2D do clima.js na altura do pedestre, 1 − fração do lote com vento forte (> 1,3× o de referência).
   Roda poucas iterações (aproximado) e devolve o estado do vento da tela como estava. */
function otimVento(st, m, passos=200){
  if(typeof windSetup!=="function" || typeof WIND==="undefined") return null;
  const keep={...WIND};
  try{ WIND.sig=null; windSetup(st,m); windStep(passos); const s=windStats(st); return s&&s.n? 1-s.hi : null }
  catch(e){ return null }
  finally{ for(const k in WIND) delete WIND[k]; Object.assign(WIND, keep) }
}
/* malha estrutural (opcional): usa estruturaMalhas(st, m) do módulo de estrutura, quando existir */
function otimMalha(st, m){
  if(typeof estruturaMalhas!=="function") return null;
  try{ const r=estruturaMalhas(st,m), x=Array.isArray(r)? r[0] : r && (r.melhor||r.best||r); if(!x || typeof x!=="object") return null;
    return {nome:String(x.nome||x.id||x.label||"malha"), custo:isFinite(+x.custo)? +x.custo : null, vao:isFinite(+x.vao)? +x.vao : null} }catch(e){ return null }
}
const otimKey=r=>[r.nT,r.pk,r.N,r.pav,r.sub,r.gac].join("|");

let OTIM=null;
/* otimizar(opts, onProg?, onDone?, ctx?) → Promise do resultado (também entregue a onDone).
   Puro (sem DOM): roda no Web Worker. ctx = {st, m} (padrão: S e o último modelo da tela; sem eles, calcula).
   opts: {obj, torres, tipologias, unidades} + multicritério {mc=true, paretoMax=8, tempoMax=9000 ms, tempoTotal=15000 ms, vento=false, malha=false, efic=false, vc=false}
   (efic/vc acrescentam eficiência global e V/C aos critérios da fronteira de Pareto).
   Desempenho: maxPavFast com teto vindo das combinações menores; combinações dominadas (mais subsolos com o mesmo nº de pavimentos e
   garagem elevada, vagas já cumpridas) não são recalculadas; o sol (que não depende dos subsolos) é guardado por assinatura.
   Resultado serializável: {res (as melhores pelo objetivo, conferidas — igual ao otimizador antigo), pts (estimativas de todas as combinações),
   pareto:{pts (conferidas com a garagem real), criterios}, solFonte, …}. */
function otimizar(opts, onProg, onDone, ctx={}){
  opts = {obj:"lucro", ...(opts||{})};
  const prog = typeof onProg==="function"? onProg : ()=>{};
  const base=clone(ctx.st||S);
  const mNow = ctx.m || (typeof window!=="undefined" && window._last && window._last.m) || compute(base);
  const k = mNow.vagasLay && mNow.vagasEst? Math.min(1, (mNow.vagasLay-(mNow.vf?mNow.vf.count:0))/Math.max(1,mNow.vagasEst-(mNow.vf?mNow.vf.count:0))) : 0.75;
  const mc = opts.mc!==false;
  // forma desenhada (Fase C): o nº de torres e os blocos são do usuário e não variam; as unidades por andar preenchem o bloco
  const forma = otimFormaAtiva(base), rTol = Math.max(0.01, +(base.otim && base.otim.rTol) || 0.10), pavMinF = forma? otimPavMinForma(base) : 1;
  const nTs = forma || !opts.torres? [base.produto.torres.length] : [1,2,3];
  const presets = opts.tipologias? Object.keys(MIX_PRESETS) : ["atual"];
  const curN = base.produto.mix.reduce((s,u)=>s+u.qtd,0);
  // eficiência real da planta (torre desenhada / contorno ocupado): as estimativas usam a privativa das unidades desenhadas
  // (blcPrivEstimada: um pavimento tipo por mix e faixa de elevadores, guardado em memoEf); as quantidades candidatas partem
  // da eficiência real da forma atual
  const memoEf = typeof blcPrivEstimada==="function" ? new Map() : null;
  const mEf = forma && !(mNow.T||[]).some(t=>t && t.eficReal!=null) ? compute(base) : mNow, efAt = forma ? blcEficMapa(mEf) : [];
  const TF = forma? massing(base).T.filter(t=>t.desenhada && t.A>1) : [], capsF=TF.map(t=>t.A), effF0=TF.map(t=>(efAt[t.i]||{}).ref), effF=effF0.some(e=>e>0)? effF0 : undefined;
  const NsDe = pk => forma? (opts.unidades? otimNsForma(base, pk, capsF, rTol, curN, effF) : [curN]) : opts.unidades? [2,3,4,5,6,8] : [curN];
  const gars=[]; for(let a=0;a<=4;a++) for(let b=0;b<=3;b++) gars.push([a,b]); gars.sort((x,y)=>(x[0]*1.6+x[1])-(y[0]*1.6+y[1]));
  const jobs=[]; nTs.forEach(nT=>presets.forEach(pk=>NsDe(pk).forEach(N=>jobs.push({nT,pk,N}))));
  const res=[], pts=[]; let i=0; const t0=performance.now(); const solMemo=new Map(), entPrs=mc? otimEntorno(base) : null;
  const score0=OBJ[opts.obj][1];
  // forma desenhada: a nota cai com o desvio do tamanho das unidades frente ao mix (a combinação ideal preenche o bloco com r = 1)
  const score = forma? (f, m)=>{ const s=score0(f); return s - OTIM_PEN*otimDesvio(m)*Math.abs(s) } : score0;
  const curPav = +(base.produto.torres[0]||{}).pav || 0, formaInfo = forma? {on:true, torres:nTs[0], desenhadas:capsF.length, rTol, pavMin:pavMinF} : null;
  let resolve; const done=new Promise(r=>resolve=r);
  const finish=o=>{ OTIM=o; if(typeof onDone==="function") onDone(o); resolve(o) };
  const step=()=>{
    const ts=performance.now();
    while(i<jobs.length && performance.now()-ts<40){
      const {nT,pk,N}=jobs[i++]; const st=clone(base); st.produto.mix=presetMix(base,pk,N); if(!st.produto.mix.length) continue;
      let best=null, tested=0; const cumpre=new Map();   // cumpre: "gac|pav" → menor nº de subsolos (≥1) que já atende às vagas
      for(const [sub,gac] of gars){
        st.produto.subsolos=sub; st.produto.garAcima=gac; st.produto.torres=Array.from({length:nT},()=>({pav:4}));
        // teto exato pelo gabarito: acima dele o massing() nem precisa rodar
        const hEmbG=st.produto.peTerreo+gac*st.produto.peGar, pmax=maxPavFast(st, Math.floor((hLimDe(st)+1e-6-hEmbG)/st.produto.pe));
        const pMin=Math.max(2, pavMinF); if(pmax<pMin) continue;   // forma desenhada: o último bloco começa no andar pavMinF (abaixo disso ele some)
        // forma desenhada: também o andar mínimo e o meio da faixa — a altura muda o bloco de referência (pilha) e o nº de elevadores
        // (eficiência real da planta), então os pavimentos mais altos podem não comportar o mix
        for(const pav of [...new Set([pmax, pmax-1, pmax-3, Math.ceil(pmax*0.7), ...(forma? [curPav, ...(pavMinF>1? [pMin] : []), Math.round((pMin+pmax)/2)] : [])])].filter(p=>p>=pMin && p<=pmax)){
          const kc=gac+"|"+pav, sMin=cumpre.get(kc);
          if(sMin!=null && sub>sMin){ tested++; continue }   // dominada por sMin subsolos: mesmo preço, mais custo (conta como testada, como antes)
          st.produto.torres=Array.from({length:nT},()=>({pav}));
          const m=massing(st); if(memoEf) blcPrivEstimada(st, m, memoEf);
          if(!m.T.every(t=>t.fit)) continue;
          if(forma){   // a forma não encolhe nem sobe sozinha: gabarito, CA, blocos ignorados e tamanho das unidades conferidos aqui
            if(m.H>(m.hLim ?? st.regras.hMax)+1e-6 || m.CA>st.regras.caMax+1e-6 || m.T.some(t=>t.blcIgn && t.blcIgn.length)) continue;
            if(otimDesvio(m)>rTol && !(pk==="atual" && N===curN)) continue }
          const okVg = m.vagasEst*k >= m.vagasReq;
          if(!okVg && !mc) continue;
          if(m.minApto<st.regras.aptoMin) continue;
          const f=finance(st,m), sc=score(f,m), num=otimNum(f,m,forma);
          // multicritério: guarda todas as combinações dentro das regras (inclusive as que não atingem as vagas — é um dos critérios)
          if(mc){ const sk=nT+"|"+pk+"|"+N+"|"+pav+"|"+gac; let sol=solMemo.get(sk); if(sol===undefined){ sol=otimSolProxy(st,m,entPrs); solMemo.set(sk,sol) }
            pts.push({key:otimKey({nT,pk,N,pav,sub,gac}), nT, pk, N, pav, sub, gac, mix:clone(st.produto.mix), units:m.units, vagas:Math.floor(m.vagasEst*k), req:m.vagasReq,
              ...num, sol, est:true}) }
          if(!okVg) continue;
          tested++; if(sub>=1 && (cumpre.get(kc)==null || sub<cumpre.get(kc))) cumpre.set(kc, sub);
          if(!best || sc>best.sc) best={sc, nT, pk, N, pav, sub, gac, mix:clone(st.produto.mix), units:m.units, priv:m.priv, vagas:Math.floor(m.vagasEst*k), req:m.vagasReq, CA:m.CA, H:m.H, ...num};
        }
        if(tested>=8) break;
      }
      if(best) res.push(best);
    }
    prog(0.6*i/jobs.length);
    if(i<jobs.length) setTimeout(step,0);
    else { res.sort((a,b)=>b.sc-a.sc); prog(0.6); validar(res.slice(0,14), out=>{
      const o={res:out, obj:opts.obj, k, ms:performance.now()-t0, testadas:res.length, ...(formaInfo? {forma:formaInfo} : {})};
      if(!mc) return finish(o);
      multi(out, o) }) }
  };
  const stOf=r=>{ const st=clone(base); st.produto.mix=clone(r.mix); st.produto.subsolos=r.sub; st.produto.garAcima=r.gac; st.produto.torres=Array.from({length:r.nT},()=>({pav:r.pav})); return st };   // st.blocos fica como está: a forma é do usuário
  const extras=(st,m,r)=>{ const s=otimSol(st,m,true); r.sol=s.h; r.solFonte=s.fonte;
    if(opts.vento){ const v=otimVento(st,m); if(v!=null) r.vento=v }
    if(opts.malha){ const x=otimMalha(st,m); if(x){ r.malha=x; if(x.custo!=null) r.malhaCusto=x.custo } } return r };
  // confirma as melhores com o layout real da garagem (acrescenta subsolo/garagem se faltar vaga)
  const validar=(list, done)=>{ let j=0; const out=[], R=base.regras;
    const stepV=()=>{ const ts=performance.now();
      while(j<list.length && out.length<5 && performance.now()-ts<60){ const r=list[j++]; const st=stOf(r);
        let m=compute(st,{quick:true}), t=0;
        while(m.vagas<m.vagasReq && t<4){ if(st.produto.subsolos<=st.produto.garAcima+1 && st.produto.subsolos<5) st.produto.subsolos++; else st.produto.garAcima++; m=compute(st,{quick:true}); t++ }
        if(m.vagas<m.vagasReq || !m.T.every(x=>x.fit) || m.H>(m.hLim ?? R.hMax)+1e-6 || m.CA>R.caMax+1e-6) continue;
        const f=finance(st,m), v={...r, sc:score(f,m), sub:st.produto.subsolos, gac:st.produto.garAcima, units:m.units, priv:m.priv, vagas:m.vagas, req:m.vagasReq, CA:m.CA, H:m.H, ...otimNum(f,m,forma)};
        v.key=otimKey(v); v.est=false; if(mc) extras(st,m,v); out.push(v) }
      prog(0.6+0.2*j/Math.max(1,list.length));
      if(j<list.length && out.length<5) setTimeout(stepV,0); else done(out.sort((a,b)=>b.sc-a.sc)) };
    stepV() };
  // multicritério: confere com a garagem real alguns pontos da fronteira estimada e calcula a fronteira final
  const multi=(out, o)=>{
    const R=base.regras, crit0=[PARETO_CRIT.lucro, PARETO_CRIT.sol, PARETO_CRIT.vagas, ...(forma? [PARETO_CRIT.dev] : []), ...(opts.efic? [PARETO_CRIT.efic] : []), ...(opts.vc? [PARETO_CRIT.vc] : [])], have=new Set(out.map(r=>r.key));
    // metade da fronteira geral, metade da fronteira das que atingem as vagas (para o filtro "vagas ≥ exigidas" ter opções)
    const nMax=Math.max(0, opts.paretoMax ?? 8), fr0=(l)=>paretoFronteira(l, crit0).map(q=>l[q]).filter(p=>!have.has(p.key));
    const okV=pts.filter(p=>p.vagas>=p.req), a=paretoEspalha(fr0(okV), Math.ceil(nMax/2), "lucro"), aK=new Set(a.map(p=>p.key));
    const cand=paretoPrioridade([...a, ...paretoEspalha(fr0(pts).filter(p=>!aK.has(p.key)), nMax-a.length, "lucro")], "lucro"), val=[], t1=performance.now(); let j=0;   // extremos primeiro: se o tempo acabar, a fronteira perde o meio, não as pontas
    // tempo da conferência com a garagem real: o que sobra de tempoTotal (15 s), entre 2 s e tempoMax (9 s); os extremos da fronteira vêm primeiro
    const tBud=Math.min(opts.tempoMax ?? 9000, Math.max(2000, (opts.tempoTotal ?? 15000)-(t1-t0)));
    const stepM=()=>{ const ts=performance.now();
      while(j<cand.length && performance.now()-ts<60 && performance.now()-t1<tBud){ const p=cand[j++], st=stOf(p), m=compute(st,{quick:true});
        if(!m.T.every(x=>x.fit) || m.H>(m.hLim ?? R.hMax)+1e-6 || m.CA>R.caMax+1e-6) continue;
        const f=finance(st,m), v={...p, sc:score(f,m), units:m.units, priv:m.priv, vagas:m.vagas, req:m.vagasReq, CA:m.CA, H:m.H, ...otimNum(f,m,forma), est:false};
        val.push(extras(st,m,v)) }
      prog(0.8+0.2*j/Math.max(1,cand.length));
      if(j<cand.length && performance.now()-t1<tBud) return setTimeout(stepM,0);
      const seen=new Set(), P=[...out, ...val].filter(r=>!seen.has(r.key) && seen.add(r.key));
      const crit=[...crit0]; if(opts.vento && P.length && P.every(r=>r.vento!=null)) crit.push(PARETO_CRIT.vento);
      if(opts.malha && P.length && P.every(r=>r.malhaCusto!=null)) crit.push(PARETO_CRIT.malha);
      const fr=new Set(paretoFronteira(P, crit)); P.forEach((r,q)=>r.fronteira=fr.has(q));
      const solFonte=P.some(r=>r.solFonte==="unidades")? "unidades" : "proxy";
      finish({...o, ms:performance.now()-t0, pts, pareto:{pts:P, criterios:crit.map(c=>Object.keys(PARETO_CRIT).find(x=>PARETO_CRIT[x]===c))}, solFonte,
        malhaOn: !!opts.malha && typeof estruturaMalhas==="function", ventoOn: !!opts.vento}) };
    stepM() };
  step();
  return done;
}
/* aplica uma opção: pavimentos, mix, subsolos e garagens. Forma desenhada (r.forma): o nº de torres e S.blocos ficam como estão
   (só o total de andares muda — o último bloco estica) e os demais campos de cada torre são preservados */
function aplicarOtim(r, st=S){ const old=st.produto.torres||[];
  st.produto.torres=Array.from({length:r.nT},(_,i)=> r.forma? {...(old[i]||{}), pav:r.pav} : {pav:r.pav}); st.produto.mix=clone(r.mix); st.produto.subsolos=r.sub; st.produto.garAcima=r.gac }
/* opções do otimizador com vários critérios (vão junto com S.otim para o Worker); filtros fVagas/fSol/solMin são só da tela */
extendDEF("otim", { ...DEF.otim, rTol:0.10, mc:true, vento:false, malha:false, efic:false, vc:false, paretoMax:8, fVagas:false, fSol:false, solMin:3 });
