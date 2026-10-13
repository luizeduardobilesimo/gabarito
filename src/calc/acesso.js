/* ================= acesso de veículos por qualquer frente do lote (cálculo puro: Node, Worker e página) =================
   S.lote.ladoVei = índice do lado por onde o carro entra (null = frente principal, como sempre foi).
   Só vale um lado que dá para a rua (S.lote.front); qualquer outro valor cai na frente principal.
   A frente principal continua recebendo lojas, hall, passagem de pedestres e vagas na frente; o lado de veículos recebe
   a faixa das rampas e da garagem do térreo, com a rampa começando 5 m depois do alinhamento DAQUELE lado.
   acPrincipal(st)        → índice da frente principal (mesma regra de frontDir/accessPoints)
   ladoVeiIdx(st)         → índice do lado de veículos já resolvido
   acLateral(st)          → true quando o carro entra por um lado diferente da frente principal
   veiDir(st)             → normal para dentro do lote no lado de veículos
   acNormal(pts, i)       → normal para dentro do lado i (lote anti-horário)
   acSubRect(p, lat, fd, a, b, d0, d1) → partes de p fora do retângulo {a ≤ p·lat ≤ b, d0 ≤ p·fd ≤ d1}
   acLadosRua(st)         → lados na rua, a frente principal primeiro (usados no estudo do melhor acesso) */
function acPrincipal(st){ const L=st.lote; return L.front.includes(L.principal)? L.principal : (L.front[0] ?? 0) }
function ladoVeiIdx(st){
  const L=st.lote, v=L.ladoVei;
  return (v!=null && Number.isInteger(+v) && +v>=0 && +v<L.pts.length && L.front.includes(+v)) ? +v : acPrincipal(st);
}
const acLateral = st => ladoVeiIdx(st)!==acPrincipal(st);
function acNormal(pts, i){ const a=pts[i], b=pts[(i+1)%pts.length]; if(!a||!b) return [0,1];
  const dx=b[0]-a[0], dy=b[1]-a[1], l=Math.hypot(dx,dy)||1; return [-dy/l, dx/l] }
const veiDir = st => acNormal(st.lote.pts, ladoVeiIdx(st));
function acSubRect(p, lat, fd, a, b, d0, d1){
  if(!p || p.length<3) return [];
  const BIG=1e6, out=[G.band(p,lat,-BIG,a), G.band(p,lat,b,BIG)], mid=G.band(p,lat,a,b);
  if(mid.length){ out.push(G.band(mid,fd,-BIG,d0), G.band(mid,fd,d1,BIG)) }
  return out.filter(q=>q.length>2 && G.area(q)>0.25);
}
/* térreo com o carro entrando por outro lado (chamado por terreoZones, src/programa.js, depois do hall e das colunas até os núcleos).
   As faixas (rampas + faixa da garagem do térreo) são arrumadas por driveLayout no referencial do lado de veículos; o que é de pedestre
   (lojas, faixa de circulação junto a elas, hall até d2 quando há garagem no térreo e o caminho até cada núcleo) entra como obstáculo. */
function terreoVeiLateral(st, m, out, c){
  const P=st.produto, E=st.estudo, {emb, fd, lat, dmn, dmx, lmn, lmx, d1, d2, garOn, hasRamp, cols}=c;
  const iv=m.acesso.edgeV, vfd=veiDir(st), vlat=[vfd[1],-vfd[0]], [vdmn,vdmx]=G.extent(emb,vfd), [vlmn,vlmx]=G.extent(emb,vlat);
  Object.assign(out,{vfd, vlat, vdmn, vdmx, vlmn, vlmx, veiLado:iv});
  const W2V=(l,d)=>[vlat[0]*l+vfd[0]*d, vlat[1]*l+vfd[1]*d];
  const R=(l0,l1,d0,d1_)=> l1-l0>0.05 && d1_-d0>0.05 ? G.rect(lat,fd,l0,d0,l1-l0,d1_-d0) : null, BIG=500;
  // reserva de pedestres: com garagem no térreo, tudo até o fim do hall; sem ela, as lojas e a faixa de circulação junto a elas
  const reservaDe=gOn=>{ const dFront = gOn? d2 : Math.min(dmx, d1+2.6), rs=[R(lmn-BIG, lmx+BIG, dmn-BIG, dFront+0.3)];
    cols.forEach(k=>{ if(gOn) rs.push(R(k.corr[0]-0.3, k.corr[1]+0.3, d1, Math.max(d1,k.near)+0.3), R(k.iv[0], k.iv[1], Math.max(d1,k.near), k.back));
      else rs.push(R(k.iv[0], k.iv[1], d1, k.back)) });
    return rs.filter(Boolean) };
  const roda=(rs,o)=>driveLayout(st, vlmn, vlmx, G.dot(m.acesso.vei,vlat), {...m, obst:[...(m.obst||[]), ...rs]}, vfd, vlat, o);
  let res=reservaDe(garOn), dl=roda(res);
  // a faixa da garagem do térreo não coube atrás do hall: sem ela o hall ocupa o térreo todo e o carro só precisa poupar as lojas e os caminhos
  if(garOn && dl && (dl.semFaixa || dl.naoCabe)){ const r2=reservaDe(false), d2_=roda(r2, {semFaixa:true}); if(d2_ && (!d2_.naoCabe || dl.naoCabe)){ dl=d2_; res=r2 } }
  out.drive0=dl;
  const r={dl, vfd, vlat, vdmn, vdmx, W2V, reserva:res, poly:[], rua:[]};
  if(!dl) return r;
  const Ln=`L${iv+1}`;
  if(dl.semAlt) out.warn.push("As rampas alternadas não cabem ao lado dos núcleos — o estudo usou rampas retas empilhadas.");
  if(dl.semFaixa){ r.semFaixa=true; out.semFaixa=true; out.warn.push(`Pela ${Ln}, não há largura para a faixa da garagem do térreo ao lado das rampas sem passar pelos núcleos ou pelo hall — a garagem do térreo foi desligada neste estudo.`) }
  if(dl.naoCabe) out.warn.push(`Pela ${Ln}, as rampas não cabem sem passar pelos núcleos, pelo hall ou pelas lojas. Tente “Encontrar o melhor acesso”, outra posição no lado, rampas alternadas ou o acesso pela frente principal.`);
  const dv=dl.dv, gOn=garOn && !dl.semFaixa; out.lanes=dl.laneIv||null;
  out.veiReal=W2V((dv[0]+dv[1])/2, G.dot(m.acesso.vei,vfd)); out.veiShift=dl.shift||0;
  const RX=rampExt(st, m, vfd); out.rx=RX;
  const dEndV = hasRamp && !E.rampa ? Math.min(vdmx, RX.s0 + Math.max(P.subsolos? RX.LD:0, P.garAcima? RX.LU:0)) : vdmn+PATAMAR;
  // com garagem no térreo o acesso é o pátio até o início das rampas (≥ 5 m do alinhamento); sem ela, vai até o fim das rampas
  const aE = gOn ? Math.min(vdmx, Math.max(vdmn+1, hasRamp && !E.rampa ? RX.s0 : RX.lotFront+PATAMAR)) : Math.min(vdmx, Math.max(dEndV, vdmn+PATAMAR));
  Object.assign(r, {dv, aE, lotF:RX.lotFront});
  const b=G.band(emb,vfd,vdmn,aE), p=b.length? G.band(b,vlat,dv[0],dv[1]) : []; r.poly = p.length>2? p : [];
  const rua=G.band(G.band(st.lote.pts,vfd,RX.lotFront,vdmn),vlat,dv[0],dv[1]); r.rua = rua.length>2 && G.area(rua)>0.25 ? [rua] : [];
  if(!dl.naoCabe && r.poly.length) (m.coreSets||[]).forEach(cs=>{ if(G.polysOverlap(r.poly,cs.core)||G.polysOverlap(r.poly,cs.lobby||[])) out.warn.push(`O acesso de veículos passa sobre o núcleo da torre ${cs.i+1} — mova o acesso na etapa Terreno.`) });
  return r;
}
/* fecha o térreo: grava o acesso, tira-o do hall/lojas e, com garagem no térreo, liga o pátio de entrada à garagem (portal + faixa sem vagas) */
function terreoVeiFecha(out, r, garOn){
  if(!r.dl || !r.poly.length) return;
  out.drive.push(r.poly); out.driveRua=r.rua;
  const DR=G.rect(r.vlat, r.vfd, r.dv[0], r.lotF-1, r.dv[1]-r.dv[0], r.aE-r.lotF+1);
  const cut=list=>list.flatMap(p=> p && p.length && G.polysOverlap(p,DR) ? acSubRect(p, r.vlat, r.vfd, r.dv[0], r.dv[1], r.lotF-1, r.aE) : [p]);
  ["lojas","hallBand","pass","cols","colsGar","walk","hall"].forEach(k=>{ out[k]=cut(out[k]||[]) });
  if(garOn && out.lanes){ const lc=(out.lanes[0]+out.lanes[1])/2;
    out.keep.push(r.poly, G.rect(r.vlat, r.vfd, out.lanes[0], r.aE, out.lanes[1]-out.lanes[0], 6));
    out.driveEnd=r.W2V(lc, r.vdmn+1.4); out.driveHead=r.vfd }
}
function acLadosRua(st){ const pr=acPrincipal(st), n=st.lote.pts.length; return [pr, ...st.lote.front.filter(i=>i!==pr && i>=0 && i<n)] }
