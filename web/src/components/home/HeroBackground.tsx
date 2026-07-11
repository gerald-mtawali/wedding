import { siteConfig } from "../../lib/siteConfig";
import heroFallback from "../../assets/hero-photo.png";

type HeroBackgroundProps = {
  /**
   * Colour laid over the photo so foreground white text stays legible.
   * Any CSS colour; defaults to the site ink (near-black).
   */
  overlayColor?: string;
  /** Overlay opacity, 0–1. Tune this to taste for text contrast. */
  overlayOpacity?: number;
};

/**
 * Hero backdrop. Renders, back-to-front:
 *   1. the photo (forced to black & white)
 *   2. an adjustable colour overlay for text contrast
 *
 * Foreground text lives in <Hero> and sits above both of these.
 */
export default function HeroBackground({
  overlayColor = "#1f1a14",
  overlayOpacity = 0.45,
}: HeroBackgroundProps) {
  // Env-provided R2 URL wins; otherwise the bundled asset guarantees a backdrop.
  const src = siteConfig.heroImage || heroFallback;

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {/* 1. Back image (black & white) */}
      <img
        src={src}
        alt=""
        className="absolute inset-0 h-full w-full object-cover grayscale"
        loading="eager"
        fetchPriority="high"
        decoding="async"
      />

      {/* 2. Colour overlay for contrast */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: overlayColor, opacity: overlayOpacity }}
      />
    </div>
  );
}
