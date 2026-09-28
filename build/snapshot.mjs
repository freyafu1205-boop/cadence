#!/usr/bin/env node
/* Build the static snapshot this site serves, straight out of a local OmniFlow vault.
 *
 *   node build/snapshot.mjs
 *
 * build/publish.json lists the graph ids to publish. For each one this reads
 *
 *   <vault>/graphs/<id>/graph.json      the single source of truth
 *   <vault>/graphs/<id>/notes/<node>.md the note behind every card
 *   <vault>/tree.json                   the folder tree, so the Studio sidebar matches
 *
 * and writes
 *
 *   data/g/<id>.json   { graph, validate, analyze, notes }
 *   data/index.json    { graphs, tree, templates, crosslinks } — the only file
 *                      index.html fetches
 *
 * Validation and analysis are not reimplemented: they come from OmniFlow's own
 * browser-safe modules, which this site already ships under assets/lib/ and which
 * the Studio client uses at runtime.
 *
 * The vault location is $OF_HOME, or ~/.omni-flow when that is unset.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { homedir } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "data", "g");
mkdirSync(outDir, { recursive: true });

const vault = process.env.OF_HOME
  ? process.env.OF_HOME
  : join(homedir(), ".omni-flow");

const publish = JSON.parse(readFileSync(join(root, "build", "publish.json"), "utf8"));
const ids = publish.graphs || [];
if (!ids.length) {
  console.error("build/publish.json lists no graphs — nothing to publish");
  process.exit(1);
}

/* ---- OmniFlow's own modules, exactly as the browser loads them ---- */
const load = (p) => import(pathToFileURL(join(root, p)).href);
const core = await load("assets/lib/graph-core.js");
const analysis = await load("assets/lib/graph-analysis.js");
const groupSuggest = await load("assets/lib/group-suggest.js");

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

/* ---- the vault's folder tree, so the Studio sidebar matches the real layout ---- */
let tree = { folders: [], assign: {} };
const treePath = join(vault, "tree.json");
if (existsSync(treePath)) {
  const t = JSON.parse(readFileSync(treePath, "utf8"));
  const used = new Set(ids.map((id) => t.assign?.[id]).filter(Boolean));
  const folders = new Set();
  for (const f of used) {
    const parts = f.split("/");
    for (let i = 1; i <= parts.length; i++) folders.add(parts.slice(0, i).join("/"));
  }
  tree = { folders: [...folders].sort(), assign: Object.fromEntries(ids.map((id) => [id, t.assign?.[id] ?? ""])) };
}

const graphs = [];
for (const id of ids) {
  const dir = join(vault, "graphs", id);
  const graphPath = join(dir, "graph.json");
  if (!existsSync(graphPath)) {
    console.error(`✗ ${id}: not found in the vault at ${graphPath}`);
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(graphPath, "utf8"));

  /* Notes live beside the graph, one markdown file per node. */
  const notesDir = join(dir, "notes");
  const noteText = {};
  if (existsSync(notesDir)) {
    for (const f of readdirSync(notesDir)) {
      if (!f.endsWith(".md")) continue;
      noteText[f.replace(/\.md$/, "")] = readFileSync(join(notesDir, f), "utf8").trim();
    }
  } else if (raw.notes && typeof raw.notes === "object") {
    for (const [k, v] of Object.entries(raw.notes)) noteText[k] = String(v);
  }

  /* The shape the server stores: node.note carries the note's first line, and the
   * full markdown lives beside the graph. */
  const summary = {};
  for (const [nodeId, text] of Object.entries(noteText)) {
    summary[nodeId] = text.split("\n")[0].slice(0, 120);
  }

  const graph = core.normalizeGraph(Object.assign({}, raw, { notes: summary }));
  const verdict = core.validateGraph(graph);
  const analyzed = Object.assign(
    {},
    analysis.analyzeGraph(graph.nodes, graph.edges, { trace: null }),
    { groupSuggestions: groupSuggest.suggestGroups(graph) }
  );

  writeFileSync(
    join(outDir, id + ".json"),
    JSON.stringify({ graph, validate: verdict, analyze: analyzed, notes: noteText }, null, 2) + "\n",
    "utf8"
  );

  const bytes = statSync(join(outDir, id + ".json")).size;
  graphs.push({
    id,
    name: graph.name,
    description: graph.description,
    revision: graph.revision,
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    groups: graph.groups.length,
    notes: Object.keys(noteText).length,
    valid: verdict.ok,
    warnings: verdict.warnings.length,
    updatedAt: graph.updatedAt,
    bytes,
  });

  console.log(
    `${id}\n  ${graph.nodes.length} nodes · ${graph.edges.length} edges · ${graph.groups.length} groups · ` +
    `${Object.keys(noteText).length} notes · valid=${verdict.ok} · ${verdict.warnings.length} warnings · ${bytes}B`
  );
  if (!verdict.ok) for (const i of verdict.issues) console.error("   issue: " + i);
  for (const w of verdict.warnings) console.error("   warning: " + w);
}

writeFileSync(
  join(root, "data", "index.json"),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    generator: "cadence build/snapshot.mjs",
    graphs,
    tree,
    templates: TEMPLATES,
    crosslinks: [],
  }, null, 2) + "\n",
  "utf8"
);
console.log(`\ndata/index.json written — ${graphs.length} map(s) from ${vault}`);
