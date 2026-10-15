/* ================= assistente "Novo estudo", faixa do exemplo e entrada da 1ª visita (UX v3 §3.1 e §3.2) =================
   Parte pura em src/calc/assistente.js (assEstado, assEhExemplo, assPrecoSugerido…). Aqui só a tela:
   - assAbrir(opts?)  → tela cheia por cima do app (criada aqui, listener próprio). opts = {onDone(estudoId), onCancel(), primeira}.
     Estado local ASS (nada vai para S antes de "Gerar"). 4 passos: Terreno · Regras · Produto · Gerando (barra, Voltar, Pular).
     Gerar: assEstado → otimizador (otimRodar(opts, onProg, {st, m}) do P3 quando aceitar o 3º argumento; senão o Worker "job" do
     calcworker com o estado explícito; senão otimizar() na página) → aplicarOtim → um único passo de desfazer → Viabilidade
     + cartão "O que fizemos". Sem combinação: máximo de pavimentos (maxPav) e Produto com aviso. Mapa/"desenhar depois": sem otimizador,
     vai para Terreno (o mapa abre sozinho).
     O estudo novo: se o aberto é o exemplo intocado, ele mesmo vira o estudo; senão estNovo() cria outro (o aberto fica guardado).
     Nos dois casos Ctrl+Z volta ao exemplo.
   - assInicio()      → 1ª visita (sem gabarito.v2/gabarito.estudo no navegador, sem navigator.webdriver, fora do #ver=):
     chama inicioAbrir() (tela inicial "Meus estudos", outro pacote) se existir; senão abre o assistente. Grava gabarito.boasvindas.
     Linha no fim de main.js (P1): if(typeof assInicio==="function") assInicio()
   - #exBanner        → faixa acima do #phead enquanto assEhExemplo(S): "Estudo de exemplo · Começar o meu · Usar como base". */

const ASS_PRIMEIRA = (()=>{ try{ return !localStorage.getItem("gabarito.v2") && !localStorage.getItem("gabarito.estudo") && !localStorage.getItem("gabarito.boasvindas") }catch(e){ return false } })();
const ASS = { el:null, passo:0, r:null, opts:{}, rodando:false, cancel:false, erro:"", prog:0, fase:0, feito:null };
const ASS_PASSOS = ["Terreno","Regras","Produto","Pronto"];
const ASS_IC = {
  ret:'<rect x="7.5" y="3.5" width="12" height="17" rx="1"/><path d="M4 3.5v17M3 3.5h2M3 20.5h2" opacity=".55"/>',
  mapa:'<path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.4"/>',
  coord:'<circle cx="12" cy="12" r="7.5"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/><circle cx="12" cy="12" r="1.6"/>',
  depois:'<path d="M4.5 19.5h4l10-10-4-4-10 10z"/><path d="m13 7 4 4" opacity=".55"/>',
  compacto:'<path d="M3.5 20.5h17"/><rect x="6" y="11" width="12" height="9.5" rx=".8"/><path d="M9 14h1.5M13.5 14H15M9 17h1.5M13.5 17H15" opacity=".6"/>',
  familia:'<path d="M3.5 20.5h17"/><rect x="7" y="6" width="10" height="14.5" rx=".8"/><path d="M9.7 9h1.3M13 9h1.3M9.7 12h1.3M13 12h1.3M9.7 15h1.3M13 15h1.3" opacity=".6"/>',
  alto:'<path d="M3.5 20.5h17"/><rect x="8" y="3" width="8" height="17.5" rx=".8"/><path d="M10.3 6h1.1M12.6 6h1.1M10.3 9h1.1M12.6 9h1.1M10.3 12h1.1M12.6 12h1.1M10.3 15h1.1M12.6 15h1.1" opacity=".6"/>',
  ok:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
};
const assIc = (k, cls="")=>`<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ASS_IC[k]}</svg>`;

(function(){ const s=document.createElement("style"); s.textContent=`
.ass{position:fixed;inset:0;z-index:76;background:var(--bg);color:var(--ink);display:flex;flex-direction:column;align-items:center;overflow-y:auto;font-family:var(--f-sans,var(--f-body));-webkit-font-smoothing:antialiased}
.ass[hidden]{display:none}
.ass-top{width:100%;max-width:1120px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 24px 0;flex:none}
.ass-top .brand{pointer-events:none}
.ass-top .btn{color:var(--muted)}
.ass-wrap{flex:1;width:100%;display:flex;align-items:safe center;justify-content:center;padding:24px 20px 6vh}
.ass-box{width:min(600px,100%);background:var(--surface);border:1px solid var(--line);border-radius:var(--r-xl,22px);box-shadow:var(--shadow-card);display:flex;flex-direction:column}
.ass-box.in{animation:assIn .35s var(--ease) both}
.ass-top .by{display:none}
.ass-tt{font-size:13px;font-weight:550;color:var(--muted);padding-left:12px;margin-left:2px;border-left:1px solid var(--line)}
@keyframes assIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.ass-prog{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:22px 32px 0}
.ass-seg{display:grid;gap:7px;font-size:11.5px;font-weight:550;color:var(--faint,var(--muted));letter-spacing:.01em}
.ass-seg i{display:block;height:3px;border-radius:9px;background:var(--line);overflow:hidden;position:relative}
.ass-seg i::after{content:"";position:absolute;inset:0;width:0;background:var(--sel);border-radius:9px;transition:width .45s var(--ease)}
.ass-seg.done{color:var(--muted)} .ass-seg.done i::after{width:100%}
.ass-seg.on{color:var(--ink)} .ass-seg.on i::after{width:100%}
.ass-body{padding:26px 32px 8px;display:grid;gap:18px;min-height:0}
.ass-h .eb{font-size:12px;color:var(--muted);font-weight:500;margin:0 0 6px}
.ass-h h1{margin:0;font-size:26px;line-height:1.15;font-weight:650;letter-spacing:-.025em}
.ass-h p{margin:8px 0 0;font-size:14px;color:var(--muted);line-height:1.45}
.ass-l{font-size:12.5px;font-weight:550;color:var(--ink-2);margin:0 0 7px;display:block}
.ass .fld .fl{font-size:12.5px;font-weight:550;color:var(--ink-2)}
.ass .inp input{font-size:15px;padding:10px 12px}
.ass .inp em{font-size:12.5px;padding-right:12px}
.ass select.sel{font-size:14.5px;padding:10px 34px 10px 12px}
.ass textarea{min-height:96px;font-size:13px;font-family:var(--f-code,monospace);resize:vertical}
.ass-g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ass-tiles{display:grid;gap:10px}
.ass-tiles.t4{grid-template-columns:repeat(4,1fr)} .ass-tiles.t3{grid-template-columns:repeat(3,1fr)}
.ass-tile{display:grid;align-content:start;gap:4px;text-align:left;border:1px solid var(--line);background:var(--surface);border-radius:var(--r,12px);padding:13px 13px 12px;cursor:pointer;color:var(--ink);font:inherit;box-shadow:var(--shadow-s);transition:border-color .15s var(--ease),box-shadow .15s var(--ease),background .15s var(--ease);min-height:96px}
.ass-tile:hover{border-color:var(--line-2)}
.ass-tile svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;color:var(--muted);margin-bottom:6px;transition:color .15s}
.ass-tile b{font-size:13.5px;font-weight:600;letter-spacing:-.005em}
.ass-tile span{font-size:12px;color:var(--muted);line-height:1.35;display:block}
.ass-tile[aria-pressed="true"]{border-color:var(--sel);box-shadow:0 0 0 1px var(--sel)}
.ass-tile[aria-pressed="true"] svg{color:var(--ink)}
.ass-tile:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
.ass-ctx{display:grid;gap:12px;padding:16px;border-radius:var(--r,12px);background:var(--surface-2);border:1px solid var(--line)}
.ass-ctx .inp{background:var(--field)}
.ass-ret{display:grid;grid-template-columns:1fr 1fr 112px;gap:12px;align-items:end}
.ass-prev{height:74px;display:grid;place-items:center;position:relative}
.ass-prev svg{width:112px;height:74px;overflow:visible}
.ass-prev .lt{fill:var(--sel-soft);stroke:var(--ink);stroke-width:1.4}
.ass-prev .fr{stroke:var(--brand);stroke-width:2.6;stroke-linecap:round}
.ass-prev text{font-size:11px;fill:var(--muted);font-family:var(--f-sans);font-weight:500}
.ass-note{display:flex;gap:10px;align-items:flex-start;font-size:13px;color:var(--ink-2);line-height:1.45;margin:0}
.ass-note svg{width:18px;height:18px;flex:none;fill:none;stroke:var(--muted);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;margin-top:1px}
.ass-st{font-size:12.5px;color:var(--muted);min-height:18px;margin:0}
.ass-st.bad{color:var(--bad)} .ass-st.ok{color:var(--ok-t)}
.ass-tag{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)}
.ass-tag i{width:6px;height:6px;border-radius:50%;background:var(--warn);flex:none}
.ass-tag.ok i{background:var(--ok)}
.ass-sug{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--muted);margin-top:6px;flex-wrap:wrap}
.ass-sug button{border:0;background:var(--soft);color:var(--ink);border-radius:999px;padding:3px 10px;font:inherit;font-size:12px;font-weight:550;cursor:pointer}
.ass-sug button:hover{background:var(--surface-3)}
.ass .sw{font-size:13.5px}
.ass-foot{display:flex;align-items:center;gap:8px;padding:18px 32px 24px;margin-top:6px}
.ass-foot .sp{flex:1}
.ass-foot .btn{min-height:42px;padding:9px 16px;font-size:14px;border-radius:12px}
.ass-foot .btn.pri{min-width:150px}
.ass-run{display:grid;gap:18px}
.ass-bar{height:6px;border-radius:9px;background:var(--line);overflow:hidden}
.ass-bar i{display:block;height:100%;width:0;background:var(--brand);border-radius:9px;transition:width .35s var(--ease)}
.ass-pc{font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums;display:flex;justify-content:space-between;margin-top:9px}
.ass-fases{display:grid;gap:2px;margin:0;padding:0;list-style:none}
.ass-fases li{display:grid;grid-template-columns:22px 1fr;gap:10px;align-items:center;padding:8px 0;font-size:14px;color:var(--faint,var(--muted))}
.ass-fases li .d{width:18px;height:18px;border-radius:50%;border:1.5px solid var(--line-2);display:grid;place-items:center}
.ass-fases li.on{color:var(--ink)} .ass-fases li.on .d{border-color:var(--ink);border-top-color:transparent;animation:assGira .8s linear infinite}
.ass-fases li.done{color:var(--ink-2)} .ass-fases li.done .d{background:var(--ok);border-color:var(--ok)}
.ass-fases li .d svg{width:11px;height:11px;fill:none;stroke:#fff;stroke-width:2.8;stroke-linecap:round;stroke-linejoin:round;display:none}
.ass-fases li.done .d svg{display:block}
@keyframes assGira{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.ass-box{animation:none}.ass-fases li.on .d{animation:none}}
@media (max-width:640px){
  .ass{background:var(--surface)}
  .ass-top{padding:12px 16px 0}
  .ass-tt{border-left:0;padding-left:4px}
  .ass-wrap{padding:0;align-items:stretch}
  .ass-box{border:0;border-radius:0;box-shadow:none;width:100%;min-height:100%}
  .ass-prog{padding:14px 16px 0;gap:6px}
  .ass-body{padding:22px 16px 12px;gap:16px;flex:1;align-content:start}
  .ass-h h1{font-size:23px}
  .ass-tiles.t4{grid-template-columns:1fr 1fr} .ass-tiles.t3{grid-template-columns:1fr}
  .ass-tiles.t3 .ass-tile{grid-template-columns:28px 1fr;column-gap:12px;min-height:0;align-items:center}
  .ass-tiles.t3 .ass-tile svg{grid-row:span 2;margin:0}
  .ass-tile{min-height:84px}
  .ass-ret{grid-template-columns:1fr 1fr}
  .ass-prev{grid-column:1/-1;height:74px}
  .ass-foot{position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--line);padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));margin:0}
  .ass-foot .btn{min-height:50px;font-size:15px}
  .ass-foot .btn.pri{flex:1;min-width:0}
}
/* cartão "O que fizemos" */
.ass-feito{position:fixed;right:20px;bottom:92px;z-index:58;width:min(372px,calc(100vw - 24px));background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg,16px);box-shadow:var(--shadow-pop);padding:16px 16px 12px;color:var(--ink);animation:assIn .35s var(--ease) both}
.ass-feito[hidden]{display:none}
.ass-feito .fh{display:flex;align-items:flex-start;gap:10px}
.ass-feito .fh .ic{width:28px;height:28px;border-radius:50%;background:var(--ok-soft,var(--surface-2));color:var(--ok-t);display:grid;place-items:center;flex:none}
.ass-feito .fh .ic.warn{background:var(--warn-soft,var(--surface-2));color:var(--warn-t)}
.ass-feito .fh .ic svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.ass-feito .fh b{display:block;font-size:15px;font-weight:650;letter-spacing:-.01em}
.ass-feito .fh span{display:block;font-size:12.5px;color:var(--muted);margin-top:2px;line-height:1.4}
.ass-feito .fx{margin-left:auto;border:0;background:none;color:var(--muted);padding:4px;border-radius:8px;cursor:pointer;line-height:0}
.ass-feito .fx:hover{background:var(--soft);color:var(--ink)}
.ass-feito .fx svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}
.ass-feito dl{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin:14px 0 4px;font-size:12.5px}
.ass-feito dt{color:var(--muted)} .ass-feito dd{margin:0;color:var(--ink);font-weight:500;font-variant-numeric:tabular-nums}
.ass-feito dd.warn{color:var(--warn-t)}
.ass-feito .pg{font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--faint,var(--muted));font-weight:600;margin:12px 0 2px}
.ass-feito .pi{display:flex;align-items:center;gap:10px;padding:6px 0;border-top:1px solid var(--line);font-size:13px}
.ass-feito .pg+.pi{border-top:0}
.ass-feito .pi span{flex:1;min-width:0}
.ass-feito .pi i{display:block;font-style:normal;font-size:11.5px;color:var(--muted)}
@media (max-width:900px){.ass-feito{left:12px;right:12px;width:auto;bottom:calc(84px + env(safe-area-inset-bottom,0px))}}
/* faixa do exemplo */
#exBanner{display:flex;align-items:center;flex-wrap:wrap;gap:4px 8px;padding:7px 12px 7px 14px;border-bottom:1px solid var(--line);background:var(--surface-2);font-size:12.5px;color:var(--ink-2);flex:none}
#exBanner[hidden]{display:none}
#exBanner .d{width:6px;height:6px;border-radius:50%;background:var(--brand);flex:none}
#exBanner .t{flex:none;white-space:nowrap;margin-right:auto}
#exBanner .t b{font-weight:600;color:var(--ink)}
#exBanner .btn.sm{padding:3px 8px;min-height:26px;font-size:12px}
#exBanner .btn.ghost.sm{padding:3px 6px}
#exBanner .btn{flex:none}
`; document.head.appendChild(s) })();

/* ---------- respostas ---------- */
function assResp0(){
  return { nome:"", lote:{modo:"ret", frente:"20", fundo:"40", texto:""},
    regras:{ id:"", outra:false, nome:"", vals:assRegVals(null), ia:false },
    produto:{ padrao:"familia", preco:"", terreno:"" } };
}
/* os 4 números das regras mostrados no passo 2 (toTorre em %) */
function assRegVals(c){
  const R = c? cidadeRegras(c, DEF.regras) : DEF.regras;
  return { caMax:String(R.caMax).replace(".",","), hMax:String(R.hMax).replace(".",","), toTorre:String(+(R.toTorre*100).toFixed(1)).replace(".",","), recFrente:String(R.recFrente).replace(".",",") };
}
function assRespFinal(){
  const r=ASS.r, R=r.regras, v=R.vals, to=assNum(v.toTorre);
  return { nome:r.nome, lote:{...r.lote},
    regras:{ id: R.outra? "" : R.id, nome: R.outra? R.nome : "", caMax:v.caMax, hMax:v.hMax, toTorre: to!=null? to/100 : null, recFrente:v.recFrente, ia:R.ia },
    produto:{...r.produto} };
}
const assArea = ()=>{ const f=assNum(ASS.r.lote.frente), p=assNum(ASS.r.lote.fundo); return f>0&&p>0? f*p : 0 };

/* ---------- passos ---------- */
function assP1(){
  const L=ASS.r.lote, tile=(k,t,d)=>`<button type="button" class="ass-tile" data-modo="${k}" aria-pressed="${L.modo===k}">${assIc(k)}<b>${t}</b><span>${d}</span></button>`;
  const ctx = {
    ret: `<div class="ass-ret"><div class="fld"><label class="fl" for="assF">Frente</label><div class="inp"><input id="assF" data-r="lote.frente" inputmode="decimal" value="${esc(L.frente)}" autocomplete="off"><em>m</em></div></div>
      <div class="fld"><label class="fl" for="assP">Fundo</label><div class="inp"><input id="assP" data-r="lote.fundo" inputmode="decimal" value="${esc(L.fundo)}" autocomplete="off"><em>m</em></div></div>
      <div class="ass-prev" id="assPrev">${assPrevSVG()}</div></div>`,
    mapa: `<p class="ass-note">${assIc("mapa")}<span>O mapa de satélite abre assim que o estudo for criado: é só clicar nos cantos do lote. Latitude, longitude e norte vêm sozinhos.</span></p>`,
    coord: `<div class="fld"><label class="fl" for="assC">Coordenadas do lote</label><textarea id="assC" data-r="lote.texto" placeholder="-28.6775, -49.3697&#10;-28.6775, -49.3693&#10;-28.6779, -49.3693&#10;-28.6779, -49.3697">${esc(L.texto)}</textarea></div><p class="ass-st" id="assCSt">${assCoordSt()}</p>`,
    depois: `<p class="ass-note">${assIc("depois")}<span>Montamos o estudo com um lote provisório. Você desenha o seu na implantação, clicando nos cantos.</span></p>`,
  }[L.modo];
  return { t:"Onde é o terreno?", d:"Dê um nome ao estudo e diga como quer informar o lote. Tudo pode ser ajustado depois.",
    body:`<div class="fld"><label class="fl" for="assN">Nome do estudo</label><div class="inp"><input class="t" id="assN" data-r="nome" value="${esc(ASS.r.nome)}" placeholder="Ex.: Rua das Palmeiras, 300" autocomplete="off"></div></div>
      <div><span class="ass-l" id="assML">Como informar o lote</span><div class="ass-tiles t4" role="group" aria-labelledby="assML">${tile("ret","Frente × fundo","Lote retangular")}${tile("mapa","No mapa","Clique nos cantos")}${tile("coord","Coordenadas","KML, GeoJSON ou lat/lon")}${tile("depois","Desenhar depois","Lote provisório")}</div></div>
      <div class="ass-ctx">${ctx}</div>` };
}
function assPrevSVG(){
  const f=assNum(ASS.r.lote.frente)||0, p=assNum(ASS.r.lote.fundo)||0; if(!(f>0&&p>0)) return `<svg viewBox="0 0 112 74"></svg>`;
  const k=Math.min(96/f, 52/p), w=f*k, h=p*k, x=(112-w)/2, y=4+(52-h)/2;
  return `<svg viewBox="0 0 112 74" role="img" aria-label="Lote de ${nf(f*p,0)} m²"><rect class="lt" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5"/><line class="fr" x1="${x.toFixed(1)}" y1="${(y+h).toFixed(1)}" x2="${(x+w).toFixed(1)}" y2="${(y+h).toFixed(1)}"/><text x="56" y="72" text-anchor="middle">${nf(f*p,0)} m²</text></svg>`;
}
function assCoordSt(){
  const t=ASS.r.lote.texto; if(!String(t||"").trim()) return "Cole um KML do Google Earth, um GeoJSON ou “latitude, longitude” por linha.";
  const lp=assLoteCoords(t, DEF.lote); return lp.erro? `<span class="bad">${esc(lp.erro)}</span>` : `${nf(lp.pts.length)} pontos · ${m2(lp.area)}`;
}
function assP2(){
  const R=ASS.r.regras, lista=cidadesLista(), grupos={};
  lista.forEach(c=>{ (grupos[c.fonteNome]=grupos[c.fonteNome]||[]).push(c) });
  const sel = R.outra? "__outra" : R.id;
  const opts = `<option value="" ${!sel?"selected":""}>Ainda não sei — usar regras padrão</option>` +
    Object.entries(grupos).map(([g,l])=>`<optgroup label="${esc(g)}">${l.map(c=>`<option value="${esc(c.id)}" ${c.id===sel?"selected":""}>${esc(cidadeRotulo(c))}</option>`).join("")}</optgroup>`).join("") +
    `<optgroup label="Outra"><option value="__outra" ${sel==="__outra"?"selected":""}>Outra cidade (digitar os valores)</option></optgroup>`;
  const c = R.id && !R.outra? cidadeAcha(R.id) : null;
  const tag = c? (c.ilustrativo? `<span class="ass-tag"><i></i>Valores de exemplo — confira na lei municipal</span>` : `<span class="ass-tag ok"><i></i>Da sua biblioteca de regras</span>`)
    : R.outra? `<span class="ass-tag ok"><i></i>Digite os valores da lei da sua zona</span>` : `<span class="ass-tag"><i></i>Regras padrão — confira depois em Terreno</span>`;
  const n=(k,l,u)=>`<div class="fld"><label class="fl" for="assR-${k}">${l}</label><div class="inp"><input id="assR-${k}" data-r="regras.vals.${k}" inputmode="decimal" value="${esc(R.vals[k])}" autocomplete="off"><em>${u}</em></div></div>`;
  return { t:"Qual cidade e zona?", d:"As regras da prefeitura definem quanto dá para construir no lote.",
    body:`<div class="fld"><label class="fl" for="assCid">Cidade e zona</label><select class="sel" id="assCid">${opts}</select></div>
      ${R.outra? `<div class="fld"><label class="fl" for="assCN">Nome da cidade e da zona</label><div class="inp"><input class="t" id="assCN" data-r="regras.nome" value="${esc(R.nome)}" placeholder="Ex.: Tubarão, ZR-2" autocomplete="off"></div></div>` : ""}
      <div class="ass-ctx"><div class="ass-g2">${n("caMax","Aproveitamento máximo (CA)","×")}${n("hMax","Altura máxima","m")}${n("toTorre","Ocupação da torre (TO)","%")}${n("recFrente","Recuo frontal","m")}</div>${tag}</div>
      <label class="sw"><input type="checkbox" id="assIA" ${R.ia?"checked":""}><span class="tg"></span><span>Ler a lei com IA depois <span style="color:var(--muted)">· você envia o PDF em Terreno</span></span></label>` };
}
function assP3(){
  const P=ASS.r.produto, sug=assPrecoSugerido(DEF, P.padrao), nomeP=MIX_PRESETS[P.padrao].nome;
  const tile=k=>`<button type="button" class="ass-tile" data-padrao="${k}" aria-pressed="${P.padrao===k}">${assIc(k)}<b>${MIX_PRESETS[k].nome}</b>${assPresetDesc(k).split(" · ").map(x=>`<span>${esc(x.replace("–"," a "))}</span>`).join("")}</button>`;
  return { t:"Que produto e por quanto?", d:"Escolha o padrão e o preço de venda. A gente testa torres, andares, unidades e garagens.",
    body:`<div><span class="ass-l" id="assPL">Padrão das unidades</span><div class="ass-tiles t3" role="group" aria-labelledby="assPL">${tile("compacto")}${tile("familia")}${tile("alto")}</div></div>
      <div class="ass-g2"><div class="fld"><label class="fl" for="assPr">Preço médio de venda</label><div class="inp"><input id="assPr" data-r="produto.preco" inputmode="decimal" value="${esc(P.preco)}" placeholder="${nf(sug,0)}" autocomplete="off"><em>R$/m²</em></div>
          <div class="ass-sug" id="assSug">${assNum(P.preco)? "" : `Sugestão para ${esc(nomeP)} <button type="button" data-sug="${sug}">R$ ${nf(sug,0)}</button>`}</div></div>
        <div class="fld"><label class="fl" for="assT">Preço do terreno <span style="color:var(--muted);font-weight:400">· opcional</span></label><div class="inp"><input id="assT" data-r="produto.terreno" inputmode="decimal" value="${esc(P.terreno)}" placeholder="—" autocomplete="off"><em>R$</em></div>
          <div class="ass-sug">${assNum(P.terreno)? "" : "Sem valor, estimamos 12% do VGV"}</div></div></div>` };
}
function assP4(){
  const fases=["Lote e regras","Torres, andares e unidades","Garagem conferida no desenho","Viabilidade"];
  return { t:"Montando o seu estudo", d:"Testamos as combinações dentro das regras e ficamos com a de maior lucro.",
    body:`<div class="ass-run"><div><div class="ass-bar"><i id="assBar" style="width:${(ASS.prog*100).toFixed(0)}%"></i></div><div class="ass-pc"><span id="assFase">${fases[ASS.fase]||""}</span><span id="assPct">${nf(ASS.prog*100,0)}%</span></div></div>
      <ul class="ass-fases" id="assFases">${fases.map((f,i)=>`<li class="${i<ASS.fase?"done":i===ASS.fase?"on":""}"><span class="d">${assIc("ok")}</span>${f}</li>`).join("")}</ul></div>` };
}
const ASS_FASES = ["Lote e regras","Torres, andares e unidades","Garagem conferida no desenho","Viabilidade"];

function assRender(foco){
  const el=ASS.el; if(!el) return;
  const novo = ASS.ult!==ASS.passo; ASS.ult=ASS.passo;
  const P=[assP1,assP2,assP3,assP4][ASS.passo](), n=ASS.passo, rodando=n===3;
  const prim = ASS.opts.primeira && !rodando;
  el.innerHTML = `<div class="ass-top"><div class="brand" aria-hidden="true"><svg class="rx-ic" viewBox="0 0 32 32"><rect class="t" y="1" width="32" height="30" rx="6"/><path class="g" d="M11.2 8.8L18.6 16.2L11.2 23.6L8.3 20.7L12.8 16.2L8.3 11.7ZM21.2 9.35L23.75 11.9L21.2 14.45L18.65 11.9ZM21.2 17.95L23.75 20.5L21.2 23.05L18.65 20.5Z"/></svg><span class="wm">gabarito<i>.</i></span><span class="ass-tt">Novo estudo</span></div>
      ${rodando? "" : `<button type="button" class="btn ghost sm" data-a="fechar">${prim? "Explorar o exemplo" : "Cancelar"}</button>`}</div>
    <div class="ass-wrap"><div class="ass-box${novo?" in":""}" role="dialog" aria-modal="true" aria-labelledby="assT">
      <div class="ass-prog" aria-hidden="true">${ASS_PASSOS.map((l,i)=>`<div class="ass-seg ${i<n?"done":i===n?"on":""}"><i></i>${l}</div>`).join("")}</div>
      <div class="ass-body"><div class="ass-h"><p class="eb">${rodando? "Quase pronto" : `Passo ${n+1} de 3`}</p><h1 id="assT">${P.t}</h1><p>${P.d}</p></div>${P.body}
        ${ASS.erro? `<p class="ass-st bad" role="alert">${esc(ASS.erro)}</p>` : ""}</div>
      <div class="ass-foot">${rodando? `<span class="sp"></span><button type="button" class="btn ghost" data-a="cancelar">Cancelar</button>`
        : `${n>0? `<button type="button" class="btn ghost" data-a="voltar">← Voltar</button>` : ""}<span class="sp"></span><button type="button" class="btn ghost" data-a="pular">Pular</button><button type="button" class="btn pri" data-a="seguir">${n===2? "Gerar estudo" : "Continuar"}</button>`}</div>
    </div></div>`;
  if(foco!==false) setTimeout(()=>{ const f= foco && el.querySelector(foco) || el.querySelector(".ass-body input:not([type=checkbox]),.ass-body select,.ass-body textarea") || el.querySelector("[data-a=seguir],[data-a=cancelar]"); if(f) try{ f.focus({preventScroll:true}) }catch(e){} }, 20);
}

/* ---------- abrir, navegar, fechar ---------- */
function assAbrir(opts){
  ASS.opts=opts||{}; ASS.passo=0; ASS.ult=-1; ASS.r=assResp0(); ASS.erro=""; ASS.cancel=false; ASS.rodando=false; ASS.prog=0; ASS.fase=0;
  if(typeof progressoFechar==="function") progressoFechar();
  assFeitoFecha();
  if(!ASS.el){
    ASS.el=document.createElement("div"); ASS.el.className="ass"; ASS.el.id="assWiz"; ASS.el.hidden=true; document.body.appendChild(ASS.el);
    ASS.el.addEventListener("click", assClique); ASS.el.addEventListener("input", assDigita); ASS.el.addEventListener("change", assMuda); ASS.el.addEventListener("keydown", assTecla);
  }
  ASS.el.hidden=false; ASS.el.scrollTop=0; document.documentElement.style.overflow="hidden";
  assRender();
}
function assFechar(cancelado){
  if(!ASS.el) return; ASS.el.hidden=true; ASS.el.innerHTML=""; document.documentElement.style.overflow="";
  if(cancelado && typeof ASS.opts.onCancel==="function") try{ ASS.opts.onCancel() }catch(e){ console.error("[assistente] onCancel", e) }
}
function assSet(path, v){ const ks=path.split("."), last=ks.pop(); ks.reduce((o,k)=>o[k], ASS.r)[last]=v }
function assDigita(e){
  const t=e.target, p=t.dataset && t.dataset.r; if(!p) return;
  assSet(p, t.value); ASS.erro="";
  if(p==="lote.frente"||p==="lote.fundo"){ const pv=document.getElementById("assPrev"); if(pv) pv.innerHTML=assPrevSVG() }
  if(p==="lote.texto"){ const s=document.getElementById("assCSt"); if(s) s.innerHTML=assCoordSt() }
  if(p==="produto.preco"){ const s=document.getElementById("assSug"); const sug=assPrecoSugerido(DEF, ASS.r.produto.padrao); if(s) s.innerHTML= assNum(t.value)? "" : `Sugestão para ${esc(MIX_PRESETS[ASS.r.produto.padrao].nome)} <button type="button" data-sug="${sug}">R$ ${nf(sug,0)}</button>` }
  const al=ASS.el.querySelector(".ass-body [role=alert]"); if(al) al.remove();
}
function assMuda(e){
  const t=e.target;
  if(t.id==="assCid"){ const R=ASS.r.regras, v=t.value;
    if(v==="__outra"){ R.outra=true; R.id="" } else { R.outra=false; R.id=v }
    R.vals=assRegVals(R.id? cidadeAcha(R.id) : null); assRender(v==="__outra"? "#assCN" : "#assCid") }
  if(t.id==="assIA") ASS.r.regras.ia=t.checked;
}
function assTecla(e){
  if((e.ctrlKey||e.metaKey) && /^[zy]$/i.test(e.key||"")){ e.stopPropagation(); return }   // o desfazer do app não age por baixo do assistente
  if(e.key==="Escape" && !ASS.rodando){ e.preventDefault(); assFechar(true) }
  if(e.key==="Enter" && !ASS.rodando && e.target.tagName!=="TEXTAREA" && e.target.tagName!=="BUTTON" && e.target.tagName!=="SELECT"){ e.preventDefault(); assSeguir() }
}
function assClique(e){
  const tl=e.target.closest(".ass-tile");
  if(tl){ if(tl.dataset.modo){ ASS.r.lote.modo=tl.dataset.modo; ASS.erro=""; assRender(ASS.r.lote.modo==="coord"? "#assC" : ASS.r.lote.modo==="ret"? "#assF" : false) }
    else if(tl.dataset.padrao){ ASS.r.produto.padrao=tl.dataset.padrao; assRender(false); const b=ASS.el.querySelector(`[data-padrao="${tl.dataset.padrao}"]`); if(b) b.focus() } return }
  const sg=e.target.closest("[data-sug]");
  if(sg){ ASS.r.produto.preco=nf(+sg.dataset.sug,0); const i=document.getElementById("assPr"); if(i){ i.value=ASS.r.produto.preco; i.focus() } sg.parentElement.innerHTML=""; return }
  const b=e.target.closest("[data-a]"); if(!b) return;
  const a=b.dataset.a;
  if(a==="fechar") assFechar(true);
  else if(a==="voltar"){ ASS.erro=""; ASS.passo=Math.max(0,ASS.passo-1); assRender() }
  else if(a==="pular") assPular();
  else if(a==="seguir") assSeguir();
  else if(a==="cancelar") assCancelar();
}
function assValida(){
  const r=ASS.r;
  if(ASS.passo===0){
    if(r.lote.modo==="ret"){ const f=assNum(r.lote.frente), p=assNum(r.lote.fundo); if(!(f>=5 && p>=5)) return "Informe frente e fundo de pelo menos 5 m."; if(f>1000||p>1000) return "Frente e fundo até 1.000 m." }
    if(r.lote.modo==="coord"){ const lp=assLoteCoords(r.lote.texto, DEF.lote); if(lp.erro) return lp.erro }
  }
  if(ASS.passo===1){ const v=r.regras.vals, ca=assNum(v.caMax), h=assNum(v.hMax), to=assNum(v.toTorre), rf=assNum(v.recFrente);
    if(!(ca>0 && ca<=20)) return "Aproveitamento máximo entre 0,1 e 20.";
    if(!(h>=3)) return "Altura máxima de pelo menos 3 m.";
    if(!(to>0 && to<=100)) return "Ocupação da torre entre 1% e 100%.";
    if(rf==null || rf<0) return "Recuo frontal inválido."; }
  if(ASS.passo===2){ const pr=assNum(r.produto.preco); if(r.produto.preco && !(pr>=500)) return "Preço de venda por m² parece baixo demais."; }
  return "";
}
function assSeguir(){
  const er=assValida(); if(er){ ASS.erro=er; assRender(false); return }
  ASS.erro="";
  if(ASS.passo<2){ ASS.passo++; assRender() } else assGerar();
}
function assPular(){
  const r=ASS.r; ASS.erro="";
  if(ASS.passo===0){ r.lote.modo="depois" }
  if(ASS.passo===1){ r.regras.id=""; r.regras.outra=false; r.regras.vals=assRegVals(null) }
  if(ASS.passo===2){ r.produto.preco=""; r.produto.terreno=""; return assGerar() }
  ASS.passo++; assRender();
}

/* ---------- gerar ---------- */
function assProg(p, fase){
  ASS.prog=Math.max(ASS.prog, Math.min(1, p)); if(fase!=null) ASS.fase=fase;
  else ASS.fase = ASS.prog<0.6? 1 : ASS.prog<0.97? 2 : 3;
  const b=document.getElementById("assBar"), pc=document.getElementById("assPct"), fs=document.getElementById("assFases"), fn=document.getElementById("assFase");
  if(b) b.style.width=(ASS.prog*100).toFixed(0)+"%"; if(pc) pc.textContent=nf(ASS.prog*100,0)+"%"; if(fn) fn.textContent=ASS_FASES[ASS.fase]||"";
  if(fs) [...fs.children].forEach((li,i)=>li.className= i<ASS.fase? "done" : i===ASS.fase? "on" : "");
}
/* otimizador com o estado explícito (não toca em S): otimRodar do P3 (se aceitar ctx), Worker "job" ou a página */
async function assOtimizar(st, onProg){
  const opts={ ...clone(st.otim||{}), obj:"lucro", torres:true, tipologias:false, unidades:true, mc:false,
    terrenoPct: st.fin.terreno>0? 0 : ASS_TERRENO_PCT };   // P3: sem preço do terreno, o otimizador já conta o terreno estimado (12% do VGV de cada combinação)
  if(typeof otimRodar==="function" && otimRodar.length>=3) return otimRodar(opts, onProg, {st, m:{}});
  if(typeof calcOn==="function" && calcOn() && typeof calcJob==="function" && !CALC.jobAtivo){
    const a = CALC.jobAtivo = {tipo:"ass", prog:0}; ASS.job=a;
    try{ a.job=calcJob(); return await a.job.call("otimizar", [st, {}, opts], onProg) }
    catch(e){ if(ASS.cancel || (typeof calcCancelado==="function" && calcCancelado(e))) throw e; console.warn("[assistente] otimizador no Worker falhou — rodando na página:", e && e.message) }
    finally{ if(CALC.jobAtivo===a) CALC.jobAtivo=null; ASS.job=null }
  }
  const keep=OTIM; try{ return await otimizar(opts, onProg, null, {st, m:{}}) } finally { OTIM=keep }
}
function assCancelar(){
  ASS.cancel=true; if(typeof otimCancelar==="function") otimCancelar(); if(ASS.job && typeof calcCancelar==="function") calcCancelar();
  ASS.rodando=false; ASS.passo=2; assRender(); toast("Geração cancelada");
}
const assEspera = ms=>new Promise(r=>setTimeout(r, ms));
async function assGerar(){
  ASS.passo=3; ASS.rodando=true; ASS.cancel=false; ASS.prog=0; ASS.fase=0; assRender(false);
  const resp=assRespFinal(), semLote = resp.lote.modo==="mapa" || resp.lote.modo==="depois";
  try{
    await assEspera(250);
    const st=assEstado(clone(DEF), resp); assProg(0.04, 1);
    let r=null, best=null;
    if(!semLote){ r=await assOtimizar(st, p=>{ if(!ASS.cancel) assProg(0.04+0.92*p) }); if(ASS.cancel) return; best=r && r.res && r.res[0] || null }
    assProg(0.97, 3);
    const fin=clone(st); let motivo="", estimado=false;
    if(best){ aplicarOtim(best, fin); if(r.semLucro && typeof otimFechaTxt==="function") motivo=otimFechaTxt(r.semLucro, true) }   // P3: sem lucro → aviso com o que fecharia a conta
    else { const n=maxPav(fin); fin.produto.torres=[{pav:Math.max(1,n)}];
      if(!semLote) motivo = r && r.semOpcao? `Nenhuma combinação fecha: ${r.semOpcao.motivo}. Aplicamos o máximo de andares.` : n>0? "Nenhuma combinação atendeu às regras e às vagas. Aplicamos o máximo de andares." : "O lote é pequeno demais para as regras escolhidas." }
    if(!(fin.fin.terreno>0)){ let vgv=best && best.vgv; if(!vgv){ try{ const m=compute(fin,{layouts:false, quick:true}); vgv=finance(fin,m).vgv }catch(e){ vgv=0 } }
      fin.fin.terreno=assTerrenoEstimado(vgv); estimado=fin.fin.terreno>0 }
    await assEspera(200); if(ASS.cancel) return;
    assProg(1, 4);
    const destino = semLote? "terreno" : best? "viab" : "produto";
    await assAplica(fin, ()=>{
      if(r && best) OTIM=r;
      if(destino==="terreno"){ if(typeof TMETH!=="undefined") TMETH = resp.lote.modo==="mapa"? "mapa" : "desenhar"; progIr("terreno", null, "contorno") }
      else if(destino==="viab") progIr("viab", "res");
      else progIr("produto");
    });
    ASS.rodando=false; assFechar(false);
    if(destino==="terreno" && resp.lote.modo==="mapa" && typeof mapaAbrir==="function") setTimeout(()=>{ try{ mapaAbrir() }catch(e){ console.error(e) } }, 120);
    assFeitoMostra({ resp, best, motivo, estimado, semLote, terreno:fin.fin.terreno });
    toast(motivo? "Estudo criado com aviso — veja o cartão" : "Estudo criado — Ctrl+Z desfaz");
    if(typeof ASS.opts.onDone==="function") try{ ASS.opts.onDone(typeof EST!=="undefined"? EST.id : null) }catch(e){ console.error("[assistente] onDone", e) }
  }catch(e){
    if(ASS.cancel) return;
    console.error("[assistente]", e); ASS.rodando=false; ASS.passo=2; ASS.erro="Não foi possível gerar o estudo. Tente de novo."; assRender(false);
  }
}
/* troca o estado inteiro num só passo de desfazer. Exemplo intocado aberto: vira o estudo; senão, um estudo novo (o aberto fica guardado) */
async function assAplica(fin, nav){
  const reusa = assEhExemplo(S) || typeof estNovo!=="function" || typeof EST==="undefined" || !EST.pronto;
  if(!reusa) await estNovo(clone(DEF), DEF.nome);
  if(typeof histCommit==="function") histCommit();
  S = fin;
  const pn=document.getElementById("projName"); if(pn) pn.value=S.nome;
  lastGar=null; if(typeof RS!=="undefined") RS=null; if(typeof CID_UNDO!=="undefined") CID_UNDO=null;
  nav();
  try{ fit2d(); fit3d() }catch(e){}
  if(typeof calcPronto==="function") calcPronto().then(()=>{ try{ fit3d() }catch(e){} }, ()=>{});   // reenquadra com a altura do prédio novo
  if(typeof histCommit==="function") histCommit();
  assBanner();
}

/* ---------- cartão "O que fizemos" ---------- */
function assFeitoFecha(){ const c=document.getElementById("assFeito"); if(c) c.hidden=true; ASS.feito=null }
function assFeitoMostra(info){
  ASS.feito=info; info.tab=TAB;   // o cartão é da etapa em que o estudo caiu: trocar de etapa o fecha
  let c=document.getElementById("assFeito");
  if(!c){ c=document.createElement("div"); c.id="assFeito"; c.className="ass-feito"; c.setAttribute("role","status"); document.body.appendChild(c);
    c.addEventListener("click", e=>{
      if(e.target.closest("[data-fx]")){ assFeitoFecha(); return }
      const b=e.target.closest("[data-fi]"); if(!b) return;
      const k=b.dataset.fi;
      if(k==="ia"){ assFeitoFecha(); assIA(); return }
      const i=progressoItens(S, (window._last||{}).m, (window._last||{}).f).find(x=>x.k===k); if(i){ if(typeof progIrItem==="function") progIrItem(i); else progIr(i.etapa, i.sub, i.sec); if(k!=="preco"&&k!=="custo") assFeitoFecha() } });
    // desfazer: o cartão perde o sentido
    document.addEventListener("keydown", e=>{ if((e.ctrlKey||e.metaKey) && (e.key||"").toLowerCase()==="z") assFeitoFecha() }, true);
    const u=document.getElementById("undoBtn"); if(u) u.addEventListener("click", ()=>assFeitoFecha());
  }
  c.hidden=false; assFeitoLive();
}
function assFeitoLive(){
  const c=document.getElementById("assFeito"), I=ASS.feito; if(!c || c.hidden || !I) return;
  if(I.tab && TAB!==I.tab){ assFeitoFecha(); return }
  const L=window._last||{}, m=L.m, f=L.f, R=I.resp;
  const lote = R.lote.modo==="ret"? `${nf(assNum(R.lote.frente),1)} × ${nf(assNum(R.lote.fundo),1)} m · ${m2(G.area(S.lote.pts))}` : R.lote.modo==="coord"? `por coordenadas · ${m2(G.area(S.lote.pts))}` : "provisório — desenhe o seu";
  const regras = S.regrasRef && S.regrasRef.id? esc(S.regras.cidade) : R.regras.nome? esc(R.regras.nome) : "padrão — a conferir";
  const prod = m? `${m.T.length} torre${m.T.length>1?"s":""} · ${m.T.map(t=>t.pav).join(" e ")} andares · ${nf(m.units)} unidades · ${S.produto.subsolos} subsolo${S.produto.subsolos===1?"":"s"}` : "…";
  const res = f? `lucro ${mi(f.lucro)} · margem ${pct(f.margemVGV!=null? f.margemVGV : f.margem)}` : "calculando…";
  const pend = m? progressoItens(S, m, f).filter(i=>i.ok===false && !(I.semLote && i.k==="ruas")).slice(0,3) : [];
  const warn = !!I.motivo;
  const h = `<div class="fh"><span class="ic${warn?" warn":""}">${assIc(warn? "x" : "ok")}</span><div><b>${warn? "Estudo criado com aviso" : "Estudo pronto"}</b><span>${warn? esc(I.motivo) : I.semLote? "Desenhe o lote e peça a melhor combinação em Produto." : "Primeira versão montada. Ctrl+Z desfaz tudo."}</span></div><button type="button" class="fx" data-fx aria-label="Fechar">${assIc("x")}</button></div>
    <dl><dt>Lote</dt><dd>${lote}</dd><dt>Regras</dt><dd>${regras}</dd><dt>Produto</dt><dd>${prod}</dd>${I.semLote? "" : `<dt>Resultado</dt><dd id="assFRes">${res}</dd>`}${I.estimado? `<dt>Terreno</dt><dd class="warn">${mi(S.fin.terreno)} estimado (12% do VGV)</dd>` : ""}</dl>
    ${pend.length || R.regras.ia? `<div class="pg">Próximos passos</div>${R.regras.ia? `<div class="pi"><span>Ler a lei com IA<i>envie o PDF do plano diretor</i></span><button type="button" class="btn sm" data-fi="ia">Abrir</button></div>` : ""}${pend.map(i=>`<div class="pi"><span>${esc(i.nome)}<i>${esc(i.dica)}</i></span><button type="button" class="btn sm" data-fi="${i.k}">Resolver</button></div>`).join("")}` : ""}`;
  if(c.innerHTML!==h) c.innerHTML=h;
}
function assIA(){
  progIr("terreno", null, "regras");
  setTimeout(()=>{ const b=document.querySelector('#tabbody .adv[data-adv$=":ia"] .advbtn'); if(b && b.getAttribute("aria-expanded")!=="true") b.click(); const z=document.getElementById("aiZona"); if(z){ if(!z.value) z.value=S.regras.cidade||""; z.scrollIntoView({block:"center"}) } }, 120);
}

/* ---------- faixa do estudo de exemplo ---------- */
function assBanner(){
  const ph=document.getElementById("phead"); if(!ph || !ph.parentNode) return;
  let b=document.getElementById("exBanner");
  const ro=document.documentElement.classList.contains("ap-ro"), on=!ro && assEhExemplo(S);
  if(!b){ if(!on) return;
    b=document.createElement("div"); b.id="exBanner"; b.setAttribute("role","note");
    b.innerHTML=`<span class="d" aria-hidden="true"></span><span class="t" title="Números ilustrativos: comece o seu estudo ou use este como base"><b>Estudo de exemplo</b></span><button type="button" class="btn sm" data-exb="novo">Começar o meu</button><button type="button" class="btn sm ghost" data-exb="base" title="Renomeia o estudo para você seguir a partir dele">Usar como base</button>`;
    b.addEventListener("click", e=>{ const x=e.target.closest("[data-exb]"); if(!x) return;
      if(x.dataset.exb==="novo") assAbrir();
      else { S.nome="Estudo a partir do exemplo"; const pn=document.getElementById("projName"); if(pn){ pn.value=S.nome; pn.focus(); pn.select() } save(); assBanner(); toast("Agora é o seu estudo — dê um nome a ele") } });
  }
  if(b.parentNode!==ph.parentNode || b.nextElementSibling!==ph) ph.parentNode.insertBefore(b, ph);
  b.hidden=!on;
}
(function(){ const pn=document.getElementById("projName"); if(pn) pn.addEventListener("input", ()=>assBanner()) })();
/* a cada resultado na tela: faixa do exemplo e números do cartão (card vazio registrado em todas as etapas, só pelo live) */
["terreno","regras","produto","viab","projeto","clima","cen"].forEach(k=>addCard(k, {key:"assistente", order:997, html:()=>"", live:()=>{ try{ assBanner(); assFeitoLive() }catch(e){ console.error("[assistente]", e) } }}));
ACT.assAbrir = ()=>assAbrir();

/* ---------- primeira visita ---------- */
function assInicio(){
  if(!ASS_PRIMEIRA) return false;
  try{ if(navigator.webdriver) return false }catch(e){}
  if(/^#ver=/.test(location.hash||"") || document.documentElement.classList.contains("ap-ro")) return false;
  LS.set("gabarito.boasvindas", 1);
  let n=0;
  const vai=()=>{ const a=document.getElementById("authTela");
    if(a && a.isConnected && !a.hidden && getComputedStyle(a).display!=="none" && n++<200) return setTimeout(vai, 600);
    if(typeof inicioAbrir==="function") inicioAbrir(); else assAbrir({primeira:true}) };
  setTimeout(vai, 400);
  return true;
}
