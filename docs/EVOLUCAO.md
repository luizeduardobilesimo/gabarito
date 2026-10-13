# Evolução v2 do Gabarito — diagnóstico e plano

Base: a "Colinha de Viabilidade — Incorporação Imobiliária" (eficiência de área, fórmulas, indicadores), os testes do Luiz (relevo e ruas não vieram) e o pedido de construção personalizada. Diagnóstico feito sobre o código de 08/10/2026 (commit 02119bc), com os números do estudo padrão rodados no Node.

Tamanhos como no `PLANO.md`: **P** = 1 sessão · **M** = 2–3 · **G** = 4–6.

---

## 1. O que o sistema atende hoje frente à colinha

Números do estudo padrão (DEF):
- Área total construída (ATC): 13.025 m², contando 3.411 m² de subsolos.
- Área privativa vendável (APV): 6.373 m². Eficiência global (APV ÷ ATC): **48,9%**.
- VGV: R$ 68,4 mi, ou R$ 10.728/m².
- Obra: R$ 42,8 mi, ou R$ 3.284/m² de ATC. Terreno: 3,9% do VGV.
- Soft costs: 17,8% do VGV.
- Margem: 16,4% sobre a receita nominal, ou 18,1% sobre o VGV.
- TIR: 16,5% a.a. V/C: 3,40 contra o CUB puro, 2,83 contra CUB × fator.

**Atende**
- VGV = área × preço: por tipologia e cobertura, mais lojas; ou unidade a unidade com prêmios. É mais fino que a colinha.
- TIR, VPL, exposição e payback: fluxo mensal, com a TIR anualizada corretamente (`finance.js:61`).
- Terreno à vista, permuta física e financeira, e comparação compra × permuta × SPE (`calc/terreno.js`).
- Sensibilidade: tornado, grade preço × custo, cenários e Monte Carlo.

**Atende parcialmente**
- **Custo de obra**:
  - O sistema usa área equivalente (NBR 12721) × CUB × fator, o que é tecnicamente mais correto que o ATC × CUB da colinha.
  - Porém a garagem com peso 0,55 e o fator 1,2 fazem o m² de subsolo custar cerca de 0,66 CUB. Isso é otimista para subsolo com contenção:
    - com peso 0,9, a margem cai de 16,4% para 7,9%;
    - esse peso está escondido em "Mais opções".
  - O CUB padrão não segue a cidade ou estado escolhido.
- **Soft costs**:
  - Já estão modelados item a item: projetos, administração, contingência, marketing, corretagem, RET, ITBI e outorga.
  - Mas falta o total "% do VGV" com a faixa de 18–22%.
  - Faltam registro/cartório, seguros, IPTU da obra, jurídico, pós-obra e taxa de gestão.
  - O custo financeiro vem desligado.
- **Imprevistos**: a contingência é só 3% da obra, e não há resultado "após riscos" (a colinha fala em 5–10%).
- **Alavancas**: a sensibilidade existe, mas não há o painel direto "+5% de eficiência = +R$ X".

**Não atende**
- **Eficiência global APV ÷ ATC**:
  - Não é calculada nem mostrada.
  - O campo "Eficiência" (80%) é outra coisa: é a eficiência do andar tipo.
  - O `potencial()` usa só a eficiência do andar e por isso superestima.
- **Relação V/C** com semáforo.
- **Terreno % do VGV** com alerta: hoje é só uma linha de apoio sob o campo.

## 2. O que está errado ou enganoso

1. **Margem na base errada para a convenção do mercado.**
   - Margem = lucro ÷ receita nominal (com INCC e reajuste).
   - A colinha (e o mercado) usa lucro ÷ VGV, que hoje não aparece em lugar nenhum.
2. **Metas frouxas.**
   - A margem alvo padrão é 15%, contra 25% na colinha, que diz "abaixo de 20% não toque".
   - A TIR fica verde só por passar a TMA de 12%, mesmo abaixo da meta de 25–30% a.a.
   - Resultado: o sistema aprova negócios que a colinha reprovaria.
3. **Permuta pode contar o terreno duas vezes.**
   - Ao ligar a permuta física, o valor do terreno não é zerado nem avisado.
   - Com 15% de permuta, a margem vai a 3,4%, contra 7,6% com o terreno zerado.
4. **Rótulos enganosos.**
   - O glossário "Custo ÷ CUB" diz que o fator inclui projetos. Mas projetos são cobrados à parte, a 4% da obra, o que convida a contar duas vezes.
   - No DRE, a linha "Obra … com INCC" soma também administração e contingência.
   - `f.terreno` é o preço do terreno mais o ITBI.
5. **Estudo exemplo irreal.**
   - O terreno é 3,9% do VGV, contra 15–20% na prática.
   - O exemplo tem 73 de 97 vagas exigidas, ou seja, está reprovado nas vagas.
6. **Lote fora de Torres buscava dados em Criciúma.** Sem georreferência, a latitude e a longitude padrão (Criciúma/Içara) são usadas em silêncio pela busca do OSM. A busca de relevo herdaria o mesmo problema.
7. **"Limites especiais › Torre" não faz o que parece.** O contorno desenhado é tratado como teto: a torre é encolhida em volta do centro até a área do mix. Não vira a planta desenhada.

## 3. Relevo e ruas — por que não vieram

**Relevo**
- O sistema **não busca relevo nenhum**.
- Só existem o desnível frente-fundos digitado (com o sinal ignorado na terra) e a importação de arquivo CSV/KML/DXF.
- Fontes testadas de verdade, do navegador, em Torres:
  - **AWS Terrain Tiles (Terrarium, SRTM 30 m)**: grátis, sem chave, com CORS, cerca de 0,5 s. Fonte principal recomendada.
    - É modelo de superfície, com prédios e árvores, e tem cerca de ±1,5–3 m de ruído.
    - Morro do Farol: 21% de inclinação, descendo para SO, ajuste coerente. Útil.
    - Centro de Torres (plano): resultado não conclusivo (a direção gira 90° entre janelas). Abaixo de ~3% o sistema deve dizer "plano ou inconclusivo".
  - **Open-Meteo**: tem CORS, mas é 90 m e só para uso não comercial. Fica apenas como reserva no protótipo.
  - **ANADEM (UFRGS, terreno sem prédios, ~1,5 m de erro)**: a melhor fonte para o Brasil, mas só por importação de GeoTIFF.
  - OpenTopoData e Copernicus: sem CORS, só com proxy (backend).

**Ruas**
- A consulta funciona: em Torres vieram 120 vias, 81 com nome.
- Mas os servidores públicos do Overpass oscilam: numa segunda rodada, minutos depois, os 4 espelhos falharam.
- Nenhuma via tem largura cadastrada; tudo é estimado pela classe.
- **As ruas não entram em nenhum número.** A frente, o recuo frontal, o acesso de veículos e a esquina são marcados à mão. Nenhuma regra usa a largura da via.

## 4. Plano

### Fase A — "Saúde do negócio" (indicadores da colinha) — **M**
Objetivo: abrir a Viabilidade e ver em 5 segundos se o negócio fecha, na linguagem da colinha.

- **Cálculo** (`model.js areasFin`, `finance.js`, roda no Worker):
  - `m.eficGlobal = priv ÷ ATC`;
  - `f.margemVGV = lucro ÷ VGV`;
  - `f.vc = preço/m² ÷ (CUB × fator)`, guardando também a versão contra o CUB puro;
  - `f.terrenoPctVGV`, contando a permuta como terreno equivalente;
  - `f.softPctVGV`;
  - `f.custoM2ATC`.
- **RES "Saúde do negócio"** no topo da Viabilidade, com 6 números e semáforo de 3 níveis. Cada um tem ⓘ com fórmula e referência:
  - **Eficiência**: faixa pela tipologia detectada (subsolo 50–58%, garagem em pavimento 55–62%, muito lazer 45–52%, sem elevador 65–75%, studios 60–68%).
  - **Margem s/ VGV**: abaixo de 20% "não toque", 20–25% atenção, a partir de 25% ok.
  - **TIR**: comparada a uma TIR alvo nova, 25% a.a. A TMA continua só para o VPL.
  - **V/C**: abaixo de 2,5 cuidado, 2,5–3,5 saudável, acima de 3,5 excelente.
  - **Terreno % VGV**: até 15% ok, 15–20% atenção, acima de 20% compromete.
  - **Soft costs % VGV**: faixa de 18–22%.
- **KPI "Eficiência"** na régua do palco, e o mesmo bloco no PDF e no modo apresentação.
- **Correções**:
  - margem s/ VGV como principal, com a margem s/ receita como segunda linha;
  - aviso ou zerar o terreno ao ligar a permuta;
  - rótulos do DRE e do glossário;
  - renomear o campo "Eficiência" para "Eficiência do andar";
  - aviso "custo financeiro desligado" no resultado.
- **Glossário**: Eficiência global, APV, ATC, V/C, Soft costs, Margem s/ VGV, TIR alvo.
- **Critério de pronto**: os 5 estudos de referência com os mesmos números de cálculo (só entram indicadores novos); teste dos indicadores; telas sem corte.

### Fase B — "Ler o local": georreferência, relevo e ruas que entram no estudo — **M/G**
Objetivo: um botão na etapa Terreno, **"Ler o local"**, que traz relevo e ruas e **propõe** (o usuário confirma) a frente, o desnível e o acesso.

1. **Georreferência obrigatória para buscas** — **P** — **FEITO** (08/10/2026)
   - Criar `S.lote.geo`, verdadeiro quando o lote vem de Mapa, Coordenadas ou GeoJSON.
   - Sem ela, as buscas pedem "posicione o lote no mapa" em vez de buscar em Criciúma.
   - Feito: `S.lote.geo` (estudo antigo só conta como posicionado se já tinha lat/lon próprios, contexto ou prédios do OSM); `aplicarLoteGeo` e a digitação de lat/lon marcam; sem ela, "Buscar entorno do OSM", "Detectar frentes" e qualquer outra busca externa por coordenadas (ex.: relevo) devem checar `S.lote.geo`. A mensagem tem atalhos para o mapa e para o card Localização (`geoFoco()`).
2. **Relevo** — **M**
   - `src/calc/relevo.js` (puro, testado):
     - decodificar o Terrarium;
     - amostrar em grade em volta do lote;
     - ajustar um plano robusto (descarta prédios e árvores);
     - medir a confiança (inclinação × ruído × estabilidade da direção);
     - gerar pontos para o `S.topo` atual (corte, aterro e contenção já existentes passam a valer);
     - montar um plano a partir das cotas dos cantos.
   - `src/ui/relevo.js`: busca dos tiles e card.
   - Resultado em uma linha: "inclinação 17% · desce para SO · confiança média".
   - Em "Mais opções", **cotas dos cantos do lote editáveis**, para quando o Luiz tiver levantamento ou Google Earth. É simples e exato.
   - Depois: importar GeoTIFF ANADEM.
3. **Ruas → frentes** — **M** — **FEITO** (08/10/2026)
   - `src/calc/frente.js` (puro):
     - para cada lado do lote, achar a via paralela e próxima (nome, classe, largura estimada);
     - sugerir as frentes, a principal, a esquina e o acesso de veículos pela via de menor hierarquia.
   - A largura fica editável por lado.
   - Opcional, desligado: regras dependentes da largura da via, com "conferir na lei".
   - Feito: `ruasDoLote`, `sugereFrentes`, `sugereAcesso`, `regraPorLargura`, `frenteDetectar/Aplicar` + `ui/frente.js` (botão "Detectar frentes pelas ruas", sugestão confirmada pelo usuário, largura editável no lado, tabela por largura em "Mais opções"). Limitação do modelo: o acesso de veículos fica sempre na frente principal; por isso o usuário escolhe qual das frentes é a principal (a sugestão traz a de maior hierarquia como principal e indica a de menor para o carro).
4. **Busca mais resiliente** — **P/M** — **FEITO** (08/10/2026)
   - guardar o último resultado bom do estudo;
   - consulta leve só de vias quando a completa falhar;
   - reserva por tile vetorial (OpenFreeMap) se todos os espelhos falharem;
   - mensagem clara quando o app está no artifact do claude.ai (onde buscas externas são bloqueadas).
   - Feito: `ctxBuscaResiliente` (completa → leve → tile), decodificador `calc/mvt.js`, "usando a última busca de <data>", "Tentar de novo" e a dica do `localhost:5173`. Corrigido também o limite do `mapaOverpass`: na falha total ele esperava 80 s; agora desiste ao falhar os 4 espelhos nas 2 rodadas. Testado com mocks (`tests/contexto.test.js`) e, na rede real, o tile de Torres (z14, ~190 KB) vira 16 vias com nome em 1,4 s.
   - Pendências: o tile traz só vias com nome/classe (sem largura nem prédios); a reserva usa 1 a 4 tiles z14 e não guarda cache entre sessões.

### Fase C — Construção personalizada (desenhar os pavimentos) — **G**
Princípio: **um conceito só, o "bloco"**.
- Um bloco é um contorno que vale de um andar até o próximo bloco; a torre é uma pilha de blocos.
- Torre simples = 1 bloco. Embasamento + tipo + cobertura recuada = 3 blocos.
- Não há modo pavimento a pavimento separado (seria um bloco por andar, se alguém quiser).

**Como fica para o usuário**
- Produto › seção "Forma das torres": **Automática | Desenhada**.
- **"Personalizar esta torre"** copia a forma automática atual para um bloco editável. Nunca começa do zero e nada pula na tela.
- O bloco é editado na implantação com as **mesmas ferramentas do entorno**, que o Luiz já conhece:
  - arrastar e girar;
  - ±tamanho;
  - vértice novo no meio da aresta e clique duplo para remover;
  - pátio;
  - duplicar e apagar.
- Formatos prontos: retângulo, L, U, T, H e pátio.
- Lista compacta de blocos ("1º–3º · 1.200 m²") com "+ Bloco", "Copiar do de baixo" e "Recuar X m".
- O total de andares continua no stepper atual (o último bloco estica), então "Máx", o otimizador e os cenários seguem funcionando.
- Avisos automáticos:
  - fora do lote ou dos recuos;
  - acima do CA, TO ou gabarito;
  - balanço;
  - núcleo cortado;
  - distância entre torres;
  - "o mix ocupa 62% do pavimento", com o botão "Ajustar mix".
- Ctrl+Z vem de graça (histórico atual). Voltar para "Automática" não apaga os blocos.

**Etapas**
- **C0 — P (ganho rápido)**: o "Limite especial da torre" (convexo) passa a ser a planta (opção "ocupar o contorno"), em vez de teto. — **FEITO** (13/10/2026)
  - Feito: interruptor "Torre ocupa o contorno desenhado" em Terreno › Limites especiais (`S.custom.torOcupa`, desligado). O contorno recortado pelos recuos vira a planta; as unidades do mix crescem ou encolhem até preencher o andar (`t.r` pode passar de 1); "Ajustar mix" muda a quantidade por andar para elas voltarem ao tamanho do mix. Avisos: unidades fora do mix, TO excedida (a planta não encolhe), torres com andares desiguais. Aceita contorno não convexo (L) nos números. `calc/blocos.js`, `tests/blocos.test.js`.
- **C1 — M**: forma livre da torre, com um bloco e formatos prontos. — **FEITO** (13/10/2026; ver `PLANO.md` › Andamento Fase C)
  - Antes disso, Fase 0 técnica: sol, orçamento, DXF/IFC e unidades lendo a planta por faixa, o que já corrige as torres escalonadas atuais.
- **C2 — M**: pilha de blocos. — **FEITO** (13/10/2026; ver `PLANO.md` › Andamento Fase C)
  - O núcleo é contínuo, com layout detalhado no bloco de referência e layout por área nos demais.
- **C3 — M/G, opcional**: L/U/H com layout real por ala. — **FEITO** (13/10/2026; ver `PLANO.md` › Andamento Fase C)
  - Até lá, essas formas funcionam nos números, mas o núcleo pode cair no vão; a tela avisa.
  - Hoje o motor do pavimento tipo assume uma forma quase retangular.
- Modo "Automática" fica como padrão e intocado: estudos de referência iguais.

### Fase D — Alavancas e otimização pela eficiência — **M** — **FEITO** (13/10/2026)
- Feito: card "Alavancas" (Viabilidade › Riscos; +5% eficiência, +5% preço, −10% terreno, −5% obra, +1 pavimento; Δ lucro, Δ margem s/ VGV, Δ TIR); `potencial()` pela eficiência global e `m.hLim`; otimizador, tornado, grade e Monte Carlo pela margem s/ VGV; eficiência global e V/C como critérios opcionais na fronteira de Pareto; fronteira de ~13 s para ~9 s (com 150 prédios no entorno), teto de 15 s. Falta (com a Fase C): otimizar o mix para uma forma desenhada.
- Card **"Alavancas"** na Viabilidade, calculado só quando aberto.
  - Linhas: +5% eficiência, +5% preço e −10% terreno.
  - Cada linha mostra Δlucro, Δmargem e ΔTIR.
  - Exemplo do estudo padrão: +5% no preço dá +R$ 3,4 mi e a margem passa de 16,4% para 19,8%.
- `potencial()` passa a usar a eficiência global.
- O otimizador ganha o critério eficiência global (e V/C) na fronteira de Pareto.
- Com a Fase C: otimizar o mix para uma forma desenhada.

### Fase E — Calibração com dados reais (depende do Luiz) — **P cada**
- CUB atual por estado e padrão, e o peso da garagem (0,55 hoje) a partir de obras recentes.
- Itens de soft cost que faltam, como % padrão.
- Metas da empresa: margem, TIR alvo e TMA.
- Novo estudo exemplo realista: terreno 12–15% do VGV e vagas atendidas.

## 5. Ordem recomendada
1. **A** (rápida, muda a leitura do negócio e corrige a base da margem).
2. **B1 + B2** (relevo, o que o Luiz mais precisa) → **B3 + B4** (ruas).
3. **C0** (ganho rápido) → **C1** → **C2** → (C3 se fizer falta).
4. **D**, e **E** conforme os dados chegarem.

Total estimado: cerca de 12 a 18 sessões. A + B entregam a parte mais crítica em cerca de 5 a 7.

## 6. Decisões do Luiz
- Margem principal sobre o VGV (recomendado) e metas padrão: margem 25% com piso 20%, TIR alvo 25% a.a., TMA 15%.
- Peso da garagem no custo (0,55 hoje): manter, ou subir para ~0,8 até haver dado real? Muda os números dos estudos.
- V/C principal: preço ÷ (CUB × fator), recomendado, ou preço ÷ CUB puro, como no exemplo da colinha (12.000 ÷ 3.000 = 4,0).
- Estudo exemplo: torná-lo realista (terreno ~15% do VGV, vagas atendidas)?
- Onde foram os testes de relevo e ruas: no artifact do claude.ai ou no `npm run dev`? No artifact, buscas externas são bloqueadas.
