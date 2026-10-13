/* ================= 1.1 tabela de vendas: sol, vista e preço por unidade =================
   m.unidades[] (via HOOK.compute): torre, andar, final, tipologia, área, polígono, fachadas externas,
   sol {inverno, equinocio, verao, media} (horas de sol direto na fachada), vista (0 a 1), prêmios e preço.
   Sol: pontos a cada 1,5 m ao longo das fachadas, na meia altura de cada pavimento; raios a cada 15 min
   (21/jun, 21/set, 21/dez) contra o próprio prédio, as outras torres e o entorno (geometria de prisms()).
   Um raio horizontal por ponto em planta serve a todos os andares: cada obstáculo vira um intervalo de alturas
   sombreadas [z0 − s_saída·tg(alt), z1 − s_entrada·tg(alt)]. Cache pela assinatura da geometria. */
extendDEF("venda", {
  modo: "medio",            // "medio" = VGV pelo preço médio do mix · "unidade" = VGV = soma da tabela
  andarPct: 0.005, andarTeto: 0.10,   // prêmio por andar acima do 1º, com teto
  solPct: 0.015, solPiso: -0.08, solTeto: 0.08, // % por hora média acima da mediana do prédio
  vistaPct: 0.04,           // até ±4% (0,25 de vista acima/abaixo da mediana dá o máximo)
  cobPct: 0,                // prêmio extra das coberturas (o preço/m² delas já está no mix)
  orient: { N: 0.03, NE: 0.03, L: 0.01, SE: -0.015, S: -0.03, SO: -0.025, O: -0.01, NO: 0.015 },
  manterMedia: false,       // redistribui sem mudar o total do preço médio
  cor: "nada",              // cor das unidades no 3D e na planta tipo: nada | preco | sol
  andarTipo: 0              // andar mostrado na planta tipo (0 = o mais alto)
});
const UNI_DIRS = ["N","NE","L","SE","S","SO","O","NO"];
const UNI_ORIENT_SUL = { N: 0.03, NE: 0.03, L: 0.01, SE: -0.015, S: -0.03, SO: -0.025, O: -0.01, NO: 0.015 };
const UNI_ORIENT_NORTE = { S: 0.03, SE: 0.03, L: 0.01, NE: -0.015, N: -0.03, NO: -0.025, O: -0.01, SO: 0.015 };

/* vetor solar com a latitude e o norte do estudo (mesma fórmula de sunVectorAt, sem depender do S global) */
function uniSunVec(st, mes, dia, hora){
  const lat=(+st.lote.lat||0)*Math.PI/180;
  const n=Math.floor((Date.UTC(2026,mes-1,dia)-Date.UTC(2026,0,0))/864e5);
  const dec=23.44*Math.PI/180*Math.sin(2*Math.PI*(284+n)/365), Hh=(hora-12)*15*Math.PI/180;
  const alt=Math.asin(Math.sin(lat)*Math.sin(dec)+Math.cos(lat)*Math.cos(dec)*Math.cos(Hh));
  const az=Math.atan2(Math.sin(Hh), Math.cos(Hh)*Math.sin(lat)-Math.tan(dec)*Math.cos(lat))+Math.PI;
  const th=(st.lote.norte||0)*Math.PI/180, north=[Math.sin(th),Math.cos(th)], east=[Math.cos(th),-Math.sin(th)];
  const e=Math.sin(az)*Math.cos(alt), nn=Math.cos(az)*Math.cos(alt);
  return {alt, x:east[0]*e+north[0]*nn, y:east[1]*e+north[1]*nn, z:Math.sin(alt)};
}
/* passos de dt horas (no meio de cada intervalo) com o sol acima do horizonte */
function uniSuns(st, mes, dia, dt){
  const out=[];
  for(let h=4+dt/2; h<20; h+=dt){ const v=uniSunVec(st,mes,dia,h); if(v.alt>0.005){ const hl=Math.hypot(v.x,v.y)||1e-9; out.push({h, dx:v.x/hl, dy:v.y/hl, tan:v.z/hl, alt:v.alt}) } }
  return out;
}
/* dias de referência (21/jun é inverno no hemisfério sul) */
function uniDias(st){ const sul=(+st.lote.lat||0)<=0; return {inverno: sul?6:12, equinocio: 9, verao: sul?12:6} }
function uniBB(p){ let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity; p.forEach(q=>{ if(q[0]<a)a=q[0]; if(q[1]<b)b=q[1]; if(q[0]>c)c=q[0]; if(q[1]>d)d=q[1] }); return [a,b,c,d] }
function uniObst(PR){ return PR.filter(p=>p.poly&&p.poly.length>2&&p.z1>p.z0).map(p=>({poly:p.poly, z0:p.z0, z1:p.z1, own:!!p.own, bb:p.bb||uniBB(p.poly)})) }
/* interseções (distâncias horizontais s) do raio p + s·d com o contorno do polígono; devolve quantas, em ordem, em pares entrada/saída */
const _uniS = new Float64Array(256);
// apelidos no escopo do script: laços quentes sem consultar o objeto global (rápido também no vm do Node)
const uAtan2=Math.atan2, uCos=Math.cos, uSin=Math.sin, uPI=Math.PI;
function uniRay(px, py, dx, dy, q){
  const bb=q.bb; let t0=0, t1=1e300;
  if(dx<1e-12 && dx>-1e-12){ if(px<bb[0]||px>bb[2]) return 0 } else { let a=(bb[0]-px)/dx, b=(bb[2]-px)/dx; if(a>b){ const t=a; a=b; b=t } if(a>t0)t0=a; if(b<t1)t1=b }
  if(dy<1e-12 && dy>-1e-12){ if(py<bb[1]||py>bb[3]) return 0 } else { let a=(bb[1]-py)/dy, b=(bb[3]-py)/dy; if(a>b){ const t=a; a=b; b=t } if(a>t0)t0=a; if(b<t1)t1=b }
  if(t0>t1) return 0;
  const P=q.poly, L=P.length; let n=0;
  for(let i=0;i<L;i++){
    const a=P[i], b=P[(i+1)%L], ex=b[0]-a[0], ey=b[1]-a[1], det=ex*dy-dx*ey; if(det<1e-12 && det>-1e-12) continue;
    const wx=a[0]-px, wy=a[1]-py, s=(ex*wy-wx*ey)/det, u=(dx*wy-dy*wx)/det;
    if(u>=0 && u<1 && s>1e-9 && n<255) _uniS[n++]=s;
  }
  if(!n) return 0;
  // ordena (poucos valores: inserção)
  for(let i=1;i<n;i++){ const v=_uniS[i]; let j=i-1; while(j>=0&&_uniS[j]>v){ _uniS[j+1]=_uniS[j]; j-- } _uniS[j+1]=v }
  if(n%2){ for(let i=n;i>0;i--) _uniS[i]=_uniS[i-1]; _uniS[0]=0; n++ } // ponto dentro do polígono
  return n;
}
/* intervalos de altura sombreados por todos os obstáculos para um raio (dx,dy,tan) saindo de (px,py): preenche lo/hi, devolve quantos */
function uniShadeInt(px, py, sun, obst, lo, hi, filt){
  let k=0;
  for(let o=0;o<obst.length;o++){ const q=obst[o]; if(filt!==void 0 && q.own!==filt) continue;
    const n=uniRay(px,py,sun.dx,sun.dy,q);
    for(let i=0;i+1<n;i+=2){ const a=q.z0-_uniS[i+1]*sun.tan, b=q.z1-_uniS[i]*sun.tan; if(b>a && b>0 && k<lo.length){ lo[k]=a; hi[k]=b; k++ } }
  }
  return k;
}
const uniIn = (z, lo, hi, k)=>{ for(let i=0;i<k;i++) if(z>lo[i] && z<hi[i]) return true; return false };

/* fachadas externas de um polígono de unidade: lados que caem no contorno da laje */
function uniFacades(poly, plate, st, spacing){
  if(!poly||poly.length<3||!plate||plate.length<3) return [];
  const th=(st.lote.norte||0)*Math.PI/180, N=[Math.sin(th),Math.cos(th)], E=[Math.cos(th),-Math.sin(th)], out=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i], b=poly[(i+1)%poly.length], dx=b[0]-a[0], dy=b[1]-a[1], len=Math.hypot(dx,dy); if(len<0.6) continue;
    const ux=dx/len, uy=dy/len, mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
    // o lado está sobre algum lado da laje (colinear e sobreposto)?
    let on=false;
    for(let j=0;j<plate.length && !on;j++){ const c=plate[j], d=plate[(j+1)%plate.length], ex=d[0]-c[0], ey=d[1]-c[1], l2=Math.hypot(ex,ey); if(l2<0.3) continue;
      const cr=Math.abs((ex/l2)*uy-(ey/l2)*ux), dist=Math.abs(((mid[0]-c[0])*ey-(mid[1]-c[1])*ex)/l2), t=((mid[0]-c[0])*ex+(mid[1]-c[1])*ey)/(l2*l2);
      if(cr<0.02 && dist<0.06 && t>-0.01 && t<1.01) on=true }
    if(!on) continue;
    let n=[uy,-ux]; if(G.pip([mid[0]+n[0]*0.15, mid[1]+n[1]*0.15], plate)) n=[-n[0],-n[1]];
    const az=((Math.atan2(G.dot(n,E), G.dot(n,N))*180/Math.PI)+360)%360, dir=UNI_DIRS[Math.round(az/45)%8];
    const k=Math.max(1,Math.round(len/spacing)), pts=[];
    for(let s=0;s<k;s++){ const t=(s+0.5)/k; pts.push([a[0]+dx*t+n[0]*0.05, a[1]+dy*t+n[1]*0.05]) }
    out.push({a, b, len, n, az, dir, pts});
  }
  return out;
}

/* grupos de cálculo: por torre, uma planta (tipo ou cobertura) e a lista de andares que a repetem */
function uniGroups(st, m, spacing){
  const P=st.produto, groups=[];
  (m.T||[]).forEach((t,ti)=>{
    if(!t.plate||t.plate.length<3) return;
    const lay=m.tipo&&m.tipo[ti], base=m.hEmb+(m.pavLz&&ti===0? P.pe : 0);
    const units = lay? lay.units.filter(u=>!u.livre && u.poly && u.poly.length>2) : [{poly:t.plate, nome:"", alvo:t.A}];
    // um grupo por faixa de andares (torre escalonada 2.4 / pilha de blocos): a planta do andar recorta as unidades do tipo
    const fxs = t.faixas && t.faixas.length ? t.faixas : [{de:1, ate:t.pav, plate:t.plate}];
    fxs.forEach((f,fk)=>{
      const pl = f.plate && f.plate.length>2 ? f.plate : null; if(!pl) return;
      const floors=[]; for(let k=f.de-1;k<Math.min(f.ate,t.tipoFloors);k++) floors.push({k, z:base+k*P.pe+P.pe/2});
      if(!floors.length) return;
      const us = f.lay ? f.lay.units.filter(u=>!u.livre && u.poly && u.poly.length>2)   // C2: bloco com layout próprio (mesmo núcleo, unidades por área)
        : pl===t.plate ? units : units.map(u=>({...u, poly:G.clipToPoly(u.poly, pl)})).filter(u=>u.poly.length>2 && G.area(u.poly)>4);
      groups.push({ti, fk, kind:"tipo", plate:pl, units:us.map(u=>({poly:u.poly, nome:u.nome, alvo:u.alvo, fac:uniFacades(u.poly,pl,st,spacing)})), floors});
    });
    if(t.hasCob){ const fl=fxs[fxs.length-1], cp=fl.plate && fl.plate.length>2 ? fl.plate : t.plate;
      const n=Math.max(1,P.cob.qtd), ux=G.longestDir(cp), [mn,mx]=G.extent(cp,ux), cu=[];
      for(let k=0;k<n;k++){ const a=k? G.cutAt(cp,ux,k/n):mn, b=k<n-1? G.cutAt(cp,ux,(k+1)/n):mx; cu.push(G.band(cp,ux,a,b)) }
      groups.push({ti, kind:"cob", plate:cp, units:cu.map(p=>({poly:p, fac:uniFacades(p,cp,st,spacing)})), floors:[{k:t.pav-1, z:base+(t.pav-1)*P.pe+P.pe/2}]});
    }
  });
  return groups;
}

/* sol (horas por dia de referência) e vista de cada unidade × andar de um grupo */
function uniGroupSun(st, g, obst, o){
  const dt=o.dt||0.25, D=uniDias(st), days=[["inverno",D.inverno],["equinocio",D.equinocio],["verao",D.verao]];
  const nU=g.units.length, F=o.floors||g.floors.map((f,i)=>i), nF=F.length, zs=F.map(i=>g.floors[i].z);
  const res=g.units.map(()=>F.map(()=>({inverno:0, equinocio:0, verao:0, media:0, vista:null})));
  const lo=new Float64Array(64), hi=new Float64Array(64);
  const facs=[]; g.units.forEach((u,ui)=>u.fac.forEach(f=>facs.push({ui, f})));
  const cnt=new Float64Array(facs.length*nF);
  days.forEach(([key,mes])=>{
    const suns=uniSuns(st,mes,21,dt);
    suns.forEach(sun=>{
      cnt.fill(0);
      facs.forEach(({f},fi)=>{
        if(sun.dx*f.n[0]+sun.dy*f.n[1] <= 0.01) return; // sol de costas (ou rasante) para a fachada
        f.pts.forEach(p=>{ const k=uniShadeInt(p[0],p[1],sun,obst,lo,hi); for(let j=0;j<nF;j++) if(!uniIn(zs[j],lo,hi,k)) cnt[fi*nF+j]++ });
      });
      // a unidade recebe, em cada instante, a melhor das suas fachadas (fração dos pontos iluminados)
      for(let ui=0;ui<nU;ui++) for(let j=0;j<nF;j++){ let best=0; facs.forEach(({ui:u,f},fi)=>{ if(u!==ui) return; const v=cnt[fi*nF+j]/f.pts.length; if(v>best) best=v }); res[ui][j][key]+=best*dt }
    });
  });
  res.forEach(r=>r.forEach(x=>{ x.media=(x.inverno+2*x.equinocio+x.verao)/4 }));
  if(o.vista!==false){
    // vista: leque de 7 direções (±60° da normal) — fração de céu acima dos obstáculos, mais a altura do andar
    const fan=[-60,-40,-20,0,20,40,60].map(a=>a*uPI/180);
    const skyF=new Float64Array(facs.length*nF);
    facs.forEach(({f},fi)=>{
      const nAng=uAtan2(f.n[1],f.n[0]); let nS=0;
      f.pts.forEach(p=>fan.forEach(da=>{
        const dx=uCos(nAng+da), dy=uSin(nAng+da), hits=[];
        obst.forEach(q=>{ const n=uniRay(p[0],p[1],dx,dy,q); if(n>=2) hits.push([_uniS[0]>0.5? _uniS[0] : 0.5, q.z1]) });
        for(let j=0;j<nF;j++){ let th=0; hits.forEach(([s,z1])=>{ if(z1>zs[j]){ const a=uAtan2(z1-zs[j], s); if(a>th) th=a } }); skyF[fi*nF+j]+=1-th/(uPI/2) }
        nS++;
      }));
      for(let j=0;j<nF;j++) skyF[fi*nF+j]/=Math.max(1,nS);
    });
    for(let ui=0;ui<nU;ui++) for(let j=0;j<nF;j++){ let best=null; facs.forEach(({ui:u},fi)=>{ if(u!==ui) return; const v=skyF[fi*nF+j]; if(best===null||v>best) best=v });
      res[ui][j].vista = best===null? null : Math.max(0,Math.min(1, 0.75*best + 0.25*Math.min(1, zs[j]/60))) }
  }
  return res;
}

/* cache em dois níveis: completo (1,5 m · 15 min) e rascunho (3 m · 30 min, usado ao arrastar controles) */
const _uniCache={full:null, rough:null};
const uniNow=()=> (typeof performance!=="undefined"? performance.now() : Date.now());
/* cálculo geométrico (sol + vista), em cache pela assinatura da geometria */
function unidadesGeo(st, m, o={}){
  const PR=o.prisms||prisms(st,m), obst=uniObst(PR);
  const geoSig=JSON.stringify([+st.lote.lat||0, st.lote.norte||0, obst.map(q=>[q.poly,q.z0,q.z1]),
    (m.T||[]).map((t,ti)=>[t.plate, t.tipoFloors, t.hasCob, m.tipo&&m.tipo[ti]? m.tipo[ti].units.map(u=>u.poly) : 0, (t.faixas||[]).map(f=>f.lay? f.lay.units.map(u=>u.poly) : 0)]), m.hEmb, m.pavLz, st.produto.pe, st.produto.cob.qtd]);
  const full=_uniCache.full;
  if(full && full.sig===geoSig) return full;
  if(o.rough){ const r=_uniCache.rough; if(r && r.sig===geoSig) return r }
  const t0=uniNow(), sp=o.rough? 3 : 1.5, dt=o.rough? 0.5 : 0.25, groups=uniGroups(st,m,sp);
  const sun=groups.map(g=>uniGroupSun(st,g,obst,{dt, vista:true}));
  const ent={sig:geoSig, groups, sun, ms:uniNow()-t0, rough:!!o.rough};
  if(o.rough) _uniCache.rough=ent; else _uniCache.full=ent;
  return ent;
}

const uniMediana = a=>{ const v=a.filter(x=>x!=null&&isFinite(x)).sort((p,q)=>p-q); if(!v.length) return 0; const h=v.length>>1; return v.length%2? v[h] : (v[h-1]+v[h])/2 };
/* monta m.unidades: unidades do mix (com o preço base de cada uma), geometria e sol, prêmios e preço */
function unidadesCalc(st, m, o={}){
  const P=st.produto, V=st.venda||DEF.venda, geo=unidadesGeo(st,m,o), out=[];
  const gIdx=(ti,kind)=>geo.groups.findIndex(g=>g.ti===ti&&g.kind===kind);
  (m.T||[]).forEach((t,ti)=>{
    const lay=m.tipo&&m.tipo[ti], base0=(m.pavLz&&ti===0)?1:0;
    // finais: ordem horária a partir do norte, em volta do centro da laje
    const c=G.centroid(t.plate||[]), th=(st.lote.norte||0)*Math.PI/180, N=[Math.sin(th),Math.cos(th)], E=[Math.cos(th),-Math.sin(th)];
    const ang=p=>{ if(!p||!p.length) return 999; const q=G.centroid(p), d=[q[0]-c[0],q[1]-c[1]]; return ((Math.atan2(G.dot(d,E),G.dot(d,N))*180/Math.PI)+360+22.5)%360 };
    // por faixa de andares (uma só, sem escalonamento): o mix e o fator de área da faixa
    const fxs = t.faixas && t.faixas.length ? t.faixas : [{de:1, ate:t.pav}];
    fxs.forEach((f,fk)=>{
      const k0=f.de-1, k1=Math.min(f.ate,t.tipoFloors); if(k1<=k0) return;
      const qtd=f.qtd||P.mix.map(u=>u.qtd), r=f.r??t.r;
      // casa cada item do mix com uma unidade da planta (mesmo nome e área; numa faixa recuada, pelo nome)
      const list=[]; P.mix.forEach((u,j)=>{ for(let q=0;q<(qtd[j]||0);q++) list.push({nome:u.nome, alvo:u.area*r, preco:u.preco, j}) });
      const gi=geo.groups.findIndex(g=>g.ti===ti && g.kind==="tipo" && (g.fk??0)===fk), g=gi>=0? geo.groups[gi] : null, used=new Set();
      const match=list.map(it=>{ if(!g) return -1; let k=g.units.findIndex((u,ui)=>!used.has(ui) && u.nome===it.nome && Math.abs(u.alvo-it.alvo)<1e-6);
        if(k<0 && g.plate!==t.plate) k=g.units.findIndex((u,ui)=>!used.has(ui) && u.nome===it.nome); if(k>=0) used.add(k); return k });
      const ord=list.map((it,i)=>i).sort((a,b)=>{ const pa=match[a]>=0? g.units[match[a]].poly : null, pb=match[b]>=0? g.units[match[b]].poly : null; return ang(pa)-ang(pb) || a-b });
      const fin=new Array(list.length); ord.forEach((i,k)=>fin[i]=k+1);
      for(let k=k0;k<k1;k++){
        const andar=k+1+base0, kg=k-k0;
        list.forEach((it,i)=>{
          const ui=match[i], gu=ui>=0? g.units[ui] : null, s=ui>=0? geo.sun[gi][ui][kg] : null;
          out.push(uniObj(st, {torre:ti+1, andar, final:fin[i], tipologia:it.nome, j:it.j, area:it.alvo, cob:false, base:it.alvo*it.preco,
            poly:gu? gu.poly : null, fac:gu? gu.fac : [], z:g? g.floors[kg].z : null, k, sol:s}));
        });
      }
    });
    if(t.hasCob){
      const gc=gIdx(ti,"cob"), gg=gc>=0? geo.groups[gc] : null, n=Math.max(1,P.cob.qtd), a=t.cobP/n;
      for(let q=0;q<n;q++){ const gu=gg&&gg.units[q], s=gg? geo.sun[gc][q][0] : null;
        out.push(uniObj(st, {torre:ti+1, andar:t.pav+base0, final:q+1, tipologia:"Cobertura", j:-1, area:a, cob:true, base:a*P.cob.preco,
          poly:gu? gu.poly : null, fac:gu? gu.fac : [], z:gg? gg.floors[0].z : null, k:t.pav-1, sol:s})) }
    }
  });
  uniPrecos(out, V);
  return {lista:out, ms:geo.ms, rough:geo.rough};
}
function uniObj(st, u){
  const s=u.sol, fl=(u.fac||[]).reduce((a,f)=>a+f.len,0);
  return {id:`T${u.torre}-${u.andar}${String(u.final).padStart(2,"0")}`, torre:u.torre, andar:u.andar, final:String(u.final).padStart(2,"0"),
    tipologia:u.tipologia, mix:u.j, area:u.area, cob:u.cob, poly:u.poly, z:u.z, k:u.k,
    fachadas:(u.fac||[]).map(f=>({dir:f.dir, az:f.az, len:f.len, n:f.n})), fachadaLen:fl,
    sol: s? {inverno:s.inverno, equinocio:s.equinocio, verao:s.verao, media:s.media} : null, vista: s? s.vista : null,
    base:u.base, premios:null, preco:u.base, precoM2:u.area? u.base/u.area : 0};
}
/* prêmios e preço (barato: roda a cada mudança de premissa) */
function uniPrecos(list, V){
  const medSol=uniMediana(list.map(u=>u.sol&&u.sol.media)), medVis=uniMediana(list.map(u=>u.vista));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), O=V.orient||{};
  list.forEach(u=>{
    const pr={andar:0, sol:0, orient:0, vista:0, cob:0};
    pr.andar=Math.min(V.andarTeto, Math.max(0,(u.andar-1))*V.andarPct);
    if(u.sol) pr.sol=clamp(V.solPct*(u.sol.media-medSol), V.solPiso, V.solTeto);
    // orientação: a melhor entre as fachadas relevantes (≥ 30% do comprimento de fachada da unidade)
    const rel=u.fachadas.filter(f=>f.len>=0.3*u.fachadaLen); if(rel.length) pr.orient=Math.max(...rel.map(f=>+O[f.dir]||0));
    if(u.vista!=null) pr.vista=V.vistaPct*clamp((u.vista-medVis)/0.25,-1,1);
    if(u.cob) pr.cob=V.cobPct||0;
    pr.total=pr.andar+pr.sol+pr.orient+pr.vista+pr.cob;
    u.premios=pr; u.preco=u.base*(1+pr.total);
  });
  if(V.manterMedia){ const sb=list.reduce((s,u)=>s+u.base,0), sp=list.reduce((s,u)=>s+u.preco,0); if(sp>0){ const k=sb/sp; list.forEach(u=>{ u.preco*=k; u.premios.ajuste=k-1 }) } }
  list.forEach(u=>{ u.precoM2=u.area? u.preco/u.area : 0 });
  return {medSol, medVis};
}
/* soma da tabela */
function unidadesTotal(list){ return (list||[]).reduce((s,u)=>s+u.preco,0) }

/* estimativa RÁPIDA do sol médio das unidades (horas/dia; média de inverno, 2× equinócio e verão), para o otimizador:
   pontos a cada 3 m, passos de 30 min, só 3 andares (primeiro, meio e último) e sem vista. Usa m.unidades se já calculado. */
let _uniQuick=null;
function unidadesSolMedio(st, m){
  if(m && m.unidades && m.unidades.length && m.unidades.some(u=>u.sol)){ const v=m.unidades.filter(u=>u.sol); return v.reduce((s,u)=>s+u.sol.media,0)/v.length }
  if(!m || !m.T || !m.T.length) return 0;
  const PR=prisms(st,m), obst=uniObst(PR), groups=uniGroups(st,m,3);
  const sig=JSON.stringify([+st.lote.lat||0, st.lote.norte||0, obst.map(q=>[q.poly,q.z0,q.z1]), groups.map(g=>[g.units.map(u=>u.poly), g.floors.map(f=>f.z)])]);
  if(_uniQuick && _uniQuick.sig===sig) return _uniQuick.v;
  let sum=0, n=0;
  groups.forEach(g=>{ const L=g.floors.length, F=[...new Set([0, L>>1, L-1])].filter(i=>i>=0&&i<L), w=L/F.length;
    const r=uniGroupSun(st,g,obst,{dt:0.5, floors:F, vista:false});
    r.forEach((uf,ui)=>{ if(!g.units[ui].fac.length) return; uf.forEach(x=>{ sum+=x.media*w; n+=w }) }) });
  const v=n? sum/n : 0; _uniQuick={sig, v}; return v;
}

/* gancho: m.unidades em todo cálculo completo; o otimizador (opt.quick) não paga nada */
const uniMixRes = (m, st)=> m.unitRows.reduce((s,u)=>s+u.area*u.preco,0) + m.cobArea*st.produto.cob.preco;
HOOK.compute.push((m, st, opt)=>{
  if(!st.venda) return;
  if(opt && opt.quick){
    // cálculo rápido (otimizador, prévia enquanto o Worker calcula): sem unidades; no modo por unidade, o VGV segue
    // a razão tabela/preço médio do último cálculo completo mostrado na página (sem saltos nos indicadores)
    if(st.venda.modo==="unidade"){ const L=typeof window!=="undefined" && window && window._last && window._last.m; if(L && L.unidadesRazao) m.vgvUnidades=uniMixRes(m,st)*L.unidadesRazao }
    return;
  }
  const r=unidadesCalc(st, m, {rough: !!(opt && opt.layouts===false)});
  m.unidades=r.lista; m.unidadesMs=r.ms; m.unidadesRascunho=r.rough;
  m.unidadesTot=unidadesTotal(r.lista);
  const mix=uniMixRes(m,st); m.unidadesRazao= mix>0? m.unidadesTot/mix : 1;
  if(st.venda.modo==="unidade") m.vgvUnidades=m.unidadesTot;
});
