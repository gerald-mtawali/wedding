-- ===========================================================================
-- Registry batch 002 — the initial list.
--
-- Transcribed from the registry spreadsheet, including the product links from
-- the "Alternative Stores for Products" section at the foot of it.
--
-- IDEMPOTENT. `INSERT OR IGNORE` plus the unique indexes on
-- `registry_items(name)` and `registry_item_options(item_id, url)` mean
-- re-running this inserts nothing new. Safe to re-run after a half-failed
-- run, and safe to apply to a fresh database.
--
-- Because OR IGNORE swallows collisions silently, the assertions at the foot
-- of this file are not optional decoration — a batch that inserted nothing
-- looks exactly like a batch that worked. Read the PASS/FAIL output.
--
-- APPLY (after 001-schema.sql):
--   cd api
--   npx wrangler d1 execute wedding --local  --file=../db/registry/002-items.sql
--   npx wrangler d1 execute wedding --remote --file=../db/registry/002-items.sql
--
-- ---------------------------------------------------------------------------
-- THINGS THAT NEEDED A JUDGEMENT CALL — all six are marked ★ below.
-- ---------------------------------------------------------------------------
--   1. Tracking parameters stripped from every URL. gclid, gad_*, gbraid,
--      utm_*, _pos, _fid, _ss, _sid, srno, otracker, iid, ppt, ppn, ssid and
--      _gl are ad-click and search-session tokens: they expire, and a few
--      would eventually land on the wrong variant or 404. The parameters that
--      identify the actual product — pid, variant, idsku, skuId, id, name,
--      vid — are kept.
--   2. Two links moved off "Knife Set" onto "Utensils" (they are utensil
--      sets). Marked at both ends.
--   3. Curtains: cost and balanced look swapped relative to the bedding rows.
--      Left as written in the sheet.
--   4. "Bakeware" holds one link, and it is a measuring jug.
--   5. A coffee canister filed under Utensils.
--   6. Store homepages and category/browse pages NOT loaded — they are not
--      products. See the note at the very bottom.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. The item types.
--
-- `sort_order` runs in tens, grouped by category, so a new item drops in
-- between two others without renumbering anything.
--
-- Written as a multi-row VALUES clause and NOT as `SELECT … UNION ALL
-- SELECT …`. D1's SQLite caps compound-SELECT terms far below stock SQLite
-- and fails at around nine rows with "too many terms in compound SELECT";
-- a VALUES clause is not counted the same way. Same note as
-- db/guests/000-template.sql.
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO registry_items
  (name, description, kind, category, price_cents, price_max_cents, sort_order)
VALUES
  -- Honeymoon -------------------------------------------------------------
  ('Honeymoon Fund',
   'A contribution towards our first trip away as a married couple.',
   'cash', 'Honeymoon', NULL, NULL, 10),

  -- Appliances ------------------------------------------------------------
  ('Fridge',
   'A double-door fridge with a bottom-mount freezer.',
   'item', 'Appliances', 799900, NULL, 100),
  ('Microwave',
   'A 40L solo microwave — nothing fancy, just roomy.',
   'item', 'Appliances', 250000, 370000, 110),
  ('Kettle',
   'Something we will look at every single morning.',
   'item', 'Appliances', 480000, NULL, 120),
  ('Stand Mixer',
   'For the baking we keep promising each other we will do.',
   'item', 'Appliances', 570000, NULL, 130),
  ('Air Fryer',
   'A dual-basket one, so two things can cook at once.',
   'item', 'Appliances', 150000, NULL, 140),
  ('Blender',
   'For smoothies, soups and sauces.',
   'item', 'Appliances', NULL, NULL, 150),
  ('Food Processor',
   'Chopping, grating, and the jobs that make cooking feel long.',
   'item', 'Appliances', NULL, NULL, 160),

  -- Cookware --------------------------------------------------------------
  ('Pots',
   'A set we can cook out of for years.',
   'item', 'Cookware', NULL, NULL, 200),
  ('Pans & Cast Iron',
   'A skillet, a griddle, a wok — the pieces that only get better with use.',
   'item', 'Cookware', NULL, NULL, 210),
  ('Casserole Dishes',
   'Oven to table, ideally without needing a serving bowl in between.',
   'item', 'Cookware', NULL, NULL, 220),
  ('Bakeware',
   'Trays, tins and the odds and ends that go with them.',
   'item', 'Cookware', NULL, NULL, 230),

  -- Kitchen tools ---------------------------------------------------------
  ('Knife Set',
   'A block set — sharp, balanced, and stored somewhere sensible.',
   'item', 'Kitchen', NULL, NULL, 300),
  ('Utensils',
   'Spoons, tongs, spatulas. The drawer that is never quite complete.',
   'item', 'Kitchen', NULL, NULL, 310),

  -- Dining ----------------------------------------------------------------
  ('Cutlery',
   'A full set, enough for a table of guests.',
   'item', 'Dining', NULL, NULL, 400),
  ('Dinner Plates',
   'A dinner set we would happily put in front of anyone.',
   'item', 'Dining', NULL, NULL, 410),
  ('Serving Bowls',
   'Big enough for salad for the whole table.',
   'item', 'Dining', NULL, NULL, 420),
  ('Cups & Mugs',
   'For long slow mornings and longer evenings.',
   'item', 'Dining', NULL, NULL, 430),
  ('Glassware',
   'Wine glasses and something to toast with.',
   'item', 'Dining', NULL, NULL, 440),
  ('Serveware',
   'Cake stands, servers, the things that come out when people visit.',
   'item', 'Dining', NULL, NULL, 450),

  -- Bedroom ---------------------------------------------------------------
  ('Bed Set',
   'A duvet cover set — aiming for 300 thread count or better.',
   'item', 'Bedroom', 134900, NULL, 500),
  ('Flat Sheets',
   'Aiming for 300 thread count or better.',
   'item', 'Bedroom', NULL, NULL, 510),
  ('Fitted Sheets',
   'Aiming for 300 thread count or better.',
   'item', 'Bedroom', NULL, NULL, 520),

  -- Home ------------------------------------------------------------------
  ('Curtains',
   'Lined and blockout, in extra length.',
   'item', 'Home', NULL, NULL, 600),
  ('Towels, Bath Mats & Rugs',
   'Still browsing this one — Linen House, Hertex Haus and Volpes are where we are looking.',
   'item', 'Home', NULL, NULL, 610);

-- ---------------------------------------------------------------------------
-- 2. The products we have looked at.
--
-- Each row resolves its own parent by name, so the file can be re-run and
-- read on its own without knowing any generated ids.
--
-- Split into one statement per category. Purely for readability and so a
-- failure names a small blast radius — there is no size limit being dodged.
-- ---------------------------------------------------------------------------

-- Appliances ---------------------------------------------------------------
INSERT OR IGNORE INTO registry_item_options
  (item_id, label, retailer, product, url, sort_order)
VALUES
  ((SELECT id FROM registry_items WHERE name = 'Fridge'),
   'Caught our eye', 'Makro',
   'Defy 348L Double Door Bottom Mount Fridge with Base Drawer',
   'https://www.makro.co.za/defy-348-l-double-door-bottom-mount-fridge-base-drawer/p/itm08e969a7bda07?pid=RFRHGPZF2H55PFW7', 10),

  ((SELECT id FROM registry_items WHERE name = 'Microwave'),
   'Caught our eye', 'HiFi Corp',
   'Samsung 40L Solo Microwave, black (MS40DG5504AG)',
   'https://www.hificorp.co.za/samsung-40l-solo-microwave-black-ms40dg5504agfa', 10),

  ((SELECT id FROM registry_items WHERE name = 'Kettle'),
   'Caught our eye', 'Smeg',
   'Smeg 50s Style Kettle, black (KLF03BLMSA)',
   'https://www.smeg.com/za/products/KLF03BLMSA', 10),

  ((SELECT id FROM registry_items WHERE name = 'Stand Mixer'),
   'Caught our eye', 'Bash',
   'Kenwood kMix 5L Stand Mixer, matte white',
   'https://bash.com/kenwood-kmix-5l-stand-mixer-matte-white-153301aaqn0/p?idsku=1790598', 10),

  ((SELECT id FROM registry_items WHERE name = 'Air Fryer'),
   'Caught our eye', 'HiFi Corp',
   'Defy 8.4L Digital Dual Basket Air Fryer (DAF6386DBD)',
   'https://www.hificorp.co.za/defy-8-4l-digital-dual-basket-air-fryer-daf6386dbd', 10),

  ((SELECT id FROM registry_items WHERE name = 'Blender'),
   'Quality focused', 'Yuppiechef',
   'Kenwood Multipro Express Food Processor & Blender, 1000W',
   'https://www.yuppiechef.com/kenwood.htm?id=70666&name=Kenwood-Multipro-Express-Food-Processor-and-Blender-1000W', 10),
  ((SELECT id FROM registry_items WHERE name = 'Blender'),
   'Balanced', 'Yuppiechef',
   'Russell Hobbs Nexus Glass Jug Blender, 1.5L',
   'https://www.yuppiechef.com/russell-hobbs-food-preparation.htm?id=65661&name=Russell-Hobbs-Nexus-Glass-Jug-Blender-1.5L&vid=1738725', 20),

  -- The same Kenwood appears under both Blender and Food Processor. That is
  -- allowed — the unique index is per item — and it is correct: the machine
  -- is both, so buying it satisfies either line. Worth deciding whether you
  -- want these as two items at all.
  ((SELECT id FROM registry_items WHERE name = 'Food Processor'),
   'Balanced', 'Yuppiechef',
   'Kenwood Multipro Express Food Processor & Blender, 1000W',
   'https://www.yuppiechef.com/kenwood.htm?id=70666&name=Kenwood-Multipro-Express-Food-Processor-and-Blender-1000W', 10);

-- Cookware -----------------------------------------------------------------
INSERT OR IGNORE INTO registry_item_options
  (item_id, label, retailer, product, url, sort_order)
VALUES
  ((SELECT id FROM registry_items WHERE name = 'Pots'),
   'Quality focused', 'Bash',
   'Cuisine Pro Iconix Pot Set, 7 pieces',
   'https://bash.com/cuisine-pro-iconix-pot-set-7pc-153300aaqy7/p', 10),
  ((SELECT id FROM registry_items WHERE name = 'Pots'),
   'Quality focused', 'Kitchenique',
   'Tefal Jamie Oliver Stainless Steel Set, 5 pieces',
   'https://kitchenique.co.za/products/tefal-jamie-oliver-5-piece-set-stainless-steel', 20),
  ((SELECT id FROM registry_items WHERE name = 'Pots'),
   'Cost focused', 'Bash',
   'Tramontina Loreto Non-Stick Cookware Set, 8 pieces',
   'https://bash.com/tramontina-8-piece-loreto-non-stick-cookware-set-374509adpx5/p', 30),
  ((SELECT id FROM registry_items WHERE name = 'Pots'),
   'Caught our eye', 'Kitchenique',
   'Fig Non-Stick Cookware Set with Glass Lids, 7 pieces',
   'https://kitchenique.co.za/products/fig-cookware-set-non-stick-with-glass-lids-7-piece', 40),

  ((SELECT id FROM registry_items WHERE name = 'Pans & Cast Iron'),
   'Caught our eye', 'Kitchenique',
   'Victoria Cast Iron Skillet, 30cm',
   'https://kitchenique.co.za/products/victoria-cast-iron-skillet-30cm', 10),
  ((SELECT id FROM registry_items WHERE name = 'Pans & Cast Iron'),
   'Caught our eye', 'Kitchenique',
   'Victoria Cast Iron Griddle, 26cm',
   'https://kitchenique.co.za/products/victoria-cast-iron-griddle-26cm', 20),
  ((SELECT id FROM registry_items WHERE name = 'Pans & Cast Iron'),
   'Caught our eye', 'Kitchenique',
   'Victoria Cast Iron Wok, 36cm, smooth balanced base',
   'https://kitchenique.co.za/products/victoria-cast-iron-wok-36cm-smooth-balanced-base', 30),
  ((SELECT id FROM registry_items WHERE name = 'Pans & Cast Iron'),
   'Caught our eye', 'Kitchenique',
   'Ken Hom Excellence Set',
   'https://kitchenique.co.za/products/ken-hom-excellence-set', 40),

  ((SELECT id FROM registry_items WHERE name = 'Casserole Dishes'),
   'Cost focused', 'Bash',
   'Skye Square Casserole, blue 30cm',
   'https://bash.com/skye-square-casserole-blue-30cm-153300aakx2/p?skuId=1635540', 10),
  ((SELECT id FROM registry_items WHERE name = 'Casserole Dishes'),
   'Caught our eye', 'Kitchenique',
   'Maxwell & Williams Round Casserole, green 26cm',
   'https://kitchenique.co.za/products/maxwell-williams-round-casserole-green-26cm', 20),
  ((SELECT id FROM registry_items WHERE name = 'Casserole Dishes'),
   'Caught our eye', 'Kitchenique',
   'Maxwell & Williams Roaster, merlot 28x21cm',
   'https://kitchenique.co.za/products/maxwell-williams-roaster-merlot-28x21cm', 30),

  -- ★ 4. This is the ONLY link filed under "Baking Trays and Pans" in the
  -- sheet, and it is a measuring jug. Loaded as written so nothing is lost,
  -- but the item currently has no actual bakeware in it — either add some
  -- links or set is_active = 0 until you do.
  ((SELECT id FROM registry_items WHERE name = 'Bakeware'),
   'Caught our eye', 'Kitchenique',
   'Pyrex Measuring Jug, 1L',
   'https://kitchenique.co.za/products/pyrex-measuring-jug-1l', 10);

-- Kitchen tools ------------------------------------------------------------
INSERT OR IGNORE INTO registry_item_options
  (item_id, label, retailer, product, url, sort_order)
VALUES
  ((SELECT id FROM registry_items WHERE name = 'Knife Set'),
   'Quality focused', 'Kitchenique',
   'Tramontina Knife Block Set, 6 pieces',
   'https://kitchenique.co.za/products/tramontina-knife-block-set-6-pieces', 10),
  ((SELECT id FROM registry_items WHERE name = 'Knife Set'),
   'Quality focused', 'Kitchenique',
   'Joseph Joseph Folio Plus Knife & Chopping Board Set, graphite',
   'https://kitchenique.co.za/products/joseph-joseph-folio-plus-knife-chopping-b-graphite', 20),
  ((SELECT id FROM registry_items WHERE name = 'Knife Set'),
   'Cost focused', 'Yuppiechef',
   'Humble & Mash Gripline Knife Block Set, 6 piece',
   'https://www.yuppiechef.com/humble-and-mash-knives.htm?id=59415&name=Humble-and-Mash-Gripline-Series-Knife-Block-Set-6-Piece', 30),
  ((SELECT id FROM registry_items WHERE name = 'Knife Set'),
   'Cost focused', 'Bed Bath Home',
   'Moretti Pro Knife Block Set, 7 pieces',
   'https://bedbathhome.co.za/products/moretti-pro-knife-block-set-of-7', 40),
  -- ★ 2. The sheet's "Balanced" column for Knife Set holds two Joseph Joseph
  -- UTENSIL sets, not knives. They are loaded under Utensils below instead.
  -- Move them back here if that was deliberate.

  ((SELECT id FROM registry_items WHERE name = 'Utensils'),
   'Quality focused', 'Yuppiechef',
   'Le Creuset Utensil Set, 5 piece',
   'https://www.yuppiechef.com/le-creuset-utensils.htm?id=43607&name=Le-Creuset-Utensil-Set-5-Piece', 10),
  ((SELECT id FROM registry_items WHERE name = 'Utensils'),
   'Balanced', 'Yuppiechef',
   'KitchenCraft Idilica Silicone Tool Set, set of 5',
   'https://www.yuppiechef.com/kitchencraft-cooks-tools.htm?id=61401&name=KitchenCraft-Idilica-Silicone-Tool-Set-Set-of-5', 20),
  ((SELECT id FROM registry_items WHERE name = 'Utensils'),
   'Balanced', 'Yuppiechef',
   'Brabantia Non-Stick Kitchen Utensils Set',
   'https://www.yuppiechef.com/brabantia-food-preparation.htm?id=53506&name=Brabantia-Non-Stick-Kitchen-Utensils-Set', 30),
  -- ★ 2. Moved here from the Knife Set row — see above.
  ((SELECT id FROM registry_items WHERE name = 'Utensils'),
   'Balanced', 'Kitchenique',
   'Joseph Joseph Nest Utensils, steel',
   'https://kitchenique.co.za/products/joseph-joseph-nest-utensils-steel', 40),
  ((SELECT id FROM registry_items WHERE name = 'Utensils'),
   'Balanced', 'Kitchenique',
   'Joseph Joseph Elevate In-Drawer Utensil Set',
   'https://kitchenique.co.za/products/joseph-joseph-elevate-in-drawer-utensil-set', 50),
  ((SELECT id FROM registry_items WHERE name = 'Utensils'),
   'Caught our eye', 'Kitchenique',
   'Joseph Joseph Elevate Steel Tongs, green',
   'https://kitchenique.co.za/products/joseph-joseph-elevate-steel-tongs-green', 60),
  ((SELECT id FROM registry_items WHERE name = 'Utensils'),
   'Caught our eye', 'Yuppiechef',
   'Zone Denmark Singles Kitchen Utensils, set of 4',
   'https://www.yuppiechef.com/zone-denmark.htm?id=67404&name=Zone-Denmark-Singles-Kitchen-Utensils-Set-of-4', 70),
  -- ★ 5. A coffee canister, filed under Utensils in the sheet. Storage rather
  -- than a utensil — it may want its own item, or to be dropped.
  ((SELECT id FROM registry_items WHERE name = 'Utensils'),
   'Caught our eye', 'Kitchenique',
   'Typhoon Living Coffee Canister, grey',
   'https://kitchenique.co.za/products/typhoon-living-grey-coffee-canister', 80);

-- Dining -------------------------------------------------------------------
INSERT OR IGNORE INTO registry_item_options
  (item_id, label, retailer, product, url, sort_order)
VALUES
  -- The product name follows the retailer's spelling ("Wilkilson") only where
  -- the slug is the URL; the brand is Wilkinson Sword.
  ((SELECT id FROM registry_items WHERE name = 'Cutlery'),
   'Quality focused', 'Kitchenique',
   'Newport Cutlery Set, 56 pieces',
   'https://kitchenique.co.za/products/newport-cutlery-set-56-pieces', 10),
  ((SELECT id FROM registry_items WHERE name = 'Cutlery'),
   'Cost focused', 'Kitchenique',
   'St James Kensington Cutlery Set, 24 pieces',
   'https://kitchenique.co.za/products/st-james-cutlery-kensington-24pc-set', 20),
  ((SELECT id FROM registry_items WHERE name = 'Cutlery'),
   'Cost focused', 'Kitchenique',
   'Slimline Cutlery Set, 24 pieces',
   'https://kitchenique.co.za/products/slimline-cutlery-set-24-pieces', 30),
  ((SELECT id FROM registry_items WHERE name = 'Cutlery'),
   'Balanced', 'Kitchenique',
   'Wilkinson Sword Baguette Cutlery Set, 24 pieces',
   'https://kitchenique.co.za/products/wilkilson-sword-baguette-cutlery-set-24-piece', 40),
  ((SELECT id FROM registry_items WHERE name = 'Cutlery'),
   'Caught our eye', 'Yuppiechef',
   'Yuppiechef Nova Cutlery Set, 48 piece',
   'https://www.yuppiechef.com/yuppiechef-cutlery.htm?id=68625&name=Yuppiechef-Nova-Cutlery-Set-48-Piece', 50),
  ((SELECT id FROM registry_items WHERE name = 'Cutlery'),
   'Caught our eye', 'Yuppiechef',
   'Eetrite Slimline Cutlery Set, 24 piece',
   'https://www.yuppiechef.com/eetrite-cutlery-and-knives.htm?id=55985&name=Eetrite-Slimline-Cutlery-Set-24-Piece', 60),
  ((SELECT id FROM registry_items WHERE name = 'Cutlery'),
   'Caught our eye', 'Hertex Haus',
   'Cuisine Cutlery Set, 20 pieces, matte silver',
   'https://hertexhaus.co.za/collections/tableware/products/cuisine-cutlery-set-of-20-pcs-matte-silver', 70),

  ((SELECT id FROM registry_items WHERE name = 'Dinner Plates'),
   'Quality focused', 'Yuppiechef',
   'Mason Cash Classic Collection Dinner Set, 12 piece',
   'https://www.yuppiechef.com/mason-cash-dinnerware.htm?id=38005&name=Mason-Cash-Classic-Collection-Dinner-Set-12-Piece', 10),
  ((SELECT id FROM registry_items WHERE name = 'Dinner Plates'),
   'Quality focused', 'Hertex Haus',
   'Wholesome Dinner Plate Set of 4, risotto',
   'https://hertexhaus.co.za/collections/tableware/products/wholesome-dinner-plate-set-4-risotto', 20),
  ((SELECT id FROM registry_items WHERE name = 'Dinner Plates'),
   'Cost focused', 'Kitchenique',
   'Maxwell & Williams White Basics Soho Rim Dinner Set, 16 piece',
   'https://kitchenique.co.za/products/maxwell-williams-wba-soho-rim-dinner-set-16pc', 30),
  ((SELECT id FROM registry_items WHERE name = 'Dinner Plates'),
   'Cost focused', 'Kitchenique',
   'Maxwell & Williams Coupe Tribeca Dinner Set, 12 piece',
   'https://kitchenique.co.za/products/maxwell-williams-coupe-tribeca-dinner-set-12-piece', 40),
  ((SELECT id FROM registry_items WHERE name = 'Dinner Plates'),
   'Balanced', 'Kitchenique',
   'Maxwell & Williams Tribeca Dinner Set, 18 pieces',
   'https://kitchenique.co.za/products/maxwell-williams-tribeca-dinner-set-of-18-pieces', 50),
  ((SELECT id FROM registry_items WHERE name = 'Dinner Plates'),
   'Balanced', 'Kitchenique',
   'Maxwell & Williams Caviar Dinner Set, 12 piece, black',
   'https://kitchenique.co.za/products/maxwell-williams-caviar-dinner-set-12-piece-black', 60),
  ((SELECT id FROM registry_items WHERE name = 'Dinner Plates'),
   'Caught our eye', 'Hertex Haus',
   'Sidekick Side Plate Set of 4, cashew',
   'https://hertexhaus.co.za/collections/tableware/products/sidekick-side-plate-set-of-4-cashew', 70),
  ((SELECT id FROM registry_items WHERE name = 'Dinner Plates'),
   'Caught our eye', 'Babylonstoren',
   'Round Slip Plate, large green',
   'https://shop.babylonstoren.com/za/p/1864/round-slip-plate-large-green', 80),
  ((SELECT id FROM registry_items WHERE name = 'Dinner Plates'),
   'Caught our eye', 'Bash',
   'Home Essentials Dinnerware, 12 piece, fatigue',
   'https://bash.com/home-essentials-dinnerware-12pc-fatigue-153300aaur3/p?idsku=1622392', 90),
  ((SELECT id FROM registry_items WHERE name = 'Dinner Plates'),
   'Caught our eye', 'Le Creuset',
   'Stoneware Coupe Plates, set of 4',
   'https://www.lecreuset.co.za/stoneware-coupe-set-of-4-plates/79405007979019.html', 100),

  ((SELECT id FROM registry_items WHERE name = 'Serving Bowls'),
   'Cost focused', 'Kitchenique',
   'Jan Hendrik Ashes Salad Bowl, olive grey',
   'https://kitchenique.co.za/products/jan-hendrik-ashes-olive-grey-salad-bowl', 10),
  ((SELECT id FROM registry_items WHERE name = 'Serving Bowls'),
   'Cost focused', 'Kitchenique',
   'Maxwell & Williams Serving Bowl, oval 30x20cm',
   'https://kitchenique.co.za/products/maxwell-williams-serving-bowl-oval-30x20cm', 20),
  ((SELECT id FROM registry_items WHERE name = 'Serving Bowls'),
   'Caught our eye', 'Le Creuset',
   'Stoneware Coupe Cereal Bowls, set of 4',
   'https://www.lecreuset.co.za/stoneware-coupe-set-of-4-cereal-bowls-multicolor-0.77l/79291857978019.html', 30),

  ((SELECT id FROM registry_items WHERE name = 'Cups & Mugs'),
   'Cost focused', 'Hertex Haus',
   'Wholesome Cup & Saucer Set of 4, salt',
   'https://hertexhaus.co.za/products/wholesome-cup-saucer-set-4-salt?variant=42382853242965', 10),

  ((SELECT id FROM registry_items WHERE name = 'Glassware'),
   'Caught our eye', 'Kitchenique',
   'Luigi Bormioli Sublime Flute 210ml, 4 piece',
   'https://kitchenique.co.za/products/luigi-bormioli-sublime-flute-210ml-4-piece', 10),
  ((SELECT id FROM registry_items WHERE name = 'Glassware'),
   'Caught our eye', 'Kitchenique',
   'La Divina Burgundy Goblet, set of 4',
   'https://kitchenique.co.za/products/la-divina-burgundy-goblet-set-of-4', 20),

  ((SELECT id FROM registry_items WHERE name = 'Serveware'),
   'Caught our eye', 'Bash',
   'Malda Footed Cake Stand with Dome',
   'https://bash.com/malda-serveware-footed-cake-stand-with-dome-153300aals9/p', 10),
  ((SELECT id FROM registry_items WHERE name = 'Serveware'),
   'Caught our eye', 'Kitchenique',
   'Maxwell & Williams Diamonds Cake Server & Fork Set, 7 piece',
   'https://kitchenique.co.za/products/maxwell-williams-diamonds-cake-server-fork-set-7pc', 20);

-- Bedroom ------------------------------------------------------------------
INSERT OR IGNORE INTO registry_item_options
  (item_id, label, retailer, product, url, sort_order)
VALUES
  ((SELECT id FROM registry_items WHERE name = 'Bed Set'),
   'Quality focused', 'Hertex Haus',
   'Sanctuary Bed Set',
   'https://hertexhaus.co.za/collections/bedding/products/sanctuary-bed-set-copy-8?variant=42754153250901', 10),
  ((SELECT id FROM registry_items WHERE name = 'Bed Set'),
   'Cost focused', 'Woolworths',
   'Silky Soft Textured Hypoallergenic Microfibre Duvet Cover Set',
   'https://www.woolworths.co.za/prod/Home/Bedroom/Bed-Linen/Duvet-Covers/Woolworths-Silky-Soft-Textured-Hypoallergenic-Microfibre-Duvet-Cover-Set/_/A-508362156', 20),
  ((SELECT id FROM registry_items WHERE name = 'Bed Set'),
   'Balanced', 'Bed Bath Home',
   'Whisper Soft 400TC Sateen Egyptian Cotton Satin Stitch Duvet Cover Set, black on white',
   'https://bedbathhome.co.za/products/whisper-soft-400-thread-count-sateen-egyptian-cotton-two-line-black-on-white-satin-stitch-duvet-cover-set', 30),

  ((SELECT id FROM registry_items WHERE name = 'Flat Sheets'),
   'Quality focused', 'Hertex Haus',
   'Resort Flat Sheet',
   'https://hertexhaus.co.za/products/resort-flat-sheet-copy', 10),
  ((SELECT id FROM registry_items WHERE name = 'Flat Sheets'),
   'Cost focused', 'Woolworths',
   '200TC Washed Cotton Sateen Flat Sheet',
   'https://www.woolworths.co.za/prod/Home/Bedroom/Bed-Linen/Bed-Sheets/Woolworths-200TC-Washed-Cotton-Sateen-Flat-Sheet/_/A-508610954', 20),
  ((SELECT id FROM registry_items WHERE name = 'Flat Sheets'),
   'Balanced', 'Bed Bath Home',
   'T300 Silver Ribbon 300TC Flat Sheet',
   'https://bedbathhome.co.za/products/t300-silver-ribbon-300tc-flat-sheet?variant=15933518872665', 30),

  ((SELECT id FROM registry_items WHERE name = 'Fitted Sheets'),
   'Quality focused', 'Hertex Haus',
   'Sanctuary Fitted Sheet',
   'https://hertexhaus.co.za/collections/bedding/products/sanctuary-fitted-sheet-copy-3', 10),
  ((SELECT id FROM registry_items WHERE name = 'Fitted Sheets'),
   'Cost focused', 'Woolworths',
   '200TC Percale Cotton Fitted Sheet, XD/XL',
   'https://www.woolworths.co.za/prod/Home/Bedroom/Bed-Linen/Bed-Sheets/Woolworths-200TC-Percale-Cotton-Fitted-Sheet-XDXL/_/A-510926134', 20),
  ((SELECT id FROM registry_items WHERE name = 'Fitted Sheets'),
   'Balanced', 'Bed Bath Home',
   '500TC Sateen Egyptian Cotton Fitted Sheet, silver',
   'https://bedbathhome.co.za/products/500-thread-count-sateen-egyptian-cotton-silver-fitted-sheet?variant=36541325639833', 30);

-- Home ---------------------------------------------------------------------
-- ★ 3. Cost and balanced are the other way round here compared with the three
-- bedding rows above (Bed Bath Home in the cost column, Woolworths in the
-- balanced one). Loaded exactly as the sheet has it — worth a second look.
INSERT OR IGNORE INTO registry_item_options
  (item_id, label, retailer, product, url, sort_order)
VALUES
  ((SELECT id FROM registry_items WHERE name = 'Curtains'),
   'Quality focused', 'Hertex Haus',
   'Lario Ready-Made Lined Extra Length Curtain, biscotti',
   'https://hertexhaus.co.za/collections/curtains/products/lario-ready-made-lined-extra-length-curtain-biscotti', 10),
  ((SELECT id FROM registry_items WHERE name = 'Curtains'),
   'Cost focused', 'Bed Bath Home',
   'Enigma Taped Woven Blockout, taupe',
   'https://bedbathhome.co.za/products/enigma-taped-woven-blockout-taupe', 20),
  ((SELECT id FROM registry_items WHERE name = 'Curtains'),
   'Balanced', 'Woolworths',
   'Harrison Longer Length Block Out Taped Curtain, 260cm x 250cm',
   'https://www.woolworths.co.za/prod/Home/Home-Decor/Curtains-Hardware/Curtains/Taped/Woolworths-Harrison-Longer-Length-Block-Out-Taped-Curtain-260cm-W-x-250cm-L-/_/A-509807502', 30);

-- "Towels, Bath Mats & Rugs" intentionally has no options: the sheet lists
-- only shops for it, not products. It still belongs on the page — a guest who
-- wants to give towels should know towels are wanted.

-- ---------------------------------------------------------------------------
-- 3. Assertions.
--
-- `INSERT OR IGNORE` swallows constraint violations silently, a typo that
-- collided with an existing row included. A batch that inserted nothing looks
-- exactly like a batch that succeeded, so check the numbers.
-- ---------------------------------------------------------------------------
SELECT 'items loaded' AS "check",
       CASE WHEN COUNT(*) = 25 THEN 'PASS' ELSE 'FAIL - expected 25' END AS result,
       COUNT(*) AS found
FROM registry_items;

SELECT 'options loaded' AS "check",
       CASE WHEN COUNT(*) = 69 THEN 'PASS' ELSE 'FAIL - expected 69' END AS result,
       COUNT(*) AS found
FROM registry_item_options;

-- 69 options across 68 distinct URLs. The one repeat is the Kenwood Multipro,
-- listed under both Blender and Food Processor on purpose.
SELECT 'distinct urls' AS "check",
       CASE WHEN COUNT(DISTINCT url) = 68 THEN 'PASS' ELSE 'FAIL - expected 68' END AS result,
       COUNT(DISTINCT url) AS found
FROM registry_item_options;

-- Every option must have found its parent. A NULL item_id would mean a name
-- in section 2 does not match any name in section 1 — a typo in one of the
-- subqueries. NOT NULL on the column turns that into an error at insert time
-- rather than a silently orphaned row, so this should always be 0.
SELECT 'orphaned options' AS "check",
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result,
       COUNT(*) AS found
FROM registry_item_options o
LEFT JOIN registry_items i ON i.id = o.item_id
WHERE i.id IS NULL;

-- An item with no options and no item_url gives a guest nowhere to go. One is
-- expected and deliberate: "Towels, Bath Mats & Rugs".
SELECT 'items with no product links' AS "check",
       CASE WHEN COUNT(*) <= 2 THEN 'PASS' ELSE 'FAIL - check which' END AS result,
       COUNT(*) AS found
FROM registry_items i
WHERE i.kind = 'item'
  AND i.item_url IS NULL
  AND NOT EXISTS (SELECT 1 FROM registry_item_options o WHERE o.item_id = i.id);

-- The shape of the list, for eyeballing.
SELECT i.category, i.name, COUNT(o.id) AS options
FROM registry_items i
LEFT JOIN registry_item_options o ON o.item_id = i.id
GROUP BY i.id
ORDER BY i.sort_order;

-- ---------------------------------------------------------------------------
-- ★ 6. NOT LOADED, deliberately.
--
-- The "Alternative Stores for Products" section also lists shop homepages and
-- category/browse pages: linenhouse.co.za, boardmans.co.za, the Hertex Haus
-- and Babylonstoren homepages, the Bash and Woolworths curtain categories, an
-- Amazon curtains node, and a Yuppiechef serving-bowls listing page.
--
-- They are not products, so they do not belong in registry_item_options — a
-- guest clicking "Balanced" and landing on a shop's front page is a worse
-- experience than no link at all. If you want them on the page they want
-- their own small `registry_stores` table (name, url, what they are good
-- for), which is a five-minute addition. Say the word.
--
-- Also not loaded: the send-off party notes (Peak Gardens, House of Florence)
-- and the Google Sheets link. Neither is registry data, and the sheet is not
-- public.
-- ---------------------------------------------------------------------------
