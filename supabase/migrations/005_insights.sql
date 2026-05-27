-- ============================================================
--  aiin · Migration 005 — Insights reais
-- ============================================================

-- Tabela de insights por post
create table if not exists post_insights (
  id                uuid primary key default uuid_generate_v4(),
  workspace_id      uuid references workspaces(id) on delete cascade not null,
  brand_id          uuid references brand_profiles(id) on delete cascade,
  output_id         uuid references creative_outputs(id) on delete cascade,
  instagram_post_id text not null,
  impressions       integer default 0,
  reach             integer default 0,
  likes             integer default 0,
  comments          integer default 0,
  saved             integer default 0,
  shares            integer default 0,
  engagement_rate   numeric(5,2) default 0,
  synced_at         timestamptz default now(),
  created_at        timestamptz default now(),
  unique (output_id)
);

-- Tabela de métricas agregadas por período
create table if not exists brand_metrics (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid references workspaces(id) on delete cascade not null,
  brand_id        uuid references brand_profiles(id) on delete cascade,
  period_start    date not null,
  period_end      date not null,
  total_posts     integer default 0,
  avg_reach       integer default 0,
  avg_engagement  numeric(5,2) default 0,
  total_likes     integer default 0,
  total_comments  integer default 0,
  total_saved     integer default 0,
  best_format     text,
  best_day        text,
  best_hour       integer,
  ai_summary      text,
  created_at      timestamptz default now()
);

-- Indexes
create index if not exists idx_post_insights_workspace on post_insights(workspace_id);
create index if not exists idx_post_insights_brand on post_insights(brand_id);
create index if not exists idx_brand_metrics_workspace on brand_metrics(workspace_id);

-- RLS off para testes
alter table post_insights disable row level security;
alter table brand_metrics  disable row level security;
