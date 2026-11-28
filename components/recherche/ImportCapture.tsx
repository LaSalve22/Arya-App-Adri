"use client";
import { useRef, useState } from "react";

/**
 * Lit le texte de captures d'écran d'annonces directement dans le navigateur (Tesseract, français).
 * Aucune image n'est envoyée sur internet ; les fichiers OCR sont servis depuis /ocr (copiés à l'installation).
 */
export default function ImportCapture({ onTexte }: { onTexte: (texte: string) => void }) {
  const entree = useRef<HTMLInputElement>(null);
  const [etat, setEtat] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function lire(fichiers: FileList | null) {
    if (!fichiers?.length) return;
    setErreur(null);
    const liste = Array.from(fichiers);
    try {
      setEtat("Chargement du lecteur de texte…");
      const { createWorker } = await import("tesseract.js");
      let courant = 0;
      const worker = await createWorker("fra", 1, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr",
        langPath: "/ocr",
        gzip: true,
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") setEtat(`Lecture de la capture ${courant + 1}/${liste.length}… ${Math.round(m.progress * 100)} %`);
        },
      });
      const textes: string[] = [];
      for (courant = 0; courant < liste.length; courant++) {
        const { data } = await worker.recognize(liste[courant]);
        textes.push(data.text.trim());
      }
      await worker.terminate();
      onTexte(textes.join("\n\n"));
      setEtat(null);
    } catch (e) {
      console.error(e);
      setEtat(null);
      setErreur("Lecture impossible. Essaie une capture plus nette (texte bien visible, sans zoom), ou colle le texte.");
    } finally {
      if (entree.current) entree.current.value = "";
    }
  }

  return (
    <div className="ligne">
      <input ref={entree} type="file" accept="image/*" multiple hidden onChange={(e) => lire(e.target.files)} aria-label="Captures d'écran d'annonce" />
      <button type="button" className="btn" onClick={() => entree.current?.click()} disabled={!!etat}>
        {etat ?? "Importer des captures d'écran"}
      </button>
      <span className="doux petit">{etat ? "" : "Une ou plusieurs captures de l'annonce : le texte est lu sur ton appareil, puis tu peux le corriger."}</span>
      {erreur && <p className="erreur" style={{ width: "100%" }}>{erreur}</p>}
    </div>
  );
}
