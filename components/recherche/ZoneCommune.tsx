"use client";
import { useEffect, useMemo, useState } from "react";
import type { Commune } from "@/lib/sources/geo";
import type { StatsPrix, Vente } from "@/lib/sources/dvf";
import { NOMS_DEPARTEMENTS } from "@/lib/sources/occitanie";
import { eur, m2 } from "@/lib/format";
import { useRouter } from "next/navigation";

interface Stats {
  total: number;
  global: StatsPrix;
  parAnnee: ({ annee: string } & StatsPrix)[];
  dernieres: Vente[];
}

export default function ZoneCommune() {
  const router = useRouter();
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [q, setQ] = useState("");
  const [choix, setChoix] = useState<Commune | null>(null);
  const [type, setType] = useState("Maison");
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [charge, setCharge] = useState(false);

  useEffect(() => {
    fetch("/api/communes").then((r) => r.json()).then(setCommunes).catch(() => setErr("Liste des communes indisponible."));
  }, []);

  useEffect(() => {
    if (!choix) return;
    setCharge(true);
    setErr(null);
    fetch(`/api/dvf/commune?insee=${choix.code}&type=${type}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.erreur);
        setStats(d);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setCharge(false));
  }, [choix, type]);

  const filtrees = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return communes.filter((c) => c.nom.toLowerCase().startsWith(s) || c.codesPostaux.some((cp) => cp.startsWith(s))).slice(0, 8);
  }, [q, communes]);

  const maxMed = stats ? Math.max(...stats.parAnnee.map((a) => a.mediane), 1) : 1;

  return (
    <div className="pile">
      <div className="grille3">
        <label className="champ">
          Commune d'Occitanie
          <input value={q} onChange={(e) => { setQ(e.target.value); setChoix(null); }} placeholder="ex. Toulouse, 34170…" />
          {filtrees.length > 0 && !choix && (
            <div className="suggestions">
              {filtrees.map((c) => (
                <button key={c.code} onClick={() => { setChoix(c); setQ(c.nom); }}>
                  {c.nom} <span className="doux petit">{c.codesPostaux[0]} · {NOMS_DEPARTEMENTS[c.codeDepartement]}</span>
                </button>
              ))}
            </div>
          )}
        </label>
        <label className="champ">
          Type de bien
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option>Maison</option>
            <option>Appartement</option>
            <option>Terrain</option>
            <option>Local</option>
          </select>
        </label>
      </div>
      {charge && <p className="chargement">Téléchargement des ventes DVF de la commune…</p>}
      {err && <p className="erreur">{err}</p>}
      {stats && choix && !charge && (
        <div className="pile">
          <div className="grille3">
            <div className="kpi"><span className="v">{m2(stats.global.mediane)}</span><span className="l">Prix médian · {type.toLowerCase()} · 5 ans</span></div>
            <div className="kpi"><span className="v num">{m2(stats.global.p25)} – {m2(stats.global.p75)}</span><span className="l">Fourchette (quartiles)</span></div>
            <div className="kpi"><span className="v">{stats.global.nb}</span><span className="l">Ventes retenues</span></div>
          </div>
          <div className="defile">
            <table className="t">
              <thead><tr><th>Année</th><th className="n">Ventes</th><th className="n">Médiane</th><th style={{ width: "45%" }}></th></tr></thead>
              <tbody>
                {stats.parAnnee.map((a) => (
                  <tr key={a.annee}>
                    <td>{a.annee}</td>
                    <td className="n">{a.nb}</td>
                    <td className="n">{m2(a.mediane)}</td>
                    <td><div style={{ height: 8, borderRadius: 4, background: "#d9d9d9", width: `${(a.mediane / maxMed) * 100}%` }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>Dernières ventes</h3>
          <div className="defile">
            <table className="t">
              <thead><tr><th>Date</th><th>Adresse</th><th className="n">Surface</th><th className="n">Prix</th><th className="n">€/m²</th><th></th></tr></thead>
              <tbody>
                {stats.dernieres.map((v) => (
                  <tr key={v.id}>
                    <td className="num">{v.date}</td>
                    <td>{v.adresse}</td>
                    <td className="n">{Math.round(v.surface)} m²</td>
                    <td className="n">{eur(v.prix)}</td>
                    <td className="n">{m2(v.prixM2)}</td>
                    <td>
                      {v.lon != null && (
                        <button className="lien" onClick={() => router.push(`/bien?lon=${v.lon}&lat=${v.lat}&label=${encodeURIComponent(v.adresse)}&insee=${choix.code}&type=${v.type}&surface=${Math.round(v.surface)}`)}>
                          Analyser
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="doux petit">Source : DVF géolocalisées (Etalab), mutations de type « Vente » avec un seul logement ou un terrain à bâtir, valeurs aberrantes écartées.</p>
        </div>
      )}
    </div>
  );
}
