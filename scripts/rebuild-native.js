#!/usr/bin/env node
/**
 * Cross-platform helper to rebuild better-sqlite3 for VS Code's Electron runtime.
 * Delegates to @electron/rebuild so Windows/Linux/macOS behave the same way.
 */

const { execSync } = require('child_process');
const path = require('path');

const ELECTRON_VERSION = process.env.ELECTRON_TARGET || '37.2.3';
const npmBinary = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const rebuildCommand = `${npmBinary} @electron/rebuild -f -w better-sqlite3 -v ${ELECTRON_VERSION}`;

console.log(`Rebuilding better-sqlite3 against Electron ${ELECTRON_VERSION}...`);
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
