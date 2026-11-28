"use client";
// Dictée vocale gratuite : reconnaissance vocale du navigateur (Chrome, Safari, iPhone), en français.
import { useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Reco = any;
const constructeur = (): (new () => Reco) | null =>
  typeof window === "undefined" ? null : ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null);

export function dicteeDisponible() {
  return !!constructeur();
}

/**
 * Bouton micro. Le texte reconnu est envoyé à `surTexte` à chaque phrase terminée ;
 * `surFin` reçoit tout le texte dicté quand l'utilisateur arrête.
 */
export default function Dictee({ surTexte, surFin, libelle = "Dicter" }: { surTexte?: (t: string) => void; surFin?: (t: string) => void; libelle?: string }) {
  const [dispo, setDispo] = useState<boolean | null>(null);
  const [actif, setActif] = useState(false);
  const [provisoire, setProvisoire] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const reco = useRef<Reco>(null);
  const tout = useRef("");
  // Les rappels changent à chaque rendu : la reconnaissance, démarrée une fois, lit toujours les derniers.
  const rappels = useRef({ surTexte, surFin });
  rappels.current = { surTexte, surFin };

  useEffect(() => setDispo(dicteeDisponible()), []);
  useEffect(() => () => reco.current?.abort?.(), []);

  function demarrer() {
    const C = constructeur();
    if (!C) return;
    const r: Reco = new C();
    r.lang = "fr-FR";
    r.continuous = true;
    r.interimResults = true;
    tout.current = "";
    r.onresult = (e: any) => {
      let inter = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          tout.current = `${tout.current} ${t}`.trim();
          rappels.current.surTexte?.(t.trim());
        } else inter += t;
      }
      setProvisoire(inter);
    };
    r.onerror = (e: any) => {
      setErreur(e.error === "not-allowed" ? "Micro refusé : autorise le micro pour ce site dans le navigateur." : e.error === "no-speech" ? "Rien entendu, réessaie." : `Dictée interrompue (${e.error}).`);
    };
    r.onend = () => {
      setActif(false);
      setProvisoire("");
      if (tout.current) rappels.current.surFin?.(tout.current);
    };
    setErreur(null);
    reco.current = r;
    r.start();
    setActif(true);
  }

  function arreter() {
    reco.current?.stop();
  }

  if (dispo === null) return null;
  if (!dispo) {
    return <p className="doux petit">Dictée non disponible dans ce navigateur : utilise le micro du clavier de ton téléphone pour dicter dans le champ de texte.</p>;
  }
  return (
    <div className="pile" style={{ gap: 6 }}>
      <div className="ligne">
        <button type="button" className={`btn ${actif ? "" : "principal"} dictee`} onClick={actif ? arreter : demarrer} aria-pressed={actif}>
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><path d="M12 17v5" />
          </svg>
          {actif ? "Arrêter la dictée" : libelle}
        </button>
        {actif && <span className="puce enregistre">● J'écoute…</span>}
      </div>
      {provisoire && <p className="doux petit" aria-live="polite">{provisoire}</p>}
      {erreur && <p className="erreur petit">{erreur}</p>}
    </div>
  );
}
