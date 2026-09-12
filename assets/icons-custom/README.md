# Custom icon overrides

Drop a `<slug>.svg` here for any skill whose icon simple-icons does not ship.
`bun run fetch-icons` copies it into `assets/icons/` (with the YAML colour
applied) instead of downloading, and records it in the manifest as
`version: "custom"`. Keep the simple-icons format: `viewBox="0 0 24 24"`, a
single `<path>`, no hard-coded fill.

| Slug    | Source                                                                            | Licence |
| ------- | --------------------------------------------------------------------------------- | ------- |
| `codex` | [@lobehub/icons-static-svg](https://www.npmjs.com/package/@lobehub/icons-static-svg) | MIT     |
