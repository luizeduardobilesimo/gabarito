# Publicar o app web — gabarito.rixel.com.br

O Gabarito continua sendo o mesmo arquivo único gerado de `src/`. Na Vercel ele ganha:

- **login pela Rixel** — quem decide se a pessoa pode usar é a Rixel (plano, ferramenta avulsa, organização);
- **API** em `api/*.js` (funções Node da Vercel);
- **banco** no projeto Supabase do Gabarito, acessado SÓ pelo servidor.

O artifact do claude.ai e o `npm run dev` continuam abrindo sem login, com os estudos no navegador (nada disso é obrigatório
para o app abrir). O login só liga nos hosts `*.rixel.com.br` e `*.vercel.app` (ou `localhost` com `?nuvem=1`).

## Como funciona (resumo)

1. A pessoa abre `https://gabarito.rixel.com.br/` (ou clica no Gabarito dentro da Rixel). Sem sessão, o app vai sozinho para
   `/api/rixel/iniciar`.
2. `/api/rixel/iniciar` gera o *verifier* do PKCE (guardado num cookie HttpOnly de 5 min, junto com um `state`) e manda o
   *challenge* (43 caracteres) para a página de lançamento da Rixel (`RIXEL_LAUNCH_URL`).
3. A Rixel (membro logado) chama `issue_tool_code` e volta para `https://gabarito.rixel.com.br/api/rixel/callback?code=…`.
4. O callback troca o código (`exchange_tool_code`, anon, uso único, 60 s), confere `aud` e `tool_id`, cria a **sessão do
   Gabarito** (cookie `gab_sessao`: id opaco de 256 bits; no banco só o hash) e volta para `/`.
5. Cada chamada à API resolve a sessão e, a cada 60 s, reconfere na Rixel (`product_access_status`; se inativo,
   `refresh_product_session`, que gira o hash do refresh). Sem direito = 401, cookie apagado, tela "Sem acesso".
6. "Sair" chama `revoke_product_session` e apaga a sessão.

Login direto por e-mail e senha (caminho B) existe, mas fica **desligado** (`GABARITO_LOGIN_DIRETO=1` liga; o acesso é
conferido com `tool_contract`).

## 1. Banco do Gabarito (Supabase `cjeyxafuajbvuxrbufkq`)

1. Abra o projeto do **Gabarito** › SQL Editor › cole todo o `docs/supabase/migrations/0001_inicial.sql` › Run.
2. Confira: `select tablename, rowsecurity from pg_tables where schemaname = 'public';` — 6 tabelas, todas `true`
   (`estudos`, `versoes`, `cidades_regras`, `perfis`, `compartilhamentos`, `sessoes`). Nenhuma política: só a chave secreta acessa.
3. (Opcional) Cron diário: `select public.limpa_sessoes();` (Database › Cron).
4. Project Settings › API Keys › copie a **secret key** (`sb_secret_…`). Ela vai SÓ na Vercel.

## 2. Cadastro do Gabarito na Rixel (painel da Rixel)

**Estado em 13/10/2026 (confirmado pela Rixel):** a ferramenta já existe — id `8e7150bc-bade-4cbb-8efe-47606a299af2`
(padrão no código), slug `gabarito`, kind `web`, `access_requirement = license` (avulsa: o Plano 4 e o Empresarial incluem
automaticamente; o rank 3 não inclui avulsas; o Plano 2 só com associação em `plan_tools`; grants específicos liberam
qualquer conta), audience `gabarito`, callback `https://gabarito.rixel.com.br/api/rixel/callback`, destination
`https://gabarito.rixel.com.br/`, release `1.0.0`, **publicada**, homologação registrada (contrato v3), **`ready = false`**.
A página de lançamento existe: `https://www.rixel.com.br/ferramentas/gabarito/abrir?challenge=…&state=…&redirect_uri=…`
(padrão no código). Sem sessão a Rixel manda para `/entrar` e volta; recusas voltam ao callback com
`?error=access_denied|integration_pending|too_many_requests|temporarily_unavailable|invalid_redirect_uri|invalid_request`
(o Gabarito mostra uma mensagem própria), ou ficam numa página de erro da Rixel quando o RLS esconde a ferramenta.
A sessão de produto dura **30 dias fixos** (o refresh não estende); o Gabarito reconfere com `product_access_status` a cada
60 s e encerra quando ele vier inativo. Máximo de 10 códigos pendentes por usuário na Rixel.

1. **Deixe a ferramenta publicada** (não volte para rascunho: a Rixel só lança ferramentas publicadas) e com `ready = false`
   até o teste — enquanto isso, a entrada volta com "O Gabarito ainda está sendo liberado".
2. **Planos**: o Plano 4 e o Empresarial já incluem. Para o Plano 2, associe em `plan_tools`; para alguém específico, um grant.
3. **Teste e homologação**: com o app publicado (seção 3), ligar `ready = true`, entrar com uma conta do Plano 4 e outra sem
   acesso, e registrar uma nota de homologação real em `verify_tool_integration` (MFA recente, ≥ 20 caracteres) — modelo:
   "Callback e state conferidos; PKCE S256 com verifier de 64; audience gabarito e tool_id conferidos; código de uso único
   (replay recusado); access_denied mostra sem acesso; revogação derruba a sessão em até 60 s; Sair revoga; logs sem código."
4. Os logs de requisição da Vercel podem registrar o `?code=` do callback: ele é de uso único, vale 60 s e não serve sem o
   verifier (cookie HttpOnly do navegador que iniciou), então o risco é baixo; as funções do Gabarito não registram códigos.
6. (Só se ligar o login direto) Auth da Rixel › URL Configuration › Redirect URLs: incluir `https://gabarito.rixel.com.br/**`
   (para o link de "Esqueci a senha").

## 3. Vercel

Projeto já ligado ao GitHub (cada push no `main` publica). O `vercel.json` define: `npm run build` → `dist/` (documento
completo, `--web`), funções em `api/`, cabeçalhos de segurança e CSP com as CDNs e serviços que o app usa.

**Variáveis de ambiente** (Settings › Environment Variables; Production e Preview):

| variável | obrigatória | valor |
|---|---|---|
| `GABARITO_SUPABASE_SECRET_KEY` | sim | a secret key do Supabase do Gabarito (`sb_secret_…`) — segredo |
| `GABARITO_TOOL_ID` | não | padrão `8e7150bc-bade-4cbb-8efe-47606a299af2` (a ferramenta na Rixel). Vazio desliga a entrada |
| `RIXEL_LAUNCH_URL` | não | padrão `https://www.rixel.com.br/ferramentas/gabarito/abrir?challenge={challenge}&state={state}&redirect_uri={redirect}` |
| `GABARITO_AUDIENCE` | não | padrão `gabarito` (tem de ser igual ao cadastrado na Rixel) |
| `APP_URL` | não | padrão `https://gabarito.rixel.com.br` (usado no callback e no destino) |
| `GABARITO_SESSAO_DIAS` | não | duração da sessão do Gabarito, padrão 30 |
| `GABARITO_VERIFICA_SEG` | não | intervalo da reconferência na Rixel, padrão 60 |
| `GABARITO_LOGIN_DIRETO` | não | `1` liga o formulário de e-mail e senha (caminho B). Padrão: desligado |
| `GABARITO_ACESSO_ABERTO` | **nunca em produção** | `1` libera qualquer usuário autenticado no login direto, sem perguntar à Rixel (só testes locais/preview) |
| `GABARITO_SUPABASE_URL`, `RIXEL_SUPABASE_URL`, `RIXEL_SUPABASE_PUBLISHABLE_KEY` | não | já têm os valores certos no código (são públicos) |

**Domínio**: Settings › Domains › adicionar `gabarito.rixel.com.br`. No DNS de `rixel.com.br`, criar
`CNAME gabarito → cname.vercel-dns.com` (o valor exato aparece na tela da Vercel). Aguarde o certificado.

Conferir depois do deploy: `https://gabarito.rixel.com.br/api/saude` → `{"ok":true, "config":{"banco":true,"lancamento":true,…}}`.

## 4. Passo a passo resumido (Luiz)

1. Rodar a migração no Supabase do Gabarito e copiar a secret key.
2. Na Vercel: só `GABARITO_SUPABASE_SECRET_KEY`; domínio `gabarito.rixel.com.br` + CNAME no DNS da Rixel.
3. Redeploy e abrir `https://gabarito.rixel.com.br/api/saude`.
4. Na Rixel: `ready = true`; entrar com uma conta do Plano 4 e outra sem acesso; registrar a homologação com a nota real.

## Testar localmente com a API

`npm run dev` serve só o app (sem API, sem login). Para a API: `npx vercel dev` (pede login na Vercel; use um `.env.local`
com as variáveis acima — o `.gitignore` já ignora) e abra `http://localhost:3000/?nuvem=1`. O cookie da sessão é `Secure`:
use o fluxo completo só em HTTPS (preview da Vercel). Para testar sem a Rixel: `GABARITO_LOGIN_DIRETO=1` +
`GABARITO_ACESSO_ABERTO=1` (nunca em produção).
