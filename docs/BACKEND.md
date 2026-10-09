# Backend do Gabarito — repositório local hoje, Supabase amanhã

Hoje o Gabarito é um arquivo único que roda inteiro no navegador. Os estudos, as versões e a biblioteca de regras passam por uma
**camada de repositório** (`src/ui/repo.js`) com interface assíncrona. A implementação atual usa IndexedDB. A troca por Supabase
(item 4.1 do PLANO) mexe só nessa camada: telas, desfazer/refazer e versões não mudam.

## 1. Interface do repositório (`Repo`)

Todos os métodos devolvem `Promise` e trabalham com objetos JSON simples (o estado `S` é JSON puro).

| método | devolve | observação |
|---|---|---|
| `Repo.pronto()` | `"idb" \| "local" \| "memoria"` | abre o banco; sem IndexedDB cai para `localStorage` (`gabarito.repo`) e, em último caso, memória |
| `Repo.modo()` | idem | modo atual (síncrono) |
| `Repo.novoId()` | `string` | UUID v4 (`crypto.randomUUID`) — o mesmo formato do `uuid` do Postgres |
| `Repo.estudos.list()` | `[{id, nome, k, criado, atualizado, dono}]` | **sem** o estado `S`; mais recente primeiro |
| `Repo.estudos.get(id)` | `{id, nome, S, k, criado, atualizado, dono}` ou `null` | |
| `Repo.estudos.put(estudo)` | estudo gravado | cria `id`/`criado` se faltarem; sempre atualiza `atualizado` |
| `Repo.estudos.remove(id)` | — | apaga também as versões do estudo |
| `Repo.versoes.list(estudoId)` | `[{id, estudoId, nome, auto, autor, criado, k}]` | sem o estado; mais recente primeiro |
| `Repo.versoes.get(id)` / `put(v)` / `remove(id)` | | `put` preenche `id`, `criado`, `autor` (`"Local"`), `auto` |
| `Repo.regras.list({cidade}?)` / `get(id)` / `put(r)` / `remove(id)` | | biblioteca de regras por cidade/zona; `status` = `rascunho` \| `publicada` |

Campos:

- **estudo**: `id`, `nome`, `S` (estado completo do app, o mesmo do `localStorage gabarito.v2`), `k` (números principais do último
  cálculo completo: `units, priv, vagas, vagasReq, ca, h, vgv, custo, lucro, margem, tir, exp` — ver `histNums` em `src/calc/histdiff.js`),
  `dono`, `criado`, `atualizado` (ISO 8601).
- **versão**: `id`, `estudoId`, `nome`, `auto` (automática a cada 5 min ou nomeada), `autor`, `criado`, `S`, `k`.
- **regra**: `id`, `cidade`, `zona`, `params` (o bloco `S.regras`), `lei`, `data`, `status`, `criado`, `atualizado`.

### Como o app usa

- O estudo aberto continua sendo a cópia de trabalho em `localStorage gabarito.v2` (abre na hora, sem esperar o banco, e mantém
  compatibilidade com estudos antigos). O id dele fica em `localStorage gabarito.estudo`.
- Na primeira execução, o `gabarito.v2` vira o primeiro estudo do repositório (o `gabarito.v2` não é apagado).
- `save()` → `histTouch()` (desfazer) → `estTouch()`: o estudo é gravado no repositório 1,5 s depois da última mudança.
- Versões: `versaoSalvar(nome, auto)`, automáticas a cada 5 minutos se o estudo mudou (até 30 automáticas por estudo; as nomeadas
  ficam sempre). Restaurar = padrões atuais (`merge`, para migração) + o estado da versão por cima (`histOverlay`), o que reproduz
  exatamente os números salvos.

## 2. Plano de troca por Supabase

1. **Projeto e esquema**: criar o projeto, aplicar `docs/supabase/schema.sql` (tabelas `estudos`, `versoes`, `cidades_regras`,
   `compartilhamentos`, com RLS). Nada disso foi executado ainda.
2. **Login**: Supabase Auth (e-mail com link mágico + Google). `dono`/`autor` passam a ser o `auth.uid()`.
3. **Nova implementação de `Repo`** (`src/ui/repo-supabase.js`), mesma interface:
   - `estudos.list()` → `select id,nome,k,criado,atualizado,dono from estudos order by atualizado desc` (o RLS já filtra o que o usuário pode ver);
   - `estudos.get(id)` → `select * … where id = $1`;
   - `estudos.put(e)` → `upsert` com `rev = rev + 1` (controle de conflito, ver passo 5);
   - `estudos.remove(id)` → `delete` (as versões caem em cascata);
   - `versoes.*` e `regras.*` análogos (`regras` → tabela `cidades_regras`).
   - Escolha da implementação no início: com sessão do Supabase → `RepoSupabase`; sem login (artifact/demonstração) → o IndexedDB atual.
4. **Funciona sem internet** ("grava local primeiro"): a implementação Supabase envolve a de IndexedDB. Toda gravação vai primeiro
   para o IndexedDB com `pendente: true` e entra numa fila; um sincronizador envia a fila quando há rede (`navigator.onLine`,
   evento `online`) e baixa o que mudou na nuvem desde a última sincronização (`atualizado > ultimaSync`).
5. **Conflitos**: cada estudo tem `rev` (inteiro). O `upsert` só passa se `rev` no banco = `rev` local (RPC `gravar_estudo` com
   `where rev = $rev_esperado`). Se outro aparelho gravou antes, vale a última gravação (a nossa), mas a versão do outro aparelho é
   guardada antes como versão automática "Conflito — <aparelho>" e o usuário recebe um aviso. Nada se perde.
6. **Versões**: as automáticas continuam a cada 5 min; na nuvem, guardar só as últimas 30 automáticas por estudo (trigger ou job).
   Para reduzir tráfego, `S` pode ir comprimido (gzip + base64) num campo `estado_gz` quando passar de ~200 kB.
7. **Compartilhamento**: tabela `compartilhamentos (estudo_id, usuario_id, papel)` com papéis `leitor` e `editor`; o RLS de
   `estudos` e `versoes` libera leitura para leitores e escrita para editores. Link público de leitura opcional (`publico = true`).
   - **Metas da empresa** (Fase A, `S.metas` + `S.fin.tma/margemAlvo`): hoje o "padrão da empresa" é `localStorage "gabarito.metas.padrao"` (`saudePadraoEmpresa()` / `saudeSalvarPadrao()` em `src/calc/saude.js`). Com o Supabase, trocar essas duas funções por leitura/gravação de uma linha por empresa (ex.: tabela `metas_empresa (empresa_id, metas jsonb, tma, margem_alvo)` ou o `Repo.regras` com `cidade = '*'`); a interface (`src/ui/saude.js`) não muda.
8. **Biblioteca de regras**: a leitura do plano diretor com IA (`ai.js`) grava em `cidades_regras` com `status = 'rascunho'` e
   `autor = auth.uid()`. Só revisores (`perfis.revisor = true`) mudam para `publicada`; publicadas são legíveis por todos.
   Regras de Criciúma e Florianópolis entram como seed publicada.
9. **Realtime (depois)**: assinar mudanças do estudo aberto para avisar "este estudo foi alterado em outro aparelho".
10. **Testes**: os testes atuais de histórico e versões (`tests/plataforma.test.js`) continuam valendo; acrescentar testes da
    fila offline com um `Repo` falso.

## 3. Web Worker e nuvem

O cálculo continua no navegador (Web Worker, `src/ui/calcworker.js`); a nuvem guarda só estado e números. Os números `k` de cada
estudo/versão permitem listar e comparar estudos sem recalcular.
