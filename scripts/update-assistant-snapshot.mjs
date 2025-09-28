// scripts/update-assistant-snapshot.mjs
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SNAPSHOT_PATH = join(process.cwd(), "ASSISTANT_SNAPSHOT.md");

function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function latestHumanCommit() {
  // Look back a bit and pick the first commit that isn't the snapshot-only auto-commit.
  const log = git(["log", "-n", "30", "--pretty=format:%h|%s"]);
  for (const line of log.split("\n")) {
    const [sha, subject = ""] = line.split("|");
    if (/Auto-update Assistant Snapshot/i.test(subject)) continue;

    // What files changed in this commit?
    const files = git(["diff-tree", "--no-commit-id", "--name-only", "-r", sha]).split("\n").filter(Boolean);
    const onlySnapshot = files.length === 1 && files[0] === "ASSISTANT_SNAPSHOT.md";
    if (onlySnapshot) continue;

    return { sha, subject };
  }
  // Fallback: first line
  const [sha = "", subject = ""] = (log.split("\n")[0] || "").split("|");
  return { sha, subject };
}

function currentCT() {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date()).reduce((a, x) => ((a[x.type] = x.value), a), {});
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute} CT`;
}

const EXCLUDE = new Set([".git",".github",".vscode",".next",".vercel","node_modules","dist","build","out",".turbo","coverage"]);

function buildTree(rootDir, maxDepth = 2) {
  function walk(dir, depth, prefix = "") {
    if (depth < 0) return [];
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return []; }
    entries.sort((a,b) => (a.isDirectory()===b.isDirectory()) ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1);
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
  try { top = readdirSync(rootDir, { withFileTypes: true }).filter(e => !EXCLUDE.has(e.name)).map(e => ({ name:e.name, isDir:e.isDirectory() })); } catch {}
  const ordered = [
    ...preferred.filter(n => top.find(e => e.name===n)).map(n => ({ name:n, isDir:true })),
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

if (!existsSync(SNAPSHOT_PATH)) {
  console.error("ASSISTANT_SNAPSHOT.md not found at repo root.");
  process.exit(1);
}

let src = readFileSync(SNAPSHOT_PATH, "utf8").replace(/\r\n/g, "\n");

const { sha, subject } = latestHumanCommit();
const updatedCT = currentCT();

let next = src;
next = replaceAfterLabel(next, "Latest commit", `${sha} — ${subject}`);
next = replaceAfterLabel(next, "Updated (America/Chicago)", updatedCT);

const tree = buildTree(process.cwd(), 2);
next = (() => {
  const idx = next.indexOf("## App Tree");
  if (idx === -1) return next;
  const after = next.slice(idx);
  const firstFence = after.indexOf("```");
  if (firstFence === -1) return next;
  const start = idx + firstFence;
  const rest = next.slice(start + 3);
  const secondFence = rest.indexOf("```");
  if (secondFence === -1) return next;
  const before = next.slice(0, start);
  const tail = rest.slice(secondFence + 3);
  const block = "```text\n" + tree + "\n```";
  return before + block + tail;
})();

if (next !== src) {
  writeFileSync(SNAPSHOT_PATH, next, "utf8");
  console.log("ASSISTANT_SNAPSHOT.md updated.");
} else {
  console.log("No changes to ASSISTANT_SNAPSHOT.md.");
}
