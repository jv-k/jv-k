/**
 * @fileoverview Unit tests for the card renderer.
 * @author John Valai <git@jvk.to>
 */

import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import opentype from 'opentype.js';
import {
  renderCard,
  renderLiveCard,
  renderHeading,
  embedIcon,
  slugify,
  contrast,
  iconName,
  cardTooltip,
} from '../src/lib/svg-assets.js';

const fontFile = readFileSync(
  'node_modules/@fontsource/oxanium/files/oxanium-latin-600-normal.woff'
);
const font = opentype.parse(
  fontFile.buffer.slice(fontFile.byteOffset, fontFile.byteOffset + fontFile.byteLength)
);
const style = { font };

const icon = (name: string, fill = '#3178C6', extra = '') =>
  `<svg fill="${fill}" role="img" viewBox="0 0 24 24"${extra} xmlns="http://www.w3.org/2000/svg"><title>${name}</title><path d="M0 0h24v24H0z"/></svg>`;

describe('slugify', () => {
  test('should turn category titles into file-safe stems', () => {
    expect(slugify('Languages')).toBe('languages');
    expect(slugify('JS/TS Tooling')).toBe('js-ts-tooling');
    expect(slugify('ML / Data Science')).toBe('ml-data-science');
  });
});

describe('iconName', () => {
  test('should read the display name from the SVG title', () => {
    expect(iconName(icon('Node.js'), 'nodedotjs')).toBe('Node.js');
    expect(iconName(icon('C&amp;C'), 'cc')).toBe('C&C');
  });

  test('should fall back when the SVG has no title', () => {
    expect(iconName('<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>', 'mcp')).toBe('mcp');
  });
});

describe('cardTooltip', () => {
  test('should separate the skills with bullets', () => {
    expect(cardTooltip('API', ['GraphQL', 'tRPC'])).toBe('API: GraphQL • tRPC');
  });
});

describe('contrast', () => {
  test('should return the WCAG contrast ratio', () => {
    expect(contrast('#000', '#fff')).toBeCloseTo(21, 0);
    expect(contrast('#333', '#333333')).toBeCloseTo(1, 5);
  });
});

const icons = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    name: `I${i}`,
    svg: icon(`I${i}`),
    url: `https://example.com/${i}`,
  }));

describe('embedIcon', () => {
  test('should re-root the icon at the given position without its title', () => {
    const out = embedIcon(icon('TypeScript'), 10, 20, 'light');
    expect(out).toStartWith(
      '<svg x="10" y="20" width="28" height="28" viewBox="0 0 24 24" fill="#3178C6">'
    );
    expect(out).toContain('<path d="M0 0h24v24H0z"/>');
    expect(out).not.toContain('<title>');
    expect(out).not.toContain('role=');
  });

  test('should keep fill-rule from the source root', () => {
    expect(embedIcon(icon('Codex', '#412991', ' fill-rule="evenodd"'), 0, 0, 'light')).toContain(
      'fill-rule="evenodd"'
    );
  });

  test('should redraw icons that vanish against the dark card, on dark only', () => {
    expect(embedIcon(icon('Bun', '#333'), 0, 0, 'dark')).toContain('fill="#d1d7e0"');
    expect(embedIcon(icon('Bun', '#333'), 0, 0, 'light')).toContain('fill="#333"');
    expect(embedIcon(icon('TS'), 0, 0, 'dark')).toContain('fill="#3178C6"');
    expect(embedIcon(icon('React', '#61DAFB'), 0, 0, 'light')).toContain('fill="#61DAFB"');
  });

  test('should return nothing for markup that is not an SVG', () => {
    expect(embedIcon('<p>nope</p>', 0, 0, 'light')).toBe('');
  });
});

describe('renderCard', () => {
  test('should give every card the same height', () => {
    const heights = [1, 2, 7, 20].map((n) => renderCard('Title', icons(n), 'light', style).height);
    expect(new Set(heights).size).toBe(1);
  });

  test('should lay icons out in two rows', () => {
    const { svg } = renderCard('Languages', icons(7), 'light', style);
    const ys = [...svg.matchAll(/<svg x="\d+" y="(\d+)"/g)].map((m) => m[1]);
    expect(new Set(ys).size).toBe(2);
    expect(ys.filter((y) => y === ys[0])).toHaveLength(4);
  });

  test('should widen with more icons, and fit long titles', () => {
    expect(renderCard('A', icons(20), 'light', style).width).toBeGreaterThan(
      renderCard('A', icons(4), 'light', style).width
    );
    expect(
      renderCard('A very long category title', icons(1), 'light', style).width
    ).toBeGreaterThan(renderCard('A', icons(1), 'light', style).width);
  });

  test('should draw the title as outlines, with a comma label and a bullet tooltip', () => {
    const { svg } = renderCard('R&D <lab>', icons(2), 'dark', style);
    expect(svg).not.toContain('<text');
    expect(svg).toMatch(/<path d="M[^"]+" fill="#9198a1"\/>/);
    expect(svg).toContain('aria-label="R&amp;D &lt;lab&gt;: I0, I1"');
    expect(svg).toContain('<title>R&amp;D &lt;lab&gt;: I0 • I1</title>');
  });

  test('should change the title case and size', () => {
    const asIs = renderCard('Languages', icons(1), 'light', style);
    expect(
      renderCard('Languages', icons(1), 'light', { font, case: 'upper' }).width
    ).toBeGreaterThan(asIs.width);
    const large = renderCard('Languages', icons(1), 'light', { font, size: 15 });
    expect(large.height).toBeGreaterThan(
      renderCard('Languages', icons(1), 'light', { font, size: 11 }).height
    );
  });

  test('should use the theme palette', () => {
    expect(renderCard('A', icons(1), 'light', style).svg).toContain('fill="#f6f8fa"');
    expect(renderCard('A', icons(1), 'dark', style).svg).toContain('fill="#151b23"');
  });
});

describe('renderLiveCard', () => {
  test('should link every icon to its site, with its name as the tooltip', () => {
    const svg = renderLiveCard('API', icons(2), style);
    expect(svg).toContain('<a href="https://example.com/0" target="_top"><title>I0</title>');
    expect(svg).toContain('<a href="https://example.com/1" target="_top"><title>I1</title>');
  });

  test('should follow the colour scheme of the viewer, and mark dark icons for the light ink', () => {
    const dark = [{ name: 'Bun', svg: icon('Bun', '#333'), url: 'https://bun.sh/' }];
    const svg = renderLiveCard('Backend', [...dark, ...icons(1)], style);
    expect(svg).toContain('@media (prefers-color-scheme:dark)');
    expect(svg).toContain('.ink{fill:#d1d7e0}');
    expect(svg.match(/ class="ink"/g)).toHaveLength(1);
  });

  test('should give each icon a hidden caption that replaces the title on hover', () => {
    const svg = renderLiveCard('API', icons(3), style);
    expect(svg.match(/<path class="cap" d="M/g)).toHaveLength(3);
    expect(svg).toContain('svg:has(a:hover) .t{opacity:0}a:hover .cap{opacity:1}');
  });

  test('should be drawn at twice the size of the README card', () => {
    const { width, height } = renderCard('API', icons(3), 'light', style);
    expect(renderLiveCard('API', icons(3), style)).toStartWith(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 2}" height="${height * 2}" viewBox="0 0 ${width} ${height}">`
    );
  });
});

describe('renderHeading', () => {
  test('should size the text like GitHub headings, largest at level 1', () => {
    const h1 = renderHeading('Interests', 1, 'light', { font });
    const h2 = renderHeading('Interests', 2, 'light', { font });
    const h6 = renderHeading('Interests', 6, 'light', { font });
    expect(h1.height).toBe(32);
    expect(h2.height).toBe(24);
    expect(h1.width).toBeGreaterThan(h2.width);
    expect(h2.width).toBeGreaterThan(h6.width);
  });

  test('should keep the text as written, labelled for screen readers', () => {
    const { svg } = renderHeading('Hi there!', 1, 'light', { font });
    expect(svg).toContain('aria-label="Hi there!"');
    expect(svg).not.toContain('<text');
  });

  test('should change the letter case but keep the label as written', () => {
    const upper = renderHeading('Hi there!', 1, 'light', { font, case: 'upper' });
    expect(upper.width).toBeGreaterThan(renderHeading('Hi there!', 1, 'light', { font }).width);
    expect(upper.width).toBe(renderHeading('HI THERE!', 1, 'light', { font }).width);
    expect(upper.svg).toContain('aria-label="Hi there!"');
  });

  test('should use the default foreground colour for the theme', () => {
    expect(renderHeading('A', 2, 'light', { font }).svg).toContain('fill="#1f2328"');
    expect(renderHeading('A', 2, 'dark', { font }).svg).toContain('fill="#f0f6fc"');
  });
});
