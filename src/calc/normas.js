/* ================= normas automáticas (item 2.5) — PRELIMINAR =================
   Cálculo puro (sem DOM): roda nos testes e no Worker. Só LÊ o modelo — não muda nenhum número do estudo.
   Cada regra é uma função testável que devolve {id, grupo, titulo, status, valor, exigido, porque, fonte:{norma,item}}.
   status: "ok" (atende) · "warn" (atenção) · "bad" (não atende) · "na" (não se aplica).
   IMPORTANTE: as tabelas abaixo são uma leitura preliminar (IN 09 CBMSC, que adota como referência a NBR 9077, e NBR 9050).
   Não são definitivas: conferir com a norma vigente e com o projetista antes de usar — a tela mostra esse aviso. */
const NORMAS_AVISO = "Preliminar — conferir com a norma vigente e com o projetista.";
const NORMAS_TAB = {
  preliminar: true,
  // população e unidades de passagem (saídas de emergência)
  pop: { fonte:{norma:"IN 09 CBMSC (ref. NBR 9077)", item:"tabela de população — A-2: 2 pessoas por dormitório; capacidade da unidade de passagem"},
    porDorm:2, capEscada:45, capAcesso:60, up:0.55, minEscada:1.10, minAcesso:1.10 },
  // tipo de escada pela altura (ocupação A-2, residencial multifamiliar). h = altura descendente (térreo → piso do último pavimento)
  escada: { fonte:{norma:"IN 09 CBMSC (ref. NBR 9077)", item:"tabela de tipos de escada por altura — A-2"},
    faixas:[{hMax:12, tipo:"NE"}, {hMax:30, tipo:"EP"}, {hMax:Infinity, tipo:"PF"}] },
  // distância máxima a percorrer até a escada (edificação de estrutura resistente ao fogo)
  dist: { fonte:{norma:"IN 09 CBMSC (ref. NBR 9077)", item:"tabela de distâncias máximas a percorrer — A-2, estrutura resistente ao fogo"},
    semChuveiros:{unica:30, mais:40}, comChuveiros:{unica:45, mais:55}, medida:"da porta da unidade mais distante até a escada, pelo caminho real (malha de 0,25 m)" },
  elevEmerg: { fonte:{norma:"IN 09 CBMSC (ref. NBR 9077)", item:"elevador de emergência — residencial acima de 80 m"}, hMin:80 },
  pcd:   { fonte:{norma:"Lei 13.146/2015 (LBI)", item:"art. 47 — 2% das vagas, no mínimo 1"}, pct:0.02, min:1 },
  idoso: { fonte:{norma:"Lei 10.741/2003 (Estatuto da Pessoa Idosa)", item:"art. 41 — 5% das vagas"}, pct:0.05, min:1 },
  rota:  { fonte:{norma:"NBR 9050", item:"rota acessível — faixa livre ≥ 1,20 m; rampa ≤ 8,33%"}, largura:1.20, rampaMax:0.0833 },
  corredor: { fonte:{norma:"NBR 9050", item:"corredores de uso comum — 1,20 m até 10 m de extensão; 1,50 m acima"}, curto:1.20, longo:1.50, ext:10 },
  adapt: { fonte:{norma:"Lei 13.146/2015 art. 58 e Decreto 9.451/2018", item:"unidades adaptáveis em edificações multifamiliares novas"} },
};
extendDEF("normas", { chuveiros:false, rotaFuga:false });

/* ---------- regras isoladas (funções puras) ---------- */
const NORMA_ESC_RANK = {NE:0, EP:1, PF:2};
const NORMA_ESC_NOME = {NE:"não enclausurada (NE)", EP:"enclausurada protegida (EP)", PF:"à prova de fumaça (PF)"};
/** dormitórios de uma tipologia: pelo nome ("2 dorm.", "3 suítes", "Studio") ou, sem pista, pela área */
function normaDorms(u){
  const s=String(u&&u.nome||""), m=s.match(/(\d+)\s*(dorm|quarto|su[ií]te)/i);
  if(m) return Math.max(1,+m[1]);
  if(/studio|st[uú]dio|kit|loft|jk/i.test(s)) return 1;
  const a=+u.area||0; return a<45? 1 : a<75? 2 : a<115? 3 : 4;
}
/** população do pavimento tipo (por torre) */
function normaPopulacao(mix){ return (mix||[]).reduce((s,u)=>s+(+u.qtd||0)*normaDorms(u)*NORMAS_TAB.pop.porDorm, 0) }
/** larguras mínimas de escada e de acesso (corredor) para a população do maior pavimento */
function normaLarguras(pop){
  const T=NORMAS_TAB.pop, up=n=>Math.ceil(Math.max(0,pop)/n);
  return { escada:Math.max(T.minEscada, up(T.capEscada)*T.up), acesso:Math.max(T.minAcesso, up(T.capAcesso)*T.up), upEscada:up(T.capEscada), upAcesso:up(T.capAcesso) };
}
/** tipo de escada exigido pela altura descendente h (m) */
function normaEscadaTipo(h){ return NORMAS_TAB.escada.faixas.find(f=>h<=f.hMax+1e-9).tipo }
/** tipo oferecido pelo núcleo do estudo (estudo.escTipo) */
function normaEscadaOferecida(escTipo){ return escTipo==="ep"? "EP" : "PF" }
/** distância máxima permitida (m) */
function normaDistLimite(nEsc, chuveiros){ const t=chuveiros? NORMAS_TAB.dist.comChuveiros : NORMAS_TAB.dist.semChuveiros; return nEsc>=2? t.mais : t.unica }
function normaElevEmergObrig(h){ return h > NORMAS_TAB.elevEmerg.hMin + 1e-9 }
/** vagas especiais exigidas para n vagas */
function normaVagasEsp(n){ const P=NORMAS_TAB.pcd, I=NORMAS_TAB.idoso; return n>0? {pcd:Math.max(P.min, Math.ceil(n*P.pct-1e-9)), idoso:Math.max(I.min, Math.ceil(n*I.pct-1e-9))} : {pcd:0, idoso:0} }
/** largura exigida do corredor de uso comum pela extensão */
function normaCorredorMin(ext){ const C=NORMAS_TAB.corredor; return ext>C.ext? C.longo : C.curto }
/** altura descendente: do térreo (nível de descarga) ao piso do último pavimento */
function normaAltura(st, m){ const pe=st.produto.pe; return Math.max(0, ...(m.T||[]).map(t=>t.H-pe), 0) }

/* ---------- malha (como o rasterCheck da garagem) ---------- */
function nrmBox(p){ let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity; for(const q of p){ if(q[0]<a)a=q[0]; if(q[1]<b)b=q[1]; if(q[0]>c)c=q[0]; if(q[1]>d)d=q[1] } return [a,b,c,d] }
function nrmGrade(bb, cs){ const nx=Math.max(1,Math.ceil((bb[2]-bb[0])/cs)), ny=Math.max(1,Math.ceil((bb[3]-bb[1])/cs)); return {x0:bb[0], y0:bb[1], cs, nx, ny, N:nx*ny} }
function nrmCentro(g,k){ return [g.x0+(k%g.nx+0.5)*g.cs, g.y0+(Math.floor(k/g.nx)+0.5)*g.cs] }
function nrmCelula(g,p){ const i=Math.floor((p[0]-g.x0)/g.cs), j=Math.floor((p[1]-g.y0)/g.cs); return (i<0||j<0||i>=g.nx||j>=g.ny)? -1 : j*g.nx+i }
function nrmPinta(g, arr, poly, v){
  if(!poly || poly.length<3) return; const b=nrmBox(poly);
  const i0=Math.max(0,Math.floor((b[0]-g.x0)/g.cs)), i1=Math.min(g.nx-1,Math.floor((b[2]-g.x0)/g.cs)), j0=Math.max(0,Math.floor((b[1]-g.y0)/g.cs)), j1=Math.min(g.ny-1,Math.floor((b[3]-g.y0)/g.cs));
  for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){ const k=j*g.nx+i; if(G.pip([g.x0+(i+0.5)*g.cs, g.y0+(j+0.5)*g.cs], poly)) arr[k]=v }
}
/** caminho mínimo (8 vizinhos, sem cortar quinas) a partir de várias origens; devolve distâncias em metros e o predecessor */
function nrmDijkstra(g, ok, src){
  const N=g.N, d=new Float64Array(N).fill(Infinity), pr=new Int32Array(N).fill(-1), hk=[], hd=[];
  const push=(k,v)=>{ hk.push(k); hd.push(v); let i=hk.length-1; while(i>0){ const p=(i-1)>>1; if(hd[p]<=hd[i]) break; [hk[p],hk[i]]=[hk[i],hk[p]]; [hd[p],hd[i]]=[hd[i],hd[p]]; i=p } };
  const pop=()=>{ const k=hk[0], v=hd[0], lk=hk.pop(), lv=hd.pop(); if(hk.length){ hk[0]=lk; hd[0]=lv; let i=0; for(;;){ const a=2*i+1, b=a+1; let s=i; if(a<hk.length&&hd[a]<hd[s]) s=a; if(b<hk.length&&hd[b]<hd[s]) s=b; if(s===i) break; [hk[s],hk[i]]=[hk[i],hk[s]]; [hd[s],hd[i]]=[hd[i],hd[s]]; i=s } } return [k,v] };
  src.forEach(k=>{ if(k>=0 && ok[k] && d[k]>0){ d[k]=0; push(k,0) } });
  const cs=g.cs, dg=cs*Math.SQRT2, nx=g.nx;
  while(hk.length){ const [k,v]=pop(); if(v>d[k]) continue; const i=k%nx, j=(k-i)/nx;
    for(let dj=-1;dj<=1;dj++) for(let di=-1;di<=1;di++){ if(!di&&!dj) continue; const ii=i+di, jj=j+dj; if(ii<0||jj<0||ii>=nx||jj>=g.ny) continue; const q=jj*nx+ii; if(!ok[q]) continue;
      if(di&&dj && (!ok[j*nx+ii] || !ok[jj*nx+i])) continue;
      const nv=v+(di&&dj? dg : cs); if(nv<d[q]-1e-9){ d[q]=nv; pr[q]=k; push(q,nv) } } }
  return {d, pr};
}
function nrmCaminho(g, pr, k){ const out=[]; let n=0; while(k>=0 && n++<1e5){ out.push(nrmCentro(g,k)); k=pr[k] } return out }

/** distância a percorrer no pavimento tipo: de cada porta de unidade até a escada, pelo corredor/hall (sem atravessar unidades nem shafts) */
function normaDistTipo(lay, cs=0.25){
  if(!lay || !lay.coreParts || !lay.units) return null;
  const allPts=[...(lay.corridor||[]), ...lay.units.flatMap(u=>u.poly||[]), ...lay.coreParts.flatMap(c=>c.poly||[])]; if(allPts.length<3) return null;
  const bb=nrmBox(allPts); bb[0]-=cs; bb[1]-=cs; bb[2]+=cs; bb[3]+=cs;
  const g=nrmGrade(bb, cs), ok=new Uint8Array(g.N), esc=new Uint8Array(g.N), uid=new Int16Array(g.N).fill(-1);
  nrmPinta(g, ok, lay.corridor, 1);
  lay.coreParts.forEach(c=>{ if(["hall","ant","pass","balc"].includes(c.kind)) nrmPinta(g, ok, c.poly, 1) });
  lay.coreParts.forEach(c=>{ if(c.kind==="esc"){ nrmPinta(g, ok, c.poly, 1); nrmPinta(g, esc, c.poly, 1) } });
  const reais=lay.units.map((u,i)=>({u,i})).filter(x=>!x.u.livre && x.u.poly && x.u.poly.length>2);
  reais.forEach(({u,i})=>{ nrmPinta(g, uid, u.poly, i); });
  for(let k=0;k<g.N;k++) if(uid[k]>=0) ok[k]=0;
  const src=[]; for(let k=0;k<g.N;k++) if(esc[k]&&ok[k]) src.push(k);
  if(!src.length) return {erro:"sem escada no núcleo", max:null, unidades:[]};
  const {d, pr}=nrmDijkstra(g, ok, src);
  // porta de cada unidade: célula livre vizinha da unidade, a mais próxima do centro da unidade
  const res=reais.map(({u,i})=>{ const c=G.centroid(u.poly); let best=-1, bd=Infinity;
    for(let k=0;k<g.N;k++){ if(!ok[k]||esc[k]) continue; const x=k%g.nx, y=(k-x)/g.nx; let viz=false;
      for(let dj=-1;dj<=1&&!viz;dj++) for(let di=-1;di<=1&&!viz;di++){ const ii=x+di, jj=y+dj; if(ii>=0&&jj>=0&&ii<g.nx&&jj<g.ny && uid[jj*g.nx+ii]===i) viz=true }
      if(!viz) continue; const p=nrmCentro(g,k), e=Math.hypot(p[0]-c[0],p[1]-c[1]); if(e<bd){ bd=e; best=k } }
    return {i, nome:u.nome, porta: best>=0? nrmCentro(g,best) : null, dist: best>=0 && isFinite(d[best])? d[best] : null, k:best} });
  const alc=res.filter(r=>r.dist!=null), pior=alc.reduce((a,r)=>!a||r.dist>a.dist? r : a, null);
  let corr=0; for(let k=0;k<g.N;k++) if(ok[k] && isFinite(d[k]) && d[k]>corr) corr=d[k];
  return { max: pior? pior.dist : null, pior, unidades:res, semAcesso:res.filter(r=>r.dist==null).map(r=>r.nome), maxCorredor:corr,
    caminho: pior? nrmCaminho(g, pr, pior.k) : [], cs };
}
/** rota acessível no térreo: do acesso de pedestres até o hall de cada núcleo (elevadores), com faixa livre ≈ 1,20 m */
function normaRotaTerreo(st, m, cs=0.2){
  const L=st.lote.pts, T=m.ter||{}; if(!L || L.length<3 || !m.acesso) return null;
  const lobbies=(m.coreSets||[]).map(c=>({i:c.i, poly:c.lobby})).filter(x=>x.poly && x.poly.length>2);
  if(!lobbies.length) return null;
  const bb=nrmBox(L), g=nrmGrade(bb, cs), N=g.N;
  const lote=new Uint8Array(N), emb=new Uint8Array(N), hall=new Uint8Array(N), bloq=new Uint8Array(N);
  nrmPinta(g, lote, L, 1); nrmPinta(g, emb, m.emb, 1);
  (T.hall||[]).forEach(p=>nrmPinta(g, hall, p, 1)); lobbies.forEach(x=>nrmPinta(g, hall, x.poly, 1));
  (m.cores||[]).forEach(p=>nrmPinta(g, bloq, p, 1));
  const walk=new Uint8Array(N); for(let k=0;k<N;k++) walk[k]= lote[k] && (!emb[k] || hall[k]) && !bloq[k] ? 1 : 0;
  // faixa livre: o centro precisa ter folga de ~0,6 m (meia largura) em todas as direções
  const r=NORMAS_TAB.rota.largura/2 - cs/2, R=Math.ceil(r/cs), offs=[]; for(let dj=-R;dj<=R;dj++) for(let di=-R;di<=R;di++) if((di*di+dj*dj)*cs*cs<=r*r+1e-9) offs.push([di,dj]);
  const larga=new Uint8Array(N);
  for(let k=0;k<N;k++){ if(!walk[k]) continue; const i=k%g.nx, j=(k-i)/g.nx; let ok=1;
    for(const [di,dj] of offs){ const ii=i+di, jj=j+dj; if(ii<0||jj<0||ii>=g.nx||jj>=g.ny||!walk[jj*g.nx+ii]){ ok=0; break } } larga[k]=ok }
  const inicio=okArr=>{ const p=m.acesso.ped; let best=-1, bd=Infinity; for(let k=0;k<N;k++){ if(!okArr[k]) continue; const c=nrmCentro(g,k), e=Math.hypot(c[0]-p[0],c[1]-p[1]); if(e<bd){ bd=e; best=k } } return bd<=4? best : -1 };
  const avalia=okArr=>{ const s=inicio(okArr); if(s<0) return {inicio:false, torres:lobbies.map(x=>({i:x.i, dist:null}))};
    const {d, pr}=nrmDijkstra(g, okArr, [s]);
    return {inicio:true, torres:lobbies.map(x=>{ const lb=new Uint8Array(N); nrmPinta(g, lb, x.poly, 1); let best=-1;
      for(let k=0;k<N;k++) if(lb[k] && okArr[k] && isFinite(d[k]) && (best<0 || d[k]<d[best])) best=k;
      return {i:x.i, dist: best>=0? d[best] : null, caminho: best>=0? nrmCaminho(g, pr, best) : []} })} };
  const A=avalia(larga), ok=A.inicio && A.torres.every(t=>t.dist!=null);
  const B= ok? null : avalia(walk);
  return { ok, estreito: !ok && !!B && B.inicio && B.torres.every(t=>t.dist!=null), torres:A.torres, desnivel:+st.lote.desnivel||0, cs };
}

/* ---------- avaliação completa ---------- */
const NORMAS_GRUPOS = ["Bombeiros", "Acessibilidade"];
function normaItem(id, grupo, titulo, status, valor, exigido, porque, fonte){ return {id, grupo, titulo, status, valor, exigido, porque, fonte, preliminar:true} }
const nrmF=(v,d=1)=>(isFinite(v)?v:0).toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d});
let _normasCache=null;
/** checklist completo do estudo. Só lê st e m. */
function normasAvaliar(st, m){
  if(!m || !m.T) return {itens:[], h:0, pop:0, dists:[], rota:null};
  const E=st.estudo, P=st.produto, NR=st.normas||{}, out=[], TB=NORMAS_TAB;
  const sig=JSON.stringify([m.T.map(t=>[t.H,t.pav]), (m.tipo||[]).map(l=>l&&[l.corridor,l.units.map(u=>u.poly),l.coreParts.map(c=>[c.kind,c.poly])]), m.emb, (m.ter||{}).hall, m.cores, m.acesso,
    st.lote.desnivel, P.mix.map(u=>[u.nome,u.area,u.qtd]), P.pe, E.escTipo, E.nEsc, E.emerg, E.corrTipo, E.elevadores, NR.chuveiros, m.vagas, m.gar && Object.values(m.gar).map(l=>l? l.vagas.map(v=>v.tipo).join("") : "")]);
  if(_normasCache && _normasCache.sig===sig) return _normasCache.v;
  const h=normaAltura(st, m), hTxt=nrmF(h,1)+" m";
  // 1. população e larguras
  const pop=normaPopulacao(P.mix), lg=normaLarguras(pop);
  // lance da escada: metade da menor dimensão da caixa (dois lances lado a lado), menos a parede central
  const lances=(m.tipo||[]).flatMap(l=>l? l.coreParts.filter(c=>c.kind==="esc").map(c=>{ const [a,b]=G.extent(c.poly,l.ux), [p,q]=G.extent(c.poly,l.vy); return Math.min(b-a,q-p)/2-0.05 }) : []);
  const lance = lances.length? Math.min(...lances) : null;
  const okLarg = lance==null? "warn" : (lance>=lg.escada-1e-6 && E.corrTipo>=lg.acesso-1e-6)? "ok" : "bad";
  out.push(normaItem("larguras","Bombeiros","População e larguras mínimas", okLarg,
    `${pop} pessoas/andar · escada ≈ ${lance==null?"—":nrmF(lance,2)+" m"} · corredor ${nrmF(E.corrTipo,2)} m`,
    `escada ≥ ${nrmF(lg.escada,2)} m (${lg.upEscada} UP) · acesso ≥ ${nrmF(lg.acesso,2)} m`,
    `População pelo número de dormitórios do mix (${TB.pop.porDorm} por dormitório). Largura = unidades de passagem de ${nrmF(TB.pop.up,2)} m (escada: ${TB.pop.capEscada} pessoas/UP; acesso: ${TB.pop.capAcesso}), com mínimo de ${nrmF(TB.pop.minEscada,2)} m. Lance da escada estimado pela profundidade do núcleo.`, TB.pop.fonte));
  // 2. tipo de escada pela altura
  const req=normaEscadaTipo(h), of=normaEscadaOferecida(E.escTipo), okT=NORMA_ESC_RANK[of]>=NORMA_ESC_RANK[req];
  out.push(normaItem("escadaTipo","Bombeiros","Tipo de escada pela altura", okT?"ok":"bad",
    `${NORMA_ESC_NOME[of]} · h = ${hTxt}`, NORMA_ESC_NOME[req],
    `Altura descendente (térreo até o piso do último pavimento) de ${hTxt}. ${okT? "O núcleo do estudo atende." : "Troque o tipo de escada em Projeto › Pavimento tipo."}`, TB.escada.fonte));
  // 3. distância a percorrer (pelo caminho real no pavimento tipo) e nº de escadas
  const dists=(m.tipo||[]).map((l,i)=>({i, r:normaDistTipo(l)})).filter(x=>x.r && x.r.max!=null);
  const lim=normaDistLimite(E.nEsc||1, NR.chuveiros), limMais=normaDistLimite(2, NR.chuveiros), dmax=dists.length? Math.max(...dists.map(x=>x.r.max)) : null;
  const semAc=dists.flatMap(x=>x.r.semAcesso);
  const stD = dmax==null? "warn" : dmax>lim+1e-6? "bad" : (semAc.length || dmax>0.9*lim)? "warn" : "ok";
  const piorT = dists.length? dists.reduce((a,x)=>x.r.max>a.r.max? x : a) : null;
  out.push(normaItem("distancia","Bombeiros","Distância máxima a percorrer", stD,
    dmax==null? "não medida" : `${nrmF(dmax,1)} m${piorT&&m.T.length>1?` (torre ${piorT.i+1})`:""}`, `≤ ${nrmF(lim,0)} m (${(E.nEsc||1)>=2?"mais de uma saída":"saída única"}${NR.chuveiros?", com chuveiros":", sem chuveiros"})`,
    dmax==null? "Não foi possível medir o caminho no pavimento tipo (sem núcleo ou sem corredor)." :
    `Medida ${TB.dist.medida}${piorT&&piorT.r.pior? `; a mais distante é a unidade “${piorT.r.pior.nome}”`:""}.${semAc.length?` Sem ligação ao corredor: ${semAc.join(", ")}.`:""}${stD==="warn"&&!semAc.length?" Perto do limite.":""}`, TB.dist.fonte));
  const nReq = dmax!=null && dmax>normaDistLimite(1,NR.chuveiros)+1e-6 ? 2 : 1, nOf=E.nEsc||1;
  out.push(normaItem("escadas","Bombeiros","Número de escadas", nOf>=nReq? "ok" : "bad",
    `${nOf} escada${nOf>1?"s":""} por núcleo`, `${nReq}${nReq>1?" (a distância passa do limite de saída única)":""}`,
    nReq>1? (dmax<=limMais? "A distância a percorrer pede uma segunda escada (ou chuveiros automáticos)." : "Mesmo com duas escadas a distância passa do limite: aproxime o núcleo das unidades.") :
    "Uma escada basta pela tabela de altura e pela distância a percorrer. Com duas escadas, confira a separação mínima entre elas.", TB.escada.fonte));
  // 4. elevador de emergência
  const obr=normaElevEmergObrig(h);
  out.push(normaItem("elevEmerg","Bombeiros","Elevador de emergência", obr? (E.emerg?"ok":"bad") : "ok",
    E.emerg? "previsto no núcleo" : "não previsto", obr? `obrigatório (h > ${TB.elevEmerg.hMin} m)` : `não obrigatório até ${TB.elevEmerg.hMin} m`,
    obr && !E.emerg? "Ligue o elevador de emergência em Projeto › Pavimento tipo." : `Altura descendente de ${hTxt}.`, TB.elevEmerg.fonte));
  // 5. vagas PCD e idoso
  let nV=0, nP=0, nI=0, deLay=false;
  if(m.gar){ deLay=true; Object.values(m.gar).forEach(l=>{ if(!l||!l.vagas) return; l.vagas.forEach(v=>{ if(v.tipo==="off"||v.tipo==="faixa") return; nV++; if(v.tipo==="pcd") nP++; else if(v.tipo==="idoso") nI++ }) }) }
  else { nV=m.vagas||0; nP=nV&&E.pcd>0? Math.max(1,Math.round(nV*E.pcd)) : 0; nI=nV&&E.idoso>0? Math.max(1,Math.round(nV*E.idoso)) : 0 }
  const ve=normaVagasEsp(nV), okV=nP>=ve.pcd && nI>=ve.idoso;
  out.push(normaItem("vagasEsp","Acessibilidade","Vagas PCD e idoso", nV? (okV?"ok":"warn") : "na",
    `${nP} PCD · ${nI} idoso (de ${nV}${deLay?" no layout":" estimadas"})`, `${ve.pcd} PCD (2%) · ${ve.idoso} idoso (5%)`,
    (okV? "" : "Aumente os percentuais em Regras › Padrões do projeto. ") + "A LBI e o Estatuto tratam de estacionamentos de uso coletivo; em garagem privativa de condomínio a exigência depende do município.", {norma:TB.pcd.fonte.norma+" · "+TB.idoso.fonte.norma, item:TB.pcd.fonte.item+" · "+TB.idoso.fonte.item}));
  // 6. rota acessível no térreo
  const rt=normaRotaTerreo(st, m), des=Math.abs(+st.lote.desnivel||0);
  let stR="warn", vR="não avaliada", pR="Sem núcleos no térreo para avaliar.";
  if(rt){ const ds=rt.torres.filter(t=>t.dist!=null).map(t=>t.dist);
    if(rt.ok){ stR= des>0.015? "warn" : "ok"; vR=`até ${nrmF(Math.max(...ds),0)} m do acesso ao hall dos elevadores`; pR=`Caminho com faixa livre ≈ ${nrmF(TB.rota.largura,2)} m (malha de ${nrmF(rt.cs,2)} m) do acesso de pedestres ao hall de ${rt.torres.length>1?"cada núcleo":"elevadores"}.` }
    else if(rt.estreito){ stR="bad"; vR="passagem estreita"; pR=`Há caminho, mas com trecho de menos de ${nrmF(TB.rota.largura,2)} m livres. Alargue o hall ou mude o acesso de pedestres.` }
    else { stR="bad"; vR="sem caminho"; pR="Não há caminho de pedestres do acesso até o hall dos elevadores: mude o acesso de pedestres (Terreno) ou a posição do núcleo." }
    if(des>0.015) pR+=` Desnível de ${nrmF(des,2)} m: precisa de rampa ≤ ${nrmF(TB.rota.rampaMax*100,2)}% (≥ ${nrmF(des/TB.rota.rampaMax,1)} m de comprimento) ou plataforma.` }
  out.push(normaItem("rota","Acessibilidade","Rota acessível ao hall e aos elevadores", stR, vR, `faixa ≥ ${nrmF(TB.rota.largura,2)} m · rampa ≤ ${nrmF(TB.rota.rampaMax*100,2)}%`, pR, TB.rota.fonte));
  // 7. corredor de uso comum
  const ext=Math.max(0, ...(m.tipo||[]).filter(l=>l&&l.corridor&&l.corridor.length>2).map(l=>{ const [a,b]=G.extent(l.corridor,l.ux); return b-a })), cmin=normaCorredorMin(ext);
  out.push(normaItem("corredor","Acessibilidade","Corredor de uso comum", E.corrTipo>=cmin-1e-6? "ok" : "bad",
    `${nrmF(E.corrTipo,2)} m · extensão ${nrmF(ext,1)} m`, `≥ ${nrmF(cmin,2)} m`, "Largura do corredor do pavimento tipo (Regras › Padrões do projeto).", TB.corredor.fonte));
  // 8. unidades adaptáveis
  const nElev=(m.tipo||[]).map(l=>l? l.coreParts.filter(c=>c.kind==="elev").length : 0), semElev=nElev.some(n=>n<1);
  const stA = semElev || E.corrTipo<TB.corredor.curto || stR==="bad"? "bad" : "warn";
  out.push(normaItem("adapt","Acessibilidade","Unidades adaptáveis", stA, semElev? "torre sem elevador" : `${m.units} unidades`, "todas adaptáveis",
    stA==="bad"? "As áreas comuns ainda não dão acesso a todas as unidades (elevador, corredor ou rota do térreo)." :
    "As áreas comuns dão acesso às unidades. O Gabarito ainda não desenha o interior das unidades: confira banheiro, portas e circulação internas com o projetista.", TB.adapt.fonte));
  const v={itens:out, h, pop, dists, rota:rt};
  _normasCache={sig, v};
  return v;
}
function normasResumo(itens){ const c={ok:0,warn:0,bad:0,na:0}; (itens||[]).forEach(x=>c[x.status]=(c[x.status]||0)+1); return c }
