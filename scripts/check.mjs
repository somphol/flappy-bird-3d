#!/usr/bin/env node
// Dependency-free release checks for Flappy Bird 3D.
//
//   node scripts/check.mjs
//
// Exit 0 and print "OK <n> checks" when the release is internally consistent.
// Exit 1 and print one FAIL line per problem otherwise. No network access.

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
let checks = 0;

function pass() {
  checks += 1;
}

function fail(message) {
  checks += 1;
  failures.push(message);
}

function checkFile(relPath) {
  const full = join(root, relPath);
  if (existsSync(full) && statSync(full).isFile()) {
    pass();
  } else {
    fail(`missing file: ${relPath}`);
  }
}

function check(condition, message) {
  if (condition) pass();
  else fail(message);
}

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function isExternal(target) {
  return (
    /^(?:https?:)?\/\//i.test(target) ||
    /^(?:data|blob|mailto|tel|javascript):/i.test(target) ||
    target.startsWith("#")
  );
}

function localTarget(target) {
  let value = target.trim();
  if (value.startsWith("<") && value.endsWith(">")) value = value.slice(1, -1);
  value = value.split(/\s+/)[0];
  if (!value || isExternal(value)) return null;
  value = value.split("#")[0].split("?")[0];
  if (!value) return null;
  try {
    value = decodeURIComponent(value);
  } catch {
    // Keep the raw value; existence will fail with a useful message.
  }
  return value;
}

/* 1. Required release files ------------------------------------------------ */

const required = [
  "index.html",
  "README.md",
  "AGENTS.md",
  "LICENSE",
  ".nojekyll",
  "robots.txt",
  "sitemap.xml",
  "state.json",
  "STATE.md",
  "CHANGELOG.md",
  "docs/ARCHITECTURE.md",
  "docs/REPRODUCTION.md",
  "docs/TESTING.md",
  "docs/DEPLOYMENT.md",
  "docs/social-card.png",
  "scripts/check.mjs",
  "skills/flappy-bird-3d/SKILL.md",
  "skills/flappy-bird-3d/ATTRIBUTION.md",
  "skills/flappy-bird-3d/references/method.md",
  "skills/flappy-bird-3d/references/lessons.md",
  "skills/flappy-bird-3d/references/verification.md",
  "skills/flappy-bird-3d/assets/template/index.html"
];

for (const relPath of required) checkFile(relPath);

/* 2. Local src/href references in index.html ------------------------------- */

const indexHtml = readFileSync(join(root, "index.html"), "utf8");
const htmlRefRe = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;

for (const match of indexHtml.matchAll(htmlRefRe)) {
  const target = localTarget(match[1]);
  if (target === null) continue;
  const full = join(root, target.replace(/^\/+/, ""));
  if (existsSync(full)) {
    pass();
  } else {
    fail(`index.html points at missing file: ${match[1]}`);
  }
}

/* 3. Relative Markdown links ------------------------------------------------ */

const markdownFiles = [
  "README.md",
  "AGENTS.md",
  ...walk(join(root, "docs"))
    .filter((file) => extname(file) === ".md")
    .map((file) => relative(root, file)),
  ...walk(join(root, "skills"))
    .filter((file) => extname(file) === ".md")
    .map((file) => relative(root, file))
];

const markdownLinkRe = /!?\[[^\]]*\]\(([^)]+)\)/g;
const markdownHtmlRefRe = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;

for (const relPath of markdownFiles) {
  const full = join(root, relPath);
  if (!existsSync(full)) {
    fail(`missing Markdown file listed for link check: ${relPath}`);
    continue;
  }
  const text = readFileSync(full, "utf8");
  const targets = [
    ...Array.from(text.matchAll(markdownLinkRe), (match) => match[1]),
    ...Array.from(text.matchAll(markdownHtmlRefRe), (match) => match[1])
  ];

  for (const raw of targets) {
    const target = localTarget(raw);
    if (target === null) continue;
    const destination = target.startsWith("/")
      ? join(root, target.slice(1))
      : resolve(dirname(full), target);
    if (existsSync(destination)) {
      pass();
    } else {
      fail(`${relPath} links to missing file: ${raw}`);
    }
  }
}

/* 4. JavaScript syntax ------------------------------------------------------ */

const jsFiles = walk(root).filter((file) => /\.(?:js|mjs)$/.test(file));

for (const file of jsFiles) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
    pass();
  } catch (error) {
    fail(`node --check failed: ${relative(root, file)}\n${error.stderr?.toString() ?? error.message}`);
  }
}

const inlineModule = indexHtml.match(/<script\s+type=["']module["']>([\s\S]*?)<\/script>/i);

if (!inlineModule) {
  fail("index.html has no inline <script type=\"module\"> block");
} else {
  const tempDir = mkdtempSync(join(tmpdir(), "flappy3d-check-"));
  const tempFile = join(tempDir, "inline-module.mjs");
  try {
    writeFileSync(tempFile, inlineModule[1], "utf8");
    execFileSync(process.execPath, ["--check", tempFile], { stdio: "pipe" });
    pass();
  } catch (error) {
    fail(`node --check failed for index.html inline module\n${error.stderr?.toString() ?? error.message}`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

/* 5. JSON ------------------------------------------------------------------ */

const jsonFiles = readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
  .map((entry) => entry.name);

for (const file of jsonFiles) {
  try {
    JSON.parse(readFileSync(join(root, file), "utf8"));
    pass();
  } catch (error) {
    fail(`invalid JSON: ${file} — ${error.message}`);
  }
}

/* 6. Skill template must be the released source ---------------------------- */

const templatePath = join(root, "skills/flappy-bird-3d/assets/template/index.html");
if (existsSync(templatePath)) {
  const source = readFileSync(join(root, "index.html"));
  const template = readFileSync(templatePath);
  check(
    source.equals(template),
    "skill template index.html is not byte-identical to the release index.html"
  );
}

/* 7. Report ---------------------------------------------------------------- */

if (failures.length) {
  for (const message of failures) console.error(`FAIL ${message}`);
  console.error(`\n${failures.length} failure(s) in ${checks} checks`);
  process.exit(1);
}

console.log(`OK ${checks} checks`);
