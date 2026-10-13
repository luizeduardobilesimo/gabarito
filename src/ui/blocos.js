/* ================= C1 — forma livre da torre (interface) =================
   Produto › seção "Forma das torres" (blcSecHTML, atualizada por blcLive no STEP_LIVE do Produto):
     Automática | Desenhada · por torre: "Personalizar" (copia a forma automática — nada muda nos números),
     formatos prontos (retângulo, L, U, T, H, pátio; clicar de novo no mesmo gira 90°), "Editar na implantação",
     "Refazer da automática", "Apagar forma" (a torre volta à automática) · "Ajustar mix".
   Implantação (ferramenta Editar), com as MESMAS interações e o mesmo visual do entorno (src/ui/entorno.js):
     clique na torre desenhada = seleciona · arrastar = move · quadrado do canto = redimensiona · setas = ajuste fino ·
     Delete = apaga a forma · Esc = solta · vértice: arraste (clique duplo remove) · ponto no meio do lado = vértice novo.
     Barra flutuante #blcBar (classe .entbar): ±tamanho, giro 15°, pátio, duplicar (nova torre), apagar, soltar.
   Destaques: parte sobre os recuos (hachura vermelha), fora do embasamento (hachura amarela), núcleo fora da planta,
   torres próximas demais (cota vermelha). Cálculo em src/calc/blocos.js. A seleção (BLC) não entra no estudo nem no desfazer. */
const BLC = { sel:-1, open:-1, sig:"", solta:false };
const BLC_NOMES = { auto:"personalizada", ret:"retângulo", L:"em L", U:"em U", T:"em T", H:"em H", patio:"com pátio" };
const blcB = i => blcBloco(S, i);
const blcLista = () => blcAtivo(S) ? S.produto.torres.map((_,i)=>i).filter(i=>blcB(i)) : [];
const blcM = () => window._last && window._last.m;
/* vértices editáveis (views.js → editables/hitVertex) */
function blcEditaveis(){ if(typeof VIEW==="undefined" || VIEW!=="impl") return []; const out=[];
  blcLista().forEach(i=>{ const b=blcB(i); out.push({arr:b.pts, kind:"bloco"}); (b.vazios||[]).forEach(v=>out.push({arr:v, kind:"blcvazio"})) }); return out }
const blcDoArr = arr => blcLista().find(i=>{ const b=blcB(i); return b.pts===arr || (b.vazios||[]).includes(arr) }) ?? -1;
function blcSel(i){ BLC.sel=i; if(i>=0 && typeof ENT!=="undefined" && ENT.sel.size){ ENT.sel=new Set(); if(typeof entCardRefresh==="function") entCardRefresh() } redraw2d() }
const blcCopia = b => JSON.parse(JSON.stringify({pts:b.pts, vazios:b.vazios||[]}));

/* ---------- ponteiro (chamado por entDown/entDrag/entUp em src/ui/entorno.js) ---------- */
function blcEscalaPos(b){ const bb=entBBox(b); return [bb[2], bb[1]] }
function blcHitEscala(px,py){ const b=BLC.sel>=0 && blcB(BLC.sel); if(!b) return false; const [x,y]=w2s_(blcEscalaPos(b)); return Math.hypot(x-px,y-py)<11 }
function blcHitMeio(px,py){ const b=BLC.sel>=0 && blcB(BLC.sel); if(!b) return null; let best=null, bd=10;
  [b.pts, ...(b.vazios||[])].forEach(arr=>arr.forEach((a,k)=>{ const c=arr[(k+1)%arr.length], A=w2s_(a), B=w2s_(c), d=Math.hypot((A[0]+B[0])/2-px,(A[1]+B[1])/2-py); if(d<bd){ bd=d; best={arr,k} } })); return best }
function blcCorpo(w){ let best=-1, ba=Infinity; blcLista().forEach(i=>{ const b=blcB(i); if(G.pip(w,b.pts)){ const a=G.area(b.pts); if(a<ba){ ba=a; best=i } } }); return best }
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
  const i=blcCorpo(w);
  if(i>=0){ if(i!==BLC.sel) blcSel(i); return {type:"entBlcMove", blc:true, i, last:w, moved:false} }
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
/* teclado: Delete apaga a forma, Esc solta, setas movem (Shift = 5 m) */
document.addEventListener("keydown",e=>{
  if(typeof VIEW==="undefined" || VIEW!=="impl" || TOOL!=="edit" || BLC.sel<0 || !blcB(BLC.sel)) return;
  const a=document.activeElement; if(a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)) return;
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  if(e.key==="Delete"||e.key==="Backspace"){ e.preventDefault(); blcApaga(BLC.sel); return }
  if(e.key==="Escape"){ BLC.sel=-1; redraw2d(); return }
  const dd={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]}[e.key];
  if(dd){ e.preventDefault(); const p=e.shiftKey?5:0.5; entMove(blcB(BLC.sel),dd[0]*p,dd[1]*p); clearTimeout(blcTecla.t); blcTecla.t=setTimeout(()=>update(),200); update({fast:true}) }
});
const blcTecla={ t:0 };

/* ---------- ações ---------- */
function blcGarante(i){ const B=S.blocos; B.torres=B.torres||[]; while(B.torres.length<=i) B.torres.push({blocos:[]}); return B.torres[i] }
function blcApaga(i){ const t=(S.blocos.torres||[])[i]; if(!t || !t.blocos.length) return; t.blocos=[]; if(BLC.sel===i) BLC.sel=-1; update(); toast(`Torre ${i+1} voltou à forma automática — Ctrl+Z desfaz`) }
/* mudanças na lista de torres (src/ui/produto.js): mantém o índice dos blocos alinhado com S.produto.torres */
function blcTorreNova(i){ const B=S.blocos; if(B && B.torres && B.torres[i]) B.torres[i]={blocos:[]} }
function blcTorreRemovida(i){ const B=S.blocos; if(B && B.torres && i<B.torres.length) B.torres.splice(i,1); BLC.sel=-1; BLC.open=-1 }
function blcEnquadra(i){ const b=blcB(i); if(!b) return; if(VIEW!=="impl") setView("impl"); const r=c2.getBoundingClientRect(); if(r.width) VS.impl=fitView([S.lote.pts, b.pts], r.width, r.height, 1.5); redraw2d() }
Object.assign(ACT,{
  blcTog: b=>{ const i=+b.dataset.i; BLC.open = BLC.open===i? -1 : i; const m=blcM(); if(m) blcLive(m) },
  blcPers: b=>{ const i=+b.dataset.i; if(!blcPersonaliza(S,i)){ toast("Esta torre ainda não tem forma para copiar"); return } BLC.open=i; update();
    toast(`Torre ${i+1} personalizada — escolha um formato ou edite na implantação`) },
  blcFmt: b=>{ const i=+b.dataset.i, t=b.dataset.t, m=blcM(), alvo=m&&m.T[i]? m.T[i].A : 0, r=blcAplicaFormato(S,i,t); if(!r){ toast("Esse formato não coube na faixa da torre"); return }
    BLC.open=i; update(); const nome=(BLC_FORMAS.find(f=>f[0]===t)||[])[1]||t;
    toast(r.curto? `${nome}: coube ${m2(r.A)} de ${m2(alvo)} — a faixa da torre limita` : `${nome} aplicado — clique de novo para girar 90°`) },
  blcEdit: b=>{ const i=+b.dataset.i; if(VIEW!=="impl") setView("impl"); setTool("edit"); blcSel(i); blcEnquadra(i) },
  blcRefaz: b=>{ const i=+b.dataset.i; if(blcPersonaliza(S,i)){ update(); toast(`Torre ${i+1}: forma automática copiada de novo`) } },
  blcDel: b=>blcApaga(+b.dataset.i),
  blcMix: ()=>{ const m=blcM(), R=m && blcResumo(S,m); if(!R || !R.muda) return; S.produto.mix.forEach((u,j)=>u.qtd=R.q[j]); update();
    toast(`Mix ajustado: ${R.q.reduce((s,n)=>s+n,0)} unidades por andar — Ctrl+Z desfaz`) },
  blcMais: ()=>{ const b=blcB(BLC.sel); if(b){ entEscala(b, Math.sqrt(1.1)); update() } },
  blcMenos: ()=>{ const b=blcB(BLC.sel); if(b){ entEscala(b, 1/Math.sqrt(1.1)); update() } },
  blcGiraE: ()=>{ const b=blcB(BLC.sel); if(b){ entGira(b, 15); update() } },
  blcGiraD: ()=>{ const b=blcB(BLC.sel); if(b){ entGira(b, -15); update() } },
  blcPatio: ()=>{ const b=blcB(BLC.sel); if(!b) return; const v=entPatio(b, 0.2); if(!v){ toast("Não coube um pátio nessa forma"); return } (b.vazios=b.vazios||[]).push(v); update(); toast("Pátio criado — arraste os vértices para ajustar") },
  blcVazioX: el=>{ const b=blcB(BLC.sel); if(b && b.vazios){ b.vazios.splice(+el.dataset.i,1); if(!b.vazios.length) delete b.vazios; update() } },
  blcDup: ()=>{ const i=BLC.sel, b=blcB(i), P=S.produto, m=blcM(); if(!b || !m) return; if(P.torres.length>=4){ toast("O estudo aceita até 4 torres"); return }
    const ax=m.axis||G.longestDir(b.pts), [a0,a1]=G.extent(b.pts,ax), d=(a1-a0)+(m.gap||10), L=S.lote.pts;
    const cand=[d,-d].map(s=>{ const c=blcCopia(b); entMove(c, ax[0]*s, ax[1]*s); return c }), dentro=c=>G.area(G.clipToPoly(c.pts, L));
    const c=dentro(cand[0])>=dentro(cand[1])? cand[0] : cand[1], nb={pts:c.pts, de:1, tipo:b.tipo, rot:b.rot}; if(c.vazios.length) nb.vazios=c.vazios;
    P.torres.push({pav:P.torres[i].pav}); const n=P.torres.length-1; blcGarante(n).blocos=[nb]; BLC.sel=n; BLC.open=n;
    if(TAB==="produto") renderTab(); else update(); toast(`Torre ${n+1} criada com a mesma forma — Ctrl+Z desfaz`) },
  blcApagaSel: ()=>{ if(BLC.sel>=0) blcApaga(BLC.sel) },
  blcSolta: ()=>{ BLC.sel=-1; redraw2d() },
});

/* ---------- barra flutuante (mesmo visual do entorno) ---------- */
function blcBarHTML(i){
  const b=blcB(i), m=blcM(), t=m && m.T[i] || {}, nv=b.vazios||[];
  return `<div class="eg"><span class="cnt">Torre ${i+1}</span><span class="mt">${m2(t.A||0)}/andar</span></div>
    <div class="eg"><button class="btn" data-act="blcMenos" title="Reduzir a área 10%">− Tamanho</button><button class="btn" data-act="blcMais" title="Aumentar a área 10%">+ Tamanho</button>
      <button class="btn" data-act="blcGiraE" title="Girar 15° anti-horário" aria-label="Girar 15° anti-horário">↺</button><button class="btn" data-act="blcGiraD" title="Girar 15° horário" aria-label="Girar 15° horário">↻</button></div>
    <div class="eg">${nv.length? nv.map((v,k)=>`<span class="chip">pátio ${nf(G.area(v),0)} m²<button data-act="blcVazioX" data-i="${k}" aria-label="Remover pátio" title="Remover pátio">×</button></span>`).join("")
      : `<button class="btn" data-act="blcPatio" title="Abre um pátio central (vazio) na torre">Pátio</button>`}</div>
    <div class="eg"><button class="btn" data-act="blcDup" title="Nova torre com esta forma, ao lado">Duplicar</button><button class="btn warn" data-act="blcApagaSel" title="A torre volta à forma automática (Delete)">Apagar</button><button class="btn ghost" data-act="blcSolta" title="Esc">Soltar</button></div>`;
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
  const m=blcM(), b=blcB(BLC.sel), sig=[BLC.sel, (b.vazios||[]).map(v=>nf(G.area(v),0)).join(), m && m.T[BLC.sel]? nf(m.T[BLC.sel].A,0) : ""].join("|");
  if(sig!==BLC.sig || !bar.innerHTML){ BLC.sig=sig; bar.innerHTML=blcBarHTML(BLC.sel) }
}
function blcCss(){ if(document.getElementById("blcCss")) return; const s=document.createElement("style"); s.id="blcCss";
  s.textContent=`.entbar .mt{font-family:var(--f-mono);font-size:11px;color:var(--muted);padding-right:2px;white-space:nowrap}
.blc-fm{display:flex;flex-wrap:wrap;gap:6px}
.blc-fm .chip{padding:5px 11px 5px 9px;gap:7px}
.blc-fm .chip::before{display:none}
.blc-fm .chip svg{width:14px;height:14px;fill:currentColor;opacity:.8;flex:none}
.blc-av{display:grid;gap:3px}
.blc-av p{margin:0;font-size:11.5px;line-height:1.4;color:var(--warn)}`; document.head.appendChild(s) }

/* ---------- desenho na implantação (destaques e alças) ---------- */
HOOK.draw2d.push((g, ctx)=>{
  if(ctx.mode!=="impl" || !blcAtivo(S)) return;
  const m=ctx.m, w2s=ctx.w2s, lst=blcLista(); if(!lst.length || !m || !m.T) return;
  const ring=p=>p.forEach((q,k)=>{ const [x,y]=w2s(q); k?g.lineTo(x,y):g.moveTo(x,y) });
  const path=p=>{ g.beginPath(); ring(p); g.closePath() };
  // hachura da parte da planta fora de um polígono (recuos, embasamento)
  const hach=(pl, fora, col)=>{ if(!pl.length || !fora || fora.length<3) return; g.save(); path(pl); g.clip(); g.beginPath(); g.rect(0,0,ctx.W,ctx.H); ring(fora); g.closePath(); g.clip("evenodd");
    g.fillStyle=col; g.globalAlpha=0.16; g.fillRect(0,0,ctx.W,ctx.H); g.globalAlpha=0.75; g.strokeStyle=col; g.lineWidth=1.2; g.beginPath(); for(let x=-ctx.H; x<ctx.W; x+=7){ g.moveTo(x,ctx.H); g.lineTo(x+ctx.H,0) } g.stroke(); g.restore() };
  lst.forEach(i=>{ const t=m.T[i], I=(m.blc||[]).find(x=>x.i===i)||{}, b=blcB(i); if(!t) return;
    if(I.foraRecuo>0.5) hach(t.plate, m.torAll, css("--bad"));
    if(I.balanco>0.5) hach(t.plate, m.emb, css("--warn"));
    if(I.foraLote>0.5){ path(b.pts); g.setLineDash([6,4]); g.strokeStyle=css("--bad"); g.lineWidth=1.6; g.stroke(); g.setLineDash([]) }
    const l=m.tipo && m.tipo[i]; if(I.nucleo===false && l && l.core && l.core.length){ path(l.core); g.fillStyle=css("--bad"); g.globalAlpha=0.25; g.fill(); g.globalAlpha=1; g.strokeStyle=css("--bad"); g.lineWidth=1.6; g.setLineDash([4,3]); g.stroke(); g.setLineDash([]) }
  });
  // torres próximas demais: cota entre os pontos mais próximos
  (m.blcPares||[]).forEach(p=>{ const A=m.T[p.a].plate, B=m.T[p.b].plate, c=blcPerto(A,B); if(!c) return; const [x1,y1]=w2s(c[0]), [x2,y2]=w2s(c[1]);
    g.strokeStyle=css("--bad"); g.lineWidth=1.6; g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke(); [[x1,y1],[x2,y2]].forEach(([x,y])=>{ g.beginPath(); g.arc(x,y,2.6,0,7); g.fillStyle=css("--bad"); g.fill() });
    const t=p.d<0.01? "sobreposição" : `${nf(p.d,1)} m < ${nf(m.gap,1)} m`; g.font="600 10.5px "+css("--f-mono"); const tw=g.measureText(t).width+8, mx=(x1+x2)/2, my=(y1+y2)/2;
    g.fillStyle=css("--surface"); g.globalAlpha=.92; g.fillRect(mx-tw/2,my-8,tw,16); g.globalAlpha=1; g.fillStyle=css("--bad"); g.textAlign="center"; g.textBaseline="middle"; g.fillText(t,mx,my) });
  if(!ctx.opt.handles) return;
  // alças: vértices de todas as formas; a selecionada ganha contorno, meios dos lados e o quadrado de redimensionar
  lst.forEach(i=>{ const b=blcB(i), on=BLC.sel===i;
    if(on){ path(b.pts); g.fillStyle=css("--accent"); g.globalAlpha=0.12; g.fill(); g.globalAlpha=1; g.strokeStyle=css("--accent"); g.lineWidth=2.4; g.stroke() }
    else { path(b.pts); g.strokeStyle=css("--accent"); g.globalAlpha=0.55; g.lineWidth=1.2; g.setLineDash([5,4]); g.stroke(); g.setLineDash([]); g.globalAlpha=1 }
    (b.vazios||[]).forEach(v=>{ const ok=entVazioOk(b,v); path(v); g.strokeStyle= ok? css("--accent") : css("--bad"); g.setLineDash([5,4]); g.lineWidth=1.6; g.stroke(); g.setLineDash([]) });
    [b.pts, ...(b.vazios||[])].forEach(arr=>arr.forEach(q=>{ const [x,y]=w2s(q), r=on?4:3; g.fillStyle=on? css("--accent") : css("--muted"); g.fillRect(x-r,y-r,2*r,2*r) }));
    if(on){ [b.pts, ...(b.vazios||[])].forEach(arr=>arr.forEach((a,k)=>{ const c=arr[(k+1)%arr.length], [x,y]=w2s([(a[0]+c[0])/2,(a[1]+c[1])/2]); g.fillStyle=css("--accent"); g.globalAlpha=0.55; g.beginPath(); g.arc(x,y,3,0,7); g.fill(); g.globalAlpha=1 }));
      const [x,y]=w2s(blcEscalaPos(b)); g.fillStyle=css("--surface"); g.strokeStyle=css("--accent"); g.lineWidth=2; g.beginPath(); g.rect(x-6,y-6,12,12); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(x-2.5,y+2.5); g.lineTo(x+2.5,y-2.5); g.moveTo(x+0.5,y-2.5); g.lineTo(x+2.5,y-2.5); g.lineTo(x+2.5,y-0.5); g.stroke() }
  });
});
/* pontos mais próximos entre dois contornos (vértice de um × lado do outro) */
function blcPerto(A, B){ let best=null, bd=Infinity;
  const pr=(p,a,b)=>{ const vx=b[0]-a[0], vy=b[1]-a[1], L=vx*vx+vy*vy||1e-9, t=Math.max(0,Math.min(1,((p[0]-a[0])*vx+(p[1]-a[1])*vy)/L)); return [a[0]+t*vx, a[1]+t*vy] };
  const run=(P,Q,sw)=>P.forEach(p=>Q.forEach((a,k)=>{ const q=pr(p,a,Q[(k+1)%Q.length]), d=Math.hypot(q[0]-p[0],q[1]-p[1]); if(d<bd){ bd=d; best= sw? [q,p] : [p,q] } }));
  run(A,B,false); run(B,A,true); return best }

/* ---------- seção "Forma das torres" (Produto) ---------- */
const BLC_IC = { ret:"M3 4h10v8H3z", L:"M3 3h4v6h6v4H3z", U:"M2 3h4v6h4V3h4v10H2z", T:"M2 3h12v4H10v6H6V7H2z", H:"M2 3h4v3h4V3h4v10h-4v-3H6v3H2z", patio:"M2 3h12v10H2zM6 6v4h4V6z" };
const blcIc = k => `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill-rule="evenodd" d="${BLC_IC[k]}"/></svg>`;
function blcSum(){ if(!blcAtivo(S)) return "automática"; const n=blcLista().length, N=S.produto.torres.length; return n? `desenhada · ${n} de ${N} torre${N>1?"s":""}` : "desenhada · nenhuma personalizada" }
function blcSecHTML(){
  blcCss(); const on=blcAtivo(S), salvas=(S.blocos.torres||[]).filter(t=>t && t.blocos && t.blocos.length).length;
  const body = ROW(`Forma${INFO("Automática: a torre sai das regras e do mix (recuos, faixa de cada torre, área do mix ÷ eficiência). Desenhada: você personaliza a planta de cada torre — copiando a automática, com um formato pronto (retângulo, L, U, T, H, pátio) ou editando na implantação. A planta desenhada não encolhe: recuos, TO, CA, gabarito, balanço, núcleo e distância entre torres viram avisos. Voltar para Automática guarda as formas.","forma das torres")}`,
      SEG("blocos.modo",[["auto","Automática"],["desenhada","Desenhada"]],{label:"Forma das torres"}))
    + (on ? `<div class="list" id="blcList"></div><div id="blcGeral"></div>`
          : salvas ? `<p class="note">${salvas} forma${salvas>1?"s":""} guardada${salvas>1?"s":""} — volta${salvas>1?"m":""} ao escolher Desenhada.</p>` : "");
  return SEC("Forma das torres", body, {key:"pr-forma", sum:blcSum(), info:"Planta das torres: automática pelas regras ou desenhada por você, torre a torre."});
}
/* avisos curtos de uma torre (o texto completo fica nos avisos do estudo, em Projeto) */
function blcCurtos(I){ if(!I) return []; const o=[];
  if(I.foraLote>0.5) o.push(`${m2(I.foraLote)} fora do lote`); if(I.foraRecuo>0.5) o.push(`${m2(I.foraRecuo)} sobre os recuos`);
  if(I.balanco>0.5) o.push(`${m2(I.balanco)} em balanço`); if(I.nucleo===false) o.push("núcleo fora da planta"); return o }
function blcLive(m){
  setSum("pr-forma", blcSum());
  if(!blcAtivo(S) || !document.getElementById("blcList")) return;
  const P=S.produto;
  setHTML("blcList", P.torres.map((tw,i)=>{ const b=blcB(i), t=m.T[i]||{}, nome=`Torre ${i+1}`, I=(m.blc||[]).find(x=>x.i===i), cu=blcCurtos(I);
    const pares=(m.blcPares||[]).filter(p=>p.a===i||p.b===i).map(p=>p.d<0.01? `sobrepõe a torre ${(p.a===i?p.b:p.a)+1}` : `${nf(p.d,1)} m da torre ${(p.a===i?p.b:p.a)+1}`);
    const av=[...cu, ...pares], open=!!b && BLC.open===i;
    if(!b) return `<div class="pr-row"><div class="pr-rh"><div class="pr-tx"><b>${nome}</b><span>automática · ${m2(t.A||0)}/andar</span></div>
      <button type="button" class="btn sm" data-act="blcPers" data-i="${i}" title="Copia a forma automática atual para uma forma editável">Personalizar</button></div></div>`;
    const sub=`${BLC_NOMES[b.tipo]||"desenhada"} · ${m2(t.A||0)}/andar · unidades a ${pct(t.r||0,0)} do mix`;
    return `<div class="pr-row${open?" on":""}${av.length?" warn":""}" data-row="blc:${i}"><div class="pr-rh">
        <button type="button" class="pr-tx" data-act="blcTog" data-i="${i}" aria-expanded="${open}"><b>${nome}</b><span>${sub}</span>${av.length?`<span class="w">${av.join(" · ")}</span>`:""}</button>
        <button type="button" class="pr-ic lbl" data-act="blcEdit" data-i="${i}" title="Selecionar e editar na implantação" aria-label="Editar a ${nome.toLowerCase()} na implantação">Editar</button>
        <button type="button" class="pr-ic chev" data-act="blcTog" data-i="${i}" aria-expanded="${open}" aria-label="${open?"Fechar":"Abrir"} ${nome}" title="${open?"Fechar":"Formatos e opções"}">${PR_IC.chev}</button></div>
      ${open? `<div class="pr-rb"><span class="fl">Formatos prontos${INFO("Gerados dentro da faixa da torre (recuos e divisão entre torres), com a área atual do andar. Alas de 12,6 m (dois apartamentos de 5,5 m e corredor de 1,6 m). Clique de novo no mesmo formato para girar 90°. Depois, ajuste os vértices na implantação.","formatos prontos")}</span>
        <div class="blc-fm" role="group" aria-label="Formatos prontos">${BLC_FORMAS.map(([k,l])=>`<button type="button" class="chip" data-act="blcFmt" data-i="${i}" data-t="${k}" aria-pressed="${b.tipo===k}" title="${b.tipo===k?"Clique de novo para girar 90°":"Aplicar "+l.toLowerCase()}">${blcIc(k)}${l}</button>`).join("")}</div>
        <div class="pr-rf"><button type="button" class="btn sm ghost" data-act="blcRefaz" data-i="${i}" title="Copia de novo a forma automática">Refazer da automática</button>${prRm("blcDel", i, "forma da "+nome.toLowerCase(), "Apagar forma")}</div></div>` : ""}</div>` }).join(""));
  const R=blcResumo(S,m), G2=(m.blcGeral||[]).filter(a=>!/^O mix ocupa/.test(a));
  setHTML("blcGeral", (R? `<div class="row sb"><span class="note"${R.desvio?' style="color:var(--warn)"':""}>O mix ocupa ${pct(R.ocupa,0)} do pavimento desenhado</span>${R.muda? `<button type="button" class="btn sm" data-act="blcMix" title="Muda a quantidade de unidades por andar para o mix voltar ao tamanho original">Ajustar mix</button>` : ""}</div>` : "")
    + (G2.length? `<div class="blc-av">${G2.map(a=>`<p>${esc(a)}</p>`).join("")}</div>` : ""));
}
