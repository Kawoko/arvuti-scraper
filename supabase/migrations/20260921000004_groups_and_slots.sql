-- ===========================================================================
-- Arvutitark Price Tracker - tracked groups and twice-daily slots
-- ===========================================================================
-- Two changes, both additive to the existing schema:
--
-- 1. TWICE DAILY. `scrape_runs` gains a `slot` (1 or 2). The unique key becomes
--    (scrape_date, slot), so a Tallinn day can be collected at most twice.
--    Slot 2 only opens from noon Tallinn time and at least four hours after
--    slot 1, which keeps "twice a day" from collapsing into two runs an hour
--    apart while still allowing a second sample after downtime.
--
-- 2. INDEPENDENT GROUPS. Products and price history are now keyed by
--    (product id, category) instead of product id alone. A product pinned in
--    the `custom` group therefore gets its own row and its own history, and can
--    never overwrite the same product tracked under `ram`, `gpu`, `cpu`, `hdd`
--    or `ssd` - and vice versa.
--
-- ORDER IS LOAD-BEARING. The foreign key from price_history to products is
-- built on products_pkey, so it has to be dropped BEFORE the primary key can be
-- replaced, and re-created AFTER the new composite key exists. The steps below
-- are numbered in the order they must run.
--
-- Safe to re-run.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- STEP 1. scrape_runs: two slots per day
-- ---------------------------------------------------------------------------
alter table public.scrape_runs add column if not exists slot integer not null default 1;

do $$
begin
  if exists (
    select 1 from pg_constraint
     where conrelid = 'public.scrape_runs'::regclass and contype = 'p'
  ) then
    alter table public.scrape_runs drop constraint scrape_runs_pkey;
  end if;
end $$;

drop index if exists public.scrape_runs_scrape_date_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.scrape_runs'::regclass and contype = 'p'
  ) then
    alter table public.scrape_runs add constraint scrape_runs_pkey primary key (scrape_date, slot);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.scrape_runs'::regclass
       and conname = 'scrape_runs_slot_check'
  ) then
    alter table public.scrape_runs
      add constraint scrape_runs_slot_check check (slot between 1 and 2);
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- STEP 2. price_history: add the group column and backfill it
-- ---------------------------------------------------------------------------
-- This must happen before the composite keys are created, because the new
-- foreign key needs a NOT NULL category on every row.
-- ---------------------------------------------------------------------------
alter table public.price_history add column if not exists category text;

update public.price_history ph
   set category = coalesce(p.category, 'ram')
  from public.products p
 where p.id = ph.product_id
   and ph.category is null;

update public.price_history set category = 'ram' where category is null;

alter table public.price_history alter column category set default 'ram';
alter table public.price_history alter column category set not null;


-- ---------------------------------------------------------------------------
-- STEP 3. Drop the constraints that depend on the single-column keys
-- ---------------------------------------------------------------------------
-- `price_history_product_id_fkey` references products_pkey directly, so it must
-- go first. Its uniqueness rule is also replaced by the composite one below.
-- ---------------------------------------------------------------------------
do $$
declare
  c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.price_history'::regclass
       and contype in ('f', 'u')
  loop
    execute format('alter table public.price_history drop constraint %I', c.conname);
  end loop;
end $$;

drop index if exists public.price_history_product_day_key;

-- The single-column unique index would actively prevent the same product id
-- from being tracked in two groups, which is the whole point of this migration.
drop index if exists public.products_id_key;


-- ---------------------------------------------------------------------------
-- STEP 4. products: new per-category spec columns + composite identity
-- ---------------------------------------------------------------------------
alter table public.products add column if not exists source_category text;
alter table public.products add column if not exists family text;
alter table public.products add column if not exists socket text;
alter table public.products add column if not exists read_speed_mbs integer;
alter table public.products add column if not exists write_speed_mbs integer;
alter table public.products add column if not exists interface_type text;

do $$
begin
  if exists (
    select 1 from pg_constraint
     where conrelid = 'public.products'::regclass and contype = 'p'
  ) then
    alter table public.products drop constraint products_pkey;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.products'::regclass and contype = 'p'
  ) then
    alter table public.products add constraint products_pkey primary key (id, category);
  end if;
end $$;

create index if not exists products_category_idx on public.products (category);
create index if not exists products_family_idx on public.products (family);
create index if not exists products_socket_idx on public.products (socket);


-- ---------------------------------------------------------------------------
-- STEP 5. price_history: composite foreign key and uniqueness
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.price_history'::regclass
       and conname = 'price_history_product_group_fkey'
  ) then
    alter table public.price_history
      add constraint price_history_product_group_fkey
      foreign key (product_id, category)
      references public.products (id, category)
      on delete cascade;
  end if;
end $$;

do $$
begin
  begin
    create unique index if not exists price_history_product_day_key
      on public.price_history (product_id, category, observed_date);
  exception when others then
    raise notice 'public.price_history: could not create the (product_id, category, observed_date) uniqueness guarantee [%]. Resolve duplicate rows, then re-run this migration.', sqlerrm;
  end;
end $$;

create index if not exists price_history_category_idx on public.price_history (category);


-- ---------------------------------------------------------------------------
-- STEP 6. claim_scrape_run -> returns the slot it claimed, or null
-- ---------------------------------------------------------------------------
drop function if exists public.claim_scrape_run(date);

create or replace function public.claim_scrape_run(p_scrape_date date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted        integer := 0;
  v_slot1_attempted timestamptz;
  v_tallinn_hour    integer;
begin
  -- Slot 1: the first collection of the Tallinn day.
  insert into public.scrape_runs (scrape_date, slot, attempted_at, status)
  values (p_scrape_date, 1, now(), 'running')
  on conflict (scrape_date, slot) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 1 then
    return 1;
  end if;

  -- Slot 2: only from noon Tallinn time, and at least four hours after slot 1.
  v_tallinn_hour := extract(hour from (now() at time zone 'Europe/Tallinn'));

  if v_tallinn_hour < 12 then
    return null;
  end if;

  select attempted_at into v_slot1_attempted
    from public.scrape_runs
   where scrape_date = p_scrape_date
     and slot = 1;

  if v_slot1_attempted is not null and v_slot1_attempted > now() - interval '4 hours' then
    return null;
  end if;

  insert into public.scrape_runs (scrape_date, slot, attempted_at, status)
  values (p_scrape_date, 2, now(), 'running')
  on conflict (scrape_date, slot) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 1 then
    return 2;
  end if;

  return null;
end;
$$;

comment on function public.claim_scrape_run(date) is
  'Atomically claims the next available collection slot (1 or 2) for the day. Returns the slot, or null when none is available.';


-- ---------------------------------------------------------------------------
-- STEP 7. finish_scrape_run -> scoped to a slot
-- ---------------------------------------------------------------------------
drop function if exists public.finish_scrape_run(date, text, integer, integer, text);

create or replace function public.finish_scrape_run(
  p_scrape_date   date,
  p_slot          integer,
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
   where scrape_date = p_scrape_date
     and slot = p_slot;
end;
$$;


-- ---------------------------------------------------------------------------
-- STEP 8. ingest_snapshot -> composite identity + new spec columns
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
      source_category        text,
      chipset                text,
      family                 text,
      socket                 text,
      read_speed_mbs         integer,
      write_speed_mbs        integer,
      interface_type         text,
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

  delete from _incoming_snapshot
   where id is null or price is null or name is null or btrim(name) = '';

  select count(*) into v_product_count from _incoming_snapshot;

  -- Upsert on (id, category): each group owns its own row, so ingesting one
  -- group can never overwrite another group's product.
  insert into public.products as p (
    id, retailer, category, source_category, sku, ean, name, name_en, brand, url,
    chipset, family, socket, read_speed_mbs, write_speed_mbs, interface_type,
    memory_type, capacity_gb, speed_mhz, cas_latency, module_count,
    capacity_per_module_gb, form_factor, voltage,
    first_seen_at, last_seen_at
  )
  select
    i.id,
    'arvutitark',
    coalesce(nullif(i.category, ''), 'ram'),
    i.source_category,
    i.sku,
    i.ean,
    i.name,
    i.name_en,
    i.brand,
    i.url,
    i.chipset,
    i.family,
    i.socket,
    i.read_speed_mbs,
    i.write_speed_mbs,
    i.interface_type,
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
  on conflict (id, category) do update set
    source_category        = coalesce(excluded.source_category, p.source_category),
    sku                    = coalesce(excluded.sku, p.sku),
    ean                    = coalesce(excluded.ean, p.ean),
    name                   = excluded.name,
    name_en                = coalesce(excluded.name_en, p.name_en),
    brand                  = coalesce(excluded.brand, p.brand),
    url                    = coalesce(excluded.url, p.url),
    chipset                = coalesce(excluded.chipset, p.chipset),
    family                 = coalesce(excluded.family, p.family),
    socket                 = coalesce(excluded.socket, p.socket),
    read_speed_mbs         = coalesce(excluded.read_speed_mbs, p.read_speed_mbs),
    write_speed_mbs        = coalesce(excluded.write_speed_mbs, p.write_speed_mbs),
    interface_type         = coalesce(excluded.interface_type, p.interface_type),
    memory_type            = coalesce(excluded.memory_type, p.memory_type),
    capacity_gb            = coalesce(excluded.capacity_gb, p.capacity_gb),
    speed_mhz              = coalesce(excluded.speed_mhz, p.speed_mhz),
    cas_latency            = coalesce(excluded.cas_latency, p.cas_latency),
    module_count           = coalesce(excluded.module_count, p.module_count),
    capacity_per_module_gb = coalesce(excluded.capacity_per_module_gb, p.capacity_per_module_gb),
    form_factor            = coalesce(excluded.form_factor, p.form_factor),
    voltage                = coalesce(excluded.voltage, p.voltage),
    last_seen_at           = now();

  insert into public.price_history (
    product_id, category, observed_date, observed_at, price, original_price,
    source_price_updated_at, warehouse_stock, local_stock, shop_stock
  )
  select
    i.id,
    coalesce(nullif(i.category, ''), 'ram'),
    p_scrape_date,
    now(),
    i.price,
    coalesce(i.original_price, i.price),
    i.source_price_updated_at,
    i.warehouse_stock,
    i.local_stock,
    coalesce(i.shop_stock, '{}'::jsonb)
  from _incoming_snapshot i
  on conflict (product_id, category, observed_date) do nothing;

  get diagnostics v_price_count = row_count;

  return jsonb_build_object(
    'product_count', v_product_count,
    'price_count', v_price_count
  );
end;
$$;


-- ---------------------------------------------------------------------------
-- STEP 9. Grants
-- ---------------------------------------------------------------------------
revoke all on function public.claim_scrape_run(date) from public;
revoke all on function public.finish_scrape_run(date, integer, text, integer, integer, text) from public;
revoke all on function public.ingest_snapshot(date, jsonb) from public;

grant execute on function public.claim_scrape_run(date) to service_role;
grant execute on function public.finish_scrape_run(date, integer, text, integer, integer, text) to service_role;
grant execute on function public.ingest_snapshot(date, jsonb) to service_role;
