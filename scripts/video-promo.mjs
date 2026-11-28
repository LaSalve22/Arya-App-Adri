// Vidéo promotionnelle MADRIMMO : plans HTML (docs/video/plans.html) → images 1920 × 1080 → MP4 avec ffmpeg
// (léger zoom avant sur chaque plan, fondus enchaînés). Captures de l'appli : scripts/captures-guide.cjs.
// Usage : node scripts/video-promo.mjs
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const { chromium } = createRequire(import.meta.url)("playwright");
const racine = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dossier = path.join(racine, "docs/video");
const images = path.join(dossier, "plans");
const sortie = path.join(dossier, "MADRIMMO-video-promo.mp4");

// Durée de chaque plan (secondes) et durée des fondus
const DUREES = [4, 5, 5, 5, 5.5, 5, 5.5, 5, 5, 5, 5, 5.5];
const FONDU = 0.7;
const IPS = 30;

rmSync(images, { recursive: true, force: true });
mkdirSync(images, { recursive: true });
const navigateur = await chromium.launch();
const page = await navigateur.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(pathToFileURL(path.join(dossier, "plans.html")).href, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
const plans = page.locator("section.plan");
const n = await plans.count();
if (n !== DUREES.length) throw new Error(`${n} plans pour ${DUREES.length} durées`);
for (let i = 0; i < n; i++) await plans.nth(i).screenshot({ path: path.join(images, `plan-${String(i).padStart(2, "0")}.png`) });
await navigateur.close();

// Chaque plan : image fixe agrandie puis zoom avant lent (de 100 % à 104 %).
const entrees = [];
const filtres = [];
DUREES.forEach((d, i) => {
  entrees.push("-i", path.join(images, `plan-${String(i).padStart(2, "0")}.png`)); // une seule image : zoompan en tire d images
  const f = Math.round(d * IPS);
  filtres.push(`[${i}:v]scale=3840:2160,zoompan=z='1+0.04*on/${f}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${f}:s=1920x1080:fps=${IPS},setsar=1,format=yuv420p[v${i}]`);
});
// Fondus enchaînés
let prec = "v0";
let decalage = 0;
for (let i = 1; i < n; i++) {
  decalage += DUREES[i - 1] - FONDU;
  const out = i === n - 1 ? "vfin" : `x${i}`;
  filtres.push(`[${prec}][v${i}]xfade=transition=fade:duration=${FONDU}:offset=${decalage.toFixed(2)}[${out}]`);
  prec = out;
}
filtres.push(`[vfin]fade=t=in:st=0:d=0.8,fade=t=out:st=${(decalage + DUREES[n - 1] - 1).toFixed(2)}:d=1[final]`);

execFileSync("ffmpeg", [
  "-y", "-hide_banner", "-loglevel", "error",
  ...entrees,
  "-filter_complex", filtres.join(";"),
  "-map", "[final]",
  "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
  sortie,
], { stdio: "inherit" });
console.log("Vidéo :", sortie);
