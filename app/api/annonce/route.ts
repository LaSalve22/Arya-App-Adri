import { lireAnnonce } from "@/lib/annonce/lecture";
import { erreur, ok, tenter } from "@/lib/api/reponse";

export const maxDuration = 20;

// Lecture d'une annonce : texte collé ou partagé, avec ou sans lien. Ne renvoie jamais d'impasse :
// la fiche est pré-remplie avec ce qui est lisible, et un guide indique comment compléter (favori).
export async function POST(req: Request) {
  const { texte } = (await req.json().catch(() => ({}))) as { texte?: string };
  if (!texte?.trim()) return erreur("Collez le texte ou le lien de l'annonce.");
  const r = await tenter(() => lireAnnonce(texte));
  return r.ok ? ok(r.data) : erreur(r.erreur, 502);
}
