import { siteConfig } from "../../../lib/siteConfig";

/**
 * "If you do not see your name, please contact …"
 *
 * Rendered at the foot of EVERY variant of the confirmation step — the single
 * match, the ambiguous list, the suggestions and the empty result alike. A
 * guest staring at two Bandas who are both the wrong one needs this as much as
 * a guest seeing nothing, and they are the people most likely to give up
 * silently otherwise.
 */
export default function HelpContacts() {
  const { contacts } = siteConfig.rsvpHelp;

  return (
    <div className="border-t border-beige/50 pt-5 text-center">
      <p className="font-body text-xs leading-relaxed text-ink/55">
        If you do not see your name, please contact{" "}
        {contacts.map((c, i) => (
          <span key={c.phone}>
            {i > 0 && (i === contacts.length - 1 ? " or " : ", ")}
            <span className="text-ink/75">{c.name}</span>{" "}
            <a
              href={`tel:${c.phone.replace(/[^+\d]/g, "")}`}
              className="whitespace-nowrap underline decoration-beige underline-offset-4 transition-colors hover:text-brown"
            >
              {c.phone}
            </a>
          </span>
        ))}
        .
      </p>
    </div>
  );
}
