/* ================= geometria ================= */
const G = (() => {
  function sArea(p){ let a=0; for(let i=0;i<p.length;i++){ const [x1,y1]=p[i],[x2,y2]=p[(i+1)%p.length]; a+=x1*y2-x2*y1 } return a/2 }
  const area = p => p && p.length>2 ? Math.abs(sArea(p)) : 0;
  function centroid(p){
    if(!p||!p.length) return [0,0];
    let a=0,cx=0,cy=0;
    for(let i=0;i<p.length;i++){ const [x1,y1]=p[i],[x2,y2]=p[(i+1)%p.length]; const f=x1*y2-x2*y1; a+=f; cx+=(x1+x2)*f; cy+=(y1+y2)*f }
    if(Math.abs(a)<1e-9){ let sx=0,sy=0; p.forEach(q=>{sx+=q[0];sy+=q[1]}); return [sx/p.length,sy/p.length] }
    a/=2; return [cx/(6*a), cy/(6*a)];
  }
  function clipHalf(poly, o, n){ // mantém (q-o)·n >= 0
    const out=[]; const d=q=>(q[0]-o[0])*n[0]+(q[1]-o[1])*n[1];
    for(let i=0;i<poly.length;i++){
      const a=poly[i], b=poly[(i+1)%poly.length], da=d(a), db=d(b), ia=da>=-1e-9, ib=db>=-1e-9;
      if(ia) out.push(a);
      if(ia!==ib){ const t=da/(da-db); out.push([a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t]) }
    }
    return out.length>2 ? out : [];
  }
  function offsetPoly(p, dist){ // recuo por lado, lote anti-horário. Exato para lotes convexos.
    let out=p.slice();
    for(let i=0;i<p.length && out.length>2;i++){
      const a=p[i], b=p[(i+1)%p.length], dx=b[0]-a[0], dy=b[1]-a[1], L=Math.hypot(dx,dy); if(L<1e-6) continue;
      const n=[-dy/L, dx/L], d=dist(i); out=clipHalf(out,[a[0]+n[0]*d, a[1]+n[1]*d], n);
    }
    return out.length>2 ? out : [];
  }
  function scaleToArea(p, target){ const A=area(p); if(!p.length || A<=target || A<=0) return p; const k=Math.sqrt(Math.max(target,0)/A), c=centroid(p); return p.map(q=>[c[0]+(q[0]-c[0])*k, c[1]+(q[1]-c[1])*k]) }
  const edgeLen = (p,i)=>{ const a=p[i], b=p[(i+1)%p.length]; return Math.hypot(b[0]-a[0], b[1]-a[1]) };
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
  function longestDir(p){ let best=0,dir=[1,0]; for(let i=0;i<p.length;i++){ const a=p[i],b=p[(i+1)%p.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L>best){ best=L; dir=[(b[0]-a[0])/L,(b[1]-a[1])/L] } } return dir }
  function extent(p, dir){ let mn=Infinity,mx=-Infinity; p.forEach(q=>{ const t=dot(q,dir); if(t<mn)mn=t; if(t>mx)mx=t }); return [mn,mx] }
  function band(p, dir, t0, t1){ // pontos com t0 <= q·dir <= t1
    if(!p.length) return [];
    let r=clipHalf(p,[dir[0]*t0,dir[1]*t0],dir); if(!r.length) return [];
    return clipHalf(r,[dir[0]*t1,dir[1]*t1],[-dir[0],-dir[1]]);
  }
  function cutAt(p, dir, frac){ // posição t onde a parte com q·dir<=t tem 'frac' da área
    const [mn,mx]=extent(p,dir), A=area(p); let lo=mn, hi=mx;
    for(let i=0;i<50;i++){ const mid=(lo+hi)/2; (area(band(p,dir,mn,mid))<frac*A)? lo=mid : hi=mid }
    return (lo+hi)/2;
  }
  function pip(pt, p){ let c=false; for(let i=0,j=p.length-1;i<p.length;j=i++){ const [xi,yi]=p[i],[xj,yj]=p[j]; if(((yi>pt[1])!==(yj>pt[1])) && (pt[0] < (xj-xi)*(pt[1]-yi)/(yj-yi)+xi)) c=!c } return c }
  function polyInPoly(a, b){ return a.every(q=>pip(q,b)) }
  function segInter(p1,p2,p3,p4){ const d=(p2[0]-p1[0])*(p4[1]-p3[1])-(p2[1]-p1[1])*(p4[0]-p3[0]); if(Math.abs(d)<1e-12) return false; const t=((p3[0]-p1[0])*(p4[1]-p3[1])-(p3[1]-p1[1])*(p4[0]-p3[0]))/d, u=((p3[0]-p1[0])*(p2[1]-p1[1])-(p3[1]-p1[1])*(p2[0]-p1[0]))/d; return t>1e-9&&t<1-1e-9&&u>1e-9&&u<1-1e-9 }
  function polysOverlap(a,b){ // aproximado: vértice dentro ou arestas cruzando
    if(a.some(q=>pip(q,b))||b.some(q=>pip(q,a))) return true;
    for(let i=0;i<a.length;i++) for(let j=0;j<b.length;j++) if(segInter(a[i],a[(i+1)%a.length],b[j],b[(j+1)%b.length])) return true;
    return false;
  }
  // retângulo no referencial local (u ao longo de 'ux', v ao longo de 'vy')
  function rect(ux, vy, u0, v0, du, dv){ const P=(u,v)=>[ux[0]*u+vy[0]*v, ux[1]*u+vy[1]*v]; return [P(u0,v0),P(u0+du,v0),P(u0+du,v0+dv),P(u0,v0+dv)] }
  function clipToPoly(p, L){ // recorta p pelo polígono convexo L (anti-horário)
    let out=p.slice(); const ccw=sArea(L)>0;
    for(let i=0;i<L.length && out.length>2;i++){ const a=L[i], b=L[(i+1)%L.length], dx=b[0]-a[0], dy=b[1]-a[1], l=Math.hypot(dx,dy); if(l<1e-6) continue; const n= ccw? [-dy/l,dx/l] : [dy/l,-dx/l]; out=clipHalf(out,a,n) }
    return out.length>2? out : [];
  }
  function segPolyHit(p1,p2,poly){ if(pip(p1,poly)||pip(p2,poly)) return true; for(let i=0;i<poly.length;i++) if(segInter(p1,p2,poly[i],poly[(i+1)%poly.length])) return true; return false }
  function perimeter(p){ let s=0; for(let i=0;i<p.length;i++) s+=edgeLen(p,i); return s }
  return {sArea,area,centroid,clipHalf,offsetPoly,scaleToArea,edgeLen,dot,longestDir,extent,band,cutAt,pip,polyInPoly,polysOverlap,rect,perimeter,clipToPoly,segPolyHit,segInter};
})();
