# Gabarito — estudo de viabilidade imobiliária

Ferramenta web (arquivo único) para estudos de massa e viabilidade de empreendimentos residenciais verticais: desenha o lote, aplica as regras da prefeitura, mostra o potencial do terreno, otimiza o produto, calcula a viabilidade financeira, faz layout de garagem e pavimento tipo, e simula sol e vento (2D e túnel de vento 3D).

Publicado como Artifact no claude.ai: https://claude.ai/artifact/4wBW5QrbVhLrqDQgtdFE7G

## Regras de trabalho

- Interface e textos sempre em **português do Brasil**. Respostas ao Luiz em português, listas em tópicos (sem tabelas no chat).
- Padrão visual **premium, sóbrio e moderno** (nada grosseiro). Qualquer controle novo usa os componentes e tokens existentes do `shell.html`.
- Mostrar só o que está ativo: configurações de uma visualização aparecem apenas quando ela está ligada.
- Não editar `index.html` à mão — ele é gerado.

## Build

```
python build.py        # concatena src/ → index.html e test.html
```

- `index.html` é o que se publica (o Artifact adiciona o esqueleto HTML).
- `test.html` é a mesma coisa com `<html><body>` para abrir no navegador ou no Playwright.
- Bibliotecas: three.js r128 + OrbitControls (jsDelivr) no carregamento; jsPDF, JSZip e pdf.js carregados sob demanda (cdnjs).
- Teste visual: `npm i -D playwright three@0.128.0` e `node tools/screens.js d` (ou `m` para celular).

Ordem de concatenação (importa — tudo é global, `"use strict"`):
`state, geom, layout, garagem, model, programa, finance, optim, clima, plan2d, view3d, ui, steps, views, ai, export, wind3d, main`

## Arquitetura (src/)

| arquivo | papel |
|---|---|
| `shell.html` | CSS (design system: Archivo + IBM Plex, tokens claro/escuro, componentes) e marcação: topo, trilho de etapas `#rail`, inspetor (`#phead`, `#tabbody`, `#pfoot`), palco `#view` com barra de vistas e régua de KPIs `#kpis` |
| `state.js` | `DEF` (estado padrão), `S` (estado atual, salvo em localStorage `gabarito.v2`), `merge()` com migrações, formatadores `nf/brl/mi/pct/m2/esc/toast` |
| `geom.js` | geometria 2D: área, offset por semiplano, recorte, `band`, `cutAt`, `clipToPoly` |
| `garagem.js` | **motor de garagem**: `driveLayout` (arranjo das faixas de rampa e da faixa do térreo, testando ordens e deslocamentos para não passar pelos núcleos), `rampExt`, `vertical` (circulação vertical: faixas, rampas por pavimento, patamares e portais de chegada/saída), `genLayout` (fileiras), `rasterCheck` (malha de 0,5 m: alcance do carro e profundidade de manobra), `repair` (abre passagens tirando o mínimo de vagas), `infill` (vagas extras nas sobras), `rota` (rota real entre portais), `garageSolve`/`garageLayout`/`garagens`, `acessoCandidatos`/`acessoAvalia` (estudo do melhor acesso) |
| `layout.js` | pavimento tipo (`tipoLayout`, núcleo realista `coreSeq/coreBuild`: escada, antecâmara, dutos, elevadores, shafts, hall de serviço, lixo/DML, portas), garagem (`garageLayout/garageSolve`, ângulos 90/60/45, rampa, PCD/idoso, edição manual), estudo de rampa (`rampCandidates/rampEval`) |
| `model.js` | `massing` (envelope, torres, afastamentos, estimativa do térreo), `areasFin` (áreas, CA, vagas exigidas, custo do lazer), `compute` (andares tipo, núcleos + hall dos elevadores em todos os pavimentos, térreo definitivo, rampa, garagens, lazer, avisos), `status`, `maxPav` |
| `programa.js` | programa de áreas comuns e lazer (`LZ_PRESETS`, locais térreo / laje do embasamento / pavimento de lazer / rooftop), **zoneamento do térreo** (`terreoZones`: lojas, passagem de pedestres, acesso de veículos com rampa + faixa, hall dimensionado pelo programa, hall chegando a cada núcleo, garagem no que sobra) e posicionamento dos ambientes (`packItems`, `lazerLayout`) |
| `finance.js` | fluxo de caixa mensal, INCC, reajuste, permutas, financiamento, TIR/VPL/exposição, `sensGrid` |
| `optim.js` | `potencial()` (o que o terreno permite) e `otimizar()` (busca torres × tipologias × unidades × garagens, valida as melhores com o layout real da garagem); `aplicarOtim()` |
| `clima.js` | horas de sol (ray casting) e vento 2D (LBM) |
| `plan2d.js` | desenho das plantas (implantação, garagem, tipo, andares, mapas de clima) |
| `view3d.js` | renderizador 3D premium (sombras, ACES, corte por andar, sol) — `rebuild3d` |
| `ui.js` | **framework do inspetor**: helpers declarativos `NUM/SLD/SW/SEG/STP/TXT/CARD/KV/ROW`, listener delegado (`data-p` = caminho em `S`, `data-fx` = efeito, `data-rr` = re-render), `ACT` (ações por `data-act`), etapas `STEPS`, `goStep/stepView/stepFromView`, `renderTab`, `update`, KPIs, status do trilho, utilidades |
| `steps.js` | conteúdo de cada etapa: `STEP_R[k]()` devolve `{sub, body, after}` e `STEP_LIVE[k](m,f)` atualiza as partes vivas sem recriar o painel |
| `views.js` | vistas do palco (`setView`), interação com mouse/toque nas plantas, barra de vistas, legenda |
| `ai.js` | leitura do plano diretor com IA (`window.claude.use("sample")`) |
| `export.js` | PDF, DXF + IFC (zip), JSON (`downloads`) |
| `wind3d.js` | túnel de vento 3D: LBM D3Q19 + LES num Web Worker, linhas de corrente animadas, fumaça (coluna/cortina/ponto), partículas, setas, plano de cor, pressão (Cp), sonda |
| `main.js` | inicialização |

### Etapas (trilho)

`terreno → regras → produto → viab → projeto (gar|tipo|andar) → clima (sol|vento|v3d) → cen`

- `TAB` = etapa atual, `PSUB`/`CSUB` = sub-abas de Projeto/Clima.
- Cada etapa pede uma vista do palco (`stepView`); clicar numa vista do palco puxa a etapa (`stepFromView`).

### Como adicionar um campo

```js
NUM("regras.recFrente","Recuo frontal","m",{step:0.25})        // número
SLD("produto.garTerreo","Térreo p/ garagem",0,0.9,0.05,"%",{pct:true})
SW("produto.atico","Ático técnico")
SEG("estudo.angulo",[["90","90°"],["60","60°"]],{rr:false})
```
O listener delegado grava em `S`, roda o efeito (`upd` recalcula tudo; `cfdLines`, `cfdParts`, `sun`, `clima`… para casos específicos) e re-renderiza se `rr`.

## Regras do térreo e das garagens

- O núcleo (escada, antecâmara, elevadores, shafts) aparece em todos os andares; em garagens ele vem com o hall dos elevadores (`lobby`), obstáculo para vagas e carros.
- Rampas são faixas retas. "Retas empilhadas": todas na mesma projeção — em cada subsolo o carro chega pela ponta de dentro e volta à ponta da frente para descer. "Alternadas (tesoura)": duas faixas lado a lado, sentidos opostos, chegada e partida na mesma ponta. Rampas que descem (subsolos) e que sobem (garagens elevadas) ficam em faixas diferentes, lado a lado na entrada. Cada faixa ocupa só os pavimentos que liga.
- Toda ponta de rampa tem patamar plano (5 m; 6,5 m nas alternadas, para o retorno em U) sem vagas, e um portal que precisa estar ligado à circulação. A rampa só começa 5 m depois do alinhamento.
- Cada pavimento é resolvido por fileiras + verificação numa malha de 0,5 m: o carro (folga de 2,4 m) precisa ir de um portal à frente de cada vaga, com profundidade de manobra livre diante dela; corredores isolados ganham uma passagem (tirando o mínimo de vagas); sobras recebem vagas extras de frente para a circulação.
- Chaves por pavimento em `m.gar`: `s1..sN`, `ter`, `g1..gN`. Marcações manuais usam `<pavimento>:<índice>`.
- Rampa movida à mão (`estudo.rampa`): define a faixa de entrada; as outras ficam ao lado.

## Ideias em aberto

- Layout interno das unidades (paredes, cômodos) — hoje são blocos com área.
- Escada mais profunda quando o núcleo vai até a fachada (hoje ocupa toda a profundidade).
- Mais cidades com regras pré-cadastradas; base de CUB por estado.
