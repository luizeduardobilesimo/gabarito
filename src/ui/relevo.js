/* ================= relevo: leitura automática da inclinação do terreno (Fase B, item 2) =================
   relevoBlocoHTML() → bloco "Relevo do local" dentro da seção Terreno inclinado (src/ui/topografia.js, etapa Terreno)
   Busca os tiles Terrarium da AWS (z14, ~30 m, sem chave, com CORS), ajusta um plano em volta do lote (cálculo em src/calc/relevo.js)
   e mostra o resultado em uma linha. Reserva: Open-Meteo (90 m, só uso não comercial). Cotas dos cantos editáveis corrigem o plano.
   Aplicar: "Usar na topografia" (S.topo.on com pontos sobre o plano) ou "Só como desnível" (S.lote.desnivel).
   Exige S.lote.geo (lote posicionado por Mapa, Coordenadas ou GeoJSON): sem isso a busca cairia na latitude/longitude padrão.
   Fora do navegador comum (artifact do claude.ai) as buscas externas são bloqueadas: a mensagem diz isso e as cotas dos cantos seguem valendo. */
extendDEF("relevo", { fonte:"terrarium", janela:160, quando:"", origem:"", plano:null, planos:[], conf:null, cantos:[], aplicado:"", sig:"", previa3d:true, arquivo:"" });
const RELEVO_URL = (z,x,y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
const REL = { tiles:{}, ordem:[], busy:false, msg:"", erro:false };
const RELEVO_SEMGEO = "Posicione o lote no mapa (Terreno › Mapa ou Coordenadas)";
const relevoNomeFonte = f => f==="openmeteo" ? "Open-Meteo" : f==="anadem" ? "ANADEM" : "Terrarium";

/* ---------------- estado derivado ---------------- */
function relevoGarante(){ const R=S.relevo, n=S.lote.pts.length; if(!Array.isArray(R.cantos) || R.cantos.length!==n) R.cantos=S.lote.pts.map((_,i)=> Array.isArray(R.cantos)&&R.cantos.length===n? R.cantos[i] : null) }
/* plano em uso = modelo digital (se houver) corrigido pelas cotas informadas dos cantos */
function relevoEf(){ relevoGarante(); return relevoEfetivoDe(S) }   // regra pura em src/calc/relevo.js
const relevoSig = ef => ef? [ef.plano.gx, ef.plano.gy, ef.plano.z0].map(v=>+v.toFixed(5)).join("|") : "";
function relevoLinha(ef){
  if(!ef) return "";
  if(ef.info) return relevoResumo(ef.plano, null) + " · cotas informadas";
  const t=relevoResumo(ef.plano, ef.conf);
  return ef.nInformados? t+` · ${ef.nInformados} cota${ef.nInformados>1?"s":""} informada${ef.nInformados>1?"s":""}` : t;
}

/* ---------------- bloco do card ---------------- */
function relevoResHTML(){
  const R=S.relevo, ef=relevoEf(); if(!ef) return "";
  const nivel=ef.conf&&ef.conf.nivel, cor= nivel==="baixa"? "var(--warn)" : "var(--ink)";
  const quando = R.quando? R.quando.split("-").reverse().join("/") : "";
  const origem = ef.info ? "cotas dos cantos" : `${R.origem||relevoNomeFonte(R.fonte)}${R.plano&&R.plano.janela? " · janela "+R.plano.janela+" m":""}${quando? " · "+quando : ""}`;
  const aplic = R.aplicado ? (R.sig===relevoSig(ef) ? `<span class="pill ok">${R.aplicado==="topo"?"aplicado na topografia":"aplicado como desnível"}</span>` : `<span class="pill warn">mudou desde que foi aplicado</span>`) : "";
  const dica = ef.conf&&ef.conf.motivo && nivel!=="alta" && !ef.info ? ` title="${esc(ef.conf.motivo)}"` : "";
  let acoes="";
  if(nivel==="plano") acoes=`<button class="btn sm ghost" data-act="relevoLimpa">Limpar</button>`;
  else acoes=`<button class="btn sm" data-act="relevoUsa">Usar na topografia</button><button class="btn sm" data-act="relevoDesn" title="Projeta a inclinação entre a frente e os fundos (modo simples)">Só como desnível</button><button class="btn sm ghost" data-act="relevoLimpa">Limpar</button>`;
  return `<div class="row sb" style="flex-wrap:nowrap;align-items:flex-start"><span style="font-size:13px;color:${cor}"${dica}><b>${esc(relevoLinha(ef))}</b></span>${INFO("Inclinação")}</div>
    <div class="fsub">${esc(origem)} ${aplic}</div><div class="row">${acoes}</div>${nivel!=="plano"?`<div class="row sb" style="flex-wrap:nowrap">${SW("relevo.previa3d","Plano do relevo no 3D",{fx:"relevoPrevia"})}${INFO("Mostra no 3D um plano inclinado discreto, com as curvas de nível e a seta da descida, só como prévia do terreno. Com a topografia ligada, o terreno real aparece no lugar.","o plano no 3D")}</div>`:""}`;
}
function relevoCantosHTML(){
  relevoGarante(); const R=S.relevo, L=S.lote.pts, base=R.plano, est=base? relevoCotasDosCantos(base, L, S.lote.norte) : null;
  return L.map((_,i)=>{ const v=R.cantos[i], ph= est? nf(est[i],1) : "—";
    return `<div class="fld"><label class="fl" for="rc${i}">Canto ${i+1}</label><div class="inp"><input id="rc${i}" type="number" inputmode="decimal" step="0.1" data-p="relevo.cantos.${i}" data-null="1" data-fx="relevoCanto" value="${v==null?"":+(+v).toFixed(3)}" placeholder="${ph}" aria-label="Cota do canto ${i+1}"><em>m</em></div></div>` }).join("");
}
function relevoBlocoHTML(){
  relevoGarante(); const R=S.relevo, geo=!!(S.lote&&S.lote.geo), jan=RELEVO_JANELAS[R.fonte]||RELEVO_JANELAS.terrarium, tem=!!relevoEf();
  const msg = REL.msg || (geo? "" : RELEVO_SEMGEO);
  const aviso = !geo && !REL.msg;
  const adv = ADV(
    GRP("Fonte"+INFO("Terrarium: AWS Terrain Tiles (SRTM, ~30 m), sem chave. Open-Meteo: ~90 m, licença CC-BY só para uso NÃO comercial; fica como reserva quando a primeira não responde.")) +
    SEG("relevo.fonte",[["terrarium","Terrarium"],["openmeteo","Open-Meteo"]],{full:true,label:"Fonte",fx:"relevoFonte"}) +
    `<div class="row"><label class="btn sm" for="relevoTif" tabindex="0">Importar GeoTIFF (ANADEM)</label><input type="file" id="relevoTif" accept=".tif,.tiff,image/tiff" hidden>${INFO("ANADEM")}</div>` +
    (R.fonte==="anadem" && R.arquivo ? `<div class="fsub">Arquivo em uso: ${esc(R.arquivo)}</div>` : "") +
    GRP("Janela de busca"+INFO("Raio do trecho em volta do lote usado no ajuste do plano. A confiança compara as três janelas; a escolhida vira o resultado.")) +
    SEG("relevo.janela", jan.map(j=>[j,j+" m"]), {full:true,label:"Janela de busca",fx:"relevoJanela"}) +
    GRP("Cotas dos cantos"+INFO("Se você tem levantamento ou leu as altitudes no Google Earth, digite a cota de cada canto: o plano é recalculado. Em branco vale a estimativa do modelo (número cinza). Precisa de 3 cantos para valer sozinha.")) +
    KV(relevoCantosHTML()) +
    `<div class="row"><button class="btn sm ghost" data-act="relevoLimpaCantos">Limpar cotas informadas</button></div>`,
    {key:"relevo", label:"Mais opções"});
  return `<div class="relevo" id="relevoBox" style="margin-bottom:14px">
    <div class="row"><button class="btn sm" id="relevoBtn" data-act="relevoBusca" ${geo?"":'disabled aria-disabled="true"'}>Buscar relevo do local</button>${INFO("Relevo")}</div>
    <p class="note" id="relevoMsg" ${msg?"":"hidden"} style="${REL.erro?"color:var(--warn-t)":""}">${aviso? esc(msg) : msg}</p>
    <div id="relevoRes">${relevoResHTML()}</div>${adv}</div>`;
}
function relevoVivo(){
  const e=document.getElementById("relevoRes"); if(e){ const h=relevoResHTML(); if(e.innerHTML!==h) e.innerHTML=h }
  const est= S.relevo.plano? relevoCotasDosCantos(S.relevo.plano, S.lote.pts, S.lote.norte) : null;
  S.lote.pts.forEach((_,i)=>{ const inp=document.getElementById("rc"+i); if(inp) inp.placeholder= est? nf(est[i],1) : "—" });
}
function relevoMsg(t, erro){ REL.msg=t||""; REL.erro=!!erro; const e=document.getElementById("relevoMsg"); if(e){ e.hidden=!t; e.innerHTML=t||""; e.style.color= erro? "var(--warn)" : "" } }

/* ---------------- busca ---------------- */
function relevoGuardaTile(k, t){ REL.tiles[k]=t; REL.ordem.push(k); while(REL.ordem.length>48) delete REL.tiles[REL.ordem.shift()] }
async function relevoTile(t, sinal){
  if(REL.tiles[t.k]) return REL.tiles[t.k];
  const r=await fetch(RELEVO_URL(t.z,t.x,t.y), {signal:sinal, mode:"cors"});
  if(!r.ok) throw new Error("HTTP "+r.status);
  const blob=await r.blob(); let w,h,rgba;
  const cv=document.createElement("canvas");
  if(typeof createImageBitmap==="function"){ const bmp=await createImageBitmap(blob,{colorSpaceConversion:"none",premultiplyAlpha:"none"}); w=bmp.width; h=bmp.height; cv.width=w; cv.height=h; cv.getContext("2d",{willReadFrequently:true}).drawImage(bmp,0,0); if(bmp.close) bmp.close() }
  else { const url=URL.createObjectURL(blob), img=new Image(); img.src=url; await img.decode(); w=img.naturalWidth; h=img.naturalHeight; cv.width=w; cv.height=h; cv.getContext("2d",{willReadFrequently:true}).drawImage(img,0,0); URL.revokeObjectURL(url) }
  rgba=cv.getContext("2d").getImageData(0,0,w,h).data;
  const tile={z:t.z,x:t.x,y:t.y,w,h,data:relevoDecodifica(rgba,w,h)}; relevoGuardaTile(t.k, tile); return tile;
}
/* centro do lote (ENU), referência e janelas */
function relevoGeo(){
  const L=S.lote.pts, ref=geoRef(S.lote.lat, S.lote.lon), c=relevoParaENU(...relevoCentroide(L), S.lote.norte), ll=geoDeLocal(c[0],c[1],ref);
  return { ref, c, lat:ll[0], lon:ll[1] };
}
async function relevoBuscaTerrarium(sinal){
  const g=relevoGeo(), jan=RELEVO_JANELAS.terrarium, J=Math.max(...jan), tiles={};
  const lista=relevoTilesPara(g.lat, g.lon, J*0.75+40, RELEVO_Z);
  await Promise.all(lista.map(async t=>{ tiles[t.k]=await relevoTile(t, sinal) }));
  const am=relevoGrade(tiles, g.ref, relevoPontosGrade(g.c, J, 10), RELEVO_Z);
  if(am.length<60) throw new Error("sem dados");
  return { ...relevoAnalisa(am, {centro:g.c, janelas:jan, principal:S.relevo.janela, pixel:30}), origem:"Terrarium" };
}
async function relevoBuscaOpenMeteo(sinal){
  const g=relevoGeo(), jan=RELEVO_JANELAS.openmeteo, J=Math.max(...jan), pts=relevoPontosGrade(g.c, J, 40);
  const r=await fetch(relevoOpenMeteoUrl(g.ref, pts), {signal:sinal, mode:"cors"}); if(!r.ok) throw new Error("HTTP "+r.status);
  const am=relevoOpenMeteoLer(await r.json(), pts); if(am.length<40) throw new Error("sem dados");
  return { ...relevoAnalisa(am, {centro:g.c, janelas:jan, principal:S.relevo.janela, pixel:90}), origem:"Open-Meteo" };
}
function relevoErroHTML(e, fonte){
  const sem = e && (e.name==="AbortError" || /Failed to fetch|NetworkError|Load failed|fetch/i.test(String(e.message||e)) || e.name==="TypeError");
  if(e && e.message==="sem dados") return "O modelo de elevação não tem dados neste ponto. Digite as cotas dos cantos em Mais opções.";
  const alt = fonte==="terrarium" ? ` <button class="btn sm" data-act="relevoOM">Tentar Open-Meteo</button>` : "";
  return (sem? "Sem acesso ao serviço de relevo: internet fora ou buscas externas bloqueadas (como no artifact do claude.ai). Use o app em http://localhost:5173 ou digite as cotas dos cantos em Mais opções." : `O serviço de relevo não respondeu (${esc(String(e&&e.message||e))}). Tente de novo ou digite as cotas dos cantos em Mais opções.`) + alt;
}
async function relevoBusca(fonte){
  if(REL.busy) return;
  if(!S.lote.geo){ relevoMsg(RELEVO_SEMGEO, false); toast(RELEVO_SEMGEO); return }
  if(!isFinite(S.lote.lat) || !isFinite(S.lote.lon)){ relevoMsg("O lote não tem latitude e longitude.", true); return }
  REL.busy=true; const btn=document.getElementById("relevoBtn"); if(btn){ btn.disabled=true; btn.textContent="Buscando…" }
  relevoMsg("Buscando o relevo…", false);
  const ctl=new AbortController(), to=setTimeout(()=>ctl.abort(), 20000);
  try{
    const r= fonte==="openmeteo" ? await relevoBuscaOpenMeteo(ctl.signal) : await relevoBuscaTerrarium(ctl.signal);
    const R=S.relevo; R.fonte=fonte; R.plano=r.plano; R.planos=r.planos; R.conf=r.conf; R.origem=r.origem; R.cantos=S.lote.pts.map(()=>null); R.aplicado=""; R.sig="";
    R.quando=new Date().toISOString().slice(0,10); R.janela=r.plano.janela;
    relevoMsg(""); REL.busy=false; renderTab(); relevoRedesenha();
  }catch(e){
    REL.busy=false; relevoMsg(relevoErroHTML(e, fonte), true);
    const b=document.getElementById("relevoBtn"); if(b){ b.disabled=false; b.textContent="Buscar relevo do local" }
  }finally{ clearTimeout(to) }
}
/* troca de janela/fonte: usa os planos já calculados (sem nova busca) */
function relevoReescolhe(){
  const R=S.relevo, p=(R.planos||[]).find(q=>q.janela===+R.janela); if(!p || relevoNomeFonte(R.fonte)!==R.origem) return;
  R.plano=p; R.conf=relevoConfianca(R.planos, p.janela);
}

/* ---------------- GeoTIFF (ANADEM): arquivo enviado pelo usuário ---------------- */
const GEOTIFF_URL = "https://cdn.jsdelivr.net/npm/geotiff@2.1.3/dist-browser/geotiff.js";
async function relevoLerTifLib(buf, g, J){
  await loadScript(GEOTIFF_URL);
  if(typeof GeoTIFF==="undefined") throw new Error("a biblioteca geotiff não carregou (sem internet?)");
  const tiff=await GeoTIFF.fromArrayBuffer(buf), img=await tiff.getImage(), k=img.getGeoKeys()||{}, bb=img.getBoundingBox(), W=img.getWidth(), H=img.getHeight();
  let crs; if(k.GTModelTypeGeoKey===2 || (k.GeographicTypeGeoKey && !k.ProjectedCSTypeGeoKey) || (!k.ProjectedCSTypeGeoKey && Math.abs(bb[0])<=360)) crs={tipo:"geo"};
  else { const z=geoZonaDoCrs("EPSG:"+k.ProjectedCSTypeGeoKey); if(!z) throw new Error("sistema de coordenadas não suportado (use lat/lon ou UTM)"); crs={tipo:"utm", zona:z.zona, sul:z.sul} }
  const cab={w:W, h:H, origem:[bb[0], bb[3]], res:[(bb[2]-bb[0])/W, (bb[3]-bb[1])/H], crs}, jan=gtJanelaDoLote(cab, g.ref, g.c, J);
  const c0=Math.max(0,Math.floor(jan[0])), r0=Math.max(0,Math.floor(jan[1])), c1=Math.min(W,Math.ceil(jan[2])), r1=Math.min(H,Math.ceil(jan[3]));
  if(c1-c0<2 || r1-r0<2) throw new Error("fora da área do arquivo");
  const ras=await img.readRasters({window:[c0,r0,c1,r1], samples:[0]}), nd=img.getGDALNoData(), src=ras[0], data=new Float32Array(src.length);
  for(let i=0;i<src.length;i++){ const v=src[i]; data[i]= (nd!=null && v===nd) || !isFinite(v) || v<-1e30 || v>1e30 ? NaN : v }
  return { ...cab, data, w:c1-c0, h:r1-r0, c0, r0 };
}
async function relevoLerTif(file, g, J){
  const buf=await file.arrayBuffer(); let arq=null;
  try{ arq=gtAbrir(buf) }catch(e){ if(!/biblioteca|BigTIFF/i.test(String(e&&e.message))) throw e }
  if(!arq) return relevoLerTifLib(buf, g, J);
  const jan=gtJanelaDoLote(arq, g.ref, g.c, J), cr=arq.ler(jan[0], jan[1], jan[2], jan[3]);
  if(cr.w<2 || cr.h<2) throw new Error("fora da área do arquivo");
  return { ...arq, ...cr };
}
async function relevoImportaTif(file){
  if(REL.busy || !file) return;
  if(!S.lote.geo){ relevoMsg(RELEVO_SEMGEO, false); toast(RELEVO_SEMGEO); return }
  REL.busy=true; relevoMsg("Lendo o arquivo…", false);
  try{
    const g=relevoGeo(), J=Math.max(...RELEVO_JANELAS.anadem), r=await relevoLerTif(file, g, J), res=relevoDeRaster(r, g.ref, g.c, {principal:S.relevo.janela});
    const R=S.relevo; R.fonte="anadem"; R.plano=res.plano; R.planos=res.planos; R.conf=res.conf; R.origem="ANADEM"; R.arquivo=file.name; R.cantos=S.lote.pts.map(()=>null); R.aplicado=""; R.sig="";
    R.quando=new Date().toISOString().slice(0,10); R.janela=res.plano.janela;
    REL.busy=false; relevoMsg(""); renderTab(); relevoRedesenha(); toast("Relevo lido do arquivo (ANADEM)");
  }catch(e){
    REL.busy=false; const t=String(e&&e.message||e);
    relevoMsg(`Não consegui usar o arquivo: ${esc(t)}.${/fora da área|cobre só parte/.test(t)? " Baixe o ladrilho que cobre o lote (ANADEM, MapBiomas / ANA) e importe de novo." : ""}`, true);
  }
}
function relevoAfter(){
  const f=document.getElementById("relevoTif"); if(!f) return;
  const lb=document.querySelector('label[for="relevoTif"]'); if(lb) lb.onkeydown=e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); f.click() } };
  f.onchange=()=>{ const file=f.files[0]; f.value=""; if(file) relevoImportaTif(file) };
}

/* ---------------- ações ---------------- */
function relevoFonteTxt(ef){ return ef.info ? "Cotas dos cantos (plano ajustado)" : `${S.relevo.origem||relevoNomeFonte(S.relevo.fonte)}${ef.nInformados? " + cotas informadas":""} (plano ajustado)` }
Object.assign(ACT, {
  relevoBusca: ()=>relevoBusca(S.relevo.fonte==="openmeteo"? "openmeteo" : "terrarium"),
  relevoOM: ()=>{ S.relevo.fonte="openmeteo"; S.relevo.janela=RELEVO_JANELAS.openmeteo[1]; relevoBusca("openmeteo") },
  relevoUsa: b=>{
    const ef=relevoEf(); if(!ef) return; const T=S.topo;
    if(T.pts.length && !/plano ajustado|exemplo/.test(T.fonte||"") && !b.dataset.arm){ b.dataset.arm="1"; b.textContent="Confirmar: troca o levantamento"; setTimeout(()=>{ if(b.isConnected){ delete b.dataset.arm; b.textContent="Usar na topografia" } }, 4000); return }
    T.pts=relevoParaTopo(ef.plano, S.lote.pts, {norte:S.lote.norte}); T.on=true; T.fonte=relevoFonteTxt(ef);
    S.relevo.aplicado="topo"; S.relevo.sig=relevoSig(ef); renderTab(); toast("Relevo aplicado à topografia — veja o corte e o aterro e o 3D");
  },
  relevoDesn: ()=>{
    const ef=relevoEf(); if(!ef) return; const d=relevoParaDesnivel(ef.plano, S.lote.pts, frontDir(S), {norte:S.lote.norte});
    S.lote.desnivel=d; const nossa=S.topo.on && /plano ajustado/.test(S.topo.fonte||""); if(nossa) S.topo.on=false;
    S.relevo.aplicado="desnivel"; S.relevo.sig=relevoSig(ef); renderTab();
    toast(`Desnível ${d>=0?"":"−"}${nf(Math.abs(d),1)} m entre a frente e os fundos${S.topo.on? " — só vale com a topografia desligada" : ""}`);
  },
  relevoLimpa: ()=>{ const R=S.relevo; R.plano=null; R.planos=[]; R.conf=null; R.cantos=S.lote.pts.map(()=>null); R.aplicado=""; R.sig=""; R.quando=""; R.origem=""; R.arquivo=""; relevoMsg(""); renderTab(); relevoRedesenha() },
  relevoLimpaCantos: ()=>{ S.relevo.cantos=S.lote.pts.map(()=>null); renderTab(); relevoRedesenha() },
});
FX.relevoFonte = ()=>{ const j=RELEVO_JANELAS[S.relevo.fonte]; if(!j.includes(+S.relevo.janela)) S.relevo.janela=j[1]; save(); relevoReescolhe() };
FX.relevoJanela = ()=>{ save(); relevoReescolhe() };
FX.relevoCanto = ()=>{ save(); relevoVivo(); relevoRedesenha() };
FX.relevoPrevia = ()=>{ save(); relevoRedesenha() };
/* o plano entra na implantação (seta) e no 3D (prévia) */
function relevoRedesenha(){ if(!window._last) return; redraw2d(); if(typeof rebuild3d==="function") rebuild3d(window._last.m) }

/* ---------------- 2D: seta de descida e % na implantação ---------------- */
HOOK.draw2d.push((g, c)=>{
  if(c.mode!=="impl" || !S.relevo || !S.lote.pts.length) return;
  const R=S.relevo; if(!R.plano && !(R.cantos||[]).some(v=>v!=null)) return;
  const ef=relevoEf(); if(!ef) return; const pl=ef.plano, nivel=ef.conf&&ef.conf.nivel, L=S.lote.pts, {W,H,w2s}=c, ink=css("--ink"), acc=css("--d-acc");
  g.save(); g.lineCap="round"; g.lineJoin="round";
  const pill=(txt,x,y,cor)=>{ g.font="600 10.5px "+css("--f-mono"); g.textAlign="center"; g.textBaseline="middle"; const tw=g.measureText(txt).width+10; x=Math.max(tw/2+4, Math.min(W-tw/2-4, x)); y=Math.max(70, Math.min(H-12, y));
    g.globalAlpha=0.94; g.fillStyle=css("--surface"); g.fillRect(x-tw/2,y-8,tw,16); g.globalAlpha=1; g.strokeStyle=css("--line-2"); g.lineWidth=1; g.strokeRect(x-tw/2,y-8,tw,16); g.fillStyle=cor||ink; g.fillText(txt,x,y) };
  if(nivel!=="plano"){
    // fora do lote (à direita do contorno); sem espaço, no canto superior esquerdo dentro dele
    const sp=L.map(q=>w2s(q)), bx0=Math.min(...sp.map(q=>q[0])), bx1=Math.max(...sp.map(q=>q[0])), by0=Math.min(...sp.map(q=>q[1])), p0= bx1+70<W-10 ? [bx1+60, by0+70] : [bx0+40, by0+60];
    const d=relevoDeENU(-pl.gx, -pl.gy, S.lote.norte), len=Math.hypot(d[0],d[1]);
    if(len>1e-9){
      const ux=d[0]/len, uy=-d[1]/len, a=[p0[0]-ux*24, p0[1]-uy*24], b=[p0[0]+ux*24, p0[1]+uy*24], hs=8, nx=-uy, ny=ux;
      const traco=(cor,w)=>{ g.strokeStyle=cor; g.lineWidth=w; g.setLineDash(nivel==="baixa"?[5,4]:[]); g.beginPath(); g.moveTo(a[0],a[1]); g.lineTo(b[0],b[1]); g.stroke(); g.setLineDash([]);
        g.beginPath(); g.moveTo(b[0],b[1]); g.lineTo(b[0]-ux*hs+nx*hs*0.55, b[1]-uy*hs+ny*hs*0.55); g.moveTo(b[0],b[1]); g.lineTo(b[0]-ux*hs-nx*hs*0.55, b[1]-uy*hs-ny*hs*0.55); g.stroke() };
      traco(css("--surface"), 5); traco(acc, 2.2);
      const v=pl.pct<10? nf(pl.pct,1) : nf(pl.pct,0); pill(`${v}% ${relevoDirTexto(pl.azDesc)}${nivel==="baixa"?" ?":""}`, a[0]-ux*26, a[1]-uy*18, acc);
    }
  }
  if(ef.nInformados){ g.font="500 10px "+css("--f-mono"); const cen=relevoCentroide(L), pc=w2s(cen);
    L.forEach((q,i)=>{ const v=R.cantos[i]; if(v==null) return; const p=w2s(q), dx=p[0]-pc[0], dy=p[1]-pc[1], dl=Math.hypot(dx,dy)||1; pill(`C${i+1} ${nf(v,1)}`, p[0]+dx/dl*30, p[1]+dy/dl*16) }) }
  g.restore();
});

/* ---------------- 3D: plano do relevo como prévia (topografia desligada) ----------------
   Plano que passa pela cota do centro do lote, com as curvas de nível do plano (horizontais, cada uma na sua cota), a seta da
   descida e as cotas relativas nos dois cantos extremos. Discreto: translúcido, na cor de destaque; desliga em "Plano do relevo no 3D".
   Com a topografia ligada o terreno real (src/ui/topografia.js) ocupa o lugar e a prévia some. */
function relevoLegenda(txt){
  const lg=document.getElementById("legend"); if(!lg) return; let e=document.getElementById("legRelevo");
  if(!txt){ if(e) e.hidden=true; return }
  if(!e){ e=document.createElement("div"); e.id="legRelevo"; lg.appendChild(e) }
  e.hidden=false; e.innerHTML=`<i style="background:var(--d-acc);opacity:.4;border-color:var(--accent)"></i>${esc(txt)}`;
}
function relevoEtiqueta(txt, tam){
  const cv=document.createElement("canvas"); cv.width=256; cv.height=64; const g=cv.getContext("2d"), mono=css("--f-mono")||"monospace";
  g.font=`600 26px ${mono}`; g.textAlign="center"; g.textBaseline="middle"; const tw=Math.min(240, g.measureText(txt).width+28);
  g.fillStyle=css("--surface")||"#fff"; g.globalAlpha=0.92; if(g.roundRect){ g.beginPath(); g.roundRect(128-tw/2,10,tw,44,22); g.fill() } else g.fillRect(128-tw/2,10,tw,44);
  g.globalAlpha=1; g.strokeStyle=css("--d-acc")||"#2f6fed"; g.lineWidth=2; g.stroke(); g.fillStyle=css("--ink")||"#222"; g.fillText(txt,128,33);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv), transparent:true, depthTest:false, depthWrite:false})); sp.scale.set(tam,tam/4,1); sp.renderOrder=14; return sp;
}
HOOK.draw3d.push((grp, m)=>{
  const R=S.relevo; let pv=null;
  if(R && R.previa3d && m && !m.topo && typeof THREE!=="undefined") pv=relevoPrevia(S);
  relevoLegenda(pv? `Plano do relevo (prévia): ${pv.pct<10? nf(pv.pct,1) : nf(pv.pct,0)}% para ${pv.dirTxt}${pv.nivel==="baixa"?" (incerto)":""}` : "");
  if(!pv) return;
  const [x0,y0,x1,y1]=pv.rect, dz=(x,y)=>pv.g[0]*(x-pv.c[0])+pv.g[1]*(y-pv.c[1]), P=(x,y,o=0)=>new THREE.Vector3(x, dz(x,y)+o, -y);
  const acc=col3("--accent"), tam=Math.max(x1-x0, y1-y0), baixa=pv.nivel==="baixa", mat=(op,extra={})=>({color:acc, transparent:true, opacity:op, depthTest:false, depthWrite:false, ...extra});
  // plano
  const cs=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]], pos=[]; [[0,1,2],[0,2,3]].forEach(t=>t.forEach(i=>{ const v=P(cs[i][0],cs[i][1],-0.04); pos.push(v.x,v.y,v.z) }));
  const gp=new THREE.BufferGeometry(); gp.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  const plano=new THREE.Mesh(gp,new THREE.MeshBasicMaterial(mat(baixa?0.06:0.1,{side:THREE.DoubleSide}))); plano.renderOrder=11; grp.add(plano);
  const borda=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(cs.map(c=>P(c[0],c[1],-0.04))), new THREE.LineBasicMaterial(mat(baixa?0.3:0.5))); borda.renderOrder=12; grp.add(borda);
  // curvas de nível do plano (cada uma na sua cota)
  const seg=[]; pv.curvas.forEach(c=>{ seg.push(c.seg[0],c.h,-c.seg[1], c.seg[2],c.h,-c.seg[3]) });
  if(seg.length){ const gl=new THREE.BufferGeometry(); gl.setAttribute("position",new THREE.Float32BufferAttribute(seg,3)); const ln=new THREE.LineSegments(gl,new THREE.LineBasicMaterial(mat(baixa?0.28:0.5))); ln.renderOrder=12; grp.add(ln) }
  // seta da descida, sobre o plano, na faixa livre ao lado do lote (fora da torre), apontando para onde o terreno desce
  const d=pv.dir, n=[-d[1],d[0]], L=S.lote.pts, ex=q=>(q[0]-pv.c[0])*n[0]+(q[1]-pv.c[1])*n[1], le=L.map(ex), rc=cs.map(ex);
  const livre=[Math.max(...rc)-Math.max(...le), Math.min(...le)-Math.min(...rc)], offs=[Math.max(...le)+livre[0]/2, Math.min(...le)-livre[1]/2];
  // dos dois lados do lote, a faixa que cai melhor dentro da tela (a câmera atual); sem câmera, a mais larga
  let lado= livre[0]>=livre[1]? 1 : -1;
  if(typeof V3!=="undefined" && V3.cam){ try{ V3.cam.updateMatrixWorld(); const sc=sd=>{ const o=offs[sd>0?0:1], v=P(pv.c[0]+n[0]*o, pv.c[1]+n[1]*o, 0).project(V3.cam); return Math.max(Math.abs(v.x)/0.8, Math.abs(v.y)/0.7) }; lado= sc(1)<=sc(-1)? 1 : -1 }catch(e){} }
  const off=offs[lado>0?0:1], cx=pv.c[0]+n[0]*off, cy=pv.c[1]+n[1]*off, L0=Math.max(6, tam*0.13), a0=[cx-d[0]*L0*0.5, cy-d[1]*L0*0.5], a1=[cx+d[0]*L0*0.5, cy+d[1]*L0*0.5], w=Math.max(0.3, tam*0.004), hw=w*3.6, hl=L0*0.32;
  const poly=[[a0[0]+n[0]*w, a0[1]+n[1]*w],[a1[0]-d[0]*hl+n[0]*w, a1[1]-d[1]*hl+n[1]*w],[a1[0]-d[0]*hl+n[0]*hw, a1[1]-d[1]*hl+n[1]*hw],[a1[0],a1[1]],[a1[0]-d[0]*hl-n[0]*hw, a1[1]-d[1]*hl-n[1]*hw],[a1[0]-d[0]*hl-n[0]*w, a1[1]-d[1]*hl-n[1]*w],[a0[0]-n[0]*w, a0[1]-n[1]*w]];
  const tri=[0,1,6, 1,5,6, 2,3,4], ap=[]; tri.forEach(i=>{ const v=P(poly[i][0],poly[i][1],0.25); ap.push(v.x,v.y,v.z) });
  const ga=new THREE.BufferGeometry(); ga.setAttribute("position",new THREE.Float32BufferAttribute(ap,3)); const seta=new THREE.Mesh(ga,new THREE.MeshBasicMaterial(mat(baixa?0.5:0.9,{side:THREE.DoubleSide}))); seta.renderOrder=13; grp.add(seta);
  // etiqueta da inclinação ao lado da seta e cotas relativas nos cantos extremos
  const fmt=v=>(v>0.005?"+":v<-0.005?"−":"±")+nf(Math.abs(v),1)+" m";
  const e1=relevoEtiqueta(`${pv.pct<10? nf(pv.pct,1) : nf(pv.pct,0)}% ${pv.dirTxt}${baixa?" ?":""}`, tam*0.14), pe=P(cx, cy, tam*0.035); e1.position.copy(pe); grp.add(e1);
  const alto=pv.cantos.reduce((r,c)=>c[2]>r[2]?c:r), baixo=pv.cantos.reduce((r,c)=>c[2]<r[2]?c:r);
  [alto,baixo].forEach(c=>{ if(Math.abs(c[2])<0.05) return; const v=P(c[0],c[1],0), sp=relevoEtiqueta(fmt(c[2]), tam*0.11); sp.position.set(v.x, v.y+tam*0.02, v.z); grp.add(sp);
    const pole=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(v.x,0,v.z), v]), new THREE.LineBasicMaterial(mat(0.45))); pole.renderOrder=12; grp.add(pole) });
});
