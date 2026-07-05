import type { JsonValue, LoadedMap, MapInfo, RpgCommand, RpgEvent, RpgMap, TransferLink } from "./types";

const TRANSFER_PLAYER_CODE = 201;

export function scanProjectTransfers(loadedMaps: LoadedMap[]): TransferLink[] {
  const mapNames = new Map(loadedMaps.map(({ info }) => [info.id, info.name]));

  return loadedMaps.flatMap(({ info, map }) => scanMapTransfers(info, map, mapNames));
}

export function scanMapTransfers(info: MapInfo, map: RpgMap, mapNames: Map<number, string>): TransferLink[] {
  return map.events.flatMap((event) => scanEventTransfers(info, event, mapNames));
}

function scanEventTransfers(info: MapInfo, event: RpgEvent | null, mapNames: Map<number, string>): TransferLink[] {
  if (!event) {
    return [];
  }

  return event.pages.flatMap((page, pageIndex) =>
    page.list.flatMap((command, commandIndex) => buildTransferLink(info, event, command, pageIndex, commandIndex, mapNames)),
  );
}

function buildTransferLink(
  info: MapInfo,
  event: RpgEvent,
  command: RpgCommand,
  pageIndex: number,
  commandIndex: number,
  mapNames: Map<number, string>,
): TransferLink[] {
  if (command.code !== TRANSFER_PLAYER_CODE) {
    return [];
  }

  const params = command.parameters;
  const direct = params[0] === 0;
  const targetMapId = direct ? toNumber(params[1]) : null;
  const targetX = direct ? toNumber(params[2]) : null;
  const targetY = direct ? toNumber(params[3]) : null;
  const id = `${info.id}:${event.id}:${pageIndex}:${commandIndex}`;

  return [
    {
      id,
      kind: direct ? "direct" : "variable",
      sourceMapId: info.id,
      sourceMapName: info.name,
      eventId: event.id,
      eventName: event.name,
      eventX: event.x,
      eventY: event.y,
      pageIndex,
      commandIndex,
      targetMapId,
      targetMapName: targetMapId === null ? null : mapNames.get(targetMapId) ?? `Map ${targetMapId}`,
      targetX,
      targetY,
      direction: toNumber(params[4]),
      fade: toNumber(params[5]),
      rawParameters: params,
    },
  ];
}

function toNumber(value: JsonValue | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
