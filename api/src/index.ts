/**
 * Cloudflare Worker entrypoint.
 *
 * Routes:
 *   GET  /api/health          — liveness check
 *   GET  /api/rsvp/search     — resolve a typed name to guest candidates
 *   GET  /api/rsvp/guest/:publicId — one guest, with any reply on record
 *   POST /api/rsvp            — accept an RSVP submission
 *   GET  /api/registry        — list registry items
 *   POST /api/registry/pledge — pledge an item or cash equivalent
 *
 * Bindings (see wrangler.toml):
 *   - DB    : D1 database (parties, guests, rsvps, registry)
 *   - MEDIA : R2 bucket (photos / videos)
 */
import {
  handleGuestDetail,
  handleGuestSearch,
  handleRsvp,
} from "./routes/rsvp";
import { handleRegistry, handlePledge } from "./routes/registry";

export interface Env {
  DB?: D1Database;
  MEDIA?: R2Bucket;
  ENVIRONMENT: string;
  /**
   * Comma-separated origins allowed to call this API cross-origin.
   *
   * Empty in production and that is correct: the Worker answers on the SAME
   * hostname as the site (see the `routes` in wrangler.toml), so the browser
   * never sends an `Origin` header and CORS does not apply at all. This exists
   * only for the local dev server and for any future subdomain split.
   */
  ALLOWED_ORIGINS?: string;
}

/**
 * CORS headers for one request, or none.
 *
 * Was `Access-Control-Allow-Origin: *`, which told every site on the internet
 * it could read this API from a visitor's browser. It is a public RSVP
 * endpoint so the damage was limited, but the search route is a guest-list
 * oracle and there is no reason for anyone else's page to be able to query it.
 *
 * A same-origin request carries no `Origin` header and needs no headers back.
 */
function corsFor(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("Origin");
  if (!origin) return {};

  const allowed = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  if (!allowed.includes(origin)) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    // Without this a cache could serve one origin's response to another.
    Vary: "Origin",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await handle(request, env);

    // Applied once, on the way out, so no route can forget it and none can
    // widen it either.
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(corsFor(request, env))) {
      headers.set(k, v);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};

async function handle(request: Request, env: Env): Promise<Response> {
  {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204 });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/api/health") {
        return json({ ok: true, env: env.ENVIRONMENT });
      }

      if (path === "/api/rsvp/search" && request.method === "GET") {
        return await handleGuestSearch(url, env);
      }

      // /api/rsvp/guest/<16 hex> — the shape is checked here so anything else
      // 404s at the router rather than reaching the database.
      const guestPath = path.match(/^\/api\/rsvp\/guest\/([0-9a-f]{16})$/);
      if (guestPath && request.method === "GET") {
        return await handleGuestDetail(guestPath[1], env);
      }

      if (path === "/api/rsvp" && request.method === "POST") {
        return await handleRsvp(request, env);
      }

      if (path === "/api/registry" && request.method === "GET") {
        return await handleRegistry(env);
      }

      if (path === "/api/registry/pledge" && request.method === "POST") {
        return await handlePledge(request, env);
      }

      return json({ ok: false, error: "not_found", message: "Not found." }, 404);
    } catch (err) {
      // Every handler above is AWAITED inside this try. Returning the promise
      // without awaiting it looks identical and behaves completely
      // differently: the rejection escapes the try, nothing is logged, and the
      // client gets the runtime's opaque 500 instead of the JSON contract.
      console.error(err);
      return json(
        {
          ok: false,
          error: "internal_error",
          message: "Something went wrong on our end. Please try again.",
        },
        500,
      );
    }
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
