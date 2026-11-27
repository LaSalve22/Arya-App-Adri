const eur0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
export const eur = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : eur0.format(v));
export const keur = (v: number) => `${Math.round(v / 1000).toLocaleString("fr-FR")} k€`;
export const pct = (v: number | null | undefined, d = 1) =>
  v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d })} %`;
export const m2 = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v).toLocaleString("fr-FR")} €/m²`);
export const dateFr = (iso: string) => new Date(iso).toLocaleDateString("fr-FR");
export const classeMarge = (m: number, cible: number) => (m >= cible ? "bon" : m >= cible * 0.66 ? "moyen" : "mauvais");
