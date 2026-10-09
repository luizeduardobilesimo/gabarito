/* ================= modo apresentação e link somente leitura =================
   - "Apresentar" (topo) abre uma sobreposição em tela cheia, guiada em passos: maquete 3D animada → potencial do terreno →
     produto → tabela de vendas (m.unidades; sem ela, o mix) → números-chave. Sem campos editáveis. Avança por botão, teclado
     (setas, espaço, Home/End, Esc) e toque (deslizar).
   - O link somente leitura leva o estudo inteiro no hash da URL (#ver=…, ver calc/verlink.js). Abrir um endereço assim entra direto
     na apresentação, sem edição, e NADA é gravado no navegador de quem abre (LS.set fica desligado): o estudo salvo dele não muda.
   - Novos passos: AP_PASSOS.push({k, nome, slot:"off"|"full"|"side", html:(m,f)=>string, depois?:()=>void}) (slot = onde fica a maquete 3D). */
const APR = { on:false, ro:false, i:0, ult:null, viu:{}, cam:null };

/* guarda de leitura: roda já na carga, antes do main.js, para que nenhum save() grave nada */
(function apGuarda(){ try{ if(verDoHash(location.hash)){ APR.ro=true; document.documentElement.classList.add("ap-ro"); LS.set=()=>{} } }catch(e){} })();

const apBar = (v,st)=>`<div class="bar ${st||""}"><i style="width:${Math.max(2,Math.min(100,v*100)).toFixed(1)}%"></i></div>`;
const apUso = (l,v,txt,st)=>`<div class="ur"><span>${l}</span>${apBar(v,st)}<span>${txt}</span></div>`;
const apTile = (l,v,s,cls,hl)=>`<div class="aps-tile${hl?" hl":""}"><div class="l">${l}</div><div class="v ${cls||""}">${v}</div><div class="s">${s||"&nbsp;"}</div></div>`;
const apAviso = `<p class="aps-foot">Estudo preliminar de massa. Não substitui projeto legal, consulta de viabilidade na prefeitura nem orçamento executivo.</p>`;

/* ---------- conteúdo dos passos ---------- */
function apHtmlMaquete(m,f){
  return `<div class="aps aps-hero"><div class="aps-cap"><div class="eb">Estudo de viabilidade</div><h1>${esc(S.nome)}</h1>
    <p class="lead" style="margin:0">${esc(S.regras.cidade)}</p>
    <div class="aps-chips"><span><b>${m.units}</b> unidades</span><span><b>${m.T.length}</b> torre${m.T.length>1?"s":""}</span><span><b>${nf(m.H,0)} m</b> de altura</span><span><b>${m2(m.priv)}</b> privativos</span>${m.lojaA?"<span>com lojas no térreo</span>":""}</div></div></div>`;
}
function apHtmlPotencial(m,f){
  const R=S.regras, po=potencial(S,m);
  return `<div class="aps aps-split"><div class="aps-plan"><canvas id="apPlanta" aria-label="Implantação no lote"></canvas></div>
    <div class="aps-col"><div><div class="eb">Potencial do terreno</div><h2>${m2(po.priv)} privativos possíveis</h2>
      <p class="lead">Dentro das regras da prefeitura, este lote comporta cerca de ${po.un} unidades do mix, ${mi(po.vgv)} em VGV. Quem limita é ${po.limita==="ca"?"o coeficiente de aproveitamento":"a altura"}.</p></div>
      <div class="aps-tiles">${apTile("Terreno",m2(m.A),`permeável ${pct(m.perm,0)}`)}${apTile("Computável máx.",m2(po.compMax),`CA ${nf(R.caMax,1)} · básico ${nf(R.caBas,1)}`)}${apTile("Pavimentos tipo",`até ${po.pavH}`,`altura máx. ${nf(R.hMax,0)} m`)}</div>
      <div class="aps-card"><h3>Quanto deste potencial o projeto usa</h3><div class="aps-use">${apUso("CA usado",po.uso.ca,pct(po.uso.ca,0),po.uso.ca>1?"bad":"")}${apUso("Altura usada",po.uso.h,pct(po.uso.h,0),po.uso.h>1?"bad":"")}${apUso("Ocupação",po.uso.to,pct(po.uso.to,0),po.uso.to>1?"bad":"")}${apUso("Do potencial",po.uso.priv,pct(po.uso.priv,0),"ok")}</div></div></div></div>`;
}
function apDepoisPlanta(){
  const cv=document.getElementById("apPlanta"); if(!cv || !window._last) return;
  const r=cv.parentElement.getBoundingClientRect(); if(!r.width||!r.height) return;
  const dpr=Math.min(2,devicePixelRatio||1), W=Math.round(r.width), H=Math.round(r.height);
  cv.width=W*dpr; cv.height=H*dpr; const g=cv.getContext("2d"); g.setTransform(dpr,0,0,dpr,0,0);
  try{ drawPlan(g,W,H,fitView([S.lote.pts],W,H,1.35),"impl",window._last.m,{bg:false}) }catch(e){ console.error("[apresentação] planta",e) }
}
function apHtmlProduto(m,f){
  const P=S.produto, torres=m.T.map((t,i)=>`<tr><td>Torre ${i+1}</td><td class="n">${t.pav}</td><td class="n">${m2(t.A)}</td><td class="n">${t.units}</td><td class="n">${nf(t.H,1)} m</td></tr>`).join("");
  const mix=m.unitRows.map(u=>`<tr><td>${esc(u.nome)}</td><td class="n">${nf(u.n?u.area/u.n:0,0)} m²</td><td class="n">${u.n}</td><td class="n">${brl(u.preco)}/m²</td></tr>`).join("")
    + (m.cobN? `<tr><td>Coberturas${m.duplex?" (duplex)":""}</td><td class="n">${nf(m.cobArea/m.cobN,0)} m²</td><td class="n">${m.cobN}</td><td class="n">${brl(P.cob.preco)}/m²</td></tr>` : "")
    + (m.lojaA? `<tr><td>Lojas</td><td class="n">${m2(m.lojaPriv)}</td><td class="n">—</td><td class="n">${brl(S.fin.precoLoja)}/m²</td></tr>` : "");
  const lz=((P.lazer&&P.lazer.itens)||[]).map(i=>`<span class="pill">${esc(i.nome)}</span>`).join("");
  return `<div class="aps aps-prod"><div class="aps-col"><div><div class="eb">Produto</div><h2>${m.units} unidades em ${m.T.length} torre${m.T.length>1?"s":""}</h2></div>
    <div class="aps-card"><h3>Torres</h3><table class="aps-tbl"><tr><th>Torre</th><th class="n">Pav.</th><th class="n">Área/andar</th><th class="n">Un.</th><th class="n">Altura</th></tr>${torres}</table></div>
    <div class="aps-card"><h3>Tipologias</h3><table class="aps-tbl"><tr><th>Tipologia</th><th class="n">Área</th><th class="n">Un.</th><th class="n">Preço</th></tr>${mix}</table></div>
    <div class="aps-tiles two">${apTile("Área construída",m2(m.constr),`${m2(m.priv)} privativos`)}${apTile("Vagas",String(m.vagas),`exigidas ${m.vagasReq}`)}</div>
    ${lz?`<div class="aps-card"><h3>Lazer e áreas comuns</h3><div class="aps-pills">${lz}</div></div>`:""}</div><div></div></div>`;
}
function apVendasLista(m){ return Array.isArray(m.unidades) && m.unidades.length? m.unidades : null }
function apHtmlVendas(m,f){
  const un=apVendasLista(m);
  if(un){
    const L=un.slice().sort((a,b)=>(a.torre-b.torre)||(b.andar-a.andar)||(a.final-b.final)), tot=L.reduce((s,u)=>s+(+u.preco||0),0), area=L.reduce((s,u)=>s+(+u.area||0),0), sol=L.some(u=>u.sol&&isFinite(u.sol.media));
    const mn=Math.min(...L.map(u=>u.preco)), mx=Math.max(...L.map(u=>u.preco));
    return `<div class="aps"><div><div class="eb">Tabela de vendas</div><h2>${L.length} unidades, ${mi(tot)}</h2></div>
      <div class="aps-sum"><div><span class="l">Preço médio</span><span class="v">${brl(area?tot/area:0)}/m²</span></div><div><span class="l">Menor preço</span><span class="v">${mi(mn)}</span></div><div><span class="l">Maior preço</span><span class="v">${mi(mx)}</span></div></div>
      <div class="aps-tw" tabindex="0" role="region" aria-label="Tabela de vendas"><table class="aps-tbl"><tr><th>Torre</th><th class="n">Andar</th><th class="n">Final</th><th>Tipologia</th><th class="n">Área</th>${sol?'<th class="n">Sol médio</th>':""}<th class="n">R$/m²</th><th class="n">Preço</th></tr>
      ${L.map(u=>`<tr><td>T${u.torre}</td><td class="n">${u.andar}</td><td class="n">${u.final}</td><td>${esc(u.tipologia||"")}</td><td class="n">${nf(u.area,0)} m²</td>${sol?`<td class="n">${u.sol&&isFinite(u.sol.media)?`<i class="aps-sol"></i>${nf(u.sol.media,1)} h`:"—"}</td>`:""}<td class="n">${brl(u.precoM2||0)}</td><td class="n">${brl(u.preco)}</td></tr>`).join("")}</table></div>${apAviso}</div>`;
  }
  const P=S.produto, rows=m.unitRows.map(u=>({nome:u.nome, n:u.n, a:u.n?u.area/u.n:0, pm:u.preco, v:u.area*u.preco}));
  if(m.cobN) rows.push({nome:"Coberturas"+(m.duplex?" (duplex)":""), n:m.cobN, a:m.cobArea/m.cobN, pm:P.cob.preco, v:m.cobArea*P.cob.preco});
  if(m.lojaA) rows.push({nome:"Lojas", n:null, a:m.lojaPriv, pm:S.fin.precoLoja, v:m.lojaPriv*S.fin.precoLoja});
  return `<div class="aps"><div><div class="eb">Unidades à venda</div><h2>${mi(f.vgv)} em VGV</h2><p class="lead">Mix por tipologia, com preço por metro quadrado e VGV de cada uma.</p></div>
    <div class="aps-tw"><table class="aps-tbl"><tr><th>Tipologia</th><th class="n">Unidades</th><th class="n">Área média</th><th class="n">R$/m²</th><th class="n">VGV</th></tr>
    ${rows.map(r=>`<tr><td>${esc(r.nome)}</td><td class="n">${r.n==null?"—":r.n}</td><td class="n">${nf(r.a,0)} m²</td><td class="n">${brl(r.pm)}</td><td class="n">${mi(r.v)}</td></tr>`).join("")}
    <tr class="tot"><td>Total</td><td class="n">${m.units}</td><td class="n">${m2(m.priv)}</td><td class="n">${brl(m.priv?f.vgv/m.priv:0)}</td><td class="n">${mi(f.vgv)}</td></tr></table></div>${apAviso}</div>`;
}
function apHtmlNumeros(m,f){
  const F=S.fin, sd=f.saude||saudeNegocio(S,m,f), sc=n=>({ruim:"bad",atencao:"warn",ok:"ok",otimo:"ok"})[n], mg=sc(sd.nivel.margem), ti=sc(sd.nivel.tir), ef=sc(sd.nivel.efic);   // semáforos lidos de S.metas
  return `<div class="aps aps-split aps-num"><div class="aps-col"><div><div class="eb">Números-chave</div><h2>Resultado do empreendimento</h2></div>
    <div class="aps-tiles two">${apTile("VGV",mi(f.vgv),`${mi(f.vgv/Math.max(1,m.units))} por unidade`,"",true)}${apTile("Custo total",mi(f.custo),`${brl(f.custo/Math.max(1,m.constr))}/m² construído`)}${apTile("Lucro",mi(f.lucro),`sobre receita de ${mi(f.receita)}`,f.lucro<0?"bad":"")}
    ${apTile("Margem s/ VGV",pct(sd.margemVGV),`meta ${pct(F.margemAlvo,0)} · s/ receita ${pct(f.margem)}`,mg)}${apTile("TIR a.a.",f.tirA==null?"—":pct(f.tirA),`alvo ${pct(S.metas.tir.alvo,0)} · VPL ${mi(f.vpl)}`,ti)}${apTile("Eficiência",pct(sd.eficGlobal),`${nf(sd.faixaEfic[0]*100,0)}–${pct(sd.faixaEfic[1],0)} · ${sd.tipologiaNome}`,ef)}${apTile("Exposição máxima",mi(-f.exp),"pico de caixa negativo")}</div>
    ${apAviso}</div><div class="aps-col"><div class="aps-card"><h3>Fluxo de caixa acumulado</h3>${cashSVG(f)}</div></div></div>`;
}
const AP_PASSOS = [
  { k:"maquete",   nome:()=>"Maquete 3D",            slot:"full", html:apHtmlMaquete },
  { k:"potencial", nome:()=>"Potencial do terreno",  slot:"off",  html:apHtmlPotencial, depois:apDepoisPlanta },
  { k:"produto",   nome:()=>"Produto",              slot:"side", html:apHtmlProduto },
  { k:"vendas",    nome:m=>apVendasLista(m)? "Tabela de vendas" : "Unidades à venda", slot:"off", html:apHtmlVendas },
  { k:"numeros",   nome:()=>"Números-chave",        slot:"off",  html:apHtmlNumeros },
];
const apNome = (p,m)=> typeof p.nome==="function"? p.nome(m) : p.nome;

/* ---------- navegação e desenho ---------- */
const apEl = id => document.getElementById(id);
function apMarcaCor(){ return marcaOn() && verCorOk(S.marca.cor)? S.marca.cor : null }
function apMarca(){
  const on=marcaOn(), l=on? marcaLogo() : null, nome=on? String(S.marca.nome||"").trim() : "";
  apEl("apBrand").innerHTML = on && (l||nome)? `${l?`<img src="${l.url}" alt="">`:""}<span class="n">${esc(nome)}</span>`
    : `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="13" width="5" height="8" rx="1" fill="var(--ink)" opacity=".3"/><rect x="9.5" y="7" width="5" height="14" rx="1" fill="var(--ink)" opacity=".6"/><rect x="16" y="3" width="5" height="18" rx="1" fill="var(--accent)"/><path d="M2 21.5h20" stroke="var(--mark)" stroke-width="1.6" stroke-linecap="round"/></svg><span class="n">Gabarito</span>`;
  const c=apMarcaCor(); apEl("ap").style.setProperty("--ap-acc", c? `color-mix(in srgb, ${c} 72%, var(--ink))` : "var(--accent)");
}
function apRender(semAnim){
  if(!window._last) return; const {m,f}=window._last, p=AP_PASSOS[APR.i], box=apEl("apSlide"), top=box.scrollTop;
  APR.ult=window._last; APR.viu[APR.i]=1; if(V3.R && APR.cam) V3.R.shadowMap.needsUpdate=true;
  apEl("ap").dataset.slot=p.slot; box.classList.toggle("noanim",!!semAnim);
  try{ box.innerHTML=p.html(m,f) }catch(e){ console.error("[apresentação]",e); box.innerHTML=`<div class="aps"><h2>Não foi possível montar este passo</h2></div>` }
  box.scrollTop=semAnim? top : 0;
  apEl("apProg").innerHTML=AP_PASSOS.map((q,i)=>`<button type="button" data-ap="${i}" class="${APR.viu[i]?"vis":""}" ${i===APR.i?'aria-current="step"':""} aria-label="Passo ${i+1}: ${esc(apNome(q,m))}" title="${esc(apNome(q,m))}"></button>`).join("");
  const ult=APR.i===AP_PASSOS.length-1;
  apEl("apStep").innerHTML=`<b>${APR.i+1}</b> de ${AP_PASSOS.length} · ${esc(apNome(p,m))}`;
  apEl("apPrev").disabled=APR.i===0; apEl("apNext").disabled=false; apEl("apNext").textContent=ult? "Recomeçar ↺" : "Próximo →"; apEl("apNext").setAttribute("aria-label", ult? "Voltar ao primeiro passo" : "Próximo passo");
  requestAnimationFrame(()=>{ if(p.depois) p.depois() });
}
function apIr(i){ i=Math.max(0,Math.min(AP_PASSOS.length-1,i)); if(i===APR.i) return; APR.i=i; apRender() }
function apProx(){ if(APR.i>=AP_PASSOS.length-1){ APR.i=0; APR.viu={}; apRender() } else apIr(APR.i+1) }

/* maquete 3D: usa o mesmo canvas do estúdio, trazido para dentro da apresentação */
function apEnquadrar(){
  if(!V3.R || !window._last) return; const tg=V3.ctl.target, p=V3.cam.position, a0=Math.atan2(p.x-tg.x, p.z-tg.z);
  fit3d(window._last.m);
  const p2=V3.cam.position, t2=V3.ctl.target, dx=p2.x-t2.x, dz=p2.z-t2.z, da=a0-Math.atan2(dx,dz);
  p2.x=t2.x+dx*Math.cos(da)+dz*Math.sin(da); p2.z=t2.z-dx*Math.sin(da)+dz*Math.cos(da); V3.ctl.update(); render3();
}
function apEntra3d(){
  if(!V3.R) return; const c3=apEl("c3d");
  APR.cam={ pos:V3.cam.position.clone(), tg:V3.ctl.target.clone(), auto:V3.ctl.autoRotate, spd:V3.ctl.autoRotateSpeed, en:V3.ctl.enabled, hid:c3.hidden, corte:S.corte, view:VIEW, sombra:V3.R.shadowMap.autoUpdate, pr:V3.R.getPixelRatio() };
  if(VIEW!=="3d") setView("3d");
  if(S.corte){ S.corte=""; }
  rebuild3d(window._last.m,true);
  apEl("ap3d").appendChild(c3); c3.hidden=false;
  V3.R.shadowMap.autoUpdate=false; V3.R.shadowMap.needsUpdate=true; V3.R.setPixelRatio(Math.min(1.5,devicePixelRatio||1));   // cena parada: a sombra é calculada uma vez, só a câmera gira
  V3.ctl.enabled=false; V3.ctl.autoRotate=!matchMedia("(prefers-reduced-motion: reduce)").matches; V3.ctl.autoRotateSpeed=1.1;
  size3d(); fit3d(window._last.m);
  APR.rz=new ResizeObserver(()=>{ cancelAnimationFrame(APR.rzf); APR.rzf=requestAnimationFrame(()=>{ size3d(); apEnquadrar() }) }); APR.rz.observe(apEl("ap3d"));
}
function apSai3d(){
  if(!V3.R || !APR.cam) return; const c3=apEl("c3d"), v=apEl("view"), k=APR.cam;
  if(APR.rz){ APR.rz.disconnect(); APR.rz=null }
  v.insertBefore(c3, apEl("c2d")); c3.hidden=k.hid;
  V3.ctl.enabled=k.en; V3.ctl.autoRotate=k.auto; V3.ctl.autoRotateSpeed=k.spd; V3.R.shadowMap.autoUpdate=k.sombra; V3.R.shadowMap.needsUpdate=true; V3.R.setPixelRatio(k.pr);
  S.corte=k.corte; if(k.view!=="3d") setView(k.view); else rebuild3d(window._last.m,true);
  size3d(); V3.cam.position.copy(k.pos); V3.ctl.target.copy(k.tg); V3.ctl.update(); render3(); APR.cam=null;
}

/* entrar / sair */
function apEntrar(o={}){
  if(APR.on || !window._last) return;
  const ap=apEl("ap"); APR.on=true; APR.ro=!!o.ro || APR.ro; APR.i=Math.max(0,Math.min(AP_PASSOS.length-1,o.passo||0)); APR.viu={};
  APR.foco=document.activeElement; apEl("apMsg").hidden=true;
  document.querySelector(".app").inert=true;
  apEl("apSair").hidden=APR.ro; apEl("apAbrir").hidden=!APR.ro; apEl("apTela").hidden=!document.fullscreenEnabled;
  apMarca(); ap.hidden=false;
  apRender(); apEntra3d(); ap.focus({preventScroll:true});
  if(o.tela && document.fullscreenEnabled) ap.requestFullscreen({navigationUI:"hide"}).catch(()=>{});
  clearInterval(APR.vig); APR.vig=setInterval(()=>{ if(APR.on && window._last && window._last!==APR.ult) apRender(true) },900);   // refaz se um cálculo em segundo plano trouxer dados novos
  APR.mo=new MutationObserver(()=>{ clearTimeout(APR.mt); APR.mt=setTimeout(()=>{ if(APR.on) apRender(true) },140) }); APR.mo.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
}
function apSair(){
  if(!APR.on || APR.ro) return;
  if(document.fullscreenElement) document.exitFullscreen().catch(()=>{});
  APR.on=false; clearInterval(APR.vig); if(APR.mo){ APR.mo.disconnect(); APR.mo=null }
  apEl("ap").hidden=true; document.querySelector(".app").inert=false;
  apSai3d(); if(APR.foco && APR.foco.focus) try{ APR.foco.focus({preventScroll:true}) }catch(e){}
}
function apMensagem(titulo, texto, botao){
  const mg=apEl("apMsg"); mg.innerHTML=`<h2>${esc(titulo)}</h2><p>${esc(texto)}</p>${botao?`<div><button type="button" class="btn pri" id="apMsgBtn">${esc(botao)}</button></div>`:""}`; mg.hidden=false;
  const b=apEl("apMsgBtn"); if(b) b.addEventListener("click",apAbrirApp);
}
const apAbrirApp = ()=>{ location.replace(location.href.split("#")[0]) };

/* abre o link somente leitura (hash #ver=…) */
async function apBootRO(){
  const h=verDoHash(location.hash); if(!h) return;
  document.querySelector(".app").inert=true; apEl("ap").hidden=false; apEl("apSair").hidden=true; apEl("apAbrir").hidden=false; apEl("apTela").hidden=!document.fullscreenEnabled; apEl("apStep").textContent=""; apEl("apPrev").disabled=apEl("apNext").disabled=true;
  apMensagem("Abrindo a apresentação…","");
  try{
    const r=verAbrir(await verDecode(h.tok));
    S=r.S; BG=null; if(r.logo) marcaLogoTemp(r.logo);
    apEl("projName").value=S.nome; renderTab(); fit3d();
    if(typeof calcPronto==="function") await Promise.race([calcPronto(), new Promise(r=>setTimeout(r,25000))]).catch(()=>{});   // espera o cálculo completo (tabela de vendas) vindo do Worker
    apEntrar({ro:true, passo:h.passo});
  }catch(e){ console.warn("[link] ",e); apMensagem("Não consegui abrir este link","O endereço parece incompleto ou foi alterado. Peça um novo link a quem compartilhou o estudo.","Abrir o Gabarito") }
}

/* ---------- teclado, toque e botões ---------- */
function apTecla(e){
  if(!APR.on || e.ctrlKey || e.metaKey || e.altKey) return;
  const k=e.key, naBtn=!!(e.target.closest && e.target.closest("button")), sl=apEl("apSlide"), rola=sl.scrollHeight>sl.clientHeight+2;
  if(k==="ArrowRight" || ((k==="ArrowDown"||k==="PageDown") && !rola) || (k===" " && !naBtn)){ e.preventDefault(); apProx() }
  else if(k==="ArrowLeft" || ((k==="ArrowUp"||k==="PageUp") && !rola)){ e.preventDefault(); apIr(APR.i-1) }
  else if(k==="Home"){ e.preventDefault(); apIr(0) } else if(k==="End"){ e.preventDefault(); apIr(AP_PASSOS.length-1) }
  else if(k==="Escape"){ if(document.fullscreenElement){ document.exitFullscreen().catch(()=>{}) } else if(!APR.ro){ e.preventDefault(); apSair() } }
  else if(k==="f"||k==="F"){ if(!naBtn) apTela() }
}
function apTela(){
  if(document.fullscreenElement){ document.exitFullscreen().catch(()=>{}); return }
  if(!document.fullscreenEnabled){ toast("Tela cheia indisponível aqui"); return }
  apEl("ap").requestFullscreen({navigationUI:"hide"}).catch(()=>toast("Tela cheia indisponível aqui"));
}
function apInit(){
  apEl("apTop").addEventListener("click",()=>apEntrar({tela:true}));
  apEl("apSair").addEventListener("click",apSair); apEl("apAbrir").addEventListener("click",apAbrirApp); apEl("apTela").addEventListener("click",apTela);
  apEl("apPrev").addEventListener("click",()=>apIr(APR.i-1)); apEl("apNext").addEventListener("click",apProx);
  apEl("apTema").addEventListener("click",()=>apEl("themeBtn").click());
  apEl("apProg").addEventListener("click",e=>{ const b=e.target.closest("[data-ap]"); if(b) apIr(+b.dataset.ap) });
  document.addEventListener("keydown",apTecla);
  window.addEventListener("resize",()=>{ if(APR.on){ clearTimeout(APR.rt); APR.rt=setTimeout(()=>{ const p=AP_PASSOS[APR.i]; if(p.depois) p.depois() },120) } });
  const mn=apEl("apMain"); let sx=null, sy=0, st=0;
  mn.addEventListener("pointerdown",e=>{ const tw=e.target.closest(".aps-tw"); if(tw && tw.scrollWidth>tw.clientWidth+2){ sx=null; return } /* tabela que rola de lado: o gesto é dela */ sx=e.clientX; sy=e.clientY; st=Date.now() });
  mn.addEventListener("pointerup",e=>{ if(sx==null) return; const dx=e.clientX-sx, dy=e.clientY-sy; sx=null; if(Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)*1.5 && Date.now()-st<1800){ if(dx<0) apProx(); else apIr(APR.i-1) } });
  mn.addEventListener("pointercancel",()=>{ sx=null });
  apBootRO();
}
setTimeout(apInit,0);   // depois do main.js (que roda no mesmo carregamento)

/* ---------- link somente leitura (card na etapa Cenários) ---------- */
ACT.apStart = ()=>apEntrar({tela:true});
ACT.apLink = async ()=>{
  try{
    const url=await verCriar(location.href, S, await marcaLogoMini());
    apEl("apLinkBox").hidden=false; const out=apEl("apLinkOut"); out.value=url; out.select();
    apEl("apLinkInfo").textContent=`Link copiado · ${nf(url.length)} caracteres.${url.length>7500?" Longo: alguns aplicativos podem cortá-lo.":""}`;
    const fb=()=>{ try{ out.focus(); out.select(); document.execCommand("copy"); toast("Link copiado") }catch(e){ toast("Selecione o link e copie") } };
    try{ navigator.clipboard.writeText(url).then(()=>toast("Link somente leitura copiado"),fb) }catch(e){ fb() }
  }catch(e){ console.error("[link]",e); toast("Não consegui gerar o link") }
};
addCard("cen", { key:"apresentacao", order:20, sub:"entregar", html:()=>SEC("Apresentar e compartilhar",
  `<div class="btngrid"><button type="button" class="btn pri" data-act="apStart">Apresentar</button><button type="button" class="btn" data-act="apLink">Copiar link</button></div>
   <div id="apLinkBox" hidden><div class="inp"><input class="t" id="apLinkOut" readonly aria-label="Link somente leitura"></div><p class="note" id="apLinkInfo" style="margin-top:6px"></p></div>`,
  {key:"apresentacao", id:"cardApres", open:true, sum:"tela cheia · link",
   info:"Apresentar: passo a passo em tela cheia (maquete 3D, potencial, produto, vendas e números-chave). Copiar link: quem abre vê o estudo como está agora, sem poder editar; nada é enviado a servidor e o estudo salvo no aparelho dele não muda."}) });
