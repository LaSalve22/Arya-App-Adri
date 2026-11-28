import { describe, expect, it } from "vitest";
import { comparables, parserDVF } from "./dvf";
import { natureParDefaut, typeDVF } from "../dvfLots";

const ENTETE = "id_mutation,date_mutation,nature_mutation,valeur_fonciere,adresse_numero,adresse_nom_voie,code_postal,nom_commune,id_parcelle,type_local,surface_reelle_bati,nombre_pieces_principales,code_nature_culture,surface_terrain,longitude,latitude";
const l = (id: string, prix: number, type: string, surf: string, culture = "", terrain = "") =>
  `${id},2025-03-01,Vente,${prix},1,RUE TEST,11100,Narbonne,11262000AB0001,${type},${surf},${type === "Appartement" ? 3 : ""},${culture},${terrain},3.0036,43.1837`;

describe("DVF : garages et parkings", () => {
  const csv = [
    ENTETE,
    l("G1", 15000, "Dépendance", ""), // garage seul
    l("G2", 24000, "Dépendance", ""), l("G2", 24000, "Dépendance", ""), // deux places vendues ensemble
    l("A1", 150000, "Appartement", "60"), l("A1", 150000, "Dépendance", ""), // appartement avec cave : reste un appartement
    l("T1", 90000, "", "", "AB", "500"), // terrain à bâtir
  ].join("\n");
  const v = parserDVF(csv);

  it("classe chaque vente", () => {
    expect(v.find((x) => x.id === "G1")).toMatchObject({ type: "Dependance", surface: 1, prixM2: 15000 });
    expect(v.find((x) => x.id === "G2")).toMatchObject({ type: "Dependance", prixM2: 12000 });
    expect(v.find((x) => x.id === "A1")).toMatchObject({ type: "Appartement", surface: 60, prixM2: 2500 });
    expect(v.find((x) => x.id === "T1")).toMatchObject({ type: "Terrain", prixM2: 180 });
  });

  it("comparables de dépendances sans filtre de surface", () => {
    const c = comparables(v, { lon: 3.0036, lat: 43.1837, type: "Dependance", surface: 60, minResultats: 1 });
    expect(c.ventes.map((x) => x.id).sort()).toEqual(["G1", "G2"]);
  });

  it("nature d'un lot → type DVF", () => {
    expect(typeDVF("Garage")).toBe("Dependance");
    expect(typeDVF("Parking")).toBe("Dependance");
    expect(typeDVF("Local")).toBe("Local");
    expect(natureParDefaut("Immeuble")).toBe("Appartement");
    expect(natureParDefaut("Maison")).toBe("Maison");
  });
});
