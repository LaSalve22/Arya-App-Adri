// Captures de l'appli pour le guide utilisateur et la vidéo (appli lancée sur http://localhost:3009).
// Usage : node scripts/captures-guide.cjs
const { chromium } = require("playwright");
const path = require("node:path");
const D = path.join(__dirname, "../docs/guide/captures");
const URL_BIEN = "http://localhost:3009/bien?lon=3.877762&lat=43.609615&insee=34172&label=12%20Rue%20de%20la%20Loge%2034000%20Montpellier&type=Appartement&surface=65&prix=210000";

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, acceptDownloads: true });
  const err = []; p.on("pageerror", (e) => err.push(e.message));
  const shot = (n) => p.screenshot({ path: `${D}/${n}.png` });
  const bloc = (titre) => p.locator(".carte", { has: p.locator("h2", { hasText: titre }) }).first();
  const tab = async (n) => { await p.getByRole("tab", { name: new RegExp("^\\d*\\s*" + n + "$") }).click(); await p.waitForTimeout(600); await p.evaluate(() => window.scrollTo(0, 0)); };

  // Accueil et recherche
  await p.goto("http://localhost:3009/"); await p.waitForTimeout(1500);
  await p.getByPlaceholder(/12 rue de la Loge/).fill("12 rue de la Loge Montpellier"); await p.waitForTimeout(2500);
  await shot("01-recherche");

  // Analyse du bien
  await p.goto(URL_BIEN); await p.waitForTimeout(12000);
  const prix = bloc(/^Prix$/);
  await prix.locator("input").nth(1).fill("145000"); await p.waitForTimeout(400);
  await shot("02-nature");
  await tab("Ventes DVF et DPE"); await p.waitForTimeout(4000); await shot("03-marche");
  await tab("Biens similaires vendus"); await p.waitForTimeout(5000); await shot("04-similaires");

  // Travaux
  await tab("Travaux");
  await p.getByPlaceholder(/Ou tape, colle/).fill("T3 de 65 m², cuisine et salle de bain à refaire, deux chambres à rafraîchir, séjour à rafraîchir, électricité pas aux normes, construit en 1930");
  await p.getByRole("button", { name: "Analyser le texte" }).click(); await p.waitForTimeout(500);
  await shot("05-travaux-description");
  await bloc("Forfait rapide").screenshot({ path: `${D}/06-travaux-forfaits.png` });
  await p.getByRole("button", { name: "Générer le devis détaillé" }).click(); await p.waitForTimeout(800);
  await bloc("État des pièces").screenshot({ path: `${D}/07-travaux-pieces.png` });
  await bloc("Devis détaillé").screenshot({ path: `${D}/08-travaux-devis.png` });
  await bloc("Requalification").screenshot({ path: `${D}/09-travaux-tva.png` });
  await bloc("Démarches administratives").screenshot({ path: `${D}/10-travaux-demarches.png` });
  await bloc("Travaux par lot").screenshot({ path: `${D}/10b-travaux-lots.png` });

  await tab("Coûts techniques");
  const archi = p.locator("label.champ", { hasText: "Architecte" });
  await archi.getByRole("radio", { name: "% travaux" }).click(); await archi.locator("input").fill("8"); await p.waitForTimeout(300);
  await shot("13-couts");
  // Financement : fonds propres puis ligne de crédit
  await tab("Mode de financement");
  await p.getByRole("button", { name: /\+ Fonds propres/ }).click(); await p.waitForTimeout(300);
  await p.locator("details.bloc").first().locator("label.champ", { hasText: "Montant" }).locator("input").fill("45000"); await p.waitForTimeout(300);
  await p.getByRole("button", { name: /\+ Ligne de crédit/ }).click(); await p.waitForTimeout(500);
  await p.locator("details.bloc").nth(1).locator("label.champ", { hasText: "Montant" }).locator("input").fill("160000"); await p.waitForTimeout(400);
  await shot("12-financement");

  await tab("BP avec travaux"); await shot("11-bp");
  await tab("Frais de vente"); await shot("13b-vente");
  await tab("Profil MdB"); await shot("13c-profil");
  await tab("Résidence principale");
  const banque = p.locator(".carte", { has: p.locator("h3", { hasText: "Banque et fonds propres" }) }).last();
  await banque.locator("label.champ", { hasText: "Apport personnel" }).locator("input").fill("30000"); await p.waitForTimeout(300);
  await shot("14-rp");
  await tab("Comparatif"); await shot("15-comparatif");
  await tab("Récapitulatif"); await shot("16-recap");
  for (const f of ["paysage", "portrait"]) {
    await p.getByRole("radio", { name: f === "portrait" ? /Smartphone/ : /PC/ }).click();
    const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 60000 }), p.getByRole("button", { name: "Télécharger le PDF" }).click()]);
    await dl.saveAs(`${D}/rapport-${f}.pdf`);
  }
  await p.getByRole("button", { name: /Enregistrer en projet/ }).click(); await p.waitForTimeout(800);
  await p.goto("http://localhost:3009/projets"); await p.waitForTimeout(1500); await shot("17-projets");

  // Mobile
  const m = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await m.goto("http://localhost:3009/"); await m.waitForTimeout(1500); await m.screenshot({ path: `${D}/m-accueil.png` });
  await m.goto(URL_BIEN + "#bien"); await m.waitForTimeout(10000); await m.screenshot({ path: `${D}/m-nature.png` });
  await m.goto(URL_BIEN + "#travaux"); await m.waitForTimeout(6000); await m.screenshot({ path: `${D}/m-travaux.png` });
  console.log("erreurs:", err);
  await b.close();
})();
