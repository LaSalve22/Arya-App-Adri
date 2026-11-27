// Risques naturels et technologiques (Géorisques) et DPE à proximité (ADEME).
import { getJSON } from "./http";

export interface Risques {
  commune: string | null;
  risques: string[];
  argiles: string | null; // exposition au retrait-gonflement des argiles
  lienRapport: string;
}

export async function risques(lon: number, lat: number): Promise<Risques> {
  const lienRapport = `https://www.georisques.gouv.fr/mes-risques/connaitre-les-risques-pres-de-chez-moi/rapport2?form-adresse=true&isCadastre=false&lon=${lon}&lat=${lat}`;
  const [g, a] = await Promise.allSettled([
    getJSON<{ data: { libelle_commune: string; risques_detail: { num_risque: string; libelle_risque_long: string }[] }[] }>(
      `https://georisques.gouv.fr/api/v1/gaspar/risques?latlon=${lon},${lat}&rayon=100`,
      "Géorisques",
      86400_000,
    ),
    getJSON<{ data: { exposition: string }[] }>(`https://georisques.gouv.fr/api/v1/rga?latlon=${lon},${lat}`, "Géorisques", 86400_000),
  ]);
  const d = g.status === "fulfilled" ? g.value.data[0] : undefined;
  // On garde les risques « parents » (codes à 2 chiffres) pour une liste lisible.
  const liste = d?.risques_detail.filter((r) => r.num_risque.length <= 2).map((r) => r.libelle_risque_long) ?? [];
  const argiles = a.status === "fulfilled" ? a.value.data?.[0]?.exposition ?? null : null;
  return { commune: d?.libelle_commune ?? null, risques: liste, argiles, lienRapport };
}

export interface DPE {
  numero: string;
  date: string;
  etiquette: string;
  ges: string;
  surface: number | null;
  adresse: string;
  typeBatiment: string;
  consoM2: number | null;
  anneeConstruction: number | null;
  distance: number; // mètres
}

interface LigneADEME {
  numero_dpe: string;
  date_etablissement_dpe: string;
  etiquette_dpe: string;
  etiquette_ges: string;
  surface_habitable_logement: number | null;
  adresse_ban: string;
  type_batiment: string;
  conso_5_usages_par_m2_ep: number | null;
  annee_construction: number | null;
  _geo_distance: number;
}

export async function dpeProches(lon: number, lat: number, rayonM = 150): Promise<DPE[]> {
  const champs = "numero_dpe,date_etablissement_dpe,etiquette_dpe,etiquette_ges,surface_habitable_logement,adresse_ban,type_batiment,conso_5_usages_par_m2_ep,annee_construction";
  const url = `https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines?size=30&geo_distance=${lon},${lat},${rayonM}m&select=${champs}&sort=-date_etablissement_dpe`;
  const d = await getJSON<{ results: LigneADEME[] }>(url, "ADEME (DPE)", 86400_000);
  return d.results.map((r) => ({
    numero: r.numero_dpe,
    date: r.date_etablissement_dpe,
    etiquette: r.etiquette_dpe,
    ges: r.etiquette_ges,
    surface: r.surface_habitable_logement,
    adresse: r.adresse_ban,
    typeBatiment: r.type_batiment,
    consoM2: r.conso_5_usages_par_m2_ep,
    anneeConstruction: r.annee_construction,
    distance: Math.round((r._geo_distance ?? 0) * 1000) / 1000,
  }));
}
