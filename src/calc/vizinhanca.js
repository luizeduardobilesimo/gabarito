/* ================= 1.4 impacto de vizinhança: sol que o empreendimento tira dos vizinhos =================
   Para cada volume do entorno (S.entorno): pontos nas fachadas (a cada 2 m, alturas a cada 3 m) e na cobertura (a cada 3 m).
   No dia 21 de cada mês, raios a cada 15 min (mesmo traçado do item 1.1: uniSuns/uniShadeInt): um instante é "perdido"
   quando o ponto teria sol sem o empreendimento (fachada de frente para o sol e sem sombra do entorno) e fica na sombra
   do empreendimento. Mapa da diferença (horas perdidas) no chão em volta e nas coberturas, no dia escolhido.
   Desligado (S.vizinhanca.on = false) não calcula nada. */
extendDEF("vizinhanca", { on: false, mes: 6, mapa: true });

/* amostras de um vizinho: fachadas (com normal para fora) e cobertura */
function vizAmostras(e, dsF, dzF, dsR){
  let p=e.pts.map(q=>[+q[0],+q[1]]); if(G.sArea(p)<0) p=p.slice().reverse();
  const h=Math.max(0,+e.h||0), fac=[], roof=[];
  const zs=[]; if(h>0){ for(let z=Math.min(1.5,h/2); z<h-0.2; z+=dzF) zs.push(z); if(!zs.length) zs.push(h/2) }
  for(let i=0;i<p.length;i++){
    const a=p[i], b=p[(i+1)%p.length], dx=b[0]-a[0], dy=b[1]-a[1], len=Math.hypot(dx,dy); if(len<0.8) continue;
    const n=[dy/len,-dx/len], k=Math.max(1,Math.round(len/dsF)), ds=len/k; // anti-horário: normal para fora = (dy,−dx)
    for(let s=0;s<k;s++){ const t=(s+0.5)/k; fac.push({x:a[0]+dx*t+n[0]*0.05, y:a[1]+dy*t+n[1]*0.05, n, zs, w:ds}) }
  }
  if(h>0){ const [x0,y0,x1,y1]=uniBB(p);
    for(let y=y0+dsR/2; y<y1; y+=dsR) for(let x=x0+dsR/2; x<x1; x+=dsR) if(G.pip([x,y],p)) roof.push({x, y, z:h+0.05, w:dsR*dsR}) }
  return {pts:p, h, fac, roof, dzF};
}

/* caixa que contém a sombra do empreendimento em cada instante (descarta de cara os pontos fora dela) */
function vizSombraBB(suns, own){
  suns.forEach(s=>{ let a=1e300,b=1e300,c=-1e300,d=-1e300; own.forEach(q=>{ const L_=q.z1/Math.max(s.tan,1e-3), ox=-s.dx*L_, oy=-s.dy*L_;
    a=Math.min(a,q.bb[0],q.bb[0]+ox); b=Math.min(b,q.bb[1],q.bb[1]+oy); c=Math.max(c,q.bb[2],q.bb[2]+ox); d=Math.max(d,q.bb[3],q.bb[3]+oy) }); s.sbb=[a,b,c,d] });
  return suns;
}
const vizFora=(x,y,sb)=> x<sb[0]||x>sb[2]||y<sb[1]||y>sb[3];
let _vizCache=null;
/* cálculo completo; o.prisms permite testar com obstáculos montados à mão; o.dt = passo (h) */
function vizCalc(st, m, o={}){
  const PR=o.prisms||prisms(st,m), obst=uniObst(PR), own=obst.filter(q=>q.own), nbo=obst.filter(q=>!q.own);
  const ents=(st.entorno||[]).map((e,i)=>({e,i})).filter(x=>x.e&&x.e.pts&&x.e.pts.length>2&&(+x.e.h||0)>0);
  const V=st.vizinhanca||DEF.vizinhanca, mes=Math.max(1,Math.min(12,Math.round(+V.mes||6))), dt=o.dt||0.25, D=uniDias(st);
  const sig=JSON.stringify([+st.lote.lat||0, st.lote.norte||0, dt, obst.map(q=>[q.poly,q.z0,q.z1,q.own]), st.lote.pts, ents.map(x=>x.e.nome||"")]), msig=sig+"|"+mes;
  // cache em dois níveis: fachadas/coberturas (12 meses) e o mapa do dia escolhido
  if(!o.prisms && _vizCache && _vizCache.sig===sig){
    const c=_vizCache.res; if(o.mapa===false || (c.mapa && c.msig===msig)) return c;
    if(o.fast) return {...c, stale:true};
    const t1=uniNow(), mapa=vizMapa(st, m, obst, own, nbo, ents, mes, dt), r={...c, mapa, mes, msig, ms:uniNow()-t1};
    _vizCache={sig, res:r}; return r;
  }
  if(!o.prisms && o.fast && _vizCache) return {..._vizCache.res, stale:true};
  const t0=uniNow();
  const lo=new Float64Array(64), hi=new Float64Array(64), lo2=new Float64Array(64), hi2=new Float64Array(64);
  const meses=[]; for(let k=1;k<=12;k++) meses.push(vizSombraBB(uniSuns(st,k,21,dt), own));
  const viz=ents.map(({e,i})=>{
    const A=vizAmostras(e, 2, 3, 3), nz=A.fac.length? A.fac[0].zs.length : 0;
    // perda[mês] por ponto de fachada × altura e por ponto de cobertura; sem[mês] = horas de sol sem o empreendimento
    const fp=A.fac.flatMap(f=>f.zs.map(z=>({x:f.x, y:f.y, z, n:f.n, w:f.w*A.dzF, perda:new Float32Array(12), sem:new Float32Array(12)})));
    const rp=A.roof.map(r=>({...r, perda:new Float32Array(12), sem:new Float32Array(12)}));
    meses.forEach((suns,mi)=>suns.forEach(sun=>{
      A.fac.forEach((f,fi)=>{
        if(sun.dx*f.n[0]+sun.dy*f.n[1] <= 0.01) return;
        const kN=uniShadeInt(f.x,f.y,sun,nbo,lo,hi), kO=vizFora(f.x,f.y,sun.sbb)? 0 : uniShadeInt(f.x,f.y,sun,own,lo2,hi2);
        f.zs.forEach((z,zi)=>{ if(uniIn(z,lo,hi,kN)) return; const P=fp[fi*nz+zi]; P.sem[mi]+=dt; if(uniIn(z,lo2,hi2,kO)) P.perda[mi]+=dt });
      });
      rp.forEach(P=>{ const kO=vizFora(P.x,P.y,sun.sbb)? 0 : uniShadeInt(P.x,P.y,sun,own,lo2,hi2); const sO=uniIn(P.z,lo2,hi2,kO);
        const kN=uniShadeInt(P.x,P.y,sun,nbo,lo,hi); if(uniIn(P.z,lo,hi,kN)) return; P.sem[mi]+=dt; if(sO) P.perda[mi]+=dt });
    }));
    const wF=fp.reduce((s,p)=>s+p.w,0)||1, wR=rp.reduce((s,p)=>s+p.w,0)||1, inv=D.inverno-1;
    const medF=k=>fp.reduce((s,p)=>s+p.perda[k]*p.w,0)/wF, medR=k=>rp.reduce((s,p)=>s+p.perda[k]*p.w,0)/wR;
    return { i, nome:e.nome||("Vizinho "+(i+1)), h:A.h, pts:A.pts,
      perdaInv: medF(inv), perdaMax: fp.reduce((s,p)=>Math.max(s,p.perda[inv]),0),
      areaAfetada: fp.reduce((s,p)=>s+(p.perda[inv]>2? p.w:0),0), areaFach: wF,
      perdaCobInv: rp.length? medR(inv) : 0, areaCobAfetada: rp.reduce((s,p)=>s+(p.perda[inv]>2? p.w:0),0),
      solSemInv: fp.reduce((s,p)=>s+p.sem[inv]*p.w,0)/wF,
      perdaMes: Array.from({length:12},(_,k)=>medF(k)),
      amostras: fp, cobertura: rp };
  });
  const wT=viz.reduce((s,v)=>s+v.areaFach,0)||1;
  const mesesMed=Array.from({length:12},(_,k)=>viz.reduce((s,v)=>s+v.perdaMes[k]*v.areaFach,0)/wT);
  const mapa=o.mapa===false? null : vizMapa(st, m, obst, own, nbo, ents, mes, dt);
  const res={vizinhos:viz, meses:mesesMed, mapa, mes, msig, dt, inverno:D.inverno,
    perdaInv: viz.reduce((s,v)=>s+v.perdaInv*v.areaFach,0)/wT, areaAfetada: viz.reduce((s,v)=>s+v.areaAfetada,0), ms:uniNow()-t0};
  if(!o.prisms) _vizCache={sig, res};
  return res;
}
/* mapa de horas perdidas no dia escolhido: chão em volta (fora do lote) e coberturas do entorno */
function vizMapa(st, m, obst, own, nbo, ents, mes, dt){
  if(!own.length) return null;
  const Hm=Math.max(...own.map(q=>q.z1)), margin=Math.max(25, Math.min(90, Hm*1.1));
  const pts=[...st.lote.pts, ...ents.flatMap(x=>x.e.pts)], xs=pts.map(q=>+q[0]), ys=pts.map(q=>+q[1]);
  const x0=Math.min(...xs)-margin, y0=Math.min(...ys)-margin, x1=Math.max(...xs)+margin, y1=Math.max(...ys)+margin;
  const cs=Math.max(1, Math.max(x1-x0,y1-y0)/110), nx=Math.ceil((x1-x0)/cs), ny=Math.ceil((y1-y0)/cs), data=new Float32Array(nx*ny);
  const suns=uniSuns(st,mes,21,dt), lo=new Float64Array(64), hi=new Float64Array(64), L=st.lote.pts;
  const foot=ents.map(x=>({p:x.e.pts, h:+x.e.h, bb:uniBB(x.e.pts)}));
  // caixa que contém a sombra do empreendimento em cada instante (descarta de cara as células fora dela)
  vizSombraBB(suns, own);
  let mx=0;
  for(let j=0;j<ny;j++) for(let i=0;i<nx;i++){
    const x=x0+(i+0.5)*cs, y=y0+(j+0.5)*cs, c=j*nx+i;
    if(G.pip([x,y],L)){ data[c]=NaN; continue }
    let z=0.05; for(const f of foot){ if(x>=f.bb[0]&&x<=f.bb[2]&&y>=f.bb[1]&&y<=f.bb[3]&&G.pip([x,y],f.p)){ if(f.h+0.05>z) z=f.h+0.05 } }
    let lost=0;
    for(const sun of suns){
      if(vizFora(x,y,sun.sbb)) continue;
      const kO=uniShadeInt(x,y,sun,own,lo,hi); if(!uniIn(z,lo,hi,kO)) continue;
      const kN=uniShadeInt(x,y,sun,nbo,lo,hi); if(uniIn(z,lo,hi,kN)) continue;
      lost+=dt;
    }
    data[c]=lost; if(lost>mx) mx=lost;
  }
  return {x0, y0, cs, nx, ny, data, max:mx, mes};
}

/* gancho: só quando ligado; ao arrastar controles (opt.layouts === false) reaproveita o último resultado */
HOOK.compute.push((m, st, opt)=>{
  if(opt && opt.quick) return;
  if(!st.vizinhanca || !st.vizinhanca.on) return;
  m.viz = vizCalc(st, m, {fast: !!(opt && opt.layouts===false)});
});
