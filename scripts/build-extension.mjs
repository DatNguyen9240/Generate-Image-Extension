import { build } from 'esbuild';

await Promise.all([
  build({ entryPoints: ['src/background/index.ts'], outfile: 'dist/background.js', bundle: true, format: 'esm', platform: 'browser', target: 'chrome114', minify: true, alias: { '@': './src' } }),
  build({ entryPoints: ['src/content/index.ts'], outfile: 'dist/content.js', bundle: true, format: 'iife', platform: 'browser', target: 'chrome114', minify: true, alias: { '@': './src' } }),
]);
