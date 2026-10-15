/* ================= biblioteca de modelos de apartamento do usuário (docs/APTOS.md §4) =================
   Modelos no formato do §2 (src/calc/aptoeditor.js), guardados em localStorage "gabarito.aptos.biblioteca" (lista; troca por
   Supabase depois, docs/BACKEND.md). Nunca grava em S: o estudo copia os modelos escolhidos para S.comodos.modelos[] (motor de plantas).
   API global:
     aptoBiblioteca()           → array (cópias; mais recente primeiro)
     aptoBibObter(id)           → modelo ou null
     aptoBibSalvar(modelo)      → modelo gravado (normalizado; id "usr-…" novo se vier do catálogo ou sem id; atualizado = agora)
     aptoBibExcluir(id)         → {modelo, i} para desfazer (aptoBibRestaura) ou null
     aptoBibDuplicar(id)        → cópia gravada ("… (cópia)") ou null
     aptoBibRestaura(x)         → devolve um excluído à posição em que estava
     aptoBibOuvir(fn)           → avisa quando a biblioteca muda (outra aba também, pelo evento storage) */
const APTO_BIB_LS = "gabarito.aptos.biblioteca";
const APTO_BIB = { mem:null, ouvintes:[] };   // mem: reserva quando o localStorage falha (aba privada, cota)

function aptoBibLer(){
  try{ const v=localStorage.getItem(APTO_BIB_LS); if(v){ const l=JSON.parse(v); if(Array.isArray(l)) return l.filter(x=>x && typeof x==="object") } }catch(e){}
  return APTO_BIB.mem? aedClone(APTO_BIB.mem) : [];
}
function aptoBibGrava(l){
  APTO_BIB.mem=aedClone(l);
  try{ localStorage.setItem(APTO_BIB_LS, JSON.stringify(l)) }catch(e){ console.warn("[aptos] biblioteca só nesta sessão:", e && e.message) }
  APTO_BIB.ouvintes.forEach(f=>{ try{ f() }catch(e){} });
}
const aptoBibTempo = m=> Date.parse(m && (m.atualizado||m.criado)) || 0;
function aptoBiblioteca(){
  return aptoBibLer().map(m=>{ try{ return aedNormaliza(m) }catch(e){ return null } }).filter(Boolean).sort((a,b)=>aptoBibTempo(b)-aptoBibTempo(a));
}
function aptoBibObter(id){ const m=aptoBibLer().find(x=>x.id===id); return m? aedNormaliza(m) : null }
function aptoBibSalvar(modelo){
  if(!modelo) return null;
  const l=aptoBibLer(), m=aedNormaliza(modelo), h=new Date().toISOString();
  if(m.origem!=="usuario" || !/^usr-/.test(m.id)){ if(m.origem==="catalogo") m.base=m.id; m.id="usr-"+aedUuid(); m.origem="usuario"; m.criado=h }
  m.atualizado=h;
  const i=l.findIndex(x=>x.id===m.id);
  if(i>=0){ m.criado=l[i].criado||m.criado; l[i]=m } else l.unshift(m);
  aptoBibGrava(l);
  return aedClone(m);
}
function aptoBibExcluir(id){
  const l=aptoBibLer(), i=l.findIndex(x=>x.id===id); if(i<0) return null;
  const [m]=l.splice(i,1); aptoBibGrava(l);
  return {modelo:m, i};
}
function aptoBibRestaura(x){
  if(!x || !x.modelo) return false;
  const l=aptoBibLer(); if(l.some(m=>m.id===x.modelo.id)) return false;
  l.splice(Math.max(0, Math.min(l.length, x.i|0)), 0, x.modelo); aptoBibGrava(l); return true;
}
function aptoBibDuplicar(id){
  const m=aptoBibObter(id); if(!m) return null;
  const c=aedCopia(m, (m.nome+" (cópia)").slice(0,80)); delete c.base; if(m.base) c.base=m.base;
  const l=aptoBibLer(), i=l.findIndex(x=>x.id===id); l.splice(i+1, 0, c); aptoBibGrava(l);
  return aedClone(c);
}
function aptoBibOuvir(fn){ if(typeof fn==="function") APTO_BIB.ouvintes.push(fn); return ()=>{ APTO_BIB.ouvintes=APTO_BIB.ouvintes.filter(f=>f!==fn) } }
try{ addEventListener("storage", e=>{ if(e.key===APTO_BIB_LS) APTO_BIB.ouvintes.forEach(f=>{ try{ f() }catch(_){} }) }) }catch(e){}
