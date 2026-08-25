import { Marker } from "@maplibre/maplibre-react-native";

import type { MapMarkerProps } from "./types";

export function MapMarker({ id, coordinate, onPress, zIndex, children }: MapMarkerProps) {
  return (
    <Marker
      id={id}
      lngLat={[coordinate.longitude, coordinate.latitude]}
      onPress={onPress}
      anchor="center"
      style={zIndex == null ? undefined : { zIndex }}
    >
      {children}
    </Marker>
  );
}
