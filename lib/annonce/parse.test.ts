import { describe, expect, it } from "vitest";
import { analyserAnnonce } from "./parse";

describe("analyse d'annonce", () => {
  it("maison avec terrain", () => {
    const a = analyserAnnonce(
      "Vente maison 5 pièces 132 m² à Castelnau-le-Lez (34170). Terrain de 610 m². 4 chambres. Prix : 485 000 € honoraires inclus (3 000 € de frais). DPE : D",
    );
    expect(a).toMatchObject({ type: "Maison", prix: 485000, surface: 132, terrain: 610, pieces: 5, chambres: 4, dpe: "D", codePostal: "34170" });
  });
  it("appartement type T3", () => {
    const a = analyserAnnonce("Appartement T3 de 64,5 m2, 2e étage, 31000 Toulouse. 239000€. Classe énergie E");
    expect(a).toMatchObject({ type: "Appartement", prix: 239000, surface: 64.5, pieces: 3, dpe: "E", codePostal: "31000", ville: "Toulouse" });
  });
  it("immeuble de rapport", () => {
    const a = analyserAnnonce("Immeuble de rapport 4 lots, surface habitable 210 m², 66000 Perpignan, 420 000 euros");
    expect(a).toMatchObject({ type: "Immeuble", prix: 420000, surface: 210, codePostal: "66000" });
  });
  it("format Leboncoin copié depuis l'appli", () => {
    const a = analyserAnnonce("Appartement 3 pièces 69 m²\n120 000 €\nNarbonne 11100\nCritères\nType de bien\nAppartement\nSurface habitable\n69 m²\nNombre de pièces\n3\nClasse énergie\nD\nGES\nE");
    expect(a).toMatchObject({ type: "Appartement", prix: 120000, surface: 69, pieces: 3, dpe: "D", codePostal: "11100", ville: "Narbonne" });
  });
  it("ville composée avant le code postal", () => {
    const a = analyserAnnonce("Maison 5 pièces 120 m²\n249 000 €\nLézignan-Corbières 11200\nSurface du terrain\n800 m²\nClasse énergieF");
    expect(a).toMatchObject({ prix: 249000, surface: 120, terrain: 800, codePostal: "11200", ville: "Lézignan-Corbières", dpe: "F" });
  });
  it("texte lu sur une capture d'écran (erreurs OCR)", () => {
    const a = analyserAnnonce("Appartement 3 pièces 69 m?\n120 0OO E\nNarbonne 11100\nSurface habitable\n69 m2\nClasse énergie D");
    expect(a).toMatchObject({ prix: 120000, surface: 69, codePostal: "11100", ville: "Narbonne", dpe: "D", type: "Appartement" });
  });
  it("prix avec EUR et surface en rn2", () => {
    const a = analyserAnnonce("Maison 5 pièces 120 rn2 - 249 000 EUR - Lézignan-Corbières 11200");
    expect(a).toMatchObject({ prix: 249000, surface: 120, codePostal: "11200", type: "Maison" });
  });
});
