// Favori « Envoyer à MADRIMMO » (bookmarklet) : s'exécute dans le navigateur de l'utilisateur, sur la page
// de l'annonce déjà affichée. Il relève les données structurées (objet « ad » de Leboncoin, JSON-LD schema.org,
// balises Open Graph) et le texte visible, puis ouvre MADRIMMO sur /importer#d=… . Les données restent dans
// l'ancre de l'adresse : elles ne passent par aucun serveur. L'extraction elle-même est faite par
// lib/annonce/extracteur.ts dans la page /importer.

/** Script du favori, lisible (ES5 pour les vieux navigateurs mobiles). ORIGINE est remplacé à la génération. */
const SOURCE = `
(function () {
  try {
    var trouver = function (x, p) {
      if (!x || typeof x !== "object" || p > 8) return null;
      if ("list_id" in x && "subject" in x) return x;
      for (var k in x) { var r = trouver(x[k], p + 1); if (r) return r; }
      return null;
    };
    var ad = null, n = document.getElementById("__NEXT_DATA__");
    if (n) { try { ad = trouver(JSON.parse(n.textContent), 0); } catch (e) {} }
    var ld = [];
    var blocs = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < blocs.length; i++) { try { ld.push(JSON.parse(blocs[i].textContent)); } catch (e) {} }
    var og = {};
    var metas = document.querySelectorAll('meta[property^="og:"], meta[property^="product:"]');
    for (var j = 0; j < metas.length; j++) og[metas[j].getAttribute("property")] = metas[j].getAttribute("content");
    var d = { v: 1, url: location.href, titre: document.title, ad: ad, jsonld: ld, og: og, texte: (document.body.innerText || "").slice(0, 12000) };
    var s = JSON.stringify(d);
    if (s.length > 300000) { d.jsonld = []; s = JSON.stringify(d); }
    var b = btoa(unescape(encodeURIComponent(s))).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
    var u = "ORIGINE/importer#d=" + b;
    var w = window.open(u, "_blank");
    if (!w) location.href = u;
  } catch (e) {
    alert("MADRIMMO : lecture de l'annonce impossible (" + e.message + ")");
  }
})();
`;

/** Code à mettre dans l'adresse du favori (« javascript:… »), pour l'appli servie depuis `origine`. */
export function codeFavori(origine: string): string {
  const compact = SOURCE.replace("ORIGINE", origine.replace(/\/$/, ""))
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ");
  return `javascript:${encodeURIComponent(compact)}`;
}

/** Script brut (sans « javascript: »), pour l'exécuter dans les tests ou un raccourci iOS. */
export function scriptFavori(origine: string): string {
  return SOURCE.replace("ORIGINE", origine.replace(/\/$/, ""));
}
