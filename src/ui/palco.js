/* ================= palco: barra de vistas =================
   A barra de vistas (#view .viewbar) pode ocupar uma ou duas linhas (largura da tela, pavimentos, torres…).
   A altura dela vai para a variável CSS --vbh do #view e para VBH: as sobreposições do palco (ferramentas, sol,
   calibração, legenda do vento, seta do norte) ficam logo abaixo, sem cobrir a barra. */
let VBH = 52;
(function palcoBarra(){
  const vb=document.querySelector("#view .viewbar"), v=document.getElementById("view"); if(!vb || !v || typeof ResizeObserver==="undefined") return;
  const mede=()=>{ const r=vb.getBoundingClientRect(), rv=v.getBoundingClientRect(); if(!r.height) return; const h=Math.round(r.bottom-rv.top);
    if(h>0 && h!==VBH){ VBH=h; v.style.setProperty("--vbh", h+"px");
      // celular: a barra mudou de altura (pavimentos, torres…) → a planta se ajusta de novo à faixa livre
      if(typeof navCel==="function" && navCel() && typeof fit2d==="function" && typeof VIEW!=="undefined" && VIEW!=="3d" && window._last) try{ fit2d(); return }catch(e){}
      if(typeof redraw2d==="function" && window._last) try{ redraw2d() }catch(e){} } };
  new ResizeObserver(mede).observe(vb); v.style.setProperty("--vbh", VBH+"px"); requestAnimationFrame(mede);
})();
