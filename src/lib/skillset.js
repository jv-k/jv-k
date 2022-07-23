/**
 * @fileoverview Definition of the SkillSet class.
 * @author John Valai <git@jvk.to>
 */

import fs from 'fs/promises'
import yaml from 'js-yaml';
import pug from 'pug';

/** @class SkillSet
 *
 * Generates a list of skillset icons and inserts it into a template.
 * @requires module:fs/promises
 * @requires module:js-yaml
 * @requires module:pug
*/
class SkillSet {
  /**
   * Creates an instance of SkillSet.
   * @param {Object} config - Settings used to configure how README.md is generated
   * @constructor
   * @memberof SkillSet
   */
  constructor (config) {
    this.config = {
      datafile: '',
      tplfile: '',
      tag_start: '',
      tag_end: '',
      file_input: '',
      file_output: ''
    };

    // Append config to default static config
    this.config = {
      ...this.config,
      ...config
    };

    this.skillsHtml = '';
    this.readmeMD = '';
    this.readmeHTML = '';
    this.skills_data = {};
  }

  /**
   * Retrieves the skills icon data from a yaml data file.
   *
   * @returns {Promise<Object>} - an object literal containing the icon data.
   * @method
   * @async
   * @memberof SkillSet
   */
  getData = async () => {
    const data = fs.readFile(this.config.datafile, 'utf8');
    const result = await data;
    console.info('Loaded yaml skillset data from <' + this.config.datafile + '>');
    return await yaml.load(result).Skillset;
  }

  /**
   * Generates HTML for all skills icons using a template.
   *
   * @returns {String} - Skills icons HTML
   * @method
   * @memberof SkillSet
   */
  renderSkillsHtml = () => {
    let html = '';
    const skillset = this.skills_data;
    const topics = Object.keys(skillset);
    const tpl = pug.compileFile(this.config.tplfile);

    topics.forEach((topic) => {
      const thisTopic = skillset[topic];

      thisTopic.forEach((skill, index) => {
        const thisSkill = thisTopic[index];
        html += tpl({
          name: thisSkill.name,
          url: thisSkill.url,
          color: thisSkill.color.replace('#', '')
        });
      });
    });
    console.info('Rendered skillset html.');

    return html;
  }

  /**
   * Loads the markdown Readme file.
   *
   * @returns {Promise<String>} - The contents of the Readme template file
   * @method
   * @async
   * @memberof SkillSet
   */
  getReadmeFile = async () => {
    const data = await fs.readFile(this.config.file_input, 'utf8');
    console.info('Loaded file: <' + this.config.file_input + '>');
    return data;
  }

  /**
   * Replaces the placeholder tags in the Readme file with the skills icons HTML.
   *
   * @returns {String} - HTML of the Readme file.
   * @method
   * @memberof SkillSet
   * */
  prepareHtml = () => {
    // eslint-disable-next-line no-eval
    const re = eval('/(' + this.config.tag_start + ')[\\s\\S]*?(' + this.config.tag_end + ')/g');

    return this.readmeMD
      .replace(re, `$1\n${this.skillsHtml}\n$2`);
  }

  /**
   * Writes the readme generated back to a build file.
   *
   * returns {Promise<void>}
   * @method
   * @async
   * @memberof SkillSet
   *
   */
  writeReadmeFile = async () => {
    const readFile = await fs.writeFile(this.config.file_output, this.readmeHTML);
    console.info('Wrote output to file: <' + this.config.file_output + '>');
    return readFile;
  }

  /**
   * Public entry point to process and save a Skillset file with skills icons.
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
      console.log(error);
    }
  }
}

/**
 * Expose SkillSet
 */
export default SkillSet;
