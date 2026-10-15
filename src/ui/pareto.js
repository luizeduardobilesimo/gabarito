/* ================= etapa Produto: trocas entre critérios (fronteira de Pareto, item 1.3) =================
   Lê OTIM.pareto (gerado por otimizar() em src/optim.js, na página ou no Worker). Os pontos do gráfico são combinações
   conferidas com a garagem real; aplicar um ponto reproduz os números mostrados. Filtros mínimos ficam em S.otim. */
let PF_SEL = null; // índice em OTIM.pareto.pts
(function(){ const s=document.createElement("style"); s.textContent=`
.pf-chart{position:relative;border:1px solid var(--line);border-radius:10px;background:var(--surface-2);padding:6px 4px 2px}
.pf-chart svg{display:block;width:100%;height:auto}
.pf-chart .pt{cursor:pointer}
.pf-chart .pt:focus{outline:none}
.pf-chart .pt:focus-visible circle.m{stroke:var(--ink);stroke-width:2}
.pf-leg{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:11px;color:var(--muted);align-items:center}
.pf-leg i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;vertical-align:-1px}
.pf-tip{position:absolute;pointer-events:none;background:var(--surface);border:1px solid var(--line-2);border-radius:8px;box-shadow:var(--shadow-s);padding:6px 8px;font-size:11px;line-height:1.4;color:var(--ink);white-space:nowrap;z-index:2}
.pf-tip b{font-family:var(--f-mono);font-weight:500}
`; document.head.appendChild(s) })();

const pfDesc = r => `${r.nT} torre${r.nT>1?"s":""} × ${r.pav} pav · ${r.N} un/andar · ${r.units} un · ${r.sub} subsolo${r.sub!==1?"s":""}${r.gac?` + ${r.gac} gar. elevada${r.gac>1?"s":""}`:""}${r.forma&&r.dev>0.005?` · unidades ${pct(r.dev,0)} maiores`:""}`;
const pfFiltros = () => ({ vagas: !!S.otim.fVagas, solMin: S.otim.fSol? +S.otim.solMin||0 : null });
function pfCrit(){ const ks=(OTIM&&OTIM.pareto&&OTIM.pareto.criterios)||["lucro","sol","vagas"]; return ks.map(k=>PARETO_CRIT[k]).filter(Boolean) }
/** pontos com estado de filtro e de fronteira (a fronteira é recalculada só entre os que passam nos filtros) */
function pfPontos(){
  const P=(OTIM&&OTIM.pareto&&OTIM.pareto.pts)||[], fl=pfFiltros(), idx=P.map((p,i)=>i).filter(i=>paretoFiltra(P[i],fl));
  const fr=new Set(paretoFronteira(idx.map(i=>P[i]), pfCrit()).map(k=>idx[k]));
  return P.map((p,i)=>({p, i, passa:idx.includes(i), front:fr.has(i)}));
}
function paretoCardHTML(){
  if(!OTIM || !OTIM.pareto || !OTIM.pareto.pts.length) return "";
  const O=S.otim, src=OTIM.solFonte==="unidades"? "média das unidades, com sombras (módulo Unidades)" : "horas de sol direto nas fachadas no inverno (aproximação)";
  const nomes=pfCrit().map(c=>c.nome.toLowerCase()), lista=nomes.length>1? nomes.slice(0,-1).join(", ")+" e "+nomes[nomes.length-1] : nomes.join(""), info=`Cada ponto é uma combinação conferida com a garagem real. Em destaque, a fronteira: nenhuma outra opção é melhor em ${lista} ao mesmo tempo. ${O.efic?"Eficiência global: área privativa ÷ área total construída. ":""}${O.vc?"V/C: preço por m² privativo ÷ custo de referência (CUB × fator). ":""}Toque num ponto para ver e aplicar. Sol médio: ${src}. ${OTIM.ventoOn?"Conforto ao vento: 1 − fração do lote com vento forte (vento 2D, aproximado). ":""}Vagas pelo layout rápido da garagem; na tela o layout completo pode achar mais algumas.`;
  return SEC("Trocas entre critérios", `<div class="chips"><button type="button" class="chip" data-act="pfF" data-k="fVagas" aria-pressed="${!!O.fVagas}">Vagas ≥ exigidas</button><button type="button" class="chip" data-act="pfF" data-k="fSol" aria-pressed="${!!O.fSol}">Sol médio ≥ ${nf(+O.solMin||0,1)} h</button></div>
    ${O.fSol? KV(NUM("otim.solMin","Sol médio mínimo","h",{step:0.5,min:0,max:14,fx:"pf"})) : ""}
    <div class="pf-chart" id="pfChart"></div>
    <div class="pf-leg"><span><i style="background:var(--accent)"></i>fronteira</span><span><i style="border:1.5px solid var(--muted)"></i>outras</span><span><i style="border:2px solid var(--brand)"></i>estudo atual</span><span>tamanho = nº de vagas</span></div>
    <p class="note" id="pfPill"></p><div id="pfDet"></div>
    <details class="pr-more" id="pfMore" hidden><summary id="pfMoreT">Todas da fronteira</summary><div class="list" id="pfFront"></div></details>`, {id:"pfCard", key:"pr-pareto", open:true, info});
}
FX.pf = ()=>{ save(); paretoLive() };
Object.assign(ACT, {
  pfF: b=>{ const k=b.dataset.k; S.otim[k]=!S.otim[k]; save(); renderTab() },
  pfSel: el=>{ PF_SEL=+el.dataset.i; paretoLive() },
  pfApply: b=>{ const r=OTIM&&OTIM.pareto&&OTIM.pareto.pts[+b.dataset.i]; if(!r) return; PF_SEL=+b.dataset.i; aplicarOtim(r); renderTab(); fit3d();
    toast(`Aplicado: lucro ${mi(r.lucro)} · sol ${nf(r.sol,1)} h · ${r.vagas}/${r.req} vagas`) },
  otk2: b=>{ const k=b.dataset.k; S.otim[k]=!S.otim[k]; save(); renderTab() },
});
/* chips extras do otimizador (vários critérios, vento, malha) — chamados de STEP_R.produto */
function paretoChipsHTML(){
  const O=S.otim, c=(k,l,t)=>`<button type="button" class="chip" data-act="otk2" data-k="${k}" aria-pressed="${!!O[k]}" ${t?`title="${esc(t)}"`:""}>${l}</button>`;
  return c("mc","Comparar sol e vagas","Além do objetivo, mostra as trocas entre lucro, sol médio das unidades e vagas") +
    (O.mc? c("efic","Eficiência global","Inclui a eficiência global (privativa ÷ área construída) entre os critérios da fronteira") + c("vc","V/C","Inclui a relação venda/custo (preço ÷ CUB × fator) entre os critérios da fronteira") + c("vento","Conforto ao vento","Roda o vento 2D em cada opção conferida — deixa a análise mais lenta") : "") +
    (O.mc && typeof estruturaMalhas==="function"? c("malha","Malha estrutural","Calcula a malha estrutural de cada opção conferida") : "");
}
function paretoLive(){
  const ch=document.getElementById("pfChart"); if(!ch || !OTIM || !OTIM.pareto) return;
  const L=pfPontos(), cur=window._last; let solAtual=null;
  try{ if(cur && cur.m){ const sig=JSON.stringify([cur.m.T.map(t=>[t.plate,t.H]), S.entorno, S.lote.lat, S.lote.norte, OTIM.solFonte]);
    if(paretoLive._sig!==sig){ paretoLive._sig=sig; paretoLive._sol=otimSol(S, cur.m, OTIM.solFonte==="unidades").h } solAtual=paretoLive._sol } }catch(e){}
  // escalas (um só eixo de cada; lucro em R$ mi)
  const xs=L.map(o=>o.p.lucro/1e6), ys=L.map(o=>o.p.sol); if(cur){ xs.push(cur.f.lucro/1e6); if(solAtual!=null) ys.push(solAtual) }
  const nice=(a,b)=>{ if(a===b){ a-=1; b+=1 } const pad=(b-a)*0.08; return [a-pad,b+pad] };
  const [x0,x1]=nice(Math.min(...xs),Math.max(...xs)), [y0,y1]=nice(Math.min(...ys),Math.max(...ys));
  const W=340, H=232, pl=34, pr=12, pt=24, pb=30, sx=v=>pl+(W-pl-pr)*(v-x0)/(x1-x0), sy=v=>pt+(H-pt-pb)*(y1-v)/(y1-y0);
  const vs=L.map(o=>o.p.vagas), v0=Math.min(...vs), v1=Math.max(...vs), rad=v=>4+5*Math.sqrt((v-v0)/Math.max(1,v1-v0));
  const tick=(a,b,n)=>{ const st=Math.pow(10,Math.floor(Math.log10((b-a)/n))), e=[1,2,2.5,5,10].map(k=>k*st).find(s=>(b-a)/s<=n)||st*10, out=[]; for(let v=Math.ceil(a/e)*e; v<=b+1e-9; v+=e) out.push(+v.toFixed(6)); return out };
  const gx=tick(x0,x1,4), gy=tick(y0,y1,4), dec=t=>t.length>1 && Math.abs(t[1]-t[0])<1? 1 : 0, mono='font-family="DM Sans, system-ui, sans-serif" font-size="9" fill="var(--muted)"';
  const ord=L.slice().sort((a,b)=>(a.front-b.front)||(a.passa-b.passa)); // fronteira por cima
  const frL=L.filter(o=>o.front).sort((a,b)=>a.p.lucro-b.p.lucro);
  ch.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Opções: lucro no eixo horizontal, sol médio no vertical, tamanho pelo número de vagas">
    ${gy.map(v=>`<line x1="${pl}" x2="${W-pr}" y1="${sy(v)}" y2="${sy(v)}" stroke="var(--line)" stroke-dasharray="2 3"/><text x="${pl-5}" y="${sy(v)+3}" text-anchor="end" ${mono}>${nf(v,dec(gy))}</text>`).join("")}
    ${gx.map(v=>`<text x="${sx(v)}" y="${H-pb+13}" text-anchor="middle" ${mono}>${nf(v,dec(gx))}</text>`).join("")}
    <line x1="${pl}" x2="${W-pr}" y1="${H-pb}" y2="${H-pb}" stroke="var(--line-2)"/>
    <text x="${W-pr}" y="${H-3}" text-anchor="end" font-size="9.5" fill="var(--muted)">lucro (R$ mi) →</text><text x="${pl-28}" y="${pt-11}" font-size="9.5" fill="var(--muted)">↑ sol médio (h)</text>
    ${frL.length>1? `<path d="${frL.map((o,k)=>(k?"L":"M")+sx(o.p.lucro/1e6).toFixed(1)+","+sy(o.p.sol).toFixed(1)).join("")}" fill="none" stroke="var(--accent)" stroke-width="1.2" stroke-opacity=".45" stroke-dasharray="3 3"/>` : ""}
    ${cur&&solAtual!=null? `<circle cx="${sx(cur.f.lucro/1e6)}" cy="${sy(solAtual)}" r="9" fill="none" stroke="var(--brand)" stroke-width="2"><title>Estudo atual · lucro ${mi(cur.f.lucro)} · sol ${nf(solAtual,1)} h</title></circle>` : ""}
    ${ord.map(o=>{ const p=o.p, x=sx(p.lucro/1e6), y=sy(p.sol), r=rad(p.vagas), sel=PF_SEL===o.i;
      return `<g class="pt" data-act="pfSel" data-i="${o.i}" tabindex="0" role="button" aria-label="${esc(pfDesc(p))}" data-tip="${esc(`${mi(p.lucro)} · sol ${nf(p.sol,1)} h · ${p.vagas}/${p.req} vagas`)}" opacity="${o.passa?1:0.28}">
        <circle cx="${x}" cy="${y}" r="${Math.max(r+5,11)}" fill="transparent"/>
        <circle class="m" cx="${x}" cy="${y}" r="${r}" fill="${o.front?"var(--accent)":"var(--surface)"}" stroke="${o.front?"var(--surface)":"var(--muted)"}" stroke-width="${o.front?2:1.5}"/>
        ${sel? `<circle cx="${x}" cy="${y}" r="${r+4}" fill="none" stroke="var(--ink)" stroke-width="1.5"/>` : ""}</g>` }).join("")}
  </svg><div class="pf-tip" id="pfTip" hidden></div>`;
  const nF=frL.length, nP=L.filter(o=>o.passa).length, pill=document.getElementById("pfPill"); // detalhe do ponto escolhido
  const s=PF_SEL!=null && L[PF_SEL]? L[PF_SEL] : null;
  if(pill) pill.textContent=`${nF} na fronteira · ${nP} de ${L.length} nos filtros${s?"":" · toque num ponto"}`;
  const card=(o,top)=>{ const p=o.p; return `<div class="res ${top?"top1":""}"><div class="rh"><b>${o.front?"Fronteira":"Opção"} · ${esc((MIX_PRESETS[p.pk]||{}).nome||p.pk)}</b><button class="btn sm ${top?"pri":""}" data-act="pfApply" data-i="${o.i}">Aplicar</button></div>
    <div class="note">${pfDesc(p)}${o.passa?"":" · fora dos filtros"}</div>
    <div class="rm"><span>Lucro<b>${mi(p.lucro)}</b></span><span>Margem s/ VGV<b>${pct(p.margem)}</b></span><span>Sol médio<b>${nf(p.sol,1)} h</b></span><span>Vagas<b style="color:${p.vagas<p.req?"var(--bad)":"var(--ink)"}">${p.vagas}/${p.req}</b></span>
    ${p.tir!=null?`<span>TIR<b>${pct(p.tir)}</b></span>`:""}${S.otim.efic&&p.efic!=null?`<span>Efic. global<b>${pct(p.efic,1)}</b></span>`:""}${S.otim.vc&&p.vc!=null?`<span>V/C<b>${nf(p.vc,2)}×</b></span>`:""}${p.forma?`<span>Unidades<b>${p.dev>0.005?"+"+pct(p.dev,0):"no mix"}</b></span>`:""}${p.vento!=null?`<span>Vento<b>${pct(p.vento,0)}</b></span>`:""}${p.malha?`<span>Malha<b>${esc(p.malha.nome)}</b></span>`:""}</div></div>` };
  setHTML("pfDet", s? card(s,true) : nF? "" : `<p class="note">Nenhuma opção passa nos filtros. Afrouxe um deles.</p>`);
  const resto=frL.slice().reverse().filter(o=>!s||o.i!==s.i), more=document.getElementById("pfMore"), mt=document.getElementById("pfMoreT");
  if(more) more.hidden=!resto.length;
  if(mt) mt.textContent=`${s?"Outras":"Todas"} da fronteira${S.otim.fVagas||S.otim.fSol?" (com os filtros)":""} · ${resto.length}`;
  setHTML("pfFront", resto.map(o=>card(o,false)).join(""));
  // dica ao passar o mouse
  const tip=document.getElementById("pfTip");
  ch.querySelectorAll(".pt").forEach(el=>{ el.addEventListener("mouseenter",()=>{ const r=ch.getBoundingClientRect(), b=el.getBoundingClientRect(); tip.textContent=el.dataset.tip; tip.hidden=false;
      const x=Math.min(r.width-tip.offsetWidth-4, Math.max(4, b.left-r.left+b.width/2-tip.offsetWidth/2)); tip.style.left=x+"px"; tip.style.top=Math.max(2,b.top-r.top-tip.offsetHeight-6)+"px" });
    el.addEventListener("mouseleave",()=>{ tip.hidden=true });
    el.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); PF_SEL=+el.dataset.i; paretoLive() } }) });
}
