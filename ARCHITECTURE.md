# My GitHub Profile README Generator

This is my **GitHub profile README generator** project that dynamically generates a `README.md` file with skillset icons for my GitHub profile.

## Intro

The project reads skill/technology data from a YAML file and generates HTML icons that are inserted into a README template, producing a polished GitHub profile page. It includes a build-time icon fetcher that downloads SVGs from simple-icons with version fallback support.

## Key Components

| Component | Description |
|-----------|-------------|
| `src/main.ts` | Entry point - loads config and triggers README generation |
| `src/cli.ts` | CLI interface using Commander for command-line usage |
| `src/fetch-icons.ts` | Build-time icon fetcher with version-fallback search |
| `src/lib/skillset.ts` | Core `SkillSet` class that handles README generation |
| `src/lib/icon-fetcher.service.ts` | Service for fetching icons from simple-icons with fallback |
| `src/lib/logger.ts` | Shared Pino logger factory with minimal output |
| `src/lib/progress-reporter.ts` | Terminal progress reporter for batch operations |
| `src/schemas/index.ts` | Zod schemas for runtime validation of YAML and config |
| `src/types/index.ts` | TypeScript type definitions |
| `src/data/mystack.yml` | YAML data file containing skills/technologies |
| `src/config.yaml` | Configuration settings |
| `src/templates/readme.tpl.md` | README template with placeholder tags |
| `src/templates/icon.pug` | Pug template for individual skill icons |
| `src/templates/section.pug` | Pug template for skill sections |

## How It Works

1. **Fetch icons** (prebuild) - Downloads SVGs from simple-icons with version fallback
2. **Load config** from `src/config.yaml`
3. **Parse & validate YAML** skillset data via Zod schemas
4. **Render HTML** icons using Pug templates via `renderSkillsHtml()`
5. **Replace placeholders** (`<!-- START mystack -->` / `<!-- END mystack -->`) in template
6. **Write output** to `build` directory

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **CLI**: Commander
- **Templating**: Pug
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
