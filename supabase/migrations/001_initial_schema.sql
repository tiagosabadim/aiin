-- ============================================================
--  PostAI · Schema inicial · Supabase PostgreSQL
-- ============================================================

-- Extensões necessárias
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
--  TABELA: brands
--  Design system e contexto de cada marca/cliente
-- ============================================================
create table brands (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  name          text not null,
  segment       text,
  description   text,                        -- contexto para a IA
  tone_of_voice text,
  color_palette jsonb default '[]',          -- [{name, hex, role}]
  typography    jsonb default '{}',          -- {title, body, label}
  slogans       jsonb default '[]',          -- [{text, active}]
  icons         jsonb default '[]',          -- nomes dos ícones selecionados
  logo_urls     jsonb default '{}',          -- {primary, light, dark}
  ai_context    text,                        -- contexto condensado pela IA (atualizado semanalmente)
  ai_context_pct integer default 0,          -- 0-100, % de completude do contexto
  instagram_account_id  text,
  instagram_access_token text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ============================================================
--  TABELA: assets
--  Acervo de imagens de cada marca
-- ============================================================
create table assets (
  id            uuid primary key default uuid_generate_v4(),
  brand_id      uuid references brands(id) on delete cascade not null,
  user_id       uuid references auth.users(id) on delete cascade not null,
  name          text not null,
  storage_path  text not null,              -- caminho no Supabase Storage
  public_url    text,                       -- URL pública gerada
  category      text check (category in ('pessoa','produto','empresa','campanha')) not null,
  tags          text[] default '{}',        -- tags geradas pela IA
  ai_analyzed   boolean default false,
  performance_score numeric(3,1) default 0, -- 0.0-10.0
  times_used    integer default 0,
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ============================================================
--  TABELA: briefings
--  Briefings enviados para geração de posts
-- ============================================================
create table briefings (
  id            uuid primary key default uuid_generate_v4(),
  brand_id      uuid references brands(id) on delete cascade not null,
  user_id       uuid references auth.users(id) on delete cascade not null,
  name          text not null,
  description   text,
  objective     text,
  target_audience text,
  tone          text,
  post_count    integer default 4,
  hashtags      text[] default '{}',
  asset_ids     uuid[] default '{}',        -- imagens selecionadas do acervo
  extra_context text,                       -- instruções extras para a IA
  status        text default 'draft' check (status in ('draft','processing','done','error')),
  n8n_execution_id text,                    -- ID da execução no n8n
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ============================================================
--  TABELA: posts
--  Posts gerados e seu ciclo de vida completo
-- ============================================================
create table posts (
  id              uuid primary key default uuid_generate_v4(),
  briefing_id     uuid references briefings(id) on delete cascade not null,
  brand_id        uuid references brands(id) on delete cascade not null,
  user_id         uuid references auth.users(id) on delete cascade not null,
  caption         text,                         -- legenda gerada pela IA
  image_prompt    text,                         -- prompt usado no DALL-E
  image_url       text,                         -- imagem gerada (URL pública)
  image_storage_path text,                      -- caminho no Storage
  asset_ids_used  uuid[] default '{}',          -- imagens do acervo usadas
  format          text default 'foto' check (format in ('foto','carrossel','reels','stories')),
  status          text default 'pending_approval' check (
                    status in ('pending_approval','approved','rejected','scheduled','published','failed')
                  ),
  scheduled_at    timestamptz,                  -- horário de publicação
  published_at    timestamptz,
  instagram_post_id text,                       -- ID retornado pela Meta API
  ai_score        numeric(3,1),                 -- score estimado pela IA antes de publicar
  rejection_reason text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
--  TABELA: insights
--  Métricas coletadas pela Meta API após publicação
-- ============================================================
create table insights (
  id              uuid primary key default uuid_generate_v4(),
  post_id         uuid references posts(id) on delete cascade not null,
  brand_id        uuid references brands(id) on delete cascade not null,
  collected_at    timestamptz default now(),
  reach           integer default 0,
  impressions     integer default 0,
  likes           integer default 0,
  comments        integer default 0,
  saves           integer default 0,
  shares          integer default 0,
  profile_visits  integer default 0,
  engagement_rate numeric(5,2),              -- calculado: (likes+comments+saves)/reach*100
  follows_from_post integer default 0,
  raw_meta_data   jsonb default '{}'          -- resposta bruta da Meta API
);

-- ============================================================
--  TABELA: ai_learnings
--  Padrões identificados pela IA por marca (atualizado semanalmente)
-- ============================================================
create table ai_learnings (
  id              uuid primary key default uuid_generate_v4(),
  brand_id        uuid references brands(id) on delete cascade not null,
  generated_at    timestamptz default now(),
  best_days       text[],                    -- ['wednesday','thursday']
  best_hours      int4range,                 -- ex: [18,20)
  best_format     text,
  best_tone       text,
  best_hashtag_type text,
  top_patterns    jsonb default '[]',        -- [{pattern, impact, confidence}]
  patterns_to_avoid jsonb default '[]',
  summary         text,                      -- resumo em linguagem natural
  posts_analyzed  integer default 0,
  avg_engagement  numeric(5,2)
);

-- ============================================================
--  INDEXES para performance
-- ============================================================
create index on assets(brand_id, category);
create index on assets(brand_id, performance_score desc);
create index on posts(brand_id, status);
create index on posts(scheduled_at) where status = 'scheduled';
create index on posts(published_at) where status = 'published';
create index on insights(brand_id, collected_at desc);
create index on briefings(brand_id, status);

-- ============================================================
--  ROW LEVEL SECURITY (RLS)
--  Cada usuário acessa apenas seus próprios dados
-- ============================================================
alter table brands      enable row level security;
alter table assets      enable row level security;
alter table briefings   enable row level security;
alter table posts       enable row level security;
alter table insights    enable row level security;
alter table ai_learnings enable row level security;

-- Políticas: usuário só vê/altera seus próprios registros
create policy "brands: own data"       on brands       for all using (auth.uid() = user_id);
create policy "assets: own data"       on assets       for all using (auth.uid() = user_id);
create policy "briefings: own data"    on briefings    for all using (auth.uid() = user_id);
create policy "posts: own data"        on posts        for all using (auth.uid() = user_id);
create policy "insights: own data"     on insights     for all using (
  exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid())
);
create policy "ai_learnings: own data" on ai_learnings for all using (
  exists (select 1 from brands b where b.id = brand_id and b.user_id = auth.uid())
);

-- ============================================================
--  TRIGGER: atualiza updated_at automaticamente
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_brands_updated_at    before update on brands    for each row execute function update_updated_at();
create trigger trg_assets_updated_at    before update on assets    for each row execute function update_updated_at();
create trigger trg_briefings_updated_at before update on briefings for each row execute function update_updated_at();
create trigger trg_posts_updated_at     before update on posts     for each row execute function update_updated_at();

-- ============================================================
--  VIEW útil: posts com métricas mais recentes
-- ============================================================
create or replace view posts_with_insights as
select
  p.*,
  i.reach,
  i.impressions,
  i.likes,
  i.comments,
  i.saves,
  i.engagement_rate,
  i.collected_at as insights_at
from posts p
left join lateral (
  select * from insights
  where post_id = p.id
  order by collected_at desc
  limit 1
) i on true;
