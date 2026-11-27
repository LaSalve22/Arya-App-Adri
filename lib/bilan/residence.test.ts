import { describe, expect, it } from "vitest";
import { hypothesesParDefaut } from "./defaut";
import { calculerResidencePrincipale, optionsRPParDefaut, prixMaxRP } from "./residence";
import { calculerBilan } from "./calcul";

function cas() {
  const h = hypothesesParDefaut();
  h.prixAcquisition = 100000;
  h.travaux.secondOeuvre.electricite.montantTTC = 20000; // + aléas 6 % = 21 200
  h.honorairesVente = 5000;
  h.financement = { montantEmprunte: 120000, tauxAnnuel: 0.04, dureeMois: 12, fraisDossier: 1000, fraisFinanciersManuels: null };
  h.lots = [{ libelle: "Revente", prixDown: 170000, prixTop: 170000, tva: 0 }];
  h.apport = 30000;
  const rp = { ...optionsRPParDefaut(), chargesMensuelles: 100, loyerEvite: 600, fraisRevente: 500 };
  return { h, rp };
}

describe("résidence principale", () => {
  it("calcul à la main", () => {
    const { h, rp } = cas();
    const r = calculerResidencePrincipale(h, rp);
    expect(r.notaire).toBeCloseTo(7500, 6);
    expect(r.travaux).toBeCloseTo(21200, 6);
    expect(r.financement.interets).toBeCloseTo(4800 + 1000, 6);
    expect(r.financement.assurance).toBeCloseTo(360, 6);
    expect(r.charges).toBe(1200);
    expect(r.fraisVente).toBe(5500);
    const cout = 100000 + 7500 + 21200 + 6160 + 1200 + 5500;
    expect(r.coutTotal).toBeCloseTo(cout, 6);
    expect(r.gainNet).toBeCloseTo(170000 - cout, 6);
    expect(r.gainAvecLoyer).toBeCloseTo(170000 - cout + 7200, 6);
    expect(r.rendementApport).toBeCloseTo((170000 - cout) / 30000, 6);
  });
  it("aucun impôt sur la plus-value, contrairement à la société", () => {
    const { h, rp } = cas();
    const r = calculerResidencePrincipale(h, rp);
    expect(r.impotPlusValue).toBe(0);
    expect(calculerBilan(h).impot).toBeGreaterThan(0);
  });
  it("prix maximum pour une marge cible", () => {
    const { h, rp } = cas();
    const p = prixMaxRP(h, rp, 0.15)!;
    expect(calculerResidencePrincipale({ ...h, prixAcquisition: p }, rp).margeSurRevente).toBeGreaterThanOrEqual(0.15);
    expect(calculerResidencePrincipale({ ...h, prixAcquisition: p + 2 }, rp).margeSurRevente).toBeLessThan(0.15);
  });
});
