// Profil de la société marchand de biens et sortie du bénéfice vers les associés.
export type FormeSociete = "SAS" | "SARL_majoritaire" | "SARL_minoritaire";
export type ModeSortie = "conserver" | "dividendes";

export interface ProfilMdB {
  nom: string;
  forme: FormeSociete;
  capitalSocial: number;
  modeSortie: ModeSortie;
  /** Prélèvement forfaitaire unique sur les dividendes : 31,4 % en 2026 (12,8 % d'impôt + 18,6 % de prélèvements sociaux). */
  tauxPFU: number;
  /** Part impôt sur le revenu du PFU, conservée sur la fraction soumise aux cotisations. */
  tauxIRForfaitaire: number;
  /** Cotisations sociales du gérant majoritaire de SARL sur les dividendes au-delà de 10 % (≈ 45 %). */
  tauxCotisationsTNS: number;
}

export const LIBELLES_FORMES: Record<FormeSociete, string> = {
  SAS: "SAS / SASU (président assimilé salarié)",
  SARL_majoritaire: "SARL / EURL, gérant majoritaire (TNS)",
  SARL_minoritaire: "SARL, gérant minoritaire ou égalitaire",
};

export function profilParDefaut(): ProfilMdB {
  return { nom: "", forme: "SAS", capitalSocial: 1000, modeSortie: "dividendes", tauxPFU: 0.314, tauxIRForfaitaire: 0.128, tauxCotisationsTNS: 0.45 };
}

export interface SortieAssocies {
  distribue: number;
  pfu: number;
  cotisationsSociales: number;
  netAssocies: number;
  conserveEnSociete: number;
  seuilDixPourCent: number | null;
  /** Total des prélèvements (IS + sortie) rapporté au bénéfice avant impôt. */
  tauxGlobal: number;
}

/**
 * @param beneficeDistribuable bénéfice net après IS (et après la part des associés en participation)
 * @param beneficeAvantImpot bénéfice brut, pour le taux global
 * @param impotSocietes IS payé, pour le taux global
 * @param comptesCourants comptes courants d'associés, comptés dans la base des 10 % en SARL
 */
export function calculerSortie(p: ProfilMdB, beneficeDistribuable: number, beneficeAvantImpot: number, impotSocietes: number, comptesCourants = 0): SortieAssocies {
  const distribuable = Math.max(0, beneficeDistribuable);
  if (p.modeSortie === "conserver" || distribuable === 0) {
    return {
      distribue: 0, pfu: 0, cotisationsSociales: 0, netAssocies: 0, conserveEnSociete: distribuable, seuilDixPourCent: null,
      tauxGlobal: beneficeAvantImpot > 0 ? impotSocietes / beneficeAvantImpot : 0,
    };
  }
  let pfu = 0;
  let cotisations = 0;
  let seuil: number | null = null;
  if (p.forme === "SARL_majoritaire") {
    seuil = 0.1 * (p.capitalSocial + comptesCourants);
    const sousSeuil = Math.min(distribuable, seuil);
    const auDela = distribuable - sousSeuil;
    pfu = sousSeuil * p.tauxPFU + auDela * p.tauxIRForfaitaire;
    cotisations = auDela * p.tauxCotisationsTNS;
  } else {
    pfu = distribuable * p.tauxPFU;
  }
  const net = distribuable - pfu - cotisations;
  return {
    distribue: distribuable, pfu, cotisationsSociales: cotisations, netAssocies: net, conserveEnSociete: 0, seuilDixPourCent: seuil,
    tauxGlobal: beneficeAvantImpot > 0 ? (impotSocietes + pfu + cotisations) / beneficeAvantImpot : 0,
  };
}
