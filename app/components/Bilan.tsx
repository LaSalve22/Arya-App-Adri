"use client";
import { useMemo, useState } from "react";
import { calculerBilan } from "@/lib/bilan/calcul";
import { prixMaxPourMarge, sensibilite } from "@/lib/bilan/nego";
import { LIBELLES_POSTES } from "@/lib/bilan/defaut";
import type { Hypotheses, Lot, PosteTravaux, RegimeTVA, ScenarioRevente } from "@/lib/bilan/types";
import type { Offre } from "@/lib/projets";
import ComparatifRP from "./ComparatifRP";
import type { OptionsRP } from "@/lib/bilan/residence";
import { classeMarge, dateFr, eur, m2, pct } from "@/lib/format";

export interface EtatBilan {
  hypotheses: Hypotheses;
  prixAffiche: number;
  margeCible: number;
  historique: Offre[];
  rp: OptionsRP;
}

const TAUX_TVA = [0.2, 0.1, 0.055];
const SCENARIOS: [ScenarioRevente, string][] = [["down", "Bas"], ["moyen", "Moyen"], ["top", "Haut"]];

function Num({ v, set, pas = 1000, suffixe, largeur }: { v: number; set: (n: number) => void; pas?: number; suffixe?: string; largeur?: number }) {
  return (
    <span className="ligne" style={{ gap: 4, flexWrap: "nowrap" }}>
      <input type="number" step={pas} value={Number.isFinite(v) ? v : 0} onChange={(e) => set(e.target.value === "" ? 0 : Number(e.target.value))} style={{ width: largeur ?? 130 }} />
      {suffixe && <span className="doux petit">{suffixe}</span>}
    </span>
  );
}

function Ligne({ libelle, aide, children }: { libelle: string; aide?: string; children: React.ReactNode }) {
  return (
    <tr>
      <td>
        {libelle}
        {aide && <div className="doux petit">{aide}</div>}
      </td>
      <td className="n">{children}</td>
    </tr>
  );
}

export default function Bilan({ etat, setEtat, prefillDVF }: { etat: EtatBilan; setEtat: (e: EtatBilan) => void; prefillDVF?: () => Lot[] | null }) {
  const h = etat.hypotheses;
  const maj = (p: Partial<Hypotheses>) => setEtat({ ...etat, hypotheses: { ...h, ...p } });
  const r = useMemo(() => calculerBilan(h), [h]);
  const remise = etat.prixAffiche > 0 ? 1 - h.prixAcquisition / etat.prixAffiche : 0;
  const [note, setNote] = useState("");
  const [typeOffre, setTypeOffre] = useState<Offre["type"]>("offre");

  const prixMax = useMemo(
    () => SCENARIOS.map(([s, l]) => ({ s, l, prix: prixMaxPourMarge(h, etat.margeCible, s) })),
    [h, etat.margeCible],
  );
  const sens = useMemo(() => (etat.prixAffiche > 0 ? sensibilite(h, etat.prixAffiche, [0, 0.05, 0.1, 0.15, 0.2, 0.25]) : []), [h, etat.prixAffiche]);

  const setPoste = (groupe: "grosOeuvre" | "secondOeuvre", cle: string, p: Partial<PosteTravaux>) =>
    maj({ travaux: { ...h.travaux, [groupe]: { ...h.travaux[groupe], [cle]: { ...(h.travaux[groupe] as Record<string, PosteTravaux>)[cle], ...p } } } });
  const setAutre = (cle: "honorairesTechniques" | "raccordements" | "voirie", p: Partial<PosteTravaux>) =>
    maj({ travaux: { ...h.travaux, [cle]: { ...h.travaux[cle], ...p } } });
  const setLot = (i: number, p: Partial<Lot>) => maj({ lots: h.lots.map((l, k) => (k === i ? { ...l, ...p } : l)) });

  const cls = classeMarge(r.margeSurCA, etat.margeCible);

  function enregistrerOffre() {
    const o: Offre = { date: new Date().toISOString(), type: typeOffre, prix: h.prixAcquisition, margeSurCA: r.margeSurCA, beneficeNet: r.beneficeNet, note: note || undefined };
    setEtat({ ...etat, historique: [o, ...etat.historique] });
    setNote("");
  }

  return (
    <div className="disposition-bilan">
      <div className="pile">
        {/* ---------------- NÉGOCIATION ---------------- */}
        <div className="carte pile">
          <div className="entete">
            <h2>Négociation</h2>
            <span className="doux petit">Déplace le curseur : tout le bilan se recalcule.</span>
          </div>
          <div className="grille3">
            <label className="champ">Prix affiché (€)<Num v={etat.prixAffiche} set={(n) => setEtat({ ...etat, prixAffiche: n, hypotheses: { ...h, prixAcquisition: Math.round(n * (1 - Math.max(0, remise))) } })} /></label>
            <label className="champ">Prix d'achat négocié (€)<Num v={h.prixAcquisition} set={(n) => maj({ prixAcquisition: n })} /></label>
            <label className="champ">Marge cible (bénéfice brut / CA)<Num v={Math.round(etat.margeCible * 1000) / 10} pas={0.5} suffixe="%" largeur={80} set={(n) => setEtat({ ...etat, margeCible: n / 100 })} /></label>
          </div>
          {etat.prixAffiche > 0 && (
            <div className="barre-remise">
              <input
                className="curseur"
                type="range"
                min={0}
                max={0.35}
                step={0.005}
                value={Math.max(0, Math.min(0.35, remise))}
                onChange={(e) => maj({ prixAcquisition: Math.round(etat.prixAffiche * (1 - Number(e.target.value))) })}
                aria-label="Remise sur le prix affiché"
              />
              <strong className="num">− {pct(remise)}</strong>
            </div>
          )}
          <div className="defile">
            <table className="t">
              <thead><tr><th>Prix d'achat maximum pour {pct(etat.margeCible, 0)} de marge</th>{prixMax.map((p) => <th key={p.s} className="n">Revente {p.l.toLowerCase()}</th>)}</tr></thead>
              <tbody>
                <tr>
                  <td>Prix plafond</td>
                  {prixMax.map((p) => <td key={p.s} className="n">{p.prix == null ? "inatteignable" : eur(p.prix)}</td>)}
                </tr>
                {etat.prixAffiche > 0 && (
                  <tr>
                    <td>Remise nécessaire</td>
                    {prixMax.map((p) => <td key={p.s} className="n">{p.prix == null ? "—" : p.prix >= etat.prixAffiche ? "aucune" : pct(1 - p.prix / etat.prixAffiche)}</td>)}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {sens.length > 0 && (
            <div className="defile">
              <table className="t">
                <thead>
                  <tr><th>Remise</th><th className="n">Prix d'achat</th>{SCENARIOS.map(([s, l]) => <th key={s} className="n">Marge · revente {l.toLowerCase()}</th>)}</tr>
                </thead>
                <tbody>
                  {sens.map((ligne) => (
                    <tr key={ligne[0].remise}>
                      <td>− {pct(ligne[0].remise, 0)}</td>
                      <td className="n">{eur(ligne[0].prix)}</td>
                      {ligne.map((c) => (
                        <td key={c.scenario} className={`n ${classeMarge(c.margeSurCA, etat.margeCible)}`} title={`Bénéfice net : ${eur(c.beneficeNet)}`}>
                          {pct(c.margeSurCA)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="pile">
            <h3>Historique de négociation</h3>
            <div className="ligne">
              <select value={typeOffre} onChange={(e) => setTypeOffre(e.target.value as Offre["type"])}>
                <option value="offre">Mon offre</option>
                <option value="contre-offre">Contre-offre vendeur</option>
                <option value="accord">Accord</option>
              </select>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (ex. offre écrite via l'agence)" style={{ flex: 1, minWidth: 180 }} />
              <button className="btn" onClick={enregistrerOffre}>Noter au prix actuel ({eur(h.prixAcquisition)})</button>
            </div>
            {etat.historique.length > 0 && (
              <table className="t">
                <tbody>
                  {etat.historique.map((o, i) => (
                    <tr key={i}>
                      <td>{dateFr(o.date)}</td>
                      <td>{o.type === "offre" ? "Mon offre" : o.type === "contre-offre" ? "Contre-offre" : "Accord"}</td>
                      <td className="n">{eur(o.prix)}</td>
                      <td className="n"><span className={`puce ${classeMarge(o.margeSurCA, etat.margeCible)}`}>{pct(o.margeSurCA)}</span></td>
                      <td className="doux">{o.note}</td>
                      <td><button className="lien" onClick={() => setEtat({ ...etat, historique: etat.historique.filter((_, k) => k !== i) })}>Retirer</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <ComparatifRP h={h} rp={etat.rp} setRp={(rp) => setEtat({ ...etat, rp })} />

        {/* ---------------- ACHAT ---------------- */}
        <details className="bloc" open>
          <summary><span>Achat et charge foncière</span><span className="num">{eur(r.foncier.total.ttc)}</span></summary>
          <div>
            <table className="t">
              <tbody>
                <Ligne libelle="Prix d'acquisition">{eur(h.prixAcquisition)}</Ligne>
                <Ligne libelle="Indemnité d'éviction"><Num v={h.indemniteEviction} set={(n) => maj({ indemniteEviction: n })} /></Ligne>
                <Ligne libelle="Frais de notaire" aide="3 % avec engagement de revente (art. 1115 CGI), environ 8 % sinon">
                  <span className="ligne" style={{ justifyContent: "flex-end" }}>
                    <select value={h.tauxNotaire} onChange={(e) => maj({ tauxNotaire: Number(e.target.value) })}>
                      <option value={0.03}>3 % · engagement de revente</option>
                      <option value={0.08}>8 % · droit commun</option>
                    </select>
                    <span className="num">{eur(r.foncier.notaire.ttc)}</span>
                  </span>
                </Ligne>
                <Ligne libelle="Apporteur d'affaires (TTC)"><Num v={h.apporteurAffaires} set={(n) => maj({ apporteurAffaires: n })} /></Ligne>
              </tbody>
            </table>
          </div>
        </details>

        {/* ---------------- TRAVAUX ---------------- */}
        <details className="bloc">
          <summary><span>Budget travaux et coût technique</span><span className="num">{eur(r.technique.total.ttc)}</span></summary>
          <div className="pile">
            <div className="grille3">
              <label className="champ">Surface au sol rénovée ou terrain (m²)<Num v={h.travaux.surfaceTotale} pas={1} set={(n) => maj({ travaux: { ...h.travaux, surfaceTotale: n } })} /></label>
              <label className="champ">Surface Carrez vendue ou parcelles vendues (m²)<Num v={h.travaux.surfaceCarrez} pas={1} set={(n) => maj({ travaux: { ...h.travaux, surfaceCarrez: n } })} /></label>
            </div>
            <div className="defile">
              <table className="t">
                <thead><tr><th>Poste</th><th className="n">Montant TTC</th><th className="n">TVA</th><th className="n">% rénové</th></tr></thead>
                <tbody>
                  {(["grosOeuvre", "secondOeuvre"] as const).flatMap((g) =>
                    Object.entries(h.travaux[g]).map(([k, p]) => (
                      <tr key={k}>
                        <td>{LIBELLES_POSTES[k]} <span className="doux petit">· {g === "grosOeuvre" ? "gros œuvre (seuil 50 %)" : "second œuvre (seuil 66 %)"}</span></td>
                        <td className="n"><Num v={p.montantTTC} set={(n) => setPoste(g, k, { montantTTC: n })} /></td>
                        <td className="n">
                          <select value={p.tauxTVA} onChange={(e) => setPoste(g, k, { tauxTVA: Number(e.target.value) })}>
                            {TAUX_TVA.map((t) => <option key={t} value={t}>{pct(t, t === 0.055 ? 1 : 0)}</option>)}
                          </select>
                        </td>
                        <td className="n"><Num v={Math.round((p.pctRenove ?? 0) * 100)} pas={5} suffixe="%" largeur={70} set={(n) => setPoste(g, k, { pctRenove: n / 100 })} /></td>
                      </tr>
                    )),
                  )}
                  {(
                    [
                      ["honorairesTechniques", "Honoraires techniques (architecte, géomètre, BET…)"],
                      ["raccordements", "Raccordement réseaux"],
                      ["voirie", "Voiries et espaces verts"],
                    ] as const
                  ).map(([k, l]) => (
                    <tr key={k}>
                      <td>{l}</td>
                      <td className="n"><Num v={h.travaux[k].montantTTC} set={(n) => setAutre(k, { montantTTC: n })} /></td>
                      <td className="n">
                        <select value={h.travaux[k].tauxTVA} onChange={(e) => setAutre(k, { tauxTVA: Number(e.target.value) })}>
                          {TAUX_TVA.map((t) => <option key={t} value={t}>{pct(t, t === 0.055 ? 1 : 0)}</option>)}
                        </select>
                      </td>
                      <td></td>
                    </tr>
                  ))}
                  <tr><td>Surélévation (TVA 20 %)</td><td className="n"><Num v={h.travaux.surelevation} set={(n) => maj({ travaux: { ...h.travaux, surelevation: n } })} /></td><td /><td /></tr>
                  <tr><td>Extension (TVA 20 %)</td><td className="n"><Num v={h.travaux.extension} set={(n) => maj({ travaux: { ...h.travaux, extension: n } })} /></td><td /><td /></tr>
                  <tr><td>Équipement, ameublement</td><td className="n"><Num v={h.ameublement} set={(n) => maj({ ameublement: n })} /></td><td /><td /></tr>
                  <tr><td>Aléas</td><td className="n">{eur(r.technique.aleas.ttc)}</td><td /><td className="n"><Num v={Math.round(h.tauxAleas * 100)} pas={1} suffixe="%" largeur={70} set={(n) => maj({ tauxAleas: n / 100 })} /></td></tr>
                  <tr className="total"><td>Total coût technique</td><td className="n">{eur(r.technique.total.ttc)}</td><td className="n petit doux">dont TVA {eur(r.technique.total.tva)}</td><td /></tr>
                </tbody>
              </table>
            </div>
            {r.bascule.immeubleNeuf && <p className="alerte">Bascule en « immeuble neuf » ({r.bascule.raison}) : la TVA s'applique sur le prix de vente total.</p>}
          </div>
        </details>

        {/* ---------------- FRAIS ---------------- */}
        <details className="bloc">
          <summary><span>Honoraires et frais divers</span><span className="num">{eur(r.honorairesDivers.ttc + r.fraisDivers.total + r.honorairesVente.ttc)}</span></summary>
          <div>
            <table className="t">
              <tbody>
                <Ligne libelle="Honoraires de gestion (TTC)"><Num v={h.honorairesGestion} set={(n) => maj({ honorairesGestion: n })} /></Ligne>
                <Ligne libelle="Frais de comptabilité (TTC)"><Num v={h.fraisComptabilite} set={(n) => maj({ fraisComptabilite: n })} /></Ligne>
                <Ligne libelle="Frais de justice : huissier, avocat (TTC)"><Num v={h.fraisJustice} set={(n) => maj({ fraisJustice: n })} /></Ligne>
                <Ligne libelle="Montant emprunté"><Num v={h.financement.montantEmprunte} set={(n) => maj({ financement: { ...h.financement, montantEmprunte: n } })} /></Ligne>
                <Ligne libelle="Taux annuel"><Num v={Math.round(h.financement.tauxAnnuel * 10000) / 100} pas={0.1} suffixe="%" largeur={80} set={(n) => maj({ financement: { ...h.financement, tauxAnnuel: n / 100 } })} /></Ligne>
                <Ligne libelle="Durée de l'opération"><Num v={h.financement.dureeMois} pas={1} suffixe="mois" largeur={80} set={(n) => maj({ financement: { ...h.financement, dureeMois: n } })} /></Ligne>
                <Ligne libelle="Frais de dossier et garantie"><Num v={h.financement.fraisDossier} set={(n) => maj({ financement: { ...h.financement, fraisDossier: n } })} /></Ligne>
                <Ligne libelle="Frais financiers" aide="Emprunt × taux × durée + frais de dossier">{eur(r.fraisDivers.financiers)}</Ligne>
                <Ligne libelle="GFA si VEFR" aide="≈ 1 % des travaux"><Num v={h.gfa} set={(n) => maj({ gfa: n })} /></Ligne>
                <Ligne libelle="Assurance dommages-ouvrage" aide="≈ 2 % des travaux"><Num v={h.assuranceDO} set={(n) => maj({ assuranceDO: n })} /></Ligne>
                <Ligne libelle="Honoraires de vente (TTC)"><Num v={h.honorairesVente} set={(n) => maj({ honorairesVente: n })} /></Ligne>
                <Ligne libelle="Apport en fonds propres" aide="Pour le rendement des fonds propres"><Num v={h.apport} set={(n) => maj({ apport: n })} /></Ligne>
              </tbody>
            </table>
          </div>
        </details>

        {/* ---------------- RECETTES ---------------- */}
        <details className="bloc" open>
          <summary><span>Recettes · ventes</span><span className="num">{eur(r.recettes.chiffreAffaires)}</span></summary>
          <div className="pile">
            <div className="ligne">
              <label className="champ">
                Scénario de revente
                <select value={h.scenario} onChange={(e) => maj({ scenario: e.target.value as ScenarioRevente })}>
                  {SCENARIOS.map(([s, l]) => <option key={s} value={s}>{l}</option>)}
                </select>
              </label>
              {prefillDVF && (
                <button className="btn" onClick={() => { const l = prefillDVF(); if (l) maj({ lots: l }); }}>
                  Pré-remplir avec les comparables DVF
                </button>
              )}
            </div>
            <div className="defile">
              <table className="t">
                <thead><tr><th>Lot</th><th className="n">Surface</th><th className="n">Prix bas</th><th className="n">Prix haut</th><th className="n">Moyen</th><th className="n">€/m² moyen</th><th></th></tr></thead>
                <tbody>
                  {h.lots.map((l, i) => {
                    const moy = l.prixDown != null && l.prixTop != null ? (l.prixDown + l.prixTop) / 2 : l.prixDown ?? l.prixTop ?? 0;
                    return (
                      <tr key={i}>
                        <td><input value={l.libelle} onChange={(e) => setLot(i, { libelle: e.target.value })} /></td>
                        <td className="n"><Num v={l.surface ?? 0} pas={1} largeur={70} set={(n) => setLot(i, { surface: n })} /></td>
                        <td className="n"><Num v={l.prixDown ?? 0} set={(n) => setLot(i, { prixDown: n })} /></td>
                        <td className="n"><Num v={l.prixTop ?? 0} set={(n) => setLot(i, { prixTop: n })} /></td>
                        <td className="n">{eur(moy)}</td>
                        <td className="n">{l.surface ? m2(moy / l.surface) : "—"}</td>
                        <td><button className="lien" onClick={() => maj({ lots: h.lots.filter((_, k) => k !== i) })}>Retirer</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div><button className="btn" onClick={() => maj({ lots: [...h.lots, { libelle: `Lot ${h.lots.length + 1}`, prixDown: null, prixTop: null, tva: 0 }] })}>Ajouter un lot</button></div>
          </div>
        </details>
      </div>

      {/* ---------------- RÉSULTAT ---------------- */}
      <div className="collant pile">
        <div className="carte pile">
          <div className="entete"><h2>Rentabilité</h2><span className={`puce ${cls}`}>{pct(r.margeSurCA)} du CA</span></div>
          <div className="grille3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="kpi"><span className={`v ${cls}`}>{eur(r.beneficeBrut)}</span><span className="l">Bénéfice brut</span></div>
            <div className="kpi"><span className="v">{eur(r.beneficeNet)}</span><span className="l">Bénéfice net après IS</span></div>
            <div className="kpi"><span className="v">{pct(r.margeSurPrixRevient)}</span><span className="l">Marge sur prix de revient</span></div>
            <div className="kpi"><span className="v">{r.rendementFondsPropres == null ? "—" : pct(r.rendementFondsPropres)}</span><span className="l">Rendement des fonds propres</span></div>
          </div>
          <label className="champ">
            Régime de TVA
            <select value={h.regimeTVA} onChange={(e) => maj({ regimeTVA: e.target.value as RegimeTVA })}>
              <option value="marge">TVA sur marge</option>
              <option value="exoneration">Exonération de TVA</option>
              <option value="total">TVA sur prix total</option>
            </select>
          </label>
          {r.regimeApplique !== h.regimeTVA && <p className="alerte">Régime imposé : TVA sur prix total (bascule immeuble neuf).</p>}
          <table className="t">
            <tbody>
              <tr><td>Chiffre d'affaires</td><td className="n">{eur(r.recettes.chiffreAffaires)}</td></tr>
              <tr><td>Prix de revient du foncier</td><td className="n">{eur(r.foncier.total.ttc)}</td></tr>
              <tr><td>Marge brute TTC</td><td className="n">{eur(r.margeBruteTTC)}</td></tr>
              {r.regimeApplique === "marge" && <tr><td>TVA sur marge</td><td className="n">{eur(r.tvaSurMarge)}</td></tr>}
              {r.regimeApplique === "total" && <tr><td>TVA sur prix total</td><td className="n">{eur(r.tvaPrixTotal)}</td></tr>}
              <tr><td>TVA récupérable</td><td className="n">{eur(r.tvaRecuperable)}</td></tr>
              <tr><td>TVA due</td><td className="n">{eur(r.tvaDue)}</td></tr>
              <tr><td>Coût technique</td><td className="n">− {eur(r.technique.total.ttc)}</td></tr>
              <tr><td>Honoraires divers</td><td className="n">− {eur(r.honorairesDivers.ttc)}</td></tr>
              <tr><td>Frais divers (financiers, GFA, DO)</td><td className="n">− {eur(r.fraisDivers.total)}</td></tr>
              <tr><td>Honoraires de vente</td><td className="n">− {eur(r.honorairesVente.ttc)}</td></tr>
              <tr className="total"><td>Bénéfice brut</td><td className="n">{eur(r.beneficeBrut)}</td></tr>
              <tr><td>IS 15 % (jusqu'à 42 500 €)</td><td className="n">{eur(r.isTaux15)}</td></tr>
              <tr><td>IS 25 %</td><td className="n">{eur(r.isTaux25)}</td></tr>
              <tr className="total"><td>Bénéfice net</td><td className="n">{eur(r.beneficeNet)}</td></tr>
            </tbody>
          </table>
          <table className="t petit">
            <tbody>
              <tr><td>BFR (foncier + technique + divers)</td><td className="n">{eur(r.bfr.ttc)}</td></tr>
              <tr><td>Prix d'achat au m² (Carrez)</td><td className="n">{r.ratios.prixAchatM2Carrez ? m2(r.ratios.prixAchatM2Carrez) : "—"}</td></tr>
              <tr><td>Coût travaux HT au m² (Carrez)</td><td className="n">{r.ratios.coutTravauxHTM2Carrez ? m2(r.ratios.coutTravauxHTM2Carrez) : "—"}</td></tr>
              <tr><td>Prix de vente au m² (Carrez)</td><td className="n">{r.ratios.prixVenteM2Carrez ? m2(r.ratios.prixVenteM2Carrez) : "—"}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
