/* ================= Fase 2: pavimento tipo ================= */
const ESC_TIPOS = { ep:"Enclausurada protegida (EP)", pf_duto:"À prova de fumaça com antecâmara e dutos (PF)", pf_balcao:"À prova de fumaça com balcão aberto (PF)", pf_press:"Pressurizada (PFP)" };
const CORE_F=2.2, CORE_B=2.7;   // fileira da frente (elevadores/antecâmara) e do fundo (escada de 1,20 m) — eixo a eixo
/* núcleo de circulação vertical: o partido e as medidas vêm de src/calc/nucleo.js (nucleoMonta, referencial local u×v);
   aqui ele vai para o mundo (ux, vy, ponta cu0, face vEdge, sentido s) e a faixa atrás dele até a fachada (depthB além do
   fundo do núcleo) vai para as unidades vizinhas (o._notch = lados com unidade) — o núcleo fica um retângulo coeso, igual
   em todos os pavimentos. Sem vizinho (ou faixa rasa ≤ 1,2 m) o fundo do núcleo cresce até a fachada. */
function coreBuild(ux,vy,cu0,vEdge,s,depthB,o){
  const N=nucleoMonta(o), L=N.L, F=N.F, Dn=N.D, mir=o.escada==="D", Dt=F+Math.max(depthB, Dn-F);
  const P=(u,v)=>{ const uu=cu0+(mir? L-u : u), vv= s>0? vEdge+v : vEdge-v; return [ux[0]*uu+vy[0]*vv, ux[1]*uu+vy[1]*vv] };
  const R=(u,v,w,h)=>{ const uu= mir? L-u-w : u; return s>0? G.rect(ux,vy,cu0+uu,vEdge+v,w,h) : G.rect(ux,vy,cu0+uu,vEdge-v-h,w,h) };
  const cells=N.cells.map(c=>({...c})), extra=Dt-Dn, nb=o._notch||null;
  // perfil do fundo: trechos [u0,u1] e a profundidade em que o núcleo termina
  let perfil=[];
  if(N.ala) perfil=[{u0:0,u1:N.ala.u0,d:Dn},{u0:N.ala.u0,u1:L,d:N.ala.vIn}];
  else { const fc=cells.filter(c=>c.fachada); let x=0; fc.sort((a,b)=>a.u-b.u).forEach(c=>{ if(c.u>x+0.01) perfil.push({u0:x,u1:c.u,d:Dn}); perfil.push({u0:c.u,u1:c.u+c.w,d:Dt,fach:true}); x=c.u+c.w }); if(x<L-0.01) perfil.push({u0:x,u1:L,d:Dn}) }
  cells.forEach(c=>{ if(c.fachada) c.h=Dt-c.v });
  const sobras=[], absorve = extra>0.05 && (!nb || !nb.length || extra<=1.2);
  if(absorve){ // faixa rasa ou sem unidades vizinhas: o fundo do núcleo vai até a fachada (os ambientes do fundo ficam mais fundos)
    perfil.forEach(t=>{ if(t.fach) return; cells.forEach(c=>{ if(Math.abs(c.v+c.h-t.d)<0.01 && c.u>=t.u0-0.01 && c.u+c.w<=t.u1+0.01) c.h=Dt-c.v }); t.d=Dt }) }
  else if(extra>0.05 || N.ala){
    const livres=perfil.filter(t=>t.d<Dt-0.05);
    livres.forEach(t=>{ const ok=[]; if(t.u0<0.05 && nb && nb.includes("start")) ok.push("start"); if(t.u1>L-0.05 && nb && nb.includes("end")) ok.push("end");
      const pc=(side,u0,u1)=>sobras.push({side, u0, u1, vIn:t.d, vOut:Dt, poly:R(u0,t.d,u1-u0,Dt-t.d)});
      if(ok.length===2){ const sp=Math.min(t.u1-1.0, Math.max(t.u0+1.0, N.split!=null? N.split : (t.u0+t.u1)/2)); pc("start",t.u0,sp); pc("end",sp,t.u1) }
      else if(ok.length===1) pc(ok[0],t.u0,t.u1);
      else { cells.push({k:"tec", nome:"reserva técnica", u:t.u0, v:t.d, w:t.u1-t.u0, h:Dt-t.d, semAcesso:true}); t.d=Dt } });
  }
  // contorno real: frente reta + fundo pelo perfil (sem as sobras que vão para as unidades)
  const fundo=[]; perfil.slice().reverse().forEach(t=>fundo.push([t.u1,t.d],[t.u0,t.d]));
  const pts=[[0,0],[L,0],...fundo].filter((q,i,a)=>i===0||Math.hypot(q[0]-a[i-1][0],q[1]-a[i-1][1])>1e-6);
  const limpo=pts.filter((q,i)=>{ const a=pts[(i-1+pts.length)%pts.length], b=pts[(i+1)%pts.length]; return Math.abs((q[0]-a[0])*(b[1]-a[1])-(q[1]-a[1])*(b[0]-a[0]))>1e-6 });
  let outline=limpo.map(([u,v])=>P(u,v)); if(G.sArea(outline)*G.sArea(R(0,0,L,Dt))<0) outline=outline.reverse();
  { const key=q=>Math.round(G.dot(q,ux)*100)*1e6+Math.round(G.dot(q,vy)*100); let k=0; outline.forEach((q,i)=>{ if(key(q)<key(outline[k])) k=i }); outline=[...outline.slice(k),...outline.slice(0,k)] }   // mesma ordem com a escada de um lado ou do outro
  const W=c=>R(c.u,c.v,c.w,c.h), WP=q=>P(q[0],q[1]);
  const out=cells.map(c=>({...c, poly:W(c), row: c.v<0.01? "f" : "b"}));
  const doors=N.doors.map(d=>{ const a=WP(d.a), b=WP(d.b), n0=WP([d.a[0]+d.n[0], d.a[1]+d.n[1]]), nn=[n0[0]-a[0], n0[1]-a[1]], k=Math.hypot(nn[0],nn[1])||1;
    return {a, b, sw:d.sw, dir:[nn[0]/k, nn[1]/k], tipo:d.tipo==="vao"? "elev" : d.tipo, larg:d.larg} });
  const lines=nucleoDesenho({...N, cells}).map(x=> x.l? Object.assign([WP(x.l[0]),WP(x.l[1])], {c:x.c}) : x.arrow? {arrow:[WP(x.arrow[0]),WP(x.arrow[1])]} : x.dot? {dot:WP(x.dot)} : {txt:x.txt, p:WP(x.p), s:x.s, bg:x.bg});
  const lobby=R(0,-2.0,L,2.0);
  // contrato (docs/COMUNS.md §0): portas na face do núcleo, hall dos elevadores, prumadas
  const fora=(()=>{ const a=P(0,0), b=P(0,-1); return [b[0]-a[0], b[1]-a[1]] })();
  const portas=N.doors.filter(d=>["elev","escada","servico","vao"].includes(d.tipo) && Math.abs(d.a[1])<0.01 && Math.abs(d.b[1])<0.01)
    .map(d=>({p:WP([(d.a[0]+d.b[0])/2,0]), dir:fora, larg:d.larg, tipo:d.tipo==="vao"||d.tipo==="elev"? "elev" : d.tipo}));
  const els=cells.filter(c=>c.k==="elev"), hallU=cells.find(c=>c.k==="hall");
  const hallElevTipo = hallU? W(hallU) : els.length? R(Math.min(...els.map(c=>c.u)), -(+o.corr||1.6), Math.max(...els.map(c=>c.u+c.w))-Math.min(...els.map(c=>c.u)), +o.corr||1.6) : null;
  const PRU={hidraulica:"hidraulica", eletrica:"eletrica", gas:"gas", entrada:"duto-entrada", saida:"duto-saida", press:"pressurizacao"};
  const prumadas=cells.filter(c=>["shaft","duto","elev","emerg","esc"].includes(c.k)).map(c=>({k: c.k==="elev"? "elevador" : c.k==="emerg"? "emergencia" : c.k==="esc"? "escada" : PRU[c.sub]||c.sub, nome:c.nome, poly:W(c)}));
  const fach = cells.some(c=>(c.k==="esc"||c.k==="balc") && c.v+c.h>=Dt-0.01) && (o.fachada || o.escTipo==="pf_balcao" || !!o._fachada);
  const p=N.p, nucleo={partido:N.partido, partidoNome:N.partidoNome, nota:null, problemas:[], portas, hallElev:lobby, hallElevTipo, frente:[P(0,0),P(L,0)], prumadas, fachada:fach,
    dim:{L, D:Dt, F, escD:p.escD, escLarg:p.larg, degrau:{n:p.deg.n, e:p.deg.e, p:p.deg.p}, patamar:null, elev:{n:els.length, cap:p.cap, caixa:p.EV.caixa, cabine:p.EV.cabine}, ant:null},
    local:{partido:N.partido, L, D:Math.max(...cells.map(c=>c.v+c.h)), F, ala:N.ala, cells, doors:N.doors, p}};
  const esc=cells.find(c=>c.k==="esc"); if(esc){ const comp=(esc.ori==="v"? esc.h : esc.w)-NUC_R.paredeCF; nucleo.dim.patamar=Math.round((comp-p.deg.run)/2*100)/100 }
  const ant=cells.find(c=>c.k==="ant"); if(ant) nucleo.dim.ant=[Math.round((ant.w-NUC_R.paredeCF)*100)/100, Math.round((ant.h-NUC_R.paredeCF)*100)/100];
  NUC_INFO.set(lobby, nucleo);
  // poly = projeção até a fachada (contorno quando as sobras não vão para as unidades) · outline = núcleo real
  return {L, depth:Dt, cells:out, doors, lines, poly:R(0,0,L,Dt), outline, lobby, sobras, mir, nucleo};
}
// recorta um canto retangular de Q (convexo): corner = vértice do canto (u,v no referencial ux/vy), inner = canto oposto do recorte
function notchPoly(Q, ux, vy, corner, inner){
  if(!Q || Q.length<3) return null;
  const uv=Q.map(q=>[G.dot(q,ux),G.dot(q,vy)]); let k=-1, bd=0.05;
  uv.forEach((q,i)=>{ const d=Math.hypot(q[0]-corner[0],q[1]-corner[1]); if(d<bd){ bd=d; k=i } });
  if(k<0) return null;
  const n=uv.length, prev=uv[(k-1+n)%n], W=(u,v)=>[ux[0]*u+vy[0]*v, ux[1]*u+vy[1]*v];
  const a=W(inner[0],corner[1]), b=W(inner[0],inner[1]), c=W(corner[0],inner[1]);
  const ins = Math.abs(prev[1]-corner[1])<0.05 ? [a,b,c] : [c,b,a];
  return [...Q.slice(0,k), ...ins, ...Q.slice(k+1)];
}
function tipoLayout(plate, units, o){
  if(!plate || !plate.length) return null;
  // ordem do núcleo automática: escada de um lado ou do outro (o contorno do núcleo é o mesmo — garagens e térreo não mudam);
  // fica a que reparte melhor o andar pelos partidos (src/calc/reparte.js); empate = escada primeiro, como antes
  // e, se nenhuma das duas reparte bem, a escada na profundidade toda (sem a sobra em L atrás dela, que só serve à unidade
  // vizinha quando ela é larga o bastante para um partido)
  if(o.escada==="auto"){ const a=tipoLayout(plate, units, {...o, escada:"E"}); if(!a || !a.rep) return a; a.escAuto="E";   // (no otimizador, _rap: sem a busca — a área das unidades é a mesma)
    const cs=[a]; const b=tipoLayout(plate, units, {...o, escada:"D"}); const priv=l=>l.units.reduce((s,u)=>s+(u.livre? 0 : u.area),0);   // torre desenhada: a privativa vem do desenho — a ordem não pode mudá-la
    // o contorno do núcleo não pode mudar (com poucas unidades o núcleo vai para a ponta — garagens e térreo dependem dele)
    const mesmo=l=>l && l.rep && l.core.length===a.core.length && l.core.every((q,i)=>Math.abs(q[0]-a.core[i][0])<1e-6 && Math.abs(q[1]-a.core[i][1])<1e-6);
    if(mesmo(b) && (!o._areaFixa || Math.abs(priv(b)-priv(a))<0.01)){ b.escAuto="D"; cs.push(b) }
    if(o.escProf!==false && !o._areaFixa && (a.escSobra>0.5 || (b && b.escSobra>0.5))) ["E","D"].forEach(e=>{ const c=tipoLayout(plate, units, {...o, escada:e, escProf:false}); if(mesmo(c)){ c.escAuto=e; c.rep.custo+=REP_PESO.semRecorte; cs.push(c) } });
    return cs.reduce((x,y)=> y.rep.custo < x.rep.custo-0.5 ? y : x) }
  const ux=G.longestDir(plate), vy=[-ux[1],ux[0]];
  const [u0,u1]=G.extent(plate,ux), [v0,v1]=G.extent(plate,vy), D=v1-v0, Lu=u1-u0;
  const corr=o.corr, fachada = o.fachada || o.escTipo==="pf_balcao";
  const DN=nucleoMonta(o), NF=DN.F, NB=DN.D-DN.F;   // núcleo (src/calc/nucleo.js): comprimento e profundidade do partido
  const coreLen=Math.min(Lu*0.8, DN.L);
  let dbl = D >= 2*o.profMin + corr; if(o.planta==="central") dbl=true; if(o.planta==="lateral") dbl=false;
  const reg=[]; let corridor, hallEnds=[], vEdge, sgn, depthB=NB;
  const sub=(va,vb,ua,ub)=>{ const b=G.band(plate,vy,va,vb); return (ua===undefined||!b.length)? b : G.band(b,ux,ua,ub) };
  const pos=Math.min(1,Math.max(0,o.pos??0.5)), cu0=u0+0.01+pos*Math.max(0,Lu-coreLen-0.02), cu1=cu0+DN.L; // ponta real do núcleo: as unidades começam depois dela
  if(dbl){
    const vc=(v0+v1)/2, c0=vc-corr/2, c1=vc+corr/2;
    corridor = sub(c0,c1,u0+0.01,u1-0.01);
    if(o.lado==="A"){ vEdge=c1; sgn=1; if(fachada) depthB=Math.max(NB, v1-c1-NF); reg.push({p:sub(v0,c0),fac:"min"}); reg.push({p:sub(c1,v1,u0,cu0),fac:"max"}); reg.push({p:sub(c1,v1,cu1,u1),fac:"max"}) }
    else { vEdge=c0; sgn=-1; if(fachada) depthB=Math.max(NB, c0-v0-NF); reg.push({p:sub(c1,v1),fac:"max"}); reg.push({p:sub(v0,c0,u0,cu0),fac:"min"}); reg.push({p:sub(v0,c0,cu1,u1),fac:"min"}) }
  } else {
    const side = o.lado==="A";
    corridor = side? sub(v1-corr,v1,u0,u1) : sub(v0,v0+corr,u0,u1);
    vEdge = side? v1-corr : v0+corr; sgn = side? -1 : 1; depthB=Math.max(NB, D-corr-NF);
    const uv0 = side? v0 : v0+corr, uv1 = side? v1-corr : v1;
    reg.push({p:sub(uv0,uv1,u0,cu0),fac:side?"min":"max"}); reg.push({p:sub(uv0,uv1,cu1,u1),fac:side?"min":"max"});
  }
  // núcleo na fachada: a escada fica com a profundidade do lance e a sobra vai para a unidade ao lado (se houver unidade desse lado)
  const sideReg=w=>reg.find(r=>{ if(!r.p.length || G.area(r.p)<=4) return false; const [a,b]=G.extent(r.p,ux); return w==="esq"? Math.abs(b-cu0)<0.05 && a<cu0-0.5 : Math.abs(a-cu1)<0.05 && b>cu1+0.5 });
  const mirC=o.escada==="D", wSide=ls=> (ls==="start")!==mirC ? "esq" : "dir";
  const oc = (o.escProf!==false)? {...o, _notch:["start","end"].filter(ls=>sideReg(wSide(ls)))} : o;
  const CB=coreBuild(ux,vy,cu0,vEdge,sgn,depthB,oc);
  const sobraA=[], reserva=[], falhas=[];
  (CB.sobras||[]).forEach(sb=>{ const w=wSide(sb.side), r=sideReg(w); if(!r) return;
    const wu0= mirC? cu0+CB.L-sb.u1 : cu0+sb.u0, wu1= mirC? cu0+CB.L-sb.u0 : cu0+sb.u1, vIn=vEdge+sgn*sb.vIn;
    const [ra,rb]=G.extent(r.p,ux), [rva,rvb]=G.extent(r.p,vy);
    const Q=sub(rva,rvb, w==="esq"? ra : wu0, w==="esq"? wu1 : rb);
    const np=notchPoly(Q, ux, vy, [w==="esq"? wu1 : wu0, vEdge], [w==="esq"? wu0 : wu1, vIn]);
    if(np){ sobraA.push(G.area(np)-G.area(r.p)); r.p=np; reserva.push(sb.poly) } else falhas.push(sb.poly) });
  (CB.sobras||[]).forEach(sb=>{ if(!reserva.includes(sb.poly) && !falhas.includes(sb.poly)) falhas.push(sb.poly) });
  const coreOut = falhas.length ? CB.poly : CB.outline, core=coreOut;   // o núcleo real (compacto) também nas garagens e no térreo
  const cParts=CB.cells.map(c=>({nome:c.nome,kind:c.k,poly:c.poly,area:G.area(c.poly)})).concat(falhas.map(p=>({nome:"reserva técnica",kind:"tec",poly:p,area:G.area(p)})));
  const R=reg.filter(r=>r.p.length && G.area(r.p)>4).map(r=>({...r, A:G.area(r.p), list:[], used:0}));
  const us=units.map((u,i)=>({...u,i})).sort((a,b)=>b.alvo-a.alvo);
  const totalAlvo=us.reduce((s,u)=>s+u.alvo,0), totalA=R.reduce((s,r)=>s+r.A,0)||1;
  us.forEach(u=>{ let best=null, bs=-Infinity; R.forEach(r=>{ const share=r.A/totalA*totalAlvo, s=share-r.used-u.alvo*0.5; if(s>bs){ bs=s; best=r } }); if(best){ best.list.push(u); best.used+=u.alvo } });
  // poucas unidades: um trecho ficaria vazio — leva o núcleo para a ponta desse trecho
  const empty=R.find(r=>!r.list.length);
  if(empty && !o._re && us.length){ const [ea,eb]=G.extent(empty.p,ux); return tipoLayout(plate, units, {...o, _re:1, pos: (ea+eb)/2 < (cu0+cu1)/2 ? 0 : 1}) }
  // repartição pelos partidos (src/calc/reparte.js): que unidade vai em que trecho, em que ordem e com que frente
  const rep = o._st && !o._rap && typeof repReparte==="function" ? repReparte(R, us, {ux, vy, st:o._st, u0, u1, antigo:R.map(r=>r.list.map(u=>u.i)), vazioOk:!!empty}) : null;
  if(rep) R.forEach((r,ri)=>{ r.list=rep.regs[ri].list; r.cuts=rep.regs[ri].cuts });
  const out=[], sacTipo=o.sacTipo||"embutida", prof=o.sacProf||1.6;
  R.forEach(r=>{
    if(!r.list.length){ out.push({poly:r.p, nome:"livre", alvo:0, area:r.A, livre:true}); return }
    if(!r.cuts) r.list.sort((a,b)=>a.i-b.i);
    const tot=r.list.reduce((s,u)=>s+u.alvo,0); let a2=0; const [mn,mx]=G.extent(r.p,ux); let prev=mn;
    r.list.forEach((u,j)=>{ a2+=u.alvo; const cut = r.cuts? (j===r.list.length-1 ? mx : r.cuts[j+1]) : j===r.list.length-1 ? mx : G.cutAt(r.p,ux,a2/tot); const poly=G.band(r.p,ux,prev,cut);
      const un={poly, nome:u.nome, alvo:u.alvo, area:G.area(poly), fac:r.fac};
      if(u.sac>0 && poly.length){ const [pv0,pv1]=G.extent(poly,vy), wU=cut-prev, w=Math.max(1.2,Math.min(wU-1, u.sac/prof)), pr=u.sac/w, uc=(prev+cut)/2;
        let va,vb; if(r.fac==="max"){ va= sacTipo==="balanco"? pv1 : pv1-pr; vb=va+pr } else { vb= sacTipo==="balanco"? pv0 : pv0+pr; va=vb-pr }
        let sp=G.rect(ux,vy,uc-w/2,va,w,vb-va); if(sacTipo!=="balanco"){ sp=G.clipToPoly(sp, poly.length>4? plate : poly) }
        un.sac={poly:sp, area:G.area(sp), tipo:sacTipo} }
      prev=cut; out.push(un) });
  });
  const kinds={}; cParts.forEach(c=>kinds[c.kind]=(kinds[c.kind]||0)+c.area);
  return {ux,vy,units:out,rep:rep? {custo:rep.custo, antigo:rep.antigo} : null,core,lobby:CB.lobby,coreParts:cParts,coreDoors:CB.doors,coreLines:CB.lines,corridor,dbl,hallEnds,coreA:G.area(coreOut),coreKinds:kinds,fachada,coreOut,coreReserva:[],escSobra:0,nucleo:CB.nucleo};
}

