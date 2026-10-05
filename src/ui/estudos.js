/* ================= estudos e versões (etapa Cenários) =================
   Vários estudos no repositório (src/ui/repo.js). O estudo aberto continua sendo a cópia de trabalho em
   localStorage "gabarito.v2" (abre na hora e mantém compatibilidade); o id dele fica em "gabarito.estudo" e
   ele é gravado no repositório 1,5 s depois de cada mudança. Na primeira vez, o gabarito.v2 vira o primeiro estudo.
   Versões: automáticas a cada 5 min (se houve mudança) e nomeadas; abrir (como novo estudo), comparar e restaurar
   (restaurar reproduz exatamente o estado salvo — e os números). */
const EST = { id:null, lista:[], versoes:[], cmp:{}, todas:false, t:0, pronto:false, ultimaAuto:Date.now(), autoMin:5, arm:{} };
const estDia = iso=>{ try{ const d=new Date(iso); return d.toLocaleDateString("pt-BR")+" "+d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}) }catch(e){ return "" } };
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
  if(TAB==="cen"){ const a=document.getElementById("estBox"), b=document.getElementById("vsBox"); if(a) a.innerHTML=estListHTML(); if(b) b.innerHTML=vsListHTML() }
}
/* troca o estudo aberto */
async function estAbrir(id, msg){
  histCommit(); await estGrava();
  const rec=await Repo.estudos.get(id); if(!rec){ toast("Estudo não encontrado"); return }
  S=merge(clone(DEF), clone(rec.S)); LS.set("gabarito.v2", S);
  EST.id=id; LS.set("gabarito.estudo", id); EST.cmp={}; EST.ultimaAuto=Date.now(); HIST.mudou=false;
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
/* ---- interface (cards da etapa Cenários) ---- */
const estRM = k=> k? `<div class="rm"><span>Unid.<b>${nf(k.units)}</b></span><span>VGV<b>${mi(k.vgv)}</b></span><span>Lucro<b>${mi(k.lucro)}</b></span><span>Margem<b>${pct(k.margem)}</b></span></div>` : "";
function estListHTML(){
  if(!EST.pronto) return `<p class="note">Abrindo o arquivo de estudos…</p>`;
  return `<div class="list">${EST.lista.map(e=>{ const at=e.id===EST.id;
    return `<div class="res${at?" top1":""}"><div class="rh"><b>${esc(at? S.nome : e.nome)}</b>${at?'<span class="pill ok">aberto</span>':`<span class="pill">${esc(estDia(e.atualizado))}</span>`}</div>${estRM(e.k)}
      <div class="row sb"><span class="row" style="gap:4px">${at?"":`<button class="btn sm" data-act="estAbrir" data-id="${e.id}">Abrir</button>`}<button class="btn sm${at?"":" ghost"}" data-act="estDup" data-id="${e.id}">Duplicar</button></span>${at?"":`<button class="btn sm ghost" data-act="estDel" data-id="${e.id}">${EST.arm[e.id]?"Confirmar exclusão":"Excluir"}</button>`}</div></div>` }).join("")}</div>`;
}
function vsListHTML(){
  if(!EST.pronto) return "";
  const l=EST.versoes, vis=EST.todas? l : l.slice(0,6), sel=l.filter(v=>EST.cmp[v.id]);
  const lista = l.length? `<div class="list">${vis.map(v=>`<div class="res"><div class="rh"><b>${esc(v.nome)}</b><span class="pill${v.auto?"":" ok"}">${v.auto?"automática":"nomeada"}</span></div>
      <div class="note">${esc(estDia(v.criado))} · ${esc(v.autor||"Local")}</div>${estRM(v.k)}
      <div class="row sb"><span class="row" style="gap:4px"><button class="btn sm" data-act="vsRest" data-id="${v.id}" title="Volta o estudo para esta versão (dá para desfazer)">Restaurar</button><button class="btn sm ghost" data-act="vsAbrir" data-id="${v.id}" title="Abre esta versão como um novo estudo; o atual fica intacto">Abrir</button></span>
      <label class="sw" style="font-size:12px"><input type="checkbox" data-vcmp="${v.id}" ${EST.cmp[v.id]?"checked":""}><span class="tg"></span>comparar</label></div></div>`).join("")}</div>
      ${l.length>6? `<button class="btn sm ghost" data-act="vsTodas">${EST.todas?"Mostrar menos":`Ver todas (${l.length})`}</button>`:""}`
    : `<p class="note">Nenhuma versão ainda. Elas são salvas sozinhas a cada ${EST.autoMin} minutos quando o estudo muda, ou quando você pedir.</p>`;
  const L=window._last, cmp = sel.length && L? CARD("Comparar versões", compareHTML([{nome:"Atual", k:histNums(L.m,L.f)}, ...sel])) : "";
  return lista + cmp;
}
/* cards do topo da etapa Cenários (chamado por STEP_R.cen) */
const estCardsHTML = ()=>
  CARD("Estudos", `<div class="row"><button class="btn pri" data-act="estNovo">Novo estudo</button><button class="btn" data-act="estDup" data-id="${EST.id||""}">Duplicar o atual</button></div><div id="estBox">${estListHTML()}</div>
    <p class="note">Ficam neste navegador (${Repo.modo()==="idb"?"IndexedDB":Repo.modo()==="local"?"armazenamento local":"só nesta sessão"}). Desfazer: Ctrl+Z · refazer: Ctrl+Shift+Z.</p>`, {aside:String(EST.lista.length||"")}) +
  CARD("Versões deste estudo", `<div class="row" style="flex-wrap:nowrap"><input class="txt" id="vsNome" placeholder="Nome da versão (ex.: aprovada na reunião)"><button class="btn pri" data-act="vsSalvar">Salvar versão</button></div><div id="vsBox">${vsListHTML()}</div>`, {aside:String(EST.versoes.length||"")});
/* comparar (checkbox) */
document.getElementById("tabbody").addEventListener("change", e=>{ const id=e.target.dataset && e.target.dataset.vcmp; if(!id) return; if(e.target.checked) EST.cmp[id]=1; else delete EST.cmp[id]; const b=document.getElementById("vsBox"); if(b) b.innerHTML=vsListHTML() });
Object.assign(ACT, {
  estNovo: ()=>estNovo(clone(DEF), "Novo estudo"),
  estDup: async b=>{ const id=b.dataset.id; await estGrava(); const rec=id? await Repo.estudos.get(id) : null; const st=rec? rec.S : S; await estNovo(st, (rec? rec.nome : S.nome)+" (cópia)", false) },
  estAbrir: b=>estAbrir(b.dataset.id),
  estDel: async b=>{ const id=b.dataset.id; if(id===EST.id) return; if(!EST.arm[id]){ EST.arm[id]=1; b.textContent="Confirmar exclusão"; b.classList.add("on"); return } delete EST.arm[id]; await Repo.estudos.remove(id); await estRefresh(); toast("Estudo excluído") },
  vsSalvar: async ()=>{ const i=document.getElementById("vsNome"), nome=i? i.value.trim() : ""; const v=await versaoSalvar(nome, false); if(i) i.value=""; if(v) toast("Versão salva: "+v.nome) },
  vsRest: b=>versaoRestaurar(b.dataset.id),
  vsAbrir: async b=>{ const v=await Repo.versoes.get(b.dataset.id); if(!v) return; await estNovo(versaoEstado(v.S), `${v.S.nome||S.nome} — ${v.nome} (${estDia(v.criado)})`) },
  vsTodas: ()=>{ EST.todas=!EST.todas; const b=document.getElementById("vsBox"); if(b) b.innerHTML=vsListHTML() },
});
