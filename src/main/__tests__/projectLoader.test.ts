import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { loadCharacterImageDataUrl, loadMzProject, loadRpgMakerProject, loadTilesetImageDataUrl } from "../projectLoader";

const sampleRoot = path.resolve(process.cwd(), "..", "GoD");
const describeSample = existsSync(path.join(sampleRoot, "data", "MapInfos.json")) ? describe : describe.skip;
const mvSampleRoot = "D:\\K\\Sample";
const describeMvSample = existsSync(path.join(mvSampleRoot, "www", "data", "MapInfos.json")) ? describe : describe.skip;

describeSample("GoD sample project", () => {
  it("loads maps and transfer links from the sibling sample", async () => {
    const snapshot = await loadMzProject(sampleRoot);

    expect(snapshot.gameTitle).toContain("Gate of Destiny");
    expect(snapshot.maps.length).toBeGreaterThan(80);
    expect(snapshot.links.length).toBeGreaterThan(0);
    expect(snapshot.tileSize).toBe(48);
    expect(snapshot.maps[0].tileData.length).toBeGreaterThan(0);
    expect(snapshot.maps[0].tilesetNames.some(Boolean)).toBe(true);
    expect(snapshot.maps.some((map) => map.events.length > 0)).toBe(true);
    expect(snapshot.maps.some((map) => map.outgoingCount > 0)).toBe(true);
    expect(snapshot.maps.some((map) => map.incomingCount > 0)).toBe(true);
  });

  it("decrypts encrypted MZ tileset images as PNG data URLs", async () => {
    const dataUrl = await loadTilesetImageDataUrl(sampleRoot, "Dungeon_A2");
    const pngData = Buffer.from(dataUrl.split(",")[1], "base64");

    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect([...pngData.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it("loads tileset images from nested tileset folders", async () => {
    const dataUrl = await loadTilesetImageDataUrl(sampleRoot, "TilesetEtibo/MZ_EX_Dungeon_A1_2");
    const pngData = Buffer.from(dataUrl.split(",")[1], "base64");

    expect([...pngData.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it("rejects tileset paths outside img/tilesets", async () => {
    await expect(loadTilesetImageDataUrl(sampleRoot, "../System")).rejects.toThrow("Invalid tileset name");
  });

  it("decrypts encrypted MZ character images as PNG data URLs", async () => {
    const dataUrl = await loadCharacterImageDataUrl(sampleRoot, "GoD1");
    const pngData = Buffer.from(dataUrl.split(",")[1], "base64");

    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect([...pngData.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });
});

describeMvSample("MV deployed sample project", () => {
  it("loads maps and transfer links from a deployed www folder", async () => {
    const snapshot = await loadRpgMakerProject(mvSampleRoot);

    expect(snapshot.rootPath).toBe(path.join(mvSampleRoot, "www"));
    expect(snapshot.gameTitle).toBe("REMAINS REBIRTH");
    expect(snapshot.maps.length).toBeGreaterThan(300);
    expect(snapshot.links.length).toBeGreaterThan(0);
    expect(snapshot.tileSize).toBe(48);
    expect(snapshot.maps.some((map) => map.events.length > 0)).toBe(true);
  });

  it("decrypts encrypted MV .rpgmvp tileset images as PNG data URLs", async () => {
    const dataUrl = await loadTilesetImageDataUrl(mvSampleRoot, "World_A1");
    const pngData = Buffer.from(dataUrl.split(",")[1], "base64");

    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect([...pngData.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it("decrypts encrypted MV .rpgmvp character images as PNG data URLs", async () => {
    const dataUrl = await loadCharacterImageDataUrl(mvSampleRoot, "!Other2");
    const pngData = Buffer.from(dataUrl.split(",")[1], "base64");

    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect([...pngData.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });
});
