#!/usr/bin/env bun
/**
 * @fileoverview Build-time icon fetcher with version-fallback search
 *
 * This script fetches icons from simple-icons, searching backwards through
 * major versions if an icon has been removed from newer releases. It applies
 * custom colors and saves SVGs locally for resilient, CDN-independent builds.
 *
 * @author John Valai <git@jvk.to>
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import yaml from 'js-yaml';
import { load as configLoad } from 'node-yaml-config';
import { createLogger } from './lib/logger.js';
import { IconFetcherService } from './lib/icon-fetcher.service.js';
import { createProgressReporter, type ProgressStatus } from './lib/progress-reporter.js';
import {
  validateSkillsYaml,
  formatZodErrors,
  type Skill,
  type SkillSetConfig,
  type IconRequirement,
  type IconManifest,
  type IconFetchResult,
} from './schemas/index.js';

// ============================================================================
// CLI Parsing
// ============================================================================

interface CliOptions {
  force: boolean;
  verbose: boolean;
  dryRun: boolean;
  help: boolean;
}

function parseCliOptions(): CliOptions {
  const { values } = parseArgs({
    options: {
      force: { type: 'boolean', short: 'f', default: false },
      verbose: { type: 'boolean', short: 'v', default: false },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
    allowPositionals: false,
  });

  return {
    force: values.force ?? false,
    verbose: values.verbose ?? false,
    dryRun: values['dry-run'] ?? false,
    help: values.help ?? false,
  };
}

function showHelp(): void {
  console.log(`
Simple Icons Fetcher - Build-time icon fetcher with version fallback

Usage: bun run fetch-icons [options]

Options:
  -f, --force     Force re-fetch all icons (ignore cache)
  -v, --verbose   Enable verbose logging
  --dry-run       Show what would be fetched without writing files
  -h, --help      Show this help message

Examples:
  bun run fetch-icons              # Normal fetch with caching
  bun run fetch-icons --force      # Force re-fetch all icons
  bun run fetch-icons --dry-run    # Preview without changes
`);
}

// ============================================================================
// Configuration
// ============================================================================

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

// Load shared config from config.yaml
const sharedConfig = configLoad<SkillSetConfig>(join(PROJECT_ROOT, 'src/config.yaml'), 'default');

// Resolved paths (relative paths from config resolved against project root)
const dataFilePath = join(PROJECT_ROOT, sharedConfig.datafile);
const outputDirPath = join(PROJECT_ROOT, sharedConfig.icons_output_dir);
const manifestFilePath = join(PROJECT_ROOT, sharedConfig.icons_manifest_path);

// ============================================================================
// Data Loading
// ============================================================================

/**
 * Load icon requirements from YAML data file with Zod validation
 */
function loadIconRequirements(logger: ReturnType<typeof createLogger>): IconRequirement[] {
  logger.info({ path: dataFilePath }, 'Loading icon data...');

  const yamlContent = readFileSync(dataFilePath, 'utf-8');
  const rawData = yaml.load(yamlContent);

  // Validate YAML structure with Zod
  let data;
  try {
    data = validateSkillsYaml(rawData);
  } catch (error) {
    if (error instanceof Error && 'issues' in error) {
      const messages = formatZodErrors(error as import('zod').ZodError);
      logger.error({ errors: messages }, 'YAML validation failed');
      throw new Error(`Invalid YAML data:\n${messages.join('\n')}`);
    }
    throw error;
  }

  const requirements: IconRequirement[] = [];

  for (const [_category, skills] of Object.entries(data.Skillset)) {
    for (const skill of skills as Skill[]) {
      requirements.push({
        slug: skill.name,
        color: skill.color,
      });
    }
  }

  logger.info(
    { iconCount: requirements.length, categoryCount: Object.keys(data.Skillset).length },
    'Found icons'
  );
  return requirements;
}

/**
 * Load existing manifest if available
 */
function loadManifest(): IconManifest | null {
  if (!existsSync(manifestFilePath)) {
    return null;
  }

  try {
    const content = readFileSync(manifestFilePath, 'utf-8');
    return JSON.parse(content) as IconManifest;
  } catch {
    return null;
  }
}

/**
 * Save manifest to disk
 */
function saveManifest(manifest: IconManifest): void {
  writeFileSync(manifestFilePath, JSON.stringify(manifest, null, 2));
}

// ============================================================================
// Main Execution
// ============================================================================

async function main(): Promise<void> {
  // Parse CLI options
  const options = parseCliOptions();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // Initialize logger
  const logger = createLogger();

  logger.info('Simple Icons Fetcher with Version Fallback');
  logger.info('='.repeat(50));

  if (options.dryRun) {
    logger.info('🔍 Dry run mode - no files will be written');
  }

  if (options.force) {
    logger.info('🔄 Force mode - ignoring cache');
  }

  const startTime = Date.now();

  // Ensure output directory exists
  if (!options.dryRun) {
    mkdirSync(outputDirPath, { recursive: true });
  }

  // Initialize service
  const service = new IconFetcherService({
    config: sharedConfig,
    logger,
  });

  // Load requirements and existing manifest
  const requirements = loadIconRequirements(logger);
  const existingManifest = options.force ? null : loadManifest();

  // Get available versions
  const majorVersions = await service.getAvailableMajorVersions();
  const latestVersion = await service.getLatestVersion();

  logger.info('Fetching icons with version fallback...');

  // Initialize progress reporter
  const progress = createProgressReporter({
    total: requirements.length,
    lineWidth: 50,
    silent: options.dryRun,
  });

  // Track results
  const newManifest: IconManifest = {
    generatedAt: new Date().toISOString(),
    simpleIconsLatest: latestVersion,
    icons: {},
  };

  const results: IconFetchResult[] = [];
  const latestMajor = majorVersions[0] ?? 0;

  // Process icons with concurrency limit
  await service.mapWithConcurrency(
    requirements,
    async (req): Promise<void> => {
      const existing = existingManifest?.icons[req.slug];

      // Check if we can use cached version
      if (existing && existing.color === service.normalizeColor(req.color)) {
        const iconPath = join(outputDirPath, `${req.slug}.svg`);
        if (existsSync(iconPath)) {
          // Reuse existing manifest entry
          newManifest.icons[req.slug] = existing;
          progress.tick('cached');
          results.push({
            slug: req.slug,
            svg: '',
            version: existing.version,
            success: true,
          });
          return;
        }
      }

      // Fetch with version fallback
      const result = await service.fetchIconWithFallback(req.slug, req.color, majorVersions);
      results.push(result);

      if (result.success) {
        // Write SVG to disk
        if (!options.dryRun) {
          const iconPath = join(outputDirPath, `${result.slug}.svg`);
          writeFileSync(iconPath, result.svg);
        }

        // Add to manifest
        newManifest.icons[result.slug] = {
          version: result.version,
          color: service.normalizeColor(req.color),
          hash: service.hashContent(result.svg),
          fetchedAt: new Date().toISOString(),
        };

        const status: ProgressStatus =
          parseInt(result.version, 10) < latestMajor ? 'fallback' : 'fetched';
        progress.tick(status);
      } else {
        // Write placeholder
        if (!options.dryRun) {
          const iconPath = join(outputDirPath, `${result.slug}.svg`);
          writeFileSync(iconPath, result.svg);
        }

        newManifest.icons[result.slug] = {
          version: 'placeholder',
          color: service.normalizeColor(req.color),
          hash: service.hashContent(result.svg),
          fetchedAt: new Date().toISOString(),
        };

        progress.tick('failed');
      }
    },
    sharedConfig.icons_concurrency_limit
  );

  progress.done();

  // Save manifest
  if (!options.dryRun) {
    saveManifest(newManifest);
  }

  // Get counts
  const counts = progress.getCounts();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  logger.info('='.repeat(50));
  logger.info(
    {
      fetched: counts.fetched,
      fallback: counts.fallback,
      cached: counts.cached,
      failed: counts.failed,
      elapsed: `${elapsed}s`,
    },
    'Summary'
  );
  logger.info({ output: outputDirPath, manifest: manifestFilePath }, 'Paths');

  // Report fallback details
  const fallbackIcons = results.filter((r) => r.success && parseInt(r.version, 10) < latestMajor);

  if (fallbackIcons.length > 0) {
    logger.warn(
      { icons: fallbackIcons.map((i) => ({ slug: i.slug, version: i.version })) },
      'Icons fetched from older versions'
    );
  }

  // Report failures
  const failedIcons = results.filter((r) => !r.success);

  if (failedIcons.length > 0) {
    logger.error(
      { icons: failedIcons.map((i) => ({ slug: i.slug, error: i.error })) },
      'Icons not found (placeholders created)'
    );
  }

  // Exit with error if any icons failed
  if (counts.failed > 0) {
    logger.warn('Build completed with warnings. Some icons could not be found.');
  }

  if (options.dryRun) {
    logger.info('✅ Dry run complete - no files were written');
  } else {
    logger.info('Done!');
  }
}

// Run
main().catch((error) => {
  const logger = createLogger();
  logger.fatal({ error }, 'Fatal error');
  process.exit(1);
});
