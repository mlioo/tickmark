import { useImperativeHandle, useMemo, useRef, type Ref } from "react";
import { StyleSheet } from "react-native";
import MapView, { type Region } from "react-native-maps";

import type { BasemapHandle, BasemapProps, MapRegion } from "./types";

function toRegion(region: MapRegion): Region {
  return region;
}

export function Basemap({
  initialRegion,
  themeMode,
  onMapReady,
  onRegionChangeComplete,
  onPress,
  children,
  ref
}: BasemapProps & { ref?: Ref<BasemapHandle> }) {
  const mapRef = useRef<MapView>(null);

  const handle = useMemo<BasemapHandle>(
    () => ({
      fitToCoordinates(coordinates, options) {
        mapRef.current?.fitToCoordinates(coordinates, options);
      },
      animateToRegion(region, durationMs) {
        mapRef.current?.animateToRegion(toRegion(region), durationMs);
      }
    }),
    []
  );

  useImperativeHandle(ref, () => handle, [handle]);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={toRegion(initialRegion)}
      mapType="standard"
      userInterfaceStyle={themeMode}
      rotateEnabled
      pitchEnabled={false}
      showsCompass
      showsScale={false}
      onMapReady={onMapReady}
      onRegionChangeComplete={onRegionChangeComplete}
      onPress={onPress}
    >
      {children}
    </MapView>
  );
}
