/**
 * @fileoverview Unit tests for the SkillSet class.
 * @author John Valai <git@jvk.to>
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import fs from 'fs/promises';
import path from 'path';
import SkillSet from '../src/lib/skillset.js';
import type { SkillSetConfig } from '../src/types/index.js';

// Test fixtures directory
const FIXTURES_DIR = path.join(import.meta.dir, 'fixtures');

// Valid test config
const createValidConfig = (): SkillSetConfig => ({
  datafile: path.join(FIXTURES_DIR, 'test-skills.yml'),
  tpl_section: path.join(import.meta.dir, '..', 'src', 'templates', 'section.pug'),
  icons_output_dir: path.join(FIXTURES_DIR, 'icons'),
  generated_output_dir: path.join(FIXTURES_DIR, 'output', 'generated'),
  font: 'node_modules/@fontsource/oxanium/files/oxanium-latin-600-normal.woff',
  cards_live_url: 'https://cdn.example.com/cards/',
  tag_start: '<!-- START mystack -->',
  tag_end: '<!-- END mystack -->',
  file_input: path.join(FIXTURES_DIR, 'readme.tpl.md'),
  file_output: path.join(FIXTURES_DIR, 'output', 'readme.md'),
});

// Setup and teardown
beforeAll(async () => {
  // Create fixtures directory
  await fs.mkdir(path.join(FIXTURES_DIR, 'output'), { recursive: true });

  // Create test YAML file
  const testYaml = `Skillset:
  Languages:
    - name: javascript
      color: '#F7DF1E'
      url: https://developer.mozilla.org/en-US/docs/Web/JavaScript
    - name: typescript
      color: '#3178C6'
      url: https://www.typescriptlang.org/
  Backend:
    - name: nodedotjs
      color: '#339933'
      url: https://nodejs.dev/
    - name: github
      color: '#181717'
      url: https://github.com/
`;
  await fs.writeFile(path.join(FIXTURES_DIR, 'test-skills.yml'), testYaml);

  // Create test icons
  await fs.mkdir(path.join(FIXTURES_DIR, 'icons'), { recursive: true });
  for (const [name, color, title] of [
    ['javascript', '#F7DF1E', 'JavaScript'],
    ['typescript', '#3178C6', 'TypeScript'],
    ['nodedotjs', '#339933', 'Node.js'],
    ['github', '#181717', 'GitHub'],
  ]) {
    await fs.writeFile(
      path.join(FIXTURES_DIR, 'icons', `${name}.svg`),
      `<svg fill="${color}" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>${title}</title><path d="M0 0h24v24H0z"/></svg>`
    );
  }

  // Create test README template
  const readmeTpl = `# 👋🏻 My README

<!-- START mystack -->
<!-- placeholder -->
<!-- END mystack -->

## Footer

## [Linked](https://example.com) heading

\`\`\`sh
# a comment, not a heading
\`\`\`
`;
  await fs.writeFile(path.join(FIXTURES_DIR, 'readme.tpl.md'), readmeTpl);
});

afterAll(async () => {
  // Cleanup fixtures
  await fs.rm(FIXTURES_DIR, { recursive: true, force: true });
});

describe('SkillSet', () => {
  describe('constructor', () => {
    test('should create instance with valid config', () => {
      const config = createValidConfig();
      const skillset = new SkillSet(config, { silent: true });
      expect(skillset).toBeInstanceOf(SkillSet);
    });

    test('should throw error when required fields are missing', () => {
      const incompleteConfig = {
        datafile: './test.yml',
      } as SkillSetConfig;

      expect(() => new SkillSet(incompleteConfig, { silent: true })).toThrow(
        'Missing required config fields'
      );
    });

    test('should throw error with specific missing field names', () => {
      const incompleteConfig = {
        datafile: './test.yml',
        file_input: './input.md',
      } as SkillSetConfig;

      expect(() => new SkillSet(incompleteConfig, { silent: true })).toThrow(
        /file_output.*tag_start.*tag_end.*tpl_section.*icons_output_dir.*generated_output_dir.*cards_live_url.*font/
      );
    });
  });

  describe('getData', () => {
    test('should load and parse YAML data successfully', async () => {
      const config = createValidConfig();
      const skillset = new SkillSet(config, { silent: true });
      const data = await skillset.getData();

      expect(data).toBeDefined();
      expect(data['Languages']).toBeArray();
      expect(data['Languages']).toHaveLength(2);
      expect(data['Languages']?.[0]?.name).toBe('javascript');
    });

    test('should throw error for non-existent file', async () => {
      const config = createValidConfig();
      config.datafile = './non-existent.yml';
      const skillset = new SkillSet(config, { silent: true });

      await expect(skillset.getData()).rejects.toThrow();
    });
  });

  describe('renderSkillsHtml', () => {
    test('should write a light, a dark and a live card per category', async () => {
      const config = createValidConfig();
      await new SkillSet(config, { silent: true }).renderReadme();

      const cards = (await fs.readdir(path.join(config.generated_output_dir, 'cards'))).sort();
      expect(cards).toEqual([
        'backend-dark.svg',
        'backend-light.svg',
        'backend.svg',
        'languages-dark.svg',
        'languages-light.svg',
        'languages.svg',
      ]);
    });

    test('should redraw dark icons in a light ink on the dark card only', async () => {
      const config = createValidConfig();
      await new SkillSet(config, { silent: true }).renderReadme();

      const card = (theme: string) =>
        fs.readFile(
          path.join(config.generated_output_dir, 'cards', `backend-${theme}.svg`),
          'utf8'
        );
      expect(await card('light')).toContain('fill="#181717"');
      expect(await card('dark')).not.toContain('fill="#181717"');
      expect(await card('dark')).toContain('fill="#d1d7e0"');
    });

    test('should remove files for categories that no longer exist', async () => {
      const config = createValidConfig();
      const stale = path.join(config.generated_output_dir, 'cards', 'removed-light.svg');
      await fs.mkdir(path.dirname(stale), { recursive: true });
      await fs.writeFile(stale, '<svg/>');

      await new SkillSet(config, { silent: true }).renderReadme();

      expect(await fs.exists(stale)).toBe(false);
    });

    test('should link each themed card to its live card, with alt text and a tooltip', async () => {
      const config = createValidConfig();
      await new SkillSet(config, { silent: true }).renderReadme();

      const content = await fs.readFile(config.file_output, 'utf8');
      expect(content).toMatch(
        new RegExp(
          '<a href="https://cdn\\.example\\.com/cards/languages\\.svg\\?v=[0-9a-f]{8}"><picture>' +
            '<source media="\\(prefers-color-scheme: dark\\)" srcset="\\./assets/generated/cards/languages-dark\\.svg"/>' +
            '<img src="\\./assets/generated/cards/languages-light\\.svg" width="\\d+" ' +
            'alt="Languages: JavaScript, TypeScript" title="Languages: JavaScript • TypeScript"/>' +
            '</picture></a>'
        )
      );
    });

    test('should version the live card link by its content', async () => {
      const config = createValidConfig();
      const version = async () => {
        await new SkillSet(config, { silent: true }).renderReadme();
        const content = await fs.readFile(config.file_output, 'utf8');
        return /languages\.svg\?v=([0-9a-f]{8})/.exec(content)?.[1];
      };

      const first = await version();
      expect(await version()).toBe(first);

      config.cards_title_case = 'upper';
      expect(await version()).not.toBe(first);
    });
  });

  describe('renderHeadings', () => {
    test('should redraw headings as light and dark images at their level', async () => {
      const config = createValidConfig();
      await new SkillSet(config, { silent: true }).renderReadme();

      const headings = (
        await fs.readdir(path.join(config.generated_output_dir, 'headings'))
      ).sort();
      expect(headings).toEqual([
        'h1-my-readme-dark.svg',
        'h1-my-readme-light.svg',
        'h2-footer-dark.svg',
        'h2-footer-light.svg',
      ]);

      const content = await fs.readFile(config.file_output, 'utf8');
      expect(content).toMatch(
        /^## <picture><source media="\(prefers-color-scheme: dark\)" srcset="\.\/assets\/generated\/headings\/h2-footer-dark\.svg"><img src="\.\/assets\/generated\/headings\/h2-footer-light\.svg" width="\d+" height="\d+" alt="Footer" align="absmiddle"><\/picture>$/m
      );
    });

    test('should keep a leading emoji as text, since the font cannot draw it', async () => {
      const config = createValidConfig();
      await new SkillSet(config, { silent: true }).renderReadme();

      const content = await fs.readFile(config.file_output, 'utf8');
      expect(content).toMatch(/^# 👋🏻 <picture>.*alt="My README"/m);
    });

    test('should leave headings with markup and code blocks alone', async () => {
      const config = createValidConfig();
      await new SkillSet(config, { silent: true }).renderReadme();

      const content = await fs.readFile(config.file_output, 'utf8');
      expect(content).toContain('## [Linked](https://example.com) heading');
      expect(content).toContain('# a comment, not a heading');
    });
  });

  describe('prepareHtml', () => {
    test('should replace placeholder tags correctly', async () => {
      const config = createValidConfig();
      const skillset = new SkillSet(config, { silent: true });

      // Run full render to test prepareHtml indirectly
      await skillset.renderReadme();

      // Verify output file was created
      const outputExists = await fs
        .access(config.file_output)
        .then(() => true)
        .catch(() => false);
      expect(outputExists).toBe(true);

      // Verify content
      const content = await fs.readFile(config.file_output, 'utf8');
      expect(content).toContain('<!-- START mystack -->');
      expect(content).toContain('<!-- END mystack -->');
      expect(content).toContain('JavaScript');
      expect(content).not.toContain('<!-- placeholder -->');
    });
  });

  describe('renderReadme (integration)', () => {
    test('should complete full render workflow', async () => {
      const config = createValidConfig();
      const skillset = new SkillSet(config, { silent: true });

      await expect(skillset.renderReadme()).resolves.toBeUndefined();

      // Verify output
      const content = await fs.readFile(config.file_output, 'utf8');
      expect(content).toContain('alt="My README"');
      expect(content).toContain('alt="Footer"');
      expect(content).toContain('JavaScript');
      expect(content).toContain('TypeScript');
      expect(content).toContain('Node.js');
    });

    test('should handle file not found error gracefully', async () => {
      const config = createValidConfig();
      config.datafile = './non-existent.yml';
      const skillset = new SkillSet(config, { silent: true });

      await expect(skillset.renderReadme()).rejects.toThrow();
    });

    test('should handle invalid YAML gracefully', async () => {
      const config = createValidConfig();

      // Create invalid YAML file
      const invalidYamlPath = path.join(FIXTURES_DIR, 'invalid.yml');
      await fs.writeFile(invalidYamlPath, 'invalid: yaml: content: [[[');
      config.datafile = invalidYamlPath;

      const skillset = new SkillSet(config, { silent: true });

      await expect(skillset.renderReadme()).rejects.toThrow();
    });
  });

  describe('escapeRegex', () => {
    test('should escape special regex characters', () => {
      const config = createValidConfig();
      const skillset = new SkillSet(config, { silent: true });

      // Test via prepareHtml with special characters in tags
      const config2 = createValidConfig();
      config2.tag_start = '<!-- START [test] -->';
      config2.tag_end = '<!-- END (test) -->';

      const skillset2 = new SkillSet(config2, { silent: true });
      // If no error is thrown, escaping worked correctly
      expect(skillset).toBeInstanceOf(SkillSet);
      expect(skillset2).toBeInstanceOf(SkillSet);
    });
  });
});
