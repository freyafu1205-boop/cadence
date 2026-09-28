#!/usr/bin/env node
/* Turn a week plan into an OmniFlow graph.
 *
 *   node build/schedule-to-graph.mjs
 *
 * Reads data/plans/<id>.json (the authored week) and writes, next to it:
 *   <id>.graph.json   the of_import_json payload  (nodes / edges / groups / nodeTypes)
 *   <id>.notes.json   [{ nodeId, content }] for the per-node of_set_note pass
 *
 * Graph shape — a schedule read as a dependency map:
 *   one node per time block, grouped by weekday, chained in clock order with
 *   `flow` edges, plus `depends-on` edges wherever a block cannot start until
 *   another one is finished (that is what makes the analysis meaningful).
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const plansDir = join(root, "data", "plans");

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABEL = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday", sat: "Saturday", sun: "Sunday",
};
const DAY_COLOR = {
  mon: "#2563eb", tue: "#0d9488", wed: "#7c3aed", thu: "#c2410c",
  fri: "#b45309", sat: "#0369a1", sun: "#15803d",
};

/** Shapes per category, so the canvas reads at a glance. */
const SHAPE = {
  focus: "hexagon", writing: "rounded", reading: "rect", lecture: "hexagon",
  prep: "rounded", office: "rect", grading: "rect", meeting: "parallelogram",
  admin: "document", rest: "pill", travel: "parallelogram", session: "rect",
  talk: "hexagon", networking: "ellipse",
};

const ICON = {
  focus: "◆", writing: "✎", reading: "▤", lecture: "▶", prep: "✎",
  office: "◌", grading: "▤", meeting: "▦", admin: "▤", rest: "○",
  travel: "✈", session: "▦", talk: "◉", networking: "◇",
};

/** Cross-day dependencies that a plain clock order cannot express. */
const DEPENDS = {
  "deep-work-week": [
    ["dw-23", "dw-28", "the weekly review feeds the plan for the next week"],
    ["dw-08", "dw-27", "the verification run has to finish before the weekend"],
    ["dw-18", "dw-26", "the experiments set the reading for the following week"],
  ],
  "conference-week": [
    ["cw-07", "cw-08", "the parallel session is what the rehearsal is timed against"],
    ["cw-08", "cw-11", "no talk before it has been rehearsed in the room"],
    ["cw-02", "cw-11", "the talk cannot happen before the flight lands"],
    ["cw-11", "cw-15", "expenses can only be filed after the talk is given"],
    ["cw-11", "cw-25", "the write-up depends on having delivered the talk"],
  ],
  "teaching-week": [
    ["tw-01", "tw-02", "the lecture follows its preparation"],
    ["tw-05", "tw-06", "the second lecture follows its preparation"],
    ["tw-08", "tw-09", "grading continues the next morning"],
    ["tw-09", "tw-10", "feedback goes out once grading is finished"],
  ],
};

const minutes = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + (m || 0);
};

const slug = (s) => s.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");

function build(plan) {
  const catById = new Map(plan.categories.map((c) => [c.id, c]));

  const nodeTypes = {};
  for (const c of plan.categories) {
    nodeTypes["cat-" + c.id] = {
      label: c.nameZh,
      labelEn: c.name,
      shape: SHAPE[c.id] || "rounded",
      fill: c.color,
      border: c.color,
      textColor: "#ffffff",
      icon: ICON[c.id] || "◆",
    };
  }
  nodeTypes.day = {
    label: "日期", labelEn: "Day", shape: "milestone",
    fill: "#1f2937", border: "#111827", textColor: "#f9fafb", icon: "▮",
  };

  const nodes = [];
  const groups = [];
  const edges = [];
  let en = 0;

  DAYS.forEach((day, di) => {
    const blocks = (plan.events || [])
      .filter((e) => e.day === day)
      .sort((a, b) => minutes(a.start) - minutes(b.start));
    if (!blocks.length) return;

    const dayNodeId = "day-" + day;
    nodes.push({
      id: dayNodeId, type: "day", label: DAY_LABEL[day],
      x: di * 260, y: 0, w: 132, h: 56,
    });

    const members = [dayNodeId];
    let prev = dayNodeId;
    blocks.forEach((ev, bi) => {
      const id = ev.id;
      nodes.push({
        id, type: "cat-" + ev.category,
        label: ev.start + " · " + ev.title,
        x: di * 260, y: 120 + bi * 84, w: 220, h: 68,
      });
      members.push(id);
      edges.push({ id: "e" + String(++en).padStart(3, "0"), source: prev, target: id, type: "flow" });
      prev = id;
    });

    groups.push({
      id: "g-" + day, label: DAY_LABEL[day], color: DAY_COLOR[day], members,
    });
  });

  for (const [from, to, why] of DEPENDS[plan.id] || []) {
    const have = new Set(nodes.map((n) => n.id));
    if (!have.has(from) || !have.has(to)) continue;
    edges.push({
      id: "e" + String(++en).padStart(3, "0"),
      source: from, target: to, type: "depends-on", label: why,
    });
  }

  const graph = {
    name: plan.name + " — a week as a dependency map",
    description: plan.desc,
    direction: "TD",
    lang: "en",
    nodeTypes,
    nodes,
    edges,
    groups,
  };

  const notes = [];

  for (const day of DAYS) {
    const blocks = (plan.events || []).filter((e) => e.day === day)
      .sort((a, b) => minutes(a.start) - minutes(b.start));
    if (!blocks.length) continue;
    const total = blocks.reduce((s, e) => s + (minutes(e.end) - minutes(e.start)), 0);
    const byCat = {};
    for (const e of blocks) {
      const c = catById.get(e.category);
      byCat[c.name] = (byCat[c.name] || 0) + (minutes(e.end) - minutes(e.start));
    }
    notes.push({
      nodeId: "day-" + day,
      content:
        `${DAY_LABEL[day]} — ${blocks.length} blocks, ${(total / 60).toFixed(1)} h scheduled.\n` +
        `- First block: ${blocks[0].start} · ${blocks[0].title}\n` +
        `- Last block: ${blocks[blocks.length - 1].end} · ${blocks[blocks.length - 1].title}\n` +
        `- The day is one chain: each block starts when the previous one releases the time\n` +
        `- Split by category: ${Object.entries(byCat).map(([k, v]) => `${k} ${(v / 60).toFixed(1)} h`).join(", ")}\n` +
        `- Everything sits inside the ${plan.dayStart}:00–${plan.dayEnd}:00 window\n` +
        `- Day group colour: ${DAY_COLOR[day]}\n` +
        `- Upstream: the previous day's last block\n` +
        `- Downstream: the next block in this chain\n` +
        `- Use: a day is a chain, so a slipped block pushes the whole tail — that is what makes it visible here`,
    });
  }

  for (const ev of plan.events || []) {
    const cat = catById.get(ev.category);
    const dur = minutes(ev.end) - minutes(ev.start);
    const deps = (DEPENDS[plan.id] || []).filter(([f]) => f === ev.id);
    const usedBy = (DEPENDS[plan.id] || []).filter(([, t]) => t === ev.id);
    notes.push({
      nodeId: ev.id,
      content:
        `${DAY_LABEL[ev.day]} ${ev.start}–${ev.end} · ${ev.title} (${(dur / 60).toFixed(1)} h)\n` +
        `- Category: ${cat ? cat.name : ev.category}\n` +
        `- Window: ${ev.start} → ${ev.end}, inside the plan's ${plan.dayStart}:00–${plan.dayEnd}:00 day\n` +
        `- Runs inside: ${DAY_LABEL[ev.day]} (grouped with that day on the canvas)\n` +
        `- Clock order: it follows the previous block of the same day through a flow edge\n` +
        `- Duration is the real scheduling cost: ${dur} minutes, ${(dur / 60).toFixed(1)} h\n` +
        (deps.length
          ? `- Blocked by: ${deps.map(([f, , why]) => `${f} (${why})`).join("; ")}\n`
          : `- Blocked by: nothing outside its own day chain\n`) +
        (usedBy.length
          ? `- Blocks: ${usedBy.map(([, t, why]) => `${t} (${why})`).join("; ")}\n`
          : `- Blocks: nothing downstream\n`) +
        (ev.note ? `- Note: ${ev.note}\n` : "") +
        `- Acceptance: the block is done when its single stated outcome exists, not when the time is up`,
    });
  }

  return { graph, notes };
}

const files = readdirSync(plansDir).filter((f) => f.endsWith(".json") && !f.endsWith(".graph.json") && !f.endsWith(".notes.json"));
const wanted = new Set(["deep-work-week", "conference-week", "teaching-week"]);

let built = 0;
for (const file of files) {
  const id = file.replace(/\.json$/, "");
  if (!wanted.has(id)) continue;
  const plan = JSON.parse(readFileSync(join(plansDir, file), "utf8"));
  const { graph, notes } = build(plan);
  writeFileSync(join(plansDir, id + ".graph.json"), JSON.stringify(graph, null, 2) + "\n", "utf8");
  writeFileSync(join(plansDir, id + ".notes.json"), JSON.stringify(notes, null, 2) + "\n", "utf8");
  console.log(
    `${id.padEnd(16)} ${String(graph.nodes.length).padStart(3)} nodes  ` +
    `${String(graph.edges.length).padStart(3)} edges  ${graph.groups.length} groups  ` +
    `${notes.length} notes  → ${slug(graph.name)}`
  );
  built++;
}
if (!built) console.log("nothing built — data/plans/*.json not found");
