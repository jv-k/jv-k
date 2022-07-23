/**
 * @fileoverview Main entrypoint for generation of README.md
 * @author John Valai <git@jvk.to>
 */

import { load as configLoad } from 'node-yaml-config';
import SkillSet from './lib/skillset.js';

const config = configLoad('./src/config.yaml');
const mySkills = new SkillSet(config);
await mySkills.renderReadme();
