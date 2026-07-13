/** Capture the colour palette swatches for the wedding. */

import type { CSSProperties } from "react";

type Swatch = {
  /** Display name shown on hover. */
  name: string;
  /** Base fabric colour. */
  hex: string;
  /** Label colour, chosen to contrast the swatch. */
  text: string;
  /**
   * Optional fabric image. Drop a file in web/public (for example
   * /fabrics/sage.jpg) and set this to its path to override the CSS
   * linen texture with a real photo.
   */
  image?: string;
};

/**
 * Ordered for display: the first three render on the top row, the last two
 * nestle into the valleys below. Lighter tones carry ink labels, darker tones
 * carry soft champagne.
 */
const SWATCHES: Swatch[] = [
  { name: "Champagne Mist", hex: "#f7e7ce", text: "#1f1a14" },
  { name: "Pale Oak", hex: "#dbc4a0", text: "#1f1a14" },
  { name: "Dry Sage", hex: "#a3b18a", text: "#1f1a14" },
  { name: "Olive Wood", hex: "#7c6752", text: "#fbf2e1" },
  { name: "Coffee Bean", hex: "#1a090d", text: "#fbf2e1" },
];

/** Woven linen look built from layered threads - no image required. */
function linen(hex: string): CSSProperties {
  return {
    backgroundColor: hex,
    backgroundImage: [
      "repeating-linear-gradient(0deg, rgba(255,255,255,0.07) 0px, rgba(255,255,255,0.07) 1px, transparent 1px, transparent 3px)",
      "repeating-linear-gradient(90deg, rgba(0,0,0,0.06) 0px, rgba(0,0,0,0.06) 1px, transparent 1px, transparent 3px)",
      "repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 2px, transparent 2px, transparent 5px)",
    ].join(","),
    backgroundBlendMode: "overlay, overlay, soft-light",
  };
}

/** Subtle fabric grain layered over the weave for a more textile feel. */
const NOISE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/></svg>\")";

function Diamond({ swatch }: { swatch: Swatch }) {
  const face: CSSProperties = swatch.image
    ? {
        backgroundImage: "url(" + swatch.image + ")",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : linen(swatch.hex);

  return (
    <div
      className="group relative flex h-32 w-32 items-center justify-center md:h-40 md:w-40"
      aria-label={swatch.name + " - " + swatch.hex}
      role="img"
    >
      <div
        className="relative h-[70.71%] w-[70.71%] rotate-45 overflow-hidden rounded-[6px] shadow-md ring-1 ring-black/10 transition-transform duration-500 ease-out group-hover:z-10 group-hover:scale-125 group-hover:shadow-xl"
        style={face}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-25 mix-blend-soft-light"
          style={{ backgroundImage: NOISE, backgroundSize: "140px 140px" }}
        />
        <div className="absolute inset-0 -rotate-45">
          <div className="flex h-full w-full items-center justify-center">
            <span
              className="px-2 text-center font-body text-[0.7rem] uppercase tracking-[0.18em] opacity-0 transition-opacity duration-300 group-hover:opacity-100 md:text-sm"
              style={{ color: swatch.text }}
            >
              {swatch.name}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const Swatches = () => {
  const top = SWATCHES.slice(0, 3);
  const bottom = SWATCHES.slice(3);

  return (
    <section className="relative">
      <div className="mx-auto max-w-4xl px-6 pt-24 pb-12 text-center">
        <p className="mb-3 text-xs uppercase tracking-[0.35em] text-brown">
          What to Wear
        </p>
        <h2 className="font-script text-5xl text-ink md:text-7xl">
          Our Wedding Colours
        </h2>
      </div>

      <div className="flex flex-col items-center pb-24">
        <div className="flex">
          {top.map((s) => (
            <Diamond key={s.name} swatch={s} />
          ))}
        </div>
        <div className="-mt-16 flex md:-mt-20">
          {bottom.map((s) => (
            <Diamond key={s.name} swatch={s} />
          ))}
        </div>

        <p className="mt-14 text-xs uppercase tracking-[0.3em] text-brown/70">
          Hover to reveal each tone
        </p>

        <div className="mt-6 text-center font-body text-sm tracking-[0.12em] text-brown">
          <p>{top.map((s) => s.name).join("  \u00b7  ")}</p>
          <p className="mt-1">{bottom.map((s) => s.name).join("  \u00b7  ")}</p>
        </div>
      </div>
    </section>
  );
};

export default Swatches;
