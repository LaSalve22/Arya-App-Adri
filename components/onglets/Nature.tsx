"use client";
import Dictee from "@/components/Dictee";
import dynamic from "next/dynamic";
import { libelleTypeZone } from "@/lib/sources/libelles";
import type { Caracteristiques } from "@/lib/etat";
import { Champ, Num } from "./ui";
import type { PropsOnglet } from "./types";

const Carte = dynamic(() => import("@/components/Carte"), { ssr: false, loading: () => <div className="carte-map chargement">Chargement de la carte…</div> });

export default function Nature({ etat, setEtat, fiche, comps }: PropsOnglet) {
  const c = etat.caracteristiques;
  const maj = (p: Partial<Caracteristiques>) => setEtat({ ...etat, caracteristiques: { ...c, ...p } });
  if (!fiche) return <p className="chargement">Interrogation du cadastre, du PLU et de Géorisques…</p>;
  const pa = fiche.parcelle.ok ? fiche.parcelle.data : null;
  const urba = fiche.urbanisme.ok ? fiche.urbanisme.data : null;
  const risq = fiche.risques.ok ? fiche.risques.data : null;
  return (
    <div className="pile">
      <div className="carte pile">
        <h2>Caractéristiques du bien</h2>
        <div className="grille3">
          <Champ label="Type">
            <select value={c.type} onChange={(e) => maj({ type: e.target.value })}>
              <option>Maison</option><option>Appartement</option><option>Immeuble</option><option>Terrain</option><option>Local</option>
            </select>
          </Champ>
          <Champ label="Surface habitable (m²)"><Num v={c.surface} pas={1} set={(n) => maj({ surface: n || null })} /></Champ>
          <Champ label="Terrain (m²)"><Num v={c.terrain} pas={10} set={(n) => maj({ terrain: n || null })} /></Champ>
          <Champ label="Pièces"><Num v={c.pieces} pas={1} largeur={80} set={(n) => maj({ pieces: n || null })} /></Champ>
          <Champ label="Étage"><input value={c.etage} onChange={(e) => maj({ etage: e.target.value })} placeholder="ex. 3e, bât. A" /></Champ>
          <Champ label="Ascenseur">
            <select value={c.ascenseur} onChange={(e) => maj({ ascenseur: e.target.value as Caracteristiques["ascenseur"] })}>
              <option value="">—</option><option value="oui">Oui</option><option value="non">Non</option>
            </select>
          </Champ>
          <Champ label="DPE annoncé">
            <select value={c.dpe} onChange={(e) => maj({ dpe: e.target.value })}>
              <option value="">—</option>{"ABCDEFG".split("").map((l) => <option key={l}>{l}</option>)}
            </select>
          </Champ>
          <Champ label="État">
            <select value={c.etat} onChange={(e) => maj({ etat: e.target.value })}>
              <option value="">—</option><option>Neuf / refait</option><option>Bon état</option><option>À rafraîchir</option><option>À rénover</option><option>À réhabiliter entièrement</option>
            </select>
          </Champ>
        </div>
        <Champ label="Notes (visite, points d'attention)">
          <textarea value={c.notes} onChange={(e) => maj({ notes: e.target.value })} style={{ minHeight: 80 }} />
        </Champ>
        <Dictee libelle="Dicter une note" surTexte={(x) => maj({ notes: `${c.notes ? `${c.notes} ` : ""}${x}` })} />
        {(c.dpe === "F" || c.dpe === "G") && <p className="alerte">DPE {c.dpe} : logement classé « passoire thermique », interdit à la location (G depuis 2025, F en 2028). Prévois la rénovation énergétique dans le budget travaux.</p>}
      </div>

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
            {urba ? (
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
        </div>
      </div>
    </div>
  );
}
