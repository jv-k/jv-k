/**
 * @fileoverview Main entrypoint for generation of README.md
 * @author John Valai <git@jvk.to>
 */

import { load as configLoad } from 'node-yaml-config';
import SkillSet from './lib/skillset.js';
import type { SkillSetConfig } from './types/index.js';

const config = configLoad<SkillSetConfig>('./src/config.yaml');
const mySkills = new SkillSet(config);
await mySkills.renderReadme();
