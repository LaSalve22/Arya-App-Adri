import { geocoder } from "@/lib/sources/geo";
import { erreur, ok, tenter } from "@/lib/api/reponse";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const r = await tenter(() => geocoder(q));
  return r.ok ? ok(r.data) : erreur(r.erreur, 502);
}
