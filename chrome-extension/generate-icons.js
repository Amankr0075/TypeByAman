/**
 * generate-icons.js
 * Run with: node generate-icons.js
 * Generates PNG icons for the Chrome extension using Canvas API (Node.js).
 * Requires: npm install canvas
 *
 * Alternative: You can use any image editor to export the source SVG
 * at 16x16, 48x48, and 128x128 pixels to the assets/ folder.
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const sizes = [16, 48, 128];

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx    = canvas.getContext('2d');
  const s      = size;
  const pad    = s * 0.1;

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, s, s);
  bgGrad.addColorStop(0, '#0d0f1a');
  bgGrad.addColorStop(1, '#12152a');
  ctx.fillStyle = bgGrad;

  // Rounded rect background
  const r = s * 0.2;
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.lineTo(s - r, 0);
  ctx.quadraticCurveTo(s, 0, s, r);
  ctx.lineTo(s, s - r); ctx.quadraticCurveTo(s, s, s - r, s);
  ctx.lineTo(r, s); ctx.quadraticCurveTo(0, s, 0, s - r);
  ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();

  // Glow
  const glow = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
  glow.addColorStop(0, 'rgba(79,142,247,0.15)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fill();

  // Keyboard icon
  const grad = ctx.createLinearGradient(0, 0, s, s);
  grad.addColorStop(0, '#4f8ef7');
  grad.addColorStop(1, '#a855f7');
  ctx.strokeStyle = grad;
  ctx.lineWidth   = Math.max(1, s * 0.07);
  ctx.lineCap     = 'round';

  // Keyboard body
  const kx = pad, ky = s * 0.3, kw = s - 2*pad, kh = s * 0.44;
  const kr = Math.max(2, s * 0.08);
  ctx.beginPath();
  ctx.moveTo(kx + kr, ky);
  ctx.lineTo(kx + kw - kr, ky);
  ctx.quadraticCurveTo(kx + kw, ky, kx + kw, ky + kr);
  ctx.lineTo(kx + kw, ky + kh - kr);
  ctx.quadraticCurveTo(kx + kw, ky + kh, kx + kw - kr, ky + kh);
  ctx.lineTo(kx + kr, ky + kh);
  ctx.quadraticCurveTo(kx, ky + kh, kx, ky + kh - kr);
  ctx.lineTo(kx, ky + kr);
  ctx.quadraticCurveTo(kx, ky, kx + kr, ky);
  ctx.closePath();
  ctx.stroke();

  if (size >= 48) {
    // Keys row 1
    const keyY1 = ky + kh * 0.28;
    const keySpacing = kw / 5;
    for (let i = 0; i < 4; i++) {
      const kbx = kx + keySpacing * 0.5 + i * keySpacing;
      const kbw = keySpacing * 0.55;
      ctx.beginPath();
      ctx.moveTo(kbx, keyY1); ctx.lineTo(kbx + kbw, keyY1);
      ctx.stroke();
    }
    // Keys row 2
    const keyY2 = ky + kh * 0.55;
    for (let i = 0; i < 3; i++) {
      const kbx = kx + keySpacing * 0.8 + i * keySpacing;
      const kbw = keySpacing * 0.55;
      ctx.beginPath();
      ctx.moveTo(kbx, keyY2); ctx.lineTo(kbx + kbw, keyY2);
      ctx.stroke();
    }
    // Spacebar
    const spY = ky + kh * 0.8;
    ctx.beginPath();
    ctx.moveTo(kx + kw * 0.25, spY);
    ctx.lineTo(kx + kw * 0.75, spY);
    ctx.stroke();
  }

  // Cursor above keyboard
  ctx.lineWidth = Math.max(1, s * 0.06);
  ctx.beginPath();
  ctx.moveTo(s / 2, pad * 0.5);
  ctx.lineTo(s / 2, s * 0.28);
  ctx.stroke();

  return canvas.toBuffer('image/png');
}

const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

sizes.forEach(size => {
  const buf = drawIcon(size);
  const out = path.join(assetsDir, `icon${size}.png`);
  fs.writeFileSync(out, buf);
  console.log(`Generated: ${out}`);
});

console.log('\nDone! Icons saved to assets/');
console.log('If canvas is not installed, run: npm install canvas');
