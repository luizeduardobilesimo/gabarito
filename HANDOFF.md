# Handoff — continuar o Gabarito no Claude Code

Este arquivo passa adiante o contexto da conversa original no app Claude (Cowork), de 03/10 a 13/10/2026, em que o Gabarito nasceu e foi redesenhado várias vezes. Ele complementa:

- o `CLAUDE.md` (arquitetura e convenções);
- o `PLANO.md` (roteiro e andamento);
- o `docs/EVOLUCAO.md` (Evolução v2).

**Como usar:** abra o Claude Code em `C:\DEV\Gabarito` e comece com algo como: *"Leia HANDOFF.md, CLAUDE.md, PLANO.md e docs/EVOLUCAO.md e me diga onde paramos."*

**Atenção:** a pasta é a fonte da verdade. Depois que a conversa original terminou, o projeto avançou bastante em sessões do Claude Code (Vite, testes, Worker, Fase 0 a 4 do plano, Evolução v2 Fase A e B). O artifact publicado no claude.ai pode estar mais antigo que a pasta.

---

## 1. Quem é o Luiz e como ele gosta de trabalhar

- **Quem é:** engenheiro e empreendedor do setor AEC (arquitetura, engenharia e construção), no sul de Santa Catarina (região de Criciúma / Torres). Fundador da Grovio e da Vebim.
- **Como responder:**
  - sempre em português do Brasil;
  - listas em tópicos, **nunca tabelas no chat** (o app dele não cola tabelas);
  - respostas objetivas, com o resultado primeiro.
- **Exigência visual:** alta. Quer tudo "premium, sofisticado, moderno, nada grotesco", nos menus, campos, interações, 3D, vento e sol.
  - Já reprovou com dureza: setas de vento "parecendo macarrão", menus que mostravam configurações de recursos desligados, abas cortadas e telas com muita rolagem e sub-abas.
- **Autonomia:** espera que o assistente faça tudo o que pediu, de forma completa, sem parar para perguntar o óbvio. Quando pede "faça tudo", é tudo mesmo.
- **Testa muito pelo celular.** Telas para 400 px de largura e o tema escuro precisam funcionar.
- **Aponta erros de realismo técnico:** vaga dentro do hall, rampa sem acesso, faixas de escada e elevador sem sentido em planta. Antes de entregar, confira se faz sentido como projeto real de arquitetura.
- **Quer facilidade:** o sistema precisa ser fácil para qualquer pessoa, mas completo e "mostrar domínio" para diferenciar no mercado.

## 2. O que é o Gabarito

Sistema web de **estudo de massa e viabilidade de incorporação imobiliária** (residencial vertical). O fluxo é:

1. desenhar o lote (mapa, coordenadas, retângulo, imagem);
2. preencher as regras da prefeitura (com leitura do plano diretor por IA);
3. ver o potencial do terreno e otimizar o produto;
4. viabilidade financeira (fluxo mensal, TIR, VPL, exposição, cenários);
5. projeto (garagem com vagas e rampas, pavimento tipo com núcleo e cômodos, todos os andares);
6. clima (horas de sol, vento 2D, túnel de vento 3D com LBM);
7. cenários e entrega (PDF, DXF, IFC, JSON, modo apresentação).

A ideia original do Luiz: desenhar o lote num mapa, colocar as regras da prefeitura e simular o empreendimento em números e sliders, com reflexo no 3D, chegando à viabilidade financeira.

## 3. Linha do tempo da conversa original (o porquê das coisas)

1. **Protótipo inicial:** lote, regras, massing 3D, mix, viabilidade.
2. **"Sistema completo":** várias torres sobre embasamento, layout de garagem (90/60/45°), pavimento tipo, andares, sol e vento, entorno, cenários e exportações.
3. **Ajustes pedidos:**
   - rotação de vagas, caminho do veículo e posição da rampa;
   - posição de escada e hall;
   - frente do empreendimento;
   - recuos desenhados;
   - estudo de vento e entorno com volumes.
4. **Túnel de vento 3D:** "fidedigno e interativo", alternando setas, fumaça e linhas, com cor por velocidade e turbulência. Virou LBM D3Q19 + LES num Web Worker. As setas grossas foram reprovadas e trocadas por linhas finas animadas e setas discretas.
5. **Mais pedidos:**
   - rampa otimizada (sobe no melhor ponto);
   - poder zerar vagas PCD e idoso;
   - vagas na frente para lojas;
   - escada balcão, duto ou pressurizada;
   - sacadas;
   - sliders rápidos;
   - ver cada andar;
   - legenda clara.
6. **Redesenho geral da interface (03–04/10):**
   - trilho de 7 etapas, inspetor à esquerda e palco à direita;
   - régua de KPIs;
   - campos compactos;
   - busca de parâmetros;
   - configurações só do que está ligado.
   - Também nesta rodada:
     - card "Potencial do terreno";
     - "Gerar a melhor viabilidade" (otimizador);
     - núcleo realista (antecâmara, dutos, shafts, hall de serviço, lixo/DML, todos com acesso);
     - fumaça do vento em toda a altura;
     - plano de corte desligado por padrão;
     - prédio no vento 3D com o mesmo render do 3D normal.
7. **Pasta `C:\DEV\Gabarito`** criada para continuar no Claude Code.
8. **Térreo refeito** (o Luiz viu vagas dentro do hall e rampa sem acesso):
   - lojas na frente, passagem de pedestres e faixa de acesso de veículos;
   - hall dimensionado pelo programa e chegando a cada núcleo;
   - garagem no que sobra.
   - O núcleo detalhado passou a aparecer em todos os andares, com hall dos elevadores nas garagens.
   - Nasceu o programa de **áreas comuns e lazer** (térreo, laje do embasamento, pavimento de lazer e rooftop, coberto ou descoberto), que entra no 3D, nas plantas e nos custos.
9. **Motor de garagem reescrito** (o Luiz disse que entrada, rampa e vagas estavam "péssimos"):
   - modelo vertical físico das rampas (retas empilhadas ou alternadas em tesoura; descida e subida em faixas separadas);
   - patamares de 5 m (6,5 m nas alternadas);
   - portais de chegada e saída;
   - malha de 0,5 m verificando se o carro chega à frente de cada vaga e se há manobra;
   - passagens abertas tirando o mínimo de vagas, vagas extras nas sobras e rotas reais;
   - layout por pavimento (`s1..sN`, `ter`, `g1..gN`);
   - "Encontrar o melhor acesso de veículos".
10. **Sol e tema:** o arco do sol no 3D passou a acompanhar data e hora, com "Animar o dia". Tema claro/escuro com botão no topo.
11. **`PLANO.md`** com 19 itens em 5 fases. A execução seguiu no Claude Code (ver o Andamento do `PLANO.md`), e depois veio a Evolução v2 (`docs/EVOLUCAO.md`), baseada na "Colinha de Viabilidade" do Luiz.

## 4. Decisões de projeto que valem manter

- **Visual (identidade Rixel, out/2026):** o Gabarito passou a ser vendido dentro do ecossistema Rixel e segue o design system do backoffice dela (`ecossistemarixel/src/app/backoffice.css`, `docs/backoffice-ui.md`).
  - DM Sans (variável, Google Fonts), números tabulares; títulos com tracking negativo, "sobrancelhas" em caixa alta pequena; sem fonte monoespaçada.
  - Claro por padrão (fundo `#f5f5f7`, cartões brancos com borda fina `#e4e4e9` e sombra discreta, cantos 12 px) e escuro de verdade (`#0c0c0e`/`#151517`).
  - Laranja Rixel `#e8702a` (`--brand`) reservado ao botão primário, ao indicador fino da etapa/item ativo e aos indicadores vivos; seleção e interruptores em grafite neutro (`--sel`); situações em verde/âmbar/vermelho com fundo suave.
  - Marca: ícone Rixel (redesenhado em SVG a partir do `rixel-icon.png`) + "gabarito." com o ponto laranja + "by Rixel"; favicon igual; PDF com faixa grafite, ícone em vetor e o mesmo wordmark (helvetica).
  - Desenho técnico em neutros da Rixel com matizes suaves por função; azul `--d-acc` para pedestres/PCD/seleção e âmbar `--mark` para marcações (frente, rampa); escalas de sol e vento mantidas.
  - Vidro fosco sobre o palco. O teal `#1c6878` e o amarelo de obra saíram da interface.
- **Interface:**
  - trilho de etapas, inspetor e palco;
  - a etapa puxa a vista certa do palco e vice-versa;
  - guia de UX em `docs/UX.md` (resultado no topo, seções fechadas com resumo, "Mais opções", ⓘ com glossário).
- **Recursos novos vêm desligados** quando mudam números. Os 5 estudos de referência só mudam de propósito, com regeneração e anotação.
- **Garagem:**
  - nada de vaga sem rota;
  - nada de rampa sem patamar;
  - descida e subida nunca na mesma projeção;
  - a rampa só começa 5 m depois do alinhamento.
  - Quando não cabe, o sistema avisa e propõe alternativas (rampas retas, desligar a garagem do térreo, mudar acesso ou núcleo), em vez de desenhar algo impossível.
- **Térreo:** hall social sempre ligado aos elevadores de cada torre; carro nunca cruza o hall.
- **Lazer:** coberto fora do térreo soma área construída (não computável se a chave de Regras estiver ligada); descoberto entra no custo por m².
- **Buscas externas** (OSM, relevo, mapas) só funcionam com o app servido por http (`npm run dev`). No artifact do claude.ai elas são bloqueadas; deixar isso claro na interface.

## 5. Onde o projeto está (pela documentação da pasta)

- **PLANO.md:**
  - Fases 0 a 4 feitas;
  - 0.1 parcial: falta trocar globais por `import/export`;
  - 4.1 parcial: falta conectar Supabase.
- **Evolução v2:**
  - Fase A ("Saúde do negócio") feita;
  - Fase B feita: georreferência, relevo pelo AWS Terrarium, ruas → frentes, busca resiliente.
- **Próximas pela ordem do `docs/EVOLUCAO.md`:**
  - **Fase C — construção personalizada por blocos:** C0 (limite da torre vira a planta) → C1 (forma livre com formatos prontos) → C2 (pilha de blocos) → C3 opcional (L/U/H com layout por ala).
  - **Fase D — alavancas e otimização pela eficiência:** card "Alavancas"; `potencial()` com eficiência global; otimizador com eficiência e V/C.
  - **Fase E — calibração com dados reais** (depende do Luiz).

## 6. Pendências e limitações conhecidas

- **Otimizador:**
  - o otimizador, o tornado e o Monte Carlo ainda classificam pela margem sobre a receita, não sobre o VGV;
  - a fronteira de Pareto leva cerca de 20 s (meta: 15 s).
- **Forma (2.4):** `potencial()` e o otimizador usam `hMax` em vez de `m.hLim`; sol e vento usam a planta típica.
- **Garagem:**
  - com núcleos no centro do lote, pode faltar largura para as rampas ao lado da torre;
  - a garagem do térreo rende pouco quando o hall precisa atravessá-la até uma torre dos fundos (há aviso);
  - a contagem rápida (durante arraste) difere um pouco da completa;
  - o acesso de veículos só existe na frente principal.
- **Cômodos:** faltam modelos de 2 suítes, 4 dormitórios e lavabo; portas não recortam paredes no DXF/IFC.
- **Topografia e relevo:** sem página no PDF; falta importar GeoTIFF ANADEM e mostrar o plano no 3D sem ligar a topografia.
- **Normas (2.5):** preliminares; precisam da revisão do Luiz ou de um projetista.
- **Valores ilustrativos ("conferir"):** tabelas de cidades e o CUB.
- **Calibração ainda por fazer:** prêmios de venda, peso da garagem no custo e coeficientes do orçamento.

## 7. Decisões que dependem do Luiz

- Confirmar ou ajustar as metas padrão: margem 25% com piso 20%, TIR alvo 25% a.a., TMA 15%, peso da garagem 0,8.
- V/C principal: contra CUB × fator (recomendado) ou contra o CUB puro.
- Produto completo como app web próprio (Vercel + Supabase), com o artifact como demonstração (recomendado); contas e chaves (Supabase, Vercel, mapa).
- Dados reais:
  - tabela de vendas de um lançamento da região;
  - planilha de viabilidade usada pela empresa;
  - custos de obras recentes;
  - CUB atual;
  - revisão das normas e das regras das cidades.

## 8. Como validar qualquer mudança

- `npm install` (uma vez) e `npx playwright install chromium-headless-shell`.
- `npm run dev` → http://localhost:5173 (necessário para mapa, OSM e relevo).
- `npm test` (Vitest + estudos de referência) e `npm run screens -- all` (capturas desktop e celular, claro e escuro).
- `npm run check` faz build, testes e capturas de uma vez.
- Antes de entregar: abrir as capturas das telas mudadas, conferir os dois temas e o celular, conferir se a solução faz sentido como projeto real e atualizar `CLAUDE.md` e o Andamento do `PLANO.md`.
- Para publicar: gerar o build (`npm run bundle`) e publicar o `index.html` como artifact no mesmo link (https://claude.ai/artifact/4wBW5QrbVhLrqDQgtdFE7G), se o Luiz quiser a versão online atualizada.

## 9. Sugestão de primeira mensagem no Claude Code

> Leia HANDOFF.md, CLAUDE.md, PLANO.md e docs/EVOLUCAO.md. Rode `npm test` e `npm run screens -- all` para confirmar que está tudo verde. Depois me resuma em tópicos onde paramos e proponha começar pela Fase C0 do docs/EVOLUCAO.md.
