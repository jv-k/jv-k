/**
 * @fileoverview TypeScript type definitions for the README generator
 * @author John Valai <git@jvk.to>
 */

/**
 * Configuration for the SkillSet class
 */
export interface SkillSetConfig {
  /** Path to YAML data file containing skills */
  datafile: string;
  /** Path to section Pug template */
  tpl_section: string;
  /** Path to icon Pug template */
  tpl_icon: string;
  /** Start placeholder tag in README template */
  tag_start: string;
  /** End placeholder tag in README template */
  tag_end: string;
  /** Input README template path */
  file_input: string;
  /** Output README path */
  file_output: string;
}

/**
 * Individual skill/technology definition
 */
export interface Skill {
  /** Name of the skill/technology (used for icon lookup) */
  name: string;
  /** URL for the skill badge link */
  url: string;
  /** Hex color code for the badge (with or without #) */
  color: string;
}

/**
 * Skills data grouped by category
 */
export type SkillsData = Record<string, Skill[]>;

/**
 * Root structure of the skills YAML file
 */
export interface SkillsYamlRoot {
  Skillset: SkillsData;
}

/**
 * CLI options parsed by Commander
 */
export interface CliOptions {
  /** Path to config file */
  config: string;
  /** Config environment to use */
  env: string;
  /** Override output file path */
  output?: string;
  /** Suppress log output */
  silent: boolean;
  /** Enable verbose logging */
  verbose: boolean;
}

/**
 * Data passed to icon Pug template
 */
export interface IconTemplateData {
  /** Skill name */
  name: string;
  /** Skill URL */
  url: string;
  /** Skill color (without #) */
  color: string;
}

/**
 * Data passed to section Pug template
 */
export interface SectionTemplateData {
  /** Section/category name */
  name: string;
  /** HTML string of all icons in this section */
  icons: string;
}

/**
 * Options for SkillSet constructor
 */
export interface SkillSetOptions {
  /** Suppress log output */
  silent?: boolean;
}
