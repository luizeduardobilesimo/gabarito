/* ================= fluxo: curva de obra, recebimento detalhado, cenários, sensibilidade e Monte Carlo =================
   Os padrões (curva "sen", recebimento "simples") reproduzem exatamente o fluxo original da finance(). */
extendDEF("flx", {
  curva: { modo: "sen", ini: 0, pico: 0.55, fim: 1 },          // sen = senoidal (atual) · s = curva S (início, pico, fim) · sis = por sistema
  receb: { modo: "simples", ato: 0.10, mensais: 0.15, interm: 0.05, chaves: 0.05, pos: 0, posN: 24, repasseMes: 2, ipca: 0.045,
           distrato: 0, distratoMes: 18, retencao: 0.25 },
  cen: { pess: { preco: -0.08, vel: 0.30, custo: 0.08, juros: 0.02 }, otim: { preco: 0.05, vel: -0.20, custo: -0.04, juros: -0.01 } },
  sens: "margem",
  mc: { on: false, n: 1000 }
});

/* ---------- curva de obra ---------- */
/* pesos mensais (soma 1) numa janela [a,b] (frações do prazo) com pico em p — forma senoidal assimétrica: acumulado em S */
function flxForma(N, a=0, b=1, p){
  a=Math.max(0,Math.min(1,a)); b=Math.max(a,Math.min(1,b)); if(p==null) p=(a+b)/2; p=Math.max(a+1e-6,Math.min(b-1e-6,p));
  const w=new Array(N).fill(0); let s=0;
  for(let k=0;k<N;k++){ const x=(k+0.5)/N; if(x<a||x>b) continue; const u=(x-a)/Math.max(1e-9,b-a), q=(p-a)/Math.max(1e-9,b-a);
    const v=u<q? 0.5*u/q : 0.5+0.5*(u-q)/Math.max(1e-9,1-q); w[k]=Math.sin(Math.PI*v); s+=w[k] }
  if(s<=0){ const k=Math.min(N-1,Math.floor(((a+b)/2)*N)); w[k]=1; s=1 }
  return w.map(v=>v/s);
}
/* desembolso da obra mês a mês: {w:[N] soma 1, sis:[{k,nome,cor,w:[N]}]} — null no modo senoidal (a finance usa o original) */
function flxCurva(st, m, N, orc){
  const C = st.flx && st.flx.curva; if(!C || C.modo==="sen") return null;
  const ini=+C.ini||0, fim=C.fim==null?1:+C.fim;
  if(C.modo==="s"){ const w=flxForma(N, ini, fim, +C.pico); return { w, sis:null } }
  const pesos = orc ? (()=>{ const tot=orc.itens.reduce((s,i)=>s+i.total,0)||1; return orc.itens.filter(i=>i.total>0).map(i=>({k:i.k,nome:i.nome,cor:i.cor,jan:i.jan,w:i.total/tot})) })() : orcPesos(st, m);
  const w=new Array(N).fill(0), L=fim-ini;
  const sis = pesos.map(s=>{ const f=flxForma(N, ini+L*s.jan[0], ini+L*s.jan[1]).map(v=>v*s.w); f.forEach((v,k)=>w[k]+=v); return {k:s.k, nome:s.nome, cor:s.cor, w:f} });
  const t=w.reduce((a,v)=>a+v,0)||1;
  return { w: w.map(v=>v/t), sis: sis.map(s=>({...s, w:s.w.map(v=>v/t)})) };
}

/* ---------- recebimento detalhado ---------- */
const flxRepasse = R => Math.max(0, 1-(+R.ato||0)-(+R.mensais||0)-(+R.interm||0)-(+R.chaves||0)-(+R.pos||0));
const flxMesesExtra = R => Math.max(0,Math.round(+R.repasseMes||0)) + ((+R.pos||0)>0 ? Math.max(1,Math.round(+R.posN||1)) : 0) + 1;
/* preenche c.receb, c.corret, c.vendas, c.distr. INCC até as chaves (se F.correcao) e IPCA depois. Distrato: fração d dos contratos
   assinados antes do mês M = lançamento + distratoMes é desfeita em M; devolve (1 − retenção) do que foi pago e cancela o restante. */
function flxRecebDet(R, F, c, vgv, sold, launch, chaves, V, T){
  const a=+R.ato||0, mens=+R.mensais||0, it=+R.interm||0, ch=+R.chaves||0, pos=+R.pos||0, rep=flxRepasse(R);
  const lag=Math.max(0,Math.round(+R.repasseMes||0)), nPos=Math.max(1,Math.round(+R.posN||1));
  const ipcaF = mm => Math.pow(1+(+R.ipca||0), mm/12), inccF=(i,j)=> F.correcao? Math.pow(1+F.incc,(j-i)/12) : 1;
  const d=Math.max(0,Math.min(1,+R.distrato||0)), ret=Math.max(0,Math.min(1,+R.retencao||0)), M = d>0 ? Math.min(T-1, launch+Math.max(0,Math.round(+R.distratoMes||0))) : Infinity;
  let refund=0, loss=0, bruto=0;
  for(let k=0;k<V;k++){
    const mth=launch+k, val=vgv*sold[k]*Math.pow(1+F.reaj, k/12);
    c.vendas[mth]+=val; c.corret[mth]+=val*F.corret;
    const fl=[]; const add=(j,v)=>{ if(v) fl.push([Math.min(T-1,j),v]) };
    if(mth<chaves){
      const corr = j => inccF(mth, Math.min(j,chaves)) * (j>chaves? ipcaF(j-chaves) : 1);
      add(mth, val*a);
      const nm=chaves-mth-1; if(nm>0) for(let j=1;j<=nm;j++) add(mth+j, val*mens/nm*corr(mth+j)); else add(chaves, val*mens*corr(chaves));
      const sem=[]; for(let j=mth+6;j<chaves;j+=6) sem.push(j);
      if(sem.length) sem.forEach(j=>add(j, val*it/sem.length*corr(j))); else add(chaves, val*it*corr(chaves));
      add(chaves, val*ch*corr(chaves));
      add(chaves+lag, val*rep*corr(chaves));            // o banco quita o saldo corrigido até as chaves
      if(pos>0) for(let j=1;j<=nPos;j++) add(chaves+j, val*pos/nPos*corr(chaves+j));
    } else {
      add(mth, val*(a+mens+it+ch)); add(mth+lag, val*rep);
      if(pos>0) for(let j=1;j<=nPos;j++) add(mth+j, val*pos/nPos*ipcaF(j));
    }
    let pago=0, fut=0; fl.forEach(([j,v])=>{ bruto+=v; if(j<M) pago+=v; else fut+=v });
    const cancela = mth<M && d>0;
    fl.forEach(([j,v])=>{ c.receb[j] += (cancela && j>=M) ? v*(1-d) : v });
    if(cancela){ refund += d*(1-ret)*pago; loss += d*(fut + (1-ret)*pago) }
  }
  if(refund){ c.receb[M]-=refund; c.distr[M]+=refund }
  return { bruto, loss, refund, M: isFinite(M)? M : null, repasse: rep };
}

/* ---------- métricas de um fluxo (mesmo algoritmo da finance) ---------- */
function flxMetricas(cf, tma){
  const npv = r => cf.reduce((s,v,i)=>s+v/Math.pow(1+r,i),0);
  let tirM=null; { let lo=-0.5, hi=1; const a=npv(lo), b=npv(hi); if(a*b<0){ for(let i=0;i<100;i++){ const mid=(lo+hi)/2; (npv(lo)*npv(mid)<=0)? hi=mid : lo=mid } tirM=(lo+hi)/2 } }
  const tirA = tirM===null? null : Math.pow(1+tirM,12)-1;
  const vpl = npv(Math.pow(1+tma,1/12)-1);
  let cum=0, minCum=0; cf.forEach(v=>{ cum+=v; if(cum<minCum) minCum=cum });
  return { tirA, vpl, exp:minCum, soma:cum };
}
const flxVPL = (fl, taxaA) => { const r=Math.pow(1+taxaA,1/12)-1; return fl.reduce((s,v,i)=>s+v/Math.pow(1+r,i),0) };

/* ---------- cenários ---------- */
/* s = {preco, vel, custo, juros, terreno, incc, obra, lanc, reaj} (deltas) → finance com o estado ajustado */
function flxAjuste(st, m, s={}, noHooks=true){
  const F=st.fin, fin={...F};
  if(s.vel) fin.venda=Math.max(1,Math.round(F.venda*(1+s.vel)));
  if(s.juros){ fin.finTaxa=Math.max(0,F.finTaxa+s.juros); fin.tma=Math.max(0,F.tma+s.juros) }
  if(s.terreno) fin.terreno=F.terreno*(1+s.terreno);
  if(s.incc) fin.incc=Math.max(-0.5,F.incc+s.incc);
  if(s.obra) fin.obra=Math.max(1,Math.round(F.obra*(1+s.obra)));
  if(s.lanc) fin.vendaLanc=Math.max(0,Math.min(1,F.vendaLanc+s.lanc));
  if(s.reaj) fin.reaj=F.reaj+s.reaj;
  return finance({...st, fin}, m, {dp:s.preco||0, dc:s.custo||0, noHooks});
}
function flxCenarios(st, m, fBase){
  const C=(st.flx&&st.flx.cen)||DEF.flx.cen;
  return [["pess","Pessimista",C.pess],["base","Base",null],["otim","Otimista",C.otim]].map(([k,nome,s])=>({k, nome, s, f: s? flxAjuste(st,m,s,false) : (fBase||finance(st,m))}));
}

/* ---------- sensibilidade (tornado) ---------- */
function flxTornadoVars(st){
  const F=st.fin, v=[
    ["preco","Preço de venda","±10%",-0.1,0.1],
    ["custo","Custo de obra","±10%",0.1,-0.1],
    ["vel","Prazo de vendas","±30%",0.3,-0.3],
    ["terreno","Terreno","±20%",0.2,-0.2],
    ["incc","INCC","±2 p.p.",0.02,-0.02],
    ["obra","Prazo de obra","±20%",0.2,-0.2],
    ["lanc","Vendido no lançamento","±10 p.p.",-0.1,0.1],
    ["reaj","Reajuste da tabela","±2 p.p.",-0.02,0.02]];
  if(F.finOn) v.push(["juros","Juros do financiamento","±2 p.p.",0.02,-0.02]);
  if(!F.terreno) v.splice(v.findIndex(x=>x[0]==="terreno"),1);
  return v;
}
/* para cada variável: resultado no lado desfavorável (lo) e favorável (hi); ordenado pelo impacto na métrica escolhida */
function flxTornado(st, m, fBase, met="margem"){
  const b=fBase||finance(st,m,{noHooks:true}), val=f=> met==="tir"? (f.tirA==null? -1 : f.tirA) : f.margem;
  // lo = lado que piora a métrica escolhida, hi = lado que melhora (nem sempre é o "óbvio": vender devagar pode render reajuste)
  const out=flxTornadoVars(st).map(([k,nome,faixa,a,b])=>{ let fl=flxAjuste(st,m,{[k]:a}), fh=flxAjuste(st,m,{[k]:b});
    if(val(fl)>val(fh)){ const t=fl; fl=fh; fh=t }
    return { k, nome, faixa, lo:{margem:fl.margem, tir:fl.tirA, lucro:fl.lucro}, hi:{margem:fh.margem, tir:fh.tirA, lucro:fh.lucro}, d: Math.abs(val(fh)-val(fl)) } });
  out.sort((a,b)=>b.d-a.d);
  return { base:{margem:b.margem, tir:b.tirA, lucro:b.lucro}, vars:out };
}

/* ---------- Monte Carlo ---------- */
function flxRng(seed){ let a=seed>>>0; return ()=>{ a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296 } }
const flxTri = (u,a,c,b) => { const F=(c-a)/((b-a)||1); return u<F? a+Math.sqrt(u*(b-a)*(c-a)) : b-Math.sqrt((1-u)*(b-a)*(b-c)) };
// faixas (mín, mais provável, máx) de cada incerteza
const FLX_MC = { preco:[-0.10,0,0.06], custo:[-0.05,0,0.12], vel:[-0.20,0,0.50], incc:[-0.01,0,0.03], obra:[-0.05,0,0.20] };
function flxMCRodada(st, m, rng){
  const s={}; for(const k in FLX_MC){ const [a,c,b]=FLX_MC[k]; s[k]=flxTri(rng(),a,c,b) }
  const f=flxAjuste(st,m,s,true); return { tir:f.tirA, lucro:f.lucro, margem:f.margem };
}
function flxPctil(arr, p){ const a=arr.filter(v=>v!=null&&isFinite(v)).sort((x,y)=>x-y); if(!a.length) return null; const i=(a.length-1)*p, lo=Math.floor(i), hi=Math.ceil(i); return a[lo]+(a[hi]-a[lo])*(i-lo) }
/* roda n rodadas de uma vez (testes / Worker); a interface usa flxMCRodada em blocos */
function flxMonteCarlo(st, m, n=1000, seed=7){
  const rng=flxRng(seed), r=[]; for(let i=0;i<n;i++) r.push(flxMCRodada(st,m,rng));
  return flxMCResumo(r);
}
function flxMCResumo(r){
  const tir=r.map(x=>x.tir), lu=r.map(x=>x.lucro);
  return { n:r.length, tir:[0.1,0.5,0.9].map(p=>flxPctil(tir,p)), lucro:[0.1,0.5,0.9].map(p=>flxPctil(lu,p)),
    pPrej: r.filter(x=>x.lucro<0).length/Math.max(1,r.length), lucros: lu };
}
