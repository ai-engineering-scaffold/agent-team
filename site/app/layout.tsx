import type { Metadata } from "next";
import Link from "next/link";
import { bodyFont, monoFont } from "./fonts";
import MainNav from "./main-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AI Engineering Scaffold",
    template: "%s · AI Engineering Scaffold",
  },
  description: "An AI-native engineering org, run in public: agents with defined roles, review gates, and a public decision log.",
};

const CONTACT_EMAIL = "schill1025@gmail.com";

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Every route is prerendered, so this is the year the site was built (spec 005, AC9). The footer
  // exposes it as data-build-year for the tests.
  const buildYear = new Date().getUTCFullYear();
  return (
    <html lang="en" className={`${bodyFont.variable} ${monoFont.variable}`}>
      <body>
        <header className="site-header">
          <div className="site-header-inner">
            <Link href="/" className="site-name">
              AI Engineering Scaffold
            </Link>
            <MainNav />
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer" data-build-year={buildYear}>
          <div className="site-footer-inner">
            <span>© {buildYear} AI Engineering Scaffold</span>
            <span aria-hidden="true" className="footer-sep">
              ·
            </span>
            <a href={`mailto:${CONTACT_EMAIL}`}>Contact us</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
