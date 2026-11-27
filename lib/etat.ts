// État complet d'une analyse, partagé entre les onglets et enregistré dans le projet.
import { hypothesesParDefaut } from "./bilan/defaut";
import { optionsRPParDefaut, type OptionsRP } from "./bilan/residence";
import { profilParDefaut, type ProfilMdB } from "./bilan/profil";
import type { Hypotheses } from "./bilan/types";
import type { Offre } from "./projets";

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
}

export const caracteristiquesVides = (): Caracteristiques => ({ type: "Maison", surface: null, terrain: null, pieces: null, etage: "", ascenseur: "", dpe: "", etat: "", notes: "" });
export const coutsTechniquesVides = (): CoutsTechniques => ({ geometre: 0, architecte: 0, bet: 0, diagnosticsAchat: 0, autresTechniques: 0, huissier: 0, avocat: 0 });

export function etatParDefaut(): EtatAnalyse {
  const h = hypothesesParDefaut();
  h.financement.sources = [];
  h.fraisVente = { agencePct: null, diagnostics: 0, mainlevee: 0, homeStaging: 0, autres: 0 };
  return {
    hypotheses: h, prixAffiche: 0, margeCible: 0.15, historique: [], rp: optionsRPParDefaut(), profil: profilParDefaut(),
    caracteristiques: caracteristiquesVides(), coutsTechniques: coutsTechniquesVides(),
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
