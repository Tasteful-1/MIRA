import { describe, expect, it } from "vitest";

import { buildProjectSnapshot } from "../projectSummary";
import type { LoadedMap } from "../types";

describe("transfer scanner", () => {
  it("extracts direct transfer commands and unresolved variable transfers", () => {
    const maps: LoadedMap[] = [
      {
        info: { id: 1, name: "Start", order: 2, parentId: 0 },
        map: {
          width: 10,
          height: 10,
          tilesetId: 1,
          data: [],
          events: [
            null,
            {
              id: 1,
              name: "Door",
              x: 3,
              y: 4,
              pages: [
                {
                  trigger: 1,
                  list: [{ code: 201, indent: 0, parameters: [0, 2, 5, 6, 2, 0] }],
                },
                {
                  image: { tileId: 0, characterName: "Actor1", direction: 2, pattern: 1, characterIndex: 0 },
                  trigger: 1,
                  list: [],
                },
              ],
            },
          ],
        },
      },
      {
        info: { id: 2, name: "Next", order: 1, parentId: 0 },
        map: {
          width: 8,
          height: 8,
          tilesetId: 1,
          data: [],
          events: [
            null,
            {
              id: 1,
              name: "Warp",
              x: 1,
              y: 2,
              pages: [{ trigger: 1, list: [{ code: 201, indent: 0, parameters: [1, 10, 11, 12, 4, 1] }] }],
            },
          ],
        },
      },
    ];

    const snapshot = buildProjectSnapshot("fixture", "Fixture", 48, maps, [
      { id: 1, name: "Fixture", flags: [], tilesetNames: [] },
    ]);

    expect(snapshot.links).toHaveLength(1);
    expect(snapshot.maps.map((map) => map.id)).toEqual([1, 2]);
    expect(snapshot.links[0]).toMatchObject({
      sourceMapId: 1,
      targetMapId: 2,
      targetMapName: "Next",
      eventX: 3,
      eventY: 4,
      targetX: 5,
      targetY: 6,
    });
    expect(snapshot.unresolvedLinks).toHaveLength(1);
    expect(snapshot.maps[0].events[0]).toMatchObject({ id: 1, characterName: "Actor1", pageIndex: 1 });
    expect(snapshot.maps[0]).toMatchObject({ outgoingCount: 1, incomingCount: 0 });
    expect(snapshot.maps[1]).toMatchObject({ outgoingCount: 0, incomingCount: 1 });
  });
});
