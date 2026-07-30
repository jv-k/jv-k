#!/usr/bin/env bun
/**
 * @fileoverview CLI interface for README generator
 * 
 * This file provides a command-line interface using Commander.js for the README generator.
 * It allows users to customize behavior through various CLI options.
 * 
 * USAGE: bun ./src/cli.ts --build [options]
 * 
 * CLI OPTIONS:
 * -b, --build              Required flag to trigger README generation
 * -c, --config <path>      Custom path to config YAML file (default: ./src/config.yaml)
 * -e, --env <environment>  Config environment to use (default: 'default')
 * -o, --output <path>      Override output file path
 * -s, --silent             Suppress all log output
 * -v, --verbose            Enable verbose logging (for debugging)
 * 
 * EXAMPLES:
 * bun run start --build                    # Basic usage
 * bun run start --build --silent           # Silent mode (no logs)
 * bun run start --build --output ./out.md  # Custom output path
 * 
 * @author John Valai <git@jvk.to>
 */

// Import Commander.js - popular CLI framework for Node.js/Bun
// Provides easy parsing of command-line arguments and automatic help generation
import { Command } from 'commander';

// Import YAML config loader
import { load as configLoad } from 'node-yaml-config';

// Import core SkillSet class
import SkillSet from './lib/skillset.js';

// Import Node.js built-in modules for file system operations
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Import TypeScript types for type safety
import type { SkillSetConfig, CliOptions } from './types/index.js';

// Interface for package.json structure
// We read package.json to get the version number for --version flag
interface PackageJson {
  version: string;
  name: string;
}

// Get current directory path (ES modules don't have __dirname by default)
// fileURLToPath converts file:// URL to filesystem path
// dirname gets the directory containing this file
const __dirname = dirname(fileURLToPath(import.meta.url));

// Read and parse package.json to get version information
// This allows us to show the correct version with --version flag
const pkg: PackageJson = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf8')
) as PackageJson;

// Create a new Commander program instance
const program = new Command();

// Configure the CLI program with metadata and options
program
  .name('jv-k')  // Program name shown in help
  .description('Generate a README.md with dynamic skillset icons')  // Description for help
  .version(pkg.version)  // Version from package.json (shown with --version)
  
  // Define CLI options with flags, descriptions, and defaults
  .option('-b, --build', 'Build the README file')  // Required flag to trigger generation
  .option('-c, --config <path>', 'Path to config file', './src/config.yaml')  // Custom config path
  .option('-e, --env <environment>', 'Config environment to use', 'default')  // Environment section in config
  .option('-o, --output <path>', 'Override output file path')  // Custom output location
  .option('-s, --silent', 'Suppress log output', false)  // Silent mode
  .option('-v, --verbose', 'Enable verbose logging', false)  // Verbose mode
  
  // Define the action to execute when command is run
  // This async function receives the parsed CLI options as a parameter
  .action(async (options: CliOptions) => {
    // Validate that --build flag was provided
    // If not provided, show help message and exit
    // This ensures users know they need to specify --build
    if (!options.build) {
      program.help();  // Display help text automatically
      return;
    }

    try {
      // STEP 1: Load configuration from YAML file
      // configLoad takes two parameters:
      // - Path to config file (customizable via --config option)
      // - Environment name (customizable via --env option, default: 'default')
      // This allows having different configs for dev/staging/prod environments
      const config = configLoad<SkillSetConfig>(options.config, options.env);

      // STEP 2: Override output path if user specified --output option
      // This allows generating README to a custom location without editing config.yaml
      if (options.output) {
        config.file_output = options.output;
      }

      // STEP 3: Create SkillSet instance with configuration and options
      // The silent option is passed to suppress log output if --silent flag was used
      const mySkills = new SkillSet(config, {
        silent: options.silent,
      });

      // STEP 4: Execute the README generation
      // This orchestrates the entire process:
      // - Load YAML data
      // - Render HTML
      // - Merge with template
      // - Write output file
      await mySkills.renderReadme();

      // STEP 5: Show success message (unless in silent mode)
      if (!options.silent) {
        console.log('✓ README generated successfully!');
      }

      // Exit with success code (0 = success)
      process.exit(0);
    } catch (error) {
      // STEP 6: Error handling
      // If any step fails, catch the error and display it (unless silent)
      if (!options.silent) {
        // Extract error message safely (handles both Error objects and other types)
        const message = error instanceof Error ? error.message : String(error);
        console.error('✗ Error:', message);
      }
      
      // Exit with error code (1 = failure)
      // Non-zero exit codes indicate failure to the shell/CI system
      process.exit(1);
    }
  });

// Parse command-line arguments and execute the defined action
// process.argv contains the command-line arguments passed to the script
// Commander will parse these arguments and match them against defined options
// If arguments are valid, it executes the .action() callback above
program.parse();
