#!/usr/bin/env node
/* Repository self-check — run before every push.
 *
 *   node build/check.mjs
 *
 * This site ships the OmniFlow Studio client unmodified and drives it from a
 * static snapshot. That combination fails in ways that are invisible until a
 * browser tries it: an endpoint the client calls but the static API never
 * implements, a snapshot missing a field a loader reads, or the two scripts
 * loaded in the wrong order. All of those are checkable statically, so they are
 * checked here instead of discovered by a visitor.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const problems = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);

const app = read("assets/app.js");
const api = read("assets/static-api.js");
const map = read("map.html");
const gallery = read("index.html");

/* ------------------------------------------------- 1 · API surface parity */

const want = new Set();
for (const m of app.matchAll(/\/api\/graph\/\$\{[^}]*\}\/([A-Za-z0-9_-]+)/g)) want.add(m[1]);

const have = new Set();
for (const m of api.matchAll(/rest === "([A-Za-z0-9_-]+)"/g)) have.add(m[1]);
for (const m of api.matchAll(/rest\.match\((\/\^[^\n]*?\/)\)/g)) {
  for (const lit of m[1].matchAll(/([A-Za-z0-9_-]{3,})/g)) {
    if (!["match", "rest"].includes(lit[1])) have.add(lit[1]);
  }
}

/* Actions the client can call that the snapshot deliberately does not serve.
 * `convo-path` belongs to the non-linear conversation panel, which only appears
 * for graphs carrying `conversation` metadata; none of the published plans do,
 * so the button that calls it is never rendered. Listed explicitly rather than
 * filtered by a wildcard, so a *new* gap still fails the check. */
const KNOWN_GAPS = new Set(["convo-path"]);

const unimplemented = [...want].filter((a) => !have.has(a) && !KNOWN_GAPS.has(a)).sort();
if (unimplemented.length) {
  fail("static-api.js", `the Studio client calls these graph actions but they are not handled: ${unimplemented.join(", ")}`);
}
const topLevel = ["/api/graphs", "/api/tree", "/api/templates", "/api/search", "/api/events", "/api/crosslinks"];
for (const p of topLevel) {
  if (!api.includes(`"${p}"`)) fail("static-api.js", `top-level endpoint not handled: ${p}`);
}

/* ------------------------------------------- 2 · credentials are not seeded */

if (/of-theme"\)\) localStorage\.setItem\("of-theme"/.test(api)) {
  fail("static-api.js", "of-theme is seeded — the Studio would stop following prefers-color-scheme");
}
if (!api.includes('localStorage.setItem("of-lang", "en")')) {
  fail("static-api.js", 'the English default is not seeded (expected localStorage.setItem("of-lang", "en"))');
}

/* ------------------------------------------------------ 3 · map.html wiring */

const iCss = map.indexOf("assets/app.css");
const iApi = map.indexOf("assets/static-api.js");
const iApp = map.indexOf("assets/app.js");
if (iApi < 0 || iApp < 0) fail("map.html", "the static API and/or the Studio client are not loaded");
else if (iApi > iApp) fail("map.html", "static-api.js must be loaded BEFORE app.js");
if (iCss < 0) fail("map.html", "assets/app.css is not linked");
for (const v of ["/vendor/katex/katex.min.css", "/vendor/katex/katex.min.js"]) {
  if (!map.includes(v)) fail("map.html", `vendor asset missing: ${v}`);
  if (!existsSync(join(root, v.replace(/^\//, "")))) fail("vendor/", `file not present on disk: ${v}`);
}
if (!existsSync(join(root, "vendor/katex/fonts"))) fail("vendor/", "katex fonts are missing");
if (!map.includes('id="canvasWrap"')) fail("map.html", "canvasWrap is gone — the snapshot badge would never mount");
if (!map.includes("cad-bar")) fail("map.html", "the snapshot badge is missing");
if (!/window\.Cadence/.test(api)) fail("static-api.js", "window.Cadence (the badge API) is not exposed");

/* ------------------------------------------- 4 · snapshot contract & data */

const index = JSON.parse(read("data/index.json"));
for (const key of ["generatedAt", "generator", "graphs", "tree", "templates", "crosslinks"]) {
  if (!(key in index)) fail("data/index.json", `missing top-level key: ${key}`);
}
if (!Array.isArray(index.graphs) || !index.graphs.length) fail("data/index.json", "no graphs published");
for (const key of ["en", "zh"]) {
  if (!Array.isArray(index.templates?.[key]) || !index.templates[key].length) {
    fail("data/index.json", `templates.${key} is missing or empty`);
  }
}
if (!Array.isArray(index.tree?.folders)) fail("data/index.json", "tree.folders is missing");

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
let totalNodes = 0, totalEdges = 0, totalNotes = 0;

for (const entry of index.graphs) {
  const bundlePath = `data/g/${entry.id}.json`;
  if (!existsSync(join(root, bundlePath))) {
    fail("data/index.json", `published graph has no bundle: ${entry.id}`);
    continue;
  }
  const bundle = JSON.parse(read(bundlePath));
  for (const key of ["graph", "validate", "analyze", "notes"]) {
    if (!(key in bundle)) fail(bundlePath, `missing key: ${key}`);
  }
  const g = bundle.graph;
  if (g.id !== entry.id) fail(bundlePath, `graph.id "${g.id}" does not match the published id "${entry.id}"`);
  if (g.lang !== "en") fail(bundlePath, `lang is "${g.lang}", expected "en"`);

  const nodeIds = new Set(g.nodes.map((n) => n.id));
  for (const n of g.nodes) {
    if (!n.id || !n.label) fail(bundlePath, `node ${n.id ?? "(no id)"} is missing an id or a label`);
    if (n.type && !/^(cat-)/.test(n.type) && !["start", "end", "process", "decision", "milestone", "task", "person",
      "department", "goal", "risk", "idea", "note", "definition", "lemma", "proposition", "theorem", "paper",
      "topic", "data", "custom", "day"].includes(n.type)) {
      fail(bundlePath, `node ${n.id} has an unregistered type "${n.type}"`);
    }
  }
  for (const e of g.edges) {
    if (!nodeIds.has(e.source)) fail(bundlePath, `edge ${e.id} starts at a node that does not exist: ${e.source}`);
    if (!nodeIds.has(e.target)) fail(bundlePath, `edge ${e.id} ends at a node that does not exist: ${e.target}`);
  }
  for (const grp of g.groups) {
    for (const m of grp.members) {
      if (!nodeIds.has(m)) fail(bundlePath, `group ${grp.id} references a node that does not exist: ${m}`);
    }
  }

  /* static-api.js only surfaces a note summary for keys present in graph.notes,
   * and the note panel reads the full text from bundle.notes. Both must line up. */
  const noteIds = Object.keys(bundle.notes);
  if (!noteIds.length) fail(bundlePath, "no note texts at all");
  for (const id of noteIds) {
    if (!nodeIds.has(id)) fail(bundlePath, `a note exists for a node that does not exist: ${id}`);
    if (!g.notes[id]) fail(bundlePath, `graph.notes has no summary for ${id} (the Studio would not show it)`);
    else if (g.notes[id] !== bundle.notes[id].split("\n")[0].slice(0, 120)) {
      fail(bundlePath, `graph.notes["${id}"] does not match the first line of the full note`);
    }
  }
  for (const id of nodeIds) {
    if (!bundle.notes[id]) fail(bundlePath, `node ${id} has no note`);
  }
  if (!bundle.validate?.ok) fail(bundlePath, `validation failed: ${(bundle.validate?.issues || []).join(" | ")}`);
  const warns = bundle.validate?.warnings || [];
  if (warns.length) fail(bundlePath, `validation warnings: ${warns.slice(0, 3).join(" | ")}`);

  /* A week-plan graph without weekday groups is not a schedule any more. */
  const groupLabels = g.groups.map((x) => x.label);
  const dayish = DAYS.filter((d) => groupLabels.some((l) => l.toLowerCase().startsWith(d.slice(0, 3))));
  if (!dayish.length) fail(bundlePath, "no weekday groups — this does not read as a schedule");

  totalNodes += g.nodes.length;
  totalEdges += g.edges.length;
  totalNotes += noteIds.length;
}

/* ---------------------------------------------------- 5 · gallery linking */

for (const entry of index.graphs) {
  if (!gallery.includes('map.html#')) fail("index.html", "the gallery does not link to map.html#<id>");
  break;
}
if (!gallery.includes("data/index.json")) fail("index.html", "the gallery never fetches data/index.json");
if (!gallery.includes("of-lang")) fail("index.html", "the gallery does not share the language key with the Studio");
if (!gallery.includes('localStorage.setItem("of-theme"')) {
  fail("index.html", "the gallery's explicit theme choice is not mirrored into of-theme");
}
if (/<script[^>]+src="https?:/.test(gallery) || /<script[^>]+src="https?:/.test(map)) {
  fail("index.html/map.html", "an external script is loaded — the site must stay dependency-free");
}

/* -------------------------------------------------------------- report */

if (problems.length) {
  console.error(`✗ ${problems.length} problem(s):`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log(
  `✓ checks passed — client actions ${want.size}/${want.size} handled, ` +
  `${index.graphs.length} maps, ${totalNodes} nodes, ${totalEdges} edges, ${totalNotes} notes, ` +
  `templates en/zh ${index.templates.en.length}/${index.templates.zh.length}`
);
