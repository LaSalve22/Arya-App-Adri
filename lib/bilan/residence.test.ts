import { describe, expect, it } from "vitest";
import { hypothesesParDefaut } from "./defaut";
import { amortissement, calculerResidencePrincipale, iraLegales, mensualite, optionsRPParDefaut, prixMaxRP } from "./residence";
import { calculerBilan } from "./calcul";

function cas() {
  const h = hypothesesParDefaut();
  h.prixAcquisition = 100000;
  h.travaux.secondOeuvre.electricite.montantTTC = 20000; // + aléas 6 % = 21 200
  h.honorairesVente = 5000;
  h.lots = [{ libelle: "Revente", prixDown: 170000, prixTop: 170000, tva: 0 }];
  const rp = { ...optionsRPParDefaut(), apport: 20000, dureePretAns: 20, tauxPret: 0.034, tauxAssurance: 0.003, tauxGarantie: 0.01, fraisDossier: 1000, dureeDetentionMois: 24, chargesMensuelles: 100, loyerEvite: 600, fraisRevente: 500 };
  return { h, rp };
}

describe("prêt immobilier amortissable", () => {
  it("mensualité d'un prêt de 200 000 € sur 20 ans à 3,4 %", () => {
    expect(mensualite(200000, 0.034, 240)).toBeCloseTo(1149.67, 1);
  });
  it("tableau d'amortissement sur 24 mois", () => {
    const a = amortissement(200000, 0.034, 240, 24);
    // contrôle : intérêts + capital remboursé = 24 mensualités
    expect(a.interets + a.capitalRembourse).toBeCloseTo(24 * a.mensualite, 6);
    expect(a.capitalRestant).toBeCloseTo(200000 - a.capitalRembourse, 6);
    expect(a.interets).toBeGreaterThan(13000);
    expect(a.interets).toBeLessThan(13600);
  });
  it("IRA plafonnées : 6 mois d'intérêts, dans la limite de 3 % du capital restant dû", () => {
    expect(iraLegales(100000, 0.034)).toBeCloseTo(1700, 6); // 6 mois d'intérêts < 3 000
    expect(iraLegales(100000, 0.08)).toBeCloseTo(3000, 6); // plafond 3 %
  });
});

describe("résidence principale", () => {
  it("calcul à la main", () => {
    const { h, rp } = cas();
    const r = calculerResidencePrincipale(h, rp);
    expect(r.notaire).toBeCloseTo(7500, 6);
    expect(r.travaux).toBeCloseTo(21200, 6);
    // Prêt = (prix + notaire + travaux − apport + dossier) / (1 − 1 % de garantie)
    const pret = (100000 + 7500 + 21200 - 20000 + 1000) / 0.99;
    expect(r.banque.montantEmprunte).toBeCloseTo(pret, 6);
    expect(r.financement.garantie).toBeCloseTo(pret * 0.01, 6);
    const am = amortissement(pret, 0.034, 240, 24);
    expect(r.financement.interets).toBeCloseTo(am.interets, 6);
    expect(r.financement.assurance).toBeCloseTo(pret * 0.003 * 2, 6);
    expect(r.financement.ira).toBeCloseTo(iraLegales(am.capitalRestant, 0.034), 6);
    expect(r.banque.revenuMinimum).toBeCloseTo((am.mensualite + (pret * 0.003) / 12) / 0.35, 6);
    expect(r.charges).toBe(2400);
    expect(r.fraisVente).toBe(5500);
    const cout = 100000 + 7500 + 21200 + r.financement.total + 2400 + 5500;
    expect(r.coutTotal).toBeCloseTo(cout, 6);
    expect(r.gainNet).toBeCloseTo(170000 - cout, 6);
    expect(r.rendementApport).toBeCloseTo((170000 - cout) / 20000, 6);
  });
  it("IRA négociées à zéro", () => {
    const { h, rp } = cas();
    expect(calculerResidencePrincipale(h, { ...rp, iraNegociees: true }).financement.ira).toBe(0);
  });
  it("alerte si l'apport ne couvre pas les frais", () => {
    const { h, rp } = cas();
    expect(calculerResidencePrincipale(h, { ...rp, apport: 2000 }).banque.alertes.length).toBeGreaterThan(0);
    expect(calculerResidencePrincipale(h, { ...rp, apport: 15000 }).banque.alertes).toHaveLength(0);
  });
  it("aucun impôt sur la plus-value, contrairement à la société", () => {
    const { h, rp } = cas();
    const r = calculerResidencePrincipale(h, rp);
    expect(r.impotPlusValue).toBe(0);
    expect(calculerBilan(h).impot).toBeGreaterThan(0);
  });
  it("prix maximum pour une marge cible", () => {
    const { h, rp } = cas();
    const p = prixMaxRP(h, rp, 0.1)!;
    expect(calculerResidencePrincipale({ ...h, prixAcquisition: p }, rp).margeSurRevente).toBeGreaterThanOrEqual(0.1);
    expect(calculerResidencePrincipale({ ...h, prixAcquisition: p + 2 }, rp).margeSurRevente).toBeLessThan(0.1);
  });
});
