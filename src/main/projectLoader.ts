import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildProjectSnapshot } from "../shared/projectSummary";
import type { JsonValue, LoadedMap, MapInfo, ProjectSnapshot, RpgMap, RpgTileset } from "../shared/types";

interface SystemJson {
  gameTitle?: string;
  tileSize?: number;
  tileWidth?: number;
  hasEncryptedImages?: boolean;
  encryptionKey?: string;
}

const ENCRYPTED_HEADER = [0x52, 0x50, 0x47, 0x4d, 0x56, 0, 0, 0, 0, 3, 1, 0, 0, 0, 0, 0];

export async function loadRpgMakerProject(inputRootPath: string): Promise<ProjectSnapshot> {
  const rootPath = normalizeProjectRoot(inputRootPath);
  const dataPath = path.join(rootPath, "data");
  const mapInfos = compactMapInfos(await readJson<Array<MapInfo | null>>(path.join(dataPath, "MapInfos.json")));
  const system = await readJson<SystemJson>(path.join(dataPath, "System.json"));
  const tilesets = compactTilesets(await readJson<Array<RpgTileset | null>>(path.join(dataPath, "Tilesets.json")));
  const loadedMaps = await Promise.all(mapInfos.map((info) => loadMap(dataPath, info)));
  const tileSize = system.tileSize ?? system.tileWidth ?? 48;

  return buildProjectSnapshot(rootPath, system.gameTitle ?? path.basename(rootPath), tileSize, loadedMaps, tilesets);
}

export const loadMzProject = loadRpgMakerProject;

export async function loadTilesetImageDataUrl(rootPath: string, tilesetName: string): Promise<string> {
  return loadProjectImageDataUrl(rootPath, "tilesets", tilesetName, "tileset");
}

export async function loadCharacterImageDataUrl(rootPath: string, characterName: string): Promise<string> {
  return loadProjectImageDataUrl(rootPath, "characters", characterName, "character");
}

async function loadProjectImageDataUrl(
  rootPath: string,
  imageFolder: "tilesets" | "characters",
  assetName: string,
  assetLabel: string,
): Promise<string> {
  const projectRoot = normalizeProjectRoot(rootPath);
  const system = await readJson<SystemJson>(path.join(projectRoot, "data", "System.json"));
  const extensions = system.hasEncryptedImages ? [".png_", ".rpgmvp"] : [".png"];
  const imagePath = resolveExistingProjectImagePath(projectRoot, imageFolder, assetName, extensions, assetLabel);
  const imageData = await readFile(imagePath);
  const pngData = system.hasEncryptedImages ? decryptImage(imageData, system.encryptionKey) : imageData;

  return `data:image/png;base64,${pngData.toString("base64")}`;
}

async function loadMap(dataPath: string, info: MapInfo): Promise<LoadedMap> {
  const map = await readJson<RpgMap>(path.join(dataPath, `Map${String(info.id).padStart(3, "0")}.json`));
  assertRpgMap(map, info.id);

  return { info, map };
}

async function readJson<T>(filePath: string): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf-8")) as T;
  } catch (error) {
    throw new Error(`JSON load failed: ${filePath}`, { cause: error });
  }
}

function normalizeProjectRoot(inputRootPath: string): string {
  if (path.basename(inputRootPath).toLowerCase() === "data") {
    return path.dirname(inputRootPath);
  }

  if (existsSync(path.join(inputRootPath, "data", "MapInfos.json"))) {
    return inputRootPath;
  }

  const deployedRoot = path.join(inputRootPath, "www");

  return existsSync(path.join(deployedRoot, "data", "MapInfos.json")) ? deployedRoot : inputRootPath;
}

function compactMapInfos(mapInfos: Array<MapInfo | null>): MapInfo[] {
  return mapInfos.filter((info): info is MapInfo => Boolean(info && Number.isInteger(info.id)));
}

function compactTilesets(tilesets: Array<RpgTileset | null>): RpgTileset[] {
  return tilesets.filter((tileset): tileset is RpgTileset => Boolean(tileset && Number.isInteger(tileset.id)));
}

function assertRpgMap(map: RpgMap, mapId: number): void {
  const checks: JsonValue[] = [map.width, map.height, map.tilesetId, Array.isArray(map.data), Array.isArray(map.events)];

  if (!checks.every(Boolean)) {
    throw new Error(`Invalid RPG Maker map data: Map${String(mapId).padStart(3, "0")}.json`);
  }
}

function resolveProjectImagePath(
  rootPath: string,
  imageFolder: "tilesets" | "characters",
  assetName: string,
  extension: string,
  assetLabel: string,
): string {
  const normalizedName = assetName.replace(/\\/g, "/");
  const parts = normalizedName.split("/");

  if (!normalizedName || parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error(`Invalid ${assetLabel} name: ${assetName}`);
  }

  const imageRoot = path.resolve(rootPath, "img", imageFolder);
  const imagePath = path.resolve(imageRoot, `${normalizedName}${extension}`);
  const relativePath = path.relative(imageRoot, imagePath);

  if (relativePath === ".." || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
    throw new Error(`Invalid ${assetLabel} name: ${assetName}`);
  }

  return imagePath;
}

function resolveExistingProjectImagePath(
  rootPath: string,
  imageFolder: "tilesets" | "characters",
  assetName: string,
  extensions: string[],
  assetLabel: string,
): string {
  const imagePaths = extensions.map((extension) =>
    resolveProjectImagePath(rootPath, imageFolder, assetName, extension, assetLabel),
  );
  const existingPath = imagePaths.find((imagePath) => existsSync(imagePath));

  if (!existingPath) {
    throw new Error(`${assetLabel} image not found: ${assetName}`);
  }

  return existingPath;
}

function decryptImage(source: Buffer, encryptionKey?: string): Buffer {
  if (!encryptionKey) {
    throw new Error("Encrypted image needs System.json encryptionKey");
  }

  const validHeader = ENCRYPTED_HEADER.every((byte, index) => source[index] === byte);
  if (!validHeader) {
    throw new Error("Encrypted image header mismatch");
  }

  const body = Buffer.from(source.subarray(16));
  const key = encryptionKey.match(/.{2}/g) ?? [];

  for (let index = 0; index < 16; index += 1) {
    body[index] = body[index] ^ Number.parseInt(key[index], 16);
  }

  return body;
}
