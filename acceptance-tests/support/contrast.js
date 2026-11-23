'use strict';

// Pure pixel and contrast math for the glass measurements: PNG decoding,
// rectangle sampling, and WCAG contrast. Nothing here knows about the app,
// Playwright, or waiting — buffers and rectangles in, numbers out.
//
// Why a hand-rolled PNG decoder: no image library is installed in this
// project, and a clipped Playwright screenshot re-renders its sub-rect
// WITHOUT the backdrop-filter — it measures a page that is not the one on
// screen. The measurement therefore takes one full-viewport screenshot and
// samples it here: zlib.inflateSync the IDAT stream, undo the per-scanline
// filters, and read pixels exactly as the compositor drew them.

const zlib = require('node:zlib');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// --- PNG decoding ---------------------------------------------------------

const CHANNELS = {
  0: 1, // grayscale
  2: 3, // rgb
  3: 1, // palette (index; needs PLTE)
  4: 2, // grayscale + alpha
  6: 4, // rgba
};

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

// Undoes one scanline's filter in place (PNG spec §9.2). `bpp` is bytes per
// pixel (not bits): bit depth 8 only, which is what the browser writes.
function unfilterScanline(filter, line, previous, bpp) {
  for (let i = 0; i < line.length; i += 1) {
    const left = i >= bpp ? line[i - bpp] : 0;
    const up = previous ? previous[i] : 0;
    const upLeft = previous && i >= bpp ? previous[i - bpp] : 0;
    switch (filter) {
      case 0: // none
        break;
      case 1: // sub
        line[i] = (line[i] + left) & 0xff;
        break;
      case 2: // up
        line[i] = (line[i] + up) & 0xff;
        break;
      case 3: // average
        line[i] = (line[i] + Math.floor((left + up) / 2)) & 0xff;
        break;
      case 4: // paeth
        line[i] = (line[i] + paeth(left, up, upLeft)) & 0xff;
        break;
      default:
        throw new Error(`PNG decode: unknown scanline filter ${filter}`);
    }
  }
}

// Decodes an 8-bit, non-interlaced PNG into { width, height, data } where
// data is RGBA, one byte per channel, row-major. Alpha defaults to 255 for
// the colour types that do not carry it.
function decodePng(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('PNG decode: buffer is not a PNG');
  }

  let offset = 8;
  let header = null;
  const idat = [];
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') header = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    offset += 12 + length; // length + type + data + crc
  }
  if (!header) throw new Error('PNG decode: no IHDR chunk');
  if (idat.length === 0) throw new Error('PNG decode: no IDAT chunk');

  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const bitDepth = header[8];
  const colorType = header[9];
  const interlace = header[12];
  if (bitDepth !== 8) {
    throw new Error(`PNG decode: only 8-bit PNGs are supported, got ${bitDepth}`);
  }
  if (interlace !== 0) {
    throw new Error('PNG decode: interlaced PNGs are not supported');
  }
  const channels = CHANNELS[colorType];
  if (!channels || colorType === 3) {
    throw new Error(`PNG decode: unsupported colour type ${colorType}`);
  }

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const data = Buffer.alloc(width * height * 4, 0xff);
  let previous = null;

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    const filter = raw[rowStart];
    const line = Buffer.from(raw.subarray(rowStart + 1, rowStart + 1 + stride));
    unfilterScanline(filter, line, previous, channels);
    previous = line;

    // Expand to RGBA.
    for (let x = 0; x < width; x += 1) {
      const src = x * channels;
      const dst = (y * width + x) * 4;
      if (colorType === 0) {
        data[dst] = line[src];
        data[dst + 1] = line[src];
        data[dst + 2] = line[src];
        data[dst + 3] = 0xff;
      } else if (colorType === 4) {
        data[dst] = line[src];
        data[dst + 1] = line[src];
        data[dst + 2] = line[src];
        data[dst + 3] = line[src + 1];
      } else if (colorType === 2) {
        data[dst] = line[src];
        data[dst + 1] = line[src + 1];
        data[dst + 2] = line[src + 2];
        data[dst + 3] = 0xff;
      } else {
        data[dst] = line[src];
        data[dst + 1] = line[src + 1];
        data[dst + 2] = line[src + 2];
        data[dst + 3] = line[src + 3];
      }
    }
  }

  return { width, height, data };
}

// --- rectangles -----------------------------------------------------------

// A CSS-pixel box { x, y, width, height } (Playwright's boundingBox shape)
// to whole device pixels at `scale`, clamped to the image. The left/top
// edges floor, the right/bottom ceil: a 1px rule at a fractional position
// must never round to nothing.
function boxToPixels(box, scale, image) {
  const left = Math.max(0, Math.floor(box.x * scale));
  const top = Math.max(0, Math.floor(box.y * scale));
  const right = Math.min(image.width, Math.ceil((box.x + box.width) * scale));
  const bottom = Math.min(image.height, Math.ceil((box.y + box.height) * scale));
  return { left, top, right, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

function rectContains(rect, x, y) {
  return x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom;
}

function eachPixel(image, rect, visit) {
  const { left, right, top, bottom } = rect;
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const i = (y * image.width + x) * 4;
      visit(x, y, image.data[i], image.data[i + 1], image.data[i + 2], image.data[i + 3]);
    }
  }
}

function pixelAt(image, x, y) {
  const i = (y * image.width + x) * 4;
  return [image.data[i], image.data[i + 1], image.data[i + 2], image.data[i + 3]];
}

// The surface behind text: the per-channel median pixel of its own box.
// Glyphs cover well under half the box, so the median is the background,
// not the ink — and it is a pixel the compositor actually drew, composite
// and all.
function medianColour(image, rect) {
  if (rect.width === 0 || rect.height === 0) return null;
  const values = [[], [], []];
  eachPixel(image, rect, (x, y, r, g, b) => {
    values[0].push(r);
    values[1].push(g);
    values[2].push(b);
  });
  const median = values.map((channel) => {
    channel.sort((a, b) => a - b);
    return channel[Math.floor(channel.length / 2)];
  });
  return [median[0], median[1], median[2], 255];
}

// The ink: the darkest pixel in the box by WCAG luminance. Antialiasing
// only lightens toward the surface, so the darkest pixel is the ink the
// browser painted.
function darkestPixel(image, rect, { exclude = [] } = {}) {
  let best = null;
  eachPixel(image, rect, (x, y, r, g, b, a) => {
    if (a === 0) return;
    for (let i = 0; i < exclude.length; i += 1) {
      if (rectContains(exclude[i], x, y)) return;
    }
    const luminance = relativeLuminance([r, g, b]);
    if (best === null || luminance < best.luminance) {
      best = { colour: [r, g, b, a], luminance, x, y };
    }
  });
  return best;
}

// --- WCAG ----------------------------------------------------------------

function linearise(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([r, g, b]) {
  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b);
}

function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

// --- CSS colours ----------------------------------------------------------

function hexTriplet(value) {
  const hex = value.replace(/^#/, '');
  if (hex.length === 3) {
    return hex.split('').map((digit) => parseInt(digit + digit, 16));
  }
  if (hex.length === 6) {
    return [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)].map((pair) => parseInt(pair, 16));
  }
  return null;
}

// Parses what getComputedStyle and the stylesheet text actually produce:
// rgb()/rgba(), #rgb/#rrggbb, and the two system colours forced colours
// resolves to in Chromium's emulation. Returns [r, g, b, a] with alpha in
// 0..1, or null when the value is not a colour.
function parseCssColour(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();
  if (text === 'canvas') return [255, 255, 255, 1];
  if (text === 'canvastext') return [0, 0, 0, 1];
  if (text.startsWith('#')) {
    const rgb = hexTriplet(text);
    return rgb ? [...rgb, 1] : null;
  }
  const match = text.match(/^rgba?\(([^)]+)\)$/);
  if (!match) return null;
  const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;
  return [parts[0], parts[1], parts[2], parts.length >= 4 ? parts[3] : 1];
}

// A translucent colour as the browser paints it over its surface: the
// token's own alpha applied to the backdrop.
function compositeOver(foreground, background) {
  const alpha = foreground.length >= 4 ? foreground[3] : 1;
  const base = background.length >= 4 ? background[3] : 1;
  const channels = [0, 1, 2].map((i) =>
    Math.round(foreground[i] * alpha + background[i] * (1 - alpha))
  );
  return [...channels, base];
}

function formatColour(colour) {
  if (!colour) return '(none)';
  const [r, g, b, a = 1] = colour;
  return a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
}

function formatRatio(ratio) {
  return `${ratio.toFixed(2)}:1`;
}

module.exports = {
  decodePng,
  boxToPixels,
  pixelAt,
  medianColour,
  darkestPixel,
  relativeLuminance,
  contrastRatio,
  parseCssColour,
  compositeOver,
  formatColour,
  formatRatio,
};
