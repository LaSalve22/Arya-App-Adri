// Projets enregistrés dans le navigateur (localStorage). Une base de données prendra le relais plus tard.
import type { Hypotheses } from "./bilan/types";
import type { OptionsRP } from "./bilan/residence";
import type { ProfilMdB } from "./bilan/profil";
import type { Caracteristiques, CoutsTechniques } from "./etat";

export interface Offre {
  date: string;
  type: "offre" | "contre-offre" | "accord";
  prix: number;
  margeSurCA: number;
  beneficeNet: number;
  note?: string;
}

export interface Projet {
  id: string;
  titre: string;
  adresse: string;
  lon: number;
  lat: number;
  codeInsee: string | null;
  typeBien: string;
  surface: number | null;
  prixAffiche: number;
  margeCible: number;
  hypotheses: Hypotheses;
  historique: Offre[];
  rp?: OptionsRP;
  profil?: ProfilMdB;
  caracteristiques?: Caracteristiques;
  coutsTechniques?: CoutsTechniques;
  creeLe: string;
  majLe: string;
}

const CLE = "madrimmo.projets.v1";

export function listerProjets(): Projet[] {
  try {
    return JSON.parse(localStorage.getItem(CLE) ?? "[]") as Projet[];
  } catch {
    return [];
  }
}

export function lireProjet(id: string): Projet | null {
  return listerProjets().find((p) => p.id === id) ?? null;
}

export function enregistrerProjet(p: Projet) {
  const tous = listerProjets().filter((x) => x.id !== p.id);
  try {
    localStorage.setItem(CLE, JSON.stringify([{ ...p, majLe: new Date().toISOString() }, ...tous]));
  } catch {}
}

export function supprimerProjet(id: string) {
  try {
    localStorage.setItem(CLE, JSON.stringify(listerProjets().filter((x) => x.id !== id)));
  } catch {}
}

export const nouvelId = () => Math.random().toString(36).slice(2, 10);
