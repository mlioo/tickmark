import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { getAreaStats } from "../db/repository";
import { remapGradeAttempts, remapGradeBars } from "../domain/grades";
import type { AreaStatsSummary } from "../domain/types";
import { useGradeSystem } from "../grades/GradeSystemContext";
import { useI18n } from "../i18n";
import type { AppTheme } from "../theme/theme";
import { BarList } from "./BarList";
import { Card, LoadingState, Metric, Pill } from "./ui";

export function AreaStatsSheet({
  areaId,
  areaLabel,
  since,
  visible,
  onClose,
  theme
}: {
  areaId: string | null;
  areaLabel: string;
  since: string | null;
  visible: boolean;
  onClose: () => void;
  theme: AppTheme;
}) {
  const db = useSQLiteContext();
  const { t, locale } = useI18n();
  const { formatGrade, gradeSystem } = useGradeSystem();
  const [stats, setStats] = useState<AreaStatsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const gradeSends = stats ? remapGradeBars(stats.gradeSends, gradeSystem) : [];
  const gradeAttempts = stats ? remapGradeAttempts(stats.gradeAttempts, gradeSystem) : [];

  useEffect(() => {
    if (!visible || !areaId) return;
    let cancelled = false;
    setStats(null);
    setLoading(true);
    void getAreaStats(db, since, areaId, locale)
      .then((result) => {
        if (!cancelled) setStats(result);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [areaId, db, locale, since, visible]);

  const title = stats?.areaName || areaLabel;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.fill}>
        <Pressable accessibilityLabel={t("progress.areaCloseA11y")} style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.titleRow}>
              <View style={styles.titleCopy}>
                <Text style={[styles.kicker, { color: theme.accent }]}>{t("progress.areaBreakdown")}</Text>
                <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("progress.areaCloseA11y")}
                hitSlop={10}
                onPress={onClose}
                style={[styles.close, { backgroundColor: theme.background }]}
              >
                <Text style={[styles.closeText, { color: theme.text }]}>×</Text>
              </Pressable>
            </View>

            {loading ? (
              <LoadingState theme={theme} />
            ) : stats ? (
              <>
                <View style={[styles.metrics, { borderColor: theme.border }]}>
                  <Metric label={t("progress.sessions")} value={stats.totalSessions} theme={theme} />
                  <Metric label={t("sessionDetail.sends")} value={stats.totalSends} theme={theme} accent />
                  <Metric
                    label={t("progress.topGrade")}
                    value={stats.hardestGrade === "—" ? stats.hardestGrade : formatGrade(stats.hardestGrade)}
                    theme={theme}
                  />
                </View>

                <Text style={[styles.sectionTitle, { color: theme.text }]}>{t("progress.gradeDistribution")}</Text>
                <Text style={[styles.sectionDetail, { color: theme.muted }]}>
                  {t("progress.totalSends", { count: stats.totalSends })}
                </Text>
                <Card theme={theme} style={styles.card}>
                  <BarList
                    data={gradeSends}
                    theme={theme}
                    color={theme.accent}
                    emptyLabel={t("progress.areaGradeEmpty")}
                  />
                </Card>

                <Text style={[styles.sectionTitle, { color: theme.text }]}>{t("progress.attemptsPerSend")}</Text>
                <Text style={[styles.sectionDetail, { color: theme.muted }]}>{t("progress.byGrade")}</Text>
                <Card theme={theme} style={styles.efficiencyCard}>
                  {gradeAttempts.length ? (
                    gradeAttempts.map((grade, index) => (
                      <View
                        key={grade.label}
                        style={[
                          styles.efficiencyRow,
                          index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }
                        ]}
                      >
                        <Pill label={grade.label} theme={theme} tone="gold" />
                        <Text style={[styles.efficiencyDetail, { color: theme.muted }]}>
                          {t("progress.triesSends", { attempts: grade.attempts, sends: grade.sends })}
                        </Text>
                        <Text style={[styles.efficiencyValue, { color: theme.text }]}>{grade.averageAttemptsPerSend}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={[styles.empty, { color: theme.muted }]}>{t("progress.areaGradeEmpty")}</Text>
                  )}
                </Card>
              </>
            ) : (
              <Text style={[styles.empty, { color: theme.muted }]}>{t("progress.areaGradeEmpty")}</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.48)" },
  sheet: {
    maxHeight: "94%",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden"
  },
  handle: { width: 42, height: 5, borderRadius: 3, alignSelf: "center", marginTop: 10 },
  content: { paddingHorizontal: 22, paddingTop: 15, paddingBottom: 42 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  titleCopy: { flex: 1 },
  kicker: { fontSize: 10, fontWeight: "800", letterSpacing: 1.7, marginBottom: 5 },
  title: { fontSize: 29, lineHeight: 34, fontWeight: "800", letterSpacing: -0.75 },
  close: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 25, lineHeight: 27, fontWeight: "400", marginTop: -2 },
  metrics: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, marginTop: 22, paddingTop: 17 },
  sectionTitle: { fontSize: 19, fontWeight: "700", letterSpacing: -0.35, marginTop: 28 },
  sectionDetail: { fontSize: 12, fontWeight: "600", marginTop: 4, marginBottom: 12 },
  card: { marginTop: 0 },
  efficiencyCard: { paddingVertical: 3 },
  efficiencyRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  efficiencyDetail: { flex: 1, fontSize: 11 },
  efficiencyValue: { fontSize: 18, fontWeight: "800" },
  empty: { fontSize: 13, lineHeight: 19, paddingVertical: 12 }
});
