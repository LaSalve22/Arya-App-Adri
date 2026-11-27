"use client";
import { LIBELLES_SOURCES, nouvelleSource } from "@/lib/bilan/financement";
import type { SourceFinancement, TypeSource } from "@/lib/bilan/types";
import { eur, pct } from "@/lib/format";
import { Champ, Num } from "./ui";
import type { PropsOnglet } from "./types";

export default function Financement({ etat, setEtat, a }: PropsOnglet) {
  const h = etat.hypotheses;
  const sources = h.financement.sources ?? [];
  const majSources = (l: SourceFinancement[]) => {
    const fp = l.filter((s) => s.type === "fonds_propres" || s.type === "compte_courant" || s.type === "associe_jv").reduce((x, s) => x + s.montant, 0);
    // Les sources détaillées remplacent le prêt simple ; l'apport sert au rendement des fonds propres.
    setEtat({ ...etat, hypotheses: { ...h, apport: fp, financement: { ...h.financement, sources: l, fraisFinanciersManuels: null, montantEmprunte: l.filter((s) => s.type === "pret").reduce((x, s) => x + s.montant, 0) } } });
  };
  const majSource = (id: string, p: Partial<SourceFinancement>) => majSources(sources.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const ajouter = (t: TypeSource) => {
    const s = nouvelleSource(t);
    if (a.plan.ecart < 0) s.montant = Math.round(-a.plan.ecart / 1000) * 1000;
    majSources([...sources, s]);
  };
  const p = a.plan;

  return (
    <div className="pile">
      <div className="carte pile">
        <div className="entete"><h2>Plan de financement</h2><span className={`puce ${p.ecart < 0 ? "mauvais" : "bon"}`}>{p.ecart < 0 ? `Manque ${eur(-p.ecart)}` : "Financement couvert"}</span></div>
        <div className="grille3">
          <Champ label="Durée de l'opération (mois)"><Num v={h.financement.dureeMois} pas={1} largeur={80} set={(n) => setEtat({ ...etat, hypotheses: { ...h, financement: { ...h.financement, dureeMois: n } } })} /></Champ>
        </div>
        <div className="grille2">
          <table className="t">
            <thead><tr><th>Besoins</th><th className="n">Montant</th></tr></thead>
            <tbody>
              <tr><td>Foncier (prix, notaire, éviction, apporteur)</td><td className="n">{eur(p.besoins.foncier)}</td></tr>
              <tr><td>Coût technique (travaux, aléas, honoraires techniques)</td><td className="n">{eur(p.besoins.technique)}</td></tr>
              <tr><td>Honoraires et frais divers (dont frais financiers)</td><td className="n">{eur(p.besoins.honorairesEtFrais)}</td></tr>
              <tr className="total"><td>Total des besoins</td><td className="n">{eur(p.besoins.total)}</td></tr>
            </tbody>
          </table>
          <table className="t">
            <thead><tr><th>Ressources</th><th className="n">Montant</th></tr></thead>
            <tbody>
              {sources.map((s) => <tr key={s.id}><td>{s.libelle}</td><td className="n">{eur(s.montant)}</td></tr>)}
              {!sources.length && <tr><td className="doux" colSpan={2}>Ajoute des sources ci-dessous.</td></tr>}
              <tr className="total"><td>Total des ressources</td><td className="n">{eur(p.ressources)}</td></tr>
              <tr><td>Fonds propres et quasi-fonds propres</td><td className="n">{eur(a.fin.fondsPropres)} ({pct(p.besoins.total ? a.fin.fondsPropres / p.besoins.total : 0)})</td></tr>
              <tr><td>Endettement (prêts + obligations)</td><td className="n">{eur(a.fin.dette)} ({pct(p.tauxEndettement)})</td></tr>
            </tbody>
          </table>
        </div>
        <p className="doux petit">Les banques demandent en général 10 à 30 % de fonds propres sur une opération de marchand de biens.</p>
      </div>

      <div className="carte pile">
        <div className="entete"><h2>Sources de financement</h2></div>
        <div className="ligne">
          {(Object.keys(LIBELLES_SOURCES) as TypeSource[]).map((t) => <button key={t} className="btn" onClick={() => ajouter(t)}>+ {LIBELLES_SOURCES[t]}</button>)}
        </div>
        {sources.map((s) => (
          <details key={s.id} className="bloc" open>
            <summary><span>{s.libelle}</span><span className="num">{eur(s.montant)}</span></summary>
            <div className="grille3">
              <Champ label="Libellé"><input value={s.libelle} onChange={(e) => majSource(s.id, { libelle: e.target.value })} /></Champ>
              <Champ label="Montant (€)"><Num v={s.montant} set={(n) => majSource(s.id, { montant: n })} /></Champ>
              {(s.type === "pret" || s.type === "obligataire" || s.type === "compte_courant") && (
                <Champ label={s.type === "obligataire" ? "Coupon annuel" : s.type === "compte_courant" ? "Rémunération annuelle" : "Taux annuel"}>
                  <Num v={s.tauxAnnuel} echelle={100} pas={0.1} suffixe="%" largeur={80} set={(n) => majSource(s.id, { tauxAnnuel: n })} />
                </Champ>
              )}
              {(s.type === "pret" || s.type === "obligataire") && (
                <Champ label="Durée propre (mois)" aide="vide = durée de l'opération"><Num v={s.dureeMois ?? null} pas={1} largeur={80} set={(n) => majSource(s.id, { dureeMois: n || null })} /></Champ>
              )}
              {s.type === "pret" && (
                <>
                  <Champ label="Frais de dossier"><Num v={s.fraisDossier} pas={100} set={(n) => majSource(s.id, { fraisDossier: n })} /></Champ>
                  <Champ label="Garantie / caution / hypothèque"><Num v={s.fraisGarantie} pas={100} set={(n) => majSource(s.id, { fraisGarantie: n })} /></Champ>
                  <Champ label="Commission d'engagement" aide="ligne de crédit"><Num v={s.commissionEngagementPct} echelle={100} pas={0.1} suffixe="%" largeur={80} set={(n) => majSource(s.id, { commissionEngagementPct: n })} /></Champ>
                </>
              )}
              {s.type === "obligataire" && (
                <>
                  <Champ label="Frais de plateforme" aide="% du montant levé"><Num v={s.fraisPlateformePct} echelle={100} pas={0.5} suffixe="%" largeur={80} set={(n) => majSource(s.id, { fraisPlateformePct: n })} /></Champ>
                  <Champ label="Autres frais (avocat, émission)"><Num v={s.fraisDossier} pas={100} set={(n) => majSource(s.id, { fraisDossier: n })} /></Champ>
                </>
              )}
              {s.type === "associe_jv" && (
                <Champ label="Part du bénéfice net rétrocédée"><Num v={s.partBenefice} echelle={100} pas={5} suffixe="%" largeur={80} set={(n) => majSource(s.id, { partBenefice: Math.min(1, n) })} /></Champ>
              )}
            </div>
            <div className="ligne" style={{ justifyContent: "space-between", padding: "0 0 4px" }}>
              <span className="doux petit">Coût : {eur(a.fin.sources.find((c) => c.id === s.id)?.total ?? 0)}</span>
              <button className="lien" onClick={() => majSources(sources.filter((x) => x.id !== s.id))}>Retirer</button>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
