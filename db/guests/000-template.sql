-- Guest batch template. Copy to the next number, e.g. `002-sept-additions.sql`.
--
-- Apply to BOTH databases, local first:
--   cd api
--   npx wrangler d1 execute wedding --local  --file=../db/guests/002-sept-additions.sql
--   npx wrangler d1 execute wedding --remote --file=../db/guests/002-sept-additions.sql
--
-- Every batch is IDEMPOTENT: re-running it inserts nothing new. That is what
-- `INSERT OR IGNORE` plus the unique indexes on `parties.label` and
-- `guests(party_id, name_key)` buy you. Safe to re-run if a run half-failed,
-- and safe to apply the whole folder to a fresh database in order.
--
-- Commit these. The folder is the audit trail of who was added when — which
-- matters, because `guests` is the allow-list: if someone is not in here, they
-- cannot RSVP.

-- ---------------------------------------------------------------------------
-- 1. Households first (guests reference them by label).
--
-- `label` is UNIQUE and it is the ONLY thing a guest sees when two people
-- share a name. Make it something the guest recognises about themselves, and
-- make sure it does not already exist with a different spelling —
-- "The Banda Family" and "Banda Family" are two different households to the
-- database and two identical-looking rows to a confused guest.
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO parties (label, invited_to) VALUES
  ('The Example Household', 'both');

-- ---------------------------------------------------------------------------
-- 2. Guests. Each row resolves its own household with a scalar subquery.
--
-- DO NOT rewrite this as `SELECT ... UNION ALL SELECT ...`. D1's SQLite caps
-- compound-SELECT terms much lower than stock SQLite: that shape works in a
-- local sqlite3 shell and fails on D1 at around nine rows with
-- "too many terms in compound SELECT". A multi-row VALUES clause is not
-- counted the same way, so this shape scales to a whole guest list.
--
--   middle_name     — set it whenever this person shares a first+last name
--                     with anyone else on the list. It is what lets the
--                     matcher tell them apart beyond the household.
--   allow_plus_one  — PER GUEST, not per household. 1 shows the plus-one
--                     block in step 3 of the form; 0 hides it.
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO guests
  (party_id, first_name, middle_name, last_name, allow_plus_one)
VALUES
  ((SELECT id FROM parties WHERE label = 'The Example Household'), 'Jane',   NULL, 'Example', 1),
  ((SELECT id FROM parties WHERE label = 'The Example Household'), 'Joseph', NULL, 'Example', 0);

-- ---------------------------------------------------------------------------
-- 3. Confirm the batch actually landed.
--
-- `INSERT OR IGNORE` swallows constraint violations silently — including a
-- typo that collided with an existing row. A batch that inserted nothing looks
-- exactly like a batch that succeeded. So always assert the count, and expect
-- the number you wrote above.
-- ---------------------------------------------------------------------------
SELECT 'guests in this batch' AS "check",
       CASE WHEN COUNT(*) = 2 THEN 'PASS' ELSE 'FAIL — expected 2' END AS result,
       COUNT(*) AS found
FROM guests g JOIN parties p ON p.id = g.party_id
WHERE p.label = 'The Example Household';

SELECT 'total guests' AS "check", COUNT(*) AS guests FROM guests;
