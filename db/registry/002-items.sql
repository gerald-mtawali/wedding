-- ===========================================================================
-- Registry batch 002 — the list.
--
-- Regenerated from the pruned shortlist. Replaces the first version of this
-- file entirely: items were added, renamed, split and dropped, so this is not
-- an increment on top of it.
--
-- ---------------------------------------------------------------------------
-- HOW TO REAPPLY OVER AN EARLIER RUN
-- ---------------------------------------------------------------------------
-- `INSERT OR IGNORE` cannot delete a link you removed here, and it cannot
-- update a description that changed. So if 002 has been applied before, run
-- 001 FIRST to drop and rebuild the tables, then this file:
--
--   cd api
--   npx wrangler d1 execute wedding --local --file=../db/registry/001-schema.sql
--   npx wrangler d1 execute wedding --local --file=../db/registry/002-items.sql
--
-- Applying this file alone over the old data leaves the dropped links in
-- place and the old wording intact, which looks like the file not working.
--
-- ---------------------------------------------------------------------------
-- ON `label`
-- ---------------------------------------------------------------------------
-- Every option is now 'Caught our eye'. The Quality / Cost / Balanced tiers
-- are gone: they implied a recommendation nobody asked us to make, and with a
-- guest free to buy any version the distinction was noise.
--
-- The column stays because it costs nothing and the page simply does not
-- render it. Bring the tiers back by writing different values here; no schema
-- change needed.
--
-- ---------------------------------------------------------------------------
-- IDEMPOTENT, given a matching schema. The unique indexes on
-- `registry_items(name)` and `registry_item_options(item_id, url)` mean a
-- second run inserts nothing. Because OR IGNORE swallows collisions silently,
-- the assertions at the foot of this file are how you know it landed.
--
-- URLs carry no tracking parameters. Stripped: gclid, gad_*, gbraid, utm_*,
-- _pos, _fid, _ss, _sid, srno, otracker, iid, ppt, ppn, ssid, _gl, pr_*,
-- origin, associationId. Kept: pid, variant, idsku, skuId, id, name, vid.
-- `m.yuppiechef.com` normalised to `www.yuppiechef.com`.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. The item types.
--
-- Multi-row VALUES, NOT `SELECT … UNION ALL SELECT …`. D1's SQLite caps
-- compound-SELECT terms far below stock SQLite and fails around nine rows with
-- "too many terms in compound SELECT"; a VALUES clause is not counted the same
-- way. Same note as db/guests/000-template.sql.
--
-- `sort_order` runs in tens within each category so a new item slots in
-- without renumbering the file.
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO registry_items
  (name, description, kind, category, price_cents, price_max_cents, currency, sort_order)
VALUES
  -- Honeymoon ---------------------------------------------------------
  ('Honeymoon Fund',
   'A contribution towards our first trip away as a married couple.',
   'cash', 'Honeymoon', 200000, NULL, 'USD', 10),
  -- Appliances --------------------------------------------------------
  ('Fridge',
   'A double-door fridge with a bottom-mount freezer.',
   'item', 'Appliances', 799900, NULL, 'ZAR', 100),
  ('Chest Freezer',
   'For longer-term frozen storage.',
   'item', 'Appliances', NULL, NULL, 'ZAR', 105),
  ('Microwave',
   'A 40L solo microwave. Nothing fancy, just roomy.',
   'item', 'Appliances', 250000, 370000, 'ZAR', 110),
  ('Kettle',
   'Something we will look at every single morning.',
   'item', 'Appliances', 480000, NULL, 'ZAR', 120),
  ('Coffee Machine',
   'For the mornings that need more than a kettle.',
   'item', 'Appliances', NULL, NULL, 'ZAR', 125),
  ('Stand Mixer',
   'For the baking we keep promising each other we will do.',
   'item', 'Appliances', 570000, NULL, 'ZAR', 130),
  ('Air Fryer',
   'A dual-basket one, so two things can cook at once.',
   'item', 'Appliances', 150000, NULL, 'ZAR', 140),
  ('Blender',
   'For smoothies, soups and sauces.',
   'item', 'Appliances', NULL, NULL, 'ZAR', 150),
  ('Food Processor',
   'Chopping, grating, and the jobs that make cooking feel long.',
   'item', 'Appliances', NULL, NULL, 'ZAR', 160),
  -- Cookware ----------------------------------------------------------
  ('Pots',
   'A set we can cook out of for years.',
   'item', 'Cookware', NULL, NULL, 'ZAR', 200),
  ('Pans & Cast Iron',
   'A skillet, a wok, a pan. The pieces that only get better with use.',
   'item', 'Cookware', NULL, NULL, 'ZAR', 210),
  ('Casserole Dishes',
   'Oven to table, ideally without needing a serving bowl in between.',
   'item', 'Cookware', NULL, NULL, 'ZAR', 220),
  ('Bakeware',
   'Trays, tins, bowls and the odds and ends that go with them.',
   'item', 'Cookware', NULL, NULL, 'ZAR', 230),
  -- Kitchen -----------------------------------------------------------
  ('Knife Set',
   'A sharp, well-balanced block set, and something to keep it sharp.',
   'item', 'Kitchen', NULL, NULL, 'ZAR', 300),
  ('Utensils',
   'Spoons, tongs, spatulas. The drawer that is never quite complete.',
   'item', 'Kitchen', NULL, NULL, 'ZAR', 310),
  ('Kitchen Storage',
   'Canisters for coffee, sugar, flour and everything else that comes in a bag.',
   'item', 'Kitchen', NULL, NULL, 'ZAR', 320),
  ('Food Containers',
   'For leftovers, lunches, and keeping bread fresh.',
   'item', 'Kitchen', NULL, NULL, 'ZAR', 330),
  -- Dining ------------------------------------------------------------
  ('Cutlery',
   'A full set, enough for a table of guests.',
   'item', 'Dining', NULL, NULL, 'ZAR', 400),
  ('Dinnerware',
   'A dinner set we would happily put in front of anyone.',
   'item', 'Dining', NULL, NULL, 'ZAR', 410),
  ('Serving Bowls',
   'Big enough for salad for the whole table.',
   'item', 'Dining', NULL, NULL, 'ZAR', 420),
  ('Cups & Mugs',
   'For long slow mornings and longer evenings.',
   'item', 'Dining', NULL, NULL, 'ZAR', 430),
  ('Glassware',
   'Wine glasses and something to toast with.',
   'item', 'Dining', NULL, NULL, 'ZAR', 440),
  ('Serveware',
   'Cake stands, servers, the things that come out when people visit.',
   'item', 'Dining', NULL, NULL, 'ZAR', 450),
  -- Bedroom -----------------------------------------------------------
  ('Bed Set',
   'A duvet cover set for the main bedroom.',
   'item', 'Bedroom', 134900, NULL, 'ZAR', 500),
  ('Flat Sheets',
   'Flat sheets to go with the set.',
   'item', 'Bedroom', NULL, NULL, 'ZAR', 510),
  ('Fitted Sheets',
   'Fitted sheets to match.',
   'item', 'Bedroom', NULL, NULL, 'ZAR', 520),
  -- Home --------------------------------------------------------------
  ('Curtains',
   'Lined and blockout, in extra length.',
   'item', 'Home', NULL, NULL, 'ZAR', 600),
  ('Towels, Bath Mats & Rugs',
   'Bath towels, hand towels, bathroom mats and small rugs. We are open to any type.',
   'item', 'Home', NULL, NULL, 'ZAR', 610);

-- ---------------------------------------------------------------------------
-- 2. The products that caught our eye.
--
-- Each row resolves its parent by name, so this file reads on its own and
-- needs no generated ids. One statement per category: readability, and a
-- failure names a small blast radius.
-- ---------------------------------------------------------------------------

-- Appliances --------------------------------------------------------------
INSERT OR IGNORE INTO registry_item_options
  (item_id, label, retailer, product, url, sort_order)
VALUES
  ((SELECT id FROM registry_items WHERE name = 'Fridge'),
   'Caught our eye', 'Makro',
   'Defy 348L Double Door Bottom Mount Fridge with Base Drawer',
   'https://www.makro.co.za/defy-348-l-double-door-bottom-mount-fridge-base-drawer/p/itm08e969a7bda07?pid=RFRHGPZF2H55PFW7', 10),
  ((SELECT id FROM registry_items WHERE name = 'Chest Freezer'),
   'Caught our eye', 'Makro',
   'Hisense 198L Single Door Chest Freezer, grey',
   'https://www.makro.co.za/hisense-198-l-single-door-chest-freezer/p/itm1baec836d8e0f?pid=FCHHH2CQ5ZG9EACC', 10),
  ((SELECT id FROM registry_items WHERE name = 'Microwave'),
   'Caught our eye', 'HiFi Corp',
   'Samsung 40L Solo Microwave, black (MS40DG5504AG)',
   'https://www.hificorp.co.za/samsung-40l-solo-microwave-black-ms40dg5504agfa', 10),
  ((SELECT id FROM registry_items WHERE name = 'Kettle'),
   'Caught our eye', 'Smeg',
   'Smeg 50s Style Kettle, black (KLF03BLMSA)',
   'https://www.smeg.com/za/products/KLF03BLMSA', 10),
  ((SELECT id FROM registry_items WHERE name = 'Coffee Machine'),
   'Caught our eye', 'Yuppiechef',
   'Nespresso CitiZ Automatic Espresso Machine with Aeroccino Milk Frother',
   'https://www.yuppiechef.com/nespresso-original.htm?id=25713&name=Nespresso-CitiZ-Automatic-Espresso-Machine-with-Aeroccino-Milk-Frother&vid=42531', 10),
  ((SELECT id FROM registry_items WHERE name = 'Coffee Machine'),
   'Caught our eye', 'Yuppiechef',
   'Nespresso Lattissima One Automatic Espresso Machine with Integrated Milk Frother',
   'https://www.yuppiechef.com/nespresso-original.htm?id=36689&name=Nespresso-Lattissima-One-Automatic-Espresso-Machine-with-Integrated-Milk-Frother&vid=1721075', 20),
  ((SELECT id FROM registry_items WHERE name = 'Coffee Machine'),
   'Caught our eye', 'Yuppiechef',
   'Nespresso Vertuo Pop Coffee Machine & Aeroccino Milk Frother Bundle',
   'https://www.yuppiechef.com/nespresso-vertuo.htm?id=58357&name=Nespresso-Vertuo-Pop-Coffee-Machine-and-Aeroccino-Milk-Frother-Bundle&vid=1726972', 30),
  ((SELECT id FROM registry_items WHERE name = 'Stand Mixer'),
   'Caught our eye', 'Bash',
   'Kenwood kMix 5L Stand Mixer, matte white',
   'https://bash.com/kenwood-kmix-5l-stand-mixer-matte-white-153301aaqn0/p?idsku=1790598', 10),
  ((SELECT id FROM registry_items WHERE name = 'Air Fryer'),
   'Caught our eye', 'HiFi Corp',
   'Defy 8.4L Digital Dual Basket Air Fryer (DAF6386DBD)',
   'https://www.hificorp.co.za/defy-8-4l-digital-dual-basket-air-fryer-daf6386dbd', 10),
  ((SELECT id FROM registry_items WHERE name = 'Blender'),
   'Caught our eye', 'Yuppiechef',
   'Kenwood Multipro Express Food Processor & Blender, 1000W',
   'https://www.yuppiechef.com/kenwood.htm?id=70666&name=Kenwood-Multipro-Express-Food-Processor-and-Blender-1000W', 10),
  ((SELECT id FROM registry_items WHERE name = 'Blender'),
   'Caught our eye', 'Yuppiechef',
   'Russell Hobbs Nexus Glass Jug Blender, 1.5L',
   'https://www.yuppiechef.com/russell-hobbs-food-preparation.htm?id=65661&name=Russell-Hobbs-Nexus-Glass-Jug-Blender-1.5L&vid=1738725', 20),
  ((SELECT id FROM registry_items WHERE name = 'Food Processor'),
   'Caught our eye', 'Yuppiechef',
   'Kenwood Multipro Express Food Processor & Blender, 1000W',
   'https://www.yuppiechef.com/kenwood.htm?id=70666&name=Kenwood-Multipro-Express-Food-Processor-and-Blender-1000W', 10);

-- Cookware ----------------------------------------------------------------
INSERT OR IGNORE INTO registry_item_options
  (item_id, label, retailer, product, url, sort_order)
VALUES
  ((SELECT id FROM registry_items WHERE name = 'Pots'),
   'Caught our eye', 'Bash',
   'Cuisine Pro Iconix Pot Set, 7 pieces',
   'https://bash.com/cuisine-pro-iconix-pot-set-7pc-153300aaqy7/p', 10),
  ((SELECT id FROM registry_items WHERE name = 'Pots'),
   'Caught our eye', 'Kitchenique',
   'Tefal Jamie Oliver Stainless Steel Set, 5 pieces',
   'https://kitchenique.co.za/products/tefal-jamie-oliver-5-piece-set-stainless-steel', 20),
  ((SELECT id FROM registry_items WHERE name = 'Pots'),
   'Caught our eye', 'Bash',
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
   'Victoria Cast Iron Wok, 36cm',
   'https://kitchenique.co.za/products/victoria-cast-iron-wok-36cm-smooth-balanced-base', 20),
  ((SELECT id FROM registry_items WHERE name = 'Pans & Cast Iron'),
   'Caught our eye', 'Kitchenique',
   'Ken Hom Excellence Set',
   'https://kitchenique.co.za/products/ken-hom-excellence-set', 30),
  ((SELECT id FROM registry_items WHERE name = 'Casserole Dishes'),
   'Caught our eye', 'Bash',
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
  ((SELECT id FROM registry_items WHERE name = 'Bakeware'),
   'Caught our eye', 'Kitchenique',
   'Patisse Brownie Pan, 28x18cm',
   'https://kitchenique.co.za/products/patisse-brownie-pan-28x18cm', 10),
  ((SELECT id FROM registry_items WHERE name = 'Bakeware'),
   'Caught our eye', 'Kitchenique',
   'Patisse Perforated Baking Sheet, 40x30cm',
   'https://kitchenique.co.za/products/patisse-baking-sheet-perforated-40x30cm', 20),
  ((SELECT id FROM registry_items WHERE name = 'Bakeware'),
   'Caught our eye', 'Yuppiechef',
   'MicroGarden Stainless Steel Mixing Bowls, set of 3',
   'https://www.yuppiechef.com/microgarden.htm?id=70826&name=MicroGarden-Stainless-Steel-Mixing-Bowls-Set-of-3&vid=1745856', 30),
  ((SELECT id FROM registry_items WHERE name = 'Bakeware'),
   'Caught our eye', 'Kitchenique',
   'Pyrex Measuring Jug, 1L',
   'https://kitchenique.co.za/products/pyrex-measuring-jug-1l', 40);

-- Kitchen -----------------------------------------------------------------
INSERT OR IGNORE INTO registry_item_options
  (item_id, label, retailer, product, url, sort_order)
VALUES
  ((SELECT id FROM registry_items WHERE name = 'Knife Set'),
   'Caught our eye', 'Kitchenique',
   'Tramontina Knife Block Set, 6 pieces',
   'https://kitchenique.co.za/products/tramontina-knife-block-set-6-pieces', 10),
  ((SELECT id FROM registry_items WHERE name = 'Knife Set'),
   'Caught our eye', 'Yuppiechef',
   'Humble & Mash Gripline Knife Block Set, 6 piece',
   'https://www.yuppiechef.com/humble-and-mash-knives.htm?id=59415&name=Humble-and-Mash-Gripline-Series-Knife-Block-Set-6-Piece', 20),
  ((SELECT id FROM registry_items WHERE name = 'Knife Set'),
   'Caught our eye', 'Bed Bath Home',
   'Moretti Pro Knife Block Set, 7 pieces',
   'https://bedbathhome.co.za/products/moretti-pro-knife-block-set-of-7', 30),
  ((SELECT id FROM registry_items WHERE name = 'Knife Set'),
   'Caught our eye', 'Kitchenique',
   'Wusthof Sharpening Whetstone, 400/2000',
   'https://kitchenique.co.za/products/wusthof-sharpening-whetstone-j-400-2000', 40),
  ((SELECT id FROM registry_items WHERE name = 'Utensils'),
   'Caught our eye', 'Yuppiechef',
   'KitchenCraft Idilica Silicone Tool Set, set of 5',
   'https://www.yuppiechef.com/kitchencraft-cooks-tools.htm?id=61401&name=KitchenCraft-Idilica-Silicone-Tool-Set-Set-of-5', 10),
  ((SELECT id FROM registry_items WHERE name = 'Utensils'),
   'Caught our eye', 'Yuppiechef',
   'Brabantia Non-Stick Kitchen Utensils Set',
   'https://www.yuppiechef.com/brabantia-food-preparation.htm?id=53506&name=Brabantia-Non-Stick-Kitchen-Utensils-Set', 20),
  ((SELECT id FROM registry_items WHERE name = 'Utensils'),
   'Caught our eye', 'Kitchenique',
   'Joseph Joseph Elevate Steel Tongs, green',
   'https://kitchenique.co.za/products/joseph-joseph-elevate-steel-tongs-green', 30),
  ((SELECT id FROM registry_items WHERE name = 'Utensils'),
   'Caught our eye', 'Yuppiechef',
   'Zone Denmark Singles Kitchen Utensils, set of 4',
   'https://www.yuppiechef.com/zone-denmark.htm?id=67404&name=Zone-Denmark-Singles-Kitchen-Utensils-Set-of-4', 40),
  ((SELECT id FROM registry_items WHERE name = 'Kitchen Storage'),
   'Caught our eye', 'Yuppiechef',
   'Humble & Mash Glass Canisters with Bamboo Lids, set of 4',
   'https://www.yuppiechef.com/humble-and-mash-storage.htm?id=69983&name=Humble-and-Mash-Glass-Canisters-with-Bamboo-Lids-Set-of-4&vid=1744636', 10),
  ((SELECT id FROM registry_items WHERE name = 'Kitchen Storage'),
   'Caught our eye', 'Yuppiechef',
   'Artisan Street Coffee Storage Canister',
   'https://www.yuppiechef.com/artisan-street.htm?id=67230&name=Artisan-Street-Coffee-Storage-Canister&vid=1740978', 20),
  ((SELECT id FROM registry_items WHERE name = 'Kitchen Storage'),
   'Caught our eye', 'Yuppiechef',
   'Artisan Street Sugar Storage Canister',
   'https://www.yuppiechef.com/artisan-street.htm?id=67220&name=Artisan-Street-Sugar-Storage-Canister&vid=1740992', 30),
  ((SELECT id FROM registry_items WHERE name = 'Kitchen Storage'),
   'Caught our eye', 'Yuppiechef',
   'Trendz of Today Storage Canister with Pourer and Measuring Cup',
   'https://www.yuppiechef.com/trendz-of-today.htm?id=63490&name=Trendz-Of-Today-Storage-Canister-with-Pourer-and-Measuring-Cup&vid=1735478', 40),
  ((SELECT id FROM registry_items WHERE name = 'Kitchen Storage'),
   'Caught our eye', 'Kitchenique',
   'Typhoon Living Coffee Canister, grey',
   'https://kitchenique.co.za/products/typhoon-living-grey-coffee-canister', 50),
  ((SELECT id FROM registry_items WHERE name = 'Kitchen Storage'),
   'Caught our eye', 'Kitchenique',
   'Typhoon Living Sugar Canister, grey',
   'https://kitchenique.co.za/products/typhoon-living-grey-sugar-canister', 60),
  ((SELECT id FROM registry_items WHERE name = 'Food Containers'),
   'Caught our eye', 'Yuppiechef',
   'Artisan Street Bread Storage Bin',
   'https://www.yuppiechef.com/artisan-street.htm?id=67227&name=Artisan-Street-Bread-Storage-Bin&vid=1740973', 10),
  ((SELECT id FROM registry_items WHERE name = 'Food Containers'),
   'Caught our eye', 'Yuppiechef',
   'Mepal Cirqula Deep Rectangular Multi-Bowl Set, 3 piece',
   'https://www.yuppiechef.com/mepal-storage.htm?id=53822&name=Mepal-Cirqula-Deep-Rectangular-Multi-Bowl-Set-3-Piece&vid=1718871', 20),
  ((SELECT id FROM registry_items WHERE name = 'Food Containers'),
   'Caught our eye', 'Yuppiechef',
   'Joseph Joseph Nest Lock Storage Container Set',
   'https://www.yuppiechef.com/joseph-joseph-storage.htm?id=45433&name=Joseph-Joseph-Nest-Lock-Storage-Container-Set&vid=1692783', 30);

-- Dining ------------------------------------------------------------------
INSERT OR IGNORE INTO registry_item_options
  (item_id, label, retailer, product, url, sort_order)
VALUES
  ((SELECT id FROM registry_items WHERE name = 'Cutlery'),
   'Caught our eye', 'Kitchenique',
   'Newport Cutlery Set, 56 pieces',
   'https://kitchenique.co.za/products/newport-cutlery-set-56-pieces', 10),
  ((SELECT id FROM registry_items WHERE name = 'Cutlery'),
   'Caught our eye', 'Kitchenique',
   'Wilkinson Sword Baguette Cutlery Set, 24 pieces',
   'https://kitchenique.co.za/products/wilkilson-sword-baguette-cutlery-set-24-piece', 20),
  ((SELECT id FROM registry_items WHERE name = 'Cutlery'),
   'Caught our eye', 'Yuppiechef',
   'Yuppiechef Nova Cutlery Set, 48 piece',
   'https://www.yuppiechef.com/yuppiechef-cutlery.htm?id=68625&name=Yuppiechef-Nova-Cutlery-Set-48-Piece', 30),
  ((SELECT id FROM registry_items WHERE name = 'Cutlery'),
   'Caught our eye', 'Hertex Haus',
   'Cuisine Cutlery Set, 20 pieces, matte espresso',
   'https://hertexhaus.co.za/products/cuisine-cutlery-set-of-20-pcs-matte-silver?variant=41733374181461', 40),
  ((SELECT id FROM registry_items WHERE name = 'Dinnerware'),
   'Caught our eye', 'Kitchenique',
   'Maxwell & Williams Tribeca Dinner Set, 18 pieces',
   'https://kitchenique.co.za/products/maxwell-williams-tribeca-dinner-set-of-18-pieces', 10),
  ((SELECT id FROM registry_items WHERE name = 'Dinnerware'),
   'Caught our eye', 'Kitchenique',
   'Maxwell & Williams Caviar Dinner Set, 12 piece, black',
   'https://kitchenique.co.za/products/maxwell-williams-caviar-dinner-set-12-piece-black', 20),
  ((SELECT id FROM registry_items WHERE name = 'Dinnerware'),
   'Caught our eye', 'Babylonstoren',
   'Round Slip Plate, large green',
   'https://shop.babylonstoren.com/za/p/1864/round-slip-plate-large-green', 30),
  ((SELECT id FROM registry_items WHERE name = 'Dinnerware'),
   'Caught our eye', 'Babylonstoren',
   'Round Slip Plate, medium green',
   'https://shop.babylonstoren.com/za/p/1937/round-slip-plate-medium-green', 40),
  ((SELECT id FROM registry_items WHERE name = 'Dinnerware'),
   'Caught our eye', 'Babylonstoren',
   'Breakfast Bowl, green',
   'https://shop.babylonstoren.com/za/p/1870/breakfast-bowl-green', 50),
  ((SELECT id FROM registry_items WHERE name = 'Dinnerware'),
   'Caught our eye', 'Bash',
   'Home Essentials Dinnerware, 12 piece, fatigue',
   'https://bash.com/home-essentials-dinnerware-12pc-fatigue-153300aaur3/p?idsku=1622392', 60),
  ((SELECT id FROM registry_items WHERE name = 'Dinnerware'),
   'Caught our eye', 'Le Creuset',
   'Stoneware Coupe Plates, set of 4',
   'https://www.lecreuset.co.za/stoneware-coupe-set-of-4-plates/79405007979019.html', 70),
  ((SELECT id FROM registry_items WHERE name = 'Serving Bowls'),
   'Caught our eye', 'Kitchenique',
   'Jan Hendrik Ashes Salad Bowl, olive grey',
   'https://kitchenique.co.za/products/jan-hendrik-ashes-olive-grey-salad-bowl', 10),
  ((SELECT id FROM registry_items WHERE name = 'Serving Bowls'),
   'Caught our eye', 'Kitchenique',
   'Maxwell & Williams Serving Bowl, oval 30x20cm',
   'https://kitchenique.co.za/products/maxwell-williams-serving-bowl-oval-30x20cm', 20),
  ((SELECT id FROM registry_items WHERE name = 'Serving Bowls'),
   'Caught our eye', 'Le Creuset',
   'Stoneware Coupe Cereal Bowls, set of 4',
   'https://www.lecreuset.co.za/stoneware-coupe-set-of-4-cereal-bowls-multicolor-0.77l/79291857978019.html', 30),
  ((SELECT id FROM registry_items WHERE name = 'Cups & Mugs'),
   'Caught our eye', 'Hertex Haus',
   'Wholesome Cup & Saucer Set of 4, salt',
   'https://hertexhaus.co.za/products/wholesome-cup-saucer-set-4-salt?variant=42382853242965', 10),
  ((SELECT id FROM registry_items WHERE name = 'Cups & Mugs'),
   'Caught our eye', 'Babylonstoren',
   'Green Mug',
   'https://shop.babylonstoren.com/za/p/2727/green-mug', 20),
  ((SELECT id FROM registry_items WHERE name = 'Cups & Mugs'),
   'Caught our eye', 'Kitchenique',
   'Maxwell & Williams Tint Snug Mug, aqua 450ml',
   'https://kitchenique.co.za/products/maxwell-william-tint-snug-mug-aqua-450ml', 30),
  ((SELECT id FROM registry_items WHERE name = 'Cups & Mugs'),
   'Caught our eye', 'Kitchenique',
   'Maxwell & Williams Mug, sherbet grey 370ml',
   'https://kitchenique.co.za/products/maxwell-william-mug-sherbet-grey-370ml', 40),
  ((SELECT id FROM registry_items WHERE name = 'Glassware'),
   'Caught our eye', 'Kitchenique',
   'Luigi Bormioli Sublime Flute 210ml, 4 piece',
   'https://kitchenique.co.za/products/luigi-bormioli-sublime-flute-210ml-4-piece', 10),
  ((SELECT id FROM registry_items WHERE name = 'Glassware'),
   'Caught our eye', 'Kitchenique',
   'Luigi Bormioli Sublime Whisky Glass 350ml, 4 piece',
   'https://kitchenique.co.za/products/luigi-bormioli-sublime-whisky-350ml-4-piece', 20),
  ((SELECT id FROM registry_items WHERE name = 'Glassware'),
   'Caught our eye', 'Kitchenique',
   'La Divina Burgundy Goblet, set of 4',
   'https://kitchenique.co.za/products/la-divina-burgundy-goblet-set-of-4', 30),
  ((SELECT id FROM registry_items WHERE name = 'Serveware'),
   'Caught our eye', 'Bash',
   'Malda Footed Cake Stand with Dome',
   'https://bash.com/malda-serveware-footed-cake-stand-with-dome-153300aals9/p', 10),
  ((SELECT id FROM registry_items WHERE name = 'Serveware'),
   'Caught our eye', 'Kitchenique',
   'Maxwell & Williams Diamonds Cake Server & Fork Set, 7 piece',
   'https://kitchenique.co.za/products/maxwell-williams-diamonds-cake-server-fork-set-7pc', 20);

-- Bedroom -----------------------------------------------------------------
INSERT OR IGNORE INTO registry_item_options
  (item_id, label, retailer, product, url, sort_order)
VALUES
  ((SELECT id FROM registry_items WHERE name = 'Bed Set'),
   'Caught our eye', 'Hertex Haus',
   'Sanctuary Bed Set',
   'https://hertexhaus.co.za/collections/bedding/products/sanctuary-bed-set-copy-8?variant=42754153250901', 10),
  ((SELECT id FROM registry_items WHERE name = 'Bed Set'),
   'Caught our eye', 'Woolworths',
   'Silky Soft Textured Hypoallergenic Microfibre Duvet Cover Set',
   'https://www.woolworths.co.za/prod/Home/Bedroom/Bed-Linen/Duvet-Covers/Woolworths-Silky-Soft-Textured-Hypoallergenic-Microfibre-Duvet-Cover-Set/_/A-508362156', 20),
  ((SELECT id FROM registry_items WHERE name = 'Bed Set'),
   'Caught our eye', 'Bed Bath Home',
   'Whisper Soft Sateen Egyptian Cotton Satin Stitch Duvet Cover Set, black on white',
   'https://bedbathhome.co.za/products/whisper-soft-400-thread-count-sateen-egyptian-cotton-two-line-black-on-white-satin-stitch-duvet-cover-set', 30),
  ((SELECT id FROM registry_items WHERE name = 'Flat Sheets'),
   'Caught our eye', 'Hertex Haus',
   'Resort Flat Sheet',
   'https://hertexhaus.co.za/products/resort-flat-sheet-copy', 10),
  ((SELECT id FROM registry_items WHERE name = 'Flat Sheets'),
   'Caught our eye', 'Woolworths',
   'Washed Cotton Sateen Flat Sheet',
   'https://www.woolworths.co.za/prod/Home/Bedroom/Bed-Linen/Bed-Sheets/Woolworths-200TC-Washed-Cotton-Sateen-Flat-Sheet/_/A-508610954', 20),
  ((SELECT id FROM registry_items WHERE name = 'Flat Sheets'),
   'Caught our eye', 'Bed Bath Home',
   'T300 Silver Ribbon Flat Sheet',
   'https://bedbathhome.co.za/products/t300-silver-ribbon-300tc-flat-sheet?variant=15933518872665', 30),
  ((SELECT id FROM registry_items WHERE name = 'Fitted Sheets'),
   'Caught our eye', 'Hertex Haus',
   'Sanctuary Fitted Sheet',
   'https://hertexhaus.co.za/collections/bedding/products/sanctuary-fitted-sheet-copy-3', 10),
  ((SELECT id FROM registry_items WHERE name = 'Fitted Sheets'),
   'Caught our eye', 'Woolworths',
   'Percale Cotton Fitted Sheet, XD/XL',
   'https://www.woolworths.co.za/prod/Home/Bedroom/Bed-Linen/Bed-Sheets/Woolworths-200TC-Percale-Cotton-Fitted-Sheet-XDXL/_/A-510926134', 20),
  ((SELECT id FROM registry_items WHERE name = 'Fitted Sheets'),
   'Caught our eye', 'Bed Bath Home',
   'Sateen Egyptian Cotton Fitted Sheet, silver',
   'https://bedbathhome.co.za/products/500-thread-count-sateen-egyptian-cotton-silver-fitted-sheet?variant=36541325639833', 30);

-- Home --------------------------------------------------------------------
INSERT OR IGNORE INTO registry_item_options
  (item_id, label, retailer, product, url, sort_order)
VALUES
  ((SELECT id FROM registry_items WHERE name = 'Curtains'),
   'Caught our eye', 'Hertex Haus',
   'Lario Ready-Made Lined Extra Length Curtain, biscotti',
   'https://hertexhaus.co.za/collections/curtains/products/lario-ready-made-lined-extra-length-curtain-biscotti', 10),
  ((SELECT id FROM registry_items WHERE name = 'Curtains'),
   'Caught our eye', 'Bed Bath Home',
   'Enigma Taped Woven Blockout, taupe',
   'https://bedbathhome.co.za/products/enigma-taped-woven-blockout-taupe', 20),
  ((SELECT id FROM registry_items WHERE name = 'Curtains'),
   'Caught our eye', 'Woolworths',
   'Harrison Longer Length Block Out Taped Curtain, 260cm x 250cm',
   'https://www.woolworths.co.za/prod/Home/Home-Decor/Curtains-Hardware/Curtains/Taped/Woolworths-Harrison-Longer-Length-Block-Out-Taped-Curtain-260cm-W-x-250cm-L-/_/A-509807502', 30);

-- ---------------------------------------------------------------------------
-- 3. Assertions. Read the output: OR IGNORE hides a collision, and a batch
-- that inserted nothing looks exactly like one that worked.
-- ---------------------------------------------------------------------------
SELECT 'items loaded' AS "check",
       CASE WHEN COUNT(*) = 29 THEN 'PASS' ELSE 'FAIL - expected 29' END AS result,
       COUNT(*) AS found
FROM registry_items;

SELECT 'links loaded' AS "check",
       CASE WHEN COUNT(*) = 78 THEN 'PASS' ELSE 'FAIL - expected 78' END AS result,
       COUNT(*) AS found
FROM registry_item_options;

-- 78 links across 77 distinct URLs. The one repeat is the Kenwood
-- Multipro, under both Blender and Food Processor, because it is both.
SELECT 'distinct urls' AS "check",
       CASE WHEN COUNT(DISTINCT url) = 77 THEN 'PASS' ELSE 'FAIL - expected 77' END AS result,
       COUNT(DISTINCT url) AS found
FROM registry_item_options;

-- A NULL item_id means a name in section 2 matches nothing in section 1, i.e.
-- a typo in a subquery. NOT NULL on the column makes that an error at insert
-- time rather than a silent orphan, so this is always 0.
SELECT 'orphaned links' AS "check",
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result,
       COUNT(*) AS found
FROM registry_item_options o
LEFT JOIN registry_items i ON i.id = o.item_id
WHERE i.id IS NULL;

-- Items with no links are deliberate, not broken: the page invites a
-- contribution towards them instead. Expect 1 plus the honeymoon fund.
SELECT 'items with no links' AS "check",
       CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL - check which' END AS result,
       COUNT(*) AS found
FROM registry_items i
WHERE i.kind = 'item'
  AND NOT EXISTS (SELECT 1 FROM registry_item_options o WHERE o.item_id = i.id);

-- The shape of the list, for eyeballing.
SELECT i.category, i.name, COUNT(o.id) AS links
FROM registry_items i
LEFT JOIN registry_item_options o ON o.item_id = i.id
GROUP BY i.id
ORDER BY i.sort_order;
