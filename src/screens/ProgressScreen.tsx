import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { AreaStatsSheet } from "../components/AreaStatsSheet";
import { BarList } from "../components/BarList";
import { Card, EmptyState, Metric, Pill, ScreenHeader, SectionTitle, SegmentedControl } from "../components/ui";
import { getStats, statsRanges } from "../db/repository";
import { remapGradeAttempts, remapGradeBars } from "../domain/grades";
import type { StatsSummary } from "../domain/types";
import { useGradeSystem } from "../grades/GradeSystemContext";
import { useI18n } from "../i18n";
import { RecapModal } from "../recap/RecapModal";
import type { AppTheme } from "../theme/theme";

const emptyStats: StatsSummary = {
  totalSends: 0,
  totalAttempts: 0,
  totalSessions: 0,
  sendRate: 0,
  averageAttemptsPerSend: 0,
  hardestGrade: "—",
  gradeSends: [],
  gradeAttempts: [],
  areaSends: [],
  monthlyTrips: [],
  progression: []
};

function formatMonthLabel(ym: string, localeTag: string): string {
  const [year, month] = ym.split("-").map(Number);
  if (!year || !month) return ym;
  return new Intl.DateTimeFormat(localeTag, { month: "short", year: "2-digit" }).format(new Date(year, month - 1, 1));
}

export function ProgressScreen({
  theme,
  revision,
  onRecapVisibilityChange
}: {
  theme: AppTheme;
  revision: number;
  onRecapVisibilityChange?: (open: boolean) => void;
}) {
  const db = useSQLiteContext();
  const { t, locale, localeTag } = useI18n();
  const { formatGrade, gradeSystem } = useGradeSystem();
  const [rangeKey, setRangeKey] = useState<(typeof statsRanges)[number]["key"]>("3m");
  const [stats, setStats] = useState<StatsSummary>(emptyStats);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedArea, setSelectedArea] = useState<{ id: string; label: string } | null>(null);
  const [recapOpen, setRecapOpen] = useState(false);
  const range = statsRanges.find((option) => option.key === rangeKey) ?? statsRanges[1]!;

  const load = useCallback(async () => {
    setStats(await getStats(db, range.since, locale));
  }, [db, locale, range.since]);

  useEffect(() => {
    void load();
  }, [load, revision]);

  useEffect(() => {
    onRecapVisibilityChange?.(recapOpen);
    return () => onRecapVisibilityChange?.(false);
  }, [onRecapVisibilityChange, recapOpen]);

  async function refresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  const maxTrips = useMemo(() => Math.max(1, ...stats.monthlyTrips.map((item) => item.value)), [stats.monthlyTrips]);
  const gradeSends = useMemo(
    () => remapGradeBars(stats.gradeSends, gradeSystem),
    [gradeSystem, stats.gradeSends]
  );
  const gradeAttempts = useMemo(
    () => remapGradeAttempts(stats.gradeAttempts, gradeSystem),
    [gradeSystem, stats.gradeAttempts]
  );

  return (
    <>
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} />}
    >
      <ScreenHeader
        eyebrow={t("progress.eyebrow")}
        title={t("progress.title")}
        subtitle={t("progress.subtitle")}
        theme={theme}
        action={
          stats.totalAttempts > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("progress.shareRecapA11y")}
              onPress={() => setRecapOpen(true)}
              style={[styles.shareButton, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}
            >
              <Text style={[styles.shareButtonText, { color: theme.accent }]}>{t("progress.shareRecap")}</Text>
            </Pressable>
          ) : undefined
        }
      />
      <SegmentedControl
        options={statsRanges.map((option) => ({ value: option.key, label: option.label }))}
        value={rangeKey}
        onChange={setRangeKey}
        theme={theme}
      />

      {stats.totalAttempts === 0 ? (
        <Card theme={theme} style={styles.emptyCard}>
          <EmptyState title={t("progress.emptyTitle")} body={t("progress.emptyBody")} theme={theme} />
        </Card>
      ) : (
        <>
          <Card theme={theme} style={styles.heroCard}>
            <View style={styles.heroMetrics}>
              <View style={[styles.sendRing, { borderColor: theme.accentSoft }]}>
                <Text style={[styles.sendValue, { color: theme.accent }]}>{stats.totalSends}</Text>
                <Text style={[styles.sendLabel, { color: theme.muted }]}>{t("progress.sendsLabel")}</Text>
              </View>
              <View style={styles.metricGrid}>
                <View style={styles.metricRow}>
                  <Metric label={t("progress.sessions")} value={stats.totalSessions} theme={theme} />
                  <Metric label={t("progress.attempts")} value={stats.totalAttempts} theme={theme} />
                </View>
                <View style={[styles.metricRow, styles.metricRowBottom, { borderColor: theme.border }]}>
                  <Metric label={t("progress.sendRate")} value={`${stats.sendRate}%`} theme={theme} />
                  <Metric label={t("progress.triesPerSend")} value={stats.averageAttemptsPerSend || "—"} theme={theme} />
                </View>
                <View style={[styles.metricRow, styles.metricRowBottom, { borderColor: theme.border }]}>
                  <Metric
                    label={t("progress.topGrade")}
                    value={stats.hardestGrade === "—" ? stats.hardestGrade : formatGrade(stats.hardestGrade)}
                    theme={theme}
                    accent
                  />
                  <View style={styles.metricSpacer} />
                </View>
              </View>
            </View>
          </Card>

          <SectionTitle
            title={t("progress.gradeDistribution")}
            detail={t("progress.totalSends", { count: stats.totalSends })}
            theme={theme}
            style={styles.section}
          />
          <Card theme={theme}>
            <BarList data={gradeSends} theme={theme} color={theme.accent} emptyLabel={t("progress.barEmpty")} />
          </Card>

          <SectionTitle title={t("progress.attemptsPerSend")} detail={t("progress.byGrade")} theme={theme} style={styles.section} />
          <Card theme={theme} style={styles.efficiencyCard}>
            {gradeAttempts.map((grade, index) => (
              <View
                key={grade.label}
                style={[styles.efficiencyRow, index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}
              >
                <Pill label={grade.label} theme={theme} tone="gold" />
                <Text style={[styles.efficiencyDetail, { color: theme.muted }]}>
                  {t("progress.triesSends", { attempts: grade.attempts, sends: grade.sends })}
                </Text>
                <Text style={[styles.efficiencyValue, { color: theme.text }]}>{grade.averageAttemptsPerSend}</Text>
              </View>
            ))}
          </Card>

          <SectionTitle title={t("progress.whereYouClimbed")} detail={t("progress.sendsByArea")} theme={theme} style={styles.section} />
          <Card theme={theme}>
            <BarList
              data={stats.areaSends.slice(0, 6)}
              theme={theme}
              color={theme.moss}
              emptyLabel={t("progress.barEmpty")}
              onPressItem={(item) => {
                if (!item.id) return;
                setSelectedArea({ id: item.id, label: item.label });
              }}
            />
          </Card>

          <SectionTitle title={t("progress.tripRhythm")} detail={t("progress.sessionsPerMonth")} theme={theme} style={styles.section} />
          <Card theme={theme}>
            {stats.monthlyTrips.length ? (
              <View style={styles.tripChart}>
                {stats.monthlyTrips.map((month) => (
                  <View key={month.label} style={styles.tripColumn}>
                    <Text style={[styles.tripCount, { color: theme.text }]}>{month.value}</Text>
                    <View style={styles.tripBarFrame}>
                      <View
                        style={[
                          styles.tripBar,
                          {
                            backgroundColor: theme.gold,
                            height: `${Math.max(12, (month.value / maxTrips) * 100)}%`
                          }
                        ]}
                      />
                    </View>
                    <Text numberOfLines={1} style={[styles.tripLabel, { color: theme.faint }]}>
                      {formatMonthLabel(month.label, localeTag)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.chartEmpty, { color: theme.muted }]}>{t("progress.tripEmpty")}</Text>
            )}
          </Card>

          <SectionTitle title={t("progress.progression")} detail={t("progress.hardestSendByMonth")} theme={theme} style={styles.section} />
          <Card theme={theme}>
            {stats.progression.length ? (
              <View style={styles.timeline}>
                {stats.progression.map((point, index) => (
                  <View key={point.label} style={styles.timelineRow}>
                    <View style={styles.timelineRail}>
                      <View style={[styles.timelineDot, { backgroundColor: theme.moss }]} />
                      {index < stats.progression.length - 1 ? (
                        <View style={[styles.timelineLine, { backgroundColor: theme.border }]} />
                      ) : null}
                    </View>
                    <View style={styles.timelineCopy}>
                      <Text style={[styles.timelineDate, { color: theme.muted }]}>{formatMonthLabel(point.label, localeTag)}</Text>
                      <Text style={[styles.timelineGrade, { color: theme.text }]}>{formatGrade(point.grade)}</Text>
                    </View>
                    {index === stats.progression.length - 1 ? <Pill label={t("common.latest")} theme={theme} tone="moss" /> : null}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.chartEmpty, { color: theme.muted }]}>{t("progress.progressionEmpty")}</Text>
            )}
          </Card>
        </>
      )}
    </ScrollView>

    <AreaStatsSheet
      areaId={selectedArea?.id ?? null}
      areaLabel={selectedArea?.label ?? ""}
      since={range.since}
      visible={selectedArea !== null}
      onClose={() => setSelectedArea(null)}
      theme={theme}
    />
    <RecapModal
      visible={recapOpen}
      onClose={() => setRecapOpen(false)}
      theme={theme}
      initialRangeKey={rangeKey}
    />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 120 },
  shareButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 4
  },
  shareButtonText: { fontSize: 13, fontWeight: "800" },
  emptyCard: { marginTop: 18 },
  heroCard: { marginTop: 16 },
  heroMetrics: { flexDirection: "row", alignItems: "center", gap: 19 },
  sendRing: { width: 112, height: 112, borderRadius: 56, borderWidth: 10, alignItems: "center", justifyContent: "center" },
  sendValue: { fontSize: 35, lineHeight: 38, fontWeight: "800", letterSpacing: -1.2 },
  sendLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 1.5, marginTop: 2 },
  metricGrid: { flex: 1 },
  metricRow: { flexDirection: "row", gap: 12 },
  metricRowBottom: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 13 },
  metricSpacer: { flex: 1 },
  section: { marginTop: 28 },
  tripChart: { height: 148, flexDirection: "row", alignItems: "flex-end", gap: 7 },
  tripColumn: { flex: 1, alignItems: "center", height: "100%" },
  tripCount: { fontSize: 11, fontWeight: "800", marginBottom: 5 },
  tripBarFrame: { flex: 1, width: "100%", justifyContent: "flex-end", alignItems: "center" },
  tripBar: { width: "68%", minHeight: 8, borderTopLeftRadius: 7, borderTopRightRadius: 7 },
  tripLabel: { width: "100%", textAlign: "center", fontSize: 7, marginTop: 7 },
  chartEmpty: { fontSize: 13, lineHeight: 19, paddingVertical: 8 },
  efficiencyCard: { paddingVertical: 3 },
  efficiencyRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  efficiencyDetail: { flex: 1, fontSize: 11 },
  efficiencyValue: { fontSize: 18, fontWeight: "800" },
  timeline: { gap: 0 },
  timelineRow: { minHeight: 55, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  timelineRail: { width: 14, alignItems: "center", alignSelf: "stretch" },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  timelineLine: { width: 1, flex: 1, marginTop: 3 },
  timelineCopy: { flex: 1 },
  timelineDate: { fontSize: 11, fontWeight: "600" },
  timelineGrade: { fontSize: 18, fontWeight: "800", marginTop: 3 }
});
