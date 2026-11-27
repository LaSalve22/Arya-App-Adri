// Fonctions statistiques utilisables côté navigateur.
export function quantile(trie: number[], q: number): number {
  if (!trie.length) return 0;
  const pos = (trie.length - 1) * q;
  const b = Math.floor(pos);
  const r = pos - b;
  return trie[b + 1] !== undefined ? trie[b] + r * (trie[b + 1] - trie[b]) : trie[b];
}
