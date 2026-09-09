/**
 * Tolerant guest-name matching.
 *
 * Shared by the Worker and the browser so the two never disagree: the Worker
 * is the authority, and the client can run the identical logic for live
 * feedback without the two drifting apart.
 *
 * The problem it solves: someone typing something slightly different from what
 * we seeded should still be found, without ever silently matching the *wrong*
 * person.
 */

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

/** Matches the Unicode combining-diacritic block, U+0300–U+036F. */
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Lowercase, strip accents and punctuation, collapse whitespace.
 * "Chisomo  Phiri-Banda" and "chisomo phiri banda" both become
 * "chisomo phiri banda".
 */
export function normalizeName(input: string): string {
  return input
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Damerau–Levenshtein (optimal string alignment) distance, capped so long
 * mismatches bail out early.
 *
 * Transpositions count as one edit rather than two, which matters here:
 * swapping adjacent letters ("Bnada" for "Banda") is the single most common
 * typing error, and under plain Levenshtein it would cost the same as two
 * unrelated mistakes and fall outside a tight threshold.
 */
export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  const width = b.length + 1;
  let prev2 = new Array<number>(width).fill(0);
  let prev = Array.from({ length: width }, (_, i) => i);
  let curr = new Array<number>(width);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];

    for (let j = 1; j <= width - 1; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost, // substitution
      );
      // Transposition of two adjacent characters.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, prev2[j - 2] + 1);
      }
      curr[j] = best;
      if (best < rowMin) rowMin = best;
    }

    if (rowMin > max) return max + 1;
    [prev2, prev, curr] = [prev, curr, prev2];
  }

  return prev[b.length];
}

// ---------------------------------------------------------------------------
// Guest search — matching a typed name against the whole guest list
// ---------------------------------------------------------------------------
//
// The invite-code flow this replaced resolved a name within ONE invitation,
// where the candidate set was a handful of people and generosity was cheap.
// Identity is now resolved against the entire list, so the rules have to be
// stricter about what counts as a hit and, crucially, must never pick between
// two people.
//
// The shape of the answer matters as much as the answer:
//
//   match       exactly one confident hit  -> show the confirm card
//   ambiguous   several equally good hits  -> "which one is you?", never guessed
//   suggestions nothing matched, but something is close -> "did you mean…?"
//   none        nothing at all             -> not-found + who to contact
//
// Tiers are tried in order and the FIRST tier that produces any hits wins, so
// an exact match is never overruled by a fuzzy one. A tier producing more than
// one guest is reported as ambiguous rather than resolved — that is the rule
// that stops a typo quietly RSVP-ing on the wrong person's behalf.

/** Below this many characters the search does nothing. */
export const MIN_QUERY_LENGTH = 3;

/** Hard cap on how many people a single tier may return. */
export const MAX_RESULTS = 20;

/** Hard cap on the "did you mean…?" list. */
export const MAX_SUGGESTIONS = 8;

/**
 * How close a near-miss must be to be offered as a suggestion, on a 0–1 scale.
 * 0.72 was chosen to admit "Donela Banda" and a wrong-given-name-right-surname
 * miss, while excluding unrelated names. See the tests for the boundary cases.
 */
export const SUGGESTION_THRESHOLD = 0.72;

/**
 * The minimum a guest row must provide to be searchable.
 *
 * No identifier: the matcher only ever compares names, and leaving the id out
 * means callers are free to key guests however they like — which is what lets
 * the wire use an unguessable `publicId` while the database keeps its integer
 * primary key.
 */
export type GuestRecord = {
  firstName: string;
  middleName?: string | null;
  lastName: string;
};

export type MatchTier =
  | "exact-full"
  | "initial"
  | "exact-core"
  | "token-set"
  | "single-token"
  | "typo-full"
  | "typo-given"
  | "typo-surname"
  | "prefix-given";

export type Ranked<T> = {
  guest: T;
  /** Which rule matched. Useful for logging and for tuning the thresholds. */
  tier: MatchTier | "suggestion";
  /** 1 for a tier hit; the similarity score for a suggestion. */
  score: number;
};

export type SearchOutcome<T> =
  | { kind: "too-short" }
  | { kind: "none" }
  | { kind: "match"; results: Ranked<T>[] }
  | { kind: "ambiguous"; results: Ranked<T>[] }
  | { kind: "suggestions"; results: Ranked<T>[] };

// ---------------------------------------------------------------------------
// Distance and similarity
// ---------------------------------------------------------------------------

/**
 * Damerau–Levenshtein with no early bail, for when the actual number matters
 * rather than "is it within N". Names are short, so the O(n·m) cost is noise.
 */
export function distance(a: string, b: string): number {
  return editDistance(a, b, Math.max(a.length, b.length));
}

/**
 * Edit distance rescaled to 0–1, where 1 is identical.
 *
 * Dividing by the longer of the two strings is what makes the threshold mean
 * the same thing for "Li" as for "Chimwemwe": one wrong letter in a short name
 * is proportionally a much bigger error than one wrong letter in a long one,
 * and it should be scored that way.
 */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  return 1 - distance(a, b) / Math.max(a.length, b.length);
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

type Keyed<T> = {
  guest: T;
  /** first [middle] last */
  full: string;
  /** first last — the middle part dropped */
  core: string;
  first: string;
  middle: string;
  last: string;
};

function keyGuest<T extends GuestRecord>(g: T): Keyed<T> {
  const first = normalizeName(g.firstName);
  const middle = normalizeName(g.middleName ?? "");
  const last = normalizeName(g.lastName);
  return {
    guest: g,
    full: [first, middle, last].filter(Boolean).join(" "),
    core: [first, last].filter(Boolean).join(" "),
    first,
    middle,
    last,
  };
}

type ParsedQuery = {
  tokens: string[];
  /** everything the guest typed, normalised */
  full: string;
  /** first + last, with any middle tokens dropped */
  core: string;
  first: string;
  middle: string;
  last: string;
};

/**
 * Split what the guest typed into first / middle / last.
 *
 * The last token is taken as the surname and the first as the given name,
 * with anything between them treated as middle names. That is wrong for
 * "van der Merwe", but tier 1 compares the whole string before any of this
 * matters, so a correctly-typed compound surname still matches exactly.
 */
export function parseQuery(input: string): ParsedQuery {
  const full = normalizeName(input);
  const tokens = full ? full.split(" ") : [];

  if (tokens.length === 0) {
    return { tokens, full: "", core: "", first: "", middle: "", last: "" };
  }
  if (tokens.length === 1) {
    return { tokens, full, core: full, first: tokens[0], middle: "", last: "" };
  }

  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  const middle = tokens.slice(1, -1).join(" ");
  return { tokens, full, core: `${first} ${last}`, first, middle, last };
}

// ---------------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------------

/**
 * How many edits to forgive in one name part, given its length.
 *
 * A flat threshold of 2 is far too generous for short names: "don" is two
 * edits from "john", which made a search for "Don Banda" return both John
 * Bandas as a genuine ambiguity while never offering Donella at all. Two
 * wrong letters in a three-letter name is a different name; two wrong letters
 * in "Chimwemwe" is a typo.
 */
function maxEdits(a: string, b: string): number {
  return Math.min(a.length, b.length) <= 4 ? 1 : 2;
}

const TIERS: {
  tier: MatchTier;
  test: (k: Keyed<GuestRecord>, q: ParsedQuery) => boolean;
}[] = [
  // 1. Everything typed matches everything stored, middle name included.
  //
  // ONLY when the guest actually typed a middle part. Without that guard this
  // tier silently hides namesakes: with "John Banda", "John A Banda" and
  // "John B Banda" all on the list, a search for "John Banda" matched the
  // bare one exactly and returned it as a confident single hit — so the other
  // two were never offered, and whoever typed it RSVP'd as a stranger.
  //
  // When the query has no middle part, `full` and `core` are the same string,
  // so falling through to tier 3 finds the same guest AND their namesakes.
  { tier: "exact-full", test: (k, q) => q.middle !== "" && k.full === q.full },

  // 2. Given and surname match and the typed middle part is an initial of the
  //    stored one (or the reverse). Sits ABOVE exact-core so that
  //    "John Alfred Banda" resolves to John A rather than returning both Johns.
  {
    tier: "initial",
    test: (k, q) =>
      q.middle !== "" &&
      k.middle !== "" &&
      k.first === q.first &&
      k.last === q.last &&
      (k.middle.startsWith(q.middle) || q.middle.startsWith(k.middle)),
  },

  // 3. Given and surname match, middle parts ignored on BOTH sides.
  //    This is the tier that makes "John Banda" surface John A and John B
  //    together — the disambiguation screen exists for exactly this hit.
  //    It also absorbs a middle name we don't have on file ("Tadala M Banda").
  { tier: "exact-core", test: (k, q) => q.core !== "" && k.core === q.core },

  // 4. Same words, any order — the two fields typed the wrong way round.
  {
    tier: "token-set",
    test: (k, q) => {
      if (q.tokens.length < 2) return false;
      const sorted = [...q.tokens].sort().join(" ");
      return (
        [...k.full.split(" ")].sort().join(" ") === sorted ||
        [...k.core.split(" ")].sort().join(" ") === sorted
      );
    },
  },

  // 5. What was typed IS somebody's given name, or somebody's surname, whole.
  //
  //    Compares the entire query rather than a single token, which is what
  //    makes a COMPOUND surname work: "Da Trindade" is one name, and treating
  //    it as two tokens meant Daniel Da Trindade could not be found by his own
  //    surname at all — not as a match, not even as a suggestion.
  //
  //    Safe to widen because it demands exact equality with a whole name part.
  //    "John Banda" is nobody's surname, so a two-token query still falls
  //    through to the tiers below.
  //
  //    A common surname legitimately returns a long ambiguous list, which is
  //    the guest's to resolve.
  {
    tier: "single-token",
    test: (k, q) => k.last === q.full || k.first === q.full,
  },

  // 7. One typo anywhere in the whole name. Transposition counts as one edit,
  //    which is what makes "Bnada" cost the same as a single wrong letter.
  {
    tier: "typo-full",
    test: (k, q) =>
      editDistance(k.core, q.core, 1) <= 1 || editDistance(k.full, q.full, 1) <= 1,
  },

  // 8. Surname right, given name misspelt.
  {
    tier: "typo-given",
    test: (k, q) =>
      q.last !== "" &&
      k.last === q.last &&
      q.first !== "" &&
      editDistance(k.first, q.first, 2) <= maxEdits(k.first, q.first),
  },

  // 9. The mirror of 8 — given name right, surname misspelt. Common with the
  //    long compound surnames on this list.
  {
    tier: "typo-surname",
    test: (k, q) =>
      q.first !== "" &&
      k.first === q.first &&
      q.last !== "" &&
      editDistance(k.last, q.last, 2) <= maxEdits(k.last, q.last),
  },

  // 10. Surname exact, given name is a prefix of the stored one or vice versa.
  //     "Don Banda" for Donella, "Chi Phiri" for Chisomo.
  //
  //     LAST, below every typo tier, and that order matters. A prefix match is
  //     broader than a typo match — "Anne" is one edit from both "Ann" and
  //     "Anna", but a prefix of neither — so running prefixes first turned a
  //     genuine ambiguity into a confident match on whichever stored name
  //     happened to start with what was typed. Typos are checked first; a
  //     prefix is what is left when nothing was actually misspelt.
  //
  //     Three characters minimum, or a single initial drags in half the list.
  {
    tier: "prefix-given",
    test: (k, q) =>
      q.last !== "" &&
      k.last === q.last &&
      q.first.length >= 3 &&
      (k.first.startsWith(q.first) || q.first.startsWith(k.first)),
  },
];

// ---------------------------------------------------------------------------
// Honorifics
// ---------------------------------------------------------------------------

/** A guest as we PRINT them, rather than as we match them. */
export type TitledGuest = GuestRecord & { title?: string | null };

/**
 * The full printed form: "Dr Wilson Banda", "Mr John Jr Tembo".
 *
 * One helper rather than the three near-identical `fullName` functions that
 * used to sit in the RSVP steps, because the day a title is added is the day
 * two of the three get updated and the third quietly keeps printing the old
 * shape on one screen.
 */
export function formatGuestName(g: TitledGuest): string {
  return [g.title, g.firstName, g.middleName, g.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * What to call this person in a sentence — "Thank you, ___".
 *
 * Normally the given name. But some guests have no given name on file: the
 * invitation said "Mr and Mrs Nyirenda", so `first_name` is 'Mr' and
 * "Thank you, Mr" is not a sentence. When the given name is nothing but an
 * honorific, use the honorific and the surname together.
 */
export function greetingName(g: TitledGuest): string {
  const first = normalizeName(g.firstName);
  const isBareHonorific = HONORIFICS.some((t) => t === first);
  return isBareHonorific ? `${g.firstName} ${g.lastName}`.trim() : g.firstName;
}

/**
 * Titles a guest might type in front of their own name.
 *
 * Longest first — the order is load-bearing. "agogo aunt olive mkandawire"
 * must have both words taken before "agogo" matches alone and leaves "aunt"
 * to be mistaken for a given name.
 *
 * `normalizeName` has already removed the full stop, so "Dr." arrives as "dr"
 * and no entry here needs one.
 */
const HONORIFICS = [
  "agogo aunt",
  "professor",
  "reverend",
  "doctor",
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

/**
 * Drop one leading honorific from an ALREADY-NORMALISED string.
 *
 * Returns the input unchanged when there is no title, and — deliberately —
 * when the title is all there is. "mr" on its own is below MIN_QUERY_LENGTH
 * anyway, but more importantly some guests are stored WITH the honorific as
 * their given name: the invitation said "Mr and Mrs Nyirenda" and gave us no
 * first name, so `first_name` is 'Mr' because the column is NOT NULL. For
 * those rows the title is the name, and stripping it would lose them.
 */
export function stripHonorific(normalized: string): string {
  for (const title of HONORIFICS) {
    if (normalized.startsWith(title + " ")) {
      return normalized.slice(title.length + 1);
    }
  }
  return normalized;
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

/**
 * How close this guest is to what was typed, 0–1.
 *
 * A surname-only match is scored at 0.9 of its similarity rather than being
 * excluded: someone typing a nickname we never recorded ("Bunny Banda") gets
 * the right surname and nothing else, and offering them every Banda is the
 * only way they will ever find themselves.
 */
function suggestionScore(k: Keyed<GuestRecord>, q: ParsedQuery): number {
  if (q.tokens.length === 1) {
    return Math.max(similarity(q.first, k.first), similarity(q.first, k.last));
  }
  return Math.max(
    similarity(q.full, k.full),
    similarity(q.core, k.core),
    q.last ? similarity(q.last, k.last) * 0.9 : 0,
  );
}

// ---------------------------------------------------------------------------
// The search
// ---------------------------------------------------------------------------

function byName<T extends GuestRecord>(a: Ranked<T>, b: Ranked<T>): number {
  return (
    b.score - a.score ||
    a.guest.lastName.localeCompare(b.guest.lastName) ||
    a.guest.firstName.localeCompare(b.guest.firstName)
  );
}

/**
 * Resolve a typed name against the whole guest list.
 *
 * Pass every guest; the list is a few hundred people and each comparison is a
 * handful of string operations, so filtering in SQL first would buy nothing and
 * cost the ability to reason about the result in one place.
 *
 * The same function runs in the Worker and in the browser, so what the form
 * shows as the guest types is exactly what the server will conclude on submit.
 */
function resolve<T extends GuestRecord>(
  keyed: Keyed<T>[],
  q: ParsedQuery,
): SearchOutcome<T> {
  for (const { tier, test } of TIERS) {
    const hits = keyed.filter((k) => test(k, q));
    if (hits.length === 0) continue;

    const results = hits
      .map((k) => ({ guest: k.guest as T, tier, score: 1 }))
      .sort(byName)
      .slice(0, MAX_RESULTS);

    return results.length === 1
      ? { kind: "match", results }
      : { kind: "ambiguous", results };
  }

  // Nothing matched outright. Before giving up, offer near-misses — typos and
  // nicknames are the overwhelming cause of a false "we can't find you".
  const suggestions = keyed
    .map((k) => ({
      guest: k.guest as T,
      tier: "suggestion" as const,
      score: suggestionScore(k, q),
    }))
    .filter((r) => r.score >= SUGGESTION_THRESHOLD)
    .sort(byName)
    .slice(0, MAX_SUGGESTIONS);

  return suggestions.length
    ? { kind: "suggestions", results: suggestions }
    : { kind: "none" };
}

/**
 * Resolve a typed name against the whole guest list.
 *
 * Pass every guest; the list is a few hundred people and each comparison is a
 * handful of string operations, so filtering in SQL first would buy nothing and
 * cost the ability to reason about the result in one place.
 *
 * The same function runs in the Worker and in the browser, so what the form
 * shows as the guest types is exactly what the server will conclude on submit.
 *
 * -------------------------------------------------------------------------
 * TWO PASSES, AND WHY THE ORDER IS THIS WAY ROUND
 * -------------------------------------------------------------------------
 * Almost every invitation on this list is addressed by honorific, so a guest
 * typing what is on their own card types "Dr Wilson Banda" or "Mrs Ruth
 * Mtawali". `parseQuery` has no concept of a title: it takes the first token
 * as the given name, so those become given="dr", middle="wilson",
 * surname="banda" and match nobody. The whole list would have landed on the
 * "did you mean…?" screen.
 *
 * So: try VERBATIM first, and only if that finds nobody, try again without the
 * leading title.
 *
 * Verbatim has to go first because of the guests whose given name IS an
 * honorific — "Mr and Mrs Nyirenda" told us a surname and nothing else, so
 * that row is stored as first_name 'Mr'. Typing "Mr Nyirenda" resolves to
 * exactly him on the first pass. Stripping first would reduce the query to
 * "Nyirenda", which is also Mrs Gaulphine Nyirenda's surname, and turn a
 * confident match into an ambiguity the guest has to resolve by hand.
 *
 * The second pass is discarded if it finds nothing, so a stripped query can
 * only ever improve on the verbatim one, never replace a good answer with a
 * worse one.
 */
export function searchGuests<T extends GuestRecord>(
  guests: T[],
  query: string,
): SearchOutcome<T> {
  const verbatim = parseQuery(query);
  if (verbatim.full.replace(/\s/g, "").length < MIN_QUERY_LENGTH) {
    return { kind: "too-short" };
  }

  const keyed = guests.map(keyGuest);
  const first = resolve<T>(keyed as Keyed<T>[], verbatim);
  if (first.kind === "match" || first.kind === "ambiguous") return first;

  const stripped = stripHonorific(verbatim.full);
  if (stripped === verbatim.full) return first;
  if (stripped.replace(/\s/g, "").length < MIN_QUERY_LENGTH) return first;

  const second = resolve<T>(keyed as Keyed<T>[], parseQuery(stripped));
  return second.kind === "none" ? first : second;
}
