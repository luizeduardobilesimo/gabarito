/* ================= Fase C3 — pavimento tipo por alas (L, U, T, H, pátio) =================
   O motor do pavimento tipo (tipoLayout, src/layout.js) assume planta quase retangular. Quando a planta desenhada de uma
   torre (ou de um bloco da pilha) é ortogonal e recortada — L, U, T, H, pátio ou outra composição de retângulos —, este
   módulo monta o pavimento por ALAS, reaproveitando as peças do motor atual (coreSeq/coreBuild para o núcleo):
     1. grade: a planta (e os pátios) no referencial do lado mais longo; as coordenadas dos vértices formam uma grade de
        células; cada célula dentro da planta é um trecho de ala (liga-se à vizinha na horizontal e/ou na vertical);
     2. corredor contínuo: uma faixa de largura `corr` no eixo de cada ala (ala larga = corredor central, unidades dos dois
        lados; ala estreita = corredor do lado de dentro, unidades para fora), dobrando nos cantos (L, U, pátio) e cruzando
        nos nós (T, H). O corredor vai até a fachada na ponta das alas, como no tipoLayout;
     3. faixas de unidades: de cada lado de cada trecho reto de corredor, entre o corredor e a fachada; as sobras dos nós
        (canto externo, quadrado interno sem fachada) são absorvidas pela faixa colinear (unidade de canto com duas
        fachadas; o quadrado sem fachada vai para o núcleo ou para a unidade vizinha, que mantém ≥ 3 m de fachada);
     4. núcleo: testado no começo, no fim e no meio de cada faixa (frente no corredor) e escolhido pela menor distância a
        percorrer até a escada pelo corredor + o mínimo de fachada gasta (prefere o quadrado sem fachada do nó);
     5. distância até a escada pelo caminho real (normaDistTipo, src/calc/normas.js); passando do limite da saída única
        (IN 09 CBMSC), S.alas.esc2 põe uma SEGUNDA escada (antecâmara + escada) na ponta da ala mais distante;
     6. unidades: as do mix, distribuídas pelas faixas na proporção da área (como no tipoLayout) e cortadas na ordem do mix,
        cada uma com ≥ 3 m de fachada e ≥ 1 m de corredor; sacadas na fachada da própria unidade.
   Planta retangular (ou quase: ≥ 85% do retângulo envolvente) e planta com lados inclinados seguem no tipoLayout — os
   estudos de referência não mudam. Os blocos da pilha (C2) que não são o de referência usam o mesmo núcleo (fixo) e as
   mesmas linhas de corredor do bloco de referência (alasLayFaixa), para o núcleo e o corredor subirem alinhados.
   Puro (sem DOM). Saída no formato do tipoLayout + lay.alas = {forma, alas, pu, pv, dist, lim, esc2, …}. */
extendDEF("alas", { on:true, esc2:true, recuaTodas:false });
const ALAS_SNAP = 0.08, ALAS_FAC = 3.0, ALAS_COR = 1.0, ALAS_MINW = 2.6;

/* ---------- 1. grade ---------- */
function alasGrade(outer, holes, ux0){
  if(!outer || outer.length<3) return null;
  const ux = ux0 || G.longestDir(outer), vy=[-ux[1], ux[0]];
  const loc = q=>[q[0]*ux[0]+q[1]*ux[1], q[0]*vy[0]+q[1]*vy[1]];
  const rings=[outer, ...(holes||[])].map(r=>r.map(loc));
  for(const r of rings) for(let i=0;i<r.length;i++){ const a=r[i], b=r[(i+1)%r.length], du=Math.abs(b[0]-a[0]), dv=Math.abs(b[1]-a[1]), l=Math.hypot(du,dv);
    if(l<0.05) continue; if(Math.min(du,dv) > Math.max(0.06, 0.015*l)) return null }   // lado inclinado
  const clus = vals=>{ const s=vals.slice().sort((a,b)=>a-b), out=[]; let g=[s[0]];
    for(let i=1;i<s.length;i++){ if(s[i]-g[g.length-1]<=ALAS_SNAP) g.push(s[i]); else { out.push(g.reduce((a,b)=>a+b,0)/g.length); g=[s[i]] } }
    out.push(g.reduce((a,b)=>a+b,0)/g.length); return out };
  const us=clus(rings.flatMap(r=>r.map(q=>q[0]))), vs=clus(rings.flatMap(r=>r.map(q=>q[1])));
  const snap=(arr,x)=>arr.reduce((b,y)=>Math.abs(y-x)<Math.abs(b-x)? y : b, arr[0]);
  const R=rings.map(r=>r.map(q=>[snap(us,q[0]), snap(vs,q[1])]));
  const ni=us.length-1, nj=vs.length-1; if(ni<1 || nj<1) return null;
  const inn=[]; for(let i=0;i<ni;i++){ inn.push([]); for(let j=0;j<nj;j++){ const c=[(us[i]+us[i+1])/2, (vs[j]+vs[j+1])/2]; inn[i].push(G.pip(c,R[0]) && !R.slice(1).some(h=>G.pip(c,h))) } }
  return {ux, vy, loc, W:(u,v)=>[ux[0]*u+vy[0]*v, ux[1]*u+vy[1]*v], us, vs, ni, nj, inn, R, nHoles:(holes||[]).length};
}
/* a planta pede layout por alas? null = não (retangular, inclinada…), {falha} = forma de alas que não se resolve, {g, forma} = sim */
function alasDetecta(plate, oco, fix){
  const outer = oco ? oco.pts : plate, holes = oco ? oco.vazios||[] : [];
  if(!outer || outer.length<3) return null;
  const g=alasGrade(outer, holes, fix && fix.ux);
  if(!g) return fix ? {falha:"forma com lados inclinados"} : null;
  let n=0; const cells=[]; for(let i=0;i<g.ni;i++) for(let j=0;j<g.nj;j++) if(g.inn[i][j]){ n++; cells.push([i,j]) }
  if(!n) return null;
  const Abb=(g.us[g.ni]-g.us[0])*(g.vs[g.nj]-g.vs[0]), Ap=G.area(outer)-holes.reduce((s,h)=>s+G.area(h),0);
  if(!fix && !holes.length && (n===g.ni*g.nj || Ap/Abb>=0.85)) return null;   // retangular ou quase: tipoLayout
  // uma peça só (células ligadas pelos lados)
  const seen=new Set([cells[0].join()]), fila=[cells[0]];
  while(fila.length){ const [i,j]=fila.pop(); [[1,0],[-1,0],[0,1],[0,-1]].forEach(([a,b])=>{ const p=i+a, q=j+b; if(p>=0&&q>=0&&p<g.ni&&q<g.nj&&g.inn[p][q]&&!seen.has(p+","+q)){ seen.add(p+","+q); fila.push([p,q]) } }) }
  if(seen.size<n) return {falha:"a forma tem partes soltas"};
  for(const [i,j] of cells){ if(g.us[i+1]-g.us[i]<1.2 || g.vs[j+1]-g.vs[j]<1.2) return {falha:"a forma tem recortes menores que 1,2 m"} }
  // nome da forma: pátio, L (1 canto), U (2 cantos), T (1 nó), H (2 nós)
  const deg=(i,j)=>{ const nb=[[1,0],[-1,0],[0,1],[0,-1]].map(([a,b])=>{ const p=i+a, q=j+b; return p>=0&&q>=0&&p<g.ni&&q<g.nj&&g.inn[p][q] }); return {h:nb[0]||nb[1], v:nb[2]||nb[3], n:nb.filter(Boolean).length} };
  let cantos=0, nos=0; cells.forEach(([i,j])=>{ const d=deg(i,j); if(d.h && d.v){ if(d.n>=3) nos++; else cantos++ } });
  const forma = holes.length ? "pátio" : nos===0 && cantos===1 ? "L" : nos===0 && cantos===2 ? "U" : nos===1 && cantos===0 ? "T" : nos===2 && cantos===0 ? "H" : n===1 ? "retângulo" : "composta";
  return {g, forma, cells};
}

/* ---------- 2. corredor ---------- */
function alasCorredor(g, o, fix){
  const c=o.corr/2, need=2*o.profMin+o.corr-0.3, uMid=(g.us[0]+g.us[g.ni])/2, vMid=(g.vs[0]+g.vs[g.nj])/2;
  const pick=(a,b,mid,fl)=>{ const t=b-a, dbl = o.planta==="central" ? true : o.planta==="lateral" ? false : t>=need;
    let p = dbl || t<o.corr+3 ? (a+b)/2 : ((a+b)/2 < mid-1e-6 ? b-c : a+c);   // ala estreita: corredor do lado de dentro
    if(fl && fl.length){ const ok=fl.filter(x=>x>=a+c-1e-6 && x<=b-c+1e-6); if(ok.length) p=ok.reduce((bb,x)=>Math.abs(x-p)<Math.abs(bb-p)? x : bb, ok[0]) }
    return p };
  const pv=[], pu=[]; for(let j=0;j<g.nj;j++) pv.push(pick(g.vs[j],g.vs[j+1],vMid,fix&&fix.H)); for(let i=0;i<g.ni;i++) pu.push(pick(g.us[i],g.us[i+1],uMid,fix&&fix.V));
  const inn=(i,j)=>i>=0&&j>=0&&i<g.ni&&j<g.nj&&g.inn[i][j], strips=[];
  for(let i=0;i<g.ni;i++) for(let j=0;j<g.nj;j++){ if(!g.inn[i][j]) continue;
    const L=inn(i-1,j), R=inn(i+1,j), D=inn(i,j-1), U=inn(i,j+1); let H=L||R, V=D||U;
    if(!H && !V){ const du=g.us[i+1]-g.us[i], dv=g.vs[j+1]-g.vs[j], fH=fix&&fix.H&&fix.H.some(x=>x>g.vs[j]+c&&x<g.vs[j+1]-c), fV=fix&&fix.V&&fix.V.some(x=>x>g.us[i]+c&&x<g.us[i+1]-c);
      if(fH && !fV) H=true; else if(fV && !fH) V=true; else if(du>=dv) H=true; else V=true }
    if(H) strips.push({o:"h", i, j, u0:(L||!V)? g.us[i] : pu[i]-c, u1:(R||!V)? g.us[i+1] : pu[i]+c, v0:pv[j]-c, v1:pv[j]+c});
    if(V) strips.push({o:"v", i, j, u0:pu[i]-c, u1:pu[i]+c, v0:(D||!H)? g.vs[j] : pv[j]-c, v1:(U||!H)? g.vs[j+1] : pv[j]+c});
  }
  // trechos retos (corridas): faixas contíguas da mesma linha
  const runs=[];
  ["h","v"].forEach(or=>{ const S=strips.filter(s=>s.o===or), key=s=>or==="h"? s.j : s.i, a0=s=>or==="h"? s.u0 : s.v0, a1=s=>or==="h"? s.u1 : s.v1;
    [...new Set(S.map(key))].forEach(k=>{ const L=S.filter(s=>key(s)===k).sort((p,q)=>a0(p)-a0(q)); let cur=null;
      L.forEach(s=>{ if(cur && Math.abs(a0(s)-cur.x1)<1e-6){ cur.x1=a1(s); cur.cells.push(s) } else { cur={o:or, k, x0:a0(s), x1:a1(s), p: or==="h"? pv[k] : pu[k], cells:[s]}; runs.push(cur) } }) }) });
  return {pu, pv, c, strips, runs};
}

/* ---------- 3. malha fina (linhas da grade + bordas do corredor e dos obstáculos fixos) ---------- */
function alasMalha(g, K, fixos){
  const lim=(arr,a,b)=>arr.filter(x=>x>=a-1e-6 && x<=b+1e-6);
  const un=arr=>{ const s=arr.slice().sort((a,b)=>a-b), o=[]; s.forEach(x=>{ if(!o.length || x-o[o.length-1]>0.02) o.push(x) }); return o };
  const fx=fixos.map(f=>({...f, L:f.poly.map(g.loc)}));
  const fu=un(lim([...g.us, ...K.strips.flatMap(s=>[s.u0,s.u1]), ...fx.flatMap(f=>f.L.map(q=>q[0]))], g.us[0], g.us[g.ni]));
  const fv=un(lim([...g.vs, ...K.strips.flatMap(s=>[s.v0,s.v1]), ...fx.flatMap(f=>f.L.map(q=>q[1]))], g.vs[0], g.vs[g.nj]));
  const NA=fu.length-1, NB=fv.length-1, st=new Int8Array(NA*NB), cl=new Int16Array(NA*NB).fill(-1);
  const ci=a=>{ const x=(fu[a]+fu[a+1])/2; let i=0; while(i<g.ni-1 && x>g.us[i+1]) i++; return i }, cj=b=>{ const y=(fv[b]+fv[b+1])/2; let j=0; while(j<g.nj-1 && y>g.vs[j+1]) j++; return j };
  const CI=[...Array(NA)].map((_,a)=>ci(a)), CJ=[...Array(NB)].map((_,b)=>cj(b));
  for(let b=0;b<NB;b++) for(let a=0;a<NA;a++){ const k=b*NA+a; if(!g.inn[CI[a]][CJ[b]]){ st[k]=0; continue }
    const x=(fu[a]+fu[a+1])/2, y=(fv[b]+fv[b+1])/2, f=fx.find(f=>G.pip([x,y], f.L));
    st[k] = f ? f.st : K.strips.some(s=>x>s.u0&&x<s.u1&&y>s.v0&&y<s.v1) ? 2 : 1 }
  return {fu, fv, NA, NB, st, cl, idx:(a,b)=>b*NA+a};
}
/* ---------- 4. faixas de unidades ---------- */
// faixa: o ("h": ao longo de u · "v": ao longo de v), k0..k1 = índices ao longo, r0..r1 = índices na largura, hi = corredor do lado alto da largura
function alasFaixas(Mf, K){
  const {NA, NB, st, cl, idx}=Mf, bands=[];
  const cell=(o,k,r)=> o==="h"? idx(k,r) : idx(r,k), nAl=o=>o==="h"? NA : NB, nCr=o=>o==="h"? NB : NA, al=o=>o==="h"? Mf.fu : Mf.fv, cr=o=>o==="h"? Mf.fv : Mf.fu;
  const livre=(o,k,r0,r1)=>{ if(k<0 || k>=nAl(o)) return false; for(let r=r0;r<=r1;r++){ const q=cell(o,k,r); if(st[q]!==1 || cl[q]>=0) return false } return true };
  const ix=(arr,lo,hi)=>{ const out=[]; for(let i=0;i<arr.length-1;i++) if(arr[i]>=lo-1e-6 && arr[i+1]<=hi+1e-6) out.push(i); return out };
  K.runs.slice().sort((p,q)=>(q.x1-q.x0)-(p.x1-p.x0)).forEach(run=>{ const o=run.o, A=al(o), C=cr(o), Lg = o==="h"? K.g.vs : K.g.us, lo=Lg[run.k], hi=Lg[run.k+1];
    const ks=ix(A, run.x0, run.x1); if(!ks.length) return;
    // os dois lados do corredor, cada um da borda da ala (linha/coluna da grade) até o corredor
    [["lo", ix(C, lo, run.p-K.c)], ["hi", ix(C, run.p+K.c, hi)]].forEach(([lado, rr])=>{
      if(!rr.length) return; const r0=rr[0], r1=rr[rr.length-1];
      let cur=null; const fecha=()=>{ if(cur){ bands.push(cur); for(let k=cur.k0;k<=cur.k1;k++) for(let r=r0;r<=r1;r++) cl[cell(o,k,r)]=bands.length-1; cur=null } };
      ks.forEach(k=>{ if(livre(o,k,r0,r1)){ if(cur && cur.k1===k-1) cur.k1=k; else { fecha(); cur={o, k0:k, k1:k, r0, r1, hi: lado==="lo"} } } else fecha() }); fecha();
    });
  });
  // sobras dos nós: cada faixa cresce pelas pontas enquanto a fatia inteira estiver livre (as mais longas primeiro)
  bands.map((b,i)=>({b,i})).sort((p,q)=>(q.b.k1-q.b.k0)-(p.b.k1-p.b.k0)).forEach(({b,i})=>{
    while(livre(b.o,b.k0-1,b.r0,b.r1)){ b.k0--; for(let r=b.r0;r<=b.r1;r++) cl[cell(b.o,b.k0,r)]=i }
    while(livre(b.o,b.k1+1,b.r0,b.r1)){ b.k1++; for(let r=b.r0;r<=b.r1;r++) cl[cell(b.o,b.k1,r)]=i } });
  return bands;
}

/* geometria e perfis de uma faixa no referencial dela: A (ao longo), B (largura, B = A girado 90°), x0..x1, y0..y1,
   lado do corredor, trechos com fachada e com corredor, fachadas das pontas */
function alasFaixaGeo(Mf, g, b){
  const {NA, NB, st, idx}=Mf, o=b.o, A = o==="h"? g.ux : g.vy, B = o==="h"? g.vy : [-g.ux[0], -g.ux[1]];
  const al = o==="h"? Mf.fu : Mf.fv, cr = o==="h"? Mf.fv : Mf.fu, nAl = o==="h"? NA : NB, nCr = o==="h"? NB : NA;
  const S=(k,r)=>{ if(k<0||r<0||k>=nAl||r>=nCr) return 0; return st[o==="h"? idx(k,r) : idx(r,k)] };
  const x0=al[b.k0], x1=al[b.k1+1], c0=cr[b.r0], c1=cr[b.r1+1];
  const y0 = o==="h"? c0 : -c1, y1 = o==="h"? c1 : -c0;
  // hi = corredor do lado alto na largura LOCAL; no referencial da faixa (B = −u nas faixas "v") o lado inverte
  const corrMax = o==="h"? b.hi : !b.hi;
  const rNear = b.hi ? b.r1+1 : b.r0-1, rFar = b.hi ? b.r0-1 : b.r1+1;
  const fac=[], cor=[];
  for(let k=b.k0;k<=b.k1;k++){ const a=al[k], z=al[k+1]; if(S(k,rFar)===0) fac.push([a,z]); if(S(k,rNear)===2) cor.push([a,z]) }
  const ponta=k=>{ let s=0; for(let r=b.r0;r<=b.r1;r++) if(S(k,r)===0) s+=cr[r+1]-cr[r]; return s };
  const junta=L=>{ const o=[]; L.forEach(([a,z])=>{ const q=o[o.length-1]; if(q && Math.abs(q[1]-a)<1e-6) q[1]=z; else o.push([a,z]) }); return o };
  return {o, A, B, x0, x1, y0, y1, h:y1-y0, corrMax, fac:junta(fac), cor:junta(cor), f0:ponta(b.k0-1), f1:ponta(b.k1+1),
    W:(x,y)=>[A[0]*x+B[0]*y, A[1]*x+B[1]*y]};
}
const alasMede = (L, a, z) => L.reduce((s,[p,q])=>s+Math.max(0, Math.min(q,z)-Math.max(p,a)), 0);
const alasFacU = (F, a, z) => alasMede(F.fac, a, z) + (a<=F.x0+1e-6? F.f0 : 0) + (z>=F.x1-1e-6? F.f1 : 0);

/* ---------- 5. cortes das unidades numa faixa (área-alvo, ≥ 3 m de fachada e ≥ 1 m de corredor por unidade) ---------- */
function alasCortes(F, alvos){
  const n=alvos.length, x0=F.x0, x1=F.x1, ok=(a,z)=>z-a>=ALAS_MINW-1e-6 && alasFacU(F,a,z)>=ALAS_FAC-1e-6 && alasMede(F.cor,a,z)>=ALAS_COR-1e-6;
  if(!n) return [];
  const c=[x0]; let x=x0;
  for(let k=0;k<n-1;k++){ const rest=alvos.slice(k).reduce((s,a)=>s+a,0), ideal=x+(x1-x)*alvos[k]/rest, m=n-k-1;
    let lo=x+ALAS_MINW; while(lo<x1 && !ok(x,lo)) lo+=0.05;
    let hi=x1-m*ALAS_MINW; while(hi>x && !(alasFacU(F,hi,x1)>=m*ALAS_FAC-1e-6 && alasMede(F.cor,hi,x1)>=m*ALAS_COR-1e-6)) hi-=0.05;
    if(lo>hi+1e-6) return null;
    x=Math.min(hi, Math.max(lo, ideal)); c.push(x) }
  if(!ok(x, x1)) return null;
  c.push(x1); return c;
}

/* ---------- núcleo e segunda escada ---------- */
function alasNucleoL(o){ return coreBuild([1,0],[0,1],0,0,1,CORE_B,o).L }
/* sequência da segunda escada (só a escada e a antecâmara, sem elevadores), para o coreBuild (coreSeq aceita o._seq) */
function alasSeqEsc2(o){
  const t=o.escTipo||"pf_duto", W=5.8, sh=w=>({k:"shaft", nome:"shafts", w, door:"hall"});
  if(t==="pf_balcao") return {front:[{k:"pass",nome:"acesso",w:2.2,door:"hall",door2:"balc"}, sh(5.8)], back:[{k:"balc",nome:"balcão aberto",w:2.2,doorSide:"esc"},{k:"esc",nome:"escada 2",w:W}], g2:null};
  if(t==="pf_press") return {front:[{k:"ant",nome:"antecâmara",w:2.2,door:"hall",door2:"esc"}, sh(4.6)], back:[{k:"esc",nome:"escada 2",w:W},{k:"duto",nome:"pressurização",w:1.0}], g2:null};
  if(t==="ep") return {front:[{k:"ant",nome:"hall da escada",w:1.8,door:"hall",door2:"esc"}, sh(4.0)], back:[{k:"esc",nome:"escada 2",w:W}], g2:null};
  return {front:[{k:"ant",nome:"antecâmara",w:2.2,door:"hall",door2:"esc"},{k:"duto",nome:"dutos",w:0.8}, sh(2.8)], back:[{k:"esc",nome:"escada 2",w:W}], g2:null};
}
/* peça (núcleo ou escada 2) numa faixa: x = início ao longo da faixa, mir = escada na ponta alta */
function alasPeca(F, x, L, o, mir, esc2){
  // sobra atrás do núcleo < 2 m: o núcleo vai até a fachada; maior: vira extensão das unidades vizinhas (alasAbsorve)
  const D = F.h-(CORE_F+CORE_B)<2.0 ? F.h : CORE_F+CORE_B, depthB=D-CORE_F, vEdge=F.corrMax? F.y1 : F.y0, s=F.corrMax? -1 : 1;
  const oo={...o, escada: mir? "D" : "E", escProf:false, _seq: esc2? alasSeqEsc2(o) : undefined};
  return coreBuild(F.A, F.B, x, vEdge, s, depthB, oo);
}

/* ---------- distância pelo corredor (malha de 0,5 m nas faixas de corredor, no referencial local) ---------- */
function alasRaster(g, K, cs=0.5){
  const bb=[g.us[0]-cs, g.vs[0]-cs, g.us[g.ni]+cs, g.vs[g.nj]+cs], G0=nrmGrade(bb, cs), ok=new Uint8Array(G0.N);
  for(let k=0;k<G0.N;k++){ const [x,y]=nrmCentro(G0,k); if(K.strips.some(s=>x>s.u0&&x<s.u1&&y>s.v0&&y<s.v1)) ok[k]=1 }
  return {G0, ok};
}
function alasDistDe(Ra, p){
  const {G0, ok}=Ra; let src=-1, bd=Infinity;
  for(let k=0;k<G0.N;k++){ if(!ok[k]) continue; const c=nrmCentro(G0,k), d=Math.hypot(c[0]-p[0], c[1]-p[1]); if(d<bd){ bd=d; src=k } }
  if(src<0) return {max:Infinity, todos:false};
  const {d}=nrmDijkstra(G0, ok, [src]); let mx=0, todos=true;
  for(let k=0;k<G0.N;k++) if(ok[k]){ if(!isFinite(d[k])) todos=false; else if(d[k]>mx) mx=d[k] }
  return {max:mx+bd, todos, d};
}

/* ---------- montagem ---------- */
function alasMonta(D, units, o, fix, nucleo, extras=[]){
  const g=D.g, K=alasCorredor(g, o, fix); K.g=g;
  const fixos=[]; if(nucleo) fixos.push({poly:nucleo.poly, st:3}); extras.forEach(e=>fixos.push({poly:e.poly, st:4}));
  const Mf=alasMalha(g, K, fixos), bands=alasFaixas(Mf, K);
  return {K, Mf, bands, F:bands.map(b=>alasFaixaGeo(Mf, g, b))};
}
/* candidatos a núcleo: começo, fim e meio de cada trecho da faixa com corredor na frente */
function alasCandidatos(M, Lc, o, Ra){
  const out=[], g=M.K.g, c=M.K.c;
  M.F.forEach((F,bi)=>{ if(F.h<CORE_F+CORE_B-0.01) return;
    F.cor.forEach(([p,q])=>{ if(q-p<Lc-1e-6) return;
      [[p,false,"ponta"],[q-Lc,true,"ponta"],[(p+q)/2-Lc/2,false,"meio"]].forEach(([x,mir,tipo])=>{
        const xd = mir? x+Lc-1.1 : x+1.1, yd = F.corrMax? F.y1+c : F.y0-c, wp=F.W(xd,yd), lp=g.loc(wp);
        const R=alasDistDe(Ra, lp); if(!R.todos) return;
        const facG=alasMede(F.fac, x, x+Lc), restA=x-F.x0, restB=F.x1-(x+Lc);
        const pen=(restA>0.05 && restA<ALAS_MINW? 4 : 0)+(restB>0.05 && restB<ALAS_MINW? 4 : 0);
        out.push({bi, x, mir, tipo, dist:R.max, facG, score:R.max+0.5*facG+pen}) }) }) });
  return out.sort((a,b)=>a.score-b.score);
}
/* unidades nas faixas + sacadas; devolve {units, livres, semLugar} */
function alasUnidades(M, units, o){
  const uso=M.F.map((F,i)=>({F, i, A:(F.x1-F.x0)*F.h, facL:alasFacU(F,F.x0,F.x1), corL:alasMede(F.cor,F.x0,F.x1)}));
  const R=uso.filter(r=>r.A>4 && r.facL>=ALAS_FAC && r.corL>=ALAS_COR && r.F.h>=2.4).map(r=>({...r, list:[], used:0}));
  const us=units.map((u,i)=>({...u,i})).sort((a,b)=>b.alvo-a.alvo), totalAlvo=us.reduce((s,u)=>s+u.alvo,0), totalA=R.reduce((s,r)=>s+r.A,0)||1;
  us.forEach(u=>{ let best=null, bs=-Infinity; R.forEach(r=>{ const s=r.A/totalA*totalAlvo-r.used-u.alvo*0.5; if(s>bs){ bs=s; best=r } }); if(best){ best.list.push(u); best.used+=u.alvo } });
  const out=[], livres=[], semLugar=[], sacTipo=o.sacTipo||"embutida", prof=o.sacProf||1.6, usados=new Set();
  R.forEach(r=>{ const F=r.F; if(!r.list.length) return; usados.add(r.i);
    r.list.sort((a,b)=>a.i-b.i);
    let L=r.list.slice(), cuts=alasCortes(F, L.map(u=>u.alvo));
    while(!cuts && L.length>1){ const j=L.reduce((b,u,k)=>u.alvo<L[b].alvo? k : b, 0); semLugar.push(L[j]); L.splice(j,1); cuts=alasCortes(F, L.map(u=>u.alvo)) }
    if(!cuts){ semLugar.push(...L); usados.delete(r.i); return }
    L.forEach((u,j)=>{ const a=cuts[j], z=cuts[j+1], poly=G.rect(F.A,F.B,a,F.y0,z-a,F.h), fac=F.corrMax? "min" : "max";
      const un={poly, nome:u.nome, alvo:u.alvo, area:G.area(poly), fac, ux:F.A, vy:F.B, ala:r.i};
      Object.defineProperty(un, "_rs", {value:[alasLocR(F, a, z)], writable:true, enumerable:false});
      if(u.sac>0){ const fi=F.fac.map(([p,q])=>[Math.max(p,a),Math.min(q,z)]).filter(([p,q])=>q-p>0.5).sort((p,q)=>(q[1]-q[0])-(p[1]-p[0]))[0];
        if(fi){ const wU=fi[1]-fi[0], w=Math.max(1.2,Math.min(wU-1, u.sac/prof)), pr=u.sac/w, uc=(fi[0]+fi[1])/2;
          let va,vb; if(fac==="max"){ va= sacTipo==="balanco"? F.y1 : F.y1-pr; vb=va+pr } else { vb= sacTipo==="balanco"? F.y0 : F.y0+pr; va=vb-pr }
          let sp=G.rect(F.A,F.B,uc-w/2,va,w,vb-va); if(sacTipo!=="balanco") sp=G.clipToPoly(sp, poly);
          un.sac={poly:sp, area:G.area(sp), tipo:sacTipo} } }
      out.push(un) }) });
  // faixas sem unidade e células que sobraram viram "livre" (claramente identificado na planta)
  const lv=(p, r)=>{ const o={poly:p, nome:"livre", alvo:0, area:G.area(p), livre:true}; Object.defineProperty(o, "_r", {value:r, enumerable:false}); return o };
  M.F.forEach((F,i)=>{ if(!usados.has(i)) livres.push(lv(G.rect(F.A,F.B,F.x0,F.y0,F.x1-F.x0,F.h), alasLocR(F, F.x0, F.x1))) });
  const {NA, NB, st, cl, idx, fu, fv}=M.Mf, g=M.K.g, solto=(a,b)=>a<NA && b<NB && st[idx(a,b)]===1 && cl[idx(a,b)]===-1;
  for(let b=0;b<NB;b++) for(let a=0;a<NA;a++){ if(!solto(a,b)) continue;
    let a1=a; while(solto(a1+1,b)) a1++; let b1=b; for(;;){ let ok=true; for(let x=a;x<=a1;x++) if(!solto(x,b1+1)){ ok=false; break } if(!ok) break; b1++ }
    for(let y=b;y<=b1;y++) for(let x=a;x<=a1;x++) cl[idx(x,y)]=-2;
    const p=[g.W(fu[a],fv[b]), g.W(fu[a1+1],fv[b]), g.W(fu[a1+1],fv[b1+1]), g.W(fu[a],fv[b1+1])];
    if(G.area(p)>0.01) livres.push(lv(p, [fu[a], fu[a1+1], fv[b], fv[b1+1]])) }
  const U={units:out, livres, semLugar}; alasAbsorve(U, g); return U;
}
/* retângulo [u0,u1,v0,v1] (referencial local da planta) do trecho a..z de uma faixa */
function alasLocR(F, a, z){ return F.o==="h" ? [a, z, F.y0, F.y1] : [-F.y1, -F.y0, a, z] }
/* lado comum entre dois retângulos locais: {lado de r ('u0','u1','v0','v1'), comprimento} ou null */
function alasComum(r, s){
  const e=1e-4, ov=(a0,a1,b0,b1)=>Math.min(a1,b1)-Math.max(a0,b0);
  if(Math.abs(r[1]-s[0])<e){ const l=ov(r[2],r[3],s[2],s[3]); if(l>e) return {lado:"u1", len:l} }
  if(Math.abs(r[0]-s[1])<e){ const l=ov(r[2],r[3],s[2],s[3]); if(l>e) return {lado:"u0", len:l} }
  if(Math.abs(r[3]-s[2])<e){ const l=ov(r[0],r[1],s[0],s[1]); if(l>e) return {lado:"v1", len:l} }
  if(Math.abs(r[2]-s[3])<e){ const l=ov(r[0],r[1],s[0],s[1]); if(l>e) return {lado:"v0", len:l} }
  return null;
}
/* contorno da união de retângulos locais (no mundo) — unidade que abraça uma sobra fica em L */
function alasUniao(rs, g){
  const un=a=>[...new Set(a.map(x=>+x.toFixed(4)))].sort((p,q)=>p-q), fu=un(rs.flatMap(r=>[r[0],r[1]])), fv=un(rs.flatMap(r=>[r[2],r[3]]));
  const NA=fu.length-1, NB=fv.length-1, idx=(a,b)=>b*NA+a;
  const dentro=k=>{ const a=k%NA, b=(k-a)/NA, x=(fu[a]+fu[a+1])/2, y=(fv[b]+fv[b+1])/2; return rs.some(r=>x>r[0]&&x<r[1]&&y>r[2]&&y<r[3]) };
  const an=alasContorno({NA, NB, idx, fu, fv}, g, dentro).filter(r=>G.sArea(r)>0).sort((p,q)=>G.area(q)-G.area(p));
  return an[0] || [];
}
/* sobras ("livre") encostadas em unidades: uma sobra entre duas unidades (atrás do núcleo, por exemplo) se divide ao meio e
   cada metade vai para a unidade da sua ponta; senão vai inteira para a unidade com o maior lado comum. Limite: a unidade
   cresce no máximo 80% (sobra maior continua "livre", identificada na planta) */
function alasAbsorve(U, g){
  const fica=[], mud=new Set(), ext=new Map(), cabe=(u,A)=>(ext.get(u)||0)+A<=0.8*u.area;
  const junta=(u, r)=>{ u._rs=[...u._rs, r]; ext.set(u, (ext.get(u)||0)+(r[1]-r[0])*(r[3]-r[2])); mud.add(u) };
  U.livres.slice().sort((p,q)=>q.area-p.area).forEach(L=>{ const r=L._r; if(!r){ fica.push(L); return }
    const nb=[]; U.units.forEach(u=>u._rs.forEach(s=>{ const c=alasComum(r, s); if(c && c.len>=0.9) nb.push({u, ...c}) }));
    if(!nb.length){ fica.push(L); return }
    const longoU=(r[1]-r[0])>=(r[3]-r[2]), eA=longoU? "u0" : "v0", eB=longoU? "u1" : "v1", melhor=l=>l.sort((p,q)=>q.len-p.len)[0];
    const nA=melhor(nb.filter(n=>n.lado===eA)), nB=melhor(nb.filter(n=>n.lado===eB)), A=L.area;
    if(nA && nB && nA.u!==nB.u && cabe(nA.u, A/2) && cabe(nB.u, A/2)){
      const mid = longoU? (r[0]+r[1])/2 : (r[2]+r[3])/2;
      junta(nA.u, longoU? [r[0],mid,r[2],r[3]] : [r[0],r[1],r[2],mid]); junta(nB.u, longoU? [mid,r[1],r[2],r[3]] : [r[0],r[1],mid,r[3]]); return }
    const b=melhor(nb.filter(n=>cabe(n.u, A)));
    if(b) junta(b.u, r); else fica.push(L) });
  mud.forEach(u=>{ const p=alasUniao(u._rs, g); if(p.length>2){ u.poly=p; u.area=G.area(p) } });
  U.livres=fica;
}
/* contorno de um conjunto de células da malha fina (união): anéis no referencial do mundo (anti-horário = borda, horário = furo) */
function alasContorno(Mf, g, sel){
  const {NA, NB, idx, fu, fv}=Mf, inS=(a,b)=>a>=0&&b>=0&&a<NA&&b<NB&&sel(idx(a,b)), E=new Map(), key=(a,b)=>a+","+b;
  const add=(p,q)=>{ const k=key(...p); if(!E.has(k)) E.set(k,[]); E.get(k).push(q) };
  for(let b=0;b<NB;b++) for(let a=0;a<NA;a++){ if(!inS(a,b)) continue;
    if(!inS(a,b-1)) add([a,b],[a+1,b]); if(!inS(a+1,b)) add([a+1,b],[a+1,b+1]); if(!inS(a,b+1)) add([a+1,b+1],[a,b+1]); if(!inS(a-1,b)) add([a,b+1],[a,b]) }
  const rings=[];
  for(const [k0] of E){ while(E.get(k0) && E.get(k0).length){ const st=k0.split(",").map(Number); let cur=st, prev=null; const ring=[];
      for(let n=0;n<1e5;n++){ const L=E.get(key(...cur)); if(!L || !L.length) break; let j=0;
        if(L.length>1 && prev){ const din=[cur[0]-prev[0], cur[1]-prev[1]]; let bs=-Infinity; L.forEach((q,ii)=>{ const dq=[q[0]-cur[0], q[1]-cur[1]], cr=din[0]*dq[1]-din[1]*dq[0], dt=din[0]*dq[0]+din[1]*dq[1], s=cr>0? 2 : dt>0? 1 : 0; if(s>bs){ bs=s; j=ii } }) }
        const nx=L.splice(j,1)[0]; ring.push(cur); prev=cur; cur=nx; if(cur[0]===st[0] && cur[1]===st[1]) break }
      const pts=ring.filter((p,i)=>{ const a=ring[(i-1+ring.length)%ring.length], c=ring[(i+1)%ring.length]; return (p[0]-a[0])*(c[1]-p[1])-(p[1]-a[1])*(c[0]-p[0])!==0 }).map(([a,b])=>g.W(fu[a],fv[b]));
      if(pts.length>2) rings.push(pts) } }
  return rings;
}
/* o pavimento montado, no formato do tipoLayout */
function alasSaida(D, M, U, o, nucleo, extras, extra){
  const g=D.g, an=alasContorno(M.Mf, g, k=>M.Mf.st[k]===2);
  const outer=an.filter(r=>G.sArea(r)>0).sort((p,q)=>G.area(q)-G.area(p)), furos=an.filter(r=>G.sArea(r)<0);
  const corridor = outer.length ? (furos.length ? entPoly({pts:outer[0], vazios:furos}) : outer[0]) : [];
  const cells=[...nucleo.cells, ...extras.flatMap(e=>e.cells)];
  const cParts=cells.map(c=>({nome:c.nome, kind:c.k, poly:c.poly, area:G.area(c.poly)}));
  const kinds={}; cParts.forEach(c=>kinds[c.kind]=(kinds[c.kind]||0)+c.area);
  const units=[...U.units, ...U.livres], coreA=G.area(nucleo.poly)+extras.reduce((s,e)=>s+G.area(e.poly),0);
  const corrA=G.area(corridor), livreA=U.livres.reduce((s,u)=>s+u.area,0), unA=U.units.reduce((s,u)=>s+u.area,0);
  const dbl=M.K.runs.some(r=>{ const a = r.o==="h"? g.vs : g.us, i=a.findIndex((x,ii)=>ii<a.length-1 && r.p>x && r.p<a[ii+1]); return i>=0 && r.p-a[i]>M.K.c+2 && a[i+1]-r.p>M.K.c+2 });
  return {ux:g.ux, vy:g.vy, units, core:nucleo.poly, lobby:nucleo.lobby, coreParts:cParts,
    coreDoors:[...nucleo.doors, ...extras.flatMap(e=>e.doors)], coreLines:[...nucleo.lines, ...extras.flatMap(e=>e.lines)],
    corridor, corrAneis: furos.length ? [outer[0], ...furos] : null, dbl, hallEnds:[], coreA, coreKinds:kinds, fachada:!!o.fachada,
    coreOut:nucleo.poly, coreReserva:[], escSobra:0, coreExtra:extras.map(e=>e.poly), coreUx:nucleo.A, coreVy:nucleo.B, corrNucleo:nucleo.frente,
    alas:{forma:D.forma, alas:M.K.runs.length, pu:M.K.pu, pv:M.K.pv, c:M.K.c, corrA, coreA, livreA, unA, plateA:null,
      semLugar:U.semLugar.length, esc2:extras.length, nucleo:extra.nucleo||null, dist:null, lim:o.distMax||null, ...extra}};
}
/* núcleo pronto (coreBuild) → {poly, cells, doors, lines, lobby, A, B, frente} */
function alasPecaObj(CB, F, x, L, w=1.6){ const c=F.corrMax? F.y1 : F.y0, fr = F.corrMax? G.rect(F.A,F.B,x,c,L,w) : G.rect(F.A,F.B,x,c-w,L,w);
  return {poly:CB.poly, cells:CB.cells, doors:CB.doors, lines:CB.lines, lobby:CB.lobby, A:F.A, B:F.B, frente:fr} }

const _alasCache=new Map();
/* pavimento tipo por alas. fix (blocos da pilha) = {ux, H, V, ref} → núcleo e escada 2 do bloco de referência, corredor nas mesmas linhas.
   Devolve o layout, null (planta não é de alas) ou {falha:"motivo"} */
function alasLayout(plate, units, o, oco, fix){
  const D=alasDetecta(plate, oco, fix); if(!D || D.falha) return D;
  const r2=v=>Math.round(v*100)/100, sig=JSON.stringify([plate.map(q=>q.map(r2)), oco? [oco.pts, oco.vazios].map(r=>JSON.stringify(r)) : 0, units.map(u=>[u.nome, r2(u.alvo), u.sac]),
    ["corr","profMin","nElev","escTipo","nEsc","emerg","fachada","sacTipo","sacProf","planta","distMax","esc2"].map(k=>o[k]), fix? [fix.ux, fix.H, fix.V, fix.ref && fix.ref.core, fix.ref && fix.ref.coreExtra] : 0]);
  // cópia rasa por chamada: os cômodos (src/calc/comodos.js) gravam em u.com e u.sac de cada unidade
  const copia=l=>!l || l.falha ? l : {...l, units:l.units.map(u=>u.sac? {...u, sac:{...u.sac}} : {...u})};
  if(_alasCache.has(sig)) return copia(_alasCache.get(sig));
  const r=alasLayoutCalc(D, plate, units, o, oco, fix);
  if(_alasCache.size>60) _alasCache.clear(); _alasCache.set(sig, r); return copia(r);
}
function alasLayoutCalc(D, plate, units, o, oco, fix){
  const Lc=alasNucleoL(o);
  // bloco da pilha: núcleo (e escada 2) fixos, do bloco de referência
  if(fix && fix.ref){ const ref=fix.ref, nuc={poly:ref.core, cells:[], doors:ref.coreDoors, lines:ref.coreLines, lobby:ref.lobby, A:ref.coreUx||ref.ux, B:ref.coreVy||ref.vy, frente:ref.corrNucleo};
    const ex=(ref.coreExtra||[]).map(p=>({poly:p, cells:[], doors:[], lines:[]}));
    const M=alasMonta(D, units, o, fix, nuc, ex), U=alasUnidades(M, units, o);
    const lay=alasSaida(D, M, U, o, nuc, ex, {nucleo:"bloco de referência"});
    Object.assign(lay, {core:ref.core, lobby:ref.lobby, coreParts:ref.coreParts, coreDoors:ref.coreDoors, coreLines:ref.coreLines, coreOut:ref.coreOut, coreA:ref.coreA, coreKinds:ref.coreKinds, coreExtra:ref.coreExtra||[], blc:true});
    const R=normaDistTipo(lay, 0.5); if(!R || R.max==null || R.semAcesso.length) return {falha:"o núcleo do bloco de referência não fica no corredor deste bloco"};
    lay.alas.dist=R.max; return lay }
  // 1ª passada: faixas sem núcleo → candidatos
  const M0=alasMonta(D, units, o, fix, null), Ra=alasRaster(D.g, M0.K);
  const cand=alasCandidatos(M0, Lc, o, Ra);
  if(!cand.length) return {falha:"o núcleo não cabe nas alas (alas estreitas ou curtas para o núcleo e o corredor)", alas:true};
  // os melhores candidatos são montados de verdade; fica o de menor nota: distância até a escada + fachada gasta pelo
  // núcleo + área que sobrou sem uso + unidades sem lugar (todas as unidades precisam chegar à escada pelo corredor)
  const lim=o.distMax||30; let best=null;
  for(const cd of cand.slice(0,6)){
    const F=M0.F[cd.bi], CB=alasPeca(F, cd.x, Lc, o, cd.mir, false), nuc=alasPecaObj(CB, F, cd.x, Lc, o.corr);
    const M=alasMonta(D, units, o, fix, nuc), U=alasUnidades(M, units, o);
    const lay=alasSaida(D, M, U, o, nuc, [], {nucleo:cd.tipo});
    const R=normaDistTipo(lay, 0.5); if(!R || R.max==null || R.semAcesso.length) continue;
    const nota=R.max + 0.5*cd.facG + 0.3*lay.alas.livreA + 25*lay.alas.semLugar + (R.max>lim? 8 : 0);
    if(best && nota>=best.nota) continue;
    lay.alas.dist=R.max; lay.alas.pior=R.pior && R.pior.porta; best={lay, M, nuc, cd, nota} }
  if(!best) return {falha:"não achei posição de núcleo com acesso a todas as unidades", alas:true};
  // onde o núcleo ficou: no nó (canto / encontro das alas), na ponta ou no meio de uma ala
  { const g=D.g, L=best.nuc.poly.map(g.loc), u0=Math.min(...L.map(q=>q[0])), u1=Math.max(...L.map(q=>q[0])), v0=Math.min(...L.map(q=>q[1])), v1=Math.max(...L.map(q=>q[1]));
    const inn=(i,j)=>i>=0&&j>=0&&i<g.ni&&j<g.nj&&g.inn[i][j], no=D.cells.some(([i,j])=>(inn(i-1,j)||inn(i+1,j)) && (inn(i,j-1)||inn(i,j+1)) && u0<g.us[i+1]+0.3 && u1>g.us[i]-0.3 && v0<g.vs[j+1]+0.3 && v1>g.vs[j]-0.3);
    best.lay.alas.nucleo = no ? "nó" : best.cd.tipo==="meio" ? "meio" : "ponta" }
  // escadas extras (até 2) na ponta da ala mais distante, enquanto a distância passa do limite da saída única
  const dist0=best.lay.alas.dist, ex=[];
  for(let n=0; n<2 && o.esc2!==false && (o.nEsc||1)<2 && best.lay.alas.dist>lim+1e-6 && best.lay.alas.pior; n++){
    const P=D.g.loc(best.lay.alas.pior), Le=alasNucleoL({...o, _seq:alasSeqEsc2(o)});
    const opts=[]; best.M.F.forEach((F,bi)=>{ if(F.h<CORE_F+CORE_B-0.01) return; F.cor.forEach(([p,q])=>{ if(q-p<Le-1e-6) return;
      [[p,false],[q-Le,true]].forEach(([x,mir])=>{ const cx=F.W(x+Le/2,(F.y0+F.y1)/2), lc=D.g.loc(cx); opts.push({bi, x, mir, d:Math.hypot(lc[0]-P[0], lc[1]-P[1])}) }) }) });
    opts.sort((a,b)=>a.d-b.d); let ok=false;
    for(const op of opts.slice(0,4)){ const F=best.M.F[op.bi], CB=alasPeca(F, op.x, Le, o, op.mir, true), e2=alasPecaObj(CB, F, op.x, Le, o.corr);
      const M=alasMonta(D, units, o, fix, best.nuc, [...ex, e2]), U=alasUnidades(M, units, o);
      const lay=alasSaida(D, M, U, o, best.nuc, [...ex, e2], {nucleo:best.lay.alas.nucleo});
      const R=normaDistTipo(lay, 0.5); if(!R || R.max==null || R.semAcesso.length || R.max>=best.lay.alas.dist-0.5) continue;
      lay.alas.dist=R.max; lay.alas.distSem=dist0; lay.alas.pior=R.pior && R.pior.porta; ex.push(e2); best={...best, lay, M}; ok=true; break }
    if(!ok) break;
  }
  best.lay.alas.plateA=G.area(plate);
  return best.lay;
}
/* chamado pelo compute (src/model.js): torre desenhada (C1/C2) ou contorno ocupado (C0) com planta de alas → layout por ala */
function alasTipoLayout(plate, units, o, t, st){
  const usa = st && st.alas && st.alas.on!==false && t && (t.desenhada || (st.custom && st.custom.torOcupa)) && plate && plate.length>=3;
  if(!usa) return tipoLayout(plate, units, o);
  const lim = typeof normaDistLimite==="function" ? normaDistLimite(o.nEsc||1, st.normas && st.normas.chuveiros) : 30;
  let r=null; try{ r=alasLayout(plate, units, {...o, distMax:lim, esc2: st.alas.esc2!==false}, t.oco || null, null) }catch(e){ console.error("[alas]", e); r={falha:"erro no layout por ala", alas:true} }
  if(r && !r.falha) return r;
  const l=tipoLayout(plate, units, o); if(l && r && r.falha) l.alasFalha=r.falha;
  return l;
}
/* bloco da pilha (C2) que não é o de referência: corredor nas linhas do bloco de referência e o mesmo núcleo */
function alasLayFaixa(plate, oco, ref, list, o, st){
  if(!ref || !ref.core || !ref.core.length || (st && st.alas && st.alas.on===false)) return null;
  let H=[], V=[];
  if(ref.alas){ H=ref.alas.pv; V=ref.alas.pu }
  else if(ref.corridor && ref.corridor.length>2){ const [a,b]=G.extent(ref.corridor, ref.vy); H=[(a+b)/2] }
  const fix={ux:ref.ux, H, V, ref};
  // bloco retangular sob uma referência retangular: segue o blcLayFaixa (C2), como antes
  if(!ref.alas){ const D=alasDetecta(plate, oco, null); if(!D || D.falha) return null }
  let r=null; try{ r=alasLayout(plate, list, o, oco, fix) }catch(e){ console.error("[alas] faixa", e) }
  return r && !r.falha ? r : null;
}
/* avisos do layout por ala (m.avisos) e resumo por torre (m.alas) */
HOOK.compute.push((m, st)=>{
  if(!m.tipo || !(m.T||[]).some(t=>t.desenhada || m.torOcupa)) return;
  const out=[], res=[];
  m.tipo.forEach((l,i)=>{ if(!l) return; const nm=`torre ${i+1}`;
    if(l.alasFalha){ out.push(`Na ${nm}, a planta tem alas mas o pavimento tipo ficou aproximado: ${l.alasFalha}.`); return }
    const A=l.alas; if(!A) return; res.push({i, forma:A.forma, alas:A.alas, dist:A.dist, lim:A.lim, esc2:A.esc2, livreA:A.livreA, semLugar:A.semLugar});
    if(A.dist!=null && A.lim && A.dist>A.lim+1e-6) out.push(`Na ${nm} (${A.forma}), a unidade mais distante fica a ${nf(A.dist,1)} m da escada (limite ${nf(A.lim,0)} m)${A.esc2? ` mesmo com ${A.esc2>1? A.esc2+" escadas extras" : "a segunda escada"}` : ""} — encurte as alas, ${A.esc2? "mova o núcleo" : "ligue a segunda escada"} ou preveja chuveiros automáticos.`);
    if(A.semLugar) out.push(`Na ${nm} (${A.forma}), ${A.semLugar} unidade${A.semLugar>1?"s":""} do mix não coube${A.semLugar>1?"ram":""} nas alas com fachada e corredor — ajuste o mix ou a forma.`) });
  m.alas=res; if(m.avisos) m.avisos.push(...out);
});
