/* ================= CUB por estado e padrão (NBR 12721) =================
   Fase E: a tabela embutida traz o CUB/m² PUBLICADO pelos Sinduscons (valores de ago/2026 e set/2026, com mês de referência e fonte por linha).
   - Linha com tabela completa (SC, RS, PR, SP, MG): todos os padrões vêm do boletim do Sinduscon.
   - Linha só com o R8-N publicado (RJ, DF, MT, MS, BA, PE, CE, PA): os outros padrões são ESTIMADOS pela razão típica sobre o R8-N (campo `est`).
   - Linha sem boletim confiável (ES, GO, AM): valor antigo, marcado como `ilustrativo`.
   Atualize com o boletim mensal do Sinduscon do estado: importe um CSV/JSON (cubParse) — as linhas importadas substituem as embutidas do mesmo estado.
   CUB_VERSAO = data em que esta tabela embutida foi conferida (a interface mostra "CUB <UF> <padrão> · <mês/ano> · <fonte>"). */
const CUB_VERSAO = "2026-10-13";
const CUB_PADROES = [
  ["R8-N","R8-N · residencial 8 pav. normal"], ["R16-N","R16-N · residencial 16 pav. normal"], ["PP-4-N","PP-4-N · prédio popular 4 pav."],
  ["R1-N","R1-N · residência unifamiliar normal"], ["R8-A","R8-A · residencial 8 pav. alto"], ["R16-A","R16-A · residencial 16 pav. alto"],
  ["R1-A","R1-A · residência unifamiliar alto"], ["R8-B","R8-B · residencial 8 pav. baixo"], ["PP-4-B","PP-4-B · prédio popular 4 pav. baixo"],
  ["R1-B","R1-B · residência unifamiliar baixo"], ["PIS","PIS · projeto de interesse social"]
];
// razão típica de cada padrão sobre o R8-N (média dos boletins completos de SC, RS, PR, SP e MG em ago–set/2026)
const CUB_RAZAO = { "R1-B":0.971, "R1-N":1.209, "R1-A":1.51, "PP-4-B":0.903, "PP-4-N":1.144, "R8-B":0.856, "R8-N":1, "R8-A":1.218, "R16-N":0.972, "R16-A":1.263, "PIS":0.679 };
/* boletins completos (R$/m², CUB 2006 sem desoneração) */
const CUB_COMPLETO = [
  ["SC","Santa Catarina","2026-08","Sinduscon Grande Florianópolis · dados de ago/2026, uso em set/2026","https://www.sindusconbc.com.br/wp-content/uploads/2026/09/PLANILHA-COMPLETA-CUB-2006-SETEMBRO-2026.pdf",
    {"R1-B":2872.77,"R1-N":3434.48,"R1-A":4189.22,"PP-4-B":2613.45,"PP-4-N":3168.98,"R8-B":2472.02,"R8-N":2800.40,"R8-A":3330.06,"R16-N":2704.32,"R16-A":3467.78,"PIS":1988.45}],
  ["PR","Paraná","2026-09","Sinduscon-PR","https://sindusconpr.com.br/wp-content/uploads/2026/10/2026-9-Tabela-CUB-m2.pdf",
    {"R1-B":2681.59,"R1-N":3365.21,"R1-A":4109.51,"PP-4-B":2459.78,"PP-4-N":3144.71,"R8-B":2327.91,"R8-N":2738.93,"R8-A":3328.10,"R16-N":2657.44,"R16-A":3388.41,"PIS":1869.10}],
  ["RS","Rio Grande do Sul","2026-09","Sinduscon-RS","https://sinduscon-rs.com.br/wp-content/uploads/2026/10/PRECOS-E-CUSTOS-DA-CONSTRUCAO-DE-SETEMBRO-2026-REV.pdf",
    {"R1-B":2567.33,"R1-N":3452.09,"R1-A":4664.55,"PP-4-B":2447.10,"PP-4-N":3383.58,"R8-B":2322.15,"R8-N":2943.73,"R8-A":3789.65,"R16-N":2887.83,"R16-A":3862.64,"PIS":1862.93}],
  ["SP","São Paulo","2026-09","Sinduscon-SP","https://portaldori.com.br/2026/10/05/sinduscon-divulga-tabelas-de-custo-unitario-basico-no-estado-de-sao-paulo-referencia-setembro-de-2026/",
    {"R1-B":2193.39,"R1-N":2690.33,"R1-A":3255.86,"PP-4-B":2048.82,"PP-4-N":2553.75,"R8-B":1950.93,"R8-N":2238.58,"R8-A":2627.86,"R16-N":2175.77,"R16-A":2845.25,"PIS":1523.85}],
  ["MG","Minas Gerais","2026-09","Sinduscon-MG","https://sinduscon-mg.org.br/wp-content/uploads/2026/10/tabela_cub_setembro_2026.pdf",
    {"R1-B":2552.62,"R1-N":3118.02,"R1-A":3884.77,"PP-4-B":2404.94,"PP-4-N":2946.78,"R8-B":2265.98,"R8-N":2561.78,"R8-A":3137.48,"R16-N":2492.07,"R16-A":3222.70,"PIS":1767.64}]
];
/* só o R8-N publicado (via MySide, que reproduz o Sinduscon do estado): [uf, nome, R8-N, ref, fonte, url] */
const CUB_SO_R8N = [
  ["RJ","Rio de Janeiro",2476.31,"2026-09","Sinduscon-RJ (via MySide)","https://myside.com.br/guia-imoveis/cub-rj"],
  ["DF","Distrito Federal",2416.71,"2026-09","Sinduscon-DF (via MySide)","https://myside.com.br/guia-imoveis/cub-df"],
  ["MT","Mato Grosso",3314.80,"2026-09","Sinduscon-MT (via MySide)","https://myside.com.br/guia-imoveis/cub-mt"],
  ["MS","Mato Grosso do Sul",1873.74,"2026-08","Sinduscon-MS (via MySide)","https://myside.com.br/guia-imoveis/cub-ms"],
  ["BA","Bahia",2218.68,"2026-08","Sinduscon-BA (via MySide)","https://myside.com.br/guia-imoveis/cub-ba"],
  ["PE","Pernambuco",2240.23,"2026-09","Sinduscon-PE (via MySide)","https://myside.com.br/guia-imoveis/cub-pe"],
  ["CE","Ceará",2458.13,"2026-08","Sinduscon-CE (via MySide)","https://myside.com.br/guia-imoveis/cub-ce"],
  ["PA","Pará",2374.18,"2026-09","Sinduscon-PA (via MySide)","https://myside.com.br/guia-imoveis/cub-pa"]
];
/* sem boletim confiável: valor antigo, ilustrativo */
const CUB_ILUSTR = [["ES","Espírito Santo",2280],["GO","Goiás",2330],["AM","Amazonas",2370]];
const CUB_ORDEM = ["SC","PR","RS","SP","RJ","MG","ES","DF","GO","MT","MS","BA","PE","CE","AM","PA"];
const cubDeR8N = r8 => Object.fromEntries(Object.entries(CUB_RAZAO).map(([p,k])=>[p, p==="R8-N" ? r8 : Math.round(r8*k*100)/100]));
const CUB_TAB = CUB_ORDEM.map(uf=>{
  const c = CUB_COMPLETO.find(x=>x[0]===uf); if(c) return { uf, nome:c[1], ref:c[2], fonte:c[3], url:c[4], ilustrativo:false, est:[], v:{...c[5]} };
  const o = CUB_SO_R8N.find(x=>x[0]===uf); if(o) return { uf, nome:o[1], ref:o[3], fonte:o[4], url:o[5], ilustrativo:false, est:Object.keys(CUB_RAZAO).filter(p=>p!=="R8-N"), v:cubDeR8N(o[2]) };
  const i = CUB_ILUSTR.find(x=>x[0]===uf); return { uf, nome:i[1], ref:"", fonte:"estimativa interna (sem boletim conferido)", url:"", ilustrativo:true, est:Object.keys(CUB_RAZAO), v:cubDeR8N(i[2]) };
});
/* "2026-10-13" → "13/10/2026" */
const cubVersaoTxt = () => CUB_VERSAO.split("-").reverse().join("/");
const CUB_MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
/* "2026-08" → "ago/2026"; texto livre passa direto */
function cubRefTxt(ref){ const m = /^(\d{4})-(\d{2})$/.exec(String(ref||"")); return m && +m[2]>=1 && +m[2]<=12 ? CUB_MESES[+m[2]-1]+"/"+m[1] : String(ref||"") }

/* tabela efetiva: embutida + importada (a importada vence por estado e por padrão; padrões ausentes caem na embutida) */
function cubLista(st){
  const imp = (st && st.orc && Array.isArray(st.orc.cubTab)) ? st.orc.cubTab : [];
  const out = CUB_TAB.map(r=>({...r, v:{...r.v}, est:[...(r.est||[])]}));
  imp.forEach(r=>{ if(!r || !r.uf) return; const uf=String(r.uf).toUpperCase(); let e=out.find(x=>x.uf===uf);
    if(!e){ e={uf, nome:r.nome||uf, ref:"", fonte:"", url:"", ilustrativo:false, est:[], v:{}}; out.push(e) }
    Object.keys(r.v||{}).forEach(p=>{ e.est = e.est.filter(x=>x!==p) });
    e.v = {...e.v, ...(r.v||{})}; e.ref = r.ref||e.ref; e.fonte = r.fonte||e.fonte||("Sinduscon-"+uf); e.url = r.url||""; e.ilustrativo = false; e.nome = r.nome||e.nome });
  return out;
}
function cubLinha(st, uf){ const l=cubLista(st); return l.find(r=>r.uf===uf) || l[0] }
function cubValor(st, uf, padrao){ const r=cubLinha(st, uf); return r && r.v[padrao] || null }
/* "CUB SC R8-N · ago/2026 · Sinduscon Grande Florianópolis (estimado pela razão sobre o R8-N | ilustrativo)" — texto único da interface, do PDF e dos avisos */
function cubDescricao(st, uf, padrao){
  const r = cubLinha(st, uf); if(!r) return "";
  const est = r.ilustrativo ? "ilustrativo" : (r.est||[]).includes(padrao) ? "estimado pela razão sobre o R8-N" : "";
  return `CUB ${r.uf} ${padrao} · ${r.ref? cubRefTxt(r.ref) : "sem mês de referência"} · ${r.fonte||"sem fonte"}${est? " ("+est+")" : ""}`;
}
/* estado do estudo: o campo orc.uf; quando a zona/cidade escolhida em Regras é de outro estado, essa é a sugestão (null = sem sugestão) */
function cubUfSugerida(st){
  const id = st && st.regrasRef && st.regrasRef.id; if(!id || typeof cidadeAcha!=="function") return null;
  const c = cidadeAcha(id); const uf = c && c.uf ? String(c.uf).toUpperCase() : null;
  return uf && uf !== (st.orc && st.orc.uf) && cubLista(st).some(r=>r.uf===uf) ? uf : null;
}
/* "Seguir a tabela do estado": com orc.cubAuto ligado, fin.cub passa a ser o CUB do estado e padrão escolhidos. Devolve true se mudou */
function cubSincroniza(st){
  if(!st || !st.orc || !st.orc.cubAuto) return false;
  const v = cubValor(st, st.orc.uf, st.orc.padrao); if(!v) return false;
  const novo = Math.round(v*100)/100; if(Math.abs((st.fin.cub||0)-novo) < 0.005) return false;
  st.fin.cub = novo; return true;
}

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
