/* ================= Sol e vento (UX v3 §4.4: sub-abas Sol e Vento da etapa Projeto) =================
   O conteúdo mora aqui e serve aos dois casos:
   - com a etapa Clima no trilho (antes do P1): STEP_R.clima mostra as sub-abas Sol · Vento;
   - sem ela (P1): STEP_R.projeto (src/ui/etapa-projeto.js) chama climaCorpo() para PSUB "sol" e "vento".
   Dentro de Vento, a chave "No chão (rápido) | Túnel 3D" (ACT.vmodo) grava CSUB = "vento" | "v3d".
   climaModo() diz o que está na tela ("sol" | "vento" | "v3d"); climaSum, climaInfo (chamada por ui.js e views.js) e as
   ações do sol, do vento e do túnel ficam aqui. O túnel 3D pausa sozinho fora da sua tela (cfdNoTunel, src/wind3d.js). */
(function climaCss(){ const s=document.createElement("style"); s.textContent=`
.pbody>.vmodo{margin:0 0 2px}
.pbody>.vmodo button{white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:6px}
.pbody>.vmodo svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none}
`; document.head.appendChild(s) })();

/* modo de clima mostrado agora: na etapa Clima vale CSUB; em Projeto, a sub-aba (Sol) ou a chave do Vento (chão / túnel) */
function climaModo(){
  if(typeof TAB!=="undefined" && TAB==="projeto") return PSUB==="sol"? "sol" : CSUB==="v3d"? "v3d" : "vento";
  return CSUB==="v3d"? "v3d" : CSUB==="vento"? "vento" : "sol";
}
/* a sub-aba Sol está na tela (para o mapa da vizinhança e o 3D) */
function climaSolNaTela(){ return typeof emClima==="function" && emClima() && climaModo()==="sol" }

/* ---------- corpo de cada modo ---------- */
function climaSolHTML(){
  return RES("Horas de sol no chão", `<div id="solInfo"></div>`, {aside:`21/${MESES[S.sol.mes-1]}`, asideId:"solStat"}) +
    SEC("Data e hora", `<div class="seg full">${[["12,21","Verão"],["3,21","Equinócio"],["6,21","Inverno"]].map(([v,l])=>`<button type="button" data-act="sd" data-v="${v}" aria-pressed="${S.sol.mes+","+S.sol.dia===v}">${l}</button>`).join("")}</div>
      ${SLD("sol.mes","Mês (dia 21)",1,12,1,"",{fx:"sun",fmt:"mes"})}${SLD("sol.hora","Hora solar",6,19,0.25,"",{fx:"sun",fmt:"hora",help:"Hora solar: meio-dia é quando o sol está mais alto. Difere do relógio em até cerca de 1 hora."})}${SW("sol.on","Sol e sombras no 3D",{fx:"sun"})}
      <button class="btn full" data-act="solAnim" id="solAnimBtn">${typeof SUNANIM!=="undefined"&&SUNANIM?"❚❚ Pausar":"▶ Animar o dia no 3D"}</button>`+
      ADV(`<div class="row sb" style="flex-wrap:nowrap">${SW("clima.overlay3d","Mapa do chão também no 3D",{fx:"r3"})}${INFO("Pinta no chão do 3D o mapa que está aberto no palco: as horas de sol aqui e, em Vento › No chão, a velocidade do vento.","o mapa no 3D")}</div>`, {key:"cSol"}),
      {open:true, key:"cSol", sum:climaSum("sol"), info:"Horas de sol"});
}
/* chave do Vento: no chão (2D, rápido) ou túnel 3D */
function climaVmodoHTML(modo){
  return `<div class="seg full vmodo" role="group" aria-label="Como simular o vento">${[["vento","No chão (rápido)",'<path d="M3 9h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 19h18"/>'],["v3d","Túnel 3D",'<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>']].map(([v,l,ic])=>`<button type="button" data-act="vmodo" data-v="${v}" aria-pressed="${modo===v}"><svg viewBox="0 0 24 24" aria-hidden="true">${ic}</svg>${l}</button>`).join("")}</div>`;
}
function climaVentoHTML(modo){
  const C=S.clima, c=S.cfd;
  if(modo!=="v3d") return climaVmodoHTML("vento") +
    RES("Vento no chão", `<div id="ventoInfo"></div>`) +
    SEC("Vento de referência", compassSVG(C.ventoDir)+SLD("clima.ventoVel","Velocidade",1,20,0.5,"m/s",{fx:"clima"})+SLD("clima.ventoAlt","Altura da fatia",0.5,120,0.5,"m",{fx:"clima",help:"Altura acima do chão em que o vento é simulado. 1,5 m é a altura do pedestre."}),
      {open:true, key:"cVen", sum:climaSum("vento"), info:"Toque na rosa para escolher de onde o vento vem. No litoral sul de SC predomina o nordeste, com rajadas de sul em frentes frias — confira no INMET."});
  const V=c.viz, on=k=>!!V[k];
  const grupos =
    (on("linhas")? GRP("Linhas de corrente")+SLD("cfd.linhasN","Quantidade",8,160,1,"",{fx:"cfdLines",int:true})+SLD("cfd.linhasAlt.0","Começam a",0,1,0.05,"% da torre",{fx:"cfdLines",pct:true})+SLD("cfd.linhasAlt.1","Terminam a",0.2,2,0.05,"% da torre",{fx:"cfdLines",pct:true})+SLD("cfd.espessura","Espessura",0.4,3,0.1,"×",{fx:"cfdLines"})+
      SW("cfd.tubos","Tubos 3D (sem animação)",{fx:"cfdLines"})+SW("cfd.linhasMedia","Escoamento médio",{fx:"cfdLines"}) : "") +
    (on("fumaca")? GRP("Fumaça")+ROW(`Emissor${INFO("Coluna: um fio de fumaça do chão até acima da torre. Cortina: uma parede de fumaça de lado a lado, em toda a altura. Ponto: um jato fino num ponto.","o emissor de fumaça")}`,SEG("cfd.emissorTipo",[["linha","coluna"],["cortina","cortina"],["ponto","ponto"]],{fx:"cfdParts",rr:false}))+
      SLD("cfd.fumacaN","Densidade",300,8000,100,"",{fx:"cfdParts",int:true})+(on("particulas")?"":SLD("cfd.partTam","Tamanho dos puffs",0.3,3,0.1,"×",{fx:"save"}))+SW("cfd.fumacaCor","Colorir pela velocidade",{fx:"save"}) : "") +
    (on("particulas")? GRP("Partículas")+SLD("cfd.partN","Quantidade",500,12000,100,"",{fx:"cfdParts",int:true})+SLD("cfd.partTam","Tamanho",0.3,3,0.1,"×",{fx:"save"})+SW("cfd.rastro","Rastros",{fx:"cfdParts",rr:true})+(c.rastro?SLD("cfd.rastroLen","Comprimento do rastro",0.05,1.5,0.05,"s",{fx:"save"}):"") : "") +
    (on("plano")||on("setas")? GRP(on("plano")?"Plano de cor":"Setas")+ROW("Plano",SEG("cfd.plano.orient",[["h","horizontal"],["l","longitudinal"],["t","transversal"]],{fx:"cfdLight"}))+
      (c.plano.orient==="h"? SLD("cfd.plano.h","Altura",0.5,120,0.5,"m",{fx:"cfdLight"}) : SLD("cfd.plano.pos","Posição",0,1,0.01,"%",{fx:"cfdLight",pct:true}))+
      (on("plano")? SLD("cfd.planoOpac","Opacidade",0.2,1,0.05,"%",{fx:"cfdLight",pct:true}) : "")+(on("setas")? SLD("cfd.setasDens","Densidade das setas",0.4,3,0.1,"×",{fx:"cfdLight"}) : "") : "") +
    (on("pressao")? GRP(`Pressão nas fachadas${INFO("Cp")}`)+SLD("cfd.opac","Opacidade",0.1,1,0.05,"%",{fx:"cfdBld",pct:true}) : "");
  const pontos = (c.semente && on("linhas")? `<div class="row sb"><span class="pill">linhas pelo ponto da sonda</span><button class="btn sm ghost" data-act="semX">Soltar da entrada</button></div>` : "") +
    (c.emissor && on("fumaca")? `<div class="row sb"><span class="pill">fumaça no ponto da sonda</span><button class="btn sm ghost" data-act="emX">Voltar a barlavento</button></div>` : "");
  const rodando = typeof CFD!=="undefined" && CFD.running;
  return climaVmodoHTML("v3d") +
    SEC("Simular", `<div class="row" style="flex-wrap:nowrap"><button class="btn${rodando?" on":""}" data-act="cfdPlay" style="flex:1">${rodando?"Pausar":"Simular"}</button><button class="btn ghost" data-act="cfdReset">Reiniciar</button></div><span class="cfstat note" id="cfdStat2"></span>
      <div style="display:grid;grid-template-columns:118px minmax(0,1fr);gap:12px;align-items:center">${compassSVG(C.ventoDir)}${SLD("clima.ventoVel","Velocidade a 10 m",1,20,0.5,"m/s",{fx:"cfdStart",wide:false})}</div>`+
      ADV(ROW(`Entorno${INFO("Rugosidade")}`,SEG("cfd.rug",[["aberto","aberto"],["suburbano","subúrbio"],["urbano","urbano"]],{fx:"cfdStart",rr:false}))+
        ROW(`Precisão${INFO("“Alta” mostra melhor esteiras e cantos, mas leva minutos.","a precisão")}`,SEG("cfd.res",Object.entries(CFD_RES).map(([k,v])=>[k,v[1]]),{fx:"cfdStart",rr:false})), {key:"cSim"}),
      {open:true, key:"cSim", sum:climaSum("v3d"), info:"LBM"}) +
    SEC("O que ver", `<div class="chips">${CFD_VIZ.map(([k,l])=>`<button type="button" class="chip" data-act="cviz" data-k="${k}" aria-pressed="${on(k)}">${l}</button>`).join("")}</div>
      <div class="fld wide"><label class="fl" for="cfdVarSel">Colorir por${INFO("Lawson")}</label><select class="sel" id="cfdVarSel" data-p="cfd.var" data-t="s" data-fx="cfdRef" data-rr="1">${Object.entries(CFD_VARS).map(([k,l])=>`<option value="${k}" ${c.var===k?"selected":""}>${l}</option>`).join("")}</select></div>${pontos}`+
      ADV(ROW("Escala",SEG("cfd.escala",[["auto","automática"],["fixa","fixa"]],{fx:"cfdRef"}))+(c.escala==="fixa"? KV(NUM("cfd.min","Mínimo","",{fx:"cfdRef",step:0.5})+NUM("cfd.max","Máximo","",{fx:"cfdRef",step:0.5})) : "")+
        grupos+GRP("Aparência")+ROW("Fundo",SEG("cfd.fundo",[["claro","claro"],["escuro","escuro"]],{fx:"cfdLook",rr:false}))+SW("cfd.vidro","Prédios em vidro (ver através)",{fx:"cfdLook"})+SLD("cfd.animVel","Velocidade da animação",0.1,4,0.1,"×",{fx:"save"}), {key:"cVer"}),
      {open:true, key:"cVer", sum:climaSum("ver"), info:"Toque num ponto do 3D para medir com a sonda: dali dá para soltar fumaça ou linhas de corrente."});
}
/* corpo + after de um modo (usado pela etapa Clima e pelas sub-abas Sol/Vento do Projeto) */
function climaCorpo(modo){
  return { body: modo==="sol"? climaSolHTML() : climaVentoHTML(modo),
    after: ()=>{ if(modo==="sol" && window._last) try{ sunHours(S, window._last.m) }catch(e){}   // resultado do sol também quando a vista é o 3D
      if(modo!=="v3d") climaInfo(); else if(typeof cfdStatus==="function") cfdStatus() } };
}

/* ---------- etapa Clima (enquanto ela existir no trilho) ---------- */
STEP_R.clima = ()=>{
  const modo=climaModo(), tabs=[["sol","Sol"],["vento","Vento"]], ativo=modo==="sol"? "sol" : "vento";
  // a aba Vento leva ao modo em uso (tocar nela de novo não sai do túnel)
  const sub=`<div class="seg full subtabs" role="tablist" aria-label="Partes do clima">${tabs.map(([k,l])=>`<button type="button" role="tab" data-act="csub" data-v="${k==="vento"&&modo==="v3d"?"v3d":k}" aria-pressed="${ativo===k}" aria-selected="${ativo===k}">${l}</button>`).join("")}</div>`;
  const R=climaCorpo(modo);
  return { sub, subKey:modo, body:R.body, after:R.after };
};
function climaSum(k){
  const C=S.clima, c=S.cfd, dir=["N","NE","L","SE","S","SO","O","NO"][Math.round((C.ventoDir||0)/45)%8];
  if(k==="sol") return `21/${MESES[S.sol.mes-1]} · ${hhmm(S.sol.hora)}${S.sol.on?" · sombras no 3D":""}`;
  if(k==="vento") return `vem de ${dir} · ${nf(C.ventoVel,1)} m/s · ${nf(C.ventoAlt,1)} m`;
  if(k==="v3d") return `vem de ${dir} · ${nf(C.ventoVel,1)} m/s · ${(CFD_RES[c.res]||["",""])[1].toLowerCase()}`;
  if(k==="ver") return CFD_VIZ.filter(([q])=>c.viz[q]).map(([,l])=>l.toLowerCase()).join(" · ")||"nada";
  return "";
}
STEP_LIVE.clima = ()=>{ const k=climaModo(); if(k==="sol"){ setSum("cSol", climaSum("sol")); const s=document.getElementById("solStat"); if(s) s.textContent=`21/${MESES[S.sol.mes-1]}` } else if(k==="vento") setSum("cVen", climaSum("vento")); else { setSum("cSim", climaSum("v3d")); setSum("cVer", climaSum("ver")) } };
function climaInfo(){
  const si=document.getElementById("solInfo"), vi=document.getElementById("ventoInfo");
  if(si) si.innerHTML = _sunCache? `<div class="mets"><div class="met"><div class="l">Sol possível no dia</div><div class="v">${nf(_sunCache.max,1)} h</div></div><div class="met"><div class="l">Média nas áreas livres</div><div class="v">${nf(_sunCache.mediaLote,1)} h</div></div><div class="met big"><div class="l">Áreas livres com menos de 2 h de sol</div><div class="v">${pct(_sunCache.pctBaixo,0)}</div></div></div>` : `<p class="note">Calculando as horas de sol…</p>`;
  if(vi){ const w=windStats(S); vi.innerHTML = w? `<div class="mets"><div class="met big"><div class="l">Rajada máxima no lote</div><div class="v">${nf(w.max*S.clima.ventoVel,1)} m/s</div><div class="s">${nf(w.max,2)}× o vento de referência · ${WIND.steps>=2400?"simulação concluída":"rodando "+pct(WIND.steps/2400,0)}</div></div><div class="met"><div class="l">Acelerado &gt;1,3×</div><div class="v">${pct(w.hi,0)}</div></div><div class="met"><div class="l">Calmaria &lt;0,35×</div><div class="v">${pct(w.calm,0)}</div></div></div>` : `<p class="note">Simulando o vento no chão…</p>` }
  if(emClima()) STEP_LIVE.clima();
}
/* troca de modo do Vento (no chão ↔ túnel 3D): grava CSUB e leva o palco para a vista do modo */
function climaVmodo(v){
  v = v==="v3d"? "v3d" : "vento";
  CSUB=v; if(v==="vento") S.clima.modo="vento";
  renderTab(); TB.scrollTop=0;
  const w = v==="v3d"? "v3d" : "clima";
  if(VIEW!==w) setView(w); else if(w==="clima" && window._last){ viewbarSegs(window._last.m); climaRun(); hintFor() }
}
Object.assign(ACT,{
  vmodo: b=>climaVmodo(b.dataset.v),
  sd: b=>{ const [mm,d]=b.dataset.v.split(",").map(Number); S.sol.mes=mm; S.sol.dia=d; sunUI(); applySun(); climaRun(); renderTab() },
  solAnim: ()=>{ if(!S.sol.on){ S.sol.on=true; save() } if(VIEW!=="3d") setView("3d"); sunUI(); applySun(); const p=document.getElementById("sunPlay"); if(p) p.click(); const b=document.getElementById("solAnimBtn"); if(b) b.textContent=SUNANIM?"❚❚ Pausar":"▶ Animar o dia no 3D"; setSum("cSol", climaSum("sol")) },
  entGen: b=>{ if(S.entorno.length && b && !b.dataset.arm){ b.dataset.arm=1; b.textContent="Substituir os atuais?"; b.classList.add("on"); return } genNeighbors(); renderTab(); fit3d(); if(VIEW==="v3d") cfdStart(true); toast("Vizinhos genéricos criados — ajuste as alturas") },
  entDraw: ()=>{ setView("impl"); DRAW=[]; setTool("draw","entorno") },
  entClear: b=>{ if(b.dataset.arm){ S.entorno=[]; renderTab() } else { b.dataset.arm=1; b.textContent="Confirmar"; b.classList.add("on") } },
  entX: b=>{ S.entorno.splice(+b.dataset.i,1); renderTab() },
  cviz: b=>{ const k=b.dataset.k; S.cfd.viz[k]=!S.cfd.viz[k]; save(); if(cfdOn()){ if(k==="particulas"||k==="fumaca") cfdParticlesInit(); else if(k==="linhas") cfdLines(); else cfdRefresh(false); cfdBarUI(); render3() } renderTab() },
  cfdPlay: ()=>{ if(VIEW!=="v3d"){ setView("v3d"); return } CFD.running? cfdPause() : (CFD.worker? cfdRun() : cfdStart()); renderTab() },
  cfdReset: ()=>{ if(VIEW!=="v3d") setView("v3d"); else cfdStart(true) },
  semX: ()=>{ S.cfd.semente=null; save(); if(cfdOn()){ cfdLines(); render3() } renderTab() },
  emX: ()=>{ S.cfd.emissor=null; save(); if(cfdOn()) cfdParticlesInit(); renderTab() },
});
/* túnel 3D fora da tela: toda troca de etapa ou sub-aba passa por renderTab, então confere logo depois de montar o painel
   (sem esperar o próximo quadro do túnel, que pode demorar com o 3D por software). cfdNoTunel/cfdStop em src/wind3d.js */
["terreno","regras","produto","viab","projeto","clima","cen"].forEach(k=>addCard(k, {key:"cfdGuarda", order:1000, html:()=>"",
  after:()=>{ if(typeof cfdNoTunel==="function" && VIEW==="v3d" && !cfdNoTunel()) cfdStop() }}));
