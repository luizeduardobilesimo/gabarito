/* ================= etapa Terreno (e Regras) =================
   Separado de src/steps.js (UX v3, P0), sem mudar comportamento. Aqui: STEP_R/STEP_LIVE.terreno e .regras, terrenoLado,
   terrenoSum, rg* (Regras: Prefeitura · Projeto · Normas, busca de parâmetros) e as ações (ACT) das duas etapas.
   O destaque dos lados abertos na implantação é registrado em src/steps.js (terrenoLadosDestaque), para manter a ordem do desenho. */
let TMETH = "desenhar", RECLADO = false;

/* ---------------- 1. Terreno ----------------
   Resultado (área, perímetro, frente) no topo; essenciais abertos: contorno do lote e lados/frentes/acessos;
   localização, topografia, limites especiais e entorno em seções fechadas com resumo (docs/UX.md). */
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
.card.geoFoco{outline:2px solid var(--brand);outline-offset:2px}
.geoNote{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.geoNote .note{margin:0}
.mets.m3 .v{font-size:17px}
.slh label{display:inline-flex;align-items:center;gap:6px}
#compl .ur{grid-template-columns:100px 1fr 94px}
#compl .ur span:last-child{white-space:nowrap}
`; document.head.appendChild(s) })();
const TERRENO_LIM=[["emb","Embasamento"],["tor","Torres"],["sub","Subsolo"]];
const terrenoSum = {
  contorno: ()=>`${S.lote.pts.length} vértices · ${m2(G.area(S.lote.pts))}`,
  lados: ()=>{ const n=S.lote.front.length; return `frente L${S.lote.principal+1}${n>1? ` · ${n} lados na rua`:""}` },
  local: ()=>S.lote.geo? `${nf(+S.lote.lat||0,4)}, ${nf(+S.lote.lon||0,4)} · norte ${nf(+S.lote.norte||0,0)}°` : `sem posição no mapa · norte ${nf(+S.lote.norte||0,0)}°`,
  lim: ()=>{ const l=TERRENO_LIM.filter(([k])=>S.custom[k]&&S.custom[k].length).map(([,n])=>n.toLowerCase()==="torres" && S.custom.torOcupa? "torres (planta)" : n.toLowerCase()); return l.length? l.join(" · ") : "nenhum" },
};
STEP_R.terreno = ()=>{
  const forms = {
    desenhar: `<div class="row"><button class="btn pri" data-act="newDraw">Desenhar do zero</button><button class="btn" data-act="rmVert" ${S.lote.pts.length>3?"":"disabled"}>Remover último vértice</button></div>
      <p class="note">Arraste os vértices; o ponto no meio de um lado cria outro.</p>`,
    ret: `<div class="kv three"><div class="fld"><label class="fl" for="rf">Frente</label><div class="inp"><input id="rf" type="number" min="1" value="20"><em>m</em></div></div><div class="fld"><label class="fl" for="rp">Fundo</label><div class="inp"><input id="rp" type="number" min="1" value="40"><em>m</em></div></div><div class="fld"><span class="fl">&nbsp;</span><button class="btn pri" data-act="rect">Criar</button></div></div>`,
    coord: `<textarea id="coords" aria-label="Pontos do lote" placeholder="-28.6775, -49.3697&#10;-28.6777, -49.3694&#10;…"></textarea><div class="row"><button class="btn pri" data-act="coords">Importar pontos</button>${INFO("Cole um KML do Google Earth, um GeoJSON ou pontos “latitude, longitude”, um por linha. A latitude, a longitude e o norte do estudo são ajustados sozinhos.")}</div>`,
    img: `<div class="row"><label class="btn${BG?"":" pri"}" for="bgFile" tabindex="0">${BG?"Trocar imagem":"Enviar imagem"}</label><input type="file" id="bgFile" accept="image/*" hidden>${BG?`<button class="btn" data-act="bgCal">Calibrar</button><button class="btn" data-act="newDraw">Desenhar o lote</button>`:""}${INFO("Use um print do Google Maps com a régua de escala visível. Depois de enviar, clique em dois pontos de distância conhecida (Calibrar), informe a distância real e desenhe o lote por cima. A imagem fica só nesta sessão.")}</div>`
      + (BG? `<div class="sl"><div class="slh"><label for="bgOp">Opacidade da imagem</label></div><input id="bgOp" type="range" min="0.1" max="1" step="0.05" value="${BG.op}"></div><div class="row"><button class="btn sm ghost" data-act="bgX">Remover imagem</button></div>` : ""),
    mapa: typeof mapaFormHTML==="function" ? mapaFormHTML() : ""
  };
  const metodos=[["desenhar","Desenhar","Clicar os cantos na implantação"],["ret","Retângulo","Frente × fundo"],["coord","Coordenadas","KML, GeoJSON ou latitude/longitude"],["img","Imagem","Print com escala e calibração"],["mapa","Mapa","Satélite ou OpenStreetMap"]];
  return { after: terrenoAfter, body:
    RES("Lote", `<div class="mets m3" id="loteRes"></div>`) +
    SEC("Contorno do lote", `<div class="seg full" role="group" aria-label="Como informar o lote">${metodos.map(([k,l,t])=>`<button type="button" data-act="tmeth" data-v="${k}" aria-pressed="${TMETH===k}" title="${t}" style="padding:5px 4px">${l}</button>`).join("")}</div>${forms[TMETH]}`,
      {key:"contorno", open:true, sum:terrenoSum.contorno(), info:"Escolha como informar o lote: desenhando os cantos na implantação, por frente × fundo, colando coordenadas, sobre uma imagem calibrada ou no mapa de satélite. Depois, ajuste arrastando os vértices."}) +
    SEC("Lados e frentes", `<div class="list" id="edges"></div>` + (typeof frHTML==="function" ? `<div id="frBox">${frHTML()}</div>` : "") + GRP("Acessos") +
      SLD("lote.acessoPed",`Pedestres · L${acPrincipal(S)+1}`,0.05,0.95,0.01,"%",{pct:true,help:"Posição da entrada de pedestres ao longo da frente principal: 0% é o início do lado e 100% o fim."}) +
      SLD("lote.acessoVei",`Veículos · L${ladoVeiIdx(S)+1}`,0.05,0.95,0.01,"%",{pct:true,sub:"",help:"Posição da entrada de veículos (rampas e faixa da garagem) ao longo do lado marcado com “veículos” (padrão: a frente principal). Se cair sobre um núcleo, o hall ou as lojas, o acesso é deslocado."}),
      {key:"lados", open:true, sum:terrenoSum.lados(), info:"Marque os lados que dão para a rua e a frente principal (amarela): ela recebe lojas, hall e pedestres. Com mais de um lado na rua (esquina, lote passante), o selo “veículos” escolhe por qual deles o carro entra — as rampas começam 5 m depois do alinhamento daquele lado e nunca cruzam o hall. A seta de cada lado abre o comprimento e os recuos próprios daquele lado."}) +
    SEC("Localização", `<div class="geoNote" id="geoNote" ${S.lote.geo?"hidden":""}><span class="note">Lote sem posição no mapa.</span><button class="btn sm pri" data-act="geoMapa">Posicionar no mapa</button></div>` + KV(NUM("lote.lat","Latitude","°",{step:0.0001,fx:"geo",help:"Origem do lote (0,0). Vem sozinha pelo Mapa ou por Coordenadas e serve ao sol, ao entorno do OpenStreetMap e aos levantamentos em lat/lon ou UTM."})+NUM("lote.lon","Longitude","°",{step:0.0001,fx:"geo",help:"Origem do lote (0,0). Vem sozinha pelo Mapa ou por Coordenadas."})+NUM("lote.norte","Norte","°",{step:1,help:"Rotação do norte em relação ao topo da planta."})),
      {key:"local", sum:terrenoSum.local()}) +
    (typeof topoCardHTML==="function" ? topoCardHTML() : SEC("Topografia", KV(NUM("lote.desnivel","Desnível frente→fundos","m",{step:0.1})+NUM("lote.custoTerra","Movimento de terra","R$/m³",{step:1}))+`<div class="fsub" id="sub-terra"></div>`, {key:"topografia"})) +
    SEC("Limites especiais", `<div class="list">${TERRENO_LIM.map(([k,l])=>{ const has=S.custom[k]&&S.custom[k].length; return `<div class="li"><span class="dot ${has?"ok":""}"></span><span class="tt">${l}</span><span class="row" style="gap:4px"><button class="btn sm" data-act="lim" data-k="${k}">${has?"Redesenhar":"Desenhar"}</button>${has?`<button class="btn sm ghost" data-act="limx" data-k="${k}">Limpar</button>`:""}</span></div>` }).join("")}</div>`
      + (S.custom.tor && S.custom.tor.length ? `<div class="row" style="gap:6px;margin-top:8px">${SW("custom.torOcupa","Torre ocupa o contorno desenhado",{rr:true})}${INFO("Desligado, o limite das torres é só um teto: a torre fica do tamanho do mix dentro dele. Ligado, o contorno (recortado pelos recuos) vira a planta do andar tipo e as unidades do mix crescem ou encolhem até preenchê-lo. “Ajustar mix” muda a quantidade de unidades por andar para elas voltarem ao tamanho do mix.")}</div>${S.custom.torOcupa? `<div class="fsub" id="torOcupa"></div>` : ""}` : ""),
      {key:"lim", sum:terrenoSum.lim(), info:"Para APP, servidão ou recuo escalonado: desenhe na implantação o limite onde se pode construir. Ele substitui o recuo calculado daquela parte (embasamento, torres ou subsolo)."})
  };
};
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
  if(c.mode!=="impl" || TAB!=="terreno" || !LADOAB.size) return;
  const L=S.lote.pts; g.save(); g.strokeStyle=css("--d-acc"); g.lineWidth=5; g.globalAlpha=0.5; g.lineCap="round";
  LADOAB.forEach(i=>{ if(i>=L.length) return; const a=c.w2s(L[i]), b=c.w2s(L[(i+1)%L.length]); g.beginPath(); g.moveTo(a[0],a[1]); g.lineTo(b[0],b[1]); g.stroke() });
  g.restore();
}
STEP_LIVE.terreno = (m)=>{
  ensureRec(); const L=S.lote.pts, n=L.length, nfr=S.lote.front.length, pr=S.lote.principal;
  [...LADOAB].forEach(i=>{ if(i>=n) LADOAB.delete(i) });
  setHTML("edges", L.map((_,i)=>terrenoLado(i, m)).join(""));
  if(typeof frHTML==="function") setHTML("frBox", frHTML());
  const met=(l,v,s)=>`<div class="met"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
  setHTML("loteRes", met("Área", m2(m.A), `${n} lados`) + met("Perímetro", nf(G.perimeter(L),1)+" m", `${nfr} lado${nfr>1?"s":""} na rua`) + met("Frente principal", `L${pr+1}`, `${nf(G.edgeLen(L,pr),1)} m`));
  Object.entries(terrenoSum).forEach(([k,f])=>setSum(k, f()));
  { const gn=document.getElementById("geoNote"); if(gn) gn.hidden=!!S.lote.geo }
  { const T=m.ter||{}, ac=m.acesso||{}, lv=ac.edgeV!=null && ac.edgeV!==ac.edge; setSub("lote.acessoVei", T.drive0? `${T.drive0.dv? nf(T.drive0.dv[1]-T.drive0.dv[0],1)+" m de largura (rampas"+(T.lanes?" + faixa da garagem":"")+")" : ""}${T.veiShift? " · ajustado "+nf(Math.abs(T.veiShift),1)+(lv? " m para não passar pelo hall nem pelos núcleos" : " m para não passar pelos núcleos"):""}` : "") }
  if(typeof topoLive==="function") topoLive(m); else setSub("terra", `Movimento de terra ≈ ${nf(m.terra,0)} m³ (inclui escavação dos subsolos)`);
  { const R=torOcupaResumo(S, m), ajuste=R && R.A>0 && R.muda && Math.abs(R.r-1)>0.03;
    setHTML("torOcupa", !R ? "" : !R.A ? "O contorno ficou vazio depois dos recuos." :
      `<span>${R.desiguais? R.As.map(a=>m2(a)).join(" e ") : m2(R.A)}/andar${R.real? ` · eficiência real ${pct(R.efic,0)} (informada ${pct(R.eficInf,0)})${INFO("Eficiência real da planta")}` : ""} · unidades com ${nf(R.media,0)} m² em média (mix: ${nf(R.mixMedia,0)} m²)</span>${ajuste? ` <button type="button" class="btn sm" data-act="torAjMix" style="margin-left:6px">Ajustar mix</button>` : ""}`) }
};
Object.assign(ACT,{
  tmeth: b=>{ TMETH=b.dataset.v; renderTab(); if(TMETH!=="desenhar" && VIEW!=="impl") setView("impl") },
  ladoAb: b=>{ const i=+b.dataset.i; if(LADOAB.has(i)) LADOAB.delete(i); else LADOAB.add(i); if(window._last) STEP_LIVE.terreno(window._last.m); redraw2d() },
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
  torAjMix: ()=>{ const m=window._last&&window._last.m, R=m&&torOcupaResumo(S, m); if(!R||!R.A) return;
    const q=R.q; S.produto.mix.forEach((u,j)=>u.qtd=q[j]);
    update(); toast(`Mix ajustado: ${q.reduce((s,n)=>s+n,0)} unidades por andar`) },
});
TB.addEventListener("change",e=>{
  const t=e.target, d=t.dataset||{};
  if(d.len!=null){ const i=+d.len, p=S.lote.pts, a=p[i], b=p[(i+1)%p.length], L=G.edgeLen(p,i), nl=+t.value, j=(i+1)%p.length; if(j===0){ toast("O último lado fecha o polígono: ajuste os outros"); update(); return } if(L>0&&nl>0){ const dx=(b[0]-a[0])/L, dy=(b[1]-a[1])/L, ox=a[0]+dx*nl-b[0], oy=a[1]+dy*nl-b[1]; for(let q=j;q<p.length;q++) p[q]=[p[q][0]+ox,p[q][1]+oy]; update() } }
  else if(d.rec!=null){ ensureRec(); S.lote.rec[+d.rec][d.rk] = t.value===""? null : Math.max(0,+t.value); update() }
  else if(t.id==="bgFile"){ const f=t.files[0]; if(!f) return; const url=URL.createObjectURL(f), img=new Image(); img.onload=()=>{ const c=G.centroid(S.lote.pts), mpp=120/img.width; BG={img,mpp,op:0.8,x:c[0]-img.width*mpp/2,y:c[1]+img.height*mpp/2}; setView("impl"); fitBG(); setTool("calib"); renderTab() }; img.src=url }
  else if(t.id==="cidSel"){ if(t.value==="") return; const c=(LS.get("gabarito.cidades")||[])[+t.value]; if(c){ S.regras=merge(clone(DEF.regras), c.regras); renderTab(); toast("Regras carregadas: "+c.nome) } }
  else if(t.id==="aiPdf") aiReadPdf(e); });
TB.addEventListener("input",e=>{ if(e.target.id==="bgOp" && BG){ BG.op=+e.target.value; redraw2d() } });

/* ---------------- 2. Regras e padrões ---------------- */
/* Sub-abas: Prefeitura (o que a lei limita) · Projeto (padrões do produto) · Normas (checklist preliminar).
   A busca no cabeçalho filtra a aba atual e aponta as outras abas que também têm o termo. */
const RG_TABS=[["pref","Prefeitura"],["proj","Projeto"],["normas","Normas"]];
let RGQ="", RGABERTOS=[];   // busca e as seções/“mais opções” que a busca abriu
const nfx=v=>(isFinite(+v)?+v:0).toLocaleString("pt-BR",{maximumFractionDigits:2});
const rgSum = {
  cidade: ()=>esc(S.regras.cidade||"sem cidade"),
  potencial: ()=>{ const R=S.regras; return `CA ${nfx(R.caBas)}–${nfx(R.caMax)} · TO ${pct(R.toTorre,0)} · ${nfx(R.hMax)} m` },
  recuos: ()=>{ const R=S.regras, F=S.forma||{}; return `frontal ${nfx(R.recFrente)} m · divisas ${nfx(R.recEmb)} m${F.on&&F.prog? " · torre por faixas" : ` · torre H÷${nfx(R.afDiv)}`}` },
  forma: ()=>{ const F=S.forma||{}; if(!F.on) return "desligada"; const l=[F.prog&&"faixas de altura", F.escalonar&&"escalonada", +F.hEmbMax>0&&"embasamento", F.aero&&"aeródromo"].filter(Boolean); return l.length? l.join(" · ") : "ligada" },
  vagas: ()=>{ const R=S.regras; return `${nfx(R.vagasApto)} vaga/unidade · mín. ${nfx(R.aptoMin)} m²` },
  pes: ()=>{ const P=S.produto; return `térreo ${nfx(P.peTerreo)} · garagem ${nfx(P.peGar)} · tipo ${nfx(P.pe)} m` },
  ptipo: ()=>`eficiência do andar ${pct(S.produto.efic,0)} · corredor ${nfx(S.estudo.corrTipo)} m`,
  vaga: ()=>{ const E=S.estudo; return `${nfx(E.vagaL)} × ${nfx(E.vagaC)} m · corredor ${nfx(E.corredor)} m` },
  rampa: ()=>{ const E=S.estudo; return `${pct(E.rampaInc,0)} · PCD ${pct(E.pcd,0)} · idoso ${pct(E.idoso,0)}` },
};
function rgIaHTML(){
  return ADV(`<div class="fld wide"><label class="fl" for="aiZona">Cidade e zona da lei${INFO("Envie o PDF da lei de uso do solo (ou cole o trecho) e diga a zona. O Claude propõe os parâmetros para você revisar antes de aplicar.")}</label><div class="inp"><input class="t" id="aiZona" placeholder="Ex.: Criciúma, ZR-4" autocomplete="off"></div></div>
      <div class="row"><label class="btn sm" for="aiPdf" tabindex="0">Enviar PDF da lei</label><input type="file" id="aiPdf" accept="application/pdf" hidden><span class="note" id="aiPdfInfo"></span></div>
      <textarea id="aiTxt" aria-label="Trecho da lei" placeholder="…ou cole aqui a tabela de parâmetros da zona"></textarea>
      <div class="row"><button class="btn pri" data-act="aiGo" id="aiGo">Ler regras</button><span class="note" id="aiStatus"></span></div><div id="aiResult"></div>`, {key:"ia", label:"Ler o plano diretor com IA"});
}
function rgPref(){
  const R=S.regras, F=S.forma||{}, prog=F.on&&F.prog, cid=LS.get("gabarito.cidades")||[];
  const cidade = typeof cidadesCardHTML==="function"? cidadesCardHTML() : TXT("regras.cidade","Cidade / zona")+`<div class="row" style="flex-wrap:nowrap"><select class="sel" id="cidSel" aria-label="Regras salvas"><option value="">Carregar regras salvas…</option>${cid.map((c,i)=>`<option value="${i}">${esc(c.nome)}</option>`).join("")}</select><button class="btn" data-act="cidSave">Salvar</button></div>`;
  return RES("Conformidade", `<div class="use" id="compl"></div>`, {aside:`<span id="complTxt"></span>`}) +
    SEC("Cidade e zona", `<div data-q="cidade zona lei plano diretor biblioteca salvar">${cidade}</div>` + `<div data-q="ia plano diretor pdf lei ler">${rgIaHTML()}</div>`,
      {key:"cidade", open:true, sum:rgSum.cidade(), info:"Escolha a cidade e a zona para preencher as regras de uma vez, ou digite os valores da lei. Os exemplos são ilustrativos: confira no plano diretor (LUOS) e salve para reaproveitar."}) +
    SEC("Potencial construtivo", KV(
      NUM("regras.caBas","CA básico","×",{step:0.05,q:"coeficiente aproveitamento",help:"CA básico"})+NUM("regras.caMax","CA máximo","×",{step:0.05,q:"coeficiente outorga",help:"CA máximo"})+
      NUM("regras.toEmb","TO embasamento","%",{pct:true,step:1,q:"taxa ocupação",help:"TO"})+NUM("regras.toTorre","TO torres","%",{pct:true,step:1,q:"taxa ocupação",help:"TO"})+
      NUM("regras.hMax","Altura máxima","m",{step:0.5,q:"gabarito",help:"Gabarito"})+NUM("regras.permeab","Permeabilidade","%",{pct:true,step:1,help:"Permeabilidade"})) +
      ADV(KV(NUM("regras.outorgaRS","Outorga onerosa","R$/m²",{step:10,wide:true,q:"outorga",help:"Outorga"})), {key:"outorga"}),
      {key:"potencial", open:true, sum:rgSum.potencial()}) +
    SEC("Recuos e afastamentos", KV(
      NUM("regras.recFrente","Recuo frontal","m",{step:0.25,help:"Recuo"})+NUM("regras.recEmb","Laterais e fundos","m",{step:0.25,q:"recuo embasamento divisas",help:"Recuo do embasamento nas divisas laterais e de fundos."})+
      (prog? "" : NUM("regras.afMin","Afastamento da torre","m",{step:0.25,q:"afastamento mínimo",help:"Afastamento"})+NUM("regras.afDiv","Torre às divisas: H ÷","",{step:0.5,q:"afastamento altura",help:"H/n"}))) +
      (prog? `<p class="note">Afastamento da torre por faixas de altura, em Forma do edifício.</p>` : "") +
      ADV(KV(NUM("regras.afTorresDiv","Entre torres: H ÷","",{step:0.5,q:"afastamento torres",help:"Distância mínima entre duas torres do mesmo lote: a altura dividida por este número."})+NUM("regras.recSub","Recuo do subsolo","m",{step:0.25,q:"subsolo"})), {key:"recuos"}),
      {key:"recuos", sum:rgSum.recuos()}) +
    SEC("Forma do edifício", typeof formaRecuosHTML==="function"? formaRecuosHTML() : "", {key:"forma", sum:rgSum.forma(), info:"Recuos progressivos por faixa de altura, torres escalonadas, altura do embasamento, cota de soleira e plano de proteção de aeródromo. Desligado, valem só os recuos e afastamentos acima."}) +
    SEC("Vagas e áreas", KV(
      NUM("regras.vagasApto","Vagas por unidade","vg",{step:0.25,q:"garagem"})+NUM("regras.m2LojaVaga","Loja: 1 vaga a cada","m²",{step:5,q:"loja"})+
      NUM("regras.aptoMin","Unidade mínima","m²",{step:1,q:"apartamento área"})+NUM("regras.ncTipo","Não comput. no tipo","%",{pct:true,step:1,q:"não computável sacada circulação",help:"Não computável"})) +
      `<div data-q="garagem não computável">${SW("regras.ncGaragem","Garagem não computável")}</div><div data-q="hall lazer áreas comuns não computável">${SW("regras.ncTerreo","Hall, lazer e áreas comuns não computáveis")}</div>` +
      ADV(KV(NUM("regras.m2Vaga","Área bruta por vaga","m²",{step:0.5,q:"estimativa garagem",help:"Área de garagem por vaga (vaga + circulação) usada na estimativa, antes do layout real."})), {key:"vagas"}),
      {key:"vagas", sum:rgSum.vagas()});
}
function rgProj(){
  return RES("No estudo", `<div class="mets m3" id="rgpRes"></div>`) +
    SEC("Pés-direitos", KV(NUM("produto.peTerreo","Térreo","m",{step:0.1,q:"pé-direito"})+NUM("produto.peGar","Garagem","m",{step:0.05,q:"pé-direito"})+NUM("produto.pe","Tipo","m",{step:0.05,q:"pé-direito"}),3),
      {key:"pes", open:true, sum:rgSum.pes(), info:"Pé-direito"}) +
    SEC("Pavimento tipo", KV(NUM("produto.efic","Eficiência do andar","%",{pct:true,step:1,q:"privativa eficiência",help:"Eficiência"})+NUM("estudo.corrTipo","Corredor / hall","m",{step:0.05})+NUM("estudo.profMin","Prof. mín. unidade","m",{step:0.25,q:"profundidade"})+NUM("produto.sacProf","Prof. da sacada","m",{step:0.1,help:"Sacada"})),
      {key:"ptipo", open:true, sum:rgSum.ptipo()}) +
    SEC("Vaga e circulação", KV(NUM("estudo.vagaL","Largura vaga","m",{step:0.05})+NUM("estudo.vagaC","Compr. vaga","m",{step:0.05,q:"comprimento"})+NUM("estudo.corredor","Corredor 90°","m",{step:0.1,q:"manobra"}),3) +
      ADV(KV(NUM("estudo.porModulo","Vagas entre pilares","vg",{step:1,int:true,q:"módulo"})+NUM("estudo.pilar","Pilar","m",{step:0.05})+NUM("estudo.rampaL","Largura rampa","m",{step:0.05}),3), {key:"vaga"}),
      {key:"vaga", sum:rgSum.vaga()}) +
    SEC("Rampa e acessibilidade", KV(NUM("estudo.rampaInc","Inclinação rampa","%",{pct:true,step:1})+NUM("estudo.pcd","Vagas PCD","%",{pct:true,step:1,help:"Vaga PCD"})+NUM("estudo.idoso","Vagas idosos","%",{pct:true,step:1,help:"Vaga idoso"}),3),
      {key:"rampa", sum:rgSum.rampa()});
}
const RG_BODY={ pref:rgPref, proj:rgProj, normas:()=> typeof normasCardHTML==="function"? normasCardHTML() : "" };
function rgBuscaHTML(){
  return `<div class="inp" style="margin-top:8px;background:var(--surface)"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style="margin-left:10px;flex:none;fill:none;stroke:var(--muted);stroke-width:1.8"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/></svg><input class="t" id="rgFind" value="${esc(RGQ)}" placeholder="Buscar parâmetro — recuo, CA, vaga, pé-direito…" aria-label="Buscar parâmetro" autocomplete="off"></div><div class="row" id="rgFindOut" style="margin-top:6px;gap:6px" hidden></div>`;
}
STEP_R.regras = ()=>{
  const tabs=SUBTABS("regras", RG_TABS), k=subAtual("regras");
  return { sub: tabs + rgBuscaHTML(), subKey:k, body: RG_BODY[k](), after: ()=>{ terrenoAfter(); RGABERTOS=[]; rgFiltra() } };
};
/* busca: esconde o que não bate, abre seções e "mais opções" que batem (e fecha de novo ao limpar) e aponta as outras abas */
function rgFiltra(){
  const q=RGQ.trim().toLowerCase(), out=document.getElementById("rgFindOut");
  RGABERTOS.forEach(e=>{ if(e.tagName==="DETAILS") e.open=false; else e.hidden=true }); RGABERTOS=[];
  TB.querySelectorAll("[data-q]").forEach(f=>{ f.hidden=!!q && !f.dataset.q.includes(q) });
  TB.querySelectorAll(":scope > .card").forEach(c=>{
    if(!q){ c.hidden=false; return }
    const tem=[...c.querySelectorAll("[data-q]")].some(f=>!f.hidden); c.hidden=!tem;
    if(tem && c.tagName==="DETAILS" && !c.open){ c.open=true; RGABERTOS.push(c) }
    if(tem) c.querySelectorAll(".advb[hidden]").forEach(a=>{ if([...a.querySelectorAll("[data-q]")].some(f=>!f.hidden)){ a.hidden=false; RGABERTOS.push(a) } });
  });
  if(!out) return;
  if(!q){ out.hidden=true; out.innerHTML=""; return }
  const cur=subAtual("regras"), conta=k=>{ let n=0; RG_BODY[k]().replace(/data-q="([^"]*)"/g,(_,s)=>{ if(s.includes(esc(q))) n++; return "" }); return n };
  const aqui=[...TB.querySelectorAll("[data-q]")].filter(f=>!f.hidden && !f.querySelector("[data-q]")).length;
  const outras=RG_TABS.filter(([k])=>k!==cur).map(([k,l])=>[k,l,conta(k)]).filter(x=>x[2]);
  out.hidden=false;
  out.innerHTML=`<span class="note">${aqui? `${aqui} aqui` : "Nada nesta aba"}${outras.length?" · também em":""}</span>` + outras.map(([k,l,n])=>`<button type="button" class="tag" data-act="subx" data-s="regras" data-v="${k}">${l} (${n})</button>`).join("");
}
document.getElementById("phead").addEventListener("input", e=>{ if(e.target.id==="rgFind"){ RGQ=e.target.value; rgFiltra() } });
document.getElementById("phead").addEventListener("keydown", e=>{ if(e.target.id==="rgFind" && e.key==="Escape" && RGQ){ e.stopPropagation(); RGQ=""; e.target.value=""; rgFiltra() } });
STEP_LIVE.regras = (m,f,fast)=>{
  const R=S.regras, s=status(m,S), tor=m.T.reduce((a,t)=>a+t.A,0);
  if(typeof normasLive==="function" && document.getElementById("nrmList")) normasLive(m, fast);
  Object.entries(rgSum).forEach(([k,fn])=>setSum(k, fn()));
  { const met=(l,v,sb)=>`<div class="met"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${sb}</div></div>`;
    setHTML("rgpRes", met("Altura", nf(m.H,1)+" m", `máx. ${nfx(R.hMax)} m`) + met("Privativa", m2(m.priv), `${m.units} unidades`) + met("Vagas", `${m.vagas}`, `exigidas ${m.vagasReq}`)) }
  const rows=[
    ["CA", m.CA/Math.max(1e-9,R.caMax), `${nf(m.CA,2)} / ${nf(R.caMax,2)}`, s.ca],
    ["Ocupação emb.", m.TO/Math.max(1e-9,R.toEmb), `${pct(m.TO,0)} / ${pct(R.toEmb,0)}`, m.TO>R.toEmb+1e-6?"bad":"ok"],
    ["Ocupação torres", tor/Math.max(1,R.toTorre*m.A), `${pct(tor/Math.max(1,m.A),0)} / ${pct(R.toTorre,0)}`, tor>R.toTorre*m.A+1?"bad":"ok"],
    ["Altura", m.H/Math.max(1e-9,R.hMax), `${nf(m.H,1)} / ${nf(R.hMax,0)} m`, s.h],
    ["Permeável", Math.min(1,m.perm/Math.max(1e-9,R.permeab||1e-9)), `${pct(m.perm,0)} / ${pct(R.permeab,0)}`, s.perm],
    ["Vagas", m.vagas/Math.max(1,m.vagasReq), `${m.vagas} / ${m.vagasReq}`, s.vg],
    ["Menor unidade", Math.min(1,m.minApto/Math.max(1,R.aptoMin)), `${nf(m.minApto,0)} / ${nf(R.aptoMin,0)} m²`, s.apto],
    ...(typeof formaRows==="function"? formaRows(m) : [])];
  setHTML("compl", rows.map(r=>useRow(r[0],r[1],r[2],r[3]==="ok"?"ok":r[3])).join(""));
  const bad=Object.values(s).filter(x=>x==="bad").length; const ct=document.getElementById("complTxt"); if(ct) ct.innerHTML = bad? `<span style="color:var(--bad)">${bad} fora do limite</span>` : `<span style="color:var(--ok)">tudo dentro</span>`;
  setSub("regras.caMax",`máx. ${m2(R.caMax*m.A)} · usado ${m2(m.comp)}`);
  setSub("regras.caBas",`sem outorga ${m2(R.caBas*m.A)}`);
  setSub("regras.outorgaRS", m.outA>0? `excedente ${m2(m.outA)} → ${brl(m.outA*R.outorgaRS)}` : "sem outorga neste estudo");
  setSub("regras.toEmb",`${m2(m.embA)}`); setSub("regras.toTorre",`${m2(tor)} de ${m2(R.toTorre*m.A)}`);
  setSub("regras.afDiv",`H ${nf(m.H,1)} m → ${nf(m.afast,2)} m`); setSub("regras.afTorresDiv", m.T.length>1? `entre torres ${nf(m.gap,1)} m` : "só com 2+ torres");
  setSub("regras.hMax",`estudo ${nf(m.H,1)} m`); setSub("regras.m2Vaga",`estim. ${m.vagasEst} · layout ${m.vagasLay??"—"}`);
};
Object.assign(ACT,{
  // cidSave / cidUndo e o seletor "Aplicar regras de…" ficam em src/ui/normas.js (biblioteca em src/calc/cidades.js)
  aiGo: ()=>aiRun(),
});
