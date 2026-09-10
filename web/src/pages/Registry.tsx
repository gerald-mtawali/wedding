import { useEffect, useState } from "react";
import type { RegistryItem } from "@shared/types";
import { fetchRegistry } from "../lib/registryApi";
import { siteConfig } from "../lib/siteConfig";
import RegistryRow from "../components/registry/RegistryRow";

/**
 * The registry page.
 *
 * A list of the KINDS of thing we would love, grouped by room, each one
 * expanding to the specific products we have looked at. Deliberately not a
 * shop: no prices, no "claim this", no basket. Guests buy from wherever suits
 * them, and the links are there as a hint about taste rather than an
 * instruction.
 *
 * Prices are not hidden by this component — they never leave the database. See
 * the SELECT list in api/src/routes/registry.ts.
 */
export default function Registry() {
  const [items, setItems] = useState<RegistryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchRegistry().then((result) => {
      // The component can unmount while the request is in flight (a guest
      // navigating straight back to the home page), and setting state after
      // that is a warning in dev and a leak in principle.
      if (!live) return;
      if (result.ok) setItems(result.data.items);
      else setError(result.message);
    });
    return () => {
      live = false;
    };
  }, []);

  // The honeymoon fund is not a row. It has no links, no retailer and no
  // "which one would you like" — squeezing it into the table would make it
  // look like an item we forgot to finish.
  const fund = items?.find((i) => i.kind === "cash") ?? null;
  const gifts = items?.filter((i) => i.kind !== "cash") ?? [];

  // Who a guest speaks to about giving money rather than a gift. Read from
  // siteConfig so the names and numbers live in one place; see the TODO there.
  const contacts = siteConfig.registry.contacts;

  // Category order comes from the API's own ordering (sort_order), taken from
  // first appearance, so adding a category in SQL needs no change here.
  const groups: { category: string; items: RegistryItem[] }[] = [];
  for (const item of gifts) {
    const key = item.category ?? "More";
    const last = groups[groups.length - 1];
    if (last && last.category === key) last.items.push(item);
    else {
      const existing = groups.find((g) => g.category === key);
      if (existing) existing.items.push(item);
      else groups.push({ category: key, items: [item] });
    }
  }

  return (
    <section className="relative overflow-hidden">
      {/* The same soft radial wash as the RSVP page, so the two read as one
          site rather than two templates. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 15%, rgba(219,196,160,.28) 0%, transparent 70%)",
        }}
      />

      <div className="mx-auto max-w-4xl px-6 py-16 md:py-24">
        <header className="mb-14 text-center md:mb-20">
          <p className="mb-3 font-serif text-xs uppercase tracking-[0.35em] text-brown">
            With Gratitude
          </p>
          <h1 className="font-script text-6xl leading-tight text-ink md:text-8xl">
            Registry
          </h1>
          <p className="mx-auto mt-8 max-w-xl font-body text-[0.95rem] leading-relaxed text-ink/70">
            Your presence on the day is truly the gift. But we have been asked
            more than once, so here is what we are slowly gathering for our first
            home together.
          </p>
          <p className="mx-auto mt-4 max-w-xl font-body text-sm leading-relaxed text-ink/50">
            Nothing here is a shopping list. Where we have found something we
            like we have linked it, but please buy whatever version suits you, or
            nothing at all.
          </p>
          <p className="mx-auto mt-4 max-w-xl font-body text-sm leading-relaxed text-ink/50">
            We also know an exact item is not always easy to arrange, so a
            contribution towards the wedding is just as welcome. Speak to{" "}
            {contacts.map((contact, i) => (
              <span key={contact.phone}>
                {i > 0 && (i === contacts.length - 1 ? " or " : ", ")}
                <a
                  // tel: needs the number unspaced; the label keeps the spaces
                  // because that is how a Malawian number is read aloud.
                  href={`tel:${contact.phone.replace(/\s+/g, "")}`}
                  className="whitespace-nowrap text-ink/70 underline decoration-beige decoration-1 underline-offset-4 transition-colors hover:text-brown hover:decoration-sage-deep"
                >
                  {contact.name}
                </a>
              </span>
            ))}{" "}
            and they will tell you how.
          </p>
        </header>

        {error && (
          <p className="border border-beige/70 bg-champagne/40 px-6 py-5 text-center font-body text-sm text-ink/70">
            {error}
          </p>
        )}

        {!items && !error && (
          <p className="text-center font-body text-sm italic text-ink/40">
            Gathering the list…
          </p>
        )}

        {/* An empty list is a real state, not an error: the D1 binding may be
            missing, or every item may be inactive. Saying so plainly beats an
            empty page that looks broken. */}
        {items && items.length === 0 && !error && (
          <p className="text-center font-body text-sm text-ink/60">
            Our registry is still being put together. Do check back.
          </p>
        )}

        {fund && (
          <div className="mb-16 border border-sage/50 bg-sage/10 px-7 py-8 text-center md:px-12 md:py-10">
            <h2 className="font-script text-4xl text-ink md:text-5xl">
              {fund.name}
            </h2>
            {fund.description && (
              <p className="mx-auto mt-4 max-w-md font-body text-sm leading-relaxed text-ink/70">
                {fund.description}
              </p>
            )}
            {/* TODO before launch: the bank / mobile-money details go here.
                Put them in siteConfig (registry.bank, registry.mobileMoney)
                rather than inline, so they are edited in one place — and so
                they are not scattered through the markup when the pledge flow
                lands. See docs/registry-plan.md Phase 5. */}
            {/* Deliberately does NOT repeat the contact names from the intro
                above. Two "speak to X or Y" lines a screen apart reads as the
                page not trusting the guest to have read the first one. */}
            <p className="mt-6 font-serif text-[0.65rem] uppercase tracking-[0.25em] text-brown/70">
              Any amount is welcome
            </p>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.category} className="mb-14 last:mb-0">
            <h2 className="mb-1 border-b border-brown/20 pb-3 font-serif text-[0.7rem] uppercase tracking-[0.3em] text-brown">
              {group.category}
            </h2>
            {/* Ruled rows, no vertical rules and no striping — a boxed grid
                would read as a spreadsheet, which is exactly what this is
                trying not to feel like. */}
            <ul>
              {group.items.map((item) => (
                <RegistryRow key={item.id} item={item} />
              ))}
            </ul>
          </div>
        ))}

        {items && items.length > 0 && (
          <p className="mt-16 text-center font-body text-sm italic leading-relaxed text-ink/45">
            Thank you for reading this far, and for celebrating with us.
          </p>
        )}
      </div>
    </section>
  );
}
