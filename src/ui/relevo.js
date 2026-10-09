/* ================= relevo: leitura automática da inclinação do terreno (Fase B, item 2) =================
   relevoBlocoHTML() → bloco "Relevo do local" dentro do card Topografia (src/ui/topografia.js, etapa Terreno)
   Busca os tiles Terrarium da AWS (z14, ~30 m, sem chave, com CORS), ajusta um plano em volta do lote (cálculo em src/calc/relevo.js)
   e mostra o resultado em uma linha. Reserva: Open-Meteo (90 m, só uso não comercial). Cotas dos cantos editáveis corrigem o plano.
   Aplicar: "Usar na topografia" (S.topo.on com pontos sobre o plano) ou "Só como desnível" (S.lote.desnivel).
   Exige S.lote.geo (lote posicionado por Mapa, Coordenadas ou GeoJSON): sem isso a busca cairia na latitude/longitude padrão.
   Fora do navegador comum (artifact do claude.ai) as buscas externas são bloqueadas: a mensagem diz isso e as cotas dos cantos seguem valendo. */
extendDEF("relevo", { fonte:"terrarium", janela:160, quando:"", origem:"", plano:null, planos:[], conf:null, cantos:[], aplicado:"", sig:"" });
const RELEVO_URL = (z,x,y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
const REL = { tiles:{}, ordem:[], busy:false, msg:"", erro:false };
const RELEVO_SEMGEO = "Posicione o lote no mapa (Terreno › Mapa ou Coordenadas)";
const relevoNomeFonte = f => f==="openmeteo" ? "Open-Meteo" : "Terrarium";

/* ---------------- estado derivado ---------------- */
function relevoGarante(){ const R=S.relevo, n=S.lote.pts.length; if(!Array.isArray(R.cantos) || R.cantos.length!==n) R.cantos=S.lote.pts.map((_,i)=> Array.isArray(R.cantos)&&R.cantos.length===n? R.cantos[i] : null) }
/* plano em uso = modelo digital (se houver) corrigido pelas cotas informadas dos cantos */
function relevoEf(){
  relevoGarante(); const R=S.relevo, ef=relevoPlanoEfetivo(S.lote.pts, R.cantos, R.plano, {norte:S.lote.norte}); if(!ef) return null;
  const info = ef.nInformados>=3;
  return { ...ef, info, conf: info? {nivel:"alta", motivo:"cotas informadas", informado:true} : R.conf };
}
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
  else acoes=`<button class="btn sm${R.aplicado==="topo"&&R.sig===relevoSig(ef)?"":" pri"}" data-act="relevoUsa">Usar na topografia</button><button class="btn sm" data-act="relevoDesn" title="Projeta a inclinação entre a frente e os fundos (modo simples)">Só como desnível</button><button class="btn sm ghost" data-act="relevoLimpa">Limpar</button>`;
  return `<div class="row sb" style="flex-wrap:nowrap;align-items:flex-start"><span style="font-size:13px;color:${cor}"${dica}><b>${esc(relevoLinha(ef))}</b></span>${INFO("Inclinação")}</div>
    <div class="fsub">${esc(origem)} ${aplic}</div><div class="row">${acoes}</div>`;
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
    GRP("Janela de busca"+INFO("Raio do trecho em volta do lote usado no ajuste do plano. A confiança compara as três janelas; a escolhida vira o resultado.")) +
    SEG("relevo.janela", jan.map(j=>[j,j+" m"]), {full:true,label:"Janela de busca",fx:"relevoJanela"}) +
    GRP("Cotas dos cantos"+INFO("Se você tem levantamento ou leu as altitudes no Google Earth, digite a cota de cada canto: o plano é recalculado. Em branco vale a estimativa do modelo (número cinza). Precisa de 3 cantos para valer sozinha.")) +
    KV(relevoCantosHTML()) +
    `<div class="row"><button class="btn sm ghost" data-act="relevoLimpaCantos">Limpar cotas informadas</button></div>`,
    {key:"relevo", label:"Mais opções"});
  return `<div class="relevo" id="relevoBox" style="margin-bottom:14px">
    <div class="row"><button class="btn sm${tem?"":" pri"}" id="relevoBtn" data-act="relevoBusca" ${geo?"":'disabled aria-disabled="true"'}>Buscar relevo do local</button>${INFO("Relevo")}</div>
    <p class="note" id="relevoMsg" ${msg?"":"hidden"} style="${REL.erro?"color:var(--warn)":""}">${aviso? esc(msg) : msg}</p>
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
    relevoMsg(""); REL.busy=false; renderTab(); if(window._last) redraw2d();
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

/* ---------------- ações ---------------- */
function relevoFonteTxt(ef){ return ef.info ? "Cotas dos cantos (plano ajustado)" : `${S.relevo.origem||relevoNomeFonte(S.relevo.fonte)}${ef.nInformados? " + cotas informadas":""} (plano ajustado)` }
Object.assign(ACT, {
  relevoBusca: ()=>relevoBusca(S.relevo.fonte),
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
  relevoLimpa: ()=>{ const R=S.relevo; R.plano=null; R.planos=[]; R.conf=null; R.cantos=S.lote.pts.map(()=>null); R.aplicado=""; R.sig=""; R.quando=""; R.origem=""; relevoMsg(""); renderTab(); redraw2d() },
  relevoLimpaCantos: ()=>{ S.relevo.cantos=S.lote.pts.map(()=>null); renderTab(); redraw2d() },
});
FX.relevoFonte = ()=>{ const j=RELEVO_JANELAS[S.relevo.fonte]; if(!j.includes(+S.relevo.janela)) S.relevo.janela=j[1]; save(); relevoReescolhe() };
FX.relevoJanela = ()=>{ save(); relevoReescolhe() };
FX.relevoCanto = ()=>{ save(); relevoVivo(); if(window._last) redraw2d() };

/* ---------------- 2D: seta de descida e % na implantação ---------------- */
HOOK.draw2d.push((g, c)=>{
  if(c.mode!=="impl" || !S.relevo || !S.lote.pts.length) return;
  const R=S.relevo; if(!R.plano && !(R.cantos||[]).some(v=>v!=null)) return;
  const ef=relevoEf(); if(!ef) return; const pl=ef.plano, nivel=ef.conf&&ef.conf.nivel, L=S.lote.pts, {W,H,w2s}=c, ink=css("--ink"), acc=css("--accent");
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
