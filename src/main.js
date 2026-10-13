/* ================= início ================= */
const pn=document.getElementById("projName"); pn.value=S.nome; pn.addEventListener("input",()=>{ S.nome=pn.value; save() });
document.getElementById("pdfTop").addEventListener("click",()=>calcPronto().then(()=>exportPDF()));
// tema claro / escuro (lembra a escolha; sem escolha segue o sistema)
const temaSis=()=>matchMedia("(prefers-color-scheme: dark)").matches? "dark" : "light";
function setTema(t){ document.documentElement.setAttribute("data-theme", t); const b=document.getElementById("themeBtn"); b.querySelector(".tl").textContent = t==="dark"? "Claro" : "Escuro"; b.title = t==="dark"? "Mudar para o tema claro" : "Mudar para o tema escuro" }
setTema(LS.get("gabarito.tema")||temaSis());
document.getElementById("themeBtn").addEventListener("click",()=>{ const t=document.documentElement.getAttribute("data-theme")==="dark"? "light" : "dark"; LS.set("gabarito.tema",t); setTema(t) });
try{ matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>{ if(!LS.get("gabarito.tema")) setTema(temaSis()) }) }catch(e){}
new MutationObserver(()=>{ clearTimeout(window._thT); window._thT=setTimeout(()=>update(),30) }).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
new ResizeObserver(()=>{ if(VIEW==="3d") size3d(); else { size2d(); redraw2d() } }).observe(document.getElementById("view"));
calcInit(); calcInstalar();   // cálculo completo em segundo plano (Web Worker), com volta automática para a página
init3d(); size3d(); renderTab(); setView(stepView()||"3d"); fit3d(); sunUI(); applySun();
// trilho preenchido dos sliders
function paintRange(r){ const mn=+r.min||0, mx=+r.max||100, v=+r.value; r.style.setProperty("--fill", ((v-mn)/((mx-mn)||1)*100)+"%") }
document.addEventListener("input",e=>{ if(e.target.type==="range") paintRange(e.target) },true);
new MutationObserver(()=>document.querySelectorAll('input[type=range]').forEach(paintRange)).observe(document.getElementById("tabbody"),{childList:true});
document.querySelectorAll('input[type=range]').forEach(paintRange);
// desfazer/refazer (começa do estado já normalizado) e repositório de estudos/versões (IndexedDB; no app web com login,
// a nuvem — authInit resolve na hora fora do app web, ver src/ui/auth.js)
histInit(); authInit().then(estInit).then(authDepois);
