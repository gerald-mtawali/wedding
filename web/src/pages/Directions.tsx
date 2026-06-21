import { siteConfig } from "../lib/siteConfig";

export default function Directions() {
  return (
    <section className="max-w-3xl mx-auto px-6 py-24 text-center">
      <p className="text-xs uppercase tracking-[0.35em] text-brown mb-3">
        Finding Us
      </p>
      <h1 className="font-script text-5xl md:text-7xl text-ink mb-6">
        Directions
      </h1>
      <p className="font-serif text-lg text-ink/80">
        The ceremony will be held in {siteConfig.venueShort}. Detailed
        directions and a map will be added here soon.
      </p>
    </section>
  );
}
