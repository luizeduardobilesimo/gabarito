/* ================= Viabilidade: resultado, premissas, riscos e terreno (itens 3.1–3.3) =================
   Sub-abas (STEP_R.viab em steps.js chama finViabHTML):
     res    → RES (lucro, margem, TIR, VPL, exposição) + fluxo de caixa + DRE
     prem   → resultado compacto, busca, essenciais abertos (terreno e obra · preço e vendas) e o resto em seções fechadas
     risco  → cenários (RES), variações, sensibilidade, Monte Carlo
     vendas → cards de src/ui/vendas.js (tabela e valorização) + "Terreno: compra × permuta × SPE" (addCard abaixo)
   Partes vivas em finViabLive (STEP_LIVE.viab). Cálculo em src/calc/{orcamento,cub,fluxo,terreno}.js. */
const FIN_UI = { mc: { sig:null, res:null, run:false, prog:0, tok:0 } };
/* uma parte viva só é calculada quando está na tela (existe e a seção que a contém está aberta) */
const finVis = id => { const e=document.getElementById(id); if(!e) return false; const d=e.closest("details"); return !d || d.open };
const finOpen = key => { const d=document.querySelector(`#tabbody details[data-key="${key}"]`); return !!d && d.open };
const finPP = (v,d=1) => (v>=0?"+":"−")+nf(Math.abs(v)*100,d);
const finTir = v => v==null? "—" : pct(v);
const finSCol = v => v<0||v<S.metas.margem.min?"var(--bad)": v<S.fin.margemAlvo?"var(--warn)":"var(--ok)";   // v = margem s/ VGV · metas em S.metas (src/calc/saude.js)
{ const st=document.createElement("style"); st.id="finCSS"; st.textContent=`
#tabbody[data-tab^="viab"] details.sec:not([open])>.cb{display:none}
.fmini{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.fmini .met{padding:8px 10px;border-radius:10px}
.fmini .met .v{font-size:16px;margin-top:1px}
.fres .met .l .info,.fmini .met .l .info{width:15px;height:15px;font-size:9px}
.fbusca{background:var(--surface)}
.fbusca svg{margin-left:10px;flex:none;fill:none;stroke:var(--muted);stroke-width:1.8}
.fcen{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr) minmax(0,1fr);gap:8px 10px;align-items:center}
.flink{color:var(--accent);padding-left:0}
.fusar{display:flex;flex-wrap:wrap;gap:6px;align-items:center}`; document.head.appendChild(st) }

/* select ligado ao estado (data-p) */
function finSEL(p, opts, label, o={}){
  const v=getP(S,p), id="f-"+p.replace(/\./g,"-");
  return `<div class="fld${o.wide?" wide":""}" data-q="${esc((label+" "+(o.q||"")).toLowerCase())}"><label class="fl" for="${id}">${label}${o.help?INFO(o.help):""}</label><select class="sel" id="${id}" data-p="${p}" data-t="s" data-fx="${o.fx||"upd"}" ${o.rr?'data-rr="1"':""}>${opts.map(([k,l])=>`<option value="${esc(k)}" ${String(v)===String(k)?"selected":""}>${esc(l)}</option>`).join("")}</select>${o.sub!=null?`<div class="fsub" id="sub-${p.replace(/\./g,"-")}">${o.sub}</div>`:""}</div>`;
}
/* campo numérico sem rótulo (grades de cenários) */
function finIN(p, unit, o={}){ const v=getP(S,p); return `<div class="inp"><input type="number" inputmode="decimal" data-p="${p}" ${o.pct?'data-pct="1"':""} data-fx="upd" step="${o.step??"any"}" value="${fmtIn(v,o.pct)}" aria-label="${esc(o.label||p)}">${unit?`<em>${unit}</em>`:""}</div>` }
/* bloco pesquisável (segmentados e interruptores não têm data-q próprio) */
const finQ = (q, html) => `<div data-q="${esc(q.toLowerCase())}">${html}</div>`;
const finCampoSeg = (label, q, seg, help) => finQ(label+" "+q, `<div class="fld wide"><span class="fl">${label}${help?INFO(help):""}</span>${seg}</div>`);

/* ================= sub-abas ================= */
function finViabHTML(k){ return k==="prem"? finPremHTML() : k==="risco"? finRiscoHTML() : k==="vendas"? "" : finResHTML() }

/* ---------------- Resultado ---------------- */
function finResHTML(){
  return RES("Saúde do negócio", `<div id="finSaude"></div>`, {cls:"fres", aside:"", asideId:"sdStat"}) +
    RES("Resultado", `<div id="finTop"></div>`, {cls:"fres", aside:"", asideId:"vStat"}) +
    SEC("Fluxo de caixa acumulado", `<div id="cash"></div>`, {key:"cash", open:true, info:"Entradas menos saídas, mês a mês. O ponto mais baixo é a exposição máxima; o payback é quando a curva volta a zero."}) +
    SEC("DRE", `<table class="tbl" id="dre"></table>`, {key:"dre", info:"DRE"});
}
function finTopHTML(m, f){
  const F=S.fin, parts=[["Terreno e outorga",f.terreno+f.outorga,"var(--m-sub)"],["Obra e indiretos",f.obraTot+f.projetos+f.terra,"var(--m-ter)"],["Vendas, impostos, juros",f.corret+f.mkt+f.imp+f.permFin+f.juros,"var(--mark)"],["Lucro",Math.max(0,f.lucro),"var(--ok)"]];
  const tot=parts.reduce((s,p)=>s+p[1],0)||1;
  return `<div class="mets"><div class="met big"><div class="l">Lucro</div><div class="v" style="color:${f.lucro<0?"var(--bad)":"var(--ink)"}">${mi(f.lucro)}</div><div class="s">${TERMO("VGV")} ${mi(f.vgv)} · custo ${mi(f.custo)}</div>${finImprevHTML(f)}</div>
    <div class="met"><div class="l">Margem s/ VGV${INFO("Margem s/ VGV")}</div><div class="v" style="color:${finSCol(f.margemVGV)}">${pct(f.margemVGV)}</div><div class="s">meta ${pct(F.margemAlvo,0)} · s/ receita ${pct(f.margem)}</div></div>
    <div class="met"><div class="l">TIR a.a.${INFO("TIR")}</div><div class="v" style="color:${f.tirA==null||f.tirA<F.tma?"var(--bad)":f.tirA<S.metas.tir.alvo?"var(--warn)":"var(--ink)"}">${finTir(f.tirA)}</div><div class="s">${TERMO("TIR alvo","alvo")} ${pct(S.metas.tir.alvo,0)} · ${TERMO("TMA")} ${pct(F.tma,0)}</div></div>
    <div class="met"><div class="l">VPL${INFO("VPL")}</div><div class="v" style="color:${f.vpl<0?"var(--bad)":"var(--ink)"}">${mi(f.vpl)}</div><div class="s">à ${TERMO("TMA")} de ${pct(F.tma,0)}</div></div>
    <div class="met"><div class="l">Exposição máx.${INFO("Exposição")}</div><div class="v">${mi(-f.exp)}</div><div class="s">payback ${f.pay==null?"—":"mês "+f.pay}</div></div></div>
    <div class="stack" role="img" aria-label="Composição da receita">${parts.map(p=>`<span style="width:${p[1]/tot*100}%;background:${p[2]}"></span>`).join("")}</div>
    <div class="stackleg">${parts.map(p=>`<span><i style="background:${p[2]}"></i>${p[0]} ${pct(p[1]/tot,0)}</span>`).join("")}</div>`;
}
function finDREHTML(m, f){
  const ln=(l,v)=> v? `<tr class="neg"><td>${l}</td><td>−${brl(v)}</td></tr>` : "", sub=(l,v)=>`<tr><td style="padding-left:12px;color:var(--muted)">${l}</td><td style="color:var(--muted)">${v}</td></tr>`;
  return `<tr><td>VGV de tabela</td><td>${brl(f.vgvB)}</td></tr>${f.permV?`<tr class="neg"><td>(−) Permuta física</td><td>−${brl(f.permV)}</td></tr>`:""}<tr><td>Receita nominal</td><td>${brl(f.receita)}</td></tr>${f.distratoV?sub("já descontados os distratos","−"+brl(f.distratoV)):""}
    ${ln("Terreno + ITBI",f.terreno)}${ln("Outorga onerosa",f.outorga)}${ln(f.orc? "Obra + administração + contingência, com INCC (orçamento por sistema)" : `Obra + administração + contingência, com INCC (${m2(f.eqA)} equiv.)`,f.obraTot)}${f.lazerC?sub("inclui lazer: equipamentos e áreas descobertas",brl(f.lazerC)):""}${ln("Movimento de terra",f.terra)}${ln("Projetos e aprovações",f.projetos)}${finSoftDRE(f)}
    ${ln("Corretagem + marketing",f.corret+f.mkt)}${ln("Impostos (RET)",f.imp)}${ln("Permuta financeira",f.permFin)}${ln("Juros do financiamento",f.juros)}
    <tr class="tot ${f.lucro<0?"neg":"pos"}"><td>Lucro</td><td>${brl(f.lucro)}</td></tr><tr><td>Margem s/ VGV</td><td>${pct(f.margemVGV)}</td></tr>${sub("margem s/ receita nominal",pct(f.margem))}<tr><td>Custo total / m² privativo</td><td>${brl(f.custo/Math.max(1,m.priv))}</td></tr><tr><td>Obra / m² construído</td><td>${brl(f.obraTot/Math.max(1,m.constr))}</td></tr><tr><td>Lucro ÷ custo</td><td>${pct(f.lucro/Math.max(1,f.custo))}</td></tr>${finImprevDRE(f)}<tr><td>Terreno máximo p/ margem alvo (${pct(S.fin.margemAlvo,0)} s/ VGV)</td><td>${brl(f.maxTerreno)}</td></tr>`;
}

/* ---------------- Premissas ---------------- */
function finPremHTML(){
  const F=S.fin, P=S.produto, par=S.orc.modo==="param", rd=S.flx.receb, cv=S.flx.curva;
  const precos = P.mix.map((u,i)=>NUM(`produto.mix.${i}.preco`, `Preço ${esc(u.nome)}`, "R$/m²", {step:50, min:0, q:"preço venda mix tipologia"})).join("") +
    (P.cob && P.cob.on? NUM("produto.cob.preco","Preço cobertura","R$/m²",{step:50, min:0, q:"preço venda cobertura"}) : "");
  const busca = `<div class="inp fbusca"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/></svg><input class="t" id="vqFind" placeholder="Buscar premissa — CUB, INCC, corretagem…" aria-label="Buscar premissa" autocomplete="off"></div><p class="note" id="vqNada" hidden>Nenhuma premissa encontrada.</p>`;
  return RES("Resultado", `<div class="fmini" id="finMini"></div>`, {aside:"", asideId:"vStat"}) + busca +
    SEC("Terreno e obra", KV(NUM("fin.terreno","Terreno (à vista)","R$",{step:10000,wide:true,q:"compra lote"}) + NUM("fin.cub","CUB referência","R$/m²",{step:1,help:"CUB",fx:"cubMan"}) +
        (par? "" : NUM("fin.fator","Custo ÷ CUB","×",{step:0.01,help:"Custo ÷ CUB"}))) +
        `<div class="row"><button type="button" class="btn sm ghost flink" data-act="finIr" data-v="vendas" data-open="terAlt">Comparar compra, permuta e SPE →</button></div>`,
      {key:"essObra", open:true, sum:""}) +
    SEC("Preço e prazos", KV(precos + NUM("fin.venda","Vender 100% em","meses",{step:1,int:true,min:1,q:"velocidade prazo de vendas"}) + NUM("fin.vendaLanc","Vendido no lançamento","%",{pct:true,step:5,min:0,max:1}) + NUM("fin.obra","Prazo de obra","meses",{step:1,int:true,min:1,q:"cronograma"})),
      {key:"essVenda", open:true, info:"Preço de venda por m² de cada tipologia (o mesmo do mix, na etapa Produto), ritmo de vendas e prazo de obra. Preço × área das unidades = VGV.", sum:""}) +
    finOrcHTML() +
    SEC("Custos indiretos", KV(NUM("fin.itbi","ITBI + escritura","%",{pct:true,step:0.5,help:"ITBI"}) + NUM("fin.projetos","Projetos e taxas","% obra",{pct:true,step:0.5,q:"aprovação"}) +
        NUM("fin.adm","Administração","% obra",{pct:true,step:0.5}) + NUM("fin.conting","Contingência","% obra",{pct:true,step:0.5,q:"reserva"})) +
        ADV(KV(NUM("fin.decorLazer","Lazer: equipamentos","R$/m²",{step:50,q:"mobiliário decoração lazer"}) + NUM("fin.custoDesc","Lazer descoberto","R$/m²",{step:50,q:"piscina deck paisagismo"})) + softCamposHTML(), {key:"ind"}),
      {key:"ind", cls:"fq", sum:""}) +
    SEC("Receita e comissões", KV(NUM("fin.corret","Corretagem","%",{pct:true,step:0.5,q:"comissão"}) + NUM("fin.mkt","Marketing","%",{pct:true,step:0.5,q:"publicidade stand"}) +
        NUM("fin.imp","Impostos (RET)","%",{pct:true,step:0.25,help:"RET",q:"tributos"}) + NUM("fin.reaj","Reajuste da tabela","% a.a.",{pct:true,step:0.5})) +
        finQ("incc correção parcelas", SW("fin.correcao","Parcelas corrigidas pelo INCC até as chaves")) +
        ADV(KV(NUM("fin.precoLoja","Preço das lojas","R$/m²",{step:50}) + NUM("fin.permuta","Permuta física","% un.",{pct:true,step:1,help:"Permuta física",fx:"permuta"}) +
          NUM("fin.permutaFin","Permuta financeira","% receita",{pct:true,step:0.5,help:"Permuta financeira"})), {key:"rec"}),
      {key:"rec", cls:"fq", sum:""}) +
    SEC("Recebimento", finCampoSeg("Modo", "recebimento parcelas ato repasse distrato", SEG("flx.receb.modo",[["simples","Simples"],["det","Detalhado"]],{full:true,label:"Modo de recebimento"})) +
      (rd.modo!=="det"? KV(NUM("fin.entrada","Pago até as chaves","%",{pct:true,step:5,min:0,max:1,q:"entrada",sub:"o restante entra nas chaves"})) :
        KV(NUM("flx.receb.ato","Ato","%",{pct:true,step:1,q:"sinal entrada",sub:""}) + NUM("flx.receb.mensais","Mensais até as chaves","%",{pct:true,step:1}) +
          NUM("flx.receb.interm","Semestrais","%",{pct:true,step:1,q:"intermediárias balão"}) + NUM("flx.receb.chaves","Nas chaves","%",{pct:true,step:1})) +
        ADV(KV(NUM("flx.receb.pos","Pós-chaves (direto)","%",{pct:true,step:1}) + (rd.pos>0? NUM("flx.receb.posN","Pós-chaves em","meses",{step:1,int:true,min:1}) : "") +
            NUM("flx.receb.repasseMes","Repasse do banco","meses após",{step:1,int:true,min:0,help:"Repasse",q:"financiamento bancário"}) + NUM("flx.receb.ipca","IPCA pós-chaves","% a.a.",{pct:true,step:0.25,help:"IPCA"})) +
          GRP(`Distratos ${INFO("Distrato")}`) + KV(NUM("flx.receb.distrato","Contratos distratados","%",{pct:true,step:1}) +
            (rd.distrato>0? NUM("flx.receb.distratoMes","Meses após o lançamento","meses",{step:1,int:true,min:0}) + NUM("flx.receb.retencao","Retenção do valor pago","%",{pct:true,step:5}) : "")), {key:"receb"})),
      {key:"receb", cls:"fq", info:"Como o cliente paga. O saldo que falta para 100% vem pelo repasse bancário nas chaves. Parcelas corrigidas pelo INCC até as chaves e pelo IPCA depois; unidades distratadas não são revendidas no estudo.", sum:""}) +
    SEC("Cronograma", KV(NUM("fin.prelanc","Até o lançamento","meses",{step:1,int:true,min:0,q:"aprovação incorporação"})) +
      finCampoSeg("Curva de obra", "curva de obra desembolso s sistema", SEG("flx.curva.modo",[["sen","Senoidal"],["s","Curva S"],["sis","Por sistema"]],{full:true,label:"Curva de obra"}), "Curva S") +
      (cv.modo==="sen"? "" : KV(NUM("flx.curva.ini","Início","% prazo",{pct:true,step:5,min:0,max:0.9,q:"curva"}) + (cv.modo==="s"? NUM("flx.curva.pico","Pico","% prazo",{pct:true,step:5,min:0.05,max:0.95,q:"curva"}) : "") +
          NUM("flx.curva.fim","Fim","% prazo",{pct:true,step:5,min:0.1,max:1,q:"curva"}), 3) + `<div id="obraCurve"></div>`),
      {key:"crono", cls:"fq", info:"Senoidal: desembolso suave. Curva S: começa devagar, acelera até o pico e desacelera (frações do prazo de obra). Por sistema: cada sistema do orçamento segue a sua janela (fundação no início, acabamentos no fim).", sum:""}) +
    SEC("Financiamento à produção", finQ("financiamento plano empresário banco", SW("fin.finOn","Usar plano empresário",{rr:true})) +
      (F.finOn? KV(NUM("fin.finPct","Financiado","% obra",{pct:true,step:5,min:0,max:1}) + NUM("fin.finTaxa","Juros","% a.a.",{pct:true,step:0.25}) + NUM("fin.finVendaMin","Vendas p/ liberar","%",{pct:true,step:5,min:0,max:1}), 3) : ""),
      {key:"finan", cls:"fq", info:"Plano empresário", sum:""}) +
    finMetasHTML();
}
function finMiniHTML(f){
  const c=(l,v,col)=>`<div class="met"><div class="l">${l}</div><div class="v"${col?` style="color:${col}"`:""}>${v}</div></div>`;
  return c("Lucro", mi(f.lucro), f.lucro<0?"var(--bad)":null) + c("Margem s/ VGV", pct(f.margemVGV), finSCol(f.margemVGV)) + c("TIR a.a.", finTir(f.tirA)) + c("Exposição", mi(-f.exp));
}

/* ---------------- 3.1 Orçamento ---------------- */
function finOrcHTML(){
  const O=S.orc, par=O.modo==="param", lista=cubLista(S);
  const padroes = par ? KV(
      finSEL("orc.solo",[["bom","Bom (rocha / argila rija)"],["medio","Médio"],["ruim","Ruim (mole / aterro)"]],"Solo",{q:"fundação sondagem"}) +
      finSEL("orc.fachada",[["textura","Textura e pintura"],["porcelanato","Cerâmica / porcelanato"],["vidro","Pele de vidro"]],"Fachada") +
      finSEL("orc.acab",[["economico","Econômico"],["normal","Normal"],["alto","Alto"],["luxo","Luxo"]],"Acabamentos",{q:"padrão"})) : "";
  const coef = par ? GRP(`Coeficientes ${INFO("Fração do CUB por unidade de cada direcionador. Os padrões ficam perto de CUB × fator no exemplo; ajuste com o histórico das suas obras.")}`) + KV(
      NUM("orc.coef.fund","Fundação","% CUB",{pct:true,step:0.1,help:"Por m² de carga: projeção × pavimentos (torres + embasamento), × fator do solo"}) +
      NUM("orc.coef.cont","Contenção","% CUB",{pct:true,step:1,help:"Por m² de parede de subsolo (perímetro × profundidade). Zera quando a topografia calcula a contenção"}) +
      NUM("orc.coef.estr","Estrutura","% CUB",{pct:true,step:0.5,help:"Por m² construído; +1% por pavimento acima de 10. Transições entram como custo extra"}) +
      NUM("orc.coef.ved","Vedações","% CUB",{pct:true,step:0.5,help:"Por m² de pavimentos (garagem conta 10%)"}) +
      NUM("orc.coef.fach","Fachada","% CUB",{pct:true,step:0.5,help:"Por m² de fachada, × padrão (textura 0,6 · porcelanato 1 · vidro 2,2)"}) +
      NUM("orc.coef.inst","Instalações","% CUB",{pct:true,step:0.5,help:"Por m² construído"}) +
      NUM("orc.coef.instUn","Instalações / unidade","CUB",{step:0.5,help:"CUBs por unidade (medição, prumadas, quadros)"}) +
      NUM("orc.coef.elev","Elevadores","CUB/parada",{step:0.5,help:"CUBs por parada de cada elevador"}) +
      NUM("orc.coef.acab","Acabamentos","% CUB",{pct:true,step:0.5,help:"Por m² acabado (garagem 25%), × padrão"}) +
      NUM("orc.coef.cant","Canteiro e adm.","% sist.",{pct:true,step:0.5,help:"Canteiro e administração da obra, sobre a soma dos sistemas"})) +
      `<div class="row"><button type="button" class="btn sm ghost" data-act="orcReset">Restaurar coeficientes</button></div>` : "";
  const cub = GRP(`Tabela CUB ${INFO("Tabela embutida conferida em "+cubVersaoTxt()+" (mês e fonte de cada estado abaixo; onde só o R8-N foi publicado os outros padrões são estimados). CSV: uf;padrao;valor;ref;fonte (uma linha por padrão) ou uma coluna por padrão (uf;ref;fonte;R8-N;R16-N…). JSON com os mesmos campos.")}`) + KV(
      finSEL("orc.uf", lista.map(r=>[r.uf, `${r.uf} · ${r.nome}`]), "Estado", {rr:true, fx:"cub", q:"cub sinduscon"}) +
      finSEL("orc.padrao", CUB_PADROES, "Padrão", {rr:true, fx:"cub", q:"cub r8 r16"})) + SW("orc.cubAuto","Seguir a tabela do estado",{fx:"cub", rr:true}) + finCubSug() +
    `<div id="cubInfo"></div><div class="row"><button type="button" class="btn sm" data-act="cubUsar">Usar como CUB de referência</button><label class="btn sm ghost" style="cursor:pointer">Importar CSV/JSON<input type="file" id="cubFile" accept=".csv,.json,.txt,text/csv,application/json" hidden></label>${(O.cubTab||[]).length?`<button type="button" class="btn sm ghost" data-act="cubLimpa">Voltar à tabela embutida</button>`:""}</div>`;
  return SEC("Orçamento da obra",
    finCampoSeg("Método", "orçamento paramétrico sistema cub fator", SEG("orc.modo",[["cub","CUB × fator"],["param","Paramétrico"]],{full:true,label:"Método do orçamento"})) +
    KV(NUM("fin.incc","INCC","% a.a.",{pct:true,step:0.25,help:"INCC",q:"correção custo"})) +
    `<div id="orcTop"></div><div class="use" id="orcBars"></div><p class="note" id="orcNote"></p>` + padroes +
    ADV((par? "" : KV(NUM("fin.eqGar","Equivalência garagem","×",{step:0.05,help:"Área equivalente"}))) + coef + cub, {key:"orc"}),
    {key:"orc", cls:"fq", info:"CUB × fator: obra = área equivalente × CUB × fator. Paramétrico: soma dos sistemas (fundação, estrutura, fachada…) calculados pelo modelo. As barras mostram a distribuição por sistema nos dois modos.", sum:""});
}
function finOrcLive(m, f){
  const O=S.orc, par=O.modo==="param", o=orcCalc(S,m), C=S.fin.cub, d=o.drivers;
  const totCub = o.cubFator + o.lazer + o.extraT, tot = par? o.total : totCub, dif = o.total/Math.max(1,totCub)-1;
  setSum("orc", `${par?"paramétrico":"CUB × fator"} · <b>${mi(tot)}</b>`);
  if(par) setSub("fin.cub", `obra pelo orçamento paramétrico: ${mi(tot)}`);
  if(!finVis("orcTop")) return;
  setHTML("orcTop", `<div class="mets"><div class="met"><div class="l">Obra (sem INCC)</div><div class="v">${mi(tot)}</div><div class="s">${par?"soma dos sistemas":"CUB × fator"}</div></div>
    <div class="met"><div class="l">Custo / m² construído</div><div class="v">${brl(tot/Math.max(1,m.constr))}</div><div class="s">${nf(tot/Math.max(1,m.constr)/Math.max(1,C),2)} × CUB</div></div></div>`);
  const its=o.itens.filter(i=>i.total>0), mx=Math.max(1,...its.map(i=>i.total));
  setHTML("orcBars", its.map(i=>`<div class="ur" style="grid-template-columns:minmax(0,118px) 1fr 74px" title="${esc(i.nome)}${i.extra?` · inclui ${mi(i.extra)} de ${esc(i.extras.map(x=>x.nome).join("; "))}`:""}"><span>${esc(i.nome)}</span>
    <div class="bar"><i style="width:${Math.max(1,i.param/mx*100).toFixed(1)}%;background:${i.cor};float:left;border-radius:6px 0 0 6px"></i>${i.extra?`<i style="width:${(i.extra/mx*100).toFixed(1)}%;background:${i.cor};opacity:.45;float:left;border-radius:0 6px 6px 0"></i>`:""}</div>
    <span style="font-family:var(--f-mono);text-align:right;white-space:nowrap">${mi(i.total)}</span></div>`).join(""));
  const nEl=d.elevs.reduce((s,e)=>s+e.n,0);
  setHTML("orcNote", par? `Diferença para CUB × fator: <b>${finPP(dif)}%</b> (${mi(totCub)}).` : `Paramétrico daria <b>${mi(o.total)}</b> (${finPP(dif)}%).`);
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
  setHTML("cubInfo", cubInfoHTML(r, val, C));
}

/* ---------------- Riscos ---------------- */
function finRiscoHTML(){ return finCenHTML() + finSensHTML() + finMCHTML() }

/* ---------------- 3.2 Cenários ---------------- */
function finCenHTML(){
  const lin=(k,l,u,step,lab)=>`<span class="fl">${l}</span>${finIN(`flx.cen.pess.${k}`,u,{pct:true,step,label:"Pessimista: "+lab})}${finIN(`flx.cen.otim.${k}`,u,{pct:true,step,label:"Otimista: "+lab})}`;
  return RES(`Cenários`, `<table class="tbl multi" id="cenTab" style="table-layout:fixed"></table>`, {aside:INFO("Cenários")}) +
    SEC("Variações dos cenários", `<div class="fcen"><span></span><span class="fl">Pessimista</span><span class="fl">Otimista</span>
      ${lin("preco","Preço de venda","%",1,"preço")}${lin("vel","Prazo de vendas","%",5,"prazo de vendas")}${lin("custo","Custo de obra","%",1,"custo")}${lin("juros","Juros e TMA","p.p.",0.25,"juros")}</div>`,
      {key:"cenVar", info:"Variações sobre o estudo base. Prazo de vendas positivo = vende mais devagar.", sum:""});
}
function finCenLive(m, f){
  const cs=flxCenarios(S, m, f), row=(l,fn)=>`<tr><td>${l}</td>${cs.map(c=>`<td${c.k==="base"?' style="font-weight:600"':""}>${fn(c.f)}</td>`).join("")}</tr>`;
  setHTML("cenTab", `<tr><th style="min-width:0;width:25%"></th>${cs.map(c=>`<th style="min-width:0">${c.nome}</th>`).join("")}</tr>` +
    row("Lucro", x=>`<span style="color:${x.lucro<0?"var(--bad)":"inherit"}">${mi(x.lucro)}</span>`) + row("Margem s/ VGV", x=>pct(x.margemVGV)) + row("TIR a.a.", x=>finTir(x.tirA)) +
    row("VPL", x=>mi(x.vpl)) + row("Exposição", x=>mi(-x.exp)) + row("VGV", x=>mi(x.vgv)));
  FIN_UI.cen = cs;
}

/* ---------------- 3.2 Sensibilidade (tornado) ---------------- */
function finTornSVG(t, met){
  const val=o=> met==="tir"? (o.tir==null? null : o.tir) : o.margem, b=val(t.base), vs=t.vars;
  const all=[b,...vs.flatMap(v=>[val(v.lo),val(v.hi)])].filter(x=>x!=null&&isFinite(x)); if(!all.length) return "";
  const mn=Math.min(...all), mx=Math.max(...all), W=360, L=122, R=40, rh=21, H=vs.length*rh+26, sx=v=>L+(W-L-R)*((v??mn)-mn)/((mx-mn)||1), x0=sx(b);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Sensibilidade: impacto de cada variável na ${met==="tir"?"TIR":"margem sobre o VGV"}">
    ${vs.map((v,i)=>{ const y=6+i*rh, lo=sx(val(v.lo)), hi=sx(val(v.hi));
      return `<text x="${L-8}" y="${y+9}" font-size="10.5" text-anchor="end" fill="var(--ink-2)">${esc(v.nome)}</text><text x="${L-8}" y="${y+18}" font-size="8.5" text-anchor="end" fill="var(--muted)" font-family="DM Sans, system-ui, sans-serif">${v.faixa}</text>
      <rect x="${Math.min(lo,x0).toFixed(1)}" y="${y+2}" width="${Math.max(0.8,Math.abs(lo-x0)).toFixed(1)}" height="13" rx="2" fill="var(--bad)" fill-opacity=".72"/>
      <rect x="${Math.min(hi,x0).toFixed(1)}" y="${y+2}" width="${Math.max(0.8,Math.abs(hi-x0)).toFixed(1)}" height="13" rx="2" fill="var(--ok)" fill-opacity=".72"/>
      <text x="${(Math.max(lo,hi)+4).toFixed(1)}" y="${y+12}" font-size="8.5" fill="var(--muted)" font-family="DM Sans, system-ui, sans-serif">${finTir(Math.max(val(v.lo)??-1,val(v.hi)??-1))}</text>` }).join("")}
    <line x1="${x0}" x2="${x0}" y1="2" y2="${H-18}" stroke="var(--ink)" stroke-width="1"/><text x="${x0}" y="${H-5}" font-size="9" text-anchor="middle" fill="var(--ink-2)" font-family="DM Sans, system-ui, sans-serif">base ${finTir(b)}</text>
  </svg>`;
}
function finSensHTML(){
  return SEC("Sensibilidade", SEG("flx.sens",[["margem","Margem s/ VGV"],["tir","TIR"]],{label:"Métrica"}) + `<div id="torn"></div>
    <div class="stackleg"><span><i style="background:var(--bad);opacity:.72"></i>desfavorável</span><span><i style="background:var(--ok);opacity:.72"></i>favorável</span></div>
    <div class="grp">Margem s/ VGV: preço × custo de obra</div><div class="sens" id="sens"></div>`, {key:"sens", open:true, info:"Sensibilidade", sum:""});
}
function finSensLive(m, f){
  if(!finVis("torn")) return;
  const met=S.flx.sens==="tir"?"tir":"margem", t=flxTornado(S, m, null, met); FIN_UI.torn=t;
  setHTML("torn", finTornSVG(t, met));
  const sens=sensGrid(S,m);
  setHTML("sens", `<div class="h"></div><div class="h">obra −10%</div><div class="h">base</div><div class="h">obra +10%</div>`+["preço −10%","preço base","preço +10%"].map((l,i)=>`<div class="h" style="text-align:right">${l}</div>`+sens[i].map(v=>`<div style="background:color-mix(in srgb, ${finSCol(v)} 22%, transparent);${i===1?"font-weight:600":""}">${pct(v)}</div>`).join("")).join(""));
}

/* ---------------- 3.2 Monte Carlo ---------------- */
const finMCSig = () => JSON.stringify([S.fin, S.produto.mix, S.produto.cob, S.flx.curva, S.flx.receb, S.orc.modo, S.orc.coef, window._last? Math.round(window._last.f.lucro) : 0]);
function finMCHTML(){
  const on=S.flx.mc.on, M=FIN_UI.mc;
  return SEC("Monte Carlo", finQ("monte carlo simulação incerteza", SW("flx.mc.on","Simular incertezas",{rr:true, fx:"save"})) + (on? `
    <div class="row"><button type="button" class="btn pri sm" data-act="mcRun">${M.run?"Simulando…":M.res?"Rodar de novo":"Rodar 1.000 simulações"}</button><span class="note" id="mcProg"></span></div><div id="mcRes"></div>` : ""),
    {key:"mc", open:on, info:"Roda o estudo 1.000 vezes sorteando (triangular): preço −10% a +6%, custo −5% a +12%, prazo de vendas −20% a +50%, INCC −1 a +3 p.p. e prazo de obra −5% a +20%. P10 / P50 / P90 = faixa provável do resultado.", sum:""});
}
function finMCHist(r){
  const L=r.lucros.slice().sort((a,b)=>a-b), mn=L[0], mx=L[L.length-1], nb=24, W=360, H=110, pl=6, pb=18, bw=(W-2*pl)/nb, h=new Array(nb).fill(0);
  L.forEach(v=>h[Math.min(nb-1,Math.floor((v-mn)/((mx-mn)||1)*nb))]++); const hm=Math.max(...h), sx=v=>pl+(W-2*pl)*(v-mn)/((mx-mn)||1);
  const mk=(v,l,c)=>`<line x1="${sx(v)}" x2="${sx(v)}" y1="6" y2="${H-pb}" stroke="${c}" stroke-dasharray="3 2"/><text x="${sx(v)}" y="${H-5}" font-size="8.5" text-anchor="middle" fill="${c}" font-family="DM Sans, system-ui, sans-serif">${l}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Distribuição do lucro">${h.map((c,i)=>`<rect x="${(pl+i*bw+0.5).toFixed(1)}" y="${(H-pb-(H-pb-8)*c/hm).toFixed(1)}" width="${(bw-1).toFixed(1)}" height="${((H-pb-8)*c/hm).toFixed(1)}" fill="${mn+(i+0.5)*(mx-mn)/nb<0?"var(--bad)":"var(--accent)"}" fill-opacity=".55"/>`).join("")}
    ${mk(r.lucro[0],"P10","var(--muted)")}${mk(r.lucro[1],"P50","var(--ink)")}${mk(r.lucro[2],"P90","var(--muted)")}${mn<0&&mx>0?mk(0,"0","var(--bad)"):""}</svg>`;
}
function finMCSum(){
  const M=FIN_UI.mc, r=M.res; if(!S.flx.mc.on) return "desligado"; if(M.run) return `simulando… ${nf(M.prog*100,0)}%`;
  if(!r) return "pronto para rodar"; return `TIR P50 <b>${finTir(r.tir[1])}</b> · prejuízo ${pct(r.pPrej,0)}${M.sig!==finMCSig()?" · desatualizado":""}`;
}
function finMCLive(){
  const M=FIN_UI.mc, r=M.res; setSum("mc", finMCSum()); if(!S.flx.mc.on) return;
  const pr=document.getElementById("mcProg"); if(pr) pr.textContent = M.run? `${nf(M.prog*100,0)}%` : (r && M.sig!==finMCSig()? "premissas mudaram — rode de novo" : r? `${r.n} rodadas` : "");
  setHTML("mcRes", r? `<div class="mets" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-top:6px">${["P10","P50","P90"].map((l,i)=>`<div class="met"><div class="l">TIR ${l}</div><div class="v" style="font-size:16px">${finTir(r.tir[i])}</div><div class="s">${mi(r.lucro[i])}</div></div>`).join("")}</div>
    ${finMCHist(r)}<p class="note">Probabilidade de prejuízo: <b style="color:${r.pPrej>0.1?"var(--bad)":r.pPrej>0?"var(--warn)":"var(--ok)"}">${pct(r.pPrej,1)}</b></p>` : "");
}
function finMCRun(){
  const M=FIN_UI.mc; if(M.run || !window._last) return; const {m}=window._last, st=clone(S), rng=flxRng(7), out=[], N=Math.max(100,Math.min(5000,+S.flx.mc.n||1000)), tok=++M.tok;
  const btn=()=>document.querySelector('#tabbody [data-act="mcRun"]');
  M.run=true; M.prog=0; M.sig=finMCSig(); if(btn()) btn().textContent="Simulando…";
  const step=()=>{ if(tok!==M.tok) return; const t0=performance.now(); while(out.length<N && performance.now()-t0<30) out.push(flxMCRodada(st,m,rng));
    M.prog=out.length/N; if(out.length<N){ finMCLive(); setTimeout(step,0) } else { M.res=flxMCResumo(out); M.run=false; if(btn()) btn().textContent="Rodar de novo"; finMCLive() } };
  setTimeout(step,0);
}

/* ---------------- 3.3 Terreno (sub-aba Vendas) ---------------- */
function finTerHTML(){
  const A=S.terAlt, on=A.on, mf=finMCompleto(window._last && window._last.m), us=mf? terAltUnidades(mf) : null;
  const body = finQ("terreno permuta spe compra parcelada", SW("terAlt.on","Comparar formas de pagar o terreno",{rr:true})) + (on? KV(
      NUM("terAlt.preco","Preço pedido à vista","R$",{step:10000,wide:true,zero:true,ph:nf(S.fin.terreno,0),help:"Vazio = terreno das premissas"}) +
      NUM("terAlt.permF","Permuta física","% VGV",{pct:true,step:0.5,sub:"",help:"Permuta física"}) + NUM("terAlt.permFin","Permuta financeira","%",{pct:true,step:0.5,help:"Permuta financeira"}) +
      NUM("terAlt.speS","SPE: terreneiro","% lucro",{pct:true,step:1,help:"SPE"}) + NUM("terAlt.taxa","Taxa do terreneiro","% a.a.",{pct:true,step:0.5,help:"Desconto que o terreneiro aplica ao que recebe no futuro"})) +
    (us? `<details class="sub"><summary class="note" style="cursor:pointer">Unidades da permuta física (${(A.unidades||[]).length} escolhidas)</summary><div class="list" id="terUn" style="max-height:220px;overflow:auto;margin-top:6px"></div></details>` : "") +
    ADV(GRP("Compra parcelada") + KV(NUM("terAlt.parcEntrada","Entrada","%",{pct:true,step:5})+NUM("terAlt.parcN","Parcelas","meses",{step:1,int:true,min:1})+NUM("terAlt.parcAcresc","Acréscimo","%",{pct:true,step:1}),3) +
      SW("terAlt.parcCorr","Parcelas corrigidas pelo INCC") +
      finCampoSeg("Base da permuta financeira", "permuta financeira base", SEG("terAlt.permBase",[["receita","Receita"],["vgv","VGV"]],{full:true,label:"Base da permuta financeira"})), {key:"terAlt"}) +
    `<div id="terBox"></div>` : "");
  return SEC("Pagamento do terreno", body, {key:"terAlt", info:"Compra à vista ou parcelada, permuta física, permuta financeira e SPE, lado a lado, com o fluxo e o VPL dos dois lados. ITBI sobre o preço pedido em todas. Na física o terreneiro recebe as unidades nas chaves; na SPE o incorporador recupera o investimento e depois divide o caixa.", sum:""});
}
function finTerSVG(r){
  const ks=Object.keys(r.alts), cols={vista:"var(--accent)",parc:"var(--m-sub)",fis:"var(--mark)",fin:"var(--ok)",spe:"var(--m-env)"};
  const n=Math.max(...ks.map(k=>r.alts[k].terr.length)), cum={}; ks.forEach(k=>{ let s=0; cum[k]=r.alts[k].terr.map(v=>s+=v) });
  const mx=Math.max(1,...ks.map(k=>cum[k][cum[k].length-1])), W=360, H=130, pl=40, pr=6, pt=8, pb=18, sx=i=>pl+(W-pl-pr)*i/Math.max(1,n-1), sy=v=>pt+(H-pt-pb)*(1-v/mx);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Recebimentos acumulados do terreneiro">
    ${[0,mx/2,mx].map(v=>`<line x1="${pl}" x2="${W-pr}" y1="${sy(v)}" y2="${sy(v)}" stroke="var(--line)" ${v?'stroke-dasharray="2 3"':""}/><text x="${pl-4}" y="${sy(v)+3}" font-size="9" text-anchor="end" fill="var(--muted)" font-family="DM Sans, system-ui, sans-serif">${nf(v/1e6,1)}mi</text>`).join("")}
    ${ks.map(k=>`<path d="${cum[k].map((v,i)=>(i?"L":"M")+sx(i).toFixed(1)+","+sy(v).toFixed(1)).join("")}" fill="none" stroke="${cols[k]}" stroke-width="1.8"/>`).join("")}
    <text x="${W-pr}" y="${H-5}" font-size="9" text-anchor="end" fill="var(--muted)">meses</text><text x="${pl}" y="${H-5}" font-size="9" fill="var(--muted)">0</text>
  </svg><div class="stackleg">${ks.map(k=>`<span><i style="background:${cols[k]}"></i>${r.alts[k].nome}</span>`).join("")}</div>`;
}
/* o cálculo rápido (prévia enquanto o Worker trabalha) não traz a tabela de unidades: usa o último modelo completo */
const finMCompleto = m => typeof vdM==="function"? vdM(m) : m;
function finTerLive(m, fast){
  if(!S.terAlt.on){ setSum("terAlt","desligado"); return }
  if(!finVis("terBox")){ const r=FIN_UI.ter; if(r){ const A=r.alts, ks=Object.keys(A), b=ks.reduce((b,k)=>A[k].vpl>A[b].vpl?k:b,ks[0]); setSum("terAlt", `melhor para você: <b>${A[b].nome}</b>`) } else setSum("terAlt","ligado"); return }
  if(fast && FIN_UI.ter) return; m=finMCompleto(m);
  const r=terAltCalc(S, m); FIN_UI.ter=r; const A=r.alts, ks=Object.keys(A);
  const bestI=ks.reduce((b,k)=>A[k].vpl>A[b].vpl?k:b,ks[0]), bestT=ks.reduce((b,k)=>A[k].terrVPL>A[b].terrVPL?k:b,ks[0]);
  setSum("terAlt", `melhor para você: <b>${A[bestI].nome}</b>`);
  const quando=a=> a.ini==null? "—" : a.ini===a.fim? `${a.ini}` : `${a.ini}–${a.fim}`;
  const det=k=>{ const a=A[k]; return k==="parc"? `${brl(a.preco)} · ${pct(S.terAlt.parcEntrada,0)} + ${S.terAlt.parcN}×` : k==="fis"? `${pct(a.p,1)} do VGV${a.porUnid?` · ${a.nUn} un.`:""}` : k==="fin"? `${pct(a.p,1)} da ${a.base==="vgv"?"venda":"receita"}` : k==="spe"? `${pct(a.s,0)} do resultado` : brl(r.P) };
  const I=r.ind, ip=v=> v==null? "> 90%" : pct(v,1);
  setSub("terAlt.permF", A.fis.porUnid? `${A.fis.nUn} unidades · ${mi(A.fis.valor)}` : `≈ ${mi(A.fis.valor)} em unidades`);
  const faixa = I.fis.inc!=null&&I.fis.terr!=null? (I.fis.terr<=I.fis.inc? `Faixa de acordo na física: <b>${pct(I.fis.terr,1)} a ${pct(I.fis.inc,1)}</b>` : `Na física não há faixa de acordo`) : "";
  setHTML("terBox", `<div class="grp">Para você (incorporador)</div><table class="tbl multi" style="table-layout:fixed"><tr><th style="min-width:0;width:38%">Alternativa</th><th style="min-width:0">Lucro</th><th style="min-width:0;width:17%">TIR</th><th style="min-width:0">VPL</th></tr>
    ${ks.map(k=>`<tr><td>${A[k].nome}<div class="fsub">${det(k)}</div></td><td>${mi(A[k].lucro)}</td><td>${finTir(A[k].tirA)}</td><td${k===bestI?' class="best"':""}>${mi(A[k].vpl)}</td></tr>`).join("")}</table>
    <div class="grp">Para o terreneiro</div><table class="tbl multi" style="table-layout:fixed"><tr><th style="min-width:0;width:38%">Alternativa</th><th style="min-width:0">Recebe</th><th style="min-width:0;width:17%">Mês</th><th style="min-width:0">VPL</th></tr>
    ${ks.map(k=>`<tr><td>${A[k].nome}</td><td>${mi(A[k].terrTot)}</td><td>${quando(A[k])}</td><td${k===bestT?' class="best"':""}>${mi(A[k].terrVPL)}</td></tr>`).join("")}</table>
    ${finTerSVG(r)}
    <div class="grp">Ponto de indiferença ${INFO("Ponto de indiferença")}</div>
    <table class="tbl multi" style="table-layout:fixed"><tr><th style="min-width:0;width:38%">${mi(r.P)} à vista =</th><th style="min-width:0">Para você</th><th style="min-width:0">Terreneiro</th></tr>
      <tr><td>Permuta física</td><td>${ip(I.fis.inc)}</td><td>${ip(I.fis.terr)}</td></tr><tr><td>Permuta financeira</td><td>${ip(I.fin.inc)}</td><td>${ip(I.fin.terr)}</td></tr></table>
    ${faixa?`<p class="note">${faixa}</p>`:""}
    <div class="fusar"><span class="fl">Usar nas premissas</span><button type="button" class="btn sm" data-act="terUsar" data-k="vista">À vista</button><button type="button" class="btn sm" data-act="terUsar" data-k="fis">Permuta física</button><button type="button" class="btn sm" data-act="terUsar" data-k="fin">Permuta financeira</button></div>`);
  const us=terAltUnidades(m), sel=(S.terAlt.unidades||[]).map(String);
  if(us) setHTML("terUn", us.map(u=>`<label class="sw"><input type="checkbox" data-act="terUn" data-id="${esc(u.id)}" ${sel.includes(String(u.id))?"checked":""}><span class="tg"></span><span>${esc(u.nome)} · ${esc(u.tip)} · ${nf(u.area,0)} m² · ${mi(u.valor)}</span></label>`).join(""));
  const sm=document.querySelector('#tabbody details.sub > summary.note'); if(sm && document.getElementById("terUn")) sm.textContent=`Unidades da permuta física (${sel.length} escolhidas)`;
}
addCard("viab", { key:"terAlt", sub:"vendas", order:60, html: finTerHTML, live: (m,f,fast)=>finTerLive(m,fast) });

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

/* ================= ligação com a etapa ================= */
function finStatusHTML(f){ const F=S.fin, M=S.metas.margem.min, g=f.margemVGV; return `<span class="pill ${g<0||g<M?"bad":g<F.margemAlvo?"warn":"ok"}">${g<0?"prejuízo":g<M?"abaixo do mínimo":g<F.margemAlvo?"abaixo da meta":"acima da meta"}</span>` }
function finSums(m, f){
  const F=S.fin, rd=S.flx.receb, cv=S.flx.curva, cen=S.flx.cen, P=S.produto;
  setSum("cash", `exposição <b>${mi(-f.exp)}</b> · payback ${f.pay==null?"—":"mês "+f.pay}`);
  setSum("dre", `receita ${mi(f.receita)} · lucro <b>${mi(f.lucro)}</b>`);
  const pm = P.mix.length? P.mix.reduce((s,u)=>s+u.preco*u.area*u.qtd,0)/Math.max(1,P.mix.reduce((s,u)=>s+u.area*u.qtd,0)) : 0;
  setSum("essObra", `terreno <b>${mi(F.terreno)}</b> · CUB ${brl(F.cub)}`);
  setSum("essVenda", `<b>${brl(pm)}</b>/m² · vendas ${nf(F.venda,0)} m · obra ${nf(F.obra,0)} m`);
  setSum("ind", `<b>${pct(F.projetos+F.adm+F.conting,0)}</b> da obra · ITBI ${pct(F.itbi,1)}`);
  setSum("rec", `corretagem ${pct(F.corret,1)} · RET ${pct(F.imp,1)}${F.permuta?` · permuta ${pct(F.permuta,0)}`:""}${F.permutaFin?` · perm. fin. ${pct(F.permutaFin,1)}`:""}`);
  setSum("receb", rd.modo==="det"? `detalhado · repasse <b>${pct(flxRepasse(rd),0)}</b>${rd.distrato?` · distratos ${pct(rd.distrato,0)}`:""}` : `simples · <b>${pct(F.entrada,0)}</b> até as chaves`);
  setSum("crono", `lançamento no mês <b>${nf(F.prelanc,0)}</b> · ${({sen:"senoidal",s:"curva S",sis:"por sistema"})[cv.modo]||"senoidal"}`);
  setSum("finan", F.finOn? `<b>${pct(F.finPct,0)}</b> da obra · ${pct(F.finTaxa,1)} a.a.` : "desligado");
  finMetasSum();
  setSum("cenVar", `preço ${finPP(cen.pess.preco,0)}/${finPP(cen.otim.preco,0)}% · custo ${finPP(cen.pess.custo,0)}/${finPP(cen.otim.custo,0)}%`);
  setSum("sens", FIN_UI.torn && FIN_UI.torn.vars[0]? `maior impacto: <b>${esc(FIN_UI.torn.vars[0].nome)}</b>` : S.flx.sens==="tir"? "TIR" : "margem");
}
function finViabLive(m, f, fast){
  const F=S.fin;
  const vs=document.getElementById("vStat"); if(vs){ const h=finStatusHTML(f); if(vs.innerHTML!==h) vs.innerHTML=h }
  if(document.getElementById("finSaude")){ setHTML("finSaude", saudeResHTML(m, f)); const st=document.getElementById("sdStat"), h=saudeStatusHTML(f); if(st && st.innerHTML!==h) st.innerHTML=h }
  if(document.getElementById("finTop")) setHTML("finTop", finTopHTML(m, f));
  if(document.getElementById("finMini")) setHTML("finMini", finMiniHTML(f));
  if(finVis("cash")) setHTML("cash", cashSVG(f));
  if(finVis("dre")) setHTML("dre", finDREHTML(m, f));
  finSums(m, f);
  saudePermutaSub();
  if(document.getElementById("f-fin-terreno")){
    setSub("fin.terreno",`${brl(F.terreno/Math.max(1,m.A))}/m² · ${pct(F.terreno/Math.max(1,f.vgvB))} do VGV · máx. ${mi(f.maxTerreno)}`);
    setSub("fin.fator",`${brl(F.cub*F.fator)}/m² equiv.`);
    if(S.orc.modo!=="param"){ const r=cubLinha(S,S.orc.uf), v=r&&r.v[S.orc.padrao]; setSub("fin.cub", v? `${S.orc.padrao} ${r.uf}${r.ref?" · "+cubRefTxt(r.ref):""}: ${nf(v,0)}${r.ilustrativo?" · ilustrativo":(r.est||[]).includes(S.orc.padrao)?" · estimado":""}` : "") }
    setSub("fin.incc",`efeito ${mi(f.obraTot-(f.obra+f.adm+f.conting))}`);
    S.produto.mix.forEach((u,i)=>setSub(`produto.mix.${i}.preco`, `${(m.unitRows[i]||{}).n||0} un. · ${mi(((m.unitRows[i]||{}).area||0)*u.preco)}`));
    if(F.finOn) setSub("fin.finPct",`limite ${mi(f.lim)} · juros ${mi(f.juros)}`);
    const rd=S.flx.receb; if(rd.modo==="det") setSub("flx.receb.ato", `repasse/saldo ${pct(flxRepasse(rd),0)}${f.distratoV?` · distratos −${mi(f.distratoV)}`:""}`);
    finOrcLive(m, f);
    if(S.flx.curva.modo!=="sen" && finVis("obraCurve")) setHTML("obraCurve", finObraSVG(f));
  }
  if(fast) return;
  if(finVis("cenTab")) finCenLive(m, f);
  finSensLive(m, f); finMCLive();
  if(document.getElementById("sum-sens")) finSums(m, f);
}
/* busca de premissas: filtra os campos, abre as seções (e "Mais opções") que têm resultado e devolve tudo como estava ao limpar */
const finNorm = s=>String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
function finBusca(q){
  q=finNorm(q.trim()); let achou=0;
  TB.querySelectorAll("details.sec.fq, details.sec[data-key=essObra], details.sec[data-key=essVenda]").forEach(d=>{
    if(q && d.dataset.bOpen==null) d.dataset.bOpen=d.open?"1":"";
    const tit=finNorm(d.querySelector("summary .st")?.textContent), todos=!!q && tit.includes(q);
    let n=0; d.querySelectorAll("[data-q]").forEach(f=>{ const ok=!q || todos || finNorm(f.dataset.q).includes(q); f.hidden=!ok; if(ok) n++ });
    d.querySelectorAll(".advb").forEach(a=>{ if(q){ if(a.dataset.bHid==null) a.dataset.bHid=a.hidden?"1":""; a.hidden=false } else if(a.dataset.bHid!=null){ a.hidden=a.dataset.bHid==="1"; delete a.dataset.bHid } });
    if(q){ const vis=todos || n>0; d.hidden=!vis; if(vis){ d.open=true; achou++ } }
    else { d.hidden=false; if(d.dataset.bOpen!=null){ d.open=d.dataset.bOpen==="1"; delete d.dataset.bOpen } }
  });
  const nd=document.getElementById("vqNada"); if(nd) nd.hidden=!q || achou>0;
}
function finViabAfter(){
  const fi=document.getElementById("cubFile");
  if(fi) fi.onchange=()=>{ const file=fi.files[0]; if(!file) return; file.text().then(t=>{ try{ const rows=cubParse(t); if(!rows.length){ toast("Nenhum valor de CUB reconhecido no arquivo"); return }
    const cur=(S.orc.cubTab||[]).filter(r=>!rows.some(x=>x.uf===r.uf)); S.orc.cubTab=[...cur,...rows]; if(rows.length===1) S.orc.uf=rows[0].uf; save(); renderTab();
    toast(`CUB importado: ${rows.map(r=>r.uf).join(", ")}`) }catch(e){ toast("Arquivo inválido: use CSV ou JSON") } }) };
  const q=document.getElementById("vqFind"); if(q) q.addEventListener("input", ()=>finBusca(q.value));
  // partes vivas que dependem de uma seção aberta: recalcula quando o usuário expande
  TB.querySelectorAll("details.sec").forEach(d=>d.addEventListener("toggle",()=>{ if(d.open && window._last && !d.dataset.bOpen) renderLive(window._last.m, window._last.f, false) }));
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
    renderTab(); toast("Premissas do terreno atualizadas: "+TERALT_NOMES[k]) },
  /* vai para outra sub-aba da Viabilidade e abre uma seção */
  finIr: b=>{ const k=b.dataset.open; if(k){ const st=LS.get("gabarito.det")||{}; st["viab:"+k]=1; LS.set("gabarito.det",st) }
    SUBX.viab=b.dataset.v; LS.set("gabarito.subx",SUBX); renderTab(); TB.scrollTop=0;
    const d=k && TB.querySelector(`details[data-key="${k}"]`); if(d){ d.open=true; d.scrollIntoView({block:"start"}) } },
});

/* ---------------- PDF ---------------- */
HOOK.pdf.push(async ctx=>{
  const {doc,m,f,T,PW,M,h2,rows}=ctx, O=S.orc, o=orcCalc(S,m), par=O.modo==="param", C=S.fin.cub;
  ctx.newPage(); h2(par? "Orçamento paramétrico por sistema" : "Orçamento (CUB x fator) e distribuição por sistema");
  const tot=par? o.total : o.cubFator+o.lazer+o.extraT;
  rows([...o.itens.filter(i=>i.total>0).map(i=>[i.nome+(i.extra?` (inclui ${mi(i.extra)} de outros módulos)`:""), `${mi(i.total)} · ${pct(i.total/Math.max(1,o.total),1)}`]),
    ["Total da obra (sem INCC)", mi(tot)], ["Custo por m² construído", `${brl(tot/Math.max(1,m.constr))} · ${nf(tot/Math.max(1,m.constr)/Math.max(1,C),2)} CUB`],
    [par? "Diferença para CUB x fator" : "Paramétrico (comparação)", par? `${finPP(o.total/Math.max(1,o.cubFator+o.lazer+o.extraT)-1)}%` : mi(o.total)]], {bold:["Total da obra (sem INCC)"]});
  { const r=cubLinha(S,O.uf); rows([["CUB de referência", `${brl(C)}/m² · tabela ${O.uf} ${O.padrao}: ${r&&r.v[O.padrao]? brl(r.v[O.padrao]) : "-"}`], ["Fonte da tabela CUB", cubDescricao(S,O.uf,O.padrao)+" · tabela embutida de "+cubVersaoTxt()]]) }
  ccalPdf(ctx);
  const RD=S.flx.receb, CV=S.flx.curva;
  h2("Fluxo: curva de obra e recebimento");
  rows([["Curva de obra", {sen:"senoidal", s:`curva S (início ${pct(CV.ini,0)}, pico ${pct(CV.pico,0)}, fim ${pct(CV.fim,0)} do prazo)`, sis:`por sistema (início ${pct(CV.ini,0)}, fim ${pct(CV.fim,0)})`}[CV.modo]||"senoidal"],
    ["Recebimento", RD.modo==="det"? `ato ${pct(RD.ato,0)} · mensais ${pct(RD.mensais,0)} · semestrais ${pct(RD.interm,0)} · chaves ${pct(RD.chaves,0)}${RD.pos?` · pós-chaves ${pct(RD.pos,0)} em ${RD.posN} meses`:""} · repasse ${pct(flxRepasse(RD),0)} (+${RD.repasseMes} meses)` : `simples: ${pct(S.fin.entrada,0)} até as chaves, saldo nas chaves`],
    ...(RD.modo==="det"? [["Correção", `INCC ${pct(S.fin.incc)} até as chaves · IPCA ${pct(RD.ipca)} depois`], ["Distratos", RD.distrato? `${pct(RD.distrato,0)} dos contratos no mês ${RD.distratoMes} após o lançamento (retenção ${pct(RD.retencao,0)}): -${mi(f.distratoV)}` : "não considerados"]] : [])]);
  const cs=flxCenarios(S,m,f); h2("Cenários");
  rows([["", cs.map(c=>c.nome).join("  |  ")], ...[["Lucro",x=>mi(x.lucro)],["Margem s/ VGV",x=>pct(x.margemVGV)],["TIR a.a.",x=>finTir(x.tirA)],["VPL",x=>mi(x.vpl)],["Exposição",x=>mi(-x.exp)]].map(([l,fn])=>[l, cs.map(c=>fn(c.f)).join("  |  ")])]);
  const t=flxTornado(S,m,null,"margem"); h2("Sensibilidade da margem s/ VGV (desfavorável / favorável)");
  rows(t.vars.map(v=>[`${v.nome} (${v.faixa})`, `${pct(v.lo.margem)} / ${pct(v.hi.margem)}  ·  TIR ${finTir(v.lo.tir)} / ${finTir(v.hi.tir)}`]));
  const mc=FIN_UI.mc; if(S.flx.mc.on && mc.res && mc.sig===finMCSig()){ const r=mc.res; h2(`Monte Carlo (${r.n} rodadas)`);
    rows([["TIR P10 / P50 / P90", r.tir.map(finTir).join(" / ")], ["Lucro P10 / P50 / P90", r.lucro.map(v=>mi(v)).join(" / ")], ["Probabilidade de prejuízo", pct(r.pPrej,1)]]) }
  if(S.terAlt.on){ const r=terAltCalc(S,m), A=r.alts, I=r.ind, ip=v=>v==null?"> 90%":pct(v,1);
    if(ctx.y()>200) ctx.newPage(); h2("Terreno: compra x permuta x SPE");
    rows([["Alternativa", "Incorporador: lucro | TIR | VPL   ·   Terreneiro: recebe | VPL"], ...Object.keys(A).map(k=>[A[k].nome, `${mi(A[k].lucro)} | ${finTir(A[k].tirA)} | ${mi(A[k].vpl)}   ·   ${mi(A[k].terrTot)} | ${mi(A[k].terrVPL)}`])]);
    rows([["Indiferença para você (preço "+mi(r.P)+")", `permuta física ${ip(I.fis.inc)} · financeira ${ip(I.fin.inc)}`], ["Indiferença para o terreneiro", `permuta física ${ip(I.fis.terr)} · financeira ${ip(I.fin.terr)}`]]) }
});
