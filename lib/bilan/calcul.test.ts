import { describe, expect, it } from "vitest";
import { calculerBilan, basculeImmeubleNeuf } from "./calcul";
import { hypothesesParDefaut } from "./defaut";
import { prixMaxPourMarge, sensibilite } from "./nego";
import type { Hypotheses, RegimeTVA } from "./types";
import cases from "./__fixtures__/cases.json";
import excel from "./__fixtures__/excel_results.json";

// Les fixtures viennent du classeur bilan_previsionnel_v3.xlsx rempli avec les mêmes
// hypothèses puis recalculé par LibreOffice (voir scripts/excel-fidelite.md).
function depuisFixture(regime: RegimeTVA): Hypotheses {
  const i = cases.inputs;
  const c = cases.cases[regime];
  const h = hypothesesParDefaut();
  const t = h.travaux;
  t.surfaceTotale = i.st;
  t.surfaceCarrez = i.sc;
  const go = [t.grosOeuvre.fondations, t.grosOeuvre.structure, t.grosOeuvre.facades];
  go.forEach((p, k) => Object.assign(p, { montantTTC: i.go[k][0], tauxTVA: i.go[k][1], pctRenove: c.go_pct }));
  Object.values(t.secondOeuvre).forEach((p, k) =>
    Object.assign(p, { montantTTC: i.so[k][0], tauxTVA: i.so[k][1], pctRenove: c.so_pct }),
  );
  t.honorairesTechniques.montantTTC = i.hon;
  t.raccordements.montantTTC = i.racc;
  t.voirie.montantTTC = i.voirie;
  t.surelevation = i.surel;
  t.extension = i.ext;
  return {
    ...h,
    prixAcquisition: i.prix,
    indemniteEviction: i.eviction,
    apporteurAffaires: i.apporteur,
    ameublement: i.ameub,
    honorairesGestion: i.gestion,
    fraisComptabilite: i.compta,
    fraisJustice: i.justice,
    financement: { ...h.financement, fraisFinanciersManuels: i.ff },
    gfa: i.gfa,
    assuranceDO: i.do,
    honorairesVente: i.hv,
    lots: i.lots.map(([d, top], k) => ({ libelle: `Lot ${k + 1}`, prixDown: d, prixTop: top, tva: 0 })),
    regimeTVA: regime,
  };
}

describe("fidélité à l'Excel (recalcul LibreOffice)", () => {
  for (const regime of ["marge", "exoneration", "total"] as RegimeTVA[]) {
    it(`régime ${regime}`, () => {
      const r = calculerBilan(depuisFixture(regime));
      const x = (excel as Record<string, Record<string, number | string>>)[regime];
      expect(r.bascule.immeubleNeuf).toBe(x.B45 === "Oui");
      expect(r.foncier.notaire.ttc).toBeCloseTo(x.D8 as number, 2);
      expect(r.foncier.total.ttc).toBeCloseTo(x.D10 as number, 2);
      expect(r.foncier.total.tva).toBeCloseTo(x.E10 as number, 2);
      expect(r.technique.aleas.ttc).toBeCloseTo(x.D16 as number, 2);
      expect(r.technique.total.ttc).toBeCloseTo(x.D19 as number, 2);
      expect(r.technique.total.tva).toBeCloseTo(x.E19 as number, 2);
      expect(r.honorairesDivers.ttc).toBeCloseTo(x.D24 as number, 2);
      expect(r.fraisDivers.total).toBeCloseTo(x.D29 as number, 2);
      expect(r.bfr.ttc).toBeCloseTo(x.D30 as number, 2);
      expect(r.bfr.tva).toBeCloseTo(x.E30 as number, 2);
      expect(r.recettes.chiffreAffaires).toBeCloseTo(x.D39 as number, 2);
      expect(r.margeBruteTTC).toBeCloseTo(x.D43 as number, 2);
      expect(r.tvaPrixTotal).toBeCloseTo(x.D45 as number, 2);
      expect(r.tvaSurMarge).toBeCloseTo(x.D47 as number, 2);
      expect(r.tvaRecuperable).toBeCloseTo(x.D48 as number, 2);
      expect(r.tvaDue).toBeCloseTo(x.D49 as number, 2);
      expect(r.margeNetteDeTVA).toBeCloseTo(x.D50 as number, 2);
      expect(r.beneficeBrut).toBeCloseTo(x.D51 as number, 2);
      expect(r.margeSurCA).toBeCloseTo(x.E51 as number, 6);
      expect(r.isTaux15).toBeCloseTo(x.D52 as number, 2);
      expect(r.isTaux25).toBeCloseTo(x.D53 as number, 2);
      expect(r.beneficeNet).toBeCloseTo(x.D55 as number, 2);
    });
  }
});

describe("bascule immeuble neuf", () => {
  it("un poste de gros œuvre à 50 % suffit", () => {
    const h = hypothesesParDefaut();
    h.travaux.grosOeuvre.facades.pctRenove = 0.5;
    expect(basculeImmeubleNeuf(h.travaux).immeubleNeuf).toBe(true);
  });
  it("le second œuvre doit dépasser 66 % sur les 6 postes", () => {
    const h = hypothesesParDefaut();
    Object.values(h.travaux.secondOeuvre).forEach((p) => (p.pctRenove = 0.7));
    expect(basculeImmeubleNeuf(h.travaux).immeubleNeuf).toBe(true);
    h.travaux.secondOeuvre.planchers.pctRenove = 0.5;
    expect(basculeImmeubleNeuf(h.travaux).immeubleNeuf).toBe(false);
  });
});

describe("négociation", () => {
  const h = depuisFixture("marge");
  it("le prix max redonne la marge cible", () => {
    const p = prixMaxPourMarge(h, 0.15)!;
    expect(p).toBeGreaterThan(0);
    expect(calculerBilan({ ...h, prixAcquisition: p }).margeSurCA).toBeGreaterThanOrEqual(0.15);
    expect(calculerBilan({ ...h, prixAcquisition: p + 2 }).margeSurCA).toBeLessThan(0.15);
  });
  it("cible inatteignable → null", () => {
    expect(prixMaxPourMarge(h, 0.99)).toBeNull();
  });
  it("la marge augmente avec la remise", () => {
    const t = sensibilite(h, 350000);
    expect(t[4][1].margeSurCA).toBeGreaterThan(t[0][1].margeSurCA);
    expect(t[0][2].margeSurCA).toBeGreaterThan(t[0][0].margeSurCA);
  });
});
