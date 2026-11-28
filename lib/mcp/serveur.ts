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

export const INSTRUCTIONS = `MADRIMMO : outils d'analyse pour marchand de biens en Occitanie (départements 09, 11, 12, 30, 31, 32, 34, 46, 48, 65, 66, 81, 82).
Réponds en français. Méthode de calcul = Excel « bilan prévisionnel » de l'utilisateur : frais de notaire 3 % (engagement de revente), aléas 6 % des travaux, TVA sur marge par défaut, IS 15 % jusqu'à 42 500 € puis 25 %. Marge visée : 15 % du CA (bénéfice brut / CA).
Démarche type pour analyser un bien :
1. chercher_adresse (ou analyser_annonce si l'utilisateur colle une annonce) ;
2. fiche_bien (parcelle, PLU, risques, DPE voisins) ;
3. comparables_dvf pour les prix de revente : prix bas = quartile bas (p25) × surface, prix haut = quartile haut (p75) × surface ;
4. calculer_bilan, puis negociation pour le prix d'achat maximum et la sensibilité à la remise ;
5. comparer_residence_principale si l'utilisateur envisage d'acheter en nom propre pour y habiter (plus-value exonérée, pas de TVA ni d'IS) ;
6. plan_financement pour le montage (fonds propres, prêt, levée obligataire, associés) et le net pour les associés selon SAS ou SARL ;
7. lien_appli pour donner le lien vers l'appli web où l'utilisateur peut jouer avec le curseur de négociation.
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
  regime_tva: z.enum(["marge", "exoneration", "total"]).optional(),
  taux_notaire: z.number().optional().describe("0.03 avec engagement de revente (défaut), 0.08 sinon"),
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
    tauxNotaire: e.taux_notaire,
    regimeTVA: e.regime_tva,
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
        type: z.enum(["Maison", "Appartement", "Terrain", "Local"]),
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
        frais_garantie: z.number().optional(),
        indemnites_remboursement: z.number().optional(),
        frais_revente_hors_agence: z.number().optional(),
      },
    },
    async (e) => {
      try {
        const h = hypothesesDepuisEntree(e);
        const d = optionsRPParDefaut();
        const rp: OptionsRP = {
          tauxNotaire: e.taux_notaire_rp ?? d.tauxNotaire, tauxAssurance: e.taux_assurance_pret ?? d.tauxAssurance,
          fraisGarantie: e.frais_garantie ?? 0, ira: e.indemnites_remboursement ?? 0, chargesMensuelles: e.charges_mensuelles ?? 0,
          loyerEvite: e.loyer_evite_mensuel ?? 0, fraisRevente: e.frais_revente_hors_agence ?? 0,
        };
        const q = calculerResidencePrincipale(h, rp);
        const a = (v: number) => Math.round(v);
        return json({
          marchand_de_biens: resume(calculerBilan(h)),
          residence_principale: {
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
    "lien_appli",
    {
      description: "Lien vers l'appli web MADRIMMO avec le bien pré-chargé (carte, comparables, bilan, curseur de négociation, comparatif résidence principale).",
      inputSchema: {
        lon: z.number(), lat: z.number(), code_insee: z.string(), libelle: z.string().optional(),
        type: z.enum(["Maison", "Appartement", "Terrain", "Immeuble"]).optional(), surface: z.number().optional(), prix: z.number().optional(), terrain: z.number().optional(),
      },
    },
    async (e) => {
      const q = new URLSearchParams({ lon: String(e.lon), lat: String(e.lat), insee: e.code_insee });
      if (e.libelle) q.set("label", e.libelle);
      if (e.type) q.set("type", e.type);
      if (e.surface) q.set("surface", String(e.surface));
      if (e.prix) q.set("prix", String(e.prix));
      if (e.terrain) q.set("terrain", String(e.terrain));
      return { content: [{ type: "text" as const, text: `${origine}/bien?${q}` }] };
    },
  );

  return s;
}
