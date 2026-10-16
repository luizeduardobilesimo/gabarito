/* ================= garagem por partidos: regras, catálogo, gerador e validação (docs/COMUNS.md §2) =================
   O mesmo método das plantas (docs/APTOS.md): regras de projeto reais + catálogo de partidos de mercado + validação com
   nota e motivo. Em vez de "preencher fileiras onde couber", o pavimento é projetado como um projetista faria:
   - módulo 5,0 + 5,5 + 5,0 m (fileira · corredor de mão dupla · fileira), fileiras encostadas nas paredes;
   - rede de corredores contínua: corredores paralelos (H) ligados por transversais (V) — anel, espinha, pente —,
     com conectores da rede aos portais das rampas e sem becos longos (bolsão de retorno quando inevitável);
   - pilares numa malha global (3 vagas entre pilares, 1 m para dentro da frente das vagas), alinhados nos dois lados
     do corredor; vaga encostada em parede/pilar com largura acrescida (S.garagem.acrParede/acrPilar — conferir na lei);
   - faixa de pedestres (1,20 m, zebrada) do hall dos elevadores até o corredor; PCD com faixa de transferência de
     1,20 m (de um lado ou compartilhada por duas) e idosos perto do hall;
   - raio de giro conferido nas junções (externo ~6,0 m, interno ~3,0 m) e rota desenhada com curvas.
   Tudo em coordenadas do referencial do pavimento (u ao longo dos corredores principais, v perpendicular), com
   intervalos 1D exatos (faixa × polígono) — rápido o bastante para testar centenas de partidos por pavimento.
   Nada aqui toca DOM: roda no Worker e nos testes. Entrada principal: garModSolve(poly, obst, E, o) (chamada pelo
   garageSolve de src/garagem.js); validação independente: garValida(lay, ctx). */

const GAR_PARTIDOS = {
  simples:   { nome:"Módulo simples",           d:"1 corredor de 5,5 m com fileiras dos dois lados (15,5 m)" },
  estreita:  { nome:"Garagem estreita",          d:"1 corredor com uma fileira (10,5 m)" },
  duplo:     { nome:"Módulo duplo",              d:"2 corredores paralelos, 4 fileiras, ligados numa ponta" },
  pente:     { nome:"Corredores em pente",       d:"3 ou mais corredores ligados por uma transversal" },
  anel:      { nome:"Anel com ilha central",     d:"corredores ligados nas duas pontas: circulação contínua, sem becos" },
  espinha:   { nome:"Espinha central",           d:"transversal no meio com corredores dos dois lados" },
  inclinado: { nome:"45°/60° em mão única",      d:"vagas inclinadas, corredores estreitos de mão única em anel" },
};
const GAR_META = [25, 32];          // m² de área bruta por vaga num subsolo retangular regular (referência de mercado)

/* parâmetros de projeto (valores de referência; conferir na lei) */
function garRegras(E, GX){
  GX = GX || (typeof DEF!=="undefined" && DEF.garagem) || {};
  const n=(v,d)=>{ v=+v; return isFinite(v)? v : d };
  return {
    W:n(E.vagaL,2.5), C:n(E.vagaC,5.0), AI90:Math.max(5.0,n(E.corredor,5.5)), AI60:4.5, AI45:3.8,
    nM:Math.max(1,Math.round(n(E.porModulo,3))), PIL:Math.max(0,n(E.pilar,0.4)),
    acrP:Math.max(0,n(GX.acrParede,0.25)), acrPil:Math.max(0,n(GX.acrPilar,0.10)),
    Ro:n(GX.raioExt,6.0), Ri:n(GX.raioInt,3.0), beco:n(GX.becoMax,25), ped:Math.max(0.9,n(GX.faixaPed,1.2)),
    pcdF:1.2, pcdModo:GX.pcdModo||"auto", inset:1.0, partido:GX.partido||"auto",
  };
}
/* curva possível? giro de 90° entre corredores de larguras w1 e w2 (externo Ro, interno Ri):
   o centro do giro fica a Ro das paredes de fora e o canto de dentro precisa caber no raio interno */
function garGiroOk(w1, w2, R){ const a=Math.max(0,R.Ro-w1), b=Math.max(0,R.Ro-w2); return a*a+b*b <= R.Ri*R.Ri+1e-9 }

/* ---------- intervalos 1D (faixa horizontal × polígono) ---------- */
function gmLineIv(P, v){ const xs=[]; for(let i=0,n=P.length;i<n;i++){ const a=P[i], b=P[(i+1)%n]; if((a[1]>v)!==(b[1]>v)) xs.push(a[0]+(v-a[1])*(b[0]-a[0])/(b[1]-a[1])) }
  xs.sort((x,y)=>x-y); const out=[]; for(let i=0;i+1<xs.length;i+=2) if(xs[i+1]-xs[i]>1e-9) out.push([xs[i],xs[i+1]]); return out }
function gmIvAnd(A,B){ const out=[]; let i=0,j=0; while(i<A.length&&j<B.length){ const a=Math.max(A[i][0],B[j][0]), b=Math.min(A[i][1],B[j][1]); if(b>a+1e-9) out.push([a,b]); if(A[i][1]<B[j][1]) i++; else j++ } return out }
function gmIvSub(A, a, b){ if(!(b>a)) return A; const out=[]; for(const [x,y] of A){ if(b<=x||a>=y){ out.push([x,y]); continue } if(a>x) out.push([x,a]); if(b<y) out.push([b,y]) } return out }
/* trechos [x0,x1] em que o retângulo [x0,x1] × [ya,yb] fica dentro do polígono (exato: confere nas pontas e em cada vértice) */
function gmBandIv(P, ya, yb){ const e=1e-7; let I=gmIvAnd(gmLineIv(P, ya+e), gmLineIv(P, yb-e));
  for(const q of P) if(q[1]>ya+e && q[1]<yb-e && I.length){ I=gmIvAnd(I, gmLineIv(P,q[1]-e)); I=gmIvAnd(I, gmLineIv(P,q[1]+e)) } return I }
/* trecho em x ocupado por um obstáculo {p,b} dentro da faixa ya..yb (ou null) */
function gmBandRange(o, ya, yb){
  if(o.b[3]<=ya+1e-6 || o.b[1]>=yb-1e-6) return null;
  if(o.rect) return [o.b[0], o.b[2]];
  let c=G.clipHalf(o.p,[0,ya],[0,1]); if(!c.length) return null; c=G.clipHalf(c,[0,yb],[0,-1]); if(!c.length) return null;
  let mn=Infinity,mx=-Infinity,vn=Infinity,vx=-Infinity; for(const q of c){ if(q[0]<mn)mn=q[0]; if(q[0]>mx)mx=q[0]; if(q[1]<vn)vn=q[1]; if(q[1]>vx)vx=q[1] }
  return vx-vn<1e-4? null : [mn,mx] }
const gmBox=p=>{ let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity; for(const q of p){ if(q[0]<a)a=q[0]; if(q[0]>c)c=q[0]; if(q[1]<b)b=q[1]; if(q[1]>d)d=q[1] } return [a,b,c,d] };
const gmSw=p=>p.map(q=>[q[1],q[0]]);
const gmRectSw=r=>[r[1],r[0],r[3],r[2]];
const gmOb=(p,k)=>({p, b:gmBox(p), k});

/* ---------- referencial de um candidato (orientação ux) ---------- */
function gmFrame(ux, poly, obst, blocks, keep, portals, lobbies){
  const vy=[-ux[1],ux[0]], F=q=>[q[0]*ux[0]+q[1]*ux[1], q[0]*vy[0]+q[1]*vy[1]], Wd=(u,v)=>[ux[0]*u+vy[0]*v, ux[1]*u+vy[1]*v];
  const Fp=poly.map(F), OB=[...obst.map(p=>gmOb(p.map(F),"nucleo")), ...blocks.map(p=>gmOb(p.map(F),"rampa"))], KP=keep.map(p=>gmOb(p.map(F),"patamar"));
  const fb=gmBox(Fp);
  const mk=(sw)=>({F: sw? gmSw(Fp) : Fp, OB: OB.map(o=>sw? gmOb(gmSw(o.p),o.k) : o), KP: KP.map(o=>sw? gmOb(gmSw(o.p),o.k) : o)});
  return {ux, vy, F, Wd, Fp, fb, OB, KP, H:mk(false), V:mk(true),
    PT: portals.map(pt=>({p:F(pt.p), h:[G.dot(pt.heading,ux), G.dot(pt.heading,vy)], src:pt})),
    LB: lobbies.map(l=>({p:l.poly.map(F), b:gmBox(l.poly.map(F)), portas:(l.portas||[]).map(F)}))};
}

/* ---------- avaliação de um partido (referencial fixo) ----------
   cfg = {ang, aH (cota v do 1º corredor da série), vs:[u de cada transversal], tag}
   devolve as peças da rede, as fileiras, as vagas e os pilares em coordenadas do referencial + pontuação */
function gmAvalia(FR, R, cfg, opt={}){
  const ang=cfg.ang||90, th=ang*Math.PI/180, sn=Math.sin(th), cot= ang===90? 0 : Math.cos(th)/sn;
  const AI= ang===90? R.AI90 : ang===60? R.AI60 : R.AI45, AIv=R.AI90;
  const rd= ang===90? R.C : R.C*sn+R.W*Math.cos(th), Wp=R.W/sn, Pv=AI+2*rd;
  const Y0=FR.fb[1], Y1=FR.fb[3];
  const pieces=[];
  const hardIv=(L, ya, yb)=>{ let I=gmBandIv(L.F, ya, yb); for(const o of L.OB){ const r=gmBandRange(o, ya, yb); if(r) I=gmIvSub(I, r[0]-1e-6, r[1]+1e-6) } return I };
  // corredores paralelos (H)
  const lv=[]; { let k0=Math.ceil((Y0-1e-6-cfg.aH)/Pv); for(let y=cfg.aH+k0*Pv; y+AI<=Y1+1e-6; y+=Pv) lv.push(y) }
  // corredor pode raspar um obstáculo inclinado em até tolA (fica ≥ 5,0 m no ponto mais estreito)
  const tolA=Math.min(0.25, Math.max(0,(AI-5.0)/2));
  lv.forEach((y,li)=>hardIv(FR.H, y+tolA, y+AI-tolA).forEach(([a,b])=>{ if(b-a>=2*R.W) pieces.push({o:"H", a, b, y0:y, y1:y+AI, w:AI, lvl:li, dir: ang===90? 0 : (li%2? -1 : 1)}) }));
  // transversais (V): no referencial trocado, x = v e y = u
  (cfg.vs||[]).forEach(u=>hardIv(FR.V, u+tolA, u+AIv-tolA).forEach(([a,b])=>{ if(b-a>=AIv) pieces.push({o:"V", a, b, y0:u, y1:u+AIv, w:AIv, dir:0}) }));
  const fr=p=> p.o==="H"? [p.a,p.y0,p.b,p.y1] : [p.y0,p.a,p.y1,p.b];   // retângulo no referencial (u0,v0,u1,v1)
  // pontas curtas além da transversal mais de fora viram nada (a fileira junto da parede fica com a transversal)
  const corta=(A,B)=>A.forEach(h=>{ const vs=B.filter(p=>p.a<=h.y0+0.3 && p.b>=h.y1-0.3 && p.y0<h.b && p.y1>h.a);
    if(!vs.length) return; const lo=Math.min(...vs.map(v=>v.y0)), hi=Math.max(...vs.map(v=>v.y1)), lim=R.C+2.5+1e-6;
    if(lo-h.a <= lim) h.a=Math.max(h.a, lo); if(h.b-hi <= lim) h.b=Math.min(h.b, hi) });
  corta(pieces.filter(p=>p.o==="H"), pieces.filter(p=>p.o==="V")); corta(pieces.filter(p=>p.o==="V"), pieces.filter(p=>p.o==="H"));
  // conectores: de cada portal até a rede (reta no eixo do referencial, largura do corredor)
  const rectOk=(r)=>{ const I=hardIv(FR.H, r[1], r[3]); return I.some(([a,b])=>a<=r[0]+1e-6 && b>=r[2]-1e-6) };
  const near=(r,p,t)=>p[0]>=r[0]-t && p[0]<=r[2]+t && p[1]>=r[1]-t && p[1]<=r[3]+t;
  const att=FR.PT.map(()=>[]);
  FR.PT.forEach((pt,pi)=>{
    pieces.forEach((p,i)=>{ if(near(fr(p),pt.p,0.6)) att[pi].push(i) }); if(att[pi].length) return;
    const P=pt.p, dirs=[[1,0],[-1,0],[0,1],[0,-1]].sort((a,b)=>(b[0]*pt.h[0]+b[1]*pt.h[1])-(a[0]*pt.h[0]+a[1]*pt.h[1]));
    let best=null; const h=AI/2;
    dirs.forEach(d=>pieces.forEach((p,i)=>{ const r=fr(p), ax=d[0]? 0 : 1, ox=1-ax, sg=d[ax];
      // faixa do conector (largura do corredor, centrada no portal) precisa cruzar a peça numa largura de carro
      const c=P[ox], lo=c-h, hi=c+h; if(Math.min(hi,r[ox+2])-Math.max(lo,r[ox])<2.4) return;
      const nr= sg>0? r[ax] : r[ax+2], L=(nr-P[ax])*sg; if(L< -0.01) return;
      if(best && L>=best.L) return;
      const fim=nr+sg*Math.min(r[ax+2]-r[ax], AI), ini=P[ax]-sg*1.0;
      const cr=[0,0,0,0]; cr[ax]=Math.min(ini,fim); cr[ax+2]=Math.max(ini,fim); cr[ox]=lo; cr[ox+2]=hi;
      // o conector não pode atravessar núcleo nem rampa (o patamar pode); confere do portal até a peça
      const chk=cr.slice(); if(sg>0) chk[ax]=P[ax]; else chk[ax+2]=P[ax];
      if(L>0.05 && !rectOk(chk)) return;
      best={L, i, cr, o: ax===0? "H" : "V"} }));
    if(best){ const c=best.cr, np= best.o==="H"? {o:"H", a:c[0], b:c[2], y0:c[1], y1:c[3], w:AI, conn:true, dir:0} : {o:"V", a:c[1], b:c[3], y0:c[0], y1:c[2], w:AI, conn:true, dir:0};
      pieces.push(np); att[pi].push(pieces.length-1) } });
  // grafo da rede: peças que se cruzam (sobreposição ≥ largura de um carro nos dois sentidos)
  const nP=pieces.length, adj=pieces.map(()=>[]), R_=pieces.map(fr);
  for(let i=0;i<nP;i++) for(let j=i+1;j<nP;j++){ const a=R_[i], b=R_[j], ou=Math.min(a[2],b[2])-Math.max(a[0],b[0]), ov=Math.min(a[3],b[3])-Math.max(a[1],b[1]); if(ou>=2.4 && ov>=2.4){ adj[i].push(j); adj[j].push(i) } }
  const reach=new Uint8Array(nP), q=[]; (att[0]||[]).forEach(i=>{ reach[i]=1; q.push(i) });
  if(!FR.PT.length && nP){ let bi=0; pieces.forEach((p,i)=>{ if(p.b-p.a>pieces[bi].b-pieces[bi].a) bi=i }); reach[bi]=1; q.push(bi) }
  for(let h=0;h<q.length;h++) adj[q[h]].forEach(j=>{ if(!reach[j]){ reach[j]=1; q.push(j) } });
  const portaisOk = att.every(l=>l.some(i=>reach[i]));
  const net=pieces.map((p,i)=>({...p, i, r:R_[i], ok:!!reach[i], adj:adj[i]})).filter(p=>p.ok);
  // reservas: corredores alcançados (o carro passa), faixas de pedestres e bolsões de retorno
  const soft=net.map(p=>({r:p.r, k:"corr"}));
  // faixa de pedestres: do hall dos elevadores até o corredor mais próximo, em linha reta no eixo do referencial
  const peds=[];
  FR.LB.forEach((lb,li)=>{ const b=lb.b; let best=null;
    const tries=[]; const um=(b[0]+b[2])/2, vm=(b[1]+b[3])/2;
    const sU=[um, b[0]+(b[2]-b[0])*0.25, b[0]+(b[2]-b[0])*0.75], sV=[vm, b[1]+(b[3]-b[1])*0.25, b[1]+(b[3]-b[1])*0.75];
    (lb.portas.length? lb.portas : []).forEach(pp=>{ sU.unshift(pp[0]); sV.unshift(pp[1]) });
    sV.forEach(v=>{ tries.push({d:[1,0], s:[b[2],v]}); tries.push({d:[-1,0], s:[b[0],v]}) });
    sU.forEach(u=>{ tries.push({d:[0,1], s:[u,b[3]]}); tries.push({d:[0,-1], s:[u,b[1]]}) });
    const hw=R.ped/2;
    tries.forEach(t=>{ const s=t.s, d=t.d, out=[s[0]+d[0]*0.15, s[1]+d[1]*0.15];
      if(FR.OB.some(o=>out[0]>o.b[0]&&out[0]<o.b[2]&&out[1]>o.b[1]&&out[1]<o.b[3]&&G.pip(out,o.p))) return;   // saída por dentro do núcleo
      net.forEach(p=>{ const r=p.r; let L, rr;
        if(d[0]){ if(s[1]-hw<r[1] || s[1]+hw>r[3]) return; const e= d[0]>0? r[0] : r[2]; L=(e-s[0])*d[0]; if(L<-0.01 || (d[0]>0? s[0]>r[2] : s[0]<r[0])) return; L=Math.max(0,L); rr= d[0]>0? [s[0], s[1]-hw, s[0]+L, s[1]+hw] : [s[0]-L, s[1]-hw, s[0], s[1]+hw] }
        else { if(s[0]-hw<r[0] || s[0]+hw>r[2]) return; const e= d[1]>0? r[1] : r[3]; L=(e-s[1])*d[1]; if(L<-0.01 || (d[1]>0? s[1]>r[3] : s[1]<r[1])) return; L=Math.max(0,L); rr= d[1]>0? [s[0]-hw, s[1], s[0]+hw, s[1]+L] : [s[0]-hw, s[1]-L, s[0]+hw, s[1]] }
        if(best && L>=best.L) return;
        if(L>0.05){ const I=hardIv(FR.H, rr[1], rr[3]); if(!I.some(([a,b2])=>a<=rr[0]+1e-6 && b2>=rr[2]-1e-6)) return }
        best={L, r:rr, li, s, e:[s[0]+d[0]*(L+0.5), s[1]+d[1]*(L+0.5)], d, piece:p.i} }) });
    if(best){ peds.push(best); if(best.L>0.05) soft.push({r:best.r, k:"ped"}) } else peds.push({li, falta:true}) });
  // becos: ponta de corredor além da última junção (nem portal nem cruzamento)
  const becos=[];
  net.forEach(p=>{ if(p.conn) return;
    const js=[]; p.adj.forEach(j=>{ const o=net.find(x=>x.i===j); if(!o) return; const c= p.o==="H"? (o.r[0]+o.r[2])/2 : (o.r[1]+o.r[3])/2; js.push(c) });
    FR.PT.forEach((pt,pi)=>{ if(att[pi].includes(p.i)) js.push(p.o==="H"? pt.p[0] : pt.p[1]) });
    if(!js.length) return; const mn=Math.min(...js), mx=Math.max(...js);
    [[p.a, mn-p.a, -1],[p.b, p.b-mx, 1]].forEach(([e,L,sg])=>{ if(L>R.C+AIv/2+0.5) becos.push({p:p.i, o:p.o, e, L, sg, longo:L>R.beco}) }) });
  // bolsão de retorno no fim dos becos longos: o espaço de uma vaga + folga ao lado do corredor
  becos.filter(b=>b.longo).forEach(b=>{ const p=net.find(x=>x.i===b.p), x0= b.sg>0? b.e-(R.W+1.0) : b.e, x1= b.sg>0? b.e : b.e+(R.W+1.0);
    const r= p.o==="H"? [x0, p.y1, x1, p.y1+rd] : [p.y1, x0, p.y1+R.C, x1]; soft.push({r, k:"retorno"}); b.r=r });
  // fileiras: H primeiro (ao longo dos corredores principais), depois V e conectores
  const stalls=[], pillars=[];
  const Pt=R.nM*Wp+R.PIL+2*R.acrPil;
  const lV=net.filter(p=>p.o==="V" && !p.conn).sort((a,b)=>a.y0-b.y0), lH=net.filter(p=>p.o==="H" && !p.conn).sort((a,b)=>a.y0-b.y0);
  const XL=FR.fb[0];
  let gu = lV.length? lV[0].y1 - R.PIL/2 - R.acrPil : (()=>{ const I=gmLineIv(FR.H.F,(Y0+Y1)/2); return (I.length? I[0][0] : XL) + R.acrP - R.PIL/2 - R.acrPil })();
  let gv = lH.length? lH[0].y1 - R.PIL/2 - R.acrPil : Y0 + R.acrP - R.PIL/2 - R.acrPil;
  const fill=(p, side)=>{
    const V_=p.o==="V", L=V_? FR.V : FR.H, ang_=V_? 90 : ang, rd_=V_? R.C : rd, Wp_=V_? R.W : Wp, cot_=V_? 0 : cot, Pt_=V_? R.nM*R.W+R.PIL+2*R.acrPil : Pt, g0=V_? gv : gu;
    const e= side>0? p.y1 : p.y0, ya=Math.min(e, e+side*rd_), yb=Math.max(e, e+side*rd_);
    let Hh=hardIv(L, ya, yb); if(!Hh.length) return;
    let I=gmIvAnd(Hh, [[p.a, p.b]]);
    const sub=(r)=>{ const rr= V_? gmRectSw(r) : r; if(rr[3]<=ya+1e-6 || rr[1]>=yb-1e-6) return; I=gmIvSub(I, rr[0]-1e-6, rr[2]+1e-6) };
    soft.forEach(s=>sub(s.r)); stalls.forEach(s=>sub(s.r)); L.KP.forEach(o=>{ const r=gmBandRange(o, ya, yb); if(r) I=gmIvSub(I, r[0]-1e-6, r[1]+1e-6) });
    const isHard=x=>Hh.some(([a,b])=>Math.abs(a-x)<1e-5||Math.abs(b-x)<1e-5);
    const t= p.dir||1, sh=t*rd_*cot_, f0=Math.min(0,sh), f1=Math.max(0,sh);
    I.forEach(([a,b])=>{ const wa=isHard(a)? R.acrP : 0, wb=isHard(b)? R.acrP : 0, row=[];
      const k0=Math.floor((a-g0)/Pt_)-1, k1=Math.ceil((b-g0)/Pt_)+1;
      for(let k=k0;k<=k1;k++) for(let j=0;j<R.nM;j++){ const s=g0+k*Pt_+R.PIL/2+R.acrPil+j*Wp_;
        if(s+f0 < a+wa-1e-6 || s+Wp_+f1 > b-wb+1e-6) continue;
        // largura acrescida junto de parede (wa/wb) e de pilar (pontas do grupo)
        const xl = s - (Math.abs(s+f0-a-wa)<0.6 && wa? wa : (j===0? R.acrPil : 0)), xr = s+Wp_ + (Math.abs(b-wb-(s+Wp_+f1))<0.6 && wb? wb : (j===R.nM-1? R.acrPil : 0));
        row.push({k, j, s, xl:Math.max(a, Math.min(s, xl)), xr:Math.min(b, Math.max(s+Wp_, xr))}) }
      row.forEach(z=>{
        const loc=[[z.xl,e],[z.xr,e],[z.xr+sh,e+side*rd_],[z.xl+sh,e+side*rd_]];
        const fp=[Math.min(z.xl,z.xl+sh), Math.min(ya,yb), Math.max(z.xr,z.xr+sh), Math.max(ya,yb)];
        const toF= V_? (q=>[q[1],q[0]]) : (q=>q);
        const poly=loc.map(toF), fm=toF([(z.xl+z.xr)/2, e]), ax=[t*cot_*sn, side*sn];   // eixo da vaga (frente → fundo) no referencial local
        const axL= ang_===90? [0,side] : [t*Math.cos(th), side*Math.sin(th)];
        const out=toF([-axL[0], -axL[1]]);
        stalls.push({poly, r: V_? gmRectSw(fp) : fp, fm, out, c:toF([(z.xl+z.xr)/2+sh/2, e+side*rd_/2]), o:p.o, piece:p.i, side, grp:z.k, j:z.j, W:z.xr-z.xl, ang:ang_, u:z.s, uc:(z.xl+z.xr)/2, aisle:p.i}) });
      // pilares da malha: na linha do grupo, 1 m para dentro da frente das vagas, só onde há vaga ao lado
      const ks=new Set(); row.forEach(z=>{ if(z.j===0) ks.add(z.k); if(z.j===R.nM-1) ks.add(z.k+1) });
      if(R.PIL>0) ks.forEach(k=>{ const x=g0+k*Pt_, d0=Math.min(R.inset, rd_-R.PIL-0.2), y0=e+side*d0, y1=e+side*(d0+R.PIL), xs=x+t*cot_*(d0+R.PIL/2);
        const r=[xs-R.PIL/2, Math.min(y0,y1), xs+R.PIL/2, Math.max(y0,y1)];
        if(!Hh.some(([a2,b2])=>a2<=r[0]+1e-6 && b2>=r[2]-1e-6)) return;
        const rf= V_? gmRectSw(r) : r; if(soft.some(s=>s.r[0]<rf[2]&&s.r[2]>rf[0]&&s.r[1]<rf[3]&&s.r[3]>rf[1])) return;
        pillars.push({r:rf, o:p.o, k}) }) });
  };
  lH.forEach(p=>{ fill(p,-1); fill(p,1) });
  lV.forEach(p=>{ fill(p,-1); fill(p,1) });
  net.filter(p=>p.conn).forEach(p=>{ fill(p,-1); fill(p,1) });
  // pontuação: vagas, becos, distância a pé do hall, portais desligados
  const nB=becos.filter(b=>b.longo).length, nBc=becos.length-nB, pedL=peds.reduce((s,p)=>s+(p.falta? 12 : p.L),0);
  let sc=stalls.length - 0.6*nB - 0.25*nBc - pedL/10;
  if(!portaisOk) sc-=1000;
  return {cfg, ang, AI, rd, Wp, Pt, net, peds, becos, stalls, pillars, sc, portaisOk, gu, gv, att};
}

/* ---------- candidatos: orientações × séries de corredores × transversais ---------- */
function gmCandidatos(FR, R, angs, quick){
  const out=[];
  angs.forEach(ang=>{
    const th=ang*Math.PI/180, sn=Math.sin(th), AI= ang===90? R.AI90 : ang===60? R.AI60 : R.AI45, rd= ang===90? R.C : R.C*sn+R.W*Math.cos(th), Pv=AI+2*rd;
    const [X0,Y0,X1,Y1]=FR.fb, H=Y1-Y0;
    const an=[Y0+rd, Y1-rd-AI, Y0, Y1-AI];
    const n=Math.floor((H+1e-6)/Pv); if(n>=1) an.push(Y0+rd+(H-n*Pv)/2);
    FR.OB.forEach(o=>{ an.push(o.b[1]-AI, o.b[3]); if(o.k==="rampa") an.push(o.b[1]-rd-AI) });
    FR.PT.forEach(pt=>an.push(pt.p[1]-AI/2));
    const uniq=[]; an.forEach(a=>{ const m=((a-Y0)%Pv+Pv)%Pv; if(!uniq.some(x=>{ const d=Math.abs(x.m-m); return Math.min(d,Pv-d)<0.3 })) uniq.push({a, m}) });
    // transversais: junto das paredes (com ou sem fileira encostada), ao lado das rampas, nos portais e no meio
    const xs=[0.25,0.5,0.75].map(f=>gmLineIv(FR.Fp, Y0+(Y1-Y0)*f)).filter(I=>I.length), XL=xs.length? Math.max(...xs.map(I=>I[0][0])) : X0, XR=xs.length? Math.min(...xs.map(I=>I[I.length-1][1])) : X1;
    const AIv=R.AI90, pos=[["Lw",XL+R.C],["La",XL],["Rw",XR-R.C-AIv],["Ra",XR-AIv]];
    FR.OB.filter(o=>o.k==="rampa").forEach((o,i)=>{ pos.push(["r"+i+"a",o.b[0]-AIv], ["r"+i+"b",o.b[2]]) });
    FR.OB.filter(o=>o.k==="nucleo").forEach((o,i)=>{ pos.push(["n"+i+"a",o.b[0]-AIv], ["n"+i+"b",o.b[2]]) });
    FR.PT.forEach((pt,i)=>pos.push(["p"+i, pt.p[0]-AIv/2]));
    pos.push(["m",(XL+XR)/2-AIv/2]);
    const P=[]; pos.forEach(p=>{ if(p[1]>=X0-0.01 && p[1]+AIv<=X1+0.01 && !P.some(q=>Math.abs(q[1]-p[1])<0.3)) P.push(p) });
    const cfgs=[[]]; P.forEach(p=>cfgs.push([p]));
    for(let i=0;i<P.length;i++) for(let j=i+1;j<P.length;j++) if(Math.abs(P[i][1]-P[j][1])>=AIv+2*R.W) cfgs.push([P[i],P[j]]);
    if(!quick){ // três transversais (pavimentos longos)
      const W_=XR-XL; if(W_>60) cfgs.push([pos[0],["m",(XL+XR)/2-AIv/2],pos[2]]) }
    uniq.forEach(({a})=>out.push({ang, aH:a, cfgs}));
  });
  return out;
}
/* nome do partido pela forma da rede */
function gmPartido(L){
  if(L.ang!==90) return "inclinado";
  const H=L.net.filter(p=>p.o==="H" && !p.conn), V=L.net.filter(p=>p.o==="V" && !p.conn);
  const lv=new Set(H.map(p=>p.y0.toFixed(1))).size, rows=new Set(L.stalls.filter(s=>s.o==="H").map(s=>s.piece+":"+s.side)).size;
  const longos=L.becos.filter(b=>b.longo).length;
  if(lv<=1){ if(V.length>=2 && H.length) return "anel"; return rows<=1? "estreita" : "simples" }
  if(V.length>=2 && !longos) return "anel";
  if(V.length===1){ const v=V[0], [X0,,X1]=L.fb||[0,0,0]; const meio=H.some(h=>h.a<v.y0-R_MIN && h.b>v.y1+R_MIN); if(meio) return "espinha" }
  return lv===2? "duplo" : "pente";
}
const R_MIN=7.5;

/* ---------- solução de um pavimento ---------- */
function garModSolve(poly, obst, E, o){
  const R=garRegras(E, o.gx), portals=o.portals||[], blocks=o.blocks||[], keep=o.keep||[];
  if(!poly || poly.length<3) return null;
  // halls dos elevadores (obstáculos que pedem faixa de pedestres): os do contrato do núcleo ou os lobbies de m.obst
  const lobbies=(o.lobbies||[]).filter(l=>l && l.poly && l.poly.length>2 && G.polysOverlap(l.poly, poly));
  // orientações: lados do pavimento e direções dos portais (paralelas e perpendiculares)
  let dirs=[];
  if(E.garDir!=="auto"){ const a=(+E.garDirGraus||0)*Math.PI/180; dirs=[[Math.cos(a),Math.sin(a)],[-Math.sin(a),Math.cos(a)]] }
  else { const cand=[]; const add=(d,w)=>{ const nrm=((Math.atan2(d[1],d[0])%Math.PI)+Math.PI)%Math.PI; const c=cand.find(x=>Math.abs(x.a-nrm)<0.05||Math.abs(Math.abs(x.a-nrm)-Math.PI)<0.05); if(c) c.w+=w; else cand.push({a:nrm, w}) };
    for(let i=0;i<poly.length;i++){ const a=poly[i], b=poly[(i+1)%poly.length], L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<4) continue; const d=[(b[0]-a[0])/L,(b[1]-a[1])/L]; add(d,L); add([-d[1],d[0]],L) }
    portals.forEach(pt=>{ add(pt.heading,5); add([-pt.heading[1],pt.heading[0]],5) });
    obst.forEach(p=>{ for(let i=0;i<p.length;i++){ const a=p[i], b=p[(i+1)%p.length], L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<2) continue; const d=[(b[0]-a[0])/L,(b[1]-a[1])/L]; add(d,L*1.5); add([-d[1],d[0]],L*1.5) } });
    cand.sort((a,b)=>b.w-a.w); dirs=cand.slice(0, o.quick? 2 : 4).map(c=>[Math.cos(c.a),Math.sin(c.a)]) }
  const angs = E.angulo==="melhor"? [90,60,45] : [+E.angulo||90];
  const t0=Date.now(), lim=o.quick? 350 : 2500;
  let all=[];
  dirs.forEach(ux=>{
    const FR=gmFrame(ux, poly, obst, blocks, keep, portals, lobbies);
    const cs=gmCandidatos(FR, R, angs, o.quick);
    // 1ª rodada: cada série de corredores com as transversais básicas; 2ª: todas as transversais nas melhores séries
    const basic=c=>c.cfgs.filter(g=>g.length===0 || (g.length===2 && g.every(x=>/^(Lw|Rw|La|Ra|r\d+a|r\d+b)$/.test(x[0]))) || (g.length===1 && /^(r\d+a|r\d+b|p\d+)$/.test(g[0][0])));
    const r1=[];
    cs.forEach(c=>{ let best=null; basic(c).forEach(g=>{ const L=gmAvalia(FR, R, {ang:c.ang, aH:c.aH, vs:g.map(x=>x[1]), tag:g.map(x=>x[0]).join("+")}); if(!best || L.sc>best.sc) best=L }); if(best) r1.push({c, L:best}) });
    r1.sort((a,b)=>b.L.sc-a.L.sc);
    const top=r1.slice(0, o.quick? 2 : 5);
    top.forEach(({c,L})=>{ all.push({FR, L}); if(Date.now()-t0>lim) return;
      c.cfgs.forEach(g=>{ const L2=gmAvalia(FR, R, {ang:c.ang, aH:c.aH, vs:g.map(x=>x[1]), tag:g.map(x=>x[0]).join("+")}); if(L2.sc>L.sc-3) all.push({FR, L:L2}) }) });
    r1.slice(top.length, top.length+3).forEach(x=>all.push({FR, L:x.L}));
  });
  if(R.partido!=="auto"){ const fx=all.filter(x=>gmPartido({...x.L, fb:x.FR.fb})===R.partido); if(fx.length) all=fx }
  all.sort((a,b)=>b.L.sc-a.L.sc);
  return {R, cands:all, lobbies};
}

/* ---------- do referencial para o mundo: vagas, PCD com faixa, pilares, corredores, pedestres, rotas ---------- */
function garModMundo(FR, L, R, E, o){
  const Wd=(q)=>FR.Wd(q[0],q[1]), rectW=r=>[[r[0],r[1]],[r[2],r[1]],[r[2],r[3]],[r[0],r[3]]].map(Wd);
  const dirW=d=>[FR.ux[0]*d[0]+FR.vy[0]*d[1], FR.ux[1]*d[0]+FR.vy[1]*d[1]];
  let vagas=L.stalls.map((s,i)=>({poly:s.poly.map(Wd), c:Wd(s.c), fm:Wd(s.fm), out:dirW(s.out), u:s.u, uc:s.uc, row:s.piece*2+(s.side>0?1:0), grp:s.grp, j:s.j, aisle:s.piece, tipo:"n", W:s.W, _f:s}));
  const pillars=L.pillars.map(p=>rectW(p.r));
  const aisles=L.net.map(p=>({poly:rectW(p.r), o:p.o, conn:!!p.conn, dir:p.dir, w:p.w, i:p.i,
    a:Wd(p.o==="H"? [p.a,(p.y0+p.y1)/2] : [(p.y0+p.y1)/2,p.a]), b:Wd(p.o==="H"? [p.b,(p.y0+p.y1)/2] : [(p.y0+p.y1)/2,p.b])}));
  const peds=L.peds.filter(p=>!p.falta).map(p=>({poly: p.L>0.05? rectW(p.r) : null, a:Wd(p.s), b:Wd(p.e), L:p.L, lobby:p.li}));
  const retornos=L.becos.filter(b=>b.longo && b.r).map(b=>rectW(b.r));
  return {vagas, pillars, aisles, peds, retornos};
}
/* PCD (faixa de transferência de 1,20 m de um lado ou compartilhada por duas) e idosos perto do hall dos elevadores */
function garPcdIdoso(lay, E, R, ref){
  const cars=lay.vagas.filter(v=>v.tipo==="n" && !v.presa && !v.tandem && v._f && v._f.ang===90);
  const n=lay.vagas.filter(v=>v.tipo==="n").length, nP=n&&E.pcd>0? Math.max(1,Math.round(n*E.pcd)) : 0, nI=n&&E.idoso>0? Math.max(1,Math.round(n*E.idoso)) : 0;
  const d=v=>Math.hypot(v.c[0]-ref[0], v.c[1]-ref[1]);
  // grupos de vagas lado a lado (mesma fileira e mesmo módulo entre pilares), do mais perto do hall para o mais longe
  const grupos={}; cars.forEach(v=>{ const k=v.row+":"+v.grp; (grupos[k]=grupos[k]||[]).push(v) });
  const lista=Object.values(grupos).map(g=>g.sort((a,b)=>a.j-b.j)).filter(g=>{ for(let i=1;i<g.length;i++) if(g[i].j!==g[i-1].j+1) return false; return true })
    .map(g=>({g, d:Math.min(...g.map(d)), len:g.reduce((s,v)=>s+v.W,0)})).sort((a,b)=>a.d-b.d);
  // monta um grupo com k vagas PCD: [PCD | faixa | PCD] (compartilhada) ou [PCD | faixa] + comuns
  const monta=(gr, k)=>{ const g=gr.g, s0=g[0], f=s0._f, side=f.side, V_=f.o==="V", W=R.W, F=R.pcdF;
    const x0=Math.min(...g.map(v=>v._f.r[V_?1:0])), x1=Math.max(...g.map(v=>v._f.r[V_?3:2]));
    const need = k===2? 2*W+F : W+F; if(x1-x0 < need-1e-6) return null;
    const sobra=x1-x0-need, nC=Math.floor((sobra+1e-6)/W), extra=(sobra-nC*W)/(k+nC||1);
    const seq= k===2? [["pcd",W+extra],["faixa",F],["pcd",W+extra]] : [["pcd",W+extra],["faixa",F]];
    for(let i=0;i<nC;i++) seq.push(["n",W+extra]);
    // o lado da faixa junto do hall fica com a PCD (encosta na faixa de pedestres se puder)
    return {seq, x0, x1, nC, k};
  };
  const opc=modo=>{ let resto=nP, perda=0; const usos=[];
    for(const gr of lista){ if(resto<=0) break; const k= modo==="comp" && resto>=2? 2 : 1, m=monta(gr,k); if(!m){ continue } usos.push({gr, m}); perda+=gr.g.length-(m.k+m.nC); resto-=m.k }
    return {usos, perda, falta:resto, modo} };
  const A=opc("comp"), B=opc("lado");
  const esc = R.pcdModo==="compartilhada"? A : R.pcdModo==="lado"? B : ((A.falta-B.falta)||(A.perda-B.perda))<=0? A : B;
  const Wd=lay._Wd;
  esc.usos.forEach(({gr,m})=>{ const g=gr.g, f=g[0]._f, V_=f.o==="V", e=f.side>0? (V_? f.r[0] : f.r[1]) : (V_? f.r[2] : f.r[3]), side=f.side, rd=R.C;
    const toF= V_? (q=>[q[1],q[0]]) : (q=>q); let x=m.x0; const novos=[];
    m.seq.forEach(([t,w])=>{ const loc=[[x,e],[x+w,e],[x+w,e+side*rd],[x,e+side*rd]].map(toF), fmF=toF([x+w/2,e]), cF=toF([x+w/2,e+side*rd/2]);
      novos.push({poly:loc.map(q=>Wd(q)), c:Wd(cF), fm:Wd(fmF), out:g[0].out, u:x, uc:x+w/2, row:g[0].row, grp:g[0].grp, j:novos.length, aisle:g[0].aisle, tipo:t, W:w, pcdModo:esc.modo, _f:{...f, r: V_? [Math.min(e,e+side*rd), x, Math.max(e,e+side*rd), x+w] : [x, Math.min(e,e+side*rd), x+w, Math.max(e,e+side*rd)]}}); x+=w });
    const set=new Set(g); const i0=lay.vagas.findIndex(v=>set.has(v)); lay.vagas=lay.vagas.filter(v=>!set.has(v)); lay.vagas.splice(i0,0,...novos) });
  // idosos: as comuns mais perto do hall
  lay.vagas.filter(v=>v.tipo==="n" && !v.presa && !v.tandem).sort((a,b)=>d(a)-d(b)).slice(0,nI).forEach(v=>v.tipo="idoso");
  lay.pcd={modo:esc.modo, pedidas:nP, feitas:nP-esc.falta, perda:esc.perda};
}
/* rota pela rede de corredores (eixos), com curvas de raio real do carro nas esquinas */
function garRotaRede(lay, R, from, to){
  const A=lay.aisles; if(!A||!A.length) return null;
  const pts=[], key=p=>p[0].toFixed(2)+","+p[1].toFixed(2), nodes=new Map(), edges=[];
  const node=p=>{ const k=key(p); if(!nodes.has(k)) nodes.set(k,{p, e:[]}); return nodes.get(k) };
  const seg=(a,b)=>{ const na=node(a), nb=node(b), L=Math.hypot(b[0]-a[0],b[1]-a[1]); na.e.push([nb,L]); nb.e.push([na,L]) };
  const proj=(p,s)=>{ const d=[s.b[0]-s.a[0],s.b[1]-s.a[1]], L2=d[0]*d[0]+d[1]*d[1]||1, t=clamp(((p[0]-s.a[0])*d[0]+(p[1]-s.a[1])*d[1])/L2,0,1); return [s.a[0]+d[0]*t, s.a[1]+d[1]*t] };
  const inter=(s1,s2)=>{ const d1=[s1.b[0]-s1.a[0],s1.b[1]-s1.a[1]], d2=[s2.b[0]-s2.a[0],s2.b[1]-s2.a[1]], den=d1[0]*d2[1]-d1[1]*d2[0]; if(Math.abs(den)<1e-9) return null;
    const t=((s2.a[0]-s1.a[0])*d2[1]-(s2.a[1]-s1.a[1])*d2[0])/den, u=((s2.a[0]-s1.a[0])*d1[1]-(s2.a[1]-s1.a[1])*d1[0])/den; if(t<-0.02||t>1.02||u<-0.02||u>1.02) return null; return [s1.a[0]+d1[0]*t, s1.a[1]+d1[1]*t] };
  const cuts=A.map(s=>[s.a, s.b]);
  for(let i=0;i<A.length;i++) for(let j=i+1;j<A.length;j++){ const p=inter(A[i],A[j]); if(p){ cuts[i].push(p); cuts[j].push(p) } }
  const ends=[from,to].map(p=>{ let best=null; A.forEach((s,i)=>{ const q=proj(p,s), d=Math.hypot(q[0]-p[0],q[1]-p[1]); if(!best||d<best.d) best={i,q,d} }); if(best) cuts[best.i].push(best.q); return best });
  if(ends.some(e=>!e)) return null;
  A.forEach((s,i)=>{ const d=[s.b[0]-s.a[0],s.b[1]-s.a[1]]; const l=cuts[i].map(p=>({p, t:(p[0]-s.a[0])*d[0]+(p[1]-s.a[1])*d[1]})).sort((x,y)=>x.t-y.t); for(let k=1;k<l.length;k++) if(l[k].t-l[k-1].t>1e-6) seg(l[k-1].p, l[k].p) });
  const s0=node(ends[0].q), s1=node(ends[1].q), dist=new Map([[s0,0]]), prev=new Map(), Q=[s0];
  while(Q.length){ Q.sort((a,b)=>dist.get(a)-dist.get(b)); const u=Q.shift(); if(u===s1) break; u.e.forEach(([v,l])=>{ const nd=dist.get(u)+l; if(nd<(dist.has(v)? dist.get(v) : Infinity)){ dist.set(v,nd); prev.set(v,u); Q.push(v) } }) }
  if(!dist.has(s1)) return null;
  const path=[]; for(let n=s1; n; n=prev.get(n)) path.unshift(n.p);
  const P=[from, ...path, to].filter((p,i,a)=>!i || Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1])>0.05);
  // tira pontos colineares e arredonda as esquinas com o raio do eixo do carro
  const Q2=[P[0]]; for(let i=1;i<P.length-1;i++){ const a=Q2[Q2.length-1], b=P[i], c=P[i+1], cr=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]); if(Math.abs(cr)>1e-3) Q2.push(b) } Q2.push(P[P.length-1]);
  return garArredonda(Q2, (R.Ro+R.Ri)/2);
}
function garArredonda(P, r){
  if(P.length<3) return P; const out=[P[0]];
  for(let i=1;i<P.length-1;i++){ const a=P[i-1], b=P[i], c=P[i+1], la=Math.hypot(b[0]-a[0],b[1]-a[1]), lc=Math.hypot(c[0]-b[0],c[1]-b[1]); if(la<1e-6||lc<1e-6){ out.push(b); continue }
    const u=[(a[0]-b[0])/la,(a[1]-b[1])/la], w=[(c[0]-b[0])/lc,(c[1]-b[1])/lc], cs=clamp(u[0]*w[0]+u[1]*w[1],-1,1), th=Math.acos(cs); if(th>Math.PI-0.05){ out.push(b); continue }
    const t=Math.min(r/Math.tan(th/2), la/2, lc/2), rr=t*Math.tan(th/2), p1=[b[0]+u[0]*t,b[1]+u[1]*t], p2=[b[0]+w[0]*t,b[1]+w[1]*t];
    const bis=[u[0]+w[0],u[1]+w[1]], bl=Math.hypot(...bis)||1, dc=rr/Math.sin(th/2), ce=[b[0]+bis[0]/bl*dc, b[1]+bis[1]/bl*dc];
    const a1=Math.atan2(p1[1]-ce[1],p1[0]-ce[0]); let a2=Math.atan2(p2[1]-ce[1],p2[0]-ce[0]), da=a2-a1; while(da>Math.PI) da-=2*Math.PI; while(da<-Math.PI) da+=2*Math.PI;
    const n=Math.max(3,Math.ceil(Math.abs(da)/0.2)); for(let k=0;k<=n;k++){ const an=a1+da*k/n; out.push([ce[0]+rr*Math.cos(an), ce[1]+rr*Math.sin(an)]) } }
  out.push(P[P.length-1]); return out }

/* ---------- validação: regras com nota e motivo (como aptoValida) ----------
   lay = layout de um pavimento (m.gar[k]); ctx = {poly, obst, E, gx, chave}. Devolve {nota, problemas[{k,nivel,msg}], met} */
function garValida(lay, ctx){
  const E=ctx.E, R=garRegras(E, ctx.gx), poly=ctx.poly||[], obst=ctx.obst||[], P=[];
  const add=(k,nivel,msg,extra)=>P.push({k,nivel,msg,...(extra||{})});
  const area=G.area(poly), carros=lay.vagas.filter(v=>garCar(v.tipo)), n=carros.length;
  const bb=p=>gmBox(p), hit=(a,b)=>a[0]<b[2]-1e-3&&b[0]<a[2]-1e-3&&a[1]<b[3]-1e-3&&b[1]<a[3]-1e-3;
  const ov=(a,b)=>{ if(!hit(bb(a),bb(b))) return false; return garAreaInter(a,b)>0.05 };
  // 1) nenhuma vaga em núcleo/hall, rampa, patamar, corredor ou faixa de pedestres; nenhuma sobreposta a outra ou a pilar
  const proib=[...obst.map(p=>["núcleo ou hall",p]), ...(lay.blocks||[]).map(p=>["rampa",p]), ...(lay.landings||[]).map(p=>["patamar",p]), ...(lay.peds||[]).filter(x=>x.poly).map(x=>["faixa de pedestres",x.poly])];
  let nProib=0, nSob=0, nFora=0;
  const vs=lay.vagas.filter(v=>v.tipo!=="off");
  vs.forEach((v,i)=>{ if(poly.length && !G.polyInPoly(v.poly.map(q=>[q[0]+(G.centroid(v.poly)[0]-q[0])*0.01, q[1]+(G.centroid(v.poly)[1]-q[1])*0.01]), poly)) nFora++;
    if(proib.some(([,p])=>ov(v.poly,p))) nProib++;
    for(let j=i+1;j<vs.length;j++) if(ov(v.poly,vs[j].poly)){ nSob++; break } });
  (lay.pillars||[]).forEach(p=>{ if(vs.some(v=>ov(v.poly,p))) nSob++ });
  if(nProib) add("proib","bad",`${nProib} vaga${nProib>1?"s":""} sobre núcleo, rampa, patamar ou faixa de pedestres`);
  if(nSob) add("sobre","bad",`${nSob} vaga${nSob>1?"s":""} sobreposta${nSob>1?"s":""} a outra vaga ou a pilar`);
  if(nFora) add("fora","bad",`${nFora} vaga${nFora>1?"s":""} fora do pavimento`);
  // 2) rota: todas as vagas alcançáveis e com manobra livre (malha de 0,5 m); portais ligados
  if(lay.ok===false) add("rota","bad","a rampa não chega à circulação deste pavimento");
  if(lay.semRota) add("semrota","bad",`${lay.semRota} vaga${lay.semRota>1?"s":""} sem rota até a rampa`);
  // 3) manobra diante da vaga: retângulo da largura da vaga × profundidade de manobra livre de vagas e pilares
  let nMan=0; const need=a=> a===90||!a? Math.max(4.8,R.AI90-0.7) : a===60? R.AI60-0.5 : R.AI45-0.5;
  carros.forEach(v=>{ if(v.presa) return; const fr=frontRect(v.fm, v.out, Math.max(1.8,(v.W||R.W)-0.4), need(v._f&&v._f.ang)); const b0=bb(fr);
    if(vs.some(w=>w!==v && hit(b0,bb(w.poly)) && garAreaInter(fr,w.poly)>0.3) || (lay.pillars||[]).some(p=>hit(b0,bb(p)) && garAreaInter(fr,p)>0.02)) nMan++ });
  if(nMan) add("manobra","bad",`${nMan} vaga${nMan>1?"s":""} sem área de manobra livre à frente`);
  // 4) faixa de pedestres do hall dos elevadores ao corredor
  const nL=(ctx.lobbies||[]).length, nPed=(lay.peds||[]).length;
  if(nL && nPed<nL) add("ped","warn",`${nL-nPed} hall${nL-nPed>1?"s":""} dos elevadores sem faixa de pedestres até o corredor`);
  // 5) PCD com faixa de transferência e perto do hall; idosos perto do hall
  const pcd=lay.vagas.filter(v=>v.tipo==="pcd"), faixas=lay.vagas.filter(v=>v.tipo==="faixa");
  const semF=pcd.filter(v=>!faixas.some(f=>garToca(v.poly,f.poly)));
  if(semF.length) add("pcdFaixa","warn",`${semF.length} vaga${semF.length>1?"s":""} PCD sem a faixa de transferência de 1,20 m`);
  const ref=(lay.peds&&lay.peds[0]&&lay.peds[0].b) || (obst[0]&&G.centroid(obst[0]));
  if(ref && pcd.length){ const dm=Math.max(...pcd.map(v=>Math.hypot(v.c[0]-ref[0],v.c[1]-ref[1]))); if(dm>30) add("pcdLonge","warn",`vaga PCD a ${nf(dm,0)} m do hall dos elevadores`) }
  // 6) becos sem retorno e curvas
  const bl=(lay.becos||[]).filter(b=>b.longo);
  if(bl.length) add("beco","warn",`${bl.length} corredor${bl.length>1?"es":""} sem saída com mais de ${nf(R.beco,0)} m (bolsão de retorno marcado)`);
  if(lay.giroFalha) add("giro","warn",`curva apertada para o raio de giro (${nf(R.Ro,1)} m externo) em ${lay.giroFalha} ponto${lay.giroFalha>1?"s":""}`);
  // 7) eficiência: m² de área bruta por vaga, com o motivo quando passa da meta
  const aObst=obst.reduce((s,p)=>s+garAreaInter(poly,p),0), aRamp=(lay.blocks||[]).reduce((s,p)=>s+garAreaInter(poly,p),0)+(lay.landings||[]).reduce((s,p)=>s+garAreaInter(poly,p),0);
  const m2v = n? area/n : Infinity, util=area-aObst-aRamp, m2u = n? util/n : Infinity;
  const met={area, n, m2v, m2u, aObst, aRamp, util, pctOcup: area? (aObst+aRamp)/area : 0, partido:lay.partido, becos:bl.length};
  if(n && m2v>GAR_META[1]+0.5 && !ctx.terreo){
    const pct_=Math.round(met.pctOcup*100), larg=garLarguraMin(poly);
    const motivo = met.pctOcup>0.22? `núcleos, rampas e patamares ocupam ${pct_}% do pavimento` : larg<2*(2*R.C+R.AI90)? `pavimento estreito (${nf(larg,1)} m): cabe um só módulo de 15,5 m` : `sobras sem vaga (forma ou obstáculos)`;
    met.motivo=motivo; add("m2","warn",`${nf(m2v,1)} m² por vaga (meta ${GAR_META[0]}–${GAR_META[1]}): ${motivo}`) }
  if(!n && area>40) add("vazio","bad","nenhuma vaga coube neste pavimento");
  let nota=100; P.forEach(p=>nota-= p.nivel==="bad"? 25 : 6);
  if(isFinite(m2v) && m2v>GAR_META[1]) nota-=Math.min(20, (m2v-GAR_META[1])*(met.pctOcup>0.22? 0.4 : 1));
  return {nota:Math.max(0,Math.round(nota)), problemas:P, met};
}
function garToca(a,b){ const A=gmBox(a), B=gmBox(b); return A[0]<=B[2]+0.05 && B[0]<=A[2]+0.05 && A[1]<=B[3]+0.05 && B[1]<=A[3]+0.05 }
/* área da interseção de dois polígonos (o segundo convexo) */
function garAreaInter(a, b){ if(!a||!b||a.length<3||b.length<3) return 0; const cb= G.sArea(b)>0? b : b.slice().reverse(); return G.area(G.clipToPoly(a, cb)) }
/* menor largura do pavimento (entre as direções dos lados) */
function garLarguraMin(poly){ let best=Infinity; for(let i=0;i<poly.length;i++){ const a=poly[i], b=poly[(i+1)%poly.length], L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<3) continue; const n=[-(b[1]-a[1])/L,(b[0]-a[0])/L], [x0,x1]=G.extent(poly,n); best=Math.min(best,x1-x0) } return best }

/* ---------- escolha final: confere os melhores candidatos na malha de 0,5 m e monta o layout do pavimento ---------- */
function garModFinal(poly, obst, E, o, M){
  const portals=o.portals||[], blocks=[...obst, ...(o.blocks||[])], keep=o.keep||[], R=M.R;
  const K=o.quick? 2 : 4; let best=null;
  const vistos=new Set();
  for(const {FR, L} of M.cands){
    if(vistos.size>=K) break; if(!L.portaisOk && portals.length) continue;
    const sig=L.stalls.length+":"+L.cfg.ang+":"+L.cfg.aH.toFixed(2)+":"+L.cfg.tag+":"+FR.ux.map(v=>v.toFixed(3)); if(vistos.has(sig)) continue; vistos.add(sig);
    const W=garModMundo(FR, L, R, E, o), lay={...W, _Wd:q=>FR.Wd(q[0],q[1])};
    const ref = W.peds.length? W.peds[0].b : (M.lobbies[0]? G.centroid(M.lobbies[0].poly) : (obst[0]? G.centroid(obst[0]) : G.centroid(poly)));
    garPcdIdoso(lay, E, R, ref);
    // malha: o carro sai do portal e chega à frente de cada vaga, com manobra livre
    const rv=lay.vagas.filter(v=>v.tipo!=="faixa"), Rc=rasterCheck(poly, blocks, rv, lay.pillars, portals, L.AI);
    if(portals.length && !Rc.allConn) continue;
    const ok=new Set(Rc.okV), semRota=rv.filter(v=>!ok.has(v)).length;
    lay.vagas=lay.vagas.filter(v=>v.tipo==="faixa"? lay.vagas.some(p=>p.tipo==="pcd" && ok.has(p) && garToca(p.poly,v.poly)) : ok.has(v));
    const nCar=lay.vagas.filter(v=>garCar(v.tipo)).length;
    const sc=nCar - 0.6*L.becos.filter(b=>b.longo).length - 0.25*L.becos.filter(b=>!b.longo).length - L.peds.reduce((s,p)=>s+(p.falta? 12 : p.L),0)/10;
    if(!best || sc>best.sc) best={sc, FR, L, lay, Rc, semRota} }
  if(!best) return null;
  let {FR, L, lay, Rc}=best;
  const aislePolys=lay.aisles.map(a=>a.poly), pedPolys=lay.peds.filter(p=>p.poly).map(p=>p.poly);
  // sobras: vagas extras de frente para a circulação (sem cortar corredores, faixas e bolsões) e as opções da garagem completa
  const faixas=lay.vagas.filter(v=>v.tipo==="faixa");
  let Lx={vagas:lay.vagas.filter(v=>v.tipo!=="faixa"), pillars:lay.pillars, aisles:[], acc:{}, crosses:[], AI:L.AI, ux:FR.ux, vy:FR.vy, corr:[...aislePolys, ...pedPolys, ...lay.retornos, ...faixas.map(v=>v.poly)]};
  if(!o.quick && !o.semSobras){ const F=infill(poly, blocks, keep, Lx, Rc, E, portals); if(F){ Lx={...Lx, vagas:F.vagas}; Rc=F.R } }
  if(!o.quick && (o.presas || o.motos || o.bici>0)){ const F=extras(poly, blocks, keep, Lx, Rc, E, portals, o); if(F){ Lx={...Lx, vagas:F.vagas}; Rc=F.R } }
  const vagas=[...Lx.vagas, ...faixas].map(v=>{ const {_f, ...r}=v; r.ang=_f? _f.ang : (L.ang||90); return r });
  // rotas: da chegada a cada saída, pela rede de corredores, com o raio de giro nas esquinas
  const routes=[]; for(let i=1;i<portals.length;i++){ const r=garRotaRede(lay, R, portals[0].p, portals[i].p) || rota(Rc, Rc.seeds[0], Rc.seeds[i]); if(r) routes.push({pts:r, de:portals[0].label, para:portals[i].label}) }
  const path=lay.aisles.filter(a=>!a.conn).map(a=>({pts:[a.a, a.b], dir:a.dir||0}));
  // raio de giro nas junções (corredor × transversal) e nos portais (largura do patamar × corredor)
  let giroFalha=0; L.net.forEach(p=>p.adj.forEach(j=>{ if(j<p.i) return; const q=L.net.find(x=>x.i===j); if(q && q.o!==p.o && !garGiroOk(p.w,q.w,R)) giroFalha++ }));
  const lw=(+E.rampaL||3.6)+0.9; (L.att||[]).forEach((l,pi)=>{ const p=L.net.find(x=>l.includes(x.i)); const h=FR.PT[pi]&&FR.PT[pi].h; if(p && h){ const par= p.o==="H"? Math.abs(h[0])>0.7 : Math.abs(h[1])>0.7; if(!par && !garGiroOk(lw,p.w,R)) giroFalha++ } });
  const out={vagas, pillars:lay.pillars, path, routes, ux:FR.ux, vy:FR.vy, ang:L.ang, pitch:L.Wp, aisle:L.AI, ok:true, grid:Rc.grid, reach:Rc.reach, count:vagas.filter(v=>garCar(v.tipo)).length,
    aisles:lay.aisles.map(a=>({poly:a.poly, a:a.a, b:a.b, dir:a.dir, w:a.w, conn:a.conn, o:a.o})), peds:lay.peds, retornos:lay.retornos,
    becos:L.becos.map(b=>({L:b.L, longo:b.longo})), giroFalha, pcd:lay.pcd, modelo:"partido", cfg:L.cfg};
  out.partido=gmPartido({...L, fb:FR.fb});
  const V=garValida({...out, blocks:o.blocks||[], landings:keep, semRota:best.semRota}, {poly, obst, E, gx:o.gx, lobbies:M.lobbies, terreo:o.terreo});
  out.nota=V.nota; out.problemas=V.problemas; out.met=V.met; out.semRota=best.semRota;
  return out;
}
