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
  /** Démolition, finitions, cuisine et équipements : compté dans le coût, hors critères de requalification (245 A CGI). */
  finitions?: PosteTravaux;
  /** Critères de requalification en immeuble neuf autres que les postes de travaux. */
  requalification?: {
    /** Immeuble achevé depuis moins de 5 ans. */
    acheveMoinsDe5Ans?: boolean;
    /** Augmentation de la surface de plancher créée par les travaux (0,12 = + 12 %). */
    augmentationSurfacePct?: number;
  };
}

/** Nature d'un lot revendu : détermine les ventes DVF utilisées pour estimer son prix. */
export type NatureLot = "Appartement" | "Maison" | "Local" | "Garage" | "Parking" | "Terrain";

export interface Lot {
  libelle: string;
  nature?: NatureLot;
  /** Prix bas ou haut saisis à la main : l'estimation DVF automatique ne les remplace pas. */
  prixManuel?: boolean;
  /** Travaux du lot (onglet Travaux, mode « par lot ») : forfait au m² ou montant libre TTC. */
  travauxForfait?: "rafraichissement" | "global" | "rehabilitation" | null;
  travauxMontant?: number | null;
  /** Surface traitée pour les travaux, si différente de la surface vendue (garage, parking). */
  travauxSurface?: number | null;
  surface?: number;
  prixDown: number | null;
  prixTop: number | null;
  /** Prix de revente fixé par l'utilisateur (scénario « saisi »). */
  prixSaisi?: number | null;
  /** « dont TVA » saisi dans la colonne E des recettes. */
  tva: number;
}

export type TypeSource = "fonds_propres" | "compte_courant" | "pret" | "obligataire" | "associe_jv";

/** Une source de financement de l'opération. */
export interface SourceFinancement {
  id: string;
  type: TypeSource;
  libelle: string;
  montant: number;
  /** Taux annuel : intérêts du prêt, coupon obligataire, rémunération des comptes courants. */
  tauxAnnuel: number;
  /** Durée propre à la source, sinon durée de l'opération. */
  dureeMois?: number | null;
  fraisDossier: number;
  fraisGarantie: number;
  /** Commission d'engagement d'une ligne de crédit, en % du montant. */
  commissionEngagementPct: number;
  /** Frais de la plateforme de financement participatif, en % du montant levé. */
  fraisPlateformePct: number;
  /** Associé en participation : part du bénéfice net qui lui revient (0,3 = 30 %). */
  partBenefice: number;
}

/** Frais de vente détaillés (en plus ou à la place des honoraires de vente saisis en montant). */
export interface FraisVente {
  /** Honoraires d'agence en % du prix de vente ; si null, on prend `honorairesVente` en montant. */
  agencePct: number | null;
  diagnostics: number;
  mainlevee: number;
  homeStaging: number;
  autres: number;
}

/** « auto » : régime déduit du projet (immeuble neuf → prix total, terrain à bâtir ou division foncière → marge, logement ancien → exonération). */
export type RegimeTVA = "marge" | "exoneration" | "total" | "auto";
export type RegimeApplique = Exclude<RegimeTVA, "auto">;
/** Nature de l'opération, utilisée par le régime de TVA automatique. */
export type NatureOperation = "logement_ancien" | "terrain_a_batir" | "division_fonciere";
export type ScenarioRevente = "down" | "moyen" | "top" | "saisi";

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
    /** Sources détaillées (prêt, obligations, comptes courants…). Si présentes, elles remplacent le calcul simple. */
    sources?: SourceFinancement[];
  };
  gfa: number; // GFA si VEFR
  assuranceDO: number;

  honorairesVente: number;
  fraisVente?: FraisVente;

  lots: Lot[];
  scenario: ScenarioRevente;

  /** Régime choisi. Si les travaux font basculer en « immeuble neuf », la TVA sur le prix total s'impose. */
  regimeTVA: RegimeTVA;
  /** Nature de l'opération, pour le régime « auto » (logement ancien par défaut). */
  natureOperation?: NatureOperation;

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

  bascule: { immeubleNeuf: boolean; raison: string; criteres: CritereRequalification[] };
  regimeApplique: RegimeApplique;
  /** Pourquoi ce régime s'applique. */
  regimeRaison: string;

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
  /** Part du bénéfice net revenant aux associés en participation (sources « associe_jv »). */
  partageJV: number;
  /** Bénéfice net après IS et après la part des associés en participation. */
  beneficeNetSociete: number;
  ratios: {
    prixAchatM2Carrez: number;
    prixAchatM2Total: number;
    coutTravauxHTM2Carrez: number;
    coutTravauxHTM2Total: number;
    prixVenteM2Carrez: number;
    prixVenteM2Total: number;
  };
}

/** Un critère de requalification en immeuble neuf, avec son niveau atteint et son seuil. */
export interface CritereRequalification {
  cle: string;
  libelle: string;
  groupe: "gros_oeuvre" | "second_oeuvre" | "autre";
  valeur: number;
  seuil: number;
  atteint: boolean;
}
