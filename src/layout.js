/* ================= Fase 2: pavimento tipo ================= */
const ESC_TIPOS = { ep:"Enclausurada protegida (EP)", pf_duto:"À prova de fumaça com antecâmara e dutos (PF)", pf_balcao:"À prova de fumaça com balcão aberto (PF)", pf_press:"Pressurizada (PFP)" };
const CORE_F=2.4, CORE_B=2.7;
// sequência das peças do núcleo em duas fileiras: frente (abre para o hall) e fundo (escada)
function coreSeq(o){
  const t=o.escTipo||"pf_duto", nE=Math.max(1,o.nElev||2), front=[], back=[];
  const grp=(second)=>{ const fr=[], bk=[];
    if(t==="pf_balcao"){ fr.push({k:"pass",nome:"acesso",w:2.2,door:"hall",door2:"balc"}); bk.push({k:"balc",nome:"balcão aberto",w:2.2,doorSide:"esc"},{k:"esc",nome:"escada",w:5.8}) }
    else { bk.push({k:"esc",nome:"escada",w:5.8}); if(t==="pf_press") bk.push({k:"duto",nome:"pressurização",w:1.0});
      if(t==="ep") fr.push({k:"ant",nome:"hall da escada",w:1.8,door:"hall",door2:"esc"});
      else { fr.push({k:"ant",nome:"antecâmara",w:2.2,door:"hall",door2:"esc"}); if(t==="pf_duto") fr.push({k:"duto",nome:"dutos",w:0.8}) } }
    if(!second && o.emerg) fr.splice(1,0,{k:"emerg",nome:"elev. emergência",w:2.3,doorSide:"ant"});
    return {fr,bk} };
  const g1=grp(false);
  front.push(...g1.fr); back.push(...g1.bk);
  for(let i=0;i<nE;i++) front.push({k:"elev",nome:"elevador",w:2.1,door:"hall"});
  front.push({k:"shaft",nome:"shafts",w:1.1,door:"hall"});
  if(o.nEsc===2){ const g2=grp(true); return {front, back, g2} }
  return {front, back, g2:null};
}
function coreBuild(ux,vy,cu0,vEdge,s,depthB,o){
  const seq=coreSeq(o), F=CORE_F, B=depthB;
  // posições ao longo do núcleo
  let fu=0; const fr=seq.front.map(c=>{ const r={...c,u:fu}; fu+=c.w; return r });
  let bu=0; const bk=seq.back.map(c=>{ const r={...c,u:bu}; bu+=c.w; return r });
  if(seq.g2){ const Lpre=Math.max(fu,bu); let f2=Math.max(fu, Lpre), b2=f2; seq.g2.fr.reverse().forEach(()=>{}); 
    const g2f=seq.g2.fr.slice(), g2b=seq.g2.bk.slice(); const wf=g2f.reduce((a,c)=>a+c.w,0), wb=g2b.reduce((a,c)=>a+c.w,0); const L2=Math.max(Lpre+Math.max(wf,wb), 0);
    let x=L2-wf; g2f.forEach(c=>{ fr.push({...c,u:x}); x+=c.w }); x=L2-wb; g2b.forEach(c=>{ bk.push({...c,u:x}); x+=c.w }); fu=L2; bu=L2 }
  if(!seq.g2){ const gap=fu-bu; // fundo menor que a frente: nada de “sobras” sem acesso
    if(gap>1.6){ const ps={k:"pass",nome:"serviço",w:1.0,u:fu,door:"hall",door2:"hserv"}; fr.push(ps); fu+=1.0; const gw=fu-bu;
      // fundo que sobra vira hall de serviço (elevadores com porta dupla) + lixo/DML — tudo com acesso
      if(gw>3.2){ bk.push({k:"lixo",nome:"lixo / DML",w:1.6,u:bu,doorSide:"hserv"}, {k:"hserv",nome:"hall de serviço",w:gw-1.6,u:bu+1.6}) }
      else { bk.push({k:"lixo",nome:"lixo / DML",w:gw,u:bu}); ps.door2="lixo" }
      bu=fu }
    else if(gap>0.3){ bk.push({k:"shaft",nome:"shafts",w:gap,u:bu}); bu=fu } }
  const L=Math.max(fu,bu);
  // completa lacunas: frente vira hall; fundo vira área técnica
  const fill=(row,k,nome)=>{ row.sort((a,b)=>a.u-b.u); const out=[]; let x=0; row.forEach(c=>{ if(c.u-x>0.3) out.push({k,nome,w:c.u-x,u:x}); out.push(c); x=c.u+c.w }); if(L-x>0.3) out.push({k,nome,w:L-x,u:x}); return out };
  const FR=fill(fr,"hall","hall"), BK=fill(bk,"tec","área técnica").flatMap(c=>{ if(c.k!=="tec") return [c];
    if(c.w<=2.4) return [{...c,k:"shaft",nome:"shafts"}];
    return [{k:"lixo",nome:"lixo / DML",w:1.6,u:c.u,doorSide:"hserv"},{k:"hserv",nome:"hall de serviço",w:c.w-1.6,u:c.u+1.6}] });
  const mir=o.escada==="D";
  const U=(u,w)=> mir? cu0+(L-u-w) : cu0+u;
  const R=(u,w,va,vb)=>{ const uu=U(u,w); return s>0? G.rect(ux,vy,uu,vEdge+va,w,vb-va) : G.rect(ux,vy,uu,vEdge-vb,w,vb-va) };
  const P=(u,v)=>{ const uu=mir? cu0+L-u : cu0+u, vv= s>0? vEdge+v : vEdge-v; return [ux[0]*uu+vy[0]*vv, ux[1]*uu+vy[1]*vv] };
  const cells=[], doors=[], lines=[];
  FR.forEach(c=>cells.push({...c, poly:R(c.u,c.w,0,F), row:"f"}));
  // escada na ponta do núcleo encostado na fachada: profundidade do lance real (2 lances + parede), o resto volta para a unidade vizinha
  const escD=o._escD||CORE_B, notches=[];
  BK.forEach(c=>{ let d=B;
    if(c.k==="esc" && o._notch && B-escD>=1.0){ const side= c.u<0.05? "start" : Math.abs(c.u+c.w-L)<0.05? "end" : null;
      if(side && o._notch.includes(side)){ d=escD; notches.push({side, u:c.u, w:c.w}) } }
    cells.push({...c, d, poly:R(c.u,c.w,F,F+d), row:"b"}) });
  const door=(u,v,du,dv,w,sw)=>{ doors.push({a:P(u,v), b:P(u+du*w,v+dv*w), sw}) };
  cells.forEach(c=>{
    if(c.door==="hall"){ const w=c.k==="elev"? 1.0 : c.k==="shaft"? 0.7 : 0.9; door(c.u+(c.w-w)/2,0,1,0,w, c.k==="elev"?0:1) }
    if(c.door2){ const tgt=cells.find(x=>x.row==="b" && x.k===c.door2 && x.u<c.u+c.w-0.3 && x.u+x.w>c.u+0.3); if(tgt){ const a=Math.max(c.u,tgt.u), b=Math.min(c.u+c.w,tgt.u+tgt.w), w=Math.min(0.9,b-a-0.2); door(a+(b-a-w)/2,F,1,0,w,1) } }
    if(c.doorSide){ const nb=cells.find(x=>x.row===c.row && x.k===c.doorSide && (Math.abs(x.u-(c.u+c.w))<0.05 || Math.abs(x.u+x.w-c.u)<0.05)); if(nb){ const uE= Math.abs(nb.u-(c.u+c.w))<0.05? c.u+c.w : c.u, v0=c.row==="f"?0:F, h=c.row==="f"?F:B; door(uE, v0+(h-0.9)/2, 0,1,0.9,1) } }
    if(c.k==="elev"){ const h=cells.find(x=>x.row==="b" && x.k==="hserv" && Math.min(c.u+c.w,x.u+x.w)-Math.max(c.u,x.u)>1.1); if(h){ const a=Math.max(c.u,h.u), b=Math.min(c.u+c.w,h.u+h.w); door(a+(b-a-1.0)/2,F,1,0,1.0,0) } }
    if(c.k==="esc"){ // lances, patamares e seta de subida
      const v0=F, v1=F+(c.d||B), vm=(v0+v1)/2, uA=c.u+1.2, uB=c.u+c.w-1.2;
      lines.push([P(uA,vm),P(uB,vm)]);
      for(let u=uA; u<=uB+0.01; u+=0.28){ lines.push([P(u,v0+0.05),P(u,vm)]); lines.push([P(u,vm),P(u,v1-0.05)]) }
      lines.push({arrow:[P(uB-0.3,v0+(vm-v0)/2),P(uA+0.3,v0+(vm-v0)/2)]});
    }
    if(c.k==="elev"||c.k==="emerg"){ const a=0.25; lines.push([P(c.u+a,c.row==="f"?a:F+a),P(c.u+c.w-a,c.row==="f"?F-a:F+B-a)]); lines.push([P(c.u+c.w-a,c.row==="f"?a:F+a),P(c.u+a,c.row==="f"?F-a:F+B-a)]) }
    if(c.k==="duto"){ const v0=c.row==="f"?0:F, h=c.row==="f"?F:B; for(let k=-h;k<c.w;k+=0.3){ const x0=Math.max(0,k), y0=Math.max(0,-k); lines.push([P(c.u+x0,v0+y0),P(c.u+Math.min(c.w,k+h),v0+Math.min(h,c.w-k))]) } }
  });
  // contorno do núcleo: retângulo menos os recortes atrás das escadas (do lado da fachada)
  const poly=R(0,L,0,F+B); let outline=poly;
  if(notches.length){ const back=[[L,F+B]]; notches.slice().sort((a,b)=>b.u-a.u).forEach(n=>{ const d=F+escD;
      if(n.side==="end"){ back.length=0; back.push([L,d],[n.u,d],[n.u,F+B]) } else back.push([n.u+n.w,F+B],[n.u+n.w,d],[0,d]) });
    const pts=[[0,0],[L,0],...back]; if(!notches.some(n=>n.side==="start")) pts.push([0,F+B]);
    outline=pts.filter((q,i)=>i===0||Math.hypot(q[0]-pts[i-1][0],q[1]-pts[i-1][1])>1e-6).map(([u,v])=>P(u,v)) }
  const sobras=notches.map(n=>({side:n.side, u0:n.u, u1:n.u+n.w, vIn:F+escD, vOut:F+B, poly:R(n.u,n.w,F+escD,F+B)}));
  // poly = projeção total (obstáculo nas garagens, como antes) · outline = contorno real no pavimento tipo
  return {L, depth:F+B, cells, doors, lines, poly, outline, lobby:R(0,L,-2.0,0), sobras, mir};
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
  const ux=G.longestDir(plate), vy=[-ux[1],ux[0]];
  const [u0,u1]=G.extent(plate,ux), [v0,v1]=G.extent(plate,vy), D=v1-v0, Lu=u1-u0;
  const corr=o.corr, fachada = o.fachada || o.escTipo==="pf_balcao";
  const seq=coreSeq(o); const est=Math.max(seq.front.reduce((a,c)=>a+c.w,0), seq.back.reduce((a,c)=>a+c.w,0)) + (seq.g2? Math.max(seq.g2.fr.reduce((a,c)=>a+c.w,0),seq.g2.bk.reduce((a,c)=>a+c.w,0)) : 0);
  const coreLen=Math.min(Lu*0.8, est);
  let dbl = D >= 2*o.profMin + corr; if(o.planta==="central") dbl=true; if(o.planta==="lateral") dbl=false;
  const reg=[]; let corridor, hallEnds=[], cv0, cv1, vEdge, sgn, depthB=CORE_B;
  const sub=(va,vb,ua,ub)=>{ const b=G.band(plate,vy,va,vb); return (ua===undefined||!b.length)? b : G.band(b,ux,ua,ub) };
  const pos=Math.min(1,Math.max(0,o.pos??0.5)), cu0=u0+0.01+pos*Math.max(0,Lu-coreLen-0.02), cu1=cu0+Math.max(coreLen, coreBuild([1,0],[0,1],0,0,1,CORE_B,o).L); // ponta real do núcleo (a passagem de serviço alonga a frente): as unidades começam depois dela
  if(dbl){
    const vc=(v0+v1)/2, c0=vc-corr/2, c1=vc+corr/2;
    corridor = sub(c0,c1,u0+0.01,u1-0.01);
    if(o.lado==="A"){ vEdge=c1; sgn=1; if(fachada) depthB=Math.max(CORE_B, v1-c1-CORE_F); cv0=c1; cv1=c1+CORE_F+depthB; reg.push({p:sub(v0,c0),fac:"min"}); reg.push({p:sub(c1,v1,u0,cu0),fac:"max"}); reg.push({p:sub(c1,v1,cu1,u1),fac:"max"}) }
    else { vEdge=c0; sgn=-1; if(fachada) depthB=Math.max(CORE_B, c0-v0-CORE_F); cv0=c0-CORE_F-depthB; cv1=c0; reg.push({p:sub(c1,v1),fac:"max"}); reg.push({p:sub(v0,c0,u0,cu0),fac:"min"}); reg.push({p:sub(v0,c0,cu1,u1),fac:"min"}) }
  } else {
    const side = o.lado==="A";
    corridor = side? sub(v1-corr,v1,u0,u1) : sub(v0,v0+corr,u0,u1);
    vEdge = side? v1-corr : v0+corr; sgn = side? -1 : 1; depthB=Math.max(CORE_B, D-corr-CORE_F);
    cv0=v0; cv1=v1;
    const uv0 = side? v0 : v0+corr, uv1 = side? v1-corr : v1;
    reg.push({p:sub(uv0,uv1,u0,cu0),fac:side?"min":"max"}); reg.push({p:sub(uv0,uv1,cu1,u1),fac:side?"min":"max"});
  }
  // núcleo na fachada: a escada fica com a profundidade do lance e a sobra vai para a unidade ao lado (se houver unidade desse lado)
  const sideReg=w=>reg.find(r=>{ if(!r.p.length || G.area(r.p)<=4) return false; const [a,b]=G.extent(r.p,ux); return w==="esq"? Math.abs(b-cu0)<0.05 && a<cu0-0.5 : Math.abs(a-cu1)<0.05 && b>cu1+0.5 });
  const mirC=o.escada==="D", wSide=ls=> (ls==="start")!==mirC ? "esq" : "dir";
  const oc = (depthB-CORE_B>=1.0 && o.escProf!==false)? {...o, _escD:CORE_B, _notch:["start","end"].filter(ls=>sideReg(wSide(ls)))} : o;
  const CB=coreBuild(ux,vy,cu0,vEdge,sgn,depthB,oc);
  const core=CB.poly, sobraA=[], reserva=[];
  (CB.sobras||[]).forEach(sb=>{ const w=wSide(sb.side), r=sideReg(w); if(!r) return;
    const wu0= mirC? cu0+CB.L-sb.u1 : cu0+sb.u0, wu1= mirC? cu0+CB.L-sb.u0 : cu0+sb.u1, vIn=vEdge+sgn*sb.vIn;
    const [ra,rb]=G.extent(r.p,ux), [rva,rvb]=G.extent(r.p,vy);
    const Q=sub(rva,rvb, w==="esq"? ra : wu0, w==="esq"? wu1 : rb);
    const np=notchPoly(Q, ux, vy, [w==="esq"? wu1 : wu0, vEdge], [w==="esq"? wu0 : wu1, vIn]);
    if(np){ sobraA.push(G.area(np)-G.area(r.p)); r.p=np; reserva.push(sb.poly) } });
  const coreOut = reserva.length===(CB.sobras||[]).length ? CB.outline : core;
  const cParts=CB.cells.map(c=>({nome:c.nome,kind:c.k,poly:c.poly,area:G.area(c.poly)}));
  const R=reg.filter(r=>r.p.length && G.area(r.p)>4).map(r=>({...r, A:G.area(r.p), list:[], used:0}));
  const us=units.map((u,i)=>({...u,i})).sort((a,b)=>b.alvo-a.alvo);
  const totalAlvo=us.reduce((s,u)=>s+u.alvo,0), totalA=R.reduce((s,r)=>s+r.A,0)||1;
  us.forEach(u=>{ let best=null, bs=-Infinity; R.forEach(r=>{ const share=r.A/totalA*totalAlvo, s=share-r.used-u.alvo*0.5; if(s>bs){ bs=s; best=r } }); if(best){ best.list.push(u); best.used+=u.alvo } });
  // poucas unidades: um trecho ficaria vazio — leva o núcleo para a ponta desse trecho
  const empty=R.find(r=>!r.list.length);
  if(empty && !o._re && us.length){ const [ea,eb]=G.extent(empty.p,ux); return tipoLayout(plate, units, {...o, _re:1, pos: (ea+eb)/2 < (cu0+cu1)/2 ? 0 : 1}) }
  const out=[], sacTipo=o.sacTipo||"embutida", prof=o.sacProf||1.6;
  R.forEach(r=>{
    if(!r.list.length){ out.push({poly:r.p, nome:"livre", alvo:0, area:r.A, livre:true}); return }
    r.list.sort((a,b)=>a.i-b.i);
    const tot=r.list.reduce((s,u)=>s+u.alvo,0); let a2=0; const [mn,mx]=G.extent(r.p,ux); let prev=mn;
    r.list.forEach((u,j)=>{ a2+=u.alvo; const cut = j===r.list.length-1 ? mx : G.cutAt(r.p,ux,a2/tot); const poly=G.band(r.p,ux,prev,cut);
      const un={poly, nome:u.nome, alvo:u.alvo, area:G.area(poly), fac:r.fac};
      if(u.sac>0 && poly.length){ const [pv0,pv1]=G.extent(poly,vy), wU=cut-prev, w=Math.max(1.2,Math.min(wU-1, u.sac/prof)), pr=u.sac/w, uc=(prev+cut)/2;
        let va,vb; if(r.fac==="max"){ va= sacTipo==="balanco"? pv1 : pv1-pr; vb=va+pr } else { vb= sacTipo==="balanco"? pv0 : pv0+pr; va=vb-pr }
        let sp=G.rect(ux,vy,uc-w/2,va,w,vb-va); if(sacTipo!=="balanco"){ sp=G.clipToPoly(sp, poly.length>4? plate : poly) }
        un.sac={poly:sp, area:G.area(sp), tipo:sacTipo} }
      prev=cut; out.push(un) });
  });
  const kinds={}; cParts.forEach(c=>kinds[c.kind]=(kinds[c.kind]||0)+c.area);
  return {ux,vy,units:out,core,lobby:CB.lobby,coreParts:cParts,coreDoors:CB.doors,coreLines:CB.lines,corridor,dbl,hallEnds,coreA:G.area(coreOut),coreKinds:kinds,fachada,coreOut,coreReserva:reserva,escSobra:sobraA.reduce((s,a)=>s+a,0)};
}

