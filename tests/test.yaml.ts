import fs from 'fs';
import util from 'util';
import { exec } from 'child_process';
import yaml from 'js-yaml';
import { load as configLoad } from 'node-yaml-config';
import type { SkillSetConfig } from '../src/types/index.js';

interface ExecError extends Error {
  stdout?: string;
  stderr?: string;
}

const config = configLoad<SkillSetConfig>('./src/config.yaml');

// Convert exec to return a Promise
const execPromise = util.promisify(exec);

const checkLinting = async (): Promise<void> => {
  try {
    await execPromise(`yamllint ${config.datafile} -f colored`);
    console.info(`\n✅ Valid ${config.datafile} file.\n`);
  } catch (error) {
    // Capture stdout and stderr from the error object
    const execError = error as ExecError;
    const { stdout, stderr } = execError;

    // Log both stdout and stderr for detailed error information
    if (stderr) {
      console.error(`\n❌ Error running yamllint: \n\n${stderr}`);
      process.exit(1); // Exit with error for bash
    }
    if (stdout) {
      console.error(`\n❌ Invalid YAML file: \n\n${stdout}`);
      process.exit(1); // Exit with error for bash
    }
  }
};

const checkColors = async (): Promise<void> => {
  // Function to check if a value is a color and is properly single-quoted
  const isProperlyQuotedColor = (value: string): boolean => {
    const colorRegex = /^#[0-9a-fA-F]{6}$/;
    return (
      typeof value === 'string' &&
      colorRegex.test(value) &&
      value.startsWith("'") &&
      value.endsWith("'")
    );
  };

  // Recursively validate all nodes in the YAML object
  const validateYaml = (
    obj: Record<string, unknown>,
    path = ''
  ): string[] => {
    let errors: string[] = [];

    for (const key in obj) {
      const fullPath = path ? `${path}.${key}` : key;
      const value = obj[key];

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        errors = errors.concat(
          validateYaml(value as Record<string, unknown>, fullPath)
        );
      } else if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)) {
        if (!isProperlyQuotedColor(value)) {
          errors.push(
            `Color value at ${fullPath} is not properly quoted: ${value}`
          );
        }
      }
    }

    return errors;
  };

  try {
    const fileContents = fs.readFileSync(config.datafile, 'utf8');
    const data = yaml.load(fileContents) as Record<string, unknown>;

    const errors = validateYaml(data);

    if (errors.length > 0) {
      console.error('Validation errors:');
      errors.forEach((error) => console.error(error));
      process.exit(1);
    } else {
      console.log('All color values are properly quoted.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error reading or parsing YAML file: \n\n${message}`);
    process.exit(1);
  }
};

// Read and parse the YAML file
const runTests = async (): Promise<void> => {
  try {
    await checkLinting();
    // await checkColors();
    void checkColors; // Suppress unused variable warning
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error reading or parsing YAML file: \n\n${message}`);
    process.exit(1);
  }
};

runTests();
