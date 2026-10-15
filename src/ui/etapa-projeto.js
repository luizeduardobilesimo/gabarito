/* ================= etapa Projeto (Garagem · Pavimento tipo · Andares) =================
   Separado de src/steps.js (UX v3, P0), sem mudar comportamento. Aqui: STEP_R/STEP_LIVE.projeto, garSum, tipoSum,
   GAR_RAMPA_INFO, garLegExtra (legenda da garagem, usada por views.js), RS/rsHTML (estudo do melhor acesso) e as ações.
   ACT.acessoStudy é envolvido pelo Worker em calcInstalar() (src/ui/calcworker.js), chamado por main.js depois de tudo carregar. */
/* ---------------- 5. Projeto ---------------- */
STEP_R.projeto = ()=>{
  const E=S.estudo, X=S.garagem||DEF.garagem;
  const sub=`<div class="seg full subtabs" role="tablist" aria-label="Partes do projeto">${ETAPA_SUBS.projeto.map(([k,l])=>`<button type="button" role="tab" data-act="psub" data-v="${k}" aria-pressed="${PSUB===k}" aria-selected="${PSUB===k}">${l}</button>`).join("")}</div>`;
  let body="";
  if(PSUB==="gar"){
    const rampAdv = E.rampaTipo==="elevador"? KV(NUM("garagem.ecN","Elevadores","un",{int:true,step:1,min:1,max:3})+NUM("garagem.ecEspera","Vagas de espera","vg",{int:true,step:1,min:0,zero:true,ph:"auto"})+NUM("garagem.ecVel","Velocidade","m/s",{step:0.05,min:0.1})+NUM("garagem.ecManobra","Manobra e portas","s",{step:5,min:5,help:"Tempo de manobra e de abrir e fechar as portas em cada ponta da viagem."})+NUM("garagem.ecPico","Movimento no pico","%",{pct:true,step:1,help:"Parte das vagas que entra ou sai na hora de pico."})+NUM("garagem.ecCusto","Custo por elevador","R$",{step:10000}))
      : E.rampaTipo==="helicoidal"? KV(NUM("garagem.heliRi","Raio interno","m",{step:0.1,min:3,help:"Mínimo de 3 m."})+NUM("garagem.heliRe","Raio externo","m",{step:0.1,min:7.5,help:"Mínimo de 7,5 m."})+NUM("estudo.rampaL","Faixa de entrada","m",{step:0.05})+NUM("estudo.rampaInc","Inclinação máx.","%",{pct:true,step:1,help:"Medida no eixo da faixa."}))
      : KV(NUM("estudo.rampaL","Largura","m",{step:0.05,help:"Mínimo de 2,75 m em mão única e 5 m em mão dupla."})+NUM("estudo.rampaInc","Inclinação","%",{pct:true,step:1,help:"Em garagens residenciais, até 20%."}));
    body =
    RES("Vagas", `<div id="garRes"></div>`, {aside:"", asideId:"garStat"}) +
    SEC("Acesso e rampas",
      `<div class="fld wide"><label class="fl" for="rampSel">Circulação vertical${INFO(GAR_RAMPA_INFO[E.rampaTipo]||GAR_RAMPA_INFO.reta,"a circulação vertical")}</label><select class="sel" id="rampSel" data-p="estudo.rampaTipo" data-t="s" data-rr="1">${Object.entries(RAMPA_TIPOS).map(([k,l])=>`<option value="${k}" ${E.rampaTipo===k?"selected":""}>${l}</option>`).join("")}</select><div class="fsub" id="rampInfo"></div>${E.rampaTipo==="elevador"?`<div class="fsub" id="ecInfo"></div>`:""}</div>
      <div class="row sb"><span class="pill">${E.rampa?"posição desenhada":"no acesso de veículos"}</span><span class="row" style="gap:4px">${E.rampa?`<button class="btn sm ghost" data-act="rampAuto">Automática</button>`:""}<button class="btn sm" data-act="rampMover">Mover na planta</button></span></div>
      <button class="btn pri full" data-act="acessoStudy">Encontrar o melhor acesso</button><span class="note" id="rsStat"></span><div class="list" id="rsList">${RS?rsHTML():""}</div>`+
      ADV(rampAdv, {key:"gRampa"}),
      {open:true, key:"gRampa", sum:garSum("rampa"), info:"O carro entra pela rua no acesso de veículos (etapa Terreno), anda no plano pelo menos 5 m e só então começa a rampa. A rampa que desce e a que sobe ficam em faixas separadas. “Encontrar o melhor acesso” testa posições do acesso e tipos de rampa e mostra as que dão mais vagas."}) +
    SEC("Layout das vagas",
      ROW(`Ângulo${INFO("90°: corredor de mão dupla. 60° e 45°: mão única, corredores mais estreitos ligados em circuito. “Melhor” testa os três e fica com o que dá mais vagas.","o ângulo das vagas")}`, SEG("estudo.angulo",[["90","90°"],["60","60°"],["45","45°"],["melhor","melhor"]],{rr:false}))+
      ROW("Fileiras",SEG("estudo.garDir",[["auto","automáticas"],["man","manual"]]))+(E.garDir==="auto"?"":SLD("estudo.garDirGraus","Rotação das fileiras",0,179,1,"°"))+
      SW("estudo.usarLayout","Usar as vagas do layout nas contas"),
      {open:true, key:"gLay", sum:garSum("lay")}) +
    SEC("Vagas PCD e idoso", KV(NUM("estudo.pcd","PCD","%",{pct:true,step:1,help:"Vaga PCD"})+NUM("estudo.idoso","Idosos","%",{pct:true,step:1,help:"Vaga idoso"})),
      {key:"gPcd", sum:garSum("pcd"), info:"Percentuais das vagas reservadas. Ficam nas vagas mais perto dos núcleos. Para não ter vagas automáticas, zere os percentuais."}) +
    SEC("Dimensões da vaga", KV(NUM("estudo.vagaL","Largura","m",{step:0.05})+NUM("estudo.vagaC","Comprimento","m",{step:0.05})+NUM("estudo.corredor","Corredor 90°","m",{step:0.1})+NUM("estudo.porModulo","Entre pilares","vg",{int:true,step:1,help:"Quantas vagas cabem entre dois pilares."})+NUM("estudo.pilar","Pilar","m",{step:0.05})),
      {key:"gDim", sum:garSum("dim")}) +
    SEC("Vagas extras",
      SW("garagem.presas","Vagas presas (tandem)",{rr:true})+
      (X.presas? SLD("garagem.presasMax","Unidades que aceitam vaga presa",0,1,0.05,"%",{pct:true})+ROW("Vínculo",SEG("garagem.presasVinc",[["unidade","mesma unidade"],["manobrista","manobrista"]],{rr:false})) : "")+
      SW("garagem.motos","Motos nas sobras",{rr:true})+(X.motos? SLD("garagem.motosMax","Máximo de motos",0,0.5,0.01,"% das un.",{pct:true}) : "")+
      ROW("Bicicletário",SEG("garagem.bici",[["off","não"],["un","por unidade"],["area","por área"]]))+
      (X.bici==="un"? NUM("garagem.biciPorUn","Bicicletas por unidade","bic.",{step:0.1,min:0,wide:true}) : X.bici==="area"? NUM("garagem.biciM2","Uma bicicleta a cada","m² constr.",{step:5,min:1,wide:true}) : "")+
      SLD("garagem.ev","Vagas com recarga (EV)",0,1,0.05,"%",{pct:true,sub:"",help:"EV"})+`<div id="evCustoW" ${X.ev>0?"":"hidden"}>${NUM("garagem.evCusto","Custo por ponto de recarga","R$",{step:500,min:0,wide:true})}</div>`,
      {key:"gExt", sum:garSum("ext"), info:"Presas, motos (1,0 × 2,2 m) e bicicletas entram nas sobras, de frente para a circulação, sem tirar o acesso de nenhuma vaga. A recarga fica nas vagas comuns mais perto do quadro elétrico (QE), junto ao núcleo."}) +
    SEC("Ajuste manual",
      ROW("Toque na vaga",`<div class="seg" role="group" aria-label="O que o toque na vaga faz">${[["off","tirar"],["n","comum"],["pcd","PCD"],["idoso","idoso"]].map(([v,l])=>`<button type="button" data-act="tapm" data-v="${v}" aria-pressed="${TAPMODE===v}">${l}</button>`).join("")}</div>`)+
      `<div class="row sb"><span class="note" id="garManN"></span><button class="btn sm ghost" data-act="resetOff">Desfazer marcações</button></div>`,
      {key:"gMan", sum:garSum("man"), info:"Na planta da garagem, toque numa vaga para tirá-la ou devolvê-la, ou para marcá-la como comum, PCD ou idoso. O mesmo seletor fica na barra da planta."});
  }
  else if(PSUB==="tipo"){
    const bal=E.escTipo==="pf_balcao";
    const desc={ep:"Escada enclausurada com portas corta-fogo e hall de acesso. Edifícios baixos e médios.",pf_duto:"Antecâmara ventilada por dutos de entrada e saída de ar. A mais comum em residenciais altos.",pf_balcao:"Acesso pela fachada por um balcão aberto — exige núcleo encostado na fachada.",pf_press:"Escada pressurizada por ventilador; dispensa dutos na antecâmara, pede casa de máquinas."}[E.escTipo];
    body =
    RES("Andar tipo", `<div id="tipoRes"></div>`, {aside:"", asideId:"tipoStat"}) +
    SEC("Núcleo de circulação", `<div class="fld wide"><label class="fl" for="escSel">Escada${INFO(desc||"Tipo de escada de emergência.","o tipo de escada")}</label><select class="sel" id="escSel" data-p="estudo.escTipo" data-t="s" data-rr="1">${Object.entries(ESC_TIPOS).map(([k,l])=>`<option value="${k}" ${E.escTipo===k?"selected":""}>${l}</option>`).join("")}</select></div>
      ${ROW("Escadas",SEG("estudo.nEsc",[[1,"1"],[2,"2"]],{rr:false}))}${ROW("Elevadores",SEG("estudo.elevadores",[[0,"auto"],[1,"1"],[2,"2"],[3,"3"],[4,"4"]],{rr:false}))}
      ${SW("estudo.emerg","Elevador de emergência")}${SW("estudo.fachada",bal?"Núcleo na fachada (obrigatório com balcão)":"Núcleo encostado na fachada",{dis:bal})}`,
      {open:true, key:"tNuc", sum:tipoSum("nuc"), info:"Núcleo"}) +
    SEC("Posição no andar", ROW("Planta",SEG("estudo.tipoPlanta",[["auto","auto"],["central","corredor central"],["lateral","lateral"]],{rr:false}))+ROW("Lado",SEG("estudo.nucleoLado",[["B","lado 1"],["A","lado 2"]],{rr:false}))+ROW("Ordem",SEG("estudo.escadaLado",[["E","escada · elev."],["D","elev. · escada"]],{rr:false}))+SLD("estudo.nucleoPos","Posição ao longo do andar",0,1,0.01,"%",{pct:true}),
      {open:true, key:"tPos", sum:tipoSum("pos")}) +
    SEC("Dimensões", KV(NUM("estudo.corrTipo","Corredor / hall","m",{step:0.05})+NUM("estudo.profMin","Prof. mín. unidade","m",{step:0.25})+NUM("produto.sacProf","Prof. sacada","m",{step:0.1})),
      {key:"tDim", sum:tipoSum("dim"), info:"Dimensões de estudo. Confirme saídas, tipo de escada e elevador de emergência com a NBR 9077 e a IN do Corpo de Bombeiros."}) +
    SEC("Núcleo e unidades por torre", `<div id="tipoDet"></div>`, {key:"tDet", sum:"áreas do núcleo e das unidades"});
  }
  else body = RES("Andares do edifício", `<div class="list" id="andList"></div><p class="note">Toque num andar para ver a planta. Nas garagens, toque nas vagas para editar.</p>`, {aside:"", asideId:"andStat"}) + `<button class="btn full" data-act="corte3d">Ver o andar selecionado cortado no 3D</button>`;
  return { sub, subKey:PSUB, body };
};
/* textos de ajuda e resumos das seções do Projeto */
const GAR_RAMPA_INFO = { reta:"Todas na mesma projeção: em cada pavimento o carro chega pela ponta de dentro e volta até a frente para descer de novo.",
  alternada:"Duas faixas lado a lado com sentidos opostos: o carro chega e já faz o retorno para a próxima rampa na mesma ponta.",
  helicoidal:"Uma volta por pavimento, no mesmo lugar em todos os andares. O carro entra e sai pela tangente, num patamar ao lado da helicoidal.",
  L:"Primeiro lance ao longo da entrada, patamar plano no canto e segundo lance para o lado. Encurta a profundidade ocupada pela rampa.",
  elevador:"Para lotes estreitos: vagas de espera na entrada, poço com cabine de 2,7 × 5,8 m e área de acomodação em cada pavimento." };
function garSum(k, m){
  const E=S.estudo, X=S.garagem||DEF.garagem;
  if(k==="rampa") return `${esc(RAMPA_TIPOS[E.rampaTipo]||"")} · ${E.rampa?"desenhada":"no acesso"}`;
  if(k==="lay") return `${E.angulo==="melhor"?"melhor ângulo":E.angulo+"°"} · fileiras ${E.garDir==="auto"?"automáticas":"manuais"}`;
  if(k==="pcd"){ if(m && m.gar){ let p=0,i=0; Object.values(m.gar).forEach(l=>{ if(l&&l.vagas) l.vagas.forEach(v=>{ if(v.tipo==="pcd") p++; else if(v.tipo==="idoso") i++ }) }); return `<b>${p}</b> PCD · <b>${i}</b> idoso` } return `PCD ${pct(E.pcd,0)} · idoso ${pct(E.idoso,0)}` }
  if(k==="dim") return `${nf(E.vagaL,2)} × ${nf(E.vagaC,2)} m · corredor ${nf(E.corredor,1)} m`;
  if(k==="ext"){ const q=m&&m.quadroVagas, l=[]; if(X.presas) l.push(q&&q.presa!=null? `${q.presa} presas` : "presas"); if(X.motos) l.push(q&&q.moto!=null? `${q.moto} motos` : "motos"); if(X.bici!=="off") l.push(q&&q.bici? `${q.bici} bicicletas` : "bicicletário"); if(X.ev>0) l.push(m&&m.evN!=null? `${m.evN} EV` : `EV ${pct(X.ev,0)}`); return l.length? l.join(" · ") : "nenhuma" }
  if(k==="man"){ const n=Object.keys(E.off||{}).length+Object.keys(E.vtipo||{}).length; return n? `<b>${n}</b> marcaç${n>1?"ões":"ão"}` : "nenhuma" }
  return "";
}
function tipoSum(k){
  const E=S.estudo;
  if(k==="nuc") return `${E.nEsc} escada${E.nEsc>1?"s":""} · ${+E.elevadores? E.elevadores+" elev." : "elev. auto"}${E.emerg?" · emergência":""}`;
  if(k==="pos") return `${({auto:"planta auto",central:"corredor central",lateral:"lateral"})[E.tipoPlanta]||""} · ${pct(E.nucleoPos,0)}`;
  if(k==="dim") return `corredor ${nf(E.corrTipo,2)} m · prof. ${nf(E.profMin,2)} m`;
  return "";
}
STEP_LIVE.projeto = (m)=>{
  if(PSUB==="gar" && m.gar){
    const flo=Object.keys(m.gar).sort((a,b)=>{ const o=k=>k==="ter"?0:k[0]==="s"? -(+k.slice(1)) : +k.slice(1); return o(a)-o(b) });
    const ok=m.vagas>=m.vagasReq, gs=document.getElementById("garStat"); if(gs) gs.innerHTML = `<span class="pill ${ok?"ok":"bad"}">${ok?"atende":"faltam "+(m.vagasReq-m.vagas)}</span>`;
    const q=m.quadroVagas, quadro = q? garQuadroRows(m).filter(([l])=>!/^Total/.test(l)) : [], simples=quadro.every(([l])=>/^(Comuns|PCD|Idosos)$/.test(l));
    const tipos = q? [q.comum!=null?`${q.comum} comuns`:"", q.pcd?`${q.pcd} PCD`:"", q.idoso?`${q.idoso} idosos`:""].filter(Boolean).join(" · ") : "";
    setHTML("garRes", `<div class="mets"><div class="met big"><div class="l">No layout / exigidas</div><div class="v">${m.vagasLay??"—"}<span style="color:var(--muted);font-weight:400"> / ${m.vagasReq}</span></div><div class="s">${tipos? tipos+" · " : ""}${nf(m.vagas/Math.max(1,m.units),2)} por unidade · estimativa ${m.vagasEst}</div></div></div>
      ${quadro.length>1 && !simples? `<table class="tbl">${quadro.map(([l,v])=>`<tr><td>${esc(l)}</td><td>${esc(v)}</td></tr>`).join("")}</table>` : ""}
      <table class="tbl">${flo.map(k=>{ const l=m.gar[k]; if(!l) return ""; const np=l.vagas.filter(v=>v.tipo==="pcd").length, ni=l.vagas.filter(v=>v.tipo==="idoso").length; const st=l.ok===false? `<span style="color:var(--bad)">sem rota</span>` : `${l.count} vg${np?` · ${np} PCD`:""}${ni?` · ${ni} id.`:""}`; return `<tr class="${k===FLOOR&&VIEW==="gar"?"pos":""}" data-act="garFl" data-k="${k}" style="cursor:pointer" title="Ver este pavimento"><td>${nomePav(k).replace(/^./,c=>c.toUpperCase())}</td><td>${st}</td></tr>` }).join("")}${m.vf&&m.vf.count?`<tr><td>Frente (lojas)</td><td>${m.vf.count} vg</td></tr>`:""}</table>${(m.avisos||[]).map(a=>`<p class="note" style="color:var(--warn)">${esc(a)}</p>`).join("")}`);
    const ri=document.getElementById("rampInfo"); if(ri && m.vert){ const V_=m.vert, s0=V_.strips[0], pend=V_.ok?"":" · verifique os avisos";
      ri.textContent = !s0? "" : V_.helix? `helicoidal Ø ${nf(2*V_.helix.Re,1)} m · faixa ${nf(V_.helix.faixa,2)} m · ${nf(V_.helix.incl*100,1)}% no eixo${pend}`
        : V_.elev? `${V_.elev.n} poço${V_.elev.n>1?"s":""} de ${nf(EC_CAB[0]+2*EC_PAREDE,1)} × ${nf(EC_CAB[1]+2*EC_PAREDE,1)} m · ${V_.elev.espera.length} vaga${V_.elev.espera.length>1?"s":""} de espera · saída ${V_.elev.porta==="frente"?"pela frente (de ré)":"pelo fundo"}${pend}`
        : s0.Lshape? `rampa em L: lance 1 com ${nf(rampExt(S,m,V_.fd).L1,1)} m, patamar no canto e lance 2 com ${nf(rampExt(S,m,V_.fd).L2,1)} m${pend}`
        : `faixa de rampa: ${nf(s0.L,1)} m de comprimento · ${V_.strips.length} faixa${V_.strips.length>1?"s":""}${pend}` }
    const ec=m.elevCarros, ei=document.getElementById("ecInfo");
    if(ei) ei.innerHTML = ec? `ciclo ${nf(ec.ciclo,0)} s · ${nf(ec.cap,0)} carros/h · pico ${nf(ec.dem,0)}/h · fila prevista ${isFinite(ec.fila95)? ec.fila95 : "sem limite"} <span style="color:${ec.ok?"var(--ok)":"var(--bad)"}">(${ec.espera} de espera)</span>` : "";
    const X=S.garagem||{}, ew=document.getElementById("evCustoW"); if(ew) ew.hidden=!(X.ev>0);
    setSub("garagem.ev", X.ev>0? `${m.evN||0} pontos · ${mi((m.evN||0)*(+X.evCusto||0))} na obra` : "desligado");
    ["rampa","lay","pcd","dim","ext","man"].forEach(k=>setSum({rampa:"gRampa",lay:"gLay",pcd:"gPcd",dim:"gDim",ext:"gExt",man:"gMan"}[k], garSum(k,m)));
    const mn=document.getElementById("garManN"); if(mn){ const n=Object.keys(S.estudo.off||{}).length+Object.keys(S.estudo.vtipo||{}).length; mn.textContent = n? `${n} marcaç${n>1?"ões":"ão"} manua${n>1?"is":"l"}` : "Sem marcações manuais" }
  }
  if(PSUB==="tipo"){
    const nomes={esc:"Escada",ant:"Antecâmara / hall",duto:"Dutos",balc:"Balcão",elev:"Elevadores",emerg:"Elev. emergência",shaft:"Shafts",pass:"Acessos",hall:"Hall",tec:"Técnico",lixo:"Lixo / DML",hserv:"Hall de serviço"};
    const R=m.T.map((t,i)=>{ const l=m.tipo&&m.tipo[i]; if(!l) return null; const us=l.units.filter(u=>!u.livre); return {i, t, l, us, ef:us.reduce((s,u)=>s+u.area,0)/Math.max(1,t.A), baixo:us.filter(u=>u.area<u.alvo).length} });
    const ok=R.filter(Boolean), baixo=ok.reduce((s,r)=>s+r.baixo,0), ts=document.getElementById("tipoStat");
    if(ts) ts.innerHTML = !ok.length? "" : `<span class="pill ${baixo?"warn":"ok"}">${baixo? baixo+" abaixo do alvo" : "áreas no alvo"}</span>`;
    const met=(l,v,s)=>`<div class="met"><div class="l">${l}</div><div class="v">${v}</div>${s?`<div class="s">${s}</div>`:""}</div>`;
    setHTML("tipoRes", !ok.length? `<p class="note">Sem andar tipo no produto atual.</p>`
      : ok.length===1? `<div class="mets">${met("Unidades por andar", ok[0].us.length, ok[0].l.dbl?"corredor central":"corredor lateral")+met(`Eficiência do andar${INFO("Eficiência")}`, pct(ok[0].ef,0), "unidades ÷ andar")+met("Núcleo", m2(ok[0].l.coreA))}</div>`
      : `<table class="tbl"><tr><th>Torre</th><th>Un./andar</th><th>Efic. do andar${INFO("Eficiência")}</th><th>Núcleo</th></tr>${R.map((r,i)=>r? `<tr><td>Torre ${i+1}</td><td>${r.us.length}</td><td>${pct(r.ef,0)}</td><td>${m2(r.l.coreA)}</td></tr>` : `<tr><td>Torre ${i+1}</td><td colspan="3">sem andar tipo</td></tr>`).join("")}</table>`);
    setHTML("tipoDet", ok.map(({i,t,l,us})=>{ const K=l.coreKinds||{};
      return `${ok.length>1?`<p class="fl" style="margin:4px 0"><b>Torre ${i+1}</b></p>`:""}
        <div class="stack">${Object.entries(K).filter(([k,a])=>a>0.3).map(([k,a])=>`<span title="${nomes[k]||k}" style="width:${a/l.coreA*100}%;background:var(--c-${k})"></span>`).join("")}</div>
        <div class="stackleg">${Object.entries(K).filter(([k,a])=>a>0.3).map(([k,a])=>`<span><i style="background:var(--c-${k})"></i>${nomes[k]||k} ${nf(a,1)} m²</span>`).join("")}</div>
        <table class="tbl">${us.map(u=>`<tr><td>${esc(u.nome)} · alvo ${nf(u.alvo,0)} m²</td><td style="${u.area<u.alvo?"color:var(--bad)":""}">${nf(u.area,1)} m²</td></tr>`).join("")}</table>` }).join(""));
    setSum("tNuc", tipoSum("nuc")); setSum("tPos", tipoSum("pos")); setSum("tDim", tipoSum("dim"));
    if(ok.length) setSum("tDet", ok.map(r=>`núcleo ${m2(r.l.coreA)}`).join(" · "));
  }
  if(PSUB==="andar"){
    const fl=floorsList(m).slice().reverse(), as=document.getElementById("andStat"); if(as) as.textContent=`${fl.length} pavimentos · ${nf(m.H,1)} m`;
    setHTML("andList", fl.map(a=>{ const lay = a.tipo==="ter"? m.gar&&m.gar.ter : a.lay? m.gar&&m.gar[a.lay] : null;
      const info = a.tipo==="tipo"? `${m.T.filter(t=>t.pav>a.j).reduce((s,t)=>s+t.units/Math.max(1,t.pav),0).toFixed(0)} un · +${nf(a.z0,1)} m` : lay? `${lay.count} vagas · ${nf(a.z0,1)} m` : `${nf(a.z0,1)} m`;
      return `<div class="li clk ${ANDAR===a.key&&VIEW==="andar"?"on":""}" data-act="andar" data-k="${a.key}" role="button" tabindex="0"><span class="dot ${a.tipo==="tipo"?"ok":a.tipo==="ter"?"warn":""}"></span><span class="tt">${a.nome}</span><span class="ss">${info}</span></div>` }).join(""));
  }
};
/* itens da legenda da garagem que só aparecem quando o recurso está em uso */
function garLegExtra(sw){ const m=window._last&&window._last.m, q=m&&m.quadroVagas, V=m&&m.vert; let h="";
  if(q&&q.presa) h+=sw("var(--warn)","vaga presa (tandem)","border:1px dashed var(--ink)");
  if(q&&q.moto) h+=sw("var(--u3)","moto");
  if(q&&q.bici) h+=sw("var(--lz-deck)","bicicletário");
  if(q&&q.ev) h+=sw("transparent","vaga com recarga (EV)","border:2px solid var(--d-acc)")+sw("var(--c-tec)","quadro elétrico (QE)","border:1px solid var(--ink)");
  if(V&&V.elev) h+=sw("var(--c-elev)","elevador de carros")+sw("var(--c-drive)","acomodação e espera");
  if(V&&V.helix) h+=sw("var(--surface)","miolo da helicoidal","border:1px solid var(--mark)");
  return h }
let RS=null;
function rsHTML(){ const base=RS.cur? RS.cur.vagas : 0;
  return RS.list.slice(0,4).map((c,k)=>`<div class="res ${k===0?"top1":""}"><div class="rh"><b>${c.atual?"Atual":k===0?"Melhor acesso":"Opção "+(k+1)} · ${c.lado!=null && S.lote.front.length>1? `L${c.lado+1}${c.lado===acPrincipal(S)?" (principal)":""} · ${pct(c.acessoVei,0)} do lado` : `${pct(c.acessoVei,0)} da frente`}</b><span class="pill ${c.vagas>base?"ok":""}">${c.vagas} vg (${c.vagas-base>=0?"+":""}${c.vagas-base})</span></div><div class="note">${c.rampaTipo==="elevador"? `Elevador de carros${c.cap?` · ${c.cap} carros/h`:""}${c.fila!=null&&isFinite(c.fila)?` · fila ${c.fila}`:""}` : c.rampaTipo==="alternada"? "Rampas alternadas" : c.rampaTipo==="reta"? "Rampas retas empilhadas" : (RAMPA_TIPOS[c.rampaTipo]||"")}${c.ok?"":" · com pendências"}</div>${c.atual?"":`<button class="btn sm ${k===0?"pri":""}" data-act="rsApply" data-i="${k}">Aplicar</button>`}</div>`).join("")
    + `<div class="row sb"><span class="note">Atual: ${base} vagas ${INFO("Cada opção refaz todos os pavimentos com rotas verificadas (análise rápida); as quatro melhores são confirmadas com o cálculo completo.","o estudo de acesso")}</span><button class="btn sm ghost" data-act="rsClose">Fechar</button></div>` }
Object.assign(ACT,{
  garFl: b=>{ FLOOR=b.dataset.k; if(VIEW!=="gar") setView("gar"); else { viewbarSegs(window._last.m); fit2d() } STEP_LIVE.projeto(window._last.m) },
  rampAuto: ()=>{ S.estudo.rampa=null; RAMPMOVE=false; renderTab(); toast("Rampa no automático (junto ao acesso de veículos)") },
  rampMover: ()=>{ RAMPMOVE=true; HINTSEEN["gar"+TOOL]=0; if(VIEW!=="gar") setView("gar"); else { viewbarSegs(window._last.m); hintFor() } toast("Arraste a rampa na planta") },
  tapm: b=>{ TAPMODE=b.dataset.v; RAMPMOVE=false; if(VIEW!=="gar"&&VIEW!=="andar") setView("gar"); viewbarSegs(window._last.m); document.querySelectorAll("#tabbody [data-act=tapm]").forEach(x=>x.setAttribute("aria-pressed", x.dataset.v===TAPMODE)); toast({off:"Toque numa vaga para tirar ou devolver",n:"Toque para tornar a vaga comum",pcd:"Toque para marcar PCD",idoso:"Toque para marcar idoso"}[TAPMODE]) },
  rsClose: ()=>{ RS=null; setHTML("rsList",""); const st=document.getElementById("rsStat"); if(st) st.textContent="" },
  resetOff: b=>{ if(b && !b.dataset.arm){ b.dataset.arm=1; b.textContent="Confirmar"; b.classList.add("on"); setTimeout(()=>{ if(b.isConnected){ delete b.dataset.arm; b.textContent="Desfazer marcações"; b.classList.remove("on") } },4000); return }
    S.estudo.off={}; S.estudo.vtipo={}; update(); toast("Marcações manuais desfeitas") },
  acessoStudy: ()=>{ const list=acessoCandidatos(S), st=document.getElementById("rsStat"); RS={list:[], cur:{vagas:window._last.m.vagasLay||0}}; let i=0;
    const step=()=>{ const t0=performance.now(); while(i<list.length && performance.now()-t0<120){ const c=list[i++]; RS.list.push({...c, ...acessoAvalia(S,c)}) }
      const s_=document.getElementById("rsStat"); if(s_) s_.textContent=`analisando ${i}/${list.length}…`;
      if(i<list.length) setTimeout(step,0); else { RS.list.sort((a,b)=>(b.ok-a.ok)||(b.vagas-a.vagas)); fino(0) } };
    // as melhores são refeitas com o cálculo completo (o mesmo do projeto)
    const fino=k=>{ const s_=document.getElementById("rsStat"); if(k<Math.min(4,RS.list.length)){ if(s_) s_.textContent=`confirmando a opção ${k+1} com o cálculo completo…`; setTimeout(()=>{ const c=RS.list[k]; Object.assign(c, acessoAvalia(S,c,true), {fino:true}); fino(k+1) },0); return }
      RS.list.sort((a,b)=>(b.fino?1:0)-(a.fino?1:0) || (b.ok-a.ok) || (b.vagas-a.vagas)); if(s_) s_.textContent=`${list.length} combinações analisadas`; const el=document.getElementById("rsList"); if(el) el.innerHTML=rsHTML() };
    step() },
  rsApply: b=>{ const c=RS.list[+b.dataset.i]; S.lote.acessoVei=c.acessoVei; S.estudo.rampaTipo=c.rampaTipo; S.estudo.rampa=null; if(c.ladoVei!==undefined) S.lote.ladoVei=c.ladoVei; RS=null; renderTab(); setView("gar"); toast(c.lado!=null && S.lote.front.length>1? `Acesso pela L${c.lado+1} e rampas aplicados` : "Acesso e rampas aplicados") },
  andar: b=>{ ANDAR=b.dataset.k; if(VIEW!=="andar") setView("andar"); else { viewbarSegs(window._last.m); redraw2d(); planLegend() } STEP_LIVE.projeto(window._last.m) },
  corte3d: ()=>{ S.corte=ANDAR; save(); setView("3d") },
});
