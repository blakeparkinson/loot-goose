import sharp from 'sharp';
import { writeFileSync } from 'fs';

// ---------------------------------------------------------------------------
// Silly goose SVG — cartoon style, dark background
// ---------------------------------------------------------------------------
const gooseSVG = (size, includePadding = true) => {
  const p = includePadding ? 0.12 : 0;
  const pad = size * p;
  const s = size - pad * 2;
  const cx = size / 2;

  // Scale all coords from a 512x512 canvas
  const sc = (v) => (v / 512) * s + pad;
  const sr = (v) => (v / 512) * s;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${size}" height="${size}" fill="#0D1117" rx="${sr(120)}"/>

  <!-- Shadow under body -->
  <ellipse cx="${sc(256)}" cy="${sc(460)}" rx="${sr(185)}" ry="${sr(28)}" fill="rgba(0,0,0,0.35)"/>

  <!-- Left wing (flung out chaotically) -->
  <ellipse cx="${sc(115)}" cy="${sc(310)}" rx="${sr(105)}" ry="${sr(52)}" fill="#D8D8D8"
    transform="rotate(-38, ${sc(115)}, ${sc(310)})"/>

  <!-- Right wing (flung out other side) -->
  <ellipse cx="${sc(395)}" cy="${sc(310)}" rx="${sr(105)}" ry="${sr(52)}" fill="#D8D8D8"
    transform="rotate(38, ${sc(395)}, ${sc(310)})"/>

  <!-- Body -->
  <ellipse cx="${sc(256)}" cy="${sc(350)}" rx="${sr(175)}" ry="${sr(145)}" fill="white"/>

  <!-- Tail feathers -->
  <ellipse cx="${sc(256)}" cy="${sc(485)}" rx="${sr(55)}" ry="${sr(26)}" fill="#E0E0E0" transform="rotate(-5, ${sc(256)}, ${sc(485)})"/>
  <ellipse cx="${sc(280)}" cy="${sc(478)}" rx="${sr(40)}" ry="${sr(22)}" fill="#D0D0D0" transform="rotate(10, ${sc(280)}, ${sc(478)})"/>

  <!-- Neck -->
  <path d="
    M ${sc(222)},${sc(240)}
    Q ${sc(200)},${sc(210)} ${sc(210)},${sc(175)}
    Q ${sc(220)},${sc(140)} ${sc(256)},${sc(135)}
    Q ${sc(292)},${sc(130)} ${sc(302)},${sc(165)}
    Q ${sc(315)},${sc(205)} ${sc(292)},${sc(240)}
    Z
  " fill="white"/>

  <!-- Head -->
  <circle cx="${sc(256)}" cy="${sc(118)}" r="${sr(82)}" fill="white"/>

  <!-- Beak top -->
  <path d="M ${sc(306)},${sc(108)} Q ${sc(385)},${sc(95)} ${sc(378)},${sc(122)} Q ${sc(370)},${sc(142)} ${sc(306)},${sc(134)} Z" fill="#F5A623"/>
  <!-- Beak bottom (open — silly) -->
  <path d="M ${sc(306)},${sc(134)} Q ${sc(370)},${sc(142)} ${sc(362)},${sc(162)} Q ${sc(352)},${sc(178)} ${sc(306)},${sc(158)} Z" fill="#E08010"/>
  <!-- Mouth gap -->
  <path d="M ${sc(306)},${sc(134)} Q ${sc(358)},${sc(144)} ${sc(362)},${sc(152)} Q ${sc(340)},${sc(148)} ${sc(306)},${sc(138)} Z" fill="#111"/>
  <!-- Tongue -->
  <ellipse cx="${sc(346)}" cy="${sc(155)}" rx="${sr(13)}" ry="${sr(6)}" fill="#FF7070"/>
  <!-- Nostril -->
  <circle cx="${sc(355)}" cy="${sc(115)}" r="${sr(5)}" fill="#CC7700"/>

  <!-- Eye (big, silly) -->
  <circle cx="${sc(240)}" cy="${sc(100)}" r="${sr(22)}" fill="#111"/>
  <circle cx="${sc(247)}" cy="${sc(93)}" r="${sr(9)}" fill="white"/>
  <circle cx="${sc(249)}" cy="${sc(91)}" r="${sr(4)}" fill="#111"/>
  <!-- Eyebrow (raised silly) -->
  <path d="M ${sc(220)},${sc(76)} Q ${sc(240)},${sc(66)} ${sc(262)},${sc(72)}" stroke="#888" stroke-width="${sr(5)}" stroke-linecap="round" fill="none"/>

  <!-- Blush -->
  <ellipse cx="${sc(225)}" cy="${sc(128)}" rx="${sr(18)}" ry="${sr(11)}" fill="rgba(255,120,120,0.25)"/>

  <!-- Left leg -->
  <rect x="${sc(210)}" y="${sc(470)}" width="${sr(28)}" height="${sr(52)}" rx="${sr(8)}" fill="#F5A623"/>
  <!-- Left foot toes -->
  <ellipse cx="${sc(186)}" cy="${sc(525)}" rx="${sr(22)}" ry="${sr(10)}" transform="rotate(-25, ${sc(186)}, ${sc(525)})" fill="#F5A623"/>
  <ellipse cx="${sc(220)}" cy="${sc(530)}" rx="${sr(24)}" ry="${sr(10)}" fill="#F5A623"/>
  <ellipse cx="${sc(252)}" cy="${sc(524)}" rx="${sr(20)}" ry="${sr(10)}" transform="rotate(20, ${sc(252)}, ${sc(524)})" fill="#F5A623"/>

  <!-- Right leg -->
  <rect x="${sc(278)}" y="${sc(470)}" width="${sr(28)}" height="${sr(52)}" rx="${sr(8)}" fill="#F5A623"/>
  <!-- Right foot toes -->
  <ellipse cx="${sc(257)}" cy="${sc(525)}" rx="${sr(22)}" ry="${sr(10)}" transform="rotate(-20, ${sc(257)}, ${sc(525)})" fill="#F5A623"/>
  <ellipse cx="${sc(290)}" cy="${sc(530)}" rx="${sr(24)}" ry="${sr(10)}" fill="#F5A623"/>
  <ellipse cx="${sc(322)}" cy="${sc(524)}" rx="${sr(20)}" ry="${sr(10)}" transform="rotate(25, ${sc(322)}, ${sc(524)})" fill="#F5A623"/>

  <!-- Gold halo / loot aura -->
  <circle cx="${sc(256)}" cy="${sc(118)}" r="${sr(95)}" fill="none" stroke="#F5A623" stroke-width="${sr(4)}" opacity="0.35"/>
  <circle cx="${sc(256)}" cy="${sc(118)}" r="${sr(106)}" fill="none" stroke="#F5A623" stroke-width="${sr(2)}" opacity="0.18"/>
</svg>`;
};

// Splash screen SVG (wider composition, goose + text)
const splashSVG = (w, h) => {
  const gooseSize = Math.min(w, h) * 0.55;
  const gx = (w - gooseSize) / 2;
  const gy = h * 0.12;

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${w}" height="${h}" fill="#0D1117"/>
  <!-- Goose (embedded) -->
  <image href="data:image/svg+xml;base64,${Buffer.from(gooseSVG(512, false)).toString('base64')}"
    x="${gx}" y="${gy}" width="${gooseSize}" height="${gooseSize}"/>
  <!-- App name -->
  <text x="${w / 2}" y="${gy + gooseSize + 60}" text-anchor="middle"
    font-family="Arial Black, Arial, sans-serif" font-weight="900"
    font-size="${Math.round(w * 0.11)}" fill="#F5A623" letter-spacing="2">LOOT GOOSE</text>
  <!-- Tagline -->
  <text x="${w / 2}" y="${gy + gooseSize + 108}" text-anchor="middle"
    font-family="Arial, sans-serif" font-weight="600"
    font-size="${Math.round(w * 0.042)}" fill="#8B949E">HONK if you found it</text>
</svg>`;
};

async function generate() {
  console.log('Generating Loot Goose assets...');

  // App icon 1024×1024
  await sharp(Buffer.from(gooseSVG(1024)))
    .png()
    .toFile('assets/icon.png');
  console.log('✓ assets/icon.png');

  // Adaptive icon foreground 1024×1024 (no background, for Android)
  await sharp(Buffer.from(gooseSVG(1024, false)))
    .png()
    .toFile('assets/adaptive-icon.png');
  console.log('✓ assets/adaptive-icon.png');

  // Splash icon 512×512 (just the goose, Expo centers it)
  await sharp(Buffer.from(splashSVG(1284, 2778)))
    .png()
    .toFile('assets/splash-icon.png');
  console.log('✓ assets/splash-icon.png');

  // Favicon 196×196
  await sharp(Buffer.from(gooseSVG(196)))
    .png()
    .toFile('assets/favicon.png');
  console.log('✓ assets/favicon.png');

  console.log('\nDone! All assets generated.');
}

generate().catch((e) => { console.error(e); process.exit(1); });
