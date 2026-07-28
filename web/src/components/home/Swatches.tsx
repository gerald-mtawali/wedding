/** Capture the colour palette swatches for the wedding. */

import type { CSSProperties } from "react";
import { getSwatchImage, type SwatchKey } from "../../lib/swatches";

type Swatch = {
  /** Colour key — matches the satin-cloth image name and env override. */
  key: SwatchKey;
  /** Display name shown on hover and in the caption. */
  name: string;
  /** Palette colour used as a fallback tint behind the fabric image. */
  hex: string;
};

/**
 * Ordered for display: the first three render on the top row, the last two
 * nestle into the valleys below.
 */
const SWATCHES: Swatch[] = [
  { key: "beige", name: "Beige", hex: "#dbc4a0" },
  { key: "champagne", name: "Champagne", hex: "#f7e7ce" },
  { key: "sage", name: "Sage", hex: "#a3b18a" },
  { key: "brown", name: "Brown", hex: "#5a4a3a" },
  { key: "olive", name: "Olive", hex: "#6f7352" },
];

function Diamond({ swatch }: { swatch: Swatch }) {
  const image = getSwatchImage(swatch.key);
  const face: CSSProperties = {
    backgroundColor: swatch.hex,
    ...(image
      ? {
          backgroundImage: `url(${image})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : {}),
  };

  return (
    <div
      className="group relative flex h-56 w-56 items-center justify-center md:h-[280px] md:w-[280px]"
      aria-label={swatch.name}
      role="img"
    >
      <div
        className="relative h-[70.71%] w-[70.71%] rotate-45 overflow-hidden rounded-[6px] shadow-md ring-1 ring-black/10 transition-transform duration-500 ease-out group-hover:z-10 group-hover:scale-125 group-hover:shadow-xl"
        style={face}
      >
        <div className="absolute inset-0 -rotate-45">
          <div className="flex h-full w-full items-center justify-center">
            <span
              className="rounded-full bg-black/25 px-3 py-1 text-center font-body text-[0.7rem] uppercase tracking-[0.18em] text-white opacity-0 backdrop-blur-[1px] transition-opacity duration-300 group-hover:opacity-100 md:text-sm"
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
            <Diamond key={s.key} swatch={s} />
          ))}
        </div>
        <div className="-mt-28 flex md:-mt-[140px]">
          {bottom.map((s) => (
            <Diamond key={s.key} swatch={s} />
          ))}
        </div>

        <p className="mt-14 text-xs uppercase tracking-[0.3em] text-brown/70">
          Hover to reveal each tone
        </p>

        <div className="mt-6 text-center font-body text-sm tracking-[0.12em] text-brown">
          <p>{top.map((s) => s.name).join("  ·  ")}</p>
          <p className="mt-1">{bottom.map((s) => s.name).join("  ·  ")}</p>
        </div>
      </div>
    </section>
  );
};

export default Swatches;
