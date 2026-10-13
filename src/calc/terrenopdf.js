/* ================= página do PDF: topografia e relevo do terreno =================
   Funções puras (Node, Worker e página). A interface (mapa em canvas e a escrita no PDF) fica em src/ui/topografia.js.
   terrenoPdfDados(st, m) → null (nada a mostrar) ou
     { topo:  null | { fonte, secoes:[{h, linhas:[[rótulo, valor, estado?]…]}], total, avisos:[] },
       relevo: null | { secoes:[{h, linhas}], aviso, nivel, previa },
       fontes: texto curto das fontes }
   Entra quando S.topo.on (com levantamento calculado em m.topo) ou quando há relevo lido (modelo digital ou cotas dos cantos).
   A topografia vale por si; o relevo é só leitura inicial: o aviso de modelo de superfície (±3 m) acompanha sempre. */
const TERRENO_AVISO_RELEVO = {
  terrarium: "Modelo digital de SUPERFÍCIE (AWS Terrain Tiles / SRTM), um ponto a cada ~30 m: inclui prédios e árvores e erra cerca de ±3 m. Serve de primeira leitura da inclinação e não substitui o levantamento topográfico.",
  openmeteo: "Modelo digital de SUPERFÍCIE (Open-Meteo, ~90 m): inclui prédios e árvores e erra cerca de ±3 m. Licença CC-BY só para uso não comercial. Não substitui o levantamento topográfico.",
  anadem: "ANADEM (modelo digital de TERRENO do Brasil, ~30 m, sem prédios e vegetação): erro absoluto de alguns metros, mas bom para inclinações. Não substitui o levantamento topográfico.",
  cantos: "Plano ajustado às cotas informadas nos vértices do lote: vale tanto quanto as cotas digitadas. Não substitui o levantamento topográfico."
};
function terrenoPdfTopo(st, m){
  const T=st.topo, t=m && m.topo; if(!T || !T.on || !t) return null;
  const n1=(v,d=2)=>nf(v,d), dif=t.c-t.calc, tipo=TOPO_CONT[t.tipo]? TOPO_CONT[t.tipo] : TOPO_CONT.cortina;
  const secoes=[], avisos=[];
  secoes.push({h:"Levantamento e cota do térreo", linhas:[
    ["Levantamento", `${T.fonte || "pontos importados"} · ${t.sf.N} pontos · cotas de ${n1(t.sf.zmin)} a ${n1(t.sf.zmax)} m`],
    ["Cota ótima do térreo", `${n1(t.cOtima)} m (menor corte + aterro dentro da soleira)`],
    ["Cota do térreo adotada", `${n1(t.c)} m${t.modo==="manual"? " (informada)" : ""}`],
    ["Calçada no acesso de pedestres", `${n1(t.calc)} m`],
    ["Soleira × calçada", `${dif>=0?"+":"−"}${n1(Math.abs(dif))} m (tolerância ± ${n1(t.tol)} m)`, Math.abs(dif)>t.tol+1e-6? "bad" : "ok"]
  ]});
  const saldo=t.terra.corte-t.terra.aterro;
  const mov=[["Corte total", `${nf(t.terra.corte,0)} m³ (platô ${nf(t.terra.platCorte,0)} · subsolos ${nf(t.terra.escav,0)})`],
    ["Aterro total", `${nf(t.terra.aterro,0)} m³`],
    [saldo>=0? "Saldo: bota-fora" : "Saldo: empréstimo", `${nf(Math.abs(saldo),0)} m³`]];
  (t.terra.subs||[]).forEach(s=>mov.push([`${s.k}º subsolo · cota ${n1(s.bot)} a ${n1(s.top)} m`, `${nf(s.vol,0)} m³ escavados`]));
  secoes.push({h:"Movimento de terra", linhas:mov});
  const cont=[[tipo.nome, t.nSub? `${nf(t.cont.area,0)} m² (perímetro ${nf(t.cont.per,0)} m × altura média ${n1(t.cont.hMed,1)} m)` : "sem subsolo: sem contenção do subsolo"]];
  if(t.cont.arrimo>0) cont.push(["Muros de arrimo do platô", `${nf(t.cont.arrimo,0)} m²`]);
  if(t.na) cont.push(t.na.hAgua>0? ["Lençol freático", `nível d'água ${n1(t.na.cotaNA)} m · fundo do subsolo ${n1(t.na.fundo)} m (${n1(t.na.hAgua,1)} m abaixo; rebaixamento de ${nf(t.na.vol,0)} m³ e ${nf(t.na.areaImp,0)} m² de impermeabilização)`, "warn"]
      : ["Lençol freático", `nível d'água ${n1(t.na.cotaNA)} m · abaixo do fundo do subsolo (${n1(t.na.fundo)} m)`, "ok"]);
  secoes.push({h:"Contenção e lençol", linhas:cont});
  const c=t.custos, cus=[["Movimento de terra", brl(c.terra||0)]];
  if(c.contencao) cus.push([`Contenção (${tipo.curto})`, brl(c.contencao)]);
  if(c.arrimo) cus.push(["Muros de arrimo", brl(c.arrimo)]);
  if(c.rebaix) cus.push(["Rebaixamento do lençol", brl(c.rebaix)]);
  if(c.imperm) cus.push(["Impermeabilização", brl(c.imperm)]);
  const total=(c.terra||0)+(c.contencao||0)+(c.arrimo||0)+(c.rebaix||0)+(c.imperm||0);
  cus.push(["Total no custo da obra", brl(total)]);
  secoes.push({h:"Custos", linhas:cus});
  if(t.fora) avisos.push("Parte do lote está fora da área levantada: ali a superfície foi extrapolada.");
  return { fonte:T.fonte||"", secoes, total, avisos, nCurvas:T.curvasInt };
}
function terrenoPdfRelevo(st){
  const ef=relevoEfetivoDe(st); if(!ef) return null;
  const R=st.relevo, pl=ef.plano, nivel=ef.conf && ef.conf.nivel, fonte= ef.info? "cantos" : (R.fonte==="openmeteo"||R.fonte==="anadem"? R.fonte : "terrarium");
  const quando=R.quando? R.quando.split("-").reverse().join("/") : "";
  const origem= ef.info? "cotas dos vértices do lote" : `${R.origem || (fonte==="openmeteo"? "Open-Meteo" : fonte==="anadem"? "ANADEM" : "Terrarium")}${R.arquivo? " · "+R.arquivo : ""}${R.plano&&R.plano.janela? " · janela "+R.plano.janela+" m" : ""}${quando? " · lido em "+quando : ""}`;
  const plano=nivel==="plano", v=pl.pct<10? nf(pl.pct,1) : nf(pl.pct,0);
  const lin=[["Resultado", plano? `praticamente plano (inclinação menor que ${RELEVO_MIN}%)` : relevoResumo(pl, ef.conf)],
    ["Inclinação", `${v}%${plano? " (dentro do ruído do modelo)" : ` · ${nf(pl.pct,1)} m a cada 100 m`}`]];
  if(!plano) lin.push(["Direção da descida", `para ${relevoDirTexto(pl.azDesc)} (azimute ${nf(pl.azDesc,0)}°)`]);
  lin.push(["Confiança", `${relevoNivelTxt[nivel]||"—"}${ef.conf&&ef.conf.motivo? " · "+ef.conf.motivo : ""}`, nivel==="baixa"? "warn" : nivel==="plano"? undefined : "ok"]);
  lin.push(["Fonte", origem]);
  const cotas=relevoCotasDosCantos(pl, st.lote.pts, st.lote.norte), mn=Math.min(...cotas), mx=Math.max(...cotas);
  if(!plano) lin.push(["Desnível entre os vértices do lote", `${nf(mx-mn,1)} m (vértice ${cotas.indexOf(mn)+1} o mais baixo, ${cotas.indexOf(mx)+1} o mais alto)`]);
  const inf=(R.cantos||[]).map((z,i)=>z!=null && z!=="" && isFinite(+z)? `V${i+1} ${nf(+z,1)} m` : null).filter(Boolean);
  if(inf.length) lin.push(["Cotas informadas", inf.join(" · ")]);
  lin.push(["No estudo", R.aplicado==="topo"? "aplicado à topografia (corte, aterro e contenção)" : R.aplicado==="desnivel"? "aplicado como desnível simples frente × fundos" : "só leitura (não alterou números do estudo)"]);
  const xs=st.lote.pts.map(q=>q[0]), ys=st.lote.pts.map(q=>q[1]), mg=Math.max(14, 0.4*Math.max(Math.max(...xs)-Math.min(...xs), Math.max(...ys)-Math.min(...ys)));   // mesma moldura do mapa
  return { secoes:[{h:"Relevo do local", linhas:lin}], aviso:TERRENO_AVISO_RELEVO[fonte], nivel, previa:relevoPrevia(st, {margem:mg}), fonte };
}
function terrenoPdfDados(st, m){
  const topo=terrenoPdfTopo(st, m), relevo=terrenoPdfRelevo(st);
  if(!topo && !relevo) return null;
  return { topo, relevo, fontes:[topo? "topografia" : "", relevo? "relevo" : ""].filter(Boolean).join(" e ") };
}
