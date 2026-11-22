import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const PORT = Number(process.env.PORT ?? 4310);
const HOST = process.env.HOST ?? "0.0.0.0";
const API_ORIGIN = process.env.API_ORIGIN ?? "http://127.0.0.1:43871";
const ROOT = resolve(process.env.STATIC_ROOT ?? "dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function proxy(req, res) {
  const target = new URL(req.url, API_ORIGIN);
  const upstream = httpRequest(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      path: `${target.pathname}${target.search}`,
      method: "GET",
      headers: {
        accept: req.headers.accept ?? "application/json",
        "user-agent": req.headers["user-agent"] ?? "mrps-telemetry-dashboard",
      },
      timeout: 15_000,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, {
        "content-type": upstreamRes.headers["content-type"] ?? "application/json; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      });
      upstreamRes.pipe(res);
    },
  );

  upstream.on("timeout", () => upstream.destroy(new Error("Upstream timeout")));
  upstream.on("error", (error) => {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.writeHead(502, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    res.end(JSON.stringify({ error: "Telemetry API is unreachable", detail: error.message }));
  });
  upstream.end();
}

function sendFile(res, filePath, cache) {
  const type = MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream";
  res.writeHead(200, {
    "content-type": type,
    "cache-control": cache,
    "x-content-type-options": "nosniff",
  });
  createReadStream(filePath).pipe(res);
}

const server = createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8" });
    res.end("Method not allowed");
    return;
  }

  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    res.end(JSON.stringify({ status: "ok", api: API_ORIGIN }));
    return;
  }

  if (req.url?.startsWith("/api/")) {
    proxy(req, res);
    return;
  }

  const cleanPath = normalize(decodeURIComponent((req.url ?? "/").split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(ROOT, cleanPath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(ROOT, "index.html");
  }

  if (!existsSync(filePath)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const cache = filePath.includes(`${ROOT}/assets/`)
    ? "public, max-age=31536000, immutable"
    : "no-cache";
  sendFile(res, filePath, cache);
});

server.listen(PORT, HOST, () => {
  console.log(`[dashboard] http://${HOST}:${PORT} -> api ${API_ORIGIN} (static ${ROOT})`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
