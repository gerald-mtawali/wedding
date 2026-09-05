import { DIETARY_OPTIONS, type RsvpSubmitSuccess } from "@shared/types";
import { Notice } from "./Fields";
import { primaryButtonClass } from "./styles";

/**
 * Step 4 — it is saved.
 *
 * Everything shown here comes from the API's response rather than from the
 * draft, so the guest is reading back what was actually written, not what the
 * browser hoped would be.
 */
export default function StepDone({
  result,
  onClose,
}: {
  result: RsvpSubmitSuccess;
  onClose: () => void;
}) {
  const { guest, response, amended } = result;
  const meal = DIETARY_OPTIONS.find((o) => o.value === response.dietary)?.label;

  return (
    <div className="space-y-7 text-center">
      <p className="font-serif text-[0.6rem] uppercase tracking-[0.3em] text-brown/80">
        {amended ? "Reply updated" : "Reply received"}
      </p>
      <h2
        id="rsvp-title"
        className="font-script text-5xl leading-tight text-ink"
      >
        {response.attending ? "We can't wait" : "Thank you"}
      </h2>

      <span aria-hidden className="mx-auto block h-px w-16 bg-beige" />

      <p className="font-body text-base leading-relaxed text-ink/75">
        {response.attending ? (
          <>
            Thank you, {guest.firstName} — you&apos;re on the list
            {response.plusOneName ? `, along with ${response.plusOneName}` : ""}.
            {meal ? ` We've noted ${meal.toLowerCase()} for the table.` : ""}{" "}
            We&apos;ll be in touch closer to the day with everything you need to
            know.
          </>
        ) : (
          <>
            Thank you for letting us know, {guest.firstName}. You&apos;ll be
            missed — we hope to celebrate with you soon.
          </>
        )}
      </p>

      <Notice tone="success">
        Your reply is saved against your name, so there&apos;s no need to send
        it again. If something changes, come back and search for yourself to
        update it.
      </Notice>

      <button type="button" onClick={onClose} className={primaryButtonClass}>
        Close
      </button>
    </div>
  );
}
