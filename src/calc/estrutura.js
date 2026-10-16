/* ================= 2.2 malha estrutural coordenada =================
   Pilares da torre nas paredes entre unidades e no núcleo (vértices das unidades e do núcleo, com pontos
   intermediários quando o vão passa de 'vaoMax'). Cada pilar desce pelos pavimentos de garagem (m.gar[k]):
   se cair em vaga, rampa, acesso de veículos ou na faixa por onde o carro passa (malha de 0,5 m da garagem),
   a malha "casada" procura um ajuste de até 'tol' metros que o leve para entre as vagas (módulo da garagem:
   N vagas + pilar); se não houver, o pilar nasce numa viga de transição (custo por viga, alerta).
   estruturaMalhas(st, m) compara 2–3 malhas (módulo atual casado, sem coordenação, módulo alternativo).
   Nada aqui toca DOM: roda nos testes e no Worker. */
extendDEF("estrutura", { on: false, malha: "casada", tol: 0.6, vaoMax: 8.5, custo: true, custoM: 4500 });

/* cota da laje de cima / de baixo de um pavimento de garagem */
function estrZTop(st, k){ const P=st.produto, n=+k.slice(1)||0; return k==="ter"? P.peTerreo : k[0]==="s"? -(n-1)*P.peGar : P.peTerreo+n*P.peGar }
function estrZBot(st, k){ const P=st.produto, n=+k.slice(1)||0; return k==="ter"? 0 : k[0]==="s"? -n*P.peGar : P.peTerreo+(n-1)*P.peGar }
const estrBox = p=>{ let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity; for(const q of p){ if(q[0]<x0)x0=q[0]; if(q[0]>x1)x1=q[0]; if(q[1]<y0)y0=q[1]; if(q[1]>y1)y1=q[1] } return [x0,y0,x1,y1] };
const estrBoxHit = (a,b)=> a[0]<b[2] && a[2]>b[0] && a[1]<b[3] && a[3]>b[1];

/* pavimentos de garagem com o que um pilar não pode ocupar */
function estrPisos(st, m){
  const out=[], V=(m.vert&&m.vert.floors)||{}, T=m.ter||{};
  const pack=l=>l.filter(p=>p&&p.length>2).map(p=>({p, b:estrBox(p)}));
  Object.entries(m.gar||{}).forEach(([k,lay])=>{ if(!lay) return; const f=V[k]||{};
    const poly = k==="ter"? (T.gar||[]) : k[0]==="s"? m.sub : m.emb;
    out.push({k, poly, box: poly.length? estrBox(poly) : null, z:estrZTop(st,k),
      vagas: pack(lay.vagas.filter(v=>v.tipo!=="off").map(v=>v.poly)),
      ramps: pack([...(f.ramps||[]).map(r=>r.poly), ...(f.landings||[])]),
      pil: (lay.pillars||[]).map(p=>G.centroid(p)), grid: lay.grid||null, reach: lay.reach||null, extra: [],
      obst: k==="ter"? null : m.obstGar||null }) });   // subsolos/elevadas: a faixa atrás do núcleo é piso de garagem (src/garagem.js)
  // térreo: o acesso de veículos e a passagem de pedestres também não recebem pilar
  const ex=pack([...(T.drive||[]), ...(T.walk||[])]);
  if(ex.length){ let t=out.find(o=>o.k==="ter"); if(!t){ t={k:"ter", poly:[], box:null, z:estrZTop(st,"ter"), vagas:[], ramps:pack(((V.ter||{}).ramps||[]).map(r=>r.poly)), pil:[], grid:null, reach:null, extra:[]}; out.push(t) } t.extra=ex }
  return out.sort((a,b)=>b.z-a.z);
}
/* o pilar (quadrado q, centro c, meio-lado h) conflita com o pavimento? devolve o motivo ou null */
function estrConflito(pi, q, c, h, obst){
  const b=estrBox(q);
  for(const e of pi.extra) if(estrBoxHit(b,e.b) && G.polysOverlap(q,e.p)) return "acesso";
  if(!pi.box || !estrBoxHit(b,pi.box) || !(G.pip(c,pi.poly) || G.polysOverlap(q,pi.poly))) return null;
  if((pi.obst||obst).some(o=>G.pip(c,o))) return null; // núcleo / hall dos elevadores: estrutura própria
  for(const v of pi.vagas) if(estrBoxHit(b,v.b) && G.polysOverlap(q,v.p)) return "vaga";
  for(const r of pi.ramps) if(estrBoxHit(b,r.b) && G.polysOverlap(q,r.p)) return "rampa";
  const g=pi.grid, R=pi.reach;
  if(g && R){ const rad=(typeof CAR_R!=="undefined"? CAR_R : 1.2)+h-0.1, i0=Math.floor((c[0]-rad-g.x0)/g.res), i1=Math.ceil((c[0]+rad-g.x0)/g.res), j0=Math.floor((c[1]-rad-g.y0)/g.res), j1=Math.ceil((c[1]+rad-g.y0)/g.res);
    for(let j=Math.max(0,j0); j<=Math.min(g.ny-1,j1); j++) for(let i=Math.max(0,i0); i<=Math.min(g.nx-1,i1); i++){
      if(R[j*g.nx+i]<0) continue; const x=g.x0+i*g.res, y=g.y0+j*g.res; if(Math.hypot(x-c[0],y-c[1])<rad) return "circulação" } }
  return null;
}
/* pontos de pilar da torre: vértices das unidades e do núcleo (paredes), com pontos intermediários nos vãos longos */
function estrPontosTorre(t, lay, sec, vaoMax){
  const pts=[], add=p=>{ if(!pts.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<0.9)) pts.push(p) };
  [lay.core, ...lay.units.map(u=>u.poly)].filter(p=>p&&p.length>2).forEach(p=>p.forEach((a,i)=>{ const b=p[(i+1)%p.length], L=Math.hypot(b[0]-a[0],b[1]-a[1]), n=Math.ceil(L/vaoMax-1e-6);
    add(a); for(let k=1;k<n;k++) add([a[0]+(b[0]-a[0])*k/n, a[1]+(b[1]-a[1])*k/n]) }));
  const ux=lay.ux, vy=lay.vy, h=sec/2, sq=c=>{ const u=G.dot(c,ux), v=G.dot(c,vy); return G.rect(ux,vy,u-h,v-h,sec,sec) };
  const inside=c=>sq(c).every(q=>G.pip(q,t.plate));
  // pilares do núcleo ficam dentro das paredes dele (o núcleo é compacto: o fundo não chega à fachada e, nas garagens, o pilar
  // centrado no canto ficaria meio dentro da vaga de trás)
  if(lay.core && lay.core.length>2){ const [ku0,ku1]=G.extent(lay.core,ux), [kv0,kv1]=G.extent(lay.core,vy), cl=(x,a,b)=>Math.min(Math.max(x,a),b);
    pts.forEach((p,i)=>{ const u=G.dot(p,ux), v=G.dot(p,vy); if(u<ku0-0.01||u>ku1+0.01||v<kv0-0.01||v>kv1+0.01) return; const uu=cl(u,ku0+h,ku1-h), vv=cl(v,kv0+h,kv1-h);
      pts[i]=[ux[0]*uu+vy[0]*vv, ux[1]*uu+vy[1]*vv] }) }
  const out=[];
  pts.forEach(p=>{ if(inside(p)){ out.push(p); return }
    let best=null; busca: for(const s of [h, sec, 1.5*sec]) for(const [a,b] of [[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]]){ const c=[p[0]+(ux[0]*a+vy[0]*b)*s, p[1]+(ux[1]*a+vy[1]*b)*s]; if(inside(c)){ best=c; break busca } }
    if(best && !out.some(q=>Math.hypot(q[0]-best[0],q[1]-best[1])<0.9)) out.push(best) });
  return out;
}
let _estrOffs=null;
function estrOffsets(tol){ if(_estrOffs && _estrOffs.tol===tol) return _estrOffs.l; const l=[], n=Math.round(tol/0.1);
  for(let a=-n;a<=n;a++) for(let b=-n;b<=n;b++) if(a||b) l.push([a*0.1,b*0.1]); l.sort((p,q)=>Math.hypot(...p)-Math.hypot(...q)); _estrOffs={tol,l}; return l }
const _estrCache=new Map();
/* malha da estrutura para o modelo atual. o = {malha:"casada"|"paredes"} */
function estrCalc(st, m, o={}){
  const ES=st.estrutura||DEF.estrutura, E=st.estudo, P=st.produto, malha=o.malha||ES.malha||"casada";
  const sec=Math.max(0.3, +E.pilar||0.4), h=sec/2, tol=malha==="casada"? Math.max(0, Math.min(2, +ES.tol||0)) : 0, vaoMax=Math.max(3, +ES.vaoMax||8.5);
  const pisos=estrPisos(st, m), obst=m.obst||[];
  const r2=v=>Math.round(v*100)/100, sig=JSON.stringify([malha, tol, vaoMax, sec, +ES.custoM||0, m.T.map(t=>[t.pav, t.plate.map(q=>q.map(r2))]), (m.tipo||[]).map(l=>l? [l.core, ...l.units.map(u=>u.poly)].map(p=>(p||[]).map(q=>q.map(r2))) : 0),
    pisos.map(p=>[p.k, p.z, p.vagas.length, p.vagas.reduce((s,v)=>s+v.b[0]+v.b[1]*7,0).toFixed(2), p.ramps.length, p.extra.length, p.pil.length, p.grid? [p.grid.x0,p.grid.y0,p.grid.nx,p.grid.ny] : 0]), obst.length]);
  if(_estrCache.has(sig)) return _estrCache.get(sig);
  const torres=[];
  m.T.forEach((t,i)=>{ const lay=m.tipo&&m.tipo[i]; if(!lay || !t.plate.length){ torres.push({i, pts:[]}); return }
    const ux=lay.ux, vy=lay.vy, sq=c=>{ const u=G.dot(c,ux), v=G.dot(c,vy); return G.rect(ux,vy,u-h,v-h,sec,sec) }, inP=c=>sq(c).every(q=>G.pip(q,t.plate));
    const sh=c=>G.scaleToArea(sq(c), (sec-0.01)*(sec-0.01)); // 5 mm de folga: encostar na vaga não é conflito
    const test=c=>{ const q=sh(c), conf=[]; for(const pi of pisos){ const w=estrConflito(pi,q,c,h,obst); if(w) conf.push({k:pi.k, motivo:w}) } return conf };
    const corr=lay.corridor&&lay.corridor.length>2? lay.corridor : null;
    const pts=estrPontosTorre(t, lay, sec, vaoMax).map(c0=>{
      let conf=test(c0), c=c0, d=0;
      if(conf.length && tol>0){ for(const [du,dv] of estrOffsets(tol)){ const c1=[c0[0]+ux[0]*du+vy[0]*dv, c0[1]+ux[1]*du+vy[1]*dv];
        if(!inP(c1) || (corr && G.pip(c1,corr) && !G.pip(c0,corr))) continue; if(!test(c1).length){ c=c1; d=Math.hypot(du,dv); conf=[]; break } } }
      const p={c, poly:sq(c), st: conf.length? "transicao" : "direto", d:+d.toFixed(2), conf};
      if(conf.length){ const top=pisos.find(pi=>conf.some(x=>x.k===pi.k)); p.kT=top.k; p.zT=top.z }
      return p });
    torres.push({i, pts}) });
  // vigas de transição: vão até o apoio mais próximo no pavimento onde o pilar para (pilares da garagem ou pilares contínuos)
  const diretos=torres.flatMap(t=>t.pts.filter(p=>p.st==="direto").map(p=>p.c));
  let custo=0, nT=0, nD=0, nP=0;
  torres.forEach(tw=>{ const t=m.T[tw.i]; tw.pts.forEach(p=>{ nP++; if(p.d>0.05) nD++; if(p.st!=="transicao") return; nT++;
    const pi=pisos.find(x=>x.k===p.kT), sup=[...(pi? pi.pil : []), ...diretos];
    let dmin=vaoMax; sup.forEach(s=>{ const d=Math.hypot(s[0]-p.c[0],s[1]-p.c[1]); if(d>0.05 && d<dmin){ dmin=d; p.ap=s } });
    p.vao=+Math.min(16, Math.max(3, 2*dmin)).toFixed(2);
    p.custo=p.vao*(+ES.custoM||0)*(0.5+t.pav/20); custo+=p.custo }) });
  const res={on:true, malha, sec, tol, nPil:nP, nTrans:nT, nDesloc:nD, custo, torres,
    motivos: torres.flatMap(t=>t.pts).filter(p=>p.st==="transicao").reduce((a,p)=>{ const w=p.conf.find(x=>x.k===p.kT); const k=w? w.motivo : "?"; a[k]=(a[k]||0)+1; return a },{}),
    pisos: pisos.map(p=>({k:p.k, z:p.z, zb:estrZBot(st,p.k)}))};
  if(_estrCache.size>30) _estrCache.clear(); _estrCache.set(sig, res);
  return res;
}
/* 2 ou 3 malhas candidatas, com nº e custo das transições. opt.alt=false pula o módulo alternativo (refaz a garagem: mais lento) */
function estruturaMalhas(st, m, opt={}){
  if(!m || !m.gar || !m.tipo) return [];
  const E=st.estudo, nM=Math.max(1,Math.round(E.porModulo)), pitch=x=>x*E.vagaL+(+E.pilar||0), cnt=g=>Object.values(g||{}).reduce((s,l)=>s+(l? l.count:0),0)+(m.vf? m.vf.count:0);
  const res=(id, nome, porModulo, malha, r, vagas)=>({id, nome, porModulo, malha, passo:+pitch(porModulo).toFixed(2), nPil:r.nPil, nTrans:r.nTrans, nDesloc:r.nDesloc, custo:r.custo, vagas, motivos:r.motivos});
  const out=[ res("casada", `Módulo de ${nM} vagas (${nf(pitch(nM),1)} m), casada com a torre`, nM, "casada", estrCalc(st,m,{malha:"casada"}), cnt(m.gar)),
              res("paredes", "Pilares só nas paredes, sem coordenação", nM, "paredes", estrCalc(st,m,{malha:"paredes"}), cnt(m.gar)) ];
  if(opt.alt!==false && typeof garagens==="function"){
    const alt = nM===3? 2 : 3, st2=clone(st); st2.estudo.porModulo=alt; st2.estrutura=st.estrutura||DEF.estrutura;
    // garagem refeita no modo rápido (a completa com outro módulo leva muito mais); as vagas saem pela diferença entre os dois modos rápidos
    const q=opt.full!==true, gar=garagens(st2, m, {quick:q}), m2={...m, gar}, base= q? cnt(garagens(st, m, {quick:true})) : cnt(m.gar);
    out.push(res("mod"+alt, `Módulo de ${alt} vagas (${nf(pitch(alt),1)} m), casada com a torre`, alt, "casada", estrCalc(st2,m2,{malha:"casada"}), cnt(m.gar)+cnt(gar)-base));
  }
  return out;
}
HOOK.compute.push((m, st, opt)=>{
  const ES=st.estrutura; if(!ES || !ES.on || (opt&&opt.quick) || !m.gar || !m.tipo) return;
  const r=estrCalc(st, m, {malha:ES.malha}); m.estr=r;
  if(ES.custo && r.custo>0) (m.custosExtra=m.custosExtra||[]).push({k:"estr-transicao", nome:`Vigas de transição (${r.nTrans})`, sistema:"estrutura", valor:r.custo});
  if(r.nTrans && m.avisos) m.avisos.push(`Estrutura: ${r.nTrans} pilar${r.nTrans>1?"es":""} da torre ${r.nTrans>1?"caem":"cai"} em ${Object.keys(r.motivos).join(", ")} na garagem e ${r.nTrans>1?"nascem":"nasce"} em viga de transição (${mi(r.custo)}). Compare as malhas em Projeto.`);
});
