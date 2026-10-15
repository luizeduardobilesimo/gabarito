/* ================= vistas e interação ================= */
const c2=document.getElementById("c2d"), g2=c2.getContext("2d");
let ANDAR="ter", TAPMODE="off";
let VIEW="3d", TOOL="edit", DRAWT="lote", DRAW=null, CAL=null, HOVER=null, FLOOR="s1", TOWER=0, RAMPMOVE=false;
const VS={}; // transformações por vista
function cur(){ return VS[VIEW] || (VS[VIEW]={s:5,ox:0,oy:0}) }
function size2d(){ const r=c2.getBoundingClientRect(), d=devicePixelRatio||1; c2.width=Math.max(1,r.width*d); c2.height=Math.max(1,r.height*d); g2.setTransform(d,0,0,d,0,0) }
function viewPolys(){
  const m=window._last&&window._last.m; if(!m) return [S.lote.pts];
  if(VIEW==="gar") return [floorPoly(m)||S.lote.pts];
  if(VIEW==="tipo"){ const t=m.T[TOWER]; return [t&&t.plate.length? t.plate : S.lote.pts] }
  if(VIEW==="clima") return [S.lote.pts, ...(S.entorno||[]).map(e=>e.pts).filter(p=>p&&p.length)];
  if(VIEW==="andar") return [S.lote.pts];
  return [S.lote.pts];
}
function floorPoly(m){ return FLOOR[0]==="s"? m.sub : m.emb }
function floorsList(m){
  const P=S.produto, out=[]; if(!m) return out;
  for(let k=P.subsolos;k>=1;k--) out.push({key:"s"+k, nome:`Subsolo ${k}`, tipo:"sub", lay:"s"+k, z0:-k*P.peGar, h:P.peGar});
  out.push({key:"ter", nome:"Térreo", tipo:"ter", z0:0, h:P.peTerreo});
  for(let k=1;k<=P.garAcima;k++) out.push({key:"g"+k, nome:`Garagem ${k}`, tipo:"ac", lay:"g"+k, z0:P.peTerreo+(k-1)*P.peGar, h:P.peGar});
  const maxP=Math.max(0,...m.T.map(t=>t.pav)), lz=m.lz||{emb:{},cob:{}}, dz=m.pavLz? P.pe : 0;
  if((lz.emb.c||0)+(lz.emb.d||0)>0) out.push({key:"lzemb", nome:"Laje do embasamento · lazer", tipo:"lazemb", z0:m.hEmb, h:0.3});
  if(m.pavLz) out.push({key:"lz", nome:"Pavimento de lazer (torre 1)", tipo:"pavlaz", z0:m.hEmb, h:P.pe});
  for(let j=0;j<maxP;j++){ const tw=m.T.filter(t=>t.pav>j), cob=tw.length&&tw.every(t=>t.hasCob&&t.pav-1===j); out.push({key:"p"+(j+1), nome: cob? `${j+1}º pavimento · coberturas` : `${j+1}º pavimento`, tipo:"tipo", j, z0:m.hEmb+dz+j*P.pe, h:P.pe}) }
  if(m.T.some(t=>t.duplexA>1)){ const j=Math.max(...m.T.filter(t=>t.duplexA>1).map(t=>t.pav)); out.push({key:"dup", nome:"Duplex (pavimento superior)", tipo:"duplex", z0:m.hEmb+j*P.pe, h:P.pe}) }
  if((lz.cob.c||0)+(lz.cob.d||0)>0) out.push({key:"roof", nome:"Cobertura da torre 1 · rooftop", tipo:"roof", z0:m.hEmb+dz+maxP*P.pe+(m.duplex?P.pe:0), h:3});
  if(P.atico) out.push({key:"atc", nome:"Ático técnico", tipo:"atico", z0:m.hEmb+dz+maxP*P.pe+(m.duplex?P.pe:0), h:3});
  return out;
}
function fit2d(){ if(VIEW==="3d") return; const r=c2.getBoundingClientRect(); if(!r.width) return;
  // celular: a planta se ajusta à faixa livre entre a barra de vistas (em cima) e a faixa de ferramentas (embaixo), não ao palco todo
  let top=0, bot=0;
  if(typeof navCel==="function" && navCel()){ const vb=document.querySelector("#view .viewbar"), vt=document.getElementById("vtools");
    if(vb){ const q=vb.getBoundingClientRect(); top=Math.max(0, q.bottom-r.top+4) }
    if(vt){ const q=vt.getBoundingClientRect(); if(q.height>0) bot=Math.max(0, r.bottom-q.top+4) } }
  const H=r.height-top-bot, livre=(top||bot) && H>=r.height*0.3, pad=VIEW==="impl"?1.5:VIEW==="clima"?1.25:1.15;
  const v=fitView(viewPolys(), r.width, livre? H : r.height, pad); if(livre) v.oy+=top;
  VS[VIEW]=v; redraw2d() }
function fitBG(){ if(!BG) return; const r=c2.getBoundingClientRect(); const w=BG.img.width*BG.mpp, h=BG.img.height*BG.mpp; const s=Math.min(r.width/w, r.height/h)*0.95; VS.impl={s, ox:r.width/2-(BG.x+w/2)*s, oy:r.height/2+(BG.y-h/2)*s}; redraw2d() }
let T2=null;
function redraw2d(){
  if(typeof entBarRefresh==="function") entBarRefresh();
  if(typeof blcBarRefresh==="function") blcBarRefresh();
  if(c2.hidden || VIEW==="3d") return; const m=window._last&&window._last.m; if(!m) return;
  const r=c2.getBoundingClientRect(); const V=cur();
  const lay = VIEW==="gar" && m.gar ? m.gar[FLOOR] : null;
  const andar = VIEW==="andar"? floorsList(m).find(f=>f.key===ANDAR) : null;
  T2 = drawPlan(g2, r.width, r.height, V, VIEW, m, {handles:VIEW==="impl"&&TOOL==="edit", lay, floor:floorPoly(m), floorKey:FLOOR, tower:TOWER, kind:S.clima.modo, andar});
  if(VIEW==="gar" && !lay && FLOOR!=="ter"){ g2.font="500 13px "+css("--f-body"); g2.fillStyle=css("--muted"); g2.textAlign="center"; g2.fillText("Este pavimento não existe no produto atual.", r.width/2, r.height/2) }
  if(VIEW==="impl"){
    const w2s=T2.w2s, col = DRAWT==="entorno"? css("--muted") : DRAWT.startsWith("lim")? css("--m-env") : css("--d-acc");
    if(DRAW){ g2.strokeStyle=col; g2.lineWidth=2; g2.beginPath(); DRAW.forEach((q,i)=>{ const [x,y]=w2s(q); i?g2.lineTo(x,y):g2.moveTo(x,y) }); if(HOVER) g2.lineTo(...w2s(HOVER)); g2.stroke(); DRAW.forEach((q,i)=>{ const [x,y]=w2s(q); g2.fillStyle=i===0?css("--mark"):col; g2.beginPath(); g2.arc(x,y,i===0?7:4,0,7); g2.fill() }) }
    if(CAL){ g2.strokeStyle=css("--mark"); g2.lineWidth=2.5; g2.beginPath(); CAL.forEach((q,i)=>{ const [x,y]=w2s(q); i?g2.lineTo(x,y):g2.moveTo(x,y) }); if(CAL.length===1&&HOVER) g2.lineTo(...w2s(HOVER)); g2.stroke(); CAL.forEach(q=>{ const [x,y]=w2s(q); g2.fillStyle=css("--mark"); g2.beginPath(); g2.arc(x,y,5,0,7); g2.fill() }) }
  }
}
const w2s_=q=>{ const V=cur(); return [q[0]*V.s+V.ox, -q[1]*V.s+V.oy] }, s2w_=(px,py)=>{ const V=cur(); return [(px-V.ox)/V.s, -(py-V.oy)/V.s] };
let drag=null; const ptrs=new Map(); let pinch=null;
function pos(e){ const r=c2.getBoundingClientRect(); return [e.clientX-r.left, e.clientY-r.top] }
function editables(){ const l=[{arr:S.lote.pts,kind:"lote"}]; ["emb","tor","sub"].forEach(k=>{ if(S.custom[k]&&S.custom[k].length) l.push({arr:S.custom[k],kind:"lim"}) }); (S.entorno||[]).forEach(e=>{ if(e.pts){ l.push({arr:e.pts,kind:"entorno",ent:e}); (e.vazios||[]).forEach(v=>l.push({arr:v,kind:"vazio",ent:e})) } }); if(typeof blcEditaveis==="function") l.push(...blcEditaveis()); return l }
function hitVertex(px,py){ let best=null,bd=14; editables().forEach(ed=>ed.arr.forEach((q,i)=>{ const [x,y]=w2s_(q), d=Math.hypot(x-px,y-py); if(d<bd){ bd=d; best={arr:ed.arr,i,kind:ed.kind,ent:ed.ent} } })); return best }
function hitMid(px,py){ const L=S.lote.pts; let best=-1,bd=12; L.forEach((a,i)=>{ const b=L[(i+1)%L.length], A=w2s_(a), B=w2s_(b), d=Math.hypot((A[0]+B[0])/2-px,(A[1]+B[1])/2-py); if(d<bd){ bd=d; best=i } }); return best }
const HINTSEEN={};
function finishDraw(){
  const pts=DRAW; DRAW=null;
  if(DRAWT==="lote"){ S.lote.pts=pts; S.lote.front=[]; S.lote.rec=pts.map(()=>({})); normalizeLote(); S.lote.front=[0]; S.lote.principal=0; toast("Terreno fechado. Marque as frentes e a frente principal na lista de lados.") }
  else if(DRAWT==="entorno"){ const n={pts, h:12, nome:"Vizinho "+(S.entorno.length+1)}; S.entorno.push(n); if(typeof entSelecionar==="function") entSelecionar(n,"set"); toast("Volume do entorno criado com 12 m. Ajuste a altura na barra abaixo.") }
  else if(DRAWT==="vazio"){ const alvo=entQualContem(S.entorno, G.centroid(pts)); if(alvo && entVazioOk(alvo,pts)){ (alvo.vazios=alvo.vazios||[]).push(pts); if(typeof entSelecionar==="function") entSelecionar(alvo,"set"); toast("Vazio criado") } else toast("O vazio precisa ficar inteiro dentro de uma edificação") }
  else { const k=DRAWT.split(":")[1]; S.custom[k]=pts; toast("Limite personalizado aplicado") }
  setTool("edit"); update(); fit3d(); if(TAB==="terreno"||emClima()) renderTab();
}
c2.addEventListener("pointerdown",e=>{
  if(!HINTSEEN[VIEW+TOOL]){ HINTSEEN[VIEW+TOOL]=1; document.getElementById("hint").hidden=true }
  c2.setPointerCapture(e.pointerId); ptrs.set(e.pointerId,pos(e));
  if(ptrs.size===2){ const [a,b]=[...ptrs.values()]; pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1]), s:cur().s, c:[(a[0]+b[0])/2,(a[1]+b[1])/2]}; drag=null; return }
  const [px,py]=pos(e), w=s2w_(px,py);
  if(VIEW==="andar"){ drag={type:"pan",px,py,ox:cur().ox,oy:cur().oy,moved:false,tap:w}; return }
  if(VIEW==="gar"){
    const m=window._last.m;
    if(RAMPMOVE && m.ramp){ if(!S.estudo.rampa){ const a=Math.atan2(m.ramp.dir[1],m.ramp.dir[0])*180/Math.PI; S.estudo.rampa={x:m.ramp.c[0],y:m.ramp.c[1],a} } drag={type:"ramp", start:w, x:S.estudo.rampa.x, y:S.estudo.rampa.y}; return }
    drag={type:"pan",px,py,ox:cur().ox,oy:cur().oy,moved:false,tap:w}; return }
  if(VIEW==="tipo" && typeof comHit==="function"){ const h=comHit(px,py); if(h){ drag={type:"com",...h}; return } }   // divisões entre cômodos (src/ui/comodos.js)
  if(VIEW!=="impl"){ drag={type:"pan",px,py,ox:cur().ox,oy:cur().oy}; return }
  if(TOOL==="draw"){ if(!DRAW) DRAW=[]; if(DRAW.length>=3){ const f=w2s_(DRAW[0]); if(Math.hypot(f[0]-px,f[1]-py)<14){ finishDraw(); return } } DRAW.push(w); redraw2d(); return }
  if(TOOL==="calib"){ if(!CAL||CAL.length>=2) CAL=[]; CAL.push(w); if(CAL.length===2){ document.getElementById("calibBox").hidden=false; document.getElementById("calibDist").focus() } redraw2d(); return }
  if(TOOL==="img"){ if(BG) drag={type:"img", start:w, bx:BG.x, by:BG.y}; return }
  if(typeof entDown==="function"){ const d=entDown(e,px,py,w); if(d){ drag=d; return } }
  const v=hitVertex(px,py); if(v){ drag={type:"v",...v}; return }
  const mI=hitMid(px,py); if(mI>=0){ const L=S.lote.pts, a=L[mI], b=L[(mI+1)%L.length]; L.splice(mI+1,0,[(a[0]+b[0])/2,(a[1]+b[1])/2]); edgeInsert(mI); drag={type:"v",arr:L,i:mI+1,kind:"lote"}; update({fast:true}); return }
  drag={type:"pan", px,py, ox:cur().ox, oy:cur().oy};
});
c2.addEventListener("pointermove",e=>{
  if(ptrs.has(e.pointerId)) ptrs.set(e.pointerId,pos(e));
  if(pinch && ptrs.size===2){ const [a,b]=[...ptrs.values()], d=Math.hypot(a[0]-b[0],a[1]-b[1]); zoomAt(pinch.c[0],pinch.c[1], pinch.s*d/pinch.d); return }
  const [px,py]=pos(e); HOVER=s2w_(px,py);
  if(!drag){ if(DRAW||(CAL&&CAL.length===1)) redraw2d(); else if(VIEW==="tipo" && typeof comHover==="function" && e.pointerType!=="touch") comHover(px,py); return }
  if(drag.type==="com"){ comDragMove(drag, s2w_(px,py)); return }
  if(drag.type==="pan"){ if(Math.hypot(px-drag.px,py-drag.py)>4) drag.moved=true; const V=cur(); V.ox=drag.ox+px-drag.px; V.oy=drag.oy+py-drag.py; redraw2d() }
  if(drag.type==="v"){ drag.arr[drag.i]=s2w_(px,py); update({fast:true}) }
  if(typeof entDrag==="function" && /^ent|^marq/.test(drag.type)){ entDrag(drag,px,py); return }
  if(drag.type==="ramp"){ const w=s2w_(px,py); S.estudo.rampa.x=drag.x+w[0]-drag.start[0]; S.estudo.rampa.y=drag.y+w[1]-drag.start[1]; update({fast:true}) }
  if(drag.type==="img"){ const w=s2w_(px,py); BG.x=drag.bx+w[0]-drag.start[0]; BG.y=drag.by+w[1]-drag.start[1]; redraw2d() }
});
const endPtr=e=>{ ptrs.delete(e.pointerId); if(ptrs.size<2) pinch=null;
  if(drag && typeof entUp==="function" && (/^ent|^marq/.test(drag.type) || (drag.type==="pan" && VIEW==="impl" && TOOL==="edit"))){ const r=entUp(drag); if(r) { drag=null; return } }
  if(drag && drag.type==="com"){ drag=null; comDragEnd(); return }
  if(drag && (VIEW==="gar"||VIEW==="andar") && drag.tap && !drag.moved && !(RAMPMOVE && VIEW==="gar")) toggleVaga(drag.tap);
  if(drag&&(drag.type==="v"||drag.type==="ramp")){ update(); if(TAB==="terreno") renderTabLive(window._last.m, window._last.f) } drag=null };
c2.addEventListener("pointerup",endPtr); c2.addEventListener("pointercancel",endPtr);
c2.addEventListener("wheel",e=>{ e.preventDefault(); const [px,py]=pos(e); zoomAt(px,py, cur().s*Math.exp(-e.deltaY*0.0015)) },{passive:false});
function zoomAt(px,py,ns){ ns=Math.min(300,Math.max(0.2,ns)); const w=s2w_(px,py), V=cur(); V.s=ns; V.ox=px-w[0]*ns; V.oy=py+w[1]*ns; redraw2d() }
function toggleVaga(w){
  const m=window._last.m; let key=FLOOR;
  if(VIEW==="andar"){ const a=floorsList(m).find(f=>f.key===ANDAR); if(!a) return; key = a.tipo==="ter"? "ter" : a.lay; if(!key) return }
  const lay=m.gar&&m.gar[key]; if(!lay) return;
  const v=lay.vagas.find(v=>G.pip(w,v.poly)); if(!v) return;
  const E=S.estudo; E.vtipo=E.vtipo||{}; if(E.off&&E.off[v.key]){ delete E.off[v.key] }
  const alvo = TAPMODE; let msg;
  if(alvo==="off"){ if(v.tipo==="off"){ delete E.vtipo[v.key]; if(v.auto==="off"||v.auto==="faixa") E.vtipo[v.key]="n"; msg="Vaga devolvida" } else { E.vtipo[v.key]="off"; msg="Vaga removida" } }
  else { if(v.tipo===alvo){ delete E.vtipo[v.key]; msg="Marcação desfeita" } else { E.vtipo[v.key]=alvo; msg={n:"Agora é vaga comum",pcd:"Marcada como PCD",idoso:"Marcada para idoso"}[alvo] } }
  update(); toast(msg);
}
document.getElementById("calibOk").addEventListener("click",()=>{ const d=+document.getElementById("calibDist").value; if(BG && CAL && CAL.length===2 && d>0){ const meas=Math.hypot(CAL[1][0]-CAL[0][0],CAL[1][1]-CAL[0][1]); const k=d/meas, A=CAL[0]; BG.mpp*=k; BG.x=A[0]+(BG.x-A[0])*k; BG.y=A[1]+(BG.y-A[1])*k; toast("Escala calibrada. Agora desenhe o lote."); fitBG(); DRAWT="lote"; setTool("draw"); DRAW=[] } else if(!BG) toast("Envie uma imagem primeiro"); CAL=null; document.getElementById("calibBox").hidden=true; redraw2d() });
document.getElementById("calibCancel").addEventListener("click",()=>{ CAL=null; document.getElementById("calibBox").hidden=true; setTool("edit") });
function setTool(t, target){ TOOL=t; if(target) DRAWT=target; else if(t==="draw" && !target) DRAWT = DRAWT||"lote"; if(t!=="draw") DRAW=null; if(t!=="calib"){ CAL=null; document.getElementById("calibBox").hidden=true }
  toolSegSync(); hintFor(); redraw2d() }
/* ferramentas da implantação: "Mover imagem" e "Calibrar" só existem com imagem de fundo */
function toolSegSync(){ document.querySelectorAll("#toolSeg button").forEach(b=>{ b.setAttribute("aria-pressed", b.dataset.t===TOOL && (!b.dataset.dt || b.dataset.dt===DRAWT)); if(b.dataset.t==="img"||b.dataset.t==="calib") b.hidden=!BG }) }
function hintFor(){ const h=document.getElementById("hint");
  const nomes={lote:"do lote","entorno":"do volume vizinho","vazio":"do vazio (pátio) dentro da edificação","lim:emb":"do limite do embasamento","lim:tor":"do limite das torres","lim:sub":"do limite do subsolo"};
  // dicas curtas (uma frase); somem no primeiro toque na planta ou depois de alguns segundos
  const msg = VIEW==="impl" ? {edit:"Arraste vértices e prédios do entorno; o ponto no meio de um lado cria um vértice.", draw:`Clique nos cantos ${nomes[DRAWT]||""} e feche no primeiro ponto.`, img:"Arraste para posicionar a imagem de fundo.", calib:"Clique em dois pontos de distância conhecida."}[TOOL]
    : VIEW==="gar" ? (RAMPMOVE? "Arraste a rampa; as vagas se refazem ao soltar." : ({n:"Toque numa vaga para torná-la comum.",pcd:"Toque numa vaga para marcá-la como PCD.",idoso:"Toque numa vaga para marcá-la para idoso."})[TAPMODE]||"Toque numa vaga para tirá-la ou devolvê-la.")
    : VIEW==="tipo" ? (S.comodos&&S.comodos.on? "Arraste as divisões entre os cômodos." : "")
    : VIEW==="clima" ? (S.clima.modo==="vento"? "Vermelho: vento acelerado; azul: calmaria." : "Horas de sol direto no chão na data escolhida.") : "";
  h.textContent=msg; h.hidden = VIEW==="3d" || !msg || !!HINTSEEN[VIEW+TOOL];
  clearTimeout(hintFor.t); if(!h.hidden){ const k=VIEW+TOOL; hintFor.t=setTimeout(()=>{ HINTSEEN[k]=1; if(VIEW+TOOL===k) h.hidden=true }, 9000) } }
document.getElementById("toolSeg").addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; setTool(b.dataset.t, b.dataset.dt) });
function setView(v){
  const prev=VIEW; VIEW=v; document.querySelectorAll("#viewSeg button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.v===v));
  { const vb=document.querySelector(`#viewSeg [data-v="${v}"]`), sg=vb&&vb.parentElement; if(sg && sg.scrollWidth>sg.clientWidth+2) sg.scrollLeft=Math.max(0, vb.offsetLeft-sg.offsetLeft-(sg.clientWidth-vb.offsetWidth)/2) }   // celular: a vista ativa fica à vista na faixa
  const c3=document.getElementById("c3d"), is3=v==="3d"||v==="v3d";
  if(prev==="v3d" && v!=="v3d") cfdLeave();
  c3.hidden = !is3 || !V3.R; c2.hidden = is3;
  document.getElementById("toolSeg").hidden = v!=="impl"; toolSegSync();
document.getElementById("legend").hidden = v!=="3d" || !LEGON;
  document.getElementById("floorSeg").hidden = v!=="gar"; document.getElementById("rampSeg").hidden = v!=="gar"; document.getElementById("towerSeg").hidden = v!=="tipo";
  document.getElementById("climaSeg").hidden = v!=="clima";
  document.getElementById("andarBox").hidden = v!=="andar"; document.getElementById("tapSeg").hidden = !(v==="gar"||v==="andar"); document.getElementById("corteBox").hidden = v!=="3d";
  document.getElementById("legBtn").hidden = !(v==="3d"||v==="impl"||v==="gar"||v==="tipo"||v==="andar");
  document.getElementById("sunBtn").hidden = v!=="3d"; document.getElementById("sunBox").hidden = v!=="3d" || !S.sol.on;
  if(!is3){ size2d(); if(!VS[v] || prev!==v) fit2d(); else redraw2d() } else { size3d(); if(v==="3d"){ rebuild3d(window._last.m); if(prev==="v3d") fit3d() } }
  if(v==="v3d") cfdEnter();
  if(v==="clima") climaRun();
  hintFor(); viewbarSegs(window._last&&window._last.m); if(typeof planLegend==="function") planLegend(); if(typeof entBarRefresh==="function") entBarRefresh();
}
function viewbarSegs(m){
  if(!m) return;
  const fs=document.getElementById("floorSeg"), P=S.produto, opts=[];
  for(let k=P.subsolos;k>=1;k--) opts.push(["s"+k,`Subsolo ${k}`]); if(m.emb.length) opts.push(["ter","Térreo"]); for(let k=1;k<=P.garAcima;k++) opts.push(["g"+k,`Garagem ${k}`]);
  if(opts.length && !opts.some(o=>o[0]===FLOOR)) FLOOR=opts.find(o=>o[0]!=="ter")?.[0]||opts[0][0];
  const cnt=k=>m.gar&&m.gar[k]? " · "+m.gar[k].count : "";
  const fh = opts.length<=5 ? opts.map(o=>`<button data-fl="${o[0]}" aria-pressed="${o[0]===FLOOR}">${o[1]}${cnt(o[0])}</button>`).join("")
    : `<button data-fstep="-1" aria-label="Pavimento abaixo">▼</button><select id="floorSel" aria-label="Pavimento">${opts.map(o=>`<option value="${o[0]}" ${o[0]===FLOOR?"selected":""}>${o[1]}${cnt(o[0])}</option>`).join("")}</select><button data-fstep="1" aria-label="Pavimento acima">▲</button>`;
  if(fs.innerHTML!==fh) fs.innerHTML=fh; const fsel=document.getElementById("floorSel"); if(fsel) fsel.value=FLOOR;
  fs._opts=opts;
  if(TOWER>=m.T.length) TOWER=0;
  const th=m.T.length>1? m.T.map((t,i)=>`<button data-tw="${i}" aria-pressed="${i===TOWER}">Torre ${i+1}</button>`).join("") : "";
  const ts=document.getElementById("towerSeg"); if(ts.innerHTML!==th) ts.innerHTML=th; ts.hidden = VIEW!=="tipo" || !th;
  document.getElementById("rampMove").setAttribute("aria-pressed", RAMPMOVE);
  const fl=floorsList(m); if(!fl.some(f=>f.key===ANDAR)) ANDAR="ter";
  const as=document.getElementById("andarSel"), ah=fl.map(f=>`<option value="${f.key}" ${f.key===ANDAR?"selected":""}>${f.nome}</option>`).join(""); if(as.innerHTML!==ah) as.innerHTML=ah; as.value=ANDAR;
  const cs=document.getElementById("corteSel"), ch=`<option value="">Prédio inteiro</option>`+fl.map(f=>`<option value="${f.key}" ${f.key===S.corte?"selected":""}>Cortar no ${f.nome.toLowerCase()}</option>`).join(""); if(cs.innerHTML!==ch) cs.innerHTML=ch; cs.value=S.corte||"";
  document.querySelectorAll("#tapSeg button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.tm===TAPMODE));
  document.querySelectorAll('#tabbody [data-act="tapm"]').forEach(b=>b.setAttribute("aria-pressed", b.dataset.v===TAPMODE));
  document.querySelectorAll("#climaSeg button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.cm===S.clima.modo));
}
document.getElementById("floorSeg").addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; const fs=document.getElementById("floorSeg");
  if(b.dataset.fstep){ const o=fs._opts||[], i=o.findIndex(x=>x[0]===FLOOR), j=clamp(i+(+b.dataset.fstep),0,o.length-1); FLOOR=o[j][0] } else FLOOR=b.dataset.fl;
  viewbarSegs(window._last.m); fit2d(); planLegend() });
document.getElementById("floorSeg").addEventListener("change",e=>{ if(e.target.id!=="floorSel") return; FLOOR=e.target.value; viewbarSegs(window._last.m); fit2d(); planLegend() });
document.getElementById("towerSeg").addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; TOWER=+b.dataset.tw; viewbarSegs(window._last.m); fit2d() });
document.getElementById("viewSeg").addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; setView(b.dataset.v); stepFromView(b.dataset.v) });
// sonda no Vento 3D
{ const c3=document.getElementById("c3d"); let down=null;
  c3.addEventListener("pointerdown",e=>{ down=[e.clientX,e.clientY] });
  c3.addEventListener("pointerup",e=>{ if(VIEW!=="v3d"||!down) return; if(Math.hypot(e.clientX-down[0],e.clientY-down[1])<5){ const r=c3.getBoundingClientRect(); cfdPick(e.clientX-r.left, e.clientY-r.top) } down=null }); }
document.getElementById("fitBtn").addEventListener("click",()=>{ VIEW==="v3d"? cfdFit() : VIEW==="3d"? fit3d() : (VIEW==="impl"&&BG&&TOOL!=="edit"? fitBG(): fit2d()) });
document.getElementById("rampMove").addEventListener("click",()=>{ RAMPMOVE=!RAMPMOVE; viewbarSegs(window._last.m); hintFor() });
document.getElementById("rampRot").addEventListener("click",()=>{ const m=window._last.m; if(!m.ramp) return; const a=S.estudo.rampa? S.estudo.rampa.a : Math.atan2(m.ramp.dir[1],m.ramp.dir[0])*180/Math.PI; S.estudo.rampa={x:m.ramp.c[0],y:m.ramp.c[1],a:(a+90)%360}; update() });
document.getElementById("rampAuto").addEventListener("click",()=>{ S.estudo.rampa=null; RAMPMOVE=false; update(); toast("Rampa no automático (junto ao acesso de veículos)") });
document.getElementById("climaSeg").addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; S.clima.modo=b.dataset.cm; viewbarSegs(window._last.m); hintFor(); climaRun(); if(emClima()) ACT.csub({dataset:{v:S.clima.modo}}) });
// clima: cálculo sob demanda
let climaRAF=null;
function climaRun(){
  if(VIEW!=="clima" && !emClima()) return; const m=window._last.m;
  if(S.clima.modo==="sol"){ sunHours(S,m); redraw2d(); climaInfo(); rebuild3d(m); return }
  windSetup(S,m);
  if(climaRAF) return;
  const tick=()=>{ climaRAF=null; if(S.clima.modo!=="vento" || (VIEW!=="clima" && !emClima())) return;
    if(WIND.steps<2400){ windStep(12); redraw2d(); if(WIND.steps%120===0){ climaInfo(); if(VIEW==="3d") rebuild3d(window._last.m) } climaRAF=requestAnimationFrame(tick) } else { climaInfo(); rebuild3d(window._last.m) } };
  climaRAF=requestAnimationFrame(tick);
}
// sol (3D)
function sunUI(){ const sb=document.getElementById("sunBox"); document.getElementById("sunBtn").classList.toggle("on",S.sol.on); sb.hidden = VIEW!=="3d" || !S.sol.on;
  document.getElementById("sunMes").value=S.sol.mes; document.getElementById("sunHora").value=S.sol.hora;
  const v=sunVector(), meses=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"], hh=Math.floor(S.sol.hora), mm=Math.round((S.sol.hora-hh)*60);
  document.getElementById("sunInfo").textContent = `${S.sol.dia}/${meses[S.sol.mes-1]} ${hh}h${String(mm).padStart(2,"0")} · alt. ${nf(v.alt*180/Math.PI,0)}°` }
document.getElementById("sunBtn").addEventListener("click",()=>{ S.sol.on=!S.sol.on; sunUI(); applySun(); save(); if(emClima()) renderTab() });
document.getElementById("sunMes").addEventListener("input",e=>{ S.sol.mes=+e.target.value; S.sol.dia=21; sunUI(); applySun(); if(S.clima.modo==="sol") climaRun() });
document.getElementById("sunHora").addEventListener("input",e=>{ S.sol.hora=+e.target.value; sunUI(); applySun() });
// animação do dia: o sol percorre a trajetória e as sombras andam junto
let SUNANIM=null;
document.getElementById("sunPlay").addEventListener("click",function(){ if(SUNANIM){ clearInterval(SUNANIM); SUNANIM=null; this.textContent="▶ Animar o dia"; save(); return }
  this.textContent="❚❚ Pausar"; if(S.sol.hora>=18.9) S.sol.hora=6;
  SUNANIM=setInterval(()=>{ S.sol.hora=+(S.sol.hora+0.1).toFixed(2); if(S.sol.hora>19){ S.sol.hora=6 } if(VIEW!=="3d"||!S.sol.on){ clearInterval(SUNANIM); SUNANIM=null; document.getElementById("sunPlay").textContent="▶ Animar o dia"; return } sunUI(); applySun() }, 60) });
document.querySelectorAll("[data-sd]").forEach(b=>b.addEventListener("click",()=>{ const [mm,d]=b.dataset.sd.split(",").map(Number); S.sol.mes=mm; S.sol.dia=d; sunUI(); applySun(); if(S.clima.modo==="sol") climaRun() }));

document.getElementById("andarSel").addEventListener("change",e=>{ ANDAR=e.target.value; redraw2d(); planLegend() });
document.getElementById("andarUp").addEventListener("click",()=>{ const fl=floorsList(window._last.m), i=fl.findIndex(f=>f.key===ANDAR); if(i<fl.length-1){ ANDAR=fl[i+1].key; viewbarSegs(window._last.m); redraw2d(); planLegend() } });
document.getElementById("andarDn").addEventListener("click",()=>{ const fl=floorsList(window._last.m), i=fl.findIndex(f=>f.key===ANDAR); if(i>0){ ANDAR=fl[i-1].key; viewbarSegs(window._last.m); redraw2d(); planLegend() } });
document.getElementById("andar3d").addEventListener("click",()=>{ S.corte=ANDAR; save(); setView("3d") });
document.getElementById("corteSel").addEventListener("change",e=>{ S.corte=e.target.value; save(); rebuild3d(window._last.m) });
document.getElementById("tapSeg").addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; TAPMODE=b.dataset.tm; viewbarSegs(window._last.m); toast({off:"Toque numa vaga para tirar ou devolver",n:"Toque para tornar a vaga comum",pcd:"Toque para marcar PCD",idoso:"Toque para marcar idoso"}[TAPMODE]) });
let LEGON = !!LS.get("gabarito.leg");   // legenda recolhida por padrão; o botão "Legenda" abre e lembra
document.getElementById("legBtn").addEventListener("click",()=>{ LEGON=!LEGON; LS.set("gabarito.leg",LEGON); planLegend() });
function planLegend(){
  const el=document.getElementById("planLeg"), b=document.getElementById("legBtn"); if(!el) return;
  const sw=(c,l,o="")=>`<div><i style="background:${c};${o}"></i>${l}</div>`, ln=(c,l,dash)=>`<div><i style="background:none;border:0;border-top:2px ${dash?"dashed":"solid"} ${c};height:0;margin-top:5px"></i>${l}</div>`;
  let h="";
  const a = VIEW==="andar"? floorsList(window._last.m).find(f=>f.key===ANDAR) : null;
  const lzLeg = ()=> sw("var(--lz-c)","lazer coberto")+sw("var(--lz-agua)","piscina")+sw("var(--lz-deck)","lazer descoberto")+sw("var(--c-hall)","hall dos elevadores","border:1px dashed var(--ink)");
  const garLeg = ()=> sw("var(--m-gar)","vaga comum")+sw("var(--d-acc)","vaga PCD")+sw("var(--c-circ)","faixa de transferência PCD e corredor transversal")+sw("var(--ok)","vaga para idoso")+sw("transparent","vaga removida","border:1px dashed var(--bad)")+sw("var(--ink)","núcleos das torres e pilares")+sw("var(--mark)","rampa (seta = descida)")+ln("var(--bad)","caminho do carro",true)+(typeof garLegExtra==="function"? garLegExtra(sw) : "");
  const tipoLeg = ()=> S.produto.mix.map((u,i)=>sw(`var(--u${i%5+1})`,u.nome)).join("")+sw("var(--c-sac)","sacada")+sw("var(--surface)","corredor e hall")+sw("var(--c-esc)","escada")+sw("var(--c-ant)","antecâmara / hall da escada")+sw("var(--c-duto)","dutos / pressurização")+sw("var(--c-balc)","balcão aberto")+sw("var(--c-elev)","elevadores")+sw("var(--c-shaft)","shafts")+sw("var(--c-hserv)","hall de serviço")+sw("var(--c-lixo)","lixo / DML");
  if(VIEW==="impl") h=sw("var(--m-lote)","lote")+sw("var(--m-loja)","lojas no térreo")+sw("var(--m-ter)","hall e lazer do térreo")+sw("var(--m-gar)","garagem do térreo")+sw("var(--m-tipo)","projeção das torres")+ln("var(--m-env)","limite máximo das torres (recuos)",true)+ln("var(--muted)","subsolo",true)+ln("var(--mark)","frente principal")+ln("var(--d-acc)","acesso de pedestres")+ln("var(--bad)",(()=>{ const ac=window._last&&window._last.m&&window._last.m.acesso; return ac&&ac.edgeV!=null&&ac.edgeV!==ac.edge? `acesso de veículos (lado L${ac.edgeV+1})` : "acesso de veículos" })())+sw("var(--c-drive)","faixa de veículos (rampas)")+sw("var(--muted)","entorno");
  else if((VIEW==="gar" && FLOOR==="ter") || (a&&a.tipo==="ter")) h=sw("var(--m-loja)","lojas")+sw("var(--m-ter)","hall social e lazer")+sw("var(--c-drive)","acesso de veículos")+lzLeg()+garLeg();
  else if(VIEW==="gar" || (a&&(a.tipo==="sub"||a.tipo==="ac"))) h=sw("var(--surface)","área do pavimento")+sw("var(--c-hall)","hall dos elevadores","border:1px dashed var(--ink)")+garLeg();
  else if(a&&(a.tipo==="lazemb"||a.tipo==="pavlaz"||a.tipo==="roof")) h=lzLeg()+sw("var(--c-esc)","escada")+sw("var(--c-elev)","elevadores");
  else if(VIEW==="tipo" || (a&&a.tipo==="tipo")) h=tipoLeg()+sw("var(--m-cob)","coberturas")+(typeof comLeg==="function"? comLeg(sw) : "");
  else if(a) h=sw("var(--m-cob)","duplex / cobertura")+sw("var(--m-gar)","ático técnico")+sw("var(--c-circ)","laje do embasamento");
  el.innerHTML=`<b>Legenda</b>`+h; el.hidden = !h || !LEGON; if(b) b.setAttribute("aria-pressed",LEGON);
  const lg=document.getElementById("legend"); if(lg) lg.hidden = VIEW!=="3d" || !LEGON;
}