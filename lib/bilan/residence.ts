// Comparatif « résidence principale en flip » : le même bien acheté en nom propre,
// habité puis revendu, avec la plus-value exonérée (art. 150 U, II-1° du CGI).
// Pas de société, donc ni TVA ni impôt sur les sociétés ; frais de notaire de droit commun.
import { calculerBilan, fraisFinanciers } from "./calcul";
import type { Hypotheses, ScenarioRevente } from "./types";

export interface OptionsRP {
  /** Frais de notaire dans l'ancien, sans engagement de revente (≈ 7,5 %). */
  tauxNotaire: number;
  /** Assurance emprunteur, en taux annuel sur le capital emprunté. */
  tauxAssurance: number;
  /** Frais de garantie du prêt (caution ou hypothèque). */
  fraisGarantie: number;
  /** Indemnités de remboursement anticipé à la revente. */
  ira: number;
  /** Taxe foncière + charges de copropriété + assurance habitation, par mois. */
  chargesMensuelles: number;
  /** Loyer que l'on n'a pas à payer en habitant le bien, par mois (gain indirect). */
  loyerEvite: number;
  /** Diagnostics et autres frais de vente hors agence. */
  fraisRevente: number;
}

export function optionsRPParDefaut(): OptionsRP {
  return { tauxNotaire: 0.075, tauxAssurance: 0.003, fraisGarantie: 0, ira: 0, chargesMensuelles: 0, loyerEvite: 0, fraisRevente: 0 };
}

export interface ResultatRP {
  prixAcquisition: number;
  notaire: number;
  apporteur: number;
  travaux: number; // coût technique TTC, aléas compris (aucune TVA récupérable)
  financement: { interets: number; assurance: number; garantieEtIra: number; total: number };
  charges: number;
  fraisVente: number;
  coutTotal: number;
  revente: number;
  plusValueBrute: number; // revente − (prix + notaire + travaux), base indicative
  impotPlusValue: number; // 0 : exonération résidence principale
  gainNet: number;
  loyerEconomise: number;
  gainAvecLoyer: number;
  margeSurRevente: number;
  rendementApport: number | null;
  gainParMois: number | null;
  dureeMois: number;
}

export function calculerResidencePrincipale(h: Hypotheses, rp: OptionsRP): ResultatRP {
  const b = calculerBilan(h); // on réutilise le coût technique et les recettes calculés à l'identique
  const duree = h.financement.dureeMois;
  const notaire = h.prixAcquisition * rp.tauxNotaire;
  const interets = fraisFinanciers(h); // emprunt × taux × durée + frais de dossier (ou saisie manuelle)
  const assurance = h.financement.montantEmprunte * rp.tauxAssurance * (duree / 12);
  const garantieEtIra = rp.fraisGarantie + rp.ira;
  const financementTotal = interets + assurance + garantieEtIra;
  const charges = rp.chargesMensuelles * duree;
  const fraisVente = h.honorairesVente + rp.fraisRevente;
  const travaux = b.technique.total.ttc;
  const revente = b.recettes.chiffreAffaires;
  const coutTotal = h.prixAcquisition + notaire + h.apporteurAffaires + travaux + financementTotal + charges + fraisVente;
  const gainNet = revente - coutTotal;
  const loyerEconomise = rp.loyerEvite * duree;
  return {
    prixAcquisition: h.prixAcquisition,
    notaire,
    apporteur: h.apporteurAffaires,
    travaux,
    financement: { interets, assurance, garantieEtIra, total: financementTotal },
    charges,
    fraisVente,
    coutTotal,
    revente,
    plusValueBrute: revente - (h.prixAcquisition + notaire + travaux),
    impotPlusValue: 0,
    gainNet,
    loyerEconomise,
    gainAvecLoyer: gainNet + loyerEconomise,
    margeSurRevente: revente ? gainNet / revente : 0,
    rendementApport: h.apport > 0 ? gainNet / h.apport : null,
    gainParMois: duree > 0 ? gainNet / duree : null,
    dureeMois: duree,
  };
}

/** Prix d'achat maximum en résidence principale pour atteindre une marge (gain net / prix de revente). */
export function prixMaxRP(h: Hypotheses, rp: OptionsRP, margeCible: number, scenario?: ScenarioRevente): number | null {
  const m = (p: number) => calculerResidencePrincipale({ ...h, prixAcquisition: p, scenario: scenario ?? h.scenario }, rp).margeSurRevente;
  if (m(0) < margeCible) return null;
  let lo = 0;
  let hi = Math.max(100000, h.prixAcquisition * 2);
  while (m(hi) >= margeCible && hi < 1e10) hi *= 2;
  while (hi - lo > 1) {
    const mid = (lo + hi) / 2;
    if (m(mid) >= margeCible) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo);
}
