/* ================= casca da UX v3: topo, etapas, régua, celular (docs/UX-v3.md §5–§7) =================
   O desenho das etapas e da régua mora em src/ui.js (STEPS, railHTML, railStatus, renderKPIs, renderTab); aqui ficam:
   - o CSS da casca nova (topo com o stepper, régua de 6 KPIs + "⋯", rodapé "Próximo passo", folha do celular, menus);
   - os menus do topo: nome do estudo ▾ (novo, meus estudos, duplicar, versão, alternativa, abrir .json, exemplo) e "…"
     (buscar, glossário, tema, DXF + IFC, .json, resumo, link, marca); a marca do topo abre "Meus estudos" (inicioAbrir);
   - o anel do checklist (progressoAnelHTML, src/ui/progresso.js) ao lado do nome; "Salvo / Salvando…" (navSalvo);
   - o stepper muda de lugar com a largura: no topo (≥ 1100 px), no topo do inspetor só com números (901–1099 px) e
     barra inferior com 5 itens no celular;
   - celular (≤ 900 px): o inspetor vira uma folha deslizante com 3 alturas (espiada 28% · média 58% · cheia 92%),
     puxador (arrastar ou tocar), KPIs (3) no topo da folha; --folha (px cobertos pela folha + barra) dimensiona o palco.
     Ferramenta de desenho ligada → a folha desce para a espiada sozinha; trocar de etapa → média;
   - popover "⋯" da régua com os outros indicadores (navKpiMais).
   Pontos de contato (todos opcionais): inicioAbrir (tela inicial), assAbrir (assistente), estNovo/versaoSalvar/ACT.estDup
   (estudos), abrirJson (P6), apLink/marca (Entrega), buscaAbrir (src/ui/busca.js), irPara (ui.js). */

(function navCSS(){ const s=document.createElement("style"); s.id="navCss"; s.textContent=`
/* ---------- estrutura: sem trilho lateral; o palco ganha a largura ---------- */
.folha-puxa{display:none}
.app{grid-template-columns:clamp(360px,28vw,440px) minmax(0,1fr);grid-template-rows:var(--topbar-h) minmax(0,1fr)}
.app>.panel{grid-column:1;grid-row:2}
.app>.stage{grid-column:2;grid-row:2}
/* ---------- topo ---------- */
.top{display:flex;align-items:center;gap:12px;padding:0 12px 0 14px;position:relative;z-index:20}
.top .brand{border:0;background:none;padding:6px 8px 6px 6px;margin:0;border-radius:10px;cursor:pointer;font:inherit;color:var(--ink);transition:background .15s var(--ease)}
.top .brand:hover{background:var(--soft)}
.top .proj{flex:1.6 1 0;min-width:0;display:flex;align-items:center;gap:6px}
.nv-est{position:relative;display:flex;align-items:center;min-width:0;flex:0 1 auto;border-radius:10px;transition:background .15s var(--ease)}
.nv-est:hover{background:var(--soft)}
.top .proj .nv-est input{width:auto;field-sizing:content;min-width:7ch;max-width:min(260px,22vw);padding:6px 2px 6px 9px;background:transparent}
.top .proj .nv-est input:hover{background:transparent}
.nv-chev{flex:none;display:grid;place-items:center;width:28px;height:32px;border:0;background:none;border-radius:8px;color:var(--muted);cursor:pointer;padding:0}
.nv-chev:hover,.nv-chev[aria-expanded="true"]{color:var(--ink);background:var(--soft)}
.nv-chev svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;transition:transform .18s var(--ease)}
.nv-chev[aria-expanded="true"] svg{transform:rotate(180deg)}
.nv-anel{display:inline-flex;flex:none}
.nv-anel:empty{display:none}
.nv-salvo{display:inline-flex;align-items:center;gap:6px;flex:none;font-size:11.5px;color:var(--faint);white-space:nowrap;padding-left:2px}
.nv-salvo i{width:6px;height:6px;border-radius:50%;background:var(--ok);opacity:.7}
.nv-salvo.ativo i{background:var(--brand);opacity:1;box-shadow:0 0 0 3px var(--brand-soft);animation:nvPulso 1s var(--ease) infinite}
@keyframes nvPulso{50%{opacity:.45}}
.top .acts{flex:1 1 0;min-width:0;display:flex;justify-content:flex-end;align-items:center;gap:6px}
.top .acts .btn.icon{padding:0;width:36px;height:36px}
.top .acts .btn .ico{width:15px;height:15px}
.nv-mais{position:relative}
#buscaBtn svg,#maisBtn svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
#maisBtn svg circle{fill:currentColor;stroke:none}
#maisBtn[aria-expanded="true"]{background:var(--soft);color:var(--ink)}
/* menus do topo */
.nv-menu{position:absolute;left:0;top:calc(100% + 8px);z-index:40;min-width:248px;background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow-pop);padding:6px;display:grid;gap:1px;animation:nvIn .16s var(--ease) both}
.nv-menu.r{left:auto;right:0}
.nv-menu[hidden]{display:none}
@keyframes nvIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.nv-menu button{display:flex;align-items:center;gap:11px;width:100%;text-align:left;border:0;background:none;padding:8px 10px;border-radius:9px;font:inherit;font-size:13.5px;font-weight:500;color:var(--ink-2);cursor:pointer;white-space:nowrap;min-height:36px}
.nv-menu button:hover,.nv-menu button:focus-visible{background:var(--soft);color:var(--ink);outline:none}
.nv-menu button svg{width:17px;height:17px;flex:none;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;color:var(--muted)}
.nv-menu button:hover svg{color:var(--ink)}
.nv-menu button.arm{background:var(--bad-soft);color:var(--bad)}
.nv-menu button.arm svg{color:var(--bad)}
.nv-menu kbd{margin-left:auto;font-family:var(--f-sans);font-size:11px;color:var(--faint);border:1px solid var(--line);border-radius:6px;padding:1px 6px}
.nv-menu hr{border:0;border-top:1px solid var(--line);margin:5px 4px}
.nv-menu .nv-cel{display:none}
.nv-menu .tl{overflow:hidden;text-overflow:ellipsis}
/* ---------- stepper (as 5 etapas) ---------- */
.top .rail{all:unset;display:flex;align-items:center;flex:none;gap:2px;position:static}
.top .rail .ln{width:16px;height:1.5px;border-radius:2px;background:var(--line-2);flex:none}
.top .rail .ln.ok{background:color-mix(in srgb,var(--ok) 45%,var(--line-2))}
.top .rail button{all:unset;box-sizing:border-box;position:relative;display:flex;align-items:center;gap:8px;padding:6px 11px 6px 6px;border-radius:999px;cursor:pointer;color:var(--muted);font-size:13px;font-weight:550;letter-spacing:-.005em;white-space:nowrap;transition:background .15s var(--ease),color .15s var(--ease)}
.top .rail button:hover{background:var(--soft);color:var(--ink)}
.top .rail button:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
.top .rail button::before{display:none}
.top .rail .n{position:relative;display:grid;place-items:center;width:23px;height:23px;border-radius:50%;border:1.5px solid var(--line-2);font-size:11.5px;font-weight:650;color:var(--muted);background:var(--surface);flex:none;transition:background .2s var(--ease),border-color .2s var(--ease),color .2s var(--ease)}
.top .rail .n svg{display:none;width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.top .rail button.feito .n{background:var(--ok-soft);border-color:transparent;color:var(--ok)}
.top .rail button.feito .n b{display:none}
.top .rail button.feito .n svg{display:block}
.top .rail button[aria-current="page"]{color:var(--ink);font-weight:650;background:var(--soft)}
.top .rail button[aria-current="page"] .n{background:var(--sel);border-color:var(--sel);color:var(--sel-ink)}
.top .rail button[aria-current="page"] .n b{display:block}
.top .rail button[aria-current="page"] .n svg{display:none}
.top .rail .ic{display:none}
.top .rail .st{position:absolute;top:3px;left:24px;width:7px;height:7px;border-radius:50%;box-shadow:0 0 0 2px var(--surface)}
.top .rail .st.ok{display:none}
.top .rail button:hover .st,.top .rail button[aria-current="page"] .st{box-shadow:0 0 0 2px var(--soft)}
.top .rail .opc{font-weight:400;color:var(--faint);font-size:11.5px}
/* stepper no topo do inspetor (901–1099 px): só números, o rótulo da etapa atual por extenso */
.panel>.rail{all:unset;display:flex;align-items:center;gap:2px;padding:10px 14px 0;background:var(--surface)}
.panel>.rail .ln{flex:1;height:1.5px;background:var(--line-2);min-width:8px}
.panel>.rail button{all:unset;box-sizing:border-box;position:relative;display:flex;align-items:center;gap:7px;padding:4px;border-radius:999px;cursor:pointer;color:var(--muted);font-size:12.5px;font-weight:600}
.panel>.rail button:hover{background:var(--soft)}
.panel>.rail button::before{display:none}
.panel>.rail .n{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;border:1.5px solid var(--line-2);font-size:11.5px;font-weight:650;background:var(--surface)}
.panel>.rail .n svg{display:none;width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.panel>.rail button.feito .n{background:var(--ok-soft);border-color:transparent;color:var(--ok)}
.panel>.rail button.feito .n b{display:none}.panel>.rail button.feito .n svg{display:block}
.panel>.rail button[aria-current="page"]{color:var(--ink);padding-right:10px}
.panel>.rail button[aria-current="page"] .n{background:var(--sel);border-color:var(--sel);color:var(--sel-ink)}
.panel>.rail button[aria-current="page"] .n b{display:block}.panel>.rail button[aria-current="page"] .n svg{display:none}
.panel>.rail button:not([aria-current="page"]) .lb,.panel>.rail .ic,.panel>.rail .opc{display:none}
.panel>.rail .st{position:absolute;top:2px;left:22px;width:7px;height:7px;border-radius:50%;box-shadow:0 0 0 2px var(--surface)}
.panel>.rail .st.ok{display:none}
/* ---------- cabeçalho e rodapé do inspetor ---------- */
.phead .q{margin:0;color:var(--muted);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pfoot{display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-areas:"dica dica" "ant prox";gap:7px 8px;padding:10px 12px 12px}
.pfoot .nv-dica{grid-area:dica;display:flex;align-items:center;gap:7px;min-width:0;font-size:12px;color:var(--muted);line-height:1.3}
.pfoot .nv-dica span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pfoot .nv-dica .dot{width:6px;height:6px}
.pfoot .nv-ant{grid-area:ant;max-width:150px}
.pfoot .nv-ant span{overflow:hidden;text-overflow:ellipsis}
.pfoot .nv-prox{grid-area:prox;min-height:38px;font-size:13.5px;font-weight:600;overflow:hidden}
.pfoot .nv-prox span{overflow:hidden;text-overflow:ellipsis}
.pfoot .nv-prox:only-child,.pfoot .nv-ant+.nv-prox{justify-self:stretch}


/* ---------- régua de indicadores: 6 + "⋯" ---------- */
.kpis{grid-template-columns:repeat(6,minmax(0,1fr)) 52px}
.kpis .kpi{cursor:pointer;text-align:left;transition:background .15s var(--ease);outline-offset:-2px}
.kpis .kpi:hover{background:var(--surface-2)}
.kpis .kpi .l .dot{width:6px;height:6px}
.kpis .kpi .v.bad{color:var(--bad)}
@media (max-width:1340px){ .kpis .kpi .lx{display:none} }
.kpis .kpi-mais{all:unset;box-sizing:border-box;display:grid;place-items:center;cursor:pointer;color:var(--muted);border-left:1px solid var(--line);transition:background .15s var(--ease),color .15s var(--ease)}
.kpis .kpi-mais:hover,.kpis .kpi-mais[aria-expanded="true"]{background:var(--surface-2);color:var(--ink)}
.kpis .kpi-mais:focus-visible{outline:2px solid var(--brand);outline-offset:-2px}
.kpis .kpi-mais svg{width:20px;height:20px;fill:currentColor}
.nv-kpop{position:fixed;z-index:62;width:300px;background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);box-shadow:var(--shadow-pop);padding:8px;animation:nvIn .16s var(--ease) both}
.nv-kpop[hidden]{display:none}
.nv-kpop .kh{display:flex;align-items:center;justify-content:space-between;padding:6px 8px 8px;font-size:10.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.nv-kpop .kh button{border:0;background:none;color:var(--muted);font-size:17px;line-height:1;padding:2px 6px;border-radius:7px;cursor:pointer}
.nv-kpop .kh button:hover{background:var(--soft);color:var(--ink)}
.nv-kpop .kr{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 12px;align-items:baseline;width:100%;border:0;background:none;text-align:left;padding:8px 10px;border-radius:10px;font:inherit;color:var(--ink);cursor:pointer}
.nv-kpop .kr:hover{background:var(--soft)}
.nv-kpop .kr .l{display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--ink-2);font-weight:500}
.nv-kpop .kr .l .dot{width:6px;height:6px}
.nv-kpop .kr .v{font-size:14.5px;font-weight:600;letter-spacing:-.02em;text-align:right;white-space:nowrap}
.nv-kpop .kr .v.bad{color:var(--bad)}
.nv-kpop .kr .s{grid-column:1/-1;font-size:11.5px;color:var(--muted);padding-left:13px}
/* ---------- médio (1100–1499): topo compacto ---------- */
@media (min-width:901px) and (max-width:1499px){
  .top .brand .by{display:none}
  .top #apTop .lb,.top #pdfTop .lb{display:none}
  .top #apTop,.top #pdfTop{padding:0;width:36px;height:36px}
  .nv-salvo span{display:none}
}
@media (min-width:901px) and (max-width:1299px){
  .top .brand .wm,.top .sep{display:none}
  .top .rail button{padding:5px 9px 5px 5px;font-size:12.5px;gap:6px}
  .top .rail .ln{width:10px}
  .top .rail .opc{display:none}
}
@media (min-width:901px) and (max-width:1099px){
  .top .rail{display:none}
}
/* ---------- celular (≤ 900 px): palco cheio, folha deslizante, barra inferior ---------- */
@media (max-width:900px){
  html,body{height:100%;overflow:hidden;overscroll-behavior:none}
  :root{--nav-h:calc(63px + env(safe-area-inset-bottom,0px));--top-h:52px}
  .app{display:block;height:100%;padding-bottom:0}
  .top{position:fixed;left:0;right:0;top:0;height:var(--top-h);gap:6px;padding:0 6px 0 8px;z-index:36}
  .top .brand{padding:6px}
  .top .brand .wm,.top .brand .by,.top .sep,.nv-salvo,#buscaBtn,#apTop,#pdfTop{display:none!important}
  .top .proj{gap:2px}
  .top .proj .nv-est input{max-width:none;min-width:0;width:100%;field-sizing:fixed;font-size:14px;padding:6px 0 6px 6px}
  .nv-est{flex:1 1 auto;min-width:0}
  .nv-chev{width:32px;height:40px}
  .top .acts{flex:none}
  .top .acts .btn.icon{width:40px;height:40px;min-height:40px}
  .nv-menu .nv-cel{display:flex}
  .nv-menu{position:fixed;left:8px!important;right:8px!important;top:auto!important;bottom:calc(var(--nav-h) + 8px);min-width:0;max-height:70vh;overflow:auto;border-radius:18px;padding:8px}
  .nv-menu button{min-height:46px;font-size:14.5px}
  .stage{position:fixed;left:0;right:0;top:var(--top-h);bottom:calc(var(--folha,52vh) - 14px);display:block;transition:bottom .28s var(--ease)}
  .nv-arrasta .stage{transition:none}
  .view{height:100%;min-height:0}
  .stage>.kpis{display:none}
  /* a folha */
  .panel{position:fixed;left:0;right:0;bottom:var(--nav-h);height:var(--folha-h,52vh);z-index:30;display:flex;flex-direction:column;background:var(--bg);border:1px solid var(--line);border-bottom:0;border-radius:20px 20px 0 0;box-shadow:0 -10px 34px rgba(16,16,20,.14),0 -1px 3px rgba(16,16,20,.06);overflow:hidden;transition:height .28s var(--ease)}
  .nv-arrasta .panel{transition:none}
  .panel .pbody{overflow-y:auto;overscroll-behavior:contain;flex:1;min-height:0;padding-bottom:16px}
  .folha-puxa{flex:none;display:grid;place-items:center;height:22px;cursor:grab;touch-action:none;background:var(--surface);border:0;padding:0;width:100%}
  .folha-puxa i{width:38px;height:4.5px;border-radius:9px;background:var(--line-2)}
  .folha-puxa:active{cursor:grabbing}
  .panel>.kpis{flex:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) 46px;border-top:0;border-bottom:1px solid var(--line);background:var(--surface);touch-action:none}
  .panel>.kpis .kpi:not([data-m]){display:none}
  .panel>.kpis .kpi .lx{display:none}
  .panel>.kpis .kpi{padding:4px 12px 9px;border-right:1px solid var(--line);border-bottom:0}
  .panel>.kpis .kpi .v{font-size:15.5px}
  .panel>.kpis .kpi-mais{border-left:0}
  .phead{padding:8px 16px 10px;touch-action:pan-y}
  .phead .eb{font-size:10px}
  .phead h1{font-size:18px;margin:1px 0 0}
  .phead .q{display:none}
  .phead .sub{margin-top:8px}
  .panel>.kpis.busy::after{display:none}
  .panel>.kpis [data-kpi="margem"]{order:1}.panel>.kpis [data-kpi="tir"]{order:2}.panel>.kpis [data-kpi="vagas"]{order:3}.panel>.kpis .kpi-mais{order:4}
  .panel>.kpis [data-kpi="vagas"]{border-right:1px solid var(--line)}
  .panel>.kpis [data-kpi="tir"]{border-right:1px solid var(--line)}
  .pfoot{padding:8px 12px 10px;gap:6px 8px}
  .pfoot .btn{min-height:44px}
  .nv-kpop{left:8px!important;right:8px;top:auto!important;bottom:calc(var(--nav-h) + 8px);width:auto}
  /* barra inferior com as 5 etapas */
  .top .rail{all:unset;position:fixed;left:0;right:0;bottom:0;z-index:38;display:flex;justify-content:space-around;align-items:stretch;padding:4px 4px calc(4px + env(safe-area-inset-bottom,0px));background:var(--glass);-webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4);border-top:1px solid var(--line)}
  .top .rail .ln{display:none}
  .top .rail button{all:unset;box-sizing:border-box;position:relative;flex:1 1 0;min-width:0;min-height:54px;display:grid;justify-items:center;align-content:center;gap:3px;padding:4px 2px;border-radius:12px;color:var(--muted);font-size:10.5px;font-weight:550;cursor:pointer;-webkit-tap-highlight-color:transparent}
  .top .rail button .n{display:none}
  .top .rail .ic{display:block;width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
  .top .rail .opc{display:none}
  .top .rail .lb{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .top .rail button[aria-current="page"]{color:var(--ink);font-weight:650;background:none}
  .top .rail button[aria-current="page"] .ic{stroke:var(--ink);stroke-width:1.9}
  .top .rail button[aria-current="page"]::after{content:"";position:absolute;top:-4px;left:28%;right:28%;height:2.5px;border-radius:0 0 3px 3px;background:var(--sel)}
  .top .rail .st{top:7px;left:calc(50% + 7px);box-shadow:0 0 0 2px var(--surface)}
  .top .rail button.feito .st{display:block;background:var(--ok)}
  .toast{bottom:calc(var(--folha,40vh) + 12px)}
  .pop,.prog-pop{bottom:calc(var(--nav-h) + 8px)}
  #exBanner{padding:6px 12px}
  /* folha cheia: o palco fica só como uma faixa — sem as barras e dicas flutuantes por cima dela */
  .nv-cheia .stage .view>:not(canvas):not(#c2d):not(#c3d){visibility:hidden}
  .hint{font-size:11.5px;padding:6px 10px;line-height:1.35}
}
@media (max-width:900px){ .top .prog-anel{min-height:40px;min-width:40px;justify-content:center} }
@media (max-width:520px){ .top .prog-anel{padding:3px;gap:0} .top .prog-anel span{display:none} }
@media (prefers-reduced-motion:reduce){ .panel,.stage{transition:none!important} }
`; (document.body||document.head).appendChild(s) })();   // no fim do body: vem depois do CSS do shell (no test.html ele está no body)

/* ---------- estado da casca ---------- */
const NAV = { folha:"media", larg:null, armReset:false, kpop:null, menuAberto:null };
const NAV_FOLHA = { espiada:0.28, media:0.58, cheia:0.92 };
const navCel = ()=> matchMedia("(max-width:900px)").matches;

/* ---------- ações dos menus ---------- */
function navIr(etapa, sub, sec, p){
  if(typeof irPara==="function") return irPara(etapa, sub||undefined, sec||undefined, p);
  if(typeof progIr==="function") return progIr(etapa, sub, sec);
  goStep(etapa, sub);
}
function navAbrirJsonFallback(){
  let i=document.getElementById("navJsonIn");
  if(!i){ i=document.createElement("input"); i.type="file"; i.id="navJsonIn"; i.accept=".json,application/json"; i.hidden=true; document.body.appendChild(i);
    i.addEventListener("change", ()=>{ const f=i.files[0]; if(!f) return; f.text().then(x=>{ try{ const o=JSON.parse(x); S=merge(clone(DEF), o.S||o); document.getElementById("projName").value=S.nome; renderTab(); fit3d(); fit2d(); toast("Estudo aberto (Ctrl+Z desfaz)") }catch(err){ toast("Arquivo inválido") } }) }) }
  i.value=""; i.click();
}
const NAV_ACOES = {
  novo: ()=>{ if(typeof assAbrir==="function") assAbrir(); else if(typeof estNovo==="function") estNovo(clone(DEF), "Novo estudo"); else navIr("cen","estudos") },
  inicio: ()=>{ if(typeof inicioAbrir==="function") inicioAbrir(); else navIr("cen","estudos","estudos") },
  dup: async ()=>{ if(ACT.estDup){ await ACT.estDup(document.createElement("button")); toast("Cópia criada — o original fica em Meus estudos") } else toast("Duplicar não está disponível aqui") },
  versao: async ()=>{ if(typeof versaoSalvar!=="function"){ toast("Versões não estão disponíveis aqui"); return } const v=await versaoSalvar(); toast(v? `${v.nome} salva — veja em Entrega › Estudos` : "Não foi possível salvar agora") },
  alt: ()=>{ if(ACT.aprovar) ACT.aprovar(); else { saveScenario(null, true); toast("Guardado como alternativa — veja em Entrega › Estudos") } },
  jsonAbrir: ()=>{ if(typeof abrirJson==="function") abrirJson(); else navAbrirJsonFallback() },
  reset: b=>{ if(!NAV.armReset){ NAV.armReset=true; b.classList.add("arm"); b.querySelector(".tl").textContent="Confirmar: trocar pelo exemplo"; return false }
    const f=document.createElement("button"); f.dataset.arm=1; ACT.reset(f) },
  busca: ()=>{ if(typeof buscaAbrir==="function") buscaAbrir() },
  gloss: ()=>abreGlossario(),
  aptos: ()=>{ if(typeof aptoEditorAbrir==="function") aptoEditorAbrir() },
  ap: ()=>{ const b=document.getElementById("apTop"); if(b) b.click() },
  pdf: ()=>calcPronto().then(()=>exportPDF()),
  zip: ()=>ACT.zip && ACT.zip(),
  json: ()=>ACT.json && ACT.json(),
  copy: ()=>ACT.copy && ACT.copy(),
  link: ()=>{ navIr("cen","entregar","apresentacao"); setTimeout(()=>{ if(ACT.apLink) ACT.apLink() }, 160) },
  marca: ()=>navIr("cen","entregar","marca"),
};
function navMenuFecha(){
  document.querySelectorAll(".nv-menu").forEach(m=>{ if(!m.hidden){ m.hidden=true } });
  document.querySelectorAll("[aria-controls='estMenu'],[aria-controls='maisMenu']").forEach(b=>b.setAttribute("aria-expanded","false"));
  NAV.menuAberto=null;
  if(NAV.armReset){ NAV.armReset=false; const r=document.querySelector('#estMenu [data-nv="reset"]'); if(r){ r.classList.remove("arm"); r.querySelector(".tl").textContent="Restaurar exemplo" } }
}
function navMenuAbre(btn){
  const id=btn.getAttribute("aria-controls"), m=document.getElementById(id); if(!m) return;
  const ja=!m.hidden; navMenuFecha(); navKpiFecha(); if(ja) return;
  m.hidden=false; btn.setAttribute("aria-expanded","true"); NAV.menuAberto=id;
  const f=m.querySelector("button"); if(f && !navCel()) setTimeout(()=>f.focus({preventScroll:true}),10);
}

/* ---------- salvo / salvando ---------- */
function navSalvo(ativo){
  const e=document.getElementById("saveStat"); if(!e) return;
  e.classList.toggle("ativo", !!ativo); const t=e.querySelector("span"); const txt=ativo? "Salvando…" : "Salvo"; if(t && t.textContent!==txt) t.textContent=txt;
}

/* ---------- popover "⋯" da régua ---------- */
function navKpiFecha(){ if(NAV.kpop) NAV.kpop.hidden=true; const b=document.getElementById("kpiMais"); if(b) b.setAttribute("aria-expanded","false") }
function navKpiMais(btn){
  if(!NAV.kpop){ NAV.kpop=document.createElement("div"); NAV.kpop.className="nv-kpop"; NAV.kpop.id="kpiPop"; NAV.kpop.setAttribute("role","dialog"); NAV.kpop.setAttribute("aria-label","Outros indicadores"); NAV.kpop.hidden=true; document.body.appendChild(NAV.kpop);
    NAV.kpop.addEventListener("click", e=>{ if(e.target.closest("[data-kx]")){ navKpiFecha(); return } const r=e.target.closest("[data-ir]"); if(r){ navKpiFecha(); navKpiIr(r) } }) }
  if(!NAV.kpop.hidden){ navKpiFecha(); return }
  navMenuFecha(); navKpiPreenche(); NAV.kpop.hidden=false; if(btn) btn.setAttribute("aria-expanded","true");
  if(!navCel() && btn){ const r=btn.getBoundingClientRect(), w=NAV.kpop.offsetWidth, h=NAV.kpop.offsetHeight;
    NAV.kpop.style.left=Math.max(12, Math.min(innerWidth-w-12, r.right-w))+"px"; NAV.kpop.style.top=Math.max(12, r.top-h-8)+"px" }
  else { NAV.kpop.style.left=""; NAV.kpop.style.top="" }
}
function navKpiPreenche(){
  if(!NAV.kpop || !window._last) return;
  const l=(typeof kpiExtras==="function")? kpiExtras(window._last.m, window._last.f) : [];
  const h=`<div class="kh"><span>Outros indicadores</span><button type="button" data-kx aria-label="Fechar">×</button></div>`+
    l.map(k=>`<button type="button" class="kr" data-ir='${esc(JSON.stringify(k.ir))}'${k.tt?` title="${esc(k.tt)}"`:""}><span class="l">${k.st?`<span class="dot ${k.st}"></span>`:""}${k.l}</span><span class="v${k.st==="bad"?" bad":""}">${k.v}</span>${k.s?`<span class="s">${k.s}</span>`:""}</button>`).join("");
  if(NAV.kpop.innerHTML!==h) NAV.kpop.innerHTML=h;
}
function navKpiIr(el){ let a; try{ a=JSON.parse(el.dataset.ir) }catch(e){ return } if(navCel()) folhaSet("media"); navIr(a[0], a[1], a[2]) }

/* ---------- onde fica o stepper (topo · inspetor · barra inferior) ---------- */
function navLugar(){
  const w=innerWidth, faixa= w<=900? "cel" : w<1100? "meio" : "topo"; if(faixa===NAV.larg) return; NAV.larg=faixa;
  const rail=document.getElementById("rail"), top=document.querySelector(".top"), acts=top&&top.querySelector(".acts"), panel=document.querySelector(".panel"), ph=document.getElementById("phead");
  if(!rail || !panel || !ph) return;
  if(faixa==="meio"){ const ex=document.getElementById("exBanner"); panel.insertBefore(rail, ex && ex.parentNode===panel? ex : ph) }
  else if(rail.parentNode!==top) top.insertBefore(rail, acts);
  // KPIs: no celular sobem para o topo da folha; fora dele voltam à régua do palco
  const k=document.getElementById("kpis"), stage=document.querySelector(".stage"), puxa=navPuxador();
  if(faixa==="cel"){ if(k.parentNode!==panel) panel.insertBefore(k, puxa.nextSibling); folhaAplica() }
  else { if(stage && k.parentNode!==stage) stage.appendChild(k); document.documentElement.style.removeProperty("--folha"); document.documentElement.style.removeProperty("--folha-h") }
  if(typeof railStatus==="function" && window._last) try{ railStatus(window._last.m, window._last.f) }catch(e){}
}

/* ---------- folha do celular ---------- */
function navPuxador(){
  let p=document.getElementById("folhaPuxa"); if(p) return p;
  const panel=document.querySelector(".panel");
  p=document.createElement("button"); p.type="button"; p.id="folhaPuxa"; p.className="folha-puxa"; p.setAttribute("aria-label","Mudar a altura do painel"); p.innerHTML="<i></i>";
  panel.insertBefore(p, panel.firstChild);
  let ini=null;
  const comeca=(e)=>{ if(!navCel()) return;
    ini={y:e.clientY, h:panel.getBoundingClientRect().height, t:Date.now(), id:e.pointerId, moveu:false}; try{ p.setPointerCapture(e.pointerId) }catch(_){} };
  const move=(e)=>{ if(!ini || e.pointerId!==ini.id) return; const dy=e.clientY-ini.y; if(!ini.moveu && Math.abs(dy)<6) return;
    if(!ini.moveu){ ini.moveu=true; document.documentElement.classList.add("nv-arrasta") }
    const max=folhaDisp(), h=Math.max(90, Math.min(max, ini.h-dy)); folhaPx(h) };
  const fim=(e)=>{ if(!ini || e.pointerId!==ini.id) return; const a=ini; ini=null; document.documentElement.classList.remove("nv-arrasta");
    if(!a.moveu){ if(e.target.closest(".folha-puxa")) folhaSet({espiada:"media", media:"cheia", cheia:"espiada"}[NAV.folha]); return }
    const h=panel.getBoundingClientRect().height, max=folhaDisp(), v=(a.h-h)/Math.max(1,Date.now()-a.t);   // px/ms (positivo = descendo)
    let alvo=Object.entries(NAV_FOLHA).map(([k,f])=>[k, Math.abs(f*max-h)]).sort((x,y)=>x[1]-y[1])[0][0];
    if(Math.abs(v)>0.5){ const o=["espiada","media","cheia"], i=o.indexOf(NAV.folha); alvo=o[Math.max(0,Math.min(2, i+(v>0?-1:1)))] }
    folhaSet(alvo) };
  ["pointerdown","pointermove","pointerup","pointercancel"].forEach((ev,i)=>p.addEventListener(ev, [comeca,move,fim,fim][i]));
  return p;
}
const folhaDisp = ()=> Math.max(200, innerHeight - 52 - navBarra());
const navBarra = ()=>{ const r=document.getElementById("rail"); return r && navCel()? r.getBoundingClientRect().height || 62 : 0 };
function folhaPx(h){ const de=document.documentElement; de.style.setProperty("--folha-h", Math.round(h)+"px"); de.style.setProperty("--folha", Math.round(h+navBarra())+"px") }
function folhaAplica(){ if(!navCel()) return; folhaPx(NAV_FOLHA[NAV.folha]*folhaDisp()) }
function folhaSet(n){ if(!NAV_FOLHA[n]) return; NAV.folha=n; document.documentElement.classList.toggle("nv-cheia", n==="cheia"); folhaAplica(); const p=document.getElementById("folhaPuxa"); if(p) p.setAttribute("aria-label", n==="cheia"? "Baixar o painel" : "Subir o painel") }

/* ---------- inicialização (chamada por main.js) ---------- */
function navInit(){
  const top=document.querySelector(".top");
  // marca → Meus estudos
  const br=document.getElementById("brandBtn"); if(br) br.addEventListener("click", ()=>NAV_ACOES.inicio());
  // menus
  top.addEventListener("click", e=>{
    const mb=e.target.closest("[aria-controls='estMenu'],[aria-controls='maisMenu']"); if(mb){ e.preventDefault(); navMenuAbre(mb); return }
    const it=e.target.closest(".nv-menu [data-nv]"); if(it){ const r=NAV_ACOES[it.dataset.nv] && NAV_ACOES[it.dataset.nv](it); if(r!==false) navMenuFecha(); return }
    if(e.target.closest("#themeBtn")) setTimeout(navMenuFecha, 0);
  });
  document.getElementById("buscaBtn").addEventListener("click", ()=>NAV_ACOES.busca());
  // "Modelos de apartamento" (editor e biblioteca, src/ui/aptoeditor.js) no menu "…", depois do glossário
  const gl=document.getElementById("glossBtn"); if(gl && typeof aptoEditorAbrir==="function" && !document.querySelector('#maisMenu [data-nv="aptos"]')) gl.insertAdjacentHTML("afterend",
    `<button type="button" role="menuitem" data-nv="aptos"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M10.5 4.5v8h-7M10.5 15.5v4M14.5 12.5h6"/></svg>Modelos de apartamento</button>`);
  document.addEventListener("pointerdown", e=>{ if(NAV.menuAberto && !e.target.closest(".nv-menu,[aria-controls]")) navMenuFecha();
    if(NAV.kpop && !NAV.kpop.hidden && !e.target.closest("#kpiPop,#kpiMais")) navKpiFecha() }, true);
  document.addEventListener("keydown", e=>{ if(e.key==="Escape"){ if(NAV.menuAberto){ const b=document.querySelector(`[aria-controls='${NAV.menuAberto}']`); navMenuFecha(); if(b) b.focus() } navKpiFecha() }
    if(NAV.menuAberto && (e.key==="ArrowDown"||e.key==="ArrowUp")){ const m=document.getElementById(NAV.menuAberto), l=[...m.querySelectorAll("button")].filter(b=>b.offsetParent), i=l.indexOf(document.activeElement); e.preventDefault(); const j=(i+(e.key==="ArrowDown"?1:-1)+l.length)%l.length; l[j].focus() } });
  // régua: clique navega; "⋯" abre os outros
  const k=document.getElementById("kpis");
  k.addEventListener("click", e=>{ if(e.target.closest("[data-info]")) return; const m=e.target.closest("#kpiMais"); if(m){ navKpiMais(m); return } const x=e.target.closest(".kpi[data-ir]"); if(x) navKpiIr(x) });
  k.addEventListener("keydown", e=>{ if((e.key==="Enter"||e.key===" ") && e.target.matches(".kpi[data-ir]")){ e.preventDefault(); navKpiIr(e.target) } });
  // anel do checklist ao lado do nome
  const an=document.getElementById("navAnel"); if(an && typeof progressoAnelHTML==="function") try{ an.innerHTML=progressoAnelHTML() }catch(e){}
  // celular: puxador, lugar do stepper e da régua
  navPuxador(); navLugar();
  addEventListener("resize", ()=>{ navLugar(); folhaAplica(); navKpiFecha() });
  // ferramenta de desenho ligada: a folha desce para a espiada
  if(typeof setTool==="function"){ const st0=setTool; setTool=function(t, alvo){ const r=st0.apply(this, arguments); if(navCel() && (t==="draw"||t==="calib")) folhaSet("espiada"); return r } }
  const rm=document.getElementById("rampMove"); if(rm) rm.addEventListener("click", ()=>{ if(navCel() && RAMPMOVE) folhaSet("espiada") });
}
/* a cada troca de etapa: no celular a folha volta à altura média */
function navEtapaMudou(){ if(navCel()) folhaSet("media"); navMenuFecha(); navKpiFecha() }
