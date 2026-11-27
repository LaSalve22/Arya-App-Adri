# MADRIMMO : l'outil d'analyse du marchand de biens (Occitanie)

Recherche d'un bien et analyse en temps réel à partir des données publiques, puis bilan prévisionnel
(méthode de l'Excel `bilan_previsionnel_v3.xlsx`) avec simulation de la négociation.

## Lancer en local

Prérequis : Node.js 20 ou plus récent.

```bash
cd app
npm install
npm run dev
```

Ouvrir ensuite http://localhost:3000.

Tests du moteur de calcul : `npm test`.

## Mettre en ligne (Vercel, gratuit)

1. Créer un compte sur vercel.com et importer le dépôt GitHub.
2. Dans le réglage « Root Directory », indiquer `app`.
3. Déployer. Aucune clé n'est nécessaire : toutes les sources sont publiques.

## Ce que fait l'outil

- **Recherche** par adresse (autocomplétion), par référence cadastrale (commune, section, numéro), par annonce collée ou par commune.
- **Fiche du bien** : parcelle et contour (cadastre IGN), zone du PLU et lien vers le règlement (Géoportail de l'Urbanisme),
  risques (Géorisques, dont les argiles), DPE à proximité (ADEME), ventes comparables DVF sur 5 ans avec médiane et quartiles.
- **Bilan prévisionnel** : foncier, budget travaux poste par poste (avec la règle de bascule en « immeuble neuf »),
  honoraires, frais financiers, recettes par lot (prix bas, moyen et haut), TVA sur marge, exonération ou TVA sur le total, IS 15 % / 25 %.
- **Négociation** : curseur de remise, prix d'achat maximum pour une marge cible, tableau de sensibilité, historique des offres.
- **Projets** enregistrés dans le navigateur.

## Sources

| Donnée | Service |
|---|---|
| Adresses | Base Adresse Nationale (data.geopf.fr) |
| Parcelles | Parcellaire Express IGN (WFS data.geopf.fr) |
| PLU | API Carto IGN, Géoportail de l'Urbanisme |
| Ventes | DVF géolocalisées, Etalab (files.data.gouv.fr) |
| Risques | Géorisques |
| DPE | ADEME |
| Communes | geo.api.gouv.fr |

## Organisation du code

- `lib/bilan/` : moteur de calcul (fonctions pures) et tests de fidélité à l'Excel (`scripts/excel-fidelite.md`).
- `lib/sources/` : clients des services publics, avec cache.
- `lib/annonce/parse.ts` : lecture d'une annonce.
- `lib/agent/outils.ts` : outils prêts pour brancher un agent IA (clé API Claude nécessaire).
- `app/` : pages (recherche, fiche du bien, projets) et routes API.
