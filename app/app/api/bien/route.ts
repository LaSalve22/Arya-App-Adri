import { centreParcelle, construireIdu, parcelleAuPoint, parcelleParIdu } from "@/lib/sources/cadastre";
import { zonePLU } from "@/lib/sources/urbanisme";
import { dpeProches, risques } from "@/lib/sources/risques";
import { estEnOccitanie } from "@/lib/sources/occitanie";
import { erreur, nombre, ok, tenter } from "@/lib/api/reponse";

// Fiche d'un bien : parcelle, urbanisme, risques et DPE à proximité, à partir d'un point ou d'une parcelle.
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  let lon = nombre(p.get("lon"));
  let lat = nombre(p.get("lat"));
  let idu = p.get("idu");
  if (!idu && p.get("insee") && p.get("section") && p.get("numero")) idu = construireIdu(p.get("insee")!, p.get("section")!, p.get("numero")!);

  const parcelle = await tenter(() => (idu ? parcelleParIdu(idu) : lon != null && lat != null ? parcelleAuPoint(lon, lat) : Promise.resolve(null)));
  if (idu) {
    if (!parcelle.ok) return erreur(parcelle.erreur, 502);
    if (!parcelle.data) return erreur(`Parcelle ${idu} introuvable au cadastre.`, 404);
    ({ lon, lat } = centreParcelle(parcelle.data));
  }
  if (lon == null || lat == null) return erreur("Indiquez une adresse ou une parcelle.");
  const insee = parcelle.ok && parcelle.data ? parcelle.data.codeInsee : p.get("insee");
  if (insee && !estEnOccitanie(insee)) return erreur("MADRIMMO couvre pour l'instant uniquement l'Occitanie.", 422);

  const [urbanisme, risquesR, dpe] = await Promise.all([tenter(() => zonePLU(lon!, lat!)), tenter(() => risques(lon!, lat!)), tenter(() => dpeProches(lon!, lat!))]);
  return ok({ lon, lat, codeInsee: insee, parcelle, urbanisme, risques: risquesR, dpe });
}
