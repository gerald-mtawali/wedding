/**
 * Edit this file to update the wedding details rendered across the site.
 * Most copy on the home page references these values.
 */
const isDev = import.meta.env.DEV;

export const siteConfig = {
  bride: "Donella",
  groom: "Gerald",
  date: new Date("2026-10-03T15:00:00+02:00"),
  dateLabel: "Saturday, October 3rd 2026",
  venue: "Kumbali, Lilongwe, Malawi",
  venueShort: "Lilongwe, Malawi",

  /**
   * Target the Hero countdown ticks down to — October 3rd 2026, 17:00 in
   * Malawi (CAT, UTC+2). Kept separate from `date` (the ceremony time) so the
   * countdown can point at a different moment without affecting other copy.
   */
  countdownTarget: new Date("2026-10-03T17:00:00+02:00"),

  /**
   * Hero backdrop image.
   *
   *   1. If `VITE_HERO_IMAGE` is set, it wins (production — point it at the R2
   *      public URL, e.g. https://media.gerald-and-donella.com/hero.jpg).
   *   2. Otherwise the Hero falls back to the image bundled at
   *      `web/src/assets/hero.png`, so the site always renders a backdrop with
   *      zero configuration (and it works offline in dev).
   *
   * The Hero renders whatever you supply in black & white via a CSS filter, so
   * a full-colour photo can be dropped in and it will still match the design.
   */
  heroImage: (import.meta.env.VITE_HERO_IMAGE as string | undefined) ?? "",

  /**
   * When deployed to Cloudflare, set VITE_MEDIA_BASE to your R2 public URL
   * (e.g. https://media.gerald-and-donella.com). In dev, we fall back to
   * /gallery from the public folder.
   */
  mediaBase: import.meta.env.VITE_MEDIA_BASE ?? "",

  /**
   * Save the Date video source.
   *
   *   1. If `VITE_SAVE_THE_DATE_VIDEO` is set, it wins (use this for production
   *      — point it at the R2 public URL, e.g.
   *      https://media.gerald-and-donella.com/save-the-date.mp4).
   *   2. Otherwise, in dev, the component reads from the local public folder:
   *      drop a file at `web/public/videos/save-the-date.mp4` and it will be
   *      served from `/videos/save-the-date.mp4`.
   *   3. In production with no env var, it stays empty and the poster shows.
   */
  saveTheDateVideo:
    (import.meta.env.VITE_SAVE_THE_DATE_VIDEO as string | undefined) ??
    (isDev ? "/videos/save-the-date.mp4" : ""),

  /** MIME type for the local Save the Date video. */
  saveTheDateVideoType: "video/mp4",

  /**
   * Aspect ratio of the Save the Date video, expressed as `"w/h"`.
   * Phone-shot vertical video is `"9/16"`; standard widescreen is `"16/9"`.
   */
  saveTheDateAspect: "9/16" as "9/16" | "16/9" | "1/1" | "4/5",
} as const;

export type SiteConfig = typeof siteConfig;
