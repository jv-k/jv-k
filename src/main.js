// index.js
import { load as configLoad } from 'node-yaml-config';
import SkillSet from './lib/skillset.js';

const config = configLoad('./src/config.yaml');
const mySkills = await new SkillSet(config);
await mySkills.render();
