/* ================= busca global de campos (Ctrl+K · UX v3 §6.2) =================
   buscaAbrir(q?) → caixa de busca por cima do app (criada aqui, listener próprio; no celular ocupa a largura toda).
   O índice é montado sob demanda: cada etapa e sub-aba é desenhada num DOM solto (etapaR + cardsEtapa do ui.js, com
   TAB/PSUB/CSUB/SUBX trocados e devolvidos), e dali saem os campos (data-p / data-set, rótulo .fl, data-q), as seções
   (summary) e as ações (botões com texto). Resultado: "Campo · Etapa › Sub-aba › Seção"; Enter ou clique leva até lá
   (irPara quando existe; depois abre a seção e o "Mais opções", rola e foca o campo, com um realce rápido).
   Nada vai para S: a busca só lê o que as telas mostram. */
const BUSCA = { el:null, idx:null, quando:0, sel:0, res:[] };
const BUSCA_STOP = new Set(["de","da","do","das","dos","e","a","o","as","os","em","no","na","nos","nas","por","para","com","um","uma"]);
const buscaNorm = s=> String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[-\u2010\u2013\/]/g," ").replace(/\s+/g," ").trim();

(function buscaCSS(){ const s=document.createElement("style"); s.textContent=`
.bq{position:fixed;inset:0;z-index:72;display:flex;justify-content:center;align-items:flex-start;padding:min(12vh,96px) 16px 16px;background:rgba(10,10,12,.32);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
.bq[hidden]{display:none}
.bq-b{width:min(640px,100%);max-height:min(72vh,620px);display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:var(--surface);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow-pop);overflow:hidden;animation:nvIn .16s var(--ease) both}
.bq-i{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line)}
.bq-i svg{width:19px;height:19px;flex:none;fill:none;stroke:var(--muted);stroke-width:1.8;stroke-linecap:round}
.bq-i input{flex:1;min-width:0;border:0;outline:none;background:transparent;font-size:16px;font-weight:500;letter-spacing:-.01em;color:var(--ink)}
.bq-i input::placeholder{color:var(--faint);font-weight:400}
.bq kbd{font-family:var(--f-sans);font-size:11px;color:var(--faint);border:1px solid var(--line);border-radius:6px;padding:1px 6px;white-space:nowrap}
.bq-x{border:0;background:none;color:var(--muted);cursor:pointer;padding:0}
.bq-l{overflow:auto;padding:6px;display:grid;align-content:start;gap:1px;scrollbar-width:thin}
.bq-r{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 12px;align-items:center;width:100%;text-align:left;border:0;background:none;padding:9px 12px;border-radius:10px;cursor:pointer;font:inherit;color:var(--ink)}
.bq-r[aria-selected="true"]{background:var(--soft)}
.bq-r b{font-weight:600;font-size:14px;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bq-r b mark{background:none;color:inherit;text-decoration:underline;text-decoration-color:var(--brand);text-decoration-thickness:2px;text-underline-offset:3px}
.bq-r .c{grid-column:1;font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bq-r .t{grid-column:2;grid-row:1/3;font-size:11px;font-weight:600;color:var(--muted);background:var(--neutral-soft);border-radius:999px;padding:3px 8px}
.bq-v{padding:22px 14px;text-align:center;color:var(--muted);font-size:13px}
.bq-g{font-size:10.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);padding:10px 12px 4px}
.bq-f{display:flex;gap:14px;align-items:center;padding:9px 16px;border-top:1px solid var(--line);font-size:11.5px;color:var(--muted);background:var(--surface-2)}
.bq-luz{animation:bqLuz 1.6s var(--ease)}
@keyframes bqLuz{0%,35%{box-shadow:0 0 0 3px var(--brand-soft),0 0 0 1px var(--brand);border-radius:10px}100%{box-shadow:0 0 0 0 transparent}}
@media (max-width:900px){ .bq{padding:12px 8px;align-items:flex-start} .bq-b{max-height:calc(100% - 24px);border-radius:16px} .bq-f{display:none} .bq-r{min-height:52px} }
`; (document.body||document.head).appendChild(s) })();   // no fim do body: vem depois do CSS do shell (no test.html ele está no body)

/* telas a indexar: [{etapa, sub, rot, alt?}] (alt = sub-aba de outra chave que precisa ser escolhida antes, ex.: regras dentro de Terreno) */
function buscaTelas(){
  const out=[], salva={TAB, PSUB, CSUB, VMODO, subx: typeof SUBX!=="undefined"? {...SUBX} : {}};
  try{
    STEPS.forEach(s=>{
      let subs=[];
      if(s.k==="projeto") subs=PROJ_SUBS.map(([k,l])=>[k,l]).concat([["v3d","Vento › Túnel 3D"]]);
      else if(typeof subsDe==="function"){ try{ subs=(subsDe(s.k)||[]).map(x=>Array.isArray(x)? x : [x, ((typeof SUBDEF!=="undefined" && SUBDEF[s.k])||[]).find(y=>y[0]===x)?.[1] || x]) }catch(e){ subs=[] } }
      if(!subs.length && s.k!=="projeto"){ TAB=s.k; try{ etapaR() }catch(e){} if(typeof SUBDEF!=="undefined" && SUBDEF[s.k]) subs=SUBDEF[s.k].map(x=>[x[0],x[1]]) }
      if(!subs.length) out.push({etapa:s.k, sub:null, rot:s.nome});
      subs.forEach(([k,l])=>out.push({etapa:s.k, sub:k, rot:`${s.nome} › ${l}`}));
    });
  } finally { TAB=salva.TAB; PSUB=salva.PSUB; CSUB=salva.CSUB; VMODO=salva.VMODO; if(typeof SUBX!=="undefined"){ Object.keys(SUBX).forEach(k=>delete SUBX[k]); Object.assign(SUBX, salva.subx) } }
  return out;
}
/* html de uma tela, sem tocar no painel (estado de navegação trocado e devolvido) */
function buscaTelaHTML(t){
  const salva={TAB, PSUB, CSUB, VMODO, subx: typeof SUBX!=="undefined"? {...SUBX} : {}};
  try{
    TAB=t.etapa;
    if(t.etapa==="projeto"){ if(t.sub==="v3d"){ PSUB="vento"; CSUB="v3d" } else { PSUB=t.sub||"gar"; CSUB= PSUB==="sol"? "sol" : "vento" } }
    else if(t.sub && typeof SUBX!=="undefined") SUBX[t.etapa]=t.sub;
    if(t.alt && typeof SUBX!=="undefined") SUBX[t.alt[0]]=t.alt[1];
    const R=etapaR(); let h=R.body||"";
    cardsEtapa().forEach(c=>{ try{ h+=c.html() }catch(e){} });
    return h;
  } finally { TAB=salva.TAB; PSUB=salva.PSUB; CSUB=salva.CSUB; VMODO=salva.VMODO; if(typeof SUBX!=="undefined"){ Object.keys(SUBX).forEach(k=>delete SUBX[k]); Object.assign(SUBX, salva.subx) } }
}
const buscaTxt = el=>{ if(!el) return ""; const c=el.cloneNode(true); c.querySelectorAll(".info,.fsub,input,select,textarea,output,.sum").forEach(x=>x.remove()); return c.textContent.replace(/\s+/g," ").trim() };
function buscaRotulo(el){
  const sw=el.closest("label.sw"); if(sw) return buscaTxt(sw.querySelector("span:last-of-type"));
  const fld=el.closest(".fld,.sl"); if(fld){ const l=fld.querySelector(".fl, .slh label, label"); const t=buscaTxt(l); if(t) return t }
  if(el.dataset.set){ const row=el.closest(".row"); const l=row && row.querySelector(".fl"); const t=buscaTxt(l); if(t) return t + " · " + buscaTxt(el) }
  const al=el.getAttribute("aria-label"); if(al) return al;
  if(el.id){ const l=el.ownerDocument && el.closest(".cb,.card") && el.closest(".cb,.card").querySelector(`label[for="${el.id}"]`); if(l) return buscaTxt(l) }
  return "";
}
/* rótulo de grupo (GRP) logo antes do campo, dentro da seção (ex.: "Pés-direitos" › Térreo) */
function buscaGrupo(el){
  const fim=el.closest("details,section.card"); let n=el.closest(".kv,.fld,.sl,.sw,.row,.seg")||el;
  while(n && n!==fim){ for(let s=n.previousElementSibling; s; s=s.previousElementSibling){ if(s.classList && s.classList.contains("grp")) return buscaTxt(s) } n=n.parentElement }
  return "";
}
function buscaIndice(){
  if(BUSCA.idx && Date.now()-BUSCA.quando<15000) return BUSCA.idx;
  const idx=[], d=document.createElement("div"), vistos=new Set();
  buscaTelas().forEach(t=>{
    let h=""; try{ h=buscaTelaHTML(t) }catch(e){ return }
    d.innerHTML=h;
    const secDe=el=>{ const s=el.closest("details[data-key], section.card"); if(!s) return {key:null, tit:""}; const tt=s.querySelector(":scope > summary .st, :scope > summary > span, :scope > .ch h2"); return {key:s.dataset && s.dataset.key || null, tit: buscaTxt(tt)} };
    d.querySelectorAll("details[data-key]").forEach(s=>{ const tit=buscaTxt(s.querySelector(":scope > summary .st, :scope > summary > span")); if(!tit) return;
      const ch="sec|"+s.dataset.key+"|"+tit; if(vistos.has(ch)) return; vistos.add(ch); idx.push({tipo:"Seção", rot:tit, tela:t, sec:s.dataset.key, secT:"", q:buscaNorm(tit)}) });
    d.querySelectorAll("[data-p],[data-set]").forEach(el=>{
      const p=el.dataset.p||el.dataset.set, rot=buscaRotulo(el); if(!rot || !p) return;
      const sc=secDe(el), adv=el.closest(".adv"), qd=el.closest("[data-q]"), grp=buscaGrupo(el);
      const ch=p+"|"+rot; if(vistos.has(ch)) return; vistos.add(ch);
      idx.push({tipo:"Campo", rot, p, tela:t, sec:sc.key, secT: grp && grp!==sc.tit? (sc.tit? sc.tit+" › " : "")+grp : sc.tit, adv: adv? adv.dataset.adv : null, q:buscaNorm(rot+" "+grp+" "+(qd? qd.dataset.q : "")+" "+p.split(".").pop())});
    });
    d.querySelectorAll("button[data-act], label.btn").forEach(el=>{
      const rot=buscaTxt(el); if(!rot || rot.length<4 || /^[←→+−×▶❚]/.test(rot) && rot.length<6) return;
      if(el.closest(".subtabs,.seg")) return;
      const sc=secDe(el), ch="act|"+(el.dataset.act||"")+"|"+rot; if(vistos.has(ch)) return; vistos.add(ch);
      idx.push({tipo:"Ação", rot, act:el.dataset.act||null, tela:t, sec:sc.key, secT:sc.tit, adv: el.closest(".adv")? el.closest(".adv").dataset.adv : null, q:buscaNorm(rot)});
    });
  });
  d.innerHTML="";
  BUSCA.idx=idx; BUSCA.quando=Date.now(); return idx;
}
function buscaFiltra(q){
  const nq=buscaNorm(q), tok=nq.split(" ").filter(t=>t && !BUSCA_STOP.has(t)); if(!tok.length) return [];
  const out=[];
  buscaIndice().forEach(r=>{
    const rot=buscaNorm(r.rot), hay=r.q+" "+buscaNorm(r.secT)+" "+buscaNorm(r.tela.rot);
    if(!tok.every(t=>hay.includes(t))) return;
    let sc=0;
    if(rot.includes(nq)) sc+=100; if(rot.startsWith(tok[0])) sc+=20;
    tok.forEach(t=>{ if(rot.includes(t)) sc+=12; if(new RegExp("(^|\\s)"+t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).test(rot)) sc+=4; if(r.q.includes(t)) sc+=3 });
    sc += r.tipo==="Campo"? 6 : r.tipo==="Seção"? 3 : 0;
    out.push({r, sc});
  });
  return out.sort((a,b)=>b.sc-a.sc || a.r.rot.length-b.r.rot.length).slice(0,40).map(x=>x.r);
}
function buscaMarca(txt, q){
  const tok=buscaNorm(q).split(" ").filter(t=>t && !BUSCA_STOP.has(t)), n=buscaNorm(txt); let h="", i=0;
  // realça os trechos encontrados (mesmas posições no texto normalizado: só tiramos acentos, o comprimento não muda)
  const marcas=new Array(txt.length).fill(false);
  tok.forEach(t=>{ let k=n.indexOf(t); while(k>=0){ for(let j=k;j<k+t.length;j++) marcas[j]=true; k=n.indexOf(t,k+t.length) } });
  if(n.length!==txt.length) return esc(txt);
  while(i<txt.length){ const on=marcas[i]; let j=i; while(j<txt.length && marcas[j]===on) j++; const pedaco=esc(txt.slice(i,j)); h+= on? `<mark>${pedaco}</mark>` : pedaco; i=j }
  return h;
}
function buscaLista(){
  const q=BUSCA.el.querySelector("#buscaQ").value, l=BUSCA.el.querySelector("#buscaL");
  if(!q.trim()){ BUSCA.res=[]; l.innerHTML=`<div class="bq-v">Digite o nome de um campo, seção ou ação — por exemplo <b>recuo frontal</b>, <b>INCC</b> ou <b>largura da vaga</b>.</div>`; return }
  BUSCA.res=buscaFiltra(q); BUSCA.sel=0;
  l.innerHTML = BUSCA.res.length? BUSCA.res.map((r,i)=>`<button type="button" class="bq-r" role="option" id="bq-${i}" data-i="${i}" aria-selected="${i===0}"><b>${buscaMarca(r.rot,q)}</b><span class="c">${esc(r.tela.rot)}${r.secT && r.secT!==r.rot? " › "+esc(r.secT) : ""}</span><span class="t">${r.tipo}</span></button>`).join("")
    : `<div class="bq-v">Nada encontrado para “${esc(q)}”.</div>`;
}
function buscaMove(d){
  if(!BUSCA.res.length) return; BUSCA.sel=(BUSCA.sel+d+BUSCA.res.length)%BUSCA.res.length;
  BUSCA.el.querySelectorAll(".bq-r").forEach((b,i)=>b.setAttribute("aria-selected", i===BUSCA.sel));
  const b=BUSCA.el.querySelector(`#bq-${BUSCA.sel}`); if(b) b.scrollIntoView({block:"nearest"});
}
function buscaFecha(){ if(BUSCA.el) BUSCA.el.hidden=true }
function buscaAbrir(q=""){
  if(!BUSCA.el){
    const el=BUSCA.el=document.createElement("div"); el.className="bq"; el.id="buscaPop"; el.hidden=true;
    el.innerHTML=`<div class="bq-b" role="dialog" aria-modal="true" aria-label="Buscar campo"><div class="bq-i"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg><input id="buscaQ" placeholder="Buscar campo, seção ou ação…" autocomplete="off" spellcheck="false" aria-label="Buscar campo" role="combobox" aria-controls="buscaL" aria-expanded="true"><button type="button" class="bq-x" data-bqx aria-label="Fechar"><kbd>Esc</kbd></button></div><div class="bq-l" id="buscaL" role="listbox" aria-label="Resultados"></div><div class="bq-f"><span><kbd>↑</kbd> <kbd>↓</kbd> escolher</span><span><kbd>Enter</kbd> ir até o campo</span></div></div>`;
    document.body.appendChild(el);
    el.addEventListener("click", e=>{ if(e.target===el || e.target.closest("[data-bqx]")){ buscaFecha(); return } const r=e.target.closest(".bq-r"); if(r) buscaIr(BUSCA.res[+r.dataset.i]) });
    const inp=el.querySelector("#buscaQ");
    inp.addEventListener("input", ()=>buscaLista());
    inp.addEventListener("keydown", e=>{ if(e.key==="ArrowDown"){ e.preventDefault(); buscaMove(1) } else if(e.key==="ArrowUp"){ e.preventDefault(); buscaMove(-1) }
      else if(e.key==="Enter"){ e.preventDefault(); const r=BUSCA.res[BUSCA.sel]; if(r) buscaIr(r) } else if(e.key==="Escape"){ e.preventDefault(); e.stopPropagation(); buscaFecha() } });
  }
  BUSCA.idx=null;   // reconstrói (o estado pode ter mudado: seções que só aparecem com o recurso ligado)
  BUSCA.el.hidden=false; const inp=BUSCA.el.querySelector("#buscaQ"); inp.value=q; buscaLista(); setTimeout(()=>{ inp.focus(); inp.select() }, 20);
}
/* leva até o resultado: etapa, sub-aba, seção, "Mais opções", e foca o campo */
function buscaIr(r){
  if(!r) return; buscaFecha(); r._n=0;
  const t=r.tela;
  if(t.alt && typeof SUBX!=="undefined"){ SUBX[t.alt[0]]=t.alt[1]; LS.set("gabarito.subx",SUBX) }
  if(r.adv && typeof UXADV!=="undefined" && !UXADV[r.adv]){ UXADV[r.adv]=true; LS.set("gabarito.adv",UXADV) }
  if(r.sec){ const st=LS.get("gabarito.det")||{}; st[t.etapa+":"+r.sec]=1; LS.set("gabarito.det",st) }
  const sub = t.etapa==="projeto" && t.sub==="v3d"? "v3d" : t.sub;
  if(typeof irPara==="function"){ try{ irPara(t.etapa, sub||undefined, r.sec||undefined, r.p) }catch(e){ console.error("[busca] irPara", e); goStep(t.etapa, sub) } }
  else {
    if(t.etapa!=="projeto" && sub && typeof SUBX!=="undefined"){ SUBX[t.etapa]=sub; LS.set("gabarito.subx",SUBX) }
    if(t.etapa==="projeto" && sub==="v3d"){ VMODO="v3d" }
    goStep(t.etapa, t.etapa==="projeto"? sub : undefined);
    if(TAB===t.etapa) renderTab();
  }
  if(typeof folhaSet==="function" && typeof navCel==="function" && navCel()) folhaSet("cheia");
  setTimeout(()=>buscaFoca(r), 90);
}
function buscaFoca(r){
  let el=null;
  const sel = r.p? `[data-p="${r.p}"],[data-set="${r.p}"]` : null;
  const dentro = r.sec? document.querySelector(`#tabbody details[data-key="${r.sec}"]`) : null;
  if(sel){ const l=[...document.querySelectorAll("#tabbody "+sel.split(",").join(",#tabbody "))]; el = l.find(x=>r.sec && x.closest(`details[data-key="${r.sec}"]`)) || l[0] }
  else if(r.tipo==="Seção" && r.sec) el=document.querySelector(`#tabbody details[data-key="${r.sec}"]`);
  else if(r.tipo==="Ação"){ el=[...document.querySelectorAll("#tabbody button, #tabbody label.btn")].find(b=>buscaTxt(b)===r.rot) }
  if(!el){ if(dentro) dentro.scrollIntoView({block:"start", behavior:"smooth"}); return }
  // abre as seções e o "Mais opções" em volta
  let d=el.closest("details"); while(d){ d.open=true; d=d.parentElement && d.parentElement.closest("details") }
  const adv=el.closest(".advb"); if(adv && adv.hidden){ const b=adv.parentElement.querySelector(".advbtn"); if(b) b.click() }
  const alvo = el.tagName==="DETAILS"? el : el.closest(".fld,.sl,.sw,.row,.seg") || el;
  alvo.scrollIntoView({block:"center", behavior:"smooth"});
  alvo.classList.remove("bq-luz"); void alvo.offsetWidth; alvo.classList.add("bq-luz"); setTimeout(()=>alvo.classList.remove("bq-luz"), 1700);
  if(el.matches("input,select,textarea") && !el.disabled) setTimeout(()=>{ try{ el.focus({preventScroll:true}); if(el.select && el.type!=="range") el.select() }catch(e){} }, 260);
  else if(el.matches("button")) el.focus({preventScroll:true});
  // o painel pode ser redesenhado logo depois (resultado do cálculo, seção que monta ao abrir): confere e foca de novo
  const n=(r._n||0); if(n<3) setTimeout(()=>{ if(!el.isConnected || (el.matches("input,select,textarea") && document.activeElement!==el)){ r._n=n+1; buscaFoca(r) } }, 520);
  else r._n=0;
}
document.addEventListener("keydown", e=>{
  if((e.ctrlKey||e.metaKey) && !e.altKey && (e.key==="k"||e.key==="K")){
    if(document.documentElement.classList.contains("ap-ro")) return;
    e.preventDefault(); e.stopPropagation(); if(BUSCA.el && !BUSCA.el.hidden) buscaFecha(); else buscaAbrir();
  }
}, true);
