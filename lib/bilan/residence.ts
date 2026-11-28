// Comparatif « résidence principale en flip » : le même bien acheté en nom propre,
// habité puis revendu, avec la plus-value exonérée (art. 150 U, II-1° du CGI).
// Pas de société, donc ni TVA ni impôt sur les sociétés ; frais de notaire de droit commun.
// Financement : apport personnel + prêt immobilier amortissable (15 à 25 ans), remboursé par anticipation à la revente.
import { calculerBilan } from "./calcul";
import type { Hypotheses, ScenarioRevente } from "./types";

export interface OptionsRP {
  /** Frais de notaire dans l'ancien, sans engagement de revente (≈ 7,5 %). */
  tauxNotaire: number;
  /** Apport personnel (fonds propres) investi dans l'achat. */
  apport: number;
  /** Durée du prêt immobilier, en années (15, 20 ou 25). */
  dureePretAns: number;
  /** Taux nominal annuel du prêt immobilier. */
  tauxPret: number;
  /** Assurance emprunteur, en taux annuel sur le capital emprunté. */
  tauxAssurance: number;
  /** Frais de garantie du prêt (caution ou hypothèque), en % du prêt. */
  tauxGarantie: number;
  /** Frais de dossier bancaires. */
  fraisDossier: number;
  /** Durée de détention avant revente, en mois. */
  dureeDetentionMois: number;
  /** Indemnités de remboursement anticipé négociées à zéro. */
  iraNegociees: boolean;
  /** Taxe foncière + charges de copropriété + assurance habitation, par mois. */
  chargesMensuelles: number;
  /** Loyer que l'on n'a pas à payer en habitant le bien, par mois (gain indirect). */
  loyerEvite: number;
  /** Diagnostics et autres frais de vente hors agence. */
  fraisRevente: number;
  /** Ancien champ (montant de garantie en €) : remplacé par tauxGarantie, conservé pour les projets enregistrés. */
  fraisGarantie?: number;
  /** Ancien champ (IRA saisies en €) : désormais calculées. */
  ira?: number;
}

/** Taux d'endettement maximum (HCSF), assurance comprise. */
export const TAUX_ENDETTEMENT_MAX = 0.35;

export function optionsRPParDefaut(): OptionsRP {
  return {
    tauxNotaire: 0.075, apport: 0, dureePretAns: 20, tauxPret: 0.034, tauxAssurance: 0.003, tauxGarantie: 0.01, fraisDossier: 1000,
    dureeDetentionMois: 24, iraNegociees: false, chargesMensuelles: 0, loyerEvite: 0, fraisRevente: 0,
  };
}

/** Complète des options enregistrées avant l'ajout du financement bancaire. */
export function completerOptionsRP(o: Partial<OptionsRP> | undefined | null): OptionsRP {
  return { ...optionsRPParDefaut(), ...(o ?? {}) };
}

/** Mensualité d'un prêt amortissable (hors assurance). */
export function mensualite(capital: number, tauxAnnuel: number, dureeMois: number): number {
  if (capital <= 0 || dureeMois <= 0) return 0;
  const t = tauxAnnuel / 12;
  if (!t) return capital / dureeMois;
  return (capital * t) / (1 - Math.pow(1 + t, -dureeMois));
}

/** Intérêts payés et capital restant dû après n mensualités. */
export function amortissement(capital: number, tauxAnnuel: number, dureeMois: number, nMois: number): { interets: number; capitalRembourse: number; capitalRestant: number; mensualite: number } {
  const m = mensualite(capital, tauxAnnuel, dureeMois);
  const t = tauxAnnuel / 12;
  let crd = capital;
  let interets = 0;
  for (let i = 0; i < Math.min(nMois, dureeMois); i++) {
    const it = crd * t;
    interets += it;
    crd -= m - it;
  }
  crd = Math.max(0, crd);
  return { interets, capitalRembourse: capital - crd, capitalRestant: crd, mensualite: m };
}

/** IRA au plafond légal (art. R313-25 C. conso.) : 6 mois d'intérêts au taux du prêt, dans la limite de 3 % du capital restant dû. */
export function iraLegales(capitalRestant: number, tauxAnnuel: number): number {
  return Math.min(capitalRestant * tauxAnnuel / 2, capitalRestant * 0.03);
}

export interface ResultatRP {
  prixAcquisition: number;
  notaire: number;
  apporteur: number;
  travaux: number; // coût technique TTC, aléas compris (aucune TVA récupérable)
  banque: {
    coutProjet: number; // prix + notaire + travaux + garantie + dossier
    apport: number;
    montantEmprunte: number;
    mensualite: number; // hors assurance
    assuranceMensuelle: number;
    mensualiteTotale: number;
    revenuMinimum: number; // revenu net mensuel pour rester à 35 % d'endettement
    capitalRestantRevente: number;
    alertes: string[];
  };
  financement: { interets: number; assurance: number; garantie: number; dossier: number; ira: number; total: number };
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
  /** Trésorerie mobilisée : apport + mensualités payées pendant la détention. */
  cashMobilise: number;
  /** Ce qui revient à la revente : prix de vente − capital restant dû − IRA − frais de vente. */
  netAuRemboursement: number;
  rendementApport: number | null;
  gainParMois: number | null;
  dureeMois: number;
}

export function calculerResidencePrincipale(h: Hypotheses, options: OptionsRP): ResultatRP {
  const rp = completerOptionsRP(options);
  const b = calculerBilan(h); // on réutilise le coût technique et les recettes calculés à l'identique
  const duree = rp.dureeDetentionMois;
  const notaire = h.prixAcquisition * rp.tauxNotaire;
  const travaux = b.technique.total.ttc;
  const revente = b.recettes.chiffreAffaires;

  // ----- Banque : le prêt couvre ce que l'apport ne couvre pas (garantie et dossier compris)
  const avantFinancement = h.prixAcquisition + notaire + h.apporteurAffaires + travaux;
  const besoinHorsFrais = Math.max(0, avantFinancement - rp.apport);
  const montantEmprunte = besoinHorsFrais > 0 ? (besoinHorsFrais + rp.fraisDossier) / (1 - rp.tauxGarantie) : 0;
  const garantie = montantEmprunte * rp.tauxGarantie;
  const dossier = montantEmprunte > 0 ? rp.fraisDossier : 0;
  const dureePretMois = rp.dureePretAns * 12;
  const am = amortissement(montantEmprunte, rp.tauxPret, dureePretMois, duree);
  const assuranceMensuelle = (montantEmprunte * rp.tauxAssurance) / 12;
  const assurance = assuranceMensuelle * Math.min(duree, dureePretMois);
  const ira = rp.iraNegociees ? 0 : iraLegales(am.capitalRestant, rp.tauxPret);
  const financementTotal = am.interets + assurance + garantie + dossier + ira;

  const charges = rp.chargesMensuelles * duree;
  const fraisVente = b.honorairesVente.ttc + rp.fraisRevente;
  const coutTotal = avantFinancement + financementTotal + charges + fraisVente;
  const gainNet = revente - coutTotal;
  const loyerEconomise = rp.loyerEvite * duree;
  const mensualiteTotale = am.mensualite + assuranceMensuelle;

  const alertes: string[] = [];
  const fraisAnnexes = notaire + garantie + dossier;
  if (rp.apport < fraisAnnexes) alertes.push(`Apport inférieur aux frais (notaire, garantie, dossier : ${Math.round(fraisAnnexes).toLocaleString("fr-FR")} €) : la plupart des banques demandent au moins ce montant.`);
  if (rp.dureePretAns > 25) alertes.push("Durée supérieure à 25 ans : hors des règles du HCSF.");
  if (montantEmprunte > 0 && rp.apport === 0) alertes.push("Aucun apport : financement à 110 % rarement accordé, prévois des fonds propres.");

  return {
    prixAcquisition: h.prixAcquisition,
    notaire,
    apporteur: h.apporteurAffaires,
    travaux,
    banque: {
      coutProjet: avantFinancement + garantie + dossier,
      apport: rp.apport,
      montantEmprunte,
      mensualite: am.mensualite,
      assuranceMensuelle,
      mensualiteTotale,
      revenuMinimum: mensualiteTotale / TAUX_ENDETTEMENT_MAX,
      capitalRestantRevente: am.capitalRestant,
      alertes,
    },
    financement: { interets: am.interets, assurance, garantie, dossier, ira, total: financementTotal },
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
    cashMobilise: rp.apport + mensualiteTotale * Math.min(duree, dureePretMois),
    netAuRemboursement: revente - am.capitalRestant - ira - fraisVente,
    rendementApport: rp.apport > 0 ? gainNet / rp.apport : null,
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
