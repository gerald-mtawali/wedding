/**
 * Cloudflare Worker entrypoint.
 *
 * Routes:
 *   GET  /api/health          — liveness check
 *   GET  /api/rsvp/lookup     — resolve an invite code to a party + guests
 *   POST /api/rsvp            — accept an RSVP submission
 *   GET  /api/registry        — list registry items
 *   POST /api/registry/pledge — pledge an item or cash equivalent
 *
 * Bindings (see wrangler.toml):
 *   - DB    : D1 database (parties, guests, rsvps, registry)
 *   - MEDIA : R2 bucket (photos / videos)
 */
import { handleRsvp, handleRsvpLookup } from "./routes/rsvp";
import { handleRegistry, handlePledge } from "./routes/registry";

export interface Env {
  DB?: D1Database;
  MEDIA?: R2Bucket;
  ENVIRONMENT: string;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/api/health") {
        return json({ ok: true, env: env.ENVIRONMENT });
      }

      if (path === "/api/rsvp/lookup" && request.method === "GET") {
        return handleRsvpLookup(url, env);
      }

      if (path === "/api/rsvp" && request.method === "POST") {
        return handleRsvp(request, env);
      }

      if (path === "/api/registry" && request.method === "GET") {
        return handleRegistry(env);
      }

      if (path === "/api/registry/pledge" && request.method === "POST") {
        return handlePledge(request, env);
      }

      return json({ error: "Not found" }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: "Internal error" }, 500);
    }
  },
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
