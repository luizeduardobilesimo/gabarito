/* ================= clima: entorno, horas de sol e vento ================= */
function prisms(st, m){
  const P=st.produto, out=[];
  if(m.emb.length) out.push({poly:m.emb, z0:0, z1:m.hEmb, own:true});
  // torre: um prisma por faixa de andares (2.4 escalonada; C2 pilha de blocos); a 1ª desce até a laje do embasamento e a última sobe até o topo
  m.T.forEach(t=>{ if(!t.plate.length) return; const fx=(t.faixas||[]).filter(f=>f.plate && f.plate.length>2);
    if(fx.length<2){ out.push({poly:t.plate, z0:m.hEmb, z1:t.H, own:true}); return }
    fx.forEach((f,k)=>out.push({poly:f.plate, z0:k? f.z0 : m.hEmb, z1:k===fx.length-1? t.H : f.z1, own:true})) });
  (st.entorno||[]).forEach(e=>{ if(e.pts&&e.pts.length>2) out.push({poly:entPoly(e), z0:0, z1:+e.h||0, own:false}) });
  out.forEach(p=>{ const xs=p.poly.map(q=>q[0]), ys=p.poly.map(q=>q[1]); p.bb=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)] });
  return out;
}
function sunVectorAt(mes, dia, hora){
  const lat=S.lote.lat*Math.PI/180;
  const n = Math.floor((Date.UTC(2026,mes-1,dia)-Date.UTC(2026,0,0))/864e5);
  const dec = 23.44*Math.PI/180*Math.sin(2*Math.PI*(284+n)/365), Hh=(hora-12)*15*Math.PI/180;
  const alt=Math.asin(Math.sin(lat)*Math.sin(dec)+Math.cos(lat)*Math.cos(dec)*Math.cos(Hh));
  const az=Math.atan2(Math.sin(Hh), Math.cos(Hh)*Math.sin(lat)-Math.tan(dec)*Math.cos(lat))+Math.PI;
  const th=(S.lote.norte||0)*Math.PI/180, north=[Math.sin(th),Math.cos(th)], east=[Math.cos(th),-Math.sin(th)];
  const e=Math.sin(az)*Math.cos(alt), nn=Math.cos(az)*Math.cos(alt);
  return {alt, x:east[0]*e+north[0]*nn, y:east[1]*e+north[1]*nn, z:Math.sin(alt)};
}
function domainOf(st, m, margin){
  const pts=[...st.lote.pts, ...(st.entorno||[]).flatMap(e=>e.pts||[])];
  const xs=pts.map(q=>q[0]), ys=pts.map(q=>q[1]);
  return [Math.min(...xs)-margin, Math.min(...ys)-margin, Math.max(...xs)+margin, Math.max(...ys)+margin];
}
let _sunCache=null;
function sunHours(st, m){
  const PR=prisms(st,m), sig=JSON.stringify([PR.map(p=>[p.poly,p.z1]), st.sol.mes, st.sol.dia, st.lote.lat, st.lote.norte]);
  if(_sunCache && _sunCache.sig===sig) return _sunCache;
  const [x0,y0,x1,y1]=domainOf(st,m,25), span=Math.max(x1-x0,y1-y0), cs=Math.max(0.75, span/120);
  const nx=Math.ceil((x1-x0)/cs), ny=Math.ceil((y1-y0)/cs), data=new Float32Array(nx*ny);
  const suns=[]; for(let h=5;h<=19.5;h+=0.5){ const v=sunVectorAt(st.sol.mes, st.sol.dia, h); if(v.alt>0.01) suns.push(v) }
  for(let j=0;j<ny;j++) for(let i=0;i<nx;i++){
    const p=[x0+(i+0.5)*cs, y0+(j+0.5)*cs];
    if(PR.some(q=>p[0]>=q.bb[0]&&p[0]<=q.bb[2]&&p[1]>=q.bb[1]&&p[1]<=q.bb[3]&&q.z0===0&&G.pip(p,q.poly))){ data[j*nx+i]=NaN; continue }
    let lit=0;
    for(const s of suns){
      let sh=false;
      for(const q of PR){
        const t0=q.z0/s.z, t1=q.z1/s.z, a=[p[0]+s.x*t0, p[1]+s.y*t0], b=[p[0]+s.x*t1, p[1]+s.y*t1];
        if(Math.max(a[0],b[0])<q.bb[0]||Math.min(a[0],b[0])>q.bb[2]||Math.max(a[1],b[1])<q.bb[1]||Math.min(a[1],b[1])>q.bb[3]) continue;
        if(G.segPolyHit(a,b,q.poly)){ sh=true; break }
      }
      if(!sh) lit++;
    }
    data[j*nx+i]=lit*0.5;
  }
  // estatística no lote (área livre)
  let sum=0,n=0,low=0; const L=st.lote.pts;
  for(let j=0;j<ny;j++) for(let i=0;i<nx;i++){ const v=data[j*nx+i]; if(isNaN(v)) continue; const p=[x0+(i+0.5)*cs, y0+(j+0.5)*cs]; if(G.pip(p,L)){ sum+=v; n++; if(v<2) low++ } }
  _sunCache={sig, x0,y0,cs,nx,ny,data, max:suns.length*0.5, mediaLote:n?sum/n:0, pctBaixo:n?low/n:0, fx:[1,0], fy:[0,1]};
  return _sunCache;
}
/* ---------- vento: Lattice Boltzmann D2Q9 numa fatia horizontal ---------- */
const WIND = { sig:null, steps:0, running:false };
const EX=[0,1,0,-1,0,1,-1,-1,1], EY=[0,0,1,0,-1,1,1,-1,-1], WQ=[4/9,1/9,1/9,1/9,1/9,1/36,1/36,1/36,1/36], OPP=[0,3,4,1,2,7,8,5,6];
function windFlowDir(st){ // direção para onde o vento sopra, no referencial do desenho
  const th=(S.lote.norte||0)*Math.PI/180, north=[Math.sin(th),Math.cos(th)], east=[Math.cos(th),-Math.sin(th)];
  const ph=st.clima.ventoDir*Math.PI/180, from=[Math.cos(ph)*north[0]+Math.sin(ph)*east[0], Math.cos(ph)*north[1]+Math.sin(ph)*east[1]];
  return [-from[0],-from[1]];
}
function windSetup(st, m){
  const z=st.clima.ventoAlt, f=windFlowDir(st), pp=[-f[1],f[0]];
  const obs=prisms(st,m).filter(q=>z>=q.z0 && z<q.z1).map(q=>q.poly);
  const sig=JSON.stringify([obs, f, z]);
  if(WIND.sig===sig) return WIND;
  const pts=[...st.lote.pts, ...obs.flat()], xs=pts.map(q=>G.dot(q,f)), ys=pts.map(q=>G.dot(q,pp));
  let a0=Math.min(...xs), a1=Math.max(...xs), b0=Math.min(...ys), b1=Math.max(...ys); const W=a1-a0, H=b1-b0, S_=Math.max(W,H,30);
  a0-=S_*0.6; a1+=S_*1.4; b0-=S_*0.7; b1+=S_*0.7;
  const nx=200, cs=(a1-a0)/nx, ny=Math.max(60,Math.min(150,Math.round((b1-b0)/cs)));
  const N=nx*ny, solid=new Uint8Array(N);
  for(let j=0;j<ny;j++) for(let i=0;i<nx;i++){ const x=a0+(i+0.5)*cs, y=b0+(j+0.5)*cs, w=[x*f[0]+y*pp[0], x*f[1]+y*pp[1]]; if(obs.some(o=>G.pip(w,o))) solid[j*nx+i]=1 }
  const u0=0.08, fA=new Float32Array(9*N), fB=new Float32Array(9*N);
  for(let c=0;c<N;c++) for(let k=0;k<9;k++){ const eu=EX[k]*u0; fA[k*N+c]=WQ[k]*(1+3*eu+4.5*eu*eu-1.5*u0*u0) }
  Object.assign(WIND,{sig, nx, ny, N, cs, a0, b0, f, pp, solid, fA, fB, u0, steps:0, spd:new Float32Array(N), ux:new Float32Array(N), uy:new Float32Array(N), obs});
  return WIND;
}
function windStep(n){
  const {nx,ny,N,solid,u0}=WIND; let f=WIND.fA, g=WIND.fB; const om=1/0.6;
  const feqIn=WQ.map((w,k)=>{ const eu=EX[k]*u0; return w*(1+3*eu+4.5*eu*eu-1.5*u0*u0) });
  for(let s=0;s<n;s++){
    for(let c=0;c<N;c++){
      if(solid[c]) continue;
      let r=0,ux=0,uy=0; for(let k=0;k<9;k++){ const v=f[k*N+c]; r+=v; ux+=v*EX[k]; uy+=v*EY[k] }
      if(!(r>0.2&&r<5)){ r=1; ux=0; uy=0 } else { ux/=r; uy/=r }
      const un=Math.hypot(ux,uy); if(un>0.25){ ux*=0.25/un; uy*=0.25/un }
      const uu=1.5*(ux*ux+uy*uy);
      for(let k=0;k<9;k++){ const eu=EX[k]*ux+EY[k]*uy, feq=WQ[k]*r*(1+3*eu+4.5*eu*eu-uu); f[k*N+c]+=om*(feq-f[k*N+c]) }
    }
    for(let j=0;j<ny;j++) for(let i=0;i<nx;i++){
      const c=j*nx+i; if(solid[c]) continue;
      for(let k=0;k<9;k++){
        const ti=i+EX[k]; if(ti<0||ti>=nx) continue;
        let tj=j+EY[k]; if(tj<0) tj=ny-1; else if(tj>=ny) tj=0;
        const t=tj*nx+ti;
        if(solid[t]) g[OPP[k]*N+c]=f[k*N+c]; else g[k*N+t]=f[k*N+c];
      }
    }
    for(let j=0;j<ny;j++){ const c0=j*nx, c1=j*nx+nx-1; for(let k=0;k<9;k++){ g[k*N+c0]=feqIn[k]; g[k*N+c1]=g[k*N+c1-1] } }
    const tmp=f; f=g; g=tmp;
  }
  WIND.fA=f; WIND.fB=g; WIND.steps+=n;
  const sp=WIND.spd; let mx=0;
  for(let c=0;c<N;c++){ if(solid[c]){ sp[c]=NaN; continue } let r=0,ux=0,uy=0; for(let k=0;k<9;k++){ const v=f[k*N+c]; r+=v; ux+=v*EX[k]; uy+=v*EY[k] } ux/=r; uy/=r; WIND.ux[c]=ux/u0; WIND.uy[c]=uy/u0; sp[c]=Math.hypot(ux,uy)/u0; if(sp[c]>mx) mx=sp[c] }
  WIND.max=mx;
}
function windStats(st){
  if(!WIND.spd) return null; const L=st.lote.pts; let n=0, hi=0, calm=0, mx=0;
  for(let j=0;j<WIND.ny;j++) for(let i=0;i<WIND.nx;i++){ const c=j*WIND.nx+i, v=WIND.spd[c]; if(isNaN(v)) continue; const x=WIND.a0+(i+0.5)*WIND.cs, y=WIND.b0+(j+0.5)*WIND.cs, w=[x*WIND.f[0]+y*WIND.pp[0], x*WIND.f[1]+y*WIND.pp[1]]; if(!G.pip(w,L)) continue; n++; if(v>1.3) hi++; if(v<0.35) calm++; if(v>mx) mx=v }
  return {n, hi:n?hi/n:0, calm:n?calm/n:0, max:mx};
}
/* ---------- cores ---------- */
function rampColor(t, stops){ t=Math.max(0,Math.min(1,t)); for(let i=1;i<stops.length;i++){ if(t<=stops[i][0]){ const [t0,c0]=stops[i-1],[t1,c1]=stops[i], k=(t-t0)/((t1-t0)||1); return c0.map((v,j)=>Math.round(v+(c1[j]-v)*k)) } } return stops.at(-1)[1] }
const WIND_STOPS=[[0,[38,70,140]],[0.3,[70,150,200]],[0.5,[120,190,160]],[0.62,[235,215,90]],[0.8,[235,140,60]],[1,[190,50,45]]];
const SUN_STOPS=[[0,[48,40,95]],[0.3,[95,80,160]],[0.55,[200,120,120]],[0.8,[240,190,90]],[1,[252,240,170]]];
function fieldCanvas(kind){
  let nx,ny,get;
  if(kind==="vento"){ if(!WIND.spd) return null; nx=WIND.nx; ny=WIND.ny; get=c=>{ const v=WIND.spd[c]; return isNaN(v)? null : rampColor(v/2, WIND_STOPS) } }
  else { const s=_sunCache; if(!s) return null; nx=s.nx; ny=s.ny; get=c=>{ const v=s.data[c]; return isNaN(v)? null : rampColor(v/Math.max(1,s.max), SUN_STOPS) } }
  const cv=fieldCanvas._c||(fieldCanvas._c={}); const key=kind; let c=cv[key]; if(!c){ c=cv[key]=document.createElement("canvas") } c.width=nx; c.height=ny;
  const g=c.getContext("2d"), img=g.createImageData(nx,ny);
  for(let j=0;j<ny;j++) for(let i=0;i<nx;i++){ const col=get(j*nx+i), o=(j*nx+i)*4; if(!col){ img.data[o+3]=0; continue } img.data[o]=col[0]; img.data[o+1]=col[1]; img.data[o+2]=col[2]; img.data[o+3]=215 }
  g.putImageData(img,0,0); return c;
}
function fieldFrame(kind){ // origem, eixos e tamanho de célula no referencial do desenho
  if(kind==="vento") return {o:[WIND.a0,WIND.b0], fx:WIND.f, fy:WIND.pp, cs:WIND.cs, nx:WIND.nx, ny:WIND.ny};
  const s=_sunCache; return {o:[s.x0,s.y0], fx:[1,0], fy:[0,1], cs:s.cs, nx:s.nx, ny:s.ny};
}
