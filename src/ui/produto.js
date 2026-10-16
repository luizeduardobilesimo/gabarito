/* ================= etapa Produto: "O que construir" (UX v3 §4.2, ver docs/UX-v3.md) =================
   Uma tela só, sem sub-abas, de cima para baixo:
   RES "Uso do potencial" (#pot: privativo usado/possível, unidades, vagas · #compl: conformidade com as regras, rgConformidade(m) do
   pacote P2 quando existe, senão status()) → botão "Sugerir a melhor combinação" (data-act=otim, #otProg; vira "Cancelar análise"
   por calcJobUI) com as opções em "Mais opções" → [quando há resultado] Sugestões (otimHTML + aviso de prejuízo/meta + "Trocas entre
   critérios", src/ui/pareto.js) → Torres (+ disposição e pés-direitos em Mais opções) → Unidades por andar (+ sacadas e aproveitamento
   do andar) → Garagem e térreo → [fechadas] Forma das torres (src/ui/blocos.js, com "Torre ocupa a área desenhada") · Áreas comuns e
   lazer · Coberturas · Quadro de áreas.
   Listas (torres, mix, lazer) em linhas compactas; a edição detalhada abre dentro da linha (PR.mix / PR.lz / PR.hall).
   Linha aberta, menu de modelos e o "armar" da remoção ficam fora de S: não entram no desfazer.
   O otimizador tem um caminho só: otimRodar (src/ui/calcworker.js), no Worker ou na página. ACT.aprovar = "Guardar como alternativa"
   (salva um cenário; o botão sai do corpo e vai para o menu "…" do topo e para Entrega › Estudos). */
let OTRUN=false;
const PR = { mix:-1, lz:-1, hall:false, apoio:false, menu:false, arm:null, armT:0 };
(function(){ const s=document.createElement("style"); s.textContent=`
.pr-lh{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:0 0 0 12px;font-family:var(--f-display);font-variation-settings:"wdth" 118;font-size:9.5px;font-weight:650;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.pr-lh .c{flex:none;width:120px;text-align:center}
.met .l .pill{margin-left:auto}
.pr-row{border-radius:11px;background:var(--surface-2);border:1px solid transparent;transition:border-color .15s,background .15s,box-shadow .15s}
.pr-row.on{background:var(--surface);border-color:var(--line-2);box-shadow:var(--shadow-s)}
.pr-row.warn{border-color:color-mix(in srgb,var(--warn) 45%,transparent)}
.pr-row.bad{border-color:color-mix(in srgb,var(--bad) 50%,transparent)}
.pr-rh{display:flex;align-items:center;gap:6px;padding:4px 6px 4px 12px;min-height:42px}
.pr-rh .sw8{flex:none;margin-right:2px}
.pr-tx{flex:1;min-width:0;display:grid;gap:1px;align-content:center;min-height:34px}
.pr-tx b{font-weight:550;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pr-tx span{font-size:10.5px;color:var(--muted);font-family:var(--f-mono);line-height:1.35}
.pr-tx span.w{color:var(--warn-t)}.pr-tx span.b{color:var(--bad)}
button.pr-tx{border:0;background:none;padding:0;text-align:left;color:inherit;cursor:pointer;font:inherit}
button.pr-tx:hover b{color:var(--accent)}
.pr-rh .stp{flex:none;width:120px;background:var(--surface);grid-template-columns:30px 1fr 30px}
.pr-row.on .pr-rh .stp{background:var(--surface-2)}
.pr-rs{padding:0 12px 9px;margin-top:-4px;font-size:10.5px;color:var(--muted);font-family:var(--f-mono);line-height:1.4}
.pr-rs.w{color:var(--warn-t)}
.pr-ic{flex:none;display:grid;place-items:center;min-width:32px;height:32px;border:0;border-radius:8px;background:none;color:var(--muted);cursor:pointer;transition:background .15s,color .15s;padding:0}
.pr-ic:hover{background:var(--surface-3);color:var(--ink)}
.pr-ic svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.pr-ic.chev svg{transition:transform .18s}
.pr-row.on .pr-ic.chev svg{transform:rotate(180deg)}
.pr-ic.rm:hover{color:var(--bad)}
.pr-ic.lbl{font-size:11.5px;font-weight:550;padding:0 8px;color:var(--ink-2)}
.pr-ic.rm[data-arm],.btn[data-arm]{color:var(--bad);background:color-mix(in srgb,var(--bad) 10%,transparent);font-size:11.5px;font-weight:550;padding:0 9px}
.btn[data-arm]{padding:4px 9px}
.pr-rb{padding:10px 12px 12px;display:grid;gap:10px;border-top:1px dashed var(--line)}
.pr-rf{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
.pr-menu{border:1px solid var(--line);border-radius:12px;background:var(--surface);box-shadow:var(--shadow);padding:6px;display:grid;gap:1px;max-height:340px;overflow:auto}
.pr-menu[hidden]{display:none}
.pr-menu .grp{margin:8px 8px 2px}
.pr-menu .grp:first-child{margin-top:4px}
.pr-mi{display:flex;justify-content:space-between;gap:10px;align-items:center;border:0;background:none;border-radius:8px;padding:8px 9px;font-size:12.5px;text-align:left;cursor:pointer;color:var(--ink);min-height:36px}
.pr-mi:hover,.pr-mi:focus-visible{background:var(--surface-2);outline:none}
.pr-mi span{font-family:var(--f-mono);font-size:10.5px;color:var(--muted);white-space:nowrap}
.pr-uso{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.pr-uso>div{display:grid;gap:5px;font-size:10.5px;color:var(--muted);min-width:0}
.pr-uso>div>span{display:flex;justify-content:space-between;gap:4px}
.pr-uso b{font-family:var(--f-mono);font-weight:500;color:var(--ink)}
.pr-uso .bar{height:4px}
.pr-more>summary{list-style:none;cursor:pointer;font-size:12px;font-weight:500;color:var(--accent);display:flex;align-items:center;gap:6px;padding:4px 0}
.pr-more>summary::-webkit-details-marker{display:none}
.pr-more>summary::after{content:"";width:6px;height:6px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg) translateY(-2px);transition:transform .18s}
.pr-more[open]>summary::after{transform:rotate(-135deg) translateY(-1px)}
.pr-more>.list{margin-top:8px}
.mets.pr-pot{grid-template-columns:1.25fr 1fr 1fr;gap:6px}
.pr-pot .met{padding:8px 10px}
.pr-pot .met .l{font-size:11px}
.pr-pot .met .v{font-size:17px}
.pr-pot .met .s{font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pr-pot .met .l .pill{margin-left:auto;font-size:10px;padding:0 6px}
#compl{gap:2px;margin-top:8px}
#compl .ur{grid-template-columns:100px 1fr 78px;font-size:11.5px}
.pr-ok{color:var(--ok-t)}.pr-bad{color:var(--bad)}
.pr-sug{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;margin:2px 0 4px}
.pr-sug>.btn{grid-column:1;grid-row:1}
.pr-sug .advbtn{grid-column:2;grid-row:1}
.pr-sug>.prog{grid-row:2}
.pr-sug .advb{grid-row:3}
.pr-sug>.prog,.pr-sug .advb{grid-column:1/-1}
.pr-sug .adv,.pr-act .adv{display:contents}
.pr-act{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.pr-act .advbtn{margin-left:auto}
.pr-act .advb{flex-basis:100%}
.pr-av{border-radius:var(--r);padding:9px 11px;font-size:12px;line-height:1.45;color:var(--ink);background:var(--warn-soft);border:1px solid color-mix(in srgb,var(--warn) 30%,transparent)}
.pr-av.bad{background:var(--bad-soft);border-color:color-mix(in srgb,var(--bad) 30%,transparent)}
.pr-av b{font-weight:600}
.pr-av .k{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:5px;font-family:var(--f-mono);font-size:11px;color:var(--muted)}
.pr-av .k b{color:var(--ink);font-weight:500}
.pr-av .k i{font-style:normal}
.pr-lzm{display:grid;gap:10px}
@media (max-width:520px){ .mets.pr-pot{grid-template-columns:1.2fr 1fr 1fr} .pr-pot .met{padding:8px 9px} .pr-pot .met .v{font-size:16px} }
`; document.head.appendChild(s) })();

const PR_IC = {
  chev:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  x:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>',
};
/* stepper inteiro numa linha compacta (mesmo listener delegado de STP) */
const prStp = (p, v, min, max, rot) => `<div class="stp"><button type="button" data-stp="-1" aria-label="Menos — ${esc(rot)}" title="Menos">−</button><input type="number" data-p="${p}" data-int="1" data-min="${min}" data-max="${max}" data-fx="upd" value="${v}" aria-label="${esc(rot)}"><button type="button" data-stp="1" aria-label="Mais — ${esc(rot)}" title="Mais">+</button></div>`;
const prChev = (k, i, open, nome) => `<button type="button" class="pr-ic chev" data-act="prTog" data-k="${k}" data-i="${i}" aria-expanded="${open}" aria-label="${open?"Fechar":"Editar"} ${esc(nome)}" title="${open?"Fechar":"Editar"}">${PR_IC.chev}</button>`;
/* remoção em dois cliques (padrão "armar"): o 1º vira "Confirmar", o 2º executa ACT[data-do] */
/* o estado armado fica em PR.arm (sobrevive ao redesenho da lista quando o cálculo completo chega) */
const prRm = (fazer, i, nome, txt) => { const on=PR.arm===fazer+":"+i, a=on?' data-arm="1"':"";
  return txt
  ? `<button type="button" class="btn sm ghost" data-act="prArm" data-do="${fazer}" data-i="${i}" data-txt="${esc(txt)}"${a} aria-label="Remover ${esc(nome)}">${on?"Confirmar":txt}</button>`
  : `<button type="button" class="pr-ic rm" data-act="prArm" data-do="${fazer}" data-i="${i}"${a} aria-label="Remover ${esc(nome)}" title="${on?"Clique de novo para remover":"Remover "+esc(nome)}">${on?"Confirmar":PR_IC.x}</button>` };
function prDesarma(){ clearTimeout(PR.armT); const k=PR.arm; PR.arm=null; if(!k) return; const [fazer,i]=k.split(":");
  document.querySelectorAll(`#tabbody [data-act="prArm"][data-do="${fazer}"][data-i="${i}"]`).forEach(b=>{ delete b.dataset.arm; b.title=b.dataset.txt? "" : "Remover"; b.innerHTML=b.dataset.txt? b.dataset.txt : PR_IC.x }) }
const prHallAuto = n => hallSocial({produto:{lazer:{hall:0}}}, n);

/* ---------------- painel ---------------- */
/* opções do "Sugerir": objetivo, o que variar e critérios extras (ficam em Mais opções, embaixo do botão) */
function prOtimOpcoes(){
  const P=S.produto, O=S.otim, chip=(k,l)=>`<button type="button" class="chip" data-act="otk" data-k="${k}" aria-pressed="${!!O[k]}">${l}</button>`;
  const extra=typeof paretoChipsHTML==="function"? paretoChipsHTML() : "";
  const fm=typeof otimFormaAtiva==="function" && otimFormaAtiva(S), nd=fm? (S.blocos.torres||[]).filter(t=>t && (t.blocos||[]).some(blcValido)).length : 0;
  return `<div class="row sb" style="flex-wrap:nowrap"><span class="fl" style="flex:none">Maximizar${INFO("Lucro = receita líquida − custos. Margem = lucro ÷ VGV (a conta do mercado). Retorno = TIR, o rendimento anual do fluxo de caixa. VPL = valor presente do fluxo, descontado pela TMA. Em qualquer objetivo, as combinações com lucro e margem na meta vêm antes.","os objetivos")}</span>${SEG("otim.obj",[["lucro","Lucro"],["margem","Margem"],["tir","Retorno"],["vpl","VPL"]],{fx:"save",rr:false,label:"Objetivo"})}</div>
    ${fm? GRP("Fica fixo")+`<div class="chips" id="otFixo"><span class="pill ok">Forma desenhada</span><span class="pill">${P.torres.length} torre${P.torres.length>1?"s":""}</span>${nd<P.torres.length?`<span class="pill">${P.torres.length-nd} automática${P.torres.length-nd>1?"s":""}</span>`:""}</div>` : ""}
    ${GRP("O que variar")}<div class="chips">${(fm? "" : chip("torres","Nº de torres"))+chip("tipologias","Tipologias")+chip("unidades","Unidades por andar")}${fm? `<span class="pill" title="Pavimentos (o último bloco estica), subsolos e garagens elevadas sempre variam">pavimentos · subsolos · garagens</span>` : ""}</div>
    ${extra? GRP("Comparar também")+`<div class="chips">${extra}</div>` : ""}`;
}
const PR_OT_INFO = "Testa número de torres, tipologias, unidades por andar, pavimentos, subsolos e garagens — sempre dentro das regras. As melhores são conferidas com o layout real da garagem, que sobe ou desce andares e subsolos até fechar as vagas. Combinações com lucro e margem na meta vêm antes; se nenhuma dá lucro, aparece a menos ruim e o que fecharia a conta. “Aplicar” troca torres, unidades, subsolos e garagens do estudo — Ctrl+Z desfaz.";
const PR_OT_INFO_FORMA = "Com a forma desenhada, o número de torres e os blocos ficam como você fez. A sugestão escolhe tipologias e unidades por andar que preenchem o bloco com as unidades no tamanho do mix (até 10% maiores), o total de andares (o último bloco estica, dentro do gabarito e do CA), subsolos e garagens elevadas. As melhores são conferidas com o layout real da garagem. “Aplicar” troca só pavimentos, unidades, subsolos e garagens — Ctrl+Z desfaz.";
STEP_R.produto = ()=>{
  const P=S.produto, fm=typeof otimFormaAtiva==="function" && otimFormaAtiva(S), otInfo=fm? PR_OT_INFO_FORMA : PR_OT_INFO;
  const body =
    RES("Uso do potencial", `<div class="mets pr-pot" id="pot"></div><div class="use" id="compl"></div>`, {aside:`<span id="complTxt"></span>`}) +
    `<div class="pr-sug"><button type="button" class="btn" data-act="otim" ${OTRUN?"disabled":""}>${OTRUN?"Analisando…":"Sugerir a melhor combinação"}</button><div class="prog" id="otProg" ${OTRUN?"":"hidden"}><i style="width:0"></i></div>
      ${ADV(prOtimOpcoes(), {key:"otim", label:"Opções", fechar:"Menos"})}</div>` +
    (OTIM? SEC("Sugestões", `<div class="list" id="otRes">${otimHTML()}</div>${typeof paretoCardHTML==="function"? paretoCardHTML() : ""}`, {key:"pr-otres", open:true, sum:prOtSum(), info:otInfo}) : "") +
    SEC("Torres", `<div class="list" id="torres"></div>
      <div class="pr-act"><button type="button" class="btn sm" data-act="addTorre" ${P.torres.length>=4?"disabled":""}>+ Torre</button><button type="button" class="btn sm ghost" data-act="maxPav" title="Sobe todas as torres até o limite de altura ou de CA">Máximo em todas</button>
      ${ADV((P.torres.length>1? ROW("Disposição", SEG("produto.torreEixo",[["long","ao longo do lote"],["trans","transversais"]],{label:"Disposição das torres"})) : "") +
        GRP("Pés-direitos") + KV(NUM("produto.peTerreo","Térreo","m",{step:0.1,help:"Pé-direito"})+NUM("produto.peGar","Garagem","m",{step:0.05})+NUM("produto.pe","Andar tipo","m",{step:0.05}),3), {key:"torres"})}</div>`,
      {key:"pr-torres", open:true, info:"Pavimentos tipo de cada torre. “Máx” sobe a torre até o limite de altura ou de CA. Até 4 torres; com 2 ou mais, escolha a disposição no lote. Pés-direitos em Mais opções."}) +
    SEC("Unidades por andar", `<div class="pr-lh"><span>Tipologia</span><span class="c" style="margin-right:44px">Por andar</span></div><div class="list" id="mix"></div>
      <div class="pr-act"><button type="button" class="btn sm" data-act="addMix" ${P.mix.length>=5?"disabled":""}>+ Tipologia</button>
      ${ADV(ROW(`Sacadas${INFO("Sacada")}`, SEG("produto.sacTipo",[["embutida","embutidas"],["balanco","em balanço"]],{rr:false,label:"Sacadas"})) +
        KV(NUM("produto.efic","Aproveitamento do andar","%",{pct:true,step:1,help:"Aproveitamento do andar"})), {key:"mix"})}</div>`,
      {key:"pr-mix", open:true, info:"Unidades de cada andar tipo, iguais em todas as torres. O tamanho do andar sai da área privativa das unidades ÷ aproveitamento do andar (na forma desenhada, o andar é o desenho e vale o aproveitamento real da planta). Toque numa tipologia para editar nome, área, preço e sacada."}) +
    SEC("Garagem e térreo", KV(STP("produto.subsolos",0,6,"Subsolos",{sub:""})+STP("produto.garAcima",0,8,"Garagens elevadas",{sub:""}))+
      SW("produto.garTerOn","Garagem no térreo, atrás do hall e do lazer")+`<div class="pr-act"><div class="fsub" id="sub-terreo" style="flex:1;min-width:0"></div>`+
      ADV(SLD("produto.lojaTerreo","Lojas na frente do térreo",0,0.8,0.05,"%",{pct:true,sub:""})+SW("produto.vagasFrente","Vagas externas na frente (clientes das lojas)")+SW("produto.atico","Ático técnico (reservatório, máquinas)"), {key:"emb"})+`</div>`,
      {key:"pr-emb", open:true, sum:prEmbSum(), info:"Embasamento"}) +
    (typeof blcSecHTML==="function"? blcSecHTML() : "") +   // forma das torres (src/ui/blocos.js), com "Torre ocupa a área desenhada"
    SEC("Áreas comuns e lazer", `<div class="pr-lzm"><div class="mets" id="lzMets"></div><div class="use" id="lzCap"></div></div><div class="list" id="lzList"></div>
      <div class="row sb"><button type="button" class="btn sm" data-act="prMenu" id="lzAddBtn" aria-expanded="${PR.menu}" aria-controls="lzMenu">+ Ambiente</button><span class="note" id="lzSum2"></span></div>
      <div class="pr-menu" id="lzMenu" role="menu" aria-label="Modelos de ambiente" ${PR.menu?"":"hidden"}></div>`,
      {key:"pr-lz", info:"Diga o que o empreendimento terá e onde. O hall e o lazer do térreo empurram a garagem para os fundos; a laje do embasamento, o pavimento de lazer e o rooftop entram no 3D, nas plantas e nos custos. Toque num ambiente para editar."}) +
    SEC("Coberturas", SW("produto.cob.on","Unidades de cobertura no último andar",{rr:true})+(P.cob.on? KV(NUM("produto.cob.qtd","Por torre","un",{int:true,min:1,step:1})+NUM("produto.cob.area","Área privativa","m²",{step:1,help:"Duplex"})+NUM("produto.cob.preco","Preço","R$/m²",{step:50,wide:true})) : ""),
      {key:"pr-cob", sum:P.cob.on? "ligadas" : "desligadas", info:"Unidades maiores no último andar de cada torre. Maior que o andar, vira duplex com pavimento superior."}) +
    SEC("Quadro de áreas", `<table class="tbl" id="quadro"></table>`, {key:"pr-quadro"});
  return { desc:"Torres, unidades, garagem e lazer — dentro das regras.", body };
};
function prEmbSum(){ const P=S.produto; return `${P.subsolos} subsolo${P.subsolos!==1?"s":""}${P.garAcima?` + ${P.garAcima} elevada${P.garAcima>1?"s":""}`:""} · lojas ${pct(P.lojaTerreo,0)}${P.garTerOn?" · garagem no térreo":""}` }

/* resumo da seção Sugestões e aviso de prejuízo / margem abaixo da meta / nenhuma opção (contrato em src/optim.js: OTIM.semLucro, .fecha, .semOpcao) */
function prOtSum(){ const O=OTIM; if(!O) return ""; const r=O.res[0];
  return !r? `<span class="pr-bad">nenhuma opção</span>` : r.semLucro? `<span class="pr-bad">sem lucro</span> · ${mi(r.lucro)}` : `${mi(r.lucro)} · margem ${pct(r.margem,0)}` }
function prOtAviso(O){
  if(!O) return "";
  if(O.semOpcao) return `<div class="pr-av bad" role="status"><b>Nenhuma combinação fecha as regras com as vagas exigidas</b> — ${esc(O.semOpcao.motivo)}.</div>`;
  const fx=O.semLucro || O.fecha; if(!fx || !O.res.length) return "";
  const pr=v=>`R$ ${nf(Math.ceil(v/50)*50,0)}/m²`, temT=fx.terrenoAtual>0 || fx.terrenoPct>0, qual=q=>q? ` <i>(opção ${q+1})</i>` : "";
  const k=[`<span>Preço médio hoje <b>${pr(fx.precoAtual)}</b></span>`,
    O.semLucro && fx.precoZero? `<span>Margem 0 <b>${pr(fx.precoZero)}</b>${qual(fx.opcaoZero)}</span>` : "",
    fx.precoMeta? `<span>Meta de ${pct(fx.meta,0)} <b>${pr(fx.precoMeta)}</b>${qual(fx.opcaoMeta)}</span>` : "",
    O.semLucro && temT && fx.terrenoZero>0? `<span>Terreno até <b>${mi(fx.terrenoZero)}</b></span>` : "",
    !O.semLucro && temT && fx.terrenoMeta>0? `<span>Terreno p/ meta <b>${mi(fx.terrenoMeta)}</b></span>` : ""].filter(Boolean).join("");
  return O.semLucro ? `<div class="pr-av bad" role="status"><b>Nenhuma combinação dá lucro</b> — ${esc(fx.motivo)}. A primeira é a menos ruim; fecha a conta com:<div class="k">${k}</div></div>`
    : `<div class="pr-av" role="status"><b>Margem abaixo da meta de ${pct(fx.meta,0)}</b> na melhor opção. Chega à meta com:<div class="k">${k}</div></div>`;
}
function otimHTML(){
  const O=OTIM; if(!O.res.length) return prOtAviso(O) || `<p class="note">${O.forma? "Nenhuma combinação preenche a forma desenhada dentro das regras e das vagas. Ajuste a forma ou o mix." : "Nenhuma combinação atende às regras e às vagas exigidas."}</p>`;
  const cur=window._last.f, ob=OBJ[O.obj][2];
  const card=(r,k)=>`<div class="res ${k===0?"top1":""}"><div class="rh"><b>${k===0? (r.semLucro? "Menos ruim" : "Melhor opção") : "Opção "+(k+1)} · ${MIX_PRESETS[r.pk].nome}</b><button type="button" class="btn sm" data-act="otApply" data-i="${k}">Aplicar</button></div>
    <div class="note">${r.nT} torre${r.nT>1?"s":""} × ${r.pav} pav · ${r.N} un/andar · ${r.units} un · ${r.sub} subsolo${r.sub!==1?"s":""}${r.gac?` + ${r.gac} elevada${r.gac>1?"s":""}`:""} · ${r.vagas}/${r.req} vagas${r.forma?` · ${r.dev>0.005?"unidades "+pct(r.dev,0)+" maiores que o mix":"preenche a forma"}`:""}</div>
    <div class="rm"><span>Lucro<b${r.lucro<0?' class="pr-bad"':""}>${mi(r.lucro)}</b></span><span>Margem<b>${pct(r.margem)}</b></span><span>Retorno<b>${r.tir==null?"—":pct(r.tir)}</b></span><span>VGV<b>${mi(r.vgv)}</b></span></div></div>`;
  const L=O.res.slice(0,4);
  return prOtAviso(O) + card(L[0],0) + (L.length>1? `<details class="pr-more"><summary>Outras opções · ${L.length-1}</summary><div class="list">${L.slice(1).map((r,k)=>card(r,k+1)).join("")}</div></details>` : "")
    + `<p class="note">${nf(O.testadas)} combinações em ${nf(O.ms/1000,1)} s · por ${ob}${O.forma?" · forma desenhada fixa":""}${O.terrenoPct? ` · terreno a ${pct(O.terrenoPct,0)} do VGV`:""} · hoje: lucro ${mi(cur.lucro)}, margem ${pct(cur.margemVGV)}</p>`;
}

/* ---------------- partes vivas ---------------- */
function prTorresLive(m){
  const P=S.produto, n=P.torres.length;
  setHTML("torres", P.torres.map((tw,i)=>{ const t=m.T[i]||{}, nome=`Torre ${i+1}`;
    return `<div class="pr-row${t.fit===false?" warn":""}"><div class="pr-rh"><div class="pr-tx"><b>${nome}</b><span>pavimentos tipo</span></div>
      ${prStp(`produto.torres.${i}.pav`, tw.pav, 1, 80, `Pavimentos da ${nome.toLowerCase()}`)}
      <button type="button" class="pr-ic lbl" data-act="maxT" data-i="${i}" title="Máximo de pavimentos para esta torre" aria-label="Máximo de pavimentos para a ${nome.toLowerCase()}">Máx</button>${n>1? prRm("rmT", i, nome) : ""}</div>
      <div class="pr-rs${t.fit===false?" w":""}">${t.fit===false && !t.desenhada? `o mix pede ${m2(m.mixPriv/P.efic)}/andar e cabem ${m2(t.maxA||0)} · unidades a ${pct(t.r||0,0)}` : m.torOcupa||t.desenhada? `${nf(t.H||0,1)} m · ${t.units||0} un · ${m2(t.A||0)}/andar ${t.desenhada?"na forma desenhada":"no contorno desenhado"}${t.eficReal!=null? ` · eficiência real ${pct(t.eficReal,0)} (informada ${pct(P.efic,0)})` : ""} · unidades a ${pct(t.r||0,0)} do mix` : `${nf(t.H||0,1)} m · ${t.units||0} un · ${m2(t.A||0)}/andar de ${m2(t.maxA||0)}`}</div></div>` }).join(""));
  setSum("pr-torres", `${n} torre${n>1?"s":""} · ${P.torres.map(t=>t.pav).join(" e ")} pav`);
}
function prMixLive(m){
  const P=S.produto;
  setHTML("mix", P.mix.map((u,i)=>{ const open=PR.mix===i, ur=m.unitRows[i]||{}, nome=u.nome||"Tipologia "+(i+1);
    return `<div class="pr-row${open?" on":""}" data-row="mix:${i}"><div class="pr-rh"><span class="sw8" style="background:var(--u${i%5+1})"></span>
      <button type="button" class="pr-tx" data-act="prTog" data-k="mix" data-i="${i}" aria-expanded="${open}"><b>${esc(nome)}</b><span>${nf(u.area,0)} m² · ${brl(u.preco)}/m²</span></button>
      ${prStp(`produto.mix.${i}.qtd`, u.qtd, 0, 20, `Unidades por andar — ${nome}`)}${prChev("mix", i, open, nome)}</div>
      ${open? `<div class="pr-rb">${KV(TXT(`produto.mix.${i}.nome`,"Nome",{fx:"upd"})+NUM(`produto.mix.${i}.area`,"Área privativa","m²",{step:1,min:10,help:"Área privativa"})+NUM(`produto.mix.${i}.preco`,"Preço","R$/m²",{step:50,min:0})+NUM(`produto.mix.${i}.sac`,"Sacada","m²",{step:0.5,min:0,help:"Sacada"}))}
        <div class="pr-rf"><span class="fsub">${ur.n||0} unidades · ${mi((ur.area||0)*u.preco)}</span>${P.mix.length>1? prRm("rmMix", i, nome, "Remover tipologia") : ""}</div></div>` : `<div class="pr-rs">${ur.n||0} unidades no total · ${mi((ur.area||0)*u.preco)}</div>`}</div>` }).join(""));
  setSum("pr-mix", `${m.mixUn} un · ${m2(m.mixPriv)} → ${m2(m.mixPriv/P.efic)}/andar`);
}
function prLazerLive(m){
  const P=S.produto, LZ=m.lzLay||{miss:[]}, miss=new Set(LZ.miss), missIx=new Set(LZ.missIx||[]), it=(P.lazer&&P.lazer.itens)||[], lz=m.lz, nT=P.torres.length;
  const hAuto=!(+P.lazer.hall>0), hall=hallSocial(S,m.T.length);
  const hallRow = `<div class="pr-row${PR.hall?" on":""}" data-row="hall:0"><div class="pr-rh"><button type="button" class="pr-tx" data-act="prTog" data-k="hall" data-i="0" aria-expanded="${PR.hall}"><b>Hall social</b><span>${m2(hall)} · ${hAuto?"automático":"definido"} · Térreo</span></button>${prChev("hall",0,PR.hall,"Hall social")}</div>
    ${PR.hall? `<div class="pr-rb">${KV(NUM("produto.lazer.hall","Área do hall","m²",{step:5,min:0,ph:String(prHallAuto(nT)),zero:true,sub:"vazio = automático",help:"Hall de entrada do térreo. Vazio: 40 m² + 20 m² por torre."}))}</div>` : ""}</div>`;
  // apoio do condomínio (portaria, clausura, sanitários, funcionários, DML, bicicletário, lixo, gás, medidores): automático, src/ui/comuns.js
  const apoioRow = typeof cmnApoioRow==="function"? cmnApoioRow(m, PR.apoio) : "";
  setHTML("lzList", hallRow + apoioRow + it.map((x,i)=>{ const open=PR.lz===i, falta=miss.has(x)||missIx.has(i), nome=x.nome||"Ambiente";
    return `<div class="pr-row${open?" on":""}${falta?" bad":""}" data-row="lz:${i}"><div class="pr-rh"><button type="button" class="pr-tx" data-act="prTog" data-k="lz" data-i="${i}" aria-expanded="${open}"><b>${esc(nome)}</b><span>${m2(+x.area||0)} · ${LZ_LOCAIS[x.local]||LZ_LOCAIS.terreo}${x.desc?" · descoberto":""}</span>${falta?`<span class="b">não coube — reduza a área ou mude o local</span>`:""}</button>${prChev("lz",i,open,nome)}</div>
      ${open? `<div class="pr-rb">${KV(TXT(`produto.lazer.itens.${i}.nome`,"Nome",{fx:"upd"})+NUM(`produto.lazer.itens.${i}.area`,"Área","m²",{step:5,min:1})+
        `<div class="fld wide"><label class="fl" for="lzl-${i}">Onde fica</label><select class="sel" id="lzl-${i}" data-p="produto.lazer.itens.${i}.local" data-t="s">${Object.entries(LZ_LOCAIS).map(([k,l])=>`<option value="${k}" ${x.local===k?"selected":""}>${l}</option>`).join("")}</select></div>`)}
        ${SW(`produto.lazer.itens.${i}.desc`,"Descoberto (piscina, deck, playground)")}
        <div class="pr-rf"><span></span>${prRm("lzRm", i, nome, "Remover ambiente")}</div></div>` : ""}</div>` }).join(""));
  // menu de modelos (os que ainda não estão no programa)
  const used=new Set(it.map(x=>x.nome));
  setHTML("lzMenu", Object.entries(LZ_LOCAIS).map(([k,l])=>{ const ps=LZ_PRESETS.map((p,i)=>[p,i]).filter(([p])=>p.local===k && !used.has(p.nome)); return ps.length? GRP(l)+ps.map(([p,i])=>`<button type="button" class="pr-mi" role="menuitem" data-act="lzAdd" data-i="${i}">${p.nome}<span>${m2(p.area)}${p.desc?" · descoberto":""}</span></button>`).join("") : "" }).join("")
    + GRP("Outro") + `<button type="button" class="pr-mi" role="menuitem" data-act="lzAdd" data-i="-1">Ambiente em branco<span>30 m² · Térreo</span></button>`);
  const apoioA=m.comuns? m.comuns.prog.filter(a=>a.ix==null && a.k!=="hall").reduce((s,a)=>s+a.A,0) : 0, tot=hall+lz.c+lz.d+apoioA;
  setHTML("lzMets", `<div class="met"><div class="l">Total do programa</div><div class="v">${m2(tot)}</div><div class="s">com hall de ${m2(hall)}${apoioA? ` e apoio de ${m2(apoioA)}` : ""}</div></div>
    <div class="met"><div class="l">Equipamentos</div><div class="v">≈ ${mi(m.lzCusto)}</div><div class="s">acabamento e mobiliário</div></div>`);
  const T=m.ter||{}, roofFree=Math.max(1,m.embA-m.T.reduce((s,t)=>s+t.A,0)), plate=m.T[0]?m.T[0].A:1;
  const cap=[["Térreo", T.HT||0, P.garTerOn? (T.HT||0)+m.gTer : T.hallDisp||1], ["Laje do emb.", lz.emb.c+lz.emb.d, roofFree], ["Pav. de lazer", lz.pav.c+lz.pav.d, plate*0.8], ["Rooftop", lz.cob.c+lz.cob.d, plate*0.85]].filter(r=>r[1]>0);
  setHTML("lzCap", cap.map(([l,a,c])=>useRow(l, a/Math.max(1,c), `${m2(a)}`, a>c?"bad":"ok")).join("") + (m.lzExtraA>0? `<p class="note">Fora do térreo: ${m2(m.lzExtraA)} construídos${S.regras.ncTerreo?" (não computáveis)":""}</p>` : ""));
  const s2=document.getElementById("lzSum2"); if(s2) s2.textContent=`${it.length} ambiente${it.length!==1?"s":""} · ${m2(lz.c+lz.d)}`;
  const nMiss=Math.max(miss.size, missIx.size);
  setSum("pr-lz", `${it.length} ambiente${it.length!==1?"s":""} · ${m2(tot)}${nMiss? ` · <span class="pr-bad">${nMiss} não coube${nMiss>1?"ram":""}</span>` : ""}`);
}
/* conformidade com as regras: rgConformidade(m) (pacote P2, src/ui/etapa-terreno.js) quando existe — linhas [rótulo, fração, texto, estado]
   ou objetos {l|nome|rot, v|frac, txt|t, st|estado}; senão as mesmas linhas a partir de status() */
function prConfLinhas(m){
  if(typeof rgConformidade==="function"){ try{ const r=rgConformidade(m), L=Array.isArray(r)? r : r && (r.rows||r.linhas);
    if(Array.isArray(L) && L.length) return L.map(x=>Array.isArray(x)? x : [x.l??x.nome??x.rot??"", +(x.v??x.frac??0), x.txt??x.t??"", x.st??x.estado??"ok"]) }catch(e){ console.error("[produto] rgConformidade", e) } }
  const R=S.regras, s=status(m,S), tor=m.T.reduce((a,t)=>a+(t.Aproj||t.A),0), hL=m.hLim ?? R.hMax;
  return [
    ["Aproveitamento", m.CA/Math.max(1e-9,R.caMax), `${nf(m.CA,2)} / ${nf(R.caMax,2)}`, s.ca],
    ["Altura", m.H/Math.max(1e-9,hL), `${nf(m.H,1)} / ${nf(hL,0)} m`, s.h],
    ["Ocupação torres", tor/Math.max(1,R.toTorre*m.A), `${pct(tor/Math.max(1,m.A),0)} / ${pct(R.toTorre,0)}`, tor>R.toTorre*m.A+1?"bad":"ok"],
    ["Ocupação emb.", m.TO/Math.max(1e-9,R.toEmb), `${pct(m.TO,0)} / ${pct(R.toEmb,0)}`, m.TO>R.toEmb+1e-6?"bad":"ok"],
    ["Permeável", Math.min(1,m.perm/Math.max(1e-9,R.permeab||1e-9)), `${pct(m.perm,0)} / ${pct(R.permeab,0)}`, s.perm],
    ["Vagas", m.vagas/Math.max(1,m.vagasReq), `${m.vagas} / ${m.vagasReq}`, s.vg],
    ["Menor unidade", Math.min(1,m.minApto/Math.max(1,R.aptoMin)), `${nf(m.minApto,0)} / ${nf(R.aptoMin,0)} m²`, s.apto],
    ...(typeof formaRows==="function"? formaRows(m) : [])];
}
STEP_LIVE.produto = (m,f)=>{
  const P=S.produto, R=S.regras;
  // uso do potencial: privativo usado / possível, unidades, vagas
  const po=potencial(S,m), vOk=m.vagas>=m.vagasReq;
  setHTML("pot", `<div class="met"><div class="l">Privativo${potInfoHTML(po)}<span class="pill ${po.uso.priv>1?"bad":"ok"}" title="Parte do potencial do terreno que o estudo usa (limite: ${po.limita==="ca"? "aproveitamento" : "altura"})">${pct(po.uso.priv,0)}</span></div><div class="v">${m2(m.priv)}</div><div class="s">de ${m2(po.priv)}</div></div>
    <div class="met"><div class="l">Unidades</div><div class="v">${nf(m.units)}</div><div class="s">≈ ${nf(po.un)} possíveis</div></div>
    <div class="met"><div class="l">Vagas</div><div class="v${vOk?"":" pr-bad"}">${m.vagas}<span style="font-size:13px;color:var(--muted);font-weight:500"> / ${m.vagasReq}</span></div><div class="s">exigidas</div></div>`);
  const rows=prConfLinhas(m), fora=rows.filter(r=>r[3]==="bad").length;
  setHTML("compl", rows.map(r=>useRow(r[0],r[1],r[2],r[3]==="ok"?"ok":r[3])).join(""));
  const ct=document.getElementById("complTxt"); if(ct) ct.innerHTML = fora? `<span class="pr-bad">${fora} fora das regras</span>` : `<span class="pr-ok">dentro das regras</span>`;
  prTorresLive(m); prMixLive(m); prLazerLive(m); if(typeof blcLive==="function") blcLive(m);
  if(OTIM && typeof paretoLive==="function") paretoLive();
  setSub("produto.subsolos",`${m2(m.subA)} · ${m.gar&&m.gar.s1? m.gar.s1.count+" vg no 1º" : Math.floor(m.subA/R.m2Vaga)+" vg (est.)"}`);
  setSub("produto.garAcima",`${m2(m.embA)} · ${m.gar&&m.gar.g1? m.gar.g1.count+" vg no 1º" : Math.floor(m.embA/R.m2Vaga)+" vg (est.)"}`);
  setSub("terreo", `${P.garTerOn? `garagem ${m2(m.gTer)} · ${m.gar&&m.gar.ter? m.gar.ter.count : Math.floor(m.gTer/R.m2Vaga)} vagas · `:""}hall e lazer ${m2(m.hallA)} · acesso de veículos ${m2(m.driveA||0)}`);
  setSub("produto.lojaTerreo",`${m2(m.lojaA)} brutos · ${m2(m.lojaPriv)} privativos`);
  setSum("pr-emb", prEmbSum());
  setSum("pr-cob", P.cob.on? `${m.cobN} un${m.duplex?" · duplex":""} · ${brl(P.cob.preco)}/m²` : "desligadas");
  setSum("pr-quadro", `construída ${m2(m.constr)} · privativa ${m2(m.priv)}`);
  setHTML("quadro", `<tr><td>Subsolos (${P.subsolos}×)</td><td>${m2(m.gSub)}</td></tr><tr><td>Térreo</td><td>${m2(m.embA)}</td></tr><tr><td>Garagem elevada (${P.garAcima}×)</td><td>${m2(m.gAc)}</td></tr><tr><td>Pavimentos das torres</td><td>${m2(m.tiposA)}</td></tr>
    ${m.duplexA?`<tr><td>Duplex (superior)</td><td>${m2(m.duplexA)}</td></tr>`:""}${P.atico?`<tr><td>Ático técnico</td><td>${m2(m.aticoA)}</td></tr>`:""}
    <tr class="tot"><td>Área construída</td><td>${m2(m.constr)}</td></tr><tr><td>Área computável</td><td>${m2(m.comp)}</td></tr>
    ${m.unitRows.map(u=>`<tr><td>${esc(u.nome)} — ${u.n} × ${nf(u.n?u.area/u.n:0,1)} m²</td><td>${m2(u.area)}</td></tr>`).join("")}
    ${m.cobN?`<tr><td>Coberturas — ${m.cobN} × ${nf(m.cobArea/m.cobN,1)} m²</td><td>${m2(m.cobArea)}</td></tr>`:""}${m.lojaPriv?`<tr><td>Lojas (privativo)</td><td>${m2(m.lojaPriv)}</td></tr>`:""}
    <tr class="tot"><td>Privativa vendável</td><td>${m2(m.priv)}</td></tr><tr><td>Privativa ÷ construída</td><td>${pct(m.priv/Math.max(1,m.constr))}</td></tr>`);
};
/* redesenha só a lista mexida (abrir/fechar linha) e devolve o foco ao botão da linha */
function prRelista(k, i){
  const L=window._last; if(!L) return;
  if(k==="mix") prMixLive(L.m); else prLazerLive(L.m);
  const b=TB.querySelector(`.pr-ic.chev[data-k="${k}"][data-i="${i}"]`) || TB.querySelector(`[data-act="prTog"][data-k="${k}"][data-i="${i}"]`);
  if(b){ b.focus({preventScroll:true}); const row=b.closest(".pr-row"); if(row && row.classList.contains("on")) row.scrollIntoView({block:"nearest", behavior:"smooth"}) }
}
function prMenuSet(on){
  PR.menu=on; const mn=document.getElementById("lzMenu"), bt=document.getElementById("lzAddBtn");
  if(mn) mn.hidden=!on; if(bt) bt.setAttribute("aria-expanded", on);
  if(on && mn){ mn.scrollIntoView({block:"nearest", behavior:"smooth"}); const f=mn.querySelector(".pr-mi"); if(f) f.focus({preventScroll:true}) }
}
document.addEventListener("click", e=>{ if(PR.menu && !e.target.closest("#lzMenu, #lzAddBtn")) prMenuSet(false) }, true);
document.addEventListener("keydown", e=>{ if(e.key==="Escape" && PR.menu){ prMenuSet(false); const b=document.getElementById("lzAddBtn"); if(b) b.focus() } });

/* ---------------- ações ---------------- */
Object.assign(ACT,{
  prTog: b=>{ const k=b.dataset.k, i=+b.dataset.i;
    if(k==="hall"||k==="apoio") PR[k]=!PR[k]; else PR[k] = PR[k]===i? -1 : i;
    prRelista(k, i) },
  prArm: b=>{ const k=b.dataset.do+":"+b.dataset.i;
    if(PR.arm===k){ clearTimeout(PR.armT); PR.arm=null; const f=ACT[b.dataset.do]; if(f) f(b); return }
    prDesarma(); PR.arm=k; b.dataset.arm="1"; b.textContent="Confirmar"; b.title="Clique de novo para remover";
    PR.armT=setTimeout(prDesarma, 4000) },
  prMenu: ()=>prMenuSet(!PR.menu),
  lzAdd: b=>{ const i=+b.dataset.i, p=LZ_PRESETS[i]||{nome:"Ambiente",area:30,local:"terreo"}; S.produto.lazer.itens.push({...p}); PR.lz=S.produto.lazer.itens.length-1; PR.menu=false; prMenuSet(false); update();
    toast(`${p.nome} adicionado — ${LZ_LOCAIS[p.local]||"Térreo"}`); requestAnimationFrame(()=>prRelista("lz", PR.lz)) },
  lzRm: b=>{ const i=+b.dataset.i, x=S.produto.lazer.itens[i]; if(!x) return; S.produto.lazer.itens.splice(i,1); PR.lz=-1; update(); toast(`${x.nome||"Ambiente"} removido — Ctrl+Z desfaz`) },
  lzDesc: b=>{ const x=S.produto.lazer.itens[+b.dataset.i]; if(!x) return; x.desc=!x.desc; update() },
  otk: b=>{ const k=b.dataset.k; S.otim[k]=!S.otim[k]; b.setAttribute("aria-pressed",S.otim[k]); save() },
  // "Sugerir a melhor combinação": um caminho só (otimRodar: Worker ou página); "Cancelar análise" = calcCancel (calcJobUI troca o botão)
  otim: async ()=>{
    if(OTRUN || (typeof CALC!=="undefined" && CALC.jobAtivo)) return;
    // otimRodar marca CALC.jobAtivo antes do primeiro await: o renderTab já desenha "Cancelar análise" (calcJobUI)
    const job=otimRodar(clone(S.otim), p=>{ const e=document.querySelector("#otProg i"); if(e) e.style.width=(p*100).toFixed(0)+"%" });
    OTRUN=true; renderTab();
    try{
      const r=await job;
      OTRUN=false; if(TAB==="produto") renderTab();
      toast(!r.res.length? "Nenhuma combinação viável — veja o motivo em Sugestões" : r.semLucro? "Nenhuma combinação dá lucro — veja o que fecharia a conta" : "Sugestões prontas — a melhor está no topo");
    }catch(e){ OTRUN=false; if(TAB==="produto") renderTab();
      if(!/cancelado|ocupado/.test(e && e.message||"")){ console.error("[produto] otimizador", e); toast("Não foi possível sugerir agora. Tente de novo.") } } },
  otApply: b=>{ const r=OTIM&&OTIM.res[+b.dataset.i]; if(!r) return; aplicarOtim(r); PR.mix=-1; renderTab(); fit3dDepois(); toast("Opção aplicada — Ctrl+Z desfaz") },
  addTorre: ()=>{ const T=S.produto.torres; if(T.length<4){ T.push({pav:T.at(-1)?.pav||8}); if(typeof blcTorreNova==="function") blcTorreNova(T.length-1); renderTab(); toast(`Torre ${T.length} adicionada`) } },
  rmT: b=>{ const T=S.produto.torres, i=+b.dataset.i; if(T.length<2 || !T[i]) return; T.splice(i,1); if(typeof blcTorreRemovida==="function") blcTorreRemovida(i); renderTab(); toast(`Torre ${i+1} removida — Ctrl+Z desfaz`) },
  maxPav: ()=>{ const t=maxPav(S); if(t>0){ S.produto.torres.forEach(x=>x.pav=t); update(); toast(`${t} pavimentos por torre (gabarito/CA)`) } else toast("Nenhum pavimento cabe com essas regras") },
  maxT: b=>{ const i=+b.dataset.i, T=S.produto.torres, keep=T[i].pav; let best=0;
    for(let n=1;n<=80;n++){ T[i].pav=n; const mm=massing(S); if(mm.H<=(mm.hLim??S.regras.hMax)+1e-6 && mm.CA<=S.regras.caMax+1e-6) best=n; else break }
    T[i].pav=best||keep; update(); toast(best? `Torre ${i+1}: ${best} pavimentos` : `Torre ${i+1}: nenhum pavimento a mais cabe`) },
  addMix: ()=>{ const X=S.produto.mix; if(X.length<5){ X.push({nome:"Studio",area:35,qtd:1,preco:12000,sac:3}); PR.mix=X.length-1; update(); requestAnimationFrame(()=>prRelista("mix", PR.mix)) } },
  rmMix: b=>{ const X=S.produto.mix, i=+b.dataset.i; if(X.length<2 || !X[i]) return; const nome=X[i].nome; X.splice(i,1); PR.mix=-1; update(); toast(`${nome||"Tipologia"} removida — Ctrl+Z desfaz`) },
  // "Guardar como alternativa" (menu "…" do topo e Entrega › Estudos): grava o estudo como cenário, sem sair da etapa
  aprovar: ()=>{ saveScenario(null,true); toast("Guardado como alternativa — compare em Entrega") },
});
