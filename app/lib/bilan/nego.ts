import { calculerBilan } from "./calcul";
import type { Hypotheses, ScenarioRevente } from "./types";

export type Indicateur = "margeSurCA" | "beneficeNet" | "beneficeBrut";

/** Recalcule le bilan pour un prix d'achat donné (le reste des hypothèses est inchangé). */
export function bilanAuPrix(h: Hypotheses, prix: number, scenario?: ScenarioRevente) {
  return calculerBilan({ ...h, prixAcquisition: prix, scenario: scenario ?? h.scenario });
}

/**
 * Prix d'achat maximum pour atteindre une marge cible (bénéfice brut / CA, cellule E51).
 * La marge baisse quand le prix monte : recherche dichotomique à l'euro près.
 * Retourne null si la cible est inatteignable même à prix nul.
 */
export function prixMaxPourMarge(h: Hypotheses, margeCible: number, scenario?: ScenarioRevente): number | null {
  const m = (p: number) => bilanAuPrix(h, p, scenario).margeSurCA;
  let lo = 0;
  if (m(lo) < margeCible) return null;
  let hi = Math.max(100000, h.prixAcquisition * 2);
  while (m(hi) >= margeCible && hi < 1e10) hi *= 2;
  while (hi - lo > 1) {
    const mid = (lo + hi) / 2;
    if (m(mid) >= margeCible) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo);
}

export interface CelluleSensibilite {
  remise: number;
  prix: number;
  scenario: ScenarioRevente;
  margeSurCA: number;
  beneficeNet: number;
}

/** Tableau de sensibilité : remises sur le prix affiché × scénarios de revente. */
export function sensibilite(
  h: Hypotheses,
  prixAffiche: number,
  remises = [0, 0.05, 0.1, 0.15, 0.2],
  scenarios: ScenarioRevente[] = ["down", "moyen", "top"],
): CelluleSensibilite[][] {
  return remises.map((r) =>
    scenarios.map((s) => {
      const prix = Math.round(prixAffiche * (1 - r));
      const b = bilanAuPrix(h, prix, s);
      return { remise: r, prix, scenario: s, margeSurCA: b.margeSurCA, beneficeNet: b.beneficeNet };
    }),
  );
}
