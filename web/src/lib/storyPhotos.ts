import { siteConfig } from "./siteConfig";

/**
 * Resolves the three "Our Story" postcard photos.
 *
 *   - Production: the R2 URLs from `siteConfig.storyPhotos`
 *     (VITE_STORY_PHOTO_1..3) win when set.
 *   - Local dev / any unset slot: falls back to the image bundled from
 *     `src/assets/gallery/photo-frame-{1,2,3}.jpg`.
 *
 * Local files must be *imported* (not referenced by raw path) so Vite can
 * resolve them to a real URL in dev and a hashed asset URL in the build —
 * this mirrors how `gallery.ts` loads the gallery images.
 */
const localModules = import.meta.glob<{ default: string }>(
  "../assets/gallery/photo-frame-*.{jpg,jpeg,png,webp,avif}",
  { eager: true },
);

const localByName = new Map<string, string>();
for (const [path, mod] of Object.entries(localModules)) {
  const name = path.split("/").pop();
  if (name) localByName.set(name, mod.default);
}

function localFrame(i: number): string {
  return (
    localByName.get(`photo-frame-${i}.jpg`) ??
    localByName.get(`photo-frame-${i}.jpeg`) ??
    localByName.get(`photo-frame-${i}.png`) ??
    localByName.get(`photo-frame-${i}.webp`) ??
    localByName.get(`photo-frame-${i}.avif`) ??
    ""
  );
}

/** The three story photo URLs, in order (frame 1, 2, 3). */
export function getStoryPhotos(): string[] {
  return [1, 2, 3].map((i) => siteConfig.storyPhotos[i - 1] || localFrame(i));
}
