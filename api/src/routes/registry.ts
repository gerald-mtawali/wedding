import { json, type Env } from "../index";
import type { RegistryItem, RegistryOption } from "../../../shared/types";

/**
 * Registry endpoints.
 *
 *   GET  /api/registry        — the list: item TYPES, each with the products
 *                               we have looked at for it
 *   POST /api/registry/pledge — unchanged, and not yet reachable from the UI
 *
 * The model, in one line: `registry_items` is a list of the KINDS of thing we
 * would love (a kettle, cutlery, curtains) and `registry_item_options` holds
 * the specific products we have looked at for each one. Nobody has to buy the
 * exact product in a link.
 */

// ---------------------------------------------------------------------------
// GET /api/registry
// ---------------------------------------------------------------------------

type ItemRow = {
  id: number;
  name: string;
  description: string | null;
  kind: "item" | "cash";
  category: string | null;
  image_url: string | null;
  item_url: string | null;
  target_count: number;
};

type OptionRow = {
  id: number;
  item_id: number;
  label: string;
  retailer: string | null;
  product: string | null;
  url: string;
};

/**
 * Every column named explicitly, and NO `SELECT *` in this file ever.
 *
 * WHAT IS DELIBERATELY ABSENT: `price_cents`, `price_max_cents`, `currency`.
 * They exist on the table for our own budgeting and they must never reach a
 * browser. The guard lives here, in the SELECT list, rather than in the
 * mapping function below — a column that is never fetched cannot be
 * accidentally serialised later by someone extending the mapper.
 *
 * This is the same discipline as `rsvps.phone` in routes/rsvp.ts.
 *
 * `pledged_count` is also gone from here. It is vestigial (nothing writes it
 * while pledges are out of the UI) and a page that shows no claim state has no
 * use for it.
 */
const ITEMS_SQL = `
  SELECT id, name, description, kind, category, image_url, item_url,
         target_count
    FROM registry_items
   WHERE is_active = 1
   ORDER BY sort_order ASC, id ASC`;

/**
 * Options for every item in one query, rather than one query per item.
 *
 * At ~25 items and ~70 options the N+1 would be ~26 round trips to D1 to
 * assemble a payload small enough to fit in a single response. Two queries and
 * a Map is both faster and less code.
 */
const OPTIONS_SQL = `
  SELECT o.id, o.item_id, o.label, o.retailer, o.product, o.url
    FROM registry_item_options o
    JOIN registry_items i ON i.id = o.item_id
   WHERE i.is_active = 1
   ORDER BY o.item_id ASC, o.sort_order ASC, o.id ASC`;

export async function handleRegistry(env: Env): Promise<Response> {
  // An empty list rather than a 503, deliberately. The registry is
  // decoration, not a form: a page that renders its heading and copy with no
  // table is a far better outcome than an error card, and the missing binding
  // is loud enough in the logs.
  if (!env.DB) {
    return json({ items: [] });
  }

  const [items, options] = await Promise.all([
    env.DB.prepare(ITEMS_SQL).all<ItemRow>(),
    env.DB.prepare(OPTIONS_SQL).all<OptionRow>(),
  ]);

  // Grouped by parent so the stitch below is a lookup rather than a filter per
  // item (which would be quadratic, and needlessly so).
  const byItem = new Map<number, RegistryOption[]>();
  for (const row of options.results ?? []) {
    const list = byItem.get(row.item_id);
    const option: RegistryOption = {
      id: row.id,
      label: row.label,
      retailer: row.retailer,
      product: row.product,
      url: row.url,
    };
    if (list) list.push(option);
    else byItem.set(row.item_id, [option]);
  }

  const payload: RegistryItem[] = (items.results ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    kind: row.kind,
    category: row.category,
    imageUrl: row.image_url,
    itemUrl: row.item_url,
    targetCount: row.target_count,
    options: byItem.get(row.id) ?? [],
  }));

  return json({ items: payload });
}

// ---------------------------------------------------------------------------
// POST /api/registry/pledge
//
// UNCHANGED. Nothing in the UI calls this yet — the registry page is a list
// with links, not a claim form. It is left wired up so the route does not
// silently disappear, and because `registry_items.pledged_count` still exists
// for it to increment.
//
// Before this is put in front of a guest, read docs/registry-plan.md §1.4:
// the INSERT and the counter UPDATE below are two statements, so two guests
// claiming a one-of-one item at the same moment both succeed and the database
// records nothing wrong. That plan replaces both with a single conditional
// INSERT whose row count says whether the claim won.
// ---------------------------------------------------------------------------

type PledgePayload = {
  itemId: number;
  pledgeType: "item" | "cash";
  amountCents?: number;
  name: string;
  email?: string;
};

export async function handlePledge(req: Request, env: Env): Promise<Response> {
  const body = (await req.json().catch(() => null)) as PledgePayload | null;
  if (
    !body ||
    typeof body.itemId !== "number" ||
    !["item", "cash"].includes(body.pledgeType) ||
    typeof body.name !== "string"
  ) {
    return json({ error: "Invalid payload" }, 400);
  }

  if (env.DB) {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO registry_pledges
          (item_id, pledge_type, amount_cents, name, email, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))`,
      ).bind(
        body.itemId,
        body.pledgeType,
        body.amountCents ?? null,
        body.name,
        body.email ?? null,
      ),
      env.DB.prepare(
        `UPDATE registry_items
         SET pledged_count = pledged_count + 1
         WHERE id = ?1`,
      ).bind(body.itemId),
    ]);
  }

  return json({ ok: true });
}
