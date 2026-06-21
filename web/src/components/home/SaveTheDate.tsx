import { siteConfig } from "../../lib/siteConfig";

// Per-aspect frame width so vertical videos don't dominate the viewport.
const FRAME_WIDTH: Record<typeof siteConfig.saveTheDateAspect, string> = {
  "9/16": "max-w-xs sm:max-w-sm",
  "4/5": "max-w-sm sm:max-w-md",
  "1/1": "max-w-md sm:max-w-lg",
  "16/9": "max-w-3xl md:max-w-4xl",
};

export default function SaveTheDate() {
  const src = siteConfig.saveTheDateVideo;
  const aspect = siteConfig.saveTheDateAspect;
  const frameWidth = FRAME_WIDTH[aspect];

  return (
    <section className="max-w-5xl mx-auto px-6 py-20 md:py-24 text-center">
      <p className="text-xs uppercase tracking-[0.35em] text-brown mb-3">
        Our Invitation
      </p>
      <h2 className="font-script text-5xl md:text-7xl text-ink mb-10">
        Save the Date
      </h2>

      <div
        className={`relative w-full ${frameWidth} mx-auto bg-brown-dark/90 overflow-hidden shadow-lg`}
        style={{ aspectRatio: aspect.replace("/", " / ") }}
      >
        {src ? (
          <video
            key={src}
            controls
            playsInline
            preload="metadata"
            className="absolute inset-0 w-full h-full object-contain bg-black"
          >
            <source src={src} type={siteConfig.saveTheDateVideoType} />
            Your browser does not support the video tag.
          </video>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-champagne-soft/80 gap-3 px-6 text-center">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-80"
            >
              <path d="M16 11.5l5-3.5v8l-5-3.5" />
              <rect x="3" y="6" width="13" height="12" rx="2" />
            </svg>
            <p className="font-body text-sm tracking-widest uppercase">
              Save the Date Video
            </p>
            <p className="text-xs opacity-70 max-w-[20rem]">
              Drop a file at{" "}
              <code>web/public/videos/save-the-date.mp4</code> for local dev,
              or set <code>VITE_SAVE_THE_DATE_VIDEO</code> for prod.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
