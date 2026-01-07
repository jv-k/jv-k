# Complete Code Documentation

This document provides a comprehensive explanation of every part of the jv-k repository codebase.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [File-by-File Documentation](#file-by-file-documentation)
5. [Data Flow](#data-flow)
6. [Build Process](#build-process)
7. [Testing Strategy](#testing-strategy)

---

## Project Overview

### What This Project Does

This is a **GitHub Profile README Generator** that dynamically creates a professional README.md file with technology skill badges/icons. It reads skill data from a YAML configuration file and generates HTML icons that are inserted into a README template.

### Key Features

1. **Dynamic Icon Generation**: Reads skills from YAML and generates HTML badges
2. **Icon Fetcher with Version Fallback**: Downloads SVG icons from simple-icons with intelligent version fallback
3. **Template-Based**: Uses Pug templates for flexible HTML generation
4. **CLI Interface**: Can be run from command line with various options
5. **Type-Safe**: Full TypeScript with strict type checking
6. **Validated**: Uses Zod schemas for runtime validation
7. **Testable**: Comprehensive test suite using Bun's test runner

### Technology Stack

- **Runtime**: Bun (JavaScript/TypeScript runtime)
- **Language**: TypeScript (with strict mode enabled)
- **CLI Framework**: Commander.js
- **Templating**: Pug
- **Data Format**: YAML (parsed with js-yaml)
- **Validation**: Zod schemas
- **Configuration**: node-yaml-config
- **Logging**: Pino with pino-pretty
- **Testing**: Bun test runner
- **Linting**: ESLint with TypeScript support

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERACTION                         │
│  (CLI Command: bun run build OR bun run fetch-icons)        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    ENTRY POINTS                              │
│  - src/main.ts (Direct execution)                           │
│  - src/cli.ts (CLI with options)                            │
│  - src/fetch-icons.ts (Icon fetcher script)                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  CONFIGURATION LAYER                         │
│  - src/config.yaml (All settings)                           │
│  - Load with node-yaml-config                               │
│  - Validate with Zod schemas                                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                │
│  - src/data/mystack.yml (Skills data)                       │
│  - Parse with js-yaml                                       │
│  - Validate with Zod schemas                                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                 BUSINESS LOGIC LAYER                         │
│  - SkillSet class (Core README generation)                  │
│  - IconFetcherService (Icon downloading)                    │
│  - Logger (Logging)                                          │
│  - ProgressReporter (Terminal output)                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  TEMPLATE LAYER                              │
│  - src/templates/readme.tpl.md (README template)            │
│  - src/templates/section.pug (Section HTML)                 │
│  - src/templates/icon.pug (Icon HTML)                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     OUTPUT                                   │
│  - build/readme.md (Generated README)                       │
│  - assets/icons/*.svg (Downloaded icons)                    │
│  - assets/icons/manifest.json (Icon metadata)               │
└─────────────────────────────────────────────────────────────┘
```

### Module Structure

```
src/
├── main.ts                    # Main entry point
├── cli.ts                     # CLI interface
├── fetch-icons.ts             # Icon fetcher script
├── config.yaml                # Configuration file
├── data/
│   └── mystack.yml           # Skills data
├── lib/
│   ├── skillset.ts           # Core SkillSet class
│   ├── icon-fetcher.service.ts  # Icon fetching service
│   ├── logger.ts             # Logging utility
│   ├── progress-reporter.ts  # Progress reporting
│   └── README.md             # Library documentation
├── schemas/
│   └── index.ts              # Zod validation schemas
├── templates/
│   ├── readme.tpl.md         # README template
│   ├── section.pug           # Section template
│   └── icon.pug              # Icon template
└── types/
    └── index.ts              # TypeScript type definitions
```

---

## Core Components

### 1. SkillSet Class (`src/lib/skillset.ts`)

**Purpose**: Core class responsible for generating the README with skill icons.

**Key Responsibilities**:
- Load skill data from YAML file
- Render HTML icons using Pug templates
- Replace placeholder tags in README template
- Write output file

**Main Methods**:

```typescript
// Load skills data from YAML
getData(): Promise<SkillsData>

// Generate HTML for all skills using Pug templates
renderSkillsHtml(): string

// Read README template file
getReadmeFile(): Promise<string>

// Replace placeholder tags with generated HTML
prepareHtml(): string

// Write final README to output file
writeReadmeFile(): Promise<void>

// Main orchestration method
renderReadme(): Promise<void>
```

**How It Works**:
1. Constructor validates required config fields
2. `renderReadme()` orchestrates the entire process:
   - Loads YAML data → `getData()`
   - Renders HTML → `renderSkillsHtml()`
   - Loads template → `getReadmeFile()`
   - Merges content → `prepareHtml()`
   - Writes output → `writeReadmeFile()`


### 2. IconFetcherService (`src/lib/icon-fetcher.service.ts`)

**Purpose**: Downloads SVG icons from simple-icons with intelligent version fallback.

**Key Features**:
- Version fallback: If an icon isn't in latest version, searches older versions
- Concurrent downloads with configurable limit
- Retry logic with exponential backoff
- Rate limiting handling
- Color customization for SVGs
- Placeholder generation for missing icons

**Algorithm for Version Fallback**:
1. Get list of available major versions from jsDelivr API
2. Sort versions descending (newest first)
3. For each icon:
   - Try latest version first (HEAD request to check existence)
   - If not found, try next older version
   - Continue until icon found or all versions exhausted
   - If not found anywhere, generate placeholder SVG
4. Apply custom color to SVG
5. Save to disk with manifest entry

### 3. Logger (`src/lib/logger.ts`)

**Purpose**: Provides consistent, clean logging throughout the application.

**Implementation**: Uses Pino logger with pino-pretty transport for human-readable output.

**Configuration**:
- Silent mode: Suppresses all output
- Normal mode: Shows info, warn, error, fatal levels
- Output format: Minimal, no timestamps/PID/hostname
- Colorized output for terminal

### 4. ProgressReporter (`src/lib/progress-reporter.ts`)

**Purpose**: Displays progress for batch operations in the terminal.

**Status Symbols**:
- `+` = Newly fetched from latest version
- `.` = Cached (reused existing)
- `v` = Fetched from older version (fallback)
- `x` = Failed (placeholder created)

---

## File-by-File Documentation

### Entry Points

#### `src/main.ts`

**Purpose**: Simplest entry point for direct execution.

**What it does**:
```typescript
// 1. Import dependencies
import { load as configLoad } from 'node-yaml-config';
import SkillSet from './lib/skillset.js';

// 2. Load configuration from config.yaml
const config = configLoad<SkillSetConfig>('./src/config.yaml');

// 3. Create SkillSet instance with configuration
const mySkills = new SkillSet(config);

// 4. Generate the README (async operation)
await mySkills.renderReadme();
```

**Use Case**: Quick README generation without CLI options.

**Execution**: `bun ./src/main.ts` or `bun run build`

---

#### `src/cli.ts`

**Purpose**: Command-line interface with options and help.

**CLI Options Explained**:
- `-b, --build`: Required flag to trigger README generation
- `-c, --config <path>`: Custom config file path (default: ./src/config.yaml)
- `-e, --env <environment>`: Config environment section (default: 'default')
- `-o, --output <path>`: Override output file path
- `-s, --silent`: Suppress all log output
- `-v, --verbose`: Enable verbose logging

**Usage Examples**:
```bash
# Basic usage
bun run start --build

# Custom config
bun run start --build --config ./custom-config.yaml

# Custom output path
bun run start --build --output ./custom-readme.md

# Silent mode
bun run start --build --silent
```

---

#### `src/fetch-icons.ts`

**Purpose**: Build-time script that downloads SVG icons from simple-icons with version fallback.

**CLI Options**:
- `-f, --force`: Force re-fetch all icons (ignore cache)
- `-v, --verbose`: Enable verbose logging
- `--dry-run`: Preview what would be fetched without writing files
- `-h, --help`: Show help message

**Execution Flow**:
1. Parse CLI arguments
2. Load configuration
3. Load icon requirements from YAML
4. Get available simple-icons versions
5. For each icon:
   - Check cache (manifest.json)
   - If cached and color matches, reuse
   - Otherwise, fetch with version fallback
   - Save SVG and update manifest
6. Display summary statistics

**Caching Strategy**:
- Icons are cached in `assets/icons/` directory
- Manifest tracks version, color, hash, fetchedAt
- If icon exists with same color, skip download
- If color changes, re-download with new color
- Use `--force` to ignore cache and re-download all

---

### Configuration Files

#### `src/config.yaml`

**Purpose**: Central configuration for the entire application.

**Configuration Fields Explained**:

**README Generation**:
- `datafile`: Path to YAML file containing skills data
- `tpl_section`: Pug template for rendering a skill section (category)
- `tpl_icon`: Pug template for rendering individual skill icon
- `tag_start`: HTML comment marking start of generated content
- `tag_end`: HTML comment marking end of generated content
- `file_input`: Path to README template file (contains placeholder tags)
- `file_output`: Where to write generated README

**Icon Fetcher**:
- `icons_output_dir`: Directory to save downloaded SVG files
- `icons_manifest_path`: JSON file tracking icon metadata (version, color, hash)
- `icons_cdn_base_url`: Primary CDN for fetching icons (jsDelivr)
- `icons_package_api_url`: API endpoint to get available versions
- `icons_fallback_cdn_url`: Secondary CDN if primary fails (unpkg)
- `icons_concurrency_limit`: Max number of simultaneous downloads (prevents rate limiting)
- `icons_request_timeout`: HTTP request timeout in milliseconds
- `icons_max_retries`: Number of retry attempts for failed requests
- `icons_min_major_version`: Oldest simple-icons version to check during fallback

---

#### `src/data/mystack.yml`

**Purpose**: YAML data file containing all skills/technologies to display.

**Structure**:
```yaml
---
Skillset:                    # Root key (required)
  'Category Name':           # Category/section name
    - name: iconslug         # Icon slug from simple-icons
      color: '#HEX'          # Hex color code (with or without #)
      url: https://...       # Link URL for the icon
    - name: another
      color: '#ABC123'
      url: https://...
  'Another Category':
    - name: skill3
      color: 'FFF'           # 3-digit hex also supported
      url: https://...
```

**Validation Rules** (enforced by Zod schemas):
- `name`: Must be lowercase alphanumeric, can use "dot" for periods (e.g., `nodedotjs`)
- `color`: Must be valid hex color (3 or 6 digits, with or without #)
- `url`: Must be valid HTTP/HTTPS URL
- Each category must have at least one skill
- Category names: 1-50 characters

**Icon Slug Naming Convention**:
Icons follow simple-icons naming: lowercase, no spaces, "dot" for periods
- `typescript` ✓
- `nodedotjs` ✓ (represents node.js)
- `cplusplus` ✓
- `Node.js` ✗ (use nodedotjs)
- `TypeScript` ✗ (use typescript)

---

### Template Files

#### `src/templates/readme.tpl.md`

**Purpose**: Markdown template for the final README. Contains placeholder tags where generated HTML will be inserted.

**Structure**:
```markdown
# Your README Content

Some static content here...

<!-- START mystack -->
(This section will be replaced with generated HTML)
<!-- END mystack -->

More static content...
```

**How It Works**:
1. SkillSet class reads this template
2. Generates HTML skills icons
3. Replaces everything between `<!-- START mystack -->` and `<!-- END mystack -->`
4. Writes result to output file

---

#### `src/templates/section.pug`

**Purpose**: Pug template for rendering a skill category section.

```pug
section
  h6=name
  !=icons
| 
```

**Generated HTML Example**:
```html
<section>
  <h6>Languages</h6>
  <a href="..."><img src="..." /></a> <a href="..."><img src="..." /></a>
</section> 
```

---

#### `src/templates/icon.pug`

**Purpose**: Pug template for rendering individual skill icon/badge.

```pug
a(href=url title=name)
  img(
    src=`./assets/icons/${name}.svg`
    width=36
    height=36
    alt=name
  )
=" "
| 
```

**Generated HTML Example**:
```html
<a href="https://www.typescriptlang.org/" title="typescript">
  <img src="./assets/icons/typescript.svg" width="36" height="36" alt="typescript"/>
</a> 
```


---

## Data Flow

### Complete Data Flow Diagram

```
1. USER RUNS: bun run build
   ↓
2. ENTRY POINT: src/main.ts or src/cli.ts
   - Parses CLI options (if using CLI)
   - Loads config.yaml
   ↓
3. CONFIGURATION LOADING
   - node-yaml-config reads config.yaml
   - Returns SkillSetConfig object
   ↓
4. SKILLSET INSTANTIATION
   - new SkillSet(config)
   - Validates required config fields
   - Creates logger
   ↓
5. renderReadme() ORCHESTRATION
   ↓
6. LOAD YAML DATA: getData()
   - Reads src/data/mystack.yml
   - Parses with js-yaml
   - Returns SkillsData object
   ↓
7. RENDER HTML: renderSkillsHtml()
   - Compile Pug templates (section.pug, icon.pug)
   - For each category in SkillsData:
     - For each skill:
       - Render icon.pug with IconTemplateData
       - Append to icons HTML string
     - Render section.pug with SectionTemplateData
     - Append to complete HTML string
   - Return complete HTML
   ↓
8. LOAD TEMPLATE: getReadmeFile()
   - Read src/templates/readme.tpl.md
   - Return template string
   ↓
9. MERGE CONTENT: prepareHtml()
   - Create regex for placeholder tags
   - Replace content between tags with generated HTML
   - Return final README content
   ↓
10. WRITE OUTPUT: writeReadmeFile()
    - Write to build/readme.md
    - Log success
   ↓
11. COMPLETE
    - Success message
    - Exit 0
```

### Icon Fetching Flow

```
1. USER RUNS: bun run fetch-icons
   ↓
2. ENTRY POINT: src/fetch-icons.ts
   - Parse CLI options (--force, --dry-run, etc.)
   - Load config.yaml
   ↓
3. INITIALIZE SERVICES
   - Create logger
   - Create IconFetcherService
   - Create ProgressReporter
   ↓
4. LOAD DATA
   - loadIconRequirements():
     - Read mystack.yml
     - Parse with js-yaml
     - Validate with Zod
     - Extract { slug, color } for each skill
   - loadManifest():
     - Read existing manifest.json (if exists)
   ↓
5. DISCOVER VERSIONS
   - getAvailableMajorVersions():
     - Fetch from jsDelivr API
     - Extract major versions (13, 12, 11, ...)
     - Sort descending (newest first)
     - Return array: [13, 12, 11, 10, ...]
   ↓
6. PROCESS ICONS (with concurrency control)
   For each icon requirement:
     ↓
     CHECK CACHE
     - If manifest has entry with same color:
       - If SVG file exists: REUSE (progress: cached)
     ↓
     FETCH WITH FALLBACK
     - For each version (newest to oldest):
       - iconExistsAtVersion() [HEAD request]
       - If exists:
         - fetchSvgFromVersion() [GET request]
         - applyColorToSvg()
         - Return success
       - If not exists: try next version
     - If not found in any version:
       - generatePlaceholderSvg()
       - Return failure
     ↓
     SAVE RESULTS
     - Write SVG to assets/icons/{slug}.svg
     - Add entry to new manifest
     - Update progress (fetched/fallback/failed)
   ↓
7. FINALIZE
   - Save manifest.json
   - Display summary statistics
   - Report fallback icons (fetched from older versions)
   - Report failed icons (placeholders created)
   ↓
8. COMPLETE
```

---

## Build Process

### NPM Scripts Explained

```json
{
  "scripts": {
    // DEVELOPMENT
    "start": "bun ./src/cli.ts",
    // Execute CLI interface directly
    
    "build": "bun ./src/main.ts",
    // Generate README (runs prebuild first)
    
    "prebuild": "bun run fetch-icons",
    // Auto-runs before build (fetches icons)
    
    "watch": "nodemon --ext ts --exec bun run build",
    // Watch TypeScript files and rebuild on changes
    
    // ICON MANAGEMENT
    "fetch-icons": "bun ./src/fetch-icons.ts",
    // Fetch icons with caching
    
    "fetch-icons:fresh": "rm -rf assets/icons && bun ./src/fetch-icons.ts",
    // Delete all icons and re-fetch
    
    "fetch-icons:help": "bun ./src/fetch-icons.ts --help",
    // Show icon fetcher help
    
    // QUALITY ASSURANCE
    "validate": "bun run typecheck && bun run lint",
    // Run type checking and linting
    
    "typecheck": "tsc --noEmit",
    // Type check without emitting files
    
    "lint": "eslint .",
    // Lint all TypeScript files
    
    "lint:fix": "eslint . --fix",
    // Auto-fix linting issues
    
    "lint:yaml": "yamllint src/data/mystack.yml",
    // Lint YAML files
    
    // TESTING
    "test": "bun test --ci",
    // Run tests in CI mode (no watch)
    
    "test:watch": "bun test --watch",
    // Run tests in watch mode
    
    "test:coverage": "bun test --coverage",
    // Run tests with coverage report
    
    // CI/CD
    "ci": "bun run typecheck && bun run lint && bun run test",
    // Complete CI pipeline
  }
}
```

### Build Steps

**Full Build Process**:
```bash
bun run build
```

1. **Prebuild** (automatic): `bun run fetch-icons`
   - Fetches all SVG icons from simple-icons
   - Uses caching to skip unchanged icons
   - Generates manifest.json

2. **Build**: `bun ./src/main.ts`
   - Loads configuration
   - Reads YAML data
   - Generates HTML
   - Creates README

---

## Testing Strategy

### Test Structure

```
tests/
├── fetch-icons.test.ts        # Icon fetcher integration tests
├── icon-fetcher.service.test.ts  # Service unit tests
├── progress-reporter.test.ts  # Progress reporter tests
├── schemas.test.ts            # Zod schema validation tests
├── skillset.test.ts          # SkillSet class tests
└── test.yaml.ts              # YAML parsing tests
```

### Running Tests

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage

# Run in watch mode (auto-rerun on changes)
bun test --watch

# Run specific test file
bun test tests/skillset.test.ts
```

---

## Common Tasks & Examples

### Add a New Skill

1. Edit `src/data/mystack.yml`:
```yaml
Skillset:
  'Languages':
    - name: rust          # New skill
      color: '#000000'
      url: https://www.rust-lang.org/
```

2. Run build:
```bash
bun run build
```

### Change Icon Colors

1. Edit color in `src/data/mystack.yml`:
```yaml
- name: typescript
  color: '#FF0000'      # Change from blue to red
  url: https://www.typescriptlang.org/
```

2. Re-fetch icons:
```bash
bun run fetch-icons --force  # Force re-download with new color
```

3. Rebuild README:
```bash
bun run build
```

### Add a New Category

```yaml
Skillset:
  'New Category':       # Add new section
    - name: skill1
      color: '#123456'
      url: https://...
    - name: skill2
      color: '#ABCDEF'
      url: https://...
```

---

## Troubleshooting

### Issue: Icons Not Downloading

**Symptoms**: Placeholder icons generated instead of actual icons

**Solutions**:
1. Verify icon name at https://simpleicons.org/
2. Check network connection
3. Wait and retry with `--force`

### Issue: YAML Validation Failed

**Symptoms**: Error message with validation failures

**Solutions**:
1. Check YAML syntax with linter: `bun run lint:yaml`
2. Ensure all skills have name, color, url
3. Use valid hex colors: #FFF or #FFFFFF
4. Use valid URLs: https://...
5. Use lowercase icon slugs: nodedotjs not Node.js

### Issue: README Not Generated

**Solutions**:
1. Create output directory: `mkdir -p build`
2. Check file permissions
3. Verify template file exists and is valid

---

## Summary

This codebase is a **GitHub Profile README Generator** that:

1. **Reads** skill data from YAML
2. **Fetches** corresponding SVG icons from simple-icons
3. **Generates** HTML badges with Pug templates
4. **Inserts** badges into README template
5. **Outputs** final README.md file

**Key Features**:
- Type-safe with TypeScript
- Runtime validation with Zod
- Intelligent icon fetching with version fallback
- Caching for performance
- CLI with options
- Comprehensive testing
- Well-structured and maintainable

**Main Files**:
- `src/main.ts`: Entry point
- `src/cli.ts`: CLI interface
- `src/fetch-icons.ts`: Icon fetcher
- `src/lib/skillset.ts`: Core logic
- `src/lib/icon-fetcher.service.ts`: Icon fetching
- `src/schemas/index.ts`: Validation
- `src/data/mystack.yml`: Data
- `src/config.yaml`: Configuration

That's a complete explanation of every part of this codebase!

