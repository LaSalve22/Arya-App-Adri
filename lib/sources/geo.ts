// Géocodage (Base Adresse Nationale via la Géoplateforme) et communes d'Occitanie (geo.api.gouv.fr).
import { getJSON } from "./http";
import { estEnOccitanie } from "./occitanie";

export interface Adresse {
  label: string;
  lon: number;
  lat: number;
  codeInsee: string;
  codePostal: string;
  commune: string;
  type: string; // housenumber, street, municipality…
  score: number;
}

interface FeatureBAN {
  geometry: { coordinates: [number, number] };
  properties: { label: string; citycode: string; postcode: string; city: string; type: string; score: number };
}

export async function geocoder(q: string, limite = 6): Promise<Adresse[]> {
  if (q.trim().length < 3) return [];
  // On demande large puis on ne garde que les adresses d'Occitanie.
  const url = `https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(q)}&limit=${Math.max(15, limite * 3)}`;
  const d = await getJSON<{ features: FeatureBAN[] }>(url, "Base Adresse Nationale", 86400_000);
  return d.features
    .map((f) => ({
      label: f.properties.label,
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      codeInsee: f.properties.citycode,
      codePostal: f.properties.postcode,
      commune: f.properties.city,
      type: f.properties.type,
      score: f.properties.score,
    }))
    .filter((a) => estEnOccitanie(a.codeInsee))
    .slice(0, limite);
}

export interface Commune {
  nom: string;
  code: string;
  codeDepartement: string;
  codesPostaux: string[];
  population?: number;
  centre?: { lon: number; lat: number };
}

export async function communesOccitanie(): Promise<Commune[]> {
  const url = "https://geo.api.gouv.fr/communes?codeRegion=76&fields=nom,code,codesPostaux,codeDepartement,population,centre&format=json";
  const d = await getJSON<(Commune & { centre?: { coordinates: [number, number] } })[]>(url, "geo.api.gouv.fr", 7 * 86400_000);
  return d.map((c) => ({
    nom: c.nom,
    code: c.code,
    codeDepartement: c.codeDepartement,
    codesPostaux: c.codesPostaux,
    population: c.population,
    centre: c.centre ? { lon: (c.centre as unknown as { coordinates: number[] }).coordinates[0], lat: (c.centre as unknown as { coordinates: number[] }).coordinates[1] } : undefined,
  }));
}
