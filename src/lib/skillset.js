/**
 * @fileoverview Definition of the SkillSet class.
 * @author John Valai <git@jvk.to>
 */

import fs from 'fs/promises'
import yaml from 'js-yaml';
import pug from 'pug';

/** @class SkillSet
 *
 * Defines a class called SkillSet that generates a list of skillset icons and insert them into a template to create a README.md file.
 *
 * @requires module:fs/promises
 * @requires module:js-yaml
 * @requires module:pug
*/
class SkillSet {
  /**
   * Defines a constructor that takes a config object as a parameter and sets the default and custom properties for the instance.
   *
   * @param {Object} config - Settings used to configure how README.md is generated
   * @constructor
   * @memberof SkillSet
   * @throws {Error} If required config fields are missing
   */
  constructor (config) {
    // Validate required config fields
    const requiredFields = ['datafile', 'file_input', 'file_output', 'tag_start', 'tag_end', 'tpl_section', 'tpl_icon'];
    const missing = requiredFields.filter(field => !config[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required config fields: ${missing.join(', ')}`);
    }

    this.config = { ...config };
    this.skillsHtml = '';
    this.readmeMD = '';
    this.readmeHTML = '';
    this.skills_data = {};
  }

  /**
   * Escapes special regex characters in a string.
   *
   * @param {String} string - The string to escape
   * @returns {String} - The escaped string safe for use in RegExp
   * @method
   * @private
   * @memberof SkillSet
   */
  escapeRegex = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Retrieves the skills icon data from a yaml data file.
   *
   * @returns {Promise<Object>} - an object literal containing the icon data.
   * @method
   * @async
   * @private
   * @memberof SkillSet
   */
  getData = async () => {
    const data = fs.readFile(this.config.datafile, 'utf8');
    const result = await data;
    console.info('Loaded yaml skillset data from <' + this.config.datafile + '>');
    return await yaml.load(result).Skillset;
  }

  /**
   * Generates HTML for all skills icons by looping through the skillset data and generates HTML for each skill icon using a pug template. It returns a string with the HTML code for all the skill icons.
   *
   * @returns {String} - Skills icons HTML
   * @method
   * @private
   * @memberof SkillSet
   */
  renderSkillsHtml = () => {
    let html = '';
    const skillset = this.skills_data;
    const topics = Object.keys(skillset);
    const tplSection = pug.compileFile(this.config.tpl_section);
    const tplIcon = pug.compileFile(this.config.tpl_icon);

    topics.forEach((topic) => {
      const thisTopic = skillset[topic];

      let iconsHtml = '';

      thisTopic.forEach((skill, index) => {
        const thisSkill = thisTopic[index];
        iconsHtml += tplIcon({
          name: thisSkill.name,
          url: thisSkill.url,
          color: thisSkill.color.replace('#', '')
        });
      });
      html += tplSection({
        name: topic,
        icons: iconsHtml
      });
    });
    console.info('Rendered skillset html.');

    return html;
  }

  /**
   * Reads the markdown README file that contains the placeholder tags for the skill icons and returns the file content.
   *
   * @returns {Promise<String>} - The contents of the Readme template file
   * @method
   * @async
   * @private
   * @memberof SkillSet
   */
  getReadmeFile = async () => {
    const data = await fs.readFile(this.config.file_input, 'utf8');
    console.info('Loaded file: <' + this.config.file_input + '>');
    return data;
  }

  /**
   * Replaces the placeholder tags in the README file with the HTML code for the skill icons and returns the updated HTML content.
   *
   * @returns {String} - HTML of the Readme file.
   * @method
   * @private
   * @memberof SkillSet
   * */
  prepareHtml = () => {
    const re = new RegExp(
      `(${this.escapeRegex(this.config.tag_start)})[\\s\\S]*?(${this.escapeRegex(this.config.tag_end)})`,
      'g'
    );

    return this.readmeMD
      .replace(re, `$1\n${this.skillsHtml}\n$2`);
  }

  /**
   * Writes the readme generated back to a build file.
   *
   * returns {Promise<void>}
   * @method
   * @async
   * @private
   * @memberof SkillSet
   *
   */
  writeReadmeFile = async () => {
    const readFile = await fs.writeFile(this.config.file_output, this.readmeHTML);
    console.info('Wrote output to file: <' + this.config.file_output + '>');
    return readFile;
  }

  /**
   * Public entry point that calls the needed methods in sequence and handles any errors that may occur.
   *
   * @method
   * @async
   * @public
   * @memberof SkillSet
   */
  renderReadme = async () => {
    try {
      this.skills_data = await this.getData();
      this.skillsHtml = this.renderSkillsHtml();
      this.readmeMD = await this.getReadmeFile();
      this.readmeHTML = this.prepareHtml();
      await this.writeReadmeFile();
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.error(`File not found: ${error.path}`);
      } else if (error instanceof yaml.YAMLException) {
        console.error(`YAML parsing error: ${error.message}`);
      } else {
        console.error(`Error: ${error.message}`);
      }
      throw error;
    }
  }
}

export default SkillSet;
