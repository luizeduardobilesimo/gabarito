/* ================= potencial do terreno e otimizador de produto ================= */
const MIX_PRESETS = {
  atual:   { nome:"Tipologias atuais", tips:null },
  compacto:{ nome:"Compacto", tips:[{nome:"Studio",area:30,w:0.45,pf:1.14,sac:3},{nome:"1 dorm.",area:44,w:0.55,pf:1.07,sac:4}] },
  familia: { nome:"Família", tips:[{nome:"2 dorm.",area:64,w:0.6,pf:1.0,sac:6},{nome:"3 dorm.",area:88,w:0.4,pf:0.97,sac:9}] },
  alto:    { nome:"Alto padrão", tips:[{nome:"3 suítes",area:125,w:0.6,pf:1.1,sac:14},{nome:"4 suítes",area:170,w:0.4,pf:1.14,sac:22}] }
};
function basePrice(st){ const mx=st.produto.mix, a=mx.reduce((s,u)=>s+u.area*u.qtd,0); return a? mx.reduce((s,u)=>s+u.area*u.qtd*u.preco,0)/a : 10000 }
function presetMix(st, key, N){
  const pr=MIX_PRESETS[key]; if(!pr.tips){ const cur=st.produto.mix, tot=cur.reduce((s,u)=>s+u.qtd,0)||1; return distrib(cur.map(u=>({...u, w:u.qtd/tot})), N, u=>({nome:u.nome,area:u.area,preco:u.preco,sac:u.sac||0})) }
  const bp=basePrice(st); return distrib(pr.tips, N, t=>({nome:t.nome,area:t.area,preco:Math.round(bp*t.pf/50)*50,sac:t.sac}));
}
function distrib(tips, N, mk){
  const raw=tips.map(t=>t.w*N), q=raw.map(Math.floor); let rest=N-q.reduce((a,b)=>a+b,0);
  raw.map((r,i)=>[r-q[i],i]).sort((a,b)=>b[0]-a[0]).forEach(([_,i])=>{ if(rest>0){ q[i]++; rest-- } });
  return tips.map((t,i)=>({...mk(t), qtd:q[i]})).filter(u=>u.qtd>0);
}
function potencial(st, m){
  const R=st.regras, P=st.produto, A=m.A, hEmb=P.peTerreo+P.garAcima*P.peGar;
  const compMax=R.caMax*A, compBas=R.caBas*A;
  const pavH=Math.max(0,Math.floor((R.hMax-hEmb)/P.pe));
  const brutoPorCA = compMax/(1-R.ncTipo) - m.lojaA; // área bruta de pavimentos tipo que o CA permite
  const brutoPorVol = R.toTorre*A*pavH;           // limite pela projeção x altura
  const bruto=Math.max(0,Math.min(brutoPorCA, brutoPorVol)), limita = brutoPorCA<=brutoPorVol? "ca" : "altura";
  const priv=bruto*P.efic + m.lojaPriv, area=(m.mixPriv/Math.max(1,m.mixUn))||70, un=Math.floor(bruto*P.efic/area);
  return {compMax, compBas, pavH, bruto, priv, un, limita, vgv: bruto*P.efic*basePrice(st) + m.lojaPriv*st.fin.precoLoja,
    uso:{ ca:m.CA/Math.max(1e-9,R.caMax), to:m.TO/Math.max(1e-9,R.toEmb), h:m.H/Math.max(1e-9,R.hMax), priv:m.priv/Math.max(1,priv) } };
}
function maxPavFast(st){ // maior nº de pavimentos (iguais) que respeita gabarito e CA — busca binária
  const ok=n=>{ const m=massing(st,{pav:n}); return m.H<=st.regras.hMax+1e-6 && m.CA<=st.regras.caMax+1e-6 && m.T.every(t=>t.A>1) };
  if(!ok(1)) return 0; let lo=1, hi=80; while(lo<hi){ const mid=Math.ceil((lo+hi)/2); if(ok(mid)) lo=mid; else hi=mid-1 } return lo;
}
const OBJ = { lucro:["Lucro",f=>f.lucro], margem:["Margem",f=>f.margem], tir:["TIR",f=>f.tirA??-1], vpl:["VPL",f=>f.vpl] };

/* ---------- critérios extras (item 1.3) ----------
   Sol médio das unidades: usa unidadesSolMedio(st, m) quando existir (módulo de unidades).
   Sem ela, um PROXY documentado: horas de sol direto no solstício de inverno do hemisfério do lote (6h–18h, a cada 30 min),
   nas fachadas das torres (média ponderada pelo comprimento de cada fachada, a 15%, 50% e 85% da altura dos pavimentos tipo),
   com sombra das outras torres e do entorno. Não considera a posição de cada unidade nem o interior. */
function otimSolVetores(st){
  const lat=(+st.lote.lat||0)*Math.PI/180, n= st.lote.lat<0? 172 : 355; // 21/jun ou 21/dez
  const dec=23.44*Math.PI/180*Math.sin(2*Math.PI*(284+n)/365), th=(+st.lote.norte||0)*Math.PI/180;
  const north=[Math.sin(th),Math.cos(th)], east=[Math.cos(th),-Math.sin(th)], out=[];
  for(let h=6; h<=18+1e-9; h+=0.5){ const H=(h-12)*15*Math.PI/180;
    const alt=Math.asin(Math.sin(lat)*Math.sin(dec)+Math.cos(lat)*Math.cos(dec)*Math.cos(H)); if(alt<0.05) continue;
    const az=Math.atan2(Math.sin(H), Math.cos(H)*Math.sin(lat)-Math.tan(dec)*Math.cos(lat))+Math.PI;
    const e=Math.sin(az)*Math.cos(alt), nn=Math.cos(az)*Math.cos(alt);
    out.push({x:east[0]*e+north[0]*nn, y:east[1]*e+north[1]*nn, z:Math.sin(alt), t:Math.tan(alt)}) }
  return out;
}
function otimSolProxy(st, m){
  const suns=otimSolVetores(st), P=st.produto, T=(m.T||[]).filter(t=>t.plate&&t.plate.length>2);
  if(!T.length || !suns.length) return 0;
  const box=p=>{ const xs=p.map(q=>q[0]), ys=p.map(q=>q[1]); return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)] };
  const prs=[...T.map(t=>({poly:t.plate, z1:t.H, own:t.i})), ...(st.entorno||[]).filter(e=>e.pts&&e.pts.length>2).map(e=>({poly:entPoly(e), z1:+e.h||0, own:-1}))];
  prs.forEach(p=>p.bb=box(p.poly));
  let sum=0, wsum=0;
  T.forEach(t=>{ const pl=t.plate, ccw=G.sArea(pl)>0, tipoH=Math.max(P.pe, t.pav*P.pe);
    for(let i=0;i<pl.length;i++){ const a=pl[i], b=pl[(i+1)%pl.length], dx=b[0]-a[0], dy=b[1]-a[1], L=Math.hypot(dx,dy); if(L<1) continue;
      const n= ccw? [dy/L,-dx/L] : [-dy/L,dx/L], mid=[(a[0]+b[0])/2+n[0]*0.2, (a[1]+b[1])/2+n[1]*0.2];
      for(const fz of [0.15,0.5,0.85]){ const z=m.hEmb+fz*tipoH; let lit=0;
        for(const s of suns){ if(n[0]*s.x+n[1]*s.y<0.05) continue; let sh=false;
          for(const q of prs){ if(q.own===t.i || q.z1<=z) continue; const d=(q.z1-z)/s.t, hz=Math.hypot(s.x,s.y)||1, e=[mid[0]+s.x/hz*d, mid[1]+s.y/hz*d];
            if(Math.max(mid[0],e[0])<q.bb[0]||Math.min(mid[0],e[0])>q.bb[2]||Math.max(mid[1],e[1])<q.bb[1]||Math.min(mid[1],e[1])>q.bb[3]) continue;
            if(G.segPolyHit(mid,e,q.poly)){ sh=true; break } }
          if(!sh) lit++ }
        sum+=lit*0.5*L; wsum+=L } } });
  return wsum? sum/wsum : 0;
}
function otimSol(st, m, real){
  if(real && typeof unidadesSolMedio==="function"){ try{ const v=unidadesSolMedio(st,m); const h= typeof v==="number"? v : v && +(v.media ?? v.sol ?? v.h); if(isFinite(h)) return {h, fonte:"unidades"} }catch(e){} }
  return {h:otimSolProxy(st,m), fonte:"proxy"};
}
/* índice de conforto ao vento (opcional e lento): vento 2D do clima.js na altura do pedestre, 1 − fração do lote com vento forte (> 1,3× o de referência).
   Roda poucas iterações (aproximado) e devolve o estado do vento da tela como estava. */
function otimVento(st, m, passos=200){
  if(typeof windSetup!=="function" || typeof WIND==="undefined") return null;
  const keep={...WIND};
  try{ WIND.sig=null; windSetup(st,m); windStep(passos); const s=windStats(st); return s&&s.n? 1-s.hi : null }
  catch(e){ return null }
  finally{ for(const k in WIND) delete WIND[k]; Object.assign(WIND, keep) }
}
/* malha estrutural (opcional): usa estruturaMalhas(st, m) do módulo de estrutura, quando existir */
function otimMalha(st, m){
  if(typeof estruturaMalhas!=="function") return null;
  try{ const r=estruturaMalhas(st,m), x=Array.isArray(r)? r[0] : r && (r.melhor||r.best||r); if(!x || typeof x!=="object") return null;
    return {nome:String(x.nome||x.id||x.label||"malha"), custo:isFinite(+x.custo)? +x.custo : null, vao:isFinite(+x.vao)? +x.vao : null} }catch(e){ return null }
}
const otimKey=r=>[r.nT,r.pk,r.N,r.pav,r.sub,r.gac].join("|");

let OTIM=null;
/* otimizar(opts, onProg?, onDone?, ctx?) → Promise do resultado (também entregue a onDone).
   Puro (sem DOM): roda no Web Worker. ctx = {st, m} (padrão: S e o último modelo da tela; sem eles, calcula).
   opts: {obj, torres, tipologias, unidades} + multicritério {mc=true, paretoMax=8, tempoMax=9000 ms, vento=false, malha=false}.
   Resultado serializável: {res (as melhores pelo objetivo, conferidas — igual ao otimizador antigo), pts (estimativas de todas as combinações),
   pareto:{pts (conferidas com a garagem real), criterios}, solFonte, …}. */
function otimizar(opts, onProg, onDone, ctx={}){
  opts = {obj:"lucro", ...(opts||{})};
  const prog = typeof onProg==="function"? onProg : ()=>{};
  const base=clone(ctx.st||S);
  const mNow = ctx.m || (typeof window!=="undefined" && window._last && window._last.m) || compute(base);
  const k = mNow.vagasLay && mNow.vagasEst? Math.min(1, (mNow.vagasLay-(mNow.vf?mNow.vf.count:0))/Math.max(1,mNow.vagasEst-(mNow.vf?mNow.vf.count:0))) : 0.75;
  const mc = opts.mc!==false;
  const nTs = opts.torres? [1,2,3] : [base.produto.torres.length];
  const presets = opts.tipologias? Object.keys(MIX_PRESETS) : ["atual"];
  const Ns = opts.unidades? [2,3,4,5,6,8] : [base.produto.mix.reduce((s,u)=>s+u.qtd,0)];
  const gars=[]; for(let a=0;a<=4;a++) for(let b=0;b<=3;b++) gars.push([a,b]); gars.sort((x,y)=>(x[0]*1.6+x[1])-(y[0]*1.6+y[1]));
  const jobs=[]; nTs.forEach(nT=>presets.forEach(pk=>Ns.forEach(N=>jobs.push({nT,pk,N}))));
  const res=[], pts=[]; let i=0; const t0=performance.now(); const score=OBJ[opts.obj][1];
  let resolve; const done=new Promise(r=>resolve=r);
  const finish=o=>{ OTIM=o; if(typeof onDone==="function") onDone(o); resolve(o) };
  const step=()=>{
    const ts=performance.now();
    while(i<jobs.length && performance.now()-ts<40){
      const {nT,pk,N}=jobs[i++]; const st=clone(base); st.produto.mix=presetMix(base,pk,N); if(!st.produto.mix.length) continue;
      let best=null, tested=0;
      for(const [sub,gac] of gars){
        st.produto.subsolos=sub; st.produto.garAcima=gac; st.produto.torres=Array.from({length:nT},()=>({pav:4}));
        const pmax=maxPavFast(st); if(pmax<2) continue;
        for(const pav of [...new Set([pmax, pmax-1, pmax-3, Math.ceil(pmax*0.7)])].filter(p=>p>=2)){
          st.produto.torres=Array.from({length:nT},()=>({pav}));
          const m=massing(st); if(!m.T.every(t=>t.fit)) continue;
          const okVg = m.vagasEst*k >= m.vagasReq;
          if(!okVg && !mc) continue;
          if(m.minApto<st.regras.aptoMin) continue;
          const f=finance(st,m), sc=score(f);
          // multicritério: guarda todas as combinações dentro das regras (inclusive as que não atingem as vagas — é um dos critérios)
          if(mc) pts.push({key:otimKey({nT,pk,N,pav,sub,gac}), nT, pk, N, pav, sub, gac, mix:clone(st.produto.mix), units:m.units, vagas:Math.floor(m.vagasEst*k), req:m.vagasReq,
            lucro:f.lucro, margem:f.margem, tir:f.tirA, vpl:f.vpl, vgv:f.vgv, sol:otimSolProxy(st,m), est:true});
          if(!okVg) continue;
          tested++;
          if(!best || sc>best.sc) best={sc, nT, pk, N, pav, sub, gac, mix:clone(st.produto.mix), units:m.units, priv:m.priv, vagas:Math.floor(m.vagasEst*k), req:m.vagasReq, CA:m.CA, H:m.H, lucro:f.lucro, margem:f.margem, tir:f.tirA, vpl:f.vpl, vgv:f.vgv};
        }
        if(tested>=8) break;
      }
      if(best) res.push(best);
    }
    prog(0.6*i/jobs.length);
    if(i<jobs.length) setTimeout(step,0);
    else { res.sort((a,b)=>b.sc-a.sc); prog(0.6); validar(res.slice(0,14), out=>{
      const o={res:out, obj:opts.obj, k, ms:performance.now()-t0, testadas:res.length};
      if(!mc) return finish(o);
      multi(out, o) }) }
  };
  const stOf=r=>{ const st=clone(base); st.produto.mix=clone(r.mix); st.produto.subsolos=r.sub; st.produto.garAcima=r.gac; st.produto.torres=Array.from({length:r.nT},()=>({pav:r.pav})); return st };
  const extras=(st,m,r)=>{ const s=otimSol(st,m,true); r.sol=s.h; r.solFonte=s.fonte;
    if(opts.vento){ const v=otimVento(st,m); if(v!=null) r.vento=v }
    if(opts.malha){ const x=otimMalha(st,m); if(x){ r.malha=x; if(x.custo!=null) r.malhaCusto=x.custo } } return r };
  // confirma as melhores com o layout real da garagem (acrescenta subsolo/garagem se faltar vaga)
  const validar=(list, done)=>{ let j=0; const out=[], R=base.regras;
    const stepV=()=>{ const ts=performance.now();
      while(j<list.length && out.length<5 && performance.now()-ts<60){ const r=list[j++]; const st=stOf(r);
        let m=compute(st,{quick:true}), t=0;
        while(m.vagas<m.vagasReq && t<4){ if(st.produto.subsolos<=st.produto.garAcima+1 && st.produto.subsolos<5) st.produto.subsolos++; else st.produto.garAcima++; m=compute(st,{quick:true}); t++ }
        if(m.vagas<m.vagasReq || !m.T.every(x=>x.fit) || m.H>R.hMax+1e-6 || m.CA>R.caMax+1e-6) continue;
        const f=finance(st,m), v={...r, sc:score(f), sub:st.produto.subsolos, gac:st.produto.garAcima, units:m.units, priv:m.priv, vagas:m.vagas, req:m.vagasReq, CA:m.CA, H:m.H, lucro:f.lucro, margem:f.margem, tir:f.tirA, vpl:f.vpl, vgv:f.vgv};
        v.key=otimKey(v); v.est=false; if(mc) extras(st,m,v); out.push(v) }
      prog(0.6+0.2*j/Math.max(1,list.length));
      if(j<list.length && out.length<5) setTimeout(stepV,0); else done(out.sort((a,b)=>b.sc-a.sc)) };
    stepV() };
  // multicritério: confere com a garagem real alguns pontos da fronteira estimada e calcula a fronteira final
  const multi=(out, o)=>{
    const R=base.regras, crit0=[PARETO_CRIT.lucro, PARETO_CRIT.sol, PARETO_CRIT.vagas], have=new Set(out.map(r=>r.key));
    // metade da fronteira geral, metade da fronteira das que atingem as vagas (para o filtro "vagas ≥ exigidas" ter opções)
    const nMax=Math.max(0, opts.paretoMax ?? 8), fr0=(l)=>paretoFronteira(l, crit0).map(q=>l[q]).filter(p=>!have.has(p.key));
    const okV=pts.filter(p=>p.vagas>=p.req), a=paretoEspalha(fr0(okV), Math.ceil(nMax/2), "lucro"), aK=new Set(a.map(p=>p.key));
    const cand=[...a, ...paretoEspalha(fr0(pts).filter(p=>!aK.has(p.key)), nMax-a.length, "lucro")], val=[], t1=performance.now(); let j=0;
    const stepM=()=>{ const ts=performance.now();
      while(j<cand.length && performance.now()-ts<60 && performance.now()-t1<(opts.tempoMax ?? 9000)){ const p=cand[j++], st=stOf(p), m=compute(st,{quick:true});
        if(!m.T.every(x=>x.fit) || m.H>R.hMax+1e-6 || m.CA>R.caMax+1e-6) continue;
        const f=finance(st,m), v={...p, sc:score(f), units:m.units, priv:m.priv, vagas:m.vagas, req:m.vagasReq, CA:m.CA, H:m.H, lucro:f.lucro, margem:f.margem, tir:f.tirA, vpl:f.vpl, vgv:f.vgv, est:false};
        val.push(extras(st,m,v)) }
      prog(0.8+0.2*j/Math.max(1,cand.length));
      if(j<cand.length && performance.now()-t1<(opts.tempoMax ?? 9000)) return setTimeout(stepM,0);
      const seen=new Set(), P=[...out, ...val].filter(r=>!seen.has(r.key) && seen.add(r.key));
      const crit=[...crit0]; if(opts.vento && P.length && P.every(r=>r.vento!=null)) crit.push(PARETO_CRIT.vento);
      if(opts.malha && P.length && P.every(r=>r.malhaCusto!=null)) crit.push(PARETO_CRIT.malha);
      const fr=new Set(paretoFronteira(P, crit)); P.forEach((r,q)=>r.fronteira=fr.has(q));
      const solFonte=P.some(r=>r.solFonte==="unidades")? "unidades" : "proxy";
      finish({...o, ms:performance.now()-t0, pts, pareto:{pts:P, criterios:crit.map(c=>Object.keys(PARETO_CRIT).find(x=>PARETO_CRIT[x]===c))}, solFonte,
        malhaOn: !!opts.malha && typeof estruturaMalhas==="function", ventoOn: !!opts.vento}) };
    stepM() };
  step();
  return done;
}
function aplicarOtim(r, st=S){ st.produto.torres=Array.from({length:r.nT},()=>({pav:r.pav})); st.produto.mix=clone(r.mix); st.produto.subsolos=r.sub; st.produto.garAcima=r.gac }
/* opções do otimizador com vários critérios (vão junto com S.otim para o Worker); filtros fVagas/fSol/solMin são só da tela */
extendDEF("otim", { ...DEF.otim, mc:true, vento:false, malha:false, paretoMax:8, fVagas:false, fSol:false, solMin:3 });
