/* ================= Viabilidade: orçamento, cenários, sensibilidade, Monte Carlo e terreno (itens 3.1–3.3) =================
   Montado por STEP_R.viab / STEP_LIVE.viab (steps.js). Cálculo em src/calc/{orcamento,cub,fluxo,terreno}.js. */
const FIN_UI = { mc: { sig:null, res:null, run:false, prog:0, tok:0 } };
const finOpen = key => { const d=document.querySelector(`#tabbody details[data-key="${key}"]`); return !d || d.open };
const finPP = (v,d=1) => (v>=0?"+":"−")+nf(Math.abs(v)*100,d);
const finTir = v => v==null? "—" : pct(v);
/* select ligado ao estado (data-p) */
function finSEL(p, opts, label, o={}){
  const v=getP(S,p), id="f-"+p.replace(/\./g,"-");
  return `<div class="fld${o.wide?" wide":""}" data-q="${esc((label+" "+(o.q||"")).toLowerCase())}"><label class="fl" for="${id}">${label}</label><select class="sel" id="${id}" data-p="${p}" data-t="s" data-fx="${o.fx||"upd"}" ${o.rr?'data-rr="1"':""}>${opts.map(([k,l])=>`<option value="${esc(k)}" ${String(v)===String(k)?"selected":""}>${esc(l)}</option>`).join("")}</select>${o.sub!=null?`<div class="fsub" id="sub-${p.replace(/\./g,"-")}">${o.sub}</div>`:""}</div>`;
}
/* campo numérico sem rótulo (grades de cenários) */
function finIN(p, unit, o={}){ const v=getP(S,p); return `<div class="inp"><input type="number" inputmode="decimal" data-p="${p}" ${o.pct?'data-pct="1"':""} data-fx="upd" step="${o.step??"any"}" value="${fmtIn(v,o.pct)}" aria-label="${esc(o.label||p)}">${unit?`<em>${unit}</em>`:""}</div>` }

/* ---------------- 3.1 Orçamento ---------------- */
function finOrcHTML(){
  const O=S.orc, par=O.modo==="param", lista=cubLista(S);
  const coef = par ? GRP("Padrões") + KV(
      finSEL("orc.solo",[["bom","Bom (rocha / argila rija)"],["medio","Médio"],["ruim","Ruim (mole / aterro)"]],"Solo",{q:"fundação sondagem"}) +
      finSEL("orc.fachada",[["textura","Textura e pintura"],["porcelanato","Cerâmica / porcelanato"],["vidro","Pele de vidro"]],"Fachada") +
      finSEL("orc.acab",[["economico","Econômico"],["normal","Normal"],["alto","Alto"],["luxo","Luxo"]],"Acabamentos",{q:"padrão"})) +
    GRP("Coeficientes") + `<p class="note">Fração do CUB por unidade do direcionador. Os padrões ficam perto de CUB × fator no exemplo; ajuste com o histórico das suas obras.</p>` + KV(
      NUM("orc.coef.fund","Fundação","% CUB",{pct:true,step:0.1,help:"Por m² de carga: projeção × pavimentos (torres + embasamento), × fator do solo"}) +
      NUM("orc.coef.cont","Contenção","% CUB",{pct:true,step:1,help:"Por m² de parede de subsolo (perímetro × profundidade). Zera quando a topografia calcula a contenção"}) +
      NUM("orc.coef.estr","Estrutura","% CUB",{pct:true,step:0.5,help:"Por m² construído; +1% por pavimento acima de 10. Transições entram como custo extra"}) +
      NUM("orc.coef.ved","Vedações","% CUB",{pct:true,step:0.5,help:"Por m² de pavimentos (garagem conta 10%)"}) +
      NUM("orc.coef.fach","Fachada","% CUB",{pct:true,step:0.5,help:"Por m² de fachada, × padrão (textura 0,6 · porcelanato 1 · vidro 2,2)"}) +
      NUM("orc.coef.inst","Instalações","% CUB",{pct:true,step:0.5,help:"Por m² construído"}) +
      NUM("orc.coef.instUn","Instalações / unidade","CUB",{step:0.5,help:"CUBs por unidade (medição, prumadas, quadros)"}) +
      NUM("orc.coef.elev","Elevadores","CUB/parada",{step:0.5,help:"CUBs por parada de cada elevador"}) +
      NUM("orc.coef.acab","Acabamentos","% CUB",{pct:true,step:0.5,help:"Por m² acabado (garagem 25%), × padrão"}) +
      NUM("orc.coef.cant","Canteiro e adm. da obra","% sist.",{pct:true,step:0.5,help:"Sobre a soma dos sistemas"})) +
      `<div class="row"><button class="btn sm ghost" data-act="orcReset">Restaurar coeficientes</button></div>` : "";
  const cub = GRP("Tabela CUB") + KV(
      finSEL("orc.uf", lista.map(r=>[r.uf, `${r.uf} · ${r.nome}`]), "Estado", {rr:true, fx:"save", q:"cub sinduscon"}) +
      finSEL("orc.padrao", CUB_PADROES, "Padrão", {rr:true, fx:"save", q:"cub r8 r16"})) +
    `<div id="cubInfo"></div><div class="row"><button class="btn sm" data-act="cubUsar">Usar como CUB de referência</button><label class="btn sm ghost" style="cursor:pointer">Importar CSV/JSON<input type="file" id="cubFile" accept=".csv,.json,.txt,text/csv,application/json" hidden></label>${(O.cubTab||[]).length?`<button class="btn sm ghost" data-act="cubLimpa">Voltar à tabela embutida</button>`:""}</div>
    <p class="note">CSV: <code>uf;padrao;valor;ref;fonte</code> (uma linha por padrão) ou uma coluna por padrão (<code>uf;ref;fonte;R8-N;R16-N…</code>).</p>`;
  return CARD("Orçamento", SEG("orc.modo",[["cub","CUB × fator"],["param","Paramétrico por sistema"]],{full:true,label:"Método do orçamento"}) +
    `<div id="orcTop"></div><div class="use" id="orcBars"></div><p class="note" id="orcNote"></p>` + coef + cub, {details:true, key:"orc", aside:`<span id="orcAside"></span>`});
}
function finOrcLive(m, f){
  const O=S.orc, par=O.modo==="param", o=orcCalc(S,m), C=S.fin.cub, d=o.drivers;
  const totCub = o.cubFator + o.lazer + o.extraT, tot = par? o.total : totCub, dif = o.total/Math.max(1,totCub)-1;
  const as=document.getElementById("orcAside"); if(as) as.textContent = `${mi(tot)} · ${nf(tot/Math.max(1,m.constr)/Math.max(1,C),2)} CUB`;
  setHTML("orcTop", `<div class="mets"><div class="met"><div class="l">Obra (sem INCC)</div><div class="v">${mi(tot)}</div><div class="s">${par?"soma dos sistemas":"CUB × fator"}</div></div>
    <div class="met"><div class="l">Custo / m² construído</div><div class="v">${brl(tot/Math.max(1,m.constr))}</div><div class="s">${nf(tot/Math.max(1,m.constr)/Math.max(1,C),2)} × CUB de ${brl(C)}</div></div></div>`);
  const its=o.itens.filter(i=>i.total>0), mx=Math.max(1,...its.map(i=>i.total));
  setHTML("orcBars", its.map(i=>`<div class="ur" style="grid-template-columns:minmax(0,118px) 1fr 74px" title="${esc(i.nome)}${i.extra?` · inclui ${mi(i.extra)} de ${esc(i.extras.map(x=>x.nome).join("; "))}`:""}"><span>${esc(i.nome)}</span>
    <div class="bar"><i style="width:${Math.max(1,i.param/mx*100).toFixed(1)}%;background:${i.cor};float:left;border-radius:6px 0 0 6px"></i>${i.extra?`<i style="width:${(i.extra/mx*100).toFixed(1)}%;background:${i.cor};opacity:.45;float:left;border-radius:0 6px 6px 0"></i>`:""}</div>
    <span style="font-family:var(--f-mono);text-align:right;white-space:nowrap">${mi(i.total)}</span></div>`).join(""));
  const nEl=d.elevs.reduce((s,e)=>s+e.n,0);
  setHTML("orcNote", par? `Diferença para CUB × fator: <b>${finPP(dif)}%</b> (${mi(totCub)}). Tons claros = custos de outros módulos (contenção, transições, recarga…).`
    : `Total usado = CUB × fator. As barras mostram a distribuição estimada pelo modelo paramétrico, que daria <b>${mi(o.total)}</b> (${finPP(dif)}%).`);
  if(par){
    const sub=(k,t)=>setSub("orc.coef."+k, t), v=k=>o.itens.find(i=>i.k===k);
    sub("fund", `${m2(d.carga)} carga · ${mi(v("fund").param)}`);
    sub("cont", o.temCont? "calculada pela topografia" : d.contArea? `${m2(d.contArea)} · ${mi(v("cont").param)}` : "sem subsolo");
    sub("estr", `${m2(d.constr)} · ${mi(v("estr").param)}`);
    sub("ved", `${m2(d.vedA)} · ${mi(v("ved").param)}`);
    sub("fach", `${m2(d.fachA)} · ${mi(v("fach").param)}`);
    sub("inst", `${m2(d.constr)} · ${mi(o.coef.inst*C*d.constr)}`);
    sub("instUn", `${d.units} un · ${mi(o.coef.instUn*C*d.units)}`);
    sub("elev", `${nEl} elev. · ${d.elevParadas} paradas · ${mi(v("elev").param)}`);
    sub("acab", `${m2(d.acabA)} · ${mi(v("acab").param)}`);
    sub("cant", mi(v("cant").param));
  }
  const r=cubLinha(S,O.uf), val=r && r.v[O.padrao];
  setHTML("cubInfo", r? `<div class="row sb" style="align-items:baseline"><span style="font-family:var(--f-mono);font-size:13px">${val? brl(val)+"/m²" : "padrão sem valor"}</span><span class="note">${esc(r.fonte||"")}${r.ref?" · ref. "+esc(r.ref):""}</span></div>
    ${r.ilustrativo?`<span class="pill warn">ilustrativo — atualize com o boletim do Sinduscon</span>`:`<span class="pill ok">importado</span>`}${val && Math.abs(val-C)>0.5?` <span class="note">CUB em uso: ${brl(C)}</span>`:""}` : "");
}

/* ---------------- 3.2 Cenários ---------------- */
function finCenHTML(){
  const lin=(k,l,u,step,lab)=>`<span class="fl" style="align-self:center">${l}</span>${finIN(`flx.cen.pess.${k}`,u,{pct:true,step,label:"Pessimista: "+lab})}${finIN(`flx.cen.otim.${k}`,u,{pct:true,step,label:"Otimista: "+lab})}`;
  return CARD("Cenários", `<table class="tbl multi" id="cenTab" style="table-layout:fixed"></table>
    <details class="sub"><summary class="note" style="cursor:pointer">Premissas dos cenários</summary>
    <div class="kv three" style="margin-top:8px;align-items:center;grid-template-columns:minmax(0,1.1fr) 1fr 1fr"><span></span><span class="fl">Pessimista</span><span class="fl">Otimista</span>
      ${lin("preco","Preço de venda","%",1,"preço")}${lin("vel","Prazo de vendas","%",5,"prazo de vendas")}${lin("custo","Custo de obra","%",1,"custo")}${lin("juros","Juros e TMA","p.p.",0.25,"juros")}</div>
    <p class="note" style="margin-top:6px">Variações sobre o estudo base. Prazo de vendas positivo = vende mais devagar.</p></details>`, {details:true, key:"cen"});
}
function finCenLive(m, f){
  const cs=flxCenarios(S, m, f), row=(l,fn,best)=>`<tr><td>${l}</td>${cs.map(c=>`<td${c.k==="base"?' style="font-weight:600"':""}>${fn(c.f)}</td>`).join("")}</tr>`;
  setHTML("cenTab", `<tr><th style="min-width:0;width:23%"></th>${cs.map(c=>`<th style="min-width:0">${c.nome}</th>`).join("")}</tr>` +
    row("Lucro", x=>`<span style="color:${x.lucro<0?"var(--bad)":"inherit"}">${mi(x.lucro)}</span>`) + row("Margem", x=>pct(x.margem)) + row("TIR a.a.", x=>finTir(x.tirA)) +
    row("VPL", x=>mi(x.vpl)) + row("Exposição", x=>mi(-x.exp)) + row("VGV", x=>mi(x.vgv)));
  FIN_UI.cen = cs;
}

/* ---------------- 3.2 Sensibilidade (tornado) ---------------- */
function finTornSVG(t, met){
  const val=o=> met==="tir"? (o.tir==null? null : o.tir) : o.margem, b=val(t.base), vs=t.vars;
  const all=[b,...vs.flatMap(v=>[val(v.lo),val(v.hi)])].filter(x=>x!=null&&isFinite(x)); if(!all.length) return "";
  const mn=Math.min(...all), mx=Math.max(...all), W=360, L=122, R=40, rh=21, H=vs.length*rh+26, sx=v=>L+(W-L-R)*((v??mn)-mn)/((mx-mn)||1), x0=sx(b);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Sensibilidade: impacto de cada variável na ${met==="tir"?"TIR":"margem"}">
    ${vs.map((v,i)=>{ const y=6+i*rh, lo=sx(val(v.lo)), hi=sx(val(v.hi));
      return `<text x="${L-8}" y="${y+9}" font-size="10.5" text-anchor="end" fill="var(--ink-2)">${esc(v.nome)}</text><text x="${L-8}" y="${y+18}" font-size="8.5" text-anchor="end" fill="var(--muted)" font-family="IBM Plex Mono">${v.faixa}</text>
      <rect x="${Math.min(lo,x0).toFixed(1)}" y="${y+2}" width="${Math.max(0.8,Math.abs(lo-x0)).toFixed(1)}" height="13" rx="2" fill="var(--bad)" fill-opacity=".72"/>
      <rect x="${Math.min(hi,x0).toFixed(1)}" y="${y+2}" width="${Math.max(0.8,Math.abs(hi-x0)).toFixed(1)}" height="13" rx="2" fill="var(--ok)" fill-opacity=".72"/>
      <text x="${(Math.max(lo,hi)+4).toFixed(1)}" y="${y+12}" font-size="8.5" fill="var(--muted)" font-family="IBM Plex Mono">${finTir(Math.max(val(v.lo)??-1,val(v.hi)??-1))}</text>` }).join("")}
    <line x1="${x0}" x2="${x0}" y1="2" y2="${H-18}" stroke="var(--ink)" stroke-width="1"/><text x="${x0}" y="${H-5}" font-size="9" text-anchor="middle" fill="var(--ink-2)" font-family="IBM Plex Mono">base ${finTir(b)}</text>
  </svg>`;
}
function finSensHTML(){
  return CARD("Sensibilidade", SEG("flx.sens",[["margem","Margem"],["tir","TIR"]],{label:"Métrica"}) + `<div id="torn"></div><p class="note">Barras: lado desfavorável (vermelho) e favorável (verde) de cada variável, ordenadas pelo impacto.</p>
    <div class="grp">Margem: preço × custo de obra</div><div class="sens" id="sens"></div>`, {details:true, key:"sens"});
}
function finSensLive(m, f){
  if(!finOpen("sens")) return;
  const met=S.flx.sens==="tir"?"tir":"margem", t=flxTornado(S, m, null, met); FIN_UI.torn=t;
  setHTML("torn", finTornSVG(t, met));
}

/* ---------------- 3.2 Monte Carlo ---------------- */
const finMCSig = () => JSON.stringify([S.fin, S.flx.curva, S.flx.receb, S.orc.modo, S.orc.coef, window._last? Math.round(window._last.f.lucro) : 0]);
function finMCHTML(){
  const on=S.flx.mc.on;
  return CARD("Monte Carlo", SW("flx.mc.on","Simular incertezas",{rr:true, fx:"save"}) + (on? `<p class="note">1.000 rodadas sorteando (triangular): preço −10% a +6%, custo −5% a +12%, prazo de vendas −20% a +50%, INCC −1 a +3 p.p. e prazo de obra −5% a +20%.</p>
    <div class="row"><button class="btn pri sm" data-act="mcRun">${FIN_UI.mc.run?"Simulando…":"Rodar 1.000 simulações"}</button><span class="note" id="mcProg"></span></div><div id="mcRes"></div>` : ""), {details:false, key:"mc"});
}
function finMCHist(r){
  const L=r.lucros.slice().sort((a,b)=>a-b), mn=L[0], mx=L[L.length-1], nb=24, W=360, H=110, pl=6, pb=18, bw=(W-2*pl)/nb, h=new Array(nb).fill(0);
  L.forEach(v=>h[Math.min(nb-1,Math.floor((v-mn)/((mx-mn)||1)*nb))]++); const hm=Math.max(...h), sx=v=>pl+(W-2*pl)*(v-mn)/((mx-mn)||1);
  const mk=(v,l,c)=>`<line x1="${sx(v)}" x2="${sx(v)}" y1="6" y2="${H-pb}" stroke="${c}" stroke-dasharray="3 2"/><text x="${sx(v)}" y="${H-5}" font-size="8.5" text-anchor="middle" fill="${c}" font-family="IBM Plex Mono">${l}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Distribuição do lucro">${h.map((c,i)=>`<rect x="${(pl+i*bw+0.5).toFixed(1)}" y="${(H-pb-(H-pb-8)*c/hm).toFixed(1)}" width="${(bw-1).toFixed(1)}" height="${((H-pb-8)*c/hm).toFixed(1)}" fill="${mn+(i+0.5)*(mx-mn)/nb<0?"var(--bad)":"var(--accent)"}" fill-opacity=".55"/>`).join("")}
    ${mk(r.lucro[0],"P10","var(--muted)")}${mk(r.lucro[1],"P50","var(--ink)")}${mk(r.lucro[2],"P90","var(--muted)")}${mn<0&&mx>0?mk(0,"0","var(--bad)"):""}</svg>`;
}
function finMCLive(){
  const M=FIN_UI.mc, r=M.res; if(!S.flx.mc.on) return;
  const pr=document.getElementById("mcProg"); if(pr) pr.textContent = M.run? `${nf(M.prog*100,0)}%` : (r && M.sig!==finMCSig()? "premissas mudaram — rode de novo" : "");
  setHTML("mcRes", r? `<div class="mets" style="grid-template-columns:1fr 1fr 1fr;margin-top:6px">${["P10","P50","P90"].map((l,i)=>`<div class="met"><div class="l">TIR ${l}</div><div class="v" style="font-size:16px">${finTir(r.tir[i])}</div><div class="s">${mi(r.lucro[i])}</div></div>`).join("")}</div>
    ${finMCHist(r)}<p class="note">Probabilidade de prejuízo: <b style="color:${r.pPrej>0.1?"var(--bad)":r.pPrej>0?"var(--warn)":"var(--ok)"}">${pct(r.pPrej,1)}</b> · ${r.n} rodadas.</p>` : "");
}
function finMCRun(){
  const M=FIN_UI.mc; if(M.run) return; const {m}=window._last, st=clone(S), rng=flxRng(7), out=[], N=Math.max(100,Math.min(5000,+S.flx.mc.n||1000)), tok=++M.tok;
  const btn=()=>document.querySelector('#tabbody [data-act="mcRun"]');
  M.run=true; M.prog=0; M.sig=finMCSig(); if(btn()) btn().textContent="Simulando…";
  const step=()=>{ if(tok!==M.tok) return; const t0=performance.now(); while(out.length<N && performance.now()-t0<30) out.push(flxMCRodada(st,m,rng));
    M.prog=out.length/N; if(out.length<N){ finMCLive(); setTimeout(step,0) } else { M.res=flxMCResumo(out); M.run=false; if(btn()) btn().textContent="Rodar de novo"; finMCLive() } };
  setTimeout(step,0);
}

/* ---------------- 3.3 Terreno ---------------- */
function finTerHTML(){
  const A=S.terAlt, on=A.on, us=window._last? terAltUnidades(window._last.m) : null;
  const body = SW("terAlt.on","Comparar formas de pagar o terreno",{rr:true}) + (on? KV(
      NUM("terAlt.preco","Preço pedido à vista","R$",{step:10000,wide:true,zero:true,ph:nf(S.fin.terreno,0),help:"Vazio = terreno das premissas"}) +
      NUM("terAlt.taxa","Taxa do terreneiro","% a.a.",{pct:true,step:0.5,help:"Desconto que o terreneiro aplica ao que recebe no futuro"})) +
    GRP("Parcelada") + KV(NUM("terAlt.parcEntrada","Entrada","%",{pct:true,step:5})+NUM("terAlt.parcN","Parcelas","meses",{step:1,int:true,min:1})+NUM("terAlt.parcAcresc","Acréscimo no preço","%",{pct:true,step:1}),3) +
      SW("terAlt.parcCorr","Parcelas corrigidas pelo INCC") +
    GRP("Permutas e SPE") + KV(NUM("terAlt.permF","Permuta física","% VGV",{pct:true,step:0.5,sub:""})+NUM("terAlt.permFin","Permuta financeira","%",{pct:true,step:0.5})+
      `<div class="fld"><span class="fl">Base da financeira</span>${SEG("terAlt.permBase",[["receita","Receita"],["vgv","VGV"]],{label:"Base da permuta financeira"})}</div>`+
      NUM("terAlt.speS","SPE: parte do terreneiro","% lucro",{pct:true,step:1})) +
    (us? `<details class="sub"><summary class="note" style="cursor:pointer">Escolher as unidades da permuta física (${(A.unidades||[]).length} escolhidas)</summary><div class="list" id="terUn" style="max-height:200px;overflow:auto;margin-top:6px"></div></details>` : "") +
    `<div id="terBox"></div>` : `<p class="note">Compra à vista ou parcelada, permuta física, permuta financeira e SPE com o terreneiro, lado a lado — com o fluxo e o VPL dos dois lados e o ponto de indiferença.</p>`);
  return CARD("Terreno: compra, permuta ou SPE", body, {details:true, key:"terAlt"});
}
function finTerSVG(r){
  const ks=Object.keys(r.alts), cols={vista:"var(--accent)",parc:"var(--m-sub)",fis:"var(--mark)",fin:"var(--ok)",spe:"var(--m-env)"};
  const n=Math.max(...ks.map(k=>r.alts[k].terr.length)), cum={}; ks.forEach(k=>{ let s=0; cum[k]=r.alts[k].terr.map(v=>s+=v) });
  const mx=Math.max(1,...ks.map(k=>cum[k][cum[k].length-1])), W=360, H=130, pl=40, pr=6, pt=8, pb=18, sx=i=>pl+(W-pl-pr)*i/Math.max(1,n-1), sy=v=>pt+(H-pt-pb)*(1-v/mx);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Recebimentos acumulados do terreneiro">
    ${[0,mx/2,mx].map(v=>`<line x1="${pl}" x2="${W-pr}" y1="${sy(v)}" y2="${sy(v)}" stroke="var(--line)" ${v?'stroke-dasharray="2 3"':""}/><text x="${pl-4}" y="${sy(v)+3}" font-size="9" text-anchor="end" fill="var(--muted)" font-family="IBM Plex Mono">${nf(v/1e6,1)}mi</text>`).join("")}
    ${ks.map(k=>`<path d="${cum[k].map((v,i)=>(i?"L":"M")+sx(i).toFixed(1)+","+sy(v).toFixed(1)).join("")}" fill="none" stroke="${cols[k]}" stroke-width="1.8"/>`).join("")}
    <text x="${W-pr}" y="${H-5}" font-size="9" text-anchor="end" fill="var(--muted)">meses</text><text x="${pl}" y="${H-5}" font-size="9" fill="var(--muted)">0</text>
  </svg><div class="stackleg">${ks.map(k=>`<span><i style="background:${cols[k]}"></i>${r.alts[k].nome}</span>`).join("")}</div>`;
}
function finTerLive(m){
  if(!S.terAlt.on || !finOpen("terAlt")) return;
  const r=terAltCalc(S, m); FIN_UI.ter=r; const A=r.alts, ks=Object.keys(A);
  const bestI=ks.reduce((b,k)=>A[k].vpl>A[b].vpl?k:b,ks[0]), bestT=ks.reduce((b,k)=>A[k].terrVPL>A[b].terrVPL?k:b,ks[0]);
  const quando=a=> a.ini==null? "—" : a.ini===a.fim? `${a.ini}` : `${a.ini}–${a.fim}`;
  const det=k=>{ const a=A[k]; return k==="parc"? `${brl(a.preco)} · ${pct(S.terAlt.parcEntrada,0)} + ${S.terAlt.parcN}×` : k==="fis"? `${pct(a.p,1)} do VGV${a.porUnid?` · ${a.nUn} un.`:""}` : k==="fin"? `${pct(a.p,1)} da ${a.base==="vgv"?"venda":"receita"}` : k==="spe"? `${pct(a.s,0)} do resultado` : brl(r.P) };
  const I=r.ind, ip=v=> v==null? "> 90%" : pct(v,1);
  setSub("terAlt.permF", A.fis.porUnid? `${A.fis.nUn} unidades · ${mi(A.fis.valor)}` : `≈ ${mi(A.fis.valor)} em unidades`);
  setHTML("terBox", `<div class="grp">Para o incorporador</div><table class="tbl multi" style="table-layout:fixed"><tr><th style="min-width:0;width:36%">Alternativa</th><th style="min-width:0">Lucro</th><th style="min-width:0;width:17%">TIR</th><th style="min-width:0">VPL</th></tr>
    ${ks.map(k=>`<tr><td>${A[k].nome}<div class="fsub">${det(k)}</div></td><td>${mi(A[k].lucro)}</td><td>${finTir(A[k].tirA)}</td><td${k===bestI?' class="best"':""}>${mi(A[k].vpl)}</td></tr>`).join("")}</table>
    <div class="grp">Para o terreneiro</div><table class="tbl multi" style="table-layout:fixed"><tr><th style="min-width:0;width:36%">Alternativa</th><th style="min-width:0">Recebe</th><th style="min-width:0">Mês</th><th style="min-width:0">VPL</th></tr>
    ${ks.map(k=>`<tr><td>${A[k].nome}</td><td>${mi(A[k].terrTot)}</td><td>${quando(A[k])}</td><td${k===bestT?' class="best"':""}>${mi(A[k].terrVPL)}</td></tr>`).join("")}</table>
    ${finTerSVG(r)}
    <div class="grp">Ponto de indiferença</div>
    <p class="note" style="color:var(--ink-2)">${mi(r.P)} à vista equivale, para você, a <b>${ip(I.fis.inc)}</b> de permuta física ou <b>${ip(I.fin.inc)}</b> de permuta financeira; para o terreneiro (a ${pct(S.terAlt.taxa,1)} a.a.), a <b>${ip(I.fis.terr)}</b> física ou <b>${ip(I.fin.terr)}</b> financeira.
    ${I.fis.inc!=null&&I.fis.terr!=null? (I.fis.terr<=I.fis.inc? ` Faixa de acordo na física: <b>${pct(I.fis.terr,1)} a ${pct(I.fis.inc,1)}</b>.` : ` Na física não há faixa de acordo: o terreneiro precisa de mais do que vale para você.`) : ""}</p>
    <div class="row"><button class="btn sm" data-act="terUsar" data-k="vista">Usar à vista</button><button class="btn sm" data-act="terUsar" data-k="fis">Usar permuta física</button><button class="btn sm" data-act="terUsar" data-k="fin">Usar permuta financeira</button></div>
    <p class="note">ITBI sobre o preço pedido em todas as alternativas. Permuta física: o terreneiro recebe as unidades nas chaves (tabela reajustada, menos a corretagem). SPE: o incorporador recupera o investimento e depois divide cada entrada de caixa.</p>`);
  const us=terAltUnidades(m), sel=(S.terAlt.unidades||[]).map(String);
  if(us) setHTML("terUn", us.map(u=>`<label class="sw"><input type="checkbox" data-act="terUn" data-id="${esc(u.id)}" ${sel.includes(String(u.id))?"checked":""}><span class="tg"></span><span>${esc(u.nome)} · ${esc(u.tip)} · ${nf(u.area,0)} m² · ${mi(u.valor)}</span></label>`).join(""));
}

/* ---------------- curva de obra (desembolso mensal) ---------------- */
function finObraSVG(f){
  const L=f.launch, N=Math.max(1,Math.round(S.fin.obra)), sis=f.c.obraSis, tot=f.c.obra.slice(L,L+N), mx=Math.max(1,...tot);
  const W=360, H=120, pl=8, pr=8, pt=8, pb=16, bw=(W-pl-pr)/N, sy=v=>(H-pt-pb)*v/mx;
  let bars="";
  for(let k=0;k<N;k++){ let y=H-pb; const x=(pl+k*bw+0.4).toFixed(1), w=Math.max(0.6,bw-0.8).toFixed(1);
    if(sis) sis.forEach(s=>{ const h=sy(s.v[k]||0); if(h>0.05){ y-=h; bars+=`<rect x="${x}" y="${y.toFixed(1)}" width="${w}" height="${h.toFixed(1)}" fill="${s.cor}"/>` } });
    else { const h=sy(tot[k]); bars+=`<rect x="${x}" y="${(H-pb-h).toFixed(1)}" width="${w}" height="${h.toFixed(1)}" fill="var(--accent)" fill-opacity=".6"/>` } }
  let c=0; const ts=tot.reduce((a,v)=>a+v,0)||1, line=tot.map((v,k)=>{ c+=v; return (k?"L":"M")+(pl+(k+1)*bw).toFixed(1)+","+(pt+(H-pt-pb)*(1-c/ts)).toFixed(1) }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Desembolso mensal da obra"><line x1="${pl}" x2="${W-pr}" y1="${H-pb}" y2="${H-pb}" stroke="var(--line)"/>${bars}<path d="M${pl},${H-pb} ${line.slice(1)}" fill="none" stroke="var(--ink)" stroke-width="1.4"/>
    <text x="${pl}" y="${H-4}" font-size="9" fill="var(--muted)">início da obra</text><text x="${W-pr}" y="${H-4}" font-size="9" text-anchor="end" fill="var(--muted)">${N} meses · linha = acumulado</text></svg>
    ${sis? `<div class="stackleg">${sis.filter(s=>s.v.some(v=>v>0)).map(s=>`<span><i style="background:${s.cor}"></i>${esc(s.nome)}</span>`).join("")}</div>` : ""}`;
}

/* ---------------- ligação com a etapa ---------------- */
function finViabLive(m, f, fast){
  finOrcLive(m, f);
  const rd=S.flx.receb; if(rd.modo==="det") setSub("flx.receb.ato", `repasse/saldo ${pct(flxRepasse(rd),0)}${f.distratoV?` · distratos −${mi(f.distratoV)}`:""}`);
  if(S.flx.curva.modo!=="sen") setHTML("obraCurve", finObraSVG(f));
  if(fast) return;
  if(finOpen("cen")) finCenLive(m, f);
  finSensLive(m, f); finMCLive(); finTerLive(m);
}
function finViabAfter(){
  const fi=document.getElementById("cubFile");
  if(fi) fi.onchange=()=>{ const file=fi.files[0]; if(!file) return; file.text().then(t=>{ try{ const rows=cubParse(t); if(!rows.length){ toast("Nenhum valor de CUB reconhecido no arquivo"); return }
    const cur=(S.orc.cubTab||[]).filter(r=>!rows.some(x=>x.uf===r.uf)); S.orc.cubTab=[...cur,...rows]; if(rows.length===1) S.orc.uf=rows[0].uf; save(); renderTab();
    toast(`CUB importado: ${rows.map(r=>r.uf).join(", ")}`) }catch(e){ toast("Arquivo inválido: use CSV ou JSON") } }) };
  // recalcula as partes que dependem do card aberto quando o usuário expande
  ["cen","sens","terAlt","mc"].forEach(k=>{ const d=document.querySelector(`#tabbody details[data-key="${k}"]`); if(d) d.addEventListener("toggle",()=>{ if(d.open && window._last) renderLive(window._last.m, window._last.f, false) }) });
}
Object.assign(ACT, {
  orcReset: ()=>{ S.orc.coef=clone(DEF.orc.coef); renderTab(); toast("Coeficientes padrão restaurados") },
  cubUsar: ()=>{ const v=cubValor(S,S.orc.uf,S.orc.padrao); if(!v){ toast("Esse padrão não tem valor na tabela"); return } S.fin.cub=Math.round(v*100)/100; renderTab(); toast(`CUB ${S.orc.padrao} ${S.orc.uf}: ${brl(v)}/m²`) },
  cubLimpa: ()=>{ S.orc.cubTab=[]; renderTab(); toast("Tabela embutida (ilustrativa) restaurada") },
  mcRun: ()=> finMCRun(),
  terUn: el=>{ const id=String(el.dataset.id), l=(S.terAlt.unidades||[]).map(String); S.terAlt.unidades = el.checked? [...new Set([...l,id])] : l.filter(x=>x!==id); update() },
  terUsar: el=>{ const r=FIN_UI.ter; if(!r) return; const k=el.dataset.k, F=S.fin;
    if(k==="vista"){ F.terreno=r.P; F.permuta=0; F.permutaFin=0 }
    else if(k==="fis"){ F.terreno=0; F.permuta=Math.round(r.alts.fis.p*10000)/10000; F.permutaFin=0 }
    else if(k==="fin"){ if(S.terAlt.permBase==="vgv"){ toast("A permuta financeira sobre o VGV fica só na comparação; use a base Receita para aplicar"); return } F.terreno=0; F.permuta=0; F.permutaFin=+S.terAlt.permFin||0 }
    renderTab(); toast("Premissas do terreno atualizadas: "+TERALT_NOMES[k]) }
});

/* ---------------- PDF ---------------- */
HOOK.pdf.push(async ctx=>{
  const {doc,m,f,T,PW,M,h2,rows}=ctx, O=S.orc, o=orcCalc(S,m), par=O.modo==="param", C=S.fin.cub;
  ctx.newPage(); h2(par? "Orçamento paramétrico por sistema" : "Orçamento (CUB x fator) e distribuição por sistema");
  const tot=par? o.total : o.cubFator+o.lazer+o.extraT;
  rows([...o.itens.filter(i=>i.total>0).map(i=>[i.nome+(i.extra?` (inclui ${mi(i.extra)} de outros módulos)`:""), `${mi(i.total)} · ${pct(i.total/Math.max(1,o.total),1)}`]),
    ["Total da obra (sem INCC)", mi(tot)], ["Custo por m² construído", `${brl(tot/Math.max(1,m.constr))} · ${nf(tot/Math.max(1,m.constr)/Math.max(1,C),2)} CUB`],
    [par? "Diferença para CUB x fator" : "Paramétrico (comparação)", par? `${finPP(o.total/Math.max(1,o.cubFator+o.lazer+o.extraT)-1)}%` : mi(o.total)]], {bold:["Total da obra (sem INCC)"]});
  { const r=cubLinha(S,O.uf); rows([["CUB de referência", `${brl(C)}/m² · tabela ${O.uf} ${O.padrao}: ${r&&r.v[O.padrao]? brl(r.v[O.padrao]) : "-"}`], ["Fonte da tabela CUB", `${r? (r.fonte||"")+(r.ref?" "+r.ref:"") : "-"}${r&&r.ilustrativo?" (ilustrativo - atualize com o boletim)":""}`]]) }
  const RD=S.flx.receb, CV=S.flx.curva;
  h2("Fluxo: curva de obra e recebimento");
  rows([["Curva de obra", {sen:"senoidal", s:`curva S (início ${pct(CV.ini,0)}, pico ${pct(CV.pico,0)}, fim ${pct(CV.fim,0)} do prazo)`, sis:`por sistema (início ${pct(CV.ini,0)}, fim ${pct(CV.fim,0)})`}[CV.modo]||"senoidal"],
    ["Recebimento", RD.modo==="det"? `ato ${pct(RD.ato,0)} · mensais ${pct(RD.mensais,0)} · semestrais ${pct(RD.interm,0)} · chaves ${pct(RD.chaves,0)}${RD.pos?` · pós-chaves ${pct(RD.pos,0)} em ${RD.posN} meses`:""} · repasse ${pct(flxRepasse(RD),0)} (+${RD.repasseMes} meses)` : `simples: ${pct(S.fin.entrada,0)} até as chaves, saldo nas chaves`],
    ...(RD.modo==="det"? [["Correção", `INCC ${pct(S.fin.incc)} até as chaves · IPCA ${pct(RD.ipca)} depois`], ["Distratos", RD.distrato? `${pct(RD.distrato,0)} dos contratos no mês ${RD.distratoMes} após o lançamento (retenção ${pct(RD.retencao,0)}): -${mi(f.distratoV)}` : "não considerados"]] : [])]);
  const cs=flxCenarios(S,m,f); h2("Cenários");
  rows([["", cs.map(c=>c.nome).join("  |  ")], ...[["Lucro",x=>mi(x.lucro)],["Margem",x=>pct(x.margem)],["TIR a.a.",x=>finTir(x.tirA)],["VPL",x=>mi(x.vpl)],["Exposição",x=>mi(-x.exp)]].map(([l,fn])=>[l, cs.map(c=>fn(c.f)).join("  |  ")])]);
  const t=flxTornado(S,m,null,"margem"); h2("Sensibilidade da margem (desfavorável / favorável)");
  rows(t.vars.map(v=>[`${v.nome} (${v.faixa})`, `${pct(v.lo.margem)} / ${pct(v.hi.margem)}  ·  TIR ${finTir(v.lo.tir)} / ${finTir(v.hi.tir)}`]));
  const mc=FIN_UI.mc; if(S.flx.mc.on && mc.res && mc.sig===finMCSig()){ const r=mc.res; h2(`Monte Carlo (${r.n} rodadas)`);
    rows([["TIR P10 / P50 / P90", r.tir.map(finTir).join(" / ")], ["Lucro P10 / P50 / P90", r.lucro.map(v=>mi(v)).join(" / ")], ["Probabilidade de prejuízo", pct(r.pPrej,1)]]) }
  if(S.terAlt.on){ const r=terAltCalc(S,m), A=r.alts, I=r.ind, ip=v=>v==null?"> 90%":pct(v,1);
    if(ctx.y()>200) ctx.newPage(); h2("Terreno: compra x permuta x SPE");
    rows([["Alternativa", "Incorporador: lucro | TIR | VPL   ·   Terreneiro: recebe | VPL"], ...Object.keys(A).map(k=>[A[k].nome, `${mi(A[k].lucro)} | ${finTir(A[k].tirA)} | ${mi(A[k].vpl)}   ·   ${mi(A[k].terrTot)} | ${mi(A[k].terrVPL)}`])]);
    rows([["Indiferença para você (preço "+mi(r.P)+")", `permuta física ${ip(I.fis.inc)} · financeira ${ip(I.fin.inc)}`], ["Indiferença para o terreneiro", `permuta física ${ip(I.fis.terr)} · financeira ${ip(I.fin.terr)}`]]) }
});
