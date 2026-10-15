/* ================= contexto urbano (interface): desenho 2D e 3D das camadas do OpenStreetMap =================
   Cálculo puro em src/calc/contexto.js (S.contexto.dados). Aqui:
   - 2D (HOOK.draw2dBase, por baixo do lote): mar, praia, água, verde, estacionamentos, praças, calçadas, vias (com nomes de perto)
   - 3D (HOOK.draw3d): chão em camadas mescladas (água levemente reflexiva, asfalto, calçadas com meio-fio, areia, gramado) que
     somem suavemente na borda, e as edificações de S.entorno mescladas por tipo (casas com telhado de duas águas)
   - ctx3dAssume(k,m): o núcleo (view3d.js) deixa de desenhar a rua genérica ("ruas") e os prismas cinzas ("predios")
   - camadas ligáveis (chips) na seção Entorno: ctxCamadasHTML() entra em mapaEntornoHTML (src/ui/mapa.js)
   As camadas só mudam o desenho: as edificações continuam valendo para sol e vento; água, vias e verde não fazem sombra. */
const CTX = { cores:null, coresK:"", bb:new WeakMap(), lbl:new WeakMap(), g3:null, g3k:"", e3:null, e3k:"", env:null, envK:"" };
const ctxDados = () => { const d=S.contexto && S.contexto.dados; return d && Array.isArray(d.vias) ? d : null };
const ctxCam = k => !(S.contexto && S.contexto.camadas && S.contexto.camadas[k]===false);
function ctxEntVisivel(e){ return e && e.tipo==="casa" ? ctxCam("casas") : ctxCam("predios") }
const CTX_TOK = ["--ctx-mar","--ctx-agua","--ctx-agua-l","--ctx-areia","--ctx-verde","--ctx-mata","--ctx-asf","--ctx-asf-l","--ctx-cal","--ctx-ciclo","--ctx-estac","--ctx-praca",
  "--ctx-casa","--ctx-telha","--ctx-res","--ctx-com","--ctx-out","--ctx3-asf","--ctx3-cal","--ctx3-agua","--ctx3-mar","--ctx3-areia","--ctx3-verde","--ctx3-mata","--ctx3-estac","--ctx3-praca",
  "--ink","--ink-2","--surface","--surface-2","--m-viz","--stage-a","--stage-b"];
/* cores do tema (lidas uma vez por tema: getComputedStyle é caro dentro do laço) */
function ctxCores(){ const k=(document.documentElement.dataset.theme||"")+(matchMedia("(prefers-color-scheme: dark)").matches?"d":"l")+css("--surface");
  if(CTX.coresK!==k){ CTX.coresK=k; CTX.cores={}; CTX_TOK.forEach(t=>CTX.cores[t]=css(t)) } return CTX.cores }
const CTX_COR_ENT = { casa:"--ctx-casa", residencial:"--ctx-res", comercial:"--ctx-com", outro:"--ctx-out" };
function ctxCorEnt(e){ const k=e && CTX_COR_ENT[e.tipo]; return k? ctxCores()[k] : null }
function ctxItemBB(it){ let b=CTX.bb.get(it); if(!b){ let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity; it.p.forEach(q=>{ if(q[0]<x0)x0=q[0]; if(q[0]>x1)x1=q[0]; if(q[1]<y0)y0=q[1]; if(q[1]>y1)y1=q[1] }); const w=(it.w||0)/2; b=[x0-w,y0-w,x1+w,y1+w]; CTX.bb.set(it,b) } return b }

/* ---------- 2D ---------- */
HOOK.draw2dBase.push((g, c)=>{
  const d=ctxDados(); if(!d) return;
  const {V,W,H,mode,opt}=c, C=ctxCores(), s=V.s, X=q=>q[0]*s+V.ox, Y=q=>-q[1]*s+V.oy;
  const m0=60/s, a=[(-V.ox)/s-m0, (V.oy-H)/s-m0, (W-V.ox)/s+m0, V.oy/s+m0];   // janela em metros
  const ve=it=>{ const b=ctxItemBB(it); return b[2]>=a[0] && b[0]<=a[2] && b[3]>=a[1] && b[1]<=a[3] };
  g.save();
  if(mode==="impl" && typeof BG!=="undefined" && BG && opt.bg!==false) g.globalAlpha=0.5;     // imagem calibrada por baixo: contexto mais leve
  if(mode==="clima") g.globalAlpha=0.75;
  const polys=(lista, cor, linha, filtro)=>{ if(!lista || !lista.length) return; g.beginPath(); let n=0;
    lista.forEach(it=>{ if(filtro && !filtro(it)) return; if(!ve(it)) return; n++; it.p.forEach((q,i)=>{ i? g.lineTo(X(q),Y(q)) : g.moveTo(X(q),Y(q)) }); g.closePath() });
    if(!n) return; g.fillStyle=cor; g.fill(); if(linha){ g.strokeStyle=linha; g.lineWidth=1; g.stroke() } };
  const linhas=(lista, cor, o={})=>{ if(!lista || !lista.length) return; const grupos=new Map();
    lista.forEach(it=>{ if(o.filtro && !o.filtro(it)) return; if(!ve(it)) return; const w=Math.max(o.min||0.8, (it.w*(o.k!=null? o.k : 1)+(o.mais||0))*s + (o.px||0)), k=Math.round(w*2)/2; let p=grupos.get(k); if(!p) grupos.set(k, p=[]); p.push(it) });
    g.strokeStyle=cor; g.lineCap=o.cap||"round"; g.lineJoin="round"; if(o.dash) g.setLineDash(o.dash);
    grupos.forEach((l,w)=>{ g.lineWidth=w; g.beginPath(); l.forEach(it=>it.p.forEach((q,i)=>{ i? g.lineTo(X(q),Y(q)) : g.moveTo(X(q),Y(q)) })); g.stroke() });
    g.setLineDash([]) };
  if(ctxCam("agua")){ polys(d.mar, C["--ctx-mar"], C["--ctx-agua-l"]); polys(d.areia, C["--ctx-areia"]); polys(d.agua, C["--ctx-agua"], C["--ctx-agua-l"]); linhas(d.rios, C["--ctx-agua"], {min:1.2}) }
  if(ctxCam("verde")){ polys(d.verde, C["--ctx-verde"], null, it=>it.k!=="mata"); polys(d.verde, C["--ctx-mata"], null, it=>it.k==="mata") }
  if(ctxCam("ruas")) polys(d.estac, C["--ctx-estac"]);
  if(ctxCam("calcadas")){ polys(d.pracas, C["--ctx-praca"]); linhas(d.calcadas, C["--ctx-cal"], {cap:"butt", filtro:it=>it.k!=="cam"}); linhas(d.calcadas, C["--ctx-cal"], {filtro:it=>it.k==="cam", min:1}) }
  if(ctxCam("ruas")){
    linhas(d.vias, C["--ctx-asf-l"], {px:1.6, min:1.6});      // bordas primeiro, depois o asfalto: os cruzamentos ficam limpos
    linhas(d.vias, C["--ctx-asf"], {min:1});
    linhas(d.ciclovias, C["--ctx-ciclo"], {min:1});
    if(s>5.5){ g.globalAlpha*=0.55; linhas(d.vias, C["--surface"], {k:0, px:Math.max(1, s*0.12), dash:[s*3, s*3], cap:"butt", filtro:it=>!it.um && it.w>=6}); g.globalAlpha/=0.55 }
    if(s>1.25) ctxNomes(g, d.vias, s, X, Y, ve, C);
  }
  g.restore();
});
/* nomes das ruas ao longo do maior trecho reto de cada via, sem repetir o mesmo nome perto */
function ctxNomes(g, vias, s, X, Y, ve, C){
  const fs=Math.round(Math.max(9.5, Math.min(12, 8.5+s*0.25))), postos=[];
  g.font=`500 ${fs}px ${css("--f-body")||"sans-serif"}`; g.textAlign="center"; g.textBaseline="middle"; g.lineJoin="round";
  let n=0;
  vias.forEach(v=>{ if(!v.n || n>80 || !ve(v)) return;
    let L=CTX.lbl.get(v); if(!L){ let best=null, bl=0; for(let i=1;i<v.p.length;i++){ const a=v.p[i-1], b=v.p[i], l=Math.hypot(b[0]-a[0], b[1]-a[1]); if(l>bl){ bl=l; best=[a,b] } } L={seg:best, len:bl}; CTX.lbl.set(v,L) }
    if(!L.seg) return; const tw=g.measureText(v.n).width; if(L.len*s < tw+28) return;
    const [a,b]=L.seg, mx=(X(a)+X(b))/2, my=(Y(a)+Y(b))/2;
    if(mx<-50 || my<-20 || mx>g.canvas.width+50 || my>g.canvas.height+20) return;
    if(postos.some(p=>p.n===v.n ? Math.hypot(p.x-mx,p.y-my)<260 : Math.hypot(p.x-mx,p.y-my)<tw*0.6)) return;
    let ang=Math.atan2(Y(b)-Y(a), X(b)-X(a)); if(ang>Math.PI/2) ang-=Math.PI; if(ang<-Math.PI/2) ang+=Math.PI;
    g.save(); g.translate(mx,my); g.rotate(ang); g.lineWidth=3; g.strokeStyle=C["--ctx-asf"]; g.strokeText(v.n,0,0.5); g.fillStyle=C["--ink-2"]; g.fillText(v.n,0,0.5); g.restore();
    postos.push({n:v.n, x:mx, y:my}); n++ });
}

/* ---------- 3D ---------- */
function ctx3dAssume(k, m){
  if(typeof THREE==="undefined" || !m || m.topo) return false;          // com topografia, o núcleo e o relevo cuidam do entorno
  if(k==="predios") return true;
  if(k==="ruas"){ const d=ctxDados(); return !!(d && d.vias.length) }
  return false;
}
/* contas de geometria (arrays crus, cacheados); a cada rebuild só viram BufferGeometry */
function ctxTri(p, holes){ const V2=q=>new THREE.Vector2(q[0],q[1]); try{ return THREE.ShapeUtils.triangulateShape(p.map(V2), (holes||[]).map(h=>h.map(V2))) }catch(e){ return [] } }
function ctxPlano(lista, y){                     // polígonos planos → posições (x, y, −y)
  const pos=[];
  lista.forEach(p=>{ if(p.length<3) return; const t=ctxTri(p);
    t.forEach(([i,j,k])=>{ const A=p[i], B=p[j], C_=p[k], cw=((B[0]-A[0])*(C_[1]-A[1])-(B[1]-A[1])*(C_[0]-A[0]))<0, P=cw? [A,C_,B] : [A,B,C_]; P.forEach(q=>pos.push(q[0], y, -q[1])) }) });
  return pos;
}
function ctxFaixas(lista, y, meioFio, dentro){  // linhas com largura → faixas; meio-fio = laterais de y−meioFio até y
  const pos=[], lat=[];
  lista.forEach(it=>{ if(it.p.length<2) return; const f=ctxFaixaLR(it.p, it.w), L=f.L, R=f.R;
    for(let i=0;i<L.length-1;i++){
      if(dentro){ const mx=(it.p[i][0]+it.p[i+1][0])/2, my=(it.p[i][1]+it.p[i+1][1])/2; if(dentro([mx,my])) continue }
      const a=L[i], b=L[i+1], c=R[i+1], e=R[i];
      [[a,e,c],[a,c,b]].forEach(tr=>{ const cw=((tr[1][0]-tr[0][0])*(tr[2][1]-tr[0][1])-(tr[1][1]-tr[0][1])*(tr[2][0]-tr[0][0]))<0, P=cw? [tr[0],tr[2],tr[1]] : tr; P.forEach(q=>pos.push(q[0], y, -q[1])) });
      if(meioFio) [[a,b],[c,e]].forEach(([p,q])=>{ const y0=y-meioFio; lat.push(p[0],y0,-p[1], q[0],y0,-q[1], q[0],y,-q[1],  p[0],y0,-p[1], q[0],y,-q[1], p[0],y,-p[1]) });
    } });
  return {pos, lat};
}
function ctxClipR(lista, R, tipo){ const circ=ctxCirculo(R, 64), o=[];
  (lista||[]).forEach(it=>{ if(tipo==="poly"){ const p=ctxClipConvexo(it.p, circ); if(p.length>2) o.push(Object.assign({}, it, {p})) }
    else ctxClipLinha(it.p, R).forEach(t=>o.push(Object.assign({}, it, {p:t.pts}))) });
  return o;
}
/* camadas do chão (cache por dados, camadas visíveis, lote e raio de corte) */
function ctxChao(d, Rf){
  const L=S.lote.pts, cam=S.contexto.camadas, k=[d.quando, JSON.stringify(d.n), JSON.stringify(cam), Rf.toFixed(0), JSON.stringify(L)].join("|");
  if(CTX.g3k===k && CTX.g3) return CTX.g3;
  const dentroLote=q=>L.length>2 && G.pip(q, L), cam_=x=>cam[x]!==false, o={};
  const pl=(lista,y,f)=>ctxPlano(ctxClipR(f? lista.filter(f) : lista, Rf, "poly").map(it=>it.p), y);
  if(cam_("agua")){ o.mar=pl(d.mar,-0.066); o.areia=pl(d.areia,-0.062); o.agua=pl(d.agua,-0.05).concat(ctxFaixas(ctxClipR(d.rios,Rf),-0.05).pos) }
  if(cam_("verde")){ o.verde=pl(d.verde,-0.058,it=>it.k!=="mata"); o.mata=pl(d.verde,-0.056,it=>it.k==="mata") }
  if(cam_("ruas")){ o.estac=pl(d.estac,-0.046); o.asf=ctxFaixas(ctxClipR(d.vias,Rf),-0.03).pos; o.ciclo=ctxFaixas(ctxClipR(d.ciclovias,Rf),-0.024).pos }
  if(cam_("calcadas")){ o.praca=pl(d.pracas,-0.04); const cal=ctxFaixas(ctxClipR(d.calcadas.filter(x=>x.k!=="cam"),Rf), 0.12, 0.15, dentroLote); o.cal=cal.pos; o.meio=cal.lat; o.cam=ctxFaixas(ctxClipR(d.calcadas.filter(x=>x.k==="cam"),Rf),-0.02).pos }
  CTX.g3k=k; CTX.g3=o; return o;
}
/* edificações mescladas por tipo; casas quase retangulares ganham telhado de duas águas */
function ctxPredios3d(){
  const L=S.entorno||[], k=[L.length, ctxHash(JSON.stringify(L)), ctxCam("casas"), ctxCam("predios")].join("|");
  if(CTX.e3k===k && CTX.e3) return CTX.e3;
  const grupos={}, linhas=[], gp=t=>grupos[t]||(grupos[t]={pos:[], nor:[]});
  const tri=(gr, A, B, C_, n)=>{ gr.pos.push(...A, ...B, ...C_); gr.nor.push(...n, ...n, ...n) };
  const nrm=(A,B,C_)=>{ const u=[B[0]-A[0],B[1]-A[1],B[2]-A[2]], v=[C_[0]-A[0],C_[1]-A[1],C_[2]-A[2]], n=[u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]], l=Math.hypot(...n)||1; return [n[0]/l,n[1]/l,n[2]/l] };
  const P3=(q,z)=>[q[0], z, -q[1]];
  const paredes=(gr, ring, z0, z1)=>{ for(let i=0;i<ring.length;i++){ const a=ring[i], b=ring[(i+1)%ring.length], A0=P3(a,z0), B0=P3(b,z0), B1=P3(b,z1), A1=P3(a,z1), n=nrm(A0,B0,B1); tri(gr,A0,B0,B1,n); tri(gr,A0,B1,A1,n) } };
  const contorno=(ring, z1)=>{ for(let i=0;i<ring.length;i++){ const a=ring[i], b=ring[(i+1)%ring.length], z=ring[(i-1+ring.length)%ring.length];
      linhas.push(...P3(a,z1), ...P3(b,z1));
      const u=[a[0]-z[0],a[1]-z[1]], v=[b[0]-a[0],b[1]-a[1]], c=(u[0]*v[0]+u[1]*v[1])/((Math.hypot(...u)*Math.hypot(...v))||1); if(c<0.92) linhas.push(...P3(a,0), ...P3(a,z1)) } };
  const tampa=(gr, ring, holes, z)=>{ ctxTri(ring, holes).forEach(([i,j,k_])=>{ const all=[...ring, ...holes.flat()], A=all[i], B=all[j], C_=all[k_];
      const cw=((B[0]-A[0])*(C_[1]-A[1])-(B[1]-A[1])*(C_[0]-A[0]))<0; tri(gr, P3(A,z), cw? P3(C_,z) : P3(B,z), cw? P3(B,z) : P3(C_,z), [0,1,0]) }) };
  L.forEach(e=>{ if(!e.pts || e.pts.length<3 || !(e.h>0) || !ctxEntVisivel(e)) return;
    const t=CTX_COR_ENT[e.tipo]? e.tipo : "gen", ring=ctxSArea(e.pts)>0? e.pts : e.pts.slice().reverse(), vz=entVazios(e).map(v=>ctxSArea(v)<0? v : v.slice().reverse()), h=+e.h;
    const tel = t==="casa" && !vz.length ? ctxTelhado(ring, h) : null;
    const zt = tel? tel.zp : h, gr=gp(t);
    paredes(gr, ring, 0, zt); vz.forEach(v=>paredes(gr, v, 0, zt)); contorno(ring, zt); vz.forEach(v=>contorno(v, zt));
    if(tel){ const gt=gp("telha"); tel.agua.forEach(q=>{ const n=nrm(q[0],q[1],q[2]); tri(gt,q[0],q[1],q[2],n); tri(gt,q[0],q[2],q[3],n) }); tel.oitao.forEach(q=>tri(gr,q[0],q[1],q[2],nrm(q[0],q[1],q[2]))); linhas.push(...tel.linhas); tampa(gr, ring, [], zt-0.02) }
    else tampa(gr, ring, vz, h);
  });
  CTX.e3k=k; CTX.e3={grupos, linhas}; return CTX.e3;
}
function ctxHash(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619) } return (h>>>0).toString(36) }
/* telhado de duas águas sobre o retângulo orientado pelo lado maior (beiral de 0,35 m); null se a planta não é quase retangular */
function ctxTelhado(ring, h){
  if(ring.length>10) return null;
  let La=0, ang=0; ring.forEach((q,i)=>{ const b=ring[(i+1)%ring.length], l=Math.hypot(b[0]-q[0],b[1]-q[1]); if(l>La){ La=l; ang=Math.atan2(b[1]-q[1], b[0]-q[0]) } });
  const u=[Math.cos(ang),Math.sin(ang)], v=[-u[1],u[0]], pu=q=>q[0]*u[0]+q[1]*u[1], pv=q=>q[0]*v[0]+q[1]*v[1];
  const us=ring.map(pu), vs=ring.map(pv), u0=Math.min(...us), u1=Math.max(...us), v0=Math.min(...vs), v1=Math.max(...vs), Lu=u1-u0, Lv=v1-v0;
  if(Lu<3 || Lv<3 || Math.abs(ctxSArea(ring))/(Lu*Lv)<0.82) return null;
  const rise=Math.min(h*0.42, Lv/2*0.5), zp=h-rise, sl=rise/(Lv/2), o=0.35, vc=(v0+v1)/2, zb=zp-o*sl;
  const W=(a,b,z)=>[a*u[0]+b*v[0], z, -(a*u[1]+b*v[1])];
  const E1a=W(u0-o,v0-o,zb), E1b=W(u1+o,v0-o,zb), E2a=W(u0-o,v1+o,zb), E2b=W(u1+o,v1+o,zb), Ra=W(u0-o,vc,h), Rb=W(u1+o,vc,h);
  const agua=[[E1a,E1b,Rb,Ra],[E2b,E2a,Ra,Rb]];
  const oitao=[[W(u0,v1,zp),W(u0,v0,zp),W(u0,vc,h)],[W(u1,v0,zp),W(u1,v1,zp),W(u1,vc,h)]];
  const linhas=[...Ra,...Rb, ...E1a,...E1b, ...E2a,...E2b, ...E1a,...Ra, ...E1b,...Rb, ...E2a,...Ra, ...E2b,...Rb];
  return {zp, agua, oitao, linhas};
}
/* reflexo discreto do céu na água (PMREM de um degradê) */
function ctxEnv(C){
  const k=C["--stage-a"]+C["--stage-b"]; if(CTX.env && CTX.envK===k) return CTX.env;
  try{ const cv=document.createElement("canvas"); cv.width=64; cv.height=32; const g=cv.getContext("2d"), gr=g.createLinearGradient(0,0,0,32);
    const dark=/^#[0-3]/.test(C["--stage-b"]); gr.addColorStop(0, dark? "#2a2e35" : "#d3dde6"); gr.addColorStop(0.48, C["--stage-a"]); gr.addColorStop(0.52, C["--stage-b"]); gr.addColorStop(1, C["--stage-b"]); g.fillStyle=gr; g.fillRect(0,0,64,32);
    const tx=new THREE.CanvasTexture(cv); tx.mapping=THREE.EquirectangularReflectionMapping; tx.encoding=THREE.sRGBEncoding;
    const pm=new THREE.PMREMGenerator(V3.R); const rt=pm.fromEquirectangular(tx); pm.dispose(); tx.dispose();
    if(CTX.env && CTX.env.dispose) CTX.env.dispose(); CTX.env=rt.texture; CTX.envK=k }catch(e){ CTX.env=null }
  return CTX.env;
}
/* chão que some suavemente na borda (alfa pela distância ao centro) */
function ctxFade(mat, c, R){
  mat.transparent=true;
  mat.onBeforeCompile=sh=>{ sh.uniforms.ctxC={value:new THREE.Vector2(c[0], -c[1])}; sh.uniforms.ctxR={value:R};
    sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\nvarying vec3 vCtxW;").replace("#include <begin_vertex>","#include <begin_vertex>\nvCtxW=(modelMatrix*vec4(transformed,1.0)).xyz;");
    sh.fragmentShader=sh.fragmentShader.replace("#include <common>","#include <common>\nvarying vec3 vCtxW; uniform vec2 ctxC; uniform float ctxR;").replace("#include <dithering_fragment>","#include <dithering_fragment>\ngl_FragColor.a*=1.0-smoothstep(ctxR*0.82, ctxR, distance(vCtxW.xz, ctxC));") };
  return mat;
}
HOOK.draw3d.push((grp, m)=>{
  if(!ctx3dAssume("predios", m)) return;
  const C=ctxCores(), col=t=>new THREE.Color(C[t]||"#999").convertSRGBToLinear(), t0=performance.now();
  const d=ctxDados();
  if(d){
    const Rf=Math.max(60, Math.min(d.raio||350, V3.ext*2.15)), o=ctxChao(d, Rf);
    grp.children.forEach(x=>{ if(x.type==="GridHelper") x.visible=false });     // a grade some sob o contexto
    const ord=[["mar","--ctx3-mar",1],["areia","--ctx3-areia",2],["verde","--ctx3-verde",3],["mata","--ctx3-mata",3],["agua","--ctx3-agua",4],["estac","--ctx3-estac",5],["praca","--ctx3-praca",5],["asf","--ctx3-asf",6],["ciclo","--ctx-ciclo",7],["cam","--ctx3-cal",7],["cal","--ctx3-cal",8],["meio","--ctx3-cal",8]];
    ord.forEach(([k,tok,z])=>{ const pos=o[k]; if(!pos || !pos.length) return;
      const g=new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos,3)); g.computeVertexNormals();
      const agua = k==="mar"||k==="agua";
      const mat=new THREE.MeshStandardMaterial({color:col(tok), roughness: agua? 0.16 : k==="asf"? 0.92 : 0.95, metalness: agua? 0.05 : 0, side:THREE.DoubleSide, polygonOffset:true, polygonOffsetFactor:-z, polygonOffsetUnits:-z*2});
      if(agua){ const env=ctxEnv(C); if(env){ mat.envMap=env; mat.envMapIntensity=0.55 } }
      const mesh=new THREE.Mesh(g, ctxFade(mat, [0,0], Rf)); mesh.receiveShadow=true; mesh.renderOrder=-1; grp.add(mesh) });
  }
  // edificações (S.entorno) por tipo
  const E=ctxPredios3d(), corT={casa:"--ctx-casa", telha:"--ctx-telha", residencial:"--ctx-res", comercial:"--ctx-com", outro:"--ctx-out", gen:"--m-viz"};
  Object.entries(E.grupos).forEach(([t,gr])=>{ if(!gr.pos.length) return;
    const g=new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(gr.pos,3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(gr.nor,3));
    const mesh=new THREE.Mesh(g, new THREE.MeshStandardMaterial({color:col(corT[t]), roughness: t==="comercial"? 0.62 : t==="telha"? 0.8 : 0.9, metalness:0, side:THREE.DoubleSide}));
    mesh.castShadow=true; mesh.receiveShadow=true; grp.add(mesh) });
  if(E.linhas.length){ const g=new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(E.linhas,3));
    grp.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({color:col("--ink"), transparent:true, opacity:0.2}))) }
  CTX.t3=performance.now()-t0;
});

/* ---------- camadas ligáveis (seção Entorno → OpenStreetMap) ---------- */
function ctxConta(){
  const d=ctxDados(), ent=(S.entorno||[]).filter(e=>e.pts && e.pts.length>2), n=d? d.n||{} : {};
  return { ruas:(n.vias||0)+(n.estac||0)+(n.ciclovias||0), calcadas:(n.calcadas||0)+(n.pracas||0), agua:(n.agua||0)+(n.rios||0)+(n.mar||0)+(n.areia||0), verde:n.verde||0,
    casas:ent.filter(e=>e.tipo==="casa").length, predios:ent.filter(e=>e.tipo && e.tipo!=="casa").length };
}
const CTX_ROT = [["ruas","Ruas"],["calcadas","Calçadas"],["agua","Água"],["verde","Verde"],["casas","Casas"],["predios","Prédios"]];
function ctxResumo(){ const d=ctxDados(); if(!d) return ""; const n=d.n||{}, p=[];
  if(n.vias) p.push(`${n.vias} trechos de via`); const ag=[n.mar?"mar":"", n.areia?"praia":"", n.agua? (n.agua>1? n.agua+" lagos":"lago") : "", n.rios? "rio":""].filter(Boolean); if(ag.length) p.push(ag.join(", "));
  if(n.verde) p.push(`${n.verde} áreas verdes`); return p.join(" · ") + ` · raio ${nf(d.raio||0,0)} m` + (d.nivel? " (reduzido)":"") + (d.quando? ` · busca de ${ctxQuandoBR(d.quando)}` : ""); }
function ctxCamadasHTML(){
  const c=ctxConta(), tem=CTX_ROT.filter(([k])=>c[k]>0);
  if(!ctxDados() && !tem.length) return "";
  return `<div class="chips" id="ctxChips" role="group" aria-label="Camadas do entorno" style="margin-top:8px">${tem.map(([k,r])=>`<button type="button" class="chip" data-act="ctxCam" data-k="${k}" aria-pressed="${ctxCam(k)}" title="Mostrar ou esconder: ${r.toLowerCase()}">${r}</button>`).join("")}</div>
    ${ctxDados()? `<p class="note" id="ctxRes">${esc(ctxResumo())}</p>` : ""}
    <div class="row" style="flex-wrap:wrap;align-items:center;gap:8px">${ctxDados()||(S.entorno||[]).some(e=>e.osm)? `<button class="btn sm ghost" data-act="ctxApaga" title="Tira ruas, água, verde e as edificações do OSM (as desenhadas à mão ficam)">Apagar contexto</button>` : ""}
      <span class="note" style="margin:0 0 0 auto;white-space:nowrap">Raio das ruas e água</span><div class="inp" style="width:92px;flex:none"><input type="number" step="50" min="100" max="1000" data-p="contexto.raio" data-min="100" data-max="1000" data-fx="save" value="${S.contexto.raio}" aria-label="Raio do contexto (ruas, água, verde) em metros" title="Raio do contexto: ruas, água e verde"><em>m</em></div>${INFO("Ruas, calçadas, ciclovias, rios, lagos, mar, praia, verde, praças e estacionamentos do OpenStreetMap, no raio ao lado (as edificações usam o raio da busca de prédios). Os chips só ligam e desligam o desenho na implantação e no 3D: as edificações continuam valendo para sol e vento; água, ruas e verde não fazem sombra. Com a topografia ligada, o 3D mostra só as edificações.")}</div>`;
}
Object.assign(ACT,{
  ctxCam: b=>{ const k=b.dataset.k; S.contexto.camadas[k]=!ctxCam(k); b.setAttribute("aria-pressed", ctxCam(k)); save(); redraw2d(); if(window._last && typeof rebuild3d==="function") rebuild3d(window._last.m) },
  ctxApaga: b=>{ if(!b.dataset.arm){ b.dataset.arm=1; b.textContent="Confirmar"; b.classList.add("on"); return }
    S.contexto.dados=null; S.entorno=(S.entorno||[]).filter(e=>!e.osm); if(typeof ENT!=="undefined") ENT.sel=new Set(); update(); renderTab(); toast("Contexto do OSM apagado (Ctrl+Z desfaz)") },
});
