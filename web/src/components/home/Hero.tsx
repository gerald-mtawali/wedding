import { Link } from "react-router-dom";
import { siteConfig } from "../../lib/siteConfig";
import HeroBackground from "./HeroBackground";
import Countdown from "./Countdown";

export default function Hero() {
  return (
    <section
      id="hero"
      className="relative isolate flex min-h-[100svh] items-center overflow-hidden text-white"
    >
      {/* (Back) image → colour overlay → gradient fade. Text sits above via z-10. */}
      <HeroBackground overlayOpacity={0.45} />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-6 py-24 text-center">
        <div className="flex flex-col items-center gap-3">
          <p className="font-script text-5xl md:text-5xl mb-4">
            Join Us in Celebrating
          </p>
          <div className="flex items-center gap-4 text-white/80">
            <span className="h-px w-12 bg-white/50" />
            <span className="m-5 text-xs uppercase tracking-[0.35em]">
              The Wedding Of
            </span>
            <span className="h-px w-12 bg-white/50" />
          </div>
        </div>

        <h1 className="font-serif text-5xl md:text-7xl tracking-wider  text-white/80">
          <span className="block">{siteConfig.groom.toUpperCase()}</span>
          <span className="block my-2 font-script text-4xl md:text-6xl normal-case tracking-normal text-sage-deep">
            &amp;
          </span>
          <span className="block">{siteConfig.bride.toUpperCase()}</span>
        </h1>

        <div className="mt-10 flex flex-col items-center gap-3">
          <p className="font-body text-xl md:text-2xl tracking-[0.05em]">
            {siteConfig.dateLabel}
          </p>
          <p className="font-body text-lg md:text-xl text-white/85 tracking-[0.05em]">
            {siteConfig.venue}
          </p>
        </div>

        <Countdown target={siteConfig.countdownTarget} className="mt-12" />

        <div className="mt-12 flex justify-center">
          <Link
            to="/rsvp"
            className="inline-flex items-center gap-3 rounded-full bg-sage-deep px-10 py-3 text-sm uppercase tracking-[0.25em] text-champagne-soft shadow-sm transition-colors hover:bg-sage"
          >
            RSVP
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
