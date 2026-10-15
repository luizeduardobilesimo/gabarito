/* ================= etapa Terreno: "Onde é e o que a lei permite" (UX v3 §4.1, pacote P2) =================
   Terreno absorve a antiga etapa Regras. De cima para baixo:
     RES "Lote e potencial" (#loteRes: área, frente principal, computável máximo, até N andares; selo #loteSelo = rgConformidade)
     O lote   · Contorno do lote (métodos + formulário; aviso #geoNote; [+] Posição no mapa = lat/lon/norte, ADV "local")
              · Ruas e frentes (#edges, "Detectar frentes pelas ruas" em #frBox — src/ui/frente.js)
     A lei    · Regras da prefeitura (Cidade e zona #cidLib — src/ui/normas.js; 8 campos principais; [+] nome e lei, IA, ocupação e
                outorga, afastamentos, áreas) · Altura e recuos por faixa (src/ui/forma.js)
     Entorno  · Terreno inclinado (src/ui/topografia.js + relevo.js) · Áreas restritas (limites desenhados) · Vizinhos e ruas (addCard
                entedit, src/ui/entorno.js)
   Exporta para outros pacotes:
     rgConformidade(m, st?) → linhas [rótulo, fração, texto, "ok"|"warn"|"bad"] da conformidade com as regras (sem DOM; Produto e KPIs)
     acessosSecHTML() / acessosLive(m) → sliders "Entradas" (lote.acessoPed / lote.acessoVei) que vão para Projeto › Garagem (P4)
     ACT.torAjMix (o "Torre ocupa" em si mora em Produto › Forma das torres)
   Sem o P1 (etapa Regras ainda no trilho), STEP_R.regras mostra o mesmo conteúdo do Terreno. */
let TMETH = "desenhar", RECLADO = false;
let LADOAB = new Set();   // lados abertos na lista para editar comprimento e recuos (só nesta sessão)
(function terrenoCss(){ const s=document.createElement("style"); s.textContent=`
.edge .lv{font-family:var(--f-mono);font-size:12px;color:var(--ink);cursor:pointer;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.edge .lv i{font-style:normal;font-family:var(--f-body);color:var(--muted);font-size:10.5px;margin-left:8px}
.edge>b{cursor:pointer}
.edge .ops{align-items:center}
.edge .xp{width:26px;height:26px;border:0;border-radius:7px;background:none;color:var(--muted);cursor:pointer;display:grid;place-items:center;padding:0;flex:none}
.edge .xp::after{content:"";width:6px;height:6px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg) translateY(-2px);transition:transform .18s}
.edge .xp[aria-expanded="true"]::after{transform:rotate(-135deg) translateY(-1px)}
.edge .xp:hover{color:var(--accent);background:var(--surface)}
.edge.open:not(.front){border-color:var(--line-2)}
.edge .ed{grid-column:1/-1;padding-top:2px}
.edge .ed .inp{max-width:none}
.mets.m3{grid-template-columns:repeat(3,minmax(0,1fr))}
.mets.m3 .v{font-size:17px}
.card.geoFoco{outline:2px solid var(--sel);outline-offset:2px}
.tr-geo{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;column-gap:8px;margin-top:-4px}
.tr-geo>.adv{display:contents}
.tr-geo>.adv>.advbtn{grid-row:1;grid-column:1;white-space:nowrap}
.tr-geo>.adv>.advb{grid-row:2;grid-column:1/-1;margin-top:8px}
.geoNote{grid-row:1;grid-column:2;justify-self:end;display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--warn);white-space:nowrap;min-width:0;max-width:100%}
.geoNote>span{overflow:hidden;text-overflow:ellipsis;min-width:0}
.geoNote>.btn{flex:none}
.geoNote::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--warn);flex:none}
.geoNote[hidden]{display:none}
.slh label{display:inline-flex;align-items:center;gap:6px}
.tr-res{gap:6px}
.tr-res .met{padding:7px 11px 8px}
.tr-res .met .l{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tr-res .met .l i{font-style:normal;color:var(--faint);font-weight:400}
.tr-res .met .v{font-size:17px;margin-top:1px}
.tr-res .met .v small{font-size:11.5px;font-weight:500;color:var(--muted);letter-spacing:0;margin-left:3px}
.seg.tr-meth{margin-bottom:0}
.seg.tr-meth button{padding:5px 6px;font-size:12px;flex:1 1 auto}
#edges{gap:4px}
#edges .edge{padding:4px 6px 4px 10px}
#edges .edge .xp{width:24px;height:22px}
#frBox>.row:first-child{margin-top:6px!important}
.tr-rg>.kv{gap:9px 12px}
.tr-rg>.kv .inp input{padding-top:6px;padding-bottom:6px}
.tr-acts{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.tr-rg .grp:first-child{margin-top:0}
.tr-lei{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px}
.tr-lei .adv{flex-basis:100%}
`; document.head.appendChild(s) })();
const TERRENO_LIM=[["emb","Embasamento"],["tor","Torres"],["sub","Subsolo"]];
const nfx=v=>(isFinite(+v)?+v:0).toLocaleString("pt-BR",{maximumFractionDigits:2});
const terrenoSum = {
  contorno: ()=>`${S.lote.pts.length} vértices · ${m2(G.area(S.lote.pts))}${S.lote.geo? " · no mapa" : ""}${+S.lote.norte? ` · norte ${nf(+S.lote.norte,0)}°` : ""}`,
  lados: ()=>{ const n=S.lote.front.length; return `frente L${S.lote.principal+1}${n>1? ` · ${n} lados na rua`:""}${n>1 && ladoVeiIdx(S)!==acPrincipal(S)? ` · carros pela L${ladoVeiIdx(S)+1}` : ""}` },
  lim: ()=>{ const l=TERRENO_LIM.filter(([k])=>S.custom[k]&&S.custom[k].length).map(([,n])=>n.toLowerCase()); return l.length? l.join(" · ") : "nenhuma" },
};
/* resumos das seções da lei */
const rgSum = {
  regras: ()=>{ const R=S.regras; return `${esc(S.regras.cidade||"sem cidade")} · CA ${nfx(R.caBas)}–${nfx(R.caMax)} · ${nfx(R.hMax)} m` },
  forma: ()=>{ const F=S.forma||{}; if(!F.on) return "desligada"; const l=[F.prog&&"faixas de altura", F.escalonar&&"escalonada", +F.hEmbMax>0&&"embasamento", F.aero&&"aeródromo"].filter(Boolean); return l.length? l.join(" · ") : "ligada" },
};

/* ---------------- conteúdo ---------------- */
function terrenoContornoHTML(){
  const forms = {
    desenhar: `<div class="tr-acts"><button class="btn" data-act="newDraw">Desenhar do zero</button><button class="btn ghost" data-act="rmVert" ${S.lote.pts.length>3?"":"disabled"}>Remover último vértice</button>${INFO("Clique os cantos na implantação e feche no primeiro ponto. Depois, arraste os vértices; o ponto no meio de um lado cria outro.","desenhar o lote")}</div>`,
    ret: `<div class="kv three"><div class="fld"><label class="fl" for="rf">Frente</label><div class="inp"><input id="rf" type="number" min="1" value="20"><em>m</em></div></div><div class="fld"><label class="fl" for="rp">Fundo</label><div class="inp"><input id="rp" type="number" min="1" value="40"><em>m</em></div></div><div class="fld"><span class="fl">&nbsp;</span><button class="btn" data-act="rect">Criar</button></div></div>`,
    coord: `<textarea id="coords" aria-label="Pontos do lote" placeholder="-28.6775, -49.3697&#10;-28.6777, -49.3694&#10;…"></textarea><div class="tr-acts" style="margin-top:6px"><button class="btn" data-act="coords">Importar pontos</button>${INFO("Cole um KML do Google Earth, um GeoJSON ou pontos “latitude, longitude”, um por linha. A latitude, a longitude e o norte do estudo são ajustados sozinhos.")}</div>`,
    img: `<div class="tr-acts"><label class="btn" for="bgFile" tabindex="0">${BG?"Trocar imagem":"Enviar imagem"}</label><input type="file" id="bgFile" accept="image/*" hidden>${BG?`<button class="btn" data-act="bgCal">Calibrar</button><button class="btn" data-act="newDraw">Desenhar o lote</button>`:""}${INFO("Use um print do Google Maps com a régua de escala visível. Depois de enviar, clique em dois pontos de distância conhecida (Calibrar), informe a distância real e desenhe o lote por cima. A imagem fica só nesta sessão.")}</div>`
      + (BG? `<div class="sl"><div class="slh"><label for="bgOp">Opacidade da imagem</label></div><input id="bgOp" type="range" min="0.1" max="1" step="0.05" value="${BG.op}"></div><div class="row"><button class="btn sm ghost" data-act="bgX">Remover imagem</button></div>` : ""),
    mapa: typeof mapaFormHTML==="function" ? mapaFormHTML() : ""
  };
  const metodos=[["desenhar","Desenhar","Clicar os cantos na implantação"],["ret","Retângulo","Frente × fundo"],["coord","Coordenadas","KML, GeoJSON ou latitude/longitude"],["img","Imagem","Print com escala e calibração"],["mapa","Mapa","Satélite ou OpenStreetMap"]];
  return `<div class="seg full tr-meth" role="group" aria-label="Como informar o lote">${metodos.map(([k,l,t])=>`<button type="button" data-act="tmeth" data-v="${k}" aria-pressed="${TMETH===k}" title="${t}">${l}</button>`).join("")}</div>${forms[TMETH]}`
    + `<div class="tr-geo"><span class="geoNote" id="geoNote" ${S.lote.geo?"hidden":""}><span>sem posição no mapa</span><button class="btn sm" data-act="geoMapa">Posicionar</button></span>`
    + ADV(KV(NUM("lote.lat","Latitude","°",{step:0.0001,fx:"geo",q:"localização coordenadas",help:"Origem do lote (0,0). Vem sozinha pelo Mapa ou por Coordenadas e serve ao sol, ao entorno do OpenStreetMap e aos levantamentos em lat/lon ou UTM."})+NUM("lote.lon","Longitude","°",{step:0.0001,fx:"geo",q:"localização coordenadas",help:"Origem do lote (0,0). Vem sozinha pelo Mapa ou por Coordenadas."})+NUM("lote.norte","Norte","°",{step:1,q:"orientação rotação",help:"Rotação do norte em relação ao topo da planta."}),3),
      {key:"local", label:"Posição no mapa", fechar:"Fechar posição no mapa"}) + `</div>`;
}
/* Regras da prefeitura: cidade e zona, os 8 parâmetros que mais pesam e o resto em "Mais regras" */
function terrenoRegrasHTML(){
  const F=S.forma||{}, prog=F.on&&F.prog;
  const cidade = typeof cidSeletorHTML==="function"? cidSeletorHTML() : "";
  const salvar = typeof cidSalvarHTML==="function"? cidSalvarHTML() : "";
  const principais = KV(
    NUM("regras.caBas","Aproveitamento básico","×",{step:0.05,q:"ca coeficiente aproveitamento",help:"CA básico"})+NUM("regras.caMax","Aproveitamento máximo","×",{step:0.05,q:"ca coeficiente outorga",help:"CA máximo"})+
    NUM("regras.toTorre","Ocupação da torre","%",{pct:true,step:1,q:"to taxa ocupação torres",help:"TO"})+NUM("regras.permeab","Área permeável","%",{pct:true,step:1,q:"permeabilidade taxa",help:"Permeabilidade"})+
    NUM("regras.hMax","Altura máxima","m",{step:0.5,q:"gabarito",help:"Gabarito"})+NUM("regras.vagasApto","Vagas por unidade","vg",{step:0.25,q:"garagem exigidas"})+
    NUM("regras.recFrente","Recuo frontal","m",{step:0.25,help:"Recuo"})+NUM("regras.recEmb","Recuo lateral e fundos","m",{step:0.25,q:"recuo embasamento divisas laterais",help:"Recuo do embasamento nas divisas laterais e de fundos."}));
  const mais =
    GRP("Nome e lei") + `<div data-q="cidade zona lei nome biblioteca salvar">${TXT("regras.cidade","Cidade e zona")}</div>` +
      `<div class="tr-lei">${salvar}${ADV(rgIaForm(), {key:"ia", label:"Ler a lei com IA", fechar:"Fechar leitura com IA"})}</div>` +
    GRP("Ocupação e outorga") + KV(
      NUM("regras.toEmb","Ocupação do embasamento","%",{pct:true,step:1,q:"to taxa ocupação",help:"TO"})+NUM("regras.outorgaRS","Outorga onerosa","R$/m²",{step:10,q:"outorga",help:"Outorga"})) +
    GRP("Afastamentos") +
      (prog? `<p class="note" data-q="afastamento faixas">Afastamento da torre pelas faixas de altura (seção abaixo).</p>` : "") +
      KV((prog? "" : NUM("regras.afMin","Afastamento da torre","m",{step:0.25,q:"afastamento mínimo divisas",help:"Afastamento"})+NUM("regras.afDiv","Afastamento: altura ÷","",{step:0.5,q:"afastamento altura h/n",help:"H/n"}))+
        NUM("regras.afTorresDiv","Entre torres: altura ÷","",{step:0.5,q:"afastamento torres",help:"Distância mínima entre duas torres do mesmo lote: a altura dividida por este número."})+NUM("regras.recSub","Recuo do subsolo","m",{step:0.25,q:"subsolo"})) +
    GRP("Áreas") + KV(
      NUM("regras.aptoMin","Unidade mínima","m²",{step:1,q:"apartamento área"})+NUM("regras.m2LojaVaga","Loja: 1 vaga a cada","m²",{step:5,q:"loja"})+
      NUM("regras.ncTipo","Não computável no andar","%",{pct:true,step:1,q:"não computável sacada circulação",help:"Não computável"})+NUM("regras.m2Vaga","Área bruta por vaga","m²",{step:0.5,q:"estimativa garagem",help:"Área de garagem por vaga (vaga + circulação) usada na estimativa, antes do layout real."})) +
      `<div data-q="garagem não computável">${SW("regras.ncGaragem","Garagem não computável")}</div><div data-q="hall lazer áreas comuns não computável">${SW("regras.ncTerreo","Hall, lazer e áreas comuns não computáveis")}</div>`;
  return `<div class="tr-rg">${cidade}${principais}${ADV(mais, {key:"regras", label:"Mais regras", fechar:"Menos regras"})}</div>`;
}
/* leitura da lei com IA (src/ai.js: aiRun / aiReadPdf usam estes ids) */
function rgIaForm(){
  return `<div class="fld wide"><label class="fl" for="aiZona">Cidade e zona da lei${INFO("Envie o PDF da lei de uso do solo (ou cole o trecho) e diga a zona. O Claude propõe os parâmetros para você revisar antes de aplicar.")}</label><div class="inp"><input class="t" id="aiZona" placeholder="Ex.: Criciúma, ZR-4" autocomplete="off"></div></div>
    <div class="row"><label class="btn sm" for="aiPdf" tabindex="0">Enviar PDF da lei</label><input type="file" id="aiPdf" accept="application/pdf" hidden><span class="note" id="aiPdfInfo"></span></div>
    <textarea id="aiTxt" aria-label="Trecho da lei" placeholder="…ou cole aqui a tabela de parâmetros da zona"></textarea>
    <div class="row"><button class="btn" data-act="aiGo" id="aiGo">Ler regras</button><span class="note" id="aiStatus"></span></div><div id="aiResult"></div>`;
}
function terrenoLimHTML(){
  return `<div class="list">${TERRENO_LIM.map(([k,l])=>{ const has=S.custom[k]&&S.custom[k].length; return `<div class="li"><span class="dot ${has?"ok":""}"></span><span class="tt">${l}</span><span class="row" style="gap:4px"><button class="btn sm" data-act="lim" data-k="${k}">${has?"Redesenhar":"Desenhar"}</button>${has?`<button class="btn sm ghost" data-act="limx" data-k="${k}">Limpar</button>`:""}</span></div>` }).join("")}</div>`;
}
function terrenoTopoHTML(){
  if(typeof topoCardHTML==="function") return topoCardHTML();
  return SEC("Terreno inclinado", KV(NUM("lote.desnivel","Desnível frente→fundos","m",{step:0.1})+NUM("lote.custoTerra","Movimento de terra","R$/m³",{step:1}))+`<div class="fsub" id="sub-terra"></div>`, {key:"topografia"});
}
STEP_R.terreno = ()=>({ desc:"Onde é e o que a lei permite.", after: terrenoAfter, body:
  RES("Lote e potencial", `<div class="mets tr-res" id="loteRes"></div>`, {aside:`<span id="loteSelo"></span>`}) +
  SECGRP("O lote") +
  SEC("Contorno do lote", terrenoContornoHTML(),
    {key:"contorno", open:true, sum:terrenoSum.contorno(), info:"Escolha como informar o lote: desenhando os cantos na implantação, por frente × fundo, colando coordenadas, sobre uma imagem calibrada ou no mapa de satélite. Depois, ajuste arrastando os vértices. Em “Posição no mapa”: latitude, longitude e norte, que servem ao sol, ao entorno e às ruas."}) +
  SEC("Ruas e frentes", `<div class="list" id="edges"></div>` + (typeof frHTML==="function" ? `<div id="frBox">${frHTML()}</div>` : ""),
    {key:"lados", open:true, sum:terrenoSum.lados(), info:"Marque os lados que dão para a rua e a frente principal: ela recebe lojas, hall e pedestres. Com mais de um lado na rua (esquina, lote passante), o selo “veículos” escolhe por qual deles o carro entra — as rampas começam 5 m depois do alinhamento daquele lado. A seta de cada lado abre o comprimento e os recuos próprios daquele lado. A posição das entradas fica em Projeto › Garagem."}) +
  SECGRP("A lei") +
  SEC("Regras da prefeitura", terrenoRegrasHTML(),
    {key:"regras", open:true, sum:rgSum.regras(), info:"Escolha a cidade e a zona para preencher as regras de uma vez, ou digite os valores da lei. Os exemplos são ilustrativos: confira no plano diretor (LUOS). Em “Mais regras”: nome e lei, leitura da lei com IA, ocupação do embasamento, outorga, afastamentos e áreas."}) +
  SEC("Altura e recuos por faixa", typeof formaRecuosHTML==="function"? formaRecuosHTML() : "",
    {key:"forma", sum:rgSum.forma(), info:"Recuos progressivos por faixa de altura, torres escalonadas, altura do embasamento, cota de soleira e plano de proteção de aeródromo. Desligado, valem só os recuos e afastamentos das regras."}) +
  SECGRP("Entorno") +
  terrenoTopoHTML() +
  SEC("Áreas restritas", terrenoLimHTML(),
    {key:"lim", sum:terrenoSum.lim(), info:"Para APP, servidão ou recuo escalonado: desenhe na implantação o limite onde se pode construir. Ele substitui o recuo calculado daquela parte (embasamento, torres ou subsolo)."})
});
function terrenoAfter(){
  if(typeof topoAfter==="function") topoAfter(); if(typeof mapaAfter==="function") mapaAfter();
  TB.querySelectorAll("label.btn[for]").forEach(lb=>{ if(!lb.onkeydown) lb.onkeydown=e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); const f=document.getElementById(lb.htmlFor); if(f) f.click() } } });
}
/* linha compacta de um lado: comprimento e marcações; a seta abre comprimento e recuos próprios */
function terrenoLado(i, m){
  const Lt=S.lote, fr=Lt.front.includes(i), pr=Lt.principal===i, ab=LADOAB.has(i), r=Lt.rec[i]||{}, own=r.e!=null||r.t!=null, len=G.edgeLen(Lt.pts,i), ult=(i+1)%Lt.pts.length===0;
  const fld=(id,lab,inp)=>`<div class="fld"><label class="fl" for="${id}">${lab}</label>${inp}</div>`;
  return `<div class="edge${pr?" front":""}${ab?" open":""}"><b data-act="ladoAb" data-i="${i}">L${i+1}</b><span class="lv" data-act="ladoAb" data-i="${i}">${nf(len,2)} m${own?`<i>recuo próprio</i>`:""}${typeof frLadoTag==="function"? frLadoTag(i) : ""}</span>
    <span class="ops"><button type="button" class="tag alt" data-act="front" data-i="${i}" aria-pressed="${fr}" title="${fr?"Lado na rua — clique para tirar":"Marcar como lado na rua"}">rua</button>${fr?`<button type="button" class="tag" data-act="princ" data-i="${i}" aria-pressed="${pr}" title="Frente principal: lojas, hall e pedestres">principal</button>`:""}${fr && Lt.front.length>1?`<button type="button" class="tag vei" data-act="ladoVei" data-i="${i}" aria-pressed="${ladoVeiIdx(S)===i}" title="${ladoVeiIdx(S)===i?"Os carros entram por este lado":"Fazer os carros entrarem por este lado"}">veículos</button>`:""}<button type="button" class="xp" data-act="ladoAb" data-i="${i}" aria-expanded="${ab}" aria-label="${ab?"Fechar":"Editar"} o lado L${i+1}" title="Comprimento e recuos do lado"></button></span>
    ${ab? `<div class="ed kv three">${fld("lado-len-"+i,"Comprimento",`<div class="inp"><input id="lado-len-${i}" type="number" step="0.01" min="0.1" data-len="${i}" value="${len.toFixed(2)}" ${ult?`disabled title="O último lado fecha o contorno: ajuste os outros"`:""}><em>m</em></div>`)}
      ${fld("lado-re-"+i,`Recuo emb.${INFO("Recuo do embasamento só neste lado. Vazio = regra geral (recuo frontal nas frentes; lateral/fundos nas divisas).")}`,`<div class="inp"><input id="lado-re-${i}" type="number" step="0.25" min="0" data-rec="${i}" data-rk="e" value="${r.e??""}" placeholder="${nf(fr?S.regras.recFrente:S.regras.recEmb,2)}"><em>m</em></div>`)}
      ${fld("lado-rt-"+i,"Recuo torre",`<div class="inp"><input id="lado-rt-${i}" type="number" step="0.25" min="0" data-rec="${i}" data-rk="t" value="${r.t??""}" placeholder="${nf(fr?S.regras.recFrente:m.afast,2)}"><em>m</em></div>`)}${typeof frLadoCampo==="function"? frLadoCampo(i) : ""}</div>` : ""}</div>`;
}
/* lado aberto na lista fica destacado na implantação (registrado em HOOK.draw2d por src/steps.js) */
function terrenoLadosDestaque(g, c){
  if(c.mode!=="impl" || (TAB!=="terreno" && TAB!=="regras") || !LADOAB.size) return;
  const L=S.lote.pts; g.save(); g.strokeStyle=css("--d-acc"); g.lineWidth=5; g.globalAlpha=0.5; g.lineCap="round";
  LADOAB.forEach(i=>{ if(i>=L.length) return; const a=c.w2s(L[i]), b=c.w2s(L[(i+1)%L.length]); g.beginPath(); g.moveTo(a[0],a[1]); g.lineTo(b[0],b[1]); g.stroke() });
  g.restore();
}

/* ---------------- conformidade com as regras (sem DOM) ----------------
   Linhas [rótulo, fração (0–1+, para a barra), texto "usado / limite", estado ok|warn|bad]. Produto (#compl), KPI "Regras" e o selo do Terreno. */
function rgConformidade(m, st=S){
  if(!m) return [];
  const R=st.regras, s=status(m, st), tor=(m.T||[]).reduce((a,t)=>a+(+(t.Aproj||t.A)||0),0), hL=m.hLim ?? R.hMax;
  return [
    ["Aproveitamento", m.CA/Math.max(1e-9,R.caMax), `${nf(m.CA,2)} / ${nf(R.caMax,2)}`, s.ca],
    ["Altura", m.H/Math.max(1e-9,hL), `${nf(m.H,1)} / ${nf(hL,0)} m`, s.h],
    ["Ocupação torres", tor/Math.max(1,R.toTorre*m.A), `${pct(tor/Math.max(1,m.A),0)} / ${pct(R.toTorre,0)}`, tor>R.toTorre*m.A+1?"bad":"ok"],
    ["Ocupação emb.", m.TO/Math.max(1e-9,R.toEmb), `${pct(m.TO,0)} / ${pct(R.toEmb,0)}`, m.TO>R.toEmb+1e-6?"bad":"ok"],
    ["Permeável", Math.min(1,m.perm/Math.max(1e-9,R.permeab||1e-9)), `${pct(m.perm,0)} / ${pct(R.permeab,0)}`, s.perm],
    ["Vagas", m.vagas/Math.max(1,m.vagasReq), `${m.vagas} / ${m.vagasReq}`, s.vg],
    ["Menor unidade", Math.min(1,m.minApto/Math.max(1,R.aptoMin)), `${nf(m.minApto,0)} / ${nf(R.aptoMin,0)} m²`, s.apto],
    ...(typeof formaRows==="function"? formaRows(m) : [])];
}

/* ---------------- entradas (vão para Projeto › Garagem, pacote P4) ---------------- */
function acessosSecHTML(){
  return GRP("Entradas") +
    SLD("lote.acessoPed",`Pedestres · L${acPrincipal(S)+1}`,0.05,0.95,0.01,"%",{pct:true,help:"Posição da entrada de pedestres ao longo da frente principal: 0% é o início do lado e 100% o fim."}) +
    SLD("lote.acessoVei",`Veículos · L${ladoVeiIdx(S)+1}`,0.05,0.95,0.01,"%",{pct:true,sub:"",help:"Posição da entrada de veículos (rampas e faixa da garagem) ao longo do lado marcado com “veículos” em Terreno › Ruas e frentes (padrão: a frente principal). Se cair sobre um núcleo, o hall ou as lojas, o acesso é deslocado."});
}
function acessosLive(m){
  const T=m.ter||{}, ac=m.acesso||{}, lv=ac.edgeV!=null && ac.edgeV!==ac.edge;
  setSub("lote.acessoVei", T.drive0? `${T.drive0.dv? nf(T.drive0.dv[1]-T.drive0.dv[0],1)+" m de largura (rampas"+(T.lanes?" + faixa da garagem":"")+")" : ""}${T.veiShift? " · ajustado "+nf(Math.abs(T.veiShift),1)+(lv? " m para não passar pelo hall nem pelos núcleos" : " m para não passar pelos núcleos"):""}` : "");
}

/* ---------------- partes vivas ---------------- */
function terrenoResLive(m){
  const L=S.lote.pts, n=L.length, pr=S.lote.principal, nfr=S.lote.front.length, R=S.regras;
  const po=typeof potencial==="function"? potencial(S, m) : {compMax:R.caMax*m.A, pavH:0, hLim:R.hMax};
  const met=(l,v,t)=>`<div class="met"${t?` title="${esc(t)}"`:""}><div class="l">${l}</div><div class="v">${v}</div></div>`;
  setHTML("loteRes",
    met(`Área <i>· ${n} lados</i>`, m2(m.A), `Perímetro ${nf(G.perimeter(L),1)} m`) +
    met(`Frente principal <i>· L${pr+1}</i>`, `${nf(G.edgeLen(L,pr),1)}<small>m</small>`, `${nfr} lado${nfr>1?"s":""} na rua`) +
    met(`Computável máx.${INFO("Área computável máxima: aproveitamento máximo (CA) × área do lote. Até o básico é gratuito; acima dele, paga-se outorga.","computável máximo")}`, m2(po.compMax), `CA ${nfx(R.caMax)} × ${m2(m.A)} · básico ${m2(po.compBas??R.caBas*m.A)}`) +
    met(`Altura <i>· até ${nf(po.hLim??R.hMax,0)} m</i>`, `${nf(po.pavH,0)}<small>andares</small>`, `Andares tipo que cabem na altura máxima${m.hLim!=null && m.hLim<R.hMax-1e-6? " (limitada pelo aeródromo)" : ""}`));
  const rows=rgConformidade(m), fora=rows.filter(r=>r[3]==="bad");
  const sel=document.getElementById("loteSelo");
  if(sel){ const h = fora.length? `<span class="pill bad" title="${esc(fora.map(r=>r[0]+" "+r[2]).join(" · "))}">${fora.length} fora das regras</span>` : `<span class="pill ok">dentro das regras</span>`; if(sel.innerHTML!==h) sel.innerHTML=h }
}
STEP_LIVE.terreno = (m, f, fast)=>{
  ensureRec(); const L=S.lote.pts, n=L.length, R=S.regras;
  [...LADOAB].forEach(i=>{ if(i>=n) LADOAB.delete(i) });
  setHTML("edges", L.map((_,i)=>terrenoLado(i, m)).join(""));
  if(typeof frHTML==="function") setHTML("frBox", frHTML());
  terrenoResLive(m);
  Object.entries(terrenoSum).forEach(([k,fn])=>setSum(k, fn()));
  Object.entries(rgSum).forEach(([k,fn])=>setSum(k, fn()));
  { const gn=document.getElementById("geoNote"); if(gn) gn.hidden=!!S.lote.geo }
  if(typeof topoLive==="function") topoLive(m); else setSub("terra", `Movimento de terra ≈ ${nf(m.terra,0)} m³ (inclui escavação dos subsolos)`);
  // o que era STEP_LIVE.regras: números ao lado dos campos da lei
  setSub("regras.outorgaRS", m.outA>0? `excedente ${m2(m.outA)} → ${brl(m.outA*R.outorgaRS)}` : "sem outorga neste estudo");
  setSub("regras.toEmb",`${m2(m.embA)}`);
  setSub("regras.afDiv",`H ${nf(m.H,1)} m → ${nf(m.afast,2)} m`); setSub("regras.afTorresDiv", m.T.length>1? `entre torres ${nf(m.gap,1)} m` : "só com 2+ torres");
  setSub("regras.m2Vaga",`estim. ${m.vagasEst} · layout ${m.vagasLay??"—"}`);
  if(typeof acessosLive==="function" && document.getElementById("sub-lote-acessoVei")) acessosLive(m);
  if(typeof normasLive==="function" && document.getElementById("nrmList")) normasLive(m, fast);
};
/* sem o P1, a etapa Regras ainda existe no trilho: mostra o mesmo conteúdo do Terreno (com os cards do Terreno) */
const terrenoCardsExtra = ()=>{ const tem=new Set(cardsFor("regras", null).map(c=>c.key)); return cardsFor("terreno", null).filter(c=>!tem.has(c.key)) };
STEP_R.regras = ()=>{
  const R=STEP_R.terreno(), ex=terrenoCardsExtra();
  return { ...R, title:"Terreno", body: R.body + ex.map(c=>c.html()).join(""), after: ()=>{ R.after && R.after(); ex.forEach(c=>{ if(c.after) try{ c.after() }catch(e){ console.error("[card "+c.key+"]",e) } }) } };
};
STEP_LIVE.regras = (m, f, fast)=>{ STEP_LIVE.terreno(m, f, fast); terrenoCardsExtra().forEach(c=>{ if(c.live) try{ c.live(m,f,fast) }catch(e){ console.error("[card "+c.key+"]",e) } }) };

/* ---------------- ações ---------------- */
Object.assign(ACT,{
  tmeth: b=>{ TMETH=b.dataset.v; renderTab(); if(TMETH!=="desenhar" && VIEW!=="impl") setView("impl") },
  ladoAb: b=>{ const i=+b.dataset.i; if(LADOAB.has(i)) LADOAB.delete(i); else LADOAB.add(i); if(window._last && STEP_LIVE[TAB]) STEP_LIVE[TAB](window._last.m, window._last.f); redraw2d() },
  newDraw: ()=>{ setView("impl"); DRAW=[]; setTool("draw","lote"); redraw2d(); toast("Clique nos cantos do lote e feche no primeiro ponto") },
  rmVert: ()=>{ if(S.lote.pts.length>3){ const n=S.lote.pts.length; S.lote.pts.pop(); S.lote.front=S.lote.front.filter(i=>i<n-1); S.lote.rec.length=n-1; if(!S.lote.front.length) S.lote.front=[0]; LADOAB.clear(); update(); if(S.lote.pts.length<=3) renderTab(); toast("Vértice removido") } else toast("O lote precisa de pelo menos 3 vértices") },
  rect: ()=>{ const f=Math.max(1,+document.getElementById("rf").value||20), p=Math.max(1,+document.getElementById("rp").value||40); S.lote.pts=[[0,0],[f,0],[f,p],[0,p]]; S.lote.front=[0]; S.lote.principal=0; S.lote.rec=[{},{},{},{}]; LADOAB.clear(); update(); fit2d(); fit3d(); toast(`Lote ${nf(f,1)} × ${nf(p,1)} m criado`) },
  bgCal: ()=>{ setView("impl"); setTool("calib"); toast("Clique em dois pontos de distância conhecida") },
  bgX: ()=>{ BG=null; if(TOOL==="img"||TOOL==="calib") setTool("edit"); toolSegSync(); redraw2d(); renderTab(); toast("Imagem removida") },
  coords: ()=>importCoords(document.getElementById("coords").value),
  front: b=>{ const i=+b.dataset.i; const on=!S.lote.front.includes(i); S.lote.front = on? [...new Set([...S.lote.front,i])] : S.lote.front.filter(x=>x!==i); if(!S.lote.front.length){ S.lote.front=[i]; toast("O lote precisa de pelo menos uma frente") } renderTab() },
  princ: b=>{ S.lote.principal=+b.dataset.i; renderTab() },
  // lado do acesso de veículos (src/calc/acesso.js): a frente principal volta a ser o padrão (null)
  ladoVei: b=>{ const i=+b.dataset.i, pr=acPrincipal(S); if(ladoVeiIdx(S)===i && i!==pr){ S.lote.ladoVei=null; toast(`Veículos de volta pela frente principal (L${pr+1})`) }
    else { S.lote.ladoVei = i===pr? null : i; toast(`Veículos pela L${i+1} · rampas a 5 m do alinhamento desse lado (Ctrl+Z desfaz)`) }
    S.estudo.rampa=null; renderTab() },
  lim: b=>{ setView("impl"); DRAW=[]; setTool("draw","lim:"+b.dataset.k); toast("Clique nos cantos do limite e feche no primeiro ponto") },
  limx: b=>{ if(!b.dataset.arm){ b.dataset.arm=1; b.textContent="Confirmar"; b.classList.add("on"); return } S.custom[b.dataset.k]=[]; renderTab(); update(); toast("Limite removido") },
  // "Torre ocupa o contorno desenhado" (C0): o interruptor fica em Produto › Forma das torres; a ação continua global
  torAjMix: ()=>{ const m=window._last&&window._last.m, R=m&&torOcupaResumo(S, m); if(!R||!R.A) return;
    const q=R.q; S.produto.mix.forEach((u,j)=>u.qtd=q[j]);
    update(); toast(`Mix ajustado: ${q.reduce((s,n)=>s+n,0)} unidades por andar`) },
  aiGo: ()=>aiRun(),
});
TB.addEventListener("change",e=>{
  const t=e.target, d=t.dataset||{};
  if(d.len!=null){ const i=+d.len, p=S.lote.pts, a=p[i], b=p[(i+1)%p.length], L=G.edgeLen(p,i), nl=+t.value, j=(i+1)%p.length; if(j===0){ toast("O último lado fecha o polígono: ajuste os outros"); update(); return } if(L>0&&nl>0){ const dx=(b[0]-a[0])/L, dy=(b[1]-a[1])/L, ox=a[0]+dx*nl-b[0], oy=a[1]+dy*nl-b[1]; for(let q=j;q<p.length;q++) p[q]=[p[q][0]+ox,p[q][1]+oy]; update() } }
  else if(d.rec!=null){ ensureRec(); S.lote.rec[+d.rec][d.rk] = t.value===""? null : Math.max(0,+t.value); update() }
  else if(t.id==="bgFile"){ const f=t.files[0]; if(!f) return; const url=URL.createObjectURL(f), img=new Image(); img.onload=()=>{ const c=G.centroid(S.lote.pts), mpp=120/img.width; BG={img,mpp,op:0.8,x:c[0]-img.width*mpp/2,y:c[1]+img.height*mpp/2}; setView("impl"); fitBG(); setTool("calib"); renderTab() }; img.src=url }
  else if(t.id==="aiPdf") aiReadPdf(e); });
TB.addEventListener("input",e=>{ if(e.target.id==="bgOp" && BG){ BG.op=+e.target.value; redraw2d() } });
