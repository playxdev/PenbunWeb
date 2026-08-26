/**
 * dist.mjs — assemble the deployable copy of the site.
 *
 * Nothing under `assets/js` carries a content hash: `main.js` is `main.js` in
 * every build. Browsers cache it by URL, so a deploy reaches a returning
 * visitor only when their copy expires — and worse, each file expires on its
 * own clock. That produced a page that did not merely look stale, it failed
 * outright:
 *
 *     SyntaxError: The requested module '../master/form.js'
 *     does not provide an export named 'fillRefSelects'
 *
 * A fresh `docs/page.js` had loaded beside a four-hour-old `master/form.js`.
 * Half a deploy is not a working program.
 *
 * `Cache-Control` cannot be relied on to prevent that: a Cloudflare zone in
 * front of Pages rewrites it (Browser Cache TTL), so what `public/_headers`
 * asks for is advisory. What no cache can defeat is a different URL.
 *
 * So the build writes every module into `assets/js/<hash>/`, where the hash
 * covers the contents of the whole bundle, and points the HTML at that
 * directory. Relative imports inside the modules resolve within it, so the
 * whole graph moves together and a browser can never mix two builds: it
 * either has the directory or it does not. The HTML that names the directory
 * is revalidated on every load, which is the one thing Pages guarantees
 * (`max-age=0, must-revalidate`, and the edge does not cache HTML by
 * default).
 *
 * `public/` stays exactly as it is — source, committed, served by
 * tools/serve.mjs during development with no hashing in the way.
 */
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(ROOT, "public");
const OUT = join(ROOT, "dist");
const JS = join("assets", "js");

/** Every file under dir, as paths relative to it, sorted for a stable hash. */
function walk(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, base));
    else out.push(relative(base, full));
  }
  return out.sort();
}

const jsDir = join(SRC, JS);
let files;
try {
  files = walk(jsDir);
} catch {
  console.error("dist: no compiled output in public/assets/js — run tsc first");
  process.exit(1);
}
if (files.length === 0) {
  console.error("dist: public/assets/js is empty — run tsc first");
  process.exit(1);
}

// Source maps are not part of what the page executes, and shipping them would
// publish the TypeScript sources with it.
const shipped = files.filter((f) => f.endsWith(".js"));

const sum = createHash("sha256");
for (const f of shipped) {
  sum.update(f);
  sum.update("\0");
  sum.update(readFileSync(join(jsDir, f)));
}
const build = sum.digest("hex").slice(0, 10);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// Everything but the JS goes across untouched: CSS, images, _headers, HTML.
cpSync(SRC, OUT, {
  recursive: true,
  filter: (src) => !src.startsWith(jsDir),
});

for (const f of shipped) {
  const target = join(OUT, JS, build, f);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(join(jsDir, f), target);
}

let stamped = 0;
for (const name of readdirSync(OUT)) {
  if (!name.endsWith(".html")) continue;
  const path = join(OUT, name);
  const before = readFileSync(path, "utf8");
  const after = before.replace(/src="\/assets\/js\/([A-Za-z0-9_-]+\.js)"/g, `src="/assets/js/${build}/$1"`);
  if (after !== before) {
    writeFileSync(path, after);
    stamped++;
  }
}

console.log(`dist: ${shipped.length} modules → assets/js/${build}/ · ${stamped} pages stamped`);
