# Décisions prises (journal)

Chaque choix technique validé par Adrien est noté ici, avec sa date.

## 17/11/2026 — Avant les étapes 1 et 2

| # | Sujet | Décision |
| --- | --- | --- |
| 1 | Dépôt | On développe dans `Arya-App-Adri` (au lieu de `radar-arya`). |
| 2 | Règles R1–R12 | Le document « radar-cahier-des-besoins » sera fourni avant l'étape 3. |
| 3 | P&L du jour | L'EA exporte les heures en **UTC** + les trades clôturés des 7 derniers jours. Le **backend Python** calcule le P&L du jour en heure de Paris (changement d'heure compris, testé en pytest). L'EA fournit aussi un P&L « brut » pour contrôle visuel. |
| 4 | Bougies | Tout dans un seul `state.json` (≈ 150 Ko toutes les 5 s). |
| 5 | Noms des symboles | Inconnus pour l'instant : l'EA a un paramètre de correspondance `SymbolMap` à remplir à l'installation. |
| 6 | Champs en plus | `state.json` contient aussi : version du format, devise du compte, connexion au broker, bid/ask, infos du symbole (digits, point, taille et valeur du tick, taille du contrat). |
| 7 | Magic numbers ARYA | 42 = Arya Pro +, 88 = Arya Centurion (dans `plan.yaml`). |
| 8 | Terminaux démo | 2 terminaux MT4 démo sur le VPS : **FTMO** et **FxPro**. |

## Points techniques à vérifier en démo (pas de supposition)

- L'EA ne voit que l'historique chargé dans l'onglet « Historique du compte » de MT4 : à régler sur « Tout l'historique ».
- `OnTimer` doit continuer de tourner le week-end et quand le broker est déconnecté (battement de cœur à vérifier).
- Règles prop firm : vérifier auprès de FTMO (et FundedNext pour le réel) qu'un EA gardien avec DLL est autorisé — concerne l'étape 5.
