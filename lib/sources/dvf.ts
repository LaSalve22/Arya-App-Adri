// Demandes de valeurs foncières géolocalisées (Etalab, fichiers par commune et par année).
import { getTexteCacheDisque } from "./http";
import { estEnOccitanie } from "./occitanie";

export type TypeBien = "Maison" | "Appartement" | "Terrain" | "Local";

export interface Vente {
  id: string;
  date: string;
  prix: number;
  type: TypeBien;
  surface: number; // bâti (m²) ou terrain pour un terrain nu
  pieces: number | null;
  terrain: number | null;
  lon: number | null;
  lat: number | null;
  adresse: string;
  parcelle: string;
  prixM2: number;
  distance?: number;
}

const ANNEES = [2021, 2022, 2023, 2024, 2025];

/** Découpe une ligne CSV en tenant compte des guillemets. */
function decouper(ligne: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (c === '"') {
      if (q && ligne[i + 1] === '"') { cur += '"'; i++; } else q = !q;
    } else if (c === "," && !q) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/**
 * Regroupe les lignes par mutation. Une vente DVF peut compter plusieurs lignes (lots, dépendances, parcelles).
 * On garde les ventes simples : un seul logement (maison ou appartement, dépendances tolérées),
 * ou un terrain nu, ou un seul local d'activité.
 */
export function parserDVF(csv: string): Vente[] {
  const lignes = csv.split(/\r?\n/).filter(Boolean);
  if (lignes.length < 2) return [];
  const entete = decouper(lignes[0]);
  const ix = (n: string) => entete.indexOf(n);
  const I = {
    id: ix("id_mutation"), date: ix("date_mutation"), nature: ix("nature_mutation"), valeur: ix("valeur_fonciere"),
    num: ix("adresse_numero"), voie: ix("adresse_nom_voie"), cp: ix("code_postal"), commune: ix("nom_commune"),
    parcelle: ix("id_parcelle"), type: ix("type_local"), surf: ix("surface_reelle_bati"), pieces: ix("nombre_pieces_principales"),
    culture: ix("code_nature_culture"), terrain: ix("surface_terrain"), lon: ix("longitude"), lat: ix("latitude"),
  };
  const groupes = new Map<string, string[][]>();
  for (let k = 1; k < lignes.length; k++) {
    const c = decouper(lignes[k]);
    if (c[I.nature] !== "Vente") continue;
    const g = groupes.get(c[I.id]);
    if (g) g.push(c); else groupes.set(c[I.id], [c]);
  }
  const ventes: Vente[] = [];
  for (const [id, rows] of groupes) {
    const prix = parseFloat(rows[0][I.valeur]);
    if (!prix || prix < 1000) continue;
    const locaux = new Map<string, string[]>(); // un local peut apparaître sur plusieurs lignes (plusieurs parcelles)
    for (const r of rows) if (r[I.type] && r[I.type] !== "Dépendance") locaux.set(`${r[I.type]}|${r[I.surf]}|${r[I.pieces]}`, r);
    const parcelles = new Map<string, number>();
    for (const r of rows) if (r[I.parcelle]) parcelles.set(r[I.parcelle] + r[I.culture], parseFloat(r[I.terrain]) || 0);
    const terrain = [...parcelles.values()].reduce((a, b) => a + b, 0) || null;
    const r0 = locaux.size ? [...locaux.values()][0] : rows[0];
    const base = {
      id,
      date: r0[I.date],
      prix,
      lon: parseFloat(r0[I.lon]) || null,
      lat: parseFloat(r0[I.lat]) || null,
      adresse: [r0[I.num], r0[I.voie], r0[I.cp], r0[I.commune]].filter(Boolean).join(" "),
      parcelle: r0[I.parcelle],
    };
    if (locaux.size === 1) {
      const t = r0[I.type];
      const surface = parseFloat(r0[I.surf]);
      if (!surface) continue;
      const type: TypeBien = t === "Maison" || t === "Appartement" ? t : "Local";
      ventes.push({ ...base, type, surface, pieces: parseInt(r0[I.pieces]) || null, terrain, prixM2: prix / surface });
    } else if (locaux.size === 0 && terrain && rows.some((r) => r[I.culture] === "AB")) {
      // Terrain à bâtir (code de nature de culture « AB »)
      ventes.push({ ...base, type: "Terrain", surface: terrain, pieces: null, terrain, prixM2: prix / terrain });
    }
  }
  return ventes;
}

export async function ventesCommune(codeInsee: string): Promise<Vente[]> {
  if (!estEnOccitanie(codeInsee)) throw new Error("Commune hors Occitanie");
  const dep = codeInsee.slice(0, 2);
  const textes = await Promise.all(
    ANNEES.map((a) =>
      getTexteCacheDisque(
        `https://files.data.gouv.fr/geo-dvf/latest/csv/${a}/communes/${dep}/${codeInsee}.csv`,
        `dvf/${a}/${codeInsee}.csv`,
        "DVF",
        24 * 3600_000,
      ).catch(() => null),
    ),
  );
  return textes.flatMap((t) => (t ? parserDVF(t) : [])).sort((a, b) => b.date.localeCompare(a.date));
}

export function distanceM(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function quantile(trie: number[], q: number): number {
  if (!trie.length) return 0;
  const pos = (trie.length - 1) * q;
  const b = Math.floor(pos);
  const r = pos - b;
  return trie[b + 1] !== undefined ? trie[b] + r * (trie[b + 1] - trie[b]) : trie[b];
}

export interface StatsPrix {
  nb: number;
  p25: number;
  mediane: number;
  p75: number;
  moyenne: number;
}

export function statsPrixM2(ventes: Vente[]): StatsPrix {
  const v = ventes.map((x) => x.prixM2).sort((a, b) => a - b);
  return {
    nb: v.length,
    p25: quantile(v, 0.25),
    mediane: quantile(v, 0.5),
    p75: quantile(v, 0.75),
    moyenne: v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0,
  };
}

export interface CriteresComparables {
  lon: number;
  lat: number;
  type: TypeBien;
  surface?: number;
  /** Écart de surface toléré : 0.3 = ±30 %. */
  toleranceSurface?: number;
  rayonM?: number;
  minResultats?: number;
}

/**
 * Comparables autour d'un point : même type, surface proche, rayon de 500 m élargi
 * progressivement (jusqu'à 3 km) tant qu'il y a moins de `minResultats` ventes.
 */
export function comparables(ventes: Vente[], c: CriteresComparables) {
  const tol = c.toleranceSurface ?? 0.3;
  const min = c.minResultats ?? 8;
  const candidats = ventes
    .filter((v) => v.type === c.type && v.lon != null && v.lat != null)
    .filter((v) => !c.surface || Math.abs(v.surface - c.surface) <= c.surface * tol)
    .map((v) => ({ ...v, distance: Math.round(distanceM(c.lon, c.lat, v.lon!, v.lat!)) }));
  let rayon = c.rayonM ?? 500;
  let liste = candidats.filter((v) => v.distance <= rayon);
  while (liste.length < min && rayon < 3000) {
    rayon = Math.min(3000, rayon * 2);
    liste = candidats.filter((v) => v.distance <= rayon);
  }
  // Écarte les valeurs aberrantes (moins de 30 % ou plus de 300 % de la médiane).
  const med = statsPrixM2(liste).mediane;
  const propres = med ? liste.filter((v) => v.prixM2 > med * 0.3 && v.prixM2 < med * 3) : liste;
  return { rayon, ventes: propres.sort((a, b) => b.date.localeCompare(a.date)), stats: statsPrixM2(propres) };
}

/** Statistiques d'une commune, par type de bien et par année. */
export function statsCommune(ventes: Vente[], type: TypeBien) {
  const v = ventes.filter((x) => x.type === type);
  const med = statsPrixM2(v).mediane;
  const propres = med ? v.filter((x) => x.prixM2 > med * 0.3 && x.prixM2 < med * 3) : v;
  const parAnnee = new Map<string, Vente[]>();
  for (const x of propres) {
    const a = x.date.slice(0, 4);
    parAnnee.set(a, [...(parAnnee.get(a) ?? []), x]);
  }
  return {
    global: statsPrixM2(propres),
    parAnnee: [...parAnnee.entries()].sort().map(([annee, l]) => ({ annee, ...statsPrixM2(l) })),
    dernieres: propres.slice(0, 40),
  };
}
