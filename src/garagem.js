/* ================= garagem: circulação vertical, layout de vagas, manobra e rotas ================= */
/* Modelo:
   - Rampas retas em faixas (strips). "reta": todas as rampas de um sentido empilhadas na mesma projeção;
     em cada pavimento o carro chega pela ponta interna e, para descer de novo, volta à ponta da frente.
     "alternada" (tesoura): duas faixas lado a lado, com sentidos opostos; chegada e partida na mesma ponta (retorno em U).
   - Rampas que descem (subsolos) e que sobem (garagens elevadas) ficam em faixas diferentes, lado a lado na entrada.
   - Cada ponta de rampa tem um patamar plano (sem vagas) e um "portal" que precisa estar ligado à circulação.
   - O layout de vagas é gerado por fileiras e validado numa malha de 0,5 m: o carro (folga mínima de 2,4 m)
     precisa chegar de um portal à frente de cada vaga, com profundidade de manobra livre diante dela. */
const GRES=0.5, CAR_R=1.2, PATAMAR=5.0;
const _garCache=new Map();
/* caixas envolventes: os testes de sobreposição só rodam onde as caixas se tocam (mesmo resultado, bem mais rápido com polígonos curvos) */
const bbOf=p=>{ let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity; for(const q of p){ if(q[0]<x0)x0=q[0]; if(q[0]>x1)x1=q[0]; if(q[1]<y0)y0=q[1]; if(q[1]>y1)y1=q[1] } return [x0,y0,x1,y1] };
const bbHit=(a,b)=>a[0]<=b[2]&&b[0]<=a[2]&&a[1]<=b[3]&&b[1]<=a[3];
const obList=list=>(list||[]).filter(p=>p&&p.length).map(p=>({p, b:bbOf(p)}));
const obHit=(L,poly)=>{ const b=bbOf(poly); return L.some(o=>bbHit(o.b,b) && G.polysOverlap(poly,o.p)) };
const obPip=(L,pt)=>L.some(o=>pt[0]>=o.b[0]&&pt[0]<=o.b[2]&&pt[1]>=o.b[1]&&pt[1]<=o.b[3] && G.pip(pt,o.p));
const rampLen=(h,E)=> h/Math.max(0.05,E.rampaInc) + 3.0; // + transições de 1,5 m em cada ponta
function stripPoly(lat,fd,lc,w,d0,d1){ return G.rect(lat,fd,lc-w/2,d0,w,d1-d0) }
/* ---------- garagem completa: opções novas (todas desligadas por padrão; os estudos antigos não mudam) ----------
   estudo.rampaTipo: "reta" | "alternada" | "helicoidal" | "L" | "elevador" (elevador de carros) */
extendDEF("garagem", {
  heliRi: 3.5, heliRe: 7.5,                    // helicoidal: raio interno (≥ 3 m) e externo (≥ 7,5 m) da faixa
  ecN: 1, ecEspera: 0, ecVel: 0.5, ecManobra: 40, ecPico: 0.3, ecCusto: 450000, // elevador de carros (espera 0 = automática, pela fila prevista)
  presas: false, presasMax: 0.3, presasVinc: "unidade",   // vagas presas (tandem): % de unidades que aceitam · vínculo
  motos: false, motosMax: 0.1,                 // motos 1,0 × 2,2 m nas sobras (máx. em % das unidades)
  bici: "off", biciPorUn: 1, biciM2: 100,      // bicicletário: off | un (por unidade) | area (1 a cada X m² construídos)
  ev: 0, evCusto: 9000                         // % de vagas com recarga e custo por ponto
});
const garX = st => (st && st.garagem) || DEF.garagem;
const RAMPA_TIPOS = { reta:"Retas empilhadas", alternada:"Alternadas (tesoura)", helicoidal:"Helicoidal", L:"Em L, com patamar", elevador:"Elevador de carros" };
const rampaX = t => t==="helicoidal" || t==="L" || t==="elevador";
const EC_CAB=[2.7,5.8], EC_PAREDE=0.25, MOTO=[1.0,2.2], BICI=[3.0,2.0,5]; // cabine · moto · módulo de bicicletário (largura, prof., bicicletas)
/* geometria das rampas novas no referencial (lateral l, profundidade d) */
function rampGeoX(st, RX, pos, latv, dir){
  const E=st.estudo, GX=garX(st), w=E.rampaL+0.3;
  const P2=(l,d)=>[latv[0]*l+dir[0]*d, latv[1]*l+dir[1]*d];
  const rLD=(l0,l1,d0,d1)=>G.rect(latv,dir,Math.min(l0,l1),Math.min(d0,d1),Math.abs(l1-l0),Math.abs(d1-d0));
  if(RX.tipo==="helicoidal"){
    const {Re,Ri,Rc}=RX, lc=pos.c, dc=pos.d, sL=pos.sL||1, rot=sL, th0= sL>0? 0 : Math.PI, land=PATAMAR, lL=lc+sL*(Re+w/2);
    const circ=(r,n)=>Array.from({length:n},(_,i)=>{ const a=i/n*2*Math.PI; return P2(lc+r*Math.cos(a), dc+r*Math.sin(a)) });
    const arc=(a0,da,n)=>Array.from({length:n+1},(_,i)=>{ const a=a0+rot*da*i/n; return P2(lc+Rc*Math.cos(a), dc+Rc*Math.sin(a)) });
    return {tipo:RX.tipo, lc, dc, lL, sL, rot, th0, Re, Ri, Rc, w, disk:circ(Re,40), hole:circ(Ri,28), arc,
      T:P2(lc+Rc*Math.cos(th0), dc), c:P2(lc,dc),
      landing:rLD(lc+sL*(Re-0.3), lc+sL*(Re+w+0.3), dc-land, dc+land),   // patamar tangente, ao lado da helicoidal
      pIn:P2(lL, dc+land-1.4), pOut:P2(lL, dc-land+1.4), lane:rLD(lL-w/2, lL+w/2, RX.lotFront, dc)};
  }
  if(RX.tipo==="elevador"){
    const n=ecNum(GX), cw=EC_CAB[0]+2*EC_PAREDE, Wt=n*cw, Dp=RX.Dp, s0=pos.d, lc=pos.c, Wl=Math.max(w,Wt)+0.6;
    const shafts=[], cabs=[]; for(let i=0;i<n;i++){ const l0=lc-Wt/2+i*cw; shafts.push(rLD(l0,l0+cw,s0,s0+Dp)); cabs.push(rLD(l0+EC_PAREDE,l0+cw-EC_PAREDE,s0+EC_PAREDE,s0+Dp-EC_PAREDE)) }
    const espera=[]; for(let i=0;i<RX.nE;i++) espera.push(rLD(lc-1.25,lc+1.25,s0-0.3-(i+1)*5.5,s0-0.3-i*5.5));
    const fr=pos.porta==="frente"; // frente: porta única, o carro sai de ré para a acomodação diante do poço
    return {tipo:RX.tipo, n, lc, s0, Dp, Wt, shafts, cabs, espera, porta:fr?"frente":"fundo", all:rLD(lc-Wt/2,lc+Wt/2,s0,s0+Dp),
      landing: fr? rLD(lc-Wl/2,lc+Wl/2,s0-RX.land,s0) : rLD(lc-Wl/2,lc+Wl/2,s0+Dp,s0+Dp+RX.land),
      p: fr? P2(lc,s0-RX.land+1.4) : P2(lc,s0+Dp+RX.land-1.4), heading: fr? [-dir[0],-dir[1]] : dir, front:P2(lc,s0), back:P2(lc,s0+Dp)};
  }
  // em L: lance 1 ao longo do eixo, patamar plano no canto, lance 2 para o lado de dentro do lote
  const lc=pos.c, d0=pos.d, sg=pos.sg||1, L1=RX.L1, L2=RX.L2, e=d0+L1, f=e+w, a=lc-w/2, b=lc+w/2, xE= sg>0? b+L2 : a-L2, dm=e+w/2, tc=L1/(L1+L2);
  const loc = sg>0? [[a,d0],[b,d0],[b,e],[xE,e],[xE,f],[a,f]] : [[a,d0],[b,d0],[b,f],[xE,f],[xE,e],[a,e]];
  return {tipo:"L", lc, d0, sg, L1, L2, e, f, w, poly:loc.map(q=>P2(q[0],q[1])),
    path:[[...P2(lc,d0),0],[...P2(lc,e),tc],[...P2(lc,dm),tc],[...P2(lc+sg*w/2,dm),tc],[...P2(xE,dm),1]],
    E:P2(lc,d0), X:P2(xE,dm), heading:[latv[0]*sg,latv[1]*sg],
    landDep:rLD(lc-(w+0.6)/2, lc+(w+0.6)/2, d0-RX.land, d0), pDep:P2(lc,d0-(RX.land-1.4)),
    landArr:rLD(xE, xE+sg*RX.land, e-0.3, f+0.3), pArr:P2(xE+sg*(RX.land-1.4), dm)};
}
/* arranjo lateral da entrada: faixas das rampas (descida D, subida U; B = segunda faixa das alternadas) e a faixa da garagem do térreo.
   Testa várias ordens e desloca o conjunto até caber nos pavimentos sem passar pelos núcleos. */
function driveLayout(st, lmn, lmx, vc, m, fd, lat, opt={}){
  if(rampaX(st.estudo.rampaTipo) && (st.produto.subsolos||st.produto.garAcima)) return driveLayoutX(st, lmn, lmx, vc, m, fd, lat, opt);
  const P=st.produto, E=st.estudo, nS=P.subsolos, nA=P.garAcima, garOn=!!P.garTerOn && !opt.semFaixa, alt=E.rampaTipo==="alternada" && !opt.semAlt;
  const w=E.rampaL+0.3, lane = garOn? ((nS||nA)? 3.5 : 5.0) : 0;
  const hasDB=alt&&nS>1, hasUB=alt&&nA>1;
  const D = nS? (hasDB? [["DA","DB"],["DB","DA"]] : [["DA"]]) : [[]];
  const U = nA? (hasUB? [["UA","UB"],["UB","UA"]] : [["UA"]]) : [[]];
  const orders=[]; D.forEach(d=>U.forEach(u=>{ orders.push([...d,...u]); if(nS&&nA) orders.push([...u,...d]) }));
  const span=Math.max(1,lmx-lmn), side = (vc-lmn) <= (lmx-vc) ? 1 : -1;
  const RX = m&&fd? rampExt(st, m, fd) : null, obst=(m&&m.obst)||[];
  const build=(ord, dlt)=>{ const seq=[...ord]; if(lane) seq.push("lane");
    const width=seq.reduce((s_,p)=>s_+(p==="lane"?lane:w),0), k=Math.min(1, span*0.85/width);
    let a = (side>0? clamp(vc-width*k/2, lmn, lmx-width*k) : clamp(vc+width*k/2, lmn+width*k, lmx)) + dlt;
    const o={side, w:w*k, lane:lane*k, ord:seq}; const ext={};
    seq.forEach(p=>{ const ww=(p==="lane"?lane:w)*k; o[p]=a+side*ww/2; ext[p]=[Math.min(a,a+side*ww), Math.max(a,a+side*ww)]; a+=side*ww });
    // no térreo, o acesso cobre as faixas de entrada (A), a faixa da garagem e o que estiver entre elas
    const ent=seq.filter(p=>p==="DA"||p==="UA"||p==="lane"), idx=ent.map(p=>seq.indexOf(p)), i0=Math.min(...idx), i1=Math.max(...idx);
    const cov=seq.slice(i0,i1+1).map(p=>ext[p]); o.dv=[Math.min(...cov.map(e=>e[0])), Math.max(...cov.map(e=>e[1]))];
    if(lane) o.laneIv=ext.lane;
    return o };
  const fits=o=>{ if(!RX) return true;
    const sp=(lc,L)=>stripPoly(lat,fd,lc,o.w,RX.s0,RX.s0+L);
    const chk=(lc,L,poly)=> lc==null || ((!poly || !poly.length || G.polyInPoly(sp(lc,L),poly)) && !obst.some(c=>G.polysOverlap(sp(lc,L),c)));
    const laneOk = !o.laneIv || !obst.some(c=>G.polysOverlap(G.rect(lat,fd,o.laneIv[0],RX.lotFront,o.laneIv[1]-o.laneIv[0],RX.s0+RX.LD-RX.lotFront),c));
    const dvOk = !obst.some(c=>G.polysOverlap(G.rect(lat,fd,o.dv[0],RX.lotFront,o.dv[1]-o.dv[0],RX.s0+2-RX.lotFront),c));
    return laneOk && dvOk && chk(o.DA,RX.LD,m.sub) && chk(o.DB,RX.LD,m.sub) && chk(o.DA,Math.min(RX.LD,6),m.emb) && chk(o.UA,RX.LU,m.emb) && chk(o.UB,RX.LU,m.emb) };
  if(!orders[0].length && !lane) return null;
  if(E.rampa) return build(orders[0],0);
  for(const ord of orders){ for(let t=0;t<=14;t+=0.5) for(const sg of (t?[1,-1]:[1])){ const o=build(ord, sg*t); if(fits(o)){ if(t) o.shift=sg*t; if(opt.semAlt) o.semAlt=true; if(opt.semFaixa) o.semFaixa=true; return o } } }
  // não coube: tenta sem a segunda faixa (rampas retas) e depois sem a faixa da garagem do térreo
  if(alt && (hasDB||hasUB)) return driveLayout(st, lmn, lmx, vc, m, fd, lat, {...opt, semAlt:true});
  if(garOn && (nS||nA)) return driveLayout(st, lmn, lmx, vc, m, fd, lat, {...opt, semFaixa:true});
  const o=build(orders[0],0); o.naoCabe=true; if(opt.semAlt) o.semAlt=true; if(opt.semFaixa) o.semFaixa=true; return o;
}
/* arranjo da entrada para helicoidal, rampa em L e elevador de carros (mesma ideia: elementos lado a lado, deslocados até caber) */
function driveLayoutX(st, lmn, lmx, vc, m, fd, lat, opt={}){
  const P=st.produto, E=st.estudo, tipo=E.rampaTipo, nS=P.subsolos, nA=P.garAcima, garOn=!!P.garTerOn && !opt.semFaixa;
  const w=E.rampaL+0.3, lane=garOn? 3.5 : 0, side=(vc-lmn)<=(lmx-vc)? 1 : -1, OB=obList(m&&m.obst);
  const RX = m&&fd? rampExt(st, m, fd) : null, GX=garX(st), prim = nS? "D" : "U";
  const Re = RX&&RX.Re || Math.max(7.5,+GX.heliRe||7.5), wEl=Math.max(w, ecNum(GX)*(EC_CAB[0]+2*EC_PAREDE));
  const L_=lane? [["lane",lane]] : [], pre = prim==="D"&&nA? [["UA",w]] : [];
  // variantes: helicoidal com a faixa de entrada de um lado ou do outro · L com o lance 2 para dentro ou para fora · elevador com saída pelo fundo ou pela frente (de ré)
  const vars = tipo==="helicoidal"? [{els:[["HE",w],["H",2*Re],...L_], sL:-side}, {els:[["H",2*Re],["HE",w],...L_], sL:side}]
    : tipo==="elevador"? [{els:[["EL",wEl],...L_], porta:"fundo"}, {els:[["EL",wEl],...L_], porta:"frente"}]
    : [{els:[...L_,...pre,[prim+"A",w]], sg:side}, {els:[[prim+"A",w],...pre,...L_], sg:-side}];
  const build=(vr,dlt)=>{ const els=vr.els, width=els.reduce((s_,e)=>s_+e[1],0);
    let a=(side>0? clamp(vc-width/2, lmn, lmx-width) : clamp(vc+width/2, lmn+width, lmx)) + dlt;
    const o={side, w, lane, ord:els.map(e=>e[0]), tipo, sL:vr.sL, sg:vr.sg, porta:vr.porta}; const ext={};
    els.forEach(([p,ww])=>{ o[p]=a+side*ww/2; ext[p]=[Math.min(a,a+side*ww), Math.max(a,a+side*ww)]; a+=side*ww });
    const all=Object.values(ext); o.dv=[Math.min(...all.map(e=>e[0])), Math.max(...all.map(e=>e[1]))];
    if(lane) o.laneIv=ext.lane;
    return o };
  const fits=o=>{ if(!RX) return true;
    const g=rampGeoX(st, RX, posX(o, RX, prim), lat, fd), inF=(p,F)=>!F||!F.length||G.polyInPoly(p,F), noC=p=>!obHit(OB,p);
    if(o.laneIv && obHit(OB, G.rect(lat,fd,o.laneIv[0],RX.lotFront,o.laneIv[1]-o.laneIv[0],RX.s0+RX.LD-RX.lotFront))) return false;
    if(obHit(OB, G.rect(lat,fd,o.dv[0],RX.lotFront,o.dv[1]-o.dv[0],RX.s0+2-RX.lotFront))) return false;
    const F = nS? m.sub : m.emb;
    if(tipo==="helicoidal") return inF(g.disk,F) && inF(g.landing,F) && (!nS||!nA||inF(g.disk,m.emb)) && noC(g.disk) && noC(g.landing) && noC(g.lane);
    if(tipo==="elevador") return inF(g.all,F) && inF(g.landing,F) && (!nS||!nA||inF(g.all,m.emb)) && noC(g.all) && noC(g.landing) && g.espera.every(noC);
    const okL = inF(g.poly,F) && inF(g.landArr,F) && noC(g.poly) && noC(g.landArr);
    if(!okL || !pre.length) return okL;
    const su=stripPoly(lat,fd,o.UA,w,RX.s0,RX.s0+RX.LU); return inF(su,m.emb) && noC(su) };
  if(E.rampa) return build(vars[0],0);
  for(const vr of vars) for(let t=0;t<=14;t+=0.5) for(const sg of (t?[1,-1]:[1])){ const o=build(vr,sg*t); if(fits(o)){ if(t) o.shift=sg*t; if(opt.semFaixa) o.semFaixa=true; return o } }
  if(garOn) return driveLayoutX(st, lmn, lmx, vc, m, fd, lat, {...opt, semFaixa:true});
  const o=build(vars[0],0); o.naoCabe=true; if(opt.semFaixa) o.semFaixa=true; return o;
}
/* posição do elemento principal (centro lateral e profundidade) a partir do arranjo da entrada */
function posX(o, RX, prim){ return o.tipo==="helicoidal"? {c:o.H, d:RX.dc, sL:o.sL} : o.tipo==="elevador"? {c:o.EL, d:RX.s0, porta:o.porta} : {c:o[prim+"A"], d:RX.s0, sg:o.sg} }
/* início e comprimento das faixas de rampa (modo automático) */
function rampExt(st, m, dir){
  const P=st.produto, E=st.estudo, tipo=E.rampaTipo, alt=tipo==="alternada", land=alt?6.5:PATAMAR;
  const LD=rampLen(P.peGar,E), LU=Math.max(rampLen(P.peTerreo,E), P.garAcima>1? rampLen(P.peGar,E):0);
  const lotFront=G.extent(st.lote.pts,dir)[0], subF=m.sub&&m.sub.length? G.extent(m.sub,dir)[0] : lotFront, embF=m.emb&&m.emb.length? G.extent(m.emb,dir)[0] : lotFront;
  if(tipo==="helicoidal"){ const GX=garX(st), Re=Math.max(7.5,+GX.heliRe||7.5), Ri=clamp(+GX.heliRi||3.5, 3, Re-2.5);
    let dc=Math.max(lotFront+PATAMAR, embF+Re+0.3); if(P.subsolos) dc=Math.max(dc, subF+Re+0.3);
    return {tipo, s0:dc-Re, LD:2*Re, LU:2*Re, land:PATAMAR, lotFront, dc, Re, Ri, Rc:(Re+Ri)/2} }
  if(tipo==="elevador"){ const nE=ecEsperaN(st, m), Dp=EC_CAB[1]+2*EC_PAREDE;
    let s0=Math.max(lotFront+Math.max(PATAMAR, nE*5.5+0.5), embF+0.3); if(P.subsolos) s0=Math.max(s0, subF+6.3);
    return {tipo, s0, LD:Dp, LU:Dp, land:6.0, lotFront, nE, Dp} }
  let s0=Math.max(lotFront+PATAMAR, embF+0.3);
  if(P.subsolos>1) s0=Math.max(s0, subF+land+0.6);
  if(P.garAcima>1) s0=Math.max(s0, embF+land+0.6);
  if(tipo==="L"){ const h = P.subsolos? P.peGar : P.peTerreo, sl=h/Math.max(0.05,E.rampaInc), L1=Math.round((sl/2+3)*2)/2, L2=Math.max(3, sl+6-L1), w=E.rampaL+0.3;
    // cada lance tem transições nas duas pontas; o canto é plano (w × w)
    return {tipo, s0, LD: P.subsolos? L1+w : LD, LU: P.subsolos? LU : L1+w, land, lotFront, L1, L2} }
  return {s0, LD, LU, land, lotFront};
}
/* circulação vertical completa */
function vertical(st, m){
  const P=st.produto, E=st.estudo, T=m.ter||{}, nS=P.subsolos, nA=P.garAcima, alt=E.rampaTipo==="alternada" && !(T.drive0&&T.drive0.semAlt);
  const V={strips:[], segs:[], floors:{}, warn:[], ok:true};
  const fd=T.fd||frontDir(st), lat=T.lat||[fd[1],-fd[0]];
  V.fd=fd; V.lat=lat;
  const floorOf=k=> k<0? m.sub : k>0? m.emb : (T.gar||[]);
  const keyOf=k=> k<0? "s"+(-k) : k>0? "g"+k : "ter";
  for(let k=-nS;k<=nA;k++) V.floors[keyOf(k)]={k, key:keyOf(k), poly:floorOf(k), blocks:[], landings:[], portals:[], ramps:[]};
  if(!(nS||nA)) return V;
  const w=E.rampaL+0.3;
  // eixo e posição: automático pela entrada; manual pela rampa arrastada
  let dir=fd, latv=lat, base={};
  if(E.rampa){ const a=E.rampa.a*Math.PI/180; dir=[Math.cos(a),Math.sin(a)]; latv=[dir[1],-dir[0]]; const c=[E.rampa.x,E.rampa.y];
    base.c=G.dot(c,latv); base.mid=G.dot(c,dir); }
  const D=T.drive0||null; // arranjo da entrada calculado no térreo
  const RX=rampExt(st, m, dir), LD=RX.LD, LU=RX.LU, land=RX.land, s0=RX.s0;
  const strip=(id,lc,L,kind,d0)=>{ const poly=stripPoly(latv,dir,lc,w,d0,d0+L); const s={id,lc,L,kind,d0,d1:d0+L,poly}; V.strips.push(s); return s };
  let lcDA, lcDB, lcUA, lcUB, d0D=s0, d0U=s0;
  if(E.rampa){ const first = nS>0? "D" : "U"; const L0= first==="D"? LD : LU; d0D=d0U=base.mid-L0/2;
    if(first==="D"){ lcDA=base.c; lcUA=base.c+w; } else { lcUA=base.c; }
    lcDB=lcDA!=null? lcDA-w : null; lcUB=lcUA!=null? lcUA+w : null }
  else if(D){ lcDA=D.DA; lcUA=D.UA; lcDB=D.DB; lcUB=D.UB }
  else { V.ok=false; V.warn.push("Sem área para o acesso de veículos."); return V }
  const P2=(l,d)=>[latv[0]*l+dir[0]*d, latv[1]*l+dir[1]*d];
  const landPoly=(lc,ww,da,db)=>G.rect(latv,dir,lc-ww/2,Math.min(da,db),ww,Math.abs(db-da));
  // pilhas de rampas
  const stack=(kind,n,lcA,lcB,L,d0)=>{
    if(!n) return;
    const A=strip(kind+"A",lcA,L,kind,d0), B= alt&&n>1? strip(kind+"B",lcB,L,kind,d0) : null;
    const sg=kind==="D"?-1:1; // sentido vertical
    for(let r=1;r<=n;r++){ // rampa r liga o pavimento (r-1) ao r (em módulo)
      const S= (alt && r%2===0)? B : A, fwd = !(alt && r%2===0);
      const Ed = fwd? S.d0 : S.d1, Xd = fwd? S.d1 : S.d0, h = fwd? 1 : -1; // entrada, saída e sentido ao longo do eixo
      const up=sg*(r-1), lo=sg*r; // pavimento de onde sai e onde chega
      V.segs.push({kind, r, strip:S.id, E:P2(S.lc,Ed), X:P2(S.lc,Xd), w, fromK:up, toK:lo});
      const fFrom=V.floors[keyOf(up)], fTo=V.floors[keyOf(lo)];
      const lw = alt&&n>1? 2*w+0.6 : w+0.6, lcL = alt&&n>1? (A.lc+B.lc)/2 : S.lc;
      // partida (pavimento de cima / de baixo na subida)
      if(fFrom && up!==0){ const lp=landPoly(lcL,lw,Ed-h*land,Ed); fFrom.landings.push(lp); fFrom.portals.push({p:P2(S.lc,Ed-h*(land-1.4)), heading:[dir[0]*h,dir[1]*h], tipo:"sai", r, kind, label:kind==="D"? `desce para o subsolo ${-lo}` : `sobe para a garagem ${lo}`}) }
      if(fTo){ const lp=landPoly(lcL,lw,Xd,Xd+h*land); fTo.landings.push(lp); fTo.portals.push({p:P2(S.lc,Xd+h*(land-1.4)), heading:[dir[0]*h,dir[1]*h], tipo:"chega", r, kind, label:"chegada da rampa"}) }
      // a faixa fica ocupada nos dois pavimentos que a rampa liga
      [fFrom,fTo].forEach(f=>{ if(f && !f.blocks.includes(S.poly)) f.blocks.push(S.poly) });
      if(fFrom) fFrom.ramps.push({poly:S.poly, a:P2(S.lc,Ed), b:P2(S.lc,Xd), txt: kind==="D"? `desce ao subsolo ${-lo}` : `sobe à garagem ${lo}`, sai:true});
      if(fTo) fTo.ramps.push({poly:S.poly, a:P2(S.lc,Ed), b:P2(S.lc,Xd), txt: kind==="D"? `chega ${up===0?"do térreo":"do subsolo "+(-up)}` : `chega ${up===0?"do térreo":"da garagem "+up}`, sai:false});
    }
  };
  if(rampaX(E.rampaTipo)) verticalX(st, m, V, {dir, latv, base, D, RX, w, keyOf, P2, stack});
  else { stack("D", nS, lcDA, lcDB, LD, d0D); stack("U", nA, lcUA, lcUB, LU, d0U) }
  // validações geométricas
  const msgFora={D:"A rampa dos subsolos não cabe dentro do subsolo — encurte (inclinação maior) ou mova o acesso.", U:"A rampa das garagens elevadas não cabe no embasamento.",
    H:"A rampa helicoidal não cabe no pavimento de garagem — reduza os raios ou mova o acesso.", EL:"O poço do elevador de carros não cabe no pavimento de garagem — mova o acesso."};
  V.strips.forEach(s=>{ const fl = s.kind==="D"? m.sub : s.kind==="U"? m.emb : (nS? m.sub : m.emb); if(fl.length && !G.polyInPoly(s.poly, fl)){ V.ok=false; const t=msgFora[s.kind]||msgFora.D; if(!V.warn.includes(t)) V.warn.push(t) } });
  Object.values(V.floors).forEach(f=>{ f.portals.forEach(pt=>{ if(f.poly.length && !G.pip(pt.p,f.poly)){ V.ok=false; pt.fora=true; const t=`No ${nomePav(f.key)}, o patamar da rampa fica fora do pavimento.`; if(!V.warn.includes(t)) V.warn.push(t) } }) });
  // compatibilidade: rampa de entrada
  const first=V.strips.find(s=>s.id==="DA")||V.strips.find(s=>s.id==="UA");
  if(first && !V.entry){ const seg=V.segs.find(g=>g.strip===first.id && g.r===1); V.entry={poly:first.poly, c:P2(first.lc,(first.d0+first.d1)/2), dir, len:first.L, w, top:seg.E, foot:seg.X} }
  V.drive=[...new Set([lcDA,lcUA].filter(v=>v!=null))];
  return V;
}
/* helicoidal, rampa em L e elevador de carros: faixas, patamares e portais de cada pavimento */
function verticalX(st, m, V, c){
  const P=st.produto, E=st.estudo, tipo=E.rampaTipo, nS=P.subsolos, nA=P.garAcima, {dir, latv, base, D, RX, w, keyOf, P2}=c;
  const fl=k=>V.floors[keyOf(k)], man=!!E.rampa, kName=k=> k<0? `subsolo ${-k}` : k>0? `garagem ${k}` : "térreo";
  if(tipo==="helicoidal"){
    const g=rampGeoX(st, RX, man? {c:base.c, d:base.mid, sL:1} : posX(D, RX), latv, dir), N=36;
    V.strips.push({id:"H", kind:"H", lc:g.lc, L:2*g.Re, d0:g.dc-g.Re, d1:g.dc+g.Re, poly:g.disk, hole:g.hole});
    const path=g.arc(g.th0, 2*Math.PI, N).map((p,i)=>[p[0],p[1],i/N]);
    [["D",nS,-1],["U",nA,1]].forEach(([kind,n,sg])=>{ for(let r=1;r<=n;r++) V.segs.push({kind, r, strip:"H", E:g.T, X:g.T, w:g.Re-g.Ri, fromK:sg*(r-1), toK:sg*r, path}) });
    for(let k=-nS;k<=nA;k++){ const f=fl(k); if(!f) continue; f.blocks.push(g.disk);
      const alem = k<0? k>-nS : k>0? k<nA : false;
      if(k){ f.landings.push(g.landing); f.portals.push({p:g.pIn, heading:dir, tipo:"chega", label:"chegada da helicoidal"});
        if(alem) f.portals.push({p:g.pOut, heading:dir, tipo:"sai", label: k<0? `desce para o subsolo ${-k+1}` : `sobe para a garagem ${k+1}`}) }
      const txt = k===0? `helicoidal · ${[nS?"desce":"",nA?"sobe":""].filter(Boolean).join(" e ")}` : alem? `helicoidal · ${k<0?"desce ao subsolo "+(-k+1):"sobe à garagem "+(k+1)}` : `helicoidal · chega ${k<0?(k===-1?"do térreo":"do subsolo "+(-k-1)):(k===1?"do térreo":"da garagem "+(k-1))}`;
      f.ramps.push({poly:g.disk, hole:g.hole, path:g.arc(g.th0+g.rot*0.35, 2*Math.PI-0.9, 32), wl:g.Re-g.Ri, a:g.T, b:g.T, txt, sai:alem||k===0, heli:true}) }
    // inclinação no eixo da faixa (uma volta por pavimento)
    const incl=h=>h/(2*Math.PI*g.Rc), iMax=Math.max(nS? incl(P.peGar):0, nA? incl(P.peTerreo):0);
    V.helix={c:g.c, Re:g.Re, Ri:g.Ri, Rc:g.Rc, rot:g.rot, incl:iMax, faixa:g.Re-g.Ri};
    if(iMax>E.rampaInc+1e-6) V.warn.push(`A helicoidal fica com ${nf(iMax*100,1)}% de inclinação no eixo — aumente os raios.`);
    if(g.Re-g.Ri<2.75) V.warn.push("A faixa da helicoidal ficou com menos de 2,75 m — afaste os raios.");
    V.entry={poly:g.disk, c:g.c, dir, len:2*g.Re, w, top:g.T, foot:g.T};
    if(!man) V.entradas=[{a:P2(g.lL,RX.lotFront-2), b:P2(g.lL,g.dc)}];
    return;
  }
  if(tipo==="elevador"){
    const g=rampGeoX(st, RX, man? {c:base.c, d:base.mid-RX.Dp/2} : posX(D, RX), latv, dir);
    g.shafts.forEach((p,i)=>V.strips.push({id:"EL"+(i+1), kind:"EL", lc:g.lc, L:g.Dp, d0:g.s0, d1:g.s0+g.Dp, poly:p}));
    for(let k=-nS;k<=nA;k++){ const f=fl(k); if(!f) continue; f.blocks.push(...g.shafts);
      if(k){ f.landings.push(g.landing); f.portals.push({p:g.p, heading:g.heading, tipo:"chega", label:"acomodação do elevador"});
        V.segs.push({kind:k<0?"D":"U", r:Math.abs(k), strip:"EL1", E:g.front, X:g.back, w:g.Wt, fromK:0, toK:k, elev:true}) }
      f.ramps.push({poly:g.all, cabs:g.cabs, elev:true, a:g.front, b:g.back, txt:`elevador de carros${g.n>1?" ×"+g.n:""}`, sai:false}) }
    V.elev={n:g.n, porta:g.porta, shafts:g.shafts, cabs:g.cabs, espera:g.espera, landing:g.landing, kMin:-nS, kMax:nA};
    V.entry={poly:g.all, c:P2(g.lc,g.s0+g.Dp/2), dir, len:g.Dp, w:g.Wt, top:g.front, foot:g.back};
    if(!man) V.entradas=[{a:P2(g.lc,RX.lotFront-2), b:P2(g.lc,g.s0-0.3)}];
    return;
  }
  // em L (pilha no mesmo lugar, como as retas): sai pela frente do lance 1, chega pela ponta do lance 2
  const prim = nS? "D" : "U", n = nS||nA, sgv = prim==="D"? -1 : 1;
  const g=rampGeoX(st, RX, man? {c:base.c, d:base.mid-RX.L1/2, sg:1} : posX(D, RX, prim), latv, dir);
  V.strips.push({id:prim+"A", kind:prim, lc:g.lc, L:g.L1+w, d0:g.d0, d1:g.f, poly:g.poly, Lshape:true});
  const path2=g.path.map(q=>[q[0],q[1]]);
  for(let r=1;r<=n;r++){ const up=sgv*(r-1), lo=sgv*r, fFrom=fl(up), fTo=fl(lo);
    V.segs.push({kind:prim, r, strip:prim+"A", E:g.E, X:g.X, w, fromK:up, toK:lo, path:g.path});
    if(fFrom && up!==0){ fFrom.landings.push(g.landDep); fFrom.portals.push({p:g.pDep, heading:dir, tipo:"sai", r, kind:prim, label: prim==="D"? `desce para o subsolo ${-lo}` : `sobe para a garagem ${lo}`}) }
    if(fTo){ fTo.landings.push(g.landArr); fTo.portals.push({p:g.pArr, heading:g.heading, tipo:"chega", r, kind:prim, label:"chegada da rampa"}) }
    [fFrom,fTo].forEach(f=>{ if(f && !f.blocks.includes(g.poly)) f.blocks.push(g.poly) });
    if(fFrom) fFrom.ramps.push({poly:g.poly, path:path2, a:g.E, b:g.X, txt: prim==="D"? `desce ao subsolo ${-lo}` : `sobe à garagem ${lo}`, sai:true});
    if(fTo) fTo.ramps.push({poly:g.poly, path:path2, a:g.E, b:g.X, txt:`chega ${up===0?"do térreo":"do "+kName(up)}`, sai:false});
  }
  V.entry={poly:g.poly, c:P2(g.lc,g.d0+g.L1/2), dir, len:g.L1, w, top:g.E, foot:g.X};
  // garagens elevadas junto com subsolos: a subida segue reta, na faixa ao lado (do lado oposto ao lance 2)
  if(prim==="D" && nA) c.stack("U", nA, man? base.c-w*(g.sg||1) : D.UA, null, RX.LU, man? base.mid-RX.L1/2 : RX.s0);
}
function nomePav(key){ return key==="ter"? "térreo" : key[0]==="s"? "subsolo "+key.slice(1) : "garagem "+key.slice(1) }

/* ---------- gerador de fileiras ---------- */
function lineSpan(poly, ux, vy, v){
  let mn=Infinity, mx=-Infinity;
  for(let i=0;i<poly.length;i++){ const a=poly[i], b=poly[(i+1)%poly.length]; const av=G.dot(a,vy), bv=G.dot(b,vy); if((av-v)*(bv-v)<=0 && av!==bv){ const t=(v-av)/(bv-av), u=G.dot(a,ux)+(G.dot(b,ux)-G.dot(a,ux))*t; if(u<mn)mn=u; if(u>mx)mx=u } }
  return mn<mx? [mn,mx] : null;
}
function genLayout(poly, obst, keep, ux, ang, fu, fv, mode, E, pus){
  const vy=[-ux[1],ux[0]], [u0,u1]=G.extent(poly,ux), [v0,v1]=G.extent(poly,vy);
  const W=E.vagaL, Cl=E.vagaC, nM=Math.max(1,Math.round(E.porModulo)), PIL=E.pilar;
  const th=ang*Math.PI/180, sn=Math.sin(th), cs=ang===90?0:Math.cos(th);
  const AI = ang===90? E.corredor : ang===60? 4.5 : 3.8, CX=Math.max(E.corredor,5.0);
  const pitch=W/sn, rd=Cl*sn+W*cs, mod=2*rd+AI, grpLen=nM*pitch+PIL;
  const L2W=(u,v)=>[ux[0]*u+vy[0]*v, ux[1]*u+vy[1]*v];
  let uL=-Infinity, uR=Infinity; for(let k=1;k<20;k++){ const s=lineSpan(poly,ux,vy,v0+(v1-v0)*k/20); if(s){ uL=Math.max(uL,s[0]); uR=Math.min(uR,s[1]) } }
  if(!(uR-uL>CX+2)){ uL=u0; uR=u1 }
  const crosses=[], addC=c=>{ const a=clamp(c-CX/2,uL,Math.max(uL,uR-CX)); if(!crosses.some(([x])=>Math.abs(x-a)<CX*0.9)) crosses.push([a,a+CX]) };
  if(mode==="ends"){ addC(uL+CX/2); addC(uR-CX/2) } else if(mode==="end0") addC(uL+CX/2); else if(mode==="end1") addC(uR-CX/2);
  else if(mode!=="none"){ pus.forEach(addC); if(mode==="portalFar" && pus.length){ const mu=pus.reduce((s,x)=>s+x,0)/pus.length; (mu-uL<uR-mu)? addC(uR-CX/2) : addC(uL+CX/2) } }
  if(!crosses.length && mode!=="none") addC(uL+CX/2);
  const OB=obList(obst), KP=obList(keep), blocked=pt=>obPip(OB,pt);
  const inCross=(a,b)=>crosses.some(([c0,c1])=>b>c0-0.01 && a<c1+0.01);
  const cand=[], pillars=[], aisles=[]; let row=0, aisle=0;
  for(let mv=v0+fv*mod-mod; mv<v1; mv+=mod){
    const av0=mv+rd, av1=av0+AI, ds = ang===90? 0 : (aisle%2? -1:1);
    aisles.push({i:aisle, vc:(av0+av1)/2, av0, av1, ds});
    [[-1,av0],[1,av1]].forEach(([s,e])=>{
      row++; const dsx = ang===90? 1 : ds;
      const a=[cs*dsx, s*sn], f=[-sn*dsx, s*cs];
      const out=L2W(-a[0],-a[1]);
      for(let g=u0+fu*grpLen-grpLen; g<u1+grpLen; g+=grpLen){
        for(let j=0;j<nM;j++){
          const uA = dsx>0? g+j*pitch+pitch : g+j*pitch;
          const A=[uA,e], B=[uA+W*f[0], e+W*f[1]], Cc=[B[0]+Cl*a[0], B[1]+Cl*a[1]], D=[uA+Cl*a[0], e+Cl*a[1]];
          const fu0=Math.min(A[0],B[0]), fu1=Math.max(A[0],B[0]);
          if(inCross(Math.min(fu0,D[0],Cc[0]), Math.max(fu1,D[0],Cc[0]))) continue;
          const vp=[A,B,Cc,D].map(q=>L2W(q[0],q[1]));
          if(!G.polyInPoly(vp,poly)) continue;
          if(obHit(OB,vp) || obHit(KP,vp)) continue;
          const c=L2W((A[0]+Cc[0])/2,(A[1]+Cc[1])/2), fm=L2W((A[0]+B[0])/2,(A[1]+B[1])/2);
          cand.push({poly:vp, c, fm, out, u:uA, uc:(fu0+fu1)/2, row, grp:Math.round((g-u0)/grpLen), aisle, tipo:"n"});
          if(j===0 && PIL>0){ const back=e+s*rd; const pu = dsx>0? g : g; pillars.push(G.rect(ux,vy,pu-PIL, s>0? back-PIL: back, PIL, PIL)) }
        }
      }
    });
    aisle++;
  }
  // pré-filtro barato: o corredor precisa tocar um corredor transversal
  const step=0.5, acc={};
  aisles.forEach(A=>{
    const free=u=>{ const pts=[[u,A.vc],[u,A.vc-AI*0.4],[u,A.vc+AI*0.4]].map(q=>L2W(q[0],q[1])); return pts.every(q=>G.pip(q,poly)) && !pts.some(blocked) };
    let start=null; const ints=[];
    for(let u=u0; u<=u1+step; u+=step){ const ok=u<=u1 && free(u); if(ok && start===null) start=u; if(!ok && start!==null){ ints.push([start,u-step]); start=null } }
    acc[A.i]= crosses.length? ints.filter(([a,b])=>crosses.some(([c0,c1])=>b>=c0 && a<=c1)) : ints.filter(([a,b])=>b-a>=E.vagaL);
  });
  const vagas=cand.filter(v=>(acc[v.aisle]||[]).some(([a,b])=>v.uc>=a-0.3 && v.uc<=b+0.3));
  const pil=pillars.filter(p=>G.polyInPoly(p,poly) && !obHit(OB,p));
  return {vagas, pillars:pil, aisles, acc, crosses, AI, pitch, ux, vy, ang, CX, L2W, uL, uR, mode};
}

/* ---------- malha de circulação: quem o carro alcança ---------- */
function rasterCheck(poly, blocks, vagas, pillars, portals, AI, opt={}){
  const res=GRES, xs=poly.map(q=>q[0]), ys=poly.map(q=>q[1]);
  const x0=Math.min(...xs), y0=Math.min(...ys), nx=Math.ceil((Math.max(...xs)-x0)/res)+1, ny=Math.ceil((Math.max(...ys)-y0)/res)+1, N=nx*ny;
  const free=new Uint8Array(N);
  for(let j=0;j<ny;j++) for(let i=0;i<nx;i++) free[j*nx+i]=G.pip([x0+i*res,y0+j*res],poly)?1:0;
  const fill=(p,val)=>{ if(!p||!p.length) return; const px=p.map(q=>q[0]), py=p.map(q=>q[1]);
    const i0=Math.max(0,Math.floor((Math.min(...px)-x0)/res)), i1=Math.min(nx-1,Math.ceil((Math.max(...px)-x0)/res)), j0=Math.max(0,Math.floor((Math.min(...py)-y0)/res)), j1=Math.min(ny-1,Math.ceil((Math.max(...py)-y0)/res));
    for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){ const c=j*nx+i; if(free[c] && G.pip([x0+i*res,y0+j*res],p)) free[c]=val } };
  blocks.forEach(p=>fill(p,0)); pillars.forEach(p=>fill(p,0));
  const base=free.slice(); // sem as vagas (para medir a manobra)
  vagas.forEach(v=>fill(v.poly,0));
  // distância até o obstáculo mais próximo (chanfrada 3-4)
  const dist=new Float32Array(N); for(let c=0;c<N;c++) dist[c]=free[c]? 1e9 : 0;
  const rel=(c,d)=>{ if(d<dist[c]) dist[c]=d };
  for(let j=0;j<ny;j++) for(let i=0;i<nx;i++){ const c=j*nx+i; if(!dist[c]) continue; if(i>0) rel(c,dist[c-1]+1); if(j>0){ rel(c,dist[c-nx]+1); if(i>0) rel(c,dist[c-nx-1]+1.414); if(i<nx-1) rel(c,dist[c-nx+1]+1.414) } }
  for(let j=ny-1;j>=0;j--) for(let i=nx-1;i>=0;i--){ const c=j*nx+i; if(!dist[c]) continue; if(i<nx-1) rel(c,dist[c+1]+1); if(j<ny-1){ rel(c,dist[c+nx]+1); if(i<nx-1) rel(c,dist[c+nx+1]+1.414); if(i>0) rel(c,dist[c+nx-1]+1.414) } }
  const rc=CAR_R/res, nav=c=>dist[c]>=rc;
  const cellOf=p=>{ const i=Math.round((p[0]-x0)/res), j=Math.round((p[1]-y0)/res); return (i<0||j<0||i>=nx||j>=ny)? -1 : j*nx+i };
  const snap=p=>{ let best=-1, bd=1e9; const i0=Math.round((p[0]-x0)/res), j0=Math.round((p[1]-y0)/res);
    for(let dj=-4;dj<=4;dj++) for(let di=-4;di<=4;di++){ const i=i0+di, j=j0+dj; if(i<0||j<0||i>=nx||j>=ny) continue; const c=j*nx+i; if(nav(c)){ const d=di*di+dj*dj; if(d<bd){ bd=d; best=c } } } return best };
  // alcance a partir do primeiro portal
  const reach=new Int32Array(N).fill(-1);
  const seeds=portals.map(pt=>snap(pt.p));
  const ok=seeds.length? seeds.every(s=>s>=0) : true;
  if(seeds.length && seeds[0]>=0){ const q=[seeds[0]]; reach[seeds[0]]=seeds[0];
    for(let h=0;h<q.length;h++){ const c=q[h], i=c%nx, j=(c-i)/nx;
      for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){ const ii=i+di, jj=j+dj; if(ii<0||jj<0||ii>=nx||jj>=ny) continue; const n=jj*nx+ii; if(reach[n]<0 && nav(n)){ reach[n]=c; q.push(n) } } } }
  const allConn = ok && seeds.every(s=>s>=0 && reach[s]>=0);
  // vagas: frente alcançável e área de manobra livre diante delas
  const need=Math.max(3.0, AI-0.4);
  const okV=vagas.filter(v=>{
    if(!seeds.length || v.presa) return true; // vaga presa: o acesso é pela vaga da frente (conferida à parte)
    const a=[v.fm[0]+v.out[0]*1.3, v.fm[1]+v.out[1]*1.3], ca=snap(a); if(ca<0 || reach[ca]<0) return false;
    const need_=v.need ?? need;
    for(let t=0.4;t<=need_;t+=0.5){ const c=cellOf([v.fm[0]+v.out[0]*t, v.fm[1]+v.out[1]*t]); if(c<0 || !free[c]) return false }
    return true });
  const out={okV, allConn, seeds, grid:{x0,y0,res,nx,ny}, reach, dist, free, snap, cellOf};
  return out;
}
/* reparo: abre passagens (tirando o mínimo de vagas) até a rampa e os trechos de corredor que ficaram isolados */
function repair(poly, blocks, L, portals, maxIt=8){
  let vagas=L.vagas.slice(), R=rasterCheck(poly, blocks, vagas, L.pillars, portals, L.AI); const corr=[], CX=Math.max(L.CX||5.5,5.0);
  const BL=obList(blocks), isBlock=p=>obPip(BL,p) || !G.pip(p,poly);
  const reachedAt=p=>{ const c=R.cellOf(p); return c>=0 && R.reach[c]>=0 && R.dist[c]>=CAR_R/GRES };
  for(let it=0; it<maxIt; it++){
    const okSet=new Set(R.okV), unre=vagas.filter(v=>!okSet.has(v) && (()=>{ const a=[v.fm[0]+v.out[0]*1.3, v.fm[1]+v.out[1]*1.3], c=R.snap(a); return c<0 || R.reach[c]<0 })());
    const pmiss=R.seeds.map((s,i)=>({s,i})).filter(o=>o.i>0 && (o.s<0 || R.reach[o.s]<0));
    if(!unre.length && !pmiss.length && R.allConn) break;
    if(R.seeds[0]<0) break;
    const tries=[];
    const corridor=(s0,d,gain)=>{ for(let t=0.5;t<=40;t+=0.5){ const q=[s0[0]+d[0]*t, s0[1]+d[1]*t]; if(isBlock(q)) return; if(t>2 && reachedAt(q)){ const rc=G.rect([-d[1],d[0]],d,G.dot(s0,[-d[1],d[0]])-CX/2,G.dot(s0,d)-0.5,CX,t+1); const cost=vagas.filter(v=>G.polysOverlap(v.poly,rc)).length; tries.push({rc, cost, gain}); return } } };
    pmiss.forEach(o=>{ const pt=portals[o.i]; [pt.heading,[-pt.heading[0],-pt.heading[1]],[-pt.heading[1],pt.heading[0]],[pt.heading[1],-pt.heading[0]]].forEach(d=>corridor(pt.p,d,1000)) });
    // trechos de corredor isolados: agrupa por corredor e tenta subir/descer até a circulação alcançada
    const grp={}; unre.forEach(v=>{ (grp[v.aisle]=grp[v.aisle]||[]).push(v) });
    Object.values(grp).forEach(list=>{ const n=list.length, ks=[0, Math.floor(n/2), n-1].filter((x,i,a)=>a.indexOf(x)===i);
      ks.forEach(k=>{ const v=list[k], a=[v.fm[0]+v.out[0]*(L.AI/2), v.fm[1]+v.out[1]*(L.AI/2)]; [L.vy,[-L.vy[0],-L.vy[1]],L.ux,[-L.ux[0],-L.ux[1]]].forEach(d=>corridor(a,d,n)) }) });
    tries.forEach(t=>t.score=t.gain-t.cost); tries.sort((a,b)=>b.score-a.score);
    const b=tries[0]; if(!b || b.score<=0) break;
    vagas=vagas.filter(v=>!G.polysOverlap(v.poly,b.rc)); corr.push(b.rc);
    R=rasterCheck(poly, blocks, vagas, L.pillars, portals, L.AI);
  }
  return {vagas, R, corr};
}
/* preenchimento: vagas a 90° nas sobras, sempre de frente para a circulação e sem cortar corredores */
/* marcações da malha para os preenchimentos: células ocupadas por vagas e reservadas (frentes de manobra, corredores, transversais, rotas) */
function gridMarks(poly, keep, L, R, E, need){
  const {x0,y0,res,nx,ny}=R.grid, N=nx*ny, W=E.vagaL;
  const occ=new Uint8Array(N), resv=new Uint8Array(N);
  const cell=(x,y)=>{ const i=Math.round((x-x0)/res), j=Math.round((y-y0)/res); return (i<0||j<0||i>=nx||j>=ny)? -1 : j*nx+i };
  const each=(p,fn)=>{ const px=p.map(q=>q[0]), py=p.map(q=>q[1]); const i0=Math.max(0,Math.floor((Math.min(...px)-x0)/res)), i1=Math.min(nx-1,Math.ceil((Math.max(...px)-x0)/res)), j0=Math.max(0,Math.floor((Math.min(...py)-y0)/res)), j1=Math.min(ny-1,Math.ceil((Math.max(...py)-y0)/res));
    for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){ if(G.pip([x0+i*res,y0+j*res],p)) fn(j*nx+i) } };
  L.vagas.forEach(v=>{ each(v.poly,c=>occ[c]=1); if(!v.presa) each(frontRect(v.fm,v.out,v.W||W,v.need??need),c=>resv[c]=1) });
  keep.forEach(k=>each(k,c=>resv[c]=1)); (L.corr||[]).forEach(k=>each(k,c=>resv[c]=1));
  // corredores e transversais do layout escolhido
  L.aisles.forEach(A=>(L.acc[A.i]||[]).forEach(([a,b])=>each(G.rect(L.ux,L.vy,a,A.av0,b-a,A.av1-A.av0),c=>resv[c]=1)));
  L.crosses.forEach(([c0,c1])=>{ const [v0,v1]=G.extent(poly,L.vy); each(G.rect(L.ux,L.vy,c0,v0,c1-c0,v1-v0),c=>resv[c]=1) });
  // caminhos entre os portais e até o primeiro corredor
  const S=R.seeds; for(let i=1;i<S.length;i++){ const r=rota(R,S[0],S[i]); if(r) for(let k=0;k<r.length-1;k++){ const a=r[k], b=r[k+1], d=Math.hypot(b[0]-a[0],b[1]-a[1]); for(let t=0;t<=d;t+=0.5){ const p=[a[0]+(b[0]-a[0])*t/d, a[1]+(b[1]-a[1])*t/d]; for(let dj=-4;dj<=4;dj++) for(let di=-4;di<=4;di++){ const c=cell(p[0]+di*res,p[1]+dj*res); if(c>=0) resv[c]=1 } } } }
  return {occ, resv, cell, each};
}
function infill(poly, blocks, keep, L, R, E, portals){
  const W=E.vagaL, Cl=E.vagaC, need=Math.max(4.8, E.corredor-0.5);
  const {occ, resv, cell, each}=gridMarks(poly, keep, L, R, E, need);
  const dirs=[L.ux,[-L.ux[0],-L.ux[1]],L.vy,[-L.vy[0],-L.vy[1]]], add=[]; const BL=obList(blocks), KP=obList(keep);
  const [u0,u1]=G.extent(poly,L.ux), [v0,v1]=G.extent(poly,L.vy);
  const okCells=(p,fn)=>{ let ok=true; each(p,c=>{ if(ok && !fn(c)) ok=false }); return ok };
  for(let v=v0; v<=v1; v+=0.5) for(let u=u0; u<=u1; u+=0.5){
    const P=[L.ux[0]*u+L.vy[0]*v, L.ux[1]*u+L.vy[1]*v];
    for(const d of dirs){ // P = meio da frente da vaga; d = para onde a frente olha
      const n=[-d[1],d[0]], back=[P[0]-d[0]*Cl, P[1]-d[1]*Cl];
      const sp=[[P[0]+n[0]*W/2,P[1]+n[1]*W/2],[P[0]-n[0]*W/2,P[1]-n[1]*W/2],[back[0]-n[0]*W/2,back[1]-n[1]*W/2],[back[0]+n[0]*W/2,back[1]+n[1]*W/2]];
      if(!G.polyInPoly(sp,poly)) continue;
      if(!okCells(sp,c=>R.free[c] && !occ[c] && !resv[c])) continue;
      if(obHit(BL,sp) || obHit(KP,sp)) continue;
      const fr=frontRect(P,d,W,need); if(!okCells(fr,c=>R.free[c] && !occ[c])) continue;
      const a=cell(P[0]+d[0]*1.3, P[1]+d[1]*1.3); if(a<0 || R.reach[a]<0) continue;
      each(sp,c=>occ[c]=1); each(fr,c=>resv[c]=1);
      add.push({poly:sp, c:[(P[0]+back[0])/2,(P[1]+back[1])/2], fm:P, out:d, u:0, uc:0, row:-1, grp:-1, aisle:-1, tipo:"n", extra:true}); break }
  }
  if(!add.length) return null;
  const all=[...L.vagas, ...add], R2=rasterCheck(poly, blocks, all, L.pillars, portals, L.AI);
  if(!R2.allConn || R2.okV.length<L.vagas.length) return null;
  return {vagas:R2.okV, R:R2};
}
/* varredura das sobras para peças de outro tamanho (motos, módulos de bicicletário), de frente para a circulação */
function scanAdd(poly, blocks, keep, L, R, M, sp_){
  const {occ, resv, cell, each}=M, {W, Cl, need}=sp_, add=[];
  const dirs=[L.ux,[-L.ux[0],-L.ux[1]],L.vy,[-L.vy[0],-L.vy[1]]], BL=obList(blocks), KP=obList(keep);
  const [u0,u1]=G.extent(poly,L.ux), [v0,v1]=G.extent(poly,L.vy);
  const okCells=(p,fn)=>{ let ok=true; each(p,c=>{ if(ok && !fn(c)) ok=false }); return ok };
  for(let v=v0; v<=v1; v+=0.5) for(let u=u0; u<=u1; u+=0.5){
    const P=[L.ux[0]*u+L.vy[0]*v, L.ux[1]*u+L.vy[1]*v];
    for(const d of dirs){
      const n=[-d[1],d[0]], back=[P[0]-d[0]*Cl, P[1]-d[1]*Cl];
      const sp=[[P[0]+n[0]*W/2,P[1]+n[1]*W/2],[P[0]-n[0]*W/2,P[1]-n[1]*W/2],[back[0]-n[0]*W/2,back[1]-n[1]*W/2],[back[0]+n[0]*W/2,back[1]+n[1]*W/2]];
      if(!G.polyInPoly(sp,poly)) continue;
      if(!okCells(sp,c=>R.free[c] && !occ[c] && !resv[c])) continue;
      if(obHit(BL,sp) || obHit(KP,sp)) continue;
      const fr=frontRect(P,d,W,need); if(!okCells(fr,c=>R.free[c] && !occ[c])) continue;
      const a=cell(P[0]+d[0]*1.3, P[1]+d[1]*1.3); if(a<0 || R.reach[a]<0) continue;
      each(sp,c=>occ[c]=1); each(fr,c=>resv[c]=1);
      add.push({poly:sp, c:[(P[0]+back[0])/2,(P[1]+back[1])/2], fm:P, out:d, u:0, uc:0, row:-1, grp:-1, aisle:-1, extra:true, W, need, ...sp_.attr});
      if(add.length>=sp_.max) return add;
      break }
  }
  return add;
}
/* vagas presas: uma segunda vaga atrás de uma vaga comum, na sobra junto à parede (par em tandem, mesma unidade) */
function tandemFind(poly, blocks, keep, L, R, M, E){
  const {occ, resv, each}=M, Cl=E.vagaC, out=[], extra=[]; let par=0; const BL=obList(blocks), KP=obList(keep);
  const okCells=(p,fn)=>{ let ok=true; each(p,c=>{ if(ok && !fn(c)) ok=false }); return ok };
  L.vagas.forEach(v=>{
    if(v.tipo!=="n" || v.presa || v.tandem || v.need!=null || v.poly.length!==4){ out.push(v); return }
    const [A,B,Cc,D]=v.poly, dl=Math.hypot(D[0]-A[0],D[1]-A[1])||1, a=[(D[0]-A[0])/dl,(D[1]-A[1])/dl], wl=Math.hypot(B[0]-A[0],B[1]-A[1])||1, f=[(B[0]-A[0])/wl,(B[1]-A[1])/wl];
    const np=[D, Cc, [Cc[0]+a[0]*Cl, Cc[1]+a[1]*Cl], [D[0]+a[0]*Cl, D[1]+a[1]*Cl]];
    const e=0.2, ins=[[D[0]+a[0]*e+f[0]*e, D[1]+a[1]*e+f[1]*e],[Cc[0]+a[0]*e-f[0]*e, Cc[1]+a[1]*e-f[1]*e],[Cc[0]+a[0]*(Cl-e)-f[0]*e, Cc[1]+a[1]*(Cl-e)-f[1]*e],[D[0]+a[0]*(Cl-e)+f[0]*e, D[1]+a[1]*(Cl-e)+f[1]*e]];
    if(!G.polyInPoly(np,poly) || !okCells(ins,c=>R.free[c] && !occ[c] && !resv[c]) || obHit(BL,ins) || obHit(KP,ins)){ out.push(v); return }
    each(ins,c=>occ[c]=1); par++;
    out.push({...v, tandem:true, par});
    extra.push({poly:np, c:G.centroid(np), fm:[(D[0]+Cc[0])/2,(D[1]+Cc[1])/2], out:[-a[0],-a[1]], u:0, uc:0, row:-1, grp:-1, aisle:-1, tipo:"presa", presa:true, par, extra:true});
  });
  return extra.length? [...out, ...extra] : null;
}
/* presas, bicicletário e motos nas sobras — cada etapa só fica se nenhuma vaga de carro perder o acesso */
function extras(poly, blocks, keep, L, R, E, portals, o){
  let cur={...L}, curR=R; const need=Math.max(4.8, E.corredor-0.5);
  const cars=vs=>vs.filter(v=>v.tipo!=="moto" && v.tipo!=="bici" && !v.presa).length;
  const tryAdd=vagas=>{ const R2=rasterCheck(poly, blocks, vagas, L.pillars, portals, L.AI); if(!R2.allConn) return false;
    const ok=new Set(R2.okV), pars=new Set(R2.okV.filter(v=>v.tandem).map(v=>v.par));
    let kv=vagas.filter(v=>ok.has(v) && (!v.presa || pars.has(v.par)));
    if(cars(kv) < cars(cur.vagas)) return false;
    const pp=new Set(kv.filter(v=>v.presa).map(v=>v.par)); kv=kv.map(v=>v.tandem && !pp.has(v.par)? {...v, tandem:false} : v);
    cur={...cur, vagas:kv}; curR=R2; return true };
  if(o.presas){ const add=tandemFind(poly, blocks, keep, cur, curR, gridMarks(poly, keep, cur, curR, E, need), E); if(add) tryAdd(add) }
  if(o.bici>0){ const add=scanAdd(poly, blocks, keep, cur, curR, gridMarks(poly, keep, cur, curR, E, need), {W:BICI[0], Cl:BICI[1], need:1.5, max:Math.ceil(o.bici/BICI[2]), attr:{tipo:"bici", bikes:BICI[2]}}); if(add.length) tryAdd([...cur.vagas, ...add]) }
  if(o.motos){ const add=scanAdd(poly, blocks, keep, cur, curR, gridMarks(poly, keep, cur, curR, E, need), {W:MOTO[0], Cl:MOTO[1], need:2.0, max:400, attr:{tipo:"moto"}}); if(add.length) tryAdd([...cur.vagas, ...add]) }
  return cur.vagas===L.vagas? null : {vagas:cur.vagas, R:curR};
}
function frontRect(fm,out,W,need){ const n=[-out[1],out[0]], f=[fm[0]+out[0]*need, fm[1]+out[1]*need]; return [[fm[0]+n[0]*W/2,fm[1]+n[1]*W/2],[fm[0]-n[0]*W/2,fm[1]-n[1]*W/2],[f[0]-n[0]*W/2,f[1]-n[1]*W/2],[f[0]+n[0]*W/2,f[1]+n[1]*W/2]] }
/* rota mais curta (preferindo o meio dos corredores) entre dois portais */
function rota(R, from, to){
  const {nx,ny,x0,y0,res}=R.grid, N=nx*ny, rc=CAR_R/res; if(from<0||to<0) return null;
  const cost=new Float64Array(N).fill(1e9), prev=new Int32Array(N).fill(-1), heap=[];
  const push=(c,d)=>{ heap.push([d,c]); let i=heap.length-1; while(i>0){ const p=(i-1)>>1; if(heap[p][0]<=heap[i][0]) break; [heap[p],heap[i]]=[heap[i],heap[p]]; i=p } };
  const pop=()=>{ const t=heap[0], l=heap.pop(); if(heap.length){ heap[0]=l; let i=0; for(;;){ const a=2*i+1,b=a+1; let s=i; if(a<heap.length&&heap[a][0]<heap[s][0]) s=a; if(b<heap.length&&heap[b][0]<heap[s][0]) s=b; if(s===i) break; [heap[s],heap[i]]=[heap[i],heap[s]]; i=s } } return t };
  cost[from]=0; push(from,0);
  while(heap.length){ const [d,c]=pop(); if(d>cost[c]) continue; if(c===to) break; const i=c%nx, j=(c-i)/nx;
    for(const [di,dj,l] of [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]]){ const ii=i+di, jj=j+dj; if(ii<0||jj<0||ii>=nx||jj>=ny) continue; const n=jj*nx+ii; const dd=R.dist[n]; if(dd<rc) continue;
      const nd=d+l*(1+2.5/Math.max(1,dd-rc+1)); if(nd<cost[n]){ cost[n]=nd; prev[n]=c; push(n,nd) } } }
  if(prev[to]<0 && from!==to) return null;
  const pts=[]; for(let c=to; c>=0; c=c===from?-1:prev[c]){ const i=c%nx, j=(c-i)/nx; pts.push([x0+i*res,y0+j*res]); if(c===from) break }
  return simplify(pts.reverse(), 0.7);
}
function simplify(p, eps){ if(p.length<3) return p; const d=(q,a,b)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], L=Math.hypot(dx,dy)||1e-9; return Math.abs((q[0]-a[0])*dy-(q[1]-a[1])*dx)/L };
  let mx=0, k=0; for(let i=1;i<p.length-1;i++){ const v=d(p[i],p[0],p[p.length-1]); if(v>mx){ mx=v; k=i } }
  return mx>eps? [...simplify(p.slice(0,k+1),eps).slice(0,-1), ...simplify(p.slice(k),eps)] : [p[0],p[p.length-1]] }

/* ---------- solver de um pavimento ---------- */
function garageSolve(poly, obst, E, o){
  const portals=o.portals||[], blocks=[...obst, ...(o.blocks||[])], keep=o.keep||[];
  let dirs=[];
  if(E.garDir!=="auto"){ const a=(+E.garDirGraus||0)*Math.PI/180; dirs=[[Math.cos(a),Math.sin(a)]] }
  else { const add=d=>{ const nrm=((Math.atan2(d[1],d[0])%Math.PI)+Math.PI)%Math.PI; if(!dirs.some(x=>{ const a=((Math.atan2(x[1],x[0])%Math.PI)+Math.PI)%Math.PI; return Math.abs(a-nrm)<0.05||Math.abs(Math.abs(a-nrm)-Math.PI)<0.05 })) dirs.push([Math.cos(nrm),Math.sin(nrm)]) };
    portals.forEach(pt=>{ add(pt.heading); add([-pt.heading[1],pt.heading[0]]) });
    for(let i=0;i<poly.length;i++){ const a=poly[i], b=poly[(i+1)%poly.length], L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<4) continue; const d=[(b[0]-a[0])/L,(b[1]-a[1])/L]; add(d); add([-d[1],d[0]]) } }
  const angs = E.angulo==="melhor"? [90,60,45] : [+E.angulo||90];
  const cands=[];
  dirs.slice(0, o.quick? 4 : 6).forEach(ux=>{
    const pus=portals.map(pt=>G.dot(pt.p,ux));
    angs.forEach(ang=>{
      const fvs = o.quick? [0,0.25,0.5,0.75] : [0,0.125,0.25,0.375,0.5,0.625,0.75,0.875];
      const fus = o.quick? [0,0.5] : [0,0.5];
      const modes = portals.length? ["none","portal","portalFar","ends","end0","end1"] : ["none","ends","end0","end1"];
      fvs.forEach(fv=>fus.forEach(fu=>modes.forEach(mode=>{ const L=genLayout(poly, blocks, keep, ux, ang, fu, fv, mode, E, pus); if(L.vagas.length) cands.push(L) })));
    });
  });
  cands.sort((a,b)=>b.vagas.length-a.vagas.length);
  let best=null, bestR=null;
  const K=o.quick? 4 : 10;
  // os melhores de cada modo seguem para a verificação na malha (com reparo das passagens)
  const pick=[], seen=new Set(); cands.forEach(L=>{ const key=L.mode; if((seen.has(key)? pick.filter(x=>x.mode===key).length<(o.quick?1:3) : true)){ seen.add(key); pick.push(L) } });
  pick.sort((a,b)=>b.vagas.length-a.vagas.length);
  for(const L of pick.slice(0, K)){ if(best && L.vagas.length<=best.vagas.length) continue;
    const F=repair(poly, blocks, L, portals, o.quick?4:8); let R=F.R;
    if(!R.allConn) continue;
    let ok=R.okV; if(ok.length<F.vagas.length && !o.quick){ R=rasterCheck(poly, blocks, ok, L.pillars, portals, L.AI); ok=R.okV }
    if(!best || ok.length>best.vagas.length){ best={...L, vagas:ok, corr:F.corr}; bestR=R } }
  if(best && !o.quick){ const F=infill(poly, blocks, keep, best, bestR, E, portals); if(F){ best={...best, vagas:F.vagas}; bestR=F.R } }
  if(best && !o.quick && (o.presas || o.motos || o.bici>0)){ const F=extras(poly, blocks, keep, best, bestR, E, portals, o); if(F){ best={...best, vagas:F.vagas}; bestR=F.R } }
  if(best){ const near=p=>{ const c=G.centroid(p); return best.vagas.some(v=>v.poly.some(q=>Math.hypot(q[0]-c[0],q[1]-c[1])<1.2)) }; best.pillars=best.pillars.filter(near);
    const R2=rasterCheck(poly, blocks, best.vagas, best.pillars, portals, best.AI); if(R2.allConn){ bestR=R2; const ok=new Set(R2.okV); best.vagas=best.vagas.filter(v=>ok.has(v)) } }
  if(!best){ // nenhum layout liga os portais: devolve o pavimento vazio com o diagnóstico
    const R=rasterCheck(poly, blocks, [], [], portals, 5);
    return {vagas:[], pillars:[], aisles:[], path:[], routes:[], ok:false, conn:R.allConn, grid:R.grid, reach:R.reach, landings:o.keep||[], count:0} }
  // PCD e idosos perto do núcleo
  const ref = obst.length? G.centroid(obst[0]) : G.centroid(poly);
  const n=best.vagas.filter(v=>v.tipo==="n").length, nP=n&&E.pcd>0? Math.max(1,Math.round(n*E.pcd)):0, nI=n&&E.idoso>0? Math.max(1,Math.round(n*E.idoso)):0;
  const order=best.vagas.map((v,i)=>({i,d:Math.hypot(v.c[0]-ref[0],v.c[1]-ref[1])})).sort((a,b)=>a.d-b.d);
  let p=0, id=0; best.vagas=best.vagas.map(v=>({...v}));
  for(const {i} of order){ const v=best.vagas[i]; if(v.tipo!=="n" || v.tandem) continue;
    if(p<nP){ const nb=best.vagas.find(x=>x.row===v.row && x.tipo==="n" && !x.tandem && Math.abs(x.u-(v.u+best.pitch))<0.01 && x.grp===v.grp); if(nb){ v.tipo="pcd"; nb.tipo="faixa"; p++; continue } }
    else if(id<nI){ v.tipo="idoso"; id++ }
    if(p>=nP && id>=nI) break }
  // sentido de circulação nos corredores usados
  const path=[], used={};
  best.vagas.forEach(v=>{ const k=v.aisle; if(!used[k]) used[k]=[Infinity,-Infinity]; used[k][0]=Math.min(used[k][0],v.uc-best.pitch/2); used[k][1]=Math.max(used[k][1],v.uc+best.pitch/2) });
  best.aisles.forEach(A=>{ const u=used[A.i]; if(!u) return; (best.acc[A.i]||[]).forEach(([a,b])=>{ const lo=Math.max(a,u[0]-1), hi=Math.min(b,u[1]+1); const cs=best.crosses.filter(([c0,c1])=>c1>=a&&c0<=b);
    const l2=Math.min(lo, ...cs.map(c=>(c[0]+c[1])/2)), h2=Math.max(hi, ...cs.map(c=>(c[0]+c[1])/2)); if(h2-l2>1) path.push({pts:[best.L2W(Math.max(a,l2),A.vc),best.L2W(Math.min(b,h2),A.vc)], dir:A.ds}) }) });
  // rotas entre portais (entrada → saídas)
  const routes=[]; const S=bestR.seeds; for(let i=1;i<S.length;i++){ const r=rota(bestR,S[0],S[i]); if(r) routes.push({pts:r, de:portals[0].label, para:portals[i].label}) }
  // rotas de entrada até cada portal (pontos de chegada → corredor)
  return {vagas:best.vagas, pillars:best.pillars, path, routes, ux:best.ux, vy:best.vy, ang:best.ang, pitch:best.pitch, aisle:best.AI, ok:true,
    grid:bestR.grid, reach:bestR.reach, count:best.vagas.length};
}
/* layout com cache + marcações manuais */
function garageLayout(poly, obst, E, key, o){
  const r2=q=>[+q[0].toFixed(2),+q[1].toFixed(2)];
  const sig=JSON.stringify([poly.map(r2), obst.map(c=>c.map(r2)), (o.blocks||[]).map(c=>c.map(r2)), (o.portals||[]).map(p=>[r2(p.p),p.heading.map(v=>+v.toFixed(3))]), (o.keep||[]).map(k=>k.map(r2)), E.vagaL,E.vagaC,E.corredor,E.porModulo,E.pilar,E.pcd,E.idoso,E.angulo,E.garDir,E.garDirGraus,!!o.quick, !!o.presas, !!o.motos, o.bici||0]);
  let base=_garCache.get(sig);
  if(!base){ base=garageSolve(poly,obst,E,o); if(_garCache.size>80) _garCache.clear(); _garCache.set(sig,base) }
  const off=E.off||{}, ov=E.vtipo||{}; let count=0;
  const vagas=base.vagas.map((v,i)=>{ const k=key+":"+i; const tipo = ov[k] || (off[k] ? "off" : v.tipo); if(garCar(tipo)) count++; return {...v, key:k, tipo, auto:v.tipo} });
  return {...base, vagas, count, key, ramps:o.ramps||[], landings:o.keep||[], portals:o.portals||[], blocks:o.blocks||[]};
}
const garCar = t => t!=="off" && t!=="faixa" && t!=="moto" && t!=="bici"; // conta como vaga de carro
/* todos os pavimentos de garagem */
function garagens(st, m, opt){
  const E=st.estudo, P=st.produto, V=m.vert, out={}, q=!!opt.quick, GX=garX(st);
  const ext = q? {} : {presas:!!GX.presas, motos:!!GX.motos}, bReq = q? {n:0} : biciReq(st, m); let bici=bReq.n;
  const jobs=[]; // [chave, nível, solver(bicicletas que faltam)]
  Object.values(V.floors).forEach(f=>{
    if(f.key==="ter") return;
    if(!f.poly.length) return;
    jobs.push([f.key, f.k, b=>garageLayout(f.poly, m.obst, E, f.key, {portals:f.portals, blocks:f.blocks, keep:f.landings, ramps:f.ramps, quick:q, ...ext, bici:b})]);
  });
  // térreo: garagem nos fundos, entrada pela faixa ao lado das rampas
  const T=m.ter;
  if(T.gar && T.gar.length){
    const fT=V.floors.ter||{blocks:[],landings:[],portals:[],ramps:[]};
    const portals=[]; if(T.driveEnd) portals.push({p:T.driveEnd, heading:T.fd, tipo:"chega", label:"entrada de veículos"});
    const blocks=[...fT.blocks.filter(b=>G.polysOverlap(b,T.gar))];
    const keep=[...(T.keep||[])];
    // rampa colocada à mão dentro da garagem do térreo: a boca precisa estar ligada
    fT.portals.forEach(pt=>{ if(G.pip(pt.p,T.gar)) portals.push(pt) });
    jobs.push(["ter", 0, b=>garageLayout(T.gar, [...m.obst, ...T.colsGar], E, "ter", {portals, blocks, keep, ramps:fT.ramps.filter(r=>G.polysOverlap(r.poly,T.gar)), quick:q, ...ext, bici:b})]);
  }
  // do mais perto da rua para o mais fundo (o bicicletário e os limites de presas/motos vão sendo consumidos nessa ordem)
  const ord=jobs.slice().sort((a,b)=>Math.abs(a[1])-Math.abs(b[1]) || a[1]-b[1]);
  ord.forEach(([k,,fn])=>{ const l=fn(Math.max(0,bici)); out[k]=l; if(bici>0) bici-=l.vagas.reduce((s,v)=>s+(v.tipo==="bici"? v.bikes||0 : 0),0) });
  if(!q && (GX.presas || GX.motos)){
    const limP = GX.presasVinc==="manobrista"? Infinity : Math.floor((m.units||0)*Math.max(0,+GX.presasMax||0)), limM=Math.ceil((m.units||0)*Math.max(0,+GX.motosMax||0)); let nP=0, nM=0;
    ord.forEach(([k])=>{ const l=out[k]; if(!l) return; let cut=false;
      let vs=l.vagas.filter(v=>{ if(v.auto==="presa"){ if(nP<limP){ nP++; return true } cut=true; return false } if(v.auto==="moto"){ if(nM<limM){ nM++; return true } cut=true; return false } return true });
      if(cut){ const pp=new Set(vs.filter(v=>v.auto==="presa").map(v=>v.par)); vs=vs.map(v=>v.tandem && !pp.has(v.par)? {...v, tandem:false} : v);
        out[k]={...l, vagas:vs, count:vs.filter(v=>garCar(v.tipo)).length} } });
    m.presasLim=limP; m.motosLim=limM;
  }
  m.biciLay={req:bReq.n, ok:bReq.n-Math.max(0,bici)};
  const res={}; jobs.forEach(([k])=>res[k]=out[k]); // mesma ordem de antes (subsolos, garagens, térreo)
  return res;
}
function biciReq(st, m){ const GX=garX(st), md=GX.bici;
  const n = md==="un"? Math.ceil((m.units||0)*Math.max(0,+GX.biciPorUn||0)) : md==="area"? Math.ceil((m.constr||0)/Math.max(1,+GX.biciM2||100)) : 0;
  return {n, modo:md} }
/* elevador de carros: ciclo, capacidade na hora de pico e fila prevista */
const ecNum = GX => Math.max(1,Math.min(3,Math.round(+GX.ecN||1)));
const ecH = (P,k) => k<0? -k*P.peGar : P.peTerreo+(k-1)*P.peGar; // altura vencida desde o térreo
function ecFila(vagas, Hmed, GX, n){
  const v=Math.max(0.1,+GX.ecVel||0.5), tm=Math.max(5,+GX.ecManobra||40);
  const ciclo = 2*Hmed/v + 2*tm;           // s por viagem: vai carregado e volta, com manobra e portas nas duas pontas
  const cap = n*3600/ciclo, dem = vagas*Math.max(0,+GX.ecPico||0), rho = cap>0? dem/cap : Infinity;
  // fila (M/D/1): média = ρ²/2(1−ρ); 95% ≈ cauda exponencial com taxa 2(1−ρ)/ρ
  let filaMed=Infinity, fila95=Infinity;
  if(rho<1){ filaMed=rho*rho/(2*(1-rho)); fila95 = rho<=0.05? 0 : Math.max(0, Math.ceil(Math.log(rho/0.05)/(2*(1-rho)/rho))) }
  return {ciclo, cap, dem, rho, filaMed, fila95};
}
/* vagas de espera na entrada: o valor dado, ou (0 = automático) a fila prevista estimada pela área das garagens */
function ecEsperaN(st, m){
  const GX=garX(st), e=Math.round(+GX.ecEspera||0); if(e>0) return e;
  const P=st.produto, R=st.regras, ks=[]; for(let k=-P.subsolos;k<=P.garAcima;k++) if(k) ks.push(k);
  const est = ((P.subsolos? G.area(m.sub||[])*P.subsolos : 0) + (P.garAcima? G.area(m.emb||[])*P.garAcima : 0)) / Math.max(10,+R.m2Vaga||28);
  const f=ecFila(est, ks.reduce((s,k)=>s+ecH(P,k),0)/Math.max(1,ks.length), GX, ecNum(GX));
  return Math.max(1, Math.min(6, isFinite(f.fila95)? f.fila95 : 6));
}
function elevCarros(st, m){
  const P=st.produto, GX=garX(st), V=m.vert||{}, n=(V.elev&&V.elev.n)||ecNum(GX);
  let tot=0, hs=0;
  if(m.gar) Object.entries(m.gar).forEach(([key,l])=>{ if(!l || key==="ter") return; const k= key[0]==="s"? -(+key.slice(1)) : +key.slice(1); tot+=l.count; hs+=l.count*ecH(P,k) });
  else { const ks=[]; for(let k=-P.subsolos;k<=P.garAcima;k++) if(k) ks.push(k); tot=Math.max(0,m.vagas||0); hs=tot*(ks.reduce((s,k)=>s+ecH(P,k),0)/Math.max(1,ks.length)) }
  const Hmed = tot? hs/tot : P.peGar, f=ecFila(tot, Hmed, GX, n), espera=(V.elev&&V.elev.espera.length)||ecEsperaN(st, m);
  const avisos=[];
  if(f.rho>=1) avisos.push(`Elevador de carros: no pico chegam ${nf(f.dem,0)} carros/h e ${n>1?"os elevadores levam":"o elevador leva"} só ${nf(f.cap,0)}/h — acrescente um elevador ou use rampa.`);
  else if(f.fila95>espera) avisos.push(`Elevador de carros: fila prevista de ${f.fila95} carros no pico, acima das ${espera} vagas de espera — aumente a espera ou acrescente um elevador.`);
  return {n, vagas:tot, Hmed, ...f, espera, porta:V.elev&&V.elev.porta, ok:!avisos.length, avisos};
}
/* quadro elétrico do pavimento: junto ao núcleo mais próximo das vagas */
function quadroPos(m, l){
  const vs=l.vagas.length? l.vagas : [{c:[0,0]}], c0=[vs.reduce((s,v)=>s+v.c[0],0)/vs.length, vs.reduce((s,v)=>s+v.c[1],0)/vs.length];
  let best=null, bd=Infinity;
  (m.cores||[]).forEach(core=>{ for(let i=0;i<core.length;i++){ const a=core[i], b=core[(i+1)%core.length], dx=b[0]-a[0], dy=b[1]-a[1], L2=dx*dx+dy*dy||1, t=clamp(((c0[0]-a[0])*dx+(c0[1]-a[1])*dy)/L2,0,1), p=[a[0]+dx*t, a[1]+dy*t], d=Math.hypot(p[0]-c0[0],p[1]-c0[1]); if(d<bd){ bd=d; best={p, core} } } });
  if(!best) return c0;
  const cc=G.centroid(best.core), dx=best.p[0]-cc[0], dy=best.p[1]-cc[1], L=Math.hypot(dx,dy)||1;
  return [best.p[0]+dx/L*0.5, best.p[1]+dy/L*0.5];
}
/* recarga de carro elétrico: as vagas comuns mais perto do quadro de cada pavimento */
function evMarcar(m, ev){ let tot=0;
  Object.values(m.gar).forEach(l=>{ if(!l || !l.vagas.length) return; const cars=l.vagas.filter(v=>v.tipo==="n" && !v.presa); cars.forEach(v=>v.ev=false);
    const n=Math.min(cars.length, Math.round(l.count*ev)); if(!n) return; const qe=l.qe=quadroPos(m, l);
    cars.map(v=>({v, d:Math.hypot(v.c[0]-qe[0], v.c[1]-qe[1])})).sort((a,b)=>a.d-b.d).slice(0,n).forEach(o=>o.v.ev=true); tot+=n });
  return tot }
/* quadro de vagas por tipo (as categorias de carro somam o total) */
const GAR_QLAB=[["comum","Comuns"],["presa","Presas (tandem)"],["pcd","PCD"],["idoso","Idosos"],["ev","Com recarga (EV)"],["frente","Na frente (lojas)"]];
function garQuadro(m){
  const z=()=>({comum:0,presa:0,pcd:0,idoso:0,ev:0,moto:0,bici:0}), q={...z(), frente:(m.vf&&m.vf.count)||0, pav:{}};
  Object.entries(m.gar||{}).forEach(([k,l])=>{ if(!l) return; const p=z();
    l.vagas.forEach(v=>{ const t=v.tipo; if(t==="off"||t==="faixa") return; const c= t==="moto"||t==="bici"||t==="presa"||t==="pcd"||t==="idoso"? t : v.ev? "ev" : "comum"; p[c]+= c==="bici"? (v.bikes||BICI[2]) : 1 });
    q.pav[k]=p; Object.keys(p).forEach(c=>q[c]+=p[c]) });
  q.total=q.comum+q.presa+q.pcd+q.idoso+q.ev+q.frente; q.biciReq=(m.biciLay&&m.biciLay.req)||0;
  return q;
}
function garQuadroRows(m){ const q=m.quadroVagas; if(!q) return [];
  const r=GAR_QLAB.filter(([k])=>k==="comum"||q[k]>0).map(([k,l])=>[l, String(q[k])]); r.push(["Total de vagas de carro", String(q.total)]);
  if(q.moto) r.push(["Motos (1,0 × 2,2 m)", String(q.moto)]);
  if(q.bici||q.biciReq) r.push([q.biciReq? "Bicicletas (no layout / exigidas)" : "Bicicletas", q.biciReq? `${q.bici} / ${q.biciReq}` : String(q.bici)]);
  return r }
/* depois do compute: elevador de carros, recarga EV, quadro por tipo e custos publicados para a viabilidade */
function garPos(m, st, opt){
  const GX=garX(st), E=st.estudo; m.custosExtra=m.custosExtra||[]; m.avisos=m.avisos||[];
  m.elevCarros=null;
  if(E.rampaTipo==="elevador" && m.vert && m.vert.elev){ const ec=m.elevCarros=elevCarros(st, m); m.avisos.push(...ec.avisos);
    if(+GX.ecCusto>0) m.custosExtra.push({k:"garElevCarros", nome:`Elevador de carros (${ec.n})`, sistema:"elevadores", valor:ec.n*GX.ecCusto}) }
  const ev=clamp(+GX.ev||0,0,1); let nEV=0;
  if(m.gar){ if(ev>0) nEV=evMarcar(m, ev); m.quadroVagas=garQuadro(m) }
  else if(ev>0) nEV=Math.round((m.vagas||0)*ev);
  m.evN=nEV;
  if(nEV>0 && +GX.evCusto>0) m.custosExtra.push({k:"garEV", nome:`Pontos de recarga para carro elétrico (${nEV})`, sistema:"instalações", valor:nEV*GX.evCusto});
  if(m.gar && !opt.quick && m.biciLay && m.biciLay.req>m.biciLay.ok) m.avisos.push(`Bicicletário: ${m.biciLay.ok} de ${m.biciLay.req} bicicletas couberam nas sobras da garagem — preveja o restante (≈ ${nf((m.biciLay.req-m.biciLay.ok)*1.2,0)} m²) no térreo.`);
  if(GX.presas && GX.presasVinc==="manobrista" && m.quadroVagas && m.quadroVagas.presa>0) m.avisos.push("Vagas presas sem vínculo a uma mesma unidade: o condomínio precisa de manobrista.");
}
HOOK.compute.push(garPos);
/* estudo do acesso: posições do acesso de veículos × tipo de rampa */
function acessoCandidatos(st){
  const pos=[0.1,0.25,0.4,0.6,0.75,0.9], tipos=st.produto.subsolos>1||st.produto.garAcima>1? ["reta","alternada"] : ["reta"], out=[];
  pos.forEach(p=>tipos.forEach(t=>out.push({acessoVei:p, rampaTipo:t})));
  // elevador de carros como alternativa (lotes estreitos): na frente, no meio e no fim da testada
  if(st.produto.subsolos||st.produto.garAcima) [0.1,0.5,0.9].forEach(p=>out.push({acessoVei:p, rampaTipo:"elevador"}));
  if(!out.some(c=>Math.abs(c.acessoVei-st.lote.acessoVei)<0.02 && c.rampaTipo===st.estudo.rampaTipo)) out.unshift({acessoVei:st.lote.acessoVei, rampaTipo:st.estudo.rampaTipo, atual:true});
  return out;
}
function acessoAvalia(st, c, full){
  const s=clone(st); s.lote.acessoVei=c.acessoVei; s.estudo.rampaTipo=c.rampaTipo; s.estudo.rampa=null;
  const m=compute(s, full? {} : {quick:true});
  const ec=m.elevCarros;
  return {vagas:m.vagasLay||0, ok:m.vert.ok && Object.values(m.gar||{}).every(l=>!l||l.ok!==false) && (!ec || ec.ok), warn:m.vert.warn.length+(ec? ec.avisos.length : 0),
    ...(ec? {fila:ec.fila95, cap:Math.round(ec.cap)} : {})};
}
