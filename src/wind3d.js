/* ================= Vento 3D: Lattice Boltzmann D3Q19 + LES (Smagorinsky) num Web Worker ================= */
const CFD_WORKER = `
const E=[[0,0,0],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],[1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],[1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1]];
const Q=19, W=new Float64Array(E.map((e,i)=> i===0?1/3 : (Math.abs(e[0])+Math.abs(e[1])+Math.abs(e[2])===1?1/18:1/36)));
const OPP=new Int32Array(E.map(e=>E.findIndex(o=>o[0]===-e[0]&&o[1]===-e[1]&&o[2]===-e[2])));
const EX=new Float64Array(E.map(e=>e[0])), EY=new Float64Array(E.map(e=>e[1])), EZ=new Float64Array(E.map(e=>e[2]));
let S=null, running=false;
const fe=new Float64Array(Q);
onmessage=e=>{ const d=e.data; if(d.cmd==='init'){ running=false; init(d) } else if(d.cmd==='run'){ if(!running){ running=true; loop() } } else if(d.cmd==='pause'){ running=false } else if(d.cmd==='post'){ post() } };
function init(d){
  const nx=d.nx, ny=d.ny, nz=d.nz, X=nx+2, Y=ny+2, Z=nz+2, NP=X*Y*Z, N=nx*ny*nz;
  const f=new Float32Array(Q*NP), g=new Float32Array(Q*NP), solid=new Uint8Array(NP);
  const off=new Int32Array(Q); for(let q=0;q<Q;q++) off[q]=EX[q]+X*(EY[q]+Y*EZ[q]);
  for(let k=0;k<nz;k++) for(let j=0;j<ny;j++) for(let i=0;i<nx;i++) solid[(i+1)+X*((j+1)+Y*(k+1))]=d.solid[i+nx*(j+ny*k)];
  for(let j=0;j<Y;j++) for(let i=0;i<X;i++) solid[i+X*j]=1; // chão
  const uinP=new Float64Array(Z); for(let k=1;k<=nz;k++) uinP[k]=d.uin[k-1]; uinP[Z-1]=d.uin[nz-1]; uinP[0]=0;
  const fin=new Float32Array(Z*Q);
  const eq=(rho,ux,uy,uz)=>{ const uu=1.5*(ux*ux+uy*uy+uz*uz); for(let q=0;q<Q;q++){ const eu=EX[q]*ux+EY[q]*uy+EZ[q]*uz; fe[q]=W[q]*rho*(1+3*eu+4.5*eu*eu-uu) } };
  for(let k=0;k<Z;k++){ eq(1,uinP[k],0,0); for(let q=0;q<Q;q++) fin[k*Q+q]=fe[q] }
  for(let k=0;k<Z;k++) for(let j=0;j<Y;j++) for(let i=0;i<X;i++){ const c=i+X*(j+Y*k); if(solid[c]){ eq(1,0,0,0) } else eq(1,uinP[k],0,0); for(let q=0;q<Q;q++) f[q*NP+c]=fe[q] }
  S={nx,ny,nz,X,Y,Z,NP,N,f,g,solid,off,fin,tau0:d.tau0,Cs:d.Cs,step:0,mean:new Float32Array(3*N),m2:new Float32Array(N),msum:new Float32Array(N),navg:0,avgFrom:d.avgFrom,lastPost:0,ms:0,postEvery:d.postEvery||400,id:d.id};
  post();
}
function stepOnce(){
  const {X,Y,Z,NP,solid,off,tau0,Cs,fin}=S; const f=S.f, g=S.g; const c18=18*Math.SQRT2*Cs*Cs;
  for(let k=1;k<Z-1;k++) for(let j=1;j<Y-1;j++){ let c=1+X*(j+Y*k); for(let i=1;i<X-1;i++,c++){
    if(solid[c]) continue;
    let rho=0,ux=0,uy=0,uz=0; for(let q=0;q<Q;q++){ const v=f[q*NP+c]; rho+=v; ux+=v*EX[q]; uy+=v*EY[q]; uz+=v*EZ[q] }
    if(!(rho>0.3&&rho<3)){ rho=1; ux=0; uy=0; uz=0 } else { ux/=rho; uy/=rho; uz/=rho }
    const un=Math.sqrt(ux*ux+uy*uy+uz*uz); if(un>0.3){ const s=0.3/un; ux*=s; uy*=s; uz*=s }
    const uu=1.5*(ux*ux+uy*uy+uz*uz); let pxx=0,pyy=0,pzz=0,pxy=0,pxz=0,pyz=0;
    for(let q=0;q<Q;q++){ const ex=EX[q],ey=EY[q],ez=EZ[q], eu=ex*ux+ey*uy+ez*uz, fq=W[q]*rho*(1+3*eu+4.5*eu*eu-uu); fe[q]=fq; const n=f[q*NP+c]-fq; pxx+=ex*ex*n; pyy+=ey*ey*n; pzz+=ez*ez*n; pxy+=ex*ey*n; pxz+=ex*ez*n; pyz+=ey*ez*n }
    const Qn=Math.sqrt(pxx*pxx+pyy*pyy+pzz*pzz+2*(pxy*pxy+pxz*pxz+pyz*pyz));
    const om=2/(tau0+Math.sqrt(tau0*tau0+c18*Qn/rho));
    for(let q=0;q<Q;q++){ const idx=q*NP+c; f[idx]+=om*(fe[q]-f[idx]) }
  }}
  // contornos: entrada com perfil de camada limite, saída e laterais com gradiente nulo, topo livre
  for(let k=1;k<Z;k++) for(let j=0;j<Y;j++){ const c=X*(j+Y*k), kk=Math.min(k,Z-2); for(let q=0;q<Q;q++) f[q*NP+c]=fin[kk*Q+q]; const co=X-1+X*(j+Y*k); for(let q=0;q<Q;q++) f[q*NP+co]=f[q*NP+co-1] }
  for(let k=1;k<Z;k++) for(let i=0;i<X;i++){ const c0=i+X*(0+Y*k), c1=i+X*(Y-1+Y*k); for(let q=0;q<Q;q++){ f[q*NP+c0]=f[q*NP+c0+X]; f[q*NP+c1]=f[q*NP+c1-X] } }
  const XY=X*Y; for(let j=0;j<Y;j++) for(let i=0;i<X;i++){ const c=i+X*j+XY*(Z-1); for(let q=0;q<Q;q++) f[q*NP+c]=f[q*NP+c-XY] }
  // propagação (pull) com bounce-back nos sólidos
  for(let k=1;k<Z-1;k++) for(let j=1;j<Y-1;j++){ let c=1+X*(j+Y*k); for(let i=1;i<X-1;i++,c++){
    if(solid[c]) continue;
    for(let q=0;q<Q;q++){ const src=c-off[q]; g[q*NP+c] = solid[src]? f[OPP[q]*NP+c] : f[q*NP+src] }
  }}
  S.f=g; S.g=f; S.step++;
}
function macro(c){ const f=S.f, NP=S.NP; let rho=0,ux=0,uy=0,uz=0; for(let q=0;q<Q;q++){ const v=f[q*NP+c]; rho+=v; ux+=v*EX[q]; uy+=v*EY[q]; uz+=v*EZ[q] } return [rho,ux/rho,uy/rho,uz/rho] }
function accum(){
  const {nx,ny,nz,X,Y,solid,mean,m2,msum}=S; S.navg++; const a=1/S.navg;
  for(let k=0;k<nz;k++) for(let j=0;j<ny;j++) for(let i=0;i<nx;i++){ const id=i+nx*(j+ny*k), c=(i+1)+X*((j+1)+Y*(k+1)); if(solid[c]) continue; const [r,ux,uy,uz]=macro(c); const sp=Math.sqrt(ux*ux+uy*uy+uz*uz);
    mean[3*id]+=(ux-mean[3*id])*a; mean[3*id+1]+=(uy-mean[3*id+1])*a; mean[3*id+2]+=(uz-mean[3*id+2])*a; msum[id]+=(sp-msum[id])*a; m2[id]+=(sp*sp-m2[id])*a }
}
function post(){
  const {nx,ny,nz,X,Y,N,solid}=S; const ux=new Float32Array(N), uy=new Float32Array(N), uz=new Float32Array(N), rho=new Float32Array(N);
  for(let k=0;k<nz;k++) for(let j=0;j<ny;j++) for(let i=0;i<nx;i++){ const id=i+nx*(j+ny*k), c=(i+1)+X*((j+1)+Y*(k+1)); if(solid[c]){ rho[id]=1; continue } const m=macro(c); rho[id]=m[0]; ux[id]=m[1]; uy[id]=m[2]; uz[id]=m[3] }
  const msg={type:'field', id:S.id, step:S.step, ms:S.ms, ux,uy,uz,rho, navg:S.navg}; const tr=[ux.buffer,uy.buffer,uz.buffer,rho.buffer];
  if(S.navg>2){ const mean=S.mean.slice(), rms=new Float32Array(N); for(let i=0;i<N;i++) rms[i]=Math.sqrt(Math.max(0,S.m2[i]-S.msum[i]*S.msum[i])); msg.mean=mean; msg.rms=rms; tr.push(mean.buffer,rms.buffer) }
  postMessage(msg,tr); S.lastPost=performance.now();
}
function loop(){
  if(!running||!S) return; const t0=performance.now(); let n=0;
  do{ stepOnce(); n++; if(S.step>=S.avgFrom && S.step%3===0) accum() } while(performance.now()-t0<45);
  S.ms=(performance.now()-t0)/n;
  if(performance.now()-S.lastPost>S.postEvery) post();
  setTimeout(loop,0);
}
`;
const CFD = { worker:null, sig:null, dom:null, field:null, running:false, grp:null, parts:null, raf:null, probe:null, id:0, dirty:true, lastLines:0 };
const CFD_RES = { rapida:[45000,"Rápida"], media:[110000,"Média"], alta:[240000,"Alta"] };
const CFD_RUG = { aberto:[0.14,"Campo aberto"], suburbano:[0.22,"Subúrbio"], urbano:[0.30,"Centro urbano"] };
const CFD_VARS = { vel:"Velocidade instantânea", media:"Velocidade média", w:"Componente vertical", ti:"Turbulência", cp:"Pressão (Cp)", vort:"Vorticidade", lawson:"Conforto do pedestre" };
function cfdDomain(st, m){
  const f=windFlowDir(st), pp=[-f[1],f[0]], PR=prisms(st,m).filter(p=>p.z1>p.z0+0.5);
  const pts=[...st.lote.pts, ...PR.flatMap(p=>p.poly)];
  const xs=pts.map(q=>G.dot(q,f)), ys=pts.map(q=>G.dot(q,pp));
  const Hmax=Math.max(8,...PR.map(p=>p.z1));
  const bx0=Math.min(...xs), bx1=Math.max(...xs), by0=Math.min(...ys), by1=Math.max(...ys);
  const Lh=Math.max(Hmax, 18, Math.min(bx1-bx0, by1-by0)*0.6);
  const x0=bx0-1.3*Lh, x1=bx1+2.8*Lh, y0=by0-1.1*Lh, y1=by1+1.1*Lh, ztop=Math.max(2.4*Hmax, Hmax+24);
  const budget=CFD_RES[st.cfd.res]?.[0]||45000;
  const dx=Math.cbrt((x1-x0)*(y1-y0)*ztop/budget);
  const nx=Math.max(24,Math.round((x1-x0)/dx)), ny=Math.max(16,Math.round((y1-y0)/dx)), nz=Math.max(10,Math.round(ztop/dx));
  const solid=new Uint8Array(nx*ny*nz);
  for(let j=0;j<ny;j++) for(let i=0;i<nx;i++){
    const x=x0+(i+0.5)*dx, y=y0+(j+0.5)*dx, w=[x*f[0]+y*pp[0], x*f[1]+y*pp[1]];
    PR.forEach(p=>{ if(w[0]<p.bb[0]||w[0]>p.bb[2]||w[1]<p.bb[1]||w[1]>p.bb[3]) return; if(!G.pip(w,p.poly)) return; for(let k=0;k<nz;k++){ const z=(k+0.5)*dx; if(z>=p.z0 && z<p.z1) solid[i+nx*(j+ny*k)]=1 } });
  }
  const a=CFD_RUG[st.cfd.rug]?.[0]||0.3, zref=10, utop=0.085, u0ref=utop/Math.pow(Math.max(ztop,zref)/zref,a);
  const uin=new Float32Array(nz); for(let k=0;k<nz;k++){ const z=Math.max((k+0.5)*dx,0.6); uin[k]=u0ref*Math.pow(z/zref,a) }
  const sig=JSON.stringify([PR.map(p=>[p.poly.map(q=>q.map(v=>+v.toFixed(2))),p.z0,p.z1]), f.map(v=>+v.toFixed(4)), st.cfd.res, st.cfd.rug]);
  return {f,pp,x0,y0,x1:x0+nx*dx,y1:y0+ny*dx,ztop:nz*dx,dx,nx,ny,nz,solid,uin,u0ref,Hmax,PR,sig,alpha:a, bx0,bx1,by0,by1};
}
function cfdStart(force){
  const m=window._last.m, d=cfdDomain(S,m);
  if(!force && CFD.sig===d.sig && CFD.worker) { if(!CFD.running) cfdRun(); return }
  if(CFD.worker) CFD.worker.terminate();
  CFD.dom=d; CFD.sig=d.sig; CFD.field=null; CFD.id++; CFD.dirty=true;
  try{ CFD.worker=new Worker(URL.createObjectURL(new Blob([CFD_WORKER],{type:"text/javascript"}))) }catch(e){ CFD.worker=null; cfdStatus("Este navegador não permite a simulação em segundo plano."); return }
  const id=CFD.id;
  CFD.worker.onmessage=e=>{ const msg=e.data; if(msg.id!==CFD.id) return; CFD.field=msg; CFD.dirty=true; cfdOnField() };
  CFD.worker.postMessage({cmd:"init", id, nx:d.nx, ny:d.ny, nz:d.nz, solid:d.solid, uin:d.uin, tau0:0.505, Cs:0.17, avgFrom:Math.round(1.2*d.nx/0.085), postEvery: d.nx*d.ny*d.nz>150000? 900 : 450});
  cfdBuildStatic(); cfdRun();
}
function cfdRun(){ if(!CFD.worker) return cfdStart(); CFD.worker.postMessage({cmd:"run"}); CFD.running=true; cfdBarUI() }
function cfdPause(){ if(CFD.worker) CFD.worker.postMessage({cmd:"pause"}); CFD.running=false; cfdBarUI() }
/* ---------- amostragem do campo (referencial do vento: x = sentido do vento, y = lateral, z = altura) ---------- */
function cfdIdx(x,y,z){ const d=CFD.dom; return [(x-d.x0)/d.dx-0.5, (y-d.y0)/d.dx-0.5, z/d.dx-0.5] }
function tri(arr, gx,gy,gz, stride=1, comp=0){
  const d=CFD.dom, nx=d.nx, ny=d.ny, nz=d.nz;
  gx=Math.max(0,Math.min(nx-1.001,gx)); gy=Math.max(0,Math.min(ny-1.001,gy)); gz=Math.max(0,Math.min(nz-1.001,gz));
  const i=gx|0, j=gy|0, k=gz|0, fx=gx-i, fy=gy-j, fz=gz-k;
  const A=(a,b,c)=>arr[(a+nx*(b+ny*c))*stride+comp];
  const c00=A(i,j,k)*(1-fx)+A(i+1,j,k)*fx, c10=A(i,j+1,k)*(1-fx)+A(i+1,j+1,k)*fx, c01=A(i,j,k+1)*(1-fx)+A(i+1,j,k+1)*fx, c11=A(i,j+1,k+1)*(1-fx)+A(i+1,j+1,k+1)*fx;
  return (c00*(1-fy)+c10*fy)*(1-fz)+(c01*(1-fy)+c11*fy)*fz;
}
function cfdSolid(x,y,z){ const d=CFD.dom; if(z<0) return true; const i=Math.floor((x-d.x0)/d.dx), j=Math.floor((y-d.y0)/d.dx), k=Math.floor(z/d.dx); if(i<0||j<0||k<0||i>=d.nx||j>=d.ny||k>=d.nz) return false; return d.solid[i+d.nx*(j+d.ny*k)]===1 }
function cfdSolidExact(x,y,z){ const d=CFD.dom; if(z<0) return true; const w=[x*d.f[0]+y*d.pp[0], x*d.f[1]+y*d.pp[1]]; return d.PR.some(p=> z>=p.z0 && z<p.z1 && w[0]>=p.bb[0]&&w[0]<=p.bb[2]&&w[1]>=p.bb[1]&&w[1]<=p.bb[3] && G.pip(w,p.poly)) }
function cfdInside(x,y,z){ const d=CFD.dom; return x>=d.x0 && x<=d.x1 && y>=d.y0 && y<=d.y1 && z>=0 && z<=d.ztop }
const cfdScale = () => S.clima.ventoVel / CFD.dom.u0ref; // lattice → m/s
function cfdVel(x,y,z, useMean){
  const F=CFD.field; if(!F) return [0,0,0]; const [gx,gy,gz]=cfdIdx(x,y,z), s=cfdScale();
  if(useMean && F.mean) return [tri(F.mean,gx,gy,gz,3,0)*s, tri(F.mean,gx,gy,gz,3,1)*s, tri(F.mean,gx,gy,gz,3,2)*s];
  return [tri(F.ux,gx,gy,gz)*s, tri(F.uy,gx,gy,gz)*s, tri(F.uz,gx,gy,gz)*s];
}
function cfdValue(v, x,y,z){
  const F=CFD.field; if(!F) return 0; const [gx,gy,gz]=cfdIdx(x,y,z), s=cfdScale(), U=S.clima.ventoVel;
  if(v==="vel"){ const a=cfdVel(x,y,z); return Math.hypot(a[0],a[1],a[2]) }
  if(v==="media"||v==="lawson"){ const a=cfdVel(x,y,z,true); return Math.hypot(a[0],a[1],a[2]) }
  if(v==="w") return cfdVel(x,y,z, !!F.mean)[2];
  if(v==="ti") return F.rms? tri(F.rms,gx,gy,gz)*s/U : 0;
  if(v==="cp"){ const d=CFD.dom, r=tri(F.rho,gx,gy,gz); if(F._rref===undefined || F._rrefStep!==F.step){ const [a,b,c]=cfdIdx(d.x0+d.dx*3,(d.y0+d.y1)/2,Math.min(d.Hmax,d.ztop*0.5)); F._rref=tri(F.rho,a,b,c); F._rrefStep=F.step } const uH=d.u0ref*Math.pow(Math.max(d.Hmax,10)/10,d.alpha); return (r-F._rref)/3/(0.5*uH*uH) }
  if(v==="vort"){ const h=CFD.dom.dx; const a=(dx,dy,dz)=>cfdVel(x+dx,y+dy,z+dz);
    const xp=a(h,0,0), xm=a(-h,0,0), yp=a(0,h,0), ym=a(0,-h,0), zp=a(0,0,h), zm=a(0,0,-h), k=1/(2*h);
    const wx=(yp[2]-ym[2])*k-(zp[1]-zm[1])*k, wy=(zp[0]-zm[0])*k-(xp[2]-xm[2])*k, wz=(xp[1]-xm[1])*k-(yp[0]-ym[0])*k; return Math.hypot(wx,wy,wz) }
  return 0;
}
/* ---------- cores ---------- */
const TURBO=[[0,[24,38,72]],[0.18,[34,86,138]],[0.36,[58,150,176]],[0.52,[150,206,206]],[0.62,[232,236,226]],[0.74,[244,198,124]],[0.87,[233,130,74]],[1,[190,58,52]]];
const DIVERG=[[0,[34,78,140]],[0.25,[110,168,206]],[0.5,[236,238,234]],[0.75,[236,156,110]],[1,[184,52,48]]];
const LAWSON=[[2,[60,140,200],"sentar"],[4,[100,190,120],"ficar em pé"],[6,[220,210,80],"caminhar"],[8,[240,140,50],"desconfortável"],[99,[200,50,45],"perigoso"]];
function cfdRange(v){ const U=S.clima.ventoVel, c=S.cfd;
  if(c.escala==="fixa" && c.min!=null && c.max!=null) return [c.min,c.max];
  return v==="vel"||v==="media"? [0,U*1.6] : v==="w"? [-0.6*U,0.6*U] : v==="ti"? [0,0.6] : v==="cp"? [-1.2,1] : v==="vort"? [0, U*0.6] : [0,10] }
function cfdColor(v, val){
  if(v==="lawson"){ const c=LAWSON.find(l=>val<l[0]); return c[1] }
  const [a,b]=cfdRange(v), t=(val-a)/((b-a)||1);
  return rampColor(t, v==="w"||v==="cp"? DIVERG : TURBO);
}
/* ---------- cena ---------- */
function cfdGroup(){
  const d=CFD.dom, f=d.f, pp=d.pp;
  if(!CFD.grp){ CFD.grp=new THREE.Group(); CFD.grp.matrixAutoUpdate=false; V3.scene.add(CFD.grp) }
  CFD.grp.matrix.set(f[0],0,pp[0],0, 0,1,0,0, -f[1],0,-pp[1],0, 0,0,0,1); CFD.grp.matrixWorldNeedsUpdate=true;
  return CFD.grp;
}
function disposeObj(o){ if(!o) return; o.traverse&&o.traverse(c=>{ c.geometry&&c.geometry.dispose(); if(c.material){ (Array.isArray(c.material)?c.material:[c.material]).forEach(mt=>{ mt.map&&mt.map.dispose(); mt.dispose() }) } }); o.parent&&o.parent.remove(o) }
const LV=(x,y,z)=>new THREE.Vector3(x,z,y); // local: (x, altura, y)
function cfdBuildStatic(){
  if(!V3.R) return; const d=CFD.dom, grp=cfdGroup();
  ["bld","edges","ground","slice","lines","arrows","pts","trails","probeMk","emitMk"].forEach(k=>{ disposeObj(CFD[k]); CFD[k]=null });
  // chão
  const gg=new THREE.PlaneGeometry(d.x1-d.x0, d.y1-d.y0); gg.rotateX(Math.PI/2); gg.translate((d.x0+d.x1)/2, -0.02, (d.y0+d.y1)/2);
  const dark=S.cfd.fundo!=="claro";
  CFD.ground=new THREE.Mesh(gg, new THREE.MeshBasicMaterial({color:0x0e0e10, side:THREE.DoubleSide, visible:dark})); grp.add(CFD.ground);
  { const gs=[], st=Math.max(5, Math.round(d.dx*2)); for(let x=Math.ceil(d.x0/st)*st; x<=d.x1; x+=st) gs.push(x,0.01,d.y0, x,0.01,d.y1); for(let y=Math.ceil(d.y0/st)*st; y<=d.y1; y+=st) gs.push(d.x0,0.01,y, d.x1,0.01,y);
    const gl=new THREE.BufferGeometry(); gl.setAttribute("position",new THREE.Float32BufferAttribute(gs,3)); if(dark) CFD.ground.add(new THREE.LineSegments(gl,new THREE.LineBasicMaterial({color:0x2c2c31, transparent:true, opacity:0.8}))) }
  const lot=S.lote.pts.map(q=>LV(G.dot(q,d.f),G.dot(q,d.pp),0.05)); const lg=new THREE.BufferGeometry().setFromPoints([...lot,lot[0]]); CFD.ground.add(new THREE.Line(lg,new THREE.LineBasicMaterial({color:col3("--mark")})));
  // edifícios com fachadas subdivididas (para colorir a pressão)
  const pos=[], nor=[], smp=[], idx=[]; const res=Math.max(0.8, d.dx*0.6); let vi=0;
  d.PR.forEach(p=>{
    const L=p.poly.map(q=>[G.dot(q,d.f),G.dot(q,d.pp)]); const ccw=G.sArea(L)>0;
    for(let e=0;e<L.length;e++){ const a=L[e], b=L[(e+1)%L.length], len=Math.hypot(b[0]-a[0],b[1]-a[1]); if(len<0.05) continue;
      let n=[(b[1]-a[1])/len, -(b[0]-a[0])/len]; if(!ccw) n=[-n[0],-n[1]];
      const nu=Math.max(1,Math.ceil(len/res)), nv=Math.max(1,Math.ceil((p.z1-p.z0)/res)), base=vi;
      for(let v=0;v<=nv;v++) for(let u=0;u<=nu;u++){ const t=u/nu, x=a[0]+(b[0]-a[0])*t, y=a[1]+(b[1]-a[1])*t, z=p.z0+(p.z1-p.z0)*v/nv; pos.push(x,z,y); nor.push(n[0],0,n[1]); smp.push(x+n[0]*d.dx*0.9, y+n[1]*d.dx*0.9, Math.max(0.5,z)); vi++ }
      for(let v=0;v<nv;v++) for(let u=0;u<nu;u++){ const i0=base+v*(nu+1)+u, i1=i0+1, i2=i0+nu+1, i3=i2+1; idx.push(i0,i1,i3, i0,i3,i2) }
    }
    const tris=THREE.ShapeUtils.triangulateShape(L.map(q=>new THREE.Vector2(q[0],q[1])),[]); const base=vi;
    L.forEach(q=>{ pos.push(q[0],p.z1,q[1]); nor.push(0,1,0); smp.push(q[0],q[1],p.z1+d.dx*0.9); vi++ });
    tris.forEach(t=>idx.push(base+t[0],base+t[1],base+t[2]));
  });
  const bg=new THREE.BufferGeometry(); bg.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)); bg.setAttribute("normal",new THREE.Float32BufferAttribute(nor,3));
  bg.setAttribute("color",new THREE.Float32BufferAttribute(new Float32Array(pos.length).fill(1),3)); bg.setIndex(idx);
  CFD.smp=new Float32Array(smp);
  CFD.bld=new THREE.Mesh(bg,new THREE.MeshStandardMaterial({vertexColors:true,transparent:true,opacity:S.cfd.opac,side:THREE.DoubleSide,depthWrite:S.cfd.opac>0.9,roughness:0.35,metalness:0.05})); CFD.bld.renderOrder=1; grp.add(CFD.bld);
  // contornos
  const ep=[]; d.PR.forEach(p=>{ const L=p.poly.map(q=>[G.dot(q,d.f),G.dot(q,d.pp)]); L.forEach((a,i)=>{ const b=L[(i+1)%L.length]; ep.push(a[0],p.z1,a[1],b[0],p.z1,b[1], a[0],p.z0,a[1],b[0],p.z0,b[1], a[0],p.z0,a[1],a[0],p.z1,a[1]) }) });
  const eg=new THREE.BufferGeometry(); eg.setAttribute("position",new THREE.Float32BufferAttribute(ep,3));
  CFD.edges=new THREE.LineSegments(eg,new THREE.LineBasicMaterial({color: dark? 0xe4e4e8 : 0x4a4a50,transparent:true,opacity: dark? 0.55 : 0.7})); grp.add(CFD.edges);
  cfdColorBuildings(); cfdFit(); CFD.dirty=true; cfdRefresh(true);
}
function cfdColorBuildings(){
  if(!CFD.bld) return; const col=CFD.bld.geometry.attributes.color, s=CFD.smp, on=S.cfd.viz.pressao && CFD.field;
  const base=new THREE.Color(S.cfd.fundo!=="claro"? 0xe6e6ea : 0xc6c6cc);
  for(let i=0;i<col.count;i++){ if(on){ const c=cfdColor("cp", cfdValue("cp", s[3*i], s[3*i+1], s[3*i+2])); col.setXYZ(i,c[0]/255,c[1]/255,c[2]/255) } else col.setXYZ(i,base.r,base.g,base.b) }
  col.needsUpdate=true; const mt=CFD.bld.material; mt.opacity=1; mt.transparent=false; mt.depthWrite=true; mt.visible=!!on; mt.polygonOffset=true; mt.polygonOffsetFactor=-2; mt.polygonOffsetUnits=-2; mt.needsUpdate=true;
  if(CFD.edges) CFD.edges.visible=false;
}
function cfdFit(){ if(!V3.R) return; const d=CFD.dom; const cx=(d.bx0+d.bx1)/2, cy=(d.by0+d.by1)/2, H=d.Hmax;
  const tgt=new THREE.Vector3(cx,H*0.35,cy).applyMatrix4(CFD.grp.matrix), span=Math.max(d.bx1-d.bx0,d.by1-d.by0,H)*1.6;
  const cam=new THREE.Vector3(cx-span*1.1, H*0.9+span*0.55, cy+span*0.9).applyMatrix4(CFD.grp.matrix);
  V3.ctl.target.copy(tgt); V3.cam.position.copy(cam); V3.ctl.update(); render3() }
/* ---------- plano de corte ---------- */
function slicePlane(){ const d=CFD.dom, c=S.cfd.plano;
  if(c.orient==="h"){ const z=Math.max(0.5,Math.min(d.ztop-0.5,c.h)); return {orient:"h", z, nu:Math.min(260,d.nx*2), nv:Math.min(200,d.ny*2), P:(u,v)=>[d.x0+u*(d.x1-d.x0), d.y0+v*(d.y1-d.y0), z]} }
  if(c.orient==="l"){ const y=d.y0+(d.y1-d.y0)*c.pos; return {orient:"l", y, nu:Math.min(260,d.nx*2), nv:Math.min(160,d.nz*2), P:(u,v)=>[d.x0+u*(d.x1-d.x0), y, v*d.ztop]} }
  const x=d.x0+(d.x1-d.x0)*c.pos; return {orient:"t", x, nu:Math.min(200,d.ny*2), nv:Math.min(160,d.nz*2), P:(u,v)=>[x, d.y0+u*(d.y1-d.y0), v*d.ztop]}; }
function cfdSlice(){
  disposeObj(CFD.slice); CFD.slice=null; if(!S.cfd.viz.plano || !CFD.field) return;
  const sp=slicePlane(), v=S.cfd.var, cv=document.createElement("canvas"); cv.width=sp.nu; cv.height=sp.nv; const g=cv.getContext("2d"), img=g.createImageData(sp.nu,sp.nv);
  const vals=new Float32Array(sp.nu*sp.nv); const [ra,rb]=cfdRange(v), stepIso=(rb-ra)/12 || 1;
  for(let j=0;j<sp.nv;j++) for(let i=0;i<sp.nu;i++){ const [x,y,z]=sp.P((i+0.5)/sp.nu,(j+0.5)/sp.nv); vals[j*sp.nu+i]= cfdSolidExact(x,y,z)? NaN : cfdValue(v,x,y,z) }
  const dark=S.cfd.fundo!=="claro";
  for(let j=0;j<sp.nv;j++) for(let i=0;i<sp.nu;i++){ const k=j*sp.nu+i, o=k*4, val=vals[k]; if(isNaN(val)){ img.data[o+3]=0; continue }
    const c=cfdColor(v, val); let iso=false; if(v!=="lawson"){ const b0=Math.floor((val-ra)/stepIso); if(i+1<sp.nu && !isNaN(vals[k+1]) && Math.floor((vals[k+1]-ra)/stepIso)!==b0) iso=true; if(j+1<sp.nv && !isNaN(vals[k+sp.nu]) && Math.floor((vals[k+sp.nu]-ra)/stepIso)!==b0) iso=true }
    const f= iso? (dark? 0.72 : 0.84) : 1, tint = iso? (dark? 235 : 30) : 0;
    img.data[o]=c[0]*f+tint*(1-f); img.data[o+1]=c[1]*f+tint*(1-f); img.data[o+2]=c[2]*f+tint*(1-f); img.data[o+3]=Math.round(255*S.cfd.planoOpac*(iso?1:0.92)) }
  g.putImageData(img,0,0);
  const tex=new THREE.CanvasTexture(cv); tex.flipY=false; tex.minFilter=THREE.LinearFilter;
  const geo=new THREE.BufferGeometry(); const c00=sp.P(0,0), c10=sp.P(1,0), c11=sp.P(1,1), c01=sp.P(0,1), V=a=>[a[0],a[2],a[1]];
  geo.setAttribute("position",new THREE.Float32BufferAttribute([...V(c00),...V(c10),...V(c11),...V(c00),...V(c11),...V(c01)],3));
  geo.setAttribute("uv",new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,0,1,1,0,1],2));
  CFD.slice=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide,depthWrite:false})); CFD.slice.renderOrder=2; CFD.grp.add(CFD.slice);
}
/* ---------- setas ---------- */
let ARROW_GEO=null;
function arrowGeo(){ if(ARROW_GEO) return ARROW_GEO; const sh=new THREE.CylinderGeometry(0.06,0.06,0.62,6); sh.translate(0,0.31,0); const hd=new THREE.ConeGeometry(0.2,0.38,8); hd.translate(0,0.81,0);
  const merge=(a,b)=>{ const g=new THREE.BufferGeometry(); const A=a.toNonIndexed(), B=b.toNonIndexed(); ["position","normal"].forEach(k=>{ g.setAttribute(k,new THREE.Float32BufferAttribute([...A.attributes[k].array,...B.attributes[k].array],3)) }); return g };
  ARROW_GEO=merge(sh,hd); return ARROW_GEO }
function cfdArrows(){
  disposeObj(CFD.arrows); CFD.arrows=null; if(!S.cfd.viz.setas || !CFD.field) return;
  const d=CFD.dom, sp=slicePlane(), dens=S.cfd.setasDens, step=d.dx*2.2/dens, U=S.clima.ventoVel;
  const Lu = sp.orient==="t"? d.y1-d.y0 : d.x1-d.x0, Lv = sp.orient==="h"? d.y1-d.y0 : d.ztop;
  const nrm = sp.orient==="h"? new THREE.Vector3(0,1,0) : sp.orient==="l"? new THREE.Vector3(0,0,1) : new THREE.Vector3(1,0,0);
  const pos=[], col=[]; let n=0;
  for(let v=step/2; v<Lv && n<9000; v+=step) for(let u=step/2; u<Lu && n<9000; u+=step){
    const [x,y,z]=sp.P(u/Lu, v/Lv); if(cfdSolidExact(x,y,z)) continue;
    const vv=cfdVel(x,y,z, S.cfd.var==="media"&&!!CFD.field.mean); let dir=new THREE.Vector3(vv[0],vv[2],vv[1]); dir.addScaledVector(nrm,-dir.dot(nrm)); const m_=dir.length(); if(m_<U*0.02) continue; dir.divideScalar(m_);
    const L=step*Math.min(0.95,0.3+0.55*m_/U), P=LV(x,y,z), a=P.clone().addScaledVector(dir,-L/2), tip=P.clone().addScaledVector(dir,L/2), side=new THREE.Vector3().crossVectors(dir,nrm).normalize();
    const h=L*0.32, b1=tip.clone().addScaledVector(dir,-h).addScaledVector(side,h*0.55), b2=tip.clone().addScaledVector(dir,-h).addScaledVector(side,-h*0.55);
    pos.push(a.x,a.y+0.02,a.z, tip.x,tip.y+0.02,tip.z, tip.x,tip.y+0.02,tip.z, b1.x,b1.y+0.02,b1.z, tip.x,tip.y+0.02,tip.z, b2.x,b2.y+0.02,b2.z);
    const c=cfdColor(["cp","lawson","ti","vort"].includes(S.cfd.var)? "vel" : S.cfd.var, S.cfd.var==="w"? vv[2] : Math.hypot(...vv)).map(q=>q/255), w=[1,1,1].map((q,i)=>c[i]*0.35+0.65*(S.cfd.fundo!=="claro"?1:0.15));
    for(let k=0;k<6;k++) col.push(...(k<2? c : c)); n++;
  }
  const g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)); g.setAttribute("color",new THREE.Float32BufferAttribute(col,3));
  const ls=new THREE.LineSegments(g,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0.95,depthWrite:false})); ls.renderOrder=3; CFD.arrows=ls; CFD.grp.add(ls);
}
/* ---------- linhas de corrente ---------- */
function streamline(x,y,z, dir){
  const d=CFD.dom, pts=[[x,y,z,0]], ds=d.dx*0.45, U=S.clima.ventoVel, useMean=S.cfd.linhasMedia && !!CFD.field.mean; let L=0, tof=0;
  for(let s=0;s<900;s++){
    const v1=cfdVel(x,y,z,useMean), m1=Math.hypot(...v1); if(m1<U*0.01) break;
    const h=ds/m1*dir, xm=x+v1[0]*h/2, ym=y+v1[1]*h/2, zm=z+v1[2]*h/2; const v2=cfdVel(xm,ym,zm,useMean), m2=Math.hypot(...v2); if(m2<U*0.01) break;
    const h2=ds/m2*dir; x+=v2[0]*h2; y+=v2[1]*h2; z+=v2[2]*h2; if(z<0.3) z=0.3; tof+=ds/m2*dir;
    if(!cfdInside(x,y,z) || cfdSolid(x,y,z)) break; pts.push([x,y,z,tof]); L+=ds; if(L>3*(d.x1-d.x0)) break;
  }
  return pts;
}
function cfdSeeds(){
  const d=CFD.dom, c=S.cfd, out=[];
  if(c.semente){ const [X,Y,Zs]=c.semente, x=X*d.f[0]+Y*d.f[1], y=X*d.pp[0]+Y*d.pp[1]; const n=Math.max(6,Math.round(c.linhasN/2));
    for(let i=0;i<n;i++){ const z=0.8+(Math.max(Zs,d.Hmax*0.9))*i/(n-1); out.push([x,y,z,0]) } return out }
  const ny=Math.max(3,Math.round(Math.sqrt(c.linhasN*2.2))), nz=Math.max(2,Math.round(c.linhasN/ny));
  const yA=d.by0-(d.by1-d.by0)*0.15, yB=d.by1+(d.by1-d.by0)*0.15, zA=Math.max(0.8,c.linhasAlt[0]*d.Hmax), zB=Math.max(zA+1,c.linhasAlt[1]*d.Hmax), x=d.x0+d.dx*1.5;
  for(let k=0;k<nz;k++) for(let j=0;j<ny;j++) out.push([x, yA+(yB-yA)*(j+0.5)/ny, zA+(zB-zA)*(nz===1?0.5:k/(nz-1)), 1]);
  return out;
}
const SL_VS=`attribute vec3 acol; attribute float tof; varying vec3 vC; varying float vT; varying float vD; void main(){ vC=acol; vT=tof; vec4 mv=modelViewMatrix*vec4(position,1.0); vD=-mv.z; gl_Position=projectionMatrix*mv; }`;
const SL_FS=`uniform float uTime; uniform float uPeriod; uniform float uBase; uniform float uGlow; varying vec3 vC; varying float vT; varying float vD; void main(){ float ph=fract((vT-uTime)/uPeriod); float head=smoothstep(0.0,0.04,ph)*(1.0-smoothstep(0.04,0.55,ph)); float a=uBase+uGlow*head; gl_FragColor=vec4(mix(vC,vec3(1.0),head*0.35), a); }`;
function cfdLines(){
  disposeObj(CFD.lines); CFD.lines=null; if(!S.cfd.viz.linhas || !CFD.field) return;
  const seeds=cfdSeeds(), grp=new THREE.Group(), v=S.cfd.var, cv= v==="cp"||v==="lawson"? "vel" : v; const tube=S.cfd.tubos, r=CFD.dom.dx*0.05*S.cfd.espessura;
  const allP=[], allC=[], allI=[]; let base=0; const lp=[], lc=[], lt=[];
  seeds.forEach(([x,y,z,mode])=>{
    let pts;
    if(mode) pts=streamline(x,y,z,1);
    else { const back=streamline(x,y,z,-1).reverse(), t0=back.length? back[0][3] : 0; pts=[...back.map(p=>[p[0],p[1],p[2],p[3]-t0]), ...streamline(x,y,z,1).slice(1).map(p=>[p[0],p[1],p[2],p[3]-t0])] }
    if(pts.length<3) return;
    const cols=pts.map(p=>cfdColor(cv, cv==="w"? cfdVel(p[0],p[1],p[2], !!CFD.field.mean)[2] : cfdValue(cv,p[0],p[1],p[2])).map(c=>c/255));
    const phase=Math.random()*20;
    if(!tube){ for(let i=1;i<pts.length;i++){ lp.push(pts[i-1][0],pts[i-1][2],pts[i-1][1], pts[i][0],pts[i][2],pts[i][1]); lc.push(...cols[i-1],...cols[i]); lt.push(pts[i-1][3]+phase, pts[i][3]+phase) } return }
    const sides=6;
    for(let i=0;i<pts.length;i++){
      const a=pts[Math.max(0,i-1)], b=pts[Math.min(pts.length-1,i+1)]; const t=new THREE.Vector3(b[0]-a[0],b[2]-a[2],b[1]-a[1]).normalize();
      let nrm=new THREE.Vector3(0,1,0); if(Math.abs(t.y)>0.9) nrm.set(1,0,0); const bn=new THREE.Vector3().crossVectors(t,nrm).normalize(); nrm.crossVectors(bn,t).normalize();
      const taper=Math.min(1, i/6, (pts.length-1-i)/6)*0.8+0.2;
      for(let s_=0;s_<sides;s_++){ const ang=s_/sides*Math.PI*2, ca=Math.cos(ang)*r*taper, sa=Math.sin(ang)*r*taper; allP.push(pts[i][0]+nrm.x*ca+bn.x*sa, pts[i][2]+nrm.y*ca+bn.y*sa, pts[i][1]+nrm.z*ca+bn.z*sa); allC.push(...cols[i]) }
      if(i>0) for(let s_=0;s_<sides;s_++){ const s2=(s_+1)%sides, p0=base+(i-1)*sides+s_, p1=base+(i-1)*sides+s2, p2=base+i*sides+s_, p3=base+i*sides+s2; allI.push(p0,p2,p1, p1,p2,p3) }
    }
    base+=pts.length*sides;
  });
  const dark=S.cfd.fundo!=="claro";
  if(tube && allP.length){ const g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(allP,3)); g.setAttribute("color",new THREE.Float32BufferAttribute(allC,3)); g.setIndex(allI); g.computeVertexNormals(); grp.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.35, metalness:0.1}))) }
  if(!tube && lp.length){ const g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(lp,3)); g.setAttribute("acol",new THREE.Float32BufferAttribute(lc,3)); g.setAttribute("tof",new THREE.Float32BufferAttribute(lt,1));
    CFD.slMat=new THREE.ShaderMaterial({vertexShader:SL_VS, fragmentShader:SL_FS, transparent:true, depthWrite:false, blending: dark? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms:{uTime:{value:0}, uPeriod:{value: Math.max(2,(CFD.dom.x1-CFD.dom.x0)/S.clima.ventoVel/4)}, uBase:{value: dark? 0.22 : 0.35}, uGlow:{value: dark? 0.95 : 0.75}}});
    const ls=new THREE.LineSegments(g,CFD.slMat); ls.frustumCulled=false; ls.renderOrder=4; grp.add(ls) } else CFD.slMat=null;
  CFD.lines=grp; CFD.grp.add(grp); CFD.lastLines=performance.now();
}
/* ---------- partículas e fumaça ---------- */
const PT_VS=`attribute float size; attribute float alpha; attribute vec3 acol; varying vec3 vC; varying float vA; void main(){ vC=acol; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*(320.0/-mv.z); gl_Position=projectionMatrix*mv; }`;
const PT_FS=`varying vec3 vC; varying float vA; void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d); if(r>0.5) discard; float a=vA*pow(smoothstep(0.5,0.0,r),1.6); gl_FragColor=vec4(vC*(0.85+0.3*(0.5-r)),a); }`;
function cfdParticlesInit(){
  disposeObj(CFD.pts); disposeObj(CFD.trails); CFD.pts=null; CFD.trails=null; CFD.parts=null;
  const on=S.cfd.viz.particulas||S.cfd.viz.fumaca; if(!on || !CFD.dom) return;
  const n=S.cfd.viz.fumaca && !S.cfd.viz.particulas? S.cfd.fumacaN : S.cfd.partN;
  const P={n, x:new Float32Array(n), y:new Float32Array(n), z:new Float32Array(n), age:new Float32Array(n), life:new Float32Array(n), smoke:new Uint8Array(n)};
  for(let i=0;i<n;i++){ cfdSpawn(P,i); P.age[i]=Math.random()*P.life[i] }
  const g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.BufferAttribute(new Float32Array(3*n),3)); g.setAttribute("acol",new THREE.BufferAttribute(new Float32Array(3*n),3)); g.setAttribute("size",new THREE.BufferAttribute(new Float32Array(n),1)); g.setAttribute("alpha",new THREE.BufferAttribute(new Float32Array(n),1));
  CFD.pts=new THREE.Points(g,new THREE.ShaderMaterial({vertexShader:PT_VS,fragmentShader:PT_FS,transparent:true,depthWrite:false,blending: S.cfd.fundo!=="claro" && !S.cfd.viz.fumaca? THREE.AdditiveBlending : THREE.NormalBlending})); CFD.pts.frustumCulled=false; CFD.pts.renderOrder=3; CFD.grp.add(CFD.pts);
  if(S.cfd.rastro){ const tg=new THREE.BufferGeometry(); tg.setAttribute("position",new THREE.BufferAttribute(new Float32Array(6*n),3)); tg.setAttribute("color",new THREE.BufferAttribute(new Float32Array(6*n),3)); CFD.trails=new THREE.LineSegments(tg,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0.8,blending: S.cfd.fundo!=="claro"? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite:false})); CFD.trails.frustumCulled=false; CFD.grp.add(CFD.trails) }
  CFD.parts=P;
}
function cfdEmitTop(){ const d=CFD.dom; return Math.min(d.ztop*0.85, d.Hmax*1.25) }
function cfdEmitter(){ const d=CFD.dom, e=S.cfd.emissor; if(e){ return [e[0]*d.f[0]+e[1]*d.f[1], e[0]*d.pp[0]+e[1]*d.pp[1], e[2]] } return [d.bx0-d.Hmax*0.6, (d.by0+d.by1)/2, Math.min(d.Hmax*0.5, 12)] }
function cfdSpawn(P,i){
  const d=CFD.dom, c=S.cfd; const smoke = c.viz.fumaca && (!c.viz.particulas || Math.random()<0.35);
  P.smoke[i]=smoke?1:0; P.age[i]=0;
  if(smoke){ const [ex,ey,ez]=cfdEmitter(), r=d.dx*0.5, tipo=c.emissorTipo||"linha", top=cfdEmitTop();
    if(tipo==="ponto"){ P.x[i]=ex+(Math.random()-0.5)*r; P.y[i]=ey+(Math.random()-0.5)*r; P.z[i]=Math.max(0.3,ez+(Math.random()-0.5)*r) }
    else if(tipo==="linha"){ P.x[i]=ex+(Math.random()-0.5)*r; P.y[i]=ey+(Math.random()-0.5)*r; P.z[i]=0.4+Math.random()*(top-0.4) }
    else { const w=(d.by1-d.by0)*1.3, yc=(d.by0+d.by1)/2; P.x[i]=(c.emissor? ex : d.bx0-d.Hmax*0.5)+(Math.random()-0.5)*r; P.y[i]=yc+(Math.random()-0.5)*w; P.z[i]=0.4+Math.random()*(top-0.4) }
    P.life[i]=10+Math.random()*12 }
  else { P.x[i]=d.x0+d.dx*(0.5+Math.random()*2); P.y[i]=d.by0-(d.by1-d.by0)*0.25+Math.random()*(d.by1-d.by0)*1.5; P.z[i]=0.5+Math.pow(Math.random(),1.6)*d.Hmax*1.4; P.life[i]=14+Math.random()*16 }
}
function cfdParticlesStep(dt){
  const P=CFD.parts; if(!P||!CFD.field) return; const d=CFD.dom, c=S.cfd, U=S.clima.ventoVel, k=dt*c.animVel, v=c.var;
  const pa=CFD.pts.geometry.attributes, pos=pa.position.array, col=pa.acol.array, sz=pa.size.array, al=pa.alpha.array;
  const tr=CFD.trails? CFD.trails.geometry.attributes : null;
  for(let i=0;i<P.n;i++){
    let x=P.x[i], y=P.y[i], z=P.z[i]; const vv=cfdVel(x,y,z); let sp=Math.hypot(...vv);
    x+=vv[0]*k; y+=vv[1]*k; z+=vv[2]*k;
    if(P.smoke[i]){ const turb=(CFD.field.rms? tri(CFD.field.rms,...cfdIdx(x,y,z))*cfdScale() : U*0.15)*0.9+U*0.04; const j=turb*Math.sqrt(k); x+=(Math.random()-0.5)*j; y+=(Math.random()-0.5)*j; z+=(Math.random()-0.5)*j }
    P.age[i]+=k; if(z<0.2) z=0.2;
    if(!cfdInside(x,y,z) || cfdSolid(x,y,z) || P.age[i]>P.life[i]){ cfdSpawn(P,i); x=P.x[i]; y=P.y[i]; z=P.z[i]; sp=U }
    P.x[i]=x; P.y[i]=y; P.z[i]=z;
    pos[3*i]=x; pos[3*i+1]=z; pos[3*i+2]=y;
    const t=P.age[i]/P.life[i];
    let cc;
    if(P.smoke[i] && !c.fumacaCor){ const g_= c.fundo!=="claro"? 0.92-0.25*t : 0.40+0.36*t; cc=[g_*255,g_*262>255?255:g_*262,g_*270>255?255:g_*270] } else cc=cfdColor(v==="cp"||v==="lawson"||v==="ti"||v==="vort"||v==="media"? "vel":v, v==="w"? vv[2] : sp);
    col[3*i]=cc[0]/255; col[3*i+1]=cc[1]/255; col[3*i+2]=cc[2]/255;
    if(P.smoke[i]){ sz[i]=(1.0+t*4.5)*Math.max(1.2,d.dx*0.8)*c.partTam; al[i]=0.34*(1-t)*(t<0.05? t/0.05:1) } else { sz[i]=0.45*c.partTam*Math.max(0.6,d.dx*0.5); al[i]=0.9*Math.min(1,(1-t)*4)*Math.min(1,P.age[i]*3) }
    if(tr){ const L= P.smoke[i]? 0 : c.rastroLen; const tp=tr.position.array, tc=tr.color.array; tp[6*i]=x; tp[6*i+1]=z; tp[6*i+2]=y; tp[6*i+3]=x-vv[0]*L; tp[6*i+4]=z-vv[2]*L; tp[6*i+5]=y-vv[1]*L; for(let q=0;q<3;q++){ tc[6*i+q]=col[3*i+q]; tc[6*i+3+q]=col[3*i+q]*0.3 } }
  }
  pa.position.needsUpdate=true; pa.acol.needsUpdate=true; pa.size.needsUpdate=true; pa.alpha.needsUpdate=true;
  if(tr){ tr.position.needsUpdate=true; tr.color.needsUpdate=true }
}
/* ---------- atualização ---------- */
function cfdRefresh(all){
  if(!CFD.dom || !V3.R) return;
  cfdSlice(); cfdArrows(); cfdColorBuildings();
  if(all || performance.now()-CFD.lastLines>2500) cfdLines();
  if(all) cfdParticlesInit();
  cfdLegend(); render3();
}
function cfdOnField(){ if(VIEW!=="v3d" || !cfdNoTunel()) return;
  // com quadros muito lentos (3D por software), não redesenha a cada campo novo: deixa a página respirar entre um e outro
  const agora=performance.now(); if(CFD.quadro>120 && agora-(CFD.ultRef||0) < 3*CFD.quadro){ cfdStatus(); return } CFD.ultRef=agora;
  cfdRefresh(false); cfdStatus(); if(CFD.probe) cfdProbeAt(CFD.probe.pt) }
function cfdLoop(){
  if(VIEW!=="v3d"){ CFD.raf=null; return }
  if(!cfdNoTunel()){ CFD.raf=null; cfdStop(); return }   // saiu da sub-aba do túnel com o palco ainda nele: pausa e volta ao 3D comum
  const now=performance.now(), bruto=now-(CFD.t||now), quadro=bruto-(CFD.esp||0), dt=Math.min(0.05,bruto/1000); CFD.t=now; CFD.esp=0; if(bruto>0) CFD.quadro=quadro;
  let draw=false; if(CFD.parts){ cfdParticlesStep(dt); draw=true }
  if(CFD.slMat){ CFD.slMat.uniforms.uTime.value+=dt*S.cfd.animVel; draw=true }
  if(draw) render3();
  // quadro muito lento (3D por software, máquina carregada): espera 1,5× o tempo dele antes do próximo, para a página seguir respondendo
  if(draw && quadro>120){ const tk={}, esp=Math.min(10000, 1.5*quadro); CFD.raf=tk; CFD.esp=esp; setTimeout(()=>{ if(CFD.raf===tk) CFD.raf=requestAnimationFrame(cfdLoop) }, esp) }
  else CFD.raf=requestAnimationFrame(cfdLoop);
}
function cfdBuildings(){ // prédio com o mesmo render do 3D (materiais, pavimentos, sombras)
  const corte=S.corte; S.corte=""; rebuild3d(window._last.m,true); S.corte=corte; V3.grp.visible=true;
  const dark=S.cfd.fundo!=="claro"; stageBackdrop(dark); V3.scene.fog=null;
  V3.grp.children.forEach(o=>{ if(o.isMesh && o.geometry && o.geometry.type==="CircleGeometry") o.visible=!dark; if(o.isGridHelper) o.visible=!dark;
    if(S.cfd.vidro && o.isMesh && o.geometry && o.geometry.type==="ExtrudeGeometry"){ o.material.transparent=true; o.material.opacity=Math.min(o.material.opacity,0.32); o.material.depthWrite=false; o.castShadow=false } });
  V3.sun.castShadow=!S.cfd.vidro; render3();
}
function cfdEnter(){
  if(!V3.R) return; V3.clip=[]; if(V3.sunGrp) V3.sunGrp.visible=false;
  const dark=S.cfd.fundo!=="claro"; V3.R.toneMappingExposure= dark? 1.0 : 0.92; cfdBuildings();
  const m=window._last.m, d=cfdDomain(S,m);
  if(!CFD.dom || CFD.sig!==d.sig){ cfdStart(true) } else { cfdGroup(); if(!CFD.bld) cfdBuildStatic(); CFD.grp.visible=true; cfdRefresh(true); cfdFit() }
  if(CFD.grp) CFD.grp.visible=true;
  document.getElementById("cfdBar").hidden=false; document.getElementById("cfdLegend").hidden=false;
  cfdBarUI(); cfdStatus(); if(!CFD.raf){ CFD.t=0; CFD.esp=0; CFD.raf=requestAnimationFrame(cfdLoop) }
}
function cfdLeave(){ if(V3.R) V3.R.toneMappingExposure=0.92; if(CFD.grp) CFD.grp.visible=false; if(V3.grp) V3.grp.visible=true; if(CFD.raf){ cancelAnimationFrame(CFD.raf); CFD.raf=null } document.getElementById("cfdBar").hidden=true; document.getElementById("cfdLegend").hidden=true; document.getElementById("cfdProbe").hidden=true; document.getElementById("cfdProbe").dataset.k=""; if(CFD.running) cfdPause(); applySun() }
/* o túnel só roda com a sub-aba Vento › Túnel 3D na tela (Projeto, ou a etapa Clima enquanto ela existir). Trocar de etapa
   ou de sub-aba sem trocar a vista (ex.: Entrega, que não pede vista) deixava a simulação e a animação rodando e travava a
   página; cfdLoop confere a cada quadro e chama cfdStop, que pausa o Worker, para a animação e devolve o palco ao 3D comum. */
function cfdNoTunel(){
  if(typeof TAB==="undefined" || typeof CSUB==="undefined") return true;
  if(typeof emClima==="function" ? !emClima() : TAB!=="clima") return false;
  if(TAB==="projeto" && typeof PSUB!=="undefined" && PSUB!=="vento") return false;
  return CSUB==="v3d";
}
function cfdStop(){
  if(VIEW==="v3d"){ setView("3d"); return }   // setView → cfdLeave (pausa, esconde a barra e a legenda)
  if(CFD.raf){ cancelAnimationFrame(CFD.raf); CFD.raf=null }
  if(CFD.running) cfdPause();
}
function cfdStatus(msg){
  const el=document.getElementById("cfdStat"), el2=document.getElementById("cfdStat2"); const F=CFD.field, d=CFD.dom;
  const txt = msg || (!F? "Preparando a malha…" : `${CFD.running?"Simulando":"Pausado"} · passo ${nf(F.step,0)} · ${F.navg>2? "médias com "+nf(F.navg,0)+" amostras" : pct(Math.min(1,F.step/(1.2*d.nx/0.085)),0)+" até o regime"} · ${d.nx}×${d.ny}×${d.nz} células de ${nf(d.dx,1)} m`);
  if(el) el.textContent=txt; if(el2) el2.textContent=txt;
  const pb=document.querySelector('#tabbody [data-act="cfdPlay"]'), lb=CFD.running?"Pausar":"Simular"; if(pb && pb.textContent!==lb) pb.textContent=lb;   // o painel acompanha o estado real
}
function cfdLegend(){
  const el=document.getElementById("cfdLegend"); if(!el) return; const v=S.cfd.var, [a,b]=cfdRange(v);
  const unit = v==="vel"||v==="media"||v==="w"? " m/s" : v==="vort"? " 1/s" : v==="ti"? "" : "";
  if(v==="lawson"){ el.innerHTML=`<b>${CFD_VARS[v]}</b>`+LAWSON.map((l,i)=>`<div class="lw"><i style="background:rgb(${l[1]})"></i>${i===0?"&lt; 2":i===4?"&gt; 8":(LAWSON[i-1][0])+"–"+l[0]} m/s · ${l[2]}</div>`).join("")+`<div class="lnote">velocidade média a ${nf(S.cfd.plano.h,1)} m</div>`; return }
  const stops=v==="w"||v==="cp"? DIVERG : TURBO;
  el.innerHTML=`<b>${CFD_VARS[v]}</b><div class="cbar" style="background:linear-gradient(90deg,${stops.map(s=>`rgb(${s[1]}) ${s[0]*100}%`).join(",")})"></div><div class="cl"><span>${nf(a,v==="ti"||v==="cp"?1:1)}${unit}</span><span>${nf((a+b)/2,1)}</span><span>${nf(b,1)}${unit}</span></div>${v==="ti"?'<div class="lnote">desvio da velocidade ÷ vento de referência</div>':v==="cp"?'<div class="lnote">+ pressão (barlavento) · − sucção</div>':""}`;
}
/* ---------- sonda ---------- */
const RAY=new THREE.Raycaster();
function cfdPick(px,py){
  if(!CFD.grp||!CFD.field) return; const r=document.getElementById("c3d").getBoundingClientRect();
  RAY.setFromCamera(new THREE.Vector2((px/r.width)*2-1, -(py/r.height)*2+1), V3.cam);
  const objs=[CFD.slice, CFD.bld, CFD.ground].filter(Boolean); const hit=RAY.intersectObjects(objs,false)[0]; if(!hit) return;
  const inv=new THREE.Matrix4().copy(CFD.grp.matrix).invert(); const p=hit.point.clone().applyMatrix4(inv);
  let pt=[p.x, p.z, Math.max(0.5,p.y)];
  if(hit.object===CFD.bld && hit.face){ const n=hit.face.normal; pt=[pt[0]+n.x*CFD.dom.dx*0.9, pt[1]+n.z*CFD.dom.dx*0.9, Math.max(0.5,pt[2]+n.y*CFD.dom.dx*0.9)] }
  if(hit.object===CFD.ground) pt[2]=1.5;
  cfdProbeAt(pt);
}
function cfdProbeAt(pt){
  CFD.probe={pt}; const [x,y,z]=pt, F=CFD.field, U=S.clima.ventoVel, v=cfdVel(x,y,z), vm=F.mean? cfdVel(x,y,z,true) : null;
  const sp=Math.hypot(...v), smean=vm? Math.hypot(...vm) : null, cp=cfdValue("cp",x,y,z), ti=F.rms? cfdValue("ti",x,y,z) : null;
  const d=CFD.dom, wx=v[0]*d.f[0]+v[1]*d.pp[0], wy=v[0]*d.f[1]+v[1]*d.pp[1]; const th=(S.lote.norte||0)*Math.PI/180, north=[Math.sin(th),Math.cos(th)], east=[Math.cos(th),-Math.sin(th)];
  const az=(Math.atan2(wx*east[0]+wy*east[1], wx*north[0]+wy*north[1])*180/Math.PI+360)%360, rosa=["N","NE","L","SE","S","SO","O","NO"][Math.round(az/45)%8];
  const lw = smean!=null? LAWSON.find(l=>smean<l[0]) : null;
  /* a sonda é atualizada a cada campo novo enquanto simula: o esqueleto (botões) só é refeito quando o ponto muda,
     senão o clique em "Soltar fumaça aqui" se perdia porque o botão era recriado no meio do clique */
  const el=document.getElementById("cfdProbe"); el.hidden=false; const key=pt.map(q=>q.toFixed(2)).join(",");
  const tab=`<tr><td>Velocidade agora</td><td>${nf(sp,1)} m/s (${nf(sp/U,2)}×)</td></tr>${smean!=null?`<tr><td>Velocidade média</td><td>${nf(smean,1)} m/s</td></tr>`:""}
    <tr><td>Indo para</td><td>${rosa} · ${nf(az,0)}°</td></tr><tr><td>Componente vertical</td><td>${nf(v[2],2)} m/s</td></tr>
    ${ti!=null?`<tr><td>Turbulência</td><td>${pct(ti,0)}</td></tr>`:""}<tr><td>Pressão (Cp)</td><td>${nf(cp,2)}</td></tr>${lw?`<tr><td>Conforto (Lawson aprox.)</td><td>${lw[2]}</td></tr>`:""}`;
  if(el.dataset.k===key && el.querySelector(".tbl")){ const t=el.querySelector(".tbl"); if(t.innerHTML!==tab) t.innerHTML=tab; return }
  el.dataset.k=key;
  el.innerHTML=`<div class="hd"><b>Sonda · ${nf(z,1)} m de altura</b><button class="btn sm" id="pbX" aria-label="Fechar a sonda" title="Fechar">×</button></div>
    <table class="tbl">${tab}</table>
    <div class="row" style="margin:6px 0 0"><button class="btn sm" id="pbSmoke">Soltar fumaça aqui</button><button class="btn sm" id="pbSeed">Linhas a partir daqui</button></div>`;
  const toW=()=>[x*d.f[0]+y*d.pp[0], x*d.f[1]+y*d.pp[1], z];
  document.getElementById("pbX").onclick=()=>{ el.hidden=true; el.dataset.k=""; CFD.probe=null; disposeObj(CFD.probeMk); CFD.probeMk=null; render3() };
  document.getElementById("pbSmoke").onclick=()=>{ S.cfd.emissor=toW(); S.cfd.viz.fumaca=true; save(); cfdParticlesInit(); cfdBarUI(); if(emClima()) renderTab(); toast("Fumaça solta neste ponto") };
  document.getElementById("pbSeed").onclick=()=>{ S.cfd.semente=toW(); S.cfd.viz.linhas=true; save(); cfdLines(); cfdBarUI(); render3(); if(emClima()) renderTab(); toast("Linhas de corrente passando por este ponto") };
  disposeObj(CFD.probeMk); const mk=new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.4,d.dx*0.35),12,10), new THREE.MeshBasicMaterial({color:0x111111})); mk.position.copy(LV(x,y,z)); CFD.probeMk=mk; CFD.grp.add(mk); render3();
}
/* ---------- barra flutuante ---------- */
const CFD_VIZ=[["linhas","Linhas"],["particulas","Partículas"],["fumaca","Fumaça"],["setas","Setas"],["plano","Plano de cor"],["pressao","Pressão nas fachadas"]];
function cfdBarUI(){
  const bar=document.getElementById("cfdBar"); if(!bar) return;
  bar.innerHTML=`<div class="row" style="margin:0;gap:6px;flex-wrap:nowrap"><button class="btn sm ${CFD.running?"":"pri"}" id="cfPlay">${CFD.running?"Pausar":"Simular"}</button><button class="btn sm" id="cfReset" title="Recomeçar a simulação">Reiniciar</button>
    <select id="cfVar" aria-label="Colorir por">${Object.entries(CFD_VARS).map(([k,l])=>`<option value="${k}" ${S.cfd.var===k?"selected":""}>${l}</option>`).join("")}</select>
    <span class="cfchips">${CFD_VIZ.filter(([k])=>S.cfd.viz[k]).map(([k,l])=>`<span class="pill">${l}</span>`).join("")}</span></div>
    <div class="cfstat" id="cfdStat"></div>`;
  document.getElementById("cfPlay").onclick=()=>{ CFD.running? cfdPause() : (CFD.worker? cfdRun() : cfdStart()); if(emClima()) renderTab() };
  document.getElementById("cfReset").onclick=()=>{ cfdStart(true) };
  document.getElementById("cfVar").onchange=e=>{ S.cfd.var=e.target.value; if(S.cfd.var==="lawson"){ S.cfd.viz.plano=true; S.cfd.plano.orient="h"; S.cfd.plano.h=1.5 } save(); cfdRefresh(true); cfdBarUI(); if(emClima()) renderTab() };
  cfdStatus();
}
