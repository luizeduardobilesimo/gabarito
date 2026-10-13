/* ================= conta e acesso (app web em gabarito.rixel.com.br) =================
   Quem decide se a pessoa pode usar o Gabarito é a RIXEL. O navegador não guarda nenhum token da Rixel no caminho principal:
     (A) "Entrar com a Rixel" → /api/rixel/iniciar (PKCE) → Rixel → /api/rixel/callback → cookie HttpOnly da sessão do Gabarito.
         Abrir o Gabarito sem sessão inicia esse fluxo sozinho (sem clique), exceto na volta de um erro ou depois de "Sair".
     (B) Login direto por e-mail e senha no Auth da Rixel (só se o servidor tiver GABARITO_LOGIN_DIRETO=1): sessão no
         armazenamento padrão do navegador ("gabarito.sessao") e token no cabeçalho Authorization.
   Só vale no app web (host *.rixel.com.br, *.vercel.app, ou localhost com ?nuvem=1). No artifact do claude.ai, em file:// e
   no link somente leitura (#ver=) nada disso roda: o app abre como sempre, sem login, com os estudos no navegador.
   Com acesso: `Repo` passa a ser a nuvem (repo-nuvem.js). Sem DOM no nível superior (testado em tests/nuvem.test.js). */
const AUTH_RIXEL = { url:"https://dolwuqozocfyrutcdbsa.supabase.co", chave:"sb_publishable_ZtZN3PBpHbTNQhcuU7pkzg_4Wn1AUoH", site:"https://rixel.com.br" };
const AUTH = { modo:"local", ativo:false, entrada:null, usuario:null, acesso:null, config:null, aviso:null, pronto:null, tela:null };

/** "nuvem" (app web com login) ou "local" (como sempre). Puro: recebe {protocol, hostname, search, hash}. */
function authModoDe(loc){
  try{
    if(/(^|[#&])ver=/.test(String(loc.hash||""))) return "local";          // link somente leitura: público
    if(!/^https?:$/.test(loc.protocol||"")) return "local";
    const h=String(loc.hostname||"").toLowerCase();
    if(h==="rixel.com.br" || h.endsWith(".rixel.com.br") || h.endsWith(".vercel.app")) return "nuvem";
    if((h==="localhost" || h==="127.0.0.1") && /(^|[?&])nuvem=1(&|$)/.test(String(loc.search||""))) return "nuvem";
  }catch(e){}
  return "local";
}
/** Recursos por plano: a Rixel decide o acesso e as claims não trazem o plano, então tudo é liberado.
    Ponto único para plugar limites no futuro (ex.: pode("pdf"), limite("estudos_max")). */
function pode(recurso){ return true }
function limite(recurso){ return Infinity }

/* ---- mensagens das voltas do servidor (?entrada=…) ---- */
const AUTH_ENTRADA = {
  desligada:"A entrada pela Rixel ainda não foi configurada neste servidor.",
  estado:"O link de entrada não vale mais. Entre de novo.",
  expirada:"O link de entrada expirou. Entre de novo.",
  recusada:"A entrada foi cancelada na Rixel.",
  erro:"Não foi possível concluir a entrada. Tente de novo.",
};
/** lê ?entrada=…&msg=…&saiu=1 (e o retorno de recuperação de senha no hash). Puro. */
function authLeUrl(search, hash){
  const q=new URLSearchParams(String(search||"").replace(/^\?/,"")), h=new URLSearchParams(String(hash||"").replace(/^#/,""));
  return { entrada:q.get("entrada")||"", msg:(q.get("msg")||"").slice(0,200), saiu:q.get("saiu")==="1",
    recuperacao: h.get("type")==="recovery" && h.get("access_token")? { token:h.get("access_token"), refresh:h.get("refresh_token")||"" } : null };
}

/* ---- caminho B: cliente mínimo do Auth (GoTrue) da Rixel ---- */
async function authGoTrue(caminho, corpo, o={}){
  const h={ apikey:AUTH_RIXEL.chave, "Content-Type":"application/json" };
  if(o.token) h.Authorization="Bearer "+o.token;
  const r=await fetch(AUTH_RIXEL.url+"/auth/v1/"+caminho, { method:o.metodo||"POST", headers:h, body:corpo===undefined? undefined : JSON.stringify(corpo) });
  let j=null; try{ j=await r.json() }catch(e){}
  if(!r.ok){ const e=new Error(j && (j.error_description||j.msg||j.message) || ("HTTP "+r.status)); e.status=r.status; e.corpo=j; throw e }
  return j;
}
const authSessaoLocal = ()=> LS.get("gabarito.sessao");
function authGuardaSessao(s){
  if(!s || !s.access_token){ try{ localStorage.removeItem("gabarito.sessao") }catch(e){} return null }
  const v={ access_token:s.access_token, refresh_token:s.refresh_token, expires_at: s.expires_at || (Math.floor(Date.now()/1000)+(s.expires_in||3600)) };
  try{ localStorage.setItem("gabarito.sessao", JSON.stringify(v)) }catch(e){}
  return v;
}
/** token válido do login direto (renova 60 s antes de vencer); null se não houver */
async function authToken(){
  let s=authSessaoLocal(); if(!s || !s.access_token) return null;
  if(s.expires_at*1000 - Date.now() < 60000){
    try{ s=authGuardaSessao(await authGoTrue("token?grant_type=refresh_token", { refresh_token:s.refresh_token })) }
    catch(e){ if(e.status && e.status<500) authGuardaSessao(null); return null }
  }
  return s && s.access_token;
}

/* ---- chamadas à API do Gabarito ---- */
async function authApi(metodo, caminho, corpo){
  const h={ Accept:"application/json", "X-Gabarito":"1" };
  if(corpo!==undefined) h["Content-Type"]="application/json";
  if(AUTH.entrada==="rixel"){ const t=await authToken(); if(t) h.Authorization="Bearer "+t }
  const r=await fetch(caminho, { method:metodo, headers:h, credentials:"same-origin", body:corpo===undefined? undefined : JSON.stringify(corpo) });
  let j=null; try{ j=await r.json() }catch(e){}
  if(!r.ok){
    const e=new Error(j && j.motivo || ("HTTP "+r.status)); e.status=r.status; e.corpo=j;
    if(AUTH.ativo && (r.status===401 || (r.status===403 && j && j.erro==="sem_acesso"))) authCaiu(j);
    throw e;
  }
  return j;
}

/* ================= tela de entrada ================= */
const AUTH_MARCA = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="13" width="5" height="8" rx="1" fill="var(--ink)" opacity=".3"/><rect x="9.5" y="7" width="5" height="14" rx="1" fill="var(--ink)" opacity=".6"/><rect x="16" y="3" width="5" height="18" rx="1" fill="var(--accent)"/><path d="M2 21.5h20" stroke="var(--mark)" stroke-width="1.6" stroke-linecap="round"/></svg>';
function authCaixa(){
  let el=document.getElementById("authTela");
  if(!el){
    el=document.createElement("div"); el.id="authTela"; el.className="auth"; el.setAttribute("role","dialog"); el.setAttribute("aria-modal","true"); el.setAttribute("aria-labelledby","authTit");
    document.body.appendChild(el);
    el.addEventListener("click", authClique); el.addEventListener("submit", authEnvia);
  }
  return el;
}
function authTela(estado, o={}){
  AUTH.tela=estado;
  const el=authCaixa(), cfg=AUTH.config||{}, direto=!!cfg.loginDireto;
  const msg = o.msg? `<p class="auth-msg${o.ok? " ok" : ""}" role="status">${esc(o.msg)}</p>` : "";
  const roda = t=>`<div class="auth-roda" role="status"><span class="auth-spin" aria-hidden="true"></span><span>${t}</span></div>`;
  const rixel = (rot="Entrar com a Rixel")=>`<button type="button" class="btn pri full auth-b" data-auth="rixel">${rot}</button>`;
  const planos = `<a class="btn full auth-b" href="${AUTH_RIXEL.site}" target="_blank" rel="noopener">Ver planos na Rixel</a>`;
  const formDireto = !direto? "" : `<div class="auth-ou"><span>ou com e-mail e senha</span></div>
    <form class="auth-f" data-auth="login" novalidate>
      <label class="fld"><span class="fl">E-mail</span><span class="inp"><input class="t" type="email" name="email" autocomplete="username" required></span></label>
      <label class="fld"><span class="fl">Senha</span><span class="inp"><input class="t" type="password" name="senha" autocomplete="current-password" required></span></label>
      <button type="submit" class="btn full auth-b">Entrar</button>
      <button type="button" class="btn ghost sm auth-lk" data-auth="esqueci">Esqueci a senha</button>
    </form>`;
  const corpo = {
    entrando: ()=> roda("Conferindo o seu acesso…"),
    redirecionando: ()=> `<h1 id="authTit">Entrar no Gabarito</h1>` + roda("Levando você para a Rixel…"),
    login: ()=> `<h1 id="authTit">Entrar no Gabarito</h1><p class="auth-sub">Use a sua conta da comunidade Rixel.</p>${msg}${cfg.lancamento===false && direto? "" : rixel()}${formDireto}
      <p class="auth-pe">Ainda não é membro? <a href="${AUTH_RIXEL.site}" target="_blank" rel="noopener">Conheça a Rixel</a></p>`,
    expirada: ()=> `<h1 id="authTit">Sua sessão terminou</h1><p class="auth-sub">Entre de novo para continuar de onde parou.</p>${msg}${rixel()}${formDireto}`,
    semAcesso: ()=> `<div class="auth-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/></svg></div>
      <h1 id="authTit">Sem acesso ao Gabarito</h1><p class="auth-sub">${esc(o.motivo || "A sua conta da Rixel ainda não inclui o Gabarito.")}</p>
      ${planos}<div class="auth-lin"><button type="button" class="btn ghost sm" data-auth="tentar">Tentar de novo</button><button type="button" class="btn ghost sm" data-auth="sair">Entrar com outra conta</button></div>`,
    erro: ()=> `<h1 id="authTit">Não foi possível conectar</h1><p class="auth-sub">${esc(o.motivo || "O servidor do Gabarito não respondeu.")}</p><button type="button" class="btn pri full auth-b" data-auth="tentar">Tentar de novo</button>`,
    esqueci: ()=> `<h1 id="authTit">Recuperar a senha</h1><p class="auth-sub">Enviamos um link para o seu e-mail da Rixel.</p>${msg}
      <form class="auth-f" data-auth="esqueci" novalidate><label class="fld"><span class="fl">E-mail</span><span class="inp"><input class="t" type="email" name="email" autocomplete="username" required></span></label>
      <button type="submit" class="btn pri full auth-b">Enviar link</button><button type="button" class="btn ghost sm auth-lk" data-auth="voltar">Voltar</button></form>`,
    novaSenha: ()=> `<h1 id="authTit">Nova senha</h1><p class="auth-sub">Escolha a nova senha da sua conta da Rixel.</p>${msg}
      <form class="auth-f" data-auth="novaSenha" novalidate><label class="fld"><span class="fl">Nova senha</span><span class="inp"><input class="t" type="password" name="senha" autocomplete="new-password" minlength="8" required></span></label>
      <button type="submit" class="btn pri full auth-b">Salvar e entrar</button></form>`,
  }[estado]||(()=> "");
  el.innerHTML = `<div class="auth-card"><div class="auth-marca">${AUTH_MARCA}<span>Gabarito</span></div>${corpo()}</div><p class="auth-rod">Gabarito · ferramenta da comunidade Rixel</p>`;
  el.hidden=false; document.documentElement.classList.add("auth-on");
  const f=el.querySelector("input"); if(f) setTimeout(()=>{ try{ f.focus() }catch(e){} }, 30);
}
function authFecha(){ const el=document.getElementById("authTela"); if(el){ el.hidden=true; el.innerHTML="" } document.documentElement.classList.remove("auth-on"); AUTH.tela=null }
function authVaiRixel(){ authTela("redirecionando"); location.assign("/api/rixel/iniciar") }

async function authClique(e){
  const b=e.target.closest("[data-auth]"); if(!b || b.tagName==="FORM") return;
  const a=b.dataset.auth;
  if(a==="rixel") authVaiRixel();
  else if(a==="esqueci") authTela("esqueci");
  else if(a==="voltar") authTela("login");
  else if(a==="tentar") authTenta();
  else if(a==="sair") authSair();
}
async function authEnvia(e){
  const f=e.target.closest("form[data-auth]"); if(!f) return; e.preventDefault();
  const d=Object.fromEntries(new FormData(f)), bt=f.querySelector('button[type="submit"]'); if(bt) bt.disabled=true;
  try{
    if(f.dataset.auth==="login"){
      if(!d.email || !d.senha) throw new Error("Informe o e-mail e a senha.");
      authGuardaSessao(await authGoTrue("token?grant_type=password", { email:String(d.email).trim(), password:d.senha }));
      await authTenta();
    } else if(f.dataset.auth==="esqueci"){
      if(!d.email) throw new Error("Informe o e-mail.");
      await authGoTrue("recover?redirect_to="+encodeURIComponent(location.origin+"/"), { email:String(d.email).trim() });
      authTela("login", { msg:"Se o e-mail estiver cadastrado na Rixel, o link chega em instantes.", ok:true });
    } else if(f.dataset.auth==="novaSenha"){
      if(!d.senha || String(d.senha).length<8) throw new Error("Use pelo menos 8 caracteres.");
      const s=AUTH.recuperacao; await authGoTrue("user", { password:d.senha }, { token:s.token, metodo:"PUT" });
      authGuardaSessao({ access_token:s.token, refresh_token:s.refresh, expires_in:3000 }); AUTH.recuperacao=null;
      await authTenta();
    }
  }catch(err){
    const m = err && err.status===400 && f.dataset.auth==="login"? "E-mail ou senha incorretos." : (err && err.message || "Não foi possível concluir.");
    authTela(AUTH.tela||"login", { msg:m });
  }
}

/* ================= decisão ================= */
/** chamado por main.js antes de abrir os estudos; resolve quando o app pode seguir */
function authInit(){
  AUTH.modo = authModoDe(location);
  if(AUTH.modo!=="nuvem") return Promise.resolve(false);
  const u=authLeUrl(location.search, location.hash);
  AUTH.aviso=u; AUTH.recuperacao=u.recuperacao;
  if(u.entrada || u.saiu || u.recuperacao){ try{ history.replaceState(null, "", location.pathname) }catch(e){} }
  return new Promise(res=>{ AUTH.pronto=res; authTenta() });
}
async function authTenta(){
  authTela("entrando");
  if(!AUTH.config){ try{ const r=await fetch("/api/saude", { credentials:"same-origin" }); AUTH.config=(await r.json()).config||{} }catch(e){ return authTela("erro", { motivo:"O servidor do Gabarito não respondeu. Verifique a conexão." }) } }
  const u=AUTH.aviso||{};
  if(AUTH.recuperacao && AUTH.config.loginDireto) return authTela("novaSenha");
  AUTH.entrada = AUTH.config.loginDireto && authSessaoLocal()? "rixel" : "produto";
  let eu=null, err=null;
  try{ eu=await authApi("GET", "/api/eu") }catch(e){ err=e }
  if(err && AUTH.entrada==="rixel" && err.status===401){ authGuardaSessao(null); AUTH.entrada="produto"; err=null; try{ eu=await authApi("GET", "/api/eu") }catch(e){ err=e } }
  if(err){
    const c=err.corpo||{};
    if(err.status===401 && c.erro==="sem_acesso") return authTela("semAcesso", { motivo:c.motivo });
    if(err.status===401 && c.erro==="sessao_expirada") return authTela("expirada", { msg:c.motivo });
    if(err.status===401){
      if(u.entrada==="sem_acesso") return authTela("semAcesso", { motivo:u.msg });
      if(u.entrada) return authTela("login", { msg:u.msg || AUTH_ENTRADA[u.entrada] || AUTH_ENTRADA.erro });
      if(!u.saiu && AUTH.config.lancamento) return authVaiRixel();            // abriu pela Rixel (destino) sem sessão: segue sozinho
      return authTela("login", u.saiu? { msg:"Você saiu do Gabarito.", ok:true } : {});
    }
    return authTela("erro", { motivo:c.motivo });
  }
  if(!eu.acesso || !eu.acesso.ok) return authTela("semAcesso", { motivo:eu.acesso && eu.acesso.motivo });
  AUTH.aviso=null;
  await authLiberado(eu);
}
/** acesso confirmado: troca o repositório, mostra a conta no topo e segue para os estudos */
async function authLiberado(eu){
  AUTH.ativo=true; AUTH.usuario=eu.usuario; AUTH.acesso=eu.acesso;
  const sub=eu.usuario.id, ant=LS.get("gabarito.nuvem.dono");
  if(ant && ant!==sub){
    // outra pessoa entrou neste navegador: a cópia de trabalho do anterior não vai para a conta desta
    S=merge(clone(DEF), {}); LS.set("gabarito.v2", S); try{ localStorage.removeItem("gabarito.estudo") }catch(e){}
    const pn=document.getElementById("projName"); if(pn) pn.value=S.nome;
    try{ renderTab(); fit3d(); fit2d(); histReset() }catch(e){}
  }
  LS.set("gabarito.nuvem.dono", sub);
  const nuvem=repoNuvem(RepoLocal, authApi, { dono:sub, autor:eu.usuario.nome||eu.usuario.email||"", avisa:m=>toast(m) });
  // o estudo aberto, se ainda só existe neste navegador, vai para a nuvem com o mesmo id (o resto é oferecido depois)
  try{
    await RepoLocal.pronto();
    const id=LS.get("gabarito.estudo"), rec=id? await RepoLocal.estudos.get(id) : null;
    if(rec && !rec.nuvem){ await nuvem.estudos.put({ ...rec, S:clone(S), nome:S.nome||rec.nome }); for(const v of await authVersoesLocais(id)) await nuvem.versoes.put(v) }
  }catch(e){ console.warn("[auth] estudo aberto não migrou", e) }
  Repo=nuvem;
  authConta(); authFecha();
  window.addEventListener("online", ()=>Repo.sincroniza && Repo.sincroniza());
  if(AUTH.pronto){ const p=AUTH.pronto; AUTH.pronto=null; p(true) }
}
async function authVersoesLocais(estudoId){ const out=[]; for(const v of await RepoLocal.versoes.list(estudoId)){ const f=await RepoLocal.versoes.get(v.id); if(f && !f.nuvem) out.push(f) } return out }
/** a sessão caiu no meio do uso (401/403): mostra a tela por cima, sem perder o que está na tela */
function authCaiu(c){
  c=c||{};
  if(c.erro==="sem_acesso") authTela("semAcesso", { motivo:c.motivo });
  else authTela("expirada", { msg:c.motivo });
}
async function authSair(){
  try{ if(EST.pronto) await estGrava() }catch(e){}
  try{ if(Repo.sincroniza) await Promise.race([Repo.sincroniza(), new Promise(r=>setTimeout(r,4000))]) }catch(e){}
  try{ await fetch("/api/rixel/sair", { method:"POST", headers:{ "X-Gabarito":"1" }, credentials:"same-origin" }) }catch(e){}
  const s=authSessaoLocal(); if(s){ try{ await authGoTrue("logout", {}, { token:s.access_token }) }catch(e){} authGuardaSessao(null) }
  location.replace("/?saiu=1");
}

/* ================= conta no topo ================= */
const authIniciais = n=> String(n||"").trim().split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0].toUpperCase()).join("") || "R";
function authConta(){
  const acts=document.querySelector(".top .acts"); if(!acts || document.getElementById("authConta")) return;
  const u=AUTH.usuario||{}, nome=u.nome||u.email||"Membro Rixel";
  const d=document.createElement("div"); d.className="conta"; d.id="authConta";
  d.innerHTML = `<button type="button" class="btn ghost conta-b" id="authContaBtn" aria-haspopup="true" aria-expanded="false" title="${esc(nome)}">
      <span class="conta-av" aria-hidden="true">${esc(authIniciais(u.nome||u.email))}</span><span class="conta-n"><b>${esc(nome)}</b><small>Rixel</small></span></button>
    <div class="conta-m" id="authMenu" role="menu" hidden>
      <div class="conta-q"><b>${esc(nome)}</b>${u.email && u.email!==nome? `<span>${esc(u.email)}</span>` : ""}<span class="pill ok">acesso pela Rixel</span></div>
      <button type="button" class="conta-i" role="menuitem" data-auth-m="migrar" id="authMigrarBtn" hidden>Enviar estudos deste navegador</button>
      <a class="conta-i" role="menuitem" href="${AUTH_RIXEL.site}" target="_blank" rel="noopener">Minha conta na Rixel</a>
      <button type="button" class="conta-i" role="menuitem" data-auth-m="sair">Sair</button>
    </div>`;
  acts.insertBefore(d, acts.firstChild);
  const btn=d.querySelector("#authContaBtn"), menu=d.querySelector("#authMenu");
  const abre=v=>{ menu.hidden=!v; btn.setAttribute("aria-expanded", String(!!v)) };
  btn.addEventListener("click", e=>{ e.stopPropagation(); abre(menu.hidden) });
  document.addEventListener("click", e=>{ if(!d.contains(e.target)) abre(false) });
  document.addEventListener("keydown", e=>{ if(e.key==="Escape") abre(false) });
  menu.addEventListener("click", e=>{ const b=e.target.closest("[data-auth-m]"); if(!b) return; abre(false); if(b.dataset.authM==="sair") authSair(); else if(b.dataset.authM==="migrar") authMigrar() });
}

/* ================= migração: estudos deste navegador → nuvem ================= */
async function authLocais(){ try{ return (await RepoLocal.estudos.list()).filter(e=>!e.nuvem) }catch(e){ return [] } }
/** depois de abrir os estudos: oferece uma vez enviar o que só existe neste navegador */
async function authDepois(){
  if(!AUTH.ativo) return;
  const l=await authLocais(), b=document.getElementById("authMigrarBtn"); if(b) b.hidden=!l.length;
  if(!l.length || LS.get("gabarito.nuvem.migracao."+AUTH.usuario.id)) return;
  authOferta(l.length);
}
function authOferta(n){
  let el=document.getElementById("authOferta");
  if(!el){ el=document.createElement("div"); el.id="authOferta"; el.className="auth-oferta"; el.setAttribute("role","dialog"); el.setAttribute("aria-labelledby","authOfTit"); document.body.appendChild(el) }
  el.innerHTML = `<b id="authOfTit">Estudos neste navegador</b><p class="note">Há ${n===1? "1 estudo" : n+" estudos"} salvo${n===1?"":"s"} só neste navegador. Enviar para a sua conta?</p>
    <div class="auth-lin"><button type="button" class="btn ghost sm" data-of="nao">Agora não</button><button type="button" class="btn pri sm" data-of="sim">Enviar para a nuvem</button></div>`;
  el.hidden=false;
  el.onclick=async e=>{ const b=e.target.closest("[data-of]"); if(!b) return; LS.set("gabarito.nuvem.migracao."+AUTH.usuario.id, true); el.hidden=true; if(b.dataset.of==="sim") await authMigrar() };
}
async function authMigrar(){
  const l=await authLocais(); let n=0;
  for(const e of l){
    try{
      const rec=await RepoLocal.estudos.get(e.id); if(!rec) continue;
      const vs=await authVersoesLocais(e.id);
      await Repo.estudos.put({ ...rec }); for(const v of vs) await Repo.versoes.put(v); n++;
    }catch(err){ console.warn("[auth] não migrou", e.id, err) }
  }
  const b=document.getElementById("authMigrarBtn"); if(b) b.hidden=true;
  try{ await estRefresh() }catch(e){}
  toast(n? (n===1? "1 estudo enviado para a nuvem" : n+" estudos enviados para a nuvem") : "Nada para enviar");
}
