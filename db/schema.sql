-- Wedding database schema (Cloudflare D1 / SQLite)
--
-- Apply locally (from api/):
--   npm run db:reset          -- reset.sql + schema.sql + seed.sql
-- Or by hand:
--   npx wrangler d1 execute wedding --local --file=../db/schema.sql
-- Apply to production:
--   npx wrangler d1 execute wedding --remote --file=../db/schema.sql
--
-- ---------------------------------------------------------------------------
-- Design notes — how a guest is identified, and how "one RSVP per guest" holds
-- ---------------------------------------------------------------------------
-- Identity is "match against the pre-loaded list". The guest types their name,
-- the Worker fuzzy-matches it against `guests` (the allow-list — we are the
-- source of truth for who is invited), and the matched `guests.id` becomes
-- their identity. Invite codes are gone.
--
--   1. Two people can share a name. The Worker never guesses between them: it
--      returns every hit and the guest picks. The only thing shown to tell
--      them apart is `parties.label` — the household the invitation was
--      addressed to. Never email, never phone. `parties.label` is therefore
--      UNIQUE: two identically-labelled households would defeat the whole
--      disambiguation screen.
--   2. `rsvps.guest_id` is UNIQUE. Submitting twice cannot create a second
--      row — the second write is an upsert against the same row. SQLite
--      enforces this, so a race between two concurrent submits still ends
--      with exactly one response on record.
--   3. `rsvp_events` keeps the full history, so an amended reply is never a
--      silent overwrite.
--
-- A plus-one is NOT a guest. They are columns on the host's `rsvps` row, so
-- they can never be found by the name search — they only come into existence
-- when someone who was invited brings them. `rsvp_summary` unions them back in
-- for headcounts.
--
-- Note on PRAGMA: D1 rejects most PRAGMA statements, so none appear in this
-- file. D1 enforces foreign keys by default. When validating this schema with
-- a local `sqlite3` shell, run `PRAGMA foreign_keys = ON;` yourself first.

-- ---------------------------------------------------------------------------
-- Parties — one household / one invitation.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parties (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  -- How the invitation is addressed, e.g. "The Banda Family". This is the
  -- disambiguator shown to a guest when two people share a name, so it must
  -- be something a guest recognises about themselves, and it must be unique.
  label       TEXT    NOT NULL,
  -- Legacy invite code. Nullable and unused by the RSVP flow; kept only so
  -- historic rows and any printed cards still have somewhere to live.
  code        TEXT,
  invited_to  TEXT    NOT NULL DEFAULT 'both',  -- ceremony | reception | both
  notes       TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_parties_label ON parties(label);

-- ---------------------------------------------------------------------------
-- Guests — the named individuals on each invitation. THE allow-list.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guests (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  party_id        INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  -- The identifier the API and the browser use. Unguessable on purpose:
  -- `id` is a sequential AUTOINCREMENT, so exposing it would let anyone walk
  -- 1..N and read out every guest's name, household, meal, plus-one and note.
  -- 16 hex characters is 64 bits — not a secret, just not enumerable.
  public_id       TEXT    NOT NULL UNIQUE
                  DEFAULT (lower(hex(randomblob(8)))),
  -- Honorific as the invitation was addressed: "Mr", "Mrs", "Dr", "Rev",
  -- "Professor", "Madam", "Agogo Aunt". Display only — it is NOT part of
  -- `name_key` or `search_key`, deliberately: a guest who types "Dr Wilson
  -- Banda" must match the same row as one who types "Wilson Banda", and a
  -- title baked into the search keys would break exactly that.
  --
  -- NULL when we have no honorific on file, and also NULL when the invitation
  -- gave us nothing BUT an honorific ("Mr and Mrs Nyirenda") — in that case
  -- the honorific is the `first_name`, because a name has to be searchable and
  -- `first_name` is NOT NULL. See db/guests/000-template.sql.
  title           TEXT,
  first_name      TEXT    NOT NULL,
  -- A middle name or a bare initial. "Alfred", "A", "A." are all valid, and
  -- the Worker's matcher treats a typed initial as a prefix of a stored full
  -- middle name (and vice versa).
  middle_name     TEXT,
  last_name       TEXT    NOT NULL,

  -- Cheap normalisation only. Real matching of user input happens in the
  -- Worker (shared/names.ts), which strips accents and punctuation too.
  --
  -- name_key   — the full name including the middle part. Its job is the
  --              unique index below: it is what stops the same person being
  --              seeded twice into one household, while still allowing
  --              "John A Banda" and "John B Banda" to coexist there.
  name_key        TEXT    GENERATED ALWAYS AS (
                    lower(trim(first_name))
                    || ' '
                    || CASE
                         WHEN middle_name IS NULL OR trim(middle_name) = ''
                           THEN ''
                         ELSE lower(trim(middle_name)) || ' '
                       END
                    || lower(trim(last_name))
                  ) STORED,
  -- search_key — first + last with the middle part dropped. This is the key
  --              tier 2 of the matcher compares against, and it is why a
  --              search for "John Banda" surfaces BOTH "John A Banda" and
  --              "John B. Banda" rather than neither.
  search_key      TEXT    GENERATED ALWAYS AS (
                    lower(trim(first_name)) || ' ' || lower(trim(last_name))
                  ) STORED,

  -- 1 if this guest may bring a plus-one.
  allow_plus_one  INTEGER NOT NULL DEFAULT 0
                  CHECK (allow_plus_one IN (0, 1)),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_guests_party ON guests(party_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_guests_public_id ON guests(public_id);
CREATE INDEX IF NOT EXISTS idx_guests_search_key ON guests(search_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_guests_party_name
  ON guests(party_id, name_key);

-- ---------------------------------------------------------------------------
-- RSVPs — at most ONE row per guest, enforced by the unique index below.
--
-- The plus-one lives here rather than in `guests`, deliberately: it keeps the
-- name search restricted to people we actually invited, and it puts the
-- plus-one's dietary requirement next to the host's, which is where the
-- kitchen needs it.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rsvps (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_id          INTEGER NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  attending         INTEGER NOT NULL CHECK (attending IN (0, 1)),

  -- Phone / WhatsApp. Not a login: it is the follow-up channel, and a manual
  -- tiebreaker if we ever need to verify who actually responded.
  phone             TEXT,

  -- One of five, or NULL when the guest declined / didn't say.
  dietary           TEXT CHECK (
                      dietary IS NULL OR dietary IN
                      ('halaal','vegetarian','vegan','pescatarian','none')
                    ),
  -- Free text for allergies and anything the five options can't express.
  dietary_notes     TEXT,

  plus_one_name     TEXT,   -- NULL when not bringing anyone
  plus_one_dietary  TEXT CHECK (
                      plus_one_dietary IS NULL OR plus_one_dietary IN
                      ('halaal','vegetarian','vegan','pescatarian','none')
                    ),

  message           TEXT,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- THE constraint that makes double-RSVP impossible.
CREATE UNIQUE INDEX IF NOT EXISTS idx_rsvps_guest ON rsvps(guest_id);

-- ---------------------------------------------------------------------------
-- Audit trail — every submission, including amendments.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rsvp_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_id    INTEGER NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  attending   INTEGER NOT NULL,
  payload     TEXT    NOT NULL,   -- JSON snapshot: typed query, resolved id, form
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rsvp_events_guest ON rsvp_events(guest_id);

-- ---------------------------------------------------------------------------
-- Registry
-- ---------------------------------------------------------------------------
-- `registry_items` is a list of the KINDS of thing we would love — a kettle,
-- cutlery, curtains — and `registry_item_options` holds the specific products
-- we have looked at for each one. Nobody has to buy the exact product in a
-- link, and that separation is the whole point of two tables.
--
-- The items themselves are NOT seeded by db/seed.sql. They live in
-- db/registry/002-items.sql, which is applied to local and remote alike (they
-- are public, non-sensitive data, so there is no dummy version).
CREATE TABLE IF NOT EXISTS registry_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  -- The type of thing, as a guest reads it. UNIQUE, and load-bearing: it is
  -- what makes db/registry/002-items.sql idempotent, and it is how every
  -- option row in that file finds its parent.
  name            TEXT    NOT NULL,
  description     TEXT,
  -- 'cash' is the honeymoon fund: no target, never "claimed".
  kind            TEXT    NOT NULL DEFAULT 'item'
                  CHECK (kind IN ('item', 'cash')),
  category        TEXT,
  image_url       TEXT,
  -- NULL on every row today. Every product link lives in
  -- registry_item_options so the page has one place to look.
  item_url        TEXT,

  -- INTERNAL ONLY — for budgeting, never for the browser. The guard is the
  -- SELECT list in api/src/routes/registry.ts, not a mapping function: a
  -- column that is never fetched cannot be accidentally serialised later.
  -- Same discipline as `rsvps.phone`. Minor units, so R7999 is 799900;
  -- price_max_cents is non-NULL only for a quoted range.
  price_cents     INTEGER,
  price_max_cents INTEGER,
  currency        TEXT    NOT NULL DEFAULT 'ZAR',

  target_count    INTEGER NOT NULL DEFAULT 1 CHECK (target_count >= 1),
  -- VESTIGIAL. Nothing writes it while pledges are out of the UI, so it is 0
  -- on every row. Drop it when pledges land and derive the count from
  -- registry_pledges — a stored counter and a real count drift the first time
  -- a write half-fails. See docs/registry-plan.md §1.1.
  pledged_count   INTEGER NOT NULL DEFAULT 0,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  -- 0 hides an item without deleting it, and without orphaning its options.
  is_active       INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_registry_items_name
  ON registry_items(name);
CREATE INDEX IF NOT EXISTS idx_registry_items_sort
  ON registry_items(is_active, sort_order, id);

-- The products we have actually looked at for each item.
CREATE TABLE IF NOT EXISTS registry_item_options (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id     INTEGER NOT NULL
              REFERENCES registry_items(id) ON DELETE CASCADE,
  -- 'Quality focused' | 'Cost focused' | 'Balanced' | 'Caught our eye'.
  -- Free text rather than a CHECK: an item may have four of one label and
  -- none of another, and a CHECK would make the next change to that
  -- vocabulary a table rebuild.
  label       TEXT    NOT NULL,
  retailer    TEXT,
  product     TEXT,
  url         TEXT    NOT NULL,
  price_cents INTEGER,          -- INTERNAL ONLY, as above
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_registry_options_item
  ON registry_item_options(item_id, sort_order, id);

-- UNIQUE on (item_id, URL) — NOT on (item_id, label), and this is the one
-- constraint worth reading twice.
--
-- Several cells in the source spreadsheet hold TWO links in a single column:
-- "Cost focused" for Cutlery has both the St James and the Slimline set, and
-- Dinner Plates has two links in all three columns. A unique index on
-- (item_id, label) would silently swallow the second link of every pair under
-- INSERT OR IGNORE, and the loss would be invisible — the row would look fine,
-- just shorter.
--
-- The same URL under two DIFFERENT items is allowed, and is real: the Kenwood
-- Multipro is listed under both Blender and Food Processor because it is both.
CREATE UNIQUE INDEX IF NOT EXISTS idx_registry_options_url
  ON registry_item_options(item_id, url);

CREATE TABLE IF NOT EXISTS registry_pledges (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id        INTEGER NOT NULL REFERENCES registry_items(id),
  pledge_type    TEXT    NOT NULL,      -- 'item' | 'cash'
  amount_cents   INTEGER,
  name           TEXT    NOT NULL,
  email          TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pledges_item ON registry_pledges(item_id);

-- ---------------------------------------------------------------------------
-- rsvp_summary — one row per person expected at the wedding.
--
-- Guests and plus-ones are unioned, so a headcount is a single query and the
-- plus-ones (who have no `guests` row) are never silently missing from it.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS rsvp_summary;
CREATE VIEW rsvp_summary AS
SELECT
  g.id                          AS guest_id,
  'guest'                       AS kind,
  g.title                       AS title,
  g.first_name
    || CASE
         WHEN g.middle_name IS NULL OR trim(g.middle_name) = '' THEN ''
         ELSE ' ' || g.middle_name
       END
    || ' ' || g.last_name       AS name,
  p.label                       AS household,
  NULL                          AS via,
  CASE
    WHEN r.attending IS NULL THEN 'awaiting reply'
    WHEN r.attending = 1     THEN 'attending'
    ELSE 'declined'
  END                           AS status,
  r.dietary                     AS dietary,
  r.dietary_notes               AS dietary_notes,
  r.phone                       AS phone,
  r.message                     AS message,
  r.updated_at                  AS updated_at
FROM guests g
JOIN parties p ON p.id = g.party_id
LEFT JOIN rsvps r ON r.guest_id = g.id

UNION ALL

SELECT
  NULL,
  'plus-one',
  NULL,
  r.plus_one_name,
  p.label,
  g.first_name || ' ' || g.last_name,
  'attending',
  r.plus_one_dietary,
  NULL,
  r.phone,
  NULL,
  r.updated_at
FROM rsvps r
JOIN guests  g ON g.id = r.guest_id
JOIN parties p ON p.id = g.party_id
WHERE r.attending = 1
  AND r.plus_one_name IS NOT NULL
  AND trim(r.plus_one_name) <> ''

ORDER BY household, kind, name;

-- ---------------------------------------------------------------------------
-- rsvp_headcount — the number the caterer actually asks for.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS rsvp_headcount;
CREATE VIEW rsvp_headcount AS
SELECT
  status,
  COALESCE(dietary, 'unspecified') AS dietary,
  COUNT(*)                         AS people
FROM rsvp_summary
GROUP BY status, COALESCE(dietary, 'unspecified')
ORDER BY status, dietary;
