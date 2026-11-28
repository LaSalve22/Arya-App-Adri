// Connecteur MADRIMMO pour Claude (serveur MCP). L'IA est celle de l'abonnement Claude de l'utilisateur :
// ce serveur ne fait qu'exposer les données publiques et le moteur de calcul.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { calculerBilan, prixLot } from "../bilan/calcul";
import { hypothesesDepuisPartiel, type HypothesesPartielles } from "../bilan/defaut";
import { prixMaxPourMarge, sensibilite } from "../bilan/nego";
import { calculerResidencePrincipale, optionsRPParDefaut, prixMaxRP, type OptionsRP } from "../bilan/residence";
import type { Hypotheses, ResultatBilan, ScenarioRevente } from "../bilan/types";
import { geocoder } from "../sources/geo";
import { parcelleAuPoint } from "../sources/cadastre";
import { zonePLU } from "../sources/urbanisme";
import { dpeProches, risques } from "../sources/risques";
import { comparables, statsCommune, ventesCommune, type TypeBien } from "../sources/dvf";
import { analyserAnnonce } from "../annonce/parse";
import { calculerFinancement, nouvelleSource, planFinancement } from "../bilan/financement";
import { calculerSortie, profilParDefaut, type FormeSociete } from "../bilan/profil";
import type { TypeSource } from "../bilan/types";
import { basculeImmeubleNeuf, regimeTVA } from "../bilan/calcul";
import { budgetVide, hypothesesParDefaut } from "../bilan/defaut";
import { FORFAITS, chiffrer, generalParDefaut, planParDefaut, projetParDefaut, proposerTravaux, reportDevis, type PlanTravaux } from "../travaux/plan";
import { demarches, LIBELLES_INTERLOCUTEURS } from "../travaux/demarches";
import { encoderPlan } from "../travaux/lien";

export const INSTRUCTIONS = `MADRIMMO : outils d'analyse pour marchand de biens en Occitanie (départements 09, 11, 12, 30, 31, 32, 34, 46, 48, 65, 66, 81, 82).
Réponds en français. Méthode de calcul = Excel « bilan prévisionnel » de l'utilisateur : frais de notaire 4,5 % par prudence (engagement de revente ; 3 % au minimum), aléas 6 % des travaux, IS 15 % jusqu'à 42 500 € puis 25 %. Régime de TVA automatique par défaut : exonération pour un logement ancien, TVA sur la marge pour un terrain à bâtir ou une division foncière, TVA sur le prix total si les travaux requalifient l'immeuble en neuf. Marge visée : 15 % du CA (bénéfice brut / CA).
Démarche type pour analyser un bien :
1. chercher_adresse (ou analyser_annonce si l'utilisateur colle une annonce) ;
2. fiche_bien (parcelle, PLU, risques, DPE voisins) ;
3. comparables_dvf pour les prix de revente : prix bas = quartile bas (p25) × surface, prix haut = quartile haut (p75) × surface ;
4. calculer_bilan, puis negociation pour le prix d'achat maximum et la sensibilité à la remise ;
5. comparer_residence_principale si l'utilisateur envisage d'acheter en nom propre pour y habiter (plus-value exonérée, pas de TVA ni d'IS) ;
6. plan_financement pour le montage (fonds propres, prêt, levée obligataire, associés) et le net pour les associés selon SAS ou SARL ;
7. lien_appli pour donner le lien vers l'appli web où l'utilisateur peut jouer avec le curseur de négociation.
Photos ou captures d'annonce : regarde chaque photo, identifie les pièces (séjour, cuisine, chambre, salle de bain, WC, entrée, extérieur), estime leur surface si possible et leur état (bon, à rafraîchir, à rénover, à refaire), et les éléments généraux visibles (tableau électrique ancien, convecteurs, simple vitrage, fissures, toiture, façade). Appelle ensuite proposer_travaux : il renvoie les forfaits (rafraîchissement 450 €/m², global 850 €/m², réhabilitation 1 200 €/m²), le devis détaillé par lots, la bascule de TVA, les démarches administratives et un lien qui pré-remplit l'onglet Travaux de l'appli. Dis ce que tu as vu sur les photos et ce que tu as supposé.
Signale toujours les hypothèses manquantes (prix, état, budget travaux, DPE) et ce qui a été supposé. Les données DVF couvrent 2021 à aujourd'hui, ventes de la commune uniquement.`;

const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 1) }] });
const erreur = (e: unknown) => ({ content: [{ type: "text" as const, text: `Erreur : ${(e as Error).message}` }], isError: true });

// ---------- Entrée simplifiée commune au bilan, à la négociation et au comparatif ----------
const lotSchema = z.object({
  libelle: z.string().default("Revente"),
  surface: z.number().optional().describe("m²"),
  prix_bas: z.number().nullable().optional().describe("Prix de revente bas en €, ex. p25 DVF × surface"),
  prix_haut: z.number().nullable().optional().describe("Prix de revente haut en €, ex. p75 DVF × surface"),
});
const entreeBilan = {
  prix_achat: z.number().describe("Prix d'achat négocié, en €"),
  surface: z.number().optional().describe("Surface Carrez vendue (m²)"),
  surface_terrain: z.number().optional().describe("Surface au sol ou du terrain (m²)"),
  travaux_ttc: z.number().optional().describe("Budget travaux total TTC (TVA 10 % rénovation). Ignoré si travaux_detail est fourni."),
  travaux_detail: z.record(z.string(), z.any()).optional().describe("Budget travaux détaillé au format de l'Excel (grosOeuvre, secondOeuvre, honorairesTechniques, raccordements, voirie, surelevation, extension), chaque poste {montantTTC, tauxTVA, pctRenove}"),
  lots: z.array(lotSchema).optional().describe("Lots revendus. Par défaut un seul lot."),
  scenario: z.enum(["down", "moyen", "top"]).optional().describe("Scénario de revente : bas, moyen (défaut), haut"),
  prix_revente: z.number().optional().describe("Prix de revente total retenu par l'utilisateur, en € : remplace les prix bas/haut (réparti au prorata des lots)"),
  regime_tva: z.enum(["auto", "marge", "exoneration", "total"]).optional().describe("auto par défaut : déduit du projet et des travaux"),
  nature_operation: z.enum(["logement_ancien", "terrain_a_batir", "division_fonciere"]).optional().describe("Pour le régime de TVA automatique (logement ancien par défaut)"),
  taux_notaire: z.number().optional().describe("0.045 par défaut (marchand de biens, prudent), 0.03 au minimum, 0.08 sans engagement de revente"),
  montant_emprunte: z.number().optional(),
  taux_emprunt: z.number().optional().describe("Taux annuel, ex. 0.045"),
  duree_mois: z.number().optional().describe("Durée de l'opération en mois (défaut 12)"),
  honoraires_vente: z.number().optional(),
  autres_frais: z.number().optional().describe("Honoraires de gestion, comptabilité, avocat… (TTC)"),
  apport: z.number().optional().describe("Fonds propres investis"),
  sources_financement: z
    .array(
      z.object({
        type: z.enum(["fonds_propres", "compte_courant", "pret", "obligataire", "associe_jv"]),
        montant: z.number(),
        taux_annuel: z.number().optional().describe("intérêts, coupon ou rémunération, ex. 0.05"),
        duree_mois: z.number().optional(),
        frais_dossier: z.number().optional(),
        frais_garantie: z.number().optional(),
        commission_engagement_pct: z.number().optional(),
        frais_plateforme_pct: z.number().optional().describe("crowdfunding, ex. 0.05"),
        part_benefice: z.number().optional().describe("associé en participation, ex. 0.3"),
      }),
    )
    .optional()
    .describe("Financement détaillé : remplace montant_emprunte/taux_emprunt"),
  hypotheses_avancees: z.record(z.string(), z.any()).optional().describe("Champs bruts du moteur (fusion profonde) pour tout réglage non prévu ci-dessus"),
};
type EntreeBilan = { [K in keyof typeof entreeBilan]?: z.infer<(typeof entreeBilan)[K]> };

export function hypothesesDepuisEntree(e: EntreeBilan): Hypotheses {
  const p: HypothesesPartielles = {
    prixAcquisition: e.prix_achat,
    tauxNotaire: e.taux_notaire ?? 0.045,
    regimeTVA: e.regime_tva ?? "auto",
    natureOperation: e.nature_operation,
    scenario: e.scenario,
    honorairesVente: e.honoraires_vente,
    honorairesGestion: e.autres_frais,
    apport: e.apport,
    financement: { montantEmprunte: e.montant_emprunte, tauxAnnuel: e.taux_emprunt, dureeMois: e.duree_mois },
    travaux: {
      surfaceCarrez: e.surface,
      surfaceTotale: e.surface_terrain ?? e.surface,
      ...(e.travaux_detail ?? (e.travaux_ttc ? { secondOeuvre: { cloisons: { montantTTC: e.travaux_ttc, tauxTVA: 0.1, pctRenove: 0 } } } : {})),
    },
    lots: e.lots?.map((l) => ({ libelle: l.libelle ?? "Revente", surface: l.surface, prixDown: l.prix_bas ?? null, prixTop: l.prix_haut ?? null, tva: 0 })),
  };
  // Retire les clés non renseignées pour garder les valeurs par défaut.
  const nettoyer = (o: unknown): unknown =>
    o && typeof o === "object" && !Array.isArray(o)
      ? Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, nettoyer(v)]))
      : o;
  const h = hypothesesDepuisPartiel(nettoyer(p) as HypothesesPartielles);
  if (e.prix_revente != null) {
    const base = h.lots.map((l) => prixLot(l, "moyen"));
    const somme = base.reduce((a, b) => a + b, 0);
    h.lots = (h.lots.length ? h.lots : [{ libelle: "Revente", prixDown: null, prixTop: null, tva: 0 }]).map((l, i, t) => ({
      ...l, prixSaisi: t.length === 1 ? e.prix_revente! : Math.round(somme ? (e.prix_revente! * base[i]) / somme : e.prix_revente! / t.length),
    }));
    h.scenario = "saisi";
  }
  if (e.sources_financement?.length) {
    h.financement.sources = e.sources_financement.map((x, i) => {
      const b = nouvelleSource(x.type as TypeSource, `s${i}`);
      return {
        ...b, montant: x.montant, tauxAnnuel: x.taux_annuel ?? b.tauxAnnuel, dureeMois: x.duree_mois ?? null,
        fraisDossier: x.frais_dossier ?? b.fraisDossier, fraisGarantie: x.frais_garantie ?? 0, commissionEngagementPct: x.commission_engagement_pct ?? 0,
        fraisPlateformePct: x.frais_plateforme_pct ?? b.fraisPlateformePct, partBenefice: x.part_benefice ?? b.partBenefice,
      };
    });
    if (!e.apport) h.apport = h.financement.sources.filter((x) => x.type !== "pret" && x.type !== "obligataire").reduce((a, x) => a + x.montant, 0);
  }
  return e.hypotheses_avancees ? hypothesesDepuisPartiel({ ...(h as HypothesesPartielles), ...(e.hypotheses_avancees as HypothesesPartielles) }) : h;
}

function resume(r: ResultatBilan) {
  const a = (v: number) => Math.round(v);
  return {
    chiffre_affaires: a(r.recettes.chiffreAffaires),
    prix_revient_foncier: a(r.foncier.total.ttc),
    frais_notaire: a(r.foncier.notaire.ttc),
    cout_technique_ttc: a(r.technique.total.ttc),
    honoraires_divers: a(r.honorairesDivers.ttc),
    frais_divers: { financiers: a(r.fraisDivers.financiers), gfa: a(r.fraisDivers.gfa), assurance_do: a(r.fraisDivers.assuranceDO) },
    honoraires_vente: a(r.honorairesVente.ttc),
    regime_tva: r.regimeApplique,
    bascule_immeuble_neuf: r.bascule.immeubleNeuf ? r.bascule.raison : null,
    tva_due: a(r.tvaDue),
    benefice_brut: a(r.beneficeBrut),
    marge_sur_ca: Math.round(r.margeSurCA * 1000) / 10 + " %",
    impot_societes: a(r.impot),
    benefice_net: a(r.beneficeNet),
    marge_sur_prix_revient: Math.round(r.margeSurPrixRevient * 1000) / 10 + " %",
    rendement_fonds_propres: r.rendementFondsPropres == null ? null : Math.round(r.rendementFondsPropres * 1000) / 10 + " %",
  };
}

export function creerServeur(origine: string): McpServer {
  const s = new McpServer({ name: "madrimmo", version: "0.1.0" }, { instructions: INSTRUCTIONS });

  s.registerTool(
    "chercher_adresse",
    { description: "Géocode une adresse ou une commune d'Occitanie. Renvoie des candidats avec coordonnées et code INSEE.", inputSchema: { adresse: z.string() } },
    async ({ adresse }) => {
      try { return json(await geocoder(adresse, 5)); } catch (e) { return erreur(e); }
    },
  );

  s.registerTool(
    "fiche_bien",
    {
      description: "Données publiques d'un bien à partir de ses coordonnées : parcelle cadastrale, zone du PLU et règlement, risques (dont argiles), DPE à moins de 150 m.",
      inputSchema: { lon: z.number(), lat: z.number() },
    },
    async ({ lon, lat }) => {
      try {
        const [p, u, r, d] = await Promise.allSettled([parcelleAuPoint(lon, lat), zonePLU(lon, lat), risques(lon, lat), dpeProches(lon, lat)]);
        const v = <T,>(x: PromiseSettledResult<T>) => (x.status === "fulfilled" ? x.value : { erreur: (x.reason as Error).message });
        const parcelle = v(p);
        return json({
          parcelle: parcelle && "idu" in parcelle ? { ...parcelle, geometrie: undefined } : parcelle,
          urbanisme: v(u),
          risques: v(r),
          dpe_voisins: d.status === "fulfilled" ? d.value.slice(0, 10) : v(d),
        });
      } catch (e) { return erreur(e); }
    },
  );

  s.registerTool(
    "comparables_dvf",
    {
      description: "Ventes DVF comparables autour d'un point (même type, surface ±30 %, rayon 500 m élargi si besoin) avec médiane et quartiles du prix au m².",
      inputSchema: {
        code_insee: z.string(), lon: z.number(), lat: z.number(),
        type: z.enum(["Maison", "Appartement", "Terrain", "Local", "Dependance"]).describe("Dependance = garage, box ou parking vendu seul : prix par unité"),
        surface: z.number().optional(),
      },
    },
    async ({ code_insee, lon, lat, type, surface }) => {
      try {
        const c = comparables(await ventesCommune(code_insee), { lon, lat, type: type as TypeBien, surface });
        return json({ rayon_m: c.rayon, stats_prix_m2: c.stats, ventes: c.ventes.slice(0, 15).map(({ lon: _x, lat: _y, ...v }) => v) });
      } catch (e) { return erreur(e); }
    },
  );

  s.registerTool(
    "prix_secteur",
    { description: "Prix au m² DVF d'une commune d'Occitanie sur 5 ans, par année, pour un type de bien.", inputSchema: { code_insee: z.string(), type: z.enum(["Maison", "Appartement", "Terrain", "Local"]) } },
    async ({ code_insee, type }) => {
      try {
        const st = statsCommune(await ventesCommune(code_insee), type as TypeBien);
        return json({ global: st.global, par_annee: st.parAnnee });
      } catch (e) { return erreur(e); }
    },
  );

  s.registerTool(
    "analyser_annonce",
    { description: "Extrait prix, surface, terrain, pièces, DPE et code postal du texte d'une annonce.", inputSchema: { texte: z.string() } },
    async ({ texte }) => json(analyserAnnonce(texte)),
  );

  s.registerTool(
    "calculer_bilan",
    { description: "Bilan prévisionnel marchand de biens (méthode de l'Excel de l'utilisateur) : CA, coûts, TVA, bénéfice brut, IS, bénéfice net, marges.", inputSchema: entreeBilan },
    async (e) => {
      try { return json(resume(calculerBilan(hypothesesDepuisEntree(e)))); } catch (x) { return erreur(x); }
    },
  );

  s.registerTool(
    "negociation",
    {
      description: "Prix d'achat maximum pour atteindre une marge cible (bénéfice brut / CA) selon les scénarios de revente bas, moyen et haut, et tableau de sensibilité aux remises sur le prix affiché. Inclut le prix maximum en résidence principale.",
      inputSchema: { ...entreeBilan, marge_cible: z.number().default(0.15).describe("ex. 0.15"), prix_affiche: z.number().optional() },
    },
    async (e) => {
      try {
        const h = hypothesesDepuisEntree(e);
        const sc: ScenarioRevente[] = ["down", "moyen", "top"];
        const rp = optionsRPParDefaut();
        return json({
          prix_max_marchand_de_biens: Object.fromEntries(sc.map((x) => [x, prixMaxPourMarge(h, e.marge_cible, x)])),
          prix_max_residence_principale: Object.fromEntries(sc.map((x) => [x, prixMaxRP(h, rp, e.marge_cible, x)])),
          sensibilite: e.prix_affiche
            ? sensibilite(h, e.prix_affiche).map((l) => ({
                remise: l[0].remise, prix: l[0].prix,
                marge: Object.fromEntries(l.map((c) => [c.scenario, Math.round(c.margeSurCA * 1000) / 10 + " %"])),
              }))
            : null,
        });
      } catch (x) { return erreur(x); }
    },
  );

  s.registerTool(
    "comparer_residence_principale",
    {
      description: "Compare le même bien en marchand de biens (société, TVA, IS) et en résidence principale achetée en nom propre puis revendue (pas de TVA, pas d'IS, plus-value exonérée, notaire de droit commun).",
      inputSchema: {
        ...entreeBilan,
        taux_notaire_rp: z.number().optional().describe("Défaut 0.075"),
        taux_assurance_pret: z.number().optional().describe("Défaut 0.003 par an"),
        charges_mensuelles: z.number().optional().describe("Taxe foncière + copro + assurance, par mois"),
        loyer_evite_mensuel: z.number().optional(),
        apport_rp: z.number().optional().describe("Apport personnel pour l'achat en nom propre"),
        duree_pret_ans: z.number().optional().describe("Prêt immobilier amortissable : 15, 20 (défaut) ou 25 ans"),
        taux_pret: z.number().optional().describe("Taux nominal du prêt immobilier, défaut 0.034"),
        duree_detention_mois: z.number().optional().describe("Durée de détention avant revente, défaut 24 mois"),
        ira_negociees: z.boolean().optional().describe("Indemnités de remboursement anticipé négociées à 0"),
        frais_revente_hors_agence: z.number().optional(),
      },
    },
    async (e) => {
      try {
        const h = hypothesesDepuisEntree(e);
        const d = optionsRPParDefaut();
        const rp: OptionsRP = {
          ...d,
          tauxNotaire: e.taux_notaire_rp ?? d.tauxNotaire, tauxAssurance: e.taux_assurance_pret ?? d.tauxAssurance,
          apport: e.apport_rp ?? d.apport, dureePretAns: e.duree_pret_ans ?? d.dureePretAns, tauxPret: e.taux_pret ?? d.tauxPret,
          dureeDetentionMois: e.duree_detention_mois ?? d.dureeDetentionMois, iraNegociees: e.ira_negociees ?? false,
          chargesMensuelles: e.charges_mensuelles ?? 0, loyerEvite: e.loyer_evite_mensuel ?? 0, fraisRevente: e.frais_revente_hors_agence ?? 0,
        };
        const q = calculerResidencePrincipale(h, rp);
        const a = (v: number) => Math.round(v);
        return json({
          marchand_de_biens: resume(calculerBilan(h)),
          residence_principale: {
            banque: {
              apport: a(rp.apport), montant_emprunte: a(q.banque.montantEmprunte), duree_pret_ans: rp.dureePretAns, mensualite_assurance_comprise: a(q.banque.mensualiteTotale),
              revenu_net_mensuel_minimum: a(q.banque.revenuMinimum), capital_restant_du_a_la_revente: a(q.banque.capitalRestantRevente), alertes: q.banque.alertes,
            },
            financement_detail: { interets: a(q.financement.interets), assurance: a(q.financement.assurance), garantie: a(q.financement.garantie), dossier: a(q.financement.dossier), ira: a(q.financement.ira) },
            duree_detention_mois: q.dureeMois,
            notaire: a(q.notaire), travaux: a(q.travaux), financement: a(q.financement.total), charges: a(q.charges), frais_vente: a(q.fraisVente),
            revente: a(q.revente), impot_plus_value: 0, gain_net: a(q.gainNet), gain_avec_loyer_economise: a(q.gainAvecLoyer),
            marge_sur_revente: Math.round(q.margeSurRevente * 1000) / 10 + " %",
            rendement_apport: q.rendementApport == null ? null : Math.round(q.rendementApport * 1000) / 10 + " %",
          },
          avertissement: "Exonération seulement si le bien est réellement la résidence principale au moment de la vente. Des reventes répétées et rapprochées peuvent être requalifiées en activité de marchand de biens.",
        });
      } catch (x) { return erreur(x); }
    },
  );

  s.registerTool(
    "plan_financement",
    {
      description: "Plan de financement d'une opération : besoins (foncier, technique, frais) contre ressources (fonds propres, comptes courants, prêt, levée obligataire, associé en participation), coût de chaque source, puis sortie vers les associés selon la forme (SAS ou SARL) avec PFU 31,4 % en 2026.",
      inputSchema: {
        ...entreeBilan,
        forme_societe: z.enum(["SAS", "SARL_majoritaire", "SARL_minoritaire"]).optional(),
        capital_social: z.number().optional(),
        distribuer: z.boolean().optional().describe("true = dividendes (défaut), false = bénéfice conservé en société"),
      },
    },
    async (e) => {
      try {
        const h = hypothesesDepuisEntree(e);
        const r = calculerBilan(h);
        const f = calculerFinancement(h.financement.sources ?? [], h.financement.dureeMois);
        const plan = planFinancement({ foncier: r.foncier.total.ttc, technique: r.technique.total.ttc, honorairesEtFrais: r.honorairesDivers.ttc + r.fraisDivers.total }, f);
        const profil = { ...profilParDefaut(), forme: (e.forme_societe ?? "SAS") as FormeSociete, capitalSocial: e.capital_social ?? 1000, modeSortie: e.distribuer === false ? ("conserver" as const) : ("dividendes" as const) };
        const cca = (h.financement.sources ?? []).filter((x) => x.type === "compte_courant").reduce((a, x) => a + x.montant, 0);
        const sortie = calculerSortie(profil, r.beneficeNetSociete, r.beneficeBrut, r.impot, cca);
        const a = (v: number) => Math.round(v);
        return json({
          bilan: resume(r),
          besoins: { ...plan.besoins, total: a(plan.besoins.total) },
          ressources: a(plan.ressources), ecart: a(plan.ecart), fonds_propres: a(f.fondsPropres), dette: a(f.dette),
          cout_sources: f.sources.map((c) => ({ libelle: c.libelle, montant: a(c.montant), duree_mois: c.dureeMois, cout: a(c.total), cout_annuel: Math.round(c.coutAnnualise * 1000) / 10 + " %" })),
          part_associes_participation: a(r.partageJV),
          sortie: { forme: profil.forme, pfu: a(sortie.pfu), cotisations_sociales: a(sortie.cotisationsSociales), net_associes: a(sortie.netAssocies), taux_global: Math.round(sortie.tauxGlobal * 1000) / 10 + " %" },
        });
      } catch (x) { return erreur(x); }
    },
  );

  s.registerTool(
    "proposer_travaux",
    {
      description:
        "Propose les travaux d'un bien à partir de l'état de ses pièces (lu sur les photos ou captures de l'annonce, ou décrit par l'utilisateur) : forfaits au m², devis détaillé par lots (grilles de prix de l'utilisateur), % rénové par poste et bascule TVA (requalification en immeuble neuf), démarches administratives (DP, permis, ABF, copropriété, réseaux…) et lien qui pré-remplit l'onglet Travaux de l'appli.",
      inputSchema: {
        type_bien: z.enum(["Maison", "Appartement", "Immeuble", "Terrain"]).default("Appartement"),
        surface: z.number().optional().describe("Surface habitable (m²)"),
        pieces: z
          .array(
            z.object({
              type: z.enum(["sejour", "cuisine", "chambre", "salle_de_bain", "wc", "entree", "exterieur", "autre"]),
              surface: z.number().optional().describe("m², si estimable"),
              etat: z.enum(["bon", "rafraichir", "renover", "refaire"]),
              remarques: z.string().optional().describe("Ce qui est visible sur la photo"),
            }),
          )
          .default([]),
        general: z
          .object({
            electricite: z.enum(["ok", "a_reprendre", "a_refaire"]).optional(),
            chauffage: z.enum(["ok", "electrique_ancien", "a_refaire", "absent"]).optional(),
            menuiseries: z.enum(["ok", "simple_vitrage"]).optional(),
            nb_fenetres: z.number().optional(),
            plomberie: z.enum(["ok", "a_refaire"]).optional(),
            structure: z.enum(["ok", "fissures", "a_reprendre"]).optional(),
            toiture: z.enum(["ok", "a_refaire", "sans_objet"]).optional(),
            facade: z.enum(["ok", "a_refaire"]).optional(),
            annee_construction: z.number().optional(),
          })
          .default({}),
        projet: z
          .object({
            division_lots: z.number().optional().describe("Nombre de logements après division (≥ 2)"),
            division_fonciere: z.boolean().optional(),
            voie_commune: z.boolean().optional(),
            changement_destination: z.boolean().optional(),
            surface_creee: z.number().optional().describe("m² de plancher créés (extension, surélévation, combles)"),
            modif_facade: z.boolean().optional(),
            places_parking: z.number().optional(),
            copropriete: z.boolean().optional(),
            acheve_moins_de_5_ans: z.boolean().optional(),
            compteurs_a_creer: z.boolean().optional(),
            assainissement: z.enum(["collectif", "fosse", "inconnu"]).optional(),
          })
          .default({}),
        gamme: z.enum(["bas", "moyen", "haut"]).default("moyen"),
        dpe: z.string().optional(),
        zone_plu: z.string().optional().describe("Libellé de zone PLU (fiche_bien), ex. UA"),
        secteur_patrimonial: z.boolean().optional().describe("SPR, PSMV ou abords de monument historique (fiche_bien)"),
        lien: z
          .object({ lon: z.number(), lat: z.number(), code_insee: z.string(), libelle: z.string().optional(), prix: z.number().optional() })
          .optional()
          .describe("Coordonnées du bien (chercher_adresse) pour renvoyer le lien vers l'appli"),
      },
    },
    async (e) => {
      try {
        const g = e.general;
        const pj = e.projet;
        const plan: PlanTravaux = {
          ...planParDefaut(),
          gamme: e.gamme,
          surface: e.surface ?? null,
          pieces: e.pieces.map((p, i) => ({ id: `c${i}`, type: p.type, surface: p.surface ?? null, etat: p.etat, remarques: p.remarques })),
          general: {
            ...generalParDefaut(),
            ...(g.electricite && { electricite: g.electricite }), ...(g.chauffage && { chauffage: g.chauffage }), ...(g.menuiseries && { menuiseries: g.menuiseries }),
            nbFenetres: g.nb_fenetres ?? null, ...(g.plomberie && { plomberie: g.plomberie }), ...(g.structure && { structure: g.structure }),
            toiture: g.toiture ?? (e.type_bien === "Appartement" ? "sans_objet" : "ok"), ...(g.facade && { facade: g.facade }), anneeConstruction: g.annee_construction ?? null,
          },
          projet: {
            ...projetParDefaut(),
            division: (pj.division_lots ?? 0) > 1, nbLots: Math.max(1, pj.division_lots ?? 1), divisionFonciere: !!pj.division_fonciere, voieCommune: !!pj.voie_commune,
            changementDestination: !!pj.changement_destination, surfaceCreee: pj.surface_creee ?? 0, modifFacade: !!pj.modif_facade, placesParking: pj.places_parking ?? 0,
            copropriete: pj.copropriete ?? e.type_bien === "Appartement", acheveMoinsDe5Ans: !!pj.acheve_moins_de_5_ans, compteursACreer: !!pj.compteurs_a_creer,
            assainissement: pj.assainissement ?? "inconnu",
          },
        };
        const surface = e.surface ?? (e.pieces.reduce((s2, p) => s2 + (p.surface ?? 0), 0) || null);
        const prop = proposerTravaux(plan, surface);
        const detail: PlanTravaux = { ...plan, mode: "detail", lignes: prop.lignes, pct: prop.pct as Record<string, number> };
        const base = { ...budgetVide(), surfaceTotale: surface ?? 0, surfaceCarrez: surface ?? 0 };
        const report = reportDevis(base, detail, prop.pct, surface ?? 0);
        const bascule = basculeImmeubleNeuf(report.travaux);
        const h = { ...hypothesesParDefaut(), regimeTVA: "auto" as const, natureOperation: pj.division_fonciere ? ("division_fonciere" as const) : ("logement_ancien" as const) };
        const tva = regimeTVA(h, bascule.immeubleNeuf, bascule.raison);
        const devis = chiffrer(detail.lignes, detail.gamme);
        const notes = demarches(detail, {
          typeBien: e.type_bien, zonePLU: e.zone_plu ?? null, secteurPatrimonial: !!e.secteur_patrimonial, dpe: e.dpe,
          grosOeuvre: Object.values(report.travaux.grosOeuvre).some((p) => p.montantTTC > 0), travaux: devis.length > 0, immeubleNeuf: bascule.immeubleNeuf, surface,
        });
        const encode = encoderPlan(detail);
        let lien: string | null = null;
        if (e.lien) {
          const q = new URLSearchParams({ lon: String(e.lien.lon), lat: String(e.lien.lat), insee: e.lien.code_insee, type: e.type_bien });
          if (e.lien.libelle) q.set("label", e.lien.libelle);
          if (surface) q.set("surface", String(surface));
          if (e.lien.prix) q.set("prix", String(e.lien.prix));
          q.set("travaux", encode);
          lien = `${origine}/bien?${q}#travaux`;
        }
        return json({
          surface_traitee: surface,
          forfaits: Object.fromEntries((Object.keys(FORFAITS) as (keyof typeof FORFAITS)[]).map((f) => [f, { prix_m2: FORFAITS[f].prixM2, total: surface ? FORFAITS[f].prixM2 * surface : null, description: FORFAITS[f].description }])),
          forfait_conseille: prop.forfaitConseille,
          devis_detaille: {
            gamme: detail.gamme,
            total_ttc: Math.round(devis.reduce((s2, l) => s2 + l.ttc, 0)),
            lignes: devis.map((l) => ({ lot: l.lot, quantite: l.quantite, unite: l.unite, prix_unitaire: l.prixUnitaire, total_ttc: Math.round(l.ttc), origine: l.origine })),
            note: "Le bilan ajoute 6 % d'aléas. Géomètre, architecte, avocat et huissier vont dans les coûts techniques, l'assurance dommages-ouvrage dans les frais divers.",
          },
          requalification: {
            immeuble_neuf: bascule.immeubleNeuf,
            raison: bascule.raison || null,
            criteres: bascule.criteres.map((c) => ({ element: c.libelle, renove: Math.round(c.valeur * 100) / 100, seuil: c.seuil, atteint: c.atteint })),
          },
          tva_revente: { regime: tva.regime, explication: tva.raison },
          demarches: notes.map((d) => ({ titre: d.titre, a_qui_s_adresser: LIBELLES_INTERLOCUTEURS[d.interlocuteur], delai: d.delai ?? null, detail: d.detail, clause_compromis: d.clause ?? null, avant_compromis: !!d.prioritaire })),
          plan_encode: encode,
          lien_appli: lien ?? "Passe les coordonnées du bien (paramètre lien) ou appelle lien_appli avec travaux = plan_encode pour pré-remplir l'onglet Travaux.",
        });
      } catch (err) {
        return erreur(err);
      }
    },
  );

  s.registerTool(
    "lien_appli",
    {
      description: "Lien vers l'appli web MADRIMMO avec le bien pré-chargé (carte, comparables, bilan, curseur de négociation, comparatif résidence principale).",
      inputSchema: {
        lon: z.number(), lat: z.number(), code_insee: z.string(), libelle: z.string().optional(),
        type: z.enum(["Maison", "Appartement", "Terrain", "Immeuble"]).optional(), surface: z.number().optional(), prix: z.number().optional(), terrain: z.number().optional(),
        travaux: z.string().optional().describe("Plan travaux encodé, tel que renvoyé par proposer_travaux (champ plan_encode)"),
      },
    },
    async (e) => {
      const q = new URLSearchParams({ lon: String(e.lon), lat: String(e.lat), insee: e.code_insee });
      if (e.libelle) q.set("label", e.libelle);
      if (e.type) q.set("type", e.type);
      if (e.surface) q.set("surface", String(e.surface));
      if (e.prix) q.set("prix", String(e.prix));
      if (e.terrain) q.set("terrain", String(e.terrain));
      if (e.travaux) q.set("travaux", e.travaux);
      return { content: [{ type: "text" as const, text: `${origine}/bien?${q}` }] };
    },
  );

  return s;
}
