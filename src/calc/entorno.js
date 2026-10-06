/* ================= edição das edificações do entorno (cálculo puro) =================
   Cada edificação: {pts:[[x,y]…], h, nome, id?, osm?, est?, vazios?:[[[x,y]…]…]}   (vazios = pátios/poços internos)
   entId(e)               → id estável (criado na primeira vez), usado pela seleção
   entVazios(e)           → só os vazios válidos (todos os vértices e o centro dentro da edificação)
   entPoly(e)             → polígono "com fechadura" (borda + ponte + vazio): serve ao sol, ao vento e às sombras, que só sabem de polígonos simples
   entArea(e)             → área líquida (descontados os vazios) · entCentro(e) · entBBox(e)
   entMove/entEscala/entGira → transformam a edificação inteira (borda e vazios)
   entPatio(e,frac)       → cria um vazio retangular central (pátio) · entPontoInterno(e) → ponto mais afastado das bordas
   entNovo(c,w,d,h)       → caixa retangular · entDuplica(e,dx,dy) · entHit(e,w) → o ponto cai na parte construída? */
let _entSeq = 0;
function entId(e){ if(!e.id) e.id = "e" + Date.now().toString(36).slice(-4) + (++_entSeq).toString(36) + Math.random().toString(36).slice(2,5); return e.id }
function entAneis(e){ return [e.pts, ...(e.vazios||[])] }
function entCentro(e){ return G.centroid(e.pts) }
function entBBox(e){ const xs=e.pts.map(q=>q[0]), ys=e.pts.map(q=>q[1]); return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)] }
function entVazioOk(e, v){
  if(!e || !e.pts || e.pts.length<3 || !v || v.length<3) return false;
  const c=G.centroid(v);
  return v.every(q=>G.pip(q, e.pts)) && G.pip(c, e.pts);
}
function entVazios(e){ return (e.vazios||[]).filter(v=>entVazioOk(e,v)) }
function entArea(e){ return Math.abs(G.sArea(e.pts)) - entVazios(e).reduce((s,v)=>s+Math.abs(G.sArea(v)),0) }
function entHit(e, w){ return !!(e.pts && e.pts.length>2 && G.pip(w, e.pts) && !entVazios(e).some(v=>G.pip(w, v))) }
function entOri(p, ccw){ return (G.sArea(p)>0)===ccw ? p.slice() : p.slice().reverse() }
function entPoly(e){
  const vz = entVazios(e);
  if(!vz.length) return e.pts;
  let ring = entOri(e.pts, true);
  vz.forEach(v=>{
    const h = entOri(v, false); let bi=0, bj=0, bd=Infinity;
    ring.forEach((a,i)=>h.forEach((b,j)=>{ const d=(a[0]-b[0])**2+(a[1]-b[1])**2; if(d<bd){ bd=d; bi=i; bj=j } }));
    const hr = [...h.slice(bj), ...h.slice(0,bj), h[bj]];
    ring = [...ring.slice(0,bi+1), ...hr, ring[bi], ...ring.slice(bi+1)];
  });
  return ring;
}
function entMove(e, dx, dy){ entAneis(e).forEach(r=>r.forEach(q=>{ q[0]+=dx; q[1]+=dy })) }
function entEscala(e, k, c){ c=c||entCentro(e); entAneis(e).forEach(r=>r.forEach(q=>{ q[0]=c[0]+(q[0]-c[0])*k; q[1]=c[1]+(q[1]-c[1])*k })) }
function entGira(e, graus, c){ c=c||entCentro(e); const a=graus*Math.PI/180, co=Math.cos(a), si=Math.sin(a);
  entAneis(e).forEach(r=>r.forEach(q=>{ const x=q[0]-c[0], y=q[1]-c[1]; q[0]=c[0]+x*co-y*si; q[1]=c[1]+x*si+y*co })) }
function entDistBorda(p, poly){ let d=Infinity; for(let i=0;i<poly.length;i++){ const a=poly[i], b=poly[(i+1)%poly.length], vx=b[0]-a[0], vy=b[1]-a[1], L=vx*vx+vy*vy||1e-9;
  const t=Math.max(0,Math.min(1,((p[0]-a[0])*vx+(p[1]-a[1])*vy)/L)); d=Math.min(d, Math.hypot(p[0]-(a[0]+t*vx), p[1]-(a[1]+t*vy))) } return d }
/* ponto dentro da edificação (fora dos vazios) com a maior folga até as bordas */
function entPontoInterno(e){
  const [x0,y0,x1,y1]=entBBox(e); let best=null, bd=-1; const N=14;
  for(let i=0;i<=N;i++) for(let j=0;j<=N;j++){ const p=[x0+(x1-x0)*i/N, y0+(y1-y0)*j/N]; if(!G.pip(p,e.pts)) continue;
    const d=entDistBorda(p,e.pts); if(d>bd){ bd=d; best=p } }
  return best ? {p:best, r:bd} : null;
}
function entAngLongo(p){ let L=0, a=0; p.forEach((q,i)=>{ const b=p[(i+1)%p.length], l=Math.hypot(b[0]-q[0],b[1]-q[1]); if(l>L){ L=l; a=Math.atan2(b[1]-q[1], b[0]-q[0]) } }); return a }
/* pátio retangular alinhado ao lado mais longo; frac = fração da área construída tomada pelo vazio (padrão 25%) */
function entPatio(e, frac=0.25){
  const a=entAngLongo(e.pts);
  const R=(q,ang)=>{ const c=Math.cos(ang), s=Math.sin(ang); return [q[0]*c-q[1]*s, q[0]*s+q[1]*c] };
  const loc=e.pts.map(q=>R(q,-a)); const xs=loc.map(q=>q[0]), ys=loc.map(q=>q[1]);
  const x0=Math.min(...xs), x1=Math.max(...xs), y0=Math.min(...ys), y1=Math.max(...ys), w=x1-x0, d=y1-y0, A=Math.abs(G.sArea(e.pts));
  // retângulo central cuja área é frac da área do prédio, mantendo a proporção do prédio
  const k=Math.sqrt(Math.max(0.02,Math.min(0.6,frac))*A/Math.max(1e-6,w*d)); let hw=w*k/2, hd=d*k/2;
  for(let t=0;t<8;t++){
    const v=[[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(([px,py])=>R([ (x0+x1)/2+px, (y0+y1)/2+py ], a));
    if(entVazioOk(e, v)) return v;
    hw*=0.8; hd*=0.8;
  }
  // formato irregular (L, U): usa o ponto mais folgado e um quadrado dentro da folga
  const ip=entPontoInterno(e); if(!ip) return null; const s=ip.r*0.85/Math.SQRT2;
  const v=[[-s,-s],[s,-s],[s,s],[-s,s]].map(([px,py])=>[ip.p[0]+px, ip.p[1]+py]);
  return entVazioOk(e,v) ? v : null;
}
function entNovo(c, w=20, d=20, h=24, nome){ const x=c[0], y=c[1];
  return { pts:[[x-w/2,y-d/2],[x+w/2,y-d/2],[x+w/2,y+d/2],[x-w/2,y+d/2]], h, nome: nome||"Edificação" } }
function entDuplica(e, dx=6, dy=-6){ const c=JSON.parse(JSON.stringify(e)); delete c.id; delete c.osm; c.nome=(e.nome||"Edificação")+" (cópia)"; entMove(c,dx,dy); return c }
/* retângulo de seleção: edificações cujo centro está dentro de [x0,y0,x1,y1] */
function entNoRetangulo(lista, r){ const [a,b,c,d]=[Math.min(r[0],r[2]),Math.min(r[1],r[3]),Math.max(r[0],r[2]),Math.max(r[1],r[3])];
  return lista.filter(e=>{ if(!e.pts||e.pts.length<3) return false; const p=entCentro(e); return p[0]>=a&&p[0]<=c&&p[1]>=b&&p[1]<=d }) }
/* o ponto cai no vazio de qual edificação? (para criar o vazio na edificação certa) */
function entQualContem(lista, p){ let best=null, ba=Infinity; lista.forEach(e=>{ if(e.pts&&e.pts.length>2&&G.pip(p,e.pts)){ const a=Math.abs(G.sArea(e.pts)); if(a<ba){ ba=a; best=e } } }); return best }
