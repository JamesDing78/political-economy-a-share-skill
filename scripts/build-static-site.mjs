#!/usr/bin/env node
import fs from 'node:fs/promises';
const required = [
  'docs/index.html',
  'docs/app.js',
  'docs/styles.css',
  'docs/data/daily-evidence.json',
  'docs/data/fallback.json',
  'docs/assets/policy-workbench.svg',
  'docs/assets/research-flow.svg',
  'docs/assets/research-radar-loop.mp4'
];
for (const file of required) await fs.access(file);
console.log(JSON.stringify({ ok: true, checked: required }, null, 2));
