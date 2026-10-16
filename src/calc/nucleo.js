/* ================= núcleo de circulação vertical (docs/COMUNS.md §1) =================
   Mesmo método das plantas de apartamento (docs/APTOS.md): regras de projeto reais + catálogo de partidos de mercado +
   validação com nota e motivo + desenho técnico fiel. Puro (sem DOM): roda no Worker e nos testes.

   Referencial local do núcleo: u ao longo do corredor (0 → L), v da frente (0, face do corredor/hall) para o fundo.
   Duas fileiras com as MESMAS linhas de eixo (nada de serrilhado): frente (F = 2,20 m: antecâmara, elevadores, serviço —
   tudo abre para o corredor) e fundo (escada de lances paralelos ao corredor, dutos, lixo/DML). A escada termina numa
   linha de eixo da frente; a sobra vira patamar (área de resgate), nunca "dente".
   Medidas = referência genérica (NBR 9077, IN 09 CBMSC, NBR 9050, NBR 16858/NM 207) — conferir na lei.

   API: nucleoCatalogo() · nucleoParams(o) · nucleoMonta(o) (modelo local) · nucleoValida(nuc, ctx) → {nota, problemas}
        nucleoElevNec(ctx) (tráfego simplificado) · coreBuild (src/layout.js) chama nucleoMonta e leva ao mundo. */

extendDEF("nucleo", { partido: "auto", cap: 8 });

const NUC_R = {
  parede: 0.15, paredeCF: 0.20,          // alvenaria comum · parede corta-fogo/estrutural (eixo a eixo, as células já a contêm)
  F: 2.20,                               // fileira da frente (eixo): caixa de elevador 1,85 + paredes; antecâmara 2,00 livre
  escLarg: 1.20, bomba: 0.10,            // largura útil mínima do lance · vão entre lances
  espelho: [0.16, 0.18], piso: [0.28, 0.32], blondel: [0.63, 0.65],
  patamarMax: 2.40,                      // patamar mais longo que isso = área sobrando
  antProf: 1.80, antLarg: 1.20,          // antecâmara: profundidade e largura livres mínimas
  porta: 0.90, portaServ: 0.80, portaShaft: 0.60,
  hallElev: 1.50,                        // livre diante das portas dos elevadores (giro de cadeira de rodas)
  dutoA: 0.70, dutoLado: 0.60,           // seção mínima de cada duto (entrada e saída de ar)
  resgate: [0.80, 1.20],                 // área de resgate (cadeira de rodas) no patamar ou na antecâmara
  areaMaxPct: 0.25,                      // núcleo acima de 25% da laje do tipo = pesado
  fonte: "NBR 9077 · IN 09 CBMSC · NBR 9050 · NBR 16858 (referência — conferir na lei)",
};
/* caixa (interna) e cabine por capacidade — elevadores sem casa de máquinas (MRL); ordem de grandeza de catálogo */
const NUC_ELEV = {
  6:  { cap:6,  kg:450,  caixa:[1.60,1.70], cabine:[1.00,1.25], porta:0.80 },
  8:  { cap:8,  kg:600,  caixa:[1.80,1.85], cabine:[1.10,1.40], porta:0.80 },
  10: { cap:10, kg:750,  caixa:[1.90,2.05], cabine:[1.20,1.50], porta:0.90 },
  13: { cap:13, kg:1000, caixa:[2.10,2.30], cabine:[1.40,1.60], porta:0.90 },
};
const NUC_EMERG = { cap:13, kg:1000, caixa:[2.00,2.50], cabine:[1.10,2.10], porta:1.10 };   // maca: cabine ≥ 1,10 × 2,10

const NUC_CAT = [
  { id:"linear", nome:"Linear com hall de serviço", desc:"Antecâmara e elevadores alinhados no corredor; escada atrás deles; hall de serviço com lixo/DML e shafts na ponta.", quando:"2 elevadores (o mais comum)", fixavel:true },
  { id:"linear-curto", nome:"Linear compacto", desc:"Antecâmara, elevador, DML e shafts abrindo no corredor; escada atrás.", quando:"1 elevador", fixavel:true },
  { id:"u", nome:"Elevadores frente a frente", desc:"Hall dos elevadores perpendicular ao corredor, elevadores dos dois lados; escada no sentido da profundidade.", quando:"3 ou mais elevadores, núcleo central", fixavel:true },
  { id:"l", nome:"Em L", desc:"Escada no sentido da profundidade e ala rasa de elevadores; a unidade vizinha contorna os elevadores.", quando:"laje rasa, núcleo menor", fixavel:true },
  { id:"pressurizada", nome:"Escada pressurizada", desc:"Sem dutos de ventilação: duto de insuflamento na escada e casa de máquinas no térreo ou na cobertura.", quando:"escada PFP" },
  { id:"balcao", nome:"Escada com balcão aberto", desc:"Acesso à escada por um balcão aberto na fachada (dispensa dutos).", quando:"escada PF com balcão" },
  { id:"duas", nome:"Duas escadas", desc:"Uma escada em cada ponta do núcleo, cada uma com a sua antecâmara.", quando:"2 escadas (lâmina longa ou edifício alto)" },
  { id:"emergencia", nome:"Com elevador de emergência", desc:"Elevador de emergência abrindo na antecâmara da escada; os demais no corredor.", quando:"acima de 80 m (ou quando ligado)" },
  { id:"baixo", nome:"Baixo (escada protegida e 1 elevador)", desc:"Hall da escada, um elevador e shafts; sem dutos.", quando:"até 4 pavimentos" },
  { id:"escada2", nome:"Escada isolada", desc:"Segunda escada com a sua antecâmara (núcleo de alas).", quando:"distância a percorrer longa" },
];
function nucleoCatalogo(){ return NUC_CAT.map(c=>({...c})) }
function nucleoNomePartido(id){ const c=NUC_CAT.find(c=>c.id===id); return c? c.nome : id }

/* ---------- parâmetros (degraus pela altura de piso a piso, largura pela população) ---------- */
function nucleoDegraus(pe){
  const h=Math.max(2.4, +pe||3), n=Math.ceil(h/NUC_R.espelho[1]-1e-9), e=h/n;
  const p=Math.round(Math.min(NUC_R.piso[1], Math.max(NUC_R.piso[0], 0.635-2*e))*100)/100, a=Math.ceil(n/2);
  return {n, e, p, a, run:(a-1)*p};
}
function nucleoParams(o={}){
  const st=o._st||null, NU=(st&&st.nucleo)||{}, pe=(st&&st.produto&&st.produto.pe)||3;
  const pop = st && typeof normaPopulacao==="function" ? normaPopulacao(st.produto.mix) : 0;
  const lNorma = pop && typeof normaLarguras==="function" ? normaLarguras(pop).escada : 0;
  const larg=Math.max(NUC_R.escLarg, Math.ceil(lNorma*20-1e-9)/20), deg=nucleoDegraus(pe);
  const cap=NUC_ELEV[NU.cap]? +NU.cap : 8, EV=NUC_ELEV[cap];
  const F=Math.max(NUC_R.F, EV.caixa[1]+NUC_R.paredeCF+0.15), escD=Math.round((2*larg+NUC_R.bomba+NUC_R.paredeCF)*100)/100;
  const Wel=Math.round((EV.caixa[0]+NUC_R.paredeCF)*100)/100;
  const LsMin=deg.run+2*larg+NUC_R.paredeCF;
  let nE=Math.max(0, o.nElev==null? 2 : +o.nElev);
  if(o._nElevAuto && o._pav) nE=Math.max(1, nucleoElevNec({pav:o._pav, H:o._H, pop, cap}).n);   // automático: pelo tráfego (população × pavimentos)
  return { t:o.escTipo||"pf_duto", nE, nEsc:o.nEsc===2? 2 : 1, emerg:!!o.emerg, pe, pop, larg, deg, cap, EV,
    F, escD, Wel, LsMin, corr:+o.corr||1.6, fixo:NU.partido||"auto" };
}
function nucleoPartidoDe(o, p){
  if(o._seq) return "escada2";
  if(p.t==="pf_balcao") return "balcao";
  if(p.nEsc===2) return "duas";
  if(p.emerg) return "emergencia";
  if(["linear","linear-curto","u","l"].includes(p.fixo)) return p.fixo==="linear" && p.t==="pf_press" ? "pressurizada" : p.fixo;
  if(p.t==="pf_press") return p.nE>=3? "u" : p.nE<=1? "linear-curto" : "pressurizada";
  if(p.t==="ep" && p.nE<=1) return "baixo";
  if(p.nE>=3) return "u";
  if(p.nE<=1) return "linear-curto";
  return "linear";
}

/* ---------- montagem (modelo local) ---------- */
function nucleoMonta(o={}){
  const p=nucleoParams(o), id=nucleoPartidoDe(o, p);
  const B={ id, p, cells:[], doors:[], L:0, D:p.F+p.escD, F:p.F, split:null };
  const r2=x=>Math.round(x*1000)/1000;
  B.cell=(k,nome,u,v,w,h,x={})=>{ const c={k,nome,u:r2(u),v:r2(v),w:r2(w),h:r2(h),...x}; B.cells.push(c); return c };
  // porta: parede ao longo de u (eixo "u", em v=const) ou ao longo de v (eixo "v", em u=const); abre para o lado `para` (+1/−1 no eixo normal)
  B.door=(eixo,pos,a0,w,para,tipo,x={})=>{ const a= eixo==="u"? [a0,pos] : [pos,a0], b= eixo==="u"? [a0+w,pos] : [pos,a0+w];
    const n= eixo==="u"? [0,para] : [para,0]; const d={a, b, n, larg:w, tipo, sw: tipo==="elev"||tipo==="emerg"||tipo==="vao"? 0 : 1, ...x};
    if(x.dobra==="b"){ d.a=b; d.b=a } B.doors.push(d); return d };
  (NUC_MONTA[id]||NUC_MONTA.linear)(B, p, o, false);
  B.L=r2(Math.max(...B.cells.map(c=>c.u+c.w))); B.D=r2(Math.max(...B.cells.filter(c=>!c.fundo).map(c=>c.v+c.h)));
  return {partido:id, partidoNome:nucleoNomePartido(id), L:B.L, D:B.D, F:p.F, escD:p.escD, split:B.split, ala:B.ala||null,
    cells:B.cells, doors:B.doors, p:{t:p.t, nE:p.nE, nEsc:p.nEsc, emerg:p.emerg, larg:p.larg, deg:p.deg, cap:p.cap, EV:p.EV, F:p.F, escD:p.escD, LsMin:p.LsMin, corr:p.corr, pe:p.pe, pop:p.pop, fixo:p.fixo}};
}

/* peças comuns */
function nucPre(B, p, u0, v0, h){   // dutos de ventilação da antecâmara (PF) ou duto de pressurização (PFP), atrás da antecâmara
  if(p.t==="pf_duto"){ const w=0.8; B.cell("duto","duto entrada",u0,v0,w,h,{sub:"entrada"}); B.cell("duto","duto saída",u0+w,v0,w,h,{sub:"saida"}); return 2*w }
  if(p.t==="pf_press"){ B.cell("duto","pressurização",u0,v0,1.0,h,{sub:"press"}); return 1.0 }
  return 0;
}
function nucAntNome(p){ return p.t==="ep"? "hall da escada" : p.t==="pf_press"? "antecâmara" : "antecâmara" }
/* escada de lances paralelos a u (fundo), patamar do pavimento na ponta `ent` ("lo"|"hi") */
function nucEscU(B, p, u0, v0, w, ent, nome="escada"){ return B.cell("esc", nome, u0, v0, w, p.escD, {ori:"u", ent}) }
function nucEscV(B, p, u0, v0, h, ent, nome="escada"){ return B.cell("esc", nome, u0, v0, p.escD, h, {ori:"v", ent}) }
function nucElevs(B, p, u0, n){ let u=u0; for(let i=0;i<n;i++){ B.cell("elev","elevador",u,0,p.Wel,p.F,{porta:"f", cap:p.cap}); B.door("u",0,u+(p.Wel-p.EV.porta)/2,p.EV.porta,-1,"elev"); u+=p.Wel } return u }
/* shafts por prumada, lado a lado em u, com porta de visita na frente (v=0) ou na lateral */
function nucShaftsU(B, p, u0, v0, h, lista, portaV){ const w=0.6; lista.forEach((s,i)=>{ B.cell("shaft",s.nome,u0+i*w,v0,w,h,{sub:s.k}); if(portaV!=null) B.door("u",portaV,u0+i*w+0.05,0.5,portaV>v0? 1 : -1,"shaft") }); return lista.length*w }
const NUC_PRUMADAS = [{k:"hidraulica", nome:"shaft hidráulico"}, {k:"eletrica", nome:"shaft elétrico e telecom"}, {k:"gas", nome:"shaft de gás"}];

const NUC_MONTA = {
  /* frente: [antecâmara][elevadores][hall de serviço + shafts] · fundo: [dutos][escada][lixo/DML] */
  linear(B, p){
    const F=p.F, pre0 = p.t==="pf_duto"? 1.6 : p.t==="pf_press"? 1.0 : 0;
    let Wa=Math.max(p.t==="ep"? 1.8 : 2.4, pre0+1.2); const nE=Math.max(1,p.nE);
    let bEnd=Wa+nE*p.Wel; if(bEnd-pre0 < p.LsMin) { Wa+=p.LsMin-(bEnd-pre0); bEnd=Wa+nE*p.Wel }
    Wa=Math.round(Wa*20)/20; bEnd=Wa+nE*p.Wel;
    B.cell("ant", nucAntNome(p), 0, 0, Wa, F, {resgate:true});
    B.door("u",0,Wa-1.05,NUC_R.porta,1,"escada");                    // do corredor para a antecâmara (abre no sentido da fuga)
    nucElevs(B, p, Wa, nE);
    const Wh=1.4, Ws=0.7, uh=bEnd;
    B.cell("hserv","hall de serviço",uh,0,Wh,F); B.door("u",0,uh+0.3,NUC_R.portaServ,1,"servico");
    NUC_PRUMADAS.forEach((s,i)=>{ const h=F/3; B.cell("shaft",s.nome,uh+Wh,i*h,Ws,h,{sub:s.k}); B.door("v",uh+Wh,i*h+0.07,h-0.14,-1,"shaft") });
    const pre=nucPre(B, p, 0, F, p.escD);
    nucEscU(B, p, pre, F, bEnd-pre, "lo");
    B.door("u",F,pre+0.15,NUC_R.porta,1,"escada",{dobra:"b"});       // antecâmara → escada (abre para dentro da escada)
    B.cell("lixo","lixo / DML",uh,F,Wh+Ws,p.escD); B.door("u",F,uh+0.3,NUC_R.portaServ,1,"servico");
    B.split=bEnd;
  },
  pressurizada(B, p){ NUC_MONTA.linear(B, p) },
  /* frente: [antecâmara][elevador(es)][DML][shafts] · fundo: [dutos][escada] */
  "linear-curto"(B, p){
    const F=p.F, pre0 = p.t==="pf_duto"? 1.6 : p.t==="pf_press"? 1.0 : 0;
    let Wa=Math.max(p.t==="ep"? 1.8 : 2.4, pre0+1.2); const nE=p.nE;
    const Wd=1.3, Ws=1.2; let L=Wa+nE*p.Wel+Wd+Ws;
    if(L-pre0 < p.LsMin){ Wa+=p.LsMin-(L-pre0); Wa=Math.round(Wa*20+0.499)/20; L=Wa+nE*p.Wel+Wd+Ws }
    B.cell("ant", nucAntNome(p), 0, 0, Wa, F, {resgate:true}); B.door("u",0,Wa-1.05,NUC_R.porta,1,"escada");
    let u=nucElevs(B, p, Wa, nE);
    B.cell("lixo","DML",u,0,Wd,F); B.door("u",0,u+0.25,NUC_R.portaServ,1,"servico"); u+=Wd;
    nucShaftsU(B, p, u, 0, F, NUC_PRUMADAS.slice(0,2), 0);
    const pre=nucPre(B, p, 0, F, p.escD);
    nucEscU(B, p, pre, F, L-pre, "lo"); B.door("u",F,pre+0.15,NUC_R.porta,1,"escada",{dobra:"b"});
    B.split=Wa;
  },
  /* até 4 pavimentos: [hall da escada][elevador][shafts] · fundo: [escada] */
  baixo(B, p){
    const F=p.F; let Wa=1.8; const nE=Math.min(1,p.nE), Ws=1.2; let L=Wa+nE*p.Wel+Ws;
    if(L<p.LsMin){ Wa+=p.LsMin-L; Wa=Math.round(Wa*20+0.499)/20; L=Wa+nE*p.Wel+Ws }
    B.cell("ant","hall da escada",0,0,Wa,F,{resgate:true}); B.door("u",0,Wa-1.05,NUC_R.porta,1,"escada");
    const u=nucElevs(B, p, Wa, nE); nucShaftsU(B, p, u, 0, F, NUC_PRUMADAS.slice(0,2), 0);
    nucEscU(B, p, 0, F, L, "lo"); B.door("u",F,0.15,NUC_R.porta,1,"escada",{dobra:"b"});
    B.split=L/2;
  },
  /* [escada no sentido da profundidade][antecâmara/dutos][elevadores ⟂ hall][hall dos elevadores][elevadores ⟂ hall] */
  u(B, p, o, emerg){
    const D=Math.max(p.F+p.escD, p.LsMin), F=p.F, E=p.escD, nE=Math.max(1,p.nE);
    nucEscV(B, p, 0, 0, D, "lo");
    // coluna da antecâmara: atrás dela os dutos (PF), o insuflamento (PFP) ou, com emergência, o elevador de emergência + dutos
    const We=Math.round((NUC_EMERG.caixa[0]+NUC_R.paredeCF)*20)/20, Wdu = p.t==="pf_duto"? 1.6 : p.t==="pf_press"? 1.0 : 0;
    const Wt = emerg? We+Math.max(Wdu,1.2) : 2.2;
    B.cell("ant", nucAntNome(p), E, 0, Wt, F, {resgate:true});
    B.door("u",0,E+Wt-1.05,NUC_R.porta,1,"escada"); B.door("v",E,0.15,NUC_R.porta,-1,"escada",{dobra:"b"});
    if(emerg){ B.cell("emerg","elevador de emergência",E,F,We,D-F,{porta:"f", cap:"emerg"}); B.door("u",F,E+(We-NUC_EMERG.porta)/2,NUC_EMERG.porta,-1,"emerg");
      const u2=E+We, w2=Wt-We;
      if(p.t==="pf_duto"){ B.cell("duto","duto entrada",u2,F,w2/2,D-F,{sub:"entrada"}); B.cell("duto","duto saída",u2+w2/2,F,w2/2,D-F,{sub:"saida"}) }
      else if(p.t==="pf_press") B.cell("duto","pressurização",u2,F,w2,D-F,{sub:"press"});
      else B.cell("shaft","shaft hidráulico",u2,F,w2,D-F,{sub:"hidraulica", semAcesso:true}) }
    else if(p.t==="pf_duto"){ B.cell("duto","duto entrada",E,F,Wt/2,D-F,{sub:"entrada"}); B.cell("duto","duto saída",E+Wt/2,F,Wt/2,D-F,{sub:"saida"}) }
    else if(p.t==="pf_press"){ B.cell("duto","pressurização",E,F,Wt,D-F,{sub:"press"}) }
    else B.cell("shaft","shaft hidráulico",E,F,Wt,D-F,{sub:"hidraulica", semAcesso:true});
    const Wc=Math.round((p.EV.caixa[1]+NUC_R.paredeCF)*20+0.499)/20, Wh=Math.max(2.0, NUC_R.hallElev+0.3), hE=D/2;
    const uA=E+Wt, uH=uA+Wc, uC=uH+Wh, nA=Math.min(2, Math.ceil(nE/2)), nC=Math.min(2, nE-nA);
    const hs=0.8;   // shafts no fundo do hall
    B.cell("hall","hall dos elevadores",uH,0,Wh,D-hs,{aberto:true}); B.door("u",0,uH,Wh,-1,"vao",{tipo:"elev", vao:true});
    NUC_PRUMADAS.forEach((s,i)=>{ const w=Wh/3; B.cell("shaft",s.nome,uH+i*w,D-hs,w,hs,{sub:s.k}); B.door("u",D-hs,uH+i*w+0.08,w-0.16,-1,"shaft") });
    const lado=(u0,n,porta,uPorta)=>{ for(let i=0;i<2;i++){ const v=i*hE;
      if(i<n){ B.cell("elev","elevador",u0,v,Wc,hE,{porta, cap:p.cap}); B.door("v",uPorta,v+(hE-p.EV.porta)/2,p.EV.porta,porta==="r"? 1 : -1,"elev") }
      else { const lixo = u0>uH; B.cell("lixo", lixo? "lixo" : "DML", u0, v, Wc, hE); B.door("v",uPorta,v+0.3,NUC_R.portaServ,porta==="r"? -1 : 1,"servico") } } };
    lado(uA, nA, "r", uH); lado(uC, nC, "l", uC);
    B.split=uH+Wh/2;
  },
  /* [escada ⟂][antecâmara/dutos] + ala rasa de elevadores e shafts (a unidade vizinha contorna) */
  l(B, p){
    const D=Math.max(p.F+p.escD, p.LsMin), F=p.F, E=p.escD, nE=Math.max(1,p.nE);
    nucEscV(B, p, 0, 0, D, "lo");
    const Wt=2.2; B.cell("ant", nucAntNome(p), E, 0, Wt, F, {resgate:true});
    B.door("u",0,E+Wt-1.05,NUC_R.porta,1,"escada"); B.door("v",E,0.15,NUC_R.porta,-1,"escada",{dobra:"b"});
    if(p.t==="pf_duto"){ B.cell("duto","duto entrada",E,F,Wt/2,D-F,{sub:"entrada"}); B.cell("duto","duto saída",E+Wt/2,F,Wt/2,D-F,{sub:"saida"}) }
    else if(p.t==="pf_press") B.cell("duto","pressurização",E,F,Wt,D-F,{sub:"press"});
    else B.cell("shaft","shaft hidráulico",E,F,Wt,D-F,{sub:"hidraulica", semAcesso:true});
    const u=nucElevs(B, p, E+Wt, nE); nucShaftsU(B, p, u, 0, F, NUC_PRUMADAS.slice(0,2), 0);
    B.ala={u0:E+Wt, vIn:F};   // fundo da ala dos elevadores: vai para a unidade vizinha
    B.split=E+Wt;
  },
  /* fundo: [balcão aberto (até a fachada)][escada][lixo] · frente: [acesso][shafts][elevadores][hall de serviço] */
  balcao(B, p){
    const F=p.F, Wb=2.0, nE=Math.max(1,p.nE); let Ws=1.2;
    let bEnd=Wb+Ws+nE*p.Wel; if(bEnd-Wb < p.LsMin){ Ws+=p.LsMin-(bEnd-Wb); Ws=Math.round(Ws*20+0.499)/20; bEnd=Wb+Ws+nE*p.Wel }
    B.cell("ant","acesso ao balcão",0,0,Wb,F); B.door("u",0,Wb-1.05,NUC_R.porta,1,"escada");
    B.cell("balc","balcão aberto",0,F,Wb,p.escD,{fachada:true}); B.door("u",F,0.55,NUC_R.porta,1,"escada");
    nucShaftsU(B, p, Wb, 0, F, NUC_PRUMADAS.slice(0,2).concat(Ws>1.5? [NUC_PRUMADAS[2]] : []), 0);
    if(Ws>1.8){ const c=B.cells[B.cells.length-1]; c.w=Ws-0.6*(B.cells.filter(x=>x.k==="shaft").length-1) }
    nucElevs(B, p, Wb+Ws, nE);
    nucEscU(B, p, Wb, F, bEnd-Wb, "lo"); B.door("v",Wb,F+(p.escD-NUC_R.porta)/2,NUC_R.porta,1,"escada");
    const Wh=1.6; B.cell("hserv","hall de serviço",bEnd,0,Wh,F); B.door("u",0,bEnd+0.35,NUC_R.portaServ,1,"servico");
    B.cell("lixo","lixo / DML",bEnd,F,Wh,p.escD); B.door("u",F,bEnd+0.35,NUC_R.portaServ,1,"servico");
    B.split=bEnd;
  },
  /* frente: [antecâmara][elevadores][shafts][DML][antecâmara 2] · fundo: [dutos][escada 1][escada 2][dutos] */
  duas(B, p){
    const F=p.F, pre0 = p.t==="pf_duto"? 1.6 : p.t==="pf_press"? 1.0 : 0, nE=Math.max(1,p.nE);
    let Wa=Math.max(p.t==="ep"? 1.8 : 2.4, pre0+1.2);
    if(Wa+nE*p.Wel-pre0 < p.LsMin){ Wa+=p.LsMin-(Wa+nE*p.Wel-pre0); Wa=Math.round(Wa*20+0.499)/20 }
    const b1=Wa+nE*p.Wel, Ws=1.2, Wd=Math.max(1.4, Math.round((p.LsMin-Wa+pre0-Ws)*20+0.499)/20), L=b1+Ws+Wd+Wa;
    B.cell("ant", nucAntNome(p), 0, 0, Wa, F, {resgate:true}); B.door("u",0,Wa-1.05,NUC_R.porta,1,"escada");
    nucElevs(B, p, Wa, nE);
    nucShaftsU(B, p, b1, 0, F, NUC_PRUMADAS.slice(0,2), 0);
    B.cell("lixo","lixo / DML",b1+Ws,0,Wd,F); B.door("u",0,b1+Ws+0.3,NUC_R.portaServ,1,"servico");
    B.cell("ant", nucAntNome(p)+" 2", L-Wa, 0, Wa, F, {resgate:true}); B.door("u",0,L-Wa+0.15,NUC_R.porta,1,"escada",{dobra:"b"});
    const pre=nucPre(B, p, 0, F, p.escD); nucEscU(B, p, pre, F, b1-pre, "lo"); B.door("u",F,pre+0.15,NUC_R.porta,1,"escada",{dobra:"b"});
    const c0=B.cells.length; const pre2=nucPre(B, p, L-pre0, F, p.escD); B.cells.slice(c0).forEach(c=>{ c.nome+=" 2" });
    nucEscU(B, p, b1, F, L-pre2-b1, "hi", "escada 2"); B.door("u",F,L-pre2-0.15-NUC_R.porta,NUC_R.porta,1,"escada");
    B.split=b1;
  },
  /* frente: [antecâmara][dutos][elevadores][hall de serviço] · fundo: [elevador de emergência][escada][lixo/DML] */
  emergencia(B, p, o){
    if(p.nE>=3){ NUC_MONTA.u(B, p, o, true); return }
    const F=p.F, nE=Math.max(1,p.nE), We=Math.round((NUC_EMERG.caixa[0]+NUC_R.paredeCF)*20)/20;
    let Wa=We+1.25; const Wdu = p.t==="pf_duto"? 0.9 : 0;
    let bEnd=Wa+Wdu+nE*p.Wel; if(bEnd-We < p.LsMin){ Wa+=p.LsMin-(bEnd-We); Wa=Math.round(Wa*20+0.499)/20; bEnd=Wa+Wdu+nE*p.Wel }
    B.cell("ant", nucAntNome(p), 0, 0, Wa, F, {resgate:true}); B.door("u",0,Wa-1.05,NUC_R.porta,1,"escada");
    if(Wdu){ B.cell("duto","duto entrada",Wa,0,Wdu,F/2,{sub:"entrada"}); B.cell("duto","duto saída",Wa,F/2,Wdu,F/2,{sub:"saida"}) }
    nucElevs(B, p, Wa+Wdu, nE);
    B.cell("emerg","elevador de emergência",0,F,We,p.escD,{porta:"f", cap:"emerg"}); B.door("u",F,(We-NUC_EMERG.porta)/2,NUC_EMERG.porta,-1,"emerg");
    if(p.t==="pf_press"){ B.cell("duto","pressurização",bEnd-1.0,F,1.0,p.escD,{sub:"press"}) }
    const escFim = p.t==="pf_press"? bEnd-1.0 : bEnd;
    nucEscU(B, p, We, F, escFim-We, "lo"); B.door("u",F,We+0.15,NUC_R.porta,1,"escada",{dobra:"b"});
    const Wh=1.4, Ws=0.7, uh=bEnd;
    B.cell("hserv","hall de serviço",uh,0,Wh,F); B.door("u",0,uh+0.3,NUC_R.portaServ,1,"servico");
    NUC_PRUMADAS.forEach((s,i)=>{ const h=F/3; B.cell("shaft",s.nome,uh+Wh,i*h,Ws,h,{sub:s.k}); B.door("v",uh+Wh,i*h+0.07,h-0.14,-1,"shaft") });
    B.cell("lixo","lixo / DML",uh,F,Wh+Ws,p.escD); B.door("u",F,uh+0.3,NUC_R.portaServ,1,"servico");
    B.split=bEnd;
  },
  /* segunda escada dos núcleos por alas: [escada ⟂][antecâmara/dutos] (EP: só a escada, porta direto no corredor) */
  escada2(B, p){
    const D=Math.max(p.F+p.escD, p.LsMin), F=p.F, E=p.escD;
    nucEscV(B, p, 0, 0, D, "lo", "escada 2");
    if(p.t==="ep"){ B.door("u",0,0.15,NUC_R.porta,1,"escada"); return }
    const Wt=2.2;
    if(p.t==="pf_balcao"){ B.cell("ant","acesso ao balcão",E,0,Wt,F); B.door("u",0,E+Wt-1.05,NUC_R.porta,1,"escada"); B.cell("balc","balcão aberto",E,F,Wt,D-F,{fachada:true}); B.door("u",F,E+0.6,NUC_R.porta,1,"escada"); B.door("v",E,F+0.3,NUC_R.porta,-1,"escada",{dobra:"b"}); return }
    B.cell("ant", nucAntNome(p)+" 2", E, 0, Wt, F, {resgate:true});
    B.door("u",0,E+Wt-1.05,NUC_R.porta,1,"escada"); B.door("v",E,0.15,NUC_R.porta,-1,"escada",{dobra:"b"});
    if(p.t==="pf_press") B.cell("duto","pressurização 2",E,F,Wt,D-F,{sub:"press"});
    else { B.cell("duto","duto entrada 2",E,F,Wt/2,D-F,{sub:"entrada"}); B.cell("duto","duto saída 2",E+Wt/2,F,Wt/2,D-F,{sub:"saida"}) }
  },
};

/* ---------- desenho técnico (linhas no referencial local; o coreBuild leva ao mundo) ---------- */
/* L: {l:[[u,v],[u,v]], c?:"fino"|"medio"|"tracejado"} · {arrow:[[u,v],[u,v]]} · {txt, p:[u,v], s?} · {dot:[u,v]} */
function nucleoDesenho(N){
  const out=[], t=NUC_R.paredeCF/2, ln=(a,b,c)=>out.push({l:[a,b], c}), P=N.p;
  N.cells.forEach(c=>{
    if(c.k==="esc"){
      const ori=c.ori||"u", A0=(ori==="u"? c.u : c.v)+t, A1=(ori==="u"? c.u+c.w : c.v+c.h)-t, C0=(ori==="u"? c.v : c.u)+t, C1=(ori==="u"? c.v+c.h : c.u+c.w)-t;
      const M=(a,x)=> ori==="u"? [a,x] : [x,a];    // a = ao longo dos lances · x = através
      const lw=Math.min(P.larg, (C1-C0-NUC_R.bomba)/2), run=P.deg.run, pat=Math.max(0.3,(A1-A0-run)/2);
      const ent=c.ent||"lo", s0 = ent==="lo"? A0+pat : A1-pat, dir = ent==="lo"? 1 : -1, s1=s0+dir*run;
      const f1=[C0, C0+lw], f2=[C1-lw, C1];   // lance que sobe (f1) e lance que desce (f2)
      // bomba (guarda central) e bordas dos patamares
      ln(M(s0,C0+lw),M(s1,C0+lw),"medio"); ln(M(s0,C1-lw),M(s1,C1-lw),"medio");
      ln(M(s0,C0),M(s0,C1),"medio"); ln(M(s1,C0),M(s1,C1),"medio");
      for(let k=1;k<P.deg.a-1;k++){ const a=s0+dir*k*P.deg.p; ln(M(a,f1[0]),M(a,f1[1])); ln(M(a,f2[0]),M(a,f2[1])) }
      // corte do lance que sobe (linha de quebra) e linhas de piso com seta
      const ac=s0+dir*run*0.55, z=(f1[1]-f1[0])/3; ln(M(ac-dir*0.12,f1[0]),M(ac-dir*0.12,f1[0]+z),"medio"); ln(M(ac-dir*0.12,f1[0]+z),M(ac+dir*0.12,f1[1]-z),"medio"); ln(M(ac+dir*0.12,f1[1]-z),M(ac+dir*0.12,f1[1]),"medio");
      const m1=(f1[0]+f1[1])/2, m2=(f2[0]+f2[1])/2;
      out.push({dot:M(s0-dir*0.35,m1)}); out.push({arrow:[M(s0-dir*0.35,m1),M(ac-dir*0.1,m1)]});
      out.push({dot:M(s0-dir*0.35,m2)}); out.push({arrow:[M(s0-dir*0.35,m2),M(s1-dir*0.15,m2)]});
      out.push({txt:"S", p:M(s0-dir*0.15,m1-0.28*(lw>0.9?1:0.6)), s:0.30}); out.push({txt:"D", p:M(s0-dir*0.15,m2+0.28*(lw>0.9?1:0.6)), s:0.30});
      out.push({txt:c.nome, p:M(ent==="lo"? A1-pat/2 : A0+pat/2,(C0+C1)/2), s:0.22, bg:true, rot:ori==="u"? 0 : 1});
      // área de resgate no patamar do pavimento (cadeira de rodas 0,80 × 1,20) — só quando a antecâmara não a tem
      if(pat>=NUC_R.resgate[1]+0.05 && !N.cells.some(a=>a.k==="ant" && a.resgate && a.w>=NUC_R.resgate[1]+0.4)){ const r0= ent==="lo"? A0+0.05 : A1-0.05-NUC_R.resgate[1], [x0,x1]=[C1-0.05-NUC_R.resgate[0], C1-0.05];
        const q=[M(r0,x0),M(r0+NUC_R.resgate[1],x0),M(r0+NUC_R.resgate[1],x1),M(r0,x1)]; q.forEach((a,i)=>ln(a,q[(i+1)%4],"tracejado")); out.push({txt:"MR", p:M(r0+NUC_R.resgate[1]/2,(x0+x1)/2), s:0.22}) }
    }
    if(c.k==="elev"||c.k==="emerg"){
      const EV = c.k==="emerg"? NUC_EMERG : P.EV, por=c.porta||"f", tw=NUC_R.paredeCF/2;
      // eixos da cabine: "frente" = lado da porta
      const fr = por==="f"? {a:[c.u,c.v], ax:[1,0], ay:[0,1], W:c.w, H:c.h} : por==="r"? {a:[c.u+c.w,c.v], ax:[0,1], ay:[-1,0], W:c.h, H:c.w} : {a:[c.u,c.v+c.h], ax:[0,-1], ay:[1,0], W:c.h, H:c.w};
      const Q=(x,y)=>[fr.a[0]+fr.ax[0]*x+fr.ay[0]*y, fr.a[1]+fr.ax[1]*x+fr.ay[1]*y];
      const cw=Math.min(EV.cabine[0], fr.W-2*tw-0.35), cd=Math.min(EV.cabine[1], fr.H-2*tw-0.30), x0=(fr.W-cw)/2 - 0.12, y0=tw+0.12;
      const cab=[Q(x0,y0),Q(x0+cw,y0),Q(x0+cw,y0+cd),Q(x0,y0+cd)]; cab.forEach((a,i)=>ln(a,cab[(i+1)%4],"medio"));
      ln(cab[0],cab[2]); ln(cab[1],cab[3]);
      // contrapeso na lateral oposta à botoeira
      const cx0=x0+cw+0.08, cx1=Math.min(fr.W-tw-0.04, cx0+0.16), cy0=y0+0.15, cy1=Math.min(fr.H-tw-0.08, y0+cd-0.15);
      if(cx1-cx0>0.06){ const cp=[Q(cx0,cy0),Q(cx1,cy0),Q(cx1,cy1),Q(cx0,cy1)]; cp.forEach((a,i)=>ln(a,cp[(i+1)%4],"medio")); ln(cp[0],cp[2],"fino") }
      // portas de correr (duas folhas) na soleira
      const pw=EV.porta, px=(fr.W-pw)/2; ln(Q(px,tw*0.4),Q(px+pw/2+0.05,tw*0.4),"medio"); ln(Q(px+pw/2-0.05,tw*1.4),Q(px+pw,tw*1.4),"medio");
    }
    if(c.k==="duto"){
      const g=0.22; for(let k=g;k<c.w+c.h;k+=g){ const a=[c.u+Math.max(0,k-c.h), c.v+Math.min(c.h,k)], b=[c.u+Math.min(c.w,k), c.v+Math.max(0,k-c.w)]; ln(a,b,"fino") }
      const cx=c.u+c.w/2, cy=c.v+c.h/2, r=Math.min(c.w,c.h)*0.28;
      if(c.sub==="entrada") out.push({arrow:[[cx,cy+r],[cx,cy-r]]}); else if(c.sub==="saida") out.push({arrow:[[cx,cy-r],[cx,cy+r]]});
      out.push({txt: c.sub==="entrada"? "E" : c.sub==="saida"? "S" : "P", p:[cx+(c.w>0.7? 0.22 : 0), cy], s:0.24, bg:true});
    }
    if(c.k==="shaft"){
      ln([c.u+0.08,c.v+0.08],[c.u+c.w-0.08,c.v+c.h-0.08],"fino"); ln([c.u+c.w-0.08,c.v+0.08],[c.u+0.08,c.v+c.h-0.08],"fino");
      out.push({txt:{hidraulica:"H", eletrica:"E", gas:"G"}[c.sub]||"", p:[c.u+c.w/2, c.v+c.h/2], s:0.24, bg:true});
    }
    if(c.k==="balc"){ const v=c.v+c.h; ln([c.u+0.1,v-0.12],[c.u+c.w-0.1,v-0.12],"tracejado") }
    if(c.resgate && c.k==="ant" && c.w>=NUC_R.resgate[1]+0.4){ const x0=c.u+0.15, y0=c.v+c.h-0.1-NUC_R.resgate[0];
      const q=[[x0,y0],[x0+NUC_R.resgate[1],y0],[x0+NUC_R.resgate[1],y0+NUC_R.resgate[0]],[x0,y0+NUC_R.resgate[0]]]; q.forEach((a,i)=>ln(a,q[(i+1)%4],"tracejado")); out.push({txt:"MR", p:[x0+NUC_R.resgate[1]/2,y0+NUC_R.resgate[0]/2], s:0.22}) }
  });
  return out;
}

/* ---------- validação (nota e problemas em linguagem simples) ---------- */
const NUC_NF=(x,d=2)=>(Math.round(x*Math.pow(10,d))/Math.pow(10,d)).toFixed(d).replace(".",",");
/** elevadores necessários (tráfego simplificado: 8% da população em 5 min, intervalo ≤ 120 s) */
function nucleoElevNec(ctx){
  const pav=Math.max(1,+ctx.pav||1), H=Math.max(3,+ctx.H||pav*3), popT=Math.max(0,+ctx.pop||0)*pav, cap=+ctx.cap||8;
  if(pav<=4 && H<=12) return {n:0, rtt:0, intervalo:0, popT, v:1};
  const v = H<=30? 1.0 : H<=60? 1.75 : 2.5, pp=0.8*cap, N=pav, S=N*(1-Math.pow((N-1)/N, pp));
  const rtt = 2*H/v + (S+1)*9 + 2*pp*1.2, c5 = 300*pp/rtt;
  let n=Math.max(1, Math.ceil(0.08*popT/c5 - 1e-9)); while(rtt/n>120 && n<8) n++;
  if(pav>=8) n=Math.max(2,n);   // a partir de 8 pavimentos, dois elevadores (um fica na manutenção)
  return {n, rtt, intervalo:rtt/n, popT, v};
}
/** nuc = lay.nucleo (com .local = modelo de nucleoMonta) · ctx = {pav, H (altura descendente), pop, units, plateA, fachada, tec} */
function nucleoValida(nuc, ctx={}){
  const N=nuc && nuc.local; if(!N) return {nota:null, problemas:[]};
  const P=N.p, pr=[], add=(k,nivel,msg,parte)=>pr.push({k,nivel,msg,parte});
  const cs=N.cells, ofK=k=>cs.filter(c=>c.k===k);
  // escada: largura, degraus, patamares
  ofK("esc").forEach(c=>{
    const larg=Math.min(P.larg, ((c.ori==="v"? c.w : c.h)-NUC_R.paredeCF-NUC_R.bomba)/2), lMin=Math.max(NUC_R.escLarg, ctx.largMin||0);
    if(larg < lMin-0.005) add("escLarg","bad",`Escada com ${NUC_NF(larg)} m de largura útil; precisa de ${NUC_NF(lMin)} m.`, c.nome);
    const d=P.deg, bl=2*d.e+d.p;
    if(d.e>NUC_R.espelho[1]+0.003 || d.e<NUC_R.espelho[0]-0.003 || d.p<NUC_R.piso[0]-0.003 || d.p>NUC_R.piso[1]+0.003 || bl<NUC_R.blondel[0]-0.005 || bl>NUC_R.blondel[1]+0.005)
      add("degrau","warn",`Degraus de ${NUC_NF(d.e*100,1)} × ${NUC_NF(d.p*100,0)} cm fora da faixa (espelho 16–18, piso 28–32, 2e+p 63–65 cm).`, c.nome);
    const comp=(c.ori==="v"? c.h : c.w)-NUC_R.paredeCF, pat=(comp-d.run)/2;
    if(pat < larg-0.02) add("patamar","bad",`Patamar de ${NUC_NF(pat)} m, menor que a largura do lance (${NUC_NF(larg)} m).`, c.nome);
    else if(pat > NUC_R.patamarMax+0.01) add("patamarLongo","warn",`Patamares de ${NUC_NF(pat)} m: a caixa da escada sobra ${NUC_NF((pat-Math.max(larg,1.5))*2*(c.ori==="v"? c.w : c.h),1)} m².`, c.nome);
  });
  if(!ofK("esc").length) add("semEscada","bad","Núcleo sem escada.");
  // antecâmara e dutos (PF), pressurização, balcão
  const ants=ofK("ant").filter(c=>/antec/.test(c.nome));
  if(["pf_duto","pf_press"].includes(P.t) && N.partido!=="balcao"){
    if(!ants.length) add("semAnt","bad","Escada à prova de fumaça sem antecâmara.");
    ants.forEach(c=>{ const prof=Math.min(c.w,c.h)-NUC_R.paredeCF; if(prof<NUC_R.antProf-0.005) add("antRasa","bad",`Antecâmara com ${NUC_NF(prof)} m de profundidade; o mínimo é ${NUC_NF(NUC_R.antProf)} m.`, c.nome) });
  }
  if(P.t==="pf_duto"){ const ent=ofK("duto").filter(c=>c.sub==="entrada"), sai=ofK("duto").filter(c=>c.sub==="saida"), a=c=>Math.max(0,c.w-NUC_R.parede)*Math.max(0,c.h-NUC_R.parede);
    if(!ent.length || !sai.length) add("semDuto","bad","Escada PF sem os dutos de entrada e de saída de ar da antecâmara.");
    [...ent,...sai].forEach(c=>{ if(a(c)<NUC_R.dutoA-0.005 || Math.min(c.w,c.h)-NUC_R.parede<NUC_R.dutoLado-0.005) add("dutoPeq","bad",`${c.nome[0].toUpperCase()+c.nome.slice(1)} com ${NUC_NF(a(c))} m²; o mínimo é ${NUC_NF(NUC_R.dutoA)} m² (lado ≥ ${NUC_NF(NUC_R.dutoLado)} m).`, c.nome) });
    // dutos precisam encostar na antecâmara
    const enc=(c,d)=>{ const ov=(a0,a1,b0,b1)=>Math.min(a1,b1)-Math.max(a0,b0); return (Math.abs(c.v+c.h-d.v)<0.01||Math.abs(d.v+d.h-c.v)<0.01)&&ov(c.u,c.u+c.w,d.u,d.u+d.w)>0.3 || (Math.abs(c.u+c.w-d.u)<0.01||Math.abs(d.u+d.w-c.u)<0.01)&&ov(c.v,c.v+c.h,d.v,d.v+d.h)>0.3 };
    [...ent,...sai].forEach(c=>{ if(!ants.some(a=>enc(a,c))) add("dutoLonge","bad",`${c.nome[0].toUpperCase()+c.nome.slice(1)} não encosta na antecâmara.`, c.nome) });
  }
  if(P.t==="pf_press" && !ofK("duto").some(c=>c.sub==="press")) add("semPress","bad","Escada pressurizada sem duto de insuflamento.");
  if(P.t==="pf_balcao"){ ofK("balc").forEach(c=>{ if(ctx.fachada===false || c.semFachada) add("balcFach","bad","O balcão aberto precisa estar na fachada.", c.nome) }); if(!ofK("balc").length) add("semBalc","bad","Escada com balcão sem o balcão aberto.") }
  if(P.t==="ep" && ctx.fachada===false) add("epVent","warn","Escada enclausurada protegida precisa de janela na fachada ou duto de ventilação.");
  // elevadores: porta na antecâmara, hall à frente, quantidade, cabine, emergência
  N.doors.filter(d=>d.tipo==="elev").forEach(d=>{ const mid=[(d.a[0]+d.b[0])/2+d.n[0]*0.2, (d.a[1]+d.b[1])/2+d.n[1]*0.2];
    const c=cs.find(c=>mid[0]>c.u+1e-6&&mid[0]<c.u+c.w-1e-6&&mid[1]>c.v+1e-6&&mid[1]<c.v+c.h-1e-6);
    if(c && c.k==="ant") add("elevAnt","bad","Porta de elevador abrindo direto na antecâmara (só o de emergência pode).", c.nome) });
  const nEl=ofK("elev").length, hallU=ofK("hall")[0];
  if(nEl){ const livre = hallU? (hallU.w-NUC_R.paredeCF) : (ctx.corr!=null? ctx.corr : P.corr);
    if(livre < NUC_R.hallElev-0.005) add("hallElev","bad",`Hall diante dos elevadores com ${NUC_NF(livre)} m; precisa de ${NUC_NF(NUC_R.hallElev)} m livres (giro da cadeira de rodas).`) }
  if(P.EV.cabine[0]<1.10-0.001 || P.EV.cabine[1]<1.40-0.001) add("cabine","warn",`Cabine de ${NUC_NF(P.EV.cabine[0])} × ${NUC_NF(P.EV.cabine[1])} m não é acessível (mínimo 1,10 × 1,40).`);
  if(ctx.pav){ const nec=nucleoElevNec({pav:ctx.pav, H:ctx.H, pop:ctx.pop!=null? ctx.pop : P.pop, cap:P.cap});
    if(nEl < nec.n) add("elevN", nEl===0||nec.n-nEl>1? "bad" : "warn", nEl? `${nEl} elevador${nEl>1?"es":""} para ${ctx.pav} pavimentos e ${Math.round(nec.popT)} moradores; o tráfego pede ${nec.n}.` : `Sem elevador acima de 4 pavimentos.`);
    if(ctx.emergObrig && !ofK("emerg").length) add("emerg","bad","Acima de 80 m o núcleo precisa de elevador de emergência abrindo na antecâmara.");
    if(ctx.escReq && ctx.escOf && ctx.escRank && ctx.escRank[ctx.escOf]<ctx.escRank[ctx.escReq]) add("escTipo","bad",`A altura pede escada ${ctx.escReq}; o núcleo tem ${ctx.escOf}.`) }
  // acesso: toda peça com porta (dutos e caixas de elevador não precisam), nenhuma peça "sobra"
  cs.forEach(c=>{ if(["duto","elev","emerg","esc","hall"].includes(c.k) || c.semAcesso) return;
    const tem=N.doors.some(d=>{ const mid=[(d.a[0]+d.b[0])/2,(d.a[1]+d.b[1])/2]; return mid[0]>=c.u-0.01&&mid[0]<=c.u+c.w+0.01&&mid[1]>=c.v-0.01&&mid[1]<=c.v+c.h+0.01 && !(Math.abs(mid[0]-c.u)>0.01&&Math.abs(mid[0]-c.u-c.w)>0.01&&Math.abs(mid[1]-c.v)>0.01&&Math.abs(mid[1]-c.v-c.h)>0.01) });
    if(!tem) add(c.k==="tec"? "sobra" : "semAcesso", c.k==="tec"? "warn" : "bad", c.k==="tec"? `Sobra sem uso de ${NUC_NF(c.w*c.h,1)} m² no núcleo.` : `${c.nome[0].toUpperCase()+c.nome.slice(1)} sem porta.`, c.nome) });
  if(!cs.some(c=>c.k==="shaft" && c.sub==="hidraulica") || !cs.some(c=>c.k==="shaft" && c.sub==="eletrica")) add("shafts","warn","Faltam shafts de prumada (hidráulico e elétrico) com visita pelo hall.");
  // harmonia: peças lado a lado sem sobreposição, sem buraco, e o fundo encontrando as linhas da frente
  const harm=nucleoHarmonia(N); harm.forEach(h=>add(h.k,h.nivel,h.msg));
  if(ctx.plateA && ctx.coreA && ctx.coreA/ctx.plateA>NUC_R.areaMaxPct) add("pesado","warn",`Núcleo ocupa ${Math.round(ctx.coreA/ctx.plateA*100)}% do andar (referência ≤ ${Math.round(NUC_R.areaMaxPct*100)}%).`);
  if(N.partido==="l") add("emL","warn","Núcleo em L: a unidade vizinha contorna a ala dos elevadores.");
  const bad=pr.filter(q=>q.nivel==="bad").length, warn=pr.filter(q=>q.nivel==="warn").length;
  return {nota:Math.max(0, 100-25*bad-6*warn), problemas:pr.sort((a,b)=>(a.nivel==="bad"? 0 : 1)-(b.nivel==="bad"? 0 : 1))};
}
/** alinhamento/serrilhado: cobertura do retângulo (sem buraco nem sobreposição) e linhas de eixo comuns às duas fileiras */
function nucleoHarmonia(N){
  const out=[], cs=N.cells.filter(c=>!c.fundo && c.w>0.02 && c.h>0.02), L=N.L, D=N.D;
  let sobre=0; for(let i=0;i<cs.length;i++) for(let j=i+1;j<cs.length;j++){ const a=cs[i], b=cs[j];
    const w=Math.min(a.u+a.w,b.u+b.w)-Math.max(a.u,b.u), h=Math.min(a.v+a.h,b.v+b.h)-Math.max(a.v,b.v); if(w>0.02&&h>0.02) sobre+=w*h }
  if(sobre>0.05) out.push({k:"sobrepoe", nivel:"bad", msg:`Peças do núcleo sobrepostas (${NUC_NF(sobre,1)} m²).`});
  const alvo = N.perfil? N.perfil.reduce((s,t)=>s+(t.u1-t.u0)*t.d,0) : N.ala? L*D-(L-N.ala.u0)*(D-N.ala.vIn) : L*D, soma=cs.reduce((s,c)=>s+c.w*c.h,0);
  if(alvo-soma>0.3) out.push({k:"buraco", nivel:"warn", msg:`Núcleo com ${NUC_NF(alvo-soma,1)} m² sem uso entre as peças.`});
  // fileiras: linhas de eixo verticais (u) que cortam a fileira da frente e a do fundo — as do fundo precisam encontrar as da frente
  const F=N.F, fr=cs.filter(c=>c.v<0.01 && c.h>=F-0.01), bk=cs.filter(c=>c.v>=F-0.01 && c.v<F+0.01);
  if(fr.length && bk.length){ const lf=new Set(fr.flatMap(c=>[c.u,c.u+c.w]).map(x=>x.toFixed(2)));
    const esc=bk.filter(c=>c.k==="esc"||c.k==="lixo"||c.k==="emerg"); let des=0;
    const ants=fr.filter(c=>c.k==="ant"), sob=c=>ants.some(a=>c.u>=a.u-0.02 && c.u+c.w<=a.u+a.w+0.02);   // dutos e elevador de emergência atrás da antecâmara: um bloco só
    const junto=x=>bk.some(d=>(d.k==="duto"||d.k==="emerg") && sob(d) && (Math.abs(d.u-x)<0.02 || Math.abs(d.u+d.w-x)<0.02));
    esc.forEach(c=>{ [c.u, c.u+c.w].forEach(x=>{ if(x>0.05 && x<L-0.05 && !junto(x) && ![...lf].some(y=>Math.abs(+y-x)<0.06)) des++ }) });
    if(des) out.push({k:"desalinhado", nivel:"warn", msg:`Escada ou lixo fora das linhas da frente (${des} ${des>1?"divisas desencontradas":"divisa desencontrada"}): serrilhado.`});
  }
  // contorno: retângulo (ou L declarado)
  const prof=new Set(N.perfil? N.perfil.filter(t=>!t.fach).map(t=>t.d.toFixed(2)) : cs.filter(c=>c.v+c.h>F+0.01).map(c=>(c.v+c.h).toFixed(2)));
  if(prof.size>1 && !N.ala) out.push({k:"dentes", nivel:"warn", msg:`Fundo do núcleo em ${prof.size} profundidades: contorno com dentes.`});
  return out;
}

/* ---------- informação para o contrato (lay.nucleo) — o coreBuild preenche ---------- */
const NUC_INFO = new WeakMap();   // lobby → nucleo (núcleos montados por outros módulos, ex.: alas, recuperam a ficha)

/* validação no fim do cálculo (altura, pavimentos e população por torre) */
HOOK.compute.push((m, st)=>{
  (m.tipo||[]).forEach((l,i)=>{ if(!l || !l.core) return; const t=m.T[i]; if(!t) return;
    if(!l.nucleo && l.lobby) { const n=NUC_INFO.get(l.lobby); if(n) l.nucleo=n }
    const nuc=l.nucleo; if(!nuc || !nuc.local) return;
    const pe=st.produto.pe, Hd=Math.max(0, t.H-pe), pop=typeof normaPopulacao==="function"? normaPopulacao(st.produto.mix) : 0;
    const escReq = typeof normaEscadaTipo==="function"? normaEscadaTipo(Hd) : null, escOf = typeof normaEscadaOferecida==="function"? normaEscadaOferecida(st.estudo.escTipo) : null;
    const largMin = pop && typeof normaLarguras==="function"? normaLarguras(pop).escada : 0;
    const v=nucleoValida(nuc, {pav:t.pav, H:t.H, pop, largMin, plateA:G.area(t.plate), coreA:l.coreA, corr:st.estudo.corrTipo, fachada:nuc.fachada,
      emergObrig: typeof normaElevEmergObrig==="function" && normaElevEmergObrig(Hd), escReq, escOf, escRank: typeof NORMA_ESC_RANK!=="undefined"? NORMA_ESC_RANK : null});
    nuc.nota=v.nota; nuc.problemas=v.problemas;
    if(nuc.elevNec==null) nuc.elevNec=nucleoElevNec({pav:t.pav, H:t.H, pop, cap:nuc.local.p.cap}).n;
  });
  const ns=(m.tipo||[]).filter(l=>l && l.nucleo && l.nucleo.nota!=null).map(l=>l.nucleo.nota);
  m.nucleo = ns.length? {nota:Math.min(...ns), partidos:(m.tipo||[]).map(l=>l && l.nucleo? l.nucleo.partido : null)} : null;
});
