import { siteConfig } from "./siteConfig";

/**
 * Resolves the invitation artwork — the same file you send to the printer.
 *
 *   - Production: the R2 URL from `siteConfig.invitationAsset`
 *     (VITE_INVITATION_ASSET) wins when set.
 *   - Local dev / unset: falls back to an image bundled from
 *     `src/assets/invitation.{svg,png,jpg,jpeg,webp,avif}`.
 *   - Neither present: returns null, and `InvitationCard` renders the
 *     typographic version built from `siteConfig` instead.
 *
 * SVG is the format to aim for: it's vector, so it stays razor-sharp when the
 * card is magnified or viewed on a high-DPI phone, and it's usually a smaller
 * file than a print-resolution raster. Export with **text converted to
 * outlines** — otherwise the browser substitutes any font it can't find and
 * the page stops matching the printed card, which is the whole point.
 *
 * PDFs can't be drawn inline as an image; convert once with
 * `npm run invite:from-pdf -- path/to/invite.pdf` (see web/package.json).
 */
const localModules = import.meta.glob<{ default: string }>(
  "../assets/invitation.{svg,png,jpg,jpeg,webp,avif}",
  { eager: true },
);

export type Artwork = {
  src: string;
  /** Vector artwork can be scaled without limit; rasters can't. */
  vector: boolean;
};

function localArtwork(): string {
  return Object.values(localModules)[0]?.default ?? "";
}

/** The invitation artwork, or null when none is configured. */
export function getInvitationArtwork(): Artwork | null {
  const src = siteConfig.invitationAsset || localArtwork();
  if (!src) return null;

  const path = src.split("?")[0].toLowerCase();
  if (path.endsWith(".pdf")) {
    // A PDF can't be rendered as an <img>. Rather than embed a viewer inside
    // the card, fall back to the typographic version and say why.
    console.warn(
      "[invitation] PDF artwork can't be displayed inline. Convert it to SVG " +
        "or PNG first: npm run invite:from-pdf -- <file.pdf>",
    );
    return null;
  }

  return { src, vector: path.endsWith(".svg") };
}
