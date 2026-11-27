// Petit client HTTP côté serveur : délai maximal + cache mémoire avec durée de vie.
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const memoire = new Map<string, { expire: number; valeur: unknown }>();

export class ErreurSource extends Error {
  constructor(public source: string, message: string, public status = 502) {
    super(`${source} : ${message}`);
  }
}

async function brut(url: string, source: string, timeoutMs: number): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { "User-Agent": "madrimmo/0.1" } });
  } catch (e) {
    throw new ErreurSource(source, `service injoignable (${(e as Error).name})`);
  }
  return res;
}

export async function getJSON<T>(url: string, source: string, ttlMs = 3600_000, timeoutMs = 20_000): Promise<T> {
  const c = memoire.get(url);
  if (c && c.expire > Date.now()) return c.valeur as T;
  const res = await brut(url, source, timeoutMs);
  if (!res.ok) throw new ErreurSource(source, `réponse ${res.status}`);
  const valeur = (await res.json()) as T;
  memoire.set(url, { expire: Date.now() + ttlMs, valeur });
  return valeur;
}

const DOSSIER_CACHE = path.join(process.cwd(), ".cache");

/** Texte avec cache disque (pour les gros fichiers DVF). Renvoie null si le fichier n'existe pas (404). */
export async function getTexteCacheDisque(url: string, cle: string, source: string, ttlMs: number): Promise<string | null> {
  const fichier = path.join(DOSSIER_CACHE, cle);
  try {
    const s = await stat(fichier);
    if (Date.now() - s.mtimeMs < ttlMs) return await readFile(fichier, "utf8");
  } catch {}
  const res = await brut(url, source, 60_000);
  if (res.status === 404) return null;
  if (!res.ok) throw new ErreurSource(source, `réponse ${res.status}`);
  const texte = await res.text();
  try {
    await mkdir(path.dirname(fichier), { recursive: true });
    await writeFile(fichier, texte);
  } catch {
    // Système de fichiers en lecture seule (ex. Vercel) : on se contente du cache mémoire du runtime.
  }
  return texte;
}
