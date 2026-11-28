// Copie les fichiers de lecture de texte (OCR) dans public/ocr pour les servir depuis l'appli, sans CDN externe.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const dest = path.join("public", "ocr");
mkdirSync(dest, { recursive: true });
const copie = (src, nom = path.basename(src)) => {
  if (existsSync(src)) copyFileSync(src, path.join(dest, nom));
  else console.warn("OCR : fichier manquant", src);
};
copie("node_modules/tesseract.js/dist/worker.min.js");
for (const f of readdirSync("node_modules/tesseract.js-core")) if (/-lstm\.wasm\.js$/.test(f)) copie(path.join("node_modules/tesseract.js-core", f));
copie("node_modules/@tesseract.js-data/fra/4.0.0_best_int/fra.traineddata.gz");
console.log("OCR : fichiers copiés dans public/ocr");
