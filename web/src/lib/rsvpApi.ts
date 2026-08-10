import type { LookupResult, RsvpPayload, RsvpResult } from "@shared/types";

/**
 * Thin client for the RSVP endpoints.
 *
 * In dev, Vite proxies /api to the local Worker on :8787 (see vite.config.ts),
 * so the same relative paths work in development and production.
 */

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      res.ok
        ? "Unexpected response from the server."
        : `Request failed (${res.status}).`,
    );
  }
}

export type LookupOutcome =
  | { ok: true; data: LookupResult }
  | { ok: false; error: string; message: string };

/** Resolve an invite code to the party and everyone on the invitation. */
export async function lookupInvite(code: string): Promise<LookupOutcome> {
  const res = await fetch(
    `${BASE}/api/rsvp/lookup?code=${encodeURIComponent(code)}`,
  );
  const body = await parse<LookupResult & { error?: string; message?: string }>(
    res,
  );

  if (!res.ok) {
    return {
      ok: false,
      error: body.error ?? "internal_error",
      message: body.message ?? "Something went wrong. Please try again.",
    };
  }
  return { ok: true, data: body as LookupResult };
}

/** Submit (or, with `amend`, update) a guest's response. */
export async function submitRsvp(payload: RsvpPayload): Promise<RsvpResult> {
  const res = await fetch(`${BASE}/api/rsvp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parse<RsvpResult>(res);
}
