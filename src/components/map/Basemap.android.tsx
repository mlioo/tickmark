import { useImperativeHandle, useMemo, useRef, type Ref } from "react";
import { StyleSheet } from "react-native";
import { Camera, Map, type CameraRef, type ViewState } from "@maplibre/maplibre-react-native";

import { boundsFromCoordinates, zoomFromLatitudeDelta } from "./mapGeometry";
import { OSM_STYLE_DARK, OSM_STYLE_LIGHT } from "./osmStyle";
import type { BasemapHandle, BasemapProps, MapRegion } from "./types";

function viewStateToRegion(state: ViewState): MapRegion | null {
  const [west = 0, south = 0, east = 0, north = 0] = state.bounds;
  const [longitude = 0, latitude = 0] = state.center;
  const latitudeDelta = north - south;
  const longitudeDelta = east - west;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (!(latitudeDelta > 0) || !(longitudeDelta > 0)) return null;
  return {
    latitude,
    longitude,
    latitudeDelta,
    longitudeDelta
  };
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
  const cameraRef = useRef<CameraRef>(null);
  const readyRef = useRef(false);

  const initialViewState = useRef({
    center: [initialRegion.longitude, initialRegion.latitude] as [number, number],
    zoom: zoomFromLatitudeDelta(initialRegion.latitudeDelta),
    pitch: 0
  }).current;

  const handle = useMemo<BasemapHandle>(
    () => ({
      fitToCoordinates(coordinates, options) {
        if (!readyRef.current || !coordinates.length) return;
        try {
          cameraRef.current?.fitBounds(boundsFromCoordinates(coordinates), {
            padding: options.edgePadding,
            duration: options.animated ? 700 : 0,
            easing: options.animated ? "ease" : undefined,
            pitch: 0
          });
        } catch {
          // Camera is not attached until the style finishes loading.
        }
      },
      animateToRegion(region, durationMs) {
        if (!readyRef.current) return;
        try {
          cameraRef.current?.easeTo({
            center: [region.longitude, region.latitude],
            zoom: zoomFromLatitudeDelta(region.latitudeDelta),
            duration: durationMs,
            pitch: 0
          });
        } catch {
          // Camera is not attached until the style finishes loading.
        }
      }
    }),
    []
  );

  useImperativeHandle(ref, () => handle, [handle]);

  return (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={themeMode === "dark" ? OSM_STYLE_DARK : OSM_STYLE_LIGHT}
      touchPitch={false}
      compass
      compassPosition={{ top: 48, right: 8 }}
      scaleBar={false}
      logo={false}
      attribution
      attributionPosition={{ bottom: 8, left: 8 }}
      androidView="texture"
      onDidFinishLoadingMap={() => {
        readyRef.current = true;
        onMapReady?.();
      }}
      onRegionDidChange={(event) => {
        const region = viewStateToRegion(event.nativeEvent);
        if (region) onRegionChangeComplete?.(region);
      }}
      onPress={() => onPress?.()}
    >
      <Camera ref={cameraRef} initialViewState={initialViewState} />
      {children}
    </Map>
  );
}
