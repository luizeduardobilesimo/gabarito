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
/* Potencial do terreno (Fase D). Dois olhares sobre o privativo possível:
   - pelo ANDAR (priv0, o cálculo antigo): área bruta de pavimentos tipo × eficiência do andar. Não conta garagem, hall nem lazer — superestima;
   - GLOBAL (priv, o que vale): área total construída possível × eficiência global do estudo (privativa ÷ ATC, `m.eficGlobal`), a mesma
     da "Saúde do negócio". A ATC possível é o menor entre o limite do CA (computável máx. × ATC ÷ computável do estudo, que carrega
     subsolos, garagem e áreas comuns na mesma proporção) e o da altura (cada torre sobe até o gabarito: + andares × área do andar).
   A altura-limite é m.hLim (gabarito da zona ou plano do aeródromo — src/calc/forma.js), não só R.hMax. */
function potencial(st, m){
  const R=st.regras, P=st.produto, A=m.A, hLim=m.hLim ?? R.hMax, hEmb=P.peTerreo+P.garAcima*P.peGar;
  const compMax=R.caMax*A, compBas=R.caBas*A;
  const pavH=Math.max(0,Math.floor((hLim-hEmb)/P.pe));
  const brutoPorCA = compMax/(1-R.ncTipo) - m.lojaA; // área bruta de pavimentos tipo que o CA permite
  const brutoPorVol = R.toTorre*A*pavH;           // limite pela projeção x altura
  const bruto=Math.max(0,Math.min(brutoPorCA, brutoPorVol)), limita = brutoPorCA<=brutoPorVol? "ca" : "altura";
  const area=(m.mixPriv/Math.max(1,m.mixUn))||70, preco=basePrice(st);
  // pelo andar (antigo)
  const priv0=bruto*P.efic + m.lojaPriv, un0=Math.floor(bruto*P.efic/area), vgv0=bruto*P.efic*preco + m.lojaPriv*st.fin.precoLoja;
  // global
  const eficGlobal = m.constr>0 ? m.priv/m.constr : 0;
  const atcCA = m.comp>0 ? m.constr*compMax/m.comp : 0;
  // torre desenhada: os andares a mais são do último bloco (ele estica), não do bloco de referência
  const atcAlt = m.constr + (m.T||[]).reduce((s,t)=>s+Math.max(0,pavH-(+t.pav||0))*(+(t.desenhada? t.Atop : t.A)||0),0);
  let priv=priv0, un=un0, vgv=vgv0, atc=0, lim=limita;
  if(eficGlobal>0 && atcCA>0){
    atc=Math.min(atcCA, atcAlt); lim = atcCA<=atcAlt? "ca" : "altura";
    priv=atc*eficGlobal; const res=Math.max(0, priv-m.lojaPriv); un=Math.floor(res/area); vgv=res*preco + m.lojaPriv*st.fin.precoLoja;
  }
  return {compMax, compBas, pavH, hLim, bruto, priv, un, limita:lim, vgv, atc, eficGlobal, priv0, un0, vgv0, limita0:limita,
    uso:{ ca:m.CA/Math.max(1e-9,R.caMax), to:m.TO/Math.max(1e-9,R.toEmb), h:m.H/Math.max(1e-9,hLim), priv:m.priv/Math.max(1,priv) } };
}
/* maior nº de pavimentos (iguais) que respeita gabarito (m.hLim) e CA — bisseção em 1..80. `teto` (opcional) é um limite superior EXATO do
   que o gabarito permite (cada pavimento custa ao menos P.pe): acima dele ok(n) é falso sem precisar do massing(), que é o que custa.
   O resultado é o mesmo da bisseção sem teto (a função não é monótona: a planta encolhe com a altura; por isso não se usa galope). */
function hLimDe(st){ return typeof formaHLim==="function" ? formaHLim(st) : st.regras.hMax }
function maxPavFast(st, teto=80){
  const ok=n=>{ if(n>teto) return false; const m=massing(st,{pav:n}); return m.H<=(m.hLim ?? st.regras.hMax)+1e-6 && m.CA<=st.regras.caMax+1e-6 && m.T.every(t=>t.A>1) };
  if(!ok(1)) return 0; let lo=1, hi=80; while(lo<hi){ const mid=Math.ceil((lo+hi)/2); if(ok(mid)) lo=mid; else hi=mid-1 } return lo;
}
const OBJ = { lucro:["Lucro",f=>f.lucro,"lucro"], margem:["Margem s/ VGV",f=>f.margemVGV,"margem s/ VGV"], tir:["TIR",f=>f.tirA??-1,"TIR"], vpl:["VPL",f=>f.vpl,"VPL"] };
/* números que cada combinação guarda (estimada ou conferida): margem = s/ VGV; eficiência global e V/C vêm da "Saúde do negócio" (f.saude) */
function otimNum(f, m, forma){ const sd=f.saude;
  return { lucro:f.lucro, margem:f.margemVGV, margemReceita:f.margem, tir:f.tirA, vpl:f.vpl, vgv:f.vgv,
    efic: sd? sd.eficGlobal : (m.constr>0? m.priv/m.constr : 0), vc: sd? sd.vc : null,
    ...(forma? {dev:otimDesvio(m), forma:true} : {}) } }

/* ---------- otimizar para uma forma desenhada (Fase C + D) ----------
   Com S.blocos.modo "desenhada" (e ao menos uma torre com bloco válido) a forma é do usuário: o otimizador NÃO muda o nº de torres
   nem os blocos. Varia só tipologias, unidades por andar, pavimentos (o último bloco estica), subsolos e garagens.
   A planta não encolhe nem cresce para o mix: as unidades é que crescem (fator t.r ≥ 1; abaixo de 1 o mix não cabe e a combinação
   cai). Por isso as unidades por andar são escolhidas para PREENCHER o bloco de referência (r perto de 1), a tolerância é S.otim.rTol
   (padrão 10%, o mesmo limite do aviso "o mix ocupa X% do pavimento") e a nota das combinações é penalizada pelo desvio. */
const OTIM_PEN = 2;   // nota ajustada = nota × (1 − OTIM_PEN × desvio)
function otimFormaAtiva(st){ return typeof blcAtivo==="function" && blcAtivo(st) && (st.blocos.torres||[]).some(t=>t && (t.blocos||[]).some(blcValido)) }
/* desvio médio do tamanho das unidades frente ao mix (|r − 1|), ponderado pela área privativa de cada faixa de andares tipo */
function otimDesvio(m){ let s=0, w=0;
  (m.T||[]).forEach(t=>(t.faixas||[]).forEach(f=>{ const p=(f.nTipo||0)*(f.priv||0); if(p>0 && f.r>0){ s+=p*Math.abs(f.r-1); w+=p } }));
  return w? s/w : 0 }
/* andar em que começa o último bloco válido de cada torre desenhada: abaixo dele o bloco ficaria de fora */
function otimPavMinForma(st){ const L=st.lote.pts; let pm=1;
  (st.produto.torres||[]).forEach((_,i)=>{ const R=blcPilha(st, i, L, 999); if(R && R.pil.length) pm=Math.max(pm, R.pil[R.pil.length-1].de) });
  return pm }
/* unidades por andar candidatas para um preset: as que preenchem o bloco de referência de todas as torres desenhadas
   (r entre 1 e 1 + tol), as mais justas primeiro; sempre inclui o nº de unidades atual */
function otimNsForma(st, pk, caps, tol, curN, effs){
  const efic=st.produto.efic, cand=[];   // effs[k]: eficiência real da planta da torre k (blcPrivReal); sem ela, a informada
  for(let N=1; N<=16; N++){ const mix=presetMix(st, pk, N); if(!mix.length) continue;
    const mp=mix.reduce((s,u)=>s+u.area*u.qtd,0); if(!(mp>0)) continue;
    // com a eficiência real (que muda um pouco com o mix e o núcleo) a janela é mais larga: a estimativa de cada combinação filtra
    const rs=caps.map((c,k)=>c*((effs && effs[k]>0) ? effs[k] : efic)/mp); if(Math.min(...rs)<(effs? 0.97 : 0.996)) continue;     // tem de caber em todas as torres
    const dv=rs.reduce((s,r)=>s+Math.abs(r-1),0)/rs.length; if(dv<=tol*1.5+(effs? 0.05 : 0)) cand.push({N, dv}) }
  cand.sort((a,b)=>a.dv-b.dv || a.N-b.N);
  return [...new Set([...cand.slice(0,4).map(c=>c.N), curN])] }

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
const otimBox=p=>{ const xs=p.map(q=>q[0]), ys=p.map(q=>q[1]); return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)] };
/* prismas do entorno (polígono com ponte, altura e caixa) — o otimizador calcula uma vez por rodada e passa a cada otimSolProxy */
function otimEntorno(st){ return (st.entorno||[]).filter(e=>e.pts&&e.pts.length>2).map(e=>{ const poly=entPoly(e); return {poly, z1:+e.h||0, own:-1, bb:otimBox(poly)} }) }
function otimSolProxy(st, m, ent){
  const suns=otimSolVetores(st), P=st.produto, T=(m.T||[]).filter(t=>t.plate&&t.plate.length>2);
  if(!T.length || !suns.length) return 0;
  // por faixa de andares (torre escalonada 2.4 / pilha de blocos C2): um prisma e uma lista de fachadas por faixa, cada uma com a sua planta e
  // a sua altura (prisma do chão até o topo da faixa — exato quando a faixa de cima fica dentro da de baixo). Torre de uma faixa só = como antes.
  // A sombra entre faixas da MESMA torre não conta (a faixa de cima só sombreia a de baixo se avançar sobre ela)
  const fxOf=t=>{ const fx=(t.faixas||[]).filter(f=>f.plate && f.plate.length>2); return fx.length>1? fx : null };
  const segs=[], prs=[];
  T.forEach(t=>{ const fx=fxOf(t);
    if(!fx){ segs.push({t, pl:t.plate, z0:m.hEmb, h:Math.max(P.pe, t.pav*P.pe), w:1}); prs.push({poly:t.plate, z1:t.H, own:t.i, bb:otimBox(t.plate)}); return }
    fx.forEach((f,k)=>{ segs.push({t, pl:f.plate, z0:m.hEmb+(f.de-1)*P.pe, h:Math.max(P.pe, f.n*P.pe), w:f.n/Math.max(1,t.pav)});
      prs.push({poly:f.plate, z1:k===fx.length-1? t.H : f.z1, own:t.i, bb:otimBox(f.plate)}) }) });
  prs.push(...(ent || otimEntorno(st)));
  // por raio de sol, só os prismas que podem sombrear algum ponto de partida: dentro do corredor da sombra (perpendicular ≤ raios somados,
  // ao longo de [−raios, alcance]). Conservador: descarta apenas quem nunca é atingido, então o resultado é o mesmo, bem mais rápido
  const vs=segs.flatMap(g=>g.pl), cx=vs.reduce((a,q)=>a+q[0],0)/vs.length, cy=vs.reduce((a,q)=>a+q[1],0)/vs.length, rT=1+Math.max(...vs.map(q=>Math.hypot(q[0]-cx,q[1]-cy)));
  const info=prs.map(q=>({q, bx:(q.bb[0]+q.bb[2])/2-cx, by:(q.bb[1]+q.bb[3])/2-cy, r:Math.hypot(q.bb[2]-q.bb[0], q.bb[3]-q.bb[1])/2+rT}));
  const hzs=suns.map(s=>Math.hypot(s.x,s.y)||1);
  const cor=suns.map((s,si)=>{ const ux=s.x/hzs[si], uy=s.y/hzs[si]; return info.filter(o=>{ const al=o.bx*ux+o.by*uy, pe=Math.abs(o.bx*uy-o.by*ux); return pe<=o.r && al>=-o.r && al<=o.q.z1/s.t+o.r }).map(o=>o.q) });
  let sum=0, wsum=0;
  segs.forEach(({t, pl, z0, h, w})=>{ const ccw=G.sArea(pl)>0;
    for(let i=0;i<pl.length;i++){ const a=pl[i], b=pl[(i+1)%pl.length], dx=b[0]-a[0], dy=b[1]-a[1], L=Math.hypot(dx,dy); if(L<1) continue;
      const n= ccw? [dy/L,-dx/L] : [-dy/L,dx/L], mid=[(a[0]+b[0])/2+n[0]*0.2, (a[1]+b[1])/2+n[1]*0.2];
      for(const fz of [0.15,0.5,0.85]){ const z=z0+fz*h; let lit=0;
        for(let si=0; si<suns.length; si++){ const s=suns[si]; if(n[0]*s.x+n[1]*s.y<0.05) continue; let sh=false;
          for(const q of cor[si]){ if(q.own===t.i || q.z1<=z) continue; const d=(q.z1-z)/s.t, hz=hzs[si], e=[mid[0]+s.x/hz*d, mid[1]+s.y/hz*d];
            if(Math.max(mid[0],e[0])<q.bb[0]||Math.min(mid[0],e[0])>q.bb[2]||Math.max(mid[1],e[1])<q.bb[1]||Math.min(mid[1],e[1])>q.bb[3]) continue;
            if(G.segPolyHit(mid,e,q.poly)){ sh=true; break } }
          if(!sh) lit++ }
        sum+=lit*0.5*L*w; wsum+=L*w } } });
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

/* ---------- vagas pela garagem real (UX v3 P3: "o otimizador não gera estudo com prejuízo quando há alternativa lucrativa") ----------
   A massa estima as vagas por área ÷ m2Vaga (28 m²/vaga) em cada pavimento. Em lote estreito a garagem real rende bem menos (rampas,
   circulação e núcleos): no 20 × 40 m de Criciúma, 13 vagas num subsolo de 720 m² (55 m²/vaga), 8 numa garagem elevada de 640 m²
   e nenhuma no térreo. O fator único de antes (k = 0,75 quando não havia modelo, caso do assistente) aprovava combinações que,
   conferidas com o layout, pediam 1 ou 2 subsolos a mais; o reparo alternado (subsolo/elevada) subia a torre, que deixava de caber,
   e sobrava só a planta mínima (2 un/andar, 3 subsolos, eficiência 36%, prejuízo).
   Agora a razão real ÷ estimada é medida POR TIPO de pavimento (subsolo s, garagem elevada g, térreo t), mais as vagas externas da
   frente (vf), num layout real: o do estudo na tela (m.gar) ou, sem ele, um compute rápido do estado de partida. */
function otimMLite(m){   // o que o Worker precisa do modelo da tela (clonável e pequeno)
  if(!m) return {};
  const gar={}; Object.entries(m.gar||{}).forEach(([k,l])=>{ gar[k]={count:l? +l.count||0 : 0} });
  return {vagasLay:m.vagasLay, vagasEst:m.vagasEst, vf:{count:m.vf? m.vf.count||0 : 0}, subA:m.subA, embA:m.embA, gTer:m.gTer, gar};
}
function otimVagasCal(st, m){
  const gar=m && m.gar, mv=st.regras.m2Vaga||28; if(!gar || !Object.keys(gar).length) return null;
  const ks=re=>Object.keys(gar).filter(k=>re.test(k)), soma=l=>l.reduce((s,k)=>s+(gar[k]? +gar[k].count||0 : 0),0), cl=v=>Math.max(0, Math.min(1, v));
  const kS=ks(/^s\d+$/), kG=ks(/^g\d+$/), eS=kS.length*Math.floor((m.subA||0)/mv), eG=kG.length*Math.floor((m.embA||0)/mv), eT=Math.floor((m.gTer||0)/mv);
  let s = eS>0? cl(soma(kS)/eS) : null, g = eG>0? cl(soma(kG)/eG) : null, t = eT>0 && gar.ter? cl((+gar.ter.count||0)/eT) : null;
  if(s==null) s = g!=null? cl(g/0.8) : 0.6;     // sem o pavimento no layout: elevada ≈ 0,8 × subsolo (rampa de subida no embasamento)
  if(g==null) g = 0.8*s;
  if(t==null) t = s;
  return {s, g, t, vf:(m.vf && +m.vf.count)||0, fonte:"layout"};
}
/** vagas esperadas de uma combinação (massa) com a calibração por pavimento */
function otimVagasEst(m, st, cal){ const P=st.produto, mv=st.regras.m2Vaga||28;
  return cal.vf + Math.floor(P.subsolos*Math.floor((m.subA||0)/mv)*cal.s + P.garAcima*Math.floor((m.embA||0)/mv)*cal.g + Math.floor((m.gTer||0)/mv)*cal.t) }
/* nível da combinação para a ordem (antes do objetivo): 2 = lucro > 0 e margem s/ VGV ≥ meta (S.fin.margemAlvo) · 1 = lucro > 0 · 0 = prejuízo */
const otimNivel = (n, meta) => n.lucro>0 ? (n.margem>=meta-1e-9 ? 2 : 1) : 0;
const otimMelhor = (a, b) => (b.nivel||0)-(a.nivel||0) || b.sc-a.sc;   // comparador: nível, depois o objetivo
/** preço médio de venda (R$/m², média das tipologias ponderada pela área) que leva a margem s/ VGV ao alvo — todas as tipologias, coberturas
    e lojas sobem na mesma proporção (finance dp); com tPct o terreno acompanha o VGV. null se nem 5× o preço chega lá */
function otimPrecoPara(st, m, alvo, tPct){
  const marg=dp=>{ const s2= tPct? {...st, fin:{...st.fin}} : st; if(tPct){ s2.fin.terreno=0; s2.fin.terreno=Math.round(tPct*finance(s2, m, {noHooks:true, dp}).vgv/1e4)*1e4 } return finance(s2, m, {noHooks:true, dp}).margemVGV };
  let lo=-0.9, hi=4; if(marg(hi)<alvo) return null; if(marg(lo)>=alvo) return basePrice(st)*(1+lo);
  for(let i=0;i<28;i++){ const mid=(lo+hi)/2; if(marg(mid)>=alvo) hi=mid; else lo=mid }
  return basePrice(st)*(1+hi);
}
/* o que fecharia a conta de uma combinação (pura; roda no Worker): preço médio de venda para margem 0 e para a meta, terreno máximo
   pagável (mesma conta de f.maxTerreno) e o motivo principal, lido da "Saúde do negócio" (f.saude). tPct: terreno = tPct × VGV. */
function otimFecha(st, m, f, meta, tPct){
  const pm=basePrice(st), pz=otimPrecoPara(st, m, 0, tPct), pmt=otimPrecoPara(st, m, meta, tPct), F=st.fin, itbi=1+(+F.itbi||0), sd=f.saude||{}, nv=sd.nivel||{};
  const terrenoZero=(+F.terreno||0)+f.lucro/itbi, terrenoMeta=f.maxTerreno!=null? f.maxTerreno : (+F.terreno||0)+(f.lucro-meta*f.vgv)/itbi;
  const terPct=sd.terrenoPctVGV!=null? sd.terrenoPctVGV : (f.vgv>0? (+F.terreno||0)/f.vgv : 0), M=st.metas||DEF.metas||{};
  let k, motivo;
  if(nv.vc==="ruim" || (sd.vc>0 && sd.vc<((M.vc&&M.vc.min)||2.5))){ k="preco"; motivo=`preço de venda baixo para o custo da obra (V/C ${nf(sd.vc||0,1)}×)` }
  else if(nv.efic==="ruim" || (sd.faixaEfic && sd.eficGlobal<sd.faixaEfic[0])){ k="efic"; motivo=`pouca área vendável: só ${pct(sd.eficGlobal||0,0)} da área construída é privativa${m.garA>0 && m.constr>0? ` (garagem = ${pct(m.garA/m.constr,0)} da área)` : ""}` }
  else if(terPct>((M.terreno&&M.terreno.max)||0.2)){ k="terreno"; motivo=`terreno caro: ${pct(terPct,0)} do VGV` }
  else { k="custo"; motivo="obra e indiretos acima do que o produto vende" }
  return { k, motivo, meta, lucro:f.lucro, margem:f.margemVGV, vgv:f.vgv, precoAtual:pm, precoZero:pz, precoMeta:pmt,
    terrenoAtual:+F.terreno||0, terrenoZero, terrenoMeta, terrenoPct: tPct||0 };
}
/** texto curto do aviso (Produto e cartão do assistente): "Nenhuma combinação dá lucro: … Fecha a conta com …" */
function otimFechaTxt(fx, semLucro){
  if(!fx) return "";
  const pr=v=>`R$ ${nf(Math.ceil(v/50)*50,0)}/m²`, op=[], qual=q=>q? ` na opção ${q+1}` : "";
  if(semLucro){
    if(fx.precoZero) op.push(`preço médio a partir de ${pr(fx.precoZero)}${qual(fx.opcaoZero)} (margem 0)${fx.precoMeta? ` ou ${pr(fx.precoMeta)}${qual(fx.opcaoMeta)} (meta de ${pct(fx.meta,0)})` : ""}`);
    if(!fx.terrenoPct && fx.terrenoAtual>0 && fx.terrenoZero>0) op.push(`terreno até ${mi(fx.terrenoZero)}`);
    if(fx.terrenoPct && fx.terrenoZero>0) op.push(`terreno até ${mi(fx.terrenoZero)} (estimado em ${pct(fx.terrenoPct,0)} do VGV)`);
    return `Nenhuma combinação dá lucro — ${fx.motivo}.${op.length? " Fecha a conta com "+op.join(" ou ")+"." : ""}`;
  }
  if(fx.precoMeta) op.push(`preço médio de ${pr(fx.precoMeta)}${qual(fx.opcaoMeta)}`);
  if(fx.terrenoMeta>0 && (fx.terrenoAtual>0 || fx.terrenoPct)) op.push(`terreno até ${mi(fx.terrenoMeta)}`);
  return `Margem abaixo da meta de ${pct(fx.meta,0)}.${op.length? " Chega à meta com "+op.join(" ou ")+"." : ""}`;
}

/* ---------- conferência com o layout real da garagem (motor do otimizador e do "o que fecha a conta", src/calc/ciclo.js) ----------
   otimMotor(base, o) → {cabe, nivelOk, avalia, notaMassa, rascunho, confere, melhorDe, repara}
   o = {cal (calibração das vagas), fin(st,m)→f, score(f,m)→nota, forma?, rTol?, pavMinF?, memoEf?}
   As vagas por pavimento variam muito com o empilhamento das rampas e a posição do núcleo (no 20 × 40: de 5 a 13 por subsolo), então a
   estimativa só ORDENA; quem decide é o layout. avalia(st) = cálculo rápido (layout da garagem com rotas) + finance. repara(cur, subir):
   faltando vagas, testa as três saídas de um incorporador e fica com a de melhor nota que fecha as vagas (ou, se nenhuma fecha, a que
   mais se aproxima): menos pavimentos tipo (menos unidades = menos vagas exigidas), +1 subsolo, +1 garagem elevada (só se a torre
   continuar cabendo). No máximo 3 rodadas de reparo; depois `subir` rodadas de "subida da encosta" (ver abaixo). */
function otimMotor(base, o){
  const {cal, fin, score, forma=false, rTol=0.1, pavMinF=1, memoEf=null}=o, R0=base.regras;
  const cabe=m=>m.T.every(x=>x.fit) && m.H<=(m.hLim ?? R0.hMax)+1e-6 && m.CA<=R0.caMax+1e-6;
  const pMinV=Math.max(2, pavMinF), nivelOk=x=>x.m.vagas>=x.m.vagasReq && cabe(x.m);
  const avalia=st=>{ const mm=compute(st,{quick:true}), f=fin(st,mm); return {st, m:mm, f, sc:score(f,mm)} };
  const notaMassa=st=>{ const m0=massing(st); if(memoEf) blcPrivEstimada(st, m0, memoEf); return {m0, sc0:score(fin(st,m0),m0)} };
  // vizinho: conferido pela massa antes (regras; na forma desenhada também blocos ignorados e tamanho das unidades); devolve o
  // rascunho {st, sc0} (nota da massa) sem calcular a garagem — quem calcula é `confere`
  const rascunho=(st, mut)=>{ const s2=clone(st); if(mut(s2.produto)===false) return null; const {m0, sc0}=notaMassa(s2);
    if(!cabe(m0) || m0.minApto<R0.aptoMin) return null;
    if(forma && (m0.T.some(t=>t.blcIgn && t.blcIgn.length) || otimDesvio(m0)>rTol)) return null;
    return {st:s2, sc0} };
  const confere=r=>{ if(!r) return null; const c=avalia(r.st); return forma && otimDesvio(c.m)>rTol ? null : c };
  const melhorDe=l=>l.filter(Boolean).sort((a,b)=>(nivelOk(b)-nivelOk(a)) || (nivelOk(a)? b.sc-a.sc : (a.m.vagasReq-a.m.vagas)-(b.m.vagasReq-b.m.vagas) || b.sc-a.sc))[0];
  const repara=(cur, subir)=>{
    for(let t=0; t<3 && !nivelOk(cur); t++){ const P=cur.st.produto, m=cur.m, nT=P.torres.length, pav=P.torres[0].pav;
      const porPav=Math.max(1, nT*P.mix.reduce((s,u)=>s+u.qtd,0)*(+cur.st.regras.vagasApto||1)), k=Math.max(1, Math.ceil((m.vagasReq-m.vagas)/porPav));
      const nx=melhorDe([
        pav-k>=pMinV ? rascunho(cur.st, p=>{ p.torres.forEach(x=>x.pav=pav-k) }) : null,
        rascunho(cur.st, p=>{ if(p.subsolos>=5) return false; p.subsolos++ }),
        rascunho(cur.st, p=>{ if(p.garAcima>=3) return false; p.garAcima++ })].map(confere));
      if(!nx) break; cur=nx }
    // com as vagas fechadas, sobe a encosta com o layout real (`subir` rodadas): mais andares (o que sobra de vagas, ou +1 e +2 — o
    // rendimento da garagem muda com o núcleo, que muda com a altura), mais andares com +1 subsolo, ou um subsolo/uma elevada a menos,
    // ou a elevada trocada por um subsolo. Vizinho fora das regras nem é calculado; os outros são calculados na ordem da nota da massa,
    // só os que a massa diz que melhoram, até 3 por rodada — fica com o primeiro que fecha as vagas e melhora.
    for(let t=0; t<subir && nivelOk(cur); t++){ const P=cur.st.produto, m=cur.m, mv=cur.st.regras.m2Vaga||28, sobra=m.vagas-m.vagasReq, pav=P.torres[0].pav;
      const porPav=Math.max(1, P.torres.length*P.mix.reduce((s,u)=>s+u.qtd,0)*(+cur.st.regras.vagasApto||1)), yS=cal.s*Math.floor((m.subA||0)/mv), yG=cal.g*Math.floor((m.embA||0)/mv);
      const up=Math.floor(sobra/porPav), up2=Math.max(1, Math.floor((sobra+yS)/porPav)), sc0=notaMassa(clone(cur.st)).sc0;
      const viz=[
        rascunho(cur.st, p=>{ p.torres.forEach(x=>x.pav=pav+Math.max(1, up)) }),
        up<=1 ? rascunho(cur.st, p=>{ p.torres.forEach(x=>x.pav=pav+2) }) : null,
        rascunho(cur.st, p=>{ if(p.subsolos>=5) return false; p.subsolos++; p.torres.forEach(x=>x.pav=pav+up2) }),
        P.subsolos>0 && sobra>=0.5*yS ? rascunho(cur.st, p=>{ p.subsolos-- }) : null,
        P.garAcima>0 && sobra>=0.5*yG ? rascunho(cur.st, p=>{ p.garAcima-- }) : null,
        P.garAcima>0 && P.subsolos<5 ? rascunho(cur.st, p=>{ p.garAcima--; p.subsolos++ }) : null]   // troca a elevada por um subsolo (a torre desce 1 pé-direito)
        .filter(r=>r && r.sc0>sc0+1e-9).sort((a,b)=>b.sc0-a.sc0).slice(0,3);
      let nx=null; for(const r of viz){ const c=confere(r); if(c && nivelOk(c) && c.sc>cur.sc){ nx=c; break } }
      if(nx) cur=nx; else break }
    return cur };
  return {cabe, nivelOk, avalia, notaMassa, rascunho, confere, melhorDe, repara, cal};
}
const OTIM_PEN_PEND = 0.03;   // nota − 3% por pendência grave do projeto (lazer que não coube, rampa/elevador com pendência…), até 3
const OTIM_EXTRAS = ["sol","solFonte","vento","malha","malhaCusto"];   // critérios extras que não mudam com a garagem

let OTIM=null;
/* otimizar(opts, onProg?, onDone?, ctx?) → Promise do resultado (também entregue a onDone; rejeita com Error("cancelado")).
   Puro (sem DOM): roda no Web Worker. Na interface, chame otimRodar (src/ui/calcworker.js), o caminho único.
   ctx = {st, m, cancelado?} (padrão: S e o último modelo da tela; sem eles, calcula). m.gar (layout real) calibra as vagas; sem ele,
   um compute rápido de st. cancelado(): função que, verdadeira, interrompe na próxima fatia.
   opts: {obj, torres, tipologias, unidades, terrenoPct?} + multicritério {mc=true, paretoMax=8, tempoMax=9000 ms, tempoTotal=15000 ms,
   vento=false, malha=false, efic=false, vc=false} (efic/vc acrescentam eficiência global e V/C aos critérios da fronteira de Pareto).
   terrenoPct (assistente, terreno sem preço): cada combinação é avaliada com terreno = terrenoPct × o seu VGV — o mesmo que o assistente
   lança depois (antes ele otimizava com terreno 0 e cobrava 12% do VGV só no fim, e a ordem não era a do resultado mostrado).
   opts.cal (testes): calibração das vagas {s, g, t, vf} fixa. Fase "ciclo" (garagem real, térreo, cálculo completo da 1ª, lazer enxuto —
   ver `ciclo` abaixo): opts.ciclo=false desliga, opts.completo=false pula o completo, opts.tempoCiclo (padrão até 8 s), opts.cicloN (3).
   Busca (UX v3 P3): unidades por andar 2…8 (e 1 em lote pequeno); para cada garagem, alturas até o MENOR entre o gabarito/CA e o que
   cabe (a planta estreita com a altura) e também 70% e 50% disso; vagas estimadas pela calibração por pavimento; ordem = nível
   (lucro > 0 e margem s/ VGV ≥ S.fin.margemAlvo › lucro > 0 › prejuízo) e depois o objetivo. As 14 melhores vão à conferência com o layout
   real (repara: −andares, +subsolo ou +elevada até fechar as vagas; as 3 primeiras ainda "sobem a encosta" — ver `repara`).
   Desempenho: maxPavFast com teto vindo das combinações menores; combinações dominadas (mais subsolos com o mesmo nº de pavimentos e
   garagem elevada, vagas já cumpridas) não são recalculadas; o sol (que não depende dos subsolos) é guardado por assinatura.
   Resultado serializável (contrato para a interface e o assistente):
     res        até 5 opções conferidas, em ordem (nível, objetivo); cada uma {nT, pk, N, pav, sub, gac, mix, units, vagas, req, lucro,
                margem (s/ VGV), tir, vpl, vgv, efic, nivel, semLucro?, terreno? (com terrenoPct), garagem {rampaTipo, acessoVei, ladoVei,
                angulo} (a com que foi conferida — aplicarOtim grava), garInfo? {base, tipos[]} (melhor de cada tipo de circulação), pend
                [{k, grave, msg}] (o que o projeto não resolve), completo? (a 1ª: números do cálculo COMPLETO, os do Projeto), vagasFalta?,
                enxuto? (alternativa "lazer enxuto" da 1ª: opção inteira + lazer, tira, dLucro, dMargem — só aplicada se escolhida)}
     fecha      quando a 1ª está abaixo da meta: {k, motivo, meta, lucro, margem, precoAtual, precoZero, precoMeta (R$/m² médio; os
                menores entre as opções, opcaoZero/opcaoMeta = índice em res quando não é a 1ª), terrenoAtual, terrenoZero, terrenoMeta, terrenoPct}
     semLucro   = fecha, quando nem a 1ª dá lucro (res[0].semLucro = true): a menos ruim + motivo + o que fecharia a conta
     semOpcao   {k:"lote"|"vagas", motivo} quando nenhuma combinação fecha as regras com as vagas (res vazio)
     cal, k     calibração das vagas usada · meta, terrenoPct, ms, testadas, forma? · pts, pareto, solFonte (multicritério)
   Texto pronto do aviso: otimFechaTxt(semLucro || fecha, !!semLucro). */
function otimizar(opts, onProg, onDone, ctx={}){
  opts = {obj:"lucro", ...(opts||{})};
  const prog = typeof onProg==="function"? onProg : ()=>{};
  const base=clone(ctx.st||S);
  const mNow = ctx.m || (typeof window!=="undefined" && window._last && window._last.m) || compute(base);
  // vagas: calibração por tipo de pavimento num layout real (o da tela; sem ele, um compute rápido do estado de partida com ≥ 1 subsolo)
  let cal = opts.cal || otimVagasCal(base, mNow);
  if(!cal){ try{ const sc=clone(base); sc.produto.subsolos=Math.max(1, +sc.produto.subsolos||0); cal=otimVagasCal(sc, compute(sc, {quick:true})) }catch(e){} }
  if(!cal) cal={s:0.6, g:0.5, t:0.6, vf:0, fonte:"padrão"};
  const k = cal.s;
  // ordem: lucro > 0 e margem ≥ meta antes do objetivo (otimNivel); terreno sem preço e opts.terrenoPct: terreno = tPct × VGV de cada combinação
  const meta = +(base.fin && base.fin.margemAlvo) || 0.25, tPct = +opts.terrenoPct>0 && !(+base.fin.terreno>0) ? +opts.terrenoPct : 0;
  const fin = (st, m)=>{ if(tPct){ st.fin.terreno=0; st.fin.terreno=Math.round(tPct*finance(st, m, {noHooks:true}).vgv/1e4)*1e4 } return finance(st, m) };
  const parou = ()=>!!(ctx.cancelado && ctx.cancelado());
  const mc = opts.mc!==false;
  // forma desenhada (Fase C): o nº de torres e os blocos são do usuário e não variam; as unidades por andar preenchem o bloco
  const forma = otimFormaAtiva(base), rTol = Math.max(0.01, +(base.otim && base.otim.rTol) || 0.10), pavMinF = forma? otimPavMinForma(base) : 1;
  const nTs = forma || !opts.torres? [base.produto.torres.length] : [1,2,3];
  const presets = opts.tipologias? Object.keys(MIX_PRESETS) : ["atual"];
  const curN = base.produto.mix.reduce((s,u)=>s+u.qtd,0);
  // eficiência real da planta (torre desenhada / contorno ocupado): as estimativas usam a privativa das unidades desenhadas
  // (blcPrivEstimada: um pavimento tipo por mix e faixa de elevadores, guardado em memoEf); as quantidades candidatas partem
  // da eficiência real da forma atual
  const memoEf = typeof blcPrivEstimada==="function" ? new Map() : null;
  const mEf = forma && !(mNow.T||[]).some(t=>t && t.eficReal!=null) ? compute(base) : mNow, efAt = forma ? blcEficMapa(mEf) : [];
  const TF = forma? massing(base).T.filter(t=>t.desenhada && t.A>1) : [], capsF=TF.map(t=>t.A), effF0=TF.map(t=>(efAt[t.i]||{}).ref), effF=effF0.some(e=>e>0)? effF0 : undefined;
  // unidades por andar: 2…8 e, em lote pequeno (a maior planta possível não comporta 2,5× o andar de 2 unidades), também 1
  const nsLivre = pk=>{ const R=base.regras, mx=presetMix(base, pk, 2), need2=mx.reduce((s,u)=>s+u.area*u.qtd,0)/Math.max(0.3, base.produto.efic);
    return [...(G.area(base.lote.pts)*R.toTorre < 2.5*need2 ? [1] : []), 2,3,4,5,6,8] };
  const NsDe = pk => forma? (opts.unidades? otimNsForma(base, pk, capsF, rTol, curN, effF) : [curN]) : opts.unidades? nsLivre(pk) : [curN];
  const gars=[]; for(let a=0;a<=4;a++) for(let b=0;b<=3;b++) gars.push([a,b]); gars.sort((x,y)=>(x[0]*1.6+x[1])-(y[0]*1.6+y[1]));
  const jobs=[]; nTs.forEach(nT=>presets.forEach(pk=>NsDe(pk).forEach(N=>jobs.push({nT,pk,N}))));
  const res=[], pts=[], cont={cabe:0, vagas:0}; let i=0; const t0=performance.now(); const solMemo=new Map(), entPrs=mc? otimEntorno(base) : null;
  const score0=OBJ[opts.obj][1];
  // forma desenhada: a nota cai com o desvio do tamanho das unidades frente ao mix (a combinação ideal preenche o bloco com r = 1)
  const score = forma? (f, m)=>{ const s=score0(f); return s - OTIM_PEN*otimDesvio(m)*Math.abs(s) } : score0;
  const curPav = +(base.produto.torres[0]||{}).pav || 0, formaInfo = forma? {on:true, torres:nTs[0], desenhadas:capsF.length, rTol, pavMin:pavMinF} : null;
  let resolve, reject; const done=new Promise((r,j)=>{ resolve=r; reject=j });
  const finish=o=>{ OTIM=o; if(typeof onDone==="function") onDone(o); resolve(o) };
  const cancela=()=>reject(new Error("cancelado"));
  // maior nº de pavimentos em que todas as torres comportam o mix (a planta estreita com a altura: afastamento = H ÷ afDiv), entre lo e hi
  const fitAte=(st, nT, lo, hi)=>{ const ok=p=>{ st.produto.torres=Array.from({length:nT},()=>({pav:p})); return massing(st).T.every(t=>t.fit) };
    if(ok(hi)) return hi; if(!ok(lo)) return lo-1; while(hi-lo>1){ const mid=(lo+hi)>>1; if(ok(mid)) lo=mid; else hi=mid } return lo };
  const step=()=>{
    if(parou()) return cancela();
    const ts=performance.now();
    while(i<jobs.length && performance.now()-ts<40){
      const {nT,pk,N}=jobs[i++]; const st=clone(base); st.produto.mix=presetMix(base,pk,N); if(!st.produto.mix.length) continue;
      let best=null, tested=0; const cumpre=new Map(), pfit=new Map();   // cumpre: "gac|pav" → menor nº de subsolos (≥1) que já atende às vagas · pfit: gac → maior pav que cabe
      for(const [sub,gac] of gars){
        st.produto.subsolos=sub; st.produto.garAcima=gac; st.produto.torres=Array.from({length:nT},()=>({pav:4}));
        // teto exato pelo gabarito: acima dele o massing() nem precisa rodar
        const hEmbG=st.produto.peTerreo+gac*st.produto.peGar, pmax=maxPavFast(st, Math.floor((hLimDe(st)+1e-6-hEmbG)/st.produto.pe));
        const pMin=Math.max(2, pavMinF); if(pmax<pMin) continue;   // forma desenhada: o último bloco começa no andar pavMinF (abaixo disso ele some)
        // automático: o teto é também o maior nº de pavimentos em que o mix cabe (os subsolos não mudam a torre: um por garagem elevada);
        // a lista inclui alturas menores (70% e 50%): menos andares = planta mais larga, menos vagas exigidas e menos subsolos
        let P=pmax; if(!forma){ let pf=pfit.get(gac); if(pf===undefined){ pf=fitAte(st, nT, Math.min(pMin, pmax), pmax); pfit.set(gac, pf) } P=Math.min(pmax, pf); if(P<pMin) continue }
        // forma desenhada: também o andar mínimo e o meio da faixa — a altura muda o bloco de referência (pilha) e o nº de elevadores
        // (eficiência real da planta), então os pavimentos mais altos podem não comportar o mix
        for(const pav of [...new Set([P, P-1, P-3, Math.ceil(P*0.7), ...(forma? [curPav, ...(pavMinF>1? [pMin] : []), Math.round((pMin+P)/2)] : [Math.ceil(P*0.5)])])].filter(p=>p>=pMin && p<=pmax)){
          const kc=gac+"|"+pav, sMin=cumpre.get(kc);
          if(sMin!=null && sub>sMin){ tested++; continue }   // dominada por sMin subsolos: mesmo preço, mais custo (conta como testada, como antes)
          st.produto.torres=Array.from({length:nT},()=>({pav}));
          const m=massing(st); if(memoEf) blcPrivEstimada(st, m, memoEf);
          if(!m.T.every(t=>t.fit)) continue;
          cont.cabe++;
          if(forma){   // a forma não encolhe nem sobe sozinha: gabarito, CA, blocos ignorados e tamanho das unidades conferidos aqui
            if(m.H>(m.hLim ?? st.regras.hMax)+1e-6 || m.CA>st.regras.caMax+1e-6 || m.T.some(t=>t.blcIgn && t.blcIgn.length)) continue;
            if(otimDesvio(m)>rTol && !(pk==="atual" && N===curN)) continue }
          const vg = otimVagasEst(m, st, cal), okVg = vg >= m.vagasReq;
          if(!okVg && !mc) continue;
          if(m.minApto<st.regras.aptoMin) continue;
          if(okVg) cont.vagas++;
          const f=fin(st,m), sc=score(f,m), num=otimNum(f,m,forma), nivel=otimNivel(num, meta);
          // multicritério: guarda todas as combinações dentro das regras (inclusive as que não atingem as vagas — é um dos critérios)
          if(mc){ const sk=nT+"|"+pk+"|"+N+"|"+pav+"|"+gac; let sol=solMemo.get(sk); if(sol===undefined){ sol=otimSolProxy(st,m,entPrs); solMemo.set(sk,sol) }
            pts.push({key:otimKey({nT,pk,N,pav,sub,gac}), nT, pk, N, pav, sub, gac, mix:clone(st.produto.mix), units:m.units, vagas:vg, req:m.vagasReq,
              ...num, sol, est:true}) }
          if(!okVg) continue;
          tested++; if(sub>=1 && (cumpre.get(kc)==null || sub<cumpre.get(kc))) cumpre.set(kc, sub);
          const c={sc, nivel, nT, pk, N, pav, sub, gac, mix:clone(st.produto.mix), units:m.units, priv:m.priv, vagas:vg, req:m.vagasReq, CA:m.CA, H:m.H, ...num};
          if(!best || otimMelhor(c, best)<0) best=c;
        }
        if(tested>=8) break;
      }
      if(best) res.push(best);
    }
    prog(0.6*i/jobs.length);
    if(i<jobs.length) setTimeout(step,0);
    else { res.sort(otimMelhor); prog(0.6); validar(res.slice(0,14), out0=>{
      const canc=e=>/cancelado/.test(e && e.message || "");
      ciclo(out0).catch(e=>{ if(canc(e)) throw e; console.error("[otimizar] ciclo", e); return out0 })
        .then(fechaFim).catch(e=>{ if(canc(e)) cancela(); else reject(e) }) }) }
  };
  /* depois do ciclo: nenhuma opção (por quê), o que fecharia a conta e a fronteira */
  const fechaFim=out=>{ if(parou()) return cancela();
      const o={res:out, obj:opts.obj, k, cal, meta, ms:performance.now()-t0, testadas:res.length, ...(tPct? {terrenoPct:tPct} : {}), ...(formaInfo? {forma:formaInfo} : {})};
      // nenhuma combinação conferida: por quê (lote pequeno para as regras, ou a garagem não comporta as vagas exigidas)
      if(!out.length){ const mv=base.regras.m2Vaga||28, ys=Math.max(0, Math.round(cal.s*Math.floor((mNow.subA || G.area(base.lote.pts)*(1-base.regras.permeab))/mv)));
        o.semOpcao = !cont.cabe ? {k:"lote", motivo:"o lote é pequeno demais para as regras: nenhuma torre comporta as unidades dentro dos recuos e da ocupação"}
          : {k:"vagas", motivo:`a garagem rende cerca de ${ys} vaga${ys===1?"":"s"} por subsolo neste lote e as regras pedem ${nf(+base.regras.vagasApto||0,1)} por unidade`, porSubsolo:ys} }
      // sem lucro (ou abaixo da meta): o motivo e o que fecharia a conta da melhor (a menos ruim). Os preços que fecham a conta são os
      // MENORES entre as opções conferidas (opcaoZero/opcaoMeta = índice em res quando não é a primeira): com o preço maior, outra
      // combinação pode fechar antes
      const b=out[0];
      if(b && b.margem<meta-1e-9){ try{ const cb=conf.get(b.key), f=fin(cb.st, cb.m); o.fecha=otimFecha(cb.st, cb.m, f, meta, tPct);
        out.forEach((r,q)=>{ if(!q) return; const c=conf.get(r.key); if(!c) return;
          const pz=o.fecha.precoZero!=null && r.lucro>0? null : otimPrecoPara(c.st, c.m, 0, tPct), pm=otimPrecoPara(c.st, c.m, meta, tPct);
          if(pz!=null && (o.fecha.precoZero==null || pz<o.fecha.precoZero-1)){ o.fecha.precoZero=pz; o.fecha.opcaoZero=q }
          if(pm!=null && (o.fecha.precoMeta==null || pm<o.fecha.precoMeta-1)){ o.fecha.precoMeta=pm; o.fecha.opcaoMeta=q } });
        if(!(b.lucro>0)){ o.semLucro=o.fecha; b.semLucro=true } }catch(e){ console.error("[otimizar] fecha", e); if(!(b.lucro>0)){ o.semLucro={k:"custo", motivo:"custos acima da receita", meta}; b.semLucro=true } } }
      if(!mc) return finish(o);
      multi(out, o) };
  const stOf=r=>{ const st=clone(base); st.produto.mix=clone(r.mix); st.produto.subsolos=r.sub; st.produto.garAcima=r.gac; st.produto.torres=Array.from({length:r.nT},()=>({pav:r.pav})); return st };   // st.blocos fica como está: a forma é do usuário
  const extras=(st,m,r)=>{ const s=otimSol(st,m,true); r.sol=s.h; r.solFonte=s.fonte;
    if(opts.vento){ const v=otimVento(st,m); if(v!=null) r.vento=v }
    if(opts.malha){ const x=otimMalha(st,m); if(x){ r.malha=x; if(x.custo!=null) r.malhaCusto=x.custo } } return r };
  // conferência com o layout real da garagem (avalia, repara…): otimMotor, também usado pelo "o que fecha a conta" (src/calc/ciclo.js)
  const MT=otimMotor(base, {cal, fin, score, forma, rTol, pavMinF, memoEf}), {nivelOk, avalia, repara}=MT;
  // garagem com que cada combinação foi avaliada (aplicarOtim grava junto): a do estudo, até a fase do ciclo trocar
  const gar0 = typeof cicloGarDe==="function"? cicloGarDe(base) : null;
  // progresso: busca 0–0,6 · conferência 0,6–pV1 · ciclo (garagem, térreo, cálculo completo) pV1–pC1 · fronteira pC1–1
  const pV1 = mc? 0.7 : 0.72, pC1 = mc? 0.88 : 1;
  /* opção do resultado a partir de uma conferência c = {st, m, f, sc} (r = a combinação de origem) */
  const opcao=(r, c)=>{ const st=c.st, m=c.m, f=c.f;
    const v={...r, sc:c.sc, pav:st.produto.torres[0].pav, sub:st.produto.subsolos, gac:st.produto.garAcima, mix:clone(st.produto.mix), units:m.units, priv:m.priv, vagas:m.vagas, req:m.vagasReq, CA:m.CA, H:m.H, ...otimNum(f,m,forma)};
    v.nivel=otimNivel(v, meta); v.key=otimKey(v); v.est=false; if(tPct) v.terreno=st.fin.terreno;
    if(gar0) v.garagem=cicloGarDe(st);
    return v };
  // confirma as melhores com o layout real da garagem (reparo em otimMotor)
  const conf=new Map();   // chave → {st, m, f, sc} das opções conferidas (para o ciclo e o "o que fecharia a conta" sem recalcular)
  const validar=(list, done)=>{ let j=0; const out=[];
    const stepV=()=>{ if(parou()) return cancela(); const ts=performance.now();
      while(j<list.length && out.length<5 && performance.now()-ts<60){ const r=list[j++];
        const c=repara(avalia(stOf(r)), j<=3? 4 : 0), st=c.st, m=c.m;
        if(!nivelOk(c) || (forma && otimDesvio(m)>rTol)) continue;   // forma: unidades além da tolerância não entram nas melhores
        const v=opcao(r, c);
        if(out.some(x=>x.key===v.key)) continue;   // o reparo pode levar duas opções à mesma combinação
        if(mc) extras(st,m,v); out.push(v); conf.set(v.key, c) }
      prog(0.6+(pV1-0.6)*j/Math.max(1,list.length));
      if(j<list.length && out.length<5) setTimeout(stepV,0); else done(out.sort(otimMelhor)) };
    stepV() };
  /* ---------- ciclo com o projeto real (fecha a volta Produto → Projeto → Viabilidade) ----------
     Nas finalistas (até opts.cicloN = 3), com o cálculo rápido: tipo de rampa, lado e posição do acesso de veículos e ângulo das vagas
     (cicloGarFinalista, src/calc/ciclo.js: reta, alternada, helicoidal, L e elevador de carros), e as configurações que rendem mais
     vagas passam pelo reparo (−subsolo, −elevada, +andares) — fica a de melhor RESULTADO (nível, depois o objetivo), não a de mais vagas;
     o elevador de carros entra com o custo dele (m.custosExtra). Depois: pendências do projeto (lazer que não coube, rampa ou elevador com
     pendência, faixa de veículos no hall…) pesam na ordem (OTIM_PEN_PEND por pendência grave); a 1ª opção é refeita com o cálculo
     COMPLETO (o mesmo do Projeto e da Viabilidade: vagas, lucro e margem mostrados = os de depois de aplicar); e a variante "lazer
     enxuto" (sem o que não coube e sem os complementos — cicloLazerEnxuto) vira uma ALTERNATIVA explícita (r.enxuto), nunca aplicada
     sozinha. Tempo: o que sobra de tempoTotal, reservando o cálculo completo e a fronteira (opts.tempoCiclo, padrão até 8 s). */
  const ciclo = async out=>{
    if(opts.ciclo===false || !out.length || typeof cicloGarFinalista!=="function") return out;
    const t1=performance.now(), completo=opts.completo!==false, tot=opts.tempoTotal ?? 15000;
    const bud=Math.min(opts.tempoCiclo ?? 8000, Math.max(1500, tot-(t1-t0)-(completo? 4500 : 0)-(mc? 1500 : 0)-800));
    const tem=()=>performance.now()-t1<bud, pausa=()=>new Promise(r=>setTimeout(r,0)), pa=p=>prog(pV1+(pC1-pV1)*Math.min(1,p));
    const nF=Math.min(out.length, opts.cicloN ?? 3); let cfgs=null;
    for(let q=0; q<nF; q++){ if(q && !tem()) break; if(parou()) throw new Error("cancelado");
      const r=out[q], c=conf.get(r.key); if(!c) continue;
      const g=await cicloGarFinalista(MT, c, {tem, temTriagem: q? tem : ()=>performance.now()-t1<0.55*bud, parou, pausa, configs:cfgs, meta, prog:p=>pa(0.75*(q+p)/nF)});
      if(!q) cfgs=g.configs;
      const v=opcao(r, g.melhor.c); v.garInfo=g.info; conf.set(v.key, g.melhor.c);
      if(mc){ if(v.key!==r.key) extras(g.melhor.c.st, g.melhor.c.m, v); else OTIM_EXTRAS.forEach(k=>{ if(r[k]!==undefined) v[k]=r[k] }) }   // o sol não muda com a garagem
      out[q]=v; }
    // pendências do projeto (cálculo rápido) na ordem
    out.forEach(r=>{ const c=conf.get(r.key); r.pend=c? cicloPend(c.m) : []; const ng=r.pend.filter(p=>p.grave).length; if(ng) r.sc-=OTIM_PEN_PEND*Math.min(3,ng)*Math.abs(r.sc) });
    const seen=new Set(); out=out.filter(r=>!seen.has(r.key) && seen.add(r.key)).sort(otimMelhor);
    pa(0.78); await pausa(); if(parou()) throw new Error("cancelado");
    // a 1ª com o cálculo completo (o do Projeto); faltando vagas nele, tenta a seguinte (uma vez)
    if(completo){
      for(let q=0; q<Math.min(2, out.length); q++){ const r=out[q], c=conf.get(r.key); if(!c) continue;
        if(q && performance.now()-t0>tot-2500){ [out[0], out[1]]=[out[1], out[0]]; break }   // sem tempo para conferir a 2ª: ela sobe sem o completo
        const st=clone(c.st), m=compute(st), f=fin(st, m), cc={st, m, f, sc:score(f, m)};
        const v=opcao(r, cc); v.garInfo=r.garInfo; v.completo=true; v.pend=cicloPend(m); v.sc=r.sc+(cc.sc-c.sc);
        OTIM_EXTRAS.forEach(k=>{ if(r[k]!==undefined) v[k]=r[k] });
        conf.set(v.key, cc);
        if(nivelOk(cc)){ out.splice(q, 1); out.unshift(v); break }   // a 2ª fecha e a 1ª não: a 2ª passa para o topo
        // não fecha as vagas no cálculo completo: fica marcada e a seguinte é conferida
        v.vagasFalta=cc.m.vagasReq-cc.m.vagas; v.pend.unshift({k:"vagas", grave:true, msg:`no layout completo faltam ${v.vagasFalta} vaga${v.vagasFalta>1?"s":""}`}); out[q]=v;
        pa(0.86); await pausa(); if(parou()) throw new Error("cancelado") }
    }
    pa(0.9); await pausa(); if(parou()) throw new Error("cancelado");
    // variante "lazer enxuto" da 1ª (alternativa explícita, com o reparo de garagens e andares que ela permite)
    const r0=out[0], c0=conf.get(r0.key), lz=c0 && cicloLazerEnxuto(c0.st, c0.m);
    if(lz && performance.now()-t0<tot-(lz.naoCoube.length? -1500 : 500)){   // o que não coube sempre ganha a alternativa (até 1,5 s além do total)
      const s2=clone(c0.st); s2.produto.lazer.itens=clone(lz.itens); let c=avalia(s2); c=repara(c, 1);
      if(nivelOk(c) && c.f.lucro>c0.f.lucro+1){ const v=opcao(r0, c); delete v.garInfo; delete v.pend;
        r0.enxuto={...v, lazer:clone(lz.itens), tira:lz.tira, dLucro:c.f.lucro-c0.f.lucro, dMargem:c.f.margemVGV-c0.f.margemVGV, pend:cicloPend(c.m)} } }
    pa(1);
    return out };
  // multicritério: confere com a garagem real alguns pontos da fronteira estimada e calcula a fronteira final
  const multi=(out, o)=>{
    const R=base.regras, crit0=[PARETO_CRIT.lucro, PARETO_CRIT.sol, PARETO_CRIT.vagas, ...(forma? [PARETO_CRIT.dev] : []), ...(opts.efic? [PARETO_CRIT.efic] : []), ...(opts.vc? [PARETO_CRIT.vc] : [])], have=new Set(out.map(r=>r.key));
    // metade da fronteira geral, metade da fronteira das que atingem as vagas (para o filtro "vagas ≥ exigidas" ter opções)
    const nMax=Math.max(0, opts.paretoMax ?? 8), fr0=(l)=>paretoFronteira(l, crit0).map(q=>l[q]).filter(p=>!have.has(p.key));
    const okV=pts.filter(p=>p.vagas>=p.req), a=paretoEspalha(fr0(okV), Math.ceil(nMax/2), "lucro"), aK=new Set(a.map(p=>p.key));
    const cand=paretoPrioridade([...a, ...paretoEspalha(fr0(pts).filter(p=>!aK.has(p.key)), nMax-a.length, "lucro")], "lucro"), val=[], t1=performance.now(); let j=0;   // extremos primeiro: se o tempo acabar, a fronteira perde o meio, não as pontas
    // tempo da conferência com a garagem real: o que sobra de tempoTotal (15 s), entre 2 s e tempoMax (9 s); os extremos da fronteira vêm primeiro
    const tBud=Math.min(opts.tempoMax ?? 9000, Math.max(2000, (opts.tempoTotal ?? 15000)-(t1-t0)));
    const stepM=()=>{ if(parou()) return cancela(); const ts=performance.now();
      while(j<cand.length && performance.now()-ts<60 && performance.now()-t1<tBud){ const p=cand[j++], st=stOf(p), m=compute(st,{quick:true});
        if(!m.T.every(x=>x.fit) || m.H>(m.hLim ?? R.hMax)+1e-6 || m.CA>R.caMax+1e-6) continue;
        const f=fin(st,m), v={...p, sc:score(f,m), units:m.units, priv:m.priv, vagas:m.vagas, req:m.vagasReq, CA:m.CA, H:m.H, ...otimNum(f,m,forma), est:false, ...(gar0? {garagem:gar0} : {})};
        v.nivel=otimNivel(v, meta); if(tPct) v.terreno=st.fin.terreno; val.push(extras(st,m,v)) }
      prog(pC1+(1-pC1)*j/Math.max(1,cand.length));
      if(j<cand.length && performance.now()-t1<tBud) return setTimeout(stepM,0);
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
/* aplica uma opção de uma vez (um passo de desfazer na interface): pavimentos, mix, subsolos e garagens E a garagem com que ela foi
   conferida (r.garagem: tipo de rampa, lado e posição do acesso de veículos, ângulo das vagas — cicloGarPoe) e, na alternativa "lazer
   enxuto" (r.enxuto, aplicada só quando o usuário escolhe), o programa de lazer (r.lazer). Forma desenhada (r.forma): o nº de torres e
   S.blocos ficam como estão (só o total de andares muda — o último bloco estica) e os demais campos de cada torre são preservados */
function aplicarOtim(r, st=S){ const old=st.produto.torres||[];
  st.produto.torres=Array.from({length:r.nT},(_,i)=> r.forma? {...(old[i]||{}), pav:r.pav} : {pav:r.pav}); st.produto.mix=clone(r.mix); st.produto.subsolos=r.sub; st.produto.garAcima=r.gac;
  if(r.garagem && typeof cicloGarPoe==="function") cicloGarPoe(st, r.garagem);
  if(Array.isArray(r.lazer)) st.produto.lazer.itens=clone(r.lazer) }
/* opções do otimizador com vários critérios (vão junto com S.otim para o Worker); filtros fVagas/fSol/solMin são só da tela */
extendDEF("otim", { ...DEF.otim, rTol:0.10, mc:true, vento:false, malha:false, efic:false, vc:false, paretoMax:8, fVagas:false, fSol:false, solMin:3 });
