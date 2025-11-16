#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const artifactsDir = path.join(root, 'artifacts');
const vsixName = `${pkg.name}-${pkg.version}.vsix`;
const outputPath = path.join(artifactsDir, vsixName);
const npxBinary = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const run = (cmd, args, opts = {}) => {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: process.env,
    ...opts,
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed`);
  }
};

try {
  fs.mkdirSync(artifactsDir, { recursive: true });
  if (fs.existsSync(outputPath)) {
    fs.rmSync(outputPath);
  }

  run('npm', ['run', 'build']);
  run(npxBinary, ['vsce', 'package', '--out', outputPath]);

  console.log(`VSIX written to ${outputPath}`);
} catch (error) {
  console.error('Failed to create VSIX:', error.message);
  process.exit(1);
}


