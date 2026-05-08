export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  const backend = process.env.BACKEND_URL;
  if (!backend) {
    return new Response(
      JSON.stringify({ error: "BACKEND_URL env var is not configured on this deployment" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  const url = new URL(req.url);
  const path = url.searchParams.get("_path");
  if (path === null) {
    return new Response(
      JSON.stringify({ error: "missing _path query param (vercel.json rewrite misconfigured?)" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
  url.searchParams.delete("_path");

  const target =
    backend.replace(/\/$/, "") + "/api/" + path + (url.search.length > 0 ? url.search : "");

  const headers = new Headers(req.headers);
  headers.delete("host");

  return fetch(target, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
    redirect: "manual",
    // @ts-expect-error duplex required when streaming a request body
    duplex: "half",
  });
}
