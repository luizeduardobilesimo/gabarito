/* ================= relevo: inclinação do terreno a partir de modelo digital de elevação (Fase B, item 2) =================
   Funções puras (Node, Worker e página). NADA de DOM aqui: a busca dos tiles e o card ficam em src/ui/relevo.js.
   Fonte principal: AWS Terrain Tiles (Terrarium, ~30 m, modelo de SUPERFÍCIE: inclui prédios e árvores, ruído de ±1,5 a 3 m).
   Por isso o resultado só vale quando a inclinação é clara; em área plana o ajuste é ruído e o sistema diz "praticamente plano".
   Coordenadas: ENU local em metros (E = leste, N = norte, origem em S.lote.lat/lon). "Planta" = o referencial do lote, girado por S.lote.norte.

   Decodificação e amostragem
   relevoElev(r,g,b)                      → cota (m) de um pixel Terrarium: R·256 + G + B/256 − 32768
   relevoDecodifica(rgba, w, h)           → Float32Array de cotas (NaN onde o pixel é transparente)
   relevoTileXY(lat,lon,z)                → coordenada fracionária de tile {x,y} (Web Mercator)
   relevoTilesPara(lat,lon,raioM,z)       → tiles {z,x,y,k} que cobrem o círculo
   relevoAmostra(tiles,lat,lon,z)         → cota por interpolação bilinear em tiles {k:{z,x,y,w,h,data}} (objeto ou Map); NaN se faltar
   relevoPontosGrade(centro,janela,passo) → pontos [E,N] de uma grade quadrada · relevoGrade(tiles,ref,pontos,z) → [[E,N,cota]…]
   Ajuste
   relevoAjustaPlano(pts,o)               → plano z = z0 + gx·(E−cx) + gy·(N−cy) por mínimos quadrados com rejeição robusta
   relevoAnalisa(amostras,o)              → planos de várias janelas + plano principal + confiança
   relevoConfianca(planos,principal)      → {nivel:'alta'|'media'|'baixa'|'plano', motivo, …}
   relevoPlanoDeCantos(lote,cotas,o)      → plano a partir de cotas digitadas nos vértices
   relevoPlanoEfetivo(lote,cantos,base,o) → combina as cotas informadas com o plano do modelo digital
   Saídas para o estudo
   relevoParaTopo(plano,lote,o)           → pontos [x,y,z] (planta) para S.topo.pts · relevoParaDesnivel(plano,lote,fd,o) → S.lote.desnivel (+ = sobe para os fundos)
   relevoResumo(plano,conf)               → texto de uma linha · relevoDirTexto(az) → "SO"
   relevoOpenMeteoUrl / relevoOpenMeteoLer → reserva (90 m, uso não comercial) */
const RELEVO_Z = 14;
const RELEVO_JANELAS = { terrarium:[100,160,240], openmeteo:[160,240,320] };
const RELEVO_MIN = 2;          // % abaixo do qual o terreno é considerado praticamente plano
const RELEVO_DIR = ["N","NE","L","SE","S","SO","O","NO"];

/* ---------------- Terrarium e tiles ---------------- */
const relevoElev = (r,g,b) => r*256 + g + b/256 - 32768;
function relevoDecodifica(rgba, w, h){
  const n=w*h, out=new Float32Array(n);
  for(let i=0;i<n;i++){ const k=i*4; out[i]= rgba[k+3]===0 ? NaN : relevoElev(rgba[k], rgba[k+1], rgba[k+2]) }
  return out;
}
function relevoTileXY(lat, lon, z){
  const n=Math.pow(2,z), la=lat*Math.PI/180;
  return { x:(lon+180)/360*n, y:(1-Math.log(Math.tan(la)+1/Math.cos(la))/Math.PI)/2*n };
}
function relevoLatLonDeTile(tx, ty, z){ const n=Math.pow(2,z); return [ Math.atan(Math.sinh(Math.PI*(1-2*ty/n)))*180/Math.PI, tx/n*360-180 ] }
const relevoChave = (z,x,y) => z+"/"+x+"/"+y;
function relevoTilesPara(lat, lon, raioM, z=RELEVO_Z){
  const r=geoRef(lat, lon), a=geoDeLocal(-raioM,-raioM,r), b=geoDeLocal(raioM,raioM,r), t0=relevoTileXY(b[0],a[1],z), t1=relevoTileXY(a[0],b[1],z), out=[];
  for(let x=Math.floor(t0.x); x<=Math.floor(t1.x); x++) for(let y=Math.floor(t0.y); y<=Math.floor(t1.y); y++) out.push({z, x, y, k:relevoChave(z,x,y)});
  return out;
}
const relevoGet = (tiles, z, x, y) => { const k=relevoChave(z,x,y); return typeof tiles.get==="function" ? tiles.get(k) : tiles[k] };
function relevoAmostra(tiles, lat, lon, z=RELEVO_Z){
  const t=relevoTileXY(lat, lon, z), T0=relevoGet(tiles, z, Math.floor(t.x), Math.floor(t.y)); if(!T0) return NaN;
  const w=T0.w, h=T0.h, px=t.x*w-0.5, py=t.y*h-0.5, x0=Math.floor(px), y0=Math.floor(py), fx=px-x0, fy=py-y0;
  const val=(gx,gy)=>{ const tx=Math.floor(gx/w), ty=Math.floor(gy/h), T=relevoGet(tiles, z, tx, ty); if(!T) return NaN; const v=T.data[(gy-ty*h)*T.w + (gx-tx*w)]; return v };
  const q=[[val(x0,y0),(1-fx)*(1-fy)],[val(x0+1,y0),fx*(1-fy)],[val(x0,y0+1),(1-fx)*fy],[val(x0+1,y0+1),fx*fy]];
  let s=0, ws=0; q.forEach(([v,wt])=>{ if(isFinite(v)){ s+=v*wt; ws+=wt } });
  return ws>0 ? s/ws : NaN;
}
function relevoPontosGrade(centro, janela, passo){
  const n=Math.max(1, Math.round(janela/passo)), st=janela/n, out=[];
  for(let i=0;i<=n;i++) for(let j=0;j<=n;j++) out.push([centro[0]-janela/2+i*st, centro[1]-janela/2+j*st]);
  return out;
}
function relevoGrade(tiles, ref, pontos, z=RELEVO_Z){
  const out=[];
  pontos.forEach(p=>{ const ll=geoDeLocal(p[0], p[1], ref), v=relevoAmostra(tiles, ll[0], ll[1], z); if(isFinite(v)) out.push([p[0], p[1], v]) });
  return out;
}

/* ---------------- ajuste de plano ---------------- */
const relevoZ = (pl, E, N) => pl.z0 + pl.gx*(E-pl.cx) + pl.gy*(N-pl.cy);
const relevoAz = (gx, gy) => (Math.atan2(-gx, -gy)*180/Math.PI + 360) % 360;      // azimute (0 = norte, horário) da DESCIDA
function relevoMediana(a){ const s=a.slice().sort((p,q)=>p-q), n=s.length; return n? (n%2? s[(n-1)/2] : (s[n/2-1]+s[n/2])/2) : 0 }
function relevoMQ(P, c){ // mínimos quadrados de z = a + gx·u + gy·v (u,v centrados) → {a,gx,gy,inv} ou null
  let S1=0,Su=0,Sv=0,Suu=0,Suv=0,Svv=0,Sz=0,Suz=0,Svz=0;
  P.forEach(p=>{ const u=p[0]-c[0], v=p[1]-c[1], z=p[2]; S1++; Su+=u; Sv+=v; Suu+=u*u; Suv+=u*v; Svv+=v*v; Sz+=z; Suz+=u*z; Svz+=v*z });
  const M=[[S1,Su,Sv],[Su,Suu,Suv],[Sv,Suv,Svv]], det=M[0][0]*(M[1][1]*M[2][2]-M[1][2]*M[2][1]) - M[0][1]*(M[1][0]*M[2][2]-M[1][2]*M[2][0]) + M[0][2]*(M[1][0]*M[2][1]-M[1][1]*M[2][0]);
  if(!(Math.abs(det)>1e-9*Math.max(1,S1*Suu*Svv))) return null;
  const C=(i,j)=>{ const r=[0,1,2].filter(k=>k!==i), s=[0,1,2].filter(k=>k!==j); return ((i+j)%2?-1:1)*(M[r[0]][s[0]]*M[r[1]][s[1]]-M[r[0]][s[1]]*M[r[1]][s[0]]) };
  const inv=[0,1,2].map(i=>[0,1,2].map(j=>C(j,i)/det)), b=[Sz,Suz,Svz];
  return { a:inv[0][0]*b[0]+inv[0][1]*b[1]+inv[0][2]*b[2], gx:inv[1][0]*b[0]+inv[1][1]*b[1]+inv[1][2]*b[2], gy:inv[2][0]*b[0]+inv[2][1]*b[1]+inv[2][2]*b[2], inv };
}
/* pts [[E,N,z]…] → {z0 (cota no centro), cx, cy, gx, gy (m/m), pct, azDesc, rms, se, n, nTotal}.
   o.centro=[cx,cy] · o.robusto (padrão sim): rejeita resíduos > o.sigma (2) σ, com σ = 1,4826·MAD · o.efetivo = nº de amostras independentes (corrige o erro padrão pela correlação do modelo) */
function relevoAjustaPlano(pts, o={}){
  const P=pts.filter(p=>p && isFinite(p[0]) && isFinite(p[1]) && isFinite(p[2])); if(P.length<3) return null;
  const c=o.centro || [P.reduce((s,p)=>s+p[0],0)/P.length, P.reduce((s,p)=>s+p[1],0)/P.length], k=o.sigma||2, robusto=o.robusto!==false;
  let use=P, f=relevoMQ(use, c); if(!f) return null;
  if(robusto) for(let it=0; it<8; it++){
    const res=P.map(p=>p[2]-(f.a+f.gx*(p[0]-c[0])+f.gy*(p[1]-c[1]))), med=relevoMediana(res), sg=Math.max(0.05, 1.4826*relevoMediana(res.map(r=>Math.abs(r-med))));
    const nxt=P.filter((_,i)=>Math.abs(res[i]-med)<=k*sg); if(nxt.length<Math.max(3,Math.ceil(P.length*0.5))) break;
    const same=nxt.length===use.length && nxt.every((p,i)=>p===use[i]); use=nxt; const g=relevoMQ(use, c); if(!g) break; f=g; if(same) break;
  }
  const n=use.length, rss=use.reduce((s,p)=>{ const r=p[2]-(f.a+f.gx*(p[0]-c[0])+f.gy*(p[1]-c[1])); return s+r*r },0);
  const sg=n>3? Math.sqrt(rss/(n-3)) : 0, ne=o.efetivo? Math.max(3, Math.min(n, o.efetivo)) : n;
  const se = sg*Math.sqrt((f.inv[1][1]+f.inv[2][2])/2)*Math.sqrt(n/ne);
  return { z0:f.a, cx:c[0], cy:c[1], gx:f.gx, gy:f.gy, pct:Math.hypot(f.gx,f.gy)*100, azDesc:relevoAz(f.gx,f.gy), rms:Math.sqrt(rss/Math.max(1,n)), se, n, nTotal:P.length };
}
const relevoDifAz = (a,b) => { const d=Math.abs(a-b)%360; return d>180? 360-d : d };

/* compara os planos das janelas: inclinação acima do erro, direção estável, mínimo de ~2–3% */
function relevoConfianca(planos, principal, o={}){
  const minPct=o.minPct||RELEVO_MIN, minSnr=o.minSnr||3, azMax=o.azMax||40, P=(planos||[]).filter(Boolean);
  if(!P.length) return { nivel:"baixa", motivo:"sem dados suficientes", snr:0, azDif:0 };
  const pr=P.find(p=>p.janela===principal) || P[Math.floor(P.length/2)], pcts=P.map(p=>p.pct), snr=pr.se>0? (pr.pct/100)/pr.se : (pr.pct>0? 99 : 0);
  const com=P.filter(p=>p!==pr && p.pct>=minPct), azDif=Math.max(0, ...com.map(p=>relevoDifAz(p.azDesc, pr.azDesc))), semDir=P.filter(p=>p!==pr && p.pct<minPct).length;
  const r=(nivel,motivo)=>({ nivel, motivo, snr, azDif, pctMin:Math.min(...pcts), pctMax:Math.max(...pcts), semDir });
  if(pr.pct<minPct) return Math.max(...pcts)<minPct*1.8 ? r("plano","inclinação menor que "+minPct+"%, dentro do ruído do modelo") : r("baixa","a inclinação some em algumas janelas");
  if(snr<minSnr) return r("baixa","inclinação dentro do erro do modelo");
  if(azDif>azMax || semDir>0) return r("baixa","a direção da descida muda conforme a janela");
  const razao=Math.max(...pcts)/Math.max(1e-6, Math.min(...pcts));
  if(pr.pct>=6 && snr>=6 && azDif<=25 && razao<=1.8) return r("alta","direção e inclinação estáveis nas janelas");
  if(pr.pct>=3) return r("media","inclinação acima do ruído; direção estável");
  return r("baixa","inclinação pequena para o erro do modelo");
}
/* amostras [[E,N,z]…] em grade → planos das janelas (concêntricas em `centro`), principal e confiança */
function relevoAnalisa(amostras, o={}){
  const centro=o.centro, janelas=o.janelas||RELEVO_JANELAS.terrarium, px=o.pixel||30, planos=janelas.map(J=>{
    const sub=amostras.filter(p=>Math.abs(p[0]-centro[0])<=J/2+1e-6 && Math.abs(p[1]-centro[1])<=J/2+1e-6);
    const pl=sub.length>=9? relevoAjustaPlano(sub, {centro, efetivo:Math.max(4,(J/px)*(J/px))}) : null; if(pl) pl.janela=J; return pl }).filter(Boolean);
  const principal= janelas.includes(o.principal)? o.principal : janelas[Math.floor(janelas.length/2)];
  const plano=planos.find(p=>p.janela===principal) || planos[0] || null;
  return { planos, plano, principal, conf: plano? relevoConfianca(planos, plano.janela, o) : { nivel:"baixa", motivo:"poucos pontos com dado", snr:0, azDif:0 } };
}

/* ---------------- referenciais: planta (girada por norte) ↔ ENU ---------------- */
function relevoParaENU(x, y, norte){ const a=(+norte||0)*Math.PI/180, s=Math.sin(a), c=Math.cos(a); return [x*c - y*s, x*s + y*c] }
function relevoDeENU(E, N, norte){ const a=(+norte||0)*Math.PI/180, s=Math.sin(a), c=Math.cos(a); return [E*c + N*s, -E*s + N*c] }
const relevoCentroide = p => [p.reduce((s,q)=>s+q[0],0)/p.length, p.reduce((s,q)=>s+q[1],0)/p.length];

/* ---------------- cotas digitadas nos vértices ---------------- */
function relevoPlanoDeCantos(lote, cotas, o={}){
  const pts=[]; lote.forEach((q,i)=>{ const z=cotas[i]; if(z!=null && z!=="" && isFinite(+z)){ const e=relevoParaENU(q[0], q[1], o.norte); pts.push([e[0], e[1], +z]) } });
  if(pts.length<3) return null;
  const c=relevoParaENU(...relevoCentroide(lote), o.norte), pl=relevoAjustaPlano(pts, {centro:c, robusto:false}); if(!pl) return null;
  pl.fonte="cantos"; pl.janela=0; return pl;
}
/* cantos = [cota|null…] por vértice. Os vértices sem cota usam o plano `base` do modelo digital (quando há). Devolve {plano, nInformados, residuoMax} ou null */
function relevoPlanoEfetivo(lote, cantos, base, o={}){
  const inf=lote.map((_,i)=>{ const z=cantos&&cantos[i]; return z!=null && z!=="" && isFinite(+z) ? +z : null }), nInf=inf.filter(z=>z!=null).length;
  if(!nInf) return base? { plano:base, nInformados:0, residuoMax:0 } : null;
  const cotas=lote.map((q,i)=>{ if(inf[i]!=null) return inf[i]; if(!base) return null; const e=relevoParaENU(q[0], q[1], o.norte); return relevoZ(base, e[0], e[1]) });
  const pl=relevoPlanoDeCantos(lote, cotas, o); if(!pl) return null;
  let res=0; lote.forEach((q,i)=>{ if(inf[i]==null) return; const e=relevoParaENU(q[0], q[1], o.norte); res=Math.max(res, Math.abs(relevoZ(pl, e[0], e[1])-inf[i])) });
  return { plano:pl, nInformados:nInf, residuoMax:res };
}
/* cota do plano em cada vértice do lote (planta) */
const relevoCotasDosCantos = (plano, lote, norte) => lote.map(q=>{ const e=relevoParaENU(q[0], q[1], norte); return relevoZ(plano, e[0], e[1]) });

/* ---------------- saídas para o estudo ---------------- */
/* pontos [x,y,z] sobre o plano cobrindo o lote + margem (planta; mesmo formato de topoImportar/topoExemplo) */
function relevoParaTopo(plano, lote, o={}){
  const mg=o.margem??20, xs=lote.map(q=>q[0]), ys=lote.map(q=>q[1]), x0=Math.min(...xs)-mg, x1=Math.max(...xs)+mg, y0=Math.min(...ys)-mg, y1=Math.max(...ys)+mg;
  const st=o.passo || Math.max(5, Math.max(x1-x0, y1-y0)/20), nx=Math.max(2, Math.ceil((x1-x0)/st)), ny=Math.max(2, Math.ceil((y1-y0)/st)), out=[];
  for(let i=0;i<=nx;i++) for(let j=0;j<=ny;j++){ const x=x0+(x1-x0)*i/nx, y=y0+(y1-y0)*j/ny, e=relevoParaENU(x, y, o.norte);
    out.push([+x.toFixed(2), +y.toFixed(2), +relevoZ(plano, e[0], e[1]).toFixed(3)]) }
  return out;
}
/* gradiente na planta → desnível frente→fundos (m): positivo quando o terreno SOBE da frente para os fundos (mesmo sinal de S.lote.desnivel no 3D) */
function relevoGradPlanta(plano, norte){
  const z=(x,y)=>{ const e=relevoParaENU(x, y, norte); return relevoZ(plano, e[0], e[1]) }, z0=z(0,0);
  return [z(1,0)-z0, z(0,1)-z0];
}
function relevoParaDesnivel(plano, lote, fd, o={}){
  const g=relevoGradPlanta(plano, o.norte), pr=lote.map(q=>q[0]*fd[0]+q[1]*fd[1]), prof=Math.max(...pr)-Math.min(...pr);
  return Math.round((g[0]*fd[0]+g[1]*fd[1])*prof*100)/100;
}
const relevoDirTexto = az => RELEVO_DIR[Math.round((((az%360)+360)%360)/45)%8];
const relevoNivelTxt = { alta:"alta", media:"média", baixa:"baixa", plano:"plano" };
function relevoResumo(plano, conf){
  if(!plano) return "";
  const p=plano.pct, v=p<10? p.toFixed(1).replace(".",",") : String(Math.round(p));
  if(conf && conf.nivel==="plano") return "praticamente plano · inclinação menor que "+RELEVO_MIN+"%";
  if(conf && conf.nivel==="baixa") return `inconclusivo · ≈ ${v}% para ${relevoDirTexto(plano.azDesc)} · confiança baixa`;
  return `inclinação ${v}% · desce para ${relevoDirTexto(plano.azDesc)}${conf? " · confiança "+relevoNivelTxt[conf.nivel] : ""}`;
}

/* ---------------- reserva: Open-Meteo (90 m, CC-BY, só uso não comercial) ---------------- */
function relevoOpenMeteoUrl(ref, pontos){
  const ll=pontos.map(p=>geoDeLocal(p[0], p[1], ref));
  return "https://api.open-meteo.com/v1/elevation?latitude="+ll.map(q=>q[0].toFixed(5)).join(",")+"&longitude="+ll.map(q=>q[1].toFixed(5)).join(",");
}
function relevoOpenMeteoLer(json, pontos){
  const el=json && json.elevation; if(!Array.isArray(el) || el.length!==pontos.length) return [];
  return pontos.map((p,i)=>[p[0], p[1], el[i]]).filter(q=>typeof q[2]==="number" && isFinite(q[2]));
}
