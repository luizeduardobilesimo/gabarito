/* ================= início ================= */
const pn=document.getElementById("projName"); pn.value=S.nome; pn.addEventListener("input",()=>{ S.nome=pn.value; save() });
document.getElementById("pdfTop").addEventListener("click",()=>calcPronto().then(()=>exportPDF()));
// tema claro / escuro (lembra a escolha; sem escolha segue o sistema) — o botão fica no menu "…" do topo
const temaSis=()=>matchMedia("(prefers-color-scheme: dark)").matches? "dark" : "light";
function setTema(t){ document.documentElement.setAttribute("data-theme", t); const b=document.getElementById("themeBtn"); b.querySelector(".tl").textContent = t==="dark"? "Tema claro" : "Tema escuro"; b.title = t==="dark"? "Mudar para o tema claro" : "Mudar para o tema escuro" }
setTema(LS.get("gabarito.tema")||temaSis());
document.getElementById("themeBtn").addEventListener("click",()=>{ const t=document.documentElement.getAttribute("data-theme")==="dark"? "light" : "dark"; LS.set("gabarito.tema",t); setTema(t) });
try{ matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>{ if(!LS.get("gabarito.tema")) setTema(temaSis()) }) }catch(e){}
new MutationObserver(()=>{ clearTimeout(window._thT); window._thT=setTimeout(()=>update(),30) }).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
new ResizeObserver(()=>{ if(VIEW==="3d") size3d(); else { size2d(); redraw2d() } }).observe(document.getElementById("view"));
calcInit(); calcInstalar();   // cálculo completo em segundo plano (Web Worker), com volta automática para a página
navInit();                    // topo, menus, régua e folha do celular (src/ui/navegacao.js)
init3d(); size3d(); renderTab(); setView(stepView()||"3d"); fit3d(); sunUI(); applySun();
// trilho preenchido dos sliders
function paintRange(r){ const mn=+r.min||0, mx=+r.max||100, v=+r.value; r.style.setProperty("--fill", ((v-mn)/((mx-mn)||1)*100)+"%") }
document.addEventListener("input",e=>{ if(e.target.type==="range") paintRange(e.target) },true);
new MutationObserver(()=>document.querySelectorAll('input[type=range]').forEach(paintRange)).observe(document.getElementById("tabbody"),{childList:true});
document.querySelectorAll('input[type=range]').forEach(paintRange);
// desfazer/refazer (começa do estado já normalizado) e repositório de estudos/versões (IndexedDB; no app web com login,
// a nuvem — authInit resolve na hora fora do app web, ver src/ui/auth.js)
// entrada (depois de estInit, com a lista de estudos pronta): 1ª visita → assInicio (src/ui/assistente.js, que já abre a tela
// inicial quando ela existe); senão a tela "Meus estudos" (src/ui/inicio.js) quando ela pedir. Nunca as duas.
function entradaInicial(){
  if(typeof assInicio==="function" && assInicio()) return;
  if(typeof inicioDeveAbrir==="function" && typeof inicioAbrir==="function"){ try{ if(inicioDeveAbrir()) inicioAbrir() }catch(e){ console.error("[início]", e) } }
}
histInit(); authInit().then(estInit).then(authDepois).then(entradaInicial, e=>{ console.error("[início]", e); entradaInicial() });
