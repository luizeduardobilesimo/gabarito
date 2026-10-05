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
const rampLen=(h,E)=> h/Math.max(0.05,E.rampaInc) + 3.0; // + transições de 1,5 m em cada ponta
function stripPoly(lat,fd,lc,w,d0,d1){ return G.rect(lat,fd,lc-w/2,d0,w,d1-d0) }
/* arranjo lateral da entrada: faixas das rampas (descida D, subida U; B = segunda faixa das alternadas) e a faixa da garagem do térreo.
   Testa várias ordens e desloca o conjunto até caber nos pavimentos sem passar pelos núcleos. */
function driveLayout(st, lmn, lmx, vc, m, fd, lat, opt={}){
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
/* início e comprimento das faixas de rampa (modo automático) */
function rampExt(st, m, dir){
  const P=st.produto, E=st.estudo, alt=E.rampaTipo==="alternada", land=alt?6.5:PATAMAR;
  const LD=rampLen(P.peGar,E), LU=Math.max(rampLen(P.peTerreo,E), P.garAcima>1? rampLen(P.peGar,E):0);
  const lotFront=G.extent(st.lote.pts,dir)[0], subF=m.sub&&m.sub.length? G.extent(m.sub,dir)[0] : lotFront, embF=m.emb&&m.emb.length? G.extent(m.emb,dir)[0] : lotFront;
  let s0=Math.max(lotFront+PATAMAR, embF+0.3);
  if(P.subsolos>1) s0=Math.max(s0, subF+land+0.6);
  if(P.garAcima>1) s0=Math.max(s0, embF+land+0.6);
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
  stack("D", nS, lcDA, lcDB, LD, d0D);
  stack("U", nA, lcUA, lcUB, LU, d0U);
  // validações geométricas
  V.strips.forEach(s=>{ const fl = s.kind==="D"? m.sub : m.emb; if(fl.length && !G.polyInPoly(s.poly, fl)){ V.ok=false; V.warn.push(s.kind==="D"? "A rampa dos subsolos não cabe dentro do subsolo — encurte (inclinação maior) ou mova o acesso." : "A rampa das garagens elevadas não cabe no embasamento.") } });
  Object.values(V.floors).forEach(f=>{ f.portals.forEach(pt=>{ if(f.poly.length && !G.pip(pt.p,f.poly)){ V.ok=false; pt.fora=true; V.warn.push(`No ${nomePav(f.key)}, o patamar da rampa fica fora do pavimento.`) } }) });
  // compatibilidade: rampa de entrada
  const first=V.strips.find(s=>s.id==="DA")||V.strips.find(s=>s.id==="UA");
  if(first){ const seg=V.segs.find(g=>g.strip===first.id && g.r===1); V.entry={poly:first.poly, c:P2(first.lc,(first.d0+first.d1)/2), dir, len:first.L, w, top:seg.E, foot:seg.X} }
  V.drive=[...new Set([lcDA,lcUA].filter(v=>v!=null))];
  return V;
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
  const blocked=pt=>obst.some(ob=>G.pip(pt,ob));
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
          if(obst.some(ob=>G.polysOverlap(vp,ob)) || keep.some(k=>G.polysOverlap(vp,k))) continue;
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
  const pil=pillars.filter(p=>G.polyInPoly(p,poly) && !obst.some(o=>G.polysOverlap(p,o)));
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
    if(!seeds.length) return true;
    const a=[v.fm[0]+v.out[0]*1.3, v.fm[1]+v.out[1]*1.3], ca=snap(a); if(ca<0 || reach[ca]<0) return false;
    for(let t=0.4;t<=need;t+=0.5){ const c=cellOf([v.fm[0]+v.out[0]*t, v.fm[1]+v.out[1]*t]); if(c<0 || !free[c]) return false }
    return true });
  const out={okV, allConn, seeds, grid:{x0,y0,res,nx,ny}, reach, dist, free, snap, cellOf};
  return out;
}
/* reparo: abre passagens (tirando o mínimo de vagas) até a rampa e os trechos de corredor que ficaram isolados */
function repair(poly, blocks, L, portals, maxIt=8){
  let vagas=L.vagas.slice(), R=rasterCheck(poly, blocks, vagas, L.pillars, portals, L.AI); const corr=[], CX=Math.max(L.CX||5.5,5.0);
  const isBlock=p=>blocks.some(b=>G.pip(p,b)) || !G.pip(p,poly);
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
function infill(poly, blocks, keep, L, R, E, portals){
  const {x0,y0,res,nx,ny}=R.grid, N=nx*ny, W=E.vagaL, Cl=E.vagaC, need=Math.max(4.8, E.corredor-0.5);
  const occ=new Uint8Array(N), resv=new Uint8Array(N);
  const cell=(x,y)=>{ const i=Math.round((x-x0)/res), j=Math.round((y-y0)/res); return (i<0||j<0||i>=nx||j>=ny)? -1 : j*nx+i };
  const each=(p,fn)=>{ const px=p.map(q=>q[0]), py=p.map(q=>q[1]); const i0=Math.max(0,Math.floor((Math.min(...px)-x0)/res)), i1=Math.min(nx-1,Math.ceil((Math.max(...px)-x0)/res)), j0=Math.max(0,Math.floor((Math.min(...py)-y0)/res)), j1=Math.min(ny-1,Math.ceil((Math.max(...py)-y0)/res));
    for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){ if(G.pip([x0+i*res,y0+j*res],p)) fn(j*nx+i) } };
  L.vagas.forEach(v=>{ each(v.poly,c=>occ[c]=1); each(frontRect(v.fm,v.out,W,need),c=>resv[c]=1) });
  keep.forEach(k=>each(k,c=>resv[c]=1)); (L.corr||[]).forEach(k=>each(k,c=>resv[c]=1));
  // corredores e transversais do layout escolhido
  L.aisles.forEach(A=>(L.acc[A.i]||[]).forEach(([a,b])=>each(G.rect(L.ux,L.vy,a,A.av0,b-a,A.av1-A.av0),c=>resv[c]=1)));
  L.crosses.forEach(([c0,c1])=>{ const [v0,v1]=G.extent(poly,L.vy); each(G.rect(L.ux,L.vy,c0,v0,c1-c0,v1-v0),c=>resv[c]=1) });
  // caminhos entre os portais e até o primeiro corredor
  const S=R.seeds; for(let i=1;i<S.length;i++){ const r=rota(R,S[0],S[i]); if(r) for(let k=0;k<r.length-1;k++){ const a=r[k], b=r[k+1], d=Math.hypot(b[0]-a[0],b[1]-a[1]); for(let t=0;t<=d;t+=0.5){ const p=[a[0]+(b[0]-a[0])*t/d, a[1]+(b[1]-a[1])*t/d]; for(let dj=-4;dj<=4;dj++) for(let di=-4;di<=4;di++){ const c=cell(p[0]+di*res,p[1]+dj*res); if(c>=0) resv[c]=1 } } } }
  const dirs=[L.ux,[-L.ux[0],-L.ux[1]],L.vy,[-L.vy[0],-L.vy[1]]], add=[];
  const [u0,u1]=G.extent(poly,L.ux), [v0,v1]=G.extent(poly,L.vy);
  const okCells=(p,fn)=>{ let ok=true; each(p,c=>{ if(ok && !fn(c)) ok=false }); return ok };
  for(let v=v0; v<=v1; v+=0.5) for(let u=u0; u<=u1; u+=0.5){
    const P=[L.ux[0]*u+L.vy[0]*v, L.ux[1]*u+L.vy[1]*v];
    for(const d of dirs){ // P = meio da frente da vaga; d = para onde a frente olha
      const n=[-d[1],d[0]], back=[P[0]-d[0]*Cl, P[1]-d[1]*Cl];
      const sp=[[P[0]+n[0]*W/2,P[1]+n[1]*W/2],[P[0]-n[0]*W/2,P[1]-n[1]*W/2],[back[0]-n[0]*W/2,back[1]-n[1]*W/2],[back[0]+n[0]*W/2,back[1]+n[1]*W/2]];
      if(!G.polyInPoly(sp,poly)) continue;
      if(!okCells(sp,c=>R.free[c] && !occ[c] && !resv[c])) continue;
      if(blocks.some(b=>G.polysOverlap(sp,b)) || keep.some(k=>G.polysOverlap(sp,k))) continue;
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
  if(best){ const near=p=>{ const c=G.centroid(p); return best.vagas.some(v=>v.poly.some(q=>Math.hypot(q[0]-c[0],q[1]-c[1])<1.2)) }; best.pillars=best.pillars.filter(near);
    const R2=rasterCheck(poly, blocks, best.vagas, best.pillars, portals, best.AI); if(R2.allConn){ bestR=R2; const ok=new Set(R2.okV); best.vagas=best.vagas.filter(v=>ok.has(v)) } }
  if(!best){ // nenhum layout liga os portais: devolve o pavimento vazio com o diagnóstico
    const R=rasterCheck(poly, blocks, [], [], portals, 5);
    return {vagas:[], pillars:[], aisles:[], path:[], routes:[], ok:false, conn:R.allConn, grid:R.grid, reach:R.reach, landings:o.keep||[], count:0} }
  // PCD e idosos perto do núcleo
  const ref = obst.length? G.centroid(obst[0]) : G.centroid(poly);
  const n=best.vagas.length, nP=n&&E.pcd>0? Math.max(1,Math.round(n*E.pcd)):0, nI=n&&E.idoso>0? Math.max(1,Math.round(n*E.idoso)):0;
  const order=best.vagas.map((v,i)=>({i,d:Math.hypot(v.c[0]-ref[0],v.c[1]-ref[1])})).sort((a,b)=>a.d-b.d);
  let p=0, id=0; best.vagas=best.vagas.map(v=>({...v}));
  for(const {i} of order){ const v=best.vagas[i]; if(v.tipo!=="n") continue;
    if(p<nP){ const nb=best.vagas.find(x=>x.row===v.row && x.tipo==="n" && Math.abs(x.u-(v.u+best.pitch))<0.01 && x.grp===v.grp); if(nb){ v.tipo="pcd"; nb.tipo="faixa"; p++; continue } }
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
  const sig=JSON.stringify([poly.map(r2), obst.map(c=>c.map(r2)), (o.blocks||[]).map(c=>c.map(r2)), (o.portals||[]).map(p=>[r2(p.p),p.heading.map(v=>+v.toFixed(3))]), (o.keep||[]).map(k=>k.map(r2)), E.vagaL,E.vagaC,E.corredor,E.porModulo,E.pilar,E.pcd,E.idoso,E.angulo,E.garDir,E.garDirGraus,!!o.quick]);
  let base=_garCache.get(sig);
  if(!base){ base=garageSolve(poly,obst,E,o); if(_garCache.size>80) _garCache.clear(); _garCache.set(sig,base) }
  const off=E.off||{}, ov=E.vtipo||{}; let count=0;
  const vagas=base.vagas.map((v,i)=>{ const k=key+":"+i; const tipo = ov[k] || (off[k] ? "off" : v.tipo); if(tipo!=="off" && tipo!=="faixa") count++; return {...v, key:k, tipo, auto:v.tipo} });
  return {...base, vagas, count, key, ramps:o.ramps||[], landings:o.keep||[], portals:o.portals||[], blocks:o.blocks||[]};
}
/* todos os pavimentos de garagem */
function garagens(st, m, opt){
  const E=st.estudo, P=st.produto, V=m.vert, out={}, q=!!opt.quick;
  Object.values(V.floors).forEach(f=>{
    if(f.key==="ter") return;
    if(!f.poly.length) return;
    out[f.key]=garageLayout(f.poly, m.obst, E, f.key, {portals:f.portals, blocks:f.blocks, keep:f.landings, ramps:f.ramps, quick:q});
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
    out.ter=garageLayout(T.gar, [...m.obst, ...T.colsGar], E, "ter", {portals, blocks, keep, ramps:fT.ramps.filter(r=>G.polysOverlap(r.poly,T.gar)), quick:q});
  }
  return out;
}
/* estudo do acesso: posições do acesso de veículos × tipo de rampa */
function acessoCandidatos(st){
  const pos=[0.1,0.25,0.4,0.6,0.75,0.9], tipos=st.produto.subsolos>1||st.produto.garAcima>1? ["reta","alternada"] : ["reta"], out=[];
  pos.forEach(p=>tipos.forEach(t=>out.push({acessoVei:p, rampaTipo:t})));
  if(!out.some(c=>Math.abs(c.acessoVei-st.lote.acessoVei)<0.02 && c.rampaTipo===st.estudo.rampaTipo)) out.unshift({acessoVei:st.lote.acessoVei, rampaTipo:st.estudo.rampaTipo, atual:true});
  return out;
}
function acessoAvalia(st, c, full){
  const s=clone(st); s.lote.acessoVei=c.acessoVei; s.estudo.rampaTipo=c.rampaTipo; s.estudo.rampa=null;
  const m=compute(s, full? {} : {quick:true});
  return {vagas:m.vagasLay||0, ok:m.vert.ok && Object.values(m.gar||{}).every(l=>!l||l.ok!==false), warn:m.vert.warn.length};
}
