# MADRIMMO · Plan d'évolution vers un outil de gestion de projets

Objectif : passer d'un outil d'**analyse** à un outil de **pilotage des opérations**, de la prise de contact jusqu'à la revente, sur le modèle de MaBrik Immo (simulateur, offres, dossier bancaire, trésorerie, travaux, documents, vente des lots).

## Règles du projet
- **Rien n'est déployé sur madrimmo.vercel.app** pendant le développement. Les évolutions vivent sur une branche à part ; Vercel lui donne une **adresse de test** (aperçu), ouverte sur téléphone et Mac.
- **La mise en production n'intervient qu'après validation d'Adrien**, phase par phase.
- **Les projets existants sont repris automatiquement**, avec un export JSON de sauvegarde avant migration.
- **Données partagées en ligne** dans Supabase (base Postgres + connexion + stockage de fichiers, serveurs en Europe, offre gratuite). Un compte pour Adrien, un pour Maëva, et les mêmes projets sur tous les appareils.

## Nouvelle organisation de l'appli

| Menu | Contenu |
|---|---|
| **Tableau de bord** | Opérations en cours, marge prévisionnelle totale, capital engagé, échéances de la semaine, objectifs (2 opérations, 50 000 € de marge à 3 ans) |
| **Analyse** | Tout l'outil actuel : recherche, 14 étapes, travaux, BP, financement, PDF, import d'annonces |
| **Projets MDB** | Opérations en société : vue en colonnes par étape (glisser-déposer) et vue liste |
| **Projets RP** | Achats en résidence principale : même principe, étapes adaptées |
| **Importer** | Favori « Envoyer à MADRIMMO », partage depuis les applis |

Une analyse se transforme en projet en un clic (« Créer le projet MDB » ou « Créer le projet RP »). Le projet garde une copie figée du BP d'origine, pour comparer prévu et réel.

## Étapes du pipeline (proposition)

**Projets MDB**

| Phase | Étapes |
|---|---|
| Prospection | 1. Repéré · 2. Contact pris · 3. Visité · 4. Analysé |
| Acquisition | 5. **Sous offre** (offre envoyée) · 6. **Offre acceptée** · 7. **Pré-commercialisation** (lots proposés aux acquéreurs avant l'achat) · 8. Compromis signé (conditions suspensives en cours) · 9. Acquis (acte authentique) |
| Opération | 10. **Travaux en cours** · 11. En commercialisation |
| Sortie | 12. Sous compromis de vente · 13. **Vendu** · 14. Clôturé (bilan réel établi) |
| Archives | Offre refusée · Abandonné (avec motif, pour apprendre de chaque dossier) |

**Projets RP** : Repéré · Visité · Sous offre · Offre acceptée · Compromis · Acquis · Travaux · **Habité** · En vente · Vendu.
- La date d'entrée dans les lieux est notée, avec un rappel que la plus-value n'est exonérée que si le bien est bien la résidence principale au moment de la vente.

**Dates et alertes automatiques à chaque étape**

| Événement | Ce que l'appli crée |
|---|---|
| Compromis signé | Fin du délai de rétractation (10 jours) ; date limite d'obtention du prêt ; dates limites des conditions suspensives (DP, permis, division) ; date butoir de l'acte |
| Acquis, MDB | Date limite de l'engagement de revente sous 5 ans (sinon droits de mutation de droit commun) |
| Ligne de crédit marchand | Échéance des 24 mois |

## La pré-commercialisation, au cœur de l'acquisition
Revendre les lots, ou au moins les réserver, **avant de signer l'acte d'achat** sécurise toute l'opération : la marge est confirmée par de vrais acheteurs, la banque finance plus facilement, et l'achat ne se fait que si la revente tient.
- **Quand** : dès l'offre acceptée, pendant le délai du compromis. Elle peut aussi déclencher le passage au compromis (« précom validée → compromis signé → reventes en pré-acte »).
- **Par lot** :
  - prix de pré-commercialisation et prix plancher ;
  - acquéreurs intéressés (contact, budget, financement, niveau d'intérêt) ;
  - réservations, offres écrites et promesses signées ;
  - date de signature prévue de la revente.
- **Indicateurs** : taux de pré-commercialisation (lots réservés sur le total, en nombre et en chiffre d'affaires), chiffre d'affaires sécurisé, marge sécurisée face à la marge prévue. Une alerte s'affiche si la cible n'est pas atteinte à l'approche de la date limite des conditions suspensives.
- **Outils de vente** :
  - fiche de présentation par lot en PDF, aux couleurs de MADRIMMO (plans, photos ou visuels 3D, prix, avant et après travaux) ;
  - dossier « packaging investisseur » ;
  - lien de partage par lot ;
  - export pour les agents partenaires.
- **Dossier bancaire** : le PDF ajoute une page « Pré-commercialisation » (lots réservés, offres écrites, chiffre d'affaires sécurisé). C'est un argument fort pour obtenir la ligne de crédit.
- **Projets RP** : sans objet.

## Contenu de la fiche projet
1. **Synthèse** : étape, prochaines échéances, marge prévue contre marge réelle, photos.
2. **Offres** : historique (offre, contre-offre, accord), offre écrite en PDF aux couleurs de la charte.
3. **Pré-commercialisation** : lots, acquéreurs intéressés, réservations et promesses, taux de lots réservés, chiffre d'affaires sécurisé, fiches de présentation des lots.
4. **Tâches et échéances** : liste à cocher, dates, responsable (Adrien ou Maëva), rappels.
5. **Contacts** : vendeur, agent, notaire, banque, géomètre, architecte, artisans (téléphone, e-mail, appel en un clic).
6. **Finances réelles** : dépenses et factures saisies (photo du justificatif) ventilées sur les postes du BP, financement réel (déblocages, intérêts), trésorerie mois par mois, bilan de clôture réel contre prévisionnel.
7. **Travaux** : planning par lot et par artisan, avancement en %, devis acceptés contre facturé, réserves.
8. **Documents** : compromis, acte, devis, factures, diagnostics, autorisations d'urbanisme, plans. Stockés en ligne et classés par catégorie.
9. **Vente** : lots, prix affichés, offres reçues, compromis et actes de revente, prix réels pour le bilan.
10. **Journal** : historique automatique des changements d'étape et des notes.

## Phases de réalisation

| Phase | Contenu | Test avant validation |
|---|---|---|
| **0 · Fondations** | Branche et adresse de test ; menus Tableau de bord / Analyse / Projets MDB / Projets RP ; Supabase (connexion Adrien et Maëva, base, sauvegardes) ; reprise des projets actuels | Se connecter sur iPhone et Mac, retrouver les mêmes projets |
| **1 · Pipeline, offres et pré-commercialisation** | Projets MDB et RP en colonnes et en liste, étapes ci-dessus, passage d'une analyse à un projet, fiches Synthèse, Offres et **Pré-commercialisation** (lots, acquéreurs, réservations, taux de pré-commercialisation, fiches de présentation des lots), page de pré-commercialisation dans le dossier bancaire, archives avec motif | Créer un projet depuis une analyse, pré-commercialiser 2 lots sur 3 et voir le chiffre d'affaires sécurisé, puis le faire avancer jusqu'à « Vendu » |
| **2 · Tâches, échéances, contacts** | Tâches et rappels, dates automatiques (compromis, 5 ans, 24 mois), contacts, journal ; échéances sur le tableau de bord | Un compromis saisi crée bien ses échéances |
| **3 · Finances réelles** | Dépenses et factures, financement réel, trésorerie, bilan réel contre prévisionnel, PDF de clôture | Saisir les dépenses d'une opération et retrouver le bilan réel |
| **4 · Travaux, documents, vente** | Planning travaux et artisans, documents en ligne (photos, PDF), vente des lots, prix réels | Suivre un chantier et la vente de deux lots |
| **5 · Tableau de bord et finitions** | Indicateurs (dont chiffre d'affaires pré-commercialisé de toutes les opérations), objectifs, export, mise à jour du guide d'utilisation et de la vidéo | Revue complète, puis mise en production |

**Hors périmètre pour l'instant** : ces deux fonctions de MaBrik passent par des services payants et seront étudiées plus tard.
- **Synchronisation bancaire** : elle demande un agrégateur agréé.
- **Multidiffusion sur les portails d'annonces**.

## Ce qu'il faudra de la part d'Adrien
- Créer un compte gratuit sur supabase.com (région Europe) et me transmettre l'accès au moment de la phase 0 : la procédure sera expliquée pas à pas, et la clé ne sera jamais écrite dans le dépôt public.
- Valider les étapes du pipeline ci-dessus (noms, ordre, étapes à ajouter).
- Tester chaque phase sur l'adresse de test, puis donner le feu vert pour la mise en production.
