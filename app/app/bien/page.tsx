"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import Bilan, { type EtatBilan } from "@/components/Bilan";
import { hypothesesParDefaut } from "@/lib/bilan/defaut";
import type { Lot } from "@/lib/bilan/types";
import type { Parcelle } from "@/lib/sources/cadastre";
import type { InfosUrbanisme } from "@/lib/sources/urbanisme";
import { libelleTypeZone } from "@/lib/sources/urbanisme";
import type { DPE, Risques } from "@/lib/sources/risques";
import type { StatsPrix, Vente } from "@/lib/sources/dvf";
import { enregistrerProjet, lireProjet, nouvelId, type Projet } from "@/lib/projets";
import { eur, m2 } from "@/lib/format";

const Carte = dynamic(() => import("@/components/Carte"), { ssr: false, loading: () => <div className="carte-map chargement">Chargement de la carte…</div> });

type Res<T> = { ok: true; data: T } | { ok: false; erreur: string };
interface Fiche {
  lon: number;
  lat: number;
  codeInsee: string | null;
  parcelle: Res<Parcelle | null>;
  urbanisme: Res<InfosUrbanisme>;
  risques: Res<Risques>;
  dpe: Res<DPE[]>;
}
interface Comps {
  rayon: number;
  ventes: Vente[];
  stats: StatsPrix;
}

export default function Page() {
  return (
    <Suspense fallback={<p className="chargement">Chargement…</p>}>
      <FicheBien />
    </Suspense>
  );
}

function FicheBien() {
  const sp = useSearchParams();
  const router = useRouter();
  const projetId = sp.get("projet");
  const [projet, setProjet] = useState<Projet | null>(null);
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [comps, setComps] = useState<Comps | null>(null);
  const [compsErr, setCompsErr] = useState<string | null>(null);
  const [typeComp, setTypeComp] = useState("Maison");
  const [surfaceComp, setSurfaceComp] = useState<number | null>(null);
  const [etat, setEtat] = useState<EtatBilan | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Initialisation à partir de l'URL ou d'un projet enregistré
  useEffect(() => {
    const p = projetId ? lireProjet(projetId) : null;
    setProjet(p);
    const type = p?.typeBien ?? sp.get("type") ?? "Maison";
    setTypeComp(type === "Immeuble" ? "Appartement" : type);
    const surface = p?.surface ?? (Number(sp.get("surface")) || null);
    setSurfaceComp(surface);
    if (p) {
      setEtat({ hypotheses: p.hypotheses, prixAffiche: p.prixAffiche, margeCible: p.margeCible, historique: p.historique });
    } else {
      const h = hypothesesParDefaut();
      const prix = Number(sp.get("prix")) || 0;
      h.prixAcquisition = prix;
      if (surface) {
        h.travaux.surfaceCarrez = surface;
        h.travaux.surfaceTotale = Number(sp.get("terrain")) || surface;
      }
      h.lots = [{ libelle: "Revente", surface: surface ?? undefined, prixDown: null, prixTop: null, tva: 0 }];
      setEtat({ hypotheses: h, prixAffiche: prix, margeCible: 0.15, historique: [] });
    }
    const q = new URLSearchParams();
    for (const k of ["lon", "lat", "idu", "insee", "section", "numero"]) {
      const v = p ? ({ lon: p.lon, lat: p.lat, insee: p.codeInsee } as Record<string, unknown>)[k] : sp.get(k);
      if (v != null && v !== "") q.set(k, String(v));
    }
    fetch(`/api/bien?${q}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.erreur);
        setFiche(d);
      })
      .catch((e) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetId]);

  // Comparables DVF
  useEffect(() => {
    if (!fiche?.codeInsee) return;
    setComps(null);
    setCompsErr(null);
    const q = new URLSearchParams({ insee: fiche.codeInsee, lon: String(fiche.lon), lat: String(fiche.lat), type: typeComp });
    if (surfaceComp && typeComp !== "Terrain") q.set("surface", String(surfaceComp));
    fetch(`/api/dvf/comparables?${q}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.erreur);
        setComps(d);
      })
      .catch((e) => setCompsErr(e.message));
  }, [fiche, typeComp, surfaceComp]);

  const prefill = useCallback((): Lot[] | null => {
    if (!comps?.stats.nb || !etat) return null;
    return etat.hypotheses.lots.map((l) => {
      const s = l.surface || surfaceComp || 0;
      if (!s) return l;
      return { ...l, surface: s, prixDown: Math.round((comps.stats.p25 * s) / 1000) * 1000, prixTop: Math.round((comps.stats.p75 * s) / 1000) * 1000 };
    });
  }, [comps, etat, surfaceComp]);

  // Pré-remplissage automatique de la revente dès l'arrivée des comparables, si rien n'est saisi.
  useEffect(() => {
    if (!etat || projet || !comps?.stats.nb) return;
    if (etat.hypotheses.lots.some((l) => l.prixDown != null || l.prixTop != null)) return;
    const lots = prefill();
    if (lots) setEtat({ ...etat, hypotheses: { ...etat.hypotheses, lots } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comps]);

  const label = projet?.adresse ?? sp.get("label") ?? (fiche?.parcelle.ok && fiche.parcelle.data ? `Parcelle ${fiche.parcelle.data.section} ${fiche.parcelle.data.numero}, ${fiche.parcelle.data.commune}` : "Bien");

  function sauvegarder() {
    if (!etat || !fiche) return;
    const p: Projet = {
      id: projet?.id ?? nouvelId(),
      titre: projet?.titre ?? label,
      adresse: label,
      lon: fiche.lon,
      lat: fiche.lat,
      codeInsee: fiche.codeInsee,
      typeBien: sp.get("type") ?? projet?.typeBien ?? typeComp,
      surface: surfaceComp,
      prixAffiche: etat.prixAffiche,
      margeCible: etat.margeCible,
      hypotheses: etat.hypotheses,
      historique: etat.historique,
      creeLe: projet?.creeLe ?? new Date().toISOString(),
      majLe: new Date().toISOString(),
    };
    enregistrerProjet(p);
    setProjet(p);
    setMessage("Projet enregistré.");
    if (!projetId) router.replace(`/bien?projet=${p.id}`);
  }

  if (err) return <p className="erreur">{err}</p>;
  const pa = fiche?.parcelle.ok ? fiche.parcelle.data : null;
  const urba = fiche?.urbanisme.ok ? fiche.urbanisme.data : null;
  const risq = fiche?.risques.ok ? fiche.risques.data : null;
  const dpes = fiche?.dpe.ok ? fiche.dpe.data : [];

  return (
    <div className="pile">
      <div className="entete">
        <div>
          <h1>{label}</h1>
          {sp.get("approx") && <p className="alerte">Adresse exacte inconnue : l'analyse se fait au centre de la commune. Les données de parcelle et de PLU ne concernent pas forcément le bien.</p>}
        </div>
        <div className="ligne">
          {message && <span className="puce bon">{message}</span>}
          <button className="btn principal" onClick={sauvegarder} disabled={!etat || !fiche}>{projet ? "Mettre à jour le projet" : "Enregistrer en projet"}</button>
        </div>
      </div>

      {!fiche ? (
        <p className="chargement">Interrogation du cadastre, du PLU, de Géorisques et de l'ADEME…</p>
      ) : (
        <div className="grille2">
          <div className="pile">
            <Carte lon={fiche.lon} lat={fiche.lat} parcelle={pa?.geometrie} ventes={comps?.ventes} />
            <div className="carte">
              <h2>Cadastre</h2>
              {fiche.parcelle.ok ? (
                pa ? (
                  <table className="t"><tbody>
                    <tr><td>Parcelle</td><td className="n">{pa.section} {pa.numero} · {pa.commune}</td></tr>
                    <tr><td>Identifiant</td><td className="n">{pa.idu}</td></tr>
                    <tr><td>Contenance</td><td className="n">{pa.contenance.toLocaleString("fr-FR")} m²</td></tr>
                  </tbody></table>
                ) : <p className="doux">Aucune parcelle à ce point (voirie ou domaine public).</p>
              ) : <p className="erreur">{fiche.parcelle.erreur}</p>}
            </div>
          </div>
          <div className="pile">
            <div className="carte">
              <h2>Urbanisme</h2>
              {fiche.urbanisme.ok && urba ? (
                urba.zone ? (
                  <table className="t"><tbody>
                    <tr><td>Zone</td><td className="n"><strong>{urba.zone.libelle}</strong> · {libelleTypeZone(urba.zone.typeZone)}</td></tr>
                    {urba.zone.libelleLong && <tr><td>Libellé</td><td className="n">{urba.zone.libelleLong}</td></tr>}
                    <tr><td>Document</td><td className="n">{urba.zone.document ?? "—"}</td></tr>
                    <tr><td>Règlement</td><td className="n">{urba.zone.reglementPdf ? <a href={urba.zone.reglementPdf} target="_blank" rel="noreferrer">PDF du règlement</a> : "—"} · <a href={urba.lienGeoportail} target="_blank" rel="noreferrer">Géoportail</a></td></tr>
                  </tbody></table>
                ) : <p className="alerte">{urba.message} <a href={urba.lienGeoportail} target="_blank" rel="noreferrer">Ouvrir le Géoportail</a></p>
              ) : <p className="erreur">{!fiche.urbanisme.ok && fiche.urbanisme.erreur}</p>}
            </div>
            <div className="carte">
              <h2>Risques</h2>
              {risq ? (
                <div className="pile" style={{ gap: 8 }}>
                  {risq.argiles && <div>Retrait-gonflement des argiles : <strong>{risq.argiles}</strong></div>}
                  <div className="ligne" style={{ gap: 6 }}>{risq.risques.length ? risq.risques.map((x) => <span key={x} className="puce moyen">{x}</span>) : <span className="doux">Aucun risque recensé</span>}</div>
                  <a href={risq.lienRapport} target="_blank" rel="noreferrer" className="petit">Rapport Géorisques complet (ERP)</a>
                </div>
              ) : <p className="erreur">{!fiche.risques.ok && fiche.risques.erreur}</p>}
            </div>
            <div className="carte">
              <h2>DPE à moins de 150 m</h2>
              {fiche.dpe.ok ? (
                dpes.length ? (
                  <div className="defile" style={{ maxHeight: 220, overflowY: "auto" }}>
                    <table className="t"><tbody>
                      {dpes.slice(0, 15).map((d) => (
                        <tr key={d.numero}>
                          <td><span className={`dpe dpe-${d.etiquette}`}>{d.etiquette}</span></td>
                          <td>{d.adresse}<div className="doux petit">{d.typeBatiment} · {d.surface ?? "?"} m² · {d.anneeConstruction ?? "année ?"}</div></td>
                          <td className="n">{d.date}</td>
                        </tr>
                      ))}
                    </tbody></table>
                  </div>
                ) : <p className="doux">Aucun DPE récent à proximité.</p>
              ) : <p className="erreur">{fiche.dpe.erreur}</p>}
            </div>
          </div>
        </div>
      )}

      {fiche && (
        <div className="carte pile">
          <div className="entete">
            <h2>Comparables DVF</h2>
            <div className="ligne">
              <select value={typeComp} onChange={(e) => setTypeComp(e.target.value)}>
                <option>Maison</option><option>Appartement</option><option>Terrain</option><option>Local</option>
              </select>
              <label className="ligne petit doux">Surface <input type="number" style={{ width: 90 }} value={surfaceComp ?? ""} onChange={(e) => setSurfaceComp(Number(e.target.value) || null)} /> m² ± 30 %</label>
            </div>
          </div>
          {compsErr && <p className="erreur">{compsErr}</p>}
          {!comps && !compsErr && <p className="chargement">Téléchargement des ventes DVF de la commune…</p>}
          {comps && (
            <>
              <div className="grille3">
                <div className="kpi"><span className="v">{m2(comps.stats.mediane)}</span><span className="l">Médiane · {comps.stats.nb} ventes · rayon {comps.rayon} m</span></div>
                <div className="kpi"><span className="v num">{m2(comps.stats.p25)} – {m2(comps.stats.p75)}</span><span className="l">Quartiles (prix bas / haut de revente)</span></div>
                {surfaceComp ? <div className="kpi"><span className="v">{eur(comps.stats.mediane * surfaceComp)}</span><span className="l">Valeur médiane pour {surfaceComp} m²</span></div> : null}
              </div>
              <div className="defile" style={{ maxHeight: 320, overflowY: "auto" }}>
                <table className="t">
                  <thead><tr><th>Date</th><th>Adresse</th><th className="n">Distance</th><th className="n">Surface</th><th className="n">Terrain</th><th className="n">Prix</th><th className="n">€/m²</th></tr></thead>
                  <tbody>
                    {comps.ventes.map((v) => (
                      <tr key={v.id}>
                        <td className="num">{v.date}</td><td>{v.adresse}</td><td className="n">{v.distance} m</td>
                        <td className="n">{Math.round(v.surface)} m²</td><td className="n">{v.terrain ? `${Math.round(v.terrain)} m²` : "—"}</td>
                        <td className="n">{eur(v.prix)}</td><td className="n">{m2(v.prixM2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="doux petit">Ventes de la commune uniquement (2021 à aujourd'hui). Le rayon s'élargit automatiquement jusqu'à 3 km s'il y a moins de 8 ventes.</p>
            </>
          )}
        </div>
      )}

      {etat && (
        <>
          <h1>Bilan prévisionnel</h1>
          <Bilan etat={etat} setEtat={setEtat} prefillDVF={prefill} />
        </>
      )}
    </div>
  );
}
