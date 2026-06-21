/** Types shared between `web/` and `api/`. */

export type RsvpPayload = {
  name: string;
  email?: string;
  attending: boolean;
  guests?: number;
  dietary?: string;
  message?: string;
};

export type RegistryItem = {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
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
