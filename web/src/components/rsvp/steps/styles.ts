/**
 * Shared class names for the RSVP steps — the same champagne/beige/sage
 * treatment the modal always used, in one place rather than four.
 *
 * Separate from Fields.tsx because React Fast Refresh only works when a module
 * exports components alone; mixing constants in silently disables hot reload
 * for every step.
 */

export const inputClass =
  "w-full rounded-none border-0 border-b border-beige/70 bg-transparent px-1 py-2.5 font-body text-base text-ink placeholder:text-ink/30 transition-colors focus:border-sage-deep focus:outline-none focus:ring-0";

export const labelClass =
  "mb-1.5 block font-serif text-[0.65rem] uppercase tracking-[0.2em] text-brown/80";

/** The primary action. One per step. */
export const primaryButtonClass =
  "w-full bg-brown-dark px-8 py-4 font-serif text-xs uppercase tracking-[0.3em] text-champagne-soft transition-colors hover:bg-brown disabled:cursor-not-allowed disabled:opacity-60";

/** Secondary / "back" action — quiet, never competing with the primary. */
export const quietButtonClass =
  "px-6 py-4 font-serif text-xs uppercase tracking-[0.25em] text-brown/70 transition-colors hover:text-brown";

/**
 * A selectable row or chip. Used for the candidate list, the attending toggle
 * and the dietary picker, so those three read as one family rather than three
 * unrelated controls.
 */
export function selectableClass(active: boolean): string {
  return `border px-3.5 py-2.5 font-body text-sm transition-colors ${
    active
      ? "border-sage-deep bg-sage-deep text-champagne-soft"
      : "border-beige/70 text-ink/75 hover:border-sage hover:bg-sage/10"
  }`;
}

