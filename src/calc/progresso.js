/* ================= checklist "O que falta para o estudo ficar confiável" e próximo passo (UX v3 §3.3 e §6.3) =================
   Cálculo puro (sem DOM): roda na página, no Worker e nos testes (tests/progresso.test.js). A tela fica em src/ui/progresso.js.
   Etapas e sub-abas já no fluxo NOVO (UX v3 §2): terreno | produto | viab (res|prem|risco) | projeto (gar|tipo|sol|vento) | cen.
   Os nomes antigos (regras → terreno, clima → projeto) são aceitos em proximoPasso.

   progressoItens(st, m?, f?) → [{k, nome, ok, etapa, sub, sec, dica}] — 9 itens fixos, nesta ordem.
     ok: true (conferido) · false (pendente) · null (ainda não calculado: sem m, ou sem o pavimento tipo/garagem no m)
   progressoResumo(st, m?, f?) → {feitos, total, pct, pendentes:[nome…], nivel:'rascunho'|'em andamento'|'confiável', itens}
   proximoPasso(st, m?, f?, tab, sub?) → {rotulo, etapa, sub, sec, campo?, act?, dica} — nunca vazio:
     resolve a primeira pendência da etapa atual (act = ACT a chamar, senão ir para etapa/sub/sec e focar o `campo`) ou avança para a próxima.
     Preço e custo (conf.preco/custo) NÃO têm act: o passo leva ao campo e a confirmação é explícita lá (editar ou "Conferi").
   S.guia.conf {regras, preco, custo} são só flags de interface (src/ui/progresso.js): não entram em compute/finance. */

const PROG_ETAPAS = ["terreno","produto","viab","projeto","cen"];
const PROG_ALIAS = { regras:"terreno", clima:"projeto" };
const progMesmoLote = (a,b)=> JSON.stringify(a)===JSON.stringify(b);
const progNf = (v,d=0)=> (isFinite(v)?+v:0).toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d});

/* o que está fora das regras no produto: [{k, txt}] (vazio = dentro) */
function progForaRegras(st, m){
  if(!m || !m.T) return null;
  const R=st.regras, s=status(m, st), out=[], hL=m.hLim ?? R.hMax;
  if(s.ca==="bad") out.push({k:"ca", txt:`aproveitamento ${progNf(m.CA,2)}/${progNf(R.caMax,2)}`});
  if(s.h==="bad") out.push({k:"h", txt:`altura ${progNf(m.H,0)}/${progNf(hL,0)} m`});
  if(isFinite(m.TO) && m.TO>R.toEmb+1e-6) out.push({k:"to", txt:`ocupação ${progNf(m.TO*100,0)}/${progNf(R.toEmb*100,0)}%`});
  if(s.perm==="bad") out.push({k:"perm", txt:`permeável ${progNf(m.perm*100,0)}/${progNf(R.permeab*100,0)}%`});
  if(s.apto==="bad") out.push({k:"apto", txt:`menor unidade ${progNf(m.minApto,0)}/${progNf(R.aptoMin,0)} m²`});
  if(s.tor==="bad") out.push({k:"tor", txt:"torre sem espaço no lote"});
  return out;
}
function progNormasRuins(st, m){
  if(!m || !m.T || !Array.isArray(m.tipo) || !m.tipo.length || typeof normasAvaliar!=="function") return null;
  try{ const v=normasAvaliar(st, m); return (v.itens||[]).filter(i=>i.status==="bad") }catch(e){ return null }
}
function progressoItens(st, m, f){
  const L=st.lote||{}, conf=(st.guia&&st.guia.conf)||{}, ref=st.regrasRef||{};
  const loteOk = !!L.geo || !progMesmoLote(L.pts, DEF.lote.pts);
  const fora = progForaRegras(st, m);
  const temM = !!(m && m.T);
  const falta = temM? Math.max(0, (m.vagasReq||0)-(m.vagas||0)) : 0;
  const gar = temM && m.gar? Object.values(m.gar).filter(Boolean) : null;
  const garOk = !st.estudo.usarLayout? false : gar==null? null : gar.every(l=>l.ok!==false);
  const nrm = progNormasRuins(st, m);
  const it = (k, nome, ok, etapa, sub, sec, dica)=>({k, nome, ok, etapa, sub, sec, dica});
  return [
    it("lote", "Lote informado", loteOk, "terreno", null, "contorno", loteOk? "contorno do estudo" : "o lote ainda é o do exemplo"),
    it("ruas", "Ruas e frente principal", loteOk && Array.isArray(L.front) && L.front.length>0 && L.front.includes(L.principal), "terreno", null, "lados",
      loteOk? `${(L.front||[]).length} lado${(L.front||[]).length===1?"":"s"} na rua` : "marque os lados na rua depois do lote"),
    it("regras", "Regras da cidade", !!ref.id || !!conf.regras, "terreno", null, "regras",
      ref.id? (ref.ilustrativo? "valores de exemplo: conferir na lei" : "da biblioteca") : conf.regras? "conferidas" : "regras padrão: escolha a cidade"),
    it("produto", "Produto dentro das regras", fora==null? null : !fora.length, "produto", null, null,
      fora==null? "calculando…" : fora.length? "fora: "+fora.map(x=>x.txt).join(" · ") : "aproveitamento, altura e ocupação"),
    it("vagas", "Vagas atendidas", temM? falta===0 : null, "produto", null, "pr-emb",
      !temM? "calculando…" : falta? `faltam ${falta} vaga${falta>1?"s":""}` : `${m.vagas} de ${m.vagasReq} exigidas`),
    it("preco", "Preço de venda conferido", !!conf.preco, "viab", "res", "essencial", conf.preco? "conferido" : "confirme o preço por m²"),
    it("custo", "Terreno e custo da obra", !!conf.custo, "viab", "res", "essencial", conf.custo? "conferidos" : "confirme o terreno e o CUB"),
    it("garagem", "Garagem conferida no layout", garOk, "projeto", "gar", st.estudo.usarLayout? "gRampa" : "gLay",
      !st.estudo.usarLayout? "vagas ainda estimadas" : garOk==null? "calculando…" : garOk? "carros chegam a todas as vagas" : "carro não chega à circulação"),
    it("normas", "Saídas e acessibilidade", nrm==null? null : !nrm.length, "projeto", "tipo", "nrmList",
      nrm==null? "calculando…" : nrm.length? `${nrm.length} ${nrm.length>1?"itens não atendem":"item não atende"}` : "nenhum “não atende”"),
  ];
}
function progressoResumo(st, m, f){
  const itens=progressoItens(st, m, f), total=itens.length, feitos=itens.filter(i=>i.ok===true).length;
  const lote=itens[0].ok===true;
  const nivel = feitos===total? "confiável" : (!lote || feitos<4)? "rascunho" : "em andamento";
  return { feitos, total, pct: feitos/total, pendentes: itens.filter(i=>i.ok!==true).map(i=>i.nome), nivel, itens };
}

/* rótulo do botão para resolver cada pendência (act = ACT a chamar; sem act, ir para etapa/sub/sec) */
function progResolve(i, st, m){
  switch(i.k){
    case "lote": return {rotulo:"Desenhar o lote", dica:"O lote ainda é o do exemplo"};
    case "ruas": return {rotulo:"Marcar a frente", dica:"Marque os lados do lote na rua"};
    case "regras": return {rotulo:"Escolher a cidade", dica:"Regras padrão: escolha a cidade e a zona"};
    case "produto": return {rotulo:"Sugerir a melhor combinação", act:"otim", dica:("Fora das regras: "+i.dica.replace(/^fora: /,"")).slice(0,60)};
    case "vagas": { const sub=(st.produto.subsolos||0)<5;
      return sub? {rotulo:"Adicionar 1 subsolo", act:"progSubsolo", dica:("Vagas: "+i.dica).slice(0,60)} : {rotulo:"Adicionar 1 garagem elevada", act:"progGaragem", dica:("Vagas: "+i.dica).slice(0,60)} }
    // preço e custo nunca se confirmam com um clique à distância: o passo leva ao campo (irPara com `campo`), onde o usuário edita ou aperta "Conferi"
    case "preco": return {rotulo:"Conferir o preço de venda", campo:"produto.mix.0.preco", dica:"Falta conferir o preço de venda"};
    case "custo": return {rotulo:"Conferir terreno e obra", campo:"fin.terreno", dica:"Falta conferir o terreno e o custo da obra"};
    case "garagem": return !st.estudo.usarLayout? {rotulo:"Usar as vagas do layout", act:"progLayout", dica:"As vagas ainda são estimadas"} : {rotulo:"Ajustar o acesso da garagem", dica:"O carro não chega a algum pavimento"};
    case "normas": return {rotulo:"Ver as normas", dica:("Normas: "+i.dica).slice(0,60)};
  }
  return {rotulo:"Resolver", dica:i.nome};
}
const PROG_AVANCA = {
  terreno: ()=>({rotulo:"Definir o produto →", etapa:"produto", sub:null}),
  produto: ()=>({rotulo:"Ver a viabilidade →", etapa:"viab", sub:"res"}),
  viab:    ()=>({rotulo:"Conferir o projeto →", etapa:"projeto", sub:"gar"}),
  projeto: sub=>({ gar:{rotulo:"Conferir os andares →", etapa:"projeto", sub:"tipo"}, tipo:{rotulo:"Ver o sol →", etapa:"projeto", sub:"sol"},
    sol:{rotulo:"Ver o vento →", etapa:"projeto", sub:"vento"} }[sub] || {rotulo:"Entregar →", etapa:"cen", sub:"entregar"}),
  cen:     ()=>({rotulo:"Baixar relatório PDF", etapa:"cen", sub:null, act:"progPdf"}),
};
function proximoPasso(st, m, f, tab, sub){
  let etapa = PROG_ALIAS[tab] || tab; if(!PROG_ETAPAS.includes(etapa)) etapa="terreno";
  if(tab==="regras") sub=null;
  if(etapa==="projeto"){ if(sub==="v3d") sub="vento"; if(sub==="andar") sub="tipo"; if(tab==="clima" && sub!=="vento") sub= sub==="sol"? "sol" : sub||"sol" }
  if(etapa==="viab" && sub==="vendas") sub="prem";
  const r = progressoResumo(st, m, f), itens=r.itens;
  // projeto: só as pendências da sub-aba atual (o resto é refino); nas outras etapas, a primeira pendência da etapa
  const pend = itens.find(i=>i.ok===false && i.etapa===etapa && (etapa!=="projeto" || !sub || i.sub===sub));
  if(pend && etapa!=="cen"){
    const x = progResolve(pend, st, m);
    return { rotulo:x.rotulo, etapa:pend.etapa, sub:pend.sub, sec:pend.sec, ...(x.campo? {campo:x.campo} : {}), ...(x.act? {act:x.act} : {}), dica:x.dica, k:pend.k };
  }
  const a = PROG_AVANCA[etapa](sub);
  const dica = r.feitos===r.total? "Estudo confiável: tudo conferido" : `${r.feitos} de ${r.total} itens conferidos`;
  return { rotulo:a.rotulo, etapa:a.etapa, sub:a.sub, sec:null, ...(a.act? {act:a.act} : {}), dica };
}
