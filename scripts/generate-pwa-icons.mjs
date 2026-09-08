import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

function crc32(buf) {
  let table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  let crc = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(12 + len);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, "ascii");
  data.copy(buf, 8);
  const crc = crc32(Buffer.concat([Buffer.from(type, "ascii"), data]));
  buf.writeUInt32BE(crc >>> 0, 8 + len);
  return buf;
}

function createPNG(width, height, getPixel) {
  const rowSize = width * 4 + 1;
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    raw[rowOffset] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y);
      const pxOffset = rowOffset + 1 + x * 4;
      raw[pxOffset] = r;
      raw[pxOffset + 1] = g;
      raw[pxOffset + 2] = b;
      raw[pxOffset + 3] = a;
    }
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    header,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Distance to rounded rectangle
function sdRoundedBox(px, py, bx, by, r) {
  const qx = Math.abs(px) - bx + r;
  const qy = Math.abs(py) - by + r;
  const distOutside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const distInside = Math.min(Math.max(qx, qy), 0);
  return distOutside + distInside - r;
}

// Distance to line segment
function sdSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax, pay = py - ay;
  const bax = bx - ax, bay = by - ay;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  return Math.hypot(pax - bax * h, pay - bay * h);
}

// Draw TypeReact TR logo glyphs using signed distance fields
function trDistance(px, py, scale) {
  // Center is (0, 0), normalized roughly -100 to +100
  const x = px / scale;
  const y = py / scale;

  // 'T' letter:
  // Top bar: center at (-34, -30), width 56 (half-width 28), height 14 (half-height 7)
  const dTopBarT = sdRoundedBox(x - (-34), y - (-32), 26, 7, 3);
  // Stem: center at (-34, 10), width 14 (half-width 7), height 68 (half-height 34)
  const dStemT = sdRoundedBox(x - (-34), y - (10), 7, 35, 3);
  const dT = Math.min(dTopBarT, dStemT);

  // 'R' letter:
  // Stem: center at (14, 0), width 14 (half-width 7), height 80 (half-height 40)
  const dStemR = sdRoundedBox(x - (14), y - (0), 7, 39, 3);
  
  // Upper loop of R: outer arc box minus inner cutout
  const dLoopROuter = sdRoundedBox(x - (34), y - (-20), 25, 19, 12);
  const dLoopRInner = sdRoundedBox(x - (34), y - (-20), 12, 6, 4);
  const dLoopR = Math.max(dLoopROuter, -dLoopRInner);

  // Middle bar connection
  const dMidR = sdRoundedBox(x - (28), y - (-2), 16, 6, 2);

  // Diagonal leg of R: segment from (24, 2) to (52, 38) with thickness
  const dLegR = sdSegment(x, y, 24, 0, 52, 38) - 7.5;

  const dR = Math.min(dStemR, dLoopR, dMidR, dLegR);

  // Accent badge/spark dot above top right
  const dDot = Math.hypot(x - 52, y - (-35)) - 7;

  return Math.min(dT, dR, dDot) * scale;
}

function renderPwaIcon(size, isMaskable = false) {
  const width = size;
  const height = size;
  const cx = width / 2;
  const cy = height / 2;

  // Maskable icons need content within central 80% (safe zone = 0.8)
  const scale = isMaskable ? (size / 280) * 0.75 : (size / 280) * 0.95;
  const cornerRadius = isMaskable ? 0 : size * 0.22; // smooth squirclish corner for standard

  return createPNG(width, height, (x, y) => {
    const px = x - cx;
    const py = y - cy;

    // Background shape
    let bgDist = 0;
    if (isMaskable) {
      bgDist = -1; // full bleed
    } else {
      bgDist = sdRoundedBox(px, py, width * 0.48, height * 0.48, cornerRadius);
    }

    if (bgDist > 1) {
      return [0, 0, 0, 0]; // outside
    }

    // Gradient background: from bright vermilion #FF5500 to deep #D03500
    const gradT = Math.max(0, Math.min(1, (x + y) / (width + height)));
    // Base colors
    // Start: [255, 87, 34] (#FF5722)
    // End:   [210, 48, 0]  (#D23000)
    let r = Math.round(255 - gradT * 45);
    let g = Math.round(87 - gradT * 39);
    let b = Math.round(34 - gradT * 34);

    // Subtle dark gradient vignette / edge contrast
    const distFromCenter = Math.hypot(px, py) / (size * 0.5);
    const vignette = Math.max(0, 1 - distFromCenter * 0.3);

    r = Math.round(r * vignette);
    g = Math.round(g * vignette);
    b = Math.round(b * vignette);

    // Render White TR Emblem with anti-aliasing
    const glyphDist = trDistance(px, py + (isMaskable ? 0 : size * 0.01), scale);
    
    // Sub-pixel anti-aliasing edge
    const aa = 1.2;
    let glyphAlpha = 0;
    if (glyphDist < -aa) {
      glyphAlpha = 1;
    } else if (glyphDist < aa) {
      glyphAlpha = (aa - glyphDist) / (2 * aa);
    }

    // Ambient shadow under emblem
    const shadowDist = trDistance(px, py - (size * 0.02), scale);
    let shadowAlpha = 0;
    if (shadowDist < 4 * aa) {
      shadowAlpha = Math.max(0, (4 * aa - shadowDist) / (8 * aa)) * 0.35;
    }

    // Apply shadow first
    r = Math.round(r * (1 - shadowAlpha * 0.5));
    g = Math.round(g * (1 - shadowAlpha * 0.5));
    b = Math.round(b * (1 - shadowAlpha * 0.5));

    // Blend white glyph on top
    const whiteR = 255;
    const whiteG = 255;
    const whiteB = 255;

    r = Math.round(r * (1 - glyphAlpha) + whiteR * glyphAlpha);
    g = Math.round(g * (1 - glyphAlpha) + whiteG * glyphAlpha);
    b = Math.round(b * (1 - glyphAlpha) + whiteB * glyphAlpha);

    // Corner anti-aliasing for non-maskable
    let cornerAlpha = 1;
    if (!isMaskable) {
      if (bgDist > -aa) {
        cornerAlpha = Math.max(0, Math.min(1, (aa - bgDist) / (2 * aa)));
      }
    }

    return [r, g, b, Math.round(255 * cornerAlpha)];
  });
}

function generateSvgIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF5A1F" />
      <stop offset="100%" stop-color="#D03500" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-opacity="0.25" />
    </filter>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)" />
  <g filter="url(#shadow)" fill="#FFFFFF">
    <!-- T -->
    <path d="M110 135 H226 C230 135 233 138 233 142 V162 C233 166 230 169 226 169 H182 V360 C182 364 179 367 175 367 H153 C149 367 146 364 146 360 V169 H110 C106 169 103 166 103 162 V142 C103 138 106 135 110 135 Z" />
    <!-- R -->
    <path d="M260 139 C260 136 262 135 265 135 H340 C378 135 405 160 405 198 C405 232 382 254 350 259 L405 358 C407 362 405 367 400 367 H370 C366 367 363 365 360 360 L312 268 H296 V360 C296 364 293 367 289 367 H267 C263 367 260 364 260 360 V139 Z M296 169 V234 H336 C358 234 371 221 371 201 C371 181 358 169 336 169 H296 Z" />
    <!-- Evidence Spark Dot -->
    <circle cx="395" cy="115" r="18" fill="#FFFFFF" />
  </g>
</svg>`;
}

const iconsDir = path.resolve("public/icons");
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate sizes
const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];

for (const size of sizes) {
  console.log(`Generating icon-${size}x${size}.png...`);
  const png = renderPwaIcon(size, false);
  fs.writeFileSync(path.join(iconsDir, `icon-${size}x${size}.png`), png);
}

// Generate maskable icons
console.log("Generating maskable icons...");
fs.writeFileSync(path.join(iconsDir, "icon-maskable-192x192.png"), renderPwaIcon(192, true));
fs.writeFileSync(path.join(iconsDir, "icon-maskable-512x512.png"), renderPwaIcon(512, true));

// Apple touch icon in root and icons folder
console.log("Generating apple-touch-icon.png...");
const appleIcon = renderPwaIcon(180, false);
fs.writeFileSync(path.resolve("public/apple-touch-icon.png"), appleIcon);
fs.writeFileSync(path.resolve("public/apple-touch-icon-precomposed.png"), appleIcon);
fs.writeFileSync(path.join(iconsDir, "apple-touch-icon.png"), appleIcon);

// SVG Icon
console.log("Generating icon.svg...");
fs.writeFileSync(path.join(iconsDir, "icon.svg"), generateSvgIcon());
fs.writeFileSync(path.resolve("public/icon.svg"), generateSvgIcon());

// Standard favicon-32x32 and favicon-16x16
fs.writeFileSync(path.join(iconsDir, "favicon-32x32.png"), renderPwaIcon(32, false));
fs.writeFileSync(path.join(iconsDir, "favicon-16x16.png"), renderPwaIcon(16, false));

console.log("PWA Icons generated successfully!");
