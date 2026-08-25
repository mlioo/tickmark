import { Marker } from "react-native-maps";

import type { MapMarkerProps } from "./types";

export function MapMarker({
  id,
  coordinate,
  onPress,
  zIndex,
  tracksViewChanges,
  children
}: MapMarkerProps) {
  return (
    <Marker
      identifier={id}
      coordinate={coordinate}
      onPress={onPress}
      tracksViewChanges={tracksViewChanges}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={zIndex}
    >
      {children}
    </Marker>
  );
}
