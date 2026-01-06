#!/usr/bin/env bun
/**
 * @fileoverview CLI interface for README generator
 * @author John Valai <git@jvk.to>
 */

import { Command } from 'commander';
import { load as configLoad } from 'node-yaml-config';
import SkillSet from './lib/skillset.js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import type { SkillSetConfig, CliOptions } from './types/index.js';

interface PackageJson {
  version: string;
  name: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg: PackageJson = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf8')
) as PackageJson;

const program = new Command();

program
  .name('jv-k')
  .description('Generate a README.md with dynamic skillset icons')
  .version(pkg.version)
  .option('-b, --build', 'Build the README file')
  .option('-c, --config <path>', 'Path to config file', './src/config.yaml')
  .option('-e, --env <environment>', 'Config environment to use', 'default')
  .option('-o, --output <path>', 'Override output file path')
  .option('-s, --silent', 'Suppress log output', false)
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (options: CliOptions) => {
    // Show help if no build flag
    if (!options.build) {
      program.help();
      return;
    }

    try {
      // Load config
      const config = configLoad<SkillSetConfig>(options.config, options.env);

      // Override output path if specified
      if (options.output) {
        config.file_output = options.output;
      }

      // Create SkillSet instance and render
      const mySkills = new SkillSet(config, {
        silent: options.silent,
      });

      await mySkills.renderReadme();

      if (!options.silent) {
        console.log('✓ README generated successfully!');
      }

      process.exit(0);
    } catch (error) {
      if (!options.silent) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('✗ Error:', message);
      }
      process.exit(1);
    }
  });

program.parse();
