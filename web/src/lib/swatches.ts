import { siteConfig } from "./siteConfig";

/**
 * Resolves a fabric swatch image by colour key.
 *
 *   - Production: the R2 URL from `siteConfig.swatchImages[key]`
 *     (VITE_SWATCH_*) wins when set.
 *   - Local dev / any unset key: falls back to the image bundled from
 *     `src/assets/{key}-satin-cloth.png`.
 *
 * Local files must be *imported* (not referenced by raw path) so Vite can
 * resolve them to a real URL in dev and a hashed asset URL in the build —
 * this mirrors how the gallery and story photos are loaded.
 */
const localModules = import.meta.glob<{ default: string }>(
  "../assets/*-satin-cloth.{png,jpg,jpeg,webp,avif}",
  { eager: true },
);

const localByName = new Map<string, string>();
for (const [path, mod] of Object.entries(localModules)) {
  const name = path.split("/").pop();
  if (name) localByName.set(name, mod.default);
}

export type SwatchKey = "beige" | "champagne" | "sage" | "brown" | "olive";

function localCloth(key: SwatchKey): string {
  return (
    localByName.get(`${key}-satin-cloth.png`) ??
    localByName.get(`${key}-satin-cloth.jpg`) ??
    localByName.get(`${key}-satin-cloth.jpeg`) ??
    localByName.get(`${key}-satin-cloth.webp`) ??
    localByName.get(`${key}-satin-cloth.avif`) ??
    ""
  );
}

/** The swatch image URL for a colour (R2 in prod, bundled asset in dev). */
export function getSwatchImage(key: SwatchKey): string {
  return siteConfig.swatchImages[key] || localCloth(key);
}
