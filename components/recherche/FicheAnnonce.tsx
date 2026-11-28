"use client";
// Fiche de vérification d'une annonce importée : chaque valeur est modifiable avant de lancer l'analyse.
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Adresse } from "@/lib/sources/geo";
import type { AnnonceImportee, TypeAnnonce } from "@/lib/annonce/extracteur";
import { analyserDescription } from "@/lib/travaux/dictee";
import { encoderPlan } from "@/lib/travaux/lien";
import { generalParDefaut, projetParDefaut } from "@/lib/travaux/plan";

const NOMS_SITES: Record<AnnonceImportee["site"], string> = {
  leboncoin: "Leboncoin", seloger: "SeLoger", "logic-immo": "Logic-Immo", bienici: "Bien'ici", pap: "PAP", autre: "Annonce",
};

function ChampNombre({ label, v, set, suffixe, source }: { label: string; v: number | null; set: (n: number | null) => void; suffixe?: string; source?: "structure" | "texte" }) {
  return (
    <label className="champ">
      <span>{label}{source === "texte" && <span className="doux"> · déduit du texte, à vérifier</span>}{v == null && <span className="mauvais"> · manquant</span>}</span>
      <span className="ligne" style={{ gap: 4, flexWrap: "nowrap" }}>
        <input type="number" value={v ?? ""} onChange={(e) => set(e.target.value === "" ? null : Number(e.target.value))} style={{ width: 140 }} />
        {suffixe && <span className="doux petit">{suffixe}</span>}
      </span>
    </label>
  );
}

export default function FicheAnnonce({ initiale }: { initiale: AnnonceImportee }) {
  const router = useRouter();
  const [a, setA] = useState<AnnonceImportee>(initiale);
  const [err, setErr] = useState<string | null>(null);
  const [charge, setCharge] = useState(false);
  const [copie, setCopie] = useState(false);
  const maj = (p: Partial<AnnonceImportee>) => setA({ ...a, ...p });

  async function geocoder(q: string): Promise<Adresse | null> {
    if (q.trim().length < 3) return null;
    const r = await fetch(`/api/adresse?q=${encodeURIComponent(q)}`);
    const d = (await r.json()) as Adresse[];
    return r.ok && d[0] ? d[0] : null;
  }

  async function analyser() {
    setErr(null);
    setCharge(true);
    try {
      const commune = [a.codePostal, a.ville].filter(Boolean).join(" ");
      const precise = a.adresse ? await geocoder(`${a.adresse} ${commune}`) : null;
      const lieu = precise ?? (await geocoder(commune));
      if (!lieu) {
        setErr("Commune introuvable en Occitanie : précise la ville, le code postal ou l'adresse.");
        return;
      }
      // Point : adresse précise, sinon position donnée par l'annonce (approchée), sinon centre de la commune.
      const exacte = precise && precise.type === "housenumber";
      const point = exacte ? precise : a.lat != null && a.lon != null ? { lon: a.lon, lat: a.lat } : lieu;
      const desc = [a.titre, a.description].filter(Boolean).join("\n");
      const c = desc ? analyserDescription(desc) : null;
      const indices = c && (c.forfait || c.pieces.length || Object.keys(c.general).length || Object.keys(c.projet).length);
      // Le forfait compris reste une suggestion : il n'est appliqué qu'au clic dans l'onglet Travaux.
      const travaux = c && indices
        ? encoderPlan({ mode: "forfait", forfait: null, pieces: c.pieces, general: { ...generalParDefaut(), ...c.general }, projet: { ...projetParDefaut(), ...c.projet }, notes: `Indices relevés dans l'annonce ${NOMS_SITES[a.site]}.` })
        : undefined;
      const q = new URLSearchParams();
      const p: Record<string, string | number | null | undefined> = {
        lon: point.lon, lat: point.lat, insee: lieu.codeInsee,
        label: exacte ? precise!.label : `${a.titre ? `${a.titre.slice(0, 60)} · ` : ""}${lieu.commune}`,
        type: a.type ?? "Maison", surface: a.surface, prix: a.prix, terrain: a.terrain, dpe: a.dpe, pieces: a.pieces,
        approx: exacte ? undefined : 1, travaux,
      };
      for (const [k, v] of Object.entries(p)) if (v != null && v !== "") q.set(k, String(v));
      router.push(`/bien?${q}`);
    } finally {
      setCharge(false);
    }
  }

  async function copierPourClaude() {
    const t = [
      `Annonce ${NOMS_SITES[a.site]}${a.url ? ` : ${a.url}` : ""}`,
      a.titre ?? "",
      a.photos.length ? `Photos :\n${a.photos.join("\n")}` : "",
      "Regarde les photos, identifie chaque pièce et son état, puis propose une approche travaux avec l'outil proposer_travaux de MADRIMMO.",
    ].filter(Boolean).join("\n\n");
    try { await navigator.clipboard.writeText(t); setCopie(true); setTimeout(() => setCopie(false), 2500); } catch { setErr("Copie impossible : sélectionne et copie le lien à la main."); }
  }

  return (
    <div className="carte pile">
      <div className="entete">
        <h2>{NOMS_SITES[a.site]} · à vérifier avant l'analyse</h2>
        {a.url && <a href={a.url} target="_blank" rel="noreferrer" className="petit">Ouvrir l'annonce</a>}
      </div>
      {a.titre && <p><strong>{a.titre}</strong></p>}
      <div className="grille3">
        <label className="champ">
          Type de bien
          <select value={a.type ?? ""} onChange={(e) => maj({ type: (e.target.value || null) as TypeAnnonce | null })}>
            <option value="">À préciser</option><option>Maison</option><option>Appartement</option><option>Immeuble</option><option>Terrain</option><option>Local</option>
          </select>
        </label>
        <ChampNombre label="Prix affiché (€)" v={a.prix} set={(n) => maj({ prix: n })} source={a.sources.prix} />
        <ChampNombre label="Surface habitable" v={a.surface} set={(n) => maj({ surface: n })} suffixe="m²" source={a.sources.surface} />
        <ChampNombre label="Terrain" v={a.terrain} set={(n) => maj({ terrain: n })} suffixe="m²" source={a.sources.terrain} />
        <ChampNombre label="Pièces" v={a.pieces} set={(n) => maj({ pieces: n })} source={a.sources.pieces} />
        <label className="champ">
          DPE
          <select value={a.dpe ?? ""} onChange={(e) => maj({ dpe: e.target.value || null })}>
            <option value="">Inconnu</option>{"ABCDEFG".split("").map((l) => <option key={l}>{l}</option>)}
          </select>
        </label>
        <label className="champ">Ville{!a.ville && <span className="mauvais"> · manquante</span>}<input value={a.ville ?? ""} onChange={(e) => maj({ ville: e.target.value || null })} placeholder="ex. Narbonne" /></label>
        <label className="champ">Code postal<input value={a.codePostal ?? ""} onChange={(e) => maj({ codePostal: e.target.value || null })} placeholder="ex. 11100" inputMode="numeric" /></label>
        <label className="champ">Adresse précise (si connue)<input value={a.adresse ?? ""} onChange={(e) => maj({ adresse: e.target.value || null })} placeholder="ex. 50 rue de l'Ancien Courrier" /></label>
      </div>
      <p className="doux petit">
        {a.lat != null
          ? `Position donnée par l'annonce${a.positionApprochee ? " (approchée : le site floute l'emplacement exact)" : ""}. Une adresse précise la remplace.`
          : "Pas de position dans l'annonce : l'analyse se fait à l'adresse saisie, sinon au centre de la commune."}
      </p>
      {a.photos.length > 0 && (
        <div className="ligne" style={{ gap: 6, overflowX: "auto", flexWrap: "nowrap" }}>
          {a.photos.slice(0, 10).map((u) => <img key={u} src={u} alt="" referrerPolicy="no-referrer" loading="lazy" style={{ height: 84, borderRadius: 6, border: "1px solid var(--trait)" }} />)}
        </div>
      )}
      {a.description && (
        <details>
          <summary className="petit">Description de l'annonce</summary>
          <p className="petit doux" style={{ whiteSpace: "pre-line", marginTop: 8 }}>{a.description}</p>
        </details>
      )}
      {err && <p className="erreur">{err}</p>}
      <div className="ligne">
        <button className="btn principal" onClick={analyser} disabled={charge}>{charge ? "Localisation…" : "Analyser ce bien"}</button>
        <button className="btn" onClick={copierPourClaude}>{copie ? "Copié" : "Copier pour Claude (photos)"}</button>
      </div>
    </div>
  );
}
