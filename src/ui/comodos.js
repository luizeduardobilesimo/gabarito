/* ================= 1.2 plantas das unidades: desenho, edição da grade e inspetor =================
   Desenho (chamado pelo tipoBody do plan2d, também nos Andares e no PDF): paredes em poché (a unidade cheia na cor da
   parede e cada cômodo recuado pela meia-parede), vãos de porta com folha e arco, janelas na fachada, mobiliário (as
   posições que a validação achou), nomes/áreas e o destaque dos ambientes com problema (contorno --bad/--warn).
   Edição: arrastar as linhas da grade do partido na planta tipo (views.js chama comHit/comDragMove/comDragEnd); o ajuste
   vale para a tipologia inteira e fixa o partido (S.comodos.tipos[i].partido). Inspetor: Projeto › Andares › "Plantas das
   unidades" (resumo com a nota média; por tipologia a galeria de partidos com miniatura e a nota na unidade real — marcar
   quais tentar —, os problemas da planta escolhida e "Meus modelos" → aptoEditorAbrir do editor, quando existir). */
let COMHOV=null, COMDRAG=null;

const COM_COR = { sala:"pal", sacada:"--c-sac", dorm:"pal", suite:"pal", office:"pal", closet:"pal", circ:"--surface", cozinha:"--c-ant", serv:"--c-ant", desp:"--c-ant", banho:"--c-ant", bsuite:"--c-ant", lavabo:"--c-ant" };

/* CSS da miniatura (aptoMiniSVG) e da galeria; idempotente (o editor de modelos também chama) */
function aptoMiniEstilo(){ if(typeof document==="undefined" || document.getElementById("aptoMiniCss")) return; const s=document.createElement("style"); s.id="aptoMiniCss"; s.textContent=aptoMiniCss()+`
.comT{display:grid;gap:8px;padding:10px 0 4px;border-top:1px solid var(--line)}
.comT:first-of-type{border-top:0;padding-top:2px}
.comT .hd{display:flex;align-items:center;gap:8px;min-width:0}
.comT .hd b{font-family:var(--f-sans);font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.comGal{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:6px}
.comPc{all:unset;box-sizing:border-box;display:grid;gap:4px;align-content:start;padding:6px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--surface);cursor:pointer;transition:border-color .15s var(--ease),box-shadow .15s var(--ease);min-width:0}
.comPc:hover{border-color:var(--line-2)}
.comPc:focus-visible{outline:2px solid var(--sel);outline-offset:1px}
.comPc[aria-pressed="false"]{opacity:.55}
.comPc[aria-pressed="false"] .apto-mini{filter:grayscale(1)}
.comPc.uso{border-color:var(--sel);box-shadow:inset 0 0 0 1px var(--sel)}
.comPc .nm{font-size:11px;line-height:1.25;color:var(--ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.comPc .nt{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums}
.comPc .nt i{width:7px;height:7px;border-radius:50%;background:var(--faint);flex:none}
.comPc .nt i.ok{background:var(--ok)} .comPc .nt i.warn{background:var(--warn)} .comPc .nt i.bad{background:var(--bad)}
.comPc .ck{justify-self:end;margin:-2px -2px 0 0;width:14px;height:14px;border-radius:4px;border:1px solid var(--line-2);display:grid;place-items:center;font-size:10px;line-height:1;color:var(--sel-ink,var(--surface))}
.comPc[aria-pressed="true"] .ck{background:var(--sel);border-color:var(--sel)}
.comPc .ck::after{content:"✓";visibility:hidden} .comPc[aria-pressed="true"] .ck::after{visibility:visible}
.comPc .tp{display:flex;align-items:center;justify-content:space-between;gap:4px;font-size:10px;color:var(--muted)}
.comPc.nc{opacity:.62} .comPc.nc .apto-mini{filter:grayscale(1)} .comPc.nc:hover{opacity:.9}
.comPc .nt .mt{color:var(--muted);line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.comSep{grid-column:1/-1;display:flex;align-items:center;gap:8px;margin:4px 0 0;font-size:11px;color:var(--muted)}
.comSep::after{content:"";flex:1;height:1px;background:var(--line)}
.comPb{display:grid;gap:3px;font-size:12px;color:var(--ink-2)}
.comPb div{display:flex;gap:6px;align-items:baseline} .comPb .dot{flex:none;transform:translateY(-1px)}
.comAc{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
@media (max-width:900px){ .comGal{grid-template-columns:repeat(auto-fill,minmax(88px,1fr))} }
`; document.head.appendChild(s) }
aptoMiniEstilo();

/* desenho de uma planta tipo: devolve true se desenhou os cômodos */
function comDraw(g, lay, K){
  if(!S.comodos || !S.comodos.on || !lay || !lay.units.some(u=>u.com)) return false;
  const {w2s, V, css}=K, s=V.s, ink=css("--ink"), pal=K.pal||[], names=K.names||[];
  const path=p=>{ g.beginPath(); p.forEach((q,i)=>{ const [x,y]=w2s(q); i?g.lineTo(x,y):g.moveTo(x,y) }); g.closePath() };
  const fill=(p,col,a=1)=>{ if(!p||p.length<3) return; path(p); g.globalAlpha=a; g.fillStyle=col; g.fill(); g.globalAlpha=1 };
  const add=(p,v,k)=>[p[0]+v[0]*k, p[1]+v[1]*k];
  const quad=(a,b,n,t0,t1)=>[add(a,n,t0),add(b,n,t0),add(b,n,t1),add(a,n,t1)];
  const surf=css("--surface"), acc=css("--d-acc"), ink2=css("--ink-2"), cBad=css("--bad"), cWarn=css("--warn");
  const roomCol=(u,r)=>{ const c=COM_COR[r.k]||"--surface"; return c==="pal"? (pal[names.indexOf(u.nome)%Math.max(1,pal.length)]||surf) : css(c) };
  const roomA=r=> r.k==="sacada"? 0.55 : COM_COR[r.k]==="pal"? 0.42 : r.k==="circ"? 1 : 0.85;
  const placed=[];   // etiquetas já desenhadas (evita sobreposição no corredor)
  lay.units.forEach((u,ui)=>{ const c=u.com; if(!c) return;
    // unidade em que nenhum partido cabe: nada de planta "só para caber" — a unidade vazia, tracejada, com o motivo
    if(c.semPartido){ comSemPartido(g, u, K, placed); return }
    // 1. poché: a unidade inteira na cor da parede; cada cômodo por cima, recuado pela meia-parede
    fill(u.poly, ink, 1);
    const ins=c.rooms.map(r=>comInsetRoom(r));
    c.rooms.forEach((r,i)=>{ fill(ins[i], surf, 1); fill(ins[i], roomCol(u,r), roomA(r)) });
    // 2. portas e vãos
    c.doors.forEach(d=>{ const A=c.rooms[d.into], B=d.from!=null? c.rooms[d.from] : null; if(!A) return;
      if(d.k==="pj"){ fill(quad(d.p0,d.p1,d.n,-0.075,0.075), surf, 1); [-0.025,0.025].forEach(o=>{ const P=add(d.p0,d.n,o), Q=add(d.p1,d.n,o), a=w2s(P), b=w2s(Q); g.strokeStyle=acc; g.lineWidth=1; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke() }); return }
      const tIn = d.k==="entrada"? COM_WALL.corredor+0.03 : 0.08;
      fill(quad(d.p0,d.p1,d.n,0,tIn), surf, 1); fill(quad(d.p0,d.p1,d.n,0,tIn), roomCol(u,A), roomA(A));
      if(B && d.k!=="entrada"){ fill(quad(d.p0,d.p1,d.n,-0.08,0), surf, 1); fill(quad(d.p0,d.p1,d.n,-0.08,0), roomCol(u,B), roomA(B)) }
      if(d.k==="porta"||d.k==="entrada"){ const H= d.hinge==="hi"? d.p1 : d.p0, O= d.hinge==="hi"? d.p0 : d.p1, w=Math.hypot(O[0]-H[0],O[1]-H[1]), L=add(H,d.n,w);
        const h=w2s(H), l=w2s(L), o=w2s(O), r=Math.hypot(l[0]-h[0],l[1]-h[1]);
        g.strokeStyle=ink; g.lineWidth=Math.max(1,Math.min(1.6,s*0.06)); g.beginPath(); g.moveTo(...h); g.lineTo(...l); g.stroke();
        if(r>3){ const a0=Math.atan2(l[1]-h[1],l[0]-h[0]), a1=Math.atan2(o[1]-h[1],o[0]-h[0]); let da=a1-a0; while(da>Math.PI) da-=2*Math.PI; while(da<-Math.PI) da+=2*Math.PI;
          g.lineWidth=0.7; g.globalAlpha=0.55; g.beginPath(); g.arc(h[0],h[1],r,a0,a0+da,da<0); g.stroke(); g.globalAlpha=1 } }
    });
    // 3. janelas (vão na parede de fachada + dois traços de vidro)
    c.windows.forEach(wd=>{ const nIn=[-wd.n[0],-wd.n[1]], t=COM_WALL.fachada; fill(quad(wd.p0,wd.p1,nIn,-0.01,t+0.005), surf, 1);
      g.strokeStyle=acc; g.lineWidth=Math.max(0.8,Math.min(1.3,s*0.05)); [t*0.38,t*0.62].forEach(o=>{ const a=w2s(add(wd.p0,nIn,o)), b=w2s(add(wd.p1,nIn,o)); g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke() });
      g.strokeStyle=ink; g.lineWidth=1; [wd.p0,wd.p1].forEach(p=>{ const a=w2s(p), b=w2s(add(p,nIn,t)); g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke() }) });
    // 4. mobiliário
    if(S.comodos.movel && s>9){ g.lineWidth=0.75; g.strokeStyle=ink2;
      (c.movel||[]).forEach(f=>{ if(f.t==="c"){ const [x,y]=w2s(f.c); g.globalAlpha=0.9; g.fillStyle=surf; g.beginPath(); g.arc(x,y,f.r*s,0,7); g.fill(); g.globalAlpha=0.6; g.stroke(); g.globalAlpha=1; return }
        const P=f.pts; g.beginPath(); P.forEach((q,i)=>{ const [x,y]=w2s(q); i?g.lineTo(x,y):g.moveTo(x,y) }); if(f.t==="r"){ g.closePath(); if(f.k!=="trav"){ g.globalAlpha=0.9; g.fillStyle=surf; g.fill() } } g.globalAlpha=0.6; g.stroke(); g.globalAlpha=1 }) }
    // 5. ambientes com problema: contorno por dentro (vermelho = grave, âmbar = atenção)
    if(s>5) c.rooms.forEach((r,i)=>{ if(!r.nivel || r.k==="sacada") return; const p=comInset(ins[i], 0.05); if(p.length<3) return; path(p); g.strokeStyle= r.nivel==="bad"? cBad : cWarn; g.lineWidth= r.nivel==="bad"? 2 : 1.4; g.setLineDash(r.nivel==="bad"? [] : [5,3]); g.globalAlpha=0.9; g.stroke(); g.setLineDash([]); g.globalAlpha=1 });
    if(c.semPartido){ path(u.poly); g.strokeStyle=cBad; g.lineWidth=2.2; g.setLineDash([7,4]); g.stroke(); g.setLineDash([]) }
    // 6. nomes e áreas
    if(s>7.5) c.rooms.forEach((r,i)=>{ if(r.k==="circ") return; let p=r.c; if(!G.pip(p, r.poly)) p=r.rc;
      const P=w2s(p), xs=ins[i].map(q=>w2s(q)[0]), ys=ins[i].map(q=>w2s(q)[1]), bw=Math.max(...xs)-Math.min(...xs), bh=Math.max(...ys)-Math.min(...ys);
      const nome= r.k==="sacada"&&bw<44? "Sac." : r.k==="bsuite"? "Banho" : r.nome;
      g.textAlign="center"; g.textBaseline="middle";
      g.font=`600 ${s>16?10.5:9.5}px ${css("--f-sans")}`; const tw=g.measureText(nome).width; if(tw>bw-4 || bh<14) return;
      const two = bh>30 && s>10.5, y0 = two? P[1]-6 : P[1];
      g.lineWidth=3; g.strokeStyle=surf; g.globalAlpha=0.85; g.strokeText(nome,P[0],y0); g.globalAlpha=1; g.fillStyle=ink; g.fillText(nome,P[0],y0);
      if(two){ const t=nf(r.area,1)+" m²"; g.font=`500 9px ${css("--f-sans")}`; if(g.measureText(t).width<bw-4){ g.lineWidth=3; g.strokeStyle=surf; g.globalAlpha=0.85; g.strokeText(t,P[0],P[1]+6); g.globalAlpha=1; g.fillStyle=ink2; g.fillText(t,P[0],P[1]+6) } } });
    // 7. etiqueta da unidade no corredor, junto da porta de entrada
    const en=c.doors.find(d=>d.k==="entrada");
    if(en && s>4){ const m=[(en.p0[0]+en.p1[0])/2,(en.p0[1]+en.p1[1])/2], t= s>13? `${u.nome} · ${nf(u.alvo,1)} m²` : u.nome;
      g.font=`500 ${s>14?9.5:8.5}px ${css("--f-sans")}`; const tw=g.measureText(t).width+10, th=15;
      // no corredor, encostada na parede da unidade; desliza ao longo do corredor se encostar em outra etiqueta
      const off=Math.max(0.3, Math.min(0.8, (th/2+3)/s)), base=w2s(add(m,en.n,-off)), e0=w2s(en.p0), e1=w2s(en.p1), dl=Math.hypot(e1[0]-e0[0],e1[1]-e0[1])||1, along=[(e1[0]-e0[0])/dl,(e1[1]-e0[1])/dl];
      const hit=(x,y)=>placed.some(r=>Math.abs(r[0]-x)<(r[2]+tw)/2+4 && Math.abs(r[1]-y)<(r[3]+th)/2+2);
      const inC=(x,y)=>!K.W || (x-tw/2>=4 && x+tw/2<=K.W-4 && y-th/2>=0 && y+th/2<=K.H);
      let P=null; for(const k of [0,1,-1,2,-2,3,-3]){ const x=base[0]+along[0]*k*(tw*0.55), y=base[1]+along[1]*k*(tw*0.55); if(!hit(x,y) && inC(x,y)){ P=[x,y]; break } }
      if(P){ placed.push([P[0],P[1],tw,th]); g.fillStyle=surf; g.globalAlpha=0.94; g.beginPath(); if(g.roundRect) g.roundRect(P[0]-tw/2,P[1]-th/2,tw,th,th/2); else g.rect(P[0]-tw/2,P[1]-th/2,tw,th); g.fill(); g.globalAlpha=1;
        g.strokeStyle=c.semPartido? cBad : c.ok? css("--line-2") : css("--warn"); g.lineWidth=1; g.stroke(); g.fillStyle=ink; g.textAlign="center"; g.textBaseline="middle"; g.fillText(t,P[0],P[1]+0.5) } }
    // 8. divisões arrastáveis (unidade sob o cursor)
    const hov = COMDRAG? COMDRAG.ti===K.ti && COMDRAG.ui===ui : COMHOV && COMHOV.ti===K.ti && COMHOV.ui===ui;
    if(K.edit && hov){ (c.divs||[]).forEach(dv=>{ const a=w2s(dv.p0), b=w2s(dv.p1), on = (COMDRAG||COMHOV).id===dv.id;
      g.strokeStyle=acc; g.globalAlpha=on? 0.95 : 0.4; g.lineWidth=on? 3 : 2; g.setLineDash(on?[]:[4,3]); g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); g.setLineDash([]); g.globalAlpha=1;
      const mx=(a[0]+b[0])/2, my=(a[1]+b[1])/2; g.fillStyle=surf; g.strokeStyle=acc; g.lineWidth=1.5; g.beginPath(); g.arc(mx,my,on?5:4,0,7); g.fill(); g.stroke() }) }
  });
  return true;
}
/* unidade sem partido que caiba: fundo suave, contorno tracejado (--bad), "Nenhum partido cabe" e o motivo curto no meio */
function comSemPartido(g, u, K, placed){
  const {w2s, V, css}=K, s=V.s, path=p=>{ g.beginPath(); p.forEach((q,i)=>{ const [x,y]=w2s(q); i?g.lineTo(x,y):g.moveTo(x,y) }); g.closePath() };
  path(u.poly); g.fillStyle=css("--surface"); g.fill(); g.globalAlpha=0.55; g.fillStyle=css("--bad-soft")||css("--soft"); g.fill(); g.globalAlpha=1;
  g.strokeStyle=css("--bad"); g.lineWidth=2; g.setLineDash([7,4]); g.stroke(); g.setLineDash([]);
  if(s<4) return;
  const xs=u.poly.map(q=>w2s(q)[0]), ys=u.poly.map(q=>w2s(q)[1]), bh=Math.max(...ys)-Math.min(...ys); let bw=Math.max(...xs)-Math.min(...xs);
  const ret = u.poly.length===4, c = ret? G.centroid(u.poly) : aptoCirculoInscrito(u.poly).c;   // em L: no meio da parte mais larga
  let P=w2s(c); const mot=u.com.motivo || String(u.com.aviso||"").replace(/^nenhum partido cabe nesta unidade:\s*/,"").split(";")[0];
  // largura livre na linha do texto (unidade em L: só o trecho que contém o ponto), e o texto centrado nele
  { const S2=u.poly.map(q=>w2s(q)), xs2=[]; S2.forEach((a,i)=>{ const b=S2[(i+1)%S2.length]; if((a[1]-P[1])*(b[1]-P[1])<0) xs2.push(a[0]+(P[1]-a[1])*(b[0]-a[0])/(b[1]-a[1])) });
    xs2.sort((a,b)=>a-b); for(let i=0;i+1<xs2.length;i+=2) if(P[0]>=xs2[i]-1 && P[0]<=xs2[i+1]+1){ bw=xs2[i+1]-xs2[i]; P=[(xs2[i]+xs2[i+1])/2, P[1]]; break } }
  const linhas=[[u.nome, `600 ${s>14?11:10}px ${css("--f-sans")}`, css("--ink")], ["Nenhum partido cabe", `500 ${s>14?10:9}px ${css("--f-sans")}`, css("--bad")], [mot, `400 ${s>14?9.5:8.5}px ${css("--f-sans")}`, css("--ink-2")]];
  g.textAlign="center"; g.textBaseline="middle"; const lh=s>14?14:12; let y=P[1]-lh;
  linhas.forEach(([t,f,cor])=>{ if(!t) return; g.font=f; let tx=t; while(tx.length>8 && g.measureText(tx).width>bw-10) tx=tx.slice(0,-2); if(tx!==t) tx=tx.replace(/\s*\S*$/,"")+"…";
    if(bh>lh*3.2 && g.measureText(tx).width<=bw-6){ g.fillStyle=cor; g.fillText(tx, P[0], y) } y+=lh });
  placed.push([P[0],P[1],bw*0.6,lh*3]);
}
/* legenda (planta tipo e andares) */
function comLeg(sw){ if(!S.comodos||!S.comodos.on) return ""; const m=window._last && window._last.m, prob=m && m.comodos && (m.comodos.validas<m.comodos.unidades || (m.comodos.avisos||0)>0);
  return sw("var(--ink)","paredes")+sw("var(--c-ant)","áreas molhadas")+`<div><i style="background:none;border:0;border-top:2px solid var(--d-acc);height:0;margin-top:5px"></i>janelas</div>`+(prob? `<div><i style="background:none;border:2px solid var(--bad);border-radius:2px"></i>ambiente com problema</div>` : "") }

/* ---------- edição: arrastar as linhas da grade do partido ---------- */
function comSegDist(p,a,b){ const dx=b[0]-a[0], dy=b[1]-a[1], l2=dx*dx+dy*dy||1, t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2)); return Math.hypot(p[0]-a[0]-dx*t, p[1]-a[1]-dy*t) }
function comHit(px,py){
  if(!S.comodos||!S.comodos.on) return null; const m=window._last&&window._last.m, lay=m&&m.tipo&&m.tipo[TOWER]; if(!lay) return null;
  let best=null, bd=8;
  lay.units.forEach((u,ui)=>{ const c=u.com; if(!c || c.semPartido) return; (c.divs||[]).forEach(dv=>{ const a=w2s_(dv.p0), b=w2s_(dv.p1), d=comSegDist([px,py],a,b); if(d<bd){ bd=d; best={ti:TOWER, ui, id:dv.id, nome:u.nome, ax:dv.ax, lo:dv.lo, hi:dv.hi, o0:dv.o0, tot:dv.tot, a, b} } }) });
  return best;
}
function comHover(px,py){ const h=comHit(px,py), old=COMHOV; COMHOV=h;
  c2.style.cursor = h? (Math.abs(h.b[0]-h.a[0])>Math.abs(h.b[1]-h.a[1])? "ns-resize" : "ew-resize") : "";
  if(!!old!==!!h || (old&&h&&(old.id!==h.id||old.ui!==h.ui))) redraw2d() }
function comTipoEntry(nome){ const C=S.comodos; C.tipos=C.tipos||[]; let t=C.tipos.find(x=>x.nome===nome); if(!t){ t={nome, modelo:"auto", partidos:[], partido:null, cortes:{}, sel:-1}; C.tipos.push(t) } if(!t.cortes) t.cortes={}; if(!Array.isArray(t.partidos)) t.partidos=[]; return t }
function comDragMove(d, w){
  const m=window._last.m, u=m.tipo[d.ti]&&m.tipo[d.ti].units[d.ui], c=u&&u.com; if(!c) return;
  const a=w[0]*c.ax[0]+w[1]*c.ax[1], x= c.lado==="b"? c.a1-a : a-c.a0, y=w[0]*c.dn[0]+w[1]*c.dn[1]-c.d0;
  const t=comTipoEntry(d.nome), v=Math.max(d.lo, Math.min(d.hi, d.ax==="x"? x : y));
  t.cortes[d.id]=+((v-d.o0)/(d.tot||1)).toFixed(4); t.partido=c.partido; t.sel=-1; COMDRAG={...d};
  comodosCalc(m, S); redraw2d();
}
function comDragEnd(){ COMDRAG=null; update(); if(TAB==="projeto") renderTab() }

/* ---------- inspetor (Projeto › Andares › Plantas das unidades) ---------- */
function comTiposSync(){ const C=S.comodos; C.tipos=C.tipos||[]; [...new Set(S.produto.mix.map(u=>u.nome))].forEach(n=>comTipoEntry(n)) }
const comAreaDe = nome=>{ const it=S.produto.mix.find(u=>u.nome===nome); return it? it.area : 60 };
/* a tipologia usa um programa em que o lavabo é opcional (3 dormitórios ou mais)? */
function comLavOpc(nome){ const mk=comModeloDe(S, nome, comAreaDe(nome)); return !!COM_MODELOS[mk] && COM_MODELOS[mk].lavabo==="opc" }
/* modelos da biblioteca do usuário (editor), quando existe */
const comBib = ()=>{ try{ return typeof aptoBiblioteca==="function"? (aptoBiblioteca()||[]).filter(m=>m && m.id && Array.isArray(m.ambientes)) : [] }catch(e){ return [] } };
/* galeria de uma tipologia: [{mod, padrao (entra no automático), bib (só na biblioteca, ainda não copiado)}] */
function comGaleria(nome){
  const t=comTipoEntry(nome), tip=comModeloDe(S, nome, comAreaDe(nome)), auto=!(t.modelo && t.modelo!=="auto"), alt=auto && COM_ALT[tip], ks=[tip].concat(alt? [alt] : []);
  const us=(S.comodos.modelos||[]), out=[], vistos=new Set(), pus=(mod,padrao,bib)=>{ if(!mod || vistos.has(mod.id)) return; vistos.add(mod.id); out.push({mod, padrao, bib}) };
  ks.forEach(k=>{ APTO_CAT.filter(m=>m.tipologia===k).forEach(m=>pus(m,true,false)); us.filter(m=>m.tipologia===k).forEach(m=>pus(m,true,false)) });
  (t.partidos||[]).forEach(id=>pus(aptoModelo(id,S), false, false));   // escolhidos de outra tipologia
  comBib().filter(m=>ks.includes(m.tipologia)).forEach(m=>pus(m,false,true));
  return out;
}
const comPadrao = nome=> comGaleria(nome).filter(g=>g.padrao).map(g=>g.mod.id);
const comMarcados = nome=>{ const t=comTipoEntry(nome); return t.partidos && t.partidos.length? t.partidos : comPadrao(nome) };
function comCardHTML(){
  const C=S.comodos; comTiposSync();
  let h=SW("comodos.on","Mostrar as plantas",{rr:true});
  if(C.on){
    h+=`<div id="comRes" class="note"></div>`;
    const nomes=[...new Set(S.produto.mix.map(u=>u.nome))], temEd=typeof aptoEditorAbrir==="function";
    h+=nomes.map(n=>{ const i=C.tipos.findIndex(t=>t.nome===n), t=C.tipos[i], vs=(C.variantes||[]).map((v,j)=>({...v,j})).filter(v=>v.tipo===n), marc=comMarcados(n);
      const ajust=t && ((t.cortes && Object.keys(comCortesDe(t)).length) || t.partido);
      const gal=comGaleria(n).map(g=>{ const on=marc.includes(g.mod.id);
        return `<button type="button" class="comPc" data-act="comPart" data-k="${esc(n)}" data-id="${esc(g.mod.id)}" aria-pressed="${on}" data-pid="${esc(g.mod.id)}" data-nome="${esc(g.mod.nome)}" title="${esc(g.mod.nome)} — ${on?"desmarcar":"tentar este partido"}">
          <span class="tp"><span>${g.bib? "Meu modelo" : g.mod.origem==="usuario"? "Meu modelo" : comNf(g.mod.W,1)+" × "+comNf(g.mod.D,1)+" m"}</span><span class="ck"></span></span>
          ${aptoMiniSVG(g.mod,{w:84})}<span class="nm">${esc(g.mod.nome)}</span><span class="nt" data-nt="${esc(n)}|${esc(g.mod.id)}"><i></i>—</span></button>` }).join("");
      return `<div class="comT" data-tipo="${esc(n)}">
        <div class="hd"><b>${esc(n)}</b><span class="pill" id="comSt-${i}"></span></div>
        <div class="comGal">${gal}</div>
        <div class="comPb" id="comPb-${i}"></div>
        <div class="comAc">${temEd? `<button class="btn sm" data-act="comMeus" data-k="${esc(n)}">Meus modelos</button>` : ""}
          <button class="btn sm ghost" data-act="comSalvar" data-k="${esc(n)}" title="Guardar o partido e as divisões atuais como variação">Salvar variação</button>
          ${ajust? `<button class="btn sm ghost" data-act="comAuto" data-k="${esc(n)}" title="Voltar à escolha automática do partido e das divisões">Automático</button>` : ""}
          ${vs.map(v=>`<span class="chip" aria-pressed="${t.sel===v.j}" style="display:inline-flex;gap:6px;align-items:center"><button type="button" data-act="comUsar" data-i="${v.j}" style="all:unset;cursor:pointer" title="Usar ${esc(v.nome)}">${esc(v.nome)}</button><button type="button" data-act="comDel" data-i="${v.j}" aria-label="Excluir ${esc(v.nome)}" title="Excluir ${esc(v.nome)}" style="all:unset;cursor:pointer;opacity:.6">×</button></span>`).join("")}</div>
      </div>` }).join("");
    const rowM=(k,l)=>`<tr><td>${l}</td><td>${NUM(`comodos.min.${k}.a`,"","m²",{step:0.1})}</td><td>${NUM(`comodos.min.${k}.l`,"","m",{step:0.05})}</td></tr>`;
    const rowR=(k,l)=>`<tr><td>${l}</td><td>${NUM(`comodos.regras.circ.${k}`,"","m",{step:0.05})}</td></tr>`;
    h+=ADV(SW("comodos.movel","Mobiliário",{fx:"comR"})+
      GRP("Programa de cada tipologia")+nomes.map(n=>{ const i=C.tipos.findIndex(t=>t.nome===n), t=C.tipos[i];
        return `<div class="row" style="flex-wrap:nowrap;gap:8px;align-items:center"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(n)}</span><select class="sel" style="flex:1;min-width:0" data-p="comodos.tipos.${i}.modelo" data-t="s" data-rr="1" aria-label="Programa de ${esc(n)}">
          <option value="auto" ${t.modelo==="auto"?"selected":""}>automático</option>${Object.entries(COM_MODELOS).map(([k,M])=>`<option value="${k}" ${t.modelo===k?"selected":""}>${M.nome}</option>`).join("")}</select></div>
          ${comLavOpc(n)?`<div class="row sb" style="flex-wrap:nowrap">${SW(`comodos.tipos.${i}.lavabo`,`Lavabo junto da sala · ${esc(n)}`)}${INFO("Acrescenta o lavabo dos partidos que o preveem (3 dormitórios ou mais), perto da entrada e com porta para a sala.")}</div>`:""}` }).join("")+
      GRP("Quadro de áreas por cômodo")+`<div id="comQuadro"></div>`+
      GRP(`Medidas mínimas${INFO("Área e menor lado de cada ambiente, e o diâmetro do maior círculo que cabe dentro dele já descontadas as paredes. Referência genérica: confira no código de obras do município.","as medidas mínimas")}`)+
      `<table class="tbl comMin"><tr><th></th><th>Área</th><th>Menor lado</th></tr>${rowM("sala","Sala")+rowM("suite","Suíte")+rowM("dorm","Dormitório")+rowM("cozinha","Cozinha")+rowM("serv","Área de serviço")+rowM("banho","Banheiro")+rowM("lavabo","Lavabo")}</table>
      <table class="tbl comMin"><tr><th></th><th>Círculo inscrito</th></tr>${rowR("sala","Sala")+rowR("suite","Suíte")+rowR("dorm","Dormitório")+rowR("cozinha","Cozinha")+rowR("banho","Banheiro")+rowR("circ","Circulação (largura)")}</table>
      ${KV(NUM("comodos.jan.frac","Janela ≥ 1/n do piso","n",{step:1,int:true})+NUM("comodos.jan.h","Altura da janela","m",{step:0.05})+NUM("comodos.jan.hSala","Porta-janela (sala)","m",{step:0.05}),3)}`, {key:"comAdv"});
  }
  return SEC("Plantas das unidades", h, {key:"comodos", sum: C.on? "" : "desligado", info:"Partido"});
}
const comNivel = n=> n==null? "" : n>=85? "ok" : n>=70? "warn" : "bad";
/* ordena a galeria de uma tipologia: 0 = em uso, 1 = cabe (nota, sem problema grave), 2 = não cabe (o que pede a faixa ou o
   problema que o derruba); separador "Não cabem nestas unidades" antes do grupo 2 */
function comGaleriaOrdena(nome, T){
  const gal=document.querySelector(`.comT[data-tipo="${CSS.escape(nome)}"] .comGal`); if(!gal) return;
  const info=T.info||{}, bts=[...gal.querySelectorAll(".comPc")];
  const it=bts.map(b=>{ const id=b.dataset.pid, I=info[id], uso=!!T.usados[id], nu=uso && T.notaUso? T.notaUso[id] : null;
    const g= uso? 0 : I && I.nota!=null && I.ok? 1 : 2, nota= nu!=null? nu : I && I.nota!=null? I.nota : null;
    return {b, id, g, nota, I, uso} });
  it.sort((a,b)=>a.g-b.g || (a.g<2? (b.nota??-1)-(a.nota??-1) : ((a.I&&a.I.falta)||0)-((b.I&&b.I.falta)||0)));
  gal.querySelectorAll(".comSep").forEach(e=>e.remove());
  it.forEach((x,k)=>{ const {b, g, nota, I, uso}=x, nt=b.querySelector(".nt"), on=b.getAttribute("aria-pressed")==="true";
    if(g===2 && k>0 && it[k-1].g<2){ const sp=document.createElement("div"); sp.className="comSep"; sp.textContent="Não cabem nestas unidades"; gal.appendChild(sp) }
    gal.appendChild(b); b.classList.toggle("uso", uso); b.classList.toggle("nc", g===2);
    const mot = I && I.motivo ? I.motivo : "não cabe";
    if(nt) nt.innerHTML = g<2 ? `<i class="${comNivel(nota)}"></i>${uso? `em uso${T.usados[x.id]>1? ` (${T.usados[x.id]})` : ""} · ${Math.round(nota)}` : `nota ${Math.round(nota)}`}` : `<span class="mt">${esc(on? mot : "desmarcado")}</span>`;
    b.title = `${b.dataset.nome||""}${g===2? ` — não cabe nestas unidades: ${mot}` : ""}${on? "" : " (desmarcado)"} — clique para ${on? "desmarcar" : "tentar este partido"}` });
}
function comLive(m){
  const R=m&&m.comodos; if(!R){ if(!S.comodos.on) setSum("comodos","desligado"); return }
  setSum("comodos", R.unidades? `<span style="color:var(--${comNivel(R.nota)==="ok"?"ok":comNivel(R.nota)==="warn"?"warn":"bad"})">nota ${R.nota}</span> · ${R.validas}/${R.unidades}` : "—");
  const ruins=R.lista.filter(x=>!x.ok).length;
  setHTML("comRes", R.unidades? `Nota média <b>${R.nota}</b> · ${R.validas} de ${R.unidades} unidades sem problema grave${ruins? ` · <span style="color:var(--bad)">${ruins} sem partido que caiba</span>` : ""}${INFO("Cada unidade testa os partidos marcados da tipologia, aplica as regras (círculo inscrito, áreas mínimas, acessos, iluminação, mobiliário) e fica com a melhor nota (100 = sem problema). Em cada partido: a nota média nas unidades em que está em uso; nos outros, a nota na pior unidade da tipologia.","a nota")}` : "");
  (S.comodos.tipos||[]).forEach((t,i)=>{ const el=document.getElementById("comSt-"+i), T=R.porTipo[t.nome]; if(!el) return;
    if(!T){ el.className="pill"; el.textContent="—"; return } const nv=comNivel(T.nota); el.className="pill "+(nv==="ok"?"ok":nv==="warn"?"warn":"bad"); el.textContent=`nota ${T.nota} · ${T.validas}/${T.n}`;
    // galeria: em uso, depois os que cabem (pela nota) e, no fim, agrupados, os que não cabem nesta unidade (com o que pedem)
    comGaleriaOrdena(t.nome, T);
    // problemas da planta escolhida (unidade representante), em linguagem simples
    const lay=m.tipo[T.ex.ti], u=lay&&lay.units[T.ex.ui], al=u&&u.com? u.com.alertas.filter(a=>a.nivel!=="nota").slice(0,4) : [];
    setHTML("comPb-"+i, al.length? al.map(a=>`<div><span class="dot ${a.nivel==="erro"?"bad":"warn"}"></span><span>${esc(a.msg.charAt(0).toUpperCase()+a.msg.slice(1))}</span></div>`).join("") : u&&u.com? `<div><span class="dot ok"></span><span>${esc(u.com.partidoNome)}: sem problemas</span></div>` : "") });
  const Q=comQuadro(m);
  setHTML("comQuadro", Q.map(q=>`<p class="fl" style="margin:6px 0 4px"><b>${esc(q.nome)}</b> · ${esc(q.modelo)} · nota ${q.nota}</p><table class="tbl">${q.rooms.map(r=>`<tr><td><span class="dot ${r.st}"></span> ${esc(r.nome)}</td><td>${nf(r.area,1)} m²</td></tr>`).join("")}<tr class="tot"><td>Unidade</td><td>${nf(q.soma,1)} m²</td></tr></table>`).join(""));
}
addCard("projeto", { key:"comodos", order:55, sub:"tipo", html:comCardHTML, live:(m)=>comLive(m) });
FX.comR = ()=>{ save(); redraw2d() };
/* marcar/desmarcar um partido para a tipologia (todos marcados = automático, partidos = []) */
ACT.comPart = b=>{ const n=b.dataset.k, id=b.dataset.id, t=comTipoEntry(n), padrao=comPadrao(n); let cur=comMarcados(n).slice();
  if(cur.includes(id)){ if(cur.length<=1){ toast("Deixe ao menos um partido marcado"); return } cur=cur.filter(x=>x!==id) }
  else { const lib=comBib().find(m=>m.id===id); if(lib) comCopiaModelo(lib); cur.push(id) }
  t.partidos = cur.length===padrao.length && padrao.every(x=>cur.includes(x))? [] : cur;
  if(t.partido && !comMarcados(n).includes(t.partido)){ t.partido=null; t.cortes={} }
  t.sel=-1; update(); renderTab() };
/* modelo do usuário: copiado para o estudo (o link #ver=, a nuvem e o Worker leem S, não a biblioteca) */
function comCopiaModelo(mod){ const C=S.comodos; C.modelos=C.modelos||[]; const c=JSON.parse(JSON.stringify(mod)); c.origem="usuario"; const i=C.modelos.findIndex(x=>x.id===c.id); if(i>=0) C.modelos[i]=c; else C.modelos.push(c); return c }
ACT.comMeus = b=>{ if(typeof aptoEditorAbrir!=="function") return; const n=b.dataset.k, tip=comModeloDe(S, n, comAreaDe(n));
  aptoEditorAbrir({tipologia:tip, onSalvar:mod=>{ if(!mod || !mod.id) return; comCopiaModelo(mod); const t=comTipoEntry(n);
    if(t.partidos && t.partidos.length && !t.partidos.includes(mod.id)) t.partidos.push(mod.id);
    else if(!(t.partidos||[]).length && mod.tipologia!==tip && !(COM_ALT[tip]===mod.tipologia)) t.partidos=comPadrao(n).concat(mod.id);
    update(); renderTab(); toast(`${mod.nome||"Modelo"}: no estudo`) }}) };
ACT.comSalvar = b=>{ const n=b.dataset.k, t=comTipoEntry(n), C=S.comodos; C.variantes=C.variantes||[]; const k=C.variantes.filter(v=>v.tipo===n).length+1;
  const m=window._last&&window._last.m, ex=m&&m.comodos&&m.comodos.porTipo[n], u=ex&&m.tipo[ex.ex.ti].units[ex.ex.ui];
  const cortes = Object.keys(comCortesDe(t)).length? {...comCortesDe(t)} : (u&&u.com? {...u.com.cortes} : {});
  C.variantes.push({tipo:n, nome:`Variação ${k}`, modelo: t.modelo||"auto", partido: t.partido || (u&&u.com? u.com.partido : null), cortes});
  t.sel=C.variantes.length-1; save(); renderTab(); toast(`Variação ${k} de ${n} salva`) };
ACT.comUsar = b=>{ const C=S.comodos, v=C.variantes[+b.dataset.i]; if(!v) return; const t=comTipoEntry(v.tipo);
  t.modelo = v.modelo && (v.modelo==="auto" || COM_MODELOS[v.modelo])? v.modelo : "auto"; t.cortes={...(v.cortes||{})}; t.partido = v.partido && aptoModelo(v.partido,S)? v.partido : null;
  if(t.partido && !comMarcados(v.tipo).includes(t.partido)) t.partidos=comMarcados(v.tipo).concat(t.partido);
  t.sel=+b.dataset.i; update(); renderTab(); toast(`${v.tipo}: usando ${v.nome}`) };
ACT.comDel = b=>{ const C=S.comodos, i=+b.dataset.i, v=C.variantes[i]; if(!v) return; if(!b.dataset.arm){ b.dataset.arm=1; b.textContent="excluir?"; b.style.opacity=1; b.style.color="var(--bad)"; setTimeout(()=>{ if(b.isConnected){ delete b.dataset.arm; b.textContent="×"; b.style.opacity=".6"; b.style.color="" } },4000); return } C.variantes.splice(i,1); (C.tipos||[]).forEach(t=>{ if(t.sel===i) t.sel=-1; else if(t.sel>i) t.sel-- }); save(); renderTab(); toast(`${v.nome} excluída`) };
ACT.comAuto = b=>{ const t=comTipoEntry(b.dataset.k); t.cortes={}; t.partido=null; t.sel=-1; update(); renderTab(); toast(`${t.nome}: escolha automática`) };
HOOK.pdf.push(ctx=>comPdf(ctx));
/* biblioteca do usuário mudou (editor de modelos): a galeria de partidos acompanha */
if(typeof aptoBibOuvir==="function") try{ aptoBibOuvir(()=>{ if(typeof TAB!=="undefined" && TAB==="projeto" && typeof renderTab==="function") renderTab() }) }catch(e){}
