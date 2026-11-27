import { describe, expect, it } from "vitest";
import { calculerFinancement, coutSource, nouvelleSource, planFinancement } from "./financement";
import { calculerSortie, profilParDefaut } from "./profil";
import { calculerBilan, honorairesVenteTTC } from "./calcul";
import { hypothesesParDefaut } from "./defaut";

describe("financement", () => {
  it("coût de chaque source", () => {
    const pret = { ...nouvelleSource("pret", "a"), montant: 200000, tauxAnnuel: 0.05, fraisDossier: 1000, fraisGarantie: 2000, commissionEngagementPct: 0.01 };
    expect(coutSource(pret, 12)).toMatchObject({ interets: 10000, frais: 5000, total: 15000 });
    const obl = { ...nouvelleSource("obligataire", "b"), montant: 100000, tauxAnnuel: 0.1, fraisPlateformePct: 0.05, dureeMois: 18 };
    expect(coutSource(obl, 12)).toMatchObject({ interets: 15000, frais: 5000, total: 20000, dureeMois: 18 });
    const cca = { ...nouvelleSource("compte_courant", "c"), montant: 50000, tauxAnnuel: 0.04 };
    expect(coutSource(cca, 6).total).toBeCloseTo(1000, 6);
    expect(coutSource({ ...nouvelleSource("fonds_propres", "d"), montant: 80000 }, 12).total).toBe(0);
  });
  it("totaux, fonds propres, dette et part JV", () => {
    const f = calculerFinancement(
      [
        { ...nouvelleSource("fonds_propres", "a"), montant: 50000 },
        { ...nouvelleSource("pret", "b"), montant: 150000, tauxAnnuel: 0.04, fraisDossier: 0 },
        { ...nouvelleSource("associe_jv", "c"), montant: 30000, partBenefice: 0.25 },
      ],
      12,
    );
    expect(f).toMatchObject({ totalRessources: 230000, fondsPropres: 80000, dette: 150000, partBeneficeJV: 0.25 });
    expect(f.totalFrais).toBeCloseTo(6000, 6);
    const plan = planFinancement({ foncier: 200000, technique: 40000, honorairesEtFrais: 10000 }, f);
    expect(plan.besoins.total).toBe(250000);
    expect(plan.ecart).toBe(-20000);
  });
  it("le bilan utilise les sources et déduit la part JV", () => {
    const h = hypothesesParDefaut();
    h.prixAcquisition = 100000;
    h.lots = [{ libelle: "R", prixDown: 180000, prixTop: 180000, tva: 0 }];
    h.financement.sources = [
      { ...nouvelleSource("pret", "a"), montant: 100000, tauxAnnuel: 0.06, fraisDossier: 0 },
      { ...nouvelleSource("associe_jv", "b"), montant: 20000, partBenefice: 0.5 },
    ];
    const r = calculerBilan(h);
    expect(r.fraisDivers.financiers).toBeCloseTo(6000, 6);
    expect(r.partageJV).toBeCloseTo(r.beneficeNet * 0.5, 6);
    expect(r.beneficeNetSociete).toBeCloseTo(r.beneficeNet * 0.5, 6);
  });
  it("frais de vente en % d'agence", () => {
    const h = hypothesesParDefaut();
    h.honorairesVente = 9999;
    h.fraisVente = { agencePct: 0.05, diagnostics: 300, mainlevee: 500, homeStaging: 0, autres: 0 };
    expect(honorairesVenteTTC(h, 200000)).toBe(10800);
    h.fraisVente.agencePct = null;
    expect(honorairesVenteTTC(h, 200000)).toBe(9999 + 800);
  });
});

describe("sortie vers les associés", () => {
  it("SAS : PFU 31,4 %", () => {
    const s = calculerSortie(profilParDefaut(), 100000, 120000, 20000);
    expect(s.pfu).toBeCloseTo(31400, 6);
    expect(s.netAssocies).toBeCloseTo(68600, 6);
    expect(s.tauxGlobal).toBeCloseTo((20000 + 31400) / 120000, 6);
  });
  it("SARL gérant majoritaire : cotisations au-delà de 10 % du capital et des comptes courants", () => {
    const p = { ...profilParDefaut(), forme: "SARL_majoritaire" as const, capitalSocial: 10000 };
    const s = calculerSortie(p, 100000, 120000, 20000, 40000); // seuil = 5 000
    expect(s.seuilDixPourCent).toBe(5000);
    expect(s.pfu).toBeCloseTo(5000 * 0.314 + 95000 * 0.128, 6);
    expect(s.cotisationsSociales).toBeCloseTo(95000 * 0.45, 6);
    const sous = calculerSortie(p, 4000, 5000, 600, 40000);
    expect(sous.cotisationsSociales).toBe(0);
  });
  it("bénéfice conservé en société", () => {
    const s = calculerSortie({ ...profilParDefaut(), modeSortie: "conserver" }, 50000, 60000, 10000);
    expect(s).toMatchObject({ distribue: 0, netAssocies: 0, conserveEnSociete: 50000 });
  });
});
