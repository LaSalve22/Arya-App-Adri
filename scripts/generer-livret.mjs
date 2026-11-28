// Imprime le livret MADRIMMO (présentation + charte) en PDF A4.
// Usage :
//   node scripts/generer-livret.mjs
//     → docs/marque/MADRIMMO-Charte-et-presentation.pdf, champs personnels laissés [à compléter]
//   node scripts/generer-livret.mjs docs/marque/coordonnees.local.json
//     → docs/marque/MADRIMMO-Charte-et-presentation.local.pdf, champs remplis
// Le dépôt est public : noms, téléphones, e-mails et adresse restent dans le fichier *.local.json
// (ignoré par git) et dans le PDF *.local.pdf (ignoré aussi), jamais dans livret.html.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

// Playwright est installé globalement dans l'environnement, pas dans le projet.
const { chromium } = createRequire(import.meta.url)("playwright");

const racine = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(racine, "docs/marque/livret.html");
const fichierChamps = process.argv[2];
const champs = fichierChamps ? JSON.parse(readFileSync(path.resolve(fichierChamps), "utf8")) : null;
const sortie = path.join(racine, `docs/marque/MADRIMMO-Charte-et-presentation${champs ? ".local" : ""}.pdf`);

const navigateur = await chromium.launch();
const page = await navigateur.newPage();
await page.goto(pathToFileURL(source).href, { waitUntil: "load" });
if (champs) {
  await page.evaluate((c) => {
    for (const el of document.querySelectorAll("[data-champ]")) {
      const v = c[el.getAttribute("data-champ")];
      if (v) { el.textContent = v; el.classList.remove("a-completer"); el.removeAttribute("style"); }
    }
    // Plus rien à compléter : on retire la note du sommaire.
    if (!document.querySelector("[data-champ].a-completer")) document.querySelector("em.a-completer")?.closest("p")?.remove();
  }, champs);
}
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: sortie, format: "A4", printBackground: true, preferCSSPageSize: true });
await navigateur.close();
console.log("PDF :", sortie);
