import { cpSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const source = join(projectRoot, 'public/docs/.vitepress/dist');
const dest = join(projectRoot, 'dist/docs');

console.log('Copying VitePress docs...');
console.log('From:', source);
console.log('To:', dest);

if (!existsSync(source)) {
    console.error('ERROR: VitePress build output not found at', source);
    process.exit(1);
}

// Ensure destination directory exists
mkdirSync(dest, { recursive: true });

// Copy the entire VitePress dist folder
cpSync(source, dest, { recursive: true });

console.log('VitePress docs copied successfully');