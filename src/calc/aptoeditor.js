/* ================= editor de modelos de apartamento: operações puras (docs/APTOS.md §2 e §4) =================
   Modelo (partido) = { id, nome, origem:"usuario"|"catalogo", tipologia, W, D, faixaW:{min,max}, faixaD:{min,max},
     entrada:{x, lado:"corredor"}, ambientes:[{id, k, ret:[x,y,w,h], estica:"x"|"y"|"xy"|"", grupo?}], portas?:[{a,b,t?}],
     sacada?, criado, atualizado }.
   Referencial: x ao longo da fachada (0…W), y = 0 na fachada e y = D no corredor. Tudo em metros, ímã de 5 cm (AED_Q).
   Sem DOM: vai também para o Worker e para os testes (tests/aptoeditor.test.js). A tela está em src/ui/aptoeditor.js e a
   biblioteca (localStorage gabarito.aptos.biblioteca) em src/ui/aptobiblioteca.js.
   Integração com o motor de plantas (src/calc/aptoregras.js, aptocatalogo.js): aedValida usa aptoValida/aptoAplica se existirem
   (typeof), senão a validação mínima daqui (aedValidaMin); aedAplica usa aptoAplica, senão aedAplicaSimples (faixas que esticam). */

const AED_Q = 0.05, AED_MIN = 0.5, AED_EPS = 1e-6;
/* tipos de ambiente (mesmas chaves de COM_K em src/calc/comodos.js) */
const AED_K = {
  sala:    {nome:"Sala", longo:"Estar / jantar", plural:"salas", zona:"social", estica:"xy", janela:true},
  suite:   {nome:"Suíte", longo:"Suíte", plural:"suítes", zona:"intima", estica:"xy", janela:true},
  dorm:    {nome:"Dormitório", curto:"Dorm.", longo:"Dormitório", plural:"dormitórios", zona:"intima", estica:"xy", janela:true},
  office:  {nome:"Home office", curto:"Office", longo:"Home office", plural:"home offices", zona:"intima", estica:"", janela:true},
  cozinha: {nome:"Cozinha", longo:"Cozinha", plural:"cozinhas", zona:"servico", estica:"x", molhada:true},
  serv:    {nome:"Serviço", longo:"Área de serviço", plural:"áreas de serviço", zona:"servico", estica:"", molhada:true},
  banho:   {nome:"Banho", longo:"Banheiro", plural:"banheiros", zona:"molhada", estica:"", molhada:true},
  bsuite:  {nome:"Banho da suíte", curto:"Banho", longo:"Banheiro da suíte", plural:"banheiros de suíte", zona:"molhada", estica:"", molhada:true},
  lavabo:  {nome:"Lavabo", longo:"Lavabo", plural:"lavabos", zona:"molhada", estica:"", molhada:true},
  circ:    {nome:"Circulação", curto:"Circ.", longo:"Circulação", zona:"circ", estica:"xy"},
  closet:  {nome:"Closet", longo:"Closet", zona:"intima", estica:""},
  desp:    {nome:"Depósito", curto:"Dep.", longo:"Depósito", zona:"servico", estica:""},
  sacada:  {nome:"Sacada", longo:"Sacada", zona:"externa", estica:"x"}
};
const AED_KS = Object.keys(AED_K);
const AED_TIPOLOGIAS = [["studio","Studio"],["1d","1 dormitório"],["1s","1 suíte"],["2d","2 dormitórios"],["2d1s","2 dorm. (1 suíte)"],["2s","2 suítes"],["3d1s","3 dorm. (1 suíte)"],["3s","3 suítes"],["4d1s","4 dorm. (1 suíte)"]];
const AED_TIP = Object.fromEntries(AED_TIPOLOGIAS);
/* programa mínimo por tipologia (o que o modelo precisa ter) */
const AED_PROG = {
  studio: {sala:1, cozinha:1, banho:1},
  "1d":   {sala:1, cozinha:1, serv:1, dorm:1, banho:1},
  "1s":   {sala:1, cozinha:1, serv:1, suite:1, bsuite:1},
  "2d":   {sala:1, cozinha:1, serv:1, dorm:2, banho:1},
  "2d1s": {sala:1, cozinha:1, serv:1, dorm:1, suite:1, banho:1, bsuite:1},
  "2s":   {sala:1, cozinha:1, serv:1, suite:2, bsuite:2, lavabo:1},
  "3d1s": {sala:1, cozinha:1, serv:1, dorm:2, suite:1, banho:1, bsuite:1},
  "3s":   {sala:1, cozinha:1, serv:1, suite:3, bsuite:3, lavabo:1},
  "4d1s": {sala:1, cozinha:1, serv:1, dorm:3, suite:1, banho:2, bsuite:1}
};
/* medida de referência do desenho novo por tipologia (frente × profundidade) */
const AED_TAM = { studio:[4.2,7.2], "1d":[5.4,8.4], "1s":[5.6,8.4], "2d":[7.0,9.0], "2d1s":[7.2,9.6], "2s":[8.4,10.0], "3d1s":[9.6,10.2], "3s":[11.4,10.4], "4d1s":[12.0,11.0] };
/* mínimos de referência (os do estudo, S.comodos.min, têm prioridade) */
const AED_MINS = { sala:{a:10,l:2.6}, suite:{a:9,l:2.5}, dorm:{a:7,l:2.3}, cozinha:{a:4,l:1.5}, serv:{a:1.8,l:1.0}, banho:{a:2.2,l:1.1}, bsuite:{a:2.2,l:1.1}, lavabo:{a:1.2,l:0.9}, circ:{a:0,l:0.9}, closet:{a:1.5,l:1.0}, desp:{a:0,l:0.6}, sacada:{a:0,l:1.1}, office:{a:4.5,l:1.8} };
/* por onde cada tipo de ambiente pode ser acessado (ordem = preferência); "entrada" = porta da unidade */
const AED_PAI = {
  sala:["entrada","circ","cozinha"], circ:["sala","entrada","circ","cozinha"], cozinha:["sala","entrada","circ","serv"],
  serv:["cozinha","circ","entrada","sala"], desp:["serv","cozinha","circ"],
  dorm:["circ","sala"], suite:["circ","sala"], office:["sala","circ"], banho:["circ","sala"], lavabo:["sala","circ","entrada"],
  bsuite:["suite"], closet:["suite"], sacada:["sala","suite","dorm"]
};

/* tipos de passagem entre ambientes (portas[].tipo): porta de abrir, vão livre, integrado (sem parede), porta de correr */
const AED_PORTA_TIPOS = ["porta","vao","integ","correr"];

/* ---------- números ---------- */
const aedR = (v, q=AED_Q)=> +((Math.round(v/q)*q).toFixed(3));
const aedR3 = v=> +(+v).toFixed(3);
const aedClamp = (v,a,b)=> Math.max(a, Math.min(b, v));
const aedNum = (v, d)=> (typeof v==="number" && isFinite(v))? v : d;
const aedFmt = (v, d=2)=> (+v).toFixed(d).replace(".", ",");
/* ímã: encosta em uma das referências (bordas dos outros ambientes) dentro da tolerância; senão, a grade de 5 cm */
function aedIma(v, alvos, tol){
  let best=null, bd=tol==null? 0 : tol;
  (alvos||[]).forEach(a=>{ const d=Math.abs(a-v); if(d<=bd+AED_EPS && (best===null || d<Math.abs(best-v))){ best=a } });
  return best!==null? aedR3(best) : aedR(v);
}
function aedUuid(){
  try{ if(typeof crypto!=="undefined" && crypto.randomUUID) return crypto.randomUUID() }catch(e){}
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c=>{ const r=Math.random()*16|0; return (c==="x"? r : (r&3|8)).toString(16) });
}
const aedAgora = ()=> new Date().toISOString();
const aedClone = o=> JSON.parse(JSON.stringify(o));

/* ---------- retângulos ---------- */
const aedB = a=>{ const [x,y,w,h]=a.ret; return {x0:x, y0:y, x1:x+w, y1:y+h} };
const aedArea = a=> a.ret[2]*a.ret[3];
function aedInter(A, B){ const w=Math.min(A.x1,B.x1)-Math.max(A.x0,B.x0), h=Math.min(A.y1,B.y1)-Math.max(A.y0,B.y0); return w>AED_EPS && h>AED_EPS? w*h : 0 }
/* A − B em até 4 retângulos [x,y,w,h] */
function aedSubtrai(A, B){
  if(!aedInter(A,B)) return [[A.x0, A.y0, A.x1-A.x0, A.y1-A.y0]];
  const out=[], y0=Math.max(A.y0,B.y0), y1=Math.min(A.y1,B.y1);
  if(B.y0>A.y0+AED_EPS) out.push([A.x0, A.y0, A.x1-A.x0, B.y0-A.y0]);
  if(B.y1<A.y1-AED_EPS) out.push([A.x0, B.y1, A.x1-A.x0, A.y1-B.y1]);
  if(B.x0>A.x0+AED_EPS) out.push([A.x0, y0, B.x0-A.x0, y1-y0]);
  if(B.x1<A.x1-AED_EPS) out.push([B.x1, y0, A.x1-B.x1, y1-y0]);
  return out.filter(r=>r[2]>AED_EPS && r[3]>AED_EPS);
}
/* recorta [x,y,w,h] na caixa W × D e passa pelo ímã */
function aedRetLimpo(ret, W, D, q=true){
  let [x,y,w,h]=ret.map(Number); if(w<0){ x+=w; w=-w } if(h<0){ y+=h; h=-h }
  let x0=aedClamp(x,0,W), y0=aedClamp(y,0,D), x1=aedClamp(x+w,0,W), y1=aedClamp(y+h,0,D);
  if(q){ x0=aedR(x0); y0=aedR(y0); x1=aedR(x1); y1=aedR(y1) }
  return [aedR3(x0), aedR3(y0), aedR3(x1-x0), aedR3(y1-y0)];
}

/* ---------- criar, normalizar, esquema ---------- */
function aedNovo(o={}){
  const tip = AED_TIP[o.tipologia]? o.tipologia : "2d", t=AED_TAM[tip];
  const W=aedR(aedNum(o.W, t[0])), D=aedR(aedNum(o.D, t[1])), h=aedAgora();
  return { id:"usr-"+aedUuid(), nome:o.nome || ("Meu "+AED_TIP[tip].toLowerCase().replace(/^(\d)/,"$1")), origem:"usuario", tipologia:tip, W, D,
    faixaW:{min:aedR(W*0.9), max:aedR(W*1.2)}, faixaD:{min:aedR(D*0.9), max:aedR(D*1.12)},
    entrada:{x:aedR(Math.max(0.5, W-0.9)), lado:"corredor"}, ambientes:[], criado:h, atualizado:h };
}
/* cópia limpa e coerente: medidas no ímã, ambientes dentro da caixa, ids únicos, faixas que contêm W e D */
function aedNormaliza(m0){
  const m=aedClone(m0||{}), tip=AED_TIP[m.tipologia]? m.tipologia : "2d", t=AED_TAM[tip];
  const W=aedR(aedClamp(aedNum(+m.W, t[0]), 2, 40)), D=aedR(aedClamp(aedNum(+m.D, t[1]), 2, 40));
  const ids=new Set(); let n=0; const novoId=()=>{ let i; do{ i="a"+(++n) }while(ids.has(i)); return i };
  const amb=(Array.isArray(m.ambientes)? m.ambientes : []).filter(a=>a && Array.isArray(a.ret) && a.ret.length===4 && a.ret.every(v=>isFinite(+v))).map(a=>{
    const ret=aedRetLimpo(a.ret, W, D, false);
    let id=typeof a.id==="string" && a.id && !ids.has(a.id) && a.id!=="entrada"? a.id : null;
    const o={ id:id||"", k: AED_K[a.k]? a.k : "sala", ret, estica: ["","x","y","xy"].includes(a.estica)? a.estica : (AED_K[a.k]||AED_K.sala).estica };
    if(a.grupo!=null && a.grupo!=="") o.grupo=String(a.grupo);
    if(typeof a.nome==="string" && a.nome.trim()) o.nome=a.nome.trim().slice(0,40);
    // campos do motor de plantas (docs/APTOS.md; aptos-api): dono do banho/closet, cama, ambiente opcional que se funde a outro
    ["de","cama","opc","funde"].forEach(k=>{ if(typeof a[k]==="string" && a[k]) o[k]=a[k].slice(0,40) });
    if(id) ids.add(id);
    return o;
  }).filter(a=>a.ret[2]>0.05 && a.ret[3]>0.05);
  amb.forEach(a=>{ if(!a.id){ a.id=novoId(); ids.add(a.id) } });
  amb.forEach(a=>{ ["de","funde"].forEach(k=>{ if(a[k] && !ids.has(a[k])) delete a[k] }) });
  const fx=(f, v)=>{ const mn=aedNum(f && +f.min, aedR(v*0.9)), mx=aedNum(f && +f.max, aedR(v*1.15)); return {min:aedR3(Math.min(mn, v)), max:aedR3(Math.max(mx, v))} };
  const out={ id: typeof m.id==="string" && m.id? m.id : "usr-"+aedUuid(), nome: String(m.nome||"Modelo sem nome").trim().slice(0,80) || "Modelo sem nome",
    origem: m.origem==="catalogo"? "catalogo" : "usuario", tipologia:tip, W, D, faixaW:fx(m.faixaW, W), faixaD:fx(m.faixaD, D),
    entrada:{ x:aedR3(aedClamp(aedNum(m.entrada && +m.entrada.x, W-0.9), 0.45, W-0.45)), lado:"corredor" }, ambientes:amb };
  if(Array.isArray(m.portas)) out.portas=m.portas.filter(p=>p && (ids.has(p.a)||p.a==="entrada") && ids.has(p.b) && p.a!==p.b)
    .map(p=>{ const q={a:p.a, b:p.b}; if(isFinite(+p.t) && p.t!=null) q.t=aedR3(aedClamp(+p.t,0,1));
      if(AED_PORTA_TIPOS.includes(p.tipo)) q.tipo=p.tipo; if(+p.w>0.4 && +p.w<4) q.w=aedR3(+p.w); if(["lo","hi","meio"].includes(p.pos)) q.pos=p.pos; return q });
  if(m.sacada && typeof m.sacada==="object") out.sacada=aedClone(m.sacada);
  out.criado = m.criado || aedAgora(); out.atualizado = m.atualizado || out.criado;
  if(m.base) out.base=String(m.base);
  return out;
}
/* confere se um objeto (vindo de um .json) tem cara de modelo: {ok, erros[]} em linguagem simples */
function aedValidaEsquema(o){
  const e=[];
  if(!o || typeof o!=="object" || Array.isArray(o)) return {ok:false, erros:["não é um modelo de apartamento"]};
  const W=+o.W, D=+o.D;
  if(!(W>=2 && W<=40)) e.push("frente (W) ausente ou fora de 2 a 40 m");
  if(!(D>=2 && D<=40)) e.push("profundidade (D) ausente ou fora de 2 a 40 m");
  if(!Array.isArray(o.ambientes)) e.push("falta a lista de ambientes");
  else {
    if(!o.ambientes.length) e.push("nenhum ambiente");
    o.ambientes.forEach((a,i)=>{
      if(!a || !Array.isArray(a.ret) || a.ret.length!==4 || !a.ret.every(v=>isFinite(+v))) e.push(`ambiente ${i+1}: retângulo inválido`);
      else if(!(+a.ret[2]>0 && +a.ret[3]>0)) e.push(`ambiente ${i+1}: medidas zeradas`);
      if(a && a.k!=null && !AED_K[a.k]) e.push(`ambiente ${i+1}: tipo desconhecido “${String(a.k).slice(0,20)}”`);
    });
  }
  if(o.tipologia!=null && !AED_TIP[o.tipologia]) e.push(`tipologia desconhecida “${String(o.tipologia).slice(0,20)}”`);
  if(o.portas!=null && !Array.isArray(o.portas)) e.push("portas precisa ser uma lista");
  return {ok:!e.length, erros:e};
}
/* .json → modelos: aceita um modelo, uma lista ou o arquivo exportado {formato:"gabarito.aptos", modelos:[…]} */
function aedImporta(texto){
  let o; try{ o=JSON.parse(texto) }catch(err){ return {ok:false, modelos:[], erros:["o arquivo não é um JSON válido"]} }
  const lista = Array.isArray(o)? o : o && Array.isArray(o.modelos)? o.modelos : [o];
  const modelos=[], erros=[];
  lista.forEach((x,i)=>{ const v=aedValidaEsquema(x); if(v.ok) modelos.push(aedNormaliza(Object.assign({}, x, {origem:"usuario"})));
    else erros.push((lista.length>1? `modelo ${i+1}${x && x.nome? " (“"+String(x.nome).slice(0,40)+"”)" : ""}: ` : "")+v.erros.join("; ")) });
  return {ok:modelos.length>0, modelos, erros};
}
function aedExporta(modelos){
  const l=(Array.isArray(modelos)? modelos : [modelos]).filter(Boolean).map(aedNormaliza);
  return JSON.stringify({formato:"gabarito.aptos", versao:1, exportado:aedAgora(), modelos:l}, null, 2);
}
/* cópia de um partido (do catálogo ou da biblioteca) para virar um modelo novo do usuário */
function aedCopia(m, nome){
  const c=aedNormaliza(m), h=aedAgora();
  c.base = m && m.origem==="catalogo"? m.id : (m && m.base) || undefined; if(!c.base) delete c.base;
  c.id="usr-"+aedUuid(); c.origem="usuario"; c.nome=nome || c.nome; c.criado=h; c.atualizado=h;
  return c;
}

/* ---------- conferência: preenche W × D sem sobrepor (malha das coordenadas) ---------- */
function aedMalha(m){
  const xs=new Set([0, m.W]), ys=new Set([0, m.D]);
  m.ambientes.forEach(a=>{ const b=aedB(a); [b.x0,b.x1].forEach(v=>xs.add(aedR3(aedClamp(v,0,m.W)))); [b.y0,b.y1].forEach(v=>ys.add(aedR3(aedClamp(v,0,m.D)))) });
  const X=[...xs].sort((a,b)=>a-b), Y=[...ys].sort((a,b)=>a-b), cel=[];
  for(let j=0;j<Y.length-1;j++) for(let i=0;i<X.length-1;i++){
    const w=X[i+1]-X[i], h=Y[j+1]-Y[j]; if(w<AED_EPS || h<AED_EPS) continue;
    const cx=(X[i]+X[i+1])/2, cy=(Y[j]+Y[j+1])/2;
    const em=m.ambientes.filter(a=>{ const b=aedB(a); return cx>b.x0 && cx<b.x1 && cy>b.y0 && cy<b.y1 }).map(a=>a.id);
    cel.push({i, j, x:X[i], y:Y[j], w, h, em});
  }
  return {X, Y, cel};
}
function aedConfere(m){
  const A=m.W*m.D, g=aedMalha(m); let livre=0, sob=0; const pares={};
  g.cel.forEach(c=>{ const a=c.w*c.h; if(!c.em.length) livre+=a; else if(c.em.length>1){ sob+=a;
    for(let i=0;i<c.em.length;i++) for(let j=i+1;j<c.em.length;j++){ const k=c.em[i]+"|"+c.em[j]; pares[k]=(pares[k]||0)+a } } });
  const fora=m.ambientes.filter(a=>{ const b=aedB(a); return b.x0<-AED_EPS || b.y0<-AED_EPS || b.x1>m.W+AED_EPS || b.y1>m.D+AED_EPS }).map(a=>a.id);
  const lp=Object.entries(pares).map(([k,v])=>{ const [a,b]=k.split("|"); return {a, b, area:aedR3(v)} }).filter(p=>p.area>0.0005);
  return { area:A, coberta:aedR3(A-livre), livre:aedR3(livre), sobreposta:aedR3(sob), pares:lp, fora,
    ok: livre<=0.01*A+AED_EPS && sob<=0.0005 && !fora.length };
}
/* sobras (áreas sem ambiente) em retângulos: junta as células por linha e depois as linhas iguais */
function aedLivres(m){
  const g=aedMalha(m), runs=[];
  const porLinha={}; g.cel.forEach(c=>{ (porLinha[c.j]=porLinha[c.j]||[]).push(c) });
  Object.keys(porLinha).map(Number).sort((a,b)=>a-b).forEach(j=>{ let cur=null;
    porLinha[j].sort((a,b)=>a.i-b.i).forEach(c=>{ if(!c.em.length){ if(cur && Math.abs(cur.x+cur.w-c.x)<AED_EPS){ cur.w+=c.w } else { cur={x:c.x, y:c.y, w:c.w, h:c.h}; runs.push(cur) } } else cur=null }) });
  const out=[];
  runs.forEach(r=>{ const o=out.find(q=>Math.abs(q.x-r.x)<AED_EPS && Math.abs(q.w-r.w)<AED_EPS && Math.abs(q.y+q.h-r.y)<AED_EPS); if(o) o.h+=r.h; else out.push({...r}) });
  return out.filter(r=>r.w*r.h>0.0025).map(r=>[aedR3(r.x), aedR3(r.y), aedR3(r.w), aedR3(r.h)]);
}

/* ---------- edição (cada operação devolve um modelo NOVO; o original não muda) ---------- */
function aedNovoId(m){ const s=new Set(m.ambientes.map(a=>a.id)); let n=m.ambientes.length+1; while(s.has("a"+n)) n++; return "a"+n }
const aedAcha = (m, id)=> m.ambientes.find(a=>a.id===id);
/* desenha um ambiente: o novo ganha a área; quem fica coberto sai e quem sobra num retângulo encolhe (senão a sobreposição fica e a validação acusa) */
function aedCria(m0, ret, k="sala", o={}){
  const m=aedClone(m0), r=aedRetLimpo(ret, m.W, m.D);
  if(r[2]<AED_MIN-AED_EPS || r[3]<AED_MIN-AED_EPS) return {m:m0, id:null};
  const B={x0:r[0], y0:r[1], x1:r[0]+r[2], y1:r[1]+r[3]}, id=aedNovoId(m);
  m.ambientes=m.ambientes.flatMap(a=>{ const A=aedB(a); if(!aedInter(A,B)) return [a];
    const s=aedSubtrai(A,B); if(!s.length) return []; if(s.length===1){ a.ret=s[0].map(aedR3); return [a] } return [a] });
  const kk=AED_K[k]? k : "sala";
  m.ambientes.push({id, k:kk, ret:r, estica:o.estica!=null? o.estica : AED_K[kk].estica});
  aedLimpaPortas(m);
  return {m, id};
}
function aedRemove(m0, id){ const m=aedClone(m0); m.ambientes=m.ambientes.filter(a=>a.id!==id); aedLimpaPortas(m); return m }
function aedTipo(m0, id, k){ const m=aedClone(m0), a=aedAcha(m,id); if(a && AED_K[k]){ const era=AED_K[a.k].estica===a.estica; a.k=k; if(era) a.estica=AED_K[k].estica; aedDonos(m) } return m }
/* banho da suíte e closet: `de` = a suíte dona (a que encosta; se houver mais de uma, a de maior trecho comum) */
function aedDonos(m){
  m.ambientes.forEach(a=>{
    if(a.k!=="bsuite" && a.k!=="closet"){ delete a.de; return }
    if(a.de && aedAcha(m,a.de) && aedAcha(m,a.de).k==="suite" && aedEncosto(aedB(a), aedB(aedAcha(m,a.de)))) return;
    let best=null; m.ambientes.forEach(s=>{ if(s.k!=="suite") return; const e=aedEncosto(aedB(a), aedB(s)); if(e && (!best || e.len>best.len)) best={id:s.id, len:e.len} });
    if(best) a.de=best.id; else delete a.de;
  });
  return m;
}
function aedEstica(m0, id, e){ const m=aedClone(m0), a=aedAcha(m,id); if(a && ["","x","y","xy"].includes(e)) a.estica=e; return m }
/* move um ambiente inteiro (fica dentro da caixa) */
function aedMove(m0, id, dx, dy){
  const m=aedClone(m0), a=aedAcha(m,id); if(!a) return m;
  const [x,y,w,h]=a.ret; a.ret=[aedR3(aedClamp(aedR(x+dx),0,m.W-w)), aedR3(aedClamp(aedR(y+dy),0,m.D-h)), w, h];
  return aedLimpaPortas(m);
}
/* troca o retângulo (painel de propriedades): ímã, dentro da caixa, medida mínima */
function aedPoe(m0, id, ret){
  const m=aedClone(m0), a=aedAcha(m,id); if(!a) return m;
  const r=aedRetLimpo(ret, m.W, m.D); if(r[2]<AED_MIN-AED_EPS || r[3]<AED_MIN-AED_EPS) return m0;
  a.ret=r; return aedLimpaPortas(m);
}
/* arrasta uma borda de um ambiente só (lado "x0"|"x1"|"y0"|"y1") */
function aedRedim(m0, id, lado, v){
  const m=aedClone(m0), a=aedAcha(m,id); if(!a) return m;
  const b=aedB(a);
  if(lado==="x0") b.x0=aedClamp(aedR(v), 0, b.x1-AED_MIN); else if(lado==="x1") b.x1=aedClamp(aedR(v), b.x0+AED_MIN, m.W);
  else if(lado==="y0") b.y0=aedClamp(aedR(v), 0, b.y1-AED_MIN); else if(lado==="y1") b.y1=aedClamp(aedR(v), b.y0+AED_MIN, m.D);
  a.ret=[aedR3(b.x0), aedR3(b.y0), aedR3(b.x1-b.x0), aedR3(b.y1-b.y0)];
  return aedLimpaPortas(m);
}
/* bordas de todos os ambientes (para clicar e arrastar) */
function aedBordas(m){
  const out=[];
  m.ambientes.forEach(a=>{ const b=aedB(a);
    out.push({id:a.id, lado:"x0", eixo:"x", c:b.x0, a0:b.y0, a1:b.y1}, {id:a.id, lado:"x1", eixo:"x", c:b.x1, a0:b.y0, a1:b.y1},
             {id:a.id, lado:"y0", eixo:"y", c:b.y0, a0:b.x0, a1:b.x1}, {id:a.id, lado:"y1", eixo:"y", c:b.y1, a0:b.x0, a1:b.x1}) });
  return out;
}
/* divisas compartilhadas: numa mesma reta, os ambientes de um lado (menos) e do outro (mais) que se encostam, ligados em cadeia */
function aedDivisas(m){
  const out=[];
  ["x","y"].forEach(eixo=>{
    const L=eixo==="x"? m.W : m.D, grupos={};
    aedBordas(m).filter(e=>e.eixo===eixo && e.c>AED_EPS && e.c<L-AED_EPS).forEach(e=>{ const k=aedR3(e.c); (grupos[k]=grupos[k]||[]).push(e) });
    Object.keys(grupos).forEach(k=>{
      const es=grupos[k], n=es.length, pai=es.map((_,i)=>i), raiz=i=>pai[i]===i? i : (pai[i]=raiz(pai[i]));
      for(let i=0;i<n;i++) for(let j=i+1;j<n;j++){ const A=es[i], B=es[j]; if(Math.min(A.a1,B.a1)-Math.max(A.a0,B.a0)>AED_EPS) pai[raiz(i)]=raiz(j) }
      const comp={}; es.forEach((e,i)=>{ (comp[raiz(i)]=comp[raiz(i)]||[]).push(e) });
      Object.values(comp).forEach(l=>{
        const menos=l.filter(e=>e.lado===eixo+"1"), mais=l.filter(e=>e.lado===eixo+"0"); if(!menos.length || !mais.length) return;
        const a0=Math.min(...l.map(e=>e.a0)), a1=Math.max(...l.map(e=>e.a1)), c=+k;
        out.push({id:`${eixo}${aedR3(c)}@${aedR3(a0)}`, eixo, c, a0, a1, menos:menos.map(e=>e.id), mais:mais.map(e=>e.id)});
      });
    });
  });
  return out;
}
/* divisa de que uma borda faz parte (ou null) */
function aedDivisaDe(m, id, lado){ const e=lado[0]; return aedDivisas(m).find(d=>d.eixo===e && (lado[1]==="1"? d.menos : d.mais).includes(id) && aedBordas(m).some(b=>b.id===id && b.lado===lado && Math.abs(b.c-d.c)<AED_EPS)) || null }
/* arrasta a divisa: as duas faces andam juntas; cada ambiente fica com pelo menos AED_MIN */
function aedMoveDivisa(m0, div, c){
  const m=aedClone(m0), e=div.eixo, lo=e==="x"? "x0" : "y0", hi=e==="x"? "x1" : "y1";
  const menos=div.menos.map(i=>aedAcha(m,i)).filter(Boolean), mais=div.mais.map(i=>aedAcha(m,i)).filter(Boolean);
  const mn=Math.max(...menos.map(a=>aedB(a)[lo]+AED_MIN)), mx=Math.min(...mais.map(a=>aedB(a)[hi]-AED_MIN));
  if(mn>mx) return m0;
  const v=aedR3(aedClamp(aedR(c), mn, mx));
  menos.forEach(a=>{ const b=aedB(a); b[hi]=v; a.ret=[aedR3(b.x0), aedR3(b.y0), aedR3(b.x1-b.x0), aedR3(b.y1-b.y0)] });
  mais.forEach(a=>{ const b=aedB(a); b[lo]=v; a.ret=[aedR3(b.x0), aedR3(b.y0), aedR3(b.x1-b.x0), aedR3(b.y1-b.y0)] });
  return aedLimpaPortas(m);
}
/* divide um ambiente em dois (eixo "x" = corte vertical, em x; "y" = corte horizontal); o novo ganha o mesmo tipo */
function aedDivide(m0, id, eixo="x", pos){
  const m=aedClone(m0), a=aedAcha(m,id); if(!a) return {m:m0, id:null};
  const b=aedB(a), lo=eixo==="x"? b.x0 : b.y0, hi=eixo==="x"? b.x1 : b.y1;
  if(hi-lo<2*AED_MIN-AED_EPS) return {m:m0, id:null};
  const c=aedClamp(aedR(pos!=null? pos : (lo+hi)/2), lo+AED_MIN, hi-AED_MIN), id2=aedNovoId(m);
  const n={id:id2, k:a.k, estica:a.estica};
  if(eixo==="x"){ a.ret=[b.x0, b.y0, aedR3(c-b.x0), aedR3(b.y1-b.y0)]; n.ret=[aedR3(c), b.y0, aedR3(b.x1-c), aedR3(b.y1-b.y0)] }
  else { a.ret=[b.x0, b.y0, aedR3(b.x1-b.x0), aedR3(c-b.y0)]; n.ret=[b.x0, aedR3(c), aedR3(b.x1-b.x0), aedR3(b.y1-c)] }
  m.ambientes.splice(m.ambientes.indexOf(a)+1, 0, n); aedLimpaPortas(m);
  return {m, id:id2};
}
/* une dois ambientes: retângulo se formam um retângulo; senão viram um ambiente em L (mesmo `grupo`) se encostam */
function aedUne(m0, ida, idb){
  const m=aedClone(m0), a=aedAcha(m,ida), b=aedAcha(m,idb); if(!a || !b || a===b) return {m:m0, modo:null};
  const A=aedB(a), B=aedB(b), q=(u,v)=>Math.abs(u-v)<AED_EPS;
  const ret = (q(A.y0,B.y0) && q(A.y1,B.y1) && (q(A.x1,B.x0) || q(B.x1,A.x0))) || (q(A.x0,B.x0) && q(A.x1,B.x1) && (q(A.y1,B.y0) || q(B.y1,A.y0)));
  if(ret){ const x0=Math.min(A.x0,B.x0), y0=Math.min(A.y0,B.y0), x1=Math.max(A.x1,B.x1), y1=Math.max(A.y1,B.y1);
    a.ret=[x0, y0, aedR3(x1-x0), aedR3(y1-y0)]; const gb=b.grupo; m.ambientes=m.ambientes.filter(x=>x!==b);
    if(gb) m.ambientes.forEach(x=>{ if(x.grupo===gb) x.grupo=a.grupo||(a.grupo=gb) });
    (m.portas||[]).forEach(p=>{ if(p.a===b.id) p.a=a.id; if(p.b===b.id) p.b=a.id }); aedLimpaPortas(m);
    return {m, modo:"ret"} }
  if(!aedEncosto(A,B)) return {m:m0, modo:null};
  const g=a.grupo||b.grupo||("g"+aedNovoId(m).slice(1));
  m.ambientes.forEach(x=>{ if(x===a || x===b || (x.grupo && (x.grupo===a.grupo || x.grupo===b.grupo))) x.grupo=g });
  b.k=a.k; aedLimpaPortas(m);
  return {m, modo:"grupo"};
}
function aedSepara(m0, id){ const m=aedClone(m0), a=aedAcha(m,id); if(a && a.grupo){ const g=a.grupo; delete a.grupo; const r=m.ambientes.filter(x=>x.grupo===g); if(r.length===1) delete r[0].grupo } return m }
/* trecho compartilhado entre dois retângulos (encosto): {eixo, c, s0, s1, len} */
function aedEncosto(A, B){
  const q=(u,v)=>Math.abs(u-v)<AED_EPS;
  if(q(A.x1,B.x0) || q(B.x1,A.x0)){ const s0=Math.max(A.y0,B.y0), s1=Math.min(A.y1,B.y1); if(s1-s0>AED_EPS) return {eixo:"x", c:q(A.x1,B.x0)? A.x1 : A.x0, s0, s1, len:s1-s0} }
  if(q(A.y1,B.y0) || q(B.y1,A.y0)){ const s0=Math.max(A.x0,B.x0), s1=Math.min(A.x1,B.x1); if(s1-s0>AED_EPS) return {eixo:"y", c:q(A.y1,B.y0)? A.y1 : A.y0, s0, s1, len:s1-s0} }
  return null;
}
/* porta de entrada no lado do corredor (y = D) */
function aedEntrada(m0, x){ const m=aedClone(m0); m.entrada={x:aedR3(aedClamp(aedR(x),0.45,m.W-0.45)), lado:"corredor"}; return m }
/* espelha (entrada do outro lado) */
function aedEspelha(m0){
  const m=aedClone(m0), W=m.W;
  m.ambientes.forEach(a=>{ const [x,y,w,h]=a.ret; a.ret=[aedR3(W-x-w), y, w, h] });
  m.entrada.x=aedR3(W-m.entrada.x);
  (m.portas||[]).forEach(p=>{ if(p.t==null) return; const A=aedAcha(m0,p.a), B=aedAcha(m0,p.b); const e=A&&B&&aedEncosto(aedB(A),aedB(B)); if(e && e.eixo==="y") p.t=aedR3(1-p.t) });
  return m;
}
/* troca a frente e a profundidade do desenho (aplica as faixas que esticam) e passa pelo ímã */
function aedMedidas(m0, W, D){
  const W2=aedR(aedClamp(+W||m0.W, 2.5, 40)), D2=aedR(aedClamp(+D||m0.D, 2.5, 40));
  const m=aedAplicaSimples(m0, W2, D2, {ima:true});
  m.faixaW={min:aedR3(Math.min(m0.faixaW? m0.faixaW.min : W2, W2)), max:aedR3(Math.max(m0.faixaW? m0.faixaW.max : W2, W2))};
  m.faixaD={min:aedR3(Math.min(m0.faixaD? m0.faixaD.min : D2, D2)), max:aedR3(Math.max(m0.faixaD? m0.faixaD.max : D2, D2))};
  return m;
}
/* portas que deixaram de fazer sentido (ambiente apagado, não encostam mais) saem da lista explícita */
function aedLimpaPortas(m){
  aedDonos(m);
  if(!Array.isArray(m.portas)) return m;
  const ids=new Set(m.ambientes.map(a=>a.id));
  m.portas=m.portas.filter(p=>ids.has(p.b) && (p.a==="entrada" || (ids.has(p.a) && aedEncosto(aedB(aedAcha(m,p.a)), aedB(aedAcha(m,p.b))))));
  return m;
}

/* ---------- aplicar a outra medida: faixas que esticam (docs/APTOS.md §2) ---------- */
/* função que leva cada coordenada do eixo para a nova medida: as faixas só com ambientes que esticam naquele eixo (ou vazias) absorvem a diferença */
function aedEscalaEixo(m, eixo, novo){
  const L=eixo==="x"? m.W : m.D, d=novo-L;
  if(Math.abs(d)<AED_EPS) return v=>v;
  const cs=new Set([0, L]); m.ambientes.forEach(a=>{ const b=aedB(a); cs.add(aedR3(eixo==="x"? b.x0 : b.y0)); cs.add(aedR3(eixo==="x"? b.x1 : b.y1)) });
  const C=[...cs].filter(v=>v>=-AED_EPS && v<=L+AED_EPS).sort((a,b)=>a-b), faixas=[];
  for(let i=0;i<C.length-1;i++){ const a=C[i], b=C[i+1]; if(b-a<AED_EPS) continue; const mid=(a+b)/2;
    const cobre=m.ambientes.filter(x=>{ const B=aedB(x); return eixo==="x"? (mid>B.x0 && mid<B.x1) : (mid>B.y0 && mid<B.y1) });
    faixas.push({a, b, el: !cobre.length || cobre.every(x=>(x.estica||"").includes(eixo))}) }
  let E=faixas.filter(f=>f.el).reduce((s,f)=>s+f.b-f.a,0);
  const prop = E<AED_EPS || (d<0 && (E+d)/E<0.35);
  const novas=faixas.map(f=>{ const w=f.b-f.a; return prop? w*novo/L : f.el? w*(E+d)/E : w });
  const mapa=[[0,0]]; let acc=0; faixas.forEach((f,i)=>{ acc+=novas[i]; mapa.push([f.b, acc]) });
  return v=>{ if(v<=0) return v*novo/L; for(let i=1;i<mapa.length;i++){ const [a0,b0]=mapa[i-1], [a1,b1]=mapa[i]; if(v<=a1+AED_EPS) return a1-a0<AED_EPS? b1 : b0+(v-a0)*(b1-b0)/(a1-a0) } return novo };
}
function aedAplicaSimples(m0, W2, D2, o={}){
  const m=aedClone(m0), fx=aedEscalaEixo(m0,"x",W2), fy=aedEscalaEixo(m0,"y",D2), r=o.ima? aedR : aedR3;
  m.ambientes.forEach(a=>{ const b=aedB(a), x0=r(fx(b.x0)), x1=r(fx(b.x1)), y0=r(fy(b.y0)), y1=r(fy(b.y1)); a.ret=[aedR3(x0), aedR3(y0), aedR3(x1-x0), aedR3(y1-y0)] });
  m.W=aedR3(W2); m.D=aedR3(D2); m.entrada={x:aedR3(aedClamp(r(fx(m0.entrada.x)), 0.45, W2-0.45)), lado:"corredor"};
  return m;
}
/* aplica no tamanho real: o motor de plantas (aptoAplica) quando existe; senão as faixas que esticam daqui */
function aedAplica(m, W, D, st){
  if(typeof aptoAplica==="function"){ try{ const r=aptoAplica(m, W, D, {st}); if(r) return r }catch(e){} }
  return aedAplicaSimples(m, W, D);
}

/* ---------- portas e janelas ---------- */
const aedNo = a=> a.grupo? "g:"+a.grupo : a.id;
const aedLargPorta = (k)=> k==="entrada"? 0.9 : (k==="banho"||k==="bsuite"||k==="lavabo")? 0.7 : 0.8;
/* encostos entre ambientes (de nós diferentes) com o maior trecho de cada par */
function aedVizinhos(m){
  const out=[], A=m.ambientes;
  for(let i=0;i<A.length;i++) for(let j=i+1;j<A.length;j++){ if(aedNo(A[i])===aedNo(A[j])) continue; const e=aedEncosto(aedB(A[i]), aedB(A[j])); if(e) out.push({a:A[i].id, b:A[j].id, ...e}) }
  return out;
}
/* ambiente em que a porta de entrada cai (encosta no corredor, y = D) */
function aedSala0(m){ const x=m.entrada.x; return m.ambientes.find(a=>{ const b=aedB(a); return Math.abs(b.y1-m.D)<AED_EPS && x>b.x0+0.3 && x<b.x1-0.3 }) || m.ambientes.find(a=>{ const b=aedB(a); return Math.abs(b.y1-m.D)<AED_EPS && x>=b.x0 && x<=b.x1 }) || null }
/* portas deduzidas pela adjacência + regras de acesso (AED_PAI): árvore a partir da entrada */
function aedDeduzPortas(m){
  const e0=aedSala0(m); if(!e0) return [];
  const viz=aedVizinhos(m), porNo={}; m.ambientes.forEach(a=>{ (porNo[aedNo(a)]=porNo[aedNo(a)]||[]).push(a) });
  const kNo=n=>porNo[n][0].k, alc=new Set([aedNo(e0)]), portas=[{a:"entrada", b:e0.id}];
  const bsDe={};   // banho da suíte: uma por suíte
  // por rodadas de preferência: primeiro só as ligações preferidas (dormitório pela circulação antes de pela sala)
  for(let lim=0; lim<4; lim++){ let mudou=true;
  while(mudou){ mudou=false;
    Object.keys(porNo).forEach(n=>{ if(alc.has(n)) return; const k=kNo(n), pref=AED_PAI[k]||[]; let melhor=null;
      viz.forEach(v=>{ const ea=aedAcha(m,v.a), eb=aedAcha(m,v.b); let p=null, me=null; if(aedNo(ea)===n){ me=ea; p=eb } else if(aedNo(eb)===n){ me=eb; p=ea } if(!p || !alc.has(aedNo(p))) return;
        const r=pref.indexOf(p.k); if(r<0 || r>lim) return; if(v.len<aedLargPorta(k)+0.1-AED_EPS) return;
        if(k==="bsuite" && bsDe[aedNo(p)]) return;
        if(me.de && (k==="bsuite" || k==="closet") && p.id!==me.de && aedNo(p)!==aedNo(aedAcha(m,me.de)||p)) return;
        const sc=r*100-v.len; if(!melhor || sc<melhor.sc) melhor={sc, a:p.id, b:me.id, pn:aedNo(p)} });
      if(melhor){ portas.push({a:melhor.a, b:melhor.b}); alc.add(n); if(k==="bsuite") bsDe[melhor.pn]=n; mudou=true }
    });
  } }
  return portas;
}
/* portas que o motor de plantas deduz (aptoAplica), no formato do modelo — assim o editor mostra o mesmo que o estudo vai usar */
function aedPortasMotor(m, st){
  if(typeof aptoAplica!=="function" || !m.ambientes.length) return null;
  try{ const pl=aptoAplica(m, m.W, m.D, {st}); if(!pl || !Array.isArray(pl.portas) || !pl.portas.length) return null;
    const ids=new Set(m.ambientes.map(a=>a.id));
    const l=pl.portas.filter(p=>p && ids.has(p.b) && (p.a==="entrada" || ids.has(p.a))).map(p=>{ const q={a:p.a, b:p.b}; if(["vao","integ","correr"].includes(p.k)) q.tipo=p.k; return q });
    return l.length? l : null;
  }catch(e){ return null }
}
const aedPortas = (m, st)=> Array.isArray(m.portas)? m.portas : (aedPortasMotor(m, st) || aedDeduzPortas(m));
/* liga/desliga a porta entre dois ambientes (a lista vira explícita) */
function aedPortaAlterna(m0, a, b){
  const m=aedClone(m0); m.portas=aedClone(aedPortas(m0));
  const i=m.portas.findIndex(p=>(p.a===a && p.b===b) || (p.a===b && p.b===a));
  if(i>=0) m.portas.splice(i,1); else { const A=aedAcha(m,a), B=aedAcha(m,b); if(!A || !B || !aedEncosto(aedB(A),aedB(B))) return m0; m.portas.push({a, b}) }
  return m;
}
function aedPortasAuto(m0){ const m=aedClone(m0); delete m.portas; return m }
/* troca o tipo da passagem existente: porta → vão → porta de correr → integrado → porta */
function aedPortaTipo(m0, a, b){
  const m=aedClone(m0); m.portas=aedClone(aedPortas(m0));
  const p=m.portas.find(p=>(p.a===a && p.b===b) || (p.a===b && p.b===a)); if(!p) return m0;
  const ord=["porta","vao","correr","integ"], i=ord.indexOf(p.tipo||"porta"); p.tipo=ord[(i+1)%ord.length]; if(p.tipo==="porta") delete p.tipo;
  return m;
}
/* geometria da porta: segmento no trecho comum; t (0…1) ou pos ("lo"|"hi"|"meio") = posição do centro; folha abre para dentro de b */
function aedPortaGeo(m, p){
  let B=aedAcha(m,p.b); if(!B) return null; let bb=aedB(B);
  if(p.a==="entrada"){ const w=aedLargPorta("entrada"), x=aedClamp(m.entrada.x, bb.x0+w/2, bb.x1-w/2); return {eixo:"y", c:m.D, s0:x-w/2, s1:x+w/2, w, dentro:-1, a:"entrada", b:p.b, entrada:true, tipo:"porta"} }
  let A=aedAcha(m,p.a); if(!A) return null;
  let e=aedEncosto(aedB(A), bb);
  if(!e){ // ambientes em L: o trecho comum mais longo entre os retângulos dos dois grupos
    const gA=m.ambientes.filter(x=>aedNo(x)===aedNo(A)), gB=m.ambientes.filter(x=>aedNo(x)===aedNo(B)); let best=null;
    gA.forEach(x=>gB.forEach(y=>{ const t=aedEncosto(aedB(x), aedB(y)); if(t && (!best || t.len>best.e.len)) best={e:t, A:x, B:y} }));
    if(!best) return null; e=best.e; A=best.A; B=best.B; bb=aedB(B);
  }
  const pj = A.k==="sacada" || B.k==="sacada", tipo = pj? "pj" : (p.tipo||"porta");
  if(tipo==="integ"){ const f=Math.min(0.1, e.len/4); return {eixo:e.eixo, c:e.c, s0:e.s0+f, s1:e.s1-f, w:e.len-2*f, dentro:1, a:p.a, b:p.b, pj:false, len:e.len, tipo} }
  let w = p.w? +p.w : pj? Math.min(e.len-0.2, Math.max(1.2, e.len*0.6)) : tipo==="vao"? Math.min(e.len-0.2, 1.2) : Math.min(aedLargPorta(B.k), aedLargPorta(A.k));
  w=Math.max(0.5, Math.min(w, e.len-0.1));
  // sem posição dada: a porta fica no canto do ambiente em que se entra (o meio dele fica livre para os móveis)
  const ca= e.eixo==="x"? [bb.y0, bb.y1] : [bb.x0, bb.x1], dLo=Math.min(...ca.map(v=>Math.abs(v-e.s0))), dHi=Math.min(...ca.map(v=>Math.abs(v-e.s1)));
  const auto= p.t==null && !p.pos && !pj && tipo!=="vao";
  const folga=0.1, lo=e.s0+folga+w/2, hi=e.s1-folga-w/2, t=p.t!=null? p.t : p.pos==="lo"? 0 : p.pos==="hi"? 1 : auto? (dHi<dLo-AED_EPS? 1 : 0) : 0.5, cen= hi>lo? lo+(hi-lo)*t : (e.s0+e.s1)/2;
  const dentro = (e.eixo==="x"? (bb.x0>=e.c-AED_EPS) : (bb.y0>=e.c-AED_EPS))? 1 : -1;   // de que lado da reta fica b
  return {eixo:e.eixo, c:e.c, s0:cen-w/2, s1:cen+w/2, w, dentro, a:p.a, b:p.b, pj, len:e.len, tipo, dob: t>0.5? "hi" : "lo"};
}
/* janelas na fachada (y = 0): permanência prolongada com vão ~1/6 da área; molhadas com vão pequeno */
function aedJanelas(m, st){
  const jan=(st && st.comodos && st.comodos.jan) || {frac:6, h:1.2, hSala:2.1}, out=[];
  m.ambientes.forEach(a=>{ const b=aedB(a); if(b.y0>AED_EPS || a.k==="sacada" || a.k==="circ" || a.k==="desp") return;
    const w=b.x1-b.x0, K=AED_K[a.k]||{}; let l;
    if(K.janela){ const h=a.k==="sala"? jan.hSala : jan.h; l=Math.min(w-0.4, Math.max(1.2, aedArea(a)/jan.frac/h*1.15)) }
    else if(a.k==="closet") return; else l=Math.min(w-0.3, 0.8);
    if(l<0.4) return; const cx=(b.x0+b.x1)/2; out.push({a:a.id, x0:aedR3(cx-l/2), x1:aedR3(cx+l/2), l:aedR3(l)}) });
  return out;
}

/* ---------- validação mínima (quando aptoValida não existe) e junção com o motor de plantas ---------- */
/* {ok, nota, problemas:[{k, nivel:"bad"|"warn", amb?, msg}]} — mesmo formato do aptoValida (docs/APTOS.md §1) */
function aedNomeAmb(m, a){
  if(!a) return ""; const K=AED_K[a.k]||{nome:a.k};
  const nos=[...new Set(m.ambientes.filter(x=>x.k===a.k).map(aedNo))], i=nos.indexOf(aedNo(a));
  return a.nome || (nos.length>1? `${K.nome} ${i+1}` : K.nome);
}
function aedValidaMin(m, st){
  const P=[], add=(k, nivel, amb, msg)=>P.push(amb? {k, nivel, amb, msg} : {k, nivel, msg});
  const mins=Object.assign({}, AED_MINS, (st && st.comodos && st.comodos.min) || {}); mins.bsuite=mins.bsuite||mins.banho;
  const nome=a=>aedNomeAmb(m,a), lo=s=>s.charAt(0).toLowerCase()+s.slice(1), fm=v=>aedFmt(v,2), fa=v=>aedFmt(v,1);
  if(!m.ambientes.length){ add("vazio","bad",null,"Desenhe os ambientes do apartamento"); return aedNota(P) }
  // 1. preenche W × D sem sobrepor
  const cf=aedConfere(m);
  cf.pares.forEach(p=>add("sobrepoe","bad",p.a,`${nome(aedAcha(m,p.a))} e ${lo(nome(aedAcha(m,p.b)))} se sobrepõem (${fa(p.area)} m²)`));
  cf.fora.forEach(id=>add("fora","bad",id,`${nome(aedAcha(m,id))} sai do contorno da unidade`));
  if(cf.livre>0.01*cf.area) add("sobra","bad",null,`Sobram ${fa(cf.livre)} m² sem ambiente`);
  // 2. programa da tipologia
  const prog=AED_PROG[m.tipologia]||{}, nos={}; m.ambientes.forEach(a=>{ (nos[a.k]=nos[a.k]||new Set()).add(aedNo(a)) });
  Object.entries(prog).forEach(([k,n])=>{ const t=nos[k]? nos[k].size : 0; if(t<n){ const falta=n-t, K=AED_K[k];
    add("programa", ["serv","lavabo"].includes(k)? "warn" : "bad", null, `Falta${falta>1?"m":""} ${falta>1? falta+" "+K.plural : lo(K.longo)} para ${lo(AED_TIP[m.tipologia])}`) } });
  // 3. cada ambiente (grupos em L contam como um): área, menor medida, proporção
  const grupos={}; m.ambientes.forEach(a=>{ (grupos[aedNo(a)]=grupos[aedNo(a)]||[]).push(a) });
  Object.values(grupos).forEach(l=>{ const a=l[0], mn=mins[a.k]||{a:0,l:0}, area=l.reduce((s,x)=>s+aedArea(x),0);
    const lado=Math.max(...l.map(x=>Math.min(x.ret[2],x.ret[3])));
    if(mn.a && area<mn.a-0.005) add("area","bad",a.id,`${nome(a)} com ${fa(area)} m² (mínimo ${fa(mn.a)} m²)`);
    if(mn.l && lado<mn.l-0.005) add("largura","bad",a.id,`${nome(a)} estreito: ${fm(lado)} m (mínimo ${fm(mn.l)} m)`);
    if(l.length===1){ const r=Math.max(a.ret[2],a.ret[3])/Math.max(0.01,Math.min(a.ret[2],a.ret[3]));
      if(["dorm","suite"].includes(a.k) && r>2.2) add("proporcao","warn",a.id,`${nome(a)} comprido demais (${aedFmt(r,1)} : 1)`);
      if(a.k==="sala" && r>3) add("proporcao","warn",a.id,`Sala comprida demais (${aedFmt(r,1)} : 1)`) }
  });
  // 4. iluminação: sala, dormitórios e suítes com janela na fachada (ou abrindo para a sacada)
  const jan=aedJanelas(m, st), J=(st && st.comodos && st.comodos.jan) || {frac:6, h:1.2, hSala:2.1}, portas=aedPortas(m);
  const sacadaDe=a=>m.ambientes.some(s=>s.k==="sacada" && aedB(s).y0<AED_EPS && aedEncosto(aedB(s), aedB(a)) && aedEncosto(aedB(s), aedB(a)).eixo==="y");
  Object.values(grupos).forEach(l=>{ const a=l[0]; if(!(AED_K[a.k]||{}).janela) return;
    const js=jan.filter(j=>l.some(x=>x.id===j.a)), sac=l.some(sacadaDe), area=l.reduce((s,x)=>s+aedArea(x),0);
    if(!js.length && !sac) add("janela","bad",a.id,`${nome(a)} sem janela na fachada`);
    else if(js.length && !sac){ const h=a.k==="sala"? J.hSala : J.h, vao=js.reduce((s,j)=>s+j.l,0)*h; if(vao<area/J.frac-0.01) add("iluminacao","warn",a.id,`${nome(a)}: janela abaixo de 1/${J.frac} do piso`) } });
  // 5. entrada e acessos (pelas portas, seguindo as regras de passagem)
  const e0=aedSala0(m);
  if(!e0) add("entrada","bad",null,"A porta de entrada não cai em nenhum ambiente do lado do corredor");
  else if(!["sala","circ","cozinha","serv"].includes(e0.k)) add("entrada","warn",e0.id,`A entrada abre direto ${["dorm","suite","banho","bsuite","lavabo","closet"].includes(e0.k)? "no" : "na"} ${lo(nome(e0))}`);
  const porNo={}; m.ambientes.forEach(a=>{ porNo[aedNo(a)]=porNo[aedNo(a)]||a });
  const adj={}; portas.forEach(p=>{ const B=aedAcha(m,p.b); if(!B) return; const nb=aedNo(B);
    if(p.a==="entrada"){ (adj.entrada=adj.entrada||[]).push(nb); return } const A=aedAcha(m,p.a); if(!A) return; const na=aedNo(A);
    (adj[na]=adj[na]||[]).push(nb); (adj[nb]=adj[nb]||[]).push(na);
    const g=aedPortaGeo(m,p); if(g && !g.pj){ const need=Math.min(aedLargPorta(A.k), aedLargPorta(B.k)); if(g.len<need+0.1-AED_EPS) add("porta","warn",B.id,`Porta entre ${lo(nome(A))} e ${lo(nome(B))} sem espaço (trecho de ${fm(g.len)} m)`) } });
  const pode=(de, para)=>{ const kd= de==="entrada"? "entrada" : porNo[de].k, kp=porNo[para].k; return (AED_PAI[kp]||[]).includes(kd) };
  const bfs=(livre)=>{ const vis=new Set(), fila=["entrada"]; while(fila.length){ const n=fila.shift(); (adj[n]||[]).forEach(v=>{ if(vis.has(v)) return; if(!livre && !pode(n,v)) return; vis.add(v); fila.push(v) }) } return vis };
  const ok=bfs(false), qq=bfs(true);
  Object.keys(porNo).forEach(n=>{ const a=porNo[n]; if(ok.has(n)) return;
    if(qq.has(n)){ const via=(adj[n]||[]).filter(v=>qq.has(v)||v==="entrada").map(v=>v==="entrada"? "a entrada" : lo(nome(porNo[v])));
      add("passagem","bad",a.id,`${nome(a)} só é acessado ${via.length? "por "+via[0] : "por um caminho proibido"}`) }
    else add("acesso","bad",a.id,`${nome(a)} sem acesso a partir da entrada`) });
  // 6. zoneamento
  const ks=k=>m.ambientes.filter(a=>a.k===k);
  if(ks("cozinha").length && ks("serv").length && !ks("cozinha").some(c=>ks("serv").some(s=>aedEncosto(aedB(c),aedB(s))))) add("zona","warn",ks("serv")[0].id,"Serviço longe da cozinha");
  ks("bsuite").forEach(b=>{ if(!ks("suite").some(s=>aedEncosto(aedB(s),aedB(b)))) add("zona","bad",b.id,`${nome(b)} não encosta em nenhuma suíte`) });
  ks("closet").forEach(b=>{ if(!ks("suite").some(s=>aedEncosto(aedB(s),aedB(b)))) add("zona","warn",b.id,"Closet fora da suíte") });
  return aedNota(P);
}
function aedNota(P){
  const bad=P.filter(p=>p.nivel==="bad").length, warn=P.filter(p=>p.nivel==="warn").length;
  P.sort((a,b)=>(a.nivel==="bad"?0:1)-(b.nivel==="bad"?0:1));
  return {ok:!bad, nota:Math.max(0, 100-25*bad-6*warn), problemas:P};
}
/* referência do problema (id, índice ou objeto) → id do ambiente do modelo */
function aedAmbId(m, amb){
  if(amb==null) return null;
  if(typeof amb==="number") return m.ambientes[amb]? m.ambientes[amb].id : null;
  if(typeof amb==="object") return aedAmbId(m, amb.id!=null? amb.id : amb.i);
  const s=String(amb); return m.ambientes.some(a=>a.id===s)? s : null;
}
/* validação ao vivo do editor: estrutura daqui (preencher sem sobrepor, entrada, acessos) + regras do motor (aptoValida) quando existem */
function aedValida(m, st){
  const base=aedValidaMin(m, st);
  if(typeof aptoValida!=="function" || typeof aptoAplica!=="function" || !m.ambientes.length) return Object.assign(base, {fonte:"editor"});
  let r=null; try{ const pl=aptoAplica(m, m.W, m.D, {st}); r= pl? aptoValida(pl, st) : null }catch(e){ r=null }
  if(!r || !Array.isArray(r.problemas)) return Object.assign(base, {fonte:"editor"});
  // estrutura do desenho (preencher W × D sem sobrepor) é daqui; as regras de projeto são do motor de plantas
  const estr=new Set(["vazio","sobrepoe","fora","sobra"]);
  const P=base.problemas.filter(p=>estr.has(p.k));
  r.problemas.forEach(p=>{ if(!p || !p.msg) return; const id=aedAmbId(m, p.amb); const q={k:p.k||"regra", nivel:p.nivel==="bad"? "bad" : "warn", msg:String(p.msg)}; if(id) q.amb=id;
    if(!P.some(x=>x.msg===q.msg)) P.push(q) });
  const sb=P.filter(p=>estr.has(p.k)).length;
  const out=aedNota(P); out.nota=Math.max(0, Math.min(isFinite(+r.nota)? +r.nota - 25*sb : out.nota, 100)); out.ok=!P.some(p=>p.nivel==="bad"); out.fonte="regras";
  return out;
}

/* ---------- partidos para começar ---------- */
/* reserva enquanto o catálogo do motor de plantas (aptoCatalogo, src/calc/aptocatalogo.js) não existe */
function aedPartidosBase(){
  const P=(id, nome, tipologia, W, D, ex, amb)=>aedNormaliza({id, nome, origem:"catalogo", tipologia, W, D, entrada:{x:ex}, criado:"2026-10-15", atualizado:"2026-10-15",
    ambientes:amb.map(([k,x,y,w,h],i)=>({id:"a"+(i+1), k, ret:[x,y,w,h]}))});
  return [
    P("base-studio", "Studio com cozinha americana", "studio", 4.4, 7.6, 1.3, [["sala",0,0,4.4,4.6],["cozinha",0,4.6,2.6,3.0],["banho",2.6,4.6,1.8,3.0]]),
    P("base-2d", "2 dorm. · social na ponta", "2d", 7.9, 7.0, 1.5, [["sala",0,0,2.9,7.0],["dorm",2.9,0,2.5,3.3],["dorm",5.4,0,2.5,3.3],["circ",2.9,3.3,5.0,1.1],
      ["cozinha",2.9,4.4,2.0,2.6],["serv",4.9,4.4,1.3,2.6],["banho",6.2,4.4,1.7,2.6]])
  ];
}
/* partidos para começar: os do catálogo (aptoCatalogo) ou a reserva daqui */
function aedPartidos(tipologia){
  let l=null; if(typeof aptoCatalogo==="function"){ try{ const c=aptoCatalogo(); if(Array.isArray(c) && c.length) l=c }catch(e){} }
  l = l || aedPartidosBase();
  return tipologia? l.filter(p=>p && p.tipologia===tipologia) : l.filter(Boolean);
}

/* ---------- resumo e miniatura ---------- */
function aedResumo(m){
  const priv=m.ambientes.filter(a=>a.k!=="sacada").reduce((s,a)=>s+aedArea(a),0), sac=m.ambientes.filter(a=>a.k==="sacada").reduce((s,a)=>s+aedArea(a),0);
  return {area:aedR3(m.W*m.D), priv:aedR3(priv), sacada:aedR3(sac), n:m.ambientes.length, tip:AED_TIP[m.tipologia]||m.tipologia};
}
/* miniatura em SVG (classes aed-mk/aed-k-<tipo>; as cores vêm do CSS da tela). Fachada embaixo, corredor em cima. */
function aedMiniSVG(m, o={}){
  if(!m || !m.W || !m.D || !Array.isArray(m.ambientes)) return "";
  const W=m.W, D=m.D, pad=Math.max(W,D)*0.04, y=v=>aedR3(D-v), e=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const rs=m.ambientes.map(a=>{ const [x,yy,w,h]=a.ret; return `<rect class="aed-mk aed-k-${a.k}" x="${aedR3(x)}" y="${y(yy+h)}" width="${aedR3(w)}" height="${aedR3(h)}"/>` }).join("");
  const ex=aedR3(m.entrada? m.entrada.x : W/2);
  return `<svg class="aed-mini${o.cls? " "+o.cls : ""}" viewBox="${aedR3(-pad)} ${aedR3(-pad)} ${aedR3(W+2*pad)} ${aedR3(D+2*pad)}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${e(o.label||("Planta de "+(m.nome||"modelo")))}">`+
    `<rect class="aed-mc" x="0" y="0" width="${W}" height="${D}"/>${rs}<rect class="aed-mo" x="0" y="0" width="${W}" height="${D}"/>`+
    `<line class="aed-mf" x1="0" y1="${D}" x2="${W}" y2="${D}"/><line class="aed-me" x1="${aedR3(ex-0.45)}" y1="0" x2="${aedR3(ex+0.45)}" y2="0"/></svg>`;
}
