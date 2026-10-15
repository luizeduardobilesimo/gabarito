/* ================= 2.2 malha estrutural — interface =================
   Card "Pilares (malha estrutural)" em Projeto › Garagem, comparação de malhas (num Worker próprio, para não travar a página),
   pilares nas plantas (HOOK.draw2d) e no 3D (HOOK.draw3d). Cálculo em src/calc/estrutura.js. */
let ESTR_CMP = null; // {sig, list, rodando}
const estrSig = ()=> JSON.stringify([S.lote, S.regras, S.produto, S.estudo, S.custom, S.estrutura, S.forma||0]);
function estrCardHTML(){
  const ES=S.estrutura;
  let h = SW("estrutura.on","Malha estrutural coordenada",{rr:true});
  const INF="Pilares da torre nas paredes entre unidades e no núcleo, casados com o módulo da garagem. O que não alinha vira viga de transição, com custo.";
  if(!ES.on) return SEC("Pilares (malha estrutural)", h, {key:"estrutura", sum:"desligada", info:INF});
  h += SEG("estrutura.malha",[["casada","Casada com a garagem","Ajusta cada pilar (até a tolerância) para cair entre as vagas"],["paredes","Só nas paredes","Pilares exatamente nos encontros das paredes, sem coordenação"]],{full:true, label:"Malha"});
  h += `<div id="estrMet" class="kv" style="margin-top:4px"></div>`;
  h += `<div class="row"><button type="button" class="btn sm" data-act="estrComparar" id="estrCmpBtn">Comparar malhas</button><span class="note" id="estrCmpTxt"></span></div><div id="estrCmp"></div>`;
  h += ADV(KV((ES.malha==="casada"? NUM("estrutura.tol","Ajuste máx. do pilar","m",{step:0.1,min:0,max:2,help:"Quanto um pilar pode sair do encontro das paredes para descer entre as vagas"}) : "") + NUM("estrutura.vaoMax","Vão máximo","m",{step:0.5,min:3,max:15}))+
    `<div data-q="custo transição">${SW("estrutura.custo","Somar as transições ao custo da obra",{rr:true})}</div>`+
    (ES.custo? KV(NUM("estrutura.custoM","Viga de transição","R$/m",{step:250,min:0,help:"Custo por metro de viga; multiplicado pelo vão e por um fator de carga (0,5 + pavimentos ÷ 20)"})) : ""), {key:"estrAdv"});
  return SEC("Pilares (malha estrutural)", h, {key:"estrutura", sum:"pilares e transições", info:INF});
}
function estrMetHTML(m){
  const e=m && m.estr; if(!e) return `<p class="note">${S.estrutura.on? "Calculando os pilares…" : ""}</p>`;
  const mot=Object.entries(e.motivos||{}).map(([k,n])=>`${n} em ${k}`).join(" · ");
  const met=(l,v,s,c)=>`<div class="met"><div class="l">${l}</div><div class="v"${c?` style="color:var(--${c})"`:""}>${v}</div>${s?`<div class="s">${s}</div>`:""}</div>`;
  return met("Pilares da torre", nf(e.nPil,0), e.nDesloc? `${e.nDesloc} ajustado${e.nDesloc>1?"s":""} p/ garagem` : "nas paredes") +
         met("Transições", nf(e.nTrans,0), mot||"todos descem direto", e.nTrans? "warn" : "ok") +
         `<div class="met" style="grid-column:1/-1"><div class="l">Custo das vigas de transição</div><div class="v">${e.nTrans? brl(e.custo) : "—"}</div><div class="s">${e.nTrans? (S.estrutura.custo? "somado ao custo da obra" : "não somado (opção desligada)") : "sem transições"}</div></div>`;
}
function estrCmpHTML(){
  const C=ESTR_CMP; if(!C || !C.list) return "";
  const cur=S.estrutura.malha, nM=Math.round(S.estudo.porModulo), best=Math.min(...C.list.map(r=>r.custo));
  return `<table class="tbl" style="margin-top:6px"><tr><th>Malha</th><th>Transições</th></tr>` + C.list.map((r,i)=>{ const on=r.malha===cur && r.porModulo===nM;
    return `<tr><td><b style="font-weight:600">${esc(r.nome)}</b><div class="note">${r.vagas} vagas · ${r.nPil} pilares${r.nDesloc? ` · ${r.nDesloc} ajustados` : ""}${r.custo===best? ` · <span style="color:var(--ok-t)">menor custo</span>` : ""}</div>
      ${on? `<span class="pill ok">em uso</span>` : `<button type="button" class="btn sm ghost" data-act="estrAplicar" data-i="${i}" style="margin-top:4px">Usar esta</button>`}</td><td>${r.nTrans}<div class="note">${r.nTrans? brl(r.custo) : "—"}</div></td></tr>` }).join("") + `</table>` +
    `<p class="note">O módulo alternativo refaz a garagem em modo rápido; as vagas são estimadas pela diferença.</p>`;
}
addCard("projeto", {key:"estrutura", order:70, sub:"gar", html:()=>estrCardHTML(),
  live:m=>{ setHTML("estrMet", estrMetHTML(m)); if(S.estrutura.on && m.estr) setSum("estrutura", `${nf(m.estr.nPil,0)} pilares · <b>${nf(m.estr.nTrans,0)}</b> transiç${m.estr.nTrans===1?"ão":"ões"}`); if(!m.estr) document.querySelectorAll("#planLeg .estrLeg").forEach(x=>x.remove()); else estrLegenda(); const C=ESTR_CMP; if(C && C.sig!==estrSig() && !C.rodando){ ESTR_CMP=null; setHTML("estrCmp",""); const t=document.getElementById("estrCmpTxt"); if(t) t.textContent="" } },
  after:()=>{ const m=window._last&&window._last.m; setHTML("estrMet", estrMetHTML(m)); if(ESTR_CMP && ESTR_CMP.sig===estrSig()) setHTML("estrCmp", estrCmpHTML()) }});
/* comparação: Worker próprio com o código de cálculo (compute + estruturaMalhas); sem Worker, roda na página */
function estrCmpWorker(st, m){
  const src=document.getElementById("calcSrc");
  if(!src || typeof Worker==="undefined" || typeof Blob==="undefined") return null;
  const boot=`\nself.window=self; self.onmessage=e=>{ try{ const st=e.data.st; S=st; const m=e.data.m && e.data.m.gar && e.data.m.tipo ? e.data.m : compute(st,{}); self.postMessage({ok:1, val:estruturaMalhas(st,m)}) }catch(err){ self.postMessage({err:String(err&&err.stack||err)}) } };`;
  try{ const url=URL.createObjectURL(new Blob([src.textContent, boot],{type:"text/javascript"})); const w=new Worker(url,{name:"gabarito-estrutura"});
    return new Promise((res,rej)=>{ w.onmessage=e=>{ w.terminate(); URL.revokeObjectURL(url); e.data.err? rej(new Error(e.data.err)) : res(e.data.val) }; w.onerror=e=>{ try{ e.preventDefault() }catch(_){} w.terminate(); URL.revokeObjectURL(url); rej(new Error(e.message||"worker")) }; try{ w.postMessage({st:clone(st), m}) }catch(_){ w.postMessage({st:clone(st), m:null}) } }) }
  catch(e){ return null }
}
ACT.estrComparar = async b=>{
  if(ESTR_CMP && ESTR_CMP.rodando) return;
  const sig=estrSig(), st=clone(S); ESTR_CMP={sig, rodando:true};
  const t=document.getElementById("estrCmpTxt"); if(t) t.textContent="comparando 3 malhas…"; if(b) b.disabled=true;
  let list=null;
  if(typeof calcPronto==="function") try{ await calcPronto() }catch(_){}
  const mAtual=window._last&&window._last.m&&window._last.m.gar? window._last.m : null;
  try{ const p=estrCmpWorker(st, mAtual); list = p? await p : null }catch(e){ console.warn("[estrutura] comparação no Worker falhou — rodando na página:", e&&e.message) }
  if(!list){ await new Promise(r=>setTimeout(r,30)); const m=window._last&&window._last.m; list = m? estruturaMalhas(S, m) : [] }
  ESTR_CMP={sig, list, rodando:false};
  const bt=document.getElementById("estrCmpBtn"); if(bt) bt.disabled=false;
  const tx=document.getElementById("estrCmpTxt"); if(tx) tx.textContent = list.length? `${list.length} malhas comparadas` : "sem garagem para comparar";
  if(estrSig()===sig) setHTML("estrCmp", estrCmpHTML());
};
ACT.estrAplicar = b=>{ const r=ESTR_CMP && ESTR_CMP.list && ESTR_CMP.list[+b.dataset.i]; if(!r) return;
  S.estrutura.malha=r.malha; S.estudo.porModulo=r.porModulo; const keep=ESTR_CMP.list; update(); ESTR_CMP={sig:estrSig(), list:keep, rodando:false}; renderTab(); toast("Malha aplicada") };

/* ---------- desenho 2D: pilares da torre em todas as plantas ---------- */
HOOK.draw2d.push((g, ctx)=>{
  const {mode, m, opt, w2s, V, W, H}=ctx, e=m && m.estr; if(!e) return;
  const sq=(p, fill, stroke, dash)=>{ const s=Math.max(3.5, e.sec*V.s); if(e.sec*V.s>=4){ g.beginPath(); p.poly.forEach((q,i)=>{ const [x,y]=w2s(q); i? g.lineTo(x,y) : g.moveTo(x,y) }); g.closePath() } else { const [x,y]=w2s(p.c); g.beginPath(); g.rect(x-s/2,y-s/2,s,s) }
    if(fill){ g.fillStyle=fill; g.fill() } if(stroke){ g.setLineDash(dash||[]); g.strokeStyle=stroke; g.lineWidth=1.2; g.stroke(); g.setLineDash([]) } };
  const ink=css("--ink"), warn=css("--warn"), surf=css("--surface");
  let key=null, tower=null;
  if(mode==="gar") key=opt.floorKey||null;
  else if(mode==="andar" && opt.andar){ const a=opt.andar; key = a.tipo==="sub"||a.tipo==="ac"? a.lay : a.tipo==="ter"? "ter" : null; if(!key) tower="all" }
  else if(mode==="tipo") tower=opt.tower||0;
  else return;
  const pis=key? e.pisos.find(p=>p.k===key) : null; let nT=0;
  const jA = mode==="andar" && opt.andar && opt.andar.tipo==="tipo" ? opt.andar.j : null; // pavimento tipo: só torres que chegam nele, só pilares dentro da planta do andar
  e.torres.forEach(tw=>{ if(tower!=="all" && tower!=null && tw.i!==tower) return;
    const t=m.T[tw.i]; if(!t || (jA!=null && jA>=t.pav)) return;
    const fa = jA!=null && t.faixas ? t.faixas.find(f=>jA+1>=f.de && jA+1<=f.ate) : null, pf = fa && fa.plate!==t.plate ? fa.plate : null;
    tw.pts.forEach(p=>{ if(pf && !G.pip(p.c, pf)) return;
      if(key){ if(!pis) return;
        if(p.st==="direto") sq(p, ink, surf);
        else if(pis.zb >= p.zT-1e-6) sq(p, warn, surf);                       // acima da transição: o pilar existe
        else if(p.kT===key){ nT++; sq(p, null, warn, [3,2]); if(V.s>6){ const [x,y]=w2s(p.c); g.font="600 9px "+css("--f-mono"); g.fillStyle=warn; g.textAlign="left"; g.textBaseline="bottom"; g.fillText("T", x+Math.max(3,e.sec*V.s/2)+1, y-2) } }
      } else if(tower!=null){ sq(p, p.st==="direto"? ink : warn, surf); if(p.st!=="direto") nT++ } }) });
});
/* legenda da planta: itens dos pilares quando a malha está ligada (acrescentados à legenda do palco) */
function estrLegenda(){
  const el=document.getElementById("planLeg"), m=window._last&&window._last.m; if(!el || !m || !m.estr || el.querySelector(".estrLeg")) return;
  const a = VIEW==="andar" && typeof floorsList==="function"? floorsList(m).find(f=>f.key===ANDAR) : null;
  const gar = VIEW==="gar" || (a && (a.tipo==="sub"||a.tipo==="ac"||a.tipo==="ter")), tor = VIEW==="tipo" || (a && !gar);
  if(!gar && !tor) return;
  const it=(st,l)=>`<div class="estrLeg"><i style="${st}"></i>${l}</div>`;
  el.insertAdjacentHTML("beforeend", it("background:var(--ink)","pilar contínuo da torre") + (gar? it("background:transparent;border:1px dashed var(--warn)","pilar da torre sobre viga de transição (T)") : it("background:var(--warn)","pilar que nasce em viga de transição")));
}
if(typeof planLegend==="function"){ const _plEstr=planLegend; planLegend=function(){ _plEstr.apply(this, arguments); try{ estrLegenda() }catch(e){ console.error("[estrutura] legenda", e) } } }
/* ---------- 3D: pilares contínuos, pilares sobre transição e as vigas ---------- */
HOOK.draw3d.push((grp, m)=>{
  const e=m && m.estr; if(!e || typeof THREE==="undefined") return;
  const P=S.produto, zFund=-P.subsolos*P.peGar, sec=e.sec;
  const mat=c=>new THREE.MeshStandardMaterial({color:c, roughness:0.85, clippingPlanes:V3.clip});
  const mP=mat(col3("--muted")), mT=mat(col3("--warn")), mG=mat(col3("--m-sub"));
  const box=(c, z0, z1, w, d, ang, mt)=>{ if(!(z1>z0)) return; const b=new THREE.Mesh(new THREE.BoxGeometry(w, z1-z0, d), mt); b.position.set(c[0], (z0+z1)/2, -c[1]); b.rotation.y=ang; b.castShadow=true; b.receiveShadow=true; grp.add(b) };
  // dentro da torre os pilares ficam embutidos (cor neutra); no embasamento e na garagem aparecem: contínuos em cinza, transições em destaque
  e.torres.forEach(tw=>{ const t=m.T[tw.i], lay=m.tipo&&m.tipo[tw.i]; if(!t || !lay) return; const ang=Math.atan2(lay.ux[1], lay.ux[0]);
    const z0=m.hEmb+(m.pavLz && tw.i===0? P.pe : 0), fx=t.faixas&&t.faixas.length? t.faixas : [{de:1, ate:t.pav, plate:t.plate}];
    tw.pts.forEach(p=>{ const ate=Math.max(0, ...fx.filter(f=>f.plate.length && G.pip(p.c,f.plate)).map(f=>f.ate)), top=z0+ate*P.pe-0.22;
      const zb = p.st==="direto"? zFund : p.zT;
      box(p.c, zb, Math.min(z0, top), sec, sec, ang, p.st==="direto"? mP : mT);
      box(p.c, Math.max(zb, z0), top, sec-0.02, sec-0.02, ang, mP);
      if(p.st!=="direto"){ const a=p.ap, d=a? Math.hypot(a[0]-p.c[0], a[1]-p.c[1]) : 0; // viga: do pilar até o apoio mais próximo
        if(d>0.3){ const mid=[(a[0]+p.c[0])/2, (a[1]+p.c[1])/2]; box(mid, p.zT-0.9, p.zT-0.05, d+sec, sec+0.1, Math.atan2(a[1]-p.c[1], a[0]-p.c[0]), mT) } } }) });
  // pilares da garagem (módulo das vagas) em cada pavimento
  Object.entries(m.gar||{}).forEach(([k,l])=>{ if(!l || !l.pillars) return; const pi=e.pisos.find(x=>x.k===k); if(!pi) return; const ang=l.ux? Math.atan2(l.ux[1],l.ux[0]) : 0;
    l.pillars.forEach(pp=>box(G.centroid(pp), pi.zb, pi.z-0.2, +S.estudo.pilar||0.4, +S.estudo.pilar||0.4, ang, mG)) });
});
/* ---------- relatório PDF: resumo da malha ---------- */
HOOK.pdf.push(async ctx=>{ const e=ctx.m && ctx.m.estr; if(!e) return;
  ctx.h2("Estrutura — malha coordenada");
  ctx.rows([["Malha", e.malha==="casada"? `casada com a garagem (módulo de ${Math.round(S.estudo.porModulo)} vagas, ajuste até ${nf(e.tol,1)} m)` : "pilares nas paredes, sem coordenação"],
    ["Pilares da torre", `${e.nPil} (${e.nDesloc} ajustados para descer entre as vagas)`],
    ["Vigas de transição", e.nTrans? `${e.nTrans} · ${brl(e.custo)}${S.estrutura.custo? "" : " (fora do custo da obra)"}` : "nenhuma", e.nTrans? "warn" : "ok"],
    ...Object.entries(e.motivos||{}).map(([k,n])=>[`  pilares sobre ${k}`, String(n)])]);
});
