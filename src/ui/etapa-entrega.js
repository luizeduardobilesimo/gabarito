/* ================= etapa Entrega — "Mostrar e guardar" (sub-abas Entregar · Estudos) =================
   UX v3 (P6). Separado de src/steps.js (P0). Aqui: STEP_R/STEP_LIVE.cen, compareHTML (usada por src/ui/estudos.js),
   o card "Recomeçar" (addCard reset), as ações de arquivos e a leitura do .json (abrirJson, que tem o próprio <input type=file>
   e por isso funciona de qualquer lugar, como o menu do estudo).
   - Entregar: RES "Pronto para entregar" · Relatório e arquivos (PDF, DXF + IFC, .json, copiar resumo) · Apresentar e compartilhar
     (src/ui/apresentacao.js) · Marca no PDF, fechada (src/ui/marca.js).
   - Estudos: RES "Estudo aberto" · Alternativas salvas · Comparação · Estudos · Versões · Recomeçar. As listas e a lógica
     (abrir, duplicar, excluir, versões) são de src/ui/estudos.js; aqui só se montam as seções com os mesmos ids (estBox, vsBox, cenBox,
     cmpBox, cmpSec, estUndo, estCurNome, estCurSt) que o cenRefresh() de lá atualiza.
   - "+ Novo estudo" abre o assistente (assAbrir) e "Meus estudos" a tela inicial (inicioAbrir), ambos com fallback. */
(function entCss(){ const s=document.createElement("style"); s.textContent=`
.mets.ent3{grid-template-columns:repeat(3,minmax(0,1fr))}
.mets.ent3 .v{font-size:17px}
.mets.ent3 .met{padding:10px 11px}
.entacts{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.estcur .note:empty{display:none}
#entNome{display:inline-block;max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom}
`; document.head.appendChild(s) })();

/* ---------------- comparação (quadro único; chamada por src/ui/estudos.js) ---------------- */
function compareHTML(sel){
  const rows=[["Unidades","units",1,0],["Área privativa","priv",1,0],["Vagas","vagas",1,0],["CA","ca",0,2],["Altura (m)","h",-1,1],["VGV","vgv",1,"mi"],["Custo total","custo",-1,"mi"],["Lucro","lucro",1,"mi"],["Margem","margem",1,"%"],["Retorno ao ano","tir",1,"%"],["Caixa necessário","exp",-1,"mi"]];
  const fmt=(v,f)=> v==null?"—": f==="mi"? mi(v) : f==="%"? pct(v) : nf(v,f);
  const lab={CA:TERMO("CA"), VGV:TERMO("VGV"), "Retorno ao ano":TERMO("TIR","Retorno ao ano"), "Caixa necessário":TERMO("Exposição","Caixa necessário")};
  return `<div class="scroll"><table class="tbl multi"><tr><th></th>${sel.map(c=>`<th title="${esc(c.nome)}"><span>${esc(c.nome)}</span></th>`).join("")}</tr>
  ${rows.map(([l,k,dir,f])=>{ const vals=sel.map(c=>c.k[k]); const ok=vals.filter(v=>v!=null); const best= dir===0||!ok.length? null : dir>0? Math.max(...ok) : Math.min(...ok);
    return `<tr><td>${lab[l]||l}</td>${vals.map(v=>`<td class="${v!=null&&v===best&&sel.length>1?"best":""}">${fmt(v,f)}</td>`).join("")}</tr>` }).join("")}</table></div>`;
}

/* ---------------- Entregar ---------------- */
const entMet = (l,v,s)=>`<div class="met"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s||"&nbsp;"}</div></div>`;
function entResHTML(){
  const c=(S.regras&&S.regras.cidade)||"";
  return RES("Pronto para entregar", `<div class="mets ent3" id="entRes"></div>`, {aside:`<span id="entNome" title="${esc(c)}">${esc(c)}</span>`});
}
function entResLive(m,f){
  const el=document.getElementById("entRes"); if(!el || !m || !f) return;
  const h=entMet("Unidades", nf(m.units), `${m.T.length} torre${m.T.length>1?"s":""} · ${nf(m.H,0)} m`) + entMet(TERMO("VGV"), mi(f.vgv), `${mi(f.vgv/Math.max(1,m.units))}/un`) +
    entMet("Lucro", mi(f.lucro), `margem ${pct(f.margemVGV!=null? f.margemVGV : f.margem)}`);
  if(el.innerHTML!==h) el.innerHTML=h;
  const n=document.getElementById("entNome"), c=(S.regras&&S.regras.cidade)||""; if(n && n.textContent!==c){ n.textContent=c; n.title=c }
}
function entArquivosHTML(){
  return SEC("Relatório e arquivos", `<button type="button" class="btn full" data-act="pdf" title="O estudo completo em PDF, com a sua marca se estiver ligada">Relatório PDF</button>
      <div class="btngrid"><button type="button" class="btn" data-act="zip" title="Plantas em DXF e modelo IFC, num arquivo .zip">DXF + IFC</button><button type="button" class="btn" data-act="json" title="O estudo inteiro num arquivo, para abrir em outro aparelho">Salvar .json</button><button type="button" class="btn" data-act="jsonAbrir" title="Abre um estudo salvo em .json como um estudo novo">Abrir .json</button><button type="button" class="btn" data-act="copy" title="Os números principais em texto">Copiar resumo</button></div>
      <p class="note" id="dlNote"></p>`,
      {key:"arquivos", open:true, sum:"PDF · DXF + IFC · .json",
       info:"Relatório PDF: o estudo completo para apresentar. DXF + IFC: plantas e modelo 3D para o projetista. .json: o estudo inteiro, para abrir em outro aparelho (os estudos guardados ficam só neste navegador). Abrir .json cria um estudo novo, sem mexer no aberto. Copiar resumo: os números principais em texto."});
}

/* ---------------- Estudos ---------------- */
function entCampo(id, ph, rot, act, btn){
  return `<div class="row" style="flex-wrap:nowrap"><div class="inp" style="flex:1"><input class="t" id="${id}" placeholder="${ph}" aria-label="${rot}" autocomplete="off"></div><button type="button" class="btn" data-act="${act}">${btn}</button></div>`;
}
function entEstudosHTML(){
  // sem o módulo de estudos (não deve acontecer), cai no corpo antigo
  if(typeof EST==="undefined" || typeof estListHTML!=="function") return typeof estCardsHTML==="function"? estCardsHTML() : "";
  const c=cmpHTML(), sm=estSums(), modo=Repo.modo();
  const meus = typeof inicioAbrir==="function"? `<div class="entacts"><button type="button" class="btn sm" data-act="entMeus">Meus estudos</button></div>` : "";
  return `<div id="estUndo">${estUndoHTML()}</div>` +
    RES("Estudo aberto", `<div class="estcur"><b id="estCurNome">${esc(S.nome||"Estudo")}</b><span class="note" id="estCurSt">${estStatus()}</span></div>${meus}`,
      {aside: modo==="nuvem"? "salvo na sua conta" : modo==="idb"||modo==="local"? "salvo neste navegador" : "só nesta sessão"}) +
    SEC("Alternativas salvas", entCampo("cenNome","Ex.: 2 torres · 12 e 9 pav","Nome da alternativa","cenSave","Guardar") + `<div id="cenBox">${cenListHTML()}</div>`,
      {key:"cenarios", open:true, sum:sm.cenarios,
       info:"Variações do produto para comparar (por exemplo, número de torres ou de subsolos). “Guardar como alternativa”, no menu do estudo, faz o mesmo. Abrir uma alternativa troca o estudo atual por ela (Ctrl+Z desfaz). Valem para todos os estudos."}) +
    SEC("Comparação", `<div id="cmpBox">${c}</div>`, {key:"cmp", open:true, id:"cmpSec", hidden:!c, sum:sm.cmp,
      info:"O estudo atual lado a lado com o que você marcou nas listas (quadradinho à esquerda de cada linha). Em verde, o melhor valor de cada linha."}) +
    SEC("Estudos", `<div id="estBox">${estListHTML()}</div>`, {key:"estudos", sum:sm.estudos,
      info: modo==="nuvem"? "Cada estudo é um terreno ou uma proposta diferente. Ficam guardados na sua conta e abrem em qualquer aparelho; o aberto é salvo sozinho a cada mudança (sem internet, ele espera e envia depois)."
        : "Cada estudo é um terreno ou uma proposta diferente. Ficam guardados neste navegador; o aberto é salvo sozinho a cada mudança. Use o .json (aba Entregar) para levar a outro aparelho."}) +
    SEC("Versões", entCampo("vsNome","Ex.: aprovada na reunião","Nome da versão","vsSalvar","Salvar versão") + `<div id="vsBox">${vsListHTML()}</div>`, {key:"versoes", sum:sm.versoes,
      info:`Fotos do estudo aberto ao longo do tempo. Salvas sozinhas a cada ${EST.autoMin} minutos quando ele muda, ou quando você pedir. Restaurar volta o estudo exatamente àquele ponto (Ctrl+Z desfaz); o ícone ao lado abre a versão como um estudo novo.`});
}

/* duas sub-abas: "Entregar" (a primeira) e "Estudos" (estudos, versões, alternativas e comparação — src/ui/estudos.js) */
STEP_R.cen = ()=>{
  const sub=SUBTABS("cen",[["entregar","Entregar"],["estudos","Estudos"]]), s=subAtual("cen"), title="Mostrar e guardar", desc="Entregue o estudo e guarde as alternativas.";
  if(s==="estudos") return { title, desc, sub, subKey:"estudos", body:entEstudosHTML() };
  return { title, desc, sub, subKey:"entregar", after:()=>dlCheck(), body: entResHTML() + entArquivosHTML() };
};
STEP_LIVE.cen = (m,f)=>{
  entResLive(m,f);
  const n=document.getElementById("estCurNome"); if(n && n.textContent!==(S.nome||"Estudo")) n.textContent=S.nome||"Estudo";
  const lm=document.querySelector("#estBox .lrow.on .lm"); if(lm && typeof estMetaAt==="function"){ const t=estMetaAt(); if(lm.textContent!==t) lm.textContent=t }
  const c=document.getElementById("cmpBox"); if(c && c.offsetParent && typeof cmpHTML==="function"){ const h=cmpHTML(), k=JSON.stringify(histNums(m,f)); if(c.dataset.k!==k){ c.dataset.k=k; c.innerHTML=h } }
};
addCard("cen", { key:"reset", order:90, sub:"estudos", html:()=>SEC("Recomeçar", `<button type="button" class="btn ghost" data-act="reset">Restaurar o exemplo</button>`,
  {key:"reset", sum:"voltar ao exemplo", info:"Troca o estudo aberto pelo exemplo inicial. Ctrl+Z desfaz. Os outros estudos, versões e alternativas não mudam."}) });

/* ---------------- abrir um .json (com o próprio <input type=file>: funciona fora do #tabbody) ---------------- */
function jsonEntrada(){
  let i=document.getElementById("jsonIn");
  if(!i){
    i=document.createElement("input"); i.type="file"; i.id="jsonIn"; i.accept=".json,application/json"; i.hidden=true; i.setAttribute("aria-hidden","true"); i.tabIndex=-1;
    i.addEventListener("change",()=>{ const f=i.files&&i.files[0]; i.value=""; if(f) jsonAbrirArquivo(f) });
    document.body.appendChild(i);
  }
  return i;
}
/* abre o seletor de arquivos; o estudo do arquivo entra como um estudo NOVO (o aberto fica guardado) */
function abrirJson(){ const i=jsonEntrada(); i.value=""; i.click() }
function jsonAbrirArquivo(f){ return f.text().then(jsonAbrirTexto, ()=>{ toast("Não consegui ler o arquivo") }) }
async function jsonAbrirTexto(txt){
  let o; try{ o=JSON.parse(txt) }catch(e){ toast("Arquivo inválido"); return false }
  const st = o && typeof o==="object"? (o.S && typeof o.S==="object"? o.S : o) : null;
  if(!st || typeof st!=="object" || !st.lote || !st.produto){ toast("Esse arquivo não é um estudo do Gabarito"); return false }
  const nome = String(st.nome || "Estudo importado").slice(0,120);
  if(typeof estNovo==="function" && typeof EST!=="undefined" && EST.pronto){ await estNovo(st, nome); toast("Arquivo aberto como novo estudo: "+nome); return true }
  // sem o repositório de estudos: troca o estudo aberto (Ctrl+Z desfaz)
  if(typeof histCommit==="function") histCommit();
  S=merge(clone(DEF), clone(st)); BG=null; OTIM=null; lastGar=null;
  const pn=document.getElementById("projName"); if(pn) pn.value=S.nome;
  renderTab(); fit3d(); fit2d(); if(typeof save==="function") save(); if(typeof histCommit==="function") histCommit();
  toast("Arquivo aberto (Ctrl+Z desfaz)"); return true;
}

Object.assign(ACT,{
  pdf: ()=>calcPronto().then(()=>exportPDF()), zip: ()=>calcPronto().then(()=>exportZIP()), json: ()=>calcPronto().then(()=>exportJSON()),
  jsonAbrir: ()=>abrirJson(),
  copy: ()=>{ const txt=resumo(); const fb=()=>{ const ta=document.createElement("textarea"); ta.value=txt; ta.style.cssText="position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); try{ document.execCommand("copy"); toast("Resumo copiado") }catch(e){ toast("Selecione o texto e copie") } ta.remove() };
    try{ navigator.clipboard.writeText(txt).then(()=>toast("Resumo copiado"),fb) }catch(e){ fb() } },
  reset: b=>{ if(b.dataset.arm){ S=clone(DEF); document.getElementById("projName").value=S.nome; BG=null; OTIM=null; renderTab(); fit3d(); fit2d(); toast("Exemplo restaurado (Ctrl+Z desfaz)") } else { b.dataset.arm=1; b.textContent="Confirmar: trocar pelo exemplo"; b.classList.add("on") } },
  entMeus: ()=>{ if(typeof inicioAbrir==="function") inicioAbrir() },
});
/* "+ Novo estudo" (botão da lista de estudos): abre o assistente; sem ele, cria um estudo em branco como antes */
if(typeof ACT.estNovo==="function" && !ACT.estNovoVazio){
  ACT.estNovoVazio = ACT.estNovo;
  ACT.estNovo = ()=>{ if(typeof assAbrir==="function") assAbrir(); else ACT.estNovoVazio() };
}
