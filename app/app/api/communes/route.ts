import { communesOccitanie } from "@/lib/sources/geo";
import { erreur, ok, tenter } from "@/lib/api/reponse";

export async function GET() {
  const r = await tenter(() => communesOccitanie());
  return r.ok ? ok(r.data) : erreur(r.erreur, 502);
}
