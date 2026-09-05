import {
  MONOGRAM_PATH,
  SEAL,
  SEAL_IMAGE_HEIGHT,
  SEAL_VIEWBOX,
} from "./envelopeArt";

/**
 * The gold wax seal holding the envelope shut — and the page's only call to
 * action while it's closed.
 *
 * The wax itself is the bitmap from the design export; the "G & D" monogram is
 * the vector path from the same file, drawn on top. Both live inside one SVG
 * sharing the export's 98 x 96 coordinate space, so they stay perfectly
 * registered however large the seal is drawn — and the monogram stays crisp
 * at any size without waiting on the script webfont.
 *
 * Rendered as a button so it's keyboard-reachable.
 */
export default function WaxSeal({
  onClick,
  broken,
  className = "",
}: {
  onClick: () => void;
  /** Once broken the seal shrinks away and stops accepting input. */
  broken: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={broken}
      aria-label="Break the seal to open the invitation"
      className={`group relative block w-full transition-all duration-500 ease-out ${
        broken
          ? "pointer-events-none scale-[0.4] opacity-0"
          : "cursor-pointer hover:scale-105 focus-visible:scale-105"
      } focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne focus-visible:ring-offset-4 focus-visible:ring-offset-transparent ${className}`}
    >
      {/* Invisible hit area. The seal is drawn at 18% of the envelope, which
          is only ~41px on a narrow phone — below the 44px minimum for a touch
          target — so the tappable region is extended past the artwork. */}
      <span aria-hidden className="absolute -inset-[30%]" />

      {/* Soft glow that pulses to invite the click. */}
      <span
        aria-hidden
        className="absolute inset-[8%] -z-10 animate-ping rounded-full bg-beige/35 [animation-duration:3s] group-disabled:hidden"
      />

      <svg
        viewBox={SEAL_VIEWBOX}
        className="w-full drop-shadow-[0_3px_5px_rgba(0,0,0,0.35)]"
        role="presentation"
      >
        <image
          href={SEAL}
          width="98"
          height={SEAL_IMAGE_HEIGHT}
          preserveAspectRatio="xMidYMid meet"
        />
        {/* Monogram, debossed: a pale offset copy underneath the dark face
            reads as an edge catching the light, the way stamped wax does. */}
        <g>
          <path
            d={MONOGRAM_PATH}
            fill="#f5dda2"
            opacity="0.55"
            transform="translate(0, 0.55)"
          />
          <path d={MONOGRAM_PATH} fill="#6b4a08" opacity="0.85" />
        </g>
      </svg>
    </button>
  );
}
