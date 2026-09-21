-- ===========================================================================
-- Arvutitark Price Tracker - derived statistics view
-- ===========================================================================
-- `product_price_summary` powers the product list, deals and status pages so
-- those pages never touch the full price_history table.
--
-- IMPORTANT terminology:
--   `start_price` is the price at the EARLIEST observation in OUR database.
--   `current_original_price` is Arvutitark's own `original_price` field.
--   These are different concepts and must never be conflated.
-- ===========================================================================

-- Dropped first so that a view left over from an earlier version of this
-- project (with a different column list) cannot block `create`.
drop view if exists public.product_price_summary;

create view public.product_price_summary
with (security_invoker = true)
as
with bounds as (
  select
    ph.product_id,
    min(ph.observed_date) as start_date,
    max(ph.observed_date) as current_date,
    min(ph.price)         as lowest_price,
    max(ph.price)         as highest_price,
    avg(ph.price)         as average_price,
    count(*)              as observation_count
  from public.price_history ph
  group by ph.product_id
),
start_obs as (
  select distinct on (ph.product_id)
    ph.product_id,
    ph.price as start_price
  from public.price_history ph
  order by ph.product_id, ph.observed_date asc, ph.id asc
),
current_obs as (
  select distinct on (ph.product_id)
    ph.product_id,
    ph.price                   as current_price,
    ph.original_price          as current_original_price,
    ph.observed_at             as current_observed_at,
    ph.warehouse_stock         as current_warehouse_stock,
    ph.local_stock             as current_local_stock,
    ph.shop_stock              as current_shop_stock
  from public.price_history ph
  order by ph.product_id, ph.observed_date desc, ph.id desc
),
-- The observation immediately BEFORE the latest one, used for "today's" change.
previous_obs as (
  select
    ranked_prev.product_id,
    ranked_prev.price         as previous_price,
    ranked_prev.observed_date as previous_date
  from (
    select
      ph.product_id,
      ph.price,
      ph.observed_date,
      row_number() over (
        partition by ph.product_id
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
  p.chipset,
  p.sku,
  p.ean,
  p.name,
  p.name_en,
  p.brand,
  p.url,
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
  (
    coalesce(c.current_warehouse_stock, 0) > 0
    or coalesce(c.current_local_stock, 0) > 0
    or exists (
        select 1
          from jsonb_each_text(coalesce(c.current_shop_stock, '{}'::jsonb)) as g(key, value)
         where g.value ~ '^[0-9]+$' and g.value::integer > 0
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
join bounds        b    on b.product_id = p.id
join start_obs     s    on s.product_id = p.id
join current_obs   c    on c.product_id = p.id
left join previous_obs prev on prev.product_id = p.id;

comment on view public.product_price_summary is
  'Per-product derived price statistics used by list/deals/status pages. start_price = earliest observation in our DB.';

grant select on public.product_price_summary to anon, authenticated;
