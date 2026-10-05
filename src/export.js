/* ================= relatório e exportações ================= */
const useCap = n => (window.claude && window.claude.use) ? Promise.resolve(window.claude.use(n)).catch(()=>null) : Promise.resolve(null);
async function dlNS(){ return useCap("downloads") }
async function dlCheck(){ const n=document.getElementById("dlNote"); if(!n) return; const d=await dlNS(); if(!d) n.textContent="Os downloads não estão disponíveis nesta visualização. Abra o Gabarito pelo link do claude.ai para baixar arquivos."; }
async function saveFile(filename, data){
  const d=await dlNS(); if(!d){ toast("Download indisponível nesta visualização"); return false }
  try{ await d.save({filename, data}); toast("Arquivo pronto: "+filename); return true }
  catch(e){ if(e&&e.code==="declined") toast("Download cancelado"); else if(e&&e.code==="rate_limited") toast("Já há um download aguardando confirmação"); else toast("Não foi possível baixar: "+(e&&e.code||"erro")); return false }
}
const slug = s => String(s||"estudo").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^\w]+/g,"-").replace(/^-|-$/g,"").toLowerCase().slice(0,60)||"estudo";
function exportJSON(){ saveFile(slug(S.nome)+".json", JSON.stringify({app:"gabarito",v:2,S},null,1)) }

/* ---------- imagens para o relatório ---------- */
function withLight(fn){ const root=document.documentElement, prev=root.getAttribute("data-theme"); root.setAttribute("data-theme","light"); try{ return fn() } finally { if(prev===null) root.removeAttribute("data-theme"); else root.setAttribute("data-theme",prev) } }
function planImage(mode, opt, W=1400, H=1000){
  const m=window._last.m, cv=document.createElement("canvas"); cv.width=W; cv.height=H; const g=cv.getContext("2d");
  const polys = (mode==="gar"? [opt.floor] : mode==="tipo"? [m.T[opt.tower].plate] : [S.lote.pts]).filter(p=>p&&p.length);
  const w=W/2, h=H/2, V=fitView(polys, w, h, mode==="impl"?1.35:1.12);
  g.scale(2,2); drawPlan(g, w, h, V, mode, m, {...opt, bg:false});
  return cv.toDataURL("image/jpeg",0.9);
}
function view3dImage(W=1600,H=1000){
  if(!V3.R) return null;
  const R=V3.R, size=new THREE.Vector2(); R.getSize(size); const pr=R.getPixelRatio();
  const camPos=V3.cam.position.clone(), tgt=V3.ctl.target.clone(), asp=V3.cam.aspect;
  R.setPixelRatio(1); R.setSize(W,H,false); V3.cam.aspect=W/H; V3.cam.updateProjectionMatrix();
  const wasV=V3.grp.visible; V3.grp.visible=true; if(CFD.grp) CFD.grp.visible=false; rebuild3d(window._last.m,true); fit3dFor(W,H); R.render(V3.scene,V3.cam);
  const url=R.domElement.toDataURL("image/jpeg",0.9);
  R.setPixelRatio(pr); R.setSize(size.x,size.y,false); V3.cam.aspect=asp; V3.cam.updateProjectionMatrix(); V3.cam.position.copy(camPos); V3.ctl.target.copy(tgt); V3.ctl.update();
  rebuild3d(window._last.m,true); V3.grp.visible=wasV; if(CFD.grp&&VIEW==="v3d") CFD.grp.visible=true; render3(); return url;
}
function fit3dFor(W,H){ const L=S.lote.pts, c=G.centroid(L), m=window._last.m; const span=Math.max(...L.map(q=>Math.hypot(q[0]-c[0],q[1]-c[1]))); const h=m.H; const d=Math.max(span*2.9,h*1.9,45)*Math.max(1,H/W*1.1);
  V3.ctl.target.set(c[0],h*0.38,-c[1]); V3.cam.position.set(c[0]+d*0.75,h*0.5+d*0.55,-c[1]+d*0.85); V3.cam.lookAt(V3.ctl.target) }

/* ---------- PDF ---------- */
async function exportPDF(){
  toast("Montando o relatório…");
  try{ await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js") }catch(e){ toast("Não consegui carregar o gerador de PDF"); return }
  const {m,f}=window._last, P=S.produto, R=S.regras, F=S.fin;
  const imgs = withLight(()=>({
    v3: view3dImage(),
    impl: planImage("impl",{}),
    gar: [...new Set(["s1","s"+S.produto.subsolos,"ter","g1"])].filter(k=>m.gar&&m.gar[k]).map(k=>({k, img:planImage("gar",{lay:m.gar[k], floor:k[0]==="s"?m.sub:m.emb, floorKey:k},1400,900)})),
    tipo: m.T.map((t,i)=>t.plate.length? planImage("tipo",{tower:i},1400,900):null),
    sol: (sunHours(S,m), planImage("clima",{kind:"sol"},1400,1000)),
    vento: WIND.steps>=2400? planImage("clima",{kind:"vento"},1400,1000) : null
  }));
  const T=s=>String(s).replace(/[→]/g,"->").replace(/[≈]/g,"~").replace(/[−–—]/g,"-").replace(/[÷]/g,"/").replace(/[“”]/g,'"');
  const doc=new window.jspdf.jsPDF({unit:"mm",format:"a4"}); const PW=210, M=14; let y=0;
  const MK=(typeof marcaPdf==="function")? marcaPdf() : null;   // marca do usuário (null = PDF padrão do Gabarito)
  const ink=[28,39,41], mut=[93,106,106], acc=MK?MK.cor:[31,95,139], mark=[227,169,11], ok=[44,138,87], bad=[191,61,42];
  const head=(t)=>{ if(MK) marcaHead(doc,MK,t,PW,M,T); else { doc.setFillColor(...ink); doc.rect(0,0,PW,16,"F"); doc.setTextColor(255); doc.setFont("helvetica","bold"); doc.setFontSize(12); doc.text("GABARITO",M,10.5); doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.text(T(t),PW-M,10.5,{align:"right"}) } doc.setTextColor(...ink); y=24 };
  const h2=(t)=>{ if(y>262){ doc.addPage(); head(S.nome) } doc.setFont("helvetica","bold"); doc.setFontSize(11.5); doc.setTextColor(...ink); doc.text(T(t).toUpperCase(),M,y); doc.setDrawColor(...(MK?MK.cor:mark)); doc.setLineWidth(0.6); doc.line(M,y+1.6,M+22,y+1.6); y+=7 };
  const rows=(list,o={})=>{ doc.setFontSize(9); list.forEach(([a,b,st])=>{ if(y>280){ doc.addPage(); head(S.nome) } doc.setFont("helvetica",o.bold&&o.bold.includes(a)?"bold":"normal"); doc.setTextColor(...ink); doc.text(T(a),M+(st?4:0),y); if(st){ doc.setFillColor(...(st==="ok"?ok:st==="warn"?mark:bad)); doc.circle(M+1.2,y-1.1,1.1,"F") } doc.text(T(b),PW-M,y,{align:"right"}); doc.setDrawColor(220); doc.setLineWidth(0.1); doc.line(M,y+1.6,PW-M,y+1.6); y+=5.4 }); y+=2 };
  const img=(url,w,h)=>{ if(!url) return; if(y+h>285){ doc.addPage(); head(S.nome) } doc.addImage(url,"JPEG",M,y,w,h); doc.setDrawColor(200); doc.rect(M,y,w,h); y+=h+5 };
  // capa
  head("Estudo de viabilidade");
  if(MK) y=marcaCapa(doc,MK,{T,M,PW,y,ink,mut,nome:S.nome,sub:`${R.cidade} · ${new Date().toLocaleDateString("pt-BR")}`});
  else {
  doc.setFont("helvetica","bold"); doc.setFontSize(18); doc.text(T(S.nome),M,y+4); y+=11;
  doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.setTextColor(...mut); doc.text(T(`${R.cidade} · ${new Date().toLocaleDateString("pt-BR")}`),M,y); y+=6; doc.setTextColor(...ink);
  }
  if(!MK || MK.capa3d) img(imgs.v3,PW-2*M,(PW-2*M)*0.62);
  const kp=[["Terreno",m2(m.A)],["Unidades",String(m.units)],["Área privativa",m2(m.priv)],["Vagas",`${m.vagas} / ${m.vagasReq}`],["VGV",mi(f.vgv)],["Lucro",mi(f.lucro)],["Margem",pct(f.margem)],["TIR a.a.",f.tirA==null?"-":pct(f.tirA)]];
  const cw=(PW-2*M)/4; kp.forEach(([l,v],i)=>{ const x=M+(i%4)*cw, yy=y+Math.floor(i/4)*16; doc.setFillColor(...(MK?MK.tint:[242,244,239])); doc.rect(x+0.5,yy,cw-1,14,"F"); doc.setFontSize(7.5); doc.setTextColor(...mut); doc.text(T(l.toUpperCase()),x+3,yy+5); doc.setFontSize(11.5); doc.setTextColor(...ink); doc.setFont("helvetica","bold"); doc.text(T(v),x+3,yy+11); doc.setFont("helvetica","normal") }); y+=36;
  doc.setFontSize(8); doc.setTextColor(...mut); doc.text(T("Estudo preliminar de massa. Não substitui projeto legal, consulta de viabilidade na prefeitura nem orçamento executivo."),M,y); doc.setTextColor(...ink);
  // implantação e regras
  doc.addPage(); head(S.nome); h2("Implantação"); img(imgs.impl,PW-2*M,(PW-2*M)*0.71);
  const s=status(m,S); h2("Parâmetros urbanísticos e conformidade");
  rows([["Coeficiente de aproveitamento",`${nf(m.CA,2)} (básico ${nf(R.caBas,2)} · máx ${nf(R.caMax,2)})`,s.ca],["Altura",`${nf(m.H,1)} m (máx ${nf(R.hMax,1)} m)`,s.h],["Taxa de ocupação",`${pct(m.TO,1)} (emb. ${pct(R.toEmb,0)} · torres ${pct(R.toTorre,0)})`,"ok"],["Permeabilidade",`${pct(m.perm,1)} (mín ${pct(R.permeab,0)})`,s.perm],["Vagas",`${m.vagas} (exigidas ${m.vagasReq})`,s.vg],["Menor unidade",`${nf(m.minApto,1)} m² (mín ${nf(R.aptoMin,0)} m²)`,s.apto],["Afastamento da torre / entre torres",`${nf(m.afast,2)} m / ${m.T.length>1?nf(m.gap,2)+" m":"-"}`,s.tor],["Recuo frontal",`${nf(R.recFrente,2)} m`]]);
  // áreas
  doc.addPage(); head(S.nome); h2("Produto");
  rows([...m.T.map((t,i)=>[`Torre ${i+1}`,`${t.pav} pav · ${m2(t.A)}/andar · ${t.units} un · H ${nf(t.H,1)} m`]), ...m.unitRows.map(u=>[u.nome,`${u.n} un · ${nf(u.n?u.area/u.n:0,1)} m² · ${brl(u.preco)}/m²`]), ...(m.cobN?[["Coberturas",`${m.cobN} un · ${nf(m.cobArea/m.cobN,1)} m²${m.duplex?" (duplex)":""}`]]:[]), ...(m.lojaA?[["Lojas",`${m2(m.lojaPriv)} privativos`]]:[])]);
  h2("Quadro de áreas");
  rows([["Subsolos",m2(m.gSub)],["Térreo",m2(m.embA)],["Garagem elevada",m2(m.gAc)],["Pavimentos das torres",m2(m.tiposA)],...(m.duplexA?[["Duplex",m2(m.duplexA)]]:[]),...(P.atico?[["Ático técnico",m2(m.aticoA)]]:[]),["Área construída total",m2(m.constr)],["Área computável",m2(m.comp)],["Área privativa vendável",m2(m.priv)],["Privativa / construída",pct(m.priv/Math.max(1,m.constr))]],{bold:["Área construída total","Área privativa vendável"]});
  h2("DRE do empreendimento");
  rows([["VGV de tabela",brl(f.vgvB)],...(f.permV?[["(-) Permuta física","-"+brl(f.permV)]]:[]),["Receita nominal",brl(f.receita)],["Terreno + ITBI","-"+brl(f.terreno)],...(f.outorga?[["Outorga onerosa","-"+brl(f.outorga)]]:[]),["Obra + adm. + contingência (com INCC)","-"+brl(f.obraTot)],...(f.terra?[["Movimento de terra","-"+brl(f.terra)]]:[]),["Projetos e aprovações","-"+brl(f.projetos)],["Corretagem + marketing","-"+brl(f.corret+f.mkt)],["Impostos (RET)","-"+brl(f.imp)],...(f.permFin?[["Permuta financeira","-"+brl(f.permFin)]]:[]),...(f.juros?[["Juros do financiamento","-"+brl(f.juros)]]:[]),["Lucro",brl(f.lucro)],["Margem sobre receita",pct(f.margem)],["TIR anual",f.tirA==null?"-":pct(f.tirA)],["VPL (TMA "+pct(F.tma,1)+")",brl(f.vpl)],["Exposição máxima",brl(-f.exp)],["Payback",f.pay==null?"-":"mês "+f.pay],["Terreno máximo p/ margem "+pct(F.margemAlvo,0),brl(f.maxTerreno)]],{bold:["Lucro","Receita nominal"]});
  // fluxo
  doc.addPage(); head(S.nome); h2("Fluxo de caixa acumulado");
  { const x0=M+14, w=PW-2*M-14, h=60, cum=f.cumA, n=cum.length, mn=Math.min(0,...cum), mx=Math.max(0,...cum), sx=i=>x0+w*i/(n-1), sy=v=>y+h*(mx-v)/((mx-mn)||1);
    doc.setDrawColor(200); doc.setLineWidth(0.2); [mn,0,mx].forEach(v=>{ doc.line(x0,sy(v),x0+w,sy(v)); doc.setFontSize(7); doc.setTextColor(...mut); doc.text(nf(v/1e6,1)+" mi",x0-2,sy(v)+1,{align:"right"}) });
    doc.setDrawColor(...acc); doc.setLineWidth(0.6); for(let i=1;i<n;i++) doc.line(sx(i-1),sy(cum[i-1]),sx(i),sy(cum[i]));
    doc.setDrawColor(...mut); doc.setLineWidth(0.2); [[f.launch,"lançamento"],[f.chaves,"chaves"]].forEach(([i,l])=>{ doc.line(sx(i),y,sx(i),y+h); doc.text(T(l),sx(i)+1,y+h+4) }); y+=h+10; doc.setTextColor(...ink) }
  h2("Sensibilidade da margem (preço x custo de obra)");
  { const sg=sensGrid(S,m); rows([["","obra -10%  |  base  |  obra +10%"],...["preço -10%","preço base","preço +10%"].map((l,i)=>[l,sg[i].map(v=>pct(v)).join("   |   ")])]) }
  h2("Premissas");
  rows([S.orc&&S.orc.modo==="param"? ["CUB de referência / orçamento",`${brl(F.cub)}/m² · paramétrico por sistema`] : ["CUB de referência / fator",`${brl(F.cub)}/m² × ${nf(F.fator,2)}`],["INCC / reajuste de tabela",`${pct(F.incc)} / ${pct(F.reaj)} a.a.`],["Lançamento / obra / vendas",`mês ${F.prelanc} / ${F.obra} meses / ${F.venda} meses`],["Vendido no lançamento / pago até as chaves",`${pct(F.vendaLanc,0)} / ${pct(F.entrada,0)}`],["Corretagem / marketing / impostos",`${pct(F.corret)} / ${pct(F.mkt)} / ${pct(F.imp)}`],["Financiamento à produção",F.finOn?`${pct(F.finPct,0)} da obra a ${pct(F.finTaxa)} a.a.`:"não"],["Permuta física / financeira",`${pct(F.permuta,0)} / ${pct(F.permutaFin,1)}`]]);
  // estudo
  if(imgs.gar.length || imgs.tipo.some(Boolean)){
    doc.addPage(); head(S.nome); h2("Estudo de garagem");
    if(typeof garQuadroRows==="function" && m.quadroVagas){ rows(garQuadroRows(m).map(r=>r.map(s=>T(s).replace(/×/g,"x")))); if(m.elevCarros){ const ec=m.elevCarros; rows([["Elevador de carros",T(`${ec.n} un. · ciclo ${nf(ec.ciclo,0)} s · ${nf(ec.cap,0)} carros/h · fila prevista ${isFinite(ec.fila95)?ec.fila95:"-"} (espera ${ec.espera})`)]]) } }
    const nomes=new Proxy({},{get:(o,k)=>k==="ter"?"Térreo":nomePav(k).replace(/^./,c=>c.toUpperCase())});
    imgs.gar.forEach(g=>{ doc.setFontSize(9.5); doc.setFont("helvetica","bold"); if(y>230){ doc.addPage(); head(S.nome) } doc.text(T(`${nomes[g.k]} · ${m.gar[g.k].count} vagas`),M,y); doc.setFont("helvetica","normal"); y+=3; img(g.img,PW-2*M,(PW-2*M)*0.64) });
    imgs.tipo.forEach((u,i)=>{ if(!u) return; if(y>150){ doc.addPage(); head(S.nome) } if(i===0) h2("Pavimento tipo"); doc.setFontSize(9.5); doc.setFont("helvetica","bold"); doc.text(T(`Torre ${i+1}`),M,y); doc.setFont("helvetica","normal"); y+=3; img(u,PW-2*M,(PW-2*M)*0.64) });
  }
  doc.addPage(); head(S.nome); h2(`Horas de sol - 21/${String(S.sol.mes).padStart(2,"0")}`); img(imgs.sol,PW-2*M,(PW-2*M)*0.62);
  rows([["Média de sol nas áreas livres do lote",nf(_sunCache.mediaLote,1)+" h"],["Áreas livres com menos de 2 h de sol",pct(_sunCache.pctBaixo,0)],["Volumes no entorno",String(S.entorno.length)]]);
  if(imgs.vento){ const w=windStats(S); if(y>150){ doc.addPage(); head(S.nome) } h2(`Vento - de ${["N","NE","L","SE","S","SO","O","NO"][Math.round(S.clima.ventoDir/45)%8]}, ${nf(S.clima.ventoVel,1)} m/s a ${nf(S.clima.ventoAlt,1)} m`); img(imgs.vento,PW-2*M,(PW-2*M)*0.62);
    if(w) rows([["Velocidade máxima no lote",`${nf(w.max*S.clima.ventoVel,1)} m/s`],["Áreas com aceleração (>1,3x)",pct(w.hi,0)],["Áreas de calmaria (<0,35x)",pct(w.calm,0)]]) }
  doc.setFontSize(7.5); doc.setTextColor(...mut); if(y<280) doc.text(T("Sol: traçado de sombras. Vento: simulação 2D simplificada (Lattice Boltzmann) - uso comparativo."),M,Math.min(286,y+2));
  await runHooksAsync("pdf", {doc,m,f,T,PW,M,head,h2,rows,img,ink,mut,acc,mark,ok,bad,MK, y:()=>y, setY:v=>{y=v}, newPage:()=>{ doc.addPage(); head(S.nome) }});
  const pages=doc.getNumberOfPages(); for(let i=1;i<=pages;i++){ doc.setPage(i); if(MK) marcaRodape(doc,MK,T,PW,M); doc.setFontSize(7.5); doc.setTextColor(...mut); doc.text(`${i}/${pages}`,PW-M,292,{align:"right"}) }
  await saveFile(slug(S.nome)+"-viabilidade.pdf", doc.output("blob"));
}

/* ---------- DXF ---------- */
const ascii = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^\x20-\x7e]/g,"");
function DXF(){
  const ents=[], layers={};
  const fx=v=>(+v).toFixed(4);
  return {
    poly(layer, pts, color=7){ if(!pts||pts.length<2) return; layers[layer]=color; ents.push(`0\nPOLYLINE\n8\n${layer}\n66\n1\n70\n${pts.length>2?1:0}\n10\n0\n20\n0\n30\n0\n`+pts.map(q=>`0\nVERTEX\n8\n${layer}\n10\n${fx(q[0])}\n20\n${fx(q[1])}\n30\n0\n`).join("")+`0\nSEQEND\n8\n${layer}\n`) },
    text(layer, [x,y], h, s, color=7){ layers[layer]=color; ents.push(`0\nTEXT\n8\n${layer}\n10\n${fx(x)}\n20\n${fx(y)}\n30\n0\n40\n${h}\n1\n${ascii(s)}\n72\n1\n11\n${fx(x)}\n21\n${fx(y)}\n31\n0\n`) },
    out(){ const lt=Object.entries(layers); return `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n6\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${lt.length}\n`+lt.map(([n,c])=>`0\nLAYER\n2\n${n}\n70\n0\n62\n${c}\n6\nCONTINUOUS\n`).join("")+`0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n`+ents.join("")+`0\nENDSEC\n0\nEOF\n` }
  };
}
function dxfImpl(m){ const d=DXF(); d.poly("LOTE",S.lote.pts,7); d.poly("SUBSOLO",m.sub,8); d.poly("EMBASAMENTO",m.emb,5); (m.ter.lojas||[]).forEach(p=>d.poly("TERREO-LOJAS",p,30)); (m.ter.hall||[]).forEach(p=>d.poly("TERREO-HALL",p,4)); (m.ter.drive||[]).forEach(p=>d.poly("TERREO-ACESSO-VEICULOS",p,8)); d.poly("TERREO-GARAGEM",m.tGar,9); d.poly("ENVELOPE-TORRE",m.torAll,1);
  (S.entorno||[]).forEach(e=>{ d.poly("ENTORNO",e.pts,8); if(e.pts&&e.pts.length) d.text("TEXTOS",G.centroid(e.pts),1,`${e.nome||"Entorno"} - ${nf(e.h,1)} m`) });
  if(m.ramp) d.poly("RAMPA",m.ramp.poly,2);
  ["emb","tor","sub"].forEach(k=>{ if(S.custom[k]&&S.custom[k].length) d.poly("LIMITE-"+k.toUpperCase(),S.custom[k],6) });
  m.T.forEach((t,i)=>{ d.poly("TORRES",t.plate,2); if(t.plate.length) d.text("TEXTOS",G.centroid(t.plate),1.2,`T${i+1} - ${t.pav} pav`) });
  S.lote.pts.forEach((q,i)=>{ const b=S.lote.pts[(i+1)%S.lote.pts.length]; d.text("COTAS",[(q[0]+b[0])/2,(q[1]+b[1])/2],0.8,`L${i+1} ${nf(G.edgeLen(S.lote.pts,i),2)} m`) });
  return d.out() }
function dxfGar(m,lay,floor){ const d=DXF(); d.poly("PAVIMENTO",floor,7); (lay.path||[]).forEach(p=>{ d.poly("CAMINHO-VEICULO",[p.pts[0],p.pts[1]],1) }); (lay.routes||[]).forEach(r=>d.poly("ROTA-RAMPA",r.pts,2)); (lay.ramps||[]).forEach(r=>d.poly("RAMPA",r.poly,2)); (lay.landings||[]).forEach(p=>d.poly("PATAMAR",p,8)); (m.coreSets||[]).forEach(cs=>{ d.poly("NUCLEO",cs.core,1); if(cs.lobby) d.poly("HALL-ELEVADORES",cs.lobby,4); (cs.lay.coreParts||[]).forEach(cp=>d.poly("NUCLEO-"+cp.kind.toUpperCase(),cp.poly,1)) }); lay.pillars.forEach(p=>d.poly("PILARES",p,1));
  lay.vagas.forEach((v,i)=>{ if(v.tipo==="off") return; const L= v.tipo==="pcd"?"VAGAS-PCD": v.tipo==="idoso"?"VAGAS-IDOSO": v.tipo==="faixa"?"FAIXA-PCD":"VAGAS"; d.poly(L,v.poly, v.tipo==="pcd"?5:v.tipo==="idoso"?3:v.tipo==="faixa"?8:4); if(v.tipo!=="faixa") d.text("NUMERACAO",v.c,0.6,String(i+1)) });
  return d.out() }
function dxfTipo(m,i){ const d=DXF(), l=m.tipo[i], t=m.T[i]; d.poly("PAVIMENTO",t.plate,7); if(!l) return d.out(); d.poly("NUCLEO",l.coreOut||l.core,1); (l.coreParts||[]).forEach(cp=>d.poly("NUCLEO-"+cp.kind.toUpperCase(),cp.poly,1)); d.poly("CIRCULACAO",l.corridor,8); (l.hallEnds||[]).forEach(h=>d.poly("CIRCULACAO",h,8));
  if(typeof comDxf==="function" && S.comodos && S.comodos.on) comDxf(d, l);   // cômodos: PAREDES, PORTAS, JANELAS, MOBILIARIO, TEXTOS
  l.units.forEach(u=>{ d.poly(u.livre?"LIVRE":"UNIDADES",u.poly,u.livre?8:3); if(u.poly.length){ const c=G.centroid(u.poly); d.text("TEXTOS",c,0.9,u.livre?"livre":u.nome); if(!u.livre) d.text("TEXTOS",[c[0],c[1]-1.3],0.6,`${nf(u.alvo,1)} m2 priv / ${nf(u.area,1)} m2 bruto`) } });
  return d.out() }

/* ---------- IFC4 ---------- */
function ifcGuid(){ const c="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$"; let s=c[Math.floor(Math.random()*4)]; for(let i=1;i<22;i++) s+=c[Math.floor(Math.random()*64)]; return s }
function IFC(m){
  const L=[]; let id=0; const P=S.produto;
  const add=s=>{ id++; L.push(`#${id}=${s};`); return `#${id}` };
  const f=v=>{ let s=(+(+v).toFixed(4)).toString(); if(!/[.eE]/.test(s)) s+="."; return s };
  const str=s=>`'${ascii(s).replace(/'/g,"''")}'`;
  const origin=add("IFCCARTESIANPOINT((0.,0.,0.))"), zdir=add("IFCDIRECTION((0.,0.,1.))"), xdir=add("IFCDIRECTION((1.,0.,0.))");
  const wcs=add(`IFCAXIS2PLACEMENT3D(${origin},${zdir},${xdir})`);
  const ctx=add(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${wcs},$)`);
  const body=add(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,${ctx},$,.MODEL_VIEW.,$)`);
  const u1=add("IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)"), u2=add("IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)"), u3=add("IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)");
  const units=add(`IFCUNITASSIGNMENT((${u1},${u2},${u3}))`);
  const proj=add(`IFCPROJECT('${ifcGuid()}',$,${str(S.nome)},'Estudo de massa - Gabarito',$,$,$,(${ctx}),${units})`);
  const lp=(rel,z)=>{ const pt=add(`IFCCARTESIANPOINT((0.,0.,${f(z)}))`), ax=add(`IFCAXIS2PLACEMENT3D(${pt},$,$)`); return add(`IFCLOCALPLACEMENT(${rel},${ax})`) };
  const siteLP=lp("$",0), site=add(`IFCSITE('${ifcGuid()}',$,'Terreno',$,$,${siteLP},$,$,.ELEMENT.,$,$,$,$,$)`);
  const bldLP=lp(siteLP,0), bld=add(`IFCBUILDING('${ifcGuid()}',$,'Edificio',$,$,${bldLP},$,$,.ELEMENT.,$,$,$)`);
  add(`IFCRELAGGREGATES('${ifcGuid()}',$,$,$,${proj},(${site}))`); add(`IFCRELAGGREGATES('${ifcGuid()}',$,$,$,${site},(${bld}))`);
  const solid=(poly,h)=>{ const pts=poly.map(q=>add(`IFCCARTESIANPOINT((${f(q[0])},${f(q[1])}))`)); const pl=add(`IFCPOLYLINE((${[...pts,pts[0]].join(",")}))`);
    const prof=add(`IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,${pl})`); const ax=add(`IFCAXIS2PLACEMENT3D(${origin},$,$)`);
    const ex=add(`IFCEXTRUDEDAREASOLID(${prof},${ax},${zdir},${f(h)})`); const rep=add(`IFCSHAPEREPRESENTATION(${body},'Body','SweptSolid',(${ex}))`); return add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${rep}))`) };
  const storeys=[];
  const storey=(nome,z)=>{ const p=lp(bldLP,z), s=add(`IFCBUILDINGSTOREY('${ifcGuid()}',$,${str(nome)},$,$,${p},$,$,.ELEMENT.,${f(z)})`); const o={s,p,els:[],sp:[]}; storeys.push(o); return o };
  const proxy=(st,nome,tipo,poly,h)=>{ if(!poly||poly.length<3) return; const p=lp(st.p,0); st.els.push(add(`IFCBUILDINGELEMENTPROXY('${ifcGuid()}',$,${str(nome)},$,${str(tipo)},${p},${solid(poly,h)},$,.NOTDEFINED.)`)) };
  const space=(st,nome,longo,poly,h)=>{ if(!poly||poly.length<3) return; const p=lp(st.p,0); st.sp.push(add(`IFCSPACE('${ifcGuid()}',$,${str(nome)},$,$,${p},${solid(poly,h)},${str(longo)},.ELEMENT.,.SPACE.,$)`)) };
  for(let k=P.subsolos;k>=1;k--){ const st=storey(`Subsolo ${k}`,-k*P.peGar); proxy(st,`Subsolo ${k}`,"Garagem",m.sub,P.peGar) }
  { const st=storey("Terreo",0); (m.ter.lojas||[]).forEach((p,i)=>proxy(st,"Loja "+(i+1),"Comercial",p,P.peTerreo)); (m.ter.hall||[]).forEach((p,i)=>proxy(st,"Hall e lazer "+(i+1),"Areas comuns",p,P.peTerreo)); proxy(st,"Garagem terreo","Garagem",m.tGar,P.peTerreo) }
  for(let k=1;k<=P.garAcima;k++){ const st=storey(`Garagem ${k}`,P.peTerreo+(k-1)*P.peGar); proxy(st,`Garagem ${k}`,"Garagem",m.emb,P.peGar) }
  const maxPav=Math.max(...m.T.map(t=>t.pav+(t.duplexA>1?1:0)));
  for(let j=0;j<maxPav;j++){
    const z=m.hEmb+j*P.pe, st=storey(`Pavimento ${j+1}`,z);
    m.T.forEach((t,i)=>{
      if(j<t.pav){ const cob=t.hasCob && j===t.pav-1; proxy(st,`Torre ${i+1} - Pav ${j+1}`,cob?"Cobertura":"Pavimento tipo",t.plate,P.pe);
        const l=m.tipo[i]; if(l && !cob) l.units.filter(u=>!u.livre).forEach((u,q)=>{ const cod=`T${i+1}-${String(j+1).padStart(2,"0")}${String(q+1).padStart(2,"0")}`; space(st,cod,`${u.nome} - ${nf(u.alvo,1)} m2 priv`,u.poly,2.6);
          // cômodos: IfcSpace por cômodo (dentro do espaço da unidade) e IfcWall por parede
          if(u.com && S.comodos && S.comodos.on){ const un=st.sp[st.sp.length-1], rs=[];
            u.com.rooms.forEach((r,k)=>{ if(r.poly.length<3) return; const p=lp(st.p,0); rs.push(add(`IFCSPACE('${ifcGuid()}',$,${str(cod+"-"+String(k+1).padStart(2,"0"))},$,$,${p},${solid(r.poly,2.6)},${str(`${r.longo} - ${nf(r.area,2)} m2`)},.PARTIAL.,.SPACE.,$)`)) });
            if(rs.length) add(`IFCRELAGGREGATES('${ifcGuid()}',$,$,$,${un},(${rs.join(",")}))`);
            comParedes(u).forEach((w,k)=>{ const p=lp(st.p,0); st.els.push(add(`IFCWALL('${ifcGuid()}',$,${str(`${cod} parede ${k+1}`)},$,${str(w.tipo==="interna"?"Parede interna":w.tipo==="guarda"?"Guarda-corpo":w.tipo==="fachada"?"Parede de fachada":"Parede de divisa")},${p},${solid(w.poly, w.tipo==="guarda"? 1.1 : 2.8)},$,${w.tipo==="interna"?".PARTITIONING.":".STANDARD."})`)) }) } }) }
      else if(j===t.pav && t.duplexA>1) proxy(st,`Torre ${i+1} - Duplex`,"Cobertura duplex",G.scaleToArea(t.plate,t.duplexA),P.pe);
    });
  }
  add(`IFCRELAGGREGATES('${ifcGuid()}',$,$,$,${bld},(${storeys.map(s=>s.s).join(",")}))`);
  storeys.forEach(s=>{ if(s.els.length) add(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${ifcGuid()}',$,$,$,(${s.els.join(",")}),${s.s})`); if(s.sp.length) add(`IFCRELAGGREGATES('${ifcGuid()}',$,$,$,${s.s},(${s.sp.join(",")}))`) });
  const now=new Date().toISOString().slice(0,19);
  return `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [ReferenceView]'),'2;1');\nFILE_NAME(${str(slug(S.nome)+".ifc")},'${now}',('Gabarito'),(''),'Gabarito','Gabarito','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n${L.join("\n")}\nENDSEC;\nEND-ISO-10303-21;\n`;
}
async function exportZIP(){
  toast("Gerando DXF e IFC…");
  try{ await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js") }catch(e){ toast("Não consegui carregar o compactador"); return }
  const m=window._last.m, z=new JSZip();
  z.file("implantacao.dxf", dxfImpl(m));
  if(m.gar) Object.entries(m.gar).forEach(([k,lay])=>{ if(lay) z.file(`garagem-${nomePav(k).replace(/\s+/g,"-")}.dxf`, dxfGar(m,lay,k[0]==="s"?m.sub:k[0]==="g"?m.emb:m.tGar)) });
  m.T.forEach((t,i)=>{ if(t.plate.length) z.file(`pavimento-tipo-torre-${i+1}.dxf`, dxfTipo(m,i)) });
  z.file(slug(S.nome)+".ifc", IFC(m));
  z.file("leia-me.txt", ascii(`Gabarito - ${S.nome}\nUnidades em metros. DXF R12 (AC1009) em camadas. IFC4 com pavimentos (IfcBuildingStorey), volumes (IfcBuildingElementProxy), unidades e comodos (IfcSpace) e paredes das unidades (IfcWall).\nEstudo de massa preliminar: nao substitui projeto legal.\n`));
  const blob=await z.generateAsync({type:"blob",compression:"DEFLATE"});
  await saveFile(slug(S.nome)+"-dxf-ifc.zip", blob);
}
