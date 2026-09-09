#!/usr/bin/env node
/**
 * Turn a numbered markdown guest list into an idempotent `db/guests/` batch.
 *
 *   node scripts/parse-guest-list.mjs \
 *     --in  ../db/guests/003-sept-09-parents-list.md \
 *     --out ../db/guests/003-sept-09-parents-list.sql \
 *     --batch "09 September — the groom's parents' list"
 *
 * Omit --out to write the SQL to stdout. --check parses and reports without
 * writing anything, which is the fast way to find out what a new list will do
 * before it does it.
 *
 * ===========================================================================
 * WHY A SCRIPT AND NOT JUST SQL
 * ===========================================================================
 * The SQL is still the artifact — it is reviewable, it is what gets executed,
 * and db/guests/ remains the audit trail of who was added when. This only
 * removes the transcription step, because transcribing 117 names by hand into
 * a file where `INSERT OR IGNORE` swallows every mistake silently is how a
 * real invitee ends up unable to RSVP.
 *
 * Read the generated SQL before you run it. That is the point of generating a
 * file rather than writing to D1 directly.
 *
 * ===========================================================================
 * THE MODEL — one invitation, one party, one searchable guest
 * ===========================================================================
 * Each numbered line is ONE invitation, so each becomes ONE `parties` row
 * whose `label` is the line exactly as addressed.
 *
 * A couple ("Mr and Mrs Dhuya Mtawali") becomes ONE `guests` row — the named
 * person — with `allow_plus_one = 1`. The spouse is not a guest row. That is
 * the schema's own rule (see the header of db/schema.sql): a plus-one lives on
 * the host's `rsvps` row and comes into existence when the host names them.
 *
 * The consequence, stated plainly because it will come up: the wife cannot
 * find herself by typing her own name. She is on the invitation, not on the
 * allow-list. If that turns out to matter for a particular couple, give her
 * her own `guests` row in the same party by hand — the schema allows it and
 * nothing here has to change.
 *
 * Where the invitation names her ("Mr Harold and Mrs Susan Jere") her given
 * name is not thrown away: it goes into `parties.notes`, so whoever chases
 * outstanding replies knows who the plus-one is meant to be.
 *
 * ===========================================================================
 * NAMES WE DO NOT FULLY HAVE
 * ===========================================================================
 * "Mr and Mrs Nyirenda" gives us a surname and nothing else, and
 * `guests.first_name` is NOT NULL. The honorific becomes the first name:
 *
 *     first_name = 'Mr', last_name = 'Nyirenda', title = NULL
 *
 * so the row reads "Mr Nyirenda" wherever a name is printed, which is exactly
 * what we know. `title` is left NULL rather than also being 'Mr', or the card
 * would read "Mr Mr Nyirenda".
 *
 * They stay findable: the matcher's single-token tier matches a query against
 * a whole surname, so typing "Nyirenda" returns them. Every such entry is
 * listed in the report as NO-GIVEN-NAME — if you can get the given names,
 * they are worth having.
 */

import { readFileSync, writeFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/**
 * Honorifics, longest first — the order is load-bearing. "Agogo Aunt Olive
 * Mkandawire" must consume both words before "Agogo" alone matches and leaves
 * "Aunt" to be mistaken for a given name.
 */
const TITLES = [
  "agogo aunt",
  "professor",
  "reverend",
  "pastor",
  "bishop",
  "madam",
  "agogo",
  "uncle",
  "aunt",
  "chief",
  "prof",
  "miss",
  "rev",
  "sir",
  "hon",
  "mrs",
  "mr",
  "ms",
  "dr",
];

/** Spelling we store, whatever the list wrote. */
const TITLE_CANONICAL = {
  prof: "Professor",
  professor: "Professor",
  reverend: "Rev",
  rev: "Rev",
  dr: "Dr",
  doctor: "Dr",
  mr: "Mr",
  mrs: "Mrs",
  ms: "Ms",
  miss: "Miss",
  madam: "Madam",
  pastor: "Pastor",
  bishop: "Bishop",
  sir: "Sir",
  hon: "Hon",
  chief: "Chief",
  uncle: "Uncle",
  aunt: "Aunt",
  agogo: "Agogo",
  "agogo aunt": "Agogo Aunt",
};

/**
 * Generational suffixes. These move to `middle_name`, never to `last_name`.
 *
 * "John Tembo jr" stored with last_name = 'Tembo Jr' would give a search_key
 * of "john tembo jr", and a guest typing "John Tembo" — which is what he
 * calls himself — would match nothing at all. In `middle_name` the search_key
 * stays "john tembo", the exact-core tier finds him, and "Jr" still shows on
 * the card and still distinguishes him from his father if we ever add one.
 */
const SUFFIXES = { jr: "Jr", jnr: "Jr", junior: "Jr", sr: "Sr", snr: "Sr", senior: "Sr", ii: "II", iii: "III", iv: "IV" };

// ---------------------------------------------------------------------------
// Text hygiene
// ---------------------------------------------------------------------------

/**
 * What arrives from a phone or from Word, made uniform.
 *
 * The curly apostrophe is the one that actually bites: "Donella's" typed in
 * Word carries U+2019, which is not the U+0027 that SQL escaping looks for,
 * and it renders as a mojibake blob anywhere the page is not served as UTF-8.
 */
function tidy(raw) {
  return raw
    .replace(/[   ]/g, " ")      // non-breaking spaces
    .replace(/[‘’ʼ]/g, "'")      // curly apostrophes
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, "-")           // en/em dashes to hyphen
    .replace(/\s*&\s*/g, " and ")               // "Mr & Mrs" -> "Mr and Mrs"
    .replace(/\s+/g, " ")
    .replace(/[,;]\s*$/, "")
    .trim();
}

/** SQLite string literal. Doubling the quote is the whole of the escaping. */
const q = (value) =>
  value === null || value === undefined || value === "" ? "NULL" : `'${String(value).replace(/'/g, "''")}'`;

/** Leading honorific(s), if any. Returns [canonicalTitle | null, restTokens]. */
function takeTitle(tokens) {
  const lower = tokens.map((t) => t.toLowerCase().replace(/\.$/, ""));
  for (const title of TITLES) {
    const parts = title.split(" ");
    if (parts.every((p, i) => lower[i] === p)) {
      return [TITLE_CANONICAL[title] ?? null, tokens.slice(parts.length)];
    }
  }
  return [null, tokens];
}

// ---------------------------------------------------------------------------
// Parsing one line
// ---------------------------------------------------------------------------

/**
 * Split name tokens into first / middle / last.
 *
 * The LAST token is the surname and the FIRST is the given name; anything
 * between them is a middle name. That is wrong for a compound surname
 * ("Da Trindade"), and there is no way to tell "Maurice Sopera Mwafulirwa"
 * — given, middle, surname — from a compound surname without knowing the
 * family. So the rule is applied consistently and every entry with three or
 * more name parts is flagged COMPOUND-OR-MIDDLE in the report for a human to
 * confirm. Getting it wrong is not fatal: the matcher's exact-core tier
 * ignores the middle part, so the guest is found either way.
 */
function splitName(tokens) {
  const flags = [];
  let suffix = null;

  const last = tokens[tokens.length - 1]?.toLowerCase().replace(/\.$/, "");
  if (tokens.length > 2 && SUFFIXES[last]) {
    suffix = SUFFIXES[last];
    tokens = tokens.slice(0, -1);
  }

  const firstName = tokens[0];
  const lastName = tokens[tokens.length - 1];
  const middleParts = tokens.slice(1, -1);
  if (middleParts.length) flags.push("COMPOUND-OR-MIDDLE");
  if (suffix) middleParts.push(suffix);

  return { firstName, middleName: middleParts.join(" ") || null, lastName, flags };
}

/**
 * One numbered line -> one party and one guest.
 *
 * The shapes, all of which occur in the September list:
 *
 *   Mrs Ruth Mtawali                  title + given + surname, single
 *   Julia Ojo                         no title, single
 *   Mrs Namagonya                     title + surname only, single
 *   Mr and Mrs Dhuya Mtawali          couple, his name given
 *   Mr and Mrs Nyirenda               couple, surname only
 *   Mr Harold and Mrs Susan Jere      couple, both names given
 *   Dr and Mrs Wilson Banda           couple, non-Mr honorific
 *   Mr and Mrs John Tembo jr          couple, generational suffix
 */
function parseEntry(raw, index) {
  const text = tidy(raw);
  const flags = [];

  // " and " is the couple marker. Split on the FIRST one only: a second would
  // mean three people on one invitation, which this list never does and which
  // should be looked at by a human rather than guessed at.
  const parts = text.split(/\s+and\s+/i);
  if (parts.length > 2) flags.push("MULTIPLE-AND");

  let title = null;
  let spouseGiven = null;
  let isCouple = false;
  let nameTokens;

  if (parts.length >= 2) {
    isCouple = true;
    const [leftTitle, leftRest] = takeTitle(parts[0].split(" "));
    const [rightTitle, rightRest] = takeTitle(parts.slice(1).join(" and ").split(" "));

    // "Mr and Mrs X" — nothing between the two honorifics, so the names on the
    // right belong to the couple jointly.
    if (leftRest.length === 0) {
      title = leftTitle;
      nameTokens = rightRest;
    } else {
      // "Mr Harold and Mrs Susan Jere" — a given name on each side, and the
      // surname trails the second one. His given name plus everything after
      // hers is his full name; hers is kept for parties.notes.
      title = leftTitle;
      spouseGiven = rightRest[0] ?? null;
      nameTokens = [...leftRest, ...rightRest.slice(1)];
      if (rightRest.length < 2) flags.push("SPOUSE-SURNAME-UNCLEAR");
    }
    if (!rightTitle) flags.push("NO-SPOUSE-TITLE");
  } else {
    const [soloTitle, rest] = takeTitle(text.split(" "));
    title = soloTitle;
    nameTokens = rest;
  }

  nameTokens = nameTokens.filter(Boolean);

  if (nameTokens.length === 0) {
    throw new Error(`entry ${index}: no name at all in ${JSON.stringify(raw)}`);
  }

  // Surname only. The honorific becomes the first name and `title` goes NULL,
  // so the printed form is "Mr Nyirenda" and not "Mr Mr Nyirenda".
  if (nameTokens.length === 1) {
    flags.push("NO-GIVEN-NAME");
    const honorific = title ?? "Guest";
    if (!title) flags.push("NO-TITLE-EITHER");
    return {
      index,
      label: text,
      title: null,
      firstName: honorific,
      middleName: null,
      lastName: nameTokens[0],
      allowPlusOne: isCouple ? 1 : 0,
      spouseGiven,
      flags,
    };
  }

  const { firstName, middleName, lastName, flags: nameFlags } = splitName(nameTokens);

  // "DF Salimoni", "P. Jere" — initials rather than a name. Findable by
  // surname, but worth chasing the real given name for.
  if (/^[A-Z]{1,3}\.?$/.test(firstName)) flags.push("INITIALS-ONLY");

  return {
    index,
    label: text,
    title,
    firstName,
    middleName,
    lastName,
    allowPlusOne: isCouple ? 1 : 0,
    spouseGiven,
    flags: [...flags, ...nameFlags],
  };
}

/** Every `1. Something` line in the markdown. Headings and prose are ignored. */
export function parseList(markdown) {
  const entries = [];
  for (const line of markdown.split(/\r?\n/)) {
    const m = /^\s*(\d+)[.)]\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    entries.push(parseEntry(m[2], Number(m[1])));
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

/**
 * What the generated SQL cannot tell you, because `INSERT OR IGNORE` is silent
 * about all of it.
 *
 *  - duplicate `parties.label` — the second one is dropped, and the guest on
 *    it never gets an allow-list row. Fatal; the script refuses to write.
 *  - duplicate search_key — two people the confirmation screen must tell apart
 *    using the household label alone. Not fatal, but check the labels really
 *    do distinguish them, or give one a middle name.
 */
function audit(entries) {
  const byLabel = new Map();
  const bySearchKey = new Map();

  for (const e of entries) {
    const label = e.label.toLowerCase();
    (byLabel.get(label) ?? byLabel.set(label, []).get(label)).push(e);
    const key = `${e.firstName} ${e.lastName}`.toLowerCase().replace(/\s+/g, " ").trim();
    (bySearchKey.get(key) ?? bySearchKey.set(key, []).get(key)).push(e);
  }

  return {
    duplicateLabels: [...byLabel.entries()].filter(([, v]) => v.length > 1),
    duplicateSearchKeys: [...bySearchKey.entries()].filter(([, v]) => v.length > 1),
    flagged: entries.filter((e) => e.flags.length),
  };
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

/**
 * D1's SQLite caps the terms in a compound SELECT far lower than stock
 * SQLite does, which is why db/guests/000-template.sql insists on multi-row
 * VALUES. VALUES has no such cap — but a single statement does have a length
 * limit, so the rows are still emitted in chunks. 50 keeps each statement well
 * under it with a hundred-odd names and long household labels.
 */
const CHUNK = 50;

const chunk = (rows, size = CHUNK) =>
  Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, i * size + size));

function pad(text, width) {
  return text + " ".repeat(Math.max(0, width - text.length));
}

function generateSql(entries, { batchName, sourceNote, fileName, tag, note }) {
  const { duplicateSearchKeys, flagged } = audit(entries);
  const couples = entries.filter((e) => e.allowPlusOne).length;
  const out = [];

  out.push(`-- ${batchName}`);
  out.push("--");
  out.push(`-- GENERATED by api/scripts/parse-guest-list.mjs. Regenerate rather than`);
  out.push(`-- hand-editing, or the next run silently reverts your change.`);
  out.push("--");
  if (sourceNote) {
    out.push(`-- Source: ${sourceNote}`);
    out.push("--");
  }
  out.push(`--   ${entries.length} invitations -> ${entries.length} parties, ${entries.length} guests`);
  out.push(`--   ${couples} of them couples (allow_plus_one = 1), ${entries.length - couples} individuals`);
  out.push(`--   maximum headcount from this batch: ${entries.length + couples}`);
  out.push("--");
  out.push("-- Apply LOCAL FIRST. It costs ten seconds and it is where you find out a");
  out.push("-- household label collided with one that already exists.");
  out.push("--");
  out.push("--   cd api");
  out.push(`--   npx wrangler d1 execute wedding --local  --file=../db/guests/${fileName}`);
  out.push(`--   npx wrangler d1 execute wedding --remote --file=../db/guests/${fileName}`);
  out.push("--");
  out.push("-- Idempotent: re-running inserts nothing. INSERT OR IGNORE plus the unique");
  out.push("-- indexes on parties.label and guests(party_id, name_key) do that, which is");
  out.push("-- also why the count assertions at the foot of this file are not optional —");
  out.push("-- a batch that inserted nothing looks exactly like one that worked.");
  out.push("--");
  out.push("-- REQUIRES guests.title. Apply db/patches/001-add-guest-title.sql first if");
  out.push("-- this database was created before 2026-09-08.");

  if (flagged.length) {
    out.push("--");
    out.push("-- ---------------------------------------------------------------------------");
    out.push(`-- ${flagged.length} ENTRIES WORTH A SECOND LOOK`);
    out.push("-- ---------------------------------------------------------------------------");
    for (const e of flagged) {
      out.push(`--   ${pad(String(e.index) + ".", 5)}${pad(e.label, 44)} ${e.flags.join(", ")}`);
    }
  }

  if (duplicateSearchKeys.length) {
    out.push("--");
    out.push("-- ---------------------------------------------------------------------------");
    out.push("-- SHARED NAMES — these people will see the disambiguation screen. Each pair");
    out.push("-- must be told apart by the household label alone, or one needs a middle");
    out.push("-- name adding by hand.");
    out.push("-- ---------------------------------------------------------------------------");
    for (const [key, group] of duplicateSearchKeys) {
      out.push(`--   ${key}: ${group.map((g) => `#${g.index} ${g.label}`).join(" | ")}`);
    }
  }

  // -- parties ---------------------------------------------------------------
  out.push("");
  out.push("-- ---------------------------------------------------------------------------");
  out.push("-- 1. PARTIES — one per invitation, labelled exactly as it was addressed.");
  out.push("--");
  out.push("-- The label is what a guest is shown when the search cannot tell two people");
  out.push("-- apart, so it has to be something they recognise. The addressing line is the");
  out.push("-- best available answer: it is the wording on their own invitation.");
  out.push("--");
  out.push("-- `notes` opens with the batch tag, which is the ONLY short, exact handle the");
  out.push("-- assertions at the foot of this file have for \"the rows this batch created\".");
  out.push("-- Listing 117 labels in an IN clause would work and would be unreadable, and a");
  out.push("-- count of the whole table would drift every time anyone else adds a guest.");
  out.push("--");
  out.push("-- It also carries the wife's given name where the invitation gave us one. She");
  out.push("-- has no guests row — she is the plus-one — so this is the only place that");
  out.push("-- information survives.");
  out.push("-- ---------------------------------------------------------------------------");

  const labelWidth = Math.min(56, Math.max(...entries.map((e) => q(e.label).length)));
  for (const group of chunk(entries)) {
    out.push("INSERT OR IGNORE INTO parties (label, invited_to, notes) VALUES");
    group.forEach((e, i) => {
      const notes = e.spouseGiven ? `${note} — plus-one on the invitation: ${e.spouseGiven}` : note;
      const terminator = i === group.length - 1 ? ";" : ",";
      out.push(`  (${pad(q(e.label) + ",", labelWidth + 2)} 'both', ${q(notes)})${terminator}`);
    });
    out.push("");
  }

  // -- guests ----------------------------------------------------------------
  out.push("-- ---------------------------------------------------------------------------");
  out.push("-- 2. GUESTS — the allow-list. If a name is not here, that person cannot RSVP.");
  out.push("--");
  out.push("-- One row per invitation: the named person. `allow_plus_one = 1` is how the");
  out.push("-- spouse gets in — the form shows the plus-one block and the host names them.");
  out.push("--");
  out.push("-- Each row resolves its own household with a scalar subquery rather than a");
  out.push("-- compound SELECT: D1 rejects the latter at around nine terms.");
  out.push("-- ---------------------------------------------------------------------------");

  const rows = entries.map((e) => ({
    e,
    sub: `(SELECT id FROM parties WHERE label = ${q(e.label)})`,
    title: q(e.title),
    first: q(e.firstName),
    middle: q(e.middleName),
    last: q(e.lastName),
  }));
  const w = {
    sub: Math.max(...rows.map((r) => r.sub.length)),
    title: Math.max(...rows.map((r) => r.title.length)),
    first: Math.max(...rows.map((r) => r.first.length)),
    middle: Math.max(...rows.map((r) => r.middle.length)),
    last: Math.max(...rows.map((r) => r.last.length)),
  };

  for (const group of chunk(rows)) {
    out.push("INSERT OR IGNORE INTO guests");
    out.push("  (party_id, title, first_name, middle_name, last_name, allow_plus_one)");
    out.push("VALUES");
    group.forEach((r, i) => {
      const terminator = i === group.length - 1 ? ";" : ",";
      // The line number goes in a LEADING block comment, not a trailing `--`.
      // A trailing comment on the row that carries the `;` puts a comment
      // after the statement terminator, and not every SQL splitter — D1's
      // included — is guaranteed to handle that the same way. Leading is
      // unambiguous everywhere. The household is not repeated: it is already
      // spelled out in the subquery on the same line.
      out.push(
        `  /* ${pad(String(r.e.index), 3)} */ ` +
          `(${pad(r.sub + ",", w.sub + 2)} ${pad(r.title + ",", w.title + 2)} ` +
          `${pad(r.first + ",", w.first + 2)} ${pad(r.middle + ",", w.middle + 2)} ` +
          `${pad(r.last + ",", w.last + 2)} ${r.e.allowPlusOne})${terminator}`,
      );
    });
    out.push("");
  }

  // -- assertions ------------------------------------------------------------
  const tagPrefix = q(`${tag}%`);
  out.push("-- ---------------------------------------------------------------------------");
  out.push("-- 3. DID IT LAND? All three must say PASS.");
  out.push("--");
  out.push("-- `INSERT OR IGNORE` swallows constraint violations silently, so a batch that");
  out.push("-- inserted nothing is indistinguishable from one that worked until you count.");
  out.push("--");
  out.push("-- parties FAIL, guests FAIL   -> a household label already existed. The");
  out.push("--                                invitation was merged into somebody else's.");
  out.push("-- parties PASS, guests FAIL   -> a name collided inside its own household.");
  out.push("-- plus-ones FAIL              -> allow_plus_one did not survive; the spouses");
  out.push("--                                cannot be added at RSVP time.");
  out.push("-- ---------------------------------------------------------------------------");
  out.push(`SELECT 'parties in this batch' AS "check",`);
  out.push(`       CASE WHEN COUNT(*) = ${entries.length} THEN 'PASS' ELSE 'FAIL — expected ${entries.length}' END AS result,`);
  out.push("       COUNT(*) AS found");
  out.push(`  FROM parties WHERE notes LIKE ${tagPrefix};`);
  out.push("");
  out.push(`SELECT 'guests in this batch' AS "check",`);
  out.push(`       CASE WHEN COUNT(*) = ${entries.length} THEN 'PASS' ELSE 'FAIL — expected ${entries.length}' END AS result,`);
  out.push("       COUNT(*) AS found");
  out.push("  FROM guests g JOIN parties p ON p.id = g.party_id");
  out.push(` WHERE p.notes LIKE ${tagPrefix};`);
  out.push("");
  out.push(`SELECT 'plus-ones allowed' AS "check",`);
  out.push(`       CASE WHEN COUNT(*) = ${couples} THEN 'PASS' ELSE 'FAIL — expected ${couples}' END AS result,`);
  out.push("       COUNT(*) AS found");
  out.push("  FROM guests g JOIN parties p ON p.id = g.party_id");
  out.push(` WHERE p.notes LIKE ${tagPrefix} AND g.allow_plus_one = 1;`);
  out.push("");
  out.push("-- Everyone in the WHOLE database who now shares a first+last name with");
  out.push("-- somebody else. These are the people the confirmation screen has to tell");
  out.push("-- apart using nothing but their household label, so read the labels and");
  out.push("-- satisfy yourself that each pair really is distinguishable. If not, give one");
  out.push("-- of them a middle_name.");
  out.push("SELECT g.search_key, COUNT(*) AS n, group_concat(p.label, ' | ') AS households");
  out.push("  FROM guests g JOIN parties p ON p.id = g.party_id");
  out.push(" GROUP BY g.search_key HAVING n > 1 ORDER BY g.search_key;");
  out.push("");
  out.push(`SELECT 'total guests' AS "check", COUNT(*) AS guests FROM guests;`);
  out.push("");

  return out.join("\n");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

function main() {
  const input = arg("in");
  if (!input) {
    console.error("usage: node scripts/parse-guest-list.mjs --in <list.md> [--out <batch.sql>] [--batch <name>] [--source <note>] [--check]");
    process.exit(2);
  }

  const entries = parseList(readFileSync(input, "utf8"));
  if (entries.length === 0) {
    console.error(`No numbered entries found in ${input}. Lines must look like "1. Mrs Ruth Mtawali".`);
    process.exit(1);
  }

  const { duplicateLabels, duplicateSearchKeys, flagged } = audit(entries);

  // ---- report, to stderr so `--out -` style piping still works -------------
  const couples = entries.filter((e) => e.allowPlusOne).length;
  const log = (...a) => console.error(...a);
  log(`\n  ${entries.length} invitations  ->  ${entries.length} parties, ${entries.length} guests`);
  log(`  ${couples} couples (allow_plus_one = 1), ${entries.length - couples} individuals`);
  log(`  maximum headcount from this batch: ${entries.length + couples}\n`);

  if (flagged.length) {
    log(`  ${flagged.length} entries worth a second look:`);
    for (const e of flagged) log(`    ${pad(e.index + ".", 5)}${pad(e.label, 44)} ${e.flags.join(", ")}`);
    log("");
  }

  if (duplicateSearchKeys.length) {
    log(`  ${duplicateSearchKeys.length} shared names — these hit the disambiguation screen:`);
    for (const [key, g] of duplicateSearchKeys) log(`    ${key}: ${g.map((x) => `#${x.index}`).join(", ")}`);
    log("");
  }

  // A duplicate label is not a warning. `parties.label` is UNIQUE, so the
  // second one is dropped by INSERT OR IGNORE and its guest lands in the FIRST
  // household — a different family's invitation. Refuse to generate.
  if (duplicateLabels.length) {
    log("  DUPLICATE HOUSEHOLD LABELS — refusing to generate. parties.label is UNIQUE,");
    log("  so the second invitation would be silently merged into the first:\n");
    for (const [label, g] of duplicateLabels) log(`    "${label}" on lines ${g.map((x) => x.index).join(", ")}`);
    log("\n  Give them distinguishing labels in the markdown and run again.\n");
    process.exit(1);
  }

  if (process.argv.includes("--check")) {
    log("  --check: parsed cleanly, nothing written.\n");
    return;
  }

  const output = arg("out");
  const fileName = output ? output.split(/[\\/]/).pop() : "NNN-batch.sql";
  // The batch tag defaults to the file's leading number, so 003-*.sql tags its
  // rows "[003]" and the assertions can find exactly them. Override with --tag
  // only if you are regenerating a batch under a different filename.
  const tag = arg("tag", `[${/^(\d+)/.exec(fileName)?.[1] ?? "batch"}]`);
  const sql = generateSql(entries, {
    batchName: arg("batch", "Guest batch"),
    sourceNote: arg("source"),
    fileName,
    tag,
    note: `${tag} ${arg("note", arg("source", "guest batch"))}`,
  });

  if (output) {
    writeFileSync(output, sql, "utf8");
    log(`  wrote ${output}\n  Read it before you run it.\n`);
  } else {
    process.stdout.write(sql);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
