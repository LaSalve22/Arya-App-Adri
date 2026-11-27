"use client";
import { calculerBilan } from "@/lib/bilan/calcul";
import { calculerFinancement, LIBELLES_SOURCES } from "@/lib/bilan/financement";
import { eur, pct } from "@/lib/format";
import type { PropsOnglet } from "./types";

export default function FraisFinanciers({ etat, a }: PropsOnglet) {
  const h = etat.hypotheses;
  const sources = h.financement.sources ?? [];
  const total = a.r.fraisDivers.financiers;
  const durees = [6, 9, 12, 18, 24];
  return (
    <div className="pile">
      <div className="carte pile">
        <h2>Coût du financement</h2>
        <div className="grille3">
          <div className="kpi"><span className="v">{eur(total)}</span><span className="l">Frais financiers sur {h.financement.dureeMois} mois</span></div>
          <div className="kpi"><span className="v">{pct(a.r.recettes.chiffreAffaires ? total / a.r.recettes.chiffreAffaires : 0)}</span><span className="l">du chiffre d'affaires</span></div>
          <div className="kpi"><span className="v">{pct(a.r.beneficeBrut + total > 0 ? total / (a.r.beneficeBrut + total) : 0)}</span><span className="l">de la marge avant frais financiers</span></div>
        </div>
        {sources.length ? (
          <div className="defile">
            <table className="t">
              <thead><tr><th>Source</th><th className="n">Montant</th><th className="n">Durée</th><th className="n">Intérêts / coupons</th><th className="n">Frais</th><th className="n">Total</th><th className="n">Coût annuel</th></tr></thead>
              <tbody>
                {a.fin.sources.map((c) => (
                  <tr key={c.id}>
                    <td>{c.libelle}<div className="doux petit">{LIBELLES_SOURCES[c.type]}</div></td>
                    <td className="n">{eur(c.montant)}</td><td className="n">{c.dureeMois} mois</td><td className="n">{eur(c.interets)}</td>
                    <td className="n">{eur(c.frais)}</td><td className="n">{eur(c.total)}</td><td className="n">{pct(c.coutAnnualise)}</td>
                  </tr>
                ))}
                <tr className="total"><td>Total</td><td className="n">{eur(a.fin.totalRessources)}</td><td /><td /><td /><td className="n">{eur(a.fin.totalFrais)}</td><td /></tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="alerte">Aucune source de financement détaillée : ajoute un prêt, une levée obligataire ou des fonds propres dans l'onglet « Mode de financement ».</p>
        )}
        {a.fin.partBeneficeJV > 0 && <p className="doux">Associés en participation : {pct(a.fin.partBeneficeJV, 0)} du bénéfice net, soit {eur(a.r.partageJV)} (pas un frais financier, déduit après impôt).</p>}
      </div>
      <div className="carte pile">
        <h2>Et si l'opération dure plus longtemps ?</h2>
        <div className="defile">
          <table className="t">
            <thead><tr><th>Durée</th><th className="n">Frais financiers</th><th className="n">Bénéfice brut</th><th className="n">Marge / CA</th></tr></thead>
            <tbody>
              {durees.map((d) => {
                const hh = { ...h, financement: { ...h.financement, dureeMois: d } };
                const r = calculerBilan(hh);
                const f = sources.length ? calculerFinancement(sources, d).totalFrais : r.fraisDivers.financiers;
                return (
                  <tr key={d} style={d === h.financement.dureeMois ? { fontWeight: 700 } : undefined}>
                    <td>{d} mois</td><td className="n">{eur(f)}</td><td className="n">{eur(r.beneficeBrut)}</td><td className="n">{pct(r.margeSurCA)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="doux petit">Chaque mois de retard (permis, travaux, vente) coûte des intérêts : c'est souvent le premier poste qui fait dériver une opération.</p>
      </div>
    </div>
  );
}
