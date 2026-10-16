/* ================= diretrizes do produto: estudo livre ou com o produto que o incorporador precisa =================
   Pedido do Luiz (16/10/2026): "pode ser um estudo totalmente livre, onde só importam métricas e aproveitamento, ou a opção do
   usuário já limitar alguns critérios que ele precisa atender, como o padrão, a quantidade de quartos, o que ele quer ter de área
   comum aproximada… Afinal, é muito diferente um Minha Casa Minha Vida de um alto padrão."
   Cálculo puro (página, Worker e testes; sem DOM). A tela fica em src/ui/diretrizes.js (Produto) e no assistente.

   Estado S.diretrizes (extendDEF; modo "livre" por padrão = nada muda, estudos de referência iguais):
     modo "livre" | "diretrizes" · padrao (chave de DIR_PADROES) · faixa (MCMV: f12 | f3 | f4 → teto por unidade)
     tips [nº de dormitórios permitidos: 0 = studio … 4] · areas [[mín, máx] por nº de dormitórios; 0 = do padrão] · minPct [mínimo da
     tipologia nas unidades do andar, 0–1] · subMax / gacMax (−1 = livre, 0 = não pode, N = até N) · garTerreo / vagasFrente / cob / lojas
     ("livre" | "sim" | "nao") · cobQtd · vagasUn (0 = as da lei) · elevCarros (permitido) · torres ("livre" | "fixo" | "max") + torresN ·
     pavMin / pavMax / unMin / unMax (0 = livre) · lazerUn (m² de lazer por unidade, aproximado; 0 = sem meta) · lazerObrig [nomes] ·
     margemMin (0 = a meta da Viabilidade) · tetoUn (R$ por unidade; 0 = o da faixa no econômico, senão sem teto)

   API (todas devolvem o comportamento antigo no modo livre):
     dirEfetivas(st) → D (diretrizes com o padrão resolvido) | null no modo livre
     dirTipDe(u) → nº de dormitórios de uma tipologia do mix (u.tip, o nome — "2 dorm.", "3 suítes", "Studio" — ou a área)
     dirPresetMix(st, "dir" | "dir:<q>", N) → mix com as tipologias permitidas (presetMix do otimizador chama esta para chaves "dir…")
     presetNome(pk, st?) → nome de um preset do otimizador (MIX_PRESETS ou das diretrizes)
     dirMixOk(st, mix, D) · dirEstadoOk(st) (otimMotor recusa vizinhos fora das diretrizes) · dirGarOk · dirNs · dirPavs · dirTorres ·
     dirPresets(st, opts, D) · dirRampaOk(st, tipo) · dirLazerObrig(st, nome)
     dirAplicaFixos(st) → [rótulos] (o que é fixo no produto: garagem no térreo, vagas na frente, coberturas, lojas, lazer obrigatório,
       elevador de carros) — aplicarOtim chama, então o que o otimizador conferiu é o que fica no estudo
     dirPrepara(st) → DIR {D, pre, quase…} | null: fixos + o que só vale na conta (vagas por unidade acima da lei, margem mínima)
     dirConfere(st, m, D?) → {ok, falhas[{k, msg, grave}], n} · dirSemOpcao(DIR, base, cont, cal, mNow) → {k, diretriz, motivo} | null
     dirFechaAjusta(DIR, fecha, mix, base) (preço acima do teto não é saída) · dirAplicaPadrao(st, k, o) → [o que mudou]
     dirResumo(st) · dirTipsTxt(D) · dirGarTxt(D)
   Valores de referência (áreas, preços, CUB, lazer, tetos do MCMV): genéricos, "conferir" — ⓘ e glossário dizem isso. */

const DIR_Q = ["Studio","1 dorm.","2 dorm.","3 dorm.","4 dorm."];
const DIR_QC = ["studio","1","2","3","4"];
const DIR_PF = [1.12, 1.06, 1, 0.97, 0.95];          // preço por m² relativo ao de 2 dormitórios (unidade menor vende mais caro por m²)
/* tetos do Minha Casa, Minha Vida (valor máximo do imóvel; os das faixas 1 e 2 variam com a cidade — conferir) */
const DIR_FAIXAS = { f12:{nome:"Faixas 1 e 2", teto:264000}, f3:{nome:"Faixa 3", teto:350000}, f4:{nome:"Faixa 4", teto:500000} };
const DIR_LZ = (l)=>l.map(([nome,area,local,desc])=>({nome, area, local, ...(desc? {desc:true} : {})}));
const DIR_LZ_ALTO = [["Salão de festas",120,"terreo"],["Espaço gourmet",60,"terreo"],["Academia",80,"terreo"],["Brinquedoteca",40,"terreo"],["Coworking",40,"terreo"],
  ["Piscina",90,"emb",1],["Deck / solário",80,"emb",1],["Playground",50,"emb",1],["Pet place",40,"emb",1]];
/* padrões: áreas [mín, alvo, máx] por nº de dormitórios, peso de cada tipologia no andar, sacada, vagas por unidade (0 = lei), CUB e fator
   sobre o CUB, garagem equivalente (fração do CUB por m² de garagem; no econômico, vagas no térreo sem estrutura de garagem), faixa de preço R$/m² [mín, referência, máx], coberturas, elevador de carros, unidades por andar [mín, máx] (0 = livre),
   unidades por andar de partida (assistente), lazer m²/unidade, programa de lazer e itens obrigatórios */
const DIR_PADROES = {
  economico:{ nome:"Econômico (MCMV)", curto:"Econômico", sub:"MCMV", nomes:DIR_Q,
    areas:[[22,27,32],[30,35,42],[38,43,50],[48,55,62],[60,68,76]], tips:[1,2], w:[0,0.3,0.7,0,0], sac:[0,0,0,0,0],
    vagasUn:0, cub:"R8-B", fator:1.05, eqGar:0.5, preco:[5500,7000,8500], cob:"nao", elevCarros:false, un:[4,0], n0:6, lazerUn:1,
    lazer:[["Salão de festas",50,"terreo"],["Playground",40,"emb",1],["Bicicletário",20,"terreo"]], obrig:["Salão de festas","Playground"] },
  medio:{ nome:"Médio", curto:"Médio", sub:"2 e 3 dorm.", nomes:["Studio","1 dorm.","2 dorm.","3 dorm. (1 suíte)","4 dorm. (1 suíte)"],
    areas:[[26,32,38],[36,44,52],[52,62,72],[70,82,95],[95,110,125]], tips:[2,3], w:[0,0,0.6,0.4,0], sac:[3,4,6,8,10],
    vagasUn:1, cub:"R8-N", fator:1.25, eqGar:0.8, preco:[8000,10500,13000], cob:"livre", elevCarros:true, un:[0,0], n0:4, lazerUn:2,
    lazer:[["Salão de festas",80,"terreo"],["Espaço gourmet",40,"terreo"],["Academia",45,"terreo"],["Playground",50,"emb",1]], obrig:["Salão de festas","Playground"] },
  medioAlto:{ nome:"Médio-alto", curto:"Médio-alto", sub:"com suítes", nomes:["Studio","1 suíte","2 suítes","3 dorm. (1 suíte)","4 dorm. (2 suítes)"],
    areas:[[30,36,45],[42,52,62],[65,76,90],[88,105,120],[115,135,155]], tips:[2,3], w:[0,0,0.5,0.5,0], sac:[4,6,9,12,15],
    vagasUn:1.5, cub:"R8-A", fator:1.3, eqGar:0.8, preco:[11000,13500,16000], cob:"sim", elevCarros:true, un:[0,4], n0:4, lazerUn:3.5,
    lazer:[["Salão de festas",90,"terreo"],["Espaço gourmet",45,"terreo"],["Academia",60,"terreo"],["Brinquedoteca",35,"terreo"],["Piscina",70,"emb",1],["Playground",50,"emb",1],["Pet place",40,"emb",1]],
    obrig:["Salão de festas","Espaço gourmet","Academia","Piscina"] },
  alto:{ nome:"Alto padrão", curto:"Alto", sub:"3 e 4 suítes", nomes:["Studio","1 suíte","2 suítes","3 suítes","4 suítes"],
    areas:[[35,42,55],[50,62,75],[80,95,110],[115,135,160],[150,175,210]], tips:[3,4], w:[0,0,0,0.6,0.4], sac:[6,8,12,16,22],
    vagasUn:2, cub:"R16-A", fator:1.45, eqGar:0.8, preco:[15000,18000,22000], cob:"sim", elevCarros:true, un:[0,4], n0:2, lazerUn:6,
    lazer:DIR_LZ_ALTO, obrig:["Salão de festas","Espaço gourmet","Academia","Piscina","Brinquedoteca"] },
  luxo:{ nome:"Luxo", curto:"Luxo", sub:"1 a 2 por andar", nomes:["Studio","1 suíte","2 suítes","3 suítes","4 suítes"],
    areas:[[45,55,70],[65,80,95],[100,120,140],[160,200,250],[220,280,380]], tips:[3,4], w:[0,0,0,0.4,0.6], sac:[8,12,16,25,35],
    vagasUn:3, cub:"R16-A", fator:1.8, eqGar:0.8, preco:[22000,27000,35000], cob:"sim", elevCarros:true, un:[0,2], n0:2, lazerUn:10,
    lazer:[...DIR_LZ_ALTO, ["Sauna",20,"terreo"],["Cinema",35,"terreo"],["Rooftop gourmet",60,"cob"]], obrig:["Salão de festas","Espaço gourmet","Academia","Piscina","Brinquedoteca","Sauna"] }
};
const DIR_ORDEM = ["economico","medio","medioAlto","alto","luxo"];

extendDEF("diretrizes", { modo:"livre", padrao:"medio", faixa:"f3", tips:[2,3], areas:[[0,0],[0,0],[0,0],[0,0],[0,0]], minPct:[0,0,0,0,0],
  subMax:-1, gacMax:-1, garTerreo:"livre", vagasFrente:"livre", cob:"livre", cobQtd:0, lojas:"livre", vagasUn:1, elevCarros:true,
  torres:"livre", torresN:1, pavMin:0, pavMax:0, unMin:0, unMax:0, lazerUn:2, lazerObrig:["Salão de festas","Playground"], margemMin:0, tetoUn:0 });

const dirN = v => { const x=+v; return isFinite(x)? x : 0 };
const dirLim = v => v==null || v==="" || !isFinite(+v) || +v<0 ? -1 : Math.floor(+v);
const dirGet = (o,p)=>p.split(".").reduce((a,k)=>a==null? a : a[k], o);
const dirSet = (o,p,v)=>{ const ks=p.split("."), l=ks.pop(); const t=ks.reduce((a,k)=>a[k]==null? (a[k]={}) : a[k], o); t[l]=v };
const dirPl = (n, s, p)=>`${n} ${n===1? s : (p||s+"s")}`;

function dirAtiva(st){ return !!(st && st.diretrizes && st.diretrizes.modo==="diretrizes") }
function dirEfetivas(st){
  if(!dirAtiva(st)) return null;
  const d=st.diretrizes, k=DIR_PADROES[d.padrao]? d.padrao : "medio", P=DIR_PADROES[k];
  const tips=[...new Set((Array.isArray(d.tips)? d.tips : P.tips).map(Number).filter(q=>Number.isInteger(q) && q>=0 && q<=4))].sort((a,b)=>a-b);
  const am=+(st.regras && st.regras.aptoMin)||0;   // a menor unidade que a lei aceita vale por cima do padrão
  const area=q=>{ const a=P.areas[q], o=(Array.isArray(d.areas) && d.areas[q]) || [], mn=dirN(o[0])>0? dirN(o[0]) : a[0], mx=dirN(o[1])>0? dirN(o[1]) : a[2];
    const lo=Math.max(am, Math.min(mn,mx)), hi=Math.max(lo, mn, mx); return [lo, Math.min(hi, Math.max(lo, a[1])), hi] };
  const fx=DIR_FAIXAS[d.faixa]||null, teto = dirN(d.tetoUn)>0? dirN(d.tetoUn) : (k==="economico" && fx? fx.teto : 0);
  const un=v=>Math.max(0, Math.floor(dirN(v))), opt=v=>["sim","nao"].includes(v)? v : "livre";
  return { k, P, nome:P.nome, tips, area, minPct:[0,1,2,3,4].map(q=>Math.max(0, Math.min(1, dirN((d.minPct||[])[q])))),
    subMax:dirLim(d.subMax), gacMax:dirLim(d.gacMax), garTerreo:opt(d.garTerreo), vagasFrente:opt(d.vagasFrente), cob:opt(d.cob), lojas:opt(d.lojas),
    cobQtd:un(d.cobQtd), vagasUn:Math.max(0, dirN(d.vagasUn)), elevCarros:d.elevCarros!==false,
    torres:["fixo","max"].includes(d.torres)? d.torres : "livre", torresN:Math.max(1, un(d.torresN)||1),
    pavMin:un(d.pavMin), pavMax:un(d.pavMax), unMin:un(d.unMin), unMax:un(d.unMax),
    lazerUn:Math.max(0, dirN(d.lazerUn)), lazerObrig:(Array.isArray(d.lazerObrig)? d.lazerObrig : []).filter(Boolean).map(String),
    margemMin:Math.max(0, dirN(d.margemMin)), teto, faixa: k==="economico" && fx && !(dirN(d.tetoUn)>0)? fx.nome : "" };
}

/* nº de dormitórios de uma tipologia do mix */
function dirTipDe(u){
  if(!u) return null; if(u.tip!=null && isFinite(+u.tip)) return Math.max(0, Math.min(4, Math.round(+u.tip)));
  const n=String(u.nome||"").toLowerCase();
  if(/st[uú]dio|kitnet|kitinete|loft/.test(n)) return 0;
  let x=n.match(/(\d)\s*(dorm|quarto|qto|dts?\b|q\b)/); if(x) return Math.min(4, +x[1]);
  x=n.match(/(\d)\s*su[ií]te/); if(x) return Math.min(4, +x[1]);
  const a=+u.area||0; return a<35? 0 : a<50? 1 : a<78? 2 : a<120? 3 : 4;
}
const dirQRot = q => DIR_Q[q] || "";
/* "2 e 3 dorm." · "studio e 1 dorm." */
function dirTipsTxt(D){ const l=(D && D.tips)||[]; if(!l.length) return "nenhuma tipologia";
  const s=l.filter(q=>q===0).map(()=>"studio"), n=l.filter(q=>q>0);
  const j=a=>a.length<2? (a[0]||"") : a.slice(0,-1).join(", ")+" e "+a[a.length-1];
  return n.length? j([...s, ...n.map(String)])+" dorm." : "studio" }
function dirGarTxt(D){ if(!D) return ""; const r=[];
  if(D.subMax===0) r.push("sem subsolo"); else if(D.subMax>0) r.push(`até ${dirPl(D.subMax,"subsolo")}`);
  if(D.gacMax===0) r.push("sem garagem elevada"); else if(D.gacMax>0) r.push(`até ${dirPl(D.gacMax,"elevada")}`);
  return r.join(" · ") }
function dirResumo(st){ const D=dirEfetivas(st); if(!D) return "Livre";
  return [D.P.curto||D.nome, dirTipsTxt(D), dirGarTxt(D)].filter(Boolean).join(" · ") }
function presetNome(pk, st){
  if(MIX_PRESETS[pk]) return MIX_PRESETS[pk].nome;
  if(pk==="dir"){ const D=st && dirEfetivas(st); return D? `${D.P.curto||D.nome} · ${dirTipsTxt(D)}` : "Diretrizes" }
  if(/^dir:\d$/.test(String(pk))){ const q=+String(pk).slice(4), D=st && dirEfetivas(st); return D? `${D.P.curto||D.nome} · só ${D.P.nomes[q]}` : `Só ${dirQRot(q)}` }
  return String(pk||"");
}

/* preço de uma tipologia: o da mesma tipologia no mix; senão o preço médio × fator da tipologia */
function dirPrecoDe(st, q){ const mx=(st.produto&&st.produto.mix)||[], u=mx.find(x=>dirTipDe(x)===q && +x.preco>0);
  return u? +u.preco : Math.round(basePrice(st)*DIR_PF[q]/50)*50 }
/* área que a tipologia pode ter: o alvo do padrão, limitado pelo teto por unidade (MCMV); null se nem a área mínima cabe no teto */
function dirAreaViavel(st, D, q){ const a=D.area(q); let x=a[1]; if(D.teto>0){ const p=dirPrecoDe(st,q); if(p>0) x=Math.min(x, Math.floor(D.teto/p)) } return x>=a[0]-1e-9? x : null }

/* mix das diretrizes: "dir" = todas as tipologias permitidas (pesos do padrão e mínimos), "dir:<q>" = só uma */
function dirPresetMix(st, key, N){
  const D=dirEfetivas(st); if(!D) return [];
  const qs=(key==="dir"? D.tips : [+String(key).slice(4)]).filter(q=>D.tips.includes(q) && dirAreaViavel(st, D, q)!=null);
  if(!qs.length) return [];
  const ws=qs.map(q=>Math.max(D.minPct[q], D.P.w[q]||0) || 1/qs.length), sw=ws.reduce((a,b)=>a+b,0)||1;
  const mix=distrib(qs.map((q,i)=>({q, w:ws[i]/sw})), N, t=>({nome:D.P.nomes[t.q], area:dirAreaViavel(st, D, t.q), preco:dirPrecoDe(st, t.q), sac:D.P.sac[t.q], tip:t.q}));
  if(qs.some(q=>D.minPct[q]>0 && !mix.some(u=>u.tip===q))) return [];
  return mix;
}
/* o mix atende às diretrizes? (tipologias, áreas, teto por unidade, mínimos) */
function dirMixOk(st, mix, D){
  D=D||dirEfetivas(st); const falhas=[]; if(!D) return {ok:true, falhas};
  const L=(mix||[]).filter(u=>+u.qtd>0), N=L.reduce((s,u)=>s+(+u.qtd||0),0);
  L.forEach(u=>{ const q=dirTipDe(u), a=D.area(q), nome=u.nome||dirQRot(q);
    if(!D.tips.includes(q)){ falhas.push({k:"tipologia", grave:true, msg:`${nome} fora das tipologias (${dirTipsTxt(D)})`}); return }
    if(+u.area<a[0]-0.5 || +u.area>a[2]+0.5) falhas.push({k:"area", grave:true, msg:`${nome} com ${nf(+u.area,0)} m² (diretriz ${nf(a[0],0)} a ${nf(a[2],0)} m²)`});
    if(D.teto>0 && (+u.area)*(+u.preco)>D.teto*1.001) falhas.push({k:"teto", grave:true, msg:`${nome} a ${mi((+u.area)*(+u.preco))} passa do teto de ${mi(D.teto)}`}) });
  D.tips.forEach(q=>{ if(!(D.minPct[q]>0)) return; const c=L.filter(u=>dirTipDe(u)===q).reduce((s,u)=>s+(+u.qtd||0),0);
    if(c<1 || c/Math.max(1,N)<D.minPct[q]-1/Math.max(1,N)+1e-9) falhas.push({k:"proporcao", grave:true, msg:`${dirQRot(q)} abaixo de ${pct(D.minPct[q],0)} das unidades`}) });
  return {ok:!falhas.length, falhas};
}
const dirGarOk = (D, sub, gac) => !D || ((D.subMax<0 || sub<=D.subMax) && (D.gacMax<0 || gac<=D.gacMax));
function dirNs(D, l){ if(!D) return l;
  const ok=n=>(!D.unMin || n>=D.unMin) && (!D.unMax || n<=D.unMax); let r=l.filter(ok);
  if(!r.length){ const lo=Math.max(1, D.unMin||1), hi=Math.max(lo, D.unMax||lo+4); r=[]; for(let n=lo; n<=hi && r.length<6; n++) r.push(n) }
  return r }
/* pavimentos candidatos dentro de [pavMin, pavMax] (e os próprios limites, quando cabem no gabarito) */
function dirPavs(D, l, pMin, pmax){ if(!D) return l;
  const ok=p=>(!D.pavMin || p>=D.pavMin) && (!D.pavMax || p<=D.pavMax);
  return [...new Set([...l.filter(ok), ...[D.pavMax, D.pavMin].filter(p=>p>0 && p>=pMin && p<=pmax && ok(p))])] }
function dirTorres(D, l, forma){ if(!D || forma || D.torres==="livre") return l;
  if(D.torres==="fixo") return [D.torresN];
  const r=l.filter(n=>n<=D.torresN); return r.length? r : [Math.min(D.torresN, l[0]||1)] }
/* presets que o otimizador testa com diretrizes: todas as permitidas, cada uma sozinha (sem mínimos) e o mix atual se atende */
function dirPresets(st, opts, D){
  const atual=dirMixOk(st, st.produto.mix, D).ok, qs=D.tips.filter(q=>dirAreaViavel(st, D, q)!=null);
  if(!qs.length) return [];
  if(!(opts && opts.tipologias)) return [atual? "atual" : "dir"];
  return [...new Set(["dir", ...(qs.length>1 && !D.minPct.some(x=>x>0)? qs.map(q=>"dir:"+q) : []), ...(atual? ["atual"] : [])])];
}
function dirRampaOk(st, tipo){ const D=dirEfetivas(st); return !D || D.elevCarros || tipo!=="elevador" }
function dirLazerObrig(st, nome){ const D=dirEfetivas(st); return !!D && D.lazerObrig.includes(String(nome||"")) }
/* estado dentro das diretrizes (vizinhos do reparo da garagem e do "o que fecha a conta"): garagens, andares, unidades, torres e mix */
function dirEstadoOk(st){
  const D=dirEfetivas(st); if(!D) return true;
  const P=st.produto, N=(P.mix||[]).reduce((s,u)=>s+(+u.qtd||0),0), forma=typeof otimFormaAtiva==="function" && otimFormaAtiva(st);
  if(!dirGarOk(D, +P.subsolos||0, +P.garAcima||0)) return false;
  if((P.torres||[]).some(t=>(D.pavMax && t.pav>D.pavMax) || (D.pavMin && t.pav<D.pavMin))) return false;
  if((D.unMin && N<D.unMin) || (D.unMax && N>D.unMax)) return false;
  if(!forma && ((D.torres==="fixo" && P.torres.length!==D.torresN) || (D.torres==="max" && P.torres.length>D.torresN))) return false;
  return dirMixOk(st, P.mix, D).ok;
}

/* o que é fixo no produto (o otimizador não varia): aplicado no estado de partida do otimizador e por aplicarOtim */
function dirAplicaFixos(st){
  const D=dirEfetivas(st), out=[]; if(!D) return out;
  const P=st.produto, set=(p,v,rot)=>{ if(JSON.stringify(dirGet(st,p))!==JSON.stringify(v)){ dirSet(st,p,v); out.push(rot) } };
  if(D.garTerreo!=="livre") set("produto.garTerOn", D.garTerreo==="sim", D.garTerreo==="sim"? "garagem no térreo" : "sem garagem no térreo");
  if(D.vagasFrente!=="livre") set("produto.vagasFrente", D.vagasFrente==="sim", D.vagasFrente==="sim"? "vagas na frente" : "sem vagas na frente");
  if(D.cob!=="livre") set("produto.cob.on", D.cob==="sim", D.cob==="sim"? "com coberturas" : "sem coberturas");
  if(D.cob==="sim" && D.cobQtd>0) set("produto.cob.qtd", D.cobQtd, `${dirPl(D.cobQtd,"cobertura")} por torre`);
  if(D.lojas==="nao") set("produto.lojaTerreo", 0, "sem lojas");
  else if(D.lojas==="sim" && !(+P.lojaTerreo>0)) set("produto.lojaTerreo", 0.2, "com lojas na frente");
  if(!D.elevCarros && st.estudo && st.estudo.rampaTipo==="elevador"){ st.estudo.rampaTipo="reta"; st.estudo.rampa=null; out.push("rampas no lugar do elevador de carros") }
  const it=(P.lazer && P.lazer.itens) || []; if(P.lazer && !Array.isArray(P.lazer.itens)) P.lazer.itens=it;
  D.lazerObrig.forEach(nome=>{ if(it.some(x=>x.nome===nome)) return;
    const pd=DIR_LZ(D.P.lazer).find(x=>x.nome===nome) || (typeof LZ_PRESETS!=="undefined" && LZ_PRESETS.find(x=>x.nome===nome)) || {nome, area:30, local:"terreo"};
    it.push(clone(pd)); out.push(nome) });
  return out;
}
/* só na conta do otimizador e do "o que fecha a conta": vagas por unidade acima da lei e margem mínima */
function dirInterno(st, D){ D=D||dirEfetivas(st); if(!D) return st;
  if(D.vagasUn > (+st.regras.vagasApto||0)) st.regras.vagasApto=D.vagasUn;
  if(D.margemMin>0) st.fin.margemAlvo=D.margemMin;
  return st }
/* o que nem chega a ser testado: nenhuma tipologia, teto por unidade que nenhuma comporta, mínimo acima do máximo */
function dirPre(st, D){
  const r=(diretriz, motivo)=>({k:"diretriz", diretriz, motivo});
  if(!D.tips.length) return r("tipologias", "nenhuma tipologia está permitida — marque ao menos uma nas diretrizes");
  if(D.pavMin && D.pavMax && D.pavMin>D.pavMax) return r("pavimentos", `o mínimo de ${D.pavMin} pavimentos passa do máximo de ${D.pavMax}`);
  if(D.unMin && D.unMax && D.unMin>D.unMax) return r("unidades", `o mínimo de ${D.unMin} unidades por andar passa do máximo de ${D.unMax}`);
  if(!D.tips.some(q=>dirAreaViavel(st, D, q)!=null)){
    const q=D.tips.reduce((b,x)=>D.area(x)[0]*dirPrecoDe(st,x)<D.area(b)[0]*dirPrecoDe(st,b)? x : b, D.tips[0]), a=D.area(q)[0], p=dirPrecoDe(st,q);
    return r("teto", `o teto de ${mi(D.teto)} por unidade${D.faixa? ` (${D.faixa} do MCMV)` : ""} não comporta ${D.P.nomes[q]} de ${nf(a,0)} m² a ${brl(p)}/m² (${mi(a*p)}) — reduza o preço para até ${brl(Math.floor(D.teto/a/50)*50)}/m² ou a área mínima para ${nf(Math.floor(D.teto/p),0)} m²`) }
  return null;
}
function dirPrepara(st){
  const D=dirEfetivas(st); if(!D) return null;
  const lei=+st.regras.vagasApto||0; dirAplicaFixos(st); dirInterno(st, D);
  return {D, lei, pre:dirPre(st, D), quase:null, quaseConf:null, pmaxG:0, resumo:dirResumo(st)};
}
/* com a garagem limitada pelas diretrizes: quantos pavimentos as vagas estimadas comportam (o otimizador testa essa altura também) */
function dirPavVagas(m, vg, pav, vA){ const un=(m.unitsRes ?? m.units ?? 0), lojas=Math.max(0, m.vagasReq-Math.ceil(un*vA)), porPav=un/Math.max(1,pav)*vA;
  return porPav>0? Math.floor((vg-lojas)/porPav) : 0 }
/* combinação que chegou mais perto das vagas (para dizer quanto falta): a estimada e a conferida com o layout */
function dirQuase(DIR, q, conf){ if(!DIR) return; const k=conf? "quaseConf" : "quase", b=DIR[k], d=x=>x.req-x.vg;
  if(!b || d(q)<d(b) || (d(q)===d(b) && q.units>b.units)) DIR[k]=q }

/* a opção (ou o estudo) atende às diretrizes? Lista o que não atende, em linguagem simples */
function dirConfere(st, m, D){
  D=D||dirEfetivas(st); if(!D) return null;
  const P=st.produto, F=[], add=(k, msg, grave=true)=>F.push({k, msg, grave});
  dirMixOk(st, P.mix, D).falhas.forEach(x=>F.push(x));
  const sub=+P.subsolos||0, gac=+P.garAcima||0, N=(P.mix||[]).reduce((s,u)=>s+(+u.qtd||0),0), pavs=(P.torres||[]).map(t=>+t.pav||0);
  if(D.subMax>=0 && sub>D.subMax) add("subsolo", D.subMax? `${dirPl(sub,"subsolo")} (diretriz: até ${D.subMax})` : "subsolo não permitido");
  if(D.gacMax>=0 && gac>D.gacMax) add("elevada", D.gacMax? `${dirPl(gac,"garagem elevada","garagens elevadas")} (diretriz: até ${D.gacMax})` : "garagem elevada não permitida");
  if(D.pavMax && pavs.some(p=>p>D.pavMax)) add("pavimentos", `${Math.max(...pavs)} pavimentos (diretriz: até ${D.pavMax})`);
  if(D.pavMin && pavs.some(p=>p<D.pavMin)) add("pavimentos", `${Math.min(...pavs)} pavimentos (diretriz: no mínimo ${D.pavMin})`);
  if((D.unMin && N<D.unMin) || (D.unMax && N>D.unMax)) add("unidades", `${dirPl(N,"unidade")} por andar (diretriz: ${D.unMin&&D.unMax? `${D.unMin} a ${D.unMax}` : D.unMin? `no mínimo ${D.unMin}` : `até ${D.unMax}`})`);
  const forma=typeof otimFormaAtiva==="function" && otimFormaAtiva(st), nT=(P.torres||[]).length;
  if(!forma && ((D.torres==="fixo" && nT!==D.torresN) || (D.torres==="max" && nT>D.torresN))) add("torres", `${dirPl(nT,"torre")} (diretriz: ${D.torres==="fixo"? "" : "até "}${D.torresN})`);
  if(D.garTerreo!=="livre" && !!P.garTerOn!==(D.garTerreo==="sim")) add("terreo", D.garTerreo==="sim"? "sem garagem no térreo (diretriz: com)" : "garagem no térreo (diretriz: sem)");
  if(D.vagasFrente!=="livre" && !!P.vagasFrente!==(D.vagasFrente==="sim")) add("frente", D.vagasFrente==="sim"? "sem vagas na frente (diretriz: com)" : "vagas na frente (diretriz: sem)", false);
  if(D.cob!=="livre" && !!(P.cob&&P.cob.on)!==(D.cob==="sim")) add("cob", D.cob==="sim"? "sem coberturas (diretriz: com)" : "coberturas (diretriz: sem)");
  if(D.lojas==="nao" && +P.lojaTerreo>0) add("lojas", "lojas no térreo (diretriz: sem)");
  if(D.lojas==="sim" && !(+P.lojaTerreo>0)) add("lojas", "sem lojas no térreo (diretriz: com)");
  if(!D.elevCarros && st.estudo && st.estudo.rampaTipo==="elevador") add("elevador", "elevador de carros não permitido");
  if(m && D.vagasUn>0){ const req=Math.ceil((m.unitsRes ?? m.units ?? 0)*D.vagasUn + (m.lojaPriv>0? m.lojaPriv/(+st.regras.m2LojaVaga||50) : 0));
    if(m.vagas<req) add("vagas", `${m.vagas} vagas para ${req} (diretriz: ${nf(D.vagasUn, D.vagasUn%1? 1 : 0)} por unidade)`) }
  const it=(P.lazer&&P.lazer.itens)||[], miss=new Set(((m&&m.lzLay&&m.lzLay.miss)||[]).filter(x=>!x.apoio).map(x=>x.nome)), mIx=new Set((m&&m.lzLay&&m.lzLay.missIx)||[]);
  const falta=D.lazerObrig.filter(n=>!it.some(x=>x.nome===n)), naoCoube=D.lazerObrig.filter(n=>it.some((x,i)=>x.nome===n && (miss.has(n) || mIx.has(i))));
  if(falta.length) add("lazer", `sem ${cicloListaDir(falta)} (obrigatório)`);
  if(naoCoube.length) add("lazer", `${cicloListaDir(naoCoube)} não coube${naoCoube.length>1? "ram" : ""} (obrigatório)`);
  if(m && D.lazerUn>0){ const lz=m.lz||{}, a=(+lz.c||0)+(+lz.d||0), un=Math.max(1, m.units||0);
    if(a/un < 0.7*D.lazerUn) add("lazerArea", `lazer de ${nf(a/un,1)} m² por unidade (diretriz ≈ ${nf(D.lazerUn,1)})`, false) }
  const graves=F.filter(x=>x.grave);
  return {ok:!graves.length, falhas:F, n:graves.length, padrao:D.P.curto||D.nome};
}
const cicloListaDir = l=>{ const u=[...new Set(l)]; return u.length<2? (u[0]||"") : u.slice(0,-1).join(", ")+" e "+u[u.length-1] };

/* nenhuma combinação: qual diretriz impede e quanto falta. null = o motivo de sempre (sem diretriz envolvida) */
function dirSemOpcao(DIR, base, cont, cal, mNow){
  if(!DIR) return null; const D=DIR.D;
  if(DIR.pre) return DIR.pre;
  const tips=dirTipsTxt(D), cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
  if(!cont.cabe){
    if(D.pavMin && DIR.pmaxG>0 && DIR.pmaxG<D.pavMin) return {k:"lote", diretriz:"pavimentos", motivo:`o gabarito comporta até ${DIR.pmaxG} pavimentos e a diretriz pede no mínimo ${D.pavMin} — reduza o mínimo de pavimentos`};
    if(D.unMin) return {k:"lote", diretriz:"unidades", motivo:`nenhuma torre comporta ${D.unMin} unidades por andar de ${tips} dentro dos recuos e da ocupação — reduza o mínimo de unidades por andar ou a área das unidades`};
    if(D.torres==="fixo" && D.torresN>1) return {k:"lote", diretriz:"torres", motivo:`${D.torresN} torres de ${tips} não cabem no lote dentro dos recuos — permita menos torres`};
    const ars=D.tips.map(q=>`${D.P.nomes[q]} de ${nf(D.area(q)[0],0)} m² ou mais`);
    return {k:"lote", diretriz:"tipologias", motivo:`nenhuma torre comporta ${cicloListaDir(ars)} dentro dos recuos e da ocupação — permita tipologias menores ou reduza a área mínima`};
  }
  const q=DIR.quaseConf || DIR.quase; if(!q) return null;
  const restrSub=D.subMax>=0, restrGac=D.gacMax>=0, vu=D.vagasUn>DIR.lei+1e-9;
  if(!restrSub && !restrGac && !vu && D.garTerreo!=="nao") return null;
  const vA=+base.regras.vagasApto||1, lojas=Math.max(0, q.req-Math.ceil(q.units*vA)), U=Math.max(0, Math.floor((q.vg-lojas)/vA));
  const sem = restrSub && D.subMax===0 && restrGac && D.gacMax===0? "sem subsolo e sem garagem elevada" : restrSub && D.subMax===0? "sem subsolo"
    : restrSub? `com até ${dirPl(D.subMax,"subsolo")}` : restrGac && D.gacMax===0? "sem garagem elevada" : restrGac? `com até ${dirPl(D.gacMax,"garagem elevada","garagens elevadas")}` : D.garTerreo==="nao"? "sem garagem no térreo" : "";
  const mv=+base.regras.m2Vaga||28, aL=G.area(base.lote.pts)*(1-(+base.regras.permeab||0));
  const yS=Math.max(1, Math.round(cal.s*Math.floor((q.subA || (mNow&&mNow.subA) || aL)/mv))), yG=Math.max(1, Math.round(cal.g*Math.floor((q.embA || (mNow&&mNow.embA) || aL*0.8)/mv)));
  const falta=Math.max(1, q.req-q.vg), ops=[];
  if(restrSub && D.subMax<5){ const n=D.subMax+Math.max(1, Math.ceil(falta/yS)); ops.push(`permitir ${dirPl(Math.min(5,n),"subsolo")}`) }
  else if(restrGac && D.gacMax<3){ const n=D.gacMax+Math.max(1, Math.ceil(falta/yG)); ops.push(`permitir ${dirPl(Math.min(3,n),"garagem elevada","garagens elevadas")}`) }
  if(D.garTerreo==="nao") ops.push("permitir garagem no térreo");
  if(vu) ops.push(`reduzir para ${nf(Math.max(DIR.lei,1), DIR.lei%1? 1 : 0)} vaga por unidade`);
  if(lojas>0.25*q.req && D.lojas!=="sim") ops.push(`tirar as lojas (pedem ${dirPl(lojas,"vaga")})`);
  if(U>=Math.max(4, D.unMin||0)) ops.push(`reduzir para ${dirPl(U,"unidade")}`);
  const vuTxt = vu? ` (${nf(D.vagasUn, D.vagasUn%1? 1 : 0)} por unidade, pela diretriz)` : "";
  return {k:"vagas", diretriz: restrSub||restrGac? "garagem" : "vagas", motivo:`${sem? sem+", a" : "a"} garagem comporta ${q.vg} das ${q.req} vagas exigidas${vuTxt} — ${ops.join(" ou ")}`,
    vagas:q.vg, req:q.req, unidades:U, titulo:cap(sem||"as diretrizes")};
}
/* preço que leva à meta acima do teto por unidade não é saída: tira do "o que fecha a conta" e diz o preço máximo */
function dirFechaAjusta(DIR, fx, mix, base){
  if(!DIR || !fx || !(DIR.D.teto>0)) return fx;
  const L=(mix||[]).filter(u=>+u.qtd>0 && +u.area>0 && +u.preco>0); if(!L.length) return fx;
  const dpMax=Math.min(...L.map(u=>DIR.D.teto/(u.area*u.preco)))-1, lim=basePrice({produto:{mix:L}})*(1+dpMax);
  fx.precoTeto=lim;
  if(fx.precoMeta && fx.precoMeta>lim+1){ fx.precoMeta=null; fx.metaAcimaTeto=true }
  if(fx.precoZero && fx.precoZero>lim+1){ fx.precoZero=null; fx.zeroAcimaTeto=true }
  return fx;
}

/* escolher um padrão: diretrizes do padrão + predefinições do produto (mix, preços, lazer, custo, coberturas). Garagem (subsolo,
   elevada, térreo) e forma ficam como o usuário definiu: dependem do lugar, não do padrão. Devolve o que mudou, em linhas curtas.
   o = {N (unidades por andar), preco (R$/m² médio; senão a referência do padrão)} */
function dirAplicaPadrao(st, k, o={}){
  const P=DIR_PADROES[k]; if(!P) return [];
  const d=st.diretrizes || (st.diretrizes=clone(DEF.diretrizes)), out=[];
  Object.assign(d, { padrao:k, tips:P.tips.slice(), areas:[[0,0],[0,0],[0,0],[0,0],[0,0]], minPct:[0,0,0,0,0], vagasUn:P.vagasUn, elevCarros:P.elevCarros,
    cob:P.cob, lazerObrig:P.obrig.slice(), lazerUn:P.lazerUn, unMin:P.un[0], unMax:P.un[1], tetoUn:0 });
  if(k==="economico" && !DIR_FAIXAS[d.faixa]) d.faixa="f3";
  const Pr=st.produto, cur=(Pr.mix||[]).reduce((s,u)=>s+(+u.qtd||0),0);
  let N=Math.round(+o.N||0) || cur || P.n0; if(P.un[0]) N=Math.max(N, P.un[0]); if(P.un[1]) N=Math.min(N, P.un[1]);
  const pm=+o.preco>0? +o.preco : P.preco[1], D=dirEfetivas({...st, diretrizes:{...d, modo:"diretrizes"}});
  const sw=P.tips.reduce((s,q)=>s+(P.w[q]||0),0)||1;
  const area=q=>{ const r=D.area(q); let a=r[1]; const pr=Math.round(pm*DIR_PF[q]/50)*50; if(D.teto>0) a=Math.max(r[0], Math.min(a, Math.floor(D.teto/pr))); return a };
  Pr.mix=distrib(P.tips.map(q=>({q, w:(P.w[q]||0)/sw})), N, t=>({nome:P.nomes[t.q], area:area(t.q), preco:Math.round(pm*DIR_PF[t.q]/50)*50, sac:P.sac[t.q], tip:t.q}));
  out.push(`Unidades: ${Pr.mix.map(u=>`${u.qtd} × ${u.nome} de ${nf(u.area,0)} m²`).join(" e ")} por andar`);
  out.push(`Preço médio ${brl(Math.round(basePrice(st)/50)*50)}/m² (faixa ${nf(P.preco[0]/1000,0)} a ${nf(P.preco[2]/1000,0)} mil · conferir)`);
  if(D.teto>0) out.push(`Teto de ${mi(D.teto)} por unidade${D.faixa? ` (${D.faixa})` : ""}`);
  Pr.lazer=Pr.lazer||{hall:0, itens:[]}; Pr.lazer.itens=DIR_LZ(P.lazer);
  out.push(`Lazer: ${dirPl(Pr.lazer.itens.length,"ambiente")} · ${m2(Pr.lazer.itens.reduce((s,x)=>s+x.area,0))}`);
  if(P.cob==="sim"){ const big=Math.max(...Pr.mix.map(u=>u.area)); Pr.cob={...Pr.cob, on:true, qtd:Math.max(1, +(Pr.cob&&Pr.cob.qtd)||2), area:Math.round(big*1.8/5)*5, preco:Math.round(pm*1.12/50)*50}; out.push(`Coberturas duplex de ${m2(Pr.cob.area)}`) }
  else if(P.cob==="nao" && Pr.cob && Pr.cob.on){ Pr.cob={...Pr.cob, on:false}; out.push("Sem coberturas") }
  if(st.orc){ const uf=st.orc.uf||"SC", v=typeof cubValor==="function"? cubValor(st, uf, P.cub) : null;
    st.orc.padrao=P.cub; if(v>0) st.fin.cub=Math.round(v*100)/100; st.fin.fator=P.fator; st.fin.eqGar=P.eqGar;
    out.push(`Custo: CUB ${P.cub} ${uf} ${brl(st.fin.cub)}/m² × ${nf(P.fator,2)}${P.eqGar!==0.8? ` · garagem a ${pct(P.eqGar,0)} do CUB` : ""}`) }
  else { st.fin.fator=P.fator; st.fin.eqGar=P.eqGar }
  out.push(`Vagas: ${P.vagasUn? `${nf(P.vagasUn, P.vagasUn%1? 1 : 0)} por unidade` : "as da lei"}`);
  if(!P.elevCarros && st.estudo && st.estudo.rampaTipo==="elevador"){ st.estudo.rampaTipo="reta"; st.estudo.rampa=null }
  if(st.guia && st.guia.conf){ st.guia.conf.preco=false; st.guia.conf.custo=false }
  return out;
}
