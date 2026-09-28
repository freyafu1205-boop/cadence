/* Cadence — gallery page. Reads data/index.json and renders one card per plan. */
(function () {
  function card(plan) {
    const a = document.createElement("a");
    a.className = "card";
    a.href = "plan.html?plan=" + encodeURIComponent(plan.id);
    a.style.setProperty("--c", plan.accent || "#c2410c");

    const top = document.createElement("div");
    top.className = "card-top";
    const rule = document.createElement("span");
    rule.className = "rule";
    top.appendChild(rule);

    const h = document.createElement("h3");
    h.textContent = loc(plan, "name");
    const d = document.createElement("p");
    d.className = "desc";
    d.textContent = loc(plan, "desc");

    const stats = document.createElement("div");
    stats.className = "stats";
    for (const piece of [
      t("home.blocks", { n: plan.blocks }),
      t("home.hours", { n: plan.hours }),
      t("home.cats", { n: plan.categories }),
    ]) {
      const s = document.createElement("span");
      s.textContent = piece;
      stats.appendChild(s);
    }

    const arrow = document.createElement("span");
    arrow.className = "arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";

    a.append(top, h, d, stats, arrow);
    return a;
  }

  function render(index) {
    const host = document.querySelector("#plans");
    const plans = index.plans || [];
    document.querySelector("#count").textContent = t("home.count", { n: plans.length });
    host.innerHTML = "";
    if (!plans.length) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = t("home.empty");
      host.appendChild(p);
      return;
    }
    for (const plan of plans) host.appendChild(card(plan));
    if (index.generatedAt) {
      const when = new Date(index.generatedAt);
      document.querySelector("#updated").textContent =
        t("home.updated", { d: when.toLocaleDateString(CadenceI18N.currentLang() === "zh" ? "zh-CN" : "en-US", { day: "numeric", month: "short", year: "numeric" }) });
    }
  }

  async function boot() {
    try {
      const res = await fetch("data/index.json", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const index = await res.json();
      render(index);
      document.addEventListener("cadence:lang", () => render(index));
    } catch (_) {
      const host = document.querySelector("#plans");
      host.innerHTML = "";
      const div = document.createElement("div");
      div.className = "error";
      div.textContent = t("home.loaderror");
      host.appendChild(div);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    Cadence.initShell();
    boot();
  });
})();
