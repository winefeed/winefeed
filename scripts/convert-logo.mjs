import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';

const svgBuffer = readFileSync('public/winefeed-logo-light.svg');

// Convert to PNG at 2x for retina
await sharp(svgBuffer)
  .resize(400, 84)
  .png()
  .toFile('public/winefeed-logo-light.png');

console.log('✅ Converted to PNG: public/winefeed-logo-light.png');
