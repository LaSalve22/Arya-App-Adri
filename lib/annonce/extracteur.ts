// Lecture d'une annonce à partir des données structurées de sa page :
// Leboncoin (__NEXT_DATA__ → objet « ad »), schema.org (JSON-LD), balises Open Graph, puis texte visible.
// Les données brutes viennent du favori « Envoyer à MADRIMMO » (navigateur de l'utilisateur),
// du partage depuis une appli, ou du serveur pour les sites qui autorisent la lecture.
import { analyserAnnonce } from "./parse";

/** Données brutes relevées sur la page de l'annonce. */
export interface BrutAnnonce {
  v: 1;
  url?: string;
  titre?: string;
  /** Objet « ad » de Leboncoin (extrait de __NEXT_DATA__). */
  ad?: Record<string, unknown> | null;
  /** Blocs JSON-LD schema.org de la page. */
  jsonld?: unknown[];
  /** Balises Open Graph (og:title, og:description, og:image…). */
  og?: Record<string, string>;
  /** Texte visible de la page ou texte partagé. */
  texte?: string;
}

export type TypeAnnonce = "Maison" | "Appartement" | "Terrain" | "Immeuble" | "Local";
export type SiteAnnonce = "leboncoin" | "seloger" | "bienici" | "pap" | "logic-immo" | "autre";

export interface AnnonceImportee {
  site: SiteAnnonce;
  url: string | null;
  titre: string | null;
  description: string | null;
  prix: number | null;
  surface: number | null;
  terrain: number | null;
  pieces: number | null;
  type: TypeAnnonce | null;
  dpe: string | null;
  ville: string | null;
  codePostal: string | null;
  adresse: string | null;
  lat: number | null;
  lon: number | null;
  /** Les sites donnent souvent une position approchée (centre du quartier). */
  positionApprochee: boolean;
  photos: string[];
  /** Données lues dans les données structurées (fiables) ou déduites du texte (à vérifier). */
  sources: Partial<Record<"prix" | "surface" | "terrain" | "pieces" | "type" | "dpe" | "ville" | "position", "structure" | "texte">>;
}

export function detecterSite(url: string | null | undefined): SiteAnnonce {
  const h = (() => { try { return new URL(url ?? "").hostname; } catch { return ""; } })();
  if (/leboncoin\./.test(h)) return "leboncoin";
  if (/seloger\./.test(h)) return "seloger";
  if (/logic-immo\./.test(h)) return "logic-immo";
  if (/bienici\./.test(h)) return "bienici";
  if (/(^|\.)pap\.fr$/.test(h)) return "pap";
  return "autre";
}

const num = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[\s  ]/g, "").replace(",", ".").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  if (Array.isArray(v)) return num(v[0]);
  return null;
};
const texte = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function typeDepuis(s: string | null | undefined): TypeAnnonce | null {
  const t = (s ?? "").toLowerCase();
  if (/immeuble|building/.test(t)) return "Immeuble";
  if (/maison|house|villa|singlefamily|mas\b|pavillon/.test(t)) return "Maison";
  if (/appart|apartment|flat|studio|loft|duplex/.test(t)) return "Appartement";
  if (/terrain|land|lot\b/.test(t)) return "Terrain";
  if (/local|commerc|bureau|office|boutique|parking|garage/.test(t)) return "Local";
  return null;
}

// ----- Leboncoin : objet « ad » de __NEXT_DATA__
const TYPES_LBC: Record<string, TypeAnnonce> = { "1": "Maison", "2": "Appartement", "3": "Terrain", "4": "Local", "5": "Local" };

function depuisLeboncoin(ad: Record<string, unknown>): Partial<AnnonceImportee> {
  const attrs = Array.isArray(ad.attributes) ? (ad.attributes as { key?: string; value?: string; value_label?: string }[]) : [];
  const attr = (k: string) => attrs.find((a) => a.key === k);
  const loc = (ad.location ?? {}) as Record<string, unknown>;
  const images = (ad.images ?? {}) as Record<string, unknown>;
  const photos = ((images.urls_large ?? images.urls ?? []) as unknown[]).filter((u): u is string => typeof u === "string");
  const typeAttr = attr("real_estate_type");
  const dpe = texte(attr("energy_rate")?.value)?.toUpperCase() ?? null;
  return {
    titre: texte(ad.subject),
    description: texte(ad.body),
    prix: num(ad.price) ?? (num(ad.price_cents) != null ? num(ad.price_cents)! / 100 : null),
    surface: num(attr("square")?.value),
    terrain: num(attr("land_plot_surface")?.value),
    pieces: num(attr("rooms")?.value),
    type: (typeAttr?.value && TYPES_LBC[typeAttr.value]) || typeDepuis(typeAttr?.value_label),
    dpe: dpe && /^[A-G]$/.test(dpe) ? dpe : null,
    ville: texte(loc.city) ?? texte(loc.city_label)?.replace(/\s*\d{5}.*$/, "") ?? null,
    codePostal: texte(loc.zipcode),
    lat: num(loc.lat),
    lon: num(loc.lng),
    positionApprochee: true,
    photos,
    url: texte(ad.url),
  };
}

// ----- schema.org (JSON-LD)
const TYPES_SCHEMA = /Product|Offer|Residence|House|Apartment|SingleFamilyResidence|RealEstateListing|Accommodation|Place|Room/;

function aplatir(x: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(x)) for (const e of x) aplatir(e, out);
  else if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    out.push(o);
    if (o["@graph"]) aplatir(o["@graph"], out);
    for (const k of ["mainEntity", "itemOffered", "offers", "about"]) if (o[k] && typeof o[k] === "object") aplatir(o[k], out);
  }
  return out;
}

function depuisJsonLd(blocs: unknown[]): Partial<AnnonceImportee> {
  const noeuds = aplatir(blocs).filter((n) => TYPES_SCHEMA.test(String(n["@type"] ?? "")));
  const r: Partial<AnnonceImportee> = {};
  for (const n of noeuds) {
    const offre = (Array.isArray(n.offers) ? n.offers[0] : n.offers) as Record<string, unknown> | undefined;
    r.prix ??= num(n.price) ?? num(offre?.price);
    const fs = n.floorSize as Record<string, unknown> | undefined;
    r.surface ??= num(fs?.value ?? n.floorSize);
    r.pieces ??= num(n.numberOfRooms);
    r.titre ??= texte(n.name);
    r.description ??= texte(n.description);
    r.type ??= typeDepuis(String(n["@type"] ?? "")) ?? typeDepuis(texte(n.name));
    const adr = (n.address ?? {}) as Record<string, unknown>;
    r.ville ??= texte(adr.addressLocality);
    r.codePostal ??= texte(adr.postalCode);
    r.adresse ??= texte(adr.streetAddress);
    const geo = (n.geo ?? {}) as Record<string, unknown>;
    if (r.lat == null && num(geo.latitude) != null) { r.lat = num(geo.latitude); r.lon = num(geo.longitude); }
    const img = n.image;
    const imgs = (Array.isArray(img) ? img : img ? [img] : []).map((i) => (typeof i === "string" ? i : texte((i as Record<string, unknown>)?.url))).filter((u): u is string => !!u);
    if (imgs.length && !r.photos?.length) r.photos = imgs;
  }
  return r;
}

/** Extrait l'annonce des données brutes : données structurées d'abord, texte ensuite pour compléter. */
export function extraireAnnonce(b: BrutAnnonce): AnnonceImportee {
  const site = detecterSite(b.url);
  const lbc = b.ad ? depuisLeboncoin(b.ad) : {};
  const ld = b.jsonld?.length ? depuisJsonLd(b.jsonld) : {};
  const og = b.og ?? {};
  const s: AnnonceImportee["sources"] = {};
  const choisir = <K extends keyof AnnonceImportee>(k: K, ...vals: (AnnonceImportee[K] | null | undefined)[]) => vals.find((v) => v != null && v !== "") ?? null;

  const r: AnnonceImportee = {
    site,
    url: choisir("url", b.url, lbc.url) as string | null,
    titre: choisir("titre", lbc.titre, ld.titre, og["og:title"], b.titre) as string | null,
    description: choisir("description", lbc.description, ld.description, og["og:description"]) as string | null,
    prix: choisir("prix", lbc.prix, ld.prix, num(og["product:price:amount"])) as number | null,
    surface: choisir("surface", lbc.surface, ld.surface) as number | null,
    terrain: choisir("terrain", lbc.terrain, ld.terrain) as number | null,
    pieces: choisir("pieces", lbc.pieces, ld.pieces) as number | null,
    type: choisir("type", lbc.type, ld.type) as TypeAnnonce | null,
    dpe: choisir("dpe", lbc.dpe, ld.dpe) as string | null,
    ville: choisir("ville", lbc.ville, ld.ville) as string | null,
    codePostal: choisir("codePostal", lbc.codePostal, ld.codePostal) as string | null,
    adresse: choisir("adresse", ld.adresse) as string | null,
    lat: choisir("lat", lbc.lat, ld.lat) as number | null,
    lon: choisir("lon", lbc.lon, ld.lon) as number | null,
    positionApprochee: lbc.lat != null ? true : ld.lat != null ? false : true,
    photos: [...new Set([...(lbc.photos ?? []), ...(ld.photos ?? []), ...(og["og:image"] ? [og["og:image"]] : [])])].slice(0, 30),
    sources: s,
  };
  for (const k of ["prix", "surface", "terrain", "pieces", "type", "dpe", "ville"] as const) if (r[k] != null) s[k] = "structure";
  if (r.lat != null) s.position = "structure";

  // Compléter avec le texte (titre, description, texte de la page)
  const tout = [r.titre, r.description, b.titre, b.texte].filter(Boolean).join("\n");
  if (tout) {
    const t = analyserAnnonce(tout);
    const completer = <K extends "prix" | "surface" | "terrain" | "pieces" | "dpe" | "ville" | "codePostal">(k: K, v: AnnonceImportee[K]) => {
      if (r[k] == null && v != null) { (r as unknown as Record<string, unknown>)[k] = v; if (k !== "codePostal") s[k as keyof typeof s] = "texte"; }
    };
    completer("prix", t.prix); completer("surface", t.surface); completer("terrain", t.terrain); completer("pieces", t.pieces);
    completer("dpe", t.dpe); completer("ville", t.ville); completer("codePostal", t.codePostal);
    if (r.type == null && t.type) { r.type = t.type; s.type = "texte"; }
  }
  // Terrain à bâtir : la seule surface citée est celle du terrain.
  if (r.type === "Terrain" && r.terrain == null && r.surface != null) {
    r.terrain = r.surface;
    r.surface = null;
    if (s.surface) { s.terrain = s.surface; delete s.surface; }
  }
  // Ville lisible dans certaines adresses d'annonce (Leboncoin : /ventes_immobilieres/…, Bien'ici : …/narbonne-11100/…)
  if (!r.codePostal && r.url) {
    const m = r.url.match(/-((?:09|11|12|30|31|32|34|46|48|65|66|81|82)\d{3})(?:[/-]|$)/);
    if (m) r.codePostal = m[1];
  }
  return r;
}

// ----- Transport des données brutes dans l'adresse (#d=…), en base64 URL-safe
export function encoderBrut(b: BrutAnnonce): string {
  const octets = new TextEncoder().encode(JSON.stringify(b));
  let bin = "";
  for (const o of octets) bin += String.fromCharCode(o);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function decoderBrut(s: string): BrutAnnonce | null {
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))) as BrutAnnonce;
  } catch {
    return null;
  }
}

// ----- Côté serveur : données brutes d'une page HTML (sites qui autorisent la lecture)
const decoderEntites = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");

export function brutDepuisHtml(html: string, url: string): BrutAnnonce {
  const jsonld: unknown[] = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { jsonld.push(JSON.parse(m[1].trim())); } catch { /* bloc invalide ignoré */ }
  }
  let ad: Record<string, unknown> | null = null;
  const next = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (next) { try { ad = trouverAd(JSON.parse(next[1])); } catch { /* ignoré */ } }
  const og: Record<string, string> = {};
  for (const m of html.matchAll(/<meta[^>]+(?:property|name)="((?:og|product):[^"]+)"[^>]+content="([^"]*)"/gi)) og[m[1]] ??= decoderEntites(m[2]);
  const titre = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const corps = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, "\n").replace(/\n\s*\n+/g, "\n");
  return { v: 1, url, titre: titre ? decoderEntites(titre).trim() : undefined, ad, jsonld, og, texte: decoderEntites(corps).slice(0, 15000) };
}

/** Cherche l'objet « ad » de Leboncoin dans __NEXT_DATA__ (objet ayant list_id et subject). */
export function trouverAd(x: unknown, profondeur = 0): Record<string, unknown> | null {
  if (!x || typeof x !== "object" || profondeur > 8) return null;
  const o = x as Record<string, unknown>;
  if ("list_id" in o && "subject" in o) return o;
  for (const v of Object.values(o)) {
    const r = trouverAd(v, profondeur + 1);
    if (r) return r;
  }
  return null;
}
