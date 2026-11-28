// Imprime le guide d'utilisation MADRIMMO en PDF A4.
// Captures à jour : lancer l'appli (port 3009), puis node scripts/captures-guide.cjs.
// Usage : node scripts/generer-guide.mjs
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

// Playwright est installé globalement dans l'environnement, pas dans le projet.
const { chromium } = createRequire(import.meta.url)("playwright");

const racine = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(racine, "docs/guide/guide.html");
const sortie = path.join(racine, "docs/guide/MADRIMMO-Guide-utilisation.pdf");

const navigateur = await chromium.launch();
const page = await navigateur.newPage();
await page.goto(pathToFileURL(source).href, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: sortie, format: "A4", printBackground: true, preferCSSPageSize: true });
await navigateur.close();
console.log("PDF :", sortie);
