// Chiffre l'opération type du livret de présentation avec le vrai moteur de l'appli.
// Usage : npx tsx scripts/operation-type.ts > docs/marque/operation-type.json
import { analyser } from "../lib/analyse";
import { etatParDefaut } from "../lib/etat";
import { nouvelleSource } from "../lib/bilan/financement";

const e = etatParDefaut();
const h = e.hypotheses;
h.prixAcquisition = 120000;
h.regimeTVA = "exoneration"; // logement ancien revendu sans option : vente exonérée de TVA
const t = h.travaux;
t.surfaceTotale = 65;
t.surfaceCarrez = 65;
t.secondOeuvre.electricite.montantTTC = 9000;
t.secondOeuvre.sanitaires.montantTTC = 9000;
t.secondOeuvre.cloisons.montantTTC = 4000;
t.secondOeuvre.planchers.montantTTC = 6000;
t.secondOeuvre.chauffage.montantTTC = 4000;
h.lots = [{ libelle: "Appartement T3 65 m²", surface: 65, prixDown: 195000, prixTop: 215000, prixSaisi: 205000, tva: 0 }];
h.scenario = "saisi";
h.fraisVente = { agencePct: null, diagnostics: 500, mainlevee: 0, homeStaging: 0, autres: 0 };
h.financement.dureeMois = 9;
const pret = { ...nouvelleSource("pret", "pret"), montant: 130000, tauxAnnuel: 0.045, dureeMois: 9, fraisDossier: 1000 };
const fp = { ...nouvelleSource("fonds_propres", "fp"), montant: 40000 };
h.financement.sources = [fp, pret];
e.prixAffiche = 140000;
const a = analyser(e);
const r = a.r;
console.log(JSON.stringify({
  achat: h.prixAcquisition, notaire: r.foncier.notaire.ttc, foncier: r.foncier.total.ttc,
  travaux: r.technique.grosEtSecondOeuvre.ttc, aleas: r.technique.aleas.ttc, technique: r.technique.total.ttc,
  financiers: r.fraisDivers.financiers, vente: r.honorairesVente.ttc, ca: r.recettes.chiffreAffaires,
  tva: r.tvaDue, beneficeBrut: r.beneficeBrut, marge: r.margeSurCA, is: r.impot, net: r.beneficeNetSociete,
  netAssocies: a.sortie.netAssocies, besoin: a.plan.besoins.total, fondsPropres: a.fin.fondsPropres,
  rendementFP: r.rendementFondsPropres, prixMaxMoyen: a.prixMax.find((p) => p.scenario === "moyen")?.prix,
}, null, 1));
