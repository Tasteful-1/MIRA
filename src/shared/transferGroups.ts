import type { TransferLink } from "./types";

export interface TransferGroup {
  id: string;
  representative: TransferLink;
  links: TransferLink[];
}

export interface TransferCluster {
  id: string;
  group: TransferGroup;
  links: TransferLink[];
}

export function groupTransferLinksByDestination(links: TransferLink[]): TransferGroup[] {
  const groups = new Map<string, TransferGroup>();

  for (const link of links) {
    const key = transferDestinationKey(link);
    const group = groups.get(key);

    if (group) {
      group.links.push(link);
    } else {
      groups.set(key, { id: key, representative: link, links: [link] });
    }
  }

  return [...groups.values()];
}

export function splitTransferGroupByConnectedSources(group: TransferGroup): TransferCluster[] {
  const linksByTile = new Map<string, TransferLink[]>();

  for (const link of group.links) {
    const key = sourceTileKey(link);
    linksByTile.set(key, [...(linksByTile.get(key) ?? []), link]);
  }

  const visitedTiles = new Set<string>();
  const clusters: TransferCluster[] = [];

  for (const key of linksByTile.keys()) {
    if (visitedTiles.has(key)) {
      continue;
    }

    const links = collectConnectedLinks(key, linksByTile, visitedTiles);
    clusters.push({ id: `${group.id}:${clusters.length}`, group, links });
  }

  return clusters;
}

function transferDestinationKey(link: TransferLink): string {
  return [link.kind, link.targetMapId ?? "variable", link.targetX ?? "variable", link.targetY ?? "variable"].join(":");
}

function collectConnectedLinks(
  startKey: string,
  linksByTile: Map<string, TransferLink[]>,
  visitedTiles: Set<string>,
): TransferLink[] {
  const stack = [startKey];
  const links: TransferLink[] = [];
  visitedTiles.add(startKey);

  while (stack.length > 0) {
    const key = stack.pop() ?? "";
    links.push(...(linksByTile.get(key) ?? []));

    for (const nextKey of neighborTileKeys(key)) {
      if (linksByTile.has(nextKey) && !visitedTiles.has(nextKey)) {
        visitedTiles.add(nextKey);
        stack.push(nextKey);
      }
    }
  }

  return links;
}

function sourceTileKey(link: TransferLink): string {
  return `${link.eventX}:${link.eventY}`;
}

function neighborTileKeys(key: string): string[] {
  const [xText, yText] = key.split(":");
  const x = Number(xText);
  const y = Number(yText);

  return [`${x - 1}:${y}`, `${x + 1}:${y}`, `${x}:${y - 1}`, `${x}:${y + 1}`];
}
