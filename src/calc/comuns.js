/* ================= Térreo, hall e áreas comuns: catálogo, programa, planta e validação (docs/COMUNS.md §3) =================
   Mesmo método das plantas de apartamento (docs/APTOS.md): regras de projeto + catálogo de ambientes + validação com nota e
   motivo + desenho fiel. Tudo puro (sem DOM): roda no Worker, na página e nos testes. Valores = referência genérica
   (NBR 9050, NBR 13523, códigos de obras usuais) — "conferir na lei".

   - CMN_CAT: catálogo de ambientes comuns (medida mínima = círculo inscrito, proporção, luz natural, adjacências, onde fica).
   - comunsPrograma(st, m) → ambientes pedidos: os de apoio (portaria, clausura, sanitários PCD, funcionários, DML, lixo, gás,
     medidores, bicicletário) + o lazer de S.produto.lazer (salão vira salão + copa; piscina ganha apoio e ducha).
   - comunsCalc(st, m) → m.comuns = {nota, problemas, amb[], circ{terreo,emb,…}, rota[], verde[], arvores[], falta[]}:
     térreo planejado numa malha de 0,30 m no referencial da frente (u ao longo da rua, v para dentro): clausura e portaria na
     fachada do acesso de pedestres, hall social com recepção atrás delas, galerias até o hall dos elevadores de cada torre,
     ambientes encostados nas paredes e nas fachadas e abertos para a circulação (nada solto no meio), sobras viram
     circulação ou área livre; lixo, gás e medidores no recuo junto ao alinhamento; paisagismo nos recuos; laje do
     embasamento com piscina (raias e prainha), solário ao sol, ducha, apoio, playground longe da água; pavimento de lazer e
     rooftop pelo mesmo planejador.
   - comunsValida(C, st, m) → {nota, problemas[{k, nivel, amb?, msg}]}: programa, medidas, proporção, luz natural, porta para
     a circulação, rota acessível ≥ 1,20 m sem atravessar ambientes, adjacências (salão ↔ copa ↔ sanitários, piscina ↔ ducha
     e sanitário, portaria ↔ acessos), gás e lixo, carro × pedestre. Nota = 100 − 25/grave − 6/atenção − área faltante.
   - comunsDxf(d, m, local) → camadas COMUNS-* (ambientes, portas, janelas, mobiliário, rota, paisagismo). */

extendDEF("comuns", { on:true, gas:"glp", funcionarios:true, bici:true, galeria:1.5 });

const CMN_RES = 0.24;               // malha: galeria de 7 células = 1,68 m; rota acessível mínima de 5 células = 1,20 m
const CMN_PAREDE = 0.12;            // meia parede desenhada por ambiente (parede de 0,15–0,25 m entre ambientes)
const CMN_JANELA_DIV = 1.5;         // abertura a menos de 1,5 m da divisa não vale (Código Civil, art. 1.301)
const CMN_NOTA = { bad:25, warn:6, area:0.5 };
/* catálogo: area = m² de referência (ou calculada no programa); d = menor medida (círculo inscrito), prop = proporção máxima,
   luz = "sim" (permanência: janela para fora) | "pref" (desejável) | "" ; grupo: acesso | apoio | servico | lazer | tecnico | externo;
   onde = "recuo" (no recuo, junto ao alinhamento) | "laje" ; cor = classe de cor no desenho; porta = largura */
const CMN_CAT = {
  clausura:  {nome:"Clausura", longo:"Clausura de pedestres (eclusa)", grupo:"acesso", d:1.8, prop:2.0, luz:"", cor:"hall", porta:1.0},
  portaria:  {nome:"Portaria", longo:"Portaria com sanitário", grupo:"acesso", d:2.2, prop:1.8, luz:"vista", cor:"apoio", porta:0.8},
  hall:      {nome:"Hall social", longo:"Hall social com recepção", grupo:"acesso", d:3.0, prop:3.2, luz:"pref", cor:"hall", porta:1.2},
  wc:        {nome:"Sanitários PCD", longo:"Sanitários acessíveis (fem. e masc.)", grupo:"apoio", d:1.5, prop:2.4, luz:"", cor:"molhado", porta:0.9},
  vest:      {nome:"Vestiários", longo:"Vestiários de funcionários (fem. e masc.)", grupo:"servico", d:1.8, prop:2.6, luz:"", cor:"molhado", porta:0.8},
  copaf:     {nome:"Copa func.", longo:"Copa de funcionários", grupo:"servico", d:1.8, prop:2.2, luz:"pref", cor:"servico", porta:0.8},
  dml:       {nome:"DML", longo:"DML e depósito do condomínio", grupo:"servico", d:1.2, prop:2.6, luz:"", cor:"servico", porta:0.8},
  bici:      {nome:"Bicicletário", longo:"Bicicletário", grupo:"servico", d:2.0, prop:3.5, luz:"", cor:"servico", porta:1.2},
  salao:     {nome:"Salão de festas", grupo:"lazer", d:5.0, prop:2.0, luz:"sim", cor:"lazer", porta:1.2, adj:["copa"], perto:["wc"]},
  copa:      {nome:"Copa", longo:"Copa do salão", grupo:"lazer", d:2.0, prop:2.6, luz:"", cor:"servico", porta:0.8},
  gourmet:   {nome:"Espaço gourmet", grupo:"lazer", d:4.0, prop:2.2, luz:"sim", cor:"lazer", porta:1.2, perto:["wc"]},
  academia:  {nome:"Academia", grupo:"lazer", d:4.0, prop:2.2, luz:"sim", cor:"lazer", porta:1.0},
  brinq:     {nome:"Brinquedoteca", grupo:"lazer", d:3.4, prop:1.8, luz:"sim", cor:"lazer", porta:1.0, perto:["wc"]},
  cowork:    {nome:"Coworking", grupo:"lazer", d:3.4, prop:2.2, luz:"sim", cor:"lazer", porta:1.0},
  lavand:    {nome:"Lavanderia", grupo:"lazer", d:2.4, prop:2.6, luz:"pref", cor:"servico", porta:0.9},
  jogos:     {nome:"Salão de jogos", grupo:"lazer", d:4.0, prop:2.0, luz:"sim", cor:"lazer", porta:1.0},
  cinema:    {nome:"Cinema", grupo:"lazer", d:4.0, prop:1.8, luz:"", cor:"lazer", porta:1.0},
  sauna:     {nome:"Sauna", grupo:"lazer", d:2.0, prop:2.0, luz:"", cor:"molhado", porta:0.8},
  outro:     {nome:"Ambiente", grupo:"lazer", d:3.0, prop:2.2, luz:"pref", cor:"lazer", porta:1.0},
  apoioPisc: {nome:"Apoio da piscina", longo:"Sanitário PCD e ducha da piscina", grupo:"apoio", d:1.6, prop:2.4, luz:"", cor:"molhado", porta:0.9},
  // descobertos
  piscina:   {nome:"Piscina", grupo:"externo", d:4.0, prop:3.2, luz:"", cor:"agua", desc:true},
  deck:      {nome:"Solário", longo:"Deck / solário", grupo:"externo", d:2.0, prop:4, luz:"", cor:"deck", desc:true},
  playground:{nome:"Playground", grupo:"externo", d:4.5, prop:2.0, luz:"", cor:"play", desc:true},
  pet:       {nome:"Pet place", grupo:"externo", d:4.0, prop:2.4, luz:"", cor:"verde", desc:true},
  quadra:    {nome:"Quadra", grupo:"externo", d:8.0, prop:2.0, luz:"", cor:"quadra", desc:true},
  externo:   {nome:"Área externa", grupo:"externo", d:3.0, prop:2.4, luz:"", cor:"deck", desc:true},
  // no recuo, junto ao alinhamento
  lixo:      {nome:"Lixo", longo:"Abrigo de resíduos", grupo:"tecnico", d:1.4, prop:3.2, luz:"", cor:"tecnico", onde:"recuo", porta:1.2},
  gas:       {nome:"Gás", longo:"Central de gás (GLP)", grupo:"tecnico", d:1.0, prop:3.2, luz:"", cor:"gas", onde:"recuo"},
  medidores: {nome:"Medidores", longo:"Medidores de água e energia", grupo:"tecnico", d:0.6, prop:6, luz:"", cor:"tecnico", onde:"recuo"}
};
const CMN_NOMES = [[/sal[aã]o de festas|festas/i,"salao"],[/gourmet|churras/i,"gourmet"],[/academ|fitness|gin[aá]s/i,"academia"],[/brinquedo/i,"brinq"],
  [/cowork|escrit/i,"cowork"],[/lavander/i,"lavand"],[/jogos/i,"jogos"],[/cinema/i,"cinema"],[/sauna/i,"sauna"],[/bici/i,"bici"],
  [/piscina/i,"piscina"],[/deck|sol[aá]rio/i,"deck"],[/playground|parquinho/i,"playground"],[/\bpet\b/i,"pet"],[/quadra/i,"quadra"]];
function cmnTipo(nome, desc){ const n=String(nome||""); for(const [re,k] of CMN_NOMES) if(re.test(n)) return k; return desc? "externo" : "outro" }
const cmnNf=(v,d=1)=>(+v).toFixed(d).replace(".",",");
const cmnClamp=(v,a,b)=>Math.min(b,Math.max(a,v));

/* ---------- programa ---------- */
function cmnUnidades(m){ const n=(m && (m.unitsRes||m.units)) || (m && m.T || []).reduce((s,t)=>s+(t.units||0),0); return Math.max(1, Math.round(n || 40)) }
function comunsPrograma(st, m){
  const C=st.comuns||DEF.comuns||{}, P=st.produto, n=cmnUnidades(m), nT=Math.max(1,(m&&m.T||P.torres||[]).length);
  const it=(P.lazer&&P.lazer.itens)||[], out=[];
  const add=(k, A, o={})=>{ const c=CMN_CAT[k]; out.push({id:o.id||k, k, nome:o.nome||c.nome, A:Math.max(1,A), local:o.local||"terreo", desc:!!(o.desc??c.desc), grupo:c.grupo, ix:o.ix??null, auto:o.ix==null, obrig:!!o.obrig, par:o.par||null}) };
  // acesso e apoio do condomínio (sempre no térreo)
  add("clausura", 6.5, {obrig:true});
  add("portaria", n>120? 12 : 9, {obrig:true});
  add("hall", typeof hallSocial==="function"? hallSocial(st, nT) : 40+20*nT, {obrig:true});
  add("wc", 6.8, {obrig:true});
  if(C.funcionarios!==false){ add("vest", n>=60? 12.6 : 9.6, {obrig:true}); add("copaf", n>=60? 7.5 : 5.4) }
  add("dml", n>=60? 6 : 4.5, {obrig:true});
  const garBici = st.garagem && st.garagem.bici && st.garagem.bici!=="off";
  if(C.bici!==false && !garBici && !it.some(x=>cmnTipo(x.nome)==="bici")) add("bici", cmnClamp(Math.ceil(n*0.5)*0.75, 9, 36));
  add("lixo", cmnClamp(2.5+0.07*n, 4, 18), {obrig:true});
  if(C.gas==="glp") add("gas", n<=40? 3.8 : n<=100? 5.4 : 7.2, {obrig:true});
  add("medidores", cmnClamp(2+0.02*n, 2.4, 6), {obrig:true});
  // lazer do programa
  it.forEach((x,ix)=>{ const k=cmnTipo(x.nome, x.desc), A=Math.max(1,+x.area||0), local=LZ_LOCAIS[x.local]? x.local : "terreo";
    if(k==="salao" && !x.desc){ const cp=Math.max(7.5, Math.min(16, A*0.12)); add("salao", A-cp, {ix, nome:x.nome, local, id:"lz"+ix}); add("copa", cp, {ix, local, id:"lz"+ix+"c", par:"lz"+ix}) }
    else add(CMN_CAT[k]&&(!!CMN_CAT[k].desc===!!x.desc)? k : (x.desc?"externo":"outro"), A, {ix, nome:x.nome, local, desc:!!x.desc, id:"lz"+ix});
    if(k==="piscina") add("apoioPisc", 7.2, {local, id:"lz"+ix+"a", par:"lz"+ix}) });
  return out;
}
/* área de apoio coberta no térreo (entra na conta da profundidade do hall em terreoZones) */
function comunsApoioTerreo(st, m){ return comunsPrograma(st, m).filter(a=>a.local==="terreo" && !a.desc && a.ix==null && a.k!=="hall" && CMN_CAT[a.k].onde!=="recuo").reduce((s,a)=>s+a.A,0) }

/* ---------- malha ---------- */
function cmnGrade(ux, vy, polys, res=CMN_RES){
  let u0=1e9,u1=-1e9,v0=1e9,v1=-1e9;
  polys.forEach(p=>(p||[]).forEach(q=>{ const u=G.dot(q,ux), v=G.dot(q,vy); if(u<u0)u0=u; if(u>u1)u1=u; if(v<v0)v0=v; if(v>v1)v1=v }));
  u0-=res*2; v0-=res*2; u1+=res*2; v1+=res*2;
  const nx=Math.max(1,Math.ceil((u1-u0)/res)), ny=Math.max(1,Math.ceil((v1-v0)/res));
  const g={ux,vy,u0,v0,res,nx,ny,c:new Int16Array(nx*ny).fill(-1)};
  g.W=(u,v)=>[ux[0]*u+vy[0]*v, ux[1]*u+vy[1]*v];
  g.U=p=>[G.dot(p,ux), G.dot(p,vy)];
  g.cu=i=>u0+(i+0.5)*res; g.cv=j=>v0+(j+0.5)*res;
  g.at=(i,j)=> i<0||j<0||i>=nx||j>=ny ? -1 : g.c[j*nx+i];
  return g;
}
/* pinta as células cujo centro cai dentro do polígono (se(valorAtual) decide) */
function cmnPinta(g, poly, val, se){
  if(!poly || poly.length<3) return 0;
  const P=poly.map(q=>g.U(q)), us=P.map(q=>q[0]), vs=P.map(q=>q[1]);
  const i0=Math.max(0,Math.floor((Math.min(...us)-g.u0)/g.res)), i1=Math.min(g.nx-1,Math.floor((Math.max(...us)-g.u0)/g.res));
  const j0=Math.max(0,Math.floor((Math.min(...vs)-g.v0)/g.res)), j1=Math.min(g.ny-1,Math.floor((Math.max(...vs)-g.v0)/g.res));
  let n=0;
  for(let j=j0;j<=j1;j++){ const v=g.cv(j); for(let i=i0;i<=i1;i++){ const k=j*g.nx+i; if(se && !se(g.c[k])) continue; if(G.pip([g.cu(i),v],P)){ g.c[k]=val; n++ } } }
  return n;
}
function cmnSoma(g, pred){ const W=g.nx+1, s=new Int32Array(W*(g.ny+1));
  for(let j=0;j<g.ny;j++){ let row=0; for(let i=0;i<g.nx;i++){ row+=pred(g.c[j*g.nx+i])?1:0; s[(j+1)*W+i+1]=s[j*W+i+1]+row } } return s }
function cmnRetS(s, g, i, j, w, h){ const W=g.nx+1; return s[(j+h)*W+i+w]-s[j*W+i+w]-s[(j+h)*W+i]+s[j*W+i] }
const cmnRetPoly=(g,r)=>G.rect(g.ux,g.vy,g.u0+r.i*g.res,g.v0+r.j*g.res,r.w*g.res,r.h*g.res);
/* células → retângulos (faixas por linha, unidas na vertical quando iguais) */
function cmnRetangulos(g, pred){
  const out=[], open=new Map();
  for(let j=0;j<=g.ny;j++){ const runs=[];
    if(j<g.ny){ let i=0; while(i<g.nx){ if(pred(g.c[j*g.nx+i])){ const a=i; while(i<g.nx && pred(g.c[j*g.nx+i])) i++; runs.push(a+","+i) } else i++ } }
    const seen=new Set(runs);
    for(const [key,r] of [...open]) if(!seen.has(key)){ out.push(r); open.delete(key) }
    runs.forEach(key=>{ if(!open.has(key)){ const [a,b]=key.split(",").map(Number); open.set(key,{i:a,j,w:b-a,h:0}) } open.get(key).h++ }) }
  return out;
}
/* distância (em células, xadrez) até a célula não transitável mais próxima */
function cmnFolga(g, pass){
  const n=g.nx*g.ny, d=new Int16Array(n), BIG=9999;
  for(let k=0;k<n;k++) d[k]=pass(g.c[k])? BIG : 0;
  for(let j=0;j<g.ny;j++) for(let i=0;i<g.nx;i++){ const k=j*g.nx+i; if(!d[k]) continue; let v=BIG;
    if(i===0||j===0) v=1; else v=Math.min(d[k-1],d[k-g.nx],d[k-g.nx-1],(i<g.nx-1? d[k-g.nx+1] : 0))+1; d[k]=Math.min(d[k],v) }
  for(let j=g.ny-1;j>=0;j--) for(let i=g.nx-1;i>=0;i--){ const k=j*g.nx+i; if(!d[k]) continue; let v=BIG;
    if(i===g.nx-1||j===g.ny-1) v=1; else v=Math.min(d[k+1],d[k+g.nx],d[k+g.nx+1],(i>0? d[k+g.nx-1] : 0))+1; d[k]=Math.min(d[k],v) }
  return d;
}
/* menor caminho (Manhattan, com custo de curva) das fontes até alguma célula vizinha do alvo */
function cmnCaminho(g, fonte, alvo, passa, custo){
  const n=g.nx*g.ny, D=new Float32Array(n*4).fill(Infinity), prev=new Int32Array(n*4).fill(-1), H=[];
  const push=(c,s)=>{ H.push([c,s]); let i=H.length-1; while(i>0){ const p=(i-1)>>1; if(H[p][0]<=H[i][0]) break; [H[p],H[i]]=[H[i],H[p]]; i=p } };
  const pop=()=>{ const t=H[0], l=H.pop(); if(H.length){ H[0]=l; let i=0; for(;;){ const a=2*i+1, b=a+1; let s=i; if(a<H.length&&H[a][0]<H[s][0]) s=a; if(b<H.length&&H[b][0]<H[s][0]) s=b; if(s===i) break; [H[s],H[i]]=[H[i],H[s]]; i=s } } return t };
  const DI=[[1,0],[-1,0],[0,1],[0,-1]];
  for(let k=0;k<n;k++) if(fonte(k)) for(let d=0;d<4;d++){ D[k*4+d]=0; push(0,k*4+d) }
  while(H.length){ const [c,s]=pop(); if(c>D[s]) continue; const k=s>>2, dd=s&3, i=k%g.nx, j=(k/g.nx)|0;
    if(alvo(k) && !fonte(k)){ const path=[]; let x=s; while(x>=0){ path.push(x>>2); x=prev[x] } return path.reverse() }
    for(let d=0;d<4;d++){ const ni=i+DI[d][0], nj=j+DI[d][1]; if(ni<0||nj<0||ni>=g.nx||nj>=g.ny) continue; const nk=nj*g.nx+ni; if(!passa(nk) && !alvo(nk)) continue;
      const nc=c+(custo? custo(nk) : 1)+(d!==dd? 6 : 0), ns=nk*4+d; if(nc<D[ns]){ D[ns]=nc; prev[ns]=s; push(nc,ns) } } }
  return null;
}
/* centro de células → polilinha só com os pontos de curva */
function cmnPolilinha(g, cells){
  if(!cells || !cells.length) return [];
  const P=cells.map(k=>[k%g.nx,(k/g.nx)|0]), out=[P[0]];
  for(let t=1;t<P.length-1;t++){ const a=P[t-1], b=P[t], c=P[t+1]; if((b[0]-a[0])!==(c[0]-b[0]) || (b[1]-a[1])!==(c[1]-b[1])) out.push(b) }
  if(P.length>1) out.push(P[P.length-1]);
  return out.map(([i,j])=>g.W(g.cu(i),g.cv(j)));
}

/* ---------- códigos da malha ---------- */
const CF=-1, CL=0, CO=1, CC=2, CA=3, CH=4, CE=5;   // fora · livre · obstáculo · circulação · alvo (hall dos elevadores) · hall social · externo (recuo)
const cmnCirc=v=> v===CC || v===CA || v===CH;
const cmnSala=v=> v>=10;

/* luz natural de uma célula de borda: vizinha fora do embasamento, ao ar livre, e a parede a ≥ 1,5 m das divisas
   (lados de frente para a rua não contam como divisa). Devolve 1 (janela), 0,4 (só ventilação, 0,75–1,5 m) ou 0. */
function cmnLuzPonto(st, m, p){
  if(!m.emb.length || G.pip(p, m.emb)) return 0;
  const L=st.lote.pts; if(!G.pip(p, L)) return 1;
  let dmin=1e9; L.forEach((a,i)=>{ if(st.lote.front.includes(i)) return; const b=L[(i+1)%L.length], dx=b[0]-a[0], dy=b[1]-a[1], l2=dx*dx+dy*dy||1, t=cmnClamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2,0,1), x=a[0]+dx*t-p[0], y=a[1]+dy*t-p[1]; dmin=Math.min(dmin,Math.hypot(x,y)) });
  dmin+=0.2;   // o ponto de teste fica ~0,2 m para fora da parede
  return dmin>=CMN_JANELA_DIV-0.05? 1 : dmin>=0.75? 0.4 : 0;
}
function cmnLuzMapa(g, st, m, cobertas){
  // por célula: luz em cada lado (0 = −u, 1 = +u, 2 = −v, 3 = +v)
  const L=new Float32Array(g.nx*g.ny*4), DI=[[-1,0],[1,0],[0,-1],[0,1]], cob=cobertas||[];
  for(let j=0;j<g.ny;j++) for(let i=0;i<g.nx;i++){ const k=j*g.nx+i, v=g.c[k]; if(v===CF||v===CO||v===CE) continue;
    for(let d=0;d<4;d++){ const nv=g.at(i+DI[d][0], j+DI[d][1]); if(nv!==CF && nv!==CE) continue;
      const p=g.W(g.cu(i)+DI[d][0]*g.res*1.4, g.cv(j)+DI[d][1]*g.res*1.4);   // além da borda real (que pode cair no meio da célula vizinha)
      if(cob.some(c=>G.pip(p,c))) continue;
      L[k*4+d]=cmnLuzPonto(st, m, p) } }
  return L;
}

/* ---------- colocação de um ambiente ---------- */
/* tamanhos candidatos: área × f (f > 1 deixa o ambiente ir até a parede em vez de deixar fresta), proporção de 1 até a máxima */
function cmnTamanhos(A, c, res, flex){
  const out=[], seen=new Set();
  for(const f of flex) for(let r=1; r<=c.prop+1e-6; r+=0.2){ const a=A*f, w=Math.sqrt(a*r), h=a/w; if(h<c.d-1e-6) continue;
    for(const [W,H] of [[w,h],[h,w]]){ const wi=Math.max(2,Math.round(W/res)), hi=Math.max(2,Math.round(H/res)), key=wi+"x"+hi; if(seen.has(key)) continue; seen.add(key); out.push({w:wi,h:hi,f}) } }
  return out;
}
/* somas acumuladas 2D (consulta de retângulo em O(1), recortada pela malha) */
function cmnPS(g, f){ const W=g.nx+1, s=new Float32Array(W*(g.ny+1));
  for(let j=0;j<g.ny;j++){ let row=0; for(let i=0;i<g.nx;i++){ row+=f(j*g.nx+i); s[(j+1)*W+i+1]=s[j*W+i+1]+row } } return s }
function cmnQ(s, g, i, j, w, h){ const i0=Math.max(0,i), j0=Math.max(0,j), i1=Math.min(g.nx,i+w), j1=Math.min(g.ny,j+h); if(i1<=i0||j1<=j0) return 0; const W=g.nx+1; return s[j1*W+i1]-s[j0*W+i1]-s[j1*W+i0]+s[j0*W+i0] }
/* lados de um retângulo: d = 0 (−u), 1 (+u), 2 (−v), 3 (+v); "fora" = a fileira vizinha, "dentro" = a fileira da borda */
const cmnLadoFora=(r,d)=> d===0? [r.i-1,r.j,1,r.h] : d===1? [r.i+r.w,r.j,1,r.h] : d===2? [r.i,r.j-1,r.w,1] : [r.i,r.j+r.h,r.w,1];
const cmnLadoDentro=(r,d)=> d===0? [r.i,r.j,1,r.h] : d===1? [r.i+r.w-1,r.j,1,r.h] : d===2? [r.i,r.j,r.w,1] : [r.i,r.j+r.h-1,r.w,1];
const cmnDI=[[-1,0],[1,0],[0,-1],[0,1]];
/* comprimento das sequências de células livres a partir de cada célula, em cada direção */
function cmnCorridas(g){ const n=g.nx*g.ny, R=[0,1,2,3].map(()=>new Int16Array(n));
  for(let j=0;j<g.ny;j++){ for(let i=0;i<g.nx;i++){ const k=j*g.nx+i; R[0][k]= g.c[k]===CL? (i? R[0][k-1] : 0)+1 : 0 } for(let i=g.nx-1;i>=0;i--){ const k=j*g.nx+i; R[1][k]= g.c[k]===CL? (i<g.nx-1? R[1][k+1] : 0)+1 : 0 } }
  for(let i=0;i<g.nx;i++){ for(let j=0;j<g.ny;j++){ const k=j*g.nx+i; R[2][k]= g.c[k]===CL? (j? R[2][k-g.nx] : 0)+1 : 0 } for(let j=g.ny-1;j>=0;j--){ const k=j*g.nx+i; R[3][k]= g.c[k]===CL? (j<g.ny-1? R[3][k+g.nx] : 0)+1 : 0 } }
  return R }
/* contato do retângulo com a vizinhança (formato antigo, usado pelo desenho e pela validação) */
function cmnContato(g, r, luz, par){
  const res={circ:0, circRun:0, luz:0, luzLado:[0,0,0,0], parede:0, livre:0, par:0, per:0, lado:[0,0,0,0], circLado:[0,0,0,0]};
  [0,1,2,3].forEach(d=>{ const [i0,j0,w,h]=cmnLadoFora(r,d), [a0,b0]=cmnLadoDentro(r,d); let run=0; const n=Math.max(w,h);
    for(let t=0;t<n;t++){ const i=i0+(w>1?t:0), j=j0+(h>1?t:0), v=g.at(i,j); res.per++;
      const kin=(b0+(h>1?t:0))*g.nx+a0+(w>1?t:0);
      if(cmnCirc(v)){ res.circ++; res.circLado[d]++; run++; res.circRun=Math.max(res.circRun,run) } else run=0;
      if(v===CL) res.livre++; else if(!cmnCirc(v)) res.parede++;
      if(par!=null && v===par) res.par++;
      const lz=luz? luz[kin*4+d] : 0; if(lz){ res.luz+=lz; res.luzLado[d]+=lz } } });
  return res;
}
/* maior sequência contínua de circulação (ou do parceiro) num lado */
function cmnRun(g, r, d, ok){ const [i0,j0,w,h]=cmnLadoFora(r,d), n=Math.max(w,h); let run=0, best=0; for(let t=0;t<n;t++){ if(ok(g.at(i0+(w>1?t:0), j0+(h>1?t:0)))){ run++; if(run>best) best=run } else run=0 } return best }
/* frentes: trechos de células livres encostadas na circulação (ou no ambiente parceiro), por direção de avanço d
   (o ambiente cresce de d a partir da frente). line = fileira/coluna das células livres; t0..t1 = trecho ao longo dela */
function cmnFrentes(g, ok){
  const segs=[];
  for(let d=0; d<4; d++){ const [di,dj]=cmnDI[d];
    if(d>=2){ for(let j=0;j<g.ny;j++){ let a=-1; for(let i=0;i<=g.nx;i++){ const f= i<g.nx && g.c[j*g.nx+i]===CL && ok(g.at(i-di, j-dj)); if(f&&a<0) a=i; if(!f&&a>=0){ segs.push({d, line:j, t0:a, t1:i}); a=-1 } } } }
    else { for(let i=0;i<g.nx;i++){ let a=-1; for(let j=0;j<=g.ny;j++){ const f= j<g.ny && g.c[j*g.nx+i]===CL && ok(g.at(i-di, j-dj)); if(f&&a<0) a=j; if(!f&&a>=0){ segs.push({d, line:i, t0:a, t1:j}); a=-1 } } } } }
  return segs;
}
const cmnSegCel=(g,s,t)=> s.d>=2? s.line*g.nx+t : t*g.nx+s.line;
const cmnSegRet=(s,a,w,h)=> s.d===3? {i:a, j:s.line, w, h} : s.d===2? {i:a, j:s.line-h+1, w, h} : s.d===1? {i:s.line, j:a, w:h, h:w} : {i:s.line-h+1, j:a, w:h, h:w};
/* coloca um ambiente com a porta numa frente: largura w ao longo da frente, profundidade até a parede quando dá (sem fresta
   atrás), laterais encostadas em outro ambiente ou parede, luz natural para quem é de permanência, perto da âncora */
function cmnPoe(g, a, o){
  const c=CMN_CAT[a.k], res=g.res, luz=o.luz, ancora=o.ancora||null, par=o.par!=null? o.par : null;
  const portaC=Math.ceil((c.porta||0.9)/res)+1, lim24=Math.round(2.4/res), dMin=Math.max(2,Math.ceil((c.d-0.05)/res)), A=a.A/(res*res);
  const fMin=o.fMin??0.88, fMax=o.fMax??1.3;
  const SL=cmnPS(g, k=>g.c[k]===CL?1:0), SC=cmnPS(g, k=>cmnCirc(g.c[k])?1:0);
  const SZ= luz? (o.SZ || [0,1,2,3].map(d=>cmnPS(g, k=>luz[k*4+d]))) : null, RN=cmnCorridas(g);
  const okF = par!=null && o.parObrig? (v=>v===par) : (v=>cmnCirc(v) || (par!=null && v===par));
  const segs=cmnFrentes(g, okF).filter(s=>s.t1-s.t0>=dMin);
  const wMax=Math.ceil(Math.sqrt(A*(c.prop+0.2)*fMax))+1, K=o.todos? 14 : 1, top=[];
  for(const s of segs){ const len=s.t1-s.t0, prof=new Int16Array(len); for(let t=0;t<len;t++) prof[t]=RN[s.d][cmnSegCel(g,s,s.t0+t)];
    const dOp=s.d, lat= s.d>=2? [0,1] : [2,3];   // dOp = fundo (lado oposto à porta)
    for(let w=dMin; w<=Math.min(len,wMax); w++){
      const hA=A/w;
      for(let a0=0; a0+w<=len; a0++){
        let mx=1e9; for(let t=a0;t<a0+w;t++) if(prof[t]<mx) mx=prof[t];
        if(mx<dMin) continue;
        const hs=[]; const h1=Math.max(dMin, Math.round(hA)); if(h1<=mx) hs.push(h1);
        if(mx*w<=A*fMax && mx*w>=A*fMin && mx!==h1) hs.push(mx);   // até a parede
        if(h1>mx && mx*w>=A*fMin) hs.push(mx);
        for(const h of hs){ const f=w*h/A; if(f<fMin-1e-9 || f>fMax+1e-9) continue; if(Math.max(w,h)/Math.min(w,h)>c.prop+0.3) continue;
          const r=cmnSegRet(s, s.t0+a0, w, h), L=[r.h,r.h,r.w,r.w], cu=g.u0+(r.i+r.w/2)*res, cv=g.v0+(r.j+r.h/2)*res, Lm=Math.max(r.w,r.h)*res;
          let sc=0;
          if(SZ){ let lz=0; for(let d=0;d<4;d++) lz+=cmnQ(SZ[d],g,...cmnLadoDentro(r,d)); const luzM=lz*res;
            if(c.luz==="sim") sc += luzM>0? 45*Math.min(1, luzM/(0.5*Lm)) : -30;
            else if(c.luz==="pref" || c.luz==="vista") sc += 14*Math.min(1, luzM/(0.4*Lm));
            else sc -= 16*Math.min(1, luzM/Lm) }   // quem não precisa de janela deixa a fachada para quem precisa
          // fundo: encostado na parede (ou sobra ≥ 2,4 m, ainda útil)
          { const so=cmnLadoFora(r,dOp), fr=cmnQ(SL,g,...so), ci=cmnQ(SC,g,...so), wall=L[dOp]-fr-ci; sc+=22*wall/L[dOp] + 4*ci/L[dOp];
            if(fr>0){ const gp=mx-h; sc -= gp<lim24? 30 : 7 } }
          // laterais: encostadas; fresta estreita entre o ambiente e a parede/vizinho é perda
          for(const d of lat){ const so=cmnLadoFora(r,d), fr=cmnQ(SL,g,...so), ci=cmnQ(SC,g,...so), wall=L[d]-fr-ci; sc+=8*wall/L[d];
            if(fr>0){ const t= d===0||d===2? a0-1 : a0+w; let gp=0; if(t>=0 && t<len){ const step= t<a0? -1 : 1; for(let q=t; q>=0 && q<len && prof[q]>0; q+=step) gp++ } else gp=lim24;
              if(gp<lim24) sc -= 14*fr/L[d] } }
          sc -= 3*(Math.max(r.w,r.h)/Math.min(r.w,r.h)-1);
          sc -= f<1? 150*(1-f) : 40*(f-1);
          if(par!=null){ let pc=0; for(let d=0;d<4;d++){ const [i0,j0,ww,hh]=cmnLadoFora(r,d); for(let q=0;q<Math.max(ww,hh);q++) if(g.at(i0+(ww>1?q:0), j0+(hh>1?q:0))===par) pc++ } sc += 40*Math.min(1, pc*res/2); if(o.parObrig && pc<portaC) continue }
          if(ancora) sc -= (o.pesoAncora??0.5)*Math.hypot(cu-ancora[0], cv-ancora[1]);
          if(o.extra) sc += o.extra(r, {cu,cv});
          if(top.length<K || sc>top[top.length-1].sc){ let lz=0; const lzL=[0,0,0,0]; if(SZ) for(let d=0;d<4;d++){ lzL[d]=cmnQ(SZ[d],g,...cmnLadoDentro(r,d)); lz+=lzL[d] }
            let frT=0; for(let d=0;d<4;d++) if(d!==[1,0,3,2][s.d]) frT+=cmnQ(SL,g,...cmnLadoFora(r,d));
            top.push({...r, sc, f, frT, ct:{luz:lz, luzLado:lzL}}); top.sort((x,y)=>y.sc-x.sc); if(top.length>K) top.pop() } } } } }
  return o.todos? top : top[0]||null;
}
/* células livres que não se ligam à circulação (ambientes ilhados atrás de outros) */
/* (pela passagem de ao menos 1,20 m: uma fresta de 0,5 m ao lado de um ambiente não é acesso) */
/* fol = folga calculada antes de marcar o retângulo r (marcar só diminui a folga: perto de r ela é a distância até r) */
function cmnIlhadas(g, fol, r){
  const n=g.nx*g.ny, rm=Math.max(1,Math.ceil((1.2/g.res-1)/2)), vis=new Uint8Array(n), Q=[];
  const passa=kk=>{ if(fol[kk]<=rm) return false; if(!r) return true; const i=kk%g.nx, j=(kk/g.nx)|0, dx=i<r.i? r.i-i : i>=r.i+r.w? i-r.i-r.w+1 : 0, dy=j<r.j? r.j-j : j>=r.j+r.h? j-r.j-r.h+1 : 0; return Math.max(dx,dy)>rm };
  for(let k=0;k<n;k++) if(cmnCirc(g.c[k])){ vis[k]=1; Q.push(k) }
  for(let q=0;q<Q.length;q++){ const k=Q[q], i=k%g.nx, j=(k/g.nx)|0; for(const [a,b] of cmnDI){ const kk=(j+b)*g.nx+i+a; if(g.at(i+a,j+b)!==CL || vis[kk]) continue; if(!cmnCirc(g.c[k]) && !passa(kk)) continue; vis[kk]=1; Q.push(kk) } }
  // alcançada = a até rm células de uma célula de passagem
  const SV=cmnPS(g, k=>vis[k]&&g.c[k]===CL?1:0);
  let c=0; for(let k=0;k<n;k++){ if(g.c[k]!==CL || vis[k]) continue; const i=k%g.nx, j=(k/g.nx)|0; if(!cmnQ(SV,g,i-rm,j-rm,2*rm+1,2*rm+1)) c++ } return c }
/* teste rápido (local) do mesmo critério: cada célula livre encostada em r ainda chega à circulação por uma passagem de
   1,20 m sem dar a volta grande? 1 = certamente não ilhou nada; 0 = fechou um bolsão > 6 m²; −1 = não sei (teste completo) */
function cmnIlhaLocal(g, fol, r, lim=4000){
  const rm=Math.max(1,Math.ceil((1.2/g.res-1)/2)), nx=g.nx, n=g.nx*g.ny;
  if(!g._vis || g._vis.length!==n){ g._vis=new Int32Array(n); g._st=0; g._Q=new Int32Array(n) }
  const vis=g._vis, Q=g._Q;
  const dR=(i,j)=>{ const dx=i<r.i? r.i-i : i>=r.i+r.w? i-r.i-r.w+1 : 0, dy=j<r.j? r.j-j : j>=r.j+r.h? j-r.j-r.h+1 : 0; return Math.max(dx,dy) };
  const junto=(i,j)=> cmnCirc(g.at(i+1,j)) || cmnCirc(g.at(i-1,j)) || cmnCirc(g.at(i,j+1)) || cmnCirc(g.at(i,j-1));
  const entra=(i,j)=> g.at(i,j)===CL && ((fol[j*nx+i]>rm && dR(i,j)>rm) || junto(i,j));
  const st0=g._st+1, bom=new Set();   // marcas de buscas desta chamada que chegaram à circulação (as células delas estão ligadas)
  for(const d of [0,1,2,3]){ const [i0,j0,w,h]=cmnLadoFora(r,d);
    for(let t=0;t<Math.max(w,h);t++){ const ci=i0+(w>1?t:0), cj=j0+(h>1?t:0); if(g.at(ci,cj)!==CL || junto(ci,cj)) continue;
      const st=++g._st; let nq=0, achou=false;
      for(let dj=-rm;dj<=rm && !achou;dj++) for(let di=-rm;di<=rm;di++){ const i=ci+di, j=cj+dj; if(!entra(i,j)) continue; const k=j*nx+i; if(vis[k]>=st0 && bom.has(vis[k])){ achou=true; break } if(vis[k]!==st){ vis[k]=st; Q[nq++]=k } }
      let q=0;
      for(;q<nq && q<lim && !achou;q++){ const k=Q[q], i=k%nx, j=(k/nx)|0; if(junto(i,j)){ achou=true; break }
        for(const [a,b] of cmnDI){ const ii=i+a, jj=j+b; if(!entra(ii,jj)) continue; const kk=jj*nx+ii, v=vis[kk]; if(v===st) continue; if(v>=st0 && bom.has(v)){ achou=true; break } vis[kk]=st; Q[nq++]=kk } }
      if(!achou) return q>=nq && nq*g.res*g.res>6? 0 : -1;   // bolsão fechado e grande: ilhou com certeza
      bom.add(st) } }
  return 1;
}
function cmnMarca(g, r, val){ for(let j=r.j;j<r.j+r.h;j++) for(let i=r.i;i<r.i+r.w;i++) g.c[j*g.nx+i]=val }

/* ---------- corredores ---------- */
function cmnPincel(g, cells, rb, val, se){ cells.forEach(k=>{ const i=k%g.nx, j=(k/g.nx)|0; for(let dj=-rb;dj<=rb;dj++) for(let di=-rb;di<=rb;di++){ const v=g.at(i+di,j+dj); if(v===CF) continue; const kk=(j+dj)*g.nx+i+di; if(se(v)) g.c[kk]=val } }) }
function cmnLiga(g, alvoSet, rb, modo, perto){   // perto: Uint8Array das células junto às fachadas com luz (galeria evita: a fachada é dos ambientes)
  // galeria da circulação existente até o alvo; com a largura toda se couber, senão com 1,20 m (rota acessível mínima).
  // modo: "neutro" (caminho mais curto), "parede" (rente às paredes e aos núcleos: não parte o vão livre) ou "centro"
  // (pelo meio do vão: ambientes dos dois lados da galeria)
  for(const r of [rb, Math.max(1,Math.ceil((1.2/g.res-1)/2))]){
    const fol=cmnFolga(g, v=>v===CL||cmnCirc(v)), f6=r+Math.round(5/g.res);
    const c0= modo==="parede"? (k=>g.c[k]===CC||g.c[k]===CH? 0.3 : fol[k]<=r+2? 0.75 : 1.25)
      : modo==="centro"? (k=>g.c[k]===CC||g.c[k]===CH? 0.3 : fol[k]>=f6? 0.7 : 1.2) : (k=>g.c[k]===CC||g.c[k]===CH? 0.3 : 1);
    const custo= perto? (k=>c0(k) + (perto[k] && g.c[k]===CL? 0.9 : 0)) : c0;
    // perto da origem a folga é pequena (encostada na clausura, numa galeria estreita): deixa sair de lá
    const n=g.nx*g.ny, dS=new Int16Array(n).fill(999), Q=[]; for(let k=0;k<n;k++) if(g.c[k]===CC||g.c[k]===CH){ dS[k]=0; Q.push(k) }
    for(let q=0;q<Q.length;q++){ const k=Q[q]; if(dS[k]>=r+1) continue; const i=k%g.nx, j=(k/g.nx)|0; for(const [a,b] of cmnDI){ const kk=(j+b)*g.nx+i+a; if(g.at(i+a,j+b)===CL && dS[kk]>dS[k]+1){ dS[kk]=dS[k]+1; Q.push(kk) } } }
    const path=cmnCaminho(g, k=>g.c[k]===CC||g.c[k]===CH, k=>alvoSet.has(k), k=>(g.c[k]===CL||g.c[k]===CC||g.c[k]===CH) && (fol[k]>r || dS[k]<=r), custo);
    if(path){ cmnPincel(g, path, r, CC, v=>v===CL); return {path, estreito: r<rb} } }
  return null;
}
/* galeria paralela à fachada com mais luz, a ~7 m dela: a faixa entre a galeria e a fachada é dos ambientes de permanência
   (salão, academia…), com janela; a galeria se liga à circulação existente */
function cmnGaleriaFachada(g, luz, rb, prof=7.2){
  const n=g.nx*g.ny, D=Math.round(prof/g.res), grupos=new Map();
  for(let k=0;k<n;k++){ if(g.c[k]!==CL) continue; const i=k%g.nx, j=(k/g.nx)|0; for(let d=0;d<4;d++){ if(luz[k*4+d]<1) continue; const key=d+":"+(d>=2? j : i); grupos.set(key,(grupos.get(key)||0)+1) } }
  const ord=[...grupos.entries()].sort((a,b)=>b[1]-a[1]).filter(x=>x[1]*g.res>=8).slice(0,3);
  const fol=cmnFolga(g, v=>v===CL||cmnCirc(v)), X=7777;
  for(const [key] of ord){ const [d,line]=key.split(":").map(Number), [di,dj]=cmnDI[d];
    const L2=line - (d>=2? dj : di)*(D+rb), cells=[];   // para dentro
    if(d>=2){ if(L2<0||L2>=g.ny) continue; for(let i=0;i<g.nx;i++){ const k=L2*g.nx+i; if(g.c[k]===CL) cells.push(k) } }
    else { if(L2<0||L2>=g.nx) continue; for(let j=0;j<g.ny;j++){ const k=j*g.nx+L2; if(g.c[k]===CL) cells.push(k) } }
    // só o maior trecho contínuo, com folga para a largura da galeria
    const ok=cells.filter(k=>fol[k]>rb); let run=[], best=[];
    ok.forEach((k,q)=>{ if(q && Math.abs(d>=2? k-ok[q-1] : (k-ok[q-1])/g.nx)!==1){ if(run.length>best.length) best=run; run=[] } run.push(k) }); if(run.length>best.length) best=run;
    if(best.length*g.res<6) continue;
    const salva=g.c.slice();
    cmnPincel(g, best, rb, X, v=>v===CL);
    const set=new Set(); for(let k=0;k<n;k++) if(g.c[k]===X) set.add(k);
    const r=cmnLiga(g, set, rb, "neutro");
    if(!r){ g.c.set(salva); continue }
    for(let k=0;k<n;k++) if(g.c[k]===X) g.c[k]=CC;
    return true }
  return false;
}
/* distância (em células, pelas livres) até a circulação */
function cmnDistCirc(g){ const n=g.nx*g.ny, dc=new Int32Array(n).fill(1e9), Q=[];
  for(let k=0;k<n;k++) if(cmnCirc(g.c[k])){ dc[k]=0; Q.push(k) }
  for(let q=0;q<Q.length;q++){ const k=Q[q], i=k%g.nx, j=(k/g.nx)|0; for(const [a,b] of cmnDI){ if(g.at(i+a,j+b)!==CL) continue; const kk=(j+b)*g.nx+i+a; if(dc[kk]>dc[k]+1){ dc[kk]=dc[k]+1; Q.push(kk) } } }
  return dc }
/* ramal de galeria: reta a partir da circulação para dentro da área livre que está longe dela (a mais de ~7 m),
   criando frente para novos ambientes; o comprimento para onde deixa de ganhar área */
function cmnRamal(g, rb0, alcance=7){
  const n=g.nx*g.ny, lim=Math.round(alcance/g.res), dc=cmnDistCirc(g);
  let nFar=0; for(let k=0;k<n;k++) if(g.c[k]===CL && dc[k]>lim) nFar++;
  if(nFar*g.res*g.res<12) return false;
  const fol=cmnFolga(g, v=>v===CL||cmnCirc(v));
  for(const rb of [...new Set([rb0, Math.max(1,Math.ceil((1.2/g.res-1)/2))])]){ if(cmnRamalW(g, rb, lim, dc, fol)) return true }
  // sem reta que entre no vão (passagem estreita, em curva): galeria pelo caminho até o meio da maior área longe da circulação
  const vis=new Uint8Array(n); let comp=null;
  for(let k=0;k<n;k++){ if(g.c[k]!==CL || dc[k]<=lim || vis[k]) continue; const cc=[k]; vis[k]=1;
    for(let q=0;q<cc.length;q++){ const c=cc[q], i=c%g.nx, j=(c/g.nx)|0; for(const [a,b] of cmnDI){ const kk=(j+b)*g.nx+i+a; if(g.at(i+a,j+b)===CL && dc[kk]>lim && !vis[kk]){ vis[kk]=1; cc.push(kk) } } }
    if(!comp || cc.length>comp.length) comp=cc }
  if(!comp || comp.length*g.res*g.res<12 || comp.every(k=>dc[k]>=1e9)) return false;
  const cu=comp.reduce((s,k)=>s+k%g.nx,0)/comp.length, cv=comp.reduce((s,k)=>s+((k/g.nx)|0),0)/comp.length;
  let alvo=comp[0], dm=1e18; comp.forEach(k=>{ if(dc[k]>=1e9) return; const d=(k%g.nx-cu)**2+(((k/g.nx)|0)-cv)**2; if(d<dm){ dm=d; alvo=k } });
  return !!cmnLiga(g, new Set([alvo]), rb0, "neutro");
}
function cmnRamalW(g, rb, lim, dc, fol){
  const n=g.nx*g.ny; let best=null;
  for(let k=0;k<n;k++){ if(!cmnCirc(g.c[k])) continue; const i=k%g.nx, j=(k/g.nx)|0;
    for(const [a,b] of cmnDI){ if(g.at(i+a,j+b)!==CL) continue; let cum=0, bestS=0, bestV=0;
      for(let s=1;;s++){ const ii=i+a*s, jj=j+b*s; if(g.at(ii,jj)!==CL || fol[jj*g.nx+ii]<=rb) break;
        let c=0; for(const sg of [1,-1]) for(let t=1;t<=lim;t++){ const pi=ii+b*sg*t, pj=jj+a*sg*t; if(g.at(pi,pj)!==CL) break; if(dc[pj*g.nx+pi]>lim) c++ }
        cum+=c; const sc=cum - (2*rb+1)*s*1.2; if(sc>bestV){ bestV=sc; bestS=s } }
      if(bestS*g.res<3) continue;
      if(!best || bestV>best.sc) best={sc:bestV,i,j,a,b,L:bestS+rb} } }
  if(!best || best.sc*g.res*g.res<6) return false;
  const cells=[]; for(let s=1;s<=best.L;s++){ const ii=best.i+best.a*s, jj=best.j+best.b*s; if(g.at(ii,jj)!==CL) break; cells.push(jj*g.nx+ii) }
  cmnPincel(g, cells, rb, CC, v=>v===CL); return true;
}

/* ---------- mobiliário (primitivas no referencial do ambiente; y = 0 na parede da janela) ---------- */
function cmnQuadro(g, r, lado){
  const res=g.res, u0=g.u0+r.i*res, v0=g.v0+r.j*res, w=r.w*res, h=r.h*res;
  const F= lado===2? {W:w,D:h,P:(x,y)=>[u0+x,v0+y]} : lado===3? {W:w,D:h,P:(x,y)=>[u0+w-x,v0+h-y]} : lado===0? {W:h,D:w,P:(x,y)=>[u0+y,v0+h-x]} : {W:h,D:w,P:(x,y)=>[u0+w-y,v0+x]};
  F.G=(x,y)=>g.W(...F.P(x,y));
  return F;
}
function cmnMoveis(g, a, lado, portaLado){
  const F=cmnQuadro(g, a.r, lado), W=F.W, D=F.D, out=[];
  const R=(x,y,w,h,cl="mov")=>{ if(w<=0.05||h<=0.05) return; out.push({t:"r", cl, pts:[F.G(x,y),F.G(x+w,y),F.G(x+w,y+h),F.G(x,y+h)]}) };
  const C=(x,y,r,cl="mov")=>out.push({t:"c", cl, c:F.G(x,y), r});
  const Ln=(x1,y1,x2,y2,cl="mov")=>out.push({t:"l", cl, pts:[F.G(x1,y1),F.G(x2,y2)]});
  const cad=(x,y)=>C(x,y,0.22,"cad");
  const k=a.k, m=0.15;
  if(k==="salao"){ R(0.5, D-0.75, Math.min(W-1, 3.6), 0.6, "equip");   // aparador / buffet na parede do fundo
    const nx=Math.max(1,Math.floor((W-1.2)/2.6)), ny=Math.max(1,Math.floor((D-1.9)/2.6));
    for(let a1=0;a1<nx;a1++) for(let b=0;b<ny;b++){ const x=0.6+1.3+a1*(W-1.2-2.6)/Math.max(1,nx-1)*(nx>1?1:0)+(nx===1? (W-1.2-2.6)/2 : 0), y=0.9+1.3+b*2.6; if(y>D-1.5) continue;
      C(x,y,0.6); for(let q=0;q<6;q++){ const t=q*Math.PI/3; cad(x+Math.cos(t)*0.88, y+Math.sin(t)*0.88) } } }
  else if(k==="copa"||k==="copaf"){ R(m, D-0.6-m, W-2*m, 0.6, "equip"); R(W/2-0.3, D-0.55-m, 0.6, 0.4, "louca"); R(W-0.85-m, D-0.75-m, 0.7, 0.7, "equip");
    if(k==="copaf" && D>2.6){ R(W/2-0.6, D/2-0.6, 1.2, 0.8); cad(W/2-0.3, D/2-0.85); cad(W/2+0.3, D/2-0.85); cad(W/2-0.3, D/2+0.45); cad(W/2+0.3, D/2+0.45) } }
  else if(k==="gourmet"){ const bw=Math.min(W-0.6, Math.max(3.0, W*0.7));
    R((W-bw)/2, D-0.75, bw, 0.7, "equip"); R((W-bw)/2+0.3, D-0.95, 1.3, 0.95, "fogo"); out.push({t:"r", cl:"coifa", pts:[F.G((W-bw)/2+0.2,D-1.15),F.G((W-bw)/2+1.7,D-1.15),F.G((W-bw)/2+1.7,D-0.1),F.G((W-bw)/2+0.2,D-0.1)]});
    R((W-bw)/2+bw-1.0, D-0.6, 0.5, 0.4, "louca");
    const tw=Math.min(W-1.6, 3.2), ty=Math.max(1.0, (D-0.75)/2-0.5); R((W-tw)/2, ty, tw, 0.95);
    for(let x=(W-tw)/2+0.45; x<(W+tw)/2-0.2; x+=0.7){ cad(x, ty-0.3); cad(x, ty+1.25) } }
  else if(k==="academia"){ let x=0.4; const ne=Math.max(1,Math.min(5,Math.floor((W-0.8)/1.15)));
    for(let q=0;q<ne;q++){ R(x, 0.5, 0.8, 1.9, "equip"); x+=1.15 }   // esteiras e bicicletas de frente para a janela
    if(D>4.5){ R(0.4, D-1.8, 2.2, 1.4, "equip"); if(W>5.4) R(3.0, D-1.6, 1.8, 1.0, "equip"); if(W>7.6) R(5.2, D-1.6, 1.6, 1.2, "equip") }
    Ln(W-m, 0.6, W-m, D-0.6, "espelho") }
  else if(k==="brinq"){ out.push({t:"r", cl:"piso", pts:[F.G(m,m),F.G(W-m,m),F.G(W-m,D-m),F.G(m,D-m)]}); R(m, D-0.45-m, Math.min(W-0.3,3.2), 0.45); C(W*0.35, D*0.42, 0.55); [0,1,2,3].forEach(q=>C(W*0.35+Math.cos(q*1.57)*0.8, D*0.42+Math.sin(q*1.57)*0.8, 0.17, "cad")); if(W>4) R(W-1.9, 0.5, 1.4, 1.2, "equip") }
  else if(k==="cowork"){ const nx=Math.max(1,Math.floor((W-0.6)/1.9)), ny=Math.max(1,Math.floor((D-0.8)/2.1));
    for(let a1=0;a1<nx;a1++) for(let b=0;b<ny;b++){ const x=0.5+a1*1.9, y=0.7+b*2.1; R(x,y,1.6,0.8); cad(x+0.4,y+1.05); cad(x+1.2,y+1.05) } }
  else if(k==="lavand"){ const n=Math.max(2,Math.floor((W-0.4)/0.7)); for(let q=0;q<n;q++) R(0.2+q*0.7, D-0.75, 0.62, 0.62, "equip"); if(D>2.4) R(0.4, 0.4, Math.min(2.0,W-0.8), 0.6) }
  else if(k==="jogos"){ R(W/2-1.25, D/2-0.7, 2.5, 1.4, "equip"); if(W>6) R(0.5, 0.5, 1.2, 0.7); if(D>5) { C(W-1.3, D-1.3, 0.45); [0,1,2,3].forEach(q=>cad(W-1.3+Math.cos(q*1.57)*0.7, D-1.3+Math.sin(q*1.57)*0.7)) } }
  else if(k==="cinema"){ Ln(0.5, D-0.3, W-0.5, D-0.3, "espelho"); for(let y=0.8;y<D-2.2;y+=1.0) R(0.6, y, W-1.2, 0.6) }
  else if(k==="sauna"){ R(m, D-0.6-m, W-2*m, 0.6); R(m, m, 0.6, D-0.6-2*m) }
  else if(k==="wc"||k==="apoioPisc"||k==="vest"){ const n=2, cw=W/n;
    for(let q=0;q<n;q++){ const x0=q*cw; if(q) Ln(x0, 0, x0, D, "div");
      if(k==="vest"){ R(x0+0.1, D-0.5, Math.max(0.6,cw-1.2), 0.45); R(x0+cw-0.95, D-0.95, 0.85, 0.85, "louca"); R(x0+0.15, 0.15, 0.4, 0.65, "louca"); R(x0+0.75, 0.15, 0.5, 0.4, "louca") }
      else { R(x0+0.2, D-0.7, 0.42, 0.62, "louca"); R(x0+cw-0.6, D-0.5, 0.45, 0.4, "louca"); if(Math.min(cw,D)>=1.45) out.push({t:"c", cl:"giro", c:F.G(x0+cw/2, D/2), r:Math.min(0.75, Math.min(cw,D)/2-0.05)});
        if(k==="apoioPisc" && q===1) R(x0+0.15, 0.15, 0.9, 0.9, "louca") } } }
  else if(k==="dml"){ R(m, D-0.55-m, 0.7, 0.55, "louca"); R(W-0.45-m, m, 0.4, D-2*m) }
  else if(k==="bici"){ for(let x=0.4;x<W-0.3;x+=0.6) Ln(x, 0.3, x, Math.min(D-1.0, 1.9), "equip") }
  else if(k==="portaria"){ R(m, m, W-2*m, 0.6, "equip"); cad(W/2, 1.05); if(D>2.6 && W>1.8){ const wy=D-1.3; Ln(0, wy, Math.min(W,1.4), wy, "div"); Ln(Math.min(W,1.4), wy, Math.min(W,1.4), D, "div"); R(0.2, D-0.7, 0.4, 0.55, "louca") } }
  else if(k==="hall"){ const bw=Math.min(2.6, W*0.45); R(W-bw-0.6, 0.8, bw, 0.6, "equip"); cad(W-bw/2-0.6, 0.35);   // balcão da recepção, de frente para a entrada
    if(W>4.5 && D>4){ R(0.6, D-1.6, 2.0, 0.85); R(0.6, D-2.7, 0.85, 0.85); C(1.9, D-2.6, 0.35) }
    Ln(0.3, 2.0, 0.3, Math.min(D-0.4, 3.6), "espelho") }   // caixas de correio
  else if(k==="clausura"){ Ln(0.3, 0.12, W-0.3, 0.12, "div"); Ln(0.3, D-0.12, W-0.3, D-0.12, "div") }
  else if(k==="lixo"){ const n=Math.max(1,Math.floor((W-0.2)/1.45)); for(let q=0;q<n;q++) R(0.15+q*1.45, 0.2, 1.3, Math.min(1.1,D-0.35), "equip") }
  else if(k==="gas"){ const n=Math.max(2,Math.floor((W-0.2)/0.75)); for(let q=0;q<n;q++) C(0.45+q*0.75, D/2, 0.3, "gasc") }
  else if(k==="medidores"){ const n=Math.max(2,Math.floor((W-0.2)/0.55)); for(let q=0;q<n;q++) R(0.12+q*0.55, 0.08, 0.45, Math.min(0.35,D-0.1), "equip") }
  else if(k==="playground"){ out.push({t:"r", cl:"piso", pts:[F.G(0.2,0.2),F.G(W-0.2,0.2),F.G(W-0.2,D-0.2),F.G(0.2,D-0.2)]}); C(W*0.3, D*0.35, 0.9, "equip"); R(W*0.55, D*0.2, Math.min(2.4,W*0.3), 1.2, "equip"); C(W*0.7, D*0.7, 0.6, "equip"); R(W*0.15, D*0.65, 1.8, 0.5, "equip") }
  else if(k==="pet"){ C(W*0.3, D*0.4, 0.35, "equip"); C(W*0.65, D*0.55, 0.35, "equip"); R(W*0.45, D*0.15, 1.2, 0.3, "equip"); R(0.3, D-0.7, 1.2, 0.45) }
  else if(k==="quadra"){ const qw=Math.min(W-1, D*0.55), qd=Math.min(D-1, qw*1.8), x0=(W-qw)/2, y0=(D-qd)/2; out.push({t:"r", cl:"linha", pts:[F.G(x0,y0),F.G(x0+qw,y0),F.G(x0+qw,y0+qd),F.G(x0,y0+qd)]}); Ln(x0, y0+qd/2, x0+qw, y0+qd/2, "linha"); C(x0+qw/2, y0+qd/2, Math.min(1.5,qw*0.2), "linhac") }
  else if(k==="deck"||k==="externo"){ for(let x=0.6;x+0.7<W-0.3;x+=1.2) R(x, 0.4, 0.7, 1.9) }
  else if(k==="estar" && W>=2.4 && D>=2.4){ const sw=Math.min(2.2, W-0.6), x0=(W-sw)/2; R(x0, 0.15, sw, 0.85, "equip"); R(W/2-0.55, 1.35, 1.1, 0.6);   // sofá na parede, mesa de centro
    if(D>=3.4){ R(x0, 2.3, 0.8, 0.8); R(x0+sw-0.8, 2.3, 0.8, 0.8) } if(W>=4) C(W-0.5, 0.55, 0.35, "planta") }
  else if(k==="pilotis"){ for(let x=0.6; x+1.8<=W-0.4; x+=4.2){ R(x, 0.25, 1.8, 0.5, "equip"); if(x+2.6<W-0.5) C(x+2.6, 0.6, 0.45, "planta") } }
  else if(k==="outro"){ R(W/2-0.9, D/2-0.5, 1.8, 1.0); [0,1].forEach(q=>{ cad(W/2-0.5+q, D/2-0.75); cad(W/2-0.5+q, D/2+0.75) }) }
  return out;
}
/* piscina: lâmina com raias e prainha, borda/solário em volta e espreguiçadeiras no lado do sol */
function cmnPiscinaMoveis(g, pool, borda, ladoPr){
  // referencial com y = 0 na ponta da prainha (lado curto): prainha rasa de até 2,4 m, raias de 2,0 m no comprimento, escada na outra ponta
  const out=[], F=cmnQuadro(g, pool, ladoPr), W=F.W, D=F.D;
  const R=(x,y,w,h,cl)=>out.push({t:"r", cl, pts:[F.G(x,y),F.G(x+w,y),F.G(x+w,y+h),F.G(x,y+h)]});
  const pr=Math.min(2.4, D*0.22); R(0, 0, W, pr, "prainha");
  for(let x=0.3; x<W-0.2; x+=0.6) out.push({t:"l", cl:"degrau", pts:[F.G(x,pr), F.G(Math.min(W,x+0.3),pr)]});
  const nR=Math.max(1,Math.floor(W/2.0)); for(let q=1;q<nR;q++) out.push({t:"l", cl:"raia", pts:[F.G(q*W/nR, pr+0.6), F.G(q*W/nR, D-0.6)]});
  R(W-0.9, D-0.35, 0.6, 0.25, "escada");
  return out;
}
/* ---------- planejador genérico (térreo, pavimento de lazer, rooftop) ---------- */
function cmnPlaneja(g, lista, o){
  const rb=Math.max(1,Math.ceil(((o.galeria||1.5)/g.res-1)/2)), feitos=[], falta=[], luz=o.luz, SZ=luz? [0,1,2,3].map(d=>cmnPS(g, k=>luz[k*4+d])) : null;
  let id=o.id0||10;
  const poe=(a, flex, extra={})=>{ const c=CMN_CAT[a.k];
    const par = a.par && feitos.find(f=>f.id===a.par);
    const cands=cmnPoe(g, a, {luz, flex, ancora: a.grupo==="servico"? o.ancoraServ||o.ancora : o.ancora, pesoAncora: a.grupo==="acesso"? 2.5 : a.grupo==="servico"? 0.9 : 0.35,
      par: par? par.cod : null, parObrig: !!par, porta: true, todos:true, SZ, extra:o.extra? (r,ct)=>o.extra(a,r,ct,feitos) : null, ...extra});
    if(!cands.length) return null;
    // não ilhar área livre: o ambiente não pode fechar o acesso a um vão livre (> 4 m²) atrás dele
    let ilh0=null, fol0=null; const cod=id++, lim=Math.round(4/(g.res*g.res)); let r=null;
    for(const cd of cands){ if(!cd.frT){ cmnMarca(g, cd, cod); r=cd; break }   // encostado em tudo: não ilha nada
      if(fol0==null) fol0=cmnFolga(g, v=>v===CL||cmnCirc(v));
      cmnMarca(g, cd, cod); const lc=cmnIlhaLocal(g, fol0, cd); if(lc===1){ r=cd; break } if(lc===0){ cmnMarca(g, cd, CL); continue }
      if(ilh0==null){ cmnMarca(g, cd, CL); ilh0=cmnIlhadas(g, fol0, null); cmnMarca(g, cd, cod) }
      if(cmnIlhadas(g, fol0, cd)-ilh0<=lim){ r=cd; break } cmnMarca(g, cd, CL) }
    if(!r){ id--; return null }
    const f={...a, cod, r, ct:r.ct, poly:cmnRetPoly(g,r), area:r.w*r.h*g.res*g.res, reduzido:r.f<0.9, nomeCat:c.nome}; feitos.push(f); return f };
  const pend=lista.slice();
  for(let rodada=0; rodada<6 && pend.length; rodada++){
    for(let q=0;q<pend.length;){ const f=poe(pend[q], null); if(f) pend.splice(q,1); else q++ }
    if(!pend.length) break;
    if(!cmnRamal(g, rb)) break;
  }
  // o que ainda falta: tenta menor (até 75%), avisando
  for(let q=0;q<pend.length;){ const f=poe(pend[q], null, {fMin:0.72}); if(f) pend.splice(q,1); else q++ }
  pend.forEach(a=>falta.push(a));
  return {feitos, falta, rb};
}
/* sobras: faixas estreitas encostadas no ambiente viram parte dele; o que encosta na circulação vira circulação */
function cmnSobras(g, feitos){
  const lim=Math.round(1.25/g.res);
  feitos.forEach(f=>{ const r=f.r;
    for(let volta=0;volta<2;volta++) for(const lado of [0,1,2,3]){
      for(let t=1;t<=lim;t++){ const s= lado===0? {i:r.i-t,j:r.j,w:t,h:r.h} : lado===1? {i:r.i+r.w,j:r.j,w:t,h:r.h} : lado===2? {i:r.i,j:r.j-t,w:r.w,h:t} : {i:r.i,j:r.j+r.h,w:r.w,h:t};
        let ok=true; for(let j=s.j;j<s.j+s.h&&ok;j++) for(let i=s.i;i<s.i+s.w;i++) if(g.at(i,j)!==CL){ ok=false; break } if(!ok) break;
        // além da faixa: parede/limite (sobra presa) → incorpora
        const alem= lado===0? [s.i-1,null] : lado===1? [s.i+s.w,null] : lado===2? [null,s.j-1] : [null,s.j+s.h];
        let preso=true; if(lado<2){ for(let j=s.j;j<s.j+s.h;j++){ const v=g.at(alem[0],j); if(v===CL||cmnCirc(v)){ preso=false; break } } } else { for(let i=s.i;i<s.i+s.w;i++){ const v=g.at(i,alem[1]); if(v===CL||cmnCirc(v)){ preso=false; break } } }
        if(preso && (r.w*r.h + s.w*s.h)*g.res*g.res <= f.A*1.3){ cmnMarca(g, s, f.cod); if(lado===0){ r.i-=t; r.w+=t } else if(lado===1) r.w+=t; else if(lado===2){ r.j-=t; r.h+=t } else r.h+=t; break } } } });
  feitos.forEach(f=>{ f.poly=cmnRetPoly(g,f.r); f.area=f.r.w*f.r.h*g.res*g.res });
}
/* ambientes que ficaram menores que o programa crescem para o vão livre ao lado (faixa inteira de um lado, sem passar da
   área pedida + 8%, sem ficar comprido demais e sem fechar o acesso a outro vão) */
function cmnCresce(g, lst){
  const res=g.res, lim=Math.round(4/(res*res));
  lst.forEach(f=>{ const c=CMN_CAT[f.k]; if(!c) return;
    for(let volta=0; volta<6; volta++){ const r=f.r, a0=r.w*r.h*res*res; if(a0>=f.A*0.97) break;
      let best=null;
      for(const d of [0,1,2,3]){
        for(let t=1;;t++){ const s= d===0? {i:r.i-t,j:r.j,w:t,h:r.h} : d===1? {i:r.i+r.w,j:r.j,w:t,h:r.h} : d===2? {i:r.i,j:r.j-t,w:r.w,h:t} : {i:r.i,j:r.j+r.h,w:r.w,h:t};
          let ok=true; const so= d===0? {i:s.i,j:s.j,w:1,h:s.h} : d===1? {i:s.i+s.w-1,j:s.j,w:1,h:s.h} : d===2? {i:s.i,j:s.j,w:s.w,h:1} : {i:s.i,j:s.j+s.h-1,w:s.w,h:1};
          for(let j=so.j;j<so.j+so.h&&ok;j++) for(let i=so.i;i<so.i+so.w;i++) if(g.at(i,j)!==CL){ ok=false; break }
          if(!ok) break;
          const w=r.w+(d<2?t:0), h=r.h+(d>=2?t:0), A=w*h*res*res; if(A>f.A*1.08) break;
          if(Math.max(w,h)/Math.min(w,h) > c.prop+0.2) continue;
          const sc=-Math.abs(f.A-A); if(!best || sc>best.sc) best={d,t,s,sc} } }
      if(!best) break;
      const fol=cmnFolga(g, v=>v===CL||cmnCirc(v)), il0=cmnIlhadas(g, fol, null);
      cmnMarca(g, best.s, f.cod); if(cmnIlhadas(g, fol, best.s)-il0>lim){ cmnMarca(g, best.s, CL); break }
      const d=best.d, t=best.t; if(d===0){ r.i-=t; r.w+=t } else if(d===1) r.w+=t; else if(d===2){ r.j-=t; r.h+=t } else r.h+=t }
    f.poly=cmnRetPoly(g,f.r); f.area=f.r.w*f.r.h*res*res; f.reduzido = f.area < f.A*0.9 });
}
/* componentes de células livres: ligadas à circulação viram circulação (se pequenas) ou área livre */
function cmnLivres(g, maxCirc){
  const n=g.nx*g.ny, vis=new Uint8Array(n), out=[];
  for(let k=0;k<n;k++){ if(g.c[k]!==CL || vis[k]) continue; const comp=[k]; vis[k]=1; let toca=false;
    for(let q=0;q<comp.length;q++){ const c=comp[q], i=c%g.nx, j=(c/g.nx)|0;
      for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){ const v=g.at(i+a,j+b); if(cmnCirc(v)) toca=true; if(v!==CL) continue; const kk=(j+b)*g.nx+i+a; if(!vis[kk]){ vis[kk]=1; comp.push(kk) } } }
    const A=comp.length*g.res*g.res;
    if(toca && A<=maxCirc){ comp.forEach(c=>g.c[c]=CC) } else out.push({cells:comp, A, toca}) }
  return out;
}

/* ---------- portas e janelas de um ambiente ---------- */
function cmnPortas(g, f, ancora, partners){
  const c=CMN_CAT[f.k], r=f.r, res=g.res, w=c.porta||0.9, need=Math.ceil(w/res)+1, out=[];
  const lados=[[r.i-1,r.j,0,1,r.h,0],[r.i+r.w,r.j,0,1,r.h,1],[r.i,r.j-1,1,0,r.w,2],[r.i,r.j+r.h,1,0,r.w,3]];
  const runs=[];
  lados.forEach(([i0,j0,di,dj,n,d])=>{ let a=-1; for(let t=0;t<=n;t++){ const v=t<n? g.at(i0+di*t,j0+dj*t) : null, ok=t<n && (partners? partners(v) : cmnCirc(v)); if(ok && a<0) a=t; if(!ok && a>=0){ if(t-a>=need) runs.push({d,a,b:t,i0,j0,di,dj}); a=-1 } } });
  if(!runs.length) return out;
  const pt=(R,t)=>{ const i=R.i0+R.di*t, j=R.j0+R.dj*t; return [g.cu(i), g.cv(j)] };
  runs.sort((A,B)=>{ const ca=pt(A,(A.a+A.b)/2), cb=pt(B,(B.a+B.b)/2); return (ancora? Math.hypot(ca[0]-ancora[0],ca[1]-ancora[1]) : 0) - (ancora? Math.hypot(cb[0]-ancora[0],cb[1]-ancora[1]) : 0) });
  const R=runs[0];
  // porta perto da ponta do trecho mais próxima da âncora (fluxo), sem encostar no canto
  const t0 = ancora && (()=>{ const pa=pt(R,R.a), pb=pt(R,R.b-1); return Math.hypot(pa[0]-ancora[0],pa[1]-ancora[1]) <= Math.hypot(pb[0]-ancora[0],pb[1]-ancora[1]) })() ? R.a+1 : Math.max(R.a+1, R.b-need);
  const tm = R.b-R.a > need*3 ? (ancora? t0 : Math.round((R.a+R.b-need)/2)) : Math.round((R.a+R.b-need)/2)+0.5;
  // segmento da porta na face do ambiente
  const face = R.d===0? g.u0+r.i*res : R.d===1? g.u0+(r.i+r.w)*res : R.d===2? g.v0+r.j*res : g.v0+(r.j+r.h)*res;
  const s0 = (R.d<2? g.v0+(R.j0+tm)*res : g.u0+(R.i0+tm)*res) + 0.05, s1 = s0+w;
  const P=(s)=> R.d<2? g.W(face, s) : g.W(s, face);
  const nIn = R.d===0? g.W(1,0) : R.d===1? g.W(-1,0) : R.d===2? g.W(0,1) : g.W(0,-1);
  out.push({p0:P(s0), p1:P(s1), n:nIn, w, d:R.d});
  return out;
}
function cmnJanelas(g, f, luz){
  if(!luz) return [];
  const r=f.r, res=g.res, out=[];
  const lados=[[r.i,r.j,0,1,r.h,0],[r.i+r.w-1,r.j,0,1,r.h,1],[r.i,r.j,1,0,r.w,2],[r.i,r.j+r.h-1,1,0,r.w,3]];
  lados.forEach(([i0,j0,di,dj,n,d])=>{ let a=-1, fr=1; for(let t=0;t<=n;t++){ const k=(j0+dj*t)*g.nx+i0+di*t, lz=t<n? luz[k*4+d] : 0; if(lz && a<0){ a=t; fr=lz } if(!lz && a>=0){ if(t-a>=4){
      const face = d===0? g.u0+r.i*res : d===1? g.u0+(r.i+r.w)*res : d===2? g.v0+r.j*res : g.v0+(r.j+r.h)*res;
      const s0=(d<2? g.v0+(j0+a)*res : g.u0+(i0+a)*res)+0.45, s1=(d<2? g.v0+(j0+t)*res : g.u0+(i0+t)*res)-0.45;
      if(s1-s0>0.6){ const P=s=> d<2? g.W(face,s) : g.W(s,face); const nOut = d===0? g.W(-1,0) : d===1? g.W(1,0) : d===2? g.W(0,-1) : g.W(0,1); out.push({p0:P(s0), p1:P(s1), n:nOut, fraca: fr<1, len:s1-s0}) } } a=-1 } } });
  return out;
}
const cmnLadoLuz=(f)=>{ const L=f.ct? f.ct.luzLado : [0,0,0,0]; let b=-1, d=2; L.forEach((x,q)=>{ if(x>b){ b=x; d=q } }); return b>0? d : null };
const cmnLadoCirc=(g,f)=>{ const ct=cmnContato(g, f.r, null, null); let b=-1, d=3; ct.circLado.forEach((x,q)=>{ if(x>b){ b=x; d=q } }); return d };
const cmnOposto=d=>[1,0,3,2][d];

/* ---------- térreo ---------- */
function comunsTerreo(st, m, prog){
  const T=m.ter||{}; if(!T.fd || !m.emb.length) return null;
  const ux=T.lat, vy=T.fd, L=st.lote.pts, C=st.comuns||{};
  // malha só em volta do hall (o resto do térreo é garagem): com 3 m de folga para a fachada e os acessos
  const regs0=[...(T.hallBand||[]), ...(T.pass||[]), ...(T.cols||[]), ...(T.colsGar||[]), ...(T.walk||[]), ...(m.coreSets||[]).map(cs=>cs.lobby||[])].filter(p=>p&&p.length>2);
  const ext=(regs0.length? regs0 : [m.emb]).map(p=>{ const c=G.centroid(p); return p.map(q=>q) });
  const bb=(()=>{ let u0=1e9,u1=-1e9,v0=1e9,v1=-1e9; ext.forEach(p=>p.forEach(q=>{ const u=G.dot(q,ux), v=G.dot(q,vy); u0=Math.min(u0,u); u1=Math.max(u1,u); v0=Math.min(v0,v); v1=Math.max(v1,v) })); return G.rect(ux,vy,u0-3,v0-3,u1-u0+6,v1-v0+6) })();
  const g=cmnGrade(ux, vy, [bb]);
  // recuo (externo) e o que é do hall
  cmnPinta(g, L, CE); cmnPinta(g, m.emb, CF);
  const regs=[...(T.hallBand||[]), ...(T.pass||[]), ...(T.cols||[])];
  regs.forEach(p=>cmnPinta(g, p, CL, v=>v===CF));
  // obstáculos: núcleos, rampas, faixa de veículos, garagem; alvos: hall dos elevadores e passagens até núcleos na garagem
  const cores=m.coreSets||[];
  [...(T.drive||[]), ...(T.driveRua||[])].forEach(p=>cmnPinta(g, p, CO));
  ((m.vert&&m.vert.floors&&m.vert.floors.ter&&m.vert.floors.ter.ramps)||[]).forEach(r=>cmnPinta(g, r.poly, CO));
  (m.vf&&m.vf.vagas||[]).forEach(v=>cmnPinta(g, v.poly, CO, x=>x===CE));
  const alvos=[];
  cores.forEach(cs=>{ const lay=cs.lay||{}, nuc=lay.nucleo;
    cmnPinta(g, cs.core, CO); (lay.coreExtra||[]).forEach(p=>cmnPinta(g,p,CO));
    const set=new Set();
    if(cs.lobby && cs.lobby.length) cmnPinta(g, cs.lobby, CA);
    else if(nuc && Array.isArray(nuc.portas)) nuc.portas.filter(p=>p.tipo!=="servico").forEach(p=>{ const c=p.p||p; cmnPinta(g, G.rect(ux,vy,G.dot(c,ux)-0.6,G.dot(c,vy)-0.6,1.2,1.2), CA, v=>v!==CO) });
    alvos.push({torre:cs.i, set, poly:cs.lobby}) });
  (T.walk||[]).forEach((p,q)=>cmnPinta(g, p, CA, v=>v===CF||v===CL));
  (T.colsGar||[]).forEach(p=>cmnPinta(g, p, CA, v=>v===CF));   // bloco do hall em volta do núcleo dentro da garagem: área de pedestres
  // alvos por componente (cada hall de elevadores / passagem à garagem)
  { const vis=new Uint8Array(g.nx*g.ny); alvos.length=0;
    for(let k=0;k<g.nx*g.ny;k++){ if(g.c[k]!==CA||vis[k]) continue; const comp=[k]; vis[k]=1;
      for(let q=0;q<comp.length;q++){ const c=comp[q], i=c%g.nx, j=(c/g.nx)|0; [[1,0],[-1,0],[0,1],[0,-1]].forEach(([a,b])=>{ const kk=(j+b)*g.nx+i+a; if(g.at(i+a,j+b)===CA && !vis[kk]){ vis[kk]=1; comp.push(kk) } }) }
      const cu=comp.reduce((s,c)=>s+g.cu(c%g.nx),0)/comp.length, cv=comp.reduce((s,c)=>s+g.cv((c/g.nx)|0),0)/comp.length, P=g.W(cu,cv);
      const cs=cores.find(cs=>cs.lobby && cs.lobby.length && G.pip(P, cs.lobby)) || cores.slice().sort((a,b)=>Math.hypot(...[0,1].map(t=>G.centroid(a.core)[t]-P[t]))-Math.hypot(...[0,1].map(t=>G.centroid(b.core)[t]-P[t])))[0];
      alvos.push({set:new Set(comp), c:[cu,cv], torre: cs? cs.i : null, P}) } }
  const luz=cmnLuzMapa(g, st, m);
  const res=g.res, rb=Math.max(1,Math.ceil(((+C.galeria||1.5)/res-1)/2));
  const amb=[], falta=[], avisos=[];
  const byK=k=>prog.filter(a=>a.k===k && a.local==="terreo");
  // 1. entrada: coluna livre mais próxima do acesso de pedestres, encostada na fachada
  const uPed=G.dot(m.acesso.ped, ux), uVei=G.dot((T.veiReal||m.acesso.vei), ux), veiFrente=!(m.acesso.edgeV!=null && m.acesso.edgeV!==m.acesso.edge);
  const dmn=T.dmn;
  let ent=null;
  for(let j=0;j<g.ny && !ent;j++){ let melhor=null; for(let i=0;i<g.nx;i++){ if(g.c[j*g.nx+i]!==CL) continue; const below=g.at(i,j-1); if(below!==CF && below!==CE) continue; const d=Math.abs(g.cu(i)-uPed); if(!melhor || d<melhor.d) melhor={i,j,d} } if(melhor && g.cv(j)<dmn+12) ent=melhor }
  if(!ent){ for(let k=0;k<g.nx*g.ny;k++) if(g.c[k]===CL){ ent={i:k%g.nx, j:(k/g.nx)|0, d:0}; break } }
  if(!ent) return {g, amb, falta:prog.filter(a=>a.local==="terreo"&&!a.desc&&CMN_CAT[a.k].onde!=="recuo"), avisos:["O térreo não tem área para o hall e as áreas comuns."], circ:[], rota:[], luz};
  let ancora=[g.cu(ent.i), g.cv(ent.j)];
  const novo=(a, r, extra={})=>{ const cod=10+amb.length+100; cmnMarca(g, r, cod); const f={...a, cod, r, poly:cmnRetPoly(g,r), area:r.w*r.h*res*res, ...extra}; amb.push(f); return f };
  // 2. clausura na fachada, centrada no acesso
  const cl=byK("clausura")[0], pt=byK("portaria")[0], hl=byK("hall")[0];
  const sLivre=cmnSoma(g, v=>v===CL);
  const cabe=(r)=> r.i>=0 && r.j>=0 && r.i+r.w<=g.nx && r.j+r.h<=g.ny && cmnRetS(sLivre,g,r.i,r.j,r.w,r.h)===r.w*r.h;
  const clD=Math.round(2.7/res);
  let rCl=null;
  // na fachada (fileira livre com o recuo/rua logo abaixo), a mais perto do acesso de pedestres; 2,40 m de frente (ou 1,80 m)
  for(const clW of [Math.round(2.4/res), Math.round(1.8/res)]){ let best=null;
    for(let j=0;j<g.ny;j++){ if(g.cv(j)>dmn+14) break;
      for(let i=0;i+clW<=g.nx;i++){ const r={i,j,w:clW,h:clD}; if(!cabe(r)) continue;
        let fach=0; for(let t=0;t<clW;t++){ const v=g.at(i+t,j-1); if((v===CE||v===CF) && !G.pip(g.W(g.cu(i+t), g.cv(j-1)-res*0.4), m.emb)) fach++ } if(fach<clW) continue;   // fachada de verdade (rua/recuo), não a loja
        // atrás dela precisa caber o hall (3,6 × 3,0 m livres) e, ao lado, a portaria na fachada
        const hw=Math.round(2.4/res), hd=Math.round(3.0/res), atras=[0,-Math.round((hw-clW)/2),clW-hw].some(di=>cabe({i:i+di, j:j+clD, w:hw, h:hd}));
        const pw=Math.round(2.7/res), pd=Math.round(3.3/res), lado=cabe({i:i+clW, j, w:pw, h:pd}) || cabe({i:i-pw, j, w:pw, h:pd});
        const sc=-Math.abs(g.u0+(i+clW/2)*res-uPed) - 2*(g.v0+j*res-dmn) + (atras? 16 : 0) + (lado? 6 : 0); if(!best||sc>best.sc) best={...r,sc} } }
    if(best){ rCl={i:best.i,j:best.j,w:best.w,h:best.h}; break } }
  let fCl=null, fPt=null, fHall=null;
  if(cl && rCl){ fCl=novo(cl, rCl); ancora=[g.u0+(rCl.i+rCl.w/2)*res, g.v0+(rCl.j+rCl.h)*res] }
  else if(cl) falta.push({...cl, motivo:"a entrada de pedestres tem menos de 1,80 m de largura livre"});
  // 4. portaria ao lado da clausura, na fachada, do lado do portão de veículos (vê os dois acessos) e com visor para o hall
  if(pt){ const pw=Math.round(2.7/res), pd=Math.max(Math.round(2.4/res), Math.round((pt.A/2.7)/res)); let rPt=null;
    if(rCl){ let lados = (veiFrente && uVei < g.cu(rCl.i))? [-1,1] : [1,-1]; 
      const sL=cmnSoma(g, v=>v===CL), ok=r=> r.i>=0 && r.j>=0 && r.i+r.w<=g.nx && r.j+r.h<=g.ny && cmnRetS(sL,g,r.i,r.j,r.w,r.h)===r.w*r.h;
      for(const sg of lados){ if(rPt) break; for(let dj=0; dj<=2 && !rPt; dj++) for(const [w,h] of [[pw,pd],[pd,pw]]){ const r= sg>0? {i:rCl.i+rCl.w, j:rCl.j+dj, w, h} : {i:rCl.i-w, j:rCl.j+dj, w, h}; if(ok(r)){ rPt=r; break } } } }
    if(rPt) fPt=novo(pt, rPt, {visao:true});
  }
  // 3. hall social: retângulo encostado numa face interna da clausura (fundo ou lateral), com o tamanho do programa; de
  //    preferência já chegando ao hall dos elevadores
  if(hl && fCl){ const sL=cmnSoma(g, v=>v===CL), sA=cmnPS(g, k=>g.c[k]===CA?1:0), mn=Math.round(2.1/res), need=Math.round(1.2/res), cr=fCl.r, A=hl.A;
    let best=null;
    for(const f of [1, 0.85, 0.7, 0.55, 0.4]){
      for(let rr=1; rr<=3.2+1e-6; rr+=0.3){ const w0=Math.sqrt(A*f*rr)/res, h0=A*f/(w0*res)/res;
        for(const [W_,H_] of [[w0,h0],[h0,w0]]){ const w=Math.max(mn,Math.round(W_)), h=Math.max(mn,Math.round(H_)), cand=[];
          for(let i=cr.i-w+need; i<=cr.i+cr.w-need; i++) cand.push([i, cr.j+cr.h, 3]);
          for(let j=cr.j; j<=cr.j+cr.h-need; j++){ cand.push([cr.i-w, j, 0]); cand.push([cr.i+cr.w, j, 1]) }
          for(const [i,j,face] of cand){ if(i<0||j<0||i+w>g.nx||j+h>g.ny || cmnRetS(sL,g,i,j,w,h)!==w*h) continue;
            const r_={i,j,w,h}; let lob=0; for(let d=0;d<4;d++) lob+=cmnQ(sA,g,...cmnLadoFora(r_,d));
            const sc=f*100 + (lob>=need? 30 : 0) + (face===3? 10 : 0) - 3*(Math.max(w,h)/Math.min(w,h)-1) - 0.4*Math.abs((i+w/2)-(cr.i+cr.w/2))*res;
            if(!best || sc>best.sc) best={...r_, sc, f, face} } } }
      if(best) break }
    if(best){ fHall=novo(hl, best); fCl.faceHall=best.face; g.c.forEach((v,k)=>{ if(v===fHall.cod) g.c[k]=CH }) }
    else falta.push({...hl, nivel:"warn", motivo:"não há 2,1 m livres atrás da clausura (o núcleo ou as lojas fecham a entrada); a galeria de entrada faz as vezes de hall"}) }
  // a clausura abre para o hall: conta como circulação para quem está atrás dela
  if(fCl && !fHall){ const nr=Math.round(1.5/res); for(let i=fCl.r.i;i<fCl.r.i+fCl.r.w;i++) for(let t=0;t<nr;t++){ const j=fCl.r.j+fCl.r.h+t; if(g.at(i,j)!==CL) break; g.c[j*g.nx+i]=CH } }
  if(fHall) fHall.hallCirc=true;
  // passagem pelas lojas: circulação
  (T.pass||[]).forEach(p=>cmnPinta(g, p, CC, v=>v===CL));
  // 5–6. galerias até o hall dos elevadores de cada torre e ambientes ao longo delas: três partidos de galeria (mais curta,
  //      rente às paredes, pelo meio do vão); fica o que acomoda mais programa, com luz, com menos galeria
  const lista=prog.filter(a=>a.local==="terreo" && !a.desc && !["clausura","hall"].includes(a.k) && !(a.k==="portaria" && fPt) && CMN_CAT[a.k].onde!=="recuo");
  const prio=a=> a.k==="portaria"? -1 : a.k==="salao"? 0 : a.k==="copa"? 1 : a.grupo==="lazer"? 2+1/(a.A+1) : a.k==="wc"? 3 : 4+1/(a.A+1);
  lista.sort((a,b)=>prio(a)-prio(b) || b.A-a.A);
  // entrada de serviço: junto da garagem do térreo ou do acesso de veículos
  const dv=T.drive0&&T.drive0.dv, ancServ = T.gar&&T.gar.length? [dv? (dv[0]+dv[1])/2 : (T.lmn+T.lmx)/2, T.d2] : dv? [(dv[0]+dv[1])/2, T.dmn+4] : ancora;
  // até 5 m das fachadas com janela possível: lugar de ambiente, não de galeria
  const perto=new Uint8Array(g.nx*g.ny); { const Q=[], dd=new Int16Array(g.nx*g.ny).fill(999), lim=Math.round(5/res);
    for(let k=0;k<g.nx*g.ny;k++) if(g.c[k]===CL && (luz[k*4]||luz[k*4+1]||luz[k*4+2]||luz[k*4+3])>=1){ dd[k]=0; Q.push(k) }
    for(let q=0;q<Q.length;q++){ const k=Q[q]; perto[k]=1; if(dd[k]>=lim) continue; const i=k%g.nx, j=(k/g.nx)|0; for(const [a,b] of cmnDI){ const kk=(j+b)*g.nx+i+a; if(g.at(i+a,j+b)===CL && dd[kk]>dd[k]+1){ dd[kk]=dd[k]+1; Q.push(kk) } } } }
  const base=g.c.slice(), nBase=amb.length;
  let melhor=null, ligacoes=[];
  for(const modo of ["neutro","centro","fachada"]){
    g.c.set(base); amb.length=nBase;
    const lig=[];
    if(modo==="fachada" && !cmnGaleriaFachada(g, luz, rb)) continue;
    alvos.forEach(al=>{ const toca=[...al.set].some(k=>{ const i=k%g.nx, j=(k/g.nx)|0; return cmnDI.some(([a,b])=>{ const v=g.at(i+a,j+b); return v===CC||v===CH }) });
      if(toca){ lig.push({al, ok:true}); return }
      const r=cmnLiga(g, al.set, rb, modo, perto); lig.push({al, ok:!!r, estreito: r&&r.estreito}) });
    const pl=cmnPlaneja(g, lista, {luz, galeria:+C.galeria||1.5, ancora, ancoraServ:ancServ, id0:300,
      extra:(a,r,ct,feitos)=>{ // sanitários perto do salão / gourmet
        let sc=0; if(a.k==="wc"){ const alvo=feitos.find(f=>f.k==="salao"||f.k==="gourmet"); if(alvo){ const cu=g.u0+(r.i+r.w/2)*res, cv=g.v0+(r.j+r.h/2)*res, au=g.u0+(alvo.r.i+alvo.r.w/2)*res, av=g.v0+(alvo.r.j+alvo.r.h/2)*res; sc-=0.8*Math.hypot(cu-au,cv-av) } }
        return sc } });
    let nota=0; pl.feitos.forEach(f=>{ const c=CMN_CAT[f.k]; nota += f.A*(c.luz==="sim"? (f.ct&&f.ct.luz>0? 1.5 : 0.75) : 1) * Math.min(1, f.area/f.A) });
    pl.falta.forEach(a=>nota -= a.A*(a.obrig? 2.5 : 1.6));
    lig.forEach(l=>{ if(!l.ok) nota-=200 });
    let nC=0; for(let k=0;k<g.c.length;k++) if(g.c[k]===CC) nC++; nota -= 0.3*nC*res*res;
    (typeof CMN_DEBUG!=="undefined") && CMN_DEBUG.push({modo, nota:Math.round(nota), falta:pl.falta.map(a=>a.nome), semLuz:pl.feitos.filter(f=>CMN_CAT[f.k].luz==="sim"&&!(f.ct&&f.ct.luz>0)).map(f=>f.nome)});
    if(!melhor || nota>melhor.nota) melhor={nota, modo, c:g.c.slice(), feitos:pl.feitos, falta:pl.falta, lig};
  }
  g.c.set(melhor.c); amb.length=nBase; ligacoes=melhor.lig;
  melhor.feitos.forEach(f=>amb.push(f));
  melhor.falta.forEach(a=>falta.push({...a, motivo: cmnMotivoFalta(a, g)}));
  cmnSobras(g, amb.filter(f=>!["clausura","portaria"].includes(f.k)));
  cmnCresce(g, amb.filter(f=>!["clausura","portaria","hall"].includes(f.k) && f.area<f.A*0.97));
  const livres=cmnLivres(g, 15);
  // sobras grandes: abertas para a circulação viram estar (até ~40 m²) ou área livre coberta (pilotis), com bancos e
  // jardineiras; fechadas (sem acesso pela circulação) ficam como reserva técnica
  const sobra=livres.filter(x=>x.A>=4).map(x=>({A:x.A, rets:cmnRetangulosDe(g, x.cells), toca:x.toca}));
  const estar=sobra.map(x=>{ const r=x.rets.slice().sort((a,b)=>b.w*b.h-a.w*a.h)[0]; if(!r) return null;
    const k= !x.toca? "reserva" : x.A>=40? "pilotis" : "estar", nome= k==="reserva"? "Reserva técnica" : k==="pilotis"? "Área livre coberta" : "Estar";
    const e={k, nome, area:x.A, poly:cmnRetPoly(g,r), r, toca:x.toca}; const cl=cmnContato(g, r, null, null).circLado, ld= r.w>=r.h? (cl[2]<=cl[3]? 2 : 3) : (cl[0]<=cl[1]? 0 : 1);   // bancos no lado comprido, longe da passagem
    e.moveis= k==="reserva"? [] : cmnMoveis(g, {k, r}, k==="estar"? cmnOposto(cmnLadoCirc(g,{r})) : ld, 3); return e }).filter(Boolean);
  // portas, janelas e mobiliário
  amb.forEach(f=>{
    if(f.k==="hall"){ f.portas=[]; }
    else if(f.k==="clausura"){ const r=f.r, P=(u,v)=>g.W(u,v), u0=g.u0+r.i*res, v0=g.v0+r.j*res, w=r.w*res, h=r.h*res;
      const fh=f.faceHall??3, dent= fh===0? {p0:P(u0,v0+h/2+0.5), p1:P(u0,v0+h/2-0.5), n:g.W(-1,0), d:0} : fh===1? {p0:P(u0+w,v0+h/2-0.5), p1:P(u0+w,v0+h/2+0.5), n:g.W(1,0), d:1} : {p0:P(u0+w/2-0.5,v0+h), p1:P(u0+w/2+0.5,v0+h), n:g.W(0,1), d:3};
      f.portas=[{p0:P(u0+w/2-0.5,v0), p1:P(u0+w/2+0.5,v0), n:g.W(0,1), w:1.0, d:2, portao:true}, {...dent, w:1.0}] }
    else if(f.k==="copa"){ const sal=amb.find(x=>x.id===f.par); f.portas=[...(sal? cmnPortas(g, f, null, v=>v===sal.cod) : []), ...cmnPortas(g, f, ancServ)].slice(0,2) }
    else if(f.k==="portaria" && fCl){ const pc=fCl.cod; f.portas=cmnPortas(g, f, ancora, v=>cmnCirc(v)||v===pc); if(!f.portas.length) f.portas=cmnPortas(g, f, ancora) }   // o porteiro entra pelo hall ou pela clausura
    else f.portas=cmnPortas(g, f, f.grupo==="servico"? ancServ : ancora);
    f.janelas = CMN_CAT[f.k].luz? cmnJanelas(g, f, luz) : [];
    const lzD=cmnLadoLuz(f), cD=cmnLadoCirc(g,f);
    f.moveis=cmnMoveis(g, f, f.k==="hall"? (fCl? 2 : cD) : lzD!=null? lzD : cmnOposto(cD), cD);
    f.luzM=(f.ct? f.ct.luz : cmnContato(g,f.r,luz,null).luz)*res;
  });
  // rota acessível: do portão ao hall e do hall a cada hall de elevadores e a cada porta
  const rota=[], passa=k=>cmnCirc(g.c[k]) || (fCl && g.c[k]===fCl.cod);
  const fonteHall=k=> fHall? g.c[k]===CH : fCl? g.c[k]===fCl.cod : false;
  // (com o núcleo novo, lay.nucleo.portas: a rota termina na porta do elevador mais perto, atravessando o hall dos elevadores)
  const portaElev=(torre, P)=>{ const cs=cores.find(c=>c.i===torre), ps=((cs&&cs.lay&&cs.lay.nucleo&&cs.lay.nucleo.portas)||[]).filter(q=>q.tipo==="elev" && q.p);
    return ps.length? ps.slice().sort((a,b)=>Math.hypot(a.p[0]-P[0],a.p[1]-P[1])-Math.hypot(b.p[0]-P[0],b.p[1]-P[1]))[0].p : null };
  ligacoes.forEach(l=>{ const al=l.al, p=cmnCaminho(g, fonteHall, k=>al.set.has(k), passa, null); l.ok=!!p;
    if(p){ const pts=cmnPolilinha(g,p), pe=al.torre!=null? portaElev(al.torre, pts[pts.length-1]) : null; if(pe) pts.push(pe); rota.push({para: al.torre!=null? `Torre ${al.torre+1}` : "garagem", pts, torre:al.torre}) } else rota.push({para: al.torre!=null? `Torre ${al.torre+1}` : "garagem", pts:[], sem:true, torre:al.torre}) });
  amb.forEach(f=>{ if(f.k==="hall"||f.k==="clausura"||!f.portas||!f.portas.length) return; const pd=f.portas[f.portas.length>1&&f.k==="copa"? 1 : 0]; if(!pd) return;
    const pm=[(pd.p0[0]+pd.p1[0])/2-pd.n[0]*0.3, (pd.p0[1]+pd.p1[1])/2-pd.n[1]*0.3], q=g.U(pm), ti=Math.floor((q[0]-g.u0)/res), tj=Math.floor((q[1]-g.v0)/res), kt=tj*g.nx+ti;
    const p=cmnCaminho(g, fonteHall, k=>k===kt, passa, null); f.rotaOk=!!p || fonteHall(kt); if(p && CMN_CAT[f.k].grupo==="lazer") rota.push({para:f.nome, pts:cmnPolilinha(g,p), amb:f.id}) });
  // circulação desenhada
  const circ=cmnRetangulos(g, v=>v===CC).map(r=>cmnRetPoly(g,r));
  const hallExt=cmnRetangulos(g, v=>v===CH).map(r=>cmnRetPoly(g,r));
  return {g, amb, falta, avisos, circ, hallExt, rota, luz, ligacoes, ent, ancora, ancServ, estar, sobra:sobra.filter(x=>x.toca).flatMap(x=>x.rets.map(r=>cmnRetPoly(g,r))), reserva:sobra.filter(x=>!x.toca).flatMap(x=>x.rets.map(r=>cmnRetPoly(g,r))), sobraA:sobra.reduce((s,x)=>s+x.A,0), fCl, fPt, fHall, uPed, uVei, veiFrente};
}
function cmnRetangulosDe(g, cells){ const c=new Int16Array(g.nx*g.ny); cells.forEach(k=>c[k]=1); return cmnRetangulos({nx:g.nx, ny:g.ny, c}, v=>v===1) }
function cmnMotivoFalta(a, g){ const c=CMN_CAT[a.k]; return `pede ${cmnNf(a.A,0)} m² com ${cmnNf(c.d,1)} m de largura mínima e porta para a circulação` }

/* ---------- recuos: lixo, gás e medidores junto ao alinhamento; descobertos do térreo; paisagismo ---------- */
function cmnRetUV(g, poly){ const P=poly.map(q=>g.U(q)); return [Math.min(...P.map(q=>q[0])), Math.max(...P.map(q=>q[0])), Math.min(...P.map(q=>q[1])), Math.max(...P.map(q=>q[1]))] }
function comunsRecuo(st, m, prog, TR){ const TT0=TR;
  const T=m.ter||{}; if(!T.fd) return null;
  const ux=T.lat, vy=T.fd, L=st.lote.pts, g=cmnGrade(ux, vy, [L]), res=g.res;
  cmnPinta(g, L, CL); cmnPinta(g, m.emb, CO);
  [...(T.drive||[]), ...(T.driveRua||[])].forEach(p=>cmnPinta(g, p, CO));
  (m.vf&&m.vf.vagas||[]).forEach(v=>cmnPinta(g, G.scaleToArea(v.poly, G.area(v.poly))||v.poly, CO));
  // faixa de veículos do alinhamento até o prédio (portão e calçada de acesso)
  const vF=Math.min(...L.map(q=>G.dot(q,vy)).filter((v,i)=>st.lote.front.includes(i)||true));
  const front=st.lote.front.includes(st.lote.principal)? st.lote.principal : st.lote.front[0]||0, fa=L[front], vAl=G.dot(fa,vy);
  const dv=T.drive0&&T.drive0.dv;
  if(dv && !(m.acesso.edgeV!=null && m.acesso.edgeV!==m.acesso.edge)) cmnPinta(g, G.rect(ux,vy,dv[0]-0.3,vAl-1,dv[1]-dv[0]+0.6,T.dmn-vAl+1.2), CO);
  // caminho de pedestres: do portão (alinhamento) até a clausura
  const fCl=TR&&TR.fCl, uC= fCl? g.U(G.centroid(fCl.poly))[0] : G.dot(m.acesso.ped,ux);
  const cam=G.rect(ux,vy,uC-0.8,vAl-0.5,1.6,T.dmn-vAl+0.6); cmnPinta(g, cam, CC, v=>v===CL);
  const amb=[], falta=[], avisos=[];
  const uPed=G.dot(m.acesso.ped,ux), uVei=dv? (dv[0]+dv[1])/2 : G.dot(m.acesso.vei,ux);
  const sL=()=>cmnSoma(g, v=>v===CL);
  const alinh=j=> g.cv(j)-res/2 <= vAl+res*0.6;   // a linha de baixo do retângulo encosta no alinhamento
  const jan=TT0? TT0.amb.flatMap(x=>(x.janelas||[]).map(j=>[g.U(j.p0),g.U(j.p1)])) : [];
  const clU=TT0&&TT0.fCl? cmnRetUV(g, TT0.fCl.poly) : null;
  const poeRecuo=(a, ancU, longe)=>{ const c=CMN_CAT[a.k], s=sL(); let best=null;
    for(const prof of [1.2, 1.5, 2.0, 2.6, 0.8]){ if(prof<c.d-0.01 && a.k!=="medidores") continue; const h=Math.max(2,Math.round(prof/res)), w=Math.max(2,Math.round(a.A/prof/res));
      if(w*res/prof>c.prop+0.01 && a.k!=="medidores") continue;
      for(let j=0;j+h<=g.ny;j++){ if(g.cv(j)>vAl+12) break; for(let i=0;i+w<=g.nx;i++){ if(cmnRetS(s,g,i,j,w,h)!==w*h) continue;
        const cu=g.u0+(i+w/2)*res, dAl=g.v0+j*res-vAl;
        let sc=-Math.abs(cu-ancU)*0.6 - dAl*4 + (longe? Math.min(8,Math.abs(cu-longe))*1.5 : 0);
        if(a.k==="gas"){ const u0=g.u0+i*res, u1=u0+w*res, v0=g.v0+j*res, v1=v0+h*res;   // GLP: ≥ 1,5 m de janelas e ≥ 3 m da entrada
          jan.forEach(([p,q])=>{ const du=Math.max(0, Math.min(p[0],q[0])-u1, u0-Math.max(p[0],q[0])), dv=Math.max(0, Math.min(p[1],q[1])-v1, v0-Math.max(p[1],q[1])); if(Math.hypot(du,dv)<1.5) sc-=60 });
          if(clU){ const du=Math.max(0, clU[0]-u1, u0-clU[1]), dv=Math.max(0, clU[2]-v1, v0-clU[3]); if(Math.hypot(du,dv)<3) sc-=60 } }
        if(!best||sc>best.sc) best={i,j,w,h,sc,dAl} } }
      if(best && best.dAl<0.4) break }
    if(!best) return null;
    const cod=500+amb.length; cmnMarca(g, best, cod); const f={...a, cod, r:best, poly:cmnRetPoly(g,best), area:best.w*best.h*res*res, dAl:best.dAl, recuo:true}; amb.push(f); return f };
  const tec=prog.filter(a=>CMN_CAT[a.k].onde==="recuo");
  const ord=["lixo","medidores","gas"];
  tec.sort((a,b)=>ord.indexOf(a.k)-ord.indexOf(b.k)).forEach(a=>{
    const anc = a.k==="medidores"? uPed+2.2 : a.k==="lixo"? uVei : (uVei+uPed)/2;
    const f=poeRecuo(a, a.k==="gas"? (Math.abs(T.lmn-uPed)>Math.abs(T.lmx-uPed)? T.lmn : T.lmx) : anc, a.k==="gas"? uPed : null);
    if(!f) falta.push({...a, motivo:"não há recuo livre junto ao alinhamento (vagas na frente, acesso de veículos e caminho de pedestres ocupam a frente)"}) });
  // descobertos do térreo nos recuos (playground, quadra…)
  const desc=prog.filter(a=>a.local==="terreo" && a.desc && CMN_CAT[a.k].onde!=="recuo");
  desc.sort((a,b)=>b.A-a.A).forEach(a=>{ const c=CMN_CAT[a.k], s=sL(); let best=null;
    for(const t of cmnTamanhos(a.A, c, res, [1,0.9,0.8])){ for(let j=0;j+t.h<=g.ny;j++) for(let i=0;i+t.w<=g.nx;i++){ if(cmnRetS(s,g,i,j,t.w,t.h)!==t.w*t.h) continue; const sc=t.f*50 - (g.v0+j*res-vAl)*0.05*(-1); if(!best||sc>best.sc) best={i,j,w:t.w,h:t.h,sc,f:t.f} } if(best) break }
    if(!best){ falta.push({...a, motivo:`os recuos não têm ${cmnNf(c.d,1)} m livres para ${cmnNf(a.A,0)} m²`}); return }
    const cod=500+amb.length; cmnMarca(g, best, cod); amb.push({...a, cod, r:best, poly:cmnRetPoly(g,best), area:best.w*best.h*res*res, reduzido:best.f<0.9, recuo:true}) });
  amb.forEach(f=>{ const toward=2; f.moveis=cmnMoveis(g, f, toward, 3); f.portas=[] });
  // paisagismo: o recuo livre com ≥ 0,9 m vira jardim; árvores onde há folga (≥ 1,5 m) a cada ~6 m
  const fol=cmnFolga(g, v=>v===CL);
  const verdeRets=cmnRetangulos(g, v=>v===CL).filter(r=>Math.min(r.w,r.h)*res>=0.9 && r.w*r.h*res*res>=2);
  const arvores=[]; const ok=k=>fol[k]>=Math.round(1.6/res);
  for(let j=0;j<g.ny;j++) for(let i=0;i<g.nx;i++){ const k=j*g.nx+i; if(g.c[k]!==CL || !ok(k)) continue; const P=g.W(g.cu(i),g.cv(j)); if(arvores.some(a=>Math.hypot(a.c[0]-P[0],a.c[1]-P[1])<6)) continue; arvores.push({c:P, r:Math.min(2.2, fol[k]*res*0.9)}) }
  const calcada=[cam];
  return {g, amb, falta, avisos, verde:verdeRets.map(r=>cmnRetPoly(g,r)), arvores, calcada, vAl};
}

/* ---------- laje do embasamento ----------
   O elevador para na laje: o acesso é a face da torre mais perto do hall dos elevadores. A partir dele: piscina perto do
   acesso e do lado do sol, com deck de 1,5 m em volta e o solário (espreguiçadeiras) no lado do sol; apoio da piscina
   (sanitário PCD + ducha) encostado na torre, junto do acesso; playground à vista do acesso e longe da água; pet place
   longe dos dois; caminhos acessíveis (1,20 m) do acesso a cada item; o resto é jardim, com árvores esparsas em jardineira. */
function comunsLaje(st, m, prog){
  const itens=prog.filter(a=>a.local==="emb"); if(!itens.length || !m.emb.length) return null;
  const T=m.ter||{}, ux=T.lat||[1,0], vy=T.fd||[0,1], g=cmnGrade(ux, vy, [m.emb], G.area(m.emb)>1500? 0.3 : CMN_RES), res=g.res, n=g.nx*g.ny;   // laje grande: malha de 0,30 m (rápido)
  cmnPinta(g, m.emb, CL);
  m.T.forEach(t=>{ if(t.oco){ cmnPinta(g, t.oco.pts, CO); (t.oco.vazios||[]).forEach(v=>cmnPinta(g, v, CL)) } else cmnPinta(g, t.plate, CO) });
  // jardineira junto ao guarda-corpo (0,6 m da borda): nada de ambiente encostado na beira da laje
  { const fol=cmnFolga(g, v=>v!==CF), b=Math.round(0.6/res); for(let k=0;k<n;k++) if(g.c[k]===CL && fol[k]<=b) g.c[k]=CE }
  // acesso: na face da torre mais próxima do hall dos elevadores (o elevador para na laje)
  const acessos=[];
  (m.coreSets||[]).forEach(cs=>{ const t=m.T[cs.i]; if(!t||!t.plate.length) return; const pc=g.U(G.centroid(cs.lobby&&cs.lobby.length? cs.lobby : cs.core));
    let best=null; for(let k=0;k<n;k++){ if(g.c[k]!==CL) continue; const i=k%g.nx, j=(k/g.nx)|0; if(!cmnDI.some(([a,b])=>g.at(i+a,j+b)===CO)) continue; const d=Math.hypot(g.cu(i)-pc[0], g.cv(j)-pc[1]); if(!best||d<best.d) best={k,d} }
    if(best){ const i=best.k%g.nx, j=(best.k/g.nx)|0; acessos.push({torre:cs.i, k:best.k, c:[g.cu(i),g.cv(j)], P:g.W(g.cu(i),g.cv(j))}); cmnPincel(g,[best.k],3,CC,v=>v===CL) } });
  const anc = acessos[0]? acessos[0].c : [g.cu(g.nx>>1), g.cv(g.ny>>1)];
  // sol: norte no hemisfério sul — lado da laje voltado para o sol
  const nAng=(st.lote.norte||0)*Math.PI/180, sul=(st.lote.lat==null||st.lote.lat<0)? 1 : -1, sun=[Math.sin(nAng)*sul, Math.cos(nAng)*sul], sunUV=[G.dot(sun,ux), G.dot(sun,vy)];
  const dsSol=(()=>{ const ds=[[-1,0],[1,0],[0,-1],[0,1]].map(([a,b])=>a*sunUV[0]+b*sunUV[1]); return ds.indexOf(Math.max(...ds)) })();
  const tc=m.T.filter(t=>t.plate.length).map(t=>g.U(G.centroid(t.plate)));
  const amb=[], falta=[];
  const ordem=a=> a.k==="piscina"? 0 : a.k==="apoioPisc"? 1 : a.k==="quadra"? 2 : a.k==="playground"? 3 : !a.desc? 4 : a.k==="pet"? 6 : 5;
  const lista=itens.slice().sort((a,b)=>ordem(a)-ordem(b) || b.A-a.A);
  const deckIt=lista.find(a=>a.k==="deck"), temPisc=lista.some(a=>a.k==="piscina");
  const SCo=cmnPS(g, k=>g.c[k]===CO?1:0);
  const centro=r=>[g.u0+(r.i+r.w/2)*res, g.v0+(r.j+r.h/2)*res], dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  let pool=null;
  lista.forEach(a=>{ if(a===deckIt && temPisc) return;
    const c=CMN_CAT[a.k], SL=cmnPS(g, k=>g.c[k]===CL?1:0); let best=null;
    const mg0=a.k==="piscina"? Math.round(1.5/res) : 0;
    for(const t of cmnTamanhos(a.A, c, res, [1,0.92,0.85,0.75])){
      // piscina: deck de 1,5 m em volta e o solário (o resto da área do deck) no lado do sol
      let mL=mg0, mR=mg0, mB=mg0, mT=mg0;
      if(a.k==="piscina"){ const lado= dsSol<2? t.h : t.w, ext=deckIt? cmnClamp(Math.round(Math.max(0, deckIt.A - 1.5*2*(t.w+t.h)*res - 9)/(lado*res)/res), 0, Math.round(5/res)) : Math.round(1/res);
        if(dsSol===0) mL+=ext; else if(dsSol===1) mR+=ext; else if(dsSol===2) mB+=ext; else mT+=ext }
      const W=t.w+mL+mR, H=t.h+mB+mT, passo= n>40000? 2 : 1;
      for(let j=0;j+H<=g.ny;j+=passo) for(let i=0;i+W<=g.nx;i+=passo){ if(cmnQ(SL,g,i,j,W,H)!==W*H) continue;
        const r={i,j,w:W,h:H}, cc=centro(r), dA=dist(cc,anc); let sc=t.f*60 - 3*(Math.max(t.w,t.h)/Math.min(t.w,t.h)-1);
        let co=0; for(let d=0;d<4;d++) co+=cmnQ(SCo,g,...cmnLadoFora(r,d));
        if(a.k==="piscina"){ const dT=Math.min(...tc.map(p=>dist(cc,p)),40); sc+= -0.5*dA + 0.15*Math.min(dT,25) + 0.4*((cc[0]-anc[0])*sunUV[0]+(cc[1]-anc[1])*sunUV[1]) - (co? 25 : 0) }
        else if(a.k==="apoioPisc"){ sc+= (co*res>=1.5? 70 : 40*Math.min(1, co*res/2.5)) - 0.8*dA; if(pool) sc-= 0.8*dist(cc, centro(pool.r)) }
        else if(a.k==="playground"){ sc-= 0.35*dA; if(pool){ const d=dist(cc, centro(pool.R)); sc+= Math.min(d,20)*0.6 - (d<9? 40 : 0) } }
        else if(a.k==="pet"){ sc-= 0.1*dA; amb.forEach(x=>{ if(x.k==="piscina"||x.k==="playground") sc+= Math.min(dist(cc,centro(x.r)),25)*0.8 }) }
        else if(!a.desc){ sc+= 30*Math.min(1, co*res/3) - 0.5*dA }
        else sc-= 0.3*dA;
        if(!best||sc>best.sc) best={i,j,w:W,h:H,sc,f:t.f,m:[mL,mR,mB,mT]} } if(best) break }
    if(!best){ falta.push({...a, motivo:`a laje livre em volta das torres não tem ${cmnNf(Math.sqrt(a.A/c.prop),1)} m × ${cmnNf(Math.sqrt(a.A*c.prop),1)} m${a.k==="piscina"?" com deck e solário":""}`}); return }
    const cod=700+amb.length; cmnMarca(g, best, cod);
    const f={...a, cod, r:best, poly:cmnRetPoly(g,best), area:best.w*best.h*res*res, reduzido:best.f<0.9, portas:[]};
    if(a.k==="piscina"){ const [mL,mR,mB,mT]=best.m, R={i:best.i+mL, j:best.j+mB, w:best.w-mL-mR, h:best.h-mB-mT}; f.R=R; f.lamina=cmnRetPoly(g,R); f.area=R.w*R.h*res*res; f.deckA=best.w*best.h*res*res-f.area; pool=f;
      // prainha na ponta mais perto do acesso; raias no comprimento
      const pc=centro(R), ladoPr = R.w>=R.h? (anc[0]<pc[0]? 0 : 1) : (anc[1]<pc[1]? 2 : 3);
      f.moveis=cmnPiscinaMoveis(g, R, best, ladoPr);
      // espreguiçadeiras no solário (lado do sol)
      const Fq=cmnQuadro(g, best, dsSol), prof=[mL,mR,mB,mT][dsSol]*res; if(prof>=2.2){ const nE=Math.floor((Fq.W-0.6)/1.0); for(let q=0;q<nE;q++){ const x=0.45+q*1.0; f.moveis.push({t:"r", cl:"mov", pts:[Fq.G(x,0.35),Fq.G(x+0.7,0.35),Fq.G(x+0.7,Math.min(2.25,prof-0.3)),Fq.G(x,Math.min(2.25,prof-0.3))]}); if(q%2===1 && q<nE-1) f.moveis.push({t:"c", cl:"mov", c:Fq.G(x+0.85, 1.1), r:0.35}) } }
      f.ladoSol=dsSol; f.solario=prof;
      if(deckIt) f.deck={nome:deckIt.nome, ix:deckIt.ix, A:f.deckA} }
    else f.moveis=cmnMoveis(g, f, a.k==="apoioPisc"? cmnLadoCO(g,best) : 2, 3);
    amb.push(f) });
  // ducha no deck, do lado do acesso
  if(pool){ const R=pool.R, pc=centro(R), du=anc[0]-pc[0], dv=anc[1]-pc[1], lado= Math.abs(du)*R.h>Math.abs(dv)*R.w? (du<0?0:1) : (dv<0?2:3);
    const P = lado===0? [g.u0+R.i*res-0.75, pc[1]] : lado===1? [g.u0+(R.i+R.w)*res+0.75, pc[1]] : lado===2? [pc[0], g.v0+R.j*res-0.75] : [pc[0], g.v0+(R.j+R.h)*res+0.75];
    pool.ducha=g.W(P[0],P[1]) }
  // caminhos (rota acessível, 1,20 m) do acesso até cada item; o resto é jardim
  const rota=[], rb=Math.max(1,Math.ceil((1.2/res-1)/2));
  amb.forEach(f=>{ const set=new Set(); for(let j=f.r.j;j<f.r.j+f.r.h;j++) for(let i=f.r.i;i<f.r.i+f.r.w;i++) set.add(j*g.nx+i);
    const p=cmnCaminho(g, k=>g.c[k]===CC, k=>set.has(k), k=>g.c[k]===CL||g.c[k]===CC, k=>g.c[k]===CC? 0.25 : 1);
    f.rotaOk=!!p; if(p){ cmnPincel(g, p, rb, CC, v=>v===CL); rota.push({para:f.nome, pts:cmnPolilinha(g,p), amb:f.id}) } });
  const caminhos=cmnRetangulos(g, v=>v===CC).map(r=>cmnRetPoly(g,r));
  const verde=cmnRetangulos(g, v=>v===CL||v===CE).filter(r=>Math.min(r.w,r.h)*res>=0.5).map(r=>cmnRetPoly(g,r));
  // árvores em jardineira: esparsas (a cada ~9 m), onde o jardim tem folga
  const fol2=cmnFolga(g, v=>v===CL||v===CE), arvores=[];
  for(let j=0;j<g.ny;j++) for(let i=0;i<g.nx;i++){ const k=j*g.nx+i; if((g.c[k]!==CL&&g.c[k]!==CE)||fol2[k]<Math.round(1.5/res)) continue; const P=g.W(g.cu(i),g.cv(j)); if(arvores.some(a=>Math.hypot(a.c[0]-P[0],a.c[1]-P[1])<9)) continue; arvores.push({c:P, r:Math.min(1.5,fol2[k]*res*0.7)}) }
  return {g, amb, falta, rota, caminhos, verde, arvores, acessos:acessos.map(a=>a.P), pool};
}
const cmnLadoCO=(g,r)=>{ let b=-1, d=2; [0,1,2,3].forEach(q=>{ const [i0,j0,w,h]=cmnLadoFora(r,q); let c=0; for(let t=0;t<Math.max(w,h);t++) if(g.at(i0+(w>1?t:0), j0+(h>1?t:0))===CO) c++; if(c>b){ b=c; d=q } }); return [1,0,3,2][d] };

/* ---------- pavimento de lazer e rooftop (na torre 1) ---------- */
function comunsPlaca(st, m, prog, local){
  const itens=prog.filter(a=>a.local===local && !a.desc), descs=prog.filter(a=>a.local===local && a.desc);
  if(!itens.length && !descs.length) return null;
  const t0=m.T[0], cs=(m.coreSets||[]).find(c=>c.i===0); if(!t0 || !t0.plate.length) return null;
  const ux=cs&&cs.lay&&cs.lay.ux || G.longestDir(t0.plate), vy=cs&&cs.lay&&cs.lay.vy || [-ux[1],ux[0]], g=cmnGrade(ux, vy, [t0.plate]);
  cmnPinta(g, t0.plate, CL); if(cs){ cmnPinta(g, cs.core, CO); if(local==="pav" && cs.lobby) cmnPinta(g, cs.lobby, CH) }
  else cmnPinta(g, G.scaleToArea(t0.plate, 1), CH);
  if(!g.c.some(v=>v===CH)){ // sem hall: a face do núcleo
    for(let k=0;k<g.nx*g.ny;k++){ if(g.c[k]!==CL) continue; const i=k%g.nx, j=(k/g.nx)|0; if([[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>g.at(i+a,j+b)===CO)) g.c[k]=CH } }
  const luz=cmnLuzMapaPlaca(g);
  const ancora=(()=>{ let s=[0,0],n=0; g.c.forEach((v,k)=>{ if(v===CH){ s[0]+=g.cu(k%g.nx); s[1]+=g.cv((k/g.nx)|0); n++ } }); return n? [s[0]/n,s[1]/n] : null })();
  const lista=[...itens, ...descs].sort((a,b)=>b.A-a.A);
  const pl=cmnPlaneja(g, lista, {luz, galeria:1.5, ancora, id0:900});
  const amb=pl.feitos;
  cmnSobras(g, amb); cmnLivres(g, 1e9);
  amb.forEach(f=>{ f.portas=cmnPortas(g, f, ancora); f.janelas=CMN_CAT[f.k].luz? cmnJanelas(g, f, luz) : []; const lzD=cmnLadoLuz(f), cD=cmnLadoCirc(g,f); f.moveis=cmnMoveis(g, f, lzD!=null? lzD : cmnOposto(cD), cD) });
  return {g, amb, falta:pl.falta.map(a=>({...a, motivo:cmnMotivoFalta(a,g)})), circ:cmnRetangulos(g, v=>v===CC||v===CH).map(r=>cmnRetPoly(g,r)), luz};
}
function cmnLuzMapaPlaca(g){ const L=new Float32Array(g.nx*g.ny*4), DI=[[-1,0],[1,0],[0,-1],[0,1]];
  for(let j=0;j<g.ny;j++) for(let i=0;i<g.nx;i++){ const k=j*g.nx+i; if(g.c[k]===CF||g.c[k]===CO) continue; for(let d=0;d<4;d++) if(g.at(i+DI[d][0],j+DI[d][1])===CF) L[k*4+d]=1 } return L }

/* ---------- validação ---------- */
function comunsValida(C, st, m){
  const P=[], add=(k,nivel,msg,amb)=>P.push({k,nivel,msg,amb});
  if(!C) return {nota:100, problemas:P, ok:true};
  const todos=(C.amb||[]), por=k=>todos.filter(a=>a.k===k), semLuz=[], soVent=[];
  const lista=as=>as.map(a=>a.nome).join(", ").replace(/, ([^,]*)$/," e $1");
  // programa
  (C.falta||[]).forEach(a=>{ const c=CMN_CAT[a.k]; add("programa", a.nivel || (a.obrig||(c.grupo!=="lazer"&&c.grupo!=="externo")? "bad" : "warn"), `${a.nome} não coube: ${a.motivo}.`, a.id) });
  todos.forEach(a=>{ const c=CMN_CAT[a.k]; if(!c) return;
    // medida mínima e proporção (de eixo a eixo; a parede desconta 0,15)
    const r=a.r, g=a.local==="emb"? C.gL : a.recuo? C.gR : a.local==="terreo"? C.gT : C.gP, res=(g&&g.res)||CMN_RES;
    if(r){ const w=r.w*res, h=r.h*res, mn=Math.min(w,h)-0.15;
      if(a.k!=="piscina" && mn < c.d-0.16) add("medida", mn<c.d*0.8? "bad" : "warn", `${a.nome}: ${cmnNf(mn,2)} m de largura útil (pede ${cmnNf(c.d,2)} m).`, a.id);
      if(Math.max(w,h)/Math.min(w,h) > c.prop+0.35 && !c.desc) add("proporcao","warn",`${a.nome} comprido demais (${cmnNf(Math.max(w,h),1)} × ${cmnNf(Math.min(w,h),1)} m).`, a.id) }
    if(a.reduzido) add("area","warn",`${a.nome} ficou com ${cmnNf(a.area,0)} m² (o programa pede ${cmnNf(a.A,0)} m²).`, a.id);
    // luz natural dos ambientes de permanência (agrupado abaixo: um aviso só)
    if(c.luz==="sim" && !c.desc && a.k!=="hall" && a.local!=="emb"){ const jan=(a.janelas||[]), boa=jan.filter(j=>!j.fraca).reduce((s,j)=>s+j.len,0), fraca=jan.filter(j=>j.fraca).reduce((s,j)=>s+j.len,0);
      if(boa<=0 && fraca<=0) semLuz.push(a); else if(boa<=0) soVent.push(a) }
    // porta para a circulação
    if(a.local!=="emb" && !a.recuo && !c.desc && a.k!=="hall" && a.k!=="clausura" && (!a.portas || !a.portas.length)) add("acesso","bad",`${a.nome} sem porta para a circulação.`, a.id);
    const viaPar = a.par && todos.find(x=>x.id===a.par && x.rotaOk!==false);   // copa: entra pelo salão
    if(a.rotaOk===false && !viaPar) add("rota","bad",`${a.nome} fora da rota acessível (não se chega sem atravessar outro ambiente).`, a.id) });
  if(semLuz.length || soVent.length) P.push({k:"luz", nivel:"warn", ambs:[...semLuz,...soVent].map(a=>a.id), msg: semLuz.length?
    `Sem janela para fora: ${lista(semLuz)}${C.motivoLuz? ` (${C.motivoLuz})` : ""}${soVent.length? `; ${lista(soVent)} só com ventilação (parede a menos de 1,5 m da divisa)` : ""} — ventilação mecânica e luz artificial.`
    : `${lista(soVent)}: a parede externa fica a menos de 1,5 m da divisa — só ventilação, sem janela de verdade.`});
  // adjacências
  por("copa").forEach(cp=>{ const s=todos.find(x=>x.id===cp.par); if(s && !(cp.portas||[]).length) add("adjacencia","bad",`A copa não abre para o ${s.nome.toLowerCase()}.`, cp.id) });
  const wc=por("wc")[0];
  ["salao","gourmet","brinq"].forEach(k=>por(k).filter(a=>a.local==="terreo").forEach(a=>{ if(!wc){ add("adjacencia","warn",`${a.nome} sem sanitário PCD no térreo.`, a.id); return } const d=Math.hypot(...[0,1].map(t=>G.centroid(a.poly)[t]-G.centroid(wc.poly)[t])); if(d>30) add("adjacencia","warn",`Sanitários PCD a ${cmnNf(d,0)} m do ${a.nome.toLowerCase()} (ideal ≤ 30 m).`, a.id) }));
  por("piscina").forEach(p=>{ const ap=todos.find(x=>x.par===p.id); if(!ap) add("adjacencia","warn","Piscina sem sanitário e ducha por perto.", p.id); else { const d=Math.hypot(...[0,1].map(t=>G.centroid(p.poly)[t]-G.centroid(ap.poly)[t])); if(d>25) add("adjacencia","warn",`Apoio da piscina a ${cmnNf(d,0)} m dela.`, p.id) } });
  const pg=por("playground")[0], pi=por("piscina")[0];
  if(pg && pi && pg.local===pi.local){ const d=cmnDistPolys(pg.poly, pi.lamina||pi.poly); if(d<4) add("seguranca","warn",`Playground a ${cmnNf(d,1)} m da água — afaste ou cerque a piscina.`, pg.id) }
  // entrada deslocada do acesso de pedestres escolhido (o núcleo ou as lojas fecham a frente ali)
  const cl0=por("clausura")[0]; if(cl0 && C.TT){ const du=Math.abs(G.dot(G.centroid(cl0.poly), C.gT.ux) - C.TT.uPed); if(du>3) add("entrada","warn",`A clausura ficou a ${cmnNf(du,0)} m do acesso de pedestres marcado: ali não cabe o hall. Ajuste o acesso em Terreno.`, cl0.id) }
  // portaria vê os acessos
  const pt=por("portaria")[0];
  if(pt && C.TT){ const pc=G.centroid(pt.poly), ped=m.acesso.ped, vei=(m.ter&&m.ter.veiReal)||m.acesso.vei;
    const dp=Math.hypot(pc[0]-ped[0],pc[1]-ped[1]), dv=Math.hypot(pc[0]-vei[0],pc[1]-vei[1]);
    if(!(pt.janelas||[]).length && !(C.TT.fPt && cmnTocaFachada(C, pt))) add("portaria","warn","A portaria não fica na fachada: o porteiro não vê a rua (use visor e câmeras).", pt.id);
    if(dp>14) add("portaria","warn",`Portaria a ${cmnNf(dp,0)} m do portão de pedestres.`, pt.id);
    if(dv>30) add("portaria","warn",`Portaria a ${cmnNf(dv,0)} m do portão de veículos (câmeras).`, pt.id) }
  // hall social ligado aos elevadores
  (C.TT&&C.TT.ligacoes||[]).forEach(l=>{ if(!l.ok) add("rota","bad",`O hall não chega ao hall dos elevadores${l.al.torre!=null? " da torre "+(l.al.torre+1) : ""}.`); else if(l.estreito) add("rota","warn",`A galeria até${l.al.torre!=null? " a torre "+(l.al.torre+1) : " a garagem"} fica com 1,20 m (estreita).`) });
  // hall social: o hall de entrada mais as galerias fazem a área de recepção e espera
  const hl=por("hall")[0]; if(hl){ const gal=((C.circ||{}).terreo||[]).reduce((s,p)=>s+G.area(p),0); if(hl.area < hl.A*0.3 || hl.area+gal < hl.A*0.8) add("area","warn",`Hall social com ${cmnNf(hl.area,0)} m² e ${cmnNf(gal,0)} m² de galerias (o programa pede ${cmnNf(hl.A,0)} m²).`, hl.id) }
  // gás e lixo
  por("gas").forEach(gs=>{ if(!gs.recuo) add("gas","bad","A central de gás ficou dentro do prédio — precisa de área externa ventilada.", gs.id);
    else { const cl=por("clausura")[0]; const d=cl? cmnDistPolys(gs.poly, cl.poly) : 99; if(d<3) add("gas","warn",`Central de gás a ${cmnNf(d,1)} m da entrada de pedestres (afaste ≥ 3 m).`, gs.id);
      const jan=todos.filter(x=>x.local==="terreo"&&!x.recuo).flatMap(x=>(x.janelas||[]).map(j=>[j.p0,j.p1])); const dj=Math.min(99,...jan.map(([a,b])=>cmnDistPolys(gs.poly,[a,b,b]))); if(dj<1.5) add("gas","warn",`Central de gás a ${cmnNf(dj,1)} m de uma janela (afaste ≥ 1,5 m).`, gs.id) } });
  por("lixo").forEach(lx=>{ if(!lx.recuo) add("lixo","warn","O abrigo de resíduos ficou dentro do prédio: precisa de porta para a rua e ventilação.", lx.id); else if(lx.dAl>1.0) add("lixo","warn",`Abrigo de resíduos a ${cmnNf(lx.dAl,1)} m do alinhamento (a coleta é pela rua).`, lx.id) });
  // carro × pedestre: a rota não pode cruzar a faixa de veículos
  const T=m.ter||{}, faixas=[...(T.drive||[]), ...(T.driveRua||[])];
  const cruza=(C.rota||[]).filter(r=>r.local!=="emb" && r.pts.length>1 && faixas.some(f=>r.pts.some((p,i)=>i && G.segPolyHit(r.pts[i-1],p,G.scaleToArea(f,G.area(f)*0.98)))));
  if(cruza.length) add("veiculos","bad",`A rota de pedestres cruza a faixa de veículos (${cruza.map(r=>r.para).join(", ")}).`);
  if(C.TT && C.TT.veiFrente && Math.abs(C.TT.uPed-C.TT.uVei)<3.5) add("veiculos","warn","Portões de pedestres e de veículos colados: separe ao menos 3,5 m.");
  const bad=P.filter(p=>p.nivel==="bad").length, warn=P.filter(p=>p.nivel==="warn").length;
  const nota=Math.max(0, Math.round(100 - bad*CMN_NOTA.bad - warn*CMN_NOTA.warn));
  return {nota, problemas:P.sort((a,b)=>(a.nivel==="bad"?0:1)-(b.nivel==="bad"?0:1)), ok:!bad};
}
function cmnDistPolys(a, b){ let d=1e9; const ds=(p,q,r)=>{ const dx=r[0]-q[0], dy=r[1]-q[1], l2=dx*dx+dy*dy||1, t=cmnClamp(((p[0]-q[0])*dx+(p[1]-q[1])*dy)/l2,0,1); return Math.hypot(q[0]+dx*t-p[0], q[1]+dy*t-p[1]) };
  if(a.some(p=>G.pip(p,b))||b.some(p=>G.pip(p,a))) return 0;
  a.forEach(p=>b.forEach((q,i)=>d=Math.min(d,ds(p,q,b[(i+1)%b.length])))); b.forEach(p=>a.forEach((q,i)=>d=Math.min(d,ds(p,q,a[(i+1)%a.length])))); return d }
function cmnTocaFachada(C, f){ const g=C.gT; if(!g) return false; const ct=cmnContato(g, f.r, C.TT.luz, null); return ct.luz>0 }

/* ---------- entrada: m.comuns ---------- */
function comunsCalc(st, m){
  const C=st.comuns||{}; if(C.on===false || !m.emb || !m.emb.length) return null;
  const prog=comunsPrograma(st, m);
  const TT=comunsTerreo(st, m, prog);
  const TR=comunsRecuo(st, m, prog, TT);
  // lixo/medidores/gás sem recuo: dentro do térreo, encostados na fachada (com aviso)
  if(TT && TR && TR.falta.length){ const pend=TR.falta.filter(a=>CMN_CAT[a.k].onde==="recuo"); TR.falta=TR.falta.filter(a=>CMN_CAT[a.k].onde!=="recuo");
    const g=TT.g, s=cmnSoma(g, v=>v===CL);
    pend.forEach(a=>{ const c=CMN_CAT[a.k]; let best=null; for(const t of cmnTamanhos(a.A, c, g.res, [1,0.85])){ for(let j=0;j+t.h<=g.ny;j++) for(let i=0;i+t.w<=g.nx;i++){ if(cmnRetS(s,g,i,j,t.w,t.h)!==t.w*t.h) continue; const ct=cmnContato(g,{i,j,w:t.w,h:t.h},TT.luz,null); const fr=ct.luzLado[2]; if(!fr) continue; const sc=fr - (g.v0+j*g.res)*0.5; if(!best||sc>best.sc) best={i,j,w:t.w,h:t.h,sc} } if(best) break }
      if(best){ const cod=600+TT.amb.length; cmnMarca(g,best,cod); TT.amb.push({...a, cod, r:best, poly:cmnRetPoly(g,best), area:best.w*best.h*g.res*g.res, portas:[], janelas:[], moveis:cmnMoveis(g,{...a,r:best},2,3), dentro:true}) }
      else TR.falta.push(a) }) }
  const LJ=comunsLaje(st, m, prog);
  const PV=comunsPlaca(st, m, prog, "pav"), CB=comunsPlaca(st, m, prog, "cob");
  const tag=(arr, local, extra={})=>(arr||[]).map(a=>({...a, local, ...extra}));
  const amb=[...tag(TT&&TT.amb,"terreo"), ...tag(TR&&TR.amb,"terreo",{recuo:true}), ...tag(LJ&&LJ.amb,"emb"), ...tag(PV&&PV.amb,"pav"), ...tag(CB&&CB.amb,"cob")];
  const falta=[...(TT?TT.falta:[]), ...(TR?TR.falta:[]), ...(LJ?LJ.falta:[]), ...(PV?PV.falta:[]), ...(CB?CB.falta:[])];
  // o que não coube porque o lugar não existe
  prog.forEach(a=>{ if(amb.some(x=>x.id===a.id) || falta.some(x=>x.id===a.id)) return; if(a.local==="emb" && !LJ) falta.push({...a, motivo:"não há laje livre no embasamento"}); else if((a.local==="pav"||a.local==="cob") && !(a.local==="pav"? PV : CB)) falta.push({...a, motivo:"sem torre para o pavimento"}); else if(a.local==="terreo" && !TT) falta.push({...a, motivo:"o térreo não tem hall"}) });
  const rota=[...((TT&&TT.rota)||[]).map(r=>({...r, local:"terreo"})), ...((LJ&&LJ.rota)||[]).map(r=>({...r, local:"emb"}))];
  const out={ amb, falta, rota, prog,
    circ:{ terreo:TT? TT.circ : [], hall:TT? TT.hallExt : [], emb:LJ? LJ.caminhos : [], pav:PV? PV.circ : [], cob:CB? CB.circ : [] },
    sobra:TT? TT.sobra : [], reserva:TT? TT.reserva : [], sobraA:TT? TT.sobraA : 0, estar:TT? TT.estar.map(e=>({k:e.k, nome:e.nome, area:e.area, poly:e.poly, moveis:e.moveis})) : [],
    verde:{ terreo:TR? TR.verde : [], emb:LJ? LJ.verde : [] }, arvores:{ terreo:TR? TR.arvores : [], emb:LJ? LJ.arvores : [] },
    calcada:TR? TR.calcada : [], acessosLaje:LJ? LJ.acessos : [], ducha:LJ&&LJ.pool? LJ.pool.ducha : null,
    entrada: TT&&TT.fCl? {portao:TT.fCl.portas&&TT.fCl.portas[0]} : null,
    servico: TT? TT.ancServ && TT.g.W(...TT.ancServ) : null,
    eixos: Object.fromEntries([["terreo",TT],["emb",LJ],["pav",PV],["cob",CB]].filter(([,x])=>x&&x.g).map(([k,x])=>[k,[x.g.ux,x.g.vy]])) };
  // motivo da falta de luz (para a mensagem): divisa perto
  out.motivoLuz = TT && TT.amb.some(a=>CMN_CAT[a.k].luz==="sim" && !(a.janelas||[]).length) ? cmnMotivoLuz(st, m) : "";
  const val=comunsValida({...out, TT, gT:TT&&TT.g, gR:TR&&TR.g, gL:LJ&&LJ.g, gP:(PV||CB)&&(PV||CB).g}, st, m);
  out.nota=val.nota; out.problemas=val.problemas; out.ok=val.ok;
  // problemas por ambiente (para contornar no desenho)
  out.amb.forEach(a=>{ const ps=val.problemas.filter(p=>(p.amb===a.id && p.amb!=null) || (p.ambs||[]).includes(a.id)); a.nivel= ps.some(p=>p.nivel==="bad")? "bad" : ps.length? "warn" : null });
  out.areaApoio = amb.filter(a=>a.local==="terreo" && a.ix==null && !a.recuo).reduce((s,a)=>s+a.area,0);
  out.n = amb.length;
  // limpa o que não precisa viajar do Worker (malhas, retângulos internos)
  out.amb.forEach(a=>{ delete a.ct; delete a.cod });
  return out;
}
function cmnMotivoLuz(st, m){   // motivo de não haver janela (para a mensagem)
  const L=st.lote.pts; let d=1e9; m.emb.forEach(p=>L.forEach((a,i)=>{ if(st.lote.front.includes(i)) return; const b=L[(i+1)%L.length]; d=Math.min(d, cmnDistPolys([p,p,p],[a,b,b])) }));
  return d<CMN_JANELA_DIV? `o embasamento fica a ${cmnNf(d,1)} m da divisa e a janela pede 1,5 m` : "não encostam numa fachada livre" }

/* ---------- DXF ---------- */
function comunsDxf(d, m, local){
  const C=m.comuns; if(!C) return;
  const amb=C.amb.filter(a=>a.local===local);
  amb.forEach(a=>{ d.poly(a.desc||a.recuo? "COMUNS-EXTERNOS" : "COMUNS-AMBIENTES", a.poly, a.desc? 3 : 4); if(a.lamina) d.poly("COMUNS-PISCINA", a.lamina, 5);
    const c=G.centroid(a.lamina||a.poly); d.text("COMUNS-TEXTOS", c, 0.6, a.nome); d.text("COMUNS-TEXTOS", [c[0], c[1]-0.9], 0.45, `${nf(a.area,1)} m2`);
    (a.portas||[]).forEach(p=>d.poly("COMUNS-PORTAS", [p.p0, p.p1, [p.p0[0]+p.n[0]*p.w, p.p0[1]+p.n[1]*p.w]], 1, true));
    (a.janelas||[]).forEach(j=>d.poly("COMUNS-JANELAS", [j.p0, j.p1], 5, true));
    (a.moveis||[]).forEach(f=>{ if(f.t==="c"){ const n=16, pts=[]; for(let q=0;q<n;q++) pts.push([f.c[0]+Math.cos(q/n*6.283)*f.r, f.c[1]+Math.sin(q/n*6.283)*f.r]); d.poly("COMUNS-MOBILIARIO", pts, 8) } else d.poly("COMUNS-MOBILIARIO", f.pts, 8, f.t==="l") }) });
  ((C.circ||{})[local]||[]).forEach(p=>d.poly("COMUNS-CIRCULACAO", p, 9));
  if(local==="terreo"){ ((C.circ||{}).hall||[]).forEach(p=>d.poly("COMUNS-CIRCULACAO", p, 9));
    (C.estar||[]).forEach(e=>{ d.text("COMUNS-TEXTOS", G.centroid(e.poly), 0.45, `${e.nome} ${nf(e.area,1)} m2`); (e.moveis||[]).forEach(f=>{ if(f.t==="r") d.poly("COMUNS-MOBILIARIO", f.pts, 8) }) }) }
  (C.rota||[]).filter(r=>r.local===local).forEach(r=>{ if(r.pts.length>1) d.poly("COMUNS-ROTA-ACESSIVEL", r.pts, 5, true) });
  ((C.verde||{})[local]||[]).forEach(p=>d.poly("COMUNS-PAISAGISMO", p, 3));
}
