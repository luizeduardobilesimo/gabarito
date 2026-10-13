/* ================= Fase A: interface da "Saúde do negócio" e das "Metas e referências" =================
   Cálculo em src/calc/saude.js (saudeNegocio); aqui só marcação e ações.
   - saudeResHTML(m,f)  → corpo do bloco "Saúde do negócio" (6 indicadores com semáforo e ⓘ + avisos), atualizado em finViabLive
   - finMetasHTML()     → seção fechada "Metas e referências" (Premissas): margem alvo/mínima, TIR alvo e TMA visíveis; faixas em "Mais opções"
   - ACT: metasPadrao (salvar como padrão da empresa) · metasSug (restaurar sugeridas) · metasEmpresa (voltar ao padrão da empresa) · zerarTerreno
   O "padrão da empresa" fica em localStorage "gabarito.metas.padrao" ({metas, fin:{tma,margemAlvo}, salvo}); a interface não muda quando
   isso for para o Supabase (docs/BACKEND.md) — só saudePadraoEmpresa()/saudeSalvarPadrao() em src/calc/saude.js. */

const sdCls = n => ({ ruim: "bad", atencao: "warn", ok: "ok", otimo: "ok" })[n] || "ok";            // classe de cor (.dot/.pill)
const sdTxt = n => ({ ruim: "ajustar", atencao: "atenção", ok: "ok", otimo: "ótimo" })[n] || "";
const sdFaixa = (a, b, d = 0) => `${nf(a * 100, d)}–${pct(b, d)}`;

function saudeItem(rot, v, sub, nivel, info){
  return `<div class="met"><div class="l"><span class="dot ${sdCls(nivel)}" role="img" aria-label="${sdTxt(nivel)}" title="${sdTxt(nivel)}"></span>${rot}${INFO(info)}</div><div class="v">${v}</div><div class="s">${sub}</div></div>`;
}
function saudeResHTML(m, f){
  const s = f.saude || saudeNegocio(S, m, f), M = S.metas, F = S.fin, n = s.nivel;
  const itens =
    saudeItem("Eficiência", pct(s.eficGlobal, 1), `${sdFaixa(s.faixaEfic[0], s.faixaEfic[1])} · ${s.tipologiaNome}`, n.efic,
      `Área privativa ÷ área total construída (ATC, com os subsolos). Para ${s.tipologiaNome} a referência é ${sdFaixa(s.faixaEfic[0], s.faixaEfic[1])}. Abaixo dela, garagem ou circulação estão pesando no produto.`) +
    saudeItem("Margem s/ VGV", pct(s.margemVGV), `meta ${pct(F.margemAlvo, 0)} · s/ receita ${pct(s.margemReceita)}`, n.margem,
      `Lucro ÷ VGV, a convenção do mercado. Meta ${pct(F.margemAlvo, 0)}; abaixo de ${pct(M.margem.min, 0)} a colinha diz "não toque". Sobre a receita nominal (com INCC e reajuste) a margem é ${pct(s.margemReceita)}.`) +
    saudeItem("TIR a.a.", finTir(f.tirA), `alvo ${pct(M.tir.alvo, 0)} · TMA ${pct(F.tma, 0)}`, n.tir,
      `Rentabilidade anual do fluxo de caixa. Alvo ${pct(M.tir.alvo, 0)} a.a.; abaixo da TMA (${pct(F.tma, 0)}) o projeto não paga o custo do capital. A TMA só desconta o VPL; a meta de retorno é a TIR alvo.`) +
    saudeItem("V/C", nf(s.vc, 2) + "×", `${nf(M.vc.min, 1)}–${nf(M.vc.bom, 1)} · CUB puro ${nf(s.vcCUB, 2)}×`, n.vc,
      `Relação venda/custo: preço médio por m² privativo (${brl(s.precoM2)}) ÷ custo de referência (CUB × fator = ${brl(s.custoRefM2)}). Abaixo de ${nf(M.vc.min, 1)} cuidado; ${nf(M.vc.min, 1)} a ${nf(M.vc.bom, 1)} saudável; acima de ${nf(M.vc.bom, 1)} excelente. Contra o CUB puro: ${nf(s.vcCUB, 2)}×.`) +
    saudeItem("Terreno % VGV", pct(s.terrenoPctVGV), `bom até ${pct(M.terreno.ok, 0)} · máx. ${pct(M.terreno.max, 0)}`, n.terreno,
      `(Preço do terreno + permuta física e financeira) ÷ VGV de tabela, sem ITBI. Até ${pct(M.terreno.ok, 0)} é confortável; até ${pct(M.terreno.max, 0)} pede atenção; acima compromete a margem.`) +
    saudeItem("Indiretos % VGV", pct(s.softPctVGV), `faixa ${sdFaixa(M.soft.min, M.soft.max)}`, n.soft,
      `Soft costs: projetos, administração, contingência, corretagem, marketing, RET, ITBI, outorga e juros ÷ VGV. Faixa de referência ${sdFaixa(M.soft.min, M.soft.max)}.`);
  const av = s.avisos.map(a => `<div class="row sb"><span class="note" style="color:var(--warn)">${esc(a.txt)}</span>${a.k === "permutaDupla" ? `<button type="button" class="btn sm ghost" data-act="zerarTerreno">Zerar terreno</button>` : ""}</div>`).join("");
  // torre desenhada / contorno ocupado: a privativa vem das unidades desenhadas (blcPrivReal)
  const ef = m && m.eficReal != null ? `<p class="note">Eficiência real da planta <b>${pct(m.eficReal, 0)}</b> (informada ${pct(S.produto.efic, 0)})${INFO("Eficiência real da planta")}</p>` : "";
  return `<div class="mets">${itens}</div>${ef}${av}<div class="row"><button type="button" class="btn sm ghost flink" data-act="finIr" data-v="prem" data-open="metas">Ajustar metas →</button></div>`;
}
function saudeStatusHTML(f){
  const s = f.saude; if(!s) return "";
  const pior = saudePior(Object.values(s.nivel));
  return `<span class="pill ${sdCls(pior)}">${{ ruim: "ajustar", atencao: "atenção", ok: "saudável", otimo: "saudável" }[pior]}</span>`;
}

/* ---------- Metas e referências (Premissas) ---------- */
function finMetasHTML(){
  const M = S.metas, E = M.efic, par = (rot, a, b, o = {}) => `<span class="fl">${rot}</span>${finIN(a, o.unit || "", { pct: !!o.pct, step: o.step, label: rot + " (1º valor)" })}${finIN(b, o.unit || "", { pct: !!o.pct, step: o.step, label: rot + " (2º valor)" })}`;   // sem wrapper: as células entram direto na grade .fcen
  const emp = !!saudePadraoEmpresa();
  const faixas = `<div class="fcen"><span></span><span class="fl">De</span><span class="fl">Até</span>
      ${par("V/C (cuidado · excelente)", "metas.vc.min", "metas.vc.bom", { step: 0.1, unit: "×", q: "venda custo" })}
      ${par("Terreno (bom até · máx.)", "metas.terreno.ok", "metas.terreno.max", { pct: true, step: 1, unit: "%", q: "terreno % vgv" })}
      ${par("Indiretos % VGV", "metas.soft.min", "metas.soft.max", { pct: true, step: 1, unit: "%", q: "soft costs custos indiretos" })}
      ${par("Imprevistos % obra", "metas.imprev.min", "metas.imprev.max", { pct: true, step: 1, unit: "%", q: "contingência" })}</div>`;
  const efic = `<div class="fcen"><span></span><span class="fl">Mín.</span><span class="fl">Máx.</span>
      ${Object.keys(SAUDE_TIPOS).map(k => par(SAUDE_TIPOS[k][0].toUpperCase() + SAUDE_TIPOS[k].slice(1), `metas.efic.${k}.0`, `metas.efic.${k}.1`, { pct: true, step: 1, unit: "%", q: "eficiência global tipologia" })).join("")}</div>`;
  return SEC("Metas e referências",
    KV(NUM("fin.margemAlvo", "Margem alvo", "% VGV", { pct: true, step: 1, help: "Margem s/ VGV", q: "meta lucro" }) + NUM("metas.margem.min", "Margem mínima", "% VGV", { pct: true, step: 1, q: "não toque piso" }) +
      NUM("metas.tir.alvo", "TIR alvo", "% a.a.", { pct: true, step: 1, help: "TIR alvo", q: "retorno meta" }) + NUM("fin.tma", "TMA", "% a.a.", { pct: true, step: 0.5, help: "TMA", q: "taxa mínima atratividade desconto vpl" })) +
    `<div class="row"><button type="button" class="btn sm" data-act="metasPadrao">Salvar como padrão</button><button type="button" class="btn sm ghost" data-act="metasSug">Restaurar sugeridas</button>${emp ? `<button type="button" class="btn sm ghost" data-act="metasEmpresa">Padrão da empresa</button>` : ""}</div>` +
    ADV(KV(NUM("metas.margem.otimo", "Margem ótima desde", "% VGV", { pct: true, step: 1 }) + NUM("metas.tir.otimo", "TIR ótima desde", "% a.a.", { pct: true, step: 1 }) +
        NUM("metas.vc.ruim", "V/C ruim abaixo de", "×", { step: 0.1 })) +
      GRP("Faixas de referência") + faixas + GRP(`Eficiência por tipologia ${INFO("Faixa de eficiência global (área privativa ÷ construída) esperada para cada tipo de produto. O Gabarito detecta o tipo pelo projeto; abaixo da faixa o semáforo muda.")}`) + efic +
      GRP(`Detecção da tipologia ${INFO("Regras para escolher a faixa de eficiência: studios se a área média das unidades fica abaixo do limite; sem elevador se nenhuma torre passa do número de andares; muito lazer se o lazer passa dessa fração da área construída. Sem nenhuma delas: garagem em pavimento (garagem elevada ou sem subsolo) ou em subsolo.")}`) +
      KV(NUM("metas.deteccao.studioM2", "Studio até", "m²", { step: 1 }) + NUM("metas.deteccao.walkupPav", "Sem elevador até", "andares", { step: 1, int: true, min: 1 }) +
        NUM("metas.deteccao.lazerPct", "Muito lazer desde", "% da ATC", { pct: true, step: 1 }), 3), { key: "metas" }),
    { key: "metas", cls: "fq", info: "Metas", sum: "" });
}
function finMetasSum(){
  const F = S.fin, M = S.metas;
  setSum("metas", `margem <b>${pct(F.margemAlvo, 0)}</b> · TIR <b>${pct(M.tir.alvo, 0)}</b> · V/C ≥ ${nf(M.vc.min, 1)}`);
}

Object.assign(ACT, {
  metasPadrao: () => { if(saudeSalvarPadrao(S)){ toast("Metas salvas como padrão da empresa — estudos novos começam com elas") } else toast("Não foi possível gravar neste navegador") },
  metasSug: () => { saudeAplicarSugeridas(S); renderTab(); save(); toast("Metas sugeridas restauradas") },
  metasEmpresa: () => { if(saudeAplicarPadrao(S)){ renderTab(); save(); toast("Padrão da empresa aplicado") } },
  zerarTerreno: () => { S.fin.terreno = 0; renderTab(); toast("Terreno zerado: o valor do lote agora vem só da permuta física") },
});
/* ao ligar a permuta física com o terreno preenchido: aviso na hora (o aviso fixo fica na Saúde do negócio e no campo) */
Object.assign(FX, {
  permuta: live => { FX.upd(live); if(!live && S.fin.permuta > 0 && S.fin.terreno > 0) toast("Permuta física com terreno preenchido: o terreno pode estar contado duas vezes. Use “Zerar terreno”.") }
});
/* aviso sob o campo "Permuta física" (Premissas › Receita) */
function saudePermutaSub(){
  const F = S.fin;
  setSub("fin.permuta", F.permuta > 0 && F.terreno > 0
    ? `<span class="note" style="color:var(--warn)">Terreno também lançado (${mi(F.terreno)}).</span> <button type="button" class="btn sm ghost" data-act="zerarTerreno">Zerar terreno</button>` : "");
}
