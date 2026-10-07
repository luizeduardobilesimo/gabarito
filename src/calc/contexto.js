/* ================= contexto urbano do OpenStreetMap (cálculo puro: Node, Worker e página) =================
   Uma única consulta ao Overpass traz edificações, vias, calçadas, ciclovias, água (rios, lagos, mar), praia, verde,
   praças e estacionamentos. Tudo vira o sistema local do Gabarito (x = leste, y = norte, metros, origem no lote).
   ctxOverpassQuery(lat,lon,raioPred,raioCtx) → texto da consulta (uma só)
   ctxDeOverpass(json, ref, o)  → dados do contexto {vias, calcadas, ciclovias, rios, agua, mar, areia, verde, pracas, estac, n}
       o.raio (m, recorte em círculo) · o.norte (graus, gira junto com a planta)
   ctxEntornoOSM(json, ref, lote, o) → edificações para S.entorno, classificadas (tipo: casa | residencial | comercial | outro)
   ctxFaixa(pts, w) / ctxFaixaLR(pts, w) → linha com largura vira polígono (ou bordas esquerda/direita para o 3D)
   Estado: S.contexto = {camadas:{ruas,calcadas,agua,verde,casas,predios}, raio, dados}. As edificações continuam em S.entorno
   (editáveis, valem para sol e vento); água, vias e verde só desenham, não fazem sombra. */
extendDEF("contexto", { camadas:{ ruas:true, calcadas:true, agua:true, verde:true, casas:true, predios:true }, raio:350, dados:null });

const CTX_VIA_W = { motorway:15, motorway_link:7, trunk:12, trunk_link:6.5, primary:11, primary_link:6.5, secondary:9.5, secondary_link:6,
  tertiary:8, tertiary_link:5.5, unclassified:6.5, residential:7, living_street:5.5, service:4.5, track:3.5, road:6.5, busway:7 };
const CTX_CAL_PADRAO = new Set(["primary","primary_link","secondary","secondary_link","tertiary","tertiary_link","residential"]);
const CTX_PED_W = { footway:2, path:1.6, pedestrian:4, steps:2, bridleway:2 };
const CTX_RIO_W = { river:12, stream:3, canal:6, drain:1.5, ditch:1.2, tidal_channel:6 };
const CTX_CAL_W = 2.4, CTX_TOL = 0.3, CTX_TAU = Math.PI*2;

function ctxNum(v){ if(v==null) return NaN; const m=String(v).replace(",",".").match(/-?\d+(?:\.\d+)?/); if(!m) return NaN; let x=+m[0]; if(/ft|'/.test(String(v))) x*=0.3048; return x }
/* quadrado da saída "out geom(bbox)": no sistema local é exatamente [-d,d]² (a projeção é linear) */
function ctxBBox(lat, lon, raio){ const r=geoRef(lat,lon), d=raio*1.3, [s,w]=geoDeLocal(-d,-d,r), [n,e]=geoDeLocal(d,d,r); return {s,w,n,e,d} }

/* uma consulta só: edificações no raio da planta; o resto no raio do contexto. Geometria cortada no quadrado (out geom(bbox)):
   os pontos fora dele vêm como null — o que sobra é fechado pela borda do quadrado e recortado no círculo. */
function ctxOverpassQuery(lat, lon, raioPred=150, raioCtx=350){
  const rb=Math.round(raioPred), rc=Math.round(Math.max(raioCtx, raioPred)), A=`(around:${rc},${lat},${lon})`, B=`(around:${rb},${lat},${lon})`;
  const b=ctxBBox(lat,lon,rc), BB=`(${b.s.toFixed(6)},${b.w.toFixed(6)},${b.n.toFixed(6)},${b.e.toFixed(6)})`;
  return `[out:json][timeout:50];`+
    `(way["building"]${B};way["highway"]${A};way["waterway"]${A};way["natural"~"^(water|beach|sand|wood|scrub|grassland|wetland|heath|coastline)$"]${A};`+
    `way["landuse"~"^(grass|reservoir|basin|forest|meadow|recreation_ground|village_green|cemetery)$"]${A};way["leisure"~"^(park|garden|pitch|playground|common)$"]${A};`+
    `way["amenity"="parking"]${A};way["place"="square"]${A};way["water"]${A};)->.a;.a out geom${BB};`+
    `relation["building"]${B};out geom${BB};`+
    `(relation["natural"~"^(water|beach|sand|wood|scrub|wetland)$"]${A};relation["landuse"~"^(grass|reservoir|basin|forest|meadow)$"]${A};`+
    `relation["leisure"~"^(park|garden)$"]${A};relation["water"]${A};relation["place"="square"]${A};)->.r;.r out body;way(r.r)->.m;.m out geom${BB};`;
}

/* ---------- geometria auxiliar ---------- */
const ctxR1 = p => p.map(q=>[Math.round(q[0]*10)/10, Math.round(q[1]*10)/10]);
function ctxDP(pts, tol=CTX_TOL){                // Douglas–Peucker (linha aberta)
  const n=pts.length; if(n<3) return pts.slice();
  const keep=new Uint8Array(n); keep[0]=keep[n-1]=1; const st=[[0,n-1]], t2=tol*tol;
  while(st.length){ const [a,b]=st.pop(), A=pts[a], B=pts[b], dx=B[0]-A[0], dy=B[1]-A[1], L=dx*dx+dy*dy; let mx=-1, mi=-1;
    for(let i=a+1;i<b;i++){ const P=pts[i]; let d;
      if(L<1e-12) d=(P[0]-A[0])**2+(P[1]-A[1])**2;
      else { const t=Math.max(0,Math.min(1,((P[0]-A[0])*dx+(P[1]-A[1])*dy)/L)); d=(P[0]-A[0]-t*dx)**2+(P[1]-A[1]-t*dy)**2 }
      if(d>mx){ mx=d; mi=i } }
    if(mx>t2){ keep[mi]=1; st.push([a,mi],[mi,b]) } }
  return pts.filter((_,i)=>keep[i]);
}
function ctxDPAnel(r, tol=CTX_TOL){            // anel fechado: corta no ponto mais distante do primeiro
  if(r.length<5) return r.slice(); let k=0, d=-1; r.forEach((q,i)=>{ const e=(q[0]-r[0][0])**2+(q[1]-r[0][1])**2; if(e>d){ d=e; k=i } });
  const a=ctxDP(r.slice(0,k+1),tol), b=ctxDP([...r.slice(k), r[0]],tol); return [...a, ...b.slice(1,-1)];
}
const ctxSArea = p => { let a=0; for(let i=0;i<p.length;i++){ const q=p[i], r=p[(i+1)%p.length]; a+=q[0]*r[1]-r[0]*q[1] } return a/2 };
function ctxCirculo(R, n=72){ const k=R/Math.cos(Math.PI/n), o=[]; for(let i=0;i<n;i++){ const a=i/n*CTX_TAU; o.push([Math.cos(a)*k, Math.sin(a)*k]) } return o }
/* recorte de polígono por polígono convexo anti-horário (Sutherland–Hodgman) */
function ctxClipConvexo(poly, clip){
  let out=poly;
  for(let i=0;i<clip.length && out.length;i++){ const A=clip[i], B=clip[(i+1)%clip.length], inp=out; out=[];
    const lado=p=>(B[0]-A[0])*(p[1]-A[1])-(B[1]-A[1])*(p[0]-A[0]);
    for(let j=0;j<inp.length;j++){ const P=inp[j], Q=inp[(j+1)%inp.length], sp=lado(P), sq=lado(Q);
      if(sp>=0) out.push(P);
      if((sp>=0)!==(sq>=0)){ const t=sp/(sp-sq); out.push([P[0]+(Q[0]-P[0])*t, P[1]+(Q[1]-P[1])*t]) } } }
  return out;
}
/* linha recortada no círculo de raio R (centro na origem): trechos [{pts, ini, fim}] — ini/fim = começa/termina na borda */
function ctxClipLinha(pts, R){
  const out=[]; let cur=null, R2=R*R;
  for(let i=0;i<pts.length-1;i++){ const a=pts[i], b=pts[i+1], dx=b[0]-a[0], dy=b[1]-a[1], A=dx*dx+dy*dy;
    if(A<1e-12) continue;
    const Bq=2*(a[0]*dx+a[1]*dy), C=a[0]*a[0]+a[1]*a[1]-R2, D=Bq*Bq-4*A*C;
    if(D<=0){ if(cur){ out.push(cur); cur=null } continue }
    const s=Math.sqrt(D), t0=(-Bq-s)/(2*A), t1=(-Bq+s)/(2*A), te=Math.max(0,t0), ts=Math.min(1,t1);
    if(te>=ts){ if(cur){ out.push(cur); cur=null } continue }
    const pA=[a[0]+dx*te, a[1]+dy*te], pB=[a[0]+dx*ts, a[1]+dy*ts];
    if(!cur) cur={pts:[pA], ini: t0>0, fim:false};
    cur.pts.push(pB);
    if(ts<1){ cur.fim=true; out.push(cur); cur=null }
  }
  if(cur) out.push(cur);
  return out.filter(c=>c.pts.length>1);
}
/* perímetro do quadrado [-D,D]² parametrizado em t ∈ [0,4), anti-horário a partir do canto (D,-D) */
function ctxPerimT(p, D){ const x=Math.max(-D,Math.min(D,p[0])), y=Math.max(-D,Math.min(D,p[1]));
  if(Math.abs(p[0])>=Math.abs(p[1])) return p[0]>=0 ? (y+D)/(2*D) : 2+(D-y)/(2*D);
  return p[1]>=0 ? 1+(D-x)/(2*D) : 3+(x+D)/(2*D) }
function ctxPerimP(t, D){ t=((t%4)+4)%4; const s=Math.floor(t), f=t-s;
  return s===0? [D,-D+2*D*f] : s===1? [D-2*D*f, D] : s===2? [-D, D-2*D*f] : [-D+2*D*f, -D] }
function ctxPerimCaminho(t0, t1, D, dir){       // pontos dos cantos entre t0 e t1 (dir +1 anti-horário, −1 horário) e o ponto final
  const o=[]; let L = dir>0 ? ((t1-t0)%4+4)%4 : ((t0-t1)%4+4)%4;
  const cantos=[]; for(let k=0;k<4;k++){ const d = dir>0 ? ((k-t0)%4+4)%4 : ((t0-k)%4+4)%4; if(d>1e-9 && d<L-1e-9) cantos.push([d,k]) }
  cantos.sort((a,b)=>a[0]-b[0]).forEach(([_,k])=>o.push(ctxPerimP(k,D))); o.push(ctxPerimP(t1,D)); return o;
}
/* anel com pontos desconhecidos (null = fora do quadrado da consulta) → anel completo: cada lacuna vira um caminho pela borda do quadrado.
   hint (centro do contorno inteiro, se fora do quadrado) escolhe o lado por onde o contorno real passa; senão, o caminho mais curto. */
function ctxFechaAnel(seq, D, hint){
  let s=seq.slice(); if(s.length>1 && s[0] && s[s.length-1] && s[0][0]===s[s.length-1][0] && s[0][1]===s[s.length-1][1]) s.pop();
  if(!s.some(q=>!q)) return s.filter(Boolean);
  if(!s.some(Boolean)) return null;
  const n=s.length; let k=s.findIndex((q,i)=>q && !s[(i-1+n)%n]); s=[...s.slice(k), ...s.slice(0,k)];
  const out=[], fora = hint && (Math.abs(hint[0])>D || Math.abs(hint[1])>D);
  for(let i=0;i<n;i++){
    if(s[i]){ out.push(s[i]); continue }
    let j=i; while(j<n && !s[j]) j++;
    const A=out[out.length-1], B=s[j%n], tA=ctxPerimT(A,D), tB=ctxPerimT(B,D);
    const ccw=((tB-tA)%4+4)%4, cw=4-ccw; let dir = ccw<=cw ? 1 : -1;
    if(fora){ const mid=d=>ctxPerimP(tA+d*(d>0? ccw : cw)/2, D), dh=p=>(p[0]-hint[0])**2+(p[1]-hint[1])**2; dir = dh(mid(1))<=dh(mid(-1)) ? 1 : -1 }
    out.push(ctxPerimP(tA,D), ...ctxPerimCaminho(tA, tB, D, dir));
    i=j-1;
  }
  return out;
}
/* anéis de uma relação multipolígono pela sequência de nós (ids): {ids, seq} juntados pelas pontas */
function ctxAneis(lista){
  const rest=lista.filter(w=>w.ids && w.ids.length>1), out=[];
  while(rest.length){
    const w=rest.shift(); const ids=w.ids.slice(), seq=w.seq.slice(); let g=0;
    while(ids[0]!==ids[ids.length-1] && g++<20000){
      const last=ids[ids.length-1], k=rest.findIndex(x=>x.ids[0]===last || x.ids[x.ids.length-1]===last); if(k<0) break;
      const x=rest.splice(k,1)[0]; let xi=x.ids, xs=x.seq; if(xi[0]!==last){ xi=xi.slice().reverse(); xs=xs.slice().reverse() }
      ids.push(...xi.slice(1)); seq.push(...xs.slice(1));
    }
    if(ids.length>3 && ids[0]===ids[ids.length-1]) out.push({ids, seq});
  }
  return out;
}
/* mar a partir dos trechos da linha da costa (terra à esquerda, mar à direita), recortado no círculo R */
function ctxMar(cadeias, R){
  const pec=[]; cadeias.forEach(c=>ctxClipLinha(c,R).forEach(p=>{ if(p.ini && p.fim){ const a=p.pts[0], b=p.pts[p.pts.length-1]; pec.push({pts:p.pts, a0:Math.atan2(a[1],a[0]), a1:Math.atan2(b[1],b[0])}) } }));
  if(!pec.length) return [];
  const ang=a=>((a%CTX_TAU)+CTX_TAU)%CTX_TAU, usado=new Set(), polys=[], passo=CTX_TAU/96;
  for(let i=0;i<pec.length;i++){ if(usado.has(i)) continue;
    const ring=[]; let cur=i, g=0;
    while(g++<pec.length+2){
      usado.add(cur); const pc=pec[cur]; ring.push(...pc.pts.slice().reverse());   // do ponto de saída ao de entrada: mar à esquerda
      let best=-1, bd=Infinity;
      pec.forEach((q,k)=>{ if(usado.has(k) && k!==i) return; let d=ang(q.a1-pc.a0); if(d<1e-9) d=CTX_TAU; if(d<bd){ bd=d; best=k } });
      if(best<0) break;
      for(let t=passo; t<bd-1e-6; t+=passo){ const a=pc.a0+t; ring.push([Math.cos(a)*R, Math.sin(a)*R]) }   // pela borda, anti-horário
      if(best===i) break; cur=best;
    }
    if(ring.length>2 && Math.abs(ctxSArea(ring))>4) polys.push(ring);
  }
  return polys;
}
/* deslocamento de uma linha (esquerda > 0) com meia-esquadria limitada */
function ctxOffset(pts, off){
  const n=pts.length, o=[];
  const nor=(a,b)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], l=Math.hypot(dx,dy)||1; return [-dy/l, dx/l] };
  for(let i=0;i<n;i++){
    let v, k=1;
    if(i===0) v=nor(pts[0],pts[1]); else if(i===n-1) v=nor(pts[n-2],pts[n-1]);
    else { const a=nor(pts[i-1],pts[i]), b=nor(pts[i],pts[i+1]), m=[a[0]+b[0], a[1]+b[1]], l=Math.hypot(m[0],m[1]);
      if(l<1e-6) v=a; else { v=[m[0]/l, m[1]/l]; k=1/Math.max(0.4, v[0]*b[0]+v[1]*b[1]) } }
    o.push([pts[i][0]+v[0]*off*k, pts[i][1]+v[1]*off*k]);
  }
  return o;
}
/* faixa: bordas esquerda e direita (3D) e polígono (2D / exportação) */
function ctxFaixaLR(pts, w){ return { L: ctxOffset(pts, w/2), R: ctxOffset(pts, -w/2) } }
function ctxFaixa(pts, w){ if(!pts || pts.length<2) return []; const f=ctxFaixaLR(pts,w); return [...f.L, ...f.R.reverse()] }
/* comprimento acumulado e trecho [s0,s1] de uma linha */
function ctxAcum(p){ const s=[0]; for(let i=1;i<p.length;i++) s.push(s[i-1]+Math.hypot(p[i][0]-p[i-1][0], p[i][1]-p[i-1][1])); return s }
function ctxTrecho(p, s, s0, s1){
  const at=t=>{ let i=1; while(i<s.length-1 && s[i]<t) i++; const a=p[i-1], b=p[i], L=(s[i]-s[i-1])||1, k=Math.max(0,Math.min(1,(t-s[i-1])/L)); return [a[0]+(b[0]-a[0])*k, a[1]+(b[1]-a[1])*k] };
  const o=[at(s0)]; for(let i=0;i<p.length;i++) if(s[i]>s0+1e-6 && s[i]<s1-1e-6) o.push(p[i]); o.push(at(s1)); return o;
}
/* gira o desenho junto com a planta (S.lote.norte) */
function ctxGira(norte){ const a=(+norte||0)*Math.PI/180; if(!a) return p=>p; const c=Math.cos(a), s=Math.sin(a); return p=>p && [p[0]*c+p[1]*s, -p[0]*s+p[1]*c] }

/* ---------- classificação das edificações ---------- */
function ctxClasse(tags, h, area){
  tags=tags||{}; const b=String(tags.building||"yes").toLowerCase();
  if(/^(house|detached|semidetached_house|bungalow|cabin|farm|terrace|hut)$/.test(b)) return h>10? "residencial" : "casa";
  if(/^(apartments|residential|dormitory)$/.test(b)) return (b==="residential" && h<=7 && !tags["building:levels"]) || (b==="residential" && h<=7 && area<300) ? "casa" : "residencial";
  if(/^(commercial|retail|office|hotel|supermarket|kiosk|mall|shop|bank)$/.test(b) || tags.shop || tags.office || /^(hotel|motel|hostel)$/.test(tags.tourism||"")) return "comercial";
  if(b==="yes" && !tags.amenity && h<=7 && area>=25 && area<=320) return "casa";
  return "outro";
}
/* edificações para S.entorno (o mesmo de geoEntornoDeOverpass, com tipo e girando com a planta) */
function ctxEntornoOSM(json, ref, lote, o={}){
  const els=((json && json.elements)||[]).filter(e=>e.tags && e.tags.building && (e.type==="way" || (e.type==="relation" && Array.isArray(e.members) && e.members.some(m=>m.geometry))));
  const tg={}; els.forEach(e=>{ tg[(e.type==="way"?"w":"r")+e.id]=e.tags });
  const gi=ctxGira(o.norte), loteGeo = lote && (+o.norte) ? lote.map(ctxGira(-o.norte)) : lote;  // o filtro do lote trabalha no referencial geográfico
  const ent=geoEntornoDeOverpass({elements:els}, ref, loteGeo, o);
  ent.forEach(e=>{ const t=tg[String(e.osm).split(".")[0]]||{}; e.tipo=ctxClasse(t, e.h, Math.abs(ctxSArea(e.pts))); if(+o.norte) e.pts=e.pts.map(q=>{ const r=gi(q); return [+r[0].toFixed(2), +r[1].toFixed(2)] }) });
  return ent;
}

/* ---------- contexto: vias, calçadas, água, verde… ---------- */
function ctxLarguraVia(t){
  const hw=t.highway, w=ctxNum(t.width); if(w>1 && w<60) return w;
  const ln=ctxNum(t.lanes); let base = ln>0 ? Math.max(3.2, ln*3.2) : (CTX_VIA_W[hw]||6) * (t.oneway==="yes" && !(ln>0) ? 0.72 : 1);
  if(hw==="service" && /parking_aisle/.test(t.service||"")) base=Math.max(base,5.5); if(hw==="service" && /driveway|alley/.test(t.service||"")) base=Math.min(base,3.5);
  const est=v=>/^(lane|half_on_kerb|on_kerb|street_side|on_street|parallel|diagonal|perpendicular)$/.test(String(v||""));
  const pl = est(t["parking:both"])||est(t["parking:lane:both"]) ? 2 : (est(t["parking:left"])||est(t["parking:lane:left"]) ? 1:0) + (est(t["parking:right"])||est(t["parking:lane:right"]) ? 1:0);
  return base + pl*2.3;
}
/* lados com calçada: [esquerda, direita] em metros (0 = sem) */
function ctxLadosCalcada(t){
  const v=s=>String(s||"").toLowerCase(), sw=v(t.sidewalk), W=ctxNum(t["sidewalk:width"])>0.5 ? ctxNum(t["sidewalk:width"]) : CTX_CAL_W;
  const lado=k=>{ const x=v(t["sidewalk:"+k]); return x==="yes"||x==="both"? true : x==="no"||x==="separate"||x==="none"? false : null };
  let L=null, R=null;
  if(/^(both|yes)$/.test(sw)){ L=R=true } else if(sw==="left"){ L=true; R=false } else if(sw==="right"){ L=false; R=true } else if(/^(no|none|separate)$/.test(sw)){ L=R=false }
  const b=lado("both"); if(b!=null){ L=R=b } const l=lado("left"); if(l!=null) L=l; const r=lado("right"); if(r!=null) R=r;
  if(L==null && R==null){ const d=CTX_CAL_PADRAO.has(t.highway); L=R=d }
  const wl=ctxNum(t["sidewalk:left:width"]), wr=ctxNum(t["sidewalk:right:width"]);
  return [L? (wl>0.5? wl : W) : 0, R? (wr>0.5? wr : W) : 0];
}
function ctxDeOverpass(json, ref, o={}){
  const R=o.raio||350, D=R*1.3+1, els=(json && json.elements)||[], gi=ctxGira(o.norte), Rc=R*1.02;
  const ways=new Map(), rels=[];
  els.forEach(e=>{ if(e.type==="way" && !ways.has(e.id)) ways.set(e.id,e); else if(e.type==="relation" && !(e.tags||{}).building) rels.push(e) });
  const P=n=> n && isFinite(n.lat) && isFinite(n.lon) ? geoParaLocal(n.lat, n.lon, ref) : null;
  const seqC=new Map(), seqDe=e=>{ let s=seqC.get(e.id); if(!s){ s=(e.geometry||[]).map(P); seqC.set(e.id,s) } return s };
  const centro=bs=>{ if(!bs.length) return null; let s=Infinity,w=Infinity,n=-Infinity,e=-Infinity; bs.forEach(b=>{ if(!b) return; s=Math.min(s,b.minlat); w=Math.min(w,b.minlon); n=Math.max(n,b.maxlat); e=Math.max(e,b.maxlon) }); return isFinite(s)? geoParaLocal((s+n)/2,(w+e)/2,ref) : null };
  const corrida=seq=>{ const o=[]; let c=[]; seq.forEach(q=>{ if(q) c.push(q); else { if(c.length>1) o.push(c); c=[] } }); if(c.length>1) o.push(c); return o };   // trechos conhecidos
  const out={ vias:[], calcadas:[], ciclovias:[], rios:[], agua:[], mar:[], areia:[], verde:[], pracas:[], estac:[] };
  const circ=ctxCirculo(Rc);
  // ---- áreas ----
  const area=(ring, lista, extra)=>{ if(!ring || ring.length<3) return; let p=ctxClipConvexo(ring, circ); if(p.length<3) return; p=ctxDPAnel(p); if(p.length<3) return;
    const A=ctxSArea(p); if(Math.abs(A)<4) return; if(A<0) p=p.reverse(); lista.push(Object.assign({p:ctxR1(p.map(gi))}, extra||{})) };
  const classeArea=t=>{ t=t||{};
    if(t.natural==="water" || t.water || /^(reservoir|basin)$/.test(t.landuse||"") || t.waterway==="riverbank") return ["agua"];
    if(/^(beach|sand)$/.test(t.natural||"")) return ["areia"];
    if(/^(wood|scrub|heath)$/.test(t.natural||"") || t.landuse==="forest") return ["verde",{k:"mata"}];
    if(/^(grassland|wetland)$/.test(t.natural||"") || /^(grass|meadow|recreation_ground|village_green|cemetery)$/.test(t.landuse||"") || /^(park|garden|common|playground)$/.test(t.leisure||"")) return ["verde"];
    if(t.leisure==="pitch") return ["verde",{k:"campo"}];
    if(t.amenity==="parking" && !/^(underground|multi-storey|rooftop)$/.test(t.parking||"") && !t.building) return ["estac"];
    if(t.place==="square" || (t.highway && (t.area==="yes" || t["area:highway"]))) return ["pracas"];
    return null };
  const fechado=e=>e.nodes && e.nodes.length>3 && e.nodes[0]===e.nodes[e.nodes.length-1];
  const bounds=e=>e.bounds;
  // ---- vias: junções por nó (para abrir as calçadas nos cruzamentos) ----
  const viaWays=[]; ways.forEach(e=>{ const t=e.tags||{};
    if(!t.highway || t.building) return;
    if(/^(proposed|construction|abandoned|razed|platform|corridor|elevator|raceway|bus_stop)$/.test(t.highway) || /^(yes|building_passage|culvert)$/.test(t.tunnel||"") || ctxNum(t.layer)<0) return;
    if(t.area==="yes" && fechado(e)) return;   // área (praça): vai para as áreas
    viaWays.push(e) });
  const nosVia=new Map();   // nó → [{e, i}] (só vias de veículos)
  viaWays.forEach(e=>{ if(!CTX_VIA_W[e.tags.highway]) return; (e.nodes||[]).forEach((id,i)=>{ let l=nosVia.get(id); if(!l) nosVia.set(id,l=[]); l.push({e,i}) }) });
  const larg=new Map(); viaWays.forEach(e=>larg.set(e.id, ctxLarguraVia(e.tags)));
  viaWays.forEach(e=>{
    const t=e.tags, hw=t.highway, seq=seqDe(e), nome=t.name? String(t.name).slice(0,48) : undefined;
    const ciclo = hw==="cycleway" || (hw==="path" && /designated/.test(t.bicycle||"")), ped = CTX_PED_W[hw]!=null && !ciclo, veic=!!CTX_VIA_W[hw];
    if(!veic && !ped && !ciclo) return;
    if(ped || ciclo){ const w=ctxNum(t.width)>0.5 && ctxNum(t.width)<15 ? ctxNum(t.width) : ciclo? 2.4 : t.footway==="sidewalk"? CTX_CAL_W : CTX_PED_W[hw];
      if(t.footway==="crossing" || t.footway==="traffic_island") return;
      corrida(seq).forEach(c=>ctxClipLinha(c,Rc).forEach(p=>{ const q=ctxDP(p.pts); if(q.length<2) return;
        (ciclo? out.ciclovias : out.calcadas).push(Object.assign({p:ctxR1(q.map(gi)), w:+w.toFixed(1)}, !ciclo && t.footway!=="sidewalk"? {k:"cam"} : {})) }));
      return }
    const w=larg.get(e.id), v={w:+w.toFixed(1), t:hw}; if(nome) v.n=nome; if(t.oneway==="yes"||t.oneway==="1"||t.oneway==="-1"||t.junction==="roundabout") v.um=1;
    corrida(seq).forEach(c=>ctxClipLinha(c,Rc).forEach(p=>{ const q=ctxDP(p.pts); if(q.length>1) out.vias.push(Object.assign({p:ctxR1(q.map(gi))}, v)) }));
    // calçadas dos dois lados, abertas nos cruzamentos (só do lado em que a outra via chega)
    const [cl, cr]=ctxLadosCalcada(t); if(!(cl||cr)) return;
    const ids=e.nodes||[], n=ids.length; if(n<2 || seq.length!==n) return;
    let ini=0; while(ini<n){ while(ini<n && !seq[ini]) ini++; let fim=ini; while(fim<n && seq[fim]) fim++;
      if(fim-ini>1){ const pts=seq.slice(ini,fim), s=ctxAcum(pts), cortes=[[],[]];   // [esquerda, direita]: intervalos [s0,s1]
        for(let k=0;k<pts.length;k++){ const l=nosVia.get(ids[ini+k]); if(!l || l.length<2) continue;
          const a=pts[Math.max(0,k-1)], b=pts[Math.min(pts.length-1,k+1)], dx=b[0]-a[0], dy=b[1]-a[1], dl=Math.hypot(dx,dy)||1, nl=[-dy/dl, dx/dl];
          l.forEach(({e:x,i})=>{ if(x===e) return; const xs=seqDe(x), c=xs[i]; if(!c) return; const wx=larg.get(x.id)||6;
            [xs[i-1], xs[i+1]].forEach(q=>{ if(!q) return; const lado=(q[0]-c[0])*nl[0]+(q[1]-c[1])*nl[1], d=wx/2+Math.max(cl,cr)+0.6;
              if(lado>=-0.5) cortes[0].push([s[k]-d, s[k]+d]); if(lado<=0.5) cortes[1].push([s[k]-d, s[k]+d]) }) }) }
        [[cl,1,0],[cr,-1,1]].forEach(([wc,sg,ix])=>{ if(!wc) return;
          const iv=cortes[ix].sort((a,b)=>a[0]-b[0]); let s0=0; const tot=s[s.length-1], pecas=[];
          iv.forEach(([a,b])=>{ if(a>s0) pecas.push([s0,Math.min(a,tot)]); s0=Math.max(s0,b) }); if(s0<tot) pecas.push([s0,tot]);
          pecas.forEach(([a,b])=>{ if(b-a<1.5) return; const tr=ctxTrecho(pts, s, a, b), off=ctxOffset(tr, sg*(w/2+wc/2));
            ctxClipLinha(off,Rc).forEach(p=>{ const q=ctxDP(p.pts); if(q.length>1) out.calcadas.push({p:ctxR1(q.map(gi)), w:+wc.toFixed(1)}) }) }) }) }
      ini=fim }
  });
  // ---- rios (linhas) ----
  ways.forEach(e=>{ const t=e.tags||{}, wt=t.waterway; if(!wt || !CTX_RIO_W[wt] || /^(yes|culvert)$/.test(t.tunnel||"") || ctxNum(t.layer)<0) return;
    const w=ctxNum(t.width)>0.5 && ctxNum(t.width)<300 ? ctxNum(t.width) : CTX_RIO_W[wt];
    corrida(seqDe(e)).forEach(c=>ctxClipLinha(c,Rc).forEach(p=>{ const q=ctxDP(p.pts); if(q.length>1) out.rios.push(Object.assign({p:ctxR1(q.map(gi)), w:+w.toFixed(1)}, t.name? {n:String(t.name).slice(0,48)} : {})) })) });
  // ---- áreas fechadas (ways) ----
  ways.forEach(e=>{ const t=e.tags; if(!t || t.building) return; const c=classeArea(t); if(!c || !fechado(e)) return;
    area(ctxFechaAnel(seqDe(e), D, centro([bounds(e)])), out[c[0]], c[1]) });
  // ---- relações multipolígono (anéis externos pelos ids dos nós) ----
  rels.forEach(r=>{ const c=classeArea(r.tags); if(!c) return;
    const mem=(r.members||[]).filter(m=>m.type==="way" && m.role!=="inner").map(m=>ways.get(m.ref)).filter(Boolean);
    const hint=centro(mem.map(bounds));
    ctxAneis(mem.map(w=>({ids:w.nodes||[], seq:seqDe(w)}))).forEach(an=>area(ctxFechaAnel(an.seq, D, hint), out[c[0]], c[1])) });
  // ---- mar: linha da costa juntada pelos nós, terra à esquerda ----
  const costa=[]; ways.forEach(e=>{ if((e.tags||{}).natural==="coastline" && e.nodes && e.nodes.length>1) costa.push({ids:e.nodes, seq:seqDe(e)}) });
  if(costa.length){
    const porIni=new Map(), porFim=new Map(), usado=new Set(), cadeias=[];
    costa.forEach(c=>{ porIni.set(c.ids[0], c); porFim.set(c.ids[c.ids.length-1], c) });
    costa.forEach(c=>{ if(usado.has(c)) return; let ini=c, g=0;      // volta até o começo da cadeia
      while(porFim.get(ini.ids[0]) && porFim.get(ini.ids[0])!==c && !usado.has(porFim.get(ini.ids[0])) && g++<5000) ini=porFim.get(ini.ids[0]);
      let seq=[], cur=ini; g=0;
      while(cur && !usado.has(cur) && g++<5000){ usado.add(cur); seq.push(...(seq.length? cur.seq.slice(1) : cur.seq)); cur=porIni.get(cur.ids[cur.ids.length-1]) }
      corrida(seq).forEach(k=>cadeias.push(k)) });
    ctxMar(cadeias, Rc).forEach(p=>area(p, out.mar));
  }
  // limites (o estudo não pode ficar pesado)
  const lim={vias:1500, calcadas:3000, ciclovias:400, rios:200, agua:300, mar:20, areia:200, verde:800, pracas:400, estac:600};
  Object.keys(lim).forEach(k=>{ if(out[k].length>lim[k]) out[k].length=lim[k] });
  out.n=Object.fromEntries(Object.keys(lim).map(k=>[k,out[k].length]));
  return out;
}
/* tamanho aproximado (bytes de JSON) — o link somente leitura deixa o contexto de fora quando é grande */
const ctxTamanho = d => d ? JSON.stringify(d).length : 0;
