/* ================= UX v2: componentes compartilhados do inspetor (ver docs/UX.md) =================
   SEC(título, corpo, {key, open, sum, info, id, cls})  → seção recolhível padrão, com resumo do conteúdo no cabeçalho
   RES(título, corpo, {id, aside})                       → bloco de resultado (fixo, sem campos), sempre no topo da etapa
   ADV(corpo, {key, label})                              → "Mais opções": campos avançados escondidos até o usuário pedir
   INFO(termo|texto)                                     → botão ⓘ que abre a explicação (glossário GLOSS ou o texto passado)
   TERMO(sigla, rótulo?)                                 → sigla sublinhada no texto que abre a explicação ao clicar
   SUBTABS(etapa, [[k,rótulo]…])                         → sub-abas de uma etapa (vão em R.sub); subAtual(etapa) → aba ativa
   setSum(key, html)                                     → atualiza o resumo de uma seção sem recriar o painel
   SECGRP(título)                                        → rótulo de grupo entre seções (classe secgrp; UX v3)
   Glossário completo: botão "Glossário" no topo (abreGlossario()). */

/* ---------- seções ---------- */
function SEC(title, body, o={}){
  const key=o.key||title;
  return `<details class="card sec${o.cls?" "+o.cls:""}" data-key="${esc(key)}" ${o.open?"open":""} ${o.id?`id="${o.id}"`:""} ${o.hidden?"hidden":""}><summary><span class="st">${title}</span>${o.info?INFO(o.info):""}<span class="sum" id="sum-${esc(key)}">${o.sum||""}</span></summary><div class="cb">${body}</div></details>`;
}
function RES(title, body, o={}){
  return `<section class="card res${o.cls?" "+o.cls:""}" ${o.id?`id="${o.id}"`:""}><div class="ch"><h2>${title}</h2>${o.aside!=null?`<span class="aside" ${o.asideId?`id="${o.asideId}"`:""}>${o.aside}</span>`:""}</div><div class="cb">${body}</div></section>`;
}
function setSum(key, html){ const e=document.getElementById("sum-"+key); if(e && e.innerHTML!==html) e.innerHTML=html }
/* rótulo de grupo entre seções (UX v3): SECGRP("Custos") + SEC(…) + SEC(…) + SECGRP("Receitas") + … — só marcação, sem estado */
function SECGRP(title){ return `<div class="secgrp" role="heading" aria-level="3">${title}</div>` }
(function secgrpCss(){ const s=document.createElement("style"); s.textContent=`
.pbody>.secgrp{font-family:var(--f-display);font-variation-settings:"wdth" 118;font-size:10px;font-weight:650;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);display:flex;gap:8px;align-items:center;margin:6px 2px -4px}
.pbody>.secgrp::after{content:"";flex:1;height:1px;background:var(--line)}
.pbody>.secgrp:first-child{margin-top:0}
.pbody>.secgrp[hidden]{display:none}
`; document.head.appendChild(s) })();

/* ---------- mais opções ---------- */
const UXADV = LS.get("gabarito.adv") || {};
function ADV(body, o={}){
  const k=(typeof TAB!=="undefined"?TAB:"")+":"+(o.key||"adv"), aberto=!!UXADV[k];
  return `<div class="adv" data-adv="${esc(k)}" ${o.label?`data-l="${esc(o.label)}"`:""} ${o.fechar?`data-lf="${esc(o.fechar)}"`:""}><button type="button" class="advbtn" data-act="advTog" aria-expanded="${aberto}">${aberto? (o.fechar||(o.label?o.label:"Menos opções")) : (o.label||"Mais opções")}</button><div class="advb" ${aberto?"":"hidden"}>${body}</div></div>`;
}

/* ---------- ajuda ---------- */
const GLOSS = (typeof GLOSS_DATA!=="undefined")? GLOSS_DATA : {};
function glossKey(t){ if(t==null) return null; const s=String(t); if(GLOSS[s]) return s; const u=s.toUpperCase(); return GLOSS[u]? u : null }
function INFO(t, rot){
  if(!t) return "";
  const k=glossKey(t), nome = k? (GLOSS[k].t||k) : (rot||"esta opção");
  return `<button type="button" class="info" data-info="${esc(k||t)}" aria-label="O que é ${esc(nome)}?" aria-expanded="false">i</button>`;
}
function TERMO(sigla, rot){ return `<button type="button" class="termo" data-info="${esc(sigla)}">${rot||sigla}</button>` }

let POP=null, POPDE=null;
function popFecha(){ if(POP) POP.hidden=true; if(POPDE){ POPDE.setAttribute("aria-expanded","false"); POPDE=null } }
function popAbre(el){
  if(!POP){ POP=document.createElement("div"); POP.className="pop"; POP.id="uxPop"; POP.setAttribute("role","dialog"); POP.hidden=true; document.body.appendChild(POP) }
  if(POPDE===el){ popFecha(); return }
  popFecha();
  const raw=el.dataset.info, k=glossKey(raw), g=k? GLOSS[k] : null;
  POP.innerHTML = `<button type="button" class="x" aria-label="Fechar">×</button>` + (g
    ? `<h4>${esc(g.t||k)}</h4><div>${g.d}</div>${g.f?`<div class="f">${g.f}</div>`:""}${g.ex?`<div class="ex">${g.ex}</div>`:""}`
    : `<div>${esc(raw)}</div>`);
  POP.hidden=false; POPDE=el; el.setAttribute("aria-expanded","true");
  if(matchMedia("(max-width:900px)").matches){ POP.style.left=""; POP.style.top=""; return }
  const r=el.getBoundingClientRect(), pw=POP.offsetWidth, ph=POP.offsetHeight;
  let x=Math.min(innerWidth-pw-12, Math.max(12, r.left-12)), y=r.bottom+8; if(y+ph>innerHeight-12) y=Math.max(12, r.top-ph-8);
  POP.style.left=x+"px"; POP.style.top=y+"px";
}
document.addEventListener("click", e=>{
  const i=e.target.closest("[data-info]");
  if(i){ e.preventDefault(); e.stopPropagation(); popAbre(i); return }
  if(POP && !POP.hidden && (!POP.contains(e.target) || e.target.closest(".x"))) popFecha();
}, true);
document.addEventListener("keydown", e=>{ if(e.key==="Escape"){ popFecha(); const g=document.getElementById("uxGloss"); if(g && !g.hidden) g.hidden=true } });
document.addEventListener("scroll", ()=>popFecha(), true);

/* ---------- glossário completo ---------- */
function abreGlossario(q=""){
  let g=document.getElementById("uxGloss");
  if(!g){ g=document.createElement("div"); g.className="gloss"; g.id="uxGloss"; g.hidden=true;
    g.innerHTML=`<div class="gb" role="dialog" aria-modal="true" aria-labelledby="glossT"><div class="gh"><h3 id="glossT">Glossário</h3><button type="button" class="btn ghost sm" data-gx>Fechar</button></div>
      <div class="gs"><div class="inp"><input class="t" id="glossQ" placeholder="Buscar termo — CA, VGV, recuo, CUB…" aria-label="Buscar termo" autocomplete="off"></div></div><div class="gl" id="glossL"></div></div>`;
    document.body.appendChild(g);
    g.addEventListener("click", e=>{ if(e.target===g || e.target.closest("[data-gx]")) g.hidden=true });
    g.querySelector("#glossQ").addEventListener("input", e=>glossLista(e.target.value)); }
  g.hidden=false; const inp=g.querySelector("#glossQ"); inp.value=q; glossLista(q); setTimeout(()=>inp.focus(),30);
}
function glossLista(q){
  const n=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,""), qq=n(q);
  const l=Object.entries(GLOSS).filter(([k,g])=>!qq || n(k+" "+g.t+" "+g.d).includes(qq)).sort((a,b)=>n(a[1].t||a[0]).localeCompare(n(b[1].t||b[0])));
  document.getElementById("glossL").innerHTML = l.length? l.map(([k,g])=>`<div class="gi"><b>${esc(g.t||k)}</b>${g.t&&g.t!==k?` <span class="pill">${esc(k)}</span>`:""}<p>${g.d}</p>${g.f?`<div class="note" style="font-family:var(--f-mono)">${g.f}</div>`:""}</div>`).join("") : `<p class="note">Nada encontrado.</p>`;
}
(function botaoGlossario(){
  const acts=document.querySelector(".top .acts"); if(!acts || document.getElementById("glossBtn")) return;
  const b=document.createElement("button"); b.className="btn ghost"; b.id="glossBtn"; b.type="button"; b.title="Glossário de termos e siglas";
  b.innerHTML=`<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style="fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></svg><span class="tl">Glossário</span>`;
  b.addEventListener("click",()=>abreGlossario()); acts.insertBefore(b, acts.firstChild);
})();

/* ---------- sub-abas genéricas ---------- */
const SUBX = LS.get("gabarito.subx") || {};
const SUBDEF = {};
function subAtual(step){ const o=SUBDEF[step]; if(!o) return null; const v=SUBX[step]; return o.some(x=>x[0]===v)? v : o[0][0] }
function SUBTABS(step, opts){
  SUBDEF[step]=opts; const cur=subAtual(step);
  return `<div class="seg full subtabs" role="tablist" aria-label="Seções da etapa">${opts.map(([k,l])=>`<button type="button" role="tab" data-act="subx" data-s="${step}" data-v="${k}" aria-pressed="${cur===k}" aria-selected="${cur===k}">${l}</button>`).join("")}</div>`;
}

Object.assign(ACT, {
  advTog: b=>{ const w=b.closest(".adv"), k=w.dataset.adv, d=w.querySelector(".advb"), on=d.hidden; d.hidden=!on; b.setAttribute("aria-expanded",on); b.textContent=on? (w.dataset.lf||w.dataset.l||"Menos opções") : (w.dataset.l||"Mais opções"); UXADV[k]=on; LS.set("gabarito.adv",UXADV);
    if(on) d.querySelectorAll('input[type=range]').forEach(r=>{ if(typeof paintRange==="function") paintRange(r) }) },
  subx: b=>{ SUBX[b.dataset.s]=b.dataset.v; LS.set("gabarito.subx",SUBX); renderTab(); TB.scrollTop=0; const w=stepView(); if(w && w!==VIEW) setView(w) },
  gloss: ()=>abreGlossario(),
});
