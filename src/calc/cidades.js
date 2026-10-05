/* ================= biblioteca de regras por cidade e zona =================
   Cálculo puro (sem DOM). Cada registro traz os campos de S.regras que a zona define, a lei e a data.
   ATENÇÃO: os valores da base são EXEMPLOS ILUSTRATIVOS para demonstrar o recurso — não foram tirados de uma leitura
   revisada da lei. Conferir na lei municipal vigente (e na zona exata do lote) antes de usar. A tela repete este aviso.
   Fontes de registros (CIDADES_FONTES):
   - "base": os exemplos abaixo;
   - "local": regras salvas neste navegador (localStorage "gabarito.cidades", o mesmo formato {nome, regras} de antes,
     agora com lei/data/fonte opcionais) — inclui o que a leitura do plano diretor com IA (ai.js) propõe e o usuário salva;
   - outras (o banco do item 4.1) entram com cidadesRegistrarFonte({id, nome, listar}) sem mudar a tela. */
const CIDADES_AVISO = "Exemplo ilustrativo — conferir na lei municipal vigente e na zona do lote antes de usar.";
const CIDADES_CAMPOS = ["caBas","caMax","outorgaRS","toEmb","toTorre","permeab","hMax","recFrente","recEmb","afMin","afDiv","afTorresDiv","recSub","ncGaragem","ncTerreo","ncTipo","vagasApto","m2LojaVaga","aptoMin"];
const CIDADES_BASE = [
  { id:"sc-criciuma-central", uf:"SC", cidade:"Criciúma", zona:"Zona central de alta densidade (exemplo)",
    lei:"Plano diretor municipal — conferir lei e mapa de zoneamento", data:"—",
    regras:{ caBas:2, caMax:4, toEmb:0.8, toTorre:0.5, permeab:0.1, hMax:60, recFrente:4, recEmb:0, afMin:2.5, afDiv:8, vagasApto:1 } },
  { id:"sc-florianopolis-mista", uf:"SC", cidade:"Florianópolis", zona:"Área mista central (exemplo)",
    lei:"LC 482/2014 (Plano Diretor) — conferir alterações e a zona", data:"2014",
    regras:{ caBas:1, caMax:3, toEmb:0.6, toTorre:0.4, permeab:0.2, hMax:42, recFrente:4, recEmb:1.5, afMin:3, afDiv:6, vagasApto:1 } },
  { id:"sc-balneario-camboriu-central", uf:"SC", cidade:"Balneário Camboriú", zona:"Zona central (exemplo)",
    lei:"Plano diretor municipal — conferir lei e zona", data:"—",
    regras:{ caBas:3, caMax:6, toEmb:0.8, toTorre:0.5, permeab:0.1, hMax:200, recFrente:5, recEmb:0, afMin:3, afDiv:10, vagasApto:1.5 } },
  { id:"sc-joinville-adensamento", uf:"SC", cidade:"Joinville", zona:"Setor de adensamento (exemplo)",
    lei:"LC 470/2017 (LOT) — conferir alterações e o setor", data:"2017",
    regras:{ caBas:1.5, caMax:4, toEmb:0.7, toTorre:0.5, permeab:0.15, hMax:60, recFrente:5, recEmb:1.5, afMin:2.5, afDiv:8, vagasApto:1 } },
  { id:"pr-curitiba-residencial", uf:"PR", cidade:"Curitiba", zona:"Zona residencial de média-alta densidade (exemplo)",
    lei:"Lei 15.511/2019 (zoneamento, uso e ocupação do solo) — conferir a zona", data:"2019",
    regras:{ caBas:2, caMax:3, toEmb:0.5, toTorre:0.5, permeab:0.25, hMax:45, recFrente:5, recEmb:2.5, afMin:2.5, afDiv:6, vagasApto:1 } },
  { id:"rs-porto-alegre-misto", uf:"RS", cidade:"Porto Alegre", zona:"Área mista (exemplo)",
    lei:"LC 434/1999 (PDDUA) — conferir alterações e o regime urbanístico", data:"1999",
    regras:{ caBas:1.6, caMax:3, toEmb:0.75, toTorre:0.5, permeab:0.2, hMax:52, recFrente:4, recEmb:0, afMin:3, afDiv:5, vagasApto:1 } },
  { id:"sp-sao-paulo-eixo", uf:"SP", cidade:"São Paulo", zona:"Eixo de estruturação urbana (exemplo)",
    lei:"Lei 16.050/2014 (PDE) e Lei 16.402/2016 (LPUOS) — conferir revisões", data:"2016",
    regras:{ caBas:1, caMax:4, toEmb:0.7, toTorre:0.7, permeab:0.15, hMax:150, recFrente:0, recEmb:0, afMin:3, afDiv:10, vagasApto:1 } },
];
const CIDADES_FONTES = [
  { id:"base", nome:"Exemplos ilustrativos", listar:()=>CIDADES_BASE.map(c=>({...c, origem:"base", ilustrativo:true})) },
  { id:"local", nome:"Minhas regras salvas", listar:()=>cidadesLocais() },
];
function cidadesRegistrarFonte(f){ const i=CIDADES_FONTES.findIndex(x=>x.id===f.id); if(i>=0) CIDADES_FONTES.splice(i,1,f); else CIDADES_FONTES.push(f) }
/** regras salvas neste navegador (compatível com o formato antigo {nome, regras}) */
function cidadesLocais(){
  const l=LS.get("gabarito.cidades")||[];
  return l.map((c,i)=>({ id:"local:"+i, origem:"local", cidade:c.cidade||c.nome||"Sem nome", zona:c.zona||"", nome:c.nome, lei:c.lei||"", data:c.data||"", fonte:c.fonte||"usuário", regras:c.regras||{} }));
}
/** todos os registros, de todas as fontes */
function cidadesLista(){ return CIDADES_FONTES.flatMap(f=>{ try{ return (f.listar()||[]).map(c=>({...c, fonteId:f.id, fonteNome:f.nome})) }catch(e){ return [] } }) }
function cidadeAcha(id){ return cidadesLista().find(c=>c.id===id) || null }
function cidadeRotulo(c){ return c.zona? `${c.cidade} — ${c.zona}` : c.cidade }
/** regras resultantes: as atuais com os campos que a zona define por cima (só campos conhecidos e do mesmo tipo) */
function cidadeRegras(c, atual){
  const out=clone(atual||DEF.regras);
  CIDADES_CAMPOS.forEach(k=>{ const v=c.regras && c.regras[k]; if(v!==undefined && v!==null && typeof v===typeof DEF.regras[k]) out[k]=v });
  out.cidade=cidadeRotulo(c);
  return out;
}
/** aplica no estado; devolve o que é preciso para desfazer */
function cidadeAplicar(st, id){
  const c=typeof id==="string"? cidadeAcha(id) : id; if(!c) return null;
  const anterior={regras:clone(st.regras), ref:clone(st.regrasRef||{})};
  st.regras=cidadeRegras(c, st.regras);
  st.regrasRef={id:c.id, origem:c.origem||"", lei:c.lei||"", data:c.data||"", ilustrativo:!!c.ilustrativo};
  return anterior;
}
function cidadeDesfazer(st, anterior){ if(!anterior) return false; st.regras=clone(anterior.regras); st.regrasRef=clone(anterior.ref||{id:"",origem:"",lei:"",data:"",ilustrativo:false}); return true }
/** salva (ou substitui pelo nome) na biblioteca local; usado pelo "Salvar" da etapa Regras e pela leitura com IA */
function cidadeSalvarLocal(reg){
  const l=LS.get("gabarito.cidades")||[], nome=reg.nome||reg.cidade||"Sem nome";
  const r={nome, cidade:reg.cidade||nome, zona:reg.zona||"", lei:reg.lei||"", data:reg.data||"", fonte:reg.fonte||"usuário", regras:clone(reg.regras||{})};
  const i=l.findIndex(c=>c.nome===nome); if(i>=0) l[i]=r; else l.push(r); LS.set("gabarito.cidades", l); return r;
}
extendDEF("regrasRef", { id:"", origem:"", lei:"", data:"", ilustrativo:false });
