"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { calculerBilan } from "@/lib/bilan/calcul";
import { listerProjets, supprimerProjet, type Projet } from "@/lib/projets";
import { classeMarge, dateFr, eur, pct } from "@/lib/format";

export default function Projets() {
  const [projets, setProjets] = useState<Projet[] | null>(null);
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  useEffect(() => setProjets(listerProjets()), []);

  if (!projets) return null;
  return (
    <div className="pile">
      <h1>Projets</h1>
      {projets.length === 0 && (
        <div className="carte">
          <p>Aucun projet pour l'instant. Analyse un bien depuis <Link href="/">Rechercher</Link>, puis clique sur « Enregistrer en projet ».</p>
        </div>
      )}
      {projets.length > 0 && (
        <div className="carte defile">
          <table className="t">
            <thead>
              <tr><th>Projet</th><th className="n">Prix affiché</th><th className="n">Prix négocié</th><th className="n">Marge / CA</th><th className="n">Bénéfice net</th><th>Dernière offre</th><th>Mis à jour</th><th></th></tr>
            </thead>
            <tbody>
              {projets.map((p) => {
                const r = calculerBilan(p.hypotheses);
                const o = p.historique[0];
                return (
                  <tr key={p.id}>
                    <td><Link href={`/bien?projet=${p.id}`}>{p.titre}</Link><div className="doux petit">{p.typeBien}{p.surface ? ` · ${p.surface} m²` : ""}</div></td>
                    <td className="n">{eur(p.prixAffiche)}</td>
                    <td className="n">{eur(p.hypotheses.prixAcquisition)}</td>
                    <td className="n"><span className={`puce ${classeMarge(r.margeSurCA, p.margeCible)}`}>{pct(r.margeSurCA)}</span></td>
                    <td className="n">{eur(r.beneficeNet)}</td>
                    <td>{o ? `${o.type === "offre" ? "Offre" : o.type === "contre-offre" ? "Contre-offre" : "Accord"} ${eur(o.prix)} (${dateFr(o.date)})` : "—"}</td>
                    <td>{dateFr(p.majLe)}</td>
                    <td>
                      {aSupprimer === p.id ? (
                        <span className="ligne">
                          <button className="lien" onClick={() => { supprimerProjet(p.id); setProjets(listerProjets()); setASupprimer(null); }}>Confirmer</button>
                          <button className="lien" onClick={() => setASupprimer(null)}>Annuler</button>
                        </span>
                      ) : (
                        <button className="lien" onClick={() => setASupprimer(p.id)}>Supprimer</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="doux petit">Les projets sont enregistrés dans ce navigateur. Une base de données partagée viendra avec la version en ligne.</p>
    </div>
  );
}
