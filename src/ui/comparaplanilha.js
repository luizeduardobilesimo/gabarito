/* ================= Fase E (interface): comparar o fluxo do Gabarito com a planilha da empresa =================
   Card "Comparar com a sua planilha" na Viabilidade › Riscos (último, fechado por padrão). Cálculo em src/calc/comparafluxo.js;
   leitura de arquivos em src/ui/arquivos.js. A planilha importada fica só na memória da página (CMPU); a comparação é
   refeita a cada cálculo (premissas mudam → o gráfico acompanha). Nada muda no estudo até "Aplicar" numa sugestão (Ctrl+Z desfaz). */
{ const st=document.createElement("style"); st.id="cmpCSS"; st.textContent=`
.cmpLeg{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:11px;color:var(--muted);margin-top:2px}
.cmpLeg i{display:inline-block;width:14px;height:0;border-top:2px solid;vertical-align:middle;margin-right:5px}
.cmpLi{grid-template-columns:auto minmax(0,1fr) auto}
.cmpLi .tt{font-size:12px;line-height:1.35;font-weight:500}
.cmpLi .ss{font-size:10.5px}`; document.head.appendChild(st) }

const CMPU = { dados:[], cab:[], nome:"", mapa:{}, plan:null, cmp:null, sug:[], desl:0, serie:"acum" };
const cmpMi = v => (v<0?"−":"")+mi(Math.abs(v)).replace("R$ ","");
const cmpTir = v => v==null? "—" : pct(v);

function cmpLer(){
  if(!CMPU.dados.length){ CMPU.plan=null; return }
  CMPU.plan=comparaLer(CMPU.dados, CMPU.mapa);
}
function cmpCalc(f){
  CMPU.cmp=null; CMPU.sug=[];
  if(!CMPU.plan || !CMPU.plan.ok || !f) return;
  CMPU.cmp=comparaFluxo(CMPU.plan, f, { desl:CMPU.desl, tma:S.fin.tma });
  CMPU.sug=comparaSugestoes(CMPU.cmp, S, f);
}

/* ---------- gráfico: duas linhas sobrepostas ---------- */
function cmpChart(c){
  const ser=CMPU.serie==="acum"? { gab:c.acum.gab, plan:c.acum.plan } : (c.linhas.find(l=>l.k===CMPU.serie)||c.linhas[c.linhas.length-1]);
  const G=ser.gab, P=ser.plan, N=G.length, W=360, H=150, pl=40, pr=6, pt=8, pb=20;
  const all=[...G,...P], mn=Math.min(0,...all), mx=Math.max(0,...all), sx=i=>pl+(W-pl-pr)*i/Math.max(1,N-1), sy=v=>pt+(H-pt-pb)*(1-(v-mn)/((mx-mn)||1));
  const path=a=>a.map((v,i)=>(i?"L":"M")+sx(i).toFixed(1)+","+sy(v).toFixed(1)).join("");
  const shade=c.divergencias.filter(d=>d.mes0!=null&&d.mes1!=null&&d.tipo==="janela"&&(CMPU.serie==="acum"||d.linha===CMPU.serie)).map(d=>`<rect x="${sx(d.mes0).toFixed(1)}" y="${pt}" width="${Math.max(2,sx(d.mes1)-sx(d.mes0)).toFixed(1)}" height="${H-pt-pb}" fill="var(--warn)" fill-opacity=".1"/>`).join("");
  const ticks=[mn,(mn+mx)/2,mx].map(v=>`<line x1="${pl}" x2="${W-pr}" y1="${sy(v).toFixed(1)}" y2="${sy(v).toFixed(1)}" stroke="var(--line)" stroke-dasharray="2 3"/><text x="${pl-4}" y="${(sy(v)+3).toFixed(1)}" font-size="9" text-anchor="end" fill="var(--muted)" font-family="DM Sans, system-ui, sans-serif">${nf(v/1e6,1)}</text>`).join("");
  const z=mn<0&&mx>0? `<line x1="${pl}" x2="${W-pr}" y1="${sy(0).toFixed(1)}" y2="${sy(0).toFixed(1)}" stroke="var(--ink)" stroke-opacity=".5"/>` : "";
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Fluxo do Gabarito e da planilha, sobrepostos">${shade}${ticks}${z}
    <path d="${path(G)}" fill="none" stroke="var(--accent)" stroke-width="2"/><path d="${path(P)}" fill="none" stroke="var(--mark)" stroke-width="2" stroke-dasharray="5 3"/>
    <text x="${pl}" y="${H-5}" font-size="9" fill="var(--muted)">mês 0</text><text x="${W-pr}" y="${H-5}" font-size="9" text-anchor="end" fill="var(--muted)">mês ${N-1} · R$ mi</text></svg>
    <div class="cmpLeg"><span><i style="border-color:var(--accent)"></i>Gabarito</span><span><i style="border-color:var(--mark);border-top-style:dashed"></i>Planilha</span>${shade?`<span style="color:var(--warn-t)">trecho divergente</span>`:""}</div>`;
}

function cmpBody(){
  const imp=`<div class="row"><label class="btn sm${CMPU.dados.length?" ghost":""}" style="cursor:pointer">${CMPU.dados.length?"Trocar planilha":"Importar planilha"}<input type="file" id="cmpFile" accept="${PLA_ACCEPT}" hidden></label>
    <button type="button" class="btn sm ghost" data-act="fluxoModelo">Baixar modelo</button>${CMPU.dados.length?`<button type="button" class="btn sm ghost" data-act="fluxoLimpa">Limpar</button>`:""}</div>`;
  if(!CMPU.dados.length) return imp + `<p class="note">CSV ou XLSX: mês, receitas, custos e saldo.</p>`;
  const p=CMPU.plan, nome=`<p class="note">${esc(CMPU.nome)}${p&&p.ok?` · ${p.nLinhas} linhas · ${p.T} meses`:""}</p>`;
  const adv=ADV(
    KV(CMP_CAMPOS.map(c=>plaSelect("cmpMap-"+c.k,"data-cmp",c.k,c.rot,CMPU.cab,CMPU.mapa[c.k],c.k==="saldo")).join("")) +
    `<div class="fld"><label class="fl" for="cmpDesl">Deslocar a planilha${INFO("Meses somados ao mês de cada linha da planilha: use quando ela começa em outra data (positivo = a planilha começa antes do Gabarito; negativo = depois).")}</label><div class="inp"><input id="cmpDesl" type="number" step="1" inputmode="numeric" data-cmp-desl="1" value="${CMPU.desl}"><em>meses</em></div></div>`, { key:"cmp" });
  if(!p || !p.ok) return imp + nome + `<p class="calAv">${esc(p? p.motivo : "Sem dados.")} Confira as colunas em “Mais opções”.</p>` + adv;
  return imp + nome + `<div id="cmpRes"></div>` + adv;
}
/* parte viva: métricas, gráfico, divergências e sugestões */
function cmpResHTML(){
  const c=CMPU.cmp, p=CMPU.plan; if(!c) return "";
  const g=c.metricas.gab, q=c.metricas.plan;
  const d=(a,b,inv)=>{ const x=a-b, bom=inv? x<0 : x>0; return `<span style="color:${Math.abs(x)<1?"var(--muted)":bom?"var(--ok)":"var(--bad)"}">${x>=0?"+":"−"}${cmpMi(Math.abs(x))}</span>` };
  const dt=(a,b)=> a==null||b==null? "—" : `${a-b>=0?"+":"−"}${nf(Math.abs(a-b)*100,1)} p.p.`;
  const tab=`<table class="tbl multi" style="table-layout:fixed"><tr><th style="width:26%"></th><th>Gabarito</th><th>Planilha</th><th>Diferença</th></tr>
    <tr><td>Lucro</td><td>${cmpMi(g.lucro)}</td><td>${cmpMi(q.lucro)}</td><td>${d(q.lucro,g.lucro)}</td></tr>
    <tr><td>TIR a.a.</td><td>${cmpTir(g.tirA)}</td><td>${cmpTir(q.tirA)}</td><td>${dt(q.tirA,g.tirA)}</td></tr>
    <tr><td>VPL</td><td>${cmpMi(g.vpl)}</td><td>${cmpMi(q.vpl)}</td><td>${d(q.vpl,g.vpl)}</td></tr>
    <tr><td>Exposição</td><td>${cmpMi(-g.exp)}</td><td>${cmpMi(-q.exp)}</td><td>${d(-q.exp,-g.exp,true)}</td></tr>
    <tr><td>Payback</td><td>${g.pay==null?"—":"mês "+g.pay}</td><td>${q.pay==null?"—":"mês "+q.pay}</td><td>${g.pay==null||q.pay==null?"—":(q.pay-g.pay>=0?"+":"−")+Math.abs(q.pay-g.pay)+" m"}</td></tr></table>`;
  const rot={receita:"Receitas", obra:"Obra", terreno:"Terreno", indiretos:"Indiretos"};
  const opts=[["acum","Caixa acumulado"],...c.linhas.filter(l=>l.k!=="saldo").map(l=>[l.k,rot[l.k]||l.nome])];
  const seg=`<div class="seg" role="group" aria-label="Linha do gráfico" style="display:flex;flex-wrap:wrap">${opts.map(([k,l])=>`<button type="button" data-act="fluxoSerie" data-v="${k}" aria-pressed="${CMPU.serie===k}">${l}</button>`).join("")}</div>`;
  const imp=v=>{ const r=Math.abs(v)/Math.max(1,Math.abs(g.lucro)); return r>0.05?"bad":r>0.01?"warn":"ok" };
  const divs=c.divergencias.length? `<div class="grp">Divergências${INFO("Ordenadas pelo valor em jogo. “Entre os meses” é um trecho em que a linha difere mais de 6%.")}</div><div class="list">${c.divergencias.slice(0,6).map(x=>`<div class="li cmpLi"><span class="dot ${imp(x.impacto)}" aria-hidden="true"></span><span class="tt">${esc(x.msg)}</span><span class="ss">${cmpMi(x.impacto)}</span></div>`).join("")}</div>`
    : `<p class="note">${c.zero? "Os dois fluxos são iguais." : "Sem divergências relevantes: as diferenças ficam abaixo de 3% por linha."}</p>`;
  const sug=CMPU.sug.length? `<div class="grp">Ajustes sugeridos${INFO("Quando a diferença é explicável por uma premissa do Gabarito, o ajuste aparece aqui. “aprox.” = efeito estimado; confira o gráfico depois de aplicar.")}</div><div class="list">${CMPU.sug.map((s,i)=>`<div class="li cmpLi"><span class="dot ok" aria-hidden="true"></span><span class="tt">${esc(s.rot)}${s.aprox?` <span class="pill">aprox.</span>`:""}<span class="ss" style="display:block">${esc(s.det)}</span></span>${s.set?`<button type="button" class="btn sm" data-act="fluxoAplica" data-i="${i}">Aplicar</button>`:`<span class="pill">só aviso</span>`}</div>`).join("")}</div>` : "";
  const av=[...new Set([...(p.avisos||[]),...(c.avisos||[])])].map(a=>`<p class="calAv">${esc(a)}</p>`).join("");
  return tab + `<div class="grp">Fluxo sobreposto</div>` + seg + cmpChart(c) + divs + sug + av;
}
function cmpSum(){
  const c=CMPU.cmp; if(!c) return CMPU.dados.length? "revise as colunas" : "sem planilha";
  return c.zero? "fluxos iguais" : `<b>${c.divergencias.length}</b> divergência${c.divergencias.length===1?"":"s"} · TIR ${cmpTir(c.metricas.plan.tirA)} × ${cmpTir(c.metricas.gab.tirA)}`;
}

/* ---------- ações ---------- */
function cmpAtualiza(){
  const L=window._last; if(L) cmpCalc(L.f);
  setSum("cmpPlan", cmpSum());
  if(CMPU.cmp && document.getElementById("cmpRes")) setHTML("cmpRes", cmpResHTML());
}
async function cmpCarregar(file){
  try{
    const r=await plaLerArquivo(file), h=plaCabecalho(r.matriz);
    CMPU.nome=r.nome+(r.aba?` (${r.aba})`:""); CMPU.cab=h.cab; CMPU.dados=h.dados; CMPU.mapa=comparaMapa(h.cab); CMPU.desl=0;
    cmpLer(); const e=document.getElementById("cmpBox"); if(e) e.innerHTML=cmpBody(); cmpAtualiza();
    if(CMPU.plan && !CMPU.plan.ok) toast(CMPU.plan.motivo);
  }catch(e){ toast(e&&e.message||"Não consegui ler o arquivo") }
}
Object.assign(ACT, {
  fluxoModelo: ()=>plaBaixarModelo("modelo-fluxo-da-planilha.csv", comparaModeloCSV()),
  fluxoLimpa: ()=>{ CMPU.dados=[]; CMPU.cab=[]; CMPU.plan=CMPU.cmp=null; CMPU.sug=[]; CMPU.nome=""; const e=document.getElementById("cmpBox"); if(e) e.innerHTML=cmpBody(); setSum("cmpPlan", cmpSum()) },
  fluxoSerie: b=>{ CMPU.serie=b.dataset.v; setHTML("cmpRes", cmpResHTML()) },
  fluxoAplica: b=>{ const s=CMPU.sug[+b.dataset.i]; if(!s) return; const n=comparaAplicar(S, s); if(!n){ toast("Esse valor já está no estudo"); return } renderTab(); update(); toast(`${s.rot}: aplicado. Ctrl+Z desfaz.`) },
});

addCard("viab", { key:"cmpPlan", sub:"risco", order:70,
  html: ()=>SEC("Comparar com a sua planilha", `<div id="cmpBox">${cmpBody()}</div>`, { key:"cmpPlan", info:"Comparar com planilha", sum:cmpSum() }),
  after: ()=>{
    const box=document.getElementById("cmpBox"); if(!box) return;
    box.addEventListener("change", async e=>{ const t=e.target;
      if(t.id==="cmpFile"){ await cmpCarregar(t.files&&t.files[0]); t.value="" }
      else if(t.dataset.cmp){ CMPU.mapa[t.dataset.cmp]=+t.value; cmpLer(); box.innerHTML=cmpBody(); cmpAtualiza() }
      else if(t.dataset.cmpDesl){ CMPU.desl=Math.round(+t.value||0); cmpAtualiza() } });
    if(CMPU.plan && CMPU.plan.ok) cmpAtualiza();
  },
  live: (m,f,fast)=>{
    if(fast || !CMPU.dados.length){ setSum("cmpPlan", cmpSum()); return }
    cmpCalc(f); setSum("cmpPlan", cmpSum());
    if(finVis("cmpRes")) setHTML("cmpRes", cmpResHTML());
  }
});
