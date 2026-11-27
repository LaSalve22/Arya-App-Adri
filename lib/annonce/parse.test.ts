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
});
