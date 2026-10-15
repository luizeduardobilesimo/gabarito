/* ================= C1/C2 — forma livre da torre e pilha de blocos (interface) =================
   Produto › seção "Forma das torres" (blcSecHTML, atualizada por blcLive no STEP_LIVE do Produto):
     Automática | Desenhada · por torre: "Personalizar" (copia a forma automática — nada muda nos números).
     C2: torre aberta = lista compacta de blocos, de cima para baixo ("10º–17º · 392 m²", silhueta proporcional à área,
     "tipo" no bloco de referência); bloco aberto = andar inicial (stepper), formatos prontos, "Copiar do de baixo",
     "Recuar X m", "Editar na implantação", "Ver andar", "Apagar bloco". Rodapé da torre: "+ Bloco", "Apagar forma".
   Implantação (ferramenta Editar), com as MESMAS interações e o mesmo visual do entorno (src/ui/entorno.js), agindo no
   bloco ATIVO de cada torre (BLC.k[i]; padrão = bloco de referência): clique = seleciona (clicar num bloco de baixo/cima
   troca o ativo) · arrastar = move · quadrado do canto = redimensiona · setas = ajuste fino · Delete = apaga o bloco
   (o último bloco apagado volta a torre à automática) · Esc = solta · vértice: arraste (clique duplo remove) · ponto no
   meio do lado = vértice novo. Barra flutuante #blcBar (classe .entbar): ±tamanho, giro 15°, pátio, duplicar, apagar.
   Destaques: bloco ativo forte, os outros blocos em contorno discreto; parte sobre os recuos (hachura vermelha), balanço
   (hachura amarela), núcleo fora/cortado. Vista Andares: o andar mostra o layout do bloco (f.lay), terraço sobre o bloco
   de baixo e o núcleo cortado em vermelho. Cálculo em src/calc/blocos.js. A seleção (BLC) não entra no estudo nem no desfazer. */
const BLC = { sel:-1, open:-1, sig:"", solta:false, k:{}, bopen:"", rec:3 };
const BLC_NOMES = { auto:"personalizada", ret:"retângulo", L:"em L", U:"em U", T:"em T", H:"em H", patio:"com pátio", recuo:"recuada" };
const blcM = () => window._last && window._last.m;
const blcLst = i => (((S.blocos||{}).torres||[])[i]||{}).blocos || [];
/* bloco ativo da torre i (o que a implantação edita): o escolhido, senão o de referência, senão o 1º */
function blcK(i){ const L=blcLst(i), k=BLC.k[i]; if(k!=null && blcValido(L[k])) return k; const m=blcM(), r=m && m.T && m.T[i] ? m.T[i].blcRef : null; return r!=null && blcValido(L[r]) ? r : 0 }
const blcB = i => blcBloco(S, i, blcK(i));
const blcLista = () => blcAtivo(S) ? S.produto.torres.map((_,i)=>i).filter(i=>blcB(i)) : [];
/* vértices editáveis (views.js → editables/hitVertex): só o bloco ativo de cada torre */
function blcEditaveis(){ if(typeof VIEW==="undefined" || VIEW!=="impl") return []; const out=[];
  blcLista().forEach(i=>{ const b=blcB(i); out.push({arr:b.pts, kind:"bloco"}); (b.vazios||[]).forEach(v=>out.push({arr:v, kind:"blcvazio"})) }); return out }
const blcDoArr = arr => blcLista().find(i=>{ const b=blcB(i); return b.pts===arr || (b.vazios||[]).includes(arr) }) ?? -1;
function blcSel(i){ BLC.sel=i; if(i>=0 && typeof ENT!=="undefined" && ENT.sel.size){ ENT.sel=new Set(); if(typeof entCardRefresh==="function") entCardRefresh() } redraw2d() }
const blcCopia = b => JSON.parse(JSON.stringify({pts:b.pts, vazios:b.vazios||[]}));
/* faixa (bloco) k da torre i no modelo: {de, ate, A, ...} — com um bloco só, a torre inteira */
function blcFx(m, i, k){ const t=m && m.T && m.T[i]; if(!t) return null; const f=(t.faixas||[]).find(f=>f.bk===k); if(f) return f;
  return k===(t.blcRef??0) ? {de:1, ate:t.pav, A:t.A, n:t.pav, un:t.units, ref:true} : null }
const blcRot = f => !f ? "—" : f.de===f.ate ? `${f.de}º` : `${f.de}º–${f.ate}º`;

/* ---------- ponteiro (chamado por entDown/entDrag/entUp em src/ui/entorno.js) ---------- */
function blcEscalaPos(b){ const bb=entBBox(b); return [bb[2], bb[1]] }
function blcHitEscala(px,py){ const b=BLC.sel>=0 && blcB(BLC.sel); if(!b) return false; const [x,y]=w2s_(blcEscalaPos(b)); return Math.hypot(x-px,y-py)<11 }
function blcHitMeio(px,py){ const b=BLC.sel>=0 && blcB(BLC.sel); if(!b) return null; let best=null, bd=10;
  [b.pts, ...(b.vazios||[])].forEach(arr=>arr.forEach((a,k)=>{ const c=arr[(k+1)%arr.length], A=w2s_(a), B=w2s_(c), d=Math.hypot((A[0]+B[0])/2-px,(A[1]+B[1])/2-py); if(d<bd){ bd=d; best={arr,k} } })); return best }
/* bloco sob o ponteiro: primeiro os ativos; senão qualquer bloco (o menor que contém o ponto) */
function blcCorpo(w){ let best=null, ba=Infinity; const tenta=(i,k,b)=>{ if(blcValido(b) && G.pip(w,b.pts)){ const a=G.area(b.pts); if(a<ba){ ba=a; best={i,k} } } };
  blcLista().forEach(i=>tenta(i, blcK(i), blcB(i))); if(best) return best;
  blcLista().forEach(i=>blcLst(i).forEach((b,k)=>tenta(i,k,b))); return best }
function blcDown(ev, px, py, w){
  if(!blcAtivo(S) || VIEW!=="impl" || TOOL!=="edit") return null;
  if(!blcLista().length){ BLC.sel=-1; return null }
  BLC.solta=false;
  if(blcHitEscala(px,py)){ const i=BLC.sel, b=blcB(i), c=entCentro(b), e=blcEscalaPos(b); return {type:"entBlcEscala", blc:true, i, c, d0:Math.max(1e-6,Math.hypot(e[0]-c[0],e[1]-c[1])), snap:blcCopia(b)} }
  const v=hitVertex(px,py);
  if(v){ if(v.kind==="bloco"||v.kind==="blcvazio"){ const i=blcDoArr(v.arr); if(i>=0 && i!==BLC.sel) blcSel(i) } return null }   // o fluxo normal arrasta o vértice
  const mi=blcHitMeio(px,py);
  if(mi){ const a=mi.arr[mi.k], c=mi.arr[(mi.k+1)%mi.arr.length]; mi.arr.splice(mi.k+1,0,[(a[0]+c[0])/2,(a[1]+c[1])/2]); return {type:"v", arr:mi.arr, i:mi.k+1, kind:"bloco"} }
  if(hitMid(px,py)>=0) return null;                                           // ponto do meio do lote tem prioridade
  const c=blcCorpo(w);
  if(c){ if(c.i!==BLC.sel || c.k!==blcK(c.i)){ BLC.k[c.i]=c.k; BLC.bopen= BLC.open===c.i ? c.i+":"+c.k : BLC.bopen; blcSel(c.i); const m=blcM(); if(m && TAB==="produto") blcLive(m) }
    return {type:"entBlcMove", blc:true, i:c.i, last:w, moved:false} }
  if(BLC.sel>=0) BLC.solta=true;                                              // clique sem arrastar no vazio solta (blcPanUp)
  return null;
}
function blcDrag(d, px, py){
  const w=s2w_(px,py), b=blcB(d.i); if(!b) return;
  if(d.type==="entBlcMove"){ const dx=w[0]-d.last[0], dy=w[1]-d.last[1]; if(!d.moved && Math.hypot(dx,dy)*cur().s<3) return; d.moved=true; entMove(b,dx,dy); d.last=w; update({fast:true}) }
  else if(d.type==="entBlcEscala"){ const k=Math.max(0.1, Math.hypot(w[0]-d.c[0], w[1]-d.c[1])/d.d0), s=d.snap, f=(q,o)=>{ q[0]=d.c[0]+(o[0]-d.c[0])*k; q[1]=d.c[1]+(o[1]-d.c[1])*k };
    b.pts.forEach((q,j)=>f(q,s.pts[j])); (b.vazios||[]).forEach((v,j)=>v.forEach((q,n)=>f(q,s.vazios[j][n]))); d.moved=true; update({fast:true}) }
}
function blcUp(d){ if(d.moved) update(); blcBarRefresh(); return true }
function blcPanUp(d){ if(BLC.solta && !d.moved && BLC.sel>=0){ BLC.sel=-1; redraw2d() } BLC.solta=false }
/* clique duplo num vértice da forma remove (mínimo de 3) */
c2.addEventListener("dblclick",e=>{ if(VIEW!=="impl"||TOOL!=="edit"||!blcAtivo(S)) return; const [px,py]=pos(e), v=hitVertex(px,py);
  if(v && (v.kind==="bloco"||v.kind==="blcvazio") && v.arr.length>3){ v.arr.splice(v.i,1); update(); toast("Vértice removido") } });
/* teclado: Delete apaga o bloco ativo, Esc solta, setas movem (Shift = 5 m) */
document.addEventListener("keydown",e=>{
  if(typeof VIEW==="undefined" || VIEW!=="impl" || TOOL!=="edit" || BLC.sel<0 || !blcB(BLC.sel)) return;
  const a=document.activeElement; if(a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)) return;
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  if(e.key==="Delete"||e.key==="Backspace"){ e.preventDefault(); blcApagaAtivo(BLC.sel); return }
  if(e.key==="Escape"){ BLC.sel=-1; redraw2d(); return }
  const dd={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]}[e.key];
  if(dd){ e.preventDefault(); const p=e.shiftKey?5:0.5; entMove(blcB(BLC.sel),dd[0]*p,dd[1]*p); clearTimeout(blcTecla.t); blcTecla.t=setTimeout(()=>update(),200); update({fast:true}) }
});
const blcTecla={ t:0 };

/* ---------- ações ---------- */
function blcGarante(i){ const B=S.blocos; B.torres=B.torres||[]; while(B.torres.length<=i) B.torres.push({blocos:[]}); return B.torres[i] }
function blcApaga(i){ const t=(S.blocos.torres||[])[i]; if(!t || !t.blocos.length) return; t.blocos=[]; delete BLC.k[i]; if(BLC.sel===i) BLC.sel=-1; update(); toast(`Torre ${i+1} voltou à forma automática — Ctrl+Z desfaz`) }
/* apaga um bloco da pilha; com um bloco só, a torre volta à automática */
function blcApagaUm(i, k){ const L=blcLst(i); if(L.length<2){ blcApaga(i); return } const rot=blcRot(blcFx(blcM(), i, k));
  if(!blcApagaBloco(S, i, k)) return; delete BLC.k[i]; BLC.bopen=""; update(); toast(`Bloco ${rot} apagado — o de baixo sobe até o próximo · Ctrl+Z desfaz`) }
function blcApagaAtivo(i){ blcApagaUm(i, blcK(i)) }
/* mudanças na lista de torres (src/ui/produto.js): mantém o índice dos blocos alinhado com S.produto.torres */
function blcTorreNova(i){ const B=S.blocos; if(B && B.torres && B.torres[i]) B.torres[i]={blocos:[]} }
function blcTorreRemovida(i){ const B=S.blocos; if(B && B.torres && i<B.torres.length) B.torres.splice(i,1); BLC.sel=-1; BLC.open=-1; BLC.k={}; BLC.bopen="" }
function blcEnquadra(i){ const L=blcLst(i).filter(blcValido); if(!L.length) return; if(VIEW!=="impl") setView("impl"); const r=c2.getBoundingClientRect(); if(r.width) VS.impl=fitView([S.lote.pts, ...L.map(b=>b.pts)], r.width, r.height, 1.5); redraw2d() }
/* abre a vista Andares no 1º andar de um bloco */
function blcVerAndar(i, k){ const m=blcM(), f=blcFx(m, i, k); if(!f){ toast("Esse bloco está fora da torre — aumente os pavimentos"); return }
  ANDAR="p"+f.de; if(VIEW!=="andar") setView("andar"); else { if(typeof viewbarSegs==="function") viewbarSegs(m); redraw2d(); if(typeof planLegend==="function") planLegend() } }
const blcIK = b => { const [i,k]=String(b.dataset.i).split(".").map(Number); return {i, k: isFinite(k)? k : +(b.dataset.k||0)} };
Object.assign(ACT,{
  blcTog: b=>{ const i=+b.dataset.i; BLC.open = BLC.open===i? -1 : i; const m=blcM(); if(m) blcLive(m) },
  blcBk: b=>{ const i=+b.dataset.i, k=+b.dataset.k, key=i+":"+k; BLC.k[i]=k; BLC.bopen = BLC.bopen===key ? "" : key;
    if(VIEW==="impl"){ BLC.sel=i; redraw2d() } else if(VIEW==="andar" && BLC.bopen) blcVerAndar(i, k);
    const m=blcM(); if(m) blcLive(m) },
  blcPers: b=>{ const i=+b.dataset.i; if(!blcPersonaliza(S,i)){ toast("Esta torre ainda não tem forma para copiar"); return } BLC.open=i; delete BLC.k[i]; update();
    toast(`Torre ${i+1} personalizada — a privativa passa a ser a das unidades desenhadas (eficiência real da planta)`) },
  blcFmt: b=>{ const {i,k}=blcIK(b), t=b.dataset.t, m=blcM(), f=blcFx(m,i,k), alvo=f? f.A : 0, r=blcAplicaFormato(S,i,t,k); if(!r){ toast("Esse formato não coube"); return }
    BLC.open=i; BLC.k[i]=k; update(); const nome=(BLC_FORMAS.find(f=>f[0]===t)||[])[1]||t;
    toast(r.curto? `${nome}: coube ${m2(r.A)} de ${m2(alvo)} — a faixa limita` : `${nome} aplicado — clique de novo para girar 90°`) },
  blcEdit: b=>{ const {i,k}=blcIK(b); if(b.dataset.k!=null) BLC.k[i]=k; if(VIEW!=="impl") setView("impl"); setTool("edit"); blcSel(i); blcEnquadra(i) },
  blcAndar: b=>{ const {i,k}=blcIK(b); BLC.k[i]=k; blcVerAndar(i, k) },
  blcRefaz: b=>{ const i=+b.dataset.i; if(blcPersonaliza(S,i)){ delete BLC.k[i]; update(); toast(`Torre ${i+1}: forma automática copiada de novo`) } },
  blcDel: b=>blcApaga(+b.dataset.i),
  blcDelB: b=>{ const {i,k}=blcIK(b); blcApagaUm(i, k) },
  blcAdd: b=>{ const i=+b.dataset.i, nb=blcMaisBloco(S,i); if(!nb){ toast("O bloco de cima tem um andar só — aumente os pavimentos da torre"); return }
    const k=blcLst(i).length-1; BLC.k[i]=k; BLC.bopen=i+":"+k; BLC.open=i; update();
    toast(`Bloco novo a partir do ${nb.de}º andar, cópia do de cima — recue ou edite · Ctrl+Z desfaz`) },
  blcCopBx: b=>{ const {i,k}=blcIK(b); if(!blcCopiaBaixo(S,i,k)) return; BLC.k[i]=k; update(); toast("Contorno copiado do bloco de baixo — Ctrl+Z desfaz") },
  blcRecua: b=>{ const {i,k}=blcIK(b), inp=document.getElementById(`blcRec-${i}-${k}`), d=Math.max(0, +String(inp? inp.value : BLC.rec).replace(",",".")||0);
    if(!(d>0)){ toast("Informe quantos metros recuar"); return } BLC.rec=d;
    // C3: a fachada onde o núcleo (e a escada extra) encosta não recua — o núcleo sobe inteiro (Mais opções › recuar todas)
    const m=blcM(), l=m && m.tipo && m.tipo[i], nuc = l && l.core && l.core.length ? [l.coreOut||l.core, ...(l.coreExtra||[])] : undefined;
    const nb=blcRecua(S,i,k,d,{nucleos:nuc}); if(!nb){ toast(`Um recuo de ${nf(d,1)} m não cabe nessa forma`); return } BLC.k[i]=k; update();
    toast(`Fachadas recuadas ${nf(d,1)} m${k? " em relação ao bloco de baixo" : ""}${nb.preservados? " — a do núcleo ficou no lugar" : ""} · Ctrl+Z desfaz`) },
  blcMix: ()=>{ const m=blcM(), R=m && blcResumo(S,m); if(!R || !R.muda) return; S.produto.mix.forEach((u,j)=>u.qtd=R.q[j]); update();
    toast(`Mix ajustado: ${R.q.reduce((s,n)=>s+n,0)} unidades por andar — Ctrl+Z desfaz`) },
  blcMais: ()=>{ const b=blcB(BLC.sel); if(b){ entEscala(b, Math.sqrt(1.1)); update() } },
  blcMenos: ()=>{ const b=blcB(BLC.sel); if(b){ entEscala(b, 1/Math.sqrt(1.1)); update() } },
  blcGiraE: ()=>{ const b=blcB(BLC.sel); if(b){ entGira(b, 15); update() } },
  blcGiraD: ()=>{ const b=blcB(BLC.sel); if(b){ entGira(b, -15); update() } },
  blcPatio: ()=>{ const b=blcB(BLC.sel); if(!b) return; const v=entPatio(b, 0.2); if(!v){ toast("Não coube um pátio nessa forma"); return } (b.vazios=b.vazios||[]).push(v); update(); toast("Pátio criado — arraste os vértices para ajustar") },
  blcVazioX: el=>{ const b=blcB(BLC.sel); if(b && b.vazios){ b.vazios.splice(+el.dataset.i,1); if(!b.vazios.length) delete b.vazios; update() } },
  /* duplicar: nova torre com a mesma pilha de blocos, ao lado (deslocada pelo bloco ativo) */
  blcDup: ()=>{ const i=BLC.sel, b=blcB(i), P=S.produto, m=blcM(); if(!b || !m) return; if(P.torres.length>=4){ toast("O estudo aceita até 4 torres"); return }
    const ax=m.axis||G.longestDir(b.pts), [a0,a1]=G.extent(b.pts,ax), d=(a1-a0)+(m.gap||10), L=S.lote.pts, dentro=pts=>G.area(G.clipToPoly(pts, L));
    const s=[d,-d].map(s=>{ const c=blcCopia(b); entMove(c, ax[0]*s, ax[1]*s); return {s, A:dentro(c.pts)} }).sort((p,q)=>q.A-p.A)[0].s;
    const nbs=blcLst(i).filter(blcValido).map(x=>{ const c=blcCopia(x); entMove(c, ax[0]*s, ax[1]*s); const nb={pts:c.pts, de:x.de||1, tipo:x.tipo, rot:x.rot}; if(c.vazios.length) nb.vazios=c.vazios; return nb });
    P.torres.push({pav:P.torres[i].pav}); const n=P.torres.length-1; blcGarante(n).blocos=nbs; BLC.sel=n; BLC.open=n; BLC.k[n]=blcK(i);
    if(TAB==="produto") renderTab(); else update(); toast(`Torre ${n+1} criada com a mesma forma — Ctrl+Z desfaz`) },
  blcApagaSel: ()=>{ if(BLC.sel>=0) blcApagaAtivo(BLC.sel) },
  blcSolta: ()=>{ BLC.sel=-1; redraw2d() },
});

/* ---------- barra flutuante (mesmo visual do entorno) ---------- */
function blcBarHTML(i){
  const b=blcB(i), m=blcM(), k=blcK(i), f=blcFx(m,i,k)||{}, nv=b.vazios||[], pil=blcLst(i).length>1;
  return `<div class="eg"><span class="cnt">Torre ${i+1}${pil? ` · ${blcRot(f)}` : ""}</span><span class="mt">${m2(f.A||0)}/andar</span></div>
    <div class="eg"><button class="btn" data-act="blcMenos" title="Reduzir a área 10%">− Tamanho</button><button class="btn" data-act="blcMais" title="Aumentar a área 10%">+ Tamanho</button>
      <button class="btn" data-act="blcGiraE" title="Girar 15° anti-horário" aria-label="Girar 15° anti-horário">↺</button><button class="btn" data-act="blcGiraD" title="Girar 15° horário" aria-label="Girar 15° horário">↻</button></div>
    <div class="eg">${nv.length? nv.map((v,k)=>`<span class="chip">pátio ${nf(G.area(v),0)} m²<button data-act="blcVazioX" data-i="${k}" aria-label="Remover pátio" title="Remover pátio">×</button></span>`).join("")
      : `<button class="btn" data-act="blcPatio" title="Abre um pátio central (vazio) no bloco">Pátio</button>`}</div>
    <div class="eg"><button class="btn" data-act="blcDup" title="Nova torre com esta forma, ao lado">Duplicar</button><button class="btn warn" data-act="blcApagaSel" title="${pil? "Apaga este bloco (Delete)" : "A torre volta à forma automática (Delete)"}">${pil? "Apagar bloco" : "Apagar"}</button><button class="btn ghost" data-act="blcSolta" title="Esc">Soltar</button></div>`;
}
function blcBarRefresh(){
  let bar=document.getElementById("blcBar");
  if(BLC.sel>=0 && typeof ENT!=="undefined" && ENT.sel.size) BLC.sel=-1;   // uma seleção por vez: entorno ou torre
  if(BLC.sel>=0 && !blcB(BLC.sel)) BLC.sel=-1;
  const vis = typeof VIEW!=="undefined" && VIEW==="impl" && TOOL==="edit" && BLC.sel>=0;
  if(!vis){ if(bar) bar.hidden=true; return }
  if(!bar){ if(typeof entCss==="function") entCss(); blcCss(); bar=document.createElement("div"); bar.className="entbar"; bar.id="blcBar"; document.getElementById("view").appendChild(bar);
    bar.addEventListener("click",ev=>{ const b=ev.target.closest("[data-act]"); if(b && ACT[b.dataset.act]){ ev.preventDefault(); ACT[b.dataset.act](b) } });
    bar.addEventListener("pointerdown",ev=>ev.stopPropagation()) }
  bar.hidden=false;
  const m=blcM(), b=blcB(BLC.sel), k=blcK(BLC.sel), f=blcFx(m, BLC.sel, k), sig=[BLC.sel, k, blcLst(BLC.sel).length, (b.vazios||[]).map(v=>nf(G.area(v),0)).join(), f? nf(f.A,0)+blcRot(f) : ""].join("|");
  if(sig!==BLC.sig || !bar.innerHTML){ BLC.sig=sig; bar.innerHTML=blcBarHTML(BLC.sel) }
}
function blcCss(){ if(document.getElementById("blcCss")) return; const s=document.createElement("style"); s.id="blcCss";
  s.textContent=`.entbar .mt{font-family:var(--f-mono);font-size:11px;color:var(--muted);padding-right:2px;white-space:nowrap}
.blc-fm{display:flex;flex-wrap:wrap;gap:6px}
.blc-fm .chip{padding:5px 11px 5px 9px;gap:7px}
.blc-fm .chip::before{display:none}
.blc-fm .chip svg{width:14px;height:14px;fill:currentColor;opacity:.8;flex:none}
.blc-av{display:grid;gap:3px}
.blc-av p{margin:0;font-size:11.5px;line-height:1.4;color:var(--warn-t)}
.blc-pl{display:grid;gap:4px}
.blc-b{border-radius:9px;background:var(--surface);border:1px solid var(--line);transition:border-color .15s,box-shadow .15s}
.pr-row.on .blc-b{background:var(--surface-2)}
.blc-b.on{border-color:var(--accent);box-shadow:0 0 0 1px color-mix(in srgb,var(--accent) 35%,transparent)}
.blc-b.warn{border-color:color-mix(in srgb,var(--warn) 55%,transparent)}
.blc-b.on.warn{border-color:var(--accent)}
.blc-bh{display:grid;grid-template-columns:42px auto 1fr auto;align-items:center;gap:8px;width:100%;min-height:38px;padding:4px 10px 4px 8px;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer;border-radius:9px}
.blc-bh:hover b{color:var(--accent)}
.blc-bh b{font-weight:550;font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap}
.blc-bh .a{font-family:var(--f-mono);font-size:10.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.blc-bh .tg{font-size:9.5px;letter-spacing:.04em;text-transform:uppercase;color:var(--accent);border:1px solid color-mix(in srgb,var(--accent) 45%,transparent);border-radius:999px;padding:1px 6px;white-space:nowrap}
.blc-bh .w{grid-column:2/-1;font-family:var(--f-mono);font-size:10.5px;color:var(--warn-t);line-height:1.35}
.blc-sil{display:flex;justify-content:center;align-items:center;height:12px}
.blc-sil i{display:block;height:9px;min-width:5px;border-radius:2px;background:var(--muted);opacity:.55}
.blc-b.ref .blc-sil i{background:var(--accent);opacity:.85}
.blc-b.fora .blc-sil i{background:none;border:1px dashed var(--muted)}
.blc-bb{display:grid;gap:10px;padding:4px 10px 10px}
.blc-bb .row{gap:8px;flex-wrap:wrap;align-items:center}
.blc-bb .stp{width:118px;grid-template-columns:30px 1fr 30px}
.blc-bb .inp{width:74px}
.blc-bb .fl{margin:0}
.blc-ac{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.blc-ac .blc-rm{margin-left:auto}
.blc-ac .inp input{text-align:right}
.blc-hd{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:2px 0 6px}
.blc-al{margin:8px 2px 0;font-size:11.5px;line-height:1.45}`; document.head.appendChild(s) }

/* ---------- desenho na implantação (destaques e alças) ---------- */
HOOK.draw2d.push((g, ctx)=>{
  if(!blcAtivo(S)) return;
  const m=ctx.m, w2s=ctx.w2s, lst=blcLista(); if(!lst.length || !m || !m.T) return;
  const ring=p=>p.forEach((q,k)=>{ const [x,y]=w2s(q); k?g.lineTo(x,y):g.moveTo(x,y) });
  const path=p=>{ g.beginPath(); ring(p); g.closePath() };
  // hachura da parte da planta fora de um polígono (recuos, embasamento, bloco de baixo)
  const hach=(pl, fora, col)=>{ if(!pl || !pl.length || !fora || fora.length<3) return; g.save(); path(pl); g.clip(); g.beginPath(); g.rect(0,0,ctx.W,ctx.H); ring(fora); g.closePath(); g.clip("evenodd");
    g.fillStyle=col; g.globalAlpha=0.16; g.fillRect(0,0,ctx.W,ctx.H); g.globalAlpha=0.75; g.strokeStyle=col; g.lineWidth=1.2; g.beginPath(); for(let x=-ctx.H; x<ctx.W; x+=7){ g.moveTo(x,ctx.H); g.lineTo(x+ctx.H,0) } g.stroke(); g.restore() };
  const lab=(t,[x,y],col)=>{ g.font="500 10px "+css("--f-mono"); g.textAlign="center"; g.textBaseline="middle"; const tw=g.measureText(t).width+8; g.fillStyle=css("--surface"); g.globalAlpha=0.88; g.fillRect(x-tw/2,y-8,tw,16); g.globalAlpha=1; g.fillStyle=col||css("--ink"); g.fillText(t,x,y) };
  const nucleoVermelho=core=>{ path(core); g.fillStyle=css("--bad"); g.globalAlpha=0.25; g.fill(); g.globalAlpha=1; g.strokeStyle=css("--bad"); g.lineWidth=1.6; g.setLineDash([4,3]); g.stroke(); g.setLineDash([]) };
  // vista Andares: o andar de um bloco mostra o terraço sobre o bloco de baixo, o balanço e o núcleo cortado
  if(ctx.mode==="andar" && ctx.opt.andar && ctx.opt.andar.tipo==="tipo"){
    const k=ctx.opt.andar.j+1;
    lst.forEach(i=>{ const t=m.T[i]; if(!t || k>t.pav) return; const fx=(t.faixas||[]).filter(f=>f.blc); if(fx.length<2) return;
      const j=fx.findIndex(f=>k>=f.de && k<=f.ate); if(j<0) return; const f=fx[j], fb=j? fx[j-1] : null, pl=f.oco? f.oco.pts : f.plate;
      if(fb && fb.plate.length>2 && pl.length>2){ const pb=fb.oco? fb.oco.pts : fb.plate;
        g.save(); path(pb); g.clip(); g.beginPath(); g.rect(0,0,ctx.W,ctx.H); ring(pl); g.closePath(); g.clip("evenodd"); g.fillStyle=css("--lz-deck"); g.globalAlpha=0.92; g.fillRect(0,0,ctx.W,ctx.H); g.restore();
        path(pb); g.strokeStyle=css("--muted"); g.lineWidth=1; g.setLineDash([5,4]); g.stroke(); g.setLineDash([]);
        hach(pl, pb, css("--warn")) }
      if(pl.length>2){ path(pl); g.strokeStyle=css("--ink"); g.lineWidth=1.8; g.stroke() }
      const l=m.tipo && m.tipo[i]; if(f.nucleoCortado && l && l.core && l.core.length){ nucleoVermelho(l.core); if(ctx.V.s>2) lab("núcleo cortado", w2s(G.centroid(l.core)), css("--bad")) }
      if(ctx.V.s>2 && pl.length>2){ const c=w2s(G.centroid(pl)), bb=pl.map(q=>w2s(q)[1]); lab(`bloco ${blcRot(f)}${f.ref?" · tipo":""} · ${f.un} un/andar${fb && f.A<fb.A-1? ` · terraços ${m2(fb.A-f.A)}` : ""}`, [c[0], Math.max(...bb)+14]) }
    });
    return;
  }
  if(ctx.mode!=="impl") return;
  lst.forEach(i=>{ const t=m.T[i], I=(m.blc||[]).find(x=>x.i===i)||{}, b=blcB(i), k=blcK(i); if(!t) return;
    const bi=(I.bl||[]).find(x=>x.k===k), j=(I.bl||[]).indexOf(bi);
    if(bi){ if(bi.foraRecuo>0.5) hach(bi.plate, bi.env, css("--bad")); if(bi.bal>0.5) hach(bi.plate, bi.below, css("--warn")); if(j===0 && I.balanco>0.5) hach(bi.plate, m.emb, css("--warn")) }
    if(I.foraLote>0.5){ path(b.pts); g.setLineDash([6,4]); g.strokeStyle=css("--bad"); g.lineWidth=1.6; g.stroke(); g.setLineDash([]) }
    const l=m.tipo && m.tipo[i]; if(l && l.core && l.core.length && (I.nucleo===false || (bi && bi.nucleo===false))) nucleoVermelho(l.core);
    // outros blocos da pilha: contorno discreto (o ativo fica em destaque com a ferramenta Editar)
    blcLst(i).forEach((o,kk)=>{ if(kk===k || !blcValido(o)) return; path(o.pts); g.strokeStyle=css("--muted"); g.globalAlpha=0.8; g.lineWidth=1; g.setLineDash([3,3]); g.stroke(); g.setLineDash([]); g.globalAlpha=1;
      if(ctx.opt.handles && BLC.sel===i && ctx.V.s>2.5){ const f=blcFx(m,i,kk), bb=o.pts.map(q=>w2s(q)), x=Math.min(...bb.map(p=>p[0])), y=Math.min(...bb.map(p=>p[1])); if(f){ g.font="500 9.5px "+css("--f-mono"); g.textAlign="left"; g.textBaseline="bottom"; g.fillStyle=css("--muted"); g.fillText(blcRot(f), x+2, y-3) } } });
  });
  // torres próximas demais: cota entre os pontos mais próximos
  (m.blcPares||[]).forEach(p=>{ const A=m.T[p.a].plate, B=m.T[p.b].plate, c=blcPerto(A,B); if(!c) return; const [x1,y1]=w2s(c[0]), [x2,y2]=w2s(c[1]);
    g.strokeStyle=css("--bad"); g.lineWidth=1.6; g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke(); [[x1,y1],[x2,y2]].forEach(([x,y])=>{ g.beginPath(); g.arc(x,y,2.6,0,7); g.fillStyle=css("--bad"); g.fill() });
    const t=p.d<0.01? "sobreposição" : `${nf(p.d,1)} m < ${nf(m.gap,1)} m`; g.font="600 10.5px "+css("--f-mono"); const tw=g.measureText(t).width+8, mx=(x1+x2)/2, my=(y1+y2)/2;
    g.fillStyle=css("--surface"); g.globalAlpha=.92; g.fillRect(mx-tw/2,my-8,tw,16); g.globalAlpha=1; g.fillStyle=css("--bad"); g.textAlign="center"; g.textBaseline="middle"; g.fillText(t,mx,my) });
  if(!ctx.opt.handles) return;
  // alças: vértices do bloco ativo de cada torre; o da torre selecionada ganha contorno, meios dos lados e o quadrado de redimensionar
  lst.forEach(i=>{ const b=blcB(i), on=BLC.sel===i, f=blcFx(m,i,blcK(i));
    if(on){ path(b.pts); g.fillStyle=css("--d-acc"); g.globalAlpha=0.12; g.fill(); g.globalAlpha=1; g.strokeStyle=css("--d-acc"); g.lineWidth=2.4; g.stroke() }
    else { path(b.pts); g.strokeStyle=css("--d-acc"); g.globalAlpha=0.55; g.lineWidth=1.2; g.setLineDash([5,4]); g.stroke(); g.setLineDash([]); g.globalAlpha=1 }
    (b.vazios||[]).forEach(v=>{ const ok=entVazioOk(b,v); path(v); g.strokeStyle= ok? css("--d-acc") : css("--bad"); g.setLineDash([5,4]); g.lineWidth=1.6; g.stroke(); g.setLineDash([]) });
    [b.pts, ...(b.vazios||[])].forEach(arr=>arr.forEach(q=>{ const [x,y]=w2s(q), r=on?4:3; g.fillStyle=on? css("--d-acc") : css("--muted"); g.fillRect(x-r,y-r,2*r,2*r) }));
    if(on){ [b.pts, ...(b.vazios||[])].forEach(arr=>arr.forEach((a,k)=>{ const c=arr[(k+1)%arr.length], [x,y]=w2s([(a[0]+c[0])/2,(a[1]+c[1])/2]); g.fillStyle=css("--d-acc"); g.globalAlpha=0.55; g.beginPath(); g.arc(x,y,3,0,7); g.fill(); g.globalAlpha=1 }));
      const [x,y]=w2s(blcEscalaPos(b)); g.fillStyle=css("--surface"); g.strokeStyle=css("--d-acc"); g.lineWidth=2; g.beginPath(); g.rect(x-6,y-6,12,12); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(x-2.5,y+2.5); g.lineTo(x+2.5,y-2.5); g.moveTo(x+0.5,y-2.5); g.lineTo(x+2.5,y-2.5); g.lineTo(x+2.5,y-0.5); g.stroke();
      if(blcLst(i).length>1 && f && ctx.V.s>2){ const bb=b.pts.map(q=>w2s(q)), bx=Math.min(...bb.map(p=>p[0])), by=Math.min(...bb.map(p=>p[1])); g.font="600 10px "+css("--f-mono"); g.textAlign="left"; g.textBaseline="bottom"; g.fillStyle=css("--d-acc"); g.fillText(`bloco ${blcRot(f)}`, bx+2, by-3) } }
  });
});
/* legenda da vista Andares: terraço sobre o bloco de baixo */
function blcLegenda(){
  const el=document.getElementById("planLeg"), m=blcM(); if(!el || !m || !blcAtivo(S) || VIEW!=="andar" || el.querySelector(".blcLeg")) return;
  const a=typeof floorsList==="function"? floorsList(m).find(f=>f.key===ANDAR) : null; if(!a || a.tipo!=="tipo") return;
  if(!m.T.some(t=>{ const fx=(t.faixas||[]).filter(f=>f.blc), j=fx.findIndex(f=>a.j+1>=f.de && a.j+1<=f.ate); return j>0 && fx[j-1].A>fx[j].A+1 })) return;
  el.insertAdjacentHTML("beforeend", `<div class="blcLeg"><i style="background:var(--lz-deck)"></i>terraço (recuo do bloco)</div>`);
}
if(typeof planLegend==="function"){ const _plBlc=planLegend; planLegend=function(){ _plBlc.apply(this, arguments); try{ blcLegenda() }catch(e){ console.error("[blocos] legenda", e) } } }
/* pontos mais próximos entre dois contornos (vértice de um × lado do outro) */
function blcPerto(A, B){ let best=null, bd=Infinity;
  const pr=(p,a,b)=>{ const vx=b[0]-a[0], vy=b[1]-a[1], L=vx*vx+vy*vy||1e-9, t=Math.max(0,Math.min(1,((p[0]-a[0])*vx+(p[1]-a[1])*vy)/L)); return [a[0]+t*vx, a[1]+t*vy] };
  const run=(P,Q,sw)=>P.forEach(p=>Q.forEach((a,k)=>{ const q=pr(p,a,Q[(k+1)%Q.length]), d=Math.hypot(q[0]-p[0],q[1]-p[1]); if(d<bd){ bd=d; best= sw? [q,p] : [p,q] } }));
  run(A,B,false); run(B,A,true); return best }

/* ---------- seção "Forma das torres" (Produto) ---------- */
const BLC_IC = { ret:"M3 4h10v8H3z", L:"M3 3h4v6h6v4H3z", U:"M2 3h4v6h4V3h4v10H2z", T:"M2 3h12v4H10v6H6V7H2z", H:"M2 3h4v3h4V3h4v10h-4v-3H6v3H2z", patio:"M2 3h12v10H2zM6 6v4h4V6z" };
const blcIc = k => `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill-rule="evenodd" d="${BLC_IC[k]}"/></svg>`;
function blcSum(){ if(!blcAtivo(S)) return S.custom && S.custom.torOcupa && S.custom.tor && S.custom.tor.length? "automática · ocupa a área desenhada" : "automática"; const n=blcLista().length, N=S.produto.torres.length, nb=blcLista().reduce((s,i)=>s+blcLst(i).filter(blcValido).length,0);
  return n? `desenhada · ${n} de ${N} torre${N>1?"s":""}${nb>n? ` · ${nb} blocos` : ""}` : "desenhada · nenhuma personalizada" }
/* eficiência real da planta (blcPrivReal) numa linha de torre: " · eficiência real 72% (informada 80%)" */
const blcEficTxt = t => t && t.eficReal!=null ? ` · eficiência real ${pct(t.eficReal,0)} (informada ${pct(S.produto.efic,0)})` : "";
function blcSecHTML(){
  blcCss(); const on=blcAtivo(S), salvas=(S.blocos.torres||[]).filter(t=>t && t.blocos && t.blocos.length).length;
  const body = ROW(`Forma${INFO("Automática: a torre sai das regras e do mix (recuos, faixa de cada torre, área do mix ÷ eficiência). Desenhada: você personaliza a planta de cada torre — copiando a automática, com um formato pronto (retângulo, L, U, T, H, pátio) ou editando na implantação — e pode empilhar blocos (embasamento largo, tipo, cobertura recuada). A planta desenhada não encolhe: recuos, TO, CA, gabarito, balanço, núcleo e distância entre torres viram avisos. Na desenhada, a privativa é a soma das unidades desenhadas no pavimento tipo (eficiência real da planta), não área × eficiência informada. Voltar para Automática guarda as formas.","forma das torres")}`,
      SEG("blocos.modo",[["auto","Automática"],["desenhada","Desenhada"]],{label:"Forma das torres"}))
    + (on ? `<div class="list" id="blcList"></div><div id="blcGeral"></div>${ADV(SW("alas.recuaTodas", `Recuar recua todas as fachadas${INFO("Por padrão, “Recuar” não mexe na fachada onde o núcleo (escada e elevadores) encosta: o núcleo sobe inteiro até o topo e o recuo o cortaria. Ligado, recua todas as fachadas — confira o aviso de núcleo cortado.","recuar")}`, {fx:"save"}), {key:"blc-opc"})}`
          : salvas ?`<p class="note">${salvas} forma${salvas>1?"s":""} guardada${salvas>1?"s":""} — volta${salvas>1?"m":""} ao escolher Desenhada.</p>` : "");
  return SEC("Forma das torres", body + blcOcupaHTML(), {key:"pr-forma", sum:blcSum(), info:"Planta das torres: automática pelas regras ou desenhada por você, torre a torre, numa pilha de blocos."});
}
/* "Torre ocupa a área desenhada" (C0, S.custom.torOcupa): veio de Terreno › Limites (UX v3 §4.6). Só aparece com o limite especial das
   torres desenhado (S.custom.tor); a linha viva #torOcupaP mostra a planta, o tamanho médio das unidades e "Ajustar mix" (ACT.blcOcupaMix) */
const BLC_OCUPA_INFO = "Desligado, a área restrita das torres (desenhada em Terreno) é só um teto: a torre fica do tamanho das unidades dentro dela. Ligado, essa área (recortada pelos recuos) vira a planta do andar tipo e as unidades crescem ou encolhem até preenchê-la. “Ajustar mix” muda a quantidade de unidades por andar para elas voltarem ao tamanho do mix.";
function blcOcupaHTML(){
  if(!(S.custom && S.custom.tor && S.custom.tor.length)) return "";
  return `<div class="row" style="gap:6px;margin-top:8px">${SW("custom.torOcupa","Torre ocupa a área desenhada",{rr:true})}${INFO(BLC_OCUPA_INFO,"torre ocupa a área desenhada")}</div>${S.custom.torOcupa? `<div class="fsub" id="torOcupaP"></div>` : ""}`;
}
function blcOcupaLive(m){
  if(!document.getElementById("torOcupaP") || typeof torOcupaResumo!=="function") return;
  const R=torOcupaResumo(S, m), ajuste=R && R.A>0 && R.muda && Math.abs(R.r-1)>0.03;
  setHTML("torOcupaP", !R ? "" : !R.A ? "A área desenhada ficou vazia depois dos recuos." :
    `<span>${R.desiguais? R.As.map(a=>m2(a)).join(" e ") : m2(R.A)}/andar${R.real? ` · aproveitamento real ${pct(R.efic,0)} (informado ${pct(R.eficInf,0)})${INFO("Eficiência real da planta")}` : ""} · unidades com ${nf(R.media,0)} m² em média (mix: ${nf(R.mixMedia,0)} m²)</span>${ajuste? ` <button type="button" class="btn sm" data-act="blcOcupaMix" style="margin-left:6px">Ajustar mix</button>` : ""}`);
}
ACT.blcOcupaMix = ()=>{ const m=window._last&&window._last.m, R=m&&torOcupaResumo(S, m); if(!R||!R.A) return;
  const q=R.q; S.produto.mix.forEach((u,j)=>u.qtd=q[j]); update(); toast(`Mix ajustado: ${q.reduce((s,n)=>s+n,0)} unidades por andar — Ctrl+Z desfaz`) };
/* avisos curtos de uma torre e de um bloco (o texto completo fica nos avisos do estudo) */
function blcCurtos(I){ if(!I) return []; const o=[];
  if(I.foraLote>0.5) o.push(`${m2(I.foraLote)} fora do lote`); if(I.foraRecuo>0.5) o.push(`${m2(I.foraRecuo)} sobre os recuos`);
  if(I.balanco>0.5) o.push(`${m2(I.balanco)} em balanço`); if(I.nucleo===false) o.push("núcleo fora da planta");
  const nc=(I.bl||[]).filter(b=>!b.nucleo).length; if(nc) o.push(nc>1? `${nc} blocos cortam o núcleo` : "um bloco corta o núcleo");
  const bal=(I.bl||[]).reduce((s,b)=>s+(b.bal>0.5? b.bal : 0),0); if(bal>0.5) o.push(`${m2(bal)} em balanço entre blocos`); return o }
function blcCurtosB(b){ if(!b) return []; const o=[]; if(b.foraRecuo>0.5) o.push(`${m2(b.foraRecuo)} sobre os recuos`); if(b.bal>0.5) o.push(`${m2(b.bal)} em balanço`); if(!b.nucleo) o.push("corta o núcleo"); return o }
const BLC_INFO_PILHA = "A torre é uma pilha de blocos, de baixo para cima. Cada bloco vale do andar em que começa até o anterior ao próximo; o de cima vai até o total de andares da torre. O bloco marcado TIPO (o de mais andares) recebe o pavimento tipo detalhado; os outros repetem o mesmo núcleo com as unidades distribuídas pela área. “+ Bloco” copia o de cima e começa no meio dele; “Recuar” afasta as fachadas do bloco de baixo.";
/* C3: uma linha sobre o pavimento tipo da torre (por alas, aproximado ou retangular) */
const BLC_INFO_ALAS = "Planta em L, U, T, H ou com pátio: o pavimento tipo é montado por alas — corredor contínuo pelo eixo de cada ala (dobra nos cantos, cruza nos nós), núcleo onde a distância até a escada é menor e gasta menos fachada, unidades do mix com fachada e porta no corredor. Se a unidade mais distante passar do limite da saída única, entra uma escada extra (antecâmara + escada) na ponta da ala.";
function blcAlasTxt(l){ const A=l && l.alas; if(!A) return null;
  const esc = A.esc2 ? ` · ${A.esc2>1? A.esc2+" escadas extras" : "escada extra"}` : "";
  const onde = A.nucleo==="nó" ? (/^[TH]$/.test(A.forma)? "no encontro das alas" : "no canto") : A.nucleo==="meio" ? "no meio da ala" : "na ponta da ala";
  return `por alas · ${A.forma} · núcleo ${onde}${esc} · ${A.dist!=null? nf(A.dist,0)+" m até a escada" : ""}` }
function blcAlasLinha(m, i){ const l=m.tipo && m.tipo[i]; if(!l) return "";
  if(l.alasFalha) return `<p class="note blc-al" style="color:var(--warn-t)">Pavimento tipo aproximado: ${esc(l.alasFalha)}${INFO(BLC_INFO_ALAS,"pavimento por alas")}</p>`;
  const t=blcAlasTxt(l); return t ? `<p class="note blc-al"${l.alas.dist>l.alas.lim+1e-6? ' style="color:var(--warn-t)"' : ""}>Tipo ${t}${INFO(BLC_INFO_ALAS,"pavimento por alas")}</p>` : "" }
/* linhas dos blocos de uma torre (de cima para baixo) */
function blcBlocosHTML(i, m, I){
  const L=blcLst(i), t=m.T[i]||{}, N=t.pav||1, kAt=blcK(i), maxA=Math.max(1, ...L.map((_,k)=>(blcFx(m,i,k)||{}).A||0));
  const rows=[]; for(let k=L.length-1;k>=0;k--){ const b=L[k]; if(!blcValido(b)) continue;
    const f=blcFx(m,i,k), bi=(I && I.bl||[]).find(x=>x.k===k), ig=(t.blcIgn||[]).find(g=>g.k===k), key=i+":"+k, open=BLC.bopen===key || L.length===1;
    const w=[...blcCurtosB(bi), ...(ig? [ig.motivo==="acima"? `fora: a torre tem ${N} andares` : "começa junto com outro"] : [])];
    const pctW = f? Math.max(12, Math.round(f.A/maxA*100)) : 30;
    const lo = k===1 ? 1 : (+((L[k-1]||{}).de)||1), hi = k<L.length-1 ? (+L[k+1].de||N)-1 : Math.max(N, +b.de||1);
    rows.push(`<div class="blc-b${kAt===k && L.length>1?" on":""}${w.length?" warn":""}${f && f.ref?" ref":""}${f?"":" fora"}">
      <button type="button" class="blc-bh" data-act="blcBk" data-i="${i}" data-k="${k}" aria-expanded="${open}" title="${open?"Fechar":"Abrir e selecionar"} o bloco">
        <span class="blc-sil" aria-hidden="true"><i style="width:${pctW}%"></i></span><b>${f? blcRot(f) : (b.de||"?")+"º"}</b><span class="a">${f? m2(f.A) : "fora da torre"}${f && f.un!=null && L.length>1? ` · ${f.un} un` : ""}</span>${f && f.ref && L.length>1? `<span class="tg">tipo</span>` : "<span></span>"}
        ${w.length? `<span class="w">${w.join(" · ")}</span>` : ""}</button>
      ${open? `<div class="blc-bb">
        ${k>0? `<div class="row"><span class="fl">Começa no andar</span>${prStp(`blocos.torres.${i}.blocos.${k}.de`, b.de||lo+1, lo+1, Math.max(lo+1, hi), `Andar inicial do bloco ${k+1}`)}</div>` : ""}
        <div class="blc-fm" role="group" aria-label="Formatos prontos">${BLC_FORMAS.map(([fk,l])=>`<button type="button" class="chip" data-act="blcFmt" data-i="${i}.${k}" data-t="${fk}" aria-pressed="${b.tipo===fk}" title="${b.tipo===fk?"Clique de novo para girar 90°":"Aplicar "+l.toLowerCase()}">${blcIc(fk)}${l}</button>`).join("")}</div>
        ${k>0? `<div class="blc-ac"><button type="button" class="btn sm" data-act="blcCopBx" data-i="${i}.${k}" title="Este bloco fica com o contorno do bloco de baixo">Copiar do de baixo</button>
          <span class="row" style="gap:6px;flex-wrap:nowrap"><div class="inp"><input type="number" id="blcRec-${i}-${k}" step="0.5" min="0.5" value="${fmtIn(BLC.rec)}" aria-label="Recuo em relação ao bloco de baixo"><em>m</em></div><button type="button" class="btn sm" data-act="blcRecua" data-i="${i}.${k}" title="Contorno do bloco de baixo recuado esta distância em todas as fachadas">Recuar</button></span></div>` : ""}
        <div class="blc-ac"><button type="button" class="btn sm" data-act="blcEdit" data-i="${i}.${k}" data-k="${k}" title="Selecionar o bloco na implantação">Editar na implantação</button><button type="button" class="btn sm" data-act="blcAndar" data-i="${i}.${k}" title="Planta do 1º andar deste bloco">Ver andar</button>${L.length>1? `<span class="blc-rm">${prRm("blcDelB", `${i}.${k}`, `bloco ${f? blcRot(f) : k+1}`, "Apagar bloco")}</span>` : ""}</div>
      </div>` : ""}</div>`) }
  return rows.join("");
}
function blcLive(m){
  setSum("pr-forma", blcSum()); blcOcupaLive(m);
  if(!blcAtivo(S) || !document.getElementById("blcList")) return;
  const P=S.produto;
  setHTML("blcList", P.torres.map((tw,i)=>{ const b=blcB(i), t=m.T[i]||{}, nome=`Torre ${i+1}`, I=(m.blc||[]).find(x=>x.i===i), cu=blcCurtos(I);
    const pares=(m.blcPares||[]).filter(p=>p.a===i||p.b===i).map(p=>p.d<0.01? `sobrepõe a torre ${(p.a===i?p.b:p.a)+1}` : `${nf(p.d,1)} m da torre ${(p.a===i?p.b:p.a)+1}`);
    const av=[...cu, ...pares], open=!!b && BLC.open===i, nb=blcLst(i).filter(blcValido).length, ref=nb>1? blcFx(m,i,t.blcRef??0) : null;
    if(!b) return `<div class="pr-row"><div class="pr-rh"><div class="pr-tx"><b>${nome}</b><span>automática · ${m2(t.A||0)}/andar</span></div>
      <button type="button" class="btn sm" data-act="blcPers" data-i="${i}" title="Copia a forma automática atual para uma forma editável. A privativa passa a ser a das unidades desenhadas no pavimento tipo (eficiência real da planta), em geral um pouco menor que área × eficiência informada">Personalizar</button></div></div>`;
    const sub = `${nb>1 ? `${nb} blocos · tipo ${blcRot(ref)}` : BLC_NOMES[b.tipo]||"desenhada"} · ${m2(t.A||0)}/andar${blcEficTxt(t)} · unidades a ${pct(t.r||0,0)} do mix`;
    return `<div class="pr-row${open?" on":""}${av.length?" warn":""}" data-row="blc:${i}"><div class="pr-rh">
        <button type="button" class="pr-tx" data-act="blcTog" data-i="${i}" aria-expanded="${open}"><b>${nome}</b><span>${sub}</span>${av.length?`<span class="w">${av.join(" · ")}</span>`:""}</button>
        <button type="button" class="pr-ic lbl" data-act="blcEdit" data-i="${i}" title="Selecionar e editar na implantação" aria-label="Editar a ${nome.toLowerCase()} na implantação">Editar</button>
        <button type="button" class="pr-ic chev" data-act="blcTog" data-i="${i}" aria-expanded="${open}" aria-label="${open?"Fechar":"Abrir"} ${nome}" title="${open?"Fechar":"Blocos, formatos e opções"}">${PR_IC.chev}</button></div>
      ${open? `<div class="pr-rb"><div class="blc-hd"><span class="fl">${nb>1? "Blocos · de cima para baixo" : "Bloco único"}${INFO(BLC_INFO_PILHA,"pilha de blocos")}</span></div>
        <div class="blc-pl">${blcBlocosHTML(i, m, I)}</div>${blcAlasLinha(m, i)}
        <div class="pr-rf"><button type="button" class="btn sm" data-act="blcAdd" data-i="${i}" title="Novo bloco no topo, cópia do de cima, começando no meio dele">+ Bloco</button>${nb===1? `<button type="button" class="btn sm ghost" data-act="blcRefaz" data-i="${i}" title="Copia de novo a forma automática">Refazer da automática</button>` : ""}${prRm("blcDel", i, "forma da "+nome.toLowerCase(), "Apagar forma")}</div></div>` : ""}</div>` }).join(""));
  const R=blcResumo(S,m), G2=(m.blcGeral||[]).filter(a=>!/^O mix ocupa/.test(a));
  setHTML("blcGeral", (R && R.real? `<p class="note blc-ef">Eficiência real da planta <b>${pct(R.efic,0)}</b> (informada ${pct(R.eficInf,0)}) · ${m2(R.priv)} de unidades/andar${INFO("Eficiência real da planta")}</p>` : "")
    + (R? `<div class="row sb"><span class="note"${R.desvio?' style="color:var(--warn-t)"':""}>O mix ocupa ${pct(R.ocupa,0)} do pavimento ${m.T.some(t=>t.desenhada && (t.faixas||[]).length>1)? "tipo " : ""}desenhado</span>${R.muda? `<button type="button" class="btn sm" data-act="blcMix" title="Muda a quantidade de unidades por andar para o mix voltar ao tamanho original, pela área real que a planta desenhada tem para unidades (no bloco tipo; os outros blocos acompanham)">Ajustar mix</button>` : ""}</div>` : "")
    + (G2.length? `<div class="blc-av">${G2.map(a=>`<p>${esc(a)}</p>`).join("")}</div>` : ""));
}

/* ---------- C3: Projeto › Pavimento tipo — alas (só com planta desenhada em L/U/T/H/pátio) ---------- */
const blcTemAlas = m => !!(m && m.tipo && m.tipo.some(l=>l && (l.alas || l.alasFalha)));
function blcAlasCard(){
  const m=blcM(), mt=(l,v,s,c)=>`<div class="met"><div class="l">${l}</div><div class="v"${c?` style="color:var(--${c})"`:""}>${v}</div>${s?`<div class="s">${s}</div>`:""}</div>`;
  const rows=(m && m.tipo || []).map((l,i)=>{ if(!l) return ""; const nm=m.T.length>1? `Torre ${i+1} · ` : "";
    if(l.alasFalha) return `<p class="note" style="color:var(--warn-t)">${nm}aproximado: ${esc(l.alasFalha)}</p>`;
    const A=l.alas; if(!A) return ""; const alto=A.dist>A.lim+1e-6;
    return `${m.T.length>1? `<p class="fl" style="margin:4px 0 2px">Torre ${i+1}</p>` : ""}<div class="mets">${mt("Forma", A.forma, `${A.alas} trechos de corredor`)}${mt(`Até a escada${INFO("Distância a percorrer da porta da unidade mais distante até a escada, pelo corredor (IN 09 CBMSC; limite da saída única sem chuveiros: 30 m).","distância a percorrer")}`, nf(A.dist||0,1)+" m", `limite ${nf(A.lim||30,0)} m`, alto? "warn" : "")}${mt("Escadas", 1+(A.esc2||0), A.esc2? "extra na ponta da ala" : "no núcleo")}${mt("Livre", m2(A.livreA||0), "sem uso")}</div>` }).join("");
  return SEC("Alas do pavimento tipo", (rows || `<p class="note">Sem planta em alas.</p>`)
    + ADV(SW("alas.on", `Layout por ala${INFO(BLC_INFO_ALAS,"pavimento por alas")}`) + SW("alas.esc2", `Escada extra quando passar do limite${INFO("Com a unidade mais distante além do limite da saída única, entra até duas escadas extras (antecâmara + escada) na ponta das alas mais distantes. Elas descem até o térreo e viram obstáculo nas garagens.","escada extra")}`), {key:"alas-opc"}),
    {key:"pr-alas", sum: blcAlasSum(m), info:BLC_INFO_ALAS});
}
function blcAlasSum(m){ const L=(m && m.tipo||[]).filter(l=>l && l.alas); if(!L.length) return S.alas && S.alas.on===false? "desligado" : "aproximado";
  return L.map(l=>`${l.alas.forma} · ${nf(l.alas.dist||0,0)} m${l.alas.esc2? ` · +${l.alas.esc2} esc.` : ""}`).join(" | ") }
addCard("projeto", { key:"alas", order:52, sub:"tipo", when:()=>blcAtivo(S) && blcTemAlas(blcM()), html:blcAlasCard, live:m=>setSum("pr-alas", blcAlasSum(m)) });

/* ---------- C3: relatório PDF — "Forma das torres" (só no modo Desenhada) ---------- */
function blcPlantaImg(m, i, f, W=1100, H=760){
  const pl=f.oco? f.oco.pts : f.plate; if(!pl || pl.length<3 || typeof drawPlan!=="function") return null;
  const cv=document.createElement("canvas"); cv.width=W; cv.height=H; const g=cv.getContext("2d");
  const V=fitView([pl], W/2, H/2, 1.18); g.scale(2,2); g.fillStyle="#fff"; g.fillRect(0,0,W/2,H/2);
  drawPlan(g, W/2, H/2, V, "andar", m, {andar:{tipo:"tipo", j:f.de-1, key:"p"+f.de}, tower:i, bg:false});
  return cv.toDataURL("image/jpeg", 0.9);
}
HOOK.pdf.push(async ctx=>{
  const m=ctx.m; if(!blcAtivo(S) || !m || !m.T || !m.T.some(t=>t.desenhada)) return;
  const doc=ctx.doc, M=ctx.M, PW=ctx.PW, ink=ctx.ink||[29,29,31], mut=ctx.mut||[110,110,115], warn=[150,100,0];
  ctx.newPage(); ctx.h2("Forma das torres");
  m.T.forEach((t,i)=>{ if(!t.desenhada) return;
    const I=(m.blc||[]).find(x=>x.i===i)||{}, l=m.tipo && m.tipo[i], fx=(t.faixas||[]).filter(f=>f.blc);
    const blocos=(fx.length? fx : [{de:1, ate:t.pav, n:t.pav, A:t.A, plate:t.plate, oco:t.oco, ref:true, bk:t.blcRef||0, un:t.units/Math.max(1,t.pav)}]).slice().reverse();
    if(ctx.y()>215) ctx.newPage();
    doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(...ink);
    doc.text(ctx.T(`Torre ${i+1} · ${t.pav} pavimentos · ${blocos.length>1? blocos.length+" blocos" : "bloco único"}`), M, ctx.y()); doc.setFont("helvetica","normal"); ctx.setY(ctx.y()+5);
    const un=f=>f.un!=null? f.un : (f.qtd||[]).reduce((s,n)=>s+n,0);
    ctx.rows(blocos.map(f=>{ const b=(I.bl||[]).find(x=>x.k===f.bk)||{}, av=[b.bal>0.5? `balanço ${nf(b.bal,0)} m²` : "", b.nucleo===false? "corta o núcleo" : "", b.foraRecuo>0.5? `${nf(b.foraRecuo,0)} m² sobre os recuos` : ""].filter(Boolean);
      return [`Bloco ${blcRot(f)}${f.ref? " (tipo)" : ""}`, `${f.n} andar${f.n>1?"es":""} · ${nf(f.A,0)} m² · ${nf(un(f),0)} un/andar${av.length? " · "+av.join(" · ") : ""}`, av.length? "warn" : "ok"] })
      .concat(l && (l.alas || l.alasFalha) ? [["Pavimento tipo", l.alas? blcAlasTxt(l) : "aproximado ("+l.alasFalha+")", l.alas && !(l.alas.dist>l.alas.lim+1e-6)? "ok" : "warn"]] : [])
      .concat(t.eficReal!=null ? [["Eficiência real da planta", `${pct(t.eficReal,0)} (informada ${pct(S.produto.efic,0)}) · ${nf(t.privAndar||0,0)} m² de unidades por andar tipo`, "ok"]] : []));
    // plantas: uma por bloco (de baixo para cima), com o núcleo
    const um1=blocos.length===1, imgs=withLight(()=>blocos.slice().reverse().map(f=>({f, url:blcPlantaImg(m, i, f, um1? 1400 : 1100, um1? 700 : 760)}))).filter(x=>x.url);
    const um=um1, w=um? PW-2*M : (PW-2*M-6)/2, h=w*(um? 0.5 : 760/1100);
    imgs.forEach((x,k)=>{ const col=um? 0 : k%2; if(col===0 && ctx.y()+h+8>285) ctx.newPage(); const X=M+col*(w+6), Y=ctx.y();
      doc.addImage(x.url,"JPEG",X,Y,w,h); doc.setDrawColor(200); doc.rect(X,Y,w,h);
      doc.setFontSize(8); doc.setTextColor(...mut); doc.text(ctx.T(`Bloco ${blcRot(x.f)} · ${nf(x.f.A,0)} m²`), X+2, Y+h+3.6);
      if(col===1 || k===imgs.length-1) ctx.setY(Y+h+8) });
    const av=(I.av||[]); if(av.length){ doc.setFontSize(8.5); doc.setTextColor(...warn);
      av.forEach(a=>{ const L=doc.splitTextToSize(ctx.T(a), PW-2*M); if(ctx.y()+L.length*4>285) ctx.newPage(); doc.text(L, M, ctx.y()); ctx.setY(ctx.y()+L.length*4+1) }); doc.setTextColor(...ink) }
    ctx.setY(ctx.y()+4);
  });
});
