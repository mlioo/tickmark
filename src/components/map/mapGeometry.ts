import type { MapCoordinate } from "./types";

export function zoomFromLatitudeDelta(latitudeDelta: number): number {
  return Math.min(20, Math.max(1, Math.log2(360 / Math.max(latitudeDelta, 0.0001))));
}

export function boundsFromCoordinates(coordinates: MapCoordinate[]): [number, number, number, number] {
  const latitudes = coordinates.map((coordinate) => coordinate.latitude);
  const longitudes = coordinates.map((coordinate) => coordinate.longitude);
  let south = Math.min(...latitudes);
  let north = Math.max(...latitudes);
  let west = Math.min(...longitudes);
  let east = Math.max(...longitudes);
  const minSpan = 0.002;
  if (north - south < minSpan) {
    const mid = (north + south) / 2;
    south = mid - minSpan / 2;
    north = mid + minSpan / 2;
  }
  if (east - west < minSpan) {
    const mid = (east + west) / 2;
    west = mid - minSpan / 2;
    east = mid + minSpan / 2;
  }
  return [west, south, east, north];
}
