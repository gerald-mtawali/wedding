#!/usr/bin/env node
/**
 * Convert the printed invitation PDF into web artwork.
 *
 *   npm run invite:from-pdf -- ~/Desktop/invitation.pdf
 *
 * Writes `src/assets/invitation.svg` (vector — preferred) and, as a safety
 * net for anything the SVG converter mangles, `src/assets/invitation.png` at
 * 300dpi. Delete whichever one you don't want; the page picks up SVG first.
 *
 * Requires Poppler's `pdftocairo`, which ships with most PDF toolchains:
 *   macOS    brew install poppler
 *   Ubuntu   sudo apt install poppler-utils
 *   Windows  winget install oschwartz10612.Poppler  (or use the WSL package)
 *
 * A note on fonts: `pdftocairo -svg` embeds the text as real glyphs, which
 * renders correctly here but relies on the fonts surviving the conversion. If
 * the wording looks even slightly off, re-export the PDF from your design tool
 * with **text converted to outlines** and run this again — outlines are the
 * only way to be certain the web card is identical to the printed one.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const assets = resolve(here, "../src/assets");

const input = process.argv[2];
if (!input) {
  console.error("usage: npm run invite:from-pdf -- <invitation.pdf>");
  process.exit(1);
}
if (!existsSync(input)) {
  console.error(`No such file: ${input}`);
  process.exit(1);
}

function run(args) {
  execFileSync("pdftocairo", args, { stdio: "inherit" });
}

try {
  execFileSync("pdftocairo", ["-v"], { stdio: "ignore" });
} catch {
  console.error(
    "pdftocairo not found. Install Poppler (see the header of this script),\n" +
      "or export an SVG straight from your design tool and save it as\n" +
      "web/src/assets/invitation.svg — that works just as well.",
  );
  process.exit(1);
}

mkdirSync(assets, { recursive: true });

// -f/-l 1: first page only. -svg keeps it vector; the PNG is the fallback.
run(["-svg", "-f", "1", "-l", "1", input, resolve(assets, "invitation.svg")]);
run(["-png", "-r", "300", "-f", "1", "-l", "1", "-singlefile", input, resolve(assets, "invitation")]);

console.log(
  "\nWrote src/assets/invitation.svg and invitation.png." +
    "\nCheck the aspect ratio matches `invitationAspect` in src/lib/siteConfig.ts" +
    " (5×7in → \"5/7\"), then reload the RSVP page.",
);
