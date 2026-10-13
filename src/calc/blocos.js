/* ================= Fase C — torres desenhadas (blocos) =================
   C0: o "Limite especial › Torres" pode virar a planta da torre (S.custom.torOcupa).
   O massing usa o contorno recortado pelos recuos como planta; as unidades do mix crescem ou encolhem
   (fator t.r) até preencher o andar. Aqui ficam o resumo, os avisos e o "Ajustar mix". Puro (sem DOM).

   C1: forma livre da torre. Estado em S.blocos = {modo:"auto"|"desenhada", torres:[{blocos:[{pts, vazios?, de, tipo?, rot?}]}]}
   (índice = torre de S.produto.torres). Um bloco é um contorno que vale do andar 'de' até o próximo bloco; no C1 cada torre
   tem no máximo UM bloco (de = 1, vale para todos os andares — o total segue no stepper da torre). Em "desenhada", a torre
   com bloco usa o bloco como planta (recortado pelo lote, NÃO encolhido pelos recuos): recuo, TO, CA, gabarito, balanço,
   núcleo e distância entre torres viram avisos. Torre sem bloco (ou modo "auto") = forma automática, como antes. */
extendDEF("blocos", { modo:"auto", torres:[] });
const BLC_FORMAS = [["ret","Retângulo"],["L","L"],["U","U"],["T","T"],["H","H"],["patio","Pátio"]];
const blcAtivo = st => !!(st && st.blocos && st.blocos.modo==="desenhada");
/* bloco da torre i (C1: o primeiro), só no modo desenhado */
function blcBloco(st, i){ if(!blcAtivo(st)) return null; const t=(st.blocos.torres||[])[i], b=t && t.blocos && t.blocos[0]; return b && b.pts && b.pts.length>2 ? b : null }
/* planta de um bloco: contorno recortado pelo lote; os vazios inteiros dentro viram polígono com ponte (entPoly) */
function blcPlanta(b, L){
  const raw=b.pts, rawA=G.area(raw), out = L && L.length>2 ? G.clipToPoly(raw, L) : raw.slice();
  if(out.length<3) return {plate:[], A:0, oco:null, rawA, foraLote:rawA};
  const vz=(b.vazios||[]).filter(v=>entVazioOk({pts:out}, v));
  const plate = vz.length ? entPoly({pts:out, vazios:vz}) : out;
  return {plate, A:G.area(plate), oco: vz.length? {pts:out, vazios:vz} : null, rawA, foraLote:Math.max(0, rawA-G.area(out))};
}
/* chamado pelo massing: planta desenhada da torre i (ou null = automática) */
function blcTorre(st, i, L){ const b=blcBloco(st, i); return b ? {...blcPlanta(b, L), b} : null }
/* planta do andar k (1 = primeiro pavimento da torre) pela faixa a que ele pertence (2.4 escalonada; C2 pilha de blocos) */
function torrePlantaAndar(t, k){ const f=(t.faixas||[]).find(f=>k>=f.de && k<=f.ate); return f && f.plate ? f.plate : t.plate }
/* perímetro de fachada de uma planta da torre (com pátio: borda + vazios, sem a "ponte" do polígono) */
function blcPerim(t, p){ if(!p || p.length<3) return 0; if(t && t.oco && p===t.plate) return [t.oco.pts, ...t.oco.vazios].reduce((s,r)=>s+G.perimeter(r),0); return G.perimeter(p) }
/* forma automática da torre i (o que o massing calcula sem blocos): planta, faixa máxima (slot) e área */
function blcAutoPlanta(st, i){
  const s2=Object.assign({}, st, {blocos:{modo:"auto", torres:[]}}), m=massing(s2), t=m.T[i]||{};
  return {plate:t.plate||[], slot:(t.slot&&t.slot.length? t.slot : m.torAll)||[], A:t.A||0, torAll:m.torAll};
}
/* "Personalizar esta torre": copia a forma automática atual para um bloco editável (nada muda nos números) */
function blcPersonaliza(st, i){
  const a=blcAutoPlanta(st, i); if(!a.plate.length) return null;
  const B=st.blocos; B.modo="desenhada"; B.torres=B.torres||[];
  while(B.torres.length<=i) B.torres.push({blocos:[]});
  const b={pts:a.plate.map(q=>[q[0],q[1]]), de:1, tipo:"auto"};
  B.torres[i]={blocos:[b]}; return b;
}
/* formatos prontos ------------------------------------------------------------------------------------------------- */
/* moldura da faixa da torre: eixo ao longo do lado mais longo */
function blcMoldura(p){ const ux=G.longestDir(p), vy=[-ux[1],ux[0]], [u0,u1]=G.extent(p,ux), [v0,v1]=G.extent(p,vy); return {ux,vy,W:u1-u0,D:v1-v0,cu:(u0+u1)/2,cv:(v0+v1)/2} }
/* contorno (anti-horário, centrado) de cada formato com largura W, profundidade D e alas de largura a */
function blcGabarito(tipo, W, D, a){
  const w=W/2, d=D/2;
  switch(tipo){
    case "L": return {pts:[[-w,-d],[w,-d],[w,-d+a],[-w+a,-d+a],[-w+a,d],[-w,d]]};
    case "U": return {pts:[[-w,-d],[w,-d],[w,d],[w-a,d],[w-a,-d+a],[-w+a,-d+a],[-w+a,d],[-w,d]]};
    case "T": return {pts:[[-a/2,-d],[a/2,-d],[a/2,d-a],[w,d-a],[w,d],[-w,d],[-w,d-a],[-a/2,d-a]]};
    case "H": return {pts:[[-w,-d],[-w+a,-d],[-w+a,-a/2],[w-a,-a/2],[w-a,-d],[w,-d],[w,d],[w-a,d],[w-a,a/2],[-w+a,a/2],[-w+a,d],[-w,d]]};
    case "patio": return {pts:[[-w,-d],[w,-d],[w,d],[-w,d]], vazio:[[-w+a,-d+a],[w-a,-d+a],[w-a,d-a],[-w+a,d-a]]};
    default: return {pts:[[-w,-d],[w,-d],[w,d],[-w,d]]};
  }
}
/* formato pronto dentro da faixa da torre (slot), com a área líquida 'alvo' (se couber). rot = quartos de volta (0–3).
   ala = largura das alas (L/U/T/H) ou do anel (pátio): planta dupla com corredor central ≈ 2 × 5,5 + 1,6 m */
function blcFormato(tipo, slot, alvo, o={}){
  if(!slot || slot.length<3) return null;
  const F=blcMoldura(slot), rot=(((o.rot|0)%4)+4)%4, a0=o.ala||12.6;
  const toW=(x,y)=>{ const u=F.cu+x, v=F.cv+y; return [F.ux[0]*u+F.vy[0]*v, F.ux[1]*u+F.vy[1]*v] };
  const R=q=>{ let x=q[0], y=q[1]; for(let k=0;k<rot;k++){ const t=x; x=-y; y=t } return toW(x,y) };
  // largura máxima das alas: L/T podem engrossar até quase fechar; U e H mantêm o vão entre as alas; o pátio mantém 8 m de vazio
  const aMax = mn=> tipo==="patio" ? Math.max(5,(mn-8)/2) : tipo==="L"||tipo==="T" ? 0.7*mn : 0.4*mn;
  const make=(s, aa)=>{
    const W=F.W*s, D=F.D*s, mn=Math.min(W,D), Wt=rot%2? D : W, Dt=rot%2? W : D;
    const a = Math.min(aa??a0, aMax(mn)), aP = tipo==="patio" ? Math.max(5, a) : Math.min(a, 0.45*mn);
    const T=blcGabarito(tipo, Wt, Dt, tipo==="patio"? aP : a), pts=G.clipToPoly(T.pts.map(R), slot);
    let vz=T.vazio && pts.length>2 ? T.vazio.map(R) : null; if(vz && !(entVazioOk({pts}, vz) && aP*2<mn-2)) vz=null;
    return {pts, vazios: vz? [vz] : null, A: pts.length>2 ? G.area(pts)-(vz? G.area(vz) : 0) : 0, ala: tipo==="patio"? aP : a};
  };
  let r=make(1);
  if(r.A > alvo+0.5){ let lo=0.02, hi=1; for(let k=0;k<44;k++){ const mid=(lo+hi)/2; if(make(mid).A<alvo) lo=mid; else hi=mid } r=make(hi) }
  else if(r.A < alvo-0.5 && tipo!=="ret"){   // a faixa inteira com alas padrão não dá a área: engrossa as alas (ou afina o anel do pátio)
    const lim=aMax(Math.min(F.W,F.D)), Af=a=>make(1,a).A;
    if(Af(lim)>=alvo){ let lo=Math.min(a0,lim), hi=lim; for(let k=0;k<40;k++){ const mid=(lo+hi)/2; if(Af(mid)<alvo) lo=mid; else hi=mid } r=make(1,hi) }
    else r=make(1,lim);
  }
  const b={pts:r.pts, de:1, tipo, rot}; if(r.vazios) b.vazios=r.vazios;
  return {bloco:b, A:r.A, ala:r.ala, curto: r.A < alvo-1};
}
/* aplica um formato à torre i, com a área atual do andar; clicar de novo no mesmo formato gira 90° */
function blcAplicaFormato(st, i, tipo){
  const auto=blcAutoPlanta(st, i), m=massing(st), alvo=(m.T[i]&&m.T[i].A) || auto.A, cur=blcBloco(st, i);
  const rot = cur && cur.tipo===tipo ? ((cur.rot|0)+1)%4 : 0;
  const slot = auto.slot.length ? auto.slot : st.lote.pts;
  const r=blcFormato(tipo, slot, alvo, {rot, ala: 2*(+st.estudo.profMin||5.5)+(+st.estudo.corrTipo||1.6)}); if(!r || r.bloco.pts.length<3) return null;
  const B=st.blocos; B.modo="desenhada"; B.torres=B.torres||[]; while(B.torres.length<=i) B.torres.push({blocos:[]});
  B.torres[i]={blocos:[r.bloco]}; return r;
}
/* distância entre dois contornos (0 se encostam ou se sobrepõem) */
function blcDist(a, b){
  if(!a.length || !b.length) return Infinity; if(G.polysOverlap(a,b)) return 0;
  return Math.min(...a.map(q=>entDistBorda(q,b)), ...b.map(q=>entDistBorda(q,a)));
}
/* área de p fora do polígono convexo c */
const blcFora = (p, c) => !p.length || !c || c.length<3 ? 0 : Math.max(0, G.area(p) - G.area(G.clipToPoly(p, c)));
/* fração de um polígono (convexo, ex.: o núcleo) que cai dentro da planta — amostras numa grade 6 × 6; a planta pode ser L, U ou ter pátio */
function blcDentro(p, plate){
  const ux=G.longestDir(p), vy=[-ux[1],ux[0]], [u0,u1]=G.extent(p,ux), [v0,v1]=G.extent(p,vy); let n=0, d=0;
  for(let a=0;a<6;a++) for(let b=0;b<6;b++){ const u=u0+(a+0.5)/6*(u1-u0), v=v0+(b+0.5)/6*(v1-v0), q=[ux[0]*u+vy[0]*v, ux[1]*u+vy[1]*v]; if(!G.pip(q,p)) continue; n++; if(G.pip(q,plate)) d++ }
  return n ? d/n : 1;
}
const blcNome = i => `torre ${i+1}`;
/* resumo do modo desenhado: torres desenhadas, área média, quanto o mix ocupa do pavimento e o "Ajustar mix" */
function blcResumo(st, m){
  if(!m || !m.T) return null;
  const D=m.T.filter(t=>t.desenhada && t.A>1); if(!D.length) return null;
  const P=st.produto, A=D.reduce((s,t)=>s+t.A,0)/D.length, priv=A*P.efic, ocupa = priv>0 ? (m.mixPriv||0)/priv : 0;
  const q=torreAjustaMix(P.mix, priv), muda=q.some((n,j)=>n!==P.mix[j].qtd);
  return {torres:D.map(t=>t.i), A, priv, ocupa, q, muda, desvio: Math.abs(ocupa-1)>0.10};
}
/* avisos de uma torre desenhada (I = medidas usadas pelo desenho da implantação) */
function blcTorreAv(st, m, t, I, out, envTopo){
    const i=t.i, nm=blcNome(i); let auto=null;
    if(!t.plate.length){ out.push(`A ${nm} desenhada ficou fora do lote — redesenhe a forma ou volte para a automática.`); return }
    if(I.foraLote>0.5) out.push(`A ${nm} passa ${nf(I.foraLote,0)} m² para fora do lote — a planta foi cortada na divisa.`);
    const plOut = t.oco ? t.oco.pts : t.plate;
    I.foraRecuo = Math.max(blcFora(plOut, m.torAll), blcFora(plOut, envTopo(t)));
    if(I.foraRecuo>0.5) out.push(`A ${nm} avança ${nf(I.foraRecuo,0)} m² sobre os recuos (afastamento de ${nf(m.afast,1)} m às divisas).`);
    // balanço: só o que a forma desenhada acrescenta além do que a forma automática já tinha fora do embasamento
    if(m.emb && m.emb.length>2){ I.balanco=blcFora(plOut, m.emb);
      if(I.balanco>0.5){ if(!auto) auto=blcAutoPlanta(st, i).plate; const base=auto && auto.length ? blcFora(auto, m.emb) : 0;
        if(I.balanco>base+1) out.push(`A ${nm} sai ${nf(I.balanco,0)} m² da projeção do embasamento — balanço ou pilares próprios até o chão.`); else I.balanco=0 } }
    const l=m.tipo && m.tipo[i];
    if(l && l.core && l.core.length) I.nucleo = blcDentro(l.core, t.plate) >= 0.7;
    else if(m.tipo) I.nucleo=false;
    if(!I.nucleo) out.push(`Na ${nm}, o núcleo (escada e elevadores) cai fora da planta ou num vão da forma — gire ou ajuste a forma; em L, U, T, H e pátio o pavimento tipo é aproximado.`);
}
/* avisos e destaques das torres desenhadas: m.blc[k] (por torre desenhada), m.blcPares (torres próximas), m.blcGeral (índices e mix) */
function blcAvisos(st, m){
  const out=[], R=st.regras, info=[];
  const T=m.T||[], D=T.filter(t=>t.desenhada); if(!D.length) return {avisos:out, info, pares:[], geral:[]};
  const envTopo = t=>{ if(!m.env || !m.env.length) return null; const e=m.env.find(e=>t.H<=e.z1+1e-6) || m.env[m.env.length-1]; return e && e.poly };
  D.forEach(t=>{ const I={i:t.i, foraLote:t.blcForaLote||0, foraRecuo:0, balanco:0, nucleo:true, av:[]}, n0=out.length;
    info.push(I); blcTorreAv(st, m, t, I, out, envTopo); I.av=out.slice(n0) });
  const n1=out.length, pares=[];
  // distância entre torres (só nos pares com ao menos uma desenhada; as automáticas já respeitam a regra)
  for(let a=0;a<T.length;a++) for(let b=a+1;b<T.length;b++){
    if(!(T[a].desenhada||T[b].desenhada) || !T[a].plate.length || !T[b].plate.length) continue;
    const d=blcDist(T[a].plate, T[b].plate);
    if(d<0.01){ pares.push({a, b, d:0}); out.push(`As torres ${a+1} e ${b+1} se encostam ou se sobrepõem.`) }
    else if(d<m.gap-0.05){ pares.push({a, b, d}); out.push(`As torres ${a+1} e ${b+1} ficam a ${nf(d,1)} m; a regra pede ${nf(m.gap,1)} m entre torres.`) }
  }
  // índices: a forma desenhada não encolhe para caber — os excessos viram aviso
  const tor=T.reduce((s,t)=>s+t.A,0), cap=R.toTorre*m.A;
  if(tor>cap+1 && !m.torOcupa) out.push(`As torres ocupam ${nf(tor,0)} m², acima da taxa de ocupação (${nf(cap,0)} m²).`);
  if(m.CA>R.caMax+1e-6) out.push(`Com a forma desenhada, o CA fica em ${nf(m.CA,2)} (máximo ${nf(R.caMax,1)}) — reduza pavimentos ou a área da forma.`);
  const hLim=m.hLim??R.hMax; if(m.H>hLim+1e-6) out.push(`A altura de ${nf(m.H,1)} m passa do gabarito (${nf(hLim,1)} m).`);
  const Rs=blcResumo(st, m);
  if(Rs && Rs.desvio) out.push(`O mix ocupa ${nf(Rs.ocupa*100,0)}% do pavimento desenhado: as unidades ficaram ${Rs.ocupa<1?"maiores":"menores"} que o mix. Use “Ajustar mix” em Produto › Forma das torres.`);
  return {avisos:out, info, pares, geral:out.slice(n1)};
}
HOOK.compute.push((m, st)=>{
  if(!blcAtivo(st) || !(m.T||[]).some(t=>t.desenhada)) return;
  const r=blcAvisos(st, m); m.blc=r.info; m.blcPares=r.pares; m.blcGeral=r.geral; if(m.avisos) m.avisos.push(...r.avisos);
});

/* resumo do contorno ocupado: área do andar, privativa que cabe e quanto as unidades mudaram frente ao mix */
function torOcupaResumo(st, m){
  if(!m || !m.torOcupa) return null;
  const P=st.produto, mixPriv=m.mixPriv||0, mixUn=m.mixUn||0;
  const T=(m.T||[]).filter(t=>t.A>1);
  if(!T.length || mixPriv<=0 || mixUn<=0) return {torres:T.length, A:0, priv:0, r:0, media:0, mixMedia:0, q:P.mix.map(u=>u.qtd), muda:false, desiguais:false};
  const A=T.reduce((s,t)=>s+t.A,0)/T.length, r=T.reduce((s,t)=>s+t.r,0)/T.length;
  // o mix é o mesmo em todas as torres: o ajuste mira a planta média
  const q=torreAjustaMix(P.mix, A*P.efic), muda=q.some((n,j)=>n!==P.mix[j].qtd);
  const As=T.map(t=>t.A), desiguais=Math.max(...As) > Math.min(...As)*1.15;
  return {torres:T.length, A, priv:A*P.efic, r, media:mixPriv*r/mixUn, mixMedia:mixPriv/mixUn, q, muda, desiguais, As};
}

/* avisos do contorno ocupado (entram em m.avisos no compute) */
function torOcupaAvisos(st, m){
  const R=torOcupaResumo(st, m); if(!R) return [];
  const out=[], P=st.produto;
  if(!R.torres) return ["O contorno desenhado das torres ficou vazio depois dos recuos — redesenhe o limite das torres."];
  if(Math.abs(R.r-1)>0.10 && R.muda) out.push(`As torres ocupam o contorno desenhado: as unidades ficaram ${R.r>1?"maiores":"menores"} que o mix (${nf(R.media,0)} m² em média, o mix pede ${nf(R.mixMedia,0)} m²). Use “Ajustar mix” em Terreno › Limites especiais.`);
  if(R.desiguais) out.push(`O contorno desenhado deixa as torres com andares de tamanhos diferentes (${R.As.map(a=>nf(a,0)+" m²").join(" e ")}) e o mix é o mesmo em todas: as unidades mudam de tamanho de uma torre para outra. Redesenhe o contorno ou use uma torre.`);
  const tor=(m.T||[]).reduce((s,t)=>s+t.A,0), cap=st.regras.toTorre*m.A;
  if(tor>cap+1) out.push(`O contorno desenhado das torres passa da taxa de ocupação: ${nf(tor,0)} m² de ${nf(cap,0)} m² permitidos.`);
  if(P.torres.length>1 && !m.slotOk) out.push("O contorno desenhado é estreito demais para dividir entre as torres.");
  return out;
}

/* nova quantidade por tipologia para que o mix preencha 'alvo' m² privativos por andar, sem passar dele.
   Mantém a proporção entre as tipologias, cada tipologia usada fica com ≥ 1 unidade e no máximo 'max'. */
function torreAjustaMix(mix, alvo, max=20){
  const tot=mix.reduce((s,u)=>s+u.area*u.qtd,0);
  if(!(tot>0) || !(alvo>0)) return mix.map(u=>u.qtd);
  const f=alvo/tot, usa=mix.map(u=>u.qtd>0 && u.area>0);
  const q=mix.map((u,j)=> usa[j] ? Math.min(max, Math.max(1, Math.floor(u.qtd*f))) : 0);
  let s=mix.reduce((a,u,j)=>a+u.area*q[j],0);
  const prop=j=>q[j]/mix[j].qtd;
  // passou do alvo (por causa do mínimo de 1): tira de quem está mais acima da proporção
  while(s>alvo){ let b=-1; mix.forEach((u,j)=>{ if(usa[j] && q[j]>1 && (b<0 || prop(j)>prop(b))) b=j }); if(b<0) break; q[b]--; s-=mix[b].area }
  // completa enquanto couber: soma em quem está mais atrás da proporção
  for(;;){ let b=-1; mix.forEach((u,j)=>{ if(usa[j] && q[j]<max && s+u.area<=alvo+1e-6 && (b<0 || prop(j)<prop(b))) b=j }); if(b<0) break; q[b]++; s+=mix[b].area }
  return q;
}
