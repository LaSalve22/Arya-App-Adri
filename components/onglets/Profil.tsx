"use client";
import { LIBELLES_FORMES, type FormeSociete, type ModeSortie, type ProfilMdB } from "@/lib/bilan/profil";
import type { RegimeTVA } from "@/lib/bilan/types";
import { eur, pct } from "@/lib/format";
import { Champ, Num } from "./ui";
import type { PropsOnglet } from "./types";

export default function Profil({ etat, setEtat, a }: PropsOnglet) {
  const p = etat.profil;
  const h = etat.hypotheses;
  const maj = (x: Partial<ProfilMdB>) => setEtat({ ...etat, profil: { ...p, ...x } });
  const s = a.sortie;
  return (
    <div className="pile">
      <div className="carte pile">
        <h2>Société marchand de biens</h2>
        <div className="grille3">
          <Champ label="Forme">
            <select value={p.forme} onChange={(e) => maj({ forme: e.target.value as FormeSociete })}>
              {(Object.keys(LIBELLES_FORMES) as FormeSociete[]).map((f) => <option key={f} value={f}>{LIBELLES_FORMES[f]}</option>)}
            </select>
          </Champ>
          <Champ label="Capital social (€)"><Num v={p.capitalSocial} pas={1000} set={(n) => maj({ capitalSocial: n })} /></Champ>
          <Champ label="Régime de TVA à la revente">
            <select value={h.regimeTVA} onChange={(e) => setEtat({ ...etat, hypotheses: { ...h, regimeTVA: e.target.value as RegimeTVA } })}>
              <option value="marge">TVA sur marge (cas courant)</option><option value="exoneration">Exonération de TVA</option><option value="total">TVA sur prix total</option>
            </select>
          </Champ>
          <Champ label="Frais de notaire à l'achat">
            <select value={h.tauxNotaire} onChange={(e) => setEtat({ ...etat, hypotheses: { ...h, tauxNotaire: Number(e.target.value) } })}>
              <option value={0.03}>3 % · engagement de revente sous 5 ans</option><option value={0.08}>8 % · droit commun</option>
            </select>
          </Champ>
          <Champ label="Bénéfice">
            <select value={p.modeSortie} onChange={(e) => maj({ modeSortie: e.target.value as ModeSortie })}>
              <option value="dividendes">Distribué en dividendes</option><option value="conserver">Conservé en société (réinvesti)</option>
            </select>
          </Champ>
          <Champ label="Prélèvement forfaitaire (PFU)" aide="31,4 % en 2026"><Num v={p.tauxPFU} echelle={100} pas={0.1} suffixe="%" largeur={80} set={(n) => maj({ tauxPFU: n })} /></Champ>
          {p.forme === "SARL_majoritaire" && (
            <Champ label="Cotisations sociales TNS sur dividendes"><Num v={p.tauxCotisationsTNS} echelle={100} pas={1} suffixe="%" largeur={80} set={(n) => maj({ tauxCotisationsTNS: n })} /></Champ>
          )}
        </div>
        {r_bascule(a.r.bascule.immeubleNeuf, a.r.bascule.raison)}
      </div>

      <div className="carte pile">
        <h2>Du bénéfice au net en poche</h2>
        <table className="t">
          <tbody>
            <tr><td>Bénéfice brut de l'opération</td><td className="n">{eur(a.r.beneficeBrut)}</td></tr>
            <tr><td>Impôt sur les sociétés (15 % jusqu'à 42 500 €, puis 25 %)</td><td className="n">− {eur(a.r.impot)}</td></tr>
            {a.r.partageJV > 0 && <tr><td>Part des associés en participation</td><td className="n">− {eur(a.r.partageJV)}</td></tr>}
            <tr className="total"><td>Bénéfice net de la société</td><td className="n">{eur(a.r.beneficeNetSociete)}</td></tr>
            {p.modeSortie === "dividendes" ? (
              <>
                {s.seuilDixPourCent != null && <tr><td>Seuil des 10 % (capital + comptes courants)</td><td className="n">{eur(s.seuilDixPourCent)}</td></tr>}
                <tr><td>Prélèvement forfaitaire (impôt + prélèvements sociaux)</td><td className="n">− {eur(s.pfu)}</td></tr>
                {s.cotisationsSociales > 0 && <tr><td>Cotisations sociales TNS (au-delà de 10 %)</td><td className="n">− {eur(s.cotisationsSociales)}</td></tr>}
                <tr className="total"><td>Net en poche pour les associés</td><td className="n">{eur(s.netAssocies)}</td></tr>
              </>
            ) : (
              <tr className="total"><td>Conservé en société pour la prochaine opération</td><td className="n">{eur(s.conserveEnSociete)}</td></tr>
            )}
            <tr><td>Taux global de prélèvement (IS + sortie)</td><td className="n">{pct(s.tauxGlobal)}</td></tr>
          </tbody>
        </table>
        <p className="doux petit">
          En SAS, les dividendes ne supportent que le prélèvement forfaitaire. En SARL avec gérant majoritaire, la part des dividendes au-delà de 10 % du capital, des primes et des comptes
          courants supporte les cotisations sociales des indépendants : un capital faible rend la SARL coûteuse pour distribuer. Estimation indicative, à valider avec ton expert-comptable.
        </p>
      </div>
    </div>
  );
}

function r_bascule(neuf: boolean, raison: string) {
  return neuf ? <p className="alerte">Travaux qualifiés d'« immeuble neuf » ({raison}) : la TVA s'applique sur le prix total, quel que soit le régime choisi.</p> : null;
}
