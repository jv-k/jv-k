#!/usr/bin/env bun
/**
 * @fileoverview Icon fetcher service with version-fallback search
 *
 * Fetches icons from simple-icons, searching backwards through major versions
 * if an icon has been removed from newer releases. Designed for dependency
 * injection and testability.
 *
 * @author John Valai <git@jvk.to>
 */

import type { Logger } from 'pino';
import type {
  IconFetchResult,
  IconRequirement,
  SkillSetConfig,
  PackageVersionInfo,
} from '../schemas/index.js';

// ============================================================================
// Types
// ============================================================================

export interface IconFetcherDependencies {
  config: SkillSetConfig;
  logger: Logger;
  fetch?: typeof globalThis.fetch;
}

export interface FetchOptions {
  method?: string;
  retries?: number;
}

// ============================================================================
// IconFetcherService
// ============================================================================

/**
 * Service class for fetching icons with version fallback support.
 * Designed for dependency injection to enable testing.
 */
export class IconFetcherService {
  private readonly config: SkillSetConfig;
  private readonly logger: Logger;
  private readonly fetch: typeof globalThis.fetch;

  constructor(deps: IconFetcherDependencies) {
    this.config = deps.config;
    this.logger = deps.logger;
    this.fetch = deps.fetch ?? globalThis.fetch;
  }

  // ==========================================================================
  // Color Utilities
  // ==========================================================================

  /**
   * Normalize hex color (remove # prefix, validate format)
   */
  normalizeColor(color: string): string {
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

    this.logger.warn({ color }, 'Invalid hex color, using default black');
    return '000000';
  }

  /**
   * Apply fill color to SVG
   */
  applyColorToSvg(svg: string, hexColor: string): string {
    const normalizedHex = this.normalizeColor(hexColor);

    // Remove any existing fill attributes on the root svg element
    let modifiedSvg = svg.replace(/<svg([^>]*)\sfill="[^"]*"/, '<svg$1');

    // Add fill attribute to svg element
    modifiedSvg = modifiedSvg.replace('<svg', `<svg fill="#${normalizedHex}"`);

    return modifiedSvg;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Content hash for SVG integrity verification
   * Uses Bun's native crypto for actual SHA-256
   */
  hashContent(content: string): string {
    const hasher = new Bun.CryptoHasher('sha256');
    hasher.update(content);
    return `sha256:${hasher.digest('hex').slice(0, 16)}`;
  }

  /**
   * Fetch with timeout and retry logic
   */
  async fetchWithRetry(url: string, options: FetchOptions = {}): Promise<Response> {
    const { method = 'GET', retries = this.config.icons_max_retries } = options;

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.icons_request_timeout);

        const response = await this.fetch(url, {
          method,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 429) {
          // Rate limited - wait and retry
          const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
          this.logger.warn({ retryAfter }, 'Rate limited, waiting...');
          await this.sleep(retryAfter * 1000);
          continue;
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt === retries) {
          throw lastError;
        }
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        this.logger.warn({ attempt, delay }, 'Attempt failed, retrying...');
        await this.sleep(delay);
      }
    }

    // Explicit throw for exhausted retries (rate limiting scenario)
    throw lastError ?? new Error(`Failed after ${retries} attempts`);
  }

  // ==========================================================================
  // Version Discovery
  // ==========================================================================

  /**
   * Get available major versions from jsDelivr API
   */
  async getAvailableMajorVersions(): Promise<number[]> {
    this.logger.info('Fetching available simple-icons versions...');

    try {
      const response = await this.fetchWithRetry(this.config.icons_package_api_url);

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
          if (!isNaN(major) && major >= this.config.icons_min_major_version) {
            majorVersions.add(major);
          }
        }
      }

      // Sort descending (newest first)
      const sorted = Array.from(majorVersions).sort((a, b) => b - a);
      this.logger.info(
        { count: sorted.length, latest: sorted[0], oldest: sorted[sorted.length - 1] },
        'Found major versions'
      );

      return sorted;
    } catch (error) {
      this.logger.error({ error }, 'Failed to fetch version info');
      // Fallback to hardcoded range
      const fallback = Array.from({ length: 16 }, (_, i) => 16 - i);
      this.logger.info(
        { latest: fallback[0], oldest: fallback[fallback.length - 1] },
        'Using fallback versions'
      );
      return fallback;
    }
  }

  /**
   * Get the latest version string
   */
  async getLatestVersion(): Promise<string> {
    try {
      const response = await this.fetchWithRetry(this.config.icons_package_api_url);
      if (!response.ok) return 'unknown';

      const data = (await response.json()) as PackageVersionInfo;
      return data.versions[0]?.version || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  // ==========================================================================
  // Icon Fetching with Version Fallback
  // ==========================================================================

  /**
   * Check if icon exists at a specific version (using HEAD request)
   */
  async iconExistsAtVersion(slug: string, majorVersion: number): Promise<boolean> {
    const url = `${this.config.icons_cdn_base_url}@${majorVersion}/icons/${slug}.svg`;

    try {
      const response = await this.fetchWithRetry(url, { method: 'HEAD', retries: 1 });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetch SVG content from a specific version
   */
  async fetchSvgFromVersion(
    slug: string,
    majorVersion: number,
    useFallbackCdn = false
  ): Promise<string | null> {
    const baseUrl = useFallbackCdn
      ? this.config.icons_fallback_cdn_url
      : this.config.icons_cdn_base_url;
    const url = `${baseUrl}@${majorVersion}/icons/${slug}.svg`;

    try {
      const response = await this.fetchWithRetry(url);

      if (!response.ok) {
        return null;
      }

      return await response.text();
    } catch {
      if (!useFallbackCdn) {
        // Try fallback CDN
        return this.fetchSvgFromVersion(slug, majorVersion, true);
      }
      return null;
    }
  }

  /**
   * Fetch icon with version fallback search
   */
  async fetchIconWithFallback(
    slug: string,
    color: string,
    majorVersions: number[]
  ): Promise<IconFetchResult> {
    for (const version of majorVersions) {
      // Check existence with HEAD request first (faster)
      const exists = await this.iconExistsAtVersion(slug, version);

      if (exists) {
        // Fetch the actual SVG
        const svg = await this.fetchSvgFromVersion(slug, version);

        if (svg) {
          const coloredSvg = this.applyColorToSvg(svg, color);
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
      svg: this.generatePlaceholderSvg(slug),
      version: 'placeholder',
      success: false,
      error: `Icon '${slug}' not found in any simple-icons version (searched v${majorVersions[0]} → v${majorVersions[majorVersions.length - 1]})`,
    };
  }

  /**
   * Generate a placeholder SVG for missing icons
   */
  generatePlaceholderSvg(slug: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#cccccc" role="img" aria-label="${slug} (not found)">
  <circle cx="12" cy="12" r="10" stroke="#999999" stroke-width="1" fill="none"/>
  <text x="12" y="16" text-anchor="middle" font-size="10" fill="#999999">?</text>
</svg>`;
  }

  // ==========================================================================
  // Batch Processing
  // ==========================================================================

  /**
   * Process items with limited concurrency
   */
  async mapWithConcurrency<T, R>(
    items: T[],
    fn: (item: T) => Promise<R>,
    concurrency: number
  ): Promise<R[]> {
    const results: R[] = [];
    let index = 0;

    const worker = async (): Promise<void> => {
      while (index < items.length) {
        const currentIndex = index++;
        const item = items[currentIndex];
        if (item !== undefined) {
          const result = await fn(item);
          results.push(result);
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
    await Promise.all(workers);
    return results;
  }

  /**
   * Fetch multiple icons with concurrency control
   */
  async fetchIcons(
    requirements: IconRequirement[],
    majorVersions: number[],
    onProgress?: (result: IconFetchResult) => void
  ): Promise<IconFetchResult[]> {
    return this.mapWithConcurrency(
      requirements,
      async (req): Promise<IconFetchResult> => {
        const result = await this.fetchIconWithFallback(req.slug, req.color, majorVersions);
        onProgress?.(result);
        return result;
      },
      this.config.icons_concurrency_limit
    );
  }
}
