import { StyleSheet, Text, View } from "react-native";

import type { RecapSummary } from "../../domain/types";
import type { AppTheme } from "../../theme/theme";
import { formatOutdoorDuration, type RecapSlideId } from "../recapStats";
import { StoryFrame, StoryHeroNumber, StorySubtitle, StoryTitle } from "./StoryFrame";

type TFn = (key: string, params?: Record<string, string | number>) => string;

export function RecapSlide({
  id,
  stats,
  theme,
  t,
  period,
  formatGrade,
  gradeBars
}: {
  id: RecapSlideId;
  stats: RecapSummary;
  theme: AppTheme;
  t: TFn;
  period: string;
  formatGrade: (grade: string) => string;
  gradeBars: Array<{ label: string; value: number }>;
}) {
  switch (id) {
    case "cover":
      return (
        <StoryFrame theme={theme} kicker={t("progress.recap.coverKicker")} accent="moss">
          <StoryTitle theme={theme}>{t("progress.recap.coverTitle")}</StoryTitle>
          <StorySubtitle theme={theme}>
            {t("progress.recap.coverSubtitle", { period })}
          </StorySubtitle>
        </StoryFrame>
      );
    case "daysOut":
      return (
        <StoryFrame theme={theme} kicker={t("progress.recap.daysOutKicker")} accent="moss">
          <StoryTitle theme={theme}>{t("progress.recap.daysOutTitle")}</StoryTitle>
          <StoryHeroNumber value={stats.totalSessions} theme={theme} accent="moss" />
          <StorySubtitle theme={theme}>
            {t("progress.recap.daysOutSessions", { count: stats.totalSessions })}
          </StorySubtitle>
          <StorySubtitle theme={theme}>
            {t("progress.recap.daysOutHours", {
              duration: formatOutdoorDuration(stats.outdoorMinutes, t)
            })}
          </StorySubtitle>
        </StoryFrame>
      );
    case "tops":
      return (
        <StoryFrame theme={theme} kicker={t("progress.recap.topsKicker")}>
          <StoryTitle theme={theme}>{t("progress.recap.topsTitle")}</StoryTitle>
          <StoryHeroNumber
            value={t("progress.recap.topsValue", { count: stats.totalSends })}
            theme={theme}
          />
          {stats.flashCount > 0 ? (
            <StorySubtitle theme={theme}>
              {t("progress.recap.topsFlashes", { count: stats.flashCount })}
            </StorySubtitle>
          ) : null}
        </StoryFrame>
      );
    case "problems":
      return (
        <StoryFrame theme={theme} kicker={t("progress.recap.problemsKicker")} accent="gold">
          <StoryTitle theme={theme}>{t("progress.recap.problemsTitle")}</StoryTitle>
          <StoryHeroNumber
            value={t("progress.recap.problemsValue", { count: stats.uniqueProblemsSent })}
            theme={theme}
            accent="gold"
          />
        </StoryFrame>
      );
    case "highPoint":
      return (
        <StoryFrame theme={theme} kicker={t("progress.recap.highPointKicker")}>
          <StoryTitle theme={theme}>{t("progress.recap.highPointTitle")}</StoryTitle>
          {stats.hardestSend ? (
            <>
              <View style={styles.highPointRow}>
                <View style={styles.highPointCopy}>
                  <Text style={[styles.problemHero, { color: theme.text }]}>
                    {stats.hardestSend.problemName}
                  </Text>
                  {stats.hardestSend.areaName ? (
                    <StorySubtitle theme={theme}>
                      {t("progress.recap.highPointArea", { area: stats.hardestSend.areaName })}
                    </StorySubtitle>
                  ) : null}
                </View>
                <Text style={[styles.gradeHeroSide, { color: theme.accent }]}>
                  {formatGrade(stats.hardestSend.grade)}
                </Text>
              </View>
            </>
          ) : (
            <Text style={[styles.gradeHeroSide, { color: theme.accent }]}>
              {t("progress.recap.highPointEmpty")}
            </Text>
          )}
        </StoryFrame>
      );
    case "hardestSends":
      return (
        <StoryFrame theme={theme} kicker={t("progress.recap.hardestSendsKicker")} accent="gold">
          <StoryTitle theme={theme}>{t("progress.recap.hardestSendsTitle")}</StoryTitle>
          {stats.hardestSends.length ? (
            <View style={styles.rankList}>
              {stats.hardestSends.map((send, index) => (
                <View
                  key={`${send.problemId}-${send.grade}-${index}`}
                  style={[styles.rankRow, index > 0 && { borderTopColor: theme.border, borderTopWidth: 2 }]}
                >
                  <Text style={[styles.rankIndex, { color: theme.gold }]}>
                    {t("progress.recap.hardestSendsRank", { rank: index + 2 })}
                  </Text>
                  <View style={styles.rankCopy}>
                    <Text style={[styles.rankProblem, { color: theme.text }]} numberOfLines={2}>
                      {send.problemName}
                    </Text>
                    <Text style={[styles.rankMeta, { color: theme.muted }]} numberOfLines={1}>
                      {send.areaName}
                    </Text>
                  </View>
                  <Text style={[styles.rankGrade, { color: theme.accent }]}>
                    {formatGrade(send.grade)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <StorySubtitle theme={theme}>{t("progress.recap.hardestSendsEmpty")}</StorySubtitle>
          )}
        </StoryFrame>
      );
    case "homeCrag":
      return (
        <StoryFrame theme={theme} kicker={t("progress.recap.homeCragKicker")} accent="moss">
          <StoryTitle theme={theme}>{t("progress.recap.homeCragTitle")}</StoryTitle>
          {stats.topArea ? (
            <>
              <Text style={[styles.areaHero, { color: theme.text }]}>{stats.topArea.label}</Text>
              <StorySubtitle theme={theme}>
                {t("progress.recap.homeCragSessions", { count: stats.topArea.sessionCount })}
              </StorySubtitle>
              <StorySubtitle theme={theme}>
                {t("progress.recap.homeCragSends", { count: stats.topArea.sendCount })}
              </StorySubtitle>
            </>
          ) : (
            <StorySubtitle theme={theme}>{t("progress.recap.homeCragEmpty")}</StorySubtitle>
          )}
        </StoryFrame>
      );
    case "otherAreas":
      return (
        <StoryFrame theme={theme} kicker={t("progress.recap.otherAreasKicker")} accent="moss">
          <StoryTitle theme={theme}>{t("progress.recap.otherAreasTitle")}</StoryTitle>
          {stats.otherAreas.length ? (
            <View style={styles.areaList}>
              {stats.otherAreas.slice(0, 6).map((area) => (
                <View key={area.id} style={styles.areaRow}>
                  <Text style={[styles.areaName, { color: theme.text }]} numberOfLines={2}>
                    {area.label}
                  </Text>
                  <Text style={[styles.areaVisits, { color: theme.moss }]}>
                    {t("progress.recap.otherAreasVisits", { count: area.sessionCount })}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <StorySubtitle theme={theme}>{t("progress.recap.otherAreasEmpty")}</StorySubtitle>
          )}
        </StoryFrame>
      );
    case "gradeMix":
      return (
        <StoryFrame theme={theme} kicker={t("progress.recap.gradeMixKicker")} accent="gold">
          <StoryTitle theme={theme}>{t("progress.recap.gradeMixTitle")}</StoryTitle>
          {gradeBars.length ? (
            <>
              {stats.averageGrade !== "—" ? (
                <StorySubtitle theme={theme}>
                  {t("progress.recap.gradeMixAverage", {
                    grade: formatGrade(stats.averageGrade)
                  })}
                </StorySubtitle>
              ) : null}
              <View style={styles.gradeList}>
                {gradeBars.slice(0, 8).map((row) => {
                  const max = Math.max(1, ...gradeBars.map((item) => item.value));
                  const width = Math.max(8, Math.round((row.value / max) * 100));
                  return (
                    <View key={row.label} style={styles.gradeRow}>
                      <Text style={[styles.gradeLabel, { color: theme.text }]}>{row.label}</Text>
                      <View style={[styles.gradeTrack, { backgroundColor: theme.raised }]}>
                        <View
                          style={[
                            styles.gradeFill,
                            { width: `${width}%`, backgroundColor: theme.gold }
                          ]}
                        />
                      </View>
                      <Text style={[styles.gradeCount, { color: theme.muted }]}>{row.value}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          ) : (
            <StorySubtitle theme={theme}>{t("progress.recap.gradeMixEmpty")}</StorySubtitle>
          )}
        </StoryFrame>
      );
    case "outro":
      return (
        <StoryFrame
          theme={theme}
          kicker={t("progress.recap.outroKicker")}
          accent="moss"
          footer={<Text style={[styles.brand, { color: theme.faint }]}>opentopo</Text>}
        >
          <StoryTitle theme={theme}>{t("progress.recap.outroTitle")}</StoryTitle>
          <StorySubtitle theme={theme}>{t("progress.recap.outroSubtitle")}</StorySubtitle>
        </StoryFrame>
      );
  }
}

const styles = StyleSheet.create({
  highPointRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 28
  },
  highPointCopy: {
    flex: 1,
    gap: 16
  },
  gradeHeroSide: {
    fontSize: 110,
    lineHeight: 118,
    fontWeight: "800",
    letterSpacing: -4
  },
  problemHero: {
    fontSize: 56,
    lineHeight: 66,
    fontWeight: "800",
    letterSpacing: -1.5
  },
  areaHero: {
    fontSize: 84,
    lineHeight: 96,
    fontWeight: "800",
    letterSpacing: -2.2,
    maxWidth: 900
  },
  rankList: {
    marginTop: 12,
    gap: 0
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
    paddingVertical: 28
  },
  rankIndex: {
    width: 56,
    fontSize: 40,
    fontWeight: "800"
  },
  rankCopy: {
    flex: 1,
    gap: 6
  },
  rankProblem: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "800"
  },
  rankMeta: {
    fontSize: 26,
    fontWeight: "600"
  },
  rankGrade: {
    fontSize: 40,
    fontWeight: "800"
  },
  areaList: {
    marginTop: 12,
    gap: 28
  },
  areaRow: {
    gap: 8
  },
  areaName: {
    fontSize: 44,
    lineHeight: 52,
    fontWeight: "800",
    letterSpacing: -1
  },
  areaVisits: {
    fontSize: 30,
    fontWeight: "700"
  },
  gradeList: {
    gap: 22,
    marginTop: 20
  },
  gradeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18
  },
  gradeLabel: {
    width: 140,
    fontSize: 28,
    fontWeight: "700"
  },
  gradeTrack: {
    flex: 1,
    height: 22,
    borderRadius: 11,
    overflow: "hidden"
  },
  gradeFill: {
    height: "100%",
    borderRadius: 11
  },
  gradeCount: {
    width: 64,
    textAlign: "right",
    fontSize: 28,
    fontWeight: "700"
  },
  brand: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 6,
    textTransform: "uppercase"
  }
});
