import type { Metadata } from "next";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "MADRIMMO",
  description: "Recherche et analyse de biens pour marchands de biens en Occitanie",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <header className="barre">
          <Link href="/" className="logo">
            MADR<span>IMMO</span>
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
