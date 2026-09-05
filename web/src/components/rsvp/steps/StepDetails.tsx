import { useState } from "react";
import { DIETARY_OPTIONS, type Dietary, type GuestDetail } from "@shared/types";
import { Field, Notice, StepHeader } from "./Fields";
import { inputClass, labelClass, primaryButtonClass, quietButtonClass, selectableClass } from "./styles";
import { bringingGuest, validate, type RsvpDraft } from "./draft";

/**
 * Step 2 — the reply itself.
 *
 * Fields appear only when they can apply: the meal question is meaningless for
 * someone who has declined, and the plus-one block never appears for a guest
 * who was not offered one. Showing a disabled control would be telling a guest
 * about something they cannot have.
 */

function fullName(g: { firstName: string; middleName: string | null; lastName: string }) {
  return [g.firstName, g.middleName, g.lastName].filter(Boolean).join(" ");
}

/** The five meal options, as chips rather than a native select. */
function DietaryPicker({
  value,
  onChange,
  label,
}: {
  value: Dietary | null;
  onChange: (d: Dietary) => void;
  label: string;
}) {
  return (
    <div>
      <span className={labelClass}>{label}</span>
      <div className="flex flex-wrap gap-2">
        {DIETARY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={selectableClass(value === opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function StepDetails({
  guest,
  draft,
  onChange,
  onContinue,
  onBack,
}: {
  guest: GuestDetail;
  draft: RsvpDraft;
  onChange: (next: RsvpDraft) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof RsvpDraft>(key: K, value: RsvpDraft[K]) =>
    onChange({ ...draft, [key]: value });

  const attending = draft.attending;
  const withGuest = bringingGuest(draft, guest.allowPlusOne);

  function handleContinue() {
    const problem = validate(draft, guest.allowPlusOne);
    setError(problem);
    if (!problem) onContinue();
  }

  return (
    <div className="space-y-7">
      <StepHeader eyebrow={guest.householdLabel} title="Your reply" />

      {/* Who we think this is. Kept visible for the whole step so a guest who
          picked the wrong namesake notices before they fill anything in. */}
      <div className="flex items-baseline justify-between gap-4 border-y border-beige/50 py-3">
        <span className="font-body text-base text-ink">{fullName(guest)}</span>
        <button type="button" onClick={onBack} className="shrink-0 font-serif text-[0.6rem] uppercase tracking-[0.15em] text-brown/70 underline decoration-beige underline-offset-4 transition-colors hover:text-brown">
          Not you?
        </button>
      </div>

      {guest.response && (
        <Notice tone="info">
          You&apos;ve already replied. Anything you send now will update that
          reply rather than add a second one.
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
              onClick={() => set("attending", opt.value)}
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

      {attending === true && (
        <>
          <DietaryPicker
            label="What would you like to eat?"
            value={draft.dietary}
            onChange={(d) => set("dietary", d)}
          />

          <Field
            label="Anything else the kitchen should know?"
            hint="Allergies, or anything the options above don't cover. Optional."
          >
            <textarea
              value={draft.dietaryNotes}
              onChange={(e) => set("dietaryNotes", e.target.value)}
              rows={2}
              maxLength={300}
              className={`${inputClass} resize-none`}
            />
          </Field>

          {/* Only for guests who were actually offered one. */}
          {guest.allowPlusOne && (
            <div className="space-y-4 border-l-2 border-beige/50 pl-4">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={draft.bringingPlusOne}
                  onChange={(e) => set("bringingPlusOne", e.target.checked)}
                  className="h-4 w-4 accent-[#7e8f66]"
                />
                <span className="font-body text-sm text-ink/80">
                  I&apos;m bringing a guest
                </span>
              </label>

              {withGuest && (
                <>
                  <Field label="Your guest's full name">
                    <input
                      value={draft.plusOneName}
                      onChange={(e) => set("plusOneName", e.target.value)}
                      placeholder="So we can write their place card"
                      className={inputClass}
                    />
                  </Field>
                  <DietaryPicker
                    label="And what would they like to eat?"
                    value={draft.plusOneDietary}
                    onChange={(d) => set("plusOneDietary", d)}
                  />
                </>
              )}
            </div>
          )}
        </>
      )}

      {attending !== null && (
        <Field
          label="Phone or WhatsApp (optional)"
          hint={
            guest.response?.hasPhone
              ? "We already have a number for you. Leave this blank to keep it, or type a new one to replace it."
              : attending
                ? "Optional, but it's how we'll reach you about the day. We won't share it."
                : "Optional — only if you'd like us to stay in touch."
          }
        >
          <input
            type="tel"
            value={draft.phone}
            onChange={(e) => set("phone", e.target.value)}
            autoComplete="tel"
            placeholder="+265 …"
            className={inputClass}
          />
        </Field>
      )}

      <Field label="A note to the couple">
        <textarea
          value={draft.message}
          onChange={(e) => set("message", e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Optional"
          className={`${inputClass} resize-none`}
        />
      </Field>

      {error && <Notice tone="error">{error}</Notice>}

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <button type="button" onClick={onBack} className={quietButtonClass}>
          Back
        </button>
        <button
          type="button"
          onClick={handleContinue}
          className={primaryButtonClass}
        >
          Review my reply
        </button>
      </div>
    </div>
  );
}
