import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.resolve(__dirname, '../lawyer-finder-web/public');
const destDir = path.resolve(__dirname, './public');

const filesToCopy = ['logo.png', 'logowhite.png', 'justieswomen.png', 'avatar.png', 'hero.png'];

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

filesToCopy.forEach(file => {
  const src = path.join(srcDir, file);
  const dest = path.join(destDir, file);
  try {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`Successfully copied logo asset: ${file}`);
    } else {
      console.warn(`Source asset not found: ${src}`);
    }
  } catch (err) {
    console.error(`Failed to copy ${file}:`, err);
  }
});
