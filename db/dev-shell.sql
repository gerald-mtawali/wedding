-- Convenience loader for the interactive `sqlite3` shell. NOT for D1.
--
--   cd /path/to/wedding          <-- must be the repo root, see below
--   sqlite3 /tmp/wedding.db
--   sqlite> .read db/dev-shell.sql
--
-- This file mixes SQLite CLI dot-commands with SQL. Dot-commands are a feature
-- of the `sqlite3` binary, not of SQLite itself, so `wrangler d1 execute` will
-- choke on this file. Never point D1 at it — use reset/schema/seed directly.
--
-- IMPORTANT: `.read` resolves paths against the shell's CURRENT DIRECTORY, not
-- against the location of this file. Launch sqlite3 from the repo root or the
-- three reads below will fail with "cannot open".

-- Stop at the first error instead of ploughing on and leaving a half-built
-- database that looks fine until you query it.
.bail on

-- Foreign keys are OFF by default in the CLI and the setting is PER
-- CONNECTION — it is not stored in the file. D1 enforces them always, so
-- without this line your local database is more permissive than production.
PRAGMA foreign_keys = ON;

.read db/reset.sql
.read db/schema.sql
.read db/seed.sql

-- Readable output for the rest of the session.
.mode box
.headers on
.nullvalue ·
.changes on

SELECT 'loaded' AS status,
       (SELECT COUNT(*) FROM parties) AS parties,
       (SELECT COUNT(*) FROM guests)  AS guests,
       (SELECT COUNT(*) FROM rsvps)   AS rsvps;
