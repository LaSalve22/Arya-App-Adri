// Rapport PDF d'une analyse, à destination d'une banque ou d'investisseurs.
// Chargé uniquement au clic sur « Télécharger le PDF » (@react-pdf/renderer est volumineux).
import { Document, Font, Line, Page, Path, Polyline, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { TRACE_MONOGRAMME } from "@/components/Logo";
import { NATURES_LOT, parUnite } from "@/lib/dvfLots";
import { FORFAITS, LIBELLES_ETATS, LIBELLES_PIECES, chiffrer } from "@/lib/travaux/plan";
import { LIBELLES_GAMME } from "@/lib/travaux/catalogue";
import { demarchesDuBien, LIBELLES_INTERLOCUTEURS } from "@/lib/travaux/demarches";
import type { Analyse } from "@/lib/analyse";
import type { EtatAnalyse } from "@/lib/etat";
import { LIBELLES_FORMES } from "@/lib/bilan/profil";
import { LIBELLES_SOURCES } from "@/lib/bilan/financement";
import type { Comps, Fiche } from "@/components/onglets/types";

// La police standard du PDF ne connaît pas les espaces fines insécables utilisées par Intl en français.
const esp = (s: string) => s.replace(/[  ]/g, " ");
const eur = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "-" : esp(new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v)) + " €");
const pct = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? "-" : esp((v * 100).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d })) + " %");
const m2 = (v: number | null | undefined) => (v == null || !v ? "-" : esp(Math.round(v).toLocaleString("fr-FR")) + " €/m²");

// Polices de la charte, servies par l'appli (public/fonts).
const origine = typeof window !== "undefined" ? window.location.origin : "";
Font.register({ family: "Inter", src: `${origine}/fonts/inter-latin-400-normal.woff` });
Font.register({ family: "InterGras", src: `${origine}/fonts/inter-latin-600-normal.woff` });
Font.register({ family: "Cormorant", src: `${origine}/fonts/cormorant-garamond-latin-500-normal.woff` });
Font.register({ family: "CormorantGras", src: `${origine}/fonts/cormorant-garamond-latin-600-normal.woff` });
Font.registerHyphenationCallback((mot) => [mot]);

const BLEU = "#000000";
const OR = "#7a7a7a";
const GRIS = "#6b6b6b";
const TRAIT = "#e0e0e0";

const s = StyleSheet.create({
  page: { padding: 36, paddingBottom: 48, fontSize: 9.5, fontFamily: "Inter", color: BLEU, lineHeight: 1.35 },
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderBottomWidth: 2, borderBottomColor: BLEU, paddingBottom: 6, marginBottom: 14 },
  logo: { flexDirection: "row", alignItems: "center", gap: 7 },
  logoNom: { fontSize: 14, fontFamily: "CormorantGras", letterSpacing: 2.2 },
  petit: { fontSize: 8, color: GRIS },
  h1: { fontSize: 19, fontFamily: "Cormorant", fontFeatureSettings: ["lnum"], lineHeight: 1.25, marginBottom: 6 },
  h2: { fontSize: 11.5, fontFamily: "InterGras", marginTop: 12, marginBottom: 6, color: BLEU },
  ligne: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: TRAIT },
  total: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderTopWidth: 1.2, borderTopColor: BLEU, fontFamily: "InterGras" },
  kpis: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  kpi: { width: "33.33%", padding: 4 },
  kpiBox: { borderWidth: 0.8, borderColor: TRAIT, borderRadius: 4, padding: 7 },
  kpiV: { fontSize: 12.5, fontFamily: "InterGras" },
  verdict: { padding: 9, borderRadius: 4, marginVertical: 8 },
  deux: { flexDirection: "row", gap: 14 },
  col: { flex: 1 },
  th: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BLEU, paddingBottom: 3, fontFamily: "InterGras", fontSize: 8.5 },
  tr: { flexDirection: "row", paddingVertical: 2.5, borderBottomWidth: 0.5, borderBottomColor: TRAIT, fontSize: 8.5 },
  pied: { position: "absolute", bottom: 20, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: GRIS },
});

function L({ l, v, gras }: { l: string; v: string; gras?: boolean }) {
  return <View style={gras ? s.total : s.ligne}><Text>{l}</Text><Text>{v}</Text></View>;
}

function Entete({ titre }: { titre: string }) {
  return (
    <View style={s.entete} fixed>
      <View style={s.logo}>
        <Svg width={20} height={15.6} viewBox="0 0 205 160">
          <Polyline points={TRACE_MONOGRAMME} fill="none" stroke={BLEU} strokeWidth={17} strokeLinejoin="miter" strokeLinecap="square" />
        </Svg>
        <Text style={s.logoNom}>MADRIMMO</Text>
      </View>
      <Text style={s.petit}>{titre}</Text>
    </View>
  );
}

// Cachet officiel de la charte : monogramme dans un double filet, nom dessous.
function Cachet({ largeur }: { largeur: number }) {
  return (
    <Svg width={largeur} height={(largeur * 340) / 280} viewBox="0 0 280 340">
      <Rect x={2} y={2} width={276} height={336} fill="none" stroke={BLEU} strokeWidth={3} />
      <Rect x={13} y={13} width={254} height={314} fill="none" stroke={BLEU} strokeWidth={1.2} />
      <Polyline points="58,200 58,80 113,160 168,80 223,200" fill="none" stroke={BLEU} strokeWidth={11} strokeLinejoin="miter" strokeLinecap="square" />
      <Line x1={60} y1={250} x2={220} y2={250} stroke={BLEU} strokeWidth={1.2} />
    </Svg>
  );
}

/** Format du rapport : portrait A4 (smartphone, impression) ou paysage 16/9 (PC, écran, vidéoprojection). */
export type FormatPDF = "portrait" | "paysage";
const TAILLE_PAYSAGE: [number, number] = [960, 540];
const pagePaysage = { paddingTop: 26, paddingHorizontal: 40, paddingBottom: 40 };

function PageDeGarde({ libelle, sousTitre, format }: { libelle: string; sousTitre: string; format: FormatPDF }) {
  if (format === "paysage") {
    return (
      <Page size={TAILLE_PAYSAGE} style={[s.page, { flexDirection: "row", alignItems: "center", paddingHorizontal: 70, paddingVertical: 50, gap: 60 }]}>
        <View style={{ position: "relative" }}>
          <Cachet largeur={170} />
          <Text style={{ position: "absolute", left: 0, right: 0, top: 170 * (272 / 280), textAlign: "center", fontFamily: "CormorantGras", fontSize: 15, letterSpacing: 3.8 }}>MADRIMMO</Text>
        </View>
        <View style={{ flex: 1, gap: 10 }}>
          <Text style={{ fontSize: 8, letterSpacing: 2.4, color: GRIS }}>DOSSIER D'OPÉRATION</Text>
          <Text style={{ fontFamily: "Cormorant", fontFeatureSettings: ["lnum"], fontSize: 36, lineHeight: 1.2 }}>{libelle}</Text>
          <Text style={{ color: GRIS, fontSize: 11 }}>{sousTitre}</Text>
          <View style={{ marginTop: 30, borderTopWidth: 0.8, borderTopColor: TRAIT, paddingTop: 10, gap: 3 }}>
            <Text style={{ fontFamily: "Cormorant", fontSize: 14 }}>Marchand de biens · Occitanie</Text>
            <Text style={s.petit}>Établi le {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</Text>
          </View>
        </View>
      </Page>
    );
  }
  return (
    <Page size="A4" style={[s.page, { justifyContent: "space-between", alignItems: "center", paddingTop: 90, paddingBottom: 60 }]}>
      <View style={{ alignItems: "center" }}>
        <View style={{ position: "relative" }}>
          <Cachet largeur={150} />
          <Text style={{ position: "absolute", left: 0, right: 0, top: 150 * (272 / 280), textAlign: "center", fontFamily: "CormorantGras", fontSize: 13.5, letterSpacing: 3.4 }}>MADRIMMO</Text>
        </View>
      </View>
      <View style={{ alignItems: "center", gap: 10 }}>
        <Text style={{ fontSize: 8, letterSpacing: 2.4, color: GRIS }}>DOSSIER D'OPÉRATION</Text>
        <Text style={{ fontFamily: "Cormorant", fontFeatureSettings: ["lnum"], fontSize: 30, lineHeight: 1.25, textAlign: "center", maxWidth: 440, marginBottom: 4 }}>{libelle}</Text>
        <Text style={{ color: GRIS }}>{sousTitre}</Text>
      </View>
      <View style={{ alignItems: "center", gap: 4 }}>
        <Text style={{ fontFamily: "Cormorant", fontSize: 13 }}>Marchand de biens · Occitanie</Text>
        <Text style={s.petit}>Établi le {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</Text>
      </View>
    </Page>
  );
}

function Pied() {
  return (
    <View style={s.pied} fixed>
      <Text>Analyse indicative établie le {new Date().toLocaleDateString("fr-FR")} · ne constitue pas un conseil fiscal ou juridique</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function PlanParcelle({ fiche }: { fiche: Fiche | null }) {
  const g = fiche?.parcelle.ok ? fiche.parcelle.data?.geometrie : null;
  if (!g || !fiche) return null;
  const polys = (g.type === "MultiPolygon" ? g.coordinates : [g.coordinates]) as number[][][][];
  const k = Math.cos((fiche.lat * Math.PI) / 180);
  const pts = polys.flat(2);
  const xs = pts.map((c) => c[0] * k), ys = pts.map((c) => c[1]);
  const [minx, maxx, miny, maxy] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const W = 160, H = 120;
  const sc = Math.min((W - 10) / (maxx - minx || 1e-6), (H - 10) / (maxy - miny || 1e-6));
  const d = polys.map((p) => p.map((r) => "M" + r.map((c) => `${(5 + (c[0] * k - minx) * sc).toFixed(1)},${(5 + (maxy - c[1]) * sc).toFixed(1)}`).join("L") + "Z").join("")).join("");
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Path d={d} fill="#f2f2f2" stroke="#000000" strokeWidth={1.2} />
    </Svg>
  );
}

export default function RapportPDF({ etat, a, fiche, comps, libelle, inclureRP, vigilance, format = "portrait" }: {
  etat: EtatAnalyse; a: Analyse; fiche: Fiche | null; comps: Comps | null; libelle: string; inclureRP: boolean; vigilance: string[]; format?: FormatPDF;
}) {
  const paysage = format === "paysage";
  const taille = paysage ? TAILLE_PAYSAGE : "A4";
  const stylePage = paysage ? [s.page, pagePaysage] : s.page;
  const sensibiliteNego = a.sens.length > 0 ? (
    <>
                <Text style={s.h2}>Sensibilité à la négociation</Text>
                <View style={s.th}><Text style={{ width: "22%" }}>Remise</Text><Text style={{ width: "30%", textAlign: "right" }}>Prix</Text><Text style={{ width: "16%", textAlign: "right" }}>Bas</Text><Text style={{ width: "16%", textAlign: "right" }}>Moyen</Text><Text style={{ width: "16%", textAlign: "right" }}>Haut</Text></View>
                {a.sens.map((l) => (
                  <View key={l[0].remise} style={s.tr}>
                    <Text style={{ width: "22%" }}>- {pct(l[0].remise, 0)}</Text><Text style={{ width: "30%", textAlign: "right" }}>{eur(l[0].prix)}</Text>
                    {l.map((x) => <Text key={x.scenario} style={{ width: "16%", textAlign: "right" }}>{pct(x.margeSurCA)}</Text>)}
                  </View>
                ))}
              </>
  ) : null;
  const h = etat.hypotheses;
  const plan = etat.travauxPlan;
  const devis = chiffrer(plan.lignes, plan.gamme);
  const categoriesDevis = [...new Set(devis.map((x) => x.categorie))];
  const notesDemarches = demarchesDuBien(etat, a.r, fiche?.urbanisme.ok ? fiche.urbanisme.data.zone : null);
  const c = etat.caracteristiques;
  const r = a.r;
  const pa = fiche?.parcelle.ok ? fiche.parcelle.data : null;
  const zone = fiche?.urbanisme.ok ? fiche.urbanisme.data.zone : null;
  const risq = fiche?.risques.ok ? fiche.risques.data : null;
  const bon = r.margeSurCA >= etat.margeCible;
  const sc = { down: "bas", moyen: "moyen", top: "haut", saisi: "saisi" } as const;
  const titre = `Dossier d'opération · ${libelle}`;

  return (
    <Document title={`MADRIMMO - ${libelle}`} author="MADRIMMO" subject="Analyse d'opération marchand de biens">
      <PageDeGarde format={format} libelle={libelle} sousTitre={[c.type, c.surface ? `${c.surface} m²` : "", pa?.commune].filter(Boolean).join(" · ")} />
      {/* ---------- Page 1 : synthèse ---------- */}
      <Page size={taille} style={stylePage}>
        <Entete titre={titre} />
        <View style={s.deux}>
          <View style={s.col}>
            <Text style={s.h1}>{libelle}</Text>
            <Text>{[c.type, c.surface ? `${c.surface} m²` : "", c.terrain ? `terrain ${c.terrain} m²` : "", c.pieces ? `${c.pieces} pièces` : "", c.etage, c.dpe ? `DPE ${c.dpe}` : "", c.etat].filter(Boolean).join(" · ")}</Text>
            {pa && <Text style={s.petit}>Parcelle {pa.section} {pa.numero} ({pa.idu}) · {pa.contenance} m² · {pa.commune}</Text>}
            {zone && <Text style={s.petit}>PLU : zone {zone.libelle}{zone.libelleLong ? ` (${zone.libelleLong})` : ""}</Text>}
          </View>
          <PlanParcelle fiche={fiche} />
        </View>
        <View style={[s.verdict, { backgroundColor: "#f2f2f2", borderLeftWidth: 3, borderLeftColor: bon ? "#000000" : "#9a9a9a" }]}>
          <Text style={{ fontFamily: "InterGras" }}>
            {bon ? "Opération rentable" : "Opération à renégocier"} : marge de {pct(r.margeSurCA)} du chiffre d'affaires (cible {pct(etat.margeCible, 0)}).
          </Text>
        </View>
        <View style={s.kpis}>
          {[
            ["Prix d'achat", eur(h.prixAcquisition), etat.prixAffiche ? `affiché ${eur(etat.prixAffiche)}` : ""],
            ["Coût technique TTC", eur(r.technique.total.ttc), "travaux, aléas, honoraires"],
            ["Prix de revente", eur(r.recettes.chiffreAffaires), `scénario ${sc[h.scenario]}`],
            ["Bénéfice brut", eur(r.beneficeBrut), `${pct(r.margeSurCA)} du CA`],
            ["Bénéfice net", eur(r.beneficeNetSociete), "après IS"],
            ["Besoin de financement", eur(a.plan.besoins.total), `fonds propres ${pct(a.plan.besoins.total ? a.fin.fondsPropres / a.plan.besoins.total : 0)}`],
          ].map(([l, v, d]) => (
            <View key={l} style={[s.kpi, paysage ? { width: "16.66%" } : {}]}>
              <View style={s.kpiBox}><Text style={s.petit}>{l}</Text><Text style={s.kpiV}>{v}</Text><Text style={s.petit}>{d}</Text></View>
            </View>
          ))}
        </View>
        <View style={s.deux}>
          <View style={s.col}>
            <Text style={s.h2}>Négociation</Text>
            {a.prixMax.map((p) => <L key={p.scenario} l={`Prix d'achat maximum · revente ${sc[p.scenario]}`} v={p.prix == null ? "inatteignable" : eur(p.prix)} />)}
            <Text style={[s.petit, { marginTop: 3 }]}>Pour une marge de {pct(etat.margeCible, 0)} du CA.</Text>
          </View>
          <View style={s.col}>
            <Text style={s.h2}>Points de vigilance</Text>
            {vigilance.length ? vigilance.slice(0, 8).map((v) => <Text key={v} style={{ marginBottom: 2 }}>• {esp(v)}</Text>) : <Text>Rien à signaler.</Text>}
          </View>
        </View>
        <Pied />
      </Page>

      {/* ---------- Page 2 : bilan prévisionnel ---------- */}
      <Page size={taille} style={stylePage}>
        <Entete titre={titre} />
        <Text style={s.h1}>Bilan prévisionnel</Text>
        <View style={s.deux}>
          <View style={s.col}>
            <Text style={s.h2}>Achat et charge foncière</Text>
            <L l="Prix d'acquisition" v={eur(h.prixAcquisition)} />
            <L l={`Frais de notaire (${pct(h.tauxNotaire, 0)})`} v={eur(r.foncier.notaire.ttc)} />
            {h.indemniteEviction > 0 && <L l="Indemnité d'éviction" v={eur(h.indemniteEviction)} />}
            {h.apporteurAffaires > 0 && <L l="Apporteur d'affaires" v={eur(h.apporteurAffaires)} />}
            <L l="Prix de revient du foncier" v={eur(r.foncier.total.ttc)} gras />
            <Text style={s.h2}>Coût technique</Text>
            <L l="Travaux gros et second œuvre" v={eur(r.technique.grosEtSecondOeuvre.ttc)} />
            {r.technique.travauxNeufs.ttc > 0 && <L l="Travaux neufs (surélévation, extension)" v={eur(r.technique.travauxNeufs.ttc)} />}
            {r.technique.voirie.ttc > 0 && <L l="Voirie et espaces verts" v={eur(r.technique.voirie.ttc)} />}
            {r.technique.ameublement.ttc > 0 && <L l="Équipement, ameublement" v={eur(r.technique.ameublement.ttc)} />}
            <L l={`Aléas (${pct(h.tauxAleas, 0)})`} v={eur(r.technique.aleas.ttc)} />
            <L l="Honoraires techniques" v={eur(r.technique.honorairesTechniques.ttc)} />
            {r.technique.raccordements.ttc > 0 && <L l="Raccordements" v={eur(r.technique.raccordements.ttc)} />}
            <L l="Total coût technique" v={eur(r.technique.total.ttc)} gras />
            <Text style={s.h2}>Frais</Text>
            <L l="Honoraires divers (gestion, comptabilité, juridique)" v={eur(r.honorairesDivers.ttc)} />
            <L l="Frais financiers" v={eur(r.fraisDivers.financiers)} />
            {r.fraisDivers.gfa + r.fraisDivers.assuranceDO > 0 && <L l="GFA et assurance dommages-ouvrage" v={eur(r.fraisDivers.gfa + r.fraisDivers.assuranceDO)} />}
            <L l="Frais de vente" v={eur(r.honorairesVente.ttc)} />
          </View>
          <View style={s.col}>
            <Text style={s.h2}>Recettes</Text>
            {r.recettes.lots.map((l, i) => {
              const lot = h.lots[i];
              const nat = lot?.nature ? NATURES_LOT.find(([k]) => k === lot.nature)?.[1] : null;
              const detail = [nat, lot?.surface && !parUnite(lot.nature) ? `${lot.surface} m²` : null].filter(Boolean).join(", ");
              return <L key={i} l={`${l.libelle}${detail ? ` (${detail})` : ""}`} v={eur(l.prix)} />;
            })}
            <L l="Chiffre d'affaires" v={eur(r.recettes.chiffreAffaires)} gras />
            <Text style={s.h2}>Résultat</Text>
            <L l="Marge brute TTC (CA - foncier)" v={eur(r.margeBruteTTC)} />
            <L l={`TVA due (${r.regimeApplique === "marge" ? "TVA sur marge" : r.regimeApplique === "total" ? "TVA sur prix total" : "exonération"})`} v={eur(r.tvaDue)} />
            <L l="Bénéfice brut" v={eur(r.beneficeBrut)} gras />
            <L l="Impôt sur les sociétés (15 % puis 25 %)" v={eur(r.impot)} />
            {r.partageJV > 0 && <L l="Part des associés en participation" v={eur(r.partageJV)} />}
            <L l="Bénéfice net" v={eur(r.beneficeNetSociete)} gras />
            <L l="Marge sur chiffre d'affaires" v={pct(r.margeSurCA)} />
            <L l="Marge sur prix de revient" v={pct(r.margeSurPrixRevient)} />
            <L l="Rendement des fonds propres" v={pct(r.rendementFondsPropres)} />
            <L l="Durée de l'opération" v={`${h.financement.dureeMois} mois`} />
            {!paysage && sensibiliteNego}
          </View>
          {paysage && a.sens.length > 0 && <View style={[s.col, { flex: 0.9 }]}>{sensibiliteNego}</View>}
        </View>
        <Pied />
      </Page>

      {/* ---------- Page : travaux et démarches ---------- */}
      <Page size={taille} style={stylePage}>
        <Entete titre={titre} />
        <Text style={s.h1}>Travaux et démarches</Text>
        <View style={s.deux}>
          <View style={s.col}>
            <Text style={s.h2}>Approche travaux</Text>
            {plan.mode === "forfait" && plan.forfait ? (
              <>
                <L l={`Forfait ${FORFAITS[plan.forfait].libelle.toLowerCase()} (${FORFAITS[plan.forfait].prixM2} €/m²)`} v={eur(FORFAITS[plan.forfait].prixM2 * (plan.surface ?? c.surface ?? 0))} gras />
                <Text style={[s.petit, { marginTop: 3 }]}>{esp(FORFAITS[plan.forfait].description)}</Text>
              </>
            ) : plan.mode === "detail" && devis.length ? (
              <>
                {categoriesDevis.map((cat) => (
                  <L key={cat} l={cat} v={eur(devis.filter((x) => x.categorie === cat).reduce((s2, x) => s2 + x.ttc, 0))} />
                ))}
                <L l={`Devis détaillé (${LIBELLES_GAMME[plan.gamme].toLowerCase()})`} v={eur(devis.reduce((s2, x) => s2 + x.ttc, 0))} gras />
              </>
            ) : (
              <Text>Budget travaux saisi dans le bilan : {eur(r.technique.grosEtSecondOeuvre.ttc)}.</Text>
            )}
            {plan.pieces.length > 0 && (
              <>
                <Text style={s.h2}>État des pièces</Text>
                {plan.pieces.map((p) => <L key={p.id} l={`${LIBELLES_PIECES[p.type]}${p.surface ? ` (${p.surface} m²)` : ""}`} v={LIBELLES_ETATS[p.etat]} />)}
              </>
            )}
            <Text style={s.h2}>TVA à la revente</Text>
            <Text>{esp(r.regimeRaison)}</Text>
            <View style={{ marginTop: 4 }}>
              {r.bascule.criteres.filter((x) => x.groupe !== "autre").map((x) => (
                <L key={x.cle} l={`${x.libelle} (seuil ${pct(x.seuil, 0)})`} v={pct(x.valeur, 0)} />
              ))}
            </View>
          </View>
          <View style={s.col}>
            <Text style={s.h2}>Démarches administratives</Text>
            {notesDemarches.map((d) => (
              <View key={d.id} style={{ marginBottom: 5 }} wrap={false}>
                <Text style={{ fontFamily: "InterGras" }}>{d.prioritaire ? "• " : ""}{esp(d.titre)}</Text>
                <Text style={s.petit}>{LIBELLES_INTERLOCUTEURS[d.interlocuteur]}{d.delai ? ` · ${esp(d.delai)}` : ""}</Text>
              </View>
            ))}
            <Text style={[s.petit, { marginTop: 4 }]}>• à traiter avant la signature du compromis.</Text>
          </View>
        </View>
        <Pied />
      </Page>

      {/* ---------- Page 3 : financement et structure ---------- */}
      <Page size={taille} style={stylePage}>
        <Entete titre={titre} />
        <Text style={s.h1}>Financement et structure</Text>
        <View style={s.deux}>
          <View style={s.col}>
            <Text style={s.h2}>Besoins</Text>
            <L l="Foncier" v={eur(a.plan.besoins.foncier)} />
            <L l="Coût technique" v={eur(a.plan.besoins.technique)} />
            <L l="Honoraires et frais divers" v={eur(a.plan.besoins.honorairesEtFrais)} />
            <L l="Total des besoins" v={eur(a.plan.besoins.total)} gras />
          </View>
          <View style={s.col}>
            <Text style={s.h2}>Ressources</Text>
            {(h.financement.sources ?? []).map((x) => <L key={x.id} l={x.libelle} v={eur(x.montant)} />)}
            <L l="Total des ressources" v={eur(a.plan.ressources)} gras />
            <L l={a.plan.ecart < 0 ? "Reste à financer" : "Excédent"} v={eur(Math.abs(a.plan.ecart))} />
            <L l="Fonds propres et quasi-fonds propres" v={`${eur(a.fin.fondsPropres)} (${pct(a.plan.besoins.total ? a.fin.fondsPropres / a.plan.besoins.total : 0)})`} />
            <L l="Endettement" v={`${eur(a.fin.dette)} (${pct(a.plan.tauxEndettement)})`} />
          </View>
        </View>
        {a.fin.sources.length > 0 && (
          <>
            <Text style={s.h2}>Coût des sources</Text>
            <View style={s.th}><Text style={{ width: "34%" }}>Source</Text><Text style={{ width: "16%", textAlign: "right" }}>Montant</Text><Text style={{ width: "12%", textAlign: "right" }}>Durée</Text><Text style={{ width: "13%", textAlign: "right" }}>Taux</Text><Text style={{ width: "13%", textAlign: "right" }}>Coût</Text><Text style={{ width: "12%", textAlign: "right" }}>Coût/an</Text></View>
            {a.fin.sources.map((x) => {
              const src = h.financement.sources?.find((y) => y.id === x.id);
              return (
                <View key={x.id} style={s.tr}>
                  <Text style={{ width: "34%" }}>{x.libelle} ({LIBELLES_SOURCES[x.type]})</Text><Text style={{ width: "16%", textAlign: "right" }}>{eur(x.montant)}</Text>
                  <Text style={{ width: "12%", textAlign: "right" }}>{x.dureeMois} mois</Text><Text style={{ width: "13%", textAlign: "right" }}>{src?.type === "associe_jv" ? `${pct(src.partBenefice, 0)} bén.` : pct(src?.tauxAnnuel ?? 0)}</Text>
                  <Text style={{ width: "13%", textAlign: "right" }}>{eur(x.total)}</Text><Text style={{ width: "12%", textAlign: "right" }}>{pct(x.coutAnnualise)}</Text>
                </View>
              );
            })}
          </>
        )}
        <Text style={s.h2}>Structure et sortie</Text>
        <L l="Société" v={LIBELLES_FORMES[etat.profil.forme]} />
        <L l="Capital social" v={eur(etat.profil.capitalSocial)} />
        <L l="Bénéfice net de la société" v={eur(r.beneficeNetSociete)} />
        {a.sortie.distribue > 0 ? (
          <>
            <L l={`Prélèvement forfaitaire (${pct(etat.profil.tauxPFU)})`} v={eur(a.sortie.pfu)} />
            {a.sortie.cotisationsSociales > 0 && <L l="Cotisations sociales (dividendes au-delà de 10 %)" v={eur(a.sortie.cotisationsSociales)} />}
            <L l="Net pour les associés" v={eur(a.sortie.netAssocies)} gras />
          </>
        ) : <L l="Bénéfice conservé en société" v={eur(a.sortie.conserveEnSociete)} gras />}
        <L l="Taux global de prélèvement (IS + sortie)" v={pct(a.sortie.tauxGlobal)} />
        {inclureRP && (
          <>
            <Text style={s.h2}>Comparatif : résidence principale (nom propre, plus-value exonérée)</Text>
            <L l="Frais de notaire (droit commun)" v={eur(a.rp.notaire)} />
            <L l="Apport personnel" v={eur(a.rp.banque.apport)} />
            <L l={`Prêt immobilier ${etat.rp.dureePretAns ?? 20} ans`} v={`${eur(a.rp.banque.montantEmprunte)} · ${eur(a.rp.banque.mensualiteTotale)}/mois`} />
            <L l="Revenus nets mensuels minimum (35 % d'endettement)" v={eur(a.rp.banque.revenuMinimum)} />
            <L l={`Capital restant dû à la revente (${a.rp.dureeMois} mois)`} v={eur(a.rp.banque.capitalRestantRevente)} />
            <L l="Frais financiers et charges de détention" v={eur(a.rp.financement.total + a.rp.charges)} />
            <L l="Gain net, sans impôt sur la plus-value" v={eur(a.rp.gainNet)} gras />
            <Text style={s.petit}>Exonération soumise à une occupation effective en résidence principale ; des reventes répétées peuvent être requalifiées en activité de marchand de biens.</Text>
          </>
        )}
        <Pied />
      </Page>

      {/* ---------- Page 4 : marché et données publiques ---------- */}
      <Page size={taille} style={stylePage}>
        <Entete titre={titre} />
        <Text style={s.h1}>Marché et données publiques</Text>
        <View style={paysage ? { flexDirection: "row", gap: 24 } : {}}>
        <View style={paysage ? { flex: 1.45 } : {}}>
        {comps && (
          <>
            <Text style={s.h2}>Ventes comparables (DVF)</Text>
            <Text>Médiane {m2(comps.stats.mediane)} · fourchette {m2(comps.stats.p25)} à {m2(comps.stats.p75)} · {comps.stats.nb} ventes dans un rayon de {comps.rayon} m.</Text>
            <View style={[s.th, { marginTop: 6 }]}><Text style={{ width: "13%" }}>Date</Text><Text style={{ width: "45%" }}>Adresse</Text><Text style={{ width: "10%", textAlign: "right" }}>Dist.</Text><Text style={{ width: "10%", textAlign: "right" }}>Surface</Text><Text style={{ width: "12%", textAlign: "right" }}>Prix</Text><Text style={{ width: "10%", textAlign: "right" }}>€/m²</Text></View>
            {comps.ventes.slice(0, paysage ? 14 : 18).map((v) => (
              <View key={v.id} style={s.tr}>
                <Text style={{ width: "13%" }}>{v.date}</Text><Text style={{ width: "45%" }}>{v.adresse}</Text><Text style={{ width: "10%", textAlign: "right" }}>{v.distance} m</Text>
                <Text style={{ width: "10%", textAlign: "right" }}>{Math.round(v.surface)} m²</Text><Text style={{ width: "12%", textAlign: "right" }}>{eur(v.prix)}</Text><Text style={{ width: "10%", textAlign: "right" }}>{esp(Math.round(v.prixM2).toLocaleString("fr-FR"))}</Text>
              </View>
            ))}
          </>
        )}
        </View>
        <View style={paysage ? { flex: 1 } : {}}>
        <View style={paysage ? {} : s.deux}>
          <View style={paysage ? {} : s.col}>
            <Text style={s.h2}>Urbanisme</Text>
            {zone ? (
              <>
                <L l="Zone" v={zone.libelle} />
                {zone.libelleLong && <Text style={s.petit}>{zone.libelleLong}</Text>}
                <L l="Document" v={zone.document ?? "-"} />
              </>
            ) : <Text>Zonage non publié sur le Géoportail de l'Urbanisme.</Text>}
          </View>
          <View style={paysage ? {} : s.col}>
            <Text style={s.h2}>Risques</Text>
            {risq ? (
              <>
                {risq.argiles && <L l="Retrait-gonflement des argiles" v={risq.argiles} />}
                <Text>{risq.risques.join(", ") || "Aucun risque recensé"}</Text>
              </>
            ) : <Text>Non disponible.</Text>}
          </View>
        </View>
        {fiche?.dpe.ok && fiche.dpe.data.length > 0 && (
          <>
            <Text style={s.h2}>DPE à proximité (150 m)</Text>
            {fiche.dpe.data.slice(0, paysage ? 6 : 8).map((d) => <Text key={d.numero}>Classe {d.etiquette} · {d.adresse} · {d.typeBatiment}, {d.surface ?? "?"} m² · {d.date}</Text>)}
          </>
        )}
        </View>
        </View>
        <Text style={[s.petit, { marginTop: 14 }]}>
          Sources : DVF géolocalisées (Etalab), Parcellaire Express (IGN), Géoportail de l'Urbanisme, Géorisques, base DPE de l'ADEME. Données extraites le {new Date().toLocaleDateString("fr-FR")}.
          Bilan établi selon la méthode du bilan prévisionnel marchand de biens (TVA, IS 15 % / 25 %). Document indicatif.
        </Text>
        <Pied />
      </Page>
    </Document>
  );
}
