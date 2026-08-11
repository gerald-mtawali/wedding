-- Wedding database schema (Cloudflare D1 / SQLite)
--
-- Apply locally:
--   cd api && npx wrangler d1 execute wedding --local --file=../db/schema.sql
-- Apply to production:
--   cd api && npx wrangler d1 execute wedding --remote --file=../db/schema.sql
--
-- ---------------------------------------------------------------------------
-- Design notes — how "one RSVP per guest" is guaranteed
-- ---------------------------------------------------------------------------
-- The invite is addressed to a *party* (a household / an envelope), not to an
-- individual. Each party gets one short `code` that goes on the paper invite
-- and in the RSVP link (/rsvp?c=XXXXXX).
--
--   1. A guest can only be found by first resolving their party's code, so
--      two different "John Banda"s can never be confused: names are only ever
--      matched *within* a single party, which is at most a handful of people.
--   2. `rsvps.guest_id` is UNIQUE. Submitting twice cannot create a second
--      row — the second write is an upsert against the same row. This is
--      enforced by SQLite itself, so a race between two concurrent submits
--      still ends with exactly one response on record.
--   3. `rsvp_events` keeps the full history, so an amended reply is never a
--      silent overwrite.
--
-- Codes are generated from the Crockford base32 alphabet
-- (0123456789ABCDEFGHJKMNPQRSTVWXYZ — no I, L, O or U), so there are no
-- visually ambiguous characters. The API canonicalises input by uppercasing
-- and mapping O->0, I->1, L->1 before lookup.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Parties — one row per invitation sent.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parties (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT    NOT NULL,
  -- Canonical lookup key. Stored codes are already unambiguous, so uppercasing
  -- is enough here; the Worker maps confusable characters on the input side.
  code_key    TEXT    GENERATED ALWAYS AS (upper(code)) STORED,
  -- How the invitation is addressed, e.g. "The Banda Family".
  label       TEXT    NOT NULL,
  invited_to  TEXT    NOT NULL DEFAULT 'both',  -- ceremony | reception | both
  notes       TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_parties_code_key ON parties(code_key);

-- ---------------------------------------------------------------------------
-- Guests — the named individuals on each invitation.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guests (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  party_id        INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  first_name      TEXT    NOT NULL,
  last_name       TEXT    NOT NULL,
  -- Cheap normalisation, used only to stop the same person being seeded twice
  -- into one party. Fuzzy matching of user input happens in the Worker.
  name_key        TEXT    GENERATED ALWAYS AS (
                    lower(trim(first_name)) || ' ' || lower(trim(last_name))
                  ) STORED,
  -- 1 if this guest may bring an unnamed plus-one.
  allow_plus_one  INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_guests_party ON guests(party_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_guests_party_name
  ON guests(party_id, name_key);

-- ---------------------------------------------------------------------------
-- RSVPs — at most ONE row per guest, enforced by the unique index below.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rsvps (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_id       INTEGER NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  attending      INTEGER NOT NULL,          -- 0 = regretfully declines, 1 = yes
  plus_one_name  TEXT,                      -- NULL when not bringing anyone
  dietary        TEXT,
  message        TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
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
  payload     TEXT    NOT NULL,   -- JSON snapshot of the submitted form
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rsvp_events_guest ON rsvp_events(guest_id);

-- ---------------------------------------------------------------------------
-- Registry
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registry_items (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT    NOT NULL,
  description    TEXT,
  image_url      TEXT,
  item_url       TEXT,
  price_cents    INTEGER NOT NULL DEFAULT 0,
  currency       TEXT    NOT NULL DEFAULT 'USD',
  target_count   INTEGER NOT NULL DEFAULT 1,
  pledged_count  INTEGER NOT NULL DEFAULT 0,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

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
-- Convenience view for reading responses (e.g. `wrangler d1 execute ... --command`)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS rsvp_summary;
CREATE VIEW rsvp_summary AS
SELECT
  p.code                        AS invite_code,
  p.label                       AS party,
  g.first_name || ' ' || g.last_name AS guest,
  CASE
    WHEN r.attending IS NULL THEN 'awaiting reply'
    WHEN r.attending = 1     THEN 'attending'
    ELSE 'declined'
  END                           AS status,
  r.plus_one_name,
  r.dietary,
  r.message,
  r.updated_at
FROM guests g
JOIN parties p ON p.id = g.party_id
LEFT JOIN rsvps r ON r.guest_id = g.id
ORDER BY p.label, g.last_name, g.first_name;
