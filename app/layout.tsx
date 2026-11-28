import type { Metadata } from "next";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "./globals.css";
import { Monogramme } from "@/components/Logo";

export const viewport = { themeColor: "#000000", colorScheme: "dark" as const };

export const metadata: Metadata = {
  title: "MADRIMMO",
  description: "Recherche et analyse de biens pour marchands de biens en Occitanie",
  applicationName: "MADRIMMO",
  appleWebApp: { capable: true, title: "MADRIMMO", statusBarStyle: "black" },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <header className="barre">
          <Link href="/" className="logo" aria-label="MADRIMMO, accueil">
            <Monogramme largeur={30} />
            <span>MADRIMMO</span>
          </Link>
          <nav>
            <Link href="/">Rechercher</Link>
            <Link href="/projets">Projets</Link>
          </nav>
          <span className="zone">Occitanie · données publiques en direct</span>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
