"use client";
import { useMemo } from "react";
import { calculerBilan } from "@/lib/bilan/calcul";
import { calculerResidencePrincipale, type OptionsRP } from "@/lib/bilan/residence";
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

export default function ComparatifRP({ h, rp, setRp }: { h: Hypotheses; rp: OptionsRP; setRp: (o: OptionsRP) => void }) {
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
        <h2>Comparatif : marchand de biens ou résidence principale</h2>
        <span className="doux petit">Même bien, même prix, mêmes travaux, même revente</span>
      </div>
      <p className="doux petit">
        Résidence principale : achat en nom propre, tu habites le bien puis tu le revends. Pas de TVA, pas d'impôt sur les sociétés, plus-value
        exonérée. Frais de notaire de droit commun. Durée de détention = « Durée de l'opération ».
      </p>
      <div className="grille3">
        <Champ label="Frais de notaire (ancien)" v={rp.tauxNotaire} echelle={100} pas={0.1} suffixe="%" set={(n) => maj({ tauxNotaire: n })} />
        <Champ label="Assurance emprunteur (par an)" v={rp.tauxAssurance} echelle={100} pas={0.05} suffixe="%" set={(n) => maj({ tauxAssurance: n })} />
        <Champ label="Garantie du prêt" v={rp.fraisGarantie} set={(n) => maj({ fraisGarantie: n })} />
        <Champ label="Indemnités de remboursement anticipé" v={rp.ira} set={(n) => maj({ ira: n })} />
        <Champ label="Charges par mois (taxe foncière, copro…)" v={rp.chargesMensuelles} pas={10} set={(n) => maj({ chargesMensuelles: n })} />
        <Champ label="Loyer économisé par mois (optionnel)" v={rp.loyerEvite} pas={10} set={(n) => maj({ loyerEvite: n })} />
        <Champ label="Diagnostics et frais de vente hors agence" v={rp.fraisRevente} set={(n) => maj({ fraisRevente: n })} />
      </div>
      <p>
        <span className={`puce ${rpGagne ? "bon" : "moyen"}`}>
          {rpGagne ? "Résidence principale" : "Marchand de biens"} plus rentable de {eur(Math.abs(q.gainNet - r.beneficeNet))}
        </span>{" "}
        en net, sur {q.dureeMois} mois{q.loyerEconomise ? " (hors loyer économisé)" : ""}.
      </p>
      <div className="defile">
        <table className="t">
          <thead><tr><th></th><th className="n">Marchand de biens (société)</th><th className="n">Résidence principale (nom propre)</th></tr></thead>
          <tbody>
            <L l="Prix d'achat" a={eur(h.prixAcquisition)} b={eur(q.prixAcquisition)} />
            <L l="Frais de notaire" a={`${eur(r.foncier.notaire.ttc)} (${pct(h.tauxNotaire, 0)})`} b={`${eur(q.notaire)} (${pct(rp.tauxNotaire)})`} />
            <L l="Travaux et aléas (TTC)" a={eur(r.technique.total.ttc)} b={eur(q.travaux)} />
            <L l="Frais financiers" a={eur(r.fraisDivers.financiers)} b={eur(q.financement.total)} />
            <L l="Honoraires gestion, compta, justice, GFA, DO" a={eur(r.honorairesDivers.ttc + r.fraisDivers.gfa + r.fraisDivers.assuranceDO)} b="—" />
            <L l="Charges pendant la détention" a="—" b={eur(q.charges)} />
            <L l="Frais de revente" a={eur(r.honorairesVente.ttc)} b={eur(q.fraisVente)} />
            <L l="Prix de revente" a={eur(r.recettes.chiffreAffaires)} b={eur(q.revente)} />
            <L l="TVA due" a={eur(r.tvaDue)} b="0 €" />
            <L l="Impôt" a={`${eur(r.impot)} (IS)`} b="0 € (plus-value exonérée)" />
            <L l="Gain net" a={eur(r.beneficeNet)} b={eur(q.gainNet)} tot />
            {q.loyerEconomise > 0 && <L l="Gain net avec loyer économisé" a="—" b={eur(q.gainAvecLoyer)} />}
            <L l="Marge" a={`${pct(r.margeSurCA)} du CA`} b={`${pct(q.margeSurRevente)} de la revente`} />
            <L l="Rendement de l'apport" a={r.rendementFondsPropres == null ? "—" : pct(r.rendementFondsPropres)} b={q.rendementApport == null ? "—" : pct(q.rendementApport)} />
            <L l="Gain net par mois" a={q.dureeMois ? eur(r.beneficeNet / q.dureeMois) : "—"} b={q.gainParMois == null ? "—" : eur(q.gainParMois)} />
          </tbody>
        </table>
      </div>
      <p className="doux petit">Côté société, le bénéfice net reste dans la société : le sortir en dividendes coûte en plus le prélèvement forfaitaire de 30 %.</p>
      <p className="alerte petit">
        L'exonération suppose que le bien soit réellement ta résidence principale au moment de la vente (occupation effective). Des achats-reventes
        répétés et rapprochés peuvent être requalifiés par l'administration fiscale en activité de marchand de biens. Comparatif indicatif, à valider
        avec ton notaire.
      </p>
    </div>
  );
}
