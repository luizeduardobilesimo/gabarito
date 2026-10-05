/* ================= conteúdo de cada etapa ================= */
let TMETH = "desenhar", RECLADO = false;
const MESES=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const hhmm=v=>{ const h=Math.floor(v), m=Math.round((v-h)*60); return `${h}h${String(m).padStart(2,"0")}` };
const bar=(v,st)=>`<div class="bar ${st||""}"><i style="width:${Math.max(2,Math.min(100,v*100)).toFixed(1)}%"></i></div>`;
const useRow=(l,v,txt,st)=>`<div class="ur"><span>${l}</span>${bar(v,st)}<span>${txt}</span></div>`;

const STEP_R = {};
const STEP_LIVE = {};

/* ---------------- 1. Terreno ---------------- */
STEP_R.terreno = ()=>{
  const forms = {
    desenhar: `<p class="note">Na implantação, clique nos cantos do lote e feche no primeiro ponto. Depois arraste os vértices; o ponto no meio de cada lado cria um novo vértice.</p>
      <div class="row"><button class="btn pri" data-act="newDraw">Desenhar do zero</button><button class="btn" data-act="rmVert">Remover último vértice</button></div>`,
    ret: `<div class="kv three"><div class="fld"><label class="fl" for="rf">Frente</label><div class="inp"><input id="rf" type="number" value="20"><em>m</em></div></div><div class="fld"><label class="fl" for="rp">Fundo</label><div class="inp"><input id="rp" type="number" value="40"><em>m</em></div></div><div class="fld"><span class="fl">&nbsp;</span><button class="btn pri" data-act="rect">Criar</button></div></div>`,
    coord: `<p class="note">Cole um KML do Google Earth ou pontos “latitude, longitude”, um por linha. Latitude e norte são ajustados sozinhos.</p><textarea id="coords" placeholder="-28.6775, -49.3697&#10;-28.6777, -49.3694&#10;…"></textarea><div class="row"><button class="btn pri" data-act="coords">Importar pontos</button></div>`,
    img: `<p class="note">Print do Google Maps com a régua de escala visível. Depois de enviar: <b>Calibrar</b> (dois pontos e a distância real) e desenhe o lote por cima.</p><input type="file" id="bgFile" accept="image/*" class="txt">${BG?`<div class="sl"><div class="slh"><label for="bgOp">Opacidade da imagem</label></div><input id="bgOp" type="range" min="0.1" max="1" step="0.05" value="${BG.op}"></div>`:""}`
  };
  const lim=[["emb","Embasamento"],["tor","Torres"],["sub","Subsolo"]];
  return { body:
    CARD("Contorno do lote", `<div class="seg full">${[["desenhar","Desenhar"],["ret","Retângulo"],["coord","Coordenadas"],["img","Imagem"]].map(([k,l])=>`<button type="button" data-act="tmeth" data-v="${k}" aria-pressed="${TMETH===k}">${l}</button>`).join("")}</div>${forms[TMETH]}`) +
    CARD("Lados", `<div class="list" id="edges"></div><label class="sw"><input type="checkbox" data-act="reclado" ${RECLADO?"checked":""}><span class="tg"></span><span>Recuos diferentes por lado</span></label>`, {aside:`<span id="loteArea"></span>`}) +
    CARD("Frente e acessos", `<p class="note">A frente principal (amarela) recebe lojas, hall e acessos. Posição medida ao longo dela.</p>${SLD("lote.acessoPed","Acesso de pedestres",0.05,0.95,0.01,"%",{pct:true})}${SLD("lote.acessoVei","Acesso de veículos",0.05,0.95,0.01,"%",{pct:true,sub:""})}`) +
    CARD("Localização e topografia", KV(NUM("lote.norte","Norte","°",{step:1,help:"Rotação do norte em relação ao topo da planta"})+NUM("lote.lat","Latitude","°",{step:0.01,sub:"Criciúma −28,68"})+NUM("lote.desnivel","Desnível frente→fundos","m",{step:0.1})+NUM("lote.custoTerra","Movimento de terra","R$/m³",{step:1}))+`<div class="fsub" id="sub-terra"></div>`, {details:false, key:"topo"}) +
    CARD("Limites especiais", `<p class="note">APP, servidão ou recuo escalonado: desenhe o limite edificável. Ele substitui o recuo calculado.</p><div class="list">${lim.map(([k,l])=>{ const has=S.custom[k]&&S.custom[k].length; return `<div class="li"><span class="dot ${has?"ok":""}"></span><span class="tt">${l}</span><span class="row" style="gap:4px"><button class="btn sm" data-act="lim" data-k="${k}">${has?"Redesenhar":"Desenhar"}</button>${has?`<button class="btn sm ghost" data-act="limx" data-k="${k}">Limpar</button>`:""}</span></div>` }).join("")}</div>`, {details:false, key:"lim"})
  };
};
STEP_LIVE.terreno = (m)=>{
  ensureRec(); const rp=i=>S.lote.rec[i]||{};
  setHTML("edges", S.lote.pts.map((_,i)=>{ const fr=S.lote.front.includes(i), pr=S.lote.principal===i;
    return `<div class="edge ${pr?"front":""}"><b>L${i+1}</b><div class="inp"><input type="number" step="0.01" data-len="${i}" value="${G.edgeLen(S.lote.pts,i).toFixed(2)}" aria-label="Comprimento do lado ${i+1}"><em>m</em></div>
      <span class="ops"><button type="button" class="tag alt" data-act="front" data-i="${i}" aria-pressed="${fr}">rua</button>${fr?`<button type="button" class="tag" data-act="princ" data-i="${i}" aria-pressed="${pr}">principal</button>`:""}</span>
      ${RECLADO?`<span class="recs"><div class="inp"><input type="number" step="0.25" data-rec="${i}" data-rk="e" value="${rp(i).e??""}" placeholder="${nf(fr?S.regras.recFrente:S.regras.recEmb,2)}" aria-label="Recuo do embasamento"><em>emb.</em></div><div class="inp"><input type="number" step="0.25" data-rec="${i}" data-rk="t" value="${rp(i).t??""}" placeholder="${nf(fr?S.regras.recFrente:m.afast,2)}" aria-label="Recuo da torre"><em>torre</em></div></span>`:""}</div>` }).join(""));
  const la=document.getElementById("loteArea"); if(la) la.textContent=`${m2(m.A)} · perímetro ${nf(G.perimeter(S.lote.pts),1)} m`;
  { const T=m.ter||{}; setSub("lote.acessoVei", T.drive0? `${T.drive0.dv? nf(T.drive0.dv[1]-T.drive0.dv[0],1)+" m de largura (rampas"+(T.lanes?" + faixa da garagem":"")+")" : ""}${T.veiShift? " · ajustado "+nf(Math.abs(T.veiShift),1)+" m para não passar pelos núcleos":""}` : "") }
  setSub("terra", `Movimento de terra ≈ ${nf(m.terra,0)} m³ (inclui escavação dos subsolos)`);
};
Object.assign(ACT,{
  tmeth: b=>{ TMETH=b.dataset.v; renderTab(); if(TMETH!=="desenhar" && VIEW!=="impl") setView("impl") },
  reclado: b=>{ RECLADO=b.checked; renderTab() },
  newDraw: ()=>{ setView("impl"); DRAW=[]; setTool("draw","lote"); redraw2d() },
  rmVert: ()=>{ if(S.lote.pts.length>3){ const n=S.lote.pts.length; S.lote.pts.pop(); S.lote.front=S.lote.front.filter(i=>i<n-1); S.lote.rec.length=n-1; if(!S.lote.front.length) S.lote.front=[0]; update() } },
  rect: ()=>{ const f=+document.getElementById("rf").value||20, p=+document.getElementById("rp").value||40; S.lote.pts=[[0,0],[f,0],[f,p],[0,p]]; S.lote.front=[0]; S.lote.principal=0; S.lote.rec=[{},{},{},{}]; update(); fit2d(); fit3d(); toast(`Lote ${nf(f,1)} × ${nf(p,1)} m criado`) },
  coords: ()=>importCoords(document.getElementById("coords").value),
  front: b=>{ const i=+b.dataset.i; const on=!S.lote.front.includes(i); S.lote.front = on? [...new Set([...S.lote.front,i])] : S.lote.front.filter(x=>x!==i); if(!S.lote.front.length){ S.lote.front=[i]; toast("O lote precisa de pelo menos uma frente") } update() },
  princ: b=>{ S.lote.principal=+b.dataset.i; update() },
  lim: b=>{ setView("impl"); DRAW=[]; setTool("draw","lim:"+b.dataset.k); toast("Clique nos cantos do limite e feche no primeiro ponto") },
  limx: b=>{ S.custom[b.dataset.k]=[]; renderTab() },
});
TB.addEventListener("change",e=>{
  const t=e.target, d=t.dataset||{};
  if(d.len!=null){ const i=+d.len, p=S.lote.pts, a=p[i], b=p[(i+1)%p.length], L=G.edgeLen(p,i), nl=+t.value, j=(i+1)%p.length; if(j===0){ toast("O último lado fecha o polígono: ajuste os outros"); update(); return } if(L>0&&nl>0){ const dx=(b[0]-a[0])/L, dy=(b[1]-a[1])/L, ox=a[0]+dx*nl-b[0], oy=a[1]+dy*nl-b[1]; for(let q=j;q<p.length;q++) p[q]=[p[q][0]+ox,p[q][1]+oy]; update() } }
  else if(d.rec!=null){ ensureRec(); S.lote.rec[+d.rec][d.rk] = t.value===""? null : Math.max(0,+t.value); update() }
  else if(t.id==="bgFile"){ const f=t.files[0]; if(!f) return; const url=URL.createObjectURL(f), img=new Image(); img.onload=()=>{ const c=G.centroid(S.lote.pts), mpp=120/img.width; BG={img,mpp,op:0.8,x:c[0]-img.width*mpp/2,y:c[1]+img.height*mpp/2}; setView("impl"); fitBG(); setTool("calib"); renderTab() }; img.src=url }
  else if(t.id==="cidSel"){ if(t.value==="") return; const c=(LS.get("gabarito.cidades")||[])[+t.value]; if(c){ S.regras=merge(clone(DEF.regras), c.regras); renderTab(); toast("Regras carregadas: "+c.nome) } }
  else if(t.id==="aiPdf") aiReadPdf(e);
  else if(t.id==="jsonIn"){ const f=t.files[0]; if(!f) return; f.text().then(x=>{ try{ const o=JSON.parse(x); S=merge(clone(DEF), o.S||o); document.getElementById("projName").value=S.nome; renderTab(); fit3d(); fit2d(); toast("Projeto aberto") }catch(err){ toast("Arquivo inválido") } }) }
  else if(d.cmp!=null){ const l=LS.get("gabarito.cenarios2")||[]; l[+d.cmp].cmp=t.checked; LS.set("gabarito.cenarios2",l); renderTab() }
});
TB.addEventListener("input",e=>{ if(e.target.id==="bgOp" && BG){ BG.op=+e.target.value; redraw2d() } });

/* ---------------- 2. Regras e padrões ---------------- */
STEP_R.regras = ()=>{
  const cid=LS.get("gabarito.cidades")||[];
  return { body:
    `<div class="inp" style="background:var(--surface)"><svg viewBox="0 0 24 24" width="16" height="16" style="margin-left:10px;flex:none;fill:none;stroke:var(--muted);stroke-width:1.8"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/></svg><input class="t" id="qFind" placeholder="Buscar parâmetro — recuo, CA, vaga, pé-direito…" aria-label="Buscar parâmetro" autocomplete="off"></div>` +
    CARD("Cidade e zona", TXT("regras.cidade","Cidade / zona")+`<div class="row" style="flex-wrap:nowrap"><select class="sel" id="cidSel" aria-label="Regras salvas"><option value="">Carregar regras salvas…</option>${cid.map((c,i)=>`<option value="${i}">${esc(c.nome)}</option>`).join("")}</select><button class="btn" data-act="cidSave">Salvar</button></div>`) +
    CARD("Ler o plano diretor com IA", `<p class="note">Envie o PDF da lei de uso do solo (ou cole o trecho) e diga a zona. O Claude propõe os parâmetros para você revisar antes de aplicar.</p>
      <input class="txt" id="aiZona" placeholder="Ex.: Criciúma, ZR-4"><div class="row"><input type="file" id="aiPdf" accept="application/pdf" class="txt" style="flex:1"><span class="note" id="aiPdfInfo"></span></div>
      <textarea id="aiTxt" placeholder="…ou cole aqui a tabela de parâmetros da zona"></textarea><div class="row"><button class="btn pri" data-act="aiGo" id="aiGo">Ler regras</button><span class="note" id="aiStatus"></span></div><div id="aiResult"></div>`, {details:false, key:"ai", aside:"PDF ou texto"}) +
    CARD("Conformidade do estudo", `<div class="use" id="compl"></div>`, {aside:`<span id="complTxt"></span>`}) +
    CARD("Potencial construtivo", KV(
      NUM("regras.caBas","CA básico","×",{step:0.05,q:"coeficiente aproveitamento"})+NUM("regras.caMax","CA máximo","×",{step:0.05,q:"coeficiente outorga"})+
      NUM("regras.outorgaRS","Outorga onerosa","R$/m²",{step:10,wide:true})+
      NUM("regras.toEmb","TO embasamento","%",{pct:true,step:1,q:"taxa ocupação"})+NUM("regras.toTorre","TO torres","%",{pct:true,step:1,q:"taxa ocupação"})+
      NUM("regras.permeab","Permeabilidade","%",{pct:true,step:1})+NUM("regras.hMax","Altura máxima","m",{step:0.5,q:"gabarito"})), {filter:true}) +
    CARD("Recuos e afastamentos", KV(
      NUM("regras.recFrente","Recuo frontal","m",{step:0.25})+NUM("regras.recEmb","Lateral/fundos emb.","m",{step:0.25,q:"recuo embasamento"})+
      NUM("regras.afMin","Afastamento mín. torre","m",{step:0.25})+NUM("regras.afDiv","Torre às divisas: H ÷","",{step:0.5,q:"afastamento altura"})+
      NUM("regras.afTorresDiv","Entre torres: H ÷","",{step:0.5,q:"afastamento"})+NUM("regras.recSub","Recuo do subsolo","m",{step:0.25})), {filter:true}) +
    CARD("Vagas, unidades e não computáveis", KV(
      NUM("regras.vagasApto","Vagas por unidade","vg",{step:0.25,q:"garagem"})+NUM("regras.m2LojaVaga","Loja: 1 vaga a cada","m²",{step:5})+
      NUM("regras.m2Vaga","Área bruta por vaga","m²",{step:0.5,q:"estimativa"})+NUM("regras.aptoMin","Unidade mínima","m²",{step:1,q:"apartamento área"})+
      NUM("regras.ncTipo","Não computável no tipo","%",{pct:true,step:1,q:"sacada circulação",wide:true}))+
      `<div data-q="garagem não computável hall">${SW("regras.ncGaragem","Garagem não computável")}</div><div data-q="hall lazer não computável">${SW("regras.ncTerreo","Hall, lazer e áreas comuns não computáveis")}</div>`, {filter:true}) +
    CARD("Padrões do projeto", GRP("Pés-direitos · piso a piso")+KV(NUM("produto.peTerreo","Térreo","m",{step:0.1,q:"pé-direito"})+NUM("produto.peGar","Garagem","m",{step:0.05,q:"pé-direito"})+NUM("produto.pe","Tipo","m",{step:0.05,q:"pé-direito"}),3)+
      GRP("Pavimento tipo")+KV(NUM("produto.efic","Eficiência","%",{pct:true,step:1,q:"privativa"})+NUM("estudo.corrTipo","Corredor / hall","m",{step:0.05})+NUM("estudo.profMin","Prof. mín. unidade","m",{step:0.25,q:"profundidade"})+NUM("produto.sacProf","Prof. da sacada","m",{step:0.1}),2)+
      GRP("Vaga e circulação")+KV(NUM("estudo.vagaL","Largura vaga","m",{step:0.05})+NUM("estudo.vagaC","Compr. vaga","m",{step:0.05,q:"comprimento"})+NUM("estudo.corredor","Corredor 90°","m",{step:0.1,q:"manobra"})+NUM("estudo.porModulo","Vagas entre pilares","vg",{step:1,int:true})+NUM("estudo.pilar","Pilar","m",{step:0.05})+NUM("estudo.rampaL","Largura rampa","m",{step:0.05}),3)+
      GRP("Rampa e acessibilidade")+KV(NUM("estudo.rampaInc","Inclinação rampa","%",{pct:true,step:1})+NUM("estudo.pcd","Vagas PCD","%",{pct:true,step:1})+NUM("estudo.idoso","Vagas idosos","%",{pct:true,step:1}),3), {filter:true, aside:"valem para todos os estudos"}) +
    `<p class="note">Valores de exemplo — confira no plano diretor / LUOS da cidade e salve para reaproveitar.</p>`
  };
};
STEP_LIVE.regras = (m)=>{
  const R=S.regras, s=status(m,S), tor=m.T.reduce((a,t)=>a+t.A,0);
  const rows=[
    ["CA", m.CA/Math.max(1e-9,R.caMax), `${nf(m.CA,2)} / ${nf(R.caMax,2)}`, s.ca],
    ["Ocupação emb.", m.TO/Math.max(1e-9,R.toEmb), `${pct(m.TO,0)} / ${pct(R.toEmb,0)}`, m.TO>R.toEmb+1e-6?"bad":"ok"],
    ["Ocupação torres", tor/Math.max(1,R.toTorre*m.A), `${pct(tor/Math.max(1,m.A),0)} / ${pct(R.toTorre,0)}`, tor>R.toTorre*m.A+1?"bad":"ok"],
    ["Altura", m.H/Math.max(1e-9,R.hMax), `${nf(m.H,1)} / ${nf(R.hMax,0)} m`, s.h],
    ["Permeável", Math.min(1,m.perm/Math.max(1e-9,R.permeab||1e-9)), `${pct(m.perm,0)} / ${pct(R.permeab,0)}`, s.perm],
    ["Vagas", m.vagas/Math.max(1,m.vagasReq), `${m.vagas} / ${m.vagasReq}`, s.vg],
    ["Menor unidade", Math.min(1,m.minApto/Math.max(1,R.aptoMin)), `${nf(m.minApto,0)} / ${nf(R.aptoMin,0)} m²`, s.apto]];
  setHTML("compl", rows.map(r=>useRow(r[0],r[1],r[2],r[3]==="ok"?"ok":r[3])).join(""));
  const bad=Object.values(s).filter(x=>x==="bad").length; const ct=document.getElementById("complTxt"); if(ct) ct.innerHTML = bad? `<span style="color:var(--bad)">${bad} item(ns) fora</span>` : `<span style="color:var(--ok)">tudo dentro</span>`;
  setSub("regras.caMax",`máx. ${m2(R.caMax*m.A)} · usado ${m2(m.comp)}`);
  setSub("regras.caBas",`sem outorga ${m2(R.caBas*m.A)}`);
  setSub("regras.outorgaRS", m.outA>0? `excedente ${m2(m.outA)} → ${brl(m.outA*R.outorgaRS)}` : "sem outorga neste estudo");
  setSub("regras.toEmb",`${m2(m.embA)}`); setSub("regras.toTorre",`${m2(tor)} de ${m2(R.toTorre*m.A)}`);
  setSub("regras.afDiv",`H ${nf(m.H,1)} m → ${nf(m.afast,2)} m`); setSub("regras.afTorresDiv", m.T.length>1? `entre torres ${nf(m.gap,1)} m` : "só com 2+ torres");
  setSub("regras.hMax",`estudo ${nf(m.H,1)} m`); setSub("regras.m2Vaga",`estim. ${m.vagasEst} · layout ${m.vagasLay??"—"}`);
};
Object.assign(ACT,{
  cidSave: ()=>{ const l=LS.get("gabarito.cidades")||[]; const nome=S.regras.cidade||"Sem nome"; const i=l.findIndex(c=>c.nome===nome); const r=clone(S.regras); if(i>=0) l[i]={nome,regras:r}; else l.push({nome,regras:r}); LS.set("gabarito.cidades",l); toast("Regras salvas: "+nome); renderTab() },
  aiGo: ()=>aiRun(),
});

/* ---------------- 3. Produto ---------------- */
let OTRUN=false;
STEP_R.produto = ()=>{
  const P=S.produto, O=S.otim;
  return { body:
    `<section class="card hero"><div class="ch"><h2>Potencial do terreno</h2><span class="aside" id="potLim"></span></div><div class="cb" id="pot"></div></section>` +
    CARD("Gerar a melhor viabilidade", `<p class="note">Testa número de torres, tipologias, unidades por andar, subsolos e garagens — sempre dentro das regras — e ordena pelo objetivo.</p>
      ${ROW("Maximizar", SEG("otim.obj",[["lucro","Lucro"],["margem","Margem"],["tir","TIR"],["vpl","VPL"]],{fx:"save",rr:false}))}
      <div class="chips">${[["torres","Nº de torres"],["tipologias","Tipologias"],["unidades","Unidades/andar"]].map(([k,l])=>`<button type="button" class="chip" data-act="otk" data-k="${k}" aria-pressed="${!!O[k]}">${l}</button>`).join("")}</div>
      <button class="btn pri full" data-act="otim" ${OTRUN?"disabled":""}>${OTRUN?"Analisando…":"Gerar opções"}</button><div class="prog" id="otProg" ${OTRUN?"":"hidden"}><i style="width:0"></i></div><div class="list" id="otRes">${OTIM? otimHTML() : ""}</div>`, {id:"otCard"}) +
    CARD("Torres", `<div class="list" id="torres"></div><div class="row"><button class="btn" data-act="addTorre" ${P.torres.length>=4?"disabled":""}>+ Torre</button><button class="btn" data-act="maxPav">Máximo de pavimentos</button></div>${P.torres.length>1? ROW("Disposição",SEG("produto.torreEixo",[["long","ao longo do lote"],["trans","transversais"]])) : ""}`) +
    CARD("Mix do andar tipo", `<p class="note">Unidades por andar tipo — iguais em todas as torres. O tamanho do andar sai do mix ÷ eficiência.</p><div class="list" id="mix"></div>
      <div class="row sb"><button class="btn sm" data-act="addMix" ${P.mix.length>=5?"disabled":""}>+ Tipologia</button><span class="note" id="mixSum"></span></div>
      ${ROW("Sacadas", SEG("produto.sacTipo",[["embutida","embutidas"],["balanco","em balanço"]],{rr:false}))}`) +
    CARD("Áreas comuns e lazer", `<p class="note">Diga o que o empreendimento terá e onde. O hall e o lazer do térreo empurram a garagem para os fundos; a laje do embasamento, o pavimento de lazer e o rooftop entram no 3D, nas plantas e nos custos.</p>
      ${KV(NUM("produto.lazer.hall","Hall social","m²",{step:5,min:0,ph:String(hallSocial(S,P.torres.length)),zero:true,sub:"vazio = automático"})+`<div class="fld"><span class="fl">Total do programa</span><div class="v" id="lzTot" style="font-family:var(--f-display);font-size:17px;font-weight:620;padding-top:4px"></div></div>`)}
      <div class="list" id="lzList"></div>
      <div class="grp">Adicionar</div><div class="chips" id="lzAddChips">${LZ_PRESETS.map((p,i)=>`<button type="button" class="chip" data-act="lzAdd" data-i="${i}" aria-pressed="false">${p.nome}</button>`).join("")}<button type="button" class="chip" data-act="lzAdd" data-i="-1" aria-pressed="false">Outro…</button></div>
      <div class="use" id="lzCap"></div>`, {aside:`<span id="lzPill"></span>`}) +
    CARD("Embasamento e garagem", KV(STP("produto.subsolos",0,6,"Subsolos",{sub:""})+STP("produto.garAcima",0,8,"Garagens elevadas",{sub:""}))+
      SLD("produto.lojaTerreo","Lojas na frente do térreo",0,0.8,0.05,"%",{pct:true,sub:""})+SW("produto.garTerOn","Garagem no térreo, atrás do hall e do lazer")+`<div class="fsub" id="sub-terreo"></div>`+
      SW("produto.vagasFrente","Vagas externas na frente (clientes das lojas)")+SW("produto.atico","Ático técnico (reservatório, máquinas)")) +
    CARD("Coberturas", SW("produto.cob.on","Unidades de cobertura no último andar",{rr:true})+(P.cob.on? KV(NUM("produto.cob.qtd","Por torre","un",{int:true,min:1,step:1})+NUM("produto.cob.area","Área priv.","m²",{step:1})+NUM("produto.cob.preco","Preço","R$/m²",{step:50,wide:true}))+`<p class="note">Maior que o andar vira duplex, com pavimento superior.</p>`:""), {aside:`<span id="cobPill"></span>`}) +
    CARD("Quadro de áreas", `<table class="tbl" id="quadro"></table>`, {details:false, key:"quadro"}) +
    `<button class="btn pri full" data-act="aprovar">Aprovar produto e seguir para o projeto →</button>`
  };
};
function otimHTML(){
  const O=OTIM; if(!O.res.length) return `<p class="note">Nenhuma combinação atende às regras e às vagas exigidas. Revise regras ou tipologias.</p>`;
  const cur=window._last.f, ob=OBJ[O.obj][0];
  return O.res.slice(0,4).map((r,k)=>`<div class="res ${k===0?"top1":""}"><div class="rh"><b>${k===0?"Melhor opção":"Opção "+(k+1)} · ${MIX_PRESETS[r.pk].nome}</b><button class="btn sm ${k===0?"pri":""}" data-act="otApply" data-i="${k}">Aplicar</button></div>
    <div class="note">${r.nT} torre${r.nT>1?"s":""} × ${r.pav} pav · ${r.N} un/andar · ${r.units} unidades · ${r.sub} subsolo${r.sub!==1?"s":""}${r.gac?` + ${r.gac} garagem elevada`:""} · ${r.vagas}/${r.req} vagas</div>
    <div class="rm"><span>Lucro<b>${mi(r.lucro)}</b></span><span>Margem<b>${pct(r.margem)}</b></span><span>TIR<b>${r.tir==null?"—":pct(r.tir)}</b></span><span>VGV<b>${mi(r.vgv)}</b></span></div></div>`).join("")
    + `<p class="note">${O.testadas} combinações dentro das regras em ${nf(O.ms/1000,1)} s; as melhores foram conferidas com o layout real da garagem. Ordenado por ${ob.toLowerCase()}. Hoje: lucro ${mi(cur.lucro)} · margem ${pct(cur.margem)}.</p>`;
}
STEP_LIVE.produto = (m,f)=>{
  const P=S.produto, R=S.regras, po=potencial(S,m);
  const lim=document.getElementById("potLim"); if(lim) lim.textContent = po.limita==="ca"? "limite: coeficiente" : "limite: altura";
  setHTML("pot", `<div class="mets"><div class="met big"><div class="l">Privativo possível</div><div class="v">${m2(po.priv)}</div><div class="s">≈ ${po.un} unidades do mix · VGV ≈ ${mi(po.vgv)}</div></div>
      <div class="met"><div class="l">Computável máx.</div><div class="v">${m2(po.compMax)}</div><div class="s">CA ${nf(R.caMax,1)} × ${m2(m.A)}</div></div>
      <div class="met"><div class="l">Pavimentos tipo</div><div class="v">até ${po.pavH}</div><div class="s">pela altura de ${nf(R.hMax,0)} m</div></div></div>
    <div class="use">${useRow("CA usado",po.uso.ca,pct(po.uso.ca,0),po.uso.ca>1?"bad":"")}${useRow("Altura usada",po.uso.h,pct(po.uso.h,0),po.uso.h>1?"bad":"")}${useRow("Ocupação",po.uso.to,pct(po.uso.to,0),po.uso.to>1?"bad":"")}${useRow("Do potencial",po.uso.priv,pct(po.uso.priv,0),"ok")}</div>`);
  setHTML("torres", m.T.map((t,i)=>`<div class="tw"><div class="twh"><b>Torre ${i+1}</b><span class="pill ${t.fit?"":"warn"}">${m2(t.A)}/andar · ${t.units} un · ${nf(t.H,1)} m</span></div>
    <div class="row" style="flex-wrap:nowrap">${STP("produto.torres."+i+".pav",1,80,"")}<button class="btn sm" data-act="maxT" data-i="${i}" title="Máximo para esta torre">Máx</button>${m.T.length>1?`<button class="btn sm ghost" data-act="rmT" data-i="${i}">Remover</button>`:""}</div>
    <div class="fsub">${t.fit? `cabe: andar ${m2(t.A)} de ${m2(t.maxA)} possíveis` : `<span style="color:var(--warn)">o mix pede ${m2(m.mixPriv/P.efic)}/andar e cabem ${m2(t.maxA)} — unidades reduzidas a ${pct(t.r,0)}</span>`}</div></div>`).join(""));
  setHTML("mix", P.mix.map((u,i)=>`<div class="mixc"><div class="r1"><span class="sw8" style="background:var(--u${i%5+1})"></span><div class="inp"><input class="t" data-p="produto.mix.${i}.nome" data-t="s" value="${esc(u.nome)}" aria-label="Tipologia"></div>
    <div class="stp"><button type="button" data-stp="-1" aria-label="Menos">−</button><input type="number" data-p="produto.mix.${i}.qtd" data-int="1" data-min="0" data-max="20" value="${u.qtd}" aria-label="Unidades por andar"><button type="button" data-stp="1" aria-label="Mais">+</button></div>
    ${P.mix.length>1?`<button type="button" class="x" data-act="rmMix" data-i="${i}" aria-label="Remover">×</button>`:"<span></span>"}</div>
    <div class="r2"><div class="inp"><input type="number" data-p="produto.mix.${i}.area" data-min="10" value="${u.area}" aria-label="Área privativa"><em>m²</em></div>
    <div class="inp"><input type="number" data-p="produto.mix.${i}.preco" data-min="0" step="50" value="${u.preco}" aria-label="Preço por m²"><em>R$/m²</em></div>
    <div class="inp"><input type="number" data-p="produto.mix.${i}.sac" data-min="0" step="0.5" value="${u.sac||0}" aria-label="Sacada"><em>sacada</em></div></div>
    <div class="fsub">${m.unitRows[i]?.n||0} unidades no total · ${mi((m.unitRows[i]?.area||0)*u.preco)}</div></div>`).join(""));
  const ms=document.getElementById("mixSum"); if(ms) ms.textContent=`${m.mixUn} un · ${m2(m.mixPriv)} priv. → ${m2(m.mixPriv/P.efic)} bruto/andar`;
  const cp=document.getElementById("cobPill"); if(cp) cp.textContent = P.cob.on? `${m.cobN} un${m.duplex?" · duplex":""}` : "desligado";
  setSub("produto.subsolos",`${m2(m.subA)} · ${m.gar&&m.gar.s1? m.gar.s1.count+" vg no 1º" : Math.floor(m.subA/R.m2Vaga)+" vg (est.)"}`);
  setSub("produto.garAcima",`${m2(m.embA)} · ${m.gar&&m.gar.g1? m.gar.g1.count+" vg no 1º" : Math.floor(m.embA/R.m2Vaga)+" vg (est.)"}`);
  setSub("terreo", `${P.garTerOn? `garagem ${m2(m.gTer)} · ${m.gar&&m.gar.ter? m.gar.ter.count : Math.floor(m.gTer/R.m2Vaga)} vagas · `:""}hall e lazer ${m2(m.hallA)} · acesso de veículos ${m2(m.driveA||0)}`);
  // lazer
  const LZ=m.lzLay||{miss:[]}, miss=new Set(LZ.miss), it=(P.lazer&&P.lazer.itens)||[], lz=m.lz;
  setHTML("lzList", it.map((x,i)=>`<div class="lzr${miss.has(x)?" miss":""}"><div class="inp"><input class="t" data-p="produto.lazer.itens.${i}.nome" data-t="s" value="${esc(x.nome)}" aria-label="Ambiente"></div>
      <div class="inp"><input type="number" data-p="produto.lazer.itens.${i}.area" data-min="1" step="5" value="${x.area}" aria-label="Área"><em>m²</em></div>
      <select class="sel" data-p="produto.lazer.itens.${i}.local" data-t="s" aria-label="Onde">${Object.entries(LZ_LOCAIS).map(([k,l])=>`<option value="${k}" ${x.local===k?"selected":""}>${l}</option>`).join("")}</select>
      <button type="button" class="tag" data-act="lzDesc" data-i="${i}" aria-pressed="${!!x.desc}" title="Área descoberta (piscina, deck, playground)">${x.desc?"descoberto":"coberto"}</button>
      <button type="button" class="x" data-act="lzRm" data-i="${i}" aria-label="Remover">×</button>${miss.has(x)?`<span class="lzm">não coube — reduza a área ou mude o local</span>`:""}</div>`).join("") || `<p class="note">Nenhum ambiente ainda — use os atalhos abaixo.</p>`);
  const lt=document.getElementById("lzTot"); if(lt) lt.textContent=m2(hallSocial(S,m.T.length)+lz.c+lz.d);
  const pill=document.getElementById("lzPill"); if(pill) pill.innerHTML = miss.size? `<span style="color:var(--bad)">${miss.size} não coube${miss.size>1?"ram":""}</span>` : `${lz.n} ambientes`;
  const T=m.ter||{}, roofFree=Math.max(1,m.embA-m.T.reduce((s,t)=>s+t.A,0)), plate=m.T[0]?m.T[0].A:1;
  const cap=[["Térreo (hall + lazer)", T.HT||0, P.garTerOn? (T.HT||0)+m.gTer : T.hallDisp||1], ["Laje do embasamento", lz.emb.c+lz.emb.d, roofFree], ["Pavimento de lazer", lz.pav.c+lz.pav.d, plate*0.8], ["Rooftop da torre 1", lz.cob.c+lz.cob.d, plate*0.85]].filter(r=>r[1]>0);
  setHTML("lzCap", cap.map(([l,a,c])=>useRow(l, a/Math.max(1,c), `${m2(a)}`, a>c?"bad":"ok")).join("") + `<p class="note">Lazer coberto fora do térreo soma ${m2(m.lzExtraA)} construídos${S.regras.ncTerreo?" (não computáveis)":""}. Acabamento e equipamentos ≈ ${mi(m.lzCusto)}.</p>`);
  const used=new Set(it.map(x=>x.nome)); document.querySelectorAll("#lzAddChips [data-act=lzAdd]").forEach(b=>{ const p=LZ_PRESETS[+b.dataset.i]; if(p) b.hidden=used.has(p.nome) });
  setSub("produto.lojaTerreo",`${m2(m.lojaA)} brutos · ${m2(m.lojaPriv)} privativos`);
  setHTML("quadro", `<tr><td>Subsolos (${P.subsolos}×)</td><td>${m2(m.gSub)}</td></tr><tr><td>Térreo</td><td>${m2(m.embA)}</td></tr><tr><td>Garagem elevada (${P.garAcima}×)</td><td>${m2(m.gAc)}</td></tr><tr><td>Pavimentos das torres</td><td>${m2(m.tiposA)}</td></tr>
    ${m.duplexA?`<tr><td>Duplex (superior)</td><td>${m2(m.duplexA)}</td></tr>`:""}${P.atico?`<tr><td>Ático técnico</td><td>${m2(m.aticoA)}</td></tr>`:""}
    <tr class="tot"><td>Área construída</td><td>${m2(m.constr)}</td></tr><tr><td>Área computável</td><td>${m2(m.comp)}</td></tr>
    ${m.unitRows.map(u=>`<tr><td>${esc(u.nome)} — ${u.n} × ${nf(u.n?u.area/u.n:0,1)} m²</td><td>${m2(u.area)}</td></tr>`).join("")}
    ${m.cobN?`<tr><td>Coberturas — ${m.cobN} × ${nf(m.cobArea/m.cobN,1)} m²</td><td>${m2(m.cobArea)}</td></tr>`:""}${m.lojaPriv?`<tr><td>Lojas (privativo)</td><td>${m2(m.lojaPriv)}</td></tr>`:""}
    <tr class="tot"><td>Privativa vendável</td><td>${m2(m.priv)}</td></tr><tr><td>Privativa ÷ construída</td><td>${pct(m.priv/Math.max(1,m.constr))}</td></tr>`);
};
Object.assign(ACT,{
  lzAdd: b=>{ const i=+b.dataset.i, p=LZ_PRESETS[i]||{nome:"Ambiente",area:30,local:"terreo"}; S.produto.lazer.itens.push({...p}); update(); },
  lzRm: b=>{ S.produto.lazer.itens.splice(+b.dataset.i,1); update() },
  lzDesc: b=>{ const x=S.produto.lazer.itens[+b.dataset.i]; x.desc=!x.desc; update() },
  otk: b=>{ const k=b.dataset.k; S.otim[k]=!S.otim[k]; b.setAttribute("aria-pressed",S.otim[k]); save() },
  otim: ()=>{ OTRUN=true; renderTab(); const pr=document.querySelector("#otProg i");
    otimizar(S.otim, p=>{ const e=document.querySelector("#otProg i"); if(e) e.style.width=(p*100).toFixed(0)+"%" }, ()=>{ OTRUN=false; if(TAB==="produto") renderTab(); toast(OTIM.res.length? "Opções prontas — a melhor está no topo" : "Nenhuma combinação viável") }) },
  otApply: b=>{ const r=OTIM.res[+b.dataset.i]; aplicarOtim(r); renderTab(); fit3d(); toast("Produto aplicado — confira a viabilidade") },
  addTorre: ()=>{ if(S.produto.torres.length<4){ S.produto.torres.push({pav:S.produto.torres.at(-1)?.pav||8}); renderTab() } },
  rmT: b=>{ S.produto.torres.splice(+b.dataset.i,1); renderTab() },
  maxPav: ()=>{ const t=maxPav(S); if(t>0){ S.produto.torres.forEach(x=>x.pav=t); update(); toast(`${t} pavimentos por torre (gabarito/CA)`) } else toast("Nenhum pavimento cabe com essas regras") },
  maxT: b=>{ const i=+b.dataset.i, keep=S.produto.torres[i].pav; let best=1; for(let n=1;n<=80;n++){ S.produto.torres[i].pav=n; const mm=massing(S); if(mm.H<=S.regras.hMax+1e-6 && mm.CA<=S.regras.caMax+1e-6) best=n; else break } S.produto.torres[i].pav=best||keep; update(); toast(`Torre ${i+1}: ${best} pavimentos`) },
  addMix: ()=>{ if(S.produto.mix.length<5){ S.produto.mix.push({nome:"Studio",area:35,qtd:1,preco:12000,sac:3}); update() } },
  rmMix: b=>{ S.produto.mix.splice(+b.dataset.i,1); update() },
  aprovar: ()=>{ saveScenario(null,true); goStep("projeto","gar"); toast("Produto aprovado e salvo em Cenários") },
});

/* ---------------- 4. Viabilidade ---------------- */
STEP_R.viab = ()=>{
  const F=S.fin;
  return { body:
    `<section class="card hero"><div class="ch"><h2>Resultado</h2><span class="aside" id="vStat"></span></div><div class="cb" id="finTop"></div></section>` +
    CARD("Fluxo de caixa acumulado", `<div id="cash"></div>`) +
    CARD("Sensibilidade da margem", `<div class="sens" id="sens"></div><p class="note">Linhas: preço de venda · colunas: custo de obra.</p>`, {details:false, key:"sens"}) +
    CARD("DRE do empreendimento", `<table class="tbl" id="dre"></table>`, {details:false, key:"dre"}) +
    `<div class="inp" style="background:var(--surface)"><svg viewBox="0 0 24 24" width="16" height="16" style="margin-left:10px;flex:none;fill:none;stroke:var(--muted);stroke-width:1.8"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/></svg><input class="t" id="qFind" placeholder="Buscar premissa — CUB, INCC, corretagem…" aria-label="Buscar premissa" autocomplete="off"></div>` +
    CARD("Terreno e obra", KV(NUM("fin.terreno","Terreno (à vista)","R$",{step:10000,wide:true})+NUM("fin.itbi","ITBI + escritura","%",{pct:true,step:0.5})+NUM("fin.cub","CUB referência","R$/m²",{step:1})+
      NUM("fin.fator","Custo ÷ CUB","×",{step:0.01})+NUM("fin.eqGar","Equivalência garagem","×",{step:0.05})+NUM("fin.incc","INCC a.a.","%",{pct:true,step:0.25})+NUM("fin.projetos","Projetos e taxas","% obra",{pct:true,step:0.5})+
      NUM("fin.adm","Administração","% obra",{pct:true,step:0.5})+NUM("fin.conting","Contingência","% obra",{pct:true,step:0.5})+NUM("fin.decorLazer","Lazer: equipamentos","R$/m²",{step:50,q:"mobiliário decoração lazer"})+NUM("fin.custoDesc","Lazer descoberto","R$/m²",{step:50,q:"piscina deck paisagismo"})), {filter:true}) +
    CARD("Receita e vendas", KV(NUM("fin.precoLoja","Preço das lojas","R$/m²",{step:50})+NUM("fin.reaj","Reajuste tabela a.a.","%",{pct:true,step:0.5})+NUM("fin.corret","Corretagem","%",{pct:true,step:0.5})+NUM("fin.mkt","Marketing","%",{pct:true,step:0.5})+
      NUM("fin.imp","Impostos (RET)","%",{pct:true,step:0.25})+NUM("fin.permuta","Permuta física","% un",{pct:true,step:1})+NUM("fin.permutaFin","Permuta financeira","% rec",{pct:true,step:0.5}))+
      `<div data-q="incc correção parcelas">${SW("fin.correcao","Parcelas até as chaves corrigidas pelo INCC")}</div><p class="note">Preços das unidades ficam no mix, na etapa Produto.</p>`, {filter:true}) +
    CARD("Cronograma", KV(NUM("fin.prelanc","Até o lançamento","meses",{step:1,int:true,q:"aprovação"})+NUM("fin.obra","Prazo de obra","meses",{step:1,int:true})+NUM("fin.venda","Vender 100% em","meses",{step:1,int:true})+
      NUM("fin.vendaLanc","Vendido no lançamento","%",{pct:true,step:5})+NUM("fin.entrada","Pago até as chaves","%",{pct:true,step:5,q:"entrada"})), {filter:true}) +
    CARD("Financiamento à produção", `<div data-q="financiamento plano empresário">${SW("fin.finOn","Usar plano empresário",{rr:true})}</div>`+(F.finOn? KV(NUM("fin.finPct","Financiado","% obra",{pct:true,step:5})+NUM("fin.finTaxa","Juros a.a.","%",{pct:true,step:0.25})+NUM("fin.finVendaMin","Vendas p/ liberar","%",{pct:true,step:5}),3) : ""), {filter:true}) +
    CARD("Metas", KV(NUM("fin.tma","TMA a.a.","%",{pct:true,step:0.5,q:"taxa atratividade"})+NUM("fin.margemAlvo","Margem alvo","%",{pct:true,step:1})), {filter:true})
  };
};
STEP_LIVE.viab = (m,f)=>{
  const F=S.fin, sCol=v=> v<0?"var(--bad)": v<F.margemAlvo?"var(--warn)":"var(--ok)";
  const parts=[["Terreno e outorga",f.terreno+f.outorga,"var(--m-sub)"],["Obra e indiretos",f.obraTot+f.projetos+f.terra,"var(--m-ter)"],["Vendas, impostos, juros",f.corret+f.mkt+f.imp+f.permFin+f.juros,"var(--mark)"],["Lucro",Math.max(0,f.lucro),"var(--ok)"]];
  const tot=parts.reduce((s,p)=>s+p[1],0)||1;
  const vs=document.getElementById("vStat"); if(vs) vs.innerHTML=`<span style="color:${sCol(f.margem)}">${f.margem<0?"prejuízo":f.margem<F.margemAlvo?"abaixo da meta":"acima da meta"}</span>`;
  setHTML("finTop", `<div class="mets"><div class="met big"><div class="l">Lucro</div><div class="v" style="color:${f.lucro<0?"var(--bad)":"var(--ink)"}">${mi(f.lucro)}</div><div class="s">VGV ${mi(f.vgv)} · custo ${mi(f.custo)}</div></div>
    <div class="met"><div class="l">Margem</div><div class="v" style="color:${sCol(f.margem)}">${pct(f.margem)}</div><div class="s">meta ${pct(F.margemAlvo,0)}</div></div>
    <div class="met"><div class="l">TIR a.a.</div><div class="v">${f.tirA==null?"—":pct(f.tirA)}</div><div class="s">TMA ${pct(F.tma,0)}</div></div>
    <div class="met"><div class="l">Exposição máx.</div><div class="v">${mi(-f.exp)}</div><div class="s">payback ${f.pay==null?"—":"mês "+f.pay}</div></div>
    <div class="met"><div class="l">Terreno máximo</div><div class="v">${mi(f.maxTerreno)}</div><div class="s">p/ margem alvo</div></div></div>
    <div class="stack">${parts.map(p=>`<span style="width:${p[1]/tot*100}%;background:${p[2]}"></span>`).join("")}</div>
    <div class="stackleg">${parts.map(p=>`<span><i style="background:${p[2]}"></i>${p[0]} ${pct(p[1]/tot,0)}</span>`).join("")}</div>`);
  if(!fast_skip(m)) setHTML("cash", cashSVG(f));
  const sens=sensGrid(S,m);
  setHTML("sens", `<div class="h"></div><div class="h">obra −10%</div><div class="h">base</div><div class="h">obra +10%</div>`+["preço −10%","preço base","preço +10%"].map((l,i)=>`<div class="h" style="text-align:right">${l}</div>`+sens[i].map(v=>`<div style="background:color-mix(in srgb, ${sCol(v)} 22%, transparent);${i===1?"font-weight:600":""}">${pct(v)}</div>`).join("")).join(""));
  const ln=(l,v)=> v? `<tr class="neg"><td>${l}</td><td>−${brl(v)}</td></tr>` : "";
  setHTML("dre", `<tr><td>VGV de tabela</td><td>${brl(f.vgvB)}</td></tr>${f.permV?`<tr class="neg"><td>(−) Permuta física</td><td>−${brl(f.permV)}</td></tr>`:""}<tr><td>Receita nominal</td><td>${brl(f.receita)}</td></tr>
    ${ln("Terreno + ITBI",f.terreno)}${ln("Outorga onerosa",f.outorga)}${ln(`Obra (${m2(f.eqA)} equiv.) com INCC`,f.obraTot)}${f.lazerC?`<tr><td style="padding-left:12px;color:var(--muted)">inclui lazer: equipamentos e áreas descobertas</td><td style="color:var(--muted)">${brl(f.lazerC)}</td></tr>`:""}${ln("Movimento de terra",f.terra)}${ln("Projetos e aprovações",f.projetos)}
    ${ln("Corretagem + marketing",f.corret+f.mkt)}${ln("Impostos (RET)",f.imp)}${ln("Permuta financeira",f.permFin)}${ln("Juros do financiamento",f.juros)}
    <tr class="tot ${f.lucro<0?"neg":"pos"}"><td>Lucro</td><td>${brl(f.lucro)}</td></tr><tr><td>Custo total / m² privativo</td><td>${brl(f.custo/Math.max(1,m.priv))}</td></tr><tr><td>Obra / m² construído</td><td>${brl(f.obraTot/Math.max(1,m.constr))}</td></tr><tr><td>Lucro ÷ custo</td><td>${pct(f.lucro/Math.max(1,f.custo))}</td></tr>`);
  setSub("fin.terreno",`${brl(F.terreno/Math.max(1,m.A))}/m² · ${pct(F.terreno/Math.max(1,f.vgvB))} do VGV`);
  setSub("fin.fator",`${brl(F.cub*F.fator)}/m² equiv.`); setSub("fin.incc",`efeito ${mi(f.obraTot-(f.obra+f.adm+f.conting))}`);
  setSub("fin.cub","CUB/SC médio set/26 ≈ 3.159");
  if(F.finOn) setSub("fin.finPct",`limite ${mi(f.lim)} · juros ${mi(f.juros)}`);
};
const fast_skip=()=>false;

/* ---------------- 5. Projeto ---------------- */
STEP_R.projeto = ()=>{
  const E=S.estudo, sub=`<div class="seg full">${[["gar","Garagem"],["tipo","Pavimento tipo"],["andar","Andares"]].map(([k,l])=>`<button type="button" data-act="psub" data-v="${k}" aria-pressed="${PSUB===k}">${l}</button>`).join("")}</div>`;
  let body="";
  if(PSUB==="gar") body =
    `<section class="card hero"><div class="ch"><h2>Vagas</h2><span class="aside" id="garStat"></span></div><div class="cb"><div id="garRes"></div>${SW("estudo.usarLayout","Usar as vagas do layout nas contas")}</div></section>` +
    CARD("Layout", ROW("Ângulo",SEG("estudo.angulo",[["90","90°"],["60","60°"],["45","45°"],["melhor","melhor"]],{rr:false}))+ROW("Fileiras",SEG("estudo.garDir",[["auto","automáticas"],["man","manual"]]))+(E.garDir==="auto"?"":SLD("estudo.garDirGraus","Rotação das fileiras",0,179,1,"°"))+
      `<p class="note">90°: corredor de mão dupla. 60° e 45°: mão única, corredores mais estreitos ligados em circuito.</p>`) +
    CARD("Acesso e rampas", `<p class="note">O carro entra pela rua no acesso de veículos (etapa Terreno), anda no plano pelo menos 5 m e só então começa a rampa. A rampa que desce e a que sobe ficam em faixas separadas.</p>`+
      ROW("Rampas",SEG("estudo.rampaTipo",[["reta","retas empilhadas"],["alternada","alternadas (tesoura)"]],{rr:true}))+
      `<p class="note">${E.rampaTipo==="alternada"? "Duas faixas lado a lado com sentidos opostos: o carro chega e já faz o retorno para a próxima rampa na mesma ponta." : "Todas na mesma projeção: em cada pavimento o carro chega pela ponta de dentro e volta até a frente para descer de novo."}</p>`+
      KV(NUM("estudo.rampaL","Largura","m",{step:0.05,sub:"≥ 2,75 m mão única · ≥ 5 m mão dupla"})+NUM("estudo.rampaInc","Inclinação","%",{pct:true,step:1,sub:"residencial ≤ 20%"}))+
      `<div class="fsub" id="rampInfo"></div>
      <div class="row sb"><span class="pill">${E.rampa?"posição desenhada":"automática, no acesso"}</span><span class="row" style="gap:4px">${E.rampa?`<button class="btn sm" data-act="rampAuto">Voltar ao automático</button>`:""}<button class="btn sm" data-act="view" data-v="gar">Mover na planta</button></span></div>
      <button class="btn pri full" data-act="acessoStudy">Encontrar o melhor acesso de veículos</button><span class="note" id="rsStat"></span><div class="list" id="rsList">${RS?rsHTML():""}</div>`) +
    CARD("Dimensões da vaga", KV(NUM("estudo.vagaL","Largura","m",{step:0.05})+NUM("estudo.vagaC","Comprimento","m",{step:0.05})+NUM("estudo.corredor","Corredor 90°","m",{step:0.1})+NUM("estudo.porModulo","Entre pilares","vg",{int:true,step:1})+NUM("estudo.pilar","Pilar","m",{step:0.05})+NUM("estudo.rampaL","Largura rampa","m",{step:0.05})+NUM("estudo.rampaInc","Inclinação rampa","%",{pct:true,step:1})+NUM("estudo.pcd","PCD","%",{pct:true,step:1})+NUM("estudo.idoso","Idosos","%",{pct:true,step:1}),3), {details:false, key:"vdim"}) +
    CARD("Ajuste manual", `<p class="note">Na planta, escolha o que o toque faz (barra superior): tirar ou devolver, tornar comum, PCD ou idoso. Para não ter PCD/idoso automáticos, zere os percentuais.</p><button class="btn" data-act="resetOff">Desfazer marcações manuais</button>`, {details:false, key:"man"});
  else if(PSUB==="tipo"){
    const bal=E.escTipo==="pf_balcao";
    const desc={ep:"Escada enclausurada com portas corta-fogo e hall de acesso. Edifícios baixos e médios.",pf_duto:"Antecâmara ventilada por dutos de entrada e saída de ar. A mais comum em residenciais altos.",pf_balcao:"Acesso pela fachada por um balcão aberto — exige núcleo encostado na fachada.",pf_press:"Escada pressurizada por ventilador; dispensa dutos na antecâmara, pede casa de máquinas."}[E.escTipo];
    body =
    CARD("Núcleo de circulação", `<div class="fld"><label class="fl" for="escSel">Escada</label><select class="sel" id="escSel" data-p="estudo.escTipo" data-t="s" data-rr="1">${Object.entries(ESC_TIPOS).map(([k,l])=>`<option value="${k}" ${E.escTipo===k?"selected":""}>${l}</option>`).join("")}</select><div class="fsub" style="font-family:var(--f-body)">${desc}</div></div>
      ${ROW("Escadas",SEG("estudo.nEsc",[[1,"1"],[2,"2"]],{rr:false}))}${ROW("Elevadores",SEG("estudo.elevadores",[[0,"auto"],[1,"1"],[2,"2"],[3,"3"],[4,"4"]],{rr:false}))}
      ${SW("estudo.emerg","Elevador de emergência")}${SW("estudo.fachada",bal?"Núcleo na fachada (obrigatório com balcão)":"Núcleo encostado na fachada (ventilação natural)",{dis:bal})}`) +
    CARD("Posição no andar", ROW("Planta",SEG("estudo.tipoPlanta",[["auto","auto"],["central","corredor central"],["lateral","lateral"]],{rr:false}))+ROW("Lado",SEG("estudo.nucleoLado",[["B","lado 1"],["A","lado 2"]],{rr:false}))+ROW("Ordem",SEG("estudo.escadaLado",[["E","escada · elev."],["D","elev. · escada"]],{rr:false}))+SLD("estudo.nucleoPos","Posição ao longo do andar",0,1,0.01,"%",{pct:true})) +
    CARD("Dimensões", KV(NUM("estudo.corrTipo","Corredor / hall","m",{step:0.05})+NUM("estudo.profMin","Prof. mín. unidade","m",{step:0.25})+NUM("produto.sacProf","Prof. sacada","m",{step:0.1}),3), {details:false, key:"tdim"}) +
    `<div id="tipoRes" class="list"></div><p class="note">Dimensões de estudo. Confirme saídas, tipo de escada e elevador de emergência com a NBR 9077 e a IN do Corpo de Bombeiros.</p>`;
  }
  else body = CARD("Andares do edifício", `<p class="note">Toque num andar para ver a planta. Na planta de garagem, toque nas vagas para editar.</p><div class="list" id="andList"></div>`) + `<button class="btn full" data-act="corte3d">Ver o andar selecionado cortado no 3D</button>`;
  return { sub, subKey:PSUB, body };
};
STEP_LIVE.projeto = (m)=>{
  const P=S.produto;
  if(PSUB==="gar" && m.gar){
    const flo=Object.keys(m.gar).sort((a,b)=>{ const o=k=>k==="ter"?0:k[0]==="s"? -(+k.slice(1)) : +k.slice(1); return o(a)-o(b) });
    const gs=document.getElementById("garStat"); if(gs) gs.innerHTML = `<span style="color:${m.vagas>=m.vagasReq?"var(--ok)":"var(--bad)"}">${m.vagas>=m.vagasReq?"atende":"faltam "+(m.vagasReq-m.vagas)}</span>`;
    setHTML("garRes", `<div class="mets"><div class="met"><div class="l">No layout</div><div class="v">${m.vagasLay??"—"}</div><div class="s">estimativa ${m.vagasEst}</div></div><div class="met"><div class="l">Exigidas</div><div class="v">${m.vagasReq}</div><div class="s">${nf(m.vagas/Math.max(1,m.units),2)} por unidade</div></div></div>
      <table class="tbl">${flo.map(k=>{ const l=m.gar[k]; if(!l) return ""; const st=l.ok===false? `<span style="color:var(--bad)">sem rota</span>` : `${l.count} vg · ${l.vagas.filter(v=>v.tipo==="pcd").length} PCD · ${l.vagas.filter(v=>v.tipo==="idoso").length} id.`; return `<tr class="${k===FLOOR&&VIEW==="gar"?"pos":""}" data-act="garFl" data-k="${k}" style="cursor:pointer"><td>${nomePav(k).replace(/^./,c=>c.toUpperCase())}</td><td>${st}</td></tr>` }).join("")}${m.vf&&m.vf.count?`<tr><td>Frente (lojas)</td><td>${m.vf.count} vg</td></tr>`:""}</table>${(m.avisos||[]).map(a=>`<p class="note" style="color:var(--warn)">${esc(a)}</p>`).join("")}`);
    const ri=document.getElementById("rampInfo"); if(ri && m.vert){ const s0=m.vert.strips[0]; ri.textContent = s0? `faixa de rampa: ${nf(s0.L,1)} m de comprimento · ${m.vert.strips.length} faixa${m.vert.strips.length>1?"s":""}${m.vert.ok?"":" · verifique os avisos"}` : "" }
  }
  if(PSUB==="tipo"){
    setHTML("tipoRes", m.T.map((t,i)=>{ const l=m.tipo&&m.tipo[i]; if(!l) return `<p class="note">Torre ${i+1}: sem andar tipo.</p>`; const us=l.units.filter(u=>!u.livre), K=l.coreKinds||{};
      const nomes={esc:"Escada",ant:"Antecâmara / hall",duto:"Dutos",balc:"Balcão",elev:"Elevadores",emerg:"Elev. emergência",shaft:"Shafts",pass:"Acessos",hall:"Hall",tec:"Técnico",lixo:"Lixo / DML",hserv:"Hall de serviço"};
      return `<section class="card"><div class="ch"><h2>Torre ${i+1}</h2><span class="aside">${l.dbl?"corredor central":"corredor lateral"} · núcleo ${m2(l.coreA)}</span></div><div class="cb">
        <div class="stack">${Object.entries(K).filter(([k,a])=>a>0.3).map(([k,a])=>`<span title="${nomes[k]||k}" style="width:${a/l.coreA*100}%;background:var(--c-${k})"></span>`).join("")}</div>
        <div class="stackleg">${Object.entries(K).filter(([k,a])=>a>0.3).map(([k,a])=>`<span><i style="background:var(--c-${k})"></i>${nomes[k]||k} ${nf(a,1)} m²</span>`).join("")}</div>
        <table class="tbl">${us.map(u=>`<tr><td>${esc(u.nome)} · alvo ${nf(u.alvo,0)} m²</td><td style="${u.area<u.alvo?"color:var(--bad)":""}">${nf(u.area,1)} m²</td></tr>`).join("")}
        <tr class="tot"><td>Unidades ÷ andar</td><td>${pct(us.reduce((s,u)=>s+u.area,0)/Math.max(1,t.A),0)}</td></tr></table></div></section>` }).join(""));
  }
  if(PSUB==="andar"){
    const fl=floorsList(m).slice().reverse();
    setHTML("andList", fl.map(a=>{ const lay = a.tipo==="ter"? m.gar&&m.gar.ter : a.lay? m.gar&&m.gar[a.lay] : null;
      const info = a.tipo==="tipo"? `${m.T.filter(t=>t.pav>a.j).reduce((s,t)=>s+t.units/Math.max(1,t.pav),0).toFixed(0)} un · +${nf(a.z0,1)} m` : lay? `${lay.count} vagas · ${nf(a.z0,1)} m` : `${nf(a.z0,1)} m`;
      return `<div class="li clk ${ANDAR===a.key&&VIEW==="andar"?"on":""}" data-act="andar" data-k="${a.key}"><span class="dot ${a.tipo==="tipo"?"ok":a.tipo==="ter"?"warn":""}"></span><span class="tt">${a.nome}</span><span class="ss">${info}</span></div>` }).join(""));
  }
};
let RS=null;
function rsHTML(){ const base=RS.cur? RS.cur.vagas : 0;
  return RS.list.slice(0,4).map((c,k)=>`<div class="res ${k===0?"top1":""}"><div class="rh"><b>${c.atual?"Atual":k===0?"Melhor acesso":"Opção "+(k+1)} · ${pct(c.acessoVei,0)} da frente</b><span class="pill ${c.vagas>base?"ok":""}">${c.vagas} vg (${c.vagas-base>=0?"+":""}${c.vagas-base})</span></div><div class="note">Rampas ${c.rampaTipo==="alternada"?"alternadas":"retas empilhadas"}${c.ok?"":" · com pendências"}</div>${c.atual?"":`<button class="btn sm ${k===0?"pri":""}" data-act="rsApply" data-i="${k}">Aplicar</button>`}</div>`).join("")
    + `<p class="note">Cada opção refaz todos os pavimentos com rotas verificadas (análise rápida). Atual: ${base} vagas.</p>` }
Object.assign(ACT,{
  garFl: b=>{ FLOOR=b.dataset.k; if(VIEW!=="gar") setView("gar"); else { viewbarSegs(window._last.m); fit2d() } STEP_LIVE.projeto(window._last.m) },
  rampAuto: ()=>{ S.estudo.rampa=null; renderTab() },
  resetOff: ()=>{ S.estudo.off={}; S.estudo.vtipo={}; update(); toast("Marcações manuais desfeitas") },
  acessoStudy: ()=>{ const list=acessoCandidatos(S), st=document.getElementById("rsStat"); RS={list:[], cur:{vagas:window._last.m.vagasLay||0}}; let i=0;
    const step=()=>{ const t0=performance.now(); while(i<list.length && performance.now()-t0<120){ const c=list[i++]; RS.list.push({...c, ...acessoAvalia(S,c)}) }
      const s_=document.getElementById("rsStat"); if(s_) s_.textContent=`analisando ${i}/${list.length}…`;
      if(i<list.length) setTimeout(step,0); else { RS.list.sort((a,b)=>(b.ok-a.ok)||(b.vagas-a.vagas)); fino(0) } };
    // as melhores são refeitas com o cálculo completo (o mesmo do projeto)
    const fino=k=>{ const s_=document.getElementById("rsStat"); if(k<Math.min(4,RS.list.length)){ if(s_) s_.textContent=`confirmando a opção ${k+1} com o cálculo completo…`; setTimeout(()=>{ const c=RS.list[k]; Object.assign(c, acessoAvalia(S,c,true), {fino:true}); fino(k+1) },0); return }
      RS.list.sort((a,b)=>(b.fino?1:0)-(a.fino?1:0) || (b.ok-a.ok) || (b.vagas-a.vagas)); if(s_) s_.textContent=`${list.length} combinações analisadas`; const el=document.getElementById("rsList"); if(el) el.innerHTML=rsHTML() };
    step() },
  rsApply: b=>{ const c=RS.list[+b.dataset.i]; S.lote.acessoVei=c.acessoVei; S.estudo.rampaTipo=c.rampaTipo; S.estudo.rampa=null; RS=null; renderTab(); setView("gar"); toast("Acesso e rampas aplicados") },
  andar: b=>{ ANDAR=b.dataset.k; if(VIEW!=="andar") setView("andar"); else { viewbarSegs(window._last.m); redraw2d(); planLegend() } STEP_LIVE.projeto(window._last.m) },
  corte3d: ()=>{ S.corte=ANDAR; save(); setView("3d") },
});

/* ---------------- 6. Clima ---------------- */
STEP_R.clima = ()=>{
  const C=S.clima, c=S.cfd;
  const sub=`<div class="seg full">${[["sol","Sol"],["vento","Vento no chão"],["v3d","Túnel de vento 3D"]].map(([k,l])=>`<button type="button" data-act="csub" data-v="${k}" aria-pressed="${CSUB===k}">${l}</button>`).join("")}</div>`;
  const ent = CARD(`Entorno`, `<p class="note">Volumes vizinhos fazem sombra e desviam o vento. Desenhe na implantação ou gere vizinhos genéricos.</p>
    <div class="row"><button class="btn sm" data-act="entGen">Gerar genéricos</button><button class="btn sm" data-act="entDraw">Desenhar volume</button>${S.entorno.length?`<button class="btn sm ghost" data-act="entClear">Apagar todos</button>`:""}</div>
    <div class="list">${S.entorno.map((e,i)=>`<div class="li" style="grid-template-columns:1fr 92px 24px"><div class="inp"><input class="t" data-p="entorno.${i}.nome" data-t="s" data-fx="save" value="${esc(e.nome||"")}" aria-label="Nome"></div><div class="inp"><input type="number" data-p="entorno.${i}.h" data-min="0" step="0.5" value="${e.h}" aria-label="Altura"><em>m</em></div><button type="button" class="x" data-act="entX" data-i="${i}" aria-label="Remover">×</button></div>`).join("")}</div>`, {details:false, key:"ent", aside:`${S.entorno.length} volume${S.entorno.length!==1?"s":""}`});
  let body="";
  if(CSUB==="sol") body =
    CARD("Data e hora", `<div class="seg full">${[["12,21","Verão"],["3,21","Equinócio"],["6,21","Inverno"]].map(([v,l])=>`<button type="button" data-act="sd" data-v="${v}" aria-pressed="${S.sol.mes+","+S.sol.dia===v}">${l}</button>`).join("")}</div>
      ${SLD("sol.mes","Mês (dia 21)",1,12,1,"",{fx:"sun",fmt:"mes"})}${SLD("sol.hora","Hora solar",6,19,0.25,"",{fx:"sun",fmt:"hora"})}${SW("sol.on","Sol e sombras no 3D",{fx:"sun"})}`) +
    CARD("Horas de sol no chão", `<div id="solInfo"></div>${SW("clima.overlay3d","Mostrar o mapa também no 3D",{fx:"r3"})}`) + ent;
  else if(CSUB==="vento") body =
    CARD("Vento de referência", compassSVG(C.ventoDir)+SLD("clima.ventoVel","Velocidade",1,20,0.5,"m/s",{fx:"clima"})+SLD("clima.ventoAlt","Altura da fatia",0.5,120,0.5,"m",{fx:"clima"})+`<p class="note">Direção de onde o vento vem. No litoral sul de SC predomina o nordeste, com rajadas de sul em frentes frias — confira no INMET.</p>`) +
    CARD("Resultado", `<div id="ventoInfo"></div>${SW("clima.overlay3d","Mostrar o mapa também no 3D",{fx:"r3"})}`) + ent;
  else {
    const V=c.viz, on=k=>!!V[k];
    const vizCards =
      (on("linhas")? CARD("Linhas de corrente", SLD("cfd.linhasN","Quantidade",8,160,1,"",{fx:"cfdLines",int:true})+SLD("cfd.linhasAlt.0","Começam a",0,1,0.05,"% da torre",{fx:"cfdLines",pct:true})+SLD("cfd.linhasAlt.1","Terminam a",0.2,2,0.05,"% da torre",{fx:"cfdLines",pct:true})+SLD("cfd.espessura","Espessura",0.4,3,0.1,"×",{fx:"cfdLines"})+
        SW("cfd.tubos","Tubos 3D (sem animação)",{fx:"cfdLines"})+SW("cfd.linhasMedia","Escoamento médio",{fx:"cfdLines"})+(c.semente?`<div class="row sb"><span class="pill">passando pelo ponto da sonda</span><button class="btn sm" data-act="semX">Soltar da entrada</button></div>`:"")) : "") +
      (on("fumaca")? CARD("Fumaça", ROW("Emissor",SEG("cfd.emissorTipo",[["linha","coluna"],["cortina","cortina"],["ponto","ponto"]],{fx:"cfdParts",rr:false}))+`<p class="note">Coluna: um fio de fumaça do chão até acima da torre. Cortina: uma parede de fumaça de lado a lado, em toda a altura.</p>`+
        SLD("cfd.fumacaN","Densidade",300,8000,100,"",{fx:"cfdParts",int:true})+SLD("cfd.partTam","Tamanho dos puffs",0.3,3,0.1,"×",{fx:"save"})+SW("cfd.fumacaCor","Colorir pela velocidade",{fx:"save"})+
        `<div class="row sb"><span class="pill">${c.emissor?"no ponto da sonda":"a barlavento"}</span>${c.emissor?`<button class="btn sm" data-act="emX">Voltar a barlavento</button>`:`<span class="note">Toque no 3D › “Soltar fumaça aqui”</span>`}</div>`) : "") +
      (on("particulas")? CARD("Partículas", SLD("cfd.partN","Quantidade",500,12000,100,"",{fx:"cfdParts",int:true})+SLD("cfd.partTam","Tamanho",0.3,3,0.1,"×",{fx:"save"})+SW("cfd.rastro","Rastros",{fx:"cfdParts",rr:true})+(c.rastro?SLD("cfd.rastroLen","Comprimento do rastro",0.05,1.5,0.05,"s",{fx:"save"}):"")) : "") +
      (on("plano")||on("setas")? CARD(on("plano")?"Plano de cor":"Setas", ROW("Plano",SEG("cfd.plano.orient",[["h","horizontal"],["l","longitudinal"],["t","transversal"]],{fx:"cfdLight"}))+
        (c.plano.orient==="h"? SLD("cfd.plano.h","Altura",0.5,120,0.5,"m",{fx:"cfdLight"}) : SLD("cfd.plano.pos","Posição",0,1,0.01,"%",{fx:"cfdLight",pct:true}))+
        (on("plano")? SLD("cfd.planoOpac","Opacidade",0.2,1,0.05,"%",{fx:"cfdLight",pct:true}) : "")+(on("setas")? SLD("cfd.setasDens","Densidade das setas",0.4,3,0.1,"×",{fx:"cfdLight"}) : "")) : "") +
      (on("pressao")? CARD("Pressão nas fachadas", SLD("cfd.opac","Opacidade",0.1,1,0.05,"%",{fx:"cfdBld",pct:true})+`<p class="note">Vermelho empurra a fachada (barlavento); azul suga (cantos, laterais e cobertura).</p>`) : "");
    body =
      CARD("Vento", `<div style="display:grid;grid-template-columns:150px 1fr;gap:12px;align-items:center">${compassSVG(C.ventoDir)}<div style="display:grid;gap:12px">${SLD("clima.ventoVel","Velocidade a 10 m",1,20,0.5,"m/s",{fx:"cfdStart"})}<p class="note">Toque na rosa para a direção de onde o vento vem.</p></div></div>${ROW("Entorno",SEG("cfd.rug",[["aberto","aberto"],["suburbano","subúrbio"],["urbano","urbano"]],{fx:"cfdStart",rr:false}))}`) +
      CARD("Simulação", `<div class="row sb"><span class="cfstat" id="cfdStat2"></span></div><div class="row" style="flex-wrap:nowrap"><button class="btn pri" data-act="cfdPlay" style="flex:1">${typeof CFD!=="undefined"&&CFD.running?"Pausar":"Simular"}</button><button class="btn" data-act="cfdReset">Reiniciar</button></div>
        ${ROW("Precisão",SEG("cfd.res",Object.entries(CFD_RES).map(([k,v])=>[k,v[1]]),{fx:"cfdStart",rr:false}))}<p class="note">Lattice Boltzmann D3Q19 com turbulência LES e perfil de camada limite. “Alta” mostra melhor esteiras e cantos, mas leva minutos.</p>`) +
      CARD("O que ver", `<div class="chips">${CFD_VIZ.map(([k,l])=>`<button type="button" class="chip" data-act="cviz" data-k="${k}" aria-pressed="${on(k)}">${l}</button>`).join("")}</div>
        <div class="fld"><label class="fl" for="cfdVarSel">Colorir por</label><select class="sel" id="cfdVarSel" data-p="cfd.var" data-t="s" data-fx="cfdRef" data-rr="1">${Object.entries(CFD_VARS).map(([k,l])=>`<option value="${k}" ${c.var===k?"selected":""}>${l}</option>`).join("")}</select></div>
        ${ROW("Escala",SEG("cfd.escala",[["auto","automática"],["fixa","fixa"]],{fx:"cfdRef"}))}${c.escala==="fixa"? KV(NUM("cfd.min","Mínimo","",{fx:"cfdRef",step:0.5})+NUM("cfd.max","Máximo","",{fx:"cfdRef",step:0.5})) : ""}`) +
      vizCards +
      CARD("Aparência", ROW("Fundo",SEG("cfd.fundo",[["claro","claro"],["escuro","escuro"]],{fx:"cfdLook",rr:false}))+SW("cfd.vidro","Prédios em vidro (ver através)",{fx:"cfdLook"})+SLD("cfd.animVel","Velocidade da animação",0.1,4,0.1,"×",{fx:"save"}), {details:false, key:"look"}) +
      ent;
  }
  return { sub, subKey:CSUB, body, after:()=>{ if(CSUB!=="v3d") climaInfo(); else if(typeof cfdStatus==="function") cfdStatus() } };
};
STEP_LIVE.clima = ()=>{};
function climaInfo(){
  const si=document.getElementById("solInfo"), vi=document.getElementById("ventoInfo");
  if(si) si.innerHTML = _sunCache? `<div class="mets"><div class="met"><div class="l">Sol possível no dia</div><div class="v">${nf(_sunCache.max,1)} h</div></div><div class="met"><div class="l">Média nas áreas livres</div><div class="v">${nf(_sunCache.mediaLote,1)} h</div></div><div class="met big"><div class="l">Áreas livres com menos de 2 h de sol</div><div class="v">${pct(_sunCache.pctBaixo,0)}</div></div></div>` : `<p class="note">Abra a vista Mapas para calcular.</p>`;
  if(vi){ const w=windStats(S); vi.innerHTML = w? `<div class="mets"><div class="met big"><div class="l">Rajada máxima no lote</div><div class="v">${nf(w.max*S.clima.ventoVel,1)} m/s</div><div class="s">${nf(w.max,2)}× o vento de referência · ${WIND.steps>=2400?"simulação concluída":"rodando "+pct(WIND.steps/2400,0)}</div></div><div class="met"><div class="l">Acelerado &gt;1,3×</div><div class="v">${pct(w.hi,0)}</div></div><div class="met"><div class="l">Calmaria &lt;0,35×</div><div class="v">${pct(w.calm,0)}</div></div></div>` : `<p class="note">Abra a vista Mapas › Vento no chão para simular.</p>` }
}
Object.assign(ACT,{
  sd: b=>{ const [mm,d]=b.dataset.v.split(",").map(Number); S.sol.mes=mm; S.sol.dia=d; sunUI(); applySun(); climaRun(); renderTab() },
  entGen: ()=>{ genNeighbors(); renderTab(); fit3d(); if(VIEW==="v3d") cfdStart(true); toast("Vizinhos genéricos criados — ajuste as alturas") },
  entDraw: ()=>{ setView("impl"); DRAW=[]; setTool("draw","entorno") },
  entClear: b=>{ if(b.dataset.arm){ S.entorno=[]; renderTab() } else { b.dataset.arm=1; b.textContent="Confirmar"; b.classList.add("on") } },
  entX: b=>{ S.entorno.splice(+b.dataset.i,1); renderTab() },
  cviz: b=>{ const k=b.dataset.k; S.cfd.viz[k]=!S.cfd.viz[k]; save(); if(cfdOn()){ if(k==="particulas"||k==="fumaca") cfdParticlesInit(); else if(k==="linhas") cfdLines(); else cfdRefresh(false); cfdBarUI(); render3() } renderTab() },
  cfdPlay: ()=>{ if(VIEW!=="v3d"){ setView("v3d"); return } CFD.running? cfdPause() : (CFD.worker? cfdRun() : cfdStart()); renderTab() },
  cfdReset: ()=>{ if(VIEW!=="v3d") setView("v3d"); else cfdStart(true) },
  semX: ()=>{ S.cfd.semente=null; save(); if(cfdOn()){ cfdLines(); render3() } renderTab() },
  emX: ()=>{ S.cfd.emissor=null; save(); if(cfdOn()) cfdParticlesInit(); renderTab() },
});

/* ---------------- 7. Cenários ---------------- */
function compareHTML(sel){
  const rows=[["Unidades","units",1,0],["Área privativa","priv",1,0],["Vagas","vagas",1,0],["CA","ca",0,2],["Altura (m)","h",-1,1],["VGV","vgv",1,"mi"],["Custo total","custo",-1,"mi"],["Lucro","lucro",1,"mi"],["Margem","margem",1,"%"],["TIR a.a.","tir",1,"%"],["Exposição máx.","exp",-1,"mi"]];
  const fmt=(v,f)=> v==null?"—": f==="mi"? mi(v) : f==="%"? pct(v) : nf(v,f);
  return `<div class="scroll"><table class="tbl multi"><tr><th></th>${sel.map(c=>`<th>${esc(c.nome)}</th>`).join("")}</tr>
  ${rows.map(([l,k,dir,f])=>{ const vals=sel.map(c=>c.k[k]); const ok=vals.filter(v=>v!=null); const best= dir===0||!ok.length? null : dir>0? Math.max(...ok) : Math.min(...ok);
    return `<tr><td>${l}</td>${vals.map(v=>`<td class="${v!=null&&v===best&&sel.length>1?"best":""}">${fmt(v,f)}</td>`).join("")}</tr>` }).join("")}</table></div>`;
}
STEP_R.cen = ()=>{
  const list=LS.get("gabarito.cenarios2")||[], sel=list.filter(c=>c.cmp);
  return { body:
    CARD("Salvar a simulação atual", `<div class="row" style="flex-wrap:nowrap"><input class="txt" id="cenNome" placeholder="Ex.: 2 torres · 12 e 9 pav"><button class="btn pri" data-act="cenSave">Salvar</button></div>`) +
    CARD(`Cenários salvos`, list.length? `<div class="list">${list.map((c,i)=>`<div class="res"><div class="rh"><b>${esc(c.nome)}</b>${c.aprovado?'<span class="pill ok">aprovado</span>':`<span class="pill">${esc(c.data)}</span>`}</div>
      <div class="rm"><span>Unid.<b>${c.k.units}</b></span><span>VGV<b>${mi(c.k.vgv)}</b></span><span>Margem<b>${pct(c.k.margem)}</b></span><span>TIR<b>${c.k.tir==null?"—":pct(c.k.tir)}</b></span></div>
      <div class="row sb"><span class="row" style="gap:4px"><button class="btn sm" data-act="cenLoad" data-i="${i}">Abrir</button><label class="sw" style="font-size:12px"><input type="checkbox" data-cmp="${i}" ${c.cmp?"checked":""}><span class="tg"></span>comparar</label></span><button class="btn sm ghost" data-act="cenDel" data-i="${i}">Excluir</button></div></div>`).join("")}</div>` : `<p class="note">Nenhum cenário ainda. Salve variações para comparar lado a lado.</p>`, {aside:String(list.length)}) +
    (sel.length>=2? CARD("Comparação", compareHTML(sel)) : list.length>=2? `<p class="note">Marque “comparar” em dois ou mais cenários.</p>` : "") +
    CARD("Entregar", `<div class="row"><button class="btn pri" data-act="pdf">Relatório PDF</button><button class="btn" data-act="zip">DXF + IFC (zip)</button><button class="btn" data-act="json">Projeto .json</button></div>
      <div class="row"><label class="btn" for="jsonIn">Abrir projeto .json</label><input type="file" id="jsonIn" accept=".json,application/json" hidden><button class="btn" data-act="copy">Copiar resumo</button></div><p class="note" id="dlNote"></p>`) +
    CARD("Recomeçar", `<button class="btn" data-act="reset">Restaurar o exemplo</button><p class="note">Cenários e regras ficam neste navegador. Use o .json para levar o estudo a outro aparelho.</p>`, {details:false, key:"reset"}),
    after: ()=>dlCheck()
  };
};
Object.assign(ACT,{
  cenSave: ()=>{ saveScenario(document.getElementById("cenNome").value.trim()); renderTab(); toast("Cenário salvo") },
  cenLoad: b=>{ const c=(LS.get("gabarito.cenarios2")||[])[+b.dataset.i]; if(c){ S=merge(clone(DEF),c.S); document.getElementById("projName").value=S.nome; renderTab(); fit3d(); fit2d(); toast("Cenário aberto: "+c.nome) } },
  cenDel: b=>{ const l=LS.get("gabarito.cenarios2")||[]; l.splice(+b.dataset.i,1); LS.set("gabarito.cenarios2",l); renderTab() },
  pdf: ()=>exportPDF(), zip: ()=>exportZIP(), json: ()=>exportJSON(),
  copy: ()=>{ const txt=resumo(); const fb=()=>{ const ta=document.createElement("textarea"); ta.value=txt; TB.appendChild(ta); ta.select(); try{ document.execCommand("copy"); toast("Resumo copiado") }catch(e){ toast("Selecione o texto e copie") } };
    try{ navigator.clipboard.writeText(txt).then(()=>toast("Resumo copiado"),fb) }catch(e){ fb() } },
  reset: b=>{ if(b.dataset.arm){ S=clone(DEF); document.getElementById("projName").value=S.nome; BG=null; OTIM=null; renderTab(); fit3d(); fit2d(); toast("Exemplo restaurado") } else { b.dataset.arm=1; b.textContent="Confirmar: apagar o estudo atual"; b.classList.add("on") } },
});
