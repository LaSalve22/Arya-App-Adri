import { describe, expect, it } from "vitest";
import { hypothesesDepuisPartiel } from "./defaut";

describe("hypothèses partielles", () => {
  it("complète avec les valeurs par défaut sans toucher le reste", () => {
    const h = hypothesesDepuisPartiel({ prixAcquisition: 100000, travaux: { secondOeuvre: { electricite: { montantTTC: 5000 } } }, financement: { tauxAnnuel: 0.05 } });
    expect(h.prixAcquisition).toBe(100000);
    expect(h.tauxNotaire).toBe(0.03);
    expect(h.travaux.secondOeuvre.electricite).toEqual({ montantTTC: 5000, tauxTVA: 0.1, pctRenove: 0 });
    expect(h.travaux.secondOeuvre.cloisons.montantTTC).toBe(0);
    expect(h.financement.tauxAnnuel).toBe(0.05);
    expect(h.financement.dureeMois).toBe(12);
  });
  it("remplace les listes", () => {
    const h = hypothesesDepuisPartiel({ lots: [{ libelle: "A", prixDown: 1, prixTop: 2, tva: 0 }] });
    expect(h.lots).toHaveLength(1);
    expect(h.lots[0].libelle).toBe("A");
  });
});
