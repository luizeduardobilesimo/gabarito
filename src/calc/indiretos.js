/* ================= Fase E: custos indiretos que faltavam (colinha de viabilidade) =================
   Registro/cartório, seguros, IPTU durante a obra, jurídico, assistência técnica pós-obra e taxa de gestão.
   Cálculo puro (roda na página, no Worker e nos testes). Todos nascem em 0 (desligados): os estudos já salvos e os de referência
   não mudam. "Usar sugeridos da colinha" (soft Sugeridos) liga todos de uma vez com os valores de mercado abaixo.

   S.soft = { registro, seguros, iptu, juridico, pos, gestao }   (frações; 0 = desligado)
   softCustos(st, ctx) → { total, itens:[{k,nome,base,valor}], mes:[R$ por mês do fluxo] } — a finance() soma `mes` ao fluxo de caixa.

   Quando cada um sai do caixa:
     registro  50% no mês anterior ao lançamento (registro da incorporação) e 50% nas chaves (instituição do condomínio e matrículas)
     seguros   igual por mês durante a obra, corrigido pelo INCC (acompanha o custo da obra)
     iptu      igual por mês, do mês 0 até as chaves
     juridico  igual por mês, do mês 0 até as chaves
     gestao    igual por mês durante a obra
     pos       igual por mês nos SOFT_POS_MESES meses seguintes às chaves, corrigido pelo INCC (o fluxo ganha esses meses a mais) */
const SOFT_POS_MESES = 12;
/* itens: base = sobre o que o percentual incide (vgv = VGV líquido da permuta física · obra = obra sem INCC · terreno = preço do terreno, por ano) */
const SOFT_ITENS = [
  { k: "registro", rot: "Registro e cartório", nome: "Registro e cartório",           base: "vgv",     un: "% VGV",          step: 0.05, q: "cartório incorporação matrícula emolumentos",
    desc: "Registro da incorporação, instituição do condomínio e matrículas das unidades. Metade sai antes do lançamento e metade nas chaves. Os emolumentos variam por estado." },
  { k: "seguros",  rot: "Seguros",             nome: "Seguros da obra",               base: "obra",    un: "% obra",         step: 0.05, q: "risco de engenharia garantia",
    desc: "Seguro de risco de engenharia e garantias da obra. Sai ao longo da obra." },
  { k: "iptu",     rot: "IPTU na obra",        nome: "IPTU durante a obra",           base: "terreno", un: "% terreno a.a.", step: 0.1,  q: "imposto predial lote",
    desc: "IPTU do terreno da compra até as chaves, sobre o preço do terreno (% ao ano). Zero quando o terreno vem só por permuta." },
  { k: "juridico", rot: "Jurídico",            nome: "Jurídico",                      base: "vgv",     un: "% VGV",          step: 0.05, q: "advogado contratos",
    desc: "Assessoria jurídica da incorporação: contratos, distratos e regularizações. Distribuído até as chaves." },
  { k: "pos",      rot: "Assistência pós-obra", nome: "Assistência técnica pós-obra", base: "obra",    un: "% obra",         step: 0.1,  q: "garantia pós-entrega reparos",
    desc: "Reserva para reparos e assistência técnica depois da entrega (garantia). Sai nos 12 meses seguintes às chaves." },
  { k: "gestao",   rot: "Taxa de gestão",      nome: "Taxa de gestão",                base: "vgv",     un: "% VGV",          step: 0.1,  q: "gestão do empreendimento overhead",
    desc: "Gestão do empreendimento pela incorporadora (equipe própria, overhead). A administração da obra já está em “Administração” (% obra): evite contar a mesma coisa duas vezes." }
];
/* valores sugeridos (referências de mercado — conferir com cartório, corretora de seguros e contabilidade da empresa) e faixas usuais citadas no ⓘ */
const SOFT_SUGERIDOS = { registro: 0.004, seguros: 0.003, iptu: 0.01, juridico: 0.003, pos: 0.01, gestao: 0.015 };
const SOFT_FAIXAS = {
  registro: [0.003, 0.006], seguros: [0.002, 0.005], iptu: [0.005, 0.015], juridico: [0.002, 0.005], pos: [0.005, 0.015], gestao: [0.01, 0.03]
};
extendDEF("soft", { registro: 0, seguros: 0, iptu: 0, juridico: 0, pos: 0, gestao: 0 });

/* meses que o fluxo precisa ganhar além das chaves */
function softMesesExtra(st){ return st && st.soft && +st.soft.pos > 0 ? SOFT_POS_MESES : 0 }

/* ctx = { obra (sem INCC), vgv (líquido), terreno (preço), launch, N (prazo de obra), chaves, T (meses do fluxo), fI(mês) }  */
function softCustos(st, ctx){
  const K = st && st.soft; if(!K) return { total: 0, itens: [], mes: new Array(ctx.T).fill(0) };
  const { obra, vgv, terreno, launch, N, chaves, T } = ctx, fI = ctx.fI || (() => 1);
  const mes = new Array(T).fill(0), itens = [];
  const clampM = i => Math.max(0, Math.min(T - 1, Math.round(i)));
  const espalha = (valor, de, ate, corr) => { const a = clampM(de), b = Math.max(a, clampM(ate)), n = b - a + 1;
    for(let i = a; i <= b; i++) mes[i] += valor / n * (corr ? corr(i) : 1) };
  const soma = (k, nome, base, calc) => { const p = +K[k] || 0; if(!(p > 0)) return; const antes = mes.reduce((s, v) => s + v, 0); calc(p); itens.push({ k, nome, base, valor: mes.reduce((s, v) => s + v, 0) - antes }) };
  SOFT_ITENS.forEach(it => {
    soma(it.k, it.nome, it.base, p => {
      if(it.k === "registro"){ const v = vgv * p; mes[clampM(launch - 1)] += v / 2; mes[clampM(chaves)] += v / 2 }
      else if(it.k === "seguros") espalha(obra * p, launch, launch + N - 1, fI)
      else if(it.k === "iptu") espalha(terreno * p * (chaves / 12), 0, chaves - 1)
      else if(it.k === "juridico") espalha(vgv * p, 0, chaves - 1)
      else if(it.k === "gestao") espalha(vgv * p, launch, launch + N - 1)
      else if(it.k === "pos") espalha(obra * p, chaves, chaves + SOFT_POS_MESES - 1, fI)
    });
  });
  return { total: mes.reduce((s, v) => s + v, 0), itens, mes };
}
/* liga todos com os valores sugeridos (devolve o que mudou, para a interface avisar) */
function softSugeridos(st){ Object.assign(st.soft, SOFT_SUGERIDOS); return st }
function softLigado(st){ return !!st.soft && Object.keys(SOFT_SUGERIDOS).some(k => +st.soft[k] > 0) }
