// Calcule tous les résultats d'une analyse à partir de son état (utilisé par les onglets et le PDF).
import { calculerBilan } from "./bilan/calcul";
import { calculerFinancement, planFinancement } from "./bilan/financement";
import { calculerSortie } from "./bilan/profil";
import { calculerResidencePrincipale } from "./bilan/residence";
import { prixMaxPourMarge, sensibilite } from "./bilan/nego";
import type { EtatAnalyse } from "./etat";

export function analyser(e: EtatAnalyse) {
  const h = e.hypotheses;
  const r = calculerBilan(h);
  const fin = calculerFinancement(h.financement.sources ?? [], h.financement.dureeMois);
  const plan = planFinancement(
    { foncier: r.foncier.total.ttc, technique: r.technique.total.ttc, honorairesEtFrais: r.honorairesDivers.ttc + r.fraisDivers.total },
    fin,
  );
  const cca = (h.financement.sources ?? []).filter((s) => s.type === "compte_courant").reduce((a, s) => a + s.montant, 0);
  const sortie = calculerSortie(e.profil, r.beneficeNetSociete, r.beneficeBrut, r.impot, cca);
  const rp = calculerResidencePrincipale(h, e.rp);
  const prixMax = (["down", "moyen", "top"] as const).map((s) => ({ scenario: s, prix: prixMaxPourMarge(h, e.margeCible, s) }));
  const sens = e.prixAffiche > 0 ? sensibilite(h, e.prixAffiche) : [];
  return { r, fin, plan, sortie, rp, prixMax, sens };
}

export type Analyse = ReturnType<typeof analyser>;
