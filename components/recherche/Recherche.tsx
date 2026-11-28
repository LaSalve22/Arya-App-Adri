"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Adresse, Commune } from "@/lib/sources/geo";
import Link from "next/link";
import type { AnnonceImportee } from "@/lib/annonce/extracteur";
import FicheAnnonce from "./FicheAnnonce";
import ZoneCommune from "./ZoneCommune";
import ImportCapture from "./ImportCapture";
import { NOMS_DEPARTEMENTS } from "@/lib/sources/occitanie";

type Onglet = "adresse" | "annonce" | "zone";

export default function Recherche({ titre = true }: { titre?: boolean }) {
  const [onglet, setOnglet] = useState<Onglet>("adresse");
  return (
    <div className="pile">
      {titre && <div>
        <h1>Analyser un bien</h1>
        <p className="doux">Adresse, parcelle ou annonce : MADRIMMO interroge en direct le cadastre, le PLU, les ventes DVF, Géorisques et les DPE, puis calcule ta rentabilité.</p>
      </div>}
      <div className="carte">
        <div className="onglets" role="tablist">
          {(
            [
              ["adresse", "Adresse ou parcelle"],
              ["annonce", "Coller une annonce"],
              ["zone", "Recherche par zone"],
            ] as [Onglet, string][]
          ).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={onglet === k} onClick={() => setOnglet(k)}>
              {l}
            </button>
          ))}
        </div>
        {onglet === "adresse" && <ParAdresse />}
        {onglet === "annonce" && <ParAnnonce />}
        {onglet === "zone" && <ZoneCommune />}
      </div>
    </div>
  );
}

function versFiche(router: ReturnType<typeof useRouter>, p: Record<string, string | number | null | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v != null && v !== "") q.set(k, String(v));
  router.push(`/bien?${q}`);
}

function ChampsBien({ type, setType, surface, setSurface, prix, setPrix }: {
  type: string; setType: (v: string) => void; surface: string; setSurface: (v: string) => void; prix: string; setPrix: (v: string) => void;
}) {
  return (
    <div className="grille3">
      <label className="champ">
        Type de bien
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option>Maison</option>
          <option>Appartement</option>
          <option>Terrain</option>
          <option value="Immeuble">Immeuble (comparables : appartements)</option>
        </select>
      </label>
      <label className="champ">
        Surface (m²)
        <input type="number" value={surface} onChange={(e) => setSurface(e.target.value)} placeholder="ex. 120" />
      </label>
      <label className="champ">
        Prix affiché (€)
        <input type="number" value={prix} onChange={(e) => setPrix(e.target.value)} placeholder="ex. 350000" />
      </label>
    </div>
  );
}

function ParAdresse() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Adresse[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [type, setType] = useState("Maison");
  const [surface, setSurface] = useState("");
  const [prix, setPrix] = useState("");
  const [mode, setMode] = useState<"adresse" | "parcelle">("adresse");
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [communeQ, setCommuneQ] = useState("");
  const [insee, setInsee] = useState("");
  const [section, setSection] = useState("");
  const [numero, setNumero] = useState("");
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(t.current);
    if (q.trim().length < 3) { setRes([]); return; }
    t.current = setTimeout(async () => {
      const r = await fetch(`/api/adresse?q=${encodeURIComponent(q)}`);
      const d = await r.json();
      if (!r.ok) { setErr(d.erreur); return; }
      setErr(null);
      setRes(d);
    }, 250);
  }, [q]);

  useEffect(() => {
    if (mode === "parcelle" && !communes.length) fetch("/api/communes").then((r) => r.json()).then(setCommunes).catch(() => {});
  }, [mode, communes.length]);

  const filtrees = useMemo(() => {
    const s = communeQ.trim().toLowerCase();
    if (s.length < 2) return [];
    return communes.filter((c) => c.nom.toLowerCase().startsWith(s) || c.codesPostaux.some((cp) => cp.startsWith(s))).slice(0, 8);
  }, [communeQ, communes]);

  const extra = { type, surface, prix };
  return (
    <div className="pile">
      <div className="ligne">
        <label className="ligne"><input type="radio" checked={mode === "adresse"} onChange={() => setMode("adresse")} /> Par adresse</label>
        <label className="ligne"><input type="radio" checked={mode === "parcelle"} onChange={() => setMode("parcelle")} /> Par référence cadastrale</label>
      </div>
      <ChampsBien type={type} setType={setType} surface={surface} setSurface={setSurface} prix={prix} setPrix={setPrix} />
      {mode === "adresse" ? (
        <div>
          <input id="adresse" style={{ width: "100%" }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="ex. 12 rue de la Loge, Montpellier" autoComplete="off" />
          {err && <p className="erreur">{err}</p>}
          {res.length > 0 && (
            <div className="suggestions">
              {res.map((a) => (
                <button key={a.label + a.lon} onClick={() => versFiche(router, { lon: a.lon, lat: a.lat, label: a.label, insee: a.codeInsee, ...extra })}>
                  {a.label} <span className="doux petit">· {NOMS_DEPARTEMENTS[a.codeInsee.slice(0, 2)]}</span>
                </button>
              ))}
            </div>
          )}
          {q.length >= 3 && res.length === 0 && !err && <p className="doux petit">Aucune adresse trouvée en Occitanie.</p>}
        </div>
      ) : (
        <div className="grille3">
          <label className="champ">
            Commune
            <input value={communeQ} onChange={(e) => { setCommuneQ(e.target.value); setInsee(""); }} placeholder="ex. Montpellier" />
            {filtrees.length > 0 && !insee && (
              <div className="suggestions">
                {filtrees.map((c) => (
                  <button key={c.code} onClick={() => { setInsee(c.code); setCommuneQ(`${c.nom} (${c.codesPostaux[0]})`); }}>
                    {c.nom} <span className="doux petit">{c.codesPostaux[0]}</span>
                  </button>
                ))}
              </div>
            )}
          </label>
          <label className="champ">Section<input value={section} onChange={(e) => setSection(e.target.value)} placeholder="ex. HT" /></label>
          <label className="champ">Numéro<input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="ex. 7" /></label>
          <button className="btn principal" disabled={!insee || !section || !numero} onClick={() => versFiche(router, { insee, section, numero, ...extra })}>
            Ouvrir la parcelle
          </button>
        </div>
      )}
    </div>
  );
}

function ParAnnonce() {
  const [texte, setTexte] = useState("");
  const [res, setRes] = useState<{ annonce: AnnonceImportee; guide?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [charge, setCharge] = useState(false);

  async function analyser() {
    setCharge(true);
    setErr(null);
    setRes(null);
    const r = await fetch("/api/annonce", { method: "POST", body: JSON.stringify({ texte }) });
    const d = await r.json();
    setCharge(false);
    if (!r.ok) return setErr(d.erreur);
    setRes(d);
  }

  return (
    <div className="pile">
      <div className="alerte petit">
        Le plus fiable : le bouton <strong>« Envoyer à MADRIMMO »</strong>, à installer une fois dans les favoris du navigateur. Il lit l'annonce
        complète directement sur Leboncoin, SeLoger, Bien'ici, PAP ou un site d'agence. <Link href="/importer">L'installer</Link>
      </div>
      <ImportCapture onTexte={(t) => setTexte((avant) => (avant.trim() ? `${avant}\n\n${t}` : t))} />
      <textarea value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Colle le lien de l'annonce, ou son texte (titre, prix, lieu, critères, description)." />
      <div className="ligne">
        <button className="btn principal" onClick={analyser} disabled={!texte.trim() || charge}>{charge ? "Lecture…" : "Lire l'annonce"}</button>
        <span className="doux petit">Chaque valeur reste modifiable avant l'analyse.</span>
      </div>
      {err && <p className="erreur">{err}</p>}
      {res?.guide && (
        <div className="alerte pile" style={{ gap: 8 }}>
          <p>{res.guide}</p>
          <div className="ligne">
            {res.annonce.url && <a className="btn" href={res.annonce.url} target="_blank" rel="noreferrer">Ouvrir l'annonce</a>}
            <Link className="btn" href="/importer">Installer le favori</Link>
          </div>
        </div>
      )}
      {res && <FicheAnnonce key={JSON.stringify(res.annonce).length + (res.annonce.url ?? "")} initiale={res.annonce} />}
    </div>
  );
}
