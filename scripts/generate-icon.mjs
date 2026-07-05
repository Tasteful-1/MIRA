import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUTPUT_DIR = path.resolve("build");
const ICON_PATH = path.join(OUTPUT_DIR, "icon.ico");
const PNG_PLACEHOLDER_PATH = path.join(OUTPUT_DIR, "icon-source.txt");
const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256];
const BACKGROUND = [17, 17, 17, 255];
const LINE = [244, 244, 245, 255];
const ACCENT = [245, 158, 11, 255];

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(ICON_PATH, buildIco(ICON_SIZES));
await writeFile(PNG_PLACEHOLDER_PATH, "Source artwork: build/icon.svg\nGenerated Windows icon: build/icon.ico\n");

function buildIco(sizes) {
  const images = sizes.map((size) => ({ size, data: buildDib(size) }));
  const headerSize = 6 + images.length * 16;
  const fileSize = headerSize + images.reduce((sum, image) => sum + image.data.length, 0);
  const buffer = Buffer.alloc(fileSize);
  let offset = 0;

  buffer.writeUInt16LE(0, offset);
  offset += 2;
  buffer.writeUInt16LE(1, offset);
  offset += 2;
  buffer.writeUInt16LE(images.length, offset);
  offset += 2;

  let imageOffset = headerSize;

  for (const image of images) {
    buffer.writeUInt8(image.size === 256 ? 0 : image.size, offset);
    buffer.writeUInt8(image.size === 256 ? 0 : image.size, offset + 1);
    buffer.writeUInt8(0, offset + 2);
    buffer.writeUInt8(0, offset + 3);
    buffer.writeUInt16LE(1, offset + 4);
    buffer.writeUInt16LE(32, offset + 6);
    buffer.writeUInt32LE(image.data.length, offset + 8);
    buffer.writeUInt32LE(imageOffset, offset + 12);
    offset += 16;
    image.data.copy(buffer, imageOffset);
    imageOffset += image.data.length;
  }

  return buffer;
}

function buildDib(size) {
  const pixels = new Uint8ClampedArray(size * size * 4);
  fillTransparent(pixels);
  drawRoundedSquare(pixels, size);
  drawMaze(pixels, size);

  const dibHeaderSize = 40;
  const xorBytes = size * size * 4;
  const andStride = Math.ceil(size / 32) * 4;
  const andBytes = andStride * size;
  const buffer = Buffer.alloc(dibHeaderSize + xorBytes + andBytes);

  buffer.writeUInt32LE(dibHeaderSize, 0);
  buffer.writeInt32LE(size, 4);
  buffer.writeInt32LE(size * 2, 8);
  buffer.writeUInt16LE(1, 12);
  buffer.writeUInt16LE(32, 14);
  buffer.writeUInt32LE(0, 16);
  buffer.writeUInt32LE(xorBytes + andBytes, 20);
  buffer.writeInt32LE(2835, 24);
  buffer.writeInt32LE(2835, 28);

  let offset = dibHeaderSize;

  for (let y = size - 1; y >= 0; y -= 1) {
    for (let x = 0; x < size; x += 1) {
      const pixelOffset = (y * size + x) * 4;
      buffer.writeUInt8(pixels[pixelOffset + 2], offset);
      buffer.writeUInt8(pixels[pixelOffset + 1], offset + 1);
      buffer.writeUInt8(pixels[pixelOffset], offset + 2);
      buffer.writeUInt8(pixels[pixelOffset + 3], offset + 3);
      offset += 4;
    }
  }

  return buffer;
}

function fillTransparent(pixels) {
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index + 3] = 0;
  }
}

function drawRoundedSquare(pixels, size) {
  const radius = size * 0.1875;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (isInsideRoundedRect(x + 0.5, y + 0.5, size, radius)) {
        setPixel(pixels, size, x, y, BACKGROUND);
      }
    }
  }
}

function drawMaze(pixels, size) {
  const whiteWidth = Math.max(2, size * 0.055);
  const accentWidth = Math.max(1.5, size * 0.031);
  const points = {
    a: [0.25, 0.281],
    b: [0.5, 0.281],
    c: [0.5, 0.438],
    d: [0.719, 0.438],
    e: [0.25, 0.563],
    f: [0.406, 0.563],
    g: [0.406, 0.719],
    h: [0.688, 0.719],
    i: [0.594, 0.281],
    j: [0.594, 0.563],
    k: [0.438, 0.563],
  };

  drawPolyline(pixels, size, [points.a, points.b, points.c, points.d], whiteWidth, LINE);
  drawPolyline(pixels, size, [points.e, points.f, points.g, points.h], whiteWidth, LINE);
  drawPolyline(pixels, size, [points.i, points.j, points.k], whiteWidth, LINE);
  drawPolyline(pixels, size, [points.a, points.b, points.c, points.d], accentWidth, ACCENT);
  drawCircle(pixels, size, points.d[0] * size, points.d[1] * size, size * 0.078, ACCENT);
  drawCircle(pixels, size, points.d[0] * size, points.d[1] * size, size * 0.031, BACKGROUND);
}

function drawPolyline(pixels, size, points, width, color) {
  for (let index = 0; index < points.length - 1; index += 1) {
    drawLine(pixels, size, points[index], points[index + 1], width, color);
  }
}

function drawLine(pixels, size, start, end, width, color) {
  const startX = start[0] * size;
  const startY = start[1] * size;
  const endX = end[0] * size;
  const endY = end[1] * size;
  const minX = Math.floor(Math.min(startX, endX) - width);
  const maxX = Math.ceil(Math.max(startX, endX) + width);
  const minY = Math.floor(Math.min(startY, endY) - width);
  const maxY = Math.ceil(Math.max(startY, endY) + width);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const distance = distanceToSegment(x + 0.5, y + 0.5, startX, startY, endX, endY);

      if (distance <= width / 2) {
        setPixel(pixels, size, x, y, color);
      }
    }
  }
}

function drawCircle(pixels, size, centerX, centerY, radius, color) {
  const minX = Math.floor(centerX - radius);
  const maxX = Math.ceil(centerX + radius);
  const minY = Math.floor(centerY - radius);
  const maxY = Math.ceil(centerY + radius);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const distance = Math.hypot(x + 0.5 - centerX, y + 0.5 - centerY);

      if (distance <= radius) {
        setPixel(pixels, size, x, y, color);
      }
    }
  }
}

function setPixel(pixels, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) {
    return;
  }

  const offset = (y * size + x) * 4;
  pixels[offset] = color[0];
  pixels[offset + 1] = color[1];
  pixels[offset + 2] = color[2];
  pixels[offset + 3] = color[3];
}

function isInsideRoundedRect(x, y, size, radius) {
  const innerMin = radius;
  const innerMax = size - radius;
  const closestX = Math.min(innerMax, Math.max(innerMin, x));
  const closestY = Math.min(innerMax, Math.max(innerMin, y));

  return Math.hypot(x - closestX, y - closestY) <= radius;
}

function distanceToSegment(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const position = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
  const projectionX = x1 + position * dx;
  const projectionY = y1 + position * dy;

  return Math.hypot(x - projectionX, y - projectionY);
}
