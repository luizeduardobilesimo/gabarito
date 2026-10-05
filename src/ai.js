/* ================= regras com IA ================= */
let PDFTXT="";
function loadScript(src){ return new Promise((ok,err)=>{ if(document.querySelector(`script[src="${src}"]`)) return ok(); const s=document.createElement("script"); s.src=src; s.onload=ok; s.onerror=()=>err(new Error("falha ao carregar "+src)); document.head.appendChild(s) }) }
async function aiReadPdf(e){
  const f=e.target.files[0], info=document.getElementById("aiPdfInfo"); if(!f) return;
  info.textContent="lendo PDF…";
  try{
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js");
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
    const lib=window.pdfjsLib; lib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const doc=await lib.getDocument({data:new Uint8Array(await f.arrayBuffer()), isEvalSupported:false}).promise;
    const pages=[];
    for(let i=1;i<=doc.numPages;i++){ const p=await doc.getPage(i); const tc=await p.getTextContent(); pages.push(tc.items.map(x=>x.str).join(" ")); if(i%10===0) info.textContent=`lendo PDF… ${i}/${doc.numPages}` }
    PDFTXT = pages.map((t,i)=>`[pág. ${i+1}] ${t}`).join("\n");
    info.textContent=`${doc.numPages} páginas · ${nf(PDFTXT.length/1000,0)} mil caracteres`;
  }catch(err){ info.textContent="Não consegui ler este PDF aqui. Cole o trecho da tabela no campo abaixo."; PDFTXT="" }
}
function pickRelevant(txt, zona, limit=150000){
  if(txt.length<=limit) return txt;
  const pages=txt.split(/\n(?=\[pág\. )/); const kws=["coeficiente","aproveitamento","taxa de ocupa","recuo","afastamento","gabarito","altura","permeab","vaga","estacionamento","outorga","subsolo","embasamento"];
  const zs=(zona||"").toLowerCase().split(/[\s,\/\-–]+/).filter(w=>w.length>=2);
  const score=p=>{ const l=p.toLowerCase(); let s=0; kws.forEach(k=>{ if(l.includes(k)) s+=1 }); zs.forEach(z=>{ const c=l.split(z).length-1; s+=Math.min(c,5)*2 }); return s };
  const ranked=pages.map((p,i)=>({p,i,s:score(p)})).sort((a,b)=>b.s-a.s); const out=[]; let n=0;
  for(const r of ranked){ if(n+r.p.length>limit) continue; out.push(r); n+=r.p.length }
  return out.sort((a,b)=>a.i-b.i).map(r=>r.p).join("\n");
}
const AI_KEYS={caBas:"CA básico",caMax:"CA máximo",outorgaRS:"Outorga (R$/m²)",toEmb:"TO embasamento",toTorre:"TO torre",permeab:"Permeabilidade",hMax:"Altura máxima (m)",recFrente:"Recuo frontal (m)",recEmb:"Afast. embasamento (m)",afMin:"Afast. mínimo torre (m)",afDiv:"Afast. torre = H ÷",afTorresDiv:"Entre torres = H ÷",recSub:"Recuo subsolo (m)",vagasApto:"Vagas por unidade",m2LojaVaga:"Loja: m² por vaga",aptoMin:"Área mínima unidade (m²)",ncTipo:"Não computável tipo (%)"};
let AI_PROP=null;
async function aiRun(){
  const st=document.getElementById("aiStatus"), out=document.getElementById("aiResult"), btn=document.getElementById("aiGo");
  const zona=document.getElementById("aiZona").value.trim(), pasted=document.getElementById("aiTxt").value.trim();
  const fonte = (pasted? "TEXTO COLADO:\n"+pasted+"\n\n" : "") + (PDFTXT? "PDF:\n"+pickRelevant(PDFTXT, zona) : "");
  if(!fonte){ st.textContent="Envie o PDF ou cole o texto da lei."; return }
  const sample = await useCap("sample");
  if(!sample){ st.textContent="A leitura com IA não está disponível nesta visualização."; return }
  btn.disabled=true; st.textContent="O Claude está lendo…"; out.innerHTML="";
  const prompt = `Você é um arquiteto urbanista brasileiro. Leia o texto de lei de uso e ocupação do solo abaixo e extraia os parâmetros urbanísticos para ${zona? "a zona: "+zona : "a zona principal citada"}, para um edifício residencial multifamiliar vertical.
Responda SOMENTE com JSON neste formato (use null quando o texto não disser):
{"zona": string, "params": {"caBas": número, "caMax": número, "outorgaRS": número|null, "toEmb": fração 0-1, "toTorre": fração 0-1, "permeab": fração 0-1, "hMax": metros|null, "recFrente": metros, "recEmb": metros, "afMin": metros, "afDiv": número (se o afastamento for H/x, informe x), "afTorresDiv": número|null, "recSub": metros|null, "vagasApto": número, "m2LojaVaga": número|null, "aptoMin": m²|null, "ncTipo": fração|null},
 "fontes": {"<chave>": "trecho curto ou página que justifica"}, "observacoes": "regras que o sistema não modela (escalonamentos, exceções, fachada ativa, etc.)"}
Converta percentuais em frações (60% → 0.6). Se a altura for dada em pavimentos, converta usando 3 m por pavimento e diga isso nas observações.

${fonte}`;
  try{
    const ctrl=new AbortController();
    const r = await sample.json(prompt, {modelTier:"complex", signal:ctrl.signal, onText:({text})=>{ st.textContent="O Claude está lendo… "+nf(text.length,0)+" caracteres" }});
    AI_PROP=r; btn.disabled=false; st.textContent="Revise e aplique.";
    const p=r.params||{}; const rows=Object.keys(AI_KEYS).filter(k=>p[k]!=null&&isFinite(+p[k]));
    out.innerHTML = `<p class="note"><b>${esc(r.zona||zona)}</b></p><table class="tbl"><tr><th>Parâmetro</th><th>Atual → proposto</th></tr>
      ${rows.map(k=>`<tr><td><label class="chk" style="margin:0"><input type="checkbox" data-aik="${k}" checked>${AI_KEYS[k]}</label>${r.fontes&&r.fontes[k]?`<div class="note" style="margin:2px 0 0">${esc(String(r.fontes[k]).slice(0,160))}</div>`:""}</td><td>${nf(S.regras[k],2)} → <b>${nf(+p[k],2)}</b></td></tr>`).join("")}</table>
      ${r.observacoes?`<p class="note">${esc(r.observacoes)}</p>`:""}
      <div class="row"><button class="btn pri" id="aiApply">Aplicar selecionados</button></div>`;
    document.getElementById("aiApply").addEventListener("click",()=>{ document.querySelectorAll("[data-aik]:checked").forEach(c=>{ S.regras[c.dataset.aik]=+p[c.dataset.aik] }); if(r.zona) S.regras.cidade=r.zona; renderTab(); toast("Regras aplicadas. Confira e salve.") });
  }catch(err){
    btn.disabled=false;
    st.textContent = err&&err.code==="not_granted"? "Permissão para usar o Claude negada." : err&&err.code==="rate_limited"? "Muitas leituras seguidas. Tente de novo em instantes." : err&&err.code==="prompt_too_large"? "Texto grande demais: cole só a tabela da zona." : "Não consegui extrair as regras. Tente colar só a tabela da zona.";
  }
}
