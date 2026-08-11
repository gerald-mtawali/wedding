import { json, type Env } from "../index";
import { canonicalCode, matchGuest } from "../lib/names";
import type {
  Guest,
  GuestResponse,
  LookupResult,
  RsvpPayload,
} from "../../../shared/types";

// ---------------------------------------------------------------------------
// Row shapes as they come back from D1
// ---------------------------------------------------------------------------

type PartyRow = {
  id: number;
  code: string;
  label: string;
  invited_to: string;
};

type GuestRow = {
  id: number;
  first_name: string;
  last_name: string;
  allow_plus_one: number;
  attending: number | null;
  plus_one_name: string | null;
  dietary: string | null;
  message: string | null;
  updated_at: string | null;
};

const MAX_TEXT = 500;

function clean(value: unknown, max = MAX_TEXT): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed.length ? trimmed : null;
}

function toResponse(row: GuestRow): GuestResponse | null {
  if (row.attending === null) return null;
  return {
    attending: row.attending === 1,
    plusOneName: row.plus_one_name,
    dietary: row.dietary,
    message: row.message,
    updatedAt: row.updated_at ?? "",
  };
}

function toGuest(row: GuestRow): Guest {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    allowPlusOne: row.allow_plus_one === 1,
    response: toResponse(row),
  };
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

/**
 * Load a party and everyone on its invitation, with any existing responses.
 * Returns null when the code doesn't resolve.
 */
async function loadParty(
  db: D1Database,
  rawCode: string,
): Promise<{ party: PartyRow; guests: GuestRow[] } | null> {
  const key = canonicalCode(rawCode);
  if (!key) return null;

  // The stored code_key never contains O/I/L, but the guest may have typed
  // them; canonicalCode() folded those onto 0/1, so fold the stored side the
  // same way when comparing.
  const party = await db
    .prepare(
      `SELECT id, code, label, invited_to
         FROM parties
        WHERE replace(replace(replace(code_key,'O','0'),'I','1'),'L','1') = ?1
        LIMIT 1`,
    )
    .bind(key)
    .first<PartyRow>();

  if (!party) return null;

  const { results } = await db
    .prepare(
      `SELECT g.id, g.first_name, g.last_name, g.allow_plus_one,
              r.attending, r.plus_one_name, r.dietary, r.message, r.updated_at
         FROM guests g
         LEFT JOIN rsvps r ON r.guest_id = g.id
        WHERE g.party_id = ?1
        ORDER BY g.id`,
    )
    .bind(party.id)
    .all<GuestRow>();

  return { party, guests: results ?? [] };
}

// ---------------------------------------------------------------------------
// GET /api/rsvp/lookup?code=XXXXXX
// ---------------------------------------------------------------------------

export async function handleRsvpLookup(
  url: URL,
  env: Env,
): Promise<Response> {
  if (!env.DB) return noDb();

  const code = url.searchParams.get("code") ?? "";
  if (!code.trim()) {
    return json(
      { ok: false, error: "invalid_payload", message: "An invite code is required." },
      400,
    );
  }

  const found = await loadParty(env.DB, code);
  if (!found) {
    return json(
      {
        ok: false,
        error: "unknown_code",
        message: "We couldn't find that invite code. Please check the card and try again.",
      },
      404,
    );
  }

  const result: LookupResult = {
    party: {
      code: found.party.code,
      label: found.party.label,
      invitedTo: found.party.invited_to as LookupResult["party"]["invitedTo"],
    },
    guests: found.guests.map(toGuest),
  };

  return json(result);
}

// ---------------------------------------------------------------------------
// POST /api/rsvp
// ---------------------------------------------------------------------------

export async function handleRsvp(req: Request, env: Env): Promise<Response> {
  if (!env.DB) return noDb();

  const body = (await req.json().catch(() => null)) as RsvpPayload | null;

  if (
    !body ||
    typeof body.code !== "string" ||
    typeof body.firstName !== "string" ||
    typeof body.lastName !== "string" ||
    typeof body.attending !== "boolean" ||
    !body.firstName.trim() ||
    !body.lastName.trim()
  ) {
    return json(
      {
        ok: false,
        error: "invalid_payload",
        message: "Please provide your invite code, first and last name, and a reply.",
      },
      400,
    );
  }

  const found = await loadParty(env.DB, body.code);
  if (!found) {
    return json(
      {
        ok: false,
        error: "unknown_code",
        message: "We couldn't find that invite code. Please check the card and try again.",
      },
      404,
    );
  }

  // Names are only ever matched within one invitation, so two guests with the
  // same name on *different* invitations can never be confused.
  const outcome = matchGuest(
    found.guests.map((g) => ({
      id: g.id,
      firstName: g.first_name,
      lastName: g.last_name,
    })),
    body.firstName,
    body.lastName,
  );

  if (outcome.kind === "none") {
    return json(
      {
        ok: false,
        error: "guest_not_found",
        message: `We couldn't find that name on the invitation for ${found.party.label}. Please use the name exactly as it appears on your invite.`,
      },
      404,
    );
  }

  if (outcome.kind === "ambiguous") {
    return json(
      {
        ok: false,
        error: "ambiguous_name",
        message: "More than one guest on this invitation matches that name. Please pick which one is you.",
        candidates: outcome.candidates,
      },
      409,
    );
  }

  const guestId = outcome.guest.id;
  const guestRow = found.guests.find((g) => g.id === guestId)!;
  const existing = toResponse(guestRow);

  // One reply per guest. An amendment is allowed, but only when explicitly
  // asked for, so a stray double-submit can never quietly change an answer.
  if (existing && !body.amend) {
    return json(
      {
        ok: false,
        error: "already_responded",
        message: `${guestRow.first_name}, you've already replied. You can update your response if something has changed.`,
        existing,
      },
      409,
    );
  }

  const plusOneName = clean(body.plusOneName, 120);
  if (plusOneName && guestRow.allow_plus_one !== 1) {
    return json(
      {
        ok: false,
        error: "plus_one_not_allowed",
        message: "This invitation doesn't include a plus-one. Please get in touch if that's not right.",
      },
      400,
    );
  }

  const attending = body.attending;
  const dietary = clean(body.dietary, 300);
  const message = clean(body.message, MAX_TEXT);
  // A declining guest isn't bringing anyone.
  const finalPlusOne = attending ? plusOneName : null;

  // The unique index on rsvps(guest_id) makes this an upsert rather than an
  // insert, so even two simultaneous submissions leave exactly one row.
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO rsvps (guest_id, attending, plus_one_name, dietary, message)
       VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT(guest_id) DO UPDATE SET
         attending     = excluded.attending,
         plus_one_name = excluded.plus_one_name,
         dietary       = excluded.dietary,
         message       = excluded.message,
         updated_at    = datetime('now')`,
    ).bind(guestId, attending ? 1 : 0, finalPlusOne, dietary, message),

    env.DB.prepare(
      `INSERT INTO rsvp_events (guest_id, attending, payload)
       VALUES (?1, ?2, ?3)`,
    ).bind(
      guestId,
      attending ? 1 : 0,
      JSON.stringify({
        code: found.party.code,
        typedName: `${body.firstName} ${body.lastName}`.trim(),
        attending,
        plusOneName: finalPlusOne,
        dietary,
        message,
        amend: Boolean(existing),
      }),
    ),
  ]);

  const saved = await env.DB.prepare(
    `SELECT attending, plus_one_name, dietary, message, updated_at
       FROM rsvps WHERE guest_id = ?1`,
  )
    .bind(guestId)
    .first<{
      attending: number;
      plus_one_name: string | null;
      dietary: string | null;
      message: string | null;
      updated_at: string;
    }>();

  return json({
    ok: true,
    amended: Boolean(existing),
    guest: {
      id: guestId,
      firstName: guestRow.first_name,
      lastName: guestRow.last_name,
    },
    response: {
      attending: saved?.attending === 1,
      plusOneName: saved?.plus_one_name ?? null,
      dietary: saved?.dietary ?? null,
      message: saved?.message ?? null,
      updatedAt: saved?.updated_at ?? "",
    },
  });
}
