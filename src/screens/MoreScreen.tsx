import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useSQLiteContext } from "expo-sqlite";

import { Button, Card, Pill, ScreenHeader, SectionTitle, SegmentedControl } from "../components/ui";
import { clearClimbingLog, getTopoVersion, importLogData } from "../db/repository";
import { formatTopoVersionLabel } from "../domain/topoVersion";
import { seedSampleLogData } from "../db/seedTestLog";
import type { ImportLogPayload, ImportMode } from "../domain/types";
import { exportAttemptsAsCsv, exportLogAsJson } from "../export/exportLog";
import { pickAndParseImport } from "../export/importLog";
import type { GradeSystem } from "../domain/grades";
import { useI18n, type LanguagePreference } from "../i18n";
import { checkForTopoUpdate, downloadTopoUpdate } from "../network/opentopo";
import type { AppTheme, ThemePreference } from "../theme/theme";

export function MoreScreen({
  theme,
  revision,
  onMutate,
  themePreference,
  onThemePreferenceChange,
  languagePreference,
  onLanguagePreferenceChange,
  gradeSystemPreference,
  onGradeSystemPreferenceChange
}: {
  theme: AppTheme;
  revision: number;
  onMutate: () => void;
  themePreference: ThemePreference;
  onThemePreferenceChange: (preference: ThemePreference) => void;
  languagePreference: LanguagePreference;
  onLanguagePreferenceChange: (preference: LanguagePreference) => void;
  gradeSystemPreference: GradeSystem;
  onGradeSystemPreferenceChange: (preference: GradeSystem) => void;
}) {
  const db = useSQLiteContext();
  const { t } = useI18n();
  const [topoVersion, setTopoVersion] = useState(t("common.loading"));
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState<"json" | "csv" | null>(null);
  const [importing, setImporting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => setTopoVersion(await getTopoVersion(db)), [db]);

  useEffect(() => {
    void load();
  }, [load, revision]);

  async function checkUpdates() {
    if (syncing) return;
    setSyncing(true);
    try {
      const update = await checkForTopoUpdate(db);
      if (!update.available) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(t("alerts.topoCurrent"), update.message);
        return;
      }
      Alert.alert(t("alerts.topoUpdateAvailable"), t("alerts.topoUpdateMessage"), [
        { text: t("common.later"), style: "cancel" },
        {
          text: t("common.download"),
          onPress: () => {
            setSyncing(true);
            void downloadTopoUpdate(db, update.remoteVersion, update.remoteDate)
              .then(async () => {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onMutate();
                await load();
                Alert.alert(t("alerts.topoUpdated"), t("alerts.topoUpdatedMessage"));
              })
              .catch((error) =>
                Alert.alert(
                  t("alerts.updateFailed"),
                  error instanceof Error ? error.message : t("common.pleaseTryAgain")
                )
              )
              .finally(() => setSyncing(false));
          }
        }
      ]);
    } catch (error) {
      Alert.alert(
        t("alerts.couldNotCheckUpdates"),
        error instanceof Error ? error.message : t("common.pleaseTryAgainOnline")
      );
    } finally {
      setSyncing(false);
    }
  }

  async function exportData(format: "json" | "csv") {
    setExporting(format);
    try {
      const uri = format === "json" ? await exportLogAsJson(db) : await exportAttemptsAsCsv(db);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (!uri) Alert.alert(t("alerts.exportReady"), t("alerts.exportReadyMessage"));
    } catch (error) {
      Alert.alert(
        t("alerts.exportFailed"),
        error instanceof Error ? error.message : t("common.pleaseTryAgain")
      );
    } finally {
      setExporting(null);
    }
  }

  function skippedSuffix(count: number): string {
    return count > 0 ? t("alerts.importSkipped", { count }) : "";
  }

  function confirmImport(payload: ImportLogPayload) {
    const skipped = skippedSuffix(payload.skipped);
    const message =
      payload.source === "json"
        ? t("alerts.importJsonMessage", {
            sessions: payload.sessions.length,
            attempts: payload.attempts.length,
            notes: payload.problemNotes.length,
            skipped
          })
        : t("alerts.importCsvMessage", {
            sessions: payload.sessions.length,
            attempts: payload.attempts.length,
            skipped
          });

    Alert.alert(t("alerts.importTitle"), message, [
      { text: t("common.later"), style: "cancel" },
      {
        text: t("alerts.importMerge"),
        onPress: () => {
          void runImport(payload, "merge");
        }
      },
      {
        text: t("alerts.importReplace"),
        style: "destructive",
        onPress: () => {
          void runImport(payload, "replace");
        }
      }
    ]);
  }

  async function beginImport() {
    if (importing || exporting !== null) return;
    setImporting(true);
    try {
      const payload = await pickAndParseImport(db);
      if (!payload) return;
      confirmImport(payload);
    } catch (error) {
      Alert.alert(
        t("alerts.importFailed"),
        error instanceof Error ? error.message : t("alerts.importInvalidFile")
      );
    } finally {
      setImporting(false);
    }
  }

  async function runImport(payload: ImportLogPayload, mode: ImportMode) {
    setImporting(true);
    try {
      const result = await importLogData(db, payload, mode);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onMutate();
      Alert.alert(
        t("alerts.importSuccess"),
        t("alerts.importSuccessMessage", {
          sessions: result.sessions,
          attempts: result.attempts,
          notes: result.notes,
          skipped: skippedSuffix(result.skipped)
        })
      );
    } catch (error) {
      Alert.alert(
        t("alerts.importFailed"),
        error instanceof Error ? error.message : t("common.pleaseTryAgain")
      );
    } finally {
      setImporting(false);
    }
  }

  function confirmLoadSampleLog() {
    if (seeding) return;
    Alert.alert(t("alerts.loadSampleLogTitle"), t("alerts.loadSampleLogMessage"), [
      { text: t("common.later"), style: "cancel" },
      {
        text: t("alerts.loadSampleLogConfirm"),
        style: "destructive",
        onPress: () => {
          void loadSampleLog();
        }
      }
    ]);
  }

  async function loadSampleLog() {
    setSeeding(true);
    try {
      const result = await seedSampleLogData(db);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onMutate();
      Alert.alert(
        t("alerts.sampleLogLoaded"),
        t("alerts.sampleLogLoadedMessage", {
          sessions: result.sessions,
          attempts: result.attempts,
          notes: result.notes
        })
      );
    } catch (error) {
      Alert.alert(
        t("alerts.sampleLogFailed"),
        error instanceof Error ? error.message : t("common.pleaseTryAgain")
      );
    } finally {
      setSeeding(false);
    }
  }

  function confirmClearData() {
    if (clearing) return;
    Alert.alert(t("alerts.clearDataTitle"), t("alerts.clearDataMessage"), [
      { text: t("common.later"), style: "cancel" },
      {
        text: t("alerts.clearDataConfirm"),
        style: "destructive",
        onPress: () => {
          Alert.alert(t("alerts.clearDataFinalTitle"), t("alerts.clearDataFinalMessage"), [
            { text: t("common.later"), style: "cancel" },
            {
              text: t("alerts.clearDataFinalConfirm"),
              style: "destructive",
              onPress: () => {
                void clearData();
              }
            }
          ]);
        }
      }
    ]);
  }

  async function clearData() {
    setClearing(true);
    try {
      await clearClimbingLog(db);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onMutate();
      Alert.alert(t("alerts.clearDataDoneTitle"), t("alerts.clearDataDoneMessage"));
    } catch (error) {
      Alert.alert(
        t("alerts.clearDataFailed"),
        error instanceof Error ? error.message : t("common.pleaseTryAgain")
      );
    } finally {
      setClearing(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ScreenHeader
        eyebrow={t("more.eyebrow")}
        title={t("more.title")}
        subtitle={t("more.subtitle")}
        theme={theme}
      />

      <SectionTitle title={t("more.appearance")} theme={theme} />
      <Card theme={theme}>
        <Text style={[styles.settingTitle, { color: theme.text }]}>{t("settings.appTheme")}</Text>
        <Text style={[styles.settingBody, styles.themeBody, { color: theme.muted }]}>{t("settings.themeBody")}</Text>
        <SegmentedControl
          options={[
            { value: "system", label: t("settings.system") },
            { value: "light", label: t("settings.light") },
            { value: "dark", label: t("settings.dark") }
          ]}
          value={themePreference}
          onChange={onThemePreferenceChange}
          theme={theme}
        />
      </Card>

      <Card theme={theme} style={styles.languageCard}>
        <Text style={[styles.settingTitle, { color: theme.text }]}>{t("settings.language")}</Text>
        <Text style={[styles.settingBody, styles.themeBody, { color: theme.muted }]}>{t("settings.languageBody")}</Text>
        <SegmentedControl
          options={[
            { value: "system", label: t("settings.system") },
            { value: "en", label: "English" },
            { value: "ja", label: "日本語" }
          ]}
          value={languagePreference}
          onChange={onLanguagePreferenceChange}
          theme={theme}
        />
      </Card>

      <Card theme={theme} style={styles.languageCard}>
        <Text style={[styles.settingTitle, { color: theme.text }]}>{t("settings.gradeSystem")}</Text>
        <Text style={[styles.settingBody, styles.themeBody, { color: theme.muted }]}>{t("settings.gradeSystemBody")}</Text>
        <SegmentedControl
          options={[
            { value: "dankyu", label: t("settings.dankyu") },
            { value: "vscale", label: t("settings.vscale") }
          ]}
          value={gradeSystemPreference}
          onChange={onGradeSystemPreferenceChange}
          theme={theme}
        />
      </Card>

      <SectionTitle title={t("more.offlineTopo")} theme={theme} style={styles.section} />
      <Card theme={theme}>
        <View style={styles.settingRow}>
          <View style={styles.settingCopy}>
            <Text style={[styles.settingTitle, { color: theme.text }]}>{t("more.downloadedContent")}</Text>
            <Text style={[styles.settingBody, { color: theme.muted }]}>{t("more.downloadedBody")}</Text>
          </View>
          <View style={styles.versionPill}>
            <Pill label={formatTopoVersionLabel(topoVersion)} theme={theme} tone="moss" />
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Button
          label={syncing ? t("more.checkingGithub") : t("more.checkUpdates")}
          onPress={checkUpdates}
          disabled={syncing}
          theme={theme}
          kind="secondary"
        />
        <Text style={[styles.networkHint, { color: theme.faint }]}>{t("more.networkHint")}</Text>
      </Card>

      <SectionTitle title={t("more.exportLog")} theme={theme} style={styles.section} />
      <Card theme={theme}>
        <View style={styles.exportRow}>
          <View style={styles.exportCopy}>
            <Text style={[styles.settingTitle, { color: theme.text }]}>{t("more.completeBackup")}</Text>
            <Text style={[styles.settingBody, { color: theme.muted }]}>{t("more.completeBackupBody")}</Text>
          </View>
          <Button
            label={exporting === "json" ? t("common.preparing") : "JSON"}
            onPress={() => void exportData("json")}
            disabled={exporting !== null || importing}
            theme={theme}
            kind="secondary"
            compact
          />
        </View>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <View style={styles.exportRow}>
          <View style={styles.exportCopy}>
            <Text style={[styles.settingTitle, { color: theme.text }]}>{t("more.attemptsTable")}</Text>
            <Text style={[styles.settingBody, { color: theme.muted }]}>{t("more.attemptsTableBody")}</Text>
          </View>
          <Button
            label={exporting === "csv" ? t("common.preparing") : "CSV"}
            onPress={() => void exportData("csv")}
            disabled={exporting !== null || importing}
            theme={theme}
            kind="secondary"
            compact
          />
        </View>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <View style={styles.exportRow}>
          <View style={styles.exportCopy}>
            <Text style={[styles.settingTitle, { color: theme.text }]}>{t("more.importLog")}</Text>
            <Text style={[styles.settingBody, { color: theme.muted }]}>{t("more.importLogBody")}</Text>
          </View>
          <Button
            label={importing ? t("more.importing") : t("more.importButton")}
            onPress={() => void beginImport()}
            disabled={exporting !== null || importing}
            theme={theme}
            kind="secondary"
            compact
          />
        </View>
      </Card>

      <SectionTitle title={t("more.developer")} theme={theme} style={styles.section} />
      <Card theme={theme}>
        <Text style={[styles.settingTitle, { color: theme.text }]}>{t("more.sampleLog")}</Text>
        <Text style={[styles.settingBody, styles.themeBody, { color: theme.muted }]}>
          {t("more.sampleLogBody")}
        </Text>
        <Button
          label={seeding ? t("common.preparing") : t("more.loadSampleLog")}
          onPress={confirmLoadSampleLog}
          disabled={seeding || clearing}
          theme={theme}
          kind="secondary"
        />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Text style={[styles.settingTitle, { color: theme.text }]}>{t("more.clearData")}</Text>
        <Text style={[styles.settingBody, styles.themeBody, { color: theme.muted }]}>
          {t("more.clearDataBody")}
        </Text>
        <Button
          label={clearing ? t("common.preparing") : t("more.clearDataButton")}
          onPress={confirmClearData}
          disabled={seeding || clearing}
          theme={theme}
          kind="danger"
        />
      </Card>

      <SectionTitle title={t("more.privacy")} theme={theme} style={styles.section} />
      <Card theme={theme} style={[styles.privacyCard, { backgroundColor: theme.mossSoft }]}>
        <Text style={[styles.privacyTitle, { color: theme.moss }]}>{t("more.localByDesign")}</Text>
        <Text style={[styles.privacyBody, { color: theme.text }]}>{t("more.privacyLead")}</Text>
        <View style={styles.privacyList}>
          <PrivacyLine text={t("more.privacyLine1")} theme={theme} />
          <PrivacyLine text={t("more.privacyLine2")} theme={theme} />
          <PrivacyLine text={t("more.privacyLine3")} theme={theme} />
          <PrivacyLine text={t("more.privacyLine4")} theme={theme} />
          <PrivacyLine text={t("more.privacyLine5")} theme={theme} />
          <PrivacyLine text={t("more.privacyLine6")} theme={theme} />
        </View>
      </Card>

      <Text style={[styles.version, { color: theme.faint }]}>{t("more.version")}</Text>
    </ScrollView>
  );
}

function PrivacyLine({ text, theme }: { text: string; theme: AppTheme }) {
  return (
    <View style={styles.privacyLine}>
      <Text style={[styles.check, { color: theme.moss }]}>✓</Text>
      <Text style={[styles.privacyLineText, { color: theme.muted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 120 },
  settingRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  settingCopy: { flex: 1, minWidth: 0 },
  versionPill: { flexShrink: 0, alignSelf: "flex-start" },
  settingTitle: { fontSize: 15, fontWeight: "700" },
  settingBody: { fontSize: 12, lineHeight: 18, marginTop: 5 },
  themeBody: { marginBottom: 15 },
  languageCard: { marginTop: 10 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 17 },
  networkHint: { fontSize: 10, textAlign: "center", marginTop: 9 },
  section: { marginTop: 28 },
  exportRow: { flexDirection: "row", alignItems: "center", gap: 13 },
  exportCopy: { flex: 1 },
  privacyCard: { borderWidth: 0 },
  privacyTitle: { fontSize: 11, fontWeight: "800", letterSpacing: 1.3, textTransform: "uppercase" },
  privacyBody: { fontSize: 18, lineHeight: 25, fontWeight: "700", marginTop: 10 },
  privacyList: { gap: 10, marginTop: 17 },
  privacyLine: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  check: { fontSize: 14, fontWeight: "800" },
  privacyLineText: { flex: 1, fontSize: 12, lineHeight: 18 },
  version: { textAlign: "center", fontSize: 10, marginTop: 28 }
});
