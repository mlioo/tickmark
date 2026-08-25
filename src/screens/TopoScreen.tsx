import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Linking,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { useSQLiteContext } from "expo-sqlite";

import { AttemptComposer } from "../components/AttemptComposer";
import { OfflineGpsMap, type OfflineMapMarker } from "../components/OfflineGpsMap";
import { BoulderTopoPreview, ProblemPhotoTopo } from "../components/ProblemPhotoTopo";
import { BackButton, Button, Card, EmptyState, Pill, ScreenHeader, SectionTitle } from "../components/ui";
import {
  getArea,
  getAreas,
  getBoulders,
  getProblem,
  getProblemAttempts,
  getProblemNote,
  getProblems,
  saveProblemNote
} from "../db/repository";
import type {
  AreaRow,
  AttemptResult,
  AttemptRow,
  BoulderRow,
  Coordinates,
  ProblemRow,
  TopoAreaSeed,
  TopoBoulderSeed,
  TopoParkingLot
} from "../domain/types";
import { useGradeSystem } from "../grades/GradeSystemContext";
import {
  formatCountUnit,
  localizedPayloadValue,
  useI18n,
  type AppLocale,
  type TranslationKey
} from "../i18n";
import type { AppTheme } from "../theme/theme";

type TopoRoute =
  | { kind: "areas" }
  | { kind: "area"; areaId: string }
  | { kind: "problem"; areaId: string; problemId: string };

type AccessStatusPill = {
  labelKey: TranslationKey;
  tone: "gold" | "accent";
};

const NOT_ALLOWED_STATUSES = new Set([
  "closed",
  "banned",
  "prohibited",
  "forbidden",
  "restricted",
  "not_allowed",
  "not-allowed",
  "no_entry",
  "no-entry",
  "noentry",
  "no"
]);

const JISHUKU_STATUSES = new Set(["jishuku", "自粛", "refrain", "self_restraint", "self-restraint"]);

function parsePayload<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function formatAttemptDate(iso: string, localeTag: string): string {
  return new Intl.DateTimeFormat(localeTag, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

function accessStatusPill(status: string | undefined): AccessStatusPill | null {
  const normalized = (status ?? "").trim().toLowerCase();
  if (!normalized || normalized === "open" || normalized === "unknown") return null;
  if (normalized === "sensitive") {
    return { labelKey: "topo.accessSensitive", tone: "gold" };
  }
  if (JISHUKU_STATUSES.has(normalized)) {
    return { labelKey: "topo.accessJishuku", tone: "gold" };
  }
  if (NOT_ALLOWED_STATUSES.has(normalized)) {
    return { labelKey: "topo.accessNotAllowed", tone: "accent" };
  }
  return null;
}

function parkingAvailabilityLabelKey(status: string | undefined): TranslationKey | null {
  const normalized = (status ?? "").trim().toLowerCase();
  if (normalized === "limited") return "topo.parkingLimited";
  if (normalized === "available") return "topo.parkingAvailable";
  return null;
}

function parkingTypeLabelKey(type: string | undefined): TranslationKey {
  switch ((type ?? "").trim().toLowerCase()) {
    case "free":
      return "topo.parkingTypeFree";
    case "paid":
      return "topo.parkingTypePaid";
    case "limited":
      return "topo.parkingTypeLimited";
    default:
      return "topo.parkingTypeUnknown";
  }
}

function localizedParkingNotes(lot: TopoParkingLot, locale: AppLocale): string {
  if (locale === "ja") {
    return (lot.notesJa || lot.notesEn || lot.notes || "").trim();
  }
  return (lot.notesEn || lot.notes || lot.notesJa || "").trim();
}

function localizedParkingWarnings(lot: TopoParkingLot, locale: AppLocale): string[] {
  const localized = locale === "ja" ? lot.warningsJa ?? lot.warningsEn ?? lot.warnings : lot.warningsEn ?? lot.warnings ?? lot.warningsJa;
  return Array.isArray(localized) ? localized.map((warning) => String(warning).trim()).filter(Boolean) : [];
}

function parkingMapsUrl(lot: TopoParkingLot): string | null {
  const linked = lot.googleMapsUrl?.trim();
  if (linked) return linked;
  const coordinates = lot.coordinates;
  if (!coordinates || !Number.isFinite(coordinates.lat) || !Number.isFinite(coordinates.lng)) return null;
  const { lat, lng } = coordinates;
  if (Platform.OS === "ios") {
    return `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(lot.name || "Parking")}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

async function openParkingMaps(url: string, failedTitle: string): Promise<void> {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert(failedTitle);
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert(failedTitle);
  }
}

function AreasView({
  theme,
  areas,
  query,
  setQuery,
  onSelect,
  userLocation,
  locating,
  locationMessage,
  onLocate,
  mapVisible
}: {
  theme: AppTheme;
  areas: AreaRow[];
  query: string;
  setQuery: (query: string) => void;
  onSelect: (area: AreaRow) => void;
  userLocation: Coordinates | null;
  locating: boolean;
  locationMessage: string;
  onLocate: () => void;
  mapVisible: boolean;
}) {
  const { t, localizedName, secondaryName } = useI18n();
  const [mapSelection, setMapSelection] = useState<string>();
  const markers = useMemo<OfflineMapMarker[]>(
    () =>
      areas.map((area) => {
        const payload = parsePayload<TopoAreaSeed>(area.payloadJson);
        return {
          id: area.id,
          label: localizedName(area.nameJa, area.nameEn),
          detail: `${area.prefecture} · ${t("topo.problemsCount", { count: area.problemCount })}`,
          coordinates: payload?.coordinates
        };
      }).filter((marker) => marker.coordinates),
    [areas, localizedName, t]
  );
  const selectedArea = areas.find((candidate) => candidate.id === mapSelection);

  return (
    <>
      <ScreenHeader
        eyebrow={t("topo.eyebrow")}
        title={t("topo.title")}
        subtitle={t("topo.subtitle")}
        theme={theme}
      />
      <SectionTitle title={t("topo.findClimbing")} detail={t("topo.areasCount", { count: markers.length })} theme={theme} />
      <OfflineGpsMap
        markers={markers}
        selectedId={mapSelection}
        userLocation={userLocation}
        locating={locating}
        locationMessage={locationMessage}
        onLocate={onLocate}
        onSelect={(marker) => setMapSelection(marker.id)}
        theme={theme}
        visible={mapVisible}
      />
      {selectedArea ? (
        <Pressable onPress={() => onSelect(selectedArea)} style={({ pressed }) => [styles.mapSelection, pressed && styles.pressed]}>
          <View style={styles.mapSelectionCopy}>
            <Text style={[styles.mapSelectionTitle, { color: theme.text }]}>
              {localizedName(selectedArea.nameJa, selectedArea.nameEn)}
            </Text>
            <Text style={[styles.mapSelectionMeta, { color: theme.muted }]}>
              {selectedArea.prefecture} · {t("topo.problemsCount", { count: selectedArea.problemCount })} · {t("topo.viewTopo")}
            </Text>
          </View>
          <Text style={[styles.chevron, { color: theme.accent }]}>›</Text>
        </Pressable>
      ) : null}
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t("topo.searchAreas")}
        placeholderTextColor={theme.faint}
        autoCorrect={false}
        style={[styles.search, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
      />
      <View style={styles.areaList}>
        {areas.map((area) => {
          const secondary = secondaryName(area.nameJa, area.nameEn);
          const accessPill = accessStatusPill(area.accessStatus);
          return (
          <Pressable key={area.id} onPress={() => onSelect(area)}>
            {({ pressed }) => (
              <Card theme={theme} style={pressed ? styles.pressed : undefined}>
                <View style={styles.areaTop}>
                  <View style={styles.areaCopy}>
                    <Text style={[styles.areaName, { color: theme.text }]}>
                      {localizedName(area.nameJa, area.nameEn)}
                    </Text>
                    <Text style={[styles.areaJapanese, { color: theme.muted }]}>
                      {[secondary, area.prefecture].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                  {accessPill ? <Pill label={t(accessPill.labelKey)} theme={theme} tone={accessPill.tone} /> : null}
                </View>
                <View style={[styles.areaFooter, { borderColor: theme.border }]}>
                  <Text style={[styles.areaStat, { color: theme.muted }]}>
                    {t("topo.problemsCount", { count: area.problemCount })}
                  </Text>
                  <Text style={[styles.areaStat, { color: theme.muted }]}>
                    {area.approachMinutes
                      ? t("topo.minApproach", { minutes: area.approachMinutes })
                      : t("topo.approachVaries")}
                  </Text>
                  <Text style={[styles.chevron, { color: theme.faint }]}>›</Text>
                </View>
              </Card>
            )}
          </Pressable>
        );
        })}
      </View>
    </>
  );
}

function AreaView({
  theme,
  area,
  boulders,
  problems,
  query,
  setQuery,
  onBack,
  onProblem,
  userLocation,
  locating,
  locationMessage,
  onLocate,
  mapVisible
}: {
  theme: AppTheme;
  area: AreaRow;
  boulders: BoulderRow[];
  problems: ProblemRow[];
  query: string;
  setQuery: (query: string) => void;
  onBack: () => void;
  onProblem: (problem: ProblemRow) => void;
  userLocation: Coordinates | null;
  locating: boolean;
  locationMessage: string;
  onLocate: () => void;
  mapVisible: boolean;
}) {
  const { t, locale, localizedName, secondaryName } = useI18n();
  const { formatGrade } = useGradeSystem();
  const [focusedBoulderId, setFocusedBoulderId] = useState<string>();
  const boulderById = useMemo(() => new Map(boulders.map((boulder) => [boulder.id, boulder])), [boulders]);
  const areaPayload = useMemo(() => parsePayload<TopoAreaSeed>(area.payloadJson), [area.payloadJson]);
  const parkingLots = useMemo(
    () => (Array.isArray(areaPayload?.parkingLots) ? areaPayload.parkingLots.filter((lot) => lot?.name) : []),
    [areaPayload]
  );
  const parkingStatusKey = parkingAvailabilityLabelKey(areaPayload?.parking);
  const showParking = parkingLots.length > 0 || parkingStatusKey !== null;
  const markers = useMemo<OfflineMapMarker[]>(
    () =>
      boulders
        .map((boulder) => {
          const payload = parsePayload<TopoBoulderSeed>(boulder.payloadJson);
          return {
            id: boulder.id,
            label: localizedName(boulder.nameJa, boulder.nameEn) || t("common.boulder"),
            detail: t("topo.problemsCount", { count: boulder.problemCount }),
            coordinates: payload?.coordinates
          };
        })
        .filter((marker) => marker.coordinates),
    [boulders, localizedName, t]
  );
  const grouped = useMemo(() => {
    const map = new Map<string, ProblemRow[]>();
    for (const problem of problems) {
      const rows = map.get(problem.boulderId) ?? [];
      rows.push(problem);
      map.set(problem.boulderId, rows);
    }
    return [...map.entries()].sort(([left], [right]) => {
      if (left === focusedBoulderId) return -1;
      if (right === focusedBoulderId) return 1;
      return 0;
    });
  }, [focusedBoulderId, problems]);

  const areaSecondary = secondaryName(area.nameJa, area.nameEn);
  const accessPill = accessStatusPill(area.accessStatus);
  const approachLabel = area.approachMinutes
    ? t("topo.minApproach", { minutes: area.approachMinutes })
    : t("topo.approachTimeVaries");
  const parkingDetail = parkingLots.length
    ? t("topo.parkingLotsCount", { count: parkingLots.length })
    : parkingStatusKey
      ? t(parkingStatusKey)
      : undefined;

  return (
    <>
      <BackButton label={t("topo.allAreas")} onPress={onBack} theme={theme} />
      <View style={styles.detailHeading}>
        <View style={styles.areaCopy}>
          <Text style={[styles.detailTitle, { color: theme.text }]}>
            {localizedName(area.nameJa, area.nameEn)}
          </Text>
          <Text style={[styles.detailSubtitle, { color: theme.muted }]}>
            {[areaSecondary, area.prefecture].filter(Boolean).join(" · ")}
          </Text>
        </View>
        {accessPill ? <Pill label={t(accessPill.labelKey)} theme={theme} tone={accessPill.tone} /> : null}
      </View>

      <Card theme={theme} style={[styles.accessCard, { backgroundColor: theme.mossSoft }]}>
        <Text style={[styles.accessKicker, { color: theme.moss }]}>{t("topo.accessFirst")}</Text>
        <Text style={[styles.accessText, { color: theme.text }]}>
          {area.accessNote || t("topo.accessDefault")}
        </Text>
        <Text style={[styles.accessMeta, { color: theme.muted }]}>
          {t("topo.updated", {
            date: area.updatedAt || t("topo.inBundledTopo"),
            approach: approachLabel
          })}
        </Text>
      </Card>

      {showParking ? (
        <View style={styles.parkingSection}>
          <SectionTitle title={t("topo.parking")} detail={parkingDetail} theme={theme} />
          {parkingLots.length === 0 ? (
            <Card theme={theme} style={styles.parkingCard}>
              {parkingStatusKey ? (
                <Pill label={t(parkingStatusKey)} theme={theme} tone="gold" />
              ) : null}
              <Text style={[styles.parkingNotes, parkingStatusKey && styles.parkingNotesAfterPill, { color: theme.text }]}>
                {t("topo.parkingStatusOnly")}
              </Text>
            </Card>
          ) : (
            parkingLots.map((lot, index) => {
              const notes = localizedParkingNotes(lot, locale);
              const warnings = localizedParkingWarnings(lot, locale);
              const mapsUrl = parkingMapsUrl(lot);
              return (
                <Card key={`${lot.name}-${index}`} theme={theme} style={styles.parkingCard}>
                  <View style={styles.parkingHeader}>
                    <Text style={[styles.parkingName, { color: theme.text }]}>{lot.name}</Text>
                    <Pill label={t(parkingTypeLabelKey(lot.type))} theme={theme} tone="moss" />
                  </View>
                  {parkingStatusKey && index === 0 ? (
                    <Text style={[styles.parkingStatus, { color: theme.muted }]}>{t(parkingStatusKey)}</Text>
                  ) : null}
                  {notes ? <Text style={[styles.parkingNotes, { color: theme.text }]}>{notes}</Text> : null}
                  {warnings.length ? (
                    <View style={styles.parkingWarnings}>
                      {warnings.map((warning) => (
                        <Text key={warning} style={[styles.parkingWarning, { color: theme.gold }]}>
                          · {warning}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  {mapsUrl ? (
                    <Button
                      label={t("topo.openInMaps")}
                      onPress={() => {
                        void openParkingMaps(mapsUrl, t("topo.couldNotOpenMaps"));
                      }}
                      theme={theme}
                      kind="secondary"
                      compact
                      style={styles.parkingMapsButton}
                    />
                  ) : null}
                </Card>
              );
            })
          )}
        </View>
      ) : null}

      {markers.length ? (
        <View style={styles.boulderMapSection}>
          <SectionTitle title={t("topo.findBoulders")} detail={t("topo.mappedCount", { count: markers.length })} theme={theme} />
          <OfflineGpsMap
            markers={markers}
            selectedId={focusedBoulderId}
            userLocation={userLocation}
            locating={locating}
            locationMessage={locationMessage}
            onLocate={onLocate}
            onSelect={(marker) => setFocusedBoulderId(marker.id)}
            theme={theme}
            compact
            visible={mapVisible}
          />
          {focusedBoulderId ? (
            <Pressable onPress={() => setFocusedBoulderId(undefined)} style={styles.clearFocus}>
              <Text style={[styles.clearFocusText, { color: theme.accent }]}>{t("topo.showingSelected")}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t("topo.searchProblems")}
        placeholderTextColor={theme.faint}
        autoCorrect={false}
        style={[styles.search, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
      />

      {grouped.map(([boulderId, rows]) => {
        const boulder = boulderById.get(boulderId);
        return (
          <View key={boulderId} style={styles.boulderGroup}>
            <SectionTitle
              title={boulder ? localizedName(boulder.nameJa, boulder.nameEn) : t("common.boulder")}
              detail={`${rows.length}`}
              theme={theme}
            />
            <Card theme={theme} style={styles.problemCard}>
              {boulder ? <BoulderTopoPreview areaId={area.id} payloadJson={boulder.payloadJson} theme={theme} /> : null}
              {rows.map((problem, index) => {
                const secondary = secondaryName(problem.nameJa, problem.nameEn);
                const meta = [secondary, problem.style].filter(Boolean).join(" · ");
                return (
                <Pressable
                  key={problem.id}
                  onPress={() => onProblem(problem)}
                  style={({ pressed }) => [
                    styles.problemRow,
                    index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                    pressed && styles.pressed
                  ]}
                >
                  <View style={styles.problemCopy}>
                    <Text style={[styles.problemName, { color: theme.text }]}>
                      {localizedName(problem.nameJa, problem.nameEn)}
                    </Text>
                    {meta ? (
                      <Text style={[styles.problemMeta, { color: theme.muted }]}>{meta}</Text>
                    ) : null}
                  </View>
                  {problem.grade ? <Pill label={formatGrade(problem.grade)} theme={theme} tone="gold" /> : null}
                  <Text style={[styles.problemChevron, { color: theme.faint }]}>›</Text>
                </Pressable>
              );
              })}
            </Card>
          </View>
        );
      })}
    </>
  );
}

function ProblemView({
  theme,
  problem,
  attempts,
  note,
  setNote,
  onSaveNote,
  onBack,
  onLog,
  onPhotoScrollLockChange
}: {
  theme: AppTheme;
  problem: ProblemRow;
  attempts: AttemptRow[];
  note: string;
  setNote: (note: string) => void;
  onSaveNote: () => void;
  onBack: () => void;
  onLog: (result: AttemptResult) => void;
  onPhotoScrollLockChange?: (locked: boolean) => void;
}) {
  const { t, locale, localeTag, localizedName, secondaryName } = useI18n();
  const { formatGrade } = useGradeSystem();
  const payload = JSON.parse(problem.payloadJson) as Record<string, unknown>;
  const description = localizedPayloadValue(payload.description, locale);
  const start = localizedPayloadValue(payload.start, locale);
  const topout = localizedPayloadValue(payload.topout, locale);
  const sends = attempts.filter((attempt) => attempt.result === "send" || attempt.result === "flash").length;
  const totalTries = attempts.reduce((sum, attempt) => sum + attempt.tryCount, 0);
  const problemSecondary = secondaryName(problem.nameJa, problem.nameEn);

  return (
    <>
      <BackButton label={localizedName(problem.areaNameJa, problem.areaNameEn)} onPress={onBack} theme={theme} />
      <View style={styles.problemHeading}>
        <View style={styles.problemHeadingCopy}>
          <Text style={[styles.problemTitle, { color: theme.text }]}>
            {localizedName(problem.nameJa, problem.nameEn)}
          </Text>
          <Text style={[styles.detailSubtitle, { color: theme.muted }]}>
            {[problemSecondary, localizedName(problem.boulderNameJa, problem.boulderNameEn)].filter(Boolean).join(" · ")}
          </Text>
        </View>
        {problem.grade ? <Pill label={formatGrade(problem.grade)} theme={theme} tone="gold" /> : null}
      </View>

      <View style={styles.tags}>
        {problem.style ? <Pill label={problem.style} theme={theme} /> : null}
        {problem.landing ? <Pill label={t("topo.landing", { value: problem.landing })} theme={theme} /> : null}
        {attempts.length ? (
          <Pill
            label={t("topo.triesSends", {
              tries: totalTries,
              triesUnit: formatCountUnit(totalTries, "common.try", "common.tries", t),
              sends
            })}
            theme={theme}
            tone="moss"
          />
        ) : null}
      </View>

      <ProblemPhotoTopo problem={problem} theme={theme} onScrollLockChange={onPhotoScrollLockChange} />

      {description || start || topout ? (
        <Card theme={theme} style={styles.betaCard}>
          {description ? <InfoBlock label={t("topo.description")} body={description} theme={theme} /> : null}
          {start ? <InfoBlock label={t("topo.start")} body={start} theme={theme} /> : null}
          {topout ? <InfoBlock label={t("topo.topout")} body={topout} theme={theme} /> : null}
        </Card>
      ) : null}

      <View style={styles.logActions}>
        <Button label={t("common.attempt")} onPress={() => onLog("attempt")} theme={theme} kind="secondary" style={styles.logButton} />
        <Button label={t("common.send")} onPress={() => onLog("send")} theme={theme} style={styles.logButton} />
      </View>

      <SectionTitle title={t("topo.myNotes")} detail={t("topo.savedOffline")} theme={theme} style={styles.sectionSpacing} />
      <Card theme={theme}>
        <TextInput
          multiline
          value={note}
          onChangeText={setNote}
          placeholder={t("topo.notePlaceholder")}
          placeholderTextColor={theme.faint}
          textAlignVertical="top"
          style={[styles.noteInput, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
        />
        <Button label={t("topo.saveProblemNote")} onPress={onSaveNote} theme={theme} kind="secondary" compact style={styles.noteButton} />
      </Card>

      <SectionTitle
        title={t("topo.attemptHistory")}
        detail={attempts.length ? t("topo.entriesCount", { count: attempts.length }) : undefined}
        theme={theme}
        style={styles.sectionSpacing}
      />
      {attempts.length === 0 ? (
        <Card theme={theme}>
          <EmptyState
            title={t("topo.noAttemptsTitle")}
            body={t("topo.noAttemptsBody")}
            theme={theme}
          />
        </Card>
      ) : (
        <Card theme={theme} style={styles.historyCard}>
          {attempts.map((attempt, index) => {
            const tryUnit = formatCountUnit(attempt.tryCount, "common.try", "common.tries", t);
            return (
            <View
              key={attempt.id}
              style={[
                styles.historyRow,
                index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }
              ]}
            >
              <View
                style={[
                  styles.resultMark,
                  { backgroundColor: attempt.result === "attempt" ? theme.background : theme.mossSoft }
                ]}
              >
                <Text style={[styles.resultMarkText, { color: attempt.result === "attempt" ? theme.muted : theme.moss }]}>
                  {attempt.result === "attempt" ? "A" : attempt.result === "flash" ? "F" : "S"}
                </Text>
              </View>
              <View style={styles.historyCopy}>
                <Text style={[styles.historyTitle, { color: theme.text }]}>
                  {attempt.result === "attempt"
                    ? `${attempt.tryCount} ${tryUnit}`
                    : attempt.result === "flash"
                      ? t("topo.flashOneTry")
                      : t("topo.sendTries", { count: attempt.tryCount, unit: tryUnit })}
                </Text>
                <Text style={[styles.historyMeta, { color: theme.muted }]}>{formatAttemptDate(attempt.occurredAt, localeTag)}</Text>
                {attempt.notes ? <Text style={[styles.historyNotes, { color: theme.muted }]}>{attempt.notes}</Text> : null}
              </View>
              <Text style={[styles.feel, { color: theme.accent }]}>
                {attempt.perceivedDifficulty > 0 ? `+${attempt.perceivedDifficulty}` : attempt.perceivedDifficulty}
              </Text>
            </View>
          );
          })}
        </Card>
      )}
    </>
  );
}

function InfoBlock({ label, body, theme }: { label: string; body: string; theme: AppTheme }) {
  return (
    <View style={styles.infoBlock}>
      <Text style={[styles.infoLabel, { color: theme.accent }]}>{label}</Text>
      <Text style={[styles.infoBody, { color: theme.text }]}>{body}</Text>
    </View>
  );
}

export function TopoScreen({
  theme,
  revision,
  onMutate,
  visible = true,
  initialAreaId,
  initialProblemId
}: {
  theme: AppTheme;
  revision: number;
  onMutate: () => void;
  visible?: boolean;
  initialAreaId?: string;
  initialProblemId?: string;
}) {
  const db = useSQLiteContext();
  const { t } = useI18n();
  const [route, setRoute] = useState<TopoRoute>(() => {
    if (initialAreaId && initialProblemId) return { kind: "problem", areaId: initialAreaId, problemId: initialProblemId };
    if (initialAreaId) return { kind: "area", areaId: initialAreaId };
    return { kind: "areas" };
  });
  const [query, setQuery] = useState("");
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [area, setArea] = useState<AreaRow | null>(null);
  const [boulders, setBoulders] = useState<BoulderRow[]>([]);
  const [problems, setProblems] = useState<ProblemRow[]>([]);
  const [problem, setProblem] = useState<ProblemRow | null>(null);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [note, setNote] = useState("");
  const [attemptOpen, setAttemptOpen] = useState(false);
  const [initialResult, setInitialResult] = useState<AttemptResult>("attempt");
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationState, setLocationState] = useState<
    | { kind: "default" }
    | { kind: "off" }
    | { kind: "permission" }
    | { kind: "live" }
    | { kind: "error"; message: string }
  >({ kind: "default" });
  const locationMessage = useMemo(() => {
    switch (locationState.kind) {
      case "default":
        return t("topo.locationDefault");
      case "off":
        return t("topo.locationOff");
      case "permission":
        return t("topo.locationPermission");
      case "live":
        return Platform.OS === "android" ? t("topo.locationLiveAndroid") : t("topo.locationLiveIos");
      case "error":
        return t("topo.locationError", { message: locationState.message });
    }
  }, [locationState, t]);
  const [floatingSearchVisible, setFloatingSearchVisible] = useState(false);
  const [photoScrollLocked, setPhotoScrollLocked] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const lastScrollOffset = useRef(0);
  const areaScrollOffset = useRef(0);
  const restoreAreaScroll = useRef(false);
  const prevRouteRef = useRef(route);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (route.kind !== "problem") setPhotoScrollLocked(false);
  }, [route.kind]);

  const load = useCallback(async () => {
    if (route.kind === "areas") {
      setAreas(await getAreas(db, query));
      return;
    }
    if (route.kind === "area") {
      const [areaRow, boulderRows, problemRows] = await Promise.all([
        getArea(db, route.areaId),
        getBoulders(db, route.areaId),
        getProblems(db, route.areaId, query)
      ]);
      setArea(areaRow);
      setBoulders(boulderRows);
      setProblems(problemRows);
      return;
    }
    const [problemRow, attemptRows, savedNote] = await Promise.all([
      getProblem(db, route.areaId, route.problemId),
      getProblemAttempts(db, route.areaId, route.problemId),
      getProblemNote(db, route.areaId, route.problemId)
    ]);
    setProblem(problemRow);
    setAttempts(attemptRows);
    setNote(savedNote);
  }, [db, query, route]);

  useEffect(() => {
    void load();
  }, [load, revision]);

  useEffect(() => {
    const previous = prevRouteRef.current;
    prevRouteRef.current = route;

    if (route.kind === "areas") {
      setFloatingSearchVisible(false);
      lastScrollOffset.current = 0;
      areaScrollOffset.current = 0;
      restoreAreaScroll.current = false;
      return;
    }

    if (route.kind === "area") {
      const returningFromProblem = previous.kind === "problem" && previous.areaId === route.areaId;
      if (returningFromProblem) {
        // restoreAreaScroll is armed synchronously in ProblemView onBack.
        return;
      }
      setFloatingSearchVisible(false);
      lastScrollOffset.current = 0;
      areaScrollOffset.current = 0;
      restoreAreaScroll.current = false;
      return;
    }

    setFloatingSearchVisible(false);
  }, [route]);

  useEffect(() => {
    if (route.kind !== "area" || !area || !restoreAreaScroll.current) return;
    const timer = setTimeout(() => restoreAreaScrollIfNeeded(), 0);
    return () => clearTimeout(timer);
  }, [route, area, boulders, problems]);

  useEffect(
    () => () => {
      locationSubscription.current?.remove();
      locationSubscription.current = null;
    },
    []
  );

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const offset = Math.max(0, event.nativeEvent.contentOffset.y);
    const delta = offset - lastScrollOffset.current;
    if (route.kind === "area") {
      areaScrollOffset.current = offset;
      if (offset > 260 && delta < -3) setFloatingSearchVisible(true);
      if (offset < 190 || delta > 5) setFloatingSearchVisible(false);
    }
    lastScrollOffset.current = offset;
  }

  function restoreAreaScrollIfNeeded() {
    if (!restoreAreaScroll.current || route.kind !== "area") return;
    const y = areaScrollOffset.current;
    restoreAreaScroll.current = false;
    if (y <= 0) return;
    scrollRef.current?.scrollTo({ y, animated: false });
    lastScrollOffset.current = y;
    setFloatingSearchVisible(y > 260);
  }

  async function refresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  async function persistNote() {
    if (!problem) return;
    await saveProblemNote(db, problem.areaId, problem.id, note);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onMutate();
  }

  async function locateUser() {
    setLocating(true);
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setLocationState({ kind: "off" });
        return;
      }
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationState({ kind: "permission" });
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ lat: location.coords.latitude, lng: location.coords.longitude });
      locationSubscription.current?.remove();
      locationSubscription.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 10, timeInterval: 5000 },
        (nextLocation) => {
          setUserLocation({ lat: nextLocation.coords.latitude, lng: nextLocation.coords.longitude });
        }
      );
      setLocationState({ kind: "live" });
      await Haptics.selectionAsync();
    } catch (error) {
      setLocationState({
        kind: "error",
        message: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setLocating(false);
    }
  }

  return (
    <>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        onScroll={handleScroll}
        onContentSizeChange={() => restoreAreaScrollIfNeeded()}
        scrollEventThrottle={16}
        scrollEnabled={!photoScrollLocked}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} />}
      >
        {route.kind === "areas" ? (
          <AreasView
            theme={theme}
            areas={areas}
            query={query}
            setQuery={setQuery}
            userLocation={userLocation}
            locating={locating}
            locationMessage={locationMessage}
            onLocate={() => void locateUser()}
            mapVisible={visible}
            onSelect={(selected) => {
              setQuery("");
              setRoute({ kind: "area", areaId: selected.id });
            }}
          />
        ) : null}
        {route.kind === "area" && area ? (
          <AreaView
            theme={theme}
            area={area}
            boulders={boulders}
            problems={problems}
            query={query}
            setQuery={setQuery}
            userLocation={userLocation}
            locating={locating}
            locationMessage={locationMessage}
            onLocate={() => void locateUser()}
            mapVisible={visible}
            onBack={() => {
              setQuery("");
              setRoute({ kind: "areas" });
            }}
            onProblem={(selected) => {
              areaScrollOffset.current = lastScrollOffset.current;
              setRoute({ kind: "problem", areaId: selected.areaId, problemId: selected.id });
            }}
          />
        ) : null}
        {route.kind === "problem" && problem ? (
          <ProblemView
            theme={theme}
            problem={problem}
            attempts={attempts}
            note={note}
            setNote={setNote}
            onSaveNote={() => void persistNote().catch((error) => Alert.alert(t("alerts.couldNotSaveNote"), String(error)))}
            onBack={() => {
              restoreAreaScroll.current = true;
              setRoute({ kind: "area", areaId: problem.areaId });
            }}
            onLog={(result) => {
              setInitialResult(result);
              setAttemptOpen(true);
            }}
            onPhotoScrollLockChange={setPhotoScrollLocked}
          />
        ) : null}
      </ScrollView>
      {route.kind === "area" && floatingSearchVisible ? (
        <View style={[styles.floatingSearchWrap, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}> 
          <Text style={[styles.floatingSearchIcon, { color: theme.faint }]}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("topo.searchProblems")}
            placeholderTextColor={theme.faint}
            autoCorrect={false}
            style={[styles.floatingSearch, { color: theme.text }]}
          />
        </View>
      ) : null}
      <AttemptComposer
        visible={attemptOpen}
        problem={problem}
        initialResult={initialResult}
        onClose={() => setAttemptOpen(false)}
        onSaved={() => {
          onMutate();
          void load();
        }}
        theme={theme}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 120 },
  search: { height: 50, borderRadius: 16, borderWidth: 1, paddingHorizontal: 15, fontSize: 15, marginTop: 8, marginBottom: 17 },
  floatingSearchWrap: {
    position: "absolute",
    left: 18,
    right: 18,
    top: 9,
    zIndex: 30,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    shadowOpacity: 0.17,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12
  },
  floatingSearchIcon: { fontSize: 20, marginRight: 8 },
  floatingSearch: { flex: 1, height: "100%", fontSize: 15 },
  areaList: { gap: 11 },
  pressed: { opacity: 0.7 },
  mapSelection: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 3, marginBottom: 4 },
  mapSelectionCopy: { flex: 1 },
  mapSelectionTitle: { fontSize: 14, fontWeight: "800" },
  mapSelectionMeta: { fontSize: 10, marginTop: 3 },
  areaTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  areaCopy: { flex: 1 },
  areaName: { fontSize: 21, fontWeight: "800", letterSpacing: -0.4 },
  areaJapanese: { fontSize: 12, marginTop: 5 },
  areaFooter: { flexDirection: "row", alignItems: "center", gap: 13, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 16, paddingTop: 13 },
  areaStat: { fontSize: 11, fontWeight: "600" },
  chevron: { marginLeft: "auto", fontSize: 24, lineHeight: 18 },
  detailHeading: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 20 },
  detailTitle: { fontSize: 31, lineHeight: 35, fontWeight: "800", letterSpacing: -0.9 },
  detailSubtitle: { fontSize: 13, marginTop: 6 },
  accessCard: { marginBottom: 18 },
  accessKicker: { fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 8 },
  accessText: { fontSize: 14, lineHeight: 21, fontWeight: "600" },
  accessMeta: { fontSize: 11, lineHeight: 16, marginTop: 11 },
  parkingSection: { marginBottom: 18, gap: 10 },
  parkingCard: { gap: 10 },
  parkingHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  parkingName: { flex: 1, fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  parkingStatus: { fontSize: 11, fontWeight: "700" },
  parkingNotes: { fontSize: 14, lineHeight: 21, fontWeight: "600" },
  parkingNotesAfterPill: { marginTop: 2 },
  parkingWarnings: { gap: 4 },
  parkingWarning: { fontSize: 12, lineHeight: 18, fontWeight: "700" },
  parkingMapsButton: { alignSelf: "flex-start", marginTop: 2 },
  boulderMapSection: { marginBottom: 13 },
  clearFocus: { alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 3 },
  clearFocusText: { fontSize: 10, fontWeight: "800" },
  boulderGroup: { marginTop: 6, marginBottom: 18 },
  problemCard: { padding: 0, overflow: "hidden" },
  problemRow: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 15, paddingVertical: 11 },
  problemCopy: { flex: 1 },
  problemName: { fontSize: 15, fontWeight: "700" },
  problemMeta: { fontSize: 11, marginTop: 4 },
  problemChevron: { fontSize: 23, marginLeft: -2 },
  problemHeading: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  problemHeadingCopy: { flex: 1 },
  problemTitle: { fontSize: 31, lineHeight: 35, fontWeight: "800", letterSpacing: -0.9 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 15, marginBottom: 18 },
  betaCard: { gap: 17 },
  infoBlock: { gap: 5 },
  infoLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 1.4 },
  infoBody: { fontSize: 14, lineHeight: 21 },
  logActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  logButton: { flex: 1 },
  sectionSpacing: { marginTop: 28 },
  noteInput: { minHeight: 104, borderWidth: 1, borderRadius: 15, padding: 13, fontSize: 14, lineHeight: 20 },
  noteButton: { alignSelf: "flex-end", marginTop: 11 },
  historyCard: { paddingVertical: 2 },
  historyRow: { flexDirection: "row", gap: 12, paddingVertical: 14 },
  resultMark: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  resultMarkText: { fontSize: 13, fontWeight: "800" },
  historyCopy: { flex: 1 },
  historyTitle: { fontSize: 14, fontWeight: "700" },
  historyMeta: { fontSize: 11, marginTop: 3 },
  historyNotes: { fontSize: 13, lineHeight: 18, marginTop: 8 },
  feel: { fontSize: 13, fontWeight: "800", paddingTop: 3 }
});
