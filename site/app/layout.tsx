import type { Metadata } from "next";
import Link from "next/link";
import { bodyFont, headingFont } from "./fonts";
import MainNav from "./main-nav";
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
          <div className="site-header-inner">
            <Link href="/" className="site-name">
              AI Engineering Scaffold
            </Link>
            <MainNav />
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
