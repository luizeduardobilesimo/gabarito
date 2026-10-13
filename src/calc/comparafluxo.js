/* ================= Fase E: comparar o fluxo de caixa do Gabarito com a planilha da empresa =================
   Cálculo puro (sem DOM); a interface fica em src/ui/comparaplanilha.js. Nada muda no estudo até o usuário aplicar uma sugestão.
   Planilha (CSV/XLSX → matriz): mês, receitas, obra, terreno, indiretos (despesas), saldo do mês — só o saldo é obrigatório
   (ou o saldo acumulado). Custos podem vir positivos ou negativos. O mês pode ser número (0 ou 1 em diante) ou data (jan/27, 01/2027).
   - comparaCampos / comparaMapa(cab) / comparaLer(dados, mapa) → séries mensais da planilha
   - comparaLinhasGab(f)                → o mesmo recorte no fluxo do Gabarito: receita = recebimentos · obra = obra + terra ·
                                          terreno = terreno + ITBI + outorga · indiretos = projetos, marketing, corretagem, impostos, permuta financeira e juros (líquido do financiamento)
   - comparaFluxo(planilha, f, {desl, tma}) → meses alinhados, diferença por linha e acumulada, TIR/VPL/exposição/lucro/payback de cada lado
                                          e as divergências (total, janela de meses, deslocamento, pico de recebimento, curva, INCC), da mais pesada para a mais leve
   - comparaSugestoes(cmp, st, f)       → ajustes de premissas quando a diferença é explicável (prazo e início da obra, curva, INCC, fator de custo, terreno, repasse, ato)
   - comparaAplicar(st, sug)            → grava a sugestão no estudo; comparaModeloCSV() */

const CMP_CAMPOS = [
  { k:"acum",      rot:"Saldo acumulado", alias:["saldo acumulado","caixa acumulado","fluxo acumulado","acumulado"] },
  { k:"saldo",     rot:"Saldo do mês",    alias:["saldo do mes","saldo mensal","saldo","fluxo liquido","fluxo de caixa","fluxo","resultado","caixa mensal"] },
  { k:"mes",       rot:"Mês",             alias:["mes","meses","periodo","competencia","data","mes ano"] },
  { k:"receita",   rot:"Receitas",        alias:["receitas","receita","recebimentos","recebimento","entradas","recebido","receita total","vendas"] },
  { k:"obra",      rot:"Obra",            alias:["custo de obra","custos de obra","obra","obras","construcao","custo obra","desembolso de obra"] },
  { k:"terreno",   rot:"Terreno",         alias:["terreno","aquisicao","terreno e outorga","aquisicao do terreno","compra do terreno"] },
  { k:"indiretos", rot:"Indiretos",       alias:["indiretos","despesas indiretas","despesas","outras despesas","custos indiretos","despesas gerais","soft costs","soft","indireto"] }
];
const CMP_LINHAS = ["receita","obra","terreno","indiretos"];
const CMP_NOMES = { receita:["Recebimento","m"], obra:["Custo de obra","m"], terreno:["Terreno","m"], indiretos:["Despesas indiretas","fp"], saldo:["Saldo","m"] };
const comparaMapa = cab => plaMapaAuto(cab, CMP_CAMPOS);
const cmpSoma = a => a.reduce((s,v)=>s+v,0);
const cmpAdj = (g, mais) => g==="fp"? (mais? "maiores":"menores") : (mais? "maior":"menor");
const cmpMeses = k => `${Math.abs(k)} ${Math.abs(k)===1? "mês":"meses"}`;

/* ---------- leitura da planilha ---------- */
function comparaLer(dados, mapa){
  const avisos=[], rows=(dados||[]).filter(r=>r && r.some(c=>c!=null && String(c).trim()!==""));
  if(!rows.length) return { ok:false, motivo:"Nenhuma linha de dados encontrada.", avisos };
  if(!(mapa.saldo>=0) && !(mapa.acum>=0) && !(mapa.receita>=0 && (mapa.obra>=0||mapa.terreno>=0||mapa.indiretos>=0))) return { ok:false, motivo:"Preciso da coluna de saldo (ou de receitas e custos).", avisos };
  // mês de cada linha
  let idx=rows.map((_,i)=>i);
  if(mapa.mes>=0){
    const raw=rows.map(r=>r[mapa.mes]), dt=raw.map(plaMes);
    if(dt.every(d=>d!=null)){ const d0=Math.min(...dt); idx=dt.map(d=>d-d0) }
    else { const nu=raw.map(x=>plaNum(x)); if(nu.every(x=>x!=null)){ const mn=Math.min(...nu); idx=nu.map(x=>Math.round(x)-(mn===1?1:0)) } else avisos.push("Não entendi a coluna de mês: usei a ordem das linhas.") }
  } else avisos.push("Sem coluna de mês: usei a ordem das linhas (a primeira é o mês 0).");
  if(idx.some(i=>i<0||i>600)) return { ok:false, motivo:"Meses fora do intervalo (0 a 600).", avisos };
  const T=Math.max(...idx)+1, L={}, tem={};
  const serie = k => { if(!(mapa[k]>=0)) return null; const a=new Array(T).fill(0); let n=0; rows.forEach((r,i)=>{ const v=plaNum(r[mapa[k]]); if(v!=null){ a[idx[i]]+=v; n++ } }); return n? a : null };
  CMP_LINHAS.forEach(k=>{ let a=serie(k); if(a && cmpSoma(a)<0) a=a.map(v=>0-v); L[k]=a; tem[k]=!!a });
  let saldo=serie("saldo"), calc=false;
  if(!saldo){
    const ac=serie("acum");
    if(ac){ saldo=ac.map((v,i)=>i? v-ac[i-1] : v) }   // acumulado → mensal (a série soma por mês; acumulado repetido por mês é raro)
    else { saldo=new Array(T).fill(0); calc=true; for(let t=0;t<T;t++) saldo[t]=(L.receita?L.receita[t]:0)-(L.obra?L.obra[t]:0)-(L.terreno?L.terreno[t]:0)-(L.indiretos?L.indiretos[t]:0) }
  } else if(L.receita && (L.obra||L.terreno||L.indiretos)){
    const c=cmpSoma(L.receita)-cmpSoma(L.obra||[])-cmpSoma(L.terreno||[])-cmpSoma(L.indiretos||[]), s=cmpSoma(saldo);
    if(Math.abs(c-s)>0.02*Math.max(1,cmpSoma(L.receita))) avisos.push("O saldo da planilha não fecha com receitas menos custos: ele inclui linhas que não mapeei (financiamento, por exemplo).");
  }
  L.saldo=saldo; tem.saldo=true;
  return { ok:true, T, linhas:L, tem, avisos, saldoCalculado:calc, nLinhas:rows.length };
}

/* ---------- o fluxo do Gabarito no mesmo recorte ---------- */
function comparaLinhasGab(f){
  const c=f.c, T=f.cf.length, z=()=>new Array(T).fill(0), g=a=>a||z();
  const receita=g(c.receb), obra=z(), terreno=z(), indiretos=z();
  for(let t=0;t<T;t++){
    obra[t]=c.obra[t]+c.terra[t];
    terreno[t]=c.terreno[t]+c.outorga[t];
    indiretos[t]=c.projetos[t]+c.mkt[t]+c.corret[t]+c.imp[t]+c.permFin[t]+c.juros[t]+c.finOut[t]-c.finIn[t];
  }
  return { receita, obra, terreno, indiretos, saldo:f.cf.slice() };
}

function cmpMetricas(cf, tma){
  const m=flxMetricas(cf,tma); let cum=0; const cumA=cf.map(v=>cum+=v);
  let pay=null; for(let i=cumA.length-1;i>=0;i--){ if(cumA[i]<0){ pay=i+1<cumA.length? i+1 : null; break } if(i===0) pay=0 }
  return { tirA:m.tirA, vpl:m.vpl, exp:m.exp, lucro:m.soma, pay };
}
/* janela em que ficam 95% do gasto (quantis 2,5% e 97,5% do acumulado), centro de massa e mês do maior valor */
function cmpJanela(a){
  const p=a.map(v=>Math.max(0,v)), tot=cmpSoma(p); if(!(tot>0)) return null;
  let cum=0, ini=null, fim=null, com=0, pico=0; p.forEach((v,t)=>{ cum+=v; com+=v*t; if(ini==null && cum>=0.025*tot) ini=t; if(fim==null && cum>=0.975*tot) fim=t; if(v>p[pico]) pico=t });
  return { ini, fim, com:com/tot, pico, tot };
}
/* deslocamento (meses) que melhor leva o formato de G ao de P */
function cmpDesloc(P, G, maxS=12){
  const sP=cmpSoma(P.map(v=>Math.max(0,v))), sG=cmpSoma(G.map(v=>Math.max(0,v))); if(!(sP>0&&sG>0)) return null;
  const N=P.length; let E0=0, best=0, Eb=Infinity;
  for(let s=-maxS;s<=maxS;s++){ let E=0; for(let t=0;t<N;t++){ const g=t-s>=0&&t-s<N? Math.max(0,G[t-s])/sG : 0; E+=Math.abs(Math.max(0,P[t])/sP-g) } if(s===0) E0=E; if(E<Eb-1e-12){ Eb=E; best=s } }
  return { s:best, E0, Eb };
}
/* trechos de meses em que P difere de G em mais de 6% (relativo ao mês) e o mês pesa ≥ 5% do maior valor da linha */
function cmpJanelas(P, G){
  const N=P.length, mx=Math.max(1e-9,...P.map(Math.abs),...G.map(Math.abs)), marca=new Array(N).fill(false), relev=new Array(N).fill(false);
  for(let t=0;t<N;t++){ const a=Math.abs(P[t]), b=Math.abs(G[t]), m=Math.max(a,b); relev[t]=m>=0.05*mx; if(relev[t] && Math.abs(P[t]-G[t])>0.06*m) marca[t]=true }
  const segs=[]; let ini=-1, ult=-1;
  for(let t=0;t<N;t++){
    if(marca[t]){ if(ini<0) ini=t; else if(t-ult>3){ segs.push([ini,ult]); ini=t } ult=t }
  }
  if(ini>=0) segs.push([ini,ult]);
  return segs.map(([a,b])=>{ let sP=0, sG=0; for(let t=a;t<=b;t++){ sP+=P[t]; sG+=G[t] } return { a, b, sP, sG, pct: sG>0? sP/sG-1 : null, dif: sP-sG } });
}

/* ---------- comparação ---------- */
function comparaFluxo(plan, f, o={}){
  o={ desl:0, tma:0.15, ...o };
  if(!plan || !plan.ok || !f || !f.cf) return { ok:false, motivo: plan&&plan.motivo || "Sem planilha." };
  const gl=comparaLinhasGab(f), d=Math.round(+o.desl||0), N=Math.max(gl.saldo.length, plan.T+Math.max(0,d));
  const pad=(a,sh)=>{ const r=new Array(N).fill(0); if(a) a.forEach((v,i)=>{ const j=i+sh; if(j>=0&&j<N) r[j]=v }); return r };
  const linhas=[];
  [...CMP_LINHAS,"saldo"].forEach(k=>{
    if(!plan.linhas[k]) return;
    const gab=pad(gl[k],0), pl=pad(plan.linhas[k],d), dif=pl.map((v,i)=>v-gab[i]); let ac=0;
    const totalG=cmpSoma(gab), totalP=cmpSoma(pl);
    linhas.push({ k, nome:CMP_NOMES[k][0], gab, plan:pl, dif, difAcum:dif.map(v=>ac+=v), totalG, totalP, dTotal:totalP-totalG, pct: Math.abs(totalG)>1e-9? totalP/totalG-1 : null });
  });
  const sal=linhas.find(l=>l.k==="saldo");
  let ag=0, ap=0; const acum={ gab:sal.gab.map(v=>ag+=v), plan:sal.plan.map(v=>ap+=v) };
  const metricas={ gab:cmpMetricas(sal.gab,o.tma), plan:cmpMetricas(sal.plan,o.tma) };
  const L=k=>linhas.find(l=>l.k===k), diag={}, div=[];
  const rec=L("receita"), R=Math.max(1,Math.abs(rec? Math.max(rec.totalG,rec.totalP) : cmpSoma(gl.receita)), Math.abs(sal.totalG)), mat=0.004*R;
  const push=(linha,tipo,msg,impacto,extra={})=>div.push({ linha, tipo, msg, impacto:Math.abs(impacto), ...extra });
  CMP_LINHAS.forEach(k=>{
    const l=L(k); if(!l) return; const [nome,gen]=CMP_NOMES[k], G=l.gab, P=l.plan; let explicado=false, shiftS=null;
    const wG=cmpJanela(G), wP=cmpJanela(P);
    if(wG && wP) diag[k]={ ini:[wG.ini,wP.ini], fim:[wG.fim,wP.fim], com:[wG.com,wP.com], pico:[wG.pico,wP.pico], total:[l.totalG,l.totalP] };
    else diag[k]={ total:[l.totalG,l.totalP] };
    if(wG && wP){
      if(k==="obra"){
        // o formato (normalizado) da curva só vale como "diferente" se mudou de verdade: 1 mês de quantil não basta
        const a=wP.ini-wG.ini, b=wP.fim-wG.fim, ds=cmpDesloc(P,G), imp=0.5*cmpSoma(l.dif.map(Math.abs));
        if(ds && ds.s!==0 && ds.Eb<0.6*ds.E0 && ds.E0>0.05){ explicado=true; shiftS=ds.s; push(k,"desloca",`${nome} ${cmpMeses(ds.s)} ${ds.s>0?"depois":"antes"} na planilha (começa em ${wP.ini} e termina em ${wP.fim}, contra ${wG.ini} e ${wG.fim})`, imp, { meses:ds.s, mes0:wP.ini, mes1:wP.fim }) }
        else if(ds && ds.E0>0.12 && (a!==0||b!==0)){
          if(a!==0){ explicado=true; push(k,"inicio",`Obra começa ${cmpMeses(a)} ${a>0?"depois":"antes"} na planilha (mês ${wP.ini} contra ${wG.ini})`, imp, { meses:a }) }
          if(b-a!==0){ explicado=true; const dur=b-a; push(k,"prazo",`Prazo de obra ${cmpMeses(dur)} ${dur>0?"mais longo":"mais curto"} na planilha (${wP.fim-wP.ini+1} contra ${wG.fim-wG.ini+1} meses)`, imp, { meses:dur }) }
        }
      } else if(k==="receita"){
        const kk=wP.pico-wG.pico;
        if(kk!==0 && Math.max(...G)>0.2*cmpSoma(G.map(v=>Math.max(0,v)))){ explicado=true; push(k,"pico",`Recebimento das chaves e do repasse ${cmpMeses(kk)} ${kk>0?"depois":"antes"} na planilha (mês ${wP.pico} contra ${wG.pico})`, Math.max(G[wG.pico],P[wP.pico]), { meses:kk, mes0:wG.pico, mes1:wP.pico }) }
      }
      if(!explicado && k!=="obra"){
        const ds=cmpDesloc(P,G);
        if(ds && ds.s!==0 && ds.Eb<0.6*ds.E0 && ds.E0>0.12){ explicado=true; shiftS=ds.s; push(k,"desloca",`${nome} ${cmpMeses(ds.s)} ${ds.s>0?"depois":"antes"} na planilha`, 0.5*cmpSoma(l.dif.map(Math.abs)), { meses:ds.s }) }
      }
      if(k==="obra" && !explicado){
        // formato da curva: centro de massa relativo à janela
        const rel=w=> w.fim>w.ini? (w.com-w.ini)/(w.fim-w.ini) : 0.5, cg=rel(wG), cp=rel(wP);
        diag.obra.curva=[cg,cp]; diag.obra.dur=[wG.fim-wG.ini+1, wP.fim-wP.ini+1];
        // INCC: o quociente planilha/Gabarito cresce (ou cai) em ritmo constante ao longo dos meses
        const pts=[]; const mxG=Math.max(...G), mxP=Math.max(...P); for(let t=0;t<N;t++) if(G[t]>0.15*mxG && P[t]>0.15*mxP) pts.push([t,Math.log(P[t]/G[t])]);
        if(pts.length>=6){ const n=pts.length, mt=pts.reduce((s,q)=>s+q[0],0)/n, my=pts.reduce((s,q)=>s+q[1],0)/n;
          const sxx=pts.reduce((s,q)=>s+(q[0]-mt)*(q[0]-mt),0), sxy=pts.reduce((s,q)=>s+(q[0]-mt)*(q[1]-my),0), syy=pts.reduce((s,q)=>s+(q[1]-my)*(q[1]-my),0), sl=sxx>0? sxy/sxx : 0, r2=sxx>0&&syy>0? sxy*sxy/(sxx*syy) : 0;
          const anual=Math.exp(12*sl)-1;
          if(Math.abs(anual)>=0.01 && r2>0.6){ diag.obra.incc=anual; explicado=true; push(k,"incc",`Custo de obra cresce ${nf(Math.abs(anual)*100,1)} pontos a.a. mais ${anual>0?"rápido":"devagar"} na planilha (parece o INCC)`, Math.abs(l.dTotal), { pp:anual }) } }
        if(!explicado && Math.abs(cp-cg)>0.06){ explicado=true; push(k,"curva",`Gasto da obra concentrado mais ${cp>cg?"ao fim":"no início"} na planilha (centro em ${Math.round(cp*100)}% do prazo contra ${Math.round(cg*100)}%)`, 0.5*cmpSoma(l.dif.map(Math.abs)), { rel:[cg,cp] }) }
      }
    }
    // total
    const tot=l.dTotal;
    if(Math.abs(tot)>=mat && l.pct!=null && Math.abs(l.pct)>=0.03) push(k,"total",`${nome} ${nf(Math.abs(l.pct)*100,0)}% ${cmpAdj(gen,tot>0)} na planilha (${tot>0?"+":"−"}${mi(Math.abs(tot))})`, tot, { pct:l.pct });
    // janelas de meses
    if(!explicado || shiftS!=null){
      // depois de um deslocamento, compara a planilha com o Gabarito já alinhado
      const Gs=shiftS!=null? G.map((_,t)=> t-shiftS>=0&&t-shiftS<N? G[t-shiftS] : 0) : G, nota=shiftS!=null? " (descontado o deslocamento)" : "";
      const segs=cmpJanelas(P,Gs), act=wG&&wP? Math.max(wG.fim,wP.fim)-Math.min(wG.ini,wP.ini)+1 : N;
      segs.filter(s=>Math.abs(s.dif)>=mat && s.pct!=null && !(s.b-s.a+1>=0.7*act && Math.abs(tot)>=mat))
        .sort((x,y)=>Math.abs(y.dif)-Math.abs(x.dif)).slice(0,2)
        .forEach(s=>push(k,"janela",`${nome} ${nf(Math.abs(s.pct)*100,0)}% ${cmpAdj(gen,s.pct>0)} na planilha entre os meses ${s.a} e ${s.b}${nota}`, s.dif, { pct:s.pct, mes0:s.a, mes1:s.b }));
    }
  });
  div.sort((x,y)=>y.impacto-x.impacto);
  return { ok:true, N, desl:d, linhas, acum, metricas, divergencias:div.slice(0,10), diag, avisos:plan.avisos||[], tma:o.tma,
    zero: linhas.every(l=>Math.max(...l.dif.map(Math.abs))<1) };
}

/* ---------- sugestões de ajuste das premissas ---------- */
function comparaSugestoes(cmp, st, f){
  const out=[]; if(!cmp||!cmp.ok) return out;
  const F=st.fin, ob=cmp.diag.obra, rc=cmp.diag.receita, tr=cmp.diag.terreno, D=cmp.divergencias;
  const add=(k,rot,det,set,aprox)=>out.push({ k, rot, det, set, aprox:!!aprox });
  const r=(v,d)=>Math.round(v*Math.pow(10,d))/Math.pow(10,d);
  let obraFimDif=0;
  const dDes=D.find(d=>d.linha==="obra"&&d.tipo==="desloca"), dIni=D.find(d=>d.linha==="obra"&&d.tipo==="inicio"), dPra=D.find(d=>d.linha==="obra"&&d.tipo==="prazo");
  if(dDes){ obraFimDif=dDes.meses; add("prelanc","Início da obra",`Meses até o lançamento: ${F.prelanc} → ${Math.max(0,F.prelanc+dDes.meses)} (a obra e as vendas andam juntas)`,[["fin.prelanc",Math.max(0,Math.round(F.prelanc+dDes.meses))]]) }
  if(dIni){ obraFimDif+=dIni.meses; add("prelanc","Início da obra",`Meses até o lançamento: ${F.prelanc} → ${Math.max(0,F.prelanc+dIni.meses)}`,[["fin.prelanc",Math.max(0,Math.round(F.prelanc+dIni.meses))]]) }
  if(dPra){ obraFimDif+=dPra.meses; add("obra","Prazo de obra",`Prazo de obra: ${F.obra} → ${Math.max(1,F.obra+dPra.meses)} meses`,[["fin.obra",Math.max(1,Math.round(F.obra+dPra.meses))]]) }
  if(ob && ob.curva && D.some(d=>d.linha==="obra"&&d.tipo==="curva")){
    // pico da curva S que melhor reproduz o formato da planilha na janela de obra
    const L=cmp.linhas.find(l=>l.k==="obra"), i0=ob.ini[1], i1=ob.fim[1], n=Math.max(2,i1-i0+1), alvo=L.plan.slice(i0,i1+1).map(v=>Math.max(0,v)), sa=cmpSoma(alvo)||1;
    let bp=0.5, be=Infinity; for(let p=0.2;p<=0.8001;p+=0.025){ const w=flxForma(n,0,1,p); const e=w.reduce((s,v,t)=>s+Math.abs(v-(alvo[t]||0)/sa),0); if(e<be){ be=e; bp=p } }
    add("curva","Curva de obra",`Curva S com pico em ${Math.round(bp*100)}% do prazo`,[["flx.curva.modo","s"],["flx.curva.ini",0],["flx.curva.pico",r(bp,3)],["flx.curva.fim",1]]);
  }
  if(ob && ob.incc!=null){ const novo=Math.max(-0.1,Math.min(0.3,F.incc+ob.incc)); add("incc","INCC",`INCC: ${nf(F.incc*100,1)}% → ${nf(novo*100,1)}% a.a.`,[["fin.incc",r(novo,4)]],true) }
  const totObra=D.find(d=>d.linha==="obra"&&d.tipo==="total");
  if(totObra && ob.incc==null){
    if(st.orc && st.orc.modo==="param") add("fator","Custo de obra",`Obra ${nf(Math.abs(totObra.pct)*100,0)}% ${totObra.pct>0?"maior":"menor"} na planilha: ajuste os coeficientes do orçamento paramétrico`,null);
    else add("fator","Custo de obra",`Custo ÷ CUB: ${nf(F.fator,2)} → ${nf(F.fator*(1+totObra.pct),2)} ×`,[["fin.fator",r(F.fator*(1+totObra.pct),3)]],true);
  }
  const totTer=D.find(d=>d.linha==="terreno"&&d.tipo==="total");
  if(totTer && tr){ const novo=Math.max(0,(tr.total[1]-(f.outorga||0))/(1+F.itbi)); add("terreno","Terreno",`Terreno: ${mi(F.terreno)} → ${mi(novo)} (com ITBI e outorga da planilha)`,[["fin.terreno",Math.round(novo)]]) }
  const pico=D.find(d=>d.linha==="receita"&&d.tipo==="pico");
  if(pico && rc){
    const k=pico.meses-obraFimDif;
    if(k!==0){
      if(st.flx.receb.modo==="det") add("repasse","Repasse do banco",`Repasse: ${st.flx.receb.repasseMes} → ${Math.max(0,st.flx.receb.repasseMes+k)} meses após as chaves`,[["flx.receb.repasseMes",Math.max(0,Math.round(st.flx.receb.repasseMes+k))]]);
      else add("repasse","Mês das chaves",`No recebimento simples o saldo entra nas chaves; use o detalhado para atrasar o repasse em ${cmpMeses(k)}.`,null);
    }
  }
  if(st.flx.receb.modo==="det" && rc){
    const rl=cmp.linhas.find(l=>l.k==="receita"), t=f.launch;
    if(rl && t>=0 && rl.gab[t]>0 && rl.plan[t]>0 && Math.abs(rl.plan[t]/rl.gab[t]-1)>0.15 && Math.abs(rl.plan[t]-rl.gab[t])>0.004*Math.abs(rl.totalG)){
      const novo=Math.max(0,Math.min(0.6,st.flx.receb.ato*rl.plan[t]/rl.gab[t])); add("ato","Ato (sinal)",`Ato: ${nf(st.flx.receb.ato*100,1)}% → ${nf(novo*100,1)}% do preço`,[["flx.receb.ato",r(novo,4)]],true) }
  }
  return out;
}
/* grava uma sugestão no estudo; devolve quantos campos mudaram */
function comparaAplicar(st, sug){
  if(!sug || !sug.set) return 0; let n=0;
  sug.set.forEach(([path,v])=>{ const ks=path.split("."), last=ks.pop(); let o=st; for(const k of ks){ if(o==null) return; o=o[k] } if(o && o[last]!==v){ o[last]=v; n++ } });
  return n;
}

/* ---------- modelo de arquivo ---------- */
const CMP_MODELO_CAB = ["Mês","Receitas","Obra","Terreno","Indiretos","Saldo"];
function comparaModeloCSV(){ return plaCSVTexto(CMP_MODELO_CAB, [[0,"0,00","0,00","13.500.000,00","180.000,00","-13.680.000,00"]]) }
