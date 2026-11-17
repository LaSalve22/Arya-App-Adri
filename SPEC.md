# Radar ARYA — Cahier des charges technique V1

Nov 17, 2026 · @Adrien Salvo

## Objectif et périmètre de la V1

La V1 fait respecter le plan Douglas M5 et coupe ARYA en cas de danger. Elle ne passe jamais d'ordre de trading elle-même : ARYA reste le seul à trader.

| Dans la V1 | Hors V1 (plus tard) |
| --- | --- |
| Scalping Douglas M5 sur XAUUSD, DAX (GER40), US100 | Swing D1/H4, weekly / hold Trade Republic |
| Surveillance de tous les terminaux MT4 du VPS | Changement automatique des paramètres d'ARYA |
| Propositions d'activation validées par Adrien | Activation 100 % automatique |
| Coupure automatique en cas de danger | Lecture automatique des zones ARYA Zone Ultimate |
| Check-in, anti-tilt, rappel du plan, journal émotionnel | Statistiques avancées, backtests |
| Appli web mobile installable (PWA) | Appli native iOS / Android |

Règles du plan appliquées : R1 à R12 du document « radar-cahier-des-besoins » du projet (créneaux, vendredi, actifs, MM100 M5, zones H4, risque 0,5 %, +0,5 % / -0,5 % par jour, anti-tilt, news, fin de créneau, journée UBIC).

## Architecture d'ensemble

&#91;embedded content: architecture V1 · appli, backend, terminaux MT4\]

L'appli ne parle qu'au backend, et le backend ne parle aux terminaux que par fichiers : aucune pièce du radar ne peut ouvrir une position. Les deux comptes sont des exemples, il y a un EA gardien par terminal MT4.

## Module 1 — EA gardien MT4

Un petit EA en MQL4, installé sur un graphique de chaque terminal MT4, à côté d'ARYA. Il ne trade pas : il exporte l'état du compte et exécute 3 commandes de sécurité.

**Échange avec le backend** : par fichiers JSON dans le dossier commun de MT4 (`FILE_COMMON`), un sous-dossier par numéro de compte. C'est plus fiable que `WebRequest` en local et cela marche avec plusieurs terminaux.

**Export toutes les 5 secondes (`state.json`)**

- Compte : login, broker, balance, equity, P&L du jour (latent inclus, depuis minuit heure de Paris), état du bouton AutoTrading
- Positions ouvertes : symbole, sens, lots, prix d'entrée, SL, TP, profit, magic number
- Pour XAUUSD, GER40, US100 : spread, valeur du tick, 300 dernières bougies M5 et 200 bougies H4
- Battement de cœur (heure d'écriture) pour détecter un terminal figé

**Commandes lues (`commands.json`)**, chacune avec un identifiant et un accusé de réception (`ack.json`) :

| Commande | Effet | Qui la déclenche |
| --- | --- | --- |
| `ENABLE` | Rallume l'AutoTrading du terminal | Adrien, après validation dans l'appli |
| `DISABLE` | Éteint l'AutoTrading (positions conservées) | Adrien ou le garde-fou |
| `CLOSE_ALL` | Ferme toutes les positions, PUIS éteint l'AutoTrading | Le garde-fou en cas de danger, ou Adrien |

**Points techniques à tester en démo**

- Basculer le bouton AutoTrading demande d'autoriser les DLL pour l'EA gardien (envoi de la commande du bouton à la fenêtre du terminal).
- AutoTrading éteint = ARYA ne gère plus ses positions (trailing, clôture partielle). Les SL/TP déjà posés chez le broker restent actifs.
- Pour la fin de créneau (R9/R11), mieux vaut utiliser le `Clock Filter` d'ARYA : il bloque les nouvelles entrées tout en laissant ARYA gérer les positions ouvertes.
- Doubler les limites du jour dans ARYA lui-même : `Risk Per Trade` 0,5, `Max Loss Daily` 0,5 %, `Max Profit Daily` 0,5 %, `Calculation Equity` = True.

## Module 2 — Backend et moteur de règles

Un service Python qui tourne en permanence sur le VPS Windows, lit l'état des terminaux, applique le plan et écrit les commandes.

**Stack** : Python 3.12, FastAPI, SQLite, APScheduler. Lancé comme service Windows (NSSM) pour redémarrer seul après un reboot du VPS.

**Composants**

1. **Collecteur** : lit les `state.json` de chaque terminal toutes les 5 s et alerte si un battement de cœur a plus de 60 s.
2. **Plan en configuration** : toutes les règles dans un fichier `plan.yaml` lisible, jamais en dur dans le code.
3. **Moteur de règles** : une fonction par règle R1–R12, qui répond « autorisé / bloqué + raison ». Chaque règle a ses tests unitaires.
4. **Détecteur de setup Douglas** : sur chaque actif autorisé, vérifie le sens (tendance M5 + prix vs MM100 M5), le spread, la proximité d'une zone H4 si connue, et donne un score sur 100.
5. **Garde-fou** : toutes les 5 s, contrôle les dangers et envoie `CLOSE_ALL` sans attendre si besoin (voir tableau).
6. **Contrôle du risque effectif** : à chaque nouvelle position, calcule le risque réel (distance au SL × lots × valeur du tick / equity) et alerte s'il dépasse 0,55 % (0,28 % le vendredi).
7. **Calendrier économique** : charge chaque matin les annonces majeures (NFP, CPI, FOMC…) et verrouille les jours concernés (R10).
8. **Notifications** : Web Push vers le téléphone.

| Danger détecté par le garde-fou | Action |
| --- | --- |
| P&L du jour ≤ -0,4 % | Alerte « proche de la limite » |
| P&L du jour ≤ -0,5 % (si ARYA n'a pas déjà coupé) | `CLOSE_ALL` + verrou jusqu'au lendemain |
| Annonce majeure dans moins de 30 min et position ouverte | `CLOSE_ALL` + alerte |
| Risque effectif d'une position > 0,55 % | Alerte immédiate, `CLOSE_ALL` si non traitée en 2 min |
| Exposition simultanée sur plus d'un actif (or, DAX, US100 corrélés) | Alerte |
| Terminal figé (pas de battement de cœur depuis 60 s) | Alerte |

**Exemple de `plan.yaml`**

```yaml
timezone: Europe/Paris
symbols: [XAUUSD, GER40, US100]
sessions:
  mon-thu: ["09:15-12:15", "15:45-18:15"]
  fri: ["09:15-12:15"]
risk_per_trade_pct: 0.5
friday_risk_factor: 0.5
daily_target_pct: 0.5
daily_max_loss_pct: 0.5
filter:
  ma_period: 100
  ma_timeframe: M5
anti_tilt:
  consecutive_losses: 2
  impulsive_lock_minutes: 30
news_lock: full_day
news_events: [NFP, CPI, FOMC]
session_end: no_new_entries
```

## Module 3 — Appli web mobile

Une PWA servie par le backend, installée sur l'écran d'accueil du téléphone, avec notifications. Pages simples, gros boutons, lisible en 5 secondes.

**Stack** : pages FastAPI + Jinja + HTMX (pas de framework lourd), manifest PWA, Web Push (iPhone : iOS 16.4 ou plus, appli ajoutée à l'écran d'accueil).

| Page | Contenu | Actions |
| --- | --- | --- |
| Accueil | État de chaque compte (equity, P&L du jour vs +0,5 % / -0,5 %), AutoTrading ON/OFF, verrous actifs et leur raison, prochain créneau, annonces du jour | `DISABLE` / `CLOSE_ALL` d'urgence |
| Check-in | Questionnaire avant session (module 4) | Déverrouille la session si le score suffit |
| Propositions | Fiche du setup : actif, sens, score, règles du plan concernées, spread | Case obligatoire « prix sur zone H4 », puis Activer (`ENABLE`) avec confirmation |
| Journal | Trades du jour et de la semaine, ressenti, respect du plan | Remplir le débrief post-trade |
| Statistiques | Résultats par actif, créneau, score de check-in, respect du plan | — |
| Réglages | Lecture de `plan.yaml`, terminaux connus | Modifier le plan (hors créneau uniquement) |

Règle d'interface : le bouton Activer n'existe que si toutes les règles sont vertes. Sinon l'appli affiche la règle bloquante en clair (ex. « R10 : CPI aujourd'hui »).

## Module 4 — Check-in, anti-tilt et journal

La partie psychologique est traitée comme une règle du plan : elle peut bloquer une activation au même titre qu'une annonce CPI.

**Check-in avant session** (1 minute, 5 questions, score sur 100)

| Question | Réponses | Poids |
| --- | --- | --- |
| Heures de sommeil | < 5 h / 5–6 h / 6–7 h / > 7 h | 25 |
| Niveau de stress | 1 à 5 | 25 |
| Énergie | 1 à 5 | 15 |
| Journée chez UBIC | calme / normale / chargée | 15 |
| État d'esprit | serein / neutre / agacé / euphorique | 20 |

- Score < 50 : session verrouillée pour le créneau.
- Score 50–70 : session autorisée, avec un avertissement à chaque proposition.
- « Agacé » ou « euphorique » : verrou de 30 min puis nouveau check-in.
- Les seuils sont dans `plan.yaml` et se réajustent avec les statistiques du journal.

**Anti-tilt**

- 2 pertes d'affilée : verrou jusqu'au créneau suivant.
- 2 journées perdantes de suite : le lendemain, risque attendu 0,25 % (à confirmer).
- Activation impulsive : demande d'activation dans les 15 min après une perte, ou plus de 2 demandes refusées en 10 min → verrou de 30 min.
- Un verrou ne se lève jamais depuis l'appli : il expire seul.

**Rappel du plan** : avant chaque `ENABLE`, l'appli affiche les règles du setup et demande de cocher « je respecte mon plan ».

**Journal**

- Chaque trade est importé automatiquement depuis MT4 (actif, sens, résultat en %, durée).
- Débrief post-trade en 30 secondes : plan respecté oui/non, ressenti (liste), une note libre.
- Bilan hebdomadaire : résultat par tranche de score de check-in, par actif, par créneau, taux de respect du plan.

**Tables SQLite** : `accounts`, `snapshots`, `positions`, `trades`, `signals`, `decisions`, `commands`, `checkins`, `locks`, `debriefs`, `news_events`.

## Sécurité

Le radar pilote des comptes financés : aucun port du VPS n'est ouvert sur Internet, et l'appli ne peut faire que 3 choses (`ENABLE`, `DISABLE`, `CLOSE_ALL`).

- **Accès** : backend écoutant uniquement en local sur le VPS ; le téléphone y accède par un VPN privé (Tailscale), sans port ouvert.
- **Connexion** : code PIN + appareil enregistré ; session expirée après 12 h.
- **Aucun ordre de trading** possible depuis l'appli ou le backend : seul ARYA trade.
- **Journal d'audit** : chaque commande enregistrée avec son auteur (Adrien ou garde-fou), sa raison et son accusé de réception.
- **Secrets** (PIN, clés Web Push) dans un fichier `.env` hors du dépôt Git.
- **Sauvegarde** : copie quotidienne de la base SQLite.
- **Claude Code** développe sur ton PC ou un dépôt Git, jamais avec les identifiants du VPS ou des comptes.
- **Règles des prop firms** : vérifier auprès de FTMO et FundedNext qu'un EA gardien avec DLL est autorisé sur leurs comptes avant le passage en réel.

## Plan de réalisation par étapes avec Claude Code

6 étapes, chacune livrable et testable seule. Rien ne touche un compte réel avant l'étape 6.

1. **Préparation** : un compte démo MT4 sur le VPS, Python 3.12, Git, Tailscale installés ; dépôt Git `radar-arya` créé avec ce cahier des charges en `SPEC.md`.
2. **EA gardien en lecture seule** : export de `state.json` uniquement. Critère : le fichier se met à jour toutes les 5 s sur 2 terminaux démo.
3. **Backend : collecteur + moteur de règles** : `plan.yaml`, règles R1–R12 et leurs tests unitaires. Critère : tous les tests passent, y compris les cas limites (12:15 pile, vendredi 15:45, jour de CPI).
4. **Appli mobile en lecture seule** : accueil, check-in, journal. Critère : utilisable une semaine sur téléphone sans bug bloquant.
5. **Commandes en démo** : `DISABLE` et `CLOSE_ALL` d'abord, puis `ENABLE` avec validation, puis les propositions de setup Douglas et les notifications. Critère : tests du tableau « Tests et critères » tous validés.
6. **Observation, puis réel** : 2 à 4 semaines en démo en notant les propositions ; passage en réel seulement si le journal montre que les setups à score élevé font mieux que les autres.

**Premier message à donner à Claude Code (étape 2)**

```markdown
Lis SPEC.md. On construit l'étape 2 uniquement : l'EA gardien MQL4 en lecture seule.
- Fichier : mql4/RadarGuardian.mq4
- Toutes les 5 s (OnTimer), écrire dans le dossier commun MT4 (FILE_COMMON),
  sous-dossier radar/<login>/, un fichier state.json conforme au module 1 de SPEC.md.
- Écriture atomique : écrire state.tmp puis renommer.
- Aucun ordre, aucune commande, aucune DLL à cette étape.
- Fournis aussi tools/read_state.py qui lit et affiche state.json pour vérifier.
Avant de coder, liste les points de SPEC.md que tu trouves ambigus et pose-moi tes questions.
```

## Tests et critères d'acceptation

La V1 est acceptée quand chaque ligne passe en démo, deux fois de suite.

| Critère | Comment le tester | Attendu |
| --- | --- | --- |
| Coupure sur perte max | Forcer un P&L du jour à -0,5 % en démo | `CLOSE_ALL` exécuté en moins de 10 s, verrou jusqu'au lendemain |
| Hors créneau | Demander une activation à 12:20 et à 14:00 | Bouton absent, raison « R1 » affichée |
| Vendredi après-midi | Demander une activation vendredi à 15:50 | Refus « R2 » |
| Jour d'annonce | Injecter un CPI dans le calendrier du jour | Journée verrouillée « R10 » |
| Actif interdit | ARYA ouvre une position sur EURUSD | Alerte immédiate |
| Risque effectif | Position ouverte à 0,75 % de risque | Alerte, puis `CLOSE_ALL` après 2 min |
| Anti-tilt | 2 pertes d'affilée simulées | Verrou jusqu'au créneau suivant |
| Activation impulsive | Demande 5 min après une perte | Verrou de 30 min |
| Check-in bas | Score de 40 | Session verrouillée |
| Terminal figé | Fermer un MT4 | Alerte en moins de 90 s |
| Redémarrage VPS | Reboot | Backend relancé seul, aucun `ENABLE` automatique |
| Accusé de réception | Envoyer `DISABLE` | AutoTrading éteint, `ack.json` écrit, ligne d'audit créée |

## Points ouverts

- [ ] Définition chiffrée de la « tendance M5 » (structure de plus hauts/bas ? pente de la MM100 ?)
- [ ] Zones H4 : ARYA Zone Ultimate permet-il de créer des alertes TradingView ? (sinon case à cocher en V1)
- [ ] Source du calendrier économique (flux gratuit fiable, en heure de Paris)
- [ ] Anti-tilt sur plusieurs jours : confirmer « 2 journées perdantes → risque 0,25 % le lendemain »
- [ ] Seuils du check-in à valider après 2 semaines de journal
- [ ] Bascule du bouton AutoTrading par DLL : test en démo + accord FTMO / FundedNext
- [ ] `Clock Filter` d'ARYA : vérifier dans le manuel qu'il couvre bien les deux créneaux et le vendredi
