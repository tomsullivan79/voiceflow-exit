// node scripts/check_species_merge.cjs
const fs = require("fs");
const path = require("path");
const LKP = path.join(process.cwd(), "data/raw/species-meta-lookup.yaml");
const META = path.join(process.cwd(), "data/raw/species-meta.yaml");
const MERGED = path.join(process.cwd(), "data/species-merged.json");

const raw = fs.readFileSync;
const txt = s => s.replace(/\r\n/g, "\n");
const slugsFrom = (s) => Array.from(txt(s).matchAll(/^([a-z0-9_]+):\s*(\{|$)/gim)).map(m => m[1].toLowerCase());

const lookupSlugs = new Set(slugsFrom(raw(LKP, "utf8")));
const metaSlugs   = new Set(slugsFrom(raw(META, "utf8")));
const merged = JSON.parse(raw(MERGED, "utf8"));
const mergedSlugs = new Set(merged.species.map(s => s.slug));

function minus(a, b){ return [...a].filter(x => !b.has(x)).sort(); }

console.log("Counts:",
  { lookup: lookupSlugs.size, meta: metaSlugs.size, merged: mergedSlugs.size });

console.log("\nIn lookup only (not in meta):", minus(lookupSlugs, metaSlugs));
console.log("\nIn meta only (not in lookup):", minus(metaSlugs, lookupSlugs));
console.log("\nIn merged only (not in either raw set):", minus(mergedSlugs, new Set([...lookupSlugs, ...metaSlugs])));
