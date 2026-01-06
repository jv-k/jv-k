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
import yaml from 'js-yaml';
import { load as configLoad } from 'node-yaml-config';
import { createLogger } from './lib/logger.js';
import {
  validateSkillsYaml,
  formatZodErrors,
  type Skill,
  type SkillSetConfig,
  type IconRequirement,
  type IconManifest,
  type IconFetchResult,
  type PackageVersionInfo,
} from './schemas/index.js';

// ============================================================================
// Logger
// ============================================================================

const logger = createLogger();

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
// Utilities
// ============================================================================

/**
 * Simple hash function for SVG content
 */
function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `sha256:${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * Normalize hex color (remove # prefix, validate format)
 */
function normalizeColor(color: string): string {
  const hex = color.replace(/^#/, '');

  // Handle 3-digit hex
  if (/^[A-Fa-f0-9]{3}$/.test(hex)) {
    return hex
      .split('')
      .map((c) => c + c)
      .join('');
  }

  // Handle 6-digit hex
  if (/^[A-Fa-f0-9]{6}$/.test(hex)) {
    return hex;
  }

  logger.warn({ color }, 'Invalid hex color, using default black');
  return '000000';
}

/**
 * Apply fill color to SVG
 */
function applyColorToSvg(svg: string, hexColor: string): string {
  const normalizedHex = normalizeColor(hexColor);

  // Remove any existing fill attributes on the root svg element
  let modifiedSvg = svg.replace(/<svg([^>]*)\sfill="[^"]*"/, '<svg$1');

  // Add fill attribute to svg element
  modifiedSvg = modifiedSvg.replace('<svg', `<svg fill="#${normalizedHex}"`);

  return modifiedSvg;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout and retry logic
 */
async function fetchWithRetry(
  url: string,
  options: { method?: string; retries?: number } = {}
): Promise<Response> {
  const { method = 'GET', retries = sharedConfig.icons_max_retries } = options;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), sharedConfig.icons_request_timeout);

      const response = await fetch(url, {
        method,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        // Rate limited - wait and retry
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
        logger.warn({ retryAfter }, 'Rate limited, waiting...');
        await sleep(retryAfter * 1000);
        continue;
      }

      return response;
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      logger.warn({ attempt, delay }, 'Attempt failed, retrying...');
      await sleep(delay);
    }
  }

  throw new Error(`Failed after ${retries} attempts`);
}

// ============================================================================
// Version Discovery
// ============================================================================

/**
 * Get available major versions from jsDelivr API
 */
async function getAvailableMajorVersions(): Promise<number[]> {
  logger.info('Fetching available simple-icons versions...');

  try {
    const response = await fetchWithRetry(sharedConfig.icons_package_api_url);

    if (!response.ok) {
      throw new Error(`Failed to fetch package info: ${response.status}`);
    }

    const data = (await response.json()) as PackageVersionInfo;

    // Extract major versions and deduplicate
    const majorVersions = new Set<number>();
    for (const { version } of data.versions) {
      const majorStr = version.split('.')[0];
      if (majorStr) {
        const major = parseInt(majorStr, 10);
        if (!isNaN(major) && major >= sharedConfig.icons_min_major_version) {
          majorVersions.add(major);
        }
      }
    }

    // Sort descending (newest first)
    const sorted = Array.from(majorVersions).sort((a, b) => b - a);
    logger.info(
      { count: sorted.length, latest: sorted[0], oldest: sorted[sorted.length - 1] },
      'Found major versions'
    );

    return sorted;
  } catch (error) {
    logger.error({ error }, 'Failed to fetch version info');
    // Fallback to hardcoded range
    const fallback = Array.from({ length: 16 }, (_, i) => 16 - i);
    logger.info(
      { latest: fallback[0], oldest: fallback[fallback.length - 1] },
      'Using fallback versions'
    );
    return fallback;
  }
}

/**
 * Get the latest version string
 */
async function getLatestVersion(): Promise<string> {
  try {
    const response = await fetchWithRetry(sharedConfig.icons_package_api_url);
    if (!response.ok) return 'unknown';

    const data = (await response.json()) as PackageVersionInfo;
    return data.versions[0]?.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

// ============================================================================
// Icon Fetching with Version Fallback
// ============================================================================

/**
 * Check if icon exists at a specific version (using HEAD request)
 */
async function iconExistsAtVersion(slug: string, majorVersion: number): Promise<boolean> {
  const url = `${sharedConfig.icons_cdn_base_url}@${majorVersion}/icons/${slug}.svg`;

  try {
    const response = await fetchWithRetry(url, { method: 'HEAD', retries: 1 });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch SVG content from a specific version
 */
async function fetchSvgFromVersion(
  slug: string,
  majorVersion: number,
  useFallbackCdn = false
): Promise<string | null> {
  const baseUrl = useFallbackCdn ? sharedConfig.icons_fallback_cdn_url : sharedConfig.icons_cdn_base_url;
  const url = `${baseUrl}@${majorVersion}/icons/${slug}.svg`;

  try {
    const response = await fetchWithRetry(url);

    if (!response.ok) {
      return null;
    }

    return await response.text();
  } catch {
    if (!useFallbackCdn) {
      // Try fallback CDN
      return fetchSvgFromVersion(slug, majorVersion, true);
    }
    return null;
  }
}

/**
 * Fetch icon with version fallback search
 */
async function fetchIconWithFallback(
  slug: string,
  color: string,
  majorVersions: number[]
): Promise<IconFetchResult> {
  for (const version of majorVersions) {
    // Check existence with HEAD request first (faster)
    const exists = await iconExistsAtVersion(slug, version);

    if (exists) {
      // Fetch the actual SVG
      const svg = await fetchSvgFromVersion(slug, version);

      if (svg) {
        const coloredSvg = applyColorToSvg(svg, color);
        return {
          slug,
          svg: coloredSvg,
          version: `${version}`,
          success: true,
        };
      }
    }
  }

  // Icon not found in any version
  return {
    slug,
    svg: generatePlaceholderSvg(slug),
    version: 'placeholder',
    success: false,
    error: `Icon '${slug}' not found in any simple-icons version (searched v${majorVersions[0]} → v${majorVersions[majorVersions.length - 1]})`,
  };
}

/**
 * Generate a placeholder SVG for missing icons
 */
function generatePlaceholderSvg(slug: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#cccccc" role="img" aria-label="${slug} (not found)">
  <circle cx="12" cy="12" r="10" stroke="#999999" stroke-width="1" fill="none"/>
  <text x="12" y="16" text-anchor="middle" font-size="10" fill="#999999">?</text>
</svg>`;
}

// ============================================================================
// Concurrency Control
// ============================================================================

/**
 * Process items with limited concurrency
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const currentIndex = index++;
      const item = items[currentIndex];
      if (item !== undefined) {
        const result = await fn(item);
        results.push(result);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ============================================================================
// Data Loading
// ============================================================================

/**
 * Load icon requirements from YAML data file with Zod validation
 */
function loadIconRequirements(): IconRequirement[] {
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
  logger.info('Simple Icons Fetcher with Version Fallback');
  logger.info('='.repeat(50));

  const startTime = Date.now();

  // Ensure output directory exists
  mkdirSync(outputDirPath, { recursive: true });

  // Load requirements and existing manifest
  const requirements = loadIconRequirements();
  const existingManifest = loadManifest();

  // Get available versions
  const majorVersions = await getAvailableMajorVersions();
  const latestVersion = await getLatestVersion();

  logger.info('Fetching icons with version fallback...');

  // Track results
  const newManifest: IconManifest = {
    generatedAt: new Date().toISOString(),
    simpleIconsLatest: latestVersion,
    icons: {},
  };

  let fetched = 0;
  let cached = 0;
  let failed = 0;
  let fallback = 0;

  // Process icons with concurrency limit
  const results = await mapWithConcurrency(
    requirements,
    async (req): Promise<IconFetchResult> => {
      const existing = existingManifest?.icons[req.slug];

      // Check if we can use cached version
      if (existing && existing.color === normalizeColor(req.color)) {
        const iconPath = join(outputDirPath, `${req.slug}.svg`);
        if (existsSync(iconPath)) {
          // Reuse existing manifest entry
          newManifest.icons[req.slug] = existing;
          cached++;
          process.stdout.write('.');
          return {
            slug: req.slug,
            svg: '',
            version: existing.version,
            success: true,
          };
        }
      }

      // Fetch with version fallback
      const result = await fetchIconWithFallback(req.slug, req.color, majorVersions);

      if (result.success) {
        // Write SVG to disk
        const iconPath = join(outputDirPath, `${result.slug}.svg`);
        writeFileSync(iconPath, result.svg);

        // Add to manifest
        newManifest.icons[result.slug] = {
          version: result.version,
          color: normalizeColor(req.color),
          hash: hashContent(result.svg),
          fetchedAt: new Date().toISOString(),
        };

        const latestVersion = majorVersions[0] ?? 0;
        if (parseInt(result.version, 10) < latestVersion) {
          fallback++;
          process.stdout.write('v');
        } else {
          fetched++;
          process.stdout.write('+');
        }
      } else {
        // Write placeholder
        const iconPath = join(outputDirPath, `${result.slug}.svg`);
        writeFileSync(iconPath, result.svg);

        newManifest.icons[result.slug] = {
          version: 'placeholder',
          color: normalizeColor(req.color),
          hash: hashContent(result.svg),
          fetchedAt: new Date().toISOString(),
        };

        failed++;
        process.stdout.write('x');
      }

      return result;
    },
    sharedConfig.icons_concurrency_limit
  );

  process.stdout.write('\n');

  // Save manifest
  saveManifest(newManifest);

  // Report results
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  logger.info('='.repeat(50));
  logger.info({ fetched, fallback, cached, failed, elapsed: `${elapsed}s` }, 'Summary');
  logger.info({ output: outputDirPath, manifest: manifestFilePath }, 'Paths');

  // Report fallback details
  const latestMajor = majorVersions[0] ?? 0;
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
  if (failed > 0) {
    logger.warn('Build completed with warnings. Some icons could not be found.');
  }

  logger.info('Done!');
}

// Run
main().catch((error) => {
  logger.fatal({ error }, 'Fatal error');
  process.exit(1);
});
