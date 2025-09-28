// scripts/update-assistant-snapshot.mjs
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SNAPSHOT_PATH = join(process.cwd(), "ASSISTANT_SNAPSHOT.md");

function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function getLatestHumanCommit() {
  // Look back a few commits and pick the first non-bot author.
  const raw = execSync('git log -n 15 --pretty=format:%h|%an|%s', { encoding: "utf8" }).trim();
  const line = raw.split("\n").find(l => !l.includes("github-actions[bot]")) || raw.split("\n")[0];
  const [shortSha, author, subject] = line.split("|");
  return { shortSha, subject };
}

function currentCT() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date()).reduce((acc, p) => ((acc[p.type] = p.value), acc), {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} CT`;
}

const EXCLUDE = new Set([
  ".git",".github",".vscode",".next",".vercel","node_modules","dist","build","out",".turbo","coverage",
]);

function buildTree(rootDir, maxDepth = 2) {
  function walk(dir, depth, prefix = "") {
    if (depth < 0) return [];
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return []; }
    entries.sort((a, b) => (a.isDirectory() === b.isDirectory()) ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1);
    const lines = [];
    for (const e of entries) {
      if (EXCLUDE.has(e.name)) continue;
      const isDir = e.isDirectory();
      lines.push(`${prefix}${e.name}${isDir ? "/" : ""}`);
      if (isDir && depth > 0) lines.push(...walk(join(dir, e.name), depth - 1, prefix + "  "));
    }
    return lines;
  }
  const preferred = ["app","components","lib","public","db","docs","assistant"];
  let top = [];
  try { top = readdirSync(rootDir, { withFileTypes: true }).filter(e => !EXCLUDE.has(e.name)).map(e => ({ name: e.name, isDir: e.isDirectory() })); } catch {}
  const ordered = [
    ...preferred.filter(n => top.find(e => e.name === n)).map(n => ({ name: n, isDir: true })),
    ...top.filter(e => !preferred.includes(e.name)),
  ];
  const lines = [];
  for (const e of ordered) {
    const full = join(rootDir, e.name);
    lines.push(`${e.name}${e.isDir ? "/" : ""}`);
    if (e.isDir) lines.push(...walk(full, maxDepth - 1, "  "));
  }
  return lines.join("\n");
}

// Replace text after a bold label, inserting if missing.
function replaceAfterLabel(md, label, replacement) {
  const re = new RegExp(`(\\*\\*${escapeRegExp(label)}\\*\\*\\s*:\\s*)(.*)`);
  if (re.test(md)) return md.replace(re, `$1${replacement}`);
  const lines = md.split(/\r?\n/);
  const anchor = lines.findIndex(l => l.trim() === "## Repo & Build");
  const insertion = `- **${label}**: ${replacement}`;
  if (anchor !== -1) { lines.splice(anchor + 1, 0, insertion); return lines.join("\n"); }
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

if (!existsSync(SNAPSHOT_PATH)) {
  console.error("ASSISTANT_SNAPSHOT.md not found at repo root.");
  process.exit(1);
}

let src = readFileSync(SNAPSHOT_PATH, "utf8").replace(/\r\n/g, "\n");

const { shortSha, subject } = getLatestHumanCommit();
const updatedCT = currentCT();

let next = src;
next = replaceAfterLabel(next, "Latest commit", `${shortSha} — ${subject}`);
next = replaceAfterLabel(next, "Updated (America/Chicago)", updatedCT);

const tree = buildTree(process.cwd(), 2);
next = replaceAppTree(next, tree);

if (next !== src) {
  writeFileSync(SNAPSHOT_PATH, next, "utf8");
  console.log("ASSISTANT_SNAPSHOT.md updated.");
} else {
  console.log("No changes to ASSISTANT_SNAPSHOT.md.");
}
