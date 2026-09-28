#!/usr/bin/env node
/* Build the static snapshot the site serves.
 *
 *   node build/snapshot.mjs
 *
 * Reads data/plans/<id>.graph.json (+ <id>.notes.json, produced by
 * schedule-to-graph.mjs) and writes:
 *
 *   data/g/<id>.json   { graph, validate, analyze, notes }  — one file per map
 *   data/index.json    { graphs, tree, templates, crosslinks } — the only file
 *                      index.html fetches
 *
 * Nothing is reimplemented: validation and analysis come from OmniFlow's own
 * browser-safe modules, which this site already ships under assets/lib/ and
 * which the Studio client uses at runtime.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const plansDir = join(root, "data", "plans");
const outDir = join(root, "data", "g");
mkdirSync(outDir, { recursive: true });

/* ---- OmniFlow's own modules, exactly as the browser loads them ---- */
const load = (p) => import(pathToFileURL(join(root, p)).href);
const core = await load("assets/lib/graph-core.js");
const analysis = await load("assets/lib/graph-analysis.js");
const groupSuggest = await load("assets/lib/group-suggest.js");

/* Published order is the gallery order. */
const ORDER = ["deep-work-week", "teaching-week", "conference-week"];
const FOLDER = "Schedules/Week plans";

/* The built-in template catalogue, as the Studio's "new graph" dialog shows it. */
const TEMPLATES = {
  en: [
    { id: "blank", name: "Blank canvas", desc: "Start from scratch — every kind of graph grows from here." },
    { id: "theorem-deps", name: "Theorem dependencies", desc: "Definition → lemma → proposition → theorem proof chain inside one math paper, with external citations." },
    { id: "paper-map", name: "Paper relation map", desc: "How papers extend, cite, generalize or contradict each other." },
    { id: "task-raci", name: "Task RACI", desc: "Task × role matrix: who is responsible, accountable, consulted and informed." },
    { id: "org-structure", name: "Org structure", desc: "Departments, reporting lines and headcount." },
    { id: "research-collab", name: "Research collaboration", desc: "PI, postdocs and students, with the dependencies between their outputs." },
    { id: "conversation-map", name: "Conversation map", desc: "How sessions and topics follow, answer and merge into each other." },
  ],
  zh: [
    { id: "blank", name: "空白图", desc: "从零开始，一切关系图都从这里长出来。" },
    { id: "theorem-deps", name: "定理依赖分析", desc: "单篇数学文章内部的定义 → 引理 → 命题 → 定理依赖链，附外部文献引用。" },
    { id: "paper-map", name: "论文关联分析", desc: "多篇论文之间的继承、引用、推广与矛盾关系。" },
    { id: "task-raci", name: "项目任务分工 (RACI)", desc: "任务 × 角色矩阵：R 执行 / A 问责 / C 咨询 / I 知会。" },
    { id: "org-structure", name: "公司运营架构", desc: "部门层级与汇报线，支持按部门分组着色。" },
    { id: "research-collab", name: "科研项目合作分工", desc: "PI / 博士后 / 博士生分工与成果产出依赖。" },
    { id: "conversation-map", name: "对话关联分析", desc: "多个会话/话题之间的接续、回应与汇聚关系。" },
  ],
};

const firstLine = (text) => String(text).split("\n")[0].slice(0, 120);

const ids = readdirSync(plansDir)
  .filter((f) => f.endsWith(".graph.json"))
  .map((f) => f.replace(/\.graph\.json$/, ""))
  .sort((a, b) => {
    const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

if (!ids.length) {
  console.error("no data/plans/*.graph.json — run node build/schedule-to-graph.mjs first");
  process.exit(1);
}

const graphs = [];
const now = new Date().toISOString();

for (const id of ids) {
  const payload = JSON.parse(readFileSync(join(plansDir, id + ".graph.json"), "utf8"));
  const notes = JSON.parse(readFileSync(join(plansDir, id + ".notes.json"), "utf8"));

  /* The shape the server stores: node.note carries the note's first line, and the
   * full markdown lives beside the graph. */
  const noteText = {};
  for (const n of notes) if (n.nodeId && n.content) noteText[n.nodeId] = n.content.trim();
  const summary = {};
  for (const [nodeId, text] of Object.entries(noteText)) summary[nodeId] = firstLine(text);

  const normalized = core.normalizeGraph({
    id,
    name: payload.name,
    description: payload.description || "",
    direction: payload.direction === "LR" ? "LR" : "TD",
    lang: "en",
    revision: 1,
    createdAt: now,
    updatedAt: now,
    nodeTypes: payload.nodeTypes || {},
    nodes: payload.nodes,
    edges: payload.edges,
    groups: payload.groups,
    notes: summary,
  });

  const verdict = core.validateGraph(normalized);
  const analyzed = Object.assign(
    {},
    analysis.analyzeGraph(normalized.nodes, normalized.edges, { trace: null }),
    { groupSuggestions: groupSuggest.suggestGroups(normalized) }
  );

  const bundle = {
    graph: normalized,
    validate: verdict,
    analyze: analyzed,
    notes: noteText,
  };
  writeFileSync(join(outDir, id + ".json"), JSON.stringify(bundle, null, 2) + "\n", "utf8");

  const bytes = statSync(join(outDir, id + ".json")).size;
  graphs.push({
    id,
    name: normalized.name,
    description: normalized.description,
    revision: normalized.revision,
    nodes: normalized.nodes.length,
    edges: normalized.edges.length,
    groups: normalized.groups.length,
    notes: Object.keys(noteText).length,
    valid: verdict.ok,
    warnings: verdict.warnings.length,
    updatedAt: normalized.updatedAt,
    bytes,
  });

  console.log(
    `${id.padEnd(16)} ${String(graphs.at(-1).nodes).padStart(3)} nodes  ` +
    `${String(graphs.at(-1).edges).padStart(3)} edges  ${graphs.at(-1).groups} groups  ` +
    `${String(graphs.at(-1).notes).padStart(3)} notes  valid=${verdict.ok}  warn=${verdict.warnings.length}  ${bytes}B`
  );
  if (!verdict.ok) console.error("   issues:", verdict.issues.join(" | "));
  if (verdict.warnings.length) console.error("   warnings:", verdict.warnings.slice(0, 4).join(" | "));
}

const assign = {};
for (const id of ids) assign[id] = FOLDER;

const index = {
  generatedAt: now,
  generator: "cadence build/snapshot.mjs",
  graphs,
  tree: { folders: ["Schedules", FOLDER], assign },
  templates: TEMPLATES,
  crosslinks: [],
};

writeFileSync(join(root, "data/index.json"), JSON.stringify(index, null, 2) + "\n", "utf8");
console.log(`\ndata/index.json written — ${graphs.length} maps`);
