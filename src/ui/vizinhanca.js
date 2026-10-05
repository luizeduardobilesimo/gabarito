/* ================= 1.4 impacto de vizinhança: card no Clima › Sol, mapa na planta e no 3D, animação anual e PDF ================= */
const VZ = { anim:null };
const VZ_MESES=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const VZ_STOPS=[[0,[247,222,150]],[0.5,[226,128,62]],[1,[160,38,34]]];
const vzOn = ()=> !!(S.vizinhanca && S.vizinhanca.on);
/* a prévia rápida (enquanto o Worker calcula) não traz m.viz: usa o último resultado completo */
function vzR(m){ if(m && m.viz){ VZ.ultimo=m.viz; return m.viz } return vzOn()? VZ.ultimo : null }

addCard("clima", { key:"viz", sub:"sol", order:45,
  html: ()=>{
    const V=S.vizinhanca, has=(S.entorno||[]).some(e=>e.pts&&e.pts.length>2&&+e.h>0);
    const body = SW("vizinhanca.on","Calcular o sol que o prédio tira dos vizinhos",{rr:true}) + (!V.on ? `<p class="note">Horas de sol nas fachadas e coberturas do entorno, com e sem o empreendimento, no dia 21 de cada mês.</p>`
      : !has ? `<p class="note">Sem entorno. Gere vizinhos genéricos ou desenhe volumes no card Entorno.</p>`
      : `<div id="vzSum"></div><div id="vzTab"></div><div id="vzMeses"></div>`+
        SLD("vizinhanca.mes","Mapa do dia 21 de",1,12,1,"",{fmt:"mes"})+SW("vizinhanca.mapa","Mapa de horas perdidas na planta e no 3D",{fx:"vzMapa"})+
        `<div class="row"><button class="btn sm pri" data-act="vzAnim" id="vzAnimBtn">${VZ.anim?"❚❚ Pausar":"▶ Animar a sombra no ano"}</button></div>`);
    return CARD("Impacto de vizinhança", body, {key:"viz"});
  },
  live: m=>vzLive(m)
});
function vzLive(m){
  const r=vzR(m); if(!r||!document.getElementById("vzSum")) return;
  const inv=VZ_MESES[r.inverno-1], vv=r.vizinhos, worst=vv.reduce((a,v)=>!a||v.perdaInv>a.perdaInv? v : a, null);
  setHTML("vzSum", `<div class="mets"><div class="met big"><div class="l">Perda média nas fachadas vizinhas · 21/${inv}${r.stale?" · prévia":""}</div><div class="v">${nf(r.perdaInv,1)} h/dia</div><div class="s">${worst? `maior: ${esc(worst.nome)} (${nf(worst.perdaInv,1)} h, até ${nf(worst.perdaMax,1)} h)` : "sem vizinhos"}</div></div>
    <div class="met"><div class="l">Fachadas com perda &gt; 2 h</div><div class="v">${m2(r.areaAfetada)}</div><div class="s">no inverno</div></div>
    <div class="met"><div class="l">Cálculo</div><div class="v">${nf(r.ms,0)} ms</div><div class="s">12 dias · raios a cada ${nf(r.dt*60,0)} min</div></div></div>`);
  setHTML("vzTab", `<table class="vdt" style="margin-top:6px"><thead><tr><th style="width:40%;cursor:default">Vizinho</th><th style="width:18%;cursor:default">Perda</th><th style="width:24%;cursor:default">&gt; 2 h</th><th style="width:18%;cursor:default">Cobert.</th></tr></thead><tbody>${vv.map(v=>
    `<tr style="cursor:default"><td title="${esc(v.nome)} · ${nf(v.h,0)} m">${esc(v.nome)} <span class="note">${nf(v.h,0)} m</span></td><td style="color:${v.perdaInv>2?"var(--bad)":v.perdaInv>0.5?"var(--warn)":"var(--ink)"}">${nf(v.perdaInv,1)} h</td><td>${m2(v.areaAfetada)}</td><td>${nf(v.perdaCobInv,1)} h</td></tr>`).join("")}</tbody></table>`);
  // perda média por mês (barras)
  const W=320, H=86, pb=16, mx=Math.max(0.5,...r.meses), bw=W/12;
  setHTML("vzMeses", `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Perda média de sol nas fachadas vizinhas, por mês">${r.meses.map((v,k)=>{ const h=(H-pb-12)*v/mx, x=k*bw+3;
    return `<rect x="${x}" y="${H-pb-h}" width="${bw-6}" height="${Math.max(0.5,h)}" rx="2" fill="${k+1===r.mes?"var(--bad)":"var(--accent)"}" fill-opacity="${k+1===r.mes?0.9:0.55}"/><text x="${x+(bw-6)/2}" y="${H-4}" font-size="8.5" text-anchor="middle" fill="var(--muted)" font-family="IBM Plex Mono">${VZ_MESES[k]}</text>${v>0.05?`<text x="${x+(bw-6)/2}" y="${H-pb-h-3}" font-size="8" text-anchor="middle" fill="var(--muted)" font-family="IBM Plex Mono">${nf(v,1)}</text>`:""}`}).join("")}</svg><p class="note">Horas de sol perdidas por dia, em média nas fachadas do entorno (dia 21 de cada mês).</p>`);
}
FX.vzMapa = ()=>{ save(); const m=window._last&&window._last.m; if(m){ rebuild3d(m); redraw2d() } };

/* ---------- planta (Mapas › Horas de sol): horas perdidas ---------- */
function vzCanvas(M){
  const c=vzCanvas._c||(vzCanvas._c=document.createElement("canvas")); c.width=M.nx; c.height=M.ny;
  const g=c.getContext("2d"), img=g.createImageData(M.nx,M.ny), top=Math.max(2,M.max);
  for(let j=0;j<M.ny;j++) for(let i=0;i<M.nx;i++){ const v=M.data[j*M.nx+i], o=(j*M.nx+i)*4; if(!(v>0.05)){ img.data[o+3]=0; continue }
    const col=rampColor(v/top, VZ_STOPS); img.data[o]=col[0]; img.data[o+1]=col[1]; img.data[o+2]=col[2]; img.data[o+3]=Math.round(120+120*Math.min(1,v/top)) }
  g.putImageData(img,0,0); return c;
}
HOOK.draw2d.push((g, ctx)=>{
  const m=ctx.m, r=vzR(m); if(ctx.mode!=="clima" || (ctx.opt&&ctx.opt.kind)!=="sol" || !vzOn() || !S.vizinhanca.mapa || !r) return;
  const M=r.mapa, V=ctx.V;
  if(M){ const cv=vzCanvas(M); g.save(); g.imageSmoothingEnabled=false; g.transform(V.s*M.cs, 0, 0, -V.s*M.cs, V.s*M.x0+V.ox, -V.s*M.y0+V.oy); g.drawImage(cv,0,0); g.restore() }
  r.vizinhos.forEach(v=>{ const p=v.pts; g.beginPath(); p.forEach((q,i)=>{ const [x,y]=ctx.w2s(q); i?g.lineTo(x,y):g.moveTo(x,y) }); g.closePath(); g.strokeStyle=css("--bad"); g.lineWidth=v.perdaInv>0.05?2:1; g.setLineDash(v.perdaInv>0.05?[]:[3,3]); g.stroke(); g.setLineDash([]);
    if(V.s>1.2){ const [x,y]=ctx.w2s(G.centroid(p)), t= v.perdaInv<0.05? "sem perda" : `−${nf(v.perdaInv,1)} h`; g.font="600 11px "+css("--f-mono"); const w=g.measureText(t).width+10; g.fillStyle=css("--surface"); g.globalAlpha=0.9; g.fillRect(x-w/2,y+8,w,16); g.globalAlpha=1; g.fillStyle=v.perdaInv>2?css("--bad"):css("--ink"); g.textAlign="center"; g.textBaseline="middle"; g.fillText(t,x,y+16) } });
  // escala
  const x=16, y=ctx.H-46, w=170, h=10, top=Math.max(2,M?M.max:2);
  for(let i=0;i<w;i++){ const c=rampColor(i/w,VZ_STOPS); g.fillStyle=`rgb(${c})`; g.fillRect(x+i,y,1,h) } g.strokeStyle=css("--ink"); g.lineWidth=1; g.strokeRect(x,y,w,h);
  g.font="500 10px "+css("--f-mono"); g.fillStyle=css("--ink"); g.textBaseline="alphabetic"; g.textAlign="left"; g.fillText("0 h",x,y-4); g.textAlign="right"; g.fillText(nf(top,1)+" h",x+w,y-4);
  g.textAlign="left"; g.fillText(`horas de sol perdidas em 21/${VZ_MESES[(M?M.mes:r.mes)-1]} · vizinhos: média no inverno`,x,y+h+12);
});

/* ---------- 3D: mapa no chão e fachadas vizinhas coloridas pela perda ---------- */
HOOK.draw3d.push((grp, m)=>{
  const r=vzR(m); if(!vzOn()||!S.vizinhanca.mapa||!r||TAB!=="clima"||CSUB!=="sol") return;
  const M=r.mapa, k=(M?M.mes:r.mes)-1;
  if(M && !VZ.anim){ const cv=vzCanvas(M), z=0.16, X0=M.x0, Y0=M.y0, X1=M.x0+M.nx*M.cs, Y1=M.y0+M.ny*M.cs;
    const geo=new THREE.BufferGeometry(), P=a=>[a[0],z,-a[1]];
    geo.setAttribute("position", new THREE.Float32BufferAttribute([...P([X0,Y0]),...P([X1,Y0]),...P([X1,Y1]),...P([X0,Y0]),...P([X1,Y1]),...P([X0,Y1])],3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute([0,0, 1,0, 1,1, 0,0, 1,1, 0,1],2));
    const tex=new THREE.CanvasTexture(cv); tex.flipY=false; tex.magFilter=THREE.NearestFilter; tex.encoding=THREE.sRGBEncoding;
    const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:0.9,side:THREE.DoubleSide,depthWrite:false})); mesh.renderOrder=3; grp.add(mesh) }
  const top=Math.max(2, ...r.vizinhos.map(v=>v.perdaMax)), pos=[], col=[], push=(p,c)=>{ pos.push(p[0],p[2],-p[1]); col.push(c[0]/255,c[1]/255,c[2]/255) };
  r.vizinhos.forEach(v=>{
    v.amostras.forEach(a=>{ const l=a.perda[k]; if(!(l>0.05)) return; const c=rampColor(l/top,VZ_STOPS), t=[-a.n[1],a.n[0]], hw=a.w/3/2*0.96, o=0.1;
      const cx=a.x+a.n[0]*o, cy=a.y+a.n[1]*o, z0=Math.max(0.02,a.z-1.45), z1=Math.min(v.h-0.02,a.z+1.45);
      const A=[cx-t[0]*hw,cy-t[1]*hw,z0], B=[cx+t[0]*hw,cy+t[1]*hw,z0], C=[cx+t[0]*hw,cy+t[1]*hw,z1], D=[cx-t[0]*hw,cy-t[1]*hw,z1];
      [A,B,C,A,C,D].forEach(p=>push(p,c)) });
    v.cobertura.forEach(a=>{ const l=a.perda[k]; if(!(l>0.05)) return; const c=rampColor(l/top,VZ_STOPS), s=1.48, z=v.h+0.08;
      const A=[a.x-s,a.y-s,z], B=[a.x+s,a.y-s,z], C=[a.x+s,a.y+s,z], D=[a.x-s,a.y+s,z]; [A,B,C,A,C,D].forEach(p=>push(p,c)) });
  });
  if(pos.length){ const g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)); g.setAttribute("color",new THREE.Float32BufferAttribute(col,3));
    const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,transparent:true,opacity:0.92,polygonOffset:true,polygonOffsetFactor:-2})); mesh.renderOrder=3; grp.add(mesh) }
});

/* ---------- animação anual da sombra (aproveita o sol do 3D: sunUI/applySun) ---------- */
function vzStop(){ const was=!!VZ.anim; if(VZ.anim){ clearInterval(VZ.anim); VZ.anim=null } const b=document.getElementById("vzAnimBtn"); if(b) b.textContent="▶ Animar a sombra no ano"; save(); if(was && window._last) rebuild3d(window._last.m) }
ACT.vzAnim = ()=>{
  if(VZ.anim){ vzStop(); return }
  if(VIEW!=="3d") setView("3d");
  S.sol.on=true; S.sol.mes=1; S.sol.dia=21; S.sol.hora=7; sunUI(); applySun();
  const b=document.getElementById("vzAnimBtn"); if(b) b.textContent="❚❚ Pausar";
  VZ.anim=setInterval(()=>{
    if(VIEW!=="3d"||!S.sol.on){ vzStop(); return }
    S.sol.hora=+(S.sol.hora+0.25).toFixed(2);
    if(S.sol.hora>17.5){ S.sol.hora=7; S.sol.mes++; if(S.sol.mes>12){ S.sol.mes=6; S.sol.hora=12; sunUI(); applySun(); vzStop(); return } }
    sunUI(); applySun();
  }, 45);
  rebuild3d(window._last.m);
};

/* ---------- PDF: página "Impacto de vizinhança" ---------- */
HOOK.pdf.push(async ctx=>{
  const {m,rows,h2,PW,M}=ctx, r=vzR(m); if(!vzOn()||!r||!r.vizinhos.length) return;
  ctx.newPage(); h2("Impacto de vizinhança");
  const inv=VZ_MESES[r.inverno-1];
  rows([["Cálculo", "sol direto no entorno, com e sem o prédio · dia 21 de cada mês · 15 min"],
    [`Perda média nas fachadas vizinhas (21/${inv})`, nf(r.perdaInv,1)+" h/dia"],[`Fachadas com perda > 2 h (21/${inv})`, m2(r.areaAfetada)]]);
  h2("Por vizinho (inverno)");
  rows(r.vizinhos.map(v=>[`${v.nome} (${nf(v.h,0)} m)`, `fachadas ${nf(v.perdaInv,1)} h (máx. ${nf(v.perdaMax,1)} h) · > 2 h: ${m2(v.areaAfetada)} · cobertura ${nf(v.perdaCobInv,1)} h`, v.perdaInv>2?"bad":v.perdaInv>0.5?"warn":"ok"]));
  h2("Perda média por mês (h/dia)");
  rows([[VZ_MESES.slice(0,6).map((x,k)=>`${x} ${nf(r.meses[k],1)}`).join("   "), ""],[VZ_MESES.slice(6).map((x,k)=>`${x} ${nf(r.meses[k+6],1)}`).join("   "), ""]]);
  // mapa enquadrando o lote e todo o entorno
  if(S.vizinhanca.mapa){ const url=withLight(()=>{ if(typeof sunHours==="function") sunHours(S,m);
      const W=1400, H=1000, cv=document.createElement("canvas"); cv.width=W; cv.height=H; const g=cv.getContext("2d");
      const V=fitView([S.lote.pts, ...r.vizinhos.map(v=>v.pts)], W/2, H/2, 1.15); g.scale(2,2); drawPlan(g, W/2, H/2, V, "clima", m, {kind:"sol", bg:false});
      return cv.toDataURL("image/jpeg",0.9) });
    ctx.img(url, PW-2*M, (PW-2*M)*1000/1400) }
});
