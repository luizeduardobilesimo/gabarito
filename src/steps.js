/* ================= conteúdo de cada etapa =================
   Núcleo compartilhado das etapas: STEP_R[k]() devolve {sub, body, after, subKey} e STEP_LIVE[k](m,f,fast) atualiza as partes vivas.
   O conteúdo de cada etapa mora em src/ui/:
     etapa-terreno.js (Terreno + Regras) · produto.js (Produto) · financeiro.js (Viabilidade; STEP_R.viab fica aqui embaixo)
     etapa-projeto.js (Projeto) · etapa-clima.js (Clima) · etapa-entrega.js (Cenários / Entrega)
   src/ui/*.js entram DEPOIS de steps.js, views, ai, export e wind3d: o que precisa existir antes (ordem de ganchos, valores lidos no
   carregamento) fica aqui. */
const MESES=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const hhmm=v=>{ const h=Math.floor(v), m=Math.round((v-h)*60); return `${h}h${String(m).padStart(2,"0")}` };
const bar=(v,st)=>`<div class="bar ${st||""}"><i style="width:${Math.max(2,Math.min(100,v*100)).toFixed(1)}%"></i></div>`;
const useRow=(l,v,txt,st)=>`<div class="ur"><span>${l}</span>${bar(v,st)}<span>${txt}</span></div>`;

const STEP_R = {};
const STEP_LIVE = {};

/* destaque dos lados abertos na lista do Terreno (src/ui/etapa-terreno.js): registrado aqui para manter a ordem dos ganchos de desenho */
HOOK.draw2d.push((g, c)=>terrenoLadosDestaque(g, c));

/* ---------------- 3. Produto ---------------- */
/* STEP_R.produto, STEP_LIVE.produto, otimHTML, OTRUN e as ações da etapa ficam em src/ui/produto.js (UX v2) */

/* ---------------- 4. Viabilidade ---------------- */
/* sub-abas: Resultado · Premissas · Riscos · Vendas — conteúdo e partes vivas em src/ui/financeiro.js (finViabHTML/finViabLive); Vendas = cards de src/ui/vendas.js */
STEP_R.viab = ()=>{
  const sub=SUBTABS("viab",[["res","Resultado"],["prem","Premissas"],["risco","Riscos"],["vendas","Vendas"]]), k=subAtual("viab");
  return { sub, subKey:k, body: finViabHTML(k), after: finViabAfter };
};
STEP_LIVE.viab = (m,f,fast)=> finViabLive(m, f, fast);
const fast_skip=()=>false;
