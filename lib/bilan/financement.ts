// Coût des sources de financement d'une opération et plan de financement (besoins / ressources).
import type { SourceFinancement, TypeSource } from "./types";

export const LIBELLES_SOURCES: Record<TypeSource, string> = {
  fonds_propres: "Fonds propres",
  compte_courant: "Comptes courants d'associés",
  pret: "Ligne de crédit marchand (in fine, 24 mois max)",
  obligataire: "Levée obligataire / crowdfunding",
  associe_jv: "Associé en participation",
};

export function nouvelleSource(type: TypeSource, id = Math.random().toString(36).slice(2, 9)): SourceFinancement {
  const base = { id, type, libelle: LIBELLES_SOURCES[type], montant: 0, tauxAnnuel: 0, dureeMois: null, fraisDossier: 0, fraisGarantie: 0, commissionEngagementPct: 0, fraisPlateformePct: 0, partBenefice: 0 };
  if (type === "pret") return { ...base, tauxAnnuel: 0.05, fraisDossier: 1000 };
  if (type === "obligataire") return { ...base, tauxAnnuel: 0.1, fraisPlateformePct: 0.05 };
  if (type === "compte_courant") return { ...base, tauxAnnuel: 0.04 };
  if (type === "associe_jv") return { ...base, partBenefice: 0.3 };
  return base;
}

export interface CoutSource {
  id: string;
  type: TypeSource;
  libelle: string;
  montant: number;
  dureeMois: number;
  interets: number; // intérêts, coupons ou rémunération des comptes courants
  frais: number; // dossier, garantie, commission, plateforme
  total: number;
  coutAnnualise: number; // coût total rapporté au montant et à l'année
}

export interface ResultatFinancement {
  sources: CoutSource[];
  totalFrais: number;
  totalRessources: number;
  fondsPropres: number; // fonds propres + comptes courants + apports en participation
  dette: number; // prêts + obligations
  partBeneficeJV: number; // somme des parts de bénéfice rétrocédées
}

export function coutSource(s: SourceFinancement, dureeOperationMois: number): CoutSource {
  const d = s.dureeMois ?? dureeOperationMois;
  const prorata = s.montant * s.tauxAnnuel * (d / 12);
  let interets = 0;
  let frais = 0;
  switch (s.type) {
    case "compte_courant":
      interets = prorata;
      break;
    case "pret":
      interets = prorata;
      frais = s.fraisDossier + s.fraisGarantie + s.montant * s.commissionEngagementPct;
      break;
    case "obligataire":
      interets = prorata;
      frais = s.montant * s.fraisPlateformePct + s.fraisDossier;
      break;
    default:
      break; // fonds propres et associé en participation : pas de coût financier
  }
  const total = interets + frais;
  return {
    id: s.id, type: s.type, libelle: s.libelle, montant: s.montant, dureeMois: d, interets, frais, total,
    coutAnnualise: s.montant > 0 && d > 0 ? total / s.montant / (d / 12) : 0,
  };
}

export function calculerFinancement(sources: SourceFinancement[], dureeOperationMois: number): ResultatFinancement {
  const couts = sources.map((s) => coutSource(s, dureeOperationMois));
  const somme = (f: (s: SourceFinancement) => boolean) => sources.filter(f).reduce((a, s) => a + s.montant, 0);
  return {
    sources: couts,
    totalFrais: couts.reduce((a, c) => a + c.total, 0),
    totalRessources: somme(() => true),
    fondsPropres: somme((s) => s.type === "fonds_propres" || s.type === "compte_courant" || s.type === "associe_jv"),
    dette: somme((s) => s.type === "pret" || s.type === "obligataire"),
    partBeneficeJV: Math.min(1, sources.filter((s) => s.type === "associe_jv").reduce((a, s) => a + s.partBenefice, 0)),
  };
}

export interface PlanFinancement {
  besoins: { foncier: number; technique: number; honorairesEtFrais: number; total: number };
  ressources: number;
  ecart: number; // > 0 : excédent ; < 0 : manque à financer
  tauxEndettement: number; // dette / besoins
}

/** Besoins = coût de revient avant la vente (BFR de l'Excel) ; ressources = sources de financement. */
export function planFinancement(bfr: { foncier: number; technique: number; honorairesEtFrais: number }, f: ResultatFinancement): PlanFinancement {
  const total = bfr.foncier + bfr.technique + bfr.honorairesEtFrais;
  return {
    besoins: { ...bfr, total },
    ressources: f.totalRessources,
    ecart: f.totalRessources - total,
    tauxEndettement: total > 0 ? f.dette / total : 0,
  };
}
