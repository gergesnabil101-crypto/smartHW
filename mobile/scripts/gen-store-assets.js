/* Generates Play Store assets into mobile/store-assets/ */
const sharp = require('sharp');

(async () => {
  await sharp('assets/icon.png').resize(512, 512).png().toFile('store-assets/icon-512.png');
  console.log('icon-512 ok');

  const iconBuf = await sharp('assets/icon.png').resize(240, 240).png().toBuffer();
  const svg = `<svg width="1024" height="500" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f5f2ea"/><stop offset="1" stop-color="#e8f0f4"/>
    </linearGradient></defs>
    <rect width="1024" height="500" fill="url(#bg)"/>
    <rect x="292" y="60" width="440" height="380" rx="36" fill="#16405b"/>
    <rect x="292" y="60" width="440" height="380" rx="36" fill="none" stroke="#b91c1c" stroke-width="6"/>
    <text x="512" y="380" font-family="Arial" font-size="52" font-weight="bold" fill="#ffffff" text-anchor="middle">مصحح الواجبات الذكي</text>
    <text x="512" y="425" font-family="Arial" font-size="26" fill="#e8f0f4" text-anchor="middle">تصحيح واختبارات بالذكاء الاصطناعي</text>
  </svg>`;
  await sharp(Buffer.from(svg))
    .composite([{ input: iconBuf, top: 85, left: 392 }])
    .png().toFile('store-assets/feature-graphic.png');
  console.log('feature ok');
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
