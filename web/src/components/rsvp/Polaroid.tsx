import { getInvitationPhoto } from "../../lib/invitationPhoto";

/**
 * The photo tucked in with the invitation, styled as a polaroid to echo the
 * postcards in "Our Story".
 *
 * The frame is sized in `cqw` (percentages of its own width) rather than fixed
 * pixels, so its proportions and caption hold up whether it's a 110px corner
 * detail in the RSVP scene or full-screen in the lightbox. With fixed padding
 * the border would swallow the image at small sizes and the aspect ratio would
 * drift, which then throws off the scene layout that depends on it.
 *
 * Note the extra wrapper: an element establishes a query container for its
 * *descendants*, not for itself, so the padding has to live one level inside
 * the element carrying `container-type`.
 *
 * The image comes from R2 in production (VITE_INVITATION_PHOTO / the
 * `INVITATION_PHOTO` object) and falls back to a local asset in dev. If
 * neither is present the frame still renders, so the layout never collapses.
 */
export default function Polaroid({ caption }: { caption?: string }) {
  const src = getInvitationPhoto();

  return (
    <div className="w-full [container-type:inline-size]">
      <figure className="relative bg-white p-[4cqw] pb-[18cqw] shadow-2xl shadow-black/25 ring-1 ring-black/5">
        {src ? (
          <img
            src={src}
            alt="Gerald and Donella"
            draggable={false}
            className="aspect-square w-full object-cover"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center bg-beige/30 text-[3cqw] uppercase tracking-[0.25em] text-brown/50">
            Photo
          </div>
        )}
        <figcaption className="absolute inset-x-0 bottom-[4cqw] text-center font-script text-[11cqw] leading-none text-ink/70">
          {caption ?? "the two of us"}
        </figcaption>
      </figure>
    </div>
  );
}
