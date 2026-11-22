import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const PORT = Number(process.env.PORT ?? 8090);
const HOST = process.env.HOST ?? "0.0.0.0";
const ROOT = resolve(process.env.ROOT ?? join(process.env.HOME ?? ".", "apt-repo"));

const MIME = {
  ".deb": "application/vnd.debian.binary-package",
  ".gz": "application/gzip",
  ".xz": "application/x-xz",
  ".asc": "text/plain; charset=utf-8",
  ".gpg": "application/pgp-signature",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function contentTypeFor(filePath, name) {
  if (name === "Packages" || name === "Release" || name === "InRelease") {
    return "text/plain; charset=utf-8";
  }
  return MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

const server = createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8" });
    res.end("Method not allowed");
    return;
  }

  const requestPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const relative = normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(ROOT, relative);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const stat = statSync(filePath);
  const name = filePath.split("/").pop() ?? "";
  const immutable = relative.startsWith("/pool/");
  res.writeHead(200, {
    "content-type": contentTypeFor(filePath, name),
    "content-length": stat.size,
    "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
    "x-content-type-options": "nosniff",
    "last-modified": stat.mtime.toUTCString(),
  });

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  createReadStream(filePath).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`[apt-repo] http://${HOST}:${PORT} -> ${ROOT}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
