// Catalogue des prix travaux (grilles « Devis travaux marchand de biens », typologies et version simple).
// Prix TTC fournis et posés, en bas / moyen / haut de gamme. Chaque ligne indique où elle va dans le bilan.
import type { CoutsTechniques } from "@/lib/etat";

export type Gamme = "bas" | "moyen" | "haut";

/** Postes du budget travaux du bilan (feuille « Budget travaux » de l'Excel) plus « finitions ». */
export type PosteBilan =
  | "fondations" | "structure" | "facades"
  | "huisseries" | "cloisons" | "sanitaires" | "chauffage" | "electricite" | "planchers"
  | "honorairesTechniques" | "raccordements" | "voirie" | "finitions";

export type Destination =
  | { type: "poste"; poste: PosteBilan }
  | { type: "technique"; champ: keyof CoutsTechniques }
  | { type: "assuranceDO" };

export interface ArticleCatalogue {
  id: string;
  categorie: string;
  lot: string;
  unite: string;
  prix: Record<Gamme, number>;
  /** Taux de TVA des travaux (10 % rénovation, 5,5 % rénovation énergétique, 20 % prestations intellectuelles et équipements). */
  tva: number;
  destination: Destination;
  remarque?: string;
}

const P = (poste: PosteBilan): Destination => ({ type: "poste", poste });
const T = (champ: keyof CoutsTechniques): Destination => ({ type: "technique", champ });
const a = (id: string, categorie: string, lot: string, unite: string, bas: number, moyen: number, haut: number, tva: number, destination: Destination, remarque?: string): ArticleCatalogue =>
  ({ id, categorie, lot, unite, prix: { bas, moyen, haut }, tva, destination, remarque });

export const CATALOGUE: ArticleCatalogue[] = [
  // Foncier & Division
  a("bornage", "Foncier et division", "Géomètre · bornage", "u", 400, 900, 1400, 0.2, T("geometre")),
  a("division-parcellaire", "Foncier et division", "Géomètre · division parcellaire", "u", 700, 1200, 1800, 0.2, T("geometre")),
  a("mise-copro", "Foncier et division", "Mise en copropriété", "u", 2000, 3000, 4500, 0.2, T("autresTechniques")),
  a("plan-copro", "Foncier et division", "Plan de copropriété", "u", 800, 1500, 2500, 0.2, T("geometre")),
  a("edd", "Foncier et division", "État descriptif de division", "u", 1200, 1500, 1700, 0.2, T("geometre")),
  // Études & Visuels
  a("plans-2d", "Études et visuels", "Plans 2D", "u", 300, 600, 1000, 0.2, T("architecte")),
  a("visuels-3d", "Études et visuels", "Visuels 3D", "u", 500, 1200, 2000, 0.2, T("architecte")),
  a("huissier", "Études et visuels", "Huissier (PV, constats)", "u", 150, 250, 400, 0.2, T("huissier")),
  a("avocat", "Études et visuels", "Avocat (droit immobilier)", "h", 200, 250, 300, 0.2, T("avocat")),
  a("dpe-projete", "Études et visuels", "DPE projeté ou audit énergétique", "u", 300, 450, 600, 0.2, T("diagnosticsAchat"), "Thermicien, 3 à 7 jours"),
  // Assurances
  a("do", "Assurances", "Assurance dommages-ouvrage", "u", 1500, 2500, 4000, 0, { type: "assuranceDO" }, "2 à 4 % du montant des travaux"),
  // Démolition
  a("demolition", "Démolition", "Démolition et évacuation", "m²", 15, 25, 40, 0.1, P("finitions"), "Accès, gravats, dépose"),
  // Gros Œuvre & Structure
  a("ipn", "Gros œuvre et structure", "Ouverture mur porteur et pose d'IPN", "u", 1200, 1800, 2600, 0.1, P("structure"), "Bureau d'études structure conseillé"),
  a("fissures", "Gros œuvre et structure", "Reprise de fissures structurelles", "ml", 45, 70, 110, 0.1, P("structure")),
  a("dalle", "Gros œuvre et structure", "Dalle béton ou chape traditionnelle", "m²", 30, 45, 70, 0.1, P("planchers")),
  a("chape-liquide", "Gros œuvre et structure", "Chape liquide anhydrite", "m²", 25, 35, 55, 0.1, P("planchers")),
  a("parpaing", "Gros œuvre et structure", "Mur parpaing 20 cm", "m²", 55, 75, 110, 0.1, P("structure")),
  a("linteaux", "Gros œuvre et structure", "Seuils, appuis et linteaux", "u", 60, 90, 140, 0.1, P("structure")),
  a("charpente", "Gros œuvre et structure", "Charpente (révision complète)", "m²", 60, 90, 140, 0.1, P("structure")),
  a("toiture", "Gros œuvre et structure", "Toiture tuiles mécaniques (réfection)", "m²", 55, 80, 110, 0.1, P("structure")),
  // Menuiseries
  a("fenetre", "Menuiseries", "Menuiserie extérieure PVC double vitrage", "u", 450, 650, 950, 0.055, P("huisseries"), "TVA 5,5 % si performance thermique"),
  a("porte-entree", "Menuiseries", "Porte d'entrée sécurisée", "u", 900, 1400, 2000, 0.1, P("huisseries")),
  a("porte-int", "Menuiseries", "Bloc-porte intérieur posé", "u", 120, 180, 300, 0.1, P("cloisons")),
  // Second Œuvre
  a("doublage", "Second œuvre", "Doublage BA13 et isolant GR32", "m²", 28, 40, 58, 0.055, P("cloisons"), "Isolation : TVA 5,5 %"),
  a("cloison-placo", "Second œuvre", "Cloison Placostil 72/48", "m²", 28, 42, 62, 0.1, P("cloisons")),
  a("cloison-fermacell", "Second œuvre", "Cloison Fermacell 12,5 mm", "m²", 40, 55, 80, 0.1, P("cloisons")),
  a("faux-plafond", "Second œuvre", "Faux-plafond BA13", "m²", 24, 32, 50, 0.1, P("cloisons")),
  a("electricite", "Second œuvre", "Électricité complète rénovation (NF C 15-100)", "m²", 50, 70, 95, 0.1, P("electricite"), "Tableau inclus"),
  a("vmc", "Second œuvre", "VMC simple flux hygroréglable", "u", 600, 900, 1200, 0.1, P("electricite")),
  a("plomberie", "Second œuvre", "Plomberie rénovation (création réseau)", "point d'eau", 850, 1200, 1600, 0.1, P("sanitaires")),
  a("wc", "Second œuvre", "WC suspendu", "u", 380, 520, 820, 0.1, P("sanitaires")),
  a("chauffe-eau", "Second œuvre", "Chauffe-eau thermodynamique 200 L", "u", 1150, 1600, 2300, 0.055, P("sanitaires"), "Rénovation énergétique : TVA 5,5 %"),
  a("pac-mono", "Second œuvre", "PAC air/air mono-split", "u", 1100, 1600, 2300, 0.1, P("chauffage")),
  a("pac-multi", "Second œuvre", "PAC air/air multi-split 2 unités", "u", 2200, 3200, 4400, 0.1, P("chauffage")),
  a("pac-eau", "Second œuvre", "PAC air/eau", "u", 6500, 8500, 11500, 0.055, P("chauffage"), "Rénovation énergétique : TVA 5,5 %"),
  // Finitions
  a("ragreage", "Finitions", "Ragréage autolissant", "m²", 8, 12, 20, 0.1, P("finitions")),
  a("stratifie", "Finitions", "Parquet stratifié", "m²", 18, 28, 40, 0.1, P("finitions")),
  a("contrecolle", "Finitions", "Parquet contrecollé", "m²", 28, 42, 65, 0.1, P("finitions")),
  a("carrelage", "Finitions", "Carrelage sol (pose 60x60)", "m²", 35, 50, 80, 0.1, P("finitions")),
  a("faience", "Finitions", "Faïence murale salle de bain et cuisine", "m²", 30, 45, 70, 0.1, P("finitions")),
  a("plinthes", "Finitions", "Plinthes assorties (pose)", "ml", 6, 9, 14, 0.1, P("finitions")),
  a("peinture", "Finitions", "Peinture murs et plafonds (2 couches)", "m²", 20, 28, 35, 0.1, P("finitions")),
  a("enduit", "Finitions", "Enduit de lissage", "m²", 6, 9, 14, 0.1, P("finitions")),
  a("papier-peint", "Finitions", "Papier peint (pose)", "m²", 18, 28, 45, 0.1, P("finitions")),
  // Cuisine & Salles d'eau
  a("sdb", "Cuisine et salles d'eau", "Salle de bain complète", "u", 3200, 5200, 8000, 0.1, P("sanitaires"), "Douche à l'italienne"),
  a("douche", "Cuisine et salles d'eau", "Receveur, paroi et colonne de douche", "u", 900, 1400, 2200, 0.1, P("sanitaires")),
  a("cuisine", "Cuisine et salles d'eau", "Cuisine équipée (hors électroménager)", "u", 1800, 4000, 7000, 0.1, P("finitions")),
  a("electromenager", "Cuisine et salles d'eau", "Électroménager cuisine (pack 4)", "u", 900, 1500, 2400, 0.2, P("finitions")),
  // Extérieurs & VRD
  a("vrd", "Extérieurs et VRD", "Réseaux VRD (eau, électricité, télécom) en tranchée", "ml", 60, 100, 160, 0.2, P("raccordements")),
  a("raccordement", "Extérieurs et VRD", "Raccordement eau ou électricité", "u", 180, 320, 520, 0.2, P("raccordements")),
  a("beton-desactive", "Extérieurs et VRD", "Allée ou terrasse en béton désactivé", "m²", 42, 65, 95, 0.2, P("voirie")),
  a("terrasse-bois", "Extérieurs et VRD", "Terrasse bois pin autoclave", "m²", 60, 85, 120, 0.2, P("voirie")),
  a("cloture", "Extérieurs et VRD", "Clôture grillagée et poteaux scellés", "ml", 22, 35, 55, 0.2, P("voirie")),
  a("portail", "Extérieurs et VRD", "Portail coulissant motorisé", "u", 1200, 2200, 3500, 0.2, P("voirie")),
  a("parking", "Extérieurs et VRD", "Goudronnage parking", "m²", 25, 40, 65, 0.2, P("voirie")),
];

export const ARTICLES: Record<string, ArticleCatalogue> = Object.fromEntries(CATALOGUE.map((x) => [x.id, x]));

export const LIBELLES_GAMME: Record<Gamme, string> = { bas: "Entrée de gamme", moyen: "Milieu de gamme", haut: "Haut de gamme" };
