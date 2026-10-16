# Guia de UX do Gabarito (v3)

Objetivo: um incorporador abre o Gabarito sozinho, entende em segundos onde está e o que falta, e vai do lote ao "vale a pena?" sem voltar de etapa nem trocar de guia. Resultado primeiro, poucos campos à vista, explicação sob demanda (ⓘ). Produto comercial, minimalista e premium (identidade Rixel).

A especificação completa da reforma (diagnóstico, destino de cada campo, pacotes) está em `docs/UX-v3.md`. Este guia é o que vale no dia a dia.

## Fluxo: 5 etapas

`Terreno → Produto → Viabilidade → Projeto → Entrega` (chaves `terreno · produto · viab · projeto · cen`).

| # | Etapa | Pergunta | Sub-abas | Vista do palco |
|---|---|---|---|---|
| 1 | Terreno | Onde é e o que a lei permite | — | `impl` |
| 2 | Produto | O que construir | — | `3d` (aceita `impl`, `andar`) |
| 3 | Viabilidade | Vale a pena? | Resultado · Premissas · Riscos | `3d` |
| 4 | Projeto (opcional) | Funciona no desenho? | Garagem · Andares · Sol · Vento | `gar` · `tipo` · `clima` · `clima`/`v3d` |
| 5 | Entrega | Mostrar e guardar | Entregar · Estudos | mantém (sai dos mapas de sol/vento para o 3D) |

- Obrigatório fica nas etapas 1 a 3. Projeto é refino; Entrega é saída.
- Chaves antigas viram aliases: `regras` → Terreno, `clima` → Projeto › Sol (em `goStep`, `LS gabarito.step`, `addCard` e nas ferramentas `--etapas/--steps`).
- Navegação: `irPara(etapa, sub, secKey, campoP?)` troca a sub-aba, abre a seção e o "Mais opções", rola e foca. É o que usam o checklist, a busca, os KPIs e o "Próximo passo".

## Entrada: tela inicial, assistente, exemplo e checklist

- **Tela inicial "Meus estudos"** (`src/ui/inicio.js`): pastas com miniatura, status (rascunho · em andamento · confiável, "6/9") e 3 números. Abre na 1ª visita e quando há mais de 1 estudo; volta pela marca do topo e pelo menu do estudo. Sem estudo próprio: "Novo estudo" e "Explorar o exemplo"; com estudos e sem o exemplo: "Ver o exemplo".
- **Assistente "Novo estudo"** (`src/ui/assistente.js`): 4 perguntas curtas (terreno · cidade e zona · padrão e preço · restrições: livre ou com diretrizes — pode ter subsolo? garagem elevada? tipologias) e "Gerar". Cai em Viabilidade com o cartão "Estudo pronto" (some ao trocar de etapa). Tudo é um passo de desfazer.
- **Estudo de exemplo**: faixa fina "Estudo de exemplo · Começar o meu · Usar como base" acima do cabeçalho.
- **Checklist** (`src/calc/progresso.js`): 9 itens; anel "6/9" no topo e linha no Resultado da Viabilidade; cada pendência tem "Resolver".

## Estrutura de cada tela (inspetor)

1. **`#phead`**: "Etapa N de 5" · título (o nome da etapa) · pergunta em uma linha · sub-abas (`SUBTABS`). Nada de parágrafo.
2. **Resultado** no topo (`RES`): os números que respondem à pergunta da etapa, sem campos. Um RES por tela.
3. **Essenciais**: 1–3 seções abertas (`SEC(…, {open:true})`).
4. **Demais seções fechadas**, com **resumo** no cabeçalho (`sum`, atualizado por `setSum` no `live`). Grupos longos ganham rótulo `SECGRP("Custos")`.
5. **Avançado** atrás de `ADV(corpo, {key})` ("Mais opções").
6. **Rodapé `#pfoot`**: `← etapa anterior` (ghost) · dica de uma linha · **Próximo passo** (o único botão laranja da tela).

### Metas (estado padrão, desktop 1440 — medidas por `node tools/auditoria-ui.cjs --dup`)

- **11 telas**: Terreno 1 · Produto 1 · Viabilidade 3 · Projeto 4 · Entrega 2.
- **Campos visíveis**: Terreno ≤ 9 · Produto ≤ 8 · Viabilidade › Resultado ≤ 8 · as demais ≤ 6.
- **Painel ≤ 1.400 px** de altura.
- **≤ 8 seções por tela contando o RES** (Viabilidade › Premissas pode ter 12, todas fechadas e agrupadas).
- **≤ 1 `.btn.pri` visível por tela** — o do rodapé. No corpo, só `.btn` e `.btn.ghost`. Exceções: o assistente e a tela inicial, que são telas à parte.
- **Casa única**: cada `data-p` vive numa tela só. Espelhos permitidos: preços do mix e da cobertura (Produto e Viabilidade › Premissas principais) e a seção "Vizinhos e ruas" (`entedit`, com `mapa.raio`) em Terreno, Projeto › Sol e Projeto › Vento.
- **Nada some**: todo caminho do inventário `docs/aud-v2.json` (232) continua alcançável abrindo seções e "Mais opções".

## "Próximo passo"

- `proximoPasso(st, m, f, tab, sub)` (puro) decide o botão: com pendência na etapa, ele a resolve ("Desenhar o lote", "Escolher a cidade", "Adicionar 1 subsolo", "Conferir o preço de venda"); sem pendência, avança ("Definir o produto →", "Ver a viabilidade →", "Conferir o projeto →", "Conferir os andares →", "Ver o sol →", "Ver o vento →", "Entregar →"). Na Entrega é "Baixar relatório PDF", com "Apresentar" ao lado.
- **Conferir ≠ clicar à distância:** "Conferir o preço de venda" e "Conferir terreno e obra" levam ao campo (focado e destacado) e a confirmação é feita ali — editando o valor ou no botão "Conferi" da seção. O mesmo vale para as regras (botão "Conferi" ao lado do seletor de cidade). O checklist do topo só leva aos campos; nunca marca por conta própria.
- Nunca vazio, nunca beco sem saída: todo rótulo leva a uma etapa, sub-aba e seção, ou executa uma ação.

## Componentes (`src/ui/ux.js` e `src/ui.js`) — use só estes

- `SEC(título, corpo, {key, open, sum, info})` — seção recolhível (toda seção é recolhível; `key` estável lembra aberto/fechado).
- `RES(título, corpo, {aside, asideId})` — bloco de resultado; o `aside` leva o selo ("dentro das regras", "atende", "atenção").
- `SECGRP(título)` — rótulo de grupo entre seções.
- `ADV(corpo, {key})` — "Mais opções".
- `INFO("CA")` / `INFO("texto")` — botão ⓘ; nos campos, `NUM(…, {help:"CA"})`; no cabeçalho da seção, `SEC(…, {info:"…"})`.
- `TERMO("VGV", "rótulo")` — sigla clicável dentro de um texto.
- `SUBTABS(etapa, opções)` + `subAtual(etapa)`; Projeto usa `data-act="psub"` (estado em `PSUB`; o modo do clima em `CSUB`).
- Campos: `NUM, SLD, SW, SEG, STP, TXT, KV, GRP`. Cards extras: `addCard(etapa, {key, sub, order, html, live, after})`.
- CSS novo vai injetado pelo próprio módulo, só com tokens `var(--…)` do `shell.html`.

## Texto

- **Nada de parágrafo no corpo.** Explicação vai no ⓘ. No corpo, no máximo uma linha curta de status (`<p class="note">`, ≤ ~80 caracteres).
- Linguagem do incorporador: "Aproveitamento (CA ⓘ)", "Ocupação da torre (TO ⓘ)", "Margem (ⓘ sobre o VGV)", "Retorno ao ano (TIR ⓘ)", "Caixa necessário (ⓘ exposição)", "Resultado detalhado (DRE ⓘ)", "O que melhora o resultado", "Simulação de incertezas", "Alternativas salvas" (lista completa em `docs/UX-v3.md` §4.7). Sigla sempre com ⓘ ou `TERMO`; termo novo vai para `src/ui/glossario.js`.
- "Cenário" é só pessimista/otimista (Riscos). O que se guarda para comparar é **alternativa**.
- Rótulos de 1–3 palavras, unidade no sufixo do campo, português do Brasil, tom direto.

## Ações e listas

- Ações destrutivas: `btn ghost` + "armar" (1º clique vira "Confirmar") e Ctrl+Z.
- Listas (torres, mix, lazer, blocos, estudos, alternativas, entorno): linha compacta; a edição abre dentro da linha; "+ Adicionar" no fim.
- Botões só com ícone têm `aria-label` e `title`. Toda função de criar, editar, mover e excluir pode ser desfeita (Ctrl+Z).

## Mostrar só o que está ativo

Opções de um recurso aparecem só quando ele está ligado. Desligado = uma linha com o interruptor e o ⓘ. Vento mostra um modo de cada vez ("No chão (rápido)" ou "Túnel 3D"); o túnel pausa sozinho fora da sua tela.

## Topo, régua e palco

- Topo: marca (→ Meus estudos) · nome do estudo ▾ (novo, meus estudos, duplicar, versão, alternativa, abrir .json, restaurar exemplo) · anel do checklist · desfazer/refazer · "Salvo" · stepper · buscar (Ctrl+K) · Apresentar · PDF · "…" (tema, glossário, arquivos). O laranja não fica no topo.
- Régua: 6 KPIs clicáveis (Unidades, Regras, Vagas, VGV, Margem, Retorno) + "⋯"; ponto de 6 px de status, valor colorido só quando ruim.
- Palco: uma barra de vistas; ferramentas da vista numa barra só; legenda recolhida; dicas (`#hint`) de uma frase, que somem sozinhas.

## Celular (400 px)

- Palco em tela cheia; o inspetor é uma **folha** com 3 alturas (espiada 28% · média 58% padrão · cheia 92%), puxador, 3 KPIs no topo e o rodapé fixo. Na folha cheia o palco vira uma faixa sem sobreposições.
- Barra inferior com as 5 etapas (≥ 54 px); alvos de toque ≥ 40 px; ferramenta de desenho ligada → a folha desce.
- Popovers, menus e busca abrem como folhas por baixo; assistente e tela inicial ocupam a tela.

## Não pode quebrar

- Números (`npm test`, sem regenerar `tests/cenarios`).
- `STEP_LIVE` e `live` acham os ids que atualizam.
- `node tools/screens.cjs all` sem erro de JS (desktop e celular, claro e escuro; no celular, folha média e cheia; o túnel 3D incluso) e `node tools/auditoria-ui.cjs --dup` com "Metas: … todas dentro".
