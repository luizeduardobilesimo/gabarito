/* ================= mapa real: MapLibre + satélite, lote desenhado no mapa, GeoJSON da prefeitura e entorno do OSM (item 4.3) =================
   mapaFormHTML() → método "Mapa" do card Contorno do lote (STEP_R.terreno) · mapaAfter() → liga o arquivo GeoJSON
   mapaAbrir()    → carrega o MapLibre GL sob demanda (unpkg) e abre o mapa sobre o palco
   mapaEntorno()  → prédios do OpenStreetMap (Overpass) viram volumes em S.entorno (os desenhados à mão ficam)
   Sem internet ou com mapas externos bloqueados (artifact): mensagem clara; Coordenadas e Imagem + calibração seguem valendo. */
extendDEF("mapa", { camada:"sat", raio:150 });
const MAPA_CDN = { js:"https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js", css:"https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" };
const MAPA_OVERPASS = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const MAPA = { lib:null, map:null, pts:[], fechado:false, tilesOk:0, tilesErr:0, t0:0 };

/* método "Mapa" do contorno do lote (etapa Terreno) — só o lote; os prédios vizinhos ficam na seção Vizinhos e ruas (mapaEntornoHTML) */
function mapaFormHTML(){
  return `<div class="row"><button class="btn" data-act="mapaAbrir">Abrir mapa</button><label class="btn" for="geoFile" tabindex="0">GeoJSON da prefeitura</label><input type="file" id="geoFile" accept=".geojson,.json,application/geo+json,application/json" hidden>${INFO("Satélite (Esri) ou OpenStreetMap: ache o terreno e clique nos cantos do lote; latitude, longitude e norte vêm sozinhos. O GeoJSON da prefeitura (WGS84 ou UTM) também vira o contorno. Os prédios vizinhos ficam na seção Vizinhos e ruas.")}</div>`;
}
/* bloco "OpenStreetMap" da seção Vizinhos e ruas (src/ui/entorno.js: Terreno e Projeto › Sol / Vento) */
function mapaEntornoHTML(){
  const ent=(S.entorno||[]).filter(e=>e.osm).length;
  return `<div class="row" style="flex-wrap:nowrap"><button class="btn sm" data-act="mapaEntorno" title="Prédios, ruas, calçadas, água e verde ao redor do lote">Buscar entorno do OSM</button><div class="inp" style="width:92px;flex:none"><input type="number" step="10" min="30" max="400" data-p="mapa.raio" data-min="30" data-max="400" data-fx="save" value="${S.mapa.raio}" aria-label="Raio da busca em metros" title="Raio da busca"><em>m</em></div>${INFO("Prédios do OpenStreetMap num raio ao redor do lote (precisa de latitude e longitude e de internet), com ruas, calçadas, água e verde. Altura pela tag height ou pelo nº de pavimentos × 3 m; sem informação, 6 m (estimada). Os desenhados à mão ficam.")}</div>
    ${(()=>{ const av=MAPA.aviso && !(MAPA.avisoGeo && S.lote.geo)? MAPA.aviso : ""; return `<p class="note" id="mapaMsg" ${av||ent?"":"hidden"}>${av || (ent? `${ent} prédios do OSM no entorno` : "")}</p>` })()}${typeof ctxCamadasHTML==="function"? ctxCamadasHTML() : ""}`;
}
function mapaAfter(){
  const f=document.getElementById("geoFile"); if(!f) return;
  const lb=document.querySelector('label[for="geoFile"]'); if(lb) lb.onkeydown=e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); f.click() } };
  f.onchange=()=>{ const file=f.files[0]; if(!file) return;
    file.text().then(txt=>{ const r=geoLerGeoJSON(txt,{lonRef:S.lote.lon, latRef:S.lote.lat}); if(r.erro){ toast(r.erro); return }
      aplicarLoteGeo(r.pares, `GeoJSON ${r.utm? "UTM "+r.zona+"S":"WGS84"}${r.n>1? ` (maior de ${r.n} polígonos)`:""}`); if(MAPA.map) mapaDesenha() }).catch(()=>toast("Não consegui ler o arquivo")) };
}
function mapaMsg(t){ const e=document.getElementById("mapaMsg"); if(e){ e.innerHTML=t; e.hidden=!t } if(typeof FR!=="undefined" && FR.busy && typeof frProg==="function") frProg(t) }

/* ---- carregamento sob demanda ---- */
function mapaCarrega(){
  if(window.maplibregl) return Promise.resolve(window.maplibregl);
  if(MAPA.lib) return MAPA.lib;
  MAPA.lib = new Promise((res, rej)=>{
    if(!document.getElementById("mapaLibCss")){ const l=document.createElement("link"); l.id="mapaLibCss"; l.rel="stylesheet"; l.href=MAPA_CDN.css; document.head.appendChild(l) }
    const s=document.createElement("script"); s.src=MAPA_CDN.js; s.async=true;
    const to=setTimeout(()=>rej(new Error("tempo esgotado")), 15000);
    s.onload=()=>{ clearTimeout(to); window.maplibregl? res(window.maplibregl) : rej(new Error("biblioteca indisponível")) };
    s.onerror=()=>{ clearTimeout(to); rej(new Error("sem acesso à biblioteca")) };
    document.head.appendChild(s);
  }).catch(e=>{ MAPA.lib=null; throw e });
  return MAPA.lib;
}
function mapaCss(){
  if(document.getElementById("mapaCss")) return;
  const st=document.createElement("style"); st.id="mapaCss";
  st.textContent=`.mapabox{position:absolute;inset:0;z-index:8;background:var(--surface-2);overflow:hidden}
.mapabox .mapael{position:absolute;inset:0}
.mapabar{position:absolute;top:12px;left:12px;right:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;z-index:3;pointer-events:none}
.mapabar>*{pointer-events:auto}
.mapabar .seg,.mapabar>.btn,.mapafind,.mapahint,.mapaerr{background:var(--glass);-webkit-backdrop-filter:blur(16px) saturate(150%);backdrop-filter:blur(16px) saturate(150%);border:1px solid var(--glass-line);box-shadow:var(--shadow)}
.mapabar .seg{border-radius:12px;padding:3px}
.mapabar .seg button[aria-pressed="true"]{background:var(--ink);color:var(--surface);box-shadow:none}
.mapabar .grow{flex:1}
.mapafind{display:flex;align-items:center;border-radius:12px;padding:2px 2px 2px 10px;min-width:0}
.mapafind input{border:0;background:transparent;outline:none;font-size:12.5px;width:190px;max-width:42vw;padding:5px 0;color:var(--ink)}
.mapahint{position:absolute;left:12px;bottom:28px;z-index:3;border-radius:12px;padding:8px 12px;font-size:12px;max-width:min(70%,480px)}
.mapahint::before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--brand);margin-right:8px;vertical-align:1px}
.mapaerr{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:4;border-radius:14px;padding:16px 18px;max-width:min(420px,calc(100% - 32px));display:grid;gap:10px;font-size:12.5px}
.mapaerr b{font-family:var(--f-display);font-size:14px;font-weight:620}
.mapabox .maplibregl-ctrl-attrib{font-size:10px}
@media (max-width:900px){.mapabar{top:8px;left:8px;right:8px;gap:5px}.mapabar>.btn{padding:5px 9px;font-size:12px;border-radius:9px}.mapabar .seg button{padding:4px 8px;font-size:12px}.mapafind input{width:120px}.mapahint{left:8px;right:8px;bottom:24px;max-width:none}}`;
  document.head.appendChild(st);
}
function mapaBox(){
  let box=document.getElementById("mapaBox"); if(box) return box;
  mapaCss();
  box=document.createElement("div"); box.className="mapabox"; box.id="mapaBox";
  box.innerHTML=`<div class="mapael" id="mapaEl"></div>
    <div class="mapabar">
      <div class="seg" id="mapaCam"><button data-c="sat">Satélite</button><button data-c="osm">Mapa</button></div>
      <form class="mapafind" id="mapaFind"><input id="mapaQ" placeholder="Endereço ou bairro" aria-label="Buscar endereço"><button class="btn sm ghost" type="submit">Ir</button></form>
      <span class="grow"></span>
      <button class="btn" id="mapaUndo" title="Tirar o último ponto">Desfazer</button>
      <button class="btn" id="mapaNovo" title="Começar o desenho de novo">Novo lote</button>
      <button class="btn pri" id="mapaUsar" disabled>Usar este lote</button>
      <button class="btn" id="mapaEnt" title="Prédios do OpenStreetMap ao redor do lote">Entorno OSM</button>
      <button class="btn" id="mapaFechar" aria-label="Fechar o mapa">Fechar</button>
    </div>
    <div class="mapahint" id="mapaHint">Carregando o mapa…</div>
    <div class="mapaerr" id="mapaErr" hidden></div>`;
  document.getElementById("view").appendChild(box);
  box.querySelector("#mapaCam").addEventListener("click",e=>{ const b=e.target.closest("[data-c]"); if(!b) return; S.mapa.camada=b.dataset.c; save(); mapaCamada() });
  box.querySelector("#mapaFind").addEventListener("submit",e=>{ e.preventDefault(); mapaBusca(document.getElementById("mapaQ").value) });
  box.querySelector("#mapaUndo").onclick=()=>{ if(MAPA.fechado) MAPA.fechado=false; else MAPA.pts.pop(); mapaDesenha() };
  box.querySelector("#mapaNovo").onclick=()=>{ MAPA.pts=[]; MAPA.fechado=false; mapaDesenha() };
  box.querySelector("#mapaUsar").onclick=mapaUsar;
  box.querySelector("#mapaEnt").onclick=()=>mapaEntorno();
  box.querySelector("#mapaFechar").onclick=mapaFechar;
  box.addEventListener("keydown",e=>{ if(e.key==="Escape") mapaFechar() });
  return box;
}
function mapaErro(titulo, txt){
  const e=document.getElementById("mapaErr"); if(!e) return;
  e.hidden=false; e.innerHTML=`<b>${titulo}</b><span>${txt}</span><div class="row"><button class="btn sm" data-tm="coord">Usar coordenadas</button><button class="btn sm" data-tm="img">Imagem + calibração</button><button class="btn sm ghost" data-tm="x">Fechar</button></div>`;
  e.onclick=ev=>{ const b=ev.target.closest("[data-tm]"); if(!b) return; mapaFechar(); if(b.dataset.tm!=="x"){ TMETH=b.dataset.tm; renderTab(); if(VIEW!=="impl") setView("impl") } };
  const h=document.getElementById("mapaHint"); if(h) h.hidden=true;
}
function mapaHint(t){ const h=document.getElementById("mapaHint"); if(h){ h.hidden=!t; h.textContent=t||"" } }
function mapaFechar(){ const b=document.getElementById("mapaBox"); if(MAPA.map){ try{ MAPA.map.remove() }catch(e){} MAPA.map=null } if(b) b.remove() }

/* ---- abrir ---- */
function mapaAbrir(){
  if(VIEW!=="impl" && VIEW!=="3d") setView("impl");
  mapaBox(); MAPA.t0=performance.now(); MAPA.tilesOk=0; MAPA.tilesErr=0;
  if(matchMedia("(max-width:900px)").matches) document.getElementById("view").scrollIntoView({behavior:"smooth",block:"start"});
  if(!navigator.onLine){ mapaErro("Sem internet", "O mapa precisa de conexão. Enquanto isso, importe o lote por Coordenadas ou use uma Imagem com calibração."); return }
  mapaCarrega().then(ml=>{
    if(!document.getElementById("mapaBox")) return;
    const c=[+S.lote.lon||-49.37, +S.lote.lat||-28.68];
    const map=MAPA.map=new ml.Map({ container:"mapaEl", center:c, zoom:18, maxZoom:20, attributionControl:{compact:true}, dragRotate:false, pitchWithRotate:false,
      style:{ version:8, sources:{
        sat:{type:"raster", tiles:["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize:256, maxzoom:18, attribution:"Imagens © Esri, Maxar, Earthstar Geographics"},
        osm:{type:"raster", tiles:["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize:256, maxzoom:19, attribution:"© colaboradores do OpenStreetMap"} },
        layers:[{id:"sat",type:"raster",source:"sat"},{id:"osm",type:"raster",source:"osm",layout:{visibility:"none"}}] } });
    map.addControl(new ml.NavigationControl({showCompass:false}), "bottom-right");
    map.doubleClickZoom.disable(); map.touchZoomRotate.disableRotation();
    map.on("load",()=>{ mapaCamadas(); mapaCamada(); mapaDesenha(); mapaHint(MAPA.pts.length? "" : "Clique nos cantos do lote e feche clicando no primeiro ponto.") });
    map.on("sourcedataloading",()=>{});
    map.on("data",e=>{ if(e.dataType==="source" && e.tile) MAPA.tilesOk++ });
    map.on("error",e=>{ const st=e && e.error && (e.error.status||0); if(e && (e.tile || /tile|Failed to fetch|NetworkError|AJAXError/i.test(String(e.error&&e.error.message)))) MAPA.tilesErr++;
      if(MAPA.tilesErr>=6 && MAPA.tilesOk===0) mapaErro("As imagens do mapa não carregaram", `O satélite e o OpenStreetMap estão bloqueados ou sem conexão${st?` (erro ${st})`:""}. Importe o lote por Coordenadas ou use uma Imagem com calibração.`) });
    map.on("click",mapaClique);
    map.on("mousemove",e=>{ MAPA.hover=[e.lngLat.lng,e.lngLat.lat]; if(!MAPA.fechado && MAPA.pts.length) mapaDesenha(true) });
  }).catch(err=>mapaErro("Mapa indisponível neste ambiente", `Não foi possível carregar o mapa (${esc(err.message)}). Sem internet ou com mapas externos bloqueados (como no artifact), use Coordenadas ou Imagem + calibração.`));
}
function mapaCamada(){
  const b=document.getElementById("mapaCam"); if(b) b.querySelectorAll("[data-c]").forEach(x=>x.setAttribute("aria-pressed", x.dataset.c===S.mapa.camada));
  const map=MAPA.map; if(!map || !map.getLayer("sat")) return;
  map.setLayoutProperty("sat","visibility", S.mapa.camada==="sat"?"visible":"none"); map.setLayoutProperty("osm","visibility", S.mapa.camada==="osm"?"visible":"none");
}
function mapaCamadas(){
  const map=MAPA.map, fc={type:"FeatureCollection",features:[]}, acc=css("--d-acc")||"#2f6fed", mark=css("--mark")||"#e8702a";
  ["mapaAtual","mapaEntorno","mapaDes","mapaVert"].forEach(id=>map.addSource(id,{type:"geojson",data:fc}));
  map.addLayer({id:"entF",type:"fill",source:"mapaEntorno",paint:{"fill-color":"#a1a1a6","fill-opacity":0.45}});
  map.addLayer({id:"entL",type:"line",source:"mapaEntorno",paint:{"line-color":"#ffffff","line-width":1,"line-opacity":0.8}});
  map.addLayer({id:"atuL",type:"line",source:"mapaAtual",paint:{"line-color":"#ffffff","line-width":2,"line-dasharray":[2,2],"line-opacity":0.9}});
  map.addLayer({id:"desF",type:"fill",source:"mapaDes",filter:["==","$type","Polygon"],paint:{"fill-color":mark,"fill-opacity":0.22}});
  map.addLayer({id:"desL",type:"line",source:"mapaDes",paint:{"line-color":mark,"line-width":2.5}});
  map.addLayer({id:"vtx",type:"circle",source:"mapaVert",paint:{"circle-radius":["case",["==",["get","i"],0],7,5],"circle-color":["case",["==",["get","i"],0],mark,"#ffffff"],"circle-stroke-color":acc,"circle-stroke-width":2}});
}
/* lote atual e entorno no mapa (a partir da origem do lote) */
function mapaDesenha(soPreview){
  const map=MAPA.map; if(!map || !map.getSource("mapaDes")) return;
  const ring=MAPA.pts.slice(), feats=[];
  if(ring.length>=3 && MAPA.fechado) feats.push({type:"Feature",geometry:{type:"Polygon",coordinates:[[...ring, ring[0]]]}});
  else if(ring.length){ const ln=ring.concat(MAPA.hover && !MAPA.fechado? [MAPA.hover] : []); if(ln.length>1) feats.push({type:"Feature",geometry:{type:"LineString",coordinates:ln}}) }
  map.getSource("mapaDes").setData({type:"FeatureCollection",features:feats});
  map.getSource("mapaVert").setData({type:"FeatureCollection",features:ring.map((p,i)=>({type:"Feature",properties:{i},geometry:{type:"Point",coordinates:p}}))});
  const u=document.getElementById("mapaUsar"); if(u) u.disabled=!(MAPA.fechado && ring.length>=3);
  if(soPreview) return;
  const ref=geoRef(S.lote.lat, S.lote.lon), toLL=q=>{ const [la,lo]=geoDeLocal(q[0],q[1],ref); return [lo,la] }, poly=p=>({type:"Feature",geometry:{type:"Polygon",coordinates:[[...p.map(toLL), toLL(p[0])]]}});
  map.getSource("mapaAtual").setData({type:"FeatureCollection",features: S.lote.pts.length>2? [poly(S.lote.pts)] : []});
  map.getSource("mapaEntorno").setData({type:"FeatureCollection",features:(S.entorno||[]).filter(e=>e.pts&&e.pts.length>2).map(e=>poly(e.pts))});
  mapaHint(MAPA.fechado? `Lote fechado (${MAPA.pts.length} vértices). Use “Usar este lote” para levar ao estudo.` : MAPA.pts.length? `${MAPA.pts.length} ponto${MAPA.pts.length>1?"s":""}. Feche clicando no primeiro ponto (amarelo).` : "Clique nos cantos do lote e feche clicando no primeiro ponto.");
}
function mapaClique(e){
  if(MAPA.fechado) return;
  const p=[e.lngLat.lng, e.lngLat.lat];
  if(MAPA.pts.length>=3){ const f=MAPA.map.project(MAPA.pts[0]); if(Math.hypot(f.x-e.point.x, f.y-e.point.y)<14){ MAPA.fechado=true; mapaDesenha(); return } }
  MAPA.pts.push(p); mapaDesenha();
}
function mapaUsar(){
  if(!(MAPA.fechado && MAPA.pts.length>=3)) return;
  const ok=aplicarLoteGeo(MAPA.pts.map(([lo,la])=>[la,lo]), "Lote do mapa"); if(!ok) return;
  MAPA.pts=[]; MAPA.fechado=false; mapaDesenha();
  const s=((performance.now()-MAPA.t0)/1000); MAPA.ultimo=s;
  mapaHint(`Lote levado ao estudo em ${nf(s,0)} s. Marque a frente (rua) na lista de lados. Quer os prédios vizinhos? Clique em “Entorno OSM”.`);
}
function mapaBusca(q){
  q=String(q||"").trim(); if(!q || !MAPA.map) return;
  mapaHint("Buscando…");
  fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q="+encodeURIComponent(q), {headers:{"Accept-Language":"pt-BR"}})
    .then(r=>r.ok? r.json() : Promise.reject(new Error(r.status))).then(l=>{ if(!l.length){ mapaHint("Endereço não encontrado."); return } MAPA.map.flyTo({center:[+l[0].lon, +l[0].lat], zoom:18}); mapaHint("Clique nos cantos do lote e feche clicando no primeiro ponto.") })
    .catch(()=>mapaHint("A busca de endereços não respondeu. Navegue pelo mapa."));
}

/* ---- entorno automático (Overpass) ----
   Os servidores públicos do Overpass oscilam (504, lentidão, fora do ar). Em vez de tentar um por vez, a consulta sai para o
   primeiro servidor e, se ele não responder em 6 s (ou falhar), já dispara o próximo em paralelo; vale a primeira resposta boa.
   Se a consulta completa falha em todos, ctxBuscaResiliente (src/calc/contexto.js) desce degraus: consulta leve (vias e prédios, raio menor)
   e, por último, as vias do tile vetorial do OpenFreeMap. Falha nunca apaga o que já está no estudo. */
function mapaOverpass(q, aoProgresso, limite=80000){
  return new Promise((res, rej)=>{
    const ctrls=[], lancado=new Set(); let fim=false, rodada=1, falhas=0, ult="sem conexão ou bloqueado", t0=performance.now();
    const termina=(ok,v)=>{ if(fim) return; fim=true; clearTimeout(geral); clearInterval(tic); ctrls.forEach(c=>{ try{ c.abort() }catch(e){} }); ok? res(v) : rej(new Error(v)) };
    const geral=setTimeout(()=>termina(false, ult==="sem conexão ou bloqueado"? "tempo esgotado" : ult), limite);
    const tic=setInterval(()=>{ if(aoProgresso) aoProgresso(Math.round((performance.now()-t0)/1000), lancado.size) }, 1000);
    const lanca=i=>{
      if(fim || i>=MAPA_OVERPASS.length || lancado.has(i+"/"+rodada)) return; lancado.add(i+"/"+rodada);
      const ac=new AbortController(), meu=rodada; ctrls.push(ac);
      fetch(MAPA_OVERPASS[i],{method:"POST", body:"data="+encodeURIComponent(q), headers:{"Content-Type":"application/x-www-form-urlencoded"}, signal:ac.signal})
        .then(r=>{ if(!r.ok) throw new Error("erro "+r.status); return r.json() })
        .then(j=>{ if(j && /runtime error|timed out/i.test(String(j.remark||"")) && !(j.elements||[]).length) throw new Error("servidor sobrecarregado"); termina(true,j) })
        .catch(e=>{ if(fim || e.name==="AbortError") return; ult=e.message||ult; falhas++; lanca(i+1);
          if(falhas>=MAPA_OVERPASS.length){ if(meu===rodada && rodada<2){ rodada++; falhas=0; setTimeout(()=>lanca(0), 2000) } else termina(false, ult) } });   // 2 rodadas; falhou tudo na 2ª → desiste (antes esperava o limite de 80 s)
      setTimeout(()=>lanca(i+1), 6000);
    };
    lanca(0);
  });
}
/* reserva: tile vetorial do OpenFreeMap (sem chave, com CORS); a versão do tileset vem do TileJSON */
const MAPA_TILEJSON = "https://tiles.openfreemap.org/planet";
let MAPA_TILEURL = null;
function mapaFetchTempo(url, ms){ const ac=new AbortController(), t=setTimeout(()=>ac.abort(), ms); return fetch(url,{signal:ac.signal}).finally(()=>clearTimeout(t)) }
async function mapaTile(z, x, y){
  if(!MAPA_TILEURL){ const r=await mapaFetchTempo(MAPA_TILEJSON, 8000); if(!r.ok) throw new Error("erro "+r.status); const j=await r.json(); MAPA_TILEURL=(j.tiles||[])[0]; if(!MAPA_TILEURL) throw new Error("tileset indisponível") }
  const r=await mapaFetchTempo(MAPA_TILEURL.replace("{z}",z).replace("{x}",x).replace("{y}",y), 15000); if(!r.ok) throw new Error("erro "+r.status);
  let b=new Uint8Array(await r.arrayBuffer());
  if(b[0]===0x1f && b[1]===0x8b && typeof DecompressionStream==="function") b=new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
  return b;
}
/* sem georreferência o lote está na origem padrão (Criciúma): a busca rodaria no lugar errado */
function mapaSemGeo(){
  const t=`Posicione o lote no mapa para buscar o entorno. <button class="btn sm" data-act="geoMapa">Abrir mapa</button> <button class="btn sm ghost" data-act="geoIr">Posição no mapa</button>`;
  MAPA.aviso=t; MAPA.avisoGeo=true; mapaMsg(t); mapaHint("Posicione o lote no mapa para buscar o entorno");
  if(typeof geoFoco==="function" && (TAB==="terreno"||TAB==="regras")) geoFoco();
  toast("Posicione o lote no mapa para buscar o entorno");
}
/* abre e destaca a posição no mapa (Terreno › Contorno do lote › "Posição no mapa") */
function geoFoco(){
  const d=TB.querySelector('details[data-key="contorno"]') || TB.querySelector('details[data-key="local"]'); if(!d) return;
  d.open=true;
  const a=d.querySelector('.adv[data-adv$=":local"]'), ab=a && a.querySelector(":scope > .advb");
  if(ab && ab.hidden){ const bt=a.querySelector(":scope > .advbtn"); if(bt && ACT.advTog) ACT.advTog(bt); else ab.hidden=false }
  const alvo=a||d; d.classList.add("geoFoco"); try{ alvo.scrollIntoView({block:"nearest",behavior:"smooth"}) }catch(e){}
  clearTimeout(geoFoco.t); geoFoco.t=setTimeout(()=>d.classList.remove("geoFoco"), 3000);
}
const mapaNaTela = () => TAB==="terreno" || TAB==="regras" || (typeof emClima==="function"? emClima() : TAB==="clima");
const mapaForaDoLocal = () => !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname||"") || location.protocol==="file:";
/* entorno do OSM (prédios + ruas, água e verde). Devolve true se há contexto utilizável ao final (novo ou o da busca anterior). */
async function mapaEntorno(){
  if(!S.lote.geo){ mapaSemGeo(); return false }
  const lat=+S.lote.lat, lon=+S.lote.lon, raio=Math.max(30,Math.min(400,+S.mapa.raio||150));
  if(!isFinite(lat)||!isFinite(lon)){ toast("Informe a latitude e a longitude do lote"); return false }
  if(MAPA.busca) return false; MAPA.busca=true; MAPA.aviso=""; MAPA.avisoGeo=false;
  const rc=Math.max(100,Math.min(1000,+(S.contexto&&S.contexto.raio)||350)), t0=performance.now(), norte=S.lote.norte;
  const msg=t=>{ mapaMsg(t); mapaHint(t.replace(/<button[^]*?<\/button>/g,"").replace(/<br>/g," ").replace(/<[^>]*>/g,"").replace(/&amp;/g,"&")) };
  let estagio="completa"; msg("Buscando o entorno no OpenStreetMap…");
  const prog=(s,n)=>{ if(estagio==="completa") msg(`Buscando o entorno no OpenStreetMap… ${s} s${n>1? ` (${n} servidores consultados)`:""}`); else msg(`Tentando de novo só com vias e prédios… ${s} s`) };
  const r=await ctxBuscaResiliente({ lat, lon, raio, raioCtx:rc, norte,
    fetchJson:(q,o)=>mapaOverpass(q, prog, o&&o.limite), fetchTile:mapaTile,
    aoEstagio:n=>{ estagio=n; if(n==="leve") msg("A busca completa falhou. Tentando só vias e prédios, num raio menor…"); else if(n==="tile") msg("Servidores do Overpass fora do ar. Lendo as vias do mapa vetorial…") } });
  MAPA.busca=false;
  const ant=S.contexto.dados, antOk=ctxDadosValem(ant, lat, lon, norte);
  if(r.erro){
    const quando=antOk? ctxQuandoBR(ant.quando) : "", fora=mapaForaDoLocal();
    const t=`OpenStreetMap indisponível agora (${esc(r.erro)}).${quando? ` Usando a última busca de ${quando}.`:""} <button class="btn sm" data-act="mapaEntorno">Tentar de novo</button>${fora? `<br>No artifact do claude.ai as buscas externas são bloqueadas: abra em http://localhost:5173.` : ""}`;
    MAPA.aviso=t; msg(t); toast("Entorno do OSM indisponível"); if(mapaNaTela()) renderTab(); return antOk;
  }
  const ref=geoRef(lat,lon), hoje=new Date().toISOString().slice(0,10);
  let novo, ent=null, s=(performance.now()-t0)/1000, aviso="";
  if(r.nivel==="tile"){ novo=Object.assign(r.dados, {lat, lon, norte, raio:r.raioCtx, quando:hoje, nivel:"tile"}) }
  else{ ent=ctxEntornoOSM(r.json, ref, S.lote.pts, {raio:r.raioPred, norte});
    novo=Object.assign(ctxDeOverpass(r.json, ref, {raio:Math.max(r.raioCtx,r.raioPred), norte}), {lat, lon, norte, raio:Math.max(r.raioCtx,r.raioPred), quando:hoje}); if(r.nivel==="leve") novo.nivel="leve" }
  // a busca reduzida não troca um contexto completo (água, verde, calçadas) que já está no estudo
  const mantem = r.nivel!=="completa" && antOk && ant.nivel!=="tile" && (ant.raio||0)>=(novo.raio||0) && (r.nivel==="tile" || ant.nivel!=="leve");
  if(!mantem) S.contexto.dados=novo;
  if(ent) S.entorno=[...(S.entorno||[]).filter(e=>!e.osm), ...ent];
  if(r.nivel==="leve") aviso=`Busca reduzida: só vias e prédios em ${nf(novo.raio,0)} m${mantem? `; mantive o restante da busca de ${ctxQuandoBR(ant.quando)}`:""}.`;
  else if(r.nivel==="tile") aviso=`Vias pelo mapa vetorial (sem prédios e sem largura medida)${mantem? `; mantive a busca de ${ctxQuandoBR(ant.quando)}`:""}.`;
  const aberto=!!document.getElementById("mapaBox");
  update(); if(MAPA.map) mapaDesenha();
  let t, toastT;
  if(ent){ const est=ent.filter(e=>e.est).length;
    t=`${ent.length} prédios do OSM em ${nf(r.raioPred,0)} m${est? ` (${est} com altura estimada em 6 m)`:""} · ${nf(s,1)} s.${ent.length? (aberto? " Feche o mapa para editar (mover, apagar, redimensionar, criar vazios) na Implantação." : " Clique numa edificação para editá-la."):""}`;
    toastT=ent.length? `Entorno: ${ent.length} prédios do OpenStreetMap` : "Nenhum prédio do OSM nesse raio" }
  else { t=`${nf(novo.n.vias,0)} trechos de via encontrados.`; toastT="Ruas carregadas (reserva)" }
  if(aviso){ t=aviso+" "+t; MAPA.aviso=aviso+` <button class="btn sm ghost" data-act="mapaEntorno">Tentar a busca completa</button>` }
  msg(t); toast(aviso? "Busca reduzida do OSM" : toastT);
  if(ent && ent.length && !aberto && typeof entEnquadrar==="function"){ setView("impl"); entEnquadrar() }
  if(mapaNaTela()) renderTab();
  return true;
}
/* atalhos da mensagem "posicione o lote no mapa" */
Object.assign(ACT,{ mapaAbrir: ()=>mapaAbrir(), mapaEntorno: ()=>mapaEntorno(),
  geoMapa: ()=>{ if(TAB!=="terreno") goStep("terreno"); TMETH="mapa"; renderTab(); mapaAbrir() },
  geoIr: ()=>{ if(TAB!=="terreno") goStep("terreno"); geoFoco() } });
/* digitar latitude/longitude à mão também posiciona o lote */
FX.geo = live=>{ S.lote.geo=true; update(live?{fast:true}:{}); const gn=document.getElementById("geoNote"); if(gn) gn.hidden=true };
