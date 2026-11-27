// Parcelles cadastrales (Parcellaire Express de l'IGN, service WFS de la Géoplateforme).
import { getJSON } from "./http";

export interface Parcelle {
  idu: string; // ex. 34172000HT0007
  codeInsee: string;
  commune: string;
  section: string;
  numero: string;
  contenance: number; // m²
  geometrie: GeoJSON.MultiPolygon | GeoJSON.Polygon;
}

interface FeatureWFS {
  geometry: GeoJSON.MultiPolygon;
  properties: { idu: string; code_insee: string; nom_com: string; section: string; numero: string; contenance: number };
}

const BASE =
  "https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle&outputFormat=application/json";

const versParcelle = (f: FeatureWFS): Parcelle => ({
  idu: f.properties.idu,
  codeInsee: f.properties.code_insee,
  commune: f.properties.nom_com,
  section: f.properties.section,
  numero: f.properties.numero,
  contenance: f.properties.contenance,
  geometrie: f.geometry,
});

/** Parcelle qui contient le point. En WFS 2.0 / EPSG:4326, l'ordre des axes est latitude puis longitude. */
export async function parcelleAuPoint(lon: number, lat: number): Promise<Parcelle | null> {
  const filtre = encodeURIComponent(`INTERSECTS(geom,POINT(${lat} ${lon}))`);
  const d = await getJSON<{ features: FeatureWFS[] }>(`${BASE}&count=1&CQL_FILTER=${filtre}`, "Cadastre IGN", 86400_000);
  return d.features[0] ? versParcelle(d.features[0]) : null;
}

/** Identifiant de parcelle à partir de la commune, de la section et du numéro. */
export function construireIdu(codeInsee: string, section: string, numero: string, prefixe = "000"): string {
  return `${codeInsee}${prefixe}${section.toUpperCase().padStart(2, "0")}${numero.padStart(4, "0")}`;
}

export async function parcelleParIdu(idu: string): Promise<Parcelle | null> {
  const filtre = encodeURIComponent(`idu='${idu.replace(/[^0-9A-Z]/gi, "")}'`);
  const d = await getJSON<{ features: FeatureWFS[] }>(`${BASE}&count=1&CQL_FILTER=${filtre}`, "Cadastre IGN", 86400_000);
  return d.features[0] ? versParcelle(d.features[0]) : null;
}

/** Centre approximatif d'une parcelle (moyenne des sommets), suffisant pour interroger les autres services. */
export function centreParcelle(p: Parcelle): { lon: number; lat: number } {
  const anneaux = p.geometrie.type === "MultiPolygon" ? p.geometrie.coordinates.flat() : p.geometrie.coordinates;
  const pts = anneaux.flat();
  const lon = pts.reduce((s, c) => s + c[0], 0) / pts.length;
  const lat = pts.reduce((s, c) => s + c[1], 0) / pts.length;
  return { lon, lat };
}
