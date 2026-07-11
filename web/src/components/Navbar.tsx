import { useEffect, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import websiteLogo from "/website-logo.svg";
import websiteLogoLight from "/website-logo-light.svg";

const links = [
  { to: "/", label: "Our Story" },
  { to: "/rsvp", label: "RSVP" },
  { to: "/registry", label: "Registry" },
  { to: "/directions", label: "Directions" },
];

// Height of the sticky header; used to offset the hero-overlap detection.
const NAV_HEIGHT = 72;

/**
 * Watches the home page hero (`#hero`). Returns true while the hero still sits
 * under the navbar strip — i.e. the nav is drawn over the dark photo. Pages
 * without a hero (RSVP, Registry, …) simply keep the default light theme.
 */
function useOverHero(): boolean {
  const [overHero, setOverHero] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const hero = document.getElementById("hero");
    if (!hero) {
      // No hero on this route (RSVP, Registry, …): fall back to the light
      // theme. Deferred a tick so we never setState synchronously in the body.
      queueMicrotask(() => setOverHero(false));
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setOverHero(entry.isIntersecting),
      { rootMargin: `-${NAV_HEIGHT}px 0px 0px 0px`, threshold: 0 },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, [pathname]);

  return overHero;
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const overHero = useOverHero();

  // Over the photo the menu inherits the light-on-dark treatment; the mobile
  // dropdown always uses the solid light panel for readability.
  const headerClass = overHero
    ? "bg-black/25 backdrop-blur-sm border-white/15 text-white"
    : "bg-champagne-soft/85 backdrop-blur border-beige/40 text-brown-dark";

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 border-b transition-colors duration-300 ${headerClass}`}
    >
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link
          to="/"
          className="leading-none inline-flex items-baseline"
          onClick={() => setOpen(false)}
          aria-label="Gerald and Donella — Home"
        >
          {/* Both marks are stacked and cross-faded so the switch is smooth. */}
          <span className="relative inline-block h-7 sm:h-8 md:h-10 lg:h-12">
            <img
              src={websiteLogo}
              alt="Gerald and Donella"
              className={`h-full w-auto transition-opacity duration-300 ${
                overHero ? "opacity-0" : "opacity-100"
              }`}
              width={90}
              height={34}
            />
            <img
              src={websiteLogoLight}
              alt=""
              aria-hidden
              className={`absolute inset-0 h-full w-auto transition-opacity duration-300 ${
                overHero ? "opacity-100" : "opacity-0"
              }`}
              width={90}
              height={34}
            />
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-10">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) =>
                [
                  "text-sm uppercase tracking-[0.22em] transition-colors",
                  isActive
                    ? overHero
                      ? "text-sage underline underline-offset-8 decoration-1"
                      : "text-sage-deep underline underline-offset-8 decoration-1"
                    : overHero
                      ? "text-white/80 hover:text-white"
                      : "text-brown hover:text-sage-deep",
                ].join(" ")
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <button
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={`md:hidden p-2 ${overHero ? "text-white" : "text-brown-dark"}`}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            {open ? (
              <path d="M6 6l12 12M18 6l-12 12" strokeLinecap="round" />
            ) : (
              <>
                <path d="M4 7h16" strokeLinecap="round" />
                <path d="M4 12h16" strokeLinecap="round" />
                <path d="M4 17h16" strokeLinecap="round" />
              </>
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="md:hidden border-t border-beige/40 bg-champagne-soft">
          <ul className="px-6 py-4 flex flex-col gap-3">
            {links.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  end={l.to === "/"}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    [
                      "block text-sm uppercase tracking-[0.22em] py-1",
                      isActive ? "text-sage-deep" : "text-brown",
                    ].join(" ")
                  }
                >
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
