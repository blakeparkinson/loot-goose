import sharp from 'sharp';

// ---------------------------------------------------------------------------
// Silly goose SVG — detective hat, googly eyes, loot bag, chaotic energy
// ---------------------------------------------------------------------------
const gooseSVG = (size, includePadding = true) => {
  const p = includePadding ? 0.12 : 0;
  const pad = size * p;
  const s = size - pad * 2;

  const sc = (v) => (v / 512) * s + pad;
  const sr = (v) => (v / 512) * s;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">

  <!-- Background -->
  <rect width="${size}" height="${size}" fill="#0D1117" rx="${sr(120)}"/>

  <!-- Subtle star dust -->
  <circle cx="${sc(72)}" cy="${sc(72)}" r="${sr(3)}" fill="rgba(255,255,255,0.15)"/>
  <circle cx="${sc(440)}" cy="${sc(58)}" r="${sr(2.5)}" fill="rgba(255,255,255,0.12)"/>
  <circle cx="${sc(55)}" cy="${sc(410)}" r="${sr(2)}" fill="rgba(255,255,255,0.1)"/>
  <circle cx="${sc(462)}" cy="${sc(385)}" r="${sr(3)}" fill="rgba(255,255,255,0.12)"/>
  <circle cx="${sc(145)}" cy="${sc(455)}" r="${sr(2)}" fill="rgba(255,255,255,0.08)"/>
  <circle cx="${sc(420)}" cy="${sc(455)}" r="${sr(2.5)}" fill="rgba(255,255,255,0.08)"/>

  <!-- Ground shadow -->
  <ellipse cx="${sc(256)}" cy="${sc(464)}" rx="${sr(182)}" ry="${sr(22)}" fill="rgba(0,0,0,0.4)"/>

  <!-- Motion lines — frantic left-wing flapping -->
  <path d="M ${sc(30)},${sc(255)} Q ${sc(64)},${sc(244)} ${sc(76)},${sc(272)}" stroke="#F5A623" stroke-width="${sr(4.5)}" stroke-linecap="round" fill="none" opacity="0.55"/>
  <path d="M ${sc(20)},${sc(296)} Q ${sc(56)},${sc(290)} ${sc(68)},${sc(316)}" stroke="#F5A623" stroke-width="${sr(4)}" stroke-linecap="round" fill="none" opacity="0.4"/>
  <path d="M ${sc(36)},${sc(338)}" stroke="#F5A623" stroke-width="${sr(3)}" stroke-linecap="round" fill="none" opacity="0.25"/>

  <!-- Floating coins (scattered chaos) -->
  <!-- coin 1 -->
  <ellipse cx="${sc(148)}" cy="${sc(150)}" rx="${sr(18)}" ry="${sr(11)}" fill="#FFD700" transform="rotate(-30,${sc(148)},${sc(150)})"/>
  <ellipse cx="${sc(150)}" cy="${sc(150)}" rx="${sr(8)}" ry="${sr(11)}" fill="#F0B800" transform="rotate(-30,${sc(148)},${sc(150)})"/>
  <ellipse cx="${sc(144)}" cy="${sc(146)}" rx="${sr(5)}" ry="${sr(4)}" fill="rgba(255,255,255,0.3)" transform="rotate(-30,${sc(148)},${sc(150)})"/>
  <!-- coin 2 -->
  <ellipse cx="${sc(408)}" cy="${sc(168)}" rx="${sr(16)}" ry="${sr(10)}" fill="#FFD700" transform="rotate(22,${sc(408)},${sc(168)})"/>
  <ellipse cx="${sc(410)}" cy="${sc(168)}" rx="${sr(7)}" ry="${sr(10)}" fill="#F0B800" transform="rotate(22,${sc(408)},${sc(168)})"/>
  <!-- coin 3 -->
  <ellipse cx="${sc(78)}" cy="${sc(198)}" rx="${sr(13)}" ry="${sr(8.5)}" fill="#FFD700" transform="rotate(12,${sc(78)},${sc(198)})"/>
  <ellipse cx="${sc(80)}" cy="${sc(198)}" rx="${sr(5.5)}" ry="${sr(8.5)}" fill="#F0B800" transform="rotate(12,${sc(78)},${sc(198)})"/>
  <!-- coin 4 (small, near head) -->
  <ellipse cx="${sc(360)}" cy="${sc(50)}" rx="${sr(11)}" ry="${sr(7)}" fill="#FFD700" transform="rotate(-15,${sc(360)},${sc(50)})"/>
  <ellipse cx="${sc(362)}" cy="${sc(50)}" rx="${sr(4.5)}" ry="${sr(7)}" fill="#F0B800" transform="rotate(-15,${sc(360)},${sc(50)})"/>

  <!-- Left wing (flung high, chaotic) -->
  <ellipse cx="${sc(106)}" cy="${sc(290)}" rx="${sr(118)}" ry="${sr(55)}" fill="#D0D0D0" transform="rotate(-44,${sc(106)},${sc(290)})"/>
  <ellipse cx="${sc(106)}" cy="${sc(290)}" rx="${sr(96)}" ry="${sr(40)}" fill="#E4E4E4" transform="rotate(-44,${sc(106)},${sc(290)})"/>

  <!-- Right wing (angled down, holding bag) -->
  <ellipse cx="${sc(402)}" cy="${sc(322)}" rx="${sr(102)}" ry="${sr(50)}" fill="#D0D0D0" transform="rotate(36,${sc(402)},${sc(322)})"/>
  <ellipse cx="${sc(402)}" cy="${sc(322)}" rx="${sr(82)}" ry="${sr(36)}" fill="#E4E4E4" transform="rotate(36,${sc(402)},${sc(322)})"/>

  <!-- Loot bag (clutched against right side) -->
  <!-- string -->
  <path d="M ${sc(418)},${sc(308)} Q ${sc(416)},${sc(286)} ${sc(406)},${sc(272)}" stroke="#A85C00" stroke-width="${sr(8)}" stroke-linecap="round" fill="none"/>
  <!-- bag body -->
  <ellipse cx="${sc(418)}" cy="${sc(348)}" rx="${sr(42)}" ry="${sr(48)}" fill="#C87800"/>
  <ellipse cx="${sc(418)}" cy="${sc(348)}" rx="${sr(35)}" ry="${sr(41)}" fill="#E89A18"/>
  <!-- bag highlight -->
  <ellipse cx="${sc(404)}" cy="${sc(332)}" rx="${sr(12)}" ry="${sr(8)}" fill="rgba(255,255,255,0.22)" transform="rotate(-25,${sc(404)},${sc(332)})"/>
  <!-- X stitching -->
  <path d="M ${sc(398)},${sc(330)} L ${sc(438)},${sc(368)}" stroke="#A86000" stroke-width="${sr(3.5)}" stroke-linecap="round"/>
  <path d="M ${sc(438)},${sc(330)} L ${sc(398)},${sc(368)}" stroke="#A86000" stroke-width="${sr(3.5)}" stroke-linecap="round"/>
  <!-- spilling coins -->
  <ellipse cx="${sc(436)}" cy="${sc(386)}" rx="${sr(14)}" ry="${sr(9)}" fill="#FFD700"/>
  <ellipse cx="${sc(414)}" cy="${sc(393)}" rx="${sr(13)}" ry="${sr(8)}" fill="#FFD700"/>
  <ellipse cx="${sc(452)}" cy="${sc(370)}" rx="${sr(11)}" ry="${sr(7)}" fill="#FFD700"/>

  <!-- Body -->
  <ellipse cx="${sc(256)}" cy="${sc(356)}" rx="${sr(174)}" ry="${sr(144)}" fill="white"/>
  <ellipse cx="${sc(232)}" cy="${sc(372)}" rx="${sr(118)}" ry="${sr(98)}" fill="rgba(240,240,240,0.55)"/>

  <!-- Tail feathers -->
  <ellipse cx="${sc(250)}" cy="${sc(490)}" rx="${sr(62)}" ry="${sr(30)}" fill="#DADADA" transform="rotate(-8,${sc(250)},${sc(490)})"/>
  <ellipse cx="${sc(278)}" cy="${sc(482)}" rx="${sr(48)}" ry="${sr(25)}" fill="#CFCFCF" transform="rotate(13,${sc(278)},${sc(482)})"/>
  <ellipse cx="${sc(262)}" cy="${sc(498)}" rx="${sr(38)}" ry="${sr(19)}" fill="#E2E2E2" transform="rotate(2,${sc(262)},${sc(498)})"/>

  <!-- Neck -->
  <path d="
    M ${sc(218)},${sc(240)}
    Q ${sc(194)},${sc(206)} ${sc(207)},${sc(170)}
    Q ${sc(218)},${sc(136)} ${sc(256)},${sc(132)}
    Q ${sc(295)},${sc(128)} ${sc(306)},${sc(166)}
    Q ${sc(320)},${sc(204)} ${sc(294)},${sc(242)}
    Z
  " fill="white"/>

  <!-- Head -->
  <circle cx="${sc(256)}" cy="${sc(114)}" r="${sr(85)}" fill="white"/>
  <!-- head fluff tuft -->
  <ellipse cx="${sc(264)}" cy="${sc(37)}" rx="${sr(24)}" ry="${sr(18)}" fill="white" transform="rotate(-12,${sc(264)},${sc(37)})"/>

  <!-- ===== DETECTIVE HAT (group, tilted -14 deg) ===== -->
  <g transform="rotate(-14,${sc(256)},${sc(64)})">
    <!-- brim -->
    <ellipse cx="${sc(256)}" cy="${sc(64)}" rx="${sr(110)}" ry="${sr(18)}" fill="#1A0E06"/>
    <!-- brim highlight -->
    <ellipse cx="${sc(220)}" cy="${sc(60)}" rx="${sr(40)}" ry="${sr(8)}" fill="rgba(255,255,255,0.06)"/>
    <!-- crown -->
    <rect x="${sc(200)}" y="${sc(8)}" width="${sr(112)}" height="${sr(58)}" rx="${sr(20)}" fill="#1A0E06"/>
    <!-- crown highlight -->
    <rect x="${sc(216)}" y="${sc(12)}" width="${sr(32)}" height="${sr(24)}" rx="${sr(10)}" fill="rgba(255,255,255,0.07)"/>
    <!-- gold band -->
    <rect x="${sc(202)}" y="${sc(50)}" width="${sr(108)}" height="${sr(16)}" rx="${sr(6)}" fill="#F5A623"/>
    <!-- band shine -->
    <rect x="${sc(208)}" y="${sc(53)}" width="${sr(28)}" height="${sr(6)}" rx="${sr(3)}" fill="rgba(255,255,255,0.3)"/>
    <!-- hat feather (jaunty) -->
    <path d="M ${sc(295)},${sc(50)} Q ${sc(330)},${sc(10)} ${sc(320)},${sc(0)}" stroke="white" stroke-width="${sr(6)}" stroke-linecap="round" fill="none" opacity="0.7"/>
    <path d="M ${sc(295)},${sc(50)} Q ${sc(340)},${sc(18)} ${sc(334)},${sc(6)}" stroke="white" stroke-width="${sr(4)}" stroke-linecap="round" fill="none" opacity="0.45)"/>
  </g>

  <!-- ===== BEAK (wide open, screaming) ===== -->
  <!-- top beak -->
  <path d="M ${sc(308)},${sc(102)} Q ${sc(398)},${sc(84)} ${sc(390)},${sc(118)} Q ${sc(380)},${sc(140)} ${sc(308)},${sc(132)} Z" fill="#F5A623"/>
  <!-- top beak shade -->
  <path d="M ${sc(340)},${sc(102)} Q ${sc(390)},${sc(96)} ${sc(386)},${sc(112)}" stroke="#D88010" stroke-width="${sr(3)}" stroke-linecap="round" fill="none" opacity="0.6"/>
  <!-- top teeth (3 bumps) -->
  <circle cx="${sc(325)}" cy="${sc(134)}" r="${sr(5.5)}" fill="white"/>
  <circle cx="${sc(340)}" cy="${sc(136)}" r="${sr(5.5)}" fill="white"/>
  <circle cx="${sc(355)}" cy="${sc(136)}" r="${sr(5.5)}" fill="white"/>
  <!-- bottom beak (wide open) -->
  <path d="M ${sc(308)},${sc(132)} Q ${sc(382)},${sc(144)} ${sc(374)},${sc(178)} Q ${sc(362)},${sc(200)} ${sc(308)},${sc(172)} Z" fill="#E08010"/>
  <!-- throat (red) -->
  <path d="M ${sc(308)},${sc(132)} Q ${sc(376)},${sc(150)} ${sc(368)},${sc(168)} Q ${sc(346)},${sc(160)} ${sc(308)},${sc(146)} Z" fill="#CC2200"/>
  <!-- uvula -->
  <ellipse cx="${sc(326)}" cy="${sc(152)}" rx="${sr(7)}" ry="${sr(11)}" fill="#990000"/>
  <!-- tongue -->
  <path d="M ${sc(316)},${sc(168)} Q ${sc(350)},${sc(182)} ${sc(368)},${sc(174)} Q ${sc(358)},${sc(192)} ${sc(340)},${sc(188)} Q ${sc(318)},${sc(184)} ${sc(316)},${sc(168)} Z" fill="#FF6666"/>
  <!-- tongue shine -->
  <ellipse cx="${sc(346)}" cy="${sc(180)}" rx="${sr(10)}" ry="${sr(5)}" fill="rgba(255,200,200,0.4)"/>
  <!-- nostril -->
  <circle cx="${sc(366)}" cy="${sc(108)}" r="${sr(6)}" fill="#C07000"/>

  <!-- ===== EYES ===== -->
  <!-- main right eye (goose faces right — eye on left side of head) -->
  <circle cx="${sc(237)}" cy="${sc(97)}" r="${sr(30)}" fill="#0D0D0D"/>
  <!-- sclera -->
  <circle cx="${sc(237)}" cy="${sc(97)}" r="${sr(21)}" fill="white"/>
  <!-- iris (pale blue — unhinged) -->
  <circle cx="${sc(235)}" cy="${sc(95)}" r="${sr(14)}" fill="#5BC8FF"/>
  <!-- iris ring -->
  <circle cx="${sc(235)}" cy="${sc(95)}" r="${sr(14)}" fill="none" stroke="#3AA8E0" stroke-width="${sr(2)}"/>
  <!-- pupil (offset upward — looking crazily) -->
  <circle cx="${sc(232)}" cy="${sc(90)}" r="${sr(8.5)}" fill="#050505"/>
  <!-- main highlight -->
  <circle cx="${sc(224)}" cy="${sc(84)}" r="${sr(6)}" fill="white"/>
  <!-- secondary highlight -->
  <circle cx="${sc(242)}" cy="${sc(104)}" r="${sr(2.5)}" fill="rgba(255,255,255,0.65)"/>

  <!-- second eye (peeks from other side, smaller, also unhinged) -->
  <circle cx="${sc(291)}" cy="${sc(104)}" r="${sr(19)}" fill="#0D0D0D"/>
  <circle cx="${sc(291)}" cy="${sc(104)}" r="${sr(13)}" fill="white"/>
  <circle cx="${sc(293)}" cy="${sc(102)}" r="${sr(8)}" fill="#5BC8FF"/>
  <circle cx="${sc(295)}" cy="${sc(99)}" r="${sr(5)}" fill="#050505"/>
  <circle cx="${sc(289)}" cy="${sc(96)}" r="${sr(3.5)}" fill="white"/>

  <!-- wild single eyebrow (raised in panic) -->
  <path d="M ${sc(208)},${sc(65)} Q ${sc(237)},${sc(52)} ${sc(268)},${sc(60)}" stroke="#888" stroke-width="${sr(6.5)}" stroke-linecap="round" fill="none"/>

  <!-- anime blush marks -->
  <ellipse cx="${sc(212)}" cy="${sc(130)}" rx="${sr(22)}" ry="${sr(12)}" fill="rgba(255,100,100,0.2)"/>
  <ellipse cx="${sc(204)}" cy="${sc(128)}" rx="${sr(10)}" ry="${sr(7)}" fill="rgba(255,120,120,0.15)"/>

  <!-- ===== LEGS (splayed running pose) ===== -->
  <rect x="${sc(204)}" y="${sc(472)}" width="${sr(30)}" height="${sr(52)}" rx="${sr(9)}" fill="#F5A623" transform="rotate(6,${sc(219)},${sc(472)})"/>
  <ellipse cx="${sc(178)}" cy="${sc(530)}" rx="${sr(23)}" ry="${sr(10)}" transform="rotate(-28,${sc(178)},${sc(530)})" fill="#F5A623"/>
  <ellipse cx="${sc(213)}" cy="${sc(536)}" rx="${sr(26)}" ry="${sr(10)}" fill="#F5A623"/>
  <ellipse cx="${sc(248)}" cy="${sc(528)}" rx="${sr(21)}" ry="${sr(10)}" transform="rotate(24,${sc(248)},${sc(528)})" fill="#F5A623"/>

  <rect x="${sc(277)}" y="${sc(472)}" width="${sr(30)}" height="${sr(50)}" rx="${sr(9)}" fill="#F5A623" transform="rotate(-9,${sc(292)},${sc(472)})"/>
  <ellipse cx="${sc(255)}" cy="${sc(526)}" rx="${sr(22)}" ry="${sr(10)}" transform="rotate(-24,${sc(255)},${sc(526)})" fill="#F5A623"/>
  <ellipse cx="${sc(290)}" cy="${sc(532)}" rx="${sr(25)}" ry="${sr(10)}" fill="#F5A623"/>
  <ellipse cx="${sc(324)}" cy="${sc(524)}" rx="${sr(21)}" ry="${sr(10)}" transform="rotate(28,${sc(324)},${sc(524)})" fill="#F5A623"/>

  <!-- ===== GOLD LOOT AURA (three rings + sparkles) ===== -->
  <circle cx="${sc(256)}" cy="${sc(114)}" r="${sr(100)}" fill="none" stroke="#F5A623" stroke-width="${sr(5)}" opacity="0.42"/>
  <circle cx="${sc(256)}" cy="${sc(114)}" r="${sr(114)}" fill="none" stroke="#F5A623" stroke-width="${sr(2.5)}" opacity="0.22"/>
  <circle cx="${sc(256)}" cy="${sc(114)}" r="${sr(128)}" fill="none" stroke="#F5A623" stroke-width="${sr(1.5)}" opacity="0.1"/>
  <!-- sparkle dots on aura -->
  <circle cx="${sc(174)}" cy="${sc(46)}" r="${sr(5.5)}" fill="#F5A623" opacity="0.65"/>
  <circle cx="${sc(344)}" cy="${sc(38)}" r="${sr(4.5)}" fill="#F5A623" opacity="0.55"/>
  <circle cx="${sc(146)}" cy="${sc(126)}" r="${sr(4.5)}" fill="#F5A623" opacity="0.6"/>
  <circle cx="${sc(370)}" cy="${sc(118)}" r="${sr(4)}" fill="#F5A623" opacity="0.55"/>
  <circle cx="${sc(258)}" cy="${sc(16)}" r="${sr(3.5)}" fill="#F5A623" opacity="0.5"/>

</svg>`;
};

// Splash screen SVG (full composition with goose + text)
const splashSVG = (w, h) => {
  const gooseSize = Math.min(w, h) * 0.52;
  const gx = (w - gooseSize) / 2;
  const gy = h * 0.1;

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${w}" height="${h}" fill="#0D1117"/>
  <!-- Stars in background -->
  <circle cx="${w * 0.1}" cy="${h * 0.08}" r="3" fill="rgba(255,255,255,0.15)"/>
  <circle cx="${w * 0.88}" cy="${h * 0.06}" r="2.5" fill="rgba(255,255,255,0.12)"/>
  <circle cx="${w * 0.05}" cy="${h * 0.55}" r="2" fill="rgba(255,255,255,0.1)"/>
  <circle cx="${w * 0.94}" cy="${h * 0.52}" r="3" fill="rgba(255,255,255,0.1)"/>
  <!-- Goose -->
  <image href="data:image/svg+xml;base64,${Buffer.from(gooseSVG(512, false)).toString('base64')}"
    x="${gx}" y="${gy}" width="${gooseSize}" height="${gooseSize}"/>
  <!-- HONK speech bubble -->
  <rect x="${w * 0.62}" y="${gy + gooseSize * 0.05}" width="${w * 0.28}" height="${h * 0.072}" rx="${h * 0.018}" fill="#F5A623"/>
  <text x="${w * 0.76}" y="${gy + gooseSize * 0.05 + h * 0.048}" text-anchor="middle"
    font-family="Arial Black, Arial, sans-serif" font-weight="900"
    font-size="${Math.round(h * 0.036)}" fill="#000">HONK!</text>
  <!-- bubble tail pointing left toward beak -->
  <polygon points="${w * 0.62},${gy + gooseSize * 0.08 + h * 0.014} ${w * 0.57},${gy + gooseSize * 0.1} ${w * 0.62},${gy + gooseSize * 0.1 + h * 0.018}" fill="#F5A623"/>
  <!-- App name -->
  <text x="${w / 2}" y="${gy + gooseSize + 58}" text-anchor="middle"
    font-family="Arial Black, Arial, sans-serif" font-weight="900"
    font-size="${Math.round(w * 0.11)}" fill="#F5A623" letter-spacing="2">LOOT GOOSE</text>
  <!-- Tagline -->
  <text x="${w / 2}" y="${gy + gooseSize + 112}" text-anchor="middle"
    font-family="Arial, sans-serif" font-weight="600"
    font-size="${Math.round(w * 0.042)}" fill="#8B949E">HONK if you found it</text>
</svg>`;
};

async function generate() {
  console.log('Generating Loot Goose assets...');

  await sharp(Buffer.from(gooseSVG(1024))).png().toFile('assets/icon.png');
  console.log('✓ assets/icon.png');

  await sharp(Buffer.from(gooseSVG(1024, false))).png().toFile('assets/adaptive-icon.png');
  console.log('✓ assets/adaptive-icon.png');

  await sharp(Buffer.from(splashSVG(1284, 2778))).png().toFile('assets/splash-icon.png');
  console.log('✓ assets/splash-icon.png');

  await sharp(Buffer.from(gooseSVG(196))).png().toFile('assets/favicon.png');
  console.log('✓ assets/favicon.png');

  console.log('\nDone! All assets generated.');
}

generate().catch((e) => { console.error(e); process.exit(1); });
