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
  /** Directory holding the fetched icon SVGs */
  icons_output_dir: string;
  /** Directory the generated cards and page headings are written to */
  generated_output_dir: string;
  /** Font file (TTF, OTF or WOFF) for card titles and page headings */
  font: string;
  /** Public base URL of the generated cards, where each live card is opened from */
  cards_live_url: string;
  /** Card title size in px */
  cards_title_size?: number;
  /** Card title letter case */
  cards_title_case?: 'as-is' | 'upper' | 'lower';
  /** Page heading letter case */
  headings_case?: 'as-is' | 'upper' | 'lower';
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
  /** Build the README file */
  build?: boolean;
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
 * Data passed to section Pug template
 */
export interface SectionTemplateData {
  /** Section/category name */
  name: string;
  /** Card file name stem (cards are `<slug>-light.svg` and `<slug>-dark.svg`) */
  slug: string;
  /** README path of the cards directory, e.g. `./assets/generated/cards` */
  cardsBase: string;
  /** Card width in px (height follows the SVG's aspect ratio, so cards scale down evenly) */
  width: number;
  /** Alt text naming the category and its skills, comma-separated */
  alt: string;
  /** Hover tooltip naming the category and its skills, bullet-separated */
  tooltip: string;
  /** Where the card links: its live copy, with per-icon hover and links */
  liveUrl: string;
}

/**
 * Options for SkillSet constructor
 */
export interface SkillSetOptions {
  /** Suppress log output */
  silent?: boolean;
}

// ============================================================================
// Icon Fetcher Types
// ============================================================================

/**
 * Icon requirement from YAML data
 */
export interface IconRequirement {
  /** Icon slug (e.g., 'javascript', 'typescript') */
  slug: string;
  /** Hex color code */
  color: string;
}

/**
 * Entry in the icon manifest file
 */
export interface IconManifestEntry {
  /** simple-icons version the icon was fetched from */
  version: string;
  /** Hex color applied to the SVG */
  color: string;
  /** Hash of the SVG content */
  hash: string;
  /** ISO timestamp of when the icon was fetched */
  fetchedAt: string;
}

/**
 * Icon manifest structure (assets/icons/manifest.json)
 */
export interface IconManifest {
  /** ISO timestamp of when the manifest was generated */
  generatedAt: string;
  /** Latest simple-icons version at generation time */
  simpleIconsLatest: string;
  /** Map of icon slug to manifest entry */
  icons: Record<string, IconManifestEntry>;
}

/**
 * Result of fetching a single icon
 */
export interface IconFetchResult {
  /** Icon slug */
  slug: string;
  /** SVG content */
  svg: string;
  /** Version the icon was found in */
  version: string;
  /** Whether the fetch was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * simple-icons package version info from jsDelivr API
 */
export interface PackageVersionInfo {
  /** Array of available versions */
  versions: { version: string }[];
}
