import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useSQLiteContext } from "expo-sqlite";

import { AttemptComposer } from "../components/AttemptComposer";
import { FinishSessionSheet } from "../components/FinishSessionSheet";
import { AreaPicker, ProblemPicker } from "../components/Pickers";
import { SessionDetailSheet } from "../components/SessionDetailSheet";
import {
  Button,
  Card,
  EmptyState,
  Metric,
  Pill,
  ScreenHeader,
  SectionTitle,
  SegmentedControl
} from "../components/ui";
import {
  getOpenSession,
  getRecentSessions,
  getSentProblems,
  getSessionById,
  getSessionsInRange,
  startCustomSession,
  startSession
} from "../db/repository";
import type { AreaRow, LogAttemptRow, ProblemRow, SessionRow } from "../domain/types";
import { useGradeSystem } from "../grades/GradeSystemContext";
import { formatCountUnit, useI18n, weekdayAbbreviations } from "../i18n";
import type { AppTheme } from "../theme/theme";

type LogView = "sessions" | "calendar" | "sends";

function formatSessionDate(iso: string, localeTag: string): string {
  return new Intl.DateTimeFormat(localeTag, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(iso));
}

function durationLabel(startedAt: string): string {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function dateKey(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function sessionRatingValues(session: SessionRow): number[] {
  return [session.energy, session.weather, session.mood, session.skin].filter(
    (value): value is number => typeof value === "number" && value > 0
  );
}

function sessionRatingAverage(session: SessionRow): number | null {
  const values = sessionRatingValues(session);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatRatingAverage(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

function firstOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthRange(date: Date): { start: string; end: string } {
  return {
    start: new Date(date.getFullYear(), date.getMonth(), 1).toISOString(),
    end: new Date(date.getFullYear(), date.getMonth() + 1, 1).toISOString()
  };
}

function SessionCard({
  session,
  theme,
  onPress
}: {
  session: SessionRow;
  theme: AppTheme;
  onPress: () => void;
}) {
  const { t, localeTag, localizedName } = useI18n();
  const areaName = localizedName(session.areaNameJa, session.areaNameEn);
  const tryUnit = formatCountUnit(session.attemptCount, "common.try", "common.tries", t);
  const ratingAverage = sessionRatingAverage(session);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("log.openSessionA11y", { area: areaName })}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Card theme={theme}>
        <View style={styles.sessionRow}>
          <View style={[styles.dateBadge, { backgroundColor: theme.background }]}>
            <Text style={[styles.dateMonth, { color: theme.muted }]}>
              {new Intl.DateTimeFormat(localeTag, { month: "short" }).format(new Date(session.startedAt)).toUpperCase()}
            </Text>
            <Text style={[styles.dateDay, { color: theme.text }]}>{new Date(session.startedAt).getDate()}</Text>
          </View>
          <View style={styles.sessionCopy}>
            <Text style={[styles.sessionArea, { color: theme.text }]}>{areaName}</Text>
            <Text style={[styles.sessionMeta, { color: theme.muted }]}>
              {session.attemptCount} {tryUnit} · {session.sendCount} {t("common.sends")}
            </Text>
            {session.reflection ? (
              <Text numberOfLines={2} style={[styles.reflection, { color: theme.muted }]}>
                “{session.reflection}”
              </Text>
            ) : null}
            <Text style={[styles.viewDetails, { color: theme.accent }]}>{t("log.viewFullEntry")}</Text>
          </View>
          <Pill
            label={
              ratingAverage != null
                ? t("log.sessionAvg", { value: formatRatingAverage(ratingAverage) })
                : t("common.logged")
            }
            theme={theme}
            tone={ratingAverage != null && ratingAverage >= 4 ? "moss" : "neutral"}
          />
        </View>
      </Card>
    </Pressable>
  );
}

function CalendarLog({
  month,
  sessions,
  selectedDay,
  onMonthChange,
  onDayChange,
  onOpenSession,
  theme
}: {
  month: Date;
  sessions: SessionRow[];
  selectedDay: string;
  onMonthChange: (date: Date) => void;
  onDayChange: (key: string) => void;
  onOpenSession: (session: SessionRow) => void;
  theme: AppTheme;
}) {
  const { t, localeTag } = useI18n();
  const [pickingMonth, setPickingMonth] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => month.getFullYear());
  const weekdays = weekdayAbbreviations(localeTag);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leadingDays = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const monthLabels = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) =>
        new Intl.DateTimeFormat(localeTag, { month: "short" }).format(new Date(2024, index, 1))
      ),
    [localeTag]
  );
  const sessionCountByDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const session of sessions) counts.set(dateKey(session.startedAt), (counts.get(dateKey(session.startedAt)) ?? 0) + 1);
    return counts;
  }, [sessions]);
  const selectedSessions = sessions.filter((session) => dateKey(session.startedAt) === selectedDay);
  const calendarCells: Array<number | null> = [
    ...Array.from({ length: leadingDays }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1)
  ];

  function openMonthPicker() {
    setPickerYear(month.getFullYear());
    setPickingMonth(true);
  }

  function selectMonth(monthIndex: number) {
    onMonthChange(new Date(pickerYear, monthIndex, 1));
    setPickingMonth(false);
  }

  return (
    <>
      <Card theme={theme} style={styles.calendarCard}>
        <View style={styles.monthHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={pickingMonth ? t("log.previousYear") : t("log.previousMonth")}
            hitSlop={10}
            onPress={() => {
              if (pickingMonth) {
                setPickerYear((year) => year - 1);
                return;
              }
              onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1));
            }}
            style={[styles.monthButton, { backgroundColor: theme.background }]}
          >
            <Text style={[styles.monthButtonText, { color: theme.accent }]}>‹</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("log.chooseMonthYear")}
            hitSlop={8}
            onPress={() => {
              if (pickingMonth) {
                setPickingMonth(false);
                return;
              }
              openMonthPicker();
            }}
            style={styles.monthTitleButton}
          >
            <Text style={[styles.monthTitle, { color: theme.text }]}>
              {pickingMonth
                ? String(pickerYear)
                : new Intl.DateTimeFormat(localeTag, { month: "long", year: "numeric" }).format(month)}
            </Text>
            <Text style={[styles.monthTitleCaret, { color: theme.muted }]}>{pickingMonth ? "▴" : "▾"}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={pickingMonth ? t("log.nextYear") : t("log.nextMonth")}
            hitSlop={10}
            onPress={() => {
              if (pickingMonth) {
                setPickerYear((year) => year + 1);
                return;
              }
              onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1));
            }}
            style={[styles.monthButton, { backgroundColor: theme.background }]}
          >
            <Text style={[styles.monthButtonText, { color: theme.accent }]}>›</Text>
          </Pressable>
        </View>

        {pickingMonth ? (
          <View style={styles.monthPickerGrid}>
            {monthLabels.map((label, index) => {
              const selected = pickerYear === month.getFullYear() && index === month.getMonth();
              const monthName = new Intl.DateTimeFormat(localeTag, { month: "long" }).format(new Date(pickerYear, index, 1));
              return (
                <View key={label} style={styles.monthPickerCell}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("log.selectMonth", { month: monthName, year: pickerYear })}
                    onPress={() => selectMonth(index)}
                    style={[
                      styles.monthPickerButton,
                      { borderColor: selected ? theme.accent : "transparent" },
                      selected && { backgroundColor: theme.accentSoft }
                    ]}
                  >
                    <Text style={[styles.monthPickerLabel, { color: selected ? theme.accent : theme.text }]}>
                      {label}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : (
          <>
            <View style={styles.weekdayRow}>
              {weekdays.map((weekday) => (
                <Text key={weekday} style={[styles.weekday, { color: theme.faint }]}>{weekday}</Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {calendarCells.map((day, index) => {
                if (!day) return <View key={`blank-${index}`} style={styles.dayCell} />;
                const key = dateKey(new Date(month.getFullYear(), month.getMonth(), day));
                const count = sessionCountByDay.get(key) ?? 0;
                const selected = key === selectedDay;
                const today = key === dateKey(new Date());
                return (
                  <View key={key} style={styles.dayCell}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("log.daySessions", {
                        day,
                        count,
                        unit: formatCountUnit(count, "log.session", "log.sessionsUnit", t)
                      })}
                      onPress={() => onDayChange(key)}
                      style={[
                        styles.dayButton,
                        { borderColor: selected ? theme.accent : "transparent" },
                        selected && { backgroundColor: theme.accentSoft },
                        !selected && today && { backgroundColor: theme.background }
                      ]}
                    >
                      <Text style={[styles.dayNumber, { color: selected ? theme.accent : theme.text }]}>{day}</Text>
                      {count ? <View style={[styles.calendarDot, { backgroundColor: selected ? theme.accent : theme.moss }]} /> : null}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </Card>

      <SectionTitle
        title={new Intl.DateTimeFormat(localeTag, { month: "long", day: "numeric" }).format(new Date(`${selectedDay}T12:00:00`))}
        detail={
          selectedSessions.length
            ? `${selectedSessions.length} ${formatCountUnit(selectedSessions.length, "log.session", "log.sessionsUnit", t)}`
            : t("log.noSessions")
        }
        theme={theme}
        style={styles.calendarSelectionTitle}
      />
      {selectedSessions.length ? (
        <View style={styles.sessionList}>
          {selectedSessions.map((session) => (
            <SessionCard key={session.id} session={session} theme={theme} onPress={() => onOpenSession(session)} />
          ))}
        </View>
      ) : (
        <Card theme={theme}>
          <EmptyState title={t("log.noEntryTitle")} body={t("log.noEntryBody")} theme={theme} />
        </Card>
      )}
    </>
  );
}

function SendCard({
  attempt,
  theme,
  onPress
}: {
  attempt: LogAttemptRow;
  theme: AppTheme;
  onPress: () => void;
}) {
  const { t, localeTag, localizedName } = useI18n();
  const { formatGrade } = useGradeSystem();
  const problemName = localizedName(attempt.problemNameJa, attempt.problemNameEn);
  const tryUnit = formatCountUnit(attempt.tryCount, "common.try", "common.tries", t);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("log.openSendA11y", { problem: problemName })}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Card theme={theme}>
        <View style={styles.sendHeader}>
          <View style={styles.sendCopy}>
            <Text style={[styles.sendName, { color: theme.text }]}>{problemName}</Text>
            <Text style={[styles.sendMeta, { color: theme.muted }]}>
              {[
                localizedName(attempt.areaNameJa, attempt.areaNameEn),
                attempt.boulderNameJa || attempt.boulderNameEn
                  ? localizedName(attempt.boulderNameJa, attempt.boulderNameEn)
                  : ""
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
          {attempt.grade ? <Pill label={formatGrade(attempt.grade)} theme={theme} tone="gold" /> : null}
        </View>
        <View style={styles.sendFacts}>
          <Pill
            label={attempt.result === "flash" ? t("common.flash") : t("common.sendUpper")}
            theme={theme}
            tone="moss"
          />
          <Text style={[styles.sendDate, { color: theme.muted }]}>
            {formatSessionDate(attempt.occurredAt, localeTag)} · {attempt.tryCount} {tryUnit}
          </Text>
        </View>
        {attempt.notes ? (
          <View style={styles.notePreview}>
            <Text style={[styles.noteLabel, { color: theme.faint }]}>{t("log.attemptNote")}</Text>
            <Text numberOfLines={2} style={[styles.noteText, { color: theme.muted }]}>{attempt.notes}</Text>
          </View>
        ) : null}
        {attempt.problemNote ? (
          <View style={styles.notePreview}>
            <Text style={[styles.noteLabel, { color: theme.faint }]}>{t("log.savedProblemNote")}</Text>
            <Text numberOfLines={2} style={[styles.noteText, { color: theme.muted }]}>{attempt.problemNote}</Text>
          </View>
        ) : null}
        <Text style={[styles.viewDetails, { color: theme.accent }]}>{t("log.viewFullSession")}</Text>
      </Card>
    </Pressable>
  );
}

export function LogScreen({
  theme,
  revision,
  onMutate
}: {
  theme: AppTheme;
  revision: number;
  onMutate: () => void;
}) {
  const db = useSQLiteContext();
  const { t, localeTag, localizedName } = useI18n();
  const [openSession, setOpenSession] = useState<SessionRow | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sentProblems, setSentProblems] = useState<LogAttemptRow[]>([]);
  const [logView, setLogView] = useState<LogView>("sessions");
  const [calendarMonth, setCalendarMonth] = useState(() => firstOfMonth(new Date()));
  const [calendarSessions, setCalendarSessions] = useState<SessionRow[]>([]);
  const [selectedDay, setSelectedDay] = useState(() => dateKey(new Date()));
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [areaPickerOpen, setAreaPickerOpen] = useState(false);
  const [problemPickerOpen, setProblemPickerOpen] = useState(false);
  const [attemptOpen, setAttemptOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState<ProblemRow | null>(null);
  const [manualLogging, setManualLogging] = useState(false);

  const load = useCallback(async () => {
    const [active, recent, sends] = await Promise.all([
      getOpenSession(db),
      getRecentSessions(db, 100),
      getSentProblems(db)
    ]);
    setOpenSession(active);
    setSessions(recent);
    setSentProblems(sends);
  }, [db]);

  const loadCalendar = useCallback(async () => {
    const range = monthRange(calendarMonth);
    const rows = await getSessionsInRange(db, range.start, range.end);
    setCalendarSessions(rows);
    const monthPrefix = dateKey(calendarMonth).slice(0, 7);
    setSelectedDay((current) => {
      if (current.startsWith(monthPrefix)) return current;
      const today = dateKey(new Date());
      if (today.startsWith(monthPrefix)) return today;
      return rows[0] ? dateKey(rows[0].startedAt) : dateKey(calendarMonth);
    });
  }, [calendarMonth, db]);

  useEffect(() => {
    void load();
  }, [load, revision]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar, revision]);

  async function refresh() {
    setRefreshing(true);
    try {
      await Promise.all([load(), loadCalendar()]);
    } finally {
      setRefreshing(false);
    }
  }

  async function beginSession(start: () => Promise<string>) {
    setAreaPickerOpen(false);
    try {
      await start();
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onMutate();
      await load();
    } catch (error) {
      Alert.alert(
        t("alerts.couldNotStartSession"),
        error instanceof Error ? error.message : t("common.pleaseTryAgain")
      );
    }
  }

  async function selectArea(area: AreaRow) {
    await beginSession(() => startSession(db, area.id));
  }

  async function selectCustomArea(areaName: string) {
    await beginSession(() => startCustomSession(db, areaName));
  }

  const isCustomSession = Boolean(openSession?.customAreaName);

  async function openSessionForAttempt(attempt: LogAttemptRow) {
    const loaded = sessions.find((session) => session.id === attempt.sessionId)
      ?? calendarSessions.find((session) => session.id === attempt.sessionId)
      ?? await getSessionById(db, attempt.sessionId);
    if (loaded) setSelectedSession(loaded);
  }

  const completedSessions = sessions.filter((session) => session.endedAt !== null);
  const overallRatingAverage = useMemo(() => {
    const averages = completedSessions
      .map(sessionRatingAverage)
      .filter((value): value is number => value != null);
    if (!averages.length) return null;
    return averages.reduce((sum, value) => sum + value, 0) / averages.length;
  }, [completedSessions]);

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} />}
      >
        <ScreenHeader
          eyebrow={t("log.eyebrow")}
          title={t("log.title")}
          subtitle={t("log.subtitle")}
          theme={theme}
        />

        {openSession ? (
          <Card theme={theme} style={[styles.activeCard, { borderColor: theme.moss }]}>
            <View style={styles.activeTop}>
              <View style={styles.activeCopy}>
                <Pill label={t("log.liveSession")} theme={theme} tone="moss" />
                <Text style={[styles.areaName, { color: theme.text }]}>
                  {localizedName(openSession.areaNameJa, openSession.areaNameEn)}
                </Text>
                <Text style={[styles.sessionTime, { color: theme.muted }]}>
                  {t("log.started", {
                    date: formatSessionDate(openSession.startedAt, localeTag),
                    duration: durationLabel(openSession.startedAt)
                  })}
                </Text>
              </View>
              <View style={[styles.liveDot, { backgroundColor: theme.moss }]} />
            </View>
            <View style={[styles.metrics, { borderColor: theme.border }]}>
              <Metric label={t("log.attempts")} value={openSession.attemptCount} theme={theme} />
              <Metric label={t("log.sends")} value={openSession.sendCount} theme={theme} accent />
              <Metric
                label={t("log.rate")}
                value={openSession.attemptCount ? `${Math.round((openSession.sendCount / openSession.attemptCount) * 100)}%` : "—"}
                theme={theme}
              />
            </View>
            <View style={styles.actions}>
              <Button
                label={isCustomSession ? t("log.logClimb") : t("log.logAttempt")}
                onPress={() => {
                  if (isCustomSession) {
                    setSelectedProblem(null);
                    setManualLogging(true);
                    setAttemptOpen(true);
                    return;
                  }
                  setManualLogging(false);
                  setProblemPickerOpen(true);
                }}
                theme={theme}
                style={styles.flexButton}
              />
              <Button label={t("log.finish")} onPress={() => setFinishOpen(true)} theme={theme} kind="secondary" style={styles.finishButton} />
            </View>
          </Card>
        ) : (
          <Card theme={theme} style={styles.startCard}>
            <View style={[styles.startMark, { backgroundColor: theme.accentSoft }]}>
              <Text style={[styles.startMarkText, { color: theme.accent }]}>＋</Text>
            </View>
            <Text style={[styles.startTitle, { color: theme.text }]}>{t("log.startTitle")}</Text>
            <Text style={[styles.startBody, { color: theme.muted }]}>{t("log.startBody")}</Text>
            <Button label={t("log.chooseArea")} onPress={() => setAreaPickerOpen(true)} theme={theme} style={styles.startButton} />
            <Text style={[styles.startHint, { color: theme.faint }]}>{t("log.customAreaHint")}</Text>
          </Card>
        )}

        <View style={styles.logViews}>
          <SegmentedControl
            options={[
              { value: "sessions", label: t("log.sessions") },
              { value: "calendar", label: t("log.calendar") },
              { value: "sends", label: t("log.sendsTab") }
            ]}
            value={logView}
            onChange={setLogView}
            theme={theme}
          />
        </View>

        {logView === "sessions" ? (
          <>
            <SectionTitle
              title={t("log.recentSessions")}
              detail={
                completedSessions.length
                  ? overallRatingAverage != null
                    ? t("log.shownWithAvg", {
                        count: completedSessions.length,
                        value: formatRatingAverage(overallRatingAverage)
                      })
                    : t("log.shown", { count: completedSessions.length })
                  : undefined
              }
              theme={theme}
              style={styles.sectionTitle}
            />
            {completedSessions.length === 0 ? (
              <Card theme={theme}>
                <EmptyState
                  title={t("log.logbookEmptyTitle")}
                  body={t("log.logbookEmptyBody")}
                  theme={theme}
                />
              </Card>
            ) : (
              <View style={styles.sessionList}>
                {completedSessions.map((session) => (
                  <SessionCard key={session.id} session={session} theme={theme} onPress={() => setSelectedSession(session)} />
                ))}
              </View>
            )}
          </>
        ) : null}

        {logView === "calendar" ? (
          <View style={styles.viewContent}>
            <CalendarLog
              month={calendarMonth}
              sessions={calendarSessions}
              selectedDay={selectedDay}
              onMonthChange={(month) => setCalendarMonth(firstOfMonth(month))}
              onDayChange={setSelectedDay}
              onOpenSession={setSelectedSession}
              theme={theme}
            />
          </View>
        ) : null}

        {logView === "sends" ? (
          <View style={styles.viewContent}>
            <SectionTitle
              title={t("log.sentProblems")}
              detail={sentProblems.length ? t("log.sendsCount", { count: sentProblems.length }) : undefined}
              theme={theme}
            />
            {sentProblems.length ? (
              <View style={styles.sessionList}>
                {sentProblems.map((attempt) => (
                  <SendCard key={attempt.id} attempt={attempt} theme={theme} onPress={() => void openSessionForAttempt(attempt)} />
                ))}
              </View>
            ) : (
              <Card theme={theme}>
                <EmptyState
                  title={t("log.noSendsTitle")}
                  body={t("log.noSendsBody")}
                  theme={theme}
                />
              </Card>
            )}
          </View>
        ) : null}
      </ScrollView>

      <SessionDetailSheet
        visible={selectedSession !== null}
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
        theme={theme}
      />
      <AreaPicker
        visible={areaPickerOpen}
        onClose={() => setAreaPickerOpen(false)}
        onSelect={selectArea}
        onSelectCustom={selectCustomArea}
        theme={theme}
      />
      <ProblemPicker
        visible={problemPickerOpen}
        areaId={openSession?.areaId ?? ""}
        areaName={openSession ? localizedName(openSession.areaNameJa, openSession.areaNameEn) : ""}
        onClose={() => setProblemPickerOpen(false)}
        onSelect={(problem) => {
          setSelectedProblem(problem);
          setManualLogging(false);
          setProblemPickerOpen(false);
          setAttemptOpen(true);
        }}
        onSelectManual={() => {
          setSelectedProblem(null);
          setManualLogging(true);
          setProblemPickerOpen(false);
          setAttemptOpen(true);
        }}
        theme={theme}
      />
      <AttemptComposer
        visible={attemptOpen}
        problem={selectedProblem}
        manualArea={
          manualLogging && openSession
            ? {
                areaId: openSession.areaId,
                areaName: localizedName(openSession.areaNameJa, openSession.areaNameEn)
              }
            : null
        }
        onClose={() => {
          setAttemptOpen(false);
          setManualLogging(false);
        }}
        onSaved={() => {
          onMutate();
          void load();
        }}
        theme={theme}
      />
      <FinishSessionSheet
        visible={finishOpen}
        session={openSession}
        onClose={() => setFinishOpen(false)}
        onFinished={() => {
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
  activeCard: { padding: 20 },
  activeTop: { flexDirection: "row", alignItems: "flex-start" },
  activeCopy: { flex: 1 },
  areaName: { fontSize: 27, lineHeight: 32, fontWeight: "800", letterSpacing: -0.7, marginTop: 13 },
  sessionTime: { fontSize: 12, marginTop: 5 },
  liveDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  metrics: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, marginTop: 20, paddingTop: 17 },
  actions: { flexDirection: "row", gap: 10, marginTop: 19 },
  flexButton: { flex: 1 },
  finishButton: { width: 92 },
  startCard: { alignItems: "center", paddingVertical: 28 },
  startMark: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 17 },
  startMarkText: { fontSize: 32, lineHeight: 37, fontWeight: "300" },
  startTitle: { fontSize: 21, fontWeight: "800", letterSpacing: -0.4 },
  startBody: { fontSize: 14, lineHeight: 20, textAlign: "center", maxWidth: 300, marginTop: 8 },
  startButton: { marginTop: 20, minWidth: 150 },
  startHint: { fontSize: 12, lineHeight: 17, textAlign: "center", maxWidth: 280, marginTop: 12 },
  logViews: { marginTop: 26 },
  sectionTitle: { marginTop: 26 },
  viewContent: { marginTop: 26 },
  sessionList: { gap: 10 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.995 }] },
  sessionRow: { flexDirection: "row", alignItems: "flex-start", gap: 13 },
  dateBadge: { width: 51, height: 56, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  dateMonth: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  dateDay: { fontSize: 21, lineHeight: 23, fontWeight: "800" },
  sessionCopy: { flex: 1, paddingTop: 2 },
  sessionArea: { fontSize: 16, fontWeight: "700" },
  sessionMeta: { fontSize: 12, marginTop: 4 },
  reflection: { fontSize: 12, fontStyle: "italic", lineHeight: 17, marginTop: 8 },
  viewDetails: { fontSize: 11, lineHeight: 16, fontWeight: "700", marginTop: 9 },
  calendarCard: { paddingHorizontal: 11, paddingTop: 14, paddingBottom: 13 },
  monthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 5, marginBottom: 15 },
  monthButton: { width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  monthButtonText: { fontSize: 27, lineHeight: 29, marginTop: -2 },
  monthTitleButton: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 6 },
  monthTitle: { fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  monthTitleCaret: { fontSize: 11, fontWeight: "700", marginTop: 1 },
  weekdayRow: { flexDirection: "row", marginBottom: 5 },
  weekday: { width: "14.2857%", textAlign: "center", fontSize: 8, lineHeight: 12, fontWeight: "800", letterSpacing: 0.65 },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  monthPickerGrid: { flexDirection: "row", flexWrap: "wrap", paddingTop: 4, paddingBottom: 6 },
  monthPickerCell: { width: "33.3333%", aspectRatio: 1.55, padding: 4 },
  monthPickerButton: { flex: 1, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  monthPickerLabel: { fontSize: 15, lineHeight: 19, fontWeight: "700" },
  dayCell: { width: "14.2857%", aspectRatio: 0.88, padding: 2 },
  dayButton: { flex: 1, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  dayNumber: { fontSize: 13, lineHeight: 17, fontWeight: "700" },
  calendarDot: { width: 5, height: 5, borderRadius: 3, alignItems: "center", justifyContent: "center", marginTop: 3 },
  calendarSelectionTitle: { marginTop: 24 },
  sendHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  sendCopy: { flex: 1 },
  sendName: { fontSize: 18, lineHeight: 22, fontWeight: "800", letterSpacing: -0.25 },
  sendMeta: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  sendFacts: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 9, marginTop: 13 },
  sendDate: { flexShrink: 1, fontSize: 11, lineHeight: 16, fontWeight: "600" },
  notePreview: { marginTop: 14 },
  noteLabel: { fontSize: 9, lineHeight: 13, fontWeight: "800", letterSpacing: 1.15, marginBottom: 4 },
  noteText: { fontSize: 13, lineHeight: 19 }
});
