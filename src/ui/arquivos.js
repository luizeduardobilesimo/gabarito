/* ================= Fase E: leitura de arquivos CSV/XLSX para os importadores (calibração e comparação de fluxo) =================
   plaLerArquivo(file) → Promise<{matriz, nome, aba?}>. CSV em UTF-8 ou Windows-1252 (Excel em português); XLSX/XLS/ODS pelo SheetJS
   (versão fixa, cdnjs, carregado só na primeira vez). Cálculo da leitura em src/calc/planilha.js. */
const XLSX_URL = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
const PLA_ACCEPT = ".csv,.txt,.tsv,.xlsx,.xls,.xlsm,.ods,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
async function plaLerArquivo(file){
  if(!file) throw new Error("Nenhum arquivo escolhido.");
  if(file.size>8*1024*1024) throw new Error("Arquivo grande demais (máximo 8 MB).");
  const nome=file.name||"arquivo", ext=(nome.split(".").pop()||"").toLowerCase(), buf=await file.arrayBuffer();
  if(/^(xlsx|xls|xlsm|ods)$/.test(ext)){
    try{ await loadScript(XLSX_URL) }catch(e){ throw new Error("Não consegui carregar o leitor de planilhas. Salve como CSV e tente de novo.") }
    const wb=XLSX.read(buf,{type:"array", cellDates:true});
    for(const aba of wb.SheetNames){
      const rows=XLSX.utils.sheet_to_json(wb.Sheets[aba],{header:1, raw:true, defval:""}).filter(r=>r.some(c=>c!==""&&c!=null));
      if(rows.length>=2) return { matriz:rows, nome, aba };
    }
    throw new Error("A planilha não tem dados.");
  }
  let texto; try{ texto=new TextDecoder("utf-8",{fatal:true}).decode(buf) }catch(e){ texto=new TextDecoder("windows-1252").decode(buf) }
  const matriz=plaCSV(texto); if(matriz.length<2) throw new Error("O arquivo não tem dados (preciso do cabeçalho e de pelo menos uma linha).");
  return { matriz, nome };
}
/* baixa um modelo de arquivo (CSV) pelo mesmo caminho dos demais downloads */
const plaBaixarModelo = (nome, texto) => saveFile(nome, texto);
/* <select> para ligar um campo a uma coluna do arquivo */
function plaSelect(id, dataAttr, chave, rot, cab, atual, obrig){
  return `<div class="fld"><label class="fl" for="${id}">${rot}${obrig?" *":""}</label><select class="sel" id="${id}" ${dataAttr}="${chave}">
    <option value="-1">— não usar —</option>${cab.map((h,i)=>`<option value="${i}" ${atual===i?"selected":""}>${esc(h||("Coluna "+(i+1)))}</option>`).join("")}</select></div>`;
}
