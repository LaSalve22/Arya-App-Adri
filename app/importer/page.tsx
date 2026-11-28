"use client";
// Import d'une annonce : depuis le favori « Envoyer à MADRIMMO » (#d=…), le partage d'une appli
// (?titre=&texte=&url=), ou un lien. Affiche la fiche de vérification et la notice d'installation du favori.
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import FicheAnnonce from "@/components/recherche/FicheAnnonce";
import { decoderBrut, extraireAnnonce, type AnnonceImportee } from "@/lib/annonce/extracteur";
import { codeFavori } from "@/lib/annonce/favori";

export default function Page() {
  return (
    <Suspense fallback={<p className="chargement">Chargement…</p>}>
      <Importer />
    </Suspense>
  );
}

function Importer() {
  const sp = useSearchParams();
  const [annonce, setAnnonce] = useState<AnnonceImportee | null>(null);
  const [guide, setGuide] = useState<string | null>(null);
  const [lien, setLien] = useState<string | null>(null);
  const [charge, setCharge] = useState(false);

  useEffect(() => {
    // 1. Favori : données dans l'ancre, jamais envoyées au serveur
    const d = new URLSearchParams(window.location.hash.slice(1)).get("d");
    if (d) {
      const brut = decoderBrut(d);
      if (brut) { setAnnonce(extraireAnnonce(brut)); return; }
    }
    // 2. Partage depuis une appli (Android) ou lien : texte partagé + éventuelle lecture du lien côté serveur
    const titre = sp.get("titre") ?? "";
    const texte = sp.get("texte") ?? "";
    const url = sp.get("url") ?? (texte.match(/https?:\/\/\S+/)?.[0] ?? null);
    if (!titre && !texte && !url) return;
    setLien(url);
    setCharge(true);
    fetch("/api/annonce", { method: "POST", body: JSON.stringify({ texte: [titre, texte, url].filter(Boolean).join("\n") }) })
      .then((r) => r.json())
      .then((x: { annonce?: AnnonceImportee; guide?: string }) => { if (x.annonce) setAnnonce(x.annonce); if (x.guide) setGuide(x.guide); })
      .finally(() => setCharge(false));
  }, [sp]);

  return (
    <div className="pile">
      <div className="entete"><h1>Importer une annonce</h1><span className="doux petit">Leboncoin, SeLoger, Bien'ici, PAP, sites d'agences</span></div>
      {charge && <p className="chargement">Lecture de l'annonce…</p>}
      {guide && (
        <div className="alerte pile" style={{ gap: 8 }}>
          <p>{guide}</p>
          {lien && <div><a className="btn" href={lien} target="_blank" rel="noreferrer">Ouvrir l'annonce</a></div>}
        </div>
      )}
      {annonce && <FicheAnnonce key={annonce.url ?? annonce.titre ?? "annonce"} initiale={annonce} />}
      <Installation />
    </div>
  );
}

function Installation() {
  const lienRef = useRef<HTMLAnchorElement>(null);
  const [code, setCode] = useState("");
  const [copie, setCopie] = useState(false);
  useEffect(() => {
    const c = codeFavori(window.location.origin);
    setCode(c);
    // React bloque les liens « javascript: » écrits dans le JSX : l'adresse du favori est posée directement.
    lienRef.current?.setAttribute("href", c);
  }, []);
  async function copier() {
    try { await navigator.clipboard.writeText(code); setCopie(true); setTimeout(() => setCopie(false), 2500); } catch { /* copie manuelle */ }
  }
  return (
    <div className="carte pile">
      <div className="entete"><h2>Le bouton « Envoyer à MADRIMMO »</h2><span className="doux petit">À installer une fois par navigateur</span></div>
      <p>
        Les sites d'annonces bloquent la lecture automatique depuis un serveur. Ce bouton, rangé dans tes favoris, lit l'annonce
        <strong> dans ton propre navigateur</strong>, là où elle est affichée (prix, surface, pièces, DPE, ville, position, description, photos),
        puis l'ouvre ici, prête à analyser. Rien ne passe par un serveur.
      </p>
      <div className="ligne">
        <a ref={lienRef} className="btn principal" href="#" onClick={(e) => e.preventDefault()} draggable>Envoyer à MADRIMMO</a>
        <button type="button" className="btn" onClick={copier} disabled={!code}>{copie ? "Code copié" : "Copier le code du favori"}</button>
      </div>
      <div className="grille3">
        <div className="pile" style={{ gap: 6 }}>
          <h3>Sur ordinateur</h3>
          <p className="petit">Afficher la barre de favoris (Ctrl+Maj+B, ou Cmd+Maj+B sur Mac), puis <strong>glisser le bouton blanc</strong> ci-dessus dedans. Sur une annonce, cliquer sur le favori.</p>
        </div>
        <div className="pile" style={{ gap: 6 }}>
          <h3>Sur iPhone (Safari)</h3>
          <ol className="petit" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
            <li>Toucher « Copier le code du favori ».</li>
            <li>Ajouter cette page aux favoris (Partager → Ajouter un signet), nommé « Envoyer à MADRIMMO ».</li>
            <li>Ouvrir les signets, Modifier, choisir ce signet et remplacer son adresse par le code copié.</li>
            <li>Sur une annonce ouverte dans Safari : signets → « Envoyer à MADRIMMO ».</li>
          </ol>
        </div>
        <div className="pile" style={{ gap: 6 }}>
          <h3>Sur Android (Chrome)</h3>
          <ol className="petit" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
            <li>Copier le code, ajouter cette page aux favoris, puis modifier le favori : nom « MADRIMMO », adresse = le code.</li>
            <li>Sur une annonce : taper « MADRIMMO » dans la barre d'adresse et toucher le favori proposé.</li>
            <li>Encore plus simple : dans l'appli Leboncoin, SeLoger ou Bien'ici, <strong>Partager → MADRIMMO</strong> (appli MADRIMMO installée sur l'écran d'accueil).</li>
          </ol>
        </div>
      </div>
      <p className="doux petit">Depuis l'appli Leboncoin sur iPhone : Partager → « Ouvrir dans le navigateur » (ou copier le lien et l'ouvrir dans Safari), puis le favori.</p>
    </div>
  );
}
