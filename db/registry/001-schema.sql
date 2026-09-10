-- ===========================================================================
-- Registry schema v2 — item TYPES, plus the products that caught our eye.
--
-- The model, in one line: `registry_items` is a list of the KINDS of thing we
-- would love (a kettle, cutlery, curtains), and `registry_item_options` holds
-- the specific products we have looked at for each one. Nobody has to buy the
-- exact product in the link — that is the whole point of separating the two.
--
-- Pledges are NOT part of this change. `registry_pledges` is left exactly as
-- it is, untouched, and nothing here reads or writes it.
--
-- ---------------------------------------------------------------------------
-- RUN THE PRECHECK FIRST
-- ---------------------------------------------------------------------------
-- A bare SELECT cannot abort a script, so this file trusts that you have
-- already confirmed there is nothing to lose:
--
--   cd api
--   npm run db:sql        -- "SELECT COUNT(*) AS pledges FROM registry_pledges"
--   npm run db:remote:sql -- "SELECT COUNT(*) AS pledges FROM registry_pledges"
--
-- Both must return 0.
--
-- `registry_pledges.item_id` is a foreign key to `registry_items`, and D1
-- enforces foreign keys by default. If that table holds rows, the DROP below
-- fails with "FOREIGN KEY constraint failed" and nothing is changed. That is
-- the database protecting real data, not a bug in this script — back up with
-- `npm run db:backup` and decide what to do with those pledges first.
--
-- ---------------------------------------------------------------------------
-- APPLY
-- ---------------------------------------------------------------------------
--   cd api
--   npx wrangler d1 execute wedding --local  --file=../db/registry/001-schema.sql
--   npx wrangler d1 execute wedding --local  --file=../db/registry/002-items.sql
--   npm run db:verify
--
-- Then, once local looks right:
--   npm run db:backup
--   npx wrangler d1 execute wedding --remote --file=../db/registry/001-schema.sql
--   npx wrangler d1 execute wedding --remote --file=../db/registry/002-items.sql
--
-- This file is a REBUILD, not a migration, and it is therefore safe to re-run
-- only in the sense that it always lands in the same state: it drops the
-- tables and recreates them empty. Re-running it discards any item you added
-- by hand and not to 002. Add new items as 003-*.sql instead.
-- ===========================================================================

-- Child first — registry_item_options references registry_items.
DROP TABLE IF EXISTS registry_item_options;
DROP TABLE IF EXISTS registry_items;

-- ---------------------------------------------------------------------------
-- registry_items — one row per KIND of gift.
-- ---------------------------------------------------------------------------
CREATE TABLE registry_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,

  -- The type of thing, as a guest reads it: "Kettle", "Cutlery", "Curtains".
  -- UNIQUE, and that is load-bearing: it is what makes 002-items.sql
  -- idempotent, exactly the way `parties.label` does for guest batches, and
  -- it is how the options below find their parent row by name.
  name            TEXT    NOT NULL,

  -- One guest-facing line. Where a preference matters, say it here — this is
  -- where "aim for 300 thread count or better" lives.
  description     TEXT,

  -- 'item' — a thing somebody buys.
  -- 'cash' — the honeymoon fund. No target, never "claimed", any number of
  --          people contribute.
  kind            TEXT    NOT NULL DEFAULT 'item'
                  CHECK (kind IN ('item', 'cash')),

  -- Row grouping on the page: 'Appliances', 'Cookware', 'Kitchen', 'Dining',
  -- 'Bedroom', 'Home', 'Honeymoon'.
  category        TEXT,

  -- R2 object key (e.g. "registry/kettle.jpg"), resolved through the same
  -- `media()` helper in web/src/lib/siteConfig.ts that the gallery uses.
  -- NULL for now — no images have been uploaded.
  image_url       TEXT,

  -- Deliberately NULL on every row. Every product link lives in
  -- registry_item_options, so the page has exactly one place to look and
  -- there is no "is the default link also one of the options?" ambiguity.
  -- Kept as a column because api/src/routes/registry.ts may want it later.
  item_url        TEXT,

  -- -----------------------------------------------------------------------
  -- INTERNAL ONLY — for your budgeting, not for the page.
  --
  -- Same discipline as `rsvps.phone`: the guard belongs in the SELECT list of
  -- the query, not in a mapping function, because a column that is never
  -- fetched cannot be accidentally serialised later.
  --
  -- Minor units (cents), so R7999 is 799900. `price_max_cents` is non-NULL
  -- only for a range — the microwave was quoted at R2500–R3700.
  --
  -- NOTE: api/src/routes/registry.ts currently SELECTs price_cents and
  -- currency. Drop them from that SELECT before the page goes live.
  -- -----------------------------------------------------------------------
  price_cents     INTEGER,
  price_max_cents INTEGER,
  currency        TEXT    NOT NULL DEFAULT 'ZAR',

  -- How many of this kind we would take. 1 for the fridge.
  target_count    INTEGER NOT NULL DEFAULT 1 CHECK (target_count >= 1),

  -- VESTIGIAL, and kept only so the existing `handleRegistry` SELECT still
  -- resolves — it names this column. Nothing writes it while pledges are out
  -- of the UI, so it is 0 on every row. When pledges land it should be
  -- dropped entirely and the count derived from registry_pledges, because a
  -- stored counter and a real count drift the first time a write half-fails.
  pledged_count   INTEGER NOT NULL DEFAULT 0,

  -- Assigned in tens in 002-items.sql, so a new item can be slotted between
  -- two existing ones without renumbering the file.
  sort_order      INTEGER NOT NULL DEFAULT 0,

  -- 0 hides an item from the page without deleting it (and without orphaning
  -- its options, or any pledge it may one day have).
  is_active       INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),

  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_registry_items_name ON registry_items(name);
CREATE INDEX idx_registry_items_sort
  ON registry_items(is_active, sort_order, id);

-- ---------------------------------------------------------------------------
-- registry_item_options — the products we have actually looked at.
-- ---------------------------------------------------------------------------
CREATE TABLE registry_item_options (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id     INTEGER NOT NULL
              REFERENCES registry_items(id) ON DELETE CASCADE,

  -- 'Quality focused' | 'Cost focused' | 'Balanced' | 'Caught our eye'
  --
  -- Free text rather than a CHECK constraint: the first three come straight
  -- from the columns of the source spreadsheet, and 'Caught our eye' covers
  -- every link that was not in one of them. An item may have four of one
  -- label and none of another, and a CHECK would only make the next change
  -- to that vocabulary a table rebuild.
  label       TEXT    NOT NULL,

  -- 'Kitchenique', 'Hertex Haus', 'Woolworths' — shown as the small line
  -- under the product name so a guest knows where the link goes before they
  -- click it.
  retailer    TEXT,

  -- The product as the retailer names it.
  product     TEXT,

  url         TEXT    NOT NULL,

  -- INTERNAL ONLY, as above. Mostly NULL: the source sheet priced the item,
  -- not each option.
  price_cents INTEGER,

  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_registry_options_item
  ON registry_item_options(item_id, sort_order, id);

-- UNIQUE on (item_id, URL) — NOT on (item_id, label).
--
-- This is the one constraint worth reading twice. Several cells in the source
-- spreadsheet hold TWO links in a single column: "Cost focused" for Cutlery
-- has both the St James and the Slimline set, and Dinner Plates has two links
-- in all three columns. A unique index on (item_id, label) would silently
-- swallow the second link of every one of those pairs under INSERT OR IGNORE,
-- and the loss would be invisible — the row would look fine, just shorter.
--
-- The same URL under two DIFFERENT items is allowed, and is real: the Kenwood
-- Multipro is listed under both Blender and Food Processor because it is both.
CREATE UNIQUE INDEX idx_registry_options_url
  ON registry_item_options(item_id, url);
