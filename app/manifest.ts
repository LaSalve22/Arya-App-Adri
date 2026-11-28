import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MADRIMMO",
    short_name: "MADRIMMO",
    description: "Recherche et analyse de biens pour marchands de biens en Occitanie",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    // « Partager → MADRIMMO » depuis les applis Leboncoin, SeLoger, Bien'ici (Android, appli installée).
    share_target: { action: "/importer", method: "GET", params: { title: "titre", text: "texte", url: "url" } },
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
