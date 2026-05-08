export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  const backend = process.env.BACKEND_URL;
  if (!backend) {
    return new Response(
      JSON.stringify({ error: "BACKEND_URL env var is not configured on this deployment" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  const incoming = new URL(req.url);
  const target = backend.replace(/\/$/, "") + incoming.pathname + incoming.search;

  const headers = new Headers(req.headers);
  headers.delete("host");

  const init: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
    redirect: "manual",
    duplex: "half",
  };

  return fetch(target, init);
}
