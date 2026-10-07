/* ================= topografia: card da etapa Terreno, curvas na implantação e relevo no 3D (item 2.3) =================
   topoCardHTML()  → card "Topografia" (chamado por STEP_R.terreno) · topoLive(m) → números vivos · topoAfter() → liga o arquivo
   Desenho: HOOK.draw2d (curvas de nível e pontos na implantação) e HOOK.draw3d (terreno em relevo, ruas e entorno na cota certa). */
const topoN=(v,d=2)=>nf(v,d);
/* seção "Topografia" da etapa Terreno: fechada, com resumo; custos e desenho atrás de "Mais opções" */
function topoSum(m){
  const T=S.topo; if(!T.on) return `desnível ${nf(+S.lote.desnivel||0,1)} m`;
  if(!T.pts.length) return "sem pontos importados";
  const t=m&&m.topo; return `${T.pts.length} pontos${t? ` · térreo ${topoN(t.c)} m` : ""}`;
}
function topoCardHTML(){
  const T=S.topo, sec=b=>SEC("Topografia", b, {key:"topografia", sum:topoSum(window._last&&window._last.m)});
  const sw=`<div class="row sb" style="flex-wrap:nowrap">${SW("topo.on","Usar levantamento topográfico",{rr:true})}${INFO("Desligado: vale o desnível simples entre a frente e os fundos. Ligado: pontos cotados ou curvas de nível (CSV, KML, DXF) dão o corte, o aterro e a contenção reais.")}</div>`;
  if(!T.on) return sec(sw +
    KV(NUM("lote.desnivel","Desnível","m",{step:0.1,q:"frente fundos",help:"Diferença de nível entre a frente e os fundos do lote. Entra no movimento de terra."})+NUM("lote.custoTerra","Movimento de terra","R$/m³",{step:1,help:"Corte e aterro"})) + `<div class="fsub" id="sub-terra"></div>`);
  const tipo=TOPO_CONT[T.contTipo]? T.contTipo : "cortina";
  const imp = `<div class="row"><label class="btn sm${T.pts.length?"":" pri"}" for="topoFile" tabindex="0">Importar arquivo</label><input type="file" id="topoFile" accept=".csv,.txt,.xyz,.kml,.dxf" hidden><button class="btn sm" data-act="topoEx">Exemplo inclinado</button>${T.pts.length?`<button class="btn sm ghost" data-act="topoLimpa">Limpar</button>`:""}${INFO("CSV com x, y, z (metros ou UTM) ou latitude, longitude, cota · KML com altitude · DXF com pontos (POINT) ou curvas de nível (polilinhas com elevação). Coordenadas geográficas usam a origem do lote (Localização).")}</div>`;
  if(!T.pts.length) return sec(sw + imp);
  return sec(sw + imp + `<div class="fsub" id="topoInfo"></div>` +
    GRP("Cota do térreo") +
    SEG("topo.cotaModo",[["otima","Ótima","Minimiza corte + aterro respeitando a soleira"],["manual","Manual"]],{fx:"topoModo",full:true,label:"Cota do térreo"}) +
    KV(T.cotaModo==="manual"
      ? NUM("topo.cotaTerreo","Cota do térreo","m",{step:0.05,help:"Cota absoluta do piso do térreo, no mesmo referencial do levantamento"}) + NUM("topo.soleiraTol","Soleira × calçada","± m",{step:0.1,min:0,help:"Diferença máxima entre o piso do térreo e a calçada no acesso de pedestres (escadas/rampa)"})
      : NUM("topo.soleiraTol","Soleira × calçada","± m",{step:0.1,min:0,help:"Diferença máxima entre o piso do térreo e a calçada no acesso de pedestres (escadas/rampa)"}) + `<div class="fld"><span class="fl">Cota ótima</span><div class="fsub" id="topoCotaTxt" style="font-size:13px;color:var(--ink);padding-top:6px"></div></div>`) +
    `<div class="mets" id="topoMets"></div><table class="tbl" id="topoTbl"></table>` +
    `<div class="row sb" style="flex-wrap:nowrap">${SW("topo.curvas","Curvas de nível na implantação",{rr:true,fx:"topoDraw"})}${T.curvas? `<div class="inp" style="width:96px;flex:none"><input type="number" step="0.25" min="0.25" data-p="topo.curvasInt" data-min="0.1" data-fx="topoDraw" value="${T.curvasInt}" aria-label="Intervalo das curvas"><em>m</em></div>`:INFO("Curvas de nível")}</div>` +
    ADV(GRP("Contenção") +
      SEG("topo.contTipo", Object.entries(TOPO_CONT).map(([k,v])=>[k,v.curto,v.nome]), {full:true,label:"Tipo de contenção"}) +
      KV(NUM(`topo.contCustos.${tipo}`,"Contenção","R$/m²",{step:10,min:0,help:TOPO_CONT[tipo].nome+": custo por m² de parede (perímetro do subsolo × altura escavada)"}) + NUM("topo.arrimoCusto","Muro de arrimo","R$/m²",{step:10,min:0,help:"Desníveis do platô no perímetro do lote, fora da faixa do subsolo"})) +
      GRP("Movimento de terra") +
      KV(NUM("topo.custoCorte","Corte e bota-fora","R$/m³",{step:1,min:0}) + NUM("topo.custoAterro","Aterro compactado","R$/m³",{step:1,min:0})) +
      GRP("Lençol freático") +
      `<div class="row sb" style="flex-wrap:nowrap">${SW("topo.naOn","Nível d'água (sondagem)",{rr:true})}${INFO("Lençol freático")}</div>` +
      (T.naOn? KV(NUM("topo.naProf","Profundidade sob a calçada","m",{step:0.1,min:0}) + NUM("topo.rebaixCusto","Rebaixamento","R$/m³",{step:5,min:0,help:"Por m³ escavado abaixo do nível d'água"}) + NUM("topo.impermCusto","Impermeabilização","R$/m²",{step:5,min:0,help:"Laje de fundo + paredes até 0,5 m acima do nível d'água"})) : ""),
      {key:"topo", label:"Contenção, custos e lençol"}));
}
function topoLive(m){
  setSum("topografia", topoSum(m));
  if(!S.topo.on){ setSub("terra", `Movimento de terra ≈ ${nf(m.terra,0)} m³ (inclui escavação dos subsolos)`); return }
  const t=m.topo, T=S.topo; if(!t) return;
  const sf=t.sf, n=sf.N;
  setHTML("topoInfo", `${n} pontos · cotas ${topoN(sf.zmin)} a ${topoN(sf.zmax)} m${T.fonte? " · "+esc(T.fonte):""}${t.fora? ` · <span style="color:var(--warn)">lote parcialmente fora da área levantada</span>`:""}`);
  setHTML("topoCotaTxt", `${topoN(t.cOtima)} m`);
  const dif=t.c-t.calc, met=(l,v,s,cls)=>`<div class="met"><div class="l">${l}</div><div class="v"${cls?` style="color:var(--${cls})"`:""}>${v}</div><div class="s">${s}</div></div>`;
  setHTML("topoMets",
    met("Térreo", topoN(t.c)+" m", `calçada ${topoN(t.calc)} · ${dif>=0?"+":"−"}${topoN(Math.abs(dif))} m`, Math.abs(dif)>T.soleiraTol+1e-6?"bad":"") +
    met("Contenção", nf(t.cont.area,0)+" m²", t.nSub? `${nf(t.cont.per,0)} m × ${topoN(t.cont.hMed,1)} m médios` : "sem subsolo") +
    met("Corte", nf(t.terra.corte,0)+" m³", `platô ${nf(t.terra.platCorte,0)} · subsolos ${nf(t.terra.escav,0)}`) +
    met("Aterro", nf(t.terra.aterro,0)+" m³", `saldo ${t.terra.corte>=t.terra.aterro? "bota-fora":"empréstimo"} ${nf(Math.abs(t.terra.corte-t.terra.aterro),0)} m³`));
  const rows=[];
  t.terra.subs.forEach(s=>rows.push([`${s.k}º subsolo · ${topoN(s.bot)} a ${topoN(s.top)} m`, nf(s.vol,0)+" m³"]));
  rows.push([`Movimento de terra`, brl(t.custos.terra)]);
  if(t.custos.contencao) rows.push([`${TOPO_CONT[t.tipo].nome} (${nf(t.cont.area,0)} m²)`, brl(t.custos.contencao)]);
  if(t.custos.arrimo) rows.push([`Muros de arrimo (${nf(t.cont.arrimo,0)} m²)`, brl(t.custos.arrimo)]);
  if(t.na){ if(t.na.hAgua>0){ rows.push([`Rebaixamento do lençol (${nf(t.na.vol,0)} m³)`, brl(t.custos.rebaix)]); rows.push([`Impermeabilização (${nf(t.na.areaImp,0)} m²)`, brl(t.custos.imperm)]) }
    else rows.push([`Nível d'água ${topoN(t.na.cotaNA)} m · abaixo do fundo (${topoN(t.na.fundo)} m)`, "—"]) }
  const tot=t.custos.terra+t.custos.contencao+t.custos.arrimo+t.custos.rebaix+t.custos.imperm;
  setHTML("topoTbl", rows.map(([a,b])=>`<tr><td>${a}</td><td>${b}</td></tr>`).join("") + `<tr class="tot"><td>Total no custo da obra</td><td>${brl(tot)}</td></tr>`);
}
function topoAfter(){
  const f=document.getElementById("topoFile"); if(!f) return;
  const lb=document.querySelector('label[for="topoFile"]'); if(lb) lb.onkeydown=e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); f.click() } };
  f.onchange=()=>{ const file=f.files[0]; if(!file) return;
    file.text().then(txt=>{ const r=topoImportar(txt, file.name, {lat:S.lote.lat, lon:S.lote.lon, lote:S.lote.pts});
      if(r.erro){ toast(r.erro); return }
      S.topo.pts=r.pts; S.topo.on=true; S.topo.fonte=`${file.name}${r.modo==="utm"?" (UTM)":r.modo==="latlon"?" (lat/lon)":""}`; renderTab();
      toast(r.aviso || `${r.n} pontos importados`) }).catch(()=>toast("Não consegui ler o arquivo")) };
}
Object.assign(ACT,{
  topoEx: ()=>{ S.topo.pts=topoExemplo(S.lote.pts, frontDir(S)); S.topo.on=true; S.topo.fonte="exemplo: terreno inclinado ≈ 11%"; renderTab(); toast("Terreno de exemplo criado — veja o relevo no 3D") },
  topoLimpa: ()=>{ S.topo.pts=[]; S.topo.fonte=""; renderTab() },
});
FX.topoModo = ()=>{ const t=window._last&&window._last.m.topo; if(S.topo.cotaModo==="manual" && t){ let v=+t.c.toFixed(2); if(Math.abs(v-t.calc)>S.topo.soleiraTol) v= t.c>t.calc? Math.floor(t.c*100)/100 : Math.ceil(t.c*100)/100; S.topo.cotaTerreo=v } update() };
FX.topoDraw = ()=>{ save(); redraw2d(); if(window._last) rebuild3d(window._last.m) };

/* ---------------- 2D: curvas de nível na implantação ---------------- */
const TOPO_CV = { key:"", cv:null };
function topoCurvasCache(sf){ const k=sf.id+"|"+S.topo.curvasInt; if(TOPO_CV.key!==k){ TOPO_CV.key=k; TOPO_CV.cv=topoCurvas(sf, S.topo.curvasInt, {mestra:5}) } return TOPO_CV.cv }
HOOK.draw2d.push((g, c)=>{
  if(c.mode!=="impl" || !c.m || !c.m.topo || !S.topo.curvas) return;
  const t=c.m.topo, sf=t.sf, cv=topoCurvasCache(sf), {W,H,w2s}=c, ink=css("--ink"), acc=css("--accent");
  g.save(); g.setLineDash([]); g.lineCap="round";
  // as curvas passam por baixo das torres (recorte: tela inteira menos as projeções)
  g.beginPath(); g.rect(0,0,W,H); (c.m.T||[]).forEach(tr=>{ if(!tr.plate||tr.plate.length<3) return; tr.plate.forEach((q,i)=>{ const p=w2s(q); i? g.lineTo(p[0],p[1]) : g.moveTo(p[0],p[1]) }); g.closePath() }); g.clip("evenodd");
  cv.forEach(l=>{ g.beginPath(); l.segs.forEach(s=>{ const a=w2s([s[0],s[1]]), b=w2s([s[2],s[3]]); g.moveTo(a[0],a[1]); g.lineTo(b[0],b[1]) });
    g.strokeStyle=ink; g.globalAlpha= l.mestra? 0.42 : 0.16; g.lineWidth= l.mestra? 1.2 : 0.8; g.stroke() });
  g.globalAlpha=1;
  // pontos medidos (quando há espaço)
  if(c.V.s>3 && sf.N<=2500){ g.fillStyle=acc; g.globalAlpha=0.38; for(let i=0;i<sf.N;i++){ const p=w2s(sf.P[i]); if(p[0]<0||p[1]<0||p[0]>W||p[1]>H) continue; g.beginPath(); g.arc(p[0],p[1],1.3,0,7); g.fill() } g.globalAlpha=1 }
  // rótulos das curvas mestras (perto de uma linha vertical a 16% da largura)
  const ax=W*0.16, ay=H*0.5; g.font="500 10px "+css("--f-mono"); g.textAlign="center"; g.textBaseline="middle";
  const used=[];
  cv.filter(l=>l.mestra).forEach(l=>{ let best=null, bd=Infinity;
    l.segs.forEach(s=>{ const p=w2s([(s[0]+s[2])/2,(s[1]+s[3])/2]); if(p[0]<24||p[1]<60||p[0]>W-24||p[1]>H-24) return; const d=Math.abs(p[0]-ax)*1+Math.abs(p[1]-ay)*0.15; if(d<bd){ bd=d; best=p } });
    if(!best || used.some(u=>Math.hypot(u[0]-best[0],u[1]-best[1])<26)) return; used.push(best);
    const txt=nf(l.z, l.passo<1?1:0), tw=g.measureText(txt).width+8; g.fillStyle=css("--surface-2"); g.globalAlpha=0.92; g.fillRect(best[0]-tw/2,best[1]-7,tw,14); g.globalAlpha=1; g.fillStyle=css("--muted"); g.fillText(txt,best[0],best[1]) });
  // calçada e térreo no acesso de pedestres
  const ped=c.m.acesso&&c.m.acesso.ped; if(ped){ const p=w2s(ped), txt=`calçada ${topoN(t.calc)} · térreo ${topoN(t.c)}`; g.font="600 10.5px "+css("--f-mono"); const tw=g.measureText(txt).width+12;
    const x=Math.max(tw/2+6, Math.min(W-tw/2-6, p[0])), y=Math.min(H-14, p[1]+30); g.fillStyle=css("--surface"); g.globalAlpha=0.94; g.fillRect(x-tw/2,y-9,tw,18); g.globalAlpha=1; g.strokeStyle=css("--line-2"); g.lineWidth=1; g.strokeRect(x-tw/2,y-9,tw,18); g.fillStyle=ink; g.fillText(txt,x,y) }
  g.restore();
});

/* ---------------- 3D: terreno em relevo (bloco de maquete) ---------------- */
const TOPO_3D = { key:"", d:null };
function topoMalha(m){
  const t=m.topo, sf=t.sf, L=S.lote.pts, key=sf.id+"|"+t.c.toFixed(3)+"|"+JSON.stringify(L);
  if(TOPO_3D.key===key) return TOPO_3D.d;
  // área: dados medidos ∪ lote, com margem, dentro da moldura da superfície
  const db=sf.dbb; let x0=Math.min(db.x0,...L.map(q=>q[0])), x1=Math.max(db.x1,...L.map(q=>q[0])), y0=Math.min(db.y0,...L.map(q=>q[1])), y1=Math.max(db.y1,...L.map(q=>q[1]));
  const mg=Math.max(8, 0.12*Math.max(x1-x0,y1-y0)); x0=Math.max(sf.bb.x0,x0-mg); x1=Math.min(sf.bb.x1,x1+mg); y0=Math.max(sf.bb.y0,y0-mg); y1=Math.min(sf.bb.y1,y1+mg);
  const st=Math.max(0.6, Math.max(x1-x0,y1-y0)/150), nx=Math.max(2,Math.round((x1-x0)/st)), ny=Math.max(2,Math.round((y1-y0)/st));
  const h=new Float32Array((nx+1)*(ny+1)), dentro=new Uint8Array((nx+1)*(ny+1)); let hmin=Infinity, hmax=-Infinity;
  for(let j=0;j<=ny;j++) for(let i=0;i<=nx;i++){ const x=x0+(x1-x0)*i/nx, y=y0+(y1-y0)*j/ny, k=j*(nx+1)+i, inL=topoPip([x,y],L);
    dentro[k]=inL?1:0; h[k]= inL? -0.05 : topoZ(sf,x,y)-t.c; hmin=Math.min(hmin,h[k]); hmax=Math.max(hmax,h[k]) }
  const d={x0,x1,y0,y1,nx,ny,h,dentro,hmin,hmax,base:Math.min(hmin,-0.1)-1.5};
  TOPO_3D.key=key; TOPO_3D.d=d; return d;
}
HOOK.draw3d.push((grp, m)=>{
  if(!m || !m.topo || typeof THREE==="undefined") return;
  const t=m.topo, d=topoMalha(m), {x0,x1,y0,y1,nx,ny,h,hmin,hmax,base}=d, sf=t.sf;
  // superfície com cor hipsométrica sutil a partir do token do lote
  const pos=new Float32Array((nx+1)*(ny+1)*3), col=new Float32Array((nx+1)*(ny+1)*3), c0=col3("--m-lote"), tmp=new THREE.Color(), rng=Math.max(0.5,hmax-hmin);
  for(let j=0;j<=ny;j++) for(let i=0;i<=nx;i++){ const k=j*(nx+1)+i, x=x0+(x1-x0)*i/nx, y=y0+(y1-y0)*j/ny;
    pos[k*3]=x; pos[k*3+1]=h[k]; pos[k*3+2]=-y; tmp.copy(c0).offsetHSL(((h[k]-hmin)/rng-0.5)*0.04, 0, ((h[k]-hmin)/rng-0.5)*0.24); col[k*3]=tmp.r; col[k*3+1]=tmp.g; col[k*3+2]=tmp.b }
  const idx=[]; for(let j=0;j<ny;j++) for(let i=0;i<nx;i++){ const a=j*(nx+1)+i, b=a+1, c=a+nx+1, e=c+1; idx.push(a,b,e, a,e,c) }
  const g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.BufferAttribute(pos,3)); g.setAttribute("color",new THREE.BufferAttribute(col,3)); g.setIndex(idx); g.computeVertexNormals();
  const surf=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true, roughness:1, metalness:0, side:THREE.DoubleSide, polygonOffset:true, polygonOffsetFactor:1, polygonOffsetUnits:1}));
  surf.receiveShadow=true; surf.castShadow=true; grp.add(surf);
  // saia do bloco (corte do terreno até a base)
  const sp=[], ring=[]; for(let i=0;i<=nx;i++) ring.push([i,0]); for(let j=1;j<=ny;j++) ring.push([nx,j]); for(let i=nx-1;i>=0;i--) ring.push([i,ny]); for(let j=ny-1;j>=1;j--) ring.push([0,j]);
  ring.forEach(([i,j],r)=>{ const [i2,j2]=ring[(r+1)%ring.length], P=(a,b)=>[x0+(x1-x0)*a/nx, -(y0+(y1-y0)*b/ny)], A=P(i,j), B=P(i2,j2), ha=h[j*(nx+1)+i], hb=h[j2*(nx+1)+i2];
    sp.push(A[0],ha,A[1], B[0],hb,B[1], B[0],base,B[1], A[0],ha,A[1], B[0],base,B[1], A[0],base,A[1]) });
  const gs=new THREE.BufferGeometry(); gs.setAttribute("position",new THREE.Float32BufferAttribute(sp,3)); gs.computeVertexNormals();
  grp.add(new THREE.Mesh(gs,new THREE.MeshStandardMaterial({color:col3("--m-sub"), roughness:1, side:THREE.DoubleSide})));
  // curvas de nível sobre o terreno natural (fora do lote)
  if(S.topo.curvas){ const cv=topoCurvasCache(sf), L=S.lote.pts, a=[], b=[];
    cv.forEach(l=>l.segs.forEach(s=>{ const mx=(s[0]+s[2])/2, my=(s[1]+s[3])/2; if(mx<x0||mx>x1||my<y0||my>y1||topoPip([mx,my],L)) return; const yy=l.z-t.c+0.05; (l.mestra?b:a).push(s[0],yy,-s[1], s[2],yy,-s[3]) }));
    [[a,0.18],[b,0.42]].forEach(([arr,op])=>{ if(!arr.length) return; const gl=new THREE.BufferGeometry(); gl.setAttribute("position",new THREE.Float32BufferAttribute(arr,3)); grp.add(new THREE.LineSegments(gl,new THREE.LineBasicMaterial({color:col3("--ink"),transparent:true,opacity:op}))) }) }
  // ajusta o cenário do núcleo: chão e grade abaixo do bloco, ruas na cota da calçada, entorno sobre o terreno
  const viz=col3("--m-viz").getHex(), kids=grp.children.slice();
  kids.forEach((o,i)=>{
    if(o===surf) return;
    if(o.type==="GridHelper") o.visible=false;
    else if(o.isMesh && o.geometry && o.geometry.type==="CircleGeometry") o.position.y=base-0.05;
    else if(o.isMesh && o.material && o.material.color && o.material.color.getHex()===0x5c656b) o.position.y+=t.calc-t.c;
    else if(o.isMesh && o.geometry && o.geometry.type==="ExtrudeGeometry" && o.material && o.material.color && o.material.color.getHex()===viz){
      const p=o.geometry.attributes.position; let zmin=Infinity; for(let k=0;k<p.count;k+=Math.max(1,Math.floor(p.count/24))) zmin=Math.min(zmin, topoZ(sf, p.getX(k), -p.getZ(k)));
      const dy=zmin-t.c; o.position.y+=dy; const nx_=kids[i+1]; if(nx_ && nx_.type==="LineSegments") nx_.position.y+=dy }
  });
});
