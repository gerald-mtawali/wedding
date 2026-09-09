import { json, type Env } from "../index";
import { searchGuests, MIN_QUERY_LENGTH } from "../lib/names";
import { isDietary } from "../../../shared/types";
import type {
  Dietary,
  GuestDetail,
  GuestMatch,
  RsvpRecord,
  RsvpSubmission,
  SearchResponse,
} from "../../../shared/types";

const MAX_TEXT = 500;

function clean(value: unknown, max = MAX_TEXT): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed.length ? trimmed : null;
}

function noDb(): Response {
  return json(
    {
      ok: false,
      error: "internal_error",
      message:
        "The RSVP database isn't configured. Add the D1 binding in wrangler.toml.",
    },
    503,
  );
}

// ===========================================================================
// v2 — identity by name search
// ===========================================================================

type GuestSearchRow = {
  id: number;
  public_id: string;
  title: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  allow_plus_one: number;
  household_label: string;
  has_responded: number;
};

type GuestDetailRow = GuestSearchRow & {
  attending: number | null;
  has_phone: number | null;
  dietary: string | null;
  dietary_notes: string | null;
  plus_one_name: string | null;
  plus_one_dietary: string | null;
  message: string | null;
  updated_at: string | null;
};

/**
 * Every guest, with the household label and whether a reply exists.
 *
 * Note what is NOT selected: `rsvps.phone`, and every other column of the
 * reply. The guard against leaking a guest's contact details lives in the
 * SELECT list rather than in the mapping function below, because a column that
 * is never fetched cannot be accidentally serialised later.
 *
 * Unfiltered on purpose. The matcher needs every candidate to decide between
 * "one confident hit" and "two people you must choose between", and at a few
 * hundred rows narrowing in SQL would buy nothing while splitting the matching
 * rules across two languages.
 */
/** Longer than any real name; see handleGuestSearch. */
const MAX_QUERY_LENGTH = 100;

const SEARCH_SQL = `
  SELECT g.id, g.public_id, g.title, g.first_name, g.middle_name, g.last_name,
         g.allow_plus_one,
         p.label                AS household_label,
         (r.id IS NOT NULL)     AS has_responded
    FROM guests g
    JOIN parties p ON p.id = g.party_id
    LEFT JOIN rsvps r ON r.guest_id = g.id
   ORDER BY g.id`;

function toMatch(row: GuestSearchRow): GuestMatch {
  return {
    // The integer primary key stops here. Everything outward-facing uses
    // public_id, so nothing a client holds can be incremented into someone
    // else's record.
    publicId: row.public_id,
    title: row.title,
    firstName: row.first_name,
    middleName: row.middle_name,
    lastName: row.last_name,
    householdLabel: row.household_label,
    allowPlusOne: row.allow_plus_one === 1,
    hasResponded: row.has_responded === 1,
  };
}

/** Narrow a stored string to the five allowed values, defensively. */
function toDietary(value: string | null): Dietary | null {
  return isDietary(value) ? value : null;
}

/**
 * A stored reply as the client is allowed to see it.
 *
 * The one place an `RsvpRecord` is built, so `phone` cannot be added to it in
 * one code path and forgotten in another. `hasPhone` says only whether a
 * number exists.
 */
function toRecord(row: {
  attending: number | null;
  dietary: string | null;
  dietary_notes: string | null;
  plus_one_name: string | null;
  plus_one_dietary: string | null;
  message: string | null;
  updated_at: string | null;
  has_phone: number | null;
}): RsvpRecord | null {
  if (row.attending === null) return null;
  return {
    attending: row.attending === 1,
    hasPhone: row.has_phone === 1,
    dietary: toDietary(row.dietary),
    dietaryNotes: row.dietary_notes,
    plusOneName: row.plus_one_name,
    plusOneDietary: toDietary(row.plus_one_dietary),
    message: row.message,
    updatedAt: row.updated_at ?? "",
  };
}

// ---------------------------------------------------------------------------
// GET /api/rsvp/search?q=…
// ---------------------------------------------------------------------------

export async function handleGuestSearch(url: URL, env: Env): Promise<Response> {
  if (!env.DB) return noDb();

  // Cap before matching. The suggestion pass deliberately disables the edit
  // distance's early bail, so cost is O(query x name) against EVERY guest —
  // a 16 KB URL (which Workers will happily accept) turns one unauthenticated
  // GET into ~700 ms of CPU. No real name is longer than this.
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);

  const { results } = await env.DB.prepare(SEARCH_SQL).all<GuestSearchRow>();
  const outcome = searchGuests((results ?? []).map(toMatch), q);

  // Diagnostics for tuning the thresholds. Length and outcome always; the
  // typed name ONLY when we found nothing, because "guests who could not find
  // themselves" is the one question these logs exist to answer and it cannot
  // be answered without the text. Everything else stays out of the logs.
  console.log(
    JSON.stringify({
      event: "rsvp_search",
      length: q.length,
      kind: outcome.kind,
      hits: "results" in outcome ? outcome.results.length : 0,
      tier: "results" in outcome ? outcome.results[0]?.tier : undefined,
      query: outcome.kind === "none" ? q.slice(0, 60) : undefined,
    }),
  );

  if (outcome.kind === "too-short") {
    const body: SearchResponse = {
      kind: "too-short",
      minLength: MIN_QUERY_LENGTH,
    };
    return json(body);
  }
  if (outcome.kind === "none") {
    const body: SearchResponse = { kind: "none" };
    return json(body);
  }

  // "We couldn't find you" is a normal result of a search, not an error, so
  // every outcome here is a 200 and the client branches on `kind`.
  const body: SearchResponse = {
    kind: outcome.kind,
    guests: outcome.results.map((r) => r.guest),
  };
  return json(body);
}

// ---------------------------------------------------------------------------
// GET /api/rsvp/guest/:id
// ---------------------------------------------------------------------------

/**
 * Everything step 3 needs about the guest who was confirmed at step 2,
 * including any reply to prefill the form from.
 *
 * `phone` is absent by construction — see the SELECT list. It is write-only:
 * the guest supplies it, we store it, we never hand it back. Identity here is
 * "your name is on the list", so anyone who knows a guest's name can reach
 * this endpoint; that is tolerable for an RSVP and not for a phone number.
 */
export async function handleGuestDetail(
  publicId: string,
  env: Env,
): Promise<Response> {
  if (!env.DB) return noDb();

  const row = await env.DB.prepare(
    `SELECT g.id, g.public_id, g.title, g.first_name, g.middle_name, g.last_name,
            g.allow_plus_one,
            p.label            AS household_label,
            (r.id IS NOT NULL) AS has_responded,
            r.attending, r.dietary, r.dietary_notes,
            r.plus_one_name, r.plus_one_dietary, r.message, r.updated_at,
            (r.phone IS NOT NULL) AS has_phone
       FROM guests g
       JOIN parties p ON p.id = g.party_id
       LEFT JOIN rsvps r ON r.guest_id = g.id
      WHERE g.public_id = ?1`,
  )
    .bind(publicId)
    .first<GuestDetailRow>();

  if (!row) {
    return json(
      {
        ok: false,
        error: "unknown_guest",
        message: "We couldn't find that guest.",
      },
      404,
    );
  }

  const body: GuestDetail = { ...toMatch(row), response: toRecord(row) };
  return json(body);
}

// ---------------------------------------------------------------------------
// POST /api/rsvp
// ---------------------------------------------------------------------------

type SubmitRow = {
  id: number;
  public_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  allow_plus_one: number;
  household_label: string;
  attending: number | null;
  dietary: string | null;
  dietary_notes: string | null;
  plus_one_name: string | null;
  plus_one_dietary: string | null;
  message: string | null;
  updated_at: string | null;
  has_phone: number | null;
};

function badRequest(
  error: "invalid_payload" | "invalid_dietary" | "plus_one_not_allowed",
  message: string,
): Response {
  return json({ ok: false, error, message }, 400);
}

/**
 * Record a guest's reply.
 *
 * Keyed on the `guestId` the guest confirmed at step 2, not on a name. The
 * server re-reads that guest, so a fabricated id fails — but it never re-runs
 * the fuzzy match, which means the reply can never land on a different person
 * than the one whose name and household the guest saw on the confirmation
 * card. Resolving the name twice, once to show and once to save, is exactly
 * how you would get those two to disagree.
 */
export async function handleRsvp(req: Request, env: Env): Promise<Response> {
  if (!env.DB) return noDb();

  const body = (await req.json().catch(() => null)) as RsvpSubmission | null;

  if (
    !body ||
    typeof body.publicId !== "string" ||
    !/^[0-9a-f]{16}$/.test(body.publicId) ||
    typeof body.attending !== "boolean"
  ) {
    return badRequest(
      "invalid_payload",
      "Please tell us who you are and whether you can join us.",
    );
  }

  // Validate the dietary values before touching the database. The CHECK
  // constraint in db/schema.sql would catch these anyway, but it would surface
  // as a 500 rather than as something the form can show the guest.
  for (const value of [body.dietary, body.plusOneDietary]) {
    if (value !== undefined && value !== null && !isDietary(value)) {
      return badRequest("invalid_dietary", "That isn't one of the meal options.");
    }
  }

  const row = await env.DB.prepare(
    `SELECT g.id, g.public_id, g.title, g.first_name, g.middle_name, g.last_name,
            g.allow_plus_one,
            p.label AS household_label,
            r.attending, r.dietary, r.dietary_notes,
            r.plus_one_name, r.plus_one_dietary, r.message, r.updated_at,
            (r.phone IS NOT NULL) AS has_phone
       FROM guests g
       JOIN parties p ON p.id = g.party_id
       LEFT JOIN rsvps r ON r.guest_id = g.id
      WHERE g.public_id = ?1`,
  )
    .bind(body.publicId)
    .first<SubmitRow>();

  if (!row) {
    return json(
      {
        ok: false,
        error: "unknown_guest",
        message: "We couldn't find you on the guest list. Please search again.",
      },
      404,
    );
  }

  const existing = toRecord(row);

  const attending = body.attending;
  const plusOneName = clean(body.plusOneName, 120);

  // Error precedence: everything that makes the REQUEST invalid is checked
  // before the conflict with existing STATE.
  //
  // Both can be true at once — an amending guest who also asks for a plus-one
  // they were never offered. Reporting the 409 first would send them round the
  // loop again with `amend: true`, only to meet a permanent error on the
  // second trip. `plus_one_not_allowed` will never resolve itself; a 409 is
  // designed to be resolved, by the guest confirming they meant to update.
  // So the permanent problem is reported first.
  if (plusOneName && row.allow_plus_one !== 1) {
    return badRequest(
      "plus_one_not_allowed",
      "This invitation doesn't include a guest. Please get in touch if that's not right.",
    );
  }

  // One reply per guest. An amendment is allowed, but only when explicitly
  // asked for, so a stray double-submit can never quietly change an answer.
  if (existing && !body.amend) {
    return json(
      {
        ok: false,
        error: "already_responded",
        message: `${row.first_name}, you've already replied. You can update your response if something has changed.`,
        existing,
      },
      409,
    );
  }

  // A guest who cannot come brings nobody and eats nothing, so those fields are
  // dropped rather than stored as answers to questions the form never asked.
  // The phone number and the note survive: we may still want to reply to them.
  const finalPlusOne = attending ? plusOneName : null;
  const finalPlusOneDietary = finalPlusOne ? (body.plusOneDietary ?? null) : null;
  const dietary = attending ? (body.dietary ?? null) : null;
  const dietaryNotes = attending ? clean(body.dietaryNotes, 300) : null;
  // An omitted `phone` means "leave whatever is on file alone", not "clear it".
  //
  // The form never prefills the number — the API does not return it — so an
  // amending guest submits a blank field simply because they were never given
  // the value to keep. Treating that as an instruction to erase silently
  // destroyed their contact detail every time they corrected a meal choice.
  // An explicit empty string still clears it.
  const phoneProvided = typeof body.phone === "string";
  const phone = phoneProvided ? clean(body.phone, 40) : null;
  const message = clean(body.message, MAX_TEXT);

  // The unique index on rsvps(guest_id) makes this an upsert rather than an
  // insert, so even two simultaneous submissions leave exactly one row.
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO rsvps
         (guest_id, attending, phone, dietary, dietary_notes,
          plus_one_name, plus_one_dietary, message)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
       ON CONFLICT(guest_id) DO UPDATE SET
         attending        = excluded.attending,
         phone            = CASE WHEN ?9 = 1 THEN excluded.phone ELSE rsvps.phone END,
         dietary          = excluded.dietary,
         dietary_notes    = excluded.dietary_notes,
         plus_one_name    = excluded.plus_one_name,
         plus_one_dietary = excluded.plus_one_dietary,
         message          = excluded.message,
         updated_at       = datetime('now')`,
    ).bind(
      row.id,
      attending ? 1 : 0,
      phone,
      dietary,
      dietaryNotes,
      finalPlusOne,
      finalPlusOneDietary,
      message,
      phoneProvided ? 1 : 0,
    ),

    // Audit trail. `typedName` is what the guest typed into the search box,
    // carried through the form purely so that "someone replied as the wrong
    // John Banda" is answerable afterwards. Deliberately NOT the phone number:
    // that lives in exactly one column, and one copy is easier to reason about
    // than two.
    env.DB.prepare(
      `INSERT INTO rsvp_events (guest_id, attending, payload) VALUES (?1, ?2, ?3)`,
    ).bind(
      row.id,
      attending ? 1 : 0,
      JSON.stringify({
        guestId: row.id,
        publicId: row.public_id,
        typedName: clean(body.typedName, 120),
        household: row.household_label,
        attending,
        dietary,
        dietaryNotes,
        plusOneName: finalPlusOne,
        plusOneDietary: finalPlusOneDietary,
        message,
        amend: Boolean(existing),
      }),
    ),
  ]);

  const saved = await env.DB.prepare(
    `SELECT attending, dietary, dietary_notes, plus_one_name,
            plus_one_dietary, message, updated_at,
            (phone IS NOT NULL) AS has_phone
       FROM rsvps WHERE guest_id = ?1`,
  )
    .bind(row.id)
    .first<Parameters<typeof toRecord>[0]>();

  // Read back rather than echo the request: what the guest is shown is what is
  // actually on the row, including a phone they kept without retyping.
  //
  // If the row we just wrote cannot be read back, something is badly wrong —
  // say so rather than returning ok:true with a null response, which the
  // confirmation screen would dereference and crash on, immediately after the
  // reply was successfully saved.
  const response = saved ? toRecord(saved) : null;
  if (!response) {
    return json(
      {
        ok: false,
        error: "internal_error",
        message:
          "Your reply was saved, but we couldn't read it back. Please search for yourself again to check it.",
      },
      500,
    );
  }

  return json({
    ok: true,
    amended: Boolean(existing),
    guest: {
      publicId: row.public_id,
      firstName: row.first_name,
      middleName: row.middle_name,
      lastName: row.last_name,
      householdLabel: row.household_label,
    },
    response,
  });
}
