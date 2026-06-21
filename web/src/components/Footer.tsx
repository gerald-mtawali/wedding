export default function Footer() {
  return (
    <footer className="border-t border-beige/40 bg-champagne/50">
      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col items-center gap-4 text-center">
        <div className="font-script text-4xl md:text-5xl text-brown-dark leading-none">
          Gerald &amp; Donella
        </div>
        <p className="font-serif text-brown text-sm tracking-[0.25em] uppercase">
          October 3, 2026 &nbsp;·&nbsp; Lilongwe, Malawi
        </p>
        <div className="mt-2 flex items-center gap-2 text-brown/70">
          <span className="h-px w-10 bg-brown/30" />
          <span className="text-xs tracking-widest uppercase">With love</span>
          <span className="h-px w-10 bg-brown/30" />
        </div>
        <p className="text-xs text-brown/60 mt-2">
          &copy; {new Date().getFullYear()} Gerald &amp; Donella
        </p>
      </div>
    </footer>
  );
}
