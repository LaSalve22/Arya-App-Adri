"use client";
import { useState } from "react";
import { LIBELLES_FORMES } from "@/lib/bilan/profil";
import { demarchesDuBien, LIBELLES_INTERLOCUTEURS } from "@/lib/travaux/demarches";
import { ChampRevente } from "@/components/Bilan";
import { Num } from "./ui";
import { classeMarge, eur, m2, pct } from "@/lib/format";
import type { PropsOnglet } from "./types";
import type { FormatPDF } from "@/components/pdf/RapportPDF";

export function pointsDeVigilance({ etat, a, fiche, comps }: Pick<PropsOnglet, "etat" | "a" | "fiche" | "comps">): string[] {
  const v: string[] = [];
  const c = etat.caracteristiques;
  if (!etat.prixAffiche) v.push("Prix affiché non renseigné.");
  if (a.r.technique.total.ttc === 0) v.push("Aucun budget travaux saisi : la marge est surestimée si le bien demande des travaux.");
  if (c.dpe === "F" || c.dpe === "G") v.push(`DPE ${c.dpe} : passoire thermique, rénovation énergétique à prévoir.`);
  if (a.plan.ecart < 0) v.push(`Plan de financement incomplet : il manque ${eur(-a.plan.ecart)}.`);
  if (a.r.bascule.immeubleNeuf) v.push(`Travaux « immeuble neuf » : TVA sur le prix total (${a.r.bascule.raison}).`);
  const z = fiche?.urbanisme.ok ? fiche.urbanisme.data.zone : null;
  if (z && /PSMV|SPR|patrimon/i.test(`${z.libelle} ${z.libelleLong ?? ""}`)) v.push(`Secteur patrimonial (${z.libelle}) : travaux soumis à l'Architecte des Bâtiments de France.`);
  if (fiche?.urbanisme.ok && !fiche.urbanisme.data.zone) v.push("Zonage PLU non publié en ligne : vérifier en mairie.");
  const r = fiche?.risques.ok ? fiche.risques.data : null;
  if (r?.argiles && /fort/i.test(r.argiles)) v.push(`Argiles : ${r.argiles.toLowerCase()} (fondations, assurance).`);
  if (r?.risques.includes("Inondation")) v.push("Commune exposée au risque inondation : vérifier le zonage PPRI de l'adresse.");
  if (comps && comps.stats.nb < 8) v.push(`Peu de ventes comparables (${comps.stats.nb}) : prix de revente à confirmer.`);
  for (const d of demarchesDuBien(etat, a.r, z).filter((d) => d.prioritaire && !["plu", "tva", "abf"].includes(d.id))) v.push(`${d.titre}, avant le compromis (${LIBELLES_INTERLOCUTEURS[d.interlocuteur]}).`);
  if (a.r.margeSurCA < etat.margeCible) v.push(`Marge (${pct(a.r.margeSurCA)}) inférieure à la cible de ${pct(etat.margeCible, 0)}.`);
  return v;
}

export default function Recap(props: PropsOnglet) {
  const { etat, a, fiche, comps, libelle } = props;
  const [inclureRP, setInclureRP] = useState(false);
  const [format, setFormat] = useState<FormatPDF>(() => (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches ? "paysage" : "portrait"));
  const [etatPdf, setEtatPdf] = useState<"" | "encours" | "erreur">("");
  const h = etat.hypotheses;
  const cls = classeMarge(a.r.margeSurCA, etat.margeCible);
  const vigilance = pointsDeVigilance(props);
  const pmMoyen = a.prixMax.find((p) => p.scenario === "moyen")?.prix ?? null;

  async function telecharger() {
    setEtatPdf("encours");
    try {
      const [{ pdf }, { default: RapportPDF }] = await Promise.all([import("@react-pdf/renderer"), import("@/components/pdf/RapportPDF")]);
      const blob = await pdf(<RapportPDF etat={etat} a={a} fiche={fiche} comps={comps} libelle={libelle} inclureRP={inclureRP} vigilance={vigilance} format={format} />).toBlob();
      const commune = (fiche?.parcelle.ok && fiche.parcelle.data?.commune) || "bien";
      const nom = `MADRIMMO_${commune.replace(/[^\wÀ-ÿ-]+/g, "-")}_${new Date().toISOString().slice(0, 10)}_${format}.pdf`;
      const url = URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = nom;
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setEtatPdf("");
    } catch (e) {
      console.error(e);
      setEtatPdf("erreur");
    }
  }

  return (
    <div className="pile">
      <div className={`verdict ${cls}`}>
        <strong>{cls === "bon" ? "Opération rentable" : cls === "moyen" ? "Opération à renégocier" : "Opération non rentable en l'état"}</strong> : marge de {pct(a.r.margeSurCA)} du CA
        pour une cible de {pct(etat.margeCible, 0)}. {pmMoyen != null && etat.prixAffiche > 0 && (pmMoyen >= h.prixAcquisition ? `Prix d'achat maximum ${eur(pmMoyen)} (revente moyenne).` : `Pour atteindre la cible, achat à ${eur(pmMoyen)} maximum (revente moyenne), soit ${pct(1 - pmMoyen / etat.prixAffiche)} sous le prix affiché.`)}
      </div>
      <div className="carte pile">
        <div className="entete"><h2>Synthèse</h2>
          <div className="ligne">
            <label className="ligne petit"><input type="checkbox" checked={inclureRP} onChange={(e) => setInclureRP(e.target.checked)} /> Inclure le comparatif résidence principale</label>
            <div className="segments" role="radiogroup" aria-label="Format du PDF">
              <button type="button" role="radio" aria-checked={format === "portrait"} className={format === "portrait" ? "actif" : ""} onClick={() => setFormat("portrait")}>Smartphone · portrait A4</button>
              <button type="button" role="radio" aria-checked={format === "paysage"} className={format === "paysage" ? "actif" : ""} onClick={() => setFormat("paysage")}>PC · paysage 16/9</button>
            </div>
            <button className="btn principal" onClick={telecharger} disabled={etatPdf === "encours"}>{etatPdf === "encours" ? "Génération…" : "Télécharger le PDF"}</button>
          </div>
        </div>
        <div className="grille3">
          <label className="champ">Prix d'achat (€)<Num v={h.prixAcquisition} set={(n) => props.setEtat({ ...etat, hypotheses: { ...h, prixAcquisition: n } })} /></label>
          <ChampRevente h={h} setH={(x) => props.setEtat({ ...etat, hypotheses: x })} />
        </div>
        {etatPdf === "erreur" && <p className="erreur">La génération du PDF a échoué. Réessaie ; si ça persiste, envoie-moi une capture.</p>}
        <div className="grille3">
          <div className="kpi"><span className="v">{eur(h.prixAcquisition)}</span><span className="l">Prix d'achat {etat.prixAffiche ? `(affiché ${eur(etat.prixAffiche)})` : ""}</span></div>
          <div className="kpi"><span className="v">{eur(a.r.technique.total.ttc)}</span><span className="l">Travaux et coût technique TTC</span></div>
          <div className="kpi"><span className="v">{eur(a.r.recettes.chiffreAffaires)}</span><span className="l">Prix de revente</span></div>
          <div className="kpi"><span className={`v ${cls}`}>{eur(a.r.beneficeBrut)}</span><span className="l">Bénéfice brut · {pct(a.r.margeSurCA)} du CA</span></div>
          <div className="kpi"><span className="v">{eur(a.r.beneficeNetSociete)}</span><span className="l">Bénéfice net société</span></div>
          <div className="kpi"><span className="v">{a.sortie.distribue ? eur(a.sortie.netAssocies) : "—"}</span><span className="l">Net associés ({LIBELLES_FORMES[etat.profil.forme].split(" (")[0]})</span></div>
          <div className="kpi"><span className="v">{eur(a.plan.besoins.total)}</span><span className="l">Besoin de financement</span></div>
          <div className="kpi"><span className="v">{eur(a.fin.fondsPropres)}</span><span className="l">Fonds propres · {pct(a.plan.besoins.total ? a.fin.fondsPropres / a.plan.besoins.total : 0)}</span></div>
          <div className="kpi"><span className="v">{a.r.rendementFondsPropres == null ? "—" : pct(a.r.rendementFondsPropres)}</span><span className="l">Rendement des fonds propres</span></div>
        </div>
      </div>
      <div className="grille2">
        <div className="carte pile">
          <h2>Bilan résumé</h2>
          <table className="t"><tbody>
            <tr><td>Chiffre d'affaires</td><td className="n">{eur(a.r.recettes.chiffreAffaires)}</td></tr>
            <tr><td>Foncier (prix + notaire + frais)</td><td className="n">− {eur(a.r.foncier.total.ttc)}</td></tr>
            <tr><td>Coût technique</td><td className="n">− {eur(a.r.technique.total.ttc)}</td></tr>
            <tr><td>Honoraires et frais divers</td><td className="n">− {eur(a.r.honorairesDivers.ttc + a.r.fraisDivers.gfa + a.r.fraisDivers.assuranceDO)}</td></tr>
            <tr><td>Frais financiers</td><td className="n">− {eur(a.r.fraisDivers.financiers)}</td></tr>
            <tr><td>Frais de vente</td><td className="n">− {eur(a.r.honorairesVente.ttc)}</td></tr>
            <tr><td>TVA due ({a.r.regimeApplique === "marge" ? "sur marge" : a.r.regimeApplique === "total" ? "sur prix total" : "exonération"})</td><td className="n">− {eur(a.r.tvaDue)}</td></tr>
            <tr className="total"><td>Bénéfice brut</td><td className="n">{eur(a.r.beneficeBrut)}</td></tr>
            <tr><td>Impôt sur les sociétés</td><td className="n">− {eur(a.r.impot)}</td></tr>
            <tr className="total"><td>Bénéfice net</td><td className="n">{eur(a.r.beneficeNet)}</td></tr>
          </tbody></table>
        </div>
        <div className="carte pile">
          <h2>Points de vigilance</h2>
          {vigilance.length ? <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>{vigilance.map((v) => <li key={v}>{v}</li>)}</ul> : <p className="doux">Rien à signaler.</p>}
          <h2>Marché</h2>
          <p>{comps ? <>Médiane des biens comparables : <strong>{m2(comps.stats.mediane)}</strong> ({comps.stats.nb} ventes, rayon {comps.rayon} m), fourchette {m2(comps.stats.p25)} – {m2(comps.stats.p75)}.</> : "Comparables en cours de chargement."}</p>
          <h2>Comparatif résidence principale</h2>
          <p>En résidence principale (nom propre, plus-value exonérée) : gain net de <strong>{eur(a.rp.gainNet)}</strong>, contre {eur(a.r.beneficeNet)} net en société.</p>
        </div>
      </div>
    </div>
  );
}
