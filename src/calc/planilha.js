/* ================= leitura de planilhas (CSV / matriz de XLSX) para os importadores =================
   Cálculo puro, sem DOM. Usado por calibravendas.js (tabela de vendas) e comparafluxo.js (fluxo da empresa).
   - plaCSV(texto)                → matriz de textos (separador ; , ou tab detectado; aspas; BOM)
   - plaNum(v, {pontoDecimal})    → número em formato brasileiro (1.234,56 · R$ 1.234 · (1.234,00) · 12%)
   - plaMes(v)                    → mês absoluto (ano×12+mês) de datas ("jan/27", "01/2027", "2027-01", Date) ou null
   - plaCabecalho(matriz)         → {iHead, cab, dados}: acha a linha de cabeçalho
   - plaMapaAuto(cab, campos)     → {chave: índice da coluna | -1}, por nome (sem acento, aliases)
   - plaCSVTexto(cab, linhas)     → texto CSV (;) com BOM, para os modelos de arquivo */

const plaNorm = s => String(s==null? "" : s).normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/²/g,"2").replace(/[^a-z0-9]+/g," ").trim();

function plaCSV(texto){
  let t = String(texto||"").replace(/^﻿/,"");
  const first = t.split(/\r?\n/).find(l=>l.trim()) || "";
  // separador: o que mais aparece na primeira linha útil, fora das aspas
  const cnt = { ";":0, ",":0, "\t":0 }; { let q=false; for(const ch of first){ if(ch==='"') q=!q; else if(!q && ch in cnt) cnt[ch]++ } }
  const sep = cnt[";"]>=cnt["\t"] && cnt[";"]>=cnt[","] && cnt[";"]>0 ? ";" : cnt["\t"]>cnt[","] ? "\t" : cnt[","]>0 ? "," : ";";
  const rows=[]; let row=[], cell="", q=false;
  for(let i=0;i<t.length;i++){
    const ch=t[i];
    if(q){ if(ch==='"'){ if(t[i+1]==='"'){ cell+='"'; i++ } else q=false } else cell+=ch }
    else if(ch==='"') q=true;
    else if(ch===sep){ row.push(cell); cell="" }
    else if(ch==="\n"||ch==="\r"){ if(ch==="\r" && t[i+1]==="\n") i++; row.push(cell); cell=""; rows.push(row); row=[] }
    else cell+=ch;
  }
  if(cell!==""||row.length){ row.push(cell); rows.push(row) }
  return rows.map(r=>r.map(c=>c.trim())).filter(r=>r.some(c=>c!==""));
}

/* número em formato brasileiro; null se não for número */
function plaNum(v, o={}){
  if(v==null||v==="") return null;
  if(typeof v==="number") return isFinite(v)? v : null;
  if(v instanceof Date) return null;
  let s=String(v).trim().replace(/R\$|\s| /g,"").replace(/−/g,"-"); if(!s) return null;
  let neg=false, pc=false;
  if(/^\(.*\)$/.test(s)){ neg=true; s=s.slice(1,-1) }
  if(s.endsWith("%")){ pc=true; s=s.slice(0,-1) }
  if(s.startsWith("-")){ neg=!neg; s=s.slice(1) } else if(s.startsWith("+")) s=s.slice(1);
  if(s.endsWith("-")){ neg=!neg; s=s.slice(0,-1) }
  if(!s||/[^\d.,]/.test(s)) return null;
  const lc=s.lastIndexOf(","), lp=s.lastIndexOf(".");
  if(lc>=0 && lp>=0){ s = lc>lp? s.replace(/\./g,"").replace(",",".") : s.replace(/,/g,"") }
  else if(lc>=0){ s = /^\d{1,3}(,\d{3}){2,}$/.test(s)? s.replace(/,/g,"") : s.replace(",",".") }
  else if(lp>=0){
    if(/^\d{1,3}(\.\d{3})+$/.test(s)){ const ponto = o.pontoDecimal && /^\d{1,3}\.\d{3}$/.test(s) && +s.split(".")[0] < 1000 && +s.replace(".","") > 1000; if(!ponto) s=s.replace(/\./g,"") }
    else if((s.match(/\./g)||[]).length>1) return null;
  }
  const x=parseFloat(s); if(!isFinite(x)) return null;
  return (neg? -x : x) / (pc? 100 : 1);
}

const PLA_MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
/* mês absoluto (ano×12+mês−1) de uma data; aceita Date, "jan/27", "janeiro/2027", "01/2027", "2027-01", "01/03/2027" */
function plaMes(v){
  if(v==null||v==="") return null;
  if(v instanceof Date){ if(isNaN(v)) return null; const u=new Date(v.getTime()+12*36e5); return u.getUTCFullYear()*12+u.getUTCMonth() }   // +12 h: sem o salto de fuso das datas do XLSX
  const s=plaNorm(v).replace(/ /g,"/"); if(!s) return null;
  let m;
  if((m=s.match(/^([a-z]{3})[a-z]*\/?(\d{2}|\d{4})$/))){ const i=PLA_MESES.indexOf(m[1]); if(i>=0){ let y=+m[2]; if(y<100) y+=2000; return y*12+i } }
  if((m=s.match(/^(\d{4})\/?(\d{1,2})(\/\d{1,2})?$/))){ const mm=+m[2]; if(mm>=1&&mm<=12) return +m[1]*12+mm-1 }
  if((m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/))){ const mm=+m[2]; let y=+m[3]; if(y<100) y+=2000; if(mm>=1&&mm<=12) return y*12+mm-1 }
  if((m=s.match(/^(\d{1,2})\/(\d{2}|\d{4})$/))){ const mm=+m[1]; let y=+m[2]; if(y<100) y+=2000; if(mm>=1&&mm<=12) return y*12+mm-1 }
  return null;
}

/* acha o cabeçalho: entre as 12 primeiras linhas, a que tem mais células de texto (não numéricas) */
function plaCabecalho(matriz){
  let best=0, bestN=-1;
  for(let i=0;i<Math.min(12,matriz.length);i++){
    const n=matriz[i].filter(c=>c!=null && String(c).trim()!=="" && plaNum(c)==null).length;
    if(n>bestN){ bestN=n; best=i }
  }
  const cab=(matriz[best]||[]).map(c=>String(c==null? "" : c).trim());
  return { iHead:best, cab, dados:matriz.slice(best+1) };
}

/* campos = [{k, alias:[…]}] em ordem de prioridade; devolve {k: coluna} (cada coluna serve a um campo só) */
function plaMapaAuto(cab, campos){
  const H=cab.map(plaNorm), usada=new Set(), out={};
  campos.forEach(c=>{
    let melhor=-1, ms=0;
    H.forEach((h,i)=>{ if(!h||usada.has(i)) return;
      c.alias.forEach(a=>{ const n=plaNorm(a); let s=0;
        if(h===n) s=4; else if(h.startsWith(n+" ")||h.endsWith(" "+n)) s=3; else if((" "+h+" ").includes(" "+n+" ")) s=2; else if(n.length>=4 && h.includes(n)) s=1;
        if(s>ms){ ms=s; melhor=i } }) });
    out[c.k]=melhor; if(melhor>=0) usada.add(melhor);
  });
  return out;
}

/* texto CSV com ; e vírgula decimal (modelos de arquivo) */
function plaCSVTexto(cab, linhas){
  const cel = v => { if(v==null) return ""; if(typeof v==="number") return String(+v.toFixed(4)).replace(".",","); const s=String(v); return /[;"\n]/.test(s)? `"${s.replace(/"/g,'""')}"` : s };
  return "﻿" + [cab, ...linhas].map(r=>r.map(cel).join(";")).join("\r\n") + "\r\n";
}
