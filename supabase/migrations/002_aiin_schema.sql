-- ============================================================
--  aiin · Schema completo v2
--  Roda no Supabase SQL Editor
--  ATENÇÃO: rode o 001 primeiro se ainda não rodou
-- ============================================================

-- Extensões
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
--  PLANS
-- ============================================================
create table if not exists plans (
  id                  uuid primary key default uuid_generate_v4(),
  name                text not null,
  monthly_price       numeric(10,2) not null,
  monthly_credits     integer not null,
  suggested_frequency text,
  max_workspaces      integer default 1,
  max_users           integer default 1,
  has_whatsapp        boolean default false,
  has_calendar        boolean default false,
  priority_level      integer default 1,
  active              boolean default true,
  created_at          timestamptz default now()
);

-- Seeds dos planos
insert into plans (name, monthly_price, monthly_credits, suggested_frequency, max_workspaces, max_users, has_whatsapp, has_calendar, priority_level) values
  ('Presença',   197,  30,  '3 posts por semana',       1, 1, false, false, 1),
  ('Movimento',  297,  50,  '5 posts por semana',       1, 1, true,  false, 2),
  ('Constância', 497,  85,  '1 post por dia',           1, 2, true,  true,  3),
  ('Marca Forte',697,  120, '1 post/dia + campanhas',   1, 3, true,  true,  4),
  ('Agência',    997,  180, 'até 3 marcas',             3, 5, true,  true,  5)
on conflict do nothing;

-- ============================================================
--  WORKSPACES
-- ============================================================
create table if not exists workspaces (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  slug        text unique,
  plan_id     uuid references plans(id),
  active      boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists workspace_members (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid references workspaces(id) on delete cascade not null,
  user_id       uuid references auth.users(id) on delete cascade not null,
  role          text default 'member' check (role in ('owner','admin','member')),
  created_at    timestamptz default now(),
  unique (workspace_id, user_id)
);

-- ============================================================
--  SUBSCRIPTIONS
-- ============================================================
create table if not exists subscriptions (
  id                        uuid primary key default uuid_generate_v4(),
  workspace_id              uuid references workspaces(id) on delete cascade not null,
  plan_id                   uuid references plans(id) not null,
  status                    text default 'active' check (status in ('active','canceled','past_due','trialing')),
  current_period_start      timestamptz default now(),
  current_period_end        timestamptz default now() + interval '30 days',
  monthly_credits_available integer default 0,
  extra_credits_available   integer default 0,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

-- ============================================================
--  CREDIT LEDGER
-- ============================================================
create table if not exists credit_ledger (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid references workspaces(id) on delete cascade not null,
  subscription_id uuid references subscriptions(id),
  job_id        uuid,
  type          text not null check (type in ('monthly_grant','extra_purchase','usage','refund','adjustment','expiration')),
  amount        integer not null,
  balance_after integer not null,
  description   text,
  created_at    timestamptz default now()
);

-- ============================================================
--  BRAND PROFILES
-- ============================================================
create table if not exists brand_profiles (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid references workspaces(id) on delete cascade not null,
  name            text not null,
  segment         text,
  city            text,
  target_audience text,
  main_objective  text,
  tone_of_voice   text,
  products        text,
  color_palette   jsonb default '[]',      -- [{name, hex, role}]
  typography      jsonb default '{}',      -- {title, body, label}
  slogans         jsonb default '[]',      -- [{text, active}]
  icons           text[] default '{}',
  logo_urls       jsonb default '{}',      -- {primary, light, dark}
  visual_references jsonb default '[]',   -- URLs de referências
  forbidden_words text[] default '{}',
  design_rules    text,
  ai_brand_dna    text,                   -- DNA gerado pela IA
  ai_context_pct  integer default 0,
  instagram_handle text,
  instagram_account_id text,
  instagram_access_token text,
  onboarding_completed boolean default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
--  BRAND ASSETS
-- ============================================================
create table if not exists brand_assets (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid references workspaces(id) on delete cascade not null,
  brand_id        uuid references brand_profiles(id) on delete cascade not null,
  name            text not null,
  storage_path    text not null,
  public_url      text,
  asset_type      text check (asset_type in ('logo','foto_produto','foto_equipe','referencia_visual','ilustracao','icone','fonte','outro')),
  category        text check (category in ('pessoa','produto','empresa','campanha','identidade')),
  tags            text[] default '{}',
  ai_analyzed     boolean default false,
  performance_score numeric(3,1) default 0,
  times_used      integer default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
--  BRAND LEARNINGS
-- ============================================================
create table if not exists brand_learnings (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid references workspaces(id) on delete cascade not null,
  brand_id        uuid references brand_profiles(id) on delete cascade not null,
  learning_type   text check (learning_type in ('approval','rejection','revision','performance')),
  content         text not null,
  job_id          uuid,
  created_at      timestamptz default now()
);

-- ============================================================
--  CONTENT BRIEFS
-- ============================================================
create table if not exists content_briefs (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid references workspaces(id) on delete cascade not null,
  brand_id        uuid references brand_profiles(id) on delete cascade not null,
  created_by      uuid references auth.users(id),
  title           text,
  objective       text,
  content_type    text check (content_type in ('post_simples','post_premium','carrossel_5','carrossel_7','story','story_sequencia','capa_reels','campanha','kit_campanha')),
  quantity        integer default 1,
  tone            text,
  hashtags        text[] default '{}',
  asset_ids       uuid[] default '{}',
  extra_context   text,
  source          text default 'painel' check (source in ('painel','whatsapp')),
  required_credits integer default 1,
  status          text default 'draft' check (status in ('draft','confirmed','processing','done','error')),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
--  CONTENT JOBS
-- ============================================================
create table if not exists content_jobs (
  id                    uuid primary key default uuid_generate_v4(),
  workspace_id          uuid references workspaces(id) on delete cascade not null,
  brief_id              uuid references content_briefs(id),
  brand_id              uuid references brand_profiles(id),
  job_type              text not null,
  status                text default 'pending' check (status in (
    'pending','processing','waiting_approval','revision_requested',
    'approved','scheduled','published','error'
  )),
  required_credits      integer not null default 1,
  credits_debited       boolean default false,
  attempts_used         integer default 0,
  max_attempts          integer default 3,
  revision_count        integer default 0,
  max_included_revisions integer default 1,
  input_payload         jsonb default '{}',
  output_payload        jsonb default '{}',
  error_message         text,
  n8n_execution_id      text,
  idempotency_key       text unique,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- ============================================================
--  CREATIVE OUTPUTS
-- ============================================================
create table if not exists creative_outputs (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid references workspaces(id) on delete cascade not null,
  job_id          uuid references content_jobs(id) on delete cascade not null,
  brand_id        uuid references brand_profiles(id),
  format          text not null,
  variation_number integer default 1,
  storage_path    text,
  public_url      text,
  caption         text,
  hashtags        text[] default '{}',
  image_prompt    text,
  status          text default 'pending' check (status in ('pending','approved','rejected','scheduled','published')),
  approval_notes  text,
  ai_score        numeric(3,1),
  scheduled_at    timestamptz,
  published_at    timestamptz,
  instagram_post_id text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
--  CAROUSEL PAGES
-- ============================================================
create table if not exists carousel_pages (
  id                uuid primary key default uuid_generate_v4(),
  creative_output_id uuid references creative_outputs(id) on delete cascade not null,
  page_number       integer not null,
  headline          text,
  body              text,
  visual_prompt     text,
  storage_path      text,
  public_url        text,
  created_at        timestamptz default now()
);

-- ============================================================
--  APPROVAL EVENTS
-- ============================================================
create table if not exists approval_events (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid references workspaces(id) on delete cascade not null,
  output_id       uuid references creative_outputs(id) on delete cascade not null,
  user_id         uuid references auth.users(id),
  action          text check (action in ('approved','rejected','revision_requested','scheduled')),
  notes           text,
  created_at      timestamptz default now()
);

-- ============================================================
--  SCHEDULED POSTS
-- ============================================================
create table if not exists scheduled_posts (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid references workspaces(id) on delete cascade not null,
  output_id       uuid references creative_outputs(id) on delete cascade not null,
  brand_id        uuid references brand_profiles(id),
  scheduled_at    timestamptz not null,
  status          text default 'scheduled' check (status in ('scheduled','publishing','published','failed')),
  instagram_post_id text,
  error_message   text,
  published_at    timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
--  WHATSAPP
-- ============================================================
create table if not exists whatsapp_contacts (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid references workspaces(id) on delete cascade not null,
  phone         text not null,
  name          text,
  role          text default 'owner',
  is_authorized boolean default true,
  created_at    timestamptz default now(),
  unique (workspace_id, phone)
);

create table if not exists whatsapp_messages (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid references workspaces(id),
  phone         text not null,
  direction     text check (direction in ('inbound','outbound')),
  message_type  text,
  body          text,
  payload       jsonb default '{}',
  created_at    timestamptz default now()
);

create table if not exists whatsapp_conversation_states (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid references workspaces(id) on delete cascade not null,
  phone         text not null,
  state         text default 'idle' check (state in (
    'idle','awaiting_format','awaiting_objective','awaiting_credit_confirmation',
    'generating','awaiting_approval','awaiting_revision_note','awaiting_schedule_datetime','scheduled'
  )),
  context       jsonb default '{}',
  expires_at    timestamptz default now() + interval '1 hour',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (workspace_id, phone)
);

-- ============================================================
--  INDEXES
-- ============================================================
create index if not exists idx_workspaces_owner on workspaces(owner_id);
create index if not exists idx_brand_profiles_workspace on brand_profiles(workspace_id);
create index if not exists idx_brand_assets_brand on brand_assets(brand_id);
create index if not exists idx_content_jobs_workspace on content_jobs(workspace_id);
create index if not exists idx_content_jobs_status on content_jobs(status);
create index if not exists idx_creative_outputs_job on creative_outputs(job_id);
create index if not exists idx_creative_outputs_status on creative_outputs(status);
create index if not exists idx_scheduled_posts_scheduled_at on scheduled_posts(scheduled_at) where status = 'scheduled';
create index if not exists idx_credit_ledger_workspace on credit_ledger(workspace_id);

-- ============================================================
--  TRIGGERS updated_at
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger trg_workspaces_updated_at          before update on workspaces                   for each row execute function update_updated_at();
create trigger trg_brand_profiles_updated_at       before update on brand_profiles               for each row execute function update_updated_at();
create trigger trg_brand_assets_updated_at         before update on brand_assets                 for each row execute function update_updated_at();
create trigger trg_content_briefs_updated_at       before update on content_briefs               for each row execute function update_updated_at();
create trigger trg_content_jobs_updated_at         before update on content_jobs                 for each row execute function update_updated_at();
create trigger trg_creative_outputs_updated_at     before update on creative_outputs             for each row execute function update_updated_at();
create trigger trg_scheduled_posts_updated_at      before update on scheduled_posts              for each row execute function update_updated_at();
create trigger trg_subscriptions_updated_at        before update on subscriptions                for each row execute function update_updated_at();
create trigger trg_whatsapp_states_updated_at      before update on whatsapp_conversation_states for each row execute function update_updated_at();

-- ============================================================
--  FUNÇÕES DE CRÉDITO
-- ============================================================

-- Retorna créditos disponíveis do workspace
create or replace function get_available_credits(p_workspace_id uuid)
returns integer as $$
declare
  v_monthly  integer;
  v_extra    integer;
begin
  select coalesce(monthly_credits_available, 0), coalesce(extra_credits_available, 0)
  into v_monthly, v_extra
  from subscriptions
  where workspace_id = p_workspace_id and status = 'active'
  order by created_at desc limit 1;
  return coalesce(v_monthly, 0) + coalesce(v_extra, 0);
end;
$$ language plpgsql;

-- Debita créditos e registra no ledger
create or replace function debit_credits(
  p_workspace_id uuid, p_job_id uuid,
  p_amount integer, p_description text
) returns boolean as $$
declare
  v_sub_id   uuid;
  v_monthly  integer;
  v_extra    integer;
  v_balance  integer;
  v_to_debit_monthly integer;
  v_to_debit_extra   integer;
begin
  select id, monthly_credits_available, extra_credits_available
  into v_sub_id, v_monthly, v_extra
  from subscriptions
  where workspace_id = p_workspace_id and status = 'active'
  order by created_at desc limit 1;

  if (coalesce(v_monthly,0) + coalesce(v_extra,0)) < p_amount then
    return false;
  end if;

  -- Usa créditos mensais primeiro
  v_to_debit_monthly := least(p_amount, coalesce(v_monthly,0));
  v_to_debit_extra   := p_amount - v_to_debit_monthly;

  update subscriptions set
    monthly_credits_available = monthly_credits_available - v_to_debit_monthly,
    extra_credits_available   = extra_credits_available   - v_to_debit_extra
  where id = v_sub_id;

  v_balance := (coalesce(v_monthly,0) - v_to_debit_monthly) + (coalesce(v_extra,0) - v_to_debit_extra);

  insert into credit_ledger (workspace_id, subscription_id, job_id, type, amount, balance_after, description)
  values (p_workspace_id, v_sub_id, p_job_id, 'usage', -p_amount, v_balance, p_description);

  return true;
end;
$$ language plpgsql;

-- Reembolsa créditos (erro técnico)
create or replace function refund_credits(
  p_workspace_id uuid, p_job_id uuid,
  p_amount integer, p_description text
) returns void as $$
declare
  v_sub_id  uuid;
  v_balance integer;
begin
  select id into v_sub_id from subscriptions
  where workspace_id = p_workspace_id and status = 'active'
  order by created_at desc limit 1;

  update subscriptions set monthly_credits_available = monthly_credits_available + p_amount
  where id = v_sub_id;

  select monthly_credits_available + extra_credits_available into v_balance
  from subscriptions where id = v_sub_id;

  insert into credit_ledger (workspace_id, subscription_id, job_id, type, amount, balance_after, description)
  values (p_workspace_id, v_sub_id, p_job_id, 'refund', p_amount, v_balance, p_description);
end;
$$ language plpgsql;

-- Créditos necessários por tipo de conteúdo
create or replace function get_required_credits(p_job_type text)
returns integer as $$
begin
  return case p_job_type
    when 'post_simples'      then 1
    when 'post_premium'      then 2
    when 'capa_reels'        then 1
    when 'story'             then 1
    when 'story_sequencia'   then 2
    when 'carrossel_5'       then 3
    when 'carrossel_7'       then 4
    when 'variacao_extra'    then 1
    when 'revisao_imagem'    then 1
    when 'arte_campanha'     then 2
    when 'kit_campanha'      then 6
    else 1
  end;
end;
$$ language plpgsql;

-- ============================================================
--  RLS
-- ============================================================
alter table workspaces                   enable row level security;
alter table workspace_members            enable row level security;
alter table subscriptions                enable row level security;
alter table credit_ledger                enable row level security;
alter table brand_profiles               enable row level security;
alter table brand_assets                 enable row level security;
alter table brand_learnings              enable row level security;
alter table content_briefs               enable row level security;
alter table content_jobs                 enable row level security;
alter table creative_outputs             enable row level security;
alter table carousel_pages               enable row level security;
alter table approval_events              enable row level security;
alter table scheduled_posts              enable row level security;
alter table whatsapp_contacts            enable row level security;
alter table whatsapp_messages            enable row level security;
alter table whatsapp_conversation_states enable row level security;
alter table plans                        enable row level security;

-- Policies base — workspace owner
create policy "workspaces: owner" on workspaces for all using (auth.uid() = owner_id);
create policy "plans: read" on plans for select using (true);

create policy "workspace_members: own" on workspace_members for all using (
  exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
  or user_id = auth.uid()
);

create policy "subscriptions: own workspace" on subscriptions for all using (
  exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
);

create policy "credit_ledger: own workspace" on credit_ledger for all using (
  exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
);

create policy "brand_profiles: own workspace" on brand_profiles for all using (
  exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
);

create policy "brand_assets: own workspace" on brand_assets for all using (
  exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
);

create policy "brand_learnings: own workspace" on brand_learnings for all using (
  exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
);

create policy "content_briefs: own workspace" on content_briefs for all using (
  exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
);

create policy "content_jobs: own workspace" on content_jobs for all using (
  exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
);

create policy "creative_outputs: own workspace" on creative_outputs for all using (
  exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
);

create policy "carousel_pages: own" on carousel_pages for all using (
  exists (
    select 1 from creative_outputs co
    join workspaces w on w.id = co.workspace_id
    where co.id = creative_output_id and w.owner_id = auth.uid()
  )
);

create policy "approval_events: own workspace" on approval_events for all using (
  exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
);

create policy "scheduled_posts: own workspace" on scheduled_posts for all using (
  exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
);

create policy "whatsapp_contacts: own workspace" on whatsapp_contacts for all using (
  exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
);

create policy "whatsapp_messages: own workspace" on whatsapp_messages for all using (
  exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
);

create policy "whatsapp_states: own workspace" on whatsapp_conversation_states for all using (
  exists (select 1 from workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
);
