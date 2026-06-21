import { Link } from "react-router-dom";
import { siteConfig } from "../../lib/siteConfig";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Soft botanical accents */}
      <div
        aria-hidden
        className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-sage/15 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute -bottom-32 -right-24 w-med h-med rounded-full bg-beige/40 blur-3xl"
      />

      <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-10 md:pt-28 md:pb-14 text-center">
        <div className="flex flex-col items-center gap-3">
          <p className="font-script text-5xl md:text-5xl text-black mb-6">
            Join Us in Celebrating
          </p>
          <div className="flex items-center gap-4 text-brown">
            <span className="h-px w-12 bg-brown/40" />
            <span className="m-5 text-xs uppercase tracking-[0.35em]">
              The Wedding Of
            </span>
            <span className="h-px w-12 bg-brown/40" />
          </div>
        </div>

        <h1 className="font-serif text-5xl md:text-7xl text-ink tracking-wider">
          <span className="block">{siteConfig.groom.toUpperCase()}</span>
          <span className="block my-2 font-script text-4xl md:text-6xl text-brown normal-case tracking-normal">
            &amp;
          </span>
          <span className="block">{siteConfig.bride.toUpperCase()}</span>
        </h1>

        <div className="mt-10 flex flex-col items-center gap-3">
          <p className="font-body text-xl md:text-2xl text-ink tracking-[0.05em]">
            {siteConfig.dateLabel}
          </p>
          <p className="font-body text-lg md:text-xl text-brown tracking-[0.05em]">
            {siteConfig.venue}
          </p>
        </div>

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/rsvp"
            className="inline-flex items-center gap-3 px-8 py-3 bg-sage-deep text-champagne-soft rounded-full text-sm uppercase tracking-[0.25em] hover:bg-sage transition-colors shadow-sm"
          >
            RSVP
            <span aria-hidden>→</span>
          </Link>
          <a
            href="#our-story"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm uppercase tracking-[0.25em] text-brown-dark hover:text-sage-deep transition-colors"
          >
            Our Story
          </a>
        </div>
      </div>
    </section>
  );
}
