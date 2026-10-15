/* ================= repositório na nuvem (app web com login) =================
   Mesma interface do Repo local (docs/BACKEND.md, seção 1), falando com /api/estudos, /api/versoes e /api/regras.
   "Grava local primeiro": toda gravação vai antes para o RepoLocal (IndexedDB), marcada {nuvem:{dono, rev, pendente:true}},
   e entra numa fila (localStorage "gabarito.nuvem.fila.<dono>") que um sincronizador envia quando há rede.
   Conflito (409: o estudo mudou em outro aparelho): vale a última gravação (a nossa), mas a versão do outro aparelho é
   guardada antes como versão automática "Conflito — outro aparelho (data)" e o usuário recebe um aviso. Nada se perde.
   Registros locais SEM o campo `nuvem` são estudos deste navegador ainda não enviados (oferta de migração em auth.js).
   Sem DOM no nível superior: testado no Node (tests/nuvem.test.js). */
function repoNuvem(local, api, o){
  const dono=o.dono, ls=o.ls||LS, avisa=o.avisa||(()=>{}), agendaFn=o.agenda||((fn,ms)=>setTimeout(fn,ms)), autor=o.autor||"";
  const CHAVE="gabarito.nuvem.fila."+dono, B=local.bruto;
  const agora=()=>new Date().toISOString();
  const offline=e=> !e || e.status==null || e.status===0 || e.status===502 || e.status===503 || e.status===504;
  const recentes=(a,b)=> String(b.atualizado||b.criado||"").localeCompare(String(a.atualizado||a.criado||""));
  const meu=r=> r && r.nuvem && r.nuvem.dono===dono;
  const semS=r=>{ const x={...r}; delete x.S; return x };
  let fila=ls.get(CHAVE)||[], rodando=false, timer=0, falhas=0, avisouConflito={};
  const gravaFila=()=>ls.set(CHAVE, fila);
  const enfileira=item=>{ fila=fila.filter(x=>x!==item); fila.push(item); gravaFila(); agenda(800) };
  function agenda(ms){ if(timer) return; timer=agendaFn(()=>{ timer=0; sincroniza() }, ms) }
  const cacheEst=(r,extra)=>B.grava("estudos", {...r, nuvem:{dono, rev:r.rev||0, pendente:false, ...extra}});

  /* ---- envio de um item da fila; devolve true se saiu da fila ---- */
  async function envia(item){
    const [tipo, id]=[item.slice(0,item.indexOf(":")), item.slice(item.indexOf(":")+1)];
    if(tipo==="e"){
      const rec=await B.um("estudos", id); if(!meu(rec) || !rec.nuvem.pendente) return true;
      const corpo={id, nome:rec.nome, S:rec.S, k:rec.k||null};
      let r;
      const cria=async()=>{ try{ return await api("POST","/api/estudos",corpo) }catch(e){ if(e.status===409){ const at=await api("GET","/api/estudos?id="+encodeURIComponent(id)); return await api("PUT","/api/estudos?id="+encodeURIComponent(id), {...corpo, rev:at.rev}) } throw e } };
      if(!rec.nuvem.rev) r=await cria();
      else {
        try{ r=await api("PUT","/api/estudos?id="+encodeURIComponent(id), {...corpo, rev:rec.nuvem.rev}) }
        catch(e){
          if(e.status===404) r=await cria();
          else if(e.status===409 && e.corpo && e.corpo.atual){
            const at=e.corpo.atual;
            await api("POST","/api/versoes",{estudoId:id, nome:"Conflito — outro aparelho ("+dataCurta(at.atualizado)+")", auto:true, S:at.S, k:at.k||null, autor:"outro aparelho"});
            r=await api("PUT","/api/estudos?id="+encodeURIComponent(id), {...corpo, rev:at.rev});
            if(!avisouConflito[id]){ avisouConflito[id]=1; avisa("Este estudo tinha mudado em outro aparelho. A versão de lá ficou guardada em Versões.") }
          } else throw e;
        }
      }
      // mudou enquanto enviava? continua pendente, com a revisão nova
      const agoraRec=await B.um("estudos", id);
      const mudou=agoraRec && agoraRec.atualizado!==rec.atualizado;
      if(agoraRec) await B.grava("estudos", {...agoraRec, criado:r.criado||agoraRec.criado, nuvem:{dono, rev:r.rev, pendente:!!mudou}});
      if(mudou){ fila.push(item); gravaFila() }
      return true;
    }
    if(tipo==="v"){
      const v=await B.um("versoes", id); if(!meu(v) || !v.nuvem.pendente) return true;
      const est=await B.um("estudos", v.estudoId);
      try{ await api("POST","/api/versoes",{id, estudoId:v.estudoId, nome:v.nome, auto:!!v.auto, S:v.S, k:v.k||null, autor:v.autor}) }
      catch(e){ if(e.status===404 && est && meu(est) && est.nuvem.pendente) return false; if(e.status===404) return true; throw e }
      await B.grava("versoes", {...v, nuvem:{dono, pendente:false}});
      return true;
    }
    if(tipo==="r"){
      const r=await B.um("regras", id); if(!meu(r) || !r.nuvem.pendente) return true;
      const s=await api("POST","/api/regras", semNuvem(r));
      await B.grava("regras", {...r, ...s, nuvem:{dono, pendente:false}});
      return true;
    }
    const rota={x:"estudos", xv:"versoes", xr:"regras"}[tipo];
    if(rota){ try{ await api("DELETE","/api/"+rota+"?id="+encodeURIComponent(id)) }catch(e){ if(e.status!==404) throw e } return true }
    return true;
  }
  const semNuvem=r=>{ const x={...r}; delete x.nuvem; return x };
  const dataCurta=iso=>{ try{ const d=new Date(iso); return d.toLocaleDateString("pt-BR")+" "+d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}) }catch(e){ return "" } };

  /** envia a fila; para no primeiro erro de rede (tenta de novo depois) */
  async function sincroniza(){
    if(rodando) return; rodando=true;
    try{
      let voltas=0;
      while(fila.length && voltas++<500){
        const item=fila[0]; let saiu=true;
        try{ saiu=await envia(item) }
        catch(e){
          if(offline(e)){ falhas++; agenda(Math.min(60000, 5000*falhas)); break }
          console.warn("[nuvem] item descartado", item, e && e.message); avisa("Não foi possível salvar uma alteração na nuvem: "+(e && e.message || "erro"));
        }
        fila=fila.filter(x=>x!==item); if(!saiu) fila.push(item); gravaFila();
        if(!saiu && fila.every(x=>x.startsWith("v:"))) break;   // só versões esperando o estudo: espera a próxima rodada
        falhas=0;
      }
    } finally { rodando=false }
    return fila.length;
  }

  const lerNuvem=async(caminho)=>{ try{ return await api("GET", caminho) }catch(e){ if(offline(e)) return undefined; throw e } };
  const R={
    tipo:"nuvem",
    modo:()=>"nuvem",
    pronto:()=>local.pronto().then(()=>"nuvem"),
    novoId:local.novoId,
    sincroniza, pendentes:()=>fila.length, dono,
    estudos:{
      async list(){
        const nv=await lerNuvem("/api/estudos");
        const locais=(await B.todos("estudos")).filter(meu);
        if(nv===undefined) return locais.map(semS).sort(recentes);
        const ids=new Set(nv.map(e=>e.id)), pend=locais.filter(l=>l.nuvem.pendente);
        for(const l of locais) if(!ids.has(l.id) && !l.nuvem.pendente) await B.apaga("estudos", l.id);   // apagado em outro aparelho
        const out=nv.map(e=>{ const p=pend.find(x=>x.id===e.id); return p? semS(p) : e });
        pend.filter(p=>!ids.has(p.id)).forEach(p=>out.push(semS(p)));
        return out.sort(recentes);
      },
      async get(id){
        const l=await B.um("estudos", id);
        if(meu(l) && l.nuvem.pendente) return l;   // a cópia local é a mais nova
        try{ const r=await api("GET","/api/estudos?id="+encodeURIComponent(id)); await cacheEst(r); return {...r, nuvem:{dono, rev:r.rev, pendente:false}} }
        catch(e){ if(offline(e)) return meu(l)? l : null; if(e.status===404) return null; throw e }
      },
      async put(e, o){
        const id=e.id||local.novoId(), ant=await B.um("estudos", id), t=agora();
        const rec={...e, id, dono, criado:e.criado||(ant&&ant.criado)||t, atualizado:o && o.manterData && e.atualizado? e.atualizado : t, nuvem:{dono, rev:(meu(ant)&&ant.nuvem.rev)||0, pendente:true}};
        await B.grava("estudos", rec); enfileira("e:"+id);
        return rec;
      },
      async remove(id){
        await local.estudos.remove(id);
        fila=fila.filter(x=>x!=="e:"+id); enfileira("x:"+id);
      },
    },
    versoes:{
      async list(estudoId){
        const nv=await lerNuvem("/api/versoes?estudo="+encodeURIComponent(estudoId)).catch(e=>{ if(e.status===404) return []; throw e });
        const locais=(await B.todos("versoes","estudoId",estudoId)).filter(meu);
        const ord=(a,b)=>String(b.criado).localeCompare(String(a.criado));
        if(nv===undefined) return locais.map(semS).sort(ord);
        const ids=new Set(nv.map(v=>v.id));
        return [...nv, ...locais.filter(v=>v.nuvem.pendente && !ids.has(v.id)).map(semS)].sort(ord);
      },
      async get(id){
        const l=await B.um("versoes", id); if(meu(l)) return l;   // versões não mudam: o cache vale
        try{ const r=await api("GET","/api/versoes?id="+encodeURIComponent(id)); await B.grava("versoes", {...r, nuvem:{dono, pendente:false}}); return r }
        catch(e){ if(offline(e) || e.status===404) return null; throw e }
      },
      async put(v){
        const rec={autor, auto:false, ...v, id:v.id||local.novoId(), criado:v.criado||agora(), nuvem:{dono, pendente:true}};
        await B.grava("versoes", rec); enfileira("v:"+rec.id);
        return rec;
      },
      async remove(id){ await B.apaga("versoes", id); fila=fila.filter(x=>x!=="v:"+id); enfileira("xv:"+id) },
    },
    regras:{
      async list(f={}){
        const nv=await lerNuvem("/api/regras"+(f.cidade? "?cidade="+encodeURIComponent(f.cidade) : ""));
        if(nv!==undefined) return nv;
        return (await local.regras.list(f)).filter(r=>!r.nuvem || meu(r));
      },
      async get(id){
        try{ return await api("GET","/api/regras?id="+encodeURIComponent(id)) }
        catch(e){ if(offline(e)){ const l=await B.um("regras", id); return l && (!l.nuvem || meu(l))? l : null } if(e.status===404) return null; throw e }
      },
      async put(r){
        const t=agora(), rec={status:"rascunho", ...r, id:r.id||local.novoId(), criado:r.criado||t, atualizado:t, nuvem:{dono, pendente:true}};
        await B.grava("regras", rec); enfileira("r:"+rec.id);
        return rec;
      },
      async remove(id){ await B.apaga("regras", id); fila=fila.filter(x=>x!=="r:"+id); enfileira("xr:"+id) },
    },
  };
  if(fila.length) agenda(1500);
  return R;
}
