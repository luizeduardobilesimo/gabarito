/* ================= topografia: superfície, corte e aterro, contenção (item 2.3) =================
   Funções puras (Node, Worker e página). Coordenadas locais em metros (x leste, y norte), cotas absolutas em metros.
   topoDelaunay(P)                    → triângulos [[i,j,k]…] (Bowyer–Watson com varredura em x)
   topoSuperficie(pts3, regiao)       → superfície TIN {P,T,…}; pontos de moldura extrapolados (plano local) cobrem o lote
   topoZ(sf,x,y)                      → cota interpolada (linear no triângulo)
   topoPecas(sf, poly)                → pedaços do polígono por triângulo, cada um com o plano z=a+bx+cy (integração exata)
   topoAcima(pc,h) / topoAbaixo(pc,h) → ∫max(0,z−h)dA e ∫max(0,h−z)dA (m³) — exatos para a superfície triangulada
   topoTerra(sf, lote, sub, c, nSub, pe) → volumes de corte/aterro do platô e escavação por subsolo
   topoCotaOtima(...)                 → cota do térreo que minimiza corte + aterro dentro da tolerância da soleira
   topoContencao(...)                 → área de contenção (perímetro do subsolo × altura) e muros de arrimo do platô
   topoCurvas(sf, passo)              → curvas de nível (segmentos por cota)
   topoImportar(texto, nome, ctx)     → pontos [x,y,z] de CSV (x,y,z ou lat,lon,z), KML com altitude ou DXF
   topoExemplo(lote, fd)              → levantamento de exemplo (terreno inclinado) sobre o lote
   topoCalc(st, m)                    → tudo junto para o modelo (usado no gancho de compute) */
const TOPO_CONT = {
  cortina:   {nome:"Cortina de estacas atirantada", curto:"Cortina", custo:1500},
  prancha:   {nome:"Estaca prancha metálica", curto:"Estaca prancha", custo:1100},
  diafragma: {nome:"Parede diafragma", curto:"Diafragma", custo:2300},
  grampeado: {nome:"Solo grampeado", curto:"Grampeado", custo:700}
};
extendDEF("topo", {
  on:false, pts:[], fonte:"",
  cotaModo:"otima", cotaTerreo:0, soleiraTol:1.0,
  custoCorte:55, custoAterro:40,
  contTipo:"cortina", contCustos:{cortina:1500, prancha:1100, diafragma:2300, grampeado:700}, arrimoCusto:900, arrimoMin:0.4,
  naOn:false, naProf:4, rebaixCusto:90, impermCusto:160,
  curvas:true, curvasInt:1
});
const topoAtivo = st => !!(st && st.topo && st.topo.on && Array.isArray(st.topo.pts) && st.topo.pts.length>=3);

/* ---------------- geometria auxiliar ---------------- */
function topoSArea(p){ let a=0; for(let i=0;i<p.length;i++){ const q=p[i], r=p[(i+1)%p.length]; a+=q[0]*r[1]-r[0]*q[1] } return a/2 }
function topoAC(p){ // área (com sinal) e centroide
  let a=0, cx=0, cy=0; for(let i=0;i<p.length;i++){ const q=p[i], r=p[(i+1)%p.length], k=q[0]*r[1]-r[0]*q[1]; a+=k; cx+=(q[0]+r[0])*k; cy+=(q[1]+r[1])*k }
  a/=2; return Math.abs(a)<1e-12 ? {a:0, c:[0,0]} : {a, c:[cx/(6*a), cy/(6*a)]};
}
/* recorte de um polígono pelo semiplano f(q) >= 0 (f linear) */
function topoClipF(poly, f){
  const out=[], n=poly.length; if(!n) return out;
  for(let i=0;i<n;i++){ const A=poly[i], B=poly[(i+1)%n], fa=f(A), fb=f(B);
    if(fa>=0) out.push(A);
    if((fa>=0)!==(fb>=0)){ const t=fa/(fa-fb); out.push([A[0]+(B[0]-A[0])*t, A[1]+(B[1]-A[1])*t]) } }
  return out;
}
function topoPip(pt, p){ let c=false; for(let i=0,j=p.length-1;i<p.length;j=i++){ const [xi,yi]=p[i],[xj,yj]=p[j]; if(((yi>pt[1])!==(yj>pt[1])) && (pt[0] < (xj-xi)*(pt[1]-yi)/(yj-yi)+xi)) c=!c } return c }
function topoDistSeg(p, a, b){ const dx=b[0]-a[0], dy=b[1]-a[1], l2=dx*dx+dy*dy; let t= l2? ((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2 : 0; t=Math.max(0,Math.min(1,t)); return Math.hypot(p[0]-a[0]-dx*t, p[1]-a[1]-dy*t) }
function topoDistPoly(p, poly){ let d=Infinity; for(let i=0;i<poly.length;i++) d=Math.min(d, topoDistSeg(p, poly[i], poly[(i+1)%poly.length])); return d }
function topoHash(arr){ let h=2166136261>>>0; const s=JSON.stringify(arr); for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0 } return s.length+":"+h.toString(36) }

/* ---------------- triangulação de Delaunay (Bowyer–Watson) ---------------- */
function topoDelaunay(P){
  const n=P.length; if(n<3) return [];
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  P.forEach(q=>{ if(q[0]<x0)x0=q[0]; if(q[0]>x1)x1=q[0]; if(q[1]<y0)y0=q[1]; if(q[1]>y1)y1=q[1] });
  const d=Math.max(x1-x0, y1-y0, 1e-6), mx=(x0+x1)/2, my=(y0+y1)/2;
  const V=P.map(q=>[q[0],q[1]]); V.push([mx-30*d, my-20*d], [mx, my+30*d], [mx+30*d, my-20*d]);
  const tri=(a,b,c)=>{ // anti-horário + circuncírculo
    let A=V[a], B=V[b], C=V[c]; if((B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0])<0){ const t=b; b=c; c=t; B=V[b]; C=V[c] }
    const ax=A[0], ay=A[1], bx=B[0]-ax, by=B[1]-ay, cx=C[0]-ax, cy=C[1]-ay, D=2*(bx*cy-by*cx);
    if(Math.abs(D)<1e-14) return {a,b,c,x:ax,y:ay,r2:Infinity,r:Infinity};
    const b2=bx*bx+by*by, c2=cx*cx+cy*cy, ux=(cy*b2-by*c2)/D, uy=(bx*c2-cx*b2)/D, r2=ux*ux+uy*uy;
    return {a,b,c,x:ax+ux,y:ay+uy,r2,r:Math.sqrt(r2)};
  };
  const order=[...Array(n).keys()].sort((i,j)=>V[i][0]-V[j][0]||V[i][1]-V[j][1]);
  let act=[tri(n,n+1,n+2)]; const done=[];
  for(const i of order){
    const px=V[i][0], py=V[i][1], keep=[], edges=new Map();
    for(const t of act){
      if(t.x+t.r < px - 1e-9){ done.push(t); continue }
      const dx=px-t.x, dy=py-t.y;
      if(dx*dx+dy*dy < t.r2*(1-1e-12)){ for(const [u,v] of [[t.a,t.b],[t.b,t.c],[t.c,t.a]]){ const k=u<v? u+","+v : v+","+u; if(edges.has(k)) edges.delete(k); else edges.set(k,[u,v]) } }
      else keep.push(t);
    }
    for(const [u,v] of edges.values()) keep.push(tri(u,v,i));
    act=keep;
  }
  return done.concat(act).filter(t=>t.a<n && t.b<n && t.c<n).map(t=>[t.a,t.b,t.c])
    .filter(([a,b,c])=>Math.abs((V[b][0]-V[a][0])*(V[c][1]-V[a][1])-(V[b][1]-V[a][1])*(V[c][0]-V[a][0]))>1e-10);
}

/* ---------------- superfície ---------------- */
/* plano local por mínimos quadrados ponderados (k vizinhos) — exato para dados planos */
function topoPlanoLocal(P, x, y, k=8){
  const near=P.map(q=>[q, (q[0]-x)**2+(q[1]-y)**2]).sort((a,b)=>a[1]-b[1]).slice(0,k);
  let s=[0,0,0,0,0,0,0,0,0], r=[0,0,0], sw=0, sz=0;
  near.forEach(([q,d2])=>{ const w=1/(d2+1), X=q[0]-x, Y=q[1]-y; sw+=w; sz+=w*q[2];
    s[0]+=w; s[1]+=w*X; s[2]+=w*Y; s[4]+=w*X*X; s[5]+=w*X*Y; s[8]+=w*Y*Y; r[0]+=w*q[2]; r[1]+=w*X*q[2]; r[2]+=w*Y*q[2] });
  s[3]=s[1]; s[6]=s[2]; s[7]=s[5];
  const det=m=>m[0]*(m[4]*m[8]-m[5]*m[7])-m[1]*(m[3]*m[8]-m[5]*m[6])+m[2]*(m[3]*m[7]-m[4]*m[6]), D=det(s);
  if(Math.abs(D)<1e-9*Math.max(1,s[0]**3)) return sz/(sw||1);
  const m0=[r[0],s[1],s[2], r[1],s[4],s[5], r[2],s[7],s[8]];
  return det(m0)/D; // z no próprio ponto (x,y): termo constante do plano centrado
}
function topoSuperficie(pts3, regiao, o={}){
  const raw=(pts3||[]).filter(q=>q && isFinite(q[0]) && isFinite(q[1]) && isFinite(q[2]));
  // tira pontos repetidos (1 cm)
  const seen=new Set(), P=[];
  raw.forEach(q=>{ const k=Math.round(q[0]*100)+","+Math.round(q[1]*100); if(!seen.has(k)){ seen.add(k); P.push([+q[0],+q[1],+q[2]]) } });
  if(P.length<3) return null;
  let zmin=Infinity, zmax=-Infinity, dx0=Infinity, dy0=Infinity, dx1=-Infinity, dy1=-Infinity;
  P.forEach(q=>{ zmin=Math.min(zmin,q[2]); zmax=Math.max(zmax,q[2]); dx0=Math.min(dx0,q[0]); dx1=Math.max(dx1,q[0]); dy0=Math.min(dy0,q[1]); dy1=Math.max(dy1,q[1]) });
  // moldura extrapolada: cobre os dados + a região (lote) + margem
  let x0=dx0, x1=dx1, y0=dy0, y1=dy1; (regiao||[]).forEach(q=>{ x0=Math.min(x0,q[0]); x1=Math.max(x1,q[0]); y0=Math.min(y0,q[1]); y1=Math.max(y1,q[1]) });
  const mg=o.margem ?? Math.max(10, 0.15*Math.max(x1-x0, y1-y0)); x0-=mg; y0-=mg; x1+=mg; y1+=mg;
  const dz=Math.max(1, zmax-zmin), N=P.length, frame=[];
  for(let i=0;i<=4;i++) for(let j=0;j<=4;j++){ if(i>0&&i<4&&j>0&&j<4) continue; const x=x0+(x1-x0)*i/4, y=y0+(y1-y0)*j/4;
    frame.push([x, y, Math.max(zmin-dz, Math.min(zmax+dz, topoPlanoLocal(P, x, y)))]) }
  const all=P.concat(frame), T=topoDelaunay(all);
  if(!T.length) return null;
  // índice em grade dos triângulos
  const nc=Math.max(1, Math.min(160, Math.ceil(Math.sqrt(T.length/2)))), cw=(x1-x0)/nc, ch=(y1-y0)/nc, cells=Array.from({length:nc*nc},()=>[]);
  T.forEach((t,ti)=>{ const xs=t.map(i=>all[i][0]), ys=t.map(i=>all[i][1]);
    const i0=Math.max(0,Math.floor((Math.min(...xs)-x0)/cw)), i1=Math.min(nc-1,Math.floor((Math.max(...xs)-x0)/cw)), j0=Math.max(0,Math.floor((Math.min(...ys)-y0)/ch)), j1=Math.min(nc-1,Math.floor((Math.max(...ys)-y0)/ch));
    for(let i=i0;i<=i1;i++) for(let j=j0;j<=j1;j++) cells[j*nc+i].push(ti) });
  // plano de cada triângulo: z = a + b x + c y
  const pl=T.map(([i,j,k])=>{ const A=all[i], B=all[j], C=all[k], ux=B[0]-A[0], uy=B[1]-A[1], uz=B[2]-A[2], vx=C[0]-A[0], vy=C[1]-A[1], vz=C[2]-A[2];
    const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx; if(Math.abs(nz)<1e-12) return [A[2],0,0];
    const b=-nx/nz, c=-ny/nz; return [A[2]-b*A[0]-c*A[1], b, c] });
  return { P:all, N, T, pl, bb:{x0,y0,x1,y1}, dbb:{x0:dx0,y0:dy0,x1:dx1,y1:dy1}, zmin, zmax, nc, cw, ch, cells, id:topoHash([all.length, all[0], all[all.length-1], N, zmin, zmax, T.length]) };
}
function topoTriEm(sf, x, y){
  const i=Math.floor((x-sf.bb.x0)/sf.cw), j=Math.floor((y-sf.bb.y0)/sf.ch); if(i<0||j<0||i>=sf.nc||j>=sf.nc) return -1;
  for(const ti of sf.cells[j*sf.nc+i]){ const [a,b,c]=sf.T[ti], A=sf.P[a], B=sf.P[b], C=sf.P[c];
    const d=(B[1]-C[1])*(A[0]-C[0])+(C[0]-B[0])*(A[1]-C[1]); if(Math.abs(d)<1e-14) continue;
    const l1=((B[1]-C[1])*(x-C[0])+(C[0]-B[0])*(y-C[1]))/d, l2=((C[1]-A[1])*(x-C[0])+(A[0]-C[0])*(y-C[1]))/d, l3=1-l1-l2;
    if(l1>=-1e-9 && l2>=-1e-9 && l3>=-1e-9) return ti }
  return -1;
}
function topoZ(sf, x, y){
  const bx=Math.max(sf.bb.x0+1e-6, Math.min(sf.bb.x1-1e-6, x)), by=Math.max(sf.bb.y0+1e-6, Math.min(sf.bb.y1-1e-6, y));
  const ti=topoTriEm(sf, bx, by);
  if(ti<0){ let best=Infinity, z=sf.zmin; sf.P.forEach(q=>{ const d=(q[0]-bx)**2+(q[1]-by)**2; if(d<best){ best=d; z=q[2] } }); return z }
  const p=sf.pl[ti]; return p[0]+p[1]*bx+p[2]*by;
}

/* ---------------- integração exata sobre a superfície triangulada ---------------- */
const TOPO_PC = new Map();
function topoPecas(sf, poly){
  if(!sf || !poly || poly.length<3) return {pc:[], A:0, Vz:0};
  const key=sf.id+"|"+topoHash(poly); if(TOPO_PC.has(key)) return TOPO_PC.get(key);
  let p=poly.map(q=>[q[0],q[1]]); if(topoSArea(p)<0) p=p.reverse();
  let px0=Infinity,py0=Infinity,px1=-Infinity,py1=-Infinity; p.forEach(q=>{ px0=Math.min(px0,q[0]); px1=Math.max(px1,q[0]); py0=Math.min(py0,q[1]); py1=Math.max(py1,q[1]) });
  const pc=[]; let A=0, Vz=0;
  sf.T.forEach((t,ti)=>{
    const V=t.map(i=>sf.P[i]); if(Math.max(V[0][0],V[1][0],V[2][0])<px0 || Math.min(V[0][0],V[1][0],V[2][0])>px1 || Math.max(V[0][1],V[1][1],V[2][1])<py0 || Math.min(V[0][1],V[1][1],V[2][1])>py1) return;
    let o = (V[1][0]-V[0][0])*(V[2][1]-V[0][1])-(V[1][1]-V[0][1])*(V[2][0]-V[0][0]) < 0 ? [V[0],V[2],V[1]] : V;
    let q=p; for(let e=0;e<3 && q.length;e++){ const a=o[e], b=o[(e+1)%3]; q=topoClipF(q, r=>(b[0]-a[0])*(r[1]-a[1])-(b[1]-a[1])*(r[0]-a[0])) }
    if(q.length<3) return; const ac=topoAC(q); if(ac.a<=1e-9) return;
    const [a,b,c]=sf.pl[ti]; pc.push({q, a, b, c, A:ac.a}); A+=ac.a; Vz+=ac.a*(a+b*ac.c[0]+c*ac.c[1]);
  });
  const r={pc, A, Vz}; if(TOPO_PC.size>60) TOPO_PC.clear(); TOPO_PC.set(key, r); return r;
}
/* ∫ max(0, z − h) dA */
function topoAcima(pcs, h){ let v=0; for(const s of pcs.pc){ const f=r=>s.a+s.b*r[0]+s.c*r[1]-h, q=topoClipF(s.q, f); if(q.length<3) continue; const ac=topoAC(q); if(ac.a>0) v+=ac.a*f(ac.c) } return v }
/* ∫ max(0, h − z) dA */
const topoAbaixo = (pcs, h) => pcs.A*h - pcs.Vz + topoAcima(pcs, h);

/* volumes de terraplenagem para a cota c do térreo
   - platô: o lote inteiro fica na cota c (corte onde o terreno está acima; aterro onde está abaixo, fora da projeção do subsolo)
   - subsolos: cada pavimento k escava o solo natural entre c−k·pe e c−(k−1)·pe dentro da projeção do subsolo */
function topoTerra(sf, lote, sub, c, nSub, pe){
  const L=topoPecas(sf, lote), Sb= nSub>0 ? topoPecas(sf, sub) : {pc:[],A:0,Vz:0};
  const platCorte=topoAcima(L, c), platAterro=Math.max(0, topoAbaixo(L, c) - (nSub>0? topoAbaixo(Sb, c) : 0));
  const subs=[]; for(let k=1;k<=nSub;k++){ const top=c-(k-1)*pe, bot=c-k*pe; subs.push({k, top, bot, vol: Math.max(0, topoAcima(Sb, bot)-topoAcima(Sb, top))}) }
  const escav=subs.reduce((s,x)=>s+x.vol,0);
  return { c, platCorte, platAterro, subs, escav, corte: platCorte+escav, aterro: platAterro, A:L.A, subA:Sb.A, zMed: L.A? L.Vz/L.A : 0 };
}
/* cota ótima: minimiza corte + aterro (volume total movimentado) com |c − calçada| ≤ tol */
const TOPO_OT = new Map();
function topoCotaOtima(sf, lote, sub, nSub, pe, calc, tol){
  const key=sf.id+"|"+topoHash([lote, nSub? sub : 0, nSub, pe, calc, tol]); if(TOPO_OT.has(key)) return TOPO_OT.get(key);
  const r=topoCotaOtima_(sf, lote, sub, nSub, pe, calc, tol); if(TOPO_OT.size>200) TOPO_OT.clear(); TOPO_OT.set(key, r); return r;
}
function topoCotaOtima_(sf, lote, sub, nSub, pe, calc, tol){
  const lo=calc-Math.max(0,tol), hi=calc+Math.max(0,tol), f=c=>{ const t=topoTerra(sf,lote,sub,c,nSub,pe); return t.corte+t.aterro };
  if(hi-lo<1e-6) return {c:lo, v:f(lo)};
  const n=Math.max(4, Math.min(80, Math.ceil((hi-lo)/0.1))); let best=lo, bv=Infinity;
  for(let i=0;i<=n;i++){ const c=lo+(hi-lo)*i/n, v=f(c); if(v<bv-1e-9){ bv=v; best=c } }
  // refino (seção áurea) em torno do melhor
  let a=Math.max(lo,best-(hi-lo)/n), b=Math.min(hi,best+(hi-lo)/n); const g=(Math.sqrt(5)-1)/2;
  let x1=b-g*(b-a), x2=a+g*(b-a), f1=f(x1), f2=f(x2);
  for(let it=0;it<30 && b-a>1e-4;it++){ if(f1<f2){ b=x2; x2=x1; f2=f1; x1=b-g*(b-a); f1=f(x1) } else { a=x1; x1=x2; f1=f2; x2=a+g*(b-a); f2=f(x2) } }
  const cr=(a+b)/2, vr=f(cr); return vr<bv ? {c:cr, v:vr} : {c:best, v:bv};
}
/* contenção: perímetro do subsolo × (terreno ou platô − fundo da escavação), e arrimo do platô no perímetro do lote
   (|terreno − platô| acima de o.min, fora da faixa do subsolo). Amostragem a cada o.ds metros. */
function topoContencao(sf, lote, sub, c, nSub, pe, o={}){
  const ds=o.ds||0.5, fundo=c-nSub*pe, segs=[]; let area=0, per=0, hMax=0;
  const walk=(poly, fn)=>{ for(let i=0;i<poly.length;i++){ const a=poly[i], b=poly[(i+1)%poly.length], l=Math.hypot(b[0]-a[0],b[1]-a[1]), n=Math.max(1,Math.ceil(l/ds));
    for(let k=0;k<n;k++){ const t=(k+0.5)/n, p=[a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t]; fn(p, l/n, i) } } };
  if(nSub>0 && sub && sub.length>2){
    walk(sub, (p,dl)=>{ const z=topoZ(sf,p[0],p[1]), h=Math.max(0, Math.max(z,c)-fundo); area+=h*dl; per+=dl; hMax=Math.max(hMax,h) });
  }
  let arrimo=0, arrimoL=0; const amin=o.min ?? 0.4;
  if(lote && lote.length>2) walk(lote, (p,dl)=>{ if(nSub>0 && sub && sub.length>2 && topoDistPoly(p, sub)<1.5) return; const h=Math.abs(topoZ(sf,p[0],p[1])-c); if(h>=amin){ arrimo+=h*dl; arrimoL+=dl } });
  return { area, per, hMed: per? area/per : 0, hMax, fundo, arrimo, arrimoL };
}

/* ---------------- curvas de nível ---------------- */
function topoCurvas(sf, passo=1, o={}){
  if(!sf) return [];
  let st=Math.max(0.1, +passo||1); const lim=o.max||120;
  while((sf.zmax-sf.zmin)/st > lim) st*=2;
  const mestra=o.mestra||5, lv=new Map(), N=sf.N;
  sf.T.forEach(t=>{
    if(!o.extrap && (t[0]>=N || t[1]>=N || t[2]>=N)) return; // só onde há dados medidos
    const V=t.map(i=>sf.P[i]), zs=V.map(q=>q[2]), z0=Math.min(...zs), z1=Math.max(...zs);
    for(let k=Math.ceil(z0/st); k*st<=z1; k++){ const h=+(k*st).toFixed(6), pts=[];
      for(let e=0;e<3;e++){ const A=V[e], B=V[(e+1)%3]; if((A[2]<h)!==(B[2]<h)){ const r=(h-A[2])/(B[2]-A[2]); pts.push([A[0]+(B[0]-A[0])*r, A[1]+(B[1]-A[1])*r]) } }
      if(pts.length===2){ if(!lv.has(h)) lv.set(h,[]); lv.get(h).push([pts[0][0],pts[0][1],pts[1][0],pts[1][1]]) } }
  });
  return [...lv.entries()].sort((a,b)=>a[0]-b[0]).map(([z,segs])=>({z, segs, mestra: Math.abs(z/(st*mestra)-Math.round(z/(st*mestra)))<1e-6, passo:st}));
}

/* ---------------- importação de pontos cotados e curvas de nível ---------------- */
function topoDensifica(line, z, out, ds=2){ for(let i=0;i<line.length;i++){ const a=line[i]; out.push([a[0],a[1],a[2]??z]); const b=line[i+1]; if(!b) break;
  const l=Math.hypot(b[0]-a[0],b[1]-a[1]), n=Math.floor(l/ds); for(let k=1;k<n;k++){ const t=k/n; out.push([a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, (a[2]??z)+((b[2]??z)-(a[2]??z))*t]) } } }
function topoLerCSV(txt){
  const rows=[]; let latlon=null, hdr=null;
  txt.split(/\r?\n/).forEach(l=>{ const s=l.trim(); if(!s || s.startsWith("#")) return;
    const sep = s.includes(";") ? ";" : s.includes("\t") ? "\t" : s.includes(",") && (s.match(/,/g)||[]).length>=2 ? "," : /\s+/;
    const cells=s.split(sep).map(c=>c.trim().replace(/^"|"$/g,""));
    const nums=cells.map(c=>{ const v=c.replace(/\s/g,""); return /^-?\d+(?:[.,]\d+)?(?:e-?\d+)?$/i.test(v)? +v.replace(",",".") : NaN });
    if(nums.filter(isFinite).length<3){ if(!rows.length && !hdr) hdr=cells.map(c=>c.toLowerCase()); return }
    rows.push(nums) });
  if(!rows.length) return {pts:[], tipo:"csv"};
  // colunas: pelo cabeçalho (x/y/z, e/n, lat/lon/alt…) ou as 3 últimas numéricas (a 1ª pode ser o nº do ponto)
  let ix=-1, iy=-1, iz=-1;
  if(hdr){ const f=re=>hdr.findIndex(h=>re.test(h));
    const la=f(/^(lat|latitude)/), lo=f(/^(lon|lng|long|longitude)/);
    if(la>=0 && lo>=0){ latlon=true; iy=la; ix=lo } else { ix=f(/^(x|e|este|leste|easting|coord_?x)$/); iy=f(/^(y|n|norte|northing|coord_?y)$/) }
    iz=f(/^(z|cota|alt|altitude|elev|elevacao|elevação|h|nivel|nível)/) }
  if(ix<0||iy<0||iz<0){ const k=rows[0].length; const valid=rows[0].map((v,i)=>i).filter(i=>rows.every(r=>isFinite(r[i])));
    const c3 = valid.length>=4 && valid[0]===0 && rows.every((r,j)=>j===0 || r[0]!==rows[j-1][0]) && Number.isInteger(rows[0][0]) ? valid.slice(1,4) : valid.slice(0,3);
    [ix,iy,iz]=c3; if(c3.length<3) return {pts:[], tipo:"csv"} }
  const pts=rows.map(r=>[r[ix], r[iy], r[iz]]).filter(q=>q.every(isFinite));
  if(latlon==null){ // lat,lon sem cabeçalho: valores pequenos e coerentes com graus
    const g=pts.every(q=>Math.abs(q[0])<=90 && Math.abs(q[1])<=180) && pts.some(q=>!Number.isInteger(q[0])) && (Math.max(...pts.map(q=>q[0]))-Math.min(...pts.map(q=>q[0])))<0.5;
    if(g) return {pts: pts.map(q=>[q[1],q[0],q[2]]), tipo:"latlon"}; // x=lon, y=lat
  }
  return {pts, tipo: latlon? "latlon" : "xy"};
}
function topoLerKML(txt){
  const pts=[], re=/<coordinates>([\s\S]*?)<\/coordinates>/gi; let m;
  while((m=re.exec(txt))){ const line=m[1].trim().split(/\s+/).map(t=>t.split(",").map(Number)).filter(c=>c.length>=3 && c.every(isFinite)).map(([lon,lat,alt])=>[lon,lat,alt]);
    if(line.length===1) pts.push(line[0]); else if(line.length) { line.forEach(q=>pts.push(q)) } }
  // gx:coord (trilhas)
  const re2=/<gx:coord>([^<]+)<\/gx:coord>/gi; while((m=re2.exec(txt))){ const c=m[1].trim().split(/\s+/).map(Number); if(c.length>=3 && c.every(isFinite)) pts.push([c[0],c[1],c[2]]) }
  return {pts, tipo:"latlon"};
}
function topoLerDXF(txt){
  const L=txt.split(/\r?\n/), G_=[]; for(let i=0;i+1<L.length;i+=2) G_.push([+L[i].trim(), L[i+1].trim()]);
  const pts=[], lines=[]; let i=0;
  // entidades: grupos entre códigos 0
  const ents=[]; let cur=null;
  for(const [c,v] of G_){ if(c===0){ cur={type:v, g:[]}; ents.push(cur) } else if(cur) cur.g.push([c,v]) }
  const val=(e,c)=>{ const x=e.g.find(q=>q[0]===c); return x? +x[1] : NaN };
  const all=(e,c)=>e.g.filter(q=>q[0]===c).map(q=>+q[1]);
  for(i=0;i<ents.length;i++){ const e=ents[i];
    if(e.type==="POINT"){ const x=val(e,10), y=val(e,20), z=val(e,30); if([x,y,z].every(isFinite)) pts.push([x,y,z]) }
    else if(e.type==="LWPOLYLINE"){ const xs=all(e,10), ys=all(e,20), z=val(e,38)||0, ln=xs.map((x,k)=>[x,ys[k],z]).filter(q=>q.every(isFinite)); if(ln.length) lines.push(ln) }
    else if(e.type==="POLYLINE"){ const zElev=val(e,30)||0, ln=[]; let k=i+1; for(; k<ents.length && ents[k].type==="VERTEX"; k++){ const v=ents[k], x=val(v,10), y=val(v,20), z=val(v,30); if(isFinite(x)&&isFinite(y)) ln.push([x,y, isFinite(z)&&z!==0? z : zElev]) } i=k-1; if(ln.length) lines.push(ln) }
    else if(e.type==="LINE"){ const a=[val(e,10),val(e,20),val(e,30)||0], b=[val(e,11),val(e,21),val(e,31)||0]; if(a.concat(b).every(isFinite)) lines.push([a,b]) }
    else if(e.type==="3DFACE"){ [[10,20,30],[11,21,31],[12,22,32],[13,23,33]].forEach(([a,b,c])=>{ const q=[val(e,a),val(e,b),val(e,c)]; if(q.every(isFinite)) pts.push(q) }) }
    else if(e.type==="INSERT" || e.type==="TEXT"){ const q=[val(e,10),val(e,20),val(e,30)]; if(q.every(isFinite) && q[2]!==0) pts.push(q) }
  }
  lines.forEach(ln=>topoDensifica(ln, ln[0][2], pts, 2));
  // pontos com cota 0 costumam ser molduras/textos: saem se a maioria tem cota
  const nz=pts.filter(q=>q[2]!==0).length; const out = nz>pts.length*0.5 ? pts.filter(q=>q[2]!==0) : pts;
  return {pts: out, tipo:"xy", linhas: lines.length};
}
/* reduz a nuvem a no máximo `max` pontos (um por célula de grade, o mais próximo do centro) */
function topoAfina(pts, max=3000){
  if(pts.length<=max) return pts;
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity; pts.forEach(q=>{ x0=Math.min(x0,q[0]); x1=Math.max(x1,q[0]); y0=Math.min(y0,q[1]); y1=Math.max(y1,q[1]) });
  let cs=Math.sqrt((x1-x0)*(y1-y0)/max)||1, out;
  for(let it=0; it<8; it++){ const m=new Map(); pts.forEach(q=>{ const k=Math.floor((q[0]-x0)/cs)+","+Math.floor((q[1]-y0)/cs); if(!m.has(k)) m.set(k,q) }); out=[...m.values()]; if(out.length<=max) break; cs*=1.25 }
  return out;
}
/* texto → pontos locais [x,y,z]. ctx = {lat, lon (origem do lote), lote (polígono local)} */
function topoImportar(texto, nome="", ctx={}){
  const ext=(String(nome).split(".").pop()||"").toLowerCase(), t=String(texto||"");
  let r;
  if(ext==="dxf" || /^\s*0\s*\r?\n\s*SECTION/i.test(t)) r=topoLerDXF(t);
  else if(ext==="kml" || /<kml[\s>]/i.test(t) || /<coordinates>/i.test(t)) r=topoLerKML(t);
  else r=topoLerCSV(t);
  let pts=r.pts, aviso="", modo=r.tipo;
  if(pts.length<3) return {pts:[], erro:"Não encontrei pontos com cota no arquivo (precisa de x, y e z, ou latitude, longitude e altitude)."};
  const ref=geoRef(isFinite(ctx.lat)?ctx.lat:-28.68, isFinite(ctx.lon)?ctx.lon:-49.37);
  if(r.tipo==="latlon") pts=pts.map(([lon,lat,z])=>{ const p=geoParaLocal(lat,lon,ref); return [p[0],p[1],z] });
  else { // x,y: metros locais ou UTM (valores grandes)
    const med=a=>{ const s=a.slice().sort((p,q)=>p-q); return s[Math.floor(s.length/2)] };
    const mx=med(pts.map(q=>Math.abs(q[0]))), my=med(pts.map(q=>Math.abs(q[1])));
    if(mx>1e5 && mx<1e6 && my>1e6 && my<1e7){ const zona=geoZonaDeLon(isFinite(ctx.lon)?ctx.lon:-49.37), sul=!(ctx.lat>0); modo="utm";
      pts=pts.map(([E,N,z])=>{ const [la,lo]=geoUtmParaLatLon(E,N,zona,sul), p=geoParaLocal(la,lo,ref); return [p[0],p[1],z] }) }
  }
  // fora do lote? centraliza no lote (o lote não está georreferenciado ou o arquivo usa outro sistema)
  const L=ctx.lote||[];
  if(L.length>2){ let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity; pts.forEach(q=>{ x0=Math.min(x0,q[0]); x1=Math.max(x1,q[0]); y0=Math.min(y0,q[1]); y1=Math.max(y1,q[1]) });
    const lx=L.map(q=>q[0]), ly=L.map(q=>q[1]), over = x1>=Math.min(...lx) && x0<=Math.max(...lx) && y1>=Math.min(...ly) && y0<=Math.max(...ly);
    if(!over){ const cx=(Math.min(...lx)+Math.max(...lx))/2-(x0+x1)/2, cy=(Math.min(...ly)+Math.max(...ly))/2-(y0+y1)/2; pts=pts.map(q=>[q[0]+cx,q[1]+cy,q[2]]);
      aviso="Os pontos não caíam sobre o lote: foram centralizados nele. Para a posição exata, georreferencie o lote (Coordenadas ou Mapa)." } }
  const n0=pts.length; pts=topoAfina(pts, 3000);
  if(pts.length<n0) aviso=(aviso?aviso+" ":"")+`Nuvem reduzida de ${n0} para ${pts.length} pontos.`;
  return { pts: pts.map(q=>[+q[0].toFixed(2), +q[1].toFixed(2), +q[2].toFixed(3)]), modo, aviso, n:pts.length };
}

/* terreno inclinado de exemplo: grade de 4 m sobre o lote + 20 m, subindo ~11% da frente para os fundos, com leve ondulação */
function topoExemplo(lote, fd, z0=100){
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity; lote.forEach(q=>{ x0=Math.min(x0,q[0]); x1=Math.max(x1,q[0]); y0=Math.min(y0,q[1]); y1=Math.max(y1,q[1]) });
  const m=20, s=4, fdx=fd? fd[0]:0, fdy=fd? fd[1]:1, f0=Math.min(...lote.map(q=>q[0]*fdx+q[1]*fdy)), out=[];
  for(let x=x0-m; x<=x1+m+1e-9; x+=s) for(let y=y0-m; y<=y1+m+1e-9; y+=s){ const d=x*fdx+y*fdy-f0, l=x*fdy-y*fdx;
    const z=z0 + 0.11*d + 0.025*l + 0.6*Math.sin(d/9)*Math.cos(l/13); out.push([+x.toFixed(2), +y.toFixed(2), +z.toFixed(3)]) }
  return out;
}

/* ---------------- tudo junto para o modelo ---------------- */
const TOPO_SF = { key:"", sf:null };
function topoSurfOf(st){
  const key=topoHash([st.topo.pts.length, st.topo.pts, st.lote.pts]);
  if(TOPO_SF.key!==key){ TOPO_SF.key=key; TOPO_SF.sf=topoSuperficie(st.topo.pts, st.lote.pts) }
  return TOPO_SF.sf;
}
function topoCalc(st, m){
  const T=st.topo, sf=topoSurfOf(st); if(!sf) return null;
  const P=st.produto, L=st.lote.pts, nSub=P.subsolos>0 && m.sub && m.sub.length>2 ? P.subsolos : 0, sub=nSub? m.sub : [], pe=P.peGar;
  const ac=m.acesso || accessPoints(st), calc=topoZ(sf, ac.ped[0], ac.ped[1]);
  const opt=topoCotaOtima(sf, L, sub, nSub, pe, calc, T.soleiraTol);
  const c = T.cotaModo==="manual" && isFinite(T.cotaTerreo) && T.cotaTerreo!==0 ? +T.cotaTerreo : opt.c;
  const terra=topoTerra(sf, L, sub, c, nSub, pe), cont=topoContencao(sf, L, sub, c, nSub, pe, {min:T.arrimoMin});
  // cobertura: quanto do lote está dentro da área medida
  const db=sf.dbb, fora=L.some(q=>q[0]<db.x0-0.5||q[0]>db.x1+0.5||q[1]<db.y0-0.5||q[1]>db.y1+0.5);
  // lençol freático
  let na=null;
  if(T.naOn){ const cotaNA=calc-Math.max(0,+T.naProf||0), fundo=c-nSub*pe;
    if(nSub>0 && fundo<cotaNA){ const Sb=topoPecas(sf, sub), vol=Math.max(0, topoAcima(Sb, fundo)-topoAcima(Sb, cotaNA)), hAgua=cotaNA-fundo, areaImp=Sb.A + cont.per*(hAgua+0.5);
      na={cotaNA, fundo, hAgua, vol, areaImp, rebaix: vol*(+T.rebaixCusto||0), imperm: areaImp*(+T.impermCusto||0)} }
    else na={cotaNA, fundo, hAgua:0, vol:0, areaImp:0, rebaix:0, imperm:0} }
  const tipo=TOPO_CONT[T.contTipo]? T.contTipo : "cortina", cm2=+((T.contCustos||{})[tipo] ?? TOPO_CONT[tipo].custo);
  const custos={ terra: terra.corte*(+T.custoCorte||0) + terra.aterro*(+T.custoAterro||0), contencao: cont.area*cm2, arrimo: cont.arrimo*(+T.arrimoCusto||0), rebaix: na? na.rebaix : 0, imperm: na? na.imperm : 0 };
  return { sf, calc, c, cOtima:opt.c, modo:T.cotaModo, tol:T.soleiraTol, terra, cont, na, tipo, cm2, custos, fora, nSub, pe, n:sf.N };
}
/* gancho: com a topografia ligada (e com pontos), substitui o desnível simples (m.terra) pelos volumes reais */
HOOK.compute.push((m, st)=>{
  m.terraSimples = m.terra;
  if(!st.topo || !st.topo.on) return;
  if(!topoAtivo(st)){ (m.avisos=m.avisos||[]).push("Topografia ligada sem levantamento: importe os pontos (CSV, KML ou DXF) ou use o terreno de exemplo. Até lá vale o desnível simples."); return }
  const t=topoCalc(st, m); if(!t) return;
  m.topo=t; m.terra=0;
  const add=(k,nome,sistema,valor)=>{ if(valor>0.5) m.custosExtra.push({k, nome, sistema, valor}) };
  add("topo.terra", `Movimento de terra: corte ${Math.round(t.terra.corte)} m³ e aterro ${Math.round(t.terra.aterro)} m³`, "movimento de terra", t.custos.terra);
  add("topo.contencao", `Contenção do subsolo — ${TOPO_CONT[t.tipo].nome} (${Math.round(t.cont.area)} m²)`, "contenção", t.custos.contencao);
  add("topo.arrimo", `Muros de arrimo do platô (${Math.round(t.cont.arrimo)} m²)`, "contenção", t.custos.arrimo);
  if(t.na){ add("topo.rebaix", `Rebaixamento do lençol freático (${Math.round(t.na.vol)} m³ abaixo do nível d'água)`, "movimento de terra", t.custos.rebaix);
    add("topo.imperm", `Impermeabilização do subsolo abaixo do lençol (${Math.round(t.na.areaImp)} m²)`, "impermeabilização", t.custos.imperm);
    if(t.na.hAgua>0) (m.avisos=m.avisos||[]).push(`O fundo do subsolo fica ${t.na.hAgua.toFixed(1).replace(".",",")} m abaixo do lençol freático: rebaixamento e impermeabilização entram no custo.`) }
  if(t.fora) (m.avisos=m.avisos||[]).push("Parte do lote está fora da área levantada: a topografia ali foi extrapolada.");
});
