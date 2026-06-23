type Event = {
  date: string;
  title: string;
  description: string;
};

const events: Event[] = [
  {
    date: "July 18, 2026",
    title: "Save-the-Date Mailed",
    description: "Invitations sent — start planning your travel.",
  },
  {
    date: "August 15, 2026",
    title: "RSVP Deadline",
    description: "Please RSVP by this date so we can finalize seating.",
  },
  {
    date: "October 3, 2026",
    title: "Ceremony & Reception",
    description: "Our wedding day in Lilongwe, Malawi.",
  },
];

export default function ImportantDates() {
  return (
    <section className="bg-sage/10 border-y border-beige/40">
      <div className="max-w-5xl mx-auto px-6 py-20 md:py-24">
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-[0.35em] text-brown mb-3">
            Mark Your Calendar
          </p>
          <h2 className="font-script text-5xl md:text-7xl text-ink">
            Important Dates
          </h2>
        </div>

        <ol
          className="
            relative
            border-l border-sage/50 ml-3
            md:border-l-0 md:ml-0
          "
        >
          {/* Desktop center spine */}
          <span
            aria-hidden
            className="hidden md:block absolute left-1/2 top-2 bottom-2 w-px bg-sage/50 -translate-x-1/2"
          />

          {events.map((e, i) => {
            const dateOnLeft = i % 2 === 0;

            const dateBlock = (
              <div
                className={`hidden md:block ${
                  dateOnLeft
                    ? "md:text-right md:pr-10"
                    : "md:text-left md:pl-10"
                }`}
              >
                <p className="font-serif text-lg text-brown-dark">{e.date}</p>
              </div>
            );

            const contentBlock = (
              <div
                className={`${
                  dateOnLeft
                    ? "md:text-left md:pl-10"
                    : "md:text-right md:pr-10"
                }`}
              >
                <p className="md:hidden font-serif text-sm text-brown mb-1">
                  {e.date}
                </p>
                <h3 className="font-serif text-xl text-ink">{e.title}</h3>
                <p className="text-ink/75 mt-1">{e.description}</p>
              </div>
            );

            return (
              <li
                key={e.title}
                className="
                  relative
                  pl-6 md:pl-0
                  mb-12 last:mb-0
                  md:grid md:grid-cols-2 md:items-start md:gap-0
                "
              >
                {/* Mobile dot (on the left rail) */}
                <span
                  aria-hidden
                  className="md:hidden absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-sage-deep ring-4 ring-champagne-soft"
                />
                {/* Desktop dot (centered on the spine) */}
                <span
                  aria-hidden
                  className="hidden md:block absolute left-1/2 top-2 w-3 h-3 rounded-full bg-sage-deep ring-4 ring-champagne-soft -translate-x-1/2 z-10"
                />

                {dateOnLeft ? (
                  <>
                    {dateBlock}
                    {contentBlock}
                  </>
                ) : (
                  <>
                    {contentBlock}
                    {dateBlock}
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
