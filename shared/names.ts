/**
 * Invite-code canonicalisation and tolerant guest-name matching.
 *
 * Shared by the Worker and the browser so the two never disagree: the client
 * uses it to give live feedback as the guest types, and the Worker uses it as
 * the authority when the form is submitted.
 *
 * Both halves solve the same problem — someone typing something slightly
 * different from what we seeded should still be found, without ever silently
 * matching the *wrong* person.
 */

// ---------------------------------------------------------------------------
// Invite codes
// ---------------------------------------------------------------------------

/**
 * Crockford base32 — deliberately omits I, L, O and U so a handwritten or
 * printed code can't be misread.
 */
export const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Length of a generated invite code. 6 chars ≈ 1 billion possibilities. */
export const CODE_LENGTH = 6;

/**
 * Canonicalise a code the guest typed: strip anything that isn't
 * alphanumeric, uppercase it, then fold the characters Crockford excludes
 * onto the ones they're mistaken for.
 */
export function canonicalCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
}

/** Generate a cryptographically random invite code. */
export function generateCode(length = CODE_LENGTH): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

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

export type NameCandidate = {
  id: number;
  firstName: string;
  lastName: string;
};

export type MatchOutcome<T extends NameCandidate> =
  | { kind: "match"; guest: T }
  | { kind: "none" }
  | { kind: "ambiguous"; candidates: T[] };

/**
 * Match a typed first/last name against the guests on one invitation.
 *
 * Because the candidate set is only ever the handful of people on a single
 * invite, we can afford to be generous. Tiers are tried in order and the
 * first tier that produces results wins — so an exact match is never
 * overruled by a fuzzy one. A tier yielding more than one guest is reported
 * as ambiguous rather than guessed at, which is what keeps two people with
 * the same name on the same invitation from being confused.
 */
export function matchGuest<T extends NameCandidate>(
  candidates: T[],
  firstName: string,
  lastName: string,
): MatchOutcome<T> {
  const first = normalizeName(firstName);
  const last = normalizeName(lastName);
  const full = `${first} ${last}`.trim();

  if (!first && !last) return { kind: "none" };

  const keyed = candidates.map((g) => ({
    guest: g,
    first: normalizeName(g.firstName),
    last: normalizeName(g.lastName),
    full: normalizeName(`${g.firstName} ${g.lastName}`),
  }));

  const tiers: ((c: (typeof keyed)[number]) => boolean)[] = [
    // 1. Exact, on both parts.
    (c) => c.first === first && c.last === last,
    // 2. Exact on the joined name — catches a double-barrelled surname typed
    //    into the first-name box, or the two fields swapped.
    (c) => c.full === full || c.full === `${last} ${first}`.trim(),
    // 3. Surname exact, given name is a prefix of it (or vice versa) —
    //    "Tada" for "Tadala", "Chi" for "Chisomo".
    (c) =>
      c.last === last &&
      first.length >= 3 &&
      (c.first.startsWith(first) || first.startsWith(c.first)),
    // 4. One typo anywhere in the full name.
    (c) => editDistance(c.full, full, 1) <= 1,
    // 5. Surname matches and the given name is within two typos.
    (c) => c.last === last && editDistance(c.first, first, 2) <= 2,
    // 6. The mirror of 5 — given name matches, surname is misspelt. Common
    //    with the long compound surnames on this list.
    (c) => c.first === first && editDistance(c.last, last, 2) <= 2,
  ];

  for (const test of tiers) {
    const hits = keyed.filter(test);
    if (hits.length === 1) return { kind: "match", guest: hits[0].guest };
    if (hits.length > 1) {
      return { kind: "ambiguous", candidates: hits.map((h) => h.guest) };
    }
  }

  return { kind: "none" };
}
