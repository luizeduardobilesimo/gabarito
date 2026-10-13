/* ================= conteúdo de cada etapa ================= */
let TMETH = "desenhar", RECLADO = false;
const MESES=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const hhmm=v=>{ const h=Math.floor(v), m=Math.round((v-h)*60); return `${h}h${String(m).padStart(2,"0")}` };
const bar=(v,st)=>`<div class="bar ${st||""}"><i style="width:${Math.max(2,Math.min(100,v*100)).toFixed(1)}%"></i></div>`;
const useRow=(l,v,txt,st)=>`<div class="ur"><span>${l}</span>${bar(v,st)}<span>${txt}</span></div>`;

const STEP_R = {};
const STEP_LIVE = {};

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
.card.geoFoco{outline:2px solid var(--mark);outline-offset:2px}
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
/* lado aberto na lista fica destacado na implantação */
HOOK.draw2d.push((g, c)=>{
  if(c.mode!=="impl" || TAB!=="terreno" || !LADOAB.size) return;
  const L=S.lote.pts; g.save(); g.strokeStyle=css("--accent"); g.lineWidth=5; g.globalAlpha=0.5; g.lineCap="round";
  LADOAB.forEach(i=>{ if(i>=L.length) return; const a=c.w2s(L[i]), b=c.w2s(L[(i+1)%L.length]); g.beginPath(); g.moveTo(a[0],a[1]); g.lineTo(b[0],b[1]); g.stroke() });
  g.restore();
});
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
  else if(t.id==="aiPdf") aiReadPdf(e);
  else if(t.id==="jsonIn"){ const f=t.files[0]; if(!f) return; f.text().then(x=>{ try{ const o=JSON.parse(x); S=merge(clone(DEF), o.S||o); document.getElementById("projName").value=S.nome; renderTab(); fit3d(); fit2d(); toast("Projeto aberto") }catch(err){ toast("Arquivo inválido") } }) }});
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

/* ---------------- 3. Produto ---------------- */
/* STEP_R.produto, STEP_LIVE.produto, otimHTML, OTRUN e as ações da etapa ficam em src/ui/produto.js (UX v2) */

/* ---------------- 4. Viabilidade ---------------- */
/* sub-abas: Resultado · Premissas · Riscos · Vendas — conteúdo e partes vivas em src/ui/financeiro.js (finViabHTML/finViabLive); Vendas = cards de src/ui/vendas.js */
STEP_R.viab = ()=>{
  const sub=SUBTABS("viab",[["res","Resultado"],["prem","Premissas"],["risco","Riscos"],["vendas","Vendas"]]), k=subAtual("viab");
  return { sub, subKey:k, body: finViabHTML(k), after: finViabAfter };
};
STEP_LIVE.viab = (m,f,fast)=> finViabLive(m, f, fast);
const fast_skip=()=>false;

/* ---------------- 5. Projeto ---------------- */
STEP_R.projeto = ()=>{
  const E=S.estudo, X=S.garagem||DEF.garagem;
  const sub=`<div class="seg full subtabs" role="tablist" aria-label="Partes do projeto">${[["gar","Garagem"],["tipo","Pavimento tipo"],["andar","Andares"]].map(([k,l])=>`<button type="button" role="tab" data-act="psub" data-v="${k}" aria-pressed="${PSUB===k}" aria-selected="${PSUB===k}">${l}</button>`).join("")}</div>`;
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
  if(q&&q.ev) h+=sw("transparent","vaga com recarga (EV)","border:2px solid var(--accent)")+sw("var(--c-tec)","quadro elétrico (QE)","border:1px solid var(--ink)");
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

/* ---------------- 6. Clima ---------------- */
STEP_R.clima = ()=>{
  const C=S.clima, c=S.cfd;
  const sub=`<div class="seg full subtabs" role="tablist" aria-label="Partes do clima">${[["sol","Sol"],["vento","Vento no chão"],["v3d","Vento 3D"]].map(([k,l])=>`<button type="button" role="tab" data-act="csub" data-v="${k}" aria-pressed="${CSUB===k}" aria-selected="${CSUB===k}">${l}</button>`).join("")}</div>`;
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
  if(TAB==="clima") STEP_LIVE.clima();
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

/* ---------------- 7. Cenários ---------------- */
function compareHTML(sel){
  const rows=[["Unidades","units",1,0],["Área privativa","priv",1,0],["Vagas","vagas",1,0],["CA","ca",0,2],["Altura (m)","h",-1,1],["VGV","vgv",1,"mi"],["Custo total","custo",-1,"mi"],["Lucro","lucro",1,"mi"],["Margem","margem",1,"%"],["TIR a.a.","tir",1,"%"],["Exposição máx.","exp",-1,"mi"]];
  const fmt=(v,f)=> v==null?"—": f==="mi"? mi(v) : f==="%"? pct(v) : nf(v,f);
  const lab={CA:TERMO("CA"), VGV:TERMO("VGV"), "TIR a.a.":TERMO("TIR","TIR a.a.")};
  return `<div class="scroll"><table class="tbl multi"><tr><th></th>${sel.map(c=>`<th title="${esc(c.nome)}"><span>${esc(c.nome)}</span></th>`).join("")}</tr>
  ${rows.map(([l,k,dir,f])=>{ const vals=sel.map(c=>c.k[k]); const ok=vals.filter(v=>v!=null); const best= dir===0||!ok.length? null : dir>0? Math.max(...ok) : Math.min(...ok);
    return `<tr><td>${lab[l]||l}</td>${vals.map(v=>`<td class="${v!=null&&v===best&&sel.length>1?"best":""}">${fmt(v,f)}</td>`).join("")}</tr>` }).join("")}</table></div>`;
}
/* duas sub-abas: "Estudos" (estudos, versões, cenários e comparação — src/ui/estudos.js) e "Entregar"
   (arquivos aqui; apresentação/link em src/ui/apresentacao.js; marca em src/ui/marca.js; recomeçar no fim) */
STEP_R.cen = ()=>{
  const sub=SUBTABS("cen",[["estudos","Estudos"],["entregar","Entregar"]]), s=subAtual("cen");
  if(s==="entregar") return { sub, subKey:"entregar", after:()=>dlCheck(), body:
    SEC("Relatório e arquivos", `<button type="button" class="btn pri full" data-act="pdf">Relatório PDF</button>
      <div class="btngrid"><button type="button" class="btn" data-act="zip" title="Plantas em DXF e modelo IFC, num arquivo .zip">DXF + IFC</button><button type="button" class="btn" data-act="json" title="O estudo inteiro num arquivo, para abrir em outro aparelho">Salvar .json</button><button type="button" class="btn" data-act="jsonAbrir">Abrir .json</button><button type="button" class="btn" data-act="copy">Copiar resumo</button></div>
      <input type="file" id="jsonIn" accept=".json,application/json" hidden><p class="note" id="dlNote"></p>`,
      {key:"arquivos", open:true, info:"Relatório PDF: o estudo completo para apresentar. DXF + IFC: plantas e modelo 3D para o projetista. .json: o estudo inteiro, para abrir em outro aparelho (estudos e cenários ficam só neste navegador). Copiar resumo: os números principais em texto."}) };
  return { sub, subKey:"estudos", body: typeof estCardsHTML==="function"? estCardsHTML() : "" };
};
STEP_LIVE.cen = (m,f)=>{
  const n=document.getElementById("estCurNome"); if(n && n.textContent!==(S.nome||"Estudo")) n.textContent=S.nome||"Estudo";
  const lm=document.querySelector("#estBox .lrow.on .lm"); if(lm && typeof estMetaAt==="function"){ const t=estMetaAt(); if(lm.textContent!==t) lm.textContent=t }
  const c=document.getElementById("cmpBox"); if(c && c.offsetParent && typeof cmpHTML==="function"){ const h=cmpHTML(), k=JSON.stringify(histNums(m,f)); if(c.dataset.k!==k){ c.dataset.k=k; c.innerHTML=h } }
};
addCard("cen", { key:"reset", order:90, sub:"entregar", html:()=>SEC("Recomeçar", `<button type="button" class="btn ghost" data-act="reset">Restaurar o exemplo</button>`,
  {key:"reset", sum:"voltar ao exemplo", info:"Troca o estudo aberto pelo exemplo inicial. Ctrl+Z desfaz. Os outros estudos, versões e cenários não mudam."}) });
Object.assign(ACT,{
  pdf: ()=>calcPronto().then(()=>exportPDF()), zip: ()=>calcPronto().then(()=>exportZIP()), json: ()=>calcPronto().then(()=>exportJSON()),
  jsonAbrir: ()=>{ const i=document.getElementById("jsonIn"); if(i){ i.value=""; i.click() } },
  copy: ()=>{ const txt=resumo(); const fb=()=>{ const ta=document.createElement("textarea"); ta.value=txt; ta.style.cssText="position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); try{ document.execCommand("copy"); toast("Resumo copiado") }catch(e){ toast("Selecione o texto e copie") } ta.remove() };
    try{ navigator.clipboard.writeText(txt).then(()=>toast("Resumo copiado"),fb) }catch(e){ fb() } },
  reset: b=>{ if(b.dataset.arm){ S=clone(DEF); document.getElementById("projName").value=S.nome; BG=null; OTIM=null; renderTab(); fit3d(); fit2d(); toast("Exemplo restaurado (Ctrl+Z desfaz)") } else { b.dataset.arm=1; b.textContent="Confirmar: trocar pelo exemplo"; b.classList.add("on") } },
});
