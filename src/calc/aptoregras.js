/* ================= Plantas de apartamento: regras, aplicação dos partidos e miniatura =================
   Especificação: docs/APTOS.md (§1 regras, §2 formato do modelo). Contrato para o editor: /tmp/claude-0/brief/aptos-api.md
   (resumo no fim deste comentário). Tudo puro (sem DOM): roda no Worker, na página e nos testes.

   Referencial local de uma planta: x ao longo da fachada (0…W), y = 0 na fachada e y = D no corredor; metros, de eixo a
   eixo de parede (os ambientes somam a área da unidade). As regras descontam as paredes (APTO_PAREDE).

   - aptoAplica(modelo, W, D, opts) → planta: estica o partido por faixas (colunas/linhas em que todos os ambientes esticam
     naquele eixo absorvem a diferença; os fixos mantêm a medida), espelha, encaixa numa unidade não retangular ("caixa" =
     no retângulo envolvente e recorta; "inscrito" = no maior retângulo inscrito e as sobras viram extensão do vizinho),
     recorta a sacada embutida na frente da sala, junta os ambientes do mesmo grupo (L), põe portas (as do modelo ou
     deduzidas pelas regras, em ordem a partir da entrada), porta de entrada no corredor e janelas na fachada.
   - aptoValida(planta, st, {rapido}) → {ok, nota, problemas, moveis, dutos}: círculo inscrito, área mínima, proporção,
     acessos (grafo com passagens proibidas), zoneamento, iluminação 1/6, portas, mobiliário que cabe (malha de 0,05–0,10 m
     com o giro das portas como obstáculo) e nota (100 − 25/bad − 6/warn − 0,5/pp de desvio de área acima de 10%).
   - aptoCirculoInscrito(poly) → {c, r, d} · aptoMiniSVG(modelo|planta, opts) → SVG (cores por classe; CSS em aptoMiniCss())
   - aptoAvalia(modelo, W, D, opts, st) → {planta, val} · aptoConfere(modelo) → {ok, erros} (o modelo em si, para o editor) */

const APTO_AMB = {
  sala:    {nome:"Sala", longo:"Estar / jantar", zona:"social", janela:true, passa:true},
  suite:   {nome:"Suíte", longo:"Suíte", zona:"intima", janela:true, quarto:true},
  dorm:    {nome:"Dorm.", longo:"Dormitório", zona:"intima", janela:true, quarto:true},
  office:  {nome:"Office", longo:"Home office", zona:"social", janela:true},
  cozinha: {nome:"Cozinha", longo:"Cozinha", zona:"servico", molhada:true, duto:true, passa:true},
  serv:    {nome:"Serviço", longo:"Área de serviço", zona:"servico", molhada:true, duto:true},
  banho:   {nome:"Banho", longo:"Banheiro", zona:"molhada", molhada:true, duto:true},
  lavabo:  {nome:"Lavabo", longo:"Lavabo", zona:"molhada", molhada:true, duto:true},
  bsuite:  {nome:"Banho", longo:"Banheiro da suíte", zona:"molhada", molhada:true, duto:true, min:"banho"},
  circ:    {nome:"Circ.", longo:"Circulação", zona:"circ", passa:true},
  closet:  {nome:"Closet", longo:"Closet", zona:"intima"},
  desp:    {nome:"Depósito", longo:"Depósito", zona:"servico"},
  sacada:  {nome:"Sacada", longo:"Sacada", zona:"externa"}
};
/* parâmetros das regras (S.comodos.regras; referência genérica — conferir no código de obras do município) */
const APTO_REGRAS = {
  circ: { sala:2.6, suite:2.5, dorm:2.3, office:1.8, cozinha:1.5, serv:1.0, banho:1.1, bsuite:1.1, lavabo:0.9, circ:0.9, closet:1.0, desp:0.8, sacada:1.1 },
  prop: { dorm:2.2, suite:2.2, office:2.4, sala:3.0 },
  porta: { min:0.8, molhada:0.7, entrada:0.9 },
  nota: { bad:25, warn:6, area:0.5, areaTol:10 },
  moveis: true
};
const APTO_MIN = { sala:{a:10,l:2.6}, suite:{a:9,l:2.5}, dorm:{a:7,l:2.3}, office:{a:4,l:1.8}, cozinha:{a:4,l:1.5}, serv:{a:1.8,l:1.0}, banho:{a:2.2,l:1.1}, lavabo:{a:1.2,l:0.9}, circ:{a:0,l:0.9} };
const APTO_PAREDE = { fachada:0.20, divisa:0.075, corredor:0.075, nucleo:0.075, interna:0.06, guarda:0.04 };
const APTO_JAN = { frac:6, h:1.2, hSala:2.1 };
const APTO_TIPOS = { studio:"Studio", "1d":"1 dormitório", "1s":"1 suíte", "2d":"2 dormitórios", "2d1s":"2 dorm. (1 suíte)", "2s":"2 suítes", "3d1s":"3 dorm. (1 suíte)", "3s":"3 suítes", "4d1s":"4 dorm. (1 suíte)" };
/* programa mínimo de cada tipologia (o que a planta precisa ter) */
const APTO_PROG = {
  studio: {sala:1, cozinha:1, banho:1},
  "1d":   {sala:1, cozinha:1, dorm:1, banho:1},
  "1s":   {sala:1, cozinha:1, suite:1, bsuite:1},
  "2d":   {sala:1, cozinha:1, dorm:2, banho:1},
  "2d1s": {sala:1, cozinha:1, dorm:1, suite:1, bsuite:1, banho:1},
  "2s":   {sala:1, cozinha:1, suite:2, bsuite:2},
  "3d1s": {sala:1, cozinha:1, dorm:2, suite:1, bsuite:1, banho:1},
  "3s":   {sala:1, cozinha:1, suite:3, bsuite:3},
  "4d1s": {sala:1, cozinha:1, dorm:3, suite:1, bsuite:1, banho:1}
};
const aptoTipologias = ()=> Object.entries(APTO_TIPOS).map(([k,nome])=>({k, nome}));
const aptoNf = (v,d=1)=>(+v).toFixed(d).replace(".",",");
const aptoReg = st=>{ const r=st && st.comodos && st.comodos.regras; if(!r) return APTO_REGRAS; return {...APTO_REGRAS, ...r, circ:{...APTO_REGRAS.circ, ...(r.circ||{})}, prop:{...APTO_REGRAS.prop, ...(r.prop||{})}, porta:{...APTO_REGRAS.porta, ...(r.porta||{})}, nota:{...APTO_REGRAS.nota, ...(r.nota||{})}} };

/* ---------- geometria auxiliar (referencial local) ---------- */
const aptoE = 1e-6;
function aptoLimpa(p){
  if(!p || p.length<3) return [];
  let q=p.filter((v,i)=>{ const w=p[(i+1)%p.length]; return Math.hypot(v[0]-w[0],v[1]-w[1])>1e-5 });
  for(let k=0;k<4 && q.length>3;k++) q=q.filter((v,i)=>{ const a=q[(i-1+q.length)%q.length], b=q[(i+1)%q.length]; return Math.abs((v[0]-a[0])*(b[1]-v[1])-(v[1]-a[1])*(b[0]-v[0]))>1e-7 });
  return q.length>2? q : [];
}
const aptoCCW = p=> G.sArea(p)<0? p.slice().reverse() : p;
const aptoRetPoly = (x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
function aptoClipRet(poly, x0,y0,x1,y1){ let r=G.band(poly,[1,0],x0,x1); if(!r.length) return []; r=G.band(r,[0,1],y0,y1); return aptoLimpa(r) }
function aptoDistSeg(p,a,b){ const dx=b[0]-a[0], dy=b[1]-a[1], l2=dx*dx+dy*dy||1e-12, t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2)); return Math.hypot(p[0]-a[0]-dx*t, p[1]-a[1]-dy*t) }
function aptoBBox(p){ let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity; p.forEach(q=>{ if(q[0]<x0)x0=q[0]; if(q[0]>x1)x1=q[0]; if(q[1]<y0)y0=q[1]; if(q[1]>y1)y1=q[1] }); return [x0,y0,x1,y1] }
/* maior círculo dentro do polígono (o "raio mínimo" do ambiente): busca em malha + refinamento em volta do melhor ponto */
function aptoCirculoInscrito(poly){
  const p=aptoLimpa(poly||[]); if(p.length<3) return {c:[0,0], r:0, d:0};
  const [x0,y0,x1,y1]=aptoBBox(p);
  if(p.length===4 && Math.abs(G.area(p)-(x1-x0)*(y1-y0))<1e-6){ const r=Math.min(x1-x0,y1-y0)/2; return {c:[(x0+x1)/2,(y0+y1)/2], r, d:2*r} }   // retângulo nos eixos: exato
  const dist=q=>{ if(!G.pip(q,p)) return -1; let m=Infinity; for(let i=0;i<p.length;i++){ const d=aptoDistSeg(q,p[i],p[(i+1)%p.length]); if(d<m) m=d } return m };
  let best={c:G.centroid(p), r:Math.max(0,dist(G.centroid(p)))}, step=Math.max(x1-x0,y1-y0)/14;
  for(let x=x0+step/2;x<x1;x+=step) for(let y=y0+step/2;y<y1;y+=step){ const r=dist([x,y]); if(r>best.r) best={c:[x,y], r} }
  for(let it=0;it<4;it++){ const s=step/3, c0=best.c; for(let i=-3;i<=3;i++) for(let j=-3;j<=3;j++){ const q=[c0[0]+i*s, c0[1]+j*s], r=dist(q); if(r>best.r) best={c:q, r} } step=s }
  return {c:best.c, r:best.r, d:2*best.r};
}
/* recuo por aresta (paredes): ts(i) = recuo da aresta p[i]→p[i+1]; esquinas em meia-esquadria */
function aptoInset(p, ts){
  const n=p.length; if(n<3) return [];
  const s=G.sArea(p)>0?1:-1, L=[];
  for(let i=0;i<n;i++){ const a=p[i], b=p[(i+1)%n], dx=b[0]-a[0], dy=b[1]-a[1], l=Math.hypot(dx,dy)||1, d=[dx/l,dy/l], nr= s>0? [-d[1],d[0]] : [d[1],-d[0]], t=typeof ts==="function"? ts(i) : ts;
    L.push({o:[a[0]+nr[0]*t, a[1]+nr[1]*t], d}) }
  const out=[];
  for(let i=0;i<n;i++){ const A=L[(i-1+n)%n], B=L[i], den=A.d[0]*B.d[1]-A.d[1]*B.d[0];
    if(Math.abs(den)<1e-6){ out.push(B.o); continue }
    const t=((B.o[0]-A.o[0])*B.d[1]-(B.o[1]-A.o[1])*B.d[0])/den; out.push([A.o[0]+A.d[0]*t, A.o[1]+A.d[1]*t]) }
  return out;
}
/* união de dois polígonos que se encostam por trechos de aresta (sem sobreposição): cancela os trechos comuns e
   encadeia o que sobra. Devolve null se não se encostam ou se a união não é um polígono simples */
function aptoUne(A, B){
  const a=aptoCCW(aptoLimpa(A)), b=aptoCCW(aptoLimpa(B)); if(a.length<3) return b.length>2? b : null; if(b.length<3) return a;
  const eds=P=>P.map((p,i)=>[p, P[(i+1)%P.length]]);
  const corta=(E, F)=>{ const out=[]; E.forEach(([p,q])=>{ const dx=q[0]-p[0], dy=q[1]-p[1], L=Math.hypot(dx,dy); if(L<1e-9) return; const d=[dx/L,dy/L], ts=[0,L];
      F.forEach(([r,s])=>{ [r,s].forEach(v=>{ const t=(v[0]-p[0])*d[0]+(v[1]-p[1])*d[1], off=Math.abs((v[0]-p[0])*d[1]-(v[1]-p[1])*d[0]); if(off<1e-5 && t>1e-5 && t<L-1e-5) ts.push(t) }) });
      ts.sort((x,y)=>x-y); for(let i=0;i<ts.length-1;i++){ if(ts[i+1]-ts[i]<1e-6) continue; out.push([[p[0]+d[0]*ts[i], p[1]+d[1]*ts[i]], [p[0]+d[0]*ts[i+1], p[1]+d[1]*ts[i+1]]]) } }); return out };
  const ea=corta(eds(a), eds(b)), eb=corta(eds(b), eds(a)), same=(u,v)=>Math.abs(u[0]-v[0])<1e-5 && Math.abs(u[1]-v[1])<1e-5;
  let comum=0; const ka=ea.map(()=>true), kb=eb.map(()=>true);
  ea.forEach((e,i)=>{ const j=eb.findIndex((f,jj)=>kb[jj] && same(e[0],f[1]) && same(e[1],f[0])); if(j>=0){ ka[i]=false; kb[j]=false; comum+=Math.hypot(e[1][0]-e[0][0], e[1][1]-e[0][1]) } });
  if(comum<1e-4) return null;
  const rest=ea.filter((_,i)=>ka[i]).concat(eb.filter((_,i)=>kb[i])); if(!rest.length) return null;
  const used=rest.map(()=>false), loop=[rest[0][0]]; used[0]=true; let cur=rest[0][1];
  for(let g=0; g<rest.length; g++){ if(same(cur, loop[0])) break; const j=rest.findIndex((e,k)=>!used[k] && same(e[0],cur)); if(j<0) return null; used[j]=true; loop.push(rest[j][0]); cur=rest[j][1] }
  if(used.some(u=>!u)) return null;   // sobrou trecho: furo ou peças soltas
  const r=aptoLimpa(loop); return r.length>2? r : null;
}
/* maior retângulo (eixos locais) dentro do contorno: cantos nas coordenadas dos vértices */
function aptoMaiorRet(poly){
  const p=aptoLimpa(poly); if(p.length<3) return null;
  const xs=[...new Set(p.map(q=>+q[0].toFixed(4)))].sort((a,b)=>a-b), ys=[...new Set(p.map(q=>+q[1].toFixed(4)))].sort((a,b)=>a-b);
  const dentro=(x0,y0,x1,y1)=>{ const e=0.002, pts=[[x0+e,y0+e],[x1-e,y0+e],[x1-e,y1-e],[x0+e,y1-e],[(x0+x1)/2,y0+e],[(x0+x1)/2,y1-e],[x0+e,(y0+y1)/2],[x1-e,(y0+y1)/2],[(x0+x1)/2,(y0+y1)/2]]; if(!pts.every(q=>G.pip(q,p))) return false;
    for(let i=0;i<p.length;i++){ const a=p[i], b=p[(i+1)%p.length]; if(G.segInter(a,b,[x0+e,y0+e],[x1-e,y1-e]) || G.segInter(a,b,[x1-e,y0+e],[x0+e,y1-e])) return false } return true };
  let best=null, bA=0;
  for(let i=0;i<xs.length;i++) for(let j=i+1;j<xs.length;j++) for(let k=0;k<ys.length;k++) for(let l=k+1;l<ys.length;l++){ const A=(xs[j]-xs[i])*(ys[l]-ys[k]); if(A>bA+1e-9 && dentro(xs[i],ys[k],xs[j],ys[l])){ bA=A; best=[xs[i],ys[k],xs[j],ys[l]] } }
  return best;
}
/* trechos de cada aresta de um polígono com a classe do que está do outro lado (bordas do contorno; o resto é "interna") */
function aptoClassifica(poly, bordas){
  const out=[];
  for(let i=0;i<poly.length;i++){ const a=poly[i], b=poly[(i+1)%poly.length], dx=b[0]-a[0], dy=b[1]-a[1], L=Math.hypot(dx,dy); if(L<1e-4) continue; const d=[dx/L,dy/L], iv=[];
    (bordas||[]).forEach(s=>{ const o1=Math.abs((s.a[0]-a[0])*d[1]-(s.a[1]-a[1])*d[0]), o2=Math.abs((s.b[0]-a[0])*d[1]-(s.b[1]-a[1])*d[0]); if(o1>0.02 || o2>0.02) return;
      const t1=(s.a[0]-a[0])*d[0]+(s.a[1]-a[1])*d[1], t2=(s.b[0]-a[0])*d[0]+(s.b[1]-a[1])*d[1], lo=Math.max(0,Math.min(t1,t2)), hi=Math.min(L,Math.max(t1,t2)); if(hi-lo>0.02) iv.push([lo,hi,s.c]) });
    iv.sort((x,y)=>x[0]-y[0]); let x=0; const P=t=>[a[0]+d[0]*t, a[1]+d[1]*t];
    const push=(t0,t1,c)=>{ if(t1-t0<0.005) return; const u=out[out.length-1]; if(u && u.i===i && u.c===c && Math.abs(u.t1-t0)<1e-6){ u.t1=t1; u.b=P(t1); u.len=t1-u.t0; return } out.push({i, c, t0, t1, a:P(t0), b:P(t1), len:t1-t0}) };
    iv.forEach(([lo,hi,c])=>{ if(lo>x) push(x,lo,"interna"); push(Math.max(lo,x),hi,c); x=Math.max(x,hi) }); if(L>x) push(x,L,"interna") }
  return out;
}
const APTO_PRIO = {fachada:4, corredor:3, nucleo:3, divisa:3, interna:1};
function aptoParedeDe(r){ const cls=[]; (r.bordas||[]).forEach(b=>{ if(!cls[b.i] || APTO_PRIO[b.c]>APTO_PRIO[cls[b.i]]) cls[b.i]=b.c }); return cls }
/* face interna das paredes do ambiente */
function aptoInterno(r){ const cls=aptoParedeDe(r); return aptoInset(r.poly, i=>{ const c=cls[i]||"interna"; return c==="fachada"? (r.k==="sacada"? APTO_PAREDE.guarda : APTO_PAREDE.fachada) : APTO_PAREDE[c]||APTO_PAREDE.interna }) }

/* ---------- esticar por faixas ---------- */
const APTO_FAIXA_FOLGA = { W:1.4, D:1.25 };   // além do máximo da faixa: tolerância (com aviso) antes de virar "não cabe"
/* medida mínima de eixo a eixo de um ambiente que ocupa uma faixa inteira (para encolher sem estragar) */
const APTO_MINDIM = { sala:2.95, suite:2.85, dorm:2.62, office:2.0, cozinha:1.95, serv:1.3, banho:1.45, bsuite:1.45, lavabo:1.15, circ:1.1, closet:1.2, desp:1.0, sacada:1.2 };
function aptoGrade(rs, eixo, ref, novo, cortes){
  const c0=eixo? "y0":"x0", c1=eixo? "y1":"x1", ch=eixo? "y":"x";
  const xs=[...new Set([0, ref, ...rs.map(r=>r[c0]), ...rs.map(r=>r[c1])].map(v=>+v.toFixed(4)))].sort((a,b)=>a-b);
  const n=xs.length-1, len=xs.slice(1).map((v,i)=>v-xs[i]);
  const pode=len.map((_,i)=>rs.every(r=>!(r[c0]<xs[i+1]-aptoE && r[c1]>xs[i]+aptoE) || String(r.estica||"").includes(ch)));
  const Sx=len.reduce((s,l,i)=>s+(pode[i]?l:0),0), dl=novo-ref;
  let nl = Sx>1e-6? len.map((l,i)=>pode[i]? l+dl*l/Sx : l) : len.map(l=>l*novo/(ref||1));
  if(dl<0 && Sx>1e-6 && eixo===1){ // encolher na profundidade: tira primeiro de quem tem folga sobre a medida mínima (o quarto não fica raso antes do banho)
    // mínimo de cada faixa: o ambiente que a atravessa pede a sua parte da medida mínima (proporcional ao trecho)
    const mn=len.map((_,i)=>{ let m=0; rs.forEach(r=>{ if(r.grupo || r.opc || !(r[c0]<=xs[i]+1e-4 && r[c1]>=xs[i+1]-1e-4)) return; const L=r[c1]-r[c0]; if(L>1e-6) m=Math.max(m, (APTO_MINDIM[r.k]||0)*len[i]/L) }); return m });
    const fol=len.map((l,i)=>pode[i]? Math.max(0,l-mn[i]) : 0), F=fol.reduce((a,b)=>a+b,0);
    if(F>=-dl-1e-9) nl=len.map((l,i)=>pode[i]? l+dl*fol[i]/F : l);
    else { const resto=-dl-F, Sm=len.reduce((a,l,i)=>a+(pode[i]? l-fol[i] : 0),0); nl=len.map((l,i)=>pode[i]? (l-fol[i])*(1-resto/Math.max(1e-6,Sm)) : l) } }
  if(nl.some(l=>l<0.25)){ const fx=nl.reduce((a,l,i)=>a+(pode[i]? 0 : l),0); nl = fx<novo-0.25*n? nl.map((l,i)=>pode[i]? Math.max(0.25,l) : l) : len.map(l=>l*novo/(ref||1));
    const k=(novo-nl.reduce((a,l,i)=>a+(pode[i]? 0 : l),0))/Math.max(1e-6,nl.reduce((a,l,i)=>a+(pode[i]? l : 0),0)); if(Sx>1e-6 && isFinite(k) && k>0) nl=nl.map((l,i)=>pode[i]? l*k : l) }
  const nx=[0]; nl.forEach(l=>nx.push(nx[nx.length-1]+l)); nx[n]=novo;
  // ajustes manuais (divisões arrastadas): fração da medida nova; as vizinhas acompanham sem passar de 0,5 m
  if(cortes) for(let k=1;k<n;k++){ const v=cortes[ch+k]; if(v==null || !isFinite(v)) continue; nx[k]=Math.max(nx[k-1]+0.5, Math.min(novo-0.5*(n-k), v*novo)) }
  for(let k=1;k<n;k++) if(nx[k]<nx[k-1]+0.05) nx[k]=nx[k-1]+0.05;
  const map=v=>{ const t=+v.toFixed(4); let i=xs.indexOf(t); if(i>=0) return nx[i]; i=xs.findIndex(x=>x>t); if(i<=0) return i===0? nx[0] : nx[n]; return nx[i-1]+(t-xs[i-1])/(xs[i]-xs[i-1])*(nx[i]-nx[i-1]) };
  return {xs, nx, pode, map};
}

/* ---------- portas ---------- */
/* trecho comum (o mais longo) entre dois ambientes: {a,b,len,d,n} com n apontando de A para B */
function aptoComum(A, B){
  let best=null; const P=aptoCCW(A.poly), Q=aptoCCW(B.poly);
  for(let i=0;i<P.length;i++){ const a=P[i], b=P[(i+1)%P.length], dx=b[0]-a[0], dy=b[1]-a[1], L=Math.hypot(dx,dy); if(L<0.05) continue; const d=[dx/L,dy/L];
    for(let j=0;j<Q.length;j++){ const c=Q[j], e=Q[(j+1)%Q.length]; const o1=Math.abs((c[0]-a[0])*d[1]-(c[1]-a[1])*d[0]), o2=Math.abs((e[0]-a[0])*d[1]-(e[1]-a[1])*d[0]); if(o1>0.01||o2>0.01) continue;
      const t1=(c[0]-a[0])*d[0]+(c[1]-a[1])*d[1], t2=(e[0]-a[0])*d[0]+(e[1]-a[1])*d[1]; if(t2>t1) continue;   // sentidos opostos
      const lo=Math.max(0,t2), hi=Math.min(L,t1); if(hi-lo>0.05 && (!best || hi-lo>best.len)) best={a:[a[0]+d[0]*lo, a[1]+d[1]*lo], b:[a[0]+d[0]*hi, a[1]+d[1]*hi], len:hi-lo, d, n:[d[1],-d[0]]} } }
  return best;
}
const aptoQuad=(p0,p1,n,t)=>[p0,p1,[p1[0]+n[0]*t,p1[1]+n[1]*t],[p0[0]+n[0]*t,p0[1]+n[1]*t]];
function aptoQuadSobre(A,B){ // dois quadriláteros convexos se sobrepõem (área > ~0)?
  const C=G.clipToPoly(aptoCCW(A), aptoCCW(B)); return C.length>2 && G.area(C)>0.01 }
/* para onde a porta abre: para o lado mais "privado" */
const APTO_ABRE = {closet:9, bsuite:8, banho:8, lavabo:8, desp:7, suite:6, dorm:6, office:6, serv:5, cozinha:3, sacada:2, circ:1, sala:1};
const aptoMolhada = k=> k==="banho"||k==="lavabo"||k==="bsuite";
const aptoPorta07 = k=> aptoMolhada(k)||k==="desp"||k==="closet";   // portas de 0,70 m
/* portas deduzidas pelas regras (modelo sem portas) */
function aptoDeduzPortas(rooms){
  const by=k=>rooms.filter(r=>r.k===k), toca=(A,B)=>{ const s=A&&B&&aptoComum(A,B); return s? s.len : 0 }, out=[];
  const melhor=(r, ks)=>{ for(const k of ks){ const c=by(k).filter(x=>x!==r).map(x=>[x,toca(r,x)]).filter(([,l])=>l>=0.75).sort((a,b)=>b[1]-a[1]); if(c.length) return c[0][0] } return null };
  const sala=by("sala")[0];
  rooms.forEach(r=>{ let o=null, tipo="porta";
    if(r.k==="cozinha"){ o=melhor(r,["sala"]); if(o) tipo= toca(r,o)>=1.5? "integ" : "vao"; else o=melhor(r,["circ"]) }
    else if(r.k==="serv"){ o=melhor(r,["cozinha","circ"]); if(o && o.k==="cozinha") tipo="vao" }
    else if(r.k==="desp") o=melhor(r,["serv","circ","cozinha"]);
    else if(r.k==="circ"){ o=melhor(r,["sala","cozinha"]); tipo="vao"; if(!o) o=rooms.find(x=>x!==r && x.k==="circ" && toca(r,x)>=0.75) }
    else if(r.k==="dorm"||r.k==="suite"||r.k==="office") o=melhor(r,["circ","sala"]);
    else if(r.k==="banho") o=melhor(r,["circ","sala"]);
    else if(r.k==="lavabo") o=melhor(r,["sala","circ"]);
    else if(r.k==="bsuite"){ o= r.de? rooms.find(x=>x.id===r.de) : melhor(r,["suite"]) }
    else if(r.k==="closet"){ o= r.de? rooms.find(x=>x.id===r.de) : melhor(r,["suite","bsuite"]); tipo="vao" }
    if(o) out.push({a:o.id, b:r.id, tipo}) });
  return out;
}

/* ---------- aplicação do partido a uma unidade ---------- */
function aptoAplica(mod, W, D, o={}){
  if(!mod || !Array.isArray(mod.ambientes) || !mod.ambientes.length || !(mod.W>0) || !(mod.D>0)) return null;
  W=+W||mod.W; D=+D||mod.D;
  const rect=[[0,0],[W,0],[W,D],[0,D]], temCont=!!(o.contorno && o.contorno.length>2), cont=temCont? aptoCCW(aptoLimpa(o.contorno)) : rect;
  const retang = !temCont || (cont.length===4 && Math.abs(G.area(cont)-W*D)<0.01);
  const lat=o.lateral||mod.lateral||{};   // modelo "de canto": pede fachada lateral (só vale onde a unidade tem)
  const bordas = o.bordas && o.bordas.length? o.bordas : [{a:[0,0],b:[W,0],c:"fachada"},{a:[W,0],b:[W,D],c:lat.xW?"fachada":"divisa"},{a:[W,D],b:[0,D],c:"corredor"},{a:[0,D],b:[0,0],c:lat.x0?"fachada":"divisa"}];
  // região do encaixe
  let R=[0,0,W,D]; if(o.encaixe==="inscrito" && !retang){ const r=aptoMaiorRet(cont); if(r && (r[2]-r[0])>=2 && (r[3]-r[1])>=2) R=r }
  const Wr=R[2]-R[0], Dr=R[3]-R[1];
  // retângulos do modelo (espelhado se pedido)
  let am=mod.ambientes.filter(a=>a && Array.isArray(a.ret) && a.ret.length===4 && APTO_AMB[a.k]).map(a=>({...a, x0:+a.ret[0], y0:+a.ret[1], x1:+a.ret[0]+(+a.ret[2]), y1:+a.ret[1]+(+a.ret[3])}));
  if(!am.length) return null;
  let ex = mod.entrada && isFinite(mod.entrada.x)? +mod.entrada.x : mod.W/2;
  if(o.espelhar){ am.forEach(a=>{ const x0=mod.W-a.x1, x1=mod.W-a.x0; a.x0=x0; a.x1=x1 }); ex=mod.W-ex }
  const gx=aptoGrade(am,0,mod.W,Wr,o.cortes), gy=aptoGrade(am,1,mod.D,Dr,o.cortes);
  am.forEach(a=>{ a.rx=[a.x0,a.y0,a.x1,a.y1]; a.x0=R[0]+gx.map(a.x0); a.x1=R[0]+gx.map(a.x1); a.y0=R[1]+gy.map(a.y0); a.y1=R[1]+gy.map(a.y1) });
  ex=R[0]+gx.map(ex);
  if(R[0]>aptoE||R[1]>aptoE||R[2]<W-aptoE||R[3]<D-aptoE) am.forEach(a=>{ if(Math.abs(a.x0-R[0])<1e-4) a.x0=0; if(Math.abs(a.x1-R[2])<1e-4) a.x1=W; if(Math.abs(a.y0-R[1])<1e-4) a.y0=0; if(Math.abs(a.y1-R[3])<1e-4) a.y1=D });
  // ambientes → cômodos (grupos em L; lavabo opcional funde no vizinho)
  const grp={}; am.forEach(a=>{ grp[a.id]= a.grupo || a.id });
  am.forEach(a=>{ if(a.opc==="lavabo" && !o.lavabo && a.funde && grp[a.funde]){ a.k0=a.k; grp[a.id]=grp[a.funde] } });
  const rid={}, rooms=[], porId={};
  am.forEach(a=>{ const g=grp[a.id]; let r=porId[g]; if(!r){ const dono=am.find(x=>(x.grupo||x.id)===g && grp[x.id]===g && !x.k0) || a; r=porId[g]={id:dono.id, k:dono.k, nome:dono.nome||null, de:dono.de||null, cama:dono.cama||null, partes:[], ref:0, fixo:true}; rooms.push(r) }
    rid[a.id]=r.id; r.partes.push([a.x0,a.y0,a.x1,a.y1]); r.ref+=(a.rx[2]-a.rx[0])*(a.rx[3]-a.rx[1]); if(a.estica) r.fixo=false });
  rooms.forEach(r=>{ if(r.de) r.de=rid[r.de]||r.de });
  // sacada embutida: recorta a frente dos ambientes de "sobre" (padrão: a sala)
  let sac=null;
  if(o.sacada && o.sacada.area>0.5){
    let sobre=(mod.sacada && Array.isArray(mod.sacada.sobre) && mod.sacada.sobre.length? mod.sacada.sobre.map(id=>rid[id]) : rooms.filter(r=>r.k==="sala").map(r=>r.id)).filter(Boolean);
    { // sacada funda demais só na frente da sala (> 2,4 m): continua na frente inteira do quarto vizinho (varanda corrida)
      const fr0=r=>r.partes.filter(p=>p[1]<1e-4), spanDe=ids=>{ const iv=rooms.filter(r=>ids.includes(r.id)).flatMap(r=>fr0(r).map(p=>[p[0],p[2]])); return iv.length? [Math.min(...iv.map(v=>v[0])), Math.max(...iv.map(v=>v[1]))] : null };
      for(let g=0; g<3; g++){ const sp=spanDe(sobre); if(!sp || o.sacada.area/(sp[1]-sp[0])<=2.4) break;
        const viz=rooms.filter(r=>!sobre.includes(r.id) && ["dorm","suite","office","sala"].includes(r.k) && fr0(r).some(p=>Math.abs(p[0]-sp[1])<1e-4 || Math.abs(p[2]-sp[0])<1e-4));
        if(!viz.length) break; sobre=sobre.concat(viz[0].id) } }
    const fr=[]; rooms.filter(r=>sobre.includes(r.id)).forEach(r=>r.partes.forEach(p=>{ if(p[1]<1e-4) fr.push([p[0],p[2],p[3]]) }));
    fr.sort((a,b)=>a[0]-b[0]); const spans=[]; fr.forEach(f=>{ const u=spans[spans.length-1]; if(u && f[0]<=u[1]+1e-4){ u[1]=Math.max(u[1],f[1]); u[2]=Math.min(u[2],f[2]) } else spans.push([f[0],f[1],f[2]]) });
    spans.sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]));
    const sp=spans[0];
    if(sp && sp[1]-sp[0]>=1.2){ const span=sp[1]-sp[0], A=o.sacada.area;
      // fachada inclinada: a sacada começa onde a fachada está (yf = maior recuo da fachada no trecho)
      const fachY=x=>{ let y=0; bordas.forEach(b=>{ if(b.c!=="fachada") return; const dx=b.b[0]-b.a[0], dy=b.b[1]-b.a[1]; if(Math.abs(dy)>Math.abs(dx)) return; const lo=Math.min(b.a[0],b.b[0]), hi=Math.max(b.a[0],b.b[0]); if(x<lo-1e-6||x>hi+1e-6||Math.abs(dx)<1e-9) return; y=Math.max(y, b.a[1]+(x-b.a[0])*dy/dx) }); return y };
      // a sacada ocupa a frente inteira dos ambientes cobertos (cômodos continuam retangulares); profundidade = área ÷ frente
      let sd=Math.max(1.25, Math.min(2.4, A/span)), sw=Math.min(span, A/sd), xa=sp[0], xb, yf=0;
      const pri=rooms.find(r=>r.id===sobre[0]), px=pri? pri.partes.filter(p=>p[1]<1e-4) : [], p0=px.length? Math.min(...px.map(p=>p[0])) : sp[0], p1=px.length? Math.max(...px.map(p=>p[2])) : sp[1];
      for(let it=0; it<3; it++){
        if(sw>span){ sw=span; sd=A/sw }
        // começa pelo 1º ambiente de "sobre" (a sala): no canto da unidade, se ele encosta numa divisa
        xa = p0<1e-3 || Math.abs(p0-sp[0])<1e-3? Math.max(sp[0],p0) : p1>W-1e-3 || Math.abs(p1-sp[1])<1e-3? Math.min(sp[1],p1)-sw : p0;
        xa=Math.max(sp[0], Math.min(sp[1]-sw, xa)); xb=xa+sw;
        yf=Math.max(fachY(xa+1e-3), fachY(xb-1e-3), ...cont.filter(q=>q[0]>xa && q[0]<xb).map(q=>fachY(q[0])));
        // o ambiente coberto quase todo fica com ≥ 2,2 m atrás da sacada
        let ymax=Infinity; rooms.filter(r=>sobre.includes(r.id)).forEach(r=>r.partes.forEach(p=>{ if(p[1]>1e-4) return; const cov=(Math.min(p[2],xb)-Math.max(p[0],xa))/Math.max(1e-6,p[2]-p[0]); if(cov>0.6) ymax=Math.min(ymax, p[3]-yf-2.2) }));
        if(sd<=ymax+1e-6 || ymax<1.0) break;
        sd=Math.max(1.15, ymax); sw=Math.min(span, A/sd) }
      const yb=yf+sd;
      rooms.forEach(r=>{ const np=[]; r.partes.forEach(p=>{ if(p[1]>1e-4 || p[2]<=xa+1e-4 || p[0]>=xb-1e-4 || !sobre.includes(r.id) || p[3]<=yb+0.3){ np.push(p); return }
          const a0=Math.max(p[0],xa), a1=Math.min(p[2],xb);
          if(a0>p[0]+1e-4) np.push([p[0],0,a0,yb]); if(a1<p[2]-1e-4) np.push([a1,0,p[2],yb]); np.push([p[0],yb,p[2],p[3]]) }); r.partes=np });
      sac={id:"sac", k:"sacada", nome:null, partes:[[xa,0,xb,yb]], ref:sw*sd, fixo:true, alvoFixo:sw*sd}; rooms.push(sac) } }
  // recorte pelo contorno e união das partes
  rooms.forEach(r=>{ const pcs=r.partes.map(p=>retang? aptoRetPoly(...p) : aptoClipRet(cont,p[0],p[1],p[2],p[3])).filter(q=>q.length>2 && G.area(q)>0.01);
    let poly=pcs.length? pcs[0] : []; const sobra=[];
    for(let i=1;i<pcs.length;i++){ const u=aptoUne(poly,pcs[i]); if(u) poly=u; else sobra.push(pcs[i]) }
    for(let g=0; g<3 && sobra.length; g++) for(let i=sobra.length-1;i>=0;i--){ const u=aptoUne(poly,sobra[i]); if(u){ poly=u; sobra.splice(i,1) } }
    r.poly=poly.length? aptoCCW(poly) : []; r.sobra=sobra });
  // pedaços soltos (o contorno separou um ambiente): vão para o vizinho que encosta
  rooms.forEach(r=>{ (r.sobra||[]).forEach(q=>{ for(const v of rooms){ if(v===r || !v.poly.length) continue; const u=aptoUne(v.poly,q); if(u){ v.poly=aptoCCW(u); return } } }); delete r.sobra });
  let amb=rooms.filter(r=>r.poly.length>2 && G.area(r.poly)>0.05);
  // áreas-alvo: fixos mantêm a do desenho; os que esticam dividem o resto na proporção do desenho
  const Au=G.area(cont); amb.forEach(r=>{ r.area=G.area(r.poly) });
  const fixos=amb.filter(r=>r.fixo), est=amb.filter(r=>!r.fixo), Af=fixos.reduce((s,r)=>s+(r.alvoFixo||r.ref),0), Re=est.reduce((s,r)=>s+r.ref,0);
  fixos.forEach(r=>{ r.alvo=r.alvoFixo||r.ref }); est.forEach(r=>{ r.alvo= Re>0? r.ref*Math.max(0.2,(Au-Af))/Re : r.area });
  // bordas (classe do vizinho por trecho)
  amb.forEach(r=>{ r.bordas=aptoClassifica(r.poly, bordas) });
  // nomes (Dorm. 1, 2…; Banheiro 1, 2… quando há mais de um)
  const cnt={}; amb.forEach(r=>{ cnt[r.k]=(cnt[r.k]||0)+1 }); const seq={};
  amb.forEach(r=>{ const K=APTO_AMB[r.k]; seq[r.k]=(seq[r.k]||0)+1; const n=cnt[r.k]>1 && (r.k==="dorm"||r.k==="banho"||r.k==="suite"||r.k==="bsuite")? seq[r.k] : 0;
    r.n=n; r.longo= r.nome || (n? `${K.longo} ${n}` : K.longo); r.nome = r.nome || (r.k==="dorm" && n? `Dorm. ${n}` : r.k==="suite" && n? `Suíte ${n}` : K.nome) });
  const byId=Object.fromEntries(amb.map(r=>[r.id,r]));
  // portas: as do modelo (ids → cômodos) ou deduzidas
  const ps=[]; const vistos=new Set();
  const lista = Array.isArray(mod.portas) && mod.portas.length? mod.portas.map(p=>({...p, a: p.a==="entrada"? "entrada" : rid[p.a]||p.a, b: p.b==="entrada"? "entrada" : rid[p.b]||p.b})) : aptoDeduzPortas(amb);
  lista.forEach(p=>{ if(p.a===p.b) return; const key=[p.a,p.b].sort().join("|"); if(vistos.has(key)) return; vistos.add(key); ps.push(p) });
  // entrada: ambiente indicado (porta "entrada" do modelo) ou o que contém o ponto do desenho junto do corredor
  const corrDe=r=>r.bordas.filter(b=>b.c==="corredor" && b.len>=1.05);
  let pe=ps.find(p=>p.a==="entrada"||p.b==="entrada"), eRoom = pe? byId[pe.a==="entrada"? pe.b : pe.a] : null;
  if(!eRoom){ eRoom=amb.find(r=>r.k!=="sacada" && G.pip([ex, D-0.05], r.poly)) || null }
  const eRef=[ex, D];
  const ptoNa=(b,t)=>[b.a[0]+(b.b[0]-b.a[0])*t, b.a[1]+(b.b[1]-b.a[1])*t];
  let entrada=null; const R2=APTO_REGRAS.porta;
  { const cand=[eRoom, ...amb.filter(r=>r!==eRoom && ["sala","cozinha","circ","serv"].includes(r.k))].filter(Boolean);
    for(const r of cand){ const segs=corrDe(r); if(!segs.length) continue;
      const w=R2.entrada; let bs=null, bd=Infinity, bt=0;
      segs.forEach(s=>{ const L=s.len, d=[(s.b[0]-s.a[0])/L,(s.b[1]-s.a[1])/L], t=(eRef[0]-s.a[0])*d[0]+(eRef[1]-s.a[1])*d[1], c=Math.max(0.1+w/2, Math.min(L-0.1-w/2, t)), q=[s.a[0]+d[0]*c, s.a[1]+d[1]*c], dd=Math.hypot(q[0]-eRef[0], q[1]-eRef[1]); if(dd<bd){ bd=dd; bs=s; bt=c } });
      if(bs){ const L=bs.len, p0=ptoNa(bs,(bt-w/2)/L), p1=ptoNa(bs,(bt+w/2)/L), d=[(bs.b[0]-bs.a[0])/L,(bs.b[1]-bs.a[1])/L], nIn=[-d[1],d[0]];   // CCW: o interior fica à esquerda
        entrada={amb:r.id, p0, p1, w, n:nIn, previsto: r===eRoom}; break } } }
  // ordem: a partir da entrada (o ponto de chegada de cada cômodo orienta a posição da porta seguinte)
  const portas=[], giros=[], chegada={};
  if(entrada){ const d=entrada.n, q=aptoQuad(entrada.p0, entrada.p1, d, entrada.w); portas.push({id:"pe", a:"entrada", b:entrada.amb, k:"entrada", p0:entrada.p0, p1:entrada.p1, w:entrada.w, abre:entrada.amb, dob:"p0", n:d}); giros.push({amb:entrada.amb, q, porta:"pe"}); chegada[entrada.amb]=[(entrada.p0[0]+entrada.p1[0])/2,(entrada.p0[1]+entrada.p1[1])/2] }
  const pend=ps.filter(p=>p.a!=="entrada" && p.b!=="entrada" && byId[p.a] && byId[p.b]);
  const fila=entrada? [entrada.amb] : amb.length? [amb[0].id] : [], visto=new Set(fila); if(!entrada && amb.length) chegada[amb[0].id]=G.centroid(amb[0].poly);
  const feitas=new Set();
  const poe=(p, de, para)=>{ const A=byId[de], B=byId[para], s=aptoComum(A,B); if(!s) return false;
    const kk=p.tipo|| "porta", L=s.len, ref=chegada[de] || G.centroid(A.poly);
    if(kk==="integ"||kk==="vao"||kk==="correr"){ const wmax= kk==="integ"? 3.2 : (p.w||1.0), w=Math.min(L-(kk==="integ"?0.1:0.2), wmax); if(w<0.6) return false;
      const t0=(L-w)/2; portas.push({id:"p"+portas.length, a:de, b:para, k: kk==="correr"? "vao" : kk, p0:ptoNa(s,t0/L), p1:ptoNa(s,(t0+w)/L), w, abre:null, n:s.n});
      if(kk!=="integ"){ const p0=ptoNa(s,t0/L), p1=ptoNa(s,(t0+w)/L); giros.push({amb:para, q:aptoQuad(p0,p1,s.n,0.5), vao:true}); giros.push({amb:de, q:aptoQuad(p1,p0,[-s.n[0],-s.n[1]],0.5), vao:true}) }
      return true }
    const kb=B.k, ka=A.k, w = p.w || (aptoPorta07(kb)||aptoMolhada(ka)? R2.molhada : R2.min);
    if(L<w+0.15) return false;
    const abre = (APTO_ABRE[kb]||0)>=(APTO_ABRE[ka]||0)? para : de, nA = abre===para? s.n : [-s.n[0],-s.n[1]];
    const cands=[]; const pos=p.pos;
    const ts = pos==="lo"? [0.1] : pos==="hi"? [L-0.1-w] : pos==="meio"? [(L-w)/2] : [Math.min(0.1,(L-w)/2), Math.max((L-w)/2, L-0.1-w), (L-w)/2];
    ts.forEach(t0=>{ const p0=ptoNa(s,t0/L), p1=ptoNa(s,(t0+w)/L), q=aptoQuad(p0,p1,nA,w), c=[(p0[0]+p1[0])/2,(p0[1]+p1[1])/2];
      const bate=giros.filter(g=>(g.amb===abre) && aptoQuadSobre(g.q,q)).length;
      cands.push({t0, p0, p1, q, bate, d:Math.hypot(c[0]-ref[0], c[1]-ref[1])}) });
    cands.sort((x,y)=>x.bate-y.bate || x.d-y.d); const c=cands[0];
    const dob = c.t0 < (L-w)/2-1e-6? "p0" : c.t0 > (L-w)/2+1e-6? "p1" : "p0";
    portas.push({id:"p"+portas.length, a:de, b:para, k:"porta", p0:c.p0, p1:c.p1, w, abre, dob, n:nA, bate:c.bate>0});
    giros.push({amb:abre, q:c.q, porta:"p"+(portas.length-1)}); return true };
  while(fila.length){ const x=fila.shift();
    pend.forEach((p,i)=>{ if(feitas.has(i)) return; let de=null, para=null; if(p.a===x){ de=p.a; para=p.b } else if(p.b===x){ de=p.b; para=p.a } if(!de) return;
      feitas.add(i); if(poe(p,de,para)){ const pt=portas[portas.length-1]; if(!chegada[para]) chegada[para]=[(pt.p0[0]+pt.p1[0])/2,(pt.p0[1]+pt.p1[1])/2] }
      if(!visto.has(para)){ visto.add(para); fila.push(para) } }) }
  pend.forEach((p,i)=>{ if(!feitas.has(i)){ feitas.add(i); poe(p,p.a,p.b) } });
  // sacada: porta-janela para cada ambiente atrás dela
  const sacR=amb.find(r=>r.k==="sacada");
  if(sacR) amb.forEach(r=>{ if(r===sacR || r.k==="sacada") return; const s=aptoComum(r,sacR); if(!s || s.len<1.0) return; const w=Math.min(s.len-0.3, 2.6), t0=(s.len-w)/2;
    portas.push({id:"p"+portas.length, a:r.id, b:sacR.id, k:"pj", p0:ptoNa(s,t0/s.len), p1:ptoNa(s,(t0+w)/s.len), w, abre:null, n:s.n});
    giros.push({amb:r.id, q:aptoQuad(ptoNa(s,(t0+w)/s.len), ptoNa(s,t0/s.len), [-s.n[0],-s.n[1]], 0.6), vao:true}) });
  // janelas (fachada): permanência prolongada com a área exigida; molhadas/serviço com uma janela pequena se tocam a fachada
  const J=(o.st && o.st.comodos && o.st.comodos.jan) || APTO_JAN, janelas=[];
  const integ=new Set(portas.filter(p=>p.k==="integ").flatMap(p=>[p.a,p.b]));
  amb.forEach(r=>{ const K=APTO_AMB[r.k]; if(r.k==="sacada"||r.k==="circ"||r.k==="closet"||r.k==="desp") return;
    const fac=r.bordas.filter(b=>b.c==="fachada" && b.len>=0.8).sort((a,b)=>b.len-a.len); if(!fac.length) return;
    const h = r.k==="sala"? (J.hSala||2.1) : K.janela? (J.h||1.2) : r.k==="cozinha"||r.k==="serv"? 1.0 : 0.6;
    let piso=r.area; if(r.k==="sala"){ const cz=amb.find(x=>x.k==="cozinha" && integ.has(x.id) && integ.has(r.id)); if(cz) piso+=cz.area }
    const req=piso/(J.frac||6)/h, b=fac[0];
    const w = K.janela? Math.min(b.len-0.4, Math.max(req*1.15, 1.2, Math.min(b.len*0.55, r.k==="sala"? 3.2 : 2.0))) : Math.min(b.len-0.4, r.k==="cozinha"? 1.2 : 0.8);
    if(w<0.5) return; const t0=(b.len-w)/2/b.len, d=[(b.b[0]-b.a[0])/b.len,(b.b[1]-b.a[1])/b.len];
    janelas.push({amb:r.id, p0:ptoNa(b,t0), p1:ptoNa(b,1-t0), w, h, n:[d[1],-d[0]]}) });
  // fora da faixa do partido
  // faixa do partido: abaixo do mínimo não cabe (grave); acima do máximo os ambientes só crescem — tolera até +40% na
  // frente e +25% na profundidade com aviso (o desvio das áreas já pesa na nota); além disso, grave
  const fx=mod.faixaW||{}, fy=mod.faixaD||{}, xW=APTO_FAIXA_FOLGA.W, xD=APTO_FAIXA_FOLGA.D;
  const foraW = (fx.min!=null && Wr<fx.min-0.02) || (fx.max!=null && Wr>fx.max*xW+0.02), foraD=(fy.min!=null && Dr<fy.min-0.02) || (fy.max!=null && Dr>fy.max*xD+0.02);
  const largoW = !foraW && fx.max!=null && Wr>fx.max+0.02, largoD = !foraD && fy.max!=null && Dr>fy.max+0.02;
  let foraMsg=""; if(foraW) foraMsg=`frente de ${aptoNf(Wr)} m; o partido pede ${Wr<fx.min? aptoNf(fx.min)+" m ou mais" : "até "+aptoNf(fx.max)+" m"}`;
  else if(foraD) foraMsg=`profundidade de ${aptoNf(Dr)} m; o partido pede ${Dr<fy.min? aptoNf(fy.min)+" m ou mais" : "até "+aptoNf(fy.max)+" m"}`;
  const largoMsg = largoW? `frente de ${aptoNf(Wr)} m, maior que a do partido (até ${aptoNf(fx.max)} m): ambientes esticados` : largoD? `profundidade de ${aptoNf(Dr)} m, maior que a do partido (até ${aptoNf(fy.max)} m): ambientes esticados` : "";
  return {modelo:mod.id, nome:mod.nome, tipologia:mod.tipologia, origem:mod.origem||"catalogo", W, D, espelhado:!!o.espelhar, encaixe:o.encaixe||"caixa", lavaboPedido:!!o.lavabo,
    contorno:cont, bordasUn:bordas, area:Au,
    ambientes:amb.map(r=>({id:r.id, k:r.k, nome:r.nome, longo:r.longo, n:r.n, poly:r.poly, area:r.area, alvo:r.alvo, de:r.de, cama:r.cama, partes:r.partes, bordas:r.bordas, fixo:r.fixo})),
    portas, janelas, giros, entrada: entrada? {amb:entrada.amb, p0:entrada.p0, p1:entrada.p1, n:entrada.n, previsto:entrada.previsto} : null,
    grade:{xs:gx.nx.map(v=>R[0]+v), ys:gy.nx.map(v=>R[1]+v), pode:{x:gx.pode, y:gy.pode}, R}, fora:{W:foraW, D:foraD, msg:foraMsg, largo:largoMsg}};
}

/* ---------- mobiliário: cabe no ambiente? (malha; o giro das portas é obstáculo) ---------- */
/* peça: w = largura (ao longo da parede), h = profundidade; cl = livre na frente (f), atrás (b), à esquerda (l), à direita (r);
   parede = o fundo encosta numa parede; nivel = o que vale se não couber */
const APTO_MOVEIS = {
  sala:    [{k:"sofa", nome:"sofá de 2,00 m", w:2.0, h:0.9, cl:{f:1.1}, nivel:"bad"}, {k:"mesa", nome:"mesa de 4 lugares (1,20 × 0,80)", w:1.2, h:0.8, cl:{f:0.6,b:0.6}, nivel:"bad"}],
  studio:  [{k:"cama", nome:"cama de casal", w:1.4, h:1.9, cl:{l:0.6, r:0.6}, parede:true, nivel:"bad"}, {k:"sofa", nome:"sofá", w:1.6, h:0.8, cl:{f:0.8}, nivel:"warn"}],
  suite:   [{k:"cama", nome:"cama de casal (1,40 × 1,90) com 0,60 livre dos dois lados", w:1.4, h:1.9, cl:{l:0.6, r:0.6}, parede:true, nivel:"bad"}, {k:"armario", nome:"armário", w:1.6, h:0.6, cl:{f:0.5}, parede:true, nivel:"warn", semCloset:true}],
  dorm:    [{k:"cama", nome:"cama de solteiro (0,90 × 1,90) com 0,60 livre", w:0.9, h:1.9, cl:{l:0.6}, parede:true, nivel:"bad"}, {k:"armario", nome:"armário", w:1.2, h:0.6, cl:{f:0.5}, parede:true, nivel:"warn"}],
  dormCasal:[{k:"cama", nome:"cama de casal (1,40 × 1,90) com 0,60 livre dos dois lados", w:1.4, h:1.9, cl:{l:0.6, r:0.6}, parede:true, nivel:"bad"}, {k:"armario", nome:"armário", w:1.4, h:0.6, cl:{f:0.5}, parede:true, nivel:"warn"}],
  office:  [{k:"trab", nome:"mesa de trabalho", w:1.2, h:0.6, cl:{f:0.8}, parede:true, nivel:"bad"}],
  cozinha: [{k:"bancada", nome:"bancada de 1,80 m com 0,90 livre", w:1.8, h:0.6, cl:{f:0.9}, parede:true, nivel:"bad"}, {k:"geladeira", nome:"geladeira", w:0.7, h:0.7, cl:{f:0.6}, parede:true, nivel:"warn"}],
  serv:    [{k:"tanque", nome:"tanque", w:0.6, h:0.55, cl:{f:0.45}, parede:true, nivel:"warn"}, {k:"maquina", nome:"máquina de lavar", w:0.62, h:0.62, cl:{f:0.45}, parede:true, nivel:"warn"}],
  banho:   [{k:"box", nome:"box", w:0.9, h:0.9, parede:true, nivel:"warn"}, {k:"vaso", nome:"vaso", w:0.4, h:0.65, cl:{f:0.45}, parede:true, nivel:"warn"}, {k:"lav", nome:"lavatório", w:0.5, h:0.45, cl:{f:0.5}, parede:true, nivel:"warn"}],
  lavabo:  [{k:"vaso", nome:"vaso", w:0.4, h:0.65, cl:{f:0.4}, parede:true, nivel:"warn"}, {k:"lav", nome:"lavatório", w:0.45, h:0.4, cl:{f:0.45}, parede:true, nivel:"warn"}],
  closet:  [{k:"armario", nome:"armário", w:1.0, h:0.55, cl:{f:0.55}, parede:true, nivel:"warn"}]
};
function aptoPecas(r, planta){
  if(r.k==="sala" && planta.tipologia==="studio") return APTO_MOVEIS.studio;
  if(r.k==="dorm" && (r.cama==="casal" || (planta.tipologia==="1d" && r.cama!=="solteiro"))) return APTO_MOVEIS.dormCasal;
  if(r.k==="bsuite") return APTO_MOVEIS.banho;
  let L=APTO_MOVEIS[r.k]||[];
  if(r.k==="suite" && planta.ambientes.some(x=>x.k==="closet" && x.de===r.id)) L=L.filter(p=>!p.semCloset);
  return L;
}
function aptoMoveis(planta, r, extra){
  const pecas=aptoPecas(r, planta).concat(extra||[]); if(!pecas.length) return {itens:[], falta:[]};
  const inn=aptoInterno(r); if(inn.length<3) return {itens:[], falta:pecas.map(p=>p)};
  const [bx0,by0,bx1,by1]=aptoBBox(inn), res= r.area<5? 0.05 : r.area<20? 0.1 : 0.15, nx=Math.max(1,Math.round((bx1-bx0)/res)), ny=Math.max(1,Math.round((by1-by0)/res));
  if(nx*ny>40000) return {itens:[], falta:[]};
  const N=nx*ny, dentro=new Uint8Array(N), giro=new Uint8Array(N), cx=i=>bx0+(i+0.5)*res, cy=j=>by0+(j+0.5)*res;
  for(let j=0;j<ny;j++) for(let i=0;i<nx;i++) if(G.pip([cx(i),cy(j)], inn)) dentro[j*nx+i]=1;
  (planta.giros||[]).forEach(g=>{ if(g.amb!==r.id) return; const [qx0,qy0,qx1,qy1]=aptoBBox(g.q); for(let j=Math.max(0,Math.floor((qy0-by0)/res)); j<Math.min(ny,Math.ceil((qy1-by0)/res)); j++) for(let i=Math.max(0,Math.floor((qx0-bx0)/res)); i<Math.min(nx,Math.ceil((qx1-bx0)/res)); i++) if(G.pip([cx(i),cy(j)], g.q)) giro[j*nx+i]=1 });
  const NX=nx+1, sat=(f)=>{ const s=new Int32Array(NX*(ny+1)); for(let j=0;j<ny;j++){ let row=0; for(let i=0;i<nx;i++){ row+=f(j*nx+i); s[(j+1)*NX+i+1]=s[j*NX+i+1]+row } } return s };
  const soma=(s,i0,j0,i1,j1)=>{ if(i0<0||j0<0||i1>nx||j1>ny) return 1e9; if(i1<=i0||j1<=j0) return 0; return s[j1*NX+i1]-s[j0*NX+i1]-s[j1*NX+i0]+s[j0*NX+i0] };
  const sIn=sat(k=>dentro[k]);
  const fora=(i0,j0,i1,j1)=>{ const tot=(i1-i0)*(j1-j0), a0=Math.max(0,i0), b0=Math.max(0,j0), a1=Math.min(nx,i1), b1=Math.min(ny,j1); return tot - (a1>a0 && b1>b0? soma(sIn,a0,b0,a1,b1) : 0) };
  // geometria de uma peça numa rotação (relativa ao canto do sólido): sólido + faixas livres + faixa do fundo (parede)
  // rot 0: fundo embaixo, frente para cima; 1: fundo à direita; 2: fundo em cima; 3: fundo à esquerda
  const C=v=>Math.round(v/res);
  const molde=(p, rot)=>{ const w=C(p.w), h=C(p.h), cl=p.cl||{}, f=C(cl.f||0), b=C(cl.b||0), l=C(cl.l||0), rr=C(cl.r||0), L=[]; let S, P;
    if(rot===0){ S=[0,0,w,h]; if(f) L.push([0,h,w,h+f]); if(b) L.push([0,-b,w,0]); if(l) L.push([-l,0,0,h]); if(rr) L.push([w,0,w+rr,h]); P=[0,-1,w,0] }
    else if(rot===2){ S=[0,0,w,h]; if(f) L.push([0,-f,w,0]); if(b) L.push([0,h,w,h+b]); if(l) L.push([w,0,w+l,h]); if(rr) L.push([-rr,0,0,h]); P=[0,h,w,h+1] }
    else if(rot===1){ S=[0,0,h,w]; if(f) L.push([-f,0,0,w]); if(b) L.push([h,0,h+b,w]); if(l) L.push([0,-l,h,0]); if(rr) L.push([0,w,h,w+rr]); P=[h,0,h+1,w] }
    else { S=[0,0,h,w]; if(f) L.push([h,0,h+f,w]); if(b) L.push([-b,0,0,w]); if(l) L.push([0,w,h,w+l]); if(rr) L.push([0,-rr,h,0]); P=[-1,0,0,w] }
    return {S, L, P, sw:S[2], sh:S[3]} };
  const desloca=(R,i,j)=>[R[0]+i,R[1]+j,R[2]+i,R[3]+j];
  const tenta=(p, occS, occL, max)=>{ const sS=sat(k=>(!dentro[k]||giro[k]||occS[k]||occL[k])?1:0), sL=sat(k=>(!dentro[k]||occS[k])?1:0), out=[];
    for(let rot=0;rot<4;rot++){ const M=molde(p,rot);
      for(let j=0;j+M.sh<=ny;j++) for(let i=0;i+M.sw<=nx;i++){
        if(soma(sS,i,j,i+M.sw,j+M.sh)!==0) continue;
        let ok=true; for(const R of M.L){ if(soma(sL,R[0]+i,R[1]+j,R[2]+i,R[3]+j)!==0){ ok=false; break } } if(!ok) continue;
        if(p.parede){ const Q=M.P, tot=(Q[2]-Q[0])*(Q[3]-Q[1]); if(fora(Q[0]+i,Q[1]+j,Q[2]+i,Q[3]+j)<0.8*tot) continue }
        out.push({rot, M, i, j, cx:i+M.sw/2, cy:j+M.sh/2}); if(max===1) return out } }
    if(out.length<=max) return out;
    // espalha: o mais distante dos já escolhidos (posições bem diferentes para a busca seguinte)
    const esc=[out[0]], dmin=out.map(c=>Math.hypot(c.cx-out[0].cx, c.cy-out[0].cy)+(c.rot===out[0].rot?0:3));
    while(esc.length<max){ let bi=-1, bd=-1; for(let i=0;i<dmin.length;i++) if(dmin[i]>bd){ bd=dmin[i]; bi=i } if(bi<0 || bd<=0) break; const c=out[bi]; esc.push(c); for(let i=0;i<out.length;i++){ const o=out[i], d=Math.hypot(o.cx-c.cx, o.cy-c.cy)+(o.rot===c.rot?0:3); if(d<dmin[i]) dmin[i]=d } }
    return esc };
  const marca=(c, occS, occL)=>{ const s=occS.slice(), l=occL.slice(), pinta=(R,arr)=>{ for(let jj=Math.max(0,R[1]);jj<Math.min(ny,R[3]);jj++) for(let ii=Math.max(0,R[0]);ii<Math.min(nx,R[2]);ii++) arr[jj*nx+ii]=1 }; pinta(desloca(c.M.S,c.i,c.j),s); c.M.L.forEach(R=>pinta(desloca(R,c.i,c.j),l)); return [s,l] };
  const obrig=pecas.filter(p=>p.nivel==="bad"), opc=pecas.filter(p=>p.nivel!=="bad");
  let melhor=null;
  const rec=(k, occS, occL, itens)=>{ if(melhor && melhor.ok && melhor.opc===opc.length) return;
    if(k===obrig.length){ // opcionais, gulosos
      let s=occS, l=occL; const its=itens.slice(), falta=[];
      opc.forEach(p=>{ const c=tenta(p,s,l,1)[0]; if(c){ [s,l]=marca(c,s,l); its.push({p,c}) } else falta.push(p) });
      const sc=opc.length-falta.length; if(!melhor || !melhor.ok || sc>melhor.opc) melhor={ok:true, opc:sc, itens:its, falta}; return }
    const cs=tenta(obrig[k], occS, occL, k===obrig.length-1 && !opc.length? 1 : k===0? 6 : 3);
    for(const c of cs){ const [s,l]=marca(c,occS,occL); rec(k+1, s, l, itens.concat([{p:obrig[k], c}])); if(melhor && melhor.ok && melhor.opc===opc.length) return }
    if(!melhor) melhor={ok:false, falha:obrig[k], itens, falta:[obrig[k]]} };
  rec(0, new Uint8Array(N), new Uint8Array(N), []);
  const itens=(melhor.itens||[]).map(({p,c})=>{ const [i0,j0,i1,j1]=desloca(c.M.S,c.i,c.j); return {k:p.k, amb:r.id, rot:c.rot, ret:[bx0+i0*res, by0+j0*res, bx0+i1*res, by0+j1*res]} });
  const falta = melhor.ok? melhor.falta : [melhor.falha];
  return {itens, falta};
}

/* ---------- validação ---------- */
function aptoValida(pl, st, opt={}){
  const R=aptoReg(st), mins=(st && st.comodos && st.comodos.min) || APTO_MIN, J=(st && st.comodos && st.comodos.jan) || APTO_JAN;
  const out=[], P=(k,nivel,amb,msg)=>out.push({k,nivel,amb:amb||undefined,msg});
  if(!pl || !pl.ambientes || !pl.ambientes.length){ P("programa","bad",null,"planta vazia"); return {ok:false, nota:0, problemas:out, moveis:[], dutos:[]} }
  const A=pl.ambientes, byId=Object.fromEntries(A.map(r=>[r.id,r])), nome=r=>r.longo||APTO_AMB[r.k].longo;
  if(pl.fora && (pl.fora.W || pl.fora.D)) P("faixa","bad",null,`fora da faixa do partido: ${pl.fora.msg}`);
  else if(pl.fora && pl.fora.largo) P("faixa","warn",null,pl.fora.largo);
  // programa
  const prog=APTO_PROG[pl.tipologia]; if(prog) Object.entries(prog).forEach(([k,n])=>{ const t=A.filter(r=>r.k===k).length; if(t<n) P("programa","bad",null,`falta ${n-t>1? (n-t)+" × " : ""}${APTO_AMB[k].longo.toLowerCase()}`) });
  if(pl.lavaboPedido && !A.some(r=>r.k==="lavabo")) P("programa","warn",null,"o partido não tem lavabo (pedido nesta tipologia)");
  // portas e acessos
  const ps=pl.portas||[], lig=new Map(); const liga=(a,b,p)=>{ (lig.get(a)||lig.set(a,[]).get(a)).push({o:b,p}); (lig.get(b)||lig.set(b,[]).get(b)).push({o:a,p}) };
  ps.forEach(p=>{ if(p.k==="entrada") return; if(byId[p.a] && byId[p.b]) liga(p.a,p.b,p) });
  const integ=new Set(ps.filter(p=>p.k==="integ").flatMap(p=>[p.a,p.b]));
  // dimensões
  A.forEach(r=>{ const K=APTO_AMB[r.k], mn=mins[K.min||r.k];
    if(r.k==="sacada"){ const d=aptoCirculoInscrito(aptoInterno(r)).d; r._d=d; if(d<(R.circ.sacada||1.1)-0.05) P("sacada","warn",r.id,`${nome(r)}: profundidade ${aptoNf(d,2)} m (mín. ${aptoNf(R.circ.sacada||1.1,2)} m)`); return }
    // área mínima (sala integrada à cozinha: um compartimento só)
    const aR = r.k==="sala" && integ.has(r.id)? r.area + A.filter(x=>x.k==="cozinha" && integ.has(x.id)).reduce((s,x)=>s+x.area,0) : r.area;
    const aM = mn? (r.k==="sala" && integ.has(r.id)? mn.a+((mins.cozinha||{}).a||0) : mn.a) : 0;
    if(aM>0 && !(r.k==="cozinha" && integ.has(r.id)) && aR<aM-0.05) P("area", aR<aM*0.85? "bad" : "warn", r.id, `${nome(r)}: ${aptoNf(aR)} m²${r.k==="sala"&&integ.has(r.id)?" com a cozinha":""} (mín. ${aptoNf(aM)} m²)`);
    // círculo inscrito (descontadas as paredes)
    const req=R.circ[K.min||r.k]; const ci=aptoCirculoInscrito(aptoInterno(r)); r._d=ci.d; r._c=ci.c;
    if(req){ if(ci.d<req-0.005){ const lim= r.k==="circ"? 0.10 : Math.max(0.10, req*0.05); P("circulo", ci.d<req-lim? "bad" : "warn", r.id, r.k==="circ"? `${nome(r)}: largura livre ${aptoNf(ci.d,2)} m (mín. ${aptoNf(req,2)} m)` : `${nome(r)}: cabe um círculo de Ø ${aptoNf(ci.d,2)} m (mín. Ø ${aptoNf(req,2)} m)`) } }
    // proporção
    const lim=R.prop[r.k]; if(lim){ const [x0,y0,x1,y1]=aptoBBox(r.poly), a=x1-x0, b=y1-y0, q=Math.max(a,b)/Math.max(0.01,Math.min(a,b)); r._q=q;
      if(q>lim+0.01) P("proporcao", q>lim*1.15? "bad" : "warn", r.id, `${nome(r)}: comprido demais (${aptoNf(Math.max(a,b),2)} × ${aptoNf(Math.min(a,b),2)} m; máx. ${aptoNf(lim,1)} : 1)`) }
  });
  // iluminação e ventilação
  const jan=pl.janelas||[], dutos=[];
  A.forEach(r=>{ const K=APTO_AMB[r.k]; if(r.k==="sacada"||r.k==="circ") return;
    let a=jan.filter(j=>j.amb===r.id).reduce((s,j)=>s+j.w*j.h,0);
    const pj=ps.filter(p=>p.k==="pj" && (p.a===r.id||p.b===r.id)); a+=pj.reduce((s,p)=>s+p.w*(J.hSala||2.1),0);
    if(K.janela){ let piso=r.area; if(r.k==="sala" && integ.has(r.id)) piso+=A.filter(x=>x.k==="cozinha" && integ.has(x.id)).reduce((s,x)=>s+x.area,0);
      const need=piso/(J.frac||6);
      if(a<=0) P("janela","bad",r.id,`${nome(r)}: sem janela (precisa estar na fachada)`);
      else if(a<need-0.01) P("janela", a<need*0.85? "bad" : "warn", r.id, `${nome(r)}: janela de ${aptoNf(a,2)} m² (mín. 1/${J.frac||6} do piso = ${aptoNf(need,2)} m²)`) }
    else if(K.duto && a<=0 && !(r.k==="cozinha" && integ.has(r.id))) dutos.push(r.id) });
  // entrada
  const ent=pl.entrada;
  if(!ent) P("entrada","bad",null,"sem porta de entrada no corredor");
  else { const re=byId[ent.amb]; if(re && !["sala","cozinha","circ","serv"].includes(re.k)) P("entrada","bad",re.id,`a entrada cai em ${nome(re).toLowerCase()} (deve ser pela sala, hall ou cozinha)`); else if(re && re.k==="serv") P("entrada","warn",re.id,"entrada pela área de serviço") }
  // portas: largura e "porta bate em porta"
  ps.forEach(p=>{ if(p.k!=="porta") return; const B=byId[p.b], Aa=byId[p.a]; const molh=(B&&aptoPorta07(B.k))||(Aa&&aptoMolhada(Aa.k)), mn= molh? R.porta.molhada : R.porta.min;
    if(p.w<mn-0.005) P("porta","bad",p.b,`porta de ${aptoNf(p.w,2)} m para ${nome(B).toLowerCase()} (mín. ${aptoNf(mn,2)} m)`);
    if(p.bate) P("portas","warn",p.abre,`porta de ${nome(byId[p.abre]).toLowerCase()} bate em outra porta`) });
  // grafo de acessos: só se passa por sala, circulação, cozinha (e hall); suíte só para o banho/closet dela; serviço só para o depósito
  const passa=(x,para)=>{ const r=byId[x], t=byId[para]; if(!r) return false; if(APTO_AMB[r.k].passa) return true;
    if(r.k==="suite") return (t.k==="bsuite"||t.k==="closet") && (!t.de || t.de===r.id); if(r.k==="closet") return t.k==="bsuite" && (!t.de || t.de===r.de);
    if(r.k==="serv") return t.k==="desp"; return false };
  const alc=new Map(); if(ent && byId[ent.amb]){ const q=[ent.amb]; alc.set(ent.amb,null);
    while(q.length){ const x=q.shift(); (lig.get(x)||[]).forEach(({o})=>{ if(alc.has(o)) return; if(!passa(x,o)) return; alc.set(o,x); q.push(o) }) } }
  if(ent) A.forEach(r=>{ if(alc.has(r.id) || r.k==="sacada") return;
    const via=(lig.get(r.id)||[]).map(e=>e.o).filter(o=>alc.has(o)); const pv=via.map(o=>byId[o]).find(Boolean);
    if(pv) P("passagem","bad",r.id,`${nome(r)} só é acessado passando por ${nome(pv).toLowerCase()}`); else P("acesso","bad",r.id,`${nome(r)}: sem acesso`) });
  // quem atende cada ambiente
  const viz=id=>(lig.get(id)||[]).map(e=>byId[e.o]).filter(Boolean);
  A.forEach(r=>{ const v=viz(r.id);
    if(r.k==="bsuite"){ const ruins=v.filter(x=>!(x.k==="suite" && (!r.de || x.id===r.de)) && !(x.k==="closet" && (!r.de || x.de===r.de))); if(ruins.length) P("passagem","bad",r.id,`${nome(r)} acessado pela ${nome(ruins[0]).toLowerCase()} (só pela suíte)`) }
    if(r.k==="closet"){ const ruins=v.filter(x=>x.k!=="suite" && x.k!=="bsuite"); if(ruins.length) P("passagem","bad",r.id,`${nome(r)} acessado pela ${nome(ruins[0]).toLowerCase()} (só pela suíte)`) }
    if(APTO_AMB[r.k].quarto || r.k==="banho" || r.k==="office"){ const ruins=v.filter(x=>x.k==="cozinha"||x.k==="serv"); if(ruins.length) P("passagem","bad",r.id,`${nome(r)} abre para a ${nome(ruins[0]).toLowerCase()}`) }
    if(r.k==="banho"){ const q=v.filter(x=>APTO_AMB[x.k].quarto); if(q.length && v.some(x=>x.k==="circ"||x.k==="sala")) P("zona","warn",r.id,`${nome(r)} com porta para ${nome(q[0]).toLowerCase()}`) }
  });
  // zoneamento
  const serv=A.filter(r=>r.k==="serv");
  serv.forEach(s=>{ if(!viz(s.id).some(x=>x.k==="cozinha")) P("zona","warn",s.id,"área de serviço sem ligação direta com a cozinha") });
  const hubs=new Set(A.filter(r=>r.k==="dorm").map(r=>alc.get(r.id)).filter(Boolean));   // a suíte pode ficar isolada (privacidade)
  if(hubs.size>1) P("zona","warn",null,"dormitórios espalhados (saem de lugares diferentes)");
  // áreas molhadas juntas (ou no corredor, onde descem as prumadas)
  A.filter(r=>APTO_AMB[r.k].molhada && r.k!=="cozinha").forEach(r=>{ const noCorr=r.bordas && r.bordas.some(b=>b.c==="corredor"||b.c==="nucleo"); const junto=A.some(x=>x!==r && APTO_AMB[x.k].molhada && (aptoComum(r,x)||{len:0}).len>=0.5);
    if(!noCorr && !junto) P("molhada","warn",r.id,`${nome(r)} isolado das outras áreas molhadas`) });
  // mobiliário
  const moveis=[];
  if(!opt.rapido && R.moveis!==false){ const res=new Map(A.map(r=>[r.id, aptoMoveis(pl,r)]));
    // sala integrada sem lugar para a mesa: a mesa pode ficar na cozinha integrada (copa)
    // (ou na sacada, a "varanda gourmet")
    A.filter(r=>r.k==="sala").forEach(s=>{ const ms=res.get(s.id); if(!ms.falta.some(p=>p.k==="mesa")) return; const mesa=APTO_MOVEIS.sala.find(p=>p.k==="mesa");
      const alvos=[A.find(x=>x.k==="cozinha" && integ.has(x.id) && integ.has(s.id)), A.find(x=>x.k==="sacada" && ps.some(p=>p.k==="pj" && p.a===s.id && p.b===x.id))].filter(Boolean);
      for(const z of alvos){ const m2=aptoMoveis(pl, z, [mesa]); if(m2.falta.some(p=>p.k==="mesa"||p.nivel==="bad")) continue; ms.falta=ms.falta.filter(p=>p.k!=="mesa"); res.set(z.id, m2); break } });
    A.forEach(r=>{ const m=res.get(r.id); moveis.push(...m.itens); m.falta.forEach(p=>P("movel", p.nivel, r.id, `${nome(r)}: não cabe ${p.nome}${(pl.giros||[]).some(g=>g.amb===r.id && !g.vao)? " (com o giro da porta)" : ""}`)) }) }
  // nota
  let nota=100; out.forEach(p=>{ nota-= p.nivel==="bad"? R.nota.bad : R.nota.warn });
  let dev=0; A.forEach(r=>{ if(r.k==="circ"||r.k==="sacada"||!(r.alvo>0)) return; const d=Math.abs(r.area/r.alvo-1)*100; if(d>R.nota.areaTol) dev+=R.nota.area*(d-R.nota.areaTol) });
  nota-=Math.min(30, dev); nota=Math.max(0, Math.round(nota*10)/10);
  return {ok:!out.some(p=>p.nivel==="bad"), nota, problemas:out, moveis, dutos, desvio:Math.round(dev*10)/10};
}
function aptoAvalia(mod, W, D, o={}, st){ const planta=aptoAplica(mod, W, D, o); return {planta, val: planta? aptoValida(planta, st, o) : {ok:false, nota:0, problemas:[{k:"programa",nivel:"bad",msg:"modelo inválido"}], moveis:[], dutos:[]}} }
/* o modelo em si (editor): retângulos dentro de W × D, sem sobreposição, cobrindo o todo; portas e entrada coerentes */
function aptoConfere(mod){
  const e=[]; if(!mod || typeof mod!=="object") return {ok:false, erros:["modelo vazio"]};
  if(!(mod.W>0 && mod.D>0)) e.push("medidas W × D inválidas");
  if(!APTO_TIPOS[mod.tipologia]) e.push("tipologia desconhecida");
  const am=(mod.ambientes||[]); if(!am.length) e.push("sem ambientes");
  const ids=new Set(); am.forEach(a=>{ if(!a.id) e.push("ambiente sem id"); else if(ids.has(a.id)) e.push(`id repetido: ${a.id}`); ids.add(a.id); if(!APTO_AMB[a.k]) e.push(`tipo de ambiente desconhecido: ${a.k}`);
    const r=a.ret||[]; if(r.length!==4 || r[2]<=0 || r[3]<=0) e.push(`${a.id}: retângulo inválido`); else if(r[0]<-0.01||r[1]<-0.01||r[0]+r[2]>mod.W+0.01||r[1]+r[3]>mod.D+0.01) e.push(`${a.id}: fora de ${aptoNf(mod.W,2)} × ${aptoNf(mod.D,2)} m`) });
  let sob=0; for(let i=0;i<am.length;i++) for(let j=i+1;j<am.length;j++){ const a=am[i].ret, b=am[j].ret; if(!a||!b) continue; const w=Math.min(a[0]+a[2],b[0]+b[2])-Math.max(a[0],b[0]), h=Math.min(a[1]+a[3],b[1]+b[3])-Math.max(a[1],b[1]); if(w>0.01&&h>0.01){ sob+=w*h; e.push(`${am[i].id} e ${am[j].id} se sobrepõem`) } }
  const tot=am.reduce((s,a)=>s+(a.ret? a.ret[2]*a.ret[3] : 0),0)-sob; if(mod.W>0 && mod.D>0 && Math.abs(tot-mod.W*mod.D)>0.01*mod.W*mod.D) e.push(`os ambientes cobrem ${aptoNf(tot,1)} m² de ${aptoNf(mod.W*mod.D,1)} m²`);
  (mod.portas||[]).forEach(p=>{ [p.a,p.b].forEach(x=>{ if(x!=="entrada" && !ids.has(x)) e.push(`porta para ambiente que não existe: ${x}`) }) });
  if(mod.entrada && !(mod.entrada.x>=0 && mod.entrada.x<=mod.W)) e.push("entrada fora da frente");
  return {ok:!e.length, erros:e};
}

/* ---------- miniatura SVG ---------- */
const aptoMiniCss = ()=>`.apto-mini{display:block;max-width:100%;height:auto;overflow:visible}
.apto-mini .am-r{stroke:var(--ink);stroke-width:.07;stroke-linejoin:miter}
.apto-mini .am-social{fill:var(--sel-soft,var(--soft))}
.apto-mini .am-intima{fill:var(--surface)}
.apto-mini .am-molhada,.apto-mini .am-servico{fill:var(--c-ant,var(--soft))}
.apto-mini .am-circ{fill:var(--faint,var(--surface))}
.apto-mini .am-externa{fill:var(--c-sac,var(--soft));stroke-dasharray:.18 .12}
.apto-mini .am-un{fill:none;stroke:var(--ink);stroke-width:.16}
.apto-mini .am-bad{stroke:var(--bad);stroke-width:.14}
.apto-mini .am-warn{stroke:var(--warn);stroke-width:.12}
.apto-mini .am-porta{fill:none;stroke:var(--ink-2,var(--ink));stroke-width:.04;opacity:.7}
.apto-mini .am-vao{stroke:var(--surface);stroke-width:.11}
.apto-mini .am-jan{stroke:var(--d-acc);stroke-width:.12}
.apto-mini .am-ent{fill:var(--mark,var(--ink))}
.apto-mini .am-t{font:600 .34px var(--f-sans,sans-serif);fill:var(--ink);text-anchor:middle;dominant-baseline:middle}
.apto-mini .am-mov{fill:var(--surface);stroke:var(--ink-2,var(--ink));stroke-width:.03;opacity:.85}
.apto-mini .am-fac{stroke:var(--muted);stroke-width:.05;stroke-dasharray:.2 .15}`;
const _aptoMiniCache=new Map();
function aptoMiniSVG(x, opts={}){
  let pl=x; if(x && !x.contorno && Array.isArray(x.ambientes) && x.ambientes[0] && x.ambientes[0].ret){ /* modelo (não planta): aplica no desenho de referência */ const key=JSON.stringify([x.id,x.atualizado||0,x.W,x.D,x.ambientes,x.portas,x.entrada,opts.espelhar]); pl=_aptoMiniCache.get(key); if(!pl){ pl=aptoAplica(x, x.W, x.D, {espelhar:opts.espelhar}); if(_aptoMiniCache.size>200) _aptoMiniCache.clear(); _aptoMiniCache.set(key,pl) } }
  if(!pl || !pl.ambientes) return `<svg class="apto-mini" viewBox="0 0 10 10" width="${opts.w||120}"></svg>`;
  const pad=0.35, [x0,y0,x1,y1]=aptoBBox(pl.contorno||[[0,0],[pl.W,0],[pl.W,pl.D],[0,pl.D]]), W=x1-x0+2*pad, H=y1-y0+2*pad;
  const X=v=>+(v-x0+pad).toFixed(3), Y=v=>+(y1-v+pad).toFixed(3);   // fachada embaixo, corredor em cima
  const pts=p=>p.map(q=>`${X(q[0])},${Y(q[1])}`).join(" ");
  const probs=(opts.val && opts.val.problemas) || opts.problemas || [], nivel={}; probs.forEach(p=>{ if(p.amb && (nivel[p.amb]!=="bad")) nivel[p.amb]=p.nivel });
  let s=""; pl.ambientes.forEach(r=>{ const z=APTO_AMB[r.k].zona; s+=`<polygon class="am-r am-${z}${nivel[r.id]? " am-"+nivel[r.id] : ""}" points="${pts(r.poly)}"><title>${r.longo} · ${aptoNf(r.area)} m²</title></polygon>` });
  (pl.portas||[]).forEach(p=>{ const a=[X(p.p0[0]),Y(p.p0[1])], b=[X(p.p1[0]),Y(p.p1[1])];
    s+=`<line class="am-vao" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`;
    if(p.k==="porta"||p.k==="entrada"){ const H0=p.dob==="p1"? p.p1 : p.p0, O=p.dob==="p1"? p.p0 : p.p1, n=p.n||[0,0], w=p.w, L=[H0[0]+n[0]*w, H0[1]+n[1]*w];
      s+=`<path class="am-porta" d="M${X(H0[0])},${Y(H0[1])} L${X(L[0])},${Y(L[1])} A${w},${w} 0 0 ${((L[0]-H0[0])*(O[1]-H0[1])-(L[1]-H0[1])*(O[0]-H0[0]))>0?0:1} ${X(O[0])},${Y(O[1])}"/>` } });
  (opts.moveis||[]).forEach(m=>{ const [a,b,c,d]=m.ret; s+=`<rect class="am-mov" x="${X(a)}" y="${Y(d)}" width="${+(c-a).toFixed(3)}" height="${+(d-b).toFixed(3)}"/>` });
  s+=`<polygon class="am-un" points="${pts(pl.contorno)}"/>`;
  (pl.janelas||[]).forEach(j=>{ s+=`<line class="am-jan" x1="${X(j.p0[0])}" y1="${Y(j.p0[1])}" x2="${X(j.p1[0])}" y2="${Y(j.p1[1])}"/>` });
  if(pl.entrada){ const c=[(pl.entrada.p0[0]+pl.entrada.p1[0])/2,(pl.entrada.p0[1]+pl.entrada.p1[1])/2], n=pl.entrada.n||[0,-1], t=[c[0]-n[0]*0.45, c[1]-n[1]*0.45], q=[-n[1]*0.22, n[0]*0.22];
    s+=`<polygon class="am-ent" points="${X(c[0])},${Y(c[1])} ${X(t[0]+q[0])},${Y(t[1]+q[1])} ${X(t[0]-q[0])},${Y(t[1]-q[1])}"/>` }
  if(opts.rotulos) pl.ambientes.forEach(r=>{ if(r.k==="circ"||r.area<3.5) return; const ci=aptoCirculoInscrito(r.poly); if(ci.d<1.3) return; s+=`<text class="am-t" x="${X(ci.c[0])}" y="${Y(ci.c[1])}">${r.k==="bsuite"? "Banho" : r.nome}</text>` });
  const w=opts.w||120, h=opts.h||Math.round(w*H/W);
  return `<svg class="apto-mini" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${+W.toFixed(3)} ${+H.toFixed(3)}" width="${w}" height="${h}" role="img" aria-label="${(opts.titulo||pl.nome||"Planta").replace(/"/g,"&quot;")}">${s}</svg>`;
}
