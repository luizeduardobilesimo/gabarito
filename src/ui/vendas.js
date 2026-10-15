/* ================= 1.1 tabela de vendas: card na Viabilidade, cores no 3D e na planta tipo, CSV/XLSX e PDF ================= */
const VENDA_STOPS=[[0,[52,96,158]],[0.35,[84,156,170]],[0.65,[226,186,84]],[1,[204,92,44]]];
/* estilos da tabela e do cartão (só tokens do shell) */
{ const st=document.createElement("style"); st.id="vdCSS"; st.textContent=`
.vdt{width:100%;border-collapse:collapse;table-layout:fixed;font-variant-numeric:tabular-nums}
.vdt th,.vdt td{padding:5px 3px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vdt th{font-size:10.5px;font-weight:600;color:var(--muted);position:sticky;top:0;background:var(--surface);cursor:pointer;user-select:none}
.vdt td{font-family:var(--f-mono);font-size:11px}
.vdt th:nth-child(-n+2),.vdt td:nth-child(-n+2){text-align:left}
.vdt td:first-child{font-family:var(--f-body);font-weight:600;font-size:11.5px}
.vdt tbody tr{cursor:pointer}.vdt tbody tr:hover{background:var(--surface-2)}.vdt tbody tr.on{background:var(--accent-2)}
.vdt tfoot td{font-weight:600;border-top:1px solid var(--ink);border-bottom:0}
.vdc{display:grid;gap:7px;font-size:12px}
.vdc .hd{display:flex;justify-content:space-between;align-items:center;gap:8px}
.vdc .hd b{font-family:var(--f-display);font-size:13px}
.vdc .pr{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:7px 10px;border-radius:10px;background:var(--surface-2)}
.vdc .pr .v{font-family:var(--f-display);font-size:19px;font-weight:620}
.vdc .pr .s{font-family:var(--f-mono);font-size:10.5px;color:var(--muted);text-align:right}
.vdc .r{display:grid;grid-template-columns:78px minmax(0,1fr);gap:8px;align-items:baseline}
.vdc .r>span:first-child{color:var(--muted);font-size:11px}
.vdc .r>span:last-child{font-family:var(--f-mono);font-size:11px;overflow-wrap:anywhere}
#vdBar{top:60px;bottom:auto}
@media (max-width:900px){#vdBar{top:auto;bottom:8px;left:8px;right:8px;max-width:none!important}}`; document.head.appendChild(st) }
const VD = { sort:{k:"id", dir:1}, ft:"", fa:"", sel:null, meshes:[], ultimo:null };
/* o resultado rápido (prévia enquanto o Worker calcula) não traz unidades: mostra o último completo */
function vdM(m){ if(m && m.unidades){ VD.ultimo=m; return m } return VD.ultimo || m || {} }
const vdLast = ()=> vdM(window._last && window._last.m);
const vdDir = u=> u.fachadas.length? [...new Set(u.fachadas.filter(f=>f.len>=0.3*u.fachadaLen).map(f=>f.dir))].join("·") : "—";
const vdH = v=> v==null? "—" : nf(v,1)+" h";
const vdPct = v=> Math.abs(v)<0.0005? "0,0%" : (v>0?"+":"")+nf(v*100,1)+"%";
const vdMi = v=> Math.abs(v)>=1e6? nf(v/1e6,2)+" mi" : nf(v/1e3,0)+" mil";

/* escala de cor (preço/m² ou horas de sol médias) */
function vendaEscala(m, kind){
  kind=kind||S.venda.cor; const U=(m&&m.unidades||[]).filter(u=>u.poly&&u.poly.length>2);
  const val= kind==="sol"? (u=>u.sol? u.sol.media : null) : (u=>u.precoM2);
  // no preço, a escala segue os pavimentos tipo (coberturas, bem mais caras, ficam no topo da escala)
  const tipos=U.filter(u=>!u.cob), R= kind!=="sol" && tipos.length>=4? tipos : U;
  const vs=R.map(val).filter(v=>v!=null&&isFinite(v)); if(!vs.length) return null;
  return {kind, val, min:Math.min(...vs), max:Math.max(...vs), stops: kind==="sol"? SUN_STOPS : VENDA_STOPS};
}
function vendaCor(e, u){ const v=e.val(u); if(v==null||!isFinite(v)) return null; return rampColor((v-e.min)/((e.max-e.min)||1), e.stops) }
const vdFmtEsc = (e,v)=> e.kind==="sol"? nf(v,1)+" h" : "R$ "+nf(v/1000,1)+" mil/m²";
const vdGrad = e=> `linear-gradient(90deg,${e.stops.map(([t,c])=>`rgb(${c}) ${t*100}%`).join(",")})`;

/* ---------- card na etapa Viabilidade ---------- */
addCard("viab", { key:"vendas", sub:"vendas", order:40,
  html: ()=>{
    const V=S.venda;
    return RES("Tabela de vendas", `<div id="vdSum"></div>`, {aside:`<span id="vdModo">${V.modo==="unidade"?"VGV = soma das unidades":"VGV pelo preço médio"}</span>`}) +
      SEC("Unidades", `<div class="fld wide"><span class="fl">VGV residencial ${INFO("VGV")}</span>${SEG("venda.modo",[["medio","Preço médio do mix"],["unidade","Soma por unidade"]],{full:true,label:"Como calcular o VGV"})}</div>` +
        ROW("Cores no 3D", SEG("venda.cor",[["nada","sem cor"],["preco","preço/m²"],["sol","sol"]],{fx:"vendaCor",rr:false,label:"Colorir unidades"})) +
        `<div class="row sb" style="flex-wrap:nowrap;gap:6px"><select class="sel" id="vdFT" aria-label="Filtrar por torre" style="flex:1;min-width:0"></select><select class="sel" id="vdFA" aria-label="Filtrar por andar" style="flex:1;min-width:0"></select></div>
         <div id="vdTab" style="max-height:340px;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:0 6px"></div>
         <div id="vdUni"></div>
         <div class="row sb"><span class="row" style="gap:6px"><button type="button" class="btn sm" data-act="vendaCSV">CSV</button><button type="button" class="btn sm" data-act="vendaXLSX">Planilha XLSX</button></span><span class="note" id="vdN"></span></div>`,
        {key:"vendas", open:true, info:"Tabela de vendas", sum:""}) +
      SEC("Valorização por unidade",
        KV(NUM("venda.andarPct","Por andar acima do 1º","%",{pct:true,step:0.1})+NUM("venda.solPct","Sol: por hora","%",{pct:true,step:0.1,help:"Prêmio por hora de sol direto por dia (média de inverno, equinócios e verão) acima da mediana do prédio."})+
          NUM("venda.vistaPct","Vista: até","± %",{pct:true,step:0.5,help:"Fração de céu visível em leque diante das fachadas, contra o entorno, mais a altura do andar. 0,25 acima da mediana dá o máximo."})+NUM("venda.cobPct","Coberturas","%",{pct:true,step:0.5})) +
        ADV(KV(NUM("venda.andarTeto","Teto do andar","%",{pct:true,step:0.5})+NUM("venda.solPiso","Sol: piso","%",{pct:true,step:0.5})+NUM("venda.solTeto","Sol: teto","%",{pct:true,step:0.5})) +
          GRP("Orientação da melhor fachada (%)") +
          `<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px">${UNI_DIRS.map(d=>NUM("venda.orient."+d,d,"",{pct:true,step:0.5})).join("")}</div>` +
          `<div class="row"><button type="button" class="btn sm" data-act="vendaHem" data-v="sul">Padrão hemisfério sul</button><button type="button" class="btn sm" data-act="vendaHem" data-v="norte">Padrão hemisfério norte</button></div>` +
          SW("venda.manterMedia","Manter o total do preço médio (só redistribui)"), {key:"vendaPrem"}),
        {key:"vendaPrem", info:"Preço = área × preço/m² da tipologia (mix) × (1 + prêmios). Sol: pontos a cada 1,5 m nas fachadas, raios a cada 15 min em 21/jun, 21/set e 21/dez contra o próprio prédio, as outras torres e o entorno.", sum:""});
  },
  after: ()=>{
    ["vdFT","vdFA"].forEach(id=>{ const e=document.getElementById(id); if(e) e.addEventListener("change",()=>{ VD.ft=document.getElementById("vdFT").value; VD.fa=document.getElementById("vdFA").value; vendaTabela(vdLast()) }) });
  },
  live: (m,f)=> vendaLive(vdM(m),f)
});
function vendaLive(m,f){
  const U=m.unidades; if(!U){ setHTML("vdSum",`<p class="note">Tabela indisponível.</p>`); return }
  const base=U.reduce((s,u)=>s+u.base,0), tab=m.unidadesTot, d=base? tab/base-1 : 0, sols=U.filter(u=>u.sol).map(u=>u.sol.media);
  const pm=U.map(u=>u.precoM2), V=S.venda;
  setHTML("vdSum", `<div class="mets"><div class="met big"><div class="l">Soma da tabela${m.unidadesRascunho?" · prévia":""}</div><div class="v">${mi(tab)}</div><div class="s">preço médio do mix ${mi(base)} · ${vdPct(d)}</div></div>
    <div class="met"><div class="l">Faixa de preço</div><div class="v">${nf(Math.min(...pm)/1000,1)}–${nf(Math.max(...pm)/1000,1)}</div><div class="s">mil R$/m²</div></div>
    <div class="met"><div class="l">Sol médio</div><div class="v">${sols.length? nf(sols.reduce((a,b)=>a+b,0)/sols.length,1)+" h" : "—"}</div><div class="s">por dia, na fachada</div></div></div>
    ${V.modo==="medio"? `<p class="note" style="margin-top:6px">O VGV ainda usa o preço médio do mix (a tabela daria ${vdPct(d)}).</p>`:""}`);
  { const e=document.getElementById("vdModo"), h=V.modo==="unidade"?"VGV = soma das unidades":"VGV pelo preço médio"; if(e && e.textContent!==h) e.textContent=h }
  setSum("vendas", `<b>${U.length}</b> unidades · ${mi(tab)}`);
  setSum("vendaPrem", `andar ${vdPct(V.andarPct)} · sol ${vdPct(V.solPct)}/h`);
  // filtros
  const torres=[...new Set(U.map(u=>u.torre))], andares=[...new Set(U.map(u=>u.andar))].sort((a,b)=>a-b);
  const ft=document.getElementById("vdFT"), fa=document.getElementById("vdFA");
  if(ft){ const h=`<option value="">Todas as torres</option>`+torres.map(t=>`<option value="${t}" ${String(t)===VD.ft?"selected":""}>Torre ${t}</option>`).join(""); if(ft.innerHTML!==h) ft.innerHTML=h; ft.hidden=torres.length<2 }
  if(fa){ const h=`<option value="">Todos os andares</option>`+andares.map(a=>`<option value="${a}" ${String(a)===VD.fa?"selected":""}>${a}º andar</option>`).join(""); if(fa.innerHTML!==h) fa.innerHTML=h }
  vendaTabela(m);
}
function vendaFiltradas(m){
  const U=(m.unidades||[]).filter(u=>(!VD.ft||String(u.torre)===VD.ft)&&(!VD.fa||String(u.andar)===VD.fa));
  const k=VD.sort.k, dir=VD.sort.dir, key={id:u=>u.torre*1e5+u.andar*100+(+u.final), tip:u=>u.tipologia, area:u=>u.area, sol:u=>u.sol?u.sol.media:-1, pr:u=>u.premios.total, preco:u=>u.preco}[k]||(u=>u.id);
  return U.slice().sort((a,b)=>{ const x=key(a), y=key(b); return (x<y?-1:x>y?1:0)*dir });
}
function vendaTabela(m){
  const el=document.getElementById("vdTab"); if(!el||!m.unidades) return;
  const L=vendaFiltradas(m), th=(k,l,w)=>`<th data-act="vendaSort" data-k="${k}" style="width:${w}%" aria-sort="${VD.sort.k===k?(VD.sort.dir>0?"ascending":"descending"):"none"}">${l}${VD.sort.k===k?(VD.sort.dir>0?" ▲":" ▼"):""}</th>`;
  const h=`<table class="vdt"><thead><tr>${th("id","Unidade",21)}${th("tip","Tipo",20)}${th("area","m²",13)}${th("sol","Sol h",12)}${th("pr","Prêmio",15)}${th("preco","Preço",19)}</tr></thead><tbody>`+
    L.map(u=>`<tr data-act="vendaUni" data-id="${esc(u.id)}"${VD.sel===u.id?' class="on"':""}><td>${esc(u.id)}</td><td title="${esc(u.tipologia)}">${esc(u.tipologia)}</td><td>${nf(u.area,1)}</td><td>${u.sol? nf(u.sol.media,1) : "—"}</td><td style="color:${u.premios.total<-0.0005?"var(--bad)":u.premios.total>0.0005?"var(--ok)":"var(--muted)"}">${vdPct(u.premios.total)}</td><td>${vdMi(u.preco)}</td></tr>`).join("")+
    `</tbody><tfoot><tr class="tot"><td>${L.length} un.</td><td></td><td>${nf(L.reduce((s,u)=>s+u.area,0),0)}</td><td></td><td></td><td>${vdMi(L.reduce((s,u)=>s+u.preco,0))}</td></tr></tfoot></table>`;
  if(el.innerHTML!==h) el.innerHTML=h;
  const n=document.getElementById("vdN"); if(n) n.textContent=`${L.length===m.unidades.length? m.unidades.length : L.length+" de "+m.unidades.length} unidades`;
  vendaUniCard(m);
}
/* cartão de uma unidade (no card e no 3D) */
function vendaUniHTML(u, close){
  const p=u.premios, s=u.sol, ch=(l,v)=>`<span class="pill" style="color:${v<-0.0005?"var(--bad)":v>0.0005?"var(--ok)":"var(--muted)"}">${l} ${vdPct(v)}</span>`;
  return `<div class="vdc"><div class="hd"><b>${esc(u.id)} · ${esc(u.tipologia)}</b><span style="display:flex;gap:6px;align-items:center"><span class="pill">${nf(u.area,1)} m²</span>${close?`<button class="btn sm ghost" data-x="1" aria-label="Fechar">×</button>`:""}</span></div>
  <div class="pr"><span class="v">${mi(u.preco)}</span><span class="s">${brl(u.precoM2)}/m²<br>${vdPct(p.total)} sobre ${mi(u.base)}</span></div>
  <div class="r"><span>Posição</span><span>torre ${u.torre} · ${u.andar}º andar · final ${u.final}</span></div>
  <div class="r"><span>Fachadas</span><span>${u.fachadas.map(f=>`${f.dir} ${nf(f.len,1)} m`).join(" · ")||"—"}</span></div>
  <div class="r"><span>Sol direto</span><span>${s? `inv. ${nf(s.inverno,1)} · equin. ${nf(s.equinocio,1)} · ver. ${nf(s.verao,1)} h` : "—"}</span></div>
  <div class="r"><span>Vista</span><span>${u.vista==null?"—":nf(u.vista,2)+" de 1"}</span></div>
  <div class="row" style="gap:4px">${ch("andar",p.andar)}${ch("sol",p.sol)}${ch("orientação",p.orient)}${ch("vista",p.vista)}${u.cob?ch("cobertura",p.cob):""}${p.ajuste!=null?ch("ajuste",p.ajuste):""}</div></div>`;
}
function vendaUniCard(m){
  const el=document.getElementById("vdUni"); if(!el) return; const u=VD.sel&&m.unidades&&m.unidades.find(x=>x.id===VD.sel);
  const h=u? `<div style="border:1px solid var(--line);border-radius:12px;padding:9px 10px">${vendaUniHTML(u)}</div>` : "";
  if(el.innerHTML!==h) el.innerHTML=h;
}
Object.assign(ACT,{
  vendaSort: b=>{ const k=b.dataset.k; VD.sort = VD.sort.k===k? {k, dir:-VD.sort.dir} : {k, dir: k==="preco"||k==="sol"||k==="pr"? -1 : 1}; vendaTabela(vdLast()) },
  vendaUni: b=>{ VD.sel = VD.sel===b.dataset.id? null : b.dataset.id; vendaTabela(vdLast()); vendaAfterSel() },
  vendaHem: b=>{ S.venda.orient = {...(b.dataset.v==="norte"? UNI_ORIENT_NORTE : UNI_ORIENT_SUL)}; renderTab(); toast(`Orientação: padrão do hemisfério ${b.dataset.v}`) },
  vendaCSV: ()=>vendaCSV(), vendaXLSX: ()=>vendaXLSX(),
  vendaCorSet: b=>{ S.venda.cor=b.dataset.v; FX.vendaCor() },
  vendaAnd: b=>{ const L=vendaAndares(vdLast()), i=L.indexOf(vendaAndarAtual(vdLast())), j=Math.max(0,Math.min(L.length-1,i+(+b.dataset.d))); S.venda.andarTipo=L[j]; save(); redraw2d(); vendaBar() },
});
FX.vendaCor = ()=>{ save(); const m=window._last&&window._last.m; if(m){ rebuild3d(m); redraw2d() } vendaBar();
  document.querySelectorAll('[data-set="venda.cor"]').forEach(b=>b.setAttribute("aria-pressed", JSON.parse(b.dataset.v)===S.venda.cor)) };
function vendaAfterSel(){ const m=window._last.m; if(VIEW==="3d" && S.venda.cor!=="nada") rebuild3d(m); if(VIEW==="tipo") redraw2d() }

/* ---------- exportação ---------- */
const VD_COLS = [["Torre",u=>u.torre],["Andar",u=>u.andar],["Final",u=>u.final],["Unidade",u=>u.id],["Tipologia",u=>u.tipologia],["Área privativa (m²)",u=>u.area,4],
  ["Orientação",u=>vdDir(u)],["Sol inverno (h)",u=>u.sol&&u.sol.inverno,4],["Sol equinócio (h)",u=>u.sol&&u.sol.equinocio,4],["Sol verão (h)",u=>u.sol&&u.sol.verao,4],["Sol médio (h)",u=>u.sol&&u.sol.media,4],
  ["Vista (0-1)",u=>u.vista,4],["Prêmio andar",u=>u.premios.andar,10],["Prêmio sol",u=>u.premios.sol,10],["Prêmio orientação",u=>u.premios.orient,10],["Prêmio vista",u=>u.premios.vista,10],["Prêmio cobertura",u=>u.premios.cob,10],
  ["Prêmio total",u=>u.premios.total,10],["Preço base (R$)",u=>u.base,3],["Preço (R$)",u=>u.preco,3],["Preço/m² (R$)",u=>u.precoM2,3]];
function vendaLinhas(){ const m=vdLast(); return vendaFiltradas({unidades:m.unidades||[]}).sort((a,b)=>a.torre-b.torre||a.andar-b.andar||(+a.final)-(+b.final)) }
function vendaCSV(){
  const L=vendaLinhas(); if(!L.length){ toast("Sem unidades"); return }
  const cell=(v,fmt)=>{ if(v==null) return ""; if(typeof v==="number"){ return String(fmt===10? +(v*100).toFixed(3) : +v.toFixed(fmt===3?2:3)).replace(".",",") } const s=String(v); return /[;"\n]/.test(s)? `"${s.replace(/"/g,'""')}"` : s };
  const head=VD_COLS.map(([h,,f])=>f===10? h+" (%)" : h).join(";");
  const csv="﻿"+head+"\n"+L.map(u=>VD_COLS.map(([,g,f])=>cell(g(u),f)).join(";")).join("\n")+"\n";
  saveFile(slug(S.nome)+"-tabela-de-vendas.csv", csv);
}
/* XLSX mínimo (OOXML) montado com o JSZip que o export já usa */
function vendaXlsxBlob(L){
  const x=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const col=i=>{ let s=""; i++; while(i){ const r=(i-1)%26; s=String.fromCharCode(65+r)+s; i=Math.floor((i-1)/26) } return s };
  const st={4:2,3:3,10:4}; // estilos: 1 cabeçalho · 2 0,00 · 3 #.##0 · 4 0,00%
  const row=(r,cells)=>`<row r="${r}">${cells.join("")}</row>`;
  const c=(r,i,v,s)=> v==null||v===""? "" : typeof v==="number"&&isFinite(v)? `<c r="${col(i)}${r}"${s?` s="${s}"`:""}><v>${v}</v></c>` : `<c r="${col(i)}${r}" t="inlineStr"${s?` s="${s}"`:""}><is><t>${x(v)}</t></is></c>`;
  const rows=[row(1,VD_COLS.map(([h],i)=>c(1,i,h,1)))];
  L.forEach((u,k)=>rows.push(row(k+2,VD_COLS.map(([,g,f],i)=>c(k+2,i,g(u),st[f]||0)))));
  const n=L.length+1, sum=i=>`<c r="${col(i)}${n+1}" s="3"><f>SUM(${col(i)}2:${col(i)}${n})</f></c>`;
  rows.push(`<row r="${n+1}"><c r="A${n+1}" t="inlineStr" s="1"><is><t>Total</t></is></c>${sum(5).replace('s="3"','s="2"')}${sum(18)}${sum(19)}</row>`);
  const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="3" width="8" customWidth="1"/><col min="4" max="5" width="14" customWidth="1"/><col min="6" max="21" width="15" customWidth="1"/></cols><sheetData>${rows.join("")}</sheetData><autoFilter ref="A1:${col(VD_COLS.length-1)}${n}"/></worksheet>`;
  const z0=new JSZip(), z={file:(n,d)=>z0.file(n,d,{createFolders:false}), generateAsync:o=>z0.generateAsync(o)};
  z.file("[Content_Types].xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
  z.file("_rels/.rels",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  z.file("xl/workbook.xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Tabela de vendas" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'Tabela de vendas'!$A$1:$${col(VD_COLS.length-1)}$${n}</definedName></definedNames></workbook>`);
  z.file("xl/_rels/workbook.xml.rels",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  z.file("xl/styles.xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="5"><xf/><xf fontId="1" applyFont="1"/><xf numFmtId="4" applyNumberFormat="1"/><xf numFmtId="3" applyNumberFormat="1"/><xf numFmtId="10" applyNumberFormat="1"/></cellXfs></styleSheet>`);
  z.file("xl/worksheets/sheet1.xml", sheet);
  return z.generateAsync({type:"blob", mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", compression:"DEFLATE"});
}
async function vendaXLSX(){
  const L=vendaLinhas(); if(!L.length){ toast("Sem unidades"); return }
  try{ await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js") }catch(e){ toast("Não consegui carregar o gerador de planilha"); return }
  await saveFile(slug(S.nome)+"-tabela-de-vendas.xlsx", await vendaXlsxBlob(L));
}

/* ---------- planta tipo: cor da unidade no andar escolhido ---------- */
const vendaAndares = m=>[...new Set((m&&m.unidades||[]).filter(u=>u.torre===TOWER+1&&u.poly).map(u=>u.andar))].sort((a,b)=>a-b);
function vendaAndarAtual(m){ const L=vendaAndares(m); if(!L.length) return 0; const a=+S.venda.andarTipo||0; return L.includes(a)? a : L.filter(x=>!(m.unidades.find(u=>u.torre===TOWER+1&&u.andar===x)||{}).cob).at(-1) ?? L.at(-1) }
HOOK.draw2d.push((g, ctx)=>{
  if(ctx.mode!=="tipo") return;
  const m=vdM(ctx.m), kind=(ctx.opt&&ctx.opt.vendaCor)||S.venda.cor; if(kind==="nada"||!m.unidades) return;
  const e=vendaEscala(m,kind); if(!e) return;
  const tw=(ctx.opt&&ctx.opt.tower)||0, and=(ctx.opt&&ctx.opt.vendaAndar)||vendaAndarAtual(m);
  const U=m.unidades.filter(u=>u.torre===tw+1&&u.andar===and&&u.poly);
  U.forEach(u=>{ const c=vendaCor(e,u); if(!c) return; g.beginPath(); u.poly.forEach((q,i)=>{ const [x,y]=ctx.w2s(q); i?g.lineTo(x,y):g.moveTo(x,y) }); g.closePath();
    g.fillStyle=`rgb(${c})`; g.fill(); g.strokeStyle=css("--ink"); g.lineWidth=VD.sel===u.id?3:1.4; g.stroke() });
  if(ctx.V.s>3.5) U.forEach(u=>{ const [x,y]=ctx.w2s(G.centroid(u.poly)), c=vendaCor(e,u)||[255,255,255]; g.textAlign="center"; g.textBaseline="middle";
    g.font="600 12px "+css("--f-display"); g.fillStyle= 0.299*c[0]+0.587*c[1]+0.114*c[2] > 140? "#1d1d1f" : "#f5f5f7"; g.fillText(u.id.split("-")[1], x, y-15);
    g.font="500 10.5px "+css("--f-mono"); g.fillText(e.kind==="sol"? `${nf(u.sol?u.sol.media:0,1)} h/dia` : mi(u.preco), x, y);
    g.fillText(vdPct(u.premios.total)+" · "+vdDir(u), x, y+14) });
  // título do andar
  g.font="600 12px "+css("--f-display"); g.textAlign="left"; g.textBaseline="alphabetic"; g.fillStyle=css("--ink");
  g.fillText(`${and}º andar · ${e.kind==="sol"?"horas de sol por dia (média)":"preço por unidade"}`, 16, ctx.H-44);
});

/* ---------- 3D: unidades coloridas + toque mostra o cartão ---------- */
HOOK.draw3d.push((grp, m)=>{
  VD.meshes=[]; vendaBar(); m=vdM(m);
  const kind=S.venda.cor; if(kind==="nada"||!m.unidades) return;
  const e=vendaEscala(m,kind); if(!e) return; const P=S.produto;
  m.unidades.forEach(u=>{ if(!u.poly||u.poly.length<3||u.z==null) return; const c=vendaCor(e,u); if(!c) return;
    const cen=G.centroid(u.poly), r=Math.max(1,Math.sqrt(G.area(u.poly))), k=1+0.07/r, p=u.poly.map(q=>[cen[0]+(q[0]-cen[0])*k, cen[1]+(q[1]-cen[1])*k]);
    const col=new THREE.Color(`rgb(${c})`), sel=VD.sel===u.id;
    const mesh=slab(p, u.z-P.pe/2+0.01, P.pe-0.24, col, {eop:sel?0.9:0.3, rough:0.6, emissive: col.clone().multiplyScalar(sel?0.55:0.22)});
    if(mesh){ mesh.userData.uni=u.id; VD.meshes.push(mesh) } });
});
function vendaCard3d(u){
  let el=document.getElementById("vdCard"); if(!u){ if(el) el.hidden=true; return }
  if(!el){ el=document.createElement("div"); el.id="vdCard"; el.className="cfdprobe"; document.getElementById("view").appendChild(el);
    el.addEventListener("click",e=>{ if(e.target.closest("[data-x]")){ el.hidden=true; VD.sel=null; vendaAfterSel(); if(TAB==="viab") vendaTabela(vdLast()) } }) }
  el.innerHTML=vendaUniHTML(u, true);
  el.hidden=false;
}
{ const c3=document.getElementById("c3d"); let down=null;
  c3.addEventListener("pointerdown",e=>{ down=[e.clientX,e.clientY] });
  c3.addEventListener("pointerup",e=>{
    if(VIEW!=="3d"||!down||!VD.meshes.length||typeof THREE==="undefined"){ down=null; return }
    const moved=Math.hypot(e.clientX-down[0],e.clientY-down[1]); down=null; if(moved>5) return;
    const r=c3.getBoundingClientRect(), ray=new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1, -(e.clientY-r.top)/r.height*2+1), V3.cam);
    const hit=ray.intersectObjects(VD.meshes,false)[0], m=vdLast(), u=hit&&m.unidades&&m.unidades.find(x=>x.id===hit.object.userData.uni);
    VD.sel=u? u.id : null; vendaCard3d(u); rebuild3d(window._last.m); if(TAB==="viab") vendaTabela(m);
  });
}
/* barra "Unidades" no palco (3D e planta tipo): escolha da cor, escala e andar */
function vendaBar(){
  const v=document.getElementById("view"); if(!v) return; let el=document.getElementById("vdBar");
  const m=window._last? vdLast() : null, show=!!(m&&m.unidades&&m.unidades.length) && (VIEW==="3d"||VIEW==="tipo");
  if(!el){ if(!show) return; el=document.createElement("div"); el.id="vdBar"; el.className="cfdbar"; el.style.maxWidth="min(330px,calc(100% - 24px))"; v.appendChild(el);
    el.addEventListener("click",e=>{ const b=e.target.closest("[data-act]"); if(b&&ACT[b.dataset.act]) ACT[b.dataset.act](b) });
    el.addEventListener("change",e=>{ if(e.target.id==="vdAndSel"){ S.venda.andarTipo=+e.target.value; save(); redraw2d(); vendaBar() } }) }
  el.hidden=!show; if(!show){ const c=document.getElementById("vdCard"); if(c&&VIEW!=="3d") c.hidden=true; return }
  const kind=S.venda.cor, e=kind!=="nada"? vendaEscala(m,kind) : null;
  const seg=`<div class="seg" role="group" aria-label="Colorir unidades" style="display:inline-flex">${[["nada","sem cor"],["preco","preço/m²"],["sol","sol"]].map(([k,l])=>`<button type="button" data-act="vendaCorSet" data-v="${k}" aria-pressed="${kind===k}">${l}</button>`).join("")}</div>`;
  let h=`<div class="row sb" style="flex-wrap:nowrap"><b style="font-family:var(--f-display);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)">Unidades</b>${seg}</div>`;
  if(e) h+=`<div style="height:8px;border-radius:4px;background:${vdGrad(e)}"></div><div class="row sb cfstat"><span>${vdFmtEsc(e,e.min)}</span><span>${e.kind==="sol"?"sol médio por dia":"preço por m²"}</span><span>${vdFmtEsc(e,e.max)}</span></div>`;
  if(e && VIEW==="tipo"){ const L=vendaAndares(m), a=vendaAndarAtual(m);
    h+=`<div class="row" style="flex-wrap:nowrap;gap:6px"><span class="cfstat">Andar</span><button class="btn sm" data-act="vendaAnd" data-d="-1" aria-label="Andar abaixo">▼</button><select id="vdAndSel" aria-label="Andar da planta">${L.map(x=>`<option value="${x}" ${x===a?"selected":""}>${x}º</option>`).join("")}</select><button class="btn sm" data-act="vendaAnd" data-d="1" aria-label="Andar acima">▲</button></div>` }
  if(e && VIEW==="3d") h+=`<div class="cfstat">Toque numa unidade para ver o cartão</div>`;
  if(el.innerHTML!==h) el.innerHTML=h;
}
// a barra acompanha a troca de vista (canvas 2D/3D aparecem e somem) e a torre escolhida
{ const mo=new MutationObserver(()=>{ vendaBar(); if(VIEW!=="3d"){ const c=document.getElementById("vdCard"); if(c) c.hidden=true } });
  ["c3d","c2d"].forEach(id=>{ const e=document.getElementById(id); if(e) mo.observe(e,{attributes:true, attributeFilter:["hidden"]}) });
  const ts=document.getElementById("towerSeg"); if(ts) ts.addEventListener("click",()=>setTimeout(vendaBar,0)); }
HOOK.draw2d.push((g,ctx)=>{ if(ctx.mode==="tipo" && g===(typeof g2!=="undefined"?g2:null)) vendaBar() });

/* ---------- PDF: página "Tabela de vendas" ---------- */
HOOK.pdf.push(async ctx=>{
  const {doc,m,f,T,PW,M,h2,rows}=ctx; if(!m.unidades||!m.unidades.length) return;
  ctx.newPage(); h2("Tabela de vendas");
  const U=m.unidades.slice().sort((a,b)=>a.torre-b.torre||a.andar-b.andar||(+a.final)-(+b.final)), base=U.reduce((s,u)=>s+u.base,0), sols=U.filter(u=>u.sol).map(u=>u.sol.media), V=S.venda;
  rows([["VGV residencial", V.modo==="unidade"? "soma da tabela por unidade" : "preço médio do mix"],["Soma da tabela", mi(m.unidadesTot)],["Preço médio do mix", mi(base)],["Diferença", vdPct(base? m.unidadesTot/base-1 : 0)],
    ["Sol médio nas fachadas", sols.length? nf(sols.reduce((a,b)=>a+b,0)/sols.length,1)+" h/dia" : "-"],
    ["Prêmios", `andar ${vdPct(V.andarPct)}/andar (teto ${vdPct(V.andarTeto)}) · sol ${vdPct(V.solPct)}/h (${vdPct(V.solPiso)} a ${vdPct(V.solTeto)}) · vista até ${vdPct(V.vistaPct)}`]]);
  // planta tipo do andar mais alto, colorida pelo preço
  if(typeof planImage==="function") m.T.forEach((t,i)=>{ if(!t.plate.length) return; const L=[...new Set(U.filter(u=>u.torre===i+1&&!u.cob&&u.poly).map(u=>u.andar))]; if(!L.length) return;
    const url=withLight(()=>planImage("tipo",{tower:i, vendaCor:"preco", vendaAndar:L.at(-1)},1400,800)); ctx.img(url, (PW-2*M)*0.8, (PW-2*M)*0.8*800/1400) });
  const cols=[["Unidade",M,"l"],["Tipologia",M+24,"l"],["m²",M+66,"r"],["Orient.",M+70,"l"],["Sol inv.",M+98,"r"],["Sol méd.",M+114,"r"],["Vista",M+128,"r"],["Prêmio",M+146,"r"],["Preço",PW-M,"r"]];
  const head=()=>{ doc.setFont("helvetica","bold"); doc.setFontSize(7.5); cols.forEach(([t,x,a])=>doc.text(T(t),x,ctx.y(),{align:a==="r"?"right":"left"})); doc.setDrawColor(120); doc.setLineWidth(0.2); doc.line(M,ctx.y()+1.2,PW-M,ctx.y()+1.2); ctx.setY(ctx.y()+5) };
  if(ctx.y()>250){ ctx.newPage() } head(); doc.setFont("helvetica","normal");
  U.forEach(u=>{ if(ctx.y()>284){ ctx.newPage(); head(); doc.setFont("helvetica","normal") }
    const v=[u.id,u.tipologia,nf(u.area,1),vdDir(u),u.sol?nf(u.sol.inverno,1):"-",u.sol?nf(u.sol.media,1):"-",u.vista==null?"-":nf(u.vista,2),vdPct(u.premios.total),brl(u.preco)];
    doc.setFontSize(7.5); cols.forEach(([,x,a],i)=>doc.text(T(v[i]),x,ctx.y(),{align:a==="r"?"right":"left"})); ctx.setY(ctx.y()+3.9) });
  doc.setFont("helvetica","bold"); doc.text(T(`${U.length} unidades`),M,ctx.y()+1); doc.text(T(brl(m.unidadesTot)),PW-M,ctx.y()+1,{align:"right"}); ctx.setY(ctx.y()+6);
});
