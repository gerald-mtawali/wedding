-- Honeymoon fund goal: USD 2,000 -> USD 4,000.
--
-- One row, one column. `registry_items.price_cents` is in MINOR UNITS, so
-- $4,000 is 400000 — the same convention as every other price in
-- db/registry/002-items.sql.
--
-- This is the only price on the whole table that a guest ever sees. The
-- registry query in api/src/routes/registry.ts emits it as `goal_cents`, but
-- only for rows with kind = 'cash':
--
--     CASE WHEN kind = 'cash' THEN price_cents END AS goal_cents
--
-- so nothing else on this table becomes visible by changing this value.
--
-- Apply LOCAL FIRST, then back up, then remote:
--
--   cd api
--   npx wrangler d1 execute wedding --local  --file=../db/registry/003-honeymoon-goal.sql
--   npm run db:backup
--   npx wrangler d1 execute wedding --remote --file=../db/registry/003-honeymoon-goal.sql
--
-- Idempotent: it sets a value rather than adding one, so a second run is a
-- no-op. It is also safe to re-run after 001/002, which is the point of it
-- being its own file — 002 is INSERT OR IGNORE and will NOT update a row that
-- already exists, so editing 002 alone would never change the live database.
-- (db/registry/002-items.sql has been edited to 400000 as well, so a rebuild
-- from scratch lands on the same number.)

UPDATE registry_items
   SET price_cents = 400000,
       currency    = 'USD'
 WHERE name = 'Honeymoon Fund'
   AND kind = 'cash';

-- Must say PASS. A FAIL here means the row is named something else — check
-- `SELECT id, name, kind FROM registry_items WHERE kind = 'cash'`.
SELECT 'honeymoon goal' AS "check",
       CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL — expected 1 row at 400000' END AS result,
       COUNT(*) AS found
  FROM registry_items
 WHERE name = 'Honeymoon Fund' AND price_cents = 400000 AND currency = 'USD';

-- What the page will now show.
SELECT name, kind, price_cents, currency, is_active
  FROM registry_items WHERE kind = 'cash';
