/**
 * Smoke test for POST /api/rsvp, against a running `wrangler dev`.
 *
 *   npm run db:reset && npm run dev      # terminal 1
 *   npm run smoke                        # terminal 2
 *
 * Safe to run repeatedly. It writes real rows, so the "first ever reply"
 * assertion only runs when the guest actually has no reply yet; everything
 * after that works the same on a fresh database and on the fifth run.
 */
const BASE = process.env.BASE ?? "http://127.0.0.1:8787";

let failures = 0;
const report = (ok, name, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${name}${detail ? "  ::  " + detail : ""}`);
};

async function get(path) {
  const res = await fetch(BASE + path);
  const text = await res.text();
  return { status: res.status, body: JSON.parse(text || "null"), text };
}
async function post(payload) {
  const res = await fetch(BASE + "/api/rsvp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  return { status: res.status, body: JSON.parse(text || "null"), text };
}
async function idOf(name) {
  const r = await get(`/api/rsvp/search?q=${encodeURIComponent(name)}`);
  return r.body?.guests?.[0]?.publicId;
}

/** phone is write-only. It must not come back on ANY shape of reply. */
function noPhone(label, obj, raw) {
  report(!("phone" in (obj ?? {})), `${label}: no phone key`);
  report(!raw.includes("+265"), `${label}: no phone value`);
}

async function main() {
  console.log(`\n--- POST ${BASE}/api/rsvp ---\n`);

  const rachel = await idOf("Rachel Mwale");   // allow_plus_one = 0
  const tester = await idOf("Test Guest");     // allow_plus_one = 1
  report(/^[0-9a-f]{16}$/.test(rachel ?? "") && /^[0-9a-f]{16}$/.test(tester ?? ""), "test guests resolve");
  if (!rachel || !tester) process.exit(1);

  // ------------------------------------------------------- rejected payloads
  const bad = [
    [{}, "invalid_payload", "empty body"],
    [{ publicId: 7, attending: true }, "invalid_payload", "a numeric id where a public id belongs"],
    [{ publicId: rachel }, "invalid_payload", "no attending"],
    [{ publicId: rachel, attending: "yes" }, "invalid_payload", "attending as a string"],
    [{ publicId: "ffffffffffffffff", attending: true }, "unknown_guest", "guest that does not exist"],
    [{ publicId: rachel, attending: true, dietary: "kosher" }, "invalid_dietary", "meal outside the five"],
    [{ publicId: rachel, attending: true, plusOneDietary: "carnivore" }, "invalid_dietary", "plus-one meal outside the five"],
    [{ publicId: rachel, attending: true, plusOneName: "Someone" }, "plus_one_not_allowed", "plus-one for a guest not allowed one"],
  ];
  for (const [payload, code, label] of bad) {
    const r = await post(payload);
    report(
      r.body?.ok === false && r.body?.error === code,
      `rejects ${label} -> ${code}`,
      `${r.status} ${r.body?.error}`,
    );
  }

  // ---------------------------------------------------------- the lifecycle
  const before = await get(`/api/rsvp/guest/${rachel}`);
  const fresh = before.body?.hasResponded === false;

  if (fresh) {
    const r = await post({
      publicId: rachel, attending: true, dietary: "vegetarian",
      phone: "+265 888 111 222", message: "Wouldn't miss it.",
      typedName: "Rachel Mwale",
    });
    report(r.body?.ok === true && r.body?.amended === false, "first reply is accepted", `${r.status}`);
    report(r.body?.response?.dietary === "vegetarian", "the meal choice is stored");
    report(r.body?.guest?.householdLabel === "Mr. & Mrs. Mwale", "the reply names the household");
    noPhone("submit response", r.body?.response, r.text);
  } else {
    console.log("  --  (already replied; skipping the first-reply case)");
  }

  // A second submit without `amend` must be refused, whatever else is true.
  {
    const r = await post({ publicId: rachel, attending: true });
    report(r.status === 409 && r.body?.error === "already_responded", "a repeat submit is refused", `${r.status}`);
    report(!!r.body?.existing, "the refusal carries the existing reply");
    noPhone("409 existing", r.body?.existing, r.text);
  }

  // With `amend`, it goes through and reports itself as an amendment.
  {
    const r = await post({
      publicId: rachel, attending: true, dietary: "vegan",
      dietaryNotes: "No dairy", phone: "+265 888 999 000",
      message: "Changed my mind about the meal.", amend: true,
      typedName: "Rachel Mwale",
    });
    report(r.body?.ok === true && r.body?.amended === true, "an amendment is accepted", `${r.status}`);
    report(r.body?.response?.dietary === "vegan", "the amended meal replaces the old one");
    report(r.body?.response?.dietaryNotes === "No dairy", "dietary notes are stored");
    noPhone("amend response", r.body?.response, r.text);

    const after = await get(`/api/rsvp/guest/${rachel}`);
    report(after.body?.response?.dietary === "vegan", "the change is visible on re-read");
    report(after.body?.hasResponded === true, "the guest now reads as responded");
    noPhone("detail after amend", after.body?.response, after.text);
  }

  // ------------------------------------------------------------- plus-one
  {
    const r = await post({
      publicId: tester, attending: true, dietary: "none",
      plusOneName: "Ada Nkhoma", plusOneDietary: "halaal",
      amend: true, typedName: "Test Guest",
    });
    report(r.body?.ok === true, "a permitted plus-one is accepted", `${r.status}`);
    report(r.body?.response?.plusOneName === "Ada Nkhoma", "the plus-one's name is stored");
    report(r.body?.response?.plusOneDietary === "halaal", "the plus-one's meal is stored");
  }

  // Declining drops the plus-one and the meal, but keeps the note.
  {
    const r = await post({
      publicId: tester, attending: false, dietary: "vegan",
      plusOneName: "Ada Nkhoma", plusOneDietary: "halaal",
      message: "So sorry.", amend: true,
    });
    report(r.body?.ok === true && r.body?.response?.attending === false, "a decline is accepted");
    report(r.body?.response?.plusOneName === null, "declining drops the plus-one");
    report(r.body?.response?.plusOneDietary === null, "declining drops the plus-one's meal");
    report(r.body?.response?.dietary === null, "declining drops the meal choice");
    report(r.body?.response?.message === "So sorry.", "declining keeps the note");
  }

  // ---------------------------------------------- the phone-preservation rule
  //
  // The form can never prefill a phone number, so an amending guest always
  // submits a blank field. That must not erase the number they gave earlier.
  {
    await post({ publicId: rachel, attending: true, dietary: "none", phone: "+265 777 123 456", amend: true });
    const withPhone = await get(`/api/rsvp/guest/${rachel}`);
    report(withPhone.body?.response?.hasPhone === true, "a stored number is reported as present");

    // Amend with `phone` absent — exactly what the form sends.
    await post({ publicId: rachel, attending: true, dietary: "vegan", amend: true });
    const after = await get(`/api/rsvp/guest/${rachel}`);
    report(after.body?.response?.hasPhone === true, "an omitted phone leaves the stored number alone");
    report(after.body?.response?.dietary === "vegan", "...while the rest of the amendment applies");
    noPhone("detail after omitted-phone amend", after.body?.response, after.text);

    // An explicit empty string is the only way to clear it.
    await post({ publicId: rachel, attending: true, dietary: "vegan", phone: "", amend: true });
    const cleared = await get(`/api/rsvp/guest/${rachel}`);
    report(cleared.body?.response?.hasPhone === false, "an explicit empty string clears it");

    // Put it back so re-runs start from the same place.
    await post({ publicId: rachel, attending: true, dietary: "vegan", phone: "+265 777 123 456", amend: true });
  }

  console.log(
    failures === 0 ? `\nAll checks passed.\n`
      : `\n${failures} check${failures === 1 ? "" : "s"} FAILED.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("\nSmoke run could not complete:", e.message, "\n");
  process.exit(1);
});
