import type { BudgetTravaux, Hypotheses, PosteTravaux } from "./types";

const poste = (tauxTVA = 0.1): PosteTravaux => ({ montantTTC: 0, tauxTVA, pctRenove: 0 });

export function budgetVide(): BudgetTravaux {
  return {
    surfaceTotale: 0,
    surfaceCarrez: 0,
    grosOeuvre: { fondations: poste(0.2), structure: poste(0.2), facades: poste(0.2) },
    secondOeuvre: {
      huisseries: poste(),
      cloisons: poste(),
      sanitaires: poste(),
      chauffage: poste(),
      electricite: poste(),
      planchers: poste(),
    },
    honorairesTechniques: poste(0.2),
    raccordements: poste(0.2),
    voirie: poste(0.2),
    surelevation: 0,
    extension: 0,
  };
}

/** Hypothèses par défaut, reprenant les valeurs de l'Excel (notaire 3 %, aléas 6 %, TVA sur marge). */
export function hypothesesParDefaut(): Hypotheses {
  return {
    prixAcquisition: 0,
    tvaAcquisition: 0,
    indemniteEviction: 0,
    tvaIndemniteEviction: 0,
    tauxNotaire: 0.03,
    apporteurAffaires: 0,
    travaux: budgetVide(),
    ameublement: 0,
    tauxAleas: 0.06,
    honorairesGestion: 0,
    fraisComptabilite: 0,
    fraisJustice: 0,
    financement: { montantEmprunte: 0, tauxAnnuel: 0.045, dureeMois: 12, fraisDossier: 0, fraisFinanciersManuels: null },
    gfa: 0,
    assuranceDO: 0,
    honorairesVente: 0,
    lots: [{ libelle: "Lot 1", prixDown: null, prixTop: null, tva: 0 }],
    scenario: "moyen",
    regimeTVA: "marge",
    apport: 0,
  };
}

export const LIBELLES_POSTES: Record<string, string> = {
  fondations: "Fondations",
  structure: "Éléments hors fondations (structure)",
  facades: "Façades",
  huisseries: "Huisseries extérieures",
  cloisons: "Cloisons intérieures",
  sanitaires: "Sanitaires et plomberie",
  chauffage: "Chauffage",
  electricite: "Électricité",
  planchers: "Planchers non porteurs",
};
