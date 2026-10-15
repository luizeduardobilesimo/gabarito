/* ================= etapa Clima (Sol · Vento no chão · Vento 3D) =================
   Separado de src/steps.js (UX v3, P0), sem mudar comportamento. Aqui: STEP_R/STEP_LIVE.clima, climaSum, climaInfo
   (chamada por ui.js e views.js) e as ações do clima e do entorno. */
/* ---------------- 6. Clima ---------------- */
STEP_R.clima = ()=>{
  const C=S.clima, c=S.cfd;
  const sub=`<div class="seg full subtabs" role="tablist" aria-label="Partes do clima">${ETAPA_SUBS.clima.map(([k,l])=>`<button type="button" role="tab" data-act="csub" data-v="${k}" aria-pressed="${CSUB===k}" aria-selected="${CSUB===k}">${l}</button>`).join("")}</div>`;
  let body="";
  if(CSUB==="sol") body =
    RES("Horas de sol no chão", `<div id="solInfo"></div>`, {aside:`21/${MESES[S.sol.mes-1]}`, asideId:"solStat"}) +
    SEC("Data e hora", `<div class="seg full">${[["12,21","Verão"],["3,21","Equinócio"],["6,21","Inverno"]].map(([v,l])=>`<button type="button" data-act="sd" data-v="${v}" aria-pressed="${S.sol.mes+","+S.sol.dia===v}">${l}</button>`).join("")}</div>
      ${SLD("sol.mes","Mês (dia 21)",1,12,1,"",{fx:"sun",fmt:"mes"})}${SLD("sol.hora","Hora solar",6,19,0.25,"",{fx:"sun",fmt:"hora",help:"Hora solar: meio-dia é quando o sol está mais alto. Difere do relógio em até cerca de 1 hora."})}${SW("sol.on","Sol e sombras no 3D",{fx:"sun"})}
      <button class="btn full" data-act="solAnim" id="solAnimBtn">${typeof SUNANIM!=="undefined"&&SUNANIM?"❚❚ Pausar":"▶ Animar o dia no 3D"}</button>`+
      ADV(SW("clima.overlay3d","Mapa de horas de sol também no 3D",{fx:"r3"}), {key:"cSol"}),
      {open:true, key:"cSol", sum:climaSum("sol"), info:"Horas de sol"});
  else if(CSUB==="vento") body =
    RES("Vento no chão", `<div id="ventoInfo"></div>`) +
    SEC("Vento de referência", compassSVG(C.ventoDir)+SLD("clima.ventoVel","Velocidade",1,20,0.5,"m/s",{fx:"clima"})+SLD("clima.ventoAlt","Altura da fatia",0.5,120,0.5,"m",{fx:"clima",help:"Altura acima do chão em que o vento é simulado. 1,5 m é a altura do pedestre."})+
      ADV(SW("clima.overlay3d","Mapa do vento também no 3D",{fx:"r3"}), {key:"cVen"}),
      {open:true, key:"cVen", sum:climaSum("vento"), info:"Toque na rosa para escolher de onde o vento vem. No litoral sul de SC predomina o nordeste, com rajadas de sul em frentes frias — confira no INMET."});
  else {
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
    body =
      SEC("Simular", `<div class="row" style="flex-wrap:nowrap"><button class="btn pri" data-act="cfdPlay" style="flex:1">${typeof CFD!=="undefined"&&CFD.running?"Pausar":"Simular"}</button><button class="btn" data-act="cfdReset">Reiniciar</button></div><span class="cfstat note" id="cfdStat2"></span>
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
  return { sub, subKey:CSUB, body, after:()=>{ if(CSUB==="sol" && window._last) try{ sunHours(S, window._last.m) }catch(e){}   // resultado do sol também quando a vista é o 3D
    if(CSUB!=="v3d") climaInfo(); else if(typeof cfdStatus==="function") cfdStatus() } };
};
/* entorno do Clima: a mesma seção "Entorno" do Terreno (src/ui/entorno.js: criar, desenhar, gerar genéricos, nomes e alturas, OSM) */
function climaSum(k){
  const C=S.clima, c=S.cfd, dir=["N","NE","L","SE","S","SO","O","NO"][Math.round((C.ventoDir||0)/45)%8];
  if(k==="sol") return `21/${MESES[S.sol.mes-1]} · ${hhmm(S.sol.hora)}${S.sol.on?" · sombras no 3D":""}`;
  if(k==="vento") return `vem de ${dir} · ${nf(C.ventoVel,1)} m/s · ${nf(C.ventoAlt,1)} m`;
  if(k==="v3d") return `vem de ${dir} · ${nf(C.ventoVel,1)} m/s · ${(CFD_RES[c.res]||["",""])[1].toLowerCase()}`;
  if(k==="ver") return CFD_VIZ.filter(([q])=>c.viz[q]).map(([,l])=>l.toLowerCase()).join(" · ")||"nada";
  return "";
}
STEP_LIVE.clima = ()=>{ if(CSUB==="sol"){ setSum("cSol", climaSum("sol")); const s=document.getElementById("solStat"); if(s) s.textContent=`21/${MESES[S.sol.mes-1]}` } else if(CSUB==="vento") setSum("cVen", climaSum("vento")) };
function climaInfo(){
  const si=document.getElementById("solInfo"), vi=document.getElementById("ventoInfo");
  if(si) si.innerHTML = _sunCache? `<div class="mets"><div class="met"><div class="l">Sol possível no dia</div><div class="v">${nf(_sunCache.max,1)} h</div></div><div class="met"><div class="l">Média nas áreas livres</div><div class="v">${nf(_sunCache.mediaLote,1)} h</div></div><div class="met big"><div class="l">Áreas livres com menos de 2 h de sol</div><div class="v">${pct(_sunCache.pctBaixo,0)}</div></div></div>` : `<p class="note">Abra a vista Mapas para calcular.</p>`;
  if(vi){ const w=windStats(S); vi.innerHTML = w? `<div class="mets"><div class="met big"><div class="l">Rajada máxima no lote</div><div class="v">${nf(w.max*S.clima.ventoVel,1)} m/s</div><div class="s">${nf(w.max,2)}× o vento de referência · ${WIND.steps>=2400?"simulação concluída":"rodando "+pct(WIND.steps/2400,0)}</div></div><div class="met"><div class="l">Acelerado &gt;1,3×</div><div class="v">${pct(w.hi,0)}</div></div><div class="met"><div class="l">Calmaria &lt;0,35×</div><div class="v">${pct(w.calm,0)}</div></div></div>` : `<p class="note">Abra a vista Mapas › Vento no chão para simular.</p>` }
  if(emClima()) STEP_LIVE.clima();
}
Object.assign(ACT,{
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
