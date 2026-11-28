// Plan travaux encodé dans un lien (paramètre « travaux »), pour que Claude remplisse l'appli.
import { generalParDefaut, planParDefaut, projetParDefaut, type PlanTravaux } from "./plan";

export function encoderPlan(p: Partial<PlanTravaux>): string {
  const octets = new TextEncoder().encode(JSON.stringify(p));
  let bin = "";
  for (const o of octets) bin += String.fromCharCode(o);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decoderPlan(s: string): PlanTravaux | null {
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    const p = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))) as Partial<PlanTravaux>;
    return completerPlan(p);
  } catch {
    return null;
  }
}

/** Complète un plan partiel (ancien projet, lien) avec les valeurs par défaut. */
export function completerPlan(p: Partial<PlanTravaux> | undefined | null): PlanTravaux {
  const d = planParDefaut();
  if (!p) return d;
  return {
    ...d,
    ...p,
    pieces: (p.pieces ?? []).map((x, i) => ({ id: x.id ?? `l${i}`, type: x.type ?? "autre", surface: x.surface ?? null, etat: x.etat ?? "bon", remarques: x.remarques })),
    general: { ...generalParDefaut(), ...p.general },
    projet: { ...projetParDefaut(), ...p.projet },
    lignes: p.lignes ?? [],
  };
}
