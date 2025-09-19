// scripts/convert_species_yaml.cjs
// Usage: node scripts/convert_species_yaml.cjs
// Reads:  data/raw/species-meta-lookup.yaml, data/raw/species-meta.yaml
// Writes: data/species-meta-lookup.json,    data/species-meta.json

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

const ROOT = process.cwd();
const IN_LOOKUP = path.join(ROOT, "data/raw/species-meta-lookup.yaml");
const IN_META   = path.join(ROOT, "data/raw/species-meta.yaml");
const OUT_LOOKUP = path.join(ROOT, "data/species-meta-lookup.json");
const OUT_META   = path.join(ROOT, "data/species-meta.json");

function readYaml(p) {
  const raw = fs.readFileSync(p, "utf8");
  const cleaned = raw.replace(/\t/g, "  ");
  return YAML.parse(cleaned);
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
  console.log("Wrote", p);
}

(function main() {
  if (!fs.existsSync(IN_LOOKUP)) {
    console.error("Missing:", IN_LOOKUP);
    process.exit(1);
  }
  if (!fs.existsSync(IN_META)) {
    console.error("Missing:", IN_META);
    process.exit(1);
  }

  const lookup = readYaml(IN_LOOKUP);
  const meta = readYaml(IN_META);

  if (lookup == null || typeof lookup !== "object") {
    throw new Error("Parsed lookup YAML is not an object/map");
  }
  if (meta == null || typeof meta !== "object") {
    throw new Error("Parsed meta YAML is not an object/map");
  }

  writeJson(OUT_LOOKUP, lookup);
  writeJson(OUT_META, meta);
  console.log("Done.");
})();
