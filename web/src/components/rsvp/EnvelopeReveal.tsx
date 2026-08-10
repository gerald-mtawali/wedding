import { useCallback, useEffect, useRef, useState } from "react";
import InvitationCard from "./InvitationCard";
import Polaroid from "./Polaroid";
import Lightbox from "./Lightbox";
import Magnifiable from "./Magnifiable";
import WaxSeal from "./WaxSeal";
import Sprig from "./Sprig";
import { usePrefersReducedMotion } from "../../lib/hooks";

/**
 * The RSVP page's opening moment: a sealed envelope that opens to let the
 * invitation and a polaroid rise out of it — and then stays put underneath
 * them, so the finished state reads as a flat-lay of an opened envelope with
 * its contents resting on top.
 *
 * ---------------------------------------------------------------------------
 * How the scene is built
 * ---------------------------------------------------------------------------
 * Everything lives in one fixed-aspect "scene" box positioned in percentages
 * of the scene's *width*, so the whole composition scales as a unit from phone
 * to desktop with no breakpoint juggling.
 *
 * The scene is anchored to the bottom of a viewport whose height animates from
 * "just the envelope" to "the full collage" (via `padding-bottom`, which is a
 * percentage of width and therefore animatable — `height: auto` is not). The
 * envelope sits at the bottom and never moves; the growing viewport simply
 * uncovers the space above it that the card rises into.
 *
 * Stacking is fixed, never reordered mid-flight, which is what keeps the
 * illusion stable:
 *
 *      back panel  <  open flap  <  CARD  <  front pocket  <  POLAROID
 *
 * The card sitting *under* the front pocket is the whole trick: its bottom
 * edge is tucked into the pocket's V, so it genuinely looks like it's emerging
 * from inside. The polaroid sits above the pocket instead, resting on the
 * envelope the way a loose photo would.
 *
 * The one exception is the flap, which must be in front while closed (it holds
 * the seal) and behind once open. That swap happens at the midpoint of its
 * rotation — the instant it's edge-on and has no visible area — so it can't be
 * seen.
 */

type Phase = "sealed" | "opening" | "open";

/** Milliseconds from the click to each stage of the sequence. */
const TIMINGS = {
  flapStart: 260,
  flapDuration: 900,
  /** Midway through the rotation, when the flap is edge-on. */
  flapFlip: 260 + 450,
  rise: 700,
  done: 1750,
};

/**
 * The composition. Every number is in the same unit — percent of the scene's
 * *width* — so the layout can be reasoned about as a single flat drawing.
 *
 * Scene height is `SCENE.height` of that same unit (i.e. the scene is 1.08×
 * as tall as it is wide).
 */
const SCENE = {
  height: 108,
  /** Height of the scene while the envelope is still sealed. */
  sealedHeight: 50,
  envelope: { left: 2, bottom: 2, width: 70 },
  card: { left: 13, bottom: 23, width: 58 },
  polaroid: { right: 1, bottom: 5, width: 33 },
  sprigLeft: { bottom: 38, width: 26 },
  sprigRight: { bottom: 2, width: 24 },
};

/** Height of the envelope box, in scene-width units (it's 3:2). */
const ENVELOPE_HEIGHT = SCENE.envelope.width * (2 / 3);

/**
 * CSS `bottom` percentages resolve against the parent's *height*, but the
 * numbers above are all in width units — so they have to be rescaled by the
 * scene's aspect ratio on the way out. Without this every vertical position
 * would sit 8% too high.
 */
const fromBottom = (widthUnits: number) =>
  `${(widthUnits / SCENE.height) * 100}%`;

export default function EnvelopeReveal({
  onOpened,
}: {
  onOpened?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("sealed");
  const [flapBehind, setFlapBehind] = useState(false);
  const [cardLifted, setCardLifted] = useState(false);
  const [zoomed, setZoomed] = useState<"card" | "photo" | null>(null);
  const timers = useRef<number[]>([]);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const open = useCallback(() => {
    if (phase !== "sealed") return;

    if (reduceMotion) {
      setFlapBehind(true);
      setPhase("open");
      onOpened?.();
      return;
    }

    setPhase("opening");
    timers.current.push(
      window.setTimeout(() => setFlapBehind(true), TIMINGS.flapFlip),
      window.setTimeout(() => {
        setPhase("open");
        onOpened?.();
      }, TIMINGS.done),
    );
  }, [phase, reduceMotion, onOpened]);

  const sealed = phase === "sealed";
  const opened = phase !== "sealed";

  return (
    <div className="mx-auto w-full max-w-[620px]">
      {/* Viewport: grows from "envelope only" to the full collage. Clipped
          while it grows so nothing spills over the heading, then released so
          a magnified card isn't cut off. */}
      <div
        className={`relative w-full transition-[padding-bottom] duration-[1000ms] ease-in-out ${
          phase === "open" ? "overflow-visible" : "overflow-hidden"
        }`}
        style={{
          paddingBottom: `${opened ? SCENE.height : SCENE.sealedHeight}%`,
          transitionDelay: opened ? `${TIMINGS.rise}ms` : "0ms",
        }}
      >
        {/* The scene itself — fixed aspect, pinned to the bottom. */}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{ paddingBottom: `${SCENE.height}%` }}
        >
          {/* ---------------------------------------------------------------
              Sprigs — flat-lay dressing, faded back once the card is out so
              they don't compete with it.
              --------------------------------------------------------------- */}
          <Sprig
            className={`pointer-events-none absolute -left-[6%] -rotate-[14deg] text-brown-dark/30 transition-opacity duration-700 ${
              opened ? "opacity-40" : "opacity-100"
            }`}
            style={{
              bottom: fromBottom(SCENE.sprigLeft.bottom),
              width: `${SCENE.sprigLeft.width}%`,
            }}
          />
          <Sprig
            className={`pointer-events-none absolute -right-[4%] -scale-x-100 rotate-[10deg] text-brown-dark/30 transition-opacity duration-700 ${
              opened ? "opacity-30" : "opacity-100"
            }`}
            style={{
              bottom: fromBottom(SCENE.sprigRight.bottom),
              width: `${SCENE.sprigRight.width}%`,
            }}
          />

          {/* ---------------------------------------------------------------
              Envelope — stays on the page for good.
              --------------------------------------------------------------- */}
          <div
            className={`absolute ${sealed ? "animate-envelope-float" : ""}`}
            style={{
              left: `${SCENE.envelope.left}%`,
              bottom: fromBottom(SCENE.envelope.bottom),
              width: `${SCENE.envelope.width}%`,
              perspective: "1600px",
            }}
          >
            <div className="relative aspect-[3/2] w-full">
              {/* Back panel */}
              <div className="absolute inset-0 z-0 rounded-[3px] bg-sage-deep shadow-2xl shadow-black/30" />

              {/* Inside of the envelope, revealed once the flap lifts. */}
              <div
                className={`absolute inset-[3%] bottom-[40%] z-[1] rounded-sm bg-champagne-soft/95 transition-opacity duration-500 ${
                  opened ? "opacity-100" : "opacity-0"
                }`}
                style={{ transitionDelay: `${TIMINGS.flapStart + 200}ms` }}
              />

              {/* Paper grain */}
              <div
                aria-hidden
                className="absolute inset-0 z-0 rounded-[3px] opacity-[0.18] mix-blend-overlay"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(45deg, rgba(255,255,255,.25) 0 1px, transparent 1px 3px), repeating-linear-gradient(-45deg, rgba(0,0,0,.2) 0 1px, transparent 1px 3px)",
                }}
              />

              {/* Top flap. In front while closed; behind from the midpoint of
                  its rotation, when it's edge-on and invisible. Its colour
                  changes at the same moment, so once open you're looking at
                  the paler paper of the flap's underside. */}
              <div
                className={`absolute inset-x-0 top-0 h-[62%] origin-top transition-transform duration-[900ms] ease-in-out ${
                  flapBehind ? "z-[2]" : "z-30"
                }`}
                style={{
                  transform: opened ? "rotateX(-168deg)" : "rotateX(0deg)",
                  transitionDelay: opened ? `${TIMINGS.flapStart}ms` : "0ms",
                  clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                  background: flapBehind
                    ? "linear-gradient(0deg, #9aa987 0%, #8b9c74 60%, #7e8f66 100%)"
                    : "linear-gradient(180deg, #86976f 0%, #7e8f66 55%, #6f8059 100%)",
                  boxShadow: flapBehind
                    ? "0 -6px 16px -8px rgba(0,0,0,.45)"
                    : "0 6px 14px -6px rgba(0,0,0,.5)",
                }}
              />

              {/* ---------------------------------------------------------
                  The invitation. Sits BELOW the front pocket (z-10) so its
                  bottom edge stays tucked in the envelope's mouth.
                  --------------------------------------------------------- */}
              <div
                className={`absolute transition-all duration-[1100ms] ease-out ${
                  // Normally tucked under the pocket; lifted clear of it while
                  // magnified so the whole card can be read.
                  cardLifted ? "z-20" : "z-[5]"
                }`}
                style={{
                  // The card is placed in scene coordinates, but it lives
                  // inside the envelope box (so it inherits the envelope's
                  // stacking order and stays tucked under the pocket) — so
                  // rebase its position onto the envelope's own dimensions.
                  left: `${((SCENE.card.left - SCENE.envelope.left) / SCENE.envelope.width) * 100}%`,
                  bottom: `${((SCENE.card.bottom - SCENE.envelope.bottom) / ENVELOPE_HEIGHT) * 100}%`,
                  width: `${(SCENE.card.width / SCENE.envelope.width) * 100}%`,
                  transform: sealed
                    ? "translateY(58%) scale(.92)"
                    : "translateY(0) scale(1)",
                  opacity: sealed ? 0 : 1,
                  transitionDelay: sealed ? "0ms" : `${TIMINGS.rise}ms`,
                }}
              >
                <Magnifiable
                  label="Enlarge the invitation"
                  tilt="-rotate-[1.5deg]"
                  zoom={1.14}
                  disabled={sealed}
                  onMagnifyChange={setCardLifted}
                  onActivate={() => setZoomed("card")}
                >
                  <InvitationCard />
                </Magnifiable>
              </div>

              {/* Front pocket. The clip-path cuts the V-shaped mouth; its two
                  diagonals are the envelope's side seams. */}
              <div
                className="absolute inset-0 z-10 rounded-[3px] bg-sage shadow-[inset_0_1px_0_rgba(255,255,255,.18)]"
                style={{
                  clipPath: "polygon(0 0, 50% 44%, 100% 0, 100% 100%, 0 100%)",
                }}
              />
              <div
                aria-hidden
                className="absolute inset-0 z-10 rounded-[3px] opacity-40"
                style={{
                  clipPath: "polygon(0 0, 50% 44%, 100% 0, 100% 100%, 0 100%)",
                  background:
                    "linear-gradient(150deg, rgba(0,0,0,.22) 0%, transparent 42%), linear-gradient(210deg, rgba(0,0,0,.22) 0%, transparent 42%), linear-gradient(0deg, rgba(0,0,0,.16), transparent 55%)",
                }}
              />

              {/* Wax seal, at the tip of the closed flap. */}
              <div className="absolute left-1/2 top-[62%] z-40 -translate-x-1/2 -translate-y-1/2">
                <WaxSeal onClick={open} broken={opened} />
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------------------
              The polaroid — above the pocket, resting on the envelope.
              --------------------------------------------------------------- */}
          <div
            className="absolute z-40 transition-all duration-[1100ms] ease-out"
            style={{
              right: `${SCENE.polaroid.right}%`,
              bottom: fromBottom(SCENE.polaroid.bottom),
              width: `${SCENE.polaroid.width}%`,
              transform: sealed
                ? "translateY(40%) translateX(-30%) scale(.85)"
                : "translateY(0) translateX(0) scale(1)",
              opacity: sealed ? 0 : 1,
              transitionDelay: sealed ? "0ms" : `${TIMINGS.rise + 260}ms`,
            }}
          >
            <Magnifiable
              label="Enlarge the photo"
              tilt="rotate-[5deg]"
              zoom={1.35}
              disabled={sealed}
              onActivate={() => setZoomed("photo")}
            >
              <Polaroid />
            </Magnifiable>
          </div>
        </div>
      </div>

      <Lightbox open={zoomed !== null} onClose={() => setZoomed(null)}>
        {zoomed === "card" ? <InvitationCard /> : <Polaroid />}
      </Lightbox>
    </div>
  );
}
