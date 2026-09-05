/**
 * Tests for the guest-name matcher.
 *
 *   node --test shared/names.test.ts        (from the repo root)
 *   cd api && npm run test:names
 *
 * No build step: Node 22.18+ strips the types itself. That is why the import
 * below carries an explicit `.ts` extension — type stripping does not resolve
 * extensionless specifiers.
 *
 * The fixture mirrors `db/seed.sql` exactly. If you change one, change the
 * other, or the tests stop describing the database you are actually running
 * against.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  searchGuests,
  similarity,
  editDistance,
  normalizeName,
  parseQuery,
  MAX_RESULTS,
  SUGGESTION_THRESHOLD,
  type GuestRecord,
  type SearchOutcome,
} from "./names.ts";

const GUESTS: GuestRecord[] = [
  { id: 1, firstName: "Test", middleName: null, lastName: "Guest" },
  { id: 2, firstName: "John", middleName: "A", lastName: "Banda" },
  { id: 3, firstName: "Grace", middleName: "Thandiwe", lastName: "Banda" },
  { id: 4, firstName: "Tadala", middleName: null, lastName: "Banda" },
  { id: 5, firstName: "Donella", middleName: null, lastName: "Banda" },
  { id: 6, firstName: "John", middleName: "B.", lastName: "Banda" },
  { id: 7, firstName: "Esnart", middleName: null, lastName: "Mwale" },
  { id: 8, firstName: "Chisomo", middleName: null, lastName: "Phiri" },
  { id: 9, firstName: "Peter", middleName: null, lastName: "Mwale" },
  { id: 10, firstName: "Rachel", middleName: null, lastName: "Mwale" },
];

const find = (q: string): SearchOutcome<GuestRecord> => searchGuests(GUESTS, q);
const ids = (o: SearchOutcome<GuestRecord>): number[] =>
  "results" in o ? o.results.map((r) => r.guest.id).sort((a, b) => a - b) : [];
const tierOf = (o: SearchOutcome<GuestRecord>): string =>
  "results" in o ? o.results[0].tier : "-";

// ---------------------------------------------------------------------------
// Guard rails
// ---------------------------------------------------------------------------

test("a query shorter than the minimum does nothing", () => {
  for (const q of ["", "  ", "J", "Jo", " a b "]) {
    assert.equal(find(q).kind, "too-short", `query: ${JSON.stringify(q)}`);
  }
});

test("three real characters is enough to search", () => {
  assert.notEqual(find("Ban").kind, "too-short");
});

// ---------------------------------------------------------------------------
// Tier 1 — exact
// ---------------------------------------------------------------------------

test("exact full name resolves to one person", () => {
  const r = find("John A Banda");
  assert.equal(r.kind, "match");
  assert.deepEqual(ids(r), [2]);
  assert.equal(tierOf(r), "exact-full");
});

test("punctuation and case in the stored middle name are irrelevant", () => {
  assert.deepEqual(ids(find("John B. Banda")), [6]);
  assert.deepEqual(ids(find("john b banda")), [6]);
  assert.deepEqual(ids(find("  JOHN   B.   BANDA  ")), [6]);
});

// ---------------------------------------------------------------------------
// Tier 3 — THE headline case
// ---------------------------------------------------------------------------

test("a shared first+last name returns BOTH people, and never guesses", () => {
  const r = find("John Banda");
  assert.equal(r.kind, "ambiguous");
  assert.deepEqual(ids(r), [2, 6]);
  assert.equal(tierOf(r), "exact-core");
  assert.notEqual(r.kind, "match");
});

test("a middle name we do not have on file is ignored rather than fatal", () => {
  const r = find("Tadala M Banda");
  assert.equal(r.kind, "match");
  assert.deepEqual(ids(r), [4]);
  // Pin the tier: prefix-given would reach the same answer by accident, and
  // without this the test keeps passing even if exact-core stops working.
  assert.equal(tierOf(r), "exact-core");
});

// ---------------------------------------------------------------------------
// Tier 2 — initials, in both directions
// ---------------------------------------------------------------------------

test("a typed initial matches a stored full middle name", () => {
  const r = find("Grace T Banda");
  assert.equal(r.kind, "match");
  assert.deepEqual(ids(r), [3]);
  assert.equal(tierOf(r), "initial");
});

test("a typed full middle name matches a stored initial, and disambiguates", () => {
  // "John Alfred Banda" must resolve to John A alone — falling through to
  // exact-core would hand back both Johns and make the guest choose needlessly.
  const r = find("John Alfred Banda");
  assert.equal(r.kind, "match");
  assert.deepEqual(ids(r), [2]);
  assert.equal(tierOf(r), "initial");
});

test("a middle initial that matches nobody still offers the candidates", () => {
  const r = find("John C Banda");
  assert.equal(r.kind, "ambiguous");
  assert.deepEqual(ids(r), [2, 6]);
  assert.equal(tierOf(r), "exact-core");
});

// ---------------------------------------------------------------------------
// Tiers 4–6 — order, single words, prefixes
// ---------------------------------------------------------------------------

test("first and last name typed the wrong way round still matches", () => {
  assert.deepEqual(ids(find("Banda Tadala")), [4]);
});

test("a surname on its own returns everyone who has it", () => {
  const r = find("Mwale");
  assert.equal(r.kind, "ambiguous");
  assert.deepEqual(ids(r), [7, 9, 10]);
  assert.equal(tierOf(r), "single-token");
});

test("a compound surname can be searched as itself", () => {
  // "Da Trindade" is ONE name. Treated as two tokens it matched nothing at
  // all — the guest could not find himself by his own surname.
  const list = [
    { id: 1, firstName: "Daniel", middleName: null, lastName: "Da Trindade" },
    { id: 2, firstName: "Sean", middleName: null, lastName: "Bode" },
  ];
  const r = searchGuests(list, "Da Trindade");
  assert.equal(r.kind, "match");
  assert.equal("results" in r ? r.results[0].guest.id : 0, 1);
  assert.equal(searchGuests(list, "Daniel Da Trindade").kind, "match");
});

test("widening tier 5 did not make two-token queries match a surname", () => {
  // The guard that keeps the widening safe: it demands equality with a WHOLE
  // name part, so an ordinary "first last" query still falls through.
  const list = [
    { id: 1, firstName: "John", middleName: "A", lastName: "Banda" },
    { id: 2, firstName: "John", middleName: "B", lastName: "Banda" },
  ];
  const r = searchGuests(list, "John Banda");
  assert.equal(r.kind, "ambiguous");
  assert.equal(tierOf(r), "exact-core");
});

test("a given name on its own works too", () => {
  assert.deepEqual(ids(find("Chisomo")), [8]);
});

test("a shortened given name with the right surname resolves", () => {
  const r = find("Don Banda");
  assert.equal(r.kind, "match");
  assert.deepEqual(ids(r), [5]);
  assert.equal(tierOf(r), "prefix-given");
});

// ---------------------------------------------------------------------------
// Tiers 7–9 — typos
// ---------------------------------------------------------------------------

test("a single wrong letter is absorbed", () => {
  const r = find("Donela Banda");
  assert.equal(r.kind, "match");
  assert.deepEqual(ids(r), [5]);
});

test("two transposed letters cost one edit, not two", () => {
  // Under plain Levenshtein "Bnada" is 2 edits from "Banda" and would fall
  // outside the tier-7 threshold entirely.
  assert.equal(editDistance("bnada", "banda", 2), 1);
  const r = find("Donella Bnada");
  assert.equal(r.kind, "match");
  assert.deepEqual(ids(r), [5]);
});

test("a badly misspelt given name with an exact surname is found", () => {
  const r = find("Chiisoomo Phiri");
  assert.equal(r.kind, "match");
  assert.deepEqual(ids(r), [8]);
});

test("a badly misspelt surname with an exact given name is found", () => {
  const r = find("Peter Mwaaale");
  assert.equal(r.kind, "match");
  assert.deepEqual(ids(r), [9]);
});

// ---------------------------------------------------------------------------
// Regressions — each of these once returned a confident match on the WRONG
// person, which is the single failure this whole design exists to prevent.
// ---------------------------------------------------------------------------

test("a namesake with no middle name on file never hides the others", () => {
  // "John Banda", "John A Banda" and "John B Banda" all on the list. The bare
  // one matched tier 1 exactly and was returned alone, so the other two were
  // never offered and whoever typed it replied as a stranger. Tier 1 now only
  // applies when the guest actually typed a middle part.
  const list = [
    { id: 1, firstName: "John", middleName: null, lastName: "Banda" },
    { id: 2, firstName: "John", middleName: "A", lastName: "Banda" },
    { id: 3, firstName: "John", middleName: "B", lastName: "Banda" },
  ];
  const r = searchGuests(list, "John Banda");
  assert.equal(r.kind, "ambiguous");
  assert.equal("results" in r ? r.results.length : 0, 3);

  // ...but a typed middle part still resolves to exactly one of them.
  const one = searchGuests(list, "John A Banda");
  assert.equal(one.kind, "match");
  assert.equal("results" in one ? one.results[0].guest.id : 0, 2);
});

test("someone who writes their name without their middle name is still offered", () => {
  const list = [
    { id: 1, firstName: "Grace", middleName: "Thandiwe", lastName: "Banda" },
    { id: 2, firstName: "Grace", middleName: null, lastName: "Banda" },
  ];
  // Grace Thandiwe types the name she actually writes. Before the fix she was
  // confidently identified as the other Grace.
  assert.equal(searchGuests(list, "Grace Banda").kind, "ambiguous");
});

test("a prefix never outranks a typo", () => {
  // "Anne" is a prefix of neither "Ann" nor "Anna", but is one edit from both.
  // With prefix-given ahead of the typo tiers this returned Ann alone.
  const list = [
    { id: 1, firstName: "Ann", middleName: null, lastName: "Banda" },
    { id: 2, firstName: "Anna", middleName: null, lastName: "Banda" },
  ];
  const r = searchGuests(list, "Anne Banda");
  assert.equal(r.kind, "ambiguous");
  assert.equal(tierOf(r), "typo-full");
});

test("two edits in a short name is a different name, not a typo", () => {
  // "don" is two edits from "john". A flat threshold of 2 made "Don Banda"
  // return both John Bandas as a genuine ambiguity and never offer Donella.
  const list = [
    { id: 1, firstName: "John", middleName: "A", lastName: "Banda" },
    { id: 2, firstName: "Donella", middleName: null, lastName: "Banda" },
  ];
  const r = searchGuests(list, "Don Banda");
  assert.equal(r.kind, "match");
  assert.equal("results" in r ? r.results[0].guest.id : 0, 2);
  assert.equal(tierOf(r), "prefix-given");
});

test("a long name still forgives two edits", () => {
  const list = [{ id: 1, firstName: "Chisomo", middleName: null, lastName: "Phiri" }];
  assert.equal(searchGuests(list, "Chiisoomo Phiri").kind, "match");
});

// ---------------------------------------------------------------------------
// Suggestions — the "did you mean…?" pass
// ---------------------------------------------------------------------------

test("an unrecorded nickname suggests everyone with that surname", () => {
  const r = find("Bunny Banda");
  assert.equal(r.kind, "suggestions");
  assert.ok(r.kind === "suggestions" && r.results.length >= 4);
  for (const hit of "results" in r ? r.results : []) {
    assert.equal(hit.guest.lastName, "Banda");
    assert.equal(hit.tier, "suggestion");
    assert.ok(hit.score >= SUGGESTION_THRESHOLD);
  }
});

test("a mistyped single word suggests rather than failing", () => {
  const r = find("Bnda");
  assert.equal(r.kind, "suggestions");
  assert.ok(ids(r).length > 0);
});

test("suggestions come back best-first", () => {
  const r = find("Bunny Banda");
  const scores = "results" in r ? r.results.map((x) => x.score) : [];
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
});

test("something unrelated finds nothing at all", () => {
  assert.equal(find("Zxqwv Plmko").kind, "none");
  assert.equal(find("Qqqqqqq").kind, "none");
});

// ---------------------------------------------------------------------------
// Invariants that must hold whatever the input
// ---------------------------------------------------------------------------

test("results are capped so one common surname cannot flood the screen", () => {
  const many: GuestRecord[] = Array.from({ length: 40 }, (_, i) => ({
    id: 100 + i,
    firstName: `Person${i}`,
    middleName: null,
    lastName: "Banda",
  }));
  const r = searchGuests(many, "Banda");
  assert.equal(r.kind, "ambiguous");
  assert.equal("results" in r ? r.results.length : 0, MAX_RESULTS);
});

test("an empty guest list never throws and never matches", () => {
  assert.equal(searchGuests([], "John Banda").kind, "none");
});

test("no outcome ever returns a bare 'match' with more than one person", () => {
  const queries = [
    "John Banda", "Mwale", "Banda", "John", "Bunny Banda", "Grace T Banda",
    "Don Banda", "Donela Banda", "Test Guest", "Chisomo Phiri", "John C Banda",
  ];
  for (const q of queries) {
    const r = find(q);
    if (r.kind === "match") {
      assert.equal(r.results.length, 1, `"${q}" claimed a unique match`);
    }
  }
});

// ---------------------------------------------------------------------------
// The primitives
// ---------------------------------------------------------------------------

test("normalisation strips accents, punctuation and extra whitespace", () => {
  assert.equal(normalizeName("Chisomo  Phiri-Banda"), "chisomo phiri banda");
  assert.equal(normalizeName("José"), "jose");
  assert.equal(normalizeName("  O'Brien  "), "o brien");
});

test("the query parser splits first / middle / last", () => {
  assert.deepEqual(parseQuery("John A Banda"), {
    tokens: ["john", "a", "banda"],
    full: "john a banda",
    core: "john banda",
    first: "john",
    middle: "a",
    last: "banda",
  });
});

test("similarity is scaled by length, so short names are judged harder", () => {
  assert.equal(similarity("banda", "banda"), 1);
  assert.ok(similarity("donella", "donela") > SUGGESTION_THRESHOLD);
  assert.ok(similarity("li", "lu") < SUGGESTION_THRESHOLD);
  assert.equal(similarity("", "banda"), 0);
});
