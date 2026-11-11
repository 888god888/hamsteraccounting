import { build } from 'esbuild';
import { mkdir, cp, rm, readFile, writeFile } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
await build({ entryPoints: ['src/app.js'], bundle: true, minify: true, format: 'esm', target: ['es2022'], outfile: 'dist/app.js', legalComments: 'eof' });
if (process.env.SUPABASE_URL || process.env.SUPABASE_PUBLISHABLE_KEY) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) throw new Error('Both Supabase variables are required');
  await writeFile('dist/config.js', 'window.HAMSTER_CONFIG = ' + JSON.stringify({ supabaseUrl: process.env.SUPABASE_URL, supabaseKey: process.env.SUPABASE_PUBLISHABLE_KEY }) + ';\n');
}
await writeFile('dist/.nojekyll', '');
console.log('Built GitHub Pages app → dist/');
