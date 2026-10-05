/* ================= pontos de extensão =================
   Módulos novos (src/calc, src/ui) se ligam ao núcleo por aqui, sem editar os arquivos centrais.
   - extendDEF(chave, padrão)       → cria S[chave] com migração (estudos antigos continuam abrindo)
   - HOOK.compute.push((m,st,opt)=>…) → enriquece o modelo no fim de compute(). opt.quick = chamada rápida (otimizador): pule o que é pesado
   - m.custosExtra.push({k,nome,sistema,valor}) → custo somado à obra pela finance()
   - m.vgvUnidades = número          → quando definido, substitui a receita residencial do mix (tabela de vendas)
   - HOOK.finance.push((f,st,m)=>…)  → enriquece o resultado financeiro
   - HOOK.draw2d.push((g,ctx)=>…)    → desenha por cima das plantas (ctx: {W,H,V,mode,m,opt,w2s,s2w})
   - HOOK.draw3d.push((grp,m)=>…)    → adiciona objetos à cena 3D (grp = grupo reconstruído a cada mudança)
   - HOOK.pdf.push(async ctx=>…)     → páginas extras no PDF (ctx: {doc,m,f,T,PW,M,head,h2,rows,img,y(),setY(v),newPage()})
   - addCard(etapa,{key,order,sub,when,html,live}) → card extra no inspetor da etapa
   - ACT.nome = el=>…  ·  FX.nome = live=>…        → ações (data-act) e efeitos (data-fx) novos */
const HOOK = { compute: [], finance: [], draw2d: [], draw3d: [], pdf: [] };
function runHooks(name, ...a){ for(const fn of HOOK[name]) try{ fn(...a) }catch(e){ console.error("[hook "+name+"]", e) } }
async function runHooksAsync(name, ...a){ for(const fn of HOOK[name]) try{ await fn(...a) }catch(e){ console.error("[hook "+name+"]", e) } }
function extendDEF(key, obj){
  DEF[key] = obj;
  const saved = LS.get("gabarito.v2");
  S[key] = merge(clone(obj), saved && saved[key]);
}
/* cards extras por etapa: order (menor = antes; os cards do núcleo ficam em 50), sub = sub-aba (projeto: gar|tipo|andar · clima: sol|vento|v3d),
   when() = mostrar só quando ativo, html() = marcação (use CARD/NUM/SLD…), live(m,f,fast) = atualização sem recriar o painel */
const CARDS = {};
function addCard(step, c){ const l = CARDS[step] = CARDS[step] || []; const i = l.findIndex(x=>x.key===c.key); if(i>=0) l.splice(i,1); l.push(c); l.sort((a,b)=>(a.order??60)-(b.order??60)) }
function cardsFor(step, sub){ return (CARDS[step]||[]).filter(c=> (!c.sub || c.sub===sub) && (!c.when || c.when()!==false)) }
