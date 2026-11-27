import { comparables, ventesCommune, type TypeBien } from "@/lib/sources/dvf";
import { estEnOccitanie } from "@/lib/sources/occitanie";
import { erreur, nombre, ok, tenter } from "@/lib/api/reponse";

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const insee = p.get("insee") ?? "";
  const lon = nombre(p.get("lon"));
  const lat = nombre(p.get("lat"));
  const type = (p.get("type") ?? "Maison") as TypeBien;
  if (!estEnOccitanie(insee)) return erreur("Commune hors Occitanie.", 422);
  if (lon == null || lat == null) return erreur("Coordonnées manquantes.");
  const r = await tenter(() => ventesCommune(insee));
  if (!r.ok) return erreur(r.erreur, 502);
  return ok(
    comparables(r.data, {
      lon,
      lat,
      type,
      surface: nombre(p.get("surface")) ?? undefined,
      toleranceSurface: nombre(p.get("tolerance")) ?? undefined,
      rayonM: nombre(p.get("rayon")) ?? undefined,
      minResultats: nombre(p.get("min")) ?? undefined,
    }),
  );
}
