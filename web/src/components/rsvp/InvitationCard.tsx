import { siteConfig } from "../../lib/siteConfig";
import { getInvitationArtwork } from "../../lib/invitationArtwork";

/**
 * The invitation.
 *
 * If you've supplied the artwork you're sending to the printer
 * (VITE_INVITATION_ASSET, or src/assets/invitation.svg) it's rendered as-is,
 * so the web card and the paper card are the same object. Otherwise the
 * typographic version below is built from `siteConfig`.
 *
 * The card is a fixed-aspect box — `siteConfig.invitationAspect` — because the
 * whole RSVP scene is laid out in percentages, and a content-sized card would
 * make the composition jump around as fonts load.
 *
 * The fallback sizes all its type in `cqw` (percentages of the card's own
 * width) via a container query, so the same component reads correctly whether
 * it's a 200px thumbnail in the scene or full-screen in the lightbox.
 */

const deckle =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='6' viewBox='0 0 120 6' preserveAspectRatio='none'%3E%3Cpath d='M0 3 Q6 0 12 3 T24 3 T36 3 T48 3 T60 3 T72 3 T84 3 T96 3 T108 3 T120 3 V6 H0 Z' fill='%23000'/%3E%3C/svg%3E\")";

/** Plain-text description of the invitation, for screen readers. */
function altText(): string {
  return [
    "Kindly join us for the wedding of Gerald and Donella.",
    `October 3rd at ${siteConfig.invitationTime}.`,
    siteConfig.invitationAddress.join(", ") + ".",
    "Reception to follow.",
  ].join(" ");
}

export default function InvitationCard() {
  const artwork = getInvitationArtwork();

  return (
    <article
      className="relative w-full select-none bg-white shadow-2xl shadow-black/25 ring-1 ring-black/5 [container-type:inline-size]"
      style={{ aspectRatio: siteConfig.invitationAspect }}
    >
      {artwork ? (
        <>
          <img
            src={artwork.src}
            alt={altText()}
            draggable={false}
            className="h-full w-full object-contain"
          />
        </>
      ) : (
        <>
          {/* Torn paper edges, top and bottom. */}
          <span
            aria-hidden
            className="absolute inset-x-0 -top-[5px] h-[6px] bg-white"
            style={{
              maskImage: deckle,
              WebkitMaskImage: deckle,
              maskSize: "120px 6px",
              WebkitMaskSize: "120px 6px",
              transform: "scaleY(-1)",
            }}
          />
          <span
            aria-hidden
            className="absolute inset-x-0 -bottom-[5px] h-[6px] bg-white"
            style={{
              maskImage: deckle,
              WebkitMaskImage: deckle,
              maskSize: "120px 6px",
              WebkitMaskSize: "120px 6px",
            }}
          />

          {/* Hairline rule, inset like an engraved card. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-[4cqw] border border-beige/60"
          />

          <div className="flex h-full flex-col items-center justify-center px-[10cqw] text-center">
            <p className="font-serif text-[2.7cqw] uppercase leading-relaxed tracking-[0.3em] text-brown/80">
              Kindly join us for the wedding of
            </p>

            <h2 className="mt-[6cqw] font-script text-[15cqw] leading-[1.05] text-ink">
              Gerald <span className="text-beige">&amp;</span> Donella
            </h2>

            <span
              aria-hidden
              className="my-[6cqw] block h-px w-[22cqw] bg-beige"
            />

            <p className="font-serif text-[3.3cqw] uppercase tracking-[0.22em] text-ink">
              October 03<sup className="tracking-normal">rd</sup>
            </p>
            <p className="mt-[1.6cqw] font-serif text-[3.3cqw] uppercase tracking-[0.22em] text-ink">
              at {siteConfig.invitationTime}
            </p>

            <div className="mt-[6cqw] space-y-[1cqw]">
              {siteConfig.invitationAddress.map((line) => (
                <p
                  key={line}
                  className="font-body text-[3.4cqw] leading-relaxed text-ink/75"
                >
                  {line}
                </p>
              ))}
            </div>

            <p className="mt-[7cqw] font-script text-[8.5cqw] leading-none text-brown/70">
              reception to follow
            </p>
          </div>
        </>
      )}
    </article>
  );
}
