// scripts/loose_merge_from_txt.cjs
// Usage: node scripts/loose_merge_from_txt.cjs
//
// Reads raw text-ish sources (YAML-ish) without a YAML parser:
//   data/raw/species-meta-lookup.yaml
//   data/raw/species-meta.yaml
//
// Writes canonical JSON for seeding:
//   data/species-merged.json  with shape: { species: [...] }
//
// Approach:
// - Tokenize top-level records by lines like: slug:
// - Parse indented "key: value" pairs underneath
// - For long-text fields (description, care_advice), capture subsequent indented lines
// - Handle simple flow values like [a, b, c] and { k: v } in a forgiving way
// - Fold alias relationships via `alias_for` and per-record `aliases`

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const LKP = path.join(ROOT, "data/raw/species-meta-lookup.yaml");
const META = path.join(ROOT, "data/raw/species-meta.yaml");
const OUT = path.join(ROOT, "data/species-merged.json");

// ------------ helpers -------------
function toSlug(s) {
  if (!s) return "";
  return String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function parseFlowArray(s) {
  // "[a, b, c]" -> ["a","b","c"]; tolerate missing spaces
  const m = String(s).trim().match(/^\[(.*)\]$/);
  if (!m) return null;
  const body = m[1].trim();
  if (!body) return [];
  return body.split(/\s*,\s*/).map(x => String(x).trim()).filter(Boolean);
}
function parseFlowObject(s) {
  // "{ a: 1, b: 2 }" -> {a:"1", b:"2"} (values treated as strings)
  const m = String(s).trim().match(/^\{(.*)\}$/);
  if (!m) return null;
  const body = m[1].trim();
  if (!body) return {};
  const obj = {};
  for (const part of body.split(/\s*,\s*/)) {
    const kv = part.split(/\s*:\s*/);
    if (kv.length >= 2) obj[toSlug(kv[0])] = kv.slice(1).join(":");
  }
  return obj;
}
function parseBoolish(s) {
  const v = String(s).trim().toLowerCase();
  if (["true","yes","y","1"].includes(v)) return true;
  if (["false","no","n","0"].includes(v)) return false;
  return undefined; // keep string levels like "always", "conditional"
}

// ------------ core loose parsers -------------
function parseLooseMap(raw, longTextKeys = []) {
  // Returns { slug -> { ...fields } }
  const lines = raw.replace(/\r\n/g, "\n").split("\n");

  const map = {};
  let current = null; // {slug, baseIndent}
  let lastKey = null;

  function ensure(slug, baseIndent) {
    if (!map[slug]) map[slug] = { slug };
    current = { slug, baseIndent };
    lastKey = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Top-level: "slug:" at column 0
    const top = line.match(/^([a-z0-9_]+):\s*(?:#.*)?$/i);
    if (top) {
      ensure(toSlug(top[1]), 0);
      continue;
    }

    // Skip comments/blank
    if (/^\s*#/.test(line) || /^\s*$/.test(line)) {
      continue;
    }

    // Must be indented content for the current slug
    if (!current) continue;

    const m = line.match(/^(\s+)([^:\n]+):\s*(.*)$/); // "  key: value"
    if (m) {
      const indent = m[1].length;
      const keyRaw = m[2].trim();
      const key = toSlug(keyRaw);
      let value = m[3].trim();

      // If value empty, may begin a long text block or nested lines
      if (!value) {
        // Start long text capture for keys we consider "long"
        if (longTextKeys.includes(key)) {
          // collect subsequent lines that are more indented than this line
          const block = [];
          const blockIndent = indent;
          for (let j = i + 1; j < lines.length; j++) {
            const l2 = lines[j];
            if (/^\s*$/.test(l2)) { block.push(""); continue; }
            if (/^\s*#/.test(l2)) { block.push(""); continue; }
            const m2 = l2.match(/^(\s*)(.*)$/);
            const ind2 = m2[1].length;
            const body = m2[2];
            if (ind2 > blockIndent) {
              block.push(body);
              i = j; // advance outer loop
            } else {
              i = j - 1; // stop before the line that dedented
              break;
            }
          }
          map[current.slug][key] = block.join("\n").trim();
          lastKey = key;
          continue;
        } else {
          // empty scalar; set to empty string for now
          map[current.slug][key] = "";
          lastKey = key;
          continue;
        }
      }

      // Try to parse flow array/object, else keep as scalar
      const arr = parseFlowArray(value);
      if (arr) {
        map[current.slug][key] = arr;
        lastKey = key;
        continue;
      }
      const obj = parseFlowObject(value);
      if (obj) {
        map[current.slug][key] = obj;
        lastKey = key;
        continue;
      }

      // Booleans / levels
      const b = parseBoolish(value);
      map[current.slug][key] = (b === undefined ? value : b);
      lastKey = key;
      continue;
    }

    // Continuation lines: indented lines without "key:" — treat as continuation of the last long text key
    const cont = line.match(/^(\s+)(\S.*)$/);
    if (cont && lastKey && longTextKeys.includes(lastKey)) {
      const body = cont[2];
      map[current.slug][lastKey] = (map[current.slug][lastKey] ? map[current.slug][lastKey] + "\n" : "") + body;
      continue;
    }

    // Otherwise ignore
  }

  return map;
}

function mergeLookupAndMeta(lookup, meta) {
  // lookup + meta are maps keyed by slug
  // meta may have "alias_for" or "aliases"
  const result = {};
  const aliasPairs = [];

  const longTextKeys = ["description","care_advice"];

  // seed canonical from meta
  for (const slug of Object.keys(meta)) {
    const m = meta[slug];
    if (m.alias_for) {
      aliasPairs.push({ alias: slug, canonical: toSlug(m.alias_for) });
      continue;
    }
    result[slug] = {
      slug,
      common_name: m.common_name || slug.replace(/_/g, " "),
      scientific_name: m.scientific_name,
      category: m.category,
      description: m.description,
      care_advice: m.care_advice,
      keywords: m.keywords, // may be array-ish/object-ish; ok to carry raw
      aliases: Array.isArray(m.aliases) ? m.aliases.map(toSlug) : undefined,
    };
  }

  // add from lookup if not present
  for (const slug of Object.keys(lookup)) {
    if (!result[slug]) {
      const l = lookup[slug];
      result[slug] = {
        slug,
        common_name: l.common_name || slug.replace(/_/g, " "),
        category: l.category,
        aliases: Array.isArray(l.aliases) ? l.aliases.map(toSlug) : undefined,
      };
    }
  }

  // fold triage fields from lookup
  for (const slug of Object.keys(lookup)) {
    const l = lookup[slug];
    const r = result[slug];
    if (!r) continue;

    // level/string fields
    for (const k of [
      "intervention_needed",
      "referral_required_level",
      "dangerous_level",
      "rabies_vector_level",
      "needs_species_escalation_level",
      "bat_exposure_level",
      "potential_aggression",
    ]) {
      if (l[k] !== undefined) r[k] = l[k];
    }
    // booleans fallbacks
    for (const k of ["referral_required","dangerous","rabies_vector","age_assessment_needed"]) {
      if (l[k] !== undefined) r[k] = l[k];
    }
  }

  // fold alias_for edges
  for (const { alias, canonical } of aliasPairs) {
    if (!canonical) continue;
    if (!result[canonical]) {
      result[canonical] = { slug: canonical, common_name: canonical.replace(/_/g, " "), aliases: [] };
    }
    const arr = result[canonical].aliases ?? [];
    if (!arr.includes(alias)) arr.push(alias);
    result[canonical].aliases = arr.map(toSlug);
  }

  // normalize aliases: dedupe, sort
  for (const slug of Object.keys(result)) {
    const al = result[slug].aliases;
    if (al) result[slug].aliases = Array.from(new Set(al.map(toSlug))).sort();
  }

  // to array
  const species = Object.values(result).sort((a, b) => a.slug.localeCompare(b.slug));
  return { species };
}

// ------------- main --------------
(function main() {
  if (!fs.existsSync(LKP) || !fs.existsSync(META)) {
    console.error("Missing raw files. Expected:");
    console.error(" -", LKP);
    console.error(" -", META);
    process.exit(1);
  }

  const rawLookup = fs.readFileSync(LKP, "utf8");
  const rawMeta = fs.readFileSync(META, "utf8");

  // parse
  const lookupMap = parseLooseMap(rawLookup, []); // lookup is mostly short fields
  const metaMap = parseLooseMap(rawMeta, ["description","care_advice"]);

  const merged = mergeLookupAndMeta(lookupMap, metaMap);
  fs.writeFileSync(OUT, JSON.stringify(merged, null, 2), "utf8");
  console.log(`Wrote ${OUT} with ${merged.species.length} species.`);
})();
