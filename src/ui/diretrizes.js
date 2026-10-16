/* ================= Produto › "Diretrizes do produto" (cálculo em src/calc/diretrizes.js) =================
   Seção fechada logo abaixo do RES "Uso do potencial", antes de "Sugerir a melhor combinação":
   - Livre | Com diretrizes (S.diretrizes.modo). Livre = o otimizador só olha resultado e aproveitamento, como sempre.
   - Com diretrizes: Padrão (5 botões; escolher APLICA as predefinições — mix, preços, lazer, CUB, vagas, coberturas — num passo de
     desfazer e mostra o que mudou), faixa do MCMV (no econômico), tipologias permitidas (chips), subsolos e garagem elevada; a linha
     de situação diz se o estudo atual atende e oferece "Ajustar o estudo". O resto (térreo, vagas por unidade, elevador de carros,
     torres, pavimentos, unidades por andar, coberturas, lojas, áreas por tipologia, lazer obrigatório e por unidade, margem mínima,
     teto por unidade) fica em "Mais opções".
   - Nenhum campo visível fora de "Mais opções" (só botões): a etapa continua dentro das metas da UX v3.
   Estado de tela (DIRUI: o "o que mudou" do último padrão) fica fora de S. */
const DIRUI = { mudou:null };
(function(){ const s=document.createElement("style"); s.textContent=`
.seg.dir-pads button{padding:5px 4px;font-size:12px;flex:1 1 auto}
.dir-pd{font-size:11px;color:var(--muted);line-height:1.4;margin-top:-2px}
.dir-l{font-size:11px;font-weight:550;color:var(--muted);margin:2px 0 -2px}
.dir-st{display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--ink-2);line-height:1.35;min-height:28px}
.dir-st .d{width:7px;height:7px;border-radius:50%;flex:none;background:var(--ok)}
.dir-st.bad .d{background:var(--bad)} .dir-st.warn .d{background:var(--warn)}
.dir-st span{flex:1;min-width:0}
.dir-st .btn{flex:none}
.dir-mud{border-radius:var(--r);padding:8px 10px 8px 11px;background:var(--info-soft);border:1px solid color-mix(in srgb,var(--info) 25%,transparent);font-size:11.5px;color:var(--ink);display:grid;gap:3px}
.dir-mud .h{display:flex;align-items:center;gap:6px;font-weight:600}
.dir-mud .h button{margin-left:auto;border:0;background:none;color:var(--muted);cursor:pointer;padding:2px 4px;border-radius:6px;font-size:14px;line-height:1}
.dir-mud .h button:hover{background:var(--soft);color:var(--ink)}
.dir-mud ul{margin:0;padding:0 0 0 14px;color:var(--ink-2)}
.dir-mud li{margin:1px 0}
.dir-ar{display:grid;grid-template-columns:minmax(0,1.25fr) repeat(3,minmax(0,1fr));gap:6px;align-items:end}
.dir-ar .q{font-size:11.5px;color:var(--ink-2);padding-bottom:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dir-ok{color:var(--ok-t)}
`; document.head.appendChild(s) })();

const DIR_GAR_OPC = [[0,"Não"],[1,"Até 1"],[2,"Até 2"],[-1,"Livre"]];
const DIR_SNL = [["livre","Livre"],["sim","Sim"],["nao","Não"]];
function dirSegLinha(rot, p, opts, info){ return `<div class="row sb" style="flex-wrap:nowrap;gap:8px"><span class="fl" style="flex:none">${rot}${info? INFO(info) : ""}</span>${SEG(p, opts, {fx:"save", label:rot})}</div>` }

/* resumo do cabeçalho: "Livre" ou "Médio-alto · 2 e 3 dorm. · sem subsolo" + selo de situação do estudo atual */
function dirSumHTML(m){
  if(!dirAtiva(S)) return "Livre";
  const c=m? dirConfere(S, m) : null, sel=!c? "" : c.ok? ` <span class="pill ok">atende</span>` : ` <span class="pill bad">${c.n} fora</span>`;
  return esc(dirResumo(S))+sel;
}
function dirSecHTML(){
  const d=S.diretrizes, on=dirAtiva(S), D=on? dirEfetivas(S) : null;
  let body = SEG("diretrizes.modo", [["livre","Livre"],["diretrizes","Com diretrizes"]], {fx:"save", full:true, label:"Modo do estudo"});
  if(!on) body += `<p class="note">O otimizador escolhe tudo dentro das regras da prefeitura.</p>`;
  else {
    const pads = DIR_ORDEM.map(k=>{ const P=DIR_PADROES[k]; return `<button type="button" data-act="dirPadrao" data-k="${k}" aria-pressed="${D.k===k}" title="${esc(P.nome)} — aplica unidades, preços, lazer, custo e vagas do padrão (Ctrl+Z desfaz)">${esc(P.curto||P.nome)}</button>` }).join("");
    const PD=D.P, aa=PD.tips.map(q=>D.area(q)[1]);
    const mud = DIRUI.mudou && DIRUI.mudou.k===D.k ? `<div class="dir-mud" role="status"><div class="h">${esc(DIR_PADROES[D.k].nome)} aplicado<button type="button" data-act="dirMudFecha" aria-label="Fechar" title="Fechar">×</button></div><ul>${DIRUI.mudou.l.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>` : "";
    const chips = [0,1,2,3,4].map(q=>`<button type="button" class="chip" data-act="dirTip" data-q="${q}" aria-pressed="${D.tips.includes(q)}">${DIR_Q[q]}</button>`).join("");
    body += `<div class="dir-l">Padrão${INFO("Padrão do empreendimento")}</div><div class="seg full dir-pads" role="group" aria-label="Padrão do empreendimento">${pads}</div>
      <div class="dir-pd">${esc(PD.nome)}${INFO(PD.nome)} · ${esc(dirTipsTxt({tips:PD.tips}))} de ${nf(Math.min(...aa),0)} a ${nf(Math.max(...aa),0)} m² · ${dirFaixaPreco(PD)} · ${PD.vagasUn? `${nf(PD.vagasUn, PD.vagasUn%1? 1 : 0)} vaga${PD.vagasUn>1? "s" : ""}/un` : "vagas da lei"}</div>${mud}
      ${D.k==="economico"? dirSegLinha("Faixa do MCMV", "diretrizes.faixa", Object.entries(DIR_FAIXAS).map(([k,f])=>[k, f.nome]), "MCMV") : ""}
      <div class="dir-l">Tipologias permitidas</div><div class="chips" role="group" aria-label="Tipologias permitidas">${chips}</div>
      <div class="fsub" id="dirAreas">${esc(D.tips.map(q=>{ const a=D.area(q); return `${D.P.nomes[q]} ${nf(a[0],0)}–${nf(a[2],0)} m²` }).join(" · "))}${D.teto>0? ` · teto ${esc(mi(D.teto))}/unidade` : ""}</div>
      ${dirSegLinha("Subsolos", "diretrizes.subMax", DIR_GAR_OPC)}
      ${dirSegLinha("Garagem elevada", "diretrizes.gacMax", DIR_GAR_OPC)}
      <div class="dir-st" id="dirSt"></div>
      ${ADV(dirMaisHTML(D), {key:"dir"})}`;
  }
  return SEC("Diretrizes do produto", body, {key:"pr-dir", sum:dirSumHTML(window._last && window._last.m), info:"Diretrizes do produto"});
}
/* "Mais opções": tudo o que não é essencial (casa única: estes data-p só existem aqui) */
function dirMaisHTML(D){
  const d=S.diretrizes, n=(p,l,u,o={})=>NUM(p, l, u, {fx:"dir", zero:true, min:0, ...o});
  const ar = D.tips.map(q=>{ const a=D.P.areas[q]; return `<div class="dir-ar"><span class="q">${esc(D.P.nomes[q])}</span>${n(`diretrizes.areas.${q}.0`,"Mín.","m²",{ph:String(a[0]),step:1})}${n(`diretrizes.areas.${q}.1`,"Máx.","m²",{ph:String(a[2]),step:1})}${n(`diretrizes.minPct.${q}`,"No andar","%",{pct:true,step:5,ph:"—",max:1})}</div>` }).join("");
  const lzNomes=[...new Set([...DIR_LZ(D.P.lazer).map(x=>x.nome), ...((S.produto.lazer&&S.produto.lazer.itens)||[]).map(x=>x.nome)])].filter(Boolean);
  return GRP("Garagem e térreo") +
    dirSegLinha("Garagem no térreo", "diretrizes.garTerreo", DIR_SNL) + dirSegLinha("Vagas na frente", "diretrizes.vagasFrente", DIR_SNL) +
    KV(n("diretrizes.vagasUn","Vagas por unidade","",{step:0.5,ph:"lei",help:"Vazio: as vagas que a lei pede. Acima da lei, o otimizador garante esse número de vagas por unidade."})) +
    SW("diretrizes.elevCarros","Elevador de carros permitido",{fx:"save"}) +
    GRP("Forma") + dirSegLinha("Torres", "diretrizes.torres", [["livre","Livre"],["fixo","Exatamente"],["max","No máximo"]]) +
    KV((d.torres!=="livre"? n("diretrizes.torresN","Torres","",{int:true,step:1,min:1}) : "") + n("diretrizes.pavMin","Pavimentos mín.","",{int:true,step:1,ph:"—"}) + n("diretrizes.pavMax","Pavimentos máx.","",{int:true,step:1,ph:"—"}) +
      n("diretrizes.unMin","Unid./andar mín.","",{int:true,step:1,ph:"—"}) + n("diretrizes.unMax","Unid./andar máx.","",{int:true,step:1,ph:"—"})) +
    dirSegLinha("Coberturas", "diretrizes.cob", DIR_SNL, "Duplex") + (d.cob==="sim"? KV(n("diretrizes.cobQtd","Coberturas por torre","",{int:true,step:1,ph:"as do estudo"})) : "") +
    dirSegLinha("Lojas no térreo", "diretrizes.lojas", DIR_SNL) +
    GRP("Áreas por tipologia") + (ar || `<p class="note">Marque ao menos uma tipologia.</p>`) +
    GRP("Áreas comuns") + KV(n("diretrizes.lazerUn","Lazer por unidade","m²",{step:0.5,ph:"—",help:"Área de lazer aproximada por unidade (salão, academia, piscina…). Abaixo de 70% dela, a sugestão avisa."})) +
    `<div class="dir-l">Obrigatórios no lazer</div><div class="chips" role="group" aria-label="Lazer obrigatório">${lzNomes.map(nm=>`<button type="button" class="chip" data-act="dirLz" data-n="${esc(nm)}" aria-pressed="${D.lazerObrig.includes(nm)}">${esc(nm)}</button>`).join("")}</div>` +
    GRP("Metas") + KV(n("diretrizes.margemMin","Margem mínima","%",{pct:true,step:1,ph:pct(S.fin.margemAlvo,0).replace("%",""),help:"Margem sobre o VGV que a sugestão precisa atingir. Vazio: a meta da Viabilidade."}) +
      n("diretrizes.tetoUn","Teto por unidade","R$",{step:5000,ph:D.teto>0? nf(D.teto,0) : "—",help:"Preço máximo de venda de cada unidade (no MCMV, o teto da faixa). As tipologias encolhem até caber; se nem a área mínima cabe, a sugestão diz o preço que cabe."}));
}
/* situação do estudo atual frente às diretrizes (linha viva) */
function dirLive(m){
  setSum("pr-dir", dirSumHTML(m));
  const e=document.getElementById("dirSt"); if(!e) return;
  const c=m && dirConfere(S, m); if(!c){ e.innerHTML=""; return }
  const g=c.falhas.filter(x=>x.grave), w=c.falhas.filter(x=>!x.grave);
  const ajusta=g.some(x=>!["vagas","lazer"].includes(x.k) || /^sem /.test(x.msg));   // vagas e lazer que não coube: quem resolve é a sugestão
  const h = g.length? `<span class="d"></span><span>Fora: ${esc(g.slice(0,2).map(x=>x.msg).join(" · "))}${g.length>2? ` e mais ${g.length-2}` : ""}</span>${ajusta? `<button type="button" class="btn sm" data-act="dirAjusta">Ajustar o estudo</button>` : ""}`
    : `<span class="d"></span><span>O estudo atual atende às diretrizes${w.length? ` · ${esc(w[0].msg)}` : ""}</span>`;
  e.className="dir-st"+(g.length? " bad" : w.length? " warn" : "");
  if(e.innerHTML!==h) e.innerHTML=h;
}
/* uma linha na sugestão: respeita as diretrizes, ou o que não deu para respeitar */
function dirOpcaoHTML(r){
  if(!r || !r.dir) return "";
  const g=r.dir.falhas.filter(x=>x.grave);
  return g.length? `<div class="note" style="color:var(--warn-t)">Não deu para respeitar: ${esc(g.slice(0,2).map(x=>x.msg).join(" · "))}</div>`
    : `<div class="note dir-ok">Respeita as diretrizes (${esc(r.dir.padrao)})</div>`;
}
/* "Ajustar o estudo": fixos, garagens, andares, unidades por andar e mix dentro das diretrizes (um passo de desfazer) */
function dirAjustaEstudo(st){
  const D=dirEfetivas(st); if(!D) return [];
  const P=st.produto, out=dirAplicaFixos(st);
  if(D.subMax>=0 && P.subsolos>D.subMax){ P.subsolos=D.subMax; out.push(dirPl(D.subMax,"subsolo")) }
  if(D.gacMax>=0 && P.garAcima>D.gacMax){ P.garAcima=D.gacMax; out.push(dirPl(D.gacMax,"garagem elevada","garagens elevadas")) }
  const forma=typeof otimFormaAtiva==="function" && otimFormaAtiva(st);
  if(!forma && ((D.torres==="fixo" && P.torres.length!==D.torresN) || (D.torres==="max" && P.torres.length>D.torresN))){
    const n=D.torresN, pav=(P.torres[0]||{}).pav||8; P.torres=Array.from({length:n},(_,i)=>P.torres[i]||{pav}); out.push(dirPl(n,"torre")) }
  P.torres.forEach(t=>{ if(D.pavMax && t.pav>D.pavMax) t.pav=D.pavMax; if(D.pavMin && t.pav<D.pavMin) t.pav=D.pavMin });
  let N=P.mix.reduce((s,u)=>s+(+u.qtd||0),0); const N2=Math.max(D.unMin||1, Math.min(D.unMax||99, N||1));
  if(N2!==N || !dirMixOk(st, P.mix, D).ok){ const mx=dirPresetMix(st, "dir", N2); if(mx.length){ P.mix=mx; out.push(`unidades: ${mx.map(u=>`${u.qtd} × ${u.nome}`).join(" e ")}`) } }
  return out;
}
FX.dir = live => { save(); dirLive(window._last && window._last.m); if(!live){ const a=document.getElementById("dirAreas"); if(a && dirAtiva(S)){ const D=dirEfetivas(S); a.textContent=D.tips.map(q=>{ const x=D.area(q); return `${D.P.nomes[q]} ${nf(x[0],0)}–${nf(x[2],0)} m²` }).join(" · ")+(D.teto>0? ` · teto ${mi(D.teto)}/unidade` : "") } } };
Object.assign(ACT, {
  dirPadrao: b=>{ const k=b.dataset.k, P=DIR_PADROES[k]; if(!P) return;
    const l=dirAplicaPadrao(S, k); S.diretrizes.modo="diretrizes"; DIRUI.mudou={k, l};
    if(typeof PR!=="undefined"){ PR.mix=-1; PR.lz=-1 }
    renderTab(); toast(`${P.nome}: unidades, preços, lazer e custo aplicados — Ctrl+Z desfaz`) },
  dirMudFecha: b=>{ DIRUI.mudou=null; const e=b.closest(".dir-mud"); if(e) e.remove() },
  dirTip: b=>{ const q=+b.dataset.q, d=S.diretrizes, l=(Array.isArray(d.tips)? d.tips : []).map(Number);
    d.tips = l.includes(q)? l.filter(x=>x!==q) : [...l, q].sort((a,c)=>a-c);
    if(!d.tips.length){ d.tips=[q]; toast("Ao menos uma tipologia fica permitida"); return }
    save(); renderTab() },
  dirLz: b=>{ const nm=b.dataset.n, d=S.diretrizes, l=Array.isArray(d.lazerObrig)? d.lazerObrig.slice() : [];
    d.lazerObrig = l.includes(nm)? l.filter(x=>x!==nm) : [...l, nm]; b.setAttribute("aria-pressed", d.lazerObrig.includes(nm)); FX.dir(false) },
  dirAjusta: ()=>{ const l=dirAjustaEstudo(S); if(typeof PR!=="undefined") PR.mix=-1; renderTab(); if(typeof fit3dDepois==="function") fit3dDepois();
    toast(l.length? `Ajustado: ${l.slice(0,3).join(" · ")} — Ctrl+Z desfaz` : "O estudo já está dentro do que dá para ajustar") },
  dirAbrir: ()=>{ if(typeof irPara==="function") irPara("produto", null, "pr-dir"); else { const s=document.querySelector('#tabbody details[data-key="pr-dir"]'); if(s){ s.open=true; s.scrollIntoView({block:"start", behavior:"smooth"}) } } },
});
