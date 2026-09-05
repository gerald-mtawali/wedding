import { DIETARY_OPTIONS, type Dietary, type GuestDetail } from "@shared/types";
import { Notice, StepHeader } from "./Fields";
import { primaryButtonClass, quietButtonClass } from "./styles";
import { bringingGuest, type RsvpDraft } from "./draft";

/**
 * Step 3 — read it back before it is sent.
 *
 * Nothing here is editable. The point of the step is that the guest sees the
 * reply as we understood it, in the same words we will store it in, one screen
 * before it becomes a row in the database. A form that submits straight from
 * the inputs gives them no moment to notice they picked the wrong namesake or
 * the wrong meal.
 *
 * Everything shown comes from the draft in the browser — nothing has been sent
 * yet, and the phone number displayed is the one the guest just typed rather
 * than anything read back from the server.
 */

function mealLabel(value: Dietary | null): string {
  return DIETARY_OPTIONS.find((o) => o.value === value)?.label ?? "—";
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-beige/40 py-3">
      <span className="shrink-0 font-serif text-[0.6rem] uppercase tracking-[0.2em] text-brown/80">
        {label}
      </span>
      <span className="text-right font-body text-sm leading-relaxed text-ink/85">
        {value}
      </span>
    </div>
  );
}

export default function StepReview({
  guest,
  draft,
  busy,
  error,
  conflict,
  onConfirm,
  onBack,
}: {
  guest: GuestDetail;
  draft: RsvpDraft;
  busy: boolean;
  error: string | null;
  /** Set when a reply appeared between loading the form and submitting it. */
  conflict: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const attending = draft.attending === true;
  const withGuest = bringingGuest(draft, guest.allowPlusOne);
  const name = [guest.firstName, guest.middleName, guest.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-7">
      <StepHeader eyebrow="One last look" title="Is this right?" />

      <div>
        <Row label="Name" value={name} />
        <Row label="Household" value={guest.householdLabel} />
        <Row
          label="Attending"
          value={attending ? "Joyfully accepts" : "Regretfully declines"}
        />

        {attending && <Row label="Meal" value={mealLabel(draft.dietary)} />}
        {attending && draft.dietaryNotes.trim() && (
          <Row label="Kitchen notes" value={draft.dietaryNotes.trim()} />
        )}

        {withGuest && (
          <>
            <Row label="Bringing" value={draft.plusOneName.trim()} />
            <Row
              label="Their meal"
              value={mealLabel(draft.plusOneDietary)}
            />
          </>
        )}

        {/* A blank field with a number already on file means "keep it", not
            "remove it" — so say so, rather than leaving a gap the guest reads
            as us having lost their number. */}
        {draft.phone.trim() ? (
          <Row label="Phone" value={draft.phone.trim()} />
        ) : guest.response?.hasPhone ? (
          <Row label="Phone" value="Unchanged" />
        ) : null}
        {draft.message.trim() && (
          <Row label="Your note" value={draft.message.trim()} />
        )}
      </div>

      {guest.response && !conflict && (
        <Notice tone="info">
          This will replace the reply already on record for {guest.firstName}.
        </Notice>
      )}

      {/* Someone — probably this guest, in another tab — replied between the
          form loading and this submit. Say so plainly and make replacing it a
          separate, deliberate click rather than something that just happens. */}
      {conflict && (
        <Notice tone="error">
          A reply was recorded for {guest.firstName} while you were filling this
          in. Sending now will replace it.
        </Notice>
      )}

      {error && <Notice tone="error">{error}</Notice>}

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className={quietButtonClass}
        >
          Go back and edit
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={primaryButtonClass}
        >
          {busy
            ? "Sending…"
            : conflict
              ? "Replace that reply"
              : guest.response
                ? "Update my reply"
                : "Send my reply"}
        </button>
      </div>
    </div>
  );
}
