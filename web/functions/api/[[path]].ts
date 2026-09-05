import worker, { type Env } from "../../../api/src/index";

/**
 * Pages Function: every request to /api/* runs the Worker.
 *
 * `[[path]]` is a catch-all, so this one file serves /api/health,
 * /api/rsvp/search, /api/rsvp/guest/<id>, /api/rsvp and /api/registry — the
 * routing inside the Worker stays the single source of truth for which path
 * does what.
 *
 * The API is deliberately NOT reimplemented here. `api/src/index.ts` is an
 * ordinary `{ fetch(request, env) }` module, which is exactly the shape a
 * Pages Function needs, so this is an adapter and nothing more. That keeps one
 * copy of the logic behind `cd api && npm run dev`, `npm run smoke` and the
 * unit tests, rather than a local version and a deployed version that can
 * drift apart.
 *
 * Bindings (DB, and MEDIA when the R2 bucket exists) come from the PAGES
 * project, configured in web/wrangler.jsonc — not from api/wrangler.toml,
 * which now only describes the local dev harness.
 */
export async function onRequest(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  return worker.fetch(context.request, context.env);
}
