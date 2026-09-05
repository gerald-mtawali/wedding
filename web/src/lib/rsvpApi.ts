import type {
  GuestDetail,
  RsvpSubmission,
  RsvpSubmitResult,
  SearchResponse,
} from "@shared/types";

/**
 * Thin client for the RSVP endpoints.
 *
 * In dev, Vite proxies /api to the local Worker on :8787 (see vite.config.ts),
 * so the same relative paths work in development and production.
 */

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

/**
 * A network failure and a well-formed error response are different things and
 * the UI has to tell them apart: one says "try again", the other says
 * something specific about the guest. So transport problems become
 * `{ ok: false }` here rather than exceptions the caller might forget to catch.
 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

const OFFLINE = "We couldn't reach the server. Please check your connection.";

async function getJson<T>(path: string): Promise<ApiResult<T>> {
  let res: Response;
  let text: string;
  try {
    res = await fetch(BASE + path);
    // Reading the body can fail on its own — a connection dropped mid-response
    // throws here, not at fetch(). Left outside the try it became an unhandled
    // rejection inside the debounced search callback, so "Looking…" stuck on
    // screen forever with no error and no results.
    text = await res.text();
  } catch {
    return { ok: false, message: OFFLINE };
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, message: "Unexpected response from the server." };
  }

  if (!res.ok) {
    const message =
      typeof body === "object" && body && "message" in body
        ? String((body as { message: unknown }).message)
        : `Request failed (${res.status}).`;
    return { ok: false, message };
  }
  return { ok: true, data: body as T };
}

/**
 * Resolve a typed name to guest candidates.
 *
 * Named `searchByName` rather than `searchGuests` on purpose: `searchGuests`
 * is the pure matcher in shared/names.ts that the Worker runs. Giving the
 * network call a different name keeps it obvious which one a component is
 * reaching for.
 */
export function searchByName(query: string): Promise<ApiResult<SearchResponse>> {
  return getJson<SearchResponse>(
    `/api/rsvp/search?q=${encodeURIComponent(query)}`,
  );
}

/** One guest, with any reply on record, for the details step to prefill from. */
export function fetchGuest(publicId: string): Promise<ApiResult<GuestDetail>> {
  return getJson<GuestDetail>(`/api/rsvp/guest/${publicId}`);
}

/**
 * Submit (or, with `amend`, update) a guest's response.
 *
 * Returns the API's own discriminated result rather than `ApiResult`, because
 * every failure here is one the form needs to render differently — an
 * `already_responded` carries the existing reply and turns into a prompt, not
 * an error message.
 */
export async function submitRsvp(
  payload: RsvpSubmission,
): Promise<RsvpSubmitResult> {
  let text: string;
  try {
    const res = await fetch(`${BASE}/api/rsvp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    text = await res.text();
  } catch {
    return { ok: false, error: "internal_error", message: OFFLINE };
  }

  try {
    const parsed = JSON.parse(text) as RsvpSubmitResult;
    // A body without a usable message would leave the form showing nothing at
    // all after a failed submit, which reads as the button doing nothing.
    if (!parsed.ok && !parsed.message) {
      return { ...parsed, message: "Something went wrong. Please try again." };
    }
    return parsed;
  } catch {
    return {
      ok: false,
      error: "internal_error",
      message: "Unexpected response from the server.",
    };
  }
}
