/**
 * @fileoverview Renders the SVG images the README needs beyond the icons.
 *
 * GitHub strips `style` and `class` from README HTML, so blocks cannot be laid
 * out with CSS and a custom font can only appear as an image. Each skill
 * category is therefore drawn as an SVG card: images are inline, so the cards
 * flow side by side and wrap like flex-wrap. An SVG loaded through `<img>`
 * cannot fetch other files, follow links or react to hover, so icons are
 * inlined and text is drawn as font outlines; each card then links to a live
 * copy of itself, opened as a page, where every icon has a hover effect and a
 * link. Page headings are drawn the same way.
 *
 * @author John Valai <git@jvk.to>
 */

import type { Font, RenderOptions } from 'opentype.js';

export type CardTheme = 'light' | 'dark';

export type TitleCase = 'as-is' | 'upper' | 'lower';

/**
 * How a card title is set
 */
export interface TitleStyle {
  font: Font;
  /** Font size in px (default 13) */
  size?: number | undefined;
  /** Letter case (default 'as-is') */
  case?: TitleCase | undefined;
}

/**
 * An icon to draw on a card
 */
export interface CardIcon {
  /** Display name, e.g. 'Node.js' */
  name: string;
  /** Source SVG markup */
  svg: string;
  /** Link target on the live card */
  url: string;
}

/**
 * A rendered image
 */
export interface SvgImage {
  svg: string;
  width: number;
  height: number;
}

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * How a page heading is set; its size comes from its level
 */
export interface HeadingStyle {
  font: Font;
  /** Letter case (default 'as-is') */
  case?: TitleCase | undefined;
}

// ============================================================================
// Layout & palette
// ============================================================================

const ICON_SIZE = 28;
const ICON_GAP = 10;
const PADDING = 12;
/** Transparent space around the card, so adjacent cards don't touch */
const MARGIN = 3;
/** Every card has this many icon rows, so all cards share one height */
const ROWS = 2;
/** Space the title takes above the icons, per px of font size */
const TITLE_BLOCK_RATIO = 1.7;
const DEFAULT_TITLE_SIZE = 13;
const TITLE_OPTIONS: RenderOptions = { kerning: true, letterSpacing: 0.06 };
/** The live card opens as a page on its own, so it is drawn larger */
const LIVE_SCALE = 2;

/** GitHub's heading sizes in px (2em, 1.5em, 1.25em, 1em, .875em, .85em of 16px) */
const HEADING_SIZES: Record<HeadingLevel, number> = { 1: 32, 2: 24, 3: 20, 4: 16, 5: 14, 6: 13.6 };
const HEADING_OPTIONS: RenderOptions = { kerning: true, letterSpacing: 0.02 };

/**
 * GitHub Primer colours: page canvas, subtle canvas, default border, muted
 * foreground (card titles), default foreground (headings, live captions), and a
 * light ink for icons that would vanish on a dark card
 */
const PALETTE: Record<
  CardTheme,
  { page: string; bg: string; border: string; title: string; text: string; ink: string }
> = {
  light: {
    page: '#ffffff',
    bg: '#f6f8fa',
    border: '#d1d9e0',
    title: '#59636e',
    text: '#1f2328',
    ink: '#1f2328',
  },
  dark: {
    page: '#0d1117',
    bg: '#151b23',
    border: '#3d444d',
    title: '#9198a1',
    text: '#f0f6fc',
    ink: '#d1d7e0',
  },
};

/**
 * On dark cards, icons whose colour falls below this contrast are redrawn in `ink`.
 * Light cards keep the brand colours from the data file as they are.
 */
const MIN_CONTRAST = 1.7;

// ============================================================================
// Helpers
// ============================================================================

export const slugify = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const applyCase = (title: string, titleCase: TitleCase): string =>
  titleCase === 'upper' ? title.toUpperCase() : titleCase === 'lower' ? title.toLowerCase() : title;

const unescapeXml = (str: string): string =>
  str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&');

const escapeXml = (str: string): string =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Reads an icon's display name from its SVG `<title>`, e.g. 'Node.js' for nodedotjs.
 */
export const iconName = (svg: string, fallback: string): string => {
  const title = /<title>([^<]*)<\/title>/.exec(svg)?.[1]?.trim();
  return title ? unescapeXml(title) : fallback;
};

/** Alt text for a card: the category and its skills, comma-separated for screen readers */
export const cardLabel = (title: string, names: string[]): string =>
  `${title}: ${names.join(', ')}`;

/** Hover tooltip for a card: the category and its skills, bullet-separated */
export const cardTooltip = (title: string, names: string[]): string =>
  `${title}: ${names.join(' • ')}`;

const luminance = (hex: string): number => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const channel = (i: number): number => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
};

/** WCAG contrast ratio between two hex colours */
export const contrast = (a: string, b: string): number => {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const capHeight = (font: Font, size: number): number =>
  (((font.tables['os2']?.['sCapHeight'] as number | undefined) || font.ascender * 0.7) /
    font.unitsPerEm) *
  size;

// ============================================================================
// Icons
// ============================================================================

interface ParsedIcon {
  attrs: Record<string, string>;
  body: string;
  fill: string;
  /** Whether the icon vanishes on a dark card and needs the light ink there */
  needsInk: boolean;
}

const parseIcon = (source: string): ParsedIcon | null => {
  const match = /<svg\b([^>]*)>([\s\S]*)<\/svg>/.exec(source);
  if (!match) return null;

  const [, rootAttrs = '', inner = ''] = match;
  const attrs = Object.fromEntries(
    [...rootAttrs.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v])
  );
  const fill = attrs['fill'] ?? '#000';
  const needsInk =
    /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(fill) && contrast(fill, PALETTE.dark.bg) < MIN_CONTRAST;

  return { attrs, body: inner.replace(/<title>[\s\S]*?<\/title>/, ''), fill, needsInk };
};

const nestIcon = (icon: ParsedIcon, x: number, y: number, fill: string, extra = ''): string => {
  const kept = ['fill-rule', 'clip-rule']
    .filter((k) => icon.attrs[k])
    .map((k) => ` ${k}="${icon.attrs[k]}"`)
    .join('');
  return `<svg x="${x}" y="${y}" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="${
    icon.attrs['viewBox'] ?? '0 0 24 24'
  }" fill="${fill}"${kept}${extra}>${icon.body}</svg>`;
};

/**
 * Re-roots an icon's SVG as a nested `<svg>` at the given position, in the
 * light ink on a dark card when its own colour would vanish there.
 */
export const embedIcon = (source: string, x: number, y: number, theme: CardTheme): string => {
  const icon = parseIcon(source);
  if (!icon) return '';
  return nestIcon(icon, x, y, theme === 'dark' && icon.needsInk ? PALETTE.dark.ink : icon.fill);
};

// ============================================================================
// Cards
// ============================================================================

interface CardLayout {
  text: string;
  size: number;
  width: number;
  height: number;
  left: number;
  baseline: number;
  positions: { x: number; y: number }[];
}

const layoutCard = (title: string, count: number, style: TitleStyle): CardLayout => {
  const { font, size = DEFAULT_TITLE_SIZE } = style;
  const text = applyCase(title, style.case ?? 'as-is');
  const titleBlock = Math.round(size * TITLE_BLOCK_RATIO);

  const cols = Math.max(1, Math.ceil(count / ROWS));
  const iconsWidth = cols * ICON_SIZE + (cols - 1) * ICON_GAP;
  const titleWidth = Math.ceil(font.getAdvanceWidth(text, size, TITLE_OPTIONS));

  const left = MARGIN + PADDING;
  const top = MARGIN + PADDING + titleBlock;
  const positions = Array.from({ length: count }, (_, i) => ({
    x: left + (i % cols) * (ICON_SIZE + ICON_GAP),
    y: top + Math.floor(i / cols) * (ICON_SIZE + ICON_GAP),
  }));

  return {
    text,
    size,
    width: 2 * (MARGIN + PADDING) + Math.max(iconsWidth, titleWidth),
    height: 2 * (MARGIN + PADDING) + titleBlock + ROWS * ICON_SIZE + (ROWS - 1) * ICON_GAP,
    left,
    baseline: MARGIN + PADDING + capHeight(font, size),
    positions,
  };
};

const cardFrame = (width: number, height: number, attrs: string): string =>
  `<rect x="${MARGIN + 0.5}" y="${MARGIN + 0.5}" width="${width - 2 * MARGIN - 1}" height="${
    height - 2 * MARGIN - 1
  }" rx="6" ${attrs}/>`;

/**
 * Draws a titled card holding two rows of icons, for one theme.
 */
export const renderCard = (
  title: string,
  icons: CardIcon[],
  theme: CardTheme,
  style: TitleStyle
): SvgImage => {
  const layout = layoutCard(title, icons.length, style);
  const { width, height } = layout;
  const palette = PALETTE[theme];
  const names = icons.map((icon) => icon.name);
  const titlePath = style.font
    .getPath(layout.text, layout.left, layout.baseline, layout.size, TITLE_OPTIONS)
    .toPathData(2);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(cardLabel(title, names))}">` +
    `<title>${escapeXml(cardTooltip(title, names))}</title>` +
    cardFrame(width, height, `fill="${palette.bg}" stroke="${palette.border}"`) +
    `<path d="${titlePath}" fill="${palette.title}"/>` +
    icons
      .map((icon, i) => {
        const { x, y } = layout.positions[i] ?? { x: 0, y: 0 };
        return embedIcon(icon.svg, x, y, theme);
      })
      .join('') +
    '</svg>\n';

  return { svg, width, height };
};

const LIVE_STYLE = (() => {
  const colours = (theme: CardTheme): string => {
    const p = PALETTE[theme];
    return (
      `svg:root{background:${p.page}}.bg{fill:${p.bg};stroke:${p.border}}` +
      `.t{fill:${p.title}}.cap{fill:${p.text}}` +
      (theme === 'dark' ? `.ink{fill:${p.ink}}` : '')
    );
  };
  return (
    colours('light') +
    `@media (prefers-color-scheme:dark){${colours('dark')}}` +
    '.t,.cap{transition:opacity .15s ease}.cap{opacity:0;pointer-events:none}' +
    'svg:has(a:hover) .t{opacity:0}a:hover .cap{opacity:1}' +
    '.i{transition:transform .15s ease,opacity .15s ease;transform-box:fill-box;transform-origin:center}' +
    '.icons:has(a:hover) .i{opacity:.35}.icons a:hover .i{opacity:1;transform:scale(1.25)}'
  );
})();

/**
 * Draws the live card that the README card links to. Opened as a page, it
 * follows the viewer's colour scheme, and each icon links to its site; on
 * hover an icon grows, the others fade, and its name replaces the title.
 */
export const renderLiveCard = (title: string, icons: CardIcon[], style: TitleStyle): string => {
  const layout = layoutCard(title, icons.length, style);
  const { width, height, left, baseline, size } = layout;
  const names = icons.map((icon) => icon.name);
  const avail = width - 2 * left;
  const titlePath = style.font
    .getPath(layout.text, left, baseline, size, TITLE_OPTIONS)
    .toPathData(2);

  const links = icons
    .map((icon, i) => {
      const parsed = parseIcon(icon.svg);
      const { x, y } = layout.positions[i] ?? { x: 0, y: 0 };
      if (!parsed) return '';

      const caption = applyCase(icon.name, style.case ?? 'as-is');
      const fit = Math.min(
        size,
        (size * avail) / style.font.getAdvanceWidth(caption, size, TITLE_OPTIONS)
      );
      const captionPath = style.font
        .getPath(caption, left, baseline, fit, TITLE_OPTIONS)
        .toPathData(2);

      return (
        `<a href="${escapeXml(icon.url)}" target="_top"><title>${escapeXml(icon.name)}</title>` +
        `<path class="cap" d="${captionPath}"/>` +
        `<g class="i"><rect x="${x}" y="${y}" width="${ICON_SIZE}" height="${ICON_SIZE}" fill="transparent"/>` +
        nestIcon(parsed, x, y, parsed.fill, parsed.needsInk ? ' class="ink"' : '') +
        '</g></a>'
      );
    })
    .join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width * LIVE_SCALE}" height="${height * LIVE_SCALE}" viewBox="0 0 ${width} ${height}">` +
    `<title>${escapeXml(cardTooltip(title, names))}</title>` +
    `<style>${LIVE_STYLE}</style>` +
    cardFrame(width, height, 'class="bg"') +
    `<path class="t" d="${titlePath}"/>` +
    `<g class="icons">${links}</g>` +
    '</svg>\n'
  );
};

// ============================================================================
// Headings
// ============================================================================

/**
 * Draws a page heading at GitHub's size for its level, in the font's full
 * ascender-to-descender box so no letter is clipped.
 */
export const renderHeading = (
  text: string,
  level: HeadingLevel,
  theme: CardTheme,
  style: HeadingStyle
): SvgImage => {
  const { font } = style;
  const size = HEADING_SIZES[level];
  const ascent = (font.ascender / font.unitsPerEm) * size;
  const descent = (-font.descender / font.unitsPerEm) * size;
  const shown = applyCase(text, style.case ?? 'as-is');
  const width = Math.ceil(font.getAdvanceWidth(shown, size, HEADING_OPTIONS));
  const height = Math.ceil(ascent + descent);
  const path = font.getPath(shown, 0, ascent, size, HEADING_OPTIONS).toPathData(2);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(text)}">` +
    `<path d="${path}" fill="${PALETTE[theme].text}"/>` +
    '</svg>\n';

  return { svg, width, height };
};
