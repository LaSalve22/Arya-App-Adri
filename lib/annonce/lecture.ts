// Lecture d'une annonce à partir d'un lien ou d'un texte partagé, côté serveur.
// Leboncoin, SeLoger et Logic-Immo bloquent les serveurs (et l'interdisent) : on guide alors vers le favori,
// qui lit l'annonce dans le navigateur de l'utilisateur. Bien'ici, PAP et les sites d'agences sont lus directement.
import { brutDepuisHtml, detecterSite, extraireAnnonce, type AnnonceImportee, type BrutAnnonce } from "./extracteur";

export interface ResultatLecture {
  annonce: AnnonceImportee;
  /** Message affiché quand le site ne peut pas être lu depuis le serveur. */
  guide?: string;
}

const GUIDE_FAVORI = (site: string) =>
  `${site} bloque la lecture depuis un serveur. Ouvre l'annonce dans ton navigateur et touche le favori « Envoyer à MADRIMMO » : elle sera lue complète (prix, surface, DPE, position, photos). En attendant, la fiche ci-dessous reprend ce qui a été partagé.`;

const ENTETES = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept-Language": "fr-FR,fr;q=0.9",
};

/** Seuls les sites publics sont lus : pas d'adresse IP, pas de nom local (le serveur ne doit pas servir de relais interne). */
export function lienPublic(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const h = u.hostname.toLowerCase();
    if (!h.includes(".") || h.endsWith(".local") || h.endsWith(".internal") || h === "localhost") return false;
    if (/^[\d.]+$/.test(h) || h.includes(":") || h.startsWith("[")) return false; // adresses IP
    return true;
  } catch {
    return false;
  }
}

const TAILLE_MAX = 4_000_000;

async function lire(url: string, type: "json" | "texte"): Promise<unknown> {
  if (!lienPublic(url)) throw new Error("adresse non autorisée");
  const r = await fetch(url, { headers: { ...ENTETES, Accept: type === "json" ? "application/json" : "text/html" }, signal: AbortSignal.timeout(8000), redirect: "follow" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  if (Number(r.headers.get("content-length") ?? 0) > TAILLE_MAX) throw new Error("page trop lourde");
  const t = await r.text();
  if (t.length > TAILLE_MAX) throw new Error("page trop lourde");
  return type === "json" ? JSON.parse(t) : t;
}

/** Bien'ici publie le détail d'une annonce en JSON : converti au format schema.org pour l'extracteur commun. */
async function brutBienici(url: string): Promise<BrutAnnonce> {
  const id = new URL(url).pathname.split("/").filter(Boolean).pop();
  if (!id) throw new Error("identifiant Bien'ici introuvable");
  const d = (await lire(`https://www.bienici.com/realEstateAd.json?id=${encodeURIComponent(id)}`, "json")) as Record<string, unknown>;
  const pos = ((d.blurInfo as Record<string, unknown> | undefined)?.position ?? {}) as Record<string, number>;
  const types: Record<string, string> = { house: "House", flat: "Apartment", loft: "Apartment", terrain: "Land", building: "Building", shop: "Local commercial", office: "Bureau", parking: "Parking" };
  const photos = ((d.photos ?? []) as { url?: string }[]).map((p) => p.url).filter(Boolean);
  return {
    v: 1,
    url,
    jsonld: [{
      "@type": types[String(d.propertyType)] ?? "Residence",
      name: d.title, description: d.description,
      offers: { price: d.price }, floorSize: { value: d.surfaceArea }, numberOfRooms: d.roomsQuantity,
      address: { addressLocality: d.city, postalCode: d.postalCode },
      geo: { latitude: pos.lat, longitude: pos.lon }, image: photos,
    }],
    texte: [d.landSurfaceArea ? `terrain de ${d.landSurfaceArea} m²` : "", d.energyClassification ? `DPE ${d.energyClassification}` : ""].filter(Boolean).join("\n"),
  };
}

/** Lit une annonce à partir d'un texte (partage d'appli, copier-coller) contenant éventuellement un lien. */
export async function lireAnnonce(texte: string): Promise<ResultatLecture> {
  const url = texte.match(/https?:\/\/[^\s<>"]+/)?.[0] ?? null;
  const reste = url ? texte.replace(url, " ").trim() : texte;
  const site = detecterSite(url);
  const partage: BrutAnnonce = { v: 1, url: url ?? undefined, texte: reste };

  // Texte collé ou partagé : il sert aussi de description (indices de travaux).
  const avecDescription = (r: ResultatLecture): ResultatLecture => ({ ...r, annonce: { ...r.annonce, description: r.annonce.description ?? (reste || null) } });
  if (!url) return avecDescription({ annonce: extraireAnnonce(partage) });
  if (site === "leboncoin" || site === "seloger" || site === "logic-immo") {
    const nom = site === "leboncoin" ? "Leboncoin" : site === "seloger" ? "SeLoger" : "Logic-Immo";
    return avecDescription({ annonce: extraireAnnonce(partage), guide: GUIDE_FAVORI(nom) });
  }
  try {
    const brut = site === "bienici" ? await brutBienici(url) : brutDepuisHtml((await lire(url, "texte")) as string, url);
    // Le texte partagé complète la page (titre, prix cités dans le message de partage).
    brut.texte = [brut.texte, reste].filter(Boolean).join("\n");
    return { annonce: extraireAnnonce(brut) };
  } catch {
    return avecDescription({ annonce: extraireAnnonce(partage), guide: GUIDE_FAVORI("Ce site") });
  }
}
