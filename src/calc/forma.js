/* ================= 2.4 regras avançadas de forma =================
   Recuos progressivos (afastamento por faixas de altura), torres escalonadas (plantas por faixa de andares,
   terraços nos recuos, mix por faixa), altura máxima do embasamento, cota de soleira e plano de proteção de aeródromo.
   Desligado por padrão: com S.forma.on=false o massing segue a regra única (afastamento = máx(mín., H ÷ n)).
   O massing (src/model.js) chama formaAf/formaTorre/formaEnvelope; nada aqui toca DOM. */
extendDEF("forma", {
  on: false,
  prog: true,                 // afastamento por faixas de altura
  faixas: [{ate: 12, af: 2, div: 0}, {ate: 0, af: 2, div: 6}],   // ate = cota do topo do andar (m); 0 = sem limite; af = mínimo (m); div = H ÷ div (0 = não usa)
  escalonar: true,            // plantas diferentes por faixa (terraços nos recuos); desligado = torre reta, presa ao recuo do topo
  rMin: 0.9,                  // abaixo disso o andar perde unidades (mix por faixa) em vez de encolher todas
  hEmbMax: 0,                 // altura máxima do embasamento (0 = sem limite)
  soleira: 0,                 // cota de soleira em relação à rua (m)
  aero: false,                // plano de proteção de aeródromo
  aeroCota: 60                // cota máxima do plano (m, em relação à rua)
});

/* afastamento às divisas na cota z (topo do andar, medido da soleira) */
function formaAf(F, z){
  const L = (F && F.faixas) || []; if(!L.length) return 0;
  let b = L[L.length-1];
  for(const x of L){ if(!(+x.ate>0) || z <= +x.ate + 1e-9){ b = x; break } }
  return Math.max(+b.af||0, +b.div>0 ? z/(+b.div) : 0);
}
/* altura-limite efetiva: gabarito da zona e, quando houver, o plano do aeródromo (cota − soleira) */
function formaHLim(st){
  const R = st.regras, F = st.forma;
  if(!F || !F.on || !F.aero) return R.hMax;
  return Math.min(R.hMax, Math.max(0, (+F.aeroCota||0) - (+F.soleira||0)));
}
/* mix por faixa: escolhe quantas unidades de cada tipologia cabem em 'cap' m² privativos.
   Mantém o mix quando dá (r ≥ rMin); senão tira unidades e fica com a combinação que aproveita mais área (empate: mais unidades). */
function formaMix(mix, cap, rMin){
  const q0 = mix.map(u=>Math.max(0, Math.round(+u.qtd||0))), A = mix.map(u=>+u.area||0);
  const sum = q=>q.reduce((s,n,j)=>s+n*A[j],0), nU = q=>q.reduce((s,n)=>s+n,0);
  const full = sum(q0);
  if(full<=0) return {qtd:q0, r:0, priv:0};
  if(cap/full >= rMin - 1e-9) return {qtd:q0, r:Math.min(1, cap/full), priv:Math.min(cap, full)};
  let best = null;
  const rec = (j, q)=>{
    if(j===q0.length){ const s=sum(q), n=nU(q); if(n<1 || s<=0) return; const r=cap/s; if(r < rMin - 1e-9) return;
      const priv=Math.min(cap, s); if(!best || priv > best.priv + 1e-6 || (Math.abs(priv-best.priv)<=1e-6 && n > nU(best.qtd))) best={qtd:q.slice(), r:Math.min(1,r), priv}; return }
    for(let n=q0[j]; n>=0; n--){ q[j]=n; rec(j+1, q) }
  };
  if(q0.reduce((p,n)=>p*(n+1),1) <= 20000) rec(0, q0.map(()=>0));
  if(!best){ // nem uma unidade cabe com rMin: fica com a menor tipologia, reduzida
    const j = A.reduce((b,a,i)=> q0[i]>0 && (b<0 || a<A[b]) ? i : b, -1); const q=q0.map(()=>0); if(j>=0) q[j]=1;
    const s=sum(q); best={qtd:q, r:s>0? Math.min(1,cap/s) : 0, priv:Math.min(cap,s)} }
  return best;
}
/* plantas de cada andar de uma torre → faixas de andares iguais.
   o = {plate, pav, zBase (cota do piso do 1º andar), pe, envBand(z) → polígono máximo do andar cuja laje superior está na cota z} */
function formaTorre(o){
  const out=[], pA=G.area(o.plate);
  for(let j=0;j<o.pav;j++){
    const z=o.zBase+(j+1)*o.pe, band=o.envBand(z);
    let p = band && band.length ? G.clipToPoly(o.plate, band) : [];
    let A=G.area(p); if(A >= pA-0.01){ p=o.plate; A=pA }
    const f=out[out.length-1];
    if(f && Math.abs(f.A-A)<0.25){ f.ate=j+1; f.n++; f.z1=z }
    else out.push({de:j+1, ate:j+1, n:1, plate:p, A, z0:z-o.pe, z1:z, af:o.afAt? o.afAt(z) : 0});
  }
  return out;
}
/* envelope por cota (pilha de polígonos) para desenho: [{z0,z1,af,poly}] entre a laje do embasamento e a altura-limite */
function formaEnvelope(envAt, afAt, z0, zMax, pe){
  const out=[]; if(!(zMax>z0)) return out;
  for(let z=z0; z<zMax-1e-6; z+=pe){
    const z1=Math.min(zMax, z+pe), af=afAt(z1), last=out[out.length-1];
    if(last && Math.abs(last.af-af)<0.01) last.z1=z1;
    else out.push({z0:z, z1, af, poly:envAt(af)});
  }
  return out;
}
/* avisos e conformidade da forma (usados pelo compute e pela etapa Regras) */
function formaAvisos(m, st){
  const F=st.forma, out=[]; if(!F || !F.on) return out;
  if(+F.hEmbMax>0 && m.hEmb > +F.hEmbMax+1e-6) out.push(`O embasamento tem ${nf(m.hEmb,1)} m e a zona permite ${nf(+F.hEmbMax,1)} m — reduza o pé-direito do térreo ou as garagens elevadas.`);
  if(F.aero && m.H > m.hLim+1e-6) out.push(`O plano de proteção do aeródromo limita a altura a ${nf(m.hLim,1)} m acima da soleira (cota ${nf(+F.aeroCota,1)} m) — o estudo tem ${nf(m.H,1)} m.`);
  (m.T||[]).forEach((t,i)=>{ const fx=t.faixas||[]; if(fx.length>1){ const mn=fx.reduce((a,f)=>Math.min(a,f.A),Infinity); if(mn<1) out.push(`A torre ${i+1} não cabe nos recuos progressivos a partir do ${fx.find(f=>f.A<1).de}º pavimento.`) } });
  return out;
}
HOOK.compute.push((m, st)=>{
  if(!st.forma || !st.forma.on) return;
  // andar recuado que corta o núcleo: a torre não pode subir até ali com esse escalonamento
  (m.T||[]).forEach((t,i)=>{ const l=m.tipo&&m.tipo[i]; if(!l || !l.core || !l.core.length) return; const core=G.scaleToArea(l.core, G.area(l.core)*0.97);
    const f=(t.faixas||[]).find(f=>f.plate!==t.plate && !core.every(q=>G.pip(q,f.plate))); if(f){ f.nucleoFora=true; t.nucleoFora=f.de;
      m.avisos && m.avisos.push(`Na torre ${i+1}, o recuo progressivo corta o núcleo a partir do ${f.de}º pavimento — reduza pavimentos (até ${f.de-1}) ou use a torre reta.`) } });
  if(m.avisos) m.avisos.push(...formaAvisos(m, st));
});
