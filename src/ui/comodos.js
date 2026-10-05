/* ================= 1.2 cômodos: desenho, edição das divisões e inspetor =================
   Desenho (chamado pelo tipoBody do plan2d, também nos Andares e no PDF): paredes em poché (a unidade cheia na cor da
   parede e cada cômodo recuado pela meia-parede), vãos de porta com folha e arco, janelas na fachada, mobiliário
   (camada própria) e nomes/áreas. Edição: arrastar as divisões na planta tipo (views.js chama comHit/comDragMove/
   comDragEnd); o ajuste vale para a tipologia inteira (S.comodos.tipos). Variações salvas em S.comodos.variantes. */
let COMHOV=null, COMDRAG=null;

const COM_COR = { sala:"pal", sacada:"--c-sac", dorm:"pal", suite:"pal", closet:"pal", circ:"--surface", cozinha:"--c-ant", serv:"--c-ant", desp:"--c-ant", banho:"--c-ant", bsuite:"--c-ant" };

/* desenho de uma planta tipo: devolve true se desenhou os cômodos */
function comDraw(g, lay, K){
  if(!S.comodos || !S.comodos.on || !lay || !lay.units.some(u=>u.com)) return false;
  const {w2s, V, css}=K, s=V.s, ink=css("--ink"), pal=K.pal||[], names=K.names||[];
  const path=p=>{ g.beginPath(); p.forEach((q,i)=>{ const [x,y]=w2s(q); i?g.lineTo(x,y):g.moveTo(x,y) }); g.closePath() };
  const fill=(p,col,a=1)=>{ if(!p||p.length<3) return; path(p); g.globalAlpha=a; g.fillStyle=col; g.fill(); g.globalAlpha=1 };
  const add=(p,v,k)=>[p[0]+v[0]*k, p[1]+v[1]*k];
  const quad=(a,b,n,t0,t1)=>[add(a,n,t0),add(b,n,t0),add(b,n,t1),add(a,n,t1)];
  const surf=css("--surface"), acc=css("--accent"), ink2=css("--ink-2"), muted=css("--muted");
  const roomCol=(u,r)=>{ const c=COM_COR[r.k]||"--surface"; return c==="pal"? (pal[names.indexOf(u.nome)%Math.max(1,pal.length)]||surf) : css(c) };
  const roomA=r=> r.k==="sacada"? 0.55 : COM_COR[r.k]==="pal"? 0.42 : r.k==="circ"? 1 : 0.85;
  const placed=[];   // etiquetas já desenhadas (evita sobreposição no corredor)
  lay.units.forEach((u,ui)=>{ const c=u.com; if(!c) return;
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
    // 5. nomes e áreas
    if(s>7.5) c.rooms.forEach((r,i)=>{ if(r.k==="circ") return; let p=r.c; if(!G.pip(p, r.poly)) p=r.rc;
      const P=w2s(p), xs=ins[i].map(q=>w2s(q)[0]), ys=ins[i].map(q=>w2s(q)[1]), bw=Math.max(...xs)-Math.min(...xs), bh=Math.max(...ys)-Math.min(...ys);
      const nome= r.k==="sacada"&&bw<44? "Sac." : r.k==="bsuite"? "Banho" : r.nome;
      g.textAlign="center"; g.textBaseline="middle";
      g.font=`600 ${s>16?10.5:9.5}px ${css("--f-display")}`; const tw=g.measureText(nome).width; if(tw>bw-4 || bh<14) return;
      const two = bh>30 && s>10.5, y0 = two? P[1]-6 : P[1];
      g.lineWidth=3; g.strokeStyle=surf; g.globalAlpha=0.85; g.strokeText(nome,P[0],y0); g.globalAlpha=1; g.fillStyle=ink; g.fillText(nome,P[0],y0);
      if(two){ const t=nf(r.area,1)+" m²"; g.font=`500 9px ${css("--f-mono")}`; if(g.measureText(t).width<bw-4){ g.lineWidth=3; g.strokeStyle=surf; g.globalAlpha=0.85; g.strokeText(t,P[0],P[1]+6); g.globalAlpha=1; g.fillStyle=ink2; g.fillText(t,P[0],P[1]+6) } } });
    // 6. etiqueta da unidade no corredor, junto da porta de entrada
    const en=c.doors.find(d=>d.k==="entrada");
    if(en && s>4){ const m=[(en.p0[0]+en.p1[0])/2,(en.p0[1]+en.p1[1])/2], t= s>13? `${u.nome} · ${nf(u.alvo,1)} m²` : u.nome;
      g.font=`500 ${s>14?9.5:8.5}px ${css("--f-mono")}`; const tw=g.measureText(t).width+10, th=15;
      // no corredor, encostada na parede da unidade; desliza ao longo do corredor se encostar em outra etiqueta
      const off=Math.max(0.3, Math.min(0.8, (th/2+3)/s)), base=w2s(add(m,en.n,-off)), e0=w2s(en.p0), e1=w2s(en.p1), dl=Math.hypot(e1[0]-e0[0],e1[1]-e0[1])||1, along=[(e1[0]-e0[0])/dl,(e1[1]-e0[1])/dl];
      const hit=(x,y)=>placed.some(r=>Math.abs(r[0]-x)<(r[2]+tw)/2+4 && Math.abs(r[1]-y)<(r[3]+th)/2+2);
      const inC=(x,y)=>!K.W || (x-tw/2>=4 && x+tw/2<=K.W-4 && y-th/2>=0 && y+th/2<=K.H);
      let P=null; for(const k of [0,1,-1,2,-2,3,-3]){ const x=base[0]+along[0]*k*(tw*0.55), y=base[1]+along[1]*k*(tw*0.55); if(!hit(x,y) && inC(x,y)){ P=[x,y]; break } }
      if(P){ placed.push([P[0],P[1],tw,th]); g.fillStyle=surf; g.globalAlpha=0.94; g.beginPath(); if(g.roundRect) g.roundRect(P[0]-tw/2,P[1]-th/2,tw,th,th/2); else g.rect(P[0]-tw/2,P[1]-th/2,tw,th); g.fill(); g.globalAlpha=1;
        g.strokeStyle=c.ok? css("--line-2") : css("--warn"); g.lineWidth=1; g.stroke(); g.fillStyle=ink; g.textAlign="center"; g.textBaseline="middle"; g.fillText(t,P[0],P[1]+0.5) } }
    // 7. divisões arrastáveis (unidade sob o cursor)
    const hov = COMDRAG? COMDRAG.ti===K.ti && COMDRAG.ui===ui : COMHOV && COMHOV.ti===K.ti && COMHOV.ui===ui;
    if(K.edit && hov){ (c.divs||[]).forEach(dv=>{ const a=w2s(dv.p0), b=w2s(dv.p1), on = (COMDRAG||COMHOV).id===dv.id;
      g.strokeStyle=acc; g.globalAlpha=on? 0.95 : 0.4; g.lineWidth=on? 3 : 2; g.setLineDash(on?[]:[4,3]); g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); g.setLineDash([]); g.globalAlpha=1;
      const mx=(a[0]+b[0])/2, my=(a[1]+b[1])/2; g.fillStyle=surf; g.strokeStyle=acc; g.lineWidth=1.5; g.beginPath(); g.arc(mx,my,on?5:4,0,7); g.fill(); g.stroke() }) }
  });
  return true;
}
/* legenda (planta tipo e andares) */
function comLeg(sw){ if(!S.comodos||!S.comodos.on) return ""; return sw("var(--ink)","paredes")+sw("var(--c-ant)","áreas molhadas")+`<div><i style="background:none;border:0;border-top:2px solid var(--accent);height:0;margin-top:5px"></i>janelas</div>` }

/* ---------- edição: arrastar as divisões ---------- */
function comSegDist(p,a,b){ const dx=b[0]-a[0], dy=b[1]-a[1], l2=dx*dx+dy*dy||1, t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2)); return Math.hypot(p[0]-a[0]-dx*t, p[1]-a[1]-dy*t) }
function comHit(px,py){
  if(!S.comodos||!S.comodos.on) return null; const m=window._last&&window._last.m, lay=m&&m.tipo&&m.tipo[TOWER]; if(!lay) return null;
  let best=null, bd=8;
  lay.units.forEach((u,ui)=>{ const c=u.com; if(!c) return; (c.divs||[]).forEach(dv=>{ const a=w2s_(dv.p0), b=w2s_(dv.p1), d=comSegDist([px,py],a,b); if(d<bd){ bd=d; best={ti:TOWER, ui, id:dv.id, nome:u.nome, ax:dv.ax, lo:dv.lo, hi:dv.hi, a, b} } }) });
  return best;
}
function comHover(px,py){ const h=comHit(px,py), old=COMHOV; COMHOV=h;
  c2.style.cursor = h? (Math.abs(h.b[0]-h.a[0])>Math.abs(h.b[1]-h.a[1])? "ns-resize" : "ew-resize") : "";
  if(!!old!==!!h || (old&&h&&(old.id!==h.id||old.ui!==h.ui))) redraw2d() }
function comTipoEntry(nome){ const C=S.comodos; C.tipos=C.tipos||[]; let t=C.tipos.find(x=>x.nome===nome); if(!t){ t={nome, modelo:"auto", cortes:{}, sel:-1}; C.tipos.push(t) } if(!t.cortes) t.cortes={}; return t }
function comDragMove(d, w){
  const m=window._last.m, u=m.tipo[d.ti]&&m.tipo[d.ti].units[d.ui], c=u&&u.com; if(!c) return;
  const a=w[0]*c.ax[0]+w[1]*c.ax[1], x= c.lado==="b"? c.a1-a : a-c.a0, y=w[0]*c.dn[0]+w[1]*c.dn[1]-c.d0;
  const t=comTipoEntry(d.nome); let v;
  if(d.ax==="x"){ v=Math.max(d.lo,Math.min(d.hi,x))/c.W }
  else { const yy=Math.max(d.lo,Math.min(d.hi,y)); v = d.id==="dW"? (c.D-yy)/c.D : yy/c.D }
  t.cortes[d.id]=+v.toFixed(4); t.sel=-1; COMDRAG={...d};
  comodosCalc(m, S); redraw2d();
}
function comDragEnd(){ COMDRAG=null; update(); if(TAB==="projeto") renderTab() }

/* ---------- inspetor (Projeto › Pavimento tipo) ---------- */
function comTiposSync(){ const C=S.comodos; C.tipos=C.tipos||[]; [...new Set(S.produto.mix.map(u=>u.nome))].forEach(n=>comTipoEntry(n)) }
function comCardHTML(){
  const C=S.comodos; comTiposSync();
  let h=SW("comodos.on","Mostrar cômodos nas plantas",{rr:true});
  if(C.on){
    h+=SW("comodos.movel","Mobiliário",{fx:"comR"});
    h+=`<div id="comRes"></div><p class="note">Arraste as divisões na planta (passe o cursor sobre uma unidade). O ajuste vale para todas as unidades da tipologia.</p>`;
    const nomes=[...new Set(S.produto.mix.map(u=>u.nome))];
    h+=nomes.map(n=>{ const i=C.tipos.findIndex(t=>t.nome===n), t=C.tipos[i], vs=(C.variantes||[]).map((v,j)=>({...v,j})).filter(v=>v.tipo===n);
      const ajust=t && t.cortes && Object.keys(t.cortes).length;
      return `<div class="fld wide" style="border-top:1px solid var(--line);padding-top:10px;margin-top:4px">
        <div class="row sb"><b style="font-family:var(--f-display)">${esc(n)}</b><span class="pill" id="comSt-${i}"></span></div>
        <div class="row sb" style="gap:8px;margin-top:6px"><span class="fl" style="flex:none">Modelo</span><select class="sel" data-p="comodos.tipos.${i}.modelo" data-t="s" data-rr="1" aria-label="Modelo de ${esc(n)}">
          <option value="auto" ${t.modelo==="auto"?"selected":""}>automático</option>${Object.entries(COM_MODELOS).map(([k,M])=>`<option value="${k}" ${t.modelo===k?"selected":""}>${M.nome}</option>`).join("")}</select></div>
        <div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap">
          <button class="btn sm" data-act="comSalvar" data-k="${esc(n)}">Salvar como variação</button>
          ${ajust?`<button class="btn sm ghost" data-act="comAuto" data-k="${esc(n)}">Voltar ao automático</button>`:""}</div>
        ${vs.length?`<div class="chips" style="margin-top:8px">${vs.map(v=>`<span class="chip" aria-pressed="${t.sel===v.j}" style="display:inline-flex;gap:6px;align-items:center"><button type="button" data-act="comUsar" data-i="${v.j}" style="all:unset;cursor:pointer">${esc(v.nome)}</button><button type="button" data-act="comDel" data-i="${v.j}" aria-label="Excluir ${esc(v.nome)}" style="all:unset;cursor:pointer;opacity:.6">×</button></span>`).join("")}</div>`:""}
      </div>` }).join("");
    h+=`<details class="card" style="margin-top:10px" data-key="comQuadro"><summary><span>Quadro de áreas por cômodo</span></summary><div class="cb" id="comQuadro"></div></details>`;
    const M=C.min, rowM=(k,l)=>`<tr><td>${l}</td><td>${NUM(`comodos.min.${k}.a`,"","m²",{step:0.1})}</td><td>${NUM(`comodos.min.${k}.l`,"","m",{step:0.05})}</td></tr>`;
    h+=`<details class="card" data-key="comMin"><summary><span>Mínimos do código de obras</span></summary><div class="cb">
      <p class="note" style="color:var(--warn)">Referência genérica — conferir no código de obras do município.</p>
      <table class="tbl comMin"><tr><th></th><th>Área</th><th>Menor lado</th></tr>${rowM("sala","Sala")+rowM("suite","Suíte / dorm. principal")+rowM("dorm","Dormitório")+rowM("cozinha","Cozinha")+rowM("serv","Área de serviço")+rowM("banho","Banheiro")}</table>
      ${KV(NUM("comodos.jan.frac","Janela ≥ 1/n do piso","n",{step:1,int:true})+NUM("comodos.jan.h","Altura da janela","m",{step:0.05})+NUM("comodos.jan.hSala","Porta-janela (sala)","m",{step:0.05}),3)}</div></details>`;
  }
  return CARD("Cômodos das unidades", h, {aside: C.on? `<span id="comAside"></span>` : "desligado"});
}
function comLive(m){
  const R=m&&m.comodos; if(!R) return;
  const A=document.getElementById("comAside"); if(A) A.innerHTML = `<span style="color:${R.validas===R.unidades?"var(--ok)":"var(--warn)"}">${R.validas}/${R.unidades} válidas</span>`;
  (S.comodos.tipos||[]).forEach((t,i)=>{ const el=document.getElementById("comSt-"+i), T=R.porTipo[t.nome]; if(!el) return;
    if(!T){ el.className="pill"; el.textContent="—"; return } const ok=T.validas===T.n; el.className="pill "+(ok?"ok":"warn"); el.textContent=`${COM_MODELOS[T.modelo]? COM_MODELOS[T.modelo].nome : T.modelo} · ${T.validas}/${T.n}` });
  // alertas por unidade
  const lis=[]; (m.tipo||[]).forEach((lay,ti)=>{ if(!lay) return; lay.units.forEach((u,ui)=>{ const c=u.com; if(!c) return; const al=c.alertas.filter(a=>a.nivel!=="nota"); if(!al.length) return;
    lis.push(`<div class="li"><span class="dot ${al.some(a=>a.nivel==="erro")?"bad":"warn"}"></span><span class="tt">Torre ${ti+1} · ${esc(u.nome)} (${nf(u.area,1)} m²)</span><span class="ss">${al.map(a=>esc(a.msg)).join(" · ")}</span></div>`) }) });
  const notas=new Set(); (m.tipo||[]).forEach(l=>l&&l.units.forEach(u=>u.com&&u.com.alertas.forEach(a=>{ if(a.nivel==="nota") notas.add(a.msg) })));
  setHTML("comRes", (lis.length? `<div class="list">${lis.join("")}</div>` : `<p class="note" style="color:var(--ok)">Todas as unidades com cômodos dentro dos mínimos, janelas de 1/${S.comodos.jan.frac||6} do piso e acesso a todos os cômodos.</p>`) + [...notas].map(n=>`<p class="note">${esc(n.charAt(0).toUpperCase()+n.slice(1))}.</p>`).join(""));
  const Q=comQuadro(m);
  setHTML("comQuadro", Q.map(q=>`<p class="fl" style="margin:6px 0 4px"><b>${esc(q.nome)}</b> · ${esc(q.modelo)} · ${q.validas}/${q.n} válidas</p><table class="tbl">${q.rooms.map(r=>`<tr><td><span class="dot ${r.st}"></span> ${esc(r.nome)}</td><td>${nf(r.area,1)} m²</td></tr>`).join("")}<tr class="tot"><td>Unidade</td><td>${nf(q.soma,1)} m²</td></tr></table>`).join(""));
}
addCard("projeto", { key:"comodos", order:55, sub:"tipo", html:comCardHTML, live:(m)=>comLive(m) });
FX.comR = ()=>{ save(); redraw2d() };
ACT.comSalvar = b=>{ const n=b.dataset.k, t=comTipoEntry(n), C=S.comodos; C.variantes=C.variantes||[]; const k=C.variantes.filter(v=>v.tipo===n).length+1;
  const m=window._last&&window._last.m, ex=m&&m.comodos&&m.comodos.porTipo[n], u=ex&&m.tipo[ex.ex.ti].units[ex.ex.ui];
  const cortes = Object.keys(t.cortes||{}).length? {...t.cortes} : (u&&u.com? {...u.com.cortes} : {});
  C.variantes.push({tipo:n, nome:`Variação ${k}`, modelo: t.modelo && t.modelo!=="auto"? t.modelo : (u&&u.com? u.com.modelo : "auto"), cortes});
  t.sel=C.variantes.length-1; save(); renderTab(); toast(`Variação ${k} de ${n} salva`) };
ACT.comUsar = b=>{ const C=S.comodos, v=C.variantes[+b.dataset.i]; if(!v) return; const t=comTipoEntry(v.tipo); t.modelo=v.modelo||"auto"; t.cortes={...(v.cortes||{})}; t.sel=+b.dataset.i; update(); renderTab(); toast(`${v.tipo}: usando ${v.nome}`) };
ACT.comDel = b=>{ const C=S.comodos, i=+b.dataset.i, v=C.variantes[i]; if(!v) return; C.variantes.splice(i,1); (C.tipos||[]).forEach(t=>{ if(t.sel===i) t.sel=-1; else if(t.sel>i) t.sel-- }); save(); renderTab(); toast(`${v.nome} excluída`) };
ACT.comAuto = b=>{ const t=comTipoEntry(b.dataset.k); t.cortes={}; t.sel=-1; update(); renderTab(); toast(`${t.nome}: divisões automáticas`) };
HOOK.pdf.push(ctx=>comPdf(ctx));
