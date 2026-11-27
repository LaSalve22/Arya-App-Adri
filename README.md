# MADRIMMO : l'outil d'analyse du marchand de biens (Occitanie)

Recherche d'un bien et analyse en temps réel à partir des données publiques, puis bilan prévisionnel
(méthode de l'Excel `bilan_previsionnel_v3.xlsx`) avec simulation de la négociation.

## Lancer en local

Prérequis : Node.js 20 ou plus récent.

```bash
npm install
npm run dev
```

Ouvrir ensuite http://localhost:3000.

Tests du moteur de calcul : `npm test`.

## Mettre en ligne (Vercel, gratuit)

1. Créer un compte sur vercel.com (connexion avec GitHub) et importer le dépôt `Arya-App-Adri`.
2. Laisser « Root Directory » vide (l'appli est à la racine du dépôt, `vercel.json` force Next.js).
3. Dans « Environment Variables », ajouter `MADRIMMO_JETON` avec une longue valeur aléatoire (au moins 16 caractères, gardée secrète).
4. Déployer. Aucune clé d'API n'est nécessaire : toutes les sources sont publiques.

## Connecteur Claude (l'IA de ton abonnement, sans coût en plus)

L'appli expose un serveur MCP à l'adresse `https://<ton-projet>.vercel.app/api/mcp/<MADRIMMO_JETON>`.

Dans Claude (web, bureau ou mobile) : Personnaliser → Connecteurs → « Ajouter un connecteur personnalisé », puis coller cette adresse.
Chaque personne l'ajoute sur son propre compte (offre gratuite : un seul connecteur personnalisé).

Outils proposés à Claude : `chercher_adresse`, `fiche_bien`, `comparables_dvf`, `prix_secteur`, `analyser_annonce`,
`calculer_bilan`, `negociation`, `comparer_residence_principale`, `plan_financement`, `lien_appli`.

Exemple de demande : « Analyse le 50 rue de l'Ancien Courrier à Narbonne, appartement de 69 m² affiché 110 000 €, 25 000 € de travaux.
Donne-moi le prix maximum pour 15 % de marge et compare avec un achat en résidence principale. »

## Ce que fait l'outil

- **Recherche** par adresse (autocomplétion), par référence cadastrale (commune, section, numéro), par annonce collée ou par commune.
- **Fiche du bien** : parcelle et contour (cadastre IGN), zone du PLU et lien vers le règlement (Géoportail de l'Urbanisme),
  risques (Géorisques, dont les argiles), DPE à proximité (ADEME), ventes comparables DVF sur 5 ans avec médiane et quartiles.
- **Bilan prévisionnel** : foncier, budget travaux poste par poste (avec la règle de bascule en « immeuble neuf »),
  honoraires, frais financiers, recettes par lot (prix bas, moyen et haut), TVA sur marge, exonération ou TVA sur le total, IS 15 % / 25 %.
- **Négociation** : curseur de remise, prix d'achat maximum pour une marge cible, tableau de sensibilité, historique des offres.
- **Analyse en 13 onglets** : recherche, nature du bien, ventes DVF et DPE, biens similaires vendus, profil MdB (SAS / SARL, sortie en dividendes), résidence principale, comparatif, BP avec travaux, frais financiers, mode de financement (fonds propres, comptes courants, prêt ou ligne de crédit, levée obligataire, associé en participation), coûts techniques, frais de vente, récapitulatif.
- **PDF récapitulatif** (4 pages) pour la banque ou les investisseurs, depuis l'onglet Récapitulatif.
- **Comparatif résidence principale** : le même bien acheté en nom propre, habité puis revendu, plus-value exonérée (pas de TVA ni d'IS, notaire de droit commun).
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
- `lib/mcp/serveur.ts` et `app/api/mcp/[jeton]/route.ts` : le connecteur Claude.
- `demo/` : page autonome de test (données figées), construite par `scripts/build-demo.mjs`.
- `app/` : pages (recherche, fiche du bien, projets) et routes API.
