export const DEPARTEMENTS_OCCITANIE = ["09", "11", "12", "30", "31", "32", "34", "46", "48", "65", "66", "81", "82"] as const;

export const NOMS_DEPARTEMENTS: Record<string, string> = {
  "09": "Ariège",
  "11": "Aude",
  "12": "Aveyron",
  "30": "Gard",
  "31": "Haute-Garonne",
  "32": "Gers",
  "34": "Hérault",
  "46": "Lot",
  "48": "Lozère",
  "65": "Hautes-Pyrénées",
  "66": "Pyrénées-Orientales",
  "81": "Tarn",
  "82": "Tarn-et-Garonne",
};

export function estEnOccitanie(codeInsee: string): boolean {
  return (DEPARTEMENTS_OCCITANIE as readonly string[]).includes(codeInsee.slice(0, 2));
}
