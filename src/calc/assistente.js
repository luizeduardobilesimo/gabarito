/* ================= assistente "Novo estudo" — parte pura (UX v3 §3.1 e §3.2) =================
   Sem DOM: roda na página, no Worker e nos testes (tests/assistente.test.js). A tela fica em src/ui/assistente.js.

   assEstado(base, resp) → estado NOVO (nunca muda `base`), a partir de clone(base || DEF):
     resp = {
       nome,                                         nome do estudo ("" → "Novo estudo")
       lote:   { modo:"ret"|"coord"|"mapa"|"depois", frente, fundo, texto },
                 ret = retângulo frente × fundo (como ACT.rect) · coord = KML/GeoJSON/"lat, lon" por linha (lote posicionado, geo=true)
                 mapa/depois = o lote do exemplo fica como provisório (o checklist continua pedindo o lote)
       regras: { id, nome, caMax, hMax, toTorre, recFrente, ia },
                 id = registro de cidadesLista() (cidadeAplicar marca S.regrasRef) · "" = sem cidade (DEF.regras, "regras a conferir")
                 nome = cidade digitada ("Outra") · os 4 números, quando vêm, valem por cima da cidade · ia = ler a lei depois (só marca)
       produto:{ padrao:"compacto"|"familia"|"alto", preco (R$/m² médio), terreno (R$, opcional) }
     }
     O mix vem do preset do otimizador (MIX_PRESETS/presetMix) e cada tipologia recebe preço = preço médio × pf do preset.
     Sem preço do terreno, fin.terreno fica 0 e a tela o estima depois do otimizador (assTerrenoEstimado).
     S.guia.conf (flags de interface do checklist, src/ui/progresso.js) recebe o que o assistente confirmou.
   assEhExemplo(st) → true quando é o estudo de exemplo intocado: nome = DEF.nome E contorno = DEF.lote.pts (sem flag em S). */

const ASS_N0 = { compacto:6, familia:5, alto:2 };            // unidades por andar de partida (o otimizador varia)
const ASS_VC = { compacto:3.3, familia:3.0, alto:3.6 };       // preço ÷ (CUB × fator) para a sugestão de preço
const ASS_COB = { compacto:null, familia:{area:140}, alto:{area:260} };
const ASS_TERRENO_PCT = 0.12;                                 // terreno estimado = 12% do VGV (abaixo da meta "ok" de 15%)

/** número digitado em formato brasileiro ("12.000", "R$ 5.000.000", "12,5", "12000") → número ou null */
function assNum(v){
  if(v==null) return null; if(typeof v==="number") return isFinite(v)? v : null;
  let s=String(v).replace(/[^\d,.\-]/g,""); if(!s) return null;
  if(s.includes(",")) s=s.replace(/\./g,"").replace(",",".");
  else if(/^\d{1,3}(\.\d{3})+$/.test(s)) s=s.replace(/\./g,"");
  const n=+s; return isFinite(n)? n : null;
}
/** sugestão de preço médio (R$/m² privativo) pelo padrão: CUB × fator × V/C de referência, de 500 em 500 */
function assPrecoSugerido(st, padrao){
  const F=(st&&st.fin)||DEF.fin, vc=ASS_VC[padrao]||ASS_VC.familia;
  return Math.round((+F.cub||3159)*(+F.fator||1.2)*vc/500)*500;
}
function assTerrenoEstimado(vgv){ return Math.max(0, Math.round((+vgv||0)*ASS_TERRENO_PCT/10000)*10000) }
/** descrição curta do preset ("2 dorm. e 3 dorm. · 64–88 m²") */
function assPresetDesc(k){
  const p=MIX_PRESETS[k]; if(!p || !p.tips) return "";
  const a=p.tips.map(t=>t.area); return `${p.tips.map(t=>t.nome).join(" e ")} · ${Math.min(...a)}–${Math.max(...a)} m²`;
}
/** lote a partir de texto colado (KML, GeoJSON lon/lat ou UTM, "lat, lon" por linha) → {pts, lat, lon, area} | {erro} */
function assLoteCoords(raw, ref){
  raw=String(raw||"").trim(); if(!raw) return {erro:"Cole as coordenadas do lote."};
  let pares=[];
  if(/^[\[{]/.test(raw)){ const r=geoLerGeoJSON(raw,{lonRef:ref&&ref.lon, latRef:ref&&ref.lat}); if(r.erro) return {erro:r.erro}; pares=r.pares }
  else { const kml=raw.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
    if(kml) kml[1].trim().split(/\s+/).forEach(t=>{ const [lon,lat]=t.split(",").map(Number); if(isFinite(lat)&&isFinite(lon)) pares.push([lat,lon]) });
    else raw.split(/\n/).forEach(l=>{ const n=l.match(/-?\d+(?:\.\d+)?/g); if(n&&n.length>=2) pares.push([+n[0],+n[1]]) }) }
  if(pares.some(([a,b])=>Math.abs(a)>90||Math.abs(b)>180)) return {erro:"Coordenadas fora do intervalo de latitude e longitude."};
  const lp=pares.length>=3? geoLoteDePares(pares) : null;
  if(!lp || !(lp.area>1)) return {erro:"Preciso de pelo menos 3 pontos formando um lote."};
  return lp;
}
const assRet = (f,p)=>[[0,0],[f,0],[f,p],[0,p]];

function assEstado(base, resp){
  const st=clone(base||DEF), r=resp||{}, L=r.lote||{}, R=r.regras||{}, P=r.produto||{};
  st.nome = String(r.nome||"").trim() || "Novo estudo";
  st.guia = { ...(st.guia||{}), conf:{ regras:false, preco:false, custo:false } };
  // ---- lote ----
  const lt=st.lote, d=DEF.lote;
  lt.front=[0]; lt.principal=0; lt.ladoVei=null; lt.desnivel=0; lt.norte=0;
  if(L.modo==="ret"){
    const f=Math.max(1, assNum(L.frente)||20), p=Math.max(1, assNum(L.fundo)||40);
    lt.pts=assRet(f,p); lt.geo=false; lt.lat=d.lat; lt.lon=d.lon;
  } else if(L.modo==="coord"){
    const lp=assLoteCoords(L.texto, {lat:lt.lat, lon:lt.lon});
    if(lp.erro){ lt.pts=clone(d.pts); lt.geo=false }
    else { lt.pts=lp.pts; lt.lat=lp.lat; lt.lon=lp.lon; lt.geo=true }
  } else { lt.pts=clone(d.pts); lt.geo=false; lt.lat=d.lat; lt.lon=d.lon }   // mapa / desenhar depois: provisório
  if(G.sArea(lt.pts)<0) lt.pts=lt.pts.slice().reverse();
  lt.rec=lt.pts.map(()=>({}));
  st.entorno=[];
  // ---- regras ----
  st.regras=clone(DEF.regras); st.regrasRef={ id:"", origem:"", lei:"", data:"", ilustrativo:false };
  if(R.id && typeof cidadeAplicar==="function") cidadeAplicar(st, R.id);
  const num=(k,v,min)=>{ const x=assNum(v); if(x!=null && x>=min) st.regras[k]=x };
  num("caMax", R.caMax, 0.1); num("hMax", R.hMax, 3); num("toTorre", R.toTorre, 0.01); num("recFrente", R.recFrente, 0);
  if(st.regras.toTorre>1) st.regras.toTorre/=100;                     // "50" digitado como porcentagem
  st.regras.toTorre=Math.min(1, st.regras.toTorre); st.regras.toEmb=Math.max(st.regras.toEmb, st.regras.toTorre);
  st.regras.caBas=Math.min(st.regras.caBas, st.regras.caMax);
  if(!R.id && R.nome && String(R.nome).trim()){ st.regras.cidade=String(R.nome).trim(); st.guia.conf.regras=true }
  // ---- produto ----
  const pk = ASS_N0[P.padrao]!=null? P.padrao : "familia", pr=MIX_PRESETS[pk];
  const pm = assNum(P.preco) || assPrecoSugerido(st, pk);
  st.produto.mix = presetMix(st, pk, ASS_N0[pk]).map(u=>{ const t=pr.tips.find(x=>x.nome===u.nome)||{pf:1}; return {...u, preco:Math.round(pm*t.pf/50)*50} });
  st.produto.torres=[{pav:8}];
  const cb=ASS_COB[pk]; st.produto.cob = cb? { ...st.produto.cob, on:true, qtd:2, area:cb.area, preco:Math.round(pm*1.12/50)*50 } : { ...st.produto.cob, on:false };
  st.blocos && (st.blocos.modo="auto");
  if(assNum(P.preco)) st.guia.conf.preco=true;
  // ---- terreno ----
  const tr=assNum(P.terreno);
  st.fin.terreno = tr>0? Math.round(tr) : 0; st.fin.permuta=0; st.fin.permutaFin=0;
  if(tr>0) st.guia.conf.custo=true;
  return st;
}
/** o estudo é o exemplo que vem com o app (nome e contorno do DEF) */
function assEhExemplo(st){
  return !!st && st.nome===DEF.nome && !!st.lote && JSON.stringify(st.lote.pts)===JSON.stringify(DEF.lote.pts);
}
