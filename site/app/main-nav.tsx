"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS, ariaCurrent, navState } from "@/lib/nav";

/**
 * The main nav (spec 004, AC4 and AC5; ADR 0014). A client component only
 * because it reads the URL. Every route is prerendered, so `aria-current` is
 * in the static HTML before any JavaScript runs.
 */
export default function MainNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="main-nav">
      <ul>
        {NAV_LINKS.map(({ href, label }) => (
          <li key={href}>
            <Link href={href} aria-current={ariaCurrent(navState(pathname, href))}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
