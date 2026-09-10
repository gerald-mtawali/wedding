# `db/registry/`

Registry items and the products we have looked at for each. Same convention as
`db/guests/`: numbered, idempotent, committed, applied local-then-remote.

| File | What it is | Re-runnable? |
| --- | --- | --- |
| `001-schema.sql` | Rebuilds `registry_items`, adds `registry_item_options`. | yes, but it drops and recreates — see below |
| `002-items.sql` | The initial list: 25 item types, 69 product links. | **yes**, inserts nothing on a second run |

`001` is a rebuild, not a migration. Re-running it always lands in the same
state, but that state is *empty* — anything added by hand and not written into
a numbered file is lost. Add new items as `003-*.sql`.

## Apply

```bash
cd api

# 1. Precheck. BOTH must return 0 before you run anything.
npm run db:sql        -- "SELECT COUNT(*) AS pledges FROM registry_pledges"
npm run db:remote:sql -- "SELECT COUNT(*) AS pledges FROM registry_pledges"

# 2. Local
npx wrangler d1 execute wedding --local --file=../db/registry/001-schema.sql
npx wrangler d1 execute wedding --local --file=../db/registry/002-items.sql

# 3. Check the API still answers
npm run dev &
curl -s http://127.0.0.1:8787/api/registry | head -c 400

# 4. Remote
npm run db:backup
npx wrangler d1 execute wedding --remote --file=../db/registry/001-schema.sql
npx wrangler d1 execute wedding --remote --file=../db/registry/002-items.sql
npm run db:remote:sql -- "SELECT category, COUNT(*) FROM registry_items GROUP BY category"
```

`registry_pledges.item_id` is a foreign key to `registry_items`, and D1
enforces foreign keys by default. If pledges exist, `001` fails on the
`DROP TABLE` with `FOREIGN KEY constraint failed` and changes nothing — the
database protecting real data, not a bug.

## The model

`registry_items` is a list of the **kinds** of thing we would love — a kettle,
cutlery, curtains. `registry_item_options` holds the **specific products** we
have looked at for each one, labelled `Quality focused`, `Cost focused`,
`Balanced` or `Caught our eye`.

Nobody has to buy the exact product in a link. That separation is the whole
point: the page says "we'd love a kettle, and here are three we like" rather
than "buy this kettle".

## Two constraints worth knowing

**`UNIQUE (registry_items.name)`** is load-bearing. It makes `002` idempotent,
and it is how every option row in `002` finds its parent — by name, in a
scalar subquery, so the file reads on its own and needs no generated ids.

**`UNIQUE (registry_item_options.item_id, url)`, not `(item_id, label)`.**
Several cells in the source spreadsheet hold two links in one column — "Cost
focused" for Cutlery has both the St James and the Slimline set, and Dinner
Plates has two in all three columns. A unique index on `(item_id, label)` would
silently swallow the second link of every pair under `INSERT OR IGNORE`, and
the loss would be invisible. The same URL under two *different* items is
allowed and is real: the Kenwood Multipro is listed under both Blender and Food
Processor because it is both.

## Prices are internal

`price_cents`, `price_max_cents` and `currency` exist on both tables for
budgeting. They must never reach the browser.

The guard belongs in the SELECT list of the query, not in a mapping function —
a column that is never fetched cannot be accidentally serialised later. Same
discipline as `rsvps.phone`.

**`api/src/routes/registry.ts` currently selects `price_cents` and `currency`.**
Drop them from that SELECT before the page goes live, and check it:

```bash
curl -s http://127.0.0.1:8787/api/registry | grep -i -E 'price|cents|currency'
```

That must print nothing.

## What is deliberately not loaded

Store homepages and category/browse pages from the "Alternative Stores"
section — Linen House, Boardmans, the Hertex Haus and Babylonstoren front
pages, the Bash and Woolworths curtain categories, an Amazon node, a Yuppiechef
listing page. They are not products, and a guest clicking "Balanced" and
landing on a shop's front page is worse than no link at all. If they should
appear on the page they want their own small `registry_stores` table.

Also not loaded: the send-off party notes (Peak Gardens, House of Florence) and
the Google Sheets link. Neither is registry data.
