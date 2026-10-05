/* ================= cálculo em segundo plano (Web Worker) =================
   O build embute o código de cálculo puro como texto em <script type="text/plain" id="calcSrc">. Daqui saem dois Workers
   (Blob URL): "calc" (o compute() completo de cada mudança, persistente — o cache de garagens _garCache vive nele) e
   "job" (otimizador e estudo do melhor acesso; cancelar = encerrar o Worker).
   Protocolo (estilo Comlink): página → {id, fn, args}; Worker → {id, prog} (progresso) | {id, ok, val} | {id, err}; ao carregar → {ready}.
   - update() faz o cálculo barato aqui (sem layouts de garagem, reaproveitando os últimos) e pede o completo ao Worker (calcPedir).
   - Cada pedido tem número; resposta de pedido superado (ou de estado já mudado por arraste) é descartada.
   - Se o Worker não puder ser criado ou falhar (CSP do artifact, file://), tudo volta a rodar na página (calcFalhou).
   - calcPronto() → Promise que resolve quando o resultado completo do estado atual está na tela (exportar, salvar versão). */
const CALC = { estado:"off", url:null, w:null, job:null, jobAtivo:null, req:0, envId:0, aplicado:0, fila:false, ocupado:false, esperam:[], indT:0, ms:0 };
/* código anexado ao cálculo dentro do Worker */
const CALC_BOOT = `
self.window = self;
const _calcMemo = [];
const _calcFn = {
  compute(st, opt){
    S = st; const sig = JSON.stringify(st) + "|" + JSON.stringify(opt||{});
    const hit = _calcMemo.find(x=>x.sig===sig); if(hit) return hit.m;
    const m = compute(st, opt||{}); _calcMemo.unshift({sig, m}); if(_calcMemo.length>6) _calcMemo.pop(); return m;
  },
  acessoAvalia(st, c, full){ S = st; return acessoAvalia(st, c, full) },
  otimizar(st, mLite, opts, prog){ S = st; window._last = {m: mLite}; return new Promise(res=>otimizar(opts, p=>prog(p), r=>res(r))) },
  ping(){ return true }
};
function _calcPost(msg){ try{ self.postMessage(msg) }catch(e){ msg.val = serialLimpa(msg.val); self.postMessage(msg) } }
self.onmessage = async e=>{
  const {id, fn, args} = e.data || {};
  try{
    if(!_calcFn[fn]) throw new Error("função desconhecida no Worker: "+fn);
    const t0 = performance.now(), val = await _calcFn[fn](...(args||[]), p=>_calcPost({id, prog:p}));
    _calcPost({id, ok:1, val, ms: performance.now()-t0});
  }catch(err){ _calcPost({id, err: String(err && err.stack || err)}) }
};
self.postMessage({ready:1});
`;
function calcOn(){ return CALC.estado==="iniciando" || CALC.estado==="ok" }
function calcNovo(nome){
  const w = new Worker(CALC.url, {name:"gabarito-"+nome});
  const o = {w, nome, pend:new Map(), seq:0, pronto:false, morto:false, onready:null, onerro:null};
  w.onmessage = e=>{ const d=e.data||{};
    if(d.ready){ o.pronto=true; if(o.onready) o.onready(); return }
    const p=o.pend.get(d.id); if(!p) return;
    if(d.prog!=null){ if(p.prog) p.prog(d.prog); return }
    o.pend.delete(d.id); if(d.err) p.rej(new Error(d.err)); else { CALC.ms=d.ms||0; p.res(d.val) } };
  o.falha = msg=>{ if(o.morto) return; o.morto=true; try{ w.terminate() }catch(e){} for(const p of o.pend.values()) p.rej(new Error(msg)); o.pend.clear(); if(o.onerro) o.onerro(msg) };
  w.onerror = e=>{ try{ e.preventDefault() }catch(_){} o.falha("Worker: "+(e.message||"erro ao carregar")) };
  w.onmessageerror = ()=>o.falha("Worker: mensagem inválida");
  o.call = (fn, args, prog)=> new Promise((res,rej)=>{ if(o.morto) return rej(new Error("cancelado")); const id=++o.seq; o.pend.set(id,{res,rej,prog}); try{ w.postMessage({id,fn,args}) }catch(e){ o.pend.delete(id); rej(e) } });
  o.fim = ()=>{ if(o.morto) return; o.morto=true; try{ w.terminate() }catch(e){} for(const p of o.pend.values()) p.rej(new Error("cancelado")); o.pend.clear() };
  return o;
}
function calcInit(){
  if(CALC.estado!=="off") return;
  try{
    if(LS.get("gabarito.worker")===false) throw new Error("desligado (gabarito.worker=false)");
    const src=document.getElementById("calcSrc");
    if(!src || !src.textContent || typeof Worker==="undefined" || typeof Blob==="undefined" || typeof URL==="undefined" || !URL.createObjectURL) throw new Error("sem suporte");
    CALC.url = URL.createObjectURL(new Blob([src.textContent, "\n", CALC_BOOT], {type:"text/javascript"}));
    CALC.estado = "iniciando";
    CALC.w = calcNovo("calc");
    CALC.w.onready = ()=>{ if(CALC.estado==="iniciando") CALC.estado="ok"; clearTimeout(CALC.tIni) };
    CALC.w.onerro = msg=>calcFalhou(msg);
    CALC.tIni = setTimeout(()=>{ if(CALC.estado==="iniciando") calcFalhou("o Worker não respondeu") }, 10000);
  }catch(e){ calcFalhou(e && e.message || String(e)) }
}
/* sem Worker: tudo volta para a página (como antes) */
function calcFalhou(msg){
  if(CALC.estado==="falhou") return;
  const tinha = CALC.estado!=="off";
  CALC.estado="falhou"; clearTimeout(CALC.tIni);
  if(CALC.w) CALC.w.fim(); if(CALC.job) CALC.job.fim(); CALC.w=null; CALC.job=null;
  console.warn("[calc] cálculo em segundo plano indisponível — usando a página:", msg);
  CALC.fila=false; CALC.ocupado=false; calcInd();
  if(tinha && window._last){ const m=compute(S); lastGar={gar:m.gar, n:m.vagasLay-(m.vf?m.vf.count:0)}; calcAplicar(m) }
  calcAcorda();
}
/* pedido do cálculo completo do estado atual (o mais novo vence) */
function calcPedir(){ CALC.req++; CALC.fila=true; calcInd(); if(!CALC.ocupado) calcEnviar() }
/* o estado mudou por arraste: o que está em andamento não vale mais (o completo vem depois do arraste) */
function calcInvalida(){ CALC.req++; CALC.fila=false; calcInd() }
function calcEnviar(){
  if(!CALC.fila || !CALC.w) return;
  CALC.fila=false; CALC.ocupado=true; const id=CALC.envId=CALC.req; calcInd();
  CALC.w.call("compute", [S, {}]).then(m=>{
    CALC.ocupado=false;
    lastGar={gar:m.gar, n:(m.vagasLay||0)-(m.vf?m.vf.count:0)};
    if(id===CALC.req) calcAplicar(m);
    if(CALC.fila) calcEnviar(); else { calcInd(); calcAcorda() }
  }, err=>{
    CALC.ocupado=false;
    if(CALC.estado==="falhou") return;
    console.error("[calc] erro no Worker — recalculando na página:", err && err.message);
    if(id===CALC.req){ const m=compute(S); lastGar={gar:m.gar, n:m.vagasLay-(m.vf?m.vf.count:0)}; calcAplicar(m) }
    if(CALC.fila) calcEnviar(); else { calcInd(); calcAcorda() }
  });
}
function calcAplicar(m){ CALC.aplicado=CALC.req; showModel(m, false) }
function calcOcioso(){ return !calcOn() || (!CALC.fila && !CALC.ocupado && CALC.aplicado===CALC.req) }
function calcAcorda(){ if(!calcOcioso()) return; const l=CALC.esperam; CALC.esperam=[]; l.forEach(r=>r()) }
/* resolve quando o resultado completo do estado atual estiver na tela */
function calcPronto(){
  if(typeof fullT!=="undefined" && fullT){ clearTimeout(fullT); fullT=0; update() }
  if(calcOcioso()) return Promise.resolve();
  return new Promise(r=>CALC.esperam.push(r));
}
/* indicador discreto "calculando…" na régua de KPIs (só aparece se demorar) */
function calcInd(){
  const on = calcOn() && (CALC.fila || (CALC.ocupado && CALC.envId===CALC.req));
  const el=document.getElementById("kpis"); if(!el) return;
  if(on){ if(!CALC.indT && !el.classList.contains("busy")) CALC.indT=setTimeout(()=>{ CALC.indT=0; el.classList.add("busy"); el.setAttribute("aria-busy","true") }, 220) }
  else { clearTimeout(CALC.indT); CALC.indT=0; el.classList.remove("busy"); el.removeAttribute("aria-busy") }
}

/* ===== tarefas longas (otimizador, melhor acesso): Worker próprio, com progresso e cancelamento ===== */
function calcJob(){
  if(CALC.job && !CALC.job.morto) return CALC.job;
  CALC.job = calcNovo("job"); CALC.job.onerro = msg=>{ console.warn("[calc] job:", msg) };
  return CALC.job;
}
function calcCancelar(){
  const a=CALC.jobAtivo; if(!a) return;
  a.cancelado=true; if(a.job) a.job.fim(); CALC.job=null;   // encerra o Worker; o próximo pedido cria outro
}
const calcCancelado = e=> e && /cancelado/.test(e.message||"");
/* botões de cancelar e progresso nos cards do otimizador e do estudo de acesso (refeitos a cada renderTab) */
function calcJobUI(){
  const a=CALC.jobAtivo;
  if(a && a.tipo==="otim"){
    const b=document.querySelector('#tabbody [data-act="otim"]');
    if(b){ b.disabled=false; b.dataset.act="calcCancel"; b.classList.remove("pri"); b.textContent="Cancelar análise"; b.title="Interrompe a busca (o cálculo roda em segundo plano)" }
    const p=document.querySelector("#otProg"); if(p){ p.hidden=false; const i=p.querySelector("i"); if(i) i.style.width=((a.prog||0)*100).toFixed(0)+"%" }
  }
  const go=document.querySelector('#tabbody [data-act="acessoStudy"]'), st=document.getElementById("rsStat");
  if(go) go.disabled = !!(a && a.tipo==="acesso");
  if(st){
    let c=document.getElementById("rsCancel");
    if(a && a.tipo==="acesso"){ if(a.txt) st.textContent=a.txt; if(!c){ st.insertAdjacentHTML("afterend", `<button type="button" class="btn sm ghost" id="rsCancel" data-act="calcCancel">Cancelar</button>`) } }
    else if(c) c.remove();
  }
}
addCard("produto", {key:"calcJobUI", order:999, html:()=>"", after:()=>calcJobUI()});
addCard("projeto", {key:"calcJobUI", order:999, html:()=>"", after:()=>calcJobUI()});
ACT.calcCancel = ()=>{ calcCancelar(); toast("Análise cancelada") };

/* instalado por main.js depois que todos os arquivos carregaram (assim pega as versões finais de ACT.otim / ACT.acessoStudy) */
function calcInstalar(){
/* otimizador no Worker (o algoritmo é o mesmo de src/optim.js; só muda onde roda) */
const _otimPagina = ACT.otim;
if(_otimPagina) ACT.otim = async b=>{
  if(!calcOn()) return _otimPagina(b);
  if(CALC.jobAtivo) return;
  const a = CALC.jobAtivo = {tipo:"otim", prog:0};
  OTRUN=true; renderTab();
  await calcPronto();
  if(a.cancelado){ CALC.jobAtivo=null; OTRUN=false; if(TAB==="produto") renderTab(); return }
  const mN=window._last.m, mLite={vagasLay:mN.vagasLay, vagasEst:mN.vagasEst, vf:{count:mN.vf?mN.vf.count:0}};
  a.job = calcJob();
  try{
    const r = await a.job.call("otimizar", [S, mLite, clone(S.otim)], p=>{ a.prog=p; const e=document.querySelector("#otProg i"); if(e) e.style.width=(p*100).toFixed(0)+"%" });
    OTIM = r; CALC.jobAtivo=null; OTRUN=false; if(TAB==="produto") renderTab();
    toast(OTIM.res.length? "Opções prontas — a melhor está no topo" : "Nenhuma combinação viável");
  }catch(e){
    CALC.jobAtivo=null; OTRUN=false;
    if(a.cancelado || calcCancelado(e)){ if(TAB==="produto") renderTab(); return }
    console.error("[calc] otimizador no Worker falhou — rodando na página:", e && e.message);
    _otimPagina(b);
  }
};

/* estudo do melhor acesso no Worker (mesma sequência de src/steps.js: análise rápida de todas, completa das 4 melhores) */
const _acessoPagina = ACT.acessoStudy;
if(_acessoPagina) ACT.acessoStudy = async b=>{
  if(!calcOn()) return _acessoPagina(b);
  if(CALC.jobAtivo) return;
  const a = CALC.jobAtivo = {tipo:"acesso", txt:"preparando…"};
  calcJobUI();
  await calcPronto();
  const base=clone(S), list=acessoCandidatos(base);
  RS={list:[], cur:{vagas:window._last.m.vagasLay||0}};
  const stat=t=>{ a.txt=t; const s=document.getElementById("rsStat"); if(s) s.textContent=t };
  a.job = calcJob();
  try{
    if(a.cancelado) throw new Error("cancelado");
    for(let i=0;i<list.length;i++){ stat(`analisando ${i+1}/${list.length}…`); const r=await a.job.call("acessoAvalia",[base,list[i],false]); RS.list.push({...list[i], ...r}) }
    RS.list.sort((x,y)=>(y.ok-x.ok)||(y.vagas-x.vagas));
    for(let k=0;k<Math.min(4,RS.list.length);k++){ stat(`confirmando a opção ${k+1} com o cálculo completo…`); const c=RS.list[k]; Object.assign(c, await a.job.call("acessoAvalia",[base,c,true]), {fino:true}) }
    RS.list.sort((x,y)=>(y.fino?1:0)-(x.fino?1:0) || (y.ok-x.ok) || (y.vagas-x.vagas));
    CALC.jobAtivo=null; calcJobUI(); stat(`${list.length} combinações analisadas`);
    const el=document.getElementById("rsList"); if(el) el.innerHTML=rsHTML();
  }catch(e){
    CALC.jobAtivo=null; calcJobUI();
    if(a.cancelado || calcCancelado(e)){ RS=null; const el=document.getElementById("rsList"); if(el) el.innerHTML=""; stat("Análise cancelada."); return }
    console.error("[calc] estudo de acesso no Worker falhou — rodando na página:", e && e.message);
    _acessoPagina(b);
  }
};
}
