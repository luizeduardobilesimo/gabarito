/* ================= "o que fecha a conta" na interface (ciclo com o projeto real; cálculo em src/calc/ciclo.js) =================
   Quando o estudo não fecha, a tela diz o que fecha — no mesmo lugar, sem trocar de etapa — e cada linha APLICA ali mesmo (um passo de
   desfazer: tudo vai para S e o renderTab grava uma vez).
   - Viabilidade › Resultado: seção "O que fecha a conta" (key "fecha"; aberta, logo abaixo do RES; escondida quando a margem está na
     meta — cxSecHTML/cxLive, chamados de src/ui/financeiro.js). Linhas: preço médio que leva à meta (otimPrecoPara) e terreno até
     f.maxTerreno, ao vivo; "Procurar no projeto" roda cicloEstudo no Worker "job" (cicloRodar, src/ui/calcworker.js; cancelável) e
     acrescenta as mudanças do projeto que melhoram o lucro: garagem (tipo de rampa, acesso, ângulo + o reparo de subsolos e andares),
     lazer enxuto, unidades por andar, andares e garagens. O resultado vale para o estudo em que foi calculado (CX.res.sig); qualquer
     mudança o descarta. "Mais alavancas →" leva a Riscos › O que melhora o resultado (src/ui/alavancas.js).
   - Produto › Sugestões (src/ui/produto.js): cxLinhasOtim(OTIM) = lazer enxuto da melhor opção (r.enxuto), preço e terreno que fecham
     (OTIM.fecha/semLucro), cada uma com Aplicar (a opção + a mudança).
   Só tokens e componentes existentes: .btn sm (nunca .pri), --ok-t/--bad para o ganho, --line nas divisas. */
const CX = { sig:null, res:null, run:false, prog:0, prSig:null, pr:null };
{ const s=document.createElement("style"); s.id="cxCSS"; s.textContent=`
.cx{display:grid}
.cx-l{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:2px 10px;align-items:center;padding:7px 0;border-bottom:1px solid var(--line)}
.cx-l:last-child{border-bottom:0}
.cx-t{display:grid;gap:1px;min-width:0}
.cx-t b{font-weight:550;font-size:12.5px;line-height:1.3}
.cx-t span{font-size:11px;color:var(--muted);line-height:1.35}
.cx-v{font-size:12.5px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right}
.cx-v.ok{color:var(--ok-t)}.cx-v.bad{color:var(--bad)}
.cx-acts{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:4px}
.cx-acts .prog{flex:1 1 120px;min-width:80px}
.cx-acts .flink{margin-left:auto}
.cx-nada{font-size:11.5px;color:var(--muted);padding:6px 0 2px}
.pr-av .cx{margin-top:6px}
.pr-av .cx-l{border-bottom-color:color-mix(in srgb,var(--warn) 22%,transparent);padding:7px 0}
.pr-av.bad .cx-l{border-bottom-color:color-mix(in srgb,var(--bad) 18%,transparent)}
.res .cx-l{padding:7px 0}
@media (max-width:420px){.cx-l{grid-template-columns:minmax(0,1fr) auto}.cx-l .btn{grid-column:2;grid-row:1/3;align-self:center}.cx-v{grid-column:1;grid-row:2;text-align:left}}`;
  document.head.appendChild(s) }

const cxR = v=>`R$ ${nf(Math.ceil(v/50)*50,0)}/m²`;
const cxGanho = v=>`${v<0?"−":"+"}${mi(Math.abs(v))}`;
/* uma linha: título, o que muda, o valor (ganho ou meta) e Aplicar */
const cxNb = t=>esc(t).replace(/R\$ /g,"R$\u00a0");   // "R$ 15.600" não quebra
function cxLinhaHTML(l){
  return `<div class="cx-l"><div class="cx-t"><b>${cxNb(l.rot)}</b>${l.desc? `<span>${cxNb(l.desc)}</span>` : ""}</div>${l.v!=null? `<span class="cx-v${l.cls? " "+l.cls : ""}">${cxNb(l.v)}</span>` : "<span></span>"}<button type="button" class="btn sm" data-act="cxAplica" data-src="${l.src}" data-k="${l.k}" ${l.i!=null? `data-i="${l.i}"` : ""} aria-label="Aplicar: ${esc(l.rot)}">Aplicar</button></div>`;
}
/* preço: todas as tipologias, coberturas e lojas na mesma proporção (a conta de otimPrecoPara/finance dp), arredondado para cima a R$ 50 */
function cxPrecoAplica(st, preco){
  const k=preco/Math.max(1, basePrice(st)), up=v=>Math.ceil((+v||0)*k/50)*50;
  st.produto.mix.forEach(u=>u.preco=up(u.preco)); if(st.produto.cob) st.produto.cob.preco=up(st.produto.cob.preco); if(st.fin.precoLoja) st.fin.precoLoja=up(st.fin.precoLoja) }
const cxTerrenoOk = ()=> S.fin.terreno>0 && !(S.fin.permuta>0) && !(S.fin.permutaFin>0);

/* ---------------- Produto: o que fecha a conta da melhor opção do otimizador ---------------- */
function cxLinhasOtim(O){
  if(!O || !O.res || !O.res.length) return [];
  const L=[], r0=O.res[0], fx=O.semLucro || O.fecha, q=i=>i? ` · na opção ${i+1}` : "";
  if(r0.enxuto && r0.enxuto.dLucro>0) L.push({src:"otim", k:"enxuto", rot:`Lazer enxuto (sem ${cicloLista(r0.enxuto.tira)})`, desc:`margem ${pct(r0.enxuto.margem,1)}${r0.enxuto.vagas!==r0.vagas? ` · ${r0.enxuto.vagas} vagas` : ""}`, v:cxGanho(r0.enxuto.dLucro), cls:"ok"});
  const destino=O.semLucro? "ao lucro zero" : `à meta de ${pct(fx? fx.meta : 0,0)}`;
  if(fx && fx.precoMeta) L.push({src:"otim", k:"preco", rot:`Preço médio de ${cxR(fx.precoMeta)}`, desc:`hoje ${cxR(fx.precoAtual)} · leva à meta de ${pct(fx.meta,0)}${q(fx.opcaoMeta)}`, v:`+${pct(fx.precoMeta/Math.max(1,fx.precoAtual)-1,0)}`});
  else if(fx && fx.precoZero) L.push({src:"otim", k:"precoZero", rot:`Preço médio de ${cxR(fx.precoZero)}`, desc:`hoje ${cxR(fx.precoAtual)} · leva ao lucro zero${q(fx.opcaoZero)}`, v:`+${pct(fx.precoZero/Math.max(1,fx.precoAtual)-1,0)}`});
  const tz= fx && (O.semLucro? fx.terrenoZero : fx.terrenoMeta);
  if(fx && tz>0 && (fx.terrenoAtual>0 || fx.terrenoPct) && tz<(fx.terrenoAtual||Infinity)) L.push({src:"otim", k:"terreno", rot:`Terreno até ${mi(tz)}`, desc:`${fx.terrenoAtual>0? `hoje ${mi(fx.terrenoAtual)}${fx.terrenoPct? " (estimado)" : ""} · ` : ""}leva ${destino}`, v:fx.terrenoAtual>0? `−${pct(1-tz/fx.terrenoAtual,0)}` : null});
  return L.slice(0,4);
}

/* ---------------- Viabilidade › Resultado ---------------- */
function cxSecHTML(){
  return SEC("O que fecha a conta", `<div class="cx" id="cxList"></div><div class="cx-acts" id="cxActs"></div>`,
    {key:"fecha", open:true, hidden:true, sum:"", info:"O que fecha a conta"});
}
function cxLinhasViab(m, f){
  const meta=S.fin.margemAlvo, L=[], sig=JSON.stringify(S);
  if(CX.prSig!==sig){ CX.prSig=sig; try{ CX.pr=otimPrecoPara(S, m, meta) }catch(e){ CX.pr=null; console.error("[cx] preço", e) } }
  const pm=basePrice(S);
  if(CX.pr && CX.pr>pm) L.push({src:"viab", k:"preco", rot:`Preço médio de ${cxR(CX.pr)}`, desc:`hoje ${cxR(pm)} · leva à meta`, v:`+${pct(CX.pr/pm-1,0)}`});
  if(cxTerrenoOk() && f.maxTerreno>0 && f.maxTerreno<S.fin.terreno) L.push({src:"viab", k:"terreno", rot:`Terreno até ${mi(f.maxTerreno)}`, desc:`hoje ${mi(S.fin.terreno)} · leva à meta`, v:`−${pct(1-f.maxTerreno/S.fin.terreno,0)}`});
  const R=CX.res && CX.res.sig===sig? CX.res : null;
  if(R) R.linhas.forEach((l,i)=>L.push({src:"viab", k:"proj", i, rot:l.rot, desc:`${l.desc}${l.desc? " · " : ""}margem ${pct(l.margem,1)}`, v:cxGanho(l.d.lucro), cls:"ok"}));
  return {L, R};
}
function cxLive(m, f, fast){
  const d=document.querySelector('#tabbody details[data-key="fecha"]'); if(!d) return;
  const meta=S.fin.margemAlvo, fecha=f.margemVGV<meta-1e-9;
  if(d.hidden===fecha) d.hidden=!fecha;
  if(!fecha) return;
  setSum("fecha", `margem ${pct(f.margemVGV,0)} · meta ${pct(meta,0)}`);
  if(!d.open || (fast && CX.prSig)) return;
  const {L, R}=cxLinhasViab(m, f);
  const proj=R? (R.linhas.length? "" : `<div class="cx-nada">No projeto, nenhuma mudança isolada melhora o resultado.</div>`) : "";
  setHTML("cxList", L.map(cxLinhaHTML).join("") + proj);
  setHTML("cxActs", CX.run
    ? `<div class="prog" id="cxProg"><i style="width:${(CX.prog*100).toFixed(0)}%"></i></div><button type="button" class="btn sm ghost" data-act="calcCancel">Cancelar</button>`
    : `<button type="button" class="btn sm" data-act="cxBusca">${R? "Procurar de novo" : "Procurar no projeto"}</button><button type="button" class="btn sm ghost flink" data-act="finIr" data-v="risco" data-open="alavancas">Mais alavancas →</button>`);
}
function cxRefaz(){ const L=window._last; if(L && L.m && L.f) cxLive(L.m, L.f, false) }

Object.assign(ACT, {
  cxBusca: async ()=>{
    if(CX.run || (typeof CALC!=="undefined" && CALC.jobAtivo)) return;
    const sig=JSON.stringify(S); CX.run=true; CX.prog=0; cxRefaz();
    try{
      const r=await cicloRodar({}, p=>{ CX.prog=p; const e=document.querySelector("#cxProg i"); if(e) e.style.width=(p*100).toFixed(0)+"%" });
      CX.res={...r, sig}; CX.run=false; cxRefaz();
      toast(r.linhas.length? `${r.linhas.length} mudança${r.linhas.length>1?"s":""} no projeto melhora${r.linhas.length>1?"m":""} o resultado` : "Nenhuma mudança isolada no projeto melhora o resultado");
    }catch(e){ CX.run=false; cxRefaz(); if(!/cancelado|ocupado/.test(e && e.message || "")){ console.error("[cx]", e); toast("Não foi possível procurar agora. Tente de novo.") } } },
  cxAplica: b=>{ const src=b.dataset.src, k=b.dataset.k;
    if(src==="otim"){ const O=OTIM; if(!O || !O.res.length) return; const fx=O.semLucro || O.fecha;
      if(k==="enxuto"){ const e=O.res[0].enxuto; if(!e) return; aplicarOtim(e); renderTab(); fit3dDepois(); toast(`Melhor opção aplicada com lazer enxuto (sem ${cicloLista(e.tira)}) — Ctrl+Z desfaz`); return }
      if(k==="preco" || k==="precoZero"){ const q=(k==="preco"? fx.opcaoMeta : fx.opcaoZero)||0, r=O.res[q], v=k==="preco"? fx.precoMeta : fx.precoZero; if(!r || !v) return;
        aplicarOtim(r); cxPrecoAplica(S, v); renderTab(); fit3dDepois(); toast(`Opção ${q+1} aplicada com preço médio de ${cxR(v)} — Ctrl+Z desfaz`); return }
      if(k==="terreno"){ const v=O.semLucro? fx.terrenoZero : fx.terrenoMeta; if(!(v>0)) return; aplicarOtim(O.res[0]); S.fin.terreno=Math.floor(v/1e4)*1e4; renderTab(); fit3dDepois(); toast(`Melhor opção aplicada com terreno de ${mi(S.fin.terreno)} — Ctrl+Z desfaz`); return }
      return }
    // Viabilidade: a mudança no estudo atual
    if(k==="preco"){ if(!CX.pr) return; cxPrecoAplica(S, CX.pr); renderTab(); toast(`Preço médio de ${cxR(CX.pr)} aplicado — Ctrl+Z desfaz`); return }
    if(k==="terreno"){ const f=window._last && window._last.f; if(!f || !(f.maxTerreno>0)) return; S.fin.terreno=Math.floor(f.maxTerreno/1e4)*1e4; renderTab(); toast(`Terreno de ${mi(S.fin.terreno)} aplicado — Ctrl+Z desfaz`); return }
    const l=CX.res && CX.res.sig===JSON.stringify(S) && CX.res.linhas[+b.dataset.i]; if(!l) return;
    cicloAplica(S, l.patch); CX.res=null; renderTab(); if(typeof fit3dDepois==="function") fit3dDepois(); toast(`${l.rot} — aplicado. Ctrl+Z desfaz`) },
});
