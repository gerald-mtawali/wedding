-- Read-only assertions against a freshly reset + seeded database.
--
--   npx wrangler d1 execute wedding --local --file=../db/verify.sql
--   sqlite3 /tmp/wedding-check.db < db/verify.sql            (pure sqlite3)
--
-- Every statement returns a `check` label and a `result` of PASS or FAIL, so
-- the output can be skimmed rather than read. Nothing here writes.
--
-- Deliberately avoids the pragma_*() table-valued functions and sticks to
-- sqlite_master, because D1 accepts only a narrow set of PRAGMA forms and this
-- file has to run identically under D1 and a plain sqlite3 shell.

-- 1. The new guest columns exist. Naming them in the SELECT list is the test:
--    a missing column makes the statement fail outright.
SELECT '1. guests columns' AS "check",
       CASE WHEN COUNT(*) = 10 THEN 'PASS' ELSE 'FAIL' END AS result,
       COUNT(middle_name)   AS with_middle,
       COUNT(name_key)      AS keyed,
       COUNT(search_key)    AS searchable,
       SUM(allow_plus_one)  AS plus_ones_allowed
FROM guests;

-- 2. The new RSVP columns exist.
SELECT '2. rsvps columns' AS "check",
       CASE WHEN COUNT(*) = 3 THEN 'PASS' ELSE 'FAIL' END AS result,
       COUNT(phone)            AS with_phone,
       COUNT(dietary_notes)    AS with_notes,
       COUNT(plus_one_name)    AS with_plus_one,
       COUNT(plus_one_dietary) AS plus_one_diets
FROM rsvps;

-- 3. name_key includes the middle part; search_key drops it. This is the
--    single most important assertion in the file: it is why "John Banda"
--    finds two people, and why those two people are still distinct rows.
SELECT '3. generated keys' AS "check",
       CASE WHEN COUNT(*) = 2 THEN 'PASS' ELSE 'FAIL' END AS result
FROM guests
WHERE search_key = 'john banda' AND name_key <> 'john banda';

SELECT '3b. key detail' AS "check", first_name, middle_name, last_name,
       name_key, search_key
FROM guests WHERE search_key = 'john banda' ORDER BY name_key;

-- 4. Tier 2 in SQL: the two Johns must sit in DIFFERENT households, or the
--    disambiguation screen has nothing to show the guest.
SELECT '4. disambiguator' AS "check",
       CASE WHEN COUNT(DISTINCT p.label) = 2 THEN 'PASS' ELSE 'FAIL' END AS result,
       group_concat(p.label, ' | ') AS households
FROM guests g JOIN parties p ON p.id = g.party_id
WHERE g.search_key = 'john banda';

-- 5. A stored middle name is still there to be matched against a typed
--    initial (matcher tier 3 — the comparison itself is Worker-side).
SELECT '5. middle name kept' AS "check",
       CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS result
FROM guests WHERE search_key = 'grace banda' AND lower(middle_name) LIKE 't%';

-- 6. Household labels are unique — required for check 4 to ever be meaningful.
SELECT '6. unique labels' AS "check",
       CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS result
FROM sqlite_master
WHERE type = 'index' AND name = 'idx_parties_label' AND upper(sql) LIKE '%UNIQUE%';

-- 7. One RSVP per guest is still structurally impossible to violate.
SELECT '7. unique rsvp' AS "check",
       CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS result
FROM sqlite_master
WHERE type = 'index' AND name = 'idx_rsvps_guest' AND upper(sql) LIKE '%UNIQUE%';

-- 8. A plus-one must NOT be findable by the name search — no guests row.
SELECT '8. plus-one hidden' AS "check",
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result
FROM guests WHERE search_key = 'yamikani nkhoma';

-- 9. ...but must still appear in the summary, attributed to their host, with
--    their own dietary requirement intact.
SELECT '9. plus-one counted' AS "check",
       CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS result
FROM rsvp_summary
WHERE kind = 'plus-one' AND name = 'Yamikani Nkhoma'
  AND via = 'Chisomo Phiri' AND dietary = 'halaal';

-- 10. A declining guest brings nobody to the headcount.
SELECT '10. decline excluded' AS "check",
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result
FROM rsvp_summary WHERE status = 'attending' AND name LIKE 'Peter%';

-- 11. Legacy invite codes are gone from the identity path.
SELECT '11. codes retired' AS "check",
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result
FROM parties WHERE code IS NOT NULL;

-- 12. Full picture, for eyeballing.
SELECT '--- rsvp_summary ---' AS "check";
SELECT kind, name, household, via, status, dietary, phone FROM rsvp_summary;

SELECT '--- rsvp_headcount ---' AS "check";
SELECT * FROM rsvp_headcount;
