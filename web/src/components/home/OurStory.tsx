import { getStoryPhotos } from "../../lib/storyPhotos";

/**
 * "Our Story" — three alternating text/photo chapters followed by two short
 * personal notes ("From Him" / "From Her").
 *
 * Desktop: each chapter is a two-column row. Chapters 1 & 3 place the text on
 * the left and the photo on the right; chapter 2 flips them. On mobile every
 * chapter collapses to a single column, paragraph first then photo.
 *
 * Copy lives in `chapters` and `notes` below so it's easy to swap.
 */

type Chapter = {
  body: string;
  /** Which side the paragraph sits on in the desktop two-column layout. */
  textSide: "left" | "right";
  /** Rotation applied to the postcard so the photos feel hand-placed. */
  tilt: string;
};

const chapters: Chapter[] = [
  {
    body:
      "Gerald and Donella came together under the most unusual of circumstances. For nearly twenty years the two of them had lived in the same city, in the very same suburb, and had crossed paths at the same school events — Lilongwe is small enough that this is hardly difficult. They shared mutual friends and acquaintances, and their parents had even attended the same school. And yet, somehow, the two had never actually met.",
    textSide: "left",
    tilt: "md:rotate-[2.5deg]",
  },
  {
    body:
      "That changed one week in July 2021, when the pair finally crossed paths online and decided to go on a date. They hit it off instantly. It was a whirlwind — one they expected to be short-lived, as both were soon due to return to South Africa, where they had been studying before Covid interrupted their lives. Having met in Malawi, it seemed the romance might quietly fizzle once they went back south. But to their surprise, they stayed in touch, and their love only continued to blossom.",
    textSide: "right",
    tilt: "md:-rotate-[2.5deg]",
  },
  {
    body:
      "He was the pragmatic, level-headed rationalist; she the passionate, bright-minded artist. On paper their views often conflicted, yet each came to treasure the way the other challenged them. Over five wonderful years their love, appreciation, and devotion to one another has only deepened. In May 2025, Gerald asked Donella to be his wife. She said yes — and, ecstatic to begin this new chapter, the two now warmly invite everyone they love to come and celebrate the start of their next journey together.",
    textSide: "left",
    tilt: "md:rotate-[2deg]",
  },
];

const notes = {
  him:
    "Donella is like the sun — she draws everything toward her and radiates a light that is simply amazing, and I am happy to be caught in her orbit. I am so grateful to call her my best friend and life partner. I look forward to growing old with her, and to walking through this beautiful journey called life together. Thank you to everyone who is going to make this day so special.",
  her: "Kind, considerate, selfless, sagacious- these are just a few words I would use to describe Gerald. He never fails to show up for the people he loves, and I am so endlessly grateful to be one of them. Our story feels like something lifted from the pages of a fairytale, where every chapter has unfolded so beautifully by the grace of God. I cannot imagine my life without him; my best friend, my confidant, my happy place and my peace. But this is not where our story ends; rather, it is where our greatest adventure begins. Hand in hand, we are turning the page to a beautiful new chapter.We would be honoured to have you join us as we celebrate the beginning of our happily ever after. We cannot wait to share this unforgettable day with you. ",
};

function Postcard({
  src,
  alt,
  tilt,
}: {
  src: string | null;
  alt: string;
  tilt: string;
}) {
  return (
    <div
      className={`relative mx-auto w-full max-w-sm transition-transform duration-500 ease-out hover:rotate-0 ${tilt}`}
    >
      {/* Strip of "tape" holding the postcard to the page. */}
      <span
        aria-hidden
        className="absolute -top-3 left-1/2 z-10 h-6 w-24 -translate-x-1/2 rotate-2 bg-champagne/80 shadow-sm ring-1 ring-beige/40"
      />
      <div className="bg-white p-3 pb-10 shadow-xl ring-1 ring-black/5">
        {src ? (
          <img
            src={src}
            alt={alt}
            loading="lazy"
            className="aspect-[3/4] w-full object-cover"
          />
        ) : (
          <div className="flex aspect-[3/4] w-full items-center justify-center bg-beige/40 text-xs uppercase tracking-widest text-brown/60">
            Photo
          </div>
        )}
      </div>
    </div>
  );
}

export default function OurStory() {
  // R2 URLs in production (VITE_STORY_PHOTO_1..3), falling back to the local
  // src/assets/gallery/photo-frame-*.jpg in dev — see lib/storyPhotos.ts.
  const images = getStoryPhotos();

  return (
    <section id="our-story" className="border-y border-beige/40 bg-champagne/60">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
        {/* Section heading */}
        <div className="mb-16 text-center md:mb-20">
          <p className="mb-3 text-xs uppercase tracking-[0.35em] text-brown">
            The Journey
          </p>
          <h2 className="font-script text-5xl text-ink md:text-7xl">
            Our Story
          </h2>
        </div>

        {/* Three alternating chapters */}
        <div className="space-y-20 md:space-y-28">
          {chapters.map((c, i) => {
            const textFirstOnDesktop = c.textSide === "left";
            return (
              <div
                key={i}
                className="grid items-center gap-10 md:grid-cols-2 md:gap-16"
              >
                {/* Paragraph — always first in the DOM so mobile shows text
                    before the photo. Reordered on desktop when needed. */}
                <div
                  className={`text-center md:text-left ${
                    textFirstOnDesktop ? "md:order-1" : "md:order-2"
                  }`}
                >
                  <p className="font-body text-lg leading-relaxed text-ink/85">
                    {c.body}
                  </p>
                </div>

                <div
                  className={textFirstOnDesktop ? "md:order-2" : "md:order-1"}
                >
                  <Postcard
                    src={images[i] ?? null}
                    alt={`Gerald & Donella — photo ${i + 1}`}
                    tilt={c.tilt}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* From Him / From Her */}
        <div className="mt-24 grid gap-14 border-t border-beige/50 pt-16 md:mt-28 md:grid-cols-2 md:gap-20">
          <div className="text-center md:text-left">
            <h3 className="mb-5 font-serif text-sm font-medium tracking-wide text-brown md:text-sm">
              From Him
            </h3>
            <p className="font-body text-md leading-relaxed text-ink/85">
              {notes.him}
            </p>
          </div>

          <div className="text-center md:text-left">
            <h3 className="mb-5 font-serif text-sm font-medium tracking-wide text-brown md:text-sm">
              From Her
            </h3>
            <p className="font-body text-lg italic leading-relaxed text-ink/70">
              {notes.her}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
