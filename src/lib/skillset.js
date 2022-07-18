import fs from 'fs/promises'
import yaml from 'js-yaml';
import pug from 'pug';

export default class SkillSet {
  constructor (config) {
    this.config = {
      datafile: '',
      tplfile: '',
      tag_start: '',
      tag_end: '',
      file_input: '',
      file_output: ''
    };

    this.config = {
      ...this.config,
      ...config
    };

    this.skillsHtml = '';
    this.readmeMd = '';

    return (async () => {
      this.skills_data = await this.getData();
      return this;
    })();
  }

  getData = async () => {
    const data = fs.readFile(this.config.datafile, 'utf8');
    const result = await data;
    console.info('Loaded yaml skillset data from <' + this.config.datafile + '>');
    return await yaml.load(result).Skillset;
  }

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

    this.skillsHtml = html;
  }

  getReadmeFile = async () => {
    const data = await fs.readFile(this.config.file_input, 'utf8');
    console.info('Loaded file: <' + this.config.file_input + '>');
    this.readmeMd = data;
  }

  /**
   * readmeMd
   */
  prepareHtml = () => {
    // eslint-disable-next-line no-eval
    const re = eval('/(' + this.config.tag_start + ')[\\s\\S]*?(' + this.config.tag_end + ')/g');

    this.readmeMd = this.readmeMd
      .replace(re, `$1\n${this.skillsHtml}\n$2`);
  }

  writeReadmeFile = async () => {
    await fs.writeFile(this.config.file_output, this.readmeMd);
    console.info('Wrote output to file: <' + this.config.file_output + '>');
  }

  render = async () => {
    this.renderSkillsHtml();
    await this.getReadmeFile();
    this.prepareHtml();
    await this.writeReadmeFile();
  }
}
