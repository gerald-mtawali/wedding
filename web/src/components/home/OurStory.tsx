type Chapter = { title: string; body: string };

/** Edit these chapters — text and titles are intentionally simple to swap. */
const chapters: Chapter[] = [
  {
    title: "How We Met",
    body: "Sed aliquet bibendum eros, id commodo ligula tincidunt sed. Nunc ultrices tellus et tellus vehicula semper. Nulla sed gravida dui, quis interdum eros. Sed ac convallis mauris, id scelerisque magna.",
  },
  {
    title: "Falling In Love",
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam ut sodales sem, vitae ultricies odio. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; In auctor dapibus lectus, sit amet semper leo volutpat quis.",
  },
  {
    title: "The Proposal",
    body: "Suspendisse venenatis tellus in mauris pulvinar, ut ullamcorper enim sagittis.",
  },
];

export default function OurStory() {
  return (
    <section
      id="our-story"
      className="bg-champagne/60 border-y border-beige/40"
    >
      <div className="max-w-6xl mx-auto px-6 py-20 md:py-24">
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-[0.35em] text-brown mb-3">
            The Journey
          </p>
          <h2 className="font-script text-5xl md:text-7xl text-ink">
            Our Story
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-10 md:gap-14">
          {chapters.map((c) => (
            <article key={c.title} className="text-center md:text-left">
              <h3 className="font-body text-2xl text-brown-dark mb-3">
                {c.title}
              </h3>
              <p className="text-ink/85 leading-relaxed font-body">{c.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
