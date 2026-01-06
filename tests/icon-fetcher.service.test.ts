/**
 * @fileoverview Integration tests for IconFetcherService
 * @author John Valai <git@jvk.to>
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { IconFetcherService } from '../src/lib/icon-fetcher.service.js';
import { createLogger } from '../src/lib/logger.js';
import type { SkillSetConfig } from '../src/schemas/index.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const mockConfig: SkillSetConfig = {
  datafile: './src/data/mystack.yml',
  tpl_section: './src/templates/section.pug',
  tpl_icon: './src/templates/icon.pug',
  tag_start: '<!-- START -->',
  tag_end: '<!-- END -->',
  file_input: './input.md',
  file_output: './output.md',
  icons_output_dir: './assets/icons',
  icons_manifest_path: './assets/icons/manifest.json',
  icons_cdn_base_url: 'https://cdn.example.com/simple-icons',
  icons_package_api_url: 'https://api.example.com/packages/simple-icons',
  icons_fallback_cdn_url: 'https://fallback.example.com/simple-icons',
  icons_concurrency_limit: 5,
  icons_request_timeout: 100, // Short timeout for tests
  icons_max_retries: 1, // Minimal retries for tests
  icons_min_major_version: 1,
};

const mockSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 0L24 12 12 24 0 12z"/></svg>';

function createMockResponse(options: {
  ok?: boolean;
  status?: number;
  text?: string;
  json?: unknown;
  headers?: Record<string, string>;
}): Response {
  const { ok = true, status = 200, text = '', json, headers = {} } = options;

  return {
    ok,
    status,
    headers: new Headers(headers),
    text: async () => text,
    json: async () => json,
  } as Response;
}

// ============================================================================
// IconFetcherService Tests
// ============================================================================

describe('IconFetcherService', () => {
  const logger = createLogger(true); // Silent logger for tests
  let mockFetch: ReturnType<typeof mock>;
  let service: IconFetcherService;

  beforeEach(() => {
    mockFetch = mock(() => Promise.resolve(createMockResponse({ ok: true })));
    service = new IconFetcherService({
      config: mockConfig,
      logger,
      fetch: mockFetch as unknown as typeof globalThis.fetch,
    });
  });

  // ==========================================================================
  // Color Utilities
  // ==========================================================================

  describe('normalizeColor', () => {
    test('should remove # prefix from 6-digit hex', () => {
      expect(service.normalizeColor('#FF5733')).toBe('FF5733');
    });

    test('should handle 6-digit hex without #', () => {
      expect(service.normalizeColor('FF5733')).toBe('FF5733');
    });

    test('should expand 3-digit hex to 6-digit', () => {
      expect(service.normalizeColor('#F00')).toBe('FF0000');
      expect(service.normalizeColor('ABC')).toBe('AABBCC');
    });

    test('should return default black for invalid colors', () => {
      expect(service.normalizeColor('invalid')).toBe('000000');
      expect(service.normalizeColor('#GGG')).toBe('000000');
      expect(service.normalizeColor('')).toBe('000000');
    });
  });

  describe('applyColorToSvg', () => {
    test('should add fill attribute to SVG', () => {
      const result = service.applyColorToSvg(mockSvg, '#FF5733');
      expect(result).toContain('fill="#FF5733"');
    });

    test('should replace existing fill attribute', () => {
      const svgWithFill = '<svg fill="#000000" viewBox="0 0 24 24"><path/></svg>';
      const result = service.applyColorToSvg(svgWithFill, '#FF5733');
      expect(result).toContain('fill="#FF5733"');
      expect(result).not.toContain('fill="#000000"');
    });

    test('should normalize 3-digit colors', () => {
      const result = service.applyColorToSvg(mockSvg, '#F00');
      expect(result).toContain('fill="#FF0000"');
    });
  });

  describe('hashContent', () => {
    test('should generate consistent hashes', () => {
      const hash1 = service.hashContent(mockSvg);
      const hash2 = service.hashContent(mockSvg);
      expect(hash1).toBe(hash2);
    });

    test('should generate different hashes for different content', () => {
      const hash1 = service.hashContent('<svg>content1</svg>');
      const hash2 = service.hashContent('<svg>content2</svg>');
      expect(hash1).not.toBe(hash2);
    });

    test('should have sha256 prefix', () => {
      const hash = service.hashContent('test');
      expect(hash).toStartWith('sha256:');
    });

    test('should have 16-character hex after prefix', () => {
      const hash = service.hashContent('test');
      const hexPart = hash.replace('sha256:', '');
      expect(hexPart).toHaveLength(16);
      expect(/^[0-9a-f]+$/.test(hexPart)).toBe(true);
    });
  });

  // ==========================================================================
  // Placeholder SVG
  // ==========================================================================

  describe('generatePlaceholderSvg', () => {
    test('should include slug in aria-label', () => {
      const placeholder = service.generatePlaceholderSvg('missing-icon');
      expect(placeholder).toContain('aria-label="missing-icon (not found)"');
    });

    test('should be valid SVG structure', () => {
      const placeholder = service.generatePlaceholderSvg('test');
      expect(placeholder).toContain('<svg');
      expect(placeholder).toContain('</svg>');
      expect(placeholder).toContain('xmlns="http://www.w3.org/2000/svg"');
    });
  });

  // ==========================================================================
  // Version Discovery
  // ==========================================================================

  describe('getAvailableMajorVersions', () => {
    test('should parse versions from API response', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          createMockResponse({
            ok: true,
            json: {
              versions: [
                { version: '14.0.0' },
                { version: '13.5.0' },
                { version: '13.0.0' },
                { version: '12.0.0' },
              ],
            },
          })
        )
      );

      const versions = await service.getAvailableMajorVersions();

      expect(versions).toContain(14);
      expect(versions).toContain(13);
      expect(versions).toContain(12);
      // Should be sorted descending
      expect(versions[0]).toBe(14);
    });

    test('should deduplicate major versions', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          createMockResponse({
            ok: true,
            json: {
              versions: [{ version: '14.1.0' }, { version: '14.0.0' }, { version: '13.5.0' }],
            },
          })
        )
      );

      const versions = await service.getAvailableMajorVersions();

      const version14Count = versions.filter((v) => v === 14).length;
      expect(version14Count).toBe(1);
    });

    test('should return fallback versions on API error', async () => {
      mockFetch.mockImplementation(() => Promise.reject(new Error('Network error')));

      const versions = await service.getAvailableMajorVersions();

      expect(versions.length).toBeGreaterThan(0);
      expect(versions[0]).toBe(16); // Fallback starts at 16
    });
  });

  // ==========================================================================
  // Icon Fetching with Fallback
  // ==========================================================================

  describe('fetchIconWithFallback', () => {
    test('should return icon from first available version', async () => {
      mockFetch
        .mockImplementationOnce(
          () => Promise.resolve(createMockResponse({ ok: true })) // HEAD check v14
        )
        .mockImplementationOnce(
          () => Promise.resolve(createMockResponse({ ok: true, text: mockSvg })) // GET v14
        );

      const result = await service.fetchIconWithFallback('javascript', '#F7DF1E', [14, 13, 12]);

      expect(result.success).toBe(true);
      expect(result.version).toBe('14');
      expect(result.svg).toContain('fill="#F7DF1E"');
    });

    test('should fallback to older versions when not found in latest', async () => {
      mockFetch
        .mockImplementationOnce(
          () => Promise.resolve(createMockResponse({ ok: false, status: 404 })) // HEAD v14 - not found
        )
        .mockImplementationOnce(
          () => Promise.resolve(createMockResponse({ ok: true })) // HEAD v13 - exists
        )
        .mockImplementationOnce(
          () => Promise.resolve(createMockResponse({ ok: true, text: mockSvg })) // GET v13
        );

      const result = await service.fetchIconWithFallback('legacy-icon', '#FFFFFF', [14, 13, 12]);

      expect(result.success).toBe(true);
      expect(result.version).toBe('13');
    });

    test('should return placeholder when icon not found in any version', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(createMockResponse({ ok: false, status: 404 }))
      );

      const result = await service.fetchIconWithFallback('nonexistent', '#FFFFFF', [14, 13]);

      expect(result.success).toBe(false);
      expect(result.version).toBe('placeholder');
      expect(result.error).toContain('not found');
      expect(result.svg).toContain('aria-label="nonexistent (not found)"');
    });
  });

  // ==========================================================================
  // Batch Processing
  // ==========================================================================

  describe('fetchIcons', () => {
    test('should process multiple icons', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(createMockResponse({ ok: true, text: mockSvg }))
      );

      const requirements = [
        { slug: 'javascript', color: '#F7DF1E' },
        { slug: 'typescript', color: '#3178C6' },
      ];

      const results = await service.fetchIcons(requirements, [14, 13], undefined);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
    });

    test('should call progress callback for each icon', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(createMockResponse({ ok: true, text: mockSvg }))
      );

      const progressCalls: string[] = [];
      const onProgress = (result: { slug: string }) => {
        progressCalls.push(result.slug);
      };

      await service.fetchIcons(
        [
          { slug: 'icon1', color: '#FFF' },
          { slug: 'icon2', color: '#000' },
        ],
        [14],
        onProgress
      );

      expect(progressCalls).toContain('icon1');
      expect(progressCalls).toContain('icon2');
    });
  });
});
