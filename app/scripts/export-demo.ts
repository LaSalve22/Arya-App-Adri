// Récupère les données réelles de quelques biens pour la page de démonstration (données figées).
import { writeFileSync } from "node:fs";
import { geocoder } from "../lib/sources/geo";
import { parcelleAuPoint } from "../lib/sources/cadastre";
import { zonePLU } from "../lib/sources/urbanisme";
import { dpeProches, risques } from "../lib/sources/risques";
import { comparables, statsCommune, ventesCommune, type TypeBien } from "../lib/sources/dvf";

const BIENS = [
  { id: "castelnau", adresse: "10 avenue de la Moutte Castelnau-le-Lez", type: "Maison", typeComp: "Maison", surface: 132, terrain: 610, prix: 485000, pieces: 5, dpeAnnonce: "D", titre: "Maison 132 m² sur 610 m², Castelnau-le-Lez" },
  { id: "toulouse", adresse: "12 rue des Filatiers Toulouse", type: "Appartement", typeComp: "Appartement", surface: 65, terrain: null, prix: 265000, pieces: 3, dpeAnnonce: "E", titre: "Appartement T3 65 m², Toulouse centre" },
  { id: "perpignan", adresse: "15 rue de la Fusterie Perpignan", type: "Immeuble", typeComp: "Appartement", surface: 210, terrain: null, prix: 180000, pieces: null, dpeAnnonce: "F", titre: "Immeuble 4 lots 210 m², Perpignan" },
];

async function main() {
  const out = [];
  for (const b of BIENS) {
    const [a] = await geocoder(b.adresse, 1);
    if (!a) throw new Error("adresse introuvable " + b.adresse);
    const [parcelle, urbanisme, r, dpe, ventes] = await Promise.all([
      parcelleAuPoint(a.lon, a.lat), zonePLU(a.lon, a.lat), risques(a.lon, a.lat), dpeProches(a.lon, a.lat), ventesCommune(a.codeInsee),
    ]);
    const surfaceComp = b.type === "Immeuble" ? 52 : b.surface;
    const comps = comparables(ventes, { lon: a.lon, lat: a.lat, type: b.typeComp as TypeBien, surface: surfaceComp });
    const st = statsCommune(ventes, b.typeComp as TypeBien);
    out.push({
      ...b, surfaceComp, adresseComplete: a.label, lon: a.lon, lat: a.lat, codeInsee: a.codeInsee, commune: a.commune,
      parcelle, urbanisme, risques: r, dpe: dpe.slice(0, 12),
      comparables: { ...comps, ventes: comps.ventes.slice(0, 40) },
      commune_stats: { global: st.global, parAnnee: st.parAnnee },
    });
    console.log(b.id, a.label, parcelle?.idu, urbanisme.zone?.libelle ?? "pas de PLU", comps.stats.nb, Math.round(comps.stats.mediane));
  }
  writeFileSync("demo/demo-data.json", JSON.stringify({ date: new Date().toISOString().slice(0, 10), biens: out }));
}
main().catch((e) => { console.error(e); process.exit(1); });
