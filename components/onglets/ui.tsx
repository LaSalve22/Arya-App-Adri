"use client";
import type { Analyse } from "@/lib/analyse";
import type { EtatAnalyse } from "@/lib/etat";
import { classeMarge, eur, pct } from "@/lib/format";

export function Num({ v, set, pas = 1000, suffixe, largeur, echelle = 1 }: { v: number | null | undefined; set: (n: number) => void; pas?: number; suffixe?: string; largeur?: number; echelle?: number }) {
  const val = v == null || !Number.isFinite(v) ? "" : Math.round(v * echelle * 100) / 100;
  return (
    <span className="ligne" style={{ gap: 4, flexWrap: "nowrap" }}>
      <input type="number" step={pas} value={val} onChange={(e) => set(e.target.value === "" ? 0 : Number(e.target.value) / echelle)} style={{ width: largeur ?? 130 }} />
      {suffixe && <span className="doux petit">{suffixe}</span>}
    </span>
  );
}

export function Champ({ label, aide, children }: { label: string; aide?: string; children: React.ReactNode }) {
  return (
    <label className="champ">
      <span>{label}{aide && <span className="doux"> · {aide}</span>}</span>
      {children}
    </label>
  );
}

/** Bandeau compact des chiffres clés, visible sur les onglets de calcul ; le prix d'achat s'y modifie directement. */
export function Bandeau({ a, margeCible, etat, setEtat }: { a: Analyse; margeCible: number; etat?: EtatAnalyse; setEtat?: (e: EtatAnalyse) => void }) {
  const c = classeMarge(a.r.margeSurCA, margeCible);
  return (
    <div className="bandeau">
      {etat && setEtat && (
        <div className="bandeau-prix">
          <label htmlFor="prix-bandeau"><small>prix d'achat</small></label>
          <input id="prix-bandeau" type="number" step={1000} value={etat.hypotheses.prixAcquisition || ""} placeholder="à saisir"
            onChange={(e) => setEtat({ ...etat, hypotheses: { ...etat.hypotheses, prixAcquisition: Number(e.target.value) || 0 } })} />
        </div>
      )}
      <div><span className={`puce ${c}`}>{pct(a.r.margeSurCA)}</span><small>marge / CA</small></div>
      <div><strong className={c}>{eur(a.r.beneficeBrut)}</strong><small>bénéfice brut</small></div>
      <div><strong>{eur(a.r.beneficeNetSociete)}</strong><small>net société</small></div>
      <div><strong>{a.sortie.distribue ? eur(a.sortie.netAssocies) : "—"}</strong><small>net associés</small></div>
      <div><strong className={a.plan.ecart < 0 ? "mauvais" : undefined}>{eur(a.plan.ecart)}</strong><small>{a.plan.ecart < 0 ? "à financer" : "excédent financement"}</small></div>
    </div>
  );
}
