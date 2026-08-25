import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import type { Coordinates } from "../domain/types";
import { useI18n } from "../i18n";
import type { AppTheme } from "../theme/theme";
import { Basemap } from "./map/Basemap";
import { MapMarker } from "./map/MapMarker";
import type { BasemapHandle, MapRegion } from "./map/types";

export interface OfflineMapMarker {
  id: string;
  label: string;
  detail?: string;
  coordinates?: Coordinates;
}

interface GeographicMarker extends OfflineMapMarker {
  coordinates: Coordinates;
}

interface IndexedMarker extends GeographicMarker {
  index: number;
}

interface MarkerCluster {
  id: string;
  coordinates: Coordinates;
  members: IndexedMarker[];
}

const EDGE_PADDING = { top: 48, right: 38, bottom: 42, left: 38 };
/** Screen-space radius (px) for treating pins as overlapping at the current zoom. */
const OVERLAP_RADIUS_PX = 34;

function validCoordinates(value?: Coordinates): value is Coordinates {
  return Boolean(
    value &&
      Number.isFinite(value.lat) &&
      Number.isFinite(value.lng) &&
      Math.abs(value.lat) <= 90 &&
      Math.abs(value.lng) <= 180
  );
}

function distanceMeters(from: Coordinates, to: Coordinates): number {
  const radius = 6371000;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const deltaLat = ((to.lat - from.lat) * Math.PI) / 180;
  const deltaLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceLabel(meters: number): string {
  if (meters < 1000) return `${Math.max(1, Math.round(meters))} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}

function markerRegion(markers: GeographicMarker[], compact: boolean): MapRegion {
  const latitudes = markers.map((marker) => marker.coordinates.lat);
  const longitudes = markers.map((marker) => marker.coordinates.lng);
  let south = Math.min(...latitudes);
  let north = Math.max(...latitudes);
  let west = Math.min(...longitudes);
  let east = Math.max(...longitudes);
  const minimumSpan = compact ? 0.004 : 0.03;
  const latSpan = Math.max(north - south, minimumSpan);
  const lngSpan = Math.max(east - west, minimumSpan);
  const centerLat = (south + north) / 2;
  const centerLng = (west + east) / 2;
  return {
    latitude: centerLat,
    longitude: centerLng,
    latitudeDelta: latSpan * 1.24,
    longitudeDelta: lngSpan * 1.24
  };
}

function regionForZoom(center: Coordinates, zoom: number): MapRegion {
  const latitudeDelta = 360 / 2 ** zoom;
  return {
    latitude: center.lat,
    longitude: center.lng,
    latitudeDelta,
    longitudeDelta: latitudeDelta
  };
}

function fitMarkers(map: BasemapHandle | null, markers: GeographicMarker[]) {
  if (!map || !markers.length) return;
  map.fitToCoordinates(
    markers.map((marker) => ({
      latitude: marker.coordinates.lat,
      longitude: marker.coordinates.lng
    })),
    { edgePadding: EDGE_PADDING, animated: true }
  );
}

function screenDistancePx(
  left: Coordinates,
  right: Coordinates,
  region: MapRegion,
  mapSize: { width: number; height: number }
): number {
  const latPerPx = region.latitudeDelta / Math.max(mapSize.height, 1);
  const lngPerPx = region.longitudeDelta / Math.max(mapSize.width, 1);
  if (latPerPx <= 0 || lngPerPx <= 0) return Number.POSITIVE_INFINITY;
  const dy = (left.lat - right.lat) / latPerPx;
  const dx = (left.lng - right.lng) / lngPerPx;
  return Math.hypot(dx, dy);
}

function clusterMarkers(
  markers: IndexedMarker[],
  region: MapRegion,
  mapSize: { width: number; height: number }
): MarkerCluster[] {
  const assigned = new Set<string>();
  const clusters: MarkerCluster[] = [];

  for (const marker of markers) {
    if (assigned.has(marker.id)) continue;
    const members = [marker];
    assigned.add(marker.id);

    let grew = true;
    while (grew) {
      grew = false;
      for (const candidate of markers) {
        if (assigned.has(candidate.id)) continue;
        const overlaps = members.some(
          (member) =>
            screenDistancePx(member.coordinates, candidate.coordinates, region, mapSize) <= OVERLAP_RADIUS_PX
        );
        if (!overlaps) continue;
        members.push(candidate);
        assigned.add(candidate.id);
        grew = true;
      }
    }

    const latitude = members.reduce((sum, item) => sum + item.coordinates.lat, 0) / members.length;
    const longitude = members.reduce((sum, item) => sum + item.coordinates.lng, 0) / members.length;
    clusters.push({
      id: members
        .map((item) => item.id)
        .sort()
        .join("|"),
      coordinates: { lat: latitude, lng: longitude },
      members: members.sort((left, right) => left.index - right.index)
    });
  }

  return clusters;
}

export function OfflineGpsMap({
  markers,
  selectedId,
  userLocation,
  locating,
  locationMessage,
  onLocate,
  onSelect,
  theme,
  compact = false,
  visible = true
}: {
  markers: OfflineMapMarker[];
  selectedId?: string;
  userLocation: Coordinates | null;
  locating: boolean;
  locationMessage?: string;
  onLocate: () => void;
  onSelect: (marker: OfflineMapMarker) => void;
  theme: AppTheme;
  compact?: boolean;
  visible?: boolean;
}) {
  const { t } = useI18n();
  const mapRef = useRef<BasemapHandle>(null);
  const ignoreNextMapPressRef = useRef(false);
  const liveMarkers = useMemo(
    () =>
      markers
        .filter((marker): marker is GeographicMarker => validCoordinates(marker.coordinates))
        .map((marker, index) => ({ ...marker, index })),
    [markers]
  );
  const [heldMarkers, setHeldMarkers] = useState(liveMarkers);
  useEffect(() => {
    if (liveMarkers.length) setHeldMarkers(liveMarkers);
  }, [liveMarkers]);
  const geographicMarkers = liveMarkers.length ? liveMarkers : heldMarkers;
  const geometryJson = useMemo(
    () => JSON.stringify(geographicMarkers.map((marker) => marker.coordinates)),
    [geographicMarkers]
  );
  const initialRegion = useMemo(() => {
    const coordinates = JSON.parse(geometryJson) as Coordinates[];
    if (!coordinates.length) return undefined;
    return markerRegion(
      coordinates.map((coords, index) => ({
        id: String(index),
        label: "",
        coordinates: coords,
        index
      })),
      compact
    );
  }, [compact, geometryJson]);
  const [region, setRegion] = useState<MapRegion | undefined>(initialRegion);
  const [mapSize, setMapSize] = useState({ width: 320, height: compact ? 238 : 286 });
  const [pickerClusterId, setPickerClusterId] = useState<string>();
  /** Briefly true so custom marker views re-snapshot; kept false on Android for performance. */
  const [trackMarkerViews, setTrackMarkerViews] = useState(true);

  useEffect(() => {
    setRegion(initialRegion);
    setPickerClusterId(undefined);
  }, [initialRegion]);

  const clusters = useMemo(() => {
    if (!region) return [];
    return clusterMarkers(geographicMarkers, region, mapSize);
  }, [geographicMarkers, mapSize, region]);

  useEffect(() => {
    setTrackMarkerViews(true);
    const timer = setTimeout(() => setTrackMarkerViews(false), 600);
    return () => clearTimeout(timer);
  }, [clusters, selectedId, pickerClusterId, theme.mode]);

  const pickerCluster = useMemo(
    () => clusters.find((cluster) => cluster.id === pickerClusterId) ?? null,
    [clusters, pickerClusterId]
  );

  const nearest = useMemo(() => {
    if (!userLocation) return null;
    return (
      geographicMarkers
        .map((marker) => ({ marker, distance: distanceMeters(userLocation, marker.coordinates) }))
        .sort((left, right) => left.distance - right.distance)[0] ?? null
    );
  }, [geographicMarkers, userLocation]);

  useEffect(() => {
    if (Platform.OS === "android" && !visible) return;
    fitMarkers(mapRef.current, geographicMarkers);
  }, [geographicMarkers, visible]);

  useEffect(() => {
    if (!userLocation) return;
    if (Platform.OS === "android" && !visible) return;
    mapRef.current?.animateToRegion(regionForZoom(userLocation, compact ? 16 : 13), 700);
  }, [compact, userLocation, visible]);

  useEffect(() => {
    if (!pickerClusterId) return;
    if (!clusters.some((cluster) => cluster.id === pickerClusterId && cluster.members.length > 1)) {
      setPickerClusterId(undefined);
    }
  }, [clusters, pickerClusterId]);

  if (!geographicMarkers.length || !initialRegion) {
    return (
      <View style={[styles.unmapped, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.unmappedTitle, { color: theme.text }]}>{t("map.locationPending")}</Text>
        <Text style={[styles.unmappedBody, { color: theme.muted }]}>{t("map.locationPendingBody")}</Text>
      </View>
    );
  }

  const handleClusterPress = (cluster: MarkerCluster) => {
    ignoreNextMapPressRef.current = true;
    const onlyMember = cluster.members.length === 1 ? cluster.members[0] : undefined;
    if (onlyMember) {
      setPickerClusterId(undefined);
      onSelect(onlyMember);
      return;
    }
    setPickerClusterId(cluster.id);
  };

  const handlePickMember = (marker: IndexedMarker) => {
    setPickerClusterId(undefined);
    onSelect(marker);
  };

  const handleMapPress = () => {
    if (ignoreNextMapPressRef.current) {
      ignoreNextMapPressRef.current = false;
      return;
    }
    setPickerClusterId(undefined);
  };

  const showNativeMap = Platform.OS !== "android" || visible;

  return (
    <View>
      <View
        collapsable={false}
        style={[styles.mapFrame, compact && styles.compactMap, { borderColor: theme.border }]}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          if (width > 0 && height > 0) setMapSize({ width, height });
        }}
      >
        {showNativeMap ? (
        <Basemap
          ref={mapRef}
          initialRegion={initialRegion}
          themeMode={theme.mode === "dark" ? "dark" : "light"}
          onMapReady={() => fitMarkers(mapRef.current, geographicMarkers)}
          onRegionChangeComplete={setRegion}
          onPress={handleMapPress}
        >
          {clusters.map((cluster) => {
            const primary = cluster.members[0];
            if (!primary) return null;
            const multi = cluster.members.length > 1;
            const selected = cluster.members.some((member) => member.id === selectedId);
            const selectedMember = cluster.members.find((member) => member.id === selectedId);
            const picking = cluster.id === pickerClusterId;
            return (
              <MapMarker
                key={cluster.id}
                id={`opentopo-${cluster.id}`}
                coordinate={{
                  latitude: cluster.coordinates.lat,
                  longitude: cluster.coordinates.lng
                }}
                onPress={() => handleClusterPress(cluster)}
                tracksViewChanges={trackMarkerViews}
                zIndex={picking || selected ? 20 : multi ? 10 : 1}
              >
                <View style={styles.markerHit}>
                  {multi ? <View style={[styles.clusterShadow, { backgroundColor: theme.border }]} /> : null}
                  <View
                    style={[
                      styles.marker,
                      multi && styles.clusterMarker,
                      {
                        backgroundColor: picking || selected ? theme.accent : theme.text,
                        borderColor: theme.surface
                      }
                    ]}
                  >
                    <Text style={[styles.markerText, { color: theme.surface }]}>
                      {multi ? cluster.members.length : primary.index + 1}
                    </Text>
                  </View>
                  {selected && selectedMember ? (
                    <View style={[styles.markerLabel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      <Text numberOfLines={1} style={[styles.markerLabelTitle, { color: theme.text }]}>
                        {selectedMember.label}
                      </Text>
                      {selectedMember.detail ? (
                        <Text style={[styles.markerLabelDetail, { color: theme.muted }]}>
                          {selectedMember.detail}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </MapMarker>
            );
          })}
          {userLocation ? (
            <MapMarker
              id="opentopo-user-location"
              coordinate={{ latitude: userLocation.lat, longitude: userLocation.lng }}
              tracksViewChanges={false}
            >
              <View style={[styles.userHalo, { borderColor: theme.surface }]}>
                <View style={styles.userDot} />
              </View>
            </MapMarker>
          ) : null}
        </Basemap>
        ) : null}

        <View style={styles.mapBadgeRow}>
          <View pointerEvents="none" style={[styles.mapBadge, { backgroundColor: theme.surface }]}>
            <Text style={[styles.mapBadgeText, { color: theme.moss }]}>{t("map.badge")}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("map.accuracyA11y")}
            onPress={() => Alert.alert(t("map.accuracyTitle"), t("map.accuracyBody"))}
            style={({ pressed }) => [
              styles.infoButton,
              { backgroundColor: theme.surface, borderColor: theme.border },
              pressed && styles.pressed
            ]}
          >
            <Text style={[styles.infoButtonText, { color: theme.muted }]}>i</Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("map.findMyLocation")}
          onPress={onLocate}
          style={({ pressed }) => [styles.locateButton, { backgroundColor: theme.surface }, pressed && styles.pressed]}
        >
          <Text style={[styles.locateIcon, { color: theme.accent }]}>{locating ? "…" : "◎"}</Text>
          <Text style={[styles.locateText, { color: theme.text }]}>
            {locating ? t("map.locating") : t("map.myLocation")}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("map.showAllA11y")}
          onPress={() => {
            setPickerClusterId(undefined);
            fitMarkers(mapRef.current, geographicMarkers);
          }}
          style={({ pressed }) => [styles.resetButton, { backgroundColor: theme.surface }, pressed && styles.pressed]}
        >
          <Text style={[styles.resetText, { color: theme.text }]}>{t("map.showAll")}</Text>
        </Pressable>
      </View>

      {pickerCluster ? (
        <View style={[styles.clusterPicker, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.clusterPickerTitle, { color: theme.muted }]}>
            {t("map.chooseLocation", { count: pickerCluster.members.length })}
          </Text>
          {pickerCluster.members.map((marker) => {
            const selected = marker.id === selectedId;
            return (
              <Pressable
                key={marker.id}
                accessibilityRole="button"
                accessibilityLabel={marker.label}
                onPress={() => handlePickMember(marker)}
                style={({ pressed }) => [
                  styles.clusterOption,
                  selected && { backgroundColor: theme.accentSoft },
                  pressed && styles.pressed
                ]}
              >
                <View
                  style={[
                    styles.clusterOptionIndex,
                    { backgroundColor: selected ? theme.accent : theme.text, borderColor: theme.surface }
                  ]}
                >
                  <Text style={[styles.clusterOptionIndexText, { color: theme.surface }]}>{marker.index + 1}</Text>
                </View>
                <View style={styles.clusterOptionCopy}>
                  <Text numberOfLines={1} style={[styles.clusterOptionTitle, { color: theme.text }]}>
                    {marker.label}
                  </Text>
                  {marker.detail ? (
                    <Text numberOfLines={1} style={[styles.clusterOptionDetail, { color: theme.muted }]}>
                      {marker.detail}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.clusterOptionChevron, { color: theme.accent }]}>›</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.mapFooter}>
        <Text style={[styles.mapFooterText, { color: theme.muted }]}>
          {nearest
            ? t("map.nearest", { label: nearest.marker.label, distance: distanceLabel(nearest.distance) })
            : locationMessage || t("map.exploreHint")}
        </Text>
        <Text style={[styles.coordinateText, { color: theme.faint }]}>{t("map.gps")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapFrame: {
    height: 286,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    position: "relative"
  },
  compactMap: { height: 238 },
  mapBadgeRow: {
    position: "absolute",
    left: 12,
    top: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  mapBadge: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9 },
  mapBadgeText: { fontSize: 9, fontWeight: "900", letterSpacing: 1.15 },
  infoButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center"
  },
  infoButtonText: { fontSize: 12, fontWeight: "800", fontStyle: "italic" },
  locateButton: {
    position: "absolute",
    right: 11,
    top: 10,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 12
  },
  locateIcon: { fontSize: 18, fontWeight: "800" },
  locateText: { fontSize: 11, fontWeight: "800" },
  resetButton: {
    position: "absolute",
    right: 11,
    bottom: 10,
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 10
  },
  resetText: { fontSize: 10, fontWeight: "800" },
  pressed: { opacity: 0.7 },
  markerHit: { width: 34, height: 34, alignItems: "center", overflow: "visible" },
  marker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center"
  },
  clusterMarker: {
    width: 30,
    height: 30,
    borderRadius: 15
  },
  clusterShadow: {
    position: "absolute",
    top: 1,
    left: -3,
    width: 28,
    height: 28,
    borderRadius: 14
  },
  markerText: { fontSize: 9, fontWeight: "900" },
  markerLabel: {
    position: "absolute",
    top: 31,
    minWidth: 118,
    maxWidth: 170,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
    paddingVertical: 7,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }
  },
  markerLabelTitle: { fontSize: 11, fontWeight: "800" },
  markerLabelDetail: { fontSize: 9, marginTop: 2 },
  clusterPicker: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    paddingVertical: 4
  },
  clusterPickerTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4
  },
  clusterOption: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  clusterOptionIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center"
  },
  clusterOptionIndexText: { fontSize: 9, fontWeight: "900" },
  clusterOptionCopy: { flex: 1 },
  clusterOptionTitle: { fontSize: 13, fontWeight: "800" },
  clusterOptionDetail: { fontSize: 10, marginTop: 2 },
  clusterOptionChevron: { fontSize: 22, fontWeight: "300", marginTop: -2 },
  userHalo: {
    width: 24,
    height: 24,
    borderWidth: 3,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(46,124,246,0.22)"
  },
  userDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#2E7CF6" },
  mapFooter: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 3,
    paddingTop: 8
  },
  mapFooterText: { flex: 1, fontSize: 10, lineHeight: 14 },
  coordinateText: { fontSize: 8, fontWeight: "800", letterSpacing: 1 },
  unmapped: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 17 },
  unmappedTitle: { fontSize: 14, fontWeight: "800" },
  unmappedBody: { fontSize: 11, lineHeight: 17, marginTop: 5 }
});
