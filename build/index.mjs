#!/usr/bin/env node
/* Cadence — snapshot builder.
 *
 * Reads every plan in data/p/*.json and writes data/index.json, which is the only
 * file index.html fetches. Run it after adding or editing a plan:
 *
 *   node build/index.mjs
 *
 * The site itself does not need this step — it only keeps the gallery in sync.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const planDir = join(root, "data", "p");

const minutes = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + (m || 0);
};

const files = readdirSync(planDir).filter((f) => f.endsWith(".json")).sort();

const plans = files.map((file) => {
  const p = JSON.parse(readFileSync(join(planDir, file), "utf8"));
  if (p.id !== file.replace(/\.json$/, "")) {
    throw new Error(`${file}: id "${p.id}" does not match the file name`);
  }
  let total = 0;
  for (const ev of p.events ?? []) {
    const d = minutes(ev.end) - minutes(ev.start);
    if (d <= 0) throw new Error(`${file}: event ${ev.id} has a non-positive duration`);
    total += d;
  }
  return {
    id: p.id,
    name: p.name,
    nameZh: p.nameZh,
    desc: p.desc,
    descZh: p.descZh,
    accent: p.accent,
    blocks: (p.events ?? []).length,
    hours: Math.round((total / 60) * 10) / 10,
    categories: (p.categories ?? []).length,
    dayStart: p.dayStart,
    dayEnd: p.dayEnd,
  };
});

const out = {
  generatedAt: new Date().toISOString(),
  generator: "cadence build",
  plans,
};

writeFileSync(join(root, "data", "index.json"), JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`data/index.json written — ${plans.length} plans`);
for (const p of plans) console.log(`  ${p.id.padEnd(18)} ${String(p.blocks).padStart(3)} blocks  ${String(p.hours).padStart(5)} h  ${p.categories} categories`);
