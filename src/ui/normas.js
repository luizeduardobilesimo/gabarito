/* ================= biblioteca de cidades (Terreno) e checklist de normas (Projeto) — itens 2.5 e "mais cidades" =================
   Lê src/calc/cidades.js e src/calc/normas.js. As normas são só leitura: nada aqui muda números do estudo.
   UX v3 (P2): o seletor de cidade mora em Terreno › Regras da prefeitura; o checklist vira a seção normasSecHTML()
   ("Saídas e acessibilidade", chave nrmList) que o Projeto › Andares mostra (pacote P4). Enquanto o Projeto não a chama,
   um card reserva (addCard projeto/tipo) a mostra no mesmo lugar. normasLive(m, fast) atualiza a lista e o resumo. */
let CID_UNDO = null; // {regras, ref, nome} — desfazer a última aplicação de regras de cidade
(function(){ const s=document.createElement("style"); s.textContent=`
.nrm-aviso{border:1px solid var(--warn);background:color-mix(in srgb,var(--warn) 9%,var(--surface));color:var(--ink-2);border-radius:9px;padding:7px 10px;font-size:11.5px;line-height:1.45}
.nrm-aviso b{color:var(--warn);font-weight:600}
.nrm-res{display:flex;gap:6px;flex-wrap:wrap}
.nrm-g{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:6px 0 2px;font-weight:600}
.nrm-it{border:1px solid var(--line);border-radius:10px;background:var(--surface-2)}
.nrm-it+.nrm-it{margin-top:6px}
.nrm-it>summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;padding:8px 10px}
.nrm-it>summary::-webkit-details-marker{display:none}
.nrm-it .tt{font-size:12.5px;font-weight:500}
.nrm-it .vv{font-size:11px;color:var(--muted);font-family:var(--f-mono);margin-top:1px}
.nrm-it .bd{padding:0 10px 9px 27px;display:grid;gap:4px;font-size:11.5px;color:var(--ink-2);line-height:1.45}
.nrm-it .bd .src{color:var(--muted);font-size:10.5px}
.nrm-st{font-size:10.5px;font-family:var(--f-mono);white-space:nowrap}
.nrm-st.ok{color:var(--ok)} .nrm-st.warn{color:var(--warn)} .nrm-st.bad{color:var(--bad)} .nrm-st.na{color:var(--muted)}
.dot.na{background:var(--line-2)}
.cid-ref{display:grid;gap:2px;border-left:2px solid var(--line-2);padding:2px 0 2px 10px;margin:8px 0 2px}
.cid-undo{margin-top:4px}
.cid-sel+.kv,.cid-ref+.kv,.cid-undo+.kv{margin-top:12px}
.nrm-top{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px}
`; document.head.appendChild(s) })();

/* ---------- cidade e zona (Terreno › Regras da prefeitura) ----------
   cidSeletorHTML() → seletor "Aplicar regras de…" (#cidLib), a referência da lei (aviso ilustrativo) e "Desfazer"
   cidSalvarHTML()  → botão "Salvar na biblioteca" (vai em "Mais regras" › Nome e lei)
   cidadesCardHTML() → os dois juntos (compatibilidade) */
function cidSeletorHTML(){
  const lista=cidadesLista(), ref=S.regrasRef||{}, grupos={};
  lista.forEach(c=>{ (grupos[c.fonteNome]=grupos[c.fonteNome]||[]).push(c) });
  const sel=`<select class="sel" id="cidLib" aria-label="Aplicar regras de uma cidade" style="flex:1;min-width:0"><option value="">${ref.id? "Trocar cidade e zona…" : "Aplicar regras de…"}</option>${Object.entries(grupos).map(([g,l])=>`<optgroup label="${esc(g)}">${l.map(c=>`<option value="${esc(c.id)}">${esc(cidadeRotulo(c))}</option>`).join("")}</optgroup>`).join("")}</select>`;
  const info = ref.id? `<div class="cid-ref"><span class="note"><b style="color:var(--ink)">${esc(S.regras.cidade)}</b>${ref.lei?` · ${esc(ref.lei)}`:""}${ref.data&&ref.data!=="—"?` · ${esc(ref.data)}`:""}</span>
      ${ref.ilustrativo? `<span class="note" style="color:var(--warn)">Valores ilustrativos ${INFO(CIDADES_AVISO)}</span>` : `<span class="note">Da sua biblioteca ${INFO("Regras salvas neste navegador. Confira se continuam vigentes.")}</span>`}</div>` : "";
  return `<div class="row cid-sel" data-q="cidade zona lei plano diretor aplicar regras" style="flex-wrap:nowrap">${sel}${INFO("Escolha a cidade e a zona do lote para preencher as regras de uma vez. Os exemplos são ilustrativos: confira no plano diretor (LUOS). Ctrl+Z ou “Desfazer” voltam às regras anteriores.","cidade e zona")}</div>` + info +
    (CID_UNDO? `<div class="row sb cid-undo" style="flex-wrap:nowrap"><span class="note">Antes: ${esc(CID_UNDO.regras.cidade||"regras anteriores")}</span><button class="btn sm ghost" data-act="cidUndo">Desfazer</button></div>` : "");
}
function cidSalvarHTML(){ return `<button class="btn sm" data-act="cidSave" title="Guardar as regras atuais na biblioteca deste navegador">Salvar na biblioteca</button>` }
function cidadesCardHTML(){ return cidSeletorHTML() + `<div class="row">${cidSalvarHTML()}</div>` }
TB.addEventListener("change", e=>{
  if(e.target.id!=="cidLib" || !e.target.value) return;
  const c=cidadeAcha(e.target.value); if(!c) return;
  const und=cidadeAplicar(S, c); CID_UNDO={...und, nome:cidadeRotulo(c)};
  renderTab(); toast(c.ilustrativo? "Regras de exemplo aplicadas — confira na lei municipal" : "Regras aplicadas: "+cidadeRotulo(c));
});
Object.assign(ACT, {
  cidUndo: ()=>{ if(!CID_UNDO) return; cidadeDesfazer(S, CID_UNDO); CID_UNDO=null; renderTab(); toast("Regras anteriores restauradas") },
  cidSave: ()=>{ const ref=S.regrasRef||{}, nome=S.regras.cidade||"Sem nome";
    cidadeSalvarLocal({nome, cidade:nome, lei:ref.ilustrativo? "" : ref.lei, data:ref.ilustrativo? "" : ref.data, fonte:"usuário", regras:clone(S.regras)});
    toast("Regras salvas na biblioteca: "+nome); renderTab() },
});

/* ---------- checklist de normas ---------- */
const NRM_ST = {ok:"atende", warn:"atenção", bad:"não atende", na:"não se aplica"};
let NRM_EXT = false;   // true quando outra etapa (Projeto, P4) já põe a seção no corpo: o card reserva some
const nrmOpcSum = ()=>{ const N=S.normas||{}; return `${N.chuveiros? "com chuveiros" : "sem chuveiros"} · rota ${N.rotaFuga? "visível" : "oculta"}` };
function nrmSecHTML_(){
  return SEC("Saídas e acessibilidade", `<div class="nrm-top"><span class="pill warn">preliminar</span><span id="nrmRes" class="nrm-res"></span>${INFO("Saídas de emergência (IN 09 do CBMSC, com referência na NBR 9077) e acessibilidade (NBR 9050, LBI) conferidas no estudo atual. É um checklist de estudo: confira com a norma vigente e o projetista; não substitui o projeto de prevenção e o de acessibilidade. Toque num item para ver o exigido, o porquê e a fonte.","o checklist de normas")}</div>`
    + `<div id="nrmList"><p class="note">Calculando…</p></div>`
    + ADV(`<div data-q="chuveiros sprinklers automáticos">${SW("normas.chuveiros","Edificação com chuveiros automáticos")}</div><div data-q="rota fuga escada pavimento tipo">${SW("normas.rotaFuga","Rota até a escada no pavimento tipo",{fx:"r3n"})}</div><p class="note" id="sum-nrmOpc">${nrmOpcSum()}</p>`, {key:"nrmOpc", label:"Opções"}),
    {key:"nrmList", sum:"preliminar", info:"Saídas de emergência (IN 09) e acessibilidade (NBR 9050), conferidas no núcleo e na garagem desenhados. Preliminar."});
}
/* seção "Saídas e acessibilidade" para o Projeto › Andares (P4). Chamada no corpo da etapa, desliga o card reserva. */
function normasSecHTML(){ NRM_EXT=true; return nrmSecHTML_() }
function normasCardHTML(){ return nrmSecHTML_() }   // compatibilidade
addCard("projeto", {key:"normas", sub:"tipo", order:80, when:()=>!NRM_EXT, html:()=>nrmSecHTML_(), live:(m,f,fast)=>{ if(!NRM_EXT && document.getElementById("nrmList")) normasLive(m, fast) }});
FX.r3n = ()=>{ save(); redraw2d(); setSum("nrmOpc", nrmOpcSum()); const e=document.getElementById("sum-nrmOpc"); if(e) e.textContent=nrmOpcSum() };
function normasLive(m, fast){
  setSum("nrmOpc", nrmOpcSum()); { const e=document.getElementById("sum-nrmOpc"); if(e) e.textContent=nrmOpcSum() }
  if(fast && document.querySelector("#nrmList .nrm-it")) return; // arrastando: mantém o último (o completo vem logo depois)
  let v; try{ v=normasAvaliar(S, m) }catch(e){ console.error("[normas]", e); setHTML("nrmList", `<p class="note">Não foi possível avaliar as normas neste estudo.</p>`); return }
  const c=normasResumo(v.itens);
  const pill=document.getElementById("nrmPill"); if(pill) pill.innerHTML = c.bad? `<span style="color:var(--bad)">${c.bad} não atende${c.bad>1?"m":""}</span>` : c.warn? `<span style="color:var(--warn)">${c.warn} em atenção</span>` : `<span style="color:var(--ok)">atende</span>`;
  setSum("nrmList", [c.ok&&`${c.ok} atende${c.ok>1?"m":""}`, c.warn&&`<span style="color:var(--warn)">${c.warn} em atenção</span>`, c.bad&&`<span style="color:var(--bad)">${c.bad} não atende${c.bad>1?"m":""}</span>`].filter(Boolean).join(" · ") || "preliminar");
  setHTML("nrmRes", ["ok","warn","bad"].filter(k=>c[k]).map(k=>`<span class="pill ${k}">${c[k]} ${NRM_ST[k]}</span>`).join("") + `<span class="pill">h = ${nf(v.h,1)} m</span>`);
  const open=new Set([...document.querySelectorAll("#nrmList details[open]")].map(d=>d.dataset.id));
  setHTML("nrmList", NORMAS_GRUPOS.map(g=>{ const l=v.itens.filter(x=>x.grupo===g); if(!l.length) return "";
    return `<div class="nrm-g">${g}</div>` + l.map(x=>`<details class="nrm-it" data-id="${x.id}" ${open.has(x.id)?"open":""}><summary><span class="dot ${x.status}"></span><div><div class="tt">${esc(x.titulo)}</div><div class="vv">${esc(x.valor)}</div></div><span class="nrm-st ${x.status}">${NRM_ST[x.status]}</span></summary>
      <div class="bd"><div><b>Exigido:</b> ${esc(x.exigido)}</div><div>${esc(x.porque)}</div><div class="src">Fonte: ${esc(x.fonte.norma)} — ${esc(x.fonte.item)} · preliminar</div></div></details>`).join("") }).join(""));
}
/* rota até a escada desenhada no pavimento tipo (só quando ligada) */
HOOK.draw2d.push((g, ctx)=>{
  if(ctx.mode!=="tipo" || !S.normas || !S.normas.rotaFuga || !ctx.m.tipo) return;
  const i=(ctx.opt&&ctx.opt.tower)||0, r=normaDistTipo(ctx.m.tipo[i]); if(!r || !r.caminho || r.caminho.length<2) return;
  const col=getComputedStyle(document.documentElement).getPropertyValue("--d-acc").trim()||"#2f6fed";
  g.save(); g.strokeStyle=col; g.lineWidth=2.4; g.setLineDash([7,4]); g.lineCap="round"; g.beginPath();
  r.caminho.forEach((p,k)=>{ const s=ctx.w2s(p); if(k) g.lineTo(s[0],s[1]); else g.moveTo(s[0],s[1]) }); g.stroke(); g.setLineDash([]);
  const a=ctx.w2s(r.caminho[0]); g.fillStyle=col; g.beginPath(); g.arc(a[0],a[1],4.5,0,7); g.fill();
  g.font="600 11px "+(getComputedStyle(document.documentElement).getPropertyValue("--f-mono")||"monospace"); g.textAlign="left"; g.textBaseline="bottom";
  const t=`${nf(r.max,1)} m até a escada`, w=g.measureText(t).width; g.fillStyle=getComputedStyle(document.documentElement).getPropertyValue("--surface").trim()||"#fff";
  g.globalAlpha=0.92; g.fillRect(a[0]+5, a[1]-21, w+8, 17); g.globalAlpha=1; g.fillStyle=col; g.fillText(t, a[0]+9, a[1]-7); g.restore();
});
