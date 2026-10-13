/* ================= Fase A: "Saúde do negócio" — indicadores da colinha de viabilidade =================
   Cálculo puro (roda na página, no Worker e nos testes; nada de DOM). A página calcula `finance()` sobre o `m` que o Worker
   devolve, e este módulo lê só campos de `m` e `f` que atravessam o clone estruturado (números e listas simples).

   saudeNegocio(st, m, f) → {
     eficGlobal  área privativa ÷ área total construída (ATC = m.constr, subsolos incluídos)
     margemVGV   lucro ÷ VGV (convenção do mercado — margem principal) · margemReceita = lucro ÷ receita nominal
     vc, vcCUB   preço médio R$/m² privativo ÷ (CUB × fator)  ·  ÷ CUB puro
     terrenoPctVGV  (preço do terreno + permuta física + permuta financeira) ÷ VGV de tabela — sem ITBI
     softPctVGV  indiretos ÷ VGV líquido: projetos, administração, contingência, corretagem, marketing, RET, ITBI, outorga, juros e os itens de src/calc/indiretos.js
     custoM2ATC  obra (sem INCC e sem indiretos) ÷ ATC
     tirVsAlvo   TIR − TIR alvo (null sem TIR)
     tipologia / tipologiaNome / faixaEfic   tipologia detectada para a faixa de eficiência (ver saudeTipologia)
     nivel       { efic, margem, tir, vc, terreno, soft } → 'ruim' | 'atencao' | 'ok' | 'otimo' (lidos de st.metas)
     avisos      [{k, txt}] (permuta dupla, custo financeiro desligado, contingência abaixo da faixa…) }

   TODAS as metas, mínimos e faixas moram em S.metas (por estudo) e podem ser salvas como padrão da empresa
   (localStorage "gabarito.metas.padrao" — ver ui/metas.js; troca por Supabase em docs/BACKEND.md). Os números abaixo são só a SUGESTÃO
   (colinha de viabilidade). A margem alvo e a TMA continuam em S.fin.margemAlvo / S.fin.tma (fonte única, usadas pelo fluxo e pelo terreno máximo). */
const SAUDE_SUGERIDAS = {
  margem:   { min: 0.20, otimo: 0.30 },                 // alvo = S.fin.margemAlvo (25%) · abaixo do mínimo "não toque"
  tir:      { alvo: 0.25, otimo: 0.30 },                // a TMA (S.fin.tma) é o piso: abaixo dela a TIR é ruim
  vc:       { ruim: 2.0, min: 2.5, bom: 3.5 },          // preço ÷ custo: <ruim ruim · <min cuidado · min–bom saudável · ≥bom excelente
  terreno:  { ok: 0.15, max: 0.20 },                    // terreno ÷ VGV: até ok bom · até max atenção · acima compromete
  soft:     { min: 0.18, max: 0.22 },                   // indiretos ÷ VGV: faixa esperada
  imprev:   { min: 0.05, max: 0.10 },                   // contingência sobre a obra (S.fin.conting)
  efic:     { subsolo: [0.50, 0.58], pavDedicado: [0.55, 0.62], lazer: [0.45, 0.52], walkup: [0.65, 0.75], studios: [0.60, 0.68] },
  deteccao: { studioM2: 35, walkupPav: 4, lazerPct: 0.06 }   // heurística da tipologia (ver saudeTipologia)
};
/* sugeridas de S.fin que fazem parte das metas (o resto de S.fin é premissa do estudo, não meta) */
const SAUDE_FIN_SUGERIDO = { tma: 0.15, margemAlvo: 0.25 };
const SAUDE_TIPOS = { subsolo: "garagem em subsolo", pavDedicado: "garagem em pavimento", lazer: "muito lazer", walkup: "sem elevador", studios: "studios" };

/* padrão da empresa (gravado por ui/metas.js): { metas, fin:{tma,margemAlvo}, salvo } — lido uma vez no carregamento; no Worker/Node não há localStorage e vale a sugestão */
function saudePadraoEmpresa(){ const v = LS.get("gabarito.metas.padrao"); return v && typeof v==="object" && v.metas ? v : null }
extendDEF("metas", merge(clone(SAUDE_SUGERIDAS), (saudePadraoEmpresa()||{}).metas));
{ // tma e margem alvo do padrão da empresa: valem para estudos novos e para estudos antigos que nunca tiveram esses campos
  const p = saudePadraoEmpresa(), sv = LS.get("gabarito.v2");
  if(p && p.fin) Object.keys(SAUDE_FIN_SUGERIDO).forEach(k=>{ if(typeof p.fin[k]==="number"){ DEF.fin[k]=p.fin[k]; if(!(sv && sv.fin && typeof sv.fin[k]==="number")) S.fin[k]=p.fin[k] } });
}

const saudeDiv = (a, b) => b > 0 && isFinite(a / b) ? a / b : 0;
const saudeOk = v => v != null && isFinite(v);

/* tipologia detectada (define a faixa de eficiência). Em ordem de prioridade:
   1. studios      — área média das unidades residenciais ≤ metas.deteccao.studioM2 (35 m²)
   2. walkup       — nenhuma torre passa de metas.deteccao.walkupPav andares-tipo (4): prédio sem elevador
   3. lazer        — lazer (coberto + descoberto) ≥ metas.deteccao.lazerPct da ATC (6%)
   4. pavDedicado  — garagem em pavimentos (garagem elevada ≥ subsolos) ou sem subsolo
   5. subsolo      — o resto (garagem em subsolos) */
function saudeTipologia(st, m){
  const D = (st.metas && st.metas.deteccao) || SAUDE_SUGERIDAS.deteccao, P = st.produto;
  const mediaApto = saudeDiv(m.privRes != null ? m.privRes : m.priv, m.unitsRes || m.units);
  const maxPav = Math.max(0, ...(m.T || []).map(t => +t.pav || 0));
  const lazer = ((m.lz && m.lz.c) || 0) + ((m.lz && m.lz.d) || 0);
  if(mediaApto > 0 && mediaApto <= D.studioM2) return "studios";
  if(maxPav > 0 && maxPav <= D.walkupPav) return "walkup";
  if(saudeDiv(lazer, m.constr) >= D.lazerPct) return "lazer";
  if((P.garAcima || 0) > 0 && (P.garAcima || 0) >= (P.subsolos || 0)) return "pavDedicado";
  if(!(P.subsolos > 0)) return "pavDedicado";
  return "subsolo";
}

/* semáforos — todos leem de st.metas (e de S.fin.margemAlvo / S.fin.tma) */
function saudeNivel(k, v, st, extra={}){
  const M = st.metas || SAUDE_SUGERIDAS, F = st.fin;
  if(!saudeOk(v)) return "ruim";
  if(k === "margem"){ const a = F.margemAlvo, mn = Math.min(M.margem.min, a); return v < mn ? "ruim" : v < a ? "atencao" : v >= Math.max(M.margem.otimo, a) ? "otimo" : "ok" }
  if(k === "tir"){ const a = M.tir.alvo; return v < F.tma ? "ruim" : v < a ? "atencao" : v >= Math.max(M.tir.otimo, a) ? "otimo" : "ok" }
  if(k === "vc"){ const c = M.vc; return v < c.ruim ? "ruim" : v < c.min ? "atencao" : v >= c.bom ? "otimo" : "ok" }
  if(k === "terreno"){ const c = M.terreno; return v <= c.ok ? "ok" : v <= c.max ? "atencao" : "ruim" }
  if(k === "soft"){ const c = M.soft, w = Math.max(0.005, c.max - c.min); return v >= c.min && v <= c.max ? "ok" : v < c.min - w || v > c.max + w ? "ruim" : "atencao" }   // fora da faixa por mais de uma largura de faixa = ruim
  if(k === "efic"){ const [mn, mx] = extra.faixa || [0, 0], w = Math.max(0.01, mx - mn); return v >= mx ? "otimo" : v >= mn ? "ok" : v >= mn - w ? "atencao" : "ruim" }   // abaixo da faixa por mais de uma largura = ruim
  if(k === "imprev"){ const c = M.imprev; return v < c.min * 0.5 ? "ruim" : v < c.min ? "atencao" : "ok" }
  return "ok";
}

function saudeNegocio(st, m, f){
  const M = st.metas || SAUDE_SUGERIDAS, F = st.fin, atc = +m.constr || 0, priv = +m.priv || 0;
  const eficGlobal = saudeDiv(priv, atc);
  const margemVGV = saudeOk(f.margemVGV) ? f.margemVGV : saudeDiv(f.lucro, f.vgv), margemReceita = saudeOk(f.margemReceita) ? f.margemReceita : f.margem;
  // V/C: preço de tabela por m² privativo ÷ custo de referência (CUB × fator; no orçamento paramétrico o fator vem do custo calculado)
  const precoM2 = saudeDiv(f.vgvB, priv);
  const par = st.orc && st.orc.modo === "param";
  const fator = par && f.eqA > 0 && F.cub > 0 ? saudeDiv(f.obra, f.eqA * F.cub) : F.fator;
  const custoRefM2 = F.cub * fator, vc = saudeDiv(precoM2, custoRefM2), vcCUB = saudeDiv(precoM2, F.cub);
  // terreno: permuta física e financeira contam como terreno equivalente; denominador = VGV de tabela (o total do empreendimento)
  const terrenoEq = (f.terrenoPreco != null ? f.terrenoPreco : F.terreno) + (f.permV || 0) + (f.permFin || 0);
  const terrenoPctVGV = saudeDiv(terrenoEq, f.vgvB);
  const soft = (f.projetos || 0) + (f.adm || 0) + (f.conting || 0) + (f.corret || 0) + (f.mkt || 0) + (f.imp || 0) + (f.itbi || 0) + (f.outorga || 0) + (f.juros || 0) + (f.soft || 0);   // f.soft = registro, seguros, IPTU, jurídico, pós-obra e gestão (src/calc/indiretos.js; 0 quando desligados)
  const softPctVGV = saudeDiv(soft, f.vgv);
  const custoM2ATC = saudeDiv(f.obra, atc);
  const tipologia = saudeTipologia(st, m), faixaEfic = (M.efic && M.efic[tipologia]) || SAUDE_SUGERIDAS.efic[tipologia];
  const tirVsAlvo = saudeOk(f.tirA) ? f.tirA - M.tir.alvo : null;
  const nivel = {
    efic: saudeNivel("efic", eficGlobal, st, { faixa: faixaEfic }), margem: saudeNivel("margem", margemVGV, st),
    tir: saudeNivel("tir", f.tirA, st), vc: saudeNivel("vc", vc, st), terreno: saudeNivel("terreno", terrenoPctVGV, st), soft: saudeNivel("soft", softPctVGV, st)
  };
  const avisos = [];
  if(F.terreno > 0 && F.permuta > 0) avisos.push({ k: "permutaDupla", txt: `Permuta física e terreno juntos: o terreno pode estar contado 2×.` });
  if(!F.finOn) avisos.push({ k: "semFinanc", txt: "Custo financeiro desligado: o resultado não inclui juros." });
  const imprev = F.conting;
  if(saudeNivel("imprev", imprev, st) !== "ok") avisos.push({ k: "imprev", txt: `Contingência ${nf(imprev * 100, 1)}% da obra, abaixo de ${nf(M.imprev.min * 100, 0)}–${nf(M.imprev.max * 100, 0)}%.` });
  return { eficGlobal, margemVGV, margemReceita, vc, vcCUB, precoM2, custoRefM2, terrenoPctVGV, terrenoEq, softPctVGV, soft, custoM2ATC, tirVsAlvo, tipologia, tipologiaNome: SAUDE_TIPOS[tipologia], faixaEfic, nivel, avisos, imprev, atc, priv };
}
/* ---------- metas: sugeridas e padrão da empresa (a interface fica em ui/saude.js) ---------- */
/* "Restaurar sugeridas": metas da colinha + TMA 15% e margem alvo 25% */
function saudeAplicarSugeridas(st){ st.metas = clone(SAUDE_SUGERIDAS); Object.assign(st.fin, SAUDE_FIN_SUGERIDO); return st }
/* "Salvar como padrão": grava as metas do estudo como padrão da empresa e já vale para estudos novos (DEF). Devolve false sem localStorage */
function saudeSalvarPadrao(st){
  const reg = { metas: clone(st.metas), fin: { tma: st.fin.tma, margemAlvo: st.fin.margemAlvo }, salvo: new Date().toISOString() };
  try{ localStorage.setItem("gabarito.metas.padrao", JSON.stringify(reg)) }catch(e){ return false }
  DEF.metas = clone(reg.metas); DEF.fin.tma = reg.fin.tma; DEF.fin.margemAlvo = reg.fin.margemAlvo;
  return true;
}
/* "Padrão da empresa": traz o padrão gravado para o estudo atual */
function saudeAplicarPadrao(st){
  const p = saudePadraoEmpresa(); if(!p) return false;
  st.metas = merge(clone(SAUDE_SUGERIDAS), clone(p.metas)); if(p.fin) Object.keys(SAUDE_FIN_SUGERIDO).forEach(k=>{ if(typeof p.fin[k]==="number") st.fin[k] = p.fin[k] });
  return true;
}
/* pior semáforo de uma lista (para resumos) */
const SAUDE_ORDEM = { ruim: 0, atencao: 1, ok: 2, otimo: 3 };
function saudePior(niveis){ return niveis.reduce((a, b) => SAUDE_ORDEM[b] < SAUDE_ORDEM[a] ? b : a, "otimo") }

/* Lucro após imprevistos (informativo, não muda o lucro principal): se a contingência do estudo (S.fin.conting) está abaixo da meta de imprevistos
   (S.metas.imprev.min–max), a diferença × obra (com a correção do INCC que a obra já leva) sai do lucro. Devolve a faixa { min, max }. */
function saudeImprevistos(st, f){
  const M = (st.metas && st.metas.imprev) || SAUDE_SUGERIDAS.imprev, base = (f.obra || 0) + (f.adm || 0) + (f.conting || 0);
  const incc = base > 0 ? (f.obraTot || base) / base : 1;
  const calc = meta => { const extra = Math.max(0, meta - (st.fin.conting || 0)) * (f.obra || 0) * incc, lucro = f.lucro - extra;
    return { meta, extra, lucro, margemVGV: saudeDiv(lucro, f.vgv) } };
  return { min: calc(M.min), max: calc(M.max) };
}

/* o resultado acompanha o `f` (barato; roda também na sensibilidade com os ajustes de cada rodada) */
HOOK.finance.push((f, st, m) => { f.saude = saudeNegocio(st, m, f); f.imprevistos = saudeImprevistos(st, f) });
