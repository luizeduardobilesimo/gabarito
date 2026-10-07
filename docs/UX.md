# Guia de UX do Gabarito (v2)

Objetivo: o usuário entende cada etapa em segundos, vê primeiro o resultado e só os campos essenciais, e encontra o resto quando precisa. Menos texto na tela, mais explicação sob demanda (ⓘ).

## Estrutura de toda etapa (inspetor)

1. **Sub-abas** (`SUBTABS(etapa, [[k, rótulo]…])` em `R.sub`) quando a etapa tem assuntos diferentes. Máximo de 3–4 abas, rótulos de 1–2 palavras. Cards extras usam `addCard(etapa, {sub:k})`.
2. **Resultado** no topo (`RES(título, corpo)`): números-chave e status, sem campos. No máximo 4–6 números.
3. **Essenciais**: 1–2 seções abertas (`SEC(…, {open:true})`) com os campos que quase todo estudo muda.
4. **Demais seções fechadas** (`SEC(…)`), cada uma com **resumo** no cabeçalho (`sum`: os valores atuais em poucas palavras, ex.: `frontal 4 m · divisas 2,5 m`). Atualize o resumo ao vivo com `setSum(key, html)` no `STEP_LIVE`/`live`.
5. **Campos avançados** dentro da seção, atrás de `ADV(corpo, {key})` ("Mais opções").

Meta por etapa/sub-aba, com o estado padrão (seções fechadas, "Mais opções" fechado): **até 12 campos visíveis** e painel com **até ~1.600 px** de altura (desktop). Medir com `node tools/auditoria-ui.cjs --out <pasta>`.

## Componentes (src/ui/ux.js) — use só estes

- `SEC(título, corpo, {key, open, sum, info})` — seção padrão. **Toda** seção é recolhível; não use mais `CARD` com `details:false`/sem details para conteúdo editável. `key` estável (lembra aberto/fechado).
- `RES(título, corpo, {aside})` — bloco de resultado fixo.
- `ADV(corpo, {key})` — "Mais opções".
- `INFO("CA")` ou `INFO("texto explicativo")` — botão ⓘ. Nos campos: `NUM(…, {help:"CA"})` (o `help` aceita sigla do glossário ou texto). No cabeçalho da seção: `SEC(…, {info:"…"})`.
- `TERMO("VGV")` — sigla clicável dentro de um texto.
- `SUBTABS(etapa, opções)` + `subAtual(etapa)`.
- Campos: `NUM, SLD, SW, SEG, STP, TXT, KV, GRP` (src/ui.js). Grade: `KV(...)` já se adapta à largura (não corta).

## Texto

- **Nada de parágrafo explicativo no corpo.** Explicação vai no ⓘ (`info` da seção ou `help` do campo). No corpo, no máximo uma linha curta de status/resultado (`<p class="note">`, ≤ ~80 caracteres).
- Siglas e termos técnicos (CA, TO, VGV, TIR, VPL, TMA, INCC, CUB, ITBI, RET, SPE, PCD…) sempre com ⓘ ou `TERMO`. Termo novo → acrescente em `src/ui/glossario.js` (linguagem simples, 1–3 frases).
- Rótulos curtos (1–3 palavras), unidade no sufixo do campo (`m`, `%`, `R$/m²`), nunca rótulo dentro do placeholder.
- Português do Brasil, tom direto, sem jargão desnecessário.

## Ações e listas

- Um botão primário por seção, no máximo. Ações destrutivas: `btn ghost` + confirmação (padrão "armar": 1º clique vira "Confirmar").
- Listas (torres, mix, lazer, cenários, estudos, entorno…): **linha compacta** (nome + valor principal + ações). A edição detalhada abre **dentro da linha** (expandir) — não mostre todos os campos de todas as linhas ao mesmo tempo. "+ Adicionar" no fim da lista.
- Botões só com ícone têm `aria-label` e `title`.
- Toda função de criar, editar, mover e excluir precisa funcionar e poder ser desfeita (Ctrl+Z).

## Mostrar só o que está ativo

Opções de um recurso aparecem só quando ele está ligado. Recurso desligado = uma linha com o interruptor (e ⓘ).

## Palco (vistas)

- Ferramentas da vista numa barra só; legenda recolhida por padrão (botão "Legenda").
- Dicas (`#hint`) curtas, uma frase.

## Não pode quebrar

- Cálculos e números de referência (`npm test`). Nenhum recurso some: o que sai da vista principal vai para seções fechadas ou "Mais opções".
- `STEP_LIVE` e `live` precisam continuar achando os ids que atualizam.
- Desktop e celular (400 px), claro e escuro, sem erros: `node tools/screens.cjs all`.
