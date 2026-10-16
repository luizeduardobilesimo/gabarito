/* ================= etapa Projeto: "Funciona no desenho?" (UX v3 §4.4) =================
   Sub-abas gar | tipo | sol | vento (rótulos Garagem · Andares · Sol · Vento; data-act="psub", lógica em ui.js).
   - Garagem: RES Vagas · Acesso e rampas (Entradas = acessosSecHTML() do Terreno/P2, com reserva aqui; circulação vertical,
     Mover na planta, Encontrar o melhor acesso) · Vagas · PCD e idoso · Medidas da vaga (casa única de vaga, corredor,
     pilar e, nas rampas reta/alternada/L, largura e inclinação) · Vagas extras · Editar vagas à mão · Pilares (estrutura.js).
   - Andares: RES Andar tipo · Escadas e elevadores ([+] posição do núcleo) · Medidas do andar (casa única de corrTipo,
     profMin, sacProf) · Núcleo e unidades por torre · Alas · Cômodos · Todos os andares (antiga sub-aba) · Saídas e
     acessibilidade (normasSecHTML() de src/ui/normas.js, com reserva aqui).
   - Sol e Vento: conteúdo de src/ui/etapa-clima.js (climaCorpo). Enquanto a etapa Clima existir no trilho (antes do P1),
     Projeto mostra só Garagem · Andares e o Sol/Vento ficam na etapa Clima.
   Também aqui: garSum, tipoSum, GAR_RAMPA_INFO, garLegExtra (legenda da garagem, usada por views.js), RS/rsHTML (estudo do
   melhor acesso) e as ações. ACT.acessoStudy é envolvido pelo Worker em calcInstalar() (src/ui/calcworker.js). */
(function projCss(){ const s=document.createElement("style"); s.textContent=`
#andList.andpilha{gap:0;border:1px solid var(--line);border-radius:var(--r);overflow:hidden;background:var(--surface-2)}
#andList.andpilha .li{border:0;border-top:1px solid var(--line);border-radius:0;padding:5px 12px;background:transparent}
#andList.andpilha .li:first-child{border-top:0}
#andList.andpilha .li.clk:hover{background:var(--surface)}
#andList.andpilha .li.on{background:var(--surface);box-shadow:inset 3px 0 0 var(--brand)}
#andList.andpilha .li .tt{font-size:12.5px;font-weight:500}
@media (max-width:900px){ #andList.andpilha .li{padding:10px 12px} }
`; document.head.appendChild(s) })();
const projTemClima = ()=> typeof STEPS!=="undefined" && STEPS.some(s=>s.k==="clima");
const projSubs = ()=> [["gar","Garagem"],["tipo","Andares"]].concat(projTemClima()? [] : [["sol","Sol"],["vento","Vento"]]);
/* subsDe("projeto") / auditoria: a antiga sub-aba "andar" vive dentro de "tipo"; Sol e Vento entram quando a etapa Clima sai */
try{ ETAPA_SUBS.projeto = projSubs(); if(projTemClima()) ETAPA_SUBS.clima = [["sol","Sol"],["vento","Vento"]] }catch(e){}
/* Entradas (sliders de acesso): a versão do Terreno (P2) quando existir; esta é a reserva, com a mesma marcação */
function projAcessosHTML(){
  if(typeof acessosSecHTML==="function") return acessosSecHTML();
  return GRP("Entradas") +
    SLD("lote.acessoPed",`Pedestres · L${acPrincipal(S)+1}`,0.05,0.95,0.01,"%",{pct:true,help:"Posição da entrada de pedestres ao longo da frente principal: 0% é o início do lado e 100% o fim."}) +
    SLD("lote.acessoVei",`Veículos · L${ladoVeiIdx(S)+1}`,0.05,0.95,0.01,"%",{pct:true,sub:"",help:"Posição da entrada de veículos (rampas e faixa da garagem) ao longo do lado marcado com “veículos” em Terreno › Ruas e frentes (padrão: a frente principal). Se cair sobre um núcleo, o hall ou as lojas, o acesso é deslocado."});
}
function projAcessosLive(m){
  if(typeof acessosLive==="function") return acessosLive(m);
  const T=m.ter||{}, ac=m.acesso||{}, lv=ac.edgeV!=null && ac.edgeV!==ac.edge;
  setSub("lote.acessoVei", T.drive0? `${T.drive0.dv? nf(T.drive0.dv[1]-T.drive0.dv[0],1)+" m de largura (rampas"+(T.lanes?" + faixa da garagem":"")+")" : ""}${T.veiShift? " · ajustado "+nf(Math.abs(T.veiShift),1)+(lv? " m para não passar pelo hall nem pelos núcleos" : " m para não passar pelos núcleos"):""}` : "");
}
/* Saídas e acessibilidade: normasSecHTML() (src/ui/normas.js, P2) quando existir; senão monta a seção com as peças de hoje */
const NRM_INFO = "Checklist PRELIMINAR de saídas de emergência (IN 09 do CBMSC, com referência na NBR 9077) e de acessibilidade (NBR 9050, LBI), conferido no núcleo e na garagem desenhados. Toque num item para ver o exigido, o porquê e a fonte. Não substitui o projeto de prevenção e o de acessibilidade.";
function projNormasHTML(){
  if(typeof normasSecHTML==="function"){ const h=normasSecHTML(); return /^\s*<details/.test(h)? h : SEC("Saídas e acessibilidade (preliminar)", h, {key:"nrmList", info:NRM_INFO}) }
  return SEC("Saídas e acessibilidade (preliminar)", `<div class="nrm-res" id="nrmRes"></div><div id="nrmList"><p class="note">Calculando…</p></div>` +
    ADV(`<div data-q="chuveiros sprinklers automáticos">${SW("normas.chuveiros","Edificação com chuveiros automáticos")}</div><div data-q="rota fuga escada pavimento tipo">${SW("normas.rotaFuga","Rota até a escada no pavimento tipo",{fx:"r3n"})}</div>`, {key:"nrmOpc"}),
    {key:"nrmList", sum:"conferindo…", info:NRM_INFO});
}
function projNormasLive(m, fast){
  if(typeof normasLive!=="function" || !document.getElementById("nrmList")) return;
  normasLive(m, fast);
  if(typeof normasSecHTML==="function") return;   // a versão do P2 escreve o próprio resumo
  const n=s=>document.querySelectorAll(`#nrmList .nrm-it .dot.${s}`).length, ok=n("ok"), wa=n("warn"), bd=n("bad");
  if(ok+wa+bd) setSum("nrmList", [ok? `${ok} atende${ok>1?"m":""}` : "", wa? `<span style="color:var(--warn-t)">${wa} atenção</span>` : "", bd? `<span style="color:var(--bad)">${bd} não atende${bd>1?"m":""}</span>` : ""].filter(Boolean).join(" · "));
}
STEP_R.projeto = ()=>{
  const E=S.estudo, X=S.garagem||DEF.garagem, subs=projSubs();
  if(PSUB==="andar") PSUB="tipo";   // a lista de andares agora mora em "Andares" (tipo); a vista "andar" continua valendo
  if(!subs.some(([k])=>k===PSUB)) PSUB=subs[0][0];
  // a seção de normas vem do card "nrmList" daqui (normasSecHTML): desliga já o card reserva de src/ui/normas.js,
  // antes de renderTab filtrar os cards (senão a primeira montagem mostraria os dois)
  if(typeof normasSecHTML==="function") try{ NRM_EXT=true }catch(e){}
  const sub=`<div class="seg full subtabs" role="tablist" aria-label="Partes do projeto">${subs.map(([k,l])=>`<button type="button" role="tab" data-act="psub" data-v="${k}" aria-pressed="${PSUB===k}" aria-selected="${PSUB===k}">${l}</button>`).join("")}</div>`;
  if(PSUB==="sol" || PSUB==="vento"){ const modo=climaModo(), R=climaCorpo(modo); return { sub, subKey:PSUB+(modo==="v3d"?"3d":""), body:R.body, after:R.after, desc:"Funciona no desenho?" } }
  let body="";
  if(PSUB==="gar"){
    const naMedida = ["reta","alternada","L"].includes(E.rampaTipo);
    const rampAdv = E.rampaTipo==="elevador"? KV(NUM("garagem.ecN","Elevadores","un",{int:true,step:1,min:1,max:3})+NUM("garagem.ecEspera","Vagas de espera","vg",{int:true,step:1,min:0,zero:true,ph:"auto"})+NUM("garagem.ecVel","Velocidade","m/s",{step:0.05,min:0.1})+NUM("garagem.ecManobra","Manobra e portas","s",{step:5,min:5,help:"Tempo de manobra e de abrir e fechar as portas em cada ponta da viagem."})+NUM("garagem.ecPico","Movimento no pico","%",{pct:true,step:1,help:"Parte das vagas que entra ou sai na hora de pico."})+NUM("garagem.ecCusto","Custo por elevador","R$",{step:10000}))
      : E.rampaTipo==="helicoidal"? KV(NUM("garagem.heliRi","Raio interno","m",{step:0.1,min:3,help:"Mínimo de 3 m."})+NUM("garagem.heliRe","Raio externo","m",{step:0.1,min:7.5,help:"Mínimo de 7,5 m."})+NUM("estudo.rampaL","Faixa de entrada","m",{step:0.05})+NUM("estudo.rampaInc","Inclinação máx.","%",{pct:true,step:1,help:"Medida no eixo da faixa."}))
      : "";
    body =
    RES("Vagas", `<div id="garRes"></div>`, {aside:"", asideId:"garStat"}) +
    SEC("Acesso e rampas",
      projAcessosHTML() + GRP("Circulação vertical") +
      `<div class="fld wide"><label class="fl" for="rampSel">Tipo${INFO(GAR_RAMPA_INFO[E.rampaTipo]||GAR_RAMPA_INFO.reta,"a circulação vertical")}</label><select class="sel" id="rampSel" data-p="estudo.rampaTipo" data-t="s" data-rr="1">${Object.entries(RAMPA_TIPOS).map(([k,l])=>`<option value="${k}" ${E.rampaTipo===k?"selected":""}>${l}</option>`).join("")}</select><div class="fsub" id="rampInfo"></div>${E.rampaTipo==="elevador"?`<div class="fsub" id="ecInfo"></div>`:""}</div>
      <div class="row sb"><span class="pill">${E.rampa?"posição desenhada":"no acesso de veículos"}</span><span class="row" style="gap:4px">${E.rampa?`<button class="btn sm ghost" data-act="rampAuto">Automática</button>`:""}<button class="btn sm" data-act="rampMover">Mover na planta</button></span></div>
      <button class="btn full" data-act="acessoStudy">Encontrar o melhor acesso</button><span class="note" id="rsStat"></span><div class="list" id="rsList">${RS?rsHTML():""}</div>`+
      (rampAdv? ADV(rampAdv, {key:"gRampa"}) : ""),
      {open:true, key:"gRampa", sum:garSum("rampa"), info:"O carro entra pela rua no acesso de veículos, anda no plano pelo menos 5 m e só então começa a rampa. A rampa que desce e a que sobe ficam em faixas separadas. “Encontrar o melhor acesso” testa posições do acesso e tipos de rampa e mostra as que dão mais vagas."}) +
    SEC("Vagas",
      ROW(`Ângulo${INFO("90°: corredor de mão dupla. 60° e 45°: mão única, corredores mais estreitos ligados em circuito. “Melhor” testa os três e fica com o que dá mais vagas.","o ângulo das vagas")}`, SEG("estudo.angulo",[["90","90°"],["60","60°"],["45","45°"],["melhor","melhor"]],{rr:false}))+
      ROW("Fileiras",SEG("estudo.garDir",[["auto","automáticas"],["man","manual"]]))+(E.garDir==="auto"?"":SLD("estudo.garDirGraus","Rotação das fileiras",0,179,1,"°"))+
      SW("estudo.usarLayout","Usar as vagas do layout nas contas")+
      ADV(`<div class="fld wide"><label class="fl" for="garPartSel">Partido${INFO("Automático: o gerador testa corredores, transversais e orientações e fica com o arranjo de mais vagas e menos becos. Fixar um partido mantém só os arranjos daquela família, quando couberem.","o partido da garagem")}</label><select class="sel" id="garPartSel" data-p="garagem.partido" data-t="s" data-rr="1"><option value="auto" ${X.partido==="auto"||!X.partido?"selected":""}>Automático</option>${Object.entries(typeof GAR_PARTIDOS!=="undefined"? GAR_PARTIDOS : {}).map(([k,o])=>`<option value="${k}" ${X.partido===k?"selected":""}>${esc(o.nome)}</option>`).join("")}</select></div>`, {key:"gPart"}),
      {open:true, key:"gLay", sum:garSum("lay"), info:"Como um projetista de garagem: módulo de 5,0 + 5,5 + 5,0 m (fileira, corredor de mão dupla, fileira), fileiras encostadas nas paredes, corredores ligados numa rede contínua (anel ou espinha), pilares numa malha única a cada 3 vagas e iguais em todos os subsolos, faixa de pedestres até o hall dos elevadores e PCD com faixa de transferência perto do hall. Referências fixas: raio de giro de 6,0 m por fora e 3,0 m por dentro, corredor sem saída de até 25 m (acima disso, bolsão de retorno) e faixa de pedestres de 1,20 m. A nota cai com vagas sem manobra, becos longos, curvas apertadas e área por vaga acima de 32 m²."}) +
    SEC("PCD e idoso", KV(NUM("estudo.pcd","Vagas PCD","%",{pct:true,step:1,help:"Vaga PCD"})+NUM("estudo.idoso","Vagas idoso","%",{pct:true,step:1,help:"Vaga idoso"}))+
      ROW(`Faixa da PCD${INFO("Faixa de transferência de 1,20 m ao lado da vaga PCD: compartilhada entre duas vagas PCD ou de um lado de cada uma. Automático escolhe a que perde menos vagas.","a faixa da vaga PCD")}`, SEG("garagem.pcdModo",[["auto","auto"],["compartilhada","compartilhada"],["lado","de um lado"]],{rr:false})),
      {key:"gPcd", sum:garSum("pcd"), info:"Percentuais das vagas reservadas. Ficam nas vagas mais perto dos núcleos. Para não ter vagas automáticas, zere os percentuais."}) +
    SEC("Medidas da vaga", KV(NUM("estudo.vagaL","Largura","m",{step:0.05})+NUM("estudo.vagaC","Comprimento","m",{step:0.05})+NUM("estudo.corredor","Corredor 90°","m",{step:0.1})+NUM("estudo.porModulo","Entre pilares","vg",{int:true,step:1,help:"Quantas vagas cabem entre dois pilares."})+NUM("estudo.pilar","Pilar","m",{step:0.05}))+
      (naMedida? GRP("Rampa")+KV(NUM("estudo.rampaL","Largura da rampa","m",{step:0.05,help:"Mínimo de 2,75 m em mão única e 5 m em mão dupla."})+NUM("estudo.rampaInc","Inclinação da rampa","%",{pct:true,step:1,help:"Em garagens residenciais, até 20%."})) : "")+
      ADV(GRP("Largura acrescida")+KV(NUM("garagem.acrParede","Junto à parede","+ m",{step:0.05,min:0,help:"Largura acrescida"})+NUM("garagem.acrPilar","Junto ao pilar","+ m",{step:0.05,min:0,help:"Largura acrescida"})), {key:"gDim"}),
      {key:"gDim", sum:garSum("dim")}) +
    SEC("Vagas extras",
      SW("garagem.presas","Vagas presas (tandem)",{rr:true})+
      (X.presas? SLD("garagem.presasMax","Unidades que aceitam vaga presa",0,1,0.05,"%",{pct:true})+ROW("Vínculo",SEG("garagem.presasVinc",[["unidade","mesma unidade"],["manobrista","manobrista"]],{rr:false})) : "")+
      SW("garagem.motos","Motos nas sobras",{rr:true})+(X.motos? SLD("garagem.motosMax","Máximo de motos",0,0.5,0.01,"% das un.",{pct:true}) : "")+
      ROW("Bicicletário",SEG("garagem.bici",[["off","não"],["un","por unidade"],["area","por área"]]))+
      (X.bici==="un"? NUM("garagem.biciPorUn","Bicicletas por unidade","bic.",{step:0.1,min:0,wide:true}) : X.bici==="area"? NUM("garagem.biciM2","Uma bicicleta a cada","m² constr.",{step:5,min:1,wide:true}) : "")+
      SLD("garagem.ev","Vagas com recarga (EV)",0,1,0.05,"%",{pct:true,sub:"",help:"EV"})+`<div id="evCustoW" ${X.ev>0?"":"hidden"}>${NUM("garagem.evCusto","Custo por ponto de recarga","R$",{step:500,min:0,wide:true})}</div>`,
      {key:"gExt", sum:garSum("ext"), info:"Presas, motos (1,0 × 2,2 m) e bicicletas entram nas sobras, de frente para a circulação, sem tirar o acesso de nenhuma vaga. A recarga fica nas vagas comuns mais perto do quadro elétrico (QE), junto ao núcleo."}) +
    SEC("Editar vagas à mão",
      ROW("Toque na vaga",`<div class="seg" role="group" aria-label="O que o toque na vaga faz">${[["off","tirar"],["n","comum"],["pcd","PCD"],["idoso","idoso"]].map(([v,l])=>`<button type="button" data-act="tapm" data-v="${v}" aria-pressed="${TAPMODE===v}">${l}</button>`).join("")}</div>`)+
      `<div class="row sb"><span class="note" id="garManN"></span><button class="btn sm ghost" data-act="resetOff">Desfazer marcações</button></div>`,
      {key:"gMan", sum:garSum("man"), info:"Na planta da garagem, toque numa vaga para tirá-la ou devolvê-la, ou para marcá-la como comum, PCD ou idoso. O mesmo seletor fica na barra da planta."});
  }
  else {
    const bal=E.escTipo==="pf_balcao";
    const desc={ep:"Escada enclausurada com portas corta-fogo e hall de acesso. Edifícios baixos e médios.",pf_duto:"Antecâmara ventilada por dutos de entrada e saída de ar. A mais comum em residenciais altos.",pf_balcao:"Acesso pela fachada por um balcão aberto — exige núcleo encostado na fachada.",pf_press:"Escada pressurizada por ventilador; dispensa dutos na antecâmara, pede casa de máquinas."}[E.escTipo];
    body =
    RES("Andar tipo", `<div id="tipoRes"></div>`, {aside:"", asideId:"tipoStat"}) +
    SEC("Escadas e elevadores", `<div class="fld wide"><label class="fl" for="escSel">Escada${INFO(desc||"Tipo de escada de emergência.","o tipo de escada")}</label><select class="sel" id="escSel" data-p="estudo.escTipo" data-t="s" data-rr="1">${Object.entries(ESC_TIPOS).map(([k,l])=>`<option value="${k}" ${E.escTipo===k?"selected":""}>${l}</option>`).join("")}</select></div>
      ${ROW("Escadas",SEG("estudo.nEsc",[[1,"1"],[2,"2"]],{rr:false}))}${ROW("Elevadores",SEG("estudo.elevadores",[[0,"auto"],[1,"1"],[2,"2"],[3,"3"],[4,"4"]],{rr:false}))}
      ${SW("estudo.emerg","Elevador de emergência")}${SW("estudo.fachada",bal?"Núcleo na fachada (obrigatório com balcão)":"Núcleo encostado na fachada",{dis:bal})}`+
      ADV(ROW("Planta",SEG("estudo.tipoPlanta",[["auto","auto"],["central","corredor central"],["lateral","lateral"]],{rr:false}))+ROW("Lado",SEG("estudo.nucleoLado",[["B","lado 1"],["A","lado 2"]],{rr:false}))+ROW("Ordem",SEG("estudo.escadaLado",[["auto","auto"],["E","escada · elev."],["D","elev. · escada"]],{rr:false}))+SLD("estudo.nucleoPos","Posição ao longo do andar",0,1,0.01,"%",{pct:true}),
        {key:"tPos", label:"Posição do núcleo", fechar:"Fechar posição do núcleo"}),
      {open:true, key:"tNuc", sum:tipoSum("nuc"), info:"Núcleo"}) +
    SEC("Medidas do andar", KV(NUM("estudo.corrTipo","Corredor / hall","m",{step:0.05})+NUM("estudo.profMin","Prof. mín. da unidade","m",{step:0.25})+NUM("produto.sacProf","Prof. da sacada","m",{step:0.1,help:"Sacada"})),
      {key:"tDim", sum:tipoSum("dim"), info:"Medidas de estudo do pavimento tipo. Confirme saídas, tipo de escada e elevador de emergência com a NBR 9077 e a IN do Corpo de Bombeiros."}) +
    SEC("Núcleo e unidades por torre", `<div id="tipoDet"></div>`, {key:"tDet", sum:"áreas do núcleo e das unidades"});
  }
  return { sub, subKey:PSUB, body, desc:"Funciona no desenho?" };
};
/* Andares: lista de todos os pavimentos (antiga sub-aba) e as saídas/acessibilidade, depois de alas (52) e cômodos (55) */
addCard("projeto", { key:"andares", order:60, sub:"tipo", html:()=>SEC("Todos os andares", `<div class="list andpilha" id="andList"></div><button class="btn full" data-act="corte3d">Ver o andar cortado no 3D</button>`,
  {open:false, key:"andares", sum:"", info:"Toque num andar para ver a planta dele no palco. Nas garagens, toque nas vagas para editar."}) });
addCard("projeto", { key:"nrmList", order:65, sub:"tipo", html:()=>projNormasHTML() });
/* textos de ajuda e resumos das seções do Projeto */
const GAR_RAMPA_INFO = { reta:"Todas na mesma projeção: em cada pavimento o carro chega pela ponta de dentro e volta até a frente para descer de novo.",
  alternada:"Duas faixas lado a lado com sentidos opostos: o carro chega e já faz o retorno para a próxima rampa na mesma ponta.",
  helicoidal:"Uma volta por pavimento, no mesmo lugar em todos os andares. O carro entra e sai pela tangente, num patamar ao lado da helicoidal.",
  L:"Primeiro lance ao longo da entrada, patamar plano no canto e segundo lance para o lado. Encurta a profundidade ocupada pela rampa.",
  elevador:"Para lotes estreitos: vagas de espera na entrada, poço com cabine de 2,7 × 5,8 m e área de acomodação em cada pavimento." };
function garSum(k, m){
  const E=S.estudo, X=S.garagem||DEF.garagem;
  if(k==="rampa") return `veículos ${pct(S.lote.acessoVei,0)} · ${esc(RAMPA_TIPOS[E.rampaTipo]||"")}${E.rampa?" · desenhada":""}`;
  if(k==="lay"){ const ls=m&&m.gar? Object.entries(m.gar).filter(([kk,l])=>l&&l.modelo==="partido"&&kk!=="ter").map(([,l])=>l) : [], ang=E.angulo==="melhor"?"melhor ângulo":E.angulo+"°";
    if(!ls.length) return `${ang} · fileiras ${E.garDir==="auto"?"automáticas":"manuais"}`;
    return `${ang} · ${esc((GAR_PARTIDOS[ls[0].partido]||{}).nome||ls[0].partido||"")} · nota <b>${Math.min(...ls.map(x=>x.nota??100))}</b>` }
  if(k==="pcd"){ if(m && m.gar){ let p=0,i=0; Object.values(m.gar).forEach(l=>{ if(l&&l.vagas) l.vagas.forEach(v=>{ if(v.tipo==="pcd") p++; else if(v.tipo==="idoso") i++ }) }); return `<b>${p}</b> PCD · <b>${i}</b> idoso` } return `PCD ${pct(E.pcd,0)} · idoso ${pct(E.idoso,0)}` }
  if(k==="dim") return `${nf(E.vagaL,2)} × ${nf(E.vagaC,2)} m · corredor ${nf(E.corredor,1)} m`;
  if(k==="ext"){ const q=m&&m.quadroVagas, l=[]; if(X.presas) l.push(q&&q.presa!=null? `${q.presa} presas` : "presas"); if(X.motos) l.push(q&&q.moto!=null? `${q.moto} motos` : "motos"); if(X.bici!=="off") l.push(q&&q.bici? `${q.bici} bicicletas` : "bicicletário"); if(X.ev>0) l.push(m&&m.evN!=null? `${m.evN} EV` : `EV ${pct(X.ev,0)}`); return l.length? l.join(" · ") : "nenhuma" }
  if(k==="man"){ const n=Object.keys(E.off||{}).length+Object.keys(E.vtipo||{}).length; return n? `<b>${n}</b> marcaç${n>1?"ões":"ão"}` : "nenhuma" }
  return "";
}
/* RES da garagem: área bruta por vaga nos subsolos/garagens (meta 25–32 m²) e a nota do partido */
function garResMet(m){
  const ls=Object.entries(m.gar||{}).filter(([k,l])=>l && k!=="ter" && l.met && l.count);
  if(!ls.length) return "";
  const A=ls.reduce((s,[,l])=>s+l.met.area,0), n=ls.reduce((s,[,l])=>s+l.count,0), m2v=A/Math.max(1,n), nota=Math.min(...ls.map(([,l])=>l.nota??100));
  const cls=m2v<=GAR_META[1]+0.5? "ok" : m2v<=GAR_META[1]+8? "warn" : "bad", ncls= nota>=85? "ok" : nota>=65? "warn" : "bad";
  return `<div class="met"><div class="l">Área por vaga${INFO(`Área bruta do pavimento ÷ vagas, nos subsolos e garagens. Referência de mercado: ${GAR_META[0]}–${GAR_META[1]} m² por vaga num subsolo retangular regular. Núcleos, rampas e lotes estreitos pesam.`,"a área por vaga")}</div><div class="v">${nf(m2v,1)} <span style="font-size:.6em;color:var(--muted);font-weight:400">m²</span></div><div class="s"><span class="pill ${cls}">meta ${GAR_META[0]}–${GAR_META[1]}</span></div></div>
    <div class="met"><div class="l">Nota da garagem</div><div class="v">${nota}</div><div class="s"><span class="pill ${ncls}">${nota>=85? "boa" : nota>=65? "atenção" : "ruim"}</span></div></div>`;
}
function tipoSum(k){
  const E=S.estudo;
  if(k==="nuc") return `${E.nEsc} escada${E.nEsc>1?"s":""} · ${+E.elevadores? E.elevadores+" elev." : "elev. auto"}${E.emerg?" · emergência":""}`;
  if(k==="pos") return `${({auto:"planta auto",central:"corredor central",lateral:"lateral"})[E.tipoPlanta]||""} · ${pct(E.nucleoPos,0)}`;
  if(k==="dim") return `corredor ${nf(E.corrTipo,2)} m · prof. ${nf(E.profMin,2)} m`;
  return "";
}
STEP_LIVE.projeto = (m, f, fast)=>{
  if(PSUB==="sol" || PSUB==="vento"){ STEP_LIVE.clima(); return }
  if(PSUB==="gar") projAcessosLive(m);
  if(PSUB==="gar" && m.gar){
    const flo=Object.keys(m.gar).sort((a,b)=>{ const o=k=>k==="ter"?0:k[0]==="s"? -(+k.slice(1)) : +k.slice(1); return o(a)-o(b) });
    const ok=m.vagas>=m.vagasReq, gs=document.getElementById("garStat"); if(gs) gs.innerHTML = `<span class="pill ${ok?"ok":"bad"}">${ok?"atende":"faltam "+(m.vagasReq-m.vagas)}</span>`;
    const q=m.quadroVagas, quadro = q? garQuadroRows(m).filter(([l])=>!/^Total/.test(l)) : [], simples=quadro.every(([l])=>/^(Comuns|PCD|Idosos|Na frente \(lojas\))$/.test(l));
    const tipos = q? [q.comum!=null?`${q.comum} comuns`:"", q.pcd?`${q.pcd} PCD`:"", q.idoso?`${q.idoso} idosos`:"", q.frente?`${q.frente} na frente`:""].filter(Boolean).join(" · ") : "";
    setHTML("garRes", `<div class="mets"><div class="met big"><div class="l">No layout / exigidas</div><div class="v">${m.vagasLay??"—"}<span style="color:var(--muted);font-weight:400"> / ${m.vagasReq}</span></div><div class="s">${tipos? tipos+" · " : ""}${nf(m.vagas/Math.max(1,m.units),2)} por unidade${S.estudo.usarLayout? "" : ` · estimativa ${m.vagasEst}`}</div></div>${garResMet(m)}</div>
      ${quadro.length>1 && !simples? `<table class="tbl">${quadro.map(([l,v])=>`<tr><td>${esc(l)}</td><td>${esc(v)}</td></tr>`).join("")}</table>` : ""}
      <table class="tbl">${flo.map(k=>{ const l=m.gar[k]; if(!l) return ""; const np=l.vagas.filter(v=>v.tipo==="pcd").length, ni=l.vagas.filter(v=>v.tipo==="idoso").length; const st=l.ok===false? `<span style="color:var(--bad)">sem rota</span>` : `${l.count} vg${np?` · ${np} PCD`:""}${ni?` · ${ni} id.`:""}${l.met&&l.count&&k!=="ter"? ` · ${nf(l.met.m2v,1)} m²/vg` : ""}`;
        const pr=(l.problemas||[]).filter(p=>p.nivel!=="info"), inf=(l.problemas||[]).find(p=>p.nivel==="info"), P=l.modelo==="partido"&&typeof GAR_PARTIDOS!=="undefined"? (GAR_PARTIDOS[l.partido]||{}).nome||"" : "";
        return `<tr class="${k===FLOOR&&VIEW==="gar"?"pos":""}" data-act="garFl" data-k="${k}" style="cursor:pointer" title="${esc(inf? inf.msg : "Ver este pavimento")}"><td>${nomePav(k).replace(/^./,c=>c.toUpperCase())}${P&&k===FLOOR? `<div class="fsub">${esc(P)} · nota ${l.nota??"—"}</div>` : ""}${pr.map(p=>`<div class="fsub" style="color:var(--${p.nivel==="bad"?"bad":"warn-t"})">${esc(p.msg)}</div>`).join("")}</td><td>${st}</td></tr>` }).join("")}${m.vf&&m.vf.count?`<tr><td>Frente (lojas)</td><td>${m.vf.count} vg</td></tr>`:""}</table>${(m.avisos||[]).filter(a=>!/^Não couberam/.test(a)).map(a=>`<p class="note" style="color:var(--warn-t)">${esc(a)}</p>`).join("")}`);
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
      : ok.length===1? `<div class="mets">${met("Unidades por andar", ok[0].us.length, ok[0].l.dbl?"corredor central":"corredor lateral")+met(`Aproveitamento${INFO("Aproveitamento do andar")}`, pct(ok[0].ef,0), "privativo ÷ andar")+met("Núcleo", m2(ok[0].l.coreA))}</div>`
      : `<table class="tbl"><tr><th>Torre</th><th>Un./andar</th><th>Aproveit.${INFO("Aproveitamento do andar")}</th><th>Núcleo</th></tr>${R.map((r,i)=>r? `<tr><td>Torre ${i+1}</td><td>${r.us.length}</td><td>${pct(r.ef,0)}</td><td>${m2(r.l.coreA)}</td></tr>` : `<tr><td>Torre ${i+1}</td><td colspan="3">sem andar tipo</td></tr>`).join("")}</table>`);
    setHTML("tipoDet", ok.map(({i,t,l,us})=>{ const K=l.coreKinds||{};
      return `${ok.length>1?`<p class="fl" style="margin:4px 0"><b>Torre ${i+1}</b></p>`:""}
        <div class="stack">${Object.entries(K).filter(([k,a])=>a>0.3).map(([k,a])=>`<span title="${nomes[k]||k}" style="width:${a/l.coreA*100}%;background:var(--c-${k})"></span>`).join("")}</div>
        <div class="stackleg">${Object.entries(K).filter(([k,a])=>a>0.3).map(([k,a])=>`<span><i style="background:var(--c-${k})"></i>${nomes[k]||k} ${nf(a,1)} m²</span>`).join("")}</div>
        <table class="tbl">${us.map(u=>`<tr><td>${esc(u.nome)} · alvo ${nf(u.alvo,0)} m²</td><td style="${u.area<u.alvo?"color:var(--bad)":""}">${nf(u.area,1)} m²</td></tr>`).join("")}</table>` }).join(""));
    setSum("tNuc", tipoSum("nuc")); setSum("tDim", tipoSum("dim"));
    if(ok.length) setSum("tDet", [...new Set(ok.map(r=>`núcleo ${m2(r.l.coreA)}`))].join(" · "));
    projNormasLive(m, fast);
  }
  if(document.getElementById("andList")){
    const fl=floorsList(m).slice().reverse(); setSum("andares", `${fl.length} pavimentos · ${nf(m.H,1)} m`);
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
  return RS.list.slice(0,4).map((c,k)=>`<div class="res ${k===0?"top1":""}"><div class="rh"><b>${c.atual?"Atual":k===0?"Melhor acesso":"Opção "+(k+1)} · ${c.lado!=null && S.lote.front.length>1? `L${c.lado+1}${c.lado===acPrincipal(S)?" (principal)":""} · ${pct(c.acessoVei,0)} do lado` : `${pct(c.acessoVei,0)} da frente`}</b><span class="pill ${c.vagas>base?"ok":""}">${c.vagas} vg (${c.vagas-base>=0?"+":""}${c.vagas-base})</span></div><div class="note">${c.rampaTipo==="elevador"? `Elevador de carros${c.cap?` · ${c.cap} carros/h`:""}${c.fila!=null&&isFinite(c.fila)?` · fila ${c.fila}`:""}` : c.rampaTipo==="alternada"? "Rampas alternadas" : c.rampaTipo==="reta"? "Rampas retas empilhadas" : (RAMPA_TIPOS[c.rampaTipo]||"")}${c.ok?"":" · com pendências"}</div>${c.atual?"":`<button class="btn sm${k===0?"":" ghost"}" data-act="rsApply" data-i="${k}">Aplicar</button>`}</div>`).join("")
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
