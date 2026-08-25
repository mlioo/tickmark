import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  Image,
  type ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";

import { topoAssets } from "../data/topoAssets";
import type { ProblemRow, TopoBoulderSeed, TopoPhotoSeed, TopoProblemSeed } from "../domain/types";
import { useI18n } from "../i18n";
import type { AppTheme } from "../theme/theme";
import { ZoomableView } from "./ZoomableView";

const lineColors = ["#58A6FF", "#F2C14E", "#7ED6A5", "#CE8BFF", "#FF8BA7", "#56D6D0"];

/** Cap photo stage height like the web topo panel so originals (e.g. 5712×4284) shrink to fit. */
function stageMaxHeight(variant: "preview" | "hero", windowHeight: number): number {
  if (variant === "preview") return Math.min(280, Math.round(windowHeight * 0.34));
  return Math.min(520, Math.max(280, Math.round(windowHeight * 0.48)));
}

function fitStageSize(availableWidth: number, aspectRatio: number, maxHeight: number): { width: number; height: number } {
  if (availableWidth <= 0 || aspectRatio <= 0) {
    return { width: 0, height: 0 };
  }
  const widthFromHeight = maxHeight * aspectRatio;
  const width = Math.min(availableWidth, widthFromHeight);
  const height = width / aspectRatio;
  return { width, height };
}

function parseBoulder(payload: string): TopoBoulderSeed | null {
  try {
    return JSON.parse(payload) as TopoBoulderSeed;
  } catch {
    return null;
  }
}

function validLine(line: unknown): [number, number][] {
  if (!Array.isArray(line)) return [];
  return line.filter(
    (point): point is [number, number] =>
      Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1])
  );
}

function photoSource(areaId: string, photo?: TopoPhotoSeed): ImageSourcePropType | null {
  if (!photo) return null;
  return topoAssets[`${areaId}:${photo.src}`] ?? null;
}

function problemLabel(problem: TopoProblemSeed, localizedName: (ja: string, en: string) => string): string {
  return localizedName(problem.nameJa ?? "", problem.nameEn ?? "") || problem.id;
}

function problemColor(problem: TopoProblemSeed, index: number, currentId?: string): string {
  if (problem.id === currentId) return "#F05A35";
  return lineColors[index % lineColors.length] ?? "#FFFFFF";
}

function ScaledTopoPhoto({
  source,
  fallbackAspectRatio,
  variant,
  backgroundColor,
  zoomable = false,
  resetKey,
  onScrollLockChange,
  children
}: {
  source: ImageSourcePropType;
  fallbackAspectRatio: number;
  variant: "preview" | "hero";
  backgroundColor?: string;
  zoomable?: boolean;
  resetKey?: string | number;
  onScrollLockChange?: (locked: boolean) => void;
  children: ReactNode;
}) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // Prefer topo seed dimensions so EXIF / resolveAssetSource cannot invert the stage.
  const aspectRatio = fallbackAspectRatio > 0 ? fallbackAspectRatio : 1.35;
  const [availableWidth, setAvailableWidth] = useState(windowWidth);
  const maxHeight = stageMaxHeight(variant, windowHeight);
  const stage = fitStageSize(availableWidth, aspectRatio, maxHeight);
  const stageWidth = stage.width || availableWidth;
  const stageHeight = stage.height || Math.round(stageWidth / aspectRatio);

  useEffect(() => {
    setAvailableWidth(windowWidth);
  }, [windowWidth]);

  const photoContent =
    stage.width > 0 && stage.height > 0 ? (
      <>
        {/*
          Explicit size avoids iOS 1:1 crop of large JPEGs.
          contain matches web object-fit when seed aspect ≠ decoded pixels
          (e.g. anapower seed 4284×5712 vs file 5712×4284) so % coords stay on the stage.
        */}
        <Image source={source} resizeMode="contain" style={{ width: stage.width, height: stage.height }} />
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {children}
        </View>
      </>
    ) : null;

  return (
    <View
      style={styles.stageFrame}
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        if (nextWidth > 0 && Math.abs(nextWidth - availableWidth) > 0.5) {
          setAvailableWidth(nextWidth);
        }
      }}
    >
      <View
        style={[
          variant === "preview" ? styles.previewPhoto : styles.heroPhoto,
          {
            width: stageWidth,
            height: stageHeight,
            backgroundColor
          }
        ]}
      >
        {zoomable && stage.width > 0 && stage.height > 0 ? (
          <ZoomableView
            width={stage.width}
            height={stage.height}
            resetKey={resetKey}
            onScrollLockChange={onScrollLockChange}
          >
            {photoContent}
          </ZoomableView>
        ) : (
          photoContent
        )}
      </View>
    </View>
  );
}

function LineSegment({
  from,
  to,
  width,
  height,
  color,
  muted,
  dashed = false
}: {
  from: [number, number];
  to: [number, number];
  width: number;
  height: number;
  color: string;
  muted: boolean;
  dashed?: boolean;
}) {
  const x1 = (from[0] / 100) * width;
  const y1 = (from[1] / 100) * height;
  const x2 = (to[0] / 100) * width;
  const y2 = (to[1] / 100) * height;
  const length = Math.hypot(x2 - x1, y2 - y1);
  if (length < 0.5) return null;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const thickness = dashed ? (muted ? 2.5 : 3.5) : muted ? 3 : 5;

  if (!dashed) {
    return (
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: (x1 + x2) / 2 - length / 2,
          top: (y1 + y2) / 2 - thickness / 2,
          width: length,
          height: thickness,
          borderRadius: thickness,
          backgroundColor: color,
          opacity: muted ? 0.68 : 1,
          transform: [{ rotate: `${angle}rad` }],
          shadowColor: "#000",
          shadowOpacity: 0.42,
          shadowRadius: 2,
          shadowOffset: { width: 0, height: 1 }
        }}
      />
    );
  }

  const dash = 7;
  const gap = 5;
  const pieces: ReactNode[] = [];
  for (let offset = 0; offset < length; offset += dash + gap) {
    const segLen = Math.min(dash, length - offset);
    if (segLen < 1) break;
    const t0 = offset / length;
    const t1 = (offset + segLen) / length;
    const sx = x1 + (x2 - x1) * t0;
    const sy = y1 + (y2 - y1) * t0;
    const ex = x1 + (x2 - x1) * t1;
    const ey = y1 + (y2 - y1) * t1;
    pieces.push(
      <View
        key={`dash-${offset}`}
        pointerEvents="none"
        style={{
          position: "absolute",
          left: (sx + ex) / 2 - segLen / 2,
          top: (sy + ey) / 2 - thickness / 2,
          width: segLen,
          height: thickness,
          borderRadius: thickness,
          backgroundColor: color,
          opacity: muted ? 0.55 : 0.92,
          transform: [{ rotate: `${angle}rad` }],
          shadowColor: "#fff",
          shadowOpacity: 0.35,
          shadowRadius: 1,
          shadowOffset: { width: 0, height: 0 }
        }}
      />
    );
  }
  return <>{pieces}</>;
}

function problemStartHolds(problem: TopoProblemSeed): [number, number][] {
  const starts = validLine(problem.startHolds);
  if (starts.length) return starts;
  const line = validLine(problem.line);
  return line[0] ? [line[0]] : [];
}

function problemRestrictedLines(problem: TopoProblemSeed): [number, number][][] {
  if (!Array.isArray(problem.restrictedLines)) return [];
  return problem.restrictedLines
    .map((line) => validLine(line))
    .filter((line) => line.length >= 2);
}

function problemRestrictedHolds(problem: TopoProblemSeed): [number, number][] {
  return validLine(problem.restrictedHolds);
}

function RestrictedHoldMarker({
  point,
  width,
  height
}: {
  point: [number, number];
  width: number;
  height: number;
}) {
  const size = 14;
  const left = (point[0] / 100) * width - size / 2;
  const top = (point[1] / 100) * height - size / 2;
  return (
    <View style={[styles.restrictedHold, { left, top, width: size, height: size, borderRadius: size / 2 }]}>
      <View style={[styles.restrictedHoldBar, { transform: [{ rotate: "45deg" }] }]} />
      <View style={[styles.restrictedHoldBar, { transform: [{ rotate: "-45deg" }] }]} />
    </View>
  );
}

function LineOverlay({
  problems,
  currentId,
  showAll,
  labels = true,
  localizedName
}: {
  problems: TopoProblemSeed[];
  currentId?: string;
  showAll: boolean;
  labels?: boolean;
  localizedName: (ja: string, en: string) => string;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const visible = showAll ? problems : problems.filter((problem) => problem.id === currentId);
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(event) => setSize(event.nativeEvent.layout)}
    >
      {size.width > 0
        ? visible.map((problem, problemIndex) => {
            const line = validLine(problem.line);
            if (line.length < 2) return null;
            const color = problemColor(problem, problemIndex, currentId);
            const isCurrent = problem.id === currentId;
            // Off holds/sections only after a problem is selected (hidden on boulder overview).
            const showRestricted = Boolean(currentId) && isCurrent;
            const starts = problemStartHolds(problem);
            const restrictedLines = showRestricted ? problemRestrictedLines(problem) : [];
            const restrictedHolds = showRestricted ? problemRestrictedHolds(problem) : [];
            const muted = !isCurrent && Boolean(currentId);
            return (
              <View key={problem.id} style={[StyleSheet.absoluteFill, isCurrent && styles.currentLine]}>
                {line.slice(1).map((point, index) => (
                  <LineSegment
                    key={`${problem.id}-${index}`}
                    from={line[index]!}
                    to={point}
                    width={size.width}
                    height={size.height}
                    color={color}
                    muted={muted}
                  />
                ))}
                {restrictedLines.map((restricted, restrictedIndex) =>
                  restricted.slice(1).map((point, index) => (
                    <LineSegment
                      key={`${problem.id}-off-${restrictedIndex}-${index}`}
                      from={restricted[index]!}
                      to={point}
                      width={size.width}
                      height={size.height}
                      color="#DC2626"
                      muted={false}
                      dashed
                    />
                  ))
                )}
                {starts.map((hold, holdIndex) => (
                  <View
                    key={`${problem.id}-start-${holdIndex}`}
                    style={[
                      styles.startDot,
                      {
                        left: (hold[0] / 100) * size.width - (isCurrent ? 8 : 6),
                        top: (hold[1] / 100) * size.height - (isCurrent ? 8 : 6),
                        width: isCurrent ? 16 : 12,
                        height: isCurrent ? 16 : 12,
                        borderRadius: isCurrent ? 8 : 6,
                        backgroundColor: color,
                        opacity: muted ? 0.68 : 1
                      }
                    ]}
                  >
                    {isCurrent && starts.length > 1 ? (
                      <Text style={styles.startDotIndex}>{holdIndex + 1}</Text>
                    ) : null}
                  </View>
                ))}
                {restrictedHolds.map((hold, holdIndex) => (
                  <RestrictedHoldMarker
                    key={`${problem.id}-rh-${holdIndex}`}
                    point={hold}
                    width={size.width}
                    height={size.height}
                  />
                ))}
                {labels ? (
                  <View
                    style={[
                      styles.lineLabel,
                      {
                        left: Math.min(size.width - 116, (starts[0]![0] / 100) * size.width + 10),
                        top: Math.max(5, (starts[0]![1] / 100) * size.height - 13),
                        borderColor: color
                      }
                    ]}
                  >
                    <Text numberOfLines={1} style={styles.lineLabelText}>{problemLabel(problem, localizedName)}</Text>
                  </View>
                ) : null}
              </View>
            );
          })
        : null}
    </View>
  );
}

function photoProblems(boulder: TopoBoulderSeed, photo: TopoPhotoSeed): TopoProblemSeed[] {
  const photos = boulder.photos ?? [];
  return (boulder.problems ?? []).filter((problem) => {
    if (!validLine(problem.line).length) return false;
    return problem.photoId === photo.id || (!problem.photoId && photos.length === 1);
  });
}

export function BoulderTopoPreview({
  areaId,
  payloadJson,
  theme
}: {
  areaId: string;
  payloadJson: string;
  theme: AppTheme;
}) {
  const { t, localizedName } = useI18n();
  const boulder = useMemo(() => parseBoulder(payloadJson), [payloadJson]);
  const photo = boulder?.photos?.[0];
  const source = photoSource(areaId, photo);
  if (!boulder || !photo || !source) return null;
  const lines = photoProblems(boulder, photo);
  const fallbackAspectRatio = photo.width && photo.height ? photo.width / photo.height : 1.45;

  return (
    <View style={[styles.previewWrap, { borderColor: theme.border, backgroundColor: theme.background }]}> 
      <ScaledTopoPhoto source={source} fallbackAspectRatio={fallbackAspectRatio} variant="preview" backgroundColor={theme.raised}>
        <View style={styles.photoShade} />
        <LineOverlay problems={lines} showAll labels={false} localizedName={localizedName} />
        <View style={styles.previewMeta}>
          <Text style={styles.previewMetaTitle}>
            {lines.length ? t("photoTopo.plottedLines", { count: lines.length }) : t("photoTopo.topoPhoto")}
          </Text>
          <Text style={styles.previewMetaDetail}>{t("photoTopo.availableOffline")}</Text>
        </View>
      </ScaledTopoPhoto>
    </View>
  );
}

export function ProblemPhotoTopo({
  problem,
  theme,
  onScrollLockChange
}: {
  problem: ProblemRow;
  theme: AppTheme;
  onScrollLockChange?: (locked: boolean) => void;
}) {
  const { t, localizedName } = useI18n();
  const boulder = useMemo(() => parseBoulder(problem.boulderPayloadJson), [problem.boulderPayloadJson]);
  const currentProblem = useMemo(() => {
    try {
      return JSON.parse(problem.payloadJson) as TopoProblemSeed;
    } catch {
      return null;
    }
  }, [problem.payloadJson]);
  const photos = boulder?.photos ?? [];
  const preferredPhoto = photos.find((photo) => photo.id === currentProblem?.photoId) ?? photos[0];
  const [photoId, setPhotoId] = useState(preferredPhoto?.id ?? "");
  const [showAll, setShowAll] = useState(true);

  useEffect(() => {
    setPhotoId(preferredPhoto?.id ?? "");
  }, [preferredPhoto?.id, problem.id]);

  if (!boulder || !photos.length) {
    return (
      <View style={[styles.missing, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
        <Text style={[styles.missingKicker, { color: theme.accent }]}>{t("photoTopo.kicker")}</Text>
        <Text style={[styles.missingTitle, { color: theme.text }]}>{t("photoTopo.notMappedTitle")}</Text>
        <Text style={[styles.missingBody, { color: theme.muted }]}>{t("photoTopo.notMappedBody")}</Text>
      </View>
    );
  }

  const photo = photos.find((candidate) => candidate.id === photoId) ?? preferredPhoto!;
  const source = photoSource(problem.areaId, photo);
  const lines = photoProblems(boulder, photo);
  const hasCurrentLine = lines.some((candidate) => candidate.id === problem.id);
  const fallbackAspectRatio = photo.width && photo.height ? photo.width / photo.height : 1.35;

  return (
    <View style={styles.topoSection}>
      <View style={styles.topoControls}>
        <View>
          <Text style={[styles.topoKicker, { color: theme.accent }]}>{t("photoTopo.kicker")}</Text>
          <Text style={[styles.topoTitle, { color: theme.text }]}>{localizedName(problem.boulderNameJa, problem.boulderNameEn)}</Text>
        </View>
        {lines.length > 1 ? (
          <Pressable
            onPress={() => setShowAll((value) => !value)}
            style={({ pressed }) => [styles.lineToggle, { backgroundColor: theme.surface, borderColor: theme.border }, pressed && styles.pressed]}
          >
            <Text style={[styles.lineToggleText, { color: theme.text }]}>
              {showAll ? t("photoTopo.allLines") : t("photoTopo.thisLine")}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {source ? (
        <ScaledTopoPhoto
          source={source}
          fallbackAspectRatio={fallbackAspectRatio}
          variant="hero"
          backgroundColor={theme.raised}
          zoomable
          resetKey={`${problem.id}:${photo.id}`}
          onScrollLockChange={onScrollLockChange}
        >
          <LineOverlay problems={lines} currentId={problem.id} showAll={showAll} localizedName={localizedName} />
          {!hasCurrentLine ? (
            <View style={styles.unplottedBadge}>
              <Text style={styles.unplottedText}>{t("photoTopo.linePending")}</Text>
            </View>
          ) : null}
        </ScaledTopoPhoto>
      ) : (
        <View style={[styles.missing, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
          <Text style={[styles.missingTitle, { color: theme.text }]}>{t("photoTopo.unavailableOffline")}</Text>
        </View>
      )}

      <View style={styles.captionRow}>
        <Text style={[styles.caption, { color: theme.muted }]}>
          {photo.caption || t("photoTopo.fieldPhoto")} · {t("photoTopo.pinchToZoom")}
        </Text>
        <Text style={[styles.offlineLabel, { color: theme.moss }]}>{t("photoTopo.offline")}</Text>
      </View>

      {currentProblem?.restrictionNote ? (
        <View style={[styles.restrictionNote, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <Text style={[styles.restrictionNoteLabel, { color: "#DC2626" }]}>{t("photoTopo.restricted")}</Text>
          <Text style={[styles.restrictionNoteBody, { color: theme.text }]}>{currentProblem.restrictionNote}</Text>
        </View>
      ) : null}

      {photos.length > 1 ? (
        <View style={styles.photoPicker}>
          {photos.map((candidate, index) => {
            const selected = candidate.id === photo.id;
            return (
              <Pressable
                key={candidate.id}
                onPress={() => setPhotoId(candidate.id)}
                style={({ pressed }) => [
                  styles.photoChoice,
                  { backgroundColor: selected ? theme.accentSoft : theme.surface, borderColor: selected ? theme.accent : theme.border },
                  pressed && styles.pressed
                ]}
              >
                <Text style={[styles.photoChoiceText, { color: selected ? theme.accent : theme.muted }]}>
                  {t("photoTopo.viewPhoto", { index: index + 1 })}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  previewWrap: { borderBottomWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  stageFrame: { width: "100%", alignItems: "center" },
  previewPhoto: { position: "relative", overflow: "hidden", alignSelf: "center" },
  photoShade: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(10,18,13,0.12)" },
  previewMeta: { position: "absolute", left: 12, bottom: 10, backgroundColor: "rgba(15,23,18,0.82)", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9 },
  previewMetaTitle: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  previewMetaDetail: { color: "#D3DDD6", fontSize: 8, marginTop: 2 },
  topoSection: { marginBottom: 19 },
  topoControls: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 11 },
  topoKicker: { fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  topoTitle: { fontSize: 18, fontWeight: "800", marginTop: 3 },
  lineToggle: { borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 11 },
  lineToggleText: { fontSize: 10, fontWeight: "800" },
  heroPhoto: { borderRadius: 21, overflow: "hidden", position: "relative", alignSelf: "center" },
  startDot: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 2,
    alignItems: "center",
    justifyContent: "center"
  },
  startDotIndex: { color: "#FFFFFF", fontSize: 8, fontWeight: "900" },
  restrictedHold: {
    position: "absolute",
    backgroundColor: "rgba(220,38,38,0.94)",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 2
  },
  restrictedHoldBar: {
    position: "absolute",
    width: 8,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#FFFFFF"
  },
  lineLabel: { position: "absolute", maxWidth: 116, backgroundColor: "rgba(12,18,14,0.84)", borderLeftWidth: 3, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 5 },
  lineLabelText: { color: "#FFFFFF", fontSize: 8, fontWeight: "800" },
  currentLine: { zIndex: 5 },
  unplottedBadge: { position: "absolute", right: 10, bottom: 10, backgroundColor: "rgba(15,23,18,0.82)", borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6 },
  unplottedText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800" },
  captionRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: 3, paddingTop: 8 },
  caption: { flex: 1, fontSize: 10, lineHeight: 14 },
  offlineLabel: { fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  restrictionNote: {
    marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4
  },
  restrictionNoteLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  restrictionNoteBody: { fontSize: 12, lineHeight: 17 },
  photoPicker: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 },
  photoChoice: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  photoChoiceText: { fontSize: 9, fontWeight: "800" },
  missing: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 19, padding: 18, marginBottom: 18 },
  missingKicker: { fontSize: 9, fontWeight: "900", letterSpacing: 1.4 },
  missingTitle: { fontSize: 17, fontWeight: "800", marginTop: 5 },
  missingBody: { fontSize: 12, lineHeight: 18, marginTop: 6 },
  pressed: { opacity: 0.7 }
});
