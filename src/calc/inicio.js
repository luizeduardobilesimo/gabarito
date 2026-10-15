/* ================= tela inicial "Meus estudos" — parte pura (UX v3 §3.0) =================
   Sem DOM: roda na página, no Worker e nos testes (tests/inicio.test.js). A tela fica em src/ui/inicio.js.

   inicioResumo(st, m?, f?, ant?) → resumo gravado junto do estudo (src/ui/estudos.js, estGrava/estNovo), para a tela abrir sem recalcular:
     { v:1, vgv, margem, nivelMargem, un, feitos, total, nivel, cidade, area, exemplo, mini }
       margem      = margem s/ VGV (f.saude.margemVGV, senão lucro ÷ VGV) · nivelMargem = semáforo da Saúde (saudeNivel, lê st.metas)
       feitos/total/nivel = progressoResumo (checklist do P7)
     Sem m/f: números do resumo anterior (ant) se houver, senão null; nome da cidade, área, exemplo e miniatura do lote vêm do estado.
   inicioMini(st, m?)       → miniatura {w, h, l:[[x,y]…], fr:[i…], t:[{p:[[x,y]…], h}]} normalizada (maior lado = 100, y para baixo,
                              frente embaixo como na implantação); torres = planta de cada torre (m.T), h = pavimentos.
   inicioMiniSVG(mini, o?)  → string <svg> com classes (ini-l lote, ini-f frente, ini-s sombra, ini-t torre) — as cores ficam no CSS (tema).
   inicioDoRegistro(rec)    → o resumo de um registro do Repo (rec.resumo, ou rec.k.resumo, que é o que a nuvem guarda) ou null.
   inicioEhExemplo(rec)     → o registro é o estudo de exemplo (resumo.exemplo; sem resumo, nome = DEF.nome).
   inicioStatus(rec)        → "rascunho" | "andamento" | "confiavel" | null (sem resumo).
   inicioLista(lista, {q, status, ordem}) → lista filtrada (busca sem acento por nome e cidade; status) e ordenada (recentes|nome|margem).
   inicioDeve({total, proprios, webdriver, ver, pref}) → abre a tela ao iniciar? 0 estudos próprios ou mais de 1 estudo; nunca com
                              webdriver nem no #ver=; pref "sempre" | "nunca" (localStorage gabarito.inicio) vale por cima da regra.
   inicioTempo(iso, agoraMs) → "agora" · "há 5 min" · "há 3 h" · "ontem" · "há 4 dias" · "12 out" · "12 out 2025". */

const INI_NIVEL = { "rascunho":"rascunho", "em andamento":"andamento", "confiável":"confiavel" };
const iniR1 = v=> Math.round(v*10)/10;
const iniNum = v=> typeof v==="number" && isFinite(v)? v : null;

function inicioMini(st, m){
  const L=(st && st.lote && st.lote.pts) || [];
  if(L.length<3) return null;
  const tor=[];
  ((m && m.T) || []).forEach(t=>{
    const fx=(t.faixas && t.faixas[0]) || null;
    const p=(fx && fx.plate && fx.plate.length>=3)? fx.plate : t.plate;
    if(p && p.length>=3) tor.push({p, h:+t.pav||0});
  });
  const todos=[...L, ...tor.flatMap(t=>t.p)];
  let x0=Infinity, y0=Infinity, x1=-Infinity, y1=-Infinity;
  todos.forEach(([x,y])=>{ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y });
  const w=x1-x0, h=y1-y0, k=100/Math.max(w, h, 1e-6);
  const q=pts=>pts.map(([x,y])=>[iniR1((x-x0)*k), iniR1((y1-y)*k)]);   // y para baixo: a frente (embaixo na implantação) fica embaixo
  const fr=Array.isArray(st.lote.front)? st.lote.front.filter(i=>i>=0 && i<L.length) : [];
  return { w:iniR1(w*k), h:iniR1(h*k), l:q(L), fr, t:tor.slice(0,12).map(t=>({p:q(t.p), h:t.h})) };
}

function inicioMiniSVG(mini, o={}){
  const lbl=o.label? ` role="img" aria-label="${String(o.label).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c])}"` : ` aria-hidden="true"`;
  if(!mini || !mini.l || mini.l.length<3) return `<svg class="ini-svg" viewBox="0 0 120 80"${lbl}><rect class="ini-l vazio" x="30" y="16" width="60" height="48" rx="2"/></svg>`;
  const pad=7, W=mini.w+2*pad, H=mini.h+2*pad;
  const pt=p=>`${iniR1(p[0]+pad)},${iniR1(p[1]+pad)}`;
  const poly=(pts,cls)=>`<polygon class="${cls}" points="${pts.map(pt).join(" ")}"/>`;
  const fr=(mini.fr||[]).map(i=>{ const a=mini.l[i], b=mini.l[(i+1)%mini.l.length]; return a&&b? `<line class="ini-f" x1="${iniR1(a[0]+pad)}" y1="${iniR1(a[1]+pad)}" x2="${iniR1(b[0]+pad)}" y2="${iniR1(b[1]+pad)}"/>` : "" }).join("");
  // sombra de cada torre: a mesma planta deslocada para nordeste, proporcional à altura (luz baixa, leitura de volume)
  const sh=(mini.t||[]).map(t=>{ const d=Math.min(9, 1.2+(+t.h||0)*0.32); return poly(t.p.map(([x,y])=>[x+d*0.75, y-d*0.55]), "ini-s") }).join("");
  const tw=(mini.t||[]).map(t=>poly(t.p, "ini-t")).join("");
  return `<svg class="ini-svg" viewBox="0 0 ${iniR1(W)} ${iniR1(H)}" preserveAspectRatio="xMidYMid meet"${lbl}>${poly(mini.l,"ini-l")}${fr}${sh}${tw}</svg>`;
}

function inicioResumo(st, m, f, ant){
  const a = ant && typeof ant==="object"? ant : {};
  const R = (st && st.regras) || {}, ref = (st && st.regrasRef) || {};
  const cidade = ref.id || (R.cidade && R.cidade!==DEF.regras.cidade)? String(R.cidade||"") : "";
  const area = st && st.lote && st.lote.pts && st.lote.pts.length>=3? Math.round(G.area(st.lote.pts)) : null;
  const exemplo = typeof assEhExemplo==="function"? assEhExemplo(st) : (!!st && st.nome===DEF.nome);
  const base = { v:1, cidade, area, exemplo };
  if(!m || !m.T || !f){
    return { vgv:iniNum(a.vgv), margem:iniNum(a.margem), nivelMargem:a.nivelMargem||null, un:iniNum(a.un),
      feitos:iniNum(a.feitos), total:iniNum(a.total), nivel:a.nivel||null, ...base, mini:a.mini || inicioMini(st, null) };
  }
  const sd = f.saude || (typeof saudeNegocio==="function"? (()=>{ try{ return saudeNegocio(st, m, f) }catch(e){ return null } })() : null);
  const margem = sd && iniNum(sd.margemVGV)!=null? sd.margemVGV : iniNum(f.margemVGV)!=null? f.margemVGV : f.vgv? f.lucro/f.vgv : null;
  const nivelMargem = margem!=null && typeof saudeNivel==="function"? saudeNivel("margem", margem, st) : sd && sd.nivel? sd.nivel.margem : null;
  let pr=null; try{ pr = typeof progressoResumo==="function"? progressoResumo(st, m, f) : null }catch(e){ pr=null }
  return { vgv:iniNum(f.vgv), margem:iniNum(margem), nivelMargem, un:iniNum(m.units),
    feitos: pr? pr.feitos : null, total: pr? pr.total : null, nivel: pr? pr.nivel : null, ...base, mini: inicioMini(st, m) };
}

const inicioDoRegistro = rec=> !rec? null : (rec.resumo && typeof rec.resumo==="object")? rec.resumo : (rec.k && rec.k.resumo && typeof rec.k.resumo==="object")? rec.k.resumo : null;
function inicioEhExemplo(rec){ const r=inicioDoRegistro(rec); return r && typeof r.exemplo==="boolean"? r.exemplo : !!rec && rec.nome===DEF.nome }
function inicioStatus(rec){ const r=inicioDoRegistro(rec); return r && r.nivel? (INI_NIVEL[r.nivel]||null) : null }

const iniSemAcento = s=> String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim();
function inicioLista(lista, o={}){
  const q=iniSemAcento(o.q), st=o.status||"todos", ord=o.ordem||"recentes";
  let l=(lista||[]).filter(e=>{
    if(st!=="todos" && inicioStatus(e)!==st) return false;
    if(!q) return true;
    const r=inicioDoRegistro(e)||{};
    return q.split(/\s+/).every(p=> iniSemAcento(e.nome).includes(p) || iniSemAcento(r.cidade).includes(p));
  });
  const rec=(a,b)=> String(b.atualizado||b.criado||"").localeCompare(String(a.atualizado||a.criado||""));
  if(ord==="nome") l=l.slice().sort((a,b)=> String(a.nome||"").localeCompare(String(b.nome||""), "pt-BR", {sensitivity:"base", numeric:true}) || rec(a,b));
  else if(ord==="margem") l=l.slice().sort((a,b)=>{ const x=(inicioDoRegistro(a)||{}).margem, y=(inicioDoRegistro(b)||{}).margem;
    const xa=iniNum(x), ya=iniNum(y); if(xa==null && ya==null) return rec(a,b); if(xa==null) return 1; if(ya==null) return -1; return ya-xa || rec(a,b) });
  else l=l.slice().sort(rec);
  return l;
}

function inicioDeve(o={}){
  if(o.webdriver || o.ver) return false;
  if(o.pref==="nunca") return false;
  if(o.pref==="sempre") return true;
  return (o.proprios|0)===0 || (o.total|0)>1;
}

const INI_MES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
function inicioTempo(iso, agora){
  const t=Date.parse(iso||""); if(!isFinite(t)) return "";
  const now = isFinite(agora)? agora : Date.now(), s=Math.max(0, (now-t)/1000);
  if(s<60) return "agora";
  if(s<3600) return `há ${Math.floor(s/60)} min`;
  const d=new Date(t), n=new Date(now);
  const dia=x=>new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dd=Math.round((dia(n)-dia(d))/86400000);
  if(dd<=0) return `há ${Math.floor(s/3600)} h`;
  if(dd===1) return "ontem";
  if(dd<7) return `há ${dd} dias`;
  return `${d.getDate()} ${INI_MES[d.getMonth()]}${d.getFullYear()!==n.getFullYear()? " "+d.getFullYear() : ""}`;
}
