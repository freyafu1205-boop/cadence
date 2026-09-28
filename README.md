# cadence

**OmniFlow maps of weekly plans, served as a static snapshot.**
Live: <https://freyafu1205-boop.github.io/cadence/>

A week is a graph, not a list. Every time block in these plans is a node, every
dependency an edge, so the whole week can be laid out, searched, and analysed for the
place where it actually breaks.

## What it is

Two static pages and no backend, the same shape as
[mathflow-site](https://github.com/kanghelyu/mathflow-site):

| Path | Purpose |
| --- | --- |
| `index.html` | Gallery: one card per map, linking to `map.html#<graphId>` |
| `map.html` | The **unmodified** OmniFlow Studio client, driving a static snapshot |
| `assets/static-api.js` | Browser-side implementation of the Studio's HTTP API over the snapshot |
| `assets/lib/*.js` | OmniFlow's own `graph-core` / `graph-analysis` / `group-suggest` / `converters`, shipped verbatim |
| `assets/app.js`, `assets/app.css` | The OmniFlow Studio client, shipped verbatim |
| `vendor/katex/**` | Vendored KaTeX (the Studio loads it from `/vendor/`) |
| `data/index.json` | Map list, folder tree, template catalogue (en + zh) |
| `data/g/<id>.json` | Per-map snapshot: `{ graph, validate, analyze, notes }` |
| `build/schedule-to-graph.mjs` | Turns `data/plans/<id>.json` into an OmniFlow graph payload |
| `build/snapshot.mjs` | Builds `data/` — validation and analysis come from OmniFlow's own modules |
| `build/check.mjs` | Static self-check (see below) |

## How it works without a server

`of studio` normally serves the client over an HTTP API. Here the client is untouched and
the API is reimplemented in the browser:

- **Reads** come from a build-time snapshot in `data/`.
- **Writes** are applied in memory and mirrored to `localStorage` under `cadence.overlay.v1`,
  so an edit survives a reload in *your* browser only. The published snapshot is never
  modified and visitors never see each other's edits. A small badge appears once your copy
  diverges, with a reset button.
- **Algorithms are the real ones.** Layout, validation, dependency analysis, group
  suggestions and every export format come from OmniFlow's own browser-safe modules,
  imported verbatim — nothing is reimplemented by hand.
- Cross-tab sync (SSE) and anything needing durable shared state is declined with an
  explicit message rather than failing silently.

## Theme and language

| | Default | Behaviour |
| --- | --- | --- |
| Theme | **follows the browser** | The Studio client reads `of-theme`; when the key is **unset** it uses `prefers-color-scheme` and keeps following it live. This site deliberately never seeds that key, so both pages track the OS. An explicit Light/Dark choice on the gallery is mirrored into `of-theme`; **Auto** removes it again. |
| Language | **English** | `of-lang` is seeded to `en` because the Studio otherwise hard-defaults to Chinese. The gallery's 中文 button writes the same key, and the Studio's own toggle takes over from there. |

## Two deliberate differences from mathflow-site

1. **`of-theme` is not seeded.** The original pins it to `dark`, which stops the client
   from following the browser. Removing that line is what makes the theme requirement work.
2. **`convo-path` is not implemented.** It belongs to the non-linear conversation panel,
   which only renders for graphs carrying `conversation` metadata. None of the published
   plans do, so the button that calls it never appears. `build/check.mjs` lists it as a
   known gap — any *other* unimplemented endpoint fails the check.

## Rebuilding

```bash
node build/schedule-to-graph.mjs   # data/plans/*.json  ->  *.graph.json + *.notes.json
node build/snapshot.mjs            # -> data/g/*.json + data/index.json
node build/check.mjs               # static self-check
```

`build/check.mjs` guards the failure modes that are invisible until a browser tries them:
an endpoint the client calls but the static API does not implement, a snapshot missing a
field a loader reads, `of-theme` being seeded, the two scripts loaded in the wrong order,
edge or group references to nodes that do not exist, a note whose summary line does not
match its body, a map with no weekday groups, or an external `<script>` creeping in.

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

MIT for this repository's own files — see [LICENSE](LICENSE). OmniFlow's client and
modules remain under their own licence (CC BY-NC 4.0).
