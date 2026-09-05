import { useRef, useState } from "react";
import type {
  GuestDetail,
  GuestMatch,
  RsvpSubmitSuccess,
} from "@shared/types";
import { fetchGuest, submitRsvp } from "../../lib/rsvpApi";
import { useEscapeKey, useLockBodyScroll } from "../../lib/hooks";
import StepSearch from "./steps/StepSearch";
import StepDetails from "./steps/StepDetails";
import StepReview from "./steps/StepReview";
import StepDone from "./steps/StepDone";
import { Notice } from "./steps/Fields";
import {
  draftFrom,
  emptyDraft,
  toSubmission,
  type RsvpDraft,
} from "./steps/draft";

/**
 * The RSVP form.
 *
 * Four steps, and the guest is never carried forward without agreeing to what
 * just happened:
 *
 *   search   type a name, see who we think you are, confirm it. Search,
 *            candidates and confirmation share one screen so that fixing a
 *            typo does not mean walking backwards through the flow.
 *   details  your reply, plus-one, meal, contact, a note.
 *   review   everything read back before it is sent.
 *   done     confirmation.
 *
 * Once an identity is confirmed, `guest` holds that one person and the
 * candidate list is dropped. Every later step reads `guest` only, so nothing
 * downstream can quietly reinterpret who this is.
 *
 * The draft lives here rather than inside the details step so that stepping
 * forward to review and back again does not empty the form.
 *
 * Mounted only while open (the parent renders it conditionally), so every
 * visit starts from clean state without a reset effect.
 */

type Step = "search" | "details" | "review" | "done";

export default function RsvpModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>("search");
  const [guest, setGuest] = useState<GuestDetail | null>(null);
  const [draft, setDraft] = useState<RsvpDraft>(emptyDraft);
  /** What the guest typed. Carried only for the audit trail on submit. */
  const [typedName, setTypedName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * Which selection is current. Every click on a candidate takes the next
   * number; a response whose number is stale is dropped.
   *
   * Without this, two taps on a slow connection meant the LAST response to
   * land won — so a guest could fill in half the form and have it reset under
   * them by an earlier click resolving late, potentially as a different
   * person than the one they last chose.
   */
  const selectSeq = useRef(0);
  const [conflict, setConflict] = useState(false);
  const [result, setResult] = useState<RsvpSubmitSuccess | null>(null);

  useLockBodyScroll(true);
  useEscapeKey(true, onClose);

  /**
   * A search hit carries only what step 1 needed. Before the details step can
   * prefill anything we have to fetch the full record, which is also the point
   * where an existing reply arrives.
   */
  async function handleSelect(match: GuestMatch, typed: string) {
    const seq = ++selectSeq.current;
    setLoading(true);
    setError(null);
    setTypedName(typed);

    const res = await fetchGuest(match.publicId);
    if (seq !== selectSeq.current) return; // a newer click already won

    setLoading(false);

    if (!res.ok) {
      setError(res.message);
      return;
    }
    setGuest(res.data);
    setDraft(draftFrom(res.data));
    setStep("details");
  }

  /**
   * Send it.
   *
   * `amend` is set when we already knew about a reply. If the server disagrees
   * — someone replied between this form loading and this click — it answers
   * 409 rather than overwriting, and that becomes a visible prompt instead of
   * a silent replacement. The retry is the guest pressing the button again,
   * now labelled "Replace that reply".
   */
  async function handleSubmit() {
    if (!guest) return;
    setBusy(true);
    setError(null);

    const amend = Boolean(guest.response) || conflict;
    const res = await submitRsvp(
      toSubmission(draft, guest.publicId, guest.allowPlusOne, typedName, amend),
    );
    setBusy(false);

    if (!res.ok) {
      if (res.error === "already_responded") {
        setConflict(true);
        // Keep what the server says is on record. Without this the review
        // screen still believes there is no existing reply, and stops showing
        // "Phone: Unchanged" even though the number will in fact be kept.
        if (res.existing) {
          setGuest({ ...guest, response: res.existing, hasResponded: true });
        }
        return;
      }
      setError(res.message);
      return;
    }

    setResult(res);
    setStep("done");
  }

  function backToSearch() {
    setGuest(null);
    setDraft(emptyDraft);
    setError(null);
    setConflict(false);
    setStep("search");
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
          {step === "search" && (
            <div className="space-y-5">
              <StepSearch
                onSelect={handleSelect}
                initialQuery={typedName}
                busy={loading}
              />
              {error && <Notice tone="error">{error}</Notice>}
            </div>
          )}

          {step === "details" && guest && (
            <StepDetails
              guest={guest}
              draft={draft}
              onChange={setDraft}
              onContinue={() => setStep("review")}
              onBack={backToSearch}
            />
          )}

          {step === "review" && guest && (
            <StepReview
              guest={guest}
              draft={draft}
              busy={busy}
              error={error}
              conflict={conflict}
              onConfirm={handleSubmit}
              onBack={() => {
                setError(null);
                setStep("details");
              }}
            />
          )}

          {step === "done" && result && (
            <StepDone result={result} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}
