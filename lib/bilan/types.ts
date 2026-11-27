// Hypothèses et résultats du bilan prévisionnel marchand de biens.
// Structure calquée sur le classeur « bilan_previsionnel_v3.xlsx »
// (onglets « Budget travaux » et « BP en phase faisabilité »).
// Tous les montants sont TTC, en euros, comme dans l'Excel.

/** Un poste de travaux de l'onglet « Budget travaux ». */
export interface PosteTravaux {
  montantTTC: number;
  /** Taux de TVA : 0.2, 0.1, 0.055, 0.085, 0.021 */
  tauxTVA: number;
  /** Part rénovée par rapport à l'existant, de 0 à 1 (sert à la bascule « immeuble neuf »). */
  pctRenove?: number;
  precisions?: string;
}

export interface BudgetTravaux {
  /** Surface au sol rénovée (m²) ou surface du terrain à aménager (cellule F4). */
  surfaceTotale: number;
  /** Surface Carrez vendue (m²) ou surface totale des parcelles vendues (cellule F5). */
  surfaceCarrez: number;
  grosOeuvre: {
    fondations: PosteTravaux;
    structure: PosteTravaux; // éléments hors fondations (résistance et rigidité)
    facades: PosteTravaux;
  };
  secondOeuvre: {
    huisseries: PosteTravaux;
    cloisons: PosteTravaux;
    sanitaires: PosteTravaux;
    chauffage: PosteTravaux;
    electricite: PosteTravaux;
    planchers: PosteTravaux;
  };
  honorairesTechniques: PosteTravaux; // architecte, géomètre, BET, bureau de contrôle
  raccordements: PosteTravaux; // eau, gaz, électricité, égouts, téléphone
  voirie: PosteTravaux; // voiries et espaces verts
  surelevation: number; // TTC, TVA 20 %
  extension: number; // TTC, TVA 20 %
}

export interface Lot {
  libelle: string;
  surface?: number;
  prixDown: number | null;
  prixTop: number | null;
  /** « dont TVA » saisi dans la colonne E des recettes. */
  tva: number;
}

export type RegimeTVA = "marge" | "exoneration" | "total";
export type ScenarioRevente = "down" | "moyen" | "top";

export interface Hypotheses {
  // ACHAT + CHARGE FONCIÈRE
  prixAcquisition: number;
  tvaAcquisition: number; // E6, si récupérable
  indemniteEviction: number;
  tvaIndemniteEviction: number;
  /** 0.03 avec engagement de revente (valeur de l'Excel), 0.08 sinon. */
  tauxNotaire: number;
  apporteurAffaires: number;

  travaux: BudgetTravaux;
  ameublement: number;
  /** Aléas : 6 % dans l'Excel. */
  tauxAleas: number;

  // HONORAIRES DIVERS (TVA 20 %)
  honorairesGestion: number;
  fraisComptabilite: number;
  fraisJustice: number;

  // FRAIS DIVERS (hors champ TVA)
  financement: {
    montantEmprunte: number;
    tauxAnnuel: number; // 0.045 = 4,5 %
    dureeMois: number;
    fraisDossier: number;
    /** Si renseigné, remplace le calcul automatique (saisie directe comme dans l'Excel). */
    fraisFinanciersManuels: number | null;
  };
  gfa: number; // GFA si VEFR
  assuranceDO: number;

  honorairesVente: number;

  lots: Lot[];
  scenario: ScenarioRevente;

  /** Régime choisi. Si les travaux font basculer en « immeuble neuf », la TVA sur le prix total s'impose. */
  regimeTVA: RegimeTVA;

  /** Apport en fonds propres, pour le rendement des fonds propres. */
  apport: number;
}

export interface LigneMontant {
  ttc: number;
  tva: number;
}

export interface ResultatBilan {
  foncier: {
    acquisition: LigneMontant;
    eviction: LigneMontant;
    notaire: LigneMontant;
    apporteur: LigneMontant;
    total: LigneMontant; // D10 / E10
  };
  technique: {
    voirie: LigneMontant;
    grosEtSecondOeuvre: LigneMontant;
    travauxNeufs: LigneMontant;
    ameublement: LigneMontant;
    aleas: LigneMontant;
    honorairesTechniques: LigneMontant;
    raccordements: LigneMontant;
    total: LigneMontant; // D19 / E19
  };
  honorairesDivers: LigneMontant; // D24 / E24
  fraisDivers: { financiers: number; gfa: number; assuranceDO: number; total: number }; // D29
  bfr: LigneMontant; // D30 / E30
  honorairesVente: LigneMontant; // D31-D32
  recettes: { lots: { libelle: string; prix: number; tva: number }[]; chiffreAffaires: number; tva: number }; // D39 / E39

  bascule: { immeubleNeuf: boolean; raison: string };
  regimeApplique: RegimeTVA;

  margeBruteTTC: number; // D43
  tvaPrixTotal: number; // D45
  tvaSurMarge: number; // D47
  tvaRecuperable: number; // D48
  tvaDue: number; // D49
  margeNetteDeTVA: number; // D50
  beneficeBrut: number; // D51
  margeSurCA: number; // E51
  isTaux15: number; // D52
  isTaux25: number; // D53
  impot: number; // D54
  beneficeNet: number; // D55

  // Indicateurs ajoutés
  prixRevient: number;
  margeSurPrixRevient: number;
  rendementFondsPropres: number | null;
  ratios: {
    prixAchatM2Carrez: number;
    prixAchatM2Total: number;
    coutTravauxHTM2Carrez: number;
    coutTravauxHTM2Total: number;
    prixVenteM2Carrez: number;
    prixVenteM2Total: number;
  };
}
