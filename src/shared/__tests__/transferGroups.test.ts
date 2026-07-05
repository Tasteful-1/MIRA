import { describe, expect, it } from "vitest";

import { groupTransferLinksByDestination, splitTransferGroupByConnectedSources } from "../transferGroups";
import type { TransferLink } from "../types";

const baseLink: TransferLink = {
  id: "link-1",
  kind: "direct",
  sourceMapId: 1,
  sourceMapName: "Source",
  eventId: 1,
  eventName: "Door",
  eventX: 3,
  eventY: 4,
  pageIndex: 0,
  commandIndex: 0,
  targetMapId: 2,
  targetMapName: "Target",
  targetX: 5,
  targetY: 6,
  direction: 2,
  fade: 0,
  rawParameters: [],
};

describe("groupTransferLinksByDestination", () => {
  it("groups transfers that arrive at the same map tile", () => {
    const groups = groupTransferLinksByDestination([
      baseLink,
      { ...baseLink, id: "link-2", eventId: 2, eventX: 7 },
      { ...baseLink, id: "link-3", targetX: 8 },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].links.map((link) => link.id)).toEqual(["link-1", "link-2"]);
    expect(groups[1].links.map((link) => link.id)).toEqual(["link-3"]);
  });
});

describe("splitTransferGroupByConnectedSources", () => {
  it("splits one destination into connected source tile clusters", () => {
    const [group] = groupTransferLinksByDestination([
      baseLink,
      { ...baseLink, id: "link-2", eventId: 2, eventX: 4, eventY: 4 },
      { ...baseLink, id: "link-3", eventId: 3, eventX: 7, eventY: 4 },
      { ...baseLink, id: "link-4", eventId: 4, eventX: 8, eventY: 5 },
    ]);
    const clusters = splitTransferGroupByConnectedSources(group);

    expect(clusters.map((cluster) => cluster.links.map((link) => link.id))).toEqual([
      ["link-1", "link-2"],
      ["link-3"],
      ["link-4"],
    ]);
  });
});
