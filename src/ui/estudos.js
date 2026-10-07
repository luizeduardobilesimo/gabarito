/* ================= estudos, versões e cenários (etapa Cenários, sub-aba "Estudos") =================
   Vários estudos no repositório (src/ui/repo.js). O estudo aberto continua sendo a cópia de trabalho em
   localStorage "gabarito.v2" (abre na hora e mantém compatibilidade); o id dele fica em "gabarito.estudo" e
   ele é gravado no repositório 1,5 s depois de cada mudança. Na primeira vez, o gabarito.v2 vira o primeiro estudo.
   Versões: automáticas a cada 5 min (se houve mudança) e nomeadas; abrir (como novo estudo), comparar e restaurar
   (restaurar reproduz exatamente o estado salvo — e os números).
   Cenários: fotos rápidas da simulação (localStorage "gabarito.cenarios2"), valem para qualquer estudo.
   Comparação única: o estudo atual contra tudo o que estiver marcado (estudos, versões e cenários). */
const EST = { id:null, lista:[], versoes:[], cmp:{}, cmpE:{}, todas:false, t:0, pronto:false, ultimaAuto:Date.now(), autoMin:5, arm:{}, armC:null, x:null, xt:0 };
const estDia = iso=>{ try{ const d=new Date(iso); return d.toLocaleDateString("pt-BR")+" "+d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}) }catch(e){ return "" } };
const estDiaC = iso=>{ try{ const d=new Date(iso); return d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})+" "+d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}) }catch(e){ return "" } };
/* números do resultado completo atual (espera o Worker) */
async function estNums(){ await calcPronto(); const L=window._last; return L? histNums(L.m, L.f) : null }
async function estInit(){
  try{
    await Repo.pronto();
    let lista=await Repo.estudos.list(), id=LS.get("gabarito.estudo");
    if(!id || !lista.some(e=>e.id===id)){
      // migração: o estudo atual (gabarito.v2) vira um estudo do repositório — o gabarito.v2 continua lá
      const rec=await Repo.estudos.put({nome:S.nome||"Estudo", S:clone(S)}); id=rec.id;
    }
    EST.id=id; LS.set("gabarito.estudo", id); EST.pronto=true;
    await estRefresh();
    setInterval(estAuto, 30000);
    estNums().then(k=>{ if(k) estGrava(k) });
  }catch(e){ console.error("[estudos] repositório indisponível:", e) }
}
/* grava o estudo aberto no repositório (com atraso; chamado a cada mudança via histTouch) */
function estTouch(){ if(!EST.pronto) return; clearTimeout(EST.t); EST.t=setTimeout(()=>estGrava(), 1500) }
async function estGrava(k){
  clearTimeout(EST.t); EST.t=0; if(!EST.pronto || !EST.id) return;
  const L=window._last; if(!k && L && calcOcioso()) k=histNums(L.m, L.f);
  const ant=EST.lista.find(e=>e.id===EST.id)||{};
  const rec=await Repo.estudos.put({id:EST.id, criado:ant.criado, nome:S.nome||"Estudo", S:clone(S), k:k||ant.k||null});
  const i=EST.lista.findIndex(e=>e.id===rec.id), r={...rec}; delete r.S; if(i>=0) EST.lista[i]=r; else EST.lista.unshift(r);
}
async function estRefresh(){
  if(!EST.pronto) return;
  EST.lista=await Repo.estudos.list(); EST.versoes=await Repo.versoes.list(EST.id);
  cenRefresh();
}
/* troca o estudo aberto */
async function estAbrir(id, msg){
  histCommit(); await estGrava();
  const rec=await Repo.estudos.get(id); if(!rec){ toast("Estudo não encontrado"); return }
  S=merge(clone(DEF), clone(rec.S)); LS.set("gabarito.v2", S);
  EST.id=id; LS.set("gabarito.estudo", id); EST.cmp={}; EST.cmpE={}; EST.ultimaAuto=Date.now(); HIST.mudou=false;
  lastGar=null; OTIM=null; RS=null;
  document.getElementById("projName").value=S.nome;
  renderTab(); fit3d(); fit2d(); histReset();
  await estRefresh(); toast(msg||("Estudo aberto: "+S.nome));
}
async function estNovo(st, nome, abrir=true){
  const rec=await Repo.estudos.put({nome, S:{...clone(st), nome}});
  if(abrir) await estAbrir(rec.id, "Estudo criado: "+nome); else { await estRefresh(); toast("Cópia criada: "+nome) }
  return rec;
}
/* ---- versões ---- */
async function versaoSalvar(nome, auto){
  if(!EST.pronto) return null;
  histCommit(); const k=await estNums();
  const n=EST.versoes.filter(v=>!v.auto).length;
  const v=await Repo.versoes.put({estudoId:EST.id, nome: nome || (auto? "Automática" : "Versão "+(n+1)), auto:!!auto, S:clone(S), k});
  HIST.mudou=false; EST.ultimaAuto=Date.now();
  if(auto){ const autos=(await Repo.versoes.list(EST.id)).filter(x=>x.auto); for(const x of autos.slice(30)) await Repo.versoes.remove(x.id) }
  await estRefresh(); return v;
}
/* automática: a cada 5 minutos, se o estudo mudou */
function estAuto(){ if(EST.pronto && HIST.mudou && Date.now()-EST.ultimaAuto >= EST.autoMin*60000) versaoSalvar(null, true) }
/* estado exato da versão: padrões atuais (migração) + tudo o que a versão guardou por cima */
const versaoEstado = vS=> histOverlay(merge(clone(DEF), clone(vS)), clone(vS));
async function versaoRestaurar(id){
  const v=await Repo.versoes.get(id); if(!v) return;
  histCommit(); if(HIST.mudou) await versaoSalvar("Antes de restaurar", true);
  S=versaoEstado(v.S); document.getElementById("projName").value=S.nome;
  renderTab(); fit3d(); fit2d(); histCommit();
  toast("Versão restaurada: "+v.nome+" (Ctrl+Z desfaz)");
  const k=await estNums();
  if(k && v.k && !estMesmos(k, v.k)) console.warn("[versões] números diferentes dos salvos", v.k, k);
  return k;
}
const estMesmos = (a,b)=>["units","vagas","vgv","lucro","margem"].every(c=> a[c]==null&&b[c]==null || Math.abs((a[c]||0)-(b[c]||0)) <= 1e-6*Math.max(1,Math.abs(b[c]||0)));

/* ---- cenários (fotos rápidas da simulação) ---- */
const cenLista = ()=> LS.get("gabarito.cenarios2")||[];

/* ---- interface ---- */
const EIC = {
  dup:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/></svg>',
  del:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 10.5v6M14 10.5v6"/></svg>',
  novo:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 4.5h6v6M19.5 4.5l-8 8M10 5.5H5.5v13h13V14"/></svg>',
};
const estIco = (act, ic, rot, attrs)=>`<button type="button" class="btn sm ghost icon" data-act="${act}" ${attrs} aria-label="${esc(rot)}" title="${esc(rot)}">${EIC[ic]}</button>`;
const estArm = (act, attrs)=>`<button type="button" class="btn sm on" data-act="${act}" ${attrs}>Confirmar</button>`;
const estCk = (act, on, attrs, nome)=>`<button type="button" class="ck" data-act="${act}" ${attrs} aria-pressed="${!!on}" aria-label="Comparar ${esc(nome)}" title="Comparar com o estudo atual"></button>`;
const estMeta = k=> k && k.units!=null? `${nf(k.units)} un · ${mi(k.vgv)} · ${pct(k.margem)}` : "sem números ainda";
const estMetaAt = ()=>{ const L=window._last; return L? estMeta(histNums(L.m,L.f)) : estMeta((EST.lista.find(e=>e.id===EST.id)||{}).k) };
const estPl = (n, um, varios)=> `${n} ${n===1? um : varios}`;
function estRow(o){
  return `<div class="lrow${o.on?" on":""}">${o.ck||'<span class="ck0"></span>'}<div class="lx"><div class="lt"><b title="${esc(o.nome)}">${esc(o.nome)}</b>${o.pill||""}</div><div class="lm">${o.meta}</div></div><div class="la">${o.acts}</div></div>`;
}
function estListHTML(){
  if(!EST.pronto) return `<p class="note">Abrindo os estudos…</p>`;
  return `<div class="list">${EST.lista.map(e=>{ const at=e.id===EST.id, a=`data-id="${e.id}"`;
    return estRow({ on:at, ck: at? "" : estCk("estCmp", EST.cmpE[e.id], a, e.nome), nome: at? (S.nome||e.nome) : e.nome,
      pill: at? '<span class="pill ok">aberto</span>' : "", meta: at? estMetaAt() : estMeta(e.k),
      acts: (at? "" : `<button type="button" class="btn sm" data-act="estAbrir" ${a}>Abrir</button>`) + estIco("estDup","dup","Duplicar",a)
        + (at? "" : EST.arm[e.id]? estArm("estDel",a) : estIco("estDel","del","Excluir",a)) }) }).join("")}</div>
    <button type="button" class="btn sm ghost addbtn" data-act="estNovo">+ Novo estudo</button>`;
}
function vsListHTML(){
  if(!EST.pronto) return "";
  const l=EST.versoes, vis=EST.todas? l : l.slice(0,5);
  if(!l.length) return `<p class="note">Nenhuma versão ainda.</p>`;
  return `<div class="list">${vis.map(v=>{ const a=`data-id="${v.id}"`;
    return estRow({ ck:estCk("vsCmp", EST.cmp[v.id], a, v.nome), nome:v.nome, pill: v.auto? '<span class="pill">auto</span>' : "",
      meta:`${esc(estDiaC(v.criado))}${v.k&&v.k.margem!=null? " · margem "+pct(v.k.margem) : ""}`,
      acts:`<button type="button" class="btn sm" data-act="vsRest" ${a} title="Volta o estudo para esta versão (Ctrl+Z desfaz)">Restaurar</button>` + estIco("vsAbrir","novo","Abrir como novo estudo",a) }) }).join("")}</div>
    ${l.length>5? `<button type="button" class="btn sm ghost addbtn" data-act="vsTodas">${EST.todas?"Mostrar menos":`Ver todas (${l.length})`}</button>`:""}`;
}
function cenListHTML(){
  const l=cenLista(); if(!l.length) return `<p class="note">Nenhum cenário salvo.</p>`;
  return `<div class="list">${l.map((c,i)=>{ const a=`data-i="${i}"`;
    return estRow({ ck:estCk("cenCmp", c.cmp, a, c.nome), nome:c.nome, pill: c.aprovado? '<span class="pill ok">aprovado</span>' : "",
      meta:`${esc(c.data||"")} · ${estMeta(c.k)}`,
      acts:`<button type="button" class="btn sm" data-act="cenLoad" ${a}>Abrir</button>` + (EST.armC===i? estArm("cenDel",a) : estIco("cenDel","del","Excluir",a)) }) }).join("")}</div>`;
}
/* comparação: o estudo atual contra tudo o que estiver marcado */
function cmpSel(){
  const out=[];
  EST.lista.forEach(e=>{ if(EST.cmpE[e.id] && e.id!==EST.id) out.push({nome:e.nome, k:e.k||{}}) });
  EST.versoes.forEach(v=>{ if(EST.cmp[v.id]) out.push({nome:v.nome, k:v.k||{}}) });
  cenLista().forEach(c=>{ if(c.cmp) out.push({nome:c.nome, k:c.k||{}}) });
  return out;
}
function cmpHTML(){
  const sel=cmpSel(), L=window._last; if(!sel.length || !L) return "";
  return compareHTML([{nome:"Atual", k:histNums(L.m,L.f)}, ...sel]) + `<button type="button" class="btn sm ghost addbtn" data-act="cmpLimpa">Limpar seleção</button>`;
}
function estUndoHTML(){ return EST.x? `<div class="undobar" role="status"><span>“${esc(EST.x.nome)}” excluído</span><button type="button" class="btn sm" data-act="estDesfaz">Desfazer</button></div>` : "" }
const estStatus = ()=> `${estPl(EST.versoes.length,"versão","versões")} · ${estPl(cenLista().length,"cenário","cenários")}`;
const estSums = ()=>({ estudos: estPl(EST.lista.length,"estudo","estudos"), versoes: EST.versoes.length? estPl(EST.versoes.length,"versão","versões") : "nenhuma", cenarios: cenLista().length? estPl(cenLista().length,"salvo","salvos") : "nenhum", cmp: estPl(cmpSel().length+1,"item","itens") });
/* atualiza as listas sem recriar o painel */
function cenRefresh(){
  if(TAB!=="cen") return;
  const set=(id,h)=>{ const e=document.getElementById(id); if(e && e.innerHTML!==h) e.innerHTML=h };
  set("estBox", estListHTML()); set("vsBox", vsListHTML()); set("cenBox", cenListHTML()); set("estUndo", estUndoHTML());
  const c=cmpHTML(), cs=document.getElementById("cmpSec"); if(cs){ const era=cs.hidden; cs.hidden=!c; set("cmpBox", c); if(c && era) cs.open=true }
  const st=document.getElementById("estCurSt"); if(st) st.textContent=estStatus();
  Object.entries(estSums()).forEach(([k,v])=>setSum(k,v));
  const fs=document.getElementById("footStat"); if(fs) fs.textContent=estPl(cenLista().length,"cenário","cenários");
}
/* corpo da sub-aba "Estudos" (chamado por STEP_R.cen) */
function estCardsHTML(){
  const c=cmpHTML(), sm=estSums(), modo=Repo.modo();
  const campo=(id,ph,rot,act,btn)=>`<div class="row" style="flex-wrap:nowrap"><div class="inp" style="flex:1"><input class="t" id="${id}" placeholder="${ph}" aria-label="${rot}" autocomplete="off"></div><button type="button" class="btn pri" data-act="${act}">${btn}</button></div>`;
  return `<div id="estUndo">${estUndoHTML()}</div>` +
    RES("Estudo aberto", `<div class="estcur"><b id="estCurNome">${esc(S.nome||"Estudo")}</b><span class="note" id="estCurSt">${estStatus()}</span></div>`,
      {aside: modo==="idb"||modo==="local"? "salvo neste navegador" : "só nesta sessão"}) +
    SEC("Comparação", `<div id="cmpBox">${c}</div>`, {key:"cmp", open:true, id:"cmpSec", hidden:!c, sum:sm.cmp,
      info:"O estudo atual lado a lado com o que você marcou nas listas abaixo (quadradinho à esquerda de cada linha). Em verde, o melhor valor de cada linha."}) +
    SEC("Estudos", `<div id="estBox">${estListHTML()}</div>`, {key:"estudos", open:true, sum:sm.estudos,
      info:"Cada estudo é um terreno ou uma proposta diferente. Ficam guardados neste navegador; o aberto é salvo sozinho a cada mudança. Use o .json (aba Entregar) para levar a outro aparelho."}) +
    SEC("Versões", campo("vsNome","Ex.: aprovada na reunião","Nome da versão","vsSalvar","Salvar versão") + `<div id="vsBox">${vsListHTML()}</div>`, {key:"versoes", open:true, sum:sm.versoes,
      info:`Fotos do estudo aberto ao longo do tempo. Salvas sozinhas a cada ${EST.autoMin} minutos quando ele muda, ou quando você pedir. Restaurar volta o estudo exatamente àquele ponto (Ctrl+Z desfaz); o ícone ao lado abre a versão como um estudo novo.`}) +
    SEC("Cenários", campo("cenNome","Ex.: 2 torres · 12 e 9 pav","Nome do cenário","cenSave","Salvar") + `<div id="cenBox">${cenListHTML()}</div>`, {key:"cenarios", sum:sm.cenarios,
      info:"Variações rápidas para comparar (por exemplo, número de torres ou de subsolos). Abrir um cenário troca o estudo atual por ele (Ctrl+Z desfaz). Valem para todos os estudos."});
}
function estXGuarda(x){ EST.x=x; clearTimeout(EST.xt); EST.xt=setTimeout(()=>{ EST.x=null; cenRefresh() }, 30000) }
Object.assign(ACT, {
  estNovo: ()=>estNovo(clone(DEF), "Novo estudo"),
  estDup: async b=>{ const id=b.dataset.id; await estGrava(); const rec=id? await Repo.estudos.get(id) : null; const st=rec? rec.S : S; await estNovo(st, (rec? rec.nome : S.nome)+" (cópia)", false) },
  estAbrir: b=>estAbrir(b.dataset.id),
  estDel: async b=>{ const id=b.dataset.id; if(id===EST.id) return; if(!EST.arm[id]){ EST.arm={[id]:1}; cenRefresh(); return } delete EST.arm[id];
    const rec=await Repo.estudos.get(id), vs=[]; for(const v of await Repo.versoes.list(id)){ const full=await Repo.versoes.get(v.id); if(full) vs.push(full) }
    await Repo.estudos.remove(id); delete EST.cmpE[id]; if(rec) estXGuarda({tipo:"est", nome:rec.nome, rec, vs}); await estRefresh(); toast("Estudo excluído") },
  estCmp: b=>{ const id=b.dataset.id; if(EST.cmpE[id]) delete EST.cmpE[id]; else EST.cmpE[id]=1; cenRefresh() },
  vsSalvar: async ()=>{ const i=document.getElementById("vsNome"), nome=i? i.value.trim() : ""; const v=await versaoSalvar(nome, false); if(i) i.value=""; if(v) toast("Versão salva: "+v.nome) },
  vsRest: b=>versaoRestaurar(b.dataset.id),
  vsAbrir: async b=>{ const v=await Repo.versoes.get(b.dataset.id); if(!v) return; await estNovo(versaoEstado(v.S), `${v.S.nome||S.nome} — ${v.nome} (${estDia(v.criado)})`) },
  vsTodas: ()=>{ EST.todas=!EST.todas; cenRefresh() },
  vsCmp: b=>{ const id=b.dataset.id; if(EST.cmp[id]) delete EST.cmp[id]; else EST.cmp[id]=1; cenRefresh() },
  cenSave: async ()=>{ const i=document.getElementById("cenNome"), nome=i? i.value.trim() : ""; await calcPronto(); saveScenario(nome); if(i) i.value=""; cenRefresh(); toast("Cenário salvo") },
  cenLoad: b=>{ const c=cenLista()[+b.dataset.i]; if(c){ S=merge(clone(DEF),c.S); document.getElementById("projName").value=S.nome; renderTab(); fit3d(); fit2d(); toast("Cenário aberto: "+c.nome+" (Ctrl+Z desfaz)") } },
  cenDel: b=>{ const i=+b.dataset.i; if(EST.armC!==i){ EST.armC=i; cenRefresh(); return } EST.armC=null;
    const l=cenLista(), c=l.splice(i,1)[0]; LS.set("gabarito.cenarios2",l); if(c) estXGuarda({tipo:"cen", nome:c.nome, c, i}); cenRefresh(); toast("Cenário excluído") },
  cenCmp: b=>{ const l=cenLista(), c=l[+b.dataset.i]; if(!c) return; c.cmp=!c.cmp; LS.set("gabarito.cenarios2",l); cenRefresh() },
  cmpLimpa: ()=>{ EST.cmp={}; EST.cmpE={}; const l=cenLista(); l.forEach(c=>delete c.cmp); LS.set("gabarito.cenarios2",l); cenRefresh() },
  estDesfaz: async ()=>{ const x=EST.x; if(!x) return; EST.x=null; clearTimeout(EST.xt);
    if(x.tipo==="cen"){ const l=cenLista(); l.splice(Math.min(x.i,l.length),0,x.c); LS.set("gabarito.cenarios2",l); cenRefresh() }
    else { await Repo.estudos.put(x.rec); for(const v of x.vs) await Repo.versoes.put(v); await estRefresh() }
    toast("Exclusão desfeita: "+x.nome) },
});
/* Enter nos campos de nome salva */
document.getElementById("tabbody").addEventListener("keydown", e=>{ if(e.key!=="Enter") return; const id=e.target && e.target.id; if(id==="vsNome") ACT.vsSalvar(); else if(id==="cenNome") ACT.cenSave() });
