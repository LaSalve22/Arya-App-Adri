// État complet d'une analyse, partagé entre les onglets et enregistré dans le projet.
import { hypothesesParDefaut } from "./bilan/defaut";
import { optionsRPParDefaut, type OptionsRP } from "./bilan/residence";
import { profilParDefaut, type ProfilMdB } from "./bilan/profil";
import type { Hypotheses } from "./bilan/types";
import { totauxTravaux } from "./bilan/calcul";
import type { Offre } from "./projets";
import { planParDefaut, type PlanTravaux } from "./travaux/plan";

export interface Caracteristiques {
  type: string;
  surface: number | null;
  terrain: number | null;
  pieces: number | null;
  etage: string;
  ascenseur: "oui" | "non" | "";
  dpe: string;
  etat: string; // à rénover, rafraîchir, bon état…
  notes: string;
}

/** Détail des coûts techniques, reporté dans les champs de l'Excel (honoraires techniques, frais de justice). */
export interface CoutsTechniques {
  geometre: number;
  architecte: number;
  bet: number;
  diagnosticsAchat: number;
  autresTechniques: number;
  huissier: number;
  avocat: number;
}

export interface EtatAnalyse {
  hypotheses: Hypotheses;
  prixAffiche: number;
  margeCible: number;
  historique: Offre[];
  rp: OptionsRP;
  profil: ProfilMdB;
  caracteristiques: Caracteristiques;
  coutsTechniques: CoutsTechniques;
  /** État des pièces, forfait ou devis détaillé, options du projet (onglet Travaux). */
  travauxPlan: PlanTravaux;
  /** Coûts saisis en % du montant des travaux : recalculés à chaque changement des travaux. */
  coutsPct?: Partial<Record<CleCout, number>>;
}

/** Coûts de l'onglet « Coûts techniques » qui peuvent être exprimés en % des travaux. */
export type CleCout = keyof CoutsTechniques | "honorairesGestion" | "fraisComptabilite" | "assuranceDO" | "gfa";

export const caracteristiquesVides = (): Caracteristiques => ({ type: "Maison", surface: null, terrain: null, pieces: null, etage: "", ascenseur: "", dpe: "", etat: "", notes: "" });
export const coutsTechniquesVides = (): CoutsTechniques => ({ geometre: 0, architecte: 0, bet: 0, diagnosticsAchat: 0, autresTechniques: 0, huissier: 0, avocat: 0 });

export function etatParDefaut(): EtatAnalyse {
  const h = hypothesesParDefaut();
  h.financement.sources = [];
  h.fraisVente = { agencePct: null, diagnostics: 0, mainlevee: 0, homeStaging: 0, autres: 0 };
  // Régime de TVA déduit du projet : exonération pour un logement ancien, prix total si les travaux le requalifient en neuf.
  h.regimeTVA = "auto";
  // Frais de notaire marchand de biens : 4,5 % par prudence (3 % est le minimum de l'Excel).
  h.tauxNotaire = 0.045;
  h.natureOperation = "logement_ancien";
  return {
    hypotheses: h, prixAffiche: 0, margeCible: 0.15, historique: [], rp: optionsRPParDefaut(), profil: profilParDefaut(),
    caracteristiques: caracteristiquesVides(), coutsTechniques: coutsTechniquesVides(), travauxPlan: planParDefaut(),
  };
}

/** Reporte le détail des coûts techniques dans les champs du bilan. */
export function appliquerCoutsTechniques(h: Hypotheses, c: CoutsTechniques): Hypotheses {
  return {
    ...h,
    fraisJustice: c.huissier + c.avocat,
    travaux: {
      ...h.travaux,
      honorairesTechniques: { ...h.travaux.honorairesTechniques, montantTTC: c.geometre + c.architecte + c.bet + c.diagnosticsAchat + c.autresTechniques },
    },
  };
}

/** Base des coûts en % : montant des travaux TTC (gros œuvre, second œuvre, finitions, voirie, surélévation, extension), hors aléas et honoraires. */
export function baseTravaux(h: Hypotheses): number {
  const t = totauxTravaux(h.travaux);
  return t.grosEtSecond.ttc + t.neufs.ttc + t.voirie.ttc;
}

const CLES_HYPOTHESES = ["honorairesGestion", "fraisComptabilite", "assuranceDO", "gfa"] as const;

/** Recalcule les coûts saisis en % des travaux, puis les reporte dans le bilan. Sans % saisi, l'état est rendu tel quel. */
export function synchroniserPourcentages(e: EtatAnalyse): EtatAnalyse {
  const p = e.coutsPct;
  if (!p || !Object.values(p).some((v) => v != null)) return e;
  const base = baseTravaux(e.hypotheses);
  const c: CoutsTechniques = { ...e.coutsTechniques };
  let h: Hypotheses = { ...e.hypotheses };
  for (const [k, v] of Object.entries(p) as [CleCout, number | undefined][]) {
    if (v == null) continue;
    const montant = Math.round(v * base);
    if ((CLES_HYPOTHESES as readonly string[]).includes(k)) h = { ...h, [k]: montant };
    else c[k as keyof CoutsTechniques] = montant;
  }
  h = appliquerCoutsTechniques(h, c);
  return { ...e, coutsTechniques: c, hypotheses: h };
}
