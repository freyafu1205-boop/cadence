/* Cadence — internationalisation.
   English is the source language and the default; Chinese is a full translation.
   Markup uses  data-i18n="key"  (textContent)  and
   data-i18n-title / data-i18n-placeholder / data-i18n-aria  (attributes). */

const CADENCE_I18N = {
  en: {
    "ui.brand.tag": "Schedule planner",
    "ui.width": "Width",
    "ui.fluid": "Fluid",
    "ui.focus": "Focus",
    "ui.theme": "Theme",
    "ui.auto": "Auto",
    "ui.light": "Light",
    "ui.dark": "Dark",
    "ui.lang": "Language",
    "ui.lang.switch": "Switch to Chinese",
    "ui.theme.switch": "Theme: {v}",
    "ui.width.switch": "Layout width: {v}",
    "ui.offline": "Static site — no backend",

    "home.eyebrow": "Static schedule planner",
    "home.title": "Plan a week that actually holds.",
    "home.lede":
      "Cadence is a self-contained planner. Every plan is a plain JSON snapshot, the grid is a real " +
      "weekly calendar, and your edits stay in your own browser — nothing is uploaded anywhere.",
    "home.plans": "Plans",
    "home.count": "{n} in this snapshot",
    "home.open": "Open planner",
    "home.blocks": "{n} blocks",
    "home.hours": "{n} h scheduled",
    "home.cats": "{n} categories",
    "home.updated": "updated {d}",
    "home.how": "How it works",
    "home.how.body":
      "Read the snapshot, then edit freely: create, move, resize and delete blocks. Changes are kept " +
      "in local storage per plan, so a reload restores your week, not the published one. Reset returns " +
      "you to the snapshot.",
    "home.credits": "Two static pages, no server, no build step. Deployed on GitHub Pages.",
    "home.empty": "No plans in this snapshot yet.",
    "home.loaderror": "Could not load data/index.json. Serve the folder over HTTP (a file:// page cannot fetch JSON).",

    "plan.loading": "Loading plan…",
    "plan.back": "All plans",
    "plan.today": "Today",
    "plan.prev": "Previous week",
    "plan.next": "Next week",
    "plan.thisweek": "This week",
    "plan.add": "New block",
    "plan.actions": "Plan",
    "plan.export": "Export JSON",
    "plan.import": "Import JSON",
    "plan.reset": "Reset to snapshot",
    "plan.legend": "Categories",
    "plan.agenda": "Agenda",
    "plan.metrics": "Time by category",
    "plan.week": "Week",
    "plan.hidden": "{n} categor{y} hidden",
    "plan.notfound": "Plan “{id}” is not in this snapshot.",

    "agenda.empty": "Nothing scheduled in this week.",
    "agenda.all": "All",

    "metrics.scheduled": "Scheduled",
    "metrics.blocks": "{n} blocks",

    "dlg.new": "New block",
    "dlg.edit": "Edit block",
    "dlg.title": "Title",
    "dlg.title.ph": "e.g. Paper reading group",
    "dlg.day": "Day",
    "dlg.start": "Starts",
    "dlg.end": "Ends",
    "dlg.category": "Category",
    "dlg.note": "Note",
    "dlg.note.ph": "Optional detail",
    "dlg.done": "Mark as done",
    "dlg.save": "Save",
    "dlg.cancel": "Cancel",
    "dlg.delete": "Delete",
    "close": "Close",

    "toast.created": "Block created",
    "toast.saved": "Block saved",
    "toast.deleted": "Block deleted",
    "toast.reset": "Reset to the published snapshot",
    "toast.exported": "Downloaded cadence-{id}.json",
    "toast.imported": "Imported {n} blocks",
    "toast.importbad": "That file is not a valid Cadence export",
    "toast.local": "Saved locally in this browser",

    "day.mon": "Mon", "day.tue": "Tue", "day.wed": "Wed", "day.thu": "Thu",
    "day.fri": "Fri", "day.sat": "Sat", "day.sun": "Sun",
    "day.mon.l": "Monday", "day.tue.l": "Tuesday", "day.wed.l": "Wednesday",
    "day.thu.l": "Thursday", "day.fri.l": "Friday", "day.sat.l": "Saturday", "day.sun.l": "Sunday",
  },

  zh: {
    "ui.brand.tag": "日程规划器",
    "ui.width": "宽度",
    "ui.fluid": "流式",
    "ui.focus": "聚焦",
    "ui.theme": "主题",
    "ui.auto": "跟随浏览器",
    "ui.light": "浅色",
    "ui.dark": "深色",
    "ui.lang": "语言",
    "ui.lang.switch": "切换到英文",
    "ui.theme.switch": "主题：{v}",
    "ui.width.switch": "布局宽度：{v}",
    "ui.offline": "纯静态站点，无后端",

    "home.eyebrow": "纯静态日程规划器",
    "home.title": "把一周排得站得住。",
    "home.lede":
      "Cadence 是一个自包含的日程规划器。每个计划就是一份 JSON 快照，网格是真正的周历，你的修改只留在自己的浏览器里——不上传任何数据。",
    "home.plans": "日程计划",
    "home.count": "本快照共 {n} 个",
    "home.open": "打开规划器",
    "home.blocks": "{n} 个日程块",
    "home.hours": "已排 {n} 小时",
    "home.cats": "{n} 个分类",
    "home.updated": "更新于 {d}",
    "home.how": "工作方式",
    "home.how.body":
      "先读取快照，然后随便改：新建、拖动、拉伸、删除日程块。改动按计划保存在浏览器本地存储里，刷新回来是你排的那一周，而不是发布的那份。点重置即回到快照。",
    "home.credits": "两个静态页面，无服务器，无构建步骤。部署在 GitHub Pages 上。",
    "home.empty": "本快照里还没有任何计划。",
    "home.loaderror": "无法加载 data/index.json。请用 HTTP 方式打开该目录（file:// 页面无法抓取 JSON）。",

    "plan.loading": "正在加载计划…",
    "plan.back": "全部计划",
    "plan.today": "今天",
    "plan.prev": "上一周",
    "plan.next": "下一周",
    "plan.thisweek": "本周",
    "plan.add": "新建日程块",
    "plan.actions": "计划",
    "plan.export": "导出 JSON",
    "plan.import": "导入 JSON",
    "plan.reset": "重置为快照",
    "plan.legend": "分类",
    "plan.agenda": "日程清单",
    "plan.metrics": "分类占比",
    "plan.week": "第",
    "plan.hidden": "已隐藏 {n} 个分类",
    "plan.notfound": "本快照中没有计划“{id}”。",

    "agenda.empty": "这一周还没有安排。",
    "agenda.all": "全部",

    "metrics.scheduled": "已排时长",
    "metrics.blocks": "{n} 个日程块",

    "dlg.new": "新建日程块",
    "dlg.edit": "编辑日程块",
    "dlg.title": "标题",
    "dlg.title.ph": "例如：论文阅读组会",
    "dlg.day": "星期",
    "dlg.start": "开始",
    "dlg.end": "结束",
    "dlg.category": "分类",
    "dlg.note": "备注",
    "dlg.note.ph": "可选的细节",
    "dlg.done": "标记为已完成",
    "dlg.save": "保存",
    "dlg.cancel": "取消",
    "dlg.delete": "删除",
    "close": "关闭",

    "toast.created": "已新建日程块",
    "toast.saved": "已保存日程块",
    "toast.deleted": "已删除日程块",
    "toast.reset": "已重置为发布的快照",
    "toast.exported": "已下载 cadence-{id}.json",
    "toast.imported": "已导入 {n} 个日程块",
    "toast.importbad": "该文件不是有效的 Cadence 导出",
    "toast.local": "已保存在本浏览器中",

    "day.mon": "周一", "day.tue": "周二", "day.wed": "周三", "day.thu": "周四",
    "day.fri": "周五", "day.sat": "周六", "day.sun": "周日",
    "day.mon.l": "星期一", "day.tue.l": "星期二", "day.wed.l": "星期三",
    "day.thu.l": "星期四", "day.fri.l": "星期五", "day.sat.l": "星期六", "day.sun.l": "星期日",
  },
};

const LANG_KEY = "cadence.lang";

function currentLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "en" || saved === "zh") return saved;
  } catch (_) {}
  // English is the default regardless of browser locale, per spec.
  return "en";
}

function t(key, vars) {
  const lang = currentLang();
  const table = CADENCE_I18N[lang] || CADENCE_I18N.en;
  let s = table[key];
  if (s === undefined) s = CADENCE_I18N.en[key];
  if (s === undefined) return key;
  if (vars) {
    for (const k of Object.keys(vars)) s = s.replaceAll("{" + k + "}", String(vars[k]));
  }
  return s;
}

/** Translate every element carrying a data-i18n* attribute inside `root`. */
function applyI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  const attrs = [
    ["data-i18n-title", "title"],
    ["data-i18n-placeholder", "placeholder"],
    ["data-i18n-aria", "aria-label"],
  ];
  for (const [dataAttr, target] of attrs) {
    root.querySelectorAll("[" + dataAttr + "]").forEach((el) => {
      el.setAttribute(target, t(el.getAttribute(dataAttr)));
    });
  }
  document.documentElement.lang = currentLang() === "zh" ? "zh-CN" : "en";
}

/** Pick the localised value out of a bilingual content object. */
function loc(obj, base) {
  if (!obj) return "";
  const src = obj[base];
  const zh = obj[base + "Zh"];
  if (currentLang() === "zh" && zh) return zh;
  return src ?? "";
}

function setLang(lang) {
  try { localStorage.setItem(LANG_KEY, lang); } catch (_) {}
  applyI18n();
  document.dispatchEvent(new CustomEvent("cadence:lang", { detail: { lang } }));
}

window.CadenceI18N = { dict: CADENCE_I18N, t, loc, applyI18n, setLang, currentLang, LANG_KEY };
window.t = t;
window.loc = loc;
