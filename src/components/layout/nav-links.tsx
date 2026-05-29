"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard",    label: "Dashboard" },
  { href: "/predictions",  label: "Predictions" },
  { href: "/matches",      label: "Matches" },
  { href: "/leaderboard",  label: "Leaderboard" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="hidden lg:flex items-center h-full">
      {LINKS.map(({ href, label }) => {
        const active =
          pathname === href ||
          (href !== "/dashboard" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={`relative flex items-center h-full px-4 text-[15px] no-underline transition-colors ${
              active
                ? "text-white font-semibold"
                : "text-foreground/40 hover:text-foreground/75 font-medium"
            }`}
          >
            {label}
            {active ? (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[#129D49]" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
