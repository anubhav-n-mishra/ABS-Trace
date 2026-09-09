import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

fs.writeFileSync(
  path.join(distDir, 'index.js'),
  `export * from '@anubhavm/trace';\n`
);

fs.writeFileSync(
  path.join(distDir, 'index.d.ts'),
  `export * from '@anubhavm/trace';\n`
);

console.log('Built @amvelt/trace thin re-export wrapper.');
