#!/usr/bin/env node
/**
 * Pull the bitmaps out of the Figma envelope exports.
 *
 *   node scripts/extract-envelope-art.mjs ~/Downloads/envelope-*.svg wax-seal.svg
 *
 * Figma exports a shape with an image fill as an SVG that base64-embeds the
 * whole bitmap — once per shape. The four envelope exports came to 16.4 MB
 * between them and contained exactly two unique images: the felt texture
 * (repeated six times) and the wax seal (a 2587x2500 bitmap drawn at 98px).
 *
 * This script de-duplicates by content hash and writes each unique image out
 * once, so they can be resized and converted to WebP. Run it again whenever
 * the design changes; the app only ever loads the optimised files in
 * src/assets/envelope/.
 *
 * Optimising afterwards (pick whichever you have):
 *
 *   cwebp -q 78 -resize 600 0 felt.png -o src/assets/envelope/felt.webp
 *   cwebp -q 88 -resize 384 0 seal.png -o src/assets/envelope/seal.webp
 *
 *   magick felt.png -resize 600x -quality 78 src/assets/envelope/felt.webp
 *   magick seal.png -resize 384x -quality 88 src/assets/envelope/seal.webp
 *
 * Sizes are chosen from how large each is actually drawn: the envelope is at
 * most ~434 CSS px wide, the seal ~80 px, both doubled for high-DPI screens.
 * Going bigger costs bytes for detail nobody can see.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("usage: extract-envelope-art.mjs <export.svg> [more.svg ...]");
  process.exit(1);
}

const outDir = resolve(process.cwd(), "envelope-art");
mkdirSync(outDir, { recursive: true });

const EMBEDDED = /(?:xlink:)?href="data:image\/(\w+);base64,([^"]+)"/g;

const seen = new Map();
let occurrences = 0;
let embeddedBytes = 0;

for (const file of files) {
  const svg = readFileSync(file, "utf8");
  for (const [, kind, b64] of svg.matchAll(EMBEDDED)) {
    occurrences++;
    const data = Buffer.from(b64, "base64");
    embeddedBytes += data.length;

    const hash = createHash("sha1").update(data).digest("hex").slice(0, 8);
    if (seen.has(hash)) {
      console.log(`  ${basename(file)}: duplicate of ${seen.get(hash)}`);
      continue;
    }

    const name = `${basename(file, ".svg")}-${hash}.${kind}`;
    seen.set(hash, name);
    writeFileSync(resolve(outDir, name), data);
    console.log(
      `  ${basename(file)}: wrote ${name} (${(data.length / 1e6).toFixed(2)} MB)`,
    );
  }
}

console.log(
  `\n${occurrences} embedded image(s) across ${files.length} file(s), ` +
    `${seen.size} unique — ${(embeddedBytes / 1e6).toFixed(1)} MB of bitmap ` +
    `data collapsed into ${seen.size} file(s) in ./envelope-art/.` +
    `\nResize and convert them (see the header), then drop the results in ` +
    `src/assets/envelope/.`,
);
