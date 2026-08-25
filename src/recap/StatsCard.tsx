import { StyleSheet, Text, View } from "react-native";

import type { RecapSummary } from "../domain/types";
import type { AppTheme } from "../theme/theme";
import { formatOutdoorDuration, STORY_HEIGHT, STORY_WIDTH } from "./recapStats";

type TFn = (key: string, params?: Record<string, string | number>) => string;

function StatCell({
  label,
  value,
  theme
}: {
  label: string;
  value: string | number;
  theme: AppTheme;
}) {
  return (
    <View style={[styles.cell, { borderColor: theme.border }]}>
      <Text style={[styles.cellLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.cellValue, { color: theme.text }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export function StatsCard({
  stats,
  theme,
  t,
  period,
  formatGrade,
  gradeBars
}: {
  stats: RecapSummary;
  theme: AppTheme;
  t: TFn;
  period: string;
  formatGrade: (grade: string) => string;
  gradeBars: Array<{ label: string; value: number }>;
}) {
  const hardest =
    stats.hardestSend && stats.hardestSend.grade !== "—"
      ? formatGrade(stats.hardestSend.grade)
      : t("progress.recap.highPointEmpty");

  return (
    <View style={[styles.card, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.brand, { color: theme.accent }]}>{t("progress.recap.statsBrand")}</Text>
        <Text style={[styles.period, { color: theme.text }]}>{period}</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>{t("progress.recap.statsSubtitle")}</Text>
      </View>

      <View style={styles.grid}>
        <StatCell
          label={t("progress.recap.statsSessions")}
          value={stats.totalSessions}
          theme={theme}
        />
        <StatCell
          label={t("progress.recap.statsOutdoors")}
          value={formatOutdoorDuration(stats.outdoorMinutes, t)}
          theme={theme}
        />
        <StatCell label={t("progress.recap.statsTops")} value={stats.totalSends} theme={theme} />
        <StatCell
          label={t("progress.recap.statsProblems")}
          value={stats.uniqueProblemsSent}
          theme={theme}
        />
        <StatCell
          label={t("progress.recap.statsFlashes")}
          value={stats.flashCount}
          theme={theme}
        />
        <StatCell
          label={t("progress.recap.statsAverage")}
          value={
            stats.averageGrade === "—" ? stats.averageGrade : formatGrade(stats.averageGrade)
          }
          theme={theme}
        />
      </View>

      {stats.hardestSend ? (
        <View style={[styles.block, { borderColor: theme.border }]}>
          <Text style={[styles.blockLabel, { color: theme.muted }]}>
            {t("progress.recap.statsHardestProblem")}
          </Text>
          <View style={styles.hardestRow}>
            <View style={styles.hardestCopy}>
              <Text style={[styles.blockValue, { color: theme.text }]} numberOfLines={2}>
                {stats.hardestSend.problemName}
              </Text>
              {stats.hardestSend.areaName ? (
                <Text style={[styles.blockMeta, { color: theme.faint }]}>
                  {stats.hardestSend.areaName}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.hardestGrade, { color: theme.accent }]}>{hardest}</Text>
          </View>
        </View>
      ) : null}

      {stats.topArea ? (
        <View style={[styles.block, { borderColor: theme.border }]}>
          <Text style={[styles.blockLabel, { color: theme.muted }]}>
            {t("progress.recap.statsHomeArea")}
          </Text>
          <Text style={[styles.blockValue, { color: theme.text }]}>{stats.topArea.label}</Text>
          <Text style={[styles.blockMeta, { color: theme.faint }]}>
            {t("progress.recap.homeCragSessions", { count: stats.topArea.sessionCount })}
          </Text>
        </View>
      ) : null}

      {stats.hardestSends.length ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.muted }]}>
            {t("progress.recap.statsTopSends")}
          </Text>
          {stats.hardestSends.map((send, index) => (
            <View key={`${send.problemId}-${index}`} style={styles.listRow}>
              <Text style={[styles.listRank, { color: theme.gold }]}>{index + 2}</Text>
              <View style={styles.listCopy}>
                <Text style={[styles.listPrimary, { color: theme.text }]} numberOfLines={1}>
                  {send.problemName}
                </Text>
                <Text style={[styles.listSecondary, { color: theme.faint }]} numberOfLines={1}>
                  {send.areaName}
                </Text>
              </View>
              <Text style={[styles.listGrade, { color: theme.accent }]}>
                {formatGrade(send.grade)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {stats.otherAreas.length ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.muted }]}>
            {t("progress.recap.statsOtherAreas")}
          </Text>
          {stats.otherAreas.slice(0, 5).map((area) => (
            <View key={area.id} style={styles.listRow}>
              <Text style={[styles.listPrimary, { color: theme.text, flex: 1 }]} numberOfLines={1}>
                {area.label}
              </Text>
              <Text style={[styles.listGrade, { color: theme.moss }]}>{area.sessionCount}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {gradeBars.length ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.muted }]}>
            {t("progress.recap.statsGradeMix")}
          </Text>
          {stats.averageGrade !== "—" ? (
            <Text style={[styles.blockMeta, { color: theme.faint, marginBottom: 4 }]}>
              {t("progress.recap.statsGradeMixAverage", {
                grade: formatGrade(stats.averageGrade)
              })}
            </Text>
          ) : null}
          {gradeBars.slice(0, 6).map((row) => {
            const max = Math.max(1, ...gradeBars.map((item) => item.value));
            const width = Math.max(6, Math.round((row.value / max) * 100));
            return (
              <View key={row.label} style={styles.barRow}>
                <Text style={[styles.barLabel, { color: theme.text }]}>{row.label}</Text>
                <View style={[styles.barTrack, { backgroundColor: theme.raised }]}>
                  <View style={[styles.barFill, { width: `${width}%`, backgroundColor: theme.accent }]} />
                </View>
                <Text style={[styles.barCount, { color: theme.muted }]}>{row.value}</Text>
              </View>
            );
          })}
        </View>
      ) : null}

      <Text style={[styles.footer, { color: theme.faint }]}>{t("progress.recap.statsFooter")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: STORY_WIDTH,
    height: STORY_HEIGHT,
    paddingHorizontal: 72,
    paddingTop: 120,
    paddingBottom: 88
  },
  header: {
    gap: 10,
    marginBottom: 36
  },
  brand: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 3,
    textTransform: "uppercase"
  },
  period: {
    fontSize: 64,
    lineHeight: 70,
    fontWeight: "800",
    letterSpacing: -1.8
  },
  subtitle: {
    fontSize: 28,
    fontWeight: "500"
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 28
  },
  cell: {
    width: (STORY_WIDTH - 72 * 2 - 16) / 2,
    borderWidth: 2,
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingVertical: 24,
    gap: 8
  },
  cellLabel: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  cellValue: {
    fontSize: 44,
    lineHeight: 50,
    fontWeight: "800",
    letterSpacing: -1
  },
  block: {
    borderWidth: 2,
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingVertical: 24,
    gap: 8,
    marginBottom: 20
  },
  blockLabel: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  blockValue: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: "800"
  },
  blockMeta: {
    fontSize: 26,
    fontWeight: "600"
  },
  hardestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20
  },
  hardestCopy: {
    flex: 1,
    gap: 8
  },
  hardestGrade: {
    fontSize: 56,
    lineHeight: 60,
    fontWeight: "800",
    letterSpacing: -1.5
  },
  section: {
    gap: 14,
    marginBottom: 24
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 4
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18
  },
  listRank: {
    width: 36,
    fontSize: 28,
    fontWeight: "800"
  },
  listCopy: {
    flex: 1,
    gap: 2
  },
  listPrimary: {
    fontSize: 30,
    fontWeight: "700"
  },
  listSecondary: {
    fontSize: 22,
    fontWeight: "500"
  },
  listGrade: {
    fontSize: 30,
    fontWeight: "800"
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  barLabel: {
    width: 120,
    fontSize: 24,
    fontWeight: "700"
  },
  barTrack: {
    flex: 1,
    height: 16,
    borderRadius: 8,
    overflow: "hidden"
  },
  barFill: {
    height: "100%",
    borderRadius: 8
  },
  barCount: {
    width: 48,
    textAlign: "right",
    fontSize: 24,
    fontWeight: "700"
  },
  footer: {
    marginTop: "auto",
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: 1
  }
});
