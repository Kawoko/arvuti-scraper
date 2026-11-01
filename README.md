# Arvutitark Price Tracker

Historical price tracking for PC components at the Estonian retailer
[Arvutitark](https://arvutitark.ee). It tracks five **independent groups**:
desktop DDR5 RAM, 16 GB current-generation graphics cards, current-generation
CPUs, 1–5 TB hard drives, and 3500+ MB/s SSDs.

Each group has its own filters, its own stored rows and its own reporting, so
enabling or refreshing one can never overwrite another. Collection runs **twice a
day**. Motherboards and PSUs can be added the same way without restructuring
anything.

Signed-in visitors can **star any product** and get their own tracked list across
every group. Alert preferences (percentage drop, email and webhook choices) are
saved per account; the delivery workers themselves are not implemented yet.

The point of the project is a genuine **price history**. Arvutitark's own
`original_price` field is not a history — it is whatever the shop currently
chooses to display. This app records one observation per product per day and
never overwrites those rows, so "is this actually cheap?" becomes answerable.

---

## Screenshots

> _Placeholder — add screenshots of the RAM list, the product detail chart, the
> deals page and the tracked page here._

| Page | Description |
| --- | --- |
| `/` | Filterable RAM list with compact stats, dense desktop table and mobile cards |
| `/ram/[id]` | Product detail with a daily price history chart and availability breakdown |
| `/deals` | Products ranked by reduction from our own recorded starting price |
| `/tracked` | The signed-in user's starred products and alert preferences |

---

## Tracked categories

Every group is collected within whichever daily slot is claimed. Adding a group
costs one entry in [`lib/categories.ts`](lib/categories.ts:1) and a spec
extractor in `lib/arvutitark/normalize.ts` — and nothing else, because the routes
and navigation are generated from that registry.

| Category | Route | Arvutitark category | Attribute filter | Tracked set |
| --- | --- | --- | --- | --- |
| RAM | `/` | `20` | `28[5600﹑6000];178[DDR5];181[UDIMM]` | Desktop DDR5 UDIMM, 5600 & 6000 MHz |
| GPUs | `/gpu` | `18` | `15[16];110[…chipsets…]` | 16 GB RTX 5050–5090, RX 7000/9060 XT/9070/9070 XT, Intel Arc |
| CPUs | `/cpu` | `15` | `19[…families…];102[…sockets…]` + `brands=intel,amd` | Ryzen 5/7/9 (AM5) and Core Ultra 5/7/9 (LGA 1851) |
| HDDs | `/hdd` | `137` | `25[1000﹑-﹑5000]` | 1–5 TB mechanical drives |
| SSDs | `/ssd` | `139` | `23[864﹑-﹑31458];185[3500﹑-﹑14900];186[3500﹑-﹑14000]` | 3500+ MB/s read and write |

The former hard-coded **Custom** group has been removed. `/custom` and
`/custom/[id]` now redirect to `/tracked` so old bookmarks keep working.

### User tracking

Every product row and detail page carries a star. Starring a product inserts one
row into `public.tracked_products` for the signed-in user, keyed by
`(user_id, product_id, category)`. The current price at that moment is recorded as
`price_at_tracking`, which lets `/tracked` show how far the price has moved since
the user started following it.

`/tracked` also stores alert preferences in `public.notification_settings`:

- minimum drop percentage (default 10%)
- email on/off and address (kept for later);
- generic webhook on/off and URL;
- Discord webhook URL.

**Nothing is delivered yet.** The preferences are written so the email and
webhook workers can be added later without a schema change. The schema and RLS
policies are in
[`20260921000007_user_tracking.sql`](supabase/migrations/20260921000007_user_tracking.sql:1).

**Authentication.** Login is passwordless: a Supabase magic link is emailed, then
exchanged for a cookie session in `/auth/callback`. Middleware refreshes the
session before each request. The signed-in user only ever sees their own rows,
enforced by RLS rather than by application code.

### Deals per group

`/deals` has a **group selector** (`?group=`) so each category can be reviewed on
its own instead of everything being pooled into one list:

```
/deals                       all groups
/deals?group=ssd             SSD deals only
/deals?group=gpu&tab=new_lows  GPU deals at a historical low
```

`All groups` is the default. The selected group is preserved when switching the
deal tab, and clicking any deal card opens that product under **its own** group,
since the same numeric id means a different product in a different group. When
viewing all groups, each card carries a small badge showing which group it came
from.

The GPU chipset filter is a whitelist built from
[`ARVUTITARK_GPU_CHIPSETS`](lib/arvutitark/config.ts:95). Products are additionally
checked locally, so a card the retailer files outside the whitelist is dropped
rather than stored.

**Multi-value separator.** Both filters separate multiple values with **U+FE50
SMALL COMMA**, not an ASCII comma — see the debugging section below.

**Chipset value encoding.** Arvutitark's own URLs percent-encode spaces (`%20`)
and trademark symbols (`%E2%84%A2`), and the browser then encodes the `%` again.
That double encoding is reproduced deliberately in
[`encodeAttributeValue()`](lib/arvutitark/config.ts:70), because a filter containing
spaces or `™` only matches when it is byte-identical. Verify it with
`npm run scrape:url` before trusting the result.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js (App Router) + React, Server Components by default |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 with shadcn/ui-style primitives |
| Charts | Recharts |
| Validation | Zod |
| Database | PostgreSQL via Supabase |
| Client | `@supabase/supabase-js` |
| Auth | Supabase Auth magic links + `@supabase/ssr` cookie sessions |
| Scraper runtime | Node.js `fetch` + `tsx` |
| Tests | Vitest |
| Quality | ESLint + Prettier |

No queues, no Redis, no Docker microservices, no background workers. One Next.js
app plus one scheduled Node script.

---

## Project structure

```
app/
  layout.tsx                 Root layout, theme provider
  page.tsx                   RAM price list (main page, at /)
  ram/page.tsx               Alias -> /
  [category]/page.tsx        Listing for /gpu, /cpu, /hdd, /ssd
  [category]/[id]/page.tsx   Product detail + history chart, any group
  deals/page.tsx             Deals, URL-driven tabs
  tracked/page.tsx           Signed-in user's starred products + alerts
  login/page.tsx             Magic-link sign in
  auth/callback/route.ts     Exchanges the magic-link code for a session
  api/products/route.ts      One batch of rows for progressive loading
  custom/                    Redirects the removed group to /tracked
  error.tsx / not-found.tsx  Error and empty boundaries
  */loading.tsx              Skeleton loading states

components/
  auth/                      Login form, sign-out button
  charts/                    Recharts price history chart (client)
  filters/                   Filter toolbar and URL tab links
  layout/                    Header, footer, theme provider/toggle, page shell
  products/                  Table, cards, stars, stat strip, progressive browser
  tracked/                   Tracked table, alert preferences form
  ui/                        Button, Card, Input, Badge, Select, Table, Skeleton…

lib/
  arvutitark/
    client.ts                Typed API client, pagination, defensive parsing
    config.ts                Attribute ids, per-category filters, env settings
    normalize.ts             Spec parsing + product normalization per category
    types.ts                 Raw + normalized types
    validation.ts            Zod schema for the ingest payload
  auth.ts                    Safe post-login redirect helper
  browser-cache.ts           localStorage cache for loaded product batches
  categories.ts              Group registry driving scraper, queries, routes and UI
  product-page.ts            Shared product-detail loaders and metadata
  queries/                   Read layer, including per-user tracked items
  scraper/run.ts             Scrape orchestration + daily-claim guarantee
  supabase/auth-server.ts    Cookie-aware Supabase client for user data
  supabase/middleware.ts     Session refresh helper
  supabase/admin.ts          Privileged client (server-side only)
  supabase/server.ts         Read-only client for Server Components
  dates.ts                   Europe/Tallinn calendar helpers
  filters.ts                 URL filter contract
  format.ts / price.ts       Formatting and percentage maths
  presentation.ts            Row -> view-model helpers
  tracking.ts                Composite (category, product id) key

middleware.ts                Refreshes the auth session on every request
scripts/scrape.ts            Runnable scraper entry point
supabase/migrations/         SQL schema, functions and views
tests/                       Vitest suites + JSON fixtures
types/database.ts            Supabase database types
```

---

## Local setup

Requirements: **Node.js 20.9+** and a Supabase project.

```bash
npm install
cp .env.example .env.local     # then fill in the values
npm run dev                    # http://localhost:3000
```

### Development commands

```bash
npm run dev          # start the dev server
npm run build        # production build
npm run start        # serve the production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run format       # Prettier write
npm run test         # Vitest (167 tests)
npm run scrape       # run the scraper once (respects the daily claim)
npm run scrape:url   # print the exact API request without contacting Arvutitark
```

---

## Environment variables

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | Read-only (RLS) access from the server |
| `SUPABASE_SECRET_KEY` | **secret** | Service role; bypasses RLS. Server-side only |
| `NEXT_PUBLIC_SITE_URL` | public | Optional canonical origin for magic links, e.g. `https://tracker.example.com`. Defaults to the request host in development |
| `ARVUTITARK_BASE_URL` | server | Products endpoint (defaults to `https://cms.arvutitark.ee/api/products`) |
| `ARVUTITARK_REQUEST_TIMEOUT_MS` | server | Per-request timeout, default `20000` |
| `ARVUTITARK_PAGE_DELAY_MS` | server | Politeness delay between pages, default `750` |
| `ARVUTITARK_MAX_PAGES` | server | Safety ceiling, default `50` |
| `SCRAPER_DEBUG` | server | `true` for verbose request/response logging. Never logs secrets |
| `ARVUTITARK_GPU_ATTRIBUTES` | server | Overrides the graphics card filter. Set to `15[16]` to drop the chipset whitelist if it ever stops matching |
| `SCRAPER_GROUPS` | server | Comma-separated groups to collect. Defaults to all five. Useful for exercising one group in isolation, e.g. `SCRAPER_GROUPS=cpu` |

`.env.local` is gitignored. `.env.example` contains placeholders only.

---

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Copy the project URL, the publishable/anon key and the secret (service role) key
   into `.env.local`.

### Running the SQL migrations

The migrations are plain SQL and idempotent (`create table if not exists`,
`create or replace function`, `create or replace view`), so they can be applied
either way.

**Option A — Supabase SQL editor (simplest):**

Open the SQL editor and run, in order:

1. `supabase/migrations/20260921000001_init.sql`
2. `supabase/migrations/20260921000002_functions.sql`
3. `supabase/migrations/20260921000003_views.sql`
4. `supabase/migrations/20260921000004_groups_and_slots.sql`
5. `supabase/migrations/20260921000005_grouped_summary_view.sql`
6. `supabase/migrations/20260921000006_availability.sql`
7. `supabase/migrations/20260921000007_user_tracking.sql`

**Option B — Supabase CLI:**

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

> **Applying the group, twice-daily, availability and user-tracking changes.** Run
> `20260921000004_groups_and_slots.sql` (second daily slot, per-category spec
> columns, and the composite `(id, category)` identity), then
> `20260921000005_grouped_summary_view.sql` (rebuilds the summary view on that
> identity), then `20260921000006_availability.sql` (adds `latest_scrape_date`,
> `last_seen_date` and `is_delisted` to the view), then
> `20260921000007_user_tracking.sql` (starred products, alert preferences and the
> `tracked_product_details` view). Run them **in that order** — `0007` must run
> last. Every migration is additive and safe to re-run, and `0004` prints a notice
> if it cannot build a uniqueness guarantee.
>
> **Auth is required for `/tracked`.** In the Supabase dashboard, enable
> **Authentication → Providers → Email**, and add
> `http://localhost:3000/auth/callback` (plus your production
> `https://…/auth/callback`) to **Authentication → URL Configuration → Redirect
> URLs**. Magic links sent to an unlisted redirect URL are rejected by Supabase.

### What the migrations create

**`scrape_runs`** — one row per Tallinn calendar day, primary key on `scrape_date`.
This table is both the atomic daily lock and the persistent fetch log. Columns:
`scrape_date`, `attempted_at`, `finished_at`, `status` (`running` / `completed` /
`failed`), `product_count`, `page_count`, `error_message`.

**`products`** — current metadata keyed by the Arvutitark numeric product id:
`id`, `retailer`, `category`, `chipset`, `sku`, `ean`, `name`, `name_en`, `brand`,
`url`, `first_seen_at`, `last_seen_at`, plus normalized fields `memory_type`,
`capacity_gb`, `speed_mhz`, `cas_latency`, `module_count`,
`capacity_per_module_gb`, `form_factor`, `voltage`. Nullable by design — a value
is left `null` rather than guessed.

**`price_history`** — append-only observations with a `unique (product_id,
observed_date)` constraint: `price`, `original_price`,
`source_price_updated_at`, `warehouse_stock`, `local_stock`, `shop_stock` (jsonb).

**`claim_scrape_run(date) -> boolean`** — inserts today's row with `on conflict do
nothing` and reports whether *this* caller won the claim. Race-free.

**`finish_scrape_run(date, status, counts, error)`** — records the terminal state.
The row is never deleted.

**`ingest_snapshot(date, jsonb) -> jsonb`** — one atomic transaction that upserts
product metadata and inserts the day's observations with `on conflict … do
nothing`. History is never rewritten.

**`product_price_summary`** (view) — per-product derived statistics used by the
list and deals pages: `start_date`, `start_price`, `current_date`,
`current_price`, `price_change`, `price_change_percent`, `lowest_price`,
`highest_price`, `average_price`, `previous_*` and `day_change*` for today's
movement, current stock, and the `is_below_start_price` / `is_above_start_price` /
`is_at_historical_low` flags.

It also exposes the availability fields added by `20260921000006`:
`latest_scrape_date` (the most recent completed run), `last_seen_date` (the last
collection that actually returned the product) and `is_delisted` (true when the
retailer stopped returning it). A delisted product is **flagged, never deleted**,
so its history survives and it becomes active again if Arvutitark relists it.
Delisted products are also forced out of `in_stock`, because their stock figures
are frozen at the last collection that saw them.

**`tracked_products`** — one row per `(user_id, product_id, category)`, plus
`price_at_tracking` and `created_at`. `20260921000007` enables RLS with
select/insert/update/delete policies that all require `auth.uid() = user_id`.

**`notification_settings`** — one row per user with
`price_drop_percent`, `email_enabled`, `email_address`, `webhook_enabled`,
`webhook_url` and `discord_webhook_url`. Same per-user RLS.

**`tracked_product_details`** (view) — `tracked_product_details` joins the
caller's tracked rows to the live price summary. It is declared
`security_invoker = true`, so the base-table RLS applies and one user can never
read another user's favourites.

> **Terminology.** `start_price` is the price at the *earliest observation in our
> own database*. `original_price` is Arvutitark's own field. They are different
> things and are never conflated.

### Security model

- The catalogue tables (`products`, `price_history`, `scrape_runs`) keep
  **select-only** policies for `anon` and `authenticated`; the user-facing key
  cannot write catalogue data.
- Catalogue writes go through `security definer` functions whose `execute`
  privilege is revoked from `public`/`anon`/`authenticated` and granted only to
  `service_role`.
- `tracked_products` and `notification_settings` are writable by `authenticated`,
  but every policy pins the row to `auth.uid()`. The client can only touch its own
  data.
- The app reads public catalogue data through Server Components and per-user data
  through a cookie-aware Supabase client, so keys never leave the server.
- Magic-link sessions are stored in `httpOnly` cookies and refreshed by
  `middleware.ts`.

---

## Running a manual scrape

```bash
npm run scrape
```

Typical output:

```
[scrape] Tallinn scrape date: 2026-09-21
[scrape] Daily slot claimed. Contacting Arvutitark.
[scrape] Page 1/1: 182 products
[scrape] Fetched 182 unique products across 1 page(s).
[scrape] Ingested 182 product(s); 182 price observation(s) recorded.
[scrape] Run for 2026-09-21 completed successfully.
```

Running it a second time on the same Estonian day:

```
[scrape] Tallinn scrape date: 2026-09-21
[scrape] Scrape already claimed for 2026-09-21. Exiting without contacting Arvutitark.
```

---

## Sorting and filters

Every filter, the sort column and the sort direction live in the URL, so any view
is shareable and bookmarkable.

**Sorting.** On desktop, click any column header to sort by it; click it again to
reverse the direction. The active header shows `^` for ascending or `v` for
descending, and inactive headers show a faint `↕`. The direction is also exposed
to screen readers through `aria-sort`. On mobile (where cards replace the table)
the **sort** control in the toolbar does the same job, and the toolbar always
prints the current ordering as "Sorted by …".

Each column has a sensible first-click direction: price, start price and lowest
price sort ascending (cheapest first), speed sorts descending (fastest first),
last-updated sorts descending (newest first), and price change sorts ascending so
the biggest drop appears first.

| Column header | URL | Sorts by |
| --- | --- | --- |
| Product | `sort=name` | Product name |
| Current | `sort=price` | Latest recorded price |
| Start | `sort=start` | Our first recorded price |
| Change | `sort=change` | Percentage change from the starting price |
| Lowest | `sort=lowest` | Lowest recorded price |
| Last updated | `sort=updated` | Most recent observation |

The toolbar's sort control additionally exposes orderings that have no column
header: lowest CL (`sort=cl`) and highest speed (`sort=speed`).

Direction is a separate parameter (`dir=asc` or `dir=desc`) and defaults to `asc`,
so URLs stay short. Anything at its default is omitted entirely. Changing the
sort or any filter resets to page 1, and "Clear filters" deliberately keeps the
chosen sort order.

## Debugging the scraper

### Verify the request without contacting Arvutitark

```bash
npm run scrape:url
```

Prints the exact URL the scraper will request, the decoded attribute filter with
U+FE50 rendered as `\uFE50`, and encoding checks:

```
Attributes filter (with U+FE50 shown as an escape):
  28[5600\uFE506000];178[DDR5];181[UDIMM]

Request URL:
  https://cms.arvutitark.ee/api/products?page=1&perPage=200&sort=price-asc&attributes=28%5B5600%EF%B9%906000%5D%3B178%5BDDR5%5D%3B181%5BUDIMM%5D&categories=20&locale=et

Encoding checks:
  contains %EF%B9%90 (correct U+FE50) : true
  contains %2C       (wrong ASCII comma): false
```

The multi-value filter **must** separate `5600` and `6000` with U+FE50 SMALL
COMMA, not an ASCII comma. An ASCII comma makes the API match nothing and return
an empty result set. The command exits non-zero if an ASCII comma is detected.

No shop availability filter is ever sent, so out-of-stock products are still
tracked, and a product that disappears from the shop keeps its last price and
history rather than being deleted. The list page's **Availability** selector can
narrow to `In stock only`, `Out of stock`, or `No longer listed`; delisted
products show a distinct "No longer listed" badge on the table, cards and detail
page.

### Verbose logging

```bash
SCRAPER_DEBUG=true npm run scrape
```

Adds the request URL, HTTP status and pagination metadata for each page. It never
logs credentials, environment variables or product bodies (which can be tens of
thousands of rows). A zero-product response is always reported with its metadata,
even when debug is off, because that is the exact symptom of a wrong filter.

### Expected output of a successful run

```
[scrape] Tallinn scrape date: 2026-09-21
[scrape] Daily slot claimed. Contacting Arvutitark.
[scrape] Page 1/1: 182 products
[scrape] Fetched 182 unique products across 1 page(s).
[scrape] Raw products: 182
[scrape] Normalized/usable: 182
[scrape] Outside criteria: 0
[scrape] Invalid: 0
[scrape] Snapshot rows: 182
[scrape] Ingested 182 product(s); 182 price observation(s) recorded.
[scrape] Run for 2026-09-21 completed successfully.
[scrape] Outcome: completed
```

The five `Raw products` / `Normalized/usable` / `Outside criteria` / `Invalid` /
`Snapshot rows` lines are the diagnostic summary. When `Snapshot rows` is `0` the
failure message names the phase responsible:

| Message | Meaning |
| --- | --- |
| `returned 0 products (data.length = 0)` | The API accepted the request but matched nothing — almost always a filter or query-parameter problem |
| `none could be normalized` | Products arrived but the product shape changed |
| `all N were outside the tracked RAM criteria` | Products arrived but were filtered out (wrong speeds, laptop SODIMM, etc.) |

A run with zero usable products is always marked `failed`; an empty snapshot is
never recorded as a successful collection.

### If the API still returns zero products

1. Run `npm run scrape:url` and confirm `contains %EF%B9%90` is `true` and
   `contains %2C` is `false`.
2. Paste the printed URL into a browser. If the browser returns products but our
   request does not, diff the two query strings.
3. Run `SCRAPER_DEBUG=true npm run scrape` and read the `root keys:` line. If
   `data.length` is non-zero while `Snapshot rows` is `0`, the payload shape
   changed — compare it against `tests/fixtures/arvutitark-real-page.json`.
4. Check `total` versus `data.length`. `total = 0` means the filter matched
   nothing; a non-zero `total` with `data.length = 0` means `page`/`perPage` is
   wrong.
5. Confirm `Accept: application/json` and `X-Arv-Country: est` are still accepted
   — they are the only headers sent.
6. If only the GPU category fails, the chipset whitelist is the likely culprit
   (it is the one filter containing spaces and `™`). Compare the printed URL
   against the browser's request character for character, and if it still does
   not match, drop the whitelist with `ARVUTITARK_GPU_ATTRIBUTES=15[16]` to track
   all 16 GB cards. Chipset filtering then falls back to the local allow-list
   check, so off-list models are still rejected before storage.

### Clearing a claim for development testing

The scraper will not fetch twice in one Tallinn slot, by design. If you
explicitly want to re-run a slot after a fix, clear it by hand in the Supabase SQL
editor. This is deliberately manual: nothing in the app or the scheduler ever
deletes a claim.

```sql
-- Inspect recent runs first.
select scrape_date, slot, status, product_count, error_message, attempted_at
from scrape_runs
order by scrape_date desc, slot desc
limit 10;

-- Clear ONLY today's (Europe/Tallinn) first slot so it can be claimed again.
-- Drop `and slot = 1` to clear both slots.
-- The `status <> 'completed'` guard refuses to delete a run that succeeded.
delete from scrape_runs
where scrape_date = '2026-09-23'
  and slot = 1
  and status <> 'completed';
```

Notes:

- Price observations for that day are protected by
  `unique (product_id, category, observed_date)`. Re-running the same slot
  refreshes product metadata and inserts **zero** new observations, so history is
  never duplicated or rewritten.
- Clearing slot 1 does not let slot 2 repeat: the `(scrape_date, slot)` primary
  key still holds slot 2's own row.
- Do not automate this. The twice-daily guarantee depends on failed rows staying
  in place.

## How the twice-daily mechanism works

This is the most important behaviour in the project. The scraper may be invoked
as often as you like; it will contact Arvutitark **at most twice per
`Europe/Tallinn` calendar day**, because shops do change prices more than once a
day.

Each day has two slots, and every group is collected within whichever slot is
claimed:

- **Slot 1** is available at any time from midnight Tallinn.
- **Slot 2** needs two things: it must be noon or later in Tallinn, and at least
  four hours must have passed since slot 1 was attempted. The gap stops a late
  start from turning into two runs an hour apart, while still allowing a second
  sample after downtime.

```
claim the next available slot in Supabase
        (INSERT ... ON CONFLICT (scrape_date, slot) DO NOTHING)
              ↓
        slot claimed?
   none →  STOP. Do not contact Arvutitark.       (exit 0)
   error → STOP. Do not contact Arvutitark.       (exit 1; database unreachable)
   slot ↓
        for each enabled group: fetch Arvutitark (all pages, gently)
              ↓
        ingest each group's snapshot atomically
              ↓
        mark the run completed for that slot
```

Properties this gives us:

- **The claim is written first.** If the process crashes at any later point, the
  row is already committed and that slot stays claimed.
- **Failures are recorded, not deleted.** A failed run is marked `failed` and is
  never retried for that slot. There is no delete path anywhere.
- **Local memory is never the lock.** The guarantee lives entirely in a database
  key on `(scrape_date, slot)`, so it survives restarts, redeploys and multiple
  machines.
- **Supabase unreachable ⇒ no retailer traffic.** The scraper aborts before
  making any external request.
- **Adding a group does not add a fetch opportunity.** Every group shares the
  same two daily slots.
- **One observation per product, per group, per day.** Duplicate observations
  are additionally impossible thanks to
  `unique (product_id, category, observed_date)`.

Worked example — a machine that was offline all morning:

```
06:00  machine offline
07:00  machine offline
08:20  machine starts
09:00  scheduled invocation → claims slot 1 → performs the first scrape
10:00  scheduled invocation → no slot (slot 2 needs noon + a 4h gap)
12:00  scheduled invocation → no slot (only 3h since slot 1)
13:00  scheduled invocation → claims slot 2 → performs the second scrape
14:00  scheduled invocation → both slots taken → exits, no request
```

---

## Scheduler setup

Because the scraper enforces the daily limit itself, the scheduler only needs to
run **hourly**. `.github/workflows/scrape.yml` is included and does exactly that.

1. Push this repository to GitHub.
2. Add repository secrets (**Settings → Secrets and variables → Actions → Secrets**):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SECRET_KEY`
3. Optionally add repository *variables*: `ARVUTITARK_BASE_URL`,
   `ARVUTITARK_REQUEST_TIMEOUT_MS`, `ARVUTITARK_PAGE_DELAY_MS`,
   `ARVUTITARK_MAX_PAGES`.
4. The workflow runs on `cron: "0 * * * *"` and also supports
   **workflow_dispatch** for manual runs.

Notes:

- GitHub cron is UTC. That is fine — the scraper computes the Tallinn date itself.
- A `concurrency` group prevents two scrape jobs overlapping.
- GitHub may delay scheduled runs under load; hourly cadence absorbs that.
- **Actions secrets are never printed** and the secret key is only ever exposed to
  the scraper step.

Alternative schedulers work the same way: any system that can run
`npm run scrape` hourly (cron, systemd timer, Windows Task Scheduler, a Vercel
Cron hitting a route handler) is compatible.

---

## Deployment

**Frontend (Vercel):**

1. Import the repository into Vercel.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `SUPABASE_SECRET_KEY` and (for stable magic-link URLs) `NEXT_PUBLIC_SITE_URL`
   as environment variables.
3. Add the deployment's `/auth/callback` URL to Supabase Auth → URL Configuration.
4. Deploy. All data pages are rendered dynamically on the server, so no build-time
   database access is required.

**Error boundaries:** `app/error.tsx` shows a generic message and a retry button.
Stack traces, database details and credentials are never rendered.

---

## Performance and caching

- The list and deals pages read only `product_price_summary`, never the full
  history.
- Full `price_history` is queried **only** on a product detail page, and only for
  that one product.
- Filter option lists (the catalogue metadata) are cached server-side for five
  minutes with `unstable_cache`; prices are never cached there.
- The first listing page is server-rendered. Further pages arrive in batches of
  24 through `/api/products` when the visitor scrolls near the end, or on demand.
  At most two batches load automatically per visit; the rest is an explicit
  "Load more", so a fast connection never pulls the whole catalogue in one go.
- Each loaded batch is stored in `localStorage`
  (`lib/browser-cache.ts`, ten-minute TTL, capped at 12 pages). Returning to the
  same view reuses those rows instantly and marks the list as partly cached;
  prices still revalidate from the API on the next batch request.
- The Next.js router cache keeps visited pages for 30 seconds
  (`experimental.staleTimes` in `next.config.ts`).
- Indexes cover `(product_id, observed_date)`, `observed_date`, the product facet
  columns used by filters, and `tracked_products (user_id, created_at desc)`.
- Server Components mean only rendered data crosses to the browser. The
  per-user star query returns only `(product_id, category)` pairs.

---

## Tests

```bash
npm test
```

Coverage includes:

- **RAM attribute parsing** — `"6000 MHz"`, `"5200 MHz (PC5-41600)"`, `"CL46 (46-45-45)"`,
  `"2 x 16 GB"`, `"UDIMM"` vs `"SODIMM"`, voltage, and bare-number attributes.
- **Tallinn date calculation** — summer/winter offsets and the UTC midnight boundary.
- **Product normalization** — ID coercion, URL building, stock maps, null-not-invented specs.
- **Group criteria** — RAM/GPU filtering and the strict declared-category check.
- **Price percentage calculation** — decreases, increases, unchanged, and null cases.
- **Duplicate product handling** — dedupe by retailer id across pages.
- **Pagination** — following `last_page`, page ceilings, empty pages, HTTP failures,
  non-JSON responses and timeouts.
- **Daily scrape claim behaviour** — that a claimed day, an unreachable database and
  a failed fetch all result in **zero** Arvutitark requests, and that failures are
  recorded without being retried.

Fixtures live in `tests/fixtures/` so no test ever touches the live Arvutitark API.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `column "retailer" does not exist` while running `_init` | `products` / `price_history` already exist from an earlier scraper, so `create table if not exists` was skipped | Already handled: the migration is additive and adds every missing column. Re-run `20260921000001_init.sql`. If you would rather start clean, see "Starting over" below |
| `public.products has NOT NULL columns ...` notice | A legacy column is NOT NULL without a default and our ingest does not populate it | Follow the notice: `alter table public.products alter column <col> drop not null;` (or give it a default), then ingest again |
| `public.price_history: could not create the (product_id, observed_date) uniqueness guarantee` notice | The pre-existing history table contains duplicate product/day rows | Run the `delete from price_history a using price_history b ...` statement printed in the notice, then re-run the migration |
| `npm ci` fails with `Missing: <pkg> from lock file` | The lockfile was last written by an incremental `npm install` on a different platform, which can leave optional (platform-specific) subtrees unrecorded — `npm ci` on Linux then rejects it | Delete `node_modules` **and** `package-lock.json`, then run `npm install` so npm does a full registry resolve, and commit the regenerated lock. Do not fix it by hand-editing the lock |
| `Missing NEXT_PUBLIC_SUPABASE_URL` | Env not loaded | Ensure `.env.local` exists; the scraper loads it via `dotenv` |
| `Could not claim the daily scrape slot` | Supabase unreachable or bad key | Check the project URL and `SUPABASE_SECRET_KEY`; no retailer traffic is sent while this fails |
| Status page shows `permission denied for function` | Migrations not fully applied | Re-run `0002_functions.sql` (the `grant execute … to service_role` statements) |
| List page is empty although a scrape succeeded | View not created | Re-run `0003_views.sql` (and `0005`/`0006` if upgrading) |
| `/tracked` fails with `relation "tracked_products" does not exist` | User-tracking migration not applied | Run `20260921000007_user_tracking.sql` in the Supabase SQL editor |
| Magic link opens `/login?error=…` | Redirect URL not allow-listed, or the link expired | Add `/auth/callback` to Supabase Auth → URL Configuration → Redirect URLs, then request a new link |
| Magic link email never arrives | Email provider disabled or rate-limited | Enable the Email provider in Supabase; check Auth logs. The UI reports rate limits explicitly |
| Run is stuck on `running` | Process was killed after claiming | Expected and safe — the day stays claimed. Inspect the row, or clear it manually if you really need to recollect |
| `Arvutitark responded with HTTP 503` | Retailer outage | Nothing to do; the run is marked failed and will resume tomorrow |
| Chart shows a single point | Only one day of history exists so far | Wait for more daily runs |

### Starting over

`20260921000001_init.sql` is additive, so the normal fix is simply to re-run it.
If the legacy tables are unusable (wrong column types, stray NOT NULL columns,
duplicate history) and you have no data worth keeping, reset them instead:

```sql
-- DESTRUCTIVE: drops all collected price history and product metadata.
drop view  if exists public.tracked_product_details;
drop view  if exists public.product_price_summary;
drop table if exists public.notification_settings cascade;
drop table if exists public.tracked_products     cascade;
drop table if exists public.price_history       cascade;
drop table if exists public.products            cascade;
drop table if exists public.scrape_runs         cascade;
drop function if exists public.claim_scrape_run(date);
drop function if exists public.finish_scrape_run(date, text, integer, integer, text);
drop function if exists public.ingest_snapshot(date, jsonb);
drop function if exists public.touch_updated_at();
```

Then re-run all seven migrations in order. Inspect the legacy shape first if you
are unsure whether it is worth keeping:

```sql
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('products', 'price_history', 'scrape_runs')
order by table_name, ordinal_position;
```

Useful queries:

```sql
-- What does the daily lock look like right now?
select scrape_date, status, product_count, page_count, error_message
from scrape_runs order by scrape_date desc limit 10;

-- How much history exists per product?
select count(*) as observations, min(observed_date), max(observed_date)
from price_history;

-- Verify the history is immutable: there should be no duplicates.
select product_id, observed_date, count(*)
from price_history
group by 1, 2 having count(*) > 1;
```

---

## Security notes

- **The Supabase secret key must never be exposed client-side and must never be
  committed.** It bypasses Row Level Security. It is read only from
  `process.env.SUPABASE_SECRET_KEY`, is never prefixed with `NEXT_PUBLIC_`, and is
  never imported by a Client Component.
- `lib/supabase/admin.ts` is the only module that uses the secret key, and it is
  imported exclusively from the scraper script. Server Components and all user
  requests read through the publishable key.
- `.env.local` and all `.env*` variants are gitignored; `.env.example` holds
  placeholders only.
- Catalogue writes use `security definer` functions granted to `service_role`
  alone. User data tables are writable by `authenticated`, but each policy requires
  `auth.uid() = user_id`.
- Users are never shown stack traces, database credentials, environment values or
  raw error objects — only short, sanitised messages.
- **Rotate any credentials that were exposed during development.** If a secret key
  was ever pasted into a client bundle, a screenshot, a chat message or a commit,
  regenerate it in the Supabase dashboard (Settings → API) and update the GitHub
  secret. Assumption going in: previously exposed credentials are rotated.

---

## Adding another component category

Graphics cards were added this way, so the path is proven. It takes four small
changes:

1. **Config** — add the category id and attribute filter to
   [`lib/arvutitark/config.ts`](lib/arvutitark/config.ts:1), and register the
   category id in `ARVUTITARK_CATEGORY_BY_ID`.
2. **Normalizer** — add an `extract<Category>Specs` function and a criteria check
   in [`lib/arvutitark/normalize.ts`](lib/arvutitark/normalize.ts:1), then extend
   `extractSpecs` and `matchesCategoryCriteria`. Reuse the shared `ProductSpecs`
   shape rather than adding a parallel type.
3. **Registry** — add one entry to
   [`lib/categories.ts`](lib/categories.ts:1) with its label, routes and which
   spec filters apply. The scraper loop, the query layer and the UI all read from
   this.
4. **Route** — add `app/<category>/page.tsx` and `app/<category>/[id]/page.tsx`,
   both a few lines, delegating to `CategoryListing` and `ProductDetailView`.

Schema work is only needed if the category has a field the shared columns cannot
express — that is why GPUs needed one new column (`products.chipset`) and nothing
else. `products.retailer` and `products.category` already exist so a second
retailer needs no restructuring. Cross-retailer comparison is intentionally *not*
built yet; `sku` and `ean` are stored so it can be added later.
