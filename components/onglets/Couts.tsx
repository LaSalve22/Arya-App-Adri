"use client";
import { appliquerCoutsTechniques, type CoutsTechniques } from "@/lib/etat";
import type { FraisVente as TFraisVente, Hypotheses } from "@/lib/bilan/types";
import { eur } from "@/lib/format";
import { Champ, Num } from "./ui";
import type { PropsOnglet } from "./types";

/** Onglet « Coûts techniques » : honoraires et frais annexes de l'opération. */
export function CoutsTechniquesOnglet({ etat, setEtat, a }: PropsOnglet) {
  const c = etat.coutsTechniques;
  const h = etat.hypotheses;
  const majC = (p: Partial<CoutsTechniques>) => {
    const n = { ...c, ...p };
    setEtat({ ...etat, coutsTechniques: n, hypotheses: appliquerCoutsTechniques(h, n) });
  };
  const majH = (p: Partial<Hypotheses>) => setEtat({ ...etat, hypotheses: { ...h, ...p } });
  const totalTech = c.geometre + c.architecte + c.bet + c.diagnosticsAchat + c.autresTechniques;
  const totalJur = c.huissier + c.avocat;
  return (
    <div className="pile">
      <div className="carte pile">
        <div className="entete"><h2>Honoraires techniques</h2><span className="num">{eur(totalTech)}</span></div>
        <div className="grille3">
          <Champ label="Géomètre (division, bornage)"><Num v={c.geometre} pas={100} set={(n) => majC({ geometre: n })} /></Champ>
          <Champ label="Architecte / maître d'œuvre"><Num v={c.architecte} pas={100} set={(n) => majC({ architecte: n })} /></Champ>
          <Champ label="Bureau d'études / contrôle"><Num v={c.bet} pas={100} set={(n) => majC({ bet: n })} /></Champ>
          <Champ label="Diagnostics avant achat (amiante, plomb…)"><Num v={c.diagnosticsAchat} pas={100} set={(n) => majC({ diagnosticsAchat: n })} /></Champ>
          <Champ label="Autres (permis, DP, raccordement étude)"><Num v={c.autresTechniques} pas={100} set={(n) => majC({ autresTechniques: n })} /></Champ>
        </div>
        <p className="doux petit">Reporté dans la ligne « Honoraires techniques » du bilan (TVA 20 %), comptée dans la base des aléas.</p>
      </div>
      <div className="carte pile">
        <div className="entete"><h2>Juridique et gestion</h2><span className="num">{eur(totalJur + h.honorairesGestion + h.fraisComptabilite)}</span></div>
        <div className="grille3">
          <Champ label="Huissier (constat, expulsion)"><Num v={c.huissier} pas={100} set={(n) => majC({ huissier: n })} /></Champ>
          <Champ label="Avocat"><Num v={c.avocat} pas={100} set={(n) => majC({ avocat: n })} /></Champ>
          <Champ label="Honoraires de gestion"><Num v={h.honorairesGestion} pas={100} set={(n) => majH({ honorairesGestion: n })} /></Champ>
          <Champ label="Comptabilité"><Num v={h.fraisComptabilite} pas={100} set={(n) => majH({ fraisComptabilite: n })} /></Champ>
          <Champ label="Indemnité d'éviction (locataire)"><Num v={h.indemniteEviction} pas={500} set={(n) => majH({ indemniteEviction: n })} /></Champ>
          <Champ label="Apporteur d'affaires (TTC)"><Num v={h.apporteurAffaires} pas={500} set={(n) => majH({ apporteurAffaires: n })} /></Champ>
        </div>
      </div>
      <div className="carte pile">
        <div className="entete"><h2>Assurances et garanties</h2><span className="num">{eur(h.gfa + h.assuranceDO)}</span></div>
        <div className="grille3">
          <Champ label="Assurance dommages-ouvrage" aide="≈ 2 % des travaux"><Num v={h.assuranceDO} pas={100} set={(n) => majH({ assuranceDO: n })} /></Champ>
          <Champ label="GFA si vente en VEFR" aide="≈ 1 % des travaux"><Num v={h.gfa} pas={100} set={(n) => majH({ gfa: n })} /></Champ>
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
