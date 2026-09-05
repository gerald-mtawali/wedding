import { siteConfig } from "./siteConfig";

/**
 * Resolves the polaroid photo shown on the RSVP page.
 *
 *   - Production: the R2 URL from `siteConfig.invitationPhoto`
 *     (VITE_INVITATION_PHOTO) wins when set.
 *   - Local dev / unset: falls back to `src/assets/invite-photo.jpg`
 *     (other extensions are accepted too).
 *   - Neither present: returns "", and the polaroid renders an empty frame.
 *
 * Local files must be *imported* (not referenced by raw path) so Vite can
 * resolve them to a real URL in dev and a hashed asset URL in the build —
 * this mirrors how `storyPhotos.ts` loads the Our Story frames.
 */
const localModules = import.meta.glob<{ default: string }>(
  "../assets/invite-photo.{jpg,jpeg,png,webp,avif}",
  { eager: true },
);

function localPhoto(): string {
  const first = Object.values(localModules)[0];
  return first?.default ?? "";
}

/** The invitation photo URL, or "" when none is configured. */
export function getInvitationPhoto(): string {
  return siteConfig.invitationPhoto || localPhoto();
}
