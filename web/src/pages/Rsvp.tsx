import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import EnvelopeReveal from "../components/rsvp/EnvelopeReveal";
import RsvpModal from "../components/rsvp/RsvpModal";

/**
 * The RSVP page.
 *
 * Everything is gated behind the envelope: the guest arrives to a single
 * sealed invitation, breaks the seal, and the card, the photo and the RSVP
 * button follow. The button only appears once the reveal has finished, so
 * there's exactly one thing to do at any moment.
 *
 * A `?c=CODE` query param (the link printed on the invitation, or in an
 * email) pre-fills the invite code in the form.
 */
export default function Rsvp() {
  const [params] = useSearchParams();
  const [opened, setOpened] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const inviteCode = (params.get("c") ?? params.get("code") ?? "").toUpperCase();

  // Scroll the reveal into view once the envelope finishes opening — on a
  // phone the card lands below the fold otherwise.
  useEffect(() => {
    if (!opened) return;
    const id = window.setTimeout(() => {
      document
        .getElementById("rsvp-action")
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 300);
    return () => clearTimeout(id);
  }, [opened]);

  return (
    <section className="relative overflow-hidden">
      {/* Soft radial wash so the envelope sits on something, not on flat paper. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 20%, rgba(219,196,160,.28) 0%, transparent 70%)",
        }}
      />

      <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        {/* Heading */}
        <header className="mb-14 text-center md:mb-16">
          <p className="mb-3 font-serif text-xs uppercase tracking-[0.35em] text-brown">
            You are cordially
          </p>
          <h1 className="font-script text-6xl leading-tight text-ink md:text-8xl">
            Invited
          </h1>

          <p
            className={`mx-auto mt-6 max-w-sm font-body text-sm leading-relaxed text-ink/60 transition-opacity duration-500 ${
              opened ? "opacity-0" : "opacity-100"
            }`}
          >
            Break the seal to open your invitation.
          </p>
        </header>

        <EnvelopeReveal onOpened={() => setOpened(true)} />

        {/* RSVP call to action — appears only after the reveal. */}
        <div
          id="rsvp-action"
          className={`mt-16 text-center transition-all duration-700 ease-out md:mt-20 ${
            opened
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-4 opacity-0"
          }`}
        >
          <span aria-hidden className="mx-auto mb-10 block h-px w-24 bg-beige" />

          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-3 rounded-full bg-brown-dark px-12 py-4 font-serif text-xs uppercase tracking-[0.3em] text-champagne-soft transition-colors hover:bg-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-deep focus-visible:ring-offset-4 focus-visible:ring-offset-champagne-soft"
          >
            RSVP
            <span aria-hidden>→</span>
          </button>

          <p className="mx-auto mt-6 max-w-xs font-body text-xs leading-relaxed text-ink/50">
            You&apos;ll need the code printed on your invitation.
          </p>
        </div>
      </div>

      {/* Mounted only while open, so each visit starts from a clean form. */}
      {formOpen && (
        <RsvpModal
          onClose={() => setFormOpen(false)}
          initialCode={inviteCode}
        />
      )}
    </section>
  );
}
