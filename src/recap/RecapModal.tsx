import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";

import { SegmentedControl } from "../components/ui";
import { getRecapStats, listSessionYears, statsRanges } from "../db/repository";
import { remapGradeBars } from "../domain/grades";
import type { RecapSummary } from "../domain/types";
import { useGradeSystem } from "../grades/GradeSystemContext";
import { useI18n } from "../i18n";
import type { AppTheme } from "../theme/theme";
import { RecapStoryPager, type RecapStoryPagerHandle } from "./RecapStoryPager";
import {
  isRecapEmpty,
  periodTitle,
  RECAP_SLIDE_IDS,
  resolveRecapBounds,
  type ProgressRangeKey,
  type RecapRangeMode,
  type RecapShareFormat
} from "./recapStats";
import { ensurePhotoLibraryWriteAccess, saveRecapSlideToLibrary, shareRecapSlide } from "./shareRecap";
import { StatsCardPreview, type StatsCardPreviewHandle } from "./StatsCardPreview";

const emptyRecap: RecapSummary = {
  totalSends: 0,
  flashCount: 0,
  uniqueProblemsSent: 0,
  totalSessions: 0,
  outdoorMinutes: 0,
  hardestGrade: "—",
  averageGrade: "—",
  hardestSend: null,
  hardestSends: [],
  topArea: null,
  otherAreas: [],
  gradeSends: [],
  periodStart: null,
  periodEnd: null
};

export function RecapModal({
  visible,
  onClose,
  theme,
  initialRangeKey
}: {
  visible: boolean;
  onClose: () => void;
  theme: AppTheme;
  initialRangeKey: ProgressRangeKey;
}) {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const { formatGrade, gradeSystem } = useGradeSystem();
  const pagerRef = useRef<RecapStoryPagerHandle>(null);
  const statsCardRef = useRef<StatsCardPreviewHandle>(null);

  const [format, setFormat] = useState<RecapShareFormat>("stats");
  const [mode, setMode] = useState<RecapRangeMode>("progress");
  const [rangeKey, setRangeKey] = useState<ProgressRangeKey>(initialRangeKey);
  const [year, setYear] = useState(new Date().getFullYear());
  const [years, setYears] = useState<number[]>([]);
  const [stats, setStats] = useState<RecapSummary>(emptyRecap);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ current: number; total: number } | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const cancelSaveRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    setFormat("stats");
    setMode("progress");
    setRangeKey(initialRangeKey);
    setSlideIndex(0);
  }, [initialRangeKey, visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void listSessionYears(db).then((rows) => {
      if (cancelled) return;
      setYears(rows);
      if (rows.length) setYear(rows[0]!);
    });
    return () => {
      cancelled = true;
    };
  }, [db, visible]);

  const bounds = useMemo(
    () => resolveRecapBounds(mode, rangeKey, year),
    [mode, rangeKey, year]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await getRecapStats(db, bounds, locale));
    } catch {
      setStats(emptyRecap);
    } finally {
      setLoading(false);
    }
  }, [bounds, db, locale]);

  useEffect(() => {
    if (!visible) return;
    void load();
  }, [load, visible]);

  const period = periodTitle(mode, rangeKey, year, t);
  const gradeBars = useMemo(() => {
    const bars = remapGradeBars(stats.gradeSends, gradeSystem);
    return [...bars].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  }, [gradeSystem, stats.gradeSends]);
  const empty = isRecapEmpty(stats);

  async function shareCurrent() {
    const shot =
      format === "stats"
        ? statsCardRef.current?.getCardRef()
        : (() => {
            const handle = pagerRef.current;
            return handle?.getSlideRef(handle.currentIndex) ?? null;
          })();
    if (!shot) return;
    setSharing(true);
    try {
      await shareRecapSlide(
        shot,
        format === "stats" ? t("progress.recap.shareStats") : t("progress.recap.shareSlide")
      );
    } catch (error) {
      Alert.alert(
        t("progress.recap.shareFailed"),
        error instanceof Error ? error.message : t("common.pleaseTryAgain")
      );
    } finally {
      setSharing(false);
    }
  }

  async function saveAll() {
    const handle = pagerRef.current;
    if (!handle || saveProgress) return;

    const allowed = await ensurePhotoLibraryWriteAccess();
    if (!allowed) {
      Alert.alert(t("progress.recap.permissionDeniedTitle"), t("progress.recap.permissionDeniedBody"));
      return;
    }

    cancelSaveRef.current = false;
    const total = handle.slideCount;
    let saved = 0;
    setSaveProgress({ current: 0, total });

    try {
      for (let i = 0; i < total; i += 1) {
        if (cancelSaveRef.current) break;
        setSaveProgress({ current: i + 1, total });
        const shot = handle.getSlideRef(i);
        if (!shot) continue;
        await saveRecapSlideToLibrary(shot, `opentopo-recap-${Date.now()}-${i + 1}.png`);
        saved += 1;
      }

      if (cancelSaveRef.current) {
        if (saved > 0) {
          Alert.alert(
            t("progress.recap.saveCancelledTitle"),
            t("progress.recap.saveCancelledBody", { count: saved, total })
          );
        }
        return;
      }

      Alert.alert(t("progress.recap.saveDoneTitle"), t("progress.recap.saveDoneBody", { count: saved }));
    } catch (error) {
      Alert.alert(
        t("progress.recap.saveFailed"),
        error instanceof Error ? error.message : t("common.pleaseTryAgain")
      );
    } finally {
      setSaveProgress(null);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={[styles.kicker, { color: theme.accent }]}>{t("progress.recap.title")}</Text>
            <Text style={[styles.title, { color: theme.text }]}>{period}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("progress.recap.closeA11y")}
            hitSlop={10}
            onPress={onClose}
            style={[styles.close, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Text style={[styles.closeText, { color: theme.text }]}>×</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <SegmentedControl
            options={[
              { value: "stats", label: t("progress.recap.formatStats") },
              { value: "stories", label: t("progress.recap.formatStories") }
            ]}
            value={format}
            onChange={setFormat}
            theme={theme}
          />

          <SegmentedControl
            options={[
              { value: "progress", label: t("progress.recap.modeProgress") },
              { value: "year", label: t("progress.recap.modeYear") }
            ]}
            value={mode}
            onChange={setMode}
            theme={theme}
          />

          {mode === "progress" ? (
            <SegmentedControl
              options={statsRanges.map((option) => ({ value: option.key, label: option.label }))}
              value={rangeKey}
              onChange={setRangeKey}
              theme={theme}
            />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearRow}>
              {(years.length ? years : [new Date().getFullYear()]).map((item) => {
                const selected = item === year;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setYear(item)}
                    style={[
                      styles.yearChip,
                      {
                        backgroundColor: selected ? theme.accentSoft : theme.surface,
                        borderColor: selected ? theme.accent : theme.border
                      }
                    ]}
                  >
                    <Text style={[styles.yearChipText, { color: selected ? theme.accent : theme.muted }]}>
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={theme.accent} />
            </View>
          ) : empty ? (
            <View style={[styles.empty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>{t("progress.recap.emptyTitle")}</Text>
              <Text style={[styles.emptyBody, { color: theme.muted }]}>{t("progress.recap.emptyBody")}</Text>
            </View>
          ) : format === "stats" ? (
            <>
              <StatsCardPreview
                ref={statsCardRef}
                stats={stats}
                theme={theme}
                period={period}
                formatGrade={formatGrade}
                gradeBars={gradeBars}
                t={t}
              />
              <View style={styles.actions}>
                <Pressable
                  disabled={sharing || saveProgress !== null}
                  onPress={() => void shareCurrent()}
                  style={[
                    styles.primaryButton,
                    {
                      backgroundColor: theme.accent,
                      opacity: sharing || saveProgress !== null ? 0.6 : 1
                    }
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    {sharing ? t("progress.recap.sharing") : t("progress.recap.shareStats")}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <RecapStoryPager
                ref={pagerRef}
                stats={stats}
                theme={theme}
                period={period}
                formatGrade={formatGrade}
                gradeBars={gradeBars}
                t={t}
                onIndexChange={setSlideIndex}
              />
              <Text style={[styles.slideMeta, { color: theme.faint }]}>
                {slideIndex + 1} / {RECAP_SLIDE_IDS.length}
              </Text>
              <View style={styles.actions}>
                <Pressable
                  disabled={sharing || saveProgress !== null}
                  onPress={() => void shareCurrent()}
                  style={[
                    styles.primaryButton,
                    {
                      backgroundColor: theme.accent,
                      opacity: sharing || saveProgress !== null ? 0.6 : 1
                    }
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    {sharing ? t("progress.recap.sharing") : t("progress.recap.shareSlide")}
                  </Text>
                </Pressable>
                <Pressable
                  disabled={sharing || saveProgress !== null}
                  onPress={() => void saveAll()}
                  style={[
                    styles.secondaryButton,
                    {
                      borderColor: theme.border,
                      opacity: sharing || saveProgress !== null ? 0.6 : 1
                    }
                  ]}
                >
                  <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                    {t("progress.recap.saveAll")}
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>

        {saveProgress ? (
          <View style={[styles.saveOverlay, { backgroundColor: theme.background }]}>
            <ActivityIndicator color={theme.accent} />
            <Text style={[styles.saveOverlayText, { color: theme.text }]}>
              {t("progress.recap.savingProgress", {
                current: saveProgress.current,
                total: saveProgress.total
              })}
            </Text>
            <Pressable
              onPress={() => {
                cancelSaveRef.current = true;
              }}
              style={[styles.secondaryButton, { borderColor: theme.border, minWidth: 160 }]}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                {t("progress.recap.cancelSave")}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 12
  },
  headerCopy: { flex: 1 },
  kicker: { fontSize: 11, fontWeight: "800", letterSpacing: 1.6, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.8 },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center"
  },
  closeText: { fontSize: 24, lineHeight: 26, fontWeight: "500" },
  content: {
    paddingHorizontal: 20,
    gap: 16
  },
  yearRow: {
    gap: 8,
    paddingVertical: 2
  },
  yearChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  yearChipText: { fontSize: 14, fontWeight: "700" },
  loading: { paddingVertical: 80, alignItems: "center" },
  empty: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    padding: 24,
    gap: 8
  },
  emptyTitle: { fontSize: 20, fontWeight: "800" },
  emptyBody: { fontSize: 14, lineHeight: 20 },
  slideMeta: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1
  },
  actions: { gap: 10 },
  primaryButton: {
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center"
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  secondaryButton: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    alignItems: "center"
  },
  secondaryButtonText: { fontSize: 15, fontWeight: "700" },
  saveOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 32
  },
  saveOverlayText: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center"
  }
});
