/**
 * @fileoverview Main entrypoint for generation of README.md
 * 
 * This is the simplest entry point for the README generator.
 * It directly loads configuration and generates the README without CLI options.
 * 
 * USAGE: bun ./src/main.ts OR bun run build
 * 
 * PROCESS:
 * 1. Load configuration from src/config.yaml using node-yaml-config
 * 2. Create a SkillSet instance with the loaded configuration
 * 3. Execute renderReadme() which orchestrates the entire README generation:
 *    - Loads skill data from YAML (src/data/mystack.yml)
 *    - Renders HTML icons using Pug templates
 *    - Loads README template (src/templates/readme.tpl.md)
 *    - Replaces placeholder tags with generated HTML
 *    - Writes final README to output path (build/readme.md)
 * 
 * @author John Valai <git@jvk.to>
 */

// Import the YAML config loader from node-yaml-config package
// This provides a convenient way to load and parse YAML configuration files
import { load as configLoad } from 'node-yaml-config';

// Import the core SkillSet class that handles all README generation logic
import SkillSet from './lib/skillset.js';

// Import TypeScript type definition for type safety
import type { SkillSetConfig } from './types/index.js';

// STEP 1: Load configuration from config.yaml
// configLoad reads and parses the YAML file, returning a typed configuration object
// The generic type parameter <SkillSetConfig> ensures type safety
const config = configLoad<SkillSetConfig>('./src/config.yaml');

// STEP 2: Create a new SkillSet instance with the loaded configuration
// The SkillSet constructor validates required config fields and prepares internal state
const mySkills = new SkillSet(config);

// STEP 3: Generate the README
// renderReadme() is the main orchestration method that:
// - Loads YAML data
// - Renders HTML
// - Merges with template
// - Writes output file
// This is an async operation, so we await it
await mySkills.renderReadme();
