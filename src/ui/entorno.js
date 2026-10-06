/* ================= edição das edificações do entorno (interface) =================
   Na Implantação (ferramenta "Editar"):
     clique numa edificação = seleciona · Shift+clique soma/tira · Shift+arrastar no vazio = seleção por retângulo
     arrastar a edificação = move (toda a seleção) · quadrado no canto = redimensiona · setas = ajuste fino · Delete = apaga · Esc = limpa
     vértice: arraste (clique duplo remove) · ponto no meio do lado da edificação selecionada cria vértice
   Barra flutuante (#entBar) com nome/altura, aumentar/reduzir, girar, pátio, desenhar vazio, duplicar e apagar.
   Card "Edificações do entorno" nas etapas Terreno e Clima: criar caixa, selecionar todas, apagar as do OSM, enquadrar.
   Cálculo puro em src/calc/entorno.js. A seleção guarda ids (sobrevive a desfazer/refazer) e não é salva no estudo. */
const ENT = { sel:new Set(), marq:null, sig:"" };

const entLista = () => (S.entorno||[]).filter(e=>e && e.pts && e.pts.length>2);
const entSelList = () => entLista().filter(e=>ENT.sel.has(e.id));
function entSelecionar(e, modo="set"){
  const id=entId(e);
  if(modo==="set") ENT.sel=new Set([id]);
  else if(modo==="add") ENT.sel.add(id);
  else if(modo==="toggle") ENT.sel.has(id)? ENT.sel.delete(id) : ENT.sel.add(id);
  redraw2d(); entCardRefresh();
}
function entLimpaSel(){ if(!ENT.sel.size) return; ENT.sel=new Set(); redraw2d(); entCardRefresh() }
function entPoda(){ const ids=new Set(entLista().map(e=>e.id)); [...ENT.sel].forEach(i=>{ if(!ids.has(i)) ENT.sel.delete(i) }) }
function entApos(msg){ entPoda(); update(); if(msg) toast(msg); entCardRefresh(); redraw2d() }

/* ---------- alças desenhadas sobre a planta (chamado por drawPlan) ---------- */
function entEscalaPos(e){ const b=entBBox(e); return [b[2], b[1]] }
function entHandles(g, w2s, V){
  const sel=entSelList(), css_=n=>css(n);
  entLista().forEach(e=>{ const on=ENT.sel.has(e.id); if(!on && V.s<1.2) return;
    e.pts.forEach(q=>{ const [x,y]=w2s(q); g.fillStyle= on? css_("--accent") : css_("--muted"); const r=on?4:2.6; g.fillRect(x-r,y-r,2*r,2*r) }) });
  sel.forEach(e=>{
    (e.vazios||[]).forEach(v=>{ const ok=entVazioOk(e,v); g.strokeStyle= ok? css_("--accent") : css_("--bad"); g.setLineDash([5,4]); g.lineWidth=1.6; g.beginPath(); v.forEach((q,i)=>{ const [x,y]=w2s(q); i?g.lineTo(x,y):g.moveTo(x,y) }); g.closePath(); g.stroke(); g.setLineDash([]);
      v.forEach(q=>{ const [x,y]=w2s(q); g.fillStyle= ok? css_("--accent") : css_("--bad"); g.fillRect(x-3.5,y-3.5,7,7) }) });
    // meios dos lados (cria vértice)
    e.pts.forEach((a,i)=>{ const b=e.pts[(i+1)%e.pts.length], [x,y]=w2s([(a[0]+b[0])/2,(a[1]+b[1])/2]); g.fillStyle=css_("--accent"); g.globalAlpha=0.55; g.beginPath(); g.arc(x,y,3,0,7); g.fill(); g.globalAlpha=1 });
  });
  if(sel.length===1){ const [x,y]=w2s(entEscalaPos(sel[0])); g.fillStyle=css_("--surface"); g.strokeStyle=css_("--accent"); g.lineWidth=2; g.beginPath(); g.rect(x-6,y-6,12,12); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(x-2.5,y+2.5); g.lineTo(x+2.5,y-2.5); g.moveTo(x+0.5,y-2.5); g.lineTo(x+2.5,y-2.5); g.lineTo(x+2.5,y-0.5); g.stroke() }
  if(ENT.marq){ const [a,b]=ENT.marq.map(w2s); g.fillStyle=css_("--accent"); g.globalAlpha=0.12; g.fillRect(Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1])); g.globalAlpha=1;
    g.strokeStyle=css_("--accent"); g.lineWidth=1.2; g.setLineDash([4,3]); g.strokeRect(Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1])); g.setLineDash([]) }
}

/* ---------- ponteiro ---------- */
function entHitEscala(px,py){ const sel=entSelList(); if(sel.length!==1) return false; const [x,y]=w2s_(entEscalaPos(sel[0])); return Math.hypot(x-px,y-py)<11 }
function entHitMeio(px,py){ let best=null, bd=10; entSelList().forEach(e=>e.pts.forEach((a,i)=>{ const b=e.pts[(i+1)%e.pts.length], A=w2s_(a), B=w2s_(b), d=Math.hypot((A[0]+B[0])/2-px,(A[1]+B[1])/2-py); if(d<bd){ bd=d; best={e,i} } })); return best }
function entCorpo(w){ const acha=f=>{ let best=null, ba=Infinity; entLista().forEach(e=>{ if(f(e)){ const a=Math.abs(G.sArea(e.pts)); if(a<ba){ ba=a; best=e } } }); return best };
  return acha(e=>entHit(e,w)) || acha(e=>G.pip(w,e.pts)) }   // primeiro a parte construída; depois o vazio (pátio) também agarra a edificação
const entCopia = e => JSON.parse(JSON.stringify({pts:e.pts, vazios:e.vazios||[]}));

/* devolve um "drag" (ou null para o fluxo normal de vértices/pan); chamado por views.js no pointerdown da ferramenta Editar */
function entDown(ev, px, py, w){
  if(typeof TOOL==="undefined" || TOOL!=="edit" || !entLista().length) return null;
  if(entHitEscala(px,py)){ const e=entSelList()[0], c=entCentro(e); return {type:"entscale", e, c, d0:Math.max(1e-6,Math.hypot(entEscalaPos(e)[0]-c[0], entEscalaPos(e)[1]-c[1])), snap:entCopia(e)} }
  const v=hitVertex(px,py);
  if(v && v.ent){ if(!ENT.sel.has(entId(v.ent))) entSelecionar(v.ent,"set"); return null }   // o fluxo normal arrasta o vértice
  if(v) return null;                                                                          // vértice do lote ou dos limites
  const mi=entHitMeio(px,py);
  if(mi){ const a=mi.e.pts[mi.i], b=mi.e.pts[(mi.i+1)%mi.e.pts.length]; mi.e.pts.splice(mi.i+1,0,[(a[0]+b[0])/2,(a[1]+b[1])/2]); return {type:"v", arr:mi.e.pts, i:mi.i+1, kind:"entorno", ent:mi.e} }
  // o ponto do meio do lote tem prioridade sobre o corpo da edificação
  if(hitMid(px,py)>=0) return null;
  const b=entCorpo(w);
  if(b){ if(ev.shiftKey) entSelecionar(b,"toggle"); else if(!ENT.sel.has(entId(b))) entSelecionar(b,"set");
    if(!ENT.sel.has(b.id)) return {type:"entnone"};
    return {type:"entmove", last:w, moved:false} }
  if(ev.shiftKey) return {type:"marq", a:w, shift:true};
  return null;                                                                                // vazio: pan (o clique sem arrastar limpa a seleção em entUp)
}
function entDrag(d, px, py){
  const w=s2w_(px,py);
  if(d.type==="entmove"){ const dx=w[0]-d.last[0], dy=w[1]-d.last[1]; if(!d.moved && Math.hypot(dx,dy)*cur().s<3) return; d.moved=true; entSelList().forEach(e=>entMove(e,dx,dy)); d.last=w; redraw2d() }
  else if(d.type==="entscale"){ const k=Math.max(0.1, Math.hypot(w[0]-d.c[0], w[1]-d.c[1])/d.d0), e=d.e; const s=JSON.parse(JSON.stringify(d.snap)); e.pts.forEach((q,i)=>{ q[0]=d.c[0]+(s.pts[i][0]-d.c[0])*k; q[1]=d.c[1]+(s.pts[i][1]-d.c[1])*k });
    (e.vazios||[]).forEach((v,j)=>v.forEach((q,i)=>{ q[0]=d.c[0]+(s.vazios[j][i][0]-d.c[0])*k; q[1]=d.c[1]+(s.vazios[j][i][1]-d.c[1])*k })); d.moved=true; redraw2d() }
  else if(d.type==="marq"){ ENT.marq=[d.a, w]; d.moved=true; redraw2d() }
}
/* devolve true quando tratou o fim do gesto */
function entUp(d){
  if(d.type==="pan"){ if(!d.moved && ENT.sel.size) entLimpaSel(); return false }
  if(d.type==="entmove"){ if(d.moved){ update(); entCardRefresh() } return true }
  if(d.type==="entscale"){ update(); entCardRefresh(); return true }
  if(d.type==="marq"){ const r=ENT.marq; ENT.marq=null; if(r && d.moved){ entNoRetangulo(entLista(), [r[0][0],r[0][1],r[1][0],r[1][1]]).forEach(e=>ENT.sel.add(entId(e))) } redraw2d(); entCardRefresh(); return true }
  if(d.type==="entnone") return true;
  return false;
}
/* clique duplo num vértice remove (mínimo de 3) */
c2.addEventListener("dblclick",e=>{ if(VIEW!=="impl"||TOOL!=="edit") return; const [px,py]=pos(e), v=hitVertex(px,py);
  if(v && (v.kind==="entorno"||v.kind==="vazio") && v.arr.length>3){ v.arr.splice(v.i,1); entApos("Vértice removido") } });

/* ---------- teclado ---------- */
document.addEventListener("keydown",e=>{
  if(typeof VIEW==="undefined" || VIEW!=="impl" || TOOL!=="edit") return;
  const a=document.activeElement; if(a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)) return;
  const sel=entSelList(); if(!sel.length) return;
  if(e.key==="Delete"||e.key==="Backspace"){ e.preventDefault(); entApagarSel(); return }
  if(e.key==="Escape"){ entLimpaSel(); return }
  const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]}[e.key];
  if(d){ e.preventDefault(); const p=(e.shiftKey?5:0.5); sel.forEach(x=>entMove(x,d[0]*p,d[1]*p)); clearTimeout(entTecla.t); entTecla.t=setTimeout(()=>entApos(),250); redraw2d() }
});
const entTecla={ t:0 };

/* ---------- ações ---------- */
function entApagarSel(){ const n=ENT.sel.size; if(!n) return; S.entorno=S.entorno.filter(e=>!ENT.sel.has(e.id)); ENT.sel=new Set(); entApos(n>1? `${n} edificações apagadas` : "Edificação apagada"); if(TAB==="clima") renderTab() }
function entEscalaSel(k){ entSelList().forEach(e=>entEscala(e,k)); entApos() }
function entGiraSel(g){ entSelList().forEach(e=>entGira(e,g)); entApos() }
function entDuplicaSel(){ const novos=entSelList().map(e=>entDuplica(e)); if(!novos.length) return; S.entorno.push(...novos); ENT.sel=new Set(novos.map(entId)); entApos(novos.length>1? "Duplicadas" : "Duplicada"); if(TAB==="clima") renderTab() }
function entPatioSel(){ let n=0; entSelList().forEach(e=>{ if((e.vazios||[]).length) return; const v=entPatio(e,0.25); if(v){ (e.vazios=e.vazios||[]).push(v); n++ } }); n? entApos(n>1? `Pátio criado em ${n} edificações` : "Pátio criado — arraste os vértices para ajustar") : toast("Não coube um pátio nessa edificação (ou ela já tem vazio)") }
function entVazioDesenha(){ if(entSelList().length!==1){ toast("Selecione uma edificação"); return } if(VIEW!=="impl") setView("impl"); DRAW=[]; setTool("draw","vazio") }
function entLimpaVazios(){ entSelList().forEach(e=>{ delete e.vazios }); entApos("Vazios removidos") }
function entAlturaSel(h){ if(!(h>=0)) return; entSelList().forEach(e=>{ e.h=h }); clearTimeout(entAlturaSel.t); entAlturaSel.t=setTimeout(()=>entApos(),350) }
function entNomeSel(n){ const s=entSelList(); if(s.length===1){ s[0].nome=n; save() } }
function entNovaCaixa(){
  if(VIEW!=="impl") setView("impl");
  const V=cur(), r=c2.getBoundingClientRect(), c=s2w_(r.width/2, r.height/2), e=entNovo(c,20,20,24,"Edificação "+(S.entorno.length+1));
  S.entorno.push(e); ENT.sel=new Set([entId(e)]); setTool("edit"); entApos("Caixa criada — arraste para posicionar e use o quadrado do canto para redimensionar"); if(TAB==="clima") renderTab();
}
function entEnquadrar(){
  const L=entLista(); if(!L.length) return; if(VIEW!=="impl") setView("impl");
  const r=c2.getBoundingClientRect(); VS.impl=fitView([S.lote.pts, ...L.map(e=>e.pts)], r.width, r.height, 1.1); redraw2d();
}
function entSelTodas(){ ENT.sel=new Set(entLista().map(entId)); redraw2d(); entCardRefresh() }
function entApagarOsm(b){ if(!b.dataset.arm){ b.dataset.arm=1; b.textContent="Confirmar"; b.classList.add("on"); return } S.entorno=S.entorno.filter(e=>!e.osm); entApos("Edificações do OSM apagadas"); renderTab() }
function entApagarTodas(b){ if(!b.dataset.arm){ b.dataset.arm=1; b.textContent="Confirmar"; b.classList.add("on"); return } S.entorno=[]; ENT.sel=new Set(); entApos("Entorno apagado"); renderTab() }
Object.assign(ACT,{ entNova:()=>entNovaCaixa(), entEnq:()=>entEnquadrar(), entTodas:()=>entSelTodas(), entNenhuma:()=>entLimpaSel(), entApagaOsm:b=>entApagarOsm(b), entApagaTodas:b=>entApagarTodas(b),
  entApagaSel:()=>entApagarSel(), entMais:()=>entEscalaSel(1.1), entMenos:()=>entEscalaSel(1/1.1), entGiraD:()=>entGiraSel(15), entGiraE:()=>entGiraSel(-15),
  entDup:()=>entDuplicaSel(), entPatio:()=>entPatioSel(), entVazio:()=>entVazioDesenha(), entVazioX:b=>{ const e=entSelList()[0]; if(e&&e.vazios){ e.vazios.splice(+b.dataset.i,1); if(!e.vazios.length) delete e.vazios; entApos() } }, entVazios0:()=>entLimpaVazios(),
  entSelItem:b=>{ const e=S.entorno[+b.dataset.i]; if(e){ entSelecionar(e,"set"); entEnquadraSel() } } });
function entEnquadraSel(){ const s=entSelList(); if(!s.length) return; if(VIEW!=="impl") setView("impl"); const r=c2.getBoundingClientRect(); VS.impl=fitView([S.lote.pts, ...s.map(e=>e.pts)], r.width, r.height, 1.5); redraw2d() }

/* ---------- barra flutuante ---------- */
function entCss(){
  if(document.getElementById("entCss")) return;
  const st=document.createElement("style"); st.id="entCss";
  st.textContent=`.entbar{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);z-index:6;display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:center;max-width:min(calc(100% - 24px),860px);padding:7px 9px;border-radius:14px;background:var(--glass);-webkit-backdrop-filter:blur(16px) saturate(150%);backdrop-filter:blur(16px) saturate(150%);border:1px solid var(--glass-line);box-shadow:var(--shadow);font-size:12px}
.entbar[hidden]{display:none}
.entbar .eg{display:flex;gap:4px;align-items:center}
.entbar .eg+.eg{border-left:1px solid var(--line);padding-left:6px}
.entbar .btn{padding:5px 9px;font-size:12px;border-radius:9px;white-space:nowrap}
.entbar .btn.warn{color:var(--bad)}
.entbar .inp{height:30px;min-height:0}
.entbar .inp input{padding:0 8px;font-size:12px;min-width:0}
.entbar .nm{width:150px}.entbar .al{width:74px}
.entbar .cnt{font-weight:600;padding:0 4px;color:var(--ink)}
.entbar .chip{display:inline-flex;gap:4px;align-items:center;padding:3px 4px 3px 8px;border:1px solid var(--line);border-radius:999px;color:var(--muted)}
.entbar .chip button{border:0;background:transparent;color:var(--muted);cursor:pointer;font-size:14px;line-height:1;padding:0 4px}
@media (max-width:900px){.entbar{bottom:64px;left:8px;right:8px;transform:none;max-width:none}.entbar .eg+.eg{border-left:0;padding-left:0}.entbar .nm{width:120px}}`;
  document.head.appendChild(st);
}
function entBarHTML(sel){
  const um=sel.length===1, e=sel[0], h=sel.every(x=>x.h===sel[0].h)? nf(sel[0].h,1).replace(",",".") : "";
  const nv=um? (e.vazios||[]) : [];
  return `<div class="eg"><span class="cnt">${um? "Edificação" : sel.length+" edificações"}</span>
      ${um? `<div class="inp nm"><input class="t" id="entNome" value="${esc(e.nome||"")}" aria-label="Nome da edificação" placeholder="Nome"></div>` : ""}
      <div class="inp al"><input type="number" id="entAlt" min="0" step="0.5" value="${h}" placeholder="—" aria-label="Altura"><em>m</em></div></div>
    <div class="eg"><button class="btn" data-act="entMenos" title="Reduzir 10%">− Tamanho</button><button class="btn" data-act="entMais" title="Aumentar 10%">+ Tamanho</button>
      <button class="btn" data-act="entGiraE" title="Girar 15° anti-horário">↺</button><button class="btn" data-act="entGiraD" title="Girar 15° horário">↻</button></div>
    <div class="eg"><button class="btn" data-act="entPatio" title="Cria um pátio central (vazio) na edificação">Pátio</button>
      ${um? `<button class="btn" data-act="entVazio" title="Desenhe o contorno do vazio dentro da edificação">Desenhar vazio</button>` : ""}
      ${nv.map((v,i)=>`<span class="chip">${nf(Math.abs(G.sArea(v)),0)} m²${entVazioOk(e,v)? "" : " · fora"}<button data-act="entVazioX" data-i="${i}" aria-label="Remover vazio" title="Remover este vazio">×</button></span>`).join("")}
      ${sel.some(x=>(x.vazios||[]).length)&&(!um||nv.length>1)? `<button class="btn" data-act="entVazios0">Limpar vazios</button>` : ""}</div>
    <div class="eg"><button class="btn" data-act="entDup">Duplicar</button><button class="btn warn" data-act="entApagaSel" title="Delete">Apagar</button><button class="btn ghost" data-act="entNenhuma" title="Esc">Soltar</button></div>`;
}
function entBarRefresh(){
  let bar=document.getElementById("entBar");
  const visivel = typeof VIEW!=="undefined" && VIEW==="impl" && TOOL==="edit" && ENT.sel.size>0;
  if(!visivel){ if(bar) bar.hidden=true; return }
  entPoda(); const sel=entSelList();
  if(!sel.length){ if(bar) bar.hidden=true; return }
  if(!bar){ entCss(); bar=document.createElement("div"); bar.className="entbar"; bar.id="entBar"; document.getElementById("view").appendChild(bar);
    bar.addEventListener("click",ev=>{ const b=ev.target.closest("[data-act]"); if(b && ACT[b.dataset.act]){ ev.preventDefault(); ACT[b.dataset.act](b) } });
    bar.addEventListener("input",ev=>{ if(ev.target.id==="entAlt") entAlturaSel(parseFloat(ev.target.value)); if(ev.target.id==="entNome") entNomeSel(ev.target.value) });
    bar.addEventListener("pointerdown",ev=>ev.stopPropagation()); }
  bar.hidden=false;
  const sig=sel.map(e=>e.id+":"+(e.vazios||[]).length+":"+(e.pts.length)).join("|")+"|"+sel.length;
  const foco=document.activeElement && bar.contains(document.activeElement) && document.activeElement.tagName==='INPUT';
  if(sig!==ENT.sig && !foco){ ENT.sig=sig; bar.innerHTML=entBarHTML(sel) }
  else if(!foco){ const i=document.getElementById("entAlt"); if(i){ const h=sel.every(x=>x.h===sel[0].h)? String(+(+sel[0].h).toFixed(1)) : ""; if(i.value!==h) i.value=h } }
  // digitando num campo da barra: não recria (a barra é refeita quando o foco sai)
}

/* ---------- card no inspetor (Terreno e Clima) ---------- */
function entCardInner(){
  const L=entLista(), n=L.length, osm=L.filter(e=>e.osm).length, sel=ENT.sel.size;
  const sp=n? `${n} edificaç${n>1?"ões":"ão"}${osm? ` · ${osm} do OSM`:""}${sel? ` · ${sel} selecionada${sel>1?"s":""}`:""}` : "nenhuma ainda";
  return `<p class="note">Na Implantação, clique numa edificação para selecionar e arrastar. <b>Shift</b> soma; <b>Shift + arrastar</b> no vazio seleciona várias; <b>Delete</b> apaga. Com uma selecionada, a barra na base muda altura, tamanho, giro, pátios e vazios.</p>
    <div class="row"><button class="btn sm pri" data-act="entNova">Nova caixa</button><button class="btn sm" data-act="entEnq" ${n?"":"disabled"}>Ver entorno</button><button class="btn sm" data-act="entTodas" ${n?"":"disabled"}>Selecionar todas</button>${sel?`<button class="btn sm ghost" data-act="entNenhuma">Soltar</button><button class="btn sm ghost" data-act="entApagaSel">Apagar selecionadas</button>`:""}</div>
    ${osm? `<div class="row"><button class="btn sm ghost" data-act="entApagaOsm">Apagar as do OSM</button>${n>osm?`<button class="btn sm ghost" data-act="entApagaTodas">Apagar todas</button>`:""}</div>` : (n? `<div class="row"><button class="btn sm ghost" data-act="entApagaTodas">Apagar todas</button></div>` : "")}
    <p class="note" id="entResumo">${sp}</p>`;
}
const entCardHTML = () => CARD("Edificações do entorno", `<div id="entCardBody">${entCardInner()}</div>`, {details:true, key:"entedit", aside:`<span id="entAside">${entLista().length}</span>`});
function entCardRefresh(){ const b=document.getElementById("entCardBody"); if(b && !typing(b)){ const h=entCardInner(); if(b.innerHTML!==h) b.innerHTML=h } const a=document.getElementById("entAside"); if(a) a.textContent=entLista().length }
addCard("terreno",{ key:"entedit", order:55, html:entCardHTML });
addCard("clima",{ key:"entedit", order:55, html:entCardHTML });
