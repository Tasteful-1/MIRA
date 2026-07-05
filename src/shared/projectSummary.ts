import type { EventSummary, LoadedMap, MapSummary, ProjectSnapshot, RpgEvent, RpgEventImage, RpgTileset, TransferLink } from "./types";
import { scanProjectTransfers } from "./transferScanner";

export function buildProjectSnapshot(
  rootPath: string,
  gameTitle: string,
  tileSize: number,
  loadedMaps: LoadedMap[],
  tilesets: RpgTileset[],
): ProjectSnapshot {
  const links = scanProjectTransfers(loadedMaps);
  const directLinks = links.filter((link) => link.kind === "direct");
  const unresolvedLinks = links.filter((link) => link.kind === "variable");
  const maps = buildMapSummaries(loadedMaps, directLinks, tilesets);

  return {
    rootPath,
    gameTitle,
    tileSize,
    maps,
    links: directLinks,
    unresolvedLinks,
  };
}

function buildMapSummaries(loadedMaps: LoadedMap[], links: TransferLink[], tilesets: RpgTileset[]): MapSummary[] {
  const tilesetById = new Map(tilesets.map((tileset) => [tileset.id, tileset]));

  return loadedMaps
    .map(({ info, map }) => {
      const tileset = tilesetById.get(map.tilesetId);

      return {
        id: info.id,
        name: info.name,
        order: info.order,
        parentId: info.parentId,
        width: map.width,
        height: map.height,
        tilesetId: map.tilesetId,
        tileData: map.data,
        tilesetNames: tileset?.tilesetNames ?? [],
        tileFlags: tileset?.flags ?? [],
        events: buildEventSummaries(map.events),
        outgoingCount: links.filter((link) => link.sourceMapId === info.id).length,
        incomingCount: links.filter((link) => link.targetMapId === info.id).length,
      };
    })
    .sort((a, b) => a.id - b.id);
}

function buildEventSummaries(events: Array<RpgEvent | null>): EventSummary[] {
  return events.flatMap((event) => {
    if (!event) {
      return [];
    }

    const pageIndex = event.pages.findIndex((page) => page.image && hasEventGraphic(page.image));
    const image = event.pages[pageIndex]?.image;

    return image ? [buildEventSummary(event, pageIndex, image)] : [];
  });
}

function buildEventSummary(event: RpgEvent, pageIndex: number, image: RpgEventImage): EventSummary {
  return {
    id: event.id,
    name: event.name,
    x: event.x,
    y: event.y,
    pageIndex,
    tileId: image.tileId,
    characterName: image.characterName,
    characterIndex: image.characterIndex,
    direction: image.direction,
    pattern: image.pattern,
  };
}

function hasEventGraphic(image: RpgEventImage): boolean {
  return image.tileId > 0 || image.characterName.length > 0;
}
