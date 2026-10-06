/* ================= mapa real: MapLibre + satélite, lote desenhado no mapa, GeoJSON da prefeitura e entorno do OSM (item 4.3) =================
   mapaFormHTML() → método "Mapa" do card Contorno do lote (STEP_R.terreno) · mapaAfter() → liga o arquivo GeoJSON
   mapaAbrir()    → carrega o MapLibre GL sob demanda (unpkg) e abre o mapa sobre o palco
   mapaEntorno()  → prédios do OpenStreetMap (Overpass) viram volumes em S.entorno (os desenhados à mão ficam)
   Sem internet ou com mapas externos bloqueados (artifact): mensagem clara; Coordenadas e Imagem + calibração seguem valendo. */
extendDEF("mapa", { camada:"sat", raio:150 });
const MAPA_CDN = { js:"https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js", css:"https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" };
const MAPA_OVERPASS = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const MAPA = { lib:null, map:null, pts:[], fechado:false, tilesOk:0, tilesErr:0, t0:0 };

function mapaFormHTML(){
  const ent=(S.entorno||[]).filter(e=>e.osm).length;
  return `<p class="note">Satélite (Esri) ou OpenStreetMap: ache o terreno e clique nos cantos do lote. Latitude, longitude e norte vêm sozinhos.</p>
    <div class="row"><button class="btn pri" data-act="mapaAbrir">Abrir mapa</button><label class="btn" for="geoFile" tabindex="0">GeoJSON da prefeitura</label><input type="file" id="geoFile" accept=".geojson,.json,application/geo+json,application/json" hidden></div>
    ${GRP("Entorno do OpenStreetMap")}
    <div class="row sb"><button class="btn sm" data-act="mapaEntorno">Buscar prédios vizinhos</button><div class="inp" style="width:118px"><input type="number" step="10" min="30" max="400" data-p="mapa.raio" data-min="30" data-max="400" data-fx="save" value="${S.mapa.raio}" aria-label="Raio da busca"><em>m de raio</em></div></div>
    <p class="note" id="mapaMsg">${ent? `${ent} volumes do OSM no entorno (altura pela tag height ou pavimentos × 3 m).` : "Altura pela tag height ou pelo nº de pavimentos × 3 m; sem informação, 6 m (estimada)."}</p>`;
}
function mapaAfter(){
  const f=document.getElementById("geoFile"); if(!f) return;
  const lb=document.querySelector('label[for="geoFile"]'); if(lb) lb.onkeydown=e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); f.click() } };
  f.onchange=()=>{ const file=f.files[0]; if(!file) return;
    file.text().then(txt=>{ const r=geoLerGeoJSON(txt,{lonRef:S.lote.lon, latRef:S.lote.lat}); if(r.erro){ toast(r.erro); return }
      aplicarLoteGeo(r.pares, `GeoJSON ${r.utm? "UTM "+r.zona+"S":"WGS84"}${r.n>1? ` (maior de ${r.n} polígonos)`:""}`); if(MAPA.map) mapaDesenha() }).catch(()=>toast("Não consegui ler o arquivo")) };
}
function mapaMsg(t){ const e=document.getElementById("mapaMsg"); if(e) e.innerHTML=t }

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
.mapahint::before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--mark);margin-right:8px;vertical-align:1px}
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
  const map=MAPA.map, fc={type:"FeatureCollection",features:[]}, acc=css("--accent")||"#1c6878", mark=css("--mark")||"#d49c17";
  ["mapaAtual","mapaEntorno","mapaDes","mapaVert"].forEach(id=>map.addSource(id,{type:"geojson",data:fc}));
  map.addLayer({id:"entF",type:"fill",source:"mapaEntorno",paint:{"fill-color":"#9aa4ab","fill-opacity":0.45}});
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
   primeiro servidor e, se ele não responder em 6 s (ou falhar), já dispara o próximo em paralelo; vale a primeira resposta boa. */
function mapaOverpass(q, aoProgresso){
  return new Promise((res, rej)=>{
    const ctrls=[], lancado=new Set(); let fim=false, rodada=1, falhas=0, ult="sem conexão ou bloqueado", t0=performance.now();
    const termina=(ok,v)=>{ if(fim) return; fim=true; clearTimeout(geral); clearInterval(tic); ctrls.forEach(c=>{ try{ c.abort() }catch(e){} }); ok? res(v) : rej(new Error(v)) };
    const geral=setTimeout(()=>termina(false, ult==="sem conexão ou bloqueado"? "tempo esgotado" : ult), 80000);
    const tic=setInterval(()=>{ if(aoProgresso) aoProgresso(Math.round((performance.now()-t0)/1000), lancado.size) }, 1000);
    const lanca=i=>{
      if(fim || i>=MAPA_OVERPASS.length || lancado.has(i+"/"+rodada)) return; lancado.add(i+"/"+rodada);
      const ac=new AbortController(), meu=rodada; ctrls.push(ac);
      fetch(MAPA_OVERPASS[i],{method:"POST", body:"data="+encodeURIComponent(q), headers:{"Content-Type":"application/x-www-form-urlencoded"}, signal:ac.signal})
        .then(r=>{ if(!r.ok) throw new Error("erro "+r.status); return r.json() })
        .then(j=>{ if(j && /runtime error|timed out/i.test(String(j.remark||"")) && !(j.elements||[]).length) throw new Error("servidor sobrecarregado"); termina(true,j) })
        .catch(e=>{ if(fim || e.name==="AbortError") return; ult=e.message||ult; falhas++; lanca(i+1);
          if(meu===rodada && falhas>=MAPA_OVERPASS.length && rodada<2){ rodada++; falhas=0; setTimeout(()=>lanca(0), 2000) }
          else if(falhas>=MAPA_OVERPASS.length*2) termina(false, ult) });
      setTimeout(()=>lanca(i+1), 6000);
    };
    lanca(0);
  });
}
async function mapaEntorno(){
  const lat=+S.lote.lat, lon=+S.lote.lon, raio=Math.max(30,Math.min(400,+S.mapa.raio||150));
  if(!isFinite(lat)||!isFinite(lon)){ toast("Informe a latitude e a longitude do lote"); return }
  if(MAPA.busca) return; MAPA.busca=true;
  const q=geoOverpassQuery(lat, lon, raio), t0=performance.now();
  const msg=t=>{ mapaMsg(t); mapaHint(t) };
  msg("Buscando prédios no OpenStreetMap…");
  let json=null, err="";
  try{ json=await mapaOverpass(q, (s,n)=>msg(`Buscando prédios no OpenStreetMap… ${s} s${n>1? ` (${n} servidores consultados)`:""}`)) }catch(e){ err=e.message }
  MAPA.busca=false;
  if(!json){ const t=`Não consegui consultar o OpenStreetMap (${err}). Tente de novo em instantes, desenhe os vizinhos à mão (ferramenta Entorno, na implantação) ou use “Gerar genéricos” na etapa Clima.`; msg(t); toast("Entorno do OSM indisponível"); return }
  const ent=geoEntornoDeOverpass(json, geoRef(lat,lon), S.lote.pts, {raio});
  S.entorno=[...(S.entorno||[]).filter(e=>!e.osm), ...ent];
  const est=ent.filter(e=>e.est).length, s=(performance.now()-t0)/1000, aberto=!!document.getElementById("mapaBox");
  update(); if(MAPA.map) mapaDesenha();
  const t=`${ent.length} prédios do OSM em ${nf(raio,0)} m${est? ` (${est} com altura estimada em 6 m)`:""} · ${nf(s,1)} s.${ent.length? (aberto? " Feche o mapa para editar (mover, apagar, redimensionar, criar vazios) na Implantação." : " Clique numa edificação para editá-la."):""}`;
  msg(t); toast(ent.length? `Entorno: ${ent.length} prédios do OpenStreetMap` : "Nenhum prédio do OSM nesse raio");
  if(ent.length && !aberto && typeof entEnquadrar==="function"){ setView("impl"); entEnquadrar() }
  if(TAB==="terreno"||TAB==="clima") renderTab();
}
Object.assign(ACT,{ mapaAbrir: ()=>mapaAbrir(), mapaEntorno: ()=>mapaEntorno() });
