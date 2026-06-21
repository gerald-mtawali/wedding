import { Link } from "react-router-dom";
import { siteConfig } from "../../lib/siteConfig";

export default function RsvpCta() {
  return (
    <section className="relative">
      <div className="max-w-4xl mx-auto px-6 py-24 text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-brown mb-3">
          Will You Join Us?
        </p>
        <h2 className="font-script text-5xl md:text-7xl text-ink mb-6">
          Kindly Reply
        </h2>
        <p className="font-serif text-lg text-ink/80 max-w-xl mx-auto mb-10">
          We can&apos;t wait to celebrate with you on {siteConfig.dateLabel}.
          Please let us know if you can make it.
        </p>
        <Link
          to="/rsvp"
          className="inline-flex items-center gap-3 px-10 py-4 bg-brown-dark text-champagne-soft rounded-full text-sm uppercase tracking-[0.3em] hover:bg-brown transition-colors"
        >
          RSVP Now
          <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}
