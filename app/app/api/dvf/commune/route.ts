import { statsCommune, ventesCommune, type TypeBien } from "@/lib/sources/dvf";
import { estEnOccitanie } from "@/lib/sources/occitanie";
import { erreur, ok, tenter } from "@/lib/api/reponse";

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const insee = p.get("insee") ?? "";
  const type = (p.get("type") ?? "Maison") as TypeBien;
  if (!estEnOccitanie(insee)) return erreur("Commune hors Occitanie.", 422);
  const r = await tenter(() => ventesCommune(insee));
  if (!r.ok) return erreur(r.erreur, 502);
  return ok({ total: r.data.length, ...statsCommune(r.data, type) });
}
