"use client";
import { useMemo } from "react";
import { calculerBilan } from "@/lib/bilan/calcul";
import { calculerResidencePrincipale, completerOptionsRP, type OptionsRP } from "@/lib/bilan/residence";
import type { Hypotheses } from "@/lib/bilan/types";
import { eur, pct } from "@/lib/format";

function Champ({ label, v, set, echelle = 1, pas = 100, suffixe }: { label: string; v: number; set: (n: number) => void; echelle?: number; pas?: number; suffixe?: string }) {
  return (
    <label className="champ">
      {label}
      <span className="ligne" style={{ gap: 4, flexWrap: "nowrap" }}>
        <input type="number" step={pas} value={Math.round(v * echelle * 100) / 100} onChange={(e) => set((Number(e.target.value) || 0) / echelle)} style={{ width: 110 }} />
        {suffixe && <span className="doux petit">{suffixe}</span>}
      </span>
    </label>
  );
}

export default function ComparatifRP({ h, rp: rpBrut, setRp, mode = "tout", netAssocies }: { h: Hypotheses; rp: OptionsRP; setRp: (o: OptionsRP) => void; mode?: "params" | "tableau" | "tout"; netAssocies?: number | null }) {
  const rp = completerOptionsRP(rpBrut);
  const r = useMemo(() => calculerBilan(h), [h]);
  const q = useMemo(() => calculerResidencePrincipale(h, rp), [h, rp]);
  const maj = (p: Partial<OptionsRP>) => setRp({ ...rp, ...p });
  const rpGagne = q.gainNet > r.beneficeNet;
  const L = ({ l, a, b, tot }: { l: string; a: React.ReactNode; b: React.ReactNode; tot?: boolean }) => (
    <tr className={tot ? "total" : undefined}><td>{l}</td><td className="n">{a}</td><td className="n">{b}</td></tr>
  );
  return (
    <div className="carte pile">
      <div className="entete">
        <h2>{mode === "params" ? "Résidence principale : paramètres" : "Comparatif : marchand de biens ou résidence principale"}</h2>
        <span className="doux petit">Même bien, même prix, mêmes travaux, même revente</span>
      </div>
      <p className="doux petit">
        Résidence principale : achat en nom propre, tu habites le bien puis tu le revends. Pas de TVA, pas d'impôt sur les sociétés, plus-value
        exonérée. Frais de notaire de droit commun. Financement par apport personnel et prêt immobilier amortissable, remboursé à la revente.
      </p>
      {mode !== "tableau" && <>
      <div className="carte pile" style={{ background: "var(--champ)" }}>
        <div className="entete"><h3>Banque et fonds propres</h3><span className="doux petit">Prêt immobilier amortissable, pas de ligne de crédit</span></div>
        <div className="grille3">
          <Champ label="Apport personnel (fonds propres)" v={rp.apport} pas={1000} set={(n) => maj({ apport: n })} />
          <label className="champ">
            Durée du prêt
            <span className="segments" role="radiogroup" aria-label="Durée du prêt">
              {[15, 20, 25].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={rp.dureePretAns === n} className={rp.dureePretAns === n ? "actif" : ""} onClick={() => maj({ dureePretAns: n })}>{n} ans</button>
              ))}
            </span>
          </label>
          <Champ label="Taux du prêt (nominal)" v={rp.tauxPret} echelle={100} pas={0.05} suffixe="%" set={(n) => maj({ tauxPret: n })} />
          <Champ label="Assurance emprunteur (par an)" v={rp.tauxAssurance} echelle={100} pas={0.05} suffixe="%" set={(n) => maj({ tauxAssurance: n })} />
          <Champ label="Garantie (caution)" v={rp.tauxGarantie} echelle={100} pas={0.1} suffixe="% du prêt" set={(n) => maj({ tauxGarantie: n })} />
          <Champ label="Frais de dossier" v={rp.fraisDossier} pas={100} set={(n) => maj({ fraisDossier: n })} />
          <Champ label="Durée de détention avant revente" v={rp.dureeDetentionMois} pas={1} suffixe="mois" set={(n) => maj({ dureeDetentionMois: n })} />
          <label className="ligne petit"><input type="checkbox" checked={rp.iraNegociees} onChange={(e) => maj({ iraNegociees: e.target.checked })} /> Indemnités de remboursement anticipé négociées à 0</label>
        </div>
        <div className="grille3">
          <div className="kpi"><span className="v">{eur(q.banque.montantEmprunte)}</span><span className="l">Montant emprunté · coût du projet {eur(q.banque.coutProjet)}</span></div>
          <div className="kpi"><span className="v">{eur(q.banque.mensualiteTotale)}</span><span className="l">Mensualité assurance comprise, sur {rp.dureePretAns} ans</span></div>
          <div className="kpi"><span className="v">{eur(q.banque.revenuMinimum)}</span><span className="l">Revenus nets mensuels minimum du foyer (35 % d'endettement)</span></div>
          <div className="kpi"><span className="v">{eur(q.banque.capitalRestantRevente)}</span><span className="l">Capital restant dû à la revente, après {rp.dureeDetentionMois} mois</span></div>
          <div className="kpi"><span className="v">{eur(q.financement.ira)}</span><span className="l">Indemnités de remboursement anticipé</span></div>
          <div className="kpi"><span className="v">{eur(q.cashMobilise)}</span><span className="l">Trésorerie mobilisée (apport et mensualités)</span></div>
        </div>
        {q.banque.alertes.map((x) => <p key={x} className="alerte petit">{x}</p>)}
        <p className="doux petit">Les autres revenus et crédits du foyer comptent dans les 35 % : la banque calcule l'endettement total. IRA légales : 6 mois d'intérêts, dans la limite de 3 % du capital restant dû.</p>
      </div>
      <div className="grille3">
        <Champ label="Frais de notaire (ancien)" v={rp.tauxNotaire} echelle={100} pas={0.1} suffixe="%" set={(n) => maj({ tauxNotaire: n })} />
        <Champ label="Charges par mois (taxe foncière, copro…)" v={rp.chargesMensuelles} pas={10} set={(n) => maj({ chargesMensuelles: n })} />
        <Champ label="Loyer économisé par mois (optionnel)" v={rp.loyerEvite} pas={10} set={(n) => maj({ loyerEvite: n })} />
        <Champ label="Diagnostics et frais de vente hors agence" v={rp.fraisRevente} set={(n) => maj({ fraisRevente: n })} />
      </div>
      </>}
      {mode !== "params" && <>
      <p>
        <span className={`puce ${rpGagne ? "bon" : "moyen"}`}>
          {rpGagne ? "Résidence principale" : "Marchand de biens"} plus rentable de {eur(Math.abs(q.gainNet - r.beneficeNet))}
        </span>{" "}
        en net{q.loyerEconomise ? " (hors loyer économisé)" : ""}. Société : {h.financement.dureeMois} mois · résidence principale : {q.dureeMois} mois de détention.
      </p>
      <div className="defile">
        <table className="t">
          <thead><tr><th></th><th className="n">Marchand de biens (société)</th><th className="n">Résidence principale (nom propre)</th></tr></thead>
          <tbody>
            <L l="Prix d'achat" a={eur(h.prixAcquisition)} b={eur(q.prixAcquisition)} />
            <L l="Frais de notaire" a={`${eur(r.foncier.notaire.ttc)} (${pct(h.tauxNotaire, 0)})`} b={`${eur(q.notaire)} (${pct(rp.tauxNotaire)})`} />
            <L l="Travaux et aléas (TTC)" a={eur(r.technique.total.ttc)} b={eur(q.travaux)} />
            <L l="Financement" a={`Ligne de crédit, ${h.financement.dureeMois} mois`} b={`Prêt ${rp.dureePretAns} ans, ${eur(q.banque.mensualiteTotale)}/mois`} />
            <L l="Apport (fonds propres)" a={eur(h.apport)} b={eur(rp.apport)} />
            <L l="Intérêts" a={eur(r.fraisDivers.financiers)} b={eur(q.financement.interets)} />
            <L l="Assurance, garantie, dossier, IRA" a="inclus ci-dessus" b={eur(q.financement.assurance + q.financement.garantie + q.financement.dossier + q.financement.ira)} />
            <L l="Honoraires gestion, compta, justice, GFA, DO" a={eur(r.honorairesDivers.ttc + r.fraisDivers.gfa + r.fraisDivers.assuranceDO)} b="—" />
            <L l="Charges pendant la détention" a="—" b={eur(q.charges)} />
            <L l="Frais de revente" a={eur(r.honorairesVente.ttc)} b={eur(q.fraisVente)} />
            <L l="Prix de revente" a={eur(r.recettes.chiffreAffaires)} b={eur(q.revente)} />
            <L l="TVA due" a={eur(r.tvaDue)} b="0 €" />
            <L l="Impôt" a={`${eur(r.impot)} (IS)`} b="0 € (plus-value exonérée)" />
            <L l="Gain net" a={eur(r.beneficeNet)} b={eur(q.gainNet)} tot />
            {netAssocies != null && <L l="Net en poche après sortie (dividendes)" a={eur(netAssocies)} b={eur(q.gainNet)} />}
            {q.loyerEconomise > 0 && <L l="Gain net avec loyer économisé" a="—" b={eur(q.gainAvecLoyer)} />}
            <L l="Marge" a={`${pct(r.margeSurCA)} du CA`} b={`${pct(q.margeSurRevente)} de la revente`} />
            <L l="Rendement de l'apport" a={r.rendementFondsPropres == null ? "—" : pct(r.rendementFondsPropres)} b={q.rendementApport == null ? "—" : pct(q.rendementApport)} />
            <L l="Gain net par mois" a={h.financement.dureeMois ? eur(r.beneficeNet / h.financement.dureeMois) : "—"} b={q.gainParMois == null ? "—" : eur(q.gainParMois)} />
          </tbody>
        </table>
      </div>
      <p className="doux petit">Côté société, le bénéfice net reste dans la société : le sortir en dividendes coûte en plus le prélèvement forfaitaire (31,4 % en 2026, voir l'onglet Profil MdB).</p>
      </>}
      <p className="alerte petit">
        L'exonération suppose que le bien soit réellement ta résidence principale au moment de la vente (occupation effective). Des achats-reventes
        répétés et rapprochés peuvent être requalifiés par l'administration fiscale en activité de marchand de biens. Comparatif indicatif, à valider
        avec ton notaire.
      </p>
    </div>
  );
}
