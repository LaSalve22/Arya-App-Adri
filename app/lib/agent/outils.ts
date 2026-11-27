// Outils prêts pour le futur agent IA (Claude, utilisation d'outils).
// Chaque outil a un schéma JSON et une fonction d'exécution qui réutilise le moteur de MADRIMMO.
// Pour activer l'agent : ajouter une route app/api/agent qui appelle l'API Claude avec ces définitions
// et exécute `executerOutil` à chaque demande d'outil.
import { calculerBilan } from "../bilan/calcul";
import { prixMaxPourMarge, sensibilite } from "../bilan/nego";
import type { Hypotheses, ScenarioRevente } from "../bilan/types";
import { analyserAnnonce } from "../annonce/parse";
import { geocoder } from "../sources/geo";
import { parcelleAuPoint } from "../sources/cadastre";
import { zonePLU } from "../sources/urbanisme";
import { dpeProches, risques } from "../sources/risques";
import { comparables, ventesCommune, type TypeBien } from "../sources/dvf";

export const OUTILS = [
  {
    name: "chercher_bien",
    description: "Géocode une adresse en Occitanie et renvoie parcelle cadastrale, zone PLU, risques et DPE voisins.",
    input_schema: { type: "object", properties: { adresse: { type: "string" } }, required: ["adresse"] },
  },
  {
    name: "comparables_dvf",
    description: "Ventes DVF comparables autour d'un point (même type, surface ±30 %), avec médiane et quartiles du prix au m².",
    input_schema: {
      type: "object",
      properties: {
        code_insee: { type: "string" }, lon: { type: "number" }, lat: { type: "number" },
        type: { type: "string", enum: ["Maison", "Appartement", "Terrain", "Local"] }, surface: { type: "number" },
      },
      required: ["code_insee", "lon", "lat", "type"],
    },
  },
  {
    name: "calculer_bilan",
    description: "Calcule le bilan prévisionnel marchand de biens (méthode de l'Excel de l'utilisateur) à partir d'hypothèses complètes.",
    input_schema: { type: "object", properties: { hypotheses: { type: "object" } }, required: ["hypotheses"] },
  },
  {
    name: "prix_max_nego",
    description: "Prix d'achat maximum pour atteindre une marge cible, et tableau de sensibilité remise × scénario de revente.",
    input_schema: {
      type: "object",
      properties: { hypotheses: { type: "object" }, marge_cible: { type: "number" }, prix_affiche: { type: "number" } },
      required: ["hypotheses", "marge_cible"],
    },
  },
  {
    name: "analyser_annonce",
    description: "Extrait prix, surfaces, pièces, DPE et localisation d'un texte d'annonce.",
    input_schema: { type: "object", properties: { texte: { type: "string" } }, required: ["texte"] },
  },
] as const;

export async function executerOutil(nom: string, e: Record<string, unknown>): Promise<unknown> {
  switch (nom) {
    case "chercher_bien": {
      const [a] = await geocoder(String(e.adresse), 1);
      if (!a) return { erreur: "Adresse introuvable en Occitanie" };
      const [parcelle, urbanisme, r, dpe] = await Promise.all([parcelleAuPoint(a.lon, a.lat), zonePLU(a.lon, a.lat), risques(a.lon, a.lat), dpeProches(a.lon, a.lat)]);
      return { adresse: a, parcelle: parcelle && { ...parcelle, geometrie: undefined }, urbanisme, risques: r, dpe: dpe.slice(0, 10) };
    }
    case "comparables_dvf": {
      const v = await ventesCommune(String(e.code_insee));
      const c = comparables(v, { lon: Number(e.lon), lat: Number(e.lat), type: e.type as TypeBien, surface: e.surface ? Number(e.surface) : undefined });
      return { ...c, ventes: c.ventes.slice(0, 25) };
    }
    case "calculer_bilan":
      return calculerBilan(e.hypotheses as Hypotheses);
    case "prix_max_nego": {
      const h = e.hypotheses as Hypotheses;
      const m = Number(e.marge_cible);
      const scenarios: ScenarioRevente[] = ["down", "moyen", "top"];
      return {
        prixMax: Object.fromEntries(scenarios.map((s) => [s, prixMaxPourMarge(h, m, s)])),
        sensibilite: e.prix_affiche ? sensibilite(h, Number(e.prix_affiche)) : null,
      };
    }
    case "analyser_annonce":
      return analyserAnnonce(String(e.texte));
    default:
      return { erreur: `Outil inconnu : ${nom}` };
  }
}
