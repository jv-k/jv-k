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

// Fetch single icon with fallback
const result = await service.fetchIconWithFallback('javascript', '#F7DF1E', versions);

// Batch fetch with progress
const results = await service.fetchIcons(requirements, versions, (r) => {
  console.log(`Fetched: ${r.slug}`);
});
```

**Features:**

- Version fallback search (newest → oldest)
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
  progress.tick('fetched'); // or 'cached', 'fallback', 'failed'
}

progress.done();
console.log(progress.getCounts()); // { fetched: 80, cached: 15, ... }
```

**Output symbols:**

- `+` = newly fetched from latest version
- `.` = cached (reused existing)
- `v` = fetched from older version (fallback)
- `x` = failed (placeholder created)

**Options:**

- `total` - Total item count
- `lineWidth` - Items per line (default: 50)
- `write` - Custom output function
- `silent` - Suppress output

---

### `skillset.ts`

README template rendering with Pug templates.

See `ARCHITECTURE.md` for usage details.
