import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { getSessionAttempts } from "../db/repository";
import type { LogAttemptRow, PerceivedDifficulty, SessionRow } from "../domain/types";
import { useGradeSystem } from "../grades/GradeSystemContext";
import { useI18n } from "../i18n";
import type { AppTheme } from "../theme/theme";
import { LoadingState, Metric, Pill } from "./ui";

function formatDate(iso: string, localeTag: string): string {
  return new Intl.DateTimeFormat(localeTag, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date(iso));
}

function formatTime(iso: string, localeTag: string): string {
  return new Intl.DateTimeFormat(localeTag, { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

function durationLabel(startedAt: string, endedAt: string | null, inProgressLabel: string): string {
  if (!endedAt) return inProgressLabel;
  const minutes = Math.max(1, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const remainder = minutes % 60;
  return `${Math.floor(minutes / 60)}h${remainder ? ` ${remainder}m` : ""}`;
}

function CopyBlock({ label, body, theme }: { label: string; body: string; theme: AppTheme }) {
  if (!body.trim()) return null;
  return (
    <View style={styles.copyBlock}>
      <Text style={[styles.copyLabel, { color: theme.muted }]}>{label}</Text>
      <Text selectable style={[styles.copyBody, { color: theme.text }]}>{body}</Text>
    </View>
  );
}

/** Pastel translucent tints for session feeling scores (1 worst → 5 best). */
function scoreTone(
  value: number,
  mode: AppTheme["mode"]
): { background: string; border: string; value: string } {
  const dark = mode === "dark";
  switch (value) {
    case 1:
      return {
        background: "rgba(255, 150, 150, 0.28)",
        border: "rgba(230, 110, 110, 0.4)",
        value: dark ? "#F0A0A0" : "#C45A5A"
      };
    case 2:
      return {
        background: "rgba(170, 70, 70, 0.32)",
        border: "rgba(140, 50, 50, 0.45)",
        value: dark ? "#E08080" : "#A04040"
      };
    case 3:
      return {
        background: "rgba(240, 205, 95, 0.32)",
        border: "rgba(210, 170, 55, 0.45)",
        value: dark ? "#E8C85A" : "#A88818"
      };
    case 4:
      return {
        background: "rgba(45, 125, 85, 0.32)",
        border: "rgba(35, 105, 70, 0.45)",
        value: dark ? "#72C796" : "#2A6E4A"
      };
    case 5:
      return {
        background: "rgba(130, 215, 160, 0.3)",
        border: "rgba(100, 190, 135, 0.42)",
        value: dark ? "#A8E0BE" : "#2F9A5C"
      };
    default:
      return {
        background: "rgba(150, 150, 150, 0.18)",
        border: "rgba(120, 120, 120, 0.28)",
        value: dark ? "#A8B0AA" : "#6F7771"
      };
  }
}

function ScoreCard({
  label,
  value,
  theme
}: {
  label: string;
  value: number | null;
  theme: AppTheme;
}) {
  if (value == null || value <= 0) return null;
  const tone = scoreTone(value, theme.mode);
  return (
    <View style={[styles.scoreCard, { backgroundColor: tone.background, borderColor: tone.border }]}>
      <Text style={[styles.scoreLabel, { color: theme.text }]}>{label}</Text>
      <Text style={[styles.scoreValue, { color: tone.value }]}>
        {value}
        <Text style={[styles.scoreMax, { color: theme.muted }]}>/5</Text>
      </Text>
    </View>
  );
}

function AttemptDetail({ attempt, theme }: { attempt: LogAttemptRow; theme: AppTheme }) {
  const { t, localeTag, localizedName } = useI18n();
  const { formatGrade } = useGradeSystem();
  const isSend = attempt.result === "send" || attempt.result === "flash";
  const difficultyLabels: Record<PerceivedDifficulty, string> = {
    [-2]: t("sessionDetail.muchEasierThanGrade"),
    [-1]: t("sessionDetail.easierThanGrade"),
    [0]: t("sessionDetail.feltOnGrade"),
    [1]: t("sessionDetail.harderThanGrade"),
    [2]: t("sessionDetail.muchHarderThanGrade")
  };
  const tryUnit = attempt.tryCount === 1 ? t("common.try") : t("common.tries");

  return (
    <View style={[styles.attemptCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
      <View style={styles.attemptHeader}>
        <View style={styles.attemptCopy}>
          <Text style={[styles.problemName, { color: theme.text }]}>
            {localizedName(attempt.problemNameJa, attempt.problemNameEn)}
          </Text>
          <Text style={[styles.problemMeta, { color: theme.muted }]}>
            {[
              attempt.boulderNameJa || attempt.boulderNameEn
                ? localizedName(attempt.boulderNameJa, attempt.boulderNameEn)
                : "",
              formatTime(attempt.occurredAt, localeTag)
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
        {attempt.grade ? <Pill label={formatGrade(attempt.grade)} theme={theme} tone="gold" /> : null}
      </View>

      <View style={styles.attemptFacts}>
        <Pill
          label={attempt.result === "flash" ? t("common.flash") : isSend ? t("common.sendUpper") : t("common.attemptUpper")}
          theme={theme}
          tone={isSend ? "moss" : "neutral"}
        />
        <Text style={[styles.factText, { color: theme.muted }]}>
          {attempt.tryCount} {tryUnit} · {difficultyLabels[attempt.perceivedDifficulty]}
        </Text>
      </View>

      <CopyBlock label={t("sessionDetail.attemptNote")} body={attempt.notes} theme={theme} />
      <CopyBlock label={t("sessionDetail.savedProblemNote")} body={attempt.problemNote} theme={theme} />
    </View>
  );
}

export function SessionDetailSheet({
  session,
  visible,
  onClose,
  theme
}: {
  session: SessionRow | null;
  visible: boolean;
  onClose: () => void;
  theme: AppTheme;
}) {
  const db = useSQLiteContext();
  const { t, localeTag, localizedName } = useI18n();
  const [attempts, setAttempts] = useState<LogAttemptRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastSession, setLastSession] = useState<SessionRow | null>(session);
  const displayedSession = session ?? lastSession;

  useEffect(() => {
    if (session) setLastSession(session);
  }, [session]);

  useEffect(() => {
    if (!visible || !session) return;
    let cancelled = false;
    setAttempts([]);
    setLoading(true);
    void getSessionAttempts(db, session.id)
      .then((rows) => {
        if (!cancelled) setAttempts(rows);
      })
      .catch(() => {
        if (!cancelled) setAttempts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [db, session, visible]);

  const areaTitle = displayedSession
    ? localizedName(displayedSession.areaNameJa, displayedSession.areaNameEn)
    : t("common.session");

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.fill}>
        <Pressable accessibilityLabel={t("sessionDetail.closeA11y")} style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.titleRow}>
              <View style={styles.titleCopy}>
                <Text style={[styles.kicker, { color: theme.accent }]}>{t("sessionDetail.kicker")}</Text>
                <Text style={[styles.title, { color: theme.text }]}>{areaTitle}</Text>
                {displayedSession ? (
                  <Text style={[styles.date, { color: theme.muted }]}>{formatDate(displayedSession.startedAt, localeTag)}</Text>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("sessionDetail.closeA11y")}
                hitSlop={10}
                onPress={onClose}
                style={[styles.close, { backgroundColor: theme.background }]}
              >
                <Text style={[styles.closeText, { color: theme.text }]}>×</Text>
              </Pressable>
            </View>

            {displayedSession ? (
              <>
                <View style={[styles.metrics, { borderColor: theme.border }]}>
                  <Metric label={t("sessionDetail.tries")} value={displayedSession.attemptCount} theme={theme} />
                  <Metric label={t("sessionDetail.sends")} value={displayedSession.sendCount} theme={theme} accent />
                  <Metric
                    label={t("sessionDetail.duration")}
                    value={durationLabel(displayedSession.startedAt, displayedSession.endedAt, t("sessionDetail.inProgress"))}
                    theme={theme}
                  />
                </View>

                {displayedSession.energy || displayedSession.weather || displayedSession.mood || displayedSession.skin ? (
                  <View style={styles.ratingRow}>
                    <ScoreCard label={t("finishSession.energy")} value={displayedSession.energy} theme={theme} />
                    <ScoreCard label={t("finishSession.mood")} value={displayedSession.mood} theme={theme} />
                    <ScoreCard label={t("finishSession.skin")} value={displayedSession.skin} theme={theme} />
                    <ScoreCard label={t("finishSession.weather")} value={displayedSession.weather} theme={theme} />
                  </View>
                ) : null}

                <CopyBlock label={t("sessionDetail.reflection")} body={displayedSession.reflection} theme={theme} />
                <CopyBlock label={t("sessionDetail.conditions")} body={displayedSession.conditions} theme={theme} />
                <CopyBlock label={t("sessionDetail.sessionNotes")} body={displayedSession.notes} theme={theme} />

                <View style={styles.attemptTitleRow}>
                  <Text style={[styles.attemptTitle, { color: theme.text }]}>{t("sessionDetail.problemsAttempts")}</Text>
                  <Text style={[styles.attemptCount, { color: theme.muted }]}>
                    {t("sessionDetail.entries", { count: attempts.length })}
                  </Text>
                </View>

                {loading ? (
                  <LoadingState theme={theme} />
                ) : attempts.length ? (
                  <View style={styles.attemptList}>
                    {attempts.map((attempt) => <AttemptDetail key={attempt.id} attempt={attempt} theme={theme} />)}
                  </View>
                ) : (
                  <Text style={[styles.noAttempts, { color: theme.muted }]}>{t("sessionDetail.noAttempts")}</Text>
                )}
              </>
            ) : null}
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
  date: { fontSize: 13, lineHeight: 18, marginTop: 5 },
  close: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 25, lineHeight: 27, fontWeight: "400", marginTop: -2 },
  metrics: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, marginTop: 22, paddingTop: 17 },
  ratingRow: { flexDirection: "row", gap: 6, marginTop: 19 },
  scoreCard: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 2,
    alignItems: "center"
  },
  scoreLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.2, textAlign: "center" },
  scoreValue: { fontSize: 20, fontWeight: "800", letterSpacing: -0.5, textAlign: "center" },
  scoreMax: { fontSize: 11, fontWeight: "600" },
  copyBlock: { marginTop: 22 },
  copyLabel: { fontSize: 10, lineHeight: 14, fontWeight: "800", letterSpacing: 1.35, marginBottom: 7 },
  copyBody: { fontSize: 15, lineHeight: 23 },
  attemptTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 30, marginBottom: 12 },
  attemptTitle: { fontSize: 19, fontWeight: "700", letterSpacing: -0.35 },
  attemptCount: { fontSize: 12, fontWeight: "600" },
  attemptList: { gap: 10 },
  attemptCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 19, padding: 16 },
  attemptHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  attemptCopy: { flex: 1 },
  problemName: { fontSize: 17, lineHeight: 21, fontWeight: "700" },
  problemMeta: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  attemptFacts: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 13 },
  factText: { flexShrink: 1, fontSize: 11, lineHeight: 16, fontWeight: "600" },
  noAttempts: { fontSize: 14, lineHeight: 20, paddingVertical: 18 }
});
