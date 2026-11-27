# Assistant Marchand de Biens — Cahier des charges (v0)

> Référence de départ : visuel de « L'Incubateur – Marchand de biens » (`docs/reference-incubateur-mdb.jpg`).
> Objectif : construire **notre propre** assistant IA pour marchand de biens, couvrant tout le cycle d'une opération,
> avec notre identité visuelle (on reprend le périmètre fonctionnel, pas la marque ni le design).

---

## 1. Concept

Une app mobile (iOS/Android, + web) centrée sur un **assistant conversationnel** qui :
- reçoit des documents (compromis, règlement de PLU, diagnostics, devis…),
- les **croise automatiquement** avec les données publiques (cadastre, urbanisme, DVF, risques…),
- et accompagne le marchand de biens de la **prospection** jusqu'à la **revente**, projet par projet.

Navigation principale (barre du bas) : **Explorer** · **Assistant** · **Projets**

---

## 2. Les 4 piliers et 24 fonctionnalités

### 🔎 A. PROSPECTER
| # | Fonction | Idée de mise en œuvre |
|---|---|---|
| A1 | Recherche nationale | Recherche de biens / parcelles sur toute la France (adresse, commune, critères) |
| A2 | Prospection multibiens | Repérer immeubles entiers, lots multiples, biens à diviser |
| A3 | Ciblage de SCI & sociétés | Identifier les propriétaires personnes morales (fichiers des locaux des PM, API Sirene / RNE) |
| A4 | Veille de marché | Alertes sur nouvelles annonces / ventes DVF dans les secteurs suivis |
| A5 | Analyse de secteur | Prix au m², tension locative, démographie (INSEE), évolution des prix |
| A6 | Relances automatisées | Séquences de relance propriétaires / agents / notaires (mail, courrier, SMS) |

### 🏠 B. ÉTUDIER LE BIEN
| # | Fonction | Idée de mise en œuvre |
|---|---|---|
| B1 | DVF & comparables | Ventes réelles autour du bien (DVF / data.gouv.fr), filtrage par type et surface |
| B2 | Cadastre & parcelles | Plan cadastral, identification de parcelle (ex. section AC n°0412), surface (API Carto / cadastre.gouv) |
| B3 | Étude de copropriétés & divisions | Registre national des copropriétés, faisabilité de division en lots |
| B4 | PLU & urbanisme | Zonage et règlement (Géoportail de l'Urbanisme), lecture du PDF du PLU par l'IA |
| B5 | Droit immobilier, démarches & formulaires | Réponses juridiques, génération de formulaires CERFA |
| B6 | Risques & servitudes | Géorisques (inondation, argiles, radon…), servitudes d'utilité publique |

### 📊 C. CHIFFRER L'OPÉRATION
| # | Fonction | Idée de mise en œuvre |
|---|---|---|
| C1 | Analyse des opérations | Bilan promoteur / MdB : prix d'achat, frais, travaux, prix de revente |
| C2 | Optimisation fiscale | TVA sur marge vs TVA sur total, frais de notaire réduits (engagement de revente), IS |
| C3 | Optimisation de sociétés & droits immobiliers | Choix de structure (SAS, SARL, SCI à l'IS…), démembrement, montage |
| C4 | DPE & rénovation | Données DPE (ADEME), impact des travaux sur l'étiquette, interdictions de location |
| C5 | Devis travaux | Analyse / comparaison de devis, estimation de coût au m² |
| C6 | Marge & trésorerie | Marge brute/nette, TRI, plan de trésorerie, besoin de financement |

### ✅ D. RÉALISER & SUIVRE
| # | Fonction | Idée de mise en œuvre |
|---|---|---|
| D1 | Permis de construire | Préparation DP / PC, pièces à fournir, suivi des délais |
| D2 | Démarches Enedis | Raccordements, division de compteurs |
| D3 | Dossier de financement | Génération automatique du dossier bancaire (bilan, planning, CV de l'opération) |
| D4 | Vérification & suivi des professionnels | Contrôle SIRET, assurances décennales, suivi des artisans |
| D5 | Analyse de documents | Extraction et résumé : compromis, diagnostics, actes, devis, PV d'AG |
| D6 | Mémoire de vos projets | L'IA garde le contexte de chaque projet (docs, échanges, décisions) |

---

## 3. Écran clé : l'Assistant (maquette de référence)

Flux illustré sur le visuel :
1. En-tête « Assistant MdB », fil **« Discussion · Projet de division »** (conversation rattachée à un projet).
2. L'utilisateur écrit : *« Étudie ces documents pour mon projet de division. »*
3. Pièces jointes affichées en carte : **Dossier de division** (2 pièces), **Compromis de vente.pdf** (document contractuel), **Règlement du PLU.pdf** (règles d'urbanisme).
4. L'IA répond : *« Je croise vos pièces avec le cadastre et les règles d'urbanisme. »*
5. Carte **Plan cadastral** intégrée : parcelle identifiée (ex. AC 0412) surlignée, bouton « Ouvrir ».
6. Champ de saisie : *« Poser une question sur ce dossier… »*

Principes UX : thème sombre, accents verts, cartes riches (documents, cartes, tableaux chiffrés) directement dans le chat.

---

## 4. Sources de données publiques envisagées (France)

- **DVF** (Demandes de valeurs foncières) — data.gouv.fr
- **Cadastre** — API Carto IGN / cadastre.data.gouv.fr
- **Géoportail de l'Urbanisme** — PLU, zonages, SUP
- **Géorisques** — risques naturels et technologiques
- **ADEME** — base DPE
- **Sirene / RNE / fichiers des locaux des personnes morales** — ciblage SCI & sociétés
- **Registre national des copropriétés** (ANAH)
- **INSEE** — données socio-démographiques

---

## 5. Prochaines étapes (à valider ensemble)

- [ ] Choisir le nom et l'identité visuelle de notre app
- [ ] Définir le MVP (proposition : Assistant + Analyse de documents + Cadastre + DVF + Bilan d'opération)
- [ ] Choisir la stack technique (mobile / web / back-end / IA)
- [ ] Maquetter les 3 onglets : Explorer, Assistant, Projets
