/** Types shared between `web/` and `api/`. */

// ---------------------------------------------------------------------------
// RSVP
// ---------------------------------------------------------------------------

/** A single named guest on an invitation. */
export type Guest = {
  id: number;
  firstName: string;
  lastName: string;
  /** Whether this guest may bring a plus-one. */
  allowPlusOne: boolean;
  /** The guest's response, or null if they haven't replied yet. */
  response: GuestResponse | null;
};

export type GuestResponse = {
  attending: boolean;
  plusOneName: string | null;
  dietary: string | null;
  message: string | null;
  updatedAt: string;
};

/** Result of `GET /api/rsvp/lookup?code=…`. */
export type LookupResult = {
  party: {
    code: string;
    label: string;
    invitedTo: "ceremony" | "reception" | "both";
  };
  guests: Guest[];
};

/** Body of `POST /api/rsvp`. */
export type RsvpPayload = {
  /** The invite code from the card (or the `?c=` query param). */
  code: string;
  firstName: string;
  lastName: string;
  attending: boolean;
  /** Name of the plus-one, if bringing one. */
  plusOneName?: string;
  dietary?: string;
  message?: string;
  /**
   * Set true to overwrite an existing response. Without it, the API refuses
   * to change an answer already on record and returns `alreadyResponded`.
   */
  amend?: boolean;
};

export type RsvpSuccess = {
  ok: true;
  /** True when this call replaced a previous answer. */
  amended: boolean;
  guest: { id: number; firstName: string; lastName: string };
  response: GuestResponse;
};

export type RsvpError = {
  ok: false;
  /**
   *  - `invalid_payload`     — missing/!malformed fields
   *  - `unknown_code`        — no party with that invite code
   *  - `guest_not_found`     — name doesn't match anyone on that invitation
   *  - `ambiguous_name`      — matched more than one guest; `candidates` set
   *  - `already_responded`   — a reply exists and `amend` was not set
   *  - `plus_one_not_allowed`— guest isn't permitted a plus-one
   */
  error:
    | "invalid_payload"
    | "unknown_code"
    | "guest_not_found"
    | "ambiguous_name"
    | "already_responded"
    | "plus_one_not_allowed"
    | "internal_error";
  message: string;
  /** Present for `ambiguous_name`. */
  candidates?: { id: number; firstName: string; lastName: string }[];
  /** Present for `already_responded`. */
  existing?: GuestResponse;
};

export type RsvpResult = RsvpSuccess | RsvpError;

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export type RegistryItem = {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  item_url: string | null;
  price_cents: number;
  currency: string;
  target_count: number;
  pledged_count: number;
};

export type PledgePayload = {
  itemId: number;
  pledgeType: "item" | "cash";
  amountCents?: number;
  name: string;
  email?: string;
};
