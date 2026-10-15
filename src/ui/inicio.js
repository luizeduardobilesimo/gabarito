/* ================= tela inicial "Meus estudos" (UX v3 §3.0) =================
   Parte pura em src/calc/inicio.js (inicioResumo, inicioMini/inicioMiniSVG, inicioLista, inicioDeve, inicioTempo). Aqui só a tela:
   - inicioAbrir()      → tela cheia por cima do app (criada aqui, listener próprio, CSS injetado; z-index abaixo do assistente).
                          Pastas dos estudos do Repo (local ou nuvem), cada uma com miniatura, cidade, "editado há", status do checklist
                          (progressoResumo, gravado no resumo) e VGV · margem s/ VGV com o semáforo da Saúde · unidades — tudo do `resumo`
                          gravado com o estudo (estGrava), sem recalcular. Busca, filtro por status e ordem (estado de tela em INI, fora de S).
                          "Novo estudo" (o único laranja) → assAbrir({onDone, onCancel}). Menu "…": Abrir · Renomear (no lugar) · Duplicar ·
                          Excluir (armar/confirmar) — cada um com "Desfazer" na barra de baixo e Ctrl+Z.
   - inicioFechar()     → volta ao estudo aberto.
   - inicioDeveAbrir()  → ao iniciar (depois de estInit): 0 estudos próprios ou mais de 1 estudo; nunca com navigator.webdriver nem no
                          #ver=; preferência "sempre"/"nunca" em localStorage gabarito.inicio (interruptor no pé da tela).
   O P1 liga inicioAbrir() na marca do topo, no menu do estudo e na inicialização; assInicio() (P7) chama inicioAbrir() na 1ª visita. */

const INI = { fill:{ rodando:false, tent:new Set(), falhou:new Set(), atual:null }, el:null, aberto:false, q:"", f:"todos", ord:"recentes", lista:[], carregou:false, menu:null, arm:null, ren:null, desf:null, desfT:0, abrindo:null, voltar:false };
const INI_F = [["todos","Todos"],["rascunho","Rascunho"],["andamento","Em andamento"],["confiavel","Confiável"]];
const INI_ORD = [["recentes","Recentes"],["nome","Nome"],["margem","Margem"]];
const INI_ST = { rascunho:"Rascunho", andamento:"Em andamento", confiavel:"Confiável" };
const INI_IC = {
  mais:'<circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/>',
  novo:'<path d="M12 5.5v13M5.5 12h13"/>',
  busca:'<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 4.5 4.5"/>',
  abrir:'<path d="M4.5 7.5V18a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 18 8.5h-6.2L9.6 6H6a1.5 1.5 0 0 0-1.5 1.5z"/>',
  ren:'<path d="M4.5 19.5h4l10-10-4-4-10 10z"/><path d="m13 7 4 4"/>',
  dup:'<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
  del:'<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 10.5v6M14 10.5v6"/>',
  volta:'<path d="M19 12H5.5M11 6l-6 6 6 6"/>',
};
const iniIc = (k, cls="ico")=>`<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${INI_IC[k]}</svg>`;

(function(){ const s=document.createElement("style"); s.textContent=`
.ini:focus{outline:none}
.ini{position:fixed;inset:0;z-index:74;background:var(--bg);color:var(--ink);overflow-y:auto;font-family:var(--f-sans);-webkit-font-smoothing:antialiased;overscroll-behavior:contain}
.ini[hidden]{display:none}
.ini.in{animation:iniIn .28s var(--ease) both}
@keyframes iniIn{from{opacity:0}to{opacity:1}}
.ini-top{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:12px;height:var(--topbar-h,60px);padding:0 28px;background:color-mix(in srgb,var(--bg) 86%,transparent);-webkit-backdrop-filter:saturate(1.4) blur(12px);backdrop-filter:saturate(1.4) blur(12px);border-bottom:1px solid transparent;transition:border-color .2s var(--ease)}
.ini.rolou .ini-top{border-bottom-color:var(--line)}
.ini-top .brand{pointer-events:none}
.ini-top-r{display:flex;align-items:center;gap:6px}
.ini-top-r .btn.ghost{color:var(--ink-2)}
.ini-conta{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:3px 12px 3px 3px;font-size:12.5px;font-weight:550;color:var(--ink);max-width:220px}
.ini-conta i{width:26px;height:26px;border-radius:50%;background:var(--sel);color:var(--sel-ink);display:grid;place-items:center;font-style:normal;font-size:11px;font-weight:650;flex:none}
.ini-conta span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ini-main{max-width:1180px;margin:0 auto;padding:30px 28px 72px}
.ini-h{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:22px}
.ini-hb{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.ini-h h1{margin:0;font-size:30px;line-height:1.1;font-weight:650;letter-spacing:-.03em}
.ini-sub{margin:7px 0 0;font-size:13.5px;color:var(--muted)}
.ini .btn.lg{min-height:42px;padding:9px 18px;font-size:14px;border-radius:12px;gap:8px}
.ini .btn.lg .ico{width:18px;height:18px}
.ini .ico{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
.ini-bar{display:flex;align-items:center;gap:10px;margin-bottom:26px;flex-wrap:wrap}
.ini-q{flex:1 1 260px;max-width:380px}
.ini-q .ico{margin-left:11px;color:var(--faint)}
.ini-q input{padding:8px 10px 8px 8px}
.ini-q input::-webkit-search-cancel-button{-webkit-appearance:none}
.ini-bar .seg{flex:none}
.ini-ord{display:flex;align-items:center;gap:8px;margin-left:auto;font-size:12.5px;color:var(--muted);flex:none}
.ini-ord select.sel{width:auto;padding:6px 30px 6px 10px;font-size:12.5px;font-weight:550;color:var(--ink);background-position:right 8px center}
.ini-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(268px,1fr));gap:30px 20px;margin:0;padding:0;list-style:none}
/* pasta */
.ini-p{position:relative;margin-top:13px;background:var(--surface);border:1px solid var(--line);border-radius:3px var(--r-lg) var(--r-lg) var(--r-lg);box-shadow:var(--shadow-card);display:flex;flex-direction:column;transition:transform .2s var(--ease),box-shadow .2s var(--ease),border-color .2s var(--ease)}
.ini-tab{position:absolute;left:-1px;top:-13px;height:14px;min-width:42%;max-width:70%;padding:0 14px 0 12px;background:var(--surface);border:1px solid var(--line);border-bottom:0;border-radius:9px 14px 0 0;display:flex;align-items:center;gap:6px;font-size:10px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);transition:border-color .2s var(--ease)}
.ini-tab::after{content:"";position:absolute;left:0;right:0;bottom:-2px;height:3px;background:var(--surface)}
.ini-tab .dot{width:6px;height:6px}
.ini-p:hover{transform:translateY(-2px);box-shadow:var(--shadow);border-color:var(--line-2)}
.ini-p:hover .ini-tab{border-color:var(--line-2)}
.ini-p:has(.ini-abre:focus-visible){outline:2px solid var(--brand);outline-offset:3px}
.ini-fig{position:relative;height:150px;margin:8px 8px 0;border-radius:10px;background:var(--surface-2);background-image:radial-gradient(circle,var(--line) 1px,transparent 1.2px);background-size:14px 14px;background-position:7px 7px;overflow:hidden;display:grid;place-items:center}
.ini-svg{position:absolute;inset:0;width:100%;height:100%;padding:14px 20px;box-sizing:border-box;display:block;overflow:visible;transition:transform .35s var(--ease)}
.ini-p:hover .ini-svg{transform:scale(1.035)}
.ini-svg .ini-l{fill:var(--m-lote);fill-opacity:.7;stroke:var(--muted);stroke-width:1;vector-effect:non-scaling-stroke;stroke-linejoin:round}
.ini-svg .ini-l.vazio{fill:none;stroke-dasharray:4 4}
.ini-svg .ini-f{stroke:var(--ink);stroke-width:2.6;stroke-linecap:round;vector-effect:non-scaling-stroke}
.ini-svg .ini-s{fill:#000;opacity:.10}
.ini-svg .ini-t{fill:var(--m-tipo);stroke:var(--ink-2);stroke-width:1.1;vector-effect:non-scaling-stroke;stroke-linejoin:round}
:root[data-theme="dark"] .ini-svg .ini-s{opacity:.42}
.ini-c{padding:14px 16px 14px;display:grid;gap:9px;min-width:0}
.ini-n{margin:0;font-size:15px;line-height:1.3;font-weight:620;letter-spacing:-.012em;min-width:0;padding-right:30px}
.ini-abre{all:unset;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;max-width:100%}
.ini-abre::after{content:"";position:absolute;inset:0;z-index:1;border-radius:inherit}
.ini-m{margin:-5px 0 0;font-size:12.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ini-m b{font-weight:550;color:var(--ink-2)}
.ini-st{display:flex;align-items:center;gap:9px;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.ini-st .pill{font-size:10.5px;padding:4px 8px}
.ini-st .pill.and{background:var(--info-soft);color:var(--info)}
.ini-st .bar{flex:1;height:3px;border-radius:9px;background:var(--line);overflow:hidden;min-width:36px}
.ini-st .bar i{display:block;height:100%;border-radius:9px;background:var(--ink-2)}
.ini-st .bar i.ok{background:var(--ok)}
.ini-st .bar.ind i{width:40%;background:var(--brand);animation:iniInd 1.3s var(--ease) infinite}
@keyframes iniInd{0%{margin-left:-40%}100%{margin-left:100%}}
@media (prefers-reduced-motion:reduce){.ini-st .bar.ind i{animation:none;width:60%}}
.ini-k{display:grid;grid-template-columns:1.25fr 1fr .8fr;margin:3px 0 0;padding:11px 0 0;border-top:1px solid var(--line)}
.ini-k>div{min-width:0;padding:0 10px;border-left:1px solid var(--line)}
.ini-k>div:first-child{padding-left:0;border-left:0}
.ini-k dt{font-size:10.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);margin:0 0 3px}
.ini-k dd{margin:0;font-size:14px;font-weight:600;letter-spacing:-.01em;font-variant-numeric:tabular-nums;white-space:nowrap;display:flex;align-items:center;gap:6px;overflow:hidden}
.ini-k dd.vz{color:var(--faint);font-weight:500}
.ini-mais{position:absolute;z-index:2;right:10px;bottom:auto;top:168px;width:30px;height:30px;border-radius:8px;border:0;background:transparent;color:var(--muted);display:grid;place-items:center;transition:background .15s var(--ease),color .15s var(--ease)}
.ini-mais .ico{width:18px;height:18px;fill:currentColor;stroke:none}
.ini-mais:hover,.ini-mais[aria-expanded="true"]{background:var(--soft);color:var(--ink)}
.ini-menu{position:absolute;z-index:5;right:8px;top:200px;min-width:196px;background:var(--surface);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--shadow-pop);padding:5px;display:grid;gap:1px;animation:iniPop .16s var(--ease) both}
@keyframes iniPop{from{opacity:0;transform:translateY(-4px) scale(.98)}to{opacity:1;transform:none}}
.ini-menu button{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;font-size:13px;font-weight:500;color:var(--ink);cursor:pointer}
.ini-menu button .ico{color:var(--muted)}
.ini-menu button:hover,.ini-menu button:focus-visible{background:var(--soft)}
.ini-menu hr{border:0;border-top:1px solid var(--line);margin:4px 2px}
.ini-menu .del{color:var(--bad)} .ini-menu .del .ico{color:var(--bad)}
.ini-menu .del.arm{background:var(--bad);color:#fff} .ini-menu .del.arm .ico{color:#fff}
.ini-ren{margin:-4px 0 -3px}
.ini-ren input{font-size:14.5px;font-weight:600;padding:6px 9px}
.ini-p.abrindo{pointer-events:none}
.ini-p.abrindo .ini-fig::after{content:"";position:absolute;inset:0;background:color-mix(in srgb,var(--surface-2) 70%,transparent)}
.ini-p.abrindo .ini-fig::before{content:"";position:absolute;z-index:1;width:22px;height:22px;border-radius:50%;border:2px solid var(--line-2);border-top-color:var(--ink);animation:iniGira .8s linear infinite}
@keyframes iniGira{to{transform:rotate(360deg)}}
.ini-p.sk{pointer-events:none;box-shadow:none}
.ini-p.sk .ini-fig{background-image:none}
.ini-sk{height:10px;border-radius:6px;background:var(--soft)}
.ini-p.sk .ini-fig,.ini-sk{animation:iniSk 1.2s ease-in-out infinite alternate}
@keyframes iniSk{from{opacity:.55}to{opacity:1}}
/* vazio */
.ini-vazio{max-width:520px;margin:6vh auto 0;text-align:center;display:grid;justify-items:center;gap:10px}
.ini-vazio svg.il{width:220px;height:150px;margin-bottom:8px;overflow:visible}
.ini-vazio .il .g{fill:none;stroke:var(--line);stroke-width:1}
.ini-vazio .il .lt{fill:var(--surface);stroke:var(--line-2);stroke-width:1.4;stroke-dasharray:5 5}
.ini-vazio .il .fr{stroke:var(--ink);stroke-width:2.4;stroke-linecap:round}
.ini-vazio .il .tw{fill:var(--m-tipo);stroke:var(--ink-2);stroke-width:1.3;stroke-linejoin:round}
.ini-vazio .il .sh{fill:#000;opacity:.08}
:root[data-theme="dark"] .ini-vazio .il .sh{opacity:.4}
.ini-vazio .il .pl{fill:var(--brand)}
.ini-vazio .il .plx{stroke:var(--brand-ink);stroke-width:2;stroke-linecap:round}
.ini-vazio h2{margin:0;font-size:24px;font-weight:650;letter-spacing:-.025em}
.ini-vazio p{margin:0 0 14px;font-size:14px;color:var(--muted)}
.ini-vazio .acts{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.ini-nada{grid-column:1/-1;text-align:center;padding:48px 0;color:var(--muted);font-size:13.5px}
.ini-nada b{display:block;color:var(--ink);font-size:15px;font-weight:600;margin-bottom:4px}
.ini-pe{display:flex;justify-content:center;margin-top:44px}
.ini-pe .sw{font-size:12.5px;color:var(--muted)}
.ini-snack{position:fixed;z-index:6;left:50%;bottom:24px;transform:translateX(-50%);display:flex;align-items:center;gap:14px;background:var(--sel);color:var(--sel-ink);border-radius:12px;padding:8px 8px 8px 16px;font-size:13px;font-weight:500;box-shadow:var(--shadow-pop);max-width:calc(100vw - 32px);animation:iniSn .25s var(--ease) both}
.ini-snack[hidden]{display:none}
body:has(>.ini:not([hidden])) #toast{visibility:hidden}
.ini-snack span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ini-snack button{all:unset;cursor:pointer;padding:6px 10px;border-radius:8px;font-weight:650;color:var(--sel-ink);white-space:nowrap}
.ini-snack button:hover,.ini-snack button:focus-visible{background:color-mix(in srgb,var(--sel-ink) 14%,transparent)}
@keyframes iniSn{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translateX(-50%)}}
@media (prefers-reduced-motion:reduce){.ini.in,.ini-menu,.ini-snack{animation:none}.ini-p,.ini-svg{transition:none}.ini-p:hover{transform:none}.ini-p:hover .ini-svg{transform:none}}
@media (max-width:720px){
  .ini-top{padding:0 16px;height:56px}
  .ini .ini-top .brand .wm{display:block}
  .ini .ini-top .brand .by{display:none}
  .ini-conta span{display:none} .ini-conta{padding:3px}
  .ini-main{padding:18px 16px 96px}
  .ini-h{flex-direction:column;align-items:stretch;gap:16px;margin-bottom:18px}
  .ini-hb{flex-direction:column-reverse;align-items:stretch;gap:6px}
  .ini-h h1{font-size:26px}
  .ini-h .btn.lg{min-height:50px;font-size:15px;width:100%}
  .ini-bar{gap:10px;margin-bottom:20px}
  .ini-q{flex:1 1 0;min-width:0;max-width:none}
  .ini-q input{font-size:16px}
  .ini-ord{order:2;margin-left:0}
  .ini-ord select.sel{min-height:40px}
  .ini-bar .seg{order:3;flex:1 1 100%;min-width:0}
  .ini-ord span{display:none}
  .ini-grid{grid-template-columns:1fr;gap:26px}
  .ini-p{display:grid;grid-template-columns:104px minmax(0,1fr);align-items:stretch}
  .ini-fig{height:auto;min-height:118px;margin:8px 0 8px 8px}
  .ini-svg{padding:10px}
  .ini-c{padding:11px 12px 11px 13px;gap:7px}
  .ini-n{font-size:14.5px;padding-right:30px}
  .ini-k{grid-template-columns:1.3fr 1fr .8fr;padding-top:8px}
  .ini-k>div{padding:0 7px}
  .ini-k dd{font-size:13px}
  .ini-k dt{font-size:9.5px}
  .ini-mais{top:7px;right:6px}
  .ini-menu{top:40px;right:6px}
  .ini-vazio{margin-top:3vh}
  .ini-vazio .acts{flex-direction:column;align-items:stretch;width:100%}
  .ini-vazio .acts .btn{min-height:50px;font-size:15px}
  .ini-snack{bottom:calc(16px + env(safe-area-inset-bottom,0px));left:16px;right:16px;transform:none;max-width:none;justify-content:space-between}
  @keyframes iniSn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
}
`; document.head.appendChild(s) })();

/* ---------- dados ---------- */
const iniRes = e=> (typeof inicioDoRegistro==="function"? inicioDoRegistro(e) : null) || {};
const iniEhEx = e=> typeof inicioEhExemplo==="function"? inicioEhExemplo(e) : e.nome===DEF.nome;
const iniPl = (n, um, v)=> `${nf(n)} ${n===1? um : v}`;
const iniModoTxt = ()=>{ try{ const m=Repo.modo(); return m==="nuvem"? "salvos na sua conta" : m==="memoria"? "só nesta sessão" : "salvos neste navegador" }catch(e){ return "" } };
async function iniCarrega(){
  try{
    if(typeof EST!=="undefined" && EST.pronto){
      // o aberto ganha resumo novo (números da tela) antes de listar
      const cur=EST.lista.find(e=>e.id===EST.id), r=cur && iniRes(cur);
      if(typeof estGrava==="function" && window._last && (typeof calcOcioso!=="function" || calcOcioso()) && (EST.t || !r || r.vgv==null)) await estGrava();
      INI.lista = typeof estListar==="function"? await estListar() : await Repo.estudos.list();
    } else INI.lista = await Repo.estudos.list();
    INI.carregou=true;
  }catch(e){ console.error("[inicio] lista:", e); INI.carregou=true }
}

/* ---------- desenho ---------- */
function iniPastaHTML(e){
  const r=iniRes(e), ex=iniEhEx(e), st=typeof inicioStatus==="function"? inicioStatus(e) : null, at=typeof EST!=="undefined" && e.id===EST.id;
  const id=esc(e.id), nome=e.nome||"Estudo";
  const tab = ex? `<span class="dot" style="background:var(--brand)"></span>Exemplo` : at? "Aberto" : "";
  const quando = typeof inicioTempo==="function"? inicioTempo(e.atualizado||e.criado) : "";
  const meta = [r.cidade? `<b>${esc(String(r.cidade).split(/ [—·-] /)[0])}</b>` : ex? "Cidade fictícia" : "Cidade a definir", r.area? m2(r.area) : "", quando? (quando==="agora"? "editado agora" : "editado "+quando) : ""].filter(Boolean).join(" · ");
  const pr = r.total? r.feitos/r.total : 0;
  const pill = st? `<span class="pill ${st==="confiavel"?"ok":st==="andamento"?"and":""}">${INI_ST[st]}</span><span>${nf(r.feitos||0)}/${nf(r.total||9)}</span><span class="bar" aria-hidden="true"><i class="${st==="confiavel"?"ok":""}" style="width:${(pr*100).toFixed(0)}%"></i></span>`
    : INI.fill.falhou.has(e.id)? `<span class="pill">Sem resumo</span><span>abra para atualizar</span>`
    : `<span class="pill">Calculando…</span><span>${INI.fill.atual===e.id? "agora" : "na fila"}</span>${INI.fill.atual===e.id? `<span class="bar ind" aria-hidden="true"><i></i></span>` : ""}`;
  const n=(l,v,cls="")=>`<div><dt>${l}</dt><dd class="${v==null?"vz":cls}">${v==null? "—" : v}</dd></div>`;
  const mg = r.margem!=null? `<span class="dot ${typeof sdCls==="function"? sdCls(r.nivelMargem) : ({ruim:"bad",atencao:"warn"})[r.nivelMargem]||"ok"}" title="${esc(typeof sdTxt==="function"? sdTxt(r.nivelMargem) : "")}"></span>${pct(r.margem)}` : null;
  const fig = typeof inicioMiniSVG==="function"? inicioMiniSVG(r.mini, {label:"Lote e torres de "+nome}) : "";
  const ren = INI.ren===e.id;
  return `<li class="ini-p${ex?" ex":""}${at?" on":""}${INI.abrindo===e.id?" abrindo":""}" data-id="${id}">
    ${tab? `<span class="ini-tab">${tab}</span>` : `<span class="ini-tab" aria-hidden="true"></span>`}
    <div class="ini-fig">${fig}</div>
    <div class="ini-c">
      <h3 class="ini-n">${ren? `<div class="inp ini-ren"><input class="t" data-ren="${id}" value="${esc(nome)}" aria-label="Novo nome do estudo" maxlength="120" autocomplete="off"></div>`
        : `<button type="button" class="ini-abre" data-ia="abrir" data-id="${id}" title="${esc(nome)}">${esc(nome)}</button>`}</h3>
      <p class="ini-m">${meta}</p>
      <div class="ini-st">${pill}</div>
      <dl class="ini-k">${n("VGV", r.vgv!=null? mi(r.vgv) : null)}${n("Margem", mg)}${n("Unidades", r.un!=null? nf(r.un) : null)}</dl>
    </div>
    <button type="button" class="ini-mais" data-ia="menu" data-id="${id}" aria-haspopup="menu" aria-expanded="${INI.menu===e.id}" aria-label="Ações de ${esc(nome)}">${iniIc("mais")}</button>
    ${INI.menu===e.id? iniMenuHTML(e) : ""}
  </li>`;
}
function iniMenuHTML(e){
  const id=esc(e.id), arm=INI.arm===e.id;
  return `<div class="ini-menu" role="menu" aria-label="Ações do estudo">
    <button type="button" role="menuitem" data-ia="abrir" data-id="${id}">${iniIc("abrir")}Abrir</button>
    <button type="button" role="menuitem" data-ia="renomear" data-id="${id}">${iniIc("ren")}Renomear</button>
    <button type="button" role="menuitem" data-ia="duplicar" data-id="${id}">${iniIc("dup")}Duplicar</button>
    <hr>
    <button type="button" role="menuitem" class="del${arm?" arm":""}" data-ia="excluir" data-id="${id}">${iniIc("del")}${arm? "Confirmar exclusão" : "Excluir"}</button>
  </div>`;
}
function iniSkeleton(){ return Array.from({length:3}, ()=>`<li class="ini-p sk" aria-hidden="true"><span class="ini-tab"></span><div class="ini-fig"></div><div class="ini-c"><div class="ini-sk" style="width:62%;height:13px"></div><div class="ini-sk" style="width:44%"></div><div class="ini-sk" style="width:80%;margin-top:8px"></div></div></li>`).join("") }
function iniVazioHTML(){
  const temEx = INI.lista.some(iniEhEx);
  return `<div class="ini-vazio">
    <svg class="il" viewBox="0 0 220 150" aria-hidden="true">
      <path class="g" d="M10 30h200M10 60h200M10 90h200M10 120h200M40 10v130M80 10v130M120 10v130M160 10v130M200 10v130" opacity=".7"/>
      <polygon class="lt" points="52,28 168,22 176,124 46,130"/>
      <line class="fr" x1="46" y1="130" x2="176" y2="124"/>
      <polygon class="sh" points="92,58 136,56 147,46 147,90 136,98 103,99"/>
      <polygon class="tw" points="86,62 130,60 132,100 88,102"/>
      <circle class="pl" cx="168" cy="22" r="11"/><path class="plx" d="M168 17v10M163 22h10"/>
    </svg>
    <h2 id="iniVz">Comece o seu primeiro estudo</h2>
    <p>Do lote à viabilidade em poucos minutos.</p>
    <div class="acts"><button type="button" class="btn pri lg" data-ia="novo">${iniIc("novo")}Novo estudo</button><button type="button" class="btn lg" data-ia="exemplo">${temEx? "Explorar o exemplo" : "Abrir um exemplo"}</button></div>
  </div>`;
}
const iniProprios = ()=> INI.lista.filter(e=>!iniEhEx(e)).length;
function iniGridHTML(){
  if(!INI.carregou) return `<ul class="ini-grid" aria-busy="true">${iniSkeleton()}</ul>`;
  const l = typeof inicioLista==="function"? inicioLista(INI.lista, {q:INI.q, status:INI.f, ordem:INI.ord}) : INI.lista;
  if(!l.length) return `<ul class="ini-grid"><li class="ini-nada"><b>Nenhum estudo encontrado</b>${INI.q? `para “${esc(INI.q)}”` : "com este status"} · <button type="button" class="btn sm ghost" data-ia="limpa">Limpar filtros</button></li></ul>`;
  return `<ul class="ini-grid" aria-label="Estudos">${l.map(iniPastaHTML).join("")}</ul>`;
}
function iniSubTxt(){
  if(!INI.carregou) return "Abrindo os estudos…";
  const n=INI.lista.length; return `${iniPl(n,"estudo","estudos")} · ${iniModoTxt()}`;
}
function iniPrefOn(){
  const p=LS.get("gabarito.inicio"); if(p==="sempre") return true; if(p==="nunca") return false;
  return typeof inicioDeve==="function"? inicioDeve({total:INI.lista.length, proprios:iniProprios()}) : true;
}
function iniContaHTML(){
  try{ if(typeof AUTH==="undefined" || !AUTH.ativo || !AUTH.usuario) return "" }catch(e){ return "" }
  const u=AUTH.usuario, nome=u.nome||u.email||"Conta Rixel", ini=typeof authIniciais==="function"? authIniciais(u.nome||u.email) : "R";
  return `<span class="ini-conta" title="${esc(nome)}${u.email&&u.email!==nome? " · "+esc(u.email) : ""}"><i aria-hidden="true">${esc(ini)}</i><span>${esc(nome)}</span></span>`;
}
function iniRender(){
  const el=INI.el; if(!el) return;
  const vazio = INI.carregou && iniProprios()===0;
  const brand = (document.querySelector(".top .brand")||{}).innerHTML || `<span class="wm">gabarito<i>.</i></span>`;
  el.innerHTML = `<header class="ini-top"><div class="brand" aria-hidden="true">${brand}</div>
      <div class="ini-top-r">${typeof aptoEditorAbrir==="function"? `<button type="button" class="btn ghost sm" data-ia="aptos" title="Plantas de apartamento que você usa como modelo nos estudos">Modelos de apartamento</button>` : ""}${INI.voltar && !vazio? `<button type="button" class="btn ghost sm" data-ia="voltar" title="Voltar ao estudo aberto (Esc)">${iniIc("volta")}<span>Voltar ao estudo</span></button>` : ""}${iniContaHTML()}</div></header>
    <main class="ini-main">
      ${vazio? iniVazioHTML() : `<div class="ini-h"><div><h1 id="iniT">Meus estudos</h1><p class="ini-sub" id="iniSub">${iniSubTxt()}</p></div>
        <div class="ini-hb">${INI.carregou && !INI.lista.some(iniEhEx)? `<button type="button" class="btn ghost" data-ia="exemplo" title="Abre o estudo de exemplo como um estudo à parte">Ver o exemplo</button>` : ""}<button type="button" class="btn pri lg" data-ia="novo">${iniIc("novo")}Novo estudo</button></div></div>
      <div class="ini-bar" role="search">
        <div class="inp ini-q">${iniIc("busca")}<input type="search" id="iniQ" value="${esc(INI.q)}" placeholder="Buscar por nome ou cidade" aria-label="Buscar estudos" autocomplete="off"></div>
        <div class="seg" role="group" aria-label="Filtrar por status">${INI_F.map(([k,l])=>`<button type="button" data-if="${k}" aria-pressed="${INI.f===k}">${l}</button>`).join("")}</div>
        <label class="ini-ord"><span>Ordenar</span><select class="sel" id="iniOrd" aria-label="Ordenar estudos">${INI_ORD.map(([k,l])=>`<option value="${k}"${INI.ord===k?" selected":""}>${l}</option>`).join("")}</select></label>
      </div>
      <div id="iniGrid">${iniGridHTML()}</div>`}
      <div class="ini-pe"><label class="sw"><input type="checkbox" id="iniPref"${iniPrefOn()?" checked":""}><span class="tg"></span><span>Mostrar esta tela ao abrir o Gabarito</span></label></div>
    </main>
    <div class="ini-snack" id="iniSnack" role="status" aria-live="polite"${INI.desf? "" : " hidden"}>${INI.desf? iniSnackHTML() : ""}</div>`;
  el.setAttribute("aria-labelledby", vazio? "iniVz" : "iniT");
}
function iniGrid(){
  const g=document.getElementById("iniGrid"); if(!g) return iniRender();
  g.innerHTML=iniGridHTML();
  const s=document.getElementById("iniSub"); if(s) s.textContent=iniSubTxt();
}
/* re-desenha a lista; se mudou de "vazio" para "com estudos" (ou o contrário), a tela inteira */
function iniAtualiza(){
  const vazio = INI.carregou && iniProprios()===0, era = !!(INI.el && INI.el.querySelector(".ini-vazio"));
  if(vazio!==era || !document.getElementById("iniGrid") && !vazio) iniRender(); else if(!vazio) iniGrid();
  const sn=document.getElementById("iniSnack"); if(sn){ sn.hidden=!INI.desf; sn.innerHTML=INI.desf? iniSnackHTML() : "" }
}

/* ---------- desfazer (barra de baixo e Ctrl+Z) ---------- */
function iniSnackHTML(){ const d=INI.desf; return `<span>${esc(d.rot)}</span>${d.fn? `<button type="button" data-ia="desfaz">Desfazer</button>` : ""}` }
/* aviso na barra de baixo (o toast do app fica escondido enquanto a tela está aberta) */
function iniAviso(rot){ iniDesfGuarda(rot, null); const sn=document.getElementById("iniSnack"); if(sn){ sn.hidden=false; sn.innerHTML=iniSnackHTML() } }
function iniDesfGuarda(rot, fn){
  INI.desf={rot, fn}; clearTimeout(INI.desfT);
  INI.desfT=setTimeout(()=>{ INI.desf=null; const sn=document.getElementById("iniSnack"); if(sn){ sn.hidden=true; sn.innerHTML="" } }, 12000);
}
async function iniDesfaz(){
  const d=INI.desf; if(!d || !d.fn) return false; INI.desf=null; clearTimeout(INI.desfT);
  try{ await d.fn() }catch(e){ console.error("[inicio] desfazer:", e); iniAviso("Não foi possível desfazer"); return false }
  await iniCarrega(); iniAtualiza(); return true;
}

/* ---------- ações ---------- */
const iniAcha = id=> INI.lista.find(e=>e.id===id);
function iniFoco(sel){ setTimeout(()=>{ const f=INI.el && INI.el.querySelector(sel); if(f) try{ f.focus({preventScroll:false}) }catch(e){} }, 20) }
async function iniAbrirEstudo(id){
  if(!id || INI.abrindo) return;
  if(typeof EST!=="undefined" && id===EST.id){ inicioFechar(); return }
  INI.abrindo=id; INI.menu=null; iniGrid();
  try{ if(typeof estAbrir==="function") await estAbrir(id); inicioFechar() }
  catch(e){ console.error("[inicio] abrir:", e); iniAviso("Não foi possível abrir o estudo"); iniGrid() }
  finally{ INI.abrindo=null }
}
async function iniDuplicar(id){
  const e=iniAcha(id); INI.menu=null;
  const rec = typeof estDuplicar==="function"? await estDuplicar(id) : null;
  await iniCarrega(); iniAtualiza();
  if(rec){ iniDesfGuarda(`Cópia criada: “${rec.nome}”`, async()=>{ await Repo.estudos.remove(rec.id); if(typeof estRefresh==="function") await estRefresh() });
    iniAtualiza(); iniFoco(`.ini-p[data-id="${CSS.escape(rec.id)}"] .ini-abre`) }
  else if(e) iniAviso("Não foi possível duplicar");
}
function iniRenomear(id){ INI.menu=null; INI.arm=null; INI.ren=id; iniGrid(); iniFoco(`[data-ren="${CSS.escape(id)}"]`); setTimeout(()=>{ const i=INI.el && INI.el.querySelector("[data-ren]"); if(i) i.select() }, 30) }
async function iniRenomeia(id, nome, cancela){
  if(INI.ren!==id) return; INI.ren=null;
  const e=iniAcha(id); nome=String(nome||"").trim();
  if(cancela || !e || !nome || nome===e.nome){ iniGrid(); iniFoco(`.ini-p[data-id="${CSS.escape(id)}"] .ini-abre`); return }
  e.nome=nome; iniGrid();
  const r = typeof estRenomear==="function"? await estRenomear(id, nome) : null;
  await iniCarrega(); iniAtualiza(); iniFoco(`.ini-p[data-id="${CSS.escape(id)}"] .ini-abre`);
  if(r && r.ant!=null && r.ant!==nome) iniDesfGuarda(`Renomeado para “${nome}”`, ()=>estRenomear(id, r.ant)), iniAtualiza();
}
async function iniExcluir(id){
  if(INI.arm!==id){ INI.arm=id; iniGrid(); iniFoco(`.ini-menu .del`); return }
  INI.arm=null; INI.menu=null;
  const x = typeof estExcluir==="function"? await estExcluir(id) : null;
  await iniCarrega();
  if(x){ INI.voltar = typeof EST!=="undefined" && !!EST.id; iniDesfGuarda(`“${x.nome}” excluído`, ()=>estDesfazExclusao(x)) } else iniAviso("Não foi possível excluir");
  iniAtualiza(); iniFoco(".ini-snack button");
}
async function iniExemplo(){
  const ex=INI.lista.find(iniEhEx);
  if(ex) return iniAbrirEstudo(ex.id);
  if(typeof estNovo==="function") await estNovo(clone(DEF), DEF.nome);
  inicioFechar();
}
function iniNovo(){
  INI.menu=null;
  if(typeof assAbrir!=="function"){ iniAviso("Assistente indisponível"); return }
  assAbrir({ onDone: ()=>inicioFechar(), onCancel: ()=>{ if(INI.aberto){ document.documentElement.style.overflow="hidden"; iniFoco('[data-ia="novo"]') } } });
}
function iniFechaMenu(foco){ if(INI.menu==null) return false; const id=INI.menu; INI.menu=null; INI.arm=null; iniGrid(); if(foco) iniFoco(`.ini-p[data-id="${CSS.escape(id)}"] .ini-mais`); return true }

/* ---------- eventos ---------- */
function iniClique(e){
  const b=e.target.closest("[data-ia],[data-if]");
  if(INI.menu!=null && !e.target.closest(".ini-menu") && !(b && b.dataset.ia==="menu" && b.dataset.id===INI.menu)) iniFechaMenu(false);
  if(!b) return;
  if(b.dataset.if){ INI.f=b.dataset.if; INI.el.querySelectorAll("[data-if]").forEach(x=>x.setAttribute("aria-pressed", String(x===b))); iniGrid(); return }
  const a=b.dataset.ia, id=b.dataset.id;
  if(a==="abrir") iniAbrirEstudo(id);
  else if(a==="menu"){ if(INI.menu===id){ iniFechaMenu(true); return } INI.menu=id; INI.arm=null; iniGrid(); iniFoco(".ini-menu [role=menuitem]") }
  else if(a==="renomear") iniRenomear(id);
  else if(a==="duplicar") iniDuplicar(id);
  else if(a==="excluir") iniExcluir(id);
  else if(a==="novo") iniNovo();
  else if(a==="exemplo") iniExemplo();
  else if(a==="voltar") inicioFechar();
  else if(a==="aptos" && typeof aptoEditorAbrir==="function") aptoEditorAbrir();
  else if(a==="desfaz") iniDesfaz();
  else if(a==="limpa"){ INI.q=""; INI.f="todos"; iniRender(); iniFoco("#iniQ") }
}
function iniDigita(e){ if(e.target.id==="iniQ"){ INI.q=e.target.value; iniGrid() } }
function iniMuda(e){
  const t=e.target;
  if(t.id==="iniOrd"){ INI.ord=t.value; LS.set("gabarito.inicio.ordem", INI.ord); iniGrid() }
  else if(t.id==="iniPref") LS.set("gabarito.inicio", t.checked? "sempre" : "nunca");
}
function iniTecla(e){
  const k=e.key||"", ren=e.target.dataset && e.target.dataset.ren;
  if((e.ctrlKey||e.metaKey) && /^[zy]$/i.test(k)){   // o desfazer do estudo não age por baixo da tela; aqui desfaz a última ação da tela
    if(ren) return;
    e.stopPropagation(); e.preventDefault();
    if(k.toLowerCase()==="z" && !e.shiftKey) iniDesfaz();
    return;
  }
  if(ren){ if(k==="Enter"){ e.preventDefault(); iniRenomeia(ren, e.target.value) } else if(k==="Escape"){ e.preventDefault(); e.stopPropagation(); iniRenomeia(ren, "", true) } return }
  if(INI.menu!=null){
    const its=[...INI.el.querySelectorAll(".ini-menu [role=menuitem]")], i=its.indexOf(document.activeElement);
    if(k==="Escape"){ e.preventDefault(); iniFechaMenu(true); return }
    if(k==="ArrowDown"||k==="ArrowUp"){ e.preventDefault(); const n=its.length; its[((i<0? (k==="ArrowDown"?-1:0) : i)+(k==="ArrowDown"?1:-1)+n)%n].focus(); return }
    if(k==="Tab"){ iniFechaMenu(false) }
    if(k==="Home"||k==="End"){ e.preventDefault(); its[k==="Home"?0:its.length-1].focus(); return }
  }
  if(k==="Escape"){ e.preventDefault(); if(INI.q && e.target.id==="iniQ"){ INI.q=""; e.target.value=""; iniGrid(); return } if(INI.voltar) inicioFechar(); return }
  if(k==="/" && e.target.tagName!=="INPUT"){ const q=document.getElementById("iniQ"); if(q){ e.preventDefault(); q.focus() } }
}
function iniSai(e){ const t=e.target; if(t.dataset && t.dataset.ren && INI.ren===t.dataset.ren) iniRenomeia(t.dataset.ren, t.value) }

/* ---------- resumos que faltam ----------
   Estudos salvos antes da v3 não têm `resumo` (VGV, margem, unidades, status): a pasta ficaria com "—" até ser aberta. Ao abrir a tela,
   em segundo plano e UM por vez, calcula cada um (Worker "job"; sem Worker, na página, com S trocado só durante a conta) e grava o
   resumo SEM mexer no "editado há" (Repo.estudos.put(…, {manterData:true})). A pasta é redesenhada sozinha ao terminar; a tela segue livre. */
const iniSemResumo = e=>{ const r=iniRes(e); return r.vgv==null || !r.nivel };
const iniPausa = ms=>new Promise(r=>setTimeout(r, ms));
async function iniCalcula(st){
  if(typeof calcOn==="function" && calcOn() && typeof calcJob==="function"){
    try{ return await calcJob().call("compute", [st, {}]) }
    catch(e){ if(!(typeof calcCancelado==="function" && calcCancelado(e))) console.warn("[inicio] cálculo no Worker falhou — calculando na página:", e && e.message); else return null }
  }
  await iniPausa(30);
  const keep=S; S=st; try{ return compute(st, {}) } finally { S=keep }
}
/** calcula e grava o resumo de um estudo (o aberto: pelo caminho normal do app). → o registro atualizado ou null */
async function iniResumoDe(e){
  if(typeof EST!=="undefined" && e.id===EST.id){
    if(window._last && window._last.m && window._last.f && (typeof calcOcioso!=="function" || calcOcioso()) && typeof estGrava==="function"){ await estGrava(); return (EST.lista.find(x=>x.id===e.id)) || null }
    return null;   // o estudo aberto ganha o dele quando o cálculo completo chega (estAbrir/estGrava)
  }
  const rec=await Repo.estudos.get(e.id); if(!rec || !rec.S) return null;
  const st=merge(clone(DEF), clone(rec.S)), m=await iniCalcula(st); if(!m || !m.T) return null;
  const keep=S; let resumo; S=st;
  try{ const f=finance(st, m); resumo=inicioResumo(st, m, f, inicioDoRegistro(rec)) } finally { S=keep }
  if(!resumo || resumo.vgv==null) return null;
  const k={...(rec.k||{}), resumo}, novo=await Repo.estudos.put({...rec, k, resumo}, {manterData:true});
  const r={...novo}; delete r.S;
  if(typeof EST!=="undefined"){ const i=EST.lista.findIndex(x=>x.id===r.id); if(i>=0) EST.lista[i]=r }
  return r;
}
function iniRedesenhaPasta(e){
  const g=document.getElementById("iniGrid"); if(!g || !INI.el) return;
  const li=g.querySelector(`.ini-p[data-id="${CSS.escape(e.id)}"]`);
  // filtro por status ou ordem por margem dependem do resumo: refaz a lista; senão, só a pasta (sem tirar o foco de quem digita ou renomeia)
  if(INI.f!=="todos" || INI.ord==="margem" || !li){ if(INI.ren==null) iniGrid(); return }
  if(INI.ren===e.id || INI.menu===e.id) return;
  const t=document.createElement("template"); t.innerHTML=iniPastaHTML(e).trim(); if(t.content.firstElementChild) li.replaceWith(t.content.firstElementChild);
}
async function iniCompleta(){
  const F=INI.fill; if(F.rodando) return; F.rodando=true;
  try{
    for(let n=0; n<200 && INI.aberto; n++){
      const e=INI.lista.find(x=>iniSemResumo(x) && !F.tent.has(x.id)); if(!e) break;
      F.tent.add(e.id); F.atual=e.id; iniRedesenhaPasta(e);
      let r=null; try{ r=await iniResumoDe(e) }catch(err){ console.warn("[inicio] resumo de "+e.id+":", err && err.message) }
      F.atual=null;
      const i=INI.lista.findIndex(x=>x.id===e.id);
      if(r && i>=0){ INI.lista[i]={...INI.lista[i], ...r}; F.falhou.delete(e.id) } else F.falhou.add(e.id);
      if(i>=0) iniRedesenhaPasta(INI.lista[i]);
      await iniPausa(60);   // respira entre um estudo e outro: a tela nunca fica presa
    }
  } finally { F.rodando=false; F.atual=null }
}

/* ---------- abrir e fechar ---------- */
function inicioAbrir(){
  // a entrada pela Rixel (auth.js) vem antes: espera ela sair da frente
  const a=document.getElementById("authTela");
  if(a && a.isConnected && !a.hidden && getComputedStyle(a).display!=="none"){ clearTimeout(INI.espera); INI.espera=setTimeout(inicioAbrir, 600); return }
  if(typeof progressoFechar==="function") try{ progressoFechar() }catch(e){}
  if(!INI.el){
    INI.el=document.createElement("div"); INI.el.className="ini"; INI.el.id="inicio"; INI.el.hidden=true;
    INI.el.setAttribute("role","dialog"); INI.el.setAttribute("aria-modal","true"); INI.el.tabIndex=-1;
    document.body.appendChild(INI.el);
    INI.el.addEventListener("click", iniClique); INI.el.addEventListener("input", iniDigita); INI.el.addEventListener("change", iniMuda);
    INI.el.addEventListener("keydown", iniTecla); INI.el.addEventListener("focusout", iniSai);
    // foco fora da tela (ex.: no body depois de abrir outro estudo por baixo): as teclas continuam sendo da tela, não do estudo
    // (só o que está por baixo: body ou o app; o assistente e outras telas por cima cuidam das suas teclas)
    document.addEventListener("keydown", e=>{ const t=e.target;
      if(INI.aberto && INI.el && !INI.el.contains(t) && (t===document.body || t===document.documentElement || (t.closest && t.closest(".app")))) iniTecla(e) }, true);
    INI.el.addEventListener("scroll", ()=>INI.el.classList.toggle("rolou", INI.el.scrollTop>4), {passive:true});
    const o=LS.get("gabarito.inicio.ordem"); if(INI_ORD.some(([k])=>k===o)) INI.ord=o;
  }
  const jaAberto=INI.aberto;
  INI.aberto=true; INI.menu=null; INI.arm=null; INI.ren=null; INI.abrindo=null;
  INI.voltar = typeof EST!=="undefined" && !!EST.id;
  if(typeof EST!=="undefined" && EST.lista && EST.lista.length){ INI.lista=EST.lista.slice(); INI.carregou=true }   // instantâneo: o que já está em memória
  INI.el.hidden=false; if(!jaAberto){ INI.el.classList.remove("in"); void INI.el.offsetWidth; INI.el.classList.add("in"); INI.el.scrollTop=0 }
  document.documentElement.style.overflow="hidden";
  iniRender();
  if(!jaAberto) setTimeout(()=>{ try{ INI.el.focus({preventScroll:true}) }catch(e){} }, 20);
  iniCarrega().then(()=>{ if(!INI.aberto) return; INI.voltar = typeof EST!=="undefined" && !!EST.id && INI.lista.some(e=>e.id===EST.id); iniRender(); iniCompleta() });
}
function inicioFechar(){
  if(!INI.el) return; INI.aberto=false; INI.menu=null; INI.ren=null; INI.arm=null;
  INI.el.hidden=true; INI.el.innerHTML=""; document.documentElement.style.overflow="";
  try{ if(typeof size3d==="function" && typeof VIEW!=="undefined" && VIEW==="3d") size3d(); else if(typeof size2d==="function"){ size2d(); redraw2d() } }catch(e){}
}
/** abrir ao iniciar? (chamar depois de estInit: a lista de estudos já está em EST.lista) */
function inicioDeveAbrir(){
  let wd=false; try{ wd=!!navigator.webdriver }catch(e){}
  const ver = /(^|[#&])ver=/.test(location.hash||"") || document.documentElement.classList.contains("ap-ro");
  const l = typeof EST!=="undefined" && EST.pronto? EST.lista : null;
  if(!l) return false;
  return inicioDeve({ total:l.length, proprios:l.filter(e=>!iniEhEx(e)).length, webdriver:wd, ver, pref:LS.get("gabarito.inicio") });
}
ACT.inicio = ()=>inicioAbrir();
