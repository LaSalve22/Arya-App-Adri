// Libellés utilisables côté navigateur (aucun accès réseau ni fichier).
const TYPES: Record<string, string> = { U: "Zone urbaine", AU: "Zone à urbaniser", A: "Zone agricole", N: "Zone naturelle" };
export const libelleTypeZone = (t: string | null) => (t ? TYPES[t.replace(/[^A-Z]/g, "")] ?? t : "");
