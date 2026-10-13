/* ================= Fase C — torres desenhadas (blocos) =================
   C0: o "Limite especial › Torres" pode virar a planta da torre (S.custom.torOcupa).
   O massing usa o contorno recortado pelos recuos como planta; as unidades do mix crescem ou encolhem
   (fator t.r) até preencher o andar. Aqui ficam o resumo, os avisos e o "Ajustar mix". Puro (sem DOM). */

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
