/**
 * @fileoverview Unit tests for fetch-icons utilities
 *
 * These tests validate the utility functions used by fetch-icons.ts
 * via the IconFetcherService. The service now exposes these functions
 * for testability.
 *
 * @author John Valai <git@jvk.to>
 */

import { describe, test, expect } from 'bun:test';
import { IconFetcherService } from '../src/lib/icon-fetcher.service.js';
import { createLogger } from '../src/lib/logger.js';
import type { SkillSetConfig } from '../src/schemas/index.js';
import yaml from 'js-yaml';
import fs from 'fs';

// ============================================================================
// Test Fixtures
// ============================================================================

// Load the actual config.yaml to ensure tests are based on real settings
const configPath = './src/config.yaml';
const config_content = fs.readFileSync(configPath, 'utf8');
const config = yaml.load(config_content) as { default: SkillSetConfig };

const logger = createLogger(true); // Silent logger
const service = new IconFetcherService({ config: config.default, logger });

// ============================================================================
// Tests
// ============================================================================

describe('hashContent', () => {
  test('should generate consistent hashes', () => {
    const content = '<svg>test</svg>';
    const hash1 = service.hashContent(content);
    const hash2 = service.hashContent(content);
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

  test('should have 16-character hex after prefix (true SHA-256 truncated)', () => {
    const hash = service.hashContent('test');
    const hexPart = hash.replace('sha256:', '');
    expect(hexPart).toHaveLength(16);
    expect(/^[0-9a-f]+$/.test(hexPart)).toBe(true);
  });
});

describe('normalizeColor', () => {
  test('should remove # prefix from 6-digit hex', () => {
    expect(service.normalizeColor('#FF5733')).toBe('FF5733');
  });

  test('should handle 6-digit hex without #', () => {
    expect(service.normalizeColor('FF5733')).toBe('FF5733');
  });

  test('should expand 3-digit hex to 6-digit', () => {
    expect(service.normalizeColor('#FFF')).toBe('FFFFFF');
    expect(service.normalizeColor('ABC')).toBe('AABBCC');
    expect(service.normalizeColor('#123')).toBe('112233');
  });

  test('should return black for invalid colors', () => {
    expect(service.normalizeColor('invalid')).toBe('000000');
    expect(service.normalizeColor('')).toBe('000000');
    expect(service.normalizeColor('#12345')).toBe('000000');
    expect(service.normalizeColor('GGGGGG')).toBe('000000');
  });

  test('should handle lowercase hex', () => {
    expect(service.normalizeColor('#aabbcc')).toBe('aabbcc');
    expect(service.normalizeColor('abc')).toBe('aabbcc');
  });
});

describe('applyColorToSvg', () => {
  test('should add fill attribute to svg without existing fill', () => {
    const svg = '<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>';
    const result = service.applyColorToSvg(svg, '#FF5733');
    expect(result).toContain('fill="#FF5733"');
    expect(result).toStartWith('<svg fill="#FF5733"');
  });

  test('should replace existing fill attribute', () => {
    const svg = '<svg fill="#000000" viewBox="0 0 24 24"><path d="M0 0"/></svg>';
    const result = service.applyColorToSvg(svg, '#FF5733');
    expect(result).toContain('fill="#FF5733"');
    expect(result).not.toContain('fill="#000000"');
  });

  test('should normalize color before applying', () => {
    const svg = '<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>';
    const result = service.applyColorToSvg(svg, '#FFF');
    expect(result).toContain('fill="#FFFFFF"');
  });

  test('should use black for invalid colors', () => {
    const svg = '<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>';
    const result = service.applyColorToSvg(svg, 'invalid');
    expect(result).toContain('fill="#000000"');
  });
});

describe('generatePlaceholderSvg', () => {
  test('should include slug in aria-label', () => {
    const svg = service.generatePlaceholderSvg('myicon');
    expect(svg).toContain('aria-label="myicon (not found)"');
  });

  test('should have placeholder styling', () => {
    const svg = service.generatePlaceholderSvg('test');
    expect(svg).toContain('fill="#cccccc"');
    expect(svg).toContain('stroke="#999999"');
  });

  test('should have question mark indicator', () => {
    const svg = service.generatePlaceholderSvg('test');
    expect(svg).toContain('>?</text>');
  });

  test('should be valid SVG structure', () => {
    const svg = service.generatePlaceholderSvg('test');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox="0 0 24 24"');
  });
});

describe('Icon manifest integration', () => {
  test('manifest entry should have required fields', () => {
    // Simulate what fetch-icons creates
    const entry = {
      version: '16',
      color: service.normalizeColor('#F7DF1E'),
      hash: service.hashContent('<svg>test</svg>'),
      fetchedAt: new Date().toISOString(),
    };

    expect(entry.version).toBeDefined();
    expect(entry.color).toMatch(/^[A-Fa-f0-9]{6}$/);
    expect(entry.hash).toStartWith('sha256:');
    expect(() => new Date(entry.fetchedAt)).not.toThrow();
  });
});
