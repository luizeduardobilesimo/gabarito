/* ================= CUB por estado e padrão (NBR 12721) =================
   Valores embutidos = REFERÊNCIAS APROXIMADAS (ilustrativas). Atualize com o boletim mensal do Sinduscon do estado:
   importe um CSV/JSON (cubParse) — as linhas importadas substituem as embutidas do mesmo estado. */
const CUB_PADROES = [
  ["R1-N","R1-N · residência unifamiliar normal"], ["R1-A","R1-A · residência unifamiliar alto"],
  ["PP-4-N","PP-4-N · prédio popular 4 pav."], ["R8-N","R8-N · residencial 8 pav. normal"], ["R8-A","R8-A · residencial 8 pav. alto"],
  ["R16-N","R16-N · residencial 16 pav. normal"], ["R16-A","R16-A · residencial 16 pav. alto"]
];
// razão típica de cada padrão sobre o R8-N (ordem de grandeza dos boletins; ilustrativa)
const CUB_RAZAO = { "R1-N":1.21, "R1-A":1.62, "PP-4-N":1.04, "R8-N":1, "R8-A":1.22, "R16-N":0.97, "R16-A":1.27 };
// R8-N aproximado por estado (R$/m², referência set/2026 — ilustrativo)
const CUB_BASE = [
  ["SC","Santa Catarina",3159],["PR","Paraná",2650],["RS","Rio Grande do Sul",2980],["SP","São Paulo",2380],["RJ","Rio de Janeiro",2450],
  ["MG","Minas Gerais",2390],["ES","Espírito Santo",2280],["DF","Distrito Federal",2290],["GO","Goiás",2330],["MT","Mato Grosso",2420],
  ["MS","Mato Grosso do Sul",2310],["BA","Bahia",2140],["PE","Pernambuco",2120],["CE","Ceará",2050],["AM","Amazonas",2370],["PA","Pará",2260]
];
const CUB_TAB = CUB_BASE.map(([uf,nome,r8])=>({ uf, nome, ref:"2026-09", fonte:"Sinduscon-"+uf, ilustrativo:true,
  v: Object.fromEntries(Object.entries(CUB_RAZAO).map(([p,k])=>[p, Math.round(r8*k)])) }));

/* tabela efetiva: embutida + importada (a importada vence por estado; padrões ausentes caem na embutida) */
function cubLista(st){
  const imp = (st && st.orc && Array.isArray(st.orc.cubTab)) ? st.orc.cubTab : [];
  const out = CUB_TAB.map(r=>({...r, v:{...r.v}}));
  imp.forEach(r=>{ if(!r || !r.uf) return; const uf=String(r.uf).toUpperCase(); let e=out.find(x=>x.uf===uf);
    if(!e){ e={uf, nome:r.nome||uf, ref:"", fonte:"", ilustrativo:false, v:{}}; out.push(e) }
    e.v = {...e.v, ...(r.v||{})}; e.ref = r.ref||e.ref; e.fonte = r.fonte||e.fonte||("Sinduscon-"+uf); e.ilustrativo = false; e.nome = r.nome||e.nome });
  return out;
}
function cubLinha(st, uf){ const l=cubLista(st); return l.find(r=>r.uf===uf) || l[0] }
function cubValor(st, uf, padrao){ const r=cubLinha(st, uf); return r && r.v[padrao] || null }

/* importação: CSV longo (uf;padrao;valor;ref;fonte), CSV largo (uf;ref;fonte;R8-N;R16-N…) ou JSON (lista ou {UF:{padrão:valor}}) */
function cubNum(s){ if(typeof s==="number") return s; s=String(s||"").trim().replace(/[R$\s]/g,""); if(/,\d{1,2}$/.test(s)) s=s.replace(/\./g,"").replace(",","."); else s=s.replace(/,/g,""); const v=parseFloat(s); return isFinite(v)? v : null }
function cubParse(text){
  const t = String(text||"").trim(); if(!t) return [];
  const rows = {}; const put=(uf,p,val,ref,fonte)=>{ uf=String(uf||"").trim().toUpperCase(); const v=cubNum(val); if(!uf || !p || v==null || v<=0) return;
    const r = rows[uf] = rows[uf] || {uf, v:{}}; r.v[String(p).trim().toUpperCase()] = v; if(ref) r.ref=String(ref).trim(); if(fonte) r.fonte=String(fonte).trim() };
  if(t[0]==="{" || t[0]==="["){
    const o = JSON.parse(t);
    if(Array.isArray(o)) o.forEach(r=>{ if(r.v) Object.entries(r.v).forEach(([p,v])=>put(r.uf,p,v,r.ref,r.fonte)); else if(r.padrao) put(r.uf,r.padrao,r.valor,r.ref,r.fonte); else Object.entries(r).forEach(([p,v])=>{ if(/^(R|PP|PIS|CS|CAL|CSL|GI|RP)/i.test(p)) put(r.uf,p,v,r.ref,r.fonte) }) });
    else Object.entries(o).forEach(([uf,v])=>{ if(v && typeof v==="object") Object.entries(v).forEach(([p,x])=>{ if(p!=="ref"&&p!=="fonte") put(uf,p,x,v.ref,v.fonte) }) });
  } else {
    const lines = t.split(/\r?\n/).filter(l=>l.trim()); const sep = (lines[0].match(/;/g)||[]).length >= (lines[0].match(/,/g)||[]).length ? ";" : ",";
    const head = lines[0].split(sep).map(h=>h.trim().toLowerCase());
    const ix = k => head.indexOf(k);
    if(ix("padrao")>=0 || ix("padrão")>=0){ const ip=ix("padrao")>=0?ix("padrao"):ix("padrão"), iv=ix("valor");
      lines.slice(1).forEach(l=>{ const c=l.split(sep); put(c[ix("uf")], c[ip], c[iv], c[ix("ref")], c[ix("fonte")]) }) }
    else { const pads = head.map((h,i)=>/^(r|pp|pis|cs|cal|csl|gi|rp)/.test(h)? i : -1).filter(i=>i>=0);
      lines.slice(1).forEach(l=>{ const c=l.split(sep); pads.forEach(i=>put(c[ix("uf")], head[i], c[i], c[ix("ref")], c[ix("fonte")])) }) }
  }
  return Object.values(rows);
}
