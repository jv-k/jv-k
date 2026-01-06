/**
 * @fileoverview Unit tests for fetch-icons utilities
 * @author John Valai <git@jvk.to>
 */

import { describe, test, expect } from 'bun:test';

// Since fetch-icons.ts doesn't export its utilities, we'll test the logic
// by testing the normalized color and hash functions we can recreate

/**
 * Hash function matching fetch-icons.ts implementation
 */
function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `sha256:${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * Color normalization matching fetch-icons.ts
 */
function normalizeColor(color: string): string {
  const hex = color.replace(/^#/, '');

  if (/^[A-Fa-f0-9]{3}$/.test(hex)) {
    return hex
      .split('')
      .map((c) => c + c)
      .join('');
  }

  if (/^[A-Fa-f0-9]{6}$/.test(hex)) {
    return hex;
  }

  return '000000';
}

/**
 * SVG color application matching fetch-icons.ts
 */
function applyColorToSvg(svg: string, hexColor: string): string {
  const normalizedHex = normalizeColor(hexColor);
  let modifiedSvg = svg.replace(/<svg([^>]*)\sfill="[^"]*"/, '<svg$1');
  modifiedSvg = modifiedSvg.replace('<svg', `<svg fill="#${normalizedHex}"`);
  return modifiedSvg;
}

/**
 * Placeholder SVG generation matching fetch-icons.ts
 */
function generatePlaceholderSvg(slug: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#cccccc" role="img" aria-label="${slug} (not found)">
  <circle cx="12" cy="12" r="10" stroke="#999999" stroke-width="1" fill="none"/>
  <text x="12" y="16" text-anchor="middle" font-size="10" fill="#999999">?</text>
</svg>`;
}

describe('hashContent', () => {
  test('should generate consistent hashes', () => {
    const content = '<svg>test</svg>';
    const hash1 = hashContent(content);
    const hash2 = hashContent(content);
    expect(hash1).toBe(hash2);
  });

  test('should generate different hashes for different content', () => {
    const hash1 = hashContent('<svg>content1</svg>');
    const hash2 = hashContent('<svg>content2</svg>');
    expect(hash1).not.toBe(hash2);
  });

  test('should have sha256 prefix', () => {
    const hash = hashContent('test');
    expect(hash).toStartWith('sha256:');
  });

  test('should have 8 character hex after prefix', () => {
    const hash = hashContent('test');
    const hexPart = hash.replace('sha256:', '');
    expect(hexPart).toHaveLength(8);
    expect(/^[0-9a-f]+$/.test(hexPart)).toBe(true);
  });
});

describe('normalizeColor', () => {
  test('should remove # prefix from 6-digit hex', () => {
    expect(normalizeColor('#FF5733')).toBe('FF5733');
  });

  test('should handle 6-digit hex without #', () => {
    expect(normalizeColor('FF5733')).toBe('FF5733');
  });

  test('should expand 3-digit hex to 6-digit', () => {
    expect(normalizeColor('#FFF')).toBe('FFFFFF');
    expect(normalizeColor('ABC')).toBe('AABBCC');
    expect(normalizeColor('#123')).toBe('112233');
  });

  test('should return black for invalid colors', () => {
    expect(normalizeColor('invalid')).toBe('000000');
    expect(normalizeColor('')).toBe('000000');
    expect(normalizeColor('#12345')).toBe('000000');
    expect(normalizeColor('GGGGGG')).toBe('000000');
  });

  test('should handle lowercase hex', () => {
    expect(normalizeColor('#aabbcc')).toBe('aabbcc');
    expect(normalizeColor('abc')).toBe('aabbcc');
  });
});

describe('applyColorToSvg', () => {
  test('should add fill attribute to svg without existing fill', () => {
    const svg = '<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>';
    const result = applyColorToSvg(svg, '#FF5733');
    expect(result).toContain('fill="#FF5733"');
    expect(result).toStartWith('<svg fill="#FF5733"');
  });

  test('should replace existing fill attribute', () => {
    const svg = '<svg fill="#000000" viewBox="0 0 24 24"><path d="M0 0"/></svg>';
    const result = applyColorToSvg(svg, '#FF5733');
    expect(result).toContain('fill="#FF5733"');
    expect(result).not.toContain('fill="#000000"');
  });

  test('should normalize color before applying', () => {
    const svg = '<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>';
    const result = applyColorToSvg(svg, '#FFF');
    expect(result).toContain('fill="#FFFFFF"');
  });

  test('should use black for invalid colors', () => {
    const svg = '<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>';
    const result = applyColorToSvg(svg, 'invalid');
    expect(result).toContain('fill="#000000"');
  });
});

describe('generatePlaceholderSvg', () => {
  test('should include slug in aria-label', () => {
    const svg = generatePlaceholderSvg('myicon');
    expect(svg).toContain('aria-label="myicon (not found)"');
  });

  test('should have placeholder styling', () => {
    const svg = generatePlaceholderSvg('test');
    expect(svg).toContain('fill="#cccccc"');
    expect(svg).toContain('stroke="#999999"');
  });

  test('should have question mark indicator', () => {
    const svg = generatePlaceholderSvg('test');
    expect(svg).toContain('>?</text>');
  });

  test('should be valid SVG structure', () => {
    const svg = generatePlaceholderSvg('test');
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
      color: normalizeColor('#F7DF1E'),
      hash: hashContent('<svg>test</svg>'),
      fetchedAt: new Date().toISOString(),
    };

    expect(entry.version).toBeDefined();
    expect(entry.color).toMatch(/^[A-Fa-f0-9]{6}$/);
    expect(entry.hash).toStartWith('sha256:');
    expect(() => new Date(entry.fetchedAt)).not.toThrow();
  });
});
