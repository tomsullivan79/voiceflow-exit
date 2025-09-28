// scripts/loose_merge_from_txt.cjs
// Usage: node scripts/loose_merge_from_txt.cjs
//
// Reads raw text/YAML-ish sources WITHOUT a YAML parser:
//   data/raw/species-meta-lookup.yaml    (triage + aliases; may be inline: slug: { ... })
//   data/raw/species-meta.yaml           (rich fields + alias_for; multi-line)
// Writes: data/species-merged.json  ->  { species: [...] }

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const LKP = path.join(ROOT, "data/raw/species-meta-lookup.yaml");
const META = path.join(ROOT, "data/raw/species-meta.yaml");
const OUT = path.join(ROOT, "data/species-merged.json");

// ---------- helpers ----------
function toSlug(s) {
  if (!s) return "";
  return String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function stripQuotes(s) {
  const t = String(s).trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}
function parseFlowArray(s) {
  const m = String(s).trim().match(/^\[(.*)\]$/);
  if (!m) return null;
  const body = m[1].trim();
  if (!body) return [];
  return body.split(/\s*,\s*/).map(x => stripQuotes(x)).filter(Boolean);
}
function parseBoolish(s) {
  const v = String(s).trim().toLowerCase();
  if (["true","yes","y","1"].includes(v)) return true;
  if (["false","no","n","0"].includes(v)) return false;
  return undefined; // keep string levels like "always", "conditional"
}
function getIndent(line) {
  const m = line.match(/^(\s*)/);
  return m ? m[1].length : 0;
}
function isTopLevelSlugLineLoose(line) {
  // NEW: trim leading spaces before checking for "<slug>:"
  return /^\s*[A-Za-z0-9_]+:\s*(?:\{|#|$)/.test(line);
}
function collectIndentedBlock(lines, startIdx, parentIndent) {
  const block = [];
  let i = startIdx;
  for (; i < lines.length; i++) {
    const l = lines[i];
    const trimmed = l.trim();

    if (!trimmed) { block.push(""); continue; }
    if (/^\s*#/.test(l)) { continue; }

    // HARD STOP if the next nonblank looks like a new slug (even if indented)
    if (isTopLevelSlugLineLoose(l)) break;

    const ind = (l.match(/^(\s*)/)?.[1]?.length) ?? 0;
    if (ind <= parentIndent) break;

    block.push(l);
  }
  return { block, nextIndex: i };
}


// NEW: parse inline `{ a: 1, b: "x", c: [y,z] }` forgivingly
function parseInlineObject(objText) {
  const txt = objText.trim().replace(/^\{/, "").replace(/\}$/, "");
  if (!txt) return {};
  const out = {};
  // naive split by comma; good enough for our values
  for (const part of txt.split(/\s*,\s*/)) {
    if (!part) continue;
    const kv = part.split(/\s*:\s*/);
    if (kv.length < 2) continue;
    const key = toSlug(kv[0]);
    const rawVal = kv.slice(1).join(":").trim();
    const arr = parseFlowArray(rawVal);
    if (arr) { out[key] = arr; continue; }
    const b = parseBoolish(rawVal);
    out[key] = (b === undefined ? stripQuotes(rawVal) : b);
  }
  return out;
}

// parse a `keywords` nested block (multi-line)
function parseKeywordsBlock(lines, startIdx, keyIndent) {
  const out = {};
  let i = startIdx;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^\s*#/.test(line)) { i++; continue; }
    const ind = getIndent(line);
    if (ind <= keyIndent) break;
    const m = line.match(/^(\s*)([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (!m) { i++; continue; }
    const subIndent = m[1].length;
    const subKey = toSlug(m[2]);
    let value = m[3].trim();

    const arr = parseFlowArray(value);
    if (arr) { out[subKey] = arr; i++; continue; }

    if (!value) {
      const { block, nextIndex } = collectIndentedBlock(lines, i+1, subIndent);
      i = nextIndex;
      const items = [];
      for (const bl of block) {
        const mli = bl.match(/^\s*-\s+(.*)$/);
        if (mli) items.push(stripQuotes(mli[1]));
      }
      if (items.length) { out[subKey] = items; continue; }
      const text = block.map(b => stripQuotes(b.trim())).filter(Boolean).join(" ");
      out[subKey] = text ? text.split(/\s*,\s*/).filter(Boolean) : [];
      continue;
    }

    out[subKey] = [stripQuotes(value)];
    i++;
  }
  return { keywords: out, nextIndex: i };
}

// ---------- core parsers ----------
function parseLookupLoose(raw) {
  // Supports BOTH:
  //   slug: { k: v, ... }   (inline)
  //   slug:\n  k: v         (multi-line)
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const map = {};
  let currentSlug = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1) inline case: slug: { ... }
    const topInline = line.match(/^([a-z0-9_]+):\s*(\{.*\})\s*(?:#.*)?$/i);
    if (topInline) {
      const slug = toSlug(topInline[1]);
      map[slug] = { slug, ...parseInlineObject(topInline[2]) };
      currentSlug = null; // inline consumes the whole record
      continue;
    }

    // 2) multi-line case: slug:
    const top = line.match(/^([a-z0-9_]+):\s*(?:#.*)?$/i);
    if (top) {
      currentSlug = toSlug(top[1]);
      if (!map[currentSlug]) map[currentSlug] = { slug: currentSlug };
      continue;
    }

    if (!currentSlug) continue;
    if (/^\s*#/.test(line) || /^\s*$/.test(line)) continue;

    const m = line.match(/^(\s+)([^:\n]+):\s*(.*)$/);
    if (m) {
      const key = toSlug(m[2].trim());
      const value = m[3].trim();
      const arr = parseFlowArray(value);
      if (arr) { map[currentSlug][key] = arr; continue; }
      const b = parseBoolish(value);
      map[currentSlug][key] = (b === undefined ? stripQuotes(value) : b);
    }
  }
  return map;
}

function parseMetaLoose(raw) {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const map = {};
  let currentSlug = null;
  let lastLongKey = null;

  function collectBlock(i, indent) {
    const { block, nextIndex } = collectIndentedBlock(lines, i, indent);
    return { text: block.map(b => b.slice(Math.min(getIndent(b), indent+2))).join("\n"), nextIndex };
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const top = line.match(/^([a-z0-9_]+):\s*(?:#.*)?$/i);
    if (top) {
      currentSlug = toSlug(top[1]);
      if (!map[currentSlug]) map[currentSlug] = { slug: currentSlug };
      lastLongKey = null;
      continue;
    }

    if (!currentSlug) continue;
    if (/^\s*#/.test(line) || /^\s*$/.test(line)) { lastLongKey = null; continue; }

    const m = line.match(/^(\s+)([^:\n]+):\s*(.*)$/);
    if (m) {
      const indent = m[1].length;
      const key = toSlug(m[2].trim());
      let value = m[3].trim();

      // keywords block
      if (key === "keywords") {
        if (value) {
          // inline { ... }
          const kv = {};
          const body = value.replace(/^\{|\}$/g, "");
          if (body) {
            for (const part of body.split(/\s*,\s*/)) {
              const [k, v] = part.split(/\s*:\s*/);
              if (!k) continue;
              const subKey = toSlug(k);
              const arr = parseFlowArray(v);
              kv[subKey] = arr || [stripQuotes(v)];
            }
          }
          map[currentSlug][key] = kv;
        } else {
          const { keywords, nextIndex } = parseKeywordsBlock(lines, i+1, indent);
          map[currentSlug][key] = keywords;
          i = nextIndex - 1;
        }
        lastLongKey = null;
        continue;
      }

      // long text fields
      if (["description","care_advice"].includes(key)) {
        if (!value) {
          const { text, nextIndex } = collectBlock(i+1, indent);
          map[currentSlug][key] = text.trim();
          i = nextIndex - 1;
        } else if (value === ">" || value === "|") {
          const { text, nextIndex } = collectBlock(i+1, indent);
          map[currentSlug][key] = text.trim();
          i = nextIndex - 1;
        } else if (/^[>|]\s+/.test(value)) {
          const first = value.replace(/^[>|]\s+/, "");
          const { text, nextIndex } = collectBlock(i+1, indent);
          map[currentSlug][key] = [first, text].filter(Boolean).join("\n").trim();
          i = nextIndex - 1;
        } else {
          map[currentSlug][key] = stripQuotes(value);
        }
        lastLongKey = key;
        continue;
      }

      // simple scalars/arrays/bools
      const arr = parseFlowArray(value);
      if (arr) { map[currentSlug][key] = arr; lastLongKey = null; continue; }
      const b = parseBoolish(value);
      map[currentSlug][key] = (b === undefined ? stripQuotes(value) : b);
      lastLongKey = null;
      continue;
    }

    // continuation of long text
    const cont = line.match(/^(\s+)(\S.*)$/);
    if (cont && lastLongKey && ["description","care_advice"].includes(lastLongKey)) {
      const body = cont[2];
      map[currentSlug][lastLongKey] = (map[currentSlug][lastLongKey] ? map[currentSlug][lastLongKey] + "\n" : "") + body;
    }
  }
  return map;
}

// ---------- merge ----------
function mergeLookupAndMeta(lookup, meta) {
  const result = {};
  const aliasPairs = [];

  // seed from meta
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
      keywords: m.keywords,
      tags: Array.isArray(m.tags) ? m.tags : undefined,
      aliases: Array.isArray(m.aliases) ? m.aliases.map(toSlug) : undefined,
    };
  }

  // add from lookup if missing
  for (const slug of Object.keys(lookup)) {
    if (!result[slug]) {
      const l = lookup[slug];
      result[slug] = {
        slug,
        common_name: l.common_name || slug.replace(/_/g, " "),
        category: l.category,
        tags: Array.isArray(l.tags) ? l.tags : undefined,
        aliases: Array.isArray(l.aliases) ? l.aliases.map(toSlug) : undefined,
      };
    }
  }

  // fold triage + booleans from lookup (lookup is source of truth for triage)
  for (const slug of Object.keys(lookup)) {
    const l = lookup[slug];
    const r = result[slug];
    if (!r) continue;

    for (const k of [
      "intervention_needed",
      "referral_required_level",
      "dangerous_level",
      "rabies_vector_level",
      "needs_species_escalation_level",
      "bat_exposure_level",
      "potential_aggression",
      "age_assessment_needed"
    ]) {
      if (l[k] !== undefined) r[k] = l[k];
    }
    for (const k of ["referral_required","dangerous","rabies_vector"]) {
      if (l[k] !== undefined) r[k] = l[k];
    }
    if (Array.isArray(l.tags)) r.tags = Array.from(new Set([...(r.tags||[]), ...l.tags]));
    if (Array.isArray(l.aliases)) {
      const a = (r.aliases || []).concat(l.aliases.map(toSlug));
      r.aliases = Array.from(new Set(a));
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
    result[canonical].aliases = Array.from(new Set(arr.map(toSlug)));
  }

  // normalize keywords arrays
  for (const slug of Object.keys(result)) {
    const kw = result[slug].keywords;
    if (kw && typeof kw === "object") {
      for (const sub of ["shape","color","behavior","environment"]) {
        if (kw[sub] && !Array.isArray(kw[sub])) kw[sub] = [String(kw[sub])];
      }
    }
  }

  // sort aliases
  for (const slug of Object.keys(result)) {
    const al = result[slug].aliases;
    if (al) result[slug].aliases = Array.from(new Set(al)).sort();
  }

  const species = Object.values(result).sort((a, b) => a.slug.localeCompare(b.slug));
  return { species };
}

// ------------- main --------------
(function main() {
  if (!fs.existsSync(LKP) || !fs.existsSync(META)) {
    console.error("Missing raw files. Expected:\n - " + LKP + "\n - " + META);
    process.exit(1);
  }
  const rawLookup = fs.readFileSync(LKP, "utf8");
  const rawMeta = fs.readFileSync(META, "utf8");

  const lookupMap = parseLookupLoose(rawLookup);
  const metaMap = parseMetaLoose(rawMeta);

  const merged = mergeLookupAndMeta(lookupMap, metaMap);
  fs.writeFileSync(OUT, JSON.stringify(merged, null, 2), "utf8");
  console.log(`Wrote ${OUT} with ${merged.species.length} species.`);
})();
