import fs from 'fs';
import util from 'util';
import { exec } from 'child_process';
import yaml from 'js-yaml';
import { load as configLoad } from 'node-yaml-config';

const config = configLoad('./src/config.yaml');

// Convert exec to return a Promise
const execPromise = util.promisify(exec);

const checkLinting = async () => {
  try {
    await execPromise(`yamllint ${config.datafile} -f colored`);    
    console.info(`\n✅ Valid ${config.datafile} file.\n`);
  } catch (error) {
    // Capture stdout and stderr from the error object
    const { stdout, stderr } = error;
    
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

const checkColors = async () => {
  // Function to check if a value is a color and is properly single-quoted
  const isProperlyQuotedColor = (value) => {
    const colorRegex = /^#[0-9a-fA-F]{6}$/;
    return typeof value === 'string' && colorRegex.test(value) && value.startsWith("'") && value.endsWith("'");
  }

  // Recursively validate all nodes in the YAML object
  const validateYaml = (obj, path = '') => {
    let errors = [];

    for (const key in obj) {
      const fullPath = path ? `${path}.${key}` : key;

      if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        errors = errors.concat(validateYaml(obj[key], fullPath));
      } else if (typeof obj[key] === 'string' && /^#[0-9a-fA-F]{6}$/.test(obj[key])) {
        if (!isProperlyQuotedColor(obj[key])) {
          errors.push(`Color value at ${fullPath} is not properly quoted: ${obj[key]}`);
        }
      }
    }
  
    return errors;
  }

  try {
    const fileContents = fs.readFileSync(config.datafile, 'utf8');
    const data = yaml.load(fileContents);

    const errors = validateYaml(data);

    if (errors.length > 0) {
      console.error('Validation errors:');
      errors.forEach((error) => console.error(error));
      process.exit(1);
    } else {
      console.log('All color values are properly quoted.');
    }
  } catch (error) {
    console.error(`❌ Error reading or parsing YAML file: \n\n${error.message}`);
    process.exit(1);
  }
}

// Read and parse the YAML file
const runTests = async () => {
  try {
    await checkLinting();
    // await checkColors();
  } catch (error) {
    console.error(`❌ Error reading or parsing YAML file: \n\n${error.message}`);
    process.exit(1);
  }
};

runTests();