// Analyse d'une description en français (dictée vocale, notes, texte d'annonce) :
// pièces et leur état, éléments généraux, options du projet, gamme et forfait.
import type { Gamme } from "./catalogue";
import { LIBELLES_ETATS, LIBELLES_PIECES, idPiece, type ElementsGeneraux, type EtatPiece, type Forfait, type OptionsProjet, type Piece, type TypePiece } from "./plan";

export interface Compris {
  pieces: Piece[];
  general: Partial<ElementsGeneraux>;
  projet: Partial<OptionsProjet>;
  gamme?: Gamme;
  forfait?: Forfait;
  surface?: number;
  typologie?: number;
  dpe?: string;
  /** Ce qui a été compris, en clair, pour que l'utilisateur vérifie. */
  resume: string[];
}

const NOMBRES: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10 };
const nombre = (s: string | undefined): number | null => (s == null ? null : NOMBRES[s] ?? (Number.isFinite(Number(s.replace(",", "."))) ? Number(s.replace(",", ".")) : null));

/** Minuscules, sans accents, apostrophes et espaces normalisés, « m2 » et « mètres carrés » unifiés. */
export function normaliser(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/(\d)\s*(?:m2|m²|metres? carres?|m carres?)/g, "$1 m2")
    .trim();
}

const NB = "(\\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)";
const PIECES: [RegExp, TypePiece][] = [
  [/salles? de bains?|salles? d'eau|\bsdb\b|salles? de douche/, "salle_de_bain"],
  [/\bcuisines?\b/, "cuisine"],
  [/\bchambres?\b/, "chambre"],
  [/\bwc\b|\btoilettes?\b/, "wc"],
  [/\bsejours?\b|\bsalons?\b|piece de vie|pieces de vie/, "sejour"],
  [/\bentrees?\b|\bcouloirs?\b|\bdegagements?\b/, "entree"],
  [/\bterrasses?\b|\bjardins?\b|\bbalcons?\b|\bcour\b|\bexterieurs?\b/, "exterieur"],
  [/\bbureaux?\b|\bbuanderies?\b|\bcelliers?\b|\bdressings?\b/, "autre"],
];

function etatDans(s: string): EtatPiece | null {
  if (/a refaire|refaire entierement|tout a refaire|a reprendre entierement|a demolir|vetuste|insalubre|tres abime/.test(s)) return "refaire";
  if (/a renover|renovation|abime|a moderniser|dans son jus|date/.test(s)) return "renover";
  if (/a rafraichir|rafraichissement|coup de peinture|a repeindre|petits travaux/.test(s)) return "rafraichir";
  if (/bon etat|refait a neuf|refaite a neuf|refaits a neuf|refaites a neuf|recent|renove|renovee|neuve?s?\b|impeccable|correct/.test(s)) return "bon";
  return null;
}

export function analyserDescription(texte: string): Compris {
  const t = normaliser(texte);
  const c: Compris = { pieces: [], general: {}, projet: {}, resume: [] };

  // ----- Ensemble du bien
  const typo = t.match(/\b[tf]\s?(\d)\b/);
  if (typo) c.typologie = Number(typo[1]);
  // Surface du bien : la plus grande surface citée, hors surface créée (extension, surélévation)
  const creeeTxt = t.match(/(?:extension|surelevation|agrandissement|combles? (?:amenages?|a amenager)|creer|creation de)[^,.;]*?(\d+(?:[.,]\d+)?) m2/);
  const surfaces = [...t.matchAll(/(\d+(?:[.,]\d+)?) m2/g)].map((m) => Number(m[1].replace(",", ".")));
  if (creeeTxt) surfaces.splice(surfaces.indexOf(Number(creeeTxt[1].replace(",", "."))), 1);
  if (surfaces.length) c.surface = Math.max(...surfaces);
  const dpe = t.match(/\bdpe\s*(?:classe\s*|en\s*|:)?\s*([a-g])\b/) ?? t.match(/\bclasse (?:energie )?([a-g])\b/);
  if (dpe) c.dpe = dpe[1].toUpperCase();
  const annee = t.match(/(?:construit|construite|construction|batie?|datant|annee de construction|annees?)\s*(?:en|de|du|:)?\s*((?:1[6-9]|20)\d\d)\b/);
  if (annee) c.general.anneeConstruction = Number(annee[1]);

  if (/tout a refaire|entierement a renover|a rehabiliter|rehabilitation|renovation lourde|a renover entierement|plateau brut/.test(t)) c.forfait = "rehabilitation";
  else if (/renovation (complete|totale|globale)|a renover\b/.test(t)) c.forfait = "global";
  else if (/rafraichissement|a rafraichir|coup de frais|petits travaux/.test(t)) c.forfait = "rafraichissement";

  if (/haut de gamme|gamme haute|premium|standing/.test(t)) c.gamme = "haut";
  else if (/entree de gamme|gamme basse|petit budget|economique/.test(t)) c.gamme = "bas";
  else if (/milieu de gamme|gamme moyenne|moyen de gamme/.test(t)) c.gamme = "moyen";

  const sansEtat = new Set<string>();
  // ----- Pièces, par proposition : « cuisine et salle de bain à refaire, deux chambres à rafraîchir »
  for (const prop of t.split(/[,.;!?]|\bpuis\b|\bavec\b|\bmais\b/)) {
    const etat = etatDans(prop);
    for (const [re, type] of PIECES) {
      const avecNombre = new RegExp(`(?:${NB}\\s+)?(${re.source})(?:\\s+(?:de|d'environ|d'|fait|faisant)?\\s*(\\d+(?:[.,]\\d+)?) m2)?`, "g");
      for (const m of prop.matchAll(avecNombre)) {
        const n = nombre(m[1]) ?? 1;
        const s = m[3] ? Number(m[3].replace(",", ".")) : null;
        // « une chambre de 12 m2 » ou « 2 chambres » ; une surface donne une seule pièce
        for (let i = 0; i < (s ? 1 : Math.min(n, 8)); i++) {
          const piece: Piece = { id: idPiece(), type, surface: s, etat: etat ?? "bon" };
          if (!etat) sansEtat.add(piece.id);
          c.pieces.push(piece);
        }
      }
    }
  }
  // État global (« tout à refaire ») pour les pièces citées sans état, et pièces manquantes d'une typologie (T3…)
  const etatGlobal: EtatPiece = c.forfait === "rehabilitation" ? "refaire" : c.forfait === "global" ? "renover" : c.forfait === "rafraichissement" ? "rafraichir" : "bon";
  for (const p of c.pieces) if (sansEtat.has(p.id)) p.etat = etatGlobal;
  if (c.typologie) {
    const types: TypePiece[] = ["sejour", "cuisine", "salle_de_bain", "wc", ...Array.from({ length: Math.max(0, c.typologie - 1) }, () => "chambre" as const)];
    for (const type of new Set(types)) {
      const manque = types.filter((x) => x === type).length - c.pieces.filter((p) => p.type === type).length;
      for (let i = 0; i < manque; i++) c.pieces.push({ id: idPiece(), type, surface: null, etat: etatGlobal });
    }
  }

  // Toutes les surfaces citées sont celles des pièces : pas de surface globale
  const surfPieces = c.pieces.filter((p) => p.surface != null).length;
  if (surfPieces && surfPieces >= surfaces.length) delete c.surface;

  // ----- Éléments généraux
  if (/electricite[^,.;]*(pas aux normes|hors normes|a refaire|vetuste|ancienne|dangereuse|a reprendre)|(pas|plus) aux normes|tableau electrique ancien/.test(t)) c.general.electricite = "a_refaire";
  else if (/electricite[^,.;]*(aux normes|refaite|recente|ok|bonne)/.test(t)) c.general.electricite = "ok";
  if (/pas de chauffage|sans chauffage|aucun chauffage/.test(t)) c.general.chauffage = "absent";
  else if (/convecteurs?|grille-pain|chauffage electrique|radiateurs? electriques?|chauffage[^,.;]*(ancien|vetuste|a refaire|a changer)|chaudiere[^,.;]*(ancienne|hs|en panne|a changer|fioul)|\bfioul\b/.test(t)) c.general.chauffage = "electrique_ancien";
  else if (/pompe a chaleur|\bpac\b|clim(atisation)? reversible|chaudiere[^,.;]*(recente|neuve|condensation)/.test(t)) c.general.chauffage = "ok";
  if (/simple vitrage|fenetres?[^,.;]*(a changer|anciennes|bois anciennes|a remplacer)/.test(t)) c.general.menuiseries = "simple_vitrage";
  else if (/double vitrage/.test(t)) c.general.menuiseries = "ok";
  const fen = t.match(new RegExp(`${NB} (?:fenetres|ouvertures|menuiseries)`));
  if (fen) c.general.nbFenetres = nombre(fen[1]);
  if (/plomberie[^,.;]*(a refaire|ancienne|vetuste|plomb|fuite)|canalisations?[^,.;]*(plomb|a refaire)/.test(t)) c.general.plomberie = "a_refaire";
  if (/mur porteur|ouvrir (la|le|une|un) (cuisine|mur|cloison porteuse)|ipn|reprise de structure|plancher bois a reprendre|structure a reprendre/.test(t)) c.general.structure = "a_reprendre";
  else if (/fissures?/.test(t)) c.general.structure = "fissures";
  if (/toiture[^,.;]*(a refaire|a reprendre|fuyarde|infiltration)|toit[^,.;]*(a refaire|fuit)/.test(t)) c.general.toiture = "a_refaire";
  if (/facade[^,.;]*(a refaire|a ravaler|abimee)|ravalement/.test(t)) c.general.facade = "a_refaire";

  // ----- Projet
  const div = t.match(new RegExp(`divis(?:er|ion)[^,.;]*?(?:en )?${NB} (?:lots|logements|appartements|studios|t\\d)`));
  if (div) { c.projet.division = true; c.projet.nbLots = nombre(div[1]) ?? 2; }
  else if (/division en lots|diviser en lots|creer des lots|division de l'immeuble/.test(t)) { c.projet.division = true; c.projet.nbLots = 2; }
  if (/division (fonciere|parcellaire)|detacher (une|un|le|la) (parcelle|terrain|lot)|terrain a diviser|terrain a batir/.test(t)) c.projet.divisionFonciere = true;
  if (/(creer|creation d'une|avec une) (voie|impasse|acces commun)|lotissement/.test(t)) c.projet.voieCommune = true;
  if (/changement de destination|local commercial|ancien commerce|bureaux? (a transformer|en logements?)|transformer (le|un) (local|bureau|commerce|garage)|plateau/.test(t)) c.projet.changementDestination = true;
  const creee = creeeTxt;
  if (creee) c.projet.surfaceCreee = Number(creee[1].replace(",", "."));
  else if (/surelevation|extension|amenager les combles|combles a amenager/.test(t)) c.projet.surfaceCreee = 20;
  const park = t.match(new RegExp(`${NB} (?:places? de (?:parking|stationnement)|parkings?|stationnements?)`));
  if (park) c.projet.placesParking = nombre(park[1]) ?? 1;
  else if (/(creer|creation d'une?|ajouter) (une )?(place de )?(parking|stationnement)/.test(t)) c.projet.placesParking = 1;
  if (/\bcopro(priete)?\b|\bsyndic\b|parties communes/.test(t)) c.projet.copropriete = true;
  if (/fosse septique|assainissement individuel|\bspanc\b/.test(t)) c.projet.assainissement = "fosse";
  else if (/tout a l'egout|assainissement collectif/.test(t)) c.projet.assainissement = "collectif";
  if (/compteurs? a creer|creer (des|les) compteurs|pas de compteur/.test(t)) c.projet.compteursACreer = true;
  if (/moins de (5|cinq) ans|construction recente de moins/.test(t)) c.projet.acheveMoinsDe5Ans = true;
  if (/changer (les|toutes les) fenetres|ravalement|modifier la facade|creer (une|des) ouvertures?|velux/.test(t)) c.projet.modifFacade = true;

  // ----- Résumé lisible
  if (c.typologie) c.resume.push(`T${c.typologie}`);
  if (c.surface) c.resume.push(`${c.surface} m²`);
  if (c.dpe) c.resume.push(`DPE ${c.dpe}`);
  if (c.forfait) c.resume.push(`approche : ${c.forfait === "rafraichissement" ? "rafraîchissement" : c.forfait === "global" ? "rénovation globale" : "réhabilitation lourde"}`);
  if (c.gamme) c.resume.push(`gamme ${c.gamme === "bas" ? "entrée" : c.gamme === "haut" ? "haute" : "moyenne"}`);
  const parType = new Map<string, number>();
  for (const p of c.pieces) {
    const k = `${LIBELLES_PIECES[p.type]}${p.surface ? ` ${p.surface} m²` : ""} · ${LIBELLES_ETATS[p.etat].toLowerCase()}`;
    parType.set(k, (parType.get(k) ?? 0) + 1);
  }
  for (const [k, n] of parType) c.resume.push(n > 1 ? `${n} × ${k}` : k);
  const gl = c.general;
  if (gl.electricite === "a_refaire") c.resume.push("électricité à refaire");
  if (gl.chauffage && gl.chauffage !== "ok") c.resume.push(gl.chauffage === "absent" ? "pas de chauffage" : "chauffage à remplacer");
  if (gl.menuiseries === "simple_vitrage") c.resume.push(`simple vitrage${gl.nbFenetres ? ` (${gl.nbFenetres} fenêtres)` : ""}`);
  if (gl.plomberie === "a_refaire") c.resume.push("plomberie à refaire");
  if (gl.structure === "a_reprendre") c.resume.push("structure à reprendre");
  if (gl.structure === "fissures") c.resume.push("fissures");
  if (gl.toiture === "a_refaire") c.resume.push("toiture à refaire");
  if (gl.facade === "a_refaire") c.resume.push("façade à refaire");
  if (gl.anneeConstruction) c.resume.push(`construit en ${gl.anneeConstruction}`);
  const pj = c.projet;
  if (pj.division) c.resume.push(`division en ${pj.nbLots} lots`);
  if (pj.divisionFonciere) c.resume.push("division foncière");
  if (pj.voieCommune) c.resume.push("voie commune");
  if (pj.changementDestination) c.resume.push("changement de destination");
  if (pj.surfaceCreee) c.resume.push(`${pj.surfaceCreee} m² créés`);
  if (pj.placesParking) c.resume.push(`${pj.placesParking} place(s) de parking`);
  if (pj.copropriete) c.resume.push("copropriété");
  if (pj.assainissement === "fosse") c.resume.push("fosse septique");
  if (pj.modifFacade) c.resume.push("modification de façade");
  return c;
}
