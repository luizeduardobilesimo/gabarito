/* ================= interface: etapas, campos e ligação ================= */
/* Campos declarativos: cada controle aponta para um caminho em S (data-p) e um efeito (data-fx).
   Um único listener delegado no inspetor cuida de todos — nada de bind por id. */
/* marca Rixel: ícone (mesmo desenho do public/assets/rixel-icon.png da Rixel; cores pelos tokens --logo-tile/--logo-glyph) e palavra "gabarito." */
const RX_ICONE = '<svg class="rx-ic" viewBox="0 0 32 32" aria-hidden="true"><rect class="t" y="1" width="32" height="30" rx="6"/><path class="g" d="M11.2 8.8L18.6 16.2L11.2 23.6L8.3 20.7L12.8 16.2L8.3 11.7ZM21.2 9.35L23.75 11.9L21.2 14.45L18.65 11.9ZM21.2 17.95L23.75 20.5L21.2 23.05L18.65 20.5Z"/></svg>';
const RX_MARCA = RX_ICONE+'<span class="wm">gabarito<i>.</i></span>';
const getP=(o,p)=>p.split(".").reduce((a,k)=>a==null?a:a[k],o);
function setP(o,p,v){ const ks=p.split("."); const last=ks.pop(); const t=ks.reduce((a,k)=>a[k],o); t[last]=v }
const fmtIn=(v,pc,dec)=>{ if(v==null||v==="") return ""; const x=pc? v*100 : v; return +(+x).toFixed(dec??(pc?2:3)) };
const hlp=t=> t? INFO(t) : "";   // ajuda: botão ⓘ com explicação (termo do glossário ou texto) — src/ui/ux.js
/* número compacto */
function NUM(p,label,unit="",o={}){
  const v=getP(S,p), id="f-"+p.replace(/\./g,"-");
  return `<div class="fld${o.wide?" wide":""}" data-q="${esc((label+" "+(o.q||"")).toLowerCase())}"><label class="fl" for="${id}">${label}${hlp(o.help)}</label>
    <div class="inp"><input id="${id}" type="number" inputmode="decimal" data-p="${p}" ${o.pct?'data-pct="1"':""} ${o.int?'data-int="1"':""} ${o.zero?'data-zero="1"':""} ${o.min!=null?`data-min="${o.min}"`:""} ${o.max!=null?`data-max="${o.max}"`:""} data-fx="${o.fx||"upd"}" step="${o.step??"any"}" value="${o.zero&&!v? "" : fmtIn(v,o.pct)}" ${o.ph!=null?`placeholder="${esc(o.ph)}"`:""}>${unit?`<em>${unit}</em>`:""}</div>
    <div class="fsub" id="sub-${p.replace(/\./g,"-")}">${o.sub||""}</div></div>`;
}
/* texto */
function TXT(p,label,o={}){ const id="f-"+p.replace(/\./g,"-"); return `<div class="fld${o.wide===false?"":" wide"}"><label class="fl" for="${id}">${label}</label><div class="inp"><input class="t" id="${id}" data-p="${p}" data-t="s" data-fx="${o.fx||"save"}" value="${esc(getP(S,p))}" ${o.ph?`placeholder="${esc(o.ph)}"`:""}></div></div>` }
/* slider com valor */
const FMT={ mes:v=>["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"][Math.round(v)-1]||"", hora:v=>{ const h=Math.floor(v), m=Math.round((v-h)*60); return `${h}h${String(m).padStart(2,"0")}` } };
function SLD(p,label,min,max,step,unit="",o={}){
  const v=getP(S,p), sc=o.pct?100:(o.sc||1), id="r-"+p.replace(/\./g,"-");
  return `<div class="sl${o.wide===false?"":" fld wide"}" data-q="${esc(label.toLowerCase())}"><div class="slh"><label for="${id}">${label}${hlp(o.help)}</label><output id="o-${id}">${o.fmt? FMT[o.fmt](v) : nf(v*sc, o.dec??(step*sc<1?1:0))}${unit?" "+unit:""}</output></div>
    <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-p="${p}" data-fx="${o.fx||"upd"}" data-sc="${sc}" data-unit="${unit}" data-dec="${o.dec??(step*sc<1?1:0)}" ${o.int?'data-int="1"':""} ${o.fmt?`data-fmt="${o.fmt}"`:""} aria-label="${esc(label)}">
    ${o.sub!=null?`<div class="fsub" id="sub-${p.replace(/\./g,"-")}">${o.sub}</div>`:""}</div>`;
}
/* interruptor */
function SW(p,label,o={}){ const v=!!getP(S,p); return `<label class="sw"${o.style?` style="${o.style}"`:""}><input type="checkbox" data-p="${p}" data-b="1" data-fx="${o.fx||"upd"}" ${o.rr?'data-rr="1"':""} ${v?"checked":""} ${o.dis?"disabled":""}><span class="tg"></span><span>${label}</span></label>` }
/* segmentado */
function SEG(p,opts,o={}){ const cur=getP(S,p); return `<div class="seg${o.full?" full":""}" role="group"${o.label?` aria-label="${esc(o.label)}"`:""}>${opts.map(([v,l,t])=>`<button type="button" data-set="${p}" data-v='${JSON.stringify(v)}' data-fx="${o.fx||"upd"}" ${o.rr===false?"":'data-rr="1"'} aria-pressed="${String(cur)===String(v)}" ${t?`title="${esc(t)}"`:""}>${l}</button>`).join("")}</div>` }
/* stepper inteiro */
function STP(p,min,max,label,o={}){ const v=getP(S,p); return `<div class="fld"${o.wide?' style="grid-column:1/-1"':""}>${label?`<span class="fl">${label}</span>`:""}<div class="stp"><button type="button" data-stp="-1" aria-label="Menos">−</button><input type="number" data-p="${p}" data-int="1" data-min="${min}" data-max="${max}" data-fx="${o.fx||"upd"}" ${o.rr?'data-rr="1"':""} value="${v}" aria-label="${esc(label||p)}"><button type="button" data-stp="1" aria-label="Mais">+</button></div>${o.sub!=null?`<div class="fsub" id="sub-${p.replace(/\./g,"-")}">${o.sub}</div>`:""}</div>` }
const ROW=(label,ctrl)=>`<div class="row sb" style="flex-wrap:nowrap"><span class="fl" style="flex:none">${label}</span>${ctrl}</div>`;
const CARD=(title,body,o={})=> o.details!=null
  ? `<details class="card${o.cls?" "+o.cls:""}" ${o.details?"open":""} ${o.id?`id="${o.id}"`:""} ${o.filter?"data-filter":""} data-key="${esc(o.key||title)}"><summary><span>${title}</span>${o.aside?`<span class="aside" style="font-family:var(--f-body);font-weight:400;font-size:11.5px;color:var(--muted);margin-left:auto;margin-right:10px">${o.aside}</span>`:""}</summary><div class="cb">${body}</div></details>`
  : `<section class="card${o.cls?" "+o.cls:""}" ${o.id?`id="${o.id}"`:""} ${o.filter?"data-filter":""}><div class="ch"><h2>${title}</h2>${o.aside!=null?`<span class="aside" ${o.asideId?`id="${o.asideId}"`:""}>${o.aside}</span>`:""}</div><div class="cb">${body}</div></section>`;
const GRP=t=>`<div class="grp">${t}</div>`;
const KV=(html,n=2)=>`<div class="kv${n===3?" three":""}">${html}</div>`;
const setSub=(p,txt)=>{ const e=document.getElementById("sub-"+p.replace(/\./g,"-")); if(e && e.innerHTML!==txt) e.innerHTML=txt };
const typing=e=>{ const a=document.activeElement; return a && e.contains(a) && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && a.type!=="range" && a.type!=="checkbox" };
const setHTML=(id,h)=>{ const e=document.getElementById(id); if(e && !typing(e) && e.innerHTML!==h) e.innerHTML=h; return e };

/* efeitos depois de mudar um valor */
const cfdOn=()=> VIEW==="v3d" && typeof CFD!=="undefined" && CFD.dom;
const FX = {
  upd:   live=> update(live?{fast:true}:{}),
  save:  ()=> save(),
  none:  ()=>{},
  sun:   ()=>{ save(); sunUI(); applySun(); if(!VIEW.startsWith("v3")) climaRun(); climaInfo() },
  clima: live=>{ save(); if(!live){ climaRun(); climaInfo() } viewbarSegs(window._last.m) },
  cfdStart: live=>{ save(); if(!live && cfdOn()) cfdStart(true) },
  cfdLight: ()=>{ save(); if(cfdOn()){ cfdSlice(); cfdArrows(); cfdLegend(); render3() } },
  cfdLines: live=>{ save(); if(!live && cfdOn()){ cfdLines(); render3() } },
  cfdParts: live=>{ save(); if(!live && cfdOn()) cfdParticlesInit() },
  cfdRef:   live=>{ save(); if(!live && cfdOn()){ cfdRefresh(true); cfdBarUI() } },
  cfdBld:   ()=>{ save(); if(cfdOn()){ cfdColorBuildings(); render3() } },
  cfdLook:  live=>{ save(); if(!live && cfdOn()){ cfdBuildings(); cfdBuildStatic(); cfdRefresh(true); cfdBarUI() } },
  r3:       ()=>{ save(); if(window._last) rebuild3d(window._last.m) },
};
function readVal(el){
  if(el.dataset.b) return el.checked;
  if(el.dataset.t==="s") return el.value;
  if(el.value==="") return el.dataset.zero? 0 : el.dataset.null? null : undefined;
  let v=+el.value; if(!isFinite(v)) return undefined;
  if(el.dataset.sc && el.type!=="range") v/=+el.dataset.sc;
  if(el.dataset.pct) v/=100;
  if(el.dataset.int) v=Math.round(v);
  if(el.dataset.min!=null) v=Math.max(+el.dataset.min,v);
  if(el.dataset.max!=null) v=Math.min(+el.dataset.max,v);
  return v;
}
function outFor(r){ const o=document.getElementById("o-"+r.id); if(o && r.dataset.fmt){ o.textContent=FMT[r.dataset.fmt](+r.value); return } if(o){ const sc=+r.dataset.sc||1; o.textContent=nf(+r.value*sc, +r.dataset.dec||0)+(r.dataset.unit?" "+r.dataset.unit:"") } }
function applyEl(el, live){
  const p=el.dataset.p; if(!p) return; const v=readVal(el); if(v===undefined) return;
  setP(S,p,v);
  if(!live && el.type==="number" && !el.dataset.b){ const nv=getP(S,p); el.value= el.dataset.zero&&!nv? "" : fmtIn(nv, !!el.dataset.pct) }
  if(el.type==="range") outFor(el);
  (FX[el.dataset.fx||"upd"]||FX.upd)(live);
  if(!live && el.dataset.rr) renderTab();
}
const TB=document.getElementById("tabbody");
function onInput(e){ const el=e.target; if(!el.dataset||!el.dataset.p) return; if(el.type==="range") applyEl(el,true) }
function onChange(e){ const el=e.target; if(!el.dataset||!el.dataset.p) return; applyEl(el,false) }
function onClick(e){
  const s=e.target.closest("[data-set]");
  if(s){ let v; try{ v=JSON.parse(s.dataset.v) }catch(_){ v=s.dataset.v } setP(S,s.dataset.set,v); (FX[s.dataset.fx||"upd"]||FX.upd)(false); if(s.dataset.rr) renderTab(); else s.parentElement.querySelectorAll("[data-set]").forEach(b=>b.setAttribute("aria-pressed",b===s)); return }
  const st=e.target.closest("[data-stp]");
  if(st){ const inp=st.parentElement.querySelector("input"); const v=(+inp.value||0)+(+st.dataset.stp); inp.value=v; applyEl(inp,false); return }
  const a=e.target.closest("[data-act]");
  if(a && ACT[a.dataset.act]){ e.preventDefault(); ACT[a.dataset.act](a); return }
}
[TB, document.getElementById("phead"), document.getElementById("pfoot"), document.querySelector(".top")].forEach(r=>{ if(!r) return; r.addEventListener("input",onInput); r.addEventListener("change",onChange); r.addEventListener("click",onClick) });
/* filtro rápido de parâmetros */
TB.addEventListener("input",e=>{ if(e.target.id!=="qFind") return; const q=e.target.value.trim().toLowerCase();
  TB.querySelectorAll("[data-q]").forEach(f=>{ f.hidden = !!q && !f.dataset.q.includes(q) });
  TB.querySelectorAll(".card[data-filter]").forEach(c=>{ const any=[...c.querySelectorAll("[data-q]")].some(f=>!f.hidden); c.hidden=!!q && !any; if(q && any && c.tagName==="DETAILS") c.open=true }) });
/* detalhes lembram se estavam abertos */
TB.addEventListener("toggle",e=>{ const d=e.target; if(d.tagName!=="DETAILS"||!d.dataset.key) return; const st=LS.get("gabarito.det")||{}; st[TAB+":"+d.dataset.key]=d.open?1:0; LS.set("gabarito.det",st) },true);
function restoreDetails(){ const st=LS.get("gabarito.det")||{}; TB.querySelectorAll("details[data-key]").forEach(d=>{ const v=st[TAB+":"+d.dataset.key]; if(v!=null) d.open=!!v }) }

/* ================= etapas (UX v3 §2: 5 etapas) =================
   terreno → produto → viab → projeto (gar|tipo|sol|vento; o túnel 3D é o modo "v3d" dentro de Vento) → cen (Entrega).
   As chaves antigas viram aliases: regras → terreno, clima → projeto (goStep, LS gabarito.step, addCard via ETAPA_ALIAS).
   PSUB = sub-aba de Projeto · CSUB = modo de clima (sol|vento|v3d) · VMODO = último modo do Vento (vento|v3d).
   emClima() = Projeto › Sol ou Vento (substitui o antigo TAB==="clima"). Casca, menus, régua e celular: src/ui/navegacao.js. */
const IC = {
  terreno:'<path d="M4.5 17.5 7 5.5l10.5-1.8 2.5 13.3z"/><circle cx="4.5" cy="17.5" r="1.4"/><circle cx="7" cy="5.5" r="1.4"/><circle cx="17.5" cy="3.7" r="1.4"/><circle cx="20" cy="17" r="1.4"/>',
  produto:'<path d="M3 20.5h18M5 20.5V10h5v10.5M10 20.5V4h9v16.5"/><path d="M13 7.5h3M13 11h3M13 14.5h3"/>',
  viab:'<path d="M3.5 20.5h17M6 17V12M10.5 17V8M15 17v-6M19.5 17V5"/><path d="m5 9 5-4 4.5 3 5-4.5" opacity=".55"/>',
  projeto:'<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M3.5 11h7v9.5M10.5 3.5V8M14 14.5h6.5M14 14.5v6"/>',
  cen:'<path d="M12 14.5v-11M8 7.5l4-4 4 4"/><path d="M5 12.5v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>'
};
const STEPS = [
  {k:"terreno", nome:"Terreno", t:"Terreno", q:"Onde é e o que a lei permite"},
  {k:"produto", nome:"Produto", t:"Produto", q:"O que construir"},
  {k:"viab", nome:"Viabilidade", t:"Viabilidade", q:"Vale a pena?"},
  {k:"projeto", nome:"Projeto", t:"Projeto", q:"Funciona no desenho?", opc:true},
  {k:"cen", nome:"Entrega", t:"Entrega", q:"Mostrar e guardar"}
];
const PROJ_SUBS = [["gar","Garagem"],["tipo","Andares"],["sol","Sol"],["vento","Vento"]];
/* etapas antigas → novas para addCard (hooks.js): regras → Terreno; clima → Projeto (v3d → Vento; card de clima sem sub-aba aparece em Sol e Vento) */
Object.assign(ETAPA_ALIAS, { regras:"terreno", clima:{k:"projeto", sub:{v3d:"vento"}, semSub:["sol","vento"]} });
let PSUB = "gar", CSUB = S.clima.modo==="vento"? "vento" : "sol", VMODO = "vento";
let TAB = (()=>{ const v=LS.get("gabarito.step"), ps=LS.get("gabarito.psub");
  if(PROJ_SUBS.some(x=>x[0]===ps)){ PSUB=ps; if(ps==="sol") CSUB="sol"; if(ps==="vento") CSUB="vento" }
  if(v==="clima"){ PSUB="sol"; CSUB="sol"; return "projeto" }
  if(v==="regras") return "terreno";
  return STEPS.some(s=>s.k===v)? v : "terreno" })();
if(TAB!=="projeto" || (PSUB!=="sol" && PSUB!=="vento")) CSUB = S.clima.modo==="vento"? "vento" : "sol";
function emClima(){ return TAB==="projeto" && (PSUB==="sol" || PSUB==="vento") }
function railHTML(){
  const ok='<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.3 5 8.6l4.6-5"/></svg>';
  return STEPS.map((s,i)=>(i?`<span class="ln" id="ln-${s.k}" aria-hidden="true"></span>`:"")+`<button type="button" data-step="${s.k}" ${TAB===s.k?'aria-current="page"':""} title="${i+1}. ${s.t} — ${s.q}${s.opc?" (opcional)":""}"><span class="n"><b>${i+1}</b>${ok}</span><svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${IC[s.k]}</svg><span class="lb">${s.nome}</span><span class="st" id="st-${s.k}" hidden></span></button>`).join("");
}
document.getElementById("rail").innerHTML=railHTML();
document.getElementById("rail").addEventListener("click",e=>{ const b=e.target.closest("[data-step]"); if(b) goStep(b.dataset.step) });
/* chave antiga ou sub-aba antiga → [etapa, sub] do fluxo novo */
function navAlias(k, sub){
  if(k==="regras") return ["terreno", null];
  if(k==="clima"){ if(sub==="v3d"||sub==="vento"){ VMODO=sub; return ["projeto","vento"] } return ["projeto","sol"] }
  if(!STEPS.some(s=>s.k===k)) return ["terreno", null];
  return [k, sub];
}
function psubSet(v){
  if(v==="andar") v="tipo";
  if(v==="v3d"){ VMODO="v3d"; v="vento" }
  if(!PROJ_SUBS.some(x=>x[0]===v)) v="gar";
  PSUB=v; LS.set("gabarito.psub",v);
  if(v==="sol") CSUB="sol"; else if(v==="vento") CSUB = VMODO==="v3d"? "v3d" : "vento";
}
function railCur(){ document.querySelectorAll("#rail [data-step]").forEach(b=>{ if(b.dataset.step===TAB) b.setAttribute("aria-current","page"); else b.removeAttribute("aria-current") }) }
function goStep(k, sub){
  [k, sub] = navAlias(k, sub);
  const prev=TAB; TAB=k; LS.set("gabarito.step",k);
  if(k==="projeto" && sub) psubSet(sub);
  railCur();
  renderTab();
  const want = stepView();
  if(want && want!==VIEW) setView(want);
  if(prev!==k && typeof navEtapaMudou==="function") navEtapaMudou();
}
/* vista que cada etapa pede (só troca quando a atual não faz sentido) */
function stepView(){
  const pj = {gar:["gar"], tipo:["tipo","andar"], sol:["clima","3d"], vento: CSUB==="v3d"? ["v3d"] : ["clima"]}[PSUB];
  // Entrega mantém a vista, menos os mapas de sol/vento e o túnel (entregar é mostrar o prédio)
  const ok = { terreno:["impl"], produto:["3d","impl","andar"], viab:["3d"], projeto:pj, cen: VIEW==="clima"||VIEW==="v3d"? ["3d"] : null }[TAB];
  if(TAB==="projeto" && (PSUB==="sol" || (PSUB==="vento" && CSUB!=="v3d"))) S.clima.modo = PSUB==="sol"? "sol" : "vento";
  if(VIEW==="v3d" && !(TAB==="projeto" && PSUB==="vento" && CSUB==="v3d")) return ok? ok[0] : "3d";   // saiu do túnel 3D: a simulação para (setView → cfdLeave)
  if(!ok || ok.includes(VIEW)) return null;
  return ok[0];
}
/* a barra de vistas do palco puxa a etapa correspondente */
function stepFromView(v){
  if(v==="gar"){ if(TAB!=="projeto"||PSUB!=="gar"){ psubSet("gar"); goStepQuiet("projeto") } }
  else if(v==="tipo"||v==="andar"){ if(TAB!=="projeto"||PSUB!=="tipo"){ psubSet("tipo"); goStepQuiet("projeto") } }
  else if(v==="v3d"){ if(TAB!=="projeto"||PSUB!=="vento"||CSUB!=="v3d"){ VMODO="v3d"; psubSet("vento"); goStepQuiet("projeto") } }
  else if(v==="clima"){ const want=S.clima.modo==="vento"?"vento":"sol"; if(TAB!=="projeto"||PSUB!==want||CSUB==="v3d"){ if(want==="vento") VMODO="vento"; psubSet(want); goStepQuiet("projeto") } }
}
function goStepQuiet(k){ const prev=TAB; TAB=k; LS.set("gabarito.step",k); railCur(); renderTab(); if(prev!==k && typeof navEtapaMudou==="function") navEtapaMudou() }

/* ---------- conteúdo da etapa: o STEP_R da etapa (Terreno absorveu Regras no P2; Projeto absorveu Clima no P4) ---------- */
function etapaR(){ return STEP_R[TAB]() }
/* cards extras da etapa atual (os registrados com os nomes antigos entram pelo ETAPA_ALIAS; repetidos por chave ficam só uma vez) */
function cardsEtapa(){
  let l=cardsFor(TAB, curSub());
  const vis=new Set(); return l.filter(c=>{ if(vis.has(c.key)) return false; vis.add(c.key); return true });
}

function renderTab(){
  if(TAB==="projeto"){ if(PSUB==="sol") CSUB="sol"; else if(PSUB==="vento"){ if(CSUB==="sol") CSUB=VMODO==="v3d"? "v3d" : "vento"; VMODO=CSUB } }   // PSUB manda; CSUB = modo do clima
  const st=STEPS.find(s=>s.k===TAB)||STEPS[0], i=STEPS.indexOf(st), R=etapaR();
  document.getElementById("phead").innerHTML = `<div class="eb">Etapa ${i+1} de ${STEPS.length}${st.opc?" · opcional":""}</div><h1>${R.title||st.t}</h1><p class="q">${st.q}</p>${R.sub?`<div class="sub">${R.sub}</div>`:""}`;
  const keepScroll = TB.dataset.tab===TAB+(R.subKey||"") ? TB.scrollTop : 0;
  const cards=cardsEtapa();
  TB.innerHTML = R.body + cards.map(c=>c.html()).join(""); TB.dataset.tab=TAB+(R.subKey||"");
  document.getElementById("pfoot").innerHTML = rodapeHTML();
  restoreDetails();
  TB.querySelectorAll('input[type=range]').forEach(r=>{ if(typeof paintRange==="function") paintRange(r) });
  TB.scrollTop=keepScroll;
  update();
  if(R.after) R.after();
  cards.forEach(c=>{ if(c.after) try{ c.after() }catch(e){ console.error("[card "+c.key+"]",e) } });
}
/* rodapé (§6.3): orientação · ← anterior · "Próximo passo" (o único botão laranja da tela) */
let PROXPP = null;
function proxPassoCalc(){
  let pp=null; try{ if(typeof proximoPassoAtual==="function" && window._last) pp=proximoPassoAtual() }catch(e){ console.error("[próximo passo]", e) }
  if(pp && pp.rotulo) return pp;
  const i=STEPS.findIndex(s=>s.k===TAB), nx=STEPS[i+1];
  return nx? {rotulo:`${nx.nome} →`, etapa:nx.k, dica:""} : {rotulo:"Baixar relatório PDF", act:"pdf", dica:""};
}
function rodapeHTML(){
  const i=STEPS.findIndex(s=>s.k===TAB), prev=STEPS[i-1], pp=PROXPP=proxPassoCalc();
  const ant = TAB==="cen" && ACT.apStart? `<button type="button" class="btn nv-ant" data-act="apStart"><span>Apresentar</span></button>`
    : prev? `<button type="button" class="btn ghost nv-ant" data-act="go" data-k="${prev.k}" title="Voltar para ${prev.nome}"><span>← ${prev.nome}</span></button>` : "";
  return `<div class="nv-dica" id="nvDica">${dicaHTML(pp)}</div>${ant}<button type="button" class="btn pri nv-prox" id="nvProx" data-act="proxPasso"${ant?"":' style="grid-column:1/-1"'}><span>${esc(pp.rotulo)}</span></button>`;
}
const dicaHTML = pp=> pp && pp.dica? `<span class="dot ${pp.k?"warn":"ok"}"></span><span>${esc(pp.dica)}</span>` : "";
function rodapeLive(){
  const b=document.getElementById("nvProx"); if(!b) return;
  const pp=PROXPP=proxPassoCalc(), t=b.querySelector("span"); if(t && t.textContent!==pp.rotulo) t.textContent=pp.rotulo;
  const d=document.getElementById("nvDica"), h=dicaHTML(pp); if(d && d.innerHTML!==h) d.innerHTML=h;
}
/* status das etapas (✓ / pendência) pelo checklist (progressoItens) e pelo estado do produto e da viabilidade */
function railStatus(m,f){
  const s=status(m,S), worst=(...a)=> a.includes("bad")?"bad": a.includes("warn")?"warn":"ok";
  let itens=[]; try{ if(typeof progressoItens==="function") itens=progressoItens(S,m,f) }catch(e){}
  const base = {
    terreno: m.A>10? worst(s.ca==="warn"?"ok":s.ca, s.h, s.perm) : "bad",
    produto: worst(s.tor, s.apto, s.vg),
    viab: f.margemVGV<0||f.margemVGV<S.metas.margem.min?"bad": f.margemVGV<S.fin.margemAlvo?"warn":"ok",   // margem s/ VGV · metas em S.metas
  };
  const feitos={};
  STEPS.forEach((st,i)=>{
    // Projeto é refino: a garagem ainda estimada não conta como pendência, mas o ✓ só vem com tudo conferido
    const todos=itens.filter(x=>x.etapa===st.k), it=todos.filter(x=>st.k!=="projeto" || x.k!=="garagem" || S.estudo.usarLayout);
    const pend=it.some(x=>x.ok===false), b=base[st.k];
    const feito = todos.length>0 && todos.every(x=>x.ok===true) && b!=="bad";
    feitos[st.k]=feito;
    const cls = b==="bad"? "bad" : pend? "warn" : feito? "ok" : (b==="warn"? "warn" : null);
    const e=document.getElementById("st-"+st.k); if(e){ e.hidden=!cls; e.className="st"+(cls?" "+cls:"") }
    const btn=e && e.parentElement; if(btn) btn.classList.toggle("feito", feito);
    const ln=document.getElementById("ln-"+st.k); if(ln && i>0) ln.classList.toggle("ok", !!feitos[STEPS[i-1].k]);
  });
  rodapeLive();
}

/* ================= ações ================= */
/* depois de trocar a sub-aba de Projeto ou o modo do clima: a vista certa, e o mapa de clima recalculado */
function subVista(){ const w=stepView(); if(w && w!==VIEW) setView(w); else if(VIEW==="clima" && window._last){ viewbarSegs(window._last.m); climaRun(); hintFor() } }
const ACT = {
  go: b=>goStep(b.dataset.k),
  psub: b=>{ const v=b.dataset.v; if(TAB!=="projeto"){ goStep("projeto", v); return } psubSet(v); renderTab(); TB.scrollTop=0; subVista(); if(v==="andar" && VIEW!=="andar") setView("andar") },
  csub: b=>{ const v=b.dataset.v; if(v==="sol") psubSet("sol"); else { VMODO = v==="v3d"? "v3d" : "vento"; psubSet("vento") }
    if(TAB!=="projeto"){ goStep("projeto", PSUB); return } renderTab(); subVista() },
  vmodo: b=>{ const v=b.dataset.v; ACT.csub({dataset:{v: v==="v3d"||v==="3d"||v==="tunel"? "v3d" : "vento"}}) },
  proxPasso: b=>{ const pp=PROXPP||proxPassoCalc();
    if(typeof progressoExecuta==="function" && (pp.etapa||pp.act) && !(pp.act && !ACT[pp.act])) return progressoExecuta(pp, b);
    if(pp.act && ACT[pp.act]) return ACT[pp.act](b);
    if(pp.etapa) goStep(pp.etapa, pp.sub||undefined) },
  view: b=>setView(b.dataset.v),
};

/* ================= atualização ================= */
let saveT, fullT, lastGar=null;
/* save(): grava a cópia de trabalho e marca uma mudança para o desfazer (histTouch) e para o repositório de estudos */
function save(){ clearTimeout(saveT); if(typeof navSalvo==="function") navSalvo(true); saveT=setTimeout(()=>{ LS.set("gabarito.v2",S); if(typeof navSalvo==="function") navSalvo(false) },300); if(typeof histTouch==="function") histTouch() }
/* cálculo barato (sem layouts de garagem; reaproveita os últimos) — tela principal */
function calcBarato(){ const m=compute(S,{layouts:false, quick:true}); if(lastGar){ m.gar=lastGar.gar; m.vagasLay=lastGar.n+(m.vf?m.vf.count:0); if(S.estudo.usarLayout) m.vagas=m.vagasLay } return m }
/* update(): o modo rápido (arraste) roda aqui; o cálculo completo vai para o Web Worker (src/ui/calcworker.js) e
   substitui o resultado quando chega. Sem Worker, tudo roda aqui como antes. */
function update(o={}){
  normalizeLote();
  const bg = typeof calcOn==="function" && calcOn();
  let m;
  if(o.fast){
    if(bg){ m=calcBarato(); calcInvalida() }
    else { const need=VIEW==="gar"||VIEW==="andar"; m=compute(S,{layouts:need, quick:need}); if(!need && lastGar){ m.gar=lastGar.gar; m.vagasLay=lastGar.n+(m.vf?m.vf.count:0); if(S.estudo.usarLayout) m.vagas=m.vagasLay } }
    clearTimeout(fullT); fullT=setTimeout(()=>{ fullT=0; update() },160) }
  else if(bg){ clearTimeout(fullT); fullT=0; m=calcBarato(); calcPedir() }
  else { clearTimeout(fullT); fullT=0; m=compute(S); lastGar={gar:m.gar, n:m.vagasLay-(m.vf?m.vf.count:0)} }
  showModel(m, !!o.fast || bg); save();
}
/* mostra um resultado (do cálculo daqui ou do Worker) em todas as partes vivas */
function showModel(m, fast){
  const f=finance(S,m); window._last={m,f};
  renderKPIs(m,f); railStatus(m,f); renderLive(m,f,!!fast);
  if(VIEW!=="v3d") rebuild3d(m); redraw2d(); viewbarSegs(m); if(typeof planLegend==="function") planLegend();
}
const renderTabLive=(m,f)=>renderLive(m,f,false);
/* régua (UX v3 §5): 6 indicadores, cada um leva para onde o número se resolve (data-ir = [etapa, sub, seção]); "⋯" abre os outros
   (kpiExtras, popover em src/ui/navegacao.js). Status minimalista: ponto antes do rótulo; o valor só ganha cor quando está ruim.
   No celular ficam Margem, Retorno e Vagas (data-m) no topo da folha. */
function kpiRegras(m){
  if(typeof rgConformidade==="function"){ try{
    const r=rgConformidade(m), l=Array.isArray(r)? r : r && (r.linhas||r.rows||r.itens);
    if(Array.isArray(l)) return l.filter(x=>(x.st||x.status||x.nivel||(Array.isArray(x)? x[3] : ""))==="bad")
      .map(x=>({txt: Array.isArray(x)? `${String(x[0]).toLowerCase()} ${x[2]}` : String(x.txt || [x.nome||x.rotulo||x.k, x.valor||x.v].filter(Boolean).join(" ")).replace(/^./, c=>c.toLowerCase())}));
  }catch(e){ console.error("[régua] rgConformidade", e) } }
  if(typeof progForaRegras==="function"){ try{ return progForaRegras(S, m)||[] }catch(e){} }
  const s=status(m,S); return [["ca","aproveitamento"],["h","altura"],["perm","permeável"],["apto","menor unidade"]].filter(([k])=>s[k]==="bad").map(([,txt])=>({txt}));
}
const kpiMi=v=>nf(v/1e6,1)+" mi";
function renderKPIs(m,f){
  const s=status(m,S), sd=f.saude||saudeNegocio(S,m,f), sc=n=>({ruim:"bad",atencao:"warn",ok:"ok",otimo:"ok"})[n];
  const k=(id,l,v,sub,st,ir,tt,mob)=>`<div class="kpi" role="button" tabindex="0" data-kpi="${id}" data-ir='${esc(JSON.stringify(ir))}'${mob?" data-m":""}${tt?` title="${esc(tt)}"`:""}><div class="l">${st?`<span class="dot ${st}"></span>`:""}${l}</div><div class="v${st==="bad"?" bad":""}">${v}</div><div class="s">${sub||"&nbsp;"}</div></div>`;
  const tor=`${m.T.length} torre${m.T.length>1?"s":""}`, fora=kpiRegras(m), un=Math.max(1,m.units);
  const h =
    k("units", "Unidades", nf(m.units), `${tor}<span class="lx"> · ${m.T.map(t=>t.pav).join(" e ")} and.</span>`, s.apto==="bad"? "bad" : s.tor, ["produto",null,"pr-mix"], `${m.units} unidades · ${tor}${m.lojaA?" + lojas":""} — ver as unidades por andar`) +
    k("regras", "Regras", fora.length? `${fora.length} fora` : "dentro", fora.length? fora[0].txt : "CA, altura e ocupação", fora.length? "bad" : "ok", ["produto",null,null], fora.length? "Fora das regras: "+fora.map(x=>x.txt).join(" · ") : "Dentro das regras da prefeitura (aproveitamento, altura, ocupação, permeável e menor unidade)") +
    // vagas pelo layout: no 1º cálculo rápido ainda não há layout (a estimativa por área engana) — espera o completo
    (S.estudo.usarLayout && !m.gar? k("vagas", "Vagas", `…/${m.vagasReq}`, "calculando…", null, ["projeto","gar",null], "Calculando o layout da garagem", true) :
    k("vagas", "Vagas", `${m.vagas}/${m.vagasReq}`, S.estudo.usarLayout?"pelo layout":"estimadas", s.vg, ["projeto","gar",null], `${m.vagas} vagas ${S.estudo.usarLayout?"no layout":"estimadas"} · ${m.vagasReq} exigidas — ver a garagem`, true)) +
    k("vgv", TERMO("VGV"), mi(f.vgv), `${mi(f.vgv/un)}/un`, null, ["viab","res","essencial"], `Valor geral de vendas · ${mi(f.vgv/un)} por unidade — ver os preços`) +
    k("margem", TERMO("Margem s/ VGV","Margem"), pct(sd.margemVGV), `meta ${pct(S.fin.margemAlvo,0)}<span class="lx"> · lucro ${kpiMi(f.lucro)}</span>`, sc(sd.nivel.margem), ["viab","res",null], `Lucro ${mi(f.lucro)} · margem s/ VGV · meta ${pct(S.fin.margemAlvo,0)} · s/ receita ${pct(f.margem)}`, true) +
    k("tir", TERMO("TIR","Retorno"), f.tirA==null?"—":pct(f.tirA), `alvo ${pct(S.metas.tir.alvo,0)}`, sc(sd.nivel.tir), ["viab","risco","alavancas"], `Retorno ao ano (TIR) · VPL ${mi(f.vpl)} · alvo ${pct(S.metas.tir.alvo,0)} · TMA ${pct(S.fin.tma,0)} — o que melhora o resultado`, true) +
    `<button type="button" class="kpi-mais" id="kpiMais" aria-label="Mais indicadores" aria-haspopup="dialog" aria-expanded="${!!(typeof NAV!=="undefined" && NAV.kpop && !NAV.kpop.hidden)}" title="Mais indicadores"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18.5" cy="12" r="1.7"/></svg></button>`;
  const el=document.getElementById("kpis"); if(el.innerHTML!==h) el.innerHTML=h;
  if(typeof navKpiPreenche==="function") navKpiPreenche();
}
/* os indicadores do "⋯" (mesmos title de antes) */
function kpiExtras(m,f){
  const s=status(m,S), sd=f.saude||saudeNegocio(S,m,f), sc=n=>({ruim:"bad",atencao:"warn",ok:"ok",otimo:"ok"})[n];
  return [
    {l:"Terreno", v:m2(m.A), s:`permeável ${pct(m.perm,0)}`, st:s.perm, ir:["terreno",null,"contorno"], tt:`Área do terreno · permeável ${pct(m.perm,0)}`},
    {l:"Aproveitamento (CA)", v:nf(m.CA,2), s:`básico ${nf(S.regras.caBas,1)} · máximo ${nf(S.regras.caMax,1)}`, st:s.ca, ir:["terreno",null,"regras"], tt:`Coeficiente de aproveitamento · básico ${nf(S.regras.caBas,1)} · máximo ${nf(S.regras.caMax,1)}`},
    {l:"Altura", v:nf(m.H,1)+" m", s:`máx ${nf(S.regras.hMax,0)} m`, st:s.h, ir:["terreno",null,"regras"]},
    {l:"Eficiência global", v:pct(sd.eficGlobal,0), s:`privativa ÷ construída · ref. ${nf(sd.faixaEfic[0]*100,0)}–${pct(sd.faixaEfic[1],0)}`, st:sc(sd.nivel.efic), ir:["produto",null,"pr-mix"], tt:`Área privativa ÷ construída · referência ${nf(sd.faixaEfic[0]*100,0)}–${pct(sd.faixaEfic[1],0)} (${sd.tipologiaNome})${m.eficReal!=null? ` · eficiência real da planta ${pct(m.eficReal,0)} (informada ${pct(S.produto.efic,0)})` : ""}`},
    {l:"Lucro", v:mi(f.lucro), s:`margem s/ receita ${pct(f.margem)}`, ir:["viab","res",null]},
    {l:"VPL", v:mi(f.vpl), s:`taxa mínima ${pct(S.fin.tma,0)} ao ano`, ir:["viab","res",null]},
    {l:"Caixa necessário", v:mi(Math.abs(f.exp||0)), s:"exposição máxima do caixa", ir:["viab","res","cash"]},
  ];
}
function renderLive(m,f,fast){
  const run=fn=>{ if(fn) fn(m,f,fast) };
  run(STEP_LIVE[TAB]);
  cardsEtapa().forEach(c=>{ if(c.live) try{ c.live(m,f,fast) }catch(e){ console.error("[card "+c.key+"]",e) } });
}
const curSub=()=> TAB==="projeto"? PSUB : (typeof subAtual==="function"? subAtual(TAB) : null);

/* ================= navegação entre etapas, sub-abas e seções (UX v3) ================= */
/* sub-abas fixas de Projeto (PSUB); as outras etapas usam SUBTABS/SUBDEF/SUBX (src/ui/ux.js) */
const ETAPA_SUBS = { projeto: PROJ_SUBS.map(x=>x.slice()), clima: [["sol","Sol"],["vento","Vento"]] };   // projeto: regravado por etapa-projeto.js (P4); clima: legado (STEP_R.clima), subsDe("clima") → Projeto
/* chaves das sub-abas da etapa k ([] se não tem; aceita os nomes antigos). As de SUBTABS só se conhecem depois de a etapa
   montar o painel uma vez: se ainda não montou, monta o HTML (sem pôr na tela) só para registrar. */
function subsDe(k){
  [k] = navAlias(k);
  if(ETAPA_SUBS[k]) return ETAPA_SUBS[k].map(x=>x[0]);
  if(typeof SUBDEF==="undefined") return [];
  if(!SUBDEF[k] && STEP_R[k]){ const t=TAB; TAB=k; try{ etapaR() }catch(e){} finally{ TAB=t } }
  return (SUBDEF[k]||[]).map(x=>x[0]);
}
/* leva o usuário a um ponto do inspetor: troca a etapa e a sub-aba (PSUB/CSUB ou SUBX), abre a seção <details data-key=secKey>
   (e o "Mais opções" que contém o campo), rola até ela e foca o campo [data-p=campoP] se dado. Aceita os nomes antigos
   (regras, clima; sub-abas andar e v3d). Sub-aba que a etapa não tem é ignorada. Sem etapa = a atual.
   No celular, a folha sobe (cheia quando há seção ou campo). Devolve o elemento focado/rolado (ou null). */
function irPara(etapa, sub, secKey, campoP){
  let [k, s] = navAlias(etapa || TAB, sub);
  if(s==="andar") s="tipo";
  if(s==="v3d" && k==="projeto"){ VMODO="v3d"; s="vento" }
  if(s && !subsDe(k).includes(s)) s=null;
  if(s && k!=="projeto" && typeof SUBX!=="undefined"){ SUBX[k]=s; LS.set("gabarito.subx",SUBX) }
  // a seção fica lembrada como aberta (gabarito.det), assim sobrevive ao renderTab
  if(secKey){ const st=LS.get("gabarito.det")||{}; st[k+":"+secKey]=1; LS.set("gabarito.det",st) }
  if(k!==TAB || (k==="projeto" && s)) goStep(k, k==="projeto"? (s||undefined) : undefined);
  else { renderTab(); subVista() }
  TB.scrollTop=0;
  if(typeof navCel==="function" && navCel() && typeof folhaSet==="function") folhaSet(campoP||secKey? "cheia" : "media");
  const q=x=>{ try{ return TB.querySelector(x) }catch(e){ return null } };
  const sec = secKey ? q(`details[data-key="${CSS.escape(secKey)}"]`) : null;
  if(sec) sec.open=true;
  const cp = campoP && CSS.escape(campoP);
  const campo = cp ? ((sec && (sec.querySelector(`[data-p="${cp}"]`) || sec.querySelector(`[data-set="${cp}"]`))) || q(`[data-p="${cp}"]`) || q(`[data-set="${cp}"][aria-pressed="true"]`) || q(`[data-set="${cp}"]`)) : null;
  if(campo){
    for(let d=campo.closest("details"); d; d=d.parentElement && d.parentElement.closest("details")) d.open=true;
    const adv=campo.closest(".adv"), ab=adv && adv.querySelector(":scope > .advb");
    if(ab && ab.hidden){ const bt=adv.querySelector(":scope > .advbtn"); if(bt && ACT.advTog) ACT.advTog(bt); else ab.hidden=false }
  }
  const alvo = campo || sec;
  if(alvo){
    alvo.scrollIntoView({block: campo? "center" : "start"});
    if(campo && typeof campo.focus==="function") try{ campo.focus({preventScroll:true}) }catch(e){}
  }
  return alvo || null;
}

/* ================= utilidades compartilhadas ================= */
function genNeighbors(){
  const L=S.lote.pts, out=[];
  L.forEach((a,i)=>{ const b=L[(i+1)%L.length], dx=b[0]-a[0], dy=b[1]-a[1], l=Math.hypot(dx,dy); if(l<3) return; const n=[dy/l,-dx/l];
    const front=S.lote.front.includes(i), gap= front? 16 : 1.5, dep= front? 18 : 14, h= front? 15 : (i%2? 24 : 9);
    const p=[[a[0]+n[0]*gap,a[1]+n[1]*gap],[b[0]+n[0]*gap,b[1]+n[1]*gap],[b[0]+n[0]*(gap+dep),b[1]+n[1]*(gap+dep)],[a[0]+n[0]*(gap+dep),a[1]+n[1]*(gap+dep)]];
    out.push({pts:p, h, nome: front? "Quadra em frente" : "Vizinho L"+(i+1)}) });
  S.entorno=out;
}
function saveScenario(nome, aprovado){
  const {m,f}=window._last; const l=LS.get("gabarito.cenarios2")||[];
  nome = nome || `${m.T.length} torre(s) · ${m.T.map(t=>t.pav).join(" e ")} pav · ${S.produto.subsolos} subsolo(s)`;
  l.unshift({nome,data:new Date().toLocaleDateString("pt-BR"),aprovado:!!aprovado,S:clone(S),k:{units:m.units,priv:m.priv,vagas:m.vagas,ca:m.CA,h:m.H,vgv:f.vgv,custo:f.custo,lucro:f.lucro,margem:f.margem,tir:f.tirA,exp:-f.exp}});
  LS.set("gabarito.cenarios2",l);
}
/* lote a partir de coordenadas: KML, GeoJSON (lon/lat ou UTM) ou "latitude, longitude" por linha.
   A origem (0,0) do lote fica no centroide, em S.lote.lat/lon (7 casas: a topografia e o entorno usam essa referência). */
function importCoords(raw){
  raw=String(raw||""); let pairs=[];
  if(/^\s*[\[{]/.test(raw)){ const r=geoLerGeoJSON(raw,{lonRef:S.lote.lon, latRef:S.lote.lat}); if(r.erro){ toast(r.erro); return } pairs=r.pares }
  else { const kml=raw.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
    if(kml){ kml[1].trim().split(/\s+/).forEach(t=>{ const [lon,lat]=t.split(",").map(Number); if(isFinite(lat)&&isFinite(lon)) pairs.push([lat,lon]) }) }
    else raw.split(/\n/).forEach(l=>{ const n=l.match(/-?\d+(?:\.\d+)?/g); if(n&&n.length>=2) pairs.push([+n[0],+n[1]]) }) }
  aplicarLoteGeo(pairs, `${pairs.length} pontos importados`);
}
function aplicarLoteGeo(pairs, fonte){
  const lp = pairs && pairs.length>=3 ? geoLoteDePares(pairs) : null;
  if(!lp){ toast("Preciso de pelo menos 3 pontos"); return false }
  S.lote.pts=lp.pts; S.lote.front=[]; S.lote.rec=S.lote.pts.map(()=>({})); normalizeLote(); S.lote.front=[0]; S.lote.principal=0;
  S.lote.lat=lp.lat; S.lote.lon=lp.lon; S.lote.norte=0; S.lote.geo=true;   // posicionado de verdade: as buscas do OSM e do relevo passam a valer
  renderTab(); fit2d(); fit3d(); toast(`${fonte} · ${m2(G.area(S.lote.pts))}`);
  return true;
}
function normalizeLote(){ const L=S.lote; if(L.pts.length<3) return; ensureRec();
  if(G.sArea(L.pts)<0){ const n=L.pts.length, mp=i=>((n-2-i)%n+n)%n; L.pts=L.pts.slice().reverse(); L.front=L.front.map(mp); L.principal=mp(L.principal); if(L.ladoVei!=null) L.ladoVei=mp(L.ladoVei); const r=L.rec.slice(); L.rec=r.map((_,i)=>r[mp(i)]) }
  if(!L.front.includes(L.principal)) L.principal=L.front[0]??0;
  if(L.ladoVei!=null && (!L.front.includes(L.ladoVei) || L.ladoVei===L.principal)) L.ladoVei=null }   // lado de veículos: só um lado na rua; o mesmo da principal = padrão
function ensureRec(){ const L=S.lote; if(!Array.isArray(L.rec)) L.rec=[]; while(L.rec.length<L.pts.length) L.rec.push({}); if(L.rec.length>L.pts.length) L.rec.length=L.pts.length }
function edgeInsert(mI){ const L=S.lote; ensureRec(); L.front=L.front.flatMap(i=> i===mI?[i,i+1]: i>mI?[i+1]:[i]); if(L.principal>mI) L.principal++; if(L.ladoVei!=null && L.ladoVei>mI) L.ladoVei++; L.rec.splice(mI+1,0,{...L.rec[mI]}) }
function resumo(){
  const {m,f}=window._last;
  return `${S.nome}\n${S.regras.cidade}\n\nTerreno: ${m2(m.A)}\nTorres: ${m.T.map((t,i)=>`T${i+1} ${t.pav} pav`).join(", ")}\nUnidades: ${m.units} (${m.unitRows.map(u=>`${u.n}× ${u.nome}`).join(", ")}${m.cobN?`, ${m.cobN} coberturas`:""})${m.lojaA?`\nLojas: ${m2(m.lojaPriv)}`:""}\nVagas: ${m.vagas} (exigidas ${m.vagasReq})\nAltura ${nf(m.H,1)} m | CA ${nf(m.CA,2)} | TO ${pct(m.TO,0)}\nÁrea construída ${m2(m.constr)} | Privativa ${m2(m.priv)}\n\nVGV (tabela): ${brl(f.vgv)}\nReceita nominal: ${brl(f.receita)}\nCusto total: ${brl(f.custo)}\nLucro: ${brl(f.lucro)} (margem ${pct(f.margem)})\nTIR: ${f.tirA==null?"—":pct(f.tirA)} a.a. | VPL: ${brl(f.vpl)}\nExposição máxima: ${brl(-f.exp)}\nTerreno máximo p/ margem ${pct(S.fin.margemAlvo,0)}: ${brl(f.maxTerreno)}`;
}
function cashSVG(f){
  /* rótulos dos marcos (lançamento, chaves) no topo; exposição sob o ponto mais baixo, em valor absoluto — nada se sobrepõe à curva */
  const W=360,H=158,pl=44,pr=8,pt=18,pb=24, cum=f.cumA, n=cum.length;
  const mn=Math.min(0,...cum), mx=Math.max(0,...cum), sx=i=>pl+(W-pl-pr)*i/Math.max(1,n-1), sy=v=>pt+(H-pt-pb)*(mx-v)/((mx-mn)||1);
  const path=cum.map((v,i)=>(i?"L":"M")+sx(i).toFixed(1)+","+sy(v).toFixed(1)).join("");
  const ar=`M${sx(0)},${sy(0)} `+cum.map((v,i)=>"L"+sx(i).toFixed(1)+","+sy(v).toFixed(1)).join("")+` L${sx(n-1)},${sy(0)} Z`;
  const ticks=[mn,0,mx].filter((v,i,a)=>a.indexOf(v)===i), iMin=cum.indexOf(Math.min(...cum));
  const xL=sx(f.launch), xC=sx(f.chaves), perto=xC-xL<92, xE=Math.min(W-pr-52, Math.max(pl+52, sx(iMin)));
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Fluxo de caixa acumulado">
    ${ticks.map(v=>`<line x1="${pl}" x2="${W-pr}" y1="${sy(v)}" y2="${sy(v)}" stroke="var(--line)" ${v===0?'stroke-width="1.2"':'stroke-dasharray="2 3"'}/><text x="${pl-4}" y="${sy(v)+3}" font-size="9" text-anchor="end" fill="var(--muted)" font-family="DM Sans, system-ui, sans-serif">${v===0?"0":nf(v/1e6,1)+"mi"}</text>`).join("")}
    <line x1="${xL}" x2="${xL}" y1="${pt}" y2="${H-pb}" stroke="var(--muted)" stroke-dasharray="3 3"/><text x="${xL+3}" y="${pt-6}" font-size="9" fill="var(--muted)">lançamento</text>
    <line x1="${xC}" x2="${xC}" y1="${pt}" y2="${H-pb}" stroke="var(--muted)" stroke-dasharray="3 3"/><text x="${perto? xC+3 : xC-3}" y="${perto? pt+6 : pt-6}" font-size="9" ${perto?"":'text-anchor="end"'} fill="var(--muted)">chaves</text>
    <path d="${ar}" fill="var(--accent)" fill-opacity=".12"/><path d="${path}" fill="none" stroke="var(--accent)" stroke-width="1.8"/>
    <circle cx="${sx(iMin)}" cy="${sy(cum[iMin])}" r="3" fill="var(--bad)"/><circle cx="${sx(n-1)}" cy="${sy(cum[n-1])}" r="3" fill="var(--accent)"/>
    <text x="${xE}" y="${sy(cum[iMin])+14}" text-anchor="middle" font-size="9" fill="var(--bad)" font-family="DM Sans, system-ui, sans-serif">exposição ${mi(-cum[iMin])}</text>
    ${f.distrato && f.distrato.M!=null && f.distrato.refund ? `<line x1="${sx(f.distrato.M)}" x2="${sx(f.distrato.M)}" y1="${pt}" y2="${H-pb}" stroke="var(--warn)" stroke-dasharray="2 2"/><text x="${sx(f.distrato.M)+3}" y="${pt+16}" font-size="9" fill="var(--warn)">distratos</text>` : ""}
  </svg>`;
}
/* rosa dos ventos clicável */
function compassSVG(cur){
  const dirs=[["N",0],["NE",45],["L",90],["SE",135],["S",180],["SO",225],["O",270],["NO",315]], R=72, c=89, th=(S.lote.norte||0);
  const pt=(a,r)=>[c+r*Math.sin(a*Math.PI/180), c-r*Math.cos(a*Math.PI/180)];
  const [ax,ay]=pt(cur,R-22), [bx,by]=pt(cur+180,30);
  return `<div class="compass"><svg viewBox="0 0 178 178" role="group" aria-label="Direção de onde o vento vem">
    <circle cx="${c}" cy="${c}" r="${R-14}" fill="none" stroke="var(--line)"/><circle cx="${c}" cy="${c}" r="${R-38}" fill="none" stroke="var(--line)" stroke-dasharray="2 3"/>
    <defs><marker id="cmpA" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="var(--accent)"/></marker></defs>
    <line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round" marker-end="url(#cmpA)"/>
    <text x="${c}" y="${c+44}" text-anchor="middle" font-size="9.5" fill="var(--muted)" font-family="DM Sans, system-ui, sans-serif">vem de ${dirs.find(d=>d[1]===cur)?.[0]||nf(cur,0)+"°"}</text>
    ${dirs.map(([l,a])=>{ const [x,y]=pt(a,R); return `<g class="cd${a===cur?" on":""}" data-act="vdir" data-v="${a}" role="button" aria-label="${l}"><circle cx="${x}" cy="${y}" r="13"/><text x="${x}" y="${y}">${l}</text></g>` }).join("")}
  </svg></div>`;
}
ACT.vdir = b=>{ S.clima.ventoDir=+b.dataset.v; save(); if(VIEW==="v3d"){ cfdStart(true) } else { climaRun() } renderTab() };
