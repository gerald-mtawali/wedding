/**
 * The gold wax seal that holds the envelope shut — and the page's one call to
 * action while the envelope is closed.
 *
 * Rendered as a button so it's keyboard-reachable; the irregular border-radius
 * and the layered radial gradients are what stop it reading as a flat circle.
 */
export default function WaxSeal({
  onClick,
  broken,
  className = "",
}: {
  onClick: () => void;
  /** Once broken the seal shrinks away and stops accepting input. */
  broken: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={broken}
      aria-label="Open the invitation"
      className={`group relative grid h-20 w-20 place-items-center rounded-full transition-all duration-500 ease-out md:h-24 md:w-24 ${
        broken
          ? "pointer-events-none scale-50 opacity-0"
          : "cursor-pointer hover:scale-105 focus-visible:scale-105"
      } focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne focus-visible:ring-offset-2 focus-visible:ring-offset-sage-deep ${className}`}
    >
      {/* Soft glow that pulses to invite the click. */}
      <span
        aria-hidden
        className="absolute inset-0 -z-10 animate-ping rounded-full bg-beige/40 [animation-duration:3s] group-disabled:hidden"
      />

      {/* The wax blob. The uneven border-radius gives it a hand-pressed edge. */}
      <span
        aria-hidden
        className="absolute inset-0 shadow-lg shadow-black/30 ring-1 ring-black/10"
        style={{
          borderRadius: "48% 52% 46% 54% / 52% 47% 53% 48%",
          background:
            "radial-gradient(circle at 32% 28%, #f0c86a 0%, #d9a520 38%, #b5811a 72%, #8a5f12 100%)",
        }}
      />

      {/* Pressed-in rim. */}
      <span
        aria-hidden
        className="absolute inset-[14%] opacity-70"
        style={{
          borderRadius: "50% 48% 52% 50% / 48% 52% 48% 52%",
          boxShadow:
            "inset 0 1px 2px rgba(255,255,255,.45), inset 0 -2px 3px rgba(0,0,0,.35)",
        }}
      />

      <span className="relative font-script text-3xl leading-none text-[#5a3d07] drop-shadow-[0_1px_0_rgba(255,255,255,.35)] md:text-4xl">
        G&amp;D
      </span>
    </button>
  );
}
