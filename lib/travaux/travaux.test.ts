import { describe, expect, it } from "vitest";
import { budgetVide, hypothesesParDefaut } from "@/lib/bilan/defaut";
import { basculeImmeubleNeuf, calculerBilan } from "@/lib/bilan/calcul";
import { CATALOGUE } from "./catalogue";
import { analyserDescription } from "./dictee";
import { demarches, type ContexteDemarches } from "./demarches";
import { chiffrer, planParDefaut, projetParDefaut, proposerTravaux, reportDevis, reportForfait, type PlanTravaux } from "./plan";

const base = () => ({ ...budgetVide(), surfaceTotale: 65, surfaceCarrez: 65 });
const ctx = (p: Partial<ContexteDemarches> = {}): ContexteDemarches => ({ typeBien: "Maison", secteurPatrimonial: false, grosOeuvre: false, travaux: true, immeubleNeuf: false, surface: 65, ...p });

describe("catalogue", () => {
  it("reprend les grilles Excel avec des identifiants uniques", () => {
    expect(new Set(CATALOGUE.map((a) => a.id)).size).toBe(CATALOGUE.length);
    const elec = CATALOGUE.find((a) => a.id === "electricite")!;
    expect(elec.prix).toEqual({ bas: 50, moyen: 70, haut: 95 });
    expect(CATALOGUE.find((a) => a.id === "sdb")!.prix.moyen).toBe(5200);
  });
});

describe("forfaits", () => {
  it("rafraîchissement : 450 €/m², pas de requalification", () => {
    const r = reportForfait(base(), "rafraichissement", 65, projetParDefaut(), 65);
    expect(r.total).toBe(29250);
    const h = { ...hypothesesParDefaut(), travaux: r.travaux };
    expect(calculerBilan(h).technique.grosEtSecondOeuvre.ttc).toBeCloseTo(29250, -1);
    expect(basculeImmeubleNeuf(r.travaux).immeubleNeuf).toBe(false);
  });
  it("rénovation globale : 850 €/m², reste sous les deux tiers", () => {
    const r = reportForfait(base(), "global", 65, projetParDefaut(), 65);
    expect(r.total).toBe(55250);
    expect(basculeImmeubleNeuf(r.travaux).immeubleNeuf).toBe(false);
  });
  it("réhabilitation : 1 200 €/m², bascule en immeuble neuf et TVA sur le prix total", () => {
    const r = reportForfait(base(), "rehabilitation", 65, projetParDefaut(), 65);
    expect(r.total).toBe(78000);
    const h = { ...hypothesesParDefaut(), regimeTVA: "auto" as const, travaux: r.travaux, lots: [{ libelle: "Lot", prixDown: 200000, prixTop: 200000, tva: 0 }] };
    const b = calculerBilan(h);
    expect(b.bascule.immeubleNeuf).toBe(true);
    expect(b.regimeApplique).toBe("total");
  });
});

describe("requalification et régime automatique", () => {
  it("immeuble achevé depuis moins de 5 ans", () => {
    expect(basculeImmeubleNeuf({ ...budgetVide(), requalification: { acheveMoinsDe5Ans: true } }).immeubleNeuf).toBe(true);
  });
  it("surface de plancher augmentée de plus de 10 %", () => {
    expect(basculeImmeubleNeuf({ ...budgetVide(), requalification: { augmentationSurfacePct: 0.1 } }).immeubleNeuf).toBe(false);
    expect(basculeImmeubleNeuf({ ...budgetVide(), requalification: { augmentationSurfacePct: 0.15 } }).immeubleNeuf).toBe(true);
  });
  it("auto : logement ancien exonéré, terrain à bâtir à la marge", () => {
    const h = { ...hypothesesParDefaut(), regimeTVA: "auto" as const, lots: [{ libelle: "Lot", prixDown: 200000, prixTop: 200000, tva: 0 }], prixAcquisition: 120000 };
    expect(calculerBilan(h).regimeApplique).toBe("exoneration");
    expect(calculerBilan({ ...h, natureOperation: "terrain_a_batir" }).regimeApplique).toBe("marge");
  });
});

describe("devis à partir des pièces", () => {
  const plan = (): PlanTravaux => ({
    ...planParDefaut(),
    surface: 65,
    pieces: [
      { id: "1", type: "sejour", surface: 25, etat: "refaire" },
      { id: "2", type: "cuisine", surface: 8, etat: "refaire" },
      { id: "3", type: "salle_de_bain", surface: 5, etat: "refaire" },
      { id: "4", type: "wc", surface: 2, etat: "renover" },
      { id: "5", type: "chambre", surface: 12, etat: "rafraichir" },
      { id: "6", type: "chambre", surface: 13, etat: "bon" },
    ],
  });
  it("propose les bons lots et calcule les % rénovés", () => {
    const p = proposerTravaux(plan(), 65);
    const ids = p.lignes.map((l) => l.id);
    expect(ids).toEqual(expect.arrayContaining(["sdb", "cuisine", "wc", "electricite", "peinture", "demolition"]));
    expect(p.lignes.find((l) => l.id === "electricite")!.quantite).toBe(40); // séjour, cuisine, sdb, wc
    expect(p.pct.sanitaires).toBe(1);
    expect(p.pct.cloisons).toBeCloseTo(38 / 65, 3);
    expect(p.forfaitConseille).toBe("global");
  });
  it("reporte les montants par poste dans le bilan, TVA comprise", () => {
    const pl = plan();
    const p = proposerTravaux(pl, 65);
    pl.lignes = p.lignes;
    const r = reportDevis(base(), pl, p.pct, 65);
    const total = chiffrer(pl.lignes, "moyen").reduce((s, l) => s + l.ttc, 0);
    expect(r.total).toBeCloseTo(total, 6);
    const h = { ...hypothesesParDefaut(), travaux: r.travaux };
    const b = calculerBilan(h);
    expect(b.technique.grosEtSecondOeuvre.ttc).toBeCloseTo(total, -1);
    expect(r.travaux.secondOeuvre.sanitaires.montantTTC).toBe(Math.round(5200 + 520 + 1200 * 4));
    expect(b.bascule.immeubleNeuf).toBe(false);
  });
  it("électricité et chauffage globaux, simple vitrage", () => {
    const pl = plan();
    pl.general = { ...pl.general, electricite: "a_refaire", chauffage: "electrique_ancien", menuiseries: "simple_vitrage", nbFenetres: 6 };
    const p = proposerTravaux(pl, 65);
    expect(p.lignes.find((l) => l.id === "electricite")!.quantite).toBe(65);
    expect(p.lignes.find((l) => l.id === "fenetre")!.quantite).toBe(6);
    expect(p.lignes.find((l) => l.id === "pac-multi")!.quantite).toBe(1);
    expect(p.lignes.find((l) => l.id === "pac-mono")!.quantite).toBe(1);
    expect(p.pct).toMatchObject({ electricite: 1, chauffage: 1, huisseries: 1 });
  });
});

describe("démarches", () => {
  it("division : DP, géomètre et notaire, stationnement, réseaux", () => {
    const pl = { ...planParDefaut(), projet: { ...projetParDefaut(), division: true, nbLots: 3 } };
    const ids = demarches(pl, ctx()).map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(["division", "copro-creation", "stationnement", "enedis", "eau"]));
  });
  it("secteur patrimonial → ABF ; appartement → syndic", () => {
    const ids = demarches(planParDefaut(), ctx({ secteurPatrimonial: true, typeBien: "Appartement" })).map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(["abf", "syndic"]));
  });
  it("surface créée : DP jusqu'à 40 m² en zone U, permis au-delà", () => {
    const pl = (s: number) => ({ ...planParDefaut(), projet: { ...projetParDefaut(), surfaceCreee: s } });
    expect(demarches(pl(30), ctx({ zonePLU: "UA" })).find((d) => d.id === "surface")!.titre).toMatch(/Déclaration préalable/);
    expect(demarches(pl(30), ctx({ zonePLU: "AU" })).find((d) => d.id === "surface")!.titre).toMatch(/Permis de construire/);
  });
  it("division foncière avec voie → permis d'aménager", () => {
    const pl = { ...planParDefaut(), projet: { ...projetParDefaut(), divisionFonciere: true, voieCommune: true } };
    expect(demarches(pl, ctx()).find((d) => d.id === "division-fonciere")!.titre).toMatch(/Permis d'aménager/);
  });
});

describe("analyse d'une description dictée", () => {
  it("pièces, nombres en lettres et états", () => {
    const c = analyserDescription("T3 de 65 m², cuisine et salle de bain à refaire, deux chambres à rafraîchir, séjour en bon état");
    expect(c.typologie).toBe(3);
    expect(c.surface).toBe(65);
    const n = (type: string, etat: string) => c.pieces.filter((p) => p.type === type && p.etat === etat).length;
    expect(n("cuisine", "refaire")).toBe(1);
    expect(n("salle_de_bain", "refaire")).toBe(1);
    expect(n("chambre", "rafraichir")).toBe(2);
    expect(n("sejour", "bon")).toBe(1);
  });
  it("surfaces des pièces", () => {
    const c = analyserDescription("une chambre de 12 mètres carrés à rénover");
    expect(c.pieces).toHaveLength(1);
    expect(c.pieces[0]).toMatchObject({ type: "chambre", surface: 12, etat: "renover" });
    expect(c.surface).toBeUndefined();
  });
  it("éléments généraux", () => {
    const c = analyserDescription("Électricité pas aux normes, simple vitrage avec 6 fenêtres, chauffage électrique par convecteurs, construit en 1965, DPE F");
    expect(c.general).toMatchObject({ electricite: "a_refaire", menuiseries: "simple_vitrage", nbFenetres: 6, chauffage: "electrique_ancien", anneeConstruction: 1965 });
    expect(c.dpe).toBe("F");
  });
  it("options du projet", () => {
    const c = analyserDescription("Division en trois lots, création de 2 places de parking, extension de 25 m2, fosse septique, gamme moyenne");
    expect(c.projet).toMatchObject({ division: true, nbLots: 3, placesParking: 2, surfaceCreee: 25, assainissement: "fosse" });
    expect(c.gamme).toBe("moyen");
  });
  it("typologie seule avec état global", () => {
    const c = analyserDescription("Appartement T2 tout à refaire, ouvrir le mur porteur de la cuisine");
    expect(c.forfait).toBe("rehabilitation");
    expect(c.pieces.length).toBeGreaterThanOrEqual(5);
    expect(c.general.structure).toBe("a_reprendre");
  });
  it("texte d'annonce", () => {
    const c = analyserDescription("Maison de village à rénover, double vitrage, tout à l'égout, copropriété de 4 lots");
    expect(c.forfait).toBe("global");
    expect(c.general.menuiseries).toBe("ok");
    expect(c.projet).toMatchObject({ assainissement: "collectif", copropriete: true });
  });
});
