# Plantas de apartamento: regras, catálogo e modelos do usuário (especificação)

Pedido do Luiz (15/10/2026): o sistema não pode criar "qualquer layout só para caber". As plantas das unidades precisam
respeitar regras de projeto e padrões de mercado; o usuário escolhe, por tipologia, quais partidos o estudo tenta
reproduzir (catálogo com ~15 partidos), e pode desenhar os próprios modelos (templates) para usar em todos os estudos.

## 1. Regras (validação de toda planta, gerada ou desenhada) — `src/calc/aptoregras.js`

Cada regra devolve `{k, nivel:"bad"|"warn", amb?, msg}`; `aptoValida(planta, st)` → `{ok, nota, problemas[]}` (puro, sem DOM).
Parâmetros em `S.comodos.regras` (extendDEF; valores de referência genéricos, "conferir no código de obras").

- **Círculo inscrito mínimo** (o "raio mínimo" do ambiente: o maior círculo que cabe dentro do ambiente, já
  descontando paredes): sala Ø 2,60 · suíte Ø 2,50 · dormitório Ø 2,30 · cozinha Ø 1,50 · serviço Ø 1,00 · banho Ø 1,10
  · lavabo Ø 0,90 · circulação largura ≥ 0,90 · closet Ø 1,00 · sacada profundidade ≥ 1,10.
- **Área mínima** por ambiente (tabela atual `S.comodos.min`).
- **Proporção**: lado maior ÷ lado menor ≤ 2,2 em dormitórios/suíte e ≤ 3,0 na sala (nada de "corredor-quarto").
- **Acessos (grafo)**: todo ambiente alcançável a partir da entrada da unidade, por portas de ≥ 0,80 m (banho 0,70,
  com área de giro da porta livre). Não vale passar por: banheiro, dormitório/suíte (exceto para o banho/closet DA
  própria suíte), área de serviço (exceto para o depósito). Banho da suíte só pela suíte; closet só pela suíte.
  Dormitórios e banho social acessados pela circulação íntima ou pela sala, nunca pela cozinha.
- **Zoneamento**: entrada pela área social ou pela cozinha/serviço; zona íntima agrupada (dormitórios + banhos
  contíguos à circulação íntima); cozinha junto do serviço; áreas molhadas próximas do shaft/da faixa molhada.
- **Iluminação e ventilação**: permanência prolongada (sala, dormitórios, suíte) com janela na fachada ≥ 1/6 da área do
  piso; cozinha e serviço com janela ou duto; banheiro com janela ou duto.
- **Mobiliário cabe**: sala (sofá 2,0 × 0,9 + mesa 4 lugares), suíte (cama casal 1,40 × 1,90 com 0,60 livre em 2
  lados), dormitório (cama solteiro 0,90 × 1,90 + 0,60 livre), cozinha (bancada linear ≥ 1,80 m + 0,90 livre).
- **Porta não bate em porta** e não abre sobre a bancada/vaso.
- **Nota**: parte de 100; `bad` −25, `warn` −6; desvio da área-alvo de cada ambiente −0,5 por ponto percentual acima
  de 10%. O gerador escolhe a melhor nota entre os partidos permitidos; planta com `bad` só sai se nenhum partido cabe,
  e então aparece o aviso "nenhum partido cabe nesta unidade" com o motivo (ex.: "frente de 5,4 m; o partido pede 6,8 m").

## 2. Formato do modelo (partido) — o mesmo para o catálogo e para o usuário

```js
{
  id: "cat-2d1s-social-ponta" | "usr-<uuid>",
  nome: "2 dorm. com suíte · social na ponta",
  origem: "catalogo" | "usuario",
  tipologia: "studio"|"1d"|"1s"|"2d"|"2d1s"|"2s"|"3d1s"|"4d1s",   // mesma chave de COM_MODELOS
  W: 7.2, D: 9.6,            // frente (ao longo da fachada) × profundidade (fachada → corredor), m, do desenho de referência
  faixaW: {min: 6.4, max: 9.0},   // frente em que o partido funciona (o gerador não estica além)
  faixaD: {min: 8.4, max: 11.0},
  entrada: {x: 5.9, lado: "corredor"},  // posição da porta de entrada no lado do corredor (y = D)
  ambientes: [               // retângulos no referencial: x ao longo da fachada, y = 0 na fachada, y = D no corredor
    { id:"a1", k:"sala", ret:[0, 0, 3.6, 5.2], estica:"xy" },     // estica: "x" | "y" | "xy" | "" (fixo)
    { id:"a2", k:"suite", ret:[3.6, 0, 3.6, 3.4], estica:"x" },
    { id:"a3", k:"bsuite", ret:[3.6, 3.4, 1.6, 2.4], estica:"" },
    ...
  ],
  portas: [ {a:"a2", b:"a3"}, {a:"entrada", b:"a1"}, ... ],   // opcional: sem portas, o gerador deduz pela adjacência + regras
  sacada: {lado:"fachada", prof:1.4, sobre:["a1"]},          // opcional
  criado, atualizado
}
```

- Ambientes são retângulos (ortogonais) que, juntos, preenchem o retângulo W × D (sem sobreposição; folga < 1%).
  Ambientes em "L" = dois retângulos com o mesmo `grupo`.
- Para aplicar a uma unidade real de frente W' × profundidade D' (dentro de `faixaW/faixaD`): escala por faixas — as
  colunas/linhas que só têm ambientes com `estica` naquele eixo absorvem a diferença; ambientes fixos mantêm a medida.
  Unidade não retangular: aplica no maior retângulo inscrito e as sobras viram extensão do ambiente vizinho (como hoje).
- Espelhamento (entrada do outro lado) é automático.

## 3. Catálogo de partidos (~15, `src/calc/aptocatalogo.js`) — padrões de mercado brasileiro

Studio linear · Studio com cozinha americana · 1 dorm. compacto · 1 suíte com varanda · 1 dorm. + home office ·
2 dorm. linear (social na ponta) · 2 dorm. com social central · 2 dorm. com suíte · social na ponta · 2 dorm. com suíte ·
cozinha integrada · 2 dorm. com suíte · frente estreita (profundo) · 2 suítes + lavabo · 3 dorm. com suíte · social
central · 3 dorm. com suíte · frente larga (sala ampla) · 3 suítes + lavabo (alto padrão) · 4 dorm. com suíte (alto
padrão). Cada um validado pelas regras do §1 nos testes (nota ≥ 80 no tamanho de referência e nos extremos da faixa).

## 4. Biblioteca do usuário e escolha no estudo

- **Biblioteca da empresa** (`src/ui/aptobiblioteca.js` + editor): modelos do usuário guardados em localStorage
  `gabarito.aptos.biblioteca` (lista de modelos no formato do §2; troca por Supabase depois, `docs/BACKEND.md`).
  API global: `aptoBiblioteca()` → array, `aptoBibSalvar(modelo)`, `aptoBibExcluir(id)`, `aptoEditorAbrir({modelo?, tipologia?, onSalvar})`.
- **Estudo**: `S.comodos.tipos[i].partidos = [ids]` (vazio = automático: todos os do catálogo daquela tipologia). Os
  modelos do usuário escolhidos são COPIADOS para `S.comodos.modelos[]` (o estudo fica completo para o link `#ver=`, a
  nuvem e o Worker, que não lê localStorage).
- **Onde aparece**: Projeto › Andares › "Plantas das unidades" (seção com resumo): por tipologia, galeria pequena dos
  partidos (miniatura SVG + nome + nota na unidade real), marcar quais tentar; botão "Meus modelos" (abre o editor/biblioteca);
  aviso quando nenhum partido escolhido cabe. Também no menu "…" do topo: "Modelos de apartamento".
- **Editor** (tela cheia, como a tela inicial): grade de 5 cm com ímã; desenhar retângulos de ambientes, escolher o tipo,
  arrastar divisas, colocar porta de entrada e portas internas, marcar o que estica; validação ao vivo pelas regras do §1
  (lista de problemas + destaque no desenho); medidas e áreas em cada ambiente; "Começar de um partido do catálogo";
  salvar, duplicar, excluir, exportar/importar JSON. Celular: só ver e escolher (desenho no desktop).

## 5. Repartição do pavimento tipo pelos partidos — `src/calc/reparte.js`

Revisão do Luiz (15/10/2026, estudo exemplo): uma unidade "2 dorm." em L abraçando o núcleo com sala de 8,5 m² e uma "3 dorm."
de 8,6 m de frente que nenhum partido aceitava. A causa era a **divisão do andar** (unidades distribuídas e cortadas só pela
área) e uma regra frouxa (a sala somava a cozinha integrada). Agora:

- **Regra da sala** (§1): mínimo por tipologia, a sala sozinha (`S.comodos.regras.sala`: 1 dorm. 10 m² · 2 dorm. 12 m² ·
  3 dorm. 14 m² · 3 suítes/4 dorm. 16 m²; grave abaixo de 85%) e nunca bem menor que o maior quarto (`salaQuarto`).
- **Sacada embutida**: só na frente da sala (até 2,6 m) ou corrida na frente do quarto vizinho (até 2,0 m), sem tirar do
  ambiente coberto o fundo mínimo (sala/suíte 2,9 m, dormitório 2,7 m); não cabendo, fica a maior possível.
- **Repartição**: para cada trecho de fachada (dos dois lados do corredor, em volta do núcleo; alas; blocos da pilha) o andar
  testa as distribuições das unidades do mix entre os trechos, a ordem em cada trecho e a largura de cada unidade, e fica com
  a de menor custo — unidade dentro da faixa (`faixaW/faixaD`) de um partido permitido, retangular (3+ dormitórios nunca em L
  junto do núcleo), área perto do alvo do mix e a tipologia maior na ponta. A quantidade e a área-alvo continuam as do mix.
- **Núcleo**: a posição não muda (garagens e térreo dependem dela); com `estudo.escadaLado` "auto" (padrão) a escada fica do
  lado em que a sobra atrás dela serve melhor a unidade vizinha (ou na profundidade toda, sem sobra), com o mesmo contorno.
- **Sem repartição boa**: a unidade fica sem planta, tracejada, com o motivo ("frente útil 4,8 m · pedem ≥ 10,6 m") — nada de
  planta "só para caber".
- **Galeria**: os partidos que cabem primeiro (pela nota), os que não cabem agrupados no fim com o que pedem.
