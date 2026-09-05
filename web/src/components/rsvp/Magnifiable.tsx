import { useEffect, useState, type ReactNode } from "react";
import { useCanHover, usePrefersReducedMotion } from "../../lib/hooks";

/**
 * Wraps the card and the polaroid so both can be examined closely.
 *
 *   - Pointer devices: hovering lifts the item, straightens its tilt and
 *     scales it up in place. Clicking goes to the full-screen view.
 *   - Touch devices: no hover to rely on, so a tap goes straight to
 *     full-screen.
 *
 * `prefers-reduced-motion` drops the zoom but keeps the click-through, so the
 * content is still reachable.
 */
export default function Magnifiable({
  children,
  onActivate,
  label,
  tilt = "",
  /** How far to scale on hover. */
  zoom = 1.28,
  /** Inert while the envelope is still sealed. */
  disabled = false,
  /**
   * Fires when the hover zoom engages or releases, so the parent can lift the
   * item out of the envelope's stacking order while it's enlarged.
   */
  onMagnifyChange,
}: {
  children: ReactNode;
  onActivate: () => void;
  label: string;
  tilt?: string;
  zoom?: number;
  disabled?: boolean;
  onMagnifyChange?: (magnified: boolean) => void;
}) {
  const canHover = useCanHover();
  const reduceMotion = usePrefersReducedMotion();
  const [hovered, setHovered] = useState(false);

  const magnified = canHover && hovered && !reduceMotion && !disabled;

  useEffect(() => {
    onMagnifyChange?.(magnified);
  }, [magnified, onMagnifyChange]);

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={onActivate}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      style={
        magnified ? { transform: `scale(${zoom}) rotate(0deg)` } : undefined
      }
      className={`relative block w-full transition-transform duration-500 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-deep focus-visible:ring-offset-4 focus-visible:ring-offset-champagne-soft ${
        disabled ? "cursor-default" : "cursor-zoom-in"
      } ${magnified ? "drop-shadow-2xl" : ""} ${magnified ? "" : tilt}`}
    >
      {children}
    </button>
  );
}
