import { lint } from 'yaml-lint';
import fs from 'fs'

import { load as configLoad } from 'node-yaml-config';
const config = configLoad('./src/config.yaml');

fs.readFile(config.datafile, 'utf8', (error, data) => {
  if (error) {
    console.error(error);
    return;
  }

  lint(data)
    .then(() => {
      console.log('Valid YAML file.');
    })
    .catch((error) => {
      console.error('Invalid YAML file.', error);
      process.exit(1); // error for bash
    });
});
