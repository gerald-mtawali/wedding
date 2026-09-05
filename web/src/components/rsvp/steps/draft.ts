import type { Dietary, GuestDetail, RsvpSubmission } from "@shared/types";

/**
 * The form's working state, shared by the details step and the review step.
 *
 * Deliberately NOT `RsvpSubmission`. A half-filled form has a different shape
 * from a valid submission: `dietary` is `null` while the guest hasn't chosen
 * yet, text fields are `""` rather than absent, and "bringing a guest" is a
 * checkbox that exists independently of whether a name has been typed. Keeping
 * those apart means the conversion in `toSubmission` is the single place where
 * "what the form holds" becomes "what the API accepts", instead of every field
 * being maybe-undefined everywhere.
 */
export type RsvpDraft = {
  attending: boolean | null;
  phone: string;
  dietary: Dietary | null;
  dietaryNotes: string;
  bringingPlusOne: boolean;
  plusOneName: string;
  plusOneDietary: Dietary | null;
  message: string;
};

export const emptyDraft: RsvpDraft = {
  attending: null,
  phone: "",
  dietary: null,
  dietaryNotes: "",
  bringingPlusOne: false,
  plusOneName: "",
  plusOneDietary: null,
  message: "",
};

/**
 * Start from whatever is already on record, so "update my reply" opens showing
 * the guest their previous answer rather than a blank form they have to fill
 * in again from memory.
 *
 * `phone` is always blank: the API never returns it (see shared/types.ts), so
 * an amending guest re-enters it. That is the deliberate cost of never handing
 * a contact number back to anyone who can spell a guest's name.
 */
export function draftFrom(detail: GuestDetail): RsvpDraft {
  const r = detail.response;
  if (!r) return emptyDraft;
  return {
    attending: r.attending,
    phone: "",
    dietary: r.dietary,
    dietaryNotes: r.dietaryNotes ?? "",
    bringingPlusOne: Boolean(r.plusOneName),
    plusOneName: r.plusOneName ?? "",
    plusOneDietary: r.plusOneDietary,
    message: r.message ?? "",
  };
}

/** True when the plus-one block should count — permitted, wanted, and coming. */
export function bringingGuest(
  draft: RsvpDraft,
  allowPlusOne: boolean,
): boolean {
  return draft.attending === true && allowPlusOne && draft.bringingPlusOne;
}

/**
 * The one place the form's state becomes an API payload.
 *
 * Fields the guest cannot have meant are dropped rather than sent as empty
 * strings — the Worker would reject or null them anyway, and sending a value
 * we know is meaningless makes the request harder to read in a log.
 */
export function toSubmission(
  draft: RsvpDraft,
  publicId: string,
  allowPlusOne: boolean,
  typedName: string,
  amend: boolean,
): RsvpSubmission {
  const attending = draft.attending === true;
  const withGuest = bringingGuest(draft, allowPlusOne);

  return {
    publicId,
    attending,
    phone: draft.phone.trim() || undefined,
    dietary: attending ? (draft.dietary ?? undefined) : undefined,
    dietaryNotes: attending
      ? draft.dietaryNotes.trim() || undefined
      : undefined,
    plusOneName: withGuest ? draft.plusOneName.trim() : undefined,
    plusOneDietary: withGuest ? (draft.plusOneDietary ?? undefined) : undefined,
    message: draft.message.trim() || undefined,
    typedName: typedName || undefined,
    amend,
  };
}

/** Returns the first problem with the draft, or null when it is ready to send. */
export function validate(
  draft: RsvpDraft,
  allowPlusOne: boolean,
): string | null {
  if (draft.attending === null) {
    return "Please let us know whether you can join us.";
  }
  if (draft.attending) {
    if (!draft.dietary) return "Please choose a meal preference.";
    // Phone is optional, deliberately. It is useful — it is the follow-up
    // channel for the day and a manual tiebreaker if we ever need to check who
    // actually replied — but not useful enough to risk a guest abandoning the
    // form over it. An RSVP without a number is worth more than no RSVP.
    if (bringingGuest(draft, allowPlusOne) && !draft.plusOneName.trim()) {
      return "Please tell us your guest's name.";
    }
    if (bringingGuest(draft, allowPlusOne) && !draft.plusOneDietary) {
      return "Please choose a meal preference for your guest.";
    }
  }
  return null;
}
