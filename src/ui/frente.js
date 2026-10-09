/* ================= ruas → frentes (interface; cálculo em src/calc/frente.js) =================
   Card "Lados e frentes" (etapa Terreno): botão "Detectar frentes pelas ruas" → mostra, por lado, a rua e a largura estimada (editável)
   e a sugestão (frentes, principal, acesso de veículos). NADA muda no lote até o usuário clicar em "Aplicar sugestão" (Ctrl+Z desfaz).
   Sem contexto do OSM carregado, busca primeiro (mapaEntorno, com a busca resiliente). Sem georreferência, pede para posicionar o lote. */
const FR = { msg:"", busy:false, princ:null };
const FR_TIPO = { uma:"Uma frente", esquina:"Lote de esquina", passante:"Lote passante", varias:"Várias frentes" };
const frSug = () => (typeof frenteValida==="function" && S.frentes && frenteValida(S)) ? S.frentes.sug : null;
const frNome = l => l.nome || frNomeClasse(l.classe);
const frCurto = (t, n=26) => { t=String(t||""); return t.length>n? t.slice(0,n-1)+"…" : t };
/* informação do lado i na lista de lados: {k: posição em sug.lados, l: lado} */
function frLadoInfo(i){ const s=frSug(); if(!s) return null; const k=s.lados.findIndex(l=>l.i===i); return k<0? null : {k, l:s.lados[k]} }
function frLadoCampo(i){
  const f=frLadoInfo(i); if(!f) return "";
  return `<div class="fld"><label class="fl" for="lado-lv-${i}">Largura da via${INFO("Largura da pista (sem calçada). Quando o OpenStreetMap não traz a largura, ela é estimada pela classe da via (e por vagas na rua); corrija aqui se souber o valor.")}</label><div class="inp"><input id="lado-lv-${i}" type="number" step="0.5" min="2" max="60" data-p="frentes.sug.lados.${f.k}.larg" data-min="2" data-max="60" data-fx="upd" value="${f.l.larg}"><em>m</em></div><div class="fsub">${f.l.est? "estimada pela classe" : "medida no OSM"}</div></div>`;
}
function frLadoTag(i){ const f=frLadoInfo(i); return f? `<i>${esc(frCurto(frNome(f.l),22))} · ${nf(f.l.larg,1)} m</i>` : "" }

function frResumo(s){
  let t=`${FR_TIPO[s.tipo]||"Frentes"} · principal L${s.principal+1}`;
  if(s.acesso && s.front.length>1 && s.acesso.menor) t+=` · veículos pela L${s.acesso.i+1}`;
  return t;
}
function frIgual(s){ const L=S.lote, a=L.front.slice().sort((x,y)=>x-y).join(), b=s.front.slice().sort((x,y)=>x-y).join(); return a===b && L.principal===(FR.princ ?? s.principal) }
function frRegraHTML(){
  const R=S.frentes.regra;
  return ADV(`<div class="row">${SW("frentes.regra.on","Recuo pela largura da via",{rr:true})}${INFO("Opcional e desligado por padrão. Ao aplicar a sugestão, cada frente recebe o recuo da faixa que comporta a largura da via (recuo próprio do lado). Os valores da tabela são ILUSTRATIVOS: confira na lei do município e ajuste.")}</div>`
    + (R.on? `<p class="note">Valores ilustrativos — conferir na lei.</p>` + R.tab.map((r,k)=>KV(NUM(`frentes.regra.tab.${k}.ate`, "Via de até", "m", {step:0.5, min:1, fx:"upd"}) + NUM(`frentes.regra.tab.${k}.rec`, "Recuo frontal", "m", {step:0.25, min:0, fx:"upd"}))).join("") : ""),
    {key:"frentes", label:"Mais opções"});
}
function frHTML(){
  const s=frSug(), geo=!!S.lote.geo;
  const btn=`<button class="btn sm${s?"":" pri"}" data-act="frDetectar" ${FR.busy?"disabled":""}>${FR.busy? "Buscando…" : s? "Detectar de novo" : "Detectar frentes pelas ruas"}</button>${INFO("Lê as ruas do OpenStreetMap junto ao lote e propõe quais lados são frente, qual é a principal (via de maior hierarquia), se o lote é de esquina ou passante e por qual rua deve entrar o carro (a de menor hierarquia). O modelo põe o acesso de veículos na frente principal: para entrar por outra rua, escolha-a como principal. Nada muda até você aplicar. A largura da via é estimada pela classe e pode ser corrigida em cada lado.")}`;
  let h=`<div class="row" style="flex-wrap:wrap;align-items:center;gap:8px;margin-top:8px">${btn}${s? `<button class="btn sm ghost" data-act="frDescartar" title="Descartar a proposta">Descartar</button>` : ""}</div>`;
  if(FR.msg) h+=`<p class="note" id="frMsg">${esc(FR.msg)}</p>`;
  else if(!geo && !s) h+=`<p class="note" id="frMsg">Posicione o lote no mapa para detectar.</p>`;
  if(s){
    const igual=frIgual(s), cand=s.front.length>1? s.front.map(i=>s.lados.find(l=>l.i===i)).filter(Boolean) : [];
    h+=`<p class="note" id="frSum">${frResumo(s)}</p>`;
    if(cand.length>1) h+=`<div class="seg full" role="group" aria-label="Frente principal">${cand.map(l=>`<button type="button" data-act="frPrinc" data-i="${l.i}" aria-pressed="${(FR.princ ?? s.principal)===l.i}" title="Frente principal: lojas, hall e acessos" style="padding:5px 4px">L${l.i+1} · ${esc(frCurto(frNome(l),16))}</button>`).join("")}</div>`;
    h+=`<div class="row" style="margin-top:8px">${igual? `<span class="note" style="margin:0">As frentes já seguem a sugestão.</span>` : `<button class="btn pri" data-act="frAplicar">Aplicar sugestão</button>`}</div>`;
    h+=frRegraHTML();
  }
  return h;
}
function frAtualiza(){ const e=document.getElementById("frBox"); if(e && !(e.contains(document.activeElement) && document.activeElement.tagName==="INPUT")) e.innerHTML=frHTML() }
/* progresso vindo da busca do OSM (mapaMsg) enquanto a detecção espera */
function frProg(t){ FR.msg=String(t||"").replace(/<button[^]*?<\/button>/g,"").replace(/<br>/g," ").replace(/<[^>]*>/g,"").replace(/&amp;/g,"&"); frAtualiza() }

async function frDetectar(){
  if(FR.busy) return;
  if(!S.lote.geo){ FR.msg="Posicione o lote no mapa primeiro."; mapaSemGeo(); frAtualiza(); return }
  const lat=+S.lote.lat, lon=+S.lote.lon, norte=S.lote.norte;
  FR.busy=true; FR.msg="";
  if(!ctxDadosValem(S.contexto.dados, lat, lon, norte)){ FR.msg="Buscando as ruas no OpenStreetMap…"; frAtualiza(); await mapaEntorno() }
  FR.busy=false;
  const d=S.contexto.dados;
  if(!ctxDadosValem(d, lat, lon, norte)){ FR.msg="Sem dados de ruas. Veja o aviso do OpenStreetMap e tente de novo."; frAtualiza(); return }
  const p=frenteDetectar(S,{quando:d.quando});
  if(!p.front.length){ S.frentes.sug=null; FR.msg=p.semVia? "Os dados do OSM não trazem vias." : "Nenhuma rua junto ao lote (até 10 m da divisa)."; save(); renderTab(); return }
  S.frentes.sug=p; FR.princ=p.principal; FR.msg=""; save(); renderTab();
}
Object.assign(ACT,{
  frDetectar: ()=>{ frDetectar() },
  frDescartar: ()=>{ S.frentes.sug=null; FR.msg=""; FR.princ=null; save(); renderTab(); toast("Proposta descartada") },
  frPrinc: b=>{ FR.princ=+b.dataset.i; frAtualiza() },
  frAplicar: ()=>{ const s=frSug(); if(!s) return;
    const r=frenteAplicar(S, s, {principal:FR.princ}); if(!r){ toast("Nada para aplicar"); return }
    if(typeof LADOAB!=="undefined") LADOAB.clear();
    update(); renderTab(); toast(`Frentes aplicadas: ${r.front.map(i=>"L"+(i+1)).join(" e ")} · principal L${r.principal+1} (Ctrl+Z desfaz)`) },
});
