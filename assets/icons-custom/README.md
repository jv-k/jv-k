# Custom icon overrides

Drop a `<slug>.svg` here for any skill whose icon simple-icons does not ship.
`bun run fetch-icons` copies it into `assets/icons/` (with the YAML colour
applied) instead of downloading, and records it in the manifest as
`version: "custom"`. Keep the simple-icons format: `viewBox="0 0 24 24"`, a
single `<path>`, no hard-coded fill.

| Slug    | Source                                                                            | Licence |
| ------- | --------------------------------------------------------------------------------- | ------- |
| `codex` | [@lobehub/icons-static-svg](https://www.npmjs.com/package/@lobehub/icons-static-svg) | MIT     |
| `hermesagent` | [@lobehub/icons-static-svg](https://www.npmjs.com/package/@lobehub/icons-static-svg) (`nousresearch` — the nous-girl mark Hermes Agent ships as its brand badge; simple-icons' `hermes` is the parcel courier) | MIT |
| `kilocode` | [@lobehub/icons-static-svg](https://www.npmjs.com/package/@lobehub/icons-static-svg) | MIT |
| `inngest` | Inngest favicon from [inngest.com](https://www.inngest.com/) (`favicon-june-2025-light.svg`), three paths merged and refitted to 24 × 24 | Inngest brand asset |
| `langfuse` | [@lobehub/icons-static-svg](https://www.npmjs.com/package/@lobehub/icons-static-svg) 1.95.1, paths merged | MIT |
| `aisdk` | AI SDK icon from [ai-sdk.dev](https://ai-sdk.dev/) (`icon.svg`), redrawn at 24 × 24 with the triangle cut out of the square | Vercel brand asset |
| `obra` | Obra Studio logo from [obra.studio](https://obra.studio/) (header SVG), letters cut out of the square; kept at its 96 × 96 viewBox because its arcs cannot be rescaled by multiplying numbers | Obra Studio brand asset |
