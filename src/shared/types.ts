export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface MapInfo {
  id: number;
  name: string;
  order: number;
  parentId: number;
  expanded?: boolean;
}

export interface RpgCommand {
  code: number;
  indent: number | null;
  parameters: JsonValue[];
}

export interface RpgEventPage {
  image?: RpgEventImage;
  list: RpgCommand[];
  trigger: number;
}

export interface RpgEventImage {
  tileId: number;
  characterName: string;
  direction: number;
  pattern: number;
  characterIndex: number;
}

export interface RpgEvent {
  id: number;
  name: string;
  x: number;
  y: number;
  pages: RpgEventPage[];
}

export interface RpgMap {
  width: number;
  height: number;
  tilesetId: number;
  data: number[];
  events: Array<RpgEvent | null>;
}

export interface RpgTileset {
  id: number;
  name: string;
  flags: number[];
  tilesetNames: string[];
}

export interface LoadedMap {
  info: MapInfo;
  map: RpgMap;
}

export interface TransferLink {
  id: string;
  kind: "direct" | "variable";
  sourceMapId: number;
  sourceMapName: string;
  eventId: number;
  eventName: string;
  eventX: number;
  eventY: number;
  pageIndex: number;
  commandIndex: number;
  targetMapId: number | null;
  targetMapName: string | null;
  targetX: number | null;
  targetY: number | null;
  direction: number | null;
  fade: number | null;
  rawParameters: JsonValue[];
}

export interface EventSummary {
  id: number;
  name: string;
  x: number;
  y: number;
  pageIndex: number;
  tileId: number;
  characterName: string;
  characterIndex: number;
  direction: number;
  pattern: number;
}

export interface MapSummary {
  id: number;
  name: string;
  order: number;
  parentId: number;
  width: number;
  height: number;
  tilesetId: number;
  tileData: number[];
  tilesetNames: string[];
  tileFlags: number[];
  events: EventSummary[];
  outgoingCount: number;
  incomingCount: number;
}

export interface ProjectSnapshot {
  rootPath: string;
  gameTitle: string;
  tileSize: number;
  maps: MapSummary[];
  links: TransferLink[];
  unresolvedLinks: TransferLink[];
}
