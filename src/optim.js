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
let OTIM=null;
function otimizar(opts, onProg, onDone){
  const base=clone(S), mNow=window._last.m, k = mNow.vagasLay && mNow.vagasEst? Math.min(1, (mNow.vagasLay-(mNow.vf?mNow.vf.count:0))/Math.max(1,mNow.vagasEst-(mNow.vf?mNow.vf.count:0))) : 0.75;
  const nTs = opts.torres? [1,2,3] : [base.produto.torres.length];
  const presets = opts.tipologias? Object.keys(MIX_PRESETS) : ["atual"];
  const Ns = opts.unidades? [2,3,4,5,6,8] : [base.produto.mix.reduce((s,u)=>s+u.qtd,0)];
  const gars=[]; for(let a=0;a<=4;a++) for(let b=0;b<=3;b++) gars.push([a,b]); gars.sort((x,y)=>(x[0]*1.6+x[1])-(y[0]*1.6+y[1]));
  const jobs=[]; nTs.forEach(nT=>presets.forEach(pk=>Ns.forEach(N=>jobs.push({nT,pk,N}))));
  const res=[]; let i=0; const t0=performance.now(); const score=OBJ[opts.obj][1];
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
          if(m.vagasEst*k < m.vagasReq) continue;
          if(m.minApto<st.regras.aptoMin) continue;
          const f=finance(st,m), sc=score(f); tested++;
          if(!best || sc>best.sc) best={sc, nT, pk, N, pav, sub, gac, mix:clone(st.produto.mix), units:m.units, priv:m.priv, vagas:Math.floor(m.vagasEst*k), req:m.vagasReq, CA:m.CA, H:m.H, lucro:f.lucro, margem:f.margem, tir:f.tirA, vpl:f.vpl, vgv:f.vgv};
        }
        if(tested>=8) break;
      }
      if(best) res.push(best);
    }
    onProg(i/jobs.length);
    if(i<jobs.length) setTimeout(step,0);
    else { res.sort((a,b)=>b.sc-a.sc); onProg(1); validar(res.slice(0,14), out=>{ OTIM={res:out, obj:opts.obj, k, ms:performance.now()-t0, testadas:res.length}; onDone(OTIM) }) }
  };
  // confirma as melhores com o layout real da garagem (acrescenta subsolo/garagem se faltar vaga)
  const validar=(list, done)=>{ let j=0; const out=[], R=base.regras;
    const stepV=()=>{ const ts=performance.now();
      while(j<list.length && out.length<5 && performance.now()-ts<60){ const r=list[j++]; const st=clone(base);
        st.produto.mix=clone(r.mix); st.produto.subsolos=r.sub; st.produto.garAcima=r.gac; st.produto.torres=Array.from({length:r.nT},()=>({pav:r.pav}));
        let m=compute(st,{quick:true}), t=0;
        while(m.vagas<m.vagasReq && t<4){ if(st.produto.subsolos<=st.produto.garAcima+1 && st.produto.subsolos<5) st.produto.subsolos++; else st.produto.garAcima++; m=compute(st,{quick:true}); t++ }
        if(m.vagas<m.vagasReq || !m.T.every(x=>x.fit) || m.H>R.hMax+1e-6 || m.CA>R.caMax+1e-6) continue;
        const f=finance(st,m); out.push({...r, sc:score(f), sub:st.produto.subsolos, gac:st.produto.garAcima, units:m.units, priv:m.priv, vagas:m.vagas, req:m.vagasReq, CA:m.CA, H:m.H, lucro:f.lucro, margem:f.margem, tir:f.tirA, vpl:f.vpl, vgv:f.vgv}) }
      if(j<list.length && out.length<5) setTimeout(stepV,0); else done(out.sort((a,b)=>b.sc-a.sc)) };
    stepV() };
  step();
}
function aplicarOtim(r){ S.produto.torres=Array.from({length:r.nT},()=>({pav:r.pav})); S.produto.mix=clone(r.mix); S.produto.subsolos=r.sub; S.produto.garAcima=r.gac }
