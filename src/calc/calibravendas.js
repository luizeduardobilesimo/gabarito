/* ================= Fase E: calibrar os prêmios da tabela de vendas com uma tabela real =================
   Cálculo puro (sem DOM); a interface fica em src/ui/calibra.js. Nada muda no estudo até o usuário aplicar.
   Entrada: tabela de um lançamento (CSV/XLSX → matriz) com unidade, andar, área privativa e preço (ou preço/m²);
   opcionais: final, orientação (N, NE, L, SE, S, SO, O, NO · norte, nascente, poente…), tipologia, vista, cobertura.
   - calibCampos / calibMapa(cab) / calibLinhas(dados, mapa)  → mapeamento de colunas por nome e linhas normalizadas
   - calibraPremios(linhas, opts)  → regressão do log do preço/m² (MQO): preço base por tipologia (no 1º andar, orientação média),
        prêmio por andar (% por andar, com teto detectado), prêmio por direção (centrado: soma ponderada zero), vista (se houver dado)
        e cobertura (grupo próprio: o preço da cobertura já carrega o prêmio). Devolve coeficientes, R², erro médio e resíduos.
   - calibAplicar(st, res, o)      → grava no estudo (S.venda e preços do mix); calibModeloCSV()
   - vendaPadraoEmpresa / vendaSalvarPadrao / vendaAplicarPadrao → padrão da empresa em localStorage "gabarito.vendas.padrao" (troca por Supabase: docs/BACKEND.md)
   O prêmio de SOL não é calibrável sem as horas de sol da tabela de referência: o do estudo continua valendo. */

const CAL_DIRS = ["N","NE","L","SE","S","SO","O","NO"];
/* campos da tabela de vendas, na ordem de prioridade do mapeamento automático */
const CAL_CAMPOS = [
  { k:"precoM2",  rot:"Preço por m²", alias:["preco m2","preco por m2","valor m2","valor por m2","r m2","preco metro","preco unitario","preco do m2"] },
  { k:"preco",    rot:"Preço",        alias:["preco","valor","preco total","valor total","preco de venda","valor de venda","preco tabela","tabela"], obrig:true },
  { k:"area",     rot:"Área privativa", alias:["area privativa","area priv","privativa","area util","area","metragem","m2"], obrig:true },
  { k:"andar",    rot:"Andar",        alias:["andar","pavimento","pav","piso"] },
  { k:"unidade",  rot:"Unidade",      alias:["unidade","apto","apartamento","ap","un","numero","codigo"] },
  { k:"orient",   rot:"Orientação",   alias:["orientacao","orient","face","posicao solar","insolacao","fachada"] },
  { k:"tipologia",rot:"Tipologia",    alias:["tipologia","tipo","dormitorios","dorms","quartos","planta","modelo"] },
  { k:"vista",    rot:"Vista",        alias:["vista"] },
  { k:"cob",      rot:"Cobertura",    alias:["cobertura","cob","penthouse"] },
  { k:"final",    rot:"Final",        alias:["final","posicao","prumada","pos"] }
];
const calibRound = (v, d) => v==null||!isFinite(v)? v : Math.round(v*Math.pow(10,d))/Math.pow(10,d);
const calibMapa = cab => plaMapaAuto(cab, CAL_CAMPOS);

/* orientação em texto → "N" … "NO" (aceita norte, nascente, poente, N/L, NE…) */
function calibOrient(v){
  if(v==null||v==="") return null;
  const s=plaNorm(v).toUpperCase(); if(!s) return null;
  const M={NORTE:"N",SUL:"S",LESTE:"L",OESTE:"O",NASCENTE:"L",POENTE:"O",NORDESTE:"NE",NOROESTE:"NO",SUDESTE:"SE",SUDOESTE:"SO",NE:"NE",NO:"NO",SE:"SE",SO:"SO",N:"N",S:"S",L:"L",O:"O",E:"L",W:"O",NW:"NO",SW:"SO",NL:"NE",SL:"SE",NSL:null};
  if(M[s]) return M[s];
  const set=new Set(); s.split(" ").forEach(t=>{ const d=M[t]; if(d) d.split("").forEach(c=>set.add(c==="E"?"L":c)) });
  const has=c=>set.has(c);
  if(has("N")&&has("S")||has("L")&&has("O")) return null;
  if(has("N")&&has("L")) return "NE"; if(has("N")&&has("O")) return "NO"; if(has("S")&&has("L")) return "SE"; if(has("S")&&has("O")) return "SO";
  return set.size===1? [...set][0] : null;
}
const calibSim = v => { const s=plaNorm(v); return s!=="" && /^(s|sim|x|1|true|verdadeiro|yes|y|cob|cobertura)$/.test(s) };
const calibVistaTxt = v => { const s=plaNorm(v); if(!s) return null;
  if(/(sem|nenhum|obstru|interna|ruim|baix|fundos)/.test(s)) return 0;
  if(/(total|livre|panoram|mar|otima|excelente|alta|privilegi)/.test(s)) return 1;
  if(/(parcial|boa|media|lateral|regular)/.test(s)) return 0.5;
  return null };

/* linhas normalizadas: {linha, id, andar, area, precoM2, preco, final, orient, tip, vista, cob}; descartadas = [{linha, motivo}] */
function calibLinhas(dados, mapa, o={}){
  const off = o.offset || 2, g = (r,k)=> mapa[k]>=0? r[mapa[k]] : undefined, avisos=[], out=[], desc=[];
  mapa = {...mapa};
  if(!(mapa.precoM2>=0) && mapa.preco>=0){   // coluna de "preço" com valores pequenos = é preço por m²
    const vs=dados.map(r=>plaNum(r[mapa.preco])).filter(v=>v>0).sort((a,b)=>a-b);
    if(vs.length && vs[vs.length>>1] < 30000){ mapa.precoM2=mapa.preco; mapa.preco=-1; avisos.push("A coluna de preço tem valores pequenos: tratei como preço por m².") }
  }
  const vN=[];
  dados.forEach((r,i)=>{
    const linha=i+off, rd=k=>g(r,k);
    if(r.every(c=>c==null||String(c).trim()==="")) return;
    const area=plaNum(rd("area"),{pontoDecimal:true}), pm2=plaNum(rd("precoM2")), pt=plaNum(rd("preco"));
    let andar=plaNum(rd("andar")); const idRaw=rd("unidade"), idN=plaNum(idRaw);
    let final=rd("final")!=null? String(rd("final")).trim() : "";
    if((andar==null||!isFinite(andar)) && idN!=null && idN>=100 && idN<10000 && Number.isInteger(idN)){ andar=Math.floor(idN/100); if(!final) final=String(idN%100).padStart(2,"0") }
    const precoM2 = pm2>0? pm2 : (pt>0&&area>0? pt/area : null);
    if(!(area>0)){ desc.push({linha, motivo:"área ausente ou inválida"}); return }
    if(!(precoM2>0)){ desc.push({linha, motivo:"preço ausente ou inválido"}); return }
    if(precoM2<300||precoM2>300000){ desc.push({linha, motivo:`preço/m² fora do intervalo (${Math.round(precoM2)})`}); return }
    if(andar==null||!isFinite(andar)||andar<0||andar>200){ desc.push({linha, motivo:"andar ausente ou inválido"}); return }
    const tip=rd("tipologia")!=null? String(rd("tipologia")).trim() : "";
    const cob = (mapa.cob>=0 && calibSim(rd("cob"))) || /(cobert|penthouse|pent house)/.test(plaNorm(tip));
    const vr=rd("vista"); let vista=null;
    if(vr!=null && String(vr).trim()!==""){ const vn=plaNum(vr); if(vn!=null){ vista={n:vn}; vN.push(vn) } else vista={v:calibVistaTxt(vr)} }
    out.push({linha, id: idRaw!=null&&String(idRaw).trim()!==""? String(idRaw).trim() : String(linha), andar:Math.round(andar), area, precoM2, preco:pt>0&&pm2>0? pt : precoM2*area, final, orient:calibOrient(rd("orient")), tip, vista, cob:!!cob});
  });
  // vista numérica: escala 0–1 pelo mínimo e máximo da tabela; vista em texto: palavras-chave
  // vista de 0 a 1 entra como está (é a escala do app); outras escalas (1–5, 1–10) são normalizadas pelo mínimo e máximo da tabela
  const mn=Math.min(...vN), mx=Math.max(...vN), em01=vN.length>0 && mn>=0 && mx<=1;
  out.forEach(l=>{ const v=l.vista; l.vista = !v? null : v.n!=null? (em01? v.n : mx>mn? (v.n-mn)/(mx-mn) : null) : v.v; });
  if(!out.length && !desc.length) avisos.push("Nenhuma linha de dados encontrada.");
  return { linhas:out, descartadas:desc, avisos, mapa };
}

/* ---------- mínimos quadrados ---------- */
function calibInv(A){   // inversa por Gauss-Jordan com pivô parcial
  const n=A.length, M=A.map((r,i)=>[...r, ...Array.from({length:n},(_,j)=>i===j?1:0)]);
  for(let c=0;c<n;c++){
    let p=c; for(let r=c+1;r<n;r++) if(Math.abs(M[r][c])>Math.abs(M[p][c])) p=r;
    if(Math.abs(M[p][c])<1e-14) return null;
    [M[c],M[p]]=[M[p],M[c]]; const d=M[c][c]; for(let j=0;j<2*n;j++) M[c][j]/=d;
    for(let r=0;r<n;r++) if(r!==c){ const f=M[r][c]; if(f) for(let j=0;j<2*n;j++) M[r][j]-=f*M[c][j] }
  }
  return M.map(r=>r.slice(n));
}
function calibMQO(X, y){
  const n=X.length, p=X[0].length, A=Array.from({length:p},()=>new Array(p).fill(0)), b=new Array(p).fill(0);
  for(let i=0;i<n;i++){ const x=X[i]; for(let a=0;a<p;a++){ const xa=x[a]; if(!xa) continue; b[a]+=xa*y[i]; for(let c=a;c<p;c++) A[a][c]+=xa*x[c] } }
  let tr=0; for(let a=0;a<p;a++){ for(let c=0;c<a;c++) A[a][c]=A[c][a]; tr+=A[a][a] }
  for(let a=0;a<p;a++) A[a][a]+=1e-9*tr/p;
  const inv=calibInv(A); if(!inv) return null;
  const beta=inv.map(r=>r.reduce((s,v,j)=>s+v*b[j],0));
  let sse=0; for(let i=0;i<n;i++){ let e=y[i]; for(let a=0;a<p;a++) e-=beta[a]*X[i][a]; sse+=e*e }
  return { beta, inv, sse };
}
const calibMed = a => { const v=a.filter(x=>x!=null&&isFinite(x)).sort((p,q)=>p-q); if(!v.length) return 0; const h=v.length>>1; return v.length%2? v[h] : (v[h-1]+v[h])/2 };

/* erro médio |real/previsto − 1| com a FÓRMULA DO APP (preço = base × (1 + prêmios)); a base de cada grupo é refeita em escala log */
function calibErroApp(L, gi, par){
  const prem = l => { let p=Math.max(0,l.andar-1)*par.andarPct; if(par.andarTeto!=null) p=Math.min(par.andarTeto,p);
    if(l.orient && par.orient && par.orient[l.orient]!=null) p+=par.orient[l.orient];
    if(par.vistaPct && l.vista!=null) p+=par.vistaPct*Math.max(-1,Math.min(1,(l.vista-par.vistaMed)/0.25));
    return p };
  const s={}, c={}; L.forEach((l,i)=>{ const k=gi[i]; s[k]=(s[k]||0)+Math.log(l.precoM2)-Math.log(Math.max(0.2,1+prem(l))); c[k]=(c[k]||0)+1 });
  let e=0; L.forEach((l,i)=>{ const B=Math.exp(s[gi[i]]/c[gi[i]]); e+=Math.abs(l.precoM2/(B*Math.max(0.2,1+prem(l)))-1) });
  return e/L.length;
}

/* ---------- a calibração ---------- */
function calibraPremios(linhas, o={}){
  o={ tetoAuto:true, minDir:2, usaOrient:true, usaVista:true, minLinhas:6, atual:null, ...o };
  const avisos=[], L=(linhas||[]).filter(l=>l && l.area>0 && l.precoM2>0 && l.andar!=null && isFinite(l.andar));
  if(L.length<o.minLinhas) return { ok:false, motivo:`Poucas linhas válidas (${L.length}): preciso de pelo menos ${o.minLinhas}.`, n:L.length, avisos };
  const n=L.length, y=L.map(l=>Math.log(l.precoM2));
  // grupos: tipologia (cobertura é grupo próprio)
  const gNomes=[], gChaves=[]; const gi=L.map(l=>{ const nome=l.cob? "Cobertura" : (String(l.tip||"").trim() || "Todas"), ch=plaNorm(nome); let k=gChaves.indexOf(ch); if(k<0){ k=gChaves.length; gChaves.push(ch); gNomes.push(nome) } return k });
  const G=gNomes.length;
  // orientação: direções com dados suficientes; a mais frequente é a referência
  const cd={}; L.forEach(l=>{ if(l.orient) cd[l.orient]=(cd[l.orient]||0)+1 });
  const dirs=CAL_DIRS.filter(d=>(cd[d]||0)>=o.minDir);
  const usaOr = o.usaOrient && dirs.length>=2;
  const ref = usaOr? dirs.reduce((a,b)=>cd[b]>cd[a]?b:a, dirs[0]) : null;
  const colDir = usaOr? dirs.filter(d=>d!==ref) : [];
  const temSem = usaOr && L.some(l=>!l.orient || !dirs.includes(l.orient)) ;
  // vista
  const vs=L.map(l=>l.vista).filter(v=>v!=null&&isFinite(v)), vMed=calibMed(vs), vVar=vs.length? vs.reduce((s,v)=>s+(v-vMed)*(v-vMed),0)/vs.length : 0;
  const usaVista = o.usaVista && vs.length>=0.6*n && vVar>1e-4;
  // andar
  const aMin=Math.min(...L.map(l=>l.andar)), aMax=Math.max(...L.map(l=>l.andar)), temAndar = aMax-aMin>=2;
  if(!temAndar) avisos.push("Os andares da tabela variam pouco: não dá para estimar o prêmio por andar.");
  const montar = K => L.map((l,i)=>{ const x=new Array(G).fill(0); x[gi[i]]=1;
    colDir.forEach(d=>x.push(l.orient===d?1:0)); if(temSem) x.push(!l.orient||!dirs.includes(l.orient)?1:0);
    if(temAndar) x.push(Math.min(Math.max(0,l.andar-1),K));
    if(usaVista) x.push(l.vista==null? 0 : l.vista-vMed);
    return x });
  const iAndar = G+colDir.length+(temSem?1:0), iVista = iAndar+(temAndar?1:0);
  // teto do andar: K que minimiza o erro; sem ganho claro sobre "sem teto", fica sem teto
  const Kmax = Math.max(1,aMax-1); let K=Kmax, fit=null;
  if(temAndar){
    const full=calibMQO(montar(Kmax), y); if(!full) return { ok:false, motivo:"Os dados não permitem o ajuste (colunas repetidas).", n, avisos };
    fit=full;
    if(o.tetoAuto){ let bk=Kmax, bf=full; for(let k=2;k<Kmax;k++){ const f=calibMQO(montar(k),y); if(f && f.sse<bf.sse){ bf=f; bk=k } }
      if(bk!==Kmax && bf.sse<full.sse*0.995){ K=bk; fit=bf } }
  } else { fit=calibMQO(montar(Kmax), y); if(!fit) return { ok:false, motivo:"Os dados não permitem o ajuste.", n, avisos } }
  const beta=fit.beta, p=beta.length, gl=Math.max(1,n-p), s2=fit.sse/gl, se=j=>Math.sqrt(Math.max(0,s2*fit.inv[j][j]));
  // orientação centrada (soma ponderada zero)
  const theta={}; if(usaOr){ theta[ref]=0; colDir.forEach((d,j)=>theta[d]=beta[G+j]) }
  const nd=dirs.reduce((s,d)=>s+cd[d],0), thBar = usaOr? dirs.reduce((s,d)=>s+cd[d]*theta[d],0)/Math.max(1,nd) : 0;
  const orient={}; CAL_DIRS.forEach(d=>{ orient[d]={ v: usaOr&&dirs.includes(d)? Math.exp(theta[d]-thBar)-1 : null, n: cd[d]||0 } });
  // andar
  let andar=null;
  if(temAndar){ const b=beta[iAndar], pct=Math.exp(b)-1; andar={ pct, ep:Math.exp(b)*se(iAndar), beta:b, K: K<Kmax? K : Kmax, teto: K<Kmax? pct*K : null, comTeto:K<Kmax, aMin, aMax };
    if(pct<0) avisos.push("O preço cai com o andar nesta tabela (prêmio negativo): confira as colunas.");
    if(!(K<Kmax) && aMax-aMin<8) avisos.push("Poucos andares na tabela: o teto do prêmio não pôde ser avaliado.") }
  const vista = usaVista? { gamma:beta[iVista], pct:Math.exp(0.25*beta[iVista])-1, n:vs.length, med:vMed } : null;
  if(o.usaVista && !usaVista && vs.length) avisos.push("Vista sem variação suficiente na tabela: o prêmio de vista continua o atual.");
  // grupos (preço base no 1º andar, orientação média, vista mediana)
  const tipologias=[]; let cobGrupo=null;
  gNomes.forEach((nome,k)=>{ const idx=[]; gi.forEach((g,i)=>{ if(g===k) idx.push(i) });
    const ent={ nome, chave:gChaves[k], n:idx.length, base:Math.exp(beta[k]+thBar), ep:se(k), areaMedia: idx.reduce((s,i)=>s+L[i].area,0)/idx.length, cob: nome==="Cobertura" && gChaves[k]==="cobertura" };
    if(idx.length<3) avisos.push(`“${nome}” tem só ${idx.length} unidade${idx.length>1?"s":""}: o preço base é pouco confiável.`);
    if(ent.cob) cobGrupo=ent; else tipologias.push(ent) });
  let cob=null;
  if(cobGrupo){ const outros=tipologias.reduce((s,t)=>s+t.base*t.n,0)/Math.max(1,tipologias.reduce((s,t)=>s+t.n,0)); cob={ base:cobGrupo.base, n:cobGrupo.n, areaMedia:cobGrupo.areaMedia, premio: outros>0? cobGrupo.base/outros-1 : null } }
  // qualidade
  const ym=y.reduce((a,b)=>a+b,0)/n, sst=y.reduce((s,v)=>s+(v-ym)*(v-ym),0), r2=sst>0? 1-fit.sse/sst : 0, r2aj=sst>0? 1-(fit.sse/gl)/(sst/(n-1)) : 0;
  const Xf=montar(K), pred=Xf.map(x=>x.reduce((e,v,j)=>e+beta[j]*v,0));
  const residuos=L.map((l,i)=>({ linha:l.linha, id:l.id, andar:l.andar, tip:gNomes[gi[i]], real:l.precoM2, pred:Math.exp(pred[i]), res:Math.exp(y[i]-pred[i])-1 }));
  const pa={}; residuos.forEach(r=>{ const a=pa[r.andar]=pa[r.andar]||{andar:r.andar, n:0, soma:0}; a.n++; a.soma+=r.res });
  const porAndar=Object.values(pa).map(a=>({andar:a.andar, n:a.n, res:a.soma/a.n})).sort((a,b)=>a.andar-b.andar);
  if(r2<0.5) avisos.push(`R² baixo (${Math.round(r2*100)}%): o preço depende de outras coisas além de tipologia, andar e orientação.`);
  // comparação com a fórmula do app: calibrado × atual
  const parCal={ andarPct: andar? andar.pct : 0, andarTeto: andar&&andar.comTeto? andar.teto : null, orient:Object.fromEntries(CAL_DIRS.filter(d=>orient[d].v!=null).map(d=>[d,orient[d].v])), vistaPct: vista? vista.pct : 0, vistaMed:vMed };
  const erroMedio=calibErroApp(L, gi, parCal);
  let erroAtual=null; if(o.atual){ const A=o.atual; erroAtual=calibErroApp(L, gi, { andarPct:A.andarPct||0, andarTeto:A.andarTeto, orient:A.orient||{}, vistaPct:A.vistaPct||0, vistaMed:vMed }) }
  return { ok:true, n, p, r2, r2aj, erroMedio, erroAtual, rmse:Math.sqrt(s2), andar, orient, vista, cob, tipologias, residuos, porAndar, avisos,
    refDir:ref, usouOrient:usaOr, dirs, semOrient: L.filter(l=>!l.orient).length };
}

/* ---------- aplicar ao estudo ---------- */
/* nome do mix ↔ tipologia da tabela: igual, ou mesmo número de dormitórios/studio, ou um contém o outro */
function calibChaveTip(nome){ const n=plaNorm(nome); if(/(studio|kitnet|loft|conjugado)/.test(n)) return "studio"; const m=n.match(/(\d)\s*(dorm|quarto|suite|qts|dq|d\b|q\b)/); return m? m[1]+"d" : n }
function calibCasaMix(nome, mix, usados){
  const k=calibChaveTip(nome), n=plaNorm(nome);
  let j=mix.findIndex((u,i)=>!usados.has(i) && plaNorm(u.nome)===n);
  if(j<0) j=mix.findIndex((u,i)=>!usados.has(i) && calibChaveTip(u.nome)===k);
  if(j<0) j=mix.findIndex((u,i)=>{ if(usados.has(i)) return false; const a=plaNorm(u.nome); return a&&n&&(a.includes(n)||n.includes(a)) });
  return j;
}
/* grava no estudo; devolve a lista do que mudou ([{rot, de, para}]). o = {andar, orient, vista, mix} (todos ligados por padrão) */
function calibAplicar(st, res, o={}){
  const opt={ andar:true, orient:true, vista:true, mix:true, ...o }, V=st.venda, P=st.produto, mud=[];
  if(!res||!res.ok) return mud;
  const set=(obj,k,v,rot)=>{ if(v==null||!isFinite(v)||obj[k]===v) return; mud.push({rot, de:obj[k], para:v}); obj[k]=v };
  if(opt.andar && res.andar){ const a=res.andar; set(V,"andarPct",calibRound(a.pct,4),"Prêmio por andar");
    const topo = a.pct*Math.max(1,a.aMax-1);
    if(a.teto!=null) set(V,"andarTeto",calibRound(a.teto,4),"Teto do andar"); else if(V.andarTeto<topo) set(V,"andarTeto",calibRound(topo,4),"Teto do andar") }
  if(opt.orient && res.usouOrient){ V.orient={...V.orient}; CAL_DIRS.forEach(d=>{ const v=res.orient[d].v; if(v!=null) set(V.orient,d,calibRound(v,4),"Orientação "+d) }) }
  if(opt.vista && res.vista) set(V,"vistaPct",calibRound(Math.max(0,res.vista.pct),4),"Vista");
  if(opt.mix){
    if(res.cob){ set(P.cob,"preco",Math.round(res.cob.base),"Preço da cobertura (R$/m²)"); set(V,"cobPct",0,"Prêmio extra da cobertura") }
    const usados=new Set(), tip=res.tipologias;
    if(tip.length===1 && tip[0].nome==="Todas"){   // tabela sem tipologia: o preço médio do mix passa a ser o da tabela, mantendo as proporções
      const tot=P.mix.reduce((s,u)=>s+u.area*u.qtd,0), med=tot>0? P.mix.reduce((s,u)=>s+u.preco*u.area*u.qtd,0)/tot : 0;
      if(med>0){ const k=tip[0].base/med; P.mix.forEach(u=>set(u,"preco",Math.round(u.preco*k),"Preço "+u.nome+" (R$/m²)")) }
    } else tip.forEach(t=>{ const j=calibCasaMix(t.nome, P.mix, usados); if(j>=0){ usados.add(j); set(P.mix[j],"preco",Math.round(t.base),"Preço "+P.mix[j].nome+" (R$/m²)") } });
  }
  return mud;
}
/* tipologias da tabela sem correspondência no mix do estudo (para avisar) */
function calibSemMix(st, res){
  if(!res||!res.ok) return []; const usados=new Set(), tip=res.tipologias;
  if(tip.length===1 && tip[0].nome==="Todas") return [];
  return tip.filter(t=>{ const j=calibCasaMix(t.nome, st.produto.mix, usados); if(j>=0){ usados.add(j); return false } return true }).map(t=>t.nome);
}

/* ---------- modelo de arquivo ---------- */
const CAL_MODELO_CAB = ["Unidade","Andar","Área privativa (m²)","Preço (R$)","Orientação","Tipologia","Vista","Cobertura"];
function calibModeloCSV(){ return plaCSVTexto(CAL_MODELO_CAB, [["1201",12,"65,5","785.000,00","NE","2 dorm.","0,7","Não"]]) }

/* ---------- padrão da empresa (localStorage; troca por Supabase em docs/BACKEND.md) ---------- */
function vendaPadraoEmpresa(){ const v=LS.get("gabarito.vendas.padrao"); return v && typeof v==="object" && v.andarPct!=null ? v : null }
/* grava o que está no estudo (já aplicado) como padrão: vale para estudos novos (DEF.venda) */
function vendaSalvarPadrao(st, origem){
  const V=st.venda, reg={ andarPct:V.andarPct, andarTeto:V.andarTeto, orient:clone(V.orient), vistaPct:V.vistaPct, cobPct:V.cobPct,
    mix: Object.fromEntries(st.produto.mix.map(u=>[u.nome,u.preco])), cobPreco: st.produto.cob.preco, salvo:new Date().toISOString(), origem: origem||null };
  try{ localStorage.setItem("gabarito.vendas.padrao", JSON.stringify(reg)) }catch(e){ return false }
  ["andarPct","andarTeto","vistaPct","cobPct"].forEach(k=>DEF.venda[k]=reg[k]); DEF.venda.orient=clone(reg.orient);
  return true;
}
/* traz o padrão da empresa para o estudo atual (prêmios e preços do mix de mesmo nome) */
function vendaAplicarPadrao(st){
  const p=vendaPadraoEmpresa(); if(!p) return false;
  ["andarPct","andarTeto","vistaPct","cobPct"].forEach(k=>{ if(typeof p[k]==="number") st.venda[k]=p[k] });
  if(p.orient) st.venda.orient={...st.venda.orient, ...p.orient};
  if(p.mix) st.produto.mix.forEach(u=>{ if(typeof p.mix[u.nome]==="number") u.preco=p.mix[u.nome] });
  if(typeof p.cobPreco==="number") st.produto.cob.preco=p.cobPreco;
  return true;
}
