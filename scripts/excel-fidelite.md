# Vérifier que le moteur de bilan colle à l'Excel

1. `python3 scripts/excel-fidelite/fill.py chemin/vers/bilan_previsionnel_v3.xlsx` : crée 3 classeurs remplis (TVA sur marge, exonération, TVA sur le prix total) et `cases.json`.
2. `soffice --headless --calc --convert-to xlsx --outdir out in_*.xlsx` : LibreOffice recalcule les formules.
3. `python3 scripts/excel-fidelite/read.py` : écrit `excel_results.json`.
4. Copier `cases.json` et `excel_results.json` dans `lib/bilan/__fixtures__/`, puis `npm test`.

Écarts volontaires avec l'Excel :
- Taux de TVA 5,5 % accepté (l'Excel renvoie #N/A) et formule du 2,1 % corrigée.
- Pas d'impôt sur les sociétés négatif en cas de perte (l'Excel en calcule un).
- Coût travaux HT au m² calculé comme (D19 − E19) / surface (l'Excel écrit D19 − E19/surface).
