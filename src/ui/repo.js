/* ================= repositório (estudos, versões, regras) =================
   Interface assíncrona e estável — hoje em IndexedDB (banco "gabarito"), amanhã no Supabase sem mudar quem chama
   (ver docs/BACKEND.md). Todos os métodos devolvem Promise e trabalham com objetos JSON simples.
     Repo.estudos.list()            → [{id,nome,k,criado,atualizado,dono}]   (sem o estado, mais recente primeiro)
     Repo.estudos.get(id)           → {id,nome,S,k,criado,atualizado,dono} | null
     Repo.estudos.put(estudo)       → estudo gravado (cria id/datas se faltarem; atualiza "atualizado")
     Repo.estudos.remove(id)        → apaga o estudo e as versões dele
     Repo.versoes.list(estudoId)    → [{id,estudoId,nome,auto,autor,criado,k}] (sem o estado, mais recente primeiro)
     Repo.versoes.get(id) · put(v) · remove(id)
     Repo.regras.list({cidade}?) · get(id) · put(r) · remove(id)       (biblioteca de regras por cidade/zona)
     Repo.modo()                    → "idb" | "local" (fallback em localStorage quando não há IndexedDB) | "memoria"
   Sem IndexedDB (navegador antigo, iframe sem permissão) cai para localStorage ("gabarito.repo") e, em último caso, memória. */
const Repo = (()=>{
  const NOME="gabarito", VER=1, LOJAS={ estudos:"atualizado", versoes:"estudoId", regras:"cidade" };
  let modo="idb", dbP=null, mem=null;
  const agora = ()=>new Date().toISOString();
  const novoId = ()=>{ try{ if(crypto && crypto.randomUUID) return crypto.randomUUID() }catch(e){} return "id-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,10) };
  const copia = o=>JSON.parse(JSON.stringify(o));
  /* ---- fallback: um objeto {loja:{id:registro}} em localStorage (ou só em memória) ---- */
  function memAbrir(){ if(mem) return; mem = LS.get("gabarito.repo") || {}; Object.keys(LOJAS).forEach(k=>{ mem[k]=mem[k]||{} }) }
  function memGravar(){ if(modo!=="local") return; try{ localStorage.setItem("gabarito.repo", JSON.stringify(mem)) }catch(e){ modo="memoria"; console.warn("[repo] localStorage cheio — guardando só nesta sessão") } }
  function abrir(){
    if(dbP) return dbP;
    dbP = new Promise(res=>{
      const cai = motivo=>{ if(modo==="idb"){ console.warn("[repo] IndexedDB indisponível ("+motivo+") — usando localStorage"); modo="local"; memAbrir() } res(null) };
      try{
        if(typeof indexedDB==="undefined" || !indexedDB) return cai("sem suporte");
        const rq=indexedDB.open(NOME, VER);
        rq.onupgradeneeded=()=>{ const db=rq.result;
          Object.entries(LOJAS).forEach(([n,idx])=>{ if(!db.objectStoreNames.contains(n)){ const os=db.createObjectStore(n,{keyPath:"id"}); os.createIndex(idx, idx, {unique:false}) } }) };
        rq.onsuccess=()=>res(rq.result);
        rq.onerror=()=>cai(rq.error && rq.error.name || "erro");
        rq.onblocked=()=>cai("bloqueado");
      }catch(e){ cai(e && e.name || String(e)) }
    });
    return dbP;
  }
  const req = r=>new Promise((res,rej)=>{ r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error) });
  async function tx(loja, rw, fn){
    const db=await abrir();
    if(!db){ const out=fn(null); memGravar(); return out }
    const t=db.transaction(loja, rw?"readwrite":"readonly"), os=t.objectStore(loja);
    const fim=new Promise((res,rej)=>{ t.oncomplete=res; t.onerror=()=>rej(t.error); t.onabort=()=>rej(t.error) });
    const out=await fn(os);
    if(rw) await fim; else fim.catch(()=>{});
    return out;
  }
  const todos = (loja, idx, val)=>tx(loja, false, os=> os? req(idx? os.index(idx).getAll(val) : os.getAll()) : Object.values(mem[loja]).filter(r=>!idx || r[idx]===val).map(copia));
  const um = (loja, id)=>tx(loja, false, os=> os? req(os.get(id)).then(r=>r||null) : (mem[loja][id]? copia(mem[loja][id]) : null));
  const grava = (loja, obj)=>tx(loja, true, os=>{ const o=copia(obj); if(os) return req(os.put(o)).then(()=>o); mem[loja][o.id]=o; return o });
  const apaga = (loja, id)=>tx(loja, true, os=>{ if(os) return req(os.delete(id)); delete mem[loja][id] });
  const resumo = (r, tira)=>{ const o={...r}; tira.forEach(k=>delete o[k]); return o };
  const recentes = (a,b)=> String(b.atualizado||b.criado||"").localeCompare(String(a.atualizado||a.criado||""));
  return {
    modo: ()=>modo,
    pronto: ()=>abrir().then(()=>modo),
    novoId,
    estudos: {
      list: ()=>todos("estudos").then(l=>l.map(r=>resumo(r,["S"])).sort(recentes)),
      get: id=>um("estudos", id),
      put: e=>{ const t=agora(); return grava("estudos", {dono:"local", ...e, id:e.id||novoId(), criado:e.criado||t, atualizado:t}) },
      remove: async id=>{ const vs=await todos("versoes","estudoId",id); for(const v of vs) await apaga("versoes", v.id); return apaga("estudos", id) },
    },
    versoes: {
      list: estudoId=>todos("versoes","estudoId",estudoId).then(l=>l.map(r=>resumo(r,["S"])).sort((a,b)=>String(b.criado).localeCompare(String(a.criado)))),
      get: id=>um("versoes", id),
      put: v=>grava("versoes", {autor:"Local", auto:false, ...v, id:v.id||novoId(), criado:v.criado||agora()}),
      remove: id=>apaga("versoes", id),
    },
    regras: {
      list: (f={})=>todos("regras", f.cidade? "cidade" : null, f.cidade).then(l=>l.sort(recentes)),
      get: id=>um("regras", id),
      put: r=>{ const t=agora(); return grava("regras", {status:"rascunho", ...r, id:r.id||novoId(), criado:r.criado||t, atualizado:t}) },
      remove: id=>apaga("regras", id),
    },
  };
})();
