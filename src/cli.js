#!/usr/bin/env node
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

const program = new Command();

program
  .name('jv-k')
  .description('Generate a README.md with dynamic skillset icons')
  .version(pkg.version)
  .option('-c, --config <path>', 'Path to config file', './src/config.yaml')
  .option('-e, --env <environment>', 'Config environment to use', 'default')
  .option('-o, --output <path>', 'Override output file path')
  .option('-s, --silent', 'Suppress log output', false)
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (options) => {
    try {
      // Load config
      const config = configLoad(options.config, options.env);

      // Override output path if specified
      if (options.output) {
        config.file_output = options.output;
      }

      // Create SkillSet instance and render
      const mySkills = new SkillSet(config, {
        silent: options.silent
      });

      await mySkills.renderReadme();

      if (!options.silent) {
        console.log('✓ README generated successfully!');
      }

      process.exit(0);
    } catch (error) {
      if (!options.silent) {
        console.error('✗ Error:', error.message);
      }
      process.exit(1);
    }
  });

program.parse();
