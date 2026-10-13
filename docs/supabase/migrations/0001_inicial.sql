-- 0001_inicial — banco do Gabarito (projeto cjeyxafuajbvuxrbufkq). Cole TUDO no SQL Editor do Supabase DO GABARITO e rode uma vez.
-- Idempotente (if not exists / or replace): rodar de novo não estraga nada. NÃO rode no projeto da Rixel.
-- Conferência depois:  select tablename, rowsecurity from pg_tables where schemaname = 'public';   (todas com rowsecurity = true)
--
-- Desenho (docs/BACKEND.md):
--  * A identidade vem do projeto Supabase da RIXEL. O navegador NÃO fala com este banco: só as funções da Vercel (api/*.js),
--    com a chave secreta (GABARITO_SUPABASE_SECRET_KEY), depois de conferir a sessão do usuário.
--  * Todas as tabelas com RLS LIGADO e SEM nenhuma política: anon/authenticated não leem nem gravam nada (a chave secreta
--    ignora o RLS). Além disso, os privilégios de anon/authenticated são revogados.
--  * O dono de cada registro é o `sub` do usuário da RIXEL (uuid), sem FK para auth.users deste projeto.
--  * Sem limites por plano aqui: quem decide o acesso é a Rixel (o plano não vem nas claims).

create extension if not exists "pgcrypto";

-- perfis: quem pode publicar regras (revisor). id = sub da Rixel.
create table if not exists public.perfis (
  id          uuid primary key,
  nome        text not null default '',
  revisor     boolean not null default false,
  criado      timestamptz not null default now()
);

-- estudos: o estado atual de cada estudo (S = JSON completo do app) + números principais para listar/comparar
create table if not exists public.estudos (
  id          uuid primary key default gen_random_uuid(),
  dono        uuid not null,                  -- sub do usuário na Rixel
  nome        text not null default 'Estudo',
  estado      jsonb not null,                 -- S
  k           jsonb,                          -- {units, priv, vagas, vagasReq, ca, h, vgv, custo, lucro, margem, tir, exp}
  rev         integer not null default 1,     -- controle de conflito: a API só grava se rev = o que o cliente conhece
  publico     boolean not null default false, -- (futuro) link público somente leitura
  criado      timestamptz not null default now(),
  atualizado  timestamptz not null default now()
);
create index if not exists estudos_dono_atualizado on public.estudos (dono, atualizado desc);

-- versões: automáticas (a cada 5 min com mudança; no máximo 30 por estudo) e nomeadas
create table if not exists public.versoes (
  id          uuid primary key default gen_random_uuid(),
  estudo_id   uuid not null references public.estudos(id) on delete cascade,
  dono        uuid not null,                  -- = dono do estudo (filtro direto, sem join)
  autor       text not null default '',       -- nome exibido de quem salvou
  nome        text not null,
  auto        boolean not null default false,
  estado      jsonb not null,
  k           jsonb,
  criado      timestamptz not null default now()
);
create index if not exists versoes_estudo_criado on public.versoes (estudo_id, criado desc);
create index if not exists versoes_dono on public.versoes (dono);

-- biblioteca de regras por cidade/zona (leitura do plano diretor com IA + revisão humana)
create table if not exists public.cidades_regras (
  id          uuid primary key default gen_random_uuid(),
  cidade      text not null,
  uf          char(2),
  zona        text not null default '',
  params      jsonb not null,                 -- o bloco S.regras (CA, TO, recuos, gabarito…)
  lei         text not null default '',
  data_lei    text not null default '',       -- como veio (nem sempre é uma data completa)
  fonte       text,
  status      text not null default 'rascunho' check (status in ('rascunho','publicada','arquivada')),
  autor       uuid not null,                  -- sub da Rixel
  revisor     uuid,
  criado      timestamptz not null default now(),
  atualizado  timestamptz not null default now()
);
create index if not exists cidades_regras_cidade on public.cidades_regras (cidade, zona);
create index if not exists cidades_regras_status_autor on public.cidades_regras (status, autor);

-- (futuro) compartilhamento de estudos entre membros
create table if not exists public.compartilhamentos (
  estudo_id   uuid not null references public.estudos(id) on delete cascade,
  usuario_id  uuid not null,                  -- sub da Rixel
  papel       text not null default 'leitor' check (papel in ('leitor','editor')),
  criado      timestamptz not null default now(),
  primary key (estudo_id, usuario_id)
);
create index if not exists compartilhamentos_usuario on public.compartilhamentos (usuario_id);

-- sessões do Gabarito (lançamento pela Rixel). O cookie leva um id opaco aleatório; aqui fica só o HASH dele.
-- refresh_hash = hash ATUAL do refresh da sessão de produto da Rixel (o token cru nunca é guardado).
create table if not exists public.sessoes (
  id_hash             text primary key,       -- sha256 hex do id do cookie
  sub                 uuid not null,
  jti                 text not null,
  aud                 text not null,
  refresh_hash        text not null,
  criada              timestamptz not null default now(),
  ultima_verificacao  timestamptz not null default now(),
  expira              timestamptz not null
);
create index if not exists sessoes_sub on public.sessoes (sub);
create index if not exists sessoes_expira on public.sessoes (expira);

-- atualizado automático
create or replace function public.toca_atualizado() returns trigger language plpgsql set search_path = public as $$
begin new.atualizado := now(); return new; end $$;
drop trigger if exists estudos_toca on public.estudos;
create trigger estudos_toca before update on public.estudos for each row execute function public.toca_atualizado();
drop trigger if exists regras_toca on public.cidades_regras;
create trigger regras_toca before update on public.cidades_regras for each row execute function public.toca_atualizado();

-- no máximo 30 versões automáticas por estudo
create or replace function public.poda_versoes_auto() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.auto then
    delete from versoes where id in (select id from versoes where estudo_id = new.estudo_id and auto order by criado desc offset 30);
  end if;
  return new;
end $$;
drop trigger if exists versoes_poda on public.versoes;
create trigger versoes_poda after insert on public.versoes for each row execute function public.poda_versoes_auto();

-- limpeza de sessões vencidas (chame de um cron do Supabase, ex.: diário): select public.limpa_sessoes();
create or replace function public.limpa_sessoes() returns integer language sql security definer set search_path = public as $$
  with x as (delete from sessoes where expira < now() returning 1) select count(*)::int from x;
$$;

-- ===== RLS ligado, sem políticas (só a chave secreta do servidor acessa) =====
alter table public.perfis            enable row level security;
alter table public.estudos           enable row level security;
alter table public.versoes           enable row level security;
alter table public.cidades_regras    enable row level security;
alter table public.compartilhamentos enable row level security;
alter table public.sessoes           enable row level security;

revoke all on public.perfis, public.estudos, public.versoes, public.cidades_regras, public.compartilhamentos, public.sessoes from anon, authenticated;
revoke execute on function public.limpa_sessoes() from public, anon, authenticated;
revoke execute on function public.poda_versoes_auto() from public, anon, authenticated;
revoke execute on function public.toca_atualizado() from public, anon, authenticated;
