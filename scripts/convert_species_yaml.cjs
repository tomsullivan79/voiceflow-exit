// scripts/convert_species_yaml.cjs
// Usage: node scripts/convert_species_yaml.cjs
//
// Reads raw YAML-ish sources:
//   data/raw/species-meta-lookup.yaml
//   data/raw/species-meta.yaml
//
// Writes canonical JSON for merge:
//   data/species-meta-lookup.json
//   data/species-meta.json
//
// Fixes handled:
//  - Normalize CRLF/tabs
//  - Add space after colon for flow mappings: key:{…} -> key: {…}, key:[…] -> key: […]
//  - Convert inline block scalars to proper form:
//       care_advice: > A long sentence…
//     -> care_advice: >
//          A long sentence…
//  - Fold wrapped prose lines into the previous key’s value (deep indent, no colon)
//  - **Indent guardian**: after a line ending with `key: >` or `key: |`, ensure all
//    subsequent non-empty lines are indented at least (baseIndent + 2) until we hit
//    a dedent (<= baseIndent) or a new mapping/list starts.

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

const ROOT = process.cwd();
const IN_LOOKUP = path.join(ROOT, "data/raw/species-meta-lookup.yaml");
const IN_META   = path.join(ROOT, "data/raw/species-meta.yaml");
const OUT_LOOKUP = path.join(ROOT, "data/species-meta-lookup.json");
const OUT_META   = path.join(ROOT, "data/species-meta.json");

function sanitizeYaml(raw) {
  let s = raw.replace(/\r\n/g, "\n").replace(/\t/g, "  ");

  // Space after colon for flow collections
  s = s.replace(/:\{/g, ": {");
  s = s.replace(/:\[/g, ": [");
  s = s.replace(/:\s+(\{|\[)/g, ": $1");

  // Convert inline block scalars (">" or "|") to newline + indented first line
  s = s.replace(
    /^(\s*[^:#\n][^:\n]*:\s*)([>|])\s+([^\n]+)$/gm,
    (_m, prefix, chevron, rest) => {
      const baseIndent = (prefix.match(/^\s*/)?.[0]?.length) ?? 0;
      const childIndent = baseIndent + 2; // YAML wants deeper indent than key
      const pad = " ".repeat(childIndent);
      return `${prefix}${chevron}\n${pad}${rest}`;
    }
  );

  // Second pass: enforce proper indentation after `key: >` / `key: |`
  // until a dedent to <= baseIndent or a new key/list starts.
  const lines = s.split("\n");
  const out = [];

  let inBlockScalar = false;
  let blockBaseIndent = 0;
  let minBlockIndent = 0;

  function lineIndent(str) {
    const m = str.match(/^(\s*)/);
    return m ? m[1].length : 0;
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();

    // Are we starting a new block scalar this line?
    const mScalarStart = line.match(/^(\s*[^:#\n][^:\n]*:\s*)([>|])\s*$/);
    if (mScalarStart) {
      inBlockScalar = true;
      blockBaseIndent = lineIndent(mScalarStart[1]);     // indent of the key
      minBlockIndent = blockBaseIndent + 2;              // children must be deeper
      out.push(line);
      continue;
    }

    // Are we in a block scalar?
    if (inBlockScalar) {
      const indent = lineIndent(line);

      // blank line inside a block scalar is allowed; keep as-is
      if (trimmed === "") {
        out.push(line);
        continue;
      }

      // If we dedent to <= baseIndent, the block scalar ends
      if (indent <= blockBaseIndent) {
        inBlockScalar = false;
        // fall through to normal handling of this line below
      } else {
        // Ensure at least minBlockIndent
        if (indent < minBlockIndent) {
          const extra = " ".repeat(minBlockIndent - indent);
          line = extra + line;
        }
        out.push(line);
        continue;
      }
    }

    out.push(line);
  }

  // Fold wrapped prose lines (only when previous looked like "key: value", not "key: >")
  const lines2 = out;
  const out2 = [];
  for (let i = 0; i < lines2.length; i++) {
    const line = lines2[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      out2.push(line);
      continue;
    }

    const prev = out2.length ? out2[out2.length - 1] : "";
    const prevLooksLikeKV =
      /:\s*(?:[^#]|$)/.test(prev) &&
      !/^\s*#/.test(prev) &&
      !/:\s*[>|]\s*$/.test(prev); // don’t fold immediately after block-scalar header

    const leadingSpaces = (line.match(/^(\s*)/)?.[1]?.length) ?? 0;
    const hasColonBeforeComment = /:[^#]*$/.test(trimmed.replace(/#.*$/, ""));
    const looksLikeListItem = /^\s*-\s+/.test(line);

    if (
      leadingSpaces >= 6 &&
      !looksLikeListItem &&
      !hasColonBeforeComment &&
      prevLooksLikeKV
    ) {
      out2[out2.length - 1] = prev.replace(/\s+$/, "") + " " + trimmed;
    } else {
      out2.push(line);
    }
  }

  return out2.join("\n");
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
      "\nIf it still fails, two manual fixes unblock it fast:\n" +
      "1) Ensure flow mappings have a space: key: { a: 1 }, key: [x, y]\n" +
      "2) Convert long text to block scalars:\n" +
      "   care_advice: |\n" +
      "     Your long paragraph here…\n"
    );
    process.exit(1);
  }
})();
