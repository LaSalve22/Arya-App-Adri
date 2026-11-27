"use client";
import { useEffect, useState } from "react";
import type { StatsPrix } from "@/lib/sources/dvf";
import { eur, m2 } from "@/lib/format";
import type { PropsOnglet } from "./types";

interface StatsCommune { total: number; global: StatsPrix; parAnnee: ({ annee: string } & StatsPrix)[] }

export default function Marche({ etat, fiche, comps }: PropsOnglet) {
  const type = etat.caracteristiques.type === "Immeuble" ? "Appartement" : etat.caracteristiques.type;
  const [st, setSt] = useState<StatsCommune | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!fiche?.codeInsee) return;
    setSt(null);
    fetch(`/api/dvf/commune?insee=${fiche.codeInsee}&type=${type}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.erreur); setSt(d); })
      .catch((e) => setErr(e.message));
  }, [fiche?.codeInsee, type]);

  const dpes = fiche?.dpe.ok ? fiche.dpe.data : [];
  const maxMed = st ? Math.max(1, ...st.parAnnee.map((a) => a.mediane)) : 1;
  const surface = etat.caracteristiques.surface;
  return (
    <div className="pile">
      <div className="carte pile">
        <div className="entete"><h2>Prix du secteur · {type.toLowerCase()}s</h2><span className="doux petit">Ventes DVF de la commune, 2021 à aujourd'hui</span></div>
        {err && <p className="erreur">{err}</p>}
        {!st && !err && <p className="chargement">Téléchargement des ventes DVF…</p>}
        {st && (
          <>
            <div className="grille3">
              <div className="kpi"><span className="v">{m2(st.global.mediane)}</span><span className="l">Médiane commune · {st.global.nb} ventes</span></div>
              <div className="kpi"><span className="v">{m2(st.global.p25)} – {m2(st.global.p75)}</span><span className="l">Quartiles commune</span></div>
              {comps && <div className="kpi"><span className="v">{m2(comps.stats.mediane)}</span><span className="l">Médiane des biens comparables · rayon {comps.rayon} m</span></div>}
              {comps && surface ? <div className="kpi"><span className="v">{eur(comps.stats.mediane * surface)}</span><span className="l">Valeur médiane pour {surface} m²</span></div> : null}
            </div>
            <div className="defile">
              <table className="t">
                <thead><tr><th>Année</th><th className="n">Ventes</th><th className="n">Bas</th><th className="n">Médiane</th><th className="n">Haut</th><th style={{ width: "35%" }}></th></tr></thead>
                <tbody>
                  {st.parAnnee.map((a) => (
                    <tr key={a.annee}>
                      <td>{a.annee}</td><td className="n">{a.nb}</td><td className="n">{m2(a.p25)}</td><td className="n">{m2(a.mediane)}</td><td className="n">{m2(a.p75)}</td>
                      <td><div style={{ height: 8, borderRadius: 4, background: "var(--accent)", width: `${(a.mediane / maxMed) * 100}%` }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <div className="carte pile">
        <h2>DPE à moins de 150 m</h2>
        {fiche?.dpe.ok ? (
          dpes.length ? (
            <>
              <div className="ligne" style={{ gap: 6 }}>
                {"ABCDEFG".split("").map((l) => {
                  const n = dpes.filter((d) => d.etiquette === l).length;
                  return n ? <span key={l} className="ligne" style={{ gap: 4 }}><span className={`dpe dpe-${l}`}>{l}</span><span className="petit">× {n}</span></span> : null;
                })}
              </div>
              <div className="defile" style={{ maxHeight: 300, overflowY: "auto" }}>
                <table className="t"><tbody>
                  {dpes.map((d) => (
                    <tr key={d.numero}>
                      <td><span className={`dpe dpe-${d.etiquette}`}>{d.etiquette}</span></td>
                      <td>{d.adresse}<div className="doux petit">{d.typeBatiment} · {d.surface ?? "?"} m² · {d.anneeConstruction ?? "année ?"} · {d.consoM2 ? `${Math.round(d.consoM2)} kWh/m²/an` : ""}</div></td>
                      <td className="n">{d.date}</td>
                    </tr>
                  ))}
                </tbody></table>
              </div>
            </>
          ) : <p className="doux">Aucun DPE récent à proximité.</p>
        ) : <p className="erreur">{fiche && !fiche.dpe.ok ? fiche.dpe.erreur : "Chargement…"}</p>}
      </div>
    </div>
  );
}
