import type { EventSummary, MapSummary } from "../shared/types";

type Point = [number, number];
type AutotileShape = [Point, Point, Point, Point];
export interface CharacterFrame {
  sx: number;
  sy: number;
  width: number;
  height: number;
}

const TILE_ID_A5 = 1536;
const TILE_ID_A1 = 2048;
const TILE_ID_A2 = 2816;
const TILE_ID_A3 = 4352;
const TILE_ID_A4 = 5888;
const TILE_ID_MAX = 8192;

const FLOOR_AUTOTILE_TABLE: AutotileShape[] = [
  [[2, 4], [1, 4], [2, 3], [1, 3]],
  [[2, 0], [1, 4], [2, 3], [1, 3]],
  [[2, 4], [3, 0], [2, 3], [1, 3]],
  [[2, 0], [3, 0], [2, 3], [1, 3]],
  [[2, 4], [1, 4], [2, 3], [3, 1]],
  [[2, 0], [1, 4], [2, 3], [3, 1]],
  [[2, 4], [3, 0], [2, 3], [3, 1]],
  [[2, 0], [3, 0], [2, 3], [3, 1]],
  [[2, 4], [1, 4], [2, 1], [1, 3]],
  [[2, 0], [1, 4], [2, 1], [1, 3]],
  [[2, 4], [3, 0], [2, 1], [1, 3]],
  [[2, 0], [3, 0], [2, 1], [1, 3]],
  [[2, 4], [1, 4], [2, 1], [3, 1]],
  [[2, 0], [1, 4], [2, 1], [3, 1]],
  [[2, 4], [3, 0], [2, 1], [3, 1]],
  [[2, 0], [3, 0], [2, 1], [3, 1]],
  [[0, 4], [1, 4], [0, 3], [1, 3]],
  [[0, 4], [3, 0], [0, 3], [1, 3]],
  [[0, 4], [1, 4], [0, 3], [3, 1]],
  [[0, 4], [3, 0], [0, 3], [3, 1]],
  [[2, 2], [1, 2], [2, 3], [1, 3]],
  [[2, 2], [1, 2], [2, 3], [3, 1]],
  [[2, 2], [1, 2], [2, 1], [1, 3]],
  [[2, 2], [1, 2], [2, 1], [3, 1]],
  [[2, 4], [3, 4], [2, 3], [3, 3]],
  [[2, 4], [3, 4], [2, 1], [3, 3]],
  [[2, 0], [3, 4], [2, 3], [3, 3]],
  [[2, 0], [3, 4], [2, 1], [3, 3]],
  [[2, 4], [1, 4], [2, 5], [1, 5]],
  [[2, 0], [1, 4], [2, 5], [1, 5]],
  [[2, 4], [3, 0], [2, 5], [1, 5]],
  [[2, 0], [3, 0], [2, 5], [1, 5]],
  [[0, 4], [3, 4], [0, 3], [3, 3]],
  [[2, 2], [1, 2], [2, 5], [1, 5]],
  [[0, 2], [1, 2], [0, 3], [1, 3]],
  [[0, 2], [1, 2], [0, 3], [3, 1]],
  [[2, 2], [3, 2], [2, 3], [3, 3]],
  [[2, 2], [3, 2], [2, 1], [3, 3]],
  [[2, 4], [3, 4], [2, 5], [3, 5]],
  [[2, 0], [3, 4], [2, 5], [3, 5]],
  [[0, 4], [1, 4], [0, 5], [1, 5]],
  [[0, 4], [3, 0], [0, 5], [1, 5]],
  [[0, 2], [3, 2], [0, 3], [3, 3]],
  [[0, 2], [1, 2], [0, 5], [1, 5]],
  [[0, 4], [3, 4], [0, 5], [3, 5]],
  [[2, 2], [3, 2], [2, 5], [3, 5]],
  [[0, 2], [3, 2], [0, 5], [3, 5]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
];

const WALL_AUTOTILE_TABLE: AutotileShape[] = [
  [[2, 2], [1, 2], [2, 1], [1, 1]],
  [[0, 2], [1, 2], [0, 1], [1, 1]],
  [[2, 0], [1, 0], [2, 1], [1, 1]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[2, 2], [3, 2], [2, 1], [3, 1]],
  [[0, 2], [3, 2], [0, 1], [3, 1]],
  [[2, 0], [3, 0], [2, 1], [3, 1]],
  [[0, 0], [3, 0], [0, 1], [3, 1]],
  [[2, 2], [1, 2], [2, 3], [1, 3]],
  [[0, 2], [1, 2], [0, 3], [1, 3]],
  [[2, 0], [1, 0], [2, 3], [1, 3]],
  [[0, 0], [1, 0], [0, 3], [1, 3]],
  [[2, 2], [3, 2], [2, 3], [3, 3]],
  [[0, 2], [3, 2], [0, 3], [3, 3]],
  [[2, 0], [3, 0], [2, 3], [3, 3]],
  [[0, 0], [3, 0], [0, 3], [3, 3]],
];

const WATERFALL_AUTOTILE_TABLE: AutotileShape[] = [
  [[2, 0], [1, 0], [2, 1], [1, 1]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[2, 0], [3, 0], [2, 1], [3, 1]],
  [[0, 0], [3, 0], [0, 1], [3, 1]],
];

export function drawRpgMakerMap(
  canvas: HTMLCanvasElement,
  map: MapSummary,
  tileSize: number,
  tilesetImages: Array<HTMLImageElement | null>,
  characterImages: Map<string, HTMLImageElement> = new Map(),
): void {
  const width = map.width * tileSize;
  const height = map.height * tileSize;
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  canvas.width = width;
  canvas.height = height;
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#1f2630";
  context.fillRect(0, 0, width, height);

  for (let z = 0; z < 4; z += 1) {
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        drawTile(context, map, tilesetImages, readMapData(map, x, y, z), x * tileSize, y * tileSize, tileSize);
      }
    }
  }

  drawEvents(context, map, tilesetImages, characterImages, tileSize);
}

export function getCharacterFrame(image: HTMLImageElement, event: EventSummary): CharacterFrame {
  const singleCharacter = event.characterName.startsWith("$") || event.characterName.startsWith("!$");
  const frameWidth = image.naturalWidth / (singleCharacter ? 3 : 12);
  const frameHeight = image.naturalHeight / (singleCharacter ? 4 : 8);
  const blockX = singleCharacter ? 0 : (event.characterIndex % 4) * 3;
  const blockY = singleCharacter ? 0 : Math.floor(event.characterIndex / 4) * 4;
  const directionRow = Math.min(3, Math.max(0, Math.floor(event.direction / 2) - 1));
  const pattern = Math.min(2, Math.max(0, event.pattern));

  return {
    sx: (blockX + pattern) * frameWidth,
    sy: (blockY + directionRow) * frameHeight,
    width: frameWidth,
    height: frameHeight,
  };
}

function drawEvents(
  context: CanvasRenderingContext2D,
  map: MapSummary,
  tilesetImages: Array<HTMLImageElement | null>,
  characterImages: Map<string, HTMLImageElement>,
  tileSize: number,
): void {
  for (const event of map.events) {
    if (event.characterName) {
      drawCharacterEvent(context, event, characterImages, tileSize);
    } else if (event.tileId > 0) {
      drawTile(context, map, tilesetImages, event.tileId, event.x * tileSize, event.y * tileSize, tileSize);
    }
  }
}

function drawCharacterEvent(
  context: CanvasRenderingContext2D,
  event: EventSummary,
  characterImages: Map<string, HTMLImageElement>,
  tileSize: number,
): void {
  const image = characterImages.get(event.characterName);

  if (!image) {
    return;
  }

  const frame = getCharacterFrame(image, event);
  const dx = event.x * tileSize + (tileSize - frame.width) / 2;
  const dy = (event.y + 1) * tileSize - frame.height;
  context.drawImage(image, frame.sx, frame.sy, frame.width, frame.height, dx, dy, frame.width, frame.height);
}

function drawTile(
  context: CanvasRenderingContext2D,
  map: MapSummary,
  images: Array<HTMLImageElement | null>,
  tileId: number,
  dx: number,
  dy: number,
  tileSize: number,
): void {
  if (!isVisibleTile(tileId)) {
    return;
  }

  if (isAutotile(tileId)) {
    drawAutotile(context, map, images, tileId, dx, dy, tileSize);
    return;
  }

  drawNormalTile(context, images, tileId, dx, dy, tileSize);
}

function drawNormalTile(
  context: CanvasRenderingContext2D,
  images: Array<HTMLImageElement | null>,
  tileId: number,
  dx: number,
  dy: number,
  tileSize: number,
): void {
  const setNumber = isTileA5(tileId) ? 4 : 5 + Math.floor(tileId / 256);
  const image = images[setNumber];
  if (!image) {
    return;
  }

  const sx = ((Math.floor(tileId / 128) % 2) * 8 + (tileId % 8)) * tileSize;
  const sy = (Math.floor((tileId % 256) / 8) % 16) * tileSize;
  context.drawImage(image, sx, sy, tileSize, tileSize, dx, dy, tileSize, tileSize);
}

function drawAutotile(
  context: CanvasRenderingContext2D,
  map: MapSummary,
  images: Array<HTMLImageElement | null>,
  tileId: number,
  dx: number,
  dy: number,
  tileSize: number,
): void {
  const kind = Math.floor((tileId - TILE_ID_A1) / 48);
  const shape = (tileId - TILE_ID_A1) % 48;
  const tx = kind % 8;
  const ty = Math.floor(kind / 8);
  let setNumber = 0;
  let bx = 0;
  let by = 0;
  let table = FLOOR_AUTOTILE_TABLE[shape];
  let isTable = false;

  if (isTileA1(tileId)) {
    if (kind === 0) {
      bx = 0;
      by = 0;
    } else if (kind === 1) {
      bx = 0;
      by = 3;
    } else if (kind === 2) {
      bx = 6;
      by = 0;
    } else if (kind === 3) {
      bx = 6;
      by = 3;
    } else {
      bx = Math.floor(tx / 4) * 8;
      by = ty * 6 + (Math.floor(tx / 2) % 2) * 3;
      if (kind % 2 !== 0) {
        bx += 6;
        table = WATERFALL_AUTOTILE_TABLE[shape % 4];
      }
    }
  } else if (isTileA2(tileId)) {
    setNumber = 1;
    bx = tx * 2;
    by = (ty - 2) * 3;
    isTable = Boolean(map.tileFlags[tileId] & 0x80);
  } else if (isTileA3(tileId)) {
    setNumber = 2;
    bx = tx * 2;
    by = (ty - 6) * 2;
    table = WALL_AUTOTILE_TABLE[shape % 16];
  } else if (isTileA4(tileId)) {
    setNumber = 3;
    bx = tx * 2;
    by = Math.floor((ty - 10) * 2.5 + (ty % 2 === 1 ? 0.5 : 0));
    if (ty % 2 === 1) {
      table = WALL_AUTOTILE_TABLE[shape % 16];
    }
  }

  const image = images[setNumber];
  if (!image || !table) {
    return;
  }

  const half = tileSize / 2;
  for (let index = 0; index < 4; index += 1) {
    const [qsx, qsy] = table[index];
    const sx = (bx * 2 + qsx) * half;
    const sy = (by * 2 + qsy) * half;
    const qdx = dx + (index % 2) * half;
    const qdy = dy + Math.floor(index / 2) * half;

    if (isTable && (qsy === 1 || qsy === 5)) {
      const qsx2 = qsy === 1 ? (4 - qsx) % 4 : qsx;
      context.drawImage(image, (bx * 2 + qsx2) * half, (by * 2 + 3) * half, half, half, qdx, qdy, half, half);
      context.drawImage(image, sx, sy, half, half / 2, qdx, qdy + half / 2, half, half / 2);
    } else {
      context.drawImage(image, sx, sy, half, half, qdx, qdy, half, half);
    }
  }
}

function readMapData(map: MapSummary, x: number, y: number, z: number): number {
  return map.tileData[(z * map.height + y) * map.width + x] ?? 0;
}

function isVisibleTile(tileId: number): boolean {
  return tileId > 0 && tileId < TILE_ID_MAX;
}

function isAutotile(tileId: number): boolean {
  return tileId >= TILE_ID_A1;
}

function isTileA1(tileId: number): boolean {
  return tileId >= TILE_ID_A1 && tileId < TILE_ID_A2;
}

function isTileA2(tileId: number): boolean {
  return tileId >= TILE_ID_A2 && tileId < TILE_ID_A3;
}

function isTileA3(tileId: number): boolean {
  return tileId >= TILE_ID_A3 && tileId < TILE_ID_A4;
}

function isTileA4(tileId: number): boolean {
  return tileId >= TILE_ID_A4 && tileId < TILE_ID_MAX;
}

function isTileA5(tileId: number): boolean {
  return tileId >= TILE_ID_A5 && tileId < TILE_ID_A1;
}
