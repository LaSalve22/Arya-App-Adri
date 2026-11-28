// Monogramme MADRIMMO : le M dont la dernière jambe devient un A (Maëva · Adrien).
// Tracé de référence de la charte, dans une boîte 205 × 160.
export const TRACE_MONOGRAMME = "20,140 20,20 75,100 130,20 185,140";

export function Monogramme({ largeur = 32, couleur = "chrome", epaisseur = 16 }: { largeur?: number; couleur?: "chrome" | string; epaisseur?: number }) {
  const id = "chrome-monogramme";
  return (
    <svg width={largeur} height={(largeur * 160) / 205} viewBox="0 0 205 160" aria-hidden="true" focusable="false">
      {couleur === "chrome" && (
        <defs>
          <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="205" y2="160">
            <stop offset="0" stopColor="#6e6e6e" />
            <stop offset=".35" stopColor="#f7f7f7" />
            <stop offset=".55" stopColor="#8a8a8a" />
            <stop offset=".8" stopColor="#e8e8e8" />
            <stop offset="1" stopColor="#9a9a9a" />
          </linearGradient>
        </defs>
      )}
      <polyline
        points={TRACE_MONOGRAMME}
        fill="none"
        stroke={couleur === "chrome" ? `url(#${id})` : couleur}
        strokeWidth={epaisseur}
        strokeLinejoin="miter"
        strokeMiterlimit={10}
        strokeLinecap="square"
      />
    </svg>
  );
}
