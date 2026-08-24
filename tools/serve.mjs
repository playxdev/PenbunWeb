/**
 * serve.mjs — zero-dependency static server for local review.
 * Serves ./public, adds .html fallback, and returns the styled 404 page.
 *   node tools/serve.mjs [port]
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "public");
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".map": "application/json",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

async function resolve(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return { file: null, status: 400 };
  }
  let p = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  if (p === "/" || p === "") p = "/index.html";
  let file = join(ROOT, p);
  try {
    const s = await stat(file);
    if (s.isDirectory()) file = join(file, "index.html");
    return { file, status: 200 };
  } catch {
    if (!extname(file)) {
      const withExt = `${file}.html`;
      try { await stat(withExt); return { file: withExt, status: 200 }; } catch { /* fall through */ }
    }
    return { file: null, status: 404 };
  }
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const { file, status } = await resolve(url.pathname);

    if (!file) {
      if (status === 400) {
        res.writeHead(400, { "content-type": TYPES[".html"] });
        return res.end("400 Bad Request");
      }
      const body = await readFile(join(ROOT, "404.html"), "utf8").catch(() => "404 Not Found");
      res.writeHead(404, { "content-type": TYPES[".html"] });
      return res.end(body);
    }

    const body = await readFile(file);
    res.writeHead(200, {
      "content-type": TYPES[extname(file)] ?? "application/octet-stream",
      "cache-control": "no-cache",
    });
    res.end(body);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
    res.end("Internal Server Error");
  }
}).listen(PORT, () => {
  console.log(`PenbunWeb beta → http://localhost:${PORT}`);
});
