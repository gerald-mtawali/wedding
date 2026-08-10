import { useEffect, useState, type ReactNode } from "react";
import { useEscapeKey, useLockBodyScroll } from "../../lib/hooks";

/**
 * Full-screen viewer for the card and the polaroid.
 *
 * On touch devices this is the "magnify" interaction (there's no hover to
 * lean on); on desktop it's the click-through from the hover zoom.
 */
export default function Lightbox({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);

  useLockBodyScroll(open);
  useEscapeKey(open, onClose);

  // Reset on close during render rather than in an effect — this is the
  // "adjusting state when a prop changes" pattern, and it avoids the extra
  // render pass an effect would cost.
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setMounted(false);
  }

  // Mount first, then flip to the visible state on the next frame so the
  // opening transition has two states to animate between.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Enlarged view"
      onClick={onClose}
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-brown/85 p-5 backdrop-blur-sm transition-opacity duration-300 sm:p-10 ${
        mounted ? "opacity-100" : "opacity-0"
      }`}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="fixed right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-champagne-soft/90 text-xl leading-none text-brown shadow-lg transition hover:bg-champagne sm:right-6 sm:top-6"
      >
        <span aria-hidden>&times;</span>
      </button>

      <div
        onClick={(e) => e.stopPropagation()}
        // Capping the *width* in `vh` units is what keeps a tall portrait card
        // inside the viewport: at 5:7 the height works out to ~1.4× the width,
        // so 60vh of width lands at ~84vh of height on any screen.
        className={`my-auto w-full max-w-[min(92vw,60vh)] transition-all duration-300 ease-out ${
          mounted ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
