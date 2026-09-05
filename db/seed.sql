-- Sample seed data for local development. Replace with the real guest list
-- before launch.
--
--   npx wrangler d1 execute wedding --local --file=../db/seed.sql
--
-- Every row below exists to exercise one branch of the name-search flow.
-- Keep the comments attached to the rows if you edit this file — they are the
-- test plan, and shared/names.test.ts mirrors them exactly.
--
-- ---------------------------------------------------------------------------
-- A NOTE ON SHAPE — why this file uses VALUES and not UNION ALL
--
-- D1's SQLite caps the number of terms in a compound SELECT far lower than
-- stock SQLite does. The obvious way to write these inserts —
--
--   INSERT INTO guests (...) SELECT p.id, v.* FROM (
--     SELECT 'a' UNION ALL SELECT 'b' UNION ALL ...          -- <- compound
--   ) v JOIN parties p ON p.label = v.label;
--
-- runs fine in a local sqlite3 shell and fails on D1 with
-- "too many terms in compound SELECT: SQLITE_ERROR" at nine rows. A multi-row
-- VALUES clause is not counted the same way and scales fine, so each row
-- resolves its own foreign key with a scalar subquery instead.
--
-- Use this shape for the real guest batches too — see db/guests/000-template.sql.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Households. `label` is what a guest sees when two people share a name, so
-- the labels here are deliberately distinguishable. Invite codes are NULL:
-- the flow no longer uses them.
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO parties (label, invited_to) VALUES
  ('The Test Household',          'both'),
  ('The Banda Family',            'both'),
  ('The Mwale-Banda Household',   'both'),
  ('Ms. Chisomo Phiri',           'both'),
  ('Mr. & Mrs. Mwale',            'reception');

-- ---------------------------------------------------------------------------
-- Guests.
--
--   John A Banda / John B. Banda  — SAME core name, DIFFERENT households.
--       Searching "John Banda" must return BOTH (matcher tier 3), and the
--       confirmation screen must tell them apart by household alone.
--   Grace Thandiwe Banda          — full middle name seeded. Searching
--       "Grace T Banda" must match it (tier 2, initial-as-prefix).
--   Donella Banda                 — no namesake. "Don Banda" resolves (tier 6)
--       and "Bunny Banda" comes back as a suggestion.
--   Tadala Banda                  — has an existing reply below; exercises
--       the already-responded / amend path.
--   allow_plus_one is 1 for exactly three of them, so step 3 can be tested
--       both with and without the plus-one block.
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO guests
  (party_id, first_name, middle_name, last_name, allow_plus_one)
VALUES
  ((SELECT id FROM parties WHERE label = 'The Test Household'),        'Test',    NULL,       'Guest', 1),
  ((SELECT id FROM parties WHERE label = 'The Banda Family'),          'John',    'A',        'Banda', 1),
  ((SELECT id FROM parties WHERE label = 'The Banda Family'),          'Grace',   'Thandiwe', 'Banda', 0),
  ((SELECT id FROM parties WHERE label = 'The Banda Family'),          'Tadala',  NULL,       'Banda', 0),
  ((SELECT id FROM parties WHERE label = 'The Banda Family'),          'Donella', NULL,       'Banda', 0),
  ((SELECT id FROM parties WHERE label = 'The Mwale-Banda Household'), 'John',    'B.',       'Banda', 0),
  ((SELECT id FROM parties WHERE label = 'The Mwale-Banda Household'), 'Esnart',  NULL,       'Mwale', 0),
  ((SELECT id FROM parties WHERE label = 'Ms. Chisomo Phiri'),         'Chisomo', NULL,       'Phiri', 1),
  ((SELECT id FROM parties WHERE label = 'Mr. & Mrs. Mwale'),          'Peter',   NULL,       'Mwale', 0),
  ((SELECT id FROM parties WHERE label = 'Mr. & Mrs. Mwale'),          'Rachel',  NULL,       'Mwale', 0);

-- ---------------------------------------------------------------------------
-- Three responses already on record, so the amend path and the plus-one union
-- are both testable the moment the database is seeded.
--
--   Tadala Banda   — attending, no plus-one (not permitted one anyway).
--   Chisomo Phiri  — attending WITH a plus-one who has their own dietary
--                    requirement. Must appear as a second row in
--                    rsvp_summary with kind='plus-one' and via='Chisomo Phiri'.
--                    Also carries the phone number the API must never echo.
--   Peter Mwale    — declined. Must contribute 0 to the headcount.
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO rsvps
  (guest_id, attending, phone, dietary, dietary_notes,
   plus_one_name, plus_one_dietary, message)
VALUES
  ((SELECT id FROM guests WHERE name_key = 'tadala banda'),  1, '+265 991 000 001', 'none',        NULL,           NULL,              NULL,     'Counting down!'),
  ((SELECT id FROM guests WHERE name_key = 'chisomo phiri'), 1, '+265 991 000 002', 'pescatarian', 'No shellfish', 'Yamikani Nkhoma', 'halaal', NULL),
  ((SELECT id FROM guests WHERE name_key = 'peter mwale'),   0, '+265 991 000 003', NULL,          NULL,           NULL,              NULL,     'So sorry to miss it.');

-- ---------------------------------------------------------------------------
-- Registry
-- ---------------------------------------------------------------------------
INSERT INTO registry_items
  (name, description, image_url, item_url, price_cents, currency, target_count, sort_order)
VALUES
  ('Honeymoon Fund', 'Help us start our next chapter with a trip to remember.', NULL, NULL, 50000, 'USD', 20, 1),
  ('Le Creuset Dutch Oven', '5.5 qt enameled cast iron — sage green.', NULL, NULL, 38000, 'USD', 1, 2),
  ('KitchenAid Stand Mixer', 'Artisan series — for late-night baking.', NULL, NULL, 44999, 'USD', 1, 3),
  ('Linen Bedding Set', 'Queen, oat color.', NULL, NULL, 22000, 'USD', 1, 4);
