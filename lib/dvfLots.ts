// Estimation du prix de revente d'un lot avec les ventes DVF de même nature (côté navigateur).
import type { Lot, NatureLot } from "./bilan/types";
import type { TypeBien } from "./sources/dvf";

export const NATURES_LOT: [NatureLot, string][] = [
  ["Appartement", "Appartement"],
  ["Maison", "Maison"],
  ["Local", "Local commercial"],
  ["Garage", "Garage, box"],
  ["Parking", "Place de parking"],
  ["Terrain", "Terrain à bâtir"],
];

/** Type DVF correspondant : garages et parkings sont des « dépendances » vendues à l'unité. */
export function typeDVF(n: NatureLot): TypeBien {
  return n === "Garage" || n === "Parking" ? "Dependance" : n;
}
export const parUnite = (n: NatureLot | undefined) => n === "Garage" || n === "Parking";

/** Nature par défaut d'un lot selon le type du bien analysé. */
export function natureParDefaut(typeBien: string): NatureLot {
  if (typeBien === "Maison" || typeBien === "Local" || typeBien === "Terrain") return typeBien;
  return "Appartement";
}

export interface EstimationLot {
  prixBas: number;
  prixHaut: number;
  nb: number;
  rayon: number;
}

interface Stats { rayon: number; stats: { nb: number; p25: number; p75: number } }
const cache = new Map<string, Promise<Stats | null>>();

/** Prix bas (quartile bas) et haut (quartile haut) d'un lot, d'après les ventes DVF autour du bien. */
export async function estimerLot(lot: Lot, bien: { lon: number; lat: number; insee: string }, natureDefaut: NatureLot): Promise<EstimationLot | null> {
  const nature = lot.nature ?? natureDefaut;
  const unite = parUnite(nature);
  const surface = unite ? null : lot.surface || null;
  if (!unite && !surface) return null;
  const q = new URLSearchParams({ insee: bien.insee, lon: String(bien.lon), lat: String(bien.lat), type: typeDVF(nature), min: "6" });
  if (surface) q.set("surface", String(surface));
  const cle = q.toString();
  if (!cache.has(cle)) {
    cache.set(cle, fetch(`/api/dvf/comparables?${q}`).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  }
  const d = await cache.get(cle)!;
  if (!d?.stats?.nb) return null;
  const arrondi = (v: number) => (unite ? Math.round(v / 100) * 100 : Math.round(v / 1000) * 1000);
  const mult = unite ? 1 : surface!;
  return { prixBas: arrondi(d.stats.p25 * mult), prixHaut: arrondi(d.stats.p75 * mult), nb: d.stats.nb, rayon: d.rayon };
}
