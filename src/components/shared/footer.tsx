import Link from "next/link";
import { Logo } from "./logo";
import { PLACES_LABEL, ROUTES } from "@/lib/config";

const SECTIONS = [
  {
    title: "Discover",
    links: [
      { label: "All Shows", href: "/events" },
      { label: "Genres", href: "/genres" },
      { label: "Concerts", href: "/events?category=concerts" },
      { label: "Festivals", href: "/events?category=festivals" },
      { label: "Club Nights", href: "/events?category=club-nights" },
    ],
  },
  {
    title: PLACES_LABEL,
    links: [
      { label: "All places", href: "/venues" },
      { label: "Publish your place", href: "/organizer/login" },
      { label: "Organizer sign in", href: "/organizer/login" },
      { label: "Contact us", href: ROUTES.contact },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Press", href: "#" },
      { label: "Contact", href: ROUTES.contact },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", href: "#" },
      { label: "Privacy Policy", href: "#" },
      { label: "Refund Policy", href: "#" },
      { label: "Cookie Settings", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border/60 bg-card/30">
      <div className="container py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          <div className="col-span-2 md:col-span-1">
            <Logo />
            <p className="mt-4 text-sm text-muted-foreground">
              The modern home for live music. Powered by nZO Innovations.
            </p>
          </div>
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h4 className="text-sm font-semibold text-foreground">{s.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {s.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>&copy; {new Date().getFullYear()} nZO Innovations. All rights reserved.</p>
          <p>Built for promoters and venues who care about the show.</p>
        </div>
      </div>
    </footer>
  );
}
