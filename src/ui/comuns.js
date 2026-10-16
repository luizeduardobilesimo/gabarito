/* ================= Térreo, hall e áreas comuns: desenho e interface (cálculo em src/calc/comuns.js) =================
   cmnDraw(g, m, local, K)  → desenho técnico das áreas comuns de um pavimento (terreo | emb | pav | cob), chamado por plan2d.js:
                              paisagismo e calçada nos recuos, piso do hall e das galerias, ambientes com parede (poché), portas
                              com folha e arco, janelas, mobiliário e equipamentos, piscina com raias e prainha, rota acessível
                              tracejada e o contorno dos ambientes com problema (vermelho = grave, âmbar = atenção).
   cmnLeg(sw, ln)           → itens da legenda do palco.
   Projeto › Andares › "Térreo e áreas comuns" (seção fechada): nota, problemas e o programa resumido por grupo.
   Produto › Áreas comuns e lazer: linha "Apoio do condomínio" (cmnApoioRow), com o que o programa automático inclui. */

const CMN_COR = { hall:"--c-hall", apoio:"--c-ant", molhado:"--c-sac", servico:"--c-esc", lazer:"--lz-c", tecnico:"--c-tec", gas:"--c-duto",
  agua:"--lz-agua", deck:"--lz-deck", play:"--lz-deck", verde:"--lz-c", quadra:"--lz-c" };

function cmnDraw(g, m, local, K){
  const C=m && m.comuns; if(!C) return false;
  const {w2s, V, css}=K, s=V.s, ink=css("--ink"), ink2=css("--ink-2")||ink, surf=css("--surface"), acc=css("--d-acc");
  const ax=(C.eixos||{})[local]; if(!ax) return false;
  const [ux,vy]=ax, U=p=>[G.dot(p,ux), G.dot(p,vy)], W=(u,v)=>[ux[0]*u+vy[0]*v, ux[1]*u+vy[1]*v];
  const path=p=>{ g.beginPath(); p.forEach((q,i)=>{ const [x,y]=w2s(q); i?g.lineTo(x,y):g.moveTo(x,y) }); g.closePath() };
  const fill=(p,col,a=1)=>{ if(!p||p.length<3) return; path(p); g.globalAlpha=a; g.fillStyle=col; g.fill(); g.globalAlpha=1 };
  const stroke=(p,col,w=1,dash=null,a=1)=>{ if(!p||p.length<2) return; path(p); g.strokeStyle=col; g.lineWidth=w; g.globalAlpha=a; if(dash) g.setLineDash(dash); g.stroke(); g.setLineDash([]); g.globalAlpha=1 };
  const line=(a,b,col,w=1,dash=null,al=1)=>{ const A=w2s(a), B=w2s(b); g.strokeStyle=col; g.lineWidth=w; g.globalAlpha=al; if(dash) g.setLineDash(dash); g.beginPath(); g.moveTo(...A); g.lineTo(...B); g.stroke(); g.setLineDash([]); g.globalAlpha=1 };
  const add=(p,v,k)=>[p[0]+v[0]*k, p[1]+v[1]*k];
  const quad=(a,b,n,t0,t1)=>[add(a,n,t0),add(b,n,t0),add(b,n,t1),add(a,n,t1)];
  // retângulo (no referencial u,v) recuado por d de cada lado
  const inset=(p,d)=>{ const P=p.map(U), u0=Math.min(...P.map(q=>q[0]))+d, u1=Math.max(...P.map(q=>q[0]))-d, v0=Math.min(...P.map(q=>q[1]))+d, v1=Math.max(...P.map(q=>q[1]))-d; return u1>u0&&v1>v0? [W(u0,v0),W(u1,v0),W(u1,v1),W(u0,v1)] : [] };
  const hatchP=(p,col,a=0.4,step=0.5,ang=1)=>{ if(!p||p.length<3) return; path(p); g.save(); g.clip(); g.strokeStyle=col; g.globalAlpha=a; g.lineWidth=0.8; const P=p.map(U), u0=Math.min(...P.map(q=>q[0])), u1=Math.max(...P.map(q=>q[0])), v0=Math.min(...P.map(q=>q[1])), v1=Math.max(...P.map(q=>q[1])), L=(u1-u0)+(v1-v0);
    for(let t=-L; t<L; t+=Math.max(step, 4/s)){ g.beginPath(); const A=w2s(W(u0+t, v0)), B=w2s(W(u0+t+ang*(v1-v0), v1)); g.moveTo(...A); g.lineTo(...B); g.stroke() } g.restore(); g.globalAlpha=1 };
  const lst=(C.amb||[]).filter(a=>a.local===local);
  const estar= local==="terreo"? (C.estar||[]) : [];   // sobras abertas: estar / área livre coberta / reserva técnica (só piso, sem parede)
  const ext=a=> a.desc || a.recuo || a.local==="emb" && a.k!=="apoioPisc";
  const wallW=Math.max(1, Math.min(4, s*0.15));
  // 1. paisagismo, calçada e caminhos
  ((C.verde||{})[local]||[]).forEach(p=>fill(p, css("--lz-c"), local==="emb"? 0.55 : 0.7));
  if(local==="terreo") (C.calcada||[]).forEach(p=>{ fill(p, css("--c-circ"), 1); stroke(p, ink, 0.6, [3,2], 0.5) });
  if(local==="emb") ((C.circ||{}).emb||[]).forEach(p=>fill(p, css("--c-circ"), 1));
  // 2. piso do hall e das galerias (o hall social em branco; galerias e sobras num cinza claro)
  if(local!=="emb"){ ((C.circ||{})[local]||[]).forEach(p=>fill(p, css("--c-hall"), 1)); if(local==="terreo") ((C.circ||{}).hall||[]).forEach(p=>fill(p, css("--c-hall"), 1));
    if(local==="terreo"){ (C.sobra||[]).forEach(p=>fill(p, css("--c-hall"), 1)); (C.estar||[]).forEach(e=>fill(e.poly, css("--c-hall"), 1)); (C.reserva||[]).forEach(p=>{ fill(p, css("--c-circ"), 1); if(s>4) hatchP(p, ink, 0.12, 0.6) }) } }
  // 3. ambientes: parede (poché) e piso na cor do uso
  lst.forEach(a=>{ const c=CMN_CAT[a.k]||{}, col=css(CMN_COR[c.cor]||"--surface");
    if(a.k==="piscina"){ fill(a.poly, css("--lz-deck"), 1); hatchP(a.poly, ink, 0.1, 0.45, 0); stroke(a.poly, ink, 0.8, [4,3], 0.6);
      const L=a.lamina||a.poly; fill(L, surf, 1); fill(L, css("--lz-agua"), 1); stroke(L, ink, Math.max(1.2, wallW*0.8)); return }
    if(ext(a) && !a.recuo){ fill(a.poly, col, a.k==="playground"? 0.9 : 0.85); if(a.k==="playground") hatchP(a.poly, ink, 0.18, 0.35, 0); stroke(a.poly, ink, 1, a.desc? [5,3] : null, 0.75); return }
    if(a.k==="hall"){ fill(a.poly, col, 1); if(s>4) hatchP(a.poly, ink, 0.05, 0.6, 0); return }   // o hall é aberto para as galerias: piso, sem parede
    fill(a.poly, ink, 1); const p=inset(a.poly, 0.075); fill(p, surf, 1); fill(p, col, 0.9) });
  // 4. portas (vão na parede, folha e arco) e janelas (dois traços de vidro)
  lst.forEach(a=>{ const c=CMN_CAT[a.k]||{}, col=css(CMN_COR[c.cor]||"--surface");
    (a.portas||[]).forEach(d=>{ const n=d.n, len=Math.hypot(d.p1[0]-d.p0[0], d.p1[1]-d.p0[1]); fill(quad(d.p0,d.p1,n,-0.09,0.09), surf, 1); fill(quad(d.p0,d.p1,n,0,0.09), col, 0.9);
      if(s<5) return; const H=d.p0, O=d.p1, Lf=add(H, n, len), h=w2s(H), l=w2s(Lf), o=w2s(O), r=Math.hypot(l[0]-h[0],l[1]-h[1]);
      g.strokeStyle=ink; g.lineWidth=Math.max(1,Math.min(1.6,s*0.06)); g.beginPath(); g.moveTo(...h); g.lineTo(...l); g.stroke();
      if(d.portao){ g.lineWidth=Math.max(1.2,Math.min(2.2,s*0.08)); g.beginPath(); g.moveTo(...h); g.lineTo(...o); g.setLineDash([2,2]); g.stroke(); g.setLineDash([]) }
      if(r>3){ const a0=Math.atan2(l[1]-h[1],l[0]-h[0]), a1=Math.atan2(o[1]-h[1],o[0]-h[0]); let da=a1-a0; while(da>Math.PI) da-=2*Math.PI; while(da<-Math.PI) da+=2*Math.PI;
        g.lineWidth=0.7; g.globalAlpha=0.55; g.beginPath(); g.arc(h[0],h[1],r,a0,a0+da,da<0); g.stroke(); g.globalAlpha=1 } });
    (a.janelas||[]).forEach(j=>{ const nIn=[-j.n[0],-j.n[1]], t=0.15; fill(quad(j.p0,j.p1,nIn,-0.02,t), surf, 1);
      [t*0.35,t*0.65].forEach(o=>line(add(j.p0,nIn,o), add(j.p1,nIn,o), j.fraca? ink2 : acc, Math.max(0.8,Math.min(1.3,s*0.05)))) }) });
  // 5. mobiliário e equipamentos
  if(s>5.5){ [...lst, ...estar].forEach(a=>(a.moveis||[]).forEach(f=>{
      if(f.t==="c"){ const [x,y]=w2s(f.c), r=f.r*s; g.beginPath(); g.arc(x,y,r,0,7);
        if(f.cl==="giro"){ g.strokeStyle=acc; g.lineWidth=0.8; g.setLineDash([3,2]); g.globalAlpha=0.7; g.stroke(); g.setLineDash([]); g.globalAlpha=1; return }
        if(f.cl==="linhac"){ g.strokeStyle=surf; g.lineWidth=1.2; g.stroke(); return }
        if(f.cl==="planta"){ g.fillStyle=css("--lz-c"); g.fill(); g.strokeStyle=css("--ok"); g.lineWidth=0.8; g.globalAlpha=0.6; g.stroke(); g.globalAlpha=1; return }
        g.fillStyle= f.cl==="gasc"? css("--c-duto") : surf; g.globalAlpha=0.95; g.fill(); g.globalAlpha=1; g.strokeStyle=ink2; g.lineWidth=0.75; g.globalAlpha=0.7; g.stroke(); g.globalAlpha=1; return }
      if(f.t==="l"){ const c= f.cl==="raia"? surf : f.cl==="linha"? surf : f.cl==="espelho"? acc : ink2; line(f.pts[0], f.pts[1], c, f.cl==="raia"? 1.4 : f.cl==="div"? 1.2 : 0.8, f.cl==="raia"? [6,4] : null, f.cl==="div"? 0.9 : 0.7); return }
      const P=f.pts;
      if(f.cl==="prainha"){ fill(P, surf, 0.35); return }
      if(f.cl==="piso"){ hatchP(P, ink, 0.12, 0.3, 0); return }
      if(f.cl==="linha"){ stroke(P, surf, 1.2); return }
      if(f.cl==="coifa"){ stroke(P, ink2, 0.8, [3,2], 0.7); return }
      if(f.cl==="escada"){ fill(P, surf, 1); stroke(P, ink2, 0.8); return }
      fill(P, f.cl==="fogo"? css("--c-duto") : f.cl==="louca"? surf : surf, 0.95); if(f.cl==="fogo") hatchP(P, ink, 0.35, 0.12);
      stroke(P, ink2, 0.75, null, 0.75) })) }
  // árvores (copa com tronco)
  ((C.arvores||{})[local]||[]).forEach(t=>{ const [x,y]=w2s(t.c), r=Math.max(3, t.r*s); g.beginPath(); g.arc(x,y,r,0,7); g.fillStyle=css("--lz-c"); g.globalAlpha=0.95; g.fill(); g.globalAlpha=1; g.strokeStyle=css("--ok"); g.lineWidth=1; g.globalAlpha=0.55; g.stroke(); g.globalAlpha=1;
    g.beginPath(); g.arc(x,y,Math.max(1.2,r*0.12),0,7); g.fillStyle=css("--ok"); g.globalAlpha=0.7; g.fill(); g.globalAlpha=1 });
  // ducha da piscina e acessos da laje
  if(local==="emb"){ if(C.ducha){ const [x,y]=w2s(C.ducha); g.beginPath(); g.arc(x,y,Math.max(3,0.3*s),0,7); g.fillStyle=surf; g.fill(); g.strokeStyle=acc; g.lineWidth=1.2; g.stroke(); if(s>7) lbl("ducha", [x, y-Math.max(9,0.6*s)], 8.5, 500, ink2) }
    (C.acessosLaje||[]).forEach(p=>{ const [x,y]=w2s(p); g.beginPath(); g.arc(x,y,4,0,7); g.fillStyle=acc; g.fill() }) }
  // 6. rota acessível (tracejada, azul: pedestres e PCD)
  //    no térreo: do portão a cada hall de elevadores (as portas acessíveis ganham um ponto azul); na laje: do acesso a cada item
  if(s>4) lst.forEach(a=>{ if(a.rotaOk===false || a.k==="hall" || local==="emb") return; (a.portas||[]).slice(0,1).forEach(d=>{ const P=w2s([(d.p0[0]+d.p1[0])/2-d.n[0]*0.45, (d.p0[1]+d.p1[1])/2-d.n[1]*0.45]); g.beginPath(); g.arc(P[0],P[1],Math.max(2,Math.min(3.5,s*0.12)),0,7); g.fillStyle=acc; g.globalAlpha=0.8; g.fill(); g.globalAlpha=1 }) });
  (C.rota||[]).filter(r=>r.local===local && r.pts.length>1 && (local==="emb" || r.amb==null)).forEach(r=>{ g.strokeStyle=acc; g.lineWidth=Math.max(1.2,Math.min(2.2,s*0.09)); g.globalAlpha=0.75; g.setLineDash([6,4]); g.lineJoin="round"; g.beginPath(); r.pts.forEach((q,i)=>{ const [x,y]=w2s(q); i?g.lineTo(x,y):g.moveTo(x,y) }); g.stroke(); g.setLineDash([]); g.globalAlpha=1 });
  // 7. problemas: contorno por dentro
  if(s>3) lst.forEach(a=>{ if(!a.nivel) return; const p=inset(a.lamina||a.poly, 0.12); if(p.length<3) return; stroke(p, css(a.nivel==="bad"?"--bad":"--warn"), a.nivel==="bad"? 2 : 1.4, a.nivel==="bad"? null : [5,3], 0.9) });
  // 8. nomes e áreas
  function lbl(t, P, size, w, col){ g.font=`${w} ${size}px ${css("--f-sans")}`; g.textAlign="center"; g.textBaseline="middle"; g.lineWidth=3; g.strokeStyle=surf; g.globalAlpha=0.85; g.strokeText(t,P[0],P[1]); g.globalAlpha=1; g.fillStyle=col||ink; g.fillText(t,P[0],P[1]) }
  if(s>6) estar.forEach(a=>{ const p=a.poly, xs=p.map(q=>w2s(q)[0]), ys=p.map(q=>w2s(q)[1]), bw=Math.max(...xs)-Math.min(...xs), bh=Math.max(...ys)-Math.min(...ys), c=w2s(G.centroid(p));
    g.font=`500 9px ${css("--f-sans")}`; if(g.measureText(a.nome).width>bw-6 || bh<26) return; lbl(a.nome, [c[0], c[1]-5], 9, 500, ink2); lbl(`${nf(a.area,0)} m²`, [c[0], c[1]+6], 8.5, 500, ink2) });
  // cada ambiente com nome (curto se preciso, menor, ou na vertical nos estreitos e compridos) e área
  const CURTO={lixo:"Lixo",medidores:"Med.",gas:"Gás",clausura:"Claus.",portaria:"Port.",dml:"DML",wc:"WC PCD",vest:"Vest.",copaf:"Copa f.",apoioPisc:"Apoio",bici:"Bicic.",
    gourmet:"Gourmet",salao:"Salão",academia:"Academia",brinq:"Brinq.",cowork:"Cowork",lavand:"Lavand.",jogos:"Jogos",cinema:"Cinema",sauna:"Sauna",copa:"Copa",playground:"Play",pet:"Pet",quadra:"Quadra",deck:"Solário",hall:"Hall"};
  if(s>3) lst.forEach(a=>{ const p=a.lamina||a.poly, xs=p.map(q=>w2s(q)[0]), ys=p.map(q=>w2s(q)[1]), bw=Math.max(...xs)-Math.min(...xs), bh=Math.max(...ys)-Math.min(...ys), c=w2s(G.centroid(p));
    const MINI={wc:"WC",apoioPisc:"WC",vest:"Vest",copaf:"Copa",copa:"Copa",bici:"Bici",lavand:"Lav.",clausura:"Cl.",portaria:"Port",lixo:"Lixo",gas:"Gás",medidores:"Med"};
    const nomes=[a.nome, CURTO[a.k]||a.nome, MINI[a.k]||CURTO[a.k]||a.nome].filter((x,i,v)=>v.indexOf(x)===i), tam=s>14? [10.5,9.5,8.5] : [9.5,8.5,7.5];
    const area=`${nf(a.area,0)} m²${a.k==="piscina"&&a.deckA? ` · deck ${nf(a.deckA,0)} m²` : ""}`;
    let esc0=null;
    for(const vert of [false,true]){ const W_=vert? bh : bw, H_=vert? bw : bh;
      for(const nm of nomes){ for(const sz of tam){ g.font=`600 ${sz}px ${css("--f-sans")}`; if(g.measureText(nm).width<=W_-4 && H_>=sz+3){ esc0={nm,sz,vert,W_,H_}; break } } if(esc0) break }
      if(esc0) break }
    if(!esc0) return;
    g.save(); g.translate(c[0], c[1]); if(esc0.vert) g.rotate(-Math.PI/2);
    const two=esc0.H_>esc0.sz*2+10 && s>6; lbl(esc0.nm, [0, two? -6 : 0], esc0.sz, 600);
    if(two){ g.font=`500 ${Math.min(9,esc0.sz)}px ${css("--f-sans")}`; let t=area; if(g.measureText(t).width>esc0.W_-4) t=`${nf(a.area,0)} m²`; if(g.measureText(t).width<=esc0.W_-4) lbl(t, [0, 6], Math.min(9,esc0.sz), 500, ink2) }
    g.restore() });
  return true;
}
/* legenda (plan2d/views): itens das áreas comuns */
function cmnLeg(sw, ln){
  const m=window._last && window._last.m; if(!m || !m.comuns) return "";
  return sw("var(--c-hall)","hall social e galerias","border:1px solid var(--line)")+sw("var(--c-ant)","portaria")+sw("var(--c-sac)","sanitários e vestiários")+sw("var(--c-esc)","serviço (DML, copa, bicicletário)")+sw("var(--c-tec)","lixo e medidores")+sw("var(--c-duto)","central de gás")+(ln? ln("var(--d-acc)","rota acessível",true) : "");
}

/* ---------- Projeto › Andares: "Térreo e áreas comuns" ---------- */
const CMN_GRUPOS = [["acesso","Acesso"],["lazer","Lazer"],["externo","Lazer descoberto"],["apoio","Apoio"],["servico","Serviço"],["tecnico","Técnico (no recuo)"]];
function cmnNivel(n){ return n>=80? "ok" : n>=60? "warn" : "bad" }
function cmnSecHTML(){
  return SEC("Térreo e áreas comuns", `<div id="cmnRes"></div><div class="list" id="cmnPb"></div><div id="cmnProg"></div>`+
    ADV(SW("comuns.on","Planta detalhada do térreo e do lazer",{rr:true})+SW("comuns.funcionarios","Vestiário e copa de funcionários")+SW("comuns.bici","Bicicletário no térreo")+
      SEG("comuns.gas",[["glp","Central de GLP"],["rede","Gás de rua"]])+NUM("comuns.galeria","Largura das galerias","m",{step:0.1,min:1.2,max:3}), {key:"cmnOpc"}),
    {key:"comuns", sum:"", info:"Térreo e áreas comuns"});
}
function cmnSum(m){ const C=m&&m.comuns; if(!C) return S.comuns&&S.comuns.on===false? "simplificado" : "—"; const nv=cmnNivel(C.nota); return `<span style="color:var(--${nv==="ok"?"ok-t":nv==="warn"?"warn-t":"bad"})">nota ${C.nota}</span> · ${C.amb.length} ambientes` }
function cmnLive(m){
  if(typeof setSum==="function") setSum("comuns", cmnSum(m));
  const C=m&&m.comuns, res=document.getElementById("cmnRes"); if(!res) return;
  if(!C){ res.innerHTML=`<p class="note">${S.comuns&&S.comuns.on===false? "Planta simplificada: o lazer entra como blocos no térreo." : "Sem embasamento para planejar."}</p>`; setHTML("cmnPb",""); setHTML("cmnProg",""); return }
  const nv=cmnNivel(C.nota), nb=C.problemas.filter(p=>p.nivel==="bad").length, nw=C.problemas.length-nb;
  const PART={perimetro:"ambientes nas paredes", galeria:"galeria central", neutro:"galerias", centro:"galerias", fachada:"galeria junto à fachada"};
  res.innerHTML=`<div class="row sb" style="flex-wrap:nowrap"><b>Nota ${C.nota}</b><span class="pill ${nb? "bad" : nw? "warn" : "ok"}">${nb? `${nb} grave${nb>1?"s":""}` : nw? `${nw} atenção` : "sem problemas"}</span></div>
    <div class="cmn-sub">${C.amb.length} ambientes${C.partido&&PART[C.partido]? ` · ${PART[C.partido]}` : ""}${C.falta.length? ` · <span style="color:var(--bad)">${C.falta.length} não coube${C.falta.length>1?"ram":""}</span>` : ""}</div>`;
  const MX=4;
  setHTML("cmnPb", C.problemas.slice(0,MX).map(p=>`<div class="cmn-pb"><span class="dot ${p.nivel==="bad"?"bad":"warn"}"></span><span>${esc(p.msg)}</span></div>`).join("") + (C.problemas.length>MX? `<div class="cmn-pb mais">e mais ${C.problemas.length-MX}</div>` : ""));
  const por={}; C.amb.forEach(a=>{ const c=CMN_CAT[a.k]||{}, gr= a.recuo&&c.onde==="recuo"? "tecnico" : c.grupo==="molhado"? "apoio" : (c.grupo||"lazer"); (por[gr]=por[gr]||[]).push(a) });
  setHTML("cmnProg", `<div class="cmn-prog">${CMN_GRUPOS.filter(([k])=>por[k]).map(([k,l])=>`<div class="cmn-pr"><span><b>${l}</b><i>${por[k].map(a=>esc(a.nome)+(a.local!=="terreo"? ` (${a.local==="emb"?"laje":a.local==="pav"?"pav. lazer":"rooftop"})` : "")).join(" · ")}</i></span><span class="num">${nf(por[k].reduce((s,a)=>s+(a.k==="piscina"? a.area+(a.deckA||0) : a.area),0),0)} m²</span></div>`).join("")}</div>`);
}
(function(){ const st=document.createElement("style"); st.textContent=`
.cmn-sub{font-size:12px;color:var(--muted);margin-top:2px}
.cmn-pb{display:flex;gap:8px;align-items:flex-start;margin:6px 0 0;font-size:12px;line-height:1.4;color:var(--ink-2)}
.cmn-pb .dot{flex:none;margin-top:5px}
.cmn-pb.mais{color:var(--muted);padding-left:16px}
.cmn-prog{margin-top:10px;border-top:1px solid var(--line)}
.cmn-pr{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--line);font-size:12px}
.cmn-pr>span:first-child{display:flex;flex-direction:column;gap:1px;min-width:0}
.cmn-pr i{font-style:normal;color:var(--muted);font-size:11px;line-height:1.35}
.cmn-pr .num{flex:none;font-variant-numeric:tabular-nums;color:var(--ink-2)}`; document.head.appendChild(st) })();
addCard("projeto", { key:"comuns", order:58, sub:"tipo", html:()=>cmnSecHTML(), live:(m)=>cmnLive(m) });

/* ---------- Produto › Áreas comuns e lazer: apoio do condomínio (automático) ---------- */
function cmnApoioRow(m, aberta){
  const prog= m && m.comuns? m.comuns.prog : (typeof comunsPrograma==="function"? comunsPrograma(S, m||{}) : []);
  const apoio=prog.filter(a=>a.ix==null && a.k!=="hall"), A=apoio.reduce((s,a)=>s+a.A,0);
  return `<div class="pr-row${aberta?" on":""}" data-row="apoio:0"><div class="pr-rh"><button type="button" class="pr-tx" data-act="prTog" data-k="apoio" data-i="0" aria-expanded="${!!aberta}"><b>Apoio do condomínio</b><span>${m2(A)} · automático · ${apoio.length} ambientes</span></button>${typeof prChev==="function"? prChev("apoio",0,!!aberta,"Apoio do condomínio") : ""}</div>
    ${aberta? `<div class="pr-rb"><p class="note">${apoio.map(a=>`${esc(a.nome)} ${nf(a.A,0)} m²`).join(" · ")}</p><button type="button" class="btn ghost sm" data-act="cmnVer">Ver no térreo →</button></div>` : ""}</div>`;
}
ACT.cmnVer=()=>{ if(typeof irPara==="function") irPara("projeto","tipo","comuns"); else { goStep("projeto","tipo") } if(typeof ANDAR!=="undefined"){ ANDAR="ter"; if(typeof setView==="function") setView("andar") } };

/* ---------- 3D: apoio da piscina e árvores (laje e jardins do térreo); o resto vem de m.lzLay em view3d.js ---------- */
function cmn3d(m, yLaje){
  const C=m&&m.comuns; if(!C || typeof THREE==="undefined" || !V3 || !V3.grp) return;
  const verde=col3("--lz-c"), tronco=new THREE.Color(0x8a7356);
  C.amb.filter(a=>a.local==="emb" && a.k==="apoioPisc").forEach(a=>slab(a.poly, yLaje, 2.7, col3("--surface"), {eop:0.3, rough:0.6}));
  const arv=(t,y)=>{ const r=Math.max(0.8, Math.min(2.2, t.r)), h=r*1.6;
    const tr=new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, h, 6), new THREE.MeshStandardMaterial({color:tronco, roughness:0.9, clippingPlanes:V3.clip})); tr.position.set(t.c[0], y+h/2, -t.c[1]); tr.castShadow=true; V3.grp.add(tr);
    const co=new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), new THREE.MeshStandardMaterial({color:verde.clone().multiplyScalar(0.82), roughness:0.85, flatShading:true, clippingPlanes:V3.clip})); co.position.set(t.c[0], y+h+r*0.55, -t.c[1]); co.castShadow=true; co.receiveShadow=true; V3.grp.add(co) };
  ((C.arvores||{}).emb||[]).slice(0,40).forEach(t=>arv(t, yLaje));
  ((C.arvores||{}).terreo||[]).slice(0,40).forEach(t=>arv(t, 0.05));
}

/* ---------- PDF: página "Térreo e áreas comuns" (planta do térreo, nota, problemas e programa) ---------- */
HOOK.pdf.push(async ctx=>{
  const {m,rows,h2,PW,M}=ctx, C=m&&m.comuns; if(!C) return;
  ctx.newPage(); h2(`Térreo e áreas comuns · nota ${C.nota}`);
  const url=(typeof withLight==="function"? withLight : f=>f())(()=>{ const W=1400, H=1000, cv=document.createElement("canvas"); cv.width=W; cv.height=H; const g=cv.getContext("2d");
    const V=fitView([m.emb], W/2, H/2, 1.08); g.scale(2,2); drawPlan(g, W/2, H/2, V, "gar", m, {lay:m.gar&&m.gar.ter, floor:m.emb, floorKey:"ter", bg:false, path:false}); return cv.toDataURL("image/jpeg",0.9) });
  ctx.img(url, PW-2*M, (PW-2*M)*1000/1400);
  if(C.problemas.length) rows(C.problemas.slice(0,8).map(p=>[p.msg, "", p.nivel]));
  const por={}; C.amb.forEach(a=>{ const c=CMN_CAT[a.k]||{}, gr=a.recuo&&c.onde==="recuo"? "tecnico" : (c.grupo||"lazer"); (por[gr]=por[gr]||[]).push(a) });
  h2("Programa");
  rows(CMN_GRUPOS.filter(([k])=>por[k]).map(([k,l])=>[`${l}: ${por[k].map(a=>a.nome).join(", ")}`, m2(por[k].reduce((s,a)=>s+(a.k==="piscina"? a.area+(a.deckA||0) : a.area),0))]));
});
