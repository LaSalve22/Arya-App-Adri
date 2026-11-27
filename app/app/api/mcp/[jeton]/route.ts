// Point d'entrée du connecteur Claude : https://<domaine>/api/mcp/<jeton>
// Le jeton (variable d'environnement MADRIMMO_JETON) évite que n'importe qui utilise le serveur.
import { timingSafeEqual } from "node:crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { creerServeur } from "@/lib/mcp/serveur";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function jetonValide(j: string): boolean {
  const attendu = process.env.MADRIMMO_JETON;
  if (!attendu || attendu.length < 16) return false;
  const a = Buffer.from(j);
  const b = Buffer.from(attendu);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function traiter(req: Request, { params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  if (!jetonValide(jeton)) return new Response("Introuvable", { status: 404 });
  // Mode sans session : un serveur et un transport par requête (adapté aux fonctions serverless).
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  const serveur = creerServeur(new URL(req.url).origin);
  await serveur.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    void serveur.close();
  }
}

export { traiter as GET, traiter as POST, traiter as DELETE };
