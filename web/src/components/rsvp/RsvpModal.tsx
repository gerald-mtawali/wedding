import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { canonicalCode, matchGuest } from "@shared/names";
import type { Guest, GuestResponse, LookupResult } from "@shared/types";
import { lookupInvite, submitRsvp } from "../../lib/rsvpApi";
import { useEscapeKey, useLockBodyScroll } from "../../lib/hooks";

/**
 * The RSVP form.
 *
 * Two steps, because the invite code is what makes everything else safe:
 *
 *   1. `code`    — the guest enters the code from their invitation. This
 *                  narrows the world to one household, so from here on a name
 *                  only has to be unique among a handful of people rather than
 *                  the whole guest list.
 *   2. `details` — name, reply, plus-one, dietary needs, note. As the guest
 *                  types their name we run the *same* matcher the Worker will
 *                  use (shared/names.ts), so we can tell them immediately
 *                  whether we recognise them and whether they've already
 *                  replied — no surprises on submit.
 *
 * The server remains the authority on all of it; the client-side matching is
 * only there to make the form feel responsive.
 */

type Step = "code" | "details" | "done";

const inputClass =
  "w-full rounded-none border-0 border-b border-beige/70 bg-transparent px-1 py-2.5 font-body text-base text-ink placeholder:text-ink/30 transition-colors focus:border-sage-deep focus:outline-none focus:ring-0";

const labelClass =
  "mb-1.5 block font-serif text-[0.65rem] uppercase tracking-[0.2em] text-brown/80";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
      {hint ? (
        <span className="mt-1.5 block font-body text-xs leading-relaxed text-ink/55">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success";
  children: ReactNode;
}) {
  const tones = {
    info: "border-sage/60 bg-sage/10 text-ink/80",
    error: "border-[#b4553f]/40 bg-[#b4553f]/10 text-[#7d3625]",
    success: "border-sage-deep/40 bg-sage/15 text-ink/85",
  };
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`border-l-2 px-4 py-3 font-body text-sm leading-relaxed ${tones[tone]}`}
    >
      {children}
    </p>
  );
}

function describe(r: GuestResponse): string {
  const parts = [r.attending ? "attending" : "unable to attend"];
  if (r.plusOneName) parts.push(`with ${r.plusOneName}`);
  return parts.join(", ");
}

/**
 * Mounted only while the form is open (the parent conditionally renders it),
 * so every visit starts from clean state without a reset effect.
 */
export default function RsvpModal({
  onClose,
  /** Invite code lifted from the `?c=` query param, if present. */
  initialCode = "",
}: {
  onClose: () => void;
  initialCode?: string;
}) {
  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState(initialCode);
  const [party, setParty] = useState<LookupResult | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [attending, setAttending] = useState<boolean | null>(null);
  const [bringingGuest, setBringingGuest] = useState(false);
  const [plusOneName, setPlusOneName] = useState("");
  const [dietary, setDietary] = useState("");
  const [message, setMessage] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    name: string;
    response: GuestResponse;
    amended: boolean;
  } | null>(null);

  const codeInputRef = useRef<HTMLInputElement>(null);

  useLockBodyScroll(true);
  useEscapeKey(true, onClose);

  // Move focus into the dialog on mount.
  useEffect(() => {
    const id = window.setTimeout(() => codeInputRef.current?.focus(), 80);
    return () => clearTimeout(id);
  }, []);

  // ---------------------------------------------------------------------
  // Live, best-effort match of the typed name against this invitation.
  // Uses the same matcher as the Worker, so what we show here is what the
  // server will conclude.
  // ---------------------------------------------------------------------
  const match = useMemo(() => {
    if (!party || (!firstName.trim() && !lastName.trim())) return null;
    return matchGuest(party.guests, firstName, lastName);
  }, [party, firstName, lastName]);

  const matchedGuest: Guest | null =
    match?.kind === "match" ? (match.guest as Guest) : null;
  const ambiguous = match?.kind === "ambiguous" ? match.candidates : null;
  const existing = matchedGuest?.response ?? null;

  // Only offer a plus-one when this specific guest is allowed one. Before we
  // know who they are, offer it if anyone on the invitation may bring someone.
  const plusOneOffered = matchedGuest
    ? matchedGuest.allowPlusOne
    : (party?.guests.some((g) => g.allowPlusOne) ?? false);

  // Derived rather than reset in an effect: if the guest we resolved to isn't
  // allowed a plus-one, the checkbox simply doesn't count, whatever it holds.
  const bringingPlusOne = bringingGuest && plusOneOffered && attending === true;

  // Prefill from an existing reply so "update" starts from what's on record.
  // Done during render (React's "adjusting state when props change" pattern)
  // rather than in an effect, which would render the empty form first.
  const [prefilledFor, setPrefilledFor] = useState<number | null>(null);
  if (matchedGuest && existing && prefilledFor !== matchedGuest.id) {
    setPrefilledFor(matchedGuest.id);
    setAttending(existing.attending);
    setBringingGuest(Boolean(existing.plusOneName));
    setPlusOneName(existing.plusOneName ?? "");
    setDietary(existing.dietary ?? "");
    setMessage(existing.message ?? "");
  }

  const pickGuest = useCallback((g: { firstName: string; lastName: string }) => {
    setFirstName(g.firstName);
    setLastName(g.lastName);
  }, []);

  // ---------------------------------------------------------------------
  // Step 1 — invite code
  // ---------------------------------------------------------------------
  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!canonicalCode(code)) {
      setError("Please enter the code from your invitation.");
      return;
    }

    setBusy(true);
    try {
      const result = await lookupInvite(code);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setParty(result.data);
      setStep("details");
      // A single-guest invitation needs no name guessing.
      if (result.data.guests.length === 1) pickGuest(result.data.guests[0]);
    } catch {
      setError("We couldn't reach the server. Please check your connection.");
    } finally {
      setBusy(false);
    }
  }

  // ---------------------------------------------------------------------
  // Step 2 — the reply
  // ---------------------------------------------------------------------
  async function handleSubmit(e: React.FormEvent, amend = false) {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError("Please enter your first and last name.");
      return;
    }
    if (attending === null) {
      setError("Please let us know whether you can join us.");
      return;
    }
    if (bringingPlusOne && !plusOneName.trim()) {
      setError("Please tell us your guest's name.");
      return;
    }

    setBusy(true);
    try {
      const result = await submitRsvp({
        code,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        attending,
        plusOneName: bringingPlusOne ? plusOneName.trim() : undefined,
        dietary: dietary.trim() || undefined,
        message: message.trim() || undefined,
        amend: amend || Boolean(existing),
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setConfirmation({
        name: result.guest.firstName,
        response: result.response,
        amended: result.amended,
      });
      setStep("done");
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-brown/70 p-4 backdrop-blur-sm sm:items-center sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rsvp-title"
        className="relative my-auto w-full max-w-lg bg-champagne-soft shadow-2xl ring-1 ring-black/10"
      >
        {/* Hairline frame, echoing the invitation card. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-2.5 border border-beige/50"
        />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full text-lg leading-none text-brown/60 transition hover:bg-beige/25 hover:text-brown"
        >
          <span aria-hidden>&times;</span>
        </button>

        <div className="relative px-6 py-10 sm:px-10 sm:py-12">
          {/* ============================== Step 1 ============================== */}
          {step === "code" && (
            <form onSubmit={handleLookup} className="space-y-7">
              <header className="text-center">
                <p className="mb-2 font-serif text-[0.6rem] uppercase tracking-[0.3em] text-brown/80">
                  Kindly Respond
                </p>
                <h2
                  id="rsvp-title"
                  className="font-script text-5xl leading-tight text-ink"
                >
                  Will you join us?
                </h2>
              </header>

              <p className="text-center font-body text-sm leading-relaxed text-ink/70">
                Please enter the code printed on your invitation so we can find
                your name.
              </p>

              <Field
                label="Invite code"
                hint="Six characters — letters and numbers. Case doesn't matter."
              >
                <input
                  ref={codeInputRef}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={12}
                  placeholder="K3RQ7M"
                  className={`${inputClass} text-center font-serif text-2xl uppercase tracking-[0.4em]`}
                />
              </Field>

              {error && <Notice tone="error">{error}</Notice>}

              <button
                type="submit"
                disabled={busy}
                className="w-full bg-brown-dark px-8 py-4 font-serif text-xs uppercase tracking-[0.3em] text-champagne-soft transition-colors hover:bg-brown disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Looking…" : "Continue"}
              </button>

              <p className="text-center font-body text-xs leading-relaxed text-ink/50">
                Can&apos;t find your code? Send us a message and we&apos;ll look
                you up.
              </p>
            </form>
          )}

          {/* ============================== Step 2 ============================== */}
          {step === "details" && party && (
            <form onSubmit={(e) => handleSubmit(e)} className="space-y-7">
              <header className="text-center">
                <p className="mb-2 font-serif text-[0.6rem] uppercase tracking-[0.3em] text-brown/80">
                  {party.party.label}
                </p>
                <h2
                  id="rsvp-title"
                  className="font-script text-5xl leading-tight text-ink"
                >
                  Your reply
                </h2>
              </header>

              {/* Quick-select when more than one person is on the invitation. */}
              {party.guests.length > 1 && (
                <div>
                  <span className={labelClass}>Who is replying?</span>
                  <div className="flex flex-wrap gap-2">
                    {party.guests.map((g) => {
                      const active = matchedGuest?.id === g.id;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => pickGuest(g)}
                          className={`border px-3.5 py-2 font-body text-sm transition-colors ${
                            active
                              ? "border-sage-deep bg-sage-deep text-champagne-soft"
                              : "border-beige/70 text-ink/75 hover:border-sage hover:bg-sage/10"
                          }`}
                        >
                          {g.firstName} {g.lastName}
                          {g.response && (
                            <span
                              aria-label="already replied"
                              className="ml-1.5 opacity-70"
                            >
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="First name">
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                    className={inputClass}
                  />
                </Field>
                <Field label="Last name">
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                    className={inputClass}
                  />
                </Field>
              </div>

              {ambiguous && (
                <Notice tone="info">
                  More than one guest on this invitation matches that name —
                  please choose which one is you above.
                </Notice>
              )}

              {existing && (
                <Notice tone="info">
                  You&apos;ve already replied ({describe(existing)}). Submitting
                  again will update your response rather than add a new one.
                </Notice>
              )}

              {/* Attending / declining */}
              <div>
                <span className={labelClass}>Will you be there?</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: true, label: "Joyfully accepts" },
                    { value: false, label: "Regretfully declines" },
                  ].map((opt) => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      aria-pressed={attending === opt.value}
                      onClick={() => setAttending(opt.value)}
                      className={`border px-3 py-3.5 font-serif text-[0.65rem] uppercase tracking-[0.15em] transition-colors ${
                        attending === opt.value
                          ? "border-sage-deep bg-sage-deep text-champagne-soft"
                          : "border-beige/70 text-ink/70 hover:border-sage hover:bg-sage/10"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Plus-one */}
              {attending === true && plusOneOffered && (
                <div className="space-y-4">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={bringingGuest}
                      onChange={(e) => setBringingGuest(e.target.checked)}
                      className="h-4 w-4 accent-[#7e8f66]"
                    />
                    <span className="font-body text-sm text-ink/80">
                      I&apos;m bringing a guest
                    </span>
                  </label>

                  {bringingGuest && (
                    <Field label="Guest's full name">
                      <input
                        value={plusOneName}
                        onChange={(e) => setPlusOneName(e.target.value)}
                        placeholder="So we can write their place card"
                        className={inputClass}
                      />
                    </Field>
                  )}
                </div>
              )}

              {attending === true && (
                <Field
                  label="Dietary restrictions"
                  hint="Allergies, vegetarian, halal — anything we should tell the kitchen."
                >
                  <textarea
                    value={dietary}
                    onChange={(e) => setDietary(e.target.value)}
                    rows={2}
                    maxLength={300}
                    className={`${inputClass} resize-none`}
                  />
                </Field>
              )}

              <Field label="A note to the couple">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Optional"
                  className={`${inputClass} resize-none`}
                />
              </Field>

              {error && <Notice tone="error">{error}</Notice>}

              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setStep("code");
                    setError(null);
                  }}
                  className="px-6 py-4 font-serif text-xs uppercase tracking-[0.25em] text-brown/70 transition-colors hover:text-brown"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 bg-brown-dark px-8 py-4 font-serif text-xs uppercase tracking-[0.3em] text-champagne-soft transition-colors hover:bg-brown disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy
                    ? "Sending…"
                    : existing
                      ? "Update my reply"
                      : "Send my reply"}
                </button>
              </div>
            </form>
          )}

          {/* ============================== Done ============================== */}
          {step === "done" && confirmation && (
            <div className="space-y-7 text-center">
              <p className="font-serif text-[0.6rem] uppercase tracking-[0.3em] text-brown/80">
                {confirmation.amended ? "Reply updated" : "Reply received"}
              </p>
              <h2
                id="rsvp-title"
                className="font-script text-5xl leading-tight text-ink"
              >
                {confirmation.response.attending
                  ? "We can't wait"
                  : "Thank you"}
              </h2>

              <span
                aria-hidden
                className="mx-auto block h-px w-16 bg-beige"
              />

              <p className="font-body text-base leading-relaxed text-ink/75">
                {confirmation.response.attending ? (
                  <>
                    Thank you, {confirmation.name} — you&apos;re on the list
                    {confirmation.response.plusOneName
                      ? `, along with ${confirmation.response.plusOneName}`
                      : ""}
                    . We&apos;ll be in touch closer to the day with everything
                    you need to know.
                  </>
                ) : (
                  <>
                    Thank you for letting us know, {confirmation.name}.
                    You&apos;ll be missed — we hope to celebrate with you soon.
                  </>
                )}
              </p>

              <Notice tone="success">
                Your response is saved against your invitation, so there&apos;s
                no need to send it again. If something changes, come back and
                update it with the same code.
              </Notice>

              <button
                type="button"
                onClick={onClose}
                className="w-full bg-brown-dark px-8 py-4 font-serif text-xs uppercase tracking-[0.3em] text-champagne-soft transition-colors hover:bg-brown"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
