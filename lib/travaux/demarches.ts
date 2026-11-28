// Démarches administratives selon le projet : quoi faire, à qui s'adresser, délai, clause à prévoir.
// Règles reprises des fiches « Travaux & DP », « Réseaux techniques », « Urbanisme & autorisations »
// et de la fiche « Requalification en production d'un immeuble neuf ».
import type { ElementsGeneraux, OptionsProjet, PlanTravaux } from "./plan";

export type Interlocuteur = "mairie" | "abf" | "geometre_notaire" | "syndic" | "reseaux" | "diagnostics" | "fiscal";

export const LIBELLES_INTERLOCUTEURS: Record<Interlocuteur, string> = {
  mairie: "Mairie · service urbanisme",
  abf: "Architecte des Bâtiments de France (UDAP)",
  geometre_notaire: "Géomètre-expert et notaire",
  syndic: "Copropriété · syndic",
  reseaux: "Réseaux : ENEDIS, eau, assainissement, fibre",
  diagnostics: "Diagnostics, études et assurances",
  fiscal: "Fiscalité · expert-comptable",
};

export interface Demarche {
  id: string;
  interlocuteur: Interlocuteur;
  titre: string;
  detail: string;
  delai?: string;
  /** Clause suspensive à prévoir au compromis. */
  clause?: string;
  /** Point bloquant à traiter avant de signer. */
  prioritaire?: boolean;
}

export interface ContexteDemarches {
  typeBien: string;
  /** Zone PLU (libellé), si connue. */
  zonePLU?: string | null;
  /** Secteur patrimonial (SPR, PSMV, abords de monument) détecté. */
  secteurPatrimonial: boolean;
  dpe?: string;
  /** Présence de gros œuvre dans les travaux. */
  grosOeuvre: boolean;
  /** Travaux prévus (forfait ou devis non vide). */
  travaux: boolean;
  immeubleNeuf: boolean;
  /** Surface habitable existante (m²). */
  surface: number | null;
}

const CLAUSE_URBA = "Condition suspensive d'obtention, sous 60 jours, de l'autorisation d'urbanisme (non-opposition à DP ou permis) purgée de tout recours, permettant la réalisation du projet.";

export function demarches(plan: Pick<PlanTravaux, "general" | "projet">, c: ContexteDemarches): Demarche[] {
  const p: OptionsProjet = plan.projet;
  const g: ElementsGeneraux = plan.general;
  const out: Demarche[] = [];
  const zoneU = c.zonePLU ? /^U/i.test(c.zonePLU) : false;
  const delaiABF = c.secteurPatrimonial ? " (+ 1 mois en secteur ABF)" : "";

  out.push({
    id: "plu",
    interlocuteur: "mairie",
    titre: "Lire le PLU et demander un certificat d'urbanisme",
    detail: `Zone${c.zonePLU ? ` ${c.zonePLU}` : ""} : vérifier stationnement exigé, hauteur, emprise, servitudes et droit de préemption urbain. Un certificat d'urbanisme d'information (CUa) fige les règles 18 mois. Consultable sur le Géoportail de l'urbanisme ou en mairie.`,
    delai: "1 mois (CUa)",
    prioritaire: p.division || p.changementDestination || p.surfaceCreee > 0 || p.divisionFonciere,
  });

  const aspect = p.modifFacade || g.menuiseries === "simple_vitrage" || g.facade === "a_refaire" || g.toiture === "a_refaire";
  if (aspect && p.surfaceCreee <= 0) {
    out.push({
      id: "dp-aspect",
      interlocuteur: "mairie",
      titre: "Déclaration préalable (DP) pour l'aspect extérieur",
      detail: "Changement de fenêtres, ravalement, réfection de toiture ou de façade : DP déposée en mairie (formulaire Cerfa 13703 pour une maison, 13404 sinon), à déposer dès le compromis signé.",
      delai: `1 mois${delaiABF}`,
      clause: CLAUSE_URBA,
    });
  }

  if (c.secteurPatrimonial) {
    out.push({
      id: "abf",
      interlocuteur: "abf",
      titre: "Avis de l'Architecte des Bâtiments de France",
      detail: "Secteur protégé : toute modification extérieure passe par l'ABF (unité départementale de l'architecture et du patrimoine). Matériaux et menuiseries souvent imposés (bois, teintes), ce qui renchérit les fenêtres et la façade. Prendre rendez-vous avec l'ABF avant de déposer pour caler le projet.",
      delai: "Instruction allongée d'1 mois, avis conforme",
      prioritaire: true,
    });
  }

  if (p.division && p.nbLots > 1) {
    out.push({
      id: "division",
      interlocuteur: "mairie",
      titre: `Division en ${p.nbLots} logements`,
      detail: "Déclaration préalable (ou permis de diviser si la commune l'a instauré). Vérifier au PLU la surface minimale des logements et le nombre de places de stationnement exigées par logement créé.",
      delai: `1 mois${delaiABF}`,
      clause: "Condition suspensive d'obtention de la déclaration préalable de division, purgée de tout recours, sous 60 jours.",
      prioritaire: true,
    });
    out.push({
      id: "copro-creation",
      interlocuteur: "geometre_notaire",
      titre: "Mise en copropriété",
      detail: "Le géomètre établit les plans, l'état descriptif de division et les tantièmes ; le notaire rédige le règlement de copropriété et le publie avant la vente des lots.",
      delai: "4 à 8 semaines",
    });
    out.push({
      id: "stationnement",
      interlocuteur: "mairie",
      titre: "Places de stationnement exigées par le PLU",
      detail: "Si le PLU impose une place par logement créé : demander à la mairie si la place peut être réalisée en voirie (participation financière) ou si une dérogation est possible pour impossibilité technique (art. R.151-44 du code de l'urbanisme).",
      prioritaire: true,
    });
  }

  if (p.placesParking > 0) {
    out.push({
      id: "parking",
      interlocuteur: "mairie",
      titre: `Création de ${p.placesParking} place${p.placesParking > 1 ? "s" : ""} de stationnement`,
      detail: "Aménagement d'aire de stationnement : DP en général. Si un accès nouveau est créé sur la voie publique (bateau de trottoir), demander une permission de voirie au service voirie de la commune.",
      delai: "1 mois",
    });
  }

  if (p.changementDestination) {
    out.push({
      id: "destination",
      interlocuteur: "mairie",
      titre: "Changement de destination (local ou bureau → logement)",
      detail: "DP si la façade et la structure ne changent pas, permis de construire sinon. Sans autorisation, le lot ne peut pas être vendu comme logement. Vérifier aussi le changement d'usage dans les grandes villes.",
      delai: "1 à 3 mois",
      clause: CLAUSE_URBA,
      prioritaire: true,
    });
  }

  if (p.surfaceCreee > 0) {
    const seuil = zoneU ? 40 : 20;
    const pc = p.surfaceCreee > seuil;
    const archi = pc && (c.surface ?? 0) + p.surfaceCreee > 150;
    out.push({
      id: "surface",
      interlocuteur: "mairie",
      titre: pc ? `Permis de construire (${p.surfaceCreee} m² créés)` : `Déclaration préalable (${p.surfaceCreee} m² créés)`,
      detail: `${pc ? `Au-delà de ${seuil} m² créés${zoneU ? " en zone U" : ""}, un permis de construire est nécessaire.` : `Jusqu'à ${seuil} m² créés${zoneU ? " en zone U" : ""}, une DP suffit.`}${archi ? " Architecte obligatoire : la surface totale dépasse 150 m²." : ""} Extension, surélévation ou aménagement de combles.`,
      delai: pc ? `2 à 3 mois${delaiABF}` : `1 mois${delaiABF}`,
      clause: CLAUSE_URBA,
      prioritaire: true,
    });
  }

  if (p.divisionFonciere) {
    out.push({
      id: "division-fonciere",
      interlocuteur: p.voieCommune ? "mairie" : "geometre_notaire",
      titre: p.voieCommune ? "Permis d'aménager (lotissement avec voie commune)" : "Division foncière : DP et bornage",
      detail: p.voieCommune
        ? "La création d'une voie ou d'espaces communs impose un permis d'aménager. Géomètre-expert pour le plan de division et le bornage."
        : "Détachement d'un terrain à bâtir sans voie commune : déclaration préalable de division, bornage et document d'arpentage par un géomètre-expert.",
      delai: p.voieCommune ? "3 mois" : "1 mois",
      clause: CLAUSE_URBA,
      prioritaire: true,
    });
  }

  const enCopro = p.copropriete || c.typeBien === "Appartement";
  if (enCopro) {
    out.push({
      id: "syndic",
      interlocuteur: "syndic",
      titre: "Accord de la copropriété",
      detail: "Demander au syndic le règlement de copropriété, les 3 derniers PV d'AG et le carnet d'entretien. Tout travail touchant les parties communes, la structure (mur porteur), l'aspect extérieur (fenêtres) ou les réseaux communs doit être voté en assemblée générale : demander l'inscription à l'ordre du jour.",
      delai: "AG ordinaire annuelle, ou AG extraordinaire à la charge du demandeur",
      prioritaire: g.structure === "a_reprendre" || p.division || aspect,
    });
  }

  if (p.compteursACreer || (p.division && p.nbLots > 1)) {
    out.push({
      id: "enedis",
      interlocuteur: "reseaux",
      titre: "Électricité : raccordement ENEDIS et CONSUEL",
      detail: "Demande sur raccordement.enedis.fr (plans, DP, copropriété créée). Devis ENEDIS en 1 à 3 semaines, environ 1 000 à 2 500 € par compteur. Attestation CONSUEL délivrée après les travaux de l'électricien, puis pose du compteur.",
      delai: "1 à 3 mois",
      prioritaire: true,
    });
    out.push({
      id: "eau",
      interlocuteur: "reseaux",
      titre: "Eau : compteurs individuels ou divisionnaires",
      detail: "Demande à la régie ou au délégataire (plan de masse, DP, compromis). Branchement environ 800 à 2 000 € par lot.",
      delai: "3 à 8 semaines",
    });
  }

  if (p.assainissement === "fosse") {
    out.push({
      id: "spanc",
      interlocuteur: "reseaux",
      titre: "Assainissement non collectif : contrôle SPANC",
      detail: "Demander le dernier contrôle du SPANC. Une installation non conforme doit être mise aux normes dans l'année suivant la vente : chiffrer la reprise avant l'offre.",
      prioritaire: true,
    });
  } else if (p.assainissement === "inconnu" && c.typeBien === "Maison") {
    out.push({ id: "egout", interlocuteur: "reseaux", titre: "Vérifier le raccordement au tout-à-l'égout", detail: "Demander à la mairie ou au service assainissement si la maison est raccordée. Une fosse septique non conforme peut coûter cher." });
  }

  out.push({
    id: "fibre",
    interlocuteur: "reseaux",
    titre: "Vérifier l'éligibilité à la fibre",
    detail: "Sur cartefibre.arcep.fr. Un bien fibré se revend et se loue mieux ; en copropriété, les parties communes doivent être raccordées.",
  });

  const avant1997 = g.anneeConstruction != null && g.anneeConstruction < 1997;
  if (c.travaux && (avant1997 || g.anneeConstruction == null)) {
    out.push({
      id: "amiante",
      interlocuteur: "diagnostics",
      titre: "Repérage amiante avant travaux",
      detail: `${avant1997 ? `Bâti de ${g.anneeConstruction}, antérieur à juillet 1997` : "Année de construction à vérifier"} : un repérage amiante avant travaux est obligatoire avant de toucher au bâti (démolition, cloisons, perçages). Il est distinct du diagnostic de vente.`,
    });
  }

  if (c.dpe && /^[FG]$/i.test(c.dpe)) {
    out.push({
      id: "dpe",
      interlocuteur: "diagnostics",
      titre: `DPE ${c.dpe.toUpperCase()} : DPE projeté avant d'acheter`,
      detail: "Faire simuler par un thermicien le DPE après travaux (300 à 600 €, 3 à 7 jours) : chauffage, eau chaude, fenêtres et isolation font gagner des classes. Ne jamais revendre une passoire sans plan clair.",
      prioritaire: true,
    });
  }

  if (c.grosOeuvre) {
    out.push({
      id: "do",
      interlocuteur: "diagnostics",
      titre: "Assurance dommages-ouvrage et bureau d'études",
      detail: "Travaux de structure (mur porteur, IPN, charpente) : bureau d'études structure pour le dimensionnement, entreprises avec décennale, et assurance dommages-ouvrage souscrite avant l'ouverture du chantier (2 à 4 % du montant des travaux).",
    });
  }

  if (c.immeubleNeuf) {
    out.push({
      id: "tva",
      interlocuteur: "fiscal",
      titre: "Requalification en immeuble neuf",
      detail: "Les travaux font de l'immeuble un immeuble neuf au sens de la TVA : la revente supporte la TVA sur le prix total, et les taux réduits de TVA sur travaux (5,5 % et 10 %) ne s'appliquent plus. Valider le découpage des travaux avec l'expert-comptable : il est parfois possible de rester sous les seuils.",
      prioritaire: true,
    });
  }

  return out;
}

/** Démarches d'un bien analysé : contexte tiré de l'analyse (type, zone PLU, DPE, travaux du bilan). */
export function demarchesDuBien(
  etat: { caracteristiques: { type: string; dpe: string; surface: number | null }; travauxPlan: PlanTravaux; hypotheses: { travaux: { grosOeuvre: Record<string, { montantTTC: number }>; surfaceCarrez: number } } },
  r: { technique: { total: { ttc: number } }; bascule: { immeubleNeuf: boolean } },
  zone: { libelle: string; libelleLong?: string | null } | null,
): Demarche[] {
  const plan = etat.travauxPlan;
  return demarches(plan, {
    typeBien: etat.caracteristiques.type,
    zonePLU: zone?.libelle ?? null,
    secteurPatrimonial: !!zone && /PSMV|SPR|patrimon|AVAP|ZPPAUP/i.test(`${zone.libelle} ${zone.libelleLong ?? ""}`),
    dpe: etat.caracteristiques.dpe,
    grosOeuvre: Object.values(etat.hypotheses.travaux.grosOeuvre).some((p) => p.montantTTC > 0),
    travaux: r.technique.total.ttc > 0 || plan.pieces.some((p) => p.etat !== "bon"),
    immeubleNeuf: r.bascule.immeubleNeuf,
    surface: etat.caracteristiques.surface ?? (etat.hypotheses.travaux.surfaceCarrez || null),
  });
}
