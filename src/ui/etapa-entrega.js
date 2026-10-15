/* ================= etapa Cenários / Entrega (Estudos · Entregar) =================
   Separado de src/steps.js (UX v3, P0), sem mudar comportamento. Aqui: STEP_R/STEP_LIVE.cen, compareHTML (usada por
   src/ui/estudos.js), o card "Recomeçar" (addCard reset), as ações de arquivos e a leitura do .json (Abrir .json). */
/* ---------------- 7. Cenários ---------------- */
function compareHTML(sel){
  const rows=[["Unidades","units",1,0],["Área privativa","priv",1,0],["Vagas","vagas",1,0],["CA","ca",0,2],["Altura (m)","h",-1,1],["VGV","vgv",1,"mi"],["Custo total","custo",-1,"mi"],["Lucro","lucro",1,"mi"],["Margem","margem",1,"%"],["TIR a.a.","tir",1,"%"],["Exposição máx.","exp",-1,"mi"]];
  const fmt=(v,f)=> v==null?"—": f==="mi"? mi(v) : f==="%"? pct(v) : nf(v,f);
  const lab={CA:TERMO("CA"), VGV:TERMO("VGV"), "TIR a.a.":TERMO("TIR","TIR a.a.")};
  return `<div class="scroll"><table class="tbl multi"><tr><th></th>${sel.map(c=>`<th title="${esc(c.nome)}"><span>${esc(c.nome)}</span></th>`).join("")}</tr>
  ${rows.map(([l,k,dir,f])=>{ const vals=sel.map(c=>c.k[k]); const ok=vals.filter(v=>v!=null); const best= dir===0||!ok.length? null : dir>0? Math.max(...ok) : Math.min(...ok);
    return `<tr><td>${lab[l]||l}</td>${vals.map(v=>`<td class="${v!=null&&v===best&&sel.length>1?"best":""}">${fmt(v,f)}</td>`).join("")}</tr>` }).join("")}</table></div>`;
}
/* duas sub-abas: "Estudos" (estudos, versões, cenários e comparação — src/ui/estudos.js) e "Entregar"
   (arquivos aqui; apresentação/link em src/ui/apresentacao.js; marca em src/ui/marca.js; recomeçar no fim) */
STEP_R.cen = ()=>{
  const sub=SUBTABS("cen",[["estudos","Estudos"],["entregar","Entregar"]]), s=subAtual("cen");
  if(s==="entregar") return { sub, subKey:"entregar", after:()=>dlCheck(), body:
    SEC("Relatório e arquivos", `<button type="button" class="btn pri full" data-act="pdf">Relatório PDF</button>
      <div class="btngrid"><button type="button" class="btn" data-act="zip" title="Plantas em DXF e modelo IFC, num arquivo .zip">DXF + IFC</button><button type="button" class="btn" data-act="json" title="O estudo inteiro num arquivo, para abrir em outro aparelho">Salvar .json</button><button type="button" class="btn" data-act="jsonAbrir">Abrir .json</button><button type="button" class="btn" data-act="copy">Copiar resumo</button></div>
      <input type="file" id="jsonIn" accept=".json,application/json" hidden><p class="note" id="dlNote"></p>`,
      {key:"arquivos", open:true, info:"Relatório PDF: o estudo completo para apresentar. DXF + IFC: plantas e modelo 3D para o projetista. .json: o estudo inteiro, para abrir em outro aparelho (estudos e cenários ficam só neste navegador). Copiar resumo: os números principais em texto."}) };
  return { sub, subKey:"estudos", body: typeof estCardsHTML==="function"? estCardsHTML() : "" };
};
STEP_LIVE.cen = (m,f)=>{
  const n=document.getElementById("estCurNome"); if(n && n.textContent!==(S.nome||"Estudo")) n.textContent=S.nome||"Estudo";
  const lm=document.querySelector("#estBox .lrow.on .lm"); if(lm && typeof estMetaAt==="function"){ const t=estMetaAt(); if(lm.textContent!==t) lm.textContent=t }
  const c=document.getElementById("cmpBox"); if(c && c.offsetParent && typeof cmpHTML==="function"){ const h=cmpHTML(), k=JSON.stringify(histNums(m,f)); if(c.dataset.k!==k){ c.dataset.k=k; c.innerHTML=h } }
};
addCard("cen", { key:"reset", order:90, sub:"entregar", html:()=>SEC("Recomeçar", `<button type="button" class="btn ghost" data-act="reset">Restaurar o exemplo</button>`,
  {key:"reset", sum:"voltar ao exemplo", info:"Troca o estudo aberto pelo exemplo inicial. Ctrl+Z desfaz. Os outros estudos, versões e cenários não mudam."}) });
Object.assign(ACT,{
  pdf: ()=>calcPronto().then(()=>exportPDF()), zip: ()=>calcPronto().then(()=>exportZIP()), json: ()=>calcPronto().then(()=>exportJSON()),
  jsonAbrir: ()=>{ const i=document.getElementById("jsonIn"); if(i){ i.value=""; i.click() } },
  copy: ()=>{ const txt=resumo(); const fb=()=>{ const ta=document.createElement("textarea"); ta.value=txt; ta.style.cssText="position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); try{ document.execCommand("copy"); toast("Resumo copiado") }catch(e){ toast("Selecione o texto e copie") } ta.remove() };
    try{ navigator.clipboard.writeText(txt).then(()=>toast("Resumo copiado"),fb) }catch(e){ fb() } },
  reset: b=>{ if(b.dataset.arm){ S=clone(DEF); document.getElementById("projName").value=S.nome; BG=null; OTIM=null; renderTab(); fit3d(); fit2d(); toast("Exemplo restaurado (Ctrl+Z desfaz)") } else { b.dataset.arm=1; b.textContent="Confirmar: trocar pelo exemplo"; b.classList.add("on") } },
});
TB.addEventListener("change",e=>{
  const t=e.target;
  if(t.id==="jsonIn"){ const f=t.files[0]; if(!f) return; f.text().then(x=>{ try{ const o=JSON.parse(x); S=merge(clone(DEF), o.S||o); document.getElementById("projName").value=S.nome; renderTab(); fit3d(); fit2d(); toast("Projeto aberto") }catch(err){ toast("Arquivo inválido") } }) }});
