/* ================= estado ================= */
const DEF = {
  v: 2,
  nome: "Estudo Rua Exemplo, 120",
  lote: { pts: [[0,0],[34,0],[36,52],[-1.5,54]], front: [0], principal: 0, rec: [{},{},{},{}], acessoPed: 0.35, acessoVei: 0.85, norte: 0, lat: -28.68, lon: -49.37, geo: false, desnivel: 0, custoTerra: 55 },
  regras: {
    cidade: "Exemplo (zona central fictícia)",
    caBas: 2, caMax: 4, outorgaRS: 350,
    toEmb: 0.8, toTorre: 0.45, permeab: 0.10, hMax: 70,
    recFrente: 4, recEmb: 0, afMin: 2.5, afDiv: 8, afTorresDiv: 4, recSub: 0,
    ncGaragem: true, ncTerreo: true, ncTipo: 0.12,
    vagasApto: 1.0, m2LojaVaga: 50, m2Vaga: 28, aptoMin: 40
  },
  produto: {
    subsolos: 2, garAcima: 0, garTerreo: 0.45, lojaTerreo: 0.2,
    peTerreo: 4.5, peGar: 3.0, pe: 3.0, efic: 0.80, atico: true, torreEixo: "long", vagasFrente: true, sacTipo: "embutida", sacProf: 1.6,
    torres: [{pav:12},{pav:8}],
    mix: [
      {nome:"2 dorm.", area:66, qtd:2, preco:14500, sac:6},
      {nome:"3 dorm.", area:92, qtd:2, preco:14000, sac:9}
    ],
    cob: { on: true, qtd: 2, area: 150, preco: 16500 },
    garTerOn: true,
    lazer: { hall: 0, itens: [
      {nome:"Salão de festas", area:90, local:"terreo"}, {nome:"Espaço gourmet", area:45, local:"terreo"}, {nome:"Academia", area:60, local:"terreo"},
      {nome:"Piscina", area:70, local:"emb", desc:true}, {nome:"Playground", area:50, local:"emb", desc:true} ] }
  },
  fin: {
    precoLoja: 12000, cub: 3159, fator: 1.20, eqGar: 0.80,
    terreno: 13500000, itbi: 0.03, permuta: 0, permutaFin: 0,
    projetos: 0.04, adm: 0.03, conting: 0.03,
    corret: 0.05, mkt: 0.02, imp: 0.04,
    prelanc: 6, obra: 30, venda: 24, vendaLanc: 0.25, entrada: 0.30,
    incc: 0.05, reaj: 0.04, correcao: true,
    finOn: false, finPct: 0.6, finTaxa: 0.115, finVendaMin: 0.30,
    tma: 0.15, margemAlvo: 0.25, custoDesc: 900, decorLazer: 1100
  },
  estudo: {
    usarLayout: true, vagaL: 2.5, vagaC: 5.0, corredor: 5.5, porModulo: 3, pilar: 0.4,
    rampaInc: 0.20, rampaL: 3.6, pcd: 0.02, idoso: 0.05,
    corrTipo: 1.6, profMin: 5.5, off: {},
    angulo: "90", garDir: "auto", garDirGraus: 0, rampa: null, nucleoPos: 0.5, nucleoLado: "B", escadaLado: "E", elevadores: 0, tipoPlanta: "auto", escTipo: "pf_duto", nEsc: 1, emerg: false, fachada: true, rampaTipo: "reta", vtipo: {}
  },
  sol: { on: false, mes: 6, dia: 21, hora: 15 },
  custom: { emb: [], tor: [], sub: [], torOcupa: false },
  corte: "",
  otim: { obj: "lucro", torres: true, tipologias: true, unidades: true },
  entorno: [],
  clima: { modo: "sol", ventoDir: 45, ventoVel: 5, ventoAlt: 1.5, overlay3d: true },
  cfd: { res: "rapida", rug: "urbano", var: "vel", viz: { linhas: true, particulas: false, fumaca: false, setas: false, plano: false, pressao: false },
    plano: { orient: "h", h: 1.5, pos: 0.5 }, planoOpac: 0.7, linhasN: 70, linhasAlt: [0.05, 1.1], tubos: false, espessura: 1, linhasMedia: false,
    partN: 3000, fumacaN: 3200, partTam: 1, animVel: 1, rastro: false, rastroLen: 0.25, setasDens: 1, opac: 0.55, escala: "auto", min: 0, max: 8, emissor: null, semente: null, fumacaCor: false, fundo: "claro", emissorTipo: "linha", vidro: false }
};
const clone = o => JSON.parse(JSON.stringify(o));
const LS = {
  get(k){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : null }catch(e){ return null } },
  set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)) }catch(e){} }
};
function merge(base, o){
  if(!o || typeof o!=="object") return base;
  for(const k in base){
    if(o[k]===undefined) continue;
    if(base[k] && typeof base[k]==="object" && !Array.isArray(base[k])) merge(base[k], o[k]);
    else if(Array.isArray(base[k])) { if(Array.isArray(o[k]) && o[k].length) base[k]=o[k] }
    else if(typeof o[k]===typeof base[k]) base[k]=o[k];
  }
  if(base.estudo && o.estudo && o.estudo.off) base.estudo.off=o.estudo.off;
  if(base.estudo && o.estudo && o.estudo.vtipo) base.estudo.vtipo=o.estudo.vtipo;
  if(base.estudo && o.estudo && 'rampa' in o.estudo) base.estudo.rampa=o.estudo.rampa;
  if(o.custom) ['emb','tor','sub'].forEach(k=>{ if(Array.isArray(o.custom[k])) base.custom[k]=o.custom[k] });
  if(Array.isArray(o.entorno)) base.entorno=o.entorno;
  if(o.cfd){ ['emissor','semente'].forEach(k=>{ if(k in o.cfd) base.cfd[k]=o.cfd[k] }); if(Array.isArray(o.cfd.linhasAlt)) base.cfd.linhasAlt=o.cfd.linhasAlt }
  if(base.lote && o.lote && Array.isArray(o.lote.rec)) base.lote.rec=o.lote.rec;
  /* georreferência (S.lote.geo): estudos antigos só contam como posicionados se já tinham coordenadas próprias ou contexto do OSM */
  if(base.lote && (!o.lote || o.lote.geo===undefined)){ const d=DEF.lote, ol=o.lote||{};
    base.lote.geo = (ol.lat!==undefined && +ol.lat!==d.lat) || (ol.lon!==undefined && +ol.lon!==d.lon) || !!(o.contexto && o.contexto.dados) || (Array.isArray(o.entorno) && o.entorno.some(e=>e&&e.osm)) }
  if(base.produto && o.produto){ if(o.produto.lazer && Array.isArray(o.produto.lazer.itens)) base.produto.lazer.itens=o.produto.lazer.itens;
    if(!('garTerOn' in o.produto) && 'garTerreo' in o.produto) base.produto.garTerOn = (+o.produto.garTerreo||0)>0 }
  if(o.cfd && !('emissorTipo' in o.cfd)){ base.cfd.fundo='claro'; base.cfd.viz.plano=false; base.cfd.tubos=false; base.cfd.fumacaN=3200 }
  return base;
}
let S = merge(clone(DEF), LS.get("gabarito.v2"));
let BG = null; // imagem de fundo (só nesta sessão)

/* formatação */
const nf = (v,d=0)=> (isFinite(v)?v:0).toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d});
const brl = v => "R$ " + nf(v,0);
const mi = v => { const a=Math.abs(v); if(a>=1e6) return "R$ "+nf(v/1e6,1)+" mi"; if(a>=1e3) return "R$ "+nf(v/1e3,0)+" mil"; return "R$ "+nf(v,0) };
const pct = (v,d=1)=> nf(v*100,d)+"%";
const m2 = v => nf(v,0)+" m²";
const esc = s => String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const toast = msg => { const t=document.getElementById("toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove("show"),2200) };
