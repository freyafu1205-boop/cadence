# cadence

**OmniFlow maps, published as a static snapshot.**
Live: <https://freyafu1205-boop.github.io/cadence/>

Currently published: **US B1/B2 visa process — Brazilian professor, short-term academic
visit** (21 cards, 25 edges, 5 stages), and nothing else. New maps appear here as they are
produced with OmniFlow.

## What it is

Two static pages and no backend, the same shape as
[mathflow-site](https://github.com/kanghelyu/mathflow-site):

| Path | Purpose |
| --- | --- |
| `index.html` | Gallery: one card per published map, linking to `map.html#<graphId>` |
| `map.html` | The **unmodified** OmniFlow Studio client, driving a static snapshot |
| `assets/static-api.js` | Browser-side implementation of the Studio's HTTP API over the snapshot |
| `assets/lib/*.js` | OmniFlow's own `graph-core` / `graph-analysis` / `group-suggest` / `converters`, verbatim |
| `assets/app.js`, `assets/app.css` | The OmniFlow Studio client, verbatim |
| `vendor/katex/**` | Vendored KaTeX (the Studio loads it from `/vendor/`) |
| `data/index.json` | Map list, folder tree, template catalogue (en + zh) |
| `data/g/<id>.json` | Per-map snapshot: `{ graph, validate, analyze, notes }` |
| `build/publish.json` | **Which graphs are published** — the one file to edit to add a map |
| `build/snapshot.mjs` | Vault → `data/` |
| `build/check.mjs` | Static self-check |

## Publishing a map

1. Produce the graph with OmniFlow — it lands in the local vault (`~/.omni-flow`).
2. Add its id to `build/publish.json`.
3. `node build/snapshot.mjs && node build/check.mjs`
4. Commit and push.

`build/snapshot.mjs` reads the graph's `graph.json`, its `notes/*.md`, and `tree.json` from
the vault, then computes validation and analysis with OmniFlow's own browser-safe modules —
which are already vendored under `assets/lib/`. Nothing has to be re-authored for the web,
and no OmniFlow vault is needed to *rebuild* the site from what is committed.

## How it works without a server

`of studio` normally serves the client over an HTTP API. Here the client is untouched and
the API is reimplemented in the browser:

- **Reads** come from the snapshot in `data/`.
- **Writes** are applied in memory and mirrored to `localStorage` under `cadence.overlay.v1`,
  so an edit survives a reload in *your* browser only. The published snapshot is never
  modified and no visitor sees another visitor's changes. A badge appears once your copy
  diverges, with a reset button.
- **Algorithms are the real ones.** Layout, validation, dependency analysis, group
  suggestions and every export come from OmniFlow's own modules, imported verbatim.
- Cross-tab sync and anything needing durable shared state is declined with an explicit
  message rather than failing silently.

## Theme and language

| | Default | Behaviour |
| --- | --- | --- |
| Theme | **follows the browser** | The Studio client reads `of-theme`; when the key is **unset** it uses `prefers-color-scheme` and keeps following it live. This site deliberately never seeds that key, so both pages track the OS. An explicit Light/Dark choice on the gallery is mirrored into `of-theme`; **Auto** removes it again. |
| Language | **English** | `of-lang` is seeded to `en`, because the Studio otherwise hard-defaults to Chinese. The gallery's 中文 button writes the same key, and the Studio's own toggle takes over from there. |

## Two deliberate differences from mathflow-site

1. **`of-theme` is not seeded.** The original pins it to `dark`, which stops the client from
   following the browser. Removing that line is what makes the theme requirement work.
2. **`convo-path` is not implemented.** It serves the non-linear conversation panel, which
   only renders for graphs carrying `conversation` metadata. None published here do, so the
   button that calls it never appears. `build/check.mjs` lists it as a known gap — any
   *other* unimplemented endpoint fails the check.

## Local preview

The pages fetch JSON, so `file://` will not work. Serve the folder:

```bash
python -m http.server 8000      # then open http://localhost:8000/
```

## Credits

Built with [OmniFlow](https://github.com/kanghelyu/omni-flow) (CC BY-NC 4.0). The Studio
client is shipped unmodified. Structure inspired by
[mathflow-site](https://github.com/kanghelyu/mathflow-site).

## License

MIT for this repository's own files — see [LICENSE](LICENSE). OmniFlow's client and modules
remain under their own licence (CC BY-NC 4.0).
