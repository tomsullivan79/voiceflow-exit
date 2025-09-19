// scripts/convert_species_yaml.cjs
// Usage: node scripts/convert_species_yaml.cjs
// Reads:  data/raw/species-meta-lookup.yaml, data/raw/species-meta.yaml
// Writes: data/species-meta-lookup.json,    data/species-meta.json
//
// Sanitizes common "YAML-ish" patterns:
//  - key:{…}  -> key: { … }
//  - key:[…]  -> key: [ … ]
//  - Replaces tabs with spaces; normalizes CRLF
//  - **NEW:** Folds "wrapped paragraph" lines that start with deep indent and have no ":" into the previous line.
//
// This lets you keep free-form prose for fields like `description` and `care_advice`
// without converting them to YAML block scalars manually.

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

const ROOT = process.cwd();
const IN_LOOKUP = path.join(ROOT, "data/raw/species-meta-lookup.yaml");
const IN_META   = path.join(ROOT, "data/raw/species-meta.yaml");
const OUT_LOOKUP = path.join(ROOT, "data/species-meta-lookup.json");
const OUT_META   = path.join(ROOT, "data/species-meta.json");

function sanitizeYaml(raw) {
  // Basic normalizations
  let s = raw.replace(/\r\n/g, "\n").replace(/\t/g, "  ");

  // Add a space after a colon when next char is "{" or "["
  s = s.replace(/:\{/g, ": {");
  s = s.replace(/:\[/g, ": [");
  s = s.replace(/:\s+(\{|\[)/g, ": $1");

  // Fold wrapped prose lines:
  // If a line starts with >= 6 spaces and *does not* contain a ":" before a "#"
  // treat it as continuation of the previous non-empty line: join with a space.
  const lines = s.split("\n");
  const out = [];
  let prevWasKeyValue = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    const trimmed = line.trim();
    if (trimmed === "") {
      out.push(line);
      prevWasKeyValue = false; // reset at blank lines
      continue;
    }

    // Heuristic: a "key: value" or "key: {", "key: [" on previous line
    const prev = out.length ? out[out.length - 1] : "";
    const prevLooksLikeKV = /:\s*(?:[^#]|$)/.test(prev) && !/^\s*#/.test(prev);

    // Current line is a "wrapped" paragraph?
    const leadingSpaces = line.match(/^(\s*)/)[1].length;
    const hasColonBeforeComment = /:[^#]*$/.test(trimmed.replace(/#.*$/, ""));
    const looksLikeListItem = /^\s*-\s+/.test(line);

    // Join conditions:
    // - deep indent (>= 6 spaces)
    // - not a list item
    // - no colon (so not starting a new key)
    // - previous line looked like "key: value"
    if (
      leadingSpaces >= 6 &&
      !looksLikeListItem &&
      !hasColonBeforeComment &&
      prevLooksLikeKV
    ) {
      // Append to previous line with a space; strip leading spaces
      out[out.length - 1] = prev.replace(/\s+$/, "") + " " + trimmed;
      prevWasKeyValue = true;
      continue;
    }

    out.push(line);
    // Mark whether *this* line looks like "key: value" for the next iteration
    prevWasKeyValue = /:\s*(?:[^#]|$)/.test(line) && !/^\s*#/.test(line);
  }

  return out.join("\n");
}

function readYamlFile(p) {
  if (!fs.existsSync(p)) throw new Error(`Missing: ${p}`);
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

    if (lookup == null || typeof lookup !== "object")
      throw new Error("Parsed lookup YAML is not an object/map");
    if (meta == null || typeof meta !== "object")
      throw new Error("Parsed meta YAML is not an object/map");

    writeJson(OUT_LOOKUP, lookup);
    writeJson(OUT_META, meta);
    console.log("Done.");
  } catch (err) {
    console.error("\nYAML conversion failed:", err?.message || err);
    console.error(
      "\nIf it still fails, try wrapping long text as YAML block scalars, e.g.:\n" +
      "  care_advice: |\n" +
      "    Gently place the squirrel...\n" +
      "    Keep the box warm...\n"
    );
    process.exit(1);
  }
})();
