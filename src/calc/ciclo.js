/* ================= ciclo com o projeto real: "o que fecha a conta" sem trocar de etapa =================
   Cálculo puro (página, Worker e testes; sem DOM). O Luiz: "estou tentando viabilizar um terreno e não está dando, e preciso mudar
   informações de etapas da frente". O Produto sugeria uma combinação com ESTIMATIVAS; a garagem real (rampa, acesso, ângulo), o térreo
   real (hall, lazer que cabe ou não) e as áreas comuns só apareciam no Projeto, e a viabilidade deixava de fechar. Aqui moram as peças
   que fecham essa volta, usadas por:
   - otimizar (src/optim.js, fase "ciclo"): nas finalistas, cicloGarFinalista escolhe tipo de rampa × lado/posição do acesso × ângulo
     das vagas pelo RESULTADO (com o reparo de subsolos e andares que mais vagas permitem); cicloPend marca o que o projeto não resolve;
     cicloLazerEnxuto monta a alternativa explícita "lazer enxuto";
   - cicloEstudo (Viabilidade › Resultado, "O que fecha a conta", e Produto): a partir do estudo ATUAL, uma mudança por vez — garagem,
     lazer enxuto, unidades por andar, andares e garagens — cada uma com o ganho calculado (cálculo rápido + finance) e um `patch`
     que cicloAplica grava de uma vez (um passo de desfazer na interface).

   Garagem (g): {rampaTipo, acessoVei (0–1 ao longo do lado), ladoVei (índice do lado; null = frente principal), angulo ("90"|"60"|"45"|"melhor")}
   cicloGarDe(st) · cicloGarPoe(st, g) (zera estudo.rampa, a rampa movida à mão, quando a garagem muda) · cicloGarIgual · cicloGarOk(m)
   cicloGarNome(g, st) → "Elevador de carros · acesso a 50% da frente · vagas a 60°"
   cicloGarFinalista(M, c0, o) → Promise {melhor:{c, g}, configs:[g…] (a melhor de cada tipo), info:{base:{g, vagas}, tipos:[{g, vagas, ok, lucro, pav, sub, gac}]}}
     M = otimMotor(...) (src/optim.js); c0 = {st, m, f, sc} conferido; o = {tem(), parou(), pausa(), configs?, prog?, meta?}
     Triagem com o cálculo rápido, na ordem do que mais costuma mudar o resultado (o tempo pode acabar no meio): cada tipo de rampa na
     posição atual → as 2 melhores famílias nas pontas e no meio da frente → outros lados com rua → ângulo 60°/45° nas 2 melhores.
     Com `configs` (finalistas seguintes) só confere essas. As que rendem mais vagas que a base passam pelo reparo (M.repara(c, 1):
     −subsolo, −elevada, +andares). Vence o melhor resultado (vagas fechadas › garagem sem pendência › nível › nota), não o de mais
     vagas; empate fica com a garagem do estudo. O elevador de carros entra com o custo dele (garPos → m.custosExtra) e a fila do pico.
   cicloPend(m) → [{k, grave, msg}] · cicloLazerEnxuto(st, m) → {itens, tira:[nomes], naoCoube:[nomes]} | null
   cicloPatch(a, b) → [[caminho, valor]…] (só o que mudou em CICLO_PATHS) · cicloAplica(st, patch)
   cicloEstudo(st, opts, onProg, ctx) → Promise {base:{lucro, margem, vagas, req, vgv}, linhas:[{k, rot, desc, lucro, margem, d:{lucro, margem}, vagas, req, patch}], ms}
     linhas: só as que melhoram o lucro e fecham as vagas, da maior para a menor (até 4); ctx = {m (o da tela, para a calibração e o
     lazer), cancelado()}; opts.tempo (padrão 9 s). */

const CICLO_PATHS = ["produto.torres","produto.subsolos","produto.garAcima","produto.mix","produto.lazer.itens",
  "estudo.rampaTipo","estudo.angulo","estudo.rampa","lote.acessoVei","lote.ladoVei"];
const CICLO_TIPO_ROT = { reta:"rampas retas", alternada:"rampas alternadas (tesoura)", helicoidal:"rampa helicoidal", L:"rampa em L", elevador:"elevador de carros" };
/* lazer de base (o resto é complemento: cinema, sauna, jogos, brinquedoteca, coworking, quadra, pet, rooftop…) */
const CICLO_LZ_BASE = /sal[aã]o de festas|gourmet|academia|bicicl|^piscina$|deck|sol[aá]rio|playground/i;
const cicloLista = l=>{ const u=[...new Set(l)]; return u.length<2? (u[0]||"") : u.slice(0,-1).join(", ")+" e "+u[u.length-1] };

function cicloGarDe(st){ const E=st.estudo||{}, L=st.lote||{};
  return {rampaTipo:E.rampaTipo||"reta", acessoVei:+(L.acessoVei ?? 0.85), ladoVei:L.ladoVei==null? null : +L.ladoVei, angulo:String(E.angulo ?? "90")} }
function cicloGarIgual(a, b){ return !!a && !!b && a.rampaTipo===b.rampaTipo && Math.abs((+a.acessoVei||0)-(+b.acessoVei||0))<0.02 && (a.ladoVei??null)===(b.ladoVei??null) && String(a.angulo)===String(b.angulo) }
function cicloGarPoe(st, g){ if(!g) return st;
  const muda=!cicloGarIgual(cicloGarDe(st), g);
  st.estudo.rampaTipo=g.rampaTipo; st.lote.acessoVei=+g.acessoVei; st.lote.ladoVei=g.ladoVei==null? null : +g.ladoVei; if(g.angulo!=null) st.estudo.angulo=String(g.angulo);
  if(muda) st.estudo.rampa=null;   // a rampa movida à mão era da garagem anterior
  return st }
function cicloGarOk(m){ return !!m && (!m.vert || m.vert.ok!==false) && Object.values(m.gar||{}).every(l=>!l || l.ok!==false) && (!m.elevCarros || m.elevCarros.ok!==false) }
function cicloGarNome(g, st){ if(!g) return "";
  const multi=st && st.lote && (st.lote.front||[]).length>1, pr=st && typeof acPrincipal==="function"? acPrincipal(st) : 0;
  const lado=g.ladoVei==null? pr : g.ladoVei, onde=multi? `acesso pela L${lado+1} a ${pct(g.acessoVei,0)} do lado` : `acesso a ${pct(g.acessoVei,0)} da frente`;
  return `${RAMPA_TIPOS[g.rampaTipo]||g.rampaTipo} · ${onde}${g.angulo && g.angulo!=="melhor" && g.angulo!=="90"? ` · vagas a ${g.angulo}°` : ""}` }
/* tipos de rampa que fazem sentido no estudo (sem subsolo nem elevada não há rampa: só a posição do acesso conta) */
function cicloTipos(st){ const P=st.produto, n=(+P.subsolos||0)+(+P.garAcima||0), t0=st.estudo.rampaTipo||"reta";
  if(!n) return [t0];
  return [...new Set([t0, "reta", ...(P.subsolos>1||P.garAcima>1? ["alternada"] : []), "helicoidal", "L", "elevador"])].filter(t=>typeof dirRampaOk!=="function" || dirRampaOk(st, t)) }   // diretrizes: elevador de carros pode ser proibido

async function cicloGarFinalista(M, c0, o={}){
  const st0=c0.st, g0=cicloGarDe(st0), tem=o.tem||(()=>true), parou=o.parou||(()=>false), pausa=o.pausa||(()=>Promise.resolve());
  const prog=typeof o.prog==="function"? o.prog : ()=>{}, meta=o.meta ?? (+(st0.fin&&st0.fin.margemAlvo)||0.25);
  const base={g:g0, c:c0, vagas:c0.m.vagas, ok:cicloGarOk(c0.m), base:true}, avl=[base];
  const plan = o.configs? o.configs.length+3 : 16; let feitos=0;
  const temT = o.temTriagem || tem;   // a triagem para antes, deixando tempo para o reparo das que rendem mais vagas
  const evalG=async (g, sempre)=>{ if(avl.some(x=>cicloGarIgual(x.g, g)) || !(sempre || temT())) return null; if(parou()) throw new Error("cancelado");
    const s=clone(st0); cicloGarPoe(s, g); let c; try{ c=M.avalia(s) }catch(e){ console.error("[ciclo] garagem", e); return null }
    const x={g:cicloGarDe(s), c, vagas:c.m.vagas, ok:cicloGarOk(c.m)}; avl.push(x); prog(Math.min(0.95, ++feitos/plan)); await pausa(); return x };
  const cmpG=(a,b)=>(b.ok-a.ok) || (b.vagas-a.vagas) || ((b.base?1:0)-(a.base?1:0));
  const porTipo=()=>{ const by=new Map(); avl.forEach(x=>{ const b=by.get(x.g.rampaTipo); if(!b || cmpG(x,b)<0) by.set(x.g.rampaTipo, x) }); return [...by.values()].sort(cmpG) };
  if(o.configs) for(const g of o.configs) await evalG(g);
  else {
    const pos=x=>[0.1,0.5,0.9].map(p=>({...x.g, acessoVei:p})), ang=x=>x.g.angulo==="melhor"? [] : ["90","60","45"].map(a=>({...x.g, angulo:a}));
    for(const t of cicloTipos(st0)) await evalG({...g0, rampaTipo:t}, true);                 // cada tipo na posição atual (sempre: é o essencial)
    for(const g of pos(porTipo()[0])) await evalG(g);                                         // a melhor: pontas e meio da frente
    for(const g of ang(porTipo()[0])) await evalG(g);                                         // e o ângulo das vagas
    if(typeof acLadosRua==="function"){ const pr=acPrincipal(st0), cur=ladoVeiIdx(st0);        // outros lados com rua
      for(const i of acLadosRua(st0).filter(i=>i!==cur)) for(const p of [0.1,0.5,0.9]) await evalG({...porTipo()[0].g, ladoVei:i===pr? null : i, acessoVei:p}) }
    const b2=porTipo()[1]; if(b2){ for(const g of [...pos(b2), ...ang(b2)]) await evalG(g) }   // a segunda família
  }
  // as que rendem mais vagas que a base fecham com o reparo: −subsolo, −elevada, +andares (o que mais vagas permitem)
  const tipos=porTipo(), alts=tipos.filter(x=>!x.base && x.ok && (x.vagas>base.vagas || !base.ok)).slice(0,3);
  // a de mais vagas sempre passa pelo reparo; as outras, se houver tempo
  for(const x of alts){ if(x!==alts[0] && !tem()) break; if(parou()) throw new Error("cancelado"); try{ x.cr=M.repara(x.c, 1) }catch(e){ console.error("[ciclo] reparo", e) } prog(Math.min(0.98, ++feitos/plan)); await pausa() }
  // vence o melhor resultado com as vagas fechadas (empate: a garagem do estudo)
  const nivel=c=>otimNivel({lucro:c.f.lucro, margem:c.f.margemVGV}, meta), eps=c=>1e-6*Math.max(1, Math.abs(c.sc));
  const cmpC=(a,b)=>(M.nivelOk(b.c)-M.nivelOk(a.c)) || (cicloGarOk(b.c.m)-cicloGarOk(a.c.m)) || (nivel(b.c)-nivel(a.c))
    || (Math.abs(b.c.sc-a.c.sc)>eps(a.c)? b.c.sc-a.c.sc : 0) || ((b.base?1:0)-(a.base?1:0)) || (b.c.m.vagas-a.c.m.vagas);
  const cands=[...avl.map(x=>({c:x.c, g:x.g, base:!!x.base})), ...alts.filter(x=>x.cr).map(x=>({c:x.cr, g:x.g}))];
  const melhor=cands.sort(cmpC)[0];
  const info={base:{g:g0, vagas:base.vagas}, tipos:tipos.map(x=>{ const c=x.cr||x.c; return {g:x.g, vagas:x.vagas, ok:x.ok, lucro:c.f.lucro,
    pav:c.st.produto.torres[0].pav, sub:c.st.produto.subsolos, gac:c.st.produto.garAcima, vagasFim:c.m.vagas} })};
  return {melhor, configs:tipos.filter(x=>x.ok).map(x=>x.g).slice(0,4), info};
}

/* o que o projeto (cálculo rápido ou completo) não resolve: lazer que não coube, rampa/elevador com pendência, térreo com faixa de
   veículos no hall ou rota quebrada. grave = pesa na ordem do otimizador */
function cicloPend(m){
  const out=[]; if(!m) return out;
  const lz=(m.lzLay&&m.lzLay.miss)||[], it=lz.filter(x=>!x.apoio), ap=lz.filter(x=>x.apoio);
  if(it.length) out.push({k:"lazer", grave:true, msg:`${cicloLista(it.map(x=>x.nome||"ambiente"))} não coube${new Set(it.map(x=>x.nome)).size>1?"ram":""}`});
  if(ap.length) out.push({k:"apoio", grave:false, msg:`sem lugar no térreo: ${cicloLista(ap.map(x=>x.nome))}`});
  if(m.vert && m.vert.ok===false) out.push({k:"rampa", grave:true, msg:"a rampa não cabe sem pendências"});
  if(m.elevCarros && m.elevCarros.ok===false) out.push({k:"elevador", grave:true, msg:"fila do elevador de carros no pico"});
  const p=((m.comuns&&m.comuns.problemas)||[]).find(p=>p.nivel==="bad" && (p.k==="veiculos" || p.k==="rota"));
  if(p) out.push({k:"terreo", grave:true, msg:String(p.msg||"").replace(/\s*—.*$/,"").replace(/\.$/,"")});
  return out;
}
/* "lazer enxuto": sem o que não coube (não é construído, mas é pago e empurra o hall) e sem os complementos (CICLO_LZ_BASE fica) */
function cicloLazerEnxuto(st, m){
  const it=(st.produto.lazer&&st.produto.lazer.itens)||[]; if(!it.length) return null;
  const L=(m&&m.lzLay)||{}, missIx=new Set(L.missIx||[]), missN=new Set((L.miss||[]).filter(x=>!x.apoio).map(x=>x.nome));
  const tira=[], fica=[], naoCoube=[];
  const obrig=x=>typeof dirLazerObrig==="function" && dirLazerObrig(st, x.nome);   // diretrizes: o lazer obrigatório fica
  it.forEach((x,i)=>{ if(obrig(x)) return fica.push(x); const falta=missIx.has(i) || missN.has(x.nome), extra=!CICLO_LZ_BASE.test(x.nome||""); if(falta) naoCoube.push(x.nome||"ambiente"); (falta||extra? tira : fica).push(x) });
  if(!tira.length) return null;
  return {itens:clone(fica), tira:tira.map(x=>x.nome||"ambiente"), naoCoube};
}
/* caminhos que mudaram entre dois estados (só os de CICLO_PATHS) */
const cicloGet=(o,p)=>p.split(".").reduce((a,k)=>a==null? a : a[k], o);
function cicloPatch(a, b){ return CICLO_PATHS.filter(p=>JSON.stringify(cicloGet(a,p))!==JSON.stringify(cicloGet(b,p))).map(p=>[p, clone(cicloGet(b,p)===undefined? null : cicloGet(b,p))]) }
function cicloAplica(st, patch){ (patch||[]).forEach(([p,v])=>{ const ks=p.split("."), last=ks.pop(); let o=st; for(const k of ks){ if(o[k]==null) o[k]={}; o=o[k] } o[last]=clone(v) }); return st }
/* o que mudou, em linguagem simples: "elevador de carros · +9 vagas · 3 → 2 subsolos · 14 → 16 andares" */
function cicloMudouTxt(a, b, o={}){
  const A=a.st, B=b.st, ga=cicloGarDe(A), gb=cicloGarDe(B), r=[];
  if(ga.rampaTipo!==gb.rampaTipo && !o.semTipo) r.push(CICLO_TIPO_ROT[gb.rampaTipo]||gb.rampaTipo);
  if(Math.abs(ga.acessoVei-gb.acessoVei)>=0.02 || (ga.ladoVei??null)!==(gb.ladoVei??null)) r.push((B.lote.front||[]).length>1 && (ga.ladoVei??null)!==(gb.ladoVei??null)? `acesso pela L${(gb.ladoVei ?? acPrincipal(B))+1}` : `acesso a ${pct(gb.acessoVei,0)} da frente`);
  if(String(ga.angulo)!==String(gb.angulo)) r.push(`vagas a ${gb.angulo}°`);
  const dv=b.m.vagas-a.m.vagas; if(dv) r.push(`${dv>0?"+":"−"}${Math.abs(dv)} vaga${Math.abs(dv)>1?"s":""}`);
  const pa=A.produto, pb=B.produto, pavA=(pa.torres[0]||{}).pav, pavB=(pb.torres[0]||{}).pav;
  if(pa.subsolos!==pb.subsolos) r.push(`${pa.subsolos} → ${pb.subsolos} subsolo${pb.subsolos!==1?"s":""}`);
  if(pa.garAcima!==pb.garAcima) r.push(`${pa.garAcima} → ${pb.garAcima} elevada${pb.garAcima!==1?"s":""}`);
  if(pavA!==pavB) r.push(`${pavA} → ${pavB} andares`);
  const du=b.m.units-a.m.units; if(du) r.push(`${du>0?"+":"−"}${Math.abs(du)} unidade${Math.abs(du)>1?"s":""}`);
  return r.join(" · ");
}

async function cicloEstudo(st0, opts={}, onProg, ctx={}){
  const base=clone(st0), prog=typeof onProg==="function"? onProg : ()=>{}, parou=()=>!!(ctx.cancelado && ctx.cancelado());
  if(typeof dirInterno==="function") dirInterno(base);   // diretrizes do produto: vagas por unidade e margem mínima na conta
  const t0=performance.now(), bud=+opts.tempo||9000, pausa=()=>new Promise(r=>setTimeout(r,0));
  const chk=()=>{ if(parou()) throw new Error("cancelado") };
  const mTela=ctx.m||{};
  let cal=otimVagasCal(base, mTela);
  if(!cal){ try{ const sc=clone(base); sc.produto.subsolos=Math.max(1, +sc.produto.subsolos||0); cal=otimVagasCal(sc, compute(sc, {quick:true})) }catch(e){} }
  if(!cal) cal={s:0.6, g:0.5, t:0.6, vf:0};
  const forma=otimFormaAtiva(base), meta=+(base.fin&&base.fin.margemAlvo)||0.25;
  const M=otimMotor(base, {cal, fin:(s,m)=>finance(s,m), score:f=>f.lucro, forma, rTol:Math.max(0.01, +(base.otim&&base.otim.rTol)||0.10), pavMinF:forma? otimPavMinForma(base) : 1});
  const c0=M.avalia(clone(base)); prog(0.06); await pausa(); chk();
  const L=[], add=(k, rot, c, extra={})=>{ if(!c || c===c0) return;
    L.push({k, rot, desc:cicloMudouTxt(c0, c, {semTipo:k==="garagem"}), lucro:c.f.lucro, margem:c.f.margemVGV, d:{lucro:c.f.lucro-c0.f.lucro, margem:c.f.margemVGV-c0.f.margemVGV},
      vagas:c.m.vagas, req:c.m.vagasReq, ok:M.nivelOk(c), patch:cicloPatch(base, c.st), ...extra}) };
  const fase=(a,b)=>p=>prog(a+(b-a)*Math.min(1,p));
  // 1) garagem: tipo de rampa, lado/posição do acesso e ângulo das vagas, com o reparo que mais vagas permitem
  try{ const g=await cicloGarFinalista(M, c0, {tem:()=>performance.now()-t0<bud*0.55, parou, pausa, meta, prog:fase(0.06,0.6)});
    const m=g.melhor; if(m && !cicloGarIgual(m.g, cicloGarDe(base))) add("garagem", `Trocar para ${CICLO_TIPO_ROT[m.g.rampaTipo]||m.g.rampaTipo}`, m.c, {g:m.g}) }
  catch(e){ if(/cancelado/.test(e.message||"")) throw e; console.error("[ciclo] garagem", e) }
  chk();
  // 2) lazer enxuto (com o que não coube no cálculo da tela)
  const lz=cicloLazerEnxuto(base, mTela.lzLay? mTela : c0.m);
  if(lz && performance.now()-t0<bud){ const s=clone(base); s.produto.lazer.itens=clone(lz.itens); let c=M.avalia(s); c=M.repara(c, 1);
    add("lazer", `Lazer enxuto (sem ${cicloLista(lz.tira)})`, c, {tira:lz.tira}); prog(0.7); await pausa(); chk() }
  // 3) andares e garagens do estudo como está
  if(performance.now()-t0<bud){ const c=M.repara(c0, 2); add("estrutura", "Ajustar andares e garagens", c); prog(0.8); await pausa(); chk() }
  // 4) unidades por andar: uma a mais ou a menos de cada tipologia (o andar muda de tamanho; as vagas fecham com o reparo)
  const mix=base.produto.mix||[], cs=[];
  for(let i=0; i<mix.length && performance.now()-t0<bud; i++) for(const d of [1,-1]){
    if(d<0 && !(mix[i].qtd>0)) continue; if(d<0 && mix.reduce((s,u)=>s+u.qtd,0)<=1) continue;
    const r=M.rascunho(base, p=>{ p.mix[i].qtd+=d }); const c=r && M.confere(r); if(!c) continue;
    const cr=M.repara(c, 0); cs.push({cr, i, d}); await pausa(); chk() }
  const bu=cs.filter(x=>M.nivelOk(x.cr)).sort((a,b)=>b.cr.f.lucro-a.cr.f.lucro)[0];
  if(bu){ const nome=mix[bu.i].nome||`tipologia ${bu.i+1}`; add("unidades", `${bu.d>0?"Mais":"Menos"} 1 × ${nome} por andar`, bu.cr) }
  prog(1);
  // só as que melhoram o lucro e fecham as vagas, sem repetir a mesma mudança
  const lim=Math.max(1e4, 0.001*Math.abs(c0.f.vgv||0)), vis=new Set();
  const linhas=L.filter(x=>x.ok && x.d.lucro>lim).sort((a,b)=>b.d.lucro-a.d.lucro).filter(x=>{ const k=JSON.stringify(x.patch); if(vis.has(k)) return false; vis.add(k); return true }).slice(0,4);
  return {base:{lucro:c0.f.lucro, margem:c0.f.margemVGV, vagas:c0.m.vagas, req:c0.m.vagasReq, vgv:c0.f.vgv}, linhas, todas:L.length, ms:performance.now()-t0};
}
