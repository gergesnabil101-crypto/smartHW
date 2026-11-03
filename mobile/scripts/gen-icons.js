const sharp = require('sharp');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');
const BG = '#4f46e5';

// Paper + checkmark glyph (drawn to look good inside adaptive-icon safe zone)
const glyph = (color, check = color) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 432 432" width="432" height="432">
  <rect x="146" y="96" width="140" height="188" rx="18" fill="${color}"/>
  <rect x="168" y="126" width="96" height="14" rx="7" fill="${BG}" opacity="${color === '#ffffff' ? '0.55' : '0.35'}"/>
  <rect x="168" y="154" width="96" height="14" rx="7" fill="${BG}" opacity="${color === '#ffffff' ? '0.55' : '0.35'}"/>
  <rect x="168" y="182" width="64" height="14" rx="7" fill="${BG}" opacity="${color === '#ffffff' ? '0.55' : '0.35'}"/>
  <circle cx="280" cy="280" r="56" fill="${BG}" stroke="${color}" stroke-width="10"/>
  <path d="M252 280 l20 20 l38 -42" fill="none" stroke="${check}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

async function render(svg, size) {
  return sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
}

async function main() {
  // Full icon: brand bg + white glyph centered (1024)
  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 432 432" width="1024" height="1024">
    <rect width="432" height="432" fill="${BG}"/>
    ${glyph('#ffffff').replace(/<\/?svg[^>]*>/g, '')}
  </svg>`;
  await sharp(Buffer.from(iconSvg)).resize(1024, 1024).png().toFile(path.join(ASSETS, 'icon.png'));

  // Adaptive foreground: transparent bg, white glyph (432 → 1024 for quality)
  await render(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 432 432" width="1024" height="1024">${glyph('#ffffff').replace(/<\/?svg[^>]*>/g, '')}</svg>`, 1024)
    .then(b => sharp(b).toFile(path.join(ASSETS, 'android-icon-foreground.png')));

  // Adaptive background: solid brand color
  await sharp({ create: { width: 432, height: 432, channels: 4, background: BG } })
    .png().toFile(path.join(ASSETS, 'android-icon-background.png'));

  // Monochrome: single-color glyph
  await render(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 432 432" width="432" height="432">${glyph('#ffffff', '#ffffff').replace(/<\/?svg[^>]*>/g, '')}</svg>`, 432)
    .then(b => sharp(b).toFile(path.join(ASSETS, 'android-icon-monochrome.png')));

  // favicon + splash
  await sharp(Buffer.from(iconSvg)).resize(48, 48).png().toFile(path.join(ASSETS, 'favicon.png'));
  await sharp(Buffer.from(iconSvg)).resize(288, 288).png().toFile(path.join(ASSETS, 'splash-icon.png'));

  console.log('icons written');
}

main().catch(e => { console.error(e); process.exit(1); });
