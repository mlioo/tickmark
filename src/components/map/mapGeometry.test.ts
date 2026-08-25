import { describe, expect, it } from "vitest";

import { boundsFromCoordinates, zoomFromLatitudeDelta } from "./mapGeometry";

describe("mapGeometry", () => {
  it("converts a latitude span back to MapLibre zoom", () => {
    expect(zoomFromLatitudeDelta(360 / 2 ** 13)).toBeCloseTo(13, 5);
  });

  it("pads a single coordinate into a non-empty bounds box", () => {
    const [west, south, east, north] = boundsFromCoordinates([{ latitude: 36.4, longitude: 140.2 }]);
    expect(east).toBeGreaterThan(west);
    expect(north).toBeGreaterThan(south);
  });
});
