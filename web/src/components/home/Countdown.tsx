import { useEffect, useState } from "react";

type Remaining = { days: number; hours: number; minutes: number; seconds: number };

function getRemaining(target: Date): Remaining {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor(totalSeconds / 3600) % 24,
    minutes: Math.floor(totalSeconds / 60) % 60,
    seconds: totalSeconds % 60,
  };
}

type CountdownProps = {
  /** Moment to count down to. */
  target: Date;
  /** Colour of the big numbers / labels. Defaults to white for the Hero. */
  className?: string;
};

/**
 * Days / Hours / Minutes countdown. Recomputes every 15s so the minute value
 * stays accurate without a per-second re-render.
 */
export default function Countdown({ target, className = "" }: CountdownProps) {
  const [remaining, setRemaining] = useState(() => getRemaining(target));

  useEffect(() => {
    // Initial value comes from the useState initializer; the interval keeps it
    // ticking once per second so the seconds value stays live.
    const id = window.setInterval(
      () => setRemaining(getRemaining(target)),
      1000,
    );
    return () => window.clearInterval(id);
  }, [target]);
  const units: Array<{ value: number; label: string }> = [
    { value: remaining.days, label: "Days" },
    { value: remaining.hours, label: "Hours" },
    { value: remaining.minutes, label: "Minutes" },
    { value: remaining.seconds, label: "Seconds" },
  ];

  return (
    <div
      className={`flex items-start justify-center gap-8 sm:gap-12 ${className}`}
      role="timer"
      aria-label="Countdown to the wedding"
    >
      {units.map((u) => (
        <div key={u.label} className="flex flex-col items-center">
          <span className="font-serif text-4xl sm:text-5xl md:text-6xl leading-none tabular-nums">
            {u.value}
          </span>
          <span className="mt-2 text-xs sm:text-sm uppercase font-semibold tracking-[0.3em] text-sage">
            {u.label}
          </span>
        </div>
      ))}
    </div>
  );
}
