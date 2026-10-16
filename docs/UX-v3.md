# Gabarito — especificação de UX v3 (reformulação para comercializar)

Status: **especificação para implementar**. Nada aqui muda números de cálculo nem os 5 estudos de referência (`tests/cenarios`). Este documento cuida de **estrutura, fluxo, conteúdo e hierarquia**. Cores, fontes e tokens ficam com a troca de identidade visual da Rixel, que corre em paralelo (DM Sans, cinzas neutros e laranja `#e8702a` só na ação primária).

Pedido do Luiz: o sistema está complexo demais, com muitos campos e uma ordem que não faz sentido. Ele quer algo intuitivo, que dê para usar sozinho, minimalista, que mostre só informação útil e que não obrigue a voltar nem a trocar de guia.

`docs/UX.md` (v2) continua valendo para os componentes: `SEC`, `RES`, `ADV`, `INFO`, `TERMO` e `SUBTABS`. Esta v3 o substitui no fluxo, na distribuição do conteúdo e nas metas. No fim, o pacote P8 atualiza o `docs/UX.md`.

---

## 1. Diagnóstico (medido em 15/10/2026, estado padrão, desktop 1440)

Fontes: `tools/auditoria-ui.cjs` e um script de duplicatas (`/tmp/claude-0/uxaudit/dup.cjs`, que lista os `data-p` de cada tela).

### 1.1 Tamanho

- **7 etapas e 19 telas** (contando as sub-abas), com **74 seções**, **232 caminhos de estado editáveis**, cerca de **246 campos** e cerca de **400 botões**.
- A v2 já baixou bem os campos *visíveis*: de 0 a 10 por tela. A dor agora é outra:
  - **onde as coisas estão**: 19 lugares diferentes;
  - **quantos botões e seções** há em cada tela (Terreno tem 54 botões; Produto, 43; Viabilidade › Premissas, 49 botões e 11 seções);
  - a **altura do painel**, de 1.000 a 1.240 px em Terreno, Produto, Viabilidade e Garagem.
- Campos totais por etapa:
  - Terreno: 14;
  - Regras: 44 (26 em Prefeitura, 16 em Projeto, 2 em Normas);
  - Produto: 14 (mais as listas);
  - Viabilidade: 103 (68 em Premissas);
  - Projeto: 45;
  - Clima: 21;
  - Cenários: 5.
- A régua de KPIs tem **9 indicadores**, quatro deles siglas: CA, VGV, TIR e eficiência.

### 1.2 O que obriga a voltar ou trocar de guia

1. **Regras › Projeto** guarda decisões de *produto* e de *garagem* longe de onde fazem efeito:
   - os pés-direitos e a eficiência do andar mexem na altura e nas unidades (Produto);
   - largura e comprimento da vaga, corredor, pilar, rampa, PCD e idoso mexem na garagem (Projeto).
2. **Vagas** espalhadas por 3 etapas:
   - a exigência (`regras.vagasApto`) fica em Regras;
   - a oferta (subsolos e garagens elevadas) fica em Produto;
   - a contagem real (o layout) fica em Projeto › Garagem;
   - o status de "faltam vagas" aparece em Produto.
3. **Preço de venda** aparece em 2 lugares: dentro da linha do mix (Produto) e em Viabilidade › Premissas. O **custo do terreno** fica só em Viabilidade, e a **forma de pagar o terreno** está escondida em Viabilidade › *Vendas*.
4. **Acesso de veículos**:
   - o lado e a posição ficam em Terreno (sliders "Acessos");
   - o tipo de rampa e "Encontrar o melhor acesso" ficam em Projeto › Garagem, e esse estudo *reescreve* `S.lote.acessoVei`, que é campo de Terreno.
5. **Duas "formas"**: Regras › "Forma do edifício" (recuos por faixa de altura) e Produto › "Forma das torres" (blocos). E o "Torre ocupa o contorno desenhado" (C0) mora em Terreno › Limites especiais, embora seja decisão de produto.
6. **Normas** (escadas, distância à escada, vagas PCD) ficam em Regras, mas dependem do núcleo e da garagem desenhados em Projeto.
7. **Otimizador** numa sub-aba separada (Produto › Otimizar) do que ele altera (torres e mix).
8. **"Aprovar produto e seguir para o projeto"** grava uma alternativa lá em Cenários (etapa 7). Nada na tela avisa isso.
9. **Entorno** aparece duas vezes, em Terreno e em Clima. Pode ficar, mas deve ser declarado como espelho.

### 1.3 Duplicações

- **Campos duplicados entre telas: 16 caminhos.**
  - 13 deles entre Regras › Projeto e Projeto: `estudo.corrTipo`, `profMin`, `vagaL`, `vagaC`, `corredor`, `porModulo`, `pilar`, `rampaL`, `rampaInc`, `pcd`, `idoso` e `produto.sacProf`.
  - Os outros 3: `produto.cob.preco` (Produto e Viabilidade), `clima.ventoVel` e `clima.overlay3d` (sub-abas de Clima), e `mapa.raio` (Terreno e Clima).
  - Fora da conta, os preços do mix também se repetem, quando a linha está aberta.
- **Resultado repetido**:
  - margem e TIR aparecem 3 vezes na mesma tela de Viabilidade › Resultado: na régua, na "Saúde do negócio" e no "Resultado";
  - mais uma vez no "Resultado" compacto de Premissas.
- **"Cenários" com dois sentidos**: pessimista/otimista em Viabilidade › Riscos e alternativas salvas em Cenários › Estudos.
- **Três ideias de "salvar"** sem hierarquia clara: estudos, versões e cenários.

### 1.4 O que um usuário novo não entende sozinho

- Ele abre em **Produto** (`TAB` padrão = "produto", em `ui.js`), "Etapa 3 de 7", num estudo que **não diz que é exemplo**.
- Não há início guiado: a pessoa não sabe por onde começar nem quanto falta.
- Não está claro o que é obrigatório e o que é refinamento (Clima e Projeto parecem tão obrigatórios quanto Terreno).
- Há jargão sem contexto na primeira tela: CA, TO, VGV, TIR, V/C, Pareto, Monte Carlo, RET, "Mapas" (que na verdade é sol e vento).
- O rodapé só tem "← anterior / próxima →". Não diz o que fazer em seguida.

---

## 2. Novo fluxo: 5 etapas

A jornada do incorporador é: **onde é e o que posso → o que construir → vale a pena? → funciona no desenho? → mostrar e entregar.**

| # | Chave (interna) | Rótulo | Pergunta (subtítulo no `#phead`) | Objetivo | Obrigatória? | Sub-abas |
|---|---|---|---|---|---|---|
| 1 | `terreno` | Terreno | "Onde é e o que a lei permite" | lote, ruas e regras da prefeitura; mostra o potencial | sim | — |
| 2 | `produto` | Produto | "O que construir" | torres, unidades, garagem e lazer, com sugestão automática | sim | — |
| 3 | `viab` | Viabilidade | "Vale a pena?" | resultado e premissas financeiras | sim | Resultado · Premissas · Riscos |
| 4 | `projeto` | Projeto | "Funciona no desenho?" | conferir e refinar garagem, andares, normas, sol e vento | não (refino) | Garagem · Andares · Sol · Vento |
| 5 | `cen` | Entrega | "Mostrar e guardar" | relatório, apresentação, arquivos, alternativas e versões | — | Entregar · Estudos |

Decisões:

- **Regras entra em Terreno.** As regras são do lote: a cidade e a zona saem do endereço, e o resultado do Terreno passa a ser "o que a lei permite neste lote".
- **Clima entra em Projeto.** Sol e vento são verificações, como garagem e andares. Ficam como sub-abas "Sol" e "Vento". Dentro de Vento, uma chave escolhe "No chão (rápido)" ou "Túnel 3D".
- **Ordem natural de preenchimento:**
  - lote → cidade/zona → (o sistema sugere o produto) → preço e terreno → resultado;
  - Projeto e Entrega só quando o resultado interessa.
  - Os itens obrigatórios ficam nas etapas 1 a 3. O checklist (§3.3) diz quando o estudo está "confiável".
- **Chaves internas mantidas** (`terreno`, `produto`, `viab`, `projeto`, `cen`) para diminuir a troca nos testes. As chaves antigas viram aliases:
  - `regras` → `terreno` e `clima` → `projeto`, em `goStep`, em `LS gabarito.step` e em `addCard`;
  - o padrão de `TAB` passa a ser `terreno` para estudo novo, ou a última etapa vista.
- **Sub-abas de Projeto**: `gar | tipo | sol | vento`. O rótulo de `tipo` passa a ser "Andares", e a lista de andares entra nele.
  - `PSUB` guarda a sub-aba de Projeto;
  - `CSUB` continua com o modo de clima (`sol | vento | v3d`);
  - novo helper `emClima()` = `TAB==="projeto" && (PSUB==="sol"||PSUB==="vento")`, que substitui todo `TAB==="clima"`.
- **Sub-abas de Viabilidade**: `res | prem | risco`. A antiga `vendas` some e os cards dela vão para `prem`. Com `subAtual`, uma chave inválida cai na primeira sub-aba.

---

## 3. Início guiado, exemplo e checklist

### 3.0 Tela inicial "Meus estudos" (pedido do Luiz em 15/10/2026 · `src/ui/inicio.js`, pacote P6)

- **Porta de entrada do app** (substitui as "Boas-vindas"): tela cheia sobre o app, com a marca, "Novo estudo" (laranja, abre o assistente `assAbrir`) e as **pastas** dos estudos do usuário (`Repo.estudos.list`), em grade de cartões (lista no celular).
- **Cada pasta**: miniatura do lote e das torres (SVG gerado do estado, função pura), nome, cidade/endereço, data da última edição, **status** (`progressoResumo` do P7: rascunho · em andamento · confiável, com "6/9"), e 3 números (VGV, margem s/ VGV com o ponto do semáforo da Saúde, unidades). Os números vêm de um **resumo gravado junto do estudo** a cada `estGrava` (`resumo:{vgv, margem, nivelMargem, un, feitos, total, nivel, cidade, mini}`), para a tela abrir instantânea sem recalcular; estudo antigo sem resumo mostra "—" e ganha resumo ao ser aberto.
- **Ações por pasta**: abrir (clique), menu "…" com renomear, duplicar, excluir (armar/confirmar, Ctrl+Z ou "Desfazer" no toast). Busca por nome e filtro por status; ordenar por recentes/nome/margem. O estudo de exemplo aparece como pasta "Exemplo" marcada.
- **Voltar à tela inicial**: a marca/logo no topo e o item "Meus estudos" do menu do nome do estudo (P1 chama `inicioAbrir()`).
- **Quando abre**: ao iniciar o app se o usuário tem 0 estudos próprios ou mais de 1 estudo (fora de `#ver=` e com `!navigator.webdriver`, para não quebrar testes); com 1 estudo só, abre direto nele. Preferência lembrada em `localStorage gabarito.inicio`.
- Nuvem (`repo-nuvem.js`) continua transparente: a lista vem do `Repo`.

### 3.1 Assistente "Novo estudo" (`src/ui/assistente.js` + `src/calc/assistente.js`)

- É uma tela cheia por cima do app, criada pelo próprio módulo, como `abreGlossario`, com listener próprio.
- Os campos são locais (objeto `ASS`, sem `data-p`), então nada vai para `S` antes de "Gerar".
- Tem 4 passos curtos, barra de progresso, "Voltar" e "Pular". No celular, ocupa a tela inteira.

| Passo | Pergunta | Campos (no máximo 3) | Liga com |
|---|---|---|---|
| 1. Terreno | "Onde é o terreno?" | Nome do estudo · Como informar: **Frente × fundo** (frente m, fundo m) \| **Mapa** \| **Coordenadas/KML** \| **Desenhar depois** | rect como `ACT.rect`; mapa/coordenadas aplicados depois de "Gerar" via `TMETH="mapa"` + `mapaAbrir()` ou `importCoords()` |
| 2. Regras | "Qual cidade e zona?" | Seletor de `cidadesLista()` (agrupado por fonte), "Outra (digitar)" e "Ler a lei com IA (PDF)" · mostra CA máx., altura, ocupação e recuo frontal, editáveis | `cidadeAplicar(st, id)` (marca `regrasRef`); IA: `aiRun()` no passo seguinte, em Terreno; sem cidade, fica `DEF.regras` e o checklist marca "regras a conferir" |
| 3. Produto | "Que produto e por quanto?" | Padrão: **Compacto \| Família \| Alto padrão** (`MIX_PRESETS` `compacto/familia/alto`) · Preço médio de venda (R$/m², sugestão por padrão) · Preço do terreno (R$, opcional) | `presetMix(st,key,N)`; preço de cada tipologia = preço médio × `pf`; `fin.terreno` |
| 4. Gerando | "Montando o estudo…" (progresso) | — | `assEstado(base, resp)` (puro) → `estNovo(st, nome)` → `otimRodar({...S.otim, obj:"lucro"})` → `aplicarOtim(melhor)` → `goStep("viab")` + cartão "O que fizemos" |

- Se o otimizador não acha combinação, aplica `maxPav`, vai para Produto e mostra um aviso com o motivo.
- Tudo vira **um passo de desfazer** (`histTouch` uma vez, depois de aplicar).
- **Função pura** `assEstado(base, resp)` em `src/calc/assistente.js`:
  - devolve um estado novo a partir de `clone(DEF)`: lote em retângulo, regras da cidade, mix do padrão, preços e terreno;
  - é testável no Node (`tests/assistente.test.js`).
- **Onde se entra no assistente:**
  - menu do nome do estudo → "Novo estudo…";
  - tela de boas-vindas;
  - botão do aviso de exemplo;
  - Entrega › Estudos → "+ Novo estudo".
- **Primeira visita**:
  - condição: `localStorage` sem `gabarito.v2` e sem `gabarito.estudo`, e `!navigator.webdriver` (o Playwright não vê a tela), e fora do modo `#ver=`;
  - aparece a tela "Boas-vindas", com 2 cartões: **Começar um estudo** (assistente) e **Explorar o exemplo**;
  - depois grava `gabarito.boasvindas=1`;
  - a chamada é uma linha no fim de `main.js`: `if(typeof assInicio==="function") assInicio()`.

### 3.2 Estudo de exemplo

- `assEhExemplo(S)` (puro) = nome igual a `DEF.nome` **e** `S.lote.pts` igual a `DEF.lote.pts`. Não há flag em `S`, então estudos antigos não são afetados.
- Enquanto for exemplo, uma faixa fina no topo do inspetor (`#exBanner`, acima do `#phead`) diz: "Estudo de exemplo · **Começar o meu** · Usar como base".
  - "Usar como base" só renomeia o estudo, e com isso deixa de ser exemplo.

### 3.3 Checklist "O que falta para o estudo ficar confiável" (`src/calc/progresso.js` + `src/ui/progresso.js`)

- Função pura `progressoItens(st, m, f)` → `[{k, nome, ok, etapa, sub, sec, dica}]`. Lista fixa de 9 itens:
  1. Lote informado (não é o exemplo, ou `lote.geo`).
  2. Ruas e frente principal marcadas.
  3. Regras da cidade aplicadas ou conferidas (`regrasRef.id`, ou `S.guia.conf.regras`).
  4. Produto dentro das regras (`status(m,S)`: CA, altura, ocupação, permeável e menor unidade sem `bad`).
  5. Vagas atendidas (`m.vagas >= m.vagasReq`).
  6. Preço de venda conferido (`S.guia.conf.preco`; vira `true` quando um preço é editado ou confirmado no assistente).
  7. Terreno e custo da obra conferidos (`S.guia.conf.custo`; vira `true` quando `fin.terreno`, `fin.cub` ou `fin.fator` é editado, ou quando a calibração é aplicada).
  8. Garagem conferida no layout (`S.estudo.usarLayout` e nenhum pavimento `ok===false`).
  9. Normas sem "não atende" (`normasAvaliar`, só quando calculado).
- Estado novo: `extendDEF("guia", {conf:{regras:false, preco:false, custo:false}})`. São só flags de interface e não entram em `compute`/`finance`.
- Onde aparece:
  - um anel no topo, ao lado do nome do estudo ("6/9"), que abre um popover com a lista; cada item pendente tem o botão "Resolver" → `irPara(etapa, sub, sec)`;
  - o mesmo resumo é uma linha no Resultado da Viabilidade.
- `proximoPasso(st, m, f, tab, sub)` (puro) → `{rotulo, etapa, sub, sec, act?, dica}`. É a regra que alimenta o botão do rodapé (§6.3).

---

## 4. Conteúdo de cada etapa (ordem de cima para baixo)

Convenções:

- **[RES]** resultado fixo · **[A]** seção aberta · **[F]** seção fechada com resumo · **[+]** dentro de "Mais opções" · `SECGRP("…")` é um rótulo de grupo entre seções (componente novo, ver P0).
- **Meta de campos visíveis** = campos à mostra no estado padrão.
- **Regra de casa única:** cada `data-p` vive em uma única tela. Os espelhos permitidos estão em §4.6.

### 4.1 Terreno: "Onde é e o que a lei permite" · vista `impl` · meta: até 9 campos visíveis, até 1.400 px

| Ordem | Bloco | Conteúdo | Veio de |
|---|---|---|---|
| 1 | [RES] **Lote e potencial** (`#loteRes`) | Área · Frente principal · **Computável máx.** (CA máx × área) · **Até N andares** (pela altura) · selo "dentro das regras / N fora" | `RES Lote` (Terreno) + metade do "Potencial do terreno" (Produto: `po.compMax`, `po.pavH`) |
| — | `SECGRP("O lote")` | | |
| 2 | [A] **Contorno do lote** (`contorno`) | métodos (Desenhar · Retângulo · Coordenadas · Imagem · Mapa) + formulário; aviso `#geoNote` "Lote sem posição no mapa · Posicionar" · [+] **Posição no mapa**: latitude, longitude, norte | `SEC contorno` + `SEC local` (vira [+], chave `local`) |
| 3 | [A] **Ruas e frentes** (`lados`) | lista `#edges` (rua/principal/veículos, seta para comprimento e recuos próprios) · "Detectar frentes pelas ruas" (`#frBox`) | `SEC lados` **sem** os sliders "Acessos" (vão para Projeto › Garagem) |
| — | `SECGRP("A lei")` | | |
| 4 | [A] **Regras da prefeitura** (`regras`) | Seletor **"Cidade e zona"** (`#cidLib`), com aviso ilustrativo e Desfazer · 7 campos: Aproveitamento básico e máximo (CA ⓘ) · Ocupação da torre (TO ⓘ) · Altura máxima · Recuo frontal · Recuo lateral e fundos · Vagas por unidade · [+] grupos: *Nome e lei* (`regras.cidade`, Salvar na biblioteca, **Ler a lei com IA**) · *Ocupação e outorga* (TO embasamento, permeabilidade, outorga) · *Afastamentos* (afMin, afDiv, afTorresDiv, recSub) · *Áreas* (m2LojaVaga, aptoMin, ncTipo, ncGaragem, ncTerreo, m2Vaga) | `SEC cidade` + `potencial` + `recuos` + `vagas` (Regras › Prefeitura) |
| 5 | [F] **Altura e recuos por faixa** (`forma`) | `formaRecuosHTML()` + `formaLive` | `SEC forma` (o nome "Forma do edifício" deixa de existir, para não confundir com "Forma das torres") |
| — | `SECGRP("Entorno")` | | |
| 6 | [F] **Terreno inclinado** (`topografia`) | `topoCardHTML()` com relevo (sem mudança interna) | `SEC topografia` |
| 7 | [F] **Áreas restritas** (`lim`) | limites desenhados (embasamento, torres, subsolo) — **sem** o interruptor "Torre ocupa o contorno" (vai para Produto) | `SEC lim` |
| 8 | [F] **Vizinhos e ruas (OSM)** (`entedit`) | `entCardHTML()` | addCard `entedit` (casa) |

- Sai daqui: a busca "Buscar parâmetro" das Regras (`rgBuscaHTML`/`rgFiltra`), que vira a **busca global** (§6.2). Nenhuma função se perde.
- `RES Conformidade` (`#compl`) vai para Produto. A sub-aba **Normas** vai para Projeto › Andares. A sub-aba **Regras › Projeto** se desfaz conforme §4.6.

### 4.2 Produto: "O que construir" · vista `3d` (aceita `impl` e `andar`) · meta: até 8 campos visíveis, até 1.400 px, sem sub-abas

| Ordem | Bloco | Conteúdo | Veio de |
|---|---|---|---|
| 1 | [RES] **Uso do potencial** (`#pot` + `#compl`) | Privativo usado / possível (pill "%" em uso) · Unidades · Vagas no estudo / exigidas · barras de `rgConformidade(m)` (CA, altura, ocupação das torres e do embasamento, permeável, vagas, menor unidade e linhas da forma); aside "dentro das regras" ou "N fora" | `RES Potencial do terreno` + `RES Conformidade` (Regras) |
| 1b | [F] **Diretrizes do produto** (`pr-dir`, `src/ui/diretrizes.js`) | Livre \| Com diretrizes · padrão (Econômico/MCMV, Médio, Médio-alto, Alto, Luxo — aplica as predefinições num passo de desfazer) · faixa do MCMV · tipologias · subsolos · garagem elevada · situação do estudo + "Ajustar o estudo" · [+] o resto. O Quadro de áreas (item 10) passa a ser um `details` fechado no fim do RES | novo (pedido do Luiz, 16/10/2026) |
| 2 | Botão **"Sugerir a melhor combinação"** (`data-act="otim"`, `#otProg`) | logo abaixo do RES; enquanto roda, vira "Cancelar análise" (`calcJobUI`) | `SEC pr-otim` |
| 3 | [A quando há resultado] **Sugestões** (`pr-otres`) | `otimHTML()` (melhor, mais "Outras opções") · [+] *Objetivo* (`otim.obj`), *O que variar* (chips), *Comparar também* (`paretoChipsHTML`) · **Trocas entre critérios** (`paretoCardHTML`, aninhado como subseção) | `SEC pr-otim`, `pr-otres`, `pr-pareto` (sub-aba Otimizar some) |
| 4 | [A] **Torres** (`pr-torres`) | linhas com stepper de andares + Máx · "+ Torre" · "Máximo em todas" · [+] Disposição · **Pés-direitos** (térreo, garagem, tipo) | `SEC pr-torres` + `SEC pes` (Regras › Projeto) |
| 5 | [A] **Unidades por andar** (`pr-mix`) | linhas (nome · área · **preço** · qtd/andar; a linha abre nome, área, preço e sacada) · [+] Sacadas (embutidas/balanço) · **Aproveitamento do andar** (`produto.efic`) | `SEC pr-mix` + `produto.efic` (Regras › Projeto) |
| 6 | [A] **Garagem e térreo** (`pr-emb`) | Subsolos · Garagens elevadas (steppers) · Garagem no térreo · [+] Lojas na frente · Vagas externas · Ático técnico | `SEC pr-emb` |
| 7 | [F] **Forma das torres** (`pr-forma`) | `blcSecHTML()` + interruptor **"Torre ocupa a área desenhada"** e "Ajustar mix" (só quando há limite de torres desenhado) | `SEC pr-forma` + `custom.torOcupa` (Terreno › Limites) |
| 8 | [F] **Áreas comuns e lazer** (`pr-lz`) | métricas do lazer (`#lzMets`, `#lzCap`) no topo da seção + lista (hall + ambientes) + "+ Ambiente" | sub-aba Lazer inteira (`RES Programa de lazer` + `SEC pr-lz`) |
| 9 | [F] **Coberturas** (`pr-cob`) | sem mudança | |
| 10 | [F] **Quadro de áreas** (`pr-quadro`) | sem mudança | |

- O botão "Aprovar produto e seguir para o projeto" sai do corpo. `ACT.aprovar` (gravar uma alternativa) passa a ser "Guardar como alternativa", no menu "…" do topo e em Entrega › Estudos. O avanço fica com o rodapé.

### 4.3 Viabilidade: "Vale a pena?" · vista `3d` · meta: Resultado até 8 campos visíveis; Premissas e Riscos até 3

#### Sub-aba **Resultado** (`res`)

| Ordem | Bloco | Conteúdo | Veio de |
|---|---|---|---|
| 1 | [RES] **Resultado** (`#finTop`, aside `#vStat`) | **Lucro** (grande) · **Margem** (ⓘ "sobre o VGV") · **Retorno ao ano** (TIR ⓘ; sub "VPL R$ x mi") · **Caixa necessário** (exposição ⓘ; sub "payback mês N") · uma linha de veredito: "Viável: margem acima da meta" / "Atenção: …" (`finStatusHTML` + o pior aviso da saúde) · linha do checklist "6/9 conferidos · ver" | `RES Resultado` (o `RES Saúde` deixa de ser RES) |
| 2 | [A] **Premissas principais** (`essencial`) | Terreno (R$) · Custo de referência (CUB ⓘ) · Custo ÷ CUB · **Preço por tipologia** (espelho) e cobertura (espelho, se ligada) · Vender tudo em (meses) · Prazo de obra (meses) · link "Comparar compra, permuta e SPE →" (`irPara("viab","prem","terAlt")`) | `SEC essObra` + `essVenda` (sem "Vendido no lançamento") |
| 3 | [F] **Saúde do negócio** (`saude`) | os 6 indicadores de `saudeResHTML` em lista compacta (ponto · nome · valor · faixa) + avisos + "Ajustar metas →" · resumo: "4 ok · 2 atenção" | `RES Saúde do negócio` (vira SEC) |
| 4 | [F] **Fluxo de caixa** (`cash`) | `cashSVG` | |
| 5 | [F] **Resultado detalhado** (DRE ⓘ) (`dre`) | `finDREHTML` + barra de composição da receita | `SEC dre` + `stack` do antigo `finTopHTML` |

#### Sub-aba **Premissas** (`prem`): o resto, agrupado, tudo fechado

- Topo: [RES] compacto (`#finMini`: lucro, margem, TIR, caixa) e a busca de premissas (`#vqFind`, mantida).
- `SECGRP("Custos")`:
  - [F] Orçamento da obra (`orc`);
  - [F] Custos indiretos (`ind`, com `softCamposHTML`);
  - [F] Calibrar com obras reais (addCard `ccal`).
- `SECGRP("Receitas")`:
  - [F] Receita e comissões (`rec`, que ganha "Vendido no lançamento");
  - [F] Como o cliente paga (`receb`);
  - [F] **Tabela de vendas** (`vendas`, addCard `vendas`, sub `prem`: `#vdSum` vira a primeira linha da seção);
  - [F] Valorização por unidade (`vendaPrem`);
  - [F] Calibrar com tabela de vendas (`vCal`).
- `SECGRP("Terreno")`:
  - [F] Pagamento do terreno (`terAlt`, sub `prem`).
- `SECGRP("Prazos e financiamento")`:
  - [F] Cronograma (`crono`);
  - [F] Financiamento da obra (`finan`).
- `SECGRP("Metas")`:
  - [F] Metas e referências (`metas`).

#### Sub-aba **Riscos** (`risco`)

1. [RES] **Pessimista × otimista** (`#cenTab`). É o antigo "Cenários" com nome novo.
2. [A] **O que melhora o resultado** (`alavancas`). Era "Alavancas", estava fechado e no fim; agora vem logo depois do RES.
3. [F] **O que mais pesa** (`sens`, "Sensibilidade").
4. [F] **Variações do pessimista e do otimista** (`cenVar`).
5. [F] **Simulação de incertezas** (`mc`, "Monte Carlo" ⓘ).
6. [F] **Comparar com a planilha da empresa** (`cmpPlan`).

### 4.4 Projeto: "Funciona no desenho?" · meta: até 6 campos visíveis por sub-aba

#### Sub-aba **Garagem** (`gar`) · vista `gar`

1. [RES] Vagas (`#garRes`, `#garStat`).
2. [A] **Acesso e rampas** (`gRampa`):
   - **Entradas**: os sliders "Pedestres · L" e "Veículos · L" (`lote.acessoPed/acessoVei`, que saem de Terreno);
   - circulação vertical (`#rampSel`), Mover na planta, **Encontrar o melhor acesso**;
   - [+] parâmetros da rampa.
3. [A] **Vagas** (`gLay`): ângulo, fileiras e "Usar as vagas do layout nas contas".
4. [F] **PCD e idoso** (`gPcd`): casa única de `estudo.pcd/idoso`.
5. [F] **Medidas da vaga** (`gDim`): casa única de `vagaL, vagaC, corredor, porModulo, pilar`; também ganha `rampaL` e `rampaInc` quando a rampa é reta, alternada ou em L (hoje esses dois ficam em [+] de Acesso).
6. [F] **Vagas extras** (`gExt`).
7. [F] **Editar vagas à mão** (`gMan`).
8. [F] **Pilares (malha estrutural)** (addCard `estrutura`).

#### Sub-aba **Andares** (`tipo`) · vista `tipo` (aceita `andar`)

1. [RES] Andar tipo (`#tipoRes`, `#tipoStat`).
2. [A] **Escadas e elevadores** (`tNuc`), com [+] **Posição do núcleo** (antigo `tPos`: planta, lado, ordem, posição).
3. [F] **Medidas do andar** (`tDim`): casa única de `corrTipo, profMin, sacProf`.
4. [F] **Núcleo e unidades por torre** (`tDet`).
5. [F] Alas do pavimento tipo (addCard `alas`, quando houver).
6. [F] Cômodos das unidades (addCard `comodos`).
7. [A] **Todos os andares** (`andares`): a lista `#andList` + "Ver o andar cortado no 3D". Era a sub-aba Andares.
8. [F] **Saídas e acessibilidade (preliminar)** (`nrmList`): `normasSecHTML()`, com o resultado no resumo ("12 atendem · 2 atenção") e as opções `nrmOpc` em [+].

#### Sub-aba **Sol** (`sol`) · vista `clima` (aceita `3d`)

1. [RES] Horas de sol no chão (`#solInfo`).
2. [A] Data e hora (`cSol`).
3. [F] Impacto de vizinhança (addCard `viz`, sub `sol`).
4. [F] Vizinhos e ruas (espelho de `entedit`).

#### Sub-aba **Vento** (`vento`) · vista `clima` ou `v3d`

- No topo, `SEG` **No chão (rápido) | Túnel 3D** (`data-act="vmodo"`, que grava `CSUB`).
- No chão:
  - [RES] Vento no chão (`#ventoInfo`);
  - [A] Vento de referência (`cVen`).
- Túnel 3D:
  - [A] Simular (`cSim`);
  - [A] O que ver (`cVer`).
- Nos dois modos, [F] Vizinhos e ruas (espelho).
- `clima.ventoVel` e `clima.overlay3d` aparecem num modo de cada vez, então deixam de ser duplicata.

### 4.5 Entrega: "Mostrar e guardar" · sem troca de vista

- **Entregar** (`entregar`, a primeira sub-aba):
  - [A] Relatório e arquivos (`arquivos`), com o botão "Relatório PDF" como secundário (o primário é o rodapé);
  - [A] Apresentar e compartilhar (`apresentacao`);
  - [F] Marca no PDF (`marca`).
- **Estudos** (`estudos`):
  - [RES] Estudo aberto;
  - [A] **Alternativas salvas** (antigo `cenarios`, que guarda o que era o "Aprovar produto");
  - [A] Comparação (`cmp`);
  - [F] Estudos (`estudos`), com "+ Novo estudo" abrindo o assistente;
  - [F] Versões (`versoes`);
  - [F] Recomeçar (`reset`).

### 4.6 Destino de tudo o que muda de lugar (nada é removido)

| Item atual | Novo lugar |
|---|---|
| Regras › Prefeitura (todas as seções) | Terreno › Regras da prefeitura / Altura e recuos por faixa |
| `RES Conformidade` (`#compl`, `STEP_LIVE.regras`) | Produto › RES (função `rgConformidade(m)`, de P2) |
| Regras › Projeto › Pés-direitos | Produto › Torres [+] |
| Regras › Projeto › Pavimento tipo: `produto.efic` | Produto › Unidades [+] |
| Regras › Projeto › Pavimento tipo: `corrTipo, profMin, sacProf` | Projeto › Andares › Medidas do andar (só lá) |
| Regras › Projeto › Vaga e circulação, Rampa e acessibilidade | Projeto › Garagem › Medidas da vaga / PCD e idoso / Acesso (só lá) |
| Regras › Projeto › `RES No estudo` | absorvido pela régua (altura, privativa e vagas já estão lá) |
| Regras › Normas | Projeto › Andares › Saídas e acessibilidade |
| Regras › busca de parâmetros | busca global (topo, Ctrl+K) |
| Terreno › Localização | Terreno › Contorno [+] "Posição no mapa" |
| Terreno › Lados › Acessos (2 sliders) | Projeto › Garagem › Acesso e rampas › Entradas |
| Terreno › Limites › "Torre ocupa o contorno" + `#torOcupa` | Produto › Forma das torres |
| Produto › Lazer (sub-aba) | Produto › Áreas comuns e lazer |
| Produto › Otimizar (sub-aba) | Produto › botão + Sugestões |
| Botão "Aprovar produto" | menu "…" › Guardar como alternativa; Entrega › Alternativas |
| Viabilidade › `RES Saúde` | Viabilidade › Resultado › seção Saúde do negócio |
| Viabilidade › Vendas (sub-aba: vendas, vCal, terAlt) | Viabilidade › Premissas (grupos Receitas e Terreno) |
| Projeto › Andares (sub-aba) | Projeto › Andares (tipo) › Todos os andares |
| Clima (etapa) | Projeto › Sol / Vento |
| Cenários (etapa) | Entrega |
| Topo: Glossário, Tema | menu "…" |

**Espelhos permitidos** (mesmo `data-p` ou mesma seção em mais de um lugar, de propósito):

- `produto.mix.*.preco` e `produto.cob.preco`: Produto e Viabilidade › Premissas principais;
- seção `entedit`: Terreno, Projeto › Sol e Projeto › Vento;
- `mapa.raio`: vem junto com `entedit`.

Qualquer outro `data-p` em 2 telas é erro (critério do P8).

### 4.7 Rótulos novos (linguagem simples; sigla sempre com ⓘ)

| Antes | Depois |
|---|---|
| CA básico / CA máximo | Aproveitamento básico / máximo (CA ⓘ) |
| TO torres / TO embasamento | Ocupação da torre / do embasamento (TO ⓘ) |
| Laterais e fundos | Recuo lateral e fundos |
| Torre às divisas: H ÷ | Afastamento: altura ÷ |
| Não comput. no tipo | Área não computável no andar |
| Forma do edifício | Altura e recuos por faixa |
| Limites especiais | Áreas restritas (APP, servidão) |
| Topografia | Terreno inclinado |
| Entorno | Vizinhos e ruas |
| Lados e frentes | Ruas e frentes |
| Mix do andar tipo | Unidades por andar |
| Embasamento e garagem | Garagem e térreo |
| Eficiência do andar | Aproveitamento do andar |
| Gerar opções / Otimizar | Sugerir a melhor combinação |
| Margem s/ VGV | Margem (ⓘ: sobre o VGV) |
| TIR a.a. | Retorno ao ano (TIR ⓘ) |
| Exposição máx. | Caixa necessário (ⓘ exposição) |
| DRE | Resultado detalhado (DRE ⓘ) |
| Recebimento | Como o cliente paga |
| Financiamento à produção | Financiamento da obra (plano empresário ⓘ) |
| Cenários (Riscos) | Pessimista × otimista |
| Sensibilidade | O que mais pesa |
| Alavancas | O que melhora o resultado |
| Monte Carlo | Simulação de incertezas |
| Cenários (salvos) | Alternativas salvas |
| Núcleo de circulação | Escadas e elevadores |
| Dimensões (tipo) / Dimensões da vaga | Medidas do andar / Medidas da vaga |
| Ajuste manual | Editar vagas à mão |
| Malha estrutural | Pilares (malha estrutural) |
| Vista "Mapas" (palco) | "Sol e vento" |
| Etapa "Cenários" | "Entrega" |

Termos novos no glossário (`src/ui/glossario.js`): Caixa necessário, Aproveitamento do andar, Retorno ao ano, Alternativa, Espelho de campo (interno, não aparece).

---

## 5. Régua de KPIs (`#kpis`, `renderKPIs` em `ui.js`)

**6 visíveis**, cada um clicável e levando para onde o número se resolve (`irPara`):

| KPI | Valor | Linha de baixo | Status (ponto) | Ao clicar |
|---|---|---|---|---|
| Unidades | `m.units` | "2 torres · 12 e 8 and." | `s.tor`/`s.apto` | Produto › Unidades |
| Regras | "dentro" ou "2 fora" | pior item (ex.: "altura 72/70 m") | pior de CA, altura, ocupação, permeável, menor unidade | Produto (RES) |
| Vagas | `85/78` | "pelo layout" / "estimadas" | `s.vg` | Projeto › Garagem |
| VGV ⓘ | `R$ 91,7 mi` | "R$ 1,2 mi/un" | — | Viabilidade › Premissas principais |
| Margem ⓘ | `21,5%` | "meta 25% · lucro 19,8 mi" | `sd.nivel.margem` | Viabilidade › Resultado |
| Retorno ⓘ | `16,8%` | "alvo 25%" | `sd.nivel.tir` | Viabilidade › Riscos › O que melhora |

- Um 7º botão **"⋯"** abre um popover com os demais: Terreno (área, permeável), CA, Altura, Aproveitamento (eficiência global), Lucro, VPL, Caixa necessário. Tudo com os mesmos `title` de hoje.
- **Status minimalista:**
  - um ponto de 6 px (`ok`, `warn`, `bad`) antes do rótulo;
  - o valor só ganha cor quando está `bad`;
  - nada de fundo colorido;
  - "dentro da meta" não ganha destaque (o ponto verde basta).
- Celular: 3 KPIs (Margem, Retorno, Vagas) numa faixa no cabeçalho da folha (§7), e "⋯" abre o resto.

---

## 6. Topo, navegação e próximo passo

### 6.1 Topo (`header.top`)

- Esquerda:
  - marca;
  - **nome do estudo ▾**, um menu com: Novo estudo… (assistente) · Meus estudos e versões (`irPara("cen","estudos")`) · Duplicar · Salvar versão · Guardar como alternativa · Abrir .json · Restaurar exemplo;
  - anel do checklist "6/9";
  - desfazer e refazer;
  - status discreto de salvamento ("Salvo" / "Salvando…", a partir de `save`/`estTouch`).
- Centro (desktop ≥ 1100 px): **stepper** (§6.2).
- Direita:
  - **Apresentar** (secundário);
  - **Relatório PDF** (secundário);
  - **"…"**: Buscar (Ctrl+K), Glossário, Tema claro/escuro, DXF + IFC, Salvar .json, Copiar resumo, Link somente leitura, Marca no PDF;
  - a conta (`auth.js`).
- O laranja primário **não** fica no topo: ele é só do "Próximo passo".

### 6.2 Navegação: stepper horizontal no topo (recomendado)

- Os 5 passos são numerados ("1 Terreno · 2 Produto · 3 Viabilidade · 4 Projeto · 5 Entrega") e mostram estado: ✓ quando os itens do checklist daquela etapa estão ok, ponto `warn`/`bad` quando há pendência, e a etapa atual destacada.
- **Por que horizontal, e não o trilho lateral atual:**
  - mostra a sequência e o progresso (o trilho de ícones não diz ordem nem quanto falta);
  - devolve 76 px ao palco;
  - com 5 etapas cabe com rótulo inteiro;
  - é o padrão de assistentes em SaaS, que é o que um comprador espera.
- O elemento continua com `id="rail"` e botões `[data-step]`, então os testes seguem achando.
- Entre 901 e 1099 px, o stepper fica no topo do inspetor, só com números (o rótulo da etapa atual aparece por extenso). No celular, vira a barra inferior (§7).
- **Busca global** (`src/ui/busca.js`, Ctrl+K e item do "…"):
  - índice montado sob demanda chamando `STEP_R[k]()` de cada etapa e sub-aba (e `cardsFor`) num DOM solto;
  - lê `data-q` e os rótulos `.fl`;
  - o resultado mostra "Campo · Etapa › Seção" e leva com `irPara`, abrindo a seção e o "Mais opções" e focando o campo.

### 6.3 Rodapé e "Próximo passo" (`#pfoot`)

- `← anterior` (ghost) · linha de orientação (`dica`, até 60 caracteres, ex.: "Falta conferir o preço de venda") · **botão primário** com `proximoPasso(...).rotulo`.
- O botão nunca fica vazio:
  - se há pendência na etapa, ele resolve a pendência ("Escolher a cidade", "Desenhar o lote", "Adicionar 1 subsolo"); a ação vem em `act` ou `irPara`;
  - se não há, ele avança ("Ver a viabilidade →", "Conferir o projeto →", "Entregar →");
  - na Entrega, é "Baixar relatório PDF", e o "Apresentar" fica ao lado.
- **No máximo 1 `.btn.pri` visível por tela**, e ele é o do rodapé. No corpo, todo botão é `.btn` ou `.btn.ghost`. A única exceção é o assistente, que é uma tela à parte.
- `#phead`:
  - "Etapa N de 5" · título · pergunta (uma linha);
  - sub-abas;
  - sem parágrafo.

---

## 7. Celular (400 px)

- **O palco ocupa a tela inteira** abaixo do topo (52 px).
- **O inspetor vira uma folha deslizante** sobre o palco, com 3 alturas:
  - espiada: 28% (título da etapa + RES);
  - média: 58%, padrão ao trocar de etapa;
  - cheia: 92%.
- Puxador no topo da folha; arrastar ou tocar alterna as alturas. A variável CSS `--folha` posiciona legenda, dica, `vtools` e `sunbox` acima dela.
- Ao ligar uma ferramenta de desenho (desenhar lote, entorno, limite, mover rampa), a folha desce para a espiada sozinha.
- **Barra inferior com as 5 etapas**: ícone + rótulo curto, ponto de status, ≥ 54 px. O `#rail` atual já fica embaixo; agora são 5 itens, não 7.
- Dentro da folha, de cima para baixo:
  - puxador;
  - KPIs (3) numa linha;
  - `#phead` (título, sub-abas);
  - corpo;
  - `#pfoot` fixo no pé da folha, acima da barra.
- Popovers ⓘ, menus do topo e a busca abrem como folhas por baixo (o padrão `.pop` mobile já existe).
- O assistente e as boas-vindas ocupam a tela inteira, com um botão grande por passo.

---

## 8. Plano de implementação em pacotes

Regras gerais (valem para todos; ver `docs/AGENTES.md`):

- Build privado: `node tools/bundle.mjs --out <scratch>/build`.
- Sem git. Edições pequenas com Edit. Arquivos de outros pacotes, só nos **pontos de contato** listados.
- CSS novo vai **injetado pelo próprio módulo** (padrão de `produto.js`/`steps.js`). Ninguém além do agente visual mexe no bloco de CSS do `shell.html`; o P1 mexe só na marcação do `shell.html`.
- Números: `npm test` verde, sem regenerar `tests/cenarios/*.json`.
- Ids que o `STEP_LIVE`/`live` procura são mantidos (lista em §4). Se a seção muda de etapa, a função `live` passa a ser chamada pelo `STEP_LIVE` da etapa nova.
- Glossário: `src/ui/glossario.js` é só de acréscimo. Releia e acrescente as entradas no fim, com Edit num âncora única.

### P0. Preparação (sequencial, antes de todos; 1 agente, pequeno)

Arquivos: `src/steps.js`, `src/hooks.js`, `src/ui/ux.js`, `src/ui.js` (só os helpers abaixo), `tools/screens.cjs`, `tools/auditoria-ui.cjs`.

1. **Dividir `src/steps.js` sem mudar comportamento:**
   - `src/ui/etapa-terreno.js` (Terreno + Regras: `STEP_R/LIVE.terreno`, `.regras`, `terrenoLado`, `rg*`, ACT);
   - `src/ui/etapa-projeto.js` (projeto, `garSum`, `tipoSum`, `rsHTML`, `RS`, ACT);
   - `src/ui/etapa-clima.js` (clima, `climaSum`, `climaInfo`, ACT);
   - `src/ui/etapa-entrega.js` (cen, `compareHTML`, addCard `reset`, ACT);
   - `steps.js` fica com `STEP_R`, `STEP_LIVE`, `MESES`, `hhmm`, `bar` e `useRow`.
2. Em `hooks.js`, `addCard`: aliases `regras→terreno` e `clima→projeto`. Eles só passam a valer quando P1 tirar essas etapas; até lá, o alias fica inativo, atrás de uma flag `ETAPA_ALIAS` vazia que o P1 preenche.
3. Em `ux.js`: `SECGRP(título)`, um rótulo de grupo entre seções (só marcação, classe `secgrp`, CSS injetado).
4. Em `ui.js`, helpers com a semântica de hoje:
   - `irPara(etapa, sub, secKey, campoP?)`, que generaliza `ACT.finIr`: troca a sub-aba (SUBX, PSUB ou CSUB), abre a seção e o ADV, rola e foca;
   - `emClima()` (hoje = `TAB==="clima"`);
   - `subsDe(k)`.
5. Ferramentas:
   - `screens.cjs` lê as etapas de `#rail [data-step]` em vez da lista fixa;
   - `auditoria-ui.cjs` lê as etapas e sub-abas por `STEPS` e `subsDe(k)`, e ganha:
     - `--dup` (lista os `data-p` repetidos entre telas, com lista de espelhos permitidos);
     - a contagem de `.btn.pri` visíveis;
     - a contagem de seções por tela;
   - grave `docs/aud-v2.json` (inventário de `data-p` por tela antes da reforma), que o P8 usa como referência.
- **Pronto quando:** build igual; `npm test` verde; `screens all` sem erros; auditoria com os mesmos números do §1.

Depois do P0, rodam em paralelo os pacotes P1 a P7.

### P1. Casca, navegação, KPIs, celular e busca

Arquivos exclusivos:

- `src/ui.js`: `STEPS` (5), aliases em `goStep`/`LS gabarito.step`, `stepView`/`stepFromView` (subs `gar|tipo|sol|vento`, `v3d` dentro de vento), `curSub`, `ACT.go/psub/csub`, `renderTab` (eyebrow "Etapa N de 5", rodapé com próximo passo), `railStatus`, `renderKPIs` (6 + "⋯"), `emClima()` real;
- `src/shell.html`: **só a marcação** do header, nav e palco (rótulo "Sol e vento" no `#viewSeg`);
- `src/main.js`: aliases, `assInicio`, raízes do listener delegado incluindo `.top`;
- `src/views.js`, `src/view3d.js`, `src/wind3d.js`: só as linhas `TAB==="clima"` → `emClima()`;
- `src/ui/palco.js`, `src/ui/ux.js` (depois do P0);
- novos: `src/ui/navegacao.js` (stepper, menus do topo, anel do checklist, folha do celular, CSS) e `src/ui/busca.js`.

Contatos:

- usa `proximoPasso`/`progressoItens` (P7); sem eles, avança para a próxima etapa;
- usa `rgConformidade` (P2) no KPI "Regras"; sem ele, cai em `status()`;
- menu do estudo → `estNovo`, `versaoSalvar`, `abrirJson()` (P6) e `assAbrir()` (P7), todos com `typeof … === "function"`.

**Pronto quando:**

- 5 etapas no stepper;
- o estudo novo abre em Terreno; `LS step="regras"` abre Terreno e `"clima"` abre Projeto › Sol;
- KPIs: 6 + "⋯", cada um navega ao clicar;
- celular 400 px: folha com 3 alturas, barra com 5 itens, sem rolagem horizontal;
- Ctrl+K encontra "recuo frontal", "INCC" e "largura da vaga" e leva ao campo;
- `screens all` sem erro de JS.

### P2. Etapa Terreno (absorve Regras)

Arquivos exclusivos:

- `src/ui/etapa-terreno.js`;
- `src/ui/normas.js` (cidades + checklist: cria `normasSecHTML()`, mantém `normasLive`);
- `src/ui/forma.js` (addCard → `terreno`);
- `src/ui/topografia.js`, `src/ui/relevo.js`, `src/ui/mapa.js` (`TAB==="clima"` → `emClima()`), `src/ui/frente.js`;
- `src/ui/entorno.js` (`entedit`: Terreno + `projeto` com sub `sol` e `vento`; título "Vizinhos e ruas");
- `src/ui/contexto.js`.

Faz:

- §4.1 inteiro;
- exporta `rgConformidade(m)` (as linhas do antigo `#compl`, sem DOM);
- tira os sliders "Acessos" e o "Torre ocupa" do Terreno;
- no `STEP_LIVE.terreno`, chama também o que era `STEP_LIVE.regras` (resumos e `setSub`).

Contatos:

- P3 renderiza `#compl` com `rgConformidade`;
- P4 põe os sliders de acesso (os mesmos `SLD("lote.acessoPed"/"lote.acessoVei")` e o `setSub` de `lote.acessoVei`, que mudam para `etapa-projeto.js`);
- `ACT.torAjMix` e `torOcupaResumo` continuam globais neste arquivo.

**Pronto quando:**

- auditoria Terreno com até 9 campos visíveis, até 1.400 px, até 8 seções além do RES;
- "Aplicar regras de…" muda os 7 campos e o RES;
- desenhar, editar, mover e excluir lote, entorno e limite funciona, e Ctrl+Z também;
- `node tools/teste-entorno.cjs` verde.

### P3. Etapa Produto

Arquivos exclusivos: `src/ui/produto.js`, `src/ui/pareto.js`, `src/ui/blocos.js`, `src/ui/calcworker.js`.

Faz:

- §4.2 inteiro;
- tira as sub-abas;
- passa pés-direitos e `produto.efic` para o [+];
- RES com `#compl`;
- "Torre ocupa" em Forma das torres;
- **`otimRodar(opts, onProg) → Promise<OTIM>`**, que usa o Worker ou a página e passa a ser o caminho único de `ACT.otim` e do assistente;
- "Guardar como alternativa" (`ACT.aprovar`, mesmo comportamento, novo rótulo).

**Pronto quando:**

- auditoria Produto com até 8 campos visíveis, até 1.400 px, nenhuma sub-aba;
- otimizar → aplicar → Ctrl+Z funciona; cancelar funciona;
- `tests/otimforma.test.js` e `tests/pareto.test.js` verdes.

### P4. Etapa Projeto (absorve Clima)

Arquivos exclusivos:

- `src/ui/etapa-projeto.js`, `src/ui/etapa-clima.js`;
- `src/ui/comodos.js`, `src/ui/estrutura.js`;
- `src/ui/vizinhanca.js` (`TAB/CSUB` → `emClima()` e `PSUB==="sol"`).

Faz:

- §4.4 inteiro, com sub-abas `gar|tipo|sol|vento` via `SUBTABS("projeto",…)` com `data-act="psub"` (a lógica fica no `ui.js`, P1);
- `ACT.vmodo` (chão ou 3D);
- "Todos os andares" dentro de `tipo`;
- Normas via `normasSecHTML()`;
- Entradas na Garagem;
- casa única de vaga, rampa, PCD e medidas do andar.

**Pronto quando:**

- cada sub-aba com até 6 campos visíveis e até 8 seções;
- `--dup` não acusa nenhum dos 13 caminhos de §1.3;
- "Encontrar o melhor acesso", "Mover rampa", tocar na vaga, simular o túnel 3D e animar o dia funcionam;
- `tests/garagem.test.js`, `tests/normas.test.js` e `tests/vizinhanca.test.js` verdes.

### P5. Etapa Viabilidade

Arquivos exclusivos: `src/ui/financeiro.js`, `src/ui/saude.js`, `src/ui/alavancas.js`, `src/ui/vendas.js`, `src/ui/calibra.js`, `src/ui/calibracusto.js`, `src/ui/comparaplanilha.js`.

Faz:

- §4.3 inteiro: 3 sub-abas, um único RES, a Saúde como seção, "Premissas principais" com espelho dos preços, os grupos `SECGRP` em Premissas, os cards de `vendas` com sub `prem`, as Alavancas em segundo lugar nos Riscos;
- em `finIr`, `vendas` → `prem`;
- `S.guia.conf.preco/custo` = `true` quando um desses campos é editado, num `FX` próprio que chama `upd`.

**Pronto quando:**

- Resultado com até 8 campos visíveis e 1 RES; Premissas e Riscos com até 3 visíveis;
- margem e TIR aparecem **uma vez** no inspetor da tela Resultado;
- `tests/financeiro.test.js`, `tests/saude.test.js` e `tests/alavancas.test.js` verdes;
- `node tools/teste-calibracao.cjs` verde.

### P6. Etapa Entrega e estudos

Arquivos exclusivos: `src/ui/etapa-entrega.js`, `src/ui/estudos.js`, `src/ui/apresentacao.js`, `src/ui/marca.js`.

Faz:

- §4.5;
- `abrirJson()` com o próprio `<input type=file>` (funciona fora do `#tabbody`);
- `versaoSalvar` exposto para o menu;
- "+ Novo estudo" → `assAbrir()`;
- rótulos "Alternativas salvas";
- `AP_PASSOS` sem mudança de conteúdo.

**Pronto quando:**

- até 3 campos visíveis por sub-aba;
- `node tools/apresentacao.cjs` e `tests/plataforma.test.js` verdes;
- abrir, duplicar, excluir e desfazer um estudo e restaurar uma versão funcionam.

### P7. Assistente, exemplo e checklist

Arquivos exclusivos (todos novos, mais `src/ui/glossario.js`):

- `src/calc/assistente.js` (`assEstado`, `assEhExemplo`);
- `src/calc/progresso.js` (`progressoItens`, `proximoPasso`);
- `src/ui/assistente.js` (boas-vindas, 4 passos, `assAbrir`, `assInicio`, `#exBanner`);
- `src/ui/progresso.js` (popover do checklist; `extendDEF("guia", …)`);
- `tests/assistente.test.js`, `tests/progresso.test.js`.

Contatos (todos com fallback):

- `estNovo` (P6), `otimRodar` (P3), `cidadesLista/cidadeAplicar`, `presetMix`, `aplicarOtim`, `maxPav`;
- `irPara` (P0);
- o anel e o rodapé são desenhados por P1, com os dados vindos de P7.

**Pronto quando:**

- `assEstado` e `proximoPasso` testados no Node (sem DOM);
- teste Playwright próprio: assistente com retângulo 20×40, "Criciúma" e "Família" a R$ 12.000 → cai em Viabilidade com lucro calculado, e Ctrl+Z volta tudo;
- boas-vindas não aparecem com `navigator.webdriver`;
- o banner de exemplo some ao renomear.

### P8. Integração, ferramentas e documentação (depois de P1 a P7)

Arquivos:

- `tools/teste-funcional.cjs`: etapas `regras`/`clima` → `terreno`/`projeto`; `goStep('projeto','gar')` continua; `abre('entedit')` continua; sub-abas por `data-v` (`res|prem|risco`, `gar|tipo|sol|vento`, `entregar|estudos`); seções que mudaram de lugar (Normas, Acessos, Lazer, Otimizar, Vendas, terAlt, Localização, pés-direitos); o `--etapas` aceita os nomes antigos como alias; o trecho de celular toca `#rail [data-step]` (5 itens) e abre a folha antes de tocar nas sub-abas;
- `tools/teste-plataforma.cjs`, `tools/apresentacao.cjs`, `tools/teste-entorno.cjs`, `tools/teste-calibracao.cjs`, `tools/teste-alavancas.cjs`: só seletores de etapa e sub-aba;
- `tools/screens.cjs`: no celular, captura com a folha cheia e com a folha média;
- `docs/UX.md` (vira a v3, com as metas abaixo), `CLAUDE.md` (etapas, arquivos `etapa-*`, `navegacao`, `busca`, `assistente`, `progresso`), `PLANO.md` (andamento).

**Pronto, para o conjunto (critérios verificáveis):**

1. `npm test` verde, com `tests/cenarios/*.json` **sem mudança**.
2. `npm run typecheck` sem erros novos.
3. `node tools/screens.cjs all` sem erro de JS, nas 5 etapas e em todas as sub-abas, desktop e celular, claro e escuro.
4. `node tools/teste-funcional.cjs` verde. Também verdes: `teste-entorno`, `teste-plataforma`, `apresentacao`, `teste-calibracao` e `teste-alavancas`.
5. `node tools/auditoria-ui.cjs --dup`:
   - **11 telas** (Terreno 1, Produto 1, Viabilidade 3, Projeto 4, Entrega 2);
   - campos visíveis: Terreno até 9, Produto até 8, Viabilidade/Resultado até 8, os demais até 6;
   - painel até 1.400 px no estado padrão (desktop);
   - até 8 seções por tela, contando o RES (Viabilidade › Premissas pode ter até 12, todas fechadas e agrupadas);
   - **até 1 `.btn.pri` visível por tela**;
   - **0 `data-p` duplicados** fora dos espelhos de §4.6.
6. Inventário: todos os `data-p` que a auditoria encontrava antes (232 caminhos) continuam alcançáveis em alguma tela, abrindo seções e "Mais opções". A auditoria compara com `docs/aud-v2.json`, gerado no P0.

### Ordem e conflitos

- P0 vem antes de todos.
- P1 a P7 rodam em paralelo; nenhum arquivo tem dois donos.
- Pontos de atrito conhecidos:
  - `ui.js`: P0 e P1, em sequência;
  - os sliders de acesso: P2 tira e P4 põe, então a integração só fecha com os dois;
  - `#compl`: P2 exporta e P3 consome;
  - glossário: só acréscimo.
- P8 fecha a integração.

