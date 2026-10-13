/* ================= Fase C — torres desenhadas (blocos) =================
   C0: o "Limite especial › Torres" pode virar a planta da torre (S.custom.torOcupa).
   O massing usa o contorno recortado pelos recuos como planta; as unidades do mix crescem ou encolhem
   (fator t.r) até preencher o andar. Aqui ficam o resumo, os avisos e o "Ajustar mix". Puro (sem DOM).

   C1: forma livre da torre. Estado em S.blocos = {modo:"auto"|"desenhada", torres:[{blocos:[{pts, vazios?, de, tipo?, rot?}]}]}
   (índice = torre de S.produto.torres). Um bloco é um contorno que vale do andar 'de' até o próximo bloco; no C1 cada torre
   tem no máximo UM bloco (de = 1, vale para todos os andares — o total segue no stepper da torre). Em "desenhada", a torre
   com bloco usa o bloco como planta (recortado pelo lote, NÃO encolhido pelos recuos): recuo, TO, CA, gabarito, balanço,
   núcleo e distância entre torres viram avisos. Torre sem bloco (ou modo "auto") = forma automática, como antes.

   C2: pilha de blocos (blcPilha/blcTorre/blcFaixas). Cada bloco vira uma faixa de t.faixas (de, ate, plate, A, z0, z1, bk,
   ref); o último estica até o total de andares do stepper. O bloco de referência (mais andares tipo) é t.plate e recebe o
   pavimento tipo detalhado; os demais repetem o MESMO núcleo com unidades por área (blcLayFaixa → f.lay), mix por
   blcMixFaixa (unidades do tamanho das do bloco de referência, quantidade pela área). Avisos por bloco: recuos na sua cota,
   balanço sobre o bloco de baixo, núcleo cortado, bloco ignorado. Edição pura: blcMaisBloco, blcCopiaBaixo, blcRecua. */
extendDEF("blocos", { modo:"auto", torres:[] });
const BLC_FORMAS = [["ret","Retângulo"],["L","L"],["U","U"],["T","T"],["H","H"],["patio","Pátio"]];
const blcAtivo = st => !!(st && st.blocos && st.blocos.modo==="desenhada");
const blcValido = b => !!(b && b.pts && b.pts.length>2);
/* bloco k da torre i (padrão: o primeiro), só no modo desenhado */
function blcBloco(st, i, k=0){ if(!blcAtivo(st)) return null; const t=(st.blocos.torres||[])[i], b=t && t.blocos && t.blocos[k]; return blcValido(b) ? b : null }
/* planta de um bloco: contorno recortado pelo lote; os vazios inteiros dentro viram polígono com ponte (entPoly) */
function blcPlanta(b, L){
  const raw=b.pts, rawA=G.area(raw), out = L && L.length>2 ? G.clipToPoly(raw, L) : raw.slice();
  if(out.length<3) return {plate:[], A:0, oco:null, rawA, foraLote:rawA};
  const vz=(b.vazios||[]).filter(v=>entVazioOk({pts:out}, v));
  const plate = vz.length ? entPoly({pts:out, vazios:vz}) : out;
  return {plate, A:G.area(plate), oco: vz.length? {pts:out, vazios:vz} : null, rawA, foraLote:Math.max(0, rawA-G.area(out))};
}
/* C2 — pilha de blocos. A lista da torre fica ordenada por 'de'; o 1º bloco sempre começa no 1º andar e o ÚLTIMO estica
   até o total de andares do stepper (Máx, otimizador e cenários seguem funcionando). Bloco que começa acima do total
   (ou no mesmo andar que o anterior) fica de fora, com aviso. Bloco de referência = o que tem mais andares tipo (empate:
   o mais baixo): é a planta da torre (t.plate), onde o pavimento tipo é detalhado; os demais repetem o mesmo núcleo. */
function blcPilha(st, i, L, pav){
  if(!blcAtivo(st)) return null;
  const tw=(st.blocos.torres||[])[i], lst=((tw && tw.blocos)||[]).map((b,k)=>({b,k})).filter(x=>blcValido(x.b));
  if(!lst.length) return null;
  lst.sort((a,c)=>(+a.b.de||1)-(+c.b.de||1) || a.k-c.k);
  const P=st.produto, N=Math.max(1, Math.round(+pav || +((P.torres[i]||{}).pav) || 1)), tf=N-(P.cob && P.cob.on && N>=2 ? 1 : 0);
  const pil=[], ign=[];
  lst.forEach((x,j)=>{ const de = j===0 ? 1 : Math.max(1, Math.round(+x.b.de||1)), ant=pil[pil.length-1];
    if(ant && de<=ant.de){ ign.push({k:x.k, de, motivo:"repetido"}); return }
    if(de>N){ ign.push({k:x.k, de, motivo:"acima"}); return }
    pil.push({k:x.k, b:x.b, de}) });
  pil.forEach((p,j)=>{ p.ate = j<pil.length-1 ? pil[j+1].de-1 : N; p.n=p.ate-p.de+1; p.nTipo=Math.max(0, Math.min(p.ate, tf)-p.de+1); Object.assign(p, blcPlanta(p.b, L)) });
  let ref=pil[0]; pil.forEach(p=>{ if(p.A>1 && (ref.A<=1 || p.nTipo>ref.nTipo)) ref=p });
  return {pil, ign, ref, N};
}
/* chamado pelo massing: planta desenhada da torre i (ou null = automática). plate/A/oco = bloco de referência;
   pilha = blocos ativos (de, ate, planta); Aproj = maior projeção (TO); foraLote = soma dos blocos */
function blcTorre(st, i, L, pav){
  const R=blcPilha(st, i, L, pav); if(!R) return null; const r=R.ref;
  return {plate:r.plate, A:r.A, oco:r.oco, rawA:r.rawA, foraLote:R.pil.reduce((s,p)=>s+p.foraLote,0), b:r.b, ref:r.k,
    pilha:R.pil, ign:R.ign, Aproj:Math.max(...R.pil.map(p=>p.A))};
}
/* faixas de andares da pilha (massing): uma por bloco; com um bloco só devolve [] (o massing usa a faixa única, como no C1) */
function blcFaixas(bl, zB, pe, afAt){
  if(!bl || !bl.pilha || bl.pilha.length<2) return [];
  return bl.pilha.map(p=>{ const z1=zB+p.ate*pe; return {de:p.de, ate:p.ate, n:p.n, plate:p.plate, A:p.A, z0:zB+(p.de-1)*pe, z1, af:afAt? afAt(z1) : 0,
    blc:true, bk:p.k, ref:p.k===bl.ref, oco:p.oco, foraLote:p.foraLote} });
}
/* mix de um bloco que não é o de referência: unidades do MESMO tamanho das do bloco de referência (fator rRef) e a
   quantidade por andar ajustada à área do bloco (proporção do mix mantida, ≥ 1 por tipologia usada); o fator final
   fecha a conta para a privativa ser área × eficiência, como no C1 */
function blcMixFaixa(mix, cap, rRef){
  const rr = rRef>0 ? rRef : 1, q=torreAjustaMix(mix, cap/rr, 99), s=mix.reduce((a,u,j)=>a+(+u.area||0)*q[j],0);
  return {qtd:q, r: s>0 && cap>0 ? cap/s : 0};
}
/* layout de um andar de outro bloco: o MESMO núcleo do bloco de referência (núcleo contínuo) e as unidades distribuídas
   por área em volta dele, nos dois lados do corredor (que segue a linha do corredor do tipo). Puro. */
function blcLayFaixa(plate, ref, list, o={}){
  if(!plate || plate.length<3 || !ref || !ref.core || !ref.core.length) return null;
  const ux=ref.ux, vy=ref.vy, [u0,u1]=G.extent(plate,ux), [v0,v1]=G.extent(plate,vy);
  const sub=(va,vb,ua,ub)=>{ if(!(vb-va>0.05)) return []; const b=G.band(plate,vy,va,vb); return (ua===undefined||!b.length)? b : !(ub-ua>0.05) ? [] : G.band(b,ux,ua,ub) };
  const core=ref.coreOut||ref.core, [ku0,ku1]=G.extent(core,ux), [kv0,kv1]=G.extent(core,vy);
  let [c0,c1] = ref.corridor && ref.corridor.length>2 ? G.extent(ref.corridor, vy) : [(kv0+kv1)/2, (kv0+kv1)/2];
  const corridor = sub(c0, c1, u0+0.01, u1-0.01), reg=[];
  // um lado do corredor: inteiro, ou dividido em volta do núcleo (com o trecho atrás dele, se houver fundo)
  const lado=(va,vb,fac)=>{ if(vb-va<1) return;
    if(kv1>va+0.1 && kv0<vb-0.1){ reg.push({p:sub(va,vb,u0,ku0),fac}); reg.push({p:sub(va,vb,ku1,u1),fac});
      if(fac==="max" && vb-kv1>3) reg.push({p:sub(kv1,vb,ku0,ku1),fac}); if(fac==="min" && kv0-va>3) reg.push({p:sub(va,kv0,ku0,ku1),fac}) }
    else reg.push({p:sub(va,vb),fac}) };
  lado(v0, c0, "min"); lado(c1, v1, "max");
  const R=reg.filter(r=>r.p.length && G.area(r.p)>4).map(r=>({...r, A:G.area(r.p), list:[], used:0}));
  const us=list.map((u,i)=>({...u,i})).sort((a,b)=>b.alvo-a.alvo), totalAlvo=us.reduce((s,u)=>s+u.alvo,0), totalA=R.reduce((s,r)=>s+r.A,0)||1;
  us.forEach(u=>{ let best=null, bs=-Infinity; R.forEach(r=>{ const s=r.A/totalA*totalAlvo-r.used-u.alvo*0.5; if(s>bs){ bs=s; best=r } }); if(best){ best.list.push(u); best.used+=u.alvo } });
  const out=[], sacTipo=o.sacTipo||"embutida", prof=o.sacProf||1.6;
  R.forEach(r=>{
    if(!r.list.length){ out.push({poly:r.p, nome:"livre", alvo:0, area:r.A, livre:true}); return }
    r.list.sort((a,b)=>a.i-b.i);
    const tot=r.list.reduce((s,u)=>s+u.alvo,0); let a2=0; const [mn,mx]=G.extent(r.p,ux); let prev=mn;
    r.list.forEach((u,j)=>{ a2+=u.alvo; const cut = j===r.list.length-1 ? mx : G.cutAt(r.p,ux,a2/tot), poly=G.band(r.p,ux,prev,cut);
      const un={poly, nome:u.nome, alvo:u.alvo, area:G.area(poly), fac:r.fac};
      if(u.sac>0 && poly.length){ const [pv0,pv1]=G.extent(poly,vy), wU=cut-prev, w=Math.max(1.2,Math.min(wU-1, u.sac/prof)), pr=u.sac/w, uc=(prev+cut)/2;
        let va,vb; if(r.fac==="max"){ va= sacTipo==="balanco"? pv1 : pv1-pr; vb=va+pr } else { vb= sacTipo==="balanco"? pv0 : pv0+pr; va=vb-pr }
        let sp=G.rect(ux,vy,uc-w/2,va,w,vb-va); if(sacTipo!=="balanco") sp=G.clipToPoly(sp, poly);
        un.sac={poly:sp, area:G.area(sp), tipo:sacTipo} }
      prev=cut; out.push(un) });
  });
  return {ux, vy, units:out, core:ref.core, lobby:ref.lobby, coreParts:ref.coreParts, coreDoors:ref.coreDoors, coreLines:ref.coreLines,
    coreOut:ref.coreOut, coreReserva:ref.coreReserva, coreA:ref.coreA, coreKinds:ref.coreKinds, fachada:ref.fachada, corridor, dbl:ref.dbl, hallEnds:[], escSobra:0, blc:true};
}
/* compute (src/model.js, logo depois do pavimento tipo): layout por área dos blocos que não são o de referência + núcleo dentro? */
function blcLayFaixas(st, m){
  const P=st.produto;
  (m.T||[]).forEach((t,i)=>{ const ref=m.tipo && m.tipo[i]; if(!t.desenhada || !ref || !t.faixas || t.faixas.length<2) return;
    const tem = ref.core && ref.core.length, base = tem ? blcDentro(ref.core, t.plate) : 1;   // o quanto o núcleo cabe no próprio bloco de referência
    t.faixas.forEach(f=>{ if(f.plate===t.plate) return;
      // núcleo cortado = o bloco perde parte do núcleo que o bloco de referência tem (C3: a segunda escada também sobe inteira)
      f.nucleo = f.A>1 && tem ? Math.min(1, blcDentro(ref.core, f.plate) + (1-base), ...(ref.coreExtra||[]).map(p=>blcDentro(p, f.plate))) : 0;
      if(f.nTipo<1 || f.A<1) return;
      const list=[]; P.mix.forEach((u,j)=>{ for(let q=0;q<(f.qtd[j]||0);q++) list.push({nome:u.nome, alvo:u.area*f.r, sac:+u.sac||0}) });
      const E=st.estudo, o={sacTipo:P.sacTipo, sacProf:P.sacProf};
      // C3: bloco em L/U/T/H/pátio (ou referência por alas) → layout por ala com o mesmo núcleo e o corredor nas mesmas linhas
      const la = typeof alasLayFaixa==="function" && f.nucleo>=0.999 ? alasLayFaixa(f.plate, f.oco||null, ref, list, {...o, corr:E.corrTipo, profMin:E.profMin, planta:E.tipoPlanta,
        escTipo:E.escTipo, nEsc:E.nEsc, emerg:E.emerg, fachada:E.fachada, nElev:ref.coreParts.filter(c=>c.kind==="elev").length||1}, st) : null;
      // sem layout por ala: unidades por área em volta do núcleo, no corredor que passa na frente dele
      f.lay = la || blcLayFaixa(f.plate, ref.alas ? {...ref, ux:ref.coreUx||ref.ux, vy:ref.coreVy||ref.vy, corridor:ref.corrNucleo||ref.corridor} : ref, list, o) }) });
}
/* layout do andar k (1 = primeiro pavimento da torre i): o da faixa (bloco) quando houver, senão o pavimento tipo */
function torreLayAndar(m, i, k){ const t=m.T && m.T[i], f=t && (t.faixas||[]).find(f=>k>=f.de && k<=f.ate); return (f && f.lay) || (m.tipo && m.tipo[i]) || null }
/* planta do andar k (1 = primeiro pavimento da torre) pela faixa a que ele pertence (2.4 escalonada; C2 pilha de blocos) */
function torrePlantaAndar(t, k){ const f=(t.faixas||[]).find(f=>k>=f.de && k<=f.ate); return f && f.plate ? f.plate : t.plate }
/* perímetro de fachada de uma planta da torre (com pátio: borda + vazios, sem a "ponte" do polígono) */
function blcPerim(t, p){ if(!p || p.length<3) return 0; const oco = t && t.oco && p===t.plate ? t.oco : t && ((t.faixas||[]).find(f=>f.plate===p && f.oco)||{}).oco;
  if(oco) return [oco.pts, ...oco.vazios].reduce((s,r)=>s+G.perimeter(r),0); return G.perimeter(p) }
/* contorno com pátios do andar k (1 = primeiro pavimento) da torre t: {pts, vazios} ou null (planta sem pátio) */
function blcAnelAndar(t, k){ const f=(t.faixas||[]).find(f=>k>=f.de && k<=f.ate); return (f && f.oco) || ((!f || f.plate===t.plate) && t.oco) || null }
/* IFC (C3): perfil de uma laje — com pátio, IfcArbitraryProfileDefWithVoids (borda + um IfcPolyline por vazio, sem a "ponte"
   do polígono); sem pátio, o IfcArbitraryClosedProfileDef de sempre. add(s) grava a entidade e devolve "#id"; num(v) formata */
function blcIfcPerfil(add, num, outer, vazios){
  const curva=r=>{ const pts=r.map(q=>add(`IFCCARTESIANPOINT((${num(q[0])},${num(q[1])}))`)); return add(`IFCPOLYLINE((${[...pts,pts[0]].join(",")}))`) };
  const o=curva(outer), vz=(vazios||[]).filter(v=>v && v.length>2);
  return vz.length ? add(`IFCARBITRARYPROFILEDEFWITHVOIDS(.AREA.,$,${o},(${vz.map(curva).join(",")}))`) : add(`IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,${o})`);
}
/* ---------- edição da pilha (puras; a interface chama e depois update()) ---------- */
const blcClone = b => { const c={pts:b.pts.map(q=>[q[0],q[1]]), de:b.de}; if(b.vazios && b.vazios.length) c.vazios=b.vazios.map(v=>v.map(q=>[q[0],q[1]])); if(b.tipo) c.tipo=b.tipo; if(b.rot!=null) c.rot=b.rot; return c };
/* "+ Bloco": novo bloco no topo, cópia do de cima, começando no meio da faixa de cima (null se ela tem um andar só) */
function blcMaisBloco(st, i){
  const tw=(st.blocos.torres||[])[i], L=tw && tw.blocos; if(!L || !L.length || !blcValido(L[L.length-1])) return null;
  const top=L[L.length-1], N=Math.max(1, Math.round(+((st.produto.torres[i]||{}).pav)||1)), de0=L.length===1? 1 : Math.max(1, Math.round(+top.de||1)), n=N-de0+1;
  if(n<2) return null;
  const nb=blcClone(top); nb.de=de0+Math.ceil(n/2); L.push(nb); return nb;
}
/* "Copiar do de baixo": o bloco k fica com o contorno (e os pátios) do bloco k−1; o andar inicial não muda */
function blcCopiaBaixo(st, i, k){
  const L=((st.blocos.torres||[])[i]||{}).blocos; if(!L || !(k>0) || !blcValido(L[k-1]) || !L[k]) return null;
  const c=blcClone(L[k-1]); c.de=L[k].de; L[k]=c; return c;
}
/* contorno deslocado d metros para dentro (d < 0: para fora), lado a lado (esquina em ponta). Vale para L, U, T, H…
   desde que d seja menor que metade da ala mais estreita; senão devolve null. C3: d pode ser uma função (índice do lado →
   distância), para recuar só algumas fachadas; dois lados colineares com recuos diferentes ganham um dente no vértice */
function blcOffset(p, d){
  if(!p || p.length<3) return null; const s=Math.sign(G.sArea(p))||1, ln=[], dd = typeof d==="function" ? d : ()=>d;
  for(let i=0;i<p.length;i++){ const a=p[i], b=p[(i+1)%p.length], dx=b[0]-a[0], dy=b[1]-a[1], l=Math.hypot(dx,dy); if(l<1e-6) continue;
    const u=[dx/l, dy/l], n=[-u[1]*s, u[0]*s], di=+dd(i)||0; const q=ln[ln.length-1]; if(q && Math.abs(q.u[0]*u[1]-q.u[1]*u[0])<1e-9 && q.u[0]*u[0]+q.u[1]*u[1]>0 && Math.abs(q.d-di)<1e-9) continue;   // colinear com o anterior
    ln.push({a:[a[0]+n[0]*di, a[1]+n[1]*di], u, d:di, o:a}) }
  if(ln.length<3) return null;
  const out=[], dir=[];   // dir[k] = direção esperada do lado out[k] → out[k+1] (null = dente entre recuos diferentes)
  ln.forEach((B,i)=>{ const A=ln[(i-1+ln.length)%ln.length], cr=A.u[0]*B.u[1]-A.u[1]*B.u[0];
    if(Math.abs(cr)<1e-9){ if(Math.abs(A.d-B.d)>1e-9 && A.u[0]*B.u[0]+A.u[1]*B.u[1]>0){ const t=(B.o[0]-A.a[0])*A.u[0]+(B.o[1]-A.a[1])*A.u[1]; out.push([A.a[0]+A.u[0]*t, A.a[1]+A.u[1]*t]); dir.push(null) } out.push(B.a.slice()); dir.push(B.u); return }
    const t=((B.a[0]-A.a[0])*B.u[1]-(B.a[1]-A.a[1])*B.u[0])/cr; out.push([A.a[0]+A.u[0]*t, A.a[1]+A.u[1]*t]); dir.push(B.u) });
  for(let i=0;i<out.length;i++){ const a=out[i], b=out[(i+1)%out.length]; if(dir[i] && (b[0]-a[0])*dir[i][0]+(b[1]-a[1])*dir[i][1] <= 0.05) return null }   // lado sumiu ou inverteu
  for(let i=0;i<out.length;i++) for(let j=i+2;j<out.length;j++){ if(i===0 && j===out.length-1) continue; if(G.segInter(out[i],out[(i+1)%out.length],out[j],out[(j+1)%out.length])) return null }
  const ds=ln.map(l=>l.d), dentro=ds.every(x=>x>=0) && ds.some(x=>x>0), fora=ds.every(x=>x<=0) && ds.some(x=>x<0);
  const a0=G.area(p), a1=G.area(out); if(Math.sign(G.sArea(out))!==s || !(a1>1) || (dentro && a1>=a0) || (fora && a1<=a0)) return null;
  return out;
}
/* lados de p que, recuados di (função do índice), cortariam algum dos polígonos 'nucleos' (o núcleo e a segunda escada);
   os lados colineares e contíguos a um lado preservado também ficam (a fachada do núcleo segue reta) */
function blcLadosNucleo(p, di, nucleos){
  const keep=new Set(), s=Math.sign(G.sArea(p))||1, n=p.length, NS=(nucleos||[]).filter(q=>q && q.length>2).map(q=>G.scaleToArea(q, G.area(q)*0.97));
  if(!NS.length) return keep;
  const lado=i=>{ const a=p[i], b=p[(i+1)%n], l=Math.hypot(b[0]-a[0], b[1]-a[1]); return l<1e-6 ? null : {a, b, l, u:[(b[0]-a[0])/l, (b[1]-a[1])/l]} };
  for(let i=0;i<n;i++){ const e=lado(i), d=+di(i)||0; if(!e || !d) continue;
    const nn=[-e.u[1]*s*Math.sign(d), e.u[0]*s*Math.sign(d)], D=Math.abs(d)+0.05, a=[e.a[0]+e.u[0]*0.05-nn[0]*0.05, e.a[1]+e.u[1]*0.05-nn[1]*0.05], b=[e.b[0]-e.u[0]*0.05-nn[0]*0.05, e.b[1]-e.u[1]*0.05-nn[1]*0.05];
    const tira=[a, b, [b[0]+nn[0]*D, b[1]+nn[1]*D], [a[0]+nn[0]*D, a[1]+nn[1]*D]];
    if(NS.some(q=>G.polysOverlap(tira, q))) keep.add(i) }
  for(let mud=true; mud;){ mud=false; for(const i of [...keep]) [i-1, i+1].forEach(j0=>{ const j=(j0+n)%n; if(keep.has(j)) return; const A=lado(i), B=lado(j); if(!A || !B) return;
      const par=Math.abs(A.u[0]*B.u[1]-A.u[1]*B.u[0])<1e-6 && A.u[0]*B.u[0]+A.u[1]*B.u[1]>0, lin=Math.abs((B.a[0]-A.a[0])*A.u[1]-(B.a[1]-A.a[1])*A.u[0])<0.05;
      if(par && lin){ keep.add(j); mud=true } }) }
  return keep;
}
/* núcleo atual da torre i (e a segunda escada, C3), do modelo calculado agora */
function blcNucleos(st, i){ try{ const m=compute(st, {quick:true, layouts:false}), l=m.tipo && m.tipo[i]; return l && l.core && l.core.length ? [l.coreOut||l.core, ...(l.coreExtra||[])] : [] }catch(e){ return [] } }
/* "Recuar X m": o bloco k vira o bloco de baixo recuado X m (pátios crescem X m); o 1º bloco recua em si mesmo.
   C3: por padrão as fachadas onde o núcleo (ou a segunda escada) encosta NÃO recuam — o recuo cortaria o núcleo que sobe
   inteiro; o.todas (ou S.alas.recuaTodas) recua todas. o.nucleos = polígonos do núcleo (senão, calcula o modelo) */
function blcRecua(st, i, k, d, o={}){
  const L=((st.blocos.torres||[])[i]||{}).blocos, base=L && (k>0 ? L[k-1] : L[k]); if(!blcValido(base) || !L[k] || !(d>0)) return null;
  const todas = o.todas ?? !!(st.alas && st.alas.recuaTodas), nuc = todas ? [] : (o.nucleos || blcNucleos(st, i));
  const kO=blcLadosNucleo(base.pts, ()=>d, nuc), pts=blcOffset(base.pts, kO.size ? j=>kO.has(j)? 0 : d : d); if(!pts) return null;
  const nb={pts, de:L[k].de, tipo:"recuo"};
  const vz=(base.vazios||[]).map(v=>{ const kv=blcLadosNucleo(v, ()=>-d, nuc); return blcOffset(v, kv.size ? j=>kv.has(j)? 0 : -d : -d) }).filter(v=>v && entVazioOk({pts}, v)); if(vz.length) nb.vazios=vz;
  L[k]=nb; Object.defineProperty(nb, "preservados", {value:kO.size, enumerable:false}); return nb;
}
/* apaga o bloco k (a pilha se refaz: o de baixo estica até o próximo); o último bloco apagado devolve a torre à forma automática */
function blcApagaBloco(st, i, k){ const L=((st.blocos.torres||[])[i]||{}).blocos; if(!L || !L[k]) return false; L.splice(k,1); if(L.length && k===0) L[0].de=1; return true }
/* área de p fora de q (q pode ser côncavo: amostragem numa grade fina) */
const blcConvexo = q => { let sg=0; for(let i=0;i<q.length;i++){ const a=q[i], b=q[(i+1)%q.length], c=q[(i+2)%q.length], cr=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]); if(Math.abs(cr)<1e-9) continue; const s=Math.sign(cr); if(sg && s!==sg) return false; sg=s } return true };
function blcAreaFora(p, q){
  if(!p || p.length<3) return 0; if(!q || q.length<3) return G.area(p); if(blcConvexo(q)) return blcFora(p, q);
  const xs=p.map(v=>v[0]), ys=p.map(v=>v[1]), x0=Math.min(...xs), y0=Math.min(...ys), h=Math.max(0.2, Math.sqrt(G.area(p))/90); let n=0;
  for(let x=x0+h/2; x<Math.max(...xs); x+=h) for(let y=y0+h/2; y<Math.max(...ys); y+=h) if(G.pip([x,y],p) && !G.pip([x,y],q)) n++;
  return n*h*h;
}
/* forma automática da torre i (o que o massing calcula sem blocos): planta, faixa máxima (slot) e área */
function blcAutoPlanta(st, i){
  const s2=Object.assign({}, st, {blocos:{modo:"auto", torres:[]}}), m=massing(s2), t=m.T[i]||{};
  return {plate:t.plate||[], slot:(t.slot&&t.slot.length? t.slot : m.torAll)||[], A:t.A||0, torAll:m.torAll};
}
/* "Personalizar esta torre": copia a forma automática atual para um bloco editável (nada muda nos números) */
function blcPersonaliza(st, i){
  const a=blcAutoPlanta(st, i); if(!a.plate.length) return null;
  const B=st.blocos; B.modo="desenhada"; B.torres=B.torres||[];
  while(B.torres.length<=i) B.torres.push({blocos:[]});
  const b={pts:a.plate.map(q=>[q[0],q[1]]), de:1, tipo:"auto"};
  B.torres[i]={blocos:[b]}; return b;
}
/* formatos prontos ------------------------------------------------------------------------------------------------- */
/* moldura da faixa da torre: eixo ao longo do lado mais longo */
function blcMoldura(p){ const ux=G.longestDir(p), vy=[-ux[1],ux[0]], [u0,u1]=G.extent(p,ux), [v0,v1]=G.extent(p,vy); return {ux,vy,W:u1-u0,D:v1-v0,cu:(u0+u1)/2,cv:(v0+v1)/2} }
/* contorno (anti-horário, centrado) de cada formato com largura W, profundidade D e alas de largura a */
function blcGabarito(tipo, W, D, a){
  const w=W/2, d=D/2;
  switch(tipo){
    case "L": return {pts:[[-w,-d],[w,-d],[w,-d+a],[-w+a,-d+a],[-w+a,d],[-w,d]]};
    case "U": return {pts:[[-w,-d],[w,-d],[w,d],[w-a,d],[w-a,-d+a],[-w+a,-d+a],[-w+a,d],[-w,d]]};
    case "T": return {pts:[[-a/2,-d],[a/2,-d],[a/2,d-a],[w,d-a],[w,d],[-w,d],[-w,d-a],[-a/2,d-a]]};
    case "H": return {pts:[[-w,-d],[-w+a,-d],[-w+a,-a/2],[w-a,-a/2],[w-a,-d],[w,-d],[w,d],[w-a,d],[w-a,a/2],[-w+a,a/2],[-w+a,d],[-w,d]]};
    case "patio": return {pts:[[-w,-d],[w,-d],[w,d],[-w,d]], vazio:[[-w+a,-d+a],[w-a,-d+a],[w-a,d-a],[-w+a,d-a]]};
    default: return {pts:[[-w,-d],[w,-d],[w,d],[-w,d]]};
  }
}
/* formato pronto dentro da faixa da torre (slot), com a área líquida 'alvo' (se couber). rot = quartos de volta (0–3).
   ala = largura das alas (L/U/T/H) ou do anel (pátio): planta dupla com corredor central ≈ 2 × 5,5 + 1,6 m */
function blcFormato(tipo, slot, alvo, o={}){
  if(!slot || slot.length<3) return null;
  const F=blcMoldura(slot), rot=(((o.rot|0)%4)+4)%4, a0=o.ala||12.6;
  const toW=(x,y)=>{ const u=F.cu+x, v=F.cv+y; return [F.ux[0]*u+F.vy[0]*v, F.ux[1]*u+F.vy[1]*v] };
  const R=q=>{ let x=q[0], y=q[1]; for(let k=0;k<rot;k++){ const t=x; x=-y; y=t } return toW(x,y) };
  // largura máxima das alas: L/T podem engrossar até quase fechar; U e H mantêm o vão entre as alas; o pátio mantém 8 m de vazio
  const aMax = mn=> tipo==="patio" ? Math.max(5,(mn-8)/2) : tipo==="L"||tipo==="T" ? 0.7*mn : 0.4*mn;
  const make=(s, aa)=>{
    const W=F.W*s, D=F.D*s, mn=Math.min(W,D), Wt=rot%2? D : W, Dt=rot%2? W : D;
    const a = Math.min(aa??a0, aMax(mn)), aP = tipo==="patio" ? Math.max(5, a) : Math.min(a, 0.45*mn);
    const T=blcGabarito(tipo, Wt, Dt, tipo==="patio"? aP : a), pts=G.clipToPoly(T.pts.map(R), slot);
    let vz=T.vazio && pts.length>2 ? T.vazio.map(R) : null; if(vz && !(entVazioOk({pts}, vz) && aP*2<mn-2)) vz=null;
    return {pts, vazios: vz? [vz] : null, A: pts.length>2 ? G.area(pts)-(vz? G.area(vz) : 0) : 0, ala: tipo==="patio"? aP : a};
  };
  let r=make(1);
  if(r.A > alvo+0.5){ let lo=0.02, hi=1; for(let k=0;k<44;k++){ const mid=(lo+hi)/2; if(make(mid).A<alvo) lo=mid; else hi=mid } r=make(hi) }
  else if(r.A < alvo-0.5 && tipo!=="ret"){   // a faixa inteira com alas padrão não dá a área: engrossa as alas (ou afina o anel do pátio)
    const lim=aMax(Math.min(F.W,F.D)), Af=a=>make(1,a).A;
    if(Af(lim)>=alvo){ let lo=Math.min(a0,lim), hi=lim; for(let k=0;k<40;k++){ const mid=(lo+hi)/2; if(Af(mid)<alvo) lo=mid; else hi=mid } r=make(1,hi) }
    else r=make(1,lim);
  }
  const b={pts:r.pts, de:1, tipo, rot}; if(r.vazios) b.vazios=r.vazios;
  return {bloco:b, A:r.A, ala:r.ala, curto: r.A < alvo-1};
}
/* aplica um formato ao bloco k da torre i (padrão: o 1º), com a área atual dele; clicar de novo no mesmo formato gira 90°.
   1º bloco: dentro da faixa automática da torre; blocos de cima: dentro do retângulo envolvente do bloco de baixo */
function blcAplicaFormato(st, i, tipo, k=0){
  const cur=blcBloco(st, i, k), m=massing(st), fx=cur && m.T[i] && (m.T[i].faixas||[]).find(f=>f.bk===k);
  const auto = k>0 && blcBloco(st, i, k-1) ? null : blcAutoPlanta(st, i);
  const alvo=(fx && fx.A) || (m.T[i] && m.T[i].A) || (auto && auto.A) || 0;
  const rot = cur && cur.tipo===tipo ? ((cur.rot|0)+1)%4 : 0;
  let slot;
  if(auto) slot = auto.slot.length ? auto.slot : st.lote.pts;
  else { const F=blcMoldura(blcBloco(st, i, k-1).pts); slot=G.rect(F.ux, F.vy, F.cu-F.W/2, F.cv-F.D/2, F.W, F.D); if(G.sArea(slot)<0) slot.reverse() }
  const r=blcFormato(tipo, slot, alvo, {rot, ala: 2*(+st.estudo.profMin||5.5)+(+st.estudo.corrTipo||1.6)}); if(!r || r.bloco.pts.length<3) return null;
  const B=st.blocos; B.modo="desenhada"; B.torres=B.torres||[]; while(B.torres.length<=i) B.torres.push({blocos:[]});
  const L=B.torres[i].blocos=B.torres[i].blocos||[];
  if(L[k]){ r.bloco.de=k? L[k].de : 1; L[k]=r.bloco } else B.torres[i]={blocos:[r.bloco]};
  return r;
}
/* distância entre dois contornos (0 se encostam ou se sobrepõem) */
function blcDist(a, b){
  if(!a.length || !b.length) return Infinity; if(G.polysOverlap(a,b)) return 0;
  return Math.min(...a.map(q=>entDistBorda(q,b)), ...b.map(q=>entDistBorda(q,a)));
}
/* área de p fora do polígono convexo c */
const blcFora = (p, c) => !p.length || !c || c.length<3 ? 0 : Math.max(0, G.area(p) - G.area(G.clipToPoly(p, c)));
/* fração de um polígono (convexo, ex.: o núcleo) que cai dentro da planta — amostras numa grade 6 × 6; a planta pode ser L, U ou ter pátio */
function blcDentro(p, plate){
  const ux=G.longestDir(p), vy=[-ux[1],ux[0]], [u0,u1]=G.extent(p,ux), [v0,v1]=G.extent(p,vy); let n=0, d=0;
  for(let a=0;a<6;a++) for(let b=0;b<6;b++){ const u=u0+(a+0.5)/6*(u1-u0), v=v0+(b+0.5)/6*(v1-v0), q=[ux[0]*u+vy[0]*v, ux[1]*u+vy[1]*v]; if(!G.pip(q,p)) continue; n++; if(G.pip(q,plate)) d++ }
  return n ? d/n : 1;
}
const blcNome = i => `torre ${i+1}`;
/* resumo do modo desenhado: torres desenhadas, área média, quanto o mix ocupa do pavimento e o "Ajustar mix" */
function blcResumo(st, m){
  if(!m || !m.T) return null;
  const D=m.T.filter(t=>t.desenhada && t.A>1); if(!D.length) return null;
  const P=st.produto, A=D.reduce((s,t)=>s+t.A,0)/D.length, priv=A*P.efic, ocupa = priv>0 ? (m.mixPriv||0)/priv : 0;
  const q=torreAjustaMix(P.mix, priv), muda=q.some((n,j)=>n!==P.mix[j].qtd);
  return {torres:D.map(t=>t.i), A, priv, ocupa, q, muda, desvio: Math.abs(ocupa-1)>0.10};
}
/* avisos de uma torre desenhada (I = medidas usadas pelo desenho da implantação) */
const blcRotulo = f => f.de===f.ate ? `${f.de}º` : `${f.de}º–${f.ate}º`;
function blcTorreAv(st, m, t, I, out, envAt){
    const i=t.i, nm=blcNome(i); let auto=null;
    (t.blcIgn||[]).forEach(g=>out.push(g.motivo==="acima" ? `Na ${nm}, o bloco ${g.k+1} começa no ${g.de}º andar e a torre tem ${t.pav} — ele fica de fora até a torre ter mais pavimentos.`
      : `Na ${nm}, dois blocos começam no ${g.de}º andar — vale só o primeiro.`));
    if(!t.plate.length){ out.push(`A ${nm} desenhada ficou fora do lote — redesenhe a forma ou volte para a automática.`); return }
    if(I.foraLote>0.5) out.push(`A ${nm} passa ${nf(I.foraLote,0)} m² para fora do lote — a planta foi cortada na divisa.`);
    // C2: cada bloco é conferido com o envelope da sua cota (recuos progressivos da 2.4) e com o bloco de baixo (balanço)
    const fx=(t.faixas||[]).filter(f=>f.blc), pilha=fx.length>1, ext=f=>f.oco ? f.oco.pts : f.plate;
    const blocos = pilha ? fx : [{de:1, ate:t.pav, plate:t.plate, oco:t.oco, A:t.A, z1:t.H, af:m.afast, bk:t.blcRef||0, ref:true}];
    I.bl = blocos.map((f,j)=>{ const po=ext(f), env=envAt(pilha? f.z1 : t.H), b={k:f.bk, de:f.de, ate:f.ate, A:f.A, ref:!!f.ref, plate:f.plate, env:env||m.torAll, foraRecuo:0, bal:0, nucleo:true};
      if(po.length>2){ b.foraRecuo=Math.max(blcFora(po, m.torAll), blcFora(po, env));
        if(j>0){ const pb=ext(blocos[j-1]); b.below=pb; b.bal = pb.length>2 ? blcAreaFora(po, pb) : G.area(po) } }
      if(!f.ref && f.nucleo!=null){ b.nucleo = f.nucleo>=0.999; f.nucleoCortado=!b.nucleo }
      return b });
    const plOut = ext(blocos[0]);
    I.foraRecuo = Math.max(...I.bl.map(b=>b.foraRecuo));
    if(!pilha){ if(I.foraRecuo>0.5) out.push(`A ${nm} avança ${nf(I.foraRecuo,0)} m² sobre os recuos (afastamento de ${nf(m.afast,1)} m às divisas).`) }
    else I.bl.forEach((b,j)=>{ if(b.foraRecuo>0.5) out.push(`Na ${nm}, o bloco ${blcRotulo(b)} avança ${nf(b.foraRecuo,0)} m² sobre os recuos (afastamento de ${nf(blocos[j].af||m.afast,1)} m na sua altura).`) });
    I.bl.forEach(b=>{ if(b.bal>0.5) out.push(`Na ${nm}, o bloco ${blcRotulo(b)} avança ${nf(b.bal,0)} m² além do bloco de baixo — balanço ou transição de pilares.`) });
    I.bl.forEach(b=>{ if(!b.nucleo) out.push(`Na ${nm}, o bloco ${blcRotulo(b)} corta o núcleo (escada e elevadores) — o núcleo sobe inteiro até o topo: amplie ou mova o bloco.`) });
    // balanço: só o que a forma desenhada acrescenta além do que a forma automática já tinha fora do embasamento (bloco mais baixo)
    if(m.emb && m.emb.length>2){ I.balanco=blcFora(plOut, m.emb);
      if(I.balanco>0.5){ if(!auto) auto=blcAutoPlanta(st, i).plate; const base=auto && auto.length ? blcFora(auto, m.emb) : 0;
        if(I.balanco>base+1) out.push(`A ${nm} sai ${nf(I.balanco,0)} m² da projeção do embasamento — balanço ou pilares próprios até o chão.`); else I.balanco=0 } }
    const l=m.tipo && m.tipo[i];
    if(l && l.core && l.core.length) I.nucleo = blcDentro(l.core, t.plate) >= 0.7;
    else if(m.tipo) I.nucleo=false;
    if(!I.nucleo) out.push(`Na ${nm}, o núcleo (escada e elevadores) cai fora da planta ou num vão da forma — gire ou ajuste a forma; em L, U, T, H e pátio as alas precisam de largura para o núcleo e o corredor.`);
}
/* avisos e destaques das torres desenhadas: m.blc[k] (por torre desenhada), m.blcPares (torres próximas), m.blcGeral (índices e mix) */
function blcAvisos(st, m){
  const out=[], R=st.regras, info=[];
  const T=m.T||[], D=T.filter(t=>t.desenhada); if(!D.length) return {avisos:out, info, pares:[], geral:[]};
  const envAt = z=>{ if(!m.env || !m.env.length) return null; const e=m.env.find(e=>z<=e.z1+1e-6) || m.env[m.env.length-1]; return e && e.poly };
  D.forEach(t=>{ const I={i:t.i, foraLote:t.blcForaLote||0, foraRecuo:0, balanco:0, nucleo:true, av:[]}, n0=out.length;
    info.push(I); blcTorreAv(st, m, t, I, out, envAt); I.av=out.slice(n0) });
  const n1=out.length, pares=[];
  // distância entre torres (só nos pares com ao menos uma desenhada; as automáticas já respeitam a regra)
  for(let a=0;a<T.length;a++) for(let b=a+1;b<T.length;b++){
    if(!(T[a].desenhada||T[b].desenhada) || !T[a].plate.length || !T[b].plate.length) continue;
    const d=blcDist(T[a].plate, T[b].plate);
    if(d<0.01){ pares.push({a, b, d:0}); out.push(`As torres ${a+1} e ${b+1} se encostam ou se sobrepõem.`) }
    else if(d<m.gap-0.05){ pares.push({a, b, d}); out.push(`As torres ${a+1} e ${b+1} ficam a ${nf(d,1)} m; a regra pede ${nf(m.gap,1)} m entre torres.`) }
  }
  // índices: a forma desenhada não encolhe para caber — os excessos viram aviso
  const tor=T.reduce((s,t)=>s+(t.Aproj||t.A),0), cap=R.toTorre*m.A;   // C2: pela maior projeção de cada torre
  if(tor>cap+1 && !m.torOcupa) out.push(`As torres ocupam ${nf(tor,0)} m², acima da taxa de ocupação (${nf(cap,0)} m²).`);
  if(m.CA>R.caMax+1e-6) out.push(`Com a forma desenhada, o CA fica em ${nf(m.CA,2)} (máximo ${nf(R.caMax,1)}) — reduza pavimentos ou a área da forma.`);
  const hLim=m.hLim??R.hMax; if(m.H>hLim+1e-6) out.push(`A altura de ${nf(m.H,1)} m passa do gabarito (${nf(hLim,1)} m).`);
  const Rs=blcResumo(st, m);
  if(Rs && Rs.desvio) out.push(`O mix ocupa ${nf(Rs.ocupa*100,0)}% do pavimento desenhado: as unidades ficaram ${Rs.ocupa<1?"maiores":"menores"} que o mix. Use “Ajustar mix” em Produto › Forma das torres.`);
  return {avisos:out, info, pares, geral:out.slice(n1)};
}
HOOK.compute.push((m, st)=>{
  if(!blcAtivo(st) || !(m.T||[]).some(t=>t.desenhada)) return;
  const r=blcAvisos(st, m); m.blc=r.info; m.blcPares=r.pares; m.blcGeral=r.geral; if(m.avisos) m.avisos.push(...r.avisos);
});

/* resumo do contorno ocupado: área do andar, privativa que cabe e quanto as unidades mudaram frente ao mix */
function torOcupaResumo(st, m){
  if(!m || !m.torOcupa) return null;
  const P=st.produto, mixPriv=m.mixPriv||0, mixUn=m.mixUn||0;
  const T=(m.T||[]).filter(t=>t.A>1);
  if(!T.length || mixPriv<=0 || mixUn<=0) return {torres:T.length, A:0, priv:0, r:0, media:0, mixMedia:0, q:P.mix.map(u=>u.qtd), muda:false, desiguais:false};
  const A=T.reduce((s,t)=>s+t.A,0)/T.length, r=T.reduce((s,t)=>s+t.r,0)/T.length;
  // o mix é o mesmo em todas as torres: o ajuste mira a planta média
  const q=torreAjustaMix(P.mix, A*P.efic), muda=q.some((n,j)=>n!==P.mix[j].qtd);
  const As=T.map(t=>t.A), desiguais=Math.max(...As) > Math.min(...As)*1.15;
  return {torres:T.length, A, priv:A*P.efic, r, media:mixPriv*r/mixUn, mixMedia:mixPriv/mixUn, q, muda, desiguais, As};
}

/* avisos do contorno ocupado (entram em m.avisos no compute) */
function torOcupaAvisos(st, m){
  const R=torOcupaResumo(st, m); if(!R) return [];
  const out=[], P=st.produto;
  if(!R.torres) return ["O contorno desenhado das torres ficou vazio depois dos recuos — redesenhe o limite das torres."];
  if(Math.abs(R.r-1)>0.10 && R.muda) out.push(`As torres ocupam o contorno desenhado: as unidades ficaram ${R.r>1?"maiores":"menores"} que o mix (${nf(R.media,0)} m² em média, o mix pede ${nf(R.mixMedia,0)} m²). Use “Ajustar mix” em Terreno › Limites especiais.`);
  if(R.desiguais) out.push(`O contorno desenhado deixa as torres com andares de tamanhos diferentes (${R.As.map(a=>nf(a,0)+" m²").join(" e ")}) e o mix é o mesmo em todas: as unidades mudam de tamanho de uma torre para outra. Redesenhe o contorno ou use uma torre.`);
  const tor=(m.T||[]).reduce((s,t)=>s+t.A,0), cap=st.regras.toTorre*m.A;
  if(tor>cap+1) out.push(`O contorno desenhado das torres passa da taxa de ocupação: ${nf(tor,0)} m² de ${nf(cap,0)} m² permitidos.`);
  if(P.torres.length>1 && !m.slotOk) out.push("O contorno desenhado é estreito demais para dividir entre as torres.");
  return out;
}

/* nova quantidade por tipologia para que o mix preencha 'alvo' m² privativos por andar, sem passar dele.
   Mantém a proporção entre as tipologias, cada tipologia usada fica com ≥ 1 unidade e no máximo 'max'. */
function torreAjustaMix(mix, alvo, max=20){
  const tot=mix.reduce((s,u)=>s+u.area*u.qtd,0);
  if(!(tot>0) || !(alvo>0)) return mix.map(u=>u.qtd);
  const f=alvo/tot, usa=mix.map(u=>u.qtd>0 && u.area>0);
  const q=mix.map((u,j)=> usa[j] ? Math.min(max, Math.max(1, Math.floor(u.qtd*f))) : 0);
  let s=mix.reduce((a,u,j)=>a+u.area*q[j],0);
  const prop=j=>q[j]/mix[j].qtd;
  // passou do alvo (por causa do mínimo de 1): tira de quem está mais acima da proporção
  while(s>alvo){ let b=-1; mix.forEach((u,j)=>{ if(usa[j] && q[j]>1 && (b<0 || prop(j)>prop(b))) b=j }); if(b<0) break; q[b]--; s-=mix[b].area }
  // completa enquanto couber: soma em quem está mais atrás da proporção
  for(;;){ let b=-1; mix.forEach((u,j)=>{ if(usa[j] && q[j]<max && s+u.area<=alvo+1e-6 && (b<0 || prop(j)<prop(b))) b=j }); if(b<0) break; q[b]++; s+=mix[b].area }
  return q;
}
