#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { walkFiles } from "./lib/walk-files.mjs";

const outDir = join(process.cwd(), "out");
const files = walkFiles(outDir).filter(({ relativePath }) =>
  /\.(html|js|css|json|txt|xml|webmanifest)$/.test(relativePath),
);

/** Site-root asset paths Next may emit as absolute `/…` or too-deep `../…`. */
const rootTails = ["_next/", "visuals/", "assets/", ".well-known/", "manifest.webmanifest"];

/** @param {string} relativePath */
function dirDepth(relativePath) {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
  const dir = normalized.includes("/") ? normalized.slice(0, normalized.lastIndexOf("/")) : "";
  return dir.split("/").filter((p) => p && p !== ".").length;
}

/** @param {string} relativePath */
function relRoot(relativePath) {
  const depth = dirDepth(relativePath);
  return depth === 0 ? "./" : "../".repeat(depth);
}

/**
 * Next sometimes emits `../_next/…` on root `index.html` (breaks IPFS/subdomain).
 * Clamp any escape that climbs above the export root for this file.
 * @param {string} text
 * @param {number} depth
 */
function clampEscapingRelatives(text, depth) {
  const prefix = depth === 0 ? "./" : "../".repeat(depth);
  let out = text;
  for (const tail of rootTails) {
    const escapedTail = tail.replace(/\./g, "\\.");
    const re = new RegExp(`(["'])(?:\\.\\./){${depth + 1},}${escapedTail}`, "g");
    out = out.replace(re, `$1${prefix}${tail}`);
  }
  return out;
}

let patched = 0;

for (const file of files) {
  const depth = dirDepth(file.relativePath);
  const prefix = relRoot(file.relativePath);
  let text = readFileSync(file.absolutePath, "utf8");
  const before = text;

  for (const tail of rootTails) {
    const root = `/${tail}`;
    const to = `"${prefix}${tail}`;
    const toSingle = `'${prefix}${tail}`;
    for (const from of [`"${root}`, `'${root}`]) {
      if (text.includes(from)) {
        text = text.split(from).join(from.startsWith('"') ? to : toSingle);
      }
    }
  }

  text = clampEscapingRelatives(text, depth);

  if (text !== before) {
    writeFileSync(file.absolutePath, text, "utf8");
    patched++;
  }
}

console.log(`ipfs-relative-export: patched ${patched} file(s) in out/`);
