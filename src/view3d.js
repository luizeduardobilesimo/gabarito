/* ================= 3D ================= */
const V3 = { R:null, scene:null, cam:null, ctl:null, grp:null, sun:null, hemi:null, ext:60, clip:[] };
function init3d(){
  const c3=document.getElementById("c3d");
  if(typeof THREE==="undefined"){ c3.hidden=true; return false }
  V3.R=new THREE.WebGLRenderer({canvas:c3,antialias:true,preserveDrawingBuffer:true}); V3.R.setPixelRatio(Math.min(2,devicePixelRatio||1));
  V3.R.shadowMap.enabled=true; V3.R.shadowMap.type=THREE.PCFSoftShadowMap; V3.R.localClippingEnabled=true;
  V3.R.outputEncoding=THREE.sRGBEncoding; V3.R.toneMapping=THREE.ACESFilmicToneMapping; V3.R.toneMappingExposure=0.92;
  V3.scene=new THREE.Scene(); V3.cam=new THREE.PerspectiveCamera(36,1,0.5,6000);
  V3.ctl=new THREE.OrbitControls(V3.cam,c3); V3.ctl.enableDamping=true; V3.ctl.dampingFactor=0.08; V3.ctl.maxPolarAngle=Math.PI*0.495; V3.ctl.addEventListener("change",render3);
  V3.hemi=new THREE.HemisphereLight(0xeaf2f7,0x9d978c,0.75); V3.scene.add(V3.hemi);
  V3.sun=new THREE.DirectionalLight(0xfff4e6,1.15); V3.sun.position.set(-60,120,80); V3.scene.add(V3.sun); V3.scene.add(V3.sun.target);
  V3.sun.shadow.mapSize.set(2048,2048); V3.sun.shadow.bias=-0.0004; V3.sun.shadow.normalBias=0.02; V3.sun.shadow.radius=4;
  V3.fill=new THREE.DirectionalLight(0xcfe2ff,0.35); V3.fill.position.set(80,60,-60); V3.scene.add(V3.fill);
  V3.grp=new THREE.Group(); V3.scene.add(V3.grp);
  (function loop(){ requestAnimationFrame(loop); if(V3.ctl && V3.ctl.update()) render3() })();
  return true;
}
const col3 = n => new THREE.Color(css(n)||"#999");
function gradTex(a,b){ const c=document.createElement("canvas"); c.width=4; c.height=256; const g=c.getContext("2d"), gr=g.createLinearGradient(0,0,0,256); gr.addColorStop(0,a); gr.addColorStop(1,b); g.fillStyle=gr; g.fillRect(0,0,4,256); const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; return t }
function fadeTex(col){ const c=document.createElement("canvas"); c.width=c.height=256; const g=c.getContext("2d"), gr=g.createRadialGradient(128,128,10,128,128,128); gr.addColorStop(0,col); gr.addColorStop(0.55,col); gr.addColorStop(1,"rgba(0,0,0,0)"); g.fillStyle=gr; g.fillRect(0,0,256,256); return new THREE.CanvasTexture(c) }
function stageBackdrop(dark){
  const a = dark? "#1b2730" : css("--stage-a"), b = dark? "#0b1115" : css("--stage-b");
  if(V3.bgKey!==a+b){ if(V3.scene.background&&V3.scene.background.dispose) V3.scene.background.dispose(); V3.scene.background=gradTex(a,b); V3.bgKey=a+b }
  V3.scene.fog=new THREE.Fog(new THREE.Color(b), V3.ext*2.2, V3.ext*7);
}
function render3(){ if(V3.R) V3.R.render(V3.scene,V3.cam) }
function size3d(){ if(!V3.R) return; const c3=document.getElementById("c3d"), r=c3.getBoundingClientRect(); if(!r.width) return; V3.R.setSize(r.width,r.height,false); V3.cam.aspect=r.width/r.height; V3.cam.updateProjectionMatrix(); render3() }
function fit3d(m){ if(!V3.R) return; const L=S.lote.pts, c=G.centroid(L); m=m||(window._last&&window._last.m); const span=Math.max(...L.map(q=>Math.hypot(q[0]-c[0],q[1]-c[1]))); const h=m? m.H:30;
  let d=Math.max(span*2.6, h*1.6, 40); const r=document.getElementById("c3d").getBoundingClientRect(); if(r.width&&r.height) d*=Math.max(1, r.height/r.width*1.15);
  V3.ctl.target.set(c[0], h*0.35, -c[1]); V3.cam.position.set(c[0]+d*0.75, h*0.55+d*0.6, -c[1]+d*0.85); V3.ctl.update(); render3() }
// posição solar (aprox. NOAA simplificada) → vetor no referencial do desenho
function sunVector(hora){ const v=sunVectorAt(S.sol.mes, S.sol.dia, hora??S.sol.hora); const lat=S.lote.lat*Math.PI/180; return v }
function shapeOf(p, holes){ const s=new THREE.Shape(); p.forEach((q,i)=> i? s.lineTo(q[0],q[1]) : s.moveTo(q[0],q[1])); s.closePath();
  (holes||[]).forEach(h=>{ const pa=new THREE.Path(); h.forEach((q,i)=> i? pa.lineTo(q[0],q[1]) : pa.moveTo(q[0],q[1])); pa.closePath(); s.holes.push(pa) }); return s }
function slab(p, y0, h, color, o={}){
  if(!p || !p.length || h<=0) return;
  const g=new THREE.ExtrudeGeometry(shapeOf(p,o.holes),{depth:h,bevelEnabled:false}); g.rotateX(-Math.PI/2); g.translate(0,y0,0);
  const mat=new THREE.MeshStandardMaterial({color, roughness:o.rough??0.86, metalness:o.metal??0, transparent:!!o.op, opacity:o.op||1, clippingPlanes:o.noclip?[]:V3.clip, depthWrite:!(o.op&&o.op<0.6), emissive:o.emissive||0x000000});
  const mesh=new THREE.Mesh(g,mat); mesh.castShadow=!o.op||o.op>0.7; mesh.receiveShadow=true; V3.grp.add(mesh);
  if(o.eop!==0){ const e=new THREE.LineSegments(new THREE.EdgesGeometry(g,25), new THREE.LineBasicMaterial({color:o.edge||col3("--ink"), transparent:true, opacity:o.eop??0.28, clippingPlanes:o.noclip?[]:V3.clip})); V3.grp.add(e) }
  return mesh;
}
function rampa3d(E, X, w, zE, zX, color){
  const d=[X[0]-E[0], X[1]-E[1]], L=Math.hypot(...d)||1, n=[-d[1]/L*w/2, d[0]/L*w/2], t=0.25;
  const P=[[E[0]+n[0],E[1]+n[1],zE],[E[0]-n[0],E[1]-n[1],zE],[X[0]-n[0],X[1]-n[1],zX],[X[0]+n[0],X[1]+n[1],zX]];
  const v=[]; P.forEach(q=>v.push(q[0],q[2],-q[1])); P.forEach(q=>v.push(q[0],q[2]-t,-q[1]));
  const idx=[0,1,2, 0,2,3, 4,6,5, 4,7,6, 0,4,5, 0,5,1, 1,5,6, 1,6,2, 2,6,7, 2,7,3, 3,7,4, 3,4,0];
  const g=new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(v,3)); g.setIndex(idx); g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color, roughness:0.7, side:THREE.DoubleSide, clippingPlanes:V3.clip})); mesh.castShadow=true; mesh.receiveShadow=true; V3.grp.add(mesh);
  V3.grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(g,20), new THREE.LineBasicMaterial({color:col3("--ink"),transparent:true,opacity:0.5,clippingPlanes:V3.clip})));
}
/* rampa ao longo de um caminho [x,y,t] (t = fração da altura): helicoidal e rampa em L */
function rampaPath3d(path, w, zE, zX, color){
  const n=path.length, t=0.25, v=[], idx=[];
  for(let i=0;i<n;i++){ const a=path[Math.max(0,i-1)], b=path[Math.min(n-1,i+1)], dx=b[0]-a[0], dy=b[1]-a[1], l=Math.hypot(dx,dy)||1;
    let nx=-dy/l, ny=dx/l, k=1;
    if(i>0 && i<n-1){ const p=path[i], u1=[p[0]-a[0],p[1]-a[1]], u2=[b[0]-p[0],b[1]-p[1]], l1=Math.hypot(...u1)||1, l2=Math.hypot(...u2)||1, c=(u1[0]*u2[0]+u1[1]*u2[1])/(l1*l2); k=1/Math.max(0.6,Math.sqrt((1+c)/2)) } // meia-esquadria nos cantos
    const z=zE+(zX-zE)*path[i][2], p=path[i], L=[p[0]+nx*w/2*k, p[1]+ny*w/2*k], R=[p[0]-nx*w/2*k, p[1]-ny*w/2*k];
    v.push(L[0],z,-L[1], R[0],z,-R[1], L[0],z-t,-L[1], R[0],z-t,-R[1]) }
  for(let i=0;i<n-1;i++){ const a=i*4, b=(i+1)*4;
    idx.push(a,a+1,b+1, a,b+1,b,  a+2,b+3,a+3, a+2,b+2,b+3,  a,b,b+2, a,b+2,a+2,  a+1,a+3,b+3, a+1,b+3,b+1) }
  idx.push(0,2,3, 0,3,1); const e=(n-1)*4; idx.push(e,e+1,e+3, e,e+3,e+2);
  const g=new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(v,3)); g.setIndex(idx); g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color, roughness:0.7, side:THREE.DoubleSide, clippingPlanes:V3.clip})); mesh.castShadow=true; mesh.receiveShadow=true; V3.grp.add(mesh);
  V3.grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(g,35), new THREE.LineBasicMaterial({color:col3("--ink"),transparent:true,opacity:0.4,clippingPlanes:V3.clip})));
}
function flat(p, y, color, op=1){ if(!p||!p.length) return; const g=new THREE.ShapeGeometry(shapeOf(p)); g.rotateX(-Math.PI/2); g.translate(0,y,0); const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color,roughness:0.9,transparent:op<1,opacity:op,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2})); mesh.receiveShadow=true; V3.grp.add(mesh);
  const e=new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({color:col3("--ink"),transparent:true,opacity:0.5})); V3.grp.add(e) }
function outline(p, y0, h, color, dashed){
  if(!p || !p.length) return; const pts=[];
  p.forEach((q,i)=>{ const b=p[(i+1)%p.length]; pts.push(new THREE.Vector3(q[0],y0+h,-q[1]), new THREE.Vector3(b[0],y0+h,-b[1])); pts.push(new THREE.Vector3(q[0],y0,-q[1]), new THREE.Vector3(q[0],y0+h,-q[1])) });
  const g=new THREE.BufferGeometry().setFromPoints(pts); const mm= dashed? new THREE.LineDashedMaterial({color,dashSize:1.2,gapSize:0.8,transparent:true,opacity:0.7}) : new THREE.LineBasicMaterial({color});
  const l=new THREE.LineSegments(g,mm); if(dashed) l.computeLineDistances(); V3.grp.add(l);
}
function rebuild3d(m, force){
  if(!V3.R) return;
  if(!force && typeof VIEW!=="undefined" && VIEW!=="3d") { V3.stale=true; return }
  V3.stale=false;
  const grp=V3.grp; while(grp.children.length){ const o=grp.children.pop(); o.geometry&&o.geometry.dispose(); if(o.material){ o.material.map&&o.material.map.dispose(); o.material.dispose() } }
  const P=S.produto, L=S.lote.pts, c=G.centroid(L), ext=Math.max(70, Math.sqrt(m.A)*4); V3.ext=ext;
  stageBackdrop(false);
  // corte por andar
  const fl = S.corte && typeof floorsList==="function" ? floorsList(m).find(f=>f.key===S.corte) : null;
  V3.clip = fl? [new THREE.Plane(new THREE.Vector3(0,-1,0), fl.z0+fl.h-0.25)] : [];
  // chão com desvanecimento
  const gnd=new THREE.Mesh(new THREE.CircleGeometry(ext*2.2,64), new THREE.MeshStandardMaterial({color:col3("--surface"), roughness:1, map:fadeTex("#ffffff"), transparent:true}));
  gnd.rotation.x=-Math.PI/2; gnd.position.set(c[0],-0.08,-c[1]); gnd.receiveShadow=true; grp.add(gnd);
  const grid=new THREE.GridHelper(ext*2.4, Math.round(ext*2.4/5), col3("--line"), col3("--line")); grid.position.set(c[0],-0.05,-c[1]); grid.material.transparent=true; grid.material.opacity=0.35; grp.add(grid);
  // lote com desnível (frente na cota 0)
  const fd=frontDir(S), [fmn,fmx]=G.extent(L,fd), depth=(fmx-fmn)||1, dn=m.topo? 0 : (S.lote.desnivel||0); // com topografia o lote é o platô do térreo (relevo em src/ui/topografia.js)
  { const g=new THREE.ShapeGeometry(shapeOf(L)); g.rotateX(-Math.PI/2); const pos=g.attributes.position; for(let i=0;i<pos.count;i++){ const x=pos.getX(i), y=-pos.getZ(i); pos.setY(i, 0.02 + dn*((x*fd[0]+y*fd[1])-fmn)/depth) } g.computeVertexNormals();
    const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:col3("--m-lote"),roughness:1,side:THREE.DoubleSide})); mesh.receiveShadow=true; grp.add(mesh);
    const lo=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(L.map(q=>new THREE.Vector3(q[0],0.06+dn*((q[0]*fd[0]+q[1]*fd[1])-fmn)/depth,-q[1]))), new THREE.LineBasicMaterial({color:col3("--ink"),transparent:true,opacity:0.6})); grp.add(lo);
    if(Math.abs(dn)>0.05){ const pts=[]; L.forEach((q,i)=>{ const b=L[(i+1)%L.length], hq=dn*((q[0]*fd[0]+q[1]*fd[1])-fmn)/depth, hb=dn*((b[0]*fd[0]+b[1]*fd[1])-fmn)/depth; pts.push(new THREE.Vector3(q[0],hq,-q[1]),new THREE.Vector3(b[0],hb,-b[1]),new THREE.Vector3(q[0],0,-q[1]),new THREE.Vector3(q[0],hq,-q[1])) });
      grp.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({color:col3("--ink")}))) } }
  // rua
  S.lote.front.forEach(i=>{ const a=L[i], b=L[(i+1)%L.length]; if(!a||!b) return; const dx=b[0]-a[0], dy=b[1]-a[1], l=Math.hypot(dx,dy)||1, nx=dy/l, ny=-dx/l, w=12, ex=dx/l*10, ey=dy/l*10;
    slab([[a[0]-ex,a[1]-ey],[b[0]+ex,b[1]+ey],[b[0]+ex+nx*w,b[1]+ey+ny*w],[a[0]-ex+nx*w,a[1]-ey+ny*w]],-0.06,0.04,new THREE.Color(0x5c656b),{eop:0,rough:0.95,noclip:true}) });
  (m.vf&&m.vf.vagas||[]).forEach(v=>flat(v.poly,0.07,col3("--m-loja"),0.8));
  const glass=new THREE.Color(0x9fc3d3), white=col3("--m-tipo");
  for(let k=0;k<P.subsolos;k++) slab(m.sub, -(k+1)*P.peGar, P.peGar-0.2, col3("--m-sub"), {op:0.4, eop:0.25});
  let y=0;
  const TZ=m.ter||{};
  (TZ.hall||[]).forEach(p=>slab(p, y, P.peTerreo-0.2, glass, {op:0.55, rough:0.2, metal:0.1}));
  (TZ.lojas||[]).forEach(p=>slab(p, y, P.peTerreo-0.2, col3("--m-loja"), {op:0.92, rough:0.3}));
  if(TZ.gar&&TZ.gar.length) slab(TZ.gar, y, P.peTerreo-0.2, col3("--m-gar"));
  (TZ.drive||[]).forEach(p=>flat(p, 0.06, new THREE.Color(0x6b737a)));
  y+=P.peTerreo;
  for(let k=0;k<P.garAcima;k++){ slab(m.emb, y, P.peGar-0.2, col3("--m-gar")); y+=P.peGar }
  const y0=y, sacCol=col3("--c-sac"), LZ=m.lzLay||{};
  // lazer sobre a laje do embasamento
  const lzMesh=(list,yb)=>(list||[]).forEach(({poly,item})=>{ if(item.desc){ const agua=/piscina/i.test(item.nome); slab(poly, yb+0.02, agua?0.12:0.06, agua? new THREE.Color(0x5fb3cc) : col3("--lz-deck"), {eop:0.2, rough: agua?0.15:0.8, metal: agua?0.1:0}) } else slab(poly, yb, 3.0, col3("--lz-c"), {op:0.85, eop:0.3, rough:0.4}) });
  lzMesh(LZ.emb, y0);
  m.T.forEach((t,ti)=>{
    let yy=y0; const lay=m.tipo[ti];
    if(ti===0 && m.pavLz){ slab(t.plate, yy, P.pe-0.22, glass, {op:0.6, rough:0.2, metal:0.1, eop:0.3}); lzMesh(LZ.pav, yy+0.02); yy+=P.pe }
    // 2.4: planta de cada andar pela sua faixa (torres escalonadas); o recuo de um andar para o outro vira terraço
    const fxs=t.faixas||[], plateK=k=>{ const f=fxs.find(f=>k+1>=f.de && k+1<=f.ate); return f? f.plate : t.plate }, topP=fxs.length? fxs[fxs.length-1].plate : t.plate;
    for(let k=0;k<t.pav;k++){ const cob = t.hasCob && k===t.pav-1, pk=plateK(k), pPrev=k? plateK(k-1) : null;
      if(pPrev && pPrev!==pk && G.area(pPrev)>G.area(pk)+0.5){ slab(pPrev, yy-0.02, 0.07, col3("--lz-deck"), {eop:0.35, rough:0.8}); outline(pPrev, yy, 1.05, col3("--ink"), false) }
      slab(pk, yy, P.pe-0.22, cob? col3("--m-cob") : white, {eop:0.22, rough:0.75});
      if(lay && !cob && pk===t.plate) lay.units.forEach(u=>{ if(!u.sac||!u.sac.poly.length) return; if(u.sac.tipo==="balanco"){ slab(u.sac.poly, yy, 0.16, white, {eop:0.3}); slab(u.sac.poly, yy+0.16, 1.05, glass, {op:0.3, eop:0.25, rough:0.1}) } else { slab(G.scaleToArea(u.sac.poly,G.area(u.sac.poly)*0.999), yy+0.03, P.pe-0.3, sacCol, {op:0.55, eop:0.2, rough:0.2}) } });
      yy+=P.pe }
    if(t.duplexA>1){ slab(G.scaleToArea(topP,t.duplexA), yy, P.pe-0.22, col3("--m-cob"), {eop:0.22}); yy+=P.pe }
    if(ti===0) lzMesh(LZ.cob, yy);
    if(P.atico && topP.length) slab(G.scaleToArea(topP, (t.Atop??t.A)*0.25), yy, 3, col3("--m-gar"));
  });
  // envelope: extrusão única ou (2.4) pilha de polígonos por cota com recuos progressivos
  if(m.env && m.env.length){ const ce=col3("--m-env"); outline(m.torAll, 0, m.env[0].z0, ce, true); m.env.forEach(e=>{ outline(e.poly, e.z0, e.z1-e.z0, ce, true); outline(e.poly, e.z0, 0.001, ce, true) }) }
  else outline(m.torAll, 0, m.hLim??S.regras.hMax, col3("--m-env"), true);
  if(S.forma && S.forma.on && S.forma.aero && m.hLim>0) flat(L, m.hLim, col3("--warn"), 0.14); // plano de proteção do aeródromo
  // rampas inclinadas entre os pavimentos (cada uma na sua faixa)
  if(m.vert){ const zk=k=> k<0? k*P.peGar : k===0? 0 : P.peTerreo+(k-1)*P.peGar;
    m.vert.segs.forEach(sg=>{ if(sg.elev) return; if(sg.path) rampaPath3d(sg.path, sg.w-0.3, zk(sg.fromK)+0.02, zk(sg.toK)+0.02, col3("--mark")); else rampa3d(sg.E, sg.X, sg.w-0.3, zk(sg.fromK)+0.02, zk(sg.toK)+0.02, col3("--mark")) });
    // helicoidal: pilar central · elevador de carros: poço do fundo ao último pavimento servido
    const zTop=k=> zk(k)+(k===0? P.peTerreo : P.peGar), sH=(m.vert.strips||[]).find(s_=>s_.kind==="H");
    if(sH && sH.hole) slab(sH.hole, zk(-P.subsolos), zTop(P.garAcima)-zk(-P.subsolos)-0.2, col3("--m-gar"), {eop:0.3});
    if(m.vert.elev){ const E_=m.vert.elev; E_.shafts.forEach(p=>slab(p, zk(E_.kMin), zTop(E_.kMax)-zk(E_.kMin)-0.1, col3("--c-elev"), {op:0.55, eop:0.45})) } }
  (S.entorno||[]).forEach(e=>{ if(e.pts&&e.pts.length>2&&e.h>0) slab(e.pts, 0, e.h, col3("--m-viz"), {eop:0.35, noclip:true, rough:0.95, holes:entVazios(e)}) });
  // andar cortado: planta do pavimento sobre a laje
  if(fl) cutFloor(m, fl);
  // mapa de clima sobre o terreno
  if(typeof TAB!=="undefined" && TAB==="clima" && CSUB!=="v3d" && S.clima.overlay3d){
    const kind=S.clima.modo, cv=fieldCanvas(kind);
    if(cv){ const F=fieldFrame(kind), z = kind==="vento"? S.clima.ventoAlt : 0.12;
      const o=F.o, corner=(i,j)=>[(F.fx[0]*(F.cs*i)+F.fy[0]*(F.cs*j)) + (kind==="vento"? (F.fx[0]*o[0]+F.fy[0]*o[1]) : o[0]), (F.fx[1]*(F.cs*i)+F.fy[1]*(F.cs*j)) + (kind==="vento"? (F.fx[1]*o[0]+F.fy[1]*o[1]) : o[1])];
      const c00=corner(0,0), c10=corner(F.nx,0), c11=corner(F.nx,F.ny), c01=corner(0,F.ny);
      const geo=new THREE.BufferGeometry(); const V=a=>[a[0],z,-a[1]];
      geo.setAttribute("position", new THREE.Float32BufferAttribute([...V(c00),...V(c10),...V(c11),...V(c00),...V(c11),...V(c01)],3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute([0,0, 1,0, 1,1, 0,0, 1,1, 0,1],2));
      const tex=new THREE.CanvasTexture(cv); tex.flipY=false; tex.needsUpdate=true; tex.encoding=THREE.sRGBEncoding;
      const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:0.85,side:THREE.DoubleSide,depthWrite:false})); mesh.renderOrder=2; grp.add(mesh) }
  }
  runHooks("draw3d", grp, m);
  applySun(); render3();
}
function cutFloor(m, fl){
  const y=fl.z0+0.04, pal=[1,2,3,4,5].map(i=>col3("--u"+i)), names=[...new Set(S.produto.mix.map(u=>u.nome))];
  const garLay = fl.tipo==="sub"||fl.tipo==="ac"? m.gar&&m.gar[fl.lay] : fl.tipo==="ter"? m.gar&&m.gar.ter : null;
  { const f=m.vert&&m.vert.floors[fl.tipo==="ter"?"ter":fl.lay]; if(f){ f.landings.forEach(p=>flat(p,y+0.006,col3("--c-drive"))) } }
  if(fl.tipo==="ter"){ (m.ter.lojas||[]).forEach(p=>flat(p,y,col3("--m-loja"))); (m.ter.hall||[]).forEach(p=>flat(p,y,col3("--m-ter"))); ((m.lzLay||{}).terreo||[]).forEach(o=>flat(o.poly,y+0.01,col3("--lz-c"))) }
  if(fl.tipo!=="tipo") (m.coreSets||[]).forEach(cs=>{ if(fl.tipo==="pavlaz"||fl.tipo==="roof"){ if(cs.i!==0) return } (cs.lay.coreParts||[]).forEach(cp=>flat(cp.poly,y+0.012,col3("--c-"+cp.kind))) });
  if(garLay){ garLay.vagas.forEach(v=>{ if(v.tipo==="off") return; flat(v.poly,y+0.01, v.tipo==="pcd"? col3("--accent") : v.tipo==="idoso"? col3("--ok") : col3("--m-gar")) }); }
  if(fl.tipo==="tipo") m.T.forEach((t,i)=>{ const l=m.tipo[i]; if(!l||fl.j>=t.tipoFloors) return;
    const fx=(t.faixas||[]).find(f=>fl.j+1>=f.de && fl.j+1<=f.ate), pf=fx && fx.plate!==t.plate ? fx.plate : null; // 2.4: andar recuado → terraço em volta
    if(pf) flat(t.plate,y-0.004,col3("--lz-deck"));
    l.units.forEach(u=>{ const p= pf? G.clipToPoly(u.poly,pf) : u.poly; if(p.length) flat(p,y,u.livre?col3("--c-circ"):pal[names.indexOf(u.nome)%5]) }); l.coreParts.forEach(cp=>flat(cp.poly,y+0.01,col3("--c-"+cp.kind))); flat(l.corridor,y+0.005,col3("--surface")) });
}
function sunPath(){ // trajetória do sol: refeita a cada mudança de data/hora, fora do grupo do prédio
  if(!V3.sunGrp){ V3.sunGrp=new THREE.Group(); V3.scene.add(V3.sunGrp) }
  const G3=V3.sunGrp; while(G3.children.length){ const o=G3.children.pop(); o.geometry&&o.geometry.dispose(); if(o.material){ o.material.map&&o.material.map.dispose(); o.material.dispose() } }
  G3.visible=!!S.sol.on && VIEW==="3d"; if(!G3.visible) return;
  const m=window._last&&window._last.m; if(!m) return;
  const c=G.centroid(S.lote.pts), R=Math.max(40, Math.sqrt(m.A)*1.8), P=v=>new THREE.Vector3(c[0]+v.x*R, v.z*R, -(c[1]+v.y*R));
  const arc=(mes,dia,col,op)=>{ const pts=[]; for(let h=4;h<=20;h+=0.1){ const v=sunVectorAt(mes,dia,h); if(v.alt<0) continue; pts.push(P(v)) } if(pts.length<2) return; G3.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({color:col,transparent:true,opacity:op}))) };
  arc(12,21,new THREE.Color(0xd99a2b),0.3); arc(6,21,new THREE.Color(0x6f8fb3),0.3); arc(3,21,new THREE.Color(0x999999),0.22);
  arc(S.sol.mes,S.sol.dia,col3("--mark"),0.95);
  // marcas de hora no dia escolhido
  for(let h=6;h<=19;h++){ const v=sunVectorAt(S.sol.mes,S.sol.dia,h); if(v.alt<0) continue; const s=new THREE.Mesh(new THREE.SphereGeometry(R*(h%3===0?0.011:0.007),10,8), new THREE.MeshBasicMaterial({color:col3("--mark")})); s.position.copy(P(v)); G3.add(s) }
  // sol na hora escolhida + raio até o terreno
  const v=sunVector();
  if(v.alt>0){ const pos=P(v); const s=new THREE.Mesh(new THREE.SphereGeometry(R*0.03,24,16), new THREE.MeshBasicMaterial({color:0xffd27a})); s.position.copy(pos); G3.add(s);
    const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:fadeTex("rgba(255,210,122,0.9)"),transparent:true,depthWrite:false})); halo.scale.set(R*0.22,R*0.22,1); halo.position.copy(pos); G3.add(halo);
    G3.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([pos,new THREE.Vector3(c[0],0.1,-c[1])]), new THREE.LineDashedMaterial({color:0xd99a2b,dashSize:R*0.03,gapSize:R*0.02,transparent:true,opacity:0.6})).computeLineDistances()) }
  const ring=new THREE.Mesh(new THREE.RingGeometry(R*0.995,R,96), new THREE.MeshBasicMaterial({color:col3("--muted"),transparent:true,opacity:0.35,side:THREE.DoubleSide})); ring.rotation.x=-Math.PI/2; ring.position.set(c[0],0.05,-c[1]); G3.add(ring);
  // pontos cardeais no anel
  const th=(S.lote.norte||0)*Math.PI/180; [["N",0],["L",90],["S",180],["O",270]].forEach(([t,a])=>{ const ang=a*Math.PI/180+th, cv=document.createElement("canvas"); cv.width=cv.height=64; const g=cv.getContext("2d"); g.fillStyle=css("--ink"); g.font="600 34px Archivo, sans-serif"; g.textAlign="center"; g.textBaseline="middle"; g.fillText(t,32,34);
    const tx=new THREE.CanvasTexture(cv), sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tx,transparent:true,depthWrite:false})); sp.scale.set(R*0.07,R*0.07,1); sp.position.set(c[0]+Math.sin(ang)*R*1.06, 0.6, -(c[1]+Math.cos(ang)*R*1.06)); G3.add(sp) });
}
function applySun(){
  if(!V3.R) return; const c=G.centroid(S.lote.pts), ext=V3.ext;
  const sc=V3.sun.shadow.camera; sc.left=-ext; sc.right=ext; sc.top=ext; sc.bottom=-ext; sc.near=1;
  if(S.sol.on){
    const v=sunVector(); const up=v.z>0.02;
    V3.sun.castShadow=up; V3.sun.intensity= up? 1.35 : 0.05; V3.hemi.intensity= up? 0.55 : 0.35; V3.sun.color.set(v.z<0.25? 0xffd6a3 : 0xfff4e6);
    const d=ext*1.5; V3.sun.position.set(c[0]+v.x*d, Math.max(0.05,v.z)*d, -(c[1]+v.y*d)); V3.sun.target.position.set(c[0],0,-c[1]); sc.far=d*3;
  } else { V3.sun.castShadow=true; V3.sun.intensity=1.1; V3.hemi.intensity=0.75; V3.sun.color.set(0xfff4e6); V3.sun.position.set(c[0]-ext*0.9,ext*1.6,-c[1]+ext*1.1); V3.sun.target.position.set(c[0],0,-c[1]); sc.far=ext*6 }
  sc.updateProjectionMatrix(); sunPath(); render3();
}
