import { calculerFinancement } from "./financement";
import type { BudgetTravaux, Hypotheses, LigneMontant, PosteTravaux, ResultatBilan, ScenarioRevente } from "./types";

const ligne = (ttc: number, tva: number): LigneMontant => ({ ttc, tva });
const sommeLignes = (...l: LigneMontant[]): LigneMontant =>
  ligne(l.reduce((s, x) => s + x.ttc, 0), l.reduce((s, x) => s + x.tva, 0));
const div = (a: number, b: number) => (b ? a / b : 0);

/**
 * TVA incluse dans un montant TTC (formule IFS de l'onglet « Budget travaux » : E/(100+t)*t).
 * Note : pour le taux de 2,1 %, l'Excel calcule E/102,1 sans multiplier par 2,1 ; on applique ici la formule correcte.
 */
export function tvaIncluse(ttc: number, taux: number): number {
  if (!taux) return 0;
  return (ttc / (1 + taux)) * taux;
}

const tvaPoste = (p: PosteTravaux) => ligne(p.montantTTC, tvaIncluse(p.montantTTC, p.tauxTVA));

/** Règle BOFIP (cellule B45) : bascule en « immeuble neuf » et donc TVA sur le prix total. */
export function basculeImmeubleNeuf(t: BudgetTravaux): { immeubleNeuf: boolean; raison: string } {
  const go = t.grosOeuvre;
  const grosOeuvre = [
    ["fondations", go.fondations],
    ["éléments de structure", go.structure],
    ["façades", go.facades],
  ] as const;
  const g = grosOeuvre.find(([, p]) => (p.pctRenove ?? 0) >= 0.5);
  if (g) return { immeubleNeuf: true, raison: `Gros œuvre : ${g[0]} rénové(es) à 50 % ou plus` };
  const so = Object.values(t.secondOeuvre);
  if (so.every((p) => (p.pctRenove ?? 0) >= 0.66))
    return { immeubleNeuf: true, raison: "Les 6 postes de second œuvre sont rénovés à 66 % ou plus" };
  return { immeubleNeuf: false, raison: "" };
}

export function totauxTravaux(t: BudgetTravaux) {
  const go = Object.values(t.grosOeuvre).map(tvaPoste);
  const so = Object.values(t.secondOeuvre).map(tvaPoste);
  const grosEtSecond = sommeLignes(...go, ...so); // E36 / G36
  const neufs = ligne(t.surelevation + t.extension, (t.surelevation + t.extension) / 120 * 20); // E51 / G51
  return {
    sousTotalGrosOeuvre: sommeLignes(...go), // E16
    sousTotalSecondOeuvre: sommeLignes(...so), // E35
    grosEtSecond,
    honoraires: tvaPoste(t.honorairesTechniques), // E39 / G39
    raccordements: tvaPoste(t.raccordements), // E40 / G40
    voirie: tvaPoste(t.voirie), // E46 / G44
    neufs,
  };
}

export function fraisFinanciers(h: Hypotheses): number {
  const f = h.financement;
  if (f.fraisFinanciersManuels != null) return f.fraisFinanciersManuels;
  if (f.sources?.length) return calculerFinancement(f.sources, f.dureeMois).totalFrais;
  return f.montantEmprunte * f.tauxAnnuel * (f.dureeMois / 12) + f.fraisDossier;
}

export function prixLot(l: { prixDown: number | null; prixTop: number | null }, s: ScenarioRevente): number {
  const vals = [l.prixDown, l.prixTop].filter((v): v is number => v != null && !Number.isNaN(v));
  if (s === "down") return l.prixDown ?? l.prixTop ?? 0;
  if (s === "top") return l.prixTop ?? l.prixDown ?? 0;
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0; // AVERAGE(B,C) avec IFERROR → 0
}

/** Honoraires de vente : montant saisi (cellule D31) ou % d'agence sur le CA, plus les frais de vente détaillés. */
export function honorairesVenteTTC(h: Hypotheses, ca: number): number {
  const fv = h.fraisVente;
  if (!fv) return h.honorairesVente;
  const agence = fv.agencePct != null ? ca * fv.agencePct : h.honorairesVente;
  return agence + fv.diagnostics + fv.mainlevee + fv.homeStaging + fv.autres;
}

/** Calcul complet du bilan prévisionnel (onglet « BP en phase faisabilité »). */
export function calculerBilan(h: Hypotheses): ResultatBilan {
  // ---- ACHAT + CHARGE FONCIÈRE (lignes 6 à 10)
  const acquisition = ligne(h.prixAcquisition, h.tvaAcquisition);
  const eviction = ligne(h.indemniteEviction, h.tvaIndemniteEviction);
  const notaireTTC = h.prixAcquisition * h.tauxNotaire;
  const notaire = ligne(notaireTTC, (notaireTTC / 107.5) * 7.5);
  const apporteur = ligne(h.apporteurAffaires, (h.apporteurAffaires / 120) * 20);
  const foncier = sommeLignes(acquisition, eviction, notaire, apporteur);

  // ---- TECHNIQUE (lignes 12 à 19)
  const tt = totauxTravaux(h.travaux);
  const ameublement = ligne(h.ameublement, (h.ameublement / 120) * 20);
  const baseAleas = tt.grosEtSecond.ttc + tt.voirie.ttc + tt.neufs.ttc + h.ameublement + tt.honoraires.ttc;
  const aleasTTC = baseAleas * h.tauxAleas;
  const aleas = ligne(aleasTTC, (aleasTTC / 120) * 20);
  const technique = sommeLignes(tt.voirie, tt.grosEtSecond, tt.neufs, ameublement, aleas, tt.honoraires, tt.raccordements);

  // ---- HONORAIRES DIVERS (lignes 21 à 24)
  const hd = [h.honorairesGestion, h.fraisComptabilite, h.fraisJustice];
  const honorairesDivers = sommeLignes(...hd.map((v) => ligne(v, (v / 120) * 20)));

  // ---- FRAIS DIVERS hors TVA (lignes 26 à 29)
  const financiers = fraisFinanciers(h);
  const fraisDiversTotal = financiers + h.gfa + h.assuranceDO;

  // ---- BFR et charge totale (lignes 30 à 32)
  const bfr = ligne(fraisDiversTotal + honorairesDivers.ttc + technique.ttc + foncier.ttc, honorairesDivers.tva + technique.tva + foncier.tva);
  // ---- RECETTES (lignes 34 à 39)
  const lots = h.lots.map((l) => ({ libelle: l.libelle, prix: prixLot(l, h.scenario), tva: l.tva }));
  const ca = lots.reduce((s, l) => s + l.prix, 0);

  const hv = honorairesVenteTTC(h, ca);
  const honorairesVente = ligne(hv, (hv / 120) * 20);
  const tvaVentes = lots.reduce((s, l) => s + l.tva, 0);

  // ---- RÉSUMÉ (lignes 41 à 55)
  const bascule = basculeImmeubleNeuf(h.travaux);
  const regime = bascule.immeubleNeuf ? "total" : h.regimeTVA;
  const margeBrute = ca - foncier.ttc; // D43
  const tvaPrixTotal = regime === "total" ? ca - ca / 1.2 : 0; // D45
  const tvaSurMarge = regime === "marge" ? margeBrute - margeBrute / 1.2 : 0; // D47
  const tvaRecuperable = regime === "exoneration" ? 0 : bfr.tva + honorairesVente.tva + tvaVentes; // D48 (fidèle à l'Excel)
  const tvaDue = regime === "marge" ? tvaSurMarge - tvaRecuperable : regime === "total" ? tvaPrixTotal - tvaRecuperable : 0; // D49
  const margeNetteDeTVA = regime === "exoneration" ? margeBrute : margeBrute - tvaDue; // D50

  let beneficeBrut: number; // D51
  if (regime === "marge") beneficeBrut = margeNetteDeTVA - technique.ttc - honorairesDivers.ttc - fraisDiversTotal - honorairesVente.ttc;
  else if (regime === "total") beneficeBrut = ca - bfr.ttc - honorairesVente.ttc - tvaPrixTotal + tvaRecuperable;
  else beneficeBrut = ca - bfr.ttc - honorairesVente.ttc;

  // Impôt sur les sociétés : 15 % jusqu'à 42 500 €, 25 % au-delà. Pas d'impôt négatif en cas de perte.
  const base = Math.max(0, beneficeBrut);
  const isTaux15 = Math.min(base, 42500) * 0.15;
  const isTaux25 = Math.max(0, base - 42500) * 0.25;
  const impot = isTaux15 + isTaux25;
  const beneficeNet = beneficeBrut - impot;

  const partJV = h.financement.sources?.length ? calculerFinancement(h.financement.sources, h.financement.dureeMois).partBeneficeJV : 0;
  const partageJV = Math.max(0, beneficeNet) * partJV;

  const prixRevient = bfr.ttc + honorairesVente.ttc + Math.max(0, tvaDue);
  const t = h.travaux;
  return {
    foncier: { acquisition, eviction, notaire, apporteur, total: foncier },
    technique: {
      voirie: tt.voirie,
      grosEtSecondOeuvre: tt.grosEtSecond,
      travauxNeufs: tt.neufs,
      ameublement,
      aleas,
      honorairesTechniques: tt.honoraires,
      raccordements: tt.raccordements,
      total: technique,
    },
    honorairesDivers,
    fraisDivers: { financiers, gfa: h.gfa, assuranceDO: h.assuranceDO, total: fraisDiversTotal },
    bfr,
    honorairesVente,
    recettes: { lots, chiffreAffaires: ca, tva: tvaVentes },
    bascule,
    regimeApplique: regime,
    margeBruteTTC: margeBrute,
    tvaPrixTotal,
    tvaSurMarge,
    tvaRecuperable,
    tvaDue,
    margeNetteDeTVA,
    beneficeBrut,
    margeSurCA: div(beneficeBrut, ca),
    isTaux15,
    isTaux25,
    impot,
    beneficeNet,
    prixRevient,
    margeSurPrixRevient: div(beneficeBrut, prixRevient),
    rendementFondsPropres: h.apport > 0 ? beneficeNet / h.apport : null,
    partageJV,
    beneficeNetSociete: beneficeNet - partageJV,
    ratios: {
      prixAchatM2Carrez: div(h.prixAcquisition, t.surfaceCarrez),
      prixAchatM2Total: div(h.prixAcquisition, t.surfaceTotale),
      // L'Excel écrit D19-E19/F5 ; on calcule le coût HT au m², (D19-E19)/F5, qui est l'intention de la cellule.
      coutTravauxHTM2Carrez: div(technique.ttc - technique.tva, t.surfaceCarrez),
      coutTravauxHTM2Total: div(technique.ttc - technique.tva, t.surfaceTotale),
      prixVenteM2Carrez: div(ca, t.surfaceCarrez),
      prixVenteM2Total: div(ca, t.surfaceTotale),
    },
  };
}
