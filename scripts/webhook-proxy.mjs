import http from "node:http";

const HOST = process.env.WEBHOOK_PROXY_HOST ?? "0.0.0.0";
const PORT = Number(process.env.WEBHOOK_PROXY_PORT ?? 4010);
const API_ORIGIN = process.env.WEBHOOK_PROXY_API_ORIGIN ?? "http://127.0.0.1:4000";
const ALLOWED = new Set([
  "GET /api/v1/health",
  "POST /api/v1/github/webhooks"
]);

const server = http.createServer(async (request, response) => {
  const path = request.url?.split("?")[0] ?? "/";
  const key = `${request.method} ${path}`;

  if (!ALLOWED.has(key)) {
    response.writeHead(404, {
      "content-type": "application/json"
    });
    response.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  try {
    const body = await readBody(request);
    const headers = { ...request.headers };
    delete headers.host;
    delete headers.connection;
    delete headers["content-length"];

    const upstream = await fetch(`${API_ORIGIN}${request.url}`, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : body
    });

    response.writeHead(upstream.status, Object.fromEntries(upstream.headers));
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    response.writeHead(502, {
      "content-type": "application/json"
    });
    response.end(
      JSON.stringify({
        error: "Webhook proxy upstream request failed"
      })
    );
    console.error(error);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Webhook proxy listening on http://${HOST}:${PORT}`);
  console.log(`Forwarding allowed routes to ${API_ORIGIN}`);
});

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}
