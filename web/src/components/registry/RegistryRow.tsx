import { useId, useState } from "react";
import type { RegistryItem } from "@shared/types";

/**
 * One item in the registry: the KIND of thing we would love, and — behind an
 * expander — the specific products we have looked at for it.
 *
 * The expander exists because the links are reference material, not the point.
 * A guest scanning for "what do they actually need" should be able to read the
 * whole list without a wall of retailer names, and a guest who wants to buy the
 * exact kettle we liked is one click away.
 */
export default function RegistryRow({ item }: { item: RegistryItem }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const count = item.options.length;

  return (
    <li className="border-b border-brown/10 last:border-b-0">
      <div className="grid gap-x-8 gap-y-1.5 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_auto] md:items-baseline">
        <h3 className="font-serif text-[0.95rem] tracking-[0.06em] text-ink">
          {item.name}
        </h3>

        {item.description ? (
          <p className="font-body text-sm leading-relaxed text-ink/60">
            {item.description}
          </p>
        ) : (
          <span />
        )}

        <div className="mt-1 md:mt-0 md:justify-self-end">
          {count > 0 ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={panelId}
              className="group inline-flex items-center gap-2 font-serif text-[0.65rem] uppercase tracking-[0.22em] text-brown/70 transition-colors hover:text-brown"
            >
              {/* The count is part of the label, not decoration — it tells a
                  guest whether opening this is worth it. */}
              {count} {count === 1 ? "idea" : "ideas"}
              <svg
                aria-hidden="true"
                viewBox="0 0 10 6"
                className={`h-1.5 w-2.5 transition-transform duration-300 ${
                  open ? "rotate-180" : ""
                }`}
              >
                <path
                  d="M1 1l4 4 4-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ) : (
            // An item with no links still belongs on the page: a guest who
            // wants to give towels should know towels are wanted.
            <span className="font-body text-xs italic text-ink/40">
              still browsing
            </span>
          )}
        </div>
      </div>

      {/* Rendered only when open rather than hidden with CSS, so the closed
          state costs nothing and the links are not in the tab order. */}
      {open && count > 0 && (
        <div
          id={panelId}
          className="mb-5 border border-beige/60 bg-champagne/40 px-5 py-1"
        >
          <ul>
            {item.options.map((option) => (
              <li
                key={option.id}
                className="flex flex-col gap-1.5 border-t border-beige/50 py-3.5 first:border-t-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8"
              >
                <div className="min-w-0">
                  <p className="font-serif text-[0.6rem] uppercase tracking-[0.22em] text-sage-deep">
                    {option.label}
                  </p>
                  <p className="mt-1 font-body text-sm leading-snug text-ink/85">
                    {option.product ?? option.url}
                  </p>
                </div>

                <a
                  href={option.url}
                  target="_blank"
                  // noreferrer as well as noopener: these are outbound links to
                  // retailers and there is no reason to hand them the page a
                  // guest came from.
                  rel="noopener noreferrer"
                  className="shrink-0 font-serif text-[0.65rem] uppercase tracking-[0.2em] text-brown/70 underline decoration-beige decoration-1 underline-offset-4 transition-colors hover:text-brown hover:decoration-sage-deep"
                >
                  {option.retailer ?? "View"}
                  <span aria-hidden="true"> ↗</span>
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}
