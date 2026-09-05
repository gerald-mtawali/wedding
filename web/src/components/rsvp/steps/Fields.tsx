import type { ReactNode } from "react";
import { labelClass } from "./styles";

/** The form furniture shared by all four steps. */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
      {hint ? (
        <span className="mt-1.5 block font-body text-xs leading-relaxed text-ink/55">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success";
  children: ReactNode;
}) {
  const tones = {
    info: "border-sage/60 bg-sage/10 text-ink/80",
    error: "border-[#b4553f]/40 bg-[#b4553f]/10 text-[#7d3625]",
    success: "border-sage-deep/40 bg-sage/15 text-ink/85",
  };
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`border-l-2 px-4 py-3 font-body text-sm leading-relaxed ${tones[tone]}`}
    >
      {children}
    </p>
  );
}

/** The modal's heading, so every step is titled the same way. */
export function StepHeader({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <header className="text-center">
      <p className="mb-2 font-serif text-[0.6rem] uppercase tracking-[0.3em] text-brown/80">
        {eyebrow}
      </p>
      <h2 id="rsvp-title" className="font-script text-5xl leading-tight text-ink">
        {title}
      </h2>
    </header>
  );
}
