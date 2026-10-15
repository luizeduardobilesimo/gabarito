/* ================= Fase E (custos): interface da calibração, dos indiretos extras e da tabela CUB do estado =================
   Cálculo em src/calc/{calibracusto,indiretos,cub}.js; aqui só marcação e ações.
   - Card "Calibrar com obras reais" (Viabilidade › Premissas › grupo Custos, fechado): obras realizadas → fator sobre o CUB e peso da garagem, com erro por obra e R²;
     "Aplicar ao estudo", "Salvar como padrão da empresa" (localStorage gabarito.custo.padrao; o Supabase troca só ccalSalvarPadrao/ccalPadraoEmpresa),
     importação de CSV ou XLSX (SheetJS do cdnjs, só quando o arquivo é planilha) e modelo de CSV.
   (Leitor próprio e pequeno, com prefixo ccal: depois do merge pode passar a usar plaCSV/plaNum de src/calc/planilha.js e a leitura de planilhas de src/ui/arquivos.js.)
   - softCamposHTML(): seis indiretos que faltavam, dentro de Premissas › Custos indiretos › Mais opções, com "Usar sugeridos da colinha".
   - FX.cub / FX.cubMan e ACT.cubUf: "Seguir a tabela do estado" (orc.cubAuto) e a sugestão de estado pela zona escolhida em Regras. */
const CCAL_UI = { abertas: new Set() };
{ const st = document.createElement("style"); st.id = "ccalCSS"; st.textContent = `
.ccal-o{border-top:1px solid var(--line);padding:2px 0}
.ccal-o>summary{cursor:pointer;display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:7px 0;list-style:none;font-size:13px}
.ccal-o>summary::-webkit-details-marker{display:none}
.ccal-o>summary .ccal-v{font-family:var(--f-mono);font-size:11.5px;color:var(--muted);white-space:nowrap}
.ccal-o[open]>summary{color:var(--ink)}
.ccal-o .row{margin-top:8px}
.ccal-warn+.row,.ccal-err+.row{margin-top:10px}
.ccal-err td:nth-child(2),.ccal-err td:nth-child(3){font-family:var(--f-mono);font-size:12px;text-align:right;white-space:nowrap}
.ccal-warn{color:var(--warn-t);font-size:12px;margin:4px 0 0}
#ccalRes .mets{grid-template-columns:repeat(3,minmax(0,1fr))}
#ccalRes .met{padding:8px 10px}
#ccalRes .met .v{font-size:16px}`; document.head.appendChild(st) }

/* ---------------- indiretos extras (Premissas › Custos indiretos › Mais opções) ---------------- */
function softAjuda(it){
  const [a, b] = SOFT_FAIXAS[it.k], f = v => nf(v * 100, v * 100 % 1 ? 1 : 0);
  return `${it.desc} Faixa usual de mercado: ${f(a)} a ${f(b)} ${it.un}. Sugerido na colinha: ${nf(SOFT_SUGERIDOS[it.k] * 100, 1)}%. Confira com o seu cartório, corretora de seguros e contabilidade.`;
}
function softCamposHTML(){
  const campos = SOFT_ITENS.map(it => NUM(`soft.${it.k}`, it.rot, it.un, { pct: true, step: it.step, min: 0, help: softAjuda(it), q: it.q + " indiretos soft costs" })).join("");
  return GRP(`Outros indiretos ${INFO("Outros indiretos")}`) + KV(campos) +
    `<div class="row"><button type="button" class="btn sm" data-act="softSug">Usar sugeridos da colinha</button><button type="button" class="btn sm ghost" data-act="softZera">Zerar</button></div><p class="note" id="softNote"></p>`;
}
function softNota(f){
  const e = document.getElementById("softNote"); if(!e) return;
  const t = f.soft > 0 ? `Somam <b>${mi(f.soft)}</b> · ${pct(f.soft / Math.max(1, f.vgv), 1)} do VGV` : "Desligados (0%): não entram no resultado";
  if(e.innerHTML !== t) e.innerHTML = t;
}

/* ---------------- tabela CUB: efeitos e ações ---------------- */
Object.assign(FX, {
  /* mudou estado, padrão ou "seguir a tabela": o CUB do estudo acompanha quando está ligado */
  cub: live => { cubSincroniza(S); FX.upd(live) },
  /* digitou o CUB à mão: sai do "seguir a tabela" */
  cubMan: live => { const era = S.orc.cubAuto; if(era) S.orc.cubAuto = false; FX.upd(live); if(era && !live) renderTab() },
  /* qualquer campo da calibração: guarda e recalcula só o resultado (nada do estudo muda até "Aplicar") */
  ccal: () => { (S.ccal.obras || []).forEach(o => { o.ref = ccalRef(o.ref) }); save(); if(window._last) ccalLive(window._last.m, window._last.f) }
});
Object.assign(ACT, {
  cubUf: b => { S.orc.uf = b.dataset.v; cubSincroniza(S); update(); renderTab(); toast(`Estado da tabela CUB: ${S.orc.uf}`) },
  cubDoEstado: () => { S.orc.cubAuto = true; if(!cubSincroniza(S)) save(); update(); renderTab(); toast(`CUB do estudo agora segue ${S.orc.uf} ${S.orc.padrao}`) }
});

/* ---------------- calibrar com obras reais ---------------- */
function ccalCubDe(o){
  if(+o.cub > 0) return +o.cub;
  const uf = o.uf || S.orc.uf, pad = o.padrao || S.orc.padrao, v = cubValor(S, uf, pad), r = cubLinha(S, uf); if(!v) return null;
  const nota = [];
  if(!o.ref) nota.push("sem o mês da obra");
  else if(r.ref && o.ref !== r.ref) nota.push(`a tabela é de ${cubRefTxt(r.ref)}, a obra é de ${cubRefTxt(o.ref)}`);
  if(r.ilustrativo) nota.push("valor ilustrativo"); else if((r.est || []).includes(pad)) nota.push("padrão estimado");
  return nota.length ? { v, aviso: `usei o CUB ${r.uf} ${pad} da tabela (${nota.join("; ")}). Informe o CUB do mês da obra para ficar preciso.` } : v;
}
const ccalCalc = () => ccalCusto(S.ccal.obras || [], ccalCubDe, { fator: S.fin.fator, eqGar: S.fin.eqGar });

function ccalLinhaHTML(o, i){
  const p = k => `ccal.obras.${i}.${k}`, ufs = [["", `do estudo (${S.orc.uf})`], ...cubLista(S).map(r => [r.uf, r.uf])], pads = [["", `do estudo (${S.orc.padrao})`], ...CUB_PADROES.map(x => [x[0], x[0]])];
  return `<details class="ccal-o" data-ci="${i}" ${CCAL_UI.abertas.has(i) ? "open" : ""}><summary><span id="ccal-t-${i}">${esc(o.nome || "Obra " + (i + 1))}</span><span class="ccal-v" id="ccal-s-${i}"></span></summary>
    ${KV(TXT(p("nome"), "Nome", { fx: "ccal" }) + TXT(p("ref"), "Mês/ano (AAAA-MM)", { fx: "ccal", ph: "2025-06" }) +
      finSEL(p("uf"), ufs, "Estado do CUB", { fx: "ccal" }) + finSEL(p("padrao"), pads, "Padrão do CUB", { fx: "ccal" }) +
      NUM(p("cub"), "CUB do mês", "R$/m²", { step: 1, zero: true, ph: "da tabela", fx: "ccal", help: "Vazio = o da tabela para o estado e padrão (mês mais recente). Informe o CUB do mês da obra para ficar preciso." }) +
      NUM(p("custo"), "Custo realizado", "R$", { step: 100000, zero: true, fx: "ccal" }) +
      NUM(p("priv"), "Área privativa", "m²", { step: 10, zero: true, fx: "ccal" }) + NUM(p("torre"), "Torre/tipo", "m²", { step: 10, zero: true, fx: "ccal" }) +
      NUM(p("garagem"), "Garagem/subsolo", "m²", { step: 10, zero: true, fx: "ccal" }) + NUM(p("lazer"), "Lazer coberto", "m²", { step: 10, zero: true, fx: "ccal" }))}
    <div class="row"><button type="button" class="btn sm ghost" data-act="ccalDel" data-i="${i}">Remover obra</button></div></details>`;
}
function ccalHTML(){
  const obras = S.ccal.obras || [], emp = !!ccalPadraoEmpresa();
  const lista = obras.map(ccalLinhaHTML).join("");
  const body = `<div id="ccalRes"></div><div id="ccalList">${lista}</div>
    <div class="row"><button type="button" class="btn sm" data-act="ccalAdd">+ Adicionar obra</button></div>` +
    ADV(`<div class="row"><label class="btn sm ghost" style="cursor:pointer">Importar CSV ou XLSX<input type="file" id="ccalFile" accept=".csv,.txt,.xlsx,.xls,text/csv" hidden></label><button type="button" class="btn sm ghost" data-act="ccalModelo">Baixar modelo CSV</button></div>
      ${emp ? `<div class="row"><button type="button" class="btn sm ghost" data-act="ccalEmpresa">Usar padrão da empresa</button></div>` : ""}`, { key: "ccal" });
  return SEC("Calibrar com obras reais", finQ("calibrar obras reais custo fator garagem equivalência eqgar cub", body),
    { key: "ccal", cls: "fq", info: "Calibração do custo", sum: "" });
}
const ccalN = (v, d = 2) => nf(v, d);
function ccalResHTML(res, m){
  const F = S.fin, obras = S.ccal.obras || [], par = S.orc.modo === "param";
  const ign = res.ignoradas.map(i => `<div class="ccal-warn">${esc(i.nome)}: ${esc(i.motivo)} — fora do ajuste.</div>`).join("");
  if(!res.n) return `<p class="note">${obras.length ? "Nenhuma obra com custo, área e CUB." : "Informe uma ou mais obras para ajustar o custo."}</p>${ign}`;
  const igual = Math.abs(F.fator - res.fator) < 0.0005 && (res.modo !== "fator+garagem" || Math.abs(F.eqGar - res.eqGar) < 0.0005);
  const tiles = `<div class="mets">
    <div class="met"><div class="l">Fator ÷ CUB${INFO("Custo ÷ CUB")}</div><div class="v">${ccalN(res.fator)}×</div><div class="s">agora ${ccalN(F.fator)}×</div></div>
    <div class="met"><div class="l">Peso garagem${INFO("Peso da garagem")}</div><div class="v">${res.modo === "fator+garagem" ? ccalN(res.eqGar) : "mantido"}</div><div class="s">agora ${ccalN(F.eqGar)}</div></div>
    <div class="met"><div class="l">Ajuste${INFO("R²")}</div><div class="v">${res.r2 == null ? "—" : ccalN(res.r2, 3)}</div><div class="s">erro ${pct(res.erroMedio, 1)}</div></div></div>`;
  const cor = e => Math.abs(e) > 0.1 ? "var(--bad)" : Math.abs(e) > 0.05 ? "var(--warn)" : "var(--ok)";
  const tab = `<table class="tbl ccal-err"><tr><th>Obra</th><th>Real</th><th>Previsto</th><th>Erro</th></tr>${res.erros.map(e => `<tr><td>${esc(e.nome)}</td><td>${mi(e.real)}</td><td>${mi(e.previsto)}</td><td style="color:${cor(e.erro)}">${e.erro >= 0 ? "+" : "−"}${nf(Math.abs(e.erro) * 100, 1)}%</td></tr>`).join("")}</table>`;
  const av = res.avisos.map(a => `<div class="ccal-warn">${esc(a)}</div>`).join("");
  let pnote = "";
  if(par && m){ const p = ccalParam(S, m, res); if(p) pnote = `<p class="note">Orçamento paramétrico: escala ${p.chaves.map(k => ORC_SIS.find(s => s.k === k).nome.toLowerCase()).join(", ")} em ×${ccalN(p.s)}.</p>` }
  const emp = ccalPadraoEmpresa();
  return tiles + tab + av + ign + pnote +
    `<div class="row"><button type="button" class="btn sm" data-act="ccalAplica" ${igual ? "disabled" : ""}>${igual ? "Aplicado ao estudo" : "Aplicar ao estudo"}</button><button type="button" class="btn sm ghost" data-act="ccalSalva">Salvar como padrão da empresa</button></div>` +
    (emp ? `<p class="note">Padrão da empresa: ${ccalN(emp.fator)}× · garagem ${ccalN(emp.eqGar)} · ${emp.n} obra${emp.n === 1 ? "" : "s"}</p>` : "");
}
function ccalLive(m, f){
  const obras = S.ccal.obras || [], res = ccalCalc();
  obras.forEach((o, i) => { const t = document.getElementById("ccal-t-" + i), s = document.getElementById("ccal-s-" + i);
    if(t) t.textContent = o.nome || "Obra " + (i + 1);
    if(s) s.textContent = o.custo > 0 ? `${mi(o.custo)}${o.priv > 0 ? " · " + brl(o.custo / o.priv) + "/m²" : ""}` : "" });
  setSum("ccal", !obras.length ? "nenhuma obra" : res.n ? `${res.n} obra${res.n === 1 ? "" : "s"} · fator <b>${ccalN(res.fator)}×</b>${res.modo === "fator+garagem" ? ` · garagem ${ccalN(res.eqGar)}` : ""}` : `${obras.length} obra${obras.length === 1 ? "" : "s"} incompleta${obras.length === 1 ? "" : "s"}`);
  const el = document.getElementById("ccalRes");
  if(el && !(document.activeElement && el.contains(document.activeElement))){ const h = ccalResHTML(res, m); if(el.innerHTML !== h) el.innerHTML = h }
  CCAL_UI.res = res;
  if(f){ softNota(f);
    if(f.soft > 0) setSum("ind", `<b>${pct(S.fin.projetos + S.fin.adm + S.fin.conting, 0)}</b> da obra · ITBI ${pct(S.fin.itbi, 1)} · outros ${mi(f.soft)}`) }
}
function ccalAfter(){
  const fi = document.getElementById("ccalFile");
  if(fi) fi.onchange = async () => {
    const file = fi.files[0]; fi.value = ""; if(!file) return;
    try{
      let txt;
      if(/\.xlsx?$/i.test(file.name)){
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array" }), ws = wb.Sheets[wb.SheetNames[0]];
        txt = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" }).map(l => l.map(c => String(c).replace(/;/g, ",")).join(";")).join("\n");
      } else txt = await file.text();
      const novas = ccalParse(txt);
      if(!novas.length){ toast("Não encontrei obras: precisa de uma coluna “custo” e das áreas (use o modelo CSV)"); return }
      S.ccal.obras = [...(S.ccal.obras || []), ...novas]; update(); renderTab(); toast(`${novas.length} obra${novas.length === 1 ? "" : "s"} importada${novas.length === 1 ? "" : "s"}`);
    }catch(e){ console.error(e); toast("Não consegui ler esse arquivo") }
  };
  TB.querySelectorAll("details.ccal-o").forEach(d => d.addEventListener("toggle", () => { const i = +d.dataset.ci; if(d.open) CCAL_UI.abertas.add(i); else CCAL_UI.abertas.delete(i) }));
}
Object.assign(ACT, {
  softSug: () => { softSugeridos(S); update(); renderTab(); toast("Indiretos da colinha ligados com os valores sugeridos (Ctrl+Z desfaz)") },
  softZera: () => { Object.keys(SOFT_SUGERIDOS).forEach(k => { S.soft[k] = 0 }); update(); renderTab(); toast("Outros indiretos desligados") },
  ccalAdd: () => { const l = S.ccal.obras = S.ccal.obras || []; l.push({ ...ccalObraVazia(), nome: "Obra " + (l.length + 1) }); CCAL_UI.abertas.add(l.length - 1); save(); renderTab();
    const d = TB.querySelector(`details.ccal-o[data-ci="${l.length - 1}"]`); if(d){ const sec = d.closest("details.sec"); if(sec) sec.open = true; d.scrollIntoView({ block: "nearest" }) } },
  ccalDel: b => { if(!b.dataset.arm){ b.dataset.arm = 1; b.textContent = "Confirmar"; b.classList.add("on"); return }
    const i = +b.dataset.i; S.ccal.obras.splice(i, 1); CCAL_UI.abertas = new Set(); save(); renderTab() },
  ccalAplica: () => { const res = ccalCalc(); const mud = ccalAplica(S, res); if(!mud){ toast("Sem obras válidas para aplicar"); return }
    let extra = "";
    if(S.orc.modo === "param" && window._last){ const p = ccalParam(S, window._last.m, res); if(p){ S.orc.coef = p.coef; extra = ` · coeficientes ×${ccalN(p.s)}` } }
    update(); renderTab(); toast(`Fator ${ccalN(mud.fator[1])}×${mud.eqGar ? " · garagem " + ccalN(mud.eqGar[1]) : ""}${extra} (Ctrl+Z desfaz)`) },
  ccalSalva: () => { const res = ccalCalc(); if(ccalSalvarPadrao(S, res)){ renderTab(); toast("Calibração salva como padrão da empresa — estudos novos começam com ela") } else toast("Não foi possível gravar neste navegador") },
  ccalEmpresa: () => { if(ccalAplicarPadrao(S)){ update(); renderTab(); toast("Padrão da empresa aplicado") } },
  ccalModelo: () => { saveFile("obras-reais-modelo.csv", "﻿" + CCAL_MODELO_CSV) }
});
addCard("viab", { key: "ccal", sub: "prem", order: 8, html: ccalHTML, live: (m, f) => ccalLive(m, f), after: ccalAfter });

/* ---------------- peças usadas por src/ui/financeiro.js (tabela CUB, lucro após imprevistos, DRE e PDF) ---------------- */
function finCubSug(){
  const uf = cubUfSugerida(S);
  return uf ? `<div class="row sb"><span class="note">A zona escolhida em Regras é de ${uf}.</span><button type="button" class="btn sm ghost" data-act="cubUf" data-v="${uf}">Usar ${uf}</button></div>` : "";
}
function cubInfoHTML(r, val, C){
  if(!r) return "";
  const pad = S.orc.padrao, imp = (S.orc.cubTab || []).some(x => String(x.uf).toUpperCase() === r.uf);
  const [cls, txt] = r.ilustrativo ? ["warn", "ilustrativo"] : (r.est || []).includes(pad) ? ["warn", "estimado"] : ["ok", imp ? "importado" : "publicado"];
  const link = r.url ? ` <a href="${esc(r.url)}" target="_blank" rel="noopener" style="color:var(--accent)">fonte</a>` : "";
  const dif = val && Math.abs(val - C) > 0.5;
  return `<div class="row sb" style="align-items:baseline"><span style="font-family:var(--f-mono);font-size:13px">${val ? brl(val) + "/m²" : "padrão sem valor"}</span><span class="pill ${cls}">${txt}</span></div>
    <p class="note">${esc(cubDescricao(S, r.uf, pad))}${link}</p>
    ${dif ? `<div class="row sb"><span class="note">em uso: ${brl(C)}</span>${S.orc.cubAuto ? "" : `<button type="button" class="btn sm ghost" data-act="cubDoEstado">Seguir a tabela</button>`}</div>` : ""}`;
}
function finImprevHTML(f){
  const i = f.imprevistos; if(!i) return "";
  if(!(i.min.extra > 0) && !(i.max.extra > 0)) return `<div class="s">após imprevistos: a contingência já cobre ${pct(i.max.meta, 0)}</div>`;
  return `<div class="s">após imprevistos ${pct(i.min.meta, 0)}–${pct(i.max.meta, 0)}${INFO("Lucro após imprevistos")}: <b>${mi(i.min.lucro)}</b> a <b>${mi(i.max.lucro)}</b></div>`;
}
function finSoftDRE(f){
  if(!(f.soft > 0)) return "";
  return `<tr class="neg"><td>Outros indiretos</td><td>−${brl(f.soft)}</td></tr>` +
    (f.softItens || []).map(i => `<tr><td style="padding-left:12px;color:var(--muted)">${esc(i.nome)}</td><td style="color:var(--muted)">${brl(i.valor)}</td></tr>`).join("");
}
function finImprevDRE(f){
  const i = f.imprevistos; if(!i) return "";
  if(!(i.min.extra > 0) && !(i.max.extra > 0)) return "";
  const lin = x => `<tr><td style="padding-left:12px;color:var(--muted)">Lucro após imprevistos de ${pct(x.meta, 0)}</td><td style="color:var(--muted)">${brl(x.lucro)} · ${pct(x.margemVGV)}</td></tr>`;
  return lin(i.min) + (i.max.meta > i.min.meta ? lin(i.max) : "");
}
/* página do PDF (chamada por financeiro.js): só quando há obras válidas */
function ccalPdf(ctx){
  const obras = S.ccal.obras || []; if(!obras.length) return;
  const res = ccalCalc(); if(!res.n) return;
  const { h2, rows } = ctx, e = v => `${v >= 0 ? "+" : "-"}${nf(Math.abs(v) * 100, 1)}%`;
  h2("Calibracao do custo com obras reais");
  rows([["Obras usadas", String(res.n)], ["Fator sobre o CUB", `${ccalN(res.fator)} x (estudo: ${ccalN(S.fin.fator)} x)`],
    ["Peso da garagem", res.modo === "fator+garagem" ? `${ccalN(res.eqGar)} (estudo: ${ccalN(S.fin.eqGar)})` : "mantido (so uma obra ou garagem proporcional)"],
    ["R2 / erro medio", `${res.r2 == null ? "-" : ccalN(res.r2, 3)} / ${pct(res.erroMedio, 1)}`],
    ...res.erros.map(x => [x.nome, `real ${mi(x.real)} | previsto ${mi(x.previsto)} | ${e(x.erro)}`])]);
}
