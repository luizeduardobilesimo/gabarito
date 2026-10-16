/* ================= garagem por partidos: regras, gerador e validação (docs/COMUNS.md §2 e §5) =================
   O mesmo método das plantas (docs/APTOS.md): regras de projeto reais + partidos de mercado + validação com nota e
   motivo. O pavimento é projetado como um projetista de garagem faria, não "preenchido onde couber":
   1. referencial: os corredores principais correm ao longo de uma direção (lados do pavimento, rampa, núcleos);
   2. corredores principais (5,5 m, mão dupla) escolhidos por programação dinâmica na transversal: módulo
      5,0 + 5,5 + 5,0 (fileira · corredor · fileira), fileiras encostadas nas paredes e costas com costas no meio;
   3. transversais (5,5 m) ligam os corredores numa rede contínua — anel, espinha, pente —, com ligação às rampas
      (patamar → corredor) e sem becos longos; as pontas curtas além da última transversal viram fileira junto à parede;
   4. fileiras dos dois lados de cada corredor, com pilares numa malha única (N vagas entre pilares, alinhados nos
      dois lados e em TODOS os pavimentos do mesmo contorno), vaga encostada em parede ou pilar com largura acrescida
      (S.garagem.acrParede/acrPilar — conferir na lei);
   5. faixa de pedestres (1,20 m, zebrada) do hall dos elevadores até o corredor; PCD com faixa de transferência de
      1,20 m (de um lado ou compartilhada por duas) e idosos perto do hall; raio de giro conferido nas esquinas.
   Os subsolos (e as garagens elevadas) com o mesmo contorno são resolvidos JUNTOS: mesmo referencial, mesmos
   corredores e a mesma malha de pilares; só a ligação às rampas e os patamares mudam de um pavimento para o outro.
   Coordenadas do referencial: u ao longo dos corredores principais, v na transversal; tudo por intervalos 1D exatos
   (faixa × polígono), rápido o bastante para testar centenas de arranjos. Nada aqui toca DOM (Worker e testes).
   Entradas: garModGrupo(pisos, obst, E, o) (subsolos juntos) e garModSolve/garModFinal (um pavimento, usado pelo
   garageSolve de src/garagem.js); validação independente: garValida(lay, ctx). */

const GAR_PARTIDOS = {
  simples:   { nome:"Módulo simples",      d:"um corredor de 5,5 m com fileiras dos dois lados (15,5 m)" },
  estreita:  { nome:"Garagem estreita",    d:"um corredor com uma fileira só (10,5 m)" },
  duplo:     { nome:"Módulo duplo",        d:"dois corredores paralelos e quatro fileiras" },
  pente:     { nome:"Corredores em pente", d:"três ou mais corredores ligados por uma transversal" },
  anel:      { nome:"Anel",                d:"corredores ligados nas duas pontas: circulação contínua, sem becos" },
  espinha:   { nome:"Espinha central",     d:"transversal no meio com corredores dos dois lados" },
  inclinado: { nome:"Vagas a 45°/60°",     d:"vagas inclinadas em corredores estreitos de mão única, em anel" },
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
    pcdF:1.2, pcdModo:GX.pcdModo||"auto", inset:1.0, partido:GX.partido||"auto", zonas:GX.zonas||"auto",
  };
}
/* geometria das fileiras para um ângulo: corredor A, profundidade da fileira rd, passo ao longo do corredor Wp */
function garGeo(R, ang){
  const th=ang*Math.PI/180, sn=Math.sin(th), cs= ang===90? 0 : Math.cos(th);
  const A= ang===90? R.AI90 : ang===60? R.AI60 : R.AI45, rd= ang===90? R.C : R.C*sn+R.W*cs, Wp=R.W/sn;
  return {ang, th, sn, cot: ang===90? 0 : cs/sn, A, rd, Wp, AV:R.AI90, Pt:R.nM*Wp+R.PIL+2*R.acrPil, PtV:R.nM*R.W+R.PIL+2*R.acrPil};
}
/* passagem de desvio mais estreita que o corredor (mão única, sem vagas); com a largura cheia é um corredor comum */
const gmEstreita=(p,g)=>!!p.pass && !p.junta && p.w<g.A-0.05;
/* curva possível? giro de 90° entre corredores de larguras w1 e w2 (externo Ro, interno Ri) */
function garGiroOk(w1, w2, R){ const a=Math.max(0,R.Ro-w1), b=Math.max(0,R.Ro-w2); return a*a+b*b <= R.Ri*R.Ri+1e-9 }

/* ---------- intervalos 1D (faixa horizontal × polígono) ---------- */
function gmLineIv(P, v){ const xs=[]; for(let i=0,n=P.length;i<n;i++){ const a=P[i], b=P[(i+1)%n]; if((a[1]>v)!==(b[1]>v)) xs.push(a[0]+(v-a[1])*(b[0]-a[0])/(b[1]-a[1])) }
  xs.sort((x,y)=>x-y); const out=[]; for(let i=0;i+1<xs.length;i+=2) if(xs[i+1]-xs[i]>1e-9) out.push([xs[i],xs[i+1]]); return out }
function gmIvAnd(A,B){ const out=[]; let i=0,j=0; while(i<A.length&&j<B.length){ const a=Math.max(A[i][0],B[j][0]), b=Math.min(A[i][1],B[j][1]); if(b>a+1e-9) out.push([a,b]); if(A[i][1]<B[j][1]) i++; else j++ } return out }
function gmIvSub(A, a, b){ if(!(b>a)) return A; const out=[]; for(const [x,y] of A){ if(b<=x||a>=y){ out.push([x,y]); continue } if(a>x) out.push([x,a]); if(b<y) out.push([b,y]) } return out }
const gmIvLen=I=>I.reduce((s,[a,b])=>s+b-a,0);
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
const gmIsRect=p=>{ if(p.length!==4) return false; const b=gmBox(p); return p.every(q=>(Math.abs(q[0]-b[0])<1e-6||Math.abs(q[0]-b[2])<1e-6)&&(Math.abs(q[1]-b[1])<1e-6||Math.abs(q[1]-b[3])<1e-6)) };
const gmOb=(p,k)=>({p, b:gmBox(p), k, rect:gmIsRect(p)});
const gmHit=(a,b,t=1e-6)=>a[0]<b[2]-t&&b[0]<a[2]-t&&a[1]<b[3]-t&&b[1]<a[3]-t;

/* ---------- referencial de um candidato (orientação ux) ----------
   pisos = [{keep, portals, blocks}] (um por pavimento do grupo; os obstáculos duros são comuns a todos) */
function gmFrame(ux, poly, obst, pisos, lobbies, zonas){
  const vy=[-ux[1],ux[0]], F=q=>[q[0]*ux[0]+q[1]*ux[1], q[0]*vy[0]+q[1]*vy[1]], Wd=(u,v)=>[ux[0]*u+vy[0]*v, ux[1]*u+vy[1]*v];
  const Fp=poly.map(F), blocks=[]; pisos.forEach(f=>(f.blocks||[]).forEach(b=>{ if(!blocks.includes(b)) blocks.push(b) }));
  const OB=[...obst.map(p=>gmOb(p.map(F),"nucleo")), ...blocks.map(p=>gmOb(p.map(F),"rampa"))];
  // faixas inclinadas (zonas): a faixa inteira (fileira + corredor) é obstáculo para o referencial principal
  (zonas||[]).forEach(z=>z.pcs.forEach(pc=>OB.push(gmOb(pc.reg.map(F),"zona"))));
  const fb=gmBox(Fp), sw=o=>gmOb(gmSw(o.p),o.k);
  const fl=pisos.map(f=>{ const KP=(f.keep||[]).map(p=>gmOb(p.map(F),"patamar"));
    const PT=(f.portals||[]).map(pt=>{ const p=F(pt.p), h=[G.dot(pt.heading,ux), G.dot(pt.heading,vy)], d= pt.tipo==="sai"? [-h[0],-h[1]] : h;
      const lk=KP.find(k=>p[0]>=k.b[0]-0.05&&p[0]<=k.b[2]+0.05&&p[1]>=k.b[1]-0.05&&p[1]<=k.b[3]+0.05);
      return {p, h, d, mouth:[p[0]+d[0]*1.4, p[1]+d[1]*1.4], land: lk? lk.b : [p[0]-1.5,p[1]-1.5,p[0]+1.5,p[1]+1.5], src:pt} });
    return {KP, KPv:KP.map(sw), PT} });
  const FR={ux, vy, F, Wd, Fp, fb, OB, H:{F:Fp, OB}, V:{F:gmSw(Fp), OB:OB.map(sw)}, fl,
    LB: lobbies.map(l=>({p:l.poly.map(F), b:gmBox(l.poly.map(F)), portas:(l.portas||[]).map(F)}))};
  if(zonas && zonas.length){ FR.Z=zonas; FR._zc=new Map();
    // sem as zonas (sobras medidas no pavimento inteiro)
    const OB0=OB.filter(o=>o.k!=="zona"); FR.H0={F:Fp, OB:OB0}; FR.V0={F:gmSw(Fp), OB:OB0.map(sw)};
    FR.Zp=[]; zonas.forEach((z,zk)=>z.pcs.forEach(pc=>{ const pm=pc.pw.map(F); FR.Zp.push({pc, z, zk, pm, r:gmBox(pm), bm:pc.band.map(F), gm:pc.reg.map(F)}) })) }
  return FR;
}

/* ---------- zonas inclinadas: faixas coladas às paredes que não seguem o referencial ----------
   Parede longa inclinada em relação ao referencial principal (cunha de pelo menos meia vaga ao longo dela) ganha uma
   faixa no referencial da própria parede: fileira com as costas na parede (vagas a 90° — ou o ângulo escolhido —
   medidas em relação a ela, com os pilares alinhados à faixa) e corredor paralelo à parede. A faixa é obstáculo para o
   referencial principal; os corredores (e transversais) que chegam a ela se ligam ao corredor inclinado por uma junção
   (o triângulo entre a ponta reta e o corredor inclinado), e a rede inteira — reta e inclinada — é uma só. */
const GM_Z={Lmin:12, graus:3, cunha:2.5, angJ:35};
function gmParedesZ(poly, ux, Lmin){
  const out=[], ccw=G.sArea(poly)>0, vy=[-ux[1],ux[0]];
  for(let i=0;i<poly.length;i++){ const a=poly[i], b=poly[(i+1)%poly.length], L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<(Lmin||GM_Z.Lmin)) continue;
    const d=[(b[0]-a[0])/L,(b[1]-a[1])/L], dg=Math.min(Math.acos(Math.min(1,Math.abs(G.dot(d,ux)))), Math.acos(Math.min(1,Math.abs(G.dot(d,vy)))));
    if(dg*180/Math.PI<GM_Z.graus || (!Lmin && L*Math.tan(dg)<GM_Z.cunha)) continue;
    out.push({i, a, b, L, graus:dg*180/Math.PI, uz: ccw? d : [-d[0],-d[1]]}) }   // uz com o interior à esquerda (vy da zona para dentro)
  return out.sort((p,q)=>q.L-p.L);
}
/* uma zona: corredor paralelo à parede a rd dela (peças livres de núcleo e rampa), fileira entre o corredor e a parede
   e, na zona dupla ("d"), outra fileira do lado de dentro (módulo 5,0 + 5,5 + 5,0 inclinado); os corredores retos que
   chegam a ela atravessam essa fileira de dentro (as vagas no caminho saem) */
function gmZona(w, poly, obst, pisos, lobbies, R, g, tipo){
  const FRz=gmFrame(w.uz, poly, obst, pisos, lobbies), vw=FRz.F(w.a)[1], y0=vw+g.rd, y1=y0+g.A, D=g.rd+g.A, yr= tipo==="d"? y1+g.rd : y1;
  const ua=Math.min(FRz.F(w.a)[0], FRz.F(w.b)[0]), ub=Math.max(FRz.F(w.a)[0], FRz.F(w.b)[0]), Wd=(u,v)=>FRz.Wd(u,v);
  const rW=r=>[[r[0],r[1]],[r[2],r[1]],[r[2],r[3]],[r[0],r[3]]].map(q=>Wd(q[0],q[1])), pcs=[];
  const I=gmHard(FRz.H, y0+0.05, y1-0.05);
  I.forEach(([a,b])=>{
    a=Math.max(a, ua-2*D); b=Math.min(b, ub+2*D); if(Math.min(b,ub)-Math.max(a,ua)<3*g.Wp || b-a<3*g.Wp) return;
    const Hh=gmIvAnd(gmHard(FRz.H, vw+0.02, y0), [[a,b]]); if(gmIvLen(Hh)<3*g.Wp) return;
    const a1=Hh[0][0], gu=a1+R.acrP-R.PIL/2-R.acrPil;
    pcs.push({a, b, y0, y1, gu, pw:rW([a,y0,b,y1]), reg:rW([a,vw-0.3,b,yr]), band:rW([a,vw-0.3,b,y0])}) });
  return {w, FRz, uz:w.uz, vy:FRz.vy, vw, pcs, graus:w.graus, tipo: tipo==="d"? "d" : "s"};
}
/* peças das zonas para uma avaliação (cópias: recebem índice e ligações) */
function gmZPecas(FR, g){
  return (FR.Zp||[]).map(t=>({o:"Z", z:t.z, zk:t.zk, pc:t.pc, a:t.pc.a, b:t.pc.b, y0:t.pc.y0, y1:t.pc.y1, w:g.A, dir:0, gu:t.pc.gu, pw:t.pc.pw, pm:t.pm, bm:t.bm, gm:t.gm, r:t.r, lig:[], FRW:q=>FR.Wd(q[0],q[1])}));
}
/* junções: ponta de corredor (ou transversal) que chega a um corredor inclinado; o trecho até ele precisa estar livre */
function gmJuncoes(FR, R, g, pcs, Zs){
  const out=[], cmax=Math.cos(GM_Z.angJ*Math.PI/180);
  pcs.forEach(p=>{ if(p.pass || p.conn || (p.o!=="H" && p.o!=="V")) return; const H_=p.o==="H", Lv= H_? FR.H0 : FR.V0, ax= H_? FR.ux : FR.vy, toV= H_? (q=>q) : (q=>[q[1],q[0]]);
    // o trecho da ponta até o corredor inclinado: livre de paredes, núcleos e rampas, fora da fileira junto à parede e de
    // outras zonas (a fileira de dentro da zona dupla é atravessada: as vagas no caminho saem)
    const corta=(pg,c,x0,x1)=>gmLineIv(pg.map(toV), c).some(([s0,s1])=>Math.min(s1,x1)-Math.max(s0,x0)>0.05);
    [-1,1].forEach(sg=>{ const e= sg>0? p.b : p.a; let best=null;
      Zs.forEach(z=>{ if(Math.abs(G.dot(ax, z.z.uz))>cmax) return;
        const zv=z.pm.map(toV); let ext=-Infinity;
        for(const c of [p.y0+0.2, (p.y0+p.y1)/2, p.y1-0.2]){
          const iv=gmLineIv(zv, c).filter(([s0,s1])=> sg>0? s1>e+0.3 : s0<e-0.3); if(!iv.length) return;
          const it= sg>0? iv.reduce((m,x)=>x[0]<m[0]? x : m) : iv.reduce((m,x)=>x[1]>m[1]? x : m);
          const ent= sg>0? Math.max(e, it[0]) : Math.min(e, it[1]), x0=Math.min(e,ent), x1=Math.max(e,ent);
          const fr=gmHard(Lv, c-0.1, c+0.1).find(([a0,a1])=>a0<=e+0.05 && a1>=e-0.05);
          if(!fr || (sg>0? fr[1]<ent-0.15 : fr[0]>ent+0.15)) return;
          if(corta(z.bm, c, x0, x1) || Zs.some(o=>o.zk!==z.zk && corta(o.gm, c, x0, x1))) return;
          const deep= sg>0? Math.min(ent+0.5, it[1]-0.3) : Math.max(ent-0.5, it[0]+0.3);
          ext=Math.max(ext, (deep-e)*sg) }
        const cs=Math.abs(G.dot(ax, z.z.uz)), sn=Math.sqrt(1-cs*cs), lim=g.A*cs/sn+1.5+(z.z.tipo==="d"? g.rd/sn : 0)+(H_? 0 : g.rd+0.5);
        if(!(ext>0) || ext>lim) return;
        if(!best || ext<best.ext) best={z, ext} });
      if(!best) return;
      const z=best.z, x0=Math.min(e, e+sg*best.ext), x1=Math.max(e, e+sg*best.ext), rv=[x0,p.y0,x1,p.y1], r= H_? rv : gmRectSw(rv);
      const rw=[[r[0],r[1]],[r[2],r[1]],[r[2],r[3]],[r[0],r[3]]].map(q=>FR.Wd(q[0],q[1]));
      const P0=z.z.FRz.Wd(0, z.y0), pw=G.clipHalf(rw, P0, z.z.vy); if(pw.length<3) return;
      const mid=(p.y0+p.y1)/2, aW=FR.Wd(...(H_? [e,mid] : [mid,e])), d=[ax[0]*sg, ax[1]*sg], Q=z.z.FRz.Wd(0,(z.y0+z.y1)/2), uz=z.z.uz;
      const den=d[0]*uz[1]-d[1]*uz[0], t= Math.abs(den)>1e-9? ((Q[0]-aW[0])*uz[1]-(Q[1]-aW[1])*uz[0])/den : best.ext;
      const bW=[aW[0]+d[0]*clamp(t, 0.5, best.ext+g.A), aW[1]+d[1]*clamp(t, 0.5, best.ext+g.A)];
      const J={o:"J", jz:true, conn:true, r, pw, pm:pw.map(FR.F), aW, bW, w:p.w, dir:0, lig:[p, z]};
      (p.lig=p.lig||[]).push(J); z.lig.push(J); if(sg>0) p.jB=true; else p.jA=true; out.push(J) }) });
  // corredores inclinados que se cruzam num canto (paredes inclinadas vizinhas)
  for(let i=0;i<Zs.length;i++) for(let j=i+1;j<Zs.length;j++) if(Zs[i].zk!==Zs[j].zk && garAreaInter(Zs[i].pw, Zs[j].pw)>1.5){ Zs[i].lig.push(Zs[j]); Zs[j].lig.push(Zs[i]) }
  return out;
}
/* trecho de uma peça inclinada tocado por um polígono (no eixo da zona) */
function gmZProj(p, pw){ const u=pw.map(q=>G.dot(q,p.z.uz)); return [Math.max(p.a, Math.min(...u)), Math.min(p.b, Math.max(...u))] }
/* fileira da zona (costas na parede), com cache por avaliação; vagas que cruzam outra zona saem (a mais longa vence) */
function gmZFila(FR, R, g, zp, fi, opt){
  const pil=!!opt.pil, k=zp.zk+":"+zp.a.toFixed(2)+":"+fi+":"+(pil?1:0)+":"+(opt.aprox?1:0); let C=FR._zc.get(k);
  if(!C){ const z=zp.z, o={stalls:[], pil: pil? [] : null}, pc={o:"H", a:zp.a, b:zp.b, y0:zp.y0, y1:zp.y1, dir:0, i:-1}, cx={V:false, soft:[], stalls:o.stalls, KP:z.FRz.fl[fi].KP, gu:zp.gu, gv:0, aprox:!!opt.aprox};
    gmFila(z.FRz.H, R, g, pc, -1, cx, o); if(z.tipo==="d") gmFila(z.FRz.H, R, g, pc, 1, cx, o);
    const Wz=q=>z.FRz.Wd(q[0],q[1]), outros=FR.Z.map((oz,ok)=>ok===zp.zk? null : {ok, pol: oz.pcs.map(pc=> ok<zp.zk? pc.reg : pc.pw)}).filter(Boolean);
    const livre=pg=>{ const b=gmBox(pg); return !outros.some(x=>x.pol.some(q=>gmHit(b, gmBox(q), 0.01) && garAreaInter(pg, q)>0.05)) };
    const st=o.stalls.map(s=>{ const w=s.loc.map(Wz); return {...s, zf:z.FRz, zk:zp.zk, zw:z.w.i, w, wb:gmBox(w)} }).filter(s=>livre(s.w));
    const pl=(o.pil||[]).map(p=>[[p.r[0],p.r[1]],[p.r[2],p.r[1]],[p.r[2],p.r[3]],[p.r[0],p.r[3]]].map(Wz)).filter(livre);
    C={st, pl}; FR._zc.set(k, C) }
  return C;
}
/* faixa livre (dentro do pavimento, fora de núcleos e rampas) numa vista (H ou V), com cache */
function gmHard(Lv, ya, yb){ const k=ya.toFixed(3)+":"+yb.toFixed(3); Lv._c=Lv._c||new Map(); let I=Lv._c.get(k);
  if(!I){ I=gmBandIv(Lv.F, ya, yb); for(const o of Lv.OB){ const r=gmBandRange(o, ya, yb); if(r) I=gmIvSub(I, r[0]-1e-6, r[1]+1e-6) } Lv._c.set(k,I) } return I }
const gmKPsub=(I, KP, ya, yb)=>{ for(const o of KP){ const r=gmBandRange(o, ya, yb); if(r) I=gmIvSub(I, r[0]-1e-6, r[1]+1e-6) } return I };

/* ---------- 1. corredores principais: programação dinâmica na transversal (K melhores) ---------- */
function gmCorredores(FR, R, g, K){
  const [X0,Y0,X1,Y1]=FR.fb, A=g.A, rd=g.rd, KPall=[]; FR.fl.forEach(f=>f.KP.forEach(k=>KPall.push(k)));
  const per=g.Wp+(R.PIL+2*R.acrPil)/R.nM, cnt=I=>I.reduce((s,[a,b])=>s+Math.max(0,Math.floor((b-a+0.02)/per)),0);
  // posições: malha de 0,25 m + alinhamentos exatos (paredes, núcleos, rampas, patamares, halls, portais)
  const P=[]; for(let y=Y0; y<=Y1-A+1e-6; y+=0.25) P.push(y);
  const anc=[Y0, Y1-A, Y0+rd, Y1-rd-A, Y0+2*rd, Y1-2*rd-A];
  FR.OB.forEach(o=>anc.push(o.b[1]-A, o.b[3], o.b[1]-rd-A, o.b[3]+rd));
  KPall.forEach(o=>anc.push(o.b[1]-A, o.b[3], o.b[1], o.b[3]-A));
  FR.LB.forEach(l=>anc.push(l.b[1]-A, l.b[3]));
  FR.fl.forEach(f=>f.PT.forEach(pt=>anc.push(pt.mouth[1]-A/2, pt.land[1], pt.land[3]-A)));
  anc.forEach(y=>{ if(y>=Y0-1e-6 && y<=Y1-A+1e-6) P.push(y) });
  P.sort((a,b)=>a-b); const ys=P.filter((y,i)=>!i || y-P[i-1]>0.04);
  const N=ys.length, aIv=[], rDn=new Float64Array(N), rUp=new Float64Array(N), ok=new Uint8Array(N), pcs=new Uint8Array(N);
  const PTall=[]; FR.fl.forEach(f=>f.PT.forEach(pt=>PTall.push(pt)));
  const bon=new Float64Array(N);
  ys.forEach((y,i)=>{ const I=gmHard(FR.H, y+0.05, y+A-0.05).filter(([a,b])=>b-a>=2*R.W); aIv.push(I); if(!I.length) return; ok[i]=1; pcs[i]=I.length;
    PTall.forEach(pt=>{ if(I.some(([a,b])=>gmToca(pt.land, [a,y,b,y+A]))) bon[i]+=1.5 });
    rDn[i]=cnt(gmKPsub(gmIvAnd(gmHard(FR.H, y-rd, y), I), KPall, y-rd, y));
    rUp[i]=cnt(gmKPsub(gmIvAnd(gmHard(FR.H, y+A, y+A+rd), I), KPall, y+A, y+A+rd)) });
  // f[i] = K melhores [valor, j, r] terminando com corredor em i (o valor inclui a fileira de baixo de i)
  const f=ys.map(()=>[]), push=(L,v,j,r)=>{ if(L.length<K || v>L[L.length-1][0]){ L.push([v,j,r]); L.sort((a,b)=>b[0]-a[0]); if(L.length>K) L.pop() } };
  const pen=i=>0.6*Math.max(0,pcs[i]-1)-bon[i];
  for(let i=0;i<N;i++){ if(!ok[i]) continue; push(f[i], rDn[i]-pen(i), -1, -1);
    for(let j=0;j<i;j++){ if(!ok[j] || !f[j].length) continue; const gap=ys[i]-ys[j]-A; if(gap<rd-0.01 || gap>2*rd+14) continue;
      const add= gap>=2*rd-0.01? rUp[j]+rDn[i] : Math.max(rUp[j],rDn[i]);
      f[j].forEach((e,r)=>push(f[i], e[0]+add-pen(i), j, r)) } }
  const fins=[]; for(let i=0;i<N;i++) f[i].forEach((e,r)=>fins.push([e[0]+rUp[i], i, r]));
  fins.sort((a,b)=>b[0]-a[0]);
  const out=[], vistos=new Set();
  for(const [v,i,r] of fins){ if(out.length>=K) break; const seq=[]; let ii=i, rr=r; while(ii>=0){ seq.unshift(ys[ii]); const e=f[ii][rr]; ii=e[1]; rr=e[2] }
    const key=seq.map(y=>Math.round(y*2)).join(","); if(vistos.has(key)) continue; vistos.add(key); out.push({ys:seq, est:v}) }
  return out;
}

/* ---------- 2. rede: corredores, transversais e ligações às rampas ---------- */
const gmRect=p=> p.r? p.r : p.o==="H"? [p.a,p.y0,p.b,p.y1] : [p.y0,p.a,p.y1,p.b];   // retângulo no referencial (u0,v0,u1,v1); junções e zonas: caixa
const gmReta=p=>p.o==="H"||p.o==="V";
/* retângulo (referencial) encostado num polígono convexo (referencial) ao longo de pelo menos 2,4 m */
function gmTocaPg(r, pg, t=0.15){ const q=[[r[0]-t,r[1]-t],[r[2]+t,r[1]-t],[r[2]+t,r[3]+t],[r[0]-t,r[3]+t]], b=gmBox(pg); if(!gmHit(gmBox(q), b, 0)) return false;
  const c=G.clipToPoly(q, G.sArea(pg)>0? pg : pg.slice().reverse()); if(c.length<3) return false; const bb=gmBox(c); return Math.max(bb[2]-bb[0], bb[3]-bb[1])>=2.4 && G.area(c)>0.3 }
/* distância entre retângulos e sobreposição ao longo da face comum */
function gmToca(a, b, t=0.15){ const gu=Math.max(a[0]-b[2], b[0]-a[2]), gv=Math.max(a[1]-b[3], b[1]-a[3]), ou=Math.min(a[2],b[2])-Math.max(a[0],b[0]), ov=Math.min(a[3],b[3])-Math.max(a[1],b[1]);
  if(ou>=2.4 && ov>=2.4) return true; if(gu<=t && gu>=-t && ov>=2.4) return true; if(gv<=t && gv>=-t && ou>=2.4) return true; return false }
/* transversais candidatas (u da face esquerda) */
function gmTransvCand(FR, R, g, Hs){
  const AV=g.AV, xs=[];
  const [X0,,X1]=FR.fb;
  Hs.forEach(p=>{ xs.push(p.a, p.b-AV, p.a+g.rd, p.b-g.rd-AV) });
  FR.OB.forEach(o=>xs.push(o.b[0]-AV, o.b[2]));
  FR.LB.forEach(l=>xs.push(l.b[0]-AV, l.b[2]));
  FR.fl.forEach(f=>{ f.PT.forEach(pt=>xs.push(pt.mouth[0]-AV/2, pt.land[0]-AV, pt.land[2])); f.KP.forEach(k=>xs.push(k.b[0], k.b[2]-AV)) });
  const us=Hs.length? [Math.min(...Hs.map(p=>p.a)), Math.max(...Hs.map(p=>p.b))] : [X0,X1]; xs.push((us[0]+us[1])/2-AV/2);
  const out=[]; xs.sort((a,b)=>a-b).forEach(x=>{ if(x<X0-0.01 || x+AV>X1+0.01) return; if(out.some(y=>Math.abs(y-x)<0.3)) return; out.push(x) });
  return out;
}
/* peças de uma transversal em x: trechos livres em v que atravessam por inteiro os corredores que tocam */
function gmTransv(FR, R, g, Hs, x, ramal){
  const AV=g.AV, I=gmHard(FR.V, x+0.05, x+AV-0.05), out=[];
  I.forEach(([a,b])=>{ const tc=Hs.filter(p=>p.a<=x+AV-2.4 && p.b>=x+2.4 && p.y0>=a-0.01 && p.y1<=b+0.01); if(!tc.length) return;
    let lo=Math.min(...tc.map(p=>p.y0)), hi=Math.max(...tc.map(p=>p.y1)), port=false;
    FR.fl.forEach(f=>f.PT.forEach(pt=>{ const L=pt.land; if(L[2]<x-0.15 || L[0]>x+AV+0.15) return; const c=(L[1]+L[3])/2; if(c<a || c>b) return; port=true; lo=Math.min(lo, Math.max(a, L[1])); hi=Math.max(hi, Math.min(b, L[3])) }));
    if(tc.length<2 && !port){
      // ramal sem saída (até o limite de beco) a partir de um corredor só: atende sobras grandes longe da rede
      if(!ramal || tc.length!==1) return; const h=tc[0], lo2=Math.max(a, h.y0-R.beco), hi2=Math.min(b, h.y1+R.beco);
      if(h.y0-lo2<g.rd+1 && hi2-h.y1<g.rd+1) return;
      out.push({o:"V", a:lo2, b:hi2, y0:x, y1:x+AV, w:AV, x, tc:0.5, ramal:true}); return }
    out.push({o:"V", a:lo, b:hi, y0:x, y1:x+AV, w:AV, x, tc:tc.length}) });
  return out;
}
/* ligação de cada portal à rede (por pavimento): o patamar encostado num corredor ou um trecho reto até ele */
function gmLigaPortais(FR, R, g, net, f){
  const att=[], conns=[];
  f.PT.forEach((pt,pi)=>{
    const L=pt.land, a=[]; net.forEach((p,i)=>{ if(p.o==="Z"? gmTocaPg(L, p.pm) : gmToca(L, gmRect(p))) a.push(i) });
    if(!a.length){ let best=null; const A=g.AV, h=A/2;
      const dirs=[pt.d, [-pt.d[1],pt.d[0]], [pt.d[1],-pt.d[0]]];
      dirs.forEach((d,di)=>{ const ax=Math.abs(d[0])>=Math.abs(d[1])? 0 : 1, ox=1-ax, sg=Math.sign(d[ax])||1;
        const o= di? [(L[0]+L[2])/2,(L[1]+L[3])/2] : pt.mouth;            // de frente: pela boca; de lado: pelo meio do patamar
        const s0= di? (sg>0? L[ax+2] : L[ax]) : o[ax];
        // de frente, a ligação tem a largura do patamar (o carro segue reto até o corredor); de lado, a de um corredor
        const hh= di? h : Math.max(1.5, Math.min(h, (L[ox+2]-L[ox])/2)), lo=o[ox]-hh, hi=o[ox]+hh;
        net.forEach((p,i)=>{ if(!gmReta(p)) return; const r=gmRect(p); if(Math.min(hi,r[ox+2])-Math.max(lo,r[ox])<2.4) return;
          const near= sg>0? r[ax] : r[ax+2]; const Ln=(near-s0)*sg; if(Ln< -0.05) return; if(best && Ln>=best.L) return;
          const fim=near+sg*Math.min(r[ax+2]-r[ax], A), cr=[0,0,0,0]; cr[ax]=Math.min(s0,fim); cr[ax+2]=Math.max(s0,fim); cr[ox]=lo; cr[ox+2]=hi;
          // o trecho do patamar até a peça precisa estar livre de núcleo e rampa
          const chk=cr.slice(); if(sg>0) chk[ax+2]=near; else chk[ax]=near;
          if(Ln>0.05){ const I= ax===0? gmHard(FR.H, chk[1], chk[3]) : gmHard(FR.V, chk[0], chk[2]); const lo2= ax===0? chk[0] : chk[1], hi2= ax===0? chk[2] : chk[3]; if(!I.some(([x0,x1])=>x0<=lo2+1e-6 && x1>=hi2-1e-6)) return }
          best={L:Ln, i, cr, o: ax===0? "H" : "V"} });
        // corredor inclinado de uma zona: trecho reto do patamar até ele (livre de paredes, núcleos e rampas, fora da
        // fileira junto à parede e das outras zonas)
        if(FR.Z) net.forEach((p,i)=>{ if(p.o!=="Z") return;
          for(let Ln=0; Ln<=10 && (!best || Ln<best.L); Ln+=0.25){ const fim=s0+sg*(Ln+0.6), cr=[0,0,0,0]; cr[ax]=Math.min(s0,fim); cr[ax+2]=Math.max(s0,fim); cr[ox]=lo; cr[ox+2]=hi;
            if(!gmTocaPg(cr, p.pm, 0.05)) continue;
            const crp=[[cr[0],cr[1]],[cr[2],cr[1]],[cr[2],cr[3]],[cr[0],cr[3]]], ccw=q=>G.sArea(q)>0? q : q.slice().reverse();
            if(net.some(o=>o.o==="Z" && o.zk!==p.zk && G.area(G.clipToPoly(crp, ccw(o.gm)))>0.3)) break;   // a da parede pode ser atravessada (as vagas no caminho saem)
            const I= ax===0? (FR.H0||FR.H) : (FR.V0||FR.V), J_= ax===0? gmHard(I, cr[1]+0.05, cr[3]-0.05) : gmHard(I, cr[0]+0.05, cr[2]-0.05), lo2=cr[ax]+0.2, hi2=Math.max(cr[ax]+0.2, cr[ax+2]-0.6);
            if(Ln>0.05 && !J_.some(([x0,x1])=>x0<=lo2+1e-6 && x1>=hi2-1e-6)) break;
            best={L:Ln, i, cr, o: ax===0? "H" : "V", z:p}; break } }) });
      if(best){ const c=best.cr, np= best.o==="H"? {o:"H", a:c[0], b:c[2], y0:c[1], y1:c[3], w:c[3]-c[1], conn:true} : {o:"V", a:c[1], b:c[3], y0:c[0], y1:c[2], w:c[2]-c[0], conn:true};
        if(best.z){ np.lig=[best.z]; np.pw=[[c[0],c[1]],[c[2],c[1]],[c[2],c[3]],[c[0],c[3]]].map(q=>FR.Wd(q[0],q[1])) }
        conns.push(np); a.push(-conns.length) } }
    att.push(a) });
  return {att, conns};
}
/* grafo: quem o carro alcança a partir do primeiro portal (ou da maior peça) */
function gmAlcance(pcs, att){
  const n=pcs.length, R_=pcs.map(gmRect), adj=pcs.map(()=>[]);
  for(let i=0;i<n;i++) for(let j=i+1;j<n;j++) if(pcs[i].o!=="Z" && pcs[j].o!=="Z" && gmToca(R_[i],R_[j],0.05)){ adj[i].push(j); adj[j].push(i) }
  // ligações explícitas (junções com as zonas inclinadas e cantos entre zonas)
  pcs.forEach((p,i)=>(p.lig||[]).forEach(q=>{ const j=pcs.indexOf(q); if(j>=0 && j!==i && !adj[i].includes(j)){ adj[i].push(j); adj[j].push(i) } }));
  const reach=new Uint8Array(n), q=[];
  if(att.length){ (att[0]||[]).forEach(i=>{ if(!reach[i]){ reach[i]=1; q.push(i) } }) }
  else if(n){ let bi=0; pcs.forEach((p,i)=>{ if(p.b-p.a>pcs[bi].b-pcs[bi].a) bi=i }); reach[bi]=1; q.push(bi) }
  for(let h=0;h<q.length;h++) adj[q[h]].forEach(j=>{ if(!reach[j]){ reach[j]=1; q.push(j) } });
  return {reach, adj, ok: att.every(l=>l.some(i=>reach[i]))};
}

/* ---------- 3. fileiras com a malha de pilares ----------
   Lv = vista (H ou V); p = peça (corredor) na vista; side -1/+1; ctx = {soft, stalls, KP, g0, ...}.
   Devolve as vagas (retângulos/paralelogramos na vista) e os pilares candidatos. */
function gmFila(Lv, R, g, p, side, ctx, out){
  const V_=ctx.V, ang= V_? 90 : g.ang, rd= V_? R.C : g.rd, Wp= V_? R.W : g.Wp, cot= V_? 0 : g.cot, Pt= V_? g.PtV : g.Pt, g0= V_? ctx.gv : ctx.gu;
  const e= side>0? p.y1 : p.y0, ya=Math.min(e, e+side*rd), yb=Math.max(e, e+side*rd);
  const Hh=gmHard(Lv, ya, yb); if(!Hh.length) return;
  let I=gmIvAnd(Hh, [[p.a, p.b]]);
  const sub=r=>{ if(r[3]<=ya+1e-6 || r[1]>=yb-1e-6) return; I=gmIvSub(I, r[0]-1e-6, r[2]+1e-6) };
  ctx.soft.forEach(sub); ctx.stalls.forEach(s=>sub(s.r)); I=gmKPsub(I, ctx.KP, ya, yb);
  // folga de 0,25 m dos núcleos (pilares de canto e espessura das paredes não invadem a vaga)
  for(const o of Lv.OB){ if(o.k!=="nucleo") continue; const r=gmBandRange(o, ya-0.25, yb+0.25); if(r) I=gmIvSub(I, r[0]-0.25, r[1]+0.25) }
  if(!I.length) return;
  // ponta dura = parede, núcleo ou rampa (largura acrescida); a borda de uma zona inclinada é circulação ou vaga, não parede
  const zr=Lv.OB.some(o=>o.k==="zona")? Lv.OB.filter(o=>o.k==="zona").map(o=>gmBandRange(o, ya, yb)).filter(Boolean) : [];
  const isHard=x=>Hh.some(([a,b])=>Math.abs(a-x)<1e-5||Math.abs(b-x)<1e-5) && !zr.some(r=>Math.abs(r[0]-x)<0.02||Math.abs(r[1]-x)<0.02);
  const t= p.dir||1, sh=t*rd*cot, f0=Math.min(0,sh), f1=Math.max(0,sh);
  I.forEach(([a,b])=>{ if(b-a<Wp-1e-6) return; const wa=isHard(a)? R.acrP : 0, wb=isHard(b)? R.acrP : 0, row=[];
    const k0=Math.floor((a-g0)/Pt)-1, k1=Math.ceil((b-g0)/Pt)+1;
    for(let k=k0;k<=k1;k++) for(let j=0;j<R.nM;j++){ const s=g0+k*Pt+R.PIL/2+R.acrPil+j*Wp;
      if(s+f0 < a+wa-1e-6 || s+Wp+f1 > b-wb+1e-6) continue;
      // largura acrescida junto de parede (wa/wb) e de pilar (pontas do grupo)
      const xl = s - (wa && s+f0-a-wa<0.6? wa : (j===0? R.acrPil : 0)), xr = s+Wp + (wb && b-wb-(s+Wp+f1)<0.6? wb : (j===R.nM-1? R.acrPil : 0));
      row.push({k, j, s, xl:Math.max(a-f0, Math.min(s, xl)), xr:Math.min(b-f1, Math.max(s+Wp, xr))}) }
    // a malha não encaixa no trecho (curto ou desalinhado): vagas corridas, encostadas na ponta dura, sem pilar
    // a malha não encaixa num trecho curto (até 3 módulos): vagas corridas a partir da ponta dura, com pilares próprios a cada N vagas
    const Gp=R.PIL+2*R.acrPil, cab=b-a-wa-wb-Math.abs(sh); let nLiv=0; while((nLiv+1)*Wp+Math.floor(nLiv/R.nM)*Gp<=cab+1e-6) nLiv++;
    if(nLiv>row.length && (ctx.aprox || b-a<3*Pt)){ row.length=0; const usa=nLiv*Wp+Math.floor((nLiv-1)/R.nM)*Gp, x0= wb && !wa? b-wb-Math.abs(sh)-usa-f0 : a+wa-f0;
      for(let j=0;j<nLiv;j++){ const gi=Math.floor(j/R.nM), s=x0+j*Wp+gi*Gp, pe=j%R.nM===0 && j>0, pd=j%R.nM===R.nM-1 && j<nLiv-1;
        row.push({k:"L"+Math.round(a*10)+"_"+gi, j:j%R.nM, liv:true, pil: pe? s-R.acrPil-R.PIL/2 : null, s, xl: pe? s-R.acrPil : (j===0 && wa? s-wa : s), xr: pd? s+Wp+R.acrPil : (j===nLiv-1 && wb? Math.min(b-f1, s+Wp+wb) : s+Wp)}) } }
    row.forEach(z=>{ const loc=[[z.xl,e],[z.xr,e],[z.xr+sh,e+side*rd],[z.xl+sh,e+side*rd]];
      const r=[Math.min(z.xl,z.xl+sh), ya, Math.max(z.xr,z.xr+sh), yb];
      out.stalls.push({loc, r, e, side, o:V_? "V":"H", piece:p.i, grp:z.k, j:z.j, W:z.xr-z.xl, ang, u:z.s, uc:(z.xl+z.xr)/2+sh/2, sh, t}) });
    if(R.PIL>0 && out.pil) row.forEach(z=>{ if(z.pil==null) return; const d0=Math.min(R.inset, rd-R.PIL-0.2), y0=e+side*d0, y1=e+side*(d0+R.PIL), xs=z.pil+t*cot*(d0+R.PIL/2);
      out.pil.push({r:[xs-R.PIL/2, Math.min(y0,y1), xs+R.PIL/2, Math.max(y0,y1)], V:V_, k:z.k}) });
    if(R.PIL>0 && out.pil){ const ks=new Set(); row.forEach(z=>{ if(z.liv) return; if(z.j===0) ks.add(z.k); if(z.j===R.nM-1) ks.add(z.k+1) });
      ks.forEach(k=>{ const x=g0+k*Pt, d0=Math.min(R.inset, rd-R.PIL-0.2), y0=e+side*d0, y1=e+side*(d0+R.PIL), xs=x+t*cot*(d0+R.PIL/2);
        const r=[xs-R.PIL/2, Math.min(y0,y1), xs+R.PIL/2, Math.max(y0,y1)];
        if(!Hh.some(([a2,b2])=>a2<=r[0]+1e-6 && b2>=r[2]-1e-6)) return;
        out.pil.push({r, V:V_, k}) }) } });
}

/* avaliação de uma estrutura (corredores ys + transversais xs) em todos os pavimentos do grupo */
function gmAvalia(FR, R, g, ys, xs, opt={}){
  const A=g.A, AV=g.AV;
  // corredores principais (peças) — mão dupla a 90°, mão única alternada nas inclinadas
  let Hs=[]; ys.forEach((y,li)=>gmHard(FR.H, y+0.05, y+A-0.05).forEach(([a,b])=>{ if(b-a>=2*R.W) Hs.push({o:"H", a, b, y0:y, y1:y+A, w:A, lvl:li, dir: g.ang===90? 0 : (li%2? -1 : 1)}) }));
  let Vs=[]; xs.forEach(x=>gmTransv(FR, R, g, Hs, x).forEach(v=>Vs.push(v)));
  (opt.rs||[]).forEach(x=>gmTransv(FR, R, g, Hs, x, true).forEach(v=>{ if(v.ramal) Vs.push(v) }));
  // zonas inclinadas: corredores das faixas e junções das pontas retas que chegam a eles
  const Zs=gmZPecas(FR, g), Js= Zs.length? gmJuncoes(FR, R, g, [...Hs, ...Vs], Zs) : [];
  // pontas curtas além da transversal mais de fora viram fileira junto à parede (sem beco) — menos a ponta ligada a uma zona
  Hs.forEach(h=>{ const vs=Vs.filter(v=>v.a<=h.y0+0.3 && v.b>=h.y1-0.3 && v.y0<h.b && v.y1>h.a); if(!vs.length) return;
    const lo=Math.min(...vs.map(v=>v.y0)), hi=Math.max(...vs.map(v=>v.y1)), lim=g.rd+2.6;
    if(lo-h.a<=lim && !h.jA) h.a=Math.max(h.a, lo); if(h.b-hi<=lim && !h.jB) h.b=Math.min(h.b, hi) });
  const base=[...Hs, ...Vs, ...Zs, ...Js]; base.forEach((p,i)=>p.i=i);
  gmDesvios(FR, R, g, base).forEach(p=>base.push({...p, i:base.length}));
  // por pavimento: ligação às rampas, alcance, fileiras
  const res={pisos:[], tot:0, pen:0, Hs, Vs, base};
  // faixa de pedestres de cada hall dos elevadores até a rede (comum a todos os pavimentos)
  const peds=gmPedestres(FR, R, base);
  FR.fl.forEach((f,fi)=>{
    const L=gmLigaPortais(FR, R, g, base, f), pcs=[...base, ...L.conns.map((c,k)=>({...c, i:base.length+k}))];
    const att=L.att.map(a=>a.map(i=>i<0? base.length-1-i : i));
    const AL=gmAlcance(pcs, att), net=pcs.filter((p,i)=>AL.reach[i]);
    const soft=[...pcs.filter(p=>p.o!=="Z").map(gmRect), ...peds.filter(p=>p.r).map(p=>p.r)];
    // becos: ponta de corredor além da última junção
    const becos=gmBecos(net, AL.adj, att, f, R, g);
    becos.filter(b=>b.longo && b.o!=="Z").forEach(b=>{ const p=net.find(x=>x.i===b.p), w=R.W+1.0, x0= b.sg>0? b.e-w : b.e, x1= b.sg>0? b.e : b.e+w;
      const r= p.o==="H"? [x0, p.y1, x1, p.y1+g.rd] : [p.y1, x0, p.y1+R.C, x1]; soft.push(r); b.r=r });
    const out={stalls:[], pil: opt.pil? [] : null}, ctxH={V:false, soft, stalls:out.stalls, KP:f.KP, gu:opt.gu, gv:opt.gv, aprox:!!opt.aprox}, ctxV={V:true, soft:soft.map(gmRectSw), stalls:[], KP:f.KPv, gu:opt.gu, gv:opt.gv, aprox:!!opt.aprox};
    const fillH=()=>{ net.filter(p=>p.o==="H" && (!p.pass || !gmEstreita(p,g) && !p.junta)).forEach(p=>{ gmFila(FR.H, R, g, p, -1, ctxH, out); gmFila(FR.H, R, g, p, 1, ctxH, out) }) };
    const fillV=()=>{ const st=out.stalls.map(s=>s.o==="H"? {r:gmRectSw(s.r)} : s), o2={stalls:[], pil:out.pil}; ctxV.stalls=st;
      net.filter(p=>p.o==="V" && !p.pass).forEach(p=>[-1,1].forEach(sd=>{ const n0=o2.stalls.length; gmFila(FR.V, R, g, p, sd, ctxV, o2); for(let k=n0;k<o2.stalls.length;k++) st.push(o2.stalls[k]) }));
      out.stalls.push(...o2.stalls) };
    fillH(); fillV();
    // fileiras das zonas inclinadas alcançadas (referencial de cada parede; pilares alinhados à zona)
    const zpil=[]; if(FR.Z){ const rw=r=>[[r[0],r[1]],[r[2],r[1]],[r[2],r[3]],[r[0],r[3]]].map(q=>FR.Wd(q[0],q[1]));
      const jb=[...Js.map(j=>j.pw), ...peds.filter(p=>p.r && p.zona).map(p=>rw(p.r)), ...L.conns.filter(c=>c.pw).map(c=>c.pw)].map(pw=>({pw, b:gmBox(pw)}));
      net.filter(p=>p.o==="Z").forEach(p=>{ const C=gmZFila(FR, R, g, p, fi, opt);
        C.st.forEach(s=>{ if(jb.some(j=>gmHit(s.wb, j.b, 0.01) && garAreaInter(s.w, j.pw)>0.05)) return; out.stalls.push({...s, piece:p.i}) });   // a junção (e a faixa de pedestres) atravessa a fileira de dentro
        if(opt.pil) C.pl.forEach(q=>zpil.push(q)) }) }
    const nB=becos.filter(b=>b.longo).length, nBc=becos.length-nB;
    const pen=0.8*nB+becos.reduce((s,b)=>s+0.1*Math.max(0,b.L-12),0)+(AL.ok? 0 : 1000)+L.conns.reduce((s,c)=>s+0.02*(c.b-c.a),0);
    res.pisos.push({f, fi, pcs, net, att, ok:AL.ok, becos, stalls:out.stalls, pil:out.pil, zpil, conns:L.conns});
    res.tot+=out.stalls.length; res.pen+=pen });
  res.peds=peds; res.pen+=peds.reduce((s,p)=>s+(p.falta? 4 : p.L/8),0)*FR.fl.length + 0.2*Vs.length;
  res.pen+=2.0*base.filter(p=>gmEstreita(p,g)).length*FR.fl.length;   // passagem estreita: só quando não há outro jeito
  res.sc=res.tot-res.pen; res.ys=ys; res.xs=xs; res.rs=opt.rs||[]; res.g=g;
  return res;
}
/* desvio: trechos do mesmo corredor separados por núcleo/rampa e sem outra ligação ganham uma passagem ao lado do
   obstáculo (até a largura do corredor; abaixo de 5,0 m é de mão única, sem vagas de frente para ela) */
function gmDesvios(FR, R, g, base){
  const AL=gmAlcance(base, []), comp=new Int32Array(base.length).fill(-1); let nc=0;
  base.forEach((p,i)=>{ if(comp[i]>=0) return; const q=[i]; comp[i]=nc; for(let h=0;h<q.length;h++) AL.adj[q[h]].forEach(j=>{ if(comp[j]<0){ comp[j]=nc; q.push(j) } }); nc++ });
  if(nc<2) return [];
  const out=[], H=base.filter(p=>p.o==="H" && !p.conn).sort((a,b)=>a.y0-b.y0 || a.a-b.a), uni=(a,b)=>{ const ca=comp[a], cb=comp[b]; if(ca===cb) return; for(let i=0;i<comp.length;i++) if(comp[i]===cb) comp[i]=ca };
  for(let k=0;k+1<H.length;k++){ const p1=H[k], p2=H[k+1]; if(Math.abs(p1.y0-p2.y0)>0.01 || comp[p1.i]===comp[p2.i]) continue;
    const u0=p1.b-3.0, u1=p2.a+3.0, obs=FR.OB.filter(o=>o.b[0]<p2.a+0.1 && o.b[2]>p1.b-0.1 && o.b[1]<p1.y1 && o.b[3]>p1.y0); if(!obs.length) continue;
    const lo=Math.min(...obs.map(o=>o.b[1])), hi=Math.max(...obs.map(o=>o.b[3]));
    let best=null;
    [-1,1].forEach(sd=>{ for(let w=g.A; w>=2.9-1e-9; w-=0.1){ const y0= sd<0? lo-w : hi, y1=y0+w;
      const I=gmHard(FR.H, y0+0.02, y1-0.02); if(!I.some(([a,b])=>a<=u0+1e-6 && b>=u1-1e-6)) continue;
      // ligações (junto às pontas dos trechos) entre a passagem e o corredor precisam estar livres
      const va=Math.min(y0,p1.y0), vb=Math.max(y1,p1.y1), J=[[u0,u0+3.0],[u1-3.0,u1]];
      if(!J.every(([a,b])=>gmHard(FR.V, a+0.02, b-0.02).some(([x0,x1])=>x0<=va+1e-6 && x1>=vb-1e-6))) continue;
      const desv=Math.abs(sd<0? p1.y0-y1 : y0-p1.y1);
      if(!best || w>best.w+0.3 || (Math.abs(w-best.w)<=0.3 && desv<best.desv)) best={y0,y1,w,va,vb,J,desv}; break } });
    if(!best) continue;
    out.push({o:"H", a:u0, b:u1, y0:best.y0, y1:best.y1, w:best.w, pass:true, dir:0});
    best.J.forEach(([a,b])=>out.push({o:"V", a:best.va, b:best.vb, y0:a, y1:b, w:3.0, pass:true, junta:true, dir:0}));
    uni(p1.i, p2.i) }
  // corredores de níveis diferentes ainda separados: transversal estreita (de 2,9 m até a largura do corredor) entre eles
  const lv=[...new Set(H.map(p=>p.y0.toFixed(2)))].map(Number).sort((a,b)=>a-b);
  for(let k=0;k+1<lv.length;k++){ const A_=H.filter(p=>Math.abs(p.y0-lv[k])<0.01), B_=H.filter(p=>Math.abs(p.y0-lv[k+1])<0.01);
    A_.forEach(p1=>B_.forEach(p2=>{ if(comp[p1.i]===comp[p2.i]) return; const u0=Math.max(p1.a,p2.a), u1=Math.min(p1.b,p2.b); if(u1-u0<2.9) return;
      const va=p1.y0, vb=p2.y1; let best=null;
      for(let x=u0; x<=u1-2.9+1e-9; x+=0.25){ for(let w=Math.min(g.AV,u1-x); w>=2.9-1e-9; w-=0.25){
        if(gmHard(FR.V, x+0.02, x+w-0.02).some(([a,b])=>a<=va+1e-6 && b>=vb-1e-6)){ if(!best || w>best.w+1e-6) best={x,w}; break } } }
      if(!best || best.w>=g.AV-0.3) return;   // com largura cheia a transversal comum já resolve
      out.push({o:"V", a:va, b:vb, y0:best.x, y1:best.x+best.w, w:best.w, pass:true, dir:0}); uni(p1.i, p2.i) })) }
  return out;
}
/* pontas de corredor sem saída (além da última junção, de transversal ou de rampa) */
function gmBecos(net, adj, att, f, R, g){
  const becos=[], byI=new Map(net.map(p=>[p.i,p]));
  net.forEach(p=>{ if(p.conn || p.pass) return; const js=[], Z_=p.o==="Z";
    adj[p.i].forEach(j=>{ const o=byI.get(j); if(!o || o.ramal && !p.ramal) return;   /* um ramal sem saída não encurta o beco de quem o recebe */
      if(Z_){ js.push(gmZProj(p, o.pw)); return } const r=gmRect(o); js.push(p.o==="H"? [r[0],r[2]] : [r[1],r[3]]) });
    att.forEach((l,pi)=>{ if(l.includes(p.i)){ const L=f.PT[pi].land; js.push(Z_? gmZProj(p, [[L[0],L[1]],[L[2],L[1]],[L[2],L[3]],[L[0],L[3]]].map(q=>p.FRW(q))) : p.o==="H"? [L[0],L[2]] : [L[1],L[3]]) } });
    if(!js.length) return; const mn=Math.min(...js.map(j=>j[0])), mx=Math.max(...js.map(j=>j[1]));
    [[p.a, mn-p.a, -1],[p.b, p.b-mx, 1]].forEach(([e,L,sg])=>{ if(L>g.rd+0.5) becos.push({p:p.i, o:p.o, e, L, sg, longo:L>R.beco}) }) });
  return becos;
}
/* faixa de pedestres: do hall dos elevadores até o corredor mais próximo, em linha reta no eixo do referencial */
function gmPedestres(FR, R, net){
  const peds=[], hw=R.ped/2, rects=net.filter(gmReta).map(p=>({p, r:gmRect(p)}));
  FR.LB.forEach((lb,li)=>{ const b=lb.b; let best=null;
    const um=(b[0]+b[2])/2, vm=(b[1]+b[3])/2, sU=[um, b[0]+(b[2]-b[0])*0.25, b[0]+(b[2]-b[0])*0.75], sV=[vm, b[1]+(b[3]-b[1])*0.25, b[1]+(b[3]-b[1])*0.75];
    lb.portas.forEach(pp=>{ sU.unshift(pp[0]); sV.unshift(pp[1]) });
    const tries=[]; sV.forEach(v=>{ tries.push({d:[1,0], s:[b[2],v]}); tries.push({d:[-1,0], s:[b[0],v]}) }); sU.forEach(u=>{ tries.push({d:[0,1], s:[u,b[3]]}); tries.push({d:[0,-1], s:[u,b[1]]}) });
    tries.forEach(t=>{ const s=t.s, d=t.d, out=[s[0]+d[0]*0.15, s[1]+d[1]*0.15];
      if(FR.OB.some(o=>out[0]>o.b[0]&&out[0]<o.b[2]&&out[1]>o.b[1]&&out[1]<o.b[3]&&G.pip(out,o.p))) return;   // sai por dentro do núcleo
      rects.forEach(({p,r})=>{ let L, rr;
        if(d[0]){ if(s[1]-hw<r[1] || s[1]+hw>r[3]) return; const e= d[0]>0? r[0] : r[2]; L=(e-s[0])*d[0]; if(L<-0.01 || (d[0]>0? s[0]>r[2] : s[0]<r[0])) return; L=Math.max(0,L); rr= d[0]>0? [s[0], s[1]-hw, s[0]+L, s[1]+hw] : [s[0]-L, s[1]-hw, s[0], s[1]+hw] }
        else { if(s[0]-hw<r[0] || s[0]+hw>r[2]) return; const e= d[1]>0? r[1] : r[3]; L=(e-s[1])*d[1]; if(L<-0.01 || (d[1]>0? s[1]>r[3] : s[1]<r[1])) return; L=Math.max(0,L); rr= d[1]>0? [s[0]-hw, s[1], s[0]+hw, s[1]+L] : [s[0]-hw, s[1]-L, s[0]+hw, s[1]] }
        const par= (p.o==="H")===(!!d[0]), Lc=L+(par? 4 : 0);   // chegar de frente ao corredor (atravessando), não pela ponta
        if(best && Lc>=best.Lc-1e-6) return;
        if(L>0.05){ const I=gmHard(FR.H, rr[1], rr[3]); if(!I.some(([a,b2])=>a<=rr[0]+1e-6 && b2>=rr[2]-1e-6)) return }
        // travessia zebrada do corredor, em frente à faixa (ou à porta do hall)
        const x0= d[0]? s[0]+d[0]*L : s[0]-hw, y0= d[1]? s[1]+d[1]*L : s[1]-hw, x1= d[0]? (d[0]>0? r[2] : r[0]) : s[0]+hw, y1= d[1]? (d[1]>0? r[3] : r[1]) : s[1]+hw;
        best={L, Lc, r: L>0.05? rr : null, li, s, e:[s[0]+d[0]*(L+0.6), s[1]+d[1]*(L+0.6)], d, piece:p.i, cross: par? null : [Math.min(x0,x1), Math.min(y0,y1), Math.max(x0,x1), Math.max(y0,y1)]} }) });
    // sem corredor reto por perto: até o corredor inclinado de uma zona (atravessa a fileira de dentro, nunca a da parede)
    const Zs=FR.Z? net.filter(p=>p.o==="Z") : [];
    if(Zs.length && (!best || best.Lc>8)) tries.forEach(t=>{ const s=t.s, d=t.d, ax=d[0]? 0 : 1, out=[s[0]+d[0]*0.15, s[1]+d[1]*0.15];
      if(FR.OB.some(o=>o.k==="nucleo" && out[0]>o.b[0]&&out[0]<o.b[2]&&out[1]>o.b[1]&&out[1]<o.b[3]&&G.pip(out,o.p))) return;
      for(let L=0; L<=20 && (!best || L<best.Lc); L+=0.25){ const e=[s[0]+d[0]*(L+0.6), s[1]+d[1]*(L+0.6)], rr=[Math.min(s[0],e[0])-(ax? hw : 0), Math.min(s[1],e[1])-(ax? 0 : hw), Math.max(s[0],e[0])+(ax? hw : 0), Math.max(s[1],e[1])+(ax? 0 : hw)];
        const z=Zs.find(p=>gmTocaPg(rr, p.pm, 0.02)); if(!z) continue;
        const rp=[[rr[0],rr[1]],[rr[2],rr[1]],[rr[2],rr[3]],[rr[0],rr[3]]], ccw=q=>G.sArea(q)>0? q : q.slice().reverse();
        if(G.area(G.clipToPoly(rp, ccw(z.bm)))>0.05 || Zs.some(o=>o.zk!==z.zk && G.area(G.clipToPoly(rp, ccw(o.gm)))>0.05)) break;
        const I= ax===0? gmHard(FR.H0, rr[1], rr[3]) : gmHard(FR.V0, rr[0], rr[2]); if(!I.some(([a,b2])=>a<=(ax? rr[1] : rr[0])+1e-6 && b2>=(ax? rr[3] : rr[2])-1e-6)) break;
        const r2=[rr[0],rr[1],rr[2],rr[3]]; if(ax===0){ if(d[0]>0) r2[2]=s[0]+L; else r2[0]=s[0]-L } else { if(d[1]>0) r2[3]=s[1]+L; else r2[1]=s[1]-L }
        best={L, Lc:L, r: L>0.05? r2 : null, li, s, e, d, piece:z.i, cross:null, zona:true}; break } });
    peds.push(best || {li, falta:true}) });
  return peds;
}

/* ---------- orientações candidatas ---------- */
function gmDirecoes(poly, obst, pisos, E, quick){
  if(E.garDir!=="auto"){ const a=(+E.garDirGraus||0)*Math.PI/180; return [[Math.cos(a),Math.sin(a)],[-Math.sin(a),Math.cos(a)]] }
  const cand=[]; const add=(d,w)=>{ const nrm=((Math.atan2(d[1],d[0])%Math.PI)+Math.PI)%Math.PI; const c=cand.find(x=>Math.abs(x.a-nrm)<0.05||Math.abs(Math.abs(x.a-nrm)-Math.PI)<0.05); if(c) c.w+=w; else cand.push({a:nrm, w}) };
  for(let i=0;i<poly.length;i++){ const a=poly[i], b=poly[(i+1)%poly.length], L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<4) continue; const d=[(b[0]-a[0])/L,(b[1]-a[1])/L]; add(d,L); add([-d[1],d[0]],L) }
  pisos.forEach(f=>(f.portals||[]).forEach(pt=>{ add(pt.heading,8); add([-pt.heading[1],pt.heading[0]],8) }));
  obst.forEach(p=>{ for(let i=0;i<p.length;i++){ const a=p[i], b=p[(i+1)%p.length], L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<2) continue; const d=[(b[0]-a[0])/L,(b[1]-a[1])/L]; add(d,L); add([-d[1],d[0]],L) } });
  cand.sort((a,b)=>b.w-a.w);
  // as duas direções de cada eixo (corredores ao longo de um lado ou do outro)
  const out=[]; cand.slice(0, quick? 1 : 3).forEach(c=>{ out.push([Math.cos(c.a),Math.sin(c.a)], [-Math.sin(c.a),Math.cos(c.a)]) });
  return out.filter((d,i)=>out.findIndex(e=>Math.abs(e[0]*d[1]-e[1]*d[0])<0.03)===i);
}

/* ---------- busca: orientações × ângulos × corredores (K melhores) × transversais ---------- */
function garModBusca(poly, obst, E, o, pisos){
  const R=garRegras(E, o.gx), quick=!!o.quick;
  const lobbies=(o.lobbies||[]).filter(l=>l && l.poly && l.poly.length>2 && G.polysOverlap(l.poly, poly));
  const angs = E.angulo==="melhor"? [90,60,45] : [+E.angulo||90];
  const dirs=gmDirecoes(poly, obst, pisos, E, quick);
  const t0=Date.now(), lim= o.lim || (quick? 400 : 3000), all=[];
  // tarefas: orientação × ângulo × conjunto de zonas inclinadas (nenhuma; todas; e cada uma sozinha quando há 2 ou 3)
  const zc=new Map(), zonasDe=(zv,g)=>zv.map(([w,t])=>{ const k=w.i+":"+t+":"+g.ang; if(!zc.has(k)) zc.set(k, gmZona(w, poly, obst, pisos, lobbies, R, g, t)); return zc.get(k) }).filter(z=>z.pcs.length);
  // (combinações completas na orientação principal; nas outras, só todas simples ou todas duplas)
  const t0s=[], tzs=[]; dirs.forEach((ux,di)=>{ const ws= R.zonas==="nunca"? [] : gmParedesZ(poly, ux).slice(0,3), vars=[];
    if(ws.length){ ["s","d"].forEach(t=>vars.push(ws.map(w=>[w,t])));
      if(!quick && di<1 && ws.length>1) ws.forEach(w=>["s","d"].forEach(t=>vars.push([[w,t]])));
      if(!quick && di<1 && ws.length===2) vars.push([[ws[0],"s"],[ws[1],"d"]], [[ws[0],"d"],[ws[1],"s"]]) }
    angs.forEach(ang=>{ t0s.push({ux, ang, zv:[]}); vars.forEach(zv=>tzs.push({ux, ang, zv})) }) });
  // sem zonas, como antes (limite total); as tarefas com zona repartem o que sobrar (até 40% do limite; no mínimo 3% cada)
  const comZ=tzs.length>0, tarefas=[...t0s, ...tzs]; let dl=t0+lim, feitas=0, tz0=0;
  const semZ=new Map();   // melhores estruturas sem zona (por orientação e ângulo): ponto de partida das variantes com zona
  tarefas.forEach(({ux, ang, zv})=>{
    if(zv.length){ const ag=Date.now(); if(!feitas) tz0=Math.min(t0+lim, ag+lim*0.4); dl=ag+Math.max(lim*0.03, tz0-ag)/(tzs.length-feitas); feitas++ }
    { const g=garGeo(R, ang), zonas=zonasDe(zv, g); if(zv.length && !zonas.length) return;
      const FR=gmFrame(ux, poly, obst, pisos, lobbies, zonas);
      const chave=ux.map(v=>v.toFixed(3))+":"+ang, seqs=gmCorredores(FR, R, g, quick? 2 : 5);
      if(zonas.length){ const vis=new Set(seqs.map(q=>q.ys.map(y=>y.toFixed(2)).join(",")));
        (semZ.get(chave)||[]).slice(0,3).reverse().forEach(L=>{ const k=L.ys.map(y=>y.toFixed(2)).join(","); seqs.unshift({ys:L.ys, xs0:L.xs}); vis.add(k) }) }
      seqs.forEach((sq,si)=>{
        const Hs=[]; sq.ys.forEach(y=>gmHard(FR.H, y+0.05, y+g.A-0.05).forEach(([a,b])=>{ if(b-a>=2*R.W) Hs.push({o:"H", a, b, y0:y, y1:y+g.A}) }));
        let C=gmTransvCand(FR, R, g, Hs).filter(x=>gmTransv(FR, R, g, Hs, x).length);
        // as que ligam mais corredores primeiro; no rápido, poucas
        C.sort((a,b)=>gmTransv(FR, R, g, Hs, b).reduce((s,v)=>s+v.tc,0)-gmTransv(FR, R, g, Hs, a).reduce((s,v)=>s+v.tc,0));
        C=C.slice(0, quick? 6 : 14);
        const gu0=(FR.fb[0]+R.acrP-R.PIL/2-R.acrPil), gv0=(FR.fb[1]+R.acrP-R.PIL/2-R.acrPil), opt={gu:gu0, gv:gv0, aprox:true};
        const combos=[[]]; if(sq.xs0 && sq.xs0.length) combos.unshift(sq.xs0); C.forEach(x=>combos.push([x])); for(let i=0;i<C.length;i++) for(let j=i+1;j<C.length;j++) if(Math.abs(C[i]-C[j])>=g.AV+2*R.W) combos.push([C[i],C[j]].sort((a,b)=>a-b));
        const local=[]; for(const xs of combos){ if(local.length && Date.now()>dl) break; const L=gmAvalia(FR, R, g, sq.ys, xs, opt); local.push(L) }
        local.sort((a,b)=>b.sc-a.sc);
        // terceira transversal nas melhores (pavimentos longos)
        if(!quick) local.slice(0,4).forEach(L=>{ if(L.xs.length!==2 || Date.now()>dl) return; C.forEach(x=>{ if(L.xs.some(y=>Math.abs(y-x)<g.AV+2*R.W)) return; const L3=gmAvalia(FR, R, g, sq.ys, [...L.xs, x].sort((a,b)=>a-b), opt); if(L3.sc>L.sc) local.push(L3) }) });
        local.sort((a,b)=>b.sc-a.sc); local.slice(0, quick? 1 : 3).forEach(L=>all.push({FR, L}));
        if(!zonas.length && comZ){ const l=semZ.get(chave)||[]; l.push(...local.slice(0,3)); l.sort((a,b)=>b.sc-a.sc); semZ.set(chave, l.slice(0,4)) } }) } });
  // ramais sem saída (até o limite de beco) nas melhores estruturas: atendem sobras grandes que a rede não alcança
  if(!quick){ all.sort((a,b)=>b.L.sc-a.L.sc); const t1=Date.now();
    all.slice(0,8).forEach(({FR, L})=>{ const g=L.g, opt={gu:FR.fb[0]+R.acrP-R.PIL/2-R.acrPil, gv:FR.fb[1]+R.acrP-R.PIL/2-R.acrPil, aprox:true};
      const Cr=gmTransvCand(FR, R, g, L.Hs).filter(x=>gmTransv(FR, R, g, L.Hs, x, true).some(v=>v.ramal));
      let cur=L; for(let it=0; it<2 && Date.now()-t1<1500; it++){ let mel=null;
        Cr.forEach(x=>{ if([...cur.xs, ...cur.rs].some(y=>Math.abs(y-x)<g.AV+2*R.W)) return; const L4=gmAvalia(FR, R, g, cur.ys, cur.xs, {...opt, rs:[...cur.rs, x]}); if(L4.sc>(mel||cur).sc+0.5) mel=L4 });
        if(!mel) break; all.push({FR, L:mel}); cur=mel } }) }
  if(R.partido!=="auto"){ const fx=all.filter(x=>gmPartido(x.L)===R.partido); if(fx.length) return {R, cands:fx.sort((a,b)=>b.L.sc-a.L.sc), lobbies} }
  all.sort((a,b)=>b.L.sc-a.L.sc);
  const div=[], sg=x=>x.FR.ux.map(v=>v.toFixed(2))+"|"+(x.FR.Z||[]).map(z=>z.w.i+z.tipo).join(".")+"|"+x.L.ys.length+"|"+x.L.xs.map(v=>Math.round(v/2)).join(",")+"|"+x.L.rs.map(v=>Math.round(v/2)).join(",")+"|"+x.L.ys.map(v=>Math.round(v/2)).join(",");
  const vs=new Set(); all.forEach(x=>{ const k=sg(x); if(!vs.has(k)){ vs.add(k); div.push(x) } });
  return {R, cands:div, lobbies};
}
/* nome do partido pela forma da rede */
function gmPartido(L){
  if(L.g && L.g.ang!==90) return "inclinado";
  const P=L.pisos&&L.pisos[0]; if(!P) return "simples";
  const H=P.net.filter(p=>p.o==="H" && !p.conn), V=P.net.filter(p=>p.o==="V" && !p.conn);
  const lv=new Set(H.map(p=>p.y0.toFixed(1))).size, rows=new Set(P.stalls.filter(s=>s.o==="H").map(s=>s.piece+":"+s.side)).size;
  const longos=P.becos.filter(b=>b.longo).length, becos=P.becos.length;
  if(lv<=1) return rows<=1? "estreita" : (V.length>=2 && !becos? "anel" : "simples");
  if(V.length>=2 && !longos && becos<=1) return "anel";
  if(V.length>=1 && V.some(v=>H.some(h=>h.a<v.y0-7.5 && h.b>v.y1+7.5))) return "espinha";
  return lv===2? "duplo" : "pente";
}

/* ---------- refinamento: malha de pilares (alinhamento) e montagem no mundo ---------- */
function gmRefina(FR, R, L){
  const g=L.g, opts=[], add=(gu,gv)=>{ if(!opts.some(o=>Math.abs(((o.gu-gu)%g.Pt+g.Pt)%g.Pt)<0.05 && Math.abs(((o.gv-gv)%g.PtV+g.PtV)%g.PtV)<0.05)) opts.push({gu,gv}) };
  const gu0=FR.fb[0]+R.acrP-R.PIL/2-R.acrPil, gv0=FR.fb[1]+R.acrP-R.PIL/2-R.acrPil;
  add(gu0, gv0);
  // pilar logo depois de cada transversal / logo antes
  L.Vs.forEach(v=>{ add(v.y1-R.PIL/2-R.acrPil, gv0); add(v.y0+R.PIL/2+R.acrPil, gv0) });
  // primeira vaga encostada na parede de cada corredor (a parede pode ser inclinada)
  L.Hs.slice(0,3).forEach(h=>add(h.a+R.acrP-R.PIL/2-R.acrPil, gv0));
  // fileiras das transversais: começam na face de um corredor principal
  L.Hs.slice(0,3).forEach(h=>{ add(gu0, h.y1-R.PIL/2-R.acrPil); add(gu0, h.y0+R.PIL/2+R.acrPil) });
  let best=null;
  opts.slice(0,8).forEach(op=>{ const L2=gmAvalia(FR, R, g, L.ys, L.xs, {...op, pil:true, rs:L.rs}); if(!best || L2.sc>best.sc) best=L2 });
  return best;
}
/* do referencial para o mundo: vagas, pilares, corredores, pedestres, retornos (um pavimento) */
function gmMundo(FR, R, L, P){
  const Wd=q=>FR.Wd(q[0],q[1]), rectW=r=>[[r[0],r[1]],[r[2],r[1]],[r[2],r[3]],[r[0],r[3]]].map(Wd);
  const dirW=d=>[FR.ux[0]*d[0]+FR.vy[0]*d[1], FR.ux[1]*d[0]+FR.vy[1]*d[1]];
  const vagas=P.stalls.map(s=>{ const V_=s.o==="V", toF= V_? (q=>[q[1],q[0]]) : (q=>q), zf=s.zf;
    // vaga de zona inclinada: no referencial da própria zona
    const Wv= zf? (q=>zf.Wd(q[0],q[1])) : Wd, dv= zf? (d=>[zf.ux[0]*d[0]+zf.vy[0]*d[1], zf.ux[1]*d[0]+zf.vy[1]*d[1]]) : dirW;
    const loc=s.loc.map(toF), fm=toF([(s.loc[0][0]+s.loc[1][0])/2, s.e]), c=toF([(s.loc[0][0]+s.loc[2][0])/2, s.e+s.side*(V_? R.C : L.g.rd)/2]);
    const axL= s.ang===90? [0,s.side] : [s.t*Math.cos(L.g.th), s.side*Math.sin(L.g.th)], out=toF([-axL[0], -axL[1]]);
    const r= V_? gmRectSw(s.r) : s.r;
    const v={poly:loc.map(Wv), c:Wv(c), fm:Wv(fm), out:dv(out), u:s.u, uc:s.uc, row:s.piece*2+(s.side>0?1:0), grp:s.grp, j:s.j, aisle:s.piece, tipo:"n", W:s.W, ang:s.ang, _f:{...s, r, rd: V_? R.C : L.g.rd, Wd: zf? Wv : null}};
    if(zf) v.zona=s.zw; return v });   // zona = índice da parede
  const aisles=P.net.map(p=>{
    if(p.o==="Z"){ const zf=p.z.FRz, m_=(p.y0+p.y1)/2; return {poly:p.pw, o:"Z", conn:false, pass:false, dir:0, w:p.w, i:p.i, a:zf.Wd(p.a,m_), b:zf.Wd(p.b,m_), zona:p.zk} }
    if(p.jz) return {poly:p.pw, o:"J", conn:true, pass:false, dir:0, w:p.w, i:p.i, a:p.aW, b:p.bW};
    const r=gmRect(p); return {poly:rectW(r), o:p.o, conn:!!p.conn, pass:gmEstreita(p,L.g), dir:p.dir||0, w:p.w, i:p.i, r,
    a:Wd(p.o==="H"? [p.a,(p.y0+p.y1)/2] : [(p.y0+p.y1)/2,p.a]), b:Wd(p.o==="H"? [p.b,(p.y0+p.y1)/2] : [(p.y0+p.y1)/2,p.b])} });
  const peds=L.peds.filter(p=>!p.falta).map(p=>({poly: p.r? rectW(p.r) : null, cross: p.cross? rectW(p.cross) : null, a:Wd(p.s), b:Wd(p.e), L:p.L, lobby:p.li, d:dirW(p.d)}));
  const retornos=P.becos.filter(b=>b.longo && b.r).map(b=>rectW(b.r));
  return {vagas, aisles, peds, retornos, _Wd:Wd, rectW};
}
/* pilares comuns ao grupo: os candidatos de todos os pavimentos, sem os que caem em vaga, corredor, patamar ou rampa de algum deles */
function gmPilares(FR, R, L){
  const cand=[]; L.pisos.forEach(P=>(P.pil||[]).forEach(p=>{ const r= p.V? gmRectSw(p.r) : p.r; if(!cand.some(c=>Math.abs(c[0]-r[0])<0.05 && Math.abs(c[1]-r[1])<0.05)) cand.push(r) }));
  return cand.filter(r=>L.pisos.every(P=>{
    if(P.pcs.some(p=>p.o!=="Z" && gmHit(gmRect(p), r, 0.02))) return false;
    if(P.f.KP.some(k=>gmHit(k.b, r, 0.02))) return false;
    if((L.peds||[]).some(p=>p.r && gmHit(p.r, r, 0.02))) return false;
    if(P.stalls.some(s=>{ if(s.zf) return false; const sr= s.o==="V"? gmRectSw(s.r) : s.r; return gmHit(sr, r, 0.02) && (s.ang===90 || garAreaInter(s.o==="V"? s.loc.map(q=>[q[1],q[0]]) : s.loc, [[r[0],r[1]],[r[2],r[1]],[r[2],r[3]],[r[0],r[3]]])>0.01) })) return false;
    return true }));
}

/* pilares das zonas inclinadas (no mundo, alinhados à zona): os de todos os pavimentos, sem os que caem em vaga, corredor,
   junção, patamar ou faixa de pedestres de algum deles */
function gmPilaresZ(FR, R, L){
  const cand=[]; L.pisos.forEach(P=>(P.zpil||[]).forEach(p=>{ const c=G.centroid(p); if(!cand.some(q=>Math.hypot(q.c[0]-c[0],q.c[1]-c[1])<0.05)) cand.push({p, c, b:gmBox(p)}) }));
  if(!cand.length) return [];
  const rw=r=>[[r[0],r[1]],[r[2],r[1]],[r[2],r[3]],[r[0],r[3]]].map(q=>FR.Wd(q[0],q[1]));
  const bate=(x,pg)=>gmHit(x.b, gmBox(pg), 0.01) && garAreaInter(pg, x.p)>0.01;
  return cand.filter(x=>L.pisos.every(P=>{
    if(P.pcs.some(p=>(p.o==="Z"||p.jz)? bate(x, p.pw) : bate(x, rw(gmRect(p))))) return false;
    if(P.f.KP.some(k=>bate(x, rw(k.b)))) return false;
    if((L.peds||[]).some(p=>p.r && bate(x, rw(p.r)))) return false;
    return !P.stalls.some(s=>s.zf && bate(x, s.w)) })).map(x=>x.p);
}
/* PCD (faixa de transferência de 1,20 m de um lado ou compartilhada por duas) e idosos perto do hall dos elevadores */
function garPcdIdoso(lay, E, R, refs){
  refs=(refs||[]).filter(Boolean); if(!refs.length) refs=[[0,0]];
  const cars=lay.vagas.filter(v=>v.tipo==="n" && !v.presa && !v.tandem && v._f && v._f.ang===90);
  const n=lay.vagas.filter(v=>v.tipo==="n").length, nP=n&&E.pcd>0? Math.max(1,Math.round(n*E.pcd)) : 0, nI=n&&E.idoso>0? Math.max(1,Math.round(n*E.idoso)) : 0;
  const d=v=>Math.min(...refs.map(ref=>Math.hypot(v.c[0]-ref[0], v.c[1]-ref[1])));
  // grupos de vagas lado a lado (mesma fileira, mesmo módulo entre pilares), do mais perto do hall para o mais longe
  const grupos={}; cars.forEach(v=>{ const k=v.row+":"+v.grp+":"+v._f.o; (grupos[k]=grupos[k]||[]).push(v) });
  const lista=Object.values(grupos).map(g=>g.sort((a,b)=>a.j-b.j)).filter(g=>{ for(let i=1;i<g.length;i++) if(g[i].j!==g[i-1].j+1) return false; return true })
    .map(g=>({g, d:Math.min(...g.map(d))})).sort((a,b)=>a.d-b.d);
  const W=R.W, F=R.pcdF;
  const zona=v=>v.zona!=null? {zona:v.zona} : {};
  const monta=(gr, k)=>{ const g=gr.g, V_=g[0]._f.o==="V", x0=Math.min(...g.map(v=>v._f.r[V_?1:0])), x1=Math.max(...g.map(v=>v._f.r[V_?3:2]));
    const need= k===2? 2*W+F : W+F; if(x1-x0 < need-1e-6) return null;
    const sobra=x1-x0-need, nC=Math.floor((sobra+1e-6)/W), extra=(sobra-nC*W)/(k+nC||1);
    // a PCD fica do lado mais perto do hall; a faixa entre as duas (compartilhada) ou do lado de dentro
    const perto= d(g[0])<=d(g[g.length-1]);
    let seq= k===2? [["pcd",W+extra],["faixa",F],["pcd",W+extra]] : [["pcd",W+extra],["faixa",F]];
    const comuns=[]; for(let i=0;i<nC;i++) comuns.push(["n",W+extra]);
    seq= perto? [...seq, ...comuns] : [...comuns, ...seq.reverse()];
    return {seq, x0, x1, nC, k} };
  const opc=modo=>{ let resto=nP, perda=0; const usos=[];
    for(const gr of lista){ if(resto<=0) break; const k= modo==="comp" && resto>=2? 2 : 1, m=monta(gr,k); if(!m) continue; usos.push({gr, m}); perda+=gr.g.length-(m.k+m.nC); resto-=m.k }
    return {usos, perda, falta:resto, modo} };
  const A=opc("comp"), B=opc("lado");
  const esc = R.pcdModo==="compartilhada"? A : R.pcdModo==="lado"? B : ((A.falta-B.falta)||(A.perda-B.perda))<=0? A : B;
  const Wd=lay._Wd;
  esc.usos.forEach(({gr,m})=>{ const g=gr.g, f=g[0]._f, V_=f.o==="V", side=f.side, rd=f.rd, e=f.e, Wd=f.Wd||lay._Wd;   // zona inclinada: referencial dela
    const toF= V_? (q=>[q[1],q[0]]) : (q=>q); let x=m.x0; const novos=[];
    m.seq.forEach(([t,w])=>{ const loc=[[x,e],[x+w,e],[x+w,e+side*rd],[x,e+side*rd]].map(toF), fmF=toF([x+w/2,e]), cF=toF([x+w/2,e+side*rd/2]);
      const r0=[x, Math.min(e,e+side*rd), x+w, Math.max(e,e+side*rd)];
      novos.push({poly:loc.map(q=>Wd(q)), c:Wd(cF), fm:Wd(fmF), out:g[0].out, u:x, uc:x+w/2, row:g[0].row, grp:g[0].grp, j:novos.length, aisle:g[0].aisle, tipo:t, W:w, ang:90, pcdModo:esc.modo, ...zona(g[0]), _f:{...f, r: V_? gmRectSw(r0) : r0}}); x+=w });
    const set=new Set(g); const i0=lay.vagas.findIndex(v=>set.has(v)); lay.vagas=lay.vagas.filter(v=>!set.has(v)); lay.vagas.splice(i0,0,...novos) });
  // idosos: as comuns mais perto do hall
  lay.vagas.filter(v=>v.tipo==="n" && !v.presa && !v.tandem).sort((a,b)=>d(a)-d(b)).slice(0,nI).forEach(v=>v.tipo="idoso");
  lay.pcd={modo:esc.modo, pedidas:nP, feitas:nP-esc.falta, perda:esc.perda};
}
/* rota pela rede de corredores (eixos), com curvas de raio real do carro nas esquinas */
function garRotaRede(aisles, R, from, to){
  const A=aisles; if(!A||!A.length) return null;
  const key=p=>p[0].toFixed(2)+","+p[1].toFixed(2), nodes=new Map();
  const node=p=>{ const k=key(p); if(!nodes.has(k)) nodes.set(k,{p, e:[]}); return nodes.get(k) };
  const seg=(a,b)=>{ const na=node(a), nb=node(b), L=Math.hypot(b[0]-a[0],b[1]-a[1]); na.e.push([nb,L]); nb.e.push([na,L]) };
  const proj=(p,s)=>{ const d=[s.b[0]-s.a[0],s.b[1]-s.a[1]], L2=d[0]*d[0]+d[1]*d[1]||1, t=clamp(((p[0]-s.a[0])*d[0]+(p[1]-s.a[1])*d[1])/L2,0,1); return [s.a[0]+d[0]*t, s.a[1]+d[1]*t] };
  const inter=(s1,s2)=>{ const d1=[s1.b[0]-s1.a[0],s1.b[1]-s1.a[1]], d2=[s2.b[0]-s2.a[0],s2.b[1]-s2.a[1]], den=d1[0]*d2[1]-d1[1]*d2[0]; if(Math.abs(den)<1e-9) return null;
    const t=((s2.a[0]-s1.a[0])*d2[1]-(s2.a[1]-s1.a[1])*d2[0])/den, u=((s2.a[0]-s1.a[0])*d1[1]-(s2.a[1]-s1.a[1])*d1[0])/den;
    const e1=(s1.w||5)/2/Math.hypot(...d1), e2=(s2.w||5)/2/Math.hypot(...d2);
    if(t<-e1-0.02||t>1+e1+0.02||u<-e2-0.02||u>1+e2+0.02) return null; return [s1.a[0]+d1[0]*t, s1.a[1]+d1[1]*t] };
  // eixos prolongados até a borda das peças que cruzam (a junção fica no centro do cruzamento)
  const S=A.map(s=>({a:s.a, b:s.b, w:s.w}));
  const cuts=S.map(s=>[s.a, s.b]);
  for(let i=0;i<S.length;i++) for(let j=i+1;j<S.length;j++){ const p=inter(S[i],S[j]); if(p){ cuts[i].push(p); cuts[j].push(p) } }
  const ends=[from,to].map(p=>{ let best=null; S.forEach((s,i)=>{ const q=proj(p,s), d=Math.hypot(q[0]-p[0],q[1]-p[1]); if(!best||d<best.d) best={i,q,d} }); if(best) cuts[best.i].push(best.q); return best });
  if(ends.some(e=>!e)) return null;
  S.forEach((s,i)=>{ const d=[s.b[0]-s.a[0],s.b[1]-s.a[1]]; const l=cuts[i].map(p=>({p, t:(p[0]-s.a[0])*d[0]+(p[1]-s.a[1])*d[1]})).sort((x,y)=>x.t-y.t); for(let k=1;k<l.length;k++) if(l[k].t-l[k-1].t>1e-6) seg(l[k-1].p, l[k].p) });
  const s0=node(ends[0].q), s1=node(ends[1].q), dist=new Map([[s0,0]]), prev=new Map(), Q=[s0];
  while(Q.length){ Q.sort((a,b)=>dist.get(a)-dist.get(b)); const u=Q.shift(); if(u===s1) break; u.e.forEach(([v,l])=>{ const nd=dist.get(u)+l; if(nd<(dist.has(v)? dist.get(v) : Infinity)){ dist.set(v,nd); prev.set(v,u); Q.push(v) } }) }
  if(!dist.has(s1)) return null;
  const path=[]; for(let n=s1; n; n=prev.get(n)) path.unshift(n.p);
  const P=[from, ...path, to].filter((p,i,a)=>!i || Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1])>0.05);
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
   lay = layout de um pavimento (m.gar[k]); ctx = {poly, obst, E, gx, lobbies, terreo}. Devolve {nota, problemas[{k,nivel,msg}], met} */
function garValida(lay, ctx){
  const E=ctx.E, R=garRegras(E, ctx.gx), poly=ctx.poly||[], obst=ctx.obst||[], P=[];
  const add=(k,nivel,msg,extra)=>P.push({k,nivel,msg,...(extra||{})});
  const area=G.area(poly), carros=lay.vagas.filter(v=>garCar(v.tipo)), n=carros.length;
  const bb=p=>gmBox(p), hit=(a,b)=>a[0]<b[2]-1e-3&&b[0]<a[2]-1e-3&&a[1]<b[3]-1e-3&&b[1]<a[3]-1e-3;
  const ov=(a,b,t=0.05)=>{ if(!hit(bb(a),bb(b))) return false; return garAreaInter(a,b)>t };
  // 1) nenhuma vaga em núcleo/hall, rampa, patamar, corredor ou faixa de pedestres; nenhuma sobreposta a outra ou a pilar
  const proib=[...obst.map(p=>["núcleo ou hall",p]), ...(lay.blocks||[]).map(p=>["rampa",p]), ...(lay.landings||[]).map(p=>["patamar",p]), ...(lay.peds||[]).filter(x=>x.poly).map(x=>["faixa de pedestres",x.poly]), ...(lay.aisles||[]).map(a=>["corredor",a.poly])];
  let nProib=0, nSob=0, nFora=0; const onde=new Set();
  const vs=lay.vagas.filter(v=>v.tipo!=="off");
  vs.forEach((v,i)=>{ const c=G.centroid(v.poly); if(poly.length && !G.polyInPoly(v.poly.map(q=>[q[0]+(c[0]-q[0])*0.01, q[1]+(c[1]-q[1])*0.01]), poly)) nFora++;
    const pr=proib.find(([,p])=>ov(v.poly,p,0.1)); if(pr){ nProib++; onde.add(pr[0]) }
    for(let j=i+1;j<vs.length;j++) if(ov(v.poly,vs[j].poly)){ nSob++; break } });
  (lay.pillars||[]).forEach(p=>{ if(vs.some(v=>ov(v.poly,p,0.01))) nSob++ });
  if(nProib) add("proib","bad",`${nProib} vaga${nProib>1?"s":""} sobre ${[...onde].join(", ")}`);
  if(nSob) add("sobre","bad",`${nSob} vaga${nSob>1?"s":""} sobreposta${nSob>1?"s":""} a outra vaga ou a pilar`);
  if(nFora) add("fora","bad",`${nFora} vaga${nFora>1?"s":""} fora do pavimento`);
  // 2) rota: todas as vagas alcançáveis e com manobra livre; portais ligados
  if(lay.ok===false) add("rota","bad","a rampa não chega à circulação deste pavimento");
  if(lay.semRota) add("semrota","bad",`${lay.semRota} vaga${lay.semRota>1?"s":""} sem rota até a rampa`);
  // 3) manobra diante da vaga: largura da vaga × profundidade de manobra livre de vagas e pilares
  let nMan=0; const need=a=> a===90||!a? Math.max(4.8,R.AI90-0.7) : a===60? R.AI60-0.5 : R.AI45-0.5;
  carros.forEach(v=>{ if(v.presa) return; const fr=frontRect(v.fm, v.out, Math.max(1.8,(v.W||R.W)-0.6), need(v.ang)); const b0=bb(fr);
    if(vs.some(w=>w!==v && hit(b0,bb(w.poly)) && garAreaInter(fr,w.poly)>0.3) || (lay.pillars||[]).some(p=>hit(b0,bb(p)) && garAreaInter(fr,p)>0.02)) nMan++ });
  if(nMan) add("manobra","bad",`${nMan} vaga${nMan>1?"s":""} sem área de manobra livre à frente`);
  // 4) faixa de pedestres do hall dos elevadores ao corredor
  const nL=(ctx.lobbies||[]).length, nPed=(lay.peds||[]).length;
  if(nL && nPed<nL) add("ped","warn",`${nL-nPed} hall${nL-nPed>1?"s":""} dos elevadores sem faixa de pedestres até o corredor`);
  // 5) PCD com faixa de transferência e perto do hall
  const pcd=lay.vagas.filter(v=>v.tipo==="pcd"), faixas=lay.vagas.filter(v=>v.tipo==="faixa");
  const semF=pcd.filter(v=>!faixas.some(f=>garToca(v.poly,f.poly)));
  if(semF.length) add("pcdFaixa","warn",`${semF.length} vaga${semF.length>1?"s":""} PCD sem a faixa de transferência de 1,20 m`);
  if(lay.pcd && lay.pcd.feitas<lay.pcd.pedidas) add("pcdFalta","warn",`${lay.pcd.pedidas-lay.pcd.feitas} vaga${lay.pcd.pedidas-lay.pcd.feitas>1?"s":""} PCD sem lugar com faixa de transferência`);
  const ref=(lay.peds&&lay.peds[0]&&lay.peds[0].b) || (obst[0]&&G.centroid(obst[0]));
  if(ref && pcd.length){ const dm=Math.max(...pcd.map(v=>Math.hypot(v.c[0]-ref[0],v.c[1]-ref[1]))); if(dm>30) add("pcdLonge","warn",`vaga PCD a ${nf(dm,0)} m do hall dos elevadores`) }
  // 6) becos sem retorno e curvas
  const bl=(lay.becos||[]).filter(b=>b.longo);
  if(bl.length) add("beco","warn",`${bl.length} corredor${bl.length>1?"es":""} sem saída com mais de ${nf(R.beco,0)} m (bolsão de retorno marcado)`);
  if(lay.passagens && lay.passagens.length) add("pass","warn",`passagem estreita de ${nf(Math.min(...lay.passagens),1)} m ao lado do núcleo (mão única, sem vagas)`);
  if(lay.giroFalha) add("giro","warn",`curva apertada para o raio de giro (${nf(R.Ro,1)} m externo) em ${lay.giroFalha} ponto${lay.giroFalha>1?"s":""}`);
  // 7) eficiência: m² de área bruta por vaga, com o motivo quando passa da meta
  const aObst=obst.reduce((s,p)=>s+garAreaInter(poly,p),0), aRamp=(lay.blocks||[]).reduce((s,p)=>s+garAreaInter(poly,p),0)+(lay.landings||[]).reduce((s,p)=>s+garAreaInter(poly,p),0);
  const m2v = n? area/n : Infinity, util=area-aObst-aRamp, m2u = n? util/n : Infinity;
  const met={area, n, m2v, m2u, aObst, aRamp, util, pctOcup: area? (aObst+aRamp)/area : 0, partido:lay.partido, becos:bl.length, larg:garLarguraMin(poly)};
  if(n && m2v>GAR_META[1]+0.5 && !ctx.terreo){
    const pct_=Math.round(met.pctOcup*100);
    const motivo = met.pctOcup>0.15? `núcleos, rampas e patamares ocupam ${pct_}% do pavimento` : met.larg<2*(2*R.C+R.AI90)-1? `pavimento estreito (${nf(met.larg,1)} m): cabe ${met.larg<2*R.C+R.AI90? "só um corredor com uma fileira" : "um só módulo de 15,5 m"}` : `forma do pavimento deixa sobras sem vaga`;
    met.motivo=motivo; add("m2","info",`${nf(m2v,1)} m² por vaga (meta ${GAR_META[0]}–${GAR_META[1]}): ${motivo}`) }
  if(!n && area>40) add("vazio","bad","nenhuma vaga coube neste pavimento");
  let nota=100; P.forEach(p=>nota-= p.nivel==="bad"? 25 : p.nivel==="warn"? 6 : 0);
  if(isFinite(m2v) && m2v>GAR_META[1] && !ctx.terreo) nota-=Math.min(15, (m2u-GAR_META[1]*0.8)>0? (m2u-GAR_META[1]*0.8)*0.6 : 0);
  return {nota:Math.max(0,Math.round(nota)), problemas:P, met};
}
function garToca(a,b){ const A=gmBox(a), B=gmBox(b); return A[0]<=B[2]+0.05 && B[0]<=A[2]+0.05 && A[1]<=B[3]+0.05 && B[1]<=A[3]+0.05 }
/* área da interseção de dois polígonos (o segundo convexo) */
function garAreaInter(a, b){ if(!a||!b||a.length<3||b.length<3) return 0; const cb= G.sArea(b)>0? b : b.slice().reverse(); return G.area(G.clipToPoly(a, cb)) }
/* menor largura do pavimento (entre as direções dos lados) */
function garLarguraMin(poly){ let best=Infinity; for(let i=0;i<poly.length;i++){ const a=poly[i], b=poly[(i+1)%poly.length], L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<3) continue; const n=[-(b[1]-a[1])/L,(b[0]-a[0])/L], [x0,x1]=G.extent(poly,n); best=Math.min(best,x1-x0) } return best }

/* ---------- solução de um grupo de pavimentos com o mesmo contorno ----------
   pisos = [{key, portals, blocks, keep, terreo?}] → {key: layout-base} (sem as edições manuais) */
function garModGrupo(poly, obst, E, o, pisos){
  if(!poly || poly.length<3) return null;
  const M=garModBusca(poly, obst, E, o, pisos), R=M.R; if(!M.cands.length) return null;
  // refina as 5 melhores sem ramal e as 2 melhores com ramal (a avaliação aproximada favorece os ramais)
  // (e, à parte, as 3 melhores com zonas inclinadas, uma de cada conjunto de zonas — que só ficam se não perderem vagas para a melhor sem zona)
  const T=o.quick? 1 : 5, Tr=o.quick? 0 : 2, Tz=o.quick? 1 : 3, vistos=new Set(); let best=null, bestZ=null, nS=0, nR=0, nZ=0;
  const totNZ=Math.max(0, ...M.cands.filter(c=>!c.FR.Z && c.L.pisos.every(P=>P.ok)).map(c=>c.L.tot));
  for(const {FR, L} of M.cands){ if(nS>=T && nR>=Tr && nZ>=Tz) break; if(L.pisos.some(P=>!P.ok)) continue;
    const ram=L.rs.length>0, zz=!!FR.Z; if(zz? nZ>=Tz || (L.tot<totNZ-L.pisos.length && R.zonas!=="sempre") : ram? nR>=Tr : nS>=T) continue;   // zona só se a estimativa já vier perto
    if(zz){ const zk="Z"+FR.ux.map(v=>v.toFixed(3))+(FR.Z||[]).map(z=>z.w.i+z.tipo).join("."); if(vistos.has(zk)) continue; vistos.add(zk) }   // uma de cada conjunto de zonas
    const sig=L.tot+":"+L.ys.map(y=>y.toFixed(1))+":"+L.xs.map(x=>x.toFixed(1))+":"+L.rs.map(x=>x.toFixed(1))+":"+FR.ux.map(v=>v.toFixed(3))+":"+(FR.Z||[]).map(z=>z.w.i+z.tipo).join("."); if(vistos.has(sig)) continue; vistos.add(sig); if(zz) nZ++; else if(ram) nR++; else nS++;
    const L2=o.quick? gmAvalia(FR, R, L.g, L.ys, L.xs, {gu:FR.fb[0]+R.acrP-R.PIL/2-R.acrPil, gv:FR.fb[1]+R.acrP-R.PIL/2-R.acrPil, pil:true, rs:L.rs}) : gmRefina(FR, R, L);
    const out=gmMonta(poly, obst, E, o, pisos, M, FR, L2), n=Object.values(out).reduce((s,l)=>s+l.count,0), sc=n-L2.pen;
    if(zz){ if(!bestZ || sc>bestZ.sc) bestZ={sc, n, out} } else if(!best || sc>best.sc) best={sc, n, out} }
  if(bestZ && (!best || R.zonas==="sempre" || bestZ.n>best.n || (bestZ.n===best.n && bestZ.sc>=best.sc-0.5))) best=bestZ;   // S.garagem.zonas: "sempre" | "nunca" | "auto"
  return best? best.out : null;
}
/* monta os layouts de cada pavimento a partir da estrutura escolhida */
function gmMonta(poly, obst, E, o, pisos, M, FR, L){
  const R=M.R, pil=gmPilares(FR, R, L), zpil=FR.Z? gmPilaresZ(FR, R, L) : [], out={};
  const pillarsW=[...pil.map(r=>[[r[0],r[1]],[r[2],r[1]],[r[2],r[3]],[r[0],r[3]]].map(q=>FR.Wd(q[0],q[1]))), ...zpil];
  L.pisos.forEach((P,fi)=>{ const f=pisos[fi], portals=f.portals||[], blocks=[...obst, ...(f.blocks||[])], keep=f.keep||[];
    const W=gmMundo(FR, R, L, P), lay={...W};
    const refs = W.peds.length? W.peds.map(p=>p.b) : M.lobbies.length? M.lobbies.map(l=>G.centroid(l.poly)) : [obst[0]? G.centroid(obst[0]) : G.centroid(poly)];
    garPcdIdoso(lay, E, R, refs);
    let vagas=lay.vagas, Rc=null, semRota=0;
    const aislePolys=W.aisles.map(a=>a.poly), pedPolys=W.peds.filter(p=>p.poly).map(p=>p.poly);
    if(!o.quick){
      // malha de 0,5 m: o carro sai do portal e chega à frente de cada vaga, com manobra livre
      // cunhas junto às paredes inclinadas: vagas com as costas na parede, de frente para a circulação que já existe
      const cun=gmCunhas(poly, FR, R, vagas, pillarsW, W.aisles, W.peds, W.retornos, blocks, keep, Math.max(3.0, L.g.A-0.4));
      let rv=[...vagas.filter(v=>v.tipo!=="faixa"), ...cun]; Rc=rasterCheck(poly, blocks, rv, pillarsW, portals, L.g.A);
      let ok=new Set(Rc.okV); semRota=rv.filter(v=>!ok.has(v) && !v.cunha).length;
      if(semRota && cun.length){ const R0=rasterCheck(poly, blocks, rv.filter(v=>!v.cunha), pillarsW, portals, L.g.A), ok0=new Set(R0.okV), s0=rv.filter(v=>!v.cunha && !ok0.has(v)).length;
        if(s0<semRota){ Rc=R0; ok=ok0; semRota=s0 } }   // as da cunha não podem tirar o acesso de nenhuma outra
      vagas=[...vagas, ...cun].filter(v=>v.tipo==="faixa"? vagas.some(p=>p.tipo==="pcd" && ok.has(p) && garToca(p.poly,v.poly)) : ok.has(v));
      // sobras: vagas extras de frente para a circulação, sem cortar corredores, faixas e bolsões
      const faixas=vagas.filter(v=>v.tipo==="faixa");
      let Lx={vagas:vagas.filter(v=>v.tipo!=="faixa"), pillars:pillarsW, aisles:[], acc:{}, crosses:[], AI:L.g.A, ux:FR.ux, vy:FR.vy, corr:[...aislePolys, ...pedPolys, ...W.retornos, ...faixas.map(v=>v.poly)]};
      vagas=[...Lx.vagas, ...faixas];
    }
    // numeração: fileira por fileira (de cima para baixo e da esquerda para a direita, no referencial), na ordem ao longo do corredor
    { const rows=new Map(); vagas.forEach(v=>{ if(!garCar(v.tipo)) return; const k= v._f? v._f.o+":"+v.row : v.cunha!=null? "C:"+v.cunha : null; if(!k) return; if(!rows.has(k)) rows.set(k,[]); rows.get(k).push(v) });
      const ord=[...rows.values()].map(l=>{ const xs=l.map(v=>v.c[0]), ys=l.map(v=>v.c[1]); return {l, x:Math.min(...xs), y:Math.max(...ys), hor: Math.max(...xs)-Math.min(...xs) >= Math.max(...ys)-Math.min(...ys)} });
      ord.sort((a,b)=>Math.abs(a.y-b.y)>3? b.y-a.y : a.x-b.x); let n=0;   // de cima para baixo, da esquerda para a direita (no desenho)
      ord.forEach(o=>o.l.sort((a,b)=> o.hor? a.c[0]-b.c[0] : b.c[1]-a.c[1]).forEach(v=>v.num=++n));
      vagas.forEach(v=>{ if(garCar(v.tipo) && v.num==null) v.num=++n }) }
    vagas=vagas.map(v=>{ const {_f, ...r}=v; r.ang=r.ang||(_f? _f.ang : 90); return r });
    // rotas: da chegada a cada saída, pela rede de corredores, com o raio de giro nas esquinas
    const routes=[]; for(let i=1;i<portals.length;i++){ const r=garRotaRede(W.aisles, R, portals[0].p, portals[i].p) || (Rc? rota(Rc, Rc.seeds[0], Rc.seeds[i]) : null); if(r) routes.push({pts:r, de:portals[0].label, para:portals[i].label}) }
    const path=W.aisles.map(a=>({pts:[a.a, a.b], dir:a.dir||0, conn:a.conn}));
    // raio de giro nas junções (corredor × transversal) e na saída dos patamares
    let giroFalha=0; P.net.forEach(p=>{ if(p.pass || !gmReta(p)) return; P.net.filter(q=>q.i>p.i && gmReta(q) && !q.pass && !q.conn && !p.conn && q.o!==p.o && gmToca(gmRect(p),gmRect(q),0.05)).forEach(q=>{ if(!garGiroOk(p.w,q.w,R)) giroFalha++ }) });
    const passagens=P.net.filter(p=>gmEstreita(p,L.g)).map(p=>+p.w.toFixed(2));
    const lw=(+E.rampaL||3.6)+0.9; P.att.forEach((l,pi)=>{ const p=P.net.find(x=>l.includes(x.i)); const pt=P.f.PT[pi]; if(p && pt && gmReta(p)){ const par= p.o==="H"? Math.abs(pt.h[0])>0.7 : Math.abs(pt.h[1])>0.7; if(!par && !garGiroOk(lw,p.w,R)) giroFalha++ } });
    const count=vagas.filter(v=>garCar(v.tipo)).length;
    const sobras=gmSobras(FR, R, L, P, vagas, pil, W.aisles);
    // zonas inclinadas usadas neste pavimento: parede, ângulo em relação ao referencial e vagas
    const zonas=(FR.Z||[]).map(z=>({parede:z.w.i, graus:+z.graus.toFixed(1), ux:z.uz, vagas:vagas.filter(v=>v.zona===z.w.i && garCar(v.tipo)).length})).filter(z=>z.vagas>0);
    const lay2={sobras,vagas, pillars:pillarsW, path, routes, ux:FR.ux, vy:FR.vy, ang:L.g.ang, pitch:L.g.Wp, aisle:L.g.A, ok:true, count,
      grid:Rc? Rc.grid : null, reach:Rc? Rc.reach : null,
      aisles:W.aisles.map(a=>({poly:a.poly, a:a.a, b:a.b, dir:a.dir, w:a.w, conn:a.conn, o:a.o, pass:a.pass})), peds:W.peds, retornos:W.retornos, passagens,
      becos:P.becos.map(b=>({L:b.L, longo:b.longo})), giroFalha, pcd:lay.pcd, modelo:"partido", cfg:{ys:L.ys, xs:L.xs, ang:L.g.ang, zonas:(FR.Z||[]).map(z=>z.w.i)}, semRota, zonas};
    lay2.partido=gmPartido({...L, pisos:[P]});
    const V=garValida({...lay2, blocks:f.blocks||[], landings:keep}, {poly, obst, E, gx:o.gx, lobbies:M.lobbies, terreo:f.terreo});
    lay2.nota=V.nota; lay2.problemas=V.problemas; lay2.met=V.met;
    out[f.key]=lay2 });
  return out;
}
/* cunhas: entre a malha e uma parede inclinada sobra uma faixa em cunha; onde ela encosta na circulação, vagas a 90° da
   parede (costas nela) de frente para o corredor, a transversal ou a junção, com a manobra livre diante delas (a malha de
   0,5 m confere depois o caminho até cada uma). Não mexe em nada do que já está desenhado. */
function gmCunhas(poly, FR, R, vagas, pillars, aisles, peds, retornos, blocks, keep, need){
  const ws=gmParedesZ(poly, FR.ux, 6), W=R.W+R.acrP*0, C=R.C, out=[]; if(!ws.length) return out;
  const L_=ps=>ps.filter(p=>p && p.length>2).map(p=>({p, b:gmBox(p)}));
  const solido=L_([...vagas.map(v=>v.poly), ...pillars, ...blocks, ...keep]), circ=L_([...aisles.map(a=>a.poly), ...peds.map(p=>p.poly), ...peds.map(p=>p.cross), ...(retornos||[])]);
  const frentes=L_(vagas.filter(v=>v.fm && v.out && !v.presa && v.tipo!=="faixa").map(v=>frontRect(v.fm, v.out, Math.max(1.8,(v.W||R.W)-0.6), need)));
  const bate=(lst, pg, t)=>{ const b=gmBox(pg); return lst.some(o=>gmHit(o.b, b, 0.01) && garAreaInter(o.p, pg)>t) };
  const dentro=pg=>{ const c=G.centroid(pg); return G.polyInPoly(pg.map(q=>[q[0]+(c[0]-q[0])*0.01, q[1]+(c[1]-q[1])*0.01]), poly) };
  ws.forEach(w=>{ const uz=w.uz, n=[-uz[1],uz[0]], A0= G.dot(w.b,uz)>G.dot(w.a,uz)? w.a : w.b, Lw=w.L;
    for(let t=0.15; t+W<=Lw-0.15; ){
      const P0=[A0[0]+uz[0]*t+n[0]*0.02, A0[1]+uz[1]*t+n[1]*0.02], P1=[P0[0]+uz[0]*W, P0[1]+uz[1]*W], pg=[P0, P1, [P1[0]+n[0]*C, P1[1]+n[1]*C], [P0[0]+n[0]*C, P0[1]+n[1]*C]];
      const fm=[(pg[2][0]+pg[3][0])/2, (pg[2][1]+pg[3][1])/2], fr=frontRect(fm, n, W-0.6, need);
      const ok= dentro(pg) && !bate(solido, pg, 0.005) && !bate(circ, pg, 0.05) && !bate(frentes, pg, 0.05) && !bate(solido, fr, 0.3)
        && [0.6, need/2, need-0.2].every(k=>G.pip([fm[0]+n[0]*k, fm[1]+n[1]*k], poly)) && bate(circ, fr, 0.5);
      if(!ok){ t+=0.1; continue }
      const v={poly:pg, c:G.centroid(pg), fm, out:n, u:t, uc:t+W/2, row:-1, grp:-1, j:0, aisle:-1, tipo:"n", W, ang:90, cunha:w.i};
      out.push(v); solido.push({p:pg, b:gmBox(pg)}); frentes.push({p:fr, b:gmBox(fr)}); t+=W }
  });
  return out;
}
/* sobras: áreas sem vaga nem circulação (junto a núcleos, cantos, recortes) — viram depósito (encostada num corredor)
   ou área técnica (reservatório, bombas, medidores); medidas numa malha de 0,5 m no referencial */
function gmSobras(FR, R, L, P, vagas, pil, aisW){
  const [X0,Y0,X1,Y1]=FR.fb, res=0.5, nx=Math.ceil((X1-X0)/res), ny=Math.ceil((Y1-Y0)/res), cel=new Uint8Array(nx*ny);
  const rects=[...P.pcs.filter(gmReta).map(gmRect), ...(L.peds||[]).filter(p=>p.r).map(p=>p.r), ...P.becos.filter(b=>b.r).map(b=>b.r), ...pil, ...P.f.KP.map(k=>k.b)];
  // peças fora do referencial (vagas e corredores das zonas inclinadas, junções, vagas a 45°/60°): polígono exato
  const F=FR.F, pgs=[], vr=[]; vagas.forEach(v=>{ const p=v.poly.map(F); if(gmIsRect(p)) vr.push(gmBox(p)); else pgs.push(p) });
  (aisW||[]).forEach(a=>{ if(a.o==="Z"||a.o==="J") pgs.push(a.poly.map(F)) });
  (P.zpil||[]).forEach(p=>pgs.push(p.map(F)));
  const LV=FR.H0||FR.H;   // com zonas: o pavimento inteiro (a faixa inclinada também é medida)
  for(let j=0;j<ny;j++){ const v=Y0+(j+0.5)*res; let I=gmHard(LV, v-0.2, v+0.2);
    [...rects, ...vr].forEach(r=>{ if(r[1]<v+0.2 && r[3]>v-0.2) I=gmIvSub(I, r[0], r[2]) });
    I.forEach(([a,b])=>{ for(let i=Math.ceil((a-X0)/res-0.5+0.4);i<nx;i++){ const u=X0+(i+0.5)*res; if(u+0.2>b) break; if(u-0.2>=a) cel[j*nx+i]=1 } }) }
  pgs.forEach(p=>{ const b=gmBox(p), i0=Math.max(0,Math.floor((b[0]-X0)/res-1)), i1=Math.min(nx-1,Math.ceil((b[2]-X0)/res)), j0=Math.max(0,Math.floor((b[1]-Y0)/res-1)), j1=Math.min(ny-1,Math.ceil((b[3]-Y0)/res));
    for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){ const c=j*nx+i; if(!cel[c]) continue; const q=[X0+(i+0.5)*res, Y0+(j+0.5)*res];
      if(G.pip(q,p) || [[0.2,0],[-0.2,0],[0,0.2],[0,-0.2]].some(d=>G.pip([q[0]+d[0],q[1]+d[1]],p))) cel[c]=0 } });
  const vis=new Uint8Array(nx*ny), out=[], corr=P.pcs.filter(p=>!p.pass && gmReta(p)).map(gmRect), corrPg=pgs.length? (aisW||[]).filter(a=>a.o==="Z"||a.o==="J").map(a=>a.poly.map(F)) : [];
  for(let c0=0;c0<nx*ny;c0++){ if(!cel[c0]||vis[c0]) continue; const q=[c0]; vis[c0]=1;
    for(let h=0;h<q.length;h++){ const c=q[h], i=c%nx, j=(c-i)/nx; [[1,0],[-1,0],[0,1],[0,-1]].forEach(([di,dj])=>{ const ii=i+di, jj=j+dj; if(ii<0||jj<0||ii>=nx||jj>=ny) return; const n=jj*nx+ii; if(cel[n]&&!vis[n]){ vis[n]=1; q.push(n) } }) }
    if(q.length*res*res<6) continue;
    let i0=1e9,i1=-1,j0=1e9,j1=-1; q.forEach(c=>{ const i=c%nx, j=(c-i)/nx; i0=Math.min(i0,i); i1=Math.max(i1,i); j0=Math.min(j0,j); j1=Math.max(j1,j) });
    // retângulos: corridas por linha, emendadas quando se repetem na linha seguinte
    const S=new Set(q), runs=[]; for(let j=j0;j<=j1;j++){ let i=i0; while(i<=i1){ if(!S.has(j*nx+i)){ i++; continue } let k=i; while(k+1<=i1 && S.has(j*nx+k+1)) k++; runs.push([i,k,j]); i=k+1 } }
    const rs=[]; runs.forEach(([a,b,j])=>{ const r=rs.find(x=>x.a===a && x.b===b && x.j1===j-1); if(r) r.j1=j; else rs.push({a,b,j0:j,j1:j}) });
    const fr=rs.map(r=>[X0+r.a*res, Y0+r.j0*res, X0+(r.b+1)*res, Y0+(r.j1+1)*res]).filter(r=>Math.min(r[2]-r[0], r[3]-r[1])>=1.5-1e-6);
    const ar=fr.reduce((s_,r)=>s_+(r[2]-r[0])*(r[3]-r[1]),0); if(ar<6) continue;
    // acesso: encostada num corredor (carro) ou no hall dos elevadores (a pé: depósitos, medidores, bombas)
    const aces=fr.some(r=>corr.some(c=>gmToca(r,c,0.6)) || corrPg.some(pg=>gmTocaPg(r,pg,0.6)) || FR.LB.some(l=>gmToca(r,l.b,0.6)));
    const big=fr.reduce((m,r)=>(r[2]-r[0])*(r[3]-r[1])>(m[2]-m[0])*(m[3]-m[1])? r : m, fr[0]);
    out.push({area:ar, tipo: !aces && ar>40? "semAcesso" : aces? "deposito" : "tecnica", polys:fr.map(r=>[[r[0],r[1]],[r[2],r[1]],[r[2],r[3]],[r[0],r[3]]].map(q=>FR.Wd(q[0],q[1]))), c:FR.Wd((big[0]+big[2])/2,(big[1]+big[3])/2)}) }
  return out;
}
/* rótulos das vagas (número, PCD, ID…) SEMPRE na horizontal, como no desenho de projeto — nunca girados com a vaga:
   no centro dela, com o tamanho que cabe na largura horizontal da vaga naquele ponto (vaga inclinada: a corda horizontal
   pelo centro, conferida em cima, no meio e embaixo da linha de texto); reduz até `min` px e só some se nem assim couber.
   s = escala (px por metro); med(texto, px) = largura do texto em px (no canvas, measureText). Puro (testes). */
function garRotulosVagas(lay, s, med, o={}){
  const max=o.max||9, min=o.min||6, out=[]; let nCar=0; med=med||((t,px)=>t.length*px*0.6);
  (lay.vagas||[]).forEach((v,i)=>{ if(garCar(v.tipo)) nCar++;
    const t= v.tipo==="pcd"?"PCD": v.tipo==="idoso"?"ID": v.tipo==="faixa"?"": v.tipo==="off"?"×": v.tipo==="presa"?"presa": v.tipo==="moto"?"M": v.tipo==="bici"?`${v.bikes||""} bic.` : v.ev?"EV" : String(lay.modelo==="partido"? (v.num||nCar) : i+1);
    if(!t || !v.poly || v.poly.length<3) return;
    const c=v.c||G.centroid(v.poly); let w=Infinity;
    for(const dy of [-0.5,0,0.5]){ const y=c[1]+dy*max/s, iv=gmLineIv(v.poly, y).find(([a,b])=>a<=c[0]+1e-6 && b>=c[0]-1e-6); w=Math.min(w, iv? 2*Math.min(c[0]-iv[0], iv[1]-c[0]) : 0) }
    const disp=w*s-2, w0=med(t,max), tam= w0>disp? max*disp/w0 : max;
    if(!(tam>=min)) return;
    out.push({t, p:c, ang:0, tam:+tam.toFixed(2), i, ev:!!v.ev && v.tipo==="n"}) });
  return out;
}
/* um pavimento sozinho (garageSolve): mesmo caminho, grupo de um */
function garModFinal(poly, obst, E, o){ const r=garModGrupo(poly, obst, E, o, [{key:"_", portals:o.portals||[], blocks:o.blocks||[], keep:o.keep||[], terreo:o.terreo}]); return r? r._ : null }
