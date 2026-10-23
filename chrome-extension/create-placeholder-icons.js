/**
 * create-placeholder-icons.js
 * Creates SVG placeholder icons for the Chrome extension.
 * Run: node create-placeholder-icons.js
 */
const fs   = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

function makeSVG(size) {
  const r   = Math.round(size * 0.19);
  const sw  = Math.max(1, Math.round(size * 0.05));
  const kx  = Math.round(size * 0.12);
  const ky  = Math.round(size * 0.33);
  const kw  = Math.round(size * 0.76);
  const kh  = Math.round(size * 0.44);
  const kr  = Math.max(2, Math.round(size * 0.06));
  const cx  = Math.round(size * 0.5);
  const cy1 = Math.round(size * 0.1);
  const cy2 = Math.round(size * 0.31);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg${size}" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0d0f1a"/>
      <stop offset="100%" stop-color="#12152a"/>
    </linearGradient>
    <linearGradient id="g${size}" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#4f8ef7"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#bg${size})"/>
  <rect x="${kx}" y="${ky}" width="${kw}" height="${kh}" rx="${kr}" stroke="url(#g${size})" stroke-width="${sw}" fill="none"/>
  <line x1="${cx}" y1="${cy1}" x2="${cx}" y2="${cy2}" stroke="url(#g${size})" stroke-width="${sw}" stroke-linecap="round"/>
</svg>`;
}

[16, 48, 128].forEach(size => {
  const svgPath = path.join(assetsDir, `icon${size}.svg`);
  fs.writeFileSync(svgPath, makeSVG(size), 'utf8');
  console.log('Created:', svgPath);
});

console.log('\nSVG icons created in assets/');
console.log('To generate PNG icons, run: node generate-icons.js');
console.log('(requires: npm install canvas)');
