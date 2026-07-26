/**
 * Edit this file to update the wedding details rendered across the site.
 * Most copy on the home page references these values.
 */
const isDev = import.meta.env.DEV;
const showStoryEnv = import.meta.env.VITE_SHOW_STORY ?? false;

export const siteConfig = {
  bride: "Donella",
  groom: "Gerald",
  date: new Date("2026-10-03T15:00:00+02:00"),
  dateLabel: "Saturday, October 3rd 2026",
  venue: "Kumbali Castle, Lilongwe, Malawi",
  venueShort: "Kumbali Castle, Lilongwe, Malawi",

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
  showStory: showStoryEnv ?? false,

  /**
   * "Our Story" postcard photos — production R2 URLs only.
   *
   * In production (Cloudflare Pages / Workers build), set VITE_STORY_PHOTO_1,
   * VITE_STORY_PHOTO_2 and VITE_STORY_PHOTO_3 to the public R2 URL for each
   * frame, e.g. https://media.gerald-and-donella.com/photo-frame-1.jpg.
   *
   * When a var is unset (local dev, or a missing prod var) the slot is empty
   * here and `getStoryPhotos()` (see lib/storyPhotos.ts) falls back to the
   * local image bundled from src/assets/gallery/photo-frame-{1,2,3}.jpg.
   */
  storyPhotos: [
    (import.meta.env.VITE_STORY_PHOTO_1 as string | undefined) ?? "",
    (import.meta.env.VITE_STORY_PHOTO_2 as string | undefined) ?? "",
    (import.meta.env.VITE_STORY_PHOTO_3 as string | undefined) ?? "",
  ] as readonly string[],

  /**
   * Fabric swatch images (the diamond satin-cloth tiles) — production R2 URLs
   * only, keyed by colour.
   *
   * In production set VITE_SWATCH_BEIGE, VITE_SWATCH_CHAMPAGNE,
   * VITE_SWATCH_SAGE, VITE_SWATCH_BROWN and VITE_SWATCH_OLIVE to the public R2
   * URL for each cloth, e.g.
   * https://media.gerald-and-donella.com/beige-satin-cloth.png.
   *
   * When a var is unset (local dev, or a missing prod var) `getSwatchImage()`
   * (see lib/swatches.ts) falls back to the local image bundled from
   * src/assets/{colour}-satin-cloth.png.
   */
  swatchImages: {
    beige: (import.meta.env.VITE_SWATCH_BEIGE as string | undefined) ?? "",
    champagne:
      (import.meta.env.VITE_SWATCH_CHAMPAGNE as string | undefined) ?? "",
    sage: (import.meta.env.VITE_SWATCH_SAGE as string | undefined) ?? "",
    brown: (import.meta.env.VITE_SWATCH_BROWN as string | undefined) ?? "",
    olive: (import.meta.env.VITE_SWATCH_OLIVE as string | undefined) ?? "",
  } as Record<string, string>,
} as const;

export type SiteConfig = typeof siteConfig;
