-- Tear the database down so schema.sql can rebuild it from nothing.
--
--   npx wrangler d1 execute wedding --local --file=../db/reset.sql
--
-- Used by `npm run db:reset` (api/) as the first of three steps. It exists
-- because `schema.sql` is written with CREATE TABLE IF NOT EXISTS, which means
-- re-running it against an old database silently leaves the old columns in
-- place — exactly the failure this feature would be most likely to hit.
--
-- DESTRUCTIVE. Never point this at --remote once real replies exist.
--
-- Dropped child-first so foreign keys are never left dangling mid-file.

DROP VIEW  IF EXISTS rsvp_headcount;
DROP VIEW  IF EXISTS rsvp_summary;

DROP TABLE IF EXISTS registry_item_options;
DROP TABLE IF EXISTS registry_pledges;
DROP TABLE IF EXISTS registry_items;
DROP TABLE IF EXISTS rsvp_events;
DROP TABLE IF EXISTS rsvps;
DROP TABLE IF EXISTS guests;
DROP TABLE IF EXISTS parties;
