import type { ReactElement, ReactNode, Ref } from "react";

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export type EdgePadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type BasemapHandle = {
  fitToCoordinates: (
    coordinates: MapCoordinate[],
    options: { edgePadding: EdgePadding; animated: boolean }
  ) => void;
  animateToRegion: (region: MapRegion, durationMs: number) => void;
};

export type BasemapProps = {
  initialRegion: MapRegion;
  themeMode: "light" | "dark";
  onMapReady?: () => void;
  onRegionChangeComplete?: (region: MapRegion) => void;
  onPress?: () => void;
  children?: ReactNode;
  ref?: Ref<BasemapHandle>;
};

export type MapMarkerProps = {
  id: string;
  coordinate: MapCoordinate;
  onPress?: () => void;
  zIndex?: number;
  tracksViewChanges?: boolean;
  children: ReactElement;
};
