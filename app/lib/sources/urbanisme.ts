// Zonage du document d'urbanisme (Géoportail de l'Urbanisme, via l'API Carto de l'IGN).
import { getJSON } from "./http";

export interface ZonePLU {
  libelle: string; // ex. UA, U2, N…
  libelleLong: string | null;
  typeZone: string | null; // U, AU, A, N
  document: string | null; // identifiant du document (idurba)
  reglementPdf: string | null;
  dateValidation: string | null;
}

export interface InfosUrbanisme {
  zone: ZonePLU | null;
  lienGeoportail: string;
  message?: string;
}

const TYPES: Record<string, string> = { U: "Zone urbaine", AU: "Zone à urbaniser", A: "Zone agricole", N: "Zone naturelle" };
export const libelleTypeZone = (t: string | null) => (t ? TYPES[t.replace(/[^A-Z]/g, "")] ?? t : "");

interface FeatureZone {
  properties: {
    libelle: string;
    libelong: string | null;
    typezone: string | null;
    idurba: string | null;
    nomfic: string | null;
    urlfic: string | null;
    datvalid: string | null;
    gpu_doc_id: string | null;
  };
}

export async function zonePLU(lon: number, lat: number): Promise<InfosUrbanisme> {
  const geom = encodeURIComponent(JSON.stringify({ type: "Point", coordinates: [lon, lat] }));
  const lienGeoportail = `https://www.geoportail-urbanisme.gouv.fr/map/#tile=1&lon=${lon}&lat=${lat}&zoom=18`;
  const d = await getJSON<{ features: FeatureZone[] }>(`https://apicarto.ign.fr/api/gpu/zone-urba?geom=${geom}`, "Géoportail de l'Urbanisme", 86400_000);
  // Un plan de sauvegarde (PSMV) peut se superposer au PLU : on privilégie la zone du PLU quand il y en a une.
  const f = d.features.find((x) => !/PSMV/i.test(x.properties.libelle)) ?? d.features[0];
  if (!f) {
    return {
      zone: null,
      lienGeoportail,
      message: "Aucun zonage publié sur le Géoportail de l'Urbanisme à cet endroit (document non numérisé ou commune au RNU). Vérifiez en mairie.",
    };
  }
  const p = f.properties;
  const pdf =
    p.urlfic ||
    (p.gpu_doc_id && p.nomfic ? `https://data.geopf.fr/annexes/gpu/documents/${p.idurba?.split("_")[0] ?? ""}/${p.gpu_doc_id}/${p.nomfic}` : null);
  return {
    zone: {
      libelle: p.libelle,
      libelleLong: p.libelong,
      typeZone: p.typezone,
      document: p.idurba,
      reglementPdf: pdf,
      dateValidation: p.datvalid,
    },
    lienGeoportail,
  };
}
