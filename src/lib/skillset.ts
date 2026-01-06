/**
 * @fileoverview Definition of the SkillSet class.
 * @author John Valai <git@jvk.to>
 */

import fs from 'fs/promises';
import yaml from 'js-yaml';
import pug from 'pug';
import { createLogger, type Logger } from './logger.js';

import type {
  SkillSetConfig,
  SkillsData,
  SkillsYamlRoot,
  SkillSetOptions,
  IconTemplateData,
  SectionTemplateData,
  Skill,
} from '../types/index.js';

/**
 * Generates a list of skillset icons and inserts them into a template to create a README.md file.
 */
class SkillSet {
  readonly #config: SkillSetConfig;
  #skillsHtml = '';
  #readmeMD = '';
  #readmeHTML = '';
  #skillsData: SkillsData = {};
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
      'tpl_icon',
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
   * Generates HTML for all skills icons using Pug templates.
   */
  renderSkillsHtml = (): string => {
    let html = '';
    const skillset = this.#skillsData;
    const topics = Object.keys(skillset);
    const tplSection = pug.compileFile(this.#config.tpl_section);
    const tplIcon = pug.compileFile(this.#config.tpl_icon);

    topics.forEach((topic) => {
      const skills = skillset[topic];
      if (!skills) return;

      let iconsHtml = '';

      skills.forEach((skill: Skill) => {
        const iconData: IconTemplateData = {
          name: skill.name,
          url: skill.url,
          color: skill.color.replace('#', ''),
        };
        iconsHtml += tplIcon(iconData);
      });

      const sectionData: SectionTemplateData = {
        name: topic,
        icons: iconsHtml,
      };
      html += tplSection(sectionData);
    });

    this.#logger.info('Rendered skillset html.');
    return html;
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
      `(${this.escapeRegex(this.#config.tag_start)})[\\s\\S]*?(${this.escapeRegex(this.#config.tag_end)})`,
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
      this.#skillsHtml = this.renderSkillsHtml();
      this.#readmeMD = await this.getReadmeFile();
      this.#readmeHTML = this.prepareHtml();
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
