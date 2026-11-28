"use client";
import { appliquerCoutsTechniques, baseTravaux, type CleCout, type CoutsTechniques, type EtatAnalyse } from "@/lib/etat";
import type { FraisVente as TFraisVente, Hypotheses } from "@/lib/bilan/types";
import { eur } from "@/lib/format";
import { Champ, Num } from "./ui";
import type { PropsOnglet } from "./types";

/** Montant saisi en euros ou en % du montant des travaux (recalculé quand les travaux changent). */
function ChampCout({ label, aide, cle, montant, etat, setEtat, setMontant, base }: {
  label: string; aide?: string; cle: CleCout; montant: number; etat: EtatAnalyse; setEtat: (e: EtatAnalyse) => void; setMontant: (n: number) => void; base: number;
}) {
  const p = etat.coutsPct?.[cle];
  const enPct = p != null;
  const setPct = (v: number | undefined) => setEtat({ ...etat, coutsPct: { ...etat.coutsPct, [cle]: v } });
  return (
    <label className="champ">
      <span>{label}{aide && <span className="doux"> · {aide}</span>}</span>
      <span className="ligne" style={{ gap: 6, flexWrap: "nowrap" }}>
        {enPct ? <Num v={p * 100} pas={0.5} largeur={80} suffixe="%" set={(n) => setPct(n / 100)} /> : <Num v={montant} pas={100} largeur={110} set={setMontant} />}
        <span className="segments" role="radiogroup" aria-label={`Unité : ${label}`}>
          <button type="button" role="radio" aria-checked={!enPct} className={!enPct ? "actif" : ""} onClick={() => setPct(undefined)}>€</button>
          <button type="button" role="radio" aria-checked={enPct} className={enPct ? "actif" : ""} onClick={() => setPct(base > 0 ? Math.round((montant / base) * 1000) / 1000 : 0)}>% travaux</button>
        </span>
      </span>
      {enPct && <span className="doux petit">= {eur(montant)} pour {eur(base)} de travaux</span>}
    </label>
  );
}

/** Onglet « Coûts techniques » : honoraires et frais annexes de l'opération. */
export function CoutsTechniquesOnglet({ etat, setEtat, a }: PropsOnglet) {
  const c = etat.coutsTechniques;
  const h = etat.hypotheses;
  const base = baseTravaux(h);
  const majC = (p: Partial<CoutsTechniques>) => {
    const n = { ...c, ...p };
    setEtat({ ...etat, coutsTechniques: n, hypotheses: appliquerCoutsTechniques(h, n) });
  };
  const majH = (p: Partial<Hypotheses>) => setEtat({ ...etat, hypotheses: { ...h, ...p } });
  const cc = (cle: keyof CoutsTechniques, label: string, aide?: string) => (
    <ChampCout cle={cle} label={label} aide={aide} montant={c[cle]} etat={etat} setEtat={setEtat} base={base} setMontant={(n) => majC({ [cle]: n })} />
  );
  const ch = (cle: "honorairesGestion" | "fraisComptabilite" | "assuranceDO" | "gfa", label: string, aide?: string) => (
    <ChampCout cle={cle} label={label} aide={aide} montant={h[cle]} etat={etat} setEtat={setEtat} base={base} setMontant={(n) => majH({ [cle]: n })} />
  );
  const totalTech = c.geometre + c.architecte + c.bet + c.diagnosticsAchat + c.autresTechniques;
  const totalJur = c.huissier + c.avocat;
  return (
    <div className="pile">
      <p className="doux petit">Chaque coût se saisit en euros ou en % du montant des travaux ({eur(base)} TTC, hors aléas) : en %, il suit automatiquement les changements de travaux (BP, forfait ou devis de l'onglet Travaux).</p>
      <div className="carte pile">
        <div className="entete"><h2>Honoraires techniques</h2><span className="num">{eur(totalTech)}</span></div>
        <div className="grille3">
          {cc("geometre", "Géomètre (division, bornage)")}
          {cc("architecte", "Architecte / maître d'œuvre", "8 à 12 % des travaux")}
          {cc("bet", "Bureau d'études / contrôle", "1 à 3 %")}
          {cc("diagnosticsAchat", "Diagnostics avant achat (amiante, plomb…)")}
          {cc("autresTechniques", "Autres (permis, DP, raccordement étude)")}
        </div>
        <p className="doux petit">Reporté dans la ligne « Honoraires techniques » du bilan (TVA 20 %), comptée dans la base des aléas.</p>
      </div>
      <div className="carte pile">
        <div className="entete"><h2>Juridique et gestion</h2><span className="num">{eur(totalJur + h.honorairesGestion + h.fraisComptabilite)}</span></div>
        <div className="grille3">
          {cc("huissier", "Huissier (constat, expulsion)")}
          {cc("avocat", "Avocat")}
          {ch("honorairesGestion", "Honoraires de gestion")}
          {ch("fraisComptabilite", "Comptabilité")}
          <Champ label="Indemnité d'éviction (locataire)"><Num v={h.indemniteEviction} pas={500} set={(n) => majH({ indemniteEviction: n })} /></Champ>
          <Champ label="Apporteur d'affaires (TTC)"><Num v={h.apporteurAffaires} pas={500} set={(n) => majH({ apporteurAffaires: n })} /></Champ>
        </div>
      </div>
      <div className="carte pile">
        <div className="entete"><h2>Assurances et garanties</h2><span className="num">{eur(h.gfa + h.assuranceDO)}</span></div>
        <div className="grille3">
          {ch("assuranceDO", "Assurance dommages-ouvrage", "2 à 4 % des travaux")}
          {ch("gfa", "GFA si vente en VEFR", "≈ 1 % des travaux")}
        </div>
        <p className="doux petit">Total honoraires et frais divers dans le bilan : {eur(a.r.honorairesDivers.ttc + h.gfa + h.assuranceDO)} (hors frais financiers).</p>
      </div>
    </div>
  );
}

/** Onglet « Frais de vente ». */
export function FraisVenteOnglet({ etat, setEtat, a }: PropsOnglet) {
  const h = etat.hypotheses;
  const fv: TFraisVente = h.fraisVente ?? { agencePct: null, diagnostics: 0, mainlevee: 0, homeStaging: 0, autres: 0 };
  const maj = (p: Partial<TFraisVente>) => setEtat({ ...etat, hypotheses: { ...h, fraisVente: { ...fv, ...p } } });
  const enPct = fv.agencePct != null;
  return (
    <div className="carte pile">
      <div className="entete"><h2>Frais de vente</h2><span className="num">{eur(a.r.honorairesVente.ttc)}</span></div>
      <div className="grille3">
        <Champ label="Honoraires d'agence">
          <select value={enPct ? "pct" : "eur"} onChange={(e) => maj({ agencePct: e.target.value === "pct" ? 0.05 : null })}>
            <option value="pct">En % du prix de vente</option><option value="eur">En montant</option>
          </select>
        </Champ>
        {enPct ? (
          <Champ label="Taux d'agence (TTC)"><Num v={fv.agencePct} echelle={100} pas={0.5} suffixe="%" largeur={80} set={(n) => maj({ agencePct: n })} /></Champ>
        ) : (
          <Champ label="Montant d'agence (TTC)"><Num v={h.honorairesVente} set={(n) => setEtat({ ...etat, hypotheses: { ...h, honorairesVente: n } })} /></Champ>
        )}
        <Champ label="Diagnostics de vente"><Num v={fv.diagnostics} pas={100} set={(n) => maj({ diagnostics: n })} /></Champ>
        <Champ label="Mainlevée d'hypothèque"><Num v={fv.mainlevee} pas={100} set={(n) => maj({ mainlevee: n })} /></Champ>
        <Champ label="Home staging, photos, annonces"><Num v={fv.homeStaging} pas={100} set={(n) => maj({ homeStaging: n })} /></Champ>
        <Champ label="Autres"><Num v={fv.autres} pas={100} set={(n) => maj({ autres: n })} /></Champ>
      </div>
      <table className="t">
        <tbody>
          <tr><td>Prix de vente (scénario {h.scenario === "down" ? "bas" : h.scenario === "top" ? "haut" : "moyen"})</td><td className="n">{eur(a.r.recettes.chiffreAffaires)}</td></tr>
          <tr className="total"><td>Total des frais de vente TTC</td><td className="n">{eur(a.r.honorairesVente.ttc)}</td></tr>
          <tr><td>Soit en % du prix de vente</td><td className="n">{a.r.recettes.chiffreAffaires ? ((a.r.honorairesVente.ttc / a.r.recettes.chiffreAffaires) * 100).toFixed(1).replace(".", ",") + " %" : "—"}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
