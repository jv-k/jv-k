# My GitHub Profile README Generator

This is my **GitHub profile README generator** project that dynamically generates a `README.md` file with skillset icons for my GitHub profile.

## Intro

The project reads skill/technology data from a YAML file and renders each category as an SVG card with its title drawn in a custom font; each card links to a live copy of itself where every icon has a hover effect and links to its technology. The cards are inserted into a README template, whose headings are redrawn in the same font, producing a polished GitHub profile page. It includes a build-time icon fetcher that downloads SVGs from simple-icons with version fallback support.

## Key Components

| Component | Description |
|-----------|-------------|
| `src/main.ts` | Entry point - loads config and triggers README generation |
| `src/cli.ts` | CLI interface using Commander for command-line usage |
| `src/fetch-icons.ts` | Build-time icon fetcher with version-fallback search |
| `src/lib/skillset.ts` | Core `SkillSet` class that handles README generation |
| `src/lib/svg-assets.ts` | SVG cards (light, dark and live) and page heading images, with text drawn as font outlines |
| `src/lib/icon-fetcher.service.ts` | Service for fetching icons from simple-icons with fallback |
| `src/lib/logger.ts` | Shared Pino logger factory with minimal output |
| `src/lib/progress-reporter.ts` | Terminal progress reporter for batch operations |
| `src/schemas/index.ts` | Zod schemas for runtime validation of YAML and config |
| `src/types/index.ts` | TypeScript type definitions |
| `src/data/mystack.yml` | YAML data file containing skills/technologies |
| `assets/icons-custom/` | Local SVG overrides for icons simple-icons lacks (`<slug>.svg`) |
| `assets/generated/` | Generated images: cards (`cards/<slug>-light.svg`, `-dark.svg`, and the live `<slug>.svg`) and page headings (`headings/`) |
| `src/config.yaml` | Configuration settings |
| `src/templates/readme.tpl.md` | README template with placeholder tags |
| `src/templates/section.pug` | Pug template for a skill card: a themed `<picture>` linking to the live card |

## How It Works

1. **Fetch icons** (prebuild) - Downloads SVGs from simple-icons with version fallback; a `<slug>.svg` in `assets/icons-custom/` takes precedence and is copied instead
2. **Load config** from `src/config.yaml`
3. **Parse & validate YAML** skillset data via Zod schemas
4. **Render cards** via `renderSkillsHtml()`: writes a light and a dark card per category, titled in the configured `font` (sized and cased by `cards_title_size` and `cards_title_case`), plus a live card that follows the viewer's colour scheme and gives each icon a hover effect and a link; the README card links to the live one at `cards_live_url` (jsDelivr, since GitHub's raw URLs do not render SVG as a page), with a content hash so browsers never keep a stale copy
5. **Replace placeholders** (`<!-- START mystack -->` / `<!-- END mystack -->`) in template
6. **Redraw headings** via `renderHeadings()`: each markdown heading's text becomes a light and a dark SVG in `font` at GitHub's size for its level, cased by `headings_case`; a leading emoji stays as text, and headings holding markup are left alone
7. **Write output** to `build` directory

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **CLI**: Commander
- **Templating**: Pug
- **Card and heading text**: opentype.js (text to SVG outlines), Oxanium via Fontsource
- **Data**: YAML (`js-yaml`)
- **Validation**: Zod
- **Config**: `node-yaml-config`
- **Logging**: Pino with pino-pretty
- **Testing**: Bun test runner with comprehensive test suite
- **Linting**: ESLint with TypeScript support
- **License**: MIT

## Usage

```bash
# Fetch icons and build README
bun run build

# Just fetch icons
bun run fetch-icons

# CLI usage
bun run start --build

# Run tests
bun test
```
