"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Vente } from "@/lib/sources/dvf";
import { quantile } from "@/lib/stats";
import { eur, m2 } from "@/lib/format";
import { Champ, Num } from "./ui";
import type { PropsOnglet } from "./types";

const Carte = dynamic(() => import("@/components/Carte"), { ssr: false });

type Tri = "date" | "distance" | "prixM2" | "prix";

export default function Similaires({ etat, setEtat, fiche }: PropsOnglet) {
  const c = etat.caracteristiques;
  const [type, setType] = useState(c.type === "Immeuble" ? "Appartement" : c.type);
  const [surface, setSurface] = useState<number | null>(c.surface);
  const [tolerance, setTolerance] = useState(0.2);
  const [rayon, setRayon] = useState(800);
  const [depuis, setDepuis] = useState(2023);
  const [pieces, setPieces] = useState<number | null>(null);
  const [tri, setTri] = useState<Tri>("date");
  const [ventes, setVentes] = useState<Vente[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!fiche?.codeInsee) return;
    setVentes(null);
    const q = new URLSearchParams({ insee: fiche.codeInsee, lon: String(fiche.lon), lat: String(fiche.lat), type, rayon: String(rayon), tolerance: String(tolerance), min: "0" });
    if (surface && type !== "Terrain") q.set("surface", String(surface));
    fetch(`/api/dvf/comparables?${q}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.erreur); setVentes(d.ventes); setErr(null); })
      .catch((e) => setErr(e.message));
  }, [fiche, type, surface, tolerance, rayon]);

  const liste = useMemo(() => {
    const l = (ventes ?? []).filter((v) => Number(v.date.slice(0, 4)) >= depuis && (!pieces || v.pieces === pieces));
    const cle: Record<Tri, (v: Vente) => number> = { date: (v) => -Date.parse(v.date), distance: (v) => v.distance ?? 0, prixM2: (v) => -v.prixM2, prix: (v) => -v.prix };
    return [...l].sort((a, b) => cle[tri](a) - cle[tri](b));
  }, [ventes, depuis, pieces, tri]);
  const prix = liste.map((v) => v.prixM2).sort((a, b) => a - b);
  const st = { p25: quantile(prix, 0.25), med: quantile(prix, 0.5), p75: quantile(prix, 0.75) };

  function utiliser() {
    const h = etat.hypotheses;
    const lots = h.lots.map((l) => {
      const s = l.surface || surface || 0;
      return s ? { ...l, surface: s, prixDown: Math.round((st.p25 * s) / 1000) * 1000, prixTop: Math.round((st.p75 * s) / 1000) * 1000 } : l;
    });
    setEtat({ ...etat, hypotheses: { ...h, lots, scenario: h.scenario === "saisi" ? "moyen" : h.scenario } });
  }

  return (
    <div className="pile">
      <div className="carte pile">
        <div className="entete"><h2>Biens similaires vendus</h2><span className="doux petit">Ventes réelles DVF (actes notariés)</span></div>
        <div className="grille3">
          <Champ label="Type">
            <select value={type} onChange={(e) => setType(e.target.value)}><option>Maison</option><option>Appartement</option><option>Terrain</option><option>Local</option></select>
          </Champ>
          <Champ label="Surface de référence (m²)"><Num v={surface} pas={1} set={(n) => setSurface(n || null)} /></Champ>
          <Champ label="Écart de surface toléré">
            <select value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))}>{[0.1, 0.2, 0.3, 0.5].map((t) => <option key={t} value={t}>± {t * 100} %</option>)}</select>
          </Champ>
          <Champ label="Rayon">
            <select value={rayon} onChange={(e) => setRayon(Number(e.target.value))}>{[300, 500, 800, 1500, 3000].map((t) => <option key={t} value={t}>{t} m</option>)}</select>
          </Champ>
          <Champ label="Vendus depuis">
            <select value={depuis} onChange={(e) => setDepuis(Number(e.target.value))}>{[2021, 2022, 2023, 2024, 2025].map((t) => <option key={t}>{t}</option>)}</select>
          </Champ>
          <Champ label="Pièces">
            <select value={pieces ?? ""} onChange={(e) => setPieces(e.target.value ? Number(e.target.value) : null)}><option value="">Toutes</option>{[1, 2, 3, 4, 5, 6].map((t) => <option key={t}>{t}</option>)}</select>
          </Champ>
        </div>
        {err && <p className="erreur">{err}</p>}
        {!ventes && !err && <p className="chargement">Recherche des ventes…</p>}
        {ventes && (
          <div className="grille3">
            <div className="kpi"><span className="v">{liste.length}</span><span className="l">Ventes retenues</span></div>
            <div className="kpi"><span className="v">{m2(st.med)}</span><span className="l">Prix médian</span></div>
            <div className="kpi"><span className="v">{m2(st.p25)} – {m2(st.p75)}</span><span className="l">Quartiles</span></div>
            <div className="ligne"><button className="btn" disabled={liste.length < 3} onClick={utiliser}>Utiliser ces prix pour la revente</button></div>
          </div>
        )}
      </div>
      {fiche && <Carte lon={fiche.lon} lat={fiche.lat} parcelle={fiche.parcelle.ok ? fiche.parcelle.data?.geometrie : null} ventes={liste} />}
      <div className="carte defile">
        <table className="t">
          <thead>
            <tr>
              <th><button className="lien" onClick={() => setTri("date")}>Date</button></th><th>Adresse</th>
              <th className="n"><button className="lien" onClick={() => setTri("distance")}>Distance</button></th>
              <th className="n">Surface</th><th className="n">Pièces</th><th className="n">Terrain</th>
              <th className="n"><button className="lien" onClick={() => setTri("prix")}>Prix</button></th>
              <th className="n"><button className="lien" onClick={() => setTri("prixM2")}>€/m²</button></th>
            </tr>
          </thead>
          <tbody>
            {liste.map((v) => (
              <tr key={v.id}>
                <td className="num">{v.date}</td><td>{v.adresse}</td><td className="n">{v.distance} m</td>
                <td className="n">{Math.round(v.surface)} m²</td><td className="n">{v.pieces ?? "—"}</td><td className="n">{v.terrain ? `${Math.round(v.terrain)} m²` : "—"}</td>
                <td className="n">{eur(v.prix)}</td><td className="n">{m2(v.prixM2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {ventes && !liste.length && <p className="doux">Aucune vente avec ces filtres : élargis le rayon, la période ou l'écart de surface.</p>}
      </div>
    </div>
  );
}
