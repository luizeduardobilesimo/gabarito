# Regras para quem implementa itens do PLANO.md (agentes em paralelo)

Vários agentes trabalham AO MESMO TEMPO na mesma pasta `C:\DEV\Gabarito`. Leia `CLAUDE.md` (arquitetura) e o seu item no `PLANO.md` antes de começar.

## Onde colocar o código
- **Cálculo puro (sem DOM)** → arquivo novo em `src/calc/<nome>.js`. Entra sozinho no build, em ordem alfabética, depois do núcleo (`state, hooks, geom, layout, garagem, model, programa, finance, optim, clima`). Também roda nos testes (Node) e no Web Worker — então NADA de `document`/`window`/`THREE` no nível superior desses arquivos.
- **Interface** → arquivo novo em `src/ui/<nome>.js`. Entra depois do núcleo de interface (`plan2d, view3d, ui, steps, views, ai, export, wind3d`) e antes de `main.js`.
- No nível superior de arquivos novos: só declare funções/constantes e registre ganchos. Não chame funções de outros arquivos novos no carregamento (a ordem alfabética não garante dependência).
- Tudo é global e `"use strict"`. Prefixe nomes para não colidir (ex.: `vendaX`, `orcX`, `topoX`). Atenção: `G` é o namespace de geometria (`G.area`, `G.clipToPoly`…), `S` o estado, `m` o modelo, `f` o financeiro.

## Pontos de extensão (src/hooks.js) — use-os em vez de editar os arquivos centrais
- `extendDEF("chave", {...padrão})` → cria `S.chave` com migração automática. Campos novos de estado SEMPRE por aqui (ou em `DEF` se você for dono do arquivo). Estudos antigos têm de continuar abrindo.
- `HOOK.compute.push((m, st, opt)=>{…})` → enriquece o modelo no fim de `compute()`. `opt.quick` = chamada rápida (otimizador, dezenas de vezes): pule tudo que for pesado.
- `m.custosExtra.push({k, nome, sistema, valor})` → custo somado à obra pela `finance()`.
- `m.vgvUnidades = número` → substitui a receita residencial do mix (tabela de vendas por unidade).
- `HOOK.finance.push((f, st, m, adj)=>{…})` → enriquece o resultado financeiro (barato: roda na sensibilidade).
- `HOOK.draw2d.push((g, ctx)=>{…})` → desenha por cima das plantas. `ctx = {W,H,V,mode,m,opt,w2s,s2w}`; `mode` ∈ impl|gar|tipo|andar|clima.
- `HOOK.draw3d.push((grp, m)=>{…})` → adiciona objetos à cena 3D (`grp` é limpo e refeito a cada mudança; `V3` tem câmera/cena).
- `HOOK.pdf.push(async ctx=>{…})` → páginas extras no PDF. `ctx = {doc,m,f,T,PW,M,head,h2,rows,img,y(),setY(v),newPage()}`.
- `addCard("etapa", {key, order, sub, when, html, live, after})` → card extra no inspetor. `etapa` ∈ terreno|regras|produto|viab|projeto|clima|cen; `sub` = sub-aba (projeto: gar|tipo|andar; clima: sol|vento|v3d); `when()` false esconde; `html()` devolve marcação com `CARD/NUM/SLD/SW/SEG/KV/GRP`; `live(m,f,fast)` atualiza as partes vivas; `after()` roda depois de montar.
- `ACT.nome = el=>{…}` (cliques em `data-act="nome"`) e `FX.nome = live=>{…}` (efeito de campos `data-fx="nome"`).

## Arquivos compartilhados
- Só edite arquivos centrais que o seu briefing lista como seus. Nos outros, apenas mudanças mínimas e cirúrgicas, quando inevitáveis.
- Antes de CADA edição num arquivo compartilhado, leia de novo o trecho (outro agente pode ter mudado). Use a ferramenta Edit com trechos pequenos e únicos. NUNCA reescreva um arquivo compartilhado inteiro (Write) nem use scripts que regravam o arquivo todo a partir de uma cópia antiga.
- Não apague nem "arrume" código de outros agentes. Se algo de outro módulo quebrar o build, espere um pouco e tente de novo; se persistir, descreva no relatório.

## Visual e texto
- Interface em português do Brasil. Visual premium, sóbrio, moderno: só tokens/componentes de `src/shell.html` (`card`, `btn`, `seg`, `kv`, `fld`, `sl`, `sw`, `pill`, `tbl`, `note`, `met`, cores `var(--ink|muted|accent|ok|warn|bad|mark|surface|line…)`). Nada de cores fixas que quebrem o tema escuro.
- Mostrar só o que está ativo: opções de um recurso só aparecem quando ele está ligado.
- Não edite `index.html`/`test.html` à mão (são gerados).

## Build, testes e validação (use a SUA pasta de saída para não colidir)
- Build privado: `node tools/bundle.mjs --out <scratch>/build` → gera `index.html` e `test.html` ali.
- Testes: `npx vitest run` (todos) ou `npx vitest run tests/<seu>.test.js`. Harness: `tests/harness.js` (`const A = carregar(); A.compute(st); A.finance(st,m); A.G.area(p)`; `estado(A, parcial)` monta um estado).
- Crie `tests/<seu-item>.test.js` com testes das funções puras e os critérios de pronto do PLANO.md.
- Estudos de referência (`tests/cenarios.test.js`): com os padrões do seu recurso, os números do exemplo NÃO devem mudar. Se o seu item muda resultados de propósito, deixe o novo comportamento desligado por padrão OU descreva a mudança no relatório final. NÃO regenere `tests/cenarios/*.json`.
- Visual: `node tools/screens.cjs all --html <scratch>/build/test.html --out <scratch>/shots` (desktop+celular, claro+escuro, sem erros de JS). Abra as capturas das telas que você mudou e confira. Para fluxos específicos, escreva um script Playwright seu (modelo em `tools/screens.cjs`; o three.js é servido de `node_modules`).
- Desempenho: nada que trave a interface > 100 ms ao arrastar controles; cálculo pesado com cache por assinatura e pulado quando `opt.quick`.
- Não use git (o coordenador faz os commits). Não publique nada, não instale serviços externos (sem Supabase/Vercel/GitHub). Bibliotecas extras só por CDN permitida (cdnjs, jsdelivr, unpkg) carregadas sob demanda, ou devDependency npm só para testes.

## Relatório final (sua última mensagem)
Em português, curto: o que foi feito (por item/critério de pronto), arquivos criados/alterados, campos novos de estado, ganchos usados, testes criados e resultado, capturas conferidas, o que ficou faltando/limitações, e um parágrafo pronto para o `CLAUDE.md` descrevendo seus módulos.
