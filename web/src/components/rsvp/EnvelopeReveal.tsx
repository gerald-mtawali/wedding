import { useCallback, useEffect, useRef, useState } from "react";
import InvitationCard from "./InvitationCard";
import Polaroid from "./Polaroid";
import Lightbox from "./Lightbox";
import Magnifiable from "./Magnifiable";
import WaxSeal from "./WaxSeal";
import GuestNote from "./GuestNote";
import flowersImage from "../../assets/envelope/flowers.webp";
import { siteConfig } from "../../lib/siteConfig";
import { usePrefersReducedMotion } from "../../lib/hooks";
import {
  BOTTOM_FLAP_CLIP,
  BOTTOM_FLAP_HEIGHT,
  ENVELOPE_ASPECT,
  FELT,
  FLAP_CLIP,
  FLAP_HEIGHT,
  SEAM_COLOR,
} from "./envelopeArt";

/**
 * The RSVP page's opening moment: a sealed felt envelope that opens to let the
 * invitation and a photo fan out across it as a flat-lay.
 *
 * ---------------------------------------------------------------------------
 * The envelope
 * ---------------------------------------------------------------------------
 * Built from the design export's own geometry — proportions, flap height and
 * both silhouettes come from `envelopeArt.ts` — surfaced with the felt
 * photograph from those files. Assembling it from separate panels rather than
 * dropping in the flattened SVGs is what lets the flap rotate; a pre-composed
 * "open" image could only ever be cross-faded.
 *
 * The three panels share one texture, differentiated only by lighting, which
 * is how real felt behaves: the body sits in shade, the front flap catches the
 * light, and the top flap's underside is paler still.
 *
 * ---------------------------------------------------------------------------
 * The scene
 * ---------------------------------------------------------------------------
 * Everything is positioned in percentages of the scene's *width*, so the
 * composition scales as one unit with no breakpoint juggling. The envelope is
 * horizontally centred and anchored a fixed distance from the scene's base, so
 * it never moves; the scene grows upward when opened, and while sealed its
 * margins above and below the envelope are equal, leaving the envelope centred.
 *
 * Nothing is ever clipped — `overflow` stays visible throughout, so the float
 * animation and the flap's swing past the top edge can't be cut off. The cards
 * are hidden while sealed by opacity rather than by the envelope covering
 * them, which is what allows them to sit *above* the envelope once open:
 *
 *      envelope  <  photo  <  invitation
 *
 * They fade in slightly after they start moving, so they read as coming up out
 * of the envelope's mouth rather than materialising on top of it.
 */

type Phase = "sealed" | "opening" | "open";

/** Milliseconds from the click to each stage of the sequence. */
const TIMINGS = {
  flapStart: 260,
  /** Midway through the flap's rotation, when it's edge-on and invisible. */
  flapFlip: 260 + 450,
  rise: 700,
  done: 1850,
};

/**
 * The composition. Every number is in the same unit — percent of the scene's
 * *width* — so the layout can be reasoned about as one flat drawing.
 */
const SCENE = {
  /**
   * Tall enough for the cards to sit entirely clear of the note.
   *
   * The note is what drives this. A card of this size at -32° has a vertical
   * span of ~80 units, so lifting it above a 46-unit-tall oval that's pinned
   * to the scene floor needs roughly 120 units of room. Fanning the two cards
   * outward (rather than stacking them near the centre) is what keeps it to
   * 122 instead of 130+ — the angle itself barely matters, worth only ~2
   * units between 32° and 20°.
   */
  height: 122,
  envelope: { bottom: 14.55, width: 78 },
  /**
   * Cards are placed by the centre of their *unrotated* box, so changing an
   * angle pivots them in place instead of shifting them.
   *
   * The photo's height depends on `siteConfig.invitationPhotoAspect`, so its
   * centre is set high enough that even a tall 2:3 window still clears the
   * scene's floor once rotated.
   */
  card: { cx: 34, cy: 79.1, width: 46, angle: -32 },
  photo: { cx: 70, cy: 70.5, width: 40, angle: 30 },
  /**
   * Peonies tucked behind the envelope's lower corners. One asset, mirrored
   * on the right so the two bunches don't read as copies.
   */
  flowers: { cx: 12.5, cy: 18, width: 25 },
  /**
   * The guests' note, hanging off the envelope's lower half. Its centre is
   * derived below so it sits as low as the scene floor allows.
   */
  note: { cx: 50, width: 34 },
};

/** Aspect ratios of the two new pieces, from their artwork. */
const FLOWERS_ASPECT = 328 / 320;
const NOTE_ASPECT = 272 / 372;

const NOTE_HEIGHT = SCENE.note.width / NOTE_ASPECT;
/** As low as it can go while staying inside the scene. */
const NOTE_CY = NOTE_HEIGHT / 2 + 0.3;

const ENVELOPE_HEIGHT = SCENE.envelope.width / ENVELOPE_ASPECT;

/** Parse a `"w/h"` config string into a numeric ratio. */
const ratio = (value: string) => {
  const [w, h] = value.split("/").map(Number);
  return w / h;
};

/** Card height follows from its width and the artwork's ratio. */
const CARD_HEIGHT = SCENE.card.width / ratio(siteConfig.invitationAspect);

/**
 * Polaroid frame height. Its `cqw` padding is 4 at the top and 18 at the
 * bottom, around a photo window of the configured ratio — so the frame's
 * proportions, and therefore the scene's spacing, follow from that setting.
 */
const POLAROID_HEIGHT =
  (SCENE.photo.width *
    (4 + (100 - 8) / ratio(siteConfig.invitationPhotoAspect) + 18)) /
  100;

/** Centre the envelope horizontally. */
const ENVELOPE_LEFT = (100 - SCENE.envelope.width) / 2;

/**
 * Scene height while sealed. Derived so the gap above the envelope equals the
 * gap below it — that's what leaves the envelope optically centred before it's
 * opened, and it stays correct if the envelope is resized.
 */
const SEALED_HEIGHT = SCENE.envelope.bottom * 2 + ENVELOPE_HEIGHT;

/**
 * CSS `bottom` percentages resolve against the parent's *height*, but the
 * numbers above are all in width units — so they need rescaling by the scene's
 * aspect ratio on the way out.
 */
const fromBottom = (widthUnits: number) =>
  `${(widthUnits / SCENE.height) * 100}%`;

/** Shared felt surface. Each panel shifts the crop so they don't repeat. */
const felt = (position: string, brightness: number): React.CSSProperties => ({
  backgroundImage: `url(${FELT})`,
  backgroundSize: "cover",
  backgroundPosition: position,
  filter: `brightness(${brightness})`,
});

/**
 * Places an element by the centre of its unrotated box and applies its resting
 * angle. While sealed it's nudged back toward the envelope's mouth, shrunk and
 * straightened, so opening reads as the card being drawn out and laid down.
 */
function restingTransform(angle: number, magnified: boolean) {
  return `translate(-50%, 50%) rotate(${magnified ? 0 : angle}deg)`;
}

/** A point just inside the envelope's mouth — where the cards start from. */
const MOUTH = { x: 50, y: SCENE.envelope.bottom + ENVELOPE_HEIGHT * 0.78 };

/**
 * The offset that puts a card back at the envelope's mouth, as a percentage of
 * its own box (which is what CSS `translate` percentages resolve against).
 *
 * Derived rather than hand-tuned: the cards now rest a long way above the
 * envelope, so a fixed nudge would leave them starting in mid-air instead of
 * at the mouth, and it would silently drift out of step with any future change
 * to the composition.
 */
function tuckToMouth(cx: number, cy: number, w: number, h: number) {
  return `translate(${((MOUTH.x - cx) / w) * 100}%, ${((cy - MOUTH.y) / h) * 100}%)`;
}

export default function EnvelopeReveal({
  onOpened,
}: {
  onOpened?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("sealed");
  const [flapBehind, setFlapBehind] = useState(false);
  const [cardMagnified, setCardMagnified] = useState(false);
  const [photoMagnified, setPhotoMagnified] = useState(false);
  const [zoomed, setZoomed] = useState<"card" | "photo" | "note" | null>(null);
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

  /** Shared motion for the two cards. */
  const emerge = (
    angle: number,
    tuck: string,
    magnified: boolean,
    delay: number,
  ): React.CSSProperties => ({
    transform: sealed
      ? `translate(-50%, 50%) ${tuck} rotate(0deg) scale(0.82)`
      : restingTransform(angle, magnified),
    opacity: sealed ? 0 : 1,
    // Transform runs long and slow; opacity is short and starts late, so the
    // card is already on its way out of the mouth before it becomes visible.
    transition: [
      `transform 1100ms cubic-bezier(0.22, 1, 0.36, 1) ${sealed ? 0 : delay}ms`,
      `opacity 450ms ease-out ${sealed ? 0 : delay + 180}ms`,
    ].join(", "),
  });

  return (
    <div className="mx-auto w-full max-w-[720px]">
      {/* Scene viewport. Grows upward when opened; never clips, so the float
          animation and the flap's swing can't be cut off. */}
      <div
        className="relative w-full overflow-visible transition-[padding-bottom] duration-[1100ms] ease-in-out"
        style={{
          paddingBottom: `${opened ? SCENE.height : SEALED_HEIGHT}%`,
          transitionDelay: opened ? `${TIMINGS.rise}ms` : "0ms",
        }}
      >
        <div
          className="absolute inset-x-0 bottom-0"
          style={{ paddingBottom: `${SCENE.height}%` }}
        >
          {/* =============================================================
              Peonies (z-5) — behind the envelope, revealed with the contents
              ============================================================= */}
          {[
            { key: "left", cx: SCENE.flowers.cx, mirrored: false, delay: 120 },
            {
              key: "right",
              cx: 100 - SCENE.flowers.cx,
              mirrored: true,
              delay: 260,
            },
          ].map((f) => (
            <div
              key={f.key}
              aria-hidden
              className="pointer-events-none absolute z-[5]"
              style={{
                left: `${f.cx}%`,
                bottom: fromBottom(SCENE.flowers.cy),
                width: `${SCENE.flowers.width}%`,
                aspectRatio: `${FLOWERS_ASPECT}`,
                // Settle outward from behind the envelope, so they look like
                // they were always tucked there rather than dropped in.
                transform: `translate(-50%, 50%) ${
                  sealed
                    ? `translateX(${f.mirrored ? "-14%" : "14%"}) scale(0.86)`
                    : "translateX(0) scale(1)"
                }`,
                opacity: sealed ? 0 : 1,
                transition: [
                  `transform 1000ms cubic-bezier(0.22, 1, 0.36, 1) ${sealed ? 0 : TIMINGS.rise + f.delay}ms`,
                  `opacity 700ms ease-out ${sealed ? 0 : TIMINGS.rise + f.delay}ms`,
                ].join(", "),
              }}
            >
              <img
                src={flowersImage}
                alt=""
                draggable={false}
                className={`h-full w-full object-contain drop-shadow-[0_10px_16px_rgba(0,0,0,0.3)] ${
                  f.mirrored ? "-scale-x-100" : ""
                }`}
              />
            </div>
          ))}

          {/* =============================================================
              Envelope (z-10) — centred, and never moves
              ============================================================= */}
          <div
            className={`absolute z-10 ${sealed ? "animate-envelope-float" : ""}`}
            style={{
              left: `${ENVELOPE_LEFT}%`,
              bottom: fromBottom(SCENE.envelope.bottom),
              width: `${SCENE.envelope.width}%`,
              perspective: "1800px",
            }}
          >
            <div
              className="relative w-full drop-shadow-[0_20px_30px_rgba(0,0,0,0.26)]"
              style={{ aspectRatio: `${ENVELOPE_ASPECT}` }}
            >
              {/* ---- Top flap: in front while closed, behind once open ---- */}
              <div
                className={`absolute inset-x-0 top-0 origin-top transition-transform duration-[900ms] ease-in-out ${
                  flapBehind ? "z-0" : "z-30"
                }`}
                style={{
                  height: `${FLAP_HEIGHT * 100}%`,
                  clipPath: FLAP_CLIP,
                  transform: opened ? "rotateX(-166deg)" : "rotateX(0deg)",
                  transitionDelay: opened ? `${TIMINGS.flapStart}ms` : "0ms",
                  ...felt("center top", flapBehind ? 1.14 : 1.05),
                }}
              >
                <span
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background: flapBehind
                      ? "linear-gradient(0deg, rgba(0,0,0,.16), transparent 45%)"
                      : "linear-gradient(180deg, rgba(255,255,255,.10), transparent 35%, rgba(0,0,0,.10))",
                  }}
                />
              </div>

              {/* ---- Body ---- */}
              <div
                className="absolute inset-0 z-10 rounded-[2px]"
                style={felt("center center", 0.93)}
              />
              {/* Shadow inside the mouth, once there's an opening to see into. */}
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 z-10 h-[20%] transition-opacity duration-700"
                style={{
                  opacity: opened ? 1 : 0,
                  transitionDelay: `${TIMINGS.flapStart + 300}ms`,
                  background:
                    "linear-gradient(180deg, rgba(0,0,0,.3), transparent)",
                }}
              />

              {/* ---- Bottom flap / chevron seam ---- */}
              <div
                className="absolute inset-x-0 bottom-0 z-20"
                style={{
                  height: `${BOTTOM_FLAP_HEIGHT * 100}%`,
                  clipPath: BOTTOM_FLAP_CLIP,
                  ...felt("center bottom", 1.02),
                }}
              />
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 z-20"
                style={{
                  height: `${BOTTOM_FLAP_HEIGHT * 100}%`,
                  clipPath: BOTTOM_FLAP_CLIP,
                  filter: `drop-shadow(0 -1px 0 ${SEAM_COLOR})`,
                  background:
                    "linear-gradient(0deg, rgba(0,0,0,.10), transparent 30%)",
                }}
              />

              {/* ---- Wax seal, centred on the closed flap's point ---- */}
              <div
                className="absolute z-40"
                style={{
                  left: "50%",
                  top: `${FLAP_HEIGHT * 100}%`,
                  width: "18%",
                  transform: "translate(-50%, -50%)",
                }}
              >
                <WaxSeal onClick={open} broken={opened} />
              </div>
            </div>
          </div>

          {/* =============================================================
              Photo (z-20) — above the envelope, below the invitation
              ============================================================= */}
          <div
            className="absolute z-20"
            style={{
              left: `${SCENE.photo.cx}%`,
              bottom: fromBottom(SCENE.photo.cy),
              width: `${SCENE.photo.width}%`,
              pointerEvents: sealed ? "none" : undefined,
              ...emerge(
                SCENE.photo.angle,
                tuckToMouth(
                  SCENE.photo.cx,
                  SCENE.photo.cy,
                  SCENE.photo.width,
                  POLAROID_HEIGHT,
                ),
                photoMagnified,
                TIMINGS.rise + 260,
              ),
            }}
          >
            <Magnifiable
              label="Enlarge the photo"
              zoom={1.3}
              disabled={sealed}
              onMagnifyChange={setPhotoMagnified}
              onActivate={() => setZoomed("photo")}
            >
              <Polaroid />
            </Magnifiable>
          </div>

          {/* =============================================================
              Invitation (z-30) — the topmost layer
              ============================================================= */}
          <div
            className="absolute z-30"
            style={{
              left: `${SCENE.card.cx}%`,
              bottom: fromBottom(SCENE.card.cy),
              width: `${SCENE.card.width}%`,
              pointerEvents: sealed ? "none" : undefined,
              ...emerge(
                SCENE.card.angle,
                tuckToMouth(
                  SCENE.card.cx,
                  SCENE.card.cy,
                  SCENE.card.width,
                  CARD_HEIGHT,
                ),
                cardMagnified,
                TIMINGS.rise,
              ),
            }}
          >
            <Magnifiable
              label="Enlarge the invitation"
              zoom={1.18}
              disabled={sealed}
              onMagnifyChange={setCardMagnified}
              onActivate={() => setZoomed("card")}
            >
              <InvitationCard />
            </Magnifiable>
          </div>

          {/* =============================================================
              Note to guests (z-40) — the topmost layer.

              It sits above both cards deliberately: the invitation at -32°
              sweeps its lower corner right through this part of the scene, so
              anywhere the note would be fully clear of the cards is off the
              bottom of the composition. Putting it on top matches the mockup,
              where the invitation's corner disappears behind the oval.
              ============================================================= */}
          <div
            className="absolute z-40"
            style={{
              left: `${SCENE.note.cx}%`,
              bottom: fromBottom(NOTE_CY),
              width: `${SCENE.note.width}%`,
              aspectRatio: `${NOTE_ASPECT}`,
              transform: sealed
                ? "translate(-50%, 50%) translateY(26%) scale(0.8)"
                : "translate(-50%, 50%) scale(1)",
              opacity: sealed ? 0 : 1,
              transition: [
                `transform 1000ms cubic-bezier(0.22, 1, 0.36, 1) ${sealed ? 0 : TIMINGS.rise + 420}ms`,
                `opacity 500ms ease-out ${sealed ? 0 : TIMINGS.rise + 480}ms`,
              ].join(", "),
            }}
          >
            {/* Zoomable like the cards. At the narrowest phone width this
                oval is only ~110px across, which puts its body text near 7px
                — too small to read, and this is the one panel that actually
                asks something of the guest. Tapping opens it full-screen. */}
            <Magnifiable
              label="Enlarge the note to guests"
              zoom={1.15}
              disabled={sealed}
              onActivate={() => setZoomed("note")}
            >
              <GuestNote />
            </Magnifiable>
          </div>
        </div>
      </div>

      <Lightbox open={zoomed !== null} onClose={() => setZoomed(null)}>
        {zoomed === "card" ? (
          <InvitationCard />
        ) : zoomed === "note" ? (
          <GuestNote />
        ) : (
          <Polaroid />
        )}
      </Lightbox>
    </div>
  );
}
