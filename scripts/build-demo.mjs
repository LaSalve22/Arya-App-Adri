// Construit demo/index.html : gabarit + moteur de bilan (compilé) + données figées.
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

const r = await build({ entryPoints: ["scripts/moteur-navigateur.ts"], bundle: true, format: "iife", globalName: "Moteur", minify: true, write: false, target: "es2019" });
const moteur = r.outputFiles[0].text;
const data = readFileSync("demo/demo-data.json", "utf8");
const gabarit = readFileSync("demo/gabarit.html", "utf8");
const html = gabarit
  .replace("/*__MOTEUR__*/", () => moteur)
  .replace('"__DONNEES__"', () => data.replace(/</g, "\\u003c"));
writeFileSync("demo/index.html", html);
console.log("demo/index.html", Math.round(html.length / 1024), "Ko");
