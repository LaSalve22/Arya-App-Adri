import { describe, expect, it } from "vitest";
import { baseTravaux, etatParDefaut, synchroniserPourcentages } from "./etat";
import { hypothesesParDefaut } from "./bilan/defaut";

describe("état de l'appli", () => {
  it("frais de notaire marchand de biens à 4,5 % par défaut, l'Excel reste à 3 %", () => {
    expect(etatParDefaut().hypotheses.tauxNotaire).toBe(0.045);
    expect(hypothesesParDefaut().tauxNotaire).toBe(0.03);
  });

  it("coûts en % des travaux recalculés quand les travaux changent", () => {
    let e = etatParDefaut();
    e.hypotheses.travaux.secondOeuvre.electricite.montantTTC = 40000;
    e = synchroniserPourcentages({ ...e, coutsPct: { architecte: 0.1, assuranceDO: 0.02 } });
    expect(baseTravaux(e.hypotheses)).toBe(40000);
    expect(e.coutsTechniques.architecte).toBe(4000);
    expect(e.hypotheses.assuranceDO).toBe(800);
    expect(e.hypotheses.travaux.honorairesTechniques.montantTTC).toBe(4000);
    // Les travaux doublent : les coûts suivent
    const h = e.hypotheses;
    const e2 = synchroniserPourcentages({ ...e, hypotheses: { ...h, travaux: { ...h.travaux, secondOeuvre: { ...h.travaux.secondOeuvre, cloisons: { montantTTC: 40000, tauxTVA: 0.1, pctRenove: 0 } } } } });
    expect(e2.coutsTechniques.architecte).toBe(8000);
    expect(e2.hypotheses.assuranceDO).toBe(1600);
  });

  it("sans % saisi, l'état est inchangé", () => {
    const e = etatParDefaut();
    expect(synchroniserPourcentages(e)).toBe(e);
  });
});
