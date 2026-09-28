/* Cadence — shared shell controller.
   Owns the three persisted preferences and the toast helper:
     theme  : auto (follow the browser) | light | dark      → data-theme on <html>
     width  : fluid | focus                                 → data-width on <html>
     lang   : en | zh (handled in i18n.js)
   Auto theme is the default, so a first-time visitor gets whatever the browser
   reports through prefers-color-scheme, and it keeps following it live. */

const THEME_KEY = "cadence.theme";
const WIDTH_KEY = "cadence.width";

const store = {
  get(k, fallback) {
    try { return localStorage.getItem(k) ?? fallback; } catch (_) { return fallback; }
  },
  set(k, v) {
    try { localStorage.setItem(k, v); } catch (_) {}
  },
};

function applyTheme(value) {
  const root = document.documentElement;
  if (value === "light" || value === "dark") root.setAttribute("data-theme", value);
  else root.removeAttribute("data-theme");
  store.set(THEME_KEY, value);
  document.dispatchEvent(new CustomEvent("cadence:theme", { detail: { theme: value } }));
}

function applyWidth(value) {
  document.documentElement.setAttribute("data-width", value === "focus" ? "focus" : "fluid");
  store.set(WIDTH_KEY, value);
  document.dispatchEvent(new CustomEvent("cadence:width", { detail: { width: value } }));
}

function markSeg(seg, value) {
  seg.querySelectorAll("button[data-value]").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.value === value));
  });
}

function wireSeg(seg, key, apply, fallback) {
  const value = store.get(key, fallback) || fallback;
  apply(value);
  const paint = () => markSeg(seg, store.get(key, fallback) || fallback);
  paint();
  seg.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-value]");
    if (!btn) return;
    apply(btn.dataset.value);
    paint();
  });
  document.addEventListener("cadence:lang", paint);
}

let toastTimer = 0;
function toast(msg) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add("on"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("on"), 2400);
}

function initShell() {
  const themeSeg = document.querySelector('[data-seg="theme"]');
  if (themeSeg) wireSeg(themeSeg, THEME_KEY, applyTheme, "auto");

  const widthSeg = document.querySelector('[data-seg="width"]');
  if (widthSeg) wireSeg(widthSeg, WIDTH_KEY, applyWidth, "fluid");

  const langBtn = document.querySelector("[data-lang-toggle]");
  if (langBtn) {
    langBtn.addEventListener("click", () => {
      setLang(CadenceI18N.currentLang() === "en" ? "zh" : "en");
    });
  }

  // A live OS/browser theme change should be reflected when the preference is Auto.
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onScheme = () => {
    if ((store.get(THEME_KEY, "auto") || "auto") === "auto") {
      document.dispatchEvent(new CustomEvent("cadence:theme", { detail: { theme: "auto" } }));
    }
  };
  if (mq.addEventListener) mq.addEventListener("change", onScheme);

  CadenceI18N.applyI18n();
}

window.Cadence = { store, toast, applyTheme, applyWidth, initShell, THEME_KEY, WIDTH_KEY };
