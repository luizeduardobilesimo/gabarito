/* ================= orçamento paramétrico por sistema =================
   Cada sistema = coeficiente (fração do CUB) × direcionador tirado do modelo m. Os coeficientes padrão foram calibrados
   para que o total fique perto de "CUB × fator" no estudo de exemplo. Itens de m.custosExtra (publicados por outros
   módulos: contenção, transições, recarga EV…) entram no sistema indicado em `sistema`. */
extendDEF("orc", {
  modo: "cub",                 // "cub" = CUB × fator (padrão, método atual) · "param" = soma dos sistemas
  uf: "SC", padrao: "R8-N",    // tabela CUB (referência)
  cubAuto: false,              // true = fin.cub segue a tabela do estado e padrão (cubSincroniza em calc/cub.js); desligado: o CUB é o digitado
  solo: "medio",               // bom | medio | ruim
  fachada: "porcelanato",      // textura | porcelanato | vidro
  acab: "normal",              // economico | normal | alto | luxo
  coef: { fund:0.056, cont:0.45, estr:0.225, ved:0.12, fach:0.17, inst:0.11, instUn:7.5, elev:8, acab:0.33, cant:0.12 },
  cubTab: []                   // linhas importadas do boletim do Sinduscon
});
const ORC_SIS = [
  { k:"fund",   nome:"Fundação",               jan:[0,0.22],   cor:"var(--m-sub)" },
  { k:"cont",   nome:"Contenção e terra",      jan:[0,0.15],   cor:"var(--m-gar)" },
  { k:"estr",   nome:"Estrutura",              jan:[0.08,0.62],cor:"var(--accent)" },
  { k:"ved",    nome:"Vedações",               jan:[0.3,0.8],  cor:"var(--m-ter)" },
  { k:"fach",   nome:"Fachada",                jan:[0.45,0.92],cor:"var(--m-loja)" },
  { k:"inst",   nome:"Instalações",            jan:[0.2,0.96], cor:"var(--u5)" },
  { k:"elev",   nome:"Elevadores",             jan:[0.6,1],    cor:"var(--u4)" },
  { k:"acab",   nome:"Acabamentos",            jan:[0.5,1],    cor:"var(--mark)" },
  { k:"lazer",  nome:"Lazer",                  jan:[0.75,1],   cor:"var(--ok)" },
  { k:"cant",   nome:"Canteiro e administração", jan:[0,1],    cor:"var(--muted)" },
  { k:"outros", nome:"Outros",                 jan:[0,1],      cor:"var(--u2)" }
];
const ORC_SOLO = { bom:0.8, medio:1, ruim:1.35 };
const ORC_FACH = { textura:0.6, porcelanato:1, vidro:2.2 };
const ORC_ACAB = { economico:0.75, normal:1, alto:1.4, luxo:1.9 };
const orcNorm = s => String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
/* nome do sistema publicado em custosExtra → chave do orçamento */
function orcSisKey(s){
  const n = orcNorm(s);
  if(/conten|terra|escav|tirant|cortina|estaca prancha/.test(n)) return "cont";
  if(/funda/.test(n)) return "fund";
  if(/estrut|transi/.test(n)) return "estr";
  if(/instala|eletri|hidra|recarga|\bev\b|gas|incendio|spda/.test(n)) return "inst";
  if(/elevad/.test(n)) return "elev";
  if(/fachad|esquadr|caixilh/.test(n)) return "fach";
  if(/veda|alvenar/.test(n)) return "ved";
  if(/acaba|revest|pintur|piso/.test(n)) return "acab";
  if(/lazer|paisag|piscin/.test(n)) return "lazer";
  if(/cantei|admin/.test(n)) return "cant";
  return "outros";
}
function orcPerim(p){ return (p && p.length>2) ? G.perimeter(p) : 0 }
/* fachada da torre: perímetro × altura de cada faixa de andares (torre escalonada / pilha de blocos); pátio conta a borda interna */
function orcFachTorre(t, m){
  const hE=m.hEmb||0, H=Math.max(0,(t.H||0)-hE), per=p=> typeof blcPerim==="function" ? blcPerim(t,p) : orcPerim(p);
  const fx=(t.faixas||[]).filter(f=>f.plate && f.plate.length>2);
  if(fx.length<2) return per(t.plate)*H;
  return fx.reduce((s,f,k)=>{ const z0=k? f.z0 : hE, z1=k===fx.length-1? (t.H||0) : f.z1; return s+per(f.plate)*Math.max(0,z1-z0) },0);
}
/* direcionadores físicos tirados do modelo */
function orcDrivers(st, m){
  const P=st.produto, E=st.estudo, T=m.T||[], sub=+P.subsolos||0, gac=+P.garAcima||0;
  const maxPav = T.reduce((s,t)=>Math.max(s,t.pav||0),0);
  const proj = Math.max(m.embA||0, sub>0? (m.subA||0) : 0);
  const carga = T.reduce((s,t)=>s+(t.desenhada && t.Atot ? t.Atot : (t.A||0)*(t.pav||0)),0) + proj*(1+sub+gac);   // C2: pilha de blocos soma por faixa
  const contArea = sub>0 ? orcPerim(m.sub)*sub*(+P.peGar||3) : 0;
  const vedA = (m.tiposA||0)+(m.duplexA||0)+(m.aticoA||0)+(m.hallA||0)+(m.lojaA||0)+(m.lzExtraA||0) + (m.garA||0)*0.1;
  const fachA = T.reduce((s,t)=>s+orcFachTorre(t, m),0) + orcPerim(m.emb)*(m.hEmb||0);
  const acabA = (m.tiposA||0)+(m.duplexA||0)+(m.hallA||0)+(m.lojaA||0)+(m.lzExtraA||0)+(m.aticoA||0)*0.3+(m.garA||0)*0.25;
  const nAuto = t => (t.units>60||t.H>45)?3:(t.H>12?2:1);
  const elevs = T.map((t,i)=>{ const l=m.tipo&&m.tipo[i]; const n = l&&l.coreParts? l.coreParts.filter(c=>c.kind==="elev").length : 0;
    return { n: n || +E.elevadores || nAuto(t), paradas: (t.pav||0)+1+sub+gac } });
  const elevParadas = elevs.reduce((s,e)=>s+e.n*e.paradas,0);
  return { maxPav, proj, carga, contArea, constr:m.constr||0, vedA, fachA, acabA, units:m.units||0, elevs, elevParadas };
}
/* orçamento por sistema (valores-base, sem o ±dc da sensibilidade). Barato: roda dentro da finance() no modo paramétrico. */
function orcCalc(st, m){
  const O = st.orc || DEF.orc, K = {...DEF.orc.coef, ...(O.coef||{})}, C = +st.fin.cub||0, d = orcDrivers(st, m);
  const extras = (m.custosExtra||[]).map(x=>({...x, sk: orcSisKey(x.sistema||x.nome)}));
  const temCont = extras.some(x=>/conten|arrimo|cortina|tirant/.test(orcNorm(x.sistema||x.nome)) && (+x.valor||0)>0);   // contenção calculada por outro módulo (topografia)
  const p = {};
  p.fund = K.fund*C*d.carga*(ORC_SOLO[O.solo]||1);
  p.cont = temCont ? 0 : K.cont*C*d.contArea;
  p.estr = K.estr*C*d.constr*(1+0.01*Math.max(0,d.maxPav-10));
  p.ved  = K.ved*C*d.vedA;
  p.fach = K.fach*C*d.fachA*(ORC_FACH[O.fachada]||1);
  p.inst = K.inst*C*d.constr + K.instUn*C*d.units;
  p.elev = K.elev*C*d.elevParadas;
  p.acab = K.acab*C*d.acabA*(ORC_ACAB[O.acab]||1);
  const soma = Object.values(p).reduce((s,v)=>s+v,0);
  p.cant = K.cant*soma;
  const direto = soma + p.cant;
  const lazer = m.lzCusto||0;
  const itens = ORC_SIS.map(s=>{ const ex = extras.filter(x=>x.sk===s.k).reduce((a,x)=>a+(+x.valor||0),0);
    const par = s.k==="lazer" ? lazer : (p[s.k]||0);
    return { k:s.k, nome:s.nome, cor:s.cor, jan:s.jan, param:par, extra:ex, total:par+ex, extras:extras.filter(x=>x.sk===s.k) } });
  const extraT = extras.reduce((a,x)=>a+(+x.valor||0),0);
  const total = direto + lazer + extraT;
  const cubFator = (m.tiposA+m.duplexA+m.hallA+m.lojaA+m.aticoA+(m.lzExtraA||0)+m.garA*st.fin.eqGar+(m.sacBal||0)*0.5)*C*st.fin.fator;
  return { itens, direto, lazer, extraT, total, cubFator, drivers:d, coef:K, C,
    porM2: total/Math.max(1,d.constr), emCub: C? total/Math.max(1,d.constr)/C : 0, temCont };
}
/* parcelas de cada sistema no total (para distribuir o desembolso pelo cronograma) */
function orcPesos(st, m){
  const o = orcCalc(st, m), tot = o.itens.reduce((s,i)=>s+i.total,0) || 1;
  return o.itens.filter(i=>i.total>0).map(i=>({k:i.k, nome:i.nome, cor:i.cor, jan:i.jan, w:i.total/tot}));
}
