-- Sample seed data for local development. Replace with the real guest list
-- before launch.
--
--   cd api && npx wrangler d1 execute wedding --local --file=../db/seed.sql
--
-- Invite codes use the Crockford base32 alphabet (0123456789ABCDEFGHJKMNPQRSTVWXYZ)
-- so there are no I/L/O/U characters to mistype. Generate real ones with:
--   cd api && npm run codes -- 40

-- ---------------------------------------------------------------------------
-- Parties + guests
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO parties (code, label, invited_to) VALUES
  ('TEST01', 'The Test Household',   'both'),
  ('K3RQ7M', 'The Banda Family',     'both'),
  ('B8XN2V', 'Ms. Chisomo Phiri',    'both'),
  ('W5HJ9T', 'Mr. & Mrs. Mwale',     'reception');

-- Note: two guests below deliberately share the name "James Banda" across
-- different parties. Because lookup is scoped by invite code, they never
-- collide — this row exists so the behaviour is easy to test.
INSERT OR IGNORE INTO guests (party_id, first_name, last_name, allow_plus_one)
SELECT p.id, v.first_name, v.last_name, v.allow_plus_one
FROM (
  SELECT 'TEST01' AS code, 'Test'    AS first_name, 'Guest'  AS last_name, 1 AS allow_plus_one
  UNION ALL SELECT 'TEST01', 'James',   'Banda',   0
  UNION ALL SELECT 'K3RQ7M', 'James',   'Banda',   1
  UNION ALL SELECT 'K3RQ7M', 'Grace',   'Banda',   0
  UNION ALL SELECT 'K3RQ7M', 'Tadala',  'Banda',   0
  UNION ALL SELECT 'B8XN2V', 'Chisomo', 'Phiri',   1
  UNION ALL SELECT 'W5HJ9T', 'Peter',   'Mwale',   0
  UNION ALL SELECT 'W5HJ9T', 'Esnart',  'Mwale',   0
) v
JOIN parties p ON p.code = v.code;

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
