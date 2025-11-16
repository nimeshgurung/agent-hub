const esbuild = require('esbuild');
const path = require('path');

const watch = process.argv.includes('--watch');

const extensionConfig = {
  entryPoints: ['./src/extension.ts'],
  bundle: true,
  outfile: './dist/extension.js',
  external: ['vscode', 'better-sqlite3'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  minify: !watch,
  logLevel: 'info',
};

const webviewConfig = {
  entryPoints: {
    'index': './src/webview/search/index.ts',
    'installed': './src/webview/installed/index.ts',
    'repositories': './src/webview/repositories/index.ts',
  },
  bundle: true,
  outdir: './dist/webview',
  format: 'iife',
  platform: 'browser',
  target: ['chrome120'],
  sourcemap: true,
  minify: !watch,
  logLevel: 'info',
};

async function build() {
  try {
    if (watch) {
      const extCtx = await esbuild.context(extensionConfig);
      const webCtx = await esbuild.context(webviewConfig);
      await extCtx.watch();
      await webCtx.watch();
      console.log('Watching for changes...');
    } else {
      await esbuild.build(extensionConfig);
      await esbuild.build(webviewConfig);
      console.log('Build complete');
    }
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
}

build();

