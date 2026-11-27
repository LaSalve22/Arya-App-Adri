import { analyserAnnonce } from "@/lib/annonce/parse";
import { geocoder } from "@/lib/sources/geo";
import { erreur, ok, tenter } from "@/lib/api/reponse";

export async function POST(req: Request) {
  const { texte } = (await req.json().catch(() => ({}))) as { texte?: string };
  if (!texte?.trim()) return erreur("Collez le texte de l'annonce.");
  const annonce = analyserAnnonce(texte);
  const q = [annonce.codePostal, annonce.ville].filter(Boolean).join(" ");
  const lieu = q ? await tenter(() => geocoder(q, 1)) : null;
  return ok({ annonce, lieu: lieu && lieu.ok ? lieu.data[0] ?? null : null });
}
