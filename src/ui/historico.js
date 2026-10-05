/* ================= desfazer / refazer =================
   Pilha de diferenças JSON sobre S (histDiff/histPatch em src/calc/histdiff.js), até 200 passos.
   Um passo por mudança confirmada: save() chama histTouch(); o passo é fechado 500 ms depois da última mudança
   e nunca com o ponteiro apertado (arraste de slider, de vértice ou da rampa vira um passo só, ao soltar).
   Ctrl+Z · Ctrl+Shift+Z · Ctrl+Y e os botões do topo (#undoBtn/#redoBtn). */
const HIST = { base:null, baseJSON:"", undo:[], redo:[], t:0, pend:false, busy:false, max:200, mudou:false };
function histReset(){ HIST.baseJSON=JSON.stringify(S); HIST.base=JSON.parse(HIST.baseJSON); HIST.undo=[]; HIST.redo=[]; clearTimeout(HIST.t); HIST.t=0; HIST.pend=false; histUI() }
function histTouch(){ clearTimeout(HIST.t); HIST.pend=true; HIST.t=setTimeout(()=>{ HIST.t=0; if(!HIST.busy) histCommit() }, 500); histUI(); if(typeof estTouch==="function") estTouch() }
/* fecha o passo pendente (se o estado mudou desde o último) */
function histCommit(){
  clearTimeout(HIST.t); HIST.t=0; HIST.pend=false;
  if(HIST.base==null) return histReset();
  const j=JSON.stringify(S); if(j===HIST.baseJSON){ histUI(); return false }
  const cur=JSON.parse(j), fwd=histDiff(HIST.base,cur), back=histDiff(cur,HIST.base);
  HIST.base=cur; HIST.baseJSON=j;
  if(!fwd.length){ histUI(); return false }
  HIST.undo.push({fwd, back, t:Date.now()}); if(HIST.undo.length>HIST.max) HIST.undo.splice(0, HIST.undo.length-HIST.max);
  HIST.redo=[]; HIST.mudou=true; histUI(); return true;
}
/* troca o estado inteiro (desfazer, refazer) e redesenha tudo */
function histSet(obj){
  HIST.base=obj; HIST.baseJSON=JSON.stringify(obj);
  S=JSON.parse(HIST.baseJSON); HIST.mudou=true;
  const pn=document.getElementById("projName"); if(pn) pn.value=S.nome;
  renderTab();
  const j=JSON.stringify(S); if(j!==HIST.baseJSON){ HIST.baseJSON=j; HIST.base=JSON.parse(j) }   // normalizações do update()
  clearTimeout(HIST.t); HIST.t=0; HIST.pend=false; histUI();
}
function histUndo(){
  histCommit(); const st=HIST.undo.pop(); if(!st){ toast("Nada para desfazer"); return false }
  HIST.redo.push(st); histSet(histPatch(HIST.base, st.back)); toast("Alteração desfeita"); return true;
}
function histRedo(){
  histCommit(); const st=HIST.redo.pop(); if(!st){ toast("Nada para refazer"); return false }
  HIST.undo.push(st); histSet(histPatch(HIST.base, st.fwd)); toast("Alteração refeita"); return true;
}
function histUI(){
  const u=document.getElementById("undoBtn"), r=document.getElementById("redoBtn");
  if(u){ u.disabled=!HIST.undo.length && !(HIST.pend && JSON.stringify(S)!==HIST.baseJSON); u.title = `Desfazer (Ctrl+Z)${HIST.undo.length? " · "+HIST.undo.length+" passo"+(HIST.undo.length>1?"s":"") : ""}` }
  if(r){ r.disabled=!HIST.redo.length; r.title = "Refazer (Ctrl+Shift+Z)" }
}
function histInit(){
  histReset();
  // ponteiro apertado = mudança em andamento (arraste): o passo só fecha ao soltar
  document.addEventListener("pointerdown", ()=>{ HIST.busy=true }, true);
  const solta=()=>{ if(!HIST.busy) return; HIST.busy=false; if(HIST.pend){ clearTimeout(HIST.t); HIST.t=setTimeout(()=>{ HIST.t=0; if(!HIST.busy) histCommit() }, 500) } };
  window.addEventListener("pointerup", solta, true); window.addEventListener("pointercancel", solta, true); window.addEventListener("blur", solta);
  document.addEventListener("keydown", e=>{
    if(!(e.ctrlKey||e.metaKey) || e.altKey) return;
    const k=(e.key||"").toLowerCase(); if(k!=="z" && k!=="y") return;
    const a=document.activeElement;
    if(a && a.isContentEditable) return;
    if(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !/^(range|checkbox|radio|button)$/.test(a.type)){
      if(!a.dataset || !a.dataset.p || a.dataset.t==="s") return;   // texto livre: desfazer nativo do campo
      a.blur();                                                    // campo numérico: aplica o valor e desfaz no estudo
    }
    e.preventDefault();
    if(k==="y" || e.shiftKey) histRedo(); else histUndo();
  });
  const u=document.getElementById("undoBtn"), r=document.getElementById("redoBtn");
  if(u) u.addEventListener("click", ()=>histUndo());
  if(r) r.addEventListener("click", ()=>histRedo());
  histUI();
}
