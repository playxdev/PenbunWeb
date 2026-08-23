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
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".json": "application/json",
};

async function resolve(pathname) {
  let p = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  if (p === "/" || p === "") p = "/index.html";
  let file = join(ROOT, p);
  try {
    const s = await stat(file);
    if (s.isDirectory()) file = join(file, "index.html");
    return file;
  } catch {
    if (!extname(file)) {
      const withExt = `${file}.html`;
      try { await stat(withExt); return withExt; } catch { /* fall through */ }
    }
    return null;
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const file = await resolve(url.pathname);

  if (!file) {
    const body = await readFile(join(ROOT, "404.html")).catch(() => "404 Not Found");
    res.writeHead(404, { "content-type": TYPES[".html"] });
    return res.end(body);
  }

  const body = await readFile(file);
  res.writeHead(200, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    "cache-control": "no-cache",
  });
  res.end(body);
}).listen(PORT, () => {
  console.log(`PenbunWeb beta → http://localhost:${PORT}`);
});
