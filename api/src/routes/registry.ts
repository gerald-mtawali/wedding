import { json, type Env } from "../index";

export async function handleRegistry(env: Env): Promise<Response> {
  if (!env.DB) {
    return json({ items: [] });
  }
  const { results } = await env.DB.prepare(
    `SELECT id, name, description, image_url, price_cents, currency,
            pledged_count, target_count
     FROM registry_items ORDER BY sort_order ASC, id ASC`,
  ).all();
  return json({ items: results });
}

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
