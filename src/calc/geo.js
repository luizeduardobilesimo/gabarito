/* ================= geo: coordenadas geográficas ↔ metros locais (item 4.3) =================
   Funções puras (Node, Worker e página). O sistema local do Gabarito é um plano tangente:
   x = leste, y = norte, em metros, com a origem (0,0) em (S.lote.lat, S.lote.lon).
   geoRef(lat0,lon0)                → referência local (raios do elipsoide WGS84/SIRGAS 2000 na origem)
   geoParaLocal(lat,lon,ref)        → [x,y] em metros · geoDeLocal(x,y,ref) → [lat,lon]
   geoUtmParaLatLon(E,N,zona,sul)   → [lat,lon] (SIRGAS 2000 / UTM) · geoLatLonParaUtm(lat,lon,zona) → [E,N]
   geoLoteDePares([[lat,lon]…])     → {pts, lat, lon} com a origem no centroide do lote
   geoLerGeoJSON(texto|obj, o)      → {pares:[[lat,lon]…], utm, zona} do maior polígono (aceita UTM com "crs")
   geoEntornoDeOverpass(json, ref, lote, o) → volumes do entorno [{pts,h,nome,osm,est}] a partir do JSON do Overpass */
const GEO_A = 6378137, GEO_F = 1/298.257222101, GEO_E2 = GEO_F*(2-GEO_F), GEO_RAD = Math.PI/180;
function geoRef(lat0, lon0){
  const s = Math.sin(lat0*GEO_RAD), w = 1 - GEO_E2*s*s;
  const N = GEO_A/Math.sqrt(w), M = GEO_A*(1-GEO_E2)/Math.pow(w, 1.5);
  return { lat0:+lat0, lon0:+lon0, kx: N*Math.cos(lat0*GEO_RAD)*GEO_RAD, ky: M*GEO_RAD };
}
function geoParaLocal(lat, lon, ref){ return [ (lon-ref.lon0)*ref.kx, (lat-ref.lat0)*ref.ky ] }
function geoDeLocal(x, y, ref){ return [ ref.lat0 + y/ref.ky, ref.lon0 + x/ref.kx ] }
/* distância aproximada (m) entre dois pontos lat/lon — útil para conferências */
function geoDist(a, b){ const r = geoRef((a[0]+b[0])/2, (a[1]+b[1])/2), p = geoParaLocal(a[0],a[1],r), q = geoParaLocal(b[0],b[1],r); return Math.hypot(p[0]-q[0], p[1]-q[1]) }

/* ---- UTM (Snyder, elipsoide GRS80 ≈ WGS84): precisão milimétrica perto do meridiano central ---- */
const geoZonaDeLon = lon => Math.floor((lon+180)/6)+1;
function geoLatLonParaUtm(lat, lon, zona){
  zona = zona || geoZonaDeLon(lon);
  const k0=0.9996, e2=GEO_E2, ep2=e2/(1-e2), a=GEO_A, phi=lat*GEO_RAD, lam0=((zona-1)*6-180+3)*GEO_RAD;
  const s=Math.sin(phi), c=Math.cos(phi), t=Math.tan(phi), N=a/Math.sqrt(1-e2*s*s), T=t*t, C=ep2*c*c, A=c*(lon*GEO_RAD-lam0);
  const e4=e2*e2, e6=e4*e2;
  const M = a*((1-e2/4-3*e4/64-5*e6/256)*phi - (3*e2/8+3*e4/32+45*e6/1024)*Math.sin(2*phi) + (15*e4/256+45*e6/1024)*Math.sin(4*phi) - (35*e6/3072)*Math.sin(6*phi));
  const E = k0*N*(A + (1-T+C)*A**3/6 + (5-18*T+T*T+72*C-58*ep2)*A**5/120) + 500000;
  let Nn = k0*(M + N*t*(A*A/2 + (5-T+9*C+4*C*C)*A**4/24 + (61-58*T+T*T+600*C-330*ep2)*A**6/720));
  if(lat<0) Nn += 10000000;
  return [E, Nn];
}
function geoUtmParaLatLon(E, N, zona, sul=true){
  const k0=0.9996, e2=GEO_E2, ep2=e2/(1-e2), a=GEO_A, lam0=((zona-1)*6-180+3)*GEO_RAD;
  const M=(N-(sul?10000000:0))/k0, e4=e2*e2, e6=e4*e2, mu=M/(a*(1-e2/4-3*e4/64-5*e6/256)), e1=(1-Math.sqrt(1-e2))/(1+Math.sqrt(1-e2));
  const p1 = mu + (3*e1/2-27*e1**3/32)*Math.sin(2*mu) + (21*e1*e1/16-55*e1**4/32)*Math.sin(4*mu) + (151*e1**3/96)*Math.sin(6*mu) + (1097*e1**4/512)*Math.sin(8*mu);
  const s=Math.sin(p1), c=Math.cos(p1), t=Math.tan(p1), C1=ep2*c*c, T1=t*t, N1=a/Math.sqrt(1-e2*s*s), R1=a*(1-e2)/Math.pow(1-e2*s*s,1.5), D=(E-500000)/(N1*k0);
  const phi = p1 - (N1*t/R1)*(D*D/2 - (5+3*T1+10*C1-4*C1*C1-9*ep2)*D**4/24 + (61+90*T1+298*C1+45*T1*T1-252*ep2-3*C1*C1)*D**6/720);
  const lam = lam0 + (D - (1+2*T1+C1)*D**3/6 + (5-2*C1+28*T1-3*C1*C1+8*ep2+24*T1*T1)*D**5/120)/c;
  return [phi/GEO_RAD, lam/GEO_RAD];
}
/* zona UTM a partir do "crs" de um GeoJSON (EPSG:31978–31985 SIRGAS 2000 / 18S–25S, 327zz / 326zz WGS84) */
function geoZonaDoCrs(crs){
  const s = typeof crs==="string" ? crs : crs && crs.properties && crs.properties.name || "";
  const m = String(s).match(/(?:EPSG)?[^0-9]*(\d{4,5})\s*$/i); if(!m) return null;
  const c = +m[1];
  if(c>=31978 && c<=31985) return {zona:c-31960, sul:true};
  if(c>=32701 && c<=32760) return {zona:c-32700, sul:true};
  if(c>=32601 && c<=32660) return {zona:c-32600, sul:false};
  if(c>=31965 && c<=31976) return {zona:c-31954, sul:false}; // SIRGAS 2000 / UTM 11N–22N
  return null;
}

/* ---- polígonos ---- */
const geoSArea = p => { let a=0; for(let i=0;i<p.length;i++){ const q=p[i], r=p[(i+1)%p.length]; a+=q[0]*r[1]-r[0]*q[1] } return a/2 };
function geoCentroide(p){ const A=geoSArea(p); if(Math.abs(A)<1e-9){ const n=p.length||1; return [p.reduce((s,q)=>s+q[0],0)/n, p.reduce((s,q)=>s+q[1],0)/n] }
  let cx=0, cy=0; for(let i=0;i<p.length;i++){ const q=p[i], r=p[(i+1)%p.length], k=q[0]*r[1]-r[0]*q[1]; cx+=(q[0]+r[0])*k; cy+=(q[1]+r[1])*k } return [cx/(6*A), cy/(6*A)] }
function geoPip(pt, p){ let c=false; for(let i=0,j=p.length-1;i<p.length;j=i++){ const [xi,yi]=p[i],[xj,yj]=p[j]; if(((yi>pt[1])!==(yj>pt[1])) && (pt[0] < (xj-xi)*(pt[1]-yi)/(yj-yi)+xi)) c=!c } return c }
/* tira o ponto de fechamento repetido e pontos duplicados seguidos */
function geoLimpaAnel(r, tol=1e-12){ const o=[]; r.forEach(q=>{ const l=o[o.length-1]; if(!l || Math.abs(l[0]-q[0])>tol || Math.abs(l[1]-q[1])>tol) o.push([+q[0],+q[1]]) });
  while(o.length>2 && Math.abs(o[0][0]-o[o.length-1][0])<=tol && Math.abs(o[0][1]-o[o.length-1][1])<=tol) o.pop(); return o }

/* lote a partir de vértices [lat,lon]: origem no centroide, anti-horário */
function geoLoteDePares(pares){
  const P = geoLimpaAnel(pares, 1e-10); if(P.length<3) return null;
  const lat0=P.reduce((s,p)=>s+p[0],0)/P.length, lon0=P.reduce((s,p)=>s+p[1],0)/P.length;
  const r0=geoRef(lat0,lon0), loc=P.map(([la,lo])=>geoParaLocal(la,lo,r0)), c=geoCentroide(loc), [lat,lon]=geoDeLocal(c[0],c[1],r0);
  const ref=geoRef(lat,lon); let pts=P.map(([la,lo])=>geoParaLocal(la,lo,ref));
  if(geoSArea(pts)<0) pts=pts.reverse();
  return { pts: pts.map(q=>[+q[0].toFixed(3), +q[1].toFixed(3)]), lat:+lat.toFixed(7), lon:+lon.toFixed(7), area:Math.abs(geoSArea(pts)) };
}

/* GeoJSON (Feature, FeatureCollection, Polygon, MultiPolygon) → maior anel externo como [[lat,lon]…].
   Coordenadas projetadas (valores > 180) são tratadas como UTM: zona pelo "crs" ou pela longitude de referência (o.lonRef). */
function geoLerGeoJSON(src, o={}){
  let g = src; if(typeof g==="string"){ try{ g=JSON.parse(g) }catch(e){ return {erro:"O arquivo não é um GeoJSON válido."} } }
  if(!g || typeof g!=="object") return {erro:"O arquivo não é um GeoJSON válido."};
  const aneis=[];
  const geom = gm => { if(!gm) return;
    if(gm.type==="Polygon" && Array.isArray(gm.coordinates)) aneis.push(gm.coordinates[0]);
    else if(gm.type==="MultiPolygon") (gm.coordinates||[]).forEach(p=>p && aneis.push(p[0]));
    else if(gm.type==="LineString" && gm.coordinates && gm.coordinates.length>3) aneis.push(gm.coordinates);
    else if(gm.type==="GeometryCollection") (gm.geometries||[]).forEach(geom) };
  if(g.type==="FeatureCollection") (g.features||[]).forEach(f=>geom(f && f.geometry));
  else if(g.type==="Feature") geom(g.geometry);
  else geom(g);
  const ok = aneis.map(r=>geoLimpaAnel((r||[]).filter(q=>Array.isArray(q)&&isFinite(q[0])&&isFinite(q[1])))).filter(r=>r.length>=3);
  if(!ok.length) return {erro:"Nenhum polígono encontrado no GeoJSON."};
  const proj = ok.some(r=>r.some(q=>Math.abs(q[0])>180||Math.abs(q[1])>90));
  let zona=null, sul=true;
  if(proj){ const z=geoZonaDoCrs(g.crs); if(z){ zona=z.zona; sul=z.sul } else { zona=geoZonaDeLon(isFinite(o.lonRef)? o.lonRef : -49.37); sul=!(isFinite(o.latRef) && o.latRef>0) } }
  // maior polígono (área em metros, aproximada)
  const toPares = r => proj ? r.map(([E,N])=>geoUtmParaLatLon(E,N,zona,sul)) : r.map(([lon,lat])=>[lat,lon]);
  const cand = ok.map(r=>{ const p=toPares(r), lp=geoLoteDePares(p); return {pares:p, area: lp? lp.area : 0} }).sort((a,b)=>b.area-a.area);
  return { pares: cand[0].pares, area: cand[0].area, n: ok.length, utm: proj, zona };
}

/* ---- entorno a partir do OpenStreetMap (JSON do Overpass com "out geom") ---- */
function geoAltura(tags){
  const num = v => { if(v==null) return NaN; const m=String(v).replace(",",".").match(/-?\d+(?:\.\d+)?/); if(!m) return NaN; let x=+m[0]; if(/ft|'/.test(String(v))) x*=0.3048; return x };
  const h = num(tags.height) || num(tags["building:height"]);
  if(h>0) return {h, est:false, fonte:"altura"};
  const lv = num(tags["building:levels"]), rl = num(tags["roof:levels"]);
  if(lv>0) return {h: lv*3 + (rl>0? rl*3 : 0), est:false, fonte:"pavimentos", pav:lv};
  return {h:6, est:true, fonte:"padrão"};
}
const geoOverpassQuery = (lat, lon, raio=150) => `[out:json][timeout:25];(way["building"](around:${Math.round(raio)},${lat},${lon});relation["building"](around:${Math.round(raio)},${lat},${lon}););out geom;`;
/* json: resposta do Overpass · ref: geoRef da origem do lote · lote: polígono local (prédios que tocam o lote ficam de fora)
   o.raio (m, padrão 150) · o.max (padrão 400, os mais próximos) · o.areaMin (m², padrão 6) */
function geoEntornoDeOverpass(json, ref, lote, o={}){
  const raio=o.raio||150, max=o.max||400, areaMin=o.areaMin??6, out=[];
  const els = (json && json.elements) || [];
  const add = (geom, tags, id) => {
    if(!Array.isArray(geom) || geom.length<4) return;
    let p = geoLimpaAnel(geom.filter(n=>n && isFinite(n.lat) && isFinite(n.lon)).map(n=>geoParaLocal(n.lat, n.lon, ref)), 1e-4);
    if(p.length<3) return;
    const A = geoSArea(p); if(Math.abs(A)<areaMin) return; if(A<0) p=p.reverse();
    const c = geoCentroide(p), d = Math.hypot(c[0], c[1]);
    if(d>raio*1.15) return;
    if(lote && lote.length>2 && (geoPip(c,lote) || p.some(q=>geoPip(q,lote)) || lote.some(q=>geoPip(q,p)))) return;
    const al = geoAltura(tags||{});
    const nome = (tags && tags.name) ? String(tags.name).slice(0,40) : al.pav ? `OSM · ${al.pav} pav` : al.est ? "OSM · altura estimada" : `OSM · ${Math.round(al.h)} m`;
    out.push({ pts: p.map(q=>[+q[0].toFixed(2), +q[1].toFixed(2)]), h:+al.h.toFixed(1), nome, osm:id, est:al.est, _d:d });
  };
  els.forEach(e=>{
    if(e.type==="way" && e.geometry) add(e.geometry, e.tags, "w"+e.id);
    else if(e.type==="relation" && Array.isArray(e.members)) e.members.filter(mb=>mb.role!=="inner" && Array.isArray(mb.geometry)).forEach((mb,k)=>{
      const g=mb.geometry, f=g[0], l=g[g.length-1]; if(f && l && Math.abs(f.lat-l.lat)<1e-9 && Math.abs(f.lon-l.lon)<1e-9) add(g, e.tags, "r"+e.id+"."+k) });
  });
  out.sort((a,b)=>a._d-b._d);
  return out.slice(0,max).map(({_d,...r})=>r);
}
