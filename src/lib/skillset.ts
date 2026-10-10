/**
 * @fileoverview Definition of the SkillSet class.
 * @author John Valai <git@jvk.to>
 */

import { createHash } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import pug from 'pug';
import opentype, { type Font } from 'opentype.js';
import { createLogger, type Logger } from './logger.js';
import {
  renderCard,
  renderLiveCard,
  renderHeading,
  slugify,
  iconName,
  cardLabel,
  cardTooltip,
  type CardIcon,
  type CardTheme,
  type HeadingLevel,
} from './svg-assets.js';

import type {
  SkillSetConfig,
  SkillsData,
  SkillsYamlRoot,
  SkillSetOptions,
  SectionTemplateData,
} from '../types/index.js';

const THEMES: CardTheme[] = ['light', 'dark'];

/** An ATX heading line: hashes, then the text (with any closing hashes dropped) */
const HEADING_LINE = /^(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/;
/** Leading emoji (and their modifiers and joiners), which the font cannot draw */
const EMOJI_PREFIX = /^((?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\u200d|\ufe0f|\s)*)(.*)$/u;
/** Headings holding markup are left as text, since outlines would show the raw syntax */
const MARKUP = /[<>[\]`*_\\]/;

/**
 * Draws each skillset category as an SVG card and inserts them into a template to create a README.md file.
 */
class SkillSet {
  readonly #config: SkillSetConfig;
  #skillsHtml = '';
  #readmeMD = '';
  #readmeHTML = '';
  #skillsData: SkillsData = {};
  #font: Font | undefined;
  readonly #logger: Logger;

  /**
   * Creates a new SkillSet instance.
   * @throws Error if required config fields are missing
   */
  constructor(config: SkillSetConfig, options: SkillSetOptions = {}) {
    // Validate required config fields
    const requiredFields: (keyof SkillSetConfig)[] = [
      'datafile',
      'file_input',
      'file_output',
      'tag_start',
      'tag_end',
      'tpl_section',
      'icons_output_dir',
      'generated_output_dir',
      'cards_live_url',
      'font',
    ];
    const missing = requiredFields.filter((field) => !config[field]);

    if (missing.length > 0) {
      throw new Error(`Missing required config fields: ${missing.join(', ')}`);
    }

    this.#config = { ...config };
    this.#logger = createLogger(options.silent);
  }

  /**
   * Escapes special regex characters in a string.
   */
  escapeRegex = (str: string): string => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  /**
   * Retrieves the skills icon data from a yaml data file.
   */
  getData = async (): Promise<SkillsData> => {
    const fileContent = await fs.readFile(this.#config.datafile, 'utf8');
    this.#logger.info(`Loaded yaml skillset data from <${this.#config.datafile}>`);
    const parsed = yaml.load(fileContent) as SkillsYamlRoot;
    return parsed.Skillset;
  };

  /**
   * Loads the font for card titles and page headings, once.
   */
  getFont = async (): Promise<Font> => {
    if (!this.#font) {
      const file = await fs.readFile(this.#config.font);
      this.#font = opentype.parse(
        file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)
      );
    }
    return this.#font;
  };

  /**
   * Empties the generated images directory, so files for removed categories,
   * skills and headings do not linger.
   */
  resetGeneratedDir = async (): Promise<void> => {
    await fs.rm(this.#config.generated_output_dir, { recursive: true, force: true });
  };

  /**
   * Writes a light and a dark card per category, plus the live card each one
   * links to, and returns the HTML that embeds them.
   */
  renderSkillsHtml = async (): Promise<string> => {
    let html = '';
    const skillset = this.#skillsData;
    const topics = Object.keys(skillset);
    const tplSection = pug.compileFile(this.#config.tpl_section);
    const cardsDir = path.join(this.#config.generated_output_dir, 'cards');
    const style = {
      font: await this.getFont(),
      size: this.#config.cards_title_size,
      case: this.#config.cards_title_case,
    };

    await fs.mkdir(cardsDir, { recursive: true });

    for (const topic of topics) {
      const skills = skillset[topic];
      if (!skills) continue;

      const icons: CardIcon[] = await Promise.all(
        skills.map(async (skill) => {
          const svg = await fs.readFile(
            path.join(this.#config.icons_output_dir, `${skill.name}.svg`),
            'utf8'
          );
          return { name: iconName(svg, skill.name), svg, url: skill.url };
        })
      );
      const names = icons.map((icon) => icon.name);
      const slug = slugify(topic);
      let width = 0;

      for (const theme of THEMES) {
        const card = renderCard(topic, icons, theme, style);
        await fs.writeFile(path.join(cardsDir, `${slug}-${theme}.svg`), card.svg);
        width = card.width;
      }

      // The live card is served from a CDN that browsers cache for days, so its
      // URL carries a content hash: a changed card gets a new URL
      const live = renderLiveCard(topic, icons, style);
      await fs.writeFile(path.join(cardsDir, `${slug}.svg`), live);
      const version = createHash('sha256').update(live).digest('hex').slice(0, 8);

      const sectionData: SectionTemplateData = {
        name: topic,
        slug,
        width,
        alt: cardLabel(topic, names),
        tooltip: cardTooltip(topic, names),
        liveUrl: `${this.#config.cards_live_url}${slug}.svg?v=${version}`,
      };
      html += tplSection(sectionData);
    }

    this.#logger.info(`Rendered ${topics.length} skillset cards to <${cardsDir}>.`);
    return html;
  };

  /**
   * Redraws the markdown headings in the README font: each heading keeps its
   * level and any leading emoji, and its text becomes a light/dark image.
   */
  renderHeadings = async (markdown: string): Promise<string> => {
    const font = await this.getFont();
    const headingsDir = path.join(this.#config.generated_output_dir, 'headings');
    await fs.mkdir(headingsDir, { recursive: true });

    let inFence = false;
    const lines: string[] = [];

    for (const line of markdown.split('\n')) {
      if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
      const heading = inFence ? null : HEADING_LINE.exec(line);
      const [, hashes = '', content = ''] = heading ?? [];
      const [, emoji = '', text = ''] = EMOJI_PREFIX.exec(content) ?? [];

      if (!heading || !text || MARKUP.test(text)) {
        lines.push(line);
        continue;
      }

      const level = hashes.length as HeadingLevel;
      const slug = `h${level}-${slugify(text)}`;
      let size = { width: 0, height: 0 };

      for (const theme of THEMES) {
        const image = renderHeading(text, level, theme, {
          font,
          case: this.#config.headings_case,
        });
        await fs.writeFile(path.join(headingsDir, `${slug}-${theme}.svg`), image.svg);
        size = { width: image.width, height: image.height };
      }

      const src = `./assets/generated/headings/${slug}`;
      lines.push(
        `${hashes} ${emoji}<picture>` +
          `<source media="(prefers-color-scheme: dark)" srcset="${src}-dark.svg">` +
          `<img src="${src}-light.svg" width="${size.width}" height="${size.height}" alt="${text.replace(/"/g, '&quot;')}" align="absmiddle">` +
          '</picture>'
      );
    }

    return lines.join('\n');
  };

  /**
   * Reads the markdown README template file.
   */
  getReadmeFile = async (): Promise<string> => {
    const data = await fs.readFile(this.#config.file_input, 'utf8');
    this.#logger.info(`Loaded file: <${this.#config.file_input}>`);
    return data;
  };

  /**
   * Replaces the placeholder tags in the README with skill icons HTML.
   */
  prepareHtml = (): string => {
    const re = new RegExp(
      `(${this.escapeRegex(this.#config.tag_start)})[\\s\\S]*?(${this.escapeRegex(
        this.#config.tag_end
      )})`,
      'g'
    );

    return this.#readmeMD.replace(re, `$1\n${this.#skillsHtml}\n$2`);
  };

  /**
   * Writes the generated README to the output file.
   */
  writeReadmeFile = async (): Promise<void> => {
    await fs.writeFile(this.#config.file_output, this.#readmeHTML);
    this.#logger.info(`Wrote output to file: <${this.#config.file_output}>`);
  };

  /**
   * Public entry point that generates the README.
   */
  renderReadme = async (): Promise<void> => {
    try {
      this.#skillsData = await this.getData();
      await this.resetGeneratedDir();
      this.#skillsHtml = await this.renderSkillsHtml();
      this.#readmeMD = await this.getReadmeFile();
      this.#readmeHTML = await this.renderHeadings(this.prepareHtml());
      await this.writeReadmeFile();
    } catch (error) {
      if (error instanceof Error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code === 'ENOENT') {
          this.#logger.error(`File not found: ${nodeError.path}`);
        } else if (error instanceof yaml.YAMLException) {
          this.#logger.error(`YAML parsing error: ${error.message}`);
        } else {
          this.#logger.error(`Error: ${error.message}`);
        }
      }
      throw error;
    }
  };
}

export default SkillSet;
