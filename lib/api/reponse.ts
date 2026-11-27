import { NextResponse } from "next/server";
import { ErreurSource } from "../sources/http";

export const ok = (data: unknown) => NextResponse.json(data);
export const erreur = (message: string, status = 400) => NextResponse.json({ erreur: message }, { status });

/** Exécute un appel et transforme une erreur de source en message lisible. */
export async function tenter<T>(f: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; erreur: string }> {
  try {
    return { ok: true, data: await f() };
  } catch (e) {
    return { ok: false, erreur: e instanceof ErreurSource ? e.message : (e as Error).message };
  }
}

export function nombre(v: string | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
