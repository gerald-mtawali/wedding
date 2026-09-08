import { useEffect, useRef, useState } from "react";
import { MIN_QUERY_LENGTH } from "@shared/names";
import type { GuestMatch, SearchResponse } from "@shared/types";
import { searchByName } from "../../../lib/rsvpApi";
import { Field, Notice, StepHeader } from "./Fields";
import { inputClass, selectableClass } from "./styles";
import HelpContacts from "./HelpContacts";

/**
 * Step 1 — find yourself on the guest list.
 *
 * Search, candidates and confirmation live on ONE screen rather than three.
 * The guest types, sees who we think they are, and says yes. Splitting that
 * into separate pages would mean a guest correcting a typo has to walk
 * forwards and backwards through the flow to try again.
 *
 * The result is never guessed at: even a single confident match is presented
 * as "is this you?" rather than silently accepted, because the whole identity
 * model rests on the guest agreeing that the name we found is theirs.
 */

const DEBOUNCE_MS = 300;

function fullName(g: GuestMatch): string {
  return [g.firstName, g.middleName, g.lastName].filter(Boolean).join(" ");
}

/** A candidate row. The household label is the only disambiguator shown. */
function GuestOption({
  guest,
  onSelect,
  disabled,
}: {
  guest: GuestMatch;
  onSelect: (g: GuestMatch) => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(guest)}
      disabled={disabled}
      className={`${selectableClass(false)} flex w-full items-baseline justify-between gap-4 text-left disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <span className="font-body text-base text-ink">{fullName(guest)}</span>
      <span className="shrink-0 font-serif text-[0.6rem] uppercase tracking-[0.15em] text-brown/70">
        {guest.householdLabel}
        {guest.hasResponded && <span className="ml-2 text-sage-deep">replied</span>}
      </span>
    </button>
  );
}

export default function StepSearch({
  onSelect,
  initialQuery = "",
  busy = false,
}: {
  onSelect: (guest: GuestMatch, typedName: string) => void;
  initialQuery?: string;
  /** True while the parent is fetching a chosen guest. */
  busy?: boolean;
}) {
  const [query, setQuery] = useState(initialQuery);
  /**
   * The last answer we got, tagged with the query it answered.
   *
   * Tagging is what makes "is this result still current?" a derived question
   * rather than something to keep in sync: deleting a character simply stops
   * the old answer from matching, so nothing has to be cleared. Storing a bare
   * result meant an effect had to reset it on every keystroke, which is both a
   * cascading render and a way to show answers to a question no longer asked.
   */
  const [answer, setAnswer] = useState<{
    query: string;
    data?: SearchResponse;
    error?: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(id);
  }, []);

  const trimmed = query.trim();
  const tooShort = trimmed.length < MIN_QUERY_LENGTH;

  // Everything below is derived, so there is nothing to keep in sync.
  const shown = answer && answer.query === trimmed ? answer : null;
  const searching = !tooShort && !shown;
  const result = shown?.data ?? null;
  const error = shown?.error ?? null;

  // Debounced live search.
  //
  // `cancelled` guards against a slow early request landing after a fast later
  // one and overwriting fresher results with staler ones — the classic
  // out-of-order-response bug in a search-as-you-type box, and one that would
  // show the guest the wrong candidates.
  useEffect(() => {
    if (tooShort) return;
    let cancelled = false;

    const id = window.setTimeout(async () => {
      const res = await searchByName(trimmed);
      if (cancelled) return;
      setAnswer(
        res.ok
          ? { query: trimmed, data: res.data }
          : { query: trimmed, error: res.message },
      );
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [trimmed, tooShort]);

  const pick = (g: GuestMatch) => onSelect(g, trimmed);

  return (
    <div className="space-y-7">
      <StepHeader eyebrow="Kindly Respond" title="Will you join us?" />

      <p className="text-center font-body text-sm leading-relaxed text-ink/70">
        Please type your name as it appears on your invitation, and we&apos;ll
        find you on the guest list.
      </p>

      <Field
        label="Your name"
        hint="First and last name is usually enough — we&apos;ll cope with a typo."
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="name"
          spellCheck={false}
          placeholder="Jane Doe"
          className={`${inputClass} text-center font-serif text-xl`}
        />
      </Field>

      <div aria-live="polite" className="space-y-4">
        {busy && (
          <p className="text-center font-body text-sm text-ink/50">
            Fetching your details…
          </p>
        )}

        {searching && !busy && (
          <p className="text-center font-body text-sm text-ink/50">Looking…</p>
        )}

        {error && <Notice tone="error">{error}</Notice>}

        {!searching && result?.kind === "match" && (
          <>
            <p className="text-center font-serif text-[0.65rem] uppercase tracking-[0.2em] text-brown/80">
              Is this you?
            </p>
            <div className="flex flex-col gap-2">
              {result.guests.map((g) => (
                <GuestOption key={g.publicId} guest={g} onSelect={pick} disabled={busy} />
              ))}
            </div>
          </>
        )}

        {!searching && result?.kind === "ambiguous" && (
          <>
            <Notice tone="info">
              More than one guest goes by that name. Please choose which one is
              you — the household on the right should tell them apart.
            </Notice>
            <div className="flex flex-col gap-2">
              {result.guests.map((g) => (
                <GuestOption key={g.publicId} guest={g} onSelect={pick} disabled={busy} />
              ))}
            </div>
          </>
        )}

        {!searching && result?.kind === "suggestions" && (
          <>
            <Notice tone="info">
              We couldn&apos;t find that exact name. Did you mean one of these?
            </Notice>
            <div className="flex flex-col gap-2">
              {result.guests.map((g) => (
                <GuestOption key={g.publicId} guest={g} onSelect={pick} disabled={busy} />
              ))}
            </div>
          </>
        )}

        {!searching && result?.kind === "too-short" && (
          <Notice tone="info">
            Please type at least {result.minLength} letters of your name.
          </Notice>
        )}

        {!searching && result?.kind === "none" && (
          <Notice tone="error">
            We couldn&apos;t find that name on the guest list. Check the
            spelling, or try just your surname.
          </Notice>
        )}
      </div>

      {/* Shown on every variant once a search has happened, not only on a
          miss — two wrong Bandas is as much a dead end as no result at all. */}
      {!searching && (result || error) && <HelpContacts />}
    </div>
  );
}
