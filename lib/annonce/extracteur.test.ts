import { describe, expect, it } from "vitest";
import { brutDepuisHtml, decoderBrut, encoderBrut, extraireAnnonce } from "./extracteur";
import { lienPublic, lireAnnonce } from "./lecture";
import { codeFavori, scriptFavori } from "./favori";

// Pages d'exemple reconstituées (structure des sites, contenu fictif)
const AD = {
  list_id: 123456789,
  subject: "Maison de village à rénover",
  body: "Maison de 95 m² à rénover entièrement, simple vitrage, fosse septique. Terrain de 300 m².",
  price: [185000],
  url: "https://www.leboncoin.fr/ad/ventes_immobilieres/123456789",
  attributes: [
    { key: "real_estate_type", value: "1", value_label: "Maison" },
    { key: "square", value: "95", value_label: "95 m²" },
    { key: "rooms", value: "4", value_label: "4" },
    { key: "land_plot_surface", value: "300", value_label: "300 m²" },
    { key: "energy_rate", value: "f", value_label: "F" },
  ],
  location: { city: "Narbonne", zipcode: "11100", lat: 43.184, lng: 3.004 },
  images: { urls_large: ["https://img.example/1.jpg", "https://img.example/2.jpg"] },
};
const PAGE_LBC = `<html><head><title>Maison de village - Leboncoin</title>
<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { ad: AD } } })}</script></head><body>…</body></html>`;

const PAGE_AGENCE = `<html><head><meta property="og:title" content="Appartement T3 – Montpellier">
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "BreadcrumbList", itemListElement: [] },
    {
      "@type": "Apartment", name: "Appartement T3 lumineux", description: "T3 de 65 m², cuisine à refaire, DPE D.",
      floorSize: { "@type": "QuantitativeValue", value: 65, unitCode: "MTK" }, numberOfRooms: 3,
      address: { "@type": "PostalAddress", streetAddress: "12 rue de la Loge", addressLocality: "Montpellier", postalCode: "34000" },
      geo: { "@type": "GeoCoordinates", latitude: 43.6096, longitude: 3.8777 },
      offers: { "@type": "Offer", price: "210000", priceCurrency: "EUR" }, image: ["https://img.example/a.jpg"],
    },
  ],
})}</script></head><body><h1>Appartement T3</h1><p>210 000 €</p></body></html>`;

const PAGE_OG = `<html><head><meta property="og:title" content="Terrain à bâtir 600 m² - 89 000 € - Béziers 34500">
<meta property="og:description" content="Beau terrain viabilisé de 600 m², DPE non requis."><meta property="og:image" content="https://img.example/t.jpg"></head><body></body></html>`;

describe("extracteur d'annonces", () => {
  it("Leboncoin : objet « ad » de __NEXT_DATA__", () => {
    const a = extraireAnnonce(brutDepuisHtml(PAGE_LBC, AD.url));
    expect(a).toMatchObject({ site: "leboncoin", prix: 185000, surface: 95, terrain: 300, pieces: 4, type: "Maison", dpe: "F", ville: "Narbonne", codePostal: "11100", lat: 43.184, lon: 3.004, positionApprochee: true });
    expect(a.photos).toHaveLength(2);
    expect(a.sources.prix).toBe("structure");
    expect(a.description).toMatch(/fosse septique/);
  });

  it("site d'agence : JSON-LD schema.org (@graph, offre, géolocalisation)", () => {
    const a = extraireAnnonce(brutDepuisHtml(PAGE_AGENCE, "https://www.agence-exemple.fr/annonce/42"));
    expect(a).toMatchObject({ site: "autre", prix: 210000, surface: 65, pieces: 3, type: "Appartement", ville: "Montpellier", codePostal: "34000", adresse: "12 rue de la Loge", lat: 43.6096, positionApprochee: false });
    expect(a.dpe).toBe("D"); // déduit du texte
    expect(a.sources.dpe).toBe("texte");
  });

  it("Open Graph seul : complété par le texte", () => {
    const a = extraireAnnonce(brutDepuisHtml(PAGE_OG, "https://www.pap.fr/annonces/terrain-beziers-r1"));
    expect(a).toMatchObject({ site: "pap", prix: 89000, terrain: 600, type: "Terrain", codePostal: "34500", ville: "Béziers" });
    expect(a.photos).toEqual(["https://img.example/t.jpg"]);
  });

  it("texte partagé depuis une appli", () => {
    const a = extraireAnnonce({ v: 1, texte: "Maison 4 pièces 95 m² – 185 000 € – Narbonne 11100" });
    expect(a).toMatchObject({ prix: 185000, surface: 95, pieces: 4, type: "Maison", codePostal: "11100", ville: "Narbonne" });
  });

  it("transport dans l'adresse : accents et emoji conservés", () => {
    const b = { v: 1 as const, url: "https://x.fr", titre: "Maison à Béziers 🏡", ad: AD };
    expect(decoderBrut(encoderBrut(b))).toEqual(b);
  });
});

describe("lecture côté serveur", () => {
  it("Leboncoin : pas de lecture du lien, guide vers le favori, texte partagé exploité", async () => {
    const r = await lireAnnonce("Maison 4 pièces 95 m² 185 000 € Narbonne 11100 https://www.leboncoin.fr/ad/ventes_immobilieres/123456789");
    expect(r.guide).toMatch(/Envoyer à MADRIMMO/);
    expect(r.annonce).toMatchObject({ site: "leboncoin", prix: 185000, surface: 95, codePostal: "11100" });
  });
  it("n'autorise que les sites publics", () => {
    expect(lienPublic("https://www.pap.fr/annonce/1")).toBe(true);
    expect(lienPublic("http://localhost:3000/x")).toBe(false);
    expect(lienPublic("http://169.254.169.254/latest")).toBe(false);
    expect(lienPublic("http://[::1]/")).toBe(false);
    expect(lienPublic("file:///etc/passwd")).toBe(false);
  });
});

describe("favori", () => {
  it("code « javascript: » avec l'adresse de l'appli", () => {
    const c = codeFavori("https://madrimmo.example");
    expect(c.startsWith("javascript:")).toBe(true);
    expect(decodeURIComponent(c)).toContain("https://madrimmo.example/importer#d=");
    // Le script est du JavaScript valide
    expect(() => new Function(scriptFavori("https://madrimmo.example"))).not.toThrow();
  });
});
