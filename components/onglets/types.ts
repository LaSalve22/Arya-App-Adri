import type { Parcelle } from "@/lib/sources/cadastre";
import type { InfosUrbanisme } from "@/lib/sources/urbanisme";
import type { DPE, Risques } from "@/lib/sources/risques";
import type { StatsPrix, Vente } from "@/lib/sources/dvf";
import type { EtatAnalyse } from "@/lib/etat";
import type { Analyse } from "@/lib/analyse";

export type Res<T> = { ok: true; data: T } | { ok: false; erreur: string };

export interface Fiche {
  lon: number;
  lat: number;
  codeInsee: string | null;
  parcelle: Res<Parcelle | null>;
  urbanisme: Res<InfosUrbanisme>;
  risques: Res<Risques>;
  dpe: Res<DPE[]>;
}

export interface Comps {
  rayon: number;
  ventes: Vente[];
  stats: StatsPrix;
}

export interface PropsOnglet {
  etat: EtatAnalyse;
  setEtat: (e: EtatAnalyse) => void;
  a: Analyse;
  fiche: Fiche | null;
  comps: Comps | null;
  libelle: string;
}
