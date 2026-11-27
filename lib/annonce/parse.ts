// Lecture d'une annonce immobilière collée en texte libre.
// Version à base d'expressions régulières : l'agent IA pourra la remplacer en gardant la même sortie.

export interface AnnonceAnalysee {
  prix: number | null;
  surface: number | null;
  terrain: number | null;
  pieces: number | null;
  chambres: number | null;
  type: "Maison" | "Appartement" | "Terrain" | "Immeuble" | null;
  dpe: string | null;
  codePostal: string | null;
  ville: string | null;
  champsTrouves: string[];
}

const nombre = (s: string) => parseFloat(s.replace(/[\s  .]/g, "").replace(",", "."));

export function analyserAnnonce(texte: string): AnnonceAnalysee {
  const t = texte.replace(/ | /g, " ");
  const bas = t.toLowerCase();
  const r: AnnonceAnalysee = {
    prix: null, surface: null, terrain: null, pieces: null, chambres: null, type: null, dpe: null, codePostal: null, ville: null, champsTrouves: [],
  };

  // Prix : le plus grand montant suivi de € ou « euros » (les honoraires et charges sont plus petits).
  const montants = [...t.matchAll(/(\d{1,3}(?:[ .]\d{3})+|\d{4,})(?:,\d+)?\s*(?:€|euros?|eur\b)/gi)].map((m) => nombre(m[1]));
  const prixPossibles = montants.filter((m) => m >= 10000 && m < 50_000_000);
  if (prixPossibles.length) r.prix = Math.max(...prixPossibles);

  // Terrain : « terrain de 600 m² », « sur 600 m² de terrain », « parcelle de 600 m² »
  const terrain =
    bas.match(/(?:terrain|parcelle|jardin)\s*(?:de|d'environ|:)?\s*(\d[\d\s.,]*)\s*m(?:²|2)/) ??
    bas.match(/(\d[\d\s.,]*)\s*m(?:²|2)\s*de\s*(?:terrain|parcelle|jardin)/);
  if (terrain) r.terrain = nombre(terrain[1]);

  // Surface habitable : mention explicite, sinon la première surface qui n'est pas le terrain.
  const hab = bas.match(/(?:surface\s*(?:habitable)?|habitable|carrez)\s*(?:de|d'environ|:)?\s*(\d[\d\s.,]*)\s*m(?:²|2)/);
  if (hab) r.surface = nombre(hab[1]);
  else {
    const surfaces = [...bas.matchAll(/(\d[\d\s.,]{0,8})\s*m(?:²|2)/g)].map((m) => nombre(m[1])).filter((s) => s > 8 && s !== r.terrain);
    if (surfaces.length) r.surface = surfaces[0];
  }

  const pieces = bas.match(/(\d+)\s*pi[eè]ces?/) ?? bas.match(/\b[tf](\d)\b/);
  if (pieces) r.pieces = parseInt(pieces[1]);
  const chambres = bas.match(/(\d+)\s*chambres?/);
  if (chambres) r.chambres = parseInt(chambres[1]);

  if (/\bimmeuble\b/.test(bas)) r.type = "Immeuble";
  else if (/\b(maison|villa|mas|pavillon|longère|corps de ferme)\b/.test(bas)) r.type = "Maison";
  else if (/\b(appartement|studio|duplex|triplex|loft)\b|\b[tf]\d\b/.test(bas)) r.type = "Appartement";
  else if (/\bterrain\b/.test(bas)) r.type = "Terrain";

  const dpe =
    bas.match(/(?:dpe|classe\s*(?:é|e)nerg(?:ie|étique)|diagnostic\s*de\s*performance\s*(?:é|e)nerg(?:é|e)tique|consommation\s*(?:é|e)nerg(?:é|e)tique)\s*[:\-]?\s*(?:classe\s*)?([a-g])\b/) ??
    bas.match(/\bclasse\s*([a-g])\b/);
  if (dpe) r.dpe = dpe[1].toUpperCase();

  const cp = t.match(/\b((?:09|11|12|30|31|32|34|46|48|65|66|81|82)\d{3})\b(?:\s+([A-ZÉÈÀÂÎÔÛ][\wÀ-ÿ'\- ]{1,40}))?/);
  if (cp) {
    r.codePostal = cp[1];
    if (cp[2]) r.ville = cp[2].split(/\s{2,}|\n|,|\./)[0].trim();
  }

  r.champsTrouves = (Object.keys(r) as (keyof AnnonceAnalysee)[]).filter((k) => k !== "champsTrouves" && r[k] != null);
  return r;
}
