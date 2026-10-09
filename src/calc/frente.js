/* ================= ruas → frentes do lote (cálculo puro: Node, Worker e página) =================
   As vias do OpenStreetMap (S.contexto.dados.vias, sistema local do lote: {p, w, t, n, m?}) dizem quais lados do lote dão para a rua.
   ruasDoLote(lote, vias, o)       → por aresta {i, len, rua:{nome, classe, largura, estimada, dist, cobertura, hier}|null, alt:[nomes]}
       a via conta quando é paralela (< o.angMax, 20°), fica do lado de fora do lote a no máximo o.tol (10 m) da borda e cobre
       pelo menos o.cobMin (50%) da aresta
   sugereFrentes(lote, ruas)       → {front, principal, tipo: "uma"|"esquina"|"passante"|"varias"|"nenhuma", esquina}
   sugereAcesso(lote, ruas, sug)   → {i, nome, classe, igualPrincipal, pos}   (acesso de veículos pela via de MENOR hierarquia)
   regraPorLargura(largura, tab)   → {rec, ate} (tabela editável; ILUSTRATIVA — conferir na lei; desligada por padrão)
   frenteDetectar(st)              → proposta guardável em S.frentes.sug (nada muda no lote até o usuário confirmar)
   frenteAplicar(st, sug, o)       → grava front, principal, acessoVei (e recuos, se a regra por largura estiver ligada)
   Estado: S.frentes = {sug, regra:{on, tab}} */
extendDEF("frentes", { sug:null, regra:{ on:false, tab:[{ate:7, rec:4}, {ate:12, rec:5}, {ate:99, rec:6}] } });

/* hierarquia da via (maior = mais importante) e largura de reserva quando os dados não trazem */
const FR_HIER = { motorway:6, motorway_link:5, trunk:6, trunk_link:5, primary:5, primary_link:4.5, secondary:4, secondary_link:3.5, tertiary:3, tertiary_link:2.8,
  busway:3, unclassified:2.5, road:2.2, residential:2, living_street:1, service:0.5, track:0.3 };
const FR_LARG = { motorway:15, trunk:12, primary:11, secondary:9.5, tertiary:8, unclassified:6.5, residential:7, living_street:5.5, service:4.5, track:3.5, road:6.5, busway:7 };
const FR_NOME_CLASSE = { motorway:"rodovia", trunk:"via arterial", primary:"via principal", secondary:"via coletora", tertiary:"via coletora", unclassified:"via local", residential:"rua local", living_street:"rua de pedestres", service:"via de serviço", road:"via", track:"estrada", busway:"corredor" };
const frHier = t => FR_HIER[String(t||"").replace(/_link$/,"")] ?? FR_HIER[t] ?? 2;
const frNomeClasse = t => FR_NOME_CLASSE[String(t||"").replace(/_link$/,"")] || "via";

function frSArea(p){ let a=0; for(let i=0;i<p.length;i++){ const q=p[i], r=p[(i+1)%p.length]; a+=q[0]*r[1]-r[0]*q[1] } return a/2 }
/* união de intervalos [a,b] → comprimento total */
function frUniao(iv){ if(!iv.length) return 0; iv=iv.slice().sort((x,y)=>x[0]-y[0]); let tot=0, a=iv[0][0], b=iv[0][1];
  for(let k=1;k<iv.length;k++){ const [c,d]=iv[k]; if(c>b){ tot+=b-a; a=c; b=d } else if(d>b) b=d } return tot+(b-a) }

function ruasDoLote(lote, vias, o={}){
  const tol=o.tol ?? 10, angMax=(o.angMax ?? 20)*Math.PI/180, cobMin=o.cobMin ?? 0.5, dentro=o.dentro ?? 2.5, n=lote.length, cosMin=Math.cos(angMax);
  const sg = frSArea(lote)>=0 ? 1 : -1, out=[];
  for(let i=0;i<n;i++){
    const a=lote[i], b=lote[(i+1)%n], dx=b[0]-a[0], dy=b[1]-a[1], len=Math.hypot(dx,dy);
    if(len<0.5){ out.push({i, len, rua:null, alt:[]}); continue }
    const ux=dx/len, uy=dy/len, nx=sg*uy, ny=-sg*ux;          // normal para fora do lote
    const grupos=new Map();
    (vias||[]).forEach((v,vi)=>{
      if(!v || !v.p || v.p.length<2) return;
      const h=(+v.w || FR_LARG[v.t] || 6)/2;
      for(let k=0;k<v.p.length-1;k++){
        const c=v.p[k], d=v.p[k+1], sl=Math.hypot(d[0]-c[0], d[1]-c[1]); if(sl<1e-6) continue;
        if(Math.abs(((d[0]-c[0])*ux+(d[1]-c[1])*uy)/sl) < cosMin) continue;                 // não é paralela
        const t0=(c[0]-a[0])*ux+(c[1]-a[1])*uy, t1=(d[0]-a[0])*ux+(d[1]-a[1])*uy, dt=t1-t0; if(Math.abs(dt)<1e-6) continue;
        let ta=(0-t0)/dt, tb=(len-t0)/dt; if(ta>tb){ const q=ta; ta=tb; tb=q }
        const lo=Math.max(0,ta), hi=Math.min(1,tb); if(hi<=lo) continue;                    // fora do trecho da aresta
        const s0=(c[0]-a[0])*nx+(c[1]-a[1])*ny, s1=(d[0]-a[0])*nx+(d[1]-a[1])*ny;
        const da=s0+(s1-s0)*lo-h, db=s0+(s1-s0)*hi-h;                                       // folga entre a borda da pista e a borda do lote
        if(Math.min(da,db)< -dentro || Math.max(da,db)>tol) continue;
        const ia=t0+dt*lo, ib=t0+dt*hi, g=v.n? "n:"+v.n : "v:"+vi;
        let G=grupos.get(g); if(!G){ G={nome:v.n||"", classe:v.t, w:+v.w || FR_LARG[v.t] || 6, medida:!!v.m, iv:[], somaD:0, somaL:0}; grupos.set(g,G) }
        if(v.m && !G.medida){ G.medida=true; G.w=+v.w }
        if(frHier(v.t) > frHier(G.classe)) G.classe=v.t;
        G.iv.push([Math.min(ia,ib), Math.max(ia,ib)]); const L=Math.abs(ib-ia); G.somaD+=(da+db)/2*L; G.somaL+=L;
      }
    });
    const cand=[...grupos.values()].map(G=>({ nome:G.nome, classe:G.classe, largura:+G.w.toFixed(1), estimada:!G.medida, dist:+(G.somaD/Math.max(1e-6,G.somaL)).toFixed(1),
        cobertura:Math.min(1, frUniao(G.iv)/len), hier:frHier(G.classe) }))
      .filter(r=>r.cobertura>=cobMin)
      .sort((x,y)=> Math.abs(y.cobertura-x.cobertura)>0.15 ? y.cobertura-x.cobertura : (x.dist-y.dist));
    const rua=cand[0]||null;
    out.push({ i, len, rua: rua? Object.assign(rua, {cobertura:+rua.cobertura.toFixed(2)}) : null, alt: cand.slice(1).map(r=>r.nome).filter(Boolean) });
  }
  return out;
}

/* ângulo (graus, 0–90) entre duas arestas */
function frAngulo(lote, i, j){ const n=lote.length, v=k=>{ const a=lote[k], b=lote[(k+1)%n], l=Math.hypot(b[0]-a[0],b[1]-a[1])||1; return [(b[0]-a[0])/l,(b[1]-a[1])/l] };
  const u=v(i), w=v(j); return Math.acos(Math.min(1, Math.abs(u[0]*w[0]+u[1]*w[1])))*180/Math.PI }

function sugereFrentes(lote, ruas, o={}){
  const n=lote.length, com=ruas.filter(r=>r.rua);
  if(!com.length) return { front:[], principal:null, tipo:"nenhuma", esquina:false };
  const front=com.map(r=>r.i).sort((a,b)=>a-b);
  // principal: a via de maior hierarquia; empate, a maior testada
  const pr=com.slice().sort((x,y)=> (y.rua.hier-x.rua.hier) || (y.len-x.len))[0].i;
  // tipo do lote: esquina (duas ruas diferentes que se cruzam), passante (duas ruas em lados opostos) ou uma frente
  let tipo = front.length===1 ? "uma" : "varias";
  const diferentes=(x,y)=> (x.rua.nome && y.rua.nome ? x.rua.nome!==y.rua.nome : frAngulo(lote,x.i,y.i)>45);
  let esq=false, pass=false;
  for(let a=0;a<com.length;a++) for(let b=a+1;b<com.length;b++){
    const x=com[a], y=com[b]; if(!diferentes(x,y)) continue;
    const viz = (x.i+1)%n===y.i || (y.i+1)%n===x.i;
    if(viz){ if(frAngulo(lote,x.i,y.i)>=25) esq=true } else pass=true }
  if(esq) tipo="esquina"; else if(pass) tipo="passante"; else if(front.length>1) tipo="varias";
  return { front, principal:pr, tipo, esquina: tipo==="esquina" };
}

/* posição (0–1) do acesso de veículos na aresta i, afastada da esquina quando há outra frente vizinha; null = deixar como está */
function frPosForaEsquina(lote, i, front){
  const n=lote.length, ant=(i-1+n)%n, prox=(i+1)%n, fr=new Set(front);
  if(fr.has(prox) && !fr.has(ant)) return 0.2;       // a esquina fica no fim da aresta → entrada no começo
  if(fr.has(ant) && !fr.has(prox)) return 0.8;
  return null;
}
function sugereAcesso(lote, ruas, sug){
  const com=ruas.filter(r=>r.rua && sug.front.includes(r.i));
  if(!com.length) return null;
  const e=com.slice().sort((x,y)=> (x.rua.hier-y.rua.hier) || (y.len-x.len))[0];
  return { i:e.i, nome:e.rua.nome, classe:e.rua.classe, igualPrincipal:e.i===sug.principal, menor: com.length>1 && com.some(c=>c.rua.hier>e.rua.hier), pos: frPosForaEsquina(lote, e.i, sug.front) };
}

/* tabela editável: primeira faixa cuja largura "ate" comporta a via. null se a tabela está vazia */
function regraPorLargura(largura, tab){
  const t=(tab||[]).filter(r=>r && isFinite(+r.ate) && isFinite(+r.rec)).sort((a,b)=>a.ate-b.ate); if(!t.length || !(largura>0)) return null;
  const r=t.find(x=>largura<=x.ate) || t[t.length-1]; return { rec:+r.rec, ate:+r.ate };
}

/* assinatura do contorno: a proposta só vale enquanto o lote é o mesmo */
function frHash(lote){ return lote.map(q=>Math.round(q[0]*10)+","+Math.round(q[1]*10)).join(";") }
function frenteDetectar(st, o={}){
  const lote=st.lote.pts, vias=(st.contexto && st.contexto.dados && st.contexto.dados.vias) || [];
  const ruas=ruasDoLote(lote, vias, o), sug=sugereFrentes(lote, ruas, o), ace=sug.front.length? sugereAcesso(lote, ruas, sug) : null;
  return { h:frHash(lote), n:lote.length, quando:o.quando||"", tipo:sug.tipo, front:sug.front, principal:sug.principal, acesso:ace,
    lados: ruas.filter(r=>r.rua).map(r=>({ i:r.i, nome:r.rua.nome, classe:r.rua.classe, larg:r.rua.largura, est:r.rua.estimada, dist:r.rua.dist, cob:r.rua.cobertura, hier:r.rua.hier })),
    semVia: !vias.length };
}
const frenteValida = (st) => { const s=st.frentes && st.frentes.sug; return !!(s && s.h===frHash(st.lote.pts)) };
/* grava a proposta no lote; nada além de front, principal, acessoVei e (se ligada) os recuos próprios das frentes */
function frenteAplicar(st, sug, o={}){
  if(!sug || !sug.front || !sug.front.length) return null;
  const L=st.lote, r={ front:L.front.slice(), principal:L.principal };
  L.front=sug.front.slice(); L.principal = o.principal!=null && sug.front.includes(o.principal) ? o.principal : sug.principal;
  const pos=frPosForaEsquina(L.pts, L.principal, L.front); if(pos!=null) L.acessoVei=pos;
  const reg=st.frentes && st.frentes.regra, recs=[];
  if(reg && reg.on){ if(!Array.isArray(L.rec)) L.rec=[]; while(L.rec.length<L.pts.length) L.rec.push({});
    sug.lados.forEach(l=>{ const g=regraPorLargura(+l.larg, reg.tab); if(!g || !L.front.includes(l.i)) return; L.rec[l.i]=Object.assign({}, L.rec[l.i], {e:g.rec, t:g.rec}); recs.push({i:l.i, rec:g.rec}) }) }
  return { antes:r, front:L.front, principal:L.principal, acessoVei:L.acessoVei, recs };
}
