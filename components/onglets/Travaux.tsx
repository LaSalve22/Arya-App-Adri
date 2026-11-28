"use client";
import { useMemo, useRef, useState } from "react";
import Dictee from "@/components/Dictee";
import { appliquerCoutsTechniques, type CoutsTechniques, type EtatAnalyse } from "@/lib/etat";
import { CATALOGUE, LIBELLES_GAMME, type Gamme } from "@/lib/travaux/catalogue";
import { analyserDescription, type Compris } from "@/lib/travaux/dictee";
import { demarchesDuBien, LIBELLES_INTERLOCUTEURS, type Interlocuteur } from "@/lib/travaux/demarches";
import {
  FORFAITS, LIBELLES_ETATS, LIBELLES_PIECES, appliquerReport, chiffrer, idPiece, montantLot, piecesTypologie, proposerTravaux, reportDevis, reportForfait, reportLots, travauxDesLots,
  type EtatPiece, type Forfait, type PlanTravaux, type TypePiece,
} from "@/lib/travaux/plan";
import type { Lot, NatureLot, NatureOperation, RegimeTVA } from "@/lib/bilan/types";
import { NATURES_LOT, estimerLot, natureParDefaut, parUnite } from "@/lib/dvfLots";
import { eur, pct } from "@/lib/format";
import { Champ, Num } from "./ui";
import type { PropsOnglet } from "./types";

const COUTS_DEVIS: (keyof CoutsTechniques)[] = ["geometre", "architecte", "huissier", "avocat", "diagnosticsAchat", "autresTechniques"];

/** Report d'un plan (forfait ou devis) dans le bilan et les coûts techniques. */
export function appliquerPlan(etat: EtatAnalyse, plan: PlanTravaux): EtatAnalyse {
  const h = etat.hypotheses;
  const surfaceBien = etat.caracteristiques.surface ?? h.travaux.surfaceCarrez ?? 0;
  const surface = plan.surface ?? surfaceBien;
  if (plan.mode === "forfait" && plan.forfait) {
    const r = reportForfait(h.travaux, plan.forfait, surface, plan.projet, surfaceBien);
    return { ...etat, travauxPlan: plan, hypotheses: appliquerReport(h, r) };
  }
  if (plan.mode === "detail") {
    const r = reportDevis(h.travaux, plan, plan.pct ?? {}, surfaceBien);
    const c: CoutsTechniques = { ...etat.coutsTechniques };
    for (const k of COUTS_DEVIS) c[k] = r.coutsTechniques[k] ?? 0;
    return { ...etat, travauxPlan: plan, coutsTechniques: c, hypotheses: appliquerCoutsTechniques(appliquerReport(h, r), c) };
  }
  if (plan.mode === "lots") {
    const r = reportLots(h.travaux, travauxDesLots(h.lots), plan.projet, surfaceBien);
    return { ...etat, travauxPlan: plan, hypotheses: appliquerReport(h, r) };
  }
  return { ...etat, travauxPlan: plan };
}


/** Intègre ce qui a été compris d'une description dictée ou collée. */
export function fusionnerCompris(etat: EtatAnalyse, c: Compris): EtatAnalyse {
  const p = etat.travauxPlan;
  const plan: PlanTravaux = {
    ...p,
    pieces: c.pieces.length ? c.pieces : p.pieces,
    general: { ...p.general, ...c.general },
    projet: { ...p.projet, ...c.projet },
    gamme: c.gamme ?? p.gamme,
    // Le forfait compris n'est qu'une suggestion : il n'est appliqué au bilan que par un clic sur sa carte.
    forfait: p.forfait,
  };
  const car = { ...etat.caracteristiques };
  if (c.surface && !car.surface) car.surface = c.surface;
  if (c.typologie && !car.pieces) car.pieces = c.typologie;
  if (c.dpe && !car.dpe) car.dpe = c.dpe;
  return { ...etat, caracteristiques: car, travauxPlan: plan };
}

export default function Travaux({ etat, setEtat, a, fiche }: PropsOnglet) {
  const plan = etat.travauxPlan;
  const h = etat.hypotheses;
  const surfaceBien = etat.caracteristiques.surface ?? (h.travaux.surfaceCarrez || null);
  const surface = plan.surface ?? surfaceBien ?? 0;
  const [compris, setCompris] = useState<string[] | null>(null);
  const [ajoutArticle, setAjoutArticle] = useState("");

  const setPlan = (p: Partial<PlanTravaux>, appliquer = false) => {
    const np = { ...plan, ...p };
    setEtat(appliquer ? appliquerPlan(etat, np) : { ...etat, travauxPlan: np });
  };
  const setGeneral = (g: Partial<PlanTravaux["general"]>) => setPlan({ general: { ...plan.general, ...g } });
  const setProjet = (g: Partial<PlanTravaux["projet"]>) => {
    const np = { ...plan, projet: { ...plan.projet, ...g } };
    // Les critères de requalification (moins de 5 ans, surface créée) suivent immédiatement dans le bilan.
    setEtat(np.mode === "forfait" && !np.forfait ? { ...etat, travauxPlan: np } : appliquerPlan(etat, np));
  };

  function analyserTexte(texte: string) {
    const c = analyserDescription(texte);
    setEtat(fusionnerCompris({ ...etat, travauxPlan: { ...plan, notes: plan.notes ? `${plan.notes}\n${texte}` : texte } }, c));
    setCompris(c.resume.length ? c.resume : ["rien de précis : reformule avec les pièces et leur état (« cuisine à refaire, deux chambres à rafraîchir »)"]);
  }

  function genererDevis() {
    const p = proposerTravaux(plan, surfaceBien);
    const np: PlanTravaux = { ...plan, mode: "detail", lignes: p.lignes, pct: p.pct as Record<string, number> };
    setEtat(appliquerPlan(etat, np));
  }

  const lignes = useMemo(() => chiffrer(plan.lignes, plan.gamme), [plan.lignes, plan.gamme]);
  const totalDevis = lignes.reduce((s, l) => s + l.ttc, 0);
  const categories = [...new Set(lignes.map((l) => l.categorie))];
  const proposition = useMemo(() => (plan.pieces.length ? proposerTravaux(plan, surfaceBien) : null), [plan, surfaceBien]);

  const z = fiche?.urbanisme.ok ? fiche.urbanisme.data.zone : null;
  const notes = demarchesDuBien(etat, a.r, z);
  const groupes = [...new Set(notes.map((n) => n.interlocuteur))] as Interlocuteur[];

  const majPiece = (id: string, p: Partial<PlanTravaux["pieces"][number]>) => setPlan({ pieces: plan.pieces.map((x) => (x.id === id ? { ...x, ...p } : x)) });

  // ----- Travaux par lot revendu
  const natureDefaut = natureParDefaut(etat.caracteristiques.type);
  const enLots = plan.mode === "lots";
  const etatRef = useRef(etat);
  etatRef.current = etat;
  function majLot(i: number, p: Partial<Lot>, reestimer = false) {
    const lots = h.lots.map((l, k) => (k === i ? { ...l, ...p } : l));
    const e = { ...etat, hypotheses: { ...h, lots } };
    setEtat(enLots ? appliquerPlan(e, plan) : e);
    // Nature changée : le prix de revente DVF suit, comme dans le BP (sauf prix saisi à la main).
    if (reestimer && !lots[i].prixManuel && fiche?.codeInsee) {
      estimerLot(lots[i], { lon: fiche.lon, lat: fiche.lat, insee: fiche.codeInsee }, natureDefaut).then((r) => {
        if (!r) return;
        const cur = etatRef.current;
        const nl = cur.hypotheses.lots.map((l, k) => (k === i ? { ...l, prixDown: r.prixBas, prixTop: r.prixHaut } : l));
        setEtat({ ...cur, hypotheses: { ...cur.hypotheses, lots: nl } });
      });
    }
  }
  const totalLots = travauxDesLots(h.lots).reduce((s, l) => s + montantLot(l), 0);

  return (
    <div className="pile">
      {/* ---------------- DESCRIPTION ---------------- */}
      <div className="carte pile">
        <div className="entete">
          <h2>Décrire le bien</h2>
          <span className="doux petit">À la voix, en texte, ou depuis Claude avec les photos de l'annonce</span>
        </div>
        <Dictee libelle="Décrire le bien à la voix" surFin={analyserTexte} />
        <DescriptionTexte surValider={analyserTexte} />
        {compris && (
          <div className="ligne" style={{ gap: 6 }}>
            <span className="doux petit">Compris :</span>
            {compris.map((c) => <span key={c} className="puce">{c}</span>)}
          </div>
        )}
        <p className="doux petit">Exemple : « T3 de 65 m², cuisine et salle de bain à refaire, deux chambres à rafraîchir, électricité pas aux normes, simple vitrage, division en deux lots ». Pour analyser les photos, envoie-les à Claude avec le connecteur MADRIMMO : il remplit cet onglet pour toi.</p>
      </div>

      {/* ---------------- FORFAITS ---------------- */}
      <div className="carte pile">
        <div className="entete">
          <h2>Forfait rapide</h2>
          <label className="ligne petit">Surface traitée <Num v={surface} pas={1} largeur={80} suffixe="m²" set={(n) => setPlan({ surface: n || null }, plan.mode === "forfait" && !!plan.forfait)} /></label>
        </div>
        <div className="grille3">
          {(Object.keys(FORFAITS) as Forfait[]).map((f) => {
            const d = FORFAITS[f];
            const actif = plan.mode === "forfait" && plan.forfait === f;
            const conseille = proposition?.forfaitConseille === f;
            return (
              <button key={f} type="button" className={`forfait${actif ? " actif" : ""}`} aria-pressed={actif} onClick={() => setPlan({ mode: "forfait", forfait: f }, true)}>
                <span className="ligne" style={{ justifyContent: "space-between" }}>
                  <strong>{d.libelle}</strong>
                  {conseille && <span className="puce">conseillé</span>}
                </span>
                <span className="v">{eur(d.prixM2 * surface)}</span>
                <span className="doux petit">{d.prixM2} €/m² × {surface} m²</span>
                <span className="petit">{d.description}</span>
              </button>
            );
          })}
        </div>
        {plan.mode === "forfait" && plan.forfait && <p className="petit doux">Forfait « {FORFAITS[plan.forfait].libelle} » reporté dans le bilan. Pour affiner, décris les pièces puis génère le devis détaillé.</p>}
      </div>

      {/* ---------------- TRAVAUX PAR LOT ---------------- */}
      <div className="carte pile">
        <div className="entete">
          <h2>Travaux par lot</h2>
          <div className="ligne">
            <strong className="num">{eur(totalLots)}</strong>
            <button type="button" className={`btn${enLots ? "" : " principal"}`} disabled={!totalLots} onClick={() => setPlan({ mode: "lots" }, true)}>{enLots ? "Reporté dans le bilan" : "Chiffrer par lot dans le bilan"}</button>
          </div>
        </div>
        <div className="defile">
          <table className="t">
            <thead><tr><th>Lot</th><th>Nature</th><th className="n">Surface traitée</th><th>Travaux</th><th className="n">Montant TTC</th></tr></thead>
            <tbody>
              {h.lots.map((l, i) => {
                const nature = l.nature ?? natureDefaut;
                const choix = l.travauxForfait ?? (l.travauxMontant != null ? "libre" : "aucun");
                const tl = travauxDesLots([l])[0];
                return (
                  <tr key={i}>
                    <td>{l.libelle}</td>
                    <td>
                      <select value={nature} onChange={(e) => {
                        const n = e.target.value as NatureLot;
                        majLot(i, { nature: n, ...(parUnite(n) && l.travauxForfait ? { travauxForfait: null } : {}) }, true);
                      }} aria-label={`Nature de ${l.libelle}`}>
                        {NATURES_LOT.map(([k, lib]) => <option key={k} value={k}>{lib}</option>)}
                      </select>
                    </td>
                    <td className="n"><Num v={l.travauxSurface ?? l.surface ?? undefined} pas={1} largeur={70} suffixe="m²" set={(n) => majLot(i, { travauxSurface: n || null })} /></td>
                    <td>
                      <select value={choix} onChange={(e) => {
                        const v = e.target.value;
                        if (v === "aucun") majLot(i, { travauxForfait: null, travauxMontant: null });
                        else if (v === "libre") majLot(i, { travauxForfait: null, travauxMontant: l.travauxMontant ?? 0 });
                        else majLot(i, { travauxForfait: v as Forfait, travauxMontant: null });
                      }} aria-label={`Travaux de ${l.libelle}`}>
                        <option value="aucun">Aucun</option>
                        {(Object.keys(FORFAITS) as Forfait[]).map((f) => <option key={f} value={f}>{FORFAITS[f].libelle} · {FORFAITS[f].prixM2} €/m²</option>)}
                        <option value="libre">Montant libre</option>
                      </select>
                    </td>
                    <td className="n">{choix === "libre" ? <Num v={l.travauxMontant ?? 0} pas={500} set={(n) => majLot(i, { travauxMontant: n })} /> : eur(montantLot(tl))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="doux petit">Un forfait par lot selon sa nature : par exemple réhabilitation des appartements, rafraîchissement du local commercial, montant libre pour un garage. La nature se règle aussi dans le BP et sert au prix de revente DVF. Une fois « Chiffrer par lot » choisi, le total remplace le budget travaux du bilan et les % de requalification sont pondérés par la surface des lots.</p>
      </div>

      {/* ---------------- PIÈCES ---------------- */}
      <div className="carte pile">
        <div className="entete">
          <h2>État des pièces</h2>
          <div className="ligne">
            {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className="btn" onClick={() => setPlan({ pieces: piecesTypologie(n) })}>T{n}</button>)}
          </div>
        </div>
        {plan.pieces.length ? (
          <div className="defile">
            <table className="t">
              <thead><tr><th>Pièce</th><th className="n">Surface</th><th>État</th><th>Remarques</th><th /></tr></thead>
              <tbody>
                {plan.pieces.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <select value={p.type} onChange={(e) => majPiece(p.id, { type: e.target.value as TypePiece })} aria-label="Type de pièce">
                        {(Object.keys(LIBELLES_PIECES) as TypePiece[]).map((t) => <option key={t} value={t}>{LIBELLES_PIECES[t]}</option>)}
                      </select>
                    </td>
                    <td className="n"><Num v={p.surface ?? undefined} pas={1} largeur={70} suffixe="m²" set={(n) => majPiece(p.id, { surface: n || null })} /></td>
                    <td>
                      <div className="segments" role="radiogroup" aria-label="État">
                        {(Object.keys(LIBELLES_ETATS) as EtatPiece[]).map((e) => (
                          <button key={e} type="button" role="radio" aria-checked={p.etat === e} className={p.etat === e ? "actif" : ""} onClick={() => majPiece(p.id, { etat: e })}>{LIBELLES_ETATS[e]}</button>
                        ))}
                      </div>
                    </td>
                    <td><input value={p.remarques ?? ""} onChange={(e) => majPiece(p.id, { remarques: e.target.value })} placeholder="ex. parquet à garder" /></td>
                    <td><button className="lien" onClick={() => setPlan({ pieces: plan.pieces.filter((x) => x.id !== p.id) })}>Retirer</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="doux">Aucune pièce : dicte une description, choisis une typologie (T1 à T5) ou ajoute les pièces une par une.</p>}
        <div className="ligne">
          <button className="btn" onClick={() => setPlan({ pieces: [...plan.pieces, { id: idPiece(), type: "chambre", surface: null, etat: "renover" }] })}>Ajouter une pièce</button>
          <button className="btn principal" disabled={!plan.pieces.length} onClick={genererDevis}>Générer le devis détaillé</button>
        </div>

        <h3>Éléments généraux</h3>
        <div className="grille3">
          <Champ label="Électricité">
            <select value={plan.general.electricite} onChange={(e) => setGeneral({ electricite: e.target.value as never })}>
              <option value="ok">Aux normes</option><option value="a_reprendre">À reprendre par pièce</option><option value="a_refaire">À refaire entièrement</option>
            </select>
          </Champ>
          <Champ label="Chauffage">
            <select value={plan.general.chauffage} onChange={(e) => setGeneral({ chauffage: e.target.value as never })}>
              <option value="ok">Correct (PAC, chaudière récente)</option><option value="electrique_ancien">Convecteurs, chaudière ancienne</option><option value="a_refaire">À refaire</option><option value="absent">Absent</option>
            </select>
          </Champ>
          <Champ label="Fenêtres">
            <span className="ligne" style={{ flexWrap: "nowrap" }}>
              <select value={plan.general.menuiseries} onChange={(e) => setGeneral({ menuiseries: e.target.value as never })}>
                <option value="ok">Double vitrage</option><option value="simple_vitrage">Simple vitrage, à changer</option>
              </select>
              {plan.general.menuiseries === "simple_vitrage" && <Num v={plan.general.nbFenetres ?? undefined} pas={1} largeur={60} suffixe="u" set={(n) => setGeneral({ nbFenetres: n || null })} />}
            </span>
          </Champ>
          <Champ label="Plomberie">
            <select value={plan.general.plomberie} onChange={(e) => setGeneral({ plomberie: e.target.value as never })}>
              <option value="ok">Correcte</option><option value="a_refaire">Réseau à refaire</option>
            </select>
          </Champ>
          <Champ label="Structure">
            <select value={plan.general.structure} onChange={(e) => setGeneral({ structure: e.target.value as never })}>
              <option value="ok">Saine</option><option value="fissures">Fissures</option><option value="a_reprendre">À reprendre (mur porteur, IPN)</option>
            </select>
          </Champ>
          <Champ label="Toiture">
            <select value={plan.general.toiture} onChange={(e) => setGeneral({ toiture: e.target.value as never })}>
              <option value="sans_objet">Sans objet (appartement)</option><option value="ok">Correcte</option><option value="a_refaire">À refaire</option>
            </select>
          </Champ>
          <Champ label="Façade">
            <select value={plan.general.facade} onChange={(e) => setGeneral({ facade: e.target.value as never })}>
              <option value="ok">Correcte</option><option value="a_refaire">À ravaler ou reprendre</option>
            </select>
          </Champ>
          <Champ label="Année de construction"><Num v={plan.general.anneeConstruction ?? undefined} pas={1} largeur={90} set={(n) => setGeneral({ anneeConstruction: n || null })} /></Champ>
        </div>

        <h3>Projet</h3>
        <div className="grille3">
          <label className="ligne petit"><input type="checkbox" checked={plan.projet.division} onChange={(e) => setProjet({ division: e.target.checked, nbLots: Math.max(2, plan.projet.nbLots) })} /> Division en lots
            {plan.projet.division && <Num v={plan.projet.nbLots} pas={1} largeur={60} suffixe="lots" set={(n) => setProjet({ nbLots: Math.max(2, n) })} />}
          </label>
          <label className="ligne petit"><input type="checkbox" checked={plan.projet.divisionFonciere} onChange={(e) => setProjet({ divisionFonciere: e.target.checked })} /> Division foncière (terrain)</label>
          <label className="ligne petit"><input type="checkbox" checked={plan.projet.voieCommune} onChange={(e) => setProjet({ voieCommune: e.target.checked })} /> Voie ou espaces communs à créer</label>
          <label className="ligne petit"><input type="checkbox" checked={plan.projet.changementDestination} onChange={(e) => setProjet({ changementDestination: e.target.checked })} /> Changement de destination</label>
          <label className="ligne petit"><input type="checkbox" checked={plan.projet.modifFacade} onChange={(e) => setProjet({ modifFacade: e.target.checked })} /> Modification de façade ou de fenêtres</label>
          <label className="ligne petit"><input type="checkbox" checked={plan.projet.copropriete || etat.caracteristiques.type === "Appartement"} disabled={etat.caracteristiques.type === "Appartement"} onChange={(e) => setProjet({ copropriete: e.target.checked })} /> En copropriété</label>
          <label className="ligne petit"><input type="checkbox" checked={plan.projet.compteursACreer} onChange={(e) => setProjet({ compteursACreer: e.target.checked })} /> Compteurs à créer</label>
          <label className="ligne petit"><input type="checkbox" checked={plan.projet.acheveMoinsDe5Ans} onChange={(e) => setProjet({ acheveMoinsDe5Ans: e.target.checked })} /> Immeuble achevé depuis moins de 5 ans</label>
          <Champ label="Surface de plancher créée"><Num v={plan.projet.surfaceCreee} pas={1} largeur={80} suffixe="m²" set={(n) => setProjet({ surfaceCreee: n })} /></Champ>
          <Champ label="Places de parking à créer"><Num v={plan.projet.placesParking} pas={1} largeur={60} set={(n) => setProjet({ placesParking: n })} /></Champ>
          <Champ label="Assainissement">
            <select value={plan.projet.assainissement} onChange={(e) => setProjet({ assainissement: e.target.value as never })}>
              <option value="inconnu">À vérifier</option><option value="collectif">Tout-à-l'égout</option><option value="fosse">Fosse septique</option>
            </select>
          </Champ>
        </div>
      </div>

      {/* ---------------- DEVIS ---------------- */}
      {plan.mode === "detail" && (
        <div className="carte pile">
          <div className="entete">
            <h2>Devis détaillé</h2>
            <div className="ligne">
              <select value={plan.gamme} onChange={(e) => setPlan({ gamme: e.target.value as Gamme }, true)} aria-label="Gamme">
                {(Object.keys(LIBELLES_GAMME) as Gamme[]).map((g) => <option key={g} value={g}>{LIBELLES_GAMME[g]}</option>)}
              </select>
              <strong className="num">{eur(totalDevis)}</strong>
            </div>
          </div>
          <div className="defile">
            <table className="t">
              <thead><tr><th>Lot</th><th className="n">Quantité</th><th className="n">Prix unitaire</th><th className="n">Total TTC</th><th /></tr></thead>
              <tbody>
                {categories.flatMap((cat) => [
                  <tr key={cat} className="sous-titre"><td colSpan={5}>{cat}</td></tr>,
                  ...lignes.filter((l) => l.categorie === cat).map((l) => (
                    <tr key={l.id}>
                      <td>{l.lot}<div className="doux petit">{l.origine}</div></td>
                      <td className="n"><Num v={l.quantite} pas={1} largeur={80} suffixe={l.unite} set={(n) => setPlan({ lignes: plan.lignes.map((x) => (x.id === l.id ? { ...x, quantite: n } : x)) }, true)} /></td>
                      <td className="n">{eur(l.prixUnitaire)}</td>
                      <td className="n">{eur(l.ttc)}</td>
                      <td><button className="lien" onClick={() => setPlan({ lignes: plan.lignes.filter((x) => x.id !== l.id) }, true)}>Retirer</button></td>
                    </tr>
                  )),
                ])}
                <tr className="total"><td>Total travaux et études</td><td /><td /><td className="n">{eur(totalDevis)}</td><td /></tr>
              </tbody>
            </table>
          </div>
          <div className="ligne">
            <select value={ajoutArticle} onChange={(e) => setAjoutArticle(e.target.value)} aria-label="Lot à ajouter">
              <option value="">Ajouter un lot…</option>
              {CATALOGUE.filter((x) => !plan.lignes.some((l) => l.id === x.id)).map((x) => <option key={x.id} value={x.id}>{x.categorie} · {x.lot}</option>)}
            </select>
            <button className="btn" disabled={!ajoutArticle} onClick={() => { setPlan({ lignes: [...plan.lignes, { id: ajoutArticle, quantite: 1, origine: "Ajouté" }] }, true); setAjoutArticle(""); }}>Ajouter</button>
          </div>
          <p className="doux petit">Le devis remplace le budget travaux du bilan ; géomètre, architecte, avocat et huissier vont dans les coûts techniques, l'assurance dommages-ouvrage dans les frais divers. Les aléas ({pct(h.tauxAleas, 0)}) sont ajoutés dans le bilan.</p>
        </div>
      )}

      {/* ---------------- TVA ---------------- */}
      <div className="carte pile">
        <div className="entete">
          <h2>Requalification en immeuble neuf et TVA</h2>
          <span className={`puce ${a.r.bascule.immeubleNeuf ? "moyen" : "bon"}`}>{a.r.regimeApplique === "total" ? "TVA sur le prix total" : a.r.regimeApplique === "marge" ? "TVA sur la marge" : "Exonération de TVA"}</span>
        </div>
        <p>{a.r.regimeRaison}</p>
        <div className="grille2">
          {(["gros_oeuvre", "second_oeuvre"] as const).map((g) => (
            <div key={g} className="pile" style={{ gap: 8 }}>
              <h3>{g === "gros_oeuvre" ? "Gros œuvre · bascule si un élément atteint 50 %" : "Second œuvre · bascule si les 6 atteignent les deux tiers"}</h3>
              {a.r.bascule.criteres.filter((c) => c.groupe === g).map((c) => (
                <div key={c.cle} className="jauge">
                  <span className="petit">{c.libelle}</span>
                  <div className="piste" aria-hidden="true">
                    <div className={`rempli${c.atteint ? " atteint" : ""}`} style={{ width: `${Math.min(100, c.valeur * 100)}%` }} />
                    <div className="seuil" style={{ left: `${c.seuil * 100}%` }} />
                  </div>
                  <span className="petit num">{pct(c.valeur, 0)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="grille3">
          <Champ label="Nature de l'opération">
            <select value={h.natureOperation ?? "logement_ancien"} onChange={(e) => setEtat({ ...etat, hypotheses: { ...h, natureOperation: e.target.value as NatureOperation } })}>
              <option value="logement_ancien">Logement ancien</option><option value="terrain_a_batir">Terrain à bâtir</option><option value="division_fonciere">Division foncière</option>
            </select>
          </Champ>
          <Champ label="Régime de TVA">
            <select value={h.regimeTVA} onChange={(e) => setEtat({ ...etat, hypotheses: { ...h, regimeTVA: e.target.value as RegimeTVA } })}>
              <option value="auto">Automatique (selon le projet)</option><option value="exoneration">Exonération</option><option value="marge">TVA sur marge</option><option value="total">TVA sur prix total</option>
            </select>
          </Champ>
        </div>
        <p className="doux petit">Règle (BOFIP, art. 257 et 245 A CGI) : immeuble neuf si achevé depuis moins de 5 ans, ou si les travaux rendent neuve la majorité des fondations, de la structure ou des façades, ou les deux tiers de chacun des 6 postes de second œuvre, ou augmentent la surface de plancher de plus de 10 %. Les % se règlent aussi dans l'onglet BP.</p>
      </div>

      {/* ---------------- DÉMARCHES ---------------- */}
      <div className="carte pile">
        <div className="entete"><h2>Démarches administratives</h2><span className="doux petit">Qui contacter pour avancer vite</span></div>
        {groupes.map((g) => (
          <div key={g} className="pile" style={{ gap: 8 }}>
            <h3>{LIBELLES_INTERLOCUTEURS[g]}</h3>
            {notes.filter((n) => n.interlocuteur === g).map((n) => (
              <details key={n.id} className="demarche" open={n.prioritaire}>
                <summary>
                  <span>{n.prioritaire && <span className="puce moyen">avant le compromis</span>} {n.titre}</span>
                  {n.delai && <span className="doux petit">{n.delai}</span>}
                </summary>
                <p className="petit">{n.detail}</p>
                {n.clause && <p className="petit doux">Clause à prévoir : « {n.clause} »</p>}
              </details>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function DescriptionTexte({ surValider }: { surValider: (t: string) => void }) {
  const [t, setT] = useState("");
  return (
    <div className="pile" style={{ gap: 6 }}>
      <textarea value={t} onChange={(e) => setT(e.target.value)} placeholder="Ou tape, colle le texte de l'annonce ou la réponse de Claude…" style={{ minHeight: 70 }} />
      <div><button type="button" className="btn" disabled={!t.trim()} onClick={() => { surValider(t); setT(""); }}>Analyser le texte</button></div>
    </div>
  );
}
