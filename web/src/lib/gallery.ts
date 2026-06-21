import { siteConfig } from "./siteConfig";

/**
 * In development, drop photos into `web/src/assets/gallery/` and they will
 * appear automatically. In production (Cloudflare Pages + R2), set
 * `VITE_MEDIA_BASE` to the public R2 bucket URL and list filenames below.
 */
const remoteFilenames: string[] = [
  // "01-engagement.jpg",
  // "02-coffee.jpg",
];

const localModules = import.meta.glob<{ default: string }>(
  "../assets/gallery/*.{jpg,jpeg,png,webp,avif}",
  { eager: true },
);

export function getGalleryImages(): string[] {
  if (siteConfig.mediaBase && remoteFilenames.length > 0) {
    return remoteFilenames.map(
      (f) => `${siteConfig.mediaBase.replace(/\/$/, "")}/gallery/${f}`,
    );
  }

  return Object.values(localModules)
    .map((m) => m.default)
    .sort();
}
