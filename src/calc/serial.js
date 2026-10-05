/* ================= serialização do modelo (Web Worker ↔ página) =================
   O resultado de compute() viaja do Worker para a página por structured clone. Ele aceita objetos, arrays,
   typed arrays (Int32Array da malha da garagem), Map/Set/Date e referências repetidas ou cíclicas,
   mas NÃO aceita funções, Path2D, elementos do DOM nem instâncias de classes com métodos.
   serialProblemas(v) → caminhos que impedem o clone (para testes e diagnóstico)
   serialLimpa(v)     → cópia clonável: tira funções/símbolos, converte instâncias em objetos simples, mantém ciclos e typed arrays */
const serialPlano = v => { const p=Object.getPrototypeOf(v); return p===null || Object.getPrototypeOf(p)===null };   // objeto simples (de qualquer realm)
const serialOk = v => v===null || typeof v!=="object" || Array.isArray(v) || ArrayBuffer.isView(v) || v instanceof Date || v instanceof Map || v instanceof Set || v instanceof RegExp || serialPlano(v);
function serialProblemas(v, path="m", seen=new Set(), out=[]){
  if(typeof v==="function"){ out.push(path+" (função)"); return out }
  if(typeof v==="symbol"){ out.push(path+" (símbolo)"); return out }
  if(v===null || typeof v!=="object" || ArrayBuffer.isView(v)) return out;
  if(seen.has(v)) return out; seen.add(v);
  if(!serialOk(v)) out.push(path+" ("+((v.constructor&&v.constructor.name)||"objeto")+")");
  if(v instanceof Map){ v.forEach((x,k)=>serialProblemas(x, path+"<"+String(k)+">", seen, out)); return out }
  if(v instanceof Set){ let i=0; v.forEach(x=>serialProblemas(x, path+"{"+(i++)+"}", seen, out)); return out }
  for(const k of Object.keys(v)) serialProblemas(v[k], path+(Array.isArray(v)? "["+k+"]" : "."+k), seen, out);
  return out;
}
function serialLimpa(v, seen=new Map()){
  if(typeof v==="function" || typeof v==="symbol") return undefined;
  if(v===null || typeof v!=="object" || ArrayBuffer.isView(v) || v instanceof Date || v instanceof RegExp) return v;
  if(seen.has(v)) return seen.get(v);
  if(Array.isArray(v)){ const o=[]; seen.set(v,o); for(let i=0;i<v.length;i++){ const x=serialLimpa(v[i],seen); o[i]= x===undefined? null : x } return o }
  if(v instanceof Map){ const o=new Map(); seen.set(v,o); v.forEach((x,k)=>{ const y=serialLimpa(x,seen); if(y!==undefined) o.set(k,y) }); return o }
  if(v instanceof Set){ const o=new Set(); seen.set(v,o); v.forEach(x=>{ const y=serialLimpa(x,seen); if(y!==undefined) o.add(y) }); return o }
  const o={}; seen.set(v,o);
  for(const k of Object.keys(v)){ let x; try{ x=v[k] }catch(e){ continue } const y=serialLimpa(x,seen); if(y!==undefined) o[k]=y }
  return o;
}
