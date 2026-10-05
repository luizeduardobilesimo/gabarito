/* ================= histórico: diferenças JSON entre estados =================
   Funções puras (rodam no Node, no Worker e na página). Usadas pelo desfazer/refazer (src/ui/historico.js).
   histDiff(a,b)      → lista de operações [{p:[caminho], v:valor}] ou [{p, d:1}] (apagar) que leva a → b
   histPatch(o, ops)  → cópia de o com as operações aplicadas (o não é alterado)
   histOverlay(b, s)  → b com todos os valores de s por cima (s manda; chaves que s não tem ficam de b)
   histNums(m, f)     → números principais de um estudo (unidades, VGV, lucro, margem…) para versões e comparação */
const histIsObj = o => o!==null && typeof o==="object" && !Array.isArray(o);
const histCopy = v => v===undefined ? undefined : JSON.parse(JSON.stringify(v));
function histEq(a, b){
  if(a===b) return true;
  if(typeof a==="number" && typeof b==="number") return Number.isNaN(a) && Number.isNaN(b);
  if(Array.isArray(a) && Array.isArray(b)){ if(a.length!==b.length) return false; for(let i=0;i<a.length;i++) if(!histEq(a[i],b[i])) return false; return true }
  if(histIsObj(a) && histIsObj(b)){ const ka=Object.keys(a), kb=Object.keys(b); if(ka.length!==kb.length) return false; for(const k of ka){ if(!(k in b) || !histEq(a[k],b[k])) return false } return true }
  return false;
}
function histDiff(a, b, path=[], ops=[]){
  if(histIsObj(a) && histIsObj(b)){
    for(const k of Object.keys(a)) if(!(k in b) || b[k]===undefined) { if(a[k]!==undefined) ops.push({p:[...path,k], d:1}) }
    for(const k of Object.keys(b)){ if(b[k]===undefined) continue; if(!(k in a) || a[k]===undefined) ops.push({p:[...path,k], v:histCopy(b[k])}); else histDiff(a[k], b[k], [...path,k], ops) }
  } else if(Array.isArray(a) && Array.isArray(b) && a.length===b.length){
    for(let i=0;i<a.length;i++) histDiff(a[i], b[i], [...path,i], ops);
  } else if(!histEq(a,b)) ops.push({p:path, v:histCopy(b)});
  return ops;
}
function histPatch(o, ops){
  let root = histCopy(o);
  for(const op of ops){
    if(!op.p.length){ root = op.d? undefined : histCopy(op.v); continue }
    let t = root; for(let i=0;i<op.p.length-1;i++){ const k=op.p[i]; if(t[k]==null || typeof t[k]!=="object") t[k] = typeof op.p[i+1]==="number"? [] : {}; t=t[k] }
    const last = op.p[op.p.length-1];
    if(op.d){ if(Array.isArray(t)) t.splice(last,1); else delete t[last] } else t[last] = histCopy(op.v);
  }
  return root;
}
function histOverlay(base, snap){
  if(!histIsObj(base) || !histIsObj(snap)) return histCopy(snap);
  for(const k of Object.keys(snap)){
    const v = snap[k]; if(v===undefined) continue;
    base[k] = histIsObj(v) && histIsObj(base[k]) ? histOverlay(base[k], v) : histCopy(v);
  }
  return base;
}
/* tamanho aproximado de uma lista de operações (para o limite de memória do histórico) */
const histSize = ops => JSON.stringify(ops).length;
function histNums(m, f){
  return { units:m.units, priv:m.priv, vagas:m.vagas, vagasReq:m.vagasReq, ca:m.CA, h:m.H, vgv:f.vgv, custo:f.custo, lucro:f.lucro, margem:f.margem, tir:f.tirA, exp:-f.exp };
}
