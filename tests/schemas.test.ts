/**
 * @fileoverview Unit tests for Zod schemas
 * @author John Valai <git@jvk.to>
 */

import { describe, test, expect } from 'bun:test';
import {
  HexColorSchema,
  UrlSchema,
  IconSlugSchema,
  SkillSchema,
  SkillsDataSchema,
  SkillsYamlRootSchema,
  IconManifestEntrySchema,
  IconManifestSchema,
  SkillSetConfigSchema,
  validateSkillsYaml,
  safeValidateSkillsYaml,
  validateSkill,
  formatZodErrors,
  normalizeHexColor,
} from '../src/schemas/index.js';

describe('HexColorSchema', () => {
  test('should accept valid 6-digit hex with #', () => {
    expect(() => HexColorSchema.parse('#FF5733')).not.toThrow();
    expect(() => HexColorSchema.parse('#000000')).not.toThrow();
    expect(() => HexColorSchema.parse('#ffffff')).not.toThrow();
  });

  test('should accept valid 6-digit hex without #', () => {
    expect(() => HexColorSchema.parse('FF5733')).not.toThrow();
    expect(() => HexColorSchema.parse('aabbcc')).not.toThrow();
  });

  test('should accept valid 3-digit hex', () => {
    expect(() => HexColorSchema.parse('#FFF')).not.toThrow();
    expect(() => HexColorSchema.parse('#abc')).not.toThrow();
    expect(() => HexColorSchema.parse('123')).not.toThrow();
  });

  test('should reject invalid hex colors', () => {
    expect(() => HexColorSchema.parse('#GGGGGG')).toThrow();
    expect(() => HexColorSchema.parse('invalid')).toThrow();
    expect(() => HexColorSchema.parse('#12345')).toThrow();
    expect(() => HexColorSchema.parse('')).toThrow();
    expect(() => HexColorSchema.parse('#1234567')).toThrow();
  });
});

describe('normalizeHexColor', () => {
  test('should remove # prefix', () => {
    expect(normalizeHexColor('#FF5733')).toBe('FF5733');
  });

  test('should expand 3-digit hex to 6-digit', () => {
    expect(normalizeHexColor('#FFF')).toBe('FFFFFF');
    expect(normalizeHexColor('ABC')).toBe('AABBCC');
  });

  test('should leave 6-digit hex unchanged', () => {
    expect(normalizeHexColor('FF5733')).toBe('FF5733');
  });
});

describe('UrlSchema', () => {
  test('should accept valid URLs', () => {
    expect(() => UrlSchema.parse('https://example.com')).not.toThrow();
    expect(() => UrlSchema.parse('http://localhost:3000')).not.toThrow();
    expect(() => UrlSchema.parse('https://sub.domain.com/path?query=1')).not.toThrow();
  });

  test('should reject invalid URLs', () => {
    expect(() => UrlSchema.parse('not-a-url')).toThrow();
    expect(() => UrlSchema.parse('')).toThrow();
    expect(() => UrlSchema.parse('://missing-protocol')).toThrow();
  });
});

describe('IconSlugSchema', () => {
  test('should accept valid icon slugs', () => {
    expect(() => IconSlugSchema.parse('javascript')).not.toThrow();
    expect(() => IconSlugSchema.parse('typescript')).not.toThrow();
    expect(() => IconSlugSchema.parse('nodedotjs')).not.toThrow();
    expect(() => IconSlugSchema.parse('cplusplus')).not.toThrow();
    expect(() => IconSlugSchema.parse('react')).not.toThrow();
  });

  test('should reject invalid icon slugs', () => {
    expect(() => IconSlugSchema.parse('')).toThrow();
    expect(() => IconSlugSchema.parse('JavaScript')).toThrow(); // uppercase
    expect(() => IconSlugSchema.parse('node.js')).toThrow(); // literal dot
    expect(() => IconSlugSchema.parse('my-icon')).toThrow(); // hyphen
    expect(() => IconSlugSchema.parse('my_icon')).toThrow(); // underscore
  });
});

describe('SkillSchema', () => {
  test('should accept valid skill object', () => {
    const validSkill = {
      name: 'javascript',
      color: '#F7DF1E',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
    };
    expect(() => SkillSchema.parse(validSkill)).not.toThrow();
    expect(SkillSchema.parse(validSkill)).toEqual(validSkill);
  });

  test('should reject skill with invalid name', () => {
    const invalidSkill = {
      name: 'JavaScript', // uppercase
      color: '#F7DF1E',
      url: 'https://example.com',
    };
    expect(() => SkillSchema.parse(invalidSkill)).toThrow();
  });

  test('should reject skill with invalid color', () => {
    const invalidSkill = {
      name: 'javascript',
      color: 'not-a-color',
      url: 'https://example.com',
    };
    expect(() => SkillSchema.parse(invalidSkill)).toThrow();
  });

  test('should reject skill with missing fields', () => {
    expect(() => SkillSchema.parse({ name: 'javascript' })).toThrow();
    expect(() => SkillSchema.parse({})).toThrow();
  });
});

describe('SkillsDataSchema', () => {
  test('should accept valid skills data', () => {
    const validData = {
      Languages: [
        { name: 'javascript', color: '#F7DF1E', url: 'https://example.com' },
        { name: 'typescript', color: '#3178C6', url: 'https://example.com' },
      ],
      Backend: [{ name: 'nodedotjs', color: '#339933', url: 'https://example.com' }],
    };
    expect(() => SkillsDataSchema.parse(validData)).not.toThrow();
  });

  test('should reject empty categories', () => {
    const invalidData = {
      Languages: [],
    };
    expect(() => SkillsDataSchema.parse(invalidData)).toThrow();
  });

  test('should reject category with invalid skills', () => {
    const invalidData = {
      Languages: [{ name: 'INVALID', color: 'bad', url: 'not-url' }],
    };
    expect(() => SkillsDataSchema.parse(invalidData)).toThrow();
  });
});

describe('SkillsYamlRootSchema', () => {
  test('should accept valid YAML root structure', () => {
    const validRoot = {
      Skillset: {
        Languages: [{ name: 'javascript', color: '#F7DF1E', url: 'https://example.com' }],
      },
    };
    expect(() => SkillsYamlRootSchema.parse(validRoot)).not.toThrow();
  });

  test('should reject missing Skillset key', () => {
    expect(() => SkillsYamlRootSchema.parse({})).toThrow();
    expect(() => SkillsYamlRootSchema.parse({ skills: {} })).toThrow();
  });
});

describe('IconManifestEntrySchema', () => {
  test('should accept valid manifest entry', () => {
    const validEntry = {
      version: '16',
      color: 'F7DF1E',
      hash: 'sha256:abcd1234',
      fetchedAt: '2026-01-06T12:00:00.000Z',
    };
    expect(() => IconManifestEntrySchema.parse(validEntry)).not.toThrow();
  });

  test('should reject invalid color format', () => {
    const invalidEntry = {
      version: '16',
      color: '#F7DF1E', // should not have #
      hash: 'sha256:abcd1234',
      fetchedAt: '2026-01-06T12:00:00.000Z',
    };
    expect(() => IconManifestEntrySchema.parse(invalidEntry)).toThrow();
  });

  test('should reject invalid hash prefix', () => {
    const invalidEntry = {
      version: '16',
      color: 'F7DF1E',
      hash: 'md5:abcd1234',
      fetchedAt: '2026-01-06T12:00:00.000Z',
    };
    expect(() => IconManifestEntrySchema.parse(invalidEntry)).toThrow();
  });
});

describe('IconManifestSchema', () => {
  test('should accept valid manifest', () => {
    const validManifest = {
      generatedAt: '2026-01-06T12:00:00.000Z',
      simpleIconsLatest: '16.0.0',
      icons: {
        javascript: {
          version: '16',
          color: 'F7DF1E',
          hash: 'sha256:abcd1234',
          fetchedAt: '2026-01-06T12:00:00.000Z',
        },
      },
    };
    expect(() => IconManifestSchema.parse(validManifest)).not.toThrow();
  });

  test('should accept empty icons', () => {
    const emptyManifest = {
      generatedAt: '2026-01-06T12:00:00.000Z',
      simpleIconsLatest: 'unknown',
      icons: {},
    };
    expect(() => IconManifestSchema.parse(emptyManifest)).not.toThrow();
  });
});

describe('SkillSetConfigSchema', () => {
  const validConfig = {
    datafile: './src/data/mystack.yml',
    tpl_section: './src/templates/section.pug',
    tpl_icon: './src/templates/icon.pug',
    tag_start: '<!-- START -->',
    tag_end: '<!-- END -->',
    file_input: './input.md',
    file_output: './output.md',
    // Icon fetcher settings
    icons_output_dir: './assets/icons',
    icons_manifest_path: './assets/icons/manifest.json',
    icons_cdn_base_url: 'https://cdn.jsdelivr.net/npm/simple-icons',
    icons_package_api_url: 'https://data.jsdelivr.net/v1/packages/npm/simple-icons',
    icons_fallback_cdn_url: 'https://unpkg.com/simple-icons',
    icons_concurrency_limit: 10,
    icons_request_timeout: 10000,
    icons_max_retries: 3,
    icons_min_major_version: 1,
  };

  test('should accept valid config', () => {
    expect(() => SkillSetConfigSchema.parse(validConfig)).not.toThrow();
  });

  test('should reject empty strings', () => {
    const invalidConfig = {
      ...validConfig,
      datafile: '',
    };
    expect(() => SkillSetConfigSchema.parse(invalidConfig)).toThrow();
  });

  test('should reject invalid URL for CDN settings', () => {
    const invalidConfig = {
      ...validConfig,
      icons_cdn_base_url: 'not-a-url',
    };
    expect(() => SkillSetConfigSchema.parse(invalidConfig)).toThrow();
  });

  test('should reject non-positive concurrency limit', () => {
    const invalidConfig = {
      ...validConfig,
      icons_concurrency_limit: 0,
    };
    expect(() => SkillSetConfigSchema.parse(invalidConfig)).toThrow();
  });

  test('should reject negative retry count', () => {
    const invalidConfig = {
      ...validConfig,
      icons_max_retries: -1,
    };
    expect(() => SkillSetConfigSchema.parse(invalidConfig)).toThrow();
  });
});

describe('validateSkillsYaml', () => {
  test('should return typed data for valid input', () => {
    const input = {
      Skillset: {
        Languages: [{ name: 'javascript', color: '#F7DF1E', url: 'https://example.com' }],
      },
    };
    const result = validateSkillsYaml(input);
    expect(result.Skillset['Languages']?.[0]?.name).toBe('javascript');
  });

  test('should throw for invalid input', () => {
    expect(() => validateSkillsYaml({})).toThrow();
  });
});

describe('safeValidateSkillsYaml', () => {
  test('should return success for valid input', () => {
    const input = {
      Skillset: {
        Languages: [{ name: 'javascript', color: '#F7DF1E', url: 'https://example.com' }],
      },
    };
    const result = safeValidateSkillsYaml(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.Skillset['Languages']?.[0]?.name).toBe('javascript');
    }
  });

  test('should return error for invalid input', () => {
    const result = safeValidateSkillsYaml({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });
});

describe('validateSkill', () => {
  test('should return typed skill for valid input', () => {
    const skill = validateSkill({
      name: 'typescript',
      color: '#3178C6',
      url: 'https://www.typescriptlang.org/',
    });
    expect(skill.name).toBe('typescript');
    expect(skill.color).toBe('#3178C6');
  });
});

describe('formatZodErrors', () => {
  test('should format errors with paths', () => {
    const result = safeValidateSkillsYaml({
      Skillset: {
        Languages: [{ name: 'INVALID', color: 'bad', url: 'not-url' }],
      },
    });

    if (!result.success) {
      const messages = formatZodErrors(result.error);
      expect(messages.length).toBeGreaterThan(0);
      expect(
        messages.some((m) => m.includes('name') || m.includes('color') || m.includes('url'))
      ).toBe(true);
    }
  });

  test('should handle root-level errors', () => {
    const result = safeValidateSkillsYaml('not an object');
    if (!result.success) {
      const messages = formatZodErrors(result.error);
      expect(messages.length).toBeGreaterThan(0);
    }
  });
});
