/* ================= 3.3 terreno: compra × permuta × parceria =================
   Compara, com o resto do estudo igual, as formas de pagar o terreno. Base: o fluxo do empreendimento sem custo de terreno
   (terreno, permutas = 0); cada alternativa acrescenta o seu fluxo. ITBI sobre o preço pedido em todas, para comparar igual.
   Lado do terreneiro: quando e quanto recebe, VPL à taxa dele. Ponto de indiferença: % de permuta que equivale ao preço à vista. */
extendDEF("terAlt", {
  on: false,
  preco: 0,                 // preço pedido à vista (0 = usar o terreno das premissas)
  parcEntrada: 0.30, parcN: 24, parcAcresc: 0.08, parcCorr: true,
  permF: 0.12,              // permuta física: % do VGV em unidades
  permFin: 0.10, permBase: "receita",   // permuta financeira: % da receita (à medida que entra) ou do VGV (no mês de cada venda)
  speS: 0.35,               // SPE: participação do terreneiro no resultado
  taxa: 0.10,               // taxa de desconto do terreneiro (a.a.)
  unidades: []              // ids da tabela de vendas escolhidos para a permuta física (vazio = usar o %)
});
const TERALT_NOMES = { vista:"Compra à vista", parc:"Compra parcelada", fis:"Permuta física", fin:"Permuta financeira", spe:"SPE com o terreneiro" };
function terAltPreco(st){ const A=st.terAlt||DEF.terAlt; return A.preco>0 ? A.preco : (+st.fin.terreno||0) }
const terAltBase = (st, extra={}) => ({...st, fin:{...st.fin, terreno:0, permuta:0, permutaFin:0, ...extra}});
const terAltPad = (a, T) => { const o=a.slice(); while(o.length<T) o.push(0); return o };
/* unidades da tabela de vendas (item 1.1) disponíveis para a permuta física */
function terAltUnidades(m){ return Array.isArray(m.unidades) && m.unidades.length ? m.unidades.map((u,i)=>({id:u.id??String(i), nome:u.id??u.nome??("Unidade "+(i+1)), tip:u.tipologia||"", area:+u.area||0, valor:+(u.preco??u.valor??0)||0})) : null }
/* % do VGV entregue na permuta física: unidades escolhidas (se houver tabela) ou o % informado */
function terAltPermF(st, m, vgvB){
  const A=st.terAlt||DEF.terAlt, us=terAltUnidades(m), sel=(A.unidades||[]).map(String);
  if(us && sel.length){ const v=us.filter(u=>sel.includes(String(u.id))).reduce((s,u)=>s+u.valor,0); return { p: vgvB? Math.min(0.95, v/vgvB) : 0, valor:v, n:sel.length, porUnid:true } }
  return { p:+A.permF||0, valor:(+A.permF||0)*vgvB, n:null, porUnid:false };
}
function terAltMetr(st, cf, receita, terr, extra={}){
  const F=st.fin, A=st.terAlt||DEF.terAlt, mt=flxMetricas(cf, F.tma), lucro=cf.reduce((s,v)=>s+v,0);
  const tot=terr.reduce((s,v)=>s+v,0); let ini=null, fim=null; terr.forEach((v,i)=>{ if(v>1e-6){ if(ini==null) ini=i; fim=i } });
  return { cf, lucro, margem: receita? lucro/receita : 0, tirA:mt.tirA, vpl:mt.vpl, exp:mt.exp, terr, terrTot:tot, terrVPL:flxVPL(terr, +A.taxa||0), ini, fim, ...extra };
}
/* fluxos de todas as alternativas (barato: ~4 chamadas da finance) */
function terAltCalc(st, m){
  const F=st.fin, A=st.terAlt||DEF.terAlt, P=terAltPreco(st), itbi=P*F.itbi;
  const f0=finance(terAltBase(st), m, {noHooks:true});
  const vgvB=f0.vgvB, pf=terAltPermF(st, m, vgvB);
  const fFis=finance(terAltBase(st,{permuta:pf.p}), m, {noHooks:true});
  const fFin=A.permBase==="vgv" ? null : finance(terAltBase(st,{permutaFin:+A.permFin||0}), m, {noHooks:true});
  const n=Math.max(f0.cf.length, fFis.cf.length, (fFin||f0).cf.length, Math.round(A.parcN)+2), Z=()=>new Array(n).fill(0);
  const base=terAltPad(f0.cf,n), menos=(cf,l)=>cf.map((v,i)=>v-(l[i]||0));
  const out={};
  // à vista
  { const L=Z(); L[0]=P+itbi; const t=Z(); t[0]=P; out.vista=terAltMetr(st, menos(base,L), f0.receita, t, {pago:P+itbi}) }
  // parcelada (entrada + parcelas mensais, corrigidas pelo INCC se marcado)
  { const Pp=P*(1+(+A.parcAcresc||0)), e=Math.max(0,Math.min(1,+A.parcEntrada||0)), N=Math.max(1,Math.round(+A.parcN||1)), t=Z();
    t[0]=Pp*e; for(let j=1;j<=N;j++) t[j]+=Pp*(1-e)/N*(A.parcCorr? Math.pow(1+F.incc,j/12) : 1);
    const L=t.slice(); L[0]+=itbi; out.parc=terAltMetr(st, menos(base,L), f0.receita, t, {preco:Pp}) }
  // permuta física: as unidades saem do VGV; o terreneiro recebe-as nas chaves (valor de tabela reajustado, menos o custo de venda)
  { const cf=terAltPad(fFis.cf,n); cf[0]-=itbi; const t=Z(), ch=Math.min(n-1,fFis.chaves);
    const valCh=pf.p*vgvB*Math.pow(1+F.reaj,(fFis.chaves-fFis.launch)/12); t[ch]=valCh*(1-F.corret);
    out.fis=terAltMetr(st, cf, fFis.receita, t, {p:pf.p, valor:pf.valor, nUn:pf.n, porUnid:pf.porUnid, valCh}) }
  // permuta financeira
  { let cf, t, rec;
    if(fFin){ cf=terAltPad(fFin.cf,n); t=terAltPad(fFin.c.permFin,n); rec=fFin.receita }
    else { t=terAltPad(f0.c.vendas,n).map(v=>v*(+A.permFin||0)); cf=menos(base,t); rec=f0.receita }
    cf[0]-=itbi; out.fin=terAltMetr(st, cf, rec, t, {p:+A.permFin||0, base:A.permBase}) }
  // SPE: o incorporador recupera o que investiu; daí em diante o terreneiro leva s de cada novo patamar do caixa acumulado
  { const s=Math.max(0,Math.min(0.95,+A.speS||0)), b=base.slice(); b[0]-=itbi; const t=Z(); let cum=0, H=0;
    b.forEach((v,i)=>{ cum+=v; const h=Math.max(H,cum,0); if(h>H){ t[i]=s*(h-H); H=h } });
    out.spe=terAltMetr(st, menos(b,t), f0.receita, t, {s}) }
  Object.keys(out).forEach(k=>out[k].nome=TERALT_NOMES[k]);
  return { P, itbi, vgvB, f0, alts:out, ind: terAltIndif(st, m, P, f0, out.vista) };
}
/* ponto de indiferença: % de permuta (física e financeira) que deixa cada lado igual à compra à vista pelo preço pedido */
function terAltIndif(st, m, P, f0, vista){
  const F=st.fin, A=st.terAlt||DEF.terAlt, itbi=P*F.itbi, alvo=vista.vpl, rT=Math.pow(1+(+A.taxa||0),1/12)-1;
  const vplInc = (k,p) => { const f=finance(terAltBase(st, k==="fis"? {permuta:p} : {permutaFin:p}), m, {noHooks:true}); const cf=f.cf.slice(); cf[0]-=itbi; return flxMetricas(cf, F.tma).vpl };
  // o VPL do incorporador é quase linear no %: secante a partir de 0 e 10%, refinada até o erro ficar < R$ 1 mil
  const bisect = k => { let p0=0, v0=vplInc(k,0), p1=0.1, v1=vplInc(k,p1);
    for(let i=0;i<8;i++){ if(Math.abs(v1-v0)<1e-9) break; const p2=p1+(alvo-v1)*(p1-p0)/(v1-v0); p0=p1; v0=v1; p1=Math.max(0,Math.min(0.95,p2)); v1=vplInc(k,p1); if(Math.abs(v1-alvo)<1000) break }
    return Math.abs(v1-alvo)<Math.max(5000,Math.abs(alvo)*0.002) && p1>0 && p1<0.95 ? p1 : null };
  // terreneiro: o valor recebido é linear no % → fórmula direta
  const ch=f0.chaves, uFis = f0.vgvB*Math.pow(1+F.reaj,(ch-f0.launch)/12)*(1-F.corret)/Math.pow(1+rT,ch);
  const uFin = A.permBase==="vgv" ? flxVPL(f0.c.vendas, +A.taxa||0) : flxVPL(f0.c.receb, +A.taxa||0);
  const fisInc = bisect("fis");
  let finInc; if(A.permBase==="vgv"){ const v0=flxMetricas(f0.cf, F.tma).vpl-itbi, u=flxVPL(f0.c.vendas, F.tma); finInc = u>0 && v0>alvo ? (v0-alvo)/u : null } else finInc=bisect("fin");
  return { fis:{ inc:fisInc, terr: uFis>0? P/uFis : null }, fin:{ inc:finInc, terr: uFin>0? P/uFin : null } };
}
