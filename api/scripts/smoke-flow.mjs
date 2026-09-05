/**
 * End-to-end replay of a guest's journey, against a running `wrangler dev`.
 *
 *   npm run db:reset && npm run dev      # terminal 1
 *   npm run smoke                        # terminal 2
 *
 * This drives the SAME conversion logic the browser uses — it imports
 * `draft.ts` straight out of web/src rather than reimplementing it — so it
 * catches the failure the other two smoke scripts cannot: the client and the
 * API agreeing on shapes in TypeScript but disagreeing in practice. Node's
 * type stripping runs that file directly because its only import from
 * `@shared/types` is type-only.
 *
 * Safe to re-run: every write goes through `amend`.
 */
import {
  draftFrom,
  toSubmission,
  validate,
} from "../../web/src/components/rsvp/steps/draft.ts";

const BASE = process.env.BASE ?? "http://127.0.0.1:8787";
let failures = 0;
const report = (ok, name, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${name}${detail ? "  ::  " + detail : ""}`);
};

const json = async (path, init) => {
  const res = await fetch(BASE + path, init);
  const text = await res.text();
  return { status: res.status, body: JSON.parse(text || "null"), text };
};
const post = (payload) =>
  json("/api/rsvp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

async function main() {
  console.log(`\n--- guest journey, ${BASE} ---\n`);

  // 1. The guest types a name.
  const typed = "Test Guest";
  const search = await json(`/api/rsvp/search?q=${encodeURIComponent(typed)}`);
  report(search.body?.kind === "match", "step 1: the name resolves", search.body?.kind);
  const match = search.body?.guests?.[0];
  if (!match) process.exit(1);

  // 2. They confirm it, and we fetch the full record.
  const detail = await json(`/api/rsvp/guest/${match.publicId}`);
  report(detail.status === 200, "step 2: the confirmed guest loads");
  const guest = detail.body;
  report(guest.allowPlusOne === true, "this guest may bring someone");

  // 3. The form opens, prefilled from whatever is on record.
  const prefilled = draftFrom(guest);
  report(prefilled.phone === "", "the form never prefills a phone number");

  // 4. They fill it in.
  const draft = {
    ...prefilled,
    attending: true,
    dietary: "pescatarian",
    dietaryNotes: "No shellfish please",
    bringingPlusOne: true,
    plusOneName: "Ada Nkhoma",
    plusOneDietary: "halaal",
    phone: "+265 888 444 555",
    message: "Thank you for having us.",
  };
  report(validate(draft, guest.allowPlusOne) === null, "step 3: the form validates");

  // 5. Review, then send. `amend` mirrors what the modal would compute.
  const amend = Boolean(guest.response);
  const sent = await post(
    toSubmission(draft, guest.publicId, guest.allowPlusOne, typed, amend),
  );
  report(sent.body?.ok === true, "step 4: the reply is accepted", `${sent.status} ${sent.body?.error ?? ""}`);
  report(sent.body?.response?.dietary === "pescatarian", "the meal is stored");
  report(sent.body?.response?.plusOneName === "Ada Nkhoma", "the plus-one is stored");
  report(sent.body?.response?.plusOneDietary === "halaal", "the plus-one's meal is stored");
  report(sent.body?.response?.message === "Thank you for having us.", "the note is stored");
  report(!("phone" in (sent.body?.response ?? {})), "the reply never echoes the phone number");

  // 6. Re-reading shows what was actually written.
  const after = await json(`/api/rsvp/guest/${guest.publicId}`);
  report(after.body?.hasResponded === true, "the guest now reads as responded");
  report(after.body?.response?.dietaryNotes === "No shellfish please", "the kitchen note survives a round trip");
  report(draftFrom(after.body).bringingPlusOne === true, "re-opening the form restores the plus-one");

  // 7. The conflict path the review screen exists to handle: submitting
  //    without `amend` when a reply is already on record must be refused,
  //    not silently applied.
  const clash = await post(
    toSubmission(draft, guest.publicId, guest.allowPlusOne, typed, false),
  );
  report(clash.status === 409 && clash.body?.error === "already_responded", "a stale submit is refused, not applied");
  report(!!clash.body?.existing, "the refusal carries what is on record");
  report(!("phone" in (clash.body?.existing ?? {})), "even the refusal hides the phone number");

  // 8. And the retry the guest makes by pressing the button again.
  const retry = await post(
    toSubmission(draft, guest.publicId, guest.allowPlusOne, typed, true),
  );
  report(retry.body?.ok === true && retry.body?.amended === true, "the deliberate replacement goes through");

  // 9. Declining drops what no longer applies.
  const declined = await post(
    toSubmission({ ...draft, attending: false }, guest.publicId, guest.allowPlusOne, typed, true),
  );
  report(declined.body?.response?.attending === false, "step 5: a decline is accepted");
  report(declined.body?.response?.plusOneName === null, "declining drops the plus-one");
  report(declined.body?.response?.dietary === null, "declining drops the meal");
  report(declined.body?.response?.message === "Thank you for having us.", "declining keeps the note");

  console.log(failures === 0 ? `\nAll checks passed.\n` : `\n${failures} FAILED.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("\nFlow run could not complete:", e.message, "\n");
  process.exit(1);
});
