# Núcleo, garagem, térreo e áreas comuns: realismo de projeto (especificação)

Pedido do Luiz (16/10/2026): "Os apartamentos ficaram ótimos, mas garagens, hall, núcleo (escada, elevadores, dutos,
shafts) e toda a parte de área comum estão genéricos demais, sem serem funcionais de verdade e próximos da realidade."

Mesmo método que funcionou nas plantas (`docs/APTOS.md`): **regras de projeto reais + catálogo de partidos de
mercado + validação com nota e motivo + desenho técnico fiel**. Nada de "desenhar qualquer coisa só para caber":
quando não dá, o sistema diz por quê e o que faria caber. Valores = referência genérica (NBR 9077, NBR 9050,
IN 09/CBMSC, NBR 13994/16858 elevadores, códigos de obras usuais); tudo configurável e marcado "conferir na lei".

## 0. Contratos entre os três pacotes (não quebrar)

- O núcleo continua saindo como hoje no layout do tipo: `lay.core` (contorno), `lay.lobby` (hall dos elevadores
  no térreo/garagens), `lay.coreParts[{nome,kind,poly,area}]`, `lay.coreDoors`, `lay.coreLines`, `lay.coreA`,
  `lay.coreKinds`; e em `m.coreSets[{i,core,lobby,lay}]`, `m.obst`. Campos novos são acréscimo:
  `lay.nucleo = {partido, nota, problemas, portas:[{p, dir, larg, tipo:"elev"|"escada"|"servico"}], hallElev, prumadas}`.
  `portas` = onde o hall/corredor/garagem se liga ao núcleo — a garagem e o térreo usam isso para ligar circulação.
- A garagem e o térreo tratam `core` + `lobby` como obstáculo e PRECISAM ligar o hall dos elevadores de cada núcleo
  à circulação (garagem: ao corredor de carros por uma faixa de pedestres; térreo: ao hall social).
- Estudos de referência (`tests/cenarios`): mudanças de número desses pacotes são **intencionais** (vagas, áreas de
  núcleo, áreas comuns). Os agentes NÃO regeneram `tests/cenarios/*.json` (rodam o vitest com
  `--exclude tests/cenarios.test.js` e relatam, campo a campo, o que mudaria e por quê); o coordenador regenera uma
  vez na integração e anota a exceção no CLAUDE.md. Áreas vendáveis (privativa, VGV) não devem mudar sem motivo.

## 1. Núcleo de circulação vertical — `src/calc/nucleo.js` (+ `layout.js coreSeq/coreBuild`)

- **Partidos de núcleo** (catálogo ~8): linear encostado na fachada (escada + antecâmara + elevadores em fila);
  compacto central em "U" (elevadores frente a frente com hall entre eles); em "L"; escada pressurizada sem dutos;
  escada aberta para balcão (PF balcão); duas escadas (edifícios altos/lâminas longas); com elevador de emergência;
  núcleo baixo (≤ 4 pav., escada comum + 1 elevador). Escolha automática pela altura, nº de unidades, planta e
  tipo de escada (`estudo.escTipo`), com nota; usuário pode fixar.
- **Regras** (validação com nota, como `aptoValida`): escada — largura útil ≥ 1,20 m (unidades de passagem pela
  população), lances e patamar intermediário ≥ largura, degrau espelho 16–18 cm/piso 28–32 (Blondel 63–64),
  corrimão; antecâmara ≥ 1,80 m de profundidade com portas corta-fogo P-90 (0,90) abrindo no sentido da fuga, sem
  bater; dutos de entrada e saída de ar (≥ 0,70 m² cada, saída acima da cobertura) na PF; pressurização com casa
  de máquinas; elevadores — caixa por capacidade (ex.: 8 pass. ≈ 1,80 × 1,85; cabine ≥ 1,10 × 1,40 acessível),
  quantidade pelo cálculo de tráfego simplificado (população, intervalo); hall de elevadores ≥ 1,50 m livre à
  frente das portas (giro de cadeira), nunca a porta do elevador abrindo direto na antecâmara; elevador de
  emergência quando a altura pedir; shafts por prumada (hidráulico, elétrico/telecom, gás) com acesso pelo hall
  ou área comum, alinhados verticalmente; DML/lixo com porta para o hall de serviço; distância máxima a percorrer
  até a escada pelo caminho real (já existe `normaDistTipo`).
- **Desenho técnico**: escada com lances, degraus, patamar, linha de piso e seta "sobe"; portas com folha e arco no
  sentido certo; elevadores com cabine, contrapeso e portas; dutos com indicação de fluxo; shafts com hachura e
  rótulo da prumada; paredes com espessura (estrutural/corta-fogo mais grossas). Igual em todos os pavimentos
  (tipo, térreo, garagens), com o hall dos elevadores dimensionado.

## 2. Garagem — `src/garagem.js` (+ `src/calc/garmod.js` novo)

- **Meta de realidade**: 25–32 m² de área bruta por vaga em subsolo retangular regular (hoje há pavimentos com
  ~50 m²/vaga e grandes áreas cinzas sem uso). Circulação contínua (anel ou espinha), sem becos; fileiras
  encostadas nas paredes; vagas a 90° dos dois lados de corredores de 5,50 m (módulo 5,0 + 5,5 + 5,0 = 15,5 m);
  45°/60° só quando o módulo rende mais.
- **Estrutura**: malha de pilares coerente com a da torre quando houver (`calc/estrutura.js`), vãos de 7,5–8,4 m
  (3 vagas entre pilares) ou 5,0–5,6 m (2 vagas); pilares fora das vagas e do corredor; muro de arrimo no
  perímetro do subsolo.
- **Partidos de garagem** (catálogo ~6): módulo simples (1 corredor, 2 fileiras); módulo duplo; anel perimetral com
  ilha central; espinha central com rampa na ponta; 45°/60° em mão única; garagem estreita (1 fileira + corredor).
  O gerador testa os partidos e orientações e escolhe pela nota (vagas, m²/vaga, manobras, vagas presas, distância
  ao elevador), em vez de só preencher fileiras.
- **Regras**: vaga 2,40–2,50 × 5,00 (pequena 2,20 × 4,50 opcional), PCD com faixa de 1,20 m e perto do hall dos
  elevadores, idoso perto do hall; corredor 5,50 (90°), 4,50 (60°), 3,80 (45°); raio de giro; rampas retas com
  inclinação ≤ 20% (pode ≤ 25% sem vagas próximas, conferir) e trechos de transição de 10% nas pontas; largura de
  rampa 2,75 (mão única) / 5,00 (dupla); patamar de 5 m antes do alinhamento; pé-direito livre ≥ 2,30 sob vigas;
  faixa de pedestres do hall dos elevadores ao corredor; nenhuma vaga dentro do hall, de rampa ou de patamar;
  vagas presas só quando permitidas e marcadas (mesma unidade).
- **Desenho**: vagas numeradas com faixa e batente, setas de sentido no corredor, pilares em malha, rampas com
  setas e inclinação, faixa de pedestres zebrada até o hall, raio de giro nas curvas.

## 3. Térreo, hall e áreas comuns — `src/programa.js` (+ `src/calc/comuns.js` novo)

- **Programa realista do térreo residencial** (catálogo de ambientes com medidas, adjacências e obrigatoriedade):
  acesso de pedestres com clausura/eclusa e guarita/portaria com visão do acesso de veículos e de pedestres;
  hall social com recepção ligado ao hall dos elevadores de cada torre; hall de serviço/entrada de serviço;
  abrigo de resíduos junto ao alinhamento (acesso pela rua); central de gás (GLP) afastada, ventilada e acessível;
  medidores (água/energia) junto à entrada; banheiros acessíveis do condomínio; vestiário e copa de funcionários;
  DML/depósito do condomínio; bicicletário; e o lazer do programa (`LZ_PRESETS`) com suas necessidades — salão de
  festas com copa e banheiros PCD adjacentes, espaço gourmet com churrasqueira e exaustão, academia com área
  mínima por aparelho, brinquedoteca com visão, lavanderia, coworking; piscina na laje com solário, ducha e
  vestiário/banheiro próximo, deck; playground com piso de segurança.
- **Regras**: dimensões mínimas e proporção por ambiente (círculo inscrito, como nos apartamentos), adjacências
  obrigatórias (salão↔copa↔banheiros; gourmet↔churrasqueira; piscina↔ducha/banheiro; portaria↔acessos),
  circulação acessível (rota contínua ≥ 1,20 m do acesso a todos os ambientes e aos elevadores, sem passar por
  outro ambiente), afastamentos (gás, lixo), iluminação/ventilação dos ambientes de permanência, carro nunca cruza
  o hall/pedestres. Nota e problemas em linguagem simples.
- **Desenho**: cada ambiente com nome, área, mobiliário/equipamento básico (mesas, aparelhos, churrasqueira, louças),
  portas, rota acessível marcada, paisagismo nos recuos descobertos.

## 4. Onde aparece (UX v3)

- Projeto › Andares: seção "Núcleo de circulação" (partido, nota, problemas, fixar partido) — substitui/absorve
  "Escadas e elevadores" mantendo os campos; seção "Térreo e áreas comuns" (programa, nota, problemas).
- Projeto › Garagem: no RES, m²/vaga e nota da garagem; seção "Partido da garagem" (fechada, com resumo).
- Respeitar `docs/UX.md` (v3): ≤ 6 campos visíveis por sub-aba, seções fechadas com resumo, painel ≤ 1.400 px,
  um `.btn.pri` (o do rodapé), Ctrl+Z em tudo.

## 5. Exemplos do Luiz (16/10/2026) — não se limitar a eles

- Vagas encostadas em parede ou pilar de um lado ou dos dois lados têm largura acrescida (configurável, "conferir na lei").
- Vaga PCD com faixa de transferência de 1,20 m de um lado ou compartilhada entre duas vagas PCD; marcada no desenho.
- Rampas e acessos: geometria real (transições de 10%, patamar, raio de curva, portão/controle e espera fora da via,
  sem conflito com vagas e pedestres).
- Rota de veículos e manobra: raio de giro real (≈ 5,5–6,0 m externo), sentido de circulação coerente, manobra diante
  de cada vaga sem invadir outra vaga ou pilar, sem becos sem retorno.
- Lazer: nada de "quadrado genérico no meio"; cada ambiente com formato e equipamento do seu uso, encostado em
  paredes/fachadas e organizado ao longo de uma circulação clara a partir do hall.
- Núcleos em harmonia: peça coesa, alinhada à malha e às prumadas, módulos alinhados, hall retangular centrado nas
  portas, sem serrilhados nem sobras, na mesma posição em todos os pavimentos.
