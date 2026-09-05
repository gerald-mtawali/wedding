/**
 * Contract tests for shared/types.ts.
 *
 *   node --test shared/types.test.ts     (from the repo root)
 *
 * The interesting one is the last: it reads db/schema.sql and asserts the
 * dietary union matches the CHECK constraint character for character. Those
 * two live in different languages in different files and there is nothing but
 * discipline keeping them in step — so a guest picks an option the form offers,
 * the Worker accepts it, and SQLite rejects it at write time. That failure
 * would appear only in production, only for whoever picked the new option.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DIETARY_OPTIONS, isDietary, type Dietary } from "./types.ts";
import { searchGuests, type GuestRecord } from "./names.ts";

test("every dietary option has a distinct value and a human label", () => {
  const values = DIETARY_OPTIONS.map((o) => o.value);
  assert.equal(new Set(values).size, values.length);
  for (const o of DIETARY_OPTIONS) {
    assert.ok(o.label.length > 0, `${o.value} has no label`);
    assert.notEqual(o.label, o.value);
  }
});

test("isDietary accepts exactly the five options and nothing else", () => {
  for (const o of DIETARY_OPTIONS) assert.ok(isDietary(o.value));
  for (const bad of ["kosher", "HALAAL", "", " none", null, undefined, 0, {}]) {
    assert.equal(isDietary(bad), false, `accepted ${JSON.stringify(bad)}`);
  }
});

test("a GuestMatch-shaped row can be fed to the matcher", () => {
  // GuestMatch is declared as GuestRecord & {...}, so this is really a
  // compile-time guarantee; the runtime call proves the extra fields survive
  // the round trip and come back on the other side.
  const rows = [
    {
      publicId: "0123456789abcdef",
      firstName: "John",
      middleName: "A",
      lastName: "Banda",
      householdLabel: "The Banda Family",
      allowPlusOne: true,
      hasResponded: false,
    },
  ] satisfies (GuestRecord & { householdLabel: string })[];

  const r = searchGuests(rows, "John A Banda");
  assert.equal(r.kind, "match");
  assert.equal(
    r.kind === "match" ? r.results[0].guest.householdLabel : null,
    "The Banda Family",
  );
});

test("the dietary union matches the CHECK constraint in db/schema.sql", () => {
  const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

  // Both columns constrain the same five values; pull each list out separately
  // so a change to one but not the other is caught too.
  const constraints = [...schema.matchAll(/IN\s*\(([^)]*'none'[^)]*)\)/gi)];
  assert.ok(constraints.length >= 2, "expected a CHECK on dietary and plus_one_dietary");

  const expected = [...DIETARY_OPTIONS.map((o) => o.value)].sort();

  for (const [, list] of constraints) {
    const values = [...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    assert.deepEqual(
      values,
      expected,
      `schema.sql allows ${JSON.stringify(values)} but Dietary is ${JSON.stringify(expected)}`,
    );
  }
});

test("Dietary values are lowercase and safe to store verbatim", () => {
  for (const o of DIETARY_OPTIONS) {
    const v: Dietary = o.value;
    assert.match(v, /^[a-z]+$/, `${v} would need escaping or normalising`);
  }
});
