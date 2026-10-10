# Library Modules

This directory contains shared utility modules used across the app.

## Modules

### `logger.ts`

Structured logging with [Pino](https://getpino.io/).

```typescript
import { createLogger } from './lib/logger.js';

const logger = createLogger();       // Normal logging
const silent = createLogger(true);   // Silent mode for tests
```

**Features:**

- Clean, colorized output via `pino-pretty`
- Minimal format (no timestamps, PID, hostname in dev)
- Log levels: trace, debug, info, warn, error, fatal

---

### `icon-fetcher.service.ts`

Core icon fetching logic with version fallback support.

```typescript
import { IconFetcherService } from './lib/icon-fetcher.service.js';

const service = new IconFetcherService({
  config: skillSetConfig,
  logger: createLogger(),
  fetch: customFetch, // Optional: for testing
});

// Get available versions
const versions = await service.getAvailableMajorVersions();

// Local override for icons simple-icons lacks (null if <customDir>/<slug>.svg is absent)
const custom = service.loadCustomIcon('codex', '#333', customDir);

// Fetch single icon with fallback
const result = await service.fetchIconWithFallback('javascript', '#F7DF1E', versions);

// Batch fetch with progress
const results = await service.fetchIcons(requirements, versions, (r) => {
  console.log(`Fetched: ${r.slug}`);
});
```

**Features:**

- Version fallback search (newest → oldest)
- Local SVG overrides (`assets/icons-custom/<slug>.svg`)
- HEAD request optimization
- Fallback CDN support
- Placeholder SVG generation
- Concurrency-controlled batch processing
- Dependency injection for testability

---

### `progress-reporter.ts`

Terminal progress indication for batch operations.

```typescript
import { createProgressReporter } from './lib/progress-reporter.js';

const progress = createProgressReporter({ total: 100 });

for (const item of items) {
  await processItem(item);
  progress.tick('fetched'); // or 'cached', 'fallback', 'custom', 'failed'
}

progress.done();
console.log(progress.getCounts()); // { fetched: 80, cached: 15, ... }
```

**Output symbols:**

- `+` = newly fetched from latest version
- `.` = cached (reused existing)
- `v` = fetched from older version (fallback)
- `*` = custom (local override SVG)
- `x` = failed (placeholder created)

**Options:**

- `total` - Total item count
- `lineWidth` - Items per line (default: 50)
- `write` - Custom output function
- `silent` - Suppress output

---

### `svg-assets.ts`

SVG images for the README beyond the icons. GitHub strips `style` and `class`
from README HTML, so each skill category is drawn as an SVG card: images are
inline, so the cards flow side by side and wrap. An SVG in `<img>` cannot load
web fonts, follow links or react to hover, so icons are inlined, text is drawn
as font outlines, and each card links to a live copy of itself that works as a
page, with per-icon hover and links.

```typescript
import {
  renderCard,
  renderLiveCard,
  renderHeading,
  iconName,
  cardTooltip,
} from './lib/svg-assets.js';

const style = { font, size: 11, case: 'upper' };

// README card for one theme: dark icons get a light ink on the dark card
const { svg, width, height } = renderCard('Languages', icons, 'dark', style);

// Live card the README card links to: follows the colour scheme, icons hover and link
const live = renderLiveCard('Languages', icons, style);

// Page heading at GitHub's size for its level
const heading = renderHeading('Hi there!', 1, 'light', { font, case: 'upper' });

iconName(iconSvg, 'nodedotjs'); // 'Node.js', from the SVG <title>
cardTooltip('API', ['GraphQL', 'tRPC']); // 'API: GraphQL • tRPC'
```

---

### `skillset.ts`

README template rendering with Pug templates.

See `ARCHITECTURE.md` for usage details.
