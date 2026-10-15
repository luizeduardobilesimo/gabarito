/* ================= checklist do estudo e próximo passo — interface (UX v3 §3.3 e §6.3) =================
   Cálculo puro em src/calc/progresso.js (progressoItens, progressoResumo, proximoPasso). Aqui:
   - S.guia.conf {regras, preco, custo}: flags de interface (extendDEF). NÃO entram em compute/finance. Viram true quando o campo é
     editado (listener de "change" no documento: regras.*, preços do mix/cobertura/lojas, fin.terreno/cub/fator), quando a calibração
     de custo é aplicada, pelo "Conferi" do checklist ou pelo próximo passo ("Confirmar o preço de venda").
   - progressoAnelHTML()            → botão com o anel "6/9" (o P1 põe no topo, ao lado do nome do estudo). Abre o checklist ao clicar.
   - progressoLinhaHTML()           → a mesma informação como uma linha ("6 de 9 conferidos · ver"), para o Resultado da Viabilidade.
   - progressoAbrir(anchorEl)       → popover com os 9 itens agrupados por etapa; pendente = "Resolver" (vai para etapa/sub/seção).
   - progressoAtualiza()            → redesenha anéis, linhas e o popover aberto (chamado a cada resultado na tela).
   - proximoPassoAtual()            → proximoPasso(S, m, f, TAB, sub atual) com o último resultado da tela (para o rodapé do P1).
   - progressoExecuta(pp)           → executa um próximo passo: ACT[pp.act] quando houver, senão progIr(pp.etapa, pp.sub, pp.sec).
   - progIr(etapa, sub, sec)        → irPara (P0) quando existir; senão goStep com os nomes atuais das etapas e abre a seção.
   ACT novos: progSubsolo, progGaragem, progLayout, progConfPreco, progConfCusto, progConfRegras, progPdf. */
extendDEF("guia", { conf:{ regras:false, preco:false, custo:false } });

(function(){ const s=document.createElement("style"); s.textContent=`
.prog-anel{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:999px;padding:3px 10px 3px 4px;min-height:30px;font:inherit;font-size:12.5px;font-weight:550;font-variant-numeric:tabular-nums;cursor:pointer;box-shadow:var(--shadow-s);transition:background .15s var(--ease),border-color .15s var(--ease)}
.prog-anel:hover{background:var(--soft);border-color:var(--line-2)}
.prog-anel svg{width:22px;height:22px;flex:none;transform:rotate(-90deg)}
.prog-anel .tr{fill:none;stroke:var(--line);stroke-width:3}
.prog-anel .ar{fill:none;stroke:var(--sel);stroke-width:3;stroke-linecap:round;transition:stroke-dasharray .4s var(--ease)}
.prog-anel.ok .ar{stroke:var(--ok)}
.prog-linha{display:flex;align-items:center;gap:8px;width:100%;border:0;background:none;padding:2px 0;color:var(--muted);font:inherit;font-size:12.5px;cursor:pointer;text-align:left}
.prog-linha b{color:var(--ink);font-weight:600}
.prog-linha .bar{flex:1;height:4px;border-radius:9px;background:var(--line);overflow:hidden;min-width:40px}
.prog-linha .bar i{display:block;height:100%;background:var(--sel);border-radius:9px}
.prog-linha .ver{color:var(--ink-2);text-decoration:underline;text-underline-offset:2px}
.prog-pop{position:fixed;z-index:62;width:min(380px,calc(100vw - 24px));max-height:min(78vh,640px);overflow:auto;background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg,16px);box-shadow:var(--shadow-pop);padding:16px 16px 12px;color:var(--ink)}
.prog-pop[hidden]{display:none}
.prog-pop .pp-h{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;margin-bottom:6px}
.prog-pop .pp-h svg{width:40px;height:40px;transform:rotate(-90deg)}
.prog-pop .pp-h .tr{fill:none;stroke:var(--line);stroke-width:3.4}
.prog-pop .pp-h .ar{fill:none;stroke:var(--sel);stroke-width:3.4;stroke-linecap:round}
.prog-pop .pp-h.ok .ar{stroke:var(--ok)}
.prog-pop .pp-h b{display:block;font-size:15px;font-weight:650;letter-spacing:-.01em}
.prog-pop .pp-h span{display:block;font-size:12px;color:var(--muted);margin-top:1px}
.prog-pop .pp-x{border:0;background:none;color:var(--muted);font-size:18px;line-height:1;padding:4px 6px;cursor:pointer;border-radius:8px}
.prog-pop .pp-x:hover{background:var(--soft);color:var(--ink)}
.prog-pop .pp-g{font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--faint,var(--muted));font-weight:600;margin:12px 0 4px}
.prog-pop .pp-i{display:grid;grid-template-columns:20px 1fr auto;gap:10px;align-items:center;padding:7px 0;border-top:1px solid var(--line)}
.prog-pop .pp-g+.pp-i{border-top:0}
.prog-pop .pp-ic{width:18px;height:18px;border-radius:50%;display:grid;place-items:center;border:1.5px solid var(--line-2);color:transparent}
.prog-pop .pp-i.ok .pp-ic{background:var(--ok);border-color:var(--ok);color:#fff}
.prog-pop .pp-i.wait .pp-ic{border-style:dashed}
.prog-pop .pp-ic svg{width:11px;height:11px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.prog-pop .pp-t b{display:block;font-size:13px;font-weight:550}
.prog-pop .pp-i.ok .pp-t b{color:var(--ink-2);font-weight:500}
.prog-pop .pp-t span{display:block;font-size:11.5px;color:var(--muted);margin-top:1px;line-height:1.35}
.prog-pop .pp-a{display:flex;gap:4px}
@media (max-width:900px){.prog-pop{left:12px!important;right:12px;top:auto!important;bottom:calc(76px + env(safe-area-inset-bottom,0px));width:auto;max-height:70vh}}
`; document.head.appendChild(s) })();

const PROG_GRUPOS = [["terreno","Terreno"],["produto","Produto"],["viab","Viabilidade"],["projeto","Projeto"]];
const PROG_CONF = { regras:"regras", preco:"preco", custo:"custo" };   // itens que o usuário pode marcar como conferidos
const PROG_OK = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.3 5 8.6l4.6-5"/></svg>';
let PROG_POP=null, PROG_ANCORA=null;

function progUlt(){ const L=window._last; return { m: L&&L.m, f: L&&L.f } }
function progSubAtual(){ try{ return typeof curSub==="function"? curSub() : null }catch(e){ return null } }
function progressoResumoAtual(){ const {m,f}=progUlt(); return progressoResumo(S, m, f) }
function proximoPassoAtual(){ const {m,f}=progUlt(); return proximoPasso(S, m, f, typeof TAB!=="undefined"? TAB : "terreno", progSubAtual()) }
function progArco(r, frac){ const c=2*Math.PI*r; return `stroke-dasharray="${(c*Math.max(0,Math.min(1,frac))).toFixed(2)} ${c.toFixed(2)}"` }

function progressoAnelHTML(){
  const r=progressoResumoAtual(), tudo=r.feitos===r.total;
  return `<button type="button" class="prog-anel${tudo?" ok":""}" data-prog-anel aria-haspopup="dialog" aria-label="${r.feitos} de ${r.total} itens conferidos — ver o que falta" title="O que falta para o estudo ficar confiável"><svg viewBox="0 0 22 22" aria-hidden="true"><circle class="tr" cx="11" cy="11" r="8.5"/><circle class="ar" cx="11" cy="11" r="8.5" ${progArco(8.5, r.pct)}/></svg><span>${r.feitos}/${r.total}</span></button>`;
}
function progressoLinhaHTML(){
  const r=progressoResumoAtual();
  return `<button type="button" class="prog-linha" data-prog-linha data-prog-anel aria-haspopup="dialog"><b>${r.feitos} de ${r.total}</b> conferidos<span class="bar"><i style="width:${(r.pct*100).toFixed(0)}%"></i></span><span class="ver">ver</span></button>`;
}
function progPopHTML(){
  const r=progressoResumoAtual(), tudo=r.feitos===r.total;
  const item=i=>{ const cls=i.ok===true? "ok" : i.ok==null? "wait" : "pend", conf=PROG_CONF[i.k];
    const acts = i.ok===false? `<button type="button" class="btn sm" data-prog-ir="${i.k}">Resolver</button>${conf?`<button type="button" class="btn sm ghost" data-prog-conf="${conf}" title="Marcar como conferido">Conferi</button>`:""}` : "";
    return `<div class="pp-i ${cls}"><span class="pp-ic">${PROG_OK}</span><div class="pp-t"><b>${esc(i.nome)}</b><span>${esc(i.dica)}</span></div><div class="pp-a">${acts}</div></div>` };
  return `<div class="pp-h${tudo?" ok":""}"><svg viewBox="0 0 40 40" aria-hidden="true"><circle class="tr" cx="20" cy="20" r="16"/><circle class="ar" cx="20" cy="20" r="16" ${progArco(16, r.pct)}/></svg>
      <div><b>${tudo? "Estudo confiável" : `${r.feitos} de ${r.total} conferidos`}</b><span>${tudo? "Tudo o que importa foi conferido." : "O que falta para o estudo ficar confiável"}</span></div>
      <button type="button" class="pp-x" data-prog-x aria-label="Fechar">×</button></div>` +
    PROG_GRUPOS.map(([k,nome])=>{ const l=r.itens.filter(i=>i.etapa===k); return l.length? `<div class="pp-g">${nome}</div>${l.map(item).join("")}` : "" }).join("");
}
function progressoAbrir(anchorEl){
  if(!PROG_POP){ PROG_POP=document.createElement("div"); PROG_POP.className="prog-pop"; PROG_POP.id="progPop"; PROG_POP.setAttribute("role","dialog"); PROG_POP.setAttribute("aria-label","Checklist do estudo"); PROG_POP.hidden=true; document.body.appendChild(PROG_POP);
    PROG_POP.addEventListener("click", progPopClique) }
  if(!PROG_POP.hidden && PROG_ANCORA===anchorEl){ progressoFechar(); return }
  PROG_ANCORA=anchorEl||null; PROG_POP.innerHTML=progPopHTML(); PROG_POP.hidden=false;
  if(anchorEl) anchorEl.setAttribute("aria-expanded","true");
  progPosiciona();
}
function progPosiciona(){
  if(!PROG_POP || PROG_POP.hidden || matchMedia("(max-width:900px)").matches){ if(PROG_POP){ PROG_POP.style.left=""; PROG_POP.style.top="" } return }
  const a=PROG_ANCORA && PROG_ANCORA.isConnected? PROG_ANCORA.getBoundingClientRect() : {left:innerWidth/2-190, bottom:72, top:72};
  const pw=PROG_POP.offsetWidth, ph=PROG_POP.offsetHeight;
  let x=Math.min(innerWidth-pw-12, Math.max(12, a.left-8)), y=a.bottom+8; if(y+ph>innerHeight-12) y=Math.max(12, a.top-ph-8);
  PROG_POP.style.left=x+"px"; PROG_POP.style.top=y+"px";
}
function progressoFechar(){ if(PROG_POP) PROG_POP.hidden=true; if(PROG_ANCORA) PROG_ANCORA.setAttribute("aria-expanded","false"); PROG_ANCORA=null }
function progPopClique(e){
  if(e.target.closest("[data-prog-x]")){ progressoFechar(); return }
  const ir=e.target.closest("[data-prog-ir]");
  if(ir){ const i=progressoResumoAtual().itens.find(x=>x.k===ir.dataset.progIr); progressoFechar(); if(i) progIr(i.etapa, i.sub, i.sec); return }
  const c=e.target.closest("[data-prog-conf]");
  if(c){ progMarca(c.dataset.progConf, true) }
}
function progressoAtualiza(){
  const r=progressoResumoAtual();
  document.querySelectorAll("[data-prog-anel]:not([data-prog-linha])").forEach(el=>{ const h=progressoAnelHTML(); if(el.outerHTML!==h) el.outerHTML=h });
  document.querySelectorAll("[data-prog-linha]").forEach(el=>{ const h=progressoLinhaHTML(); if(el.outerHTML!==h) el.outerHTML=h });
  if(PROG_POP && !PROG_POP.hidden){ const h=progPopHTML(); if(PROG_POP.innerHTML!==h) PROG_POP.innerHTML=h;
    if(PROG_ANCORA && !PROG_ANCORA.isConnected){ PROG_ANCORA=document.querySelector("[data-prog-anel]") } }
  return r;
}
/* marca uma flag de conferido (regras|preco|custo) */
function progMarca(k, aviso){
  if(!S.guia || !S.guia.conf) S.guia={conf:{regras:false,preco:false,custo:false}};
  if(S.guia.conf[k]) return false;
  S.guia.conf[k]=true; save(); progressoAtualiza();
  if(aviso) toast({regras:"Regras marcadas como conferidas", preco:"Preço de venda conferido", custo:"Terreno e custo da obra conferidos"}[k]||"Conferido");
  return true;
}
/* navegação: irPara (P0) quando existir; senão, os nomes das etapas de hoje */
function progIr(etapa, sub, sec){
  if(typeof irPara==="function"){ try{ return irPara(etapa, sub||undefined, sec||undefined) }catch(e){ console.error("[progresso] irPara", e) } }
  const tem=k=>typeof STEPS!=="undefined" && STEPS.some(s=>s.k===k);
  let k=etapa, s=sub, sc=sec;
  if(k==="terreno" && sc==="regras" && tem("regras")){ k="regras"; sc="cidade"; if(typeof SUBX!=="undefined"){ SUBX.regras="pref"; LS.set("gabarito.subx",SUBX) } }
  if(k==="projeto" && (s==="sol"||s==="vento") && tem("clima")) k="clima";
  if(k==="projeto" && s==="tipo" && sc==="nrmList" && tem("regras")){ k="regras"; s=null; if(typeof SUBX!=="undefined"){ SUBX.regras="normas"; LS.set("gabarito.subx",SUBX) } }
  if(k==="cen" && s && typeof SUBX!=="undefined"){ SUBX.cen=s; LS.set("gabarito.subx",SUBX) }
  if(k==="viab" && s && typeof SUBX!=="undefined"){ SUBX.viab=s; LS.set("gabarito.subx",SUBX) }
  if(!tem(k)) k="terreno";
  goStep(k, (k==="projeto"||k==="clima")? (s||undefined) : undefined);
  if(TAB===k && (k==="viab"||k==="regras"||k==="cen") && s) renderTab();
  if(sc) setTimeout(()=>{ const d=document.querySelector(`#tabbody details[data-key="${sc}"]`); if(d){ d.open=true; d.scrollIntoView({block:"start", behavior:"smooth"}) } }, 60);
}
/* executa um próximo passo (o do rodapé ou o do cartão do assistente) */
function progressoExecuta(pp, el){
  if(!pp) return;
  if(pp.act && typeof ACT!=="undefined" && ACT[pp.act]){ if(pp.act==="otim" && TAB!=="produto") progIr("produto"); return ACT[pp.act](el||document.createElement("button")) }
  progIr(pp.etapa, pp.sub, pp.sec);
}
Object.assign(ACT, {
  progSubsolo: ()=>{ S.produto.subsolos=Math.min(5,(+S.produto.subsolos||0)+1); update(); renderTab(); toast(`${S.produto.subsolos} subsolo${S.produto.subsolos>1?"s":""} — Ctrl+Z desfaz`) },
  progGaragem: ()=>{ S.produto.garAcima=(+S.produto.garAcima||0)+1; update(); renderTab(); toast("Garagem elevada adicionada — Ctrl+Z desfaz") },
  progLayout: ()=>{ S.estudo.usarLayout=true; update(); renderTab(); toast("As contas usam as vagas do layout") },
  progConfPreco: ()=>{ progMarca("preco", true); renderTab(); toast("Preço de venda conferido") },
  progConfCusto: ()=>{ progMarca("custo", true); renderTab(); toast("Terreno e custo da obra conferidos") },
  progConfRegras: ()=>{ progMarca("regras", true); renderTab() },
  progPdf: ()=>{ if(typeof exportPDF==="function") calcPronto().then(()=>exportPDF()) },
  progAbrir: b=>progressoAbrir(b),
});
/* editar um campo confirma o item correspondente */
const PROG_CAMPOS = [[/^regras\./, "regras"], [/^produto\.mix\.\d+\.preco$|^produto\.cob\.preco$|^fin\.precoLoja$/, "preco"], [/^fin\.(terreno|cub|fator)$/, "custo"]];
document.addEventListener("change", e=>{ const p=e.target && e.target.dataset && e.target.dataset.p; if(!p) return;
  const x=PROG_CAMPOS.find(([re])=>re.test(p)); if(x) progMarca(x[1], false) });
// aplicar regras de uma cidade (seletor da biblioteca) também conta, pelo S.regrasRef; calibrar o custo conta como conferido
["ccalAplica","ccalEmpresa"].forEach(k=>{ const fn=ACT[k]; if(typeof fn==="function") ACT[k]=function(...a){ const r=fn.apply(this,a); try{ progMarca("custo", false) }catch(e){} return r } });
// anel e linha: abrir o checklist
document.addEventListener("click", e=>{
  const a=e.target.closest && e.target.closest("[data-prog-anel]");
  if(a){ e.preventDefault(); progressoAbrir(a); return }
  if(PROG_POP && !PROG_POP.hidden && !PROG_POP.contains(e.target)) progressoFechar();
});
document.addEventListener("keydown", e=>{ if(e.key==="Escape" && PROG_POP && !PROG_POP.hidden) progressoFechar() });
addEventListener("resize", ()=>progPosiciona());
/* a cada resultado na tela: atualiza anéis, linhas e popover (card vazio registrado em todas as etapas, só pelo live) */
["terreno","regras","produto","viab","projeto","clima","cen"].forEach(k=>addCard(k, {key:"progresso", order:998, html:()=>"", live:()=>{ try{ progressoAtualiza() }catch(e){ console.error("[progresso]", e) } }}));
