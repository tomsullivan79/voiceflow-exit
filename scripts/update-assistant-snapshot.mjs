// scripts/update-assistant-snapshot.mjs
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SNAPSHOT_PATH = join(process.cwd(), "ASSISTANT_SNAPSHOT.md");

// --- Helpers ---------------------------------------------------------------

function getLatestCommit() {
  // Latest *human* commit (the one that triggered the run)
  const raw = execSync('git log -1 --pretty=format:%h%n%s%n%aI', { encoding: "utf8" }).trim();
  const [shortSha, subject/*, isoDate*/] = raw.split("\n");

  // Current CT time as "YYYY-MM-DD HH:mm CT"
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date()).reduce((acc, p) => ((acc[p.type] = p.value), acc), {});
  const updatedCT = `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} CT`;

  return { shortSha, subject, updatedCT };
}

const EXCLUDE = new Set([
  ".git", ".github", ".vscode", ".next", ".vercel",
  "node_modules", "dist", "build", "out", ".turbo", "coverage",
]);

function buildTree(rootDir, maxDepth = 2) {
  function walk(dir, depth, prefix = "") {
    if (depth < 0) return [];
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return []; }
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });
    const lines = [];
    for (const e of entries) {
      if (EXCLUDE.has(e.name)) continue;
      const isDir = e.isDirectory();
      lines.push(`${prefix}${e.name}${isDir ? "/" : ""}`);
      if (isDir && depth > 0) lines.push(...walk(join(dir, e.name), depth - 1, prefix + "  "));
    }
    return lines;
  }

  const preferred = ["app", "components", "lib", "public", "db", "docs", "assistant"];
  const top = readdirSync(rootDir, { withFileTypes: true })
    .filter((e) => !EXCLUDE.has(e.name))
    .map((e) => ({ name: e.name, isDir: e.isDirectory() }));

  const ordered = [
    ...preferred.filter((n) => top.find((e) => e.name === n)).map((n) => ({ name: n, isDir: true })),
    ...top.filter((e) => !preferred.includes(e.name)),
  ];

  const lines = [];
  for (const e of ordered) {
    const full = join(rootDir, e.name);
    if (!existsSync(full)) continue;
    lines.push(`${e.name}${e.isDir ? "/" : ""}`);
    if (e.isDir) lines.push(...walk(full, maxDepth - 1, "  "));
  }
  return lines.join("\n");
}

function replaceLineFlexible(md, label, replacement) {
  // Allow leading spaces, dash or asterisk bullet, any amount of spacing before colon
  const re = new RegExp(`^[ \\t]*[-*]\\s+\\*\\*${label}\\*\\*\\s*:\\s*.*$`, "m");
  if (re.test(md)) return md.replace(re, `- **${label}**: ${replacement}`);
  return md;
}

function ensureLineExists(md, label, fallbackValue, insertAfterLabel = "Default branch") {
  // If the labeled line isn't present anywhere, insert it one line after the insertAfterLabel line
  if (md.includes(`**${label}**`)) return md;
  const lines = md.split(/\r?\n/);
  const idx = lines.findIndex(l => l.includes(`**${insertAfterLabel}**`));
  const insertion = `- **${label}**: ${fallbackValue}`;
  if (idx !== -1) {
    lines.splice(idx + 1, 0, insertion);
    return lines.join("\n");
  }
  // If we can't find the anchor, append near the top
  const headerIdx = lines.findIndex(l => l.startsWith("## Repo & Build"));
  if (headerIdx !== -1) {
    lines.splice(headerIdx + 1, 0, insertion);
    return lines.join("\n");
  }
  return insertion + "\n" + md;
}

function replaceAppTree(md, newTree) {
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

let src = readFileSync(SNAPSHOT_PATH, "utf8");

// Normalize EOLs to avoid false negatives
src = src.replace(/\r\n/g, "\n");

const { shortSha, subject, updatedCT } = getLatestCommit();

let next = src;
next = replaceLineFlexible(next, "Latest commit", `${shortSha} — ${subject}`);
next = ensureLineExists(next, "Latest commit", `${shortSha} — ${subject}`);

next = replaceLineFlexible(next, "Updated (America/Chicago)", updatedCT);
next = ensureLineExists(next, "Updated (America/Chicago)", updatedCT);

const tree = buildTree(process.cwd(), 2);
next = replaceAppTree(next, tree);

if (next !== src) {
  writeFileSync(SNAPSHOT_PATH, next, "utf8");
  console.log("ASSISTANT_SNAPSHOT.md updated.");
} else {
  console.log("No changes to ASSISTANT_SNAPSHOT.md.");
}
