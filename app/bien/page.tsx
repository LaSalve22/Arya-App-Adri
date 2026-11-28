"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Bilan from "@/components/Bilan";
import ComparatifRP from "@/components/ComparatifRP";
import Recherche from "@/components/recherche/Recherche";
import Nature from "@/components/onglets/Nature";
import Marche from "@/components/onglets/Marche";
import Similaires from "@/components/onglets/Similaires";
import Profil from "@/components/onglets/Profil";
import Financement from "@/components/onglets/Financement";
import FraisFinanciers from "@/components/onglets/FraisFinanciers";
import { CoutsTechniquesOnglet, FraisVenteOnglet } from "@/components/onglets/Couts";
import Recap from "@/components/onglets/Recap";
import Travaux, { appliquerPlan } from "@/components/onglets/Travaux";
import { completerPlan, decoderPlan } from "@/lib/travaux/lien";
import { Bandeau } from "@/components/onglets/ui";
import type { Comps, Fiche, PropsOnglet } from "@/components/onglets/types";
import { etatParDefaut, synchroniserPourcentages, type EtatAnalyse } from "@/lib/etat";
import { analyser } from "@/lib/analyse";
import { profilParDefaut } from "@/lib/bilan/profil";
import { completerOptionsRP } from "@/lib/bilan/residence";
import type { Lot } from "@/lib/bilan/types";
import { enregistrerProjet, lireProjet, nouvelId, type Projet } from "@/lib/projets";

const ONGLETS = [
  ["recherche", "Recherche"],
  ["bien", "Nature du bien"],
  ["marche", "Ventes DVF et DPE"],
  ["similaires", "Biens similaires vendus"],
  ["profil", "Profil MdB"],
  ["rp", "Résidence principale"],
  ["comparatif", "Comparatif"],
  ["bp", "BP avec travaux"],
  ["travaux", "Travaux"],
  ["frais-financiers", "Frais financiers"],
  ["financement", "Mode de financement"],
  ["couts", "Coûts techniques"],
  ["vente", "Frais de vente"],
  ["recap", "Récapitulatif"],
] as const;
type Onglet = (typeof ONGLETS)[number][0];
const AVEC_BANDEAU: Onglet[] = ["bien", "marche", "similaires", "travaux", "profil", "rp", "comparatif", "frais-financiers", "financement", "couts", "vente"];

export default function Page() {
  return (
    <Suspense fallback={<p className="chargement">Chargement…</p>}>
      <Analyse />
    </Suspense>
  );
}

function Analyse() {
  const sp = useSearchParams();
  const router = useRouter();
  const cle = sp.toString();
  const projetId = sp.get("projet");
  const [onglet, setOnglet] = useState<Onglet>("bien");
  const [projet, setProjet] = useState<Projet | null>(null);
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [comps, setComps] = useState<Comps | null>(null);
  const [etat, setEtatBrut] = useState<EtatAnalyse | null>(null);
  // Chaque modification recalcule les coûts saisis en % des travaux.
  const setEtat = useCallback((e: EtatAnalyse) => setEtatBrut(synchroniserPourcentages(e)), []);
  const [message, setMessage] = useState<string | null>(null);

  // Onglet actif dans l'adresse (#financement…), pour pouvoir partager un lien direct.
  useEffect(() => {
    const lire = () => {
      const h = window.location.hash.slice(1) as Onglet;
      if (ONGLETS.some(([k]) => k === h)) setOnglet(h);
    };
    lire();
    window.addEventListener("hashchange", lire);
    return () => window.removeEventListener("hashchange", lire);
  }, []);
  const aller = (o: Onglet) => {
    setOnglet(o);
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${o}`);
    window.scrollTo({ top: 0 });
  };

  // Initialisation à partir de l'URL ou d'un projet enregistré
  useEffect(() => {
    setFiche(null);
    setComps(null);
    setErr(null);
    setMessage(null);
    const p = projetId ? lireProjet(projetId) : null;
    setProjet(p);
    const base = etatParDefaut();
    if (p) {
      setEtat({
        ...base,
        hypotheses: { ...base.hypotheses, ...p.hypotheses, financement: { ...base.hypotheses.financement, ...p.hypotheses.financement } },
        prixAffiche: p.prixAffiche,
        margeCible: p.margeCible,
        historique: p.historique,
        rp: completerOptionsRP(p.rp),
        profil: p.profil ?? profilParDefaut(),
        caracteristiques: p.caracteristiques ?? { ...base.caracteristiques, type: p.typeBien, surface: p.surface },
        coutsTechniques: p.coutsTechniques ?? base.coutsTechniques,
        travauxPlan: completerPlan(p.travauxPlan),
        coutsPct: p.coutsPct,
      });
    } else {
      const h = base.hypotheses;
      const prix = Number(sp.get("prix")) || 0;
      const surface = Number(sp.get("surface")) || null;
      const terrain = Number(sp.get("terrain")) || null;
      h.prixAcquisition = prix;
      if (surface) {
        h.travaux.surfaceCarrez = surface;
        h.travaux.surfaceTotale = terrain || surface;
      }
      h.lots = [{ libelle: "Revente", surface: surface ?? undefined, prixDown: null, prixTop: null, tva: 0 }];
      const initial: EtatAnalyse = {
        ...base,
        hypotheses: h,
        prixAffiche: prix,
        caracteristiques: {
          ...base.caracteristiques,
          type: sp.get("type") ?? "Maison",
          surface,
          terrain,
          pieces: Number(sp.get("pieces")) || null,
          dpe: sp.get("dpe") ?? "",
        },
      };
      // Plan travaux transmis par Claude (connecteur) : reporté directement dans le bilan.
      const plan = sp.get("travaux") ? decoderPlan(sp.get("travaux")!) : null;
      setEtat(plan ? appliquerPlan(initial, plan) : initial);
      if (plan?.mode === "detail") setOnglet("travaux");
    }
    const q = new URLSearchParams();
    for (const k of ["lon", "lat", "idu", "insee", "section", "numero"]) {
      const v = p ? ({ lon: p.lon, lat: p.lat, insee: p.codeInsee } as Record<string, unknown>)[k] : sp.get(k);
      if (v != null && v !== "") q.set(k, String(v));
    }
    if (!q.toString()) return;
    fetch(`/api/bien?${q}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.erreur);
        setFiche(d);
      })
      .catch((e) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);

  // Comparables DVF du bien (type et surface des caractéristiques)
  const typeComp = etat ? (etat.caracteristiques.type === "Immeuble" ? "Appartement" : etat.caracteristiques.type) : "Maison";
  const surfaceComp = etat?.caracteristiques.type === "Immeuble" ? null : etat?.caracteristiques.surface ?? null;
  useEffect(() => {
    if (!fiche?.codeInsee) return;
    const q = new URLSearchParams({ insee: fiche.codeInsee, lon: String(fiche.lon), lat: String(fiche.lat), type: typeComp });
    if (surfaceComp && typeComp !== "Terrain") q.set("surface", String(surfaceComp));
    fetch(`/api/dvf/comparables?${q}`)
      .then(async (r) => {
        const d = await r.json();
        if (r.ok) setComps(d);
      })
      .catch(() => {});
  }, [fiche, typeComp, surfaceComp]);

  const prefill = useCallback((): Lot[] | null => {
    if (!comps?.stats.nb || !etat) return null;
    return etat.hypotheses.lots.map((l) => {
      const s = l.surface || surfaceComp || 0;
      if (!s) return l;
      return { ...l, surface: s, prixDown: Math.round((comps.stats.p25 * s) / 1000) * 1000, prixTop: Math.round((comps.stats.p75 * s) / 1000) * 1000 };
    });
  }, [comps, etat, surfaceComp]);

  // Pré-remplissage de la revente dès l'arrivée des comparables, si rien n'est saisi.
  useEffect(() => {
    if (!etat || projet || !comps?.stats.nb) return;
    if (etat.hypotheses.lots.some((l) => l.prixDown != null || l.prixTop != null)) return;
    const lots = prefill();
    if (lots) setEtat({ ...etat, hypotheses: { ...etat.hypotheses, lots } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comps]);

  const a = useMemo(() => (etat ? analyser(etat) : null), [etat]);
  const sansBien = !projetId && !sp.get("lon") && !sp.get("idu") && !sp.get("section");
  const libelle =
    projet?.adresse ?? sp.get("label") ?? (fiche?.parcelle.ok && fiche.parcelle.data ? `Parcelle ${fiche.parcelle.data.section} ${fiche.parcelle.data.numero}, ${fiche.parcelle.data.commune}` : "Bien");

  function sauvegarder() {
    if (!etat || !fiche) return;
    const p: Projet = {
      id: projet?.id ?? nouvelId(),
      titre: projet?.titre ?? libelle,
      adresse: libelle,
      lon: fiche.lon,
      lat: fiche.lat,
      codeInsee: fiche.codeInsee,
      typeBien: etat.caracteristiques.type,
      surface: etat.caracteristiques.surface,
      prixAffiche: etat.prixAffiche,
      margeCible: etat.margeCible,
      hypotheses: etat.hypotheses,
      historique: etat.historique,
      rp: etat.rp,
      profil: etat.profil,
      caracteristiques: etat.caracteristiques,
      coutsTechniques: etat.coutsTechniques,
      travauxPlan: etat.travauxPlan,
      coutsPct: etat.coutsPct,
      creeLe: projet?.creeLe ?? new Date().toISOString(),
      majLe: new Date().toISOString(),
    };
    enregistrerProjet(p);
    setProjet(p);
    setMessage("Projet enregistré.");
    if (!projetId) router.replace(`/bien?projet=${p.id}#${onglet}`);
  }

  const props: PropsOnglet | null = etat && a ? { etat, setEtat, a, fiche, comps, libelle } : null;

  return (
    <div className="pile">
      <div className="entete">
        <div>
          <h1>{sansBien ? "Nouvelle analyse" : libelle}</h1>
          {sp.get("approx") && <p className="alerte">Adresse exacte inconnue : l'analyse se fait au centre de la commune.</p>}
        </div>
        {!sansBien && (
          <div className="ligne">
            {message && <span className="puce bon">{message}</span>}
            <button className="btn principal" onClick={sauvegarder} disabled={!etat || !fiche}>{projet ? "Mettre à jour le projet" : "Enregistrer en projet"}</button>
          </div>
        )}
      </div>

      <div className="analyse">
        <nav className="barre-onglets" role="tablist" aria-label="Étapes de l'analyse">
          {ONGLETS.map(([k, l], i) => (
            <button key={k} role="tab" aria-selected={onglet === k} onClick={() => aller(k)}><span className="etape">{String(i + 1).padStart(2, "0")}</span>{l}</button>
          ))}
        </nav>

        <div className="pile contenu">
          {err && <p className="erreur">{err}</p>}
          {props && AVEC_BANDEAU.includes(onglet) && <Bandeau a={props.a} margeCible={props.etat.margeCible} etat={props.etat} setEtat={setEtat} />}

          {onglet === "recherche" && <div className="carte"><Recherche titre={false} /></div>}
          {sansBien && onglet !== "recherche" && <p className="alerte">Choisis d'abord un bien dans l'onglet « Recherche ».</p>}
          {props && !sansBien && (
            <>
              {onglet === "bien" && <Nature {...props} />}
              {onglet === "marche" && <Marche {...props} />}
              {onglet === "similaires" && <Similaires {...props} />}
              {onglet === "profil" && <Profil {...props} />}
              {onglet === "rp" && <ComparatifRP h={props.etat.hypotheses} rp={props.etat.rp} setRp={(rp) => setEtat({ ...props.etat, rp })} mode="params" />}
              {onglet === "comparatif" && (
                <ComparatifRP h={props.etat.hypotheses} rp={props.etat.rp} setRp={(rp) => setEtat({ ...props.etat, rp })} mode="tableau" netAssocies={props.a.sortie.distribue ? props.a.sortie.netAssocies : null} />
              )}
              {onglet === "bp" && <Bilan etat={props.etat} setEtat={setEtat} prefillDVF={prefill} />}
              {onglet === "travaux" && <Travaux {...props} />}
              {onglet === "frais-financiers" && <FraisFinanciers {...props} />}
              {onglet === "financement" && <Financement {...props} />}
              {onglet === "couts" && <CoutsTechniquesOnglet {...props} />}
              {onglet === "vente" && <FraisVenteOnglet {...props} />}
              {onglet === "recap" && <Recap {...props} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
