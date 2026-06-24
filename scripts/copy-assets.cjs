// Copy non-TS node assets (the codex *.node.json, icons) into dist next to the
// compiled *.node.js, since `tsc` does not emit them. n8n reads the codex for a
// node's categories and documentation links, so it must ship in the package.
const fs = require("node:fs");
const path = require("node:path");

const SRC = path.join(__dirname, "..", "src");
const DIST = path.join(__dirname, "..", "dist");

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (/\.(json|svg|png)$/.test(entry.name)) {
      const rel = path.relative(SRC, full);
      const dest = path.join(DIST, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(full, dest);
      console.log("copied", rel);
    }
  }
}

if (!fs.existsSync(DIST)) {
  console.error("dist/ not found — run tsc first");
  process.exit(1);
}
walk(SRC);
