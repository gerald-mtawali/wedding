/**
 * Tests for the form's draft logic.
 *
 *   node --test web/src/components/rsvp/steps/draft.test.ts
 *   cd api && npm test
 *
 * Runs without a bundler because draft.ts imports only *types* from
 * `@shared/types` — type stripping erases the import before Node ever tries to
 * resolve the alias. Add a value import there and this file stops running,
 * which is a reasonable trade for keeping the rules covered.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bringingGuest,
  draftFrom,
  emptyDraft,
  toSubmission,
  validate,
  type RsvpDraft,
} from "./draft.ts";

const attendingDraft: RsvpDraft = {
  ...emptyDraft,
  attending: true,
  dietary: "vegan",
  phone: "+265 991 000 111",
};

// ---------------------------------------------------------------------------
// validate
// ---------------------------------------------------------------------------

test("a reply with no answer cannot be sent", () => {
  assert.match(validate(emptyDraft, false) ?? "", /join us/i);
});

test("an attending guest must choose a meal", () => {
  assert.match(
    validate({ ...emptyDraft, attending: true }, false) ?? "",
    /meal/i,
  );
  assert.equal(validate(attendingDraft, false), null);
});

test("a phone number is never required", () => {
  // Useful to have, not worth losing a reply over. An RSVP with no number
  // beats no RSVP, so this must stay valid however the rest of the form looks.
  const noPhone = { ...attendingDraft, phone: "" };
  assert.equal(validate(noPhone, false), null);
  assert.equal(validate({ ...noPhone, attending: false }, false), null);
  assert.equal(
    validate({ ...noPhone, bringingPlusOne: true, plusOneName: "Ada", plusOneDietary: "halaal" }, true),
    null,
  );
  // ...and an omitted number must not become an empty string on the wire.
  assert.equal(toSubmission(noPhone, "a1b2c3d4e5f60718", false, "", false).phone, undefined);
});

test("a declining guest is asked for nothing else", () => {
  // No meal, no number, no plus-one — none of it applies to someone who
  // cannot come, and demanding it would be asking questions for no reason.
  assert.equal(validate({ ...emptyDraft, attending: false }, true), null);
});

test("a plus-one needs both a name and a meal", () => {
  const wanting = { ...attendingDraft, bringingPlusOne: true };
  assert.match(validate(wanting, true) ?? "", /guest's name/i);

  const named = { ...wanting, plusOneName: "Ada Nkhoma" };
  assert.match(validate(named, true) ?? "", /meal preference for your guest/i);

  assert.equal(validate({ ...named, plusOneDietary: "halaal" }, true), null);
});

test("a guest not offered a plus-one is not blocked by a stale checkbox", () => {
  // The checkbox can only have been ticked before we knew who they were.
  // It must not become a validation error they cannot clear.
  const stale = { ...attendingDraft, bringingPlusOne: true };
  assert.equal(validate(stale, false), null);
  assert.equal(bringingGuest(stale, false), false);
});

// ---------------------------------------------------------------------------
// toSubmission
// ---------------------------------------------------------------------------

test("declining drops the meal and the plus-one", () => {
  const s = toSubmission(
    { ...attendingDraft, attending: false, bringingPlusOne: true, plusOneName: "Ada", plusOneDietary: "halaal", message: "Sorry!" },
    7, true, "Rachel Mwale", false,
  );
  assert.equal(s.attending, false);
  assert.equal(s.dietary, undefined);
  assert.equal(s.plusOneName, undefined);
  assert.equal(s.plusOneDietary, undefined);
  assert.equal(s.message, "Sorry!");   // the note still goes
  assert.equal(s.phone, "+265 991 000 111");
});

test("a plus-one the guest was never offered never reaches the API", () => {
  const s = toSubmission(
    { ...attendingDraft, bringingPlusOne: true, plusOneName: "Ada", plusOneDietary: "halaal" },
    7, false, "", false,
  );
  assert.equal(s.plusOneName, undefined);
  assert.equal(s.plusOneDietary, undefined);
});

test("empty text fields are omitted rather than sent as empty strings", () => {
  const s = toSubmission({ ...attendingDraft, message: "   ", dietaryNotes: "" }, "a1b2c3d4e5f60718", false, "", false);
  assert.equal(s.message, undefined);
  assert.equal(s.dietaryNotes, undefined);
  assert.equal(s.typedName, undefined);
});

test("amend and typedName are carried through", () => {
  const s = toSubmission(attendingDraft, "a1b2c3d4e5f60718", false, "Rachel Mwale", true);
  assert.equal(s.amend, true);
  assert.equal(s.typedName, "Rachel Mwale");
  assert.equal(s.publicId, "a1b2c3d4e5f60718");
});

// ---------------------------------------------------------------------------
// draftFrom
// ---------------------------------------------------------------------------

const guest = {
  publicId: "a1b2c3d4e5f60718", firstName: "Chisomo", middleName: null, lastName: "Phiri",
  householdLabel: "Ms. Chisomo Phiri", allowPlusOne: true, hasResponded: true,
};

test("a blank phone field is OMITTED, which the API reads as 'leave it alone'", () => {
  // This is load-bearing. The form cannot prefill the number (the API never
  // returns it), so an amending guest always submits a blank field. If that
  // reached the API as an empty string it would clear a number they never
  // meant to touch — which it did, until it was caught.
  const s = toSubmission({ ...attendingDraft, phone: "   " }, "a1b2c3d4e5f60718", false, "", true);
  assert.equal(s.phone, undefined);
  assert.ok(!("phone" in s) || s.phone === undefined);
});

test("a guest with no reply starts from a blank form", () => {
  assert.deepEqual(draftFrom({ ...guest, hasResponded: false, response: null }), emptyDraft);
});

test("an existing reply prefills the form", () => {
  const d = draftFrom({
    ...guest,
    response: {
      attending: true, hasPhone: true, dietary: "pescatarian", dietaryNotes: "No shellfish",
      plusOneName: "Yamikani Nkhoma", plusOneDietary: "halaal",
      message: "See you there", updatedAt: "2026-09-01 10:00:00",
    },
  });
  assert.equal(d.attending, true);
  assert.equal(d.dietary, "pescatarian");
  assert.equal(d.bringingPlusOne, true);
  assert.equal(d.plusOneName, "Yamikani Nkhoma");
  assert.equal(d.message, "See you there");
});

test("the phone number is never prefilled, even when one is on record", () => {
  // The API does not return it, by design. If this ever starts passing with a
  // value, something upstream has begun handing contact details back out.
  const d = draftFrom({
    ...guest,
    response: {
      attending: true, hasPhone: true, dietary: "none", dietaryNotes: null,
      plusOneName: null, plusOneDietary: null, message: null,
      updatedAt: "2026-09-01 10:00:00",
    },
  });
  assert.equal(d.phone, "");
});
