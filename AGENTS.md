# Gabarito — estudo de viabilidade imobiliária

Ferramenta web (arquivo único) para estudos de massa e viabilidade de empreendimentos residenciais verticais: desenha o lote, aplica as regras da prefeitura, mostra o potencial do terreno, otimiza o produto, calcula a viabilidade financeira, faz layout de garagem e pavimento tipo, e simula sol e vento (2D e túnel de vento 3D).

Publicado como Artifact no Codex.ai: https://Codex.ai/artifact/4wBW5QrbVhLrqDQgtdFE7G

## Regras de trabalho

- Interface e textos sempre em **português do Brasil**. Respostas ao Luiz em português, listas em tópicos (sem tabelas no chat).
- Padrão visual **premium, sóbrio e moderno** (nada grosseiro). Qualquer controle novo usa os componentes e tokens existentes do `shell.html`.
- Mostrar só o que está ativo: configurações de uma visualização aparecem apenas quando ela está ligada.
- Não editar `index.html` à mão — ele é gerado.

## Build, testes e desenvolvimento (protótipo local)

```
npm install                       # uma vez (vite, vitest, playwright, three, typescript)
npx playwright install chromium-headless-shell   # uma vez, para o teste visual
npm run dev                       # http://localhost:5173 — monta src/ a cada pedido e recarrega ao salvar
npm run bundle                    # src/ → index.html e test.html (mesmo que `python build.py`)
npm run build                     # + cópia em dist/
npm test                          # Vitest: funções puras + estudos de referência (~1 min)
npm run screens -- all            # Playwright: 7 etapas e sub-abas, desktop+celular, claro+escuro → shots/
npm run typecheck                 # tsc sobre os scripts globais (arquivos com // @ts-check)
```

- O empacotador é `tools/bundle.mjs` (o `build.py` só o chama; o Vite usa o mesmo). `index.html` é o que se publica; `test.html` tem `<html><body>` para o navegador/Playwright.
- Ordem de concatenação (tudo global, `"use strict"`): núcleo de cálculo `state, hooks, geom, layout, garagem, model, programa, finance, optim, clima` → **`src/calc/*.js`** (alfabética) → núcleo de interface `plan2d, view3d, ui, steps, views, ai, export, wind3d` → **`src/ui/*.js`** (alfabética) → `main`.
- O código de cálculo (núcleo + `src/calc`) vai também como texto em `<script type="text/plain" id="calcSrc">`: é dele que nasce o Web Worker e é ele que os testes carregam no Node (`tests/harness.js`). Por isso **`src/calc` não pode tocar em DOM** no nível superior.
- Bibliotecas: three.js r128 + OrbitControls (jsDelivr) no carregamento; jsPDF, JSZip, pdf.js (cdnjs) e MapLibre (unpkg) sob demanda.
- Testes: `tests/*.test.js` (Vitest). Estudos de referência em `tests/cenarios/*.json` — se uma mudança de número for intencional, `node tools/gera-cenarios.mjs` e confira o diff. Testes de ponta a ponta: `tools/teste-plataforma.cjs`, `tools/apresentacao.cjs` (`--html <build>/test.html`).
- Git local (sem remoto). Regras para trabalho em paralelo com agentes: `docs/AGENTES.md`. Plano de backend (Supabase): `docs/BACKEND.md` e `docs/supabase/schema.sql`.

### Pontos de extensão (`src/hooks.js`) — recursos novos entram por aqui
- `extendDEF("chave", padrão)` cria `S.chave` com migração. `HOOK.compute` (fim de `compute`; `opt.quick` = otimizador, pule o pesado), `HOOK.finance`, `HOOK.draw2d` (`ctx={W,H,V,mode,m,opt,w2s,s2w}`), `HOOK.draw3d` (`grp`, `m`), `HOOK.pdf` (páginas extras).
- `m.custosExtra.push({k,nome,sistema,valor})` soma à obra (o orçamento agrupa por `sistema`); `m.vgvUnidades` substitui a receita do mix.
- `addCard(etapa,{key,order,sub,when,html,live,after})` = card extra no inspetor; `ACT.x` / `FX.x` = ações e efeitos novos.
- Um `HOOK.compute` registrado em `src/ui/` NÃO roda no Worker — cálculo que muda `m` mora em `src/calc/`.

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
| `ai.js` | leitura do plano diretor com IA (`window.Codex.use("sample")`) |
| `export.js` | PDF, DXF + IFC (zip), JSON (`downloads`) |
| `wind3d.js` | túnel de vento 3D: LBM D3Q19 + LES num Web Worker, linhas de corrente animadas, fumaça (coluna/cortina/ponto), partículas, setas, plano de cor, pressão (Cp), sonda |
| `main.js` | inicialização |
| `hooks.js` | registros de extensão: `HOOK`, `extendDEF`, `addCard/cardsFor` |

### Módulos de recursos (`src/calc` = cálculo puro · `src/ui` = interface)

| módulo | item | papel |
|---|---|---|
| `ui/calcworker.js` | 0.3 | Web Worker criado do `#calcSrc`. `update()` mostra um cálculo barato (`calcBarato`, reaproveita `lastGar`) e pede o completo (`calcPedir`); pedidos numerados, o mais novo vence; `showModel(m)` aplica; `calcPronto()` espera o completo (PDF, zip, versões). Otimizador e melhor acesso num Worker "job" cancelável. Falhou → volta à página (`localStorage gabarito.worker=false` desliga). `calc/serial.js` deixa o `m` clonável |
| `ui/historico.js` + `calc/histdiff.js` | 0.4 | desfazer/refazer por diferenças JSON (200 passos, um por mudança confirmada: `save()` → `histTouch()`), Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, `#undoBtn/#redoBtn` |
| `ui/repo.js` + `ui/estudos.js` | 4.1 local | `Repo.estudos/versoes/regras` (assíncrono, IndexedDB; troca por Supabase em `docs/BACKEND.md`). Vários estudos (cópia de trabalho em `gabarito.v2`, id em `gabarito.estudo`), versões automáticas (5 min) e nomeadas, restaurar exato, comparar |
| `calc/unidades.js` + `ui/vendas.js` | 1.1 | `m.unidades[]` (torre/andar/final, tipologia, área, fachadas, `sol{inverno,equinocio,verao,media}`, `vista`, `premios`, `preco`); sol por raios a cada 15 min contra `prisms()`; cache por geometria. `S.venda.modo` "medio" (padrão) \| "unidade" (→ `m.vgvUnidades`). `unidadesSolMedio(st,m)` rápido p/ otimizador. Tabela ordenável, CSV/XLSX, 3D e planta tipo coloridos, cartão ao toque, página no PDF |
| `calc/vizinhanca.js` + `ui/vizinhanca.js` | 1.4 | `m.viz` com `S.vizinhanca.on`: perda de sol no entorno (com/sem o prédio, dia 21 de cada mês), mapa de horas perdidas, animação anual, PDF |
| `calc/pareto.js` + `ui/pareto.js` (+ `optim.js`) | 1.3 | `otimizar(opts,onProg?,onDone?)` puro, devolve Promise; guarda lucro, margem, TIR, vagas e sol de cada combinação; fronteira de Pareto conferida com a garagem; gráfico lucro × sol com filtros e "aplicar" |
| `calc/comodos.js` + `ui/comodos.js` | 1.2 | cômodos das unidades: modelos `COM_MODELOS` (studio…3d1s), faixas fachada/circulação/molhada, variações pontuadas, validação (mínimos `S.comodos.min`, janela ≥ 1/6), desenho (paredes, portas, janelas, mobiliário), arrastar divisões, variações salvas por tipologia, DXF por camada, IfcWall/IfcSpace, quadro no PDF |
| `garagem.js` (ampliado) | 2.1 | `estudo.rampaTipo`: reta, alternada, `helicoidal`, `L`, `elevador` (cabine 2,7×5,8, fila M/D/1). Vagas presas, motos, bicicletário, recarga EV perto do quadro; `m.quadroVagas`; opções em `S.garagem` (tudo desligado por padrão) |
| `calc/estrutura.js` + `ui/estrutura.js` | 2.2 | malha de pilares da torre testada em cada garagem; desalinhados viram transição (custo em `custosExtra`, sistema "estrutura"); `estruturaMalhas(st,m)` compara malhas. `S.estrutura.on` (desligado) |
| `calc/forma.js` + `ui/forma.js` | 2.4 | recuos progressivos por faixa de altura, torres escalonadas (`m.T[i].faixas`, `m.env`), embasamento máximo, soleira, plano de aeródromo (`m.hLim`). `S.forma.on` (desligado) |
| `calc/topografia.js` + `ui/topografia.js` | 2.3 | importação CSV/KML/DXF, Delaunay próprio, corte/aterro exato, cota ótima do térreo, contenção e arrimo, lençol freático, curvas de nível e terreno 3D. `S.topo.on` substitui o desnível simples (`m.terra` → `m.terraSimples`) |
| `calc/geo.js` + `ui/mapa.js` | 4.3 | lat/lon ↔ metros locais, UTM SIRGAS, GeoJSON da prefeitura, Overpass → `S.entorno`. Mapa MapLibre (satélite Esri / OSM) sob demanda — o Overpass exige o app servido por http (`npm run dev`) |
| `calc/normas.js` + `ui/normas.js` | 2.5 | checklist PRELIMINAR (IN 09 CBMSC/NBR 9077, NBR 9050): tipo e nº de escadas, larguras, distância a percorrer pelo caminho real no tipo, elevador de emergência, vagas PCD/idoso, rota acessível. Só leitura |
| `calc/cidades.js` | — | biblioteca de regras por cidade/zona (valores ILUSTRATIVOS, "conferir na lei"), `cidadeAplicar/cidadeDesfazer/cidadeSalvarLocal`, `S.regrasRef` |
| `calc/orcamento.js` + `calc/cub.js` | 3.1 | `S.orc.modo` "cub" (padrão) \| "param": custo por sistema com direcionadores do modelo, agrupa `custosExtra`; tabela CUB por UF × padrão (ilustrativa, importável CSV/JSON) |
| `calc/fluxo.js` | 3.2 | curva de obra (senoidal padrão, S, por sistema), recebimento detalhado (ato, mensais, semestrais, chaves, repasse, INCC→IPCA, distratos), cenários, tornado, Monte Carlo com semente. Estado `S.flx` |
| `calc/terreno.js` | 3.3 | compra à vista/parcelada, permuta física/financeira, SPE: fluxo e VPL dos dois lados e ponto de indiferença (`S.terAlt`) |
| `ui/financeiro.js` | 3.x | cards da Viabilidade e páginas do PDF dos itens 3.1–3.3 |
| `calc/verlink.js` + `ui/apresentacao.js` + `ui/marca.js` | 4.2 | modo apresentação (`AP_PASSOS`), link somente leitura `#ver=` (deflate + base64url; não grava nada no navegador de quem abre), marca no PDF (`S.marca`, logo em `gabarito.marca.logo`) |

Padrões: todo recurso que muda números vem desligado; os 5 estudos de referência dão os mesmos resultados de antes.

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

- Andamento do plano e pendências por item: `PLANO.md` (seção "Andamento").
- Migração real para módulos ES/TypeScript (item 0.1 completo) fica para o MVP, junto com o backend.
- Dados que dependem do Luiz: tabela de vendas real (calibrar prêmios), planilha de viabilidade real, revisão das normas e das regras das cidades, coeficientes de custo e CUB atuais.
