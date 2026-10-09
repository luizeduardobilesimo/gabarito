/* ================= interface: etapas, campos e ligação ================= */
/* Campos declarativos: cada controle aponta para um caminho em S (data-p) e um efeito (data-fx).
   Um único listener delegado no inspetor cuida de todos — nada de bind por id. */
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
[TB, document.getElementById("phead"), document.getElementById("pfoot")].forEach(r=>{ r.addEventListener("input",onInput); r.addEventListener("change",onChange); r.addEventListener("click",onClick) });
/* filtro rápido de parâmetros */
TB.addEventListener("input",e=>{ if(e.target.id!=="qFind") return; const q=e.target.value.trim().toLowerCase();
  TB.querySelectorAll("[data-q]").forEach(f=>{ f.hidden = !!q && !f.dataset.q.includes(q) });
  TB.querySelectorAll(".card[data-filter]").forEach(c=>{ const any=[...c.querySelectorAll("[data-q]")].some(f=>!f.hidden); c.hidden=!!q && !any; if(q && any && c.tagName==="DETAILS") c.open=true }) });
/* detalhes lembram se estavam abertos */
TB.addEventListener("toggle",e=>{ const d=e.target; if(d.tagName!=="DETAILS"||!d.dataset.key) return; const st=LS.get("gabarito.det")||{}; st[TAB+":"+d.dataset.key]=d.open?1:0; LS.set("gabarito.det",st) },true);
function restoreDetails(){ const st=LS.get("gabarito.det")||{}; TB.querySelectorAll("details[data-key]").forEach(d=>{ const v=st[TAB+":"+d.dataset.key]; if(v!=null) d.open=!!v }) }

/* ================= etapas ================= */
const IC = {
  terreno:'<path d="M4.5 17.5 7 5.5l10.5-1.8 2.5 13.3z"/><circle cx="4.5" cy="17.5" r="1.4"/><circle cx="7" cy="5.5" r="1.4"/><circle cx="17.5" cy="3.7" r="1.4"/><circle cx="20" cy="17" r="1.4"/>',
  regras:'<path d="M5 3.5h10l4 4V20.5H5z"/><path d="M15 3.5v4h4M8.5 11h7M8.5 14.5h7M8.5 18h4"/>',
  produto:'<path d="M3 20.5h18M5 20.5V10h5v10.5M10 20.5V4h9v16.5"/><path d="M13 7.5h3M13 11h3M13 14.5h3"/>',
  viab:'<path d="M3.5 20.5h17M6 17V12M10.5 17V8M15 17v-6M19.5 17V5"/><path d="m5 9 5-4 4.5 3 5-4.5" opacity=".55"/>',
  projeto:'<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M3.5 11h7v9.5M10.5 3.5V8M14 14.5h6.5M14 14.5v6"/>',
  clima:'<circle cx="8.5" cy="8" r="3.2"/><path d="M8.5 2v1.3M3.3 4.4l.9.9M2.5 8h1.3M13.7 4.4l-.9.9"/><path d="M4 14.5h11.5a2.6 2.6 0 1 0-2.6-2.6M3 18.5h14.5a2.3 2.3 0 1 1-2.3 2.3"/>',
  cen:'<path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8z"/><path d="m3.5 12.2 8.5 4.5 8.5-4.5M3.5 16.2l8.5 4.5 8.5-4.5"/>'
};
const STEPS = [
  {k:"terreno", nome:"Terreno", t:"Terreno", d:"Desenhe o lote e marque frentes e acessos."},
  {k:"regras", nome:"Regras", t:"Regras", d:"Limites da prefeitura e padrões do projeto."},
  {k:"produto", nome:"Produto", t:"Produto", d:"Potencial do terreno e a melhor combinação."},
  {k:"viab", nome:"Viabilidade", t:"Viabilidade", d:"Resultado, fluxo de caixa e premissas."},
  {k:"projeto", nome:"Projeto", t:"Projeto", d:"Garagem, pavimento tipo e andares."},
  {k:"clima", nome:"Clima", t:"Sol e vento", d:"Insolação, vento no chão e túnel de vento."},
  {k:"cen", nome:"Cenários", t:"Cenários e entrega", d:"Salve, compare e exporte o estudo."}
];
let TAB = LS.get("gabarito.step") || "produto"; if(!STEPS.some(s=>s.k===TAB)) TAB="produto";
let PSUB = "gar", CSUB = S.clima.modo==="vento"? "vento" : "sol";
function railHTML(){
  return STEPS.map((s,i)=>`<button type="button" data-step="${s.k}" ${TAB===s.k?'aria-current="page"':""} title="${i+1}. ${s.t}"><span class="st" id="st-${s.k}" hidden></span><svg viewBox="0 0 24 24" aria-hidden="true">${IC[s.k]}</svg>${s.nome}</button>`).join("");
}
document.getElementById("rail").innerHTML=railHTML();
document.getElementById("rail").addEventListener("click",e=>{ const b=e.target.closest("[data-step]"); if(b) goStep(b.dataset.step) });
function goStep(k, sub){
  const prev=TAB; TAB=k; LS.set("gabarito.step",k);
  if(k==="projeto" && sub) PSUB=sub; if(k==="clima" && sub) CSUB=sub;
  document.querySelectorAll("#rail [data-step]").forEach(b=>{ if(b.dataset.step===k) b.setAttribute("aria-current","page"); else b.removeAttribute("aria-current") });
  renderTab();
  const want = stepView();
  if(want && want!==VIEW) setView(want);
  if(prev!==k && matchMedia("(max-width:900px)").matches) document.querySelector(".panel").scrollIntoView({behavior:"smooth",block:"start"});
}
/* vista que cada etapa pede (só troca quando a atual não faz sentido) */
function stepView(){
  const ok = { terreno:["impl"], regras:["3d","impl"], produto:["3d","impl","andar"], viab:["3d"], projeto:{gar:["gar"],tipo:["tipo"],andar:["andar"]}[PSUB], clima:{sol:["clima","3d"],vento:["clima"],v3d:["v3d"]}[CSUB], cen:null }[TAB];
  if(!ok || ok.includes(VIEW)) return null;
  if(TAB==="clima" && CSUB!=="v3d"){ S.clima.modo=CSUB }
  return ok[0];
}
/* a barra de vistas do palco puxa a etapa correspondente */
function stepFromView(v){
  if(v==="gar"||v==="tipo"||v==="andar"){ if(TAB!=="projeto"||PSUB!==v){ PSUB=v; goStepQuiet("projeto") } }
  else if(v==="v3d"){ if(TAB!=="clima"||CSUB!=="v3d"){ CSUB="v3d"; goStepQuiet("clima") } }
  else if(v==="clima"){ const want=S.clima.modo==="vento"?"vento":"sol"; if(TAB!=="clima"||CSUB!==want){ CSUB=want; goStepQuiet("clima") } }
}
function goStepQuiet(k){ TAB=k; LS.set("gabarito.step",k); document.querySelectorAll("#rail [data-step]").forEach(b=>{ if(b.dataset.step===k) b.setAttribute("aria-current","page"); else b.removeAttribute("aria-current") }); renderTab() }

function renderTab(){
  const st=STEPS.find(s=>s.k===TAB), i=STEPS.indexOf(st), R=STEP_R[TAB]();
  document.getElementById("phead").innerHTML = `<div class="eb">Etapa ${i+1} de ${STEPS.length}</div><h1>${R.title||st.t}</h1><p>${R.desc||st.d}</p>${R.sub?`<div class="sub">${R.sub}</div>`:""}`;
  const keepScroll = TB.dataset.tab===TAB+(R.subKey||"") ? TB.scrollTop : 0;
  TB.innerHTML = R.body + cardsFor(TAB, curSub()).map(c=>c.html()).join(""); TB.dataset.tab=TAB+(R.subKey||"");
  const prev=STEPS[i-1], next=STEPS[i+1];
  document.getElementById("pfoot").innerHTML = `${prev?`<button class="btn ghost" data-act="go" data-k="${prev.k}">← ${prev.nome}</button>`:"<span></span>"}<span class="pill" id="footStat"></span>${next?`<button class="btn" data-act="go" data-k="${next.k}">${next.nome} →</button>`:"<span></span>"}`;
  restoreDetails();
  TB.querySelectorAll('input[type=range]').forEach(r=>{ if(typeof paintRange==="function") paintRange(r) });
  TB.scrollTop=keepScroll;
  update();
  if(R.after) R.after();
  cardsFor(TAB, curSub()).forEach(c=>{ if(c.after) try{ c.after() }catch(e){ console.error("[card "+c.key+"]",e) } });
}
function railStatus(m,f){
  const s=status(m,S), worst=(...a)=> a.includes("bad")?"bad": a.includes("warn")?"warn":"ok";
  const map = {
    terreno: m.A>10? "ok":"bad",
    regras: worst(s.ca==="warn"?"ok":s.ca, s.h, s.perm),
    produto: worst(s.tor, s.apto, s.vg),
    viab: f.margemVGV<0||f.margemVGV<S.metas.margem.min?"bad": f.margemVGV<S.fin.margemAlvo?"warn":"ok",   // margem s/ VGV · metas em S.metas
  };
  Object.entries(map).forEach(([k,v])=>{ const e=document.getElementById("st-"+k); if(e){ e.hidden=false; e.className="st "+v } });
  const fs=document.getElementById("footStat"); if(fs){ const v=map[TAB]; if(v){ fs.className="pill "+v; fs.textContent={ok:"em conformidade",warn:"atenção",bad:"ajustar"}[v] } else { fs.className="pill"; fs.textContent=TAB==="cen"? `${(LS.get("gabarito.cenarios2")||[]).length} salvos` : "estudo" } }
}

/* ================= ações ================= */
const ACT = {
  go: b=>goStep(b.dataset.k),
  psub: b=>{ PSUB=b.dataset.v; renderTab(); const w=stepView(); if(w) setView(w) },
  csub: b=>{ CSUB=b.dataset.v; if(CSUB!=="v3d") S.clima.modo=CSUB; renderTab(); const w=stepView(); if(w) setView(w); else if(VIEW==="clima"){ viewbarSegs(window._last.m); climaRun(); hintFor() } },
  view: b=>setView(b.dataset.v),
};

/* ================= atualização ================= */
let saveT, fullT, lastGar=null;
/* save(): grava a cópia de trabalho e marca uma mudança para o desfazer (histTouch) e para o repositório de estudos */
function save(){ clearTimeout(saveT); saveT=setTimeout(()=>LS.set("gabarito.v2",S),300); if(typeof histTouch==="function") histTouch() }
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
function renderKPIs(m,f){
  const s=status(m,S), sd=f.saude||saudeNegocio(S,m,f), sc=n=>({ruim:"bad",atencao:"warn",ok:"ok",otimo:"ok"})[n], mg=sc(sd.nivel.margem);
  // régua: rótulo (siglas abrem a explicação), valor e uma linha curta; o detalhe completo fica no title
  const k=(l,v,sub,st,tt)=>`<div class="kpi"${tt?` title="${esc(tt)}"`:""}><div class="l">${st?`<span class="dot ${st}"></span>`:""}${l}</div><div class="v">${v}</div><div class="s">${sub||"&nbsp;"}</div></div>`;
  const mic=v=>nf(v/1e6,1)+" mi", tor=`${m.T.length} torre${m.T.length>1?"s":""}`;
  const h =
    k("Terreno", m2(m.A), `perm. ${pct(m.perm,0)}`, s.perm, `Área do terreno · permeável ${pct(m.perm,0)}`) +
    k("Unidades", m.units, tor, s.apto==="bad"||s.tor!=="ok"? (s.apto==="bad"?"bad":s.tor) : "ok", `${m.units} unidades · ${tor}${m.lojaA?" + lojas":""}`) +
    k("Vagas", `${m.vagas}/${m.vagasReq}`, S.estudo.usarLayout?"pelo layout":"estimadas", s.vg, `${m.vagas} vagas ${S.estudo.usarLayout?"no layout":"estimadas"} · ${m.vagasReq} exigidas`) +
    k(TERMO("CA"), nf(m.CA,2), `máx ${nf(S.regras.caMax,1)}`, s.ca, `Coeficiente de aproveitamento · básico ${nf(S.regras.caBas,1)} · máximo ${nf(S.regras.caMax,1)}`) +
    k("Altura", nf(m.H,1)+" m", `máx ${nf(S.regras.hMax,0)} m`, s.h) +
    k(TERMO("VGV"), mi(f.vgv), `${mi(f.vgv/Math.max(1,m.units))}/un`, null, `Valor geral de vendas · ${mi(f.vgv/Math.max(1,m.units))} por unidade`) +
    k(TERMO("Eficiência global","Eficiência"), pct(sd.eficGlobal,0), `${nf(sd.faixaEfic[0]*100,0)}–${pct(sd.faixaEfic[1],0)}`, sc(sd.nivel.efic), `Área privativa ÷ construída · referência ${nf(sd.faixaEfic[0]*100,0)}–${pct(sd.faixaEfic[1],0)} (${sd.tipologiaNome})`) +
    k(TERMO("Margem s/ VGV","Margem"), pct(sd.margemVGV), `lucro ${mic(f.lucro)}`, mg, `Lucro ${mi(f.lucro)} · margem s/ VGV · meta ${pct(S.fin.margemAlvo,0)} · s/ receita ${pct(f.margem)}`) +
    k(TERMO("TIR","TIR a.a."), f.tirA==null?"—":pct(f.tirA), `VPL ${mic(f.vpl)}`, sc(sd.nivel.tir), `TIR ao ano · VPL ${mi(f.vpl)} · alvo ${pct(S.metas.tir.alvo,0)} · TMA ${pct(S.fin.tma,0)}`);
  const el=document.getElementById("kpis"); if(el.innerHTML!==h) el.innerHTML=h;
}
function renderLive(m,f,fast){ const fn=STEP_LIVE[TAB]; if(fn) fn(m,f,fast); cardsFor(TAB, curSub()).forEach(c=>{ if(c.live) try{ c.live(m,f,fast) }catch(e){ console.error("[card "+c.key+"]",e) } }) }
const curSub=()=> TAB==="projeto"? PSUB : TAB==="clima"? CSUB : (typeof subAtual==="function"? subAtual(TAB) : null);

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
  if(G.sArea(L.pts)<0){ const n=L.pts.length, mp=i=>((n-2-i)%n+n)%n; L.pts=L.pts.slice().reverse(); L.front=L.front.map(mp); L.principal=mp(L.principal); const r=L.rec.slice(); L.rec=r.map((_,i)=>r[mp(i)]) }
  if(!L.front.includes(L.principal)) L.principal=L.front[0]??0 }
function ensureRec(){ const L=S.lote; if(!Array.isArray(L.rec)) L.rec=[]; while(L.rec.length<L.pts.length) L.rec.push({}); if(L.rec.length>L.pts.length) L.rec.length=L.pts.length }
function edgeInsert(mI){ const L=S.lote; ensureRec(); L.front=L.front.flatMap(i=> i===mI?[i,i+1]: i>mI?[i+1]:[i]); if(L.principal>mI) L.principal++; L.rec.splice(mI+1,0,{...L.rec[mI]}) }
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
    ${ticks.map(v=>`<line x1="${pl}" x2="${W-pr}" y1="${sy(v)}" y2="${sy(v)}" stroke="var(--line)" ${v===0?'stroke-width="1.2"':'stroke-dasharray="2 3"'}/><text x="${pl-4}" y="${sy(v)+3}" font-size="9" text-anchor="end" fill="var(--muted)" font-family="IBM Plex Mono">${v===0?"0":nf(v/1e6,1)+"mi"}</text>`).join("")}
    <line x1="${xL}" x2="${xL}" y1="${pt}" y2="${H-pb}" stroke="var(--muted)" stroke-dasharray="3 3"/><text x="${xL+3}" y="${pt-6}" font-size="9" fill="var(--muted)">lançamento</text>
    <line x1="${xC}" x2="${xC}" y1="${pt}" y2="${H-pb}" stroke="var(--muted)" stroke-dasharray="3 3"/><text x="${perto? xC+3 : xC-3}" y="${perto? pt+6 : pt-6}" font-size="9" ${perto?"":'text-anchor="end"'} fill="var(--muted)">chaves</text>
    <path d="${ar}" fill="var(--accent)" fill-opacity=".12"/><path d="${path}" fill="none" stroke="var(--accent)" stroke-width="1.8"/>
    <circle cx="${sx(iMin)}" cy="${sy(cum[iMin])}" r="3" fill="var(--bad)"/><circle cx="${sx(n-1)}" cy="${sy(cum[n-1])}" r="3" fill="var(--accent)"/>
    <text x="${xE}" y="${sy(cum[iMin])+14}" text-anchor="middle" font-size="9" fill="var(--bad)" font-family="IBM Plex Mono">exposição ${mi(-cum[iMin])}</text>
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
    <text x="${c}" y="${c+44}" text-anchor="middle" font-size="9.5" fill="var(--muted)" font-family="IBM Plex Mono">vem de ${dirs.find(d=>d[1]===cur)?.[0]||nf(cur,0)+"°"}</text>
    ${dirs.map(([l,a])=>{ const [x,y]=pt(a,R); return `<g class="cd${a===cur?" on":""}" data-act="vdir" data-v="${a}" role="button" aria-label="${l}"><circle cx="${x}" cy="${y}" r="13"/><text x="${x}" y="${y}">${l}</text></g>` }).join("")}
  </svg></div>`;
}
ACT.vdir = b=>{ S.clima.ventoDir=+b.dataset.v; save(); if(VIEW==="v3d"){ cfdStart(true) } else { climaRun() } renderTab() };
