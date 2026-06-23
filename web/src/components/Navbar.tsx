import { useState } from "react";
import { NavLink, Link } from "react-router-dom";
import websiteLogo from "/website-logo.svg";

const links = [
  { to: "/", label: "Our Story" },
  { to: "/rsvp", label: "RSVP" },
  { to: "/registry", label: "Registry" },
  { to: "/directions", label: "Directions" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-champagne-soft/85 backdrop-blur border-b border-beige/40">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link
          to="/"
          className="leading-none text-brown-dark inline-flex items-baseline"
          onClick={() => setOpen(false)}
          aria-label="Gerald and Donella — Home"
        >
          <span>
            <img
              src={websiteLogo}
              alt="Gerald and Donella"
              className="h-7 sm:h-8 md:h-10 lg:h-12 w-auto"
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
                    ? "text-sage-deep underline underline-offset-8 decoration-1"
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
          className="md:hidden p-2 text-brown-dark"
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
