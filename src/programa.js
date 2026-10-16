/* ================= programa: áreas comuns, lazer e zoneamento do térreo ================= */
const LZ_LOCAIS = { terreo:"Térreo", emb:"Laje do embasamento", pav:"Pavimento de lazer", cob:"Cobertura (rooftop)" };
const LZ_PRESETS = [
  {nome:"Salão de festas",area:90,local:"terreo"}, {nome:"Espaço gourmet",area:45,local:"terreo"}, {nome:"Academia",area:60,local:"terreo"},
  {nome:"Brinquedoteca",area:35,local:"terreo"}, {nome:"Coworking",area:40,local:"terreo"}, {nome:"Lavanderia",area:20,local:"terreo"},
  {nome:"Bicicletário",area:25,local:"terreo"}, {nome:"Piscina",area:70,local:"emb",desc:true}, {nome:"Deck / solário",area:80,local:"emb",desc:true},
  {nome:"Playground",area:50,local:"emb",desc:true}, {nome:"Pet place",area:40,local:"emb",desc:true}, {nome:"Quadra",area:180,local:"emb",desc:true},
  {nome:"Salão de jogos",area:50,local:"pav"}, {nome:"Cinema",area:35,local:"pav"}, {nome:"Sauna",area:15,local:"cob"},
  {nome:"Rooftop gourmet",area:60,local:"cob"}, {nome:"Piscina rooftop",area:45,local:"cob",desc:true}
];
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const scaleBy=(p,k)=>{ if(!p||!p.length) return p; const c=G.centroid(p); return p.map(q=>[c[0]+(q[0]-c[0])*k, c[1]+(q[1]-c[1])*k]) };
const ivSub=(ivs,[a,b])=>ivs.flatMap(([x,y])=> b<=x||a>=y? [[x,y]] : [[x,Math.max(x,a)],[Math.min(y,b),y]].filter(([p,q])=>q-p>0.05));
function hallSocial(st,nT){ const h=+(st.produto.lazer&&st.produto.lazer.hall)||0; return h>0? h : 40+20*Math.max(1,nT) }
function lzResumo(st){
  const it=(st.produto.lazer&&st.produto.lazer.itens)||[], r={terreo:{c:0,d:0},emb:{c:0,d:0},pav:{c:0,d:0},cob:{c:0,d:0}};
  it.forEach(i=>{ const a=Math.max(0,+i.area||0), l=r[i.local]? i.local : "terreo"; r[l][i.desc?"d":"c"]+=a });
  const ks=["terreo","emb","pav","cob"]; r.c=ks.reduce((s,k)=>s+r[k].c,0); r.d=ks.reduce((s,k)=>s+r[k].d,0); r.n=it.length;
  return r;
}
/* térreo: lojas na frente, acesso de veículos, hall social e lazer ligados aos núcleos, garagem no que sobra */
function terreoZones(st, m, lz, extra=0){
  const P=st.produto, E=st.estudo, emb=m.emb;
  const out={lojas:[],hall:[],hallBand:[],pass:[],cols:[],colsGar:[],walk:[],drive:[],gar:[],driveEnd:null,drive0:null,keep:[],warn:[],lanes:null};
  if(!emb.length) return out;
  const fd=frontDir(st), lat=[fd[1],-fd[0]], [dmn,dmx]=G.extent(emb,fd), [lmn,lmx]=G.extent(emb,lat);
  Object.assign(out,{fd,lat,dmn,dmx,lmn,lmx,vfd:fd,vlat:lat});
  const W2=(l,d)=>[lat[0]*l+fd[0]*d, lat[1]*l+fd[1]*d];
  const box=(d0,d1,l0,l1)=>{ if(d1-d0<0.05||l1-l0<0.05) return []; const b=G.band(emb,fd,d0,d1); return b.length? G.band(b,lat,l0,l1) : [] };
  const hasRamp = P.subsolos>0 || P.garAcima>0; let garOn = !!P.garTerOn; const needVeh = hasRamp || garOn;
  const lojaF=clamp(P.lojaTerreo,0,0.9), d1 = lojaF>0? G.cutAt(emb,fd,lojaF) : dmn;
  // carro por outro lado do lote (esquina, passante): a faixa de veículos é resolvida no referencial DAQUELE lado, depois do hall (src/calc/acesso.js)
  const VL = needVeh && m.acesso && m.acesso.edgeV!=null && m.acesso.edgeV!==m.acesso.edge;
  // acesso de veículos: faixas das rampas (descida / subida) lado a lado e, se houver garagem no térreo, a faixa de acesso a ela
  let dv=null, dl=null, dEnd=dmn;
  if(needVeh && !VL){ dl=driveLayout(st, lmn, lmx, G.dot(m.acesso.vei,lat), m, fd, lat); out.drive0=dl;
    if(dl){ dv=dl.dv; out.lanes=dl.laneIv||null;
      if(dl.semAlt) out.warn.push("As rampas alternadas não cabem ao lado dos núcleos — o estudo usou rampas retas empilhadas.");
      if(dl.semFaixa){ garOn=false; out.semFaixa=true; out.warn.push("Não há largura para a faixa de acesso à garagem do térreo ao lado das rampas sem passar pelos núcleos — a garagem do térreo foi desligada neste estudo."); }
      if(dl.naoCabe) out.warn.push("As rampas não cabem ao lado dos núcleos das torres. Tente “Encontrar o melhor acesso”, rampas alternadas, menos garagens elevadas ou mude o lado/posição do núcleo (Pavimento tipo).");
      out.veiReal=W2((dv[0]+dv[1])/2, G.dot(m.acesso.vei,fd)); out.veiShift=dl.shift||0;
      const RX=rampExt(st, m, fd); out.rx=RX;
      dEnd = hasRamp && !E.rampa ? Math.min(dmx, RX.s0 + Math.max(P.subsolos? RX.LD:0, P.garAcima? RX.LU:0)) : dmn+PATAMAR } }
  // profundidade do hall: o que o programa pede (hall social + lazer coberto do térreo + apoio do condomínio de src/calc/comuns.js:
  // portaria, sanitários, funcionários, DML, bicicletário). Se mesmo assim não couber, o compute cresce o hall (lazerLayout → miss)
  const apoio = typeof comunsApoioTerreo==="function" && (st.comuns||{}).on!==false ? comunsApoioTerreo(st, m) : 0;
  const HT = hallSocial(st, (m.T||[]).length) + (lz? lz.terreo.c : 0) + apoio;
  const HTe = hallSocial(st, (m.T||[]).length) + (lz? lz.terreo.c*1.35 : 0) + apoio*1.25 + extra; // folga para circulação entre os ambientes
  const coreIn=d=>(m.coreSets||[]).reduce((s,cs)=>s + G.area(G.band(cs.core,fd,d1,d)) + G.area(G.band(scaleBy(cs.lobby||[],1.25),fd,d1,d)),0) + (lz&&lz.terreo.c>0? 2.6*(lmx-lmn) : 0);
  const hallArea=d=>{ const b=box(d1,d,lmn,lmx); let a=G.area(b); if(dv) a-=G.area(box(d1,d,dv[0],dv[1])); return a };
  let d2=dmx;
  if(garOn){ let lo=d1, hi=dmx; for(let k=0;k<30;k++){ const mid=(lo+hi)/2; if(hallArea(mid)-coreIn(mid)>=HTe) hi=mid; else lo=mid } d2=Math.min(dmx, Math.max(hi, d1+6)) }
  out.d1=d1; out.d2=d2; out.HT=HT; out.hallDisp=hallArea(dmx);
  // núcleos das torres: o hall sempre chega até eles (colunas de hall)
  const cols=[];
  (m.coreSets||[]).forEach((cs,i)=>{ const pts=[...cs.core,...(cs.lobby||[])], ls=pts.map(q=>G.dot(q,lat)), ds=pts.map(q=>G.dot(q,fd));
    let ivs=[[clamp(Math.min(...ls)-1,lmn,lmx), clamp(Math.max(...ls)+1,lmn,lmx)]]; const p=Math.min(...ds), q=Math.max(...ds);
    if(q<dmn || p>dmx) return;
    const dvEnd = garOn? d2 : Math.max(dEnd, dmn+PATAMAR);
    const dvBox = dv? box(dmn, dvEnd, dv[0], dv[1]) : [];
    if(dv && ivs[0][1]>dv[0] && ivs[0][0]<dv[1] && p<dvEnd){ if(!(dl&&dl.naoCabe) && dvBox.length && (G.polysOverlap(dvBox,cs.core)||G.polysOverlap(dvBox,cs.lobby||[]))) out.warn.push(`O acesso de veículos passa sobre o núcleo da torre ${cs.i+1} — mova o acesso na etapa Terreno.`); ivs=ivSub(ivs,dv) }
    const lc=(Math.min(...ls)+Math.max(...ls))/2;
    ivs.forEach(iv=>cols.push({iv, front:p-1<d1, near:p-0.8, back:Math.min(dmx,q+0.8), torre:cs.i, corr:[clamp(lc-1.3,iv[0],iv[1]-0.5), clamp(lc+1.3,iv[0]+0.5,iv[1])]})) });
  // carro por outro lado: faixa de veículos no referencial do lado escolhido, sem passar pelas lojas, pelo hall nem pelos caminhos até os núcleos
  let VD=null;
  if(VL){ const r=terreoVeiLateral(st, m, out, {emb, fd, lat, dmn, dmx, lmn, lmx, d1, d2, garOn, hasRamp, cols, box});
    VD=r; dl=r.dl; if(r.semFaixa){ garOn=false; d2=dmx; out.d2=d2 } }
  // passagem de pedestres pelas lojas
  let pass=null;
  if(lojaF>0 && d1-dmn>1){ let pc=clamp(G.dot(m.acesso.ped,lat), lmn+1.5, lmx-1.5);
    if(dv && pc+1.5>dv[0] && pc-1.5<dv[1]){ pc = (dv[0]-lmn > lmx-dv[1])? dv[0]-1.6 : dv[1]+1.6; pc=clamp(pc,lmn+1.5,lmx-1.5) }
    if(!cols.some(c=>c.front && pc>=c.iv[0]-1 && pc<=c.iv[1]+1)) pass=[pc-1.5,pc+1.5] }
  // lojas
  if(lojaF>0){ let ivs=[[lmn,lmx]]; if(dv) ivs=ivSub(ivs,dv); if(pass) ivs=ivSub(ivs,pass); cols.filter(c=>c.front).forEach(c=>ivs=ivSub(ivs,c.iv));
    ivs.forEach(([a,b])=>{ const p=box(dmn,d1,a,b); if(!p.length) return; if(b-a>=4) out.lojas.push(p); else { out.hall.push(p); out.cols.push(p) } }) }
  if(pass){ const p=box(dmn,d1,pass[0],pass[1]); if(p.length){ out.pass.push(p); out.hall.push(p) } }
  cols.filter(c=>c.front && lojaF>0).forEach(c=>{ const p=box(dmn,d1,c.iv[0],c.iv[1]); if(p.length){ out.cols.push(p); out.hall.push(p) } });
  // faixa do hall
  { const dCut = garOn? d2 : Math.min(d2, Math.max(d1, dEnd)); let ivs=[[lmn,lmx]]; if(dv) ivs=ivSub(ivs,dv);
    ivs.filter(([a,b])=>b-a>=1).forEach(([a,b])=>{ const p=box(d1,d2,a,b); if(p.length){ out.hallBand.push(p); out.hall.push(p) } });
    if(dv && dCut<d2-1){ const p=box(dCut,d2,dv[0],dv[1]); if(p.length){ out.hallBand.push(p); out.hall.push(p) } } }
  // colunas de hall dentro da garagem (até o núcleo e o hall dos elevadores)
  // núcleo dentro da garagem: bloco do hall dos elevadores + corredor de pedestres até o hall (vagas não invadem; carros cruzam na faixa)
  cols.filter(c=>c.back>d2+0.3).forEach(c=>{ const n0=Math.max(d2,c.near), blk=box(n0,c.back,c.iv[0],c.iv[1]); if(blk.length){ out.colsGar.push(blk); out.hall.push(blk) }
    if(n0>d2+0.5){ const cor=box(d2,n0,c.corr[0],c.corr[1]); if(cor.length){ out.walk.push(cor); out.keep.push(cor); out.hall.push(cor) } } });
  // acesso de veículos (do alinhamento até o fim das rampas ou até a garagem do térreo)
  if(dv){ const end = garOn? Math.max(d2, Math.min(dEnd,d2)) : Math.max(dEnd, dmn+PATAMAR); const p=box(dmn,Math.min(dmx,end),dv[0],dv[1]); if(p.length) out.drive.push(p);
    if(garOn && out.lanes){ const lc=(out.lanes[0]+out.lanes[1])/2; out.driveEnd=W2(lc, d2-0.2); out.keep.push(G.rect(lat,fd,out.lanes[0],d2,out.lanes[1]-out.lanes[0],6)) } }
  if(garOn && dmx-d2>3){ out.gar=box(d2,dmx,lmn,lmx) }
  if(VD) terreoVeiFecha(out, VD, garOn);
  const sa=a=>a.reduce((s,p)=>s+G.area(p),0);
  out.lojaA=sa(out.lojas); out.hallA=sa(out.hall); out.driveA=sa(out.drive); out.gTer=Math.max(0,G.area(out.gar)-sa(out.colsGar)-sa(out.walk)-(VD&&garOn&&out.gar.length? sa(out.drive) : 0));
  if(HT>out.hallDisp+1 && !garOn) out.warn.push("O hall e o lazer do térreo pedem mais área do que o térreo tem.");
  if(garOn && out.gTer<1 && HT>0) out.warn.push("O hall e o lazer ocupam todo o térreo — não sobra garagem.");
  return out;
}
/* posiciona os itens de lazer dentro das regiões (retângulos alinhados aos eixos) */
function packItems(regions, obst, items, ax){
  const placed=[], miss=[], ob=obst.filter(o=>o&&o.length);
  items.slice().sort((a,b)=>(+b.area||0)-(+a.area||0)).forEach(it=>{
    const A=Math.max(4,+it.area||0); let done=null;
    for(const reg of regions){ if(done||!reg||!reg.length) continue;
      const [u0,u1]=G.extent(reg,ax[0]), [v0,v1]=G.extent(reg,ax[1]), st=Math.max(0.5,Math.min(1.5,Math.sqrt(A)/8));
      for(const rt of [1.5,1,2.2,0.67,0.45,3.2]){ if(done) break; const w=Math.sqrt(A*rt), h=A/w; if(w>u1-u0-0.4||h>v1-v0-0.4) continue;
        for(let v=v0+0.2; v+h<=v1-0.2 && !done; v+=st) for(let u=u0+0.2; u+w<=u1-0.2; u+=st){ const p=G.rect(ax[0],ax[1],u,v,w,h);
          if(!G.polyInPoly(p,reg) || ob.some(o=>G.polysOverlap(p,o))) continue; done=p; break } } }
    if(done){ placed.push({poly:done,item:it}); ob.push(scaleBy(done,1.12)) } else miss.push(it);
  });
  return {placed, miss};
}
/* lazer e áreas comuns: no cálculo completo, o planejador de src/calc/comuns.js (m.comuns: ambientes com portas, mobiliário,
   rota acessível e nota) e o resumo no formato antigo (m.lzLay: {terreo, terreoDesc, emb, pav, cob, miss}, cada item {poly,item,ix});
   no cálculo rápido (otimizador, cálculo barato) o empacotamento simples de sempre */
function lazerLayout(st, m, opt){
  if(!(opt && opt.quick) && typeof comunsCalc==="function" && (st.comuns||{}).on!==false){
    try{ m.comuns = comunsCalc(st, m); if(m.comuns) return lzDeComuns(st, m, m.comuns) }catch(e){ console.error("[comuns]", e); m.comuns=null }
  }
  return lazerPack(st, m);
}
function lzDeComuns(st, m, C){
  const it=(st.produto.lazer&&st.produto.lazer.itens)||[], out={terreo:[],terreoDesc:[],emb:[],pav:[],cob:[],miss:[],missIx:[]};
  const item=a=> it[a.ix] ? {...it[a.ix]} : {nome:a.nome, area:a.A, local:a.local, desc:a.desc};
  C.amb.forEach(a=>{ if(a.ix==null || a.k==="copa" || a.k==="apoioPisc") return; const lst= a.local==="terreo"? (a.desc? out.terreoDesc : out.terreo) : out[a.local]; if(!lst) return;
    if(a.k==="piscina"){ if(a.deck) lst.push({poly:a.poly, item:{...(it[a.deck.ix]||{nome:"Solário"}), desc:true}, ix:a.deck.ix, deck:true}); else lst.push({poly:a.poly, item:{nome:"Solário", area:a.deckA||0, desc:true}, ix:null, deck:true}); lst.push({poly:a.lamina||a.poly, item:item(a), ix:a.ix}) }
    else lst.push({poly:a.poly, item:item(a), ix:a.ix}) });
  // não coube: itens do lazer (pelo índice) e, para o hall crescer, o apoio coberto do térreo
  C.falta.forEach(a=>{ if(a.ix!=null){ if(!out.missIx.includes(a.ix) && it[a.ix] && !(a.k==="deck" && C.amb.some(x=>x.deck && x.deck.ix===a.ix))){ out.missIx.push(a.ix); out.miss.push(it[a.ix]) } }
    else if(a.local==="terreo" && !a.desc && a.nivel!=="warn" && CMN_CAT[a.k] && CMN_CAT[a.k].onde!=="recuo") out.miss.push({nome:a.nome, area:a.A, local:"terreo", apoio:true}) });
  return out;
}
function lazerPack(st, m){
  const it=(st.produto.lazer&&st.produto.lazer.itens)||[], T=m.ter||{}, out={terreo:[],terreoDesc:[],emb:[],pav:[],cob:[],miss:[],missIx:[]};
  if(!it.length) return out;
  const by=(l,d)=>it.filter(x=>(LZ_LOCAIS[x.local]?x.local:"terreo")===l && (d==null || !!x.desc===d));
  const ax=T.fd? [T.lat,T.fd] : [[1,0],[0,1]];
  const cores=m.coreSets||[], coreOb=cores.flatMap(c=>[c.core, scaleBy(c.lobby,1.25)]);
  // térreo coberto: dentro do hall, deixando livre uma faixa de circulação junto à frente e o hall dos elevadores
  if(T.hallBand && T.hallBand.length){ const strip=G.rect(T.lat,T.fd,T.lmn,T.d1,T.lmx-T.lmn,2.6);
    const r=packItems(T.hallBand,[...coreOb,strip,...(T.drive||[]),...(m.ramp?[m.ramp.poly]:[])],by("terreo",false),ax); out.terreo=r.placed; out.miss.push(...r.miss) }
  else out.miss.push(...by("terreo",false));
  // térreo descoberto: nos recuos (jardins)
  { const r=packItems([st.lote.pts],[m.emb,...(T.drive||[]).map(p=>scaleBy(p,1.6)),...(T.driveRua||[]).map(p=>scaleBy(p,1.3)),...(m.vf?m.vf.vagas.map(v=>v.poly):[])],by("terreo",true),ax); out.terreoDesc=r.placed; out.miss.push(...r.miss) }
  // laje do embasamento: em volta das torres
  { const r=packItems([m.emb], m.T.map(t=>scaleBy(t.plate,1.18)), by("emb"), ax); out.emb=r.placed; out.miss.push(...r.miss) }
  // pavimento de lazer e rooftop: na torre 1
  const t0=m.T[0], c0=cores.find(c=>c.i===0), ax0=c0&&c0.lay? [c0.lay.ux,c0.lay.vy] : ax;
  if(t0 && t0.plate.length){ const ob=c0? [c0.core, c0.lobby] : [];
    let r=packItems([t0.plate], ob, by("pav"), ax0); out.pav=r.placed; out.miss.push(...r.miss);
    r=packItems([t0.plate], c0? [c0.core] : [], by("cob"), ax0); out.cob=r.placed; out.miss.push(...r.miss) }
  else out.miss.push(...by("pav"),...by("cob"));
  out.missIx=out.miss.map(x=>it.indexOf(x)).filter(i=>i>=0);
  return out;
}
