/* ================= fronteira de Pareto (otimizador com vários critérios — item 1.3) =================
   Cálculo puro. Um critério é {k, sentido, tol?, f?}:
   - k: chave no ponto (ou f(p) para um valor derivado);
   - sentido: 1 = maior é melhor (lucro, sol), -1 = menor é melhor (custo);
   - tol: diferença que conta como empate (evita que 1 real de lucro tire um ponto da fronteira).
   Valor ausente/NaN conta como o pior possível nesse critério. */
const PARETO_CRIT = {
  lucro:  { k:"lucro",  sentido:1, nome:"Lucro" },
  margem: { k:"margem", sentido:1, nome:"Margem s/ VGV" },
  tir:    { k:"tir",    sentido:1, nome:"TIR" },
  sol:    { k:"sol",    sentido:1, nome:"Sol médio", tol:0.05 },
  vagas:  { k:"vagasAt", sentido:1, nome:"Vagas / exigidas", f:p=>Math.min(1, (+p.vagas||0)/Math.max(1,+p.req||0)) },
  efic:   { k:"efic",   sentido:1, nome:"Eficiência global", tol:0.002 },   // privativa ÷ área total construída (Fase D)
  vc:     { k:"vc",     sentido:1, nome:"V/C", tol:0.02 },                 // preço por m² privativo ÷ custo de referência (Fase D)
  vento:  { k:"vento",  sentido:1, nome:"Conforto ao vento" },
  malha:  { k:"malhaCusto", sentido:-1, nome:"Custo da malha" },
};
function paretoVal(p, c){ const v = c.f ? c.f(p) : p[c.k]; const s=c.sentido??1; return (v==null || !isFinite(+v)) ? -Infinity : s*(+v) }
/** a domina b: não é pior em nenhum critério e é melhor em pelo menos um */
function paretoDomina(a, b, crit){
  let melhor=false;
  for(const c of crit){ const va=paretoVal(a,c), vb=paretoVal(b,c), t=c.tol||0;
    if(va < vb - t) return false;
    if(va > vb + t) melhor=true }
  return melhor;
}
/** índices dos pontos não dominados (a fronteira), na ordem original */
function paretoFronteira(pts, crit){
  const out=[];
  for(let i=0;i<pts.length;i++){ let dom=false; for(let j=0;j<pts.length && !dom;j++) if(j!==i && paretoDomina(pts[j],pts[i],crit)) dom=true; if(!dom) out.push(i) }
  return out;
}
/** camada de cada ponto (0 = fronteira, 1 = fronteira depois de tirar a 0, …) */
function paretoCamadas(pts, crit){
  const rank=new Array(pts.length).fill(-1); let rest=pts.map((_,i)=>i), r=0;
  while(rest.length){ const sub=rest.map(i=>pts[i]), f=paretoFronteira(sub,crit).map(k=>rest[k]); f.forEach(i=>rank[i]=r); const fs=new Set(f); rest=rest.filter(i=>!fs.has(i)); r++ }
  return rank;
}
/** filtros mínimos da tela: {vagas:true → vagas ≥ exigidas, solMin:h → sol médio ≥ h} */
function paretoFiltra(p, fl={}){
  if(fl.vagas && (+p.vagas||0) < (+p.req||0)) return false;
  if(fl.solMin!=null && fl.solMin>0 && !((+p.sol||0) >= fl.solMin - 1e-9)) return false;
  return true;
}
/** escolhe até n pontos espalhados ao longo de uma chave (inclui os extremos) */
function paretoEspalha(list, n, key="lucro"){
  if(list.length<=n) return list.slice();
  const s=list.slice().sort((a,b)=>(+a[key]||0)-(+b[key]||0)), out=[];
  for(let i=0;i<n;i++){ const p=s[Math.round(i*(s.length-1)/Math.max(1,n-1))]; if(!out.includes(p)) out.push(p) }
  return out;
}
/** reordena uma lista (já espalhada e ordenada pela chave) para que os extremos venham primeiro e depois os pontos médios (bisseção):
    se o tempo acabar no meio da conferência, a fronteira perde o interior e não as pontas */
function paretoPrioridade(list, key="lucro"){
  const s=list.slice().sort((a,b)=>(+a[key]||0)-(+b[key]||0)), n=s.length, out=[], seen=new Set();
  const add=i=>{ if(i>=0 && i<n && !seen.has(i)){ seen.add(i); out.push(s[i]) } };
  add(0); add(n-1);
  // em largura (não em profundidade): primeiro os pontos do meio de cada metade
  const fila=[[0,n-1]]; while(fila.length){ const [lo,hi]=fila.shift(); if(hi-lo<2) continue; const mid=(lo+hi)>>1; add(mid); fila.push([lo,mid],[mid,hi]) }
  return out;
}
