// scripts/update-assistant-snapshot.mjs
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const SNAPSHOT_PATH = join(process.cwd(), "ASSISTANT_SNAPSHOT.md");

// --- Helpers ---------------------------------------------------------------

function getLatestCommit() {
  // %h = short SHA, %s = subject, %aI = author date ISO
  const raw = execSync('git log -1 --pretty=format:%h%n%s%n%aI', {
    encoding: "utf8",
  }).trim();
  const [shortSha, subject, isoDate] = raw.split("\n");

  // Format time in America/Chicago as "YYYY-MM-DD HH:mm CT"
  const chicago = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce((acc, p) => ((acc[p.type] = p.value), acc), {});
  const updatedCT = `${chicago.year}-${chicago.month}-${chicago.day} ${chicago.hour}:${chicago.minute} CT`;

  return { shortSha, subject, updatedCT };
}

const EXCLUDE = new Set([
  ".git",
  ".github",
  ".vscode",
  ".next",
  ".vercel",
  "node_modules",
  "dist",
  "build",
  "out",
  ".turbo",
  "coverage",
]);

import { readdirSync, statSync } from "node:fs";

function buildTree(rootDir, maxDepth = 2) {
  // Show top-level + 2 levels for key app areas; concise by default
  function walk(dir, depth, prefix = "") {
    if (depth < 0) return [];
    let lines = [];

    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return [];
    }

    // Sort: dirs first, then files (alpha)
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const e of entries) {
      if (EXCLUDE.has(e.name)) continue;
      const path = join(dir, e.name);
      const isDir = e.isDirectory();

      // only show selected top-level directories prominently
      const rel = path.replace(`${process.cwd()}/`, "");
      const name = rel === "" ? e.name : e.name;

      lines.push(`${prefix}${name}${isDir ? "/" : ""}`);
      if (isDir && depth > 0) {
        lines.push(...walk(path, depth - 1, prefix + "  "));
      }
    }
    return lines;
  }

  // Prefer showing conventional folders near the top in the rendered block
  const preferredOrder = ["app", "components", "lib", "public", "db", "docs"];
  const topEntries = readdirSync(rootDir, { withFileTypes: true })
    .filter((e) => !EXCLUDE.has(e.name))
    .map((e) => ({ name: e.name, isDir: e.isDirectory() }));

  const ordered = [
    ...preferredOrder
      .filter((p) => topEntries.find((e) => e.name === p))
      .map((p) => ({ name: p, isDir: true })),
    ...topEntries.filter((e) => !preferredOrder.includes(e.name)),
  ];

  let lines = [];
  for (const e of ordered) {
    const full = join(rootDir, e.name);
    if (!existsSync(full)) continue;
    const isDir = e.isDir;
    lines.push(`${e.name}${isDir ? "/" : ""}`);
    if (isDir) {
      lines.push(...walk(full, maxDepth - 1, "  "));
    }
  }
  return lines.join("\n");
}

function replaceLine(md, label, replacement) {
  const re = new RegExp(`^- \\*\\*${label}\\*\\*: .*`, "m");
  if (!re.test(md)) return md;
  return md.replace(re, `- **${label}**: ${replacement}`);
}

function replaceAppTree(md, newTree) {
  // Find the "## App Tree" section, then replace the first fenced block after it
  const headerIdx = md.indexOf("## App Tree");
  if (headerIdx === -1) return md;

  const afterHeader = md.slice(headerIdx);
  const firstFence = afterHeader.indexOf("```");
  if (firstFence === -1) return md;

  const start = headerIdx + firstFence;
  const rest = md.slice(start + 3);
  const secondFence = rest.indexOf("```");
  if (secondFence === -1) return md;

  const before = md.slice(0, start);
  const after = rest.slice(secondFence + 3);

  const newBlock = "```text\n" + newTree + "\n```";
  return before + newBlock + after;
}

// --- Main -----------------------------------------------------------------

if (!existsSync(SNAPSHOT_PATH)) {
  console.error("ASSISTANT_SNAPSHOT.md not found at repo root.");
  process.exit(1);
}

const src = readFileSync(SNAPSHOT_PATH, "utf8");

const { shortSha, subject, updatedCT } = getLatestCommit();
const latestLine = `${shortSha} — ${subject}`;
let next = replaceLine(src, "Latest commit", latestLine);
next = replaceLine(next, "Updated (America/Chicago)", updatedCT);

const tree = buildTree(process.cwd(), 2);
next = replaceAppTree(next, tree);

// Only write if changed
if (next !== src) {
  writeFileSync(SNAPSHOT_PATH, next, "utf8");
  console.log("ASSISTANT_SNAPSHOT.md updated.");
} else {
  console.log("No changes to ASSISTANT_SNAPSHOT.md.");
}
