/* ================= Fase E: calibrar o custo da obra com obras reais =================
   Cálculo puro (roda na página, no Worker e nos testes; nada de DOM). A interface está em src/ui/calibracusto.js.

   O estudo estima a obra como  (área equivalente) × CUB × fator,  com
     área equivalente = torre/tipo + lazer coberto + garagem × eqGar   (o que o app faz em finance(): eqA = … + garA × fin.eqGar)
   Cada obra realizada dá uma equação:  custo ÷ CUB(da obra) = fator × (torre + lazer) + (fator × eqGar) × garagem.
   Com uma obra só dá para ajustar o fator (eqGar fica como está). Com duas ou mais, os dois saem de mínimos quadrados
   ponderados (erro relativo: uma obra grande não "engole" uma pequena).

   S.ccal = { obras:[{nome, ref:"AAAA-MM", uf, padrao, cub, priv, torre, garagem, lazer, custo}] }   (cub vazio/0 = tabela do estado e padrão)

   ccalCusto(obras, cubDe, opts) → {
     n, modo ("fator" | "fator+garagem" | null), fator, eqGar, r2 (null com 1 obra), erroMedio, erros:[{nome, real, previsto, erro, cub, nota?}],
     ignoradas:[{nome, motivo}], avisos:[texto], anterior:{fator, eqGar} }
   "Padrão da empresa": localStorage "gabarito.custo.padrao" ({fator, eqGar, obras, salvo}) — a interface não muda quando isso for para o Supabase (docs/BACKEND.md).  */
extendDEF("ccal", { obras: [] });

/* limites do ajuste e faixa usual da NBR 12.721 (coeficiente de equivalência de garagem); tudo configurável aqui, nada espalhado no código */
const CCAL_FAIXAS = {
  eqGar: { min: 0.3, max: 1.2 },          // o ajuste não sai daqui (se sair, o peso trava no limite e o fator é refeito)
  eqGarNBR: { min: 0.5, max: 1.0 },       // faixa usual: fora dela, aviso
  fator: { min: 0.6, max: 2.5 },          // fora disso é quase certo erro de unidade/área: aviso
  colineares: 1e-6                         // determinante relativo abaixo disso = garagem proporcional à torre em todas as obras
};
const CCAL_CAMPOS = ["nome", "ref", "uf", "padrao", "cub", "priv", "torre", "garagem", "lazer", "custo"];
const ccalObraVazia = () => ({ nome: "", ref: "", uf: "", padrao: "", cub: 0, priv: 0, torre: 0, garagem: 0, lazer: 0, custo: 0 });

function ccalCusto(obras, cubDe, opts = {}){
  const L = CCAL_FAIXAS, ant = { fator: opts.fator != null ? opts.fator : 1.2, eqGar: opts.eqGar != null ? opts.eqGar : 0.8 };
  const avisos = [], ignoradas = [], usadas = [];
  (obras || []).forEach((o, i) => {
    const nome = o.nome || `Obra ${i + 1}`, x1 = (+o.torre || 0) + (+o.lazer || 0), x2 = +o.garagem || 0, custo = +o.custo || 0;
    let c = typeof cubDe === "function" ? cubDe(o) : (+o.cub || 0), nota = null;
    if(c && typeof c === "object"){ nota = c.aviso || null; c = c.v }
    if(!(custo > 0)) return ignoradas.push({ nome, motivo: "sem custo realizado" });
    if(!(x1 + x2 > 0)) return ignoradas.push({ nome, motivo: "sem áreas de torre, garagem ou lazer" });
    if(!(c > 0)) return ignoradas.push({ nome, motivo: "sem CUB (informe o valor ou o estado e o padrão)" });
    usadas.push({ nome, x1, x2, custo, cub: c, y: custo / c, nota });
  });
  const n = usadas.length;
  const res = { n, modo: null, fator: ant.fator, eqGar: ant.eqGar, r2: null, erroMedio: null, erros: [], ignoradas, avisos, anterior: ant };
  if(!n) return res;

  const ajusta1 = eq => { let num = 0, den = 0;                       // fator com eqGar fixo: mínimos quadrados relativos
    usadas.forEach(u => { const a = u.x1 + eq * u.x2; num += a / u.y; den += (a / u.y) * (a / u.y) });
    return den > 0 ? num / den : null };
  let fator = null, eqGar = ant.eqGar, modo = "fator";
  if(n >= 2){
    let s11 = 0, s12 = 0, s22 = 0, t1 = 0, t2 = 0;                    // normais com pesos 1/y²
    usadas.forEach(u => { const w = 1 / (u.y * u.y); s11 += w * u.x1 * u.x1; s12 += w * u.x1 * u.x2; s22 += w * u.x2 * u.x2; t1 += w * u.x1 * u.y; t2 += w * u.x2 * u.y });
    const det = s11 * s22 - s12 * s12;
    if(s11 > 0 && s22 > 0 && det / (s11 * s22) > L.colineares){
      const a = (t1 * s22 - t2 * s12) / det, b = (s11 * t2 - s12 * t1) / det;
      if(a > 0 && b > 0){
        const e = b / a;
        if(e < L.eqGar.min || e > L.eqGar.max){
          eqGar = Math.min(L.eqGar.max, Math.max(L.eqGar.min, e)); fator = ajusta1(eqGar);
          avisos.push(`O peso da garagem ajustado (${ccalNum(e)}) ficou fora do limite ${ccalNum(L.eqGar.min)}–${ccalNum(L.eqGar.max)}; travei em ${ccalNum(eqGar)} e refiz o fator. Confira as áreas de garagem das obras.`);
        } else { eqGar = e; fator = a }
        modo = "fator+garagem";
        if(n === 2) avisos.push("Com 2 obras o ajuste é exato (R² = 1 não prova nada). Quanto mais obras, mais confiável.");
      } else avisos.push("As obras não permitiram separar o peso da garagem (resultado negativo): ajustei só o fator.");
    } else avisos.push("Garagem proporcional à torre em todas as obras: não dá para separar o peso da garagem. Ajustei só o fator.");
  } else avisos.push("Com uma obra só ajusto o fator; o peso da garagem fica como está. Com duas ou mais obras ajusto os dois.");
  if(fator == null) fator = ajusta1(eqGar);
  if(!(fator > 0)){ avisos.push("Não consegui ajustar com esses dados."); return res }

  if(fator < L.fator.min || fator > L.fator.max) avisos.push(`Fator ${ccalNum(fator)}× fora do usual (${ccalNum(L.fator.min)}–${ccalNum(L.fator.max)}×): confira áreas, custos e o CUB de cada obra.`);
  if(modo === "fator+garagem" && (eqGar < L.eqGarNBR.min || eqGar > L.eqGarNBR.max)) avisos.push(`Peso da garagem ${ccalNum(eqGar)} fora da faixa usual da NBR 12.721 (${ccalNum(L.eqGarNBR.min)}–${ccalNum(L.eqGarNBR.max)}).`);
  usadas.forEach(u => { if(u.nota) avisos.push(`${u.nome}: ${u.nota}`) });

  // erro por obra, R² (sobre o custo em R$) e erro médio absoluto
  const prev = usadas.map(u => u.cub * fator * (u.x1 + eqGar * u.x2));
  res.erros = usadas.map((u, i) => ({ nome: u.nome, real: u.custo, previsto: prev[i], erro: prev[i] / u.custo - 1, cub: u.cub, nota: u.nota }));
  res.erroMedio = res.erros.reduce((s, e) => s + Math.abs(e.erro), 0) / n;
  if(n >= 2){ const media = usadas.reduce((s, u) => s + u.custo, 0) / n, sst = usadas.reduce((s, u) => s + (u.custo - media) ** 2, 0), sse = usadas.reduce((s, u, i) => s + (u.custo - prev[i]) ** 2, 0);
    res.r2 = sst > 0 ? 1 - sse / sst : null }
  Object.assign(res, { modo, fator, eqGar });
  return res;
}
const ccalNum = (v, d = 2) => (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toString().replace(".", ",");

/* aplica o resultado ao estudo (fator sempre; eqGar só quando foi ajustado). Devolve o que mudou */
function ccalAplica(st, res){
  if(!res || !res.modo) return null;
  const mud = { fator: [st.fin.fator, Math.round(res.fator * 1000) / 1000] };
  st.fin.fator = mud.fator[1];
  if(res.modo === "fator+garagem"){ mud.eqGar = [st.fin.eqGar, Math.round(res.eqGar * 1000) / 1000]; st.fin.eqGar = mud.eqGar[1] }
  return mud;
}

/* modo paramétrico: escala os 3 coeficientes de maior peso do orçamento (fundação, estrutura, vedações, fachada, instalações, elevadores,
   acabamentos) para que o direto do orçamento bata com o que "CUB × fator calibrado" daria neste estudo. s limitado a [0,5; 2]. */
const CCAL_COEF = ["fund", "estr", "ved", "fach", "inst", "elev", "acab"];
function ccalParam(st, m, res){
  if(!res || !res.modo || !m) return null;
  const o = orcCalc(st, m), K = o.coef, C = o.C;
  const eqA = m.tiposA + m.duplexA + m.hallA + m.lojaA + m.aticoA + (m.lzExtraA || 0) + m.garA * (res.modo === "fator+garagem" ? res.eqGar : st.fin.eqGar) + (m.sacBal || 0) * 0.5;
  const alvo = eqA * C * res.fator;                                    // direto que o modo CUB × fator daria
  const pesos = CCAL_COEF.map(k => ({ k, v: (o.itens.find(i => i.k === k) || {}).param || 0 })).sort((a, b) => b.v - a.v).slice(0, 3).filter(p => p.v > 0);
  const top = pesos.reduce((s, p) => s + p.v, 0); if(!(top > 0)) return null;
  const soma = o.direto / (1 + K.cant), s = Math.min(2, Math.max(0.5, 1 + (alvo / (1 + K.cant) - soma) / top));
  const coef = { ...K }; pesos.forEach(p => { coef[p.k] = K[p.k] * s; if(p.k === "inst") coef.instUn = K.instUn * s });
  return { chaves: pesos.map(p => p.k), s, coef, alvo, antes: o.direto };
}

/* ---------- importação CSV (planilha exportada) ---------- */
const ccalNorm = s => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9/]+/g, " ").trim();
const CCAL_ALIAS = {
  nome: ["nome", "obra", "empreendimento"], ref: ["mes", "mes/ano", "ref", "data", "competencia", "mes ano"], uf: ["uf", "estado"], padrao: ["padrao", "cub padrao", "padrao cub"],
  cub: ["cub", "cub r$/m2", "cub m2", "cub r m2", "valor do cub"], priv: ["priv", "privativa", "area privativa", "area priv"], torre: ["torre", "tipo", "torre/tipo", "area torre", "area tipo", "area da torre"],
  garagem: ["garagem", "subsolo", "garagem/subsolo", "area garagem", "area de garagem"], lazer: ["lazer", "lazer coberto", "area lazer", "area de lazer coberto"], custo: ["custo", "custo total", "custo realizado", "custo final"]
};
/* "r8n" · "R 8-N" · "pp4 n" → "R8-N" (texto que não reconhece volta em maiúsculas) */
function ccalPadrao(s){ const t = String(s == null ? "" : s).toUpperCase().replace(/[^A-Z0-9]/g, ""), m = /^(R1|R8|R16|PP4)([BNA])$/.exec(t);
  return m ? (m[1] === "PP4" ? "PP-4" : m[1]) + "-" + m[2] : t === "PIS" ? "PIS" : String(s == null ? "" : s).trim().toUpperCase() }
/* "03/2026" · "2026-03" · "mar/2026" → "2026-03" (texto que não reconhece volta como veio) */
function ccalRef(s){
  const t = ccalNorm(s); let m;
  if((m = /^(\d{4})[-/ ](\d{1,2})$/.exec(t))) return m[1] + "-" + String(m[2]).padStart(2, "0");
  if((m = /^(\d{1,2})[-/ ](\d{4})$/.exec(t))) return m[2] + "-" + String(m[1]).padStart(2, "0");
  if((m = /^([a-z]{3})[a-z]*[-/ ](\d{4})$/.exec(t))){ const i = CUB_MESES.indexOf(m[1]); if(i >= 0) return m[2] + "-" + String(i + 1).padStart(2, "0") }
  return String(s == null ? "" : s).trim();
}
/* número da planilha: "5.200" · "32.500.000" · "2.650,00" · "2650.5" · "R$ 1,5" */
function ccalNumBR(s){
  if(typeof s === "number") return s;
  let t = String(s == null ? "" : s).trim().replace(/[R$\s]/g, ""); if(!t) return null;
  if(t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if(/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const v = parseFloat(t); return isFinite(v) ? v : null;
}
function ccalParse(text){
  const t = String(text || "").replace(/^﻿/, "").trim(); if(!t) return [];
  const lines = t.split(/\r?\n/).filter(l => l.trim()); if(lines.length < 2) return [];
  const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length && (lines[0].match(/;/g) || []).length ? ";" : (lines[0].match(/\t/g) || []).length ? "\t" : ",";
  const head = lines[0].split(sep).map(ccalNorm), col = {};
  Object.keys(CCAL_ALIAS).forEach(k => { const i = head.findIndex(h => CCAL_ALIAS[k].map(ccalNorm).includes(h)); if(i >= 0) col[k] = i });
  if(col.custo == null) return [];
  return lines.slice(1).map(l => {
    const c = l.split(sep), g = k => col[k] == null ? "" : String(c[col[k]] == null ? "" : c[col[k]]).trim().replace(/^"|"$/g, ""), n = k => ccalNumBR(g(k)) || 0;
    const o = { ...ccalObraVazia(), nome: g("nome"), ref: ccalRef(g("ref")), uf: g("uf").toUpperCase(), padrao: ccalPadrao(g("padrao")), cub: n("cub"), priv: n("priv"), torre: n("torre"), garagem: n("garagem"), lazer: n("lazer"), custo: n("custo") };
    return o;
  }).filter(o => o.custo > 0 || o.torre > 0 || o.garagem > 0);
}
const CCAL_MODELO_CSV = "nome;mes;uf;padrao;cub;privativa;torre;garagem;lazer;custo\nEdifício Exemplo;2025-06;SC;R8-N;2650,00;5200;8400;3100;450;32500000\n";

/* ---------- padrão da empresa (localStorage; o Supabase troca só estas funções) ---------- */
function ccalPadraoEmpresa(){ const v = LS.get("gabarito.custo.padrao"); return v && typeof v === "object" && v.fator > 0 ? v : null }
function ccalSalvarPadrao(st, res){
  if(!res || !res.modo) return false;
  const reg = { fator: Math.round(res.fator * 1000) / 1000, eqGar: res.modo === "fator+garagem" ? Math.round(res.eqGar * 1000) / 1000 : st.fin.eqGar, obras: clone((st.ccal && st.ccal.obras) || []), n: res.n, salvo: new Date().toISOString() };
  try{ localStorage.setItem("gabarito.custo.padrao", JSON.stringify(reg)) }catch(e){ return false }
  DEF.fin.fator = reg.fator; DEF.fin.eqGar = reg.eqGar;                  // vale para estudos novos
  return true;
}
function ccalAplicarPadrao(st){
  const p = ccalPadraoEmpresa(); if(!p) return false;
  st.fin.fator = p.fator; st.fin.eqGar = p.eqGar; if(Array.isArray(p.obras) && !(st.ccal.obras || []).length) st.ccal.obras = clone(p.obras);
  return true;
}
{ // padrão da empresa vale para estudos novos e para estudos antigos que nunca gravaram esses campos (no Worker/Node não há localStorage: vale o padrão do app)
  const p = ccalPadraoEmpresa(), sv = LS.get("gabarito.v2");
  if(p){ ["fator", "eqGar"].forEach(k => { if(typeof p[k] === "number"){ DEF.fin[k] = p[k]; if(!(sv && sv.fin && typeof sv.fin[k] === "number")) S.fin[k] = p[k] } }) }
}
