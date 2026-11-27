import { analyserAnnonce, estUnLien } from "@/lib/annonce/parse";
import { geocoder } from "@/lib/sources/geo";
import { erreur, ok, tenter } from "@/lib/api/reponse";

export async function POST(req: Request) {
  const { texte } = (await req.json().catch(() => ({}))) as { texte?: string };
  if (!texte?.trim()) return erreur("Collez le texte de l'annonce.");
  if (estUnLien(texte))
    return erreur(
      "Leboncoin et les autres sites bloquent la lecture automatique de leurs pages : collez le texte de l'annonce (titre, prix, lieu, critères, description) plutôt que le lien. Sur téléphone : ouvrez l'annonce, sélectionnez tout le texte, copiez, collez ici.",
    );
  const annonce = analyserAnnonce(texte);
  // Ville + code postal, puis code postal seul si la ville n'est pas reconnue.
  const essais = [[annonce.ville, annonce.codePostal].filter(Boolean).join(" "), annonce.codePostal ?? "", annonce.ville ?? ""].filter((q, i, a) => q && a.indexOf(q) === i);
  let lieu = null;
  for (const q of essais) {
    const r = await tenter(() => geocoder(q, 1));
    if (r.ok && r.data[0]) { lieu = r.data[0]; break; }
  }
  return ok({ annonce, lieu });
}
