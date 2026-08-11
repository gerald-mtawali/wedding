/**
 * The sage oval carrying the note to guests, laid over the opened envelope.
 *
 * Built in markup rather than as an image so the wording stays real text —
 * selectable, translatable, and readable by a screen reader. That matters
 * more here than elsewhere on the page: this is the one panel that asks
 * something of the reader, so it can't be allowed to become a picture of
 * words the way the invitation artwork necessarily is.
 *
 * Type is sized in `cqw` (percentages of the oval's own width) so it holds its
 * proportions from a ~230px badge in the scene up to full-screen. Note the
 * extra wrapper: an element establishes a query container for its
 * *descendants*, not itself, so the ellipse has to sit one level inside the
 * element carrying `container-type`.
 */

/** The oval's fill — matches the printed collateral. */
const NOTE_GREEN = "#597161";

/** Gold hairline at the very edge, as on the design. */
const NOTE_EDGE = "#c9ac74";

export default function GuestNote() {
  return (
    <div className="w-full [container-type:inline-size]">
      <div
        className="relative flex h-full w-full items-center justify-center rounded-[50%] px-[13cqw] py-[10cqw] text-center shadow-[0_12px_28px_-6px_rgba(0,0,0,0.45)]"
        style={{
          aspectRatio: "272 / 372",
          backgroundColor: NOTE_GREEN,
          border: `0.6cqw solid ${NOTE_EDGE}`,
        }}
      >
        {/* Inner white keyline, inset from the gold edge. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-[4.5cqw] rounded-[50%] border-[0.5cqw] border-white/85"
        />

        <div className="relative">
          <p className="font-italiana text-[6cqw] leading-tight tracking-[0.06em] text-white">
            Important Info for Our Guests
          </p>

          <span
            aria-hidden
            className="mx-auto my-[5cqw] block h-px w-[26cqw] bg-white/40"
          />

          <p className="font-italiana text-[6.2cqw] leading-[1.55] tracking-[0.02em] text-white">
            This wedding is strictly invite only. Please do not reshare or
            repost this invite. Kindly no children. Thank you for respecting
            our wishes.
          </p>
        </div>
      </div>
    </div>
  );
}
