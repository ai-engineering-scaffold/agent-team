import type { Metadata } from "next";
import Link from "next/link";
import { bodyFont, headingFont } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AI Engineering Scaffold",
    template: "%s · AI Engineering Scaffold",
  },
  description: "An AI-native engineering org, run in public: agents with defined roles, review gates, and a public decision log.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${headingFont.variable} ${bodyFont.variable}`}>
      <body>
        <header className="site-header">
          <Link href="/" className="site-name">
            AI Engineering Scaffold
          </Link>
          <nav aria-label="Main">
            <Link href="/how-we-work">How we work</Link>
            <Link href="/decisions">Decisions</Link>
            <Link href="/metrics">Metrics</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
