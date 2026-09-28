#!/usr/bin/env node
/* Cadence — repository self-check.
 *
 * Cheap, dependency-free guards for the mistakes that actually break a static
 * site: a selector that matches nothing, and a translation key that only exists
 * in one language. Run it before every push:
 *
 *   node build/check.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const pages = ["index.html", "plan.html"];
const scripts = ["assets/i18n.js", "assets/ui.js", "assets/home.js", "assets/planner.js"];

const problems = [];
const note = (file, msg) => problems.push(`${file}: ${msg}`);

/* ---------------------------------------------------------------- 1 · ids */

const idsInPage = new Map(pages.map((p) => [p, new Set()]));
for (const page of pages) {
  const html = read(page);
  for (const m of html.matchAll(/\sid="([^"]+)"/g)) idsInPage.get(page).add(m[1]);
}

/** Which page owns each script, so a missing id is reported against the right file. */
const scriptsByPage = {
  "index.html": ["assets/ui.js", "assets/home.js", "assets/i18n.js"],
  "plan.html": ["assets/ui.js", "assets/planner.js", "assets/i18n.js"],
};

for (const [page, files] of Object.entries(scriptsByPage)) {
  const ids = idsInPage.get(page);
  for (const file of files) {
    const js = read(file);
    for (const m of js.matchAll(/\$\("#([A-Za-z0-9_-]+)"\)/g)) {
      if (!ids.has(m[1])) note(file, `$("#${m[1]}") has no matching id in ${page}`);
    }
    for (const m of js.matchAll(/getElementById\("([A-Za-z0-9_-]+)"\)/g)) {
      if (!ids.has(m[1])) note(file, `getElementById("${m[1]}") has no matching id in ${page}`);
    }
  }
}

/* ------------------------------------------------------------- 2 · i18n keys */

const i18nSrc = read("assets/i18n.js");
const dictBody = i18nSrc.slice(i18nSrc.indexOf("const CADENCE_I18N"), i18nSrc.indexOf("const LANG_KEY"));
const enBlock = dictBody.slice(dictBody.indexOf("en: {"), dictBody.indexOf("zh: {"));
const zhBlock = dictBody.slice(dictBody.indexOf("zh: {"), dictBody.lastIndexOf("};"));

const keysOf = (block) => new Set([...block.matchAll(/"([a-z0-9]+(?:\.[a-z0-9]+)*)"\s*:/g)].map((m) => m[1]));
const en = keysOf(enBlock);
const zh = keysOf(zhBlock);

for (const k of en) if (!zh.has(k)) note("assets/i18n.js", `key "${k}" is missing from zh`);
for (const k of zh) if (!en.has(k)) note("assets/i18n.js", `key "${k}" is missing from en`);

const used = new Set();
for (const page of pages) {
  const html = read(page);
  for (const m of html.matchAll(/data-i18n(?:-title|-placeholder|-aria)?="([^"]+)"/g)) used.add(m[1]);
  for (const m of html.matchAll(/data-i18n-aria="([^"]+)"/g)) used.add(m[1]);
}
for (const file of scripts) {
  const js = read(file);
  for (const m of js.matchAll(/\bt\("([a-z0-9]+(?:\.[a-z0-9]+)*)"/g)) used.add(m[1]);
  for (const m of js.matchAll(/\bt\("([a-z0-9.]+)"\s*\+/g)) {
    // dynamic keys such as t("day." + key) — expand the known suffixes
    const prefix = m[1];
    if (prefix === "day.") {
      for (const d of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]) {
        used.add("day." + d);
        used.add("day." + d + ".l");
      }
    }
  }
}
for (const k of used) if (!en.has(k)) note("i18n", `used key "${k}" is not defined`);

/* -------------------------------------------------------------- 3 · data */

const planDir = join(root, "data", "p");
const planFiles = readdirSync(planDir).filter((f) => f.endsWith(".json"));
const index = JSON.parse(read("data/index.json"));
const indexIds = new Set(index.plans.map((p) => p.id));

for (const file of planFiles) {
  const id = file.replace(/\.json$/, "");
  if (!indexIds.has(id)) note("data/index.json", `plan "${id}" exists but is not in the index — run node build/index.mjs`);
}
for (const id of indexIds) {
  if (!planFiles.includes(id + ".json")) note("data/index.json", `index lists "${id}" but data/p/${id}.json is gone`);
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const toMin = (s) => { const [h, m] = String(s).split(":").map(Number); return h * 60 + (m || 0); };

for (const file of planFiles) {
  const plan = JSON.parse(read(join("data", "p", file)));
  const catIds = new Set((plan.categories || []).map((c) => c.id));
  const seen = new Set();
  for (const ev of plan.events || []) {
    if (!DAYS.includes(ev.day)) note(file, `${ev.id}: unknown day "${ev.day}"`);
    if (!catIds.has(ev.category)) note(file, `${ev.id}: unknown category "${ev.category}"`);
    if (toMin(ev.end) <= toMin(ev.start)) note(file, `${ev.id}: end is not after start`);
    if (toMin(ev.start) < plan.dayStart * 60 || toMin(ev.end) > plan.dayEnd * 60) {
      note(file, `${ev.id}: outside the ${plan.dayStart}:00–${plan.dayEnd}:00 window and will not render`);
    }
    if (seen.has(ev.id)) note(file, `duplicate event id "${ev.id}"`);
    seen.add(ev.id);
    for (const field of ["title", "titleZh"]) if (!ev[field]) note(file, `${ev.id}: missing ${field}`);
  }
  for (const field of ["name", "nameZh", "desc", "descZh"]) {
    if (!plan[field]) note(file, `missing ${field}`);
  }
}

/* ---------------------------------------------------------------- report */

if (problems.length) {
  console.error(`✗ ${problems.length} problem(s):`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log(`✓ checks passed — ${pages.length} pages, ${scripts.length} scripts, ${planFiles.length} plans, ${en.size} i18n keys (en = zh)`);
