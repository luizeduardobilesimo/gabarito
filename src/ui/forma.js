/* ================= 2.4 regras avançadas de forma — interface =================
   Campos na seção "Forma do edifício" (etapa Regras › Prefeitura), linhas na conformidade e desenho do envelope
   escalonado na implantação e dos terraços nos andares recuados. Cálculo em src/calc/forma.js + massing. */
function formaRecuosHTML(){
  const F=S.forma; if(!F) return "";
  // seção "Forma do edifício" (etapa Regras › Prefeitura): desligada = só o interruptor
  let h = `<div data-q="forma recuo progressivo escalonada aeródromo soleira embasamento">${SW("forma.on","Regras avançadas de forma",{rr:true})}</div>`;
  if(!F.on) return h;
  h += `<div class="row sb" data-q="afastamento faixas altura progressivo" style="flex-wrap:nowrap">${SW("forma.prog","Afastamento por faixas de altura",{rr:true})}${INFO("Recuo progressivo")}</div>`;
  if(F.prog){
    const n=F.faixas.length;
    h += `<div class="list" id="formaFx">` + `<div class="li" style="grid-template-columns:1fr 1fr 1fr 24px;font-size:10.5px;color:var(--muted)"><span>Até a cota</span><span>Mínimo</span><span>Ou H ÷</span><span></span></div>` +
      F.faixas.map((b,i)=>{ const last=i===n-1;
        return `<div class="li" style="grid-template-columns:1fr 1fr 1fr 24px">`+
          (last? `<div class="inp" title="Última faixa: vale até o topo"><input type="text" value="acima" disabled aria-label="Cota da faixa ${i+1}"></div>`
               : `<div class="inp"><input type="number" step="0.5" min="0" data-p="forma.faixas.${i}.ate" data-min="0" data-fx="upd" value="${fmtIn(b.ate)}" aria-label="Faixa ${i+1}: até a cota"><em>m</em></div>`)+
          `<div class="inp"><input type="number" step="0.25" data-p="forma.faixas.${i}.af" data-min="0" data-fx="upd" value="${fmtIn(b.af)}" aria-label="Faixa ${i+1}: afastamento mínimo"><em>m</em></div>`+
          `<div class="inp"><input type="number" step="0.5" data-p="forma.faixas.${i}.div" data-min="0" data-zero="1" data-fx="upd" value="${b.div? fmtIn(b.div) : ""}" placeholder="—" aria-label="Faixa ${i+1}: H dividido por"></div>`+
          (n>1? `<button type="button" class="x" data-act="formaFxDel" data-i="${i}" aria-label="Remover faixa ${i+1}">×</button>` : `<span></span>`)+`</div>` }).join("") +
      `</div><div class="row"><button type="button" class="btn sm" data-act="formaFxAdd">Adicionar faixa</button><span class="note" id="formaFxTxt"></span></div>`;
    h += `<div data-q="torre escalonada terraço recuo">${SW("forma.escalonar","Torres escalonadas (terraços nos recuos)",{rr:true})}</div>`;
    if(F.escalonar) h += KV(NUM("forma.rMin","Encolher unidades até","%",{pct:true,step:1,min:0.5,max:1,help:"Abaixo disso o andar recuado perde unidades (mix por faixa) em vez de encolher todas",q:"mix faixa"}));
  }
  h += KV(NUM("forma.hEmbMax","Altura máx. embasamento","m",{step:0.5,zero:true,ph:"livre",q:"embasamento altura",help:"Embasamento"})+NUM("forma.soleira","Cota de soleira","m",{step:0.1,q:"soleira nível",help:"Soleira"}));
  h += `<div class="row sb" data-q="aeródromo plano proteção cone" style="flex-wrap:nowrap">${SW("forma.aero","Plano de proteção de aeródromo",{rr:true})}${INFO("Aeródromo")}</div>`;
  if(F.aero) h += KV(NUM("forma.aeroCota","Cota do plano","m",{step:0.5,q:"aeródromo limite"}));
  h += `<div id="formaRes"></div>`;
  return h;
}
ACT.formaFxAdd = ()=>{ const L=S.forma.faixas, last=L[L.length-1], prev=L[L.length-2]; const z=(prev&&+prev.ate||0)+12;
  L.splice(L.length-1, 0, {ate:z, af:last? +last.af||2 : 2, div:0}); update(); renderTab() };
ACT.formaFxDel = b=>{ const L=S.forma.faixas; if(L.length<2) return; L.splice(+b.dataset.i,1); L[L.length-1].ate=0; update(); renderTab() };
/* linhas extras na conformidade do estudo (etapa Regras) */
function formaRows(m){
  const F=S.forma; if(!F || !F.on) return [];
  const out=[];
  if(+F.hEmbMax>0) out.push(["Embasamento", m.hEmb/Math.max(1e-9,+F.hEmbMax), `${nf(m.hEmb,1)} / ${nf(+F.hEmbMax,1)} m`, m.hEmb>+F.hEmbMax+1e-6?"bad":"ok"]);
  if(F.aero) out.push(["Plano do aeródromo", m.H/Math.max(1e-9,m.hLim), `${nf(m.H,1)} / ${nf(m.hLim,1)} m`, m.H>m.hLim+1e-6?"bad":"ok"]);
  return out;
}
/* partes vivas: resumo das faixas por torre */
function formaLive(m){
  const F=S.forma; if(!F || !F.on) return;
  const tx=document.getElementById("formaFxTxt"); if(tx) tx.textContent = F.prog? `no 1º andar: ${nf(m.afast,2)} m · no topo: ${nf(F.prog? formaAf(F, m.H) : m.afast,2)} m` : "";
  const P=S.produto, rows=[];
  // faixas seguidas com o mesmo mix viram uma linha (área de ... a ...)
  m.T.forEach((t,i)=>{ const G2=[]; (t.faixas||[]).forEach(f=>{ const g=G2[G2.length-1]; if(g && g.qtd.join()===f.qtd.join()){ g.ate=f.ate; g.A1=f.A; g.tot+=f.A*f.n } else G2.push({de:f.de, ate:f.ate, qtd:f.qtd, A0:f.A, A1:f.A, tot:f.A*f.n}) });
    G2.forEach(f=>{ const mix=P.mix.map((u,j)=>f.qtd[j]? `${f.qtd[j]}× ${esc(u.nome)}` : "").filter(Boolean).join(" + ")||"—";
      rows.push(`<tr><td>T${i+1} · ${f.de===f.ate? f.de+"º" : f.de+"º–"+f.ate+"º"} <span class="note">${mix} · ${Math.abs(f.A0-f.A1)<0.5? m2(f.A0) : nf(f.A0,0)+" → "+m2(f.A1)}</span></td><td>${m2(f.tot)}</td></tr>`) }) });
  const tot = `<tr class="tot"><td>Pavimentos das torres · CA ${nf(m.CA,2)}</td><td>${m2(m.tiposA)}</td></tr>`;
  const extra = [F.soleira? `topo na cota ${nf(+F.soleira+m.H,1)} m (soleira ${nf(+F.soleira,2)} m)` : "", F.aero? `limite ${nf(m.hLim,1)} m acima da soleira` : ""].filter(Boolean).join(" · ");
  setHTML("formaRes", `<table class="tbl" style="margin-top:6px">${rows.join("")}${tot}</table>${extra? `<p class="note">${extra}</p>` : ""}`);
}
addCard("regras", {key:"formaLive", order:61, html:()=>"", live:m=>formaLive(m)});
/* desenho: envelope escalonado na implantação; terraço nos andares recuados */
HOOK.draw2d.push((g, ctx)=>{
  const {mode, m, opt, w2s, V}=ctx; if(!m || !m.forma) return;
  const path=p=>{ g.beginPath(); p.forEach((q,i)=>{ const [x,y]=w2s(q); i? g.lineTo(x,y) : g.moveTo(x,y) }); g.closePath() };
  const lab=(t,[x,y])=>{ g.font="500 10px "+css("--f-mono"); g.textAlign="center"; g.textBaseline="middle"; const tw=g.measureText(t).width+8; g.fillStyle=css("--surface"); g.globalAlpha=0.85; g.fillRect(x-tw/2,y-8,tw,16); g.globalAlpha=1; g.fillStyle=css("--ink"); g.fillText(t,x,y) };
  if(mode==="impl" && m.env && m.env.length>1){
    // até 5 contornos: o do 1º andar, os das mudanças de faixa e o do topo do estudo
    const top=m.env.filter(e=>e.z0<m.H-1e-6), pick=[top[0]]; const F=S.forma, cut=(F.faixas||[]).map(b=>+b.ate).filter(z=>z>0);
    cut.forEach(z=>{ const e=top.find(e=>e.z0>=z-1e-6); if(e && !pick.includes(e)) pick.push(e) }); const last=top[top.length-1]; if(last && !pick.includes(last)) pick.push(last);
    g.save(); g.strokeStyle=css("--m-env"); g.lineWidth=1.1; g.setLineDash([5,4]);
    pick.slice(0,5).forEach((e,k)=>{ if(!e.poly.length) return; path(e.poly); g.globalAlpha= k? 0.75 : 1; g.stroke(); g.globalAlpha=1;
    });
    g.restore();
  }
  if(mode==="andar" && opt.andar && opt.andar.tipo==="tipo"){
    const j=opt.andar.j;
    m.T.forEach(t=>{ const f=(t.faixas||[]).find(f=>j+1>=f.de && j+1<=f.ate); if(!f || j>=t.pav || f.plate===t.plate) return;
      // terraço = planta típica fora da planta deste andar
      const ring=p=>p.forEach((q,i)=>{ const [x,y]=w2s(q); i? g.lineTo(x,y) : g.moveTo(x,y) });
      g.save(); g.beginPath(); ring(t.plate); g.closePath(); if(f.plate.length){ ring(f.plate); g.closePath() } g.fillStyle=css("--lz-deck"); g.globalAlpha=0.92; g.fill("evenodd");
      g.globalAlpha=1; if(f.plate.length){ path(f.plate); g.strokeStyle=css("--ink"); g.lineWidth=1.8; g.stroke() }
      g.restore();
      const ter=t.A-f.A; if(V.s>2){ const c=w2s(G.centroid(f.plate.length? f.plate : t.plate)); const mix=S.produto.mix.map((u,k)=>f.qtd[k]? `${f.qtd[k]}× ${u.nome}` : "").filter(Boolean).join(" + "); lab(`andar recuado · ${mix} · terraços ${m2(ter)}`, [c[0], c[1]+22]) }
    });
  }
});
/* legenda: terraço nos andares recuados */
function formaLegenda(){
  const el=document.getElementById("planLeg"), m=window._last&&window._last.m; if(!el || !m || !m.forma || el.querySelector(".formaLeg") || VIEW!=="andar") return;
  const a=typeof floorsList==="function"? floorsList(m).find(f=>f.key===ANDAR) : null; if(!a || a.tipo!=="tipo") return;
  if(!m.T.some(t=>{ const f=(t.faixas||[]).find(f=>a.j+1>=f.de && a.j+1<=f.ate); return f && f.plate!==t.plate })) return;
  el.insertAdjacentHTML("beforeend", `<div class="formaLeg"><i style="background:var(--lz-deck)"></i>terraço (andar recuado)</div>`);
}
if(typeof planLegend==="function"){ const _plForma=planLegend; planLegend=function(){ _plForma.apply(this, arguments); try{ formaLegenda() }catch(e){ console.error("[forma] legenda", e) } } }
/* ---------- relatório PDF: faixas de andares ---------- */
HOOK.pdf.push(async ctx=>{ const m=ctx.m, F=S.forma; if(!m || !m.forma || !F) return;
  const L=[]; m.T.forEach((t,i)=>(t.faixas||[]).forEach(f=>L.push([`Torre ${i+1} · ${f.de===f.ate? f.de+"º" : f.de+"º a "+f.ate+"º"} pav.`, `${m2(f.A)} × ${f.n} · ${f.qtd.reduce((s,n)=>s+n,0)} un/andar`])));
  ctx.h2("Forma do edifício — faixas de andares");
  ctx.rows([...(F.prog? [["Afastamento às divisas", F.faixas.map((b,k)=>`${k<F.faixas.length-1? "até "+nf(+b.ate,1)+" m" : "acima"}: ${b.div>0? "máx("+nf(+b.af,2)+" m; H÷"+nf(+b.div,1)+")" : nf(+b.af,2)+" m"}`).join(" · ")]] : []),
    ...L, ["Pavimentos das torres", m2(m.tiposA)], ...(+F.hEmbMax>0? [["Embasamento", `${nf(m.hEmb,1)} m (máx. ${nf(+F.hEmbMax,1)} m)`, m.hEmb>+F.hEmbMax+1e-6? "bad" : "ok"]] : []),
    ...(F.aero? [["Plano do aeródromo", `limite ${nf(m.hLim,1)} m acima da soleira`, m.H>m.hLim+1e-6? "bad" : "ok"]] : [])]);
});
