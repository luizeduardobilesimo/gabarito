/* ================= Fase D: interface das Alavancas e do Potencial do terreno =================
   Cálculo em src/calc/alavancas.js (alavancasCalc) e src/optim.js (potencial). Aqui só marcação.
   - Seção "O que melhora o resultado" (key "alavancas", Viabilidade › Riscos, logo depois do RES; UX v3 §4.3): aberta por padrão,
     calculada SÓ quando a seção está aberta (finVis) e fora do arraste; mesmo padrão dos Cenários e da Sensibilidade. Cada linha muda uma coisa e mostra Δ lucro, Δ margem s/ VGV e Δ TIR. Os passos ficam em "Mais opções".
   - potInfoHTML(po) / potNotaHTML(po): ⓘ e a linha "só pelo andar" do card "Potencial do terreno" (Produto) — chamados de src/ui/produto.js. */

const ALAV_UI = { sig: null };
{ const st = document.createElement("style"); st.id = "alavCSS"; st.textContent = `.alav td:first-child{white-space:normal;padding-right:8px}.alav td:not(:first-child),.alav th:not(:first-child){padding-left:4px;font-size:11px}.alav .fsub{white-space:normal;line-height:1.35}.alav .info{margin-left:4px;vertical-align:1px}.alav tr.alav-no td{color:var(--muted)}`; document.head.appendChild(st) }
const alavSinal = (v, f) => v == null ? `<span style="color:var(--muted)">—</span>` : `<span style="color:${Math.abs(v) < 1e-9 ? "var(--muted)" : v > 0 ? "var(--ok)" : "var(--bad)"}">${f(v)}</span>`;
const alavMi = v => (v < 0 ? "−" : "+") + mi(Math.abs(v));
const alavPP = v => (v < 0 ? "−" : "+") + nf(Math.abs(v) * 100, 1) + " p.p.";

const ALAV_INFO = {
  efic: () => `Eficiência do andar: quanto do pavimento tipo vira área vendável (hoje ${pct(S.produto.efic, 0)}). Aumentar ${nf(S.alavancas.efic * 100, 0)}% (relativo) mantém a mesma planta, a mesma área construída e o mesmo custo, mas cada andar entrega esse tanto a mais de área privativa (paredes e circulação mais enxutas): as unidades crescem, ao mesmo preço por m².`,
  preco: () => `Preço de tabela ${nf(S.alavancas.preco * 100, 0)}% maior em todas as tipologias, lojas e coberturas. O custo da obra não muda; corretagem, marketing e impostos acompanham o VGV.`,
  terreno: () => `Terreno ${nf(S.alavancas.terreno * 100, 0)}% mais barato, no preço à vista e nas permutas física e financeira (o ITBI acompanha). É o que a negociação da compra pode render.`,
  obra: () => `Custo de obra ${nf(S.alavancas.obra * 100, 0)}% menor (CUB, lazer e movimento de terra); projetos, administração e contingência acompanham.`,
  pav: () => `Mais ${S.alavancas.pav > 1 ? S.alavancas.pav + " pavimentos" : "um pavimento"} tipo em cada torre, se couber no gabarito, no CA e no terreno. Estimativa pela massa do prédio, sem o layout da garagem; mais unidades exigem mais vagas.`,
};

function alavHTML() {
  const sub = (k, l, o = {}) => NUM(`alavancas.${k}`, l, o.u || "%", Object.assign({ pct: !o.int, int: !!o.int, step: o.int ? 1 : 1, min: o.int ? 1 : 0, max: o.int ? 5 : 0.5, fx: "alav" }, o));
  return SEC("O que melhora o resultado",
    `<div id="alavBox"><p class="note">Calculando…</p></div>` +
    ADV(KV(sub("efic", "Eficiência") + sub("preco", "Preço") + sub("terreno", "Terreno") + sub("obra", "Obra") + sub("pav", "Pavimentos", { u: "por torre", int: true }), 3), { key: "alav" }),
    { key: "alavancas", open: true, info: "Alavancas", sum: "toque para calcular" });
}

function alavLinhasHTML(r) {
  const th = (t, w) => `<th style="min-width:0;${w ? `width:${w}` : ""};white-space:nowrap">${t}</th>`;
  const lin = (l, i) => {
    const nome = `<td><b>${esc(l.nome)}</b>${INFO(ALAV_INFO[l.k]())}<div class="fsub">${esc(l.ok ? (l.desc || "") : l.motivo)}</div></td>`;
    if (!l.ok) return `<tr class="alav-no">${nome}<td colspan="3">não se aplica</td></tr>`;
    return `<tr>${nome}<td${i === 0 ? ' style="font-weight:600"' : ""}>${alavSinal(l.d.lucro, alavMi)}</td><td>${alavSinal(l.d.margem, alavPP)}</td><td>${alavSinal(l.d.tir, alavPP)}</td></tr>`;
  };
  return `<table class="tbl multi alav" style="table-layout:fixed"><tr>${th("", "36%")}${th("Lucro")}${th("Margem")}${th("Retorno")}</tr>${r.linhas.map(lin).join("")}</table>`;
}

function alavLive(m, f, fast) {
  const box = document.getElementById("alavBox"); if (!box) return;
  if (!finVis("alavBox")) return;                          // seção fechada: nada é calculado
  if (fast && ALAV_UI.sig) return;                          // arraste de controle: mantém o último resultado
  m = m || (window._last && window._last.m); if (!m) return;
  let r; try { r = alavancasCalc(S, m) } catch (e) { box.innerHTML = `<p class="note">Não foi possível calcular as alavancas.</p>`; console.error("[alavancas]", e); return }
  ALAV_UI.sig = true;
  setHTML("alavBox", alavLinhasHTML(r));
  const b = r.melhor;
  setSum("alavancas", b ? `maior efeito: <b>${esc(b.nome)}</b> ${alavMi(b.d.lucro)}` : "nenhuma se aplica");
}
FX.alav = () => { save(); ALAV_UI.sig = null; alavLive() };
addCard("viab", { key: "alavancas", sub: "risco", order: 10, html: alavHTML, live: alavLive });

/* ---------- Potencial do terreno (Produto): eficiência global em vez de só a do andar ---------- */
function potInfoHTML(po) {
  return INFO(`Área que o CA e o gabarito (${nf(po.hLim, 0)} m) permitem construir, vezes a eficiência global do estudo (${pct(po.eficGlobal, 1)} = área privativa ÷ área total construída, com subsolos, térreo e lazer). Pela eficiência do andar (${pct(S.produto.efic, 0)}) a conta daria ${m2(po.priv0)}, mas ela não desconta garagem, hall nem áreas comuns e superestima.`, "o potencial");
}
function potNotaHTML(po) {
  if (!(po.priv0 > 0) || !(po.priv > 0)) return "";
  const dif = po.priv0 / po.priv - 1;
  if (Math.abs(dif) < 0.02) return "";                       // diferença pequena: nada a avisar
  return `<p class="note" style="grid-column:1/-1;margin-top:6px">Só pelo andar: <b>${m2(po.priv0)}</b> <span style="color:${dif > 0 ? "var(--warn)" : "var(--muted)"}">(${dif > 0 ? "+" : "−"}${nf(Math.abs(dif) * 100, 0)}%)</span></p>`;
}
