-- ===========================================================================
-- Arvutitark Price Tracker - core schema
-- ===========================================================================
-- Design notes:
--   * `retailer` and `category` columns exist so additional retailers and
--     component categories (CPU, GPU, SSD, ...) can be added later without
--     restructuring. Today only retailer = 'arvutitark', category = 'ram'.
--   * Price observations are append-only: one row per product per calendar
--     day (Europe/Tallinn). Historical rows are never overwritten.
--
-- COMPATIBILITY
--   This migration is ADDITIVE and safe to re-run. If `products`,
--   `price_history` or `scrape_runs` already exist (for example from an
--   earlier version of this scraper) then `create table if not exists` is
--   skipped and every required column is added with `add column if not
--   exists` instead. The uniqueness guarantees this project depends on are
--   created only when they are missing.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- scrape_runs
-- ---------------------------------------------------------------------------
-- Doubles as the persistent "one fetch attempt per Tallinn calendar day" lock.
-- `scrape_date` is unique, so a second claim for the same day is rejected.
-- The row is created BEFORE Arvutitark is contacted and is never deleted, so a
-- crash mid-scrape cannot cause a duplicate fetch.
-- ---------------------------------------------------------------------------
create table if not exists public.scrape_runs (
  scrape_date   date primary key,
  attempted_at  timestamptz not null default now(),
  finished_at   timestamptz,
  status        text not null default 'running'
                  check (status in ('running', 'completed', 'failed')),
  product_count integer,
  page_count    integer,
  error_message text
);

alter table public.scrape_runs add column if not exists scrape_date date;
alter table public.scrape_runs add column if not exists attempted_at timestamptz not null default now();
alter table public.scrape_runs add column if not exists finished_at timestamptz;
alter table public.scrape_runs add column if not exists status text not null default 'running';
alter table public.scrape_runs add column if not exists product_count integer;
alter table public.scrape_runs add column if not exists page_count integer;
alter table public.scrape_runs add column if not exists error_message text;

-- The daily claim REQUIRES uniqueness on scrape_date. Guard it explicitly so a
-- pre-existing table without the primary key still gets the lock.
do $$
begin
  if not exists (
    select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname in ('scrape_runs_pkey', 'scrape_runs_scrape_date_key')
  ) then
    begin
      create unique index scrape_runs_scrape_date_key
        on public.scrape_runs (scrape_date);
    exception when others then
      raise notice 'public.scrape_runs: could not create the unique index on (scrape_date) [%]. The daily scrape lock will NOT work until duplicate or NULL scrape_date values are resolved and this migration is re-run.', sqlerrm;
    end;
  end if;
end $$;

comment on table public.scrape_runs is
  'One row per Tallinn calendar day. Acts as an atomic daily scrape claim and as the persistent last-fetch log.';

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id                      bigint primary key,
  retailer                text not null default 'arvutitark',
  category                text not null default 'ram',
  sku                     text,
  ean                     text,
  name                    text not null,
  name_en                 text,
  brand                   text,
  url                     text,
  first_seen_at           timestamptz not null default now(),
  last_seen_at            timestamptz not null default now(),

  -- Normalized RAM specification fields. Nullable on purpose: retailer
  -- metadata is inconsistent and we prefer null over an invented value.
  memory_type             text,
  capacity_gb             integer,
  speed_mhz               integer,
  cas_latency             integer,
  module_count            integer,
  capacity_per_module_gb  integer,
  form_factor             text,
  voltage                 numeric(6, 2)
);

-- Bring a pre-existing `products` table up to the required shape.
alter table public.products add column if not exists id bigint;
alter table public.products add column if not exists retailer text not null default 'arvutitark';
alter table public.products add column if not exists category text not null default 'ram';
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists ean text;
alter table public.products add column if not exists name text;
alter table public.products add column if not exists name_en text;
alter table public.products add column if not exists brand text;
alter table public.products add column if not exists url text;
alter table public.products add column if not exists first_seen_at timestamptz not null default now();
alter table public.products add column if not exists last_seen_at timestamptz not null default now();
alter table public.products add column if not exists memory_type text;
alter table public.products add column if not exists capacity_gb integer;
alter table public.products add column if not exists speed_mhz integer;
alter table public.products add column if not exists cas_latency integer;
alter table public.products add column if not exists module_count integer;
alter table public.products add column if not exists capacity_per_module_gb integer;
alter table public.products add column if not exists form_factor text;
alter table public.products add column if not exists voltage numeric(6, 2);

-- `ingest_snapshot` upserts with ON CONFLICT (id), which requires a unique
-- index on `id`. A pre-existing table may not have one.
do $$
begin
  if not exists (
    select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname in ('products_pkey', 'products_id_key')
  ) then
    begin
      create unique index products_id_key on public.products (id);
    exception when others then
      raise notice 'public.products: could not create a unique index on (id) [%]. Resolve duplicate or NULL ids, then re-run this migration.', sqlerrm;
    end;
  end if;
end $$;

-- Diagnostic: a legacy table may carry NOT NULL columns that our ingest does
-- not populate. Report them loudly instead of failing later at scrape time.
do $$
declare
  v_offenders text;
begin
  select string_agg(a.attname, ', ' order by a.attname)
    into v_offenders
    from pg_attribute a
   where a.attrelid = 'public.products'::regclass
     and a.attnum > 0
     and not a.attisdropped
     and a.attnotnull
     and a.atthasdef = false
     and a.attname not in ('id', 'name');

  if v_offenders is not null then
    raise notice 'public.products has NOT NULL columns without defaults that ingest_snapshot does not populate: %. Drop NOT NULL or add a default, otherwise the first ingest will fail.', v_offenders;
  end if;
end $$;

comment on table public.products is
  'Current product metadata, keyed by the retailer (Arvutitark) numeric product id.';

create index if not exists products_retailer_category_idx
  on public.products (retailer, category);
create index if not exists products_brand_idx on public.products (brand);
create index if not exists products_ean_idx on public.products (ean);
create index if not exists products_capacity_idx on public.products (capacity_gb);
create index if not exists products_speed_idx on public.products (speed_mhz);
create index if not exists products_cas_idx on public.products (cas_latency);

-- ---------------------------------------------------------------------------
-- price_history
-- ---------------------------------------------------------------------------
create table if not exists public.price_history (
  id                       bigserial primary key,
  product_id               bigint not null
                             references public.products (id) on delete cascade,
  observed_date            date not null,
  observed_at              timestamptz not null default now(),
  price                    numeric(12, 2) not null,
  original_price           numeric(12, 2),
  source_price_updated_at  timestamptz,
  warehouse_stock          integer,
  local_stock              integer,
  shop_stock               jsonb not null default '{}'::jsonb,

  -- One observation per product per calendar day. This is the database-level
  -- guarantee that history is never duplicated or overwritten.
  constraint price_history_product_day_key unique (product_id, observed_date)
);

-- Bring a pre-existing `price_history` table up to the required shape.
-- `id` is needed by the summary view for stable tie-breaking.
alter table public.price_history add column if not exists id bigserial;
alter table public.price_history add column if not exists product_id bigint;
alter table public.price_history add column if not exists observed_date date;
alter table public.price_history add column if not exists observed_at timestamptz not null default now();
alter table public.price_history add column if not exists price numeric(12, 2);
alter table public.price_history add column if not exists original_price numeric(12, 2);
alter table public.price_history add column if not exists source_price_updated_at timestamptz;
alter table public.price_history add column if not exists warehouse_stock integer;
alter table public.price_history add column if not exists local_stock integer;
alter table public.price_history add column if not exists shop_stock jsonb not null default '{}'::jsonb;

-- The (product_id, observed_date) uniqueness is what prevents duplicate or
-- overwritten history. The index name matches the constraint name used above,
-- so on a fresh install this is a no-op.
do $$
begin
  begin
    create unique index if not exists price_history_product_day_key
      on public.price_history (product_id, observed_date);
  exception when others then
    raise notice 'public.price_history: could not create the (product_id, observed_date) uniqueness guarantee [%]. Duplicate observations were found. Resolve them with: delete from price_history a using price_history b where a.ctid < b.ctid and a.product_id = b.product_id and a.observed_date = b.observed_date; then re-run this migration.', sqlerrm;
  end;
end $$;

-- Diagnostic: legacy NOT NULL columns our ingest does not populate.
do $$
declare
  v_offenders text;
begin
  select string_agg(a.attname, ', ' order by a.attname)
    into v_offenders
    from pg_attribute a
   where a.attrelid = 'public.price_history'::regclass
     and a.attnum > 0
     and not a.attisdropped
     and a.attnotnull
     and a.atthasdef = false
     and a.attname not in ('id', 'product_id', 'observed_date', 'price');

  if v_offenders is not null then
    raise notice 'public.price_history has NOT NULL columns without defaults that ingest_snapshot does not populate: %. Drop NOT NULL or add a default, otherwise the first ingest will fail.', v_offenders;
  end if;
end $$;

comment on table public.price_history is
  'Append-only daily price observations. `original_price` is the retailer''s own field and is NOT our historical starting price.';

create index if not exists price_history_product_date_idx
  on public.price_history (product_id, observed_date desc);
create index if not exists price_history_date_idx
  on public.price_history (observed_date desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Reads are public (this is public price data). All writes go through
-- SECURITY DEFINER functions that are only granted to `service_role`.
-- ---------------------------------------------------------------------------
alter table public.scrape_runs   enable row level security;
alter table public.products      enable row level security;
alter table public.price_history enable row level security;

drop policy if exists "public read scrape_runs" on public.scrape_runs;
create policy "public read scrape_runs"
  on public.scrape_runs for select
  to anon, authenticated
  using (true);

drop policy if exists "public read products" on public.products;
create policy "public read products"
  on public.products for select
  to anon, authenticated
  using (true);

drop policy if exists "public read price_history" on public.price_history;
create policy "public read price_history"
  on public.price_history for select
  to anon, authenticated
  using (true);

grant select on public.scrape_runs   to anon, authenticated;
grant select on public.products      to anon, authenticated;
grant select on public.price_history to anon, authenticated;
