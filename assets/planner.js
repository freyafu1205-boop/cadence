/* Cadence — weekly planner workspace.
   Loads a plan snapshot from data/p/<id>.json, renders a real week grid, and keeps
   every edit in localStorage so the published snapshot is never touched. */
(function () {
  const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const SNAP = 15;                 // minutes per drag step
  const LS = (id) => "cadence.plan." + id;

  const state = {
    plan: null,
    events: [],
    hidden: new Set(),
    weekOffset: 0,
    hourH: 56,
    dirty: false,
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const pad = (n) => String(n).padStart(2, "0");
  const toMin = (s) => { const [h, m] = String(s).split(":").map(Number); return h * 60 + (m || 0); };
  const toHHMM = (m) => {
    m = Math.max(0, Math.min(24 * 60, m));
    return pad(Math.floor(m / 60)) + ":" + pad(m % 60);
  };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const uid = () => "ev-" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);

  /* ---------------------------------------------------------------- week math */

  function mondayOf(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dow = (x.getDay() + 6) % 7;   // Mon = 0 … Sun = 6
    x.setDate(x.getDate() - dow);
    return x;
  }

  function weekDates(offset) {
    const base = mondayOf(new Date());
    base.setDate(base.getDate() + offset * 7);
    return DAYS.map((_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d;
    });
  }

  const todayKey = () => DAYS[(new Date().getDay() + 6) % 7];

  function localeTag() {
    return CadenceI18N.currentLang() === "zh" ? "zh-CN" : "en-US";
  }

  function dateRangeLabel(dates) {
    const a = dates[0], b = dates[6];
    const opt = { day: "numeric", month: "short" };
    const left = a.toLocaleDateString(localeTag(), opt);
    const right = b.toLocaleDateString(localeTag(), { ...opt, year: "numeric" });
    return left + " – " + right;
  }

  /* ------------------------------------------------------------------ storage */

  function save() {
    try {
      localStorage.setItem(LS(state.plan.id), JSON.stringify({
        v: 1,
        events: state.events,
        hidden: [...state.hidden],
      }));
    } catch (_) {}
  }

  function loadStored() {
    try {
      const raw = localStorage.getItem(LS(state.plan.id));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.events)) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function adopt(events, hidden) {
    state.events = events.map((e) => ({ ...e }));
    state.hidden = new Set(hidden || []);
  }

  /* ------------------------------------------------------------------ fetching */

  async function pickPlanId() {
    const asked = new URLSearchParams(location.search).get("plan");
    if (asked) return asked;
    const res = await fetch("data/index.json", { cache: "no-store" });
    if (!res.ok) throw new Error("index " + res.status);
    const idx = await res.json();
    const first = (idx.plans || [])[0];
    return first ? first.id : null;
  }

  async function boot() {
    try {
      const id = await pickPlanId();
      if (!id) throw new Error("no plans");
      const res = await fetch("data/p/" + encodeURIComponent(id) + ".json", { cache: "no-store" });
      if (!res.ok) throw new Error(res.status === 404 ? "missing" : String(res.status));
      const plan = await res.json();
      state.plan = plan;

      const stored = loadStored();
      if (stored) adopt(stored.events, stored.hidden);
      else adopt(plan.events || [], []);

      document.documentElement.style.setProperty("--accent", plan.accent || "#c2410c");
      $("#plan-title").textContent = loc(plan, "name");
      document.title = loc(plan, "name") + " · Cadence";
      $("#loading").hidden = true;
      $("#board").hidden = false;
      renderAll();
      wireEvents();
    } catch (err) {
      const box = $("#loading");
      box.innerHTML = "";
      const div = document.createElement("div");
      div.className = "error";
      div.textContent = String(err.message) === "missing"
        ? t("plan.notfound", { id: new URLSearchParams(location.search).get("plan") || "" })
        : t("home.loaderror");
      box.appendChild(div);
    }
  }

  /* ------------------------------------------------------------------ rendering */

  function catMap() {
    const m = new Map();
    for (const c of state.plan.categories || []) m.set(c.id, c);
    return m;
  }

  function visibleEvents() {
    return state.events.filter((e) => !state.hidden.has(e.category));
  }

  function renderAll() {
    renderGrid();
    renderLegend();
    renderAgenda();
    renderMeters();
    renderWeekLabel();
    renderDirtyBadge();
  }

  function renderWeekLabel() {
    const dates = weekDates(state.weekOffset);
    $("#plan-title").textContent = loc(state.plan, "name");
    $("#week-range").textContent = dateRangeLabel(dates);
    $("#btn-today").disabled = state.weekOffset === 0;
  }

  function renderDirtyBadge() {
    const b = $("#dirty-badge");
    if (!b) return;
    b.hidden = !state.dirty;
  }

  function readHourH() {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--hour-h").trim();
    const n = parseFloat(v);
    if (Number.isFinite(n) && n > 10) state.hourH = n;
  }

  function metrics() {
    const plan = state.plan;
    const startMin = plan.dayStart * 60;
    const endMin = plan.dayEnd * 60;
    return { startMin, endMin, height: ((endMin - startMin) / 60) * state.hourH };
  }

  function renderHead(host) {
    const dates = weekDates(state.weekOffset);
    const tk = todayKey();

    const corner = document.createElement("div");
    corner.className = "hcell corner";
    corner.textContent = state.plan.dayStart + ":00";
    host.appendChild(corner);

    DAYS.forEach((key, i) => {
      const cell = document.createElement("div");
      cell.className = "hcell";
      if (state.weekOffset === 0 && key === tk) cell.classList.add("today");
      const dow = document.createElement("div");
      dow.className = "dow";
      dow.textContent = t("day." + key);
      const dom = document.createElement("div");
      dom.className = "dom";
      dom.textContent = String(dates[i].getDate());
      cell.append(dow, dom);
      host.appendChild(cell);
    });
  }

  function renderGrid() {
    const host = $("#cal");
    host.innerHTML = "";
    renderHead(host);

    const { startMin, endMin, height } = metrics();
    const cats = catMap();

    // time column
    const tcol = document.createElement("div");
    tcol.className = "time-col";
    tcol.style.height = height + "px";
    for (let m = startMin; m <= endMin; m += 60) {
      const tick = document.createElement("div");
      tick.className = "tick" + (m === startMin ? " first" : "");
      tick.style.top = (((m - startMin) / 60) * state.hourH) + "px";
      tick.textContent = toHHMM(m);
      tcol.appendChild(tick);
    }
    host.appendChild(tcol);

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const tk = todayKey();

    DAYS.forEach((key, i) => {
      const col = document.createElement("div");
      col.className = "day-col" + (i >= 5 ? " weekend" : "");
      col.dataset.day = key;
      col.style.height = height + "px";

      const slots = document.createElement("div");
      slots.className = "slots";
      for (let m = startMin; m < endMin; m += 30) {
        const s = document.createElement("button");
        s.type = "button";
        s.className = "slot";
        s.dataset.day = key;
        s.dataset.min = String(m);
        s.setAttribute("aria-label", t("day." + key + ".l") + " " + toHHMM(m));
        slots.appendChild(s);
      }
      col.appendChild(slots);

      for (const ev of state.events) {
        if (ev.day !== key) continue;
        const s = toMin(ev.start), e = toMin(ev.end);
        if (e <= startMin || s >= endMin) continue;
        const top = Math.max(0, ((s - startMin) / 60) * state.hourH);
        const bottom = Math.min(height, ((e - startMin) / 60) * state.hourH);
        const h = Math.max(18, bottom - top);
        const cat = cats.get(ev.category);
        const node = document.createElement("div");
        node.className = "ev" + (h < 36 ? " compact" : "") + (ev.done ? " done" : "") +
          (state.hidden.has(ev.category) ? " hidden-cat" : "");
        node.dataset.id = ev.id;
        node.tabIndex = 0;
        node.setAttribute("role", "button");
        node.setAttribute("aria-label", loc(ev, "title") + " " + ev.start + "–" + ev.end);
        node.style.top = top + "px";
        node.style.height = h + "px";
        node.style.setProperty("--c", cat ? cat.color : "#c2410c");
        const tt = document.createElement("div");
        tt.className = "t";
        tt.textContent = loc(ev, "title");
        const mm = document.createElement("div");
        mm.className = "m";
        mm.textContent = ev.start + " – " + ev.end;
        node.append(tt, mm);
        if (h >= 30) {
          const handle = document.createElement("div");
          handle.className = "handle";
          handle.dataset.role = "resize";
          node.appendChild(handle);
        }
        col.appendChild(node);
      }

      if (state.weekOffset === 0 && key === tk && nowMin >= startMin && nowMin <= endMin) {
        const line = document.createElement("div");
        line.className = "nowline";
        line.style.top = (((nowMin - startMin) / 60) * state.hourH) + "px";
        col.appendChild(line);
      }

      host.appendChild(col);
    });
  }

  function renderLegend() {
    const host = $("#legend");
    host.innerHTML = "";
    for (const c of state.plan.categories || []) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.dataset.cat = c.id;
      b.style.setProperty("--c", c.color);
      b.setAttribute("aria-pressed", String(!state.hidden.has(c.id)));
      const sw = document.createElement("span");
      sw.className = "swatch";
      const lbl = document.createElement("span");
      lbl.textContent = loc(c, "name");
      b.append(sw, lbl);
      host.appendChild(b);
    }
  }

  function renderAgenda() {
    const host = $("#agenda");
    host.innerHTML = "";
    const cats = catMap();
    const rows = visibleEvents()
      .slice()
      .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || toMin(a.start) - toMin(b.start));
    if (!rows.length) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = t("agenda.empty");
      host.appendChild(p);
      return;
    }
    for (const ev of rows) {
      const cat = cats.get(ev.category);
      const row = document.createElement("div");
      row.className = "row";
      row.dataset.id = ev.id;
      const d = document.createElement("span");
      d.className = "day";
      d.textContent = t("day." + ev.day);
      const tm = document.createElement("span");
      tm.className = "time";
      tm.textContent = ev.start;
      const ttl = document.createElement("span");
      ttl.className = "ttl";
      const dot = document.createElement("i");
      dot.style.setProperty("--c", cat ? cat.color : "#c2410c");
      const name = document.createElement("span");
      name.textContent = loc(ev, "title");
      ttl.append(dot, name);
      row.append(d, tm, ttl);
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      host.appendChild(row);
    }
  }

  function renderMeters() {
    const host = $("#meters");
    host.innerHTML = "";
    const cats = catMap();
    const totals = new Map();
    let grand = 0;
    for (const ev of state.events) {
      const d = toMin(ev.end) - toMin(ev.start);
      if (d <= 0) continue;
      totals.set(ev.category, (totals.get(ev.category) || 0) + d);
      grand += d;
    }
    const max = Math.max(1, ...[...totals.values()]);
    const ordered = (state.plan.categories || [])
      .map((c) => ({ c, v: totals.get(c.id) || 0 }))
      .sort((a, b) => b.v - a.v);

    for (const { c, v } of ordered) {
      const row = document.createElement("div");
      row.className = "m-row";
      row.style.setProperty("--c", c.color);
      const nm = document.createElement("span");
      nm.textContent = loc(c, "name");
      const bar = document.createElement("span");
      bar.className = "bar";
      const fill = document.createElement("span");
      fill.style.width = (v / max) * 100 + "%";
      fill.style.setProperty("--c", c.color);
      bar.appendChild(fill);
      const val = document.createElement("span");
      val.className = "val";
      val.textContent = (Math.round((v / 60) * 10) / 10) + " h";
      row.append(nm, bar, val);
      host.appendChild(row);
    }

    const total = document.createElement("div");
    total.className = "total";
    const a = document.createElement("span");
    a.textContent = t("metrics.scheduled");
    const b = document.createElement("span");
    b.textContent = (Math.round((grand / 60) * 10) / 10) + " h · " + t("metrics.blocks", { n: state.events.length });
    total.append(a, b);
    host.appendChild(total);
  }

  /* -------------------------------------------------------------------- dialog */

  let editing = null;

  function fillCategorySelect(selected) {
    const sel = $("#f-category");
    sel.innerHTML = "";
    for (const c of state.plan.categories || []) {
      const o = document.createElement("option");
      o.value = c.id;
      o.textContent = loc(c, "name");
      if (c.id === selected) o.selected = true;
      sel.appendChild(o);
    }
  }

  function openDialog(ev, preset) {
    editing = ev ? ev.id : null;
    const dlg = $("#dlg");
    $("#dlg-title").textContent = ev ? t("dlg.edit") : t("dlg.new");
    $("#btn-delete").hidden = !ev;
    $("#f-title").value = ev ? (CadenceI18N.currentLang() === "zh" && ev.titleZh ? ev.titleZh : (ev.title || "")) : "";
    $("#f-day").value = (ev && ev.day) || preset.day;
    $("#f-start").value = (ev && ev.start) || preset.start;
    $("#f-end").value = (ev && ev.end) || preset.end;
    $("#f-note").value = ev ? loc(ev, "note") : "";
    $("#f-done").checked = !!(ev && ev.done);
    fillCategorySelect((ev && ev.category) || (state.plan.categories[0] || {}).id);
    CadenceI18N.applyI18n(dlg);
    dlg.showModal();
    $("#f-title").focus();
  }

  function commitDialog() {
    const title = $("#f-title").value.trim();
    if (!title) { $("#f-title").focus(); return; }
    const day = $("#f-day").value;
    let start = toMin($("#f-start").value);
    let end = toMin($("#f-end").value);
    if (end <= start) end = start + 60;
    const zh = CadenceI18N.currentLang() === "zh";
    const patch = {
      day,
      start: toHHMM(start),
      end: toHHMM(end),
      category: $("#f-category").value,
      done: $("#f-done").checked,
    };
    if (zh) { patch.titleZh = title; } else { patch.title = title; }
    const note = $("#f-note").value.trim();
    if (zh) { patch.noteZh = note; } else { patch.note = note; }

    if (editing) {
      const target = state.events.find((e) => e.id === editing);
      if (target) Object.assign(target, patch);
      Cadence.toast(t("toast.saved"));
    } else {
      // A brand-new block has no counterpart in the other language yet, so mirror
      // the typed text into both fields — otherwise it would render blank after a
      // language switch.
      const fresh = { id: uid(), ...patch };
      if (zh) { fresh.title = title; fresh.note = note; }
      else { fresh.titleZh = title; fresh.noteZh = note; }
      state.events.push(fresh);
      Cadence.toast(t("toast.created"));
    }
    state.dirty = true;
    save();
    renderAll();
    $("#dlg").close();
  }

  function deleteEditing() {
    if (!editing) return;
    state.events = state.events.filter((e) => e.id !== editing);
    state.dirty = true;
    save();
    renderAll();
    $("#dlg").close();
    Cadence.toast(t("toast.deleted"));
  }

  /* --------------------------------------------------------------------- drag */

  function beginPointer(ev, node, mode, e) {
    if (e.button !== 0) return;
    const startX = e.clientX, startY = e.clientY;
    const oStart = toMin(ev.start), oEnd = toMin(ev.end);
    const oDay = DAYS.indexOf(ev.day);
    const { startMin, endMin } = metrics();
    const colW = ($(".day-col") || node).getBoundingClientRect().width || 120;
    const pxPerMin = state.hourH / 60;
    const stepPx = pxPerMin * SNAP;

    let moved = false;
    let dMin = 0, dDay = 0;

    node.classList.add("dragging");
    node.setPointerCapture(e.pointerId);

    const paint = () => {
      if (mode === "resize") {
        node.style.height = Math.max(18, (oEnd - oStart + dMin) * pxPerMin) + "px";
      } else {
        node.style.transform = `translate(${dDay * colW}px, ${dMin * pxPerMin}px)`;
      }
    };

    const onMove = (evt) => {
      const dx = evt.clientX - startX;
      const dy = evt.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      if (mode === "resize") {
        dMin = Math.round(dy / stepPx) * SNAP;
        dMin = clamp(dMin, SNAP - (oEnd - oStart), endMin - oEnd);
      } else {
        dMin = Math.round(dy / stepPx) * SNAP;
        dMin = clamp(dMin, startMin - oStart, endMin - oEnd);
        dDay = clamp(Math.round(dx / colW), -oDay, DAYS.length - 1 - oDay);
      }
      paint();
    };

    const onUp = () => {
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerup", onUp);
      node.removeEventListener("pointercancel", onUp);
      node.classList.remove("dragging");
      node.style.transform = "";
      if (!moved) {
        openDialog(ev, { day: ev.day, start: ev.start, end: ev.end });
        return;
      }
      if (mode === "resize") {
        ev.end = toHHMM(oEnd + dMin);
      } else {
        ev.day = DAYS[clamp(oDay + dDay, 0, DAYS.length - 1)];
        ev.start = toHHMM(oStart + dMin);
        ev.end = toHHMM(oEnd + dMin);
      }
      state.dirty = true;
      save();
      renderAll();
    };

    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerup", onUp);
    node.addEventListener("pointercancel", onUp);
  }

  /* --------------------------------------------------------------------- wiring */

  function wireEvents() {
    $("#cal").addEventListener("click", (e) => {
      const slot = e.target.closest(".slot");
      if (!slot) return;
      const start = Number(slot.dataset.min);
      openDialog(null, { day: slot.dataset.day, start: toHHMM(start), end: toHHMM(start + 60) });
    });

    $("#cal").addEventListener("pointerdown", (e) => {
      const handle = e.target.closest(".handle");
      const node = e.target.closest(".ev");
      if (!node) return;
      const ev = state.events.find((x) => x.id === node.dataset.id);
      if (!ev) return;
      beginPointer(ev, node, handle ? "resize" : "move", e);
    });

    $("#cal").addEventListener("keydown", (e) => {
      const node = e.target.closest(".ev");
      if (!node || (e.key !== "Enter" && e.key !== " ")) return;
      const ev = state.events.find((x) => x.id === node.dataset.id);
      if (!ev) return;
      e.preventDefault();
      openDialog(ev, { day: ev.day, start: ev.start, end: ev.end });
    });

    $("#agenda").addEventListener("click", (e) => {
      const row = e.target.closest(".row");
      if (!row) return;
      const ev = state.events.find((x) => x.id === row.dataset.id);
      if (ev) openDialog(ev, { day: ev.day, start: ev.start, end: ev.end });
    });

    $("#legend").addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      const id = chip.dataset.cat;
      if (state.hidden.has(id)) state.hidden.delete(id); else state.hidden.add(id);
      chip.setAttribute("aria-pressed", String(!state.hidden.has(id)));
      state.dirty = true;
      save();
      renderGrid();
      renderAgenda();
    });

    $("#btn-prev").addEventListener("click", () => { state.weekOffset--; renderAll(); });
    $("#btn-next").addEventListener("click", () => { state.weekOffset++; renderAll(); });
    $("#btn-today").addEventListener("click", () => { state.weekOffset = 0; renderAll(); });
    $("#btn-add").addEventListener("click", () => {
      const now = new Date();
      const h = clamp(now.getHours(), state.plan.dayStart, state.plan.dayEnd - 1);
      openDialog(null, { day: todayKey(), start: toHHMM(h * 60), end: toHHMM(h * 60 + 60) });
    });

    $("#dlg form").addEventListener("submit", (e) => { e.preventDefault(); commitDialog(); });
    $("#btn-cancel").addEventListener("click", () => $("#dlg").close());
    $("#btn-close").addEventListener("click", () => $("#dlg").close());
    $("#btn-delete").addEventListener("click", deleteEditing);

    $("#btn-export").addEventListener("click", () => {
      const payload = {
        format: "cadence-plan",
        version: 1,
        id: state.plan.id,
        name: loc(state.plan, "name"),
        exportedAt: new Date().toISOString(),
        events: state.events,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "cadence-" + state.plan.id + ".json";
      a.click();
      URL.revokeObjectURL(a.href);
      Cadence.toast(t("toast.exported", { id: state.plan.id }));
    });

    $("#file-import").addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        const incoming = Array.isArray(parsed) ? parsed : parsed.events;
        if (!Array.isArray(incoming)) throw new Error("bad");
        const cleaned = incoming
          .filter((x) => x && x.day && x.start && x.end)
          .map((x) => ({ ...x, id: uid() }));
        if (!cleaned.length) throw new Error("bad");
        state.events = state.events.concat(cleaned);
        state.dirty = true;
        save();
        renderAll();
        Cadence.toast(t("toast.imported", { n: cleaned.length }));
      } catch (_) {
        Cadence.toast(t("toast.importbad"));
      }
      e.target.value = "";
    });

    $("#btn-reset").addEventListener("click", () => {
      try { localStorage.removeItem(LS(state.plan.id)); } catch (_) {}
      adopt(state.plan.events || [], []);
      state.dirty = false;
      save();
      renderAll();
      Cadence.toast(t("toast.reset"));
    });

    document.addEventListener("cadence:lang", () => { CadenceI18N.applyI18n(); renderAll(); });
    document.addEventListener("cadence:width", () => { readHourH(); renderAll(); });

    let rt = 0;
    window.addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(() => { readHourH(); renderGrid(); }, 140);
    });

    setInterval(renderGrid, 60 * 1000);   // keep the now-line honest
  }

  document.addEventListener("DOMContentLoaded", () => {
    Cadence.initShell();
    readHourH();
    boot().then(() => { readHourH(); renderGrid(); });
  });
})();
