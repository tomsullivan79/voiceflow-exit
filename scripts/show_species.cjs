// node scripts/show_species.cjs osprey
const fs = require("fs");
const path = require("path");

const slug = (process.argv[2] || "").toLowerCase().replace(/[^a-z0-9_]+/g,"_");
if (!slug) { console.error("Usage: node scripts/show_species.cjs <slug>"); process.exit(1); }

const RAW_L = path.join(process.cwd(), "data/raw/species-meta-lookup.yaml");
const RAW_M = path.join(process.cwd(), "data/raw/species-meta.yaml");
const MERGED = path.join(process.cwd(), "data/species-merged.json");

function extractBlock(raw, key) {
  const lines = raw.replace(/\r\n/g,"\n").split("\n");
  const start = lines.findIndex(l => new RegExp(`^${key}:\\s*(\\{|$)`, "i").test(l));
  if (start === -1) return null;
  const buf = [lines[start]];
  const baseIndent = (lines[start].match(/^(\s*)/)?.[1]?.length) ?? 0;
  for (let i = start+1; i < lines.length; i++) {
    const l = lines[i];
    const ind = (l.match(/^(\s*)/)?.[1]?.length) ?? 0;
    if (ind <= baseIndent && l.trim() && !l.trim().startsWith("#")) break;
    buf.push(l);
  }
  return buf.join("\n");
}

const rawL = fs.readFileSync(RAW_L, "utf8");
const rawM = fs.readFileSync(RAW_M, "utf8");
const merged = JSON.parse(fs.readFileSync(MERGED, "utf8"));

const lookupBlock = extractBlock(rawL, slug);
const metaBlock   = extractBlock(rawM, slug);
const mergedObj   = merged.species.find(s => s.slug === slug);

console.log("\n=== RAW LOOKUP ===\n", lookupBlock || "(none)");
console.log("\n=== RAW META ===\n", metaBlock || "(none)");
console.log("\n=== MERGED ===\n", mergedObj ? JSON.stringify(mergedObj, null, 2) : "(none)");
