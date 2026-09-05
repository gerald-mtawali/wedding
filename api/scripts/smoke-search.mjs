/**
 * Smoke test for the read endpoints, against a running `wrangler dev`.
 *
 *   cd api
 *   npm run db:reset && npm run dev        # terminal 1
 *   npm run smoke                          # terminal 2
 *
 * Assumes the database is seeded from db/seed.sql. The expectations below
 * mirror shared/names.test.ts exactly — if the unit tests pass and these fail,
 * the bug is in the SQL or the row mapping, not in the matcher.
 *
 * Set BASE to point somewhere else:  BASE=http://127.0.0.1:8788 npm run smoke
 */
const BASE = process.env.BASE ?? "http://127.0.0.1:8787";

let failures = 0;

function report(ok, name, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${name}${detail ? "  ::  " + detail : ""}`);
}

async function get(path) {
  const res = await fetch(BASE + path);
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* leave null; the raw text is still checked for leaks */
  }
  return { status: res.status, body, text };
}

const search = (q) => get(`/api/rsvp/search?q=${encodeURIComponent(q)}`);
const names = (b) =>
  (b?.guests ?? []).map((g) =>
    [g.firstName, g.middleName, g.lastName].filter(Boolean).join(" "),
  );

/**
 * The reason this file exists. `phone` is write-only (see shared/types.ts):
 * the guest gives it to us, we store it, we never hand it back. Chisomo Phiri
 * is seeded WITH a phone number, so if anyone ever widens a SELECT list these
 * checks go red.
 *
 * Checked STRUCTURALLY — an allow-list of keys — rather than by grepping the
 * raw body for words. A substring scan flags the word "message" in any error
 * envelope, so it fires on unrelated failures and, worse, looks like it is
 * doing its job while the endpoint under test is completely broken.
 */
const GUEST_KEYS = [
  "publicId", "firstName", "middleName", "lastName",
  "householdLabel", "allowPlusOne", "hasResponded",
];
const RESPONSE_KEYS = [
  "attending", "dietary", "dietaryNotes",
  "plusOneName", "plusOneDietary", "message", "updatedAt",
  // Whether a number is on file, never the number. Added deliberately: the
  // form needs it to say "leave this blank to keep your number". Every entry
  // in this list should be a decision someone made on purpose.
  "hasPhone",
];

function checkKeys(label, obj, allowed, what) {
  const extra = Object.keys(obj ?? {}).filter((k) => !allowed.includes(k));
  report(extra.length === 0, `${label}: ${what} exposes nothing extra`, extra.join(", "));
}

/** A search hit must carry the seven public fields and nothing else. */
function checkSearchShape(label, body) {
  for (const g of body?.guests ?? []) checkKeys(label, g, GUEST_KEYS, "guest");
}

/** Values that must never appear in any body, whatever key they hide behind. */
function checkNoContactValues(label, text) {
  for (const needle of ["+265", "991 000", "@"]) {
    report(!text.includes(needle), `${label}: no contact detail ("${needle}")`);
  }
}

async function main() {
  console.log(`\n--- ${BASE} ---\n`);

  // ------------------------------------------------------------------ health
  {
    const r = await get("/api/health");
    report(r.status === 200 && r.body?.ok === true, "health responds", `status ${r.status}`);
    if (r.status !== 200) {
      console.log("\nWorker not reachable. Is `npm run dev` running?\n");
      process.exit(1);
    }
  }

  // ------------------------------------------------------------- query length
  for (const q of ["", "J", "Jo"]) {
    const r = await search(q);
    report(
      r.status === 200 && r.body?.kind === "too-short" && r.body?.minLength === 3,
      `"${q}" is too short`,
      `kind=${r.body?.kind}`,
    );
  }

  // ------------------------------------------------------------- the tiers
  const cases = [
    { q: "John A Banda",    kind: "match",       expect: ["John A Banda"] },
    { q: "John B. Banda",   kind: "match",       expect: ["John B. Banda"] },
    { q: "John Banda",      kind: "ambiguous",   expect: ["John A Banda", "John B. Banda"] },
    { q: "John Alfred Banda", kind: "match",     expect: ["John A Banda"] },
    { q: "Grace T Banda",   kind: "match",       expect: ["Grace Thandiwe Banda"] },
    { q: "Tadala M Banda",  kind: "match",       expect: ["Tadala Banda"] },
    { q: "Banda Tadala",    kind: "match",       expect: ["Tadala Banda"] },
    { q: "Mwale",           kind: "ambiguous",   expect: ["Esnart Mwale", "Peter Mwale", "Rachel Mwale"] },
    { q: "Don Banda",       kind: "match",       expect: ["Donella Banda"] },
    { q: "Donela Banda",    kind: "match",       expect: ["Donella Banda"] },
    { q: "Donella Bnada",   kind: "match",       expect: ["Donella Banda"] },
    { q: "Chiisoomo Phiri", kind: "match",       expect: ["Chisomo Phiri"] },
    { q: "Peter Mwaaale",   kind: "match",       expect: ["Peter Mwale"] },
    { q: "Zxqwv Plmko",     kind: "none",        expect: [] },
  ];

  for (const c of cases) {
    const r = await search(c.q);
    const got = names(r.body).sort();
    report(
      r.status === 200 && r.body?.kind === c.kind &&
        JSON.stringify(got) === JSON.stringify([...c.expect].sort()),
      `"${c.q}" -> ${c.kind}`,
      `got ${r.body?.kind} [${got.join(", ")}]`,
    );
    checkSearchShape(`"${c.q}"`, r.body);
    checkNoContactValues(`"${c.q}"`, r.text);
  }

  // --------------------------------------------------------- did you mean…?
  {
    const r = await search("Bunny Banda");
    const all = r.body?.guests ?? [];
    report(
      r.body?.kind === "suggestions" && all.length >= 4 &&
        all.every((g) => g.lastName === "Banda"),
      `"Bunny Banda" -> suggestions`,
      `kind=${r.body?.kind} n=${all.length}`,
    );
    checkSearchShape('"Bunny Banda"', r.body);
    checkNoContactValues('"Bunny Banda"', r.text);
  }

  // ------------------------------------------------- the disambiguator works
  {
    const r = await search("John Banda");
    const labels = (r.body?.guests ?? []).map((g) => g.householdLabel);
    report(
      labels.length === 2 && new Set(labels).size === 2,
      "the two John Bandas are told apart by household",
      labels.join(" | "),
    );
  }

  // ------------------------------------------------------------ guest detail
  {
    const found = await search("Chisomo Phiri");
    const id = found.body?.guests?.[0]?.publicId;
    report(/^[0-9a-f]{16}$/.test(id ?? ""), "Chisomo Phiri resolves to a public id", String(id));

    const r = await get(`/api/rsvp/guest/${id}`);
    const b = r.body;
    report(r.status === 200 && b?.publicId === id, "guest detail returns that guest");
    report(b?.householdLabel === "Ms. Chisomo Phiri", "detail carries the household");
    report(b?.hasResponded === true, "detail knows a reply exists");
    report(b?.response?.attending === true, "detail carries the reply");
    report(b?.response?.dietary === "pescatarian", "detail carries the dietary choice");
    report(b?.response?.dietaryNotes === "No shellfish", "detail carries dietary notes");
    report(b?.response?.plusOneName === "Yamikani Nkhoma", "detail carries the plus-one");
    report(b?.response?.plusOneDietary === "halaal", "detail carries the plus-one's dietary");
    // The whole point:
    checkKeys("guest detail", b, [...GUEST_KEYS, "response"], "guest");
    checkKeys("guest detail", b?.response, RESPONSE_KEYS, "response");
    report(!("phone" in (b?.response ?? {})), "guest detail: response carries no phone key");
    checkNoContactValues("guest detail", r.text);
  }

  // ----------------------------------------- detail from an AMBIGUOUS search
  //
  // Every candidate of a multi-hit search must be fetchable, not just the
  // single-match case. This was untested until a bug in the /guest/:id gate
  // showed up in the browser on exactly this path and nowhere else.
  {
    const r = await search("John Banda");
    const ids = (r.body?.guests ?? []).map((g) => g.publicId);
    report(ids.length === 2, "two candidates to choose between", String(ids.length));
    for (const id of ids) {
      const d = await get(`/api/rsvp/guest/${id}`);
      report(d.status === 200 && d.body?.publicId === id, `candidate ${id} is fetchable`);
      checkKeys("ambiguous candidate", d.body, [...GUEST_KEYS, "response"], "guest");
    }
  }

  // --------------------------------------------------- guest with no reply
  //
  // Esnart Mwale specifically, because smoke-rsvp.mjs writes replies for
  // Rachel Mwale and Test Guest. Using either of those here would make this
  // file pass or fail depending on whether the other one had run — the two
  // scripts share a database and must not share subjects.
  {
    const found = await search("Esnart Mwale");
    const id = found.body?.guests?.[0]?.publicId;
    const r = await get(`/api/rsvp/guest/${id}`);
    report(
      r.status === 200 && r.body?.response === null && r.body?.hasResponded === false,
      "a guest who has not replied returns a null response",
    );
  }

  // ------------------------------------------------------------- bad input
  {
    const r = await get("/api/rsvp/guest/ffffffffffffffff");
    report(r.status === 404 && r.body?.error === "unknown_guest", "an unknown public id 404s");
  }

  // The enumeration guard. The integer primary key must never appear on the
  // wire and must not be usable as a path: walking 1..N is how a guest list
  // leaks.
  {
    for (const walk of ["1", "2", "8", "999999"]) {
      const r = await get(`/api/rsvp/guest/${walk}`);
      report(r.status === 404, `sequential id ${walk} is not a valid path`);
    }
    const s = await search("Banda");
    const leaked = JSON.stringify(s.body).match(/"id"\s*:/);
    report(!leaked, "no integer id appears in a search response");
  }
  {
    const r = await get("/api/rsvp/guest/abc");
    report(r.status === 404, "a non-numeric guest id 404s without hitting the DB");
  }

  console.log(
    failures === 0
      ? `\nAll checks passed.\n`
      : `\n${failures} check${failures === 1 ? "" : "s"} FAILED.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("\nSmoke run could not complete:", err.message, "\n");
  process.exit(1);
});
