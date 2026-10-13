# Plano de evolução do Gabarito

Roteiro para implementar, no Claude Code, todas as melhorias sugeridas. Está em ordem de execução: cada fase prepara o terreno para a seguinte. Cada item traz objetivo, como fazer, onde mexer, critério de pronto e tamanho estimado.

Tamanhos: **P** = 1 sessão de trabalho · **M** = 2 a 3 sessões · **G** = 4 a 6 sessões · **GG** = mais de 6 sessões.

---

## Princípios que valem para todos os itens

- **Português do Brasil** em toda a interface; visual premium com os tokens e componentes do `shell.html` (ver `CLAUDE.md`).
- **Nada quebra o que já existe:** todo campo novo de estado entra em `DEF` (state.js) e tem migração em `merge()`; estudos salvos antigos precisam abrir.
- **Cálculo separado de desenho:** a regra nova mora num módulo de cálculo puro (sem DOM); a tela só lê o resultado (`m`, `f`).
- **Definição de pronto de cada item:**
  1. funções puras com teste automático;
  2. captura de tela (desktop e celular, claro e escuro) sem erros no console;
  3. `CLAUDE.md` atualizado;
  4. artifact publicado e arquivos gravados em `C:\DEV\Gabarito`.
- **Desempenho:** nenhuma interação de controle deslizante pode travar a tela por mais de 100 ms. Cálculo pesado vai para o Web Worker (item 0.3).

---

## Fase 0 — Fundação

Antes dos recursos novos: deixa o código preparado para crescer sem virar um arquivo impossível de manter.

### 0.1 Módulos, TypeScript e Vite — **G**

- **Objetivo:** sair da concatenação de arquivos globais (`build.py`) para módulos ES com tipos, sem perder a entrega em arquivo único para o artifact.
- **Como:**
  1. `npm create vite` (vanilla-ts) dentro de `C:\DEV\Gabarito`. O `vite-plugin-singlefile` gera um `index.html` único, igual ao de hoje.
  2. Migrar arquivo por arquivo, trocando globais por `import/export`. Ordem sugerida: `geom` → `state` → `finance` → `layout` → `garagem` → `programa` → `model` → `optim` → `clima` → `plan2d` → `view3d` → `wind3d` → `ui/steps/views` → `main`.
  3. Começar com `allowJs` e `checkJs` e tipar primeiro o núcleo de dados: `Estado`, `Modelo`, `Financeiro`, `LayoutGaragem`, `Pavimento`.
  4. three.js via npm (`three@0.128` no início; atualizar depois, com cuidado, por causa do `outputEncoding`).
  5. Manter o `build.py` funcionando até a migração terminar.
- **Critério de pronto:** `npm run build` gera `dist/index.html` funcionalmente idêntico ao atual (mesmas capturas de tela); `npm run dev` com recarga automática.
- **Risco:** pequenas diferenças de comportamento ao trocar globais por imports. Mitigação: testes do item 0.2 antes de migrar cada módulo.

### 0.2 Testes automáticos — **M**

- **Objetivo:** mudar o motor (garagem, finanças, térreo) com segurança.
- **Como:**
  - **Vitest** para funções puras:
    - `geom`: área, recorte, faixas;
    - `finance`: fluxo conhecido → TIR/VPL esperados;
    - `garagem`: pavimento retangular simples → nº de vagas conhecido, rota existente;
    - `programa`: zonas do térreo sem sobreposição.
  - **Estudos de referência** (`tests/cenarios/*.json`): o exemplo atual, lote estreito 20×40, lote de esquina, 3 subsolos alternados, subsolo + garagem elevada. Para cada um, guardar o resultado esperado (vagas por pavimento, CA, altura, lucro) com tolerância.
  - **Playwright** (evolução de `tools/screens.js`): percorre as 7 etapas nos dois temas e compara com capturas de referência (diferença de pixels).
- **Critério de pronto:** `npm test` roda em menos de 1 minuto. Qualquer mudança que altere vagas, CA ou lucro do cenário de referência aparece no teste.

### 0.3 Cálculo pesado em segundo plano (Web Worker) — **M**

- **Objetivo:** a tela nunca trava. Hoje o cálculo completo leva cerca de 1 s e o "melhor acesso" de 4 a 8 s.
- **Como:**
  - Mover `compute`, `garagens`, `otimizar` e `acessoAvalia` para um Worker (`src/worker/calc.ts`), com mensagens tipadas (wrapper estilo Comlink).
  - Na interface: o modo rápido continua na tela principal; o completo vai para o Worker e substitui o resultado quando chega. Cada pedido tem um número, e respostas antigas são descartadas.
  - Cache dos layouts de garagem por assinatura dentro do Worker (`_garCache`). Opcional: IndexedDB para manter o cache entre sessões.
  - Indicador discreto "calculando…" na régua de KPIs.
- **Critério de pronto:** arrastar qualquer controle mantém 60 fps; o otimizador e o estudo de acesso rodam sem travar a página e podem ser cancelados.

### 0.4 Desfazer/refazer e histórico de versões — **M**

- **Objetivo:** errar sem medo e voltar a qualquer ponto do estudo.
- **Como:**
  - Pilha de alterações sobre o estado `S`: a cada mudança confirmada (fim de arraste, troca de campo), guardar a diferença (JSON Patch). Limite de 200 passos.
  - Ctrl+Z / Ctrl+Shift+Z e botões no topo (no celular, ao lado do nome do estudo).
  - **Histórico de versões:** salvamento automático a cada 5 minutos com mudança, mais versões nomeadas pelo usuário. Lista na etapa Cenários com data, autor e principais números; botões abrir, comparar e restaurar. Fica no IndexedDB agora e vai para a nuvem no item 4.1.
- **Critério de pronto:** desfazer funciona em todas as etapas, inclusive arrastes nas plantas e marcação de vagas; restaurar uma versão reproduz exatamente os números daquela versão.

---

## Fase 1 — Diferenciais de mercado

### 1.1 Preço por unidade com sol, orientação, andar e vista — **G** (prioridade máxima)

- **Objetivo:** gerar a tabela de vendas real, unidade por unidade, valorizando as melhores. Nenhum concorrente liga insolação ao VGV.
- **Modelo de dados:** `m.unidades[]` com:
  - torre, andar, final;
  - área privativa e tipologia;
  - polígono e fachadas da unidade (direção e comprimento de cada fachada externa);
  - `sol: {inverno, equinocio, verao, media}` (horas de sol direto);
  - `vista` (0 a 1);
  - `premios` e `preco`.
- **Cálculo do sol nas fachadas:**
  - Amostrar pontos no meio da altura de cada pavimento ao longo das fachadas da unidade, a cada 1,5 m.
  - Para cada dia de referência (21/jun, 21/set, 21/dez), traçar raios a cada 15 min contra o próprio prédio, as outras torres e o entorno. Reaproveitar `sunVectorAt` e a geometria de `prisms`.
  - Descartar o sol que bate de costas para a fachada.
  - Rodar no Worker (0.3), com cache pela assinatura da geometria.
- **Vista:** fração do céu visível na direção da fachada (amostragem em leque contra o entorno), mais a altura do andar.
- **Modelo de preço (premissas em Viabilidade, card novo "Tabela de vendas"):**
  - preço base da tipologia (o mix atual);
  - prêmio por andar (% por andar acima do 1º, com teto);
  - prêmio de sol (% por hora média acima da mediana do prédio, com piso negativo para unidades muito sombreadas);
  - prêmio de orientação (N/NE/L…, padrão configurável para o hemisfério sul);
  - prêmio de vista e prêmio de cobertura.
  - O VGV passa a ser a soma das unidades. A opção "preço médio" continua existindo.
- **Telas:**
  - **3D:** cada unidade colorida pelo preço ou pelas horas de sol (escolha na legenda); toque mostra o cartão da unidade.
  - **Planta tipo:** a cor da unidade muda conforme o andar escolhido.
  - **Tabela de vendas:** ordenável e filtrável por torre e andar, exportável em XLSX/CSV e incluída no PDF.
- **Critério de pronto:**
  - unidades de canto norte no topo com o maior preço;
  - unidades sombreadas por vizinho alto com desconto;
  - soma das unidades = VGV;
  - teste com prédio isolado e orientação conhecida conferindo as horas de sol.

### 1.2 Unidades por dentro (cômodos) — **GG**

- **Objetivo:** mostrar que a tipologia cabe e funciona, não só a área.
- **Como:**
  - **Biblioteca de modelos paramétricos** por tipologia (studio, 1, 2 e 3 dormitórios, suítes). Cada modelo é uma lista de cômodos com área mínima, proporção, vínculo à fachada ou ao corredor e adjacências (cozinha junto da área de serviço, banheiro junto do shaft).
  - **Algoritmo:** dividir o polígono da unidade em faixas. A faixa social fica na fachada; a faixa íntima também (dormitórios precisam de janela); a faixa molhada fica junto do corredor e dos shafts do núcleo. Depois, cortes perpendiculares com as áreas-alvo, como no `tipoLayout` atual. Testar 2 ou 3 variações e escolher pela pontuação de adjacências.
  - **Validação** com o código de obras (áreas e dimensões mínimas por cômodo, iluminação e ventilação ≥ 1/6 da área do piso). Alertas por unidade.
  - **Desenho:** paredes com espessura, portas, janelas e mobiliário simples (camada que liga e desliga). DXF por camada; IFC com paredes e espaços.
- **Fases do item:**
  1. desenho automático;
  2. edição manual de paredes (arrastar divisões);
  3. salvar variações por tipologia.
- **Critério de pronto:** todas as unidades do exemplo com cômodos válidos, sem cômodo sem janela, e o quadro de áreas por cômodo no PDF.

### 1.3 Otimizador com vários critérios — **M**

- **Objetivo:** escolher entre lucro, atendimento de vagas, insolação e conforto ao vento vendo as trocas entre eles.
- **Como:**
  - Ampliar `otimizar()`. Cada combinação testada guarda lucro, margem, TIR, vagas/exigidas, sol médio das unidades (do item 1.1, com o rápido) e índice de vento (opcional, pelo vento 2D, que é mais leve).
  - Calcular a **fronteira de Pareto** (combinações que nenhuma outra supera em todos os critérios).
  - **Tela:** gráfico de dispersão (lucro × sol, com tamanho = vagas), pontos da fronteira destacados, filtros mínimos ("vagas ≥ exigidas", "sol médio ≥ 3 h") e aplicar com um toque.
- **Critério de pronto:** a fronteira aparece em menos de 15 s no Worker; aplicar um ponto reproduz os números mostrados.

### 1.4 Impacto de vizinhança (sombra nos vizinhos) — **M**

- **Objetivo:** responder "quanto sol o prédio tira dos vizinhos", útil para aprovação e estudo de impacto de vizinhança.
- **Como:**
  - Horas de sol nos lotes e fachadas do entorno com e sem o empreendimento, nos dias 21 de cada mês. Reaproveita o traçado do item 1.1.
  - Mapa da diferença (horas perdidas) na planta e no 3D; números por vizinho (horas perdidas no inverno, área afetada > 2 h).
  - Animação anual da sombra (aproveita o "Animar o dia").
  - Página "Impacto de vizinhança" no PDF.
- **Critério de pronto:** com um vizinho ao sul de um prédio alto, a perda de inverno aparece e bate com um cálculo manual simples.

---

## Fase 2 — Precisão técnica

### 2.1 Garagem completa — **G**

- **Rampas curvas e em L:**
  - novos tipos em `vertical()`: rampa helicoidal (raio interno ≥ 3 m, externo ≥ 7,5 m) e rampa com patamar intermediário em L;
  - o portal e o patamar mudam de orientação; a faixa vira polígono curvo (aproximado por segmentos);
  - a malha de verificação já aceita qualquer formato.
- **Elevador de carros (lote estreito):**
  - vaga de espera e de acomodação na entrada, poço com cabine de 2,7 × 5,8 m, tempo de ciclo e capacidade por hora;
  - alerta se a fila prevista passar do limite;
  - entra como alternativa no "Encontrar o melhor acesso".
- **Vagas presas (gaveta):** pares em tandem nas sobras, com limite de unidades que aceitam vaga presa e regra de vinculação; contam separado no quadro.
- **Motos e bicicletas:**
  - motos 1,0 × 2,2 m nas sobras pequenas (o `infill` com outro tamanho);
  - bicicletário por área ou por nº de unidades (regra da cidade).
- **Carro elétrico:** % de vagas com ponto de recarga, posição perto do quadro, custo por ponto na viabilidade.
- **Critério de pronto:** lote 15 × 40 resolvido com elevador de carros; rampa helicoidal validada pela malha; quadro de vagas por tipo (comum, presa, PCD, idoso, moto, EV).

### 2.2 Malha estrutural coordenada — **G**

- **Objetivo:** pilares que funcionam na torre e na garagem, com custo da transição quando não alinham.
- **Como:**
  - Gerar a malha a partir do módulo da garagem (3 vagas + pilar ≈ 8,0 m; 2 vagas ≈ 5,4 m) e casar com a planta tipo: pilares nas paredes entre unidades e no núcleo.
  - Detectar pilares da torre que caem em corredor ou vaga na garagem: marcar como **transição**, com custo por viga de transição e alerta.
  - Pilares nas plantas de todos os pavimentos e no 3D.
  - O otimizador pode testar 2 ou 3 malhas.
- **Critério de pronto:** nenhuma vaga com pilar dentro; nº e custo de transições exibidos.

### 2.3 Terreno real: topografia, corte e aterro, contenção — **G**

- **Como:**
  - Importar pontos cotados ou curvas de nível (CSV, KML, DXF) e montar a superfície por triangulação (Delaunay, com a biblioteca `delaunator`).
  - Cota ótima do térreo (minimiza corte + aterro respeitando a soleira na calçada).
  - Volume de corte e aterro por pavimento de subsolo.
  - Contenção (perímetro do subsolo × profundidade, por tipo: cortina, estaca prancha), com custo por m².
  - Nível do lençol freático informado → custo de rebaixamento e impermeabilização.
  - Terreno em relevo no 3D.
- **Critério de pronto:** terreno inclinado de exemplo com volumes coerentes (conferidos à mão por seções) e custos aparecendo no orçamento (item 3.1).

### 2.4 Regras avançadas de forma — **M**

- **Recuos progressivos:** afastamento por faixas de altura (por exemplo, até 12 m: 2 m; depois H/6). O envelope deixa de ser uma extrusão única e vira pilhas de polígonos por cota. Mexe em `massing` e nos desenhos.
- **Torres escalonadas:** pavimentos com plantas diferentes (terraços nos recuos), com o mix por faixa de andares.
- Altura máxima do embasamento, cota de soleira e planos de proteção (aeródromo), quando houver.
- **Critério de pronto:** envelope escalonado correto no 3D e CA e área recalculados por faixa.

### 2.5 Normas automáticas — **G**

- **Bombeiros (IN 09 SC, saídas de emergência):**
  - população por pavimento e larguras mínimas;
  - nº de escadas e tipo exigido pela altura e ocupação;
  - distância máxima a percorrer, medida no pavimento tipo pelo caminho real até a escada (reaproveita a malha da garagem);
  - elevador de emergência quando obrigatório.
- **Acessibilidade (NBR 9050):** % de vagas PCD e idoso, rotas acessíveis do acesso de pedestres ao hall e aos elevadores, unidades adaptáveis.
- **Tela:** checklist "Normas" dentro de Regras, com status (atende / atenção / não atende) e o porquê. Cada regra vira uma função testável, com a fonte citada.
- **Atenção:** as tabelas das INs precisam ser conferidas pelo Luiz ou por projetista antes de liberar; ficam marcadas como "preliminar" até lá.
- **Critério de pronto:** exemplo com 70 m acusa a escada correta e a distância a percorrer dentro do limite.

---

## Fase 3 — Viabilidade financeira

### 3.1 Orçamento paramétrico por sistema — **G**

- **Objetivo:** sair de "CUB × fator" para custo por sistema, calibrado pelo CUB.
- **Sistemas e direcionadores:**
  - fundação: nº de pavimentos, área de projeção e tipo de solo;
  - contenção (item 2.3) e movimento de terra;
  - estrutura: área equivalente e transições (item 2.2);
  - vedações; fachada (área de fachada × padrão: textura, porcelanato, pele de vidro);
  - instalações (área + nº de unidades);
  - elevadores (quantidade × paradas);
  - acabamentos por padrão; lazer (já existe);
  - canteiro e administração.
- **CUB por estado e padrão** (R8-N, R16-A…) numa tabela importável. Atualização manual mensal com data de referência; fonte Sinduscon.
- **Tela:** card "Orçamento" com gráfico de barras por sistema, custo/m² e comparação com o CUB.
- **Critério de pronto:** o total paramétrico do exemplo fica dentro de ±10% do método atual com os coeficientes padrão; cada coeficiente é editável.

### 3.2 Curvas, cenários e riscos — **M**

- **Curva de obra** em S parametrizada (início, pico, fim), com desembolso por sistema seguindo o cronograma.
- **Recebimento detalhado:**
  - ato, mensais, intermediárias (semestrais), chaves e repasse bancário;
  - distratos (% e mês);
  - correção INCC até as chaves e IPCA depois.
- **Cenários:** pessimista, base e otimista (preço, velocidade de vendas, custo, juros).
- **Gráfico de sensibilidade:** barras horizontais ordenadas pelo impacto de cada variável na margem e na TIR.
- **Monte Carlo opcional:** 1.000 rodadas no Worker, com P10/P50/P90 de TIR e lucro.
- **Critério de pronto:** o fluxo bate com uma planilha de referência do Luiz (pedir um caso real para validar).

### 3.3 Terreno: permuta × compra × parceria — **M**

- **Alternativas:** compra à vista, compra parcelada, permuta física (unidades escolhidas da tabela de vendas do item 1.1), permuta financeira (% do VGV ou da receita) e SPE com o terreneiro.
- **Fluxo do terreneiro** (quando e quanto ele recebe) e VPL de cada alternativa para os dois lados.
- **Ponto de indiferença:** "qual % de permuta equivale ao preço pedido em dinheiro".
- **Critério de pronto:** comparação lado a lado na etapa Viabilidade e no PDF.

---

## Fase 4 — Plataforma e experiência

### 4.1 Nuvem: estudos, versões e regras por cidade — **G**

- **Como:**
  - **Supabase**: login, Postgres e arquivos. Tabelas:
    - `estudos` (dono, nome, estado atual);
    - `versoes` (do item 0.4);
    - `cidades_regras` (cidade, zona, parâmetros, lei e data);
    - `compartilhamentos`.
  - **Funciona sem internet:** grava local primeiro e sincroniza depois (conflito = última gravação vence, com aviso).
  - **Biblioteca de regras:** a leitura do plano diretor com IA (`ai.js`) salva na nuvem, com revisão humana antes de publicar para todos.
- **Duas versões do produto:**
  - o app completo (Vercel, com login);
  - o artifact (demonstração, local), que pode usar o banco do próprio artifact para guardar estudos compartilhados.
- **Critério de pronto:** abrir o mesmo estudo no computador e no celular; regras de Criciúma e Florianópolis disponíveis para todos.

### 4.2 Modo apresentação e link somente leitura — **M**

- **Link somente leitura:** abre direto numa apresentação guiada:
  - 3D animado;
  - potencial do terreno;
  - produto, tabela de vendas e números-chave;
  - sem campos editáveis.
- **PDF com a marca do usuário** (logo, cores, rodapé) e capa personalizável.
- **Critério de pronto:** link aberto no celular de outra pessoa mostra o estudo sem login e sem permitir edição.

### 4.3 Mapa real e entorno automático — **G**

- **MapLibre GL** com camada de satélite (Mapbox ou ESRI; precisa de chave de API) para desenhar o lote direto no mapa. Latitude, longitude e norte vêm sozinhos (sol e vento ficam corretos sem ajuste).
- **Lote do cadastro municipal:** importar geometria do SIG da prefeitura (GeoJSON/WFS, quando houver).
- **Entorno automático:** prédios do OpenStreetMap (`building`, `building:levels`, `height`) viram volumes do entorno.
- **Observação:** só funciona na versão completa (4.1). O artifact bloqueia mapas externos, então lá fica o fluxo atual de imagem + calibração.
- **Critério de pronto:** desenhar um lote real em Criciúma pelo mapa, com o entorno vindo do OSM, em menos de 2 minutos.

---

## Ordem de execução

1. **Fase 0** (0.2 → 0.1 → 0.3 → 0.4): primeiro os testes, depois a migração, para provar que nada mudou.
2. **1.1 Preço por unidade**: maior diferencial, e alimenta 1.3, 1.4 e 3.3.
3. **3.1 Orçamento paramétrico** e **3.2 Curvas e cenários**: a viabilidade fica defensável para banco e investidor.
4. **2.1 Garagem completa** e **2.2 Malha estrutural**: precisão do produto.
5. **1.3 Otimizador com vários critérios** e **1.4 Impacto de vizinhança**.
6. **2.3 Topografia**, **2.4 Regras de forma** e **2.5 Normas**.
7. **3.3 Permuta × compra**.
8. **4.1 Nuvem** → **4.2 Apresentação** → **4.3 Mapa real**.
9. **1.2 Unidades por dentro**: o mais longo; pode correr em paralelo a partir do passo 4.

Esforço total estimado: cerca de 45 a 60 sessões de trabalho. A Fase 0 e o item 1.1 juntos dão cerca de 10 a 12 sessões e já entregam o diferencial principal.

## O que depende do Luiz

- **Decisão:** manter o artifact como demonstração e levar o produto completo para um app web próprio (Vercel + Supabase)? Recomendado.
- **Contas e chaves:** Supabase, Vercel e um provedor de mapa (Mapbox ou ESRI).
- **Dados de mercado** para calibrar os prêmios de preço (andar, sol, orientação, vista): pelo menos uma tabela de vendas real de um lançamento da região.
- **Uma planilha de viabilidade real** já usada pela empresa, para validar o fluxo do item 3.2.
- **Revisão técnica** das tabelas de normas (Bombeiros SC, código de obras de Criciúma) antes de liberar o item 2.5.
- **Coeficientes de custo por sistema** de obras recentes, para calibrar o item 3.1.

## Como pedir cada etapa no Claude Code

Abra o Claude Code em `C:\DEV\Gabarito` e peça, por exemplo:

- "Execute o item 0.2 do PLANO.md."
- "Execute o item 1.1 do PLANO.md, começando pelo cálculo de sol por unidade."

Ao terminar cada item: rodar os testes, gerar o build, publicar e marcar o item como feito na lista abaixo.

## Andamento

Execução de 05/10/2026 (protótipo local, 9 agentes em paralelo sobre a fundação de ganchos). Todos os testes passam (172), capturas desktop/celular claro/escuro sem erros de JS, e os estudos de referência mantêm os números (recursos que mudam números vêm desligados por padrão).

- [~] 0.1 Módulos, TypeScript e Vite — **parcial**: Vite (`npm run dev` com recarga), empacotador único `tools/bundle.mjs`, `tsconfig` com typecheck dos scripts globais. **Falta** a troca de globais por `import/export` — fica para o MVP, junto com o backend.
- [x] 0.2 Testes automáticos — Vitest (`tests/`, harness em Node), 5 estudos de referência (`tests/cenarios`), Playwright `tools/screens.cjs all`. Falta: comparação de capturas por diferença de pixels.
- [x] 0.3 Cálculo em segundo plano — `ui/calcworker.js`; otimizador e melhor acesso canceláveis.
- [x] 0.4 Desfazer/refazer e versões — `ui/historico.js`, `ui/estudos.js` (versões no IndexedDB; nuvem no 4.1).
- [x] 1.1 Preço por unidade — `calc/unidades.js`, `ui/vendas.js`. Falta: calibrar prêmios com tabela de vendas real.
- [x] 1.2 Unidades por dentro — `calc/comodos.js`, `ui/comodos.js` (3 fases). Faltam modelos 2 suítes / 4 dorm. / lavabo; portas não recortam paredes no DXF/IFC.
- [x] 1.3 Otimizador com vários critérios — `calc/pareto.js`, `ui/pareto.js`. Atenção: a análise leva ~20 s (meta 15 s).
- [x] 1.4 Impacto de vizinhança — `calc/vizinhanca.js`, `ui/vizinhanca.js`.
- [x] 2.1 Garagem completa — helicoidal, L, elevador de carros, presas, motos, bicicletas, EV, quadro por tipo.
- [x] 2.2 Malha estrutural — `calc/estrutura.js` (desligada por padrão).
- [x] 2.3 Topografia, corte e aterro, contenção — `calc/topografia.js`. Falta: página de topografia no PDF.
- [x] 2.4 Regras avançadas de forma — `calc/forma.js` (desligada por padrão). Pendente: `potencial()`/otimizador ainda usam `hMax` em vez de `m.hLim`; sol e vento usam a planta típica.
- [x] 2.5 Normas automáticas — `calc/normas.js`. **Preliminar: precisa da revisão do Luiz/projetista.**
- [x] 3.1 Orçamento paramétrico — `calc/orcamento.js`, `calc/cub.js` (CUB e coeficientes ilustrativos).
- [x] 3.2 Curvas, cenários e riscos — `calc/fluxo.js`. Falta: validar com a planilha real do Luiz.
- [x] 3.3 Permuta × compra × parceria — `calc/terreno.js`.
- [~] 4.1 Nuvem — **13/10/2026: app web pronto no código** (Vercel + Supabase do Gabarito, entrada pelo protocolo de ferramentas da Rixel, estudos/versões/regras na nuvem, `docs/DEPLOY.md`). Falta: página de lançamento da Rixel, id da ferramenta, variáveis na Vercel, migração no banco, domínio e homologação. Antes: **parte local pronta**: `ui/repo.js` (IndexedDB, interface pronta para trocar), esquema em `docs/supabase/schema.sql`. **Falta** conectar Supabase/login/sincronização (decisão de não conectar nesta fase).
- [x] 4.2 Modo apresentação — `ui/apresentacao.js`, `ui/marca.js`, link `#ver=` local (link curto depende do 4.1).
- [x] 4.3 Mapa real e entorno automático — `calc/geo.js`, `ui/mapa.js` (Overpass só com o app servido por http).
- [x] Cidades com regras pré-cadastradas — `calc/cidades.js` (7 cidades, valores ilustrativos a conferir).
- [x] Escada mais rasa com núcleo na fachada — `layout.js` (vagas mantidas; ver nota no relatório sobre usar o contorno real nas garagens).

## Andamento — Evolução v2, Fase A "Saúde do negócio" (08/10/2026)

- [x] A — Indicadores da colinha: `calc/saude.js` (`saudeNegocio(st,m,f)`: eficiência global, margem s/ VGV, V/C contra CUB × fator e CUB puro, terreno % VGV com permuta, soft costs % VGV, custo/m² de ATC, TIR contra o alvo, tipologia detectada e semáforo por indicador) e `ui/saude.js` (RES "Saúde do negócio" no topo da Viabilidade, KPI "Eficiência" na régua, seção "Metas e referências"). Todas as metas moram em `S.metas` (+ `S.fin.margemAlvo/tma`), com sugestão da colinha, "Restaurar sugeridas" e "Salvar como padrão" (`localStorage gabarito.metas.padrao`; troca por Supabase descrita em `docs/BACKEND.md`). Margem principal agora é lucro ÷ VGV (a margem s/ receita virou linha secundária). Novos padrões: eqGar 0,8 · TMA 15% · margem alvo 25% · TIR alvo 25%. Estudo exemplo realista (terreno ~15% do VGV, vagas atendidas, preços ajustados). Correções: aviso/"Zerar terreno" na permuta, rótulos do DRE e do glossário, "Eficiência do andar", `f.terrenoPreco/terrenoITBI`, aviso de custo financeiro desligado. Testes: `tests/saude.test.js`. **Pendente:** otimizador, tornado e Monte Carlo ainda classificam pela margem s/ receita; `potencial()` ainda usa só a eficiência do andar (Fase D); calibrar eqGar e CUB com obras reais (Fase E).

## Andamento — Evolução v2, Fase C (13/10/2026)

- [x] C0 — Torre ocupa o contorno desenhado: `calc/blocos.js`, `massing` (`S.custom.torOcupa`, desligado por padrão; estudos de referência iguais), interruptor + "Ajustar mix" em Terreno › Limites especiais, linha da torre em Produto, avisos (unidades fora do mix, TO excedida, torres desiguais). `tests/blocos.test.js` (11 testes). Limitações: o mix é o mesmo em todas as torres (com duas torres de andares diferentes as unidades mudam de tamanho; há aviso); o pavimento tipo continua assumindo planta quase retangular (formas em L/U funcionam nos números, o desenho fica aproximado até o C3).
- [x] C1 — forma livre da torre (13/10/2026): `S.blocos` (modo Automática | Desenhada), "Personalizar esta torre" sem mudar números, formatos retângulo/L/U/T/H/pátio, edição na implantação com as ferramentas do entorno (`#blcBar`), avisos (lote, recuos, balanço, núcleo, distância entre torres, CA/TO/gabarito, mix), e a "Fase 0 técnica": sol por unidade, vento/sol/vizinhança, orçamento (fachada), IFC/DXF e 3D lendo a planta de cada faixa (corrige as torres escalonadas da 2.4). Limitações: o sol rápido do otimizador usa a planta da base; pátio no IFC como contorno com ponte; recortes aproximados em lote não convexo.
- [x] Pendências (13/10/2026): cômodos 2 suítes, 4 dorm. e lavabo; portas recortando as paredes no DXF e IfcOpeningElement/IfcDoor no IFC; página "Topografia e relevo" no PDF; prévia do plano do relevo no 3D sem ligar a topografia; importar GeoTIFF (ANADEM) — leitor próprio para TIFF não comprimido; comprimido usa `geotiff@2.1.3` sob demanda (não testado com arquivo real).
- [ ] C2 — pilha de blocos.
- [ ] C3 — L/U/H com layout por ala (opcional).

## Próxima etapa — Evolução v2 (08/10/2026)

Diagnóstico contra a colinha de viabilidade, relevo e ruas automáticos e construção personalizada por blocos: ver `docs/EVOLUCAO.md` (fases A–E, ordem e decisões pendentes do Luiz).
- [x] Evolução v2 · Fase B item 2 (relevo do local) — `calc/relevo.js`, `ui/relevo.js`, `tests/relevo.test.js` (24 testes), `tools/teste-relevo.cjs` (usa a rede). Botão "Buscar relevo do local" no card Topografia: AWS Terrarium z14, plano robusto (rejeição > 2σ), confiança por três janelas, reserva Open-Meteo (só uso não comercial), cotas dos cantos editáveis, aplicar na topografia (`S.topo`) ou só como desnível, seta e % na implantação. Exige `S.lote.geo` (criado por outro agente). Falta: importar GeoTIFF ANADEM (terreno sem prédios), mostrar o plano no 3D sem ligar a topografia, página de relevo no PDF.
- [x] Evolução v2 · Fase B itens 1, 3 e 4 (georreferência, ruas → frentes, busca resiliente) — `S.lote.geo` (sem ela a busca do OSM não roda; atalho para o card Localização), `calc/frente.js` + `ui/frente.js` (botão "Detectar frentes pelas ruas": frentes, principal, esquina/passante, acesso pela via de menor hierarquia, largura editável por lado, regra por largura opcional e desligada; nada muda sem "Aplicar sugestão", Ctrl+Z desfaz), `ctxBuscaResiliente` em `calc/contexto.js` (completa → leve → tile vetorial do OpenFreeMap via `calc/mvt.js`; falha nunca apaga a busca anterior). `tests/frente.test.js`, `tests/contexto.test.js`. Pendências: o acesso de veículos do modelo só existe na frente principal; larguras das vias do OSM quase sempre estimadas pela classe; tabela de recuo por largura é ilustrativa ("conferir na lei").
