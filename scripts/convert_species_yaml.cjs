// scripts/convert_species_yaml.cjs
// Usage: node scripts/convert_species_yaml.cjs
// Reads:  data/raw/species-meta-lookup.yaml, data/raw/species-meta.yaml
// Writes: data/species-meta-lookup.json,    data/species-meta.json
//
// This version auto-sanitizes common "YAML-ish" patterns:
//  - Converts `key:{ ... }` -> `key: { ... }` (adds space after colon)
//  - Converts `key:[ ... ]` -> `key: [ ... ]`
//  - Replaces tabs with spaces
//  - Normalizes Windows line endings

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

const ROOT = process.cwd();
const IN_LOOKUP = path.join(ROOT, "data/raw/species-meta-lookup.yaml");
const IN_META   = path.join(ROOT, "data/raw/species-meta.yaml");
const OUT_LOOKUP = path.join(ROOT, "data/species-meta-lookup.json");
const OUT_META   = path.join(ROOT, "data/species-meta.json");

function sanitizeYaml(raw) {
  let s = raw;

  // Normalize line endings & tabs
  s = s.replace(/\r\n/g, "\n").replace(/\t/g, "  ");

  // Add a space after a colon when the next char is "{" or "[" with no space
  // Examples:
  //   key:{ a: 1 }  -> key: { a: 1 }
  //   key:[ 1, 2 ]  -> key: [ 1, 2 ]
  s = s.replace(/:\{/g, ": {");
  s = s.replace(/:\[/g, ": [");

  // Optional: collapse multiple spaces around colon to a single space (only for "key:  {", not inside strings)
  // Be conservative: only do it when colon is followed by spaces and then { or [
  s = s.replace(/:\s+(\{|\[)/g, ": $1");

  return s;
}

function readYamlFile(p) {
  if (!fs.existsSync(p)) {
    throw new Error(`Missing: ${p}`);
  }
  const raw = fs.readFileSync(p, "utf8");
  const cleaned = sanitizeYaml(raw);
  return YAML.parse(cleaned);
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
  console.log("Wrote", p);
}

(function main() {
  try {
    const lookup = readYamlFile(IN_LOOKUP);
    const meta   = readYamlFile(IN_META);

    if (lookup == null || typeof lookup !== "object") {
      throw new Error("Parsed lookup YAML is not an object/map");
    }
    if (meta == null || typeof meta !== "object") {
      throw new Error("Parsed meta YAML is not an object/map");
    }

    writeJson(OUT_LOOKUP, lookup);
    writeJson(OUT_META, meta);
    console.log("Done.");
  } catch (err) {
    console.error("\nYAML conversion failed:", err?.message || err);
    console.error("\nTip: If it still fails, search your YAML for patterns like `key:{` or `key:[` and ensure there is a space after the colon.\n");
    process.exit(1);
  }
})();
