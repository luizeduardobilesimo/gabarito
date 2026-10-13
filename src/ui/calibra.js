/* ================= Fase E (interface): calibrar os prêmios com uma tabela de vendas real =================
   Card "Calibrar com tabela de vendas" na Viabilidade › Vendas (fechado por padrão). Cálculo em src/calc/calibravendas.js;
   leitura de arquivos em src/ui/arquivos.js. Os dados importados ficam só na memória da página (VCAL); o estudo guarda apenas
   S.vcal.info (quando/quanto da última calibração aplicada). Nada muda nos números até "Aplicar ao estudo" (Ctrl+Z desfaz). */
extendDEF("vcal", { info:null });
{ const st=document.createElement("style"); st.id="calCSS"; st.textContent=`
.calOr{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.calOr>div{padding:5px 7px;border-radius:9px;background:var(--surface-2);display:grid;gap:1px;min-width:0}
.calOr b{font-family:var(--f-display);font-size:11px;color:var(--muted);font-weight:600}
.calOr span{font-family:var(--f-mono);font-size:10.5px;color:var(--muted);white-space:nowrap}
.calOr em{font-family:var(--f-mono);font-size:11.5px;font-style:normal;font-weight:600;color:var(--ink)}
.calOr .sem em{color:var(--muted);font-weight:400}
.calAv{color:var(--warn);font-size:11.5px;line-height:1.35}`; document.head.appendChild(st) }

const VCAL = { dados:[], cab:[], nome:"", mapa:{}, off:2, ln:null, res:null, opts:{ tetoAuto:true, usaOrient:true, usaVista:true }, sig:"" };
const calP = v => v==null||!isFinite(v)? "—" : Math.abs(v)<0.00005? "0,0%" : (v>0?"+":"−")+nf(Math.abs(v)*100,1)+"%";
const calPP = v => v==null||!isFinite(v)? "—" : nf(v*100,1)+"%";
const calSig = () => JSON.stringify([S.venda.andarPct, S.venda.andarTeto, S.venda.orient, S.venda.vistaPct, S.venda.cobPct, S.produto.mix.map(u=>[u.nome,u.preco]), S.produto.cob.preco]);

function calRecalc(){
  if(!VCAL.dados.length){ VCAL.ln=VCAL.res=null; return }
  VCAL.ln=calibLinhas(VCAL.dados, VCAL.mapa, { offset:VCAL.off });
  VCAL.res=calibraPremios(VCAL.ln.linhas, { ...VCAL.opts, atual:S.venda });
  VCAL.sig=calSig();
}

/* ---------- marcação ---------- */
function calResSVG(pa){
  if(!pa.length) return "";
  const W=360, H=116, pl=30, pr=6, pt=8, pb=18, mx=Math.max(0.03, ...pa.map(a=>Math.abs(a.res)))*1.1, bw=(W-pl-pr)/pa.length, y0=pt+(H-pt-pb)/2, sy=v=>(H-pt-pb)/2*v/mx;
  const lab=(v)=>`${v>0?"+":v<0?"−":""}${nf(Math.abs(v)*100,0)}%`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Resíduo médio por andar: preço real contra o previsto">
    <line x1="${pl}" x2="${W-pr}" y1="${y0}" y2="${y0}" stroke="var(--line)"/>
    ${[mx,-mx].map(v=>`<text x="${pl-4}" y="${(y0-sy(v)+3).toFixed(1)}" font-size="9" text-anchor="end" fill="var(--muted)" font-family="IBM Plex Mono">${lab(v)}</text>`).join("")}
    ${pa.map((a,i)=>{ const h=sy(a.res), x=pl+i*bw+Math.min(1,bw*0.12); const ruim=Math.abs(a.res)>0.03;
      return `<rect x="${x.toFixed(1)}" y="${(h>=0? y0-h : y0).toFixed(1)}" width="${Math.max(1,bw-Math.min(2,bw*0.24)).toFixed(1)}" height="${Math.max(0.6,Math.abs(h)).toFixed(1)}" rx="1" fill="${ruim?"var(--bad)":"var(--accent)"}" fill-opacity="${ruim?.75:.55}"><title>${a.andar}º andar: ${calP(a.res)} (${a.n} un.)</title></rect>` }).join("")}
    <text x="${pl}" y="${H-4}" font-size="9" fill="var(--muted)">${pa[0].andar}º</text><text x="${W-pr}" y="${H-4}" font-size="9" text-anchor="end" fill="var(--muted)">${pa[pa.length-1].andar}º andar</text></svg>`;
}
function calBody(){
  const imp=`<div class="row"><label class="btn sm ${VCAL.dados.length?"ghost":"pri"}" style="cursor:pointer">${VCAL.dados.length?"Trocar tabela":"Importar tabela"}<input type="file" id="calFile" accept="${PLA_ACCEPT}" hidden></label>
    <button type="button" class="btn sm ghost" data-act="calModelo">Baixar modelo</button>${VCAL.dados.length?`<button type="button" class="btn sm ghost" data-act="calLimpa">Limpar</button>`:""}</div>`;
  const info=S.vcal&&S.vcal.info, ult=info? `<p class="note">Última calibração aplicada: ${info.n} unidades · R² ${calPP(info.r2)} · ${esc(info.origem||"")} · ${new Date(info.quando).toLocaleDateString("pt-BR")}</p>` : "";
  if(!VCAL.dados.length) return imp + `<p class="note">CSV ou XLSX: unidade, andar, área privativa e preço.</p>` + ult;
  const r=VCAL.res, ln=VCAL.ln;
  const mapaAdv = ADV(
    KV(CAL_CAMPOS.map(c=>plaSelect("calMap-"+c.k,"data-cal",c.k,c.rot,VCAL.cab,VCAL.mapa[c.k],c.obrig)).join("")) +
    `<div class="grp">Ajuste</div>` +
    ["tetoAuto|Detectar o teto do prêmio por andar","usaOrient|Calibrar a orientação","usaVista|Calibrar a vista (se a tabela trouxer)"].map(s=>{ const [k,l]=s.split("|"); return `<label class="sw"><input type="checkbox" data-cal-opt="${k}" ${VCAL.opts[k]?"checked":""}><span class="tg"></span><span>${l}</span></label>` }).join("") +
    (ln.descartadas.length? `<div class="grp">Linhas descartadas (${ln.descartadas.length})</div><div class="note" style="max-height:110px;overflow:auto">${ln.descartadas.slice(0,30).map(d=>`linha ${d.linha}: ${esc(d.motivo)}`).join("<br>")}${ln.descartadas.length>30?"<br>…":""}</div>` : ""),
    { key:"cal" });
  const cab=`<p class="note">${esc(VCAL.nome)} · ${ln.linhas.length} linhas válidas${ln.descartadas.length?` · ${ln.descartadas.length} descartadas`:""}</p>`;
  if(!r || !r.ok) return imp + cab + `<p class="calAv">${esc(r? r.motivo : "Sem dados.")} Confira as colunas em “Mais opções”.</p>` + ln.avisos.map(a=>`<p class="calAv">${esc(a)}</p>`).join("") + mapaAdv;
  const V=S.venda, P=S.produto;
  const met=`<div class="mets"><div class="met"><div class="l">Ajuste (R²)${INFO("R²")}</div><div class="v">${calPP(r.r2)}</div><div class="s">${r.n} unidades · ${r.tipologias.length+(r.cob?1:0)} tipologia${r.tipologias.length+(r.cob?1:0)>1?"s":""}</div></div>
    <div class="met"><div class="l">Erro médio${INFO("Erro médio de previsão do preço por m², com a fórmula do Gabarito: preço base × (1 + prêmios). “Atual” usa os prêmios que o estudo tem hoje, com o preço base refeito para a tabela.")}</div><div class="v">${calPP(r.erroMedio)}</div><div class="s">${r.erroAtual!=null? "atual "+calPP(r.erroAtual) : "&nbsp;"}</div></div></div>`;
  const a=r.andar;
  const tab=`<table class="tbl multi" style="table-layout:fixed"><tr><th style="width:42%"></th><th>Atual</th><th>Calibrado</th></tr>
    <tr><td>Por andar</td><td>${calP(V.andarPct)}</td><td>${a? `<span title="±${nf(a.ep*100,2)} ponto percentual (erro-padrão)">${calP(a.pct)}</span>` : "—"}</td></tr>
    <tr><td>Teto do andar</td><td>${calP(V.andarTeto)}</td><td>${a? (a.teto!=null? calP(a.teto)+` <span class="note">no ${a.K+1}º</span>` : `sem teto até o ${a.aMax}º`) : "—"}</td></tr>
    <tr><td>Vista (até ±)</td><td>${calP(V.vistaPct)}</td><td>${r.vista? calP(Math.max(0,r.vista.pct)) : "sem dado"}</td></tr>
    <tr><td>Cobertura${INFO("A cobertura é calibrada como grupo próprio: o preço por m² dela já carrega o prêmio. Por isso o prêmio extra fica em 0%.")}</td><td>${nf(P.cob.preco,0)}/m²</td><td>${r.cob? nf(r.cob.base,0)+`/m² <span class="note">${calP(r.cob.premio)}</span>` : "sem dado"}</td></tr>
    <tr><td>Sol${INFO("O prêmio de sol não é calibrável sem as horas de sol da tabela de referência. O do estudo continua valendo.")}</td><td>${calP(V.solPct)}/h</td><td class="note" style="font-family:var(--f-body)">mantido</td></tr></table>`;
  const or=`<div class="grp">Orientação (melhor fachada)${INFO("Prêmio de cada direção, em relação à média da tabela. Direções sem dados na tabela (—) ficam como estão no estudo.")}</div><div class="calOr">${CAL_DIRS.map(d=>{ const c=r.orient[d]; return `<div class="${c.v==null?"sem":""}" title="${c.n} unidades"><b>${d}</b><span>${calP(V.orient[d])}</span><em>${c.v==null?"—":calP(c.v)}</em></div>` }).join("")}</div>`;
  const usados=new Set(), tip=r.tipologias.map(t=>{ const j=(t.nome==="Todas")? -1 : calibCasaMix(t.nome,P.mix,usados); if(j>=0) usados.add(j); return `<tr><td>${esc(t.nome)}</td><td>${t.n}</td><td>${j>=0? nf(P.mix[j].preco,0) : "—"}</td><td>${nf(t.base,0)}</td></tr>` }).join("");
  const tipT=`<div class="grp">Preço base (R$/m², 1º andar)</div><table class="tbl multi" style="table-layout:fixed"><tr><th style="width:34%"></th><th>Un.</th><th>Mix atual</th><th>Calibrado</th></tr>${tip}</table>`;
  const sem=calibSemMix(S,r), avs=[...r.avisos, ...ln.avisos, ...(sem.length? [`Sem correspondência no mix do estudo: ${sem.join(", ")}.`] : []), ...(r.usouOrient && r.semOrient? [`${r.semOrient} unidade${r.semOrient>1?"s":""} sem orientação reconhecida.`] : [])];
  const grf=`<div class="grp">Resíduo médio por andar${INFO("Resíduo")}</div>${calResSVG(r.porAndar)}`;
  const acts=`<div class="row"><button type="button" class="btn pri sm" data-act="calAplicar">Aplicar ao estudo</button><button type="button" class="btn sm" data-act="calPadrao">Salvar como padrão da empresa</button>${vendaPadraoEmpresa()?`<button type="button" class="btn sm ghost" data-act="calPadraoUsa">Usar padrão da empresa</button>`:""}</div>`;
  return imp + cab + met + tab + or + tipT + grf + avs.map(t=>`<p class="calAv">${esc(t)}</p>`).join("") + acts + ult + mapaAdv;
}
function calRender(){ setHTML("calBox", calBody()); setSum("vCal", calSum()) }
function calSum(){
  const r=VCAL.res, info=S.vcal&&S.vcal.info;
  if(r&&r.ok) return `R² <b>${calPP(r.r2)}</b> · ${r.n} un.`;
  return info? `calibrado: ${info.n} un. · R² ${calPP(info.r2)}` : "sem tabela";
}

/* ---------- ações ---------- */
async function calCarregar(file){
  try{
    const r=await plaLerArquivo(file), h=plaCabecalho(r.matriz);
    VCAL.nome=r.nome+(r.aba?` (${r.aba})`:""); VCAL.cab=h.cab; VCAL.dados=h.dados; VCAL.off=h.iHead+2; VCAL.mapa=calibMapa(h.cab);
    calRecalc(); calRender();
    const m=VCAL.mapa; if(!(m.area>=0)||!(m.preco>=0||m.precoM2>=0)) toast("Não achei área e preço: ligue as colunas em “Mais opções”.");
  }catch(e){ toast(e&&e.message||"Não consegui ler o arquivo") }
}
Object.assign(ACT, {
  calModelo: ()=>plaBaixarModelo("modelo-tabela-de-vendas.csv", calibModeloCSV()),
  calLimpa: ()=>{ VCAL.dados=[]; VCAL.cab=[]; VCAL.res=VCAL.ln=null; VCAL.nome=""; calRender() },
  calAplicar: ()=>{
    const r=VCAL.res; if(!r||!r.ok) return;
    const mud=calibAplicar(S, r);
    if(!mud.length){ toast("Nada a mudar: o estudo já está com esses prêmios"); return }
    S.vcal.info={ quando:new Date().toISOString(), n:r.n, r2:r.r2, origem:VCAL.nome };
    VCAL.sig=""; renderTab(); update(); toast(`Calibrado: ${mud.length} ajuste${mud.length>1?"s":""}. Ctrl+Z desfaz.`);
  },
  calPadrao: ()=>{
    const r=VCAL.res; if(!r||!r.ok) return;
    const tmp=clone(S); calibAplicar(tmp, r);
    if(vendaSalvarPadrao(tmp, { n:r.n, r2:r.r2, origem:VCAL.nome })){ calRender(); toast("Prêmios salvos como padrão da empresa: estudos novos começam com eles") } else toast("Não foi possível gravar neste navegador");
  },
  calPadraoUsa: ()=>{ if(vendaAplicarPadrao(S)){ VCAL.sig=""; renderTab(); update(); toast("Padrão da empresa aplicado ao estudo") } },
});

/* padrão da empresa: vale para estudos novos (DEF) e para o estudo que ainda não tem prêmios próprios salvos */
{ const p=vendaPadraoEmpresa(), sv=LS.get("gabarito.v2");
  if(p){ ["andarPct","andarTeto","vistaPct","cobPct"].forEach(k=>{ if(typeof p[k]==="number"){ DEF.venda[k]=p[k]; if(!(sv&&sv.venda&&typeof sv.venda[k]==="number")) S.venda[k]=p[k] } });
    if(p.orient){ DEF.venda.orient={...DEF.venda.orient,...p.orient}; if(!(sv&&sv.venda&&sv.venda.orient)) S.venda.orient={...S.venda.orient,...p.orient} } } }

addCard("viab", { key:"vCal", sub:"vendas", order:46,
  html: ()=>SEC("Calibrar com tabela de vendas", `<div id="calBox">${calBody()}</div>`, { key:"vCal", info:"Calibrar prêmios", sum:calSum() }),
  after: ()=>{
    const box=document.getElementById("calBox"); if(!box) return;
    box.addEventListener("change", async e=>{ const t=e.target;
      if(t.id==="calFile"){ await calCarregar(t.files&&t.files[0]); t.value="" }
      else if(t.dataset.cal){ VCAL.mapa[t.dataset.cal]=+t.value; calRecalc(); calRender() }
      else if(t.dataset.calOpt){ VCAL.opts[t.dataset.calOpt]=t.checked; calRecalc(); calRender() } });
  },
  live: (m,f,fast)=>{
    setSum("vCal", calSum());
    if(fast || !VCAL.dados.length || !finVis("calBox")) return;
    if(calSig()!==VCAL.sig){ calRecalc(); calRender() }
  }
});
