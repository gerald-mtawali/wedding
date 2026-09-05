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
   * The wording on the printed invitation. These values are the source for
   * the card's alt text (the artwork is a bitmap, so its words are invisible
   * to screen readers) and for the typographic fallback card. Keep them in
   * step with `src/assets/invitation.webp`.
   */
  invitationAddress: ["Kumbali Castle Garden", "Lilongwe, Malawi"],

  /** As printed: "RECEPTION STARTS @ 15:30". */
  invitationTime: "15:30",

  /** As printed: "KINDLY RSVP BY 15 SEP 2026". */
  rsvpBy: "15 September 2026",

  /**
   * Who a guest should contact when the name search cannot find them.
   *
   * Shown at the foot of every variant of the confirmation step — not only the
   * empty one. Someone looking at two wrong Bandas needs this as much as
   * someone seeing nothing at all.
   *
   * TODO: replace these placeholders with the real names and numbers before
   * launch. They are the only fallback a guest has if the matcher misses them.
   */
  rsvpHelp: {
    contacts: [
      { name: "Reference Person 1", phone: "+265 000 000 001" },
      { name: "Reference Person 2", phone: "+265 000 000 002" },
    ],
  },

  /**
   * Aspect ratio of the polaroid's photo window, as `"width/height"`.
   *
   * The photo is fitted inside this window rather than filling it, so it is
   * never cropped whatever its own proportions — a mismatch just leaves a
   * slightly wider white margin on two sides, which on a polaroid reads as
   * part of the frame. Set this to your photo's actual ratio for even borders.
   */
  invitationPhotoAspect: "4/5",

  /**
   * The printed invitation artwork, so the site shows the identical card.
   *
   * Set VITE_INVITATION_ASSET to the public R2 URL for the file (SVG
   * preferred — see lib/invitationArtwork.ts). Unset, the RSVP page falls
   * back to `web/src/assets/invitation.svg`, and failing that renders the
   * typographic card built from the values above.
   */
  invitationAsset:
    (import.meta.env.VITE_INVITATION_ASSET as string | undefined) ?? "",

  /**
   * Aspect ratio of the printed card, as `"width/height"`. The layout reserves
   * space using this, so it must match the artwork or the card will letterbox.
   *
   * Currently the exact pixel ratio of `src/assets/invitation.webp`
   * (1190 × 1684 — an A-series portrait, 1:√2). Update this if you replace
   * the artwork with a different size.
   */
  invitationAspect: "1190/1684",

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
   * The polaroid photo shown beside the invitation card on the RSVP page.
   *
   * In production set VITE_INVITATION_PHOTO to the public R2 URL for the
   * `INVITATION_PHOTO` object, e.g.
   * https://media.gerald-and-donella.com/invitation-photo.jpg.
   *
   * When unset (local dev, or a missing prod var) `getInvitationPhoto()`
   * (see lib/invitationPhoto.ts) falls back to the local image bundled from
   * src/assets/invitation-photo.{jpg,png,…}, and renders an empty frame if
   * that isn't there either.
   */
  invitationPhoto:
    (import.meta.env.VITE_INVITATION_PHOTO as string | undefined) ?? "",

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
