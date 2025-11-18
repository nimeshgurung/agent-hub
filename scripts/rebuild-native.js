#!/usr/bin/env node
/**
 * Cross-platform helper to rebuild better-sqlite3 for VS Code's Electron runtime.
 * Delegates to @electron/rebuild so Windows/Linux/macOS behave the same way.
 */

const { execSync } = require('child_process');
const path = require('path');

const ELECTRON_VERSION = process.env.ELECTRON_TARGET || '37.2.3';
const VSCE_TARGET = process.env.VSCE_TARGET || '';
const npmBinary = process.platform === 'win32' ? 'npx.cmd' : 'npx';

// Map VSCE target to electron-rebuild arch
const archMap = {
  'darwin-x64': 'x64',
  'darwin-arm64': 'arm64',
  'win32-x64': 'x64',
  'linux-x64': 'x64',
};

const targetArch = archMap[VSCE_TARGET] || process.arch;
const archFlag = targetArch ? ` --arch ${targetArch}` : '';
const rebuildCommand = `${npmBinary} @electron/rebuild -f -w better-sqlite3 -v ${ELECTRON_VERSION}${archFlag}`;

console.log(`Rebuilding better-sqlite3 against Electron ${ELECTRON_VERSION} for ${targetArch}...`);
try {
  execSync(rebuildCommand, {
    stdio: 'inherit',
    env: {
      ...process.env,
      npm_config_node_gyp: path.join(__dirname, '../node_modules/node-gyp/bin/node-gyp.js'),
    },
  });
  console.log('✓ Rebuild complete');
} catch (error) {
  console.error('Rebuild failed:', error.message);
  process.exit(1);
}
