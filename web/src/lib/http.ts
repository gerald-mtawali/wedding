/**
 * The bits of fetch handling that every API client in this app needs.
 *
 * Lifted out of `rsvpApi.ts`, which had the only copy. `registryApi.ts` uses
 * this one; `rsvpApi.ts` still carries its own identical copy so that this
 * change could not possibly affect the RSVP flow, which works. Switching it
 * over is a two-line edit (delete its `ApiResult`/`OFFLINE`/`getJson` block,
 * import them from here) and worth doing next time that file is open — two
 * copies of error handling is how the two start behaving differently under a
 * dropped connection without anyone noticing.
 *
 * In dev, Vite proxies /api to the local Worker on :8787 (see vite.config.ts),
 * so the same relative paths work in development and production.
 */

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

/**
 * A network failure and a well-formed error response are different things and
 * the UI has to tell them apart: one says "try again", the other says
 * something specific. So transport problems become `{ ok: false }` here rather
 * than exceptions the caller might forget to catch.
 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

export const OFFLINE =
  "We couldn't reach the server. Please check your connection.";

export async function getJson<T>(path: string): Promise<ApiResult<T>> {
  let res: Response;
  let text: string;
  try {
    res = await fetch(BASE + path);
    // Reading the body can fail on its own — a connection dropped
    // mid-response throws here, not at fetch(). Left outside the try it
    // becomes an unhandled rejection and the caller's "Loading…" sticks on
    // screen forever with no error and no data.
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
