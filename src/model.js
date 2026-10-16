/* ================= modelo de massa ================= */
function frontDir(st){ // normal para dentro da frente principal
  const L=st.lote.pts, i=st.lote.front.includes(st.lote.principal)? st.lote.principal : (st.lote.front[0] ?? 0), a=L[i], b=L[(i+1)%L.length]; if(!a||!b) return [0,1];
  const dx=b[0]-a[0], dy=b[1]-a[1], l=Math.hypot(dx,dy)||1; return [-dy/l, dx/l];
}
function massing(st, opt={}){
  const L=st.lote.pts, A=G.area(L), R=st.regras, P=st.produto, isF=i=>st.lote.front.includes(i);
  const torres = opt.pav ? P.torres.map(()=>({pav:opt.pav})) : P.torres;
  const nT = torres.length;
  const hEmb = P.peTerreo + P.garAcima*P.peGar;
  const mixPriv = P.mix.reduce((s,u)=>s+u.area*u.qtd,0), mixUn = P.mix.reduce((s,u)=>s+u.qtd,0);
  const cobPriv = P.cob.on ? P.cob.qtd*P.cob.area : 0;
  const duplex = P.cob.on && cobPriv > mixPriv*1.0001;
  const lz = lzResumo(st), pavLz = lz.pav.c>0;
  const Hs = torres.map((t,i)=> hEmb + t.pav*P.pe + (duplex && t.pav>=2 ? P.pe : 0) + (pavLz && i===0 ? P.pe : 0));
  const Hmax = Math.max(...Hs, hEmb);
  const afast = Math.max(R.afMin, Hmax/R.afDiv);
  const gap = Math.max(2*R.afMin, Hmax/R.afTorresDiv);
  const rec=i=>(st.lote.rec&&st.lote.rec[i])||{}, val=v=>v!==null&&v!==undefined&&v!==""&&isFinite(+v);
  const C=st.custom||{}, cust=k=>C[k]&&C[k].length>2? G.clipToPoly(C[k],L) : null;
  const sub = P.subsolos>0 ? G.scaleToArea(cust("sub") || G.offsetPoly(L, i=>R.recSub), A*(1-R.permeab)) : [];
  const princ = st.lote.front.includes(st.lote.principal)? st.lote.principal : st.lote.front[0];
  const recPF = P.vagasFrente? Math.max(R.recFrente, st.estudo.vagaC+0.5) : R.recFrente;
  const emb = G.scaleToArea(cust("emb") || G.offsetPoly(L, i=>val(rec(i).e)? +rec(i).e : i===princ? recPF : isF(i)?R.recFrente:R.recEmb), A*R.toEmb);
  // envelope da torre para um afastamento às divisas 'af' (2.4: com recuos progressivos 'af' varia com a cota)
  const envAt = af=>{ let e=G.offsetPoly(L, i=>val(rec(i).t)? +rec(i).t : isF(i)?R.recFrente:af); if(cust("tor")) e = e.length? G.clipToPoly(cust("tor"), e) : cust("tor"); return e };
  const FO = st.forma && st.forma.on ? st.forma : null, prog = !!(FO && FO.prog && FO.faixas && FO.faixas.length);
  const afAt = prog ? z=>formaAf(FO, z) : ()=>afast;
  let torAll = envAt(prog ? afAt(hEmb + P.pe) : afast);
  // divisão em torres ao longo do maior eixo do lote (ou transversal)
  let axis = G.longestDir(L); if(P.torreEixo==="trans") axis=[-axis[1],axis[0]];
  let slots=[], slotOk=true; const slotR=[];
  if(nT===1) slots=[torAll];
  else if(torAll.length){
    const [t0,t1]=G.extent(torAll,axis), w=(t1-t0-(nT-1)*gap)/nT;
    if(w<6) slotOk=false;
    else for(let i=0;i<nT;i++){ const s=t0+i*(w+gap); slotR.push([s,s+w]); slots.push(G.band(torAll,axis,s,s+w)) }
  }
  if(!slotOk) slots=torres.map(()=>[]);
  // faixa da torre i dentro de um envelope (mesma posição ao longo do eixo do lote)
  const slotIn = (i, env)=> !slotOk || !env.length ? [] : nT===1 ? env : G.band(env, axis, slotR[i][0], slotR[i][1]);
  // torre reta com recuos progressivos: a torre inteira obedece ao recuo da cota do topo
  if(prog && !FO.escalonar) slots = slots.map((s,i)=> s.length ? slotIn(i, envAt(afAt(Hs[i]))) : s);
  // C0: "ocupar o contorno" — o limite desenhado das torres vira a planta (não é encolhido até o mix nem pela TO; a TO excedida vira aviso)
  const ocupa = !!(C.torOcupa && cust("tor"));
  const sumSlot = slots.reduce((s,p)=>s+G.area(p),0), cap=A*R.toTorre, k=!ocupa && sumSlot>cap? cap/sumSlot : 1;
  const need = mixPriv/P.efic;
  const T = torres.map((t,i)=>{
    const slot=slots[i]||[], maxP=G.scaleToArea(slot, G.area(slot)*k), maxA=G.area(maxP);
    // C1: torre desenhada (src/calc/blocos.js) — a planta é o bloco recortado pelo lote; recuos, TO e CA viram avisos
    const bl = typeof blcTorre==="function" ? blcTorre(st, i, L, t.pav) : null;   // C2: pilha de blocos (plate = bloco de referência)
    const plate = bl ? bl.plate : ocupa ? maxP : G.scaleToArea(maxP, need), pA=G.area(plate);
    const fit = bl ? pA>1 && pA >= need-0.5 : ocupa ? pA>1 : maxA >= need-0.5 && pA>1;
    // fator das unidades: < 1 se o mix não couber; ocupando o contorno, as unidades crescem ou encolhem até preencher o andar
    const r0 = mixPriv>0 ? pA*P.efic/mixPriv : 0, r = mixPriv>0 ? (bl ? (Math.abs(r0-1)<1e-9 ? Math.min(1,r0) : r0) : ocupa ? r0 : Math.min(1, r0)) : 0;
    const hasCob = P.cob.on && t.pav>=2;
    const tipoFloors = t.pav - (hasCob?1:0);
    // faixas de andares (2.4): planta de cada andar recortada pelo recuo da sua cota; sem recuos progressivos é uma faixa só
    const zB = hEmb + (pavLz && i===0 ? P.pe : 0);
    let faixas = prog && FO.escalonar && plate.length && !bl ? formaTorre({plate, pav:t.pav, zBase:zB, pe:P.pe, envBand:z=>slotIn(i, envAt(afAt(z))), afAt}) : bl ? blcFaixas(bl, zB, P.pe, afAt) : [];
    if(!faixas.length) faixas=[{de:1, ate:t.pav, n:t.pav, plate, A:pA, z0:zB, z1:zB+t.pav*P.pe, af:afAt(zB+t.pav*P.pe)}];
    faixas.forEach(f=>{ f.nTipo=Math.max(0, Math.min(f.ate, tipoFloors)-f.de+1);
      if(Math.abs(f.A-pA)<0.25){ f.qtd=P.mix.map(u=>u.qtd); f.r=r; f.priv=mixPriv*r; f.un=mixUn }
      else { const x= f.A<1 ? {qtd:P.mix.map(()=>0), r:0} : f.blc ? blcMixFaixa(P.mix, f.A*P.efic, r) : formaMix(P.mix, f.A*P.efic, (FO&&FO.rMin)||0.9); f.qtd=x.qtd; f.r=x.r; f.priv=P.mix.reduce((s,u,j)=>s+u.area*x.qtd[j],0)*x.r; f.un=x.qtd.reduce((s,n)=>s+n,0) } });
    const Atop = faixas[faixas.length-1].A, one = faixas.length===1;
    const floorPriv = Atop*P.efic;
    const rc = hasCob ? Math.min(1, (duplex? 2*floorPriv : floorPriv)/Math.max(1,cobPriv)) : 0;
    const cobP = hasCob ? cobPriv*rc : 0;
    const duplexA = hasCob && duplex ? Math.min(Atop, Math.max(0, cobP-floorPriv)/P.efic) : 0;
    const Atot = one ? pA*t.pav : faixas.reduce((s,f)=>s+f.A*f.n,0);
    return {i, pav:t.pav, H:Hs[i], slot, maxP, maxA, plate, A:pA, Atop, Atot, faixas, fit, r, rc, hasCob, cobP, duplexA, tipoFloors,
      ...(bl ? {desenhada:true, oco:bl.oco, blcForaLote:bl.foraLote, blcRef:bl.ref, blcIgn:bl.ign, Aproj:bl.Aproj} : {}),
      priv: (one ? tipoFloors*mixPriv*r : faixas.reduce((s,f)=>s+f.nTipo*f.priv,0)) + cobP,
      units: (one ? tipoFloors*mixUn : faixas.reduce((s,f)=>s+f.nTipo*f.un,0)) + (hasCob?P.cob.qtd:0) };
  });
  const subA=G.area(sub), embA=G.area(emb);
  // térreo (estimativa sem os núcleos; o compute refaz com eles)
  const acesso = accessPoints(st);
  const ter = terreoZones(st, {emb, sub, acesso, T, coreSets:[]}, lz);
  const tiposA = T.reduce((s,t)=>s+t.Atot,0), duplexA=T.reduce((s,t)=>s+t.duplexA,0);
  const aticoA = P.atico ? T.reduce((s,t)=>s+t.Atop*0.25,0) : 0;
  const unitsRes = T.reduce((s,t)=>s+t.units,0), privRes=T.reduce((s,t)=>s+t.priv,0);
  const torProj = T.reduce((s,t)=>s+(t.Aproj||t.A),0);   // C2: maior projeção da pilha de blocos
  const H = Hmax;
  // aptos por tipologia (todas as torres)
  const unitRows = P.mix.map(u=>({nome:u.nome, alvo:u.area, n:0, area:0, preco:u.preco}));
  T.forEach(t=>t.faixas.forEach(f=>P.mix.forEach((u,j)=>{ unitRows[j].n += f.qtd[j]*f.nTipo; unitRows[j].area += f.qtd[j]*f.nTipo*u.area*f.r })));
  const cobN = T.reduce((s,t)=>s+(t.hasCob?P.cob.qtd:0),0), cobArea = T.reduce((s,t)=>s+t.cobP,0);
  const minApto = !prog && T.every(t=>t.faixas.length<2) ? Math.min(...P.mix.map(u=>u.area*Math.min(...T.map(t=>t.r||1))))
    : Math.min(...P.mix.map((u,j)=>u.area*Math.min(1, ...T.flatMap(t=>t.faixas.filter(f=>f.qtd[j]>0 && f.nTipo>0).map(f=>f.r||1)))));
  const hLim = typeof formaHLim==="function" ? formaHLim(st) : R.hMax;
  const env = prog ? formaEnvelope(envAt, afAt, hEmb, Math.max(hLim, Hmax), P.pe) : null;
  const terra = subA*P.subsolos*P.peGar + A*Math.abs(st.lote.desnivel)*0.25;
  const TO = A? Math.max(embA,torProj)/A : 0, perm = A? (A-Math.max(P.subsolos>0?subA:0, embA))/A : 0;
  const m = {A,H,Hs,afast: prog? afAt(hEmb+P.pe) : afast,gap,axis,sub,emb,torAll,env,hLim,forma:!!FO,torOcupa:ocupa,T,slotOk:slotOk||T.every(t=>t.desenhada),blocos:T.some(t=>t.desenhada),subA,embA,tiposA,duplexA,aticoA,unitsRes,privRes,TO,perm,unitRows,cobN,cobArea,minApto,mixPriv,mixUn,duplex,terra,hEmb,lz,pavLz,acesso,ter,units:unitsRes};
  areasFin(st, m);
  return m;
}
/* áreas que dependem do zoneamento do térreo e do programa de lazer */
function areasFin(st, m){
  const R=st.regras, P=st.produto, F=st.fin, T=m.ter, lz=m.lz;
  m.tLoja=T.lojas[0]||[]; m.tHall=T.hall[0]||[]; m.tGar=T.gar||[];
  m.lojaA=T.lojaA||0; m.hallA=T.hallA||0; m.driveA=T.driveA||0; m.gTer=T.gTer||0;
  m.gSub=P.subsolos*m.subA; m.gAc=P.garAcima*m.embA; m.garA=m.gSub+m.gAc+m.gTer+m.driveA;
  m.vagasEst = P.subsolos*Math.floor(m.subA/R.m2Vaga) + P.garAcima*Math.floor(m.embA/R.m2Vaga) + Math.floor(m.gTer/R.m2Vaga); m.vagas=m.vagasEst;
  m.lojaPriv = m.lojaA*0.9;
  m.lzPavA = m.pavLz && m.T[0] ? m.T[0].A : 0;
  m.lzExtraA = lz.emb.c + m.lzPavA + lz.cob.c; // áreas cobertas de lazer construídas fora do térreo
  m.lzCusto = lz.d*(F.custoDesc||0) + lz.c*(F.decorLazer||0);
  m.comp = (m.tiposA+m.duplexA)*(1-R.ncTipo) + m.lojaA + (R.ncTerreo?0:m.hallA+m.lzExtraA) + (R.ncGaragem?0:m.garA);
  m.constr = m.gSub + m.embA*(1+P.garAcima) + m.tiposA + m.duplexA + m.aticoA + m.lzExtraA;
  m.CA = m.A? m.comp/m.A : 0; m.outA = Math.max(0, m.comp - R.caBas*m.A);
  m.vagasReq = Math.ceil(m.unitsRes*R.vagasApto + (m.lojaPriv>0? m.lojaPriv/R.m2LojaVaga : 0));
  m.priv = m.privRes + m.lojaPriv;
}
/* pavimento tipo de cada torre (m.tipo) e dos blocos da pilha (f.lay) — também usado pelo atalho do otimizador (blcPrivEstimada) */
function tipoLayouts(st, m, opt){
  const E=st.estudo, P=st.produto;
  m.tipo = m.T.map(t=>{
    const list=[]; P.mix.forEach(u=>{ for(let q=0;q<u.qtd;q++) list.push({nome:u.nome, alvo:u.area*t.r, sac:+u.sac||0}) });
    const nAuto=(t.units>60||t.H>45)?3:(t.H>12?2:1);
    return (typeof alasTipoLayout==="function" ? alasTipoLayout : tipoLayout)(t.plate, list, {corr:E.corrTipo, profMin:E.profMin, nElev: +E.elevadores||nAuto, pos:E.nucleoPos, lado:E.nucleoLado, escada:E.escadaLado, planta:E.tipoPlanta,
      escTipo:E.escTipo, nEsc:E.nEsc, emerg:E.emerg, fachada:E.fachada, sacTipo:P.sacTipo, sacProf:P.sacProf, _st:st, _pav:t.pav, _H:t.H, _nElevAuto:!(+E.elevadores), _rap:!!(opt && opt.quick), _areaFixa:!!(t.desenhada || m.torOcupa)}, t, st);   // C3: planta em L/U/T/H/pátio → layout por ala
  });
  if(typeof blcLayFaixas==="function") blcLayFaixas(st, m);   // C2: blocos fora da referência → mesmo núcleo, unidades por área (f.lay)
}
function compute(st, opt={}){
  const m = massing(st);
  // estudo: pavimento tipo e garagem
  const E=st.estudo, P=st.produto;
  tipoLayouts(st, m, opt);
  if(typeof blcPrivReal==="function") blcPrivReal(st, m);     // torre desenhada / contorno ocupado: privativa = unidades desenhadas (eficiência real da planta)
  // sacadas em balanço somam área construída e privativa
  m.sacA=0; m.sacBal=0;
  m.T.forEach((t,i)=>{ const l=m.tipo[i]; if(!l) return; (t.faixas.some(f=>f.lay)? t.faixas.map(f=>[f.lay||l, f.nTipo]) : [[l, t.tipoFloors]]).forEach(([ly,fl])=>ly.units.forEach(u=>{ if(u.sac){ m.sacA+=u.sac.area*fl; if(u.sac.tipo==="balanco") m.sacBal+=u.sac.area*fl } })) });
  m.coreSets = m.tipo.map((l,i)=>l && l.core && l.core.length? {i, core:l.core, lobby:l.lobby, lay:l} : null).filter(Boolean);
  m.cores = m.coreSets.map(c=>c.core); m.lobbies = m.coreSets.map(c=>c.lobby).filter(p=>p&&p.length);
  m.obst = [...m.cores, ...m.lobbies, ...m.coreSets.flatMap(c=>c.lay.coreExtra||[]), ...m.coreSets.flatMap(c=>c.lay.coreFundo||[])];   // C3: a segunda escada desce até o térreo
  // térreo definitivo, com o hall chegando aos núcleos
  m.ter = terreoZones(st, m, m.lz); areasFin(st, m);
  if(m.sacBal){ m.constr+=m.sacBal; m.privRes+=m.sacBal; m.priv+=m.sacBal }
  m.acesso = accessPoints(st);
  m.vf = P.vagasFrente ? frontStalls(st, m) : {vagas:[], count:0};
  const garSec=()=>{
    m.vert = vertical(st, m); m.ramp = m.vert.entry || null;
    if(opt.layouts!==false){ m.gar = garagens(st, m, opt);
      m.vagasLay = Object.entries(m.gar).reduce((s,[k,l])=>s+(l? l.count:0),0) + m.vf.count;
      if(E.usarLayout) m.vagas = m.vagasLay; else m.vagas = m.vagasEst + m.vf.count }
    else m.vagas = m.vagasEst + m.vf.count;
  };
  garSec(); m.vagasEst += m.vf.count;
  m.lzLay = lazerLayout(st, m, opt);
  // se o lazer do térreo não coube, o hall cresce (a garagem do térreo recua) e tenta de novo
  //  (com o planejador de áreas comuns, passos menores: ele encosta tudo nas galerias e o que sobra vira área livre)
  const lzPasso = m.comuns? 1.0 : 1.6, lzVoltas = m.comuns? 4 : 3;
  const lzMiss=()=>m.lzLay.miss.some(x=>(x.local||"terreo")==="terreo" && !x.desc);
  const lzRefaz=x=>{ m.ter=terreoZones(st, m, m.lz, x); areasFin(st, m); if(m.sacBal){ m.constr+=m.sacBal; m.privRes+=m.sacBal; m.priv+=m.sacBal }
    garSec(); m.vagasEst += m.vf.count; m.lzLay = lazerLayout(st, m, opt) };
  let lzExtra=0;
  for(let k=0; k<lzVoltas && P.garTerOn && lzMiss(); k++){
    const falta=m.lzLay.miss.filter(x=>(x.local||"terreo")==="terreo" && !x.desc).reduce((s,x)=>s+(+x.area||0),0);
    lzExtra=falta*lzPasso*(k+1); lzRefaz(lzExtra);
  }
  // o planejador deixou vazio o fundo do hall: devolve essa faixa à garagem do térreo (volta atrás se algo deixar de caber)
  const lzRed=()=>m.comuns? m.comuns.amb.filter(a=>a.reduzido).length : 0;
  if(m.comuns && P.garTerOn && (m.comuns.folgaFundoA||0)>=40 && !lzMiss()){ const x0=lzExtra, r0=lzRed(); lzRefaz(x0 - m.comuns.folgaFundoA); if(lzMiss() || !m.comuns || lzRed()>r0) lzRefaz(x0) }
  // avisos do térreo e da circulação de veículos
  const T=m.ter; m.avisos=[...(T.warn||[]), ...m.vert.warn, ...(typeof torOcupaAvisos==="function"? torOcupaAvisos(st, m) : [])];
  if(m.gar) Object.entries(m.gar).forEach(([k,l])=>{ if(l && l.ok===false) m.avisos.push(`No ${nomePav(k)}, os carros não conseguem ir da rampa até a circulação — mude o acesso ou o tipo de rampa (use “Encontrar o melhor acesso”).`) });
  if(m.gar && m.gar.ter && m.gTer>150 && m.gar.ter.count < m.gTer/st.regras.m2Vaga*0.4) m.avisos.push(`Térreo rende pouco: ${m.gar.ter.count} vagas em ${nf(m.gTer,0)} m². Mova o núcleo ou tire a garagem do térreo.`);
  if(m.lzLay.miss.length) m.avisos.push(`Não couberam: ${m.lzLay.miss.map(x=>x.nome).join(", ")}.`);
  m.custosExtra = m.custosExtra || [];
  runHooks("compute", m, st, opt);
  return m;
}
function frontStalls(st, m){ // vagas externas na frente (uso comercial), perpendiculares à rua
  const E=st.estudo, L=st.lote.pts, ac=m.acesso, i=ac.edge, a=L[i], b=L[(i+1)%L.length], len=Math.hypot(b[0]-a[0],b[1]-a[1]); if(len<6) return {vagas:[],count:0};
  const ux=[(b[0]-a[0])/len,(b[1]-a[1])/len], vy=frontDir(st), W=E.vagaL, C=E.vagaC, o0=G.dot(a,ux), v0=G.dot(a,vy);
  const uVei=G.dot(ac.vei,ux)-o0, uPed=G.dot(ac.ped,ux)-o0, out=[];
  const T=m.ter||{}, lv=ac.edgeV!=null && ac.edgeV!==i; // veículos por outro lado: a frente principal fica só com as vagas e os pedestres
  const dv=!lv&&T.drive0&&T.drive0.dv, lat=T.lat, dVz=lv? [...(T.drive||[]), ...(T.driveRua||[])].map(p=>scaleBy(p,1.08)) : [];
  const inDrive=p=> lv? dVz.some(d=>G.polysOverlap(p,d)) : dv&&lat&&(()=>{ const ls=p.map(q=>G.dot(q,lat)); return Math.max(...ls)>dv[0]-0.6 && Math.min(...ls)<dv[1]+0.6 })();
  for(let u=0.6; u+W<=len-0.6; u+=W){ if(!dv && !lv && u+W>uVei-3.5 && u<uVei+3.5) { u=uVei+3.5-W; continue } if(u+W>uPed-1.6 && u<uPed+1.6){ u=uPed+1.6-W; continue } if(inDrive(G.rect(ux,vy,o0+u,v0+0.05,W,C))) continue;
    const p=G.rect(ux,vy,o0+u,v0+0.05,W,C); if(G.polyInPoly(p,L) && !(m.emb.length && G.polysOverlap(p,m.emb))) out.push({poly:p, c:G.centroid(p)}) }
  return {vagas:out, count:out.length};
}
function accessPoints(st){
  const L=st.lote.pts, i=st.lote.front.includes(st.lote.principal)? st.lote.principal : (st.lote.front[0]||0), a=L[i], b=L[(i+1)%L.length];
  const at=(t,a,b)=>[a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t];
  // veículos: no lado escolhido (S.lote.ladoVei, src/calc/acesso.js); sem escolha, na frente principal
  const iv = typeof ladoVeiIdx==="function" ? ladoVeiIdx(st) : i, av=L[iv], bv=L[(iv+1)%L.length];
  return {ped:at(st.lote.acessoPed,a,b), vei:at(st.lote.acessoVei,av,bv), edge:i, edgeV:iv};
}
function maxPav(st){ let best=0; for(let n=1;n<=70;n++){ const m=massing(st,{pav:n}); if(m.H<=(m.hLim??st.regras.hMax)+1e-6 && m.CA<=st.regras.caMax+1e-6 && m.T.every(t=>t.A>1)) best=n; } return best }
function status(m, st){
  const R=st.regras;
  return {
    ca: m.CA>R.caMax+1e-6?"bad": m.CA>R.caBas+1e-6?"warn":"ok",
    h: m.H>(m.hLim??R.hMax)+1e-6 || (st.forma && st.forma.on && +st.forma.hEmbMax>0 && m.hEmb>+st.forma.hEmbMax+1e-6) ?"bad":"ok", // 2.4: aeródromo e embasamento
    vg: m.vagas<m.vagasReq?"bad":"ok",
    perm: m.perm<R.permeab-1e-6?"bad":"ok",
    apto: m.minApto<R.aptoMin?"bad":"ok",
    tor: !m.slotOk || m.T.some(t=>t.A<1) ? "bad" : m.T.some(t=>!t.fit) ? "warn" : "ok"
  };
}
