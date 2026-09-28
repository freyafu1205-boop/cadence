# Cadence

**A static, two-page schedule planner.** Light and dark follow your browser; English is the default
and Chinese is one click away; every layout is fluid until you ask for a narrower column.

Live: `https://<your-user>.github.io/cadence/`

## What it is

A weekly planner with no account, no server and no build step at runtime. Plans are plain JSON
snapshots; the grid is a real calendar with drag-to-move, drag-to-resize and click-to-create. Your
edits live in `localStorage`, so a visitor can rearrange the whole week and never touches the
published file.

| Path | Purpose |
| --- | --- |
| `index.html` | Gallery: one card per plan, linking to `plan.html?plan=<id>` |
| `plan.html` | The planner workspace — the weekly grid, agenda and category meters |
| `assets/app.css` | Design system: tokens, light/dark palettes, grid, components |
| `assets/i18n.js` | English (source) and Chinese dictionaries, `data-i18n` applier |
| `assets/ui.js` | Shared shell: theme, layout width, language toggle, toasts |
| `assets/home.js` | Gallery rendering |
| `assets/planner.js` | Grid rendering, editing, drag/resize, persistence, import/export |
| `data/index.json` | The only file `index.html` fetches: plan list with computed stats |
| `data/p/<id>.json` | One plan: categories, day window, events (bilingual) |
| `build/index.mjs` | Regenerates `data/index.json` from `data/p/*.json` |

## Preferences

All three are stored in `localStorage` and applied before the first paint, so there is no flash.

| Preference | Values | Default | Stored as |
| --- | --- | --- | --- |
| Theme | Auto · Light · Dark | **Auto** | `cadence.theme` |
| Layout width | Fluid · Focus | **Fluid** | `cadence.width` |
| Language | English · 中文 | **English** | `cadence.lang` |

**Auto** writes no attribute at all — the palette is then driven purely by
`@media (prefers-color-scheme: dark)`, so the site keeps following the browser live, including when
you flip the OS theme with the page open.

**Fluid** lets the seven day columns share the entire viewport width. **Focus** keeps the identical
grid but caps the surrounding page to a readable column.

## Editing model

- **Reads** come from the published snapshot in `data/`.
- **Writes** are applied in memory and mirrored to `localStorage` under `cadence.plan.<id>`.
- A **“Saved locally in this browser”** badge appears once you have diverged from the snapshot.
- **Reset to snapshot** drops the local copy and restores the published week.
- **Export JSON** downloads your week; **Import JSON** appends events from an exported file.

Nothing is uploaded. Opening the site in another browser or on another device shows the snapshot,
not your edits.

## Adding a plan

1. Drop a new file into `data/p/` — the file name must equal the plan `id`.
2. Run `node build/index.mjs` to refresh `data/index.json`.
3. Commit and push.

## Local preview

The pages fetch JSON, so `file://` will not work. Serve the folder:

```bash
python -m http.server 8000      # then open http://localhost:8000/
# or
npx serve .
```

## Deploying

Static files only. On GitHub Pages: **Settings → Pages → Source: Deploy from a branch →
`main` / `/ (root)`**. No custom domain and no build action are required; `.nojekyll` stops Jekyll
from touching the assets.

## Credits

Structure inspired by [mathflow-site](https://github.com/kanghelyu/mathflow-site) — a gallery page
plus a full-page workspace, driven entirely by static snapshots. Cadence is an independent
implementation for scheduling rather than map viewing.

## License

MIT — see [LICENSE](LICENSE).
