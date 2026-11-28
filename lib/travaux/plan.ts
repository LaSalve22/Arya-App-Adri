// Plan travaux d'un bien : état des pièces, éléments généraux, options du projet,
// forfait rapide au m² ou devis détaillé par lots, et report dans le bilan.
import type { BudgetTravaux, Hypotheses, PosteTravaux } from "@/lib/bilan/types";
import type { CoutsTechniques } from "@/lib/etat";
import { ARTICLES, type Gamme, type PosteBilan } from "./catalogue";

export type TypePiece = "sejour" | "cuisine" | "chambre" | "salle_de_bain" | "wc" | "entree" | "exterieur" | "autre";
export type EtatPiece = "bon" | "rafraichir" | "renover" | "refaire";

export const LIBELLES_PIECES: Record<TypePiece, string> = {
  sejour: "Séjour", cuisine: "Cuisine", chambre: "Chambre", salle_de_bain: "Salle de bain", wc: "WC", entree: "Entrée, couloir", exterieur: "Extérieur", autre: "Autre pièce",
};
export const LIBELLES_ETATS: Record<EtatPiece, string> = { bon: "Bon état", rafraichir: "À rafraîchir", renover: "À rénover", refaire: "À refaire" };

export interface Piece {
  id: string;
  type: TypePiece;
  /** Surface en m² ; vide = part de la surface restante. */
  surface: number | null;
  etat: EtatPiece;
  remarques?: string;
}

export interface ElementsGeneraux {
  electricite: "ok" | "a_reprendre" | "a_refaire";
  chauffage: "ok" | "electrique_ancien" | "a_refaire" | "absent";
  menuiseries: "ok" | "simple_vitrage";
  nbFenetres: number | null;
  plomberie: "ok" | "a_refaire";
  structure: "ok" | "fissures" | "a_reprendre";
  toiture: "ok" | "a_refaire" | "sans_objet";
  facade: "ok" | "a_refaire";
  anneeConstruction: number | null;
}

export interface OptionsProjet {
  /** Division d'un bien en plusieurs logements. */
  division: boolean;
  nbLots: number;
  /** Division d'un terrain (détachement de parcelle). */
  divisionFonciere: boolean;
  /** Création d'une voie ou d'espaces communs (lotissement). */
  voieCommune: boolean;
  changementDestination: boolean;
  /** Surface de plancher créée (extension, surélévation, combles), en m². */
  surfaceCreee: number;
  /** Modification de l'aspect extérieur : fenêtres, façade, toiture. */
  modifFacade: boolean;
  placesParking: number;
  copropriete: boolean;
  acheveMoinsDe5Ans: boolean;
  compteursACreer: boolean;
  assainissement: "collectif" | "fosse" | "inconnu";
}

export type Forfait = "rafraichissement" | "global" | "rehabilitation";

export interface LigneDevis {
  id: string;
  quantite: number;
  origine: string;
}

export interface PlanTravaux {
  mode: "forfait" | "detail";
  forfait: Forfait | null;
  gamme: Gamme;
  /** Surface traitée (m²), par défaut la surface du bien. */
  surface: number | null;
  pieces: Piece[];
  general: ElementsGeneraux;
  projet: OptionsProjet;
  lignes: LigneDevis[];
  /** % rénové par élément calculé avec le devis (critères de requalification). */
  pct?: Partial<Record<string, number>>;
  /** Texte libre (dictée, notes). */
  notes: string;
}

export const generalParDefaut = (): ElementsGeneraux => ({
  electricite: "ok", chauffage: "ok", menuiseries: "ok", nbFenetres: null, plomberie: "ok", structure: "ok", toiture: "sans_objet", facade: "ok", anneeConstruction: null,
});
export const projetParDefaut = (): OptionsProjet => ({
  division: false, nbLots: 1, divisionFonciere: false, voieCommune: false, changementDestination: false, surfaceCreee: 0, modifFacade: false,
  placesParking: 0, copropriete: false, acheveMoinsDe5Ans: false, compteursACreer: false, assainissement: "inconnu",
});
export const planParDefaut = (): PlanTravaux => ({
  mode: "forfait", forfait: null, gamme: "moyen", surface: null, pieces: [], general: generalParDefaut(), projet: projetParDefaut(), lignes: [], notes: "",
});

let compteur = 0;
export const idPiece = () => `p${Date.now().toString(36)}${(compteur++).toString(36)}`;

/** Pièces par défaut d'un T{n} : séjour, cuisine, salle de bain, WC, n-1 chambres. */
export function piecesTypologie(n: number, etat: EtatPiece = "bon"): Piece[] {
  const types: TypePiece[] = ["sejour", "cuisine", "salle_de_bain", "wc", ...Array.from({ length: Math.max(0, n - 1) }, () => "chambre" as const)];
  return types.map((type) => ({ id: idPiece(), type, surface: null, etat }));
}

// ---------------------------------------------------------------------------
// Forfaits rapides
// ---------------------------------------------------------------------------

type CleSecond = "huisseries" | "cloisons" | "sanitaires" | "chauffage" | "electricite" | "planchers";
type CleGros = "fondations" | "structure" | "facades";

export interface DefinitionForfait {
  libelle: string;
  prixM2: number;
  description: string;
  /** Répartition du montant par poste (somme = 1). */
  repartition: Partial<Record<PosteBilan, number>>;
  /** Part de chaque élément rénovée (critères de requalification). */
  pct: Partial<Record<CleGros | CleSecond, number>>;
}

export const FORFAITS: Record<Forfait, DefinitionForfait> = {
  rafraichissement: {
    libelle: "Rafraîchissement",
    prixM2: 450,
    description: "Peinture, sols, cuisine et salle de bain d'entrée de gamme, petites reprises d'électricité. Pas de requalification.",
    repartition: { finitions: 0.6, sanitaires: 0.2, electricite: 0.1, chauffage: 0.05, cloisons: 0.05 },
    pct: { electricite: 0.3, sanitaires: 0.3, cloisons: 0.1 },
  },
  global: {
    libelle: "Rénovation globale",
    prixM2: 850,
    description: "Électricité, plomberie, chauffage et cloisons refaits, une partie des fenêtres et des sols. Reste sous les deux tiers sur les huisseries et les planchers : pas de requalification.",
    repartition: { electricite: 0.15, sanitaires: 0.2, cloisons: 0.15, chauffage: 0.1, huisseries: 0.08, planchers: 0.07, finitions: 0.25 },
    pct: { electricite: 1, sanitaires: 1, cloisons: 0.8, chauffage: 1, huisseries: 0.5, planchers: 0.5 },
  },
  rehabilitation: {
    libelle: "Réhabilitation lourde",
    prixM2: 1200,
    description: "Tout le second œuvre refait, reprises de structure. Les 6 postes de second œuvre dépassent les deux tiers : requalification en immeuble neuf, TVA sur le prix total.",
    repartition: { structure: 0.1, electricite: 0.13, sanitaires: 0.17, cloisons: 0.15, chauffage: 0.1, huisseries: 0.1, planchers: 0.08, finitions: 0.17 },
    pct: { structure: 0.3, electricite: 1, sanitaires: 1, cloisons: 1, chauffage: 1, huisseries: 1, planchers: 1 },
  },
};

// ---------------------------------------------------------------------------
// Devis détaillé à partir de l'état des pièces
// ---------------------------------------------------------------------------

const PIECES_HUMIDES: TypePiece[] = ["cuisine", "salle_de_bain", "wc"];
const arrondi = (n: number) => Math.round(n * 10) / 10;

/** Surface de chaque pièce : saisie, sinon répartition de la surface restante selon un poids par type. */
export function surfacesPieces(pieces: Piece[], surfaceTotale: number | null): Map<string, number> {
  const poids: Record<TypePiece, number> = { sejour: 2.2, cuisine: 0.9, chambre: 1.1, salle_de_bain: 0.5, wc: 0.15, entree: 0.5, exterieur: 0, autre: 0.8 };
  const out = new Map<string, number>();
  const saisies = pieces.reduce((s, p) => s + (p.type !== "exterieur" ? p.surface ?? 0 : 0), 0);
  const sansSurface = pieces.filter((p) => p.surface == null && p.type !== "exterieur");
  const reste = Math.max(0, (surfaceTotale ?? 0) - saisies);
  const totalPoids = sansSurface.reduce((s, p) => s + poids[p.type], 0);
  for (const p of pieces) {
    if (p.surface != null) out.set(p.id, p.surface);
    else if (p.type === "exterieur") out.set(p.id, 0);
    else out.set(p.id, totalPoids ? arrondi((reste * poids[p.type]) / totalPoids) : 0);
  }
  return out;
}

export interface Proposition {
  lignes: LigneDevis[];
  forfaitConseille: Forfait | null;
  /** % rénové par élément (critères de requalification). */
  pct: Partial<Record<CleGros | CleSecond, number>>;
  surfaceHabitable: number;
}

/** Propose un devis détaillé (lignes du catalogue) à partir de l'état des pièces, des éléments généraux et du projet. */
export function proposerTravaux(plan: PlanTravaux, surfaceBien: number | null): Proposition {
  const { pieces, general: g, projet } = plan;
  const surfaces = surfacesPieces(pieces, plan.surface ?? surfaceBien);
  const lignes: LigneDevis[] = [];
  const ajout = (id: string, quantite: number, origine: string) => {
    if (!(quantite > 0)) return;
    const q = Math.round(quantite * 10) / 10;
    const l = lignes.find((x) => x.id === id);
    if (l) { l.quantite = Math.round((l.quantite + q) * 10) / 10; l.origine = `${l.origine} · ${origine}`; }
    else lignes.push({ id, quantite: q, origine });
  };

  const habitables = pieces.filter((p) => p.type !== "exterieur");
  const surfaceHabitable = habitables.reduce((s, p) => s + (surfaces.get(p.id) ?? 0), 0) || (plan.surface ?? surfaceBien ?? 0);
  const elecGlobale = g.electricite === "a_refaire";
  const plombGlobale = g.plomberie === "a_refaire";
  let surfElec = 0, surfCloisons = 0, surfPlanchers = 0;
  let humidesTouchees = 0;
  const humides = habitables.filter((p) => PIECES_HUMIDES.includes(p.type)).length;

  for (const p of pieces) {
    const s = surfaces.get(p.id) ?? 0;
    const nom = LIBELLES_PIECES[p.type];
    const perim = 4 * Math.sqrt(Math.max(s, 1));
    const murs = perim * 2.5 + s; // murs et plafond
    if (p.type === "exterieur") {
      if (p.etat === "renover" || p.etat === "refaire") ajout("beton-desactive", p.surface ?? 15, nom);
      continue;
    }
    if (p.etat === "bon") continue;
    // Toutes les pièces touchées : peinture
    ajout("peinture", murs, nom);
    if (p.type === "cuisine") {
      if (p.etat === "rafraichir") ajout("faience", 4, nom);
      else { ajout("cuisine", 1, nom); ajout("faience", 5, nom); if (!plombGlobale) ajout("plomberie", 1, nom); humidesTouchees++; }
      if (p.etat === "refaire") ajout("electromenager", 1, nom);
    } else if (p.type === "salle_de_bain") {
      if (p.etat === "rafraichir") ajout("faience", 6, nom);
      else if (p.etat === "renover") { ajout("douche", 1, nom); ajout("faience", 8, nom); if (!plombGlobale) ajout("plomberie", 1, nom); humidesTouchees++; }
      else { ajout("sdb", 1, nom); if (!plombGlobale) ajout("plomberie", 2, nom); humidesTouchees++; }
    } else if (p.type === "wc") {
      if (p.etat !== "rafraichir") { ajout("wc", 1, nom); if (!plombGlobale) ajout("plomberie", 1, nom); humidesTouchees++; }
    }
    // Sols
    const humide = PIECES_HUMIDES.includes(p.type) || p.type === "entree";
    if (p.etat === "rafraichir") {
      if (!humide) ajout("stratifie", s, nom);
    } else {
      ajout(humide ? "carrelage" : p.etat === "refaire" ? "contrecolle" : "stratifie", s, nom);
      ajout("plinthes", perim, nom);
      ajout("enduit", perim * 2.5, nom);
      if (!elecGlobale) { ajout("electricite", s, nom); surfElec += s; }
    }
    if (p.etat === "refaire") {
      ajout("demolition", s, nom);
      ajout("chape-liquide", s, nom);
      ajout("doublage", perim * 2.5 * 0.4, nom); // murs extérieurs ≈ 40 % du périmètre
      ajout("cloison-placo", perim * 2.5 * 0.3, nom);
      ajout("faux-plafond", s, nom);
      ajout("porte-int", 1, nom);
      surfCloisons += s;
      surfPlanchers += s;
    }
  }

  // Éléments généraux
  if (elecGlobale) { ajout("electricite", surfaceHabitable, "Électricité à refaire"); surfElec = surfaceHabitable; }
  if (g.electricite !== "ok" && humides) ajout("vmc", 1, "Ventilation");
  if (plombGlobale) {
    const points = habitables.reduce((n, p) => n + (p.type === "salle_de_bain" ? 2 : p.type === "cuisine" || p.type === "wc" ? 1 : 0), 0) || 3;
    ajout("plomberie", points, "Plomberie à refaire");
    humidesTouchees = humides;
  }
  let chauffageRefait = false;
  if (g.chauffage !== "ok") {
    const vie = habitables.filter((p) => p.type === "sejour" || p.type === "chambre").length || 2;
    const multi = Math.floor(vie / 2), mono = vie % 2;
    ajout("pac-multi", multi, "Chauffage");
    ajout("pac-mono", mono, "Chauffage");
    ajout("chauffe-eau", 1, "Eau chaude");
    chauffageRefait = true;
  }
  let huisseriesPct = 0;
  if (g.menuiseries === "simple_vitrage") {
    const nb = g.nbFenetres ?? Math.max(2, habitables.filter((p) => p.type !== "wc" && p.type !== "entree").length);
    ajout("fenetre", nb, "Simple vitrage");
    huisseriesPct = 1;
  }
  let structurePct = 0;
  if (g.structure === "fissures") { ajout("fissures", 10, "Fissures"); structurePct = 0.1; }
  if (g.structure === "a_reprendre") { ajout("ipn", 1, "Structure"); ajout("fissures", 15, "Structure"); structurePct = 0.3; }
  if (g.toiture === "a_refaire") { ajout("toiture", surfaceHabitable, "Toiture"); ajout("charpente", surfaceHabitable * 0.5, "Charpente"); structurePct = Math.max(structurePct, 0.3); }

  // Projet
  if (projet.division && projet.nbLots > 1) {
    ajout("plan-copro", 1, "Division");
    ajout("edd", 1, "Division");
    ajout("mise-copro", 1, "Division");
    ajout("raccordement", (projet.nbLots - 1) * 2, "Compteurs eau et électricité des nouveaux lots");
    ajout("plans-2d", 1, "Division");
  }
  if (projet.divisionFonciere) { ajout("bornage", 1, "Division foncière"); ajout("division-parcellaire", 1, "Division foncière"); ajout("vrd", 20, "Réseaux du lot détaché"); }
  if (projet.compteursACreer && !projet.division) ajout("raccordement", 2, "Compteurs à créer");
  if (projet.surfaceCreee > 0) ajout("plans-2d", 1, "Surface créée");
  if (projet.placesParking > 0) ajout("parking", projet.placesParking * 12.5, "Places de stationnement");
  const grosOeuvre = lignes.some((l) => ARTICLES[l.id]?.destination.type === "poste" && ["structure", "fondations", "facades"].includes((ARTICLES[l.id].destination as { poste: string }).poste));
  if (grosOeuvre) ajout("do", 1, "Gros œuvre");

  const part = (x: number) => (surfaceHabitable ? Math.min(1, x / surfaceHabitable) : 0);
  const pct: Proposition["pct"] = {
    electricite: part(surfElec),
    cloisons: part(surfCloisons),
    planchers: part(surfPlanchers),
    sanitaires: humides ? Math.min(1, humidesTouchees / humides) : 0,
    chauffage: chauffageRefait ? 1 : 0,
    huisseries: huisseriesPct,
    structure: structurePct,
  };

  // Forfait de repère : selon la part de la surface refaite ou rénovée.
  const touchee = habitables.reduce((s, p) => s + (p.etat === "bon" ? 0 : (surfaces.get(p.id) ?? 0) * (p.etat === "rafraichir" ? 0.4 : p.etat === "renover" ? 0.8 : 1.2)), 0);
  const ratio = surfaceHabitable ? touchee / surfaceHabitable : 0;
  const forfaitConseille: Forfait | null = !lignes.length ? null : ratio > 0.95 || structurePct >= 0.3 ? "rehabilitation" : ratio > 0.5 ? "global" : "rafraichissement";
  return { lignes, forfaitConseille, pct, surfaceHabitable };
}

// ---------------------------------------------------------------------------
// Montants et report dans le bilan
// ---------------------------------------------------------------------------

export interface LigneChiffree extends LigneDevis {
  lot: string;
  categorie: string;
  unite: string;
  prixUnitaire: number;
  ttc: number;
  tva: number;
}

export function chiffrer(lignes: LigneDevis[], gamme: Gamme): LigneChiffree[] {
  return lignes.flatMap((l) => {
    const art = ARTICLES[l.id];
    if (!art) return [];
    const ttc = art.prix[gamme] * l.quantite;
    return [{ ...l, lot: art.lot, categorie: art.categorie, unite: art.unite, prixUnitaire: art.prix[gamme], ttc, tva: art.tva ? (ttc / (1 + art.tva)) * art.tva : 0 }];
  });
}

const POSTES_GROS: CleGros[] = ["fondations", "structure", "facades"];
const POSTES_SECOND: CleSecond[] = ["huisseries", "cloisons", "sanitaires", "chauffage", "electricite", "planchers"];

/** Poste dont le taux reproduit exactement la TVA d'un ensemble de lignes à taux différents. */
function poste(base: PosteTravaux, ttc: number, tva: number, pctRenove?: number): PosteTravaux {
  return { ...base, montantTTC: Math.round(ttc), tauxTVA: ttc > tva && tva > 0 ? tva / (ttc - tva) : base.tauxTVA, pctRenove: pctRenove ?? 0 };
}

export interface Report {
  travaux: BudgetTravaux;
  coutsTechniques: Partial<CoutsTechniques>;
  assuranceDO: number;
  total: number;
}

/** Montants par poste (TTC et TVA) → budget travaux du bilan, avec les % rénovés. */
function budgetDepuisMontants(base: BudgetTravaux, m: Partial<Record<PosteBilan, { ttc: number; tva: number }>>, pct: Proposition["pct"], projet: OptionsProjet, surfaceBien: number): BudgetTravaux {
  const v = (k: PosteBilan) => m[k] ?? { ttc: 0, tva: 0 };
  const grosOeuvre = Object.fromEntries(POSTES_GROS.map((k) => [k, poste(base.grosOeuvre[k], v(k).ttc, v(k).tva, pct[k])])) as BudgetTravaux["grosOeuvre"];
  const secondOeuvre = Object.fromEntries(POSTES_SECOND.map((k) => [k, poste(base.secondOeuvre[k], v(k).ttc, v(k).tva, pct[k])])) as BudgetTravaux["secondOeuvre"];
  const fin = v("finitions");
  return {
    ...base,
    grosOeuvre,
    secondOeuvre,
    raccordements: poste(base.raccordements, v("raccordements").ttc, v("raccordements").tva),
    voirie: poste(base.voirie, v("voirie").ttc, v("voirie").tva),
    finitions: { montantTTC: Math.round(fin.ttc), tauxTVA: fin.ttc > fin.tva && fin.tva > 0 ? fin.tva / (fin.ttc - fin.tva) : 0.1, pctRenove: 0 },
    requalification: {
      ...base.requalification,
      acheveMoinsDe5Ans: projet.acheveMoinsDe5Ans,
      augmentationSurfacePct: surfaceBien && projet.surfaceCreee ? projet.surfaceCreee / surfaceBien : 0,
    },
  };
}

/** Report du devis détaillé dans le bilan : budget travaux, coûts techniques (géomètre, avocat…) et assurance DO. */
export function reportDevis(base: BudgetTravaux, plan: PlanTravaux, pct: Proposition["pct"], surfaceBien: number): Report {
  const lignes = chiffrer(plan.lignes, plan.gamme);
  const m: Partial<Record<PosteBilan, { ttc: number; tva: number }>> = {};
  const coutsTechniques: Partial<CoutsTechniques> = {};
  let assuranceDO = 0;
  for (const l of lignes) {
    const d = ARTICLES[l.id].destination;
    if (d.type === "poste") {
      const x = (m[d.poste] ??= { ttc: 0, tva: 0 });
      x.ttc += l.ttc;
      x.tva += l.tva;
    } else if (d.type === "technique") coutsTechniques[d.champ] = (coutsTechniques[d.champ] ?? 0) + Math.round(l.ttc);
    else assuranceDO += Math.round(l.ttc);
  }
  return { travaux: budgetDepuisMontants(base, m, pct, plan.projet, surfaceBien), coutsTechniques, assuranceDO, total: lignes.reduce((s, l) => s + l.ttc, 0) };
}

/** Report d'un forfait au m² dans le bilan. TVA à 10 % (rénovation), 20 % sur la structure. */
export function reportForfait(base: BudgetTravaux, f: Forfait, surface: number, projet: OptionsProjet, surfaceBien: number): Report {
  const def = FORFAITS[f];
  const total = def.prixM2 * surface;
  const m: Partial<Record<PosteBilan, { ttc: number; tva: number }>> = {};
  for (const [k, part] of Object.entries(def.repartition) as [PosteBilan, number][]) {
    const ttc = total * part;
    const taux = k === "structure" ? 0.2 : 0.1;
    m[k] = { ttc, tva: (ttc / (1 + taux)) * taux };
  }
  return { travaux: budgetDepuisMontants(base, m, def.pct, projet, surfaceBien), coutsTechniques: {}, assuranceDO: 0, total };
}

/** Applique un report aux hypothèses du bilan (les coûts techniques sont reportés par l'appelant). */
export function appliquerReport(h: Hypotheses, r: Report): Hypotheses {
  return { ...h, travaux: r.travaux, assuranceDO: r.assuranceDO || h.assuranceDO };
}
