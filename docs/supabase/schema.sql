-- Gabarito — esquema proposto para o Supabase (item 4.1 do PLANO). NÃO EXECUTADO.
-- Espelha a interface de src/ui/repo.js: estudos, versoes, cidades_regras (Repo.regras) e compartilhamentos.
-- Todas as tabelas com RLS: cada usuário vê o que é dele ou o que foi compartilhado com ele; regras publicadas são de todos.

create extension if not exists "pgcrypto";

-- perfis (complementa auth.users): nome exibido e quem pode publicar regras
create table if not exists public.perfis (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null default '',
  revisor     boolean not null default false,
  criado      timestamptz not null default now()
);

-- estudos: o estado atual de cada estudo (S = JSON completo do app) + números principais para listar/comparar
create table if not exists public.estudos (
  id          uuid primary key default gen_random_uuid(),
  dono        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome        text not null default 'Estudo',
  estado      jsonb not null,                 -- S
  k           jsonb,                          -- {units, priv, vagas, vagasReq, ca, h, vgv, custo, lucro, margem, tir, exp}
  rev         integer not null default 1,     -- controle de conflito (última gravação vence, com aviso)
  publico     boolean not null default false, -- link público somente leitura
  criado      timestamptz not null default now(),
  atualizado  timestamptz not null default now()
);
create index if not exists estudos_dono_atualizado on public.estudos (dono, atualizado desc);

-- versões (item 0.4): automáticas a cada 5 min com mudança e nomeadas pelo usuário
create table if not exists public.versoes (
  id          uuid primary key default gen_random_uuid(),
  estudo_id   uuid not null references public.estudos(id) on delete cascade,
  autor       uuid not null default auth.uid() references auth.users(id),
  nome        text not null,
  auto        boolean not null default false,
  estado      jsonb not null,                 -- S naquele momento (restaurar reproduz os números)
  k           jsonb,
  criado      timestamptz not null default now()
);
create index if not exists versoes_estudo_criado on public.versoes (estudo_id, criado desc);

-- biblioteca de regras por cidade/zona (leitura do plano diretor com IA + revisão humana)
create table if not exists public.cidades_regras (
  id          uuid primary key default gen_random_uuid(),
  cidade      text not null,
  uf          char(2),
  zona        text not null,
  params      jsonb not null,                 -- o bloco S.regras (CA, TO, recuos, gabarito…)
  lei         text,                           -- lei / plano diretor de origem
  data_lei    date,
  fonte       text,                           -- link ou arquivo
  status      text not null default 'rascunho' check (status in ('rascunho','publicada','arquivada')),
  autor       uuid not null default auth.uid() references auth.users(id),
  revisor     uuid references auth.users(id),
  criado      timestamptz not null default now(),
  atualizado  timestamptz not null default now(),
  unique (cidade, zona, data_lei, status)
);
create index if not exists cidades_regras_cidade on public.cidades_regras (cidade, zona);

-- compartilhamentos de estudos
create table if not exists public.compartilhamentos (
  estudo_id   uuid not null references public.estudos(id) on delete cascade,
  usuario_id  uuid not null references auth.users(id) on delete cascade,
  papel       text not null default 'leitor' check (papel in ('leitor','editor')),
  criado      timestamptz not null default now(),
  primary key (estudo_id, usuario_id)
);
create index if not exists compartilhamentos_usuario on public.compartilhamentos (usuario_id);

-- atualizado / rev automáticos
create or replace function public.toca_atualizado() returns trigger language plpgsql as $$
begin new.atualizado := now(); if tg_table_name = 'estudos' and tg_op = 'UPDATE' then new.rev := old.rev + 1; end if; return new; end $$;
drop trigger if exists estudos_toca on public.estudos;
create trigger estudos_toca before update on public.estudos for each row execute function public.toca_atualizado();
drop trigger if exists regras_toca on public.cidades_regras;
create trigger regras_toca before update on public.cidades_regras for each row execute function public.toca_atualizado();

-- gravação com controle de conflito: só grava se a revisão esperada bater; devolve a linha atual se não bater
create or replace function public.gravar_estudo(p_id uuid, p_rev integer, p_nome text, p_estado jsonb, p_k jsonb)
returns public.estudos language plpgsql security invoker as $$
declare r public.estudos;
begin
  update public.estudos set nome = p_nome, estado = p_estado, k = p_k where id = p_id and rev = p_rev returning * into r;
  if r.id is null then select * into r from public.estudos where id = p_id; end if;  -- conflito: o cliente compara rev e avisa
  return r;
end $$;

-- funções de acesso usadas pelas políticas (security definer para não recursar no RLS)
create or replace function public.pode_ler_estudo(e uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from estudos where id = e and (dono = auth.uid() or publico))
      or exists (select 1 from compartilhamentos where estudo_id = e and usuario_id = auth.uid());
$$;
create or replace function public.pode_editar_estudo(e uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from estudos where id = e and dono = auth.uid())
      or exists (select 1 from compartilhamentos where estudo_id = e and usuario_id = auth.uid() and papel = 'editor');
$$;
create or replace function public.eh_revisor() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select revisor from perfis where id = auth.uid()), false);
$$;

-- ===== RLS =====
alter table public.perfis            enable row level security;
alter table public.estudos           enable row level security;
alter table public.versoes           enable row level security;
alter table public.cidades_regras    enable row level security;
alter table public.compartilhamentos enable row level security;

-- perfis: cada um lê e edita o próprio (revisor só muda pelo painel/SQL do administrador)
create policy perfis_ler    on public.perfis for select using (id = auth.uid());
create policy perfis_criar  on public.perfis for insert with check (id = auth.uid() and revisor = false);
create policy perfis_editar on public.perfis for update using (id = auth.uid()) with check (id = auth.uid() and revisor = (select revisor from public.perfis where id = auth.uid()));

-- estudos
create policy estudos_ler     on public.estudos for select using (public.pode_ler_estudo(id));
create policy estudos_criar   on public.estudos for insert with check (dono = auth.uid());
create policy estudos_editar  on public.estudos for update using (public.pode_editar_estudo(id)) with check (public.pode_editar_estudo(id));
create policy estudos_apagar  on public.estudos for delete using (dono = auth.uid());

-- versões: herdam o acesso do estudo
create policy versoes_ler     on public.versoes for select using (public.pode_ler_estudo(estudo_id));
create policy versoes_criar   on public.versoes for insert with check (public.pode_editar_estudo(estudo_id) and autor = auth.uid());
create policy versoes_apagar  on public.versoes for delete using (public.pode_editar_estudo(estudo_id));

-- regras: publicadas são de todos (inclusive anônimos); rascunhos só do autor e dos revisores; publicar só revisor
create policy regras_ler      on public.cidades_regras for select using (status = 'publicada' or autor = auth.uid() or public.eh_revisor());
create policy regras_criar    on public.cidades_regras for insert with check (autor = auth.uid() and (status = 'rascunho' or public.eh_revisor()));
create policy regras_editar   on public.cidades_regras for update using (autor = auth.uid() or public.eh_revisor())
                                                         with check (status = 'rascunho' or public.eh_revisor());
create policy regras_apagar   on public.cidades_regras for delete using ((autor = auth.uid() and status = 'rascunho') or public.eh_revisor());

-- compartilhamentos: o dono do estudo gerencia; o convidado vê os seus
create policy comp_ler        on public.compartilhamentos for select using (usuario_id = auth.uid() or exists (select 1 from public.estudos e where e.id = estudo_id and e.dono = auth.uid()));
create policy comp_criar      on public.compartilhamentos for insert with check (exists (select 1 from public.estudos e where e.id = estudo_id and e.dono = auth.uid()));
create policy comp_editar     on public.compartilhamentos for update using (exists (select 1 from public.estudos e where e.id = estudo_id and e.dono = auth.uid()));
create policy comp_apagar     on public.compartilhamentos for delete using (usuario_id = auth.uid() or exists (select 1 from public.estudos e where e.id = estudo_id and e.dono = auth.uid()));

-- limpeza: no máximo 30 versões automáticas por estudo
create or replace function public.poda_versoes_auto() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.auto then
    delete from versoes where id in (select id from versoes where estudo_id = new.estudo_id and auto order by criado desc offset 30);
  end if;
  return new;
end $$;
drop trigger if exists versoes_poda on public.versoes;
create trigger versoes_poda after insert on public.versoes for each row execute function public.poda_versoes_auto();
