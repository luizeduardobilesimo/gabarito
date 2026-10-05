/* ================= 1.2 unidades por dentro: cômodos =================
   Biblioteca de modelos paramétricos por tipologia (studio, 1 dorm., 1 suíte, 2 dorm., 2 dorm. c/ suíte, 3 dorm. c/ suíte).
   Algoritmo (por unidade do pavimento tipo, no referencial "a" ao longo da fachada × "d" da fachada para dentro):
     1. faixas: fachada (sala, dormitórios, suíte — precisam de janela) · miolo (circulação íntima, 1 m) · molhada (cozinha,
        serviço, banheiros — junto do corredor, onde descem os shafts da unidade);
     2. cortes perpendiculares à fachada com as áreas-alvo (G.cutAt, como no tipoLayout) e larguras mínimas;
     3. variações: fachada principal ou lateral (unidades de ponta) × zona social numa ponta ou na outra × 3 profundidades
        da faixa molhada; escolhe pela pontuação (alertas do código de obras + adjacências + desvio das áreas-alvo).
   Validação: área e dimensão mínimas por cômodo (tabela S.comodos.min, referência genérica), iluminação ≥ 1/n da área
   do piso nos cômodos de permanência prolongada, acesso de todos os cômodos a partir da entrada.
   Edição manual: S.comodos.tipos[{nome, modelo, cortes:{f1…, w1…, ws, dF, dW}}] (frações a partir da ponta social; vale
   para todas as unidades da tipologia). Variações salvas: S.comodos.variantes[{tipo, nome, modelo, cortes}].
   Saída: u.com em cada unidade de m.tipo[i].units e o resumo m.comodos. Não muda áreas vendáveis (é desenho). */
extendDEF("comodos", {
  on: true,          // cômodos visíveis na planta tipo e nos andares
  movel: true,       // camada de mobiliário
  // mínimos de referência (área m², menor dimensão m) — conferir no código de obras do município
  min: { sala:{a:10,l:2.6}, suite:{a:9,l:2.5}, dorm:{a:7,l:2.3}, cozinha:{a:4,l:1.5}, serv:{a:1.8,l:1.0}, banho:{a:2.2,l:1.1}, circ:{a:0,l:0.9} },
  jan: { frac: 6, h: 1.2, hSala: 2.1 },   // iluminação/ventilação ≥ 1/frac da área do piso; altura útil da janela (sala: porta-janela)
  tipos: [],         // ajustes por tipologia: {nome, modelo:"auto", cortes:{}, sel:-1}
  variantes: []      // variações salvas: {tipo, nome, modelo, cortes}
});

const COM_K = {
  sala:    {nome:"Sala", longo:"Estar / jantar", zona:"social", janela:true},
  suite:   {nome:"Suíte", longo:"Suíte", zona:"intima", janela:true},
  dorm:    {nome:"Dorm.", longo:"Dormitório", zona:"intima", janela:true},
  cozinha: {nome:"Cozinha", longo:"Cozinha", zona:"servico", duto:true},
  serv:    {nome:"Serviço", longo:"Área de serviço", zona:"servico", duto:true},
  banho:   {nome:"Banho", longo:"Banheiro", zona:"molhada", duto:true},
  bsuite:  {nome:"Banho", longo:"Banheiro da suíte", zona:"molhada", duto:true, min:"banho"},
  circ:    {nome:"Circ.", longo:"Circulação", zona:"circ"},
  closet:  {nome:"Closet", longo:"Closet", zona:"intima"},
  desp:    {nome:"Depósito", longo:"Depósito", zona:"servico"},
  sacada:  {nome:"Sacada", longo:"Sacada", zona:"externa"}
};
const COM_MODELOS = {
  studio: {nome:"Studio", dorms:0, suite:false, serv:false},
  "1d":   {nome:"1 dormitório", dorms:1, suite:false, serv:true},
  "1s":   {nome:"1 suíte", dorms:0, suite:true, serv:true},
  "2d":   {nome:"2 dormitórios", dorms:2, suite:false, serv:true},
  "2d1s": {nome:"2 dorm. (1 suíte)", dorms:1, suite:true, serv:true},
  "3d1s": {nome:"3 dorm. (1 suíte)", dorms:2, suite:true, serv:true}
};
const COM_DOOR = 0.8, COM_WALL = {fachada:0.20, divisa:0.075, corredor:0.075, nucleo:0.075, interna:0.06, guarda:0.04};

/* modelo automático pelo nome e pela área da tipologia */
function comModeloAuto(nome, area){
  const s=String(nome||"").toLowerCase();
  if(/studio|st[uú]dio|kit|loft/.test(s)) return "studio";
  const md=s.match(/(\d)\s*(d\b|d\.|q\b|q\.|dorm|quarto|dt)/), ms=s.match(/(\d)\s*su/), su=/su[ií]te/.test(s);
  let n = md? +md[1] : ms? +ms[1] : null;
  if(n===null){ if(area<38) return "studio"; if(area<50) return "1d"; if(area<78) return "2d1s"; return "3d1s" }
  if(n<=0) return "studio";
  const suite = ms? +ms[1]>0 : su || (n>=2 && area>=55);
  if(n===1) return suite? "1s" : "1d";
  if(n===2) return suite? "2d1s" : "2d";
  return "3d1s";
}
const comTipoCfg = (st, nome)=> (st.comodos && (st.comodos.tipos||[]).find(t=>t.nome===nome)) || null;
function comModeloDe(st, nome, area){ const c=comTipoCfg(st,nome); return c && c.modelo && c.modelo!=="auto" && COM_MODELOS[c.modelo] ? c.modelo : comModeloAuto(nome, area) }
/* modelos testados: o escolhido à mão, ou o automático e a alternativa sem/com suíte do mesmo número de dormitórios */
function comModelosTeste(st, nome, area){ const c=comTipoCfg(st,nome); if(c && c.modelo && c.modelo!=="auto" && COM_MODELOS[c.modelo]) return [c.modelo];
  const a=comModeloAuto(nome, area), alt={"2d1s":"2d","2d":"2d1s","1d":"1s","1s":"1d"}[a]; return alt? [a,alt] : [a] }

/* ---------- geometria auxiliar ---------- */
function comLimpa(p){ // tira pontos repetidos e colineares
  if(!p || p.length<3) return [];
  let q=p.filter((v,i)=>{ const w=p[(i+1)%p.length]; return Math.hypot(v[0]-w[0],v[1]-w[1])>1e-4 });
  for(let k=0;k<3 && q.length>3;k++) q=q.filter((v,i)=>{ const a=q[(i-1+q.length)%q.length], b=q[(i+1)%q.length]; return Math.abs((v[0]-a[0])*(b[1]-v[1])-(v[1]-a[1])*(b[0]-v[0]))>1e-6 });
  return q.length>2? q : [];
}
/* recuo por aresta (paredes): ts[i] = recuo da aresta p[i]→p[i+1]; esquinas em meia-esquadria */
function comInset(p, ts){
  const n=p.length; if(n<3) return [];
  const s=G.sArea(p)>0?1:-1, L=[];
  for(let i=0;i<n;i++){ const a=p[i], b=p[(i+1)%n], dx=b[0]-a[0], dy=b[1]-a[1], l=Math.hypot(dx,dy)||1, d=[dx/l,dy/l], nr= s>0? [-d[1],d[0]] : [d[1],-d[0]], t=typeof ts==="function"? ts(i) : ts;
    L.push({o:[a[0]+nr[0]*t, a[1]+nr[1]*t], d}) }
  const out=[];
  for(let i=0;i<n;i++){ const A=L[(i-1+n)%n], B=L[i], den=A.d[0]*B.d[1]-A.d[1]*B.d[0];
    if(Math.abs(den)<1e-6){ out.push(B.o); continue }
    const t=((B.o[0]-A.o[0])*B.d[1]-(B.o[1]-A.o[1])*B.d[0])/den; out.push([A.o[0]+A.d[0]*t, A.o[1]+A.d[1]*t]) }
  return out;
}
/* classe do que está do outro lado de um ponto de borda (sonda para fora) */
function comLado(pt, nOut, unitPoly, ctx){
  const pr=[pt[0]+nOut[0]*0.08, pt[1]+nOut[1]*0.08];
  if(unitPoly && G.pip(pr, unitPoly)) return "interna";
  if(!G.pip(pr, ctx.plate)) return "fachada";
  if(ctx.corridor && ctx.corridor.length && G.pip(pr, ctx.corridor)) return "corredor";
  if(ctx.core && ctx.core.length && G.pip(pr, ctx.core)) return "nucleo";
  return "divisa";
}
const comOut=(p,i)=>{ const a=p[i], b=p[(i+1)%p.length], dx=b[0]-a[0], dy=b[1]-a[1], l=Math.hypot(dx,dy)||1, s=G.sArea(p)>0?1:-1; return s>0? [dy/l,-dx/l] : [-dy/l,dx/l] };
/* arestas de um polígono com a classe do vizinho (sub-trechos de ~0,4 m) */
function comBordas(poly, unitPoly, ctx){
  const out=[];
  for(let i=0;i<poly.length;i++){ const a=poly[i], b=poly[(i+1)%poly.length], L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<0.05) continue; const n=comOut(poly,i), k=Math.max(1,Math.round(L/0.4));
    let cur=null;
    if(unitPoly && k>1){ const q=t=>{ const pm=[a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t]; return G.pip([pm[0]+n[0]*0.08, pm[1]+n[1]*0.08], unitPoly) };
      if(q(0.5) && q(0.5/k) && q(1-0.5/k)){ out.push({i, c:"interna", t0:0, t1:1, n}); continue } }
    for(let j=0;j<k;j++){ const t0=j/k, t1=(j+1)/k, tm=(t0+t1)/2, pm=[a[0]+(b[0]-a[0])*tm, a[1]+(b[1]-a[1])*tm], c=comLado(pm, n, unitPoly, ctx);
      if(cur && cur.c===c){ cur.t1=t1 } else { cur={i, c, t0, t1, n}; out.push(cur) } }
  }
  return out.map(s=>{ const a=poly[s.i], b=poly[(s.i+1)%poly.length]; return {i:s.i, c:s.c, n:s.n, a:[a[0]+(b[0]-a[0])*s.t0, a[1]+(b[1]-a[1])*s.t0], b:[a[0]+(b[0]-a[0])*s.t1, a[1]+(b[1]-a[1])*s.t1], len:Math.hypot(b[0]-a[0],b[1]-a[1])*(s.t1-s.t0)} });
}

/* ---------- referencial da unidade ---------- */
function comFrame(P, ax, dn, lado){
  const as=P.map(q=>G.dot(q,ax)), ds=P.map(q=>G.dot(q,dn)), a0=Math.min(...as), a1=Math.max(...as), d0=Math.min(...ds), D=Math.max(...ds)-d0, W=a1-a0;
  const A = x=> lado==="b"? a1-x : a0+x;                    // x = distância desde a ponta social
  const w = (x,d)=>{ const a=A(x); return [ax[0]*a+dn[0]*(d+d0), ax[1]*a+dn[1]*(d+d0)] };
  const loc = q=>{ const a=G.dot(q,ax); return [lado==="b"? a1-a : a-a0, G.dot(q,dn)-d0] };
  const clip = (x0,x1,y0,y1)=>{ const aa=A(x0), bb=A(x1); let r=G.band(P, ax, Math.min(aa,bb), Math.max(aa,bb)); if(!r.length) return []; r=G.band(r, dn, d0+y0, d0+y1); return comLimpa(r) };
  return {ax, dn, lado, a0, a1, d0, D, W, A, w, loc, clip};
}

/* ---------- gerador de uma variação ---------- */
const comClamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const comNf=(v,d=1)=>(+v).toFixed(d).replace(".",",");   // rápido (nf usa toLocaleString: lento dentro do laço de variações)
function comGera(P, U, mk, prm, ctx, st){
  const M=COM_MODELOS[mk], C=st.comodos||DEF.comodos, mins=C.min||{}, ov=prm.cortes||{};
  const F=comFrame(P, prm.ax, prm.dn, prm.lado), W=F.W, D=F.D;
  if(W<2 || D<2) return null;
  const hasCirc = M.dorms>0, dM = hasCirc? 1.0 : 0;
  // profundidades: faixa molhada (junto do corredor) e faixa de fachada
  let dW = comClamp(D*0.4, 2.2, 3.4) + (prm.dWd||0); dW=comClamp(dW, 1.8, D-dM-2.4);
  if(ov.dW!=null) dW=comClamp(ov.dW*D, 1.6, D-dM-2.2);
  let dF = D-dM-dW; if(ov.dF!=null && hasCirc){ dF=comClamp(ov.dF*D, 2.2, D-dM-1.6); dW=D-dM-dF }
  const yW = dF+dM;
  // faixa de fachada: sala | dormitórios | suíte (| banho da suíte, na unidade em L) — cortes pelas áreas-alvo
  const sac = U.sac && U.sac.area>0.5 ? U.sac : null, sacEmb = sac && sac.tipo!=="balanco" ? sac.area : 0;
  const mA=k=>((mins[k]||{}).a||0), mL=k=>((mins[k]||{}).l||0);
  // até onde a faixa molhada existe (unidade em L: a sobra da escada só tem a faixa de fachada)
  const PW=F.clip(0,W,yW,D), xsW=PW.map(q=>F.loc(q)[0]), xa=PW.length? Math.max(0,Math.min(...xsW)) : W, xb=PW.length? Math.min(W,Math.max(...xsW)) : 0;
  const bsF = !!prm.bsF && M.suite;
  const fr=[{k:"sala", t:Math.max(14, 0.28*U.alvo)+sacEmb, mn:Math.max(mL("sala")+0.1, (mA("sala")+mA("cozinha")+sacEmb)/Math.max(1,D)+0.05)}];
  for(let i=0;i<M.dorms;i++) fr.push({k:"dorm", t:Math.max(8.5,0.11*U.alvo), mn:Math.max(mL("dorm")+0.05, mA("dorm")/Math.max(1,dF)+0.05)});
  if(M.suite) fr.push({k:"suite", t:Math.max(11.5,0.15*U.alvo), mn:Math.max(mL("suite")+0.05, mA("suite")/Math.max(1,dF)+0.05)});
  if(bsF) fr.push({k:"bsuite", t:4.2, mn:Math.max(1.5, mL("banho")+0.3)});
  const PF = F.clip(0, W, 0, yW), tot=fr.reduce((s,r)=>s+r.t,0);
  const dirX = F.lado==="b"? [-F.ax[0],-F.ax[1]] : F.ax, x0w = F.lado==="b"? -F.a1 : F.a0;
  let acc=0; const cutsF=[];
  for(let i=0;i<fr.length-1;i++){ acc+=fr[i].t; cutsF.push(PF.length? G.cutAt(PF, dirX, acc/tot)-x0w : W*acc/tot) }
  // larguras mínimas (se couber; senão, proporcionais aos mínimos) e ajustes manuais
  const fixCuts=(cuts, mn, ovKey, X0, X1)=>{ let xs=[X0,...cuts,X1];
    const need=mn.reduce((s,v)=>s+v,0), span=X1-X0;
    if(span>=need) for(let it=0;it<4;it++){ for(let i=0;i<mn.length;i++){ const w=xs[i+1]-xs[i]; if(w<mn[i]-1e-6){ const def=mn[i]-w; let j=-1,best=0; for(let q=0;q<mn.length;q++){ const sl=(xs[q+1]-xs[q])-mn[q]; if(q!==i && sl>best){ best=sl; j=q } } if(j<0) break; const mv=Math.min(def,best);
        if(j>i) for(let q=i+1;q<=j;q++) xs[q]+=mv; else for(let q=j+1;q<=i;q++) xs[q]-=mv } } }
    else if(need>0){ let x=X0; xs=[X0,...mn.map(v=>x+=v*span/need)] }
    cuts=xs.slice(1,-1);
    cuts=cuts.map((c,i)=>{ const o=ov[ovKey+(i+1)]; return o!=null && isFinite(o)? o*W : c });
    const gap= ovKey==="f"? 1.5 : 0.9;   // ajuste manual não espreme um cômodo abaixo disso
    for(let i=0;i<cuts.length;i++){ if(ov[ovKey+(i+1)]==null) continue; const lo=(i? cuts[i-1] : X0)+gap, hi=(i<cuts.length-1? cuts[i+1] : X1)-gap; cuts[i]=comClamp(cuts[i], lo, Math.max(lo,hi)) }
    return cuts };
  let cF = fixCuts(cutsF, fr.map(r=>r.mn), "f", 0, W);
  { // 2ª passada: fachada inclinada/recortada tira profundidade — alarga o que ficou abaixo da área mínima
    const xs=[0,...cF,W]; let mudou=false;
    fr.forEach((r,i)=>{ const dep = r.k==="dorm"||r.k==="bsuite"? dF : r.k==="sala"? D : yW, a=G.area(F.clip(xs[i],xs[i+1],0,dep)) - (r.k==="sala"? sacEmb : 0), need=r.k==="bsuite"? 0 : r.k==="sala"? mA("sala")+mA("cozinha") : mA(r.k);
      if(need>0 && a<need){ r.mn=Math.max(r.mn, (xs[i+1]-xs[i]) + (need-a)/Math.max(1,dep) + 0.03); mudou=true } });
    if(mudou) cF = fixCuts(cutsF, fr.map(r=>r.mn), "f", 0, W) }
  const xF=[0,...cF,W];
  const si=fr.findIndex(r=>r.k==="suite"), salaX1=xF[1], suiteX0 = si>=0? xF[si] : W, suiteX1 = si>=0? xF[si+1] : W;
  // faixa molhada: [cozinha, serviço, (depósito), banho social] até a suíte; [banho da suíte, closet] embaixo da suíte
  let X1w = M.suite? suiteX0 : xb, bsX0=null, bsX1=null, cloX0=null, cloX1=null;
  const z0=suiteX0, z1=Math.min(suiteX1, xb), zw=z1-z0;
  if(M.suite && !bsF){ const wb=comClamp(3.6/dW,1.6,2.4); let c = zw-wb>=1.1? z0+wb : z1; if(ov.ws!=null && zw>1.6) c=comClamp(ov.ws*W, z0+1.2, z1); if(z1-c<0.9) c=z1; bsX0=z0; bsX1=c; if(c<z1-0.05){ cloX0=c; cloX1=z1 } }
  else if(M.suite && bsF){ if(zw>=1.0){ cloX0=z0; cloX1=z1 } else if(zw>0) X1w=z1 }
  X1w=Math.min(X1w, xb); const X0w=Math.min(xa, X1w), Wm=X1w-X0w;
  const wr=[{k:"cozinha", mn:1.8}]; if(M.serv) wr.push({k:"serv", mn:1.15});
  const temBanhoSocial = !M.suite || M.dorms>0; if(temBanhoSocial) wr.push({k:"banho", mn:1.3});
  let ws=wr.map(r=>r.k==="banho"? comClamp(3.4/dW,1.5,2.3) : r.k==="serv"? comClamp(0.045*U.alvo/dW,1.3,1.9) : 0);
  ws[0]=Wm-ws.slice(1).reduce((s,v)=>s+v,0);
  if(ws[0]>4.4){ let ex=ws[0]-4.4; ws[0]=4.4;   // sobra na faixa molhada: serviço e banho crescem; o resto vira depósito
    const grow=(k,cap)=>{ const i=wr.findIndex(r=>r.k===k); if(i<0) return; const g=Math.min(ex, Math.max(0,cap-ws[i])); ws[i]+=g; ex-=g };
    grow("serv",2.0); grow("banho",2.4);
    if(ex>=1.0 && M.serv){ const i=wr.findIndex(r=>r.k==="serv")+1; wr.splice(i,0,{k:"desp", mn:0.9}); ws.splice(i,0,ex) } else ws[0]+=ex }
  let acc2=X0w; const cutsW0=ws.slice(0,-1).map(w=>acc2+=w);
  const cW = wr.length>1? fixCuts(cutsW0, wr.map(r=>r.mn), "w", X0w, X1w) : [];
  const xW=[X0w,...cW,X1w];
  // sacada embutida: no canto externo da sala (ou em toda a frente dela)
  let sacW=0, sacD=0; if(sacEmb>0){ sacW=comClamp(sacEmb/1.6, 1.8, salaX1); if(salaX1-sacW<1.2) sacW=salaX1; sacD=comClamp(sacEmb/sacW, 1.2, Math.min(2.4, yW-2.6)) }
  // cômodos (retângulos no referencial; recortados pelo polígono)
  const R=[]; const add=(k,x0,x1,y0,y1,extra={})=>{ if(x1-x0<0.05||y1-y0<0.05) return null; const poly=F.clip(x0,x1,y0,y1); const r={k, nome:COM_K[k].nome, x0,x1,y0,y1, poly, area:G.area(poly), ...extra}; R.push(r); return r };
  // recorta o canto (cx, fachada) até (ix, iy): o ponto na fachada segue a inclinação dela
  const notchLoc=(poly, cx, cy, ix, iy)=>{ const Lc=poly.map(q=>F.loc(q)); let k=-1, by=Infinity; Lc.forEach((q,i)=>{ if(Math.abs(q[0]-cx)<0.05 && q[1]<by){ by=q[1]; k=i } }); if(k<0 || by>cy+0.6) return null;
    const n=Lc.length, K=Lc[k], pv=Lc[(k-1+n)%n], nx=Lc[(k+1)%n], fn = Math.abs(pv[0]-K[0])>Math.abs(nx[0]-K[0])? pv : nx, t=(ix-K[0])/((fn[0]-K[0])||1e-9);
    if(!(t>0 && t<=1+1e-9) || iy<=K[1]+0.3) return null;
    const sn = fn===pv? nx : pv, t2=(iy-K[1])/((sn[1]-K[1])||1e-9), cxx = t2>0 && t2<=1+1e-9? K[0]+(sn[0]-K[0])*t2 : cx;   // parede lateral também pode ser inclinada
    const a=F.w(ix, K[1]+(fn[1]-K[1])*t), b=F.w(ix,iy), c=F.w(cxx,iy); return [...poly.slice(0,k), ...(fn===pv? [a,b,c] : [c,b,a]), ...poly.slice(k+1)] };
  let sala=null, sacR=null;
  if(sacD>0 && sacW<salaX1-1e-6){ sala=add("sala",0,salaX1,0,yW); const np=sala && notchLoc(sala.poly,0,0,sacW,sacD); if(np){ sala.poly=comLimpa(np); sala.area=G.area(sala.poly); sacR=add("sacada",0,sacW,0,sacD) } else { sacW=salaX1; if(sala) R.pop(); sala=null } }
  if(!sala){ sala=add("sala",0,salaX1,sacD,yW); if(sacD>0) sacR=add("sacada",0,salaX1,0,sacD) }
  let di=0; for(let i=1;i<fr.length;i++){ const k=fr[i].k; if(k==="dorm"){ di++; add("dorm",xF[i],xF[i+1],0,dF,{n:di}) } else if(k==="suite") add("suite",xF[i],xF[i+1],0,yW); else add("bsuite",xF[i],xF[i+1],0,dF) }
  if(hasCirc && suiteX0-salaX1>0.05) add("circ",salaX1,suiteX0,dF,yW);
  wr.forEach((r,i)=>add(r.k,xW[i],xW[i+1],yW,D));
  if(bsX0!=null) add("bsuite",bsX0,bsX1,yW,D); if(cloX0!=null) add("closet",cloX0,cloX1,yW,D);
  // sem área (recorte vazio, ex.: unidade em L) → some
  const rooms=R.filter(r=>r.area>0.15);
  const by=k=>rooms.filter(r=>r.k===k);
  // portas (no referencial): aresta compartilhada entre dois retângulos
  const doors=[];
  const shared=(A,B)=>{ const e=1e-6;
    if(Math.abs(A.x1-B.x0)<e||Math.abs(B.x1-A.x0)<e){ const x=Math.abs(A.x1-B.x0)<e? A.x1 : A.x0, lo=Math.max(A.y0,B.y0), hi=Math.min(A.y1,B.y1); return hi-lo>0.05? {ax:"x", at:x, lo, hi} : null }
    if(Math.abs(A.y1-B.y0)<e||Math.abs(B.y1-A.y0)<e){ const y=Math.abs(A.y1-B.y0)<e? A.y1 : A.y0, lo=Math.max(A.x0,B.x0), hi=Math.min(A.x1,B.x1); return hi-lo>0.05? {ax:"y", at:y, lo, hi} : null }
    return null };
  const ptOf=(s,t)=> s.ax==="x"? [s.at,t] : [t,s.at];
  const inside=(r,x,y)=> r.poly.length && G.pip(F.w(x,y), r.poly);
  const span=(r,s)=>{ // trecho do contorno recortado de r sobre a reta da aresta compartilhada
    const Lc=r.loc||(r.loc=r.poly.map(q=>F.loc(q))), ci=s.ax==="x"?0:1, cj=1-ci; let lo=Infinity, hi=-Infinity;
    for(let i=0;i<Lc.length;i++){ const p=Lc[i], q=Lc[(i+1)%Lc.length], dp=p[ci]-s.at, dq=q[ci]-s.at;
      if(Math.abs(dp)<1e-4){ lo=Math.min(lo,p[cj]); hi=Math.max(hi,p[cj]) }
      else if(dp*dq<0 && Math.abs(dq)>=1e-4){ const v=p[cj]+(q[cj]-p[cj])*dp/(dp-dq); lo=Math.min(lo,v); hi=Math.max(hi,v) } }
    return [lo,hi] };
  const run=(s,A,B)=>{ // trecho real (dentro dos dois cômodos recortados)
    const a=span(A,s), b=span(B,s), lo=Math.max(s.lo,a[0],b[0]), hi=Math.min(s.hi,a[1],b[1]);
    return hi-lo>0.3 ? {...s, lo, hi} : null };
  const door=(A,B,o={})=>{ if(!A||!B) return false; let s=shared(A,B); if(!s) return false; s=run(s,A,B); if(!s) return false;
    const len=s.hi-s.lo, w=Math.min(o.w||COM_DOOR, len-0.2);
    let t0; if(o.vao){ if(len<0.6) return false; const ww=Math.min(len-0.1, o.vaoMax||len); t0=s.lo+(len-ww)/2; doors.push({k:"vao", ax:s.ax, at:s.at, lo:t0, hi:t0+ww, from:A, into:B}); return true }
    if(w<0.6) return false;
    if(o.pos==="hi") t0=s.hi-0.12-w; else if(o.pos==="lo") t0=s.lo+0.12; else t0=s.lo+(len-w)/2;
    doors.push({k:"porta", ax:s.ax, at:s.at, lo:t0, hi:t0+w, from:A, into:B, hinge:o.pos==="hi"? "hi" : "lo"}); return true };
  const circ=by("circ")[0], coz=by("cozinha")[0], serv=by("serv")[0], suite=by("suite")[0], banho=by("banho")[0], bs=by("bsuite")[0], clo=by("closet")[0], desp=by("desp")[0];
  const acesso=new Map(); const liga=(a,b)=>{ if(!a||!b) return; (acesso.get(a)||acesso.set(a,[]).get(a)).push(b); (acesso.get(b)||acesso.set(b,[]).get(b)).push(a) };
  if(sala&&coz && door(sala,coz,{vao:true, vaoMax:3.2})) liga(sala,coz);
  { const v=doors.find(d=>d.k==="vao" && d.from===sala && d.into===coz); if(v && v.hi-v.lo>=1.5){ sala.integ=true; coz.integ=true; v.k="integ" } }   // cozinha integrada à sala
  if(coz&&serv && door(coz,serv,{w:0.7})) liga(coz,serv);
  if(serv&&desp && door(serv,desp,{w:0.7})) liga(serv,desp);
  if(sala&&circ && door(sala,circ,{vao:true, vaoMax:1.0})) liga(sala,circ);
  const hub = circ || sala;
  by("dorm").forEach(d=>{ if(door(circ||sala,d,{pos:"hi"})) liga(circ||sala,d) });
  if(suite){ if(door(circ||sala,suite,{})) liga(circ||sala,suite) }
  if(banho){ if(door(hub,banho,{w:0.7, pos:"hi"})) liga(hub,banho); else if(sala && door(sala,banho,{w:0.7})) liga(sala,banho) }
  if(suite&&bs && door(suite,bs,{w:0.7})) liga(suite,bs);
  if(suite&&clo && door(suite,clo,{vao:true, vaoMax:0.9})) liga(suite,clo);
  if(sala&&sacR){ doors.push({k:"pj", ax:"y", at:sacD, lo:0.25, hi:Math.max(0.6,sacW-0.25), from:sala, into:sacR}); liga(sala,sacR) }
  // bordas de cada cômodo (classe do vizinho) e porta de entrada no corredor
  rooms.forEach(r=>{ r.bordas = r.poly.length? comBordas(r.poly, P, ctx) : [] });
  let entrada=null;
  { const cands=(prm.fr==="l"? [sala, coz, circ] : [coz, sala, circ]).filter(Boolean);
    for(const r of cands){ const segs=r.bordas.filter(b=>b.c==="corredor" && b.len>=1.1).sort((a,b)=>b.len-a.len); if(!segs.length) continue;
      const s=segs[0], w=0.9, L=s.len, tA=(L-w)/L; // perto da ponta mais distante da parede externa da zona social
      const la=F.loc(s.a)[0], lb=F.loc(s.b)[0], far = la>lb? 0 : 1, t0 = far===0? 0.12/L : tA-0.12/L;
      const p0=[s.a[0]+(s.b[0]-s.a[0])*t0, s.a[1]+(s.b[1]-s.a[1])*t0], p1=[s.a[0]+(s.b[0]-s.a[0])*(t0+w/L), s.a[1]+(s.b[1]-s.a[1])*(t0+w/L)];
      entrada={room:r, p0, p1, n:[-s.n[0],-s.n[1]]}; break } }
  // acesso: todos os cômodos alcançáveis a partir da entrada
  const alc=new Set(); if(entrada){ const q=[entrada.room]; alc.add(entrada.room); while(q.length){ const r=q.shift(); (acesso.get(r)||[]).forEach(o=>{ if(!alc.has(o)){ alc.add(o); q.push(o) } }) } }
  // janelas
  const J=C.jan||{frac:6,h:1.2,hSala:2.1}, windows=[];
  rooms.forEach(r=>{ const K=COM_K[r.k]; r.jan=0; r.janReq=0; if(r.k==="sacada"||r.k==="circ") return;
    const fac=r.bordas.filter(b=>b.c==="fachada"); r.facLen=fac.reduce((s,b)=>s+b.len,0);
    r.viaSacada = !!(sacR && r===sala);
    const h = r.k==="sala"? (J.hSala||2.1) : (J.h||1.2); r.janReq = r.area/(J.frac||6)/h;
    const best=fac.sort((a,b)=>b.len-a.len)[0];
    if(best && best.len>=0.8){ const w=Math.min(best.len-0.4, Math.max(r.janReq*1.15, K.janela? 1.2 : 0.6, Math.min(best.len*0.55, r.k==="sala"? 3.2 : 2.0)));
      const t0=(best.len-w)/2/best.len, t1=1-t0, p0=[best.a[0]+(best.b[0]-best.a[0])*t0, best.a[1]+(best.b[1]-best.a[1])*t0], p1=[best.a[0]+(best.b[0]-best.a[0])*t1, best.a[1]+(best.b[1]-best.a[1])*t1];
      windows.push({room:r, p0, p1, n:best.n, w}); r.jan=w*h }
    if(r.viaSacada){ const pj=doors.find(d=>d.k==="pj"); if(pj) r.jan += (pj.hi-pj.lo)*h }
  });
  // validação
  const alertas=[], nomeR=r=> r.k==="dorm"? `Dormitório ${r.n}` : COM_K[r.k].longo;
  rooms.forEach(r=>{ const K=COM_K[r.k], mn=mins[K.min||r.k]; const ext=r.poly.length? [r.poly.map(q=>F.loc(q)[0]), r.poly.map(q=>F.loc(q)[1])] : [[0],[0]];
    r.larg=Math.min(Math.max(...ext[0])-Math.min(...ext[0]), Math.max(...ext[1])-Math.min(...ext[1]));
    r.alertas=[];
    const al=(nivel,msg)=>{ r.alertas.push({nivel,msg}); alertas.push({nivel, msg:`${nomeR(r)}: ${msg}`, k:r.k}) };
    // sala com cozinha integrada: um compartimento só (soma das áreas e dos mínimos)
    const aR = r.k==="sala" && r.integ && coz? r.area+coz.area : r.area, aM = mn? (r.k==="sala" && r.integ? mn.a+((mins.cozinha||{}).a||0) : mn.a) : 0;
    if(mn && aM>0 && !(r.k==="cozinha" && r.integ) && aR<aM-0.05) al(aR<aM*0.85?"erro":"aviso", `${comNf(aR,1)} m²${r.integ?" com a cozinha":""} (mín. ${comNf(aM,1)} m²)`);
    if(mn && mn.l>0 && r.larg<mn.l-0.05) al(r.larg<mn.l*0.85?"erro":"aviso", `largura ${comNf(r.larg,2)} m (mín. ${comNf(mn.l,2)} m)`);
    if(K.janela){ if(!r.jan) al("erro","sem janela"); else if(r.jan < aR/(J.frac||6)-0.01) al("erro",`janela insuficiente (${comNf(r.jan,2)} m² < 1/${J.frac||6} do piso)`) }
    else if(K.duto && !r.facLen && !r.integ) r.duto=true;
    if(entrada && !alc.has(r) && r.k!=="sacada") al("erro","sem acesso");
  });
  if(!entrada) alertas.push({nivel:"erro", msg:"sem porta para o corredor", k:"entrada"});
  const falta=(k,n,nome)=>{ if(by(k).length<n) alertas.push({nivel:"erro", msg:`falta ${nome}`, k}) };
  falta("sala",1,"a sala"); falta("cozinha",1,"a cozinha"); falta("dorm",M.dorms,M.dorms>1? "dormitório" : "o dormitório");
  if(M.suite){ falta("suite",1,"a suíte"); falta("bsuite",1,"o banheiro da suíte") } if(temBanhoSocial) falta("banho",1,"o banheiro"); if(M.serv) falta("serv",1,"a área de serviço");
  if(rooms.some(r=>r.duto)) alertas.push({nivel:"nota", msg:"cozinha, serviço e banheiros sem fachada: ventilação por duto ou shaft (conferir)", k:"duto"});
  // pontuação: alertas, adjacências e desvio das áreas-alvo
  let score=0; alertas.forEach(a=>score-= a.nivel==="erro"? 100 : a.nivel==="aviso"? 15 : 0);
  const toca=(A,B)=>!!(A&&B&&shared(A,B)); if(toca(coz,serv)) score+=6; if(toca(coz,sala)) score+=6; if(banho && toca(banho,circ||sala)) score+=4; if(bs && toca(bs,suite)) score+=4; if(entrada && (entrada.room===coz||entrada.room===sala)) score+=5;
  fr.forEach((f,i)=>{ const r=rooms.find(x=>x.k===f.k && Math.abs(x.x0-xF[i])<1e-6); if(r) score-=3*Math.abs((r.area+(f.k==="sala"&&sacR?sacR.area:0))/f.t-1) });
  if(rooms.some(r=>(r.k==="dorm"||r.k==="suite") && r.facLen>0 && r.bordas.filter(b=>b.c==="fachada").length>1)) score+=1;
  // sala bem proporcionada (a faixa rasa atrás da escada não serve de sala)
  if(sala && sala.poly.length){ const pts=[...sala.poly, ...(sacR? sacR.poly : [])].map(q=>F.loc(q)), xs=pts.map(q=>q[0]), ys=pts.map(q=>q[1]), bb=(Math.max(...xs)-Math.min(...xs))*(Math.max(...ys)-Math.min(...ys));
    const ratio=(sala.area+(sacR? sacR.area : 0))/Math.max(1,bb); if(ratio<0.85) score-=25*(0.85-ratio) }
  // divisões arrastáveis (frações a partir da ponta social)
  const divs=[];
  cF.forEach((c,i)=>divs.push({id:"f"+(i+1), ax:"x", x:c, y0:0, y1: (fr[i+1]&&fr[i+1].k==="suite")||i===0? yW : dF, lo:(i? cF[i-1]:0)+1.5, hi:(i<cF.length-1? cF[i+1]:W)-1.5}));
  cW.forEach((c,i)=>divs.push({id:"w"+(i+1), ax:"x", x:c, y0:yW, y1:D, lo:(i? cW[i-1]:X0w)+0.9, hi:(i<cW.length-1? cW[i+1]:X1w)-0.9}));
  if(cloX0!=null && bsX1!=null) divs.push({id:"ws", ax:"x", x:bsX1, y0:yW, y1:D, lo:suiteX0+1.2, hi:z1-0.9});
  if(hasCirc) divs.push({id:"dF", ax:"y", y:dF, x0:salaX1, x1:suiteX0, lo:2.2, hi:D-dM-1.6});
  divs.push({id:"dW", ax:"y", y:yW, x0:0, x1:W, lo:(hasCirc? dF+dM : 2.4), hi:D-1.6});
  divs.forEach(d=>{ if(d.ax==="x"){ d.p0=F.w(d.x,d.y0); d.p1=F.w(d.x,d.y1) } else { d.p0=F.w(d.x0,d.y); d.p1=F.w(d.x1,d.y) } });
  const cortes={}; cF.forEach((c,i)=>cortes["f"+(i+1)]=c/W); cW.forEach((c,i)=>cortes["w"+(i+1)]=c/W); if(cloX0!=null && bsX1!=null) cortes.ws=bsX1/W; cortes.dF=dF/D; cortes.dW=dW/D;
  return {F, mk, rooms, doors, windows, entrada, alertas, score, divs, cortes, dF, dM, dW, salaX1, suiteX0, sacR};
}

/* sacada em balanço: na frente da sala, mesma área */
function comSacBalanco(L, u){
  const s=u.sac; if(!s || s.tipo!=="balanco" || !L.rooms.length) return;
  const sala=L.rooms.find(r=>r.k==="sala"); if(!sala) return;
  const ext=s.poly.map(q=>G.dot(q,L.F.ax)), w=Math.max(...ext)-Math.min(...ext), pr=s.area/Math.max(0.1,w);
  const xc=Math.min(Math.max(sala.x1/2, w/2), L.F.W-w/2);
  const a=[L.F.w(xc-w/2,0),L.F.w(xc+w/2,0),L.F.w(xc+w/2,-pr),L.F.w(xc-w/2,-pr)];
  s.poly=a; s.area=G.area(a);
}

/* ---------- mobiliário simples (no referencial do cômodo) ---------- */
function comMoveis(L){
  const F=L.F, out=[], R=(x0,y0,x1,y1,k)=>out.push({t:"r", k, pts:[F.w(x0,y0),F.w(x1,y0),F.w(x1,y1),F.w(x0,y1)]}), Cc=(x,y,r,k)=>out.push({t:"c", k, c:F.w(x,y), r}), Ln=(x0,y0,x1,y1,k)=>out.push({t:"l", k, pts:[F.w(x0,y0),F.w(x1,y1)]});
  const doorsOf=r=>L.doors.filter(d=>d.from===r||d.into===r);
  const ok=(r,x0,y0,x1,y1)=>{ const P=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]; return r.poly.length && P.every(([x,y])=>G.pip(F.w(x,y), r.poly)) };
  L.rooms.forEach(r=>{ const w=r.x1-r.x0, h=r.y1-r.y0, ds=doorsOf(r);
    // lado da porta (para não pôr nada na frente)
    const dX = ds.filter(d=>d.ax==="y" && d.k!=="pj").map(d=>(d.lo+d.hi)/2);
    if(r.k==="dorm"||r.k==="suite"){ const casal = r.k==="suite" || (L.mk==="1d"), bw=casal?1.4:0.9, bl=1.95, yb1 = r.k==="suite"? r.y1 : r.y1;
      const yc=(r.y0+Math.min(yb1, L.dF+ (r.k==="suite"? L.dM:0)))/2, dmid=dX.length? dX[0] : r.x1, atLo = dmid > (r.x0+r.x1)/2;
      const bx0 = atLo? r.x0+0.05 : r.x1-0.05-bl, bx1=bx0+bl, by0=yc-bw/2, by1=yc+bw/2;
      if(w>=bl+0.55 && ok(r,bx0,by0,bx1,by1)){ R(bx0,by0,bx1,by1,"cama"); const px= atLo? bx0+0.45 : bx1-0.45; R(Math.min(px,atLo?bx0:bx1),by0+0.1,Math.max(px,atLo?bx0:bx1),by1-0.1,"trav");
        if(by0-0.45>r.y0+0.05 && ok(r,atLo?bx0:bx1-0.45,by0-0.45,atLo?bx0+0.45:bx1,by0-0.05)) R(atLo?bx0:bx1-0.45,by0-0.45,atLo?bx0+0.45:bx1,by0-0.05,"criado");
        // guarda-roupa na parede oposta à cabeceira
        const gx0 = atLo? r.x1-0.62 : r.x0+0.02, gx1=gx0+0.6, gy0=r.y0+0.15, gy1=Math.min(r.y0+2.6, (r.k==="suite"? L.dF : r.y1)-0.15);
        if(w>=bl+0.6+0.75 && gy1-gy0>=1.0 && ok(r,gx0,gy0,gx1,gy1)){ R(gx0,gy0,gx1,gy1,"armario"); Ln(gx0+0.3,gy0,gx0+0.3,gy1,"armario") } } }
    else if(r.k==="sala"){ const y0=r.y0+0.1, deep=h; const sy0=y0+0.3, sy1=Math.min(sy0+2.1, r.y1-0.3);
      if(w>=2.6 && sy1-sy0>=1.6 && ok(r,r.x0+0.08,sy0,r.x0+0.95,sy1)){ R(r.x0+0.08,sy0,r.x0+0.95,sy1,"sofa"); R(r.x0+0.08,sy0+0.2,r.x0+0.3,sy1-0.2,"sofa"); R(r.x0+0.08,sy0,r.x0+0.95,sy0+0.2,"sofa"); R(r.x0+0.08,sy1-0.2,r.x0+0.95,sy1,"sofa"); R(r.x0+0.3,(sy0+sy1)/2-0.01,r.x0+0.95,(sy0+sy1)/2+0.01,"sofa");
        const cx0=r.x0+1.35, cx1=Math.min(cx0+0.55, r.x1-0.9); if(cx1-cx0>0.35) R(cx0,(sy0+sy1)/2-0.45,cx1,(sy0+sy1)/2+0.45,"mesa");
        if(ok(r,r.x1-0.42,sy0+0.2,r.x1-0.05,sy1-0.2)) R(r.x1-0.42,sy0+0.2,r.x1-0.05,sy1-0.2,"rack") }
      if(deep>=4.7 && w>=2.4){ const ty1=r.y1-0.75, ty0=ty1-0.8, tx0=r.x0+(w-1.2)/2, tx1=tx0+1.2; if(ok(r,tx0-0.4,ty0-0.4,tx1+0.4,ty1+0.4)){ R(tx0,ty0,tx1,ty1,"mesa"); [[tx0+0.3,ty0-0.22],[tx1-0.3,ty0-0.22],[tx0+0.3,ty1+0.22],[tx1-0.3,ty1+0.22]].forEach(([x,y])=>R(x-0.2,y-0.18,x+0.2,y+0.18,"cadeira")) } } }
    else if(r.k==="cozinha"){ const x0=r.x0+0.03, x1=x0+0.6, y0=r.y0+0.05, y1=r.y1-0.05;
      if(h>=1.8 && ok(r,x0,y0,x1,y1)){ const fy1=y1, fy0=fy1-0.72; R(x0,fy0,x1+0.08,fy1,"geladeira"); R(x0,y0,x1,fy0-0.05,"bancada");
        const cl=fy0-0.05-y0; if(cl>1.2){ Cc(x0+0.3,y0+0.45,0.11,"fogao"); Cc(x0+0.3,y0+0.75,0.11,"fogao"); R(x0+0.08,y0+cl*0.62,x1-0.08,y0+cl*0.62+0.45,"pia") } } }
    else if(r.k==="serv"){ const x0=r.x0+0.05; if(ok(r,x0,r.y1-0.6,x0+0.55,r.y1-0.05)){ R(x0,r.y1-0.6,x0+0.55,r.y1-0.05,"tanque"); if(ok(r,x0,r.y1-1.28,x0+0.6,r.y1-0.68)){ R(x0,r.y1-1.28,x0+0.6,r.y1-0.68,"maquina"); Cc(x0+0.3,r.y1-0.98,0.2,"maquina") } } }
    else if(r.k==="banho"||r.k==="bsuite"){ const sx=w>=1.3? 0.9 : w-0.1, by1=r.y1-0.03;
      if(h>=1.8 && ok(r,r.x0+0.05,by1-0.9,r.x0+0.05+sx,by1)){ R(r.x0+0.05,by1-0.9,r.x0+0.05+sx,by1,"box"); Ln(r.x0+0.05,by1-0.9,r.x0+0.05+sx,by1,"box") }
      const vy=r.y0+Math.min(1.0,(h-0.9)/2+0.2); if(ok(r,r.x1-0.68,vy-0.2,r.x1-0.03,vy+0.2)){ R(r.x1-0.2,vy-0.2,r.x1-0.03,vy+0.2,"vaso"); Cc(r.x1-0.42,vy,0.19,"vaso") }
      if(ok(r,r.x0+0.03,r.y0+0.15,r.x0+0.45,r.y0+0.65)){ R(r.x0+0.03,r.y0+0.15,r.x0+0.45,r.y0+0.65,"lav"); Cc(r.x0+0.24,r.y0+0.4,0.13,"lav") } }
    else if(r.k==="closet"||r.k==="desp"){ if(w>=1.0 && ok(r,r.x0+0.03,r.y0+0.1,r.x0+0.5,r.y1-0.1)) R(r.x0+0.03,r.y0+0.1,r.x0+0.5,r.y1-0.1,"armario") }
  });
  return out;
}

/* ---------- uma unidade: testa variações e escolhe ---------- */
const _comCache = new Map();
function comUnidade(u, lay, st, ctx){
  const P=comLimpa(u.poly); if(P.length<3 || G.area(P)<12) return null;
  const mks=comModelosTeste(st, u.nome, u.alvo), cfg=comTipoCfg(st, u.nome)||{}, ov=cfg.cortes||{};
  const C=st.comodos||DEF.comodos;
  const sig=JSON.stringify([P.map(q=>[+q[0].toFixed(3),+q[1].toFixed(3)]), u.fac, u.alvo, u.sac&&[u.sac.tipo,+u.sac.area.toFixed(2)], mks, ov, C.min, C.jan, ctx.sig]);
  const hit=_comCache.get(sig); if(hit) return hit;
  const sigA=sig.replace(JSON.stringify(ov), "{}")+"|auto";   // a escolha da variação não depende dos ajustes manuais
  const finaliza=b=>{ b.movel=comMoveis(b); b.erros=b.alertas.filter(a=>a.nivel==="erro").length; b.avisos=b.alertas.filter(a=>a.nivel==="aviso").length;
    b.soma=b.rooms.reduce((s,r)=>s+r.area,0); b.ok=b.erros===0; if(_comCache.size>600) _comCache.clear(); return b };
  const auto=_comCache.get(sigA);
  if(auto && Object.keys(ov).length){ const L=comGera(P, u, auto.mk, {...auto.prm, cortes:ov}, ctx, st); if(L){ const b=finaliza({...L, frame:auto.frame, prm:auto.prm, nVar:auto.nVar}); _comCache.set(sig, b); return b } }
  const ux=lay.ux, vy=lay.vy, frames=[];
  // fachada principal (oposta ao corredor)
  frames.push({fr:"f", ax:ux, dn: u.fac==="max"? [-vy[0],-vy[1]] : [vy[0],vy[1]]});
  // fachada lateral (unidade de ponta): a zona social fica do lado do corredor
  const bord=comBordas(P, null, ctx), corr=bord.filter(b=>b.c==="corredor"), lat=bord.filter(b=>b.c==="fachada" && b.len>=3 && Math.abs(G.dot([(b.b[0]-b.a[0])/b.len,(b.b[1]-b.a[1])/b.len],ux))<0.35);
  lat.forEach(b=>{ const d=[(b.b[0]-b.a[0])/b.len,(b.b[1]-b.a[1])/b.len], dn=[-b.n[0],-b.n[1]]; frames.push({fr:"l", ax:d, dn, corr}) });
  let best=null, n=0;
  frames.forEach(fm=>{
    let lados=["a","b"];
    if(fm.fr==="l"){ if(!corr.length) return; const Fx=comFrame(P, fm.ax, fm.dn, "a"); const xc=corr.reduce((s,b)=>s+Fx.loc([(b.a[0]+b.b[0])/2,(b.a[1]+b.b[1])/2])[0],0)/corr.length; lados=[xc<Fx.W/2? "a" : "b"] }
    const bsFs = P.length>4? [false,true] : [false];   // unidade em L: banho da suíte também na faixa de fachada
    mks.forEach(mk=>lados.forEach(lado=>[0,-0.35,0.35].forEach(dWd=>bsFs.forEach(bsF=>{ if(bsF && !COM_MODELOS[mk].suite) return;
      const prm={fr:fm.fr, ax:fm.ax, dn:fm.dn, lado, dWd, bsF}, L=comGera(P, u, mk, {...prm, cortes:{}}, ctx, st); n++;
      if(L && mks.length>1 && COM_MODELOS[mk].suite) L.score+=8;   // com suíte, quando cabe
      if(L && (!best || L.score>best.score+1e-9)) best={...L, frame:fm.fr, prm} }))));
  });
  if(!best) return null;
  best.nVar=n; finaliza(best); _comCache.set(sigA, best);
  // ajuste manual: a variação escolhida no automático fica (não pula de arranjo ao arrastar); só os cortes mudam
  if(Object.keys(ov).length){ const L=comGera(P, u, best.mk, {...best.prm, cortes:ov}, ctx, st); if(L) best=finaliza({...L, frame:best.frame, prm:best.prm, nVar:n}) }
  _comCache.set(sig, best);
  return best;
}

/* forma enxuta guardada na unidade (sem referências cruzadas: viaja do Worker por structured clone) */
function comExporta(L){
  const idx=new Map(L.rooms.map((r,i)=>[r,i])), F=L.F;
  const seg=d=>{ const p0= d.ax==="x"? F.w(d.at,d.lo) : F.w(d.lo,d.at), p1= d.ax==="x"? F.w(d.at,d.hi) : F.w(d.hi,d.at); return [p0,p1] };
  return {
    modelo:L.mk, frame:L.frame, lado:F.lado, nVar:L.nVar, score:L.score, ok:L.ok, erros:L.erros, avisos:L.avisos, soma:L.soma,
    ax:F.ax, dn:F.dn, a0:F.a0, a1:F.a1, d0:F.d0, W:F.W, D:F.D,
    rooms:L.rooms.map(r=>({k:r.k, nome:r.k==="dorm"? `Dorm. ${r.n}` : COM_K[r.k].nome, longo:r.k==="dorm"? `Dormitório ${r.n}` : COM_K[r.k].longo, poly:r.poly, area:r.area, larg:r.larg, jan:r.jan||0, janReq:r.janReq||0, duto:!!r.duto,
      integ:!!r.integ, bordas:r.bordas.map(b=>({i:b.i,c:b.c})), alertas:r.alertas||[], c:G.centroid(r.poly), rc:F.w((r.x0+r.x1)/2,(r.y0+r.y1)/2)})),
    doors:L.doors.map(d=>{ const [p0,p1]=seg(d), into=d.into, s= d.ax==="x"? (into.x0>=d.at-1e-6? 1 : -1) : (into.y0>=d.at-1e-6? 1 : -1);
      const nl= d.ax==="x"? [s,0] : [0,s], n=[F.ax[0]*(F.lado==="b"?-nl[0]:nl[0])+F.dn[0]*nl[1], F.ax[1]*(F.lado==="b"?-nl[0]:nl[0])+F.dn[1]*nl[1]];
      return {k:d.k, p0, p1, n, hinge:d.hinge||"lo", from:idx.get(d.from), into:idx.get(into)} })
      .concat(L.entrada? [{k:"entrada", p0:L.entrada.p0, p1:L.entrada.p1, n:L.entrada.n, hinge:"lo", into:idx.get(L.entrada.room)}] : []),
    windows:L.windows.map(w=>({p0:w.p0, p1:w.p1, n:w.n, room:idx.get(w.room)})),
    movel:L.movel, divs:L.divs.map(d=>({id:d.id, ax:d.ax, p0:d.p0, p1:d.p1, lo:d.lo, hi:d.hi, v: d.ax==="x"? d.x : d.y})),
    cortes:L.cortes, alertas:L.alertas
  };
}

/* ---------- todas as unidades do pavimento tipo ---------- */
function comodosCalc(m, st){
  const out={unidades:0, validas:0, erros:0, avisos:0, porTipo:{}, lista:[]};
  (m.tipo||[]).forEach((lay,ti)=>{ if(!lay) return;
    const ctx={plate:(m.T[ti]||{}).plate||[], corridor:lay.corridor, core:lay.coreOut||lay.core}; ctx.sig=JSON.stringify([ctx.plate, ctx.corridor, ctx.core].map(p=>(p||[]).map(q=>[+q[0].toFixed(2),+q[1].toFixed(2)])));
    lay.units.forEach((u,ui)=>{ if(u.livre){ u.com=null; return }
      let L=null; try{ L=comUnidade(u, lay, st, ctx) }catch(e){ console.error("[comodos]", e) }
      if(!L){ u.com=null; return }
      if(st.comodos && st.comodos.on){ const sac=L.rooms.find(r=>r.k==="sacada"); if(sac && u.sac && u.sac.tipo!=="balanco"){ u.sac.poly=sac.poly; u.sac.area=sac.area } else comSacBalanco(L, u) }
      u.com=comExporta(L);
      out.unidades++; if(L.ok) out.validas++; out.erros+=L.erros; out.avisos+=L.avisos;
      const T=out.porTipo[u.nome]=out.porTipo[u.nome]||{nome:u.nome, modelo:L.mk, n:0, validas:0, ex:{ti,ui}};
      T.n++; if(L.ok) T.validas++;
      out.lista.push({ti, ui, nome:u.nome, ok:L.ok, alertas:L.alertas});
    });
  });
  // sacadas embutidas reposicionadas na frente da sala: refaz a soma (só informativa; a área vendável não muda)
  if(st.comodos && st.comodos.on){ m.sacA=0; (m.T||[]).forEach((t,i)=>{ const l=m.tipo[i]; if(l) l.units.forEach(u=>{ if(u.sac) m.sacA+=u.sac.area*t.tipoFloors }) }) }
  m.comodos=out; return out;
}
HOOK.compute.push((m, st, opt)=>{ if(opt && opt.quick && opt.layouts!==false) return; comodosCalc(m, st) });

/* quadro de áreas (para o inspetor, o PDF e os testes): por tipologia, a primeira unidade como representante */
function comQuadro(m){
  const out=[];
  Object.values((m.comodos||{}).porTipo||{}).forEach(T=>{ const lay=m.tipo[T.ex.ti], u=lay&&lay.units[T.ex.ui]; if(!u||!u.com) return;
    const rooms=u.com.rooms.slice().sort((a,b)=>{ const o=k=>["sala","sacada","cozinha","serv","desp","circ","suite","bsuite","closet","dorm","banho"].indexOf(k); return o(a.k)-o(b.k) || a.nome.localeCompare(b.nome) });
    out.push({nome:u.nome, modelo:COM_MODELOS[u.com.modelo].nome, area:u.area, alvo:u.alvo, n:T.n, validas:T.validas, rooms:rooms.map(r=>({nome:r.longo, k:r.k, area:r.area, larg:r.larg, st: r.alertas.some(a=>a.nivel==="erro")? "bad" : r.alertas.length? "warn" : "ok"})), soma:u.com.soma}) });
  return out;
}
/* página do PDF: quadro de áreas por cômodo (registrada em src/ui/comodos.js) */
async function comPdf(ctx){
  const m=ctx.m; if(!m || !m.comodos || !m.comodos.unidades) return;
  const Q=comQuadro(m); if(!Q.length) return;
  ctx.newPage(); ctx.h2("Quadro de áreas por cômodo");
  const doc=ctx.doc; doc.setFontSize(8.5); doc.setTextColor(...(ctx.mut||[93,106,106]));
  doc.text(ctx.T(`${m.comodos.validas} de ${m.comodos.unidades} unidades do pavimento tipo com cômodos válidos. Áreas de eixo a eixo (somam a área da unidade).`), ctx.M, ctx.y()); ctx.setY(ctx.y()+6);
  Q.forEach(q=>{ if(ctx.y()>235) ctx.newPage();
    doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(...(ctx.ink||[28,39,41])); doc.text(ctx.T(`${q.nome}  ·  ${q.modelo}  ·  ${q.validas} de ${q.n} unidades válidas`), ctx.M, ctx.y()); doc.setFont("helvetica","normal"); ctx.setY(ctx.y()+5);
    ctx.rows(q.rooms.map(r=>[r.nome, `${nf(r.area,2)} m²  ·  ${nf(r.larg,2)} m`, r.st]).concat([["Total da unidade", `${nf(q.soma,2)} m²`]]), {bold:["Total da unidade"]});
  });
  doc.setFontSize(7.5); doc.setTextColor(...(ctx.mut||[93,106,106])); if(ctx.y()<282) doc.text(ctx.T("Mínimos de referência (código de obras genérico) — conferir no código de obras do município. Iluminação e ventilação de no mínimo 1/"+((S.comodos&&S.comodos.jan&&S.comodos.jan.frac)||6)+" da área do piso."), ctx.M, Math.min(286, ctx.y()+2));
  ctx.setY(ctx.y()+8);
}

/* ---------- exportação (puras: recebem o construtor do DXF / devolvem geometria) ---------- */
function comArco(c, r, a0, a1, n=8){ const out=[]; for(let i=0;i<=n;i++){ const a=a0+(a1-a0)*i/n; out.push([c[0]+r*Math.cos(a), c[1]+r*Math.sin(a)]) } return out }
/* DXF por camada: PAREDES (faces internas dos cômodos e face externa da unidade), PORTAS, JANELAS, MOBILIARIO, TEXTOS */
function comDxf(d, lay){
  (lay.units||[]).forEach(u=>{ const c=u.com; if(!c) return;
    d.poly("PAREDES", u.poly, 7);
    c.rooms.forEach(r=>{ const ins=comInsetRoom(r);
      d.poly(r.k==="sacada"? "GUARDA-CORPO" : "PAREDES", ins, r.k==="sacada"? 4 : 7);
      const p=G.pip(r.c, r.poly)? r.c : r.rc; d.text("TEXTOS", p, 0.22, r.longo||r.nome); d.text("TEXTOS", [p[0], p[1]-0.32], 0.16, `${nf(r.area,2)} m2`) });
    c.doors.forEach(dr=>{ if(dr.k==="vao"||dr.k==="integ") return;
      if(dr.k==="pj"){ d.poly("JANELAS",[dr.p0,dr.p1],5); return }
      const H= dr.hinge==="hi"? dr.p1 : dr.p0, O= dr.hinge==="hi"? dr.p0 : dr.p1, w=Math.hypot(O[0]-H[0],O[1]-H[1]), L=[H[0]+dr.n[0]*w, H[1]+dr.n[1]*w];
      d.poly("PORTAS",[H,L],3); const a0=Math.atan2(L[1]-H[1],L[0]-H[0]); let da=Math.atan2(O[1]-H[1],O[0]-H[0])-a0; while(da>Math.PI) da-=2*Math.PI; while(da<-Math.PI) da+=2*Math.PI; d.poly("PORTAS", comArco(H,w,a0,a0+da), 3) });
    c.windows.forEach(wd=>{ const t=COM_WALL.fachada, nI=[-wd.n[0],-wd.n[1]], o=k=>[[wd.p0[0]+nI[0]*k, wd.p0[1]+nI[1]*k],[wd.p1[0]+nI[0]*k, wd.p1[1]+nI[1]*k]];
      d.poly("JANELAS", o(t*0.38), 5); d.poly("JANELAS", o(t*0.62), 5) });
    (c.movel||[]).forEach(f=>{ if(f.t==="c") d.poly("MOBILIARIO", comArco(f.c, f.r, 0, 2*Math.PI, 16).slice(0,-1), 8); else d.poly("MOBILIARIO", f.pts, 8) });
  });
}
/* paredes como retângulos (IFC): externas recuadas para dentro da unidade, internas centradas e sem repetição */
function comParedes(u){
  const c=u.com, out=[]; if(!c) return out;
  const P=comLimpa(u.poly), s=G.sArea(P)>0?1:-1;
  const rect=(a,b,n,t0,t1)=>[[a[0]+n[0]*t0,a[1]+n[1]*t0],[b[0]+n[0]*t0,b[1]+n[1]*t0],[b[0]+n[0]*t1,b[1]+n[1]*t1],[a[0]+n[0]*t1,a[1]+n[1]*t1]];
  c.rooms.forEach(r=>{ const cls=comEdgeClsPuro(r), p=r.poly, rs=G.sArea(p)>0?1:-1;
    for(let i=0;i<p.length;i++){ const a=p[i], b=p[(i+1)%p.length], L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<0.05) continue; const k=cls[i]||"interna", nIn= rs>0? [-(b[1]-a[1])/L,(b[0]-a[0])/L] : [(b[1]-a[1])/L,-(b[0]-a[0])/L];
      if(k==="interna"){ const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2], key=mid.map(v=>Math.round(v*20)).join(","); if(out.some(w=>w.key===key)) continue; out.push({key, tipo:"interna", poly:rect(a,b,nIn,-0.06,0.06), len:L}) }
      else { const t= k==="fachada"? (r.k==="sacada"? COM_WALL.guarda : COM_WALL.fachada) : COM_WALL[k]; out.push({key:null, tipo: k==="fachada"? (r.k==="sacada"? "guarda" : "fachada") : "divisa", poly:rect(a,b,nIn,0,t), len:L}) } } });
  return out;
}
function comEdgeClsPuro(r){ const pr={fachada:4, corredor:3, nucleo:3, divisa:3, interna:1}, cls=[]; (r.bordas||[]).forEach(b=>{ if(!cls[b.i] || pr[b.c]>pr[cls[b.i]]) cls[b.i]=b.c }); return cls }
/* contorno interno do cômodo (face das paredes): recuo por aresta conforme o vizinho */
function comInsetRoom(r){ const cls=comEdgeClsPuro(r); return comInset(r.poly, i=>{ const c=cls[i]||"interna"; return c==="fachada"? (r.k==="sacada"? COM_WALL.guarda : COM_WALL.fachada) : COM_WALL[c]||COM_WALL.interna }) }
