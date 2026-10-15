/* ================= editor de modelos de apartamento (docs/APTOS.md §4) =================
   Tela cheia por cima do app (como a tela inicial: CSS injetado, listener próprio, estado de tela em AED_UI — nunca em S).
   aptoEditorAbrir({modelo?, tipologia?, onSalvar?})  → abre (modelo: edita uma cópia; tipologia: modelo novo; nada: o mais recente da biblioteca)
   aptoEditorFechar()                                 → fecha (pergunta se há alterações não salvas)
   Coluna esquerda: biblioteca (aptoBiblioteca…, src/ui/aptobiblioteca.js) e "Começar de um partido" (aedPartidos = aptoCatalogo ou reserva).
   Centro: prancheta em SVG (fachada embaixo, corredor em cima), grade e ímã de 5 cm, cotas, portas deduzidas/editáveis, janelas.
   Direita: propriedades, ambiente selecionado, validação ao vivo (aedValida → aptoValida quando existe) e prévia em outras frentes
   (aedAplica → aptoAplica quando existe). Desfazer/refazer próprio (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y). Celular: só a biblioteca. */

const AED_UI = { el:null, aberto:false, modelo:null, salvo:"", sel:null, sel2:null, ferr:"sel", kDes:"sala", hist:[], fut:[], tEdit:0,
  q:"", tipCat:"", drag:null, hov:null, pisca:null, piscaT:0, menu:null, arm:null, desf:null, desfT:0, onSalvar:null, conf:null,
  ver:null, cel:false, V:null, ro:null, cursor:null, guia:null };
const AED_IC = {
  sel:'<path d="M6 4.5 18 12l-5.3 1.4L10 19z"/>',
  ret:'<rect x="4.5" y="6.5" width="15" height="11" rx="1"/><path d="M4.5 10.5h4M8.5 6.5v11"/>',
  porta:'<path d="M5.5 19.5V5.5h7v14"/><path d="M12.5 5.5a9 9 0 0 1 6 8.5"/><path d="M3.5 19.5h17"/>',
  divV:'<rect x="4.5" y="5.5" width="15" height="13" rx="1"/><path d="M12 5.5v13" stroke-dasharray="2 2"/>',
  divH:'<rect x="4.5" y="5.5" width="15" height="13" rx="1"/><path d="M4.5 12h15" stroke-dasharray="2 2"/>',
  une:'<path d="M4.5 6.5h7v11h-7zM12.5 6.5h7v6h-7z"/><path d="M9.5 12h5"/>',
  esp:'<path d="M12 4v16" stroke-dasharray="2 2"/><path d="M9.5 7.5 4.5 12l5 4.5zM14.5 7.5l5 4.5-5 4.5"/>',
  del:'<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 10.5v6M14 10.5v6"/>',
  undo:'<path d="M9 14 4.5 9.5 9 5"/><path d="M4.5 9.5h10a5 5 0 0 1 0 10H11"/>',
  redo:'<path d="m15 14 4.5-4.5L15 5"/><path d="M19.5 9.5h-10a5 5 0 0 0 0 10H13"/>',
  imp:'<path d="M6.5 3.5h7l4 4v13h-11z"/><path d="M13.5 3.5v4h4M12 17v-6M9.5 13.5 12 11l2.5 2.5"/>',
  exp:'<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  novo:'<path d="M12 5.5v13M5.5 12h13"/>',
  busca:'<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 4.5 4.5"/>',
  mais:'<circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/>',
  dup:'<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
  tela:'<rect x="3.5" y="4.5" width="17" height="11.5" rx="1.5"/><path d="M8.5 19.5h7M12 16v3.5"/>',
  ok:'<path d="m5.5 12.5 4 4 9-9"/>',
};
const aedIc = (k, cls="ico")=>`<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${AED_IC[k]}</svg>`;
const aedInfo = t=> typeof INFO==="function"? INFO(t) : "";
const AED_ESTICA =[["","Fixo"],["x","Frente"],["y","Fundo"],["xy","Os dois"]];

(function(){ const s=document.createElement("style"); s.textContent=`
.aed{position:fixed;inset:0;z-index:77;background:var(--bg);color:var(--ink);font-family:var(--f-sans);-webkit-font-smoothing:antialiased;display:grid;grid-template-rows:var(--topbar-h,60px) minmax(0,1fr);overscroll-behavior:contain}
.aed:focus{outline:none}
.aed[hidden]{display:none}
.aed.in{animation:aedIn .26s var(--ease) both}
@keyframes aedIn{from{opacity:0}to{opacity:1}}
body:has(>.aed:not([hidden])) #toast{visibility:hidden}
body:has(>.aed:not([hidden])) .pop{z-index:79}
.aed .aed-f>.l,.aed .aed-sh h2{display:flex;align-items:center;gap:6px}
.aed .ico{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
/* topo */
.aed-top{display:flex;align-items:center;gap:14px;padding:0 16px 0 20px;background:var(--surface);border-bottom:1px solid var(--line);min-width:0}
.aed-top .brand{pointer-events:none}
.aed-top .sep{width:1px;height:22px;background:var(--line);flex:none}
.aed-tt{display:flex;align-items:baseline;gap:10px;min-width:0;flex:1}
.aed-tt h1{margin:0;font-size:14px;font-weight:600;letter-spacing:-.01em;white-space:nowrap}
.aed-tt .nm{font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.aed-st{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);white-space:nowrap}
.aed-st i{width:6px;height:6px;border-radius:50%;background:var(--ok)}
.aed-st.suj i{background:var(--warn)}
.aed-top-r{display:flex;align-items:center;gap:6px;flex:none}
.aed-top-r .vs{width:1px;height:20px;background:var(--line);margin:0 4px}
.aed .btn.icon{padding:6px 7px;min-height:32px}
.aed .btn.icon .ico{width:17px;height:17px}
/* corpo */
.aed-corpo{display:grid;grid-template-columns:292px minmax(0,1fr) 330px;min-height:0}
.aed-col{min-height:0;overflow-y:auto;background:var(--surface);scrollbar-width:thin;scrollbar-color:var(--line-2) transparent}
.aed-lib{border-right:1px solid var(--line);display:flex;flex-direction:column}
.aed-prop{border-left:1px solid var(--line)}
.aed-sec{padding:16px 16px 14px;border-bottom:1px solid var(--line);display:grid;gap:10px}
.aed-sec:last-child{border-bottom:0}
.aed-sh{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:28px}
.aed-sh h2{margin:0;font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)}
.aed-sh .ct{font-size:11.5px;color:var(--faint);font-weight:500;letter-spacing:0;text-transform:none;margin-left:6px}
.aed-q .ico{margin-left:10px;color:var(--faint)}
.aed-q input{padding:7px 10px 7px 8px;font-size:13px}
/* lista da biblioteca */
.aed-lista{list-style:none;margin:0 -8px;padding:0;display:grid;gap:2px}
.aed-it{position:relative;display:grid;grid-template-columns:58px minmax(0,1fr) auto;gap:11px;align-items:center;padding:6px 8px;border-radius:10px;transition:background .15s var(--ease)}
.aed-it:hover{background:var(--soft)}
.aed-it.on{background:var(--soft)}
.aed-it.on::before{content:"";position:absolute;left:0;top:12px;bottom:12px;width:2px;border-radius:2px;background:var(--brand)}
.aed-fig{width:58px;height:50px;border-radius:8px;background:var(--surface-2);border:1px solid var(--line);display:grid;place-items:center;overflow:hidden;padding:4px}
.aed-fig svg{width:100%;height:100%;display:block}
.aed-abre{all:unset;cursor:pointer;min-width:0;display:grid;gap:1px}
.aed-abre::after{content:"";position:absolute;inset:0;border-radius:inherit}
.aed-abre:focus-visible{outline:none}
.aed-it:has(.aed-abre:focus-visible){outline:2px solid var(--brand);outline-offset:-2px}
.aed-abre b{font-size:13px;font-weight:600;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aed-abre span{font-size:11.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-variant-numeric:tabular-nums}
.aed-mais{position:relative;z-index:1;width:28px;height:28px;border:0;border-radius:8px;background:transparent;color:var(--muted);display:grid;place-items:center;opacity:0;transition:opacity .15s var(--ease),background .15s var(--ease)}
.aed-mais .ico{fill:currentColor;stroke:none;width:17px;height:17px}
.aed-it:hover .aed-mais,.aed-it.on .aed-mais,.aed-mais:focus-visible,.aed-mais[aria-expanded="true"]{opacity:1}
.aed-mais:hover,.aed-mais[aria-expanded="true"]{background:var(--surface-3);color:var(--ink)}
.aed-menu{position:absolute;z-index:6;right:6px;top:calc(100% - 4px);min-width:180px;background:var(--surface);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--shadow-pop);padding:5px;display:grid;gap:1px;animation:aedPop .15s var(--ease) both}
@keyframes aedPop{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.aed-menu button{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:8px;font-size:13px;color:var(--ink);cursor:pointer}
.aed-menu button .ico{color:var(--muted)}
.aed-menu button:hover,.aed-menu button:focus-visible{background:var(--soft)}
.aed-menu hr{border:0;border-top:1px solid var(--line);margin:4px 2px}
.aed-menu .del{color:var(--bad)} .aed-menu .del .ico{color:var(--bad)}
.aed-menu .del.arm{background:var(--bad);color:#fff} .aed-menu .del.arm .ico{color:#fff}
.aed-vz{font-size:12.5px;color:var(--muted);padding:10px 2px 4px;line-height:1.45}
.aed-vz b{display:block;color:var(--ink);font-weight:600;font-size:13px;margin-bottom:2px}
/* catálogo */
.aed-cat{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.aed-pt{all:unset;box-sizing:border-box;cursor:pointer;display:grid;gap:6px;padding:6px 6px 8px;border:1px solid var(--line);border-radius:10px;background:var(--surface);transition:border-color .15s var(--ease),box-shadow .15s var(--ease),transform .15s var(--ease)}
.aed-pt:hover{border-color:var(--line-2);box-shadow:var(--shadow-card);transform:translateY(-1px)}
.aed-pt:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
.aed-pt .aed-fig{width:100%;height:74px;border:0}
.aed-pt b{font-size:11.5px;font-weight:600;line-height:1.25;padding:0 2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.aed-pt span{font-size:10.5px;color:var(--muted);padding:0 2px;margin-top:-4px}
.aed-lib-pe{margin-top:auto;padding:10px 12px;border-top:1px solid var(--line);display:flex;gap:4px;justify-content:space-between}
/* miniaturas (mesmas cores da prancheta) */
.aed-mini .aed-mc{fill:var(--surface)}
.aed-mini .aed-mk{fill:var(--kc,var(--surface));stroke:var(--ink-2);stroke-width:.7;vector-effect:non-scaling-stroke}
.aed-mini .aed-mo{fill:none;stroke:var(--ink);stroke-width:1.6;vector-effect:non-scaling-stroke}
.aed-mini .aed-mf{stroke:var(--ink);stroke-width:3;vector-effect:non-scaling-stroke}
.aed-mini .aed-me{stroke:var(--mark);stroke-width:3;stroke-linecap:round;vector-effect:non-scaling-stroke}
.aed{--kp:62%;--kq:75%}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .aed{--kp:34%;--kq:42%}}
:root[data-theme="dark"] .aed{--kp:34%;--kq:42%}
.aed .aed-k-sala{--kc:color-mix(in srgb,var(--u2) var(--kp),var(--surface))}
.aed .aed-k-suite,.aed .aed-k-dorm,.aed .aed-k-closet,.aed .aed-k-office{--kc:color-mix(in srgb,var(--u5) var(--kp),var(--surface))}
.aed .aed-k-cozinha,.aed .aed-k-serv,.aed .aed-k-desp{--kc:color-mix(in srgb,var(--c-duto) var(--kq),var(--surface))}
.aed .aed-k-banho,.aed .aed-k-bsuite,.aed .aed-k-lavabo{--kc:color-mix(in srgb,var(--u1) var(--kp),var(--surface))}
.aed .aed-k-circ{--kc:var(--c-circ)}
.aed .aed-k-sacada{--kc:color-mix(in srgb,var(--u3) var(--kp),var(--surface))}
/* prancheta */
.aed-mesa{position:relative;min-width:0;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:radial-gradient(120% 90% at 30% 0%,var(--stage-a),var(--stage-b))}
.aed-ferr{display:flex;align-items:center;gap:8px;padding:12px 16px 0;flex-wrap:wrap;z-index:2}
.aed-ferr .grp{display:flex;align-items:center;gap:2px;background:var(--glass);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border:1px solid var(--glass-line);border-radius:12px;padding:3px;box-shadow:var(--shadow-card)}
.aed-ferr .grp .btn{border:0;box-shadow:none;background:transparent;min-height:30px;padding:5px 9px;border-radius:9px;color:var(--ink-2);font-weight:550;font-size:12.5px}
.aed-ferr .grp .btn:hover{background:var(--soft);color:var(--ink)}
.aed-ferr .grp .btn[aria-pressed="true"]{background:var(--sel);color:var(--sel-ink)}
.aed-ferr .grp .btn:disabled{opacity:.35}
.aed-ferr .grp .btn .ico{width:16px;height:16px}
.aed-ferr .grp select{border:0;background:transparent;font-size:12.5px;font-weight:550;padding:5px 24px 5px 8px;border-radius:9px;appearance:none;-webkit-appearance:none;color:var(--ink);background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238e8e93' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>");background-repeat:no-repeat;background-position:right 6px center;cursor:pointer}
.aed-ferr .grp select:hover{background-color:var(--soft)}
.aed-ferr .lbl{font-size:11.5px;color:var(--muted);padding:0 4px 0 8px;white-space:nowrap}
.aed-svgw{position:relative;min-height:0;overflow:hidden}
.aed-svg{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;user-select:none;-webkit-user-select:none}
.aed-svg text{font-family:var(--f-sans);font-variant-numeric:tabular-nums}
.aed-svg .grd{stroke:var(--line);stroke-width:1}
.aed-svg .grd.m{stroke:var(--line-2)}
.aed-svg .cx{fill:var(--surface)}
.aed-svg .corr{fill:var(--c-circ)}
.aed-svg .livre{fill:url(#aedHach)}
.aed-svg .hl{stroke:var(--bad);stroke-width:1.1;opacity:.55}
.aed-svg .rm{fill:var(--kc,var(--surface))}
.aed-svg .gj{stroke:var(--kc);stroke-width:2.2}
.aed-svg .pr{fill:none;stroke:var(--ink);stroke-width:1.3}
.aed-svg .po{fill:none;stroke:var(--ink);stroke-width:4;stroke-linejoin:miter}
.aed-svg .sob{fill:var(--bad);opacity:.28}
.aed-svg .vao{stroke:var(--surface);stroke-width:5}
.aed-svg .vao.i{stroke-width:3.2}
.aed-svg .fl{stroke:var(--ink);stroke-width:1.3;fill:none}
.aed-svg .arc{stroke:var(--muted);stroke-width:.9;fill:none;stroke-dasharray:3 2.5}
.aed-svg .jan{stroke:var(--ink-2);stroke-width:1}
.aed-svg .pj{stroke:var(--ink-2);stroke-width:1;fill:none}
.aed-svg .nm{font-size:12px;font-weight:620;fill:var(--ink);letter-spacing:-.01em}
.aed-svg .ar{font-size:11px;font-weight:500;fill:var(--ink-2)}
.aed-svg .dm{font-size:10px;fill:var(--muted)}
.aed-svg .cot{stroke:var(--muted);stroke-width:.8}
.aed-svg .cot.t{stroke-width:1}
.aed-svg .ct{font-size:10.5px;fill:var(--muted);font-weight:500}
.aed-svg .lado{font-size:10px;font-weight:650;letter-spacing:.14em;fill:var(--muted)}
.aed-svg .ent{fill:var(--mark);stroke:var(--surface);stroke-width:2}
.aed-svg .entt{font-size:10px;font-weight:650;fill:var(--ink-2);letter-spacing:.02em}
.aed-svg .g{cursor:move;outline:none}
.aed-svg .g:focus-visible .sl{stroke:var(--brand);stroke-width:2}
.aed-svg .sl{fill:none;stroke:transparent;stroke-width:2}
.aed-svg .g:hover .sl{stroke:var(--line-2)}
.aed-svg .g.on .sl{stroke:var(--sel);stroke-width:2.2}
.aed-svg .g.on2 .sl{stroke:var(--sel);stroke-width:2;stroke-dasharray:5 3}
.aed-svg .g.pisca .sl{stroke:var(--bad);stroke-width:3;animation:aedPisca 1.4s var(--ease) 1 both}
@keyframes aedPisca{0%,40%,80%{stroke-opacity:1}20%,60%{stroke-opacity:.25}100%{stroke-opacity:.9}}
.aed-svg .hd{fill:var(--surface);stroke:var(--sel);stroke-width:1.4}
.aed-svg .bdot{fill:var(--bad)}
.aed-svg .wdot{fill:var(--warn)}
.aed-svg .dv{stroke:var(--sel);stroke-width:3;stroke-linecap:round;opacity:0}
.aed-svg .dv.on{opacity:.9}
.aed-svg .des{fill:var(--sel-soft);stroke:var(--sel);stroke-width:1.4;stroke-dasharray:6 4}
.aed-svg .desl{font-size:11px;font-weight:600;fill:var(--ink)}
.aed-svg .gui{stroke:var(--d-acc);stroke-width:1;stroke-dasharray:4 3}
.aed-svg .pt{stroke:var(--d-acc);stroke-width:3;stroke-linecap:round;opacity:.0}
.aed-svg.pt-on .pt{opacity:.35}
.aed-svg.pt-on .pt:hover,.aed-svg .pt.on{opacity:.95}
.aed-dica{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:none;display:grid;gap:4px;justify-items:center;padding:16px 22px;border-radius:var(--r-lg);background:var(--glass);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid var(--glass-line);box-shadow:var(--shadow-card)}
.aed-dica[hidden]{display:none}
.aed-dica .ico{width:22px;height:22px;color:var(--muted);margin-bottom:4px}
.aed-dica b{font-size:15px;font-weight:620;letter-spacing:-.015em}
.aed-dica span{font-size:12.5px;color:var(--muted)}
.aed-pe{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 16px 12px;font-size:11.5px;color:var(--muted);min-height:34px}
.aed-pe kbd{font-family:var(--f-sans);font-size:10.5px;font-weight:600;border:1px solid var(--line-2);border-bottom-width:2px;border-radius:5px;padding:0 5px;color:var(--ink-2);background:var(--surface)}
.aed-pe .xy{font-variant-numeric:tabular-nums;white-space:nowrap}
/* propriedades */
.aed-f{display:grid;gap:5px}
.aed-f>label,.aed-f>.l{font-size:12px;font-weight:500;color:var(--ink-2)}
.aed-g2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.aed-g4{display:grid;grid-template-columns:1fr 1fr;gap:8px 8px}
.aed .inp input{padding:6px 9px;font-size:13px}
.aed .inp em{padding-right:9px}
.aed-faixa{display:grid;grid-template-columns:auto 1fr auto 1fr;align-items:center;gap:6px;font-size:12px;color:var(--muted)}
.aed-faixa .inp input{padding:5px 7px}
.aed .seg.full{display:flex}
.aed .seg button{padding:5px 8px}
.aed-acts{display:flex;flex-wrap:wrap;gap:6px}
.aed-acts .btn{min-height:30px;padding:5px 10px;font-size:12.5px}
.aed-nota{display:flex;align-items:center;gap:14px}
.aed-nota .n{font-size:34px;font-weight:650;letter-spacing:-.04em;line-height:1;font-variant-numeric:tabular-nums}
.aed-nota .n small{font-size:13px;font-weight:550;color:var(--faint);letter-spacing:0;margin-left:2px}
.aed-nota .t{display:grid;gap:4px;font-size:12px;color:var(--muted)}
.aed-nota .bar{height:4px;border-radius:9px;background:var(--line);overflow:hidden;width:100%}
.aed-nota .bar i{display:block;height:100%;border-radius:9px;background:var(--ok);transition:width .3s var(--ease)}
.aed-nota .bar i.warn{background:var(--warn)} .aed-nota .bar i.bad{background:var(--bad)}
.aed-probs{list-style:none;margin:0 -6px;padding:0;display:grid;gap:1px}
.aed-pb{all:unset;box-sizing:border-box;width:100%;display:grid;grid-template-columns:auto 1fr;gap:9px;align-items:baseline;padding:6px 6px;border-radius:8px;font-size:12.5px;line-height:1.35;color:var(--ink);cursor:pointer}
.aed-pb:hover,.aed-pb:focus-visible{background:var(--soft)}
.aed-pb .dot{transform:translateY(-1px)}
.aed-tudo{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--ok);font-weight:550}
.aed-tudo .ico{width:16px;height:16px}
.aed-prev{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.aed-pv{display:grid;gap:5px;justify-items:center;text-align:center}
.aed-pv .aed-fig{width:100%;height:84px}
.aed-pv b{font-size:11.5px;font-weight:600;font-variant-numeric:tabular-nums}
.aed-pv .pill{font-size:10px;padding:3px 7px}
.aed-fonte{font-size:11px;color:var(--faint)}
/* aviso, confirmação, celular */
.aed-snack{position:fixed;z-index:80;left:50%;bottom:24px;transform:translateX(-50%);display:flex;align-items:center;gap:14px;background:var(--sel);color:var(--sel-ink);border-radius:12px;padding:8px 8px 8px 16px;font-size:13px;font-weight:500;box-shadow:var(--shadow-pop);max-width:calc(100vw - 32px);animation:aedSn .25s var(--ease) both}
.aed-snack[hidden]{display:none}
.aed-snack span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aed-snack button{all:unset;cursor:pointer;padding:6px 10px;border-radius:8px;font-weight:650;white-space:nowrap}
.aed-snack button:hover,.aed-snack button:focus-visible{background:color-mix(in srgb,var(--sel-ink) 14%,transparent)}
@keyframes aedSn{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translateX(-50%)}}
.aed-conf{position:fixed;inset:0;z-index:81;display:grid;place-items:center;background:color-mix(in srgb,var(--bg) 45%,transparent);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
.aed-conf[hidden]{display:none}
.aed-cx{width:min(400px,calc(100vw - 32px));background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);box-shadow:var(--shadow-pop);padding:20px 20px 16px;display:grid;gap:8px;animation:aedPop .18s var(--ease) both}
.aed-cx h2{margin:0;font-size:16px;font-weight:620;letter-spacing:-.015em}
.aed-cx p{margin:0;font-size:13px;color:var(--muted)}
.aed-cx .acts{display:flex;justify-content:flex-end;gap:8px;margin-top:10px;flex-wrap:wrap}
.aed-aviso-cel{display:none}
@media (max-width:900px){
  .aed{grid-template-rows:56px minmax(0,1fr)}
  .aed-top{padding:0 10px 0 16px;gap:10px}
  .aed-top .brand .by,.aed-top .sep,.aed-tt .nm,.aed-st,.aed-top-r .ed{display:none}
  .aed-corpo{grid-template-columns:1fr;overflow-y:auto}
  .aed-mesa,.aed-prop{display:none}
  .aed-lib{border-right:0;overflow:visible}
  .aed-aviso-cel{display:flex;align-items:center;gap:12px;margin:14px 16px 0;padding:12px 14px;border-radius:var(--r);background:var(--info-soft);color:var(--ink);font-size:13px;line-height:1.35}
  .aed-aviso-cel .ico{width:22px;height:22px;color:var(--info)}
  .aed-aviso-cel b{display:block;font-weight:620}
  .aed-aviso-cel span{color:var(--muted);font-size:12.5px}
  .aed-it{grid-template-columns:92px minmax(0,1fr) auto;padding:8px}
  .aed-it .aed-fig{width:92px;height:76px}
  .aed-mais{opacity:1}
  .aed-cat{grid-template-columns:1fr 1fr}
  .aed-pt .aed-fig{height:96px}
  .aed-lib-pe .imp,.aed-lib .ed{display:none}
  .aed-ver{display:grid;gap:10px;margin:0 0 6px;padding:12px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface-2)}
  .aed-ver .aed-fig{width:100%;height:220px;background:var(--surface)}
  .aed-ver .r{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;color:var(--muted)}
  .aed-snack{left:16px;right:16px;transform:none;max-width:none;justify-content:space-between;bottom:calc(16px + env(safe-area-inset-bottom,0px))}
  @keyframes aedSn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
}
@media (min-width:901px){ .aed-ver{display:none} }
@media (max-width:720px){ .ini-top-r [data-ia="aptos"]{display:none} }   /* atalho da tela inicial: no celular, só pelo menu "…" */
@media (prefers-reduced-motion:reduce){.aed.in,.aed-menu,.aed-snack,.aed-cx{animation:none}.aed-svg .g.pisca .sl{animation:none}}
`; document.head.appendChild(s) })();

/* ---------- estado ---------- */
const aedChave = m=>{ if(!m) return ""; const c=aedClone(m); delete c.atualizado; delete c.criado; return JSON.stringify(c) };
const aedSujo = ()=> !!AED_UI.modelo && aedChave(AED_UI.modelo)!==AED_UI.salvo;
const aedCelular = ()=>{ try{ return matchMedia("(max-width:900px)").matches }catch(e){ return innerWidth<=900 } };
const aedM2 = v=> aedFmt(v,1)+" m²";
const aedMd = v=> aedFmt(v,2);
const aedSt = ()=> (typeof S!=="undefined"? S : null);
const AED_TIP_CURTO = { studio:"Studio", "1d":"1 dorm.", "1s":"1 suíte", "2d":"2 dorm.", "2d1s":"2 dorm. c/ suíte", "2s":"2 suítes", "3d1s":"3 dorm. c/ suíte", "3s":"3 suítes", "4d1s":"4 dorm. c/ suíte" };
function aedMeta(m){ const r=aedResumo(m); return `${AED_TIP_CURTO[m.tipologia]||""} · ${aedFmt(r.area,0)} m² · ${aedFmt(m.W,1)} × ${aedFmt(m.D,1)}` }

/* ---------- histórico (desfazer/refazer do editor) ---------- */
function aedCommit(novo, base){
  const b = base!=null? base : JSON.stringify(AED_UI.modelo);
  if(JSON.stringify(novo)===b){ AED_UI.modelo=novo; aedMudou(); return false }
  AED_UI.hist.push(b); if(AED_UI.hist.length>150) AED_UI.hist.shift(); AED_UI.fut=[]; AED_UI.tEdit=Date.now();
  AED_UI.modelo=novo;
  if(AED_UI.sel && !aedAcha(novo, AED_UI.sel)) AED_UI.sel=null;
  if(AED_UI.sel2 && !aedAcha(novo, AED_UI.sel2)) AED_UI.sel2=null;
  aedMudou(); return true;
}
function aedDesfaz(){
  if(!AED_UI.hist.length) return false;
  AED_UI.fut.push(JSON.stringify(AED_UI.modelo)); AED_UI.modelo=JSON.parse(AED_UI.hist.pop()); AED_UI.tEdit=Date.now();
  if(AED_UI.sel && !aedAcha(AED_UI.modelo, AED_UI.sel)) AED_UI.sel=null; AED_UI.sel2=null; aedMudou(); return true;
}
function aedRefaz(){
  if(!AED_UI.fut.length) return false;
  AED_UI.hist.push(JSON.stringify(AED_UI.modelo)); AED_UI.modelo=JSON.parse(AED_UI.fut.pop()); AED_UI.tEdit=Date.now();
  if(AED_UI.sel && !aedAcha(AED_UI.modelo, AED_UI.sel)) AED_UI.sel=null; AED_UI.sel2=null; aedMudou(); return true;
}

/* ---------- avisos (barra de baixo, com Desfazer) ---------- */
function aedAviso(rot, fn){
  AED_UI.desf={rot, fn:fn||null, t:Date.now()}; clearTimeout(AED_UI.desfT);
  AED_UI.desfT=setTimeout(()=>{ AED_UI.desf=null; aedSnack() }, fn? 12000 : 4500); aedSnack();
}
function aedSnack(){ const sn=AED_UI.el && AED_UI.el.querySelector(".aed-snack"); if(!sn) return; const d=AED_UI.desf;
  sn.hidden=!d; sn.innerHTML=d? `<span>${esc(d.rot)}</span>${d.fn? `<button type="button" data-ae="desfaz">Desfazer</button>` : ""}` : "" }
function aedDesfazBib(){ const d=AED_UI.desf; if(!d || !d.fn) return false; AED_UI.desf=null; clearTimeout(AED_UI.desfT);
  try{ d.fn() }catch(e){ console.error("[aptos] desfazer:", e) } aedSnack(); aedRenderLib(); aedRenderTopo(); return true }

/* ---------- confirmação ---------- */
function aedConfirma(titulo, texto, botoes){
  return new Promise(res=>{
    const c=AED_UI.el.querySelector(".aed-conf");
    c.innerHTML=`<div class="aed-cx" role="alertdialog" aria-modal="true" aria-labelledby="aedCxT"><h2 id="aedCxT">${esc(titulo)}</h2><p>${esc(texto)}</p>
      <div class="acts">${botoes.map(([k,l,cls])=>`<button type="button" class="btn ${cls||""}" data-cx="${k}">${esc(l)}</button>`).join("")}</div></div>`;
    c.hidden=false; AED_UI.conf=res;
    setTimeout(()=>{ const b=c.querySelector(".btn.pri")||c.querySelector(".btn"); if(b) b.focus() }, 20);
  });
}
function aedConfFecha(k){ const c=AED_UI.el && AED_UI.el.querySelector(".aed-conf"); if(c){ c.hidden=true; c.innerHTML="" } const r=AED_UI.conf; AED_UI.conf=null; if(r) r(k) }
/* antes de trocar de modelo: salva, descarta ou cancela (false = cancelou) */
async function aedPodeTrocar(){
  if(!aedSujo()) return true;
  const k=await aedConfirma("Salvar as alterações?", `“${AED_UI.modelo.nome}” tem alterações que ainda não estão na biblioteca.`, [["cancela","Continuar editando","ghost"],["descarta","Descartar"],["salva","Salvar","pri"]]);
  if(k==="salva"){ aedSalvar(); return true }
  return k==="descarta";
}

/* ---------- abrir modelos ---------- */
function aedCarrega(m, salvo){
  AED_UI.modelo=aedNormaliza(m); AED_UI.salvo= salvo? aedChave(AED_UI.modelo) : "";
  AED_UI.hist=[]; AED_UI.fut=[]; AED_UI.sel=null; AED_UI.sel2=null; AED_UI.ver=null; AED_UI.drag=null;
  if(AED_UI.el) aedRender();
}
async function aedAbreDaBib(id){ if(AED_UI.modelo && AED_UI.modelo.id===id && !aedSujo()) return; if(!(await aedPodeTrocar())) return; const m=aptoBibObter(id); if(m) aedCarrega(m, true) }
async function aedNovoModelo(tip){ if(!(await aedPodeTrocar())) return; aedCarrega(aedNovo({tipologia: tip || (AED_UI.modelo && AED_UI.modelo.tipologia) || "2d"}), false); aedFocoMesa() }
async function aedDoPartido(id){
  const p=aedPartidos().find(x=>x.id===id); if(!p) return;
  if(!(await aedPodeTrocar())) return;
  aedCarrega(aedCopia(p, p.nome), false); aedAviso(`Começando de “${p.nome}” — salve para guardar na biblioteca`); aedFocoMesa();
}
function aedFocoMesa(){ setTimeout(()=>{ const s=AED_UI.el && AED_UI.el.querySelector(".aed-svg"); if(s) try{ s.focus({preventScroll:true}) }catch(e){} }, 30) }

/* ---------- salvar, duplicar, excluir, exportar, importar ---------- */
function aedSalvar(){
  if(!AED_UI.modelo) return null;
  const v=aedValida(AED_UI.modelo, aedSt()), r=aptoBibSalvar(AED_UI.modelo); if(!r) return null;
  AED_UI.modelo=aedNormaliza(r); AED_UI.salvo=aedChave(AED_UI.modelo);
  let nb=v.problemas.filter(p=>p.nivel==="bad").length;
  if(!nb && typeof aptoConfere==="function"){ try{ const c=aptoConfere(AED_UI.modelo); if(c && c.ok===false) nb=(c.erros||[]).length||1 }catch(e){} }
  aedAviso(nb?`“${r.nome}” salvo com ${nb} problema${nb>1?"s":""} a resolver` : `“${r.nome}” salvo na biblioteca`);
  aedRenderLib(); aedRenderTopo();
  if(typeof AED_UI.onSalvar==="function") try{ AED_UI.onSalvar(aedClone(r)) }catch(e){ console.error("[aptos] onSalvar:", e) }
  return r;
}
function aedDuplicar(id){
  AED_UI.menu=null; const c=aptoBibDuplicar(id); if(!c){ aedAviso("Não foi possível duplicar"); return }
  aedRenderLib(); aedAviso(`Cópia criada: “${c.nome}”`, ()=>{ aptoBibExcluir(c.id) });
  setTimeout(()=>{ const b=AED_UI.el.querySelector(`.aed-it[data-id="${CSS.escape(c.id)}"] .aed-abre`); if(b) b.focus() }, 30);
}
function aedExcluir(id){
  if(AED_UI.arm!==id){ AED_UI.arm=id; aedRenderLib(); setTimeout(()=>{ const b=AED_UI.el.querySelector(".aed-menu .del"); if(b) b.focus() }, 20); return }
  AED_UI.arm=null; AED_UI.menu=null;
  const x=aptoBibExcluir(id); if(!x){ aedAviso("Não foi possível excluir"); return }
  if(AED_UI.modelo && AED_UI.modelo.id===id) AED_UI.salvo="";
  aedRenderLib(); aedRenderTopo();
  aedAviso(`“${x.modelo.nome}” excluído`, ()=>{ aptoBibRestaura(x); if(AED_UI.modelo && AED_UI.modelo.id===x.modelo.id){ const n=aedNormaliza(x.modelo); if(aedChave(n)===aedChave(AED_UI.modelo)) AED_UI.salvo=aedChave(n) } });
  setTimeout(()=>{ const b=AED_UI.el.querySelector(".aed-snack button"); if(b) b.focus() }, 30);
}
function aedBaixa(nome, texto){
  try{ const b=new Blob([texto], {type:"application/json"}), a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download=nome; document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove() }, 1500) }catch(e){ aedAviso("Não foi possível baixar o arquivo") }
}
const aedSlug = s=> (String(s||"modelo").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "modelo").slice(0,60);
function aedExportar(id){
  const m = id? aptoBibObter(id) : AED_UI.modelo; if(!m) return;
  aedBaixa(aedSlug(m.nome)+".json", aedExporta([m])); aedAviso(`“${m.nome}” exportado`);
}
function aedExportarTudo(){ const l=aptoBiblioteca(); if(!l.length){ aedAviso("A biblioteca está vazia"); return } aedBaixa("modelos-de-apartamento.json", aedExporta(l)); aedAviso(`${l.length} modelo${l.length>1?"s":""} exportado${l.length>1?"s":""}`) }
function aedImportarAbre(){ const i=AED_UI.el.querySelector("#aedArq"); if(i){ i.value=""; i.click() } }
async function aedImportarTexto(txt){
  const r=aedImporta(txt);
  if(!r.ok){ aedAviso("Arquivo recusado: "+(r.erros[0]||"não é um modelo de apartamento")); return [] }
  const ids=new Set(aptoBiblioteca().map(m=>m.id)), novos=[];
  r.modelos.forEach(m=>{ const n= ids.has(m.id) || !/^usr-/.test(m.id)? aedCopia(m, m.nome) : m; const g=aptoBibSalvar(n); if(g){ novos.push(g); ids.add(g.id) } });
  aedRenderLib();
  aedAviso(`${novos.length} modelo${novos.length>1?"s":""} importado${novos.length>1?"s":""}${r.erros.length? ` · ${r.erros.length} recusado${r.erros.length>1?"s":""}` : ""}`, ()=>{ novos.forEach(n=>aptoBibExcluir(n.id)) });
  if(novos.length && await aedPodeTrocar()){ aedCarrega(novos[0], true); AED_UI.desf && (AED_UI.desf.t=Date.now()) }
  return novos;
}

/* ---------- desenho: coluna da biblioteca ---------- */
function aedMini(m, label){ return aedMiniSVG(m, {label: label || ("Planta de "+(m.nome||"modelo"))}) }
function aedLibHTML(){
  const l=aptoBiblioteca(), q=AED_UI.q.trim().normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
  const f= q? l.filter(m=>(m.nome+" "+(AED_TIP[m.tipologia]||"")).normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().includes(q)) : l;
  const at=AED_UI.modelo && AED_UI.modelo.id;
  const itens = f.map(m=>{ const id=esc(m.id), on=m.id===at, arm=AED_UI.arm===m.id;
    return `<li class="aed-it${on?" on":""}" data-id="${id}">
      <div class="aed-fig">${aedMini(m)}</div>
      <button type="button" class="aed-abre" data-ae="abrir" data-id="${id}" aria-current="${on}" title="${esc(m.nome)}"><b>${esc(m.nome)}</b><span>${esc(aedMeta(m))}</span></button>
      <button type="button" class="aed-mais" data-ae="menu" data-id="${id}" aria-haspopup="menu" aria-expanded="${AED_UI.menu===m.id}" aria-label="Ações de ${esc(m.nome)}">${aedIc("mais")}</button>
      ${AED_UI.menu===m.id? `<div class="aed-menu" role="menu" aria-label="Ações do modelo">
        <button type="button" role="menuitem" data-ae="duplicar" data-id="${id}">${aedIc("dup")}Duplicar</button>
        <button type="button" role="menuitem" data-ae="exportar" data-id="${id}">${aedIc("exp")}Exportar .json</button><hr>
        <button type="button" role="menuitem" class="del${arm?" arm":""}" data-ae="excluir" data-id="${id}">${aedIc("del")}${arm? "Confirmar exclusão" : "Excluir"}</button></div>` : ""}
      ${AED_UI.ver===m.id? `<div class="aed-ver" style="grid-column:1/-1"><div class="aed-fig">${aedMini(m)}</div><div class="r"><span>${esc(aedMeta(m))}</span>${aedNotaPill(aedValida(m, aedSt()))}</div></div>` : ""}
    </li>` }).join("");
  const vazio = !l.length? `<div class="aed-vz"><b>Nenhum modelo ainda</b>Desenhe o primeiro na prancheta ou comece de um partido abaixo.</div>`
    : !f.length? `<div class="aed-vz"><b>Nada encontrado</b>para “${esc(AED_UI.q)}”.</div>` : "";
  const tc=AED_UI.tipCat, ps=aedPartidos(tc||undefined);
  return `<div class="aed-aviso-cel" role="note">${aedIc("tela")}<div><b>Desenhe no computador</b><span>No celular dá para ver os seus modelos e os partidos.</span></div></div>
    <section class="aed-sec" aria-labelledby="aedBibT">
      <div class="aed-sh"><h2 id="aedBibT">Meus modelos<span class="ct">${l.length||""}</span></h2><button type="button" class="btn sm ed" data-ae="novo">${aedIc("novo")}Novo modelo</button></div>
      ${l.length>3? `<div class="inp aed-q">${aedIc("busca")}<input type="search" id="aedQ" value="${esc(AED_UI.q)}" placeholder="Buscar modelo" aria-label="Buscar modelo" autocomplete="off"></div>` : ""}
      ${vazio}${f.length? `<ul class="aed-lista" aria-label="Meus modelos">${itens}</ul>` : ""}
    </section>
    <section class="aed-sec" aria-labelledby="aedCatT">
      <div class="aed-sh"><h2 id="aedCatT">Começar de um partido${aedInfo("Partido")}</h2><span class="aed-fonte">${ps.length||""}</span></div>
      <select class="sel" id="aedTipCat" aria-label="Tipologia dos partidos" style="padding:6px 30px 6px 10px;font-size:12.5px">${[["","Todas as tipologias"],...AED_TIPOLOGIAS].map(([k,n])=>`<option value="${k}"${k===tc?" selected":""}>${n}</option>`).join("")}</select>
      ${ps.length? `<div class="aed-cat">${ps.map(p=>`<button type="button" class="aed-pt" data-ae="partido" data-id="${esc(p.id)}" title="Começar de “${esc(p.nome)}”"><div class="aed-fig">${aedMini(p)}</div><b>${esc(p.nome)}</b><span>${aedMd(p.W)} × ${aedMd(p.D)} m</span></button>`).join("")}</div>`
        : `<div class="aed-vz">Nenhum partido desta tipologia${typeof aptoCatalogo==="function"? "" : " (o catálogo completo chega com o motor de plantas)"}.</div>`}
    </section>
    <div class="aed-lib-pe"><button type="button" class="btn ghost sm imp" data-ae="importar">${aedIc("imp")}Importar .json</button><button type="button" class="btn ghost sm" data-ae="exptudo"${l.length?"":" disabled"}>${aedIc("exp")}Exportar todos</button></div>`;
}
function aedRenderLib(){ const c=AED_UI.el && AED_UI.el.querySelector(".aed-lib"); if(!c) return; const st=c.scrollTop, ae=document.activeElement, q=ae && ae.id==="aedQ";
  c.innerHTML=aedLibHTML(); c.scrollTop=st; if(q){ const i=c.querySelector("#aedQ"); if(i){ i.focus(); i.setSelectionRange(i.value.length,i.value.length) } } }

/* ---------- desenho: topo ---------- */
function aedTopoHTML(){
  const m=AED_UI.modelo, suj=aedSujo(), brand=(document.querySelector(".top .brand")||{}).innerHTML || (typeof RX_MARCA!=="undefined"? RX_MARCA : `<span class="wm">gabarito<i>.</i></span>`);
  return `<div class="brand" aria-hidden="true">${brand}</div><span class="sep"></span>
    <div class="aed-tt"><h1 id="aedT">Modelos de apartamento</h1>${m? `<span class="nm">${esc(m.nome)}</span><span class="aed-st${suj?" suj":""}" id="aedSt" role="status"><i></i>${suj? "Alterações não salvas" : "Salvo na biblioteca"}</span>` : ""}</div>
    <div class="aed-top-r">
      <button type="button" class="btn ghost icon ed" data-ae="undo" aria-label="Desfazer" title="Desfazer (Ctrl+Z)"${AED_UI.hist.length?"":" disabled"}>${aedIc("undo")}</button>
      <button type="button" class="btn ghost icon ed" data-ae="redo" aria-label="Refazer" title="Refazer (Ctrl+Shift+Z)"${AED_UI.fut.length?"":" disabled"}>${aedIc("redo")}</button>
      <span class="vs ed"></span>
      <button type="button" class="btn ghost sm ed" data-ae="importar" title="Importar modelos de um .json">${aedIc("imp")}Importar</button>
      <button type="button" class="btn ghost sm ed" data-ae="exportar" title="Baixar este modelo em .json"${m && m.ambientes.length? "" : " disabled"}>${aedIc("exp")}Exportar</button>
      ${m && !m.ambientes.length? `<button type="button" class="btn ed" data-ae="salvar" disabled title="Desenhe os ambientes primeiro">Salvar na biblioteca</button>`
        : m && (suj || !aptoBibObter(m.id))? `<button type="button" class="btn pri ed" data-ae="salvar" title="Salvar na biblioteca (Ctrl+S)">Salvar na biblioteca</button>`
        : `<button type="button" class="btn ed" data-ae="salvar" disabled title="Nada a salvar">${aedIc("ok")}Salvo</button>`}
      <button type="button" class="btn ghost icon" data-ae="fechar" aria-label="Fechar o editor" title="Fechar (Esc)">${aedIc("x")}</button>
    </div>`;
}
function aedRenderTopo(){ const t=AED_UI.el && AED_UI.el.querySelector(".aed-top"); if(!t) return; const f=document.activeElement, k=f && t.contains(f) && f.dataset? f.dataset.ae : null;
  t.innerHTML=aedTopoHTML(); if(k){ const b=t.querySelector(`[data-ae="${k}"]`); if(b && !b.disabled) b.focus() } }

/* ---------- desenho: ferramentas da prancheta ---------- */
function aedFerrHTML(){
  const f=AED_UI.ferr, m=AED_UI.modelo, a=m && AED_UI.sel && aedAcha(m, AED_UI.sel), b=m && AED_UI.sel2 && aedAcha(m, AED_UI.sel2);
  const t=(k,ic,l,kb)=>`<button type="button" class="btn" data-ae="ferr" data-f="${k}" aria-pressed="${f===k}" title="${l} (${kb})">${aedIc(ic)}<span>${l}</span></button>`;
  const podeV=a && a.ret[2]>=2*AED_MIN, podeH=a && a.ret[3]>=2*AED_MIN;
  return `<div class="grp" role="group" aria-label="Ferramenta">${t("sel","sel","Selecionar","V")}${t("des","ret","Ambiente","R")}${t("porta","porta","Portas","P")}</div>
    ${f==="des"? `<div class="grp"><span class="lbl">Tipo</span><select id="aedKDes" aria-label="Tipo do ambiente a desenhar">${AED_KS.map(k=>`<option value="${k}"${k===AED_UI.kDes?" selected":""}>${AED_K[k].nome}</option>`).join("")}</select></div>` : ""}
    <div class="grp" role="group" aria-label="Editar">
      <button type="button" class="btn" data-ae="divV" title="Dividir na frente (corte vertical)"${podeV?"":" disabled"} aria-label="Dividir ao meio, corte vertical">${aedIc("divV")}</button>
      <button type="button" class="btn" data-ae="divH" title="Dividir na profundidade (corte horizontal)"${podeH?"":" disabled"} aria-label="Dividir ao meio, corte horizontal">${aedIc("divH")}</button>
      <button type="button" class="btn" data-ae="unir" title="Unir os dois selecionados (Shift + clique escolhe o segundo)"${a && b?"":" disabled"} aria-label="Unir">${aedIc("une")}</button>
      <button type="button" class="btn" data-ae="espelhar" title="Espelhar (entrada do outro lado)"${m && m.ambientes.length?"":" disabled"} aria-label="Espelhar">${aedIc("esp")}</button>
      <button type="button" class="btn" data-ae="apagar" title="Apagar ambiente (Delete)"${a?"":" disabled"} aria-label="Apagar ambiente">${aedIc("del")}</button>
    </div>`;
}
function aedPeHTML(){
  const f=AED_UI.ferr, d=AED_UI.drag, c=AED_UI.cursor;
  const dica = d && d.tipo==="divisa"? "As duas faces andam juntas · <kbd>Alt</kbd> arrasta só um lado"
    : d && d.tipo==="desenho"? "Solte para criar o ambiente · <kbd>Esc</kbd> cancela"
    : f==="des"? "Arraste para desenhar · ímã de 5 cm e nas bordas vizinhas"
    : f==="porta"? "Clique entre dois ambientes: põe ou tira a porta · <kbd>Shift</kbd>+clique troca o tipo (vão, correr, integrado) · no corredor, move a entrada"
    : "Arraste ambientes e divisas · <kbd>Shift</kbd>+clique escolhe o segundo para unir · setas movem 5 cm";
  return `<span>${dica}</span><span class="xy">${c? `x ${aedMd(c.x)} · y ${aedMd(c.y)} m` : "grade 50 cm · ímã 5 cm"}</span>`;
}

/* ---------- desenho: prancheta (SVG) ---------- */
function aedVista(){
  const w=AED_UI.el.querySelector(".aed-svgw"); const m=AED_UI.modelo; if(!w || !m) return null;
  const cw=w.clientWidth||800, ch=w.clientHeight||600, pl=64, pr=34, pt=58, pb=78;
  const s=Math.max(8, Math.min((cw-pl-pr)/m.W, (ch-pt-pb)/m.D, 92));
  const ox=pl+((cw-pl-pr)-m.W*s)/2, oy=pt+((ch-pt-pb)-m.D*s)/2;
  return {s, ox, oy, W:m.W, D:m.D, cw, ch, X:x=>ox+x*s, Y:y=>oy+(m.D-y)*s};
}
function aedSVG(){
  const m=AED_UI.modelo, V=aedVista(); if(!V) return ""; AED_UI.V=V;
  const {s, X, Y}=V, W=m.W, D=m.D, n=v=>v.toFixed(1), o=[];
  const val=AED_UI.val || {problemas:[]};
  o.push(`<defs><pattern id="aedHach" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)"><rect width="8" height="8" fill="var(--bad-soft)"/><line class="hl" x1="0" y1="0" x2="0" y2="8"/></pattern></defs>`);
  // corredor (faixa acima) e caixa da unidade com a grade
  o.push(`<rect class="corr" x="${n(X(0)-18)}" y="${n(Y(D)-26)}" width="${n(W*s+36)}" height="26" rx="3"/>`);
  o.push(`<rect class="cx" x="${n(X(0))}" y="${n(Y(D))}" width="${n(W*s)}" height="${n(D*s)}"/>`);
  for(let x=0.5; x<W-1e-6; x+=0.5) o.push(`<line class="grd${Math.abs(x-Math.round(x))<1e-6?" m":""}" x1="${n(X(x))}" y1="${n(Y(0))}" x2="${n(X(x))}" y2="${n(Y(D))}"/>`);
  for(let y=0.5; y<D-1e-6; y+=0.5) o.push(`<line class="grd${Math.abs(y-Math.round(y))<1e-6?" m":""}" x1="${n(X(0))}" y1="${n(Y(y))}" x2="${n(X(W))}" y2="${n(Y(y))}"/>`);
  // sobras (com a prancheta vazia, só a grade)
  if(m.ambientes.length) aedLivres(m).forEach(r=>o.push(`<rect class="livre" x="${n(X(r[0]))}" y="${n(Y(r[1]+r[3]))}" width="${n(r[2]*s)}" height="${n(r[3]*s)}"/>`));
  // ambientes (preenchimento)
  m.ambientes.forEach(a=>{ const [x,y,w,h]=a.ret; o.push(`<rect class="rm aed-k-${a.k}" x="${n(X(x))}" y="${n(Y(y+h))}" width="${n(w*s)}" height="${n(h*s)}"/>`) });
  // sobreposições
  aedMalha(m).cel.filter(c=>c.em.length>1).forEach(c=>o.push(`<rect class="sob" x="${n(X(c.x))}" y="${n(Y(c.y+c.h))}" width="${n(c.w*s)}" height="${n(c.h*s)}"/>`));
  // paredes internas; junção dos ambientes em L sem parede
  m.ambientes.forEach(a=>{ const [x,y,w,h]=a.ret; o.push(`<rect class="pr" x="${n(X(x))}" y="${n(Y(y+h))}" width="${n(w*s)}" height="${n(h*s)}"/>`) });
  for(let i=0;i<m.ambientes.length;i++) for(let j=i+1;j<m.ambientes.length;j++){ const A=m.ambientes[i], B=m.ambientes[j]; if(!A.grupo || A.grupo!==B.grupo) continue; const e=aedEncosto(aedB(A),aedB(B)); if(!e) continue;
    o.push(e.eixo==="x"? `<line class="gj aed-k-${A.k}" x1="${n(X(e.c))}" y1="${n(Y(e.s0)-1.5)}" x2="${n(X(e.c))}" y2="${n(Y(e.s1)+1.5)}"/>` : `<line class="gj aed-k-${A.k}" x1="${n(X(e.s0)+1.5)}" y1="${n(Y(e.c))}" x2="${n(X(e.s1)-1.5)}" y2="${n(Y(e.c))}"/>`) }
  // contorno da unidade
  o.push(`<rect class="po" x="${n(X(0))}" y="${n(Y(D))}" width="${n(W*s)}" height="${n(D*s)}"/>`);
  // janelas na fachada
  aedJanelas(m, aedSt()).forEach(j=>{ const y0=Y(0); o.push(`<line class="vao" x1="${n(X(j.x0))}" y1="${n(y0)}" x2="${n(X(j.x1))}" y2="${n(y0)}"/><line class="jan" x1="${n(X(j.x0))}" y1="${n(y0-1.6)}" x2="${n(X(j.x1))}" y2="${n(y0-1.6)}"/><line class="jan" x1="${n(X(j.x0))}" y1="${n(y0+1.6)}" x2="${n(X(j.x1))}" y2="${n(y0+1.6)}"/>`) });
  // portas
  const P=aedPortas(m, aedSt());
  P.forEach(p=>{ const g=aedPortaGeo(m,p); if(!g) return; o.push(aedPortaSVG(g, V)) });
  // alvos de porta (ferramenta Portas): trechos comuns entre ambientes
  if(AED_UI.ferr==="porta") aedVizinhos(m).forEach(v=>{ const tem=P.some(p=>(p.a===v.a&&p.b===v.b)||(p.a===v.b&&p.b===v.a));
    const l= v.eixo==="x"? [X(v.c),Y(v.s0)-3,X(v.c),Y(v.s1)+3] : [X(v.s0)+3,Y(v.c),X(v.s1)-3,Y(v.c)];
    o.push(`<line class="pt${tem?" on":""}" x1="${n(l[0])}" y1="${n(l[1])}" x2="${n(l[2])}" y2="${n(l[3])}"/>`) });
  // grupos: rótulo único no maior retângulo
  const rot={}; m.ambientes.forEach(a=>{ const k=aedNo(a); if(!rot[k] || aedArea(a)>aedArea(rot[k])) rot[k]=a });
  const areaNo=k=>m.ambientes.filter(a=>aedNo(a)===k).reduce((t,a)=>t+aedArea(a),0);
  const probs={}; val.problemas.forEach(p=>{ if(p.amb){ const a=aedAcha(m,p.amb); const k=a? aedNo(a) : p.amb; probs[k]= probs[k]==="bad"? "bad" : p.nivel } });
  // ambientes (camada de interação, rótulos, seleção)
  m.ambientes.forEach(a=>{ const [x,y,w,h]=a.ret, k=aedNo(a), cx=X(x+w/2), cy=Y(y+h/2), sw=w*s, sh=h*s;
    const on=AED_UI.sel && (AED_UI.sel===a.id || (aedAcha(m,AED_UI.sel) && aedNo(aedAcha(m,AED_UI.sel))===k && a.grupo)), on2=AED_UI.sel2===a.id, pis=AED_UI.pisca && (AED_UI.pisca===a.id || (aedAcha(m,AED_UI.pisca)&&aedNo(aedAcha(m,AED_UI.pisca))===k));
    const nome=aedNomeAmb(m,a), ar=areaNo(k);
    const lab=[];
    if(rot[k]===a){ const K=AED_K[a.k], cabe=sw>=70 && sh>=44, curto=sw<92? (K.curto||K.nome) : nome;
      if(cabe){ lab.push(`<text class="nm" x="${n(cx)}" y="${n(cy-(sh>=64?8:2))}" text-anchor="middle">${esc(sw<92? curto : nome)}</text>`);
        lab.push(`<text class="ar" x="${n(cx)}" y="${n(cy+(sh>=64?7:12))}" text-anchor="middle">${aedM2(ar)}</text>`);
        if(sh>=64 && sw>=74) lab.push(`<text class="dm" x="${n(cx)}" y="${n(cy+20)}" text-anchor="middle">${aedMd(w)} × ${aedMd(h)}</text>`) }
      else if(sw>=30 && sh>=16) lab.push(`<text class="ar" x="${n(cx)}" y="${n(cy+4)}" text-anchor="middle">${esc((K.curto||K.nome).slice(0,6))}</text>`);
      if(probs[k]) lab.push(`<circle class="${probs[k]==="bad"?"bdot":"wdot"}" cx="${n(X(x+w)-8)}" cy="${n(Y(y+h)+8)}" r="3.5"/>`);
    }
    o.push(`<g class="g${on?" on":""}${on2?" on2":""}${pis?" pisca":""}" data-id="${a.id}" tabindex="0" role="button" aria-pressed="${!!on}" aria-label="${esc(nome)}, ${aedFmt(ar,1)} metros quadrados, ${aedMd(w)} por ${aedMd(h)} metros">
      <rect class="sl" x="${n(X(x)+1.2)}" y="${n(Y(y+h)+1.2)}" width="${n(Math.max(0,sw-2.4))}" height="${n(Math.max(0,sh-2.4))}" fill="transparent" style="fill:transparent"/>${lab.join("")}</g>`);
  });
  // alças do selecionado
  const sa=AED_UI.sel && aedAcha(m,AED_UI.sel);
  if(sa && !AED_UI.drag){ const b=aedB(sa), hs=7, hd=(px,py)=>`<rect class="hd" x="${n(px-hs/2)}" y="${n(py-hs/2)}" width="${hs}" height="${hs}" rx="1.5"/>`;
    o.push(hd(X(b.x0),(Y(b.y0)+Y(b.y1))/2), hd(X(b.x1),(Y(b.y0)+Y(b.y1))/2), hd((X(b.x0)+X(b.x1))/2,Y(b.y0)), hd((X(b.x0)+X(b.x1))/2,Y(b.y1))) }
  // divisa sob o cursor
  if(AED_UI.hov && AED_UI.hov.div){ const d=AED_UI.hov.div; o.push(d.eixo==="x"? `<line class="dv on" x1="${n(X(d.c))}" y1="${n(Y(d.a0))}" x2="${n(X(d.c))}" y2="${n(Y(d.a1))}"/>` : `<line class="dv on" x1="${n(X(d.a0))}" y1="${n(Y(d.c))}" x2="${n(X(d.a1))}" y2="${n(Y(d.c))}"/>`) }
  // guia do ímã
  if(AED_UI.guia) AED_UI.guia.forEach(g=>o.push(g.eixo==="x"? `<line class="gui" x1="${n(X(g.c))}" y1="${n(Y(D)-30)}" x2="${n(X(g.c))}" y2="${n(Y(0)+12)}"/>` : `<line class="gui" x1="${n(X(0)-12)}" y1="${n(Y(g.c))}" x2="${n(X(W)+12)}" y2="${n(Y(g.c))}"/>`));
  // retângulo sendo desenhado
  const d=AED_UI.drag;
  if(d && d.tipo==="desenho" && d.r){ const [x,y,w,h]=d.r; o.push(`<rect class="des" x="${n(X(x))}" y="${n(Y(y+h))}" width="${n(w*s)}" height="${n(h*s)}" rx="2"/>`);
    if(w*s>50 && h*s>24) o.push(`<text class="desl" x="${n(X(x+w/2))}" y="${n(Y(y+h/2)+4)}" text-anchor="middle">${aedMd(w)} × ${aedMd(h)} · ${aedM2(w*h)}</text>`) }
  // entrada (âmbar) e rótulos dos lados
  const ex=X(m.entrada.x), ey=Y(D);
  o.push(`<text class="lado" x="${n(X(m.entrada.x>W/2? W*0.25 : W*0.75))}" y="${n(ey-9)}" text-anchor="middle">CORREDOR</text>`);
  o.push(`<g class="entg" data-ent="1" style="cursor:ew-resize"><circle class="ent" cx="${n(ex)}" cy="${n(ey-13)}" r="6"/><text class="entt" x="${n(ex+11)}" y="${n(ey-9.5)}">Entrada</text></g>`);
  o.push(`<text class="lado" x="${n(X(W/2))}" y="${n(Y(0)+22)}" text-anchor="middle">FACHADA</text>`);
  o.push(aedCotasSVG(m, V));
  return o.join("");
}
/* porta: vão na parede + folha + arco (entrada: abre para dentro, a partir do corredor) */
function aedPortaSVG(g, V){
  const n=v=>v.toFixed(1), {X,Y,s}=V, w=g.s1-g.s0;
  if(g.tipo==="vao" || g.tipo==="integ" || g.tipo==="correr"){   // passagem sem folha de abrir
    const H=g.eixo==="y", a= H? [X(g.s0),Y(g.c)] : [X(g.c),Y(g.s0)], b= H? [X(g.s1),Y(g.c)] : [X(g.c),Y(g.s1)], q=4;
    const gap=`<line class="vao i" x1="${n(a[0])}" y1="${n(a[1])}" x2="${n(b[0])}" y2="${n(b[1])}"/>`;
    if(g.tipo==="integ") return gap+`<line class="arc" x1="${n(a[0])}" y1="${n(a[1])}" x2="${n(b[0])}" y2="${n(b[1])}"/>`;
    const tk=p=> H? `<line class="fl" x1="${n(p[0])}" y1="${n(p[1]-q)}" x2="${n(p[0])}" y2="${n(p[1]+q)}"/>` : `<line class="fl" x1="${n(p[0]-q)}" y1="${n(p[1])}" x2="${n(p[0]+q)}" y2="${n(p[1])}"/>`;
    if(g.tipo==="vao") return gap+tk(a)+tk(b);
    const o=2, m=H? [(a[0]+b[0])/2, a[1]] : [a[0], (a[1]+b[1])/2];   // correr: duas folhas sobrepostas
    return gap+tk(a)+tk(b)+(H? `<line class="fl" x1="${n(a[0])}" y1="${n(a[1]-o)}" x2="${n(m[0]+3)}" y2="${n(a[1]-o)}"/><line class="fl" x1="${n(m[0]-3)}" y1="${n(a[1]+o)}" x2="${n(b[0])}" y2="${n(a[1]+o)}"/>`
      : `<line class="fl" x1="${n(a[0]-o)}" y1="${n(a[1])}" x2="${n(a[0]-o)}" y2="${n(m[1]-3)}"/><line class="fl" x1="${n(a[0]+o)}" y1="${n(m[1]+3)}" x2="${n(a[0]+o)}" y2="${n(b[1])}"/>`);
  }
  const H=g.eixo==="y", P0= H? [X(g.s0),Y(g.c)] : [X(g.c),Y(g.s0)], P1= H? [X(g.s1),Y(g.c)] : [X(g.c),Y(g.s1)];
  const vao=`<line class="vao${g.entrada?"":" i"}" x1="${n(P0[0])}" y1="${n(P0[1])}" x2="${n(P1[0])}" y2="${n(P1[1])}"/>`;
  if(g.pj) return vao+(H? `<rect class="pj" x="${n(P0[0])}" y="${n(P0[1]-2)}" width="${n(P1[0]-P0[0])}" height="4"/>` : `<rect class="pj" x="${n(P0[0]-2)}" y="${n(P1[1])}" width="4" height="${n(P0[1]-P1[1])}"/>`);
  // dobradiça no canto (g.dob), folha aberta para dentro de b, arco até a outra ponta do vão
  const [Hg, O] = g.dob==="hi"? [P1, P0] : [P0, P1], L=w*s;
  const dv = H? [0, g.dentro>0? -1 : 1] : [g.dentro>0? 1 : -1, 0];    // para dentro de b, na tela (y da tela para baixo)
  const Lf=[Hg[0]+dv[0]*L, Hg[1]+dv[1]*L], hl=[Lf[0]-Hg[0], Lf[1]-Hg[1]], ho=[O[0]-Hg[0], O[1]-Hg[1]], sw=(hl[0]*ho[1]-hl[1]*ho[0])>0? 1 : 0;
  return vao+`<line class="fl" x1="${n(Hg[0])}" y1="${n(Hg[1])}" x2="${n(Lf[0])}" y2="${n(Lf[1])}"/><path class="arc" d="M${n(Lf[0])} ${n(Lf[1])} A${n(L)} ${n(L)} 0 0 ${sw} ${n(O[0])} ${n(O[1])}"/>`;
}
/* cotas: corrente da fachada (ambientes que encostam nela), total W embaixo; corrente da esquerda e total D */
function aedCotasSVG(m, V){
  const {X,Y}=V, n=v=>v.toFixed(1), o=[], W=m.W, D=m.D;
  const xs=[...new Set([0,W,...m.ambientes.filter(a=>a.ret[1]<1e-6).flatMap(a=>[a.ret[0],a.ret[0]+a.ret[2]])].map(aedR3))].sort((a,b)=>a-b);
  const ys=[...new Set([0,D,...m.ambientes.filter(a=>a.ret[0]<1e-6).flatMap(a=>[a.ret[1],a.ret[1]+a.ret[3]])].map(aedR3))].sort((a,b)=>a-b);
  const yc=Y(0)+40, yt=Y(0)+62, xc=X(0)-30, xt=X(0)-50;
  const tick=(x,y,v)=> v? `<line class="cot" x1="${n(x-3)}" y1="${n(y+3)}" x2="${n(x+3)}" y2="${n(y-3)}"/>` : `<line class="cot" x1="${n(x-3)}" y1="${n(y+3)}" x2="${n(x+3)}" y2="${n(y-3)}"/>`;
  const hz=(arr, y, tot)=>{ o.push(`<line class="cot${tot?" t":""}" x1="${n(X(arr[0]))}" y1="${n(y)}" x2="${n(X(arr[arr.length-1]))}" y2="${n(y)}"/>`);
    arr.forEach(v=>o.push(`<line class="cot" x1="${n(X(v))}" y1="${n(y-5)}" x2="${n(X(v))}" y2="${n(y+5)}"/>`, tick(X(v),y)));
    for(let i=0;i<arr.length-1;i++){ const w=arr[i+1]-arr[i], px=(X(arr[i])+X(arr[i+1]))/2; if((X(arr[i+1])-X(arr[i]))>30) o.push(`<text class="ct" x="${n(px)}" y="${n(y-5)}" text-anchor="middle">${aedMd(w)}</text>`) } };
  const vt=(arr, x, tot)=>{ o.push(`<line class="cot${tot?" t":""}" x1="${n(x)}" y1="${n(Y(arr[0]))}" x2="${n(x)}" y2="${n(Y(arr[arr.length-1]))}"/>`);
    arr.forEach(v=>o.push(`<line class="cot" x1="${n(x-5)}" y1="${n(Y(v))}" x2="${n(x+5)}" y2="${n(Y(v))}"/>`, tick(x,Y(v))));
    for(let i=0;i<arr.length-1;i++){ const h=arr[i+1]-arr[i], py=(Y(arr[i])+Y(arr[i+1]))/2; if((Y(arr[i])-Y(arr[i+1]))>30) o.push(`<text class="ct" x="${n(x-5)}" y="${n(py)}" text-anchor="middle" transform="rotate(-90 ${n(x-5)} ${n(py)})">${aedMd(h)}</text>`) } };
  if(xs.length>2) hz(xs, yc, false); hz([0,W], yt, true);
  if(ys.length>2) vt(ys, xc, false); vt([0,D], xt, true);
  return o.join("");
}
function aedRenderMesa(){
  const el=AED_UI.el; if(!el) return; const f=el.querySelector(".aed-ferr"), sv=el.querySelector(".aed-svg"), pe=el.querySelector(".aed-pe"), dc=el.querySelector(".aed-dica");
  if(!sv || !AED_UI.modelo) return;
  const ae=document.activeElement, gid= ae && ae.closest && ae.closest(".aed-svg .g")? ae.closest(".g").dataset.id : null, fa=ae && f && f.contains(ae)? (ae.dataset.f||ae.dataset.ae||ae.id) : null;
  if(f){ f.innerHTML=aedFerrHTML(); if(fa){ const b=f.querySelector(`[data-f="${fa}"],[data-ae="${fa}"],#${fa}`); if(b && !b.disabled) b.focus() } }
  sv.innerHTML=aedSVG(); sv.classList.toggle("pt-on", AED_UI.ferr==="porta");
  sv.style.cursor = AED_UI.ferr==="des"? "crosshair" : AED_UI.ferr==="porta"? "pointer" : "";
  if(gid){ const g=sv.querySelector(`.g[data-id="${gid}"]`); if(g) try{ g.focus({preventScroll:true}) }catch(e){} }
  if(pe) pe.innerHTML=aedPeHTML();
  if(dc) dc.hidden = AED_UI.modelo.ambientes.length>0 || !!AED_UI.drag;
}

/* ---------- desenho: propriedades, validação e prévia ---------- */
function aedNotaPill(v){ const c=v.nota>=80 && v.ok? "ok" : v.nota>=55 && v.ok? "warn" : "bad"; return `<span class="pill ${c}">${v.ok? "nota "+Math.round(v.nota) : "com problemas"}</span>` }
const aedCampo = (f, v, un, o={})=>`<div class="inp"><input type="number" inputmode="decimal" step="${o.step||0.05}" min="${o.min!=null?o.min:0}" ${o.max!=null?`max="${o.max}"`:""} data-f="${f}" value="${(+v).toFixed(2)}" aria-label="${esc(o.aria||f)}"><em>${un}</em></div>`;
function aedPropHTML(){
  const m=AED_UI.modelo; if(!m) return "";
  const v=AED_UI.val || aedValida(m, aedSt()), a=AED_UI.sel && aedAcha(m, AED_UI.sel), r=aedResumo(m);
  const cls= v.nota>=80 && v.ok? "" : v.nota>=55 && v.ok? "warn" : "bad";
  const amb = a? (()=>{ const [x,y,w,h]=a.ret, nome=aedNomeAmb(m,a);
    return `<section class="aed-sec" aria-labelledby="aedAmbT">
      <div class="aed-sh"><h2 id="aedAmbT">${esc(nome)}</h2><span class="aed-fonte">${aedM2(a.grupo? m.ambientes.filter(x=>x.grupo===a.grupo).reduce((t,x)=>t+aedArea(x),0) : w*h)}</span></div>
      <div class="aed-f"><label for="aedAk">Tipo</label><select class="sel" id="aedAk" data-f="ak">${AED_KS.map(k=>`<option value="${k}"${k===a.k?" selected":""}>${AED_K[k].longo}</option>`).join("")}</select></div>
      <div class="aed-g4">
        <div class="aed-f"><span class="l">Largura</span>${aedCampo("aw", w, "m", {min:AED_MIN, aria:"Largura do ambiente"})}</div>
        <div class="aed-f"><span class="l">Profundidade</span>${aedCampo("ah", h, "m", {min:AED_MIN, aria:"Profundidade do ambiente"})}</div>
        <div class="aed-f"><span class="l">Da esquerda</span>${aedCampo("ax", x, "m", {aria:"Distância da esquerda"})}</div>
        <div class="aed-f"><span class="l">Da fachada</span>${aedCampo("ay", y, "m", {aria:"Distância da fachada"})}</div>
      </div>
      <div class="aed-f"><span class="l">Estica quando a unidade muda de tamanho${aedInfo("Estica")}</span><div class="seg full" role="group" aria-label="Estica">${AED_ESTICA.map(([k,l])=>`<button type="button" data-ae="estica" data-v="${k}" aria-pressed="${(a.estica||"")===k}">${l}</button>`).join("")}</div></div>
      <div class="aed-acts">${a.grupo? `<button type="button" class="btn" data-ae="separar">Separar do L</button>` : ""}<button type="button" class="btn" data-ae="apagar">${aedIc("del")}Apagar</button></div>
    </section>` })() : "";
  const probs = v.problemas.length? `<ul class="aed-probs">${v.problemas.map((p,i)=>`<li><button type="button" class="aed-pb" data-ae="prob" data-i="${i}"${p.amb?` data-amb="${esc(p.amb)}"`:""}><span class="dot ${p.nivel==="bad"?"bad":"warn"}"></span><span>${esc(p.msg)}</span></button></li>`).join("")}</ul>`
    : `<div class="aed-tudo">${aedIc("ok")}Tudo certo pelas regras</div>`;
  return `<section class="aed-sec" aria-labelledby="aedValT">
      <div class="aed-sh"><h2 id="aedValT">Validação</h2><span class="aed-fonte">${v.fonte==="regras"? "regras do Gabarito" : "conferência básica"}</span></div>
      <div class="aed-nota" id="aedNota"><span class="n">${m.ambientes.length? `${Math.round(v.nota)}<small>/100</small>` : "—"}</span><div class="t" style="flex:1"><span>${!m.ambientes.length? "Desenhe os ambientes" : v.ok? (v.nota>=80? "Pronto para usar nos estudos" : "Funciona, com alertas") : `${v.problemas.filter(p=>p.nivel==="bad").length} problema${v.problemas.filter(p=>p.nivel==="bad").length>1?"s":""} a resolver`}</span><span class="bar"><i class="${cls}" style="width:${m.ambientes.length? Math.round(v.nota) : 0}%"></i></span></div></div>
      ${m.ambientes.length? probs : ""}
    </section>
    ${amb}
    <section class="aed-sec" aria-labelledby="aedModT">
      <div class="aed-sh"><h2 id="aedModT">Modelo</h2><span class="aed-fonte">${aedM2(r.priv)} privativos</span></div>
      <div class="aed-f"><label for="aedNome">Nome</label><div class="inp"><input class="t" id="aedNome" data-f="nome" value="${esc(m.nome)}" maxlength="80" autocomplete="off"></div></div>
      <div class="aed-f"><label for="aedTip">Tipologia</label><select class="sel" id="aedTip" data-f="tip">${AED_TIPOLOGIAS.map(([k,n])=>`<option value="${k}"${k===m.tipologia?" selected":""}>${n}</option>`).join("")}</select></div>
      <div class="aed-g2">
        <div class="aed-f"><span class="l">Frente</span>${aedCampo("W", m.W, "m", {min:2.5, aria:"Frente da unidade"})}</div>
        <div class="aed-f"><span class="l">Profundidade</span>${aedCampo("D", m.D, "m", {min:2.5, aria:"Profundidade da unidade"})}</div>
      </div>
      <div class="aed-f"><span class="l">Funciona com frente de${aedInfo("Faixa do modelo")}</span><div class="aed-faixa">${aedCampo("fwmin", m.faixaW.min, "m", {aria:"Frente mínima"})}<span>a</span>${aedCampo("fwmax", m.faixaW.max, "m", {aria:"Frente máxima"})}</div></div>
      <div class="aed-f"><span class="l">e profundidade de</span><div class="aed-faixa">${aedCampo("fdmin", m.faixaD.min, "m", {aria:"Profundidade mínima"})}<span>a</span>${aedCampo("fdmax", m.faixaD.max, "m", {aria:"Profundidade máxima"})}</div></div>
      <div class="aed-f"><span class="l">Portas</span><div class="aed-acts"><span class="aed-fonte" style="align-self:center;flex:1">${Array.isArray(m.portas)? "editadas à mão" : "deduzidas pela vizinhança"}</span>${Array.isArray(m.portas)? `<button type="button" class="btn sm" data-ae="portasAuto">Deduzir de novo</button>` : ""}</div></div>
    </section>
    <section class="aed-sec" aria-labelledby="aedPrevT">
      <div class="aed-sh"><h2 id="aedPrevT">Como fica em outras frentes</h2></div>
      <div class="aed-prev" id="aedPrev">${m.ambientes.length? aedPreviaHTML(m) : `<span class="aed-fonte" style="grid-column:1/-1">Aparece quando houver ambientes.</span>`}</div>
    </section>`;
}
function aedPreviaHTML(m){
  const ws=[...new Set([m.faixaW.min, m.W, m.faixaW.max].map(aedR3))].sort((a,b)=>a-b).slice(0,3), st=aedSt();
  if(typeof aptoMiniEstilo==="function") try{ aptoMiniEstilo() }catch(e){}
  return ws.map(w=>{ let pl=null, val=null, mini="";
    if(typeof aptoAvalia==="function"){ try{ const r=aptoAvalia(m, w, m.D, {st}, st); if(r){ pl=r.planta; val=r.val } }catch(e){ pl=null } }
    if(!pl){ try{ pl=aedAplica(m, w, m.D, st) }catch(e){ pl=null } }
    const ehModelo = pl && Array.isArray(pl.ambientes) && pl.ambientes.every(a=>Array.isArray(a.ret));
    if(!val){ try{ val = ehModelo? aedValida(aedNormaliza(pl), st) : (typeof aptoValida==="function"? aptoValida(pl, st, {rapido:true}) : null) }catch(e){ val=null } }
    if(ehModelo) mini=aedMiniSVG(pl, {label:`Frente de ${aedMd(w)} m`});
    else if(pl && typeof aptoMiniSVG==="function"){ try{ mini=aptoMiniSVG(pl, {val, titulo:`Frente de ${aedMd(w)} m`}) }catch(e){ mini="" } }
    const pill = val && isFinite(+val.nota)? aedNotaPill({nota:+val.nota, ok: val.ok!==false}) : `<span class="pill">—</span>`;
    return `<div class="aed-pv"><div class="aed-fig">${mini}</div><b>${aedMd(w)} m${Math.abs(w-m.W)<1e-6? " · ref." : ""}</b>${pill}</div>` }).join("");
}
function aedRenderProp(){
  const c=AED_UI.el && AED_UI.el.querySelector(".aed-prop"); if(!c) return;
  const ae=document.activeElement, f= ae && c.contains(ae)? (ae.dataset.f || (ae.dataset.ae && ae.dataset.ae+(ae.dataset.v!=null?":"+ae.dataset.v:""))) : null, st=c.scrollTop;
  c.innerHTML=aedPropHTML(); c.scrollTop=st;
  if(f){ const [k,v]=f.split(":"); const e=c.querySelector(`[data-f="${k}"]`) || c.querySelector(v!=null? `[data-ae="${k}"][data-v="${v}"]` : `[data-ae="${k}"]`); if(e) try{ e.focus({preventScroll:true}) }catch(_){} }
}
/* depois de cada mudança do modelo */
function aedMudou(){ if(!AED_UI.el) return; AED_UI.val=aedValida(AED_UI.modelo, aedSt()); aedRenderMesa(); aedRenderProp(); aedRenderTopo() }
function aedRender(){
  const el=AED_UI.el; if(!el) return; AED_UI.cel=aedCelular(); AED_UI.val=AED_UI.modelo? aedValida(AED_UI.modelo, aedSt()) : null;
  el.innerHTML=`<header class="aed-top"></header>
    <div class="aed-corpo">
      <aside class="aed-col aed-lib" aria-label="Biblioteca de modelos"></aside>
      <section class="aed-mesa" aria-label="Prancheta">
        <div class="aed-ferr" role="toolbar" aria-label="Ferramentas da prancheta"></div>
        <div class="aed-svgw"><svg class="aed-svg" tabindex="-1" aria-label="Prancheta do modelo" xmlns="http://www.w3.org/2000/svg"></svg>
          <div class="aed-dica" hidden>${aedIc("ret")}<b>Arraste para desenhar o primeiro ambiente</b><span>ou comece de um partido, na coluna da esquerda</span></div></div>
        <div class="aed-pe" aria-live="polite"></div>
      </section>
      <aside class="aed-col aed-prop" aria-label="Propriedades e validação"></aside>
    </div>
    <div class="aed-snack" role="status" aria-live="polite" hidden></div>
    <div class="aed-conf" hidden></div>
    <input type="file" id="aedArq" accept=".json,application/json" hidden>`;
  aedRenderTopo(); aedRenderLib(); aedRenderMesa(); aedRenderProp(); aedSnack();
  const w=el.querySelector(".aed-svgw");
  if(AED_UI.ro) AED_UI.ro.disconnect();
  if(typeof ResizeObserver!=="undefined"){ AED_UI.ro=new ResizeObserver(()=>{ if(AED_UI.aberto && !AED_UI.drag) aedRenderMesa() }); AED_UI.ro.observe(w) }
}

/* ---------- interação na prancheta ---------- */
function aedPt(e){ const sv=AED_UI.el.querySelector(".aed-svg"), r=sv.getBoundingClientRect(), V=AED_UI.V; const sx=e.clientX-r.left, sy=e.clientY-r.top; return {x:(sx-V.ox)/V.s, y:V.D-(sy-V.oy)/V.s, sx, sy} }
/** coordenadas de tela de um ponto do modelo (testes e acessibilidade) */
function aptoEditorPonto(x, y){ const sv=AED_UI.el && AED_UI.el.querySelector(".aed-svg"), V=AED_UI.V; if(!sv || !V) return null; const r=sv.getBoundingClientRect(); return {x:r.left+V.X(x), y:r.top+V.Y(y)} }
/* o que está sob o cursor: entrada, divisa/borda ou ambiente */
function aedAlvo(p, alt){
  const m=AED_UI.modelo, V=AED_UI.V, tol=7/V.s;
  if(Math.abs(p.x-m.entrada.x)<10/V.s && p.y>m.D-2/V.s && p.y<m.D+26/V.s) return {tipo:"entrada"};
  let melhor=null;
  aedBordas(m).forEach(e=>{ const L=e.eixo==="x"? m.W : m.D; if(e.c<1e-6 || e.c>L-1e-6) return;
    const dd= e.eixo==="x"? Math.abs(p.x-e.c) : Math.abs(p.y-e.c), ao= e.eixo==="x"? p.y : p.x;
    if(dd>tol || ao<e.a0-1e-6 || ao>e.a1+1e-6) return;
    const pri = AED_UI.sel===e.id? -0.001 : 0;
    if(!melhor || dd+pri<melhor.dd) melhor={dd:dd+pri, e} });
  if(melhor){ const e=melhor.e, div=!alt && aedDivisas(m).find(d=>d.eixo===e.eixo && Math.abs(d.c-e.c)<1e-6 && (e.lado[1]==="1"? d.menos : d.mais).includes(e.id));
    if(div) return {tipo:"divisa", div}; return {tipo:"borda", id:e.id, lado:e.lado, eixo:e.eixo} }
  const dentro=m.ambientes.filter(a=>{ const b=aedB(a); return p.x>b.x0 && p.x<b.x1 && p.y>b.y0 && p.y<b.y1 });
  if(dentro.length){ const a=dentro.sort((u,v)=>aedArea(u)-aedArea(v))[0]; return {tipo:"amb", id:a.id} }
  return null;
}
/* referências para o ímã (bordas dos outros ambientes e da caixa) */
function aedAlvosIma(m, eixo, fora){
  const s=new Set([0, eixo==="x"? m.W : m.D]);
  m.ambientes.forEach(a=>{ if(fora && fora.includes(a.id)) return; const b=aedB(a); if(eixo==="x"){ s.add(b.x0); s.add(b.x1) } else { s.add(b.y0); s.add(b.y1) } });
  return [...s];
}
const aedImaTol = ()=> Math.min(6/AED_UI.V.s, 0.06);
function aedImaGuia(v, alvos, eixo){ const r=aedIma(v, alvos, aedImaTol()); if(alvos.some(a=>Math.abs(a-r)<1e-6)) (AED_UI.guia=AED_UI.guia||[]).push({eixo, c:r}); return r }
function aedPDown(e){
  if(e.button!==0 || !AED_UI.modelo || !AED_UI.V) return;
  const sv=e.currentTarget, p=aedPt(e), m=AED_UI.modelo, base=JSON.stringify(m);
  if(AED_UI.menu!=null){ AED_UI.menu=null; AED_UI.arm=null; aedRenderLib() }
  const a0=aedAlvo(p, e.altKey), alvo= AED_UI.ferr==="des"? (a0 && a0.tipo==="entrada"? a0 : null) : a0;
  try{ sv.setPointerCapture(e.pointerId) }catch(_){}
  e.preventDefault();
  if(AED_UI.ferr==="porta"){
    if(alvo && alvo.tipo==="entrada"){ AED_UI.drag={tipo:"entrada", base, p0:p, id:e.pointerId}; return }
    if(Math.abs(p.y-m.D)<10/AED_UI.V.s){ aedCommit(aedEntrada(m, p.x)); return }
    let best=null; aedVizinhos(m).forEach(v=>{ const dd= v.eixo==="x"? Math.abs(p.x-v.c) : Math.abs(p.y-v.c), ao= v.eixo==="x"? p.y : p.x; if(ao<v.s0 || ao>v.s1) return; if(dd<10/AED_UI.V.s && (!best || dd<best.dd)) best={dd, v} });
    if(best){ const had=aedPortas(m).find(q=>(q.a===best.v.a&&q.b===best.v.b)||(q.a===best.v.b&&q.b===best.v.a));
      if(had && e.shiftKey){ const n=aedPortaTipo(m, best.v.a, best.v.b); aedCommit(n); const t=(aedPortas(n).find(q=>(q.a===best.v.a&&q.b===best.v.b)||(q.a===best.v.b&&q.b===best.v.a))||{}).tipo;
        aedAviso({vao:"Vão livre", correr:"Porta de correr", integ:"Integrado, sem parede"}[t] || "Porta de abrir"); return }
      aedCommit(aedPortaAlterna(m, best.v.a, best.v.b)); aedAviso(had? "Porta retirada" : "Porta colocada") }
    return;
  }
  if(alvo && alvo.tipo==="entrada"){ AED_UI.drag={tipo:"entrada", base, p0:p, id:e.pointerId}; return }
  if(alvo && alvo.tipo==="divisa"){ AED_UI.drag={tipo:"divisa", div:alvo.div, base, p0:p, id:e.pointerId, m0:m}; return }
  if(alvo && alvo.tipo==="borda"){ AED_UI.sel=alvo.id; AED_UI.drag={tipo:"borda", idA:alvo.id, lado:alvo.lado, base, p0:p, id:e.pointerId, m0:m}; aedRenderMesa(); aedRenderProp(); return }
  if(alvo && alvo.tipo==="amb"){
    if(e.shiftKey && AED_UI.sel && AED_UI.sel!==alvo.id){ AED_UI.sel2=alvo.id; aedRenderMesa(); return }
    AED_UI.sel=alvo.id; AED_UI.sel2=null; const a=aedAcha(m,alvo.id);
    AED_UI.drag={tipo:"move", idA:alvo.id, base, p0:p, ret0:a.ret.slice(), id:e.pointerId, m0:m, moveu:false}; aedRenderMesa(); aedRenderProp(); return }
  // vazio (ou ferramenta Ambiente): desenha
  AED_UI.sel2=null;
  AED_UI.drag={tipo:"desenho", base, p0:{x:aedIma(p.x, aedAlvosIma(m,"x"), aedImaTol()), y:aedIma(p.y, aedAlvosIma(m,"y"), aedImaTol())}, id:e.pointerId, r:null};
  aedRenderMesa();
}
function aedPMove(e){
  if(!AED_UI.modelo || !AED_UI.V) return;
  const p=aedPt(e), d=AED_UI.drag, m=AED_UI.modelo;
  AED_UI.cursor={x:aedClamp(p.x,0,m.W), y:aedClamp(p.y,0,m.D)};
  if(!d){
    const sv=e.currentTarget, a= AED_UI.ferr==="sel"? aedAlvo(p, e.altKey) : null, hv= a && a.tipo==="divisa"? {div:a.div} : null;
    const cur = AED_UI.ferr!=="sel"? (AED_UI.ferr==="des"? "crosshair" : "pointer") : !a? "crosshair" : a.tipo==="entrada"? "ew-resize" : a.tipo==="amb"? "move" : (a.tipo==="divisa"? a.div.eixo : a.eixo)==="x"? "ew-resize" : "ns-resize";
    sv.style.cursor=cur;
    const muda=JSON.stringify(hv&&hv.div&&hv.div.id)!==JSON.stringify(AED_UI.hov&&AED_UI.hov.div&&AED_UI.hov.div.id); AED_UI.hov=hv;
    if(muda) aedRenderMesa(); else { const pe=AED_UI.el.querySelector(".aed-pe"); if(pe) pe.innerHTML=aedPeHTML() }
    return;
  }
  if(e.pointerId!==d.id) return;
  AED_UI.guia=null;
  if(d.tipo==="desenho"){
    const x1=aedImaGuia(aedClamp(p.x,0,m.W), aedAlvosIma(m,"x"), "x"), y1=aedImaGuia(aedClamp(p.y,0,m.D), aedAlvosIma(m,"y"), "y");
    d.r=[Math.min(d.p0.x,x1), Math.min(d.p0.y,y1), Math.abs(x1-d.p0.x), Math.abs(y1-d.p0.y)].map(aedR3);
  } else if(d.tipo==="move"){
    const dx=p.x-d.p0.x, dy=p.y-d.p0.y; if(!d.moveu && Math.hypot(dx,dy)*AED_UI.V.s<3) return; d.moveu=true;
    const [x,y,w,h]=d.ret0, ax=aedAlvosIma(d.m0,"x",[d.idA]), ay=aedAlvosIma(d.m0,"y",[d.idA]), t=aedImaTol();
    const sx=(()=>{ const a=aedIma(x+dx, ax, t), b=aedIma(x+w+dx, ax, t); const da=Math.abs(a-(x+dx)), db=Math.abs(b-(x+w+dx)); const ia=ax.some(v=>Math.abs(v-a)<1e-6), ib=ax.some(v=>Math.abs(v-b)<1e-6);
      if(ib && (!ia || db<da)){ (AED_UI.guia=AED_UI.guia||[]).push({eixo:"x", c:b}); return b-w } if(ia) (AED_UI.guia=AED_UI.guia||[]).push({eixo:"x", c:a}); return a })();
    const sy=(()=>{ const a=aedIma(y+dy, ay, t), b=aedIma(y+h+dy, ay, t); const da=Math.abs(a-(y+dy)), db=Math.abs(b-(y+h+dy)); const ia=ay.some(v=>Math.abs(v-a)<1e-6), ib=ay.some(v=>Math.abs(v-b)<1e-6);
      if(ib && (!ia || db<da)){ (AED_UI.guia=AED_UI.guia||[]).push({eixo:"y", c:b}); return b-h } if(ia) (AED_UI.guia=AED_UI.guia||[]).push({eixo:"y", c:a}); return a })();
    AED_UI.modelo=aedMove(d.m0, d.idA, sx-x, sy-y);
  } else if(d.tipo==="divisa"){
    const v= d.div.eixo==="x"? p.x : p.y, fora=[...d.div.menos, ...d.div.mais];
    AED_UI.modelo=aedMoveDivisa(d.m0, d.div, aedImaGuia(v, aedAlvosIma(d.m0, d.div.eixo, fora), d.div.eixo));
    AED_UI.hov={div:Object.assign({}, d.div, {c:(d.div.eixo==="x"? aedB(aedAcha(AED_UI.modelo,d.div.menos[0])).x1 : aedB(aedAcha(AED_UI.modelo,d.div.menos[0])).y1)})};
  } else if(d.tipo==="borda"){
    const v= d.lado[0]==="x"? p.x : p.y;
    AED_UI.modelo=aedRedim(d.m0, d.idA, d.lado, aedImaGuia(v, aedAlvosIma(d.m0, d.lado[0], [d.idA]), d.lado[0]));
  } else if(d.tipo==="entrada"){
    AED_UI.modelo=aedEntrada(m, p.x);
  }
  AED_UI.val=aedValida(AED_UI.modelo, aedSt()); aedRenderMesa();
}
function aedPUp(e){
  const d=AED_UI.drag; if(!d || e.pointerId!==d.id) return;
  AED_UI.drag=null; AED_UI.guia=null;
  if(d.tipo==="desenho"){
    if(d.r && d.r[2]>=AED_MIN && d.r[3]>=AED_MIN){ const r=aedCria(AED_UI.modelo, d.r, AED_UI.kDes); if(r.id){ AED_UI.sel=r.id; aedCommit(r.m, d.base); aedProxTipo(); return } }
    else if(d.r && (d.r[2]>0.05 || d.r[3]>0.05)) aedAviso(`Ambiente pequeno demais (mínimo ${aedMd(AED_MIN)} m)`);
    else { AED_UI.sel=null; AED_UI.sel2=null }
    aedRenderMesa(); aedRenderProp(); return;
  }
  if(d.tipo==="move" && !d.moveu){ aedRenderMesa(); return }
  const novo=AED_UI.modelo; AED_UI.modelo=JSON.parse(d.base); aedCommit(novo, d.base);
}
/* depois de desenhar, sugere o próximo tipo que falta no programa da tipologia */
function aedProxTipo(){
  const m=AED_UI.modelo, prog=AED_PROG[m.tipologia]||{}, cont={}; m.ambientes.forEach(a=>{ (cont[a.k]=cont[a.k]||new Set()).add(aedNo(a)) });
  const ordem=["sala","suite","dorm","circ","cozinha","serv","banho","bsuite","lavabo"];
  const k=ordem.find(k=>(prog[k]||0)>(cont[k]? cont[k].size : 0)); if(k && k!==AED_UI.kDes){ AED_UI.kDes=k; const s=AED_UI.el.querySelector("#aedKDes"); if(s) s.value=k }
}

/* ---------- ações ---------- */
function aedAcao(a, b){
  const m=AED_UI.modelo, sel=AED_UI.sel;
  switch(a){
    case "fechar": return aptoEditorFechar();
    case "salvar": return aedSalvar();
    case "undo": return aedDesfaz();
    case "redo": return aedRefaz();
    case "importar": return aedImportarAbre();
    case "exportar": return aedExportar(b && b.dataset.id);
    case "exptudo": return aedExportarTudo();
    case "novo": return aedNovoModelo();
    case "abrir": if(AED_UI.cel){ AED_UI.ver = AED_UI.ver===b.dataset.id? null : b.dataset.id; aedRenderLib(); return } return aedAbreDaBib(b.dataset.id);
    case "partido": if(AED_UI.cel){ aedAviso("Desenhe e use os partidos no computador"); return } return aedDoPartido(b.dataset.id);
    case "menu": { const id=b.dataset.id; AED_UI.menu= AED_UI.menu===id? null : id; AED_UI.arm=null; aedRenderLib(); if(AED_UI.menu) setTimeout(()=>{ const f=AED_UI.el.querySelector(".aed-menu [role=menuitem]"); if(f) f.focus() }, 20); return }
    case "duplicar": return aedDuplicar(b.dataset.id);
    case "excluir": return aedExcluir(b.dataset.id);
    case "desfaz": return aedDesfazBib();
    case "ferr": AED_UI.ferr=b.dataset.f; AED_UI.hov=null; aedRenderMesa(); return;
    case "divV": case "divH": if(sel){ const r=aedDivide(m, sel, a==="divV"? "x" : "y"); if(r.id){ AED_UI.sel=r.id; aedCommit(r.m) } } return;
    case "unir": if(sel && AED_UI.sel2){ const r=aedUne(m, sel, AED_UI.sel2); if(r.modo){ AED_UI.sel2=null; aedCommit(r.m); aedAviso(r.modo==="ret"? "Ambientes unidos" : "Unidos em L (um ambiente só)") } else aedAviso("Só dá para unir ambientes que se encostam") } return;
    case "separar": if(sel) aedCommit(aedSepara(m, sel)); return;
    case "espelhar": aedCommit(aedEspelha(m)); aedAviso("Espelhado: a entrada foi para o outro lado"); return;
    case "apagar": if(sel){ AED_UI.sel=null; aedCommit(aedRemove(m, sel)) } return;
    case "estica": if(sel) aedCommit(aedEstica(m, sel, b.dataset.v)); return;
    case "portasAuto": aedCommit(aedPortasAuto(m)); return;
    case "prob": { const id=b.dataset.amb; if(id){ AED_UI.sel=id; AED_UI.pisca=id; clearTimeout(AED_UI.piscaT); AED_UI.piscaT=setTimeout(()=>{ AED_UI.pisca=null; aedRenderMesa() }, 1500); aedRenderMesa(); aedRenderProp() } return }
  }
}
function aedProp(f, v){
  const m=AED_UI.modelo, a=AED_UI.sel && aedAcha(m, AED_UI.sel), num=parseFloat(String(v).replace(",", "."));
  if(f==="nome"){ const n=String(v).trim(); if(n && n!==m.nome){ const c=aedClone(m); c.nome=n.slice(0,80); aedCommit(c) } else aedRenderProp(); return }
  if(f==="tip"){ const c=aedClone(m); c.tipologia=v; aedCommit(c); return }
  if(f==="ak" && a){ aedCommit(aedTipo(m, a.id, v)); return }
  if(!isFinite(num)){ aedRenderProp(); return }
  if(f==="W" || f==="D"){ aedCommit(aedMedidas(m, f==="W"? num : m.W, f==="D"? num : m.D)); return }
  if(/^f[wd](min|max)$/.test(f)){ const c=aedClone(m), k=f[1]==="w"? "faixaW" : "faixaD", L=f[1]==="w"? m.W : m.D;
    if(f.endsWith("min")) c[k].min=aedR(Math.min(num, L)); else c[k].max=aedR(Math.max(num, L)); aedCommit(c); return }
  if(a && /^a[xywh]$/.test(f)){ const r=a.ret.slice(), i={ax:0,ay:1,aw:2,ah:3}[f]; r[i]=num; aedCommit(aedPoe(m, a.id, r)); return }
}

/* ---------- teclado ---------- */
function aedTecla(e){
  if(!AED_UI.aberto) return;
  const k=e.key||"", t=e.target, campo=t && (t.tagName==="INPUT" || t.tagName==="SELECT" || t.tagName==="TEXTAREA"), mod=e.ctrlKey||e.metaKey;
  if(AED_UI.conf){ if(k==="Escape"){ e.preventDefault(); e.stopPropagation(); aedConfFecha("cancela") } return }
  if(k==="Escape" && typeof POP!=="undefined" && POP && !POP.hidden) return;   // o ⓘ aberto fecha primeiro (ux.js)
  if(mod && k.toLowerCase()==="s"){ e.preventDefault(); e.stopPropagation(); if(!AED_UI.cel) aedSalvar(); return }
  if(mod && /^[zy]$/i.test(k)){
    if(campo && t.type!=="number" && t.tagName!=="SELECT") return;     // desfazer do próprio campo de texto
    e.preventDefault(); e.stopPropagation();
    const redo = k.toLowerCase()==="y" || e.shiftKey;
    if(!redo && AED_UI.desf && AED_UI.desf.fn && AED_UI.desf.t>=AED_UI.tEdit){ aedDesfazBib(); return }
    if(redo) aedRefaz(); else aedDesfaz(); return;
  }
  if(AED_UI.menu!=null){
    const its=[...AED_UI.el.querySelectorAll(".aed-menu [role=menuitem]")], i=its.indexOf(document.activeElement);
    if(k==="Escape"){ e.preventDefault(); e.stopPropagation(); const id=AED_UI.menu; AED_UI.menu=null; AED_UI.arm=null; aedRenderLib(); const b=AED_UI.el.querySelector(`.aed-it[data-id="${CSS.escape(id)}"] .aed-mais`); if(b) b.focus(); return }
    if(k==="ArrowDown"||k==="ArrowUp"){ e.preventDefault(); const n=its.length; its[((i<0? (k==="ArrowDown"?-1:0) : i)+(k==="ArrowDown"?1:-1)+n)%n].focus(); return }
  }
  if(campo){ if(k==="Escape"){ e.preventDefault(); e.stopPropagation(); t.blur(); if(t.id==="aedQ" && AED_UI.q){ AED_UI.q=""; aedRenderLib() } } else if(k==="Enter" && t.dataset.f){ t.blur() } return }
  if(k==="Escape"){
    e.preventDefault(); e.stopPropagation();
    if(AED_UI.drag){ AED_UI.modelo=JSON.parse(AED_UI.drag.base); AED_UI.drag=null; AED_UI.guia=null; aedMudou(); return }
    if(AED_UI.sel2){ AED_UI.sel2=null; aedRenderMesa(); return }
    if(AED_UI.sel){ AED_UI.sel=null; aedRenderMesa(); aedRenderProp(); return }
    if(AED_UI.ferr!=="sel"){ AED_UI.ferr="sel"; aedRenderMesa(); return }
    aptoEditorFechar(); return;
  }
  if(AED_UI.cel || mod || e.altKey) return;
  const m=AED_UI.modelo, sel=AED_UI.sel;
  if(k==="v"||k==="V"){ AED_UI.ferr="sel"; aedRenderMesa(); return }
  if(k==="r"||k==="R"){ AED_UI.ferr="des"; aedRenderMesa(); return }
  if(k==="p"||k==="P"){ AED_UI.ferr="porta"; aedRenderMesa(); return }
  if(!m || !sel) { if(k==="Enter" && t.closest && t.closest(".aed-svg .g")){ AED_UI.sel=t.closest(".g").dataset.id; aedRenderMesa(); aedRenderProp() } return }
  if(k==="Delete"||k==="Backspace"){ e.preventDefault(); AED_UI.sel=null; aedCommit(aedRemove(m, sel)); aedFocoMesa(); return }
  const st= e.shiftKey? 0.5 : AED_Q, mv={ArrowLeft:[-st,0], ArrowRight:[st,0], ArrowUp:[0,st], ArrowDown:[0,-st]}[k];
  if(mv){ e.preventDefault(); aedCommit(aedMove(m, sel, mv[0], mv[1])) }
}

/* ---------- eventos ---------- */
function aedClique(e){
  const b=e.target.closest("[data-ae],[data-cx]");
  if(AED_UI.menu!=null && !e.target.closest(".aed-menu") && !(b && b.dataset.ae==="menu")){ AED_UI.menu=null; AED_UI.arm=null; aedRenderLib() }
  if(!b) return;
  if(b.dataset.cx){ aedConfFecha(b.dataset.cx); return }
  if(b.disabled) return;
  aedAcao(b.dataset.ae, b);
}
function aedMuda(e){
  const t=e.target;
  if(t.id==="aedArq"){ const f=t.files && t.files[0]; if(f) f.text().then(aedImportarTexto).catch(()=>aedAviso("Não foi possível ler o arquivo")); return }
  if(t.id==="aedTipCat"){ AED_UI.tipCat=t.value; aedRenderLib(); const s=AED_UI.el.querySelector("#aedTipCat"); if(s) s.focus(); return }
  if(t.id==="aedKDes"){ AED_UI.kDes=t.value; return }
  if(t.dataset && t.dataset.f) aedProp(t.dataset.f, t.value);
}
function aedDigita(e){ if(e.target.id==="aedQ"){ AED_UI.q=e.target.value; aedRenderLib() } }
function aedFocoAmb(e){ const g=e.target.closest && e.target.closest(".aed-svg .g"); if(g && !AED_UI.drag && AED_UI.sel!==g.dataset.id && e.target.matches(":focus-visible")){ AED_UI.sel=g.dataset.id; AED_UI.sel2=null; aedRenderMesa(); aedRenderProp() } }

/* ---------- abrir e fechar ---------- */
function aptoEditorAbrir(o={}){
  if(!AED_UI.el){
    const el=document.createElement("div"); el.className="aed"; el.id="aptoEditor"; el.hidden=true;
    el.setAttribute("role","dialog"); el.setAttribute("aria-modal","true"); el.setAttribute("aria-labelledby","aedT"); el.tabIndex=-1;
    document.body.appendChild(el); AED_UI.el=el;
    el.addEventListener("click", aedClique); el.addEventListener("change", aedMuda); el.addEventListener("input", aedDigita);
    el.addEventListener("keydown", aedTecla); el.addEventListener("focusin", aedFocoAmb);
    const ev=(e, sv)=>({button:e.button, pointerId:e.pointerId, clientX:e.clientX, clientY:e.clientY, altKey:e.altKey, shiftKey:e.shiftKey, currentTarget:sv, preventDefault:()=>e.preventDefault()});
    el.addEventListener("pointerdown", e=>{ const sv=e.target.closest && e.target.closest(".aed-svg"); if(sv) aedPDown(ev(e, sv)) });
    el.addEventListener("pointermove", e=>{ const sv=el.querySelector(".aed-svg"); if(sv && (AED_UI.drag || (e.target.closest && e.target.closest(".aed-svg")))) aedPMove(ev(e, sv)) });
    el.addEventListener("pointerup", e=>aedPUp(e)); el.addEventListener("pointercancel", e=>aedPUp(e));
    el.addEventListener("pointerleave", e=>{ if(!AED_UI.drag && AED_UI.cursor){ AED_UI.cursor=null; const pe=el.querySelector(".aed-pe"); if(pe) pe.innerHTML=aedPeHTML() } });
    // foco fora da tela (body): as teclas continuam sendo do editor
    document.addEventListener("keydown", e=>{ const t=e.target; if(AED_UI.aberto && AED_UI.el && !AED_UI.el.contains(t) && (t===document.body || t===document.documentElement || (t.closest && t.closest(".app,#inicio")))) aedTecla(e) }, true);
    addEventListener("resize", ()=>{ if(!AED_UI.aberto) return; const c=aedCelular(); if(c!==AED_UI.cel) aedRender() });
    if(typeof aptoBibOuvir==="function") aptoBibOuvir(()=>{ if(AED_UI.aberto) aedRenderLib() });
  }
  AED_UI.onSalvar = typeof o.onSalvar==="function"? o.onSalvar : null;
  AED_UI.aberto=true; AED_UI.menu=null; AED_UI.arm=null; AED_UI.desf=null; AED_UI.ferr="sel";
  if(o.modelo) aedCarrega(o.modelo.origem==="catalogo"? aedCopia(o.modelo, o.modelo.nome) : o.modelo, o.modelo.origem!=="catalogo" && !!aptoBibObter(o.modelo.id));
  else if(o.tipologia){ AED_UI.tipCat=AED_TIP[o.tipologia]? o.tipologia : ""; aedCarrega(aedNovo({tipologia:o.tipologia}), false) }
  else if(!AED_UI.modelo){ const l=aptoBiblioteca(); if(l.length) aedCarrega(l[0], true); else aedCarrega(aedNovo({tipologia:"2d"}), false) }
  AED_UI.el.hidden=false; AED_UI.el.classList.remove("in"); void AED_UI.el.offsetWidth; AED_UI.el.classList.add("in");
  document.documentElement.style.overflow="hidden";
  aedRender();
  setTimeout(()=>{ aedRenderMesa(); try{ AED_UI.el.focus({preventScroll:true}) }catch(e){} }, 30);
  return true;
}
async function aptoEditorFechar(forcar){
  if(!AED_UI.el || !AED_UI.aberto) return true;
  if(!forcar && aedSujo() && !AED_UI.cel){
    const k=await aedConfirma("Fechar sem salvar?", `“${AED_UI.modelo.nome}” tem alterações que ainda não estão na biblioteca.`, [["cancela","Continuar editando","ghost"],["descarta","Descartar"],["salva","Salvar e fechar","pri"]]);
    if(k==="cancela") return false; if(k==="salva") aedSalvar();
  }
  AED_UI.aberto=false; AED_UI.drag=null; AED_UI.menu=null; clearTimeout(AED_UI.desfT); AED_UI.desf=null;
  if(AED_UI.ro){ AED_UI.ro.disconnect(); AED_UI.ro=null }
  AED_UI.el.hidden=true; AED_UI.el.innerHTML="";
  const ini=document.getElementById("inicio"); document.documentElement.style.overflow = ini && !ini.hidden? "hidden" : "";
  return true;
}
if(typeof ACT!=="undefined") ACT.aptoEditor = ()=>aptoEditorAbrir();
