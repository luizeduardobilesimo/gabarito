/* ================= financeiro ================= */
function finance(st, m, adj={}){
  const F=st.fin, R=st.regras, P=st.produto, dp=adj.dp||0, dc=adj.dc||0;
  const eqA = m.tiposA + m.duplexA + m.hallA + m.lojaA + m.aticoA + (m.lzExtraA||0) + m.garA*F.eqGar + (m.sacBal||0)*0.5;
  const lazerC = (m.lzCusto||0)*(1+dc);
  const extraC = (m.custosExtra||[]).reduce((s,x)=>s+(+x.valor||0),0)*(1+dc);
  // orçamento: "CUB × fator" (padrão) ou paramétrico por sistema (src/calc/orcamento.js)
  const orc = st.orc && st.orc.modo==="param" ? orcCalc(st, m) : null;
  const obra = orc ? orc.direto*(1+dc) + lazerC + extraC : eqA*F.cub*F.fator*(1+dc) + lazerC + extraC;
  // VGV de tabela (base)
  const vRes = m.vgvUnidades!=null ? m.vgvUnidades : m.unitRows.reduce((s,u)=>s+u.area*u.preco,0) + m.cobArea*P.cob.preco;
  const vLoja = m.lojaPriv*F.precoLoja;
  const vgvB = (vRes+vLoja)*(1+dp), permV = vgvB*F.permuta, vgv = vgvB-permV;
  const terreno=F.terreno, itbi=terreno*F.itbi, outorga=m.outA*R.outorgaRS;
  const terra = m.terra*st.lote.custoTerra*(1+dc);
  const projetos=obra*F.projetos, adm=obra*F.adm, conting=obra*F.conting;
  // cronograma
  const launch=Math.round(F.prelanc), N=Math.max(1,Math.round(F.obra)), chaves=launch+N, V=Math.max(1,Math.round(F.venda));
  const RD = st.flx && st.flx.receb && st.flx.receb.modo==="det" ? st.flx.receb : null;   // recebimento detalhado (src/calc/fluxo.js)
  const T=Math.max(chaves, launch+V)+2 + (RD? flxMesesExtra(RD) : 0);
  const z=()=>new Array(T).fill(0);
  const c={terreno:z(),outorga:z(),projetos:z(),obra:z(),terra:z(),mkt:z(),corret:z(),imp:z(),permFin:z(),juros:z(),receb:z(),finIn:z(),finOut:z(),vendas:z(),distr:z()};
  const fI = mm => Math.pow(1+F.incc, mm/12);
  c.terreno[0] = terreno+itbi; c.outorga[Math.min(3,T-1)] = outorga;
  for(let k=0;k<Math.max(1,launch);k++) c.projetos[k] = projetos/Math.max(1,launch);
  for(let k=0;k<Math.min(3,N);k++) c.terra[launch+k] = terra/Math.min(3,N)*fI(launch+k);
  const curva = flxCurva(st, m, N, orc);   // null = senoidal (padrão)
  if(curva){ for(let k=0;k<N;k++) c.obra[launch+k] = (obra+adm+conting)*curva.w[k]*fI(launch+k);
    if(curva.sis && !adj.noHooks) c.obraSis = curva.sis.map(s=>({k:s.k, nome:s.nome, cor:s.cor, v:s.w.map((x,k)=>(obra+adm+conting)*x*fI(launch+k)), mes0:launch})) }
  else { let wsum=0; const w=[]; for(let k=0;k<N;k++){ w[k]=Math.sin(Math.PI*(k+.5)/N); wsum+=w[k] }
  for(let k=0;k<N;k++) c.obra[launch+k] = (obra+adm+conting)*w[k]/wsum*fI(launch+k) }
  const mStart=Math.max(0,launch-2), mLen=V+2; for(let k=0;k<mLen;k++) c.mkt[mStart+k] = vgv*F.mkt/mLen;
  const sold=[]; for(let k=0;k<V;k++) sold[k]=(k===0?F.vendaLanc:0)+(1-F.vendaLanc)/V;
  const soldCum=z(); let sc=0, dist=null;
  if(RD){ dist = flxRecebDet(RD, F, c, vgv, sold, launch, chaves, V, T); for(let k=0;k<V;k++){ sc+=sold[k]; soldCum[launch+k]=sc } }
  else for(let k=0;k<V;k++){
    const mth=launch+k, val=vgv*sold[k]*Math.pow(1+F.reaj, k/12); sc+=sold[k]; soldCum[mth]=sc;
    c.corret[mth] += val*F.corret; c.vendas[mth] += val;
    const corr = j => F.correcao ? Math.pow(1+F.incc,(j-mth)/12) : 1;
    if(mth<chaves){ const nP=chaves-mth; for(let j=0;j<nP;j++) c.receb[mth+j]+=val*F.entrada/nP*corr(mth+j); c.receb[chaves]+=val*(1-F.entrada)*corr(chaves) }
    else c.receb[mth]+=val;
  }
  for(let i=1;i<T;i++) if(!soldCum[i]) soldCum[i]=soldCum[i-1];
  for(let i=0;i<T;i++){ c.imp[i]=c.receb[i]*F.imp; c.permFin[i]=c.receb[i]*F.permutaFin }
  // financiamento à produção: libera % do custo da obra depois de atingir as vendas mínimas; quita nas chaves
  let saldo=0; const lim = F.finOn ? (obra+adm+conting)*F.finPct : 0, tm=Math.pow(1+F.finTaxa,1/12)-1; let liberado=0;
  if(F.finOn){
    for(let i=0;i<T;i++){
      c.juros[i]=saldo*tm;
      if(i<chaves && soldCum[i]>=F.finVendaMin && c.obra[i]>0){ const d=Math.min(c.obra[i]*F.finPct*1.0, lim-liberado); if(d>0){ c.finIn[i]=d; liberado+=d; saldo+=d } }
      if(i===chaves && saldo>0){ c.finOut[i]=saldo; saldo=0 }
    }
  }
  const cf=z();
  for(let i=0;i<T;i++) cf[i] = c.receb[i] + c.finIn[i] - c.terreno[i]-c.outorga[i]-c.projetos[i]-c.obra[i]-c.terra[i]-c.mkt[i]-c.corret[i]-c.imp[i]-c.permFin[i]-c.juros[i]-c.finOut[i];
  const sum=a=>a.reduce((s,v)=>s+v,0);
  const S_={receita:sum(c.receb), terreno:sum(c.terreno), outorga:sum(c.outorga), projetos:sum(c.projetos), obraTot:sum(c.obra), terra:sum(c.terra), mkt:sum(c.mkt), corret:sum(c.corret), imp:sum(c.imp), permFin:sum(c.permFin), juros:sum(c.juros)};
  const custo = S_.terreno+S_.outorga+S_.projetos+S_.obraTot+S_.terra+S_.mkt+S_.corret+S_.imp+S_.permFin+S_.juros;
  const lucro = S_.receita - custo, margem = S_.receita? lucro/S_.receita : 0;
  const npv = r => cf.reduce((s,v,i)=>s+v/Math.pow(1+r,i),0);
  let tirM=null; { let lo=-0.5, hi=1; const a=npv(lo), b=npv(hi); if(a*b<0){ for(let i=0;i<100;i++){ const mid=(lo+hi)/2; (npv(lo)*npv(mid)<=0)? hi=mid : lo=mid } tirM=(lo+hi)/2 } }
  const tirA = tirM===null? null : Math.pow(1+tirM,12)-1;
  const rm=Math.pow(1+F.tma,1/12)-1, vpl=npv(rm);
  let cum=0, minCum=0; const cumA=cf.map(v=>{ cum+=v; if(cum<minCum) minCum=cum; return cum });
  let pay=null; for(let i=cumA.length-1;i>=0;i--){ if(cumA[i]<0){ pay=i+1<cumA.length?i+1:null; break } if(i===0) pay=0 }
  const maxTerreno = terreno + (lucro - F.margemAlvo*S_.receita)/(1+F.itbi);
  const out = {eqA,lazerC,extraC,obra,vgvB,permV,vgv,vRes,vLoja,terreno,itbi,outorga,terra,projetos,adm,conting,...S_,custo,lucro,margem,cf,cumA,c,tirA,vpl,exp:minCum,pay,maxTerreno,chaves,launch,lim,
    orc, distratoV: dist? dist.loss : 0, distrato: dist, recebModo: RD? "det" : "simples", curvaModo: curva? st.flx.curva.modo : "sen"};
  if(!adj.noHooks) runHooks("finance", out, st, m, adj);
  return out;
}
function sensGrid(st,m){ return [-0.1,0,0.1].map(dp=>[-0.1,0,0.1].map(dc=>finance(st,m,{dp,dc}).margem)) }
