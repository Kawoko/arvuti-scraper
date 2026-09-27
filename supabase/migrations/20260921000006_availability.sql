-- ===========================================================================
-- Arvutitark Price Tracker - availability and delisted products
-- ===========================================================================
-- Two different things can happen to a tracked product at the retailer:
--
--   1. OUT OF STOCK. Still listed with a price, but every shop and the
--      warehouse show zero. Already captured by `in_stock`, derived from the
--      retailer's own stock map.
--
--   2. NO LONGER LISTED. The product stops coming back from the API entirely,
--      because it was discontinued or removed. Nothing currently distinguishes
--      this: the row keeps its last observed price and therefore looks current
--      forever, even though we have not seen it in weeks.
--
-- This migration adds the two fields needed to tell case 2 apart:
--
--   last_seen_date    the most recent collection that returned this product
--   is_delisted       true when that is older than the latest successful scan
--
-- A product is only ever *flagged*, never deleted, so its price history stays
-- intact and it reappears as active if the retailer lists it again.
--
-- Must run after 0004 and 0005. Safe to re-run.
-- ===========================================================================

drop view if exists public.product_price_summary;

create view public.product_price_summary
with (security_invoker = true)
as
with latest_run as (
  select max(scrape_date) as latest_scrape_date
    from public.scrape_runs
   where status = 'completed'
),
-- Computed once per product so `is_delisted` is defined in a single place and
-- reused by both the flag itself and the `in_stock` derivation below.
availability as (
  select
    p.id                                                     as product_id,
    p.category,
    lr.latest_scrape_date,
    (p.last_seen_at at time zone 'Europe/Tallinn')::date     as last_seen_date,
    (
      lr.latest_scrape_date is not null
      and (p.last_seen_at at time zone 'Europe/Tallinn')::date < lr.latest_scrape_date
    )                                                        as is_delisted
  from public.products p
  cross join latest_run lr
),
bounds as (
  select
    ph.product_id,
    ph.category,
    min(ph.observed_date) as start_date,
    max(ph.observed_date) as current_date,
    min(ph.price)         as lowest_price,
    max(ph.price)         as highest_price,
    avg(ph.price)         as average_price,
    count(*)              as observation_count
  from public.price_history ph
  group by ph.product_id, ph.category
),
start_obs as (
  select distinct on (ph.product_id, ph.category)
    ph.product_id,
    ph.category,
    ph.price as start_price
  from public.price_history ph
  order by ph.product_id, ph.category, ph.observed_date asc, ph.id asc
),
current_obs as (
  select distinct on (ph.product_id, ph.category)
    ph.product_id,
    ph.category,
    ph.price           as current_price,
    ph.original_price  as current_original_price,
    ph.observed_at     as current_observed_at,
    ph.warehouse_stock as current_warehouse_stock,
    ph.local_stock     as current_local_stock,
    ph.shop_stock      as current_shop_stock
  from public.price_history ph
  order by ph.product_id, ph.category, ph.observed_date desc, ph.id desc
),
previous_obs as (
  select
    ranked_prev.product_id,
    ranked_prev.category,
    ranked_prev.price         as previous_price,
    ranked_prev.observed_date as previous_date
  from (
    select
      ph.product_id,
      ph.category,
      ph.price,
      ph.observed_date,
      row_number() over (
        partition by ph.product_id, ph.category
        order by ph.observed_date desc, ph.id desc
      ) as rn
    from public.price_history ph
  ) ranked_prev
  where ranked_prev.rn = 2
)
select
  p.id                                   as product_id,
  p.retailer,
  p.category,
  p.source_category,
  p.sku,
  p.ean,
  p.name,
  p.name_en,
  p.brand,
  p.url,
  p.chipset,
  p.family,
  p.socket,
  p.read_speed_mbs,
  p.write_speed_mbs,
  p.interface_type,
  p.memory_type,
  p.capacity_gb,
  p.speed_mhz,
  p.cas_latency,
  p.module_count,
  p.capacity_per_module_gb,
  p.form_factor,
  p.voltage,
  p.first_seen_at,
  p.last_seen_at,

  -- Availability
  av.latest_scrape_date,
  av.last_seen_date,
  av.is_delisted,

  b.start_date,
  s.start_price,

  b.current_date,
  c.current_price,
  c.current_original_price,
  c.current_observed_at,

  (c.current_price - s.start_price)                        as price_change,
  case
    when s.start_price is not null and s.start_price > 0
      then round(((c.current_price - s.start_price) / s.start_price) * 100, 2)
    else null
  end                                                       as price_change_percent,

  b.lowest_price,
  b.highest_price,
  round(b.average_price, 2)                                as average_price,
  b.observation_count,

  c.current_warehouse_stock,
  c.current_local_stock,
  c.current_shop_stock,
  (
    coalesce(c.current_warehouse_stock, 0)
    + coalesce(c.current_local_stock, 0)
    + coalesce(
        (select sum(g.value::integer)
           from jsonb_each_text(coalesce(c.current_shop_stock, '{}'::jsonb)) as g(key, value)
          where g.value ~ '^[0-9]+$'),
        0
      )
  )                                                         as current_total_stock,
  -- A delisted product is never "in stock": its stock figures are frozen at the
  -- last collection that returned it, which would otherwise look current.
  (
    not av.is_delisted
    and (
      coalesce(c.current_warehouse_stock, 0) > 0
      or coalesce(c.current_local_stock, 0) > 0
      or exists (
          select 1
            from jsonb_each_text(coalesce(c.current_shop_stock, '{}'::jsonb)) as g(key, value)
           where g.value ~ '^[0-9]+$' and g.value::integer > 0
        )
    )
  )                                                         as in_stock,

  prev.previous_date,
  prev.previous_price,
  (c.current_price - prev.previous_price)                   as day_change,
  case
    when prev.previous_price is not null and prev.previous_price > 0
      then round(((c.current_price - prev.previous_price) / prev.previous_price) * 100, 2)
    else null
  end                                                       as day_change_percent,

  (c.current_price < s.start_price)                         as is_below_start_price,
  (c.current_price > s.start_price)                         as is_above_start_price,
  (c.current_price <= b.lowest_price)                       as is_at_historical_low
from public.products p
join bounds        b    on b.product_id = p.id and b.category = p.category
join start_obs     s    on s.product_id = p.id and s.category = p.category
join current_obs   c    on c.product_id = p.id and c.category = p.category
left join previous_obs prev on prev.product_id = p.id and prev.category = p.category
join availability     av   on av.product_id = p.id and av.category = p.category;

comment on view public.product_price_summary is
  'Per (product, group) derived price statistics plus availability. is_delisted flags a product the retailer no longer returns.';

grant select on public.product_price_summary to anon, authenticated;
