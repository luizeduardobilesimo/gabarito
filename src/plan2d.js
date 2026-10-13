/* ================= desenho 2D (planta, garagem, tipo) ================= */
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function fitView(polys, W, H, pad=1.35){
  const pts=polys.flat(); if(!pts.length) return {s:5,ox:W/2,oy:H/2};
  const xs=pts.map(q=>q[0]), ys=pts.map(q=>q[1]); const w=Math.max(...xs)-Math.min(...xs)||10, h=Math.max(...ys)-Math.min(...ys)||10;
  const s=Math.min(W/(w*pad), H/(h*pad)); const cx=(Math.max(...xs)+Math.min(...xs))/2, cy=(Math.max(...ys)+Math.min(...ys))/2;
  return {s, ox:W/2-cx*s, oy:H/2+cy*s};
}
function drawPlan(g, W, H, V, mode, m, opt={}){
  const w2s=([x,y])=>[x*V.s+V.ox, -y*V.s+V.oy], s2w=(px,py)=>[(px-V.ox)/V.s, -(py-V.oy)/V.s];
  const path=p=>{ g.beginPath(); p.forEach((q,i)=>{ const [x,y]=w2s(q); i?g.lineTo(x,y):g.moveTo(x,y) }); g.closePath() };
  const fillP=(p,col,a=1)=>{ if(!p||!p.length) return; path(p); g.globalAlpha=a; g.fillStyle=col; g.fill(); g.globalAlpha=1 };
  const strokeP=(p,col,lw=1,dash)=>{ if(!p||!p.length) return; path(p); g.setLineDash(dash||[]); g.strokeStyle=col; g.lineWidth=lw; g.stroke(); g.setLineDash([]) };
  const label=(t,[x,y],o={})=>{ g.font=(o.w||"500")+" "+(o.size||11)+"px "+css(o.font||"--f-mono"); g.textAlign="center"; g.textBaseline="middle";
    if(o.bg!==false){ const tw=g.measureText(t).width+8; g.fillStyle=css("--surface"); g.globalAlpha=.85; g.fillRect(x-tw/2,y-8,tw,16); g.globalAlpha=1 } g.fillStyle=o.col||css("--ink"); g.fillText(t,x,y) };
  const arrow=(p1,p2,col,lw=2,head=7,both=false)=>{ const A=w2s(p1),B=w2s(p2), ang=Math.atan2(B[1]-A[1],B[0]-A[0]); g.strokeStyle=col; g.fillStyle=col; g.lineWidth=lw; g.setLineDash([]); g.beginPath(); g.moveTo(...A); g.lineTo(...B); g.stroke();
    const hd=(P,a)=>{ g.beginPath(); g.moveTo(P[0],P[1]); g.lineTo(P[0]-head*Math.cos(a-0.45),P[1]-head*Math.sin(a-0.45)); g.lineTo(P[0]-head*Math.cos(a+0.45),P[1]-head*Math.sin(a+0.45)); g.closePath(); g.fill() };
    hd(B,ang); if(both) hd(A,ang+Math.PI) };
  const pathLine=(pts,dir,col)=>{ const A=w2s(pts[0]), B=w2s(pts[1]); g.strokeStyle=col; g.lineWidth=2; g.setLineDash([7,5]); g.beginPath(); g.moveTo(...A); g.lineTo(...B); g.stroke(); g.setLineDash([]);
    const L_=Math.hypot(B[0]-A[0],B[1]-A[1]); if(L_<20) return; const n=Math.max(1,Math.floor(L_/70)), ang=Math.atan2(B[1]-A[1],B[0]-A[0])+(dir<0?Math.PI:0); g.fillStyle=col;
    for(let k=1;k<=n;k++){ const t=k/(n+1), P=[A[0]+(B[0]-A[0])*t, A[1]+(B[1]-A[1])*t]; const h=6; g.beginPath(); if(dir===0){ [ang,ang+Math.PI].forEach(a=>{ g.moveTo(P[0]+Math.cos(a)*h*1.4,P[1]+Math.sin(a)*h*1.4); g.lineTo(P[0]+Math.cos(a)*h*0.2-Math.sin(a)*h*0.7,P[1]+Math.sin(a)*h*0.2+Math.cos(a)*h*0.7); g.lineTo(P[0]+Math.cos(a)*h*0.2+Math.sin(a)*h*0.7,P[1]+Math.sin(a)*h*0.2-Math.cos(a)*h*0.7); g.closePath() }) } else { g.moveTo(P[0]+Math.cos(ang)*h,P[1]+Math.sin(ang)*h); g.lineTo(P[0]-Math.cos(ang)*h-Math.sin(ang)*h*0.8,P[1]-Math.sin(ang)*h+Math.cos(ang)*h*0.8); g.lineTo(P[0]-Math.cos(ang)*h+Math.sin(ang)*h*0.8,P[1]-Math.sin(ang)*h-Math.cos(ang)*h*0.8); g.closePath() } g.fill() } };
  const entorno=()=>{ const sel=(typeof ENT!=="undefined"&&ENT.sel)||new Set();
    const nLbl=(S.entorno||[]).length>40? 3.5 : 1.5;   // muitos vizinhos (OSM): rótulos só de perto
    (S.entorno||[]).forEach((e,i)=>{ if(!e.pts||e.pts.length<3) return; if(typeof ctxEntVisivel==="function" && !ctxEntVisivel(e)) return; const vz=entVazios(e), on=sel.has(e.id);
      const cf=typeof ctxCorEnt==="function"? ctxCorEnt(e) : null, fc=cf||css("--muted"), fa=cf? 0.9 : 0.35;   // cor por tipo (src/ui/contexto.js)
      if(vz.length){ g.save(); g.beginPath(); [e.pts,...vz].forEach(r=>{ r.forEach((q,k)=>{ const [x,y]=w2s(q); k?g.lineTo(x,y):g.moveTo(x,y) }); g.closePath() }); g.globalAlpha=fa; g.fillStyle=fc; g.fill("evenodd"); g.restore(); vz.forEach(v=>strokeP(v,css("--ink"),1)) }
      else fillP(e.pts,fc,fa);
      strokeP(e.pts,css("--ink"),cf? 0.75 : 1);
      if(on){ fillP(e.pts,css("--accent"),0.22); strokeP(e.pts,css("--accent"),2.4) }
      if(V.s>nLbl) label(e.osm && V.s<9? `${nf(e.h,0)} m` : `${e.nome||"E"+(i+1)} · ${nf(e.h,0)} m`, w2s(G.centroid(e.pts)), {size:10}) }) };   // OSM: só a altura até chegar bem perto
  const rampDraw=(rp,dir)=>{ if(!rp) return; fillP(rp,css("--mark"),0.35); strokeP(rp,css("--mark"),1.4); if(dir){ const c=G.centroid(rp), h=(Math.hypot(rp[1][0]-rp[0][0],rp[1][1]-rp[0][1]))/2-1; arrow([c[0]-dir[0]*h,c[1]-dir[1]*h],[c[0]+dir[0]*h,c[1]+dir[1]*h],css("--ink"),1.5,7) } if(V.s>3) label(`rampa ${pct(S.estudo.rampaInc,0)}`, w2s(G.centroid(rp)), {size:10}) };
  g.clearRect(0,0,W,H); g.fillStyle=css("--surface-2"); g.fillRect(0,0,W,H);
  if(mode==="impl" && BG && opt.bg!==false){ g.globalAlpha=BG.op; const [x,y]=w2s([BG.x,BG.y]); g.drawImage(BG.img,x,y,BG.img.width*BG.mpp*V.s,BG.img.height*BG.mpp*V.s); g.globalAlpha=1 }
  // grade
  const step = V.s>12?1: V.s>4?5: V.s>1.2?10:50; const [x0,y1]=s2w(0,0),[x1,y0]=s2w(W,H);
  g.lineWidth=1; g.strokeStyle=css("--line");
  for(let gx=Math.floor(x0/step)*step; gx<=x1; gx+=step){ const X=w2s([gx,0])[0]; g.globalAlpha=gx%(step*5)===0?0.9:0.4; g.beginPath(); g.moveTo(X,0); g.lineTo(X,H); g.stroke() }
  for(let gy=Math.floor(y0/step)*step; gy<=y1; gy+=step){ const Y=w2s([0,gy])[1]; g.globalAlpha=gy%(step*5)===0?0.9:0.4; g.beginPath(); g.moveTo(0,Y); g.lineTo(W,Y); g.stroke() }
  g.globalAlpha=1;
  if(mode==="impl"||mode==="clima") runHooks("draw2dBase", g, {W,H,V,mode,m,opt,w2s,s2w});   // contexto urbano (src/ui/contexto.js) por baixo de tudo
  const L=S.lote.pts;
  if(mode==="impl"){
    fillP(L,css("--m-lote"),BG?0.25:0.55); strokeP(L,css("--ink"),1.6);
    strokeP(m.sub,css("--muted"),1,[2,4]);
    { const T=m.ter||{}; (T.lojas||[]).forEach(p=>fillP(p,css("--m-loja"),0.55)); (T.hall||[]).forEach(p=>fillP(p,css("--m-ter"),0.3)); (T.drive||[]).forEach(p=>fillP(p,css("--c-drive"),0.8)); fillP(T.gar,css("--m-gar"),0.45) }
    strokeP(m.emb,css("--m-ter"),1.2);
    strokeP(m.torAll,css("--m-env"),1.1,[6,4]);
    entorno();
    const CU=S.custom||{}; [["emb","--m-ter"],["tor","--m-env"],["sub","--muted"]].forEach(([k,c])=>{ if(CU[k]&&CU[k].length>2){ strokeP(CU[k],css(c),2.2,[10,4]); if(opt.handles) CU[k].forEach(q=>{ const [x,y]=w2s(q); g.fillStyle=css(c); g.fillRect(x-3.5,y-3.5,7,7) }) } });
    if(opt.handles && typeof entHandles==="function") entHandles(g, w2s, V);
    else if(opt.handles) (S.entorno||[]).forEach(e=>(e.pts||[]).forEach(q=>{ const [x,y]=w2s(q); g.fillStyle=css("--muted"); g.fillRect(x-3.5,y-3.5,7,7) }));
    if(m.ramp) { strokeP(m.ramp.poly,css("--mark"),1.4,[4,3]) }
    frontStallsDraw();
    m.T.forEach((t,i)=>{ if(t.oco){ g.beginPath(); [t.oco.pts,...t.oco.vazios].forEach(r=>{ r.forEach((q,k)=>{ const [x,y]=w2s(q); k?g.lineTo(x,y):g.moveTo(x,y) }); g.closePath() }); g.globalAlpha=0.95; g.fillStyle=css("--m-tipo"); g.fill("evenodd"); g.globalAlpha=1; [t.oco.pts,...t.oco.vazios].forEach(r=>strokeP(r,css("--ink"),1.3)) }   // C1: torre com pátio
      else { fillP(t.plate,css("--m-tipo"),0.95); strokeP(t.plate,css("--ink"),1.3) } if(t.plate.length) label(`T${i+1} · ${t.pav} pav`, w2s(G.centroid(t.plate)), {w:"600",font:"--f-display",size:12}) });
    const free=c=>!m.T.some(t=>t.plate.length&&G.pip(c,t.plate));
    (m.ter.lojas||[]).forEach(p=>{ if(V.s>2.5 && free(G.centroid(p))) label("lojas", w2s(G.centroid(p)), {size:10}) });
    if(m.tGar.length && V.s>2.5 && free(G.centroid(m.tGar))) label("garagem", w2s(G.centroid(m.tGar)), {size:10});
    // lados
    L.forEach((a,i)=>{ const b=L[(i+1)%L.length], A=w2s(a), B=w2s(b);
      if(S.lote.front.includes(i)){ g.strokeStyle=css("--mark"); g.lineWidth= i===m.acesso.edge? 7 : 4; g.globalAlpha= i===m.acesso.edge? 1 : 0.6; g.beginPath(); g.moveTo(...A); g.lineTo(...B); g.stroke(); g.globalAlpha=1 }
      const mx=(A[0]+B[0])/2, my=(A[1]+B[1])/2, dx=B[0]-A[0], dy=B[1]-A[1], l=Math.hypot(dx,dy)||1, nx=dy/l, ny=-dx/l;
      label(`L${i+1} ${nf(G.edgeLen(L,i),2)} m`, [mx+nx*14, my+ny*14]);
      if(opt.handles){ g.fillStyle=css("--accent"); g.globalAlpha=.55; g.beginPath(); g.arc(mx,my,4,0,7); g.fill(); g.globalAlpha=1 }
    });
    { const fd=frontDir(S), ac=m.acesso; const o=12; arrow([ac.ped[0]-fd[0]*o,ac.ped[1]-fd[1]*o],[ac.ped[0]+fd[0]*2,ac.ped[1]+fd[1]*2],css("--accent"),2.5,8); label("pedestres",w2s([ac.ped[0]-fd[0]*(o+3),ac.ped[1]-fd[1]*(o+3)]),{size:10,col:css("--accent")});
      const vv=(m.ter&&m.ter.veiReal)||ac.vei; arrow([vv[0]-fd[0]*o,vv[1]-fd[1]*o],[vv[0]+fd[0]*2,vv[1]+fd[1]*2],css("--bad"),2.5,8); label("veículos",w2s([vv[0]-fd[0]*(o+3),vv[1]-fd[1]*(o+3)]),{size:10,col:css("--bad")}) }
    if(opt.handles) L.forEach(q=>{ const [x,y]=w2s(q); g.fillStyle=css("--surface"); g.strokeStyle=css("--ink"); g.lineWidth=1.5; g.beginPath(); g.rect(x-4.5,y-4.5,9,9); g.fill(); g.stroke() });
    if(L.length>2 && !m.T.some(t=>t.plate.length && G.pip(G.centroid(L),t.plate))) label(`${nf(m.A,1)} m²`, w2s(G.centroid(L)), {w:"600",font:"--f-display",size:13,bg:false});
    else if(L.length>2) label(`Lote ${nf(m.A,1)} m²`, [w2s(G.centroid(L))[0], Math.max(...L.map(q=>w2s(q)[1]))-26], {size:11});
    northArrow();
  }
  function frontStallsDraw(){ (m.vf&&m.vf.vagas||[]).forEach((v,i)=>{ fillP(v.poly,css("--m-loja"),0.35); strokeP(v.poly,css("--ink"),0.8); if(V.s>9) label("C"+(i+1), w2s(v.c), {size:9,bg:false}) }) }
  /* ---- garagem: área de circulação real, patamares, rampas, vagas e rotas ---- */
  function circDraw(lay){
    if(!lay||!lay.grid||!lay.reach) return; const G_=lay.grid;
    if(!lay._cv || lay._cvCol!==css("--c-drive")){ const cv=document.createElement("canvas"); cv.width=G_.nx; cv.height=G_.ny; const cx=cv.getContext("2d"), im=cx.createImageData(G_.nx,G_.ny);
      const hx=css("--c-drive").replace("#",""), col=[parseInt(hx.slice(0,2),16),parseInt(hx.slice(2,4),16),parseInt(hx.slice(4,6),16)];
      for(let j=0;j<G_.ny;j++) for(let i=0;i<G_.nx;i++){ if(lay.reach[j*G_.nx+i]<0) continue; const o=((G_.ny-1-j)*G_.nx+i)*4; im.data[o]=col[0]; im.data[o+1]=col[1]; im.data[o+2]=col[2]; im.data[o+3]=255 }
      cx.putImageData(im,0,0); lay._cv=cv; lay._cvCol=css("--c-drive") }
    const tl=w2s([G_.x0-G_.res/2, G_.y0+(G_.ny-0.5)*G_.res]); g.save(); g.imageSmoothingEnabled=true; g.globalAlpha=0.9; g.drawImage(lay._cv, tl[0], tl[1], G_.nx*G_.res*V.s, G_.ny*G_.res*V.s); g.restore() }
  function hatch(p,col,a=0.5){ if(!p||!p.length) return; path(p); g.save(); g.clip(); g.strokeStyle=col; g.globalAlpha=a; g.lineWidth=1; const c=w2s(G.centroid(p)), R=Math.max(...p.map(q=>{ const P_=w2s(q); return Math.hypot(P_[0]-c[0],P_[1]-c[1]) })); const st=Math.max(5,V.s*0.6);
    for(let k=-R;k<R;k+=st){ g.beginPath(); g.moveTo(c[0]+k-R,c[1]+R); g.lineTo(c[0]+k+R,c[1]-R); g.stroke() } g.restore(); g.globalAlpha=1 }
  function rampsDraw(list){ (list||[]).forEach(r=>{
      if(r.elev){ // poço do elevador de carros: cabine com as diagonais
        fillP(r.poly,css("--c-elev"),0.6); strokeP(r.poly,css("--ink"),1.6);
        (r.cabs||[]).forEach(cb=>{ strokeP(cb,css("--ink"),0.8); const q=cb.map(w2s); g.strokeStyle=css("--ink"); g.globalAlpha=0.45; g.lineWidth=0.8; g.beginPath(); g.moveTo(...q[0]); g.lineTo(...q[2]); g.moveTo(...q[1]); g.lineTo(...q[3]); g.stroke(); g.globalAlpha=1 });
        if(V.s>3){ const c=w2s(G.centroid(r.poly)); label(r.txt, [c[0], c[1]], {size:9.5}) } return }
      fillP(r.poly,css("--mark"),0.28); strokeP(r.poly,css("--mark"),1.6);
      if(r.path){ rampPathDraw(r); return }
      const A=r.a, B=r.b, d=[B[0]-A[0],B[1]-A[1]], L_=Math.hypot(...d)||1, u=[d[0]/L_,d[1]/L_];
      arrow([A[0]+u[0]*1.2,A[1]+u[1]*1.2],[B[0]-u[0]*1.2,B[1]-u[1]*1.2],css("--ink"),1.6,8);
      for(let t=3;t<L_-2;t+=1.2){ const P_=[A[0]+u[0]*t,A[1]+u[1]*t], n=[-u[1],u[0]], hw=0.42*S.estudo.rampaL; const p1=w2s([P_[0]+n[0]*hw,P_[1]+n[1]*hw]), p2=w2s([P_[0]-n[0]*hw,P_[1]-n[1]*hw]); g.strokeStyle=css("--mark"); g.globalAlpha=0.35; g.lineWidth=1; g.beginPath(); g.moveTo(...p1); g.lineTo(...p2); g.stroke(); g.globalAlpha=1 }
      if(V.s>3){ const t=r.sai? 0.3 : 0.7, c=w2s([A[0]+(B[0]-A[0])*t, A[1]+(B[1]-A[1])*t]); label(`${r.txt}`, c, {size:9.5}) } }) }
  /* rampa ao longo de um caminho (helicoidal, em L): miolo vazado, degraus perpendiculares e seta no sentido da descida/subida */
  function rampPathDraw(r){
    if(r.hole){ fillP(r.hole,css("--surface"),1); hatch(r.hole,css("--ink"),0.28); strokeP(r.hole,css("--mark"),1.2) }
    const pts=r.path, seg=[]; let tot=0; for(let i=1;i<pts.length;i++){ const l=Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]); seg.push(l); tot+=l }
    const at=t=>{ let d=Math.max(0,Math.min(tot,t)); for(let i=0;i<seg.length;i++){ if(d<=seg[i] || i===seg.length-1){ const l=seg[i]||1, k=Math.min(1,d/l), a=pts[i], b=pts[i+1]; return {p:[a[0]+(b[0]-a[0])*k, a[1]+(b[1]-a[1])*k], u:[(b[0]-a[0])/l,(b[1]-a[1])/l]} } d-=seg[i] } return {p:pts[0],u:[1,0]} };
    const hw=0.42*(r.wl||S.estudo.rampaL);
    g.strokeStyle=css("--mark"); g.globalAlpha=0.35; g.lineWidth=1;
    for(let t=3;t<tot-2;t+=1.2){ const {p:P_,u}=at(t), n=[-u[1],u[0]], p1=w2s([P_[0]+n[0]*hw,P_[1]+n[1]*hw]), p2=w2s([P_[0]-n[0]*hw,P_[1]-n[1]*hw]); g.beginPath(); g.moveTo(...p1); g.lineTo(...p2); g.stroke() }
    g.globalAlpha=1; g.strokeStyle=css("--ink"); g.lineWidth=1.6; g.lineJoin="round"; g.beginPath();
    const n_=Math.max(2,Math.ceil((tot-2.4)/0.4)); for(let k=0;k<=n_;k++){ const P=w2s(at(1.2+(tot-2.4)*k/n_).p); k? g.lineTo(...P) : g.moveTo(...P) } g.stroke();
    const e=at(tot-1.2); arrow([e.p[0]-e.u[0]*0.6, e.p[1]-e.u[1]*0.6], e.p, css("--ink"), 1.6, 8);
    if(V.s>3) label(r.txt, w2s(r.hole? G.centroid(r.hole) : at(tot*(r.sai? 0.3 : 0.7)).p), {size:9.5});
  }
  function routesDraw(lay){
    g.globalAlpha=0.55; (lay.path||[]).forEach(pp=>pathLine(pp.pts, pp.dir, css("--bad"))); g.globalAlpha=1;
    (lay.routes||[]).forEach(r=>{ g.strokeStyle=css("--mark"); g.lineWidth=3; g.lineJoin="round"; g.setLineDash([]); g.beginPath(); r.pts.forEach((q,i)=>{ const [x,y]=w2s(q); i?g.lineTo(x,y):g.moveTo(x,y) }); g.stroke();
      const n=r.pts.length; if(n>1) arrow(r.pts[n-2], r.pts[n-1], css("--mark"), 3, 10) });
    (lay.portals||[]).forEach(pt=>{ const [x,y]=w2s(pt.p); g.fillStyle=pt.fora? css("--bad") : css("--mark"); g.beginPath(); g.arc(x,y,5,0,7); g.fill(); g.strokeStyle=css("--surface"); g.lineWidth=2; g.stroke() });
  }
  function stallsDraw(lay){
    lay.pillars.forEach(p=>fillP(p,css("--ink"),0.85));
    lay.vagas.forEach((v,i)=>{
      const col = v.tipo==="pcd"? css("--accent") : v.tipo==="idoso"? css("--ok") : v.tipo==="faixa"? css("--c-circ") : v.tipo==="off"? css("--bad") : v.tipo==="presa"? css("--warn") : v.tipo==="moto"? css("--u3") : v.tipo==="bici"? css("--lz-deck") : css("--m-gar");
      fillP(v.poly, col, v.tipo==="off"?0.12: v.tipo==="n"?0.55:0.7); strokeP(v.poly, css("--ink"), 0.8, v.tipo==="off"||v.tipo==="presa"?[2,2]:null);
      if(v.tipo==="faixa" && V.s>6) hatch(v.poly, css("--accent"), 0.8);
      if(v.tipo==="bici" && V.s>4) hatch(v.poly, css("--ink"), 0.35);
      if(v.ev && v.tipo==="n") strokeP(v.poly, css("--accent"), Math.max(1.4,Math.min(2.6,V.s*0.18)));
      if(V.s>9){ const t= v.tipo==="pcd"?"PCD": v.tipo==="idoso"?"ID": v.tipo==="faixa"?"":v.tipo==="off"?"×": v.tipo==="presa"?"presa": v.tipo==="moto"?"M": v.tipo==="bici"?`${v.bikes||""} bic.` : v.ev?"EV":String(i+1); if(t) label(t, w2s(v.c), {size:9,bg:false, col: v.ev&&v.tipo==="n"? css("--accent") : undefined}) } });
    if(lay.qe){ const [x,y]=w2s(lay.qe), s_=Math.max(6,Math.min(12,V.s*0.7)); g.fillStyle=css("--c-tec"); g.strokeStyle=css("--ink"); g.lineWidth=1; g.fillRect(x-s_/2,y-s_/2,s_,s_); g.strokeRect(x-s_/2,y-s_/2,s_,s_); if(V.s>4) label("QE", [x, y-s_-6], {size:9}) }
  }
  function garBodyInner(lay){
    circDraw(lay);
    (lay.landings||[]).forEach(p=>{ fillP(p,css("--c-drive"),0.9); hatch(p,css("--mark"),0.55) });
    rampsDraw(lay.ramps);
    stallsDraw(lay);
    if(opt.path!==false) routesDraw(lay);
    if(lay.ok===false && V.s>1){ const c=w2s(G.centroid(lay.blocks&&lay.blocks[0]||[[0,0]])); label("sem ligação entre a rampa e a circulação", [c[0], c[1]-24], {size:11, col:css("--bad")}) }
  }
  function garBody(lay, floor, key){
    fillP(L,css("--m-lote"),0.22); strokeP(L,css("--muted"),1,[3,3]);
    fillP(floor,css("--surface"),1);
    if(lay) garBodyInner(lay); else { const f=m.vert&&m.vert.floors[key]; if(f){ (f.landings||[]).forEach(p=>hatch(p,css("--mark"))); rampsDraw(f.ramps) } }
    coresAll(true);
    strokeP(floor,css("--ink"),1.6);
  }
  // núcleo em desenho técnico (todos os andares): paredes, portas, lances, elevadores
  function coreDraw(lay, lobby){
    if(!lay) return;
    if(lobby && lay.lobby){ fillP(lay.lobby,css("--c-hall"),1); strokeP(lay.lobby,css("--ink"),0.8,[3,2]); if(V.s>6) label("hall dos elevadores", w2s(G.centroid(lay.lobby)), {size:9,bg:false,col:css("--muted")}) }
    (lay.coreParts||[]).forEach(cp=>fillP(cp.poly, css("--c-"+cp.kind)||css("--surface"), 1));
    (lay.coreLines||[]).forEach(l=>{ if(l.arrow){ arrow(l.arrow[0],l.arrow[1],css("--ink"),1,5); return } const A=w2s(l[0]),B=w2s(l[1]); g.strokeStyle=css("--ink"); g.globalAlpha=0.55; g.lineWidth=0.7; g.beginPath(); g.moveTo(...A); g.lineTo(...B); g.stroke(); g.globalAlpha=1 });
    (lay.coreParts||[]).forEach(cp=>strokeP(cp.poly, css("--ink"), Math.max(1.2,Math.min(3,V.s*0.15))));
    if(lobby) (lay.coreReserva||[]).forEach(p=>fillP(p, css("--c-tec"), 1));   // atrás da escada rasa: reservado nos outros pavimentos
    strokeP(lobby? lay.core : (lay.coreOut||lay.core), css("--ink"), Math.max(1.6,Math.min(4,V.s*0.22)));
    (lay.coreDoors||[]).forEach(d=>{ const A=w2s(d.a), B=w2s(d.b); g.strokeStyle=css(lobby?"--c-hall":"--surface"); g.lineWidth=Math.max(2,Math.min(5,V.s*0.3)); g.beginPath(); g.moveTo(...A); g.lineTo(...B); g.stroke();
      if(d.sw){ const r=Math.hypot(B[0]-A[0],B[1]-A[1]), ang=Math.atan2(B[1]-A[1],B[0]-A[0]); g.strokeStyle=css("--ink"); g.lineWidth=0.8; g.beginPath(); g.moveTo(...A); g.lineTo(A[0]+Math.cos(ang-Math.PI/2)*r, A[1]+Math.sin(ang-Math.PI/2)*r); g.stroke(); g.globalAlpha=0.6; g.beginPath(); g.arc(A[0],A[1],r,ang-Math.PI/2,ang); g.stroke(); g.globalAlpha=1 } });
    if(V.s>7) (lay.coreParts||[]).forEach(cp=>{ if(["hall","tec","duto","pass"].includes(cp.kind)) return; const xs=cp.poly.map(q=>w2s(q)[0]), ys=cp.poly.map(q=>w2s(q)[1]), w_=Math.max(...xs)-Math.min(...xs), h_=Math.max(...ys)-Math.min(...ys); g.font="500 9px "+css("--f-mono"); const tw=g.measureText(cp.nome).width; if(w_>tw+8 && h_>12) label(cp.nome, w2s(G.centroid(cp.poly)), {size:9, bg:true}) });
  }
  function coresAll(lobby, only){ (m.coreSets||[]).forEach(cs=>{ if(only && !only(cs)) return; coreDraw(cs.lay, lobby) }) }
  function lzDraw(list){ (list||[]).forEach(({poly,item})=>{ const agua=/piscina/i.test(item.nome), col= item.desc? (agua? css("--lz-agua") : css("--lz-deck")) : css("--lz-c");
    fillP(poly,col,0.95); strokeP(poly,css("--ink"),1, item.desc? [4,3] : null);
    if(V.s>3.5){ const c=w2s(G.centroid(poly)); label(item.nome,[c[0],c[1]-(V.s>6?7:0)],{size:10,w:"600",bg:false}); if(V.s>6) label(`${nf(item.area,0)} m²${item.desc?" · descoberto":""}`,[c[0],c[1]+7],{size:9,bg:false,col:css("--ink-2")}) } }) }
  function tipoBody(ti, onlyOutline){
    const t=m.T[ti], lay=(mode==="andar" && opt.andar && typeof torreLayAndar==="function" ? torreLayAndar(m, ti, opt.andar.j+1) : null) || m.tipo[ti]; if(!t||!t.plate.length) return;   // C2: andar de outro bloco → layout do bloco
    if(!lay || onlyOutline){ strokeP(t.plate,css("--ink"),1.2,[5,4]); return }
    const pal=[css("--u1"),css("--u2"),css("--u3"),css("--u4"),css("--u5")], names=[...new Set(S.produto.mix.map(u=>u.nome))];
    lay.units.forEach(u=>{ fillP(u.poly, u.livre?css("--c-circ"):pal[names.indexOf(u.nome)%pal.length], u.livre?0.6:0.8); strokeP(u.poly,css("--ink"),1.4) });
    // cômodos (src/ui/comodos.js): paredes, portas, janelas, mobiliário — a sacada embutida vira cômodo
    const com = typeof comDraw==="function" && S.comodos && S.comodos.on && lay.units.some(u=>u.com);
    lay.units.forEach(u=>{ if(!u.sac||!u.sac.poly.length || (com && u.com && u.sac.tipo!=="balanco")) return; fillP(u.sac.poly, css("--c-sac"), u.sac.tipo==="balanco"?0.9:0.75); strokeP(u.sac.poly, css("--ink"), 1, u.sac.tipo==="balanco"? null : [3,2]) });
    fillP(lay.corridor,css("--surface"),1); (lay.corrAneis||[lay.corridor]).forEach(r=>strokeP(r,css("--ink"),0.8));   // C3: corredor em anel (pátio) sem a "ponte"
    (lay.hallEnds||[]).forEach(h=>{ fillP(h,css("--surface"),1); strokeP(h,css("--ink"),0.6) });
    if(com) comDraw(g, lay, {w2s, V, css, pal, names, ti, W, H, edit: mode==="tipo"});
    coreDraw(lay, false);

    if(V.s>4) lay.units.forEach(u=>{ if(!u.poly.length || (com && u.com)) return; const c=w2s(G.centroid(u.poly)); if(u.livre){ label("livre",c,{size:10}); return }
      label(u.nome, [c[0],c[1]-8], {w:"600",font:"--f-display",size:12,bg:false}); label(`${nf(u.alvo,1)} m² priv${u.sac?` · sacada ${nf(u.sac.area,1)}`:""}`, [c[0],c[1]+8], {size:10,bg:false}) });
  }
  function cobBody(ti){ const t=m.T[ti]; if(!t||!t.plate.length) return; const n=Math.max(1,S.produto.cob.qtd), cp=t.desenhada? torrePlantaAndar(t,t.pav) : t.plate, ux=G.longestDir(cp);   // C2: cobertura no último bloco
    for(let k=0;k<n;k++){ const [mn,mx]=G.extent(cp,ux), a=k? G.cutAt(cp,ux,k/n):mn, b=k<n-1? G.cutAt(cp,ux,(k+1)/n):mx, p=G.band(cp,ux,a,b); fillP(p,css("--m-cob"),0.85); strokeP(p,css("--ink"),1.3); if(p.length) label(`Cobertura ${k+1}`, w2s(G.centroid(p)), {w:"600",font:"--f-display",size:12,bg:false}) } coreDraw(m.tipo[ti], true) }
  function terreoBody(){
    const T=m.ter||{};
    fillP(L,css("--m-lote"),0.4); strokeP(L,css("--ink"),1.4);
    fillP(m.emb,css("--surface"),1);
    (T.lojas||[]).forEach(p=>{ fillP(p,css("--m-loja"),0.6); strokeP(p,css("--ink"),1.2) });
    (T.hall||[]).forEach(p=>fillP(p,css("--m-ter"),0.32));
    (T.drive||[]).forEach(p=>{ fillP(p,css("--c-drive"),1); strokeP(p,css("--ink"),0.8) });
    if(T.gar && T.gar.length){ fillP(T.gar,css("--surface"),1); if(m.gar && m.gar.ter) garBodyInner(m.gar.ter); else fillP(T.gar,css("--m-gar"),0.45) }
    (T.colsGar||[]).forEach(p=>{ fillP(p,css("--m-ter"),0.32); strokeP(p,css("--ink"),0.8) });
    (T.walk||[]).forEach(p=>{ fillP(p,css("--m-ter"),0.28); path(p); g.save(); g.clip(); g.strokeStyle=css("--surface"); g.lineWidth=Math.max(2,V.s*0.35); const c=w2s(G.centroid(p)); for(let k=-300;k<300;k+=Math.max(6,V.s*0.9)){ g.beginPath(); g.moveTo(c[0]-300,c[1]+k); g.lineTo(c[0]+300,c[1]+k); g.stroke() } g.restore(); strokeP(p,css("--ink"),0.6,[3,2]); if(V.s>6) label("passagem de pedestres", w2s(G.centroid(p)), {size:9}) });
    strokeP(m.emb,css("--ink"),1.6);
    frontStallsDraw();
    lzDraw(m.lzLay&&m.lzLay.terreoDesc);
    { const fT=m.vert&&m.vert.floors.ter; if(fT) rampsDraw(fT.ramps.filter(r=>!(m.gar&&m.gar.ter&&m.gar.ter.ramps.includes(r)))) }
    // rota de entrada: da rua até cada rampa e até a garagem do térreo
    if(T.drive0 && m.vert){ const lf=G.extent(S.lote.pts,T.fd)[0], P_=(l,d)=>[T.lat[0]*l+T.fd[0]*d, T.lat[1]*l+T.fd[1]*d];
      if(m.vert.entradas) m.vert.entradas.forEach(e=>arrow(e.a,e.b,css("--mark"),3,10));
      else (m.vert.strips||[]).filter(s_=>s_.id==="DA"||s_.id==="UA").forEach(s_=>{ if(S.estudo.rampa) return; const a=P_(s_.lc,lf-2), b=P_(s_.lc,s_.d0+1.5); g.strokeStyle=css("--mark"); g.lineWidth=3; g.beginPath(); g.moveTo(...w2s(a)); g.lineTo(...w2s(b)); g.stroke(); arrow(a,b,css("--mark"),3,10) });
      if(T.driveEnd && T.lanes){ const lc=(T.lanes[0]+T.lanes[1])/2, a=P_(lc,lf-2); arrow(a,T.driveEnd,css("--mark"),3,10) }
      // elevador de carros: vagas de espera antes do poço
      if(m.vert.elev) m.vert.elev.espera.forEach((p,i)=>{ fillP(p,css("--m-gar"),0.35); strokeP(p,css("--ink"),1,[4,3]); if(V.s>5) label(`espera ${i+1}`, w2s(G.centroid(p)), {size:9}) });
      if(V.s>3 && !m.vert.elev){ const c=w2s(P_((T.drive0.dv[0]+T.drive0.dv[1])/2, (lf+(m.vert.strips[0]? m.vert.strips[0].d0 : lf+5))/2)); label("patamar ≥ 5 m", c, {size:9}) } }
    lzDraw(m.lzLay&&m.lzLay.terreo);
    coresAll(true);
    m.T.forEach(t=>strokeP(t.plate,css("--muted"),1,[5,4]));
    if(V.s>2.5){
      (T.lojas||[]).forEach((p,i)=>{ const c=G.centroid(p); label(`loja ${i+1} · ${m2(G.area(p))}`, w2s(c), {size:10}) });
      const hb=(T.hallBand||[]).slice().sort((a,b)=>G.area(b)-G.area(a))[0]; if(hb){ const [l0]=G.extent(hb,T.lat); const c=[T.lat[0]*(l0+1)+T.fd[0]*(T.d1+1.3), T.lat[1]*(l0+1)+T.fd[1]*(T.d1+1.3)]; g.font="500 10px "+css("--f-mono"); const tx=`hall e lazer ${m2(m.hallA)}`, cc=w2s(c); label(tx,[cc[0]+g.measureText(tx).width/2+4,cc[1]],{size:10}) }
      (T.drive||[]).forEach(p=>{ if(V.s>5 && !(m.vert && (m.vert.elev || m.vert.helix))) label("acesso de veículos", w2s(G.centroid(p)), {size:9}) });
    }
    const fd=frontDir(S), ac=m.acesso; arrow([ac.ped[0]-fd[0]*8,ac.ped[1]-fd[1]*8],[ac.ped[0]+fd[0]*2,ac.ped[1]+fd[1]*2],css("--accent"),2.5,8); { const vv=T.veiReal||ac.vei; arrow([vv[0]-fd[0]*8,vv[1]-fd[1]*8],[vv[0]+fd[0]*2,vv[1]+fd[1]*2],css("--bad"),2.5,8) }
  }
  if(mode==="gar"){ if(opt.floorKey==="ter") terreoBody(); else garBody(opt.lay, opt.floor, opt.floorKey); northArrow() }
  if(mode==="andar"){
    const a=opt.andar;
    if(!a){ northArrow() }
    else if(a.tipo==="sub"||a.tipo==="ac"){ garBody(m.gar&&m.gar[a.lay], a.tipo==="sub"? m.sub : m.emb, a.lay) }
    else if(a.tipo==="ter"){ terreoBody() }
    else if(a.tipo==="lazemb"){
      strokeP(L,css("--muted"),1,[3,3]); fillP(m.emb,css("--c-circ"),0.55); strokeP(m.emb,css("--ink"),1.4);
      m.T.forEach(t=>{ fillP(t.plate,css("--m-tipo"),1); strokeP(t.plate,css("--ink"),1.2) }); coresAll(false);
      lzDraw(m.lzLay&&m.lzLay.emb);
      if(V.s>2 && !(m.lzLay&&m.lzLay.emb.length)) label("laje do embasamento livre — adicione lazer na etapa Produto", w2s(G.centroid(m.emb)), {size:10});
    }
    else if(a.tipo==="pavlaz"){
      strokeP(L,css("--muted"),1,[3,3]); const t=m.T[0]; if(t){ fillP(t.plate,css("--surface"),1); strokeP(t.plate,css("--ink"),1.6); lzDraw(m.lzLay&&m.lzLay.pav); coreDraw(m.tipo[0], true) }
      m.T.slice(1).forEach((t,i)=>tipoBody(i+1));
    }
    else if(a.tipo==="roof"){
      strokeP(L,css("--muted"),1,[3,3]); m.T.forEach((t,i)=>{ fillP(t.plate,css("--c-circ"),0.7); strokeP(t.plate,css("--ink"),1.4) });
      lzDraw(m.lzLay&&m.lzLay.cob); coresAll(false, cs=>cs.i===0);
      if(V.s>2) m.T.forEach((t,i)=>{ if(i>0 || !(m.lzLay&&m.lzLay.cob.length)) label(`cobertura da torre ${i+1}`, w2s(G.centroid(t.plate)), {size:10}) });
    }
    else {
      strokeP(L,css("--muted"),1,[3,3]); if(a.tipo!=="tipo") { fillP(m.emb,css("--c-circ"),0.5); strokeP(m.emb,css("--muted"),1,[4,3]) }
      m.T.forEach((t,i)=>{
        if(a.tipo==="tipo"){ if(a.j<t.tipoFloors) tipoBody(i); else if(t.hasCob && a.j===t.pav-1) cobBody(i) }
        if(a.tipo==="duplex" && t.duplexA>1){ const p=G.scaleToArea(t.plate,t.duplexA); fillP(p,css("--m-cob"),0.85); strokeP(p,css("--ink"),1.3); label("duplex · pavimento superior", w2s(G.centroid(p)), {size:11}) ; strokeP(t.plate,css("--muted"),1,[5,4]); coreDraw(m.tipo[i], true) }
        if(a.tipo==="atico" && S.produto.atico){ const p=G.scaleToArea(t.plate,t.A*0.25); fillP(p,css("--m-gar"),0.9); strokeP(p,css("--ink"),1.2); label("ático técnico", w2s(G.centroid(p)), {size:10}); strokeP(t.plate,css("--muted"),1,[5,4]) }
      });
    }
    northArrow();
  }
  if(mode==="clima"){
    fillP(L,css("--m-lote"),0.3);
    const kind=opt.kind, cv=fieldCanvas(kind);
    if(cv){ const F=fieldFrame(kind); g.save(); g.imageSmoothingEnabled=true;
      g.transform(V.s*F.fx[0]*F.cs, -V.s*F.fx[1]*F.cs, V.s*F.fy[0]*F.cs, -V.s*F.fy[1]*F.cs, V.s*(F.fx[0]*F.o[0]+F.fy[0]*F.o[1])+V.ox, -V.s*(F.fx[1]*F.o[0]+F.fy[1]*F.o[1])+V.oy);
      g.drawImage(cv,0,0); g.restore();
      if(kind==="vento" && WIND.ux){ const st=Math.max(4,Math.round(WIND.nx/34)); g.strokeStyle=css("--ink"); g.globalAlpha=0.55; g.lineWidth=1;
        for(let j=Math.floor(st/2);j<WIND.ny;j+=st) for(let i=Math.floor(st/2);i<WIND.nx;i+=st){ const c=j*WIND.nx+i; if(WIND.solid[c]) continue; const x=WIND.a0+(i+0.5)*WIND.cs, y=WIND.b0+(j+0.5)*WIND.cs, w=[x*WIND.f[0]+y*WIND.pp[0], x*WIND.f[1]+y*WIND.pp[1]];
          const vx=WIND.ux[c]*WIND.f[0]+WIND.uy[c]*WIND.pp[0], vy=WIND.ux[c]*WIND.f[1]+WIND.uy[c]*WIND.pp[1], k=WIND.cs*st*0.45; const A=w2s(w), B=w2s([w[0]+vx*k,w[1]+vy*k]); g.beginPath(); g.moveTo(...A); g.lineTo(...B); g.stroke(); g.beginPath(); g.arc(B[0],B[1],1.4,0,7); g.fillStyle=css("--ink"); g.fill() } g.globalAlpha=1 }
    }
    strokeP(L,css("--ink"),1.4);
    prisms(S,m).forEach(q=>{ strokeP(q.poly,css("--ink"),1.2); if(!q.own && V.s>1.5) label(`${nf(q.z1,0)} m`, w2s(G.centroid(q.poly)), {size:10}) });
    m.T.forEach((t,i)=>{ if(t.plate.length) label(`T${i+1} · ${nf(t.H,0)} m`, w2s(G.centroid(t.plate)), {size:10}) });
    if(kind==="vento"){ const f=windFlowDir(S), c=[W-70,H-70]; g.save(); g.translate(c[0],c[1]); g.strokeStyle=css("--ink"); g.fillStyle=css("--ink"); g.lineWidth=3; const a=Math.atan2(-f[1],f[0]); g.rotate(a); g.beginPath(); g.moveTo(-26,0); g.lineTo(18,0); g.stroke(); g.beginPath(); g.moveTo(26,0); g.lineTo(14,-7); g.lineTo(14,7); g.closePath(); g.fill(); g.restore(); label(`vento ${nf(S.clima.ventoVel,0)} m/s`, [c[0], c[1]+36], {size:10}) }
    legendBar(kind);
    northArrow();
  }
  if(mode==="tipo"){
    m.T.forEach(o=>strokeP(o.maxP,css("--m-env"),1,[6,4]));
    strokeP(L,css("--muted"),1,[3,3]);
    tipoBody(opt.tower||0);
    northArrow();
  }
  // escala gráfica
  const sb=[1,2,5,10,20,50,100,200].find(v=>v*V.s>70)||200; g.fillStyle=css("--ink"); g.fillRect(W-20-sb*V.s, H-22, sb*V.s, 3);
  g.font="500 11px "+css("--f-mono"); g.textAlign="right"; g.textBaseline="alphabetic"; g.fillText(sb+" m", W-20, H-30);
  function legendBar(kind){ const x=16, y=64, w=170, h=10; const stops= kind==="vento"? WIND_STOPS : SUN_STOPS; for(let i=0;i<w;i++){ const c=rampColor(i/w,stops); g.fillStyle=`rgb(${c})`; g.fillRect(x+i,y,1,h) } g.strokeStyle=css("--ink"); g.lineWidth=1; g.strokeRect(x,y,w,h);
    g.font="500 10px "+css("--f-mono"); g.fillStyle=css("--ink"); g.textAlign="left"; g.textBaseline="alphabetic";
    if(kind==="vento"){ [[0,"0"],[0.5,"1× (vento livre)"],[1,"2×"]].forEach(([t,l])=>{ g.textAlign=t===0?"left":t===1?"right":"center"; g.fillText(l,x+w*t,y-4) }); g.textAlign="left"; g.fillText(`velocidade relativa · ${nf(S.clima.ventoVel,0)} m/s = 1×`,x,y+h+12) }
    else { const mx=_sunCache?_sunCache.max:12; g.fillText("0 h",x,y-4); g.textAlign="right"; g.fillText(nf(mx,1)+" h",x+w,y-4); g.textAlign="left"; g.fillText("horas de sol no dia",x,y+h+12) } }
  function northArrow(){ const a=(S.lote.norte||0)*Math.PI/180, cx=W-34, cy=(typeof g2!=="undefined" && g===g2 && typeof VBH==="number")? VBH+30 : 34; /* no palco: abaixo da barra de vistas (src/ui/palco.js) */ g.save(); g.translate(cx,cy); g.rotate(a); g.fillStyle=css("--ink"); g.beginPath(); g.moveTo(0,-15); g.lineTo(6,8); g.lineTo(0,4); g.lineTo(-6,8); g.closePath(); g.fill(); g.restore(); g.font="600 11px "+css("--f-display"); g.textAlign="center"; g.fillStyle=css("--ink"); g.fillText("N", cx+Math.sin(a)*24, cy-Math.cos(a)*24+4) }
  runHooks("draw2d", g, {W,H,V,mode,m,opt,w2s,s2w});
  return {w2s,s2w};
}
