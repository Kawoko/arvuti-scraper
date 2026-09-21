-- ===========================================================================
-- Arvutitark Price Tracker - RPC functions
-- ===========================================================================
-- All functions are SECURITY DEFINER and restricted to `service_role`.
-- The publishable/anon key can never call these.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- claim_scrape_run
-- ---------------------------------------------------------------------------
-- Atomically claims the daily scrape slot for a Tallinn calendar date.
-- Returns true when this caller claimed the day, false when it was already
-- claimed. The unique primary key on scrape_date makes this race-free even if
-- several scheduler invocations start at the same moment.
-- ---------------------------------------------------------------------------
create or replace function public.claim_scrape_run(p_scrape_date date)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
begin
  insert into public.scrape_runs (scrape_date, attempted_at, status)
  values (p_scrape_date, now(), 'running')
  on conflict (scrape_date) do nothing;

  get diagnostics v_inserted = row_count;

  return v_inserted = 1;
end;
$$;

comment on function public.claim_scrape_run(date) is
  'Atomically claims the daily scrape slot. true = claimed by this caller, false = already claimed.';

-- ---------------------------------------------------------------------------
-- finish_scrape_run
-- ---------------------------------------------------------------------------
-- Records the terminal state of a run. The row is NEVER deleted, which is what
-- guarantees a failed run cannot be retried on the same calendar day.
-- ---------------------------------------------------------------------------
create or replace function public.finish_scrape_run(
  p_scrape_date   date,
  p_status        text,
  p_product_count integer default null,
  p_page_count    integer default null,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('completed', 'failed') then
    raise exception 'finish_scrape_run: invalid status %', p_status;
  end if;

  update public.scrape_runs
     set status        = p_status,
         finished_at   = now(),
         product_count = p_product_count,
         page_count    = p_page_count,
         error_message = left(p_error_message, 2000)
   where scrape_date = p_scrape_date;
end;
$$;

-- ---------------------------------------------------------------------------
-- ingest_snapshot
-- ---------------------------------------------------------------------------
-- Atomically upserts product metadata and inserts one price observation per
-- product for the given day. The whole call runs in a single implicit
-- transaction: either every product + observation lands, or nothing does.
--
-- Duplicate protection is at the database level via
-- price_history_product_day_key (product_id, observed_date).
--
-- Returns { product_count, price_count }.
-- ---------------------------------------------------------------------------
create or replace function public.ingest_snapshot(
  p_scrape_date date,
  p_products    jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_count integer := 0;
  v_price_count   integer := 0;
begin
  create temporary table _incoming_snapshot on commit drop as
  select *
    from jsonb_to_recordset(coalesce(p_products, '[]'::jsonb)) as x(
      id                     bigint,
      sku                    text,
      ean                    text,
      name                   text,
      name_en                text,
      brand                  text,
      url                    text,
      category               text,
      chipset                text,
      memory_type            text,
      capacity_gb            integer,
      speed_mhz              integer,
      cas_latency            integer,
      module_count           integer,
      capacity_per_module_gb integer,
      form_factor            text,
      voltage                numeric,
      price                  numeric,
      original_price         numeric,
      source_price_updated_at timestamptz,
      warehouse_stock        integer,
      local_stock            integer,
      shop_stock             jsonb
    );

  -- Only rows with a trustworthy identity and price are ingested.
  delete from _incoming_snapshot
   where id is null or price is null or name is null or btrim(name) = '';

  select count(*) into v_product_count from _incoming_snapshot;

  -- Upsert product metadata. Existing non-null spec fields are preserved when
  -- the incoming value is missing (coalesce), so a partially-parsed day never
  -- wipes previously known specifications.
  insert into public.products as p (
    id, retailer, category, chipset, sku, ean, name, name_en, brand, url,
    memory_type, capacity_gb, speed_mhz, cas_latency, module_count,
    capacity_per_module_gb, form_factor, voltage,
    first_seen_at, last_seen_at
  )
  select
    i.id,
    'arvutitark',
    coalesce(nullif(i.category, ''), 'ram'),
    i.chipset,
    i.sku,
    i.ean,
    i.name,
    i.name_en,
    i.brand,
    i.url,
    i.memory_type,
    i.capacity_gb,
    i.speed_mhz,
    i.cas_latency,
    i.module_count,
    i.capacity_per_module_gb,
    i.form_factor,
    i.voltage,
    now(),
    now()
  from _incoming_snapshot i
  on conflict (id) do update set
    sku                    = coalesce(excluded.sku, p.sku),
    ean                    = coalesce(excluded.ean, p.ean),
    name                   = excluded.name,
    name_en                = coalesce(excluded.name_en, p.name_en),
    brand                  = coalesce(excluded.brand, p.brand),
    url                    = coalesce(excluded.url, p.url),
    category               = coalesce(excluded.category, p.category),
    chipset                = coalesce(excluded.chipset, p.chipset),
    memory_type            = coalesce(excluded.memory_type, p.memory_type),
    capacity_gb            = coalesce(excluded.capacity_gb, p.capacity_gb),
    speed_mhz              = coalesce(excluded.speed_mhz, p.speed_mhz),
    cas_latency            = coalesce(excluded.cas_latency, p.cas_latency),
    module_count           = coalesce(excluded.module_count, p.module_count),
    capacity_per_module_gb = coalesce(excluded.capacity_per_module_gb, p.capacity_per_module_gb),
    form_factor            = coalesce(excluded.form_factor, p.form_factor),
    voltage                = coalesce(excluded.voltage, p.voltage),
    last_seen_at           = now();

  -- Append today's observation. `do nothing` (never `do update`) is what keeps
  -- history immutable.
  insert into public.price_history (
    product_id, observed_date, observed_at, price, original_price,
    source_price_updated_at, warehouse_stock, local_stock, shop_stock
  )
  select
    i.id,
    p_scrape_date,
    now(),
    i.price,
    coalesce(i.original_price, i.price),
    i.source_price_updated_at,
    i.warehouse_stock,
    i.local_stock,
    coalesce(i.shop_stock, '{}'::jsonb)
  from _incoming_snapshot i
  on conflict (product_id, observed_date) do nothing;

  get diagnostics v_price_count = row_count;

  return jsonb_build_object(
    'product_count', v_product_count,
    'price_count', v_price_count
  );
end;
$$;

comment on function public.ingest_snapshot(date, jsonb) is
  'Atomically upserts product metadata and appends one immutable price observation per product per day.';

-- ---------------------------------------------------------------------------
-- Lock the RPC surface down to the service role only.
-- ---------------------------------------------------------------------------
revoke all on function public.claim_scrape_run(date) from public;
revoke all on function public.finish_scrape_run(date, text, integer, integer, text) from public;
revoke all on function public.ingest_snapshot(date, jsonb) from public;

grant execute on function public.claim_scrape_run(date) to service_role;
grant execute on function public.finish_scrape_run(date, text, integer, integer, text) to service_role;
grant execute on function public.ingest_snapshot(date, jsonb) to service_role;
