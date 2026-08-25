import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSQLiteContext } from "expo-sqlite";

import { saveAttempt } from "../db/repository";
import { gradeOrder } from "../domain/grades";
import type { AttemptResult, PerceivedDifficulty, ProblemRow } from "../domain/types";
import { useGradeSystem } from "../grades/GradeSystemContext";
import { useI18n } from "../i18n";
import type { AppTheme } from "../theme/theme";
import { Button, Pill, SegmentedControl } from "./ui";

export function AttemptComposer({
  visible,
  problem,
  manualArea = null,
  initialResult = "attempt",
  onClose,
  onSaved,
  theme
}: {
  visible: boolean;
  problem: ProblemRow | null;
  /** When set without a topo problem, collect name/grade for a climb not in the topo. */
  manualArea?: { areaId: string; areaName: string } | null;
  initialResult?: AttemptResult;
  onClose: () => void;
  onSaved: () => void;
  theme: AppTheme;
}) {
  const db = useSQLiteContext();
  const { t, localizedName } = useI18n();
  const { formatGrade } = useGradeSystem();
  const isManual = Boolean(manualArea) && !problem;
  const [result, setResult] = useState<AttemptResult>(initialResult);
  const [difficulty, setDifficulty] = useState<PerceivedDifficulty>(0);
  const [tryCount, setTryCount] = useState(1);
  const [notes, setNotes] = useState("");
  const [problemName, setProblemName] = useState("");
  const [boulderName, setBoulderName] = useState("");
  const [grade, setGrade] = useState("");
  const [saving, setSaving] = useState(false);

  const difficultyOptions = useMemo(
    () =>
      [
        { value: -2 as PerceivedDifficulty, label: t("attempt.muchEasier") },
        { value: -1 as PerceivedDifficulty, label: t("attempt.easier") },
        { value: 0 as PerceivedDifficulty, label: t("attempt.onGrade") },
        { value: 1 as PerceivedDifficulty, label: t("attempt.harder") },
        { value: 2 as PerceivedDifficulty, label: t("attempt.muchHarder") }
      ],
    [t]
  );

  useEffect(() => {
    if (!visible) return;
    setResult(initialResult);
    setDifficulty(0);
    setTryCount(1);
    setNotes("");
    setProblemName("");
    setBoulderName("");
    setGrade("");
  }, [initialResult, problem?.id, manualArea?.areaId, visible]);

  async function submit() {
    if (saving) return;
    if (isManual) {
      if (!manualArea || !problemName.trim()) return;
    } else if (!problem) {
      return;
    }

    setSaving(true);
    try {
      if (isManual && manualArea) {
        await saveAttempt(db, {
          areaId: manualArea.areaId,
          problemName,
          boulderName,
          grade,
          result,
          tryCount: result === "flash" ? 1 : tryCount,
          perceivedDifficulty: difficulty,
          notes
        });
      } else if (problem) {
        await saveAttempt(db, {
          areaId: problem.areaId,
          boulderId: problem.boulderId,
          problemId: problem.id,
          result,
          tryCount: result === "flash" ? 1 : tryCount,
          perceivedDifficulty: difficulty,
          notes
        });
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
      onClose();
    } catch (error) {
      Alert.alert(
        t("alerts.couldNotSaveAttempt"),
        error instanceof Error ? error.message : t("common.pleaseTryAgain")
      );
    } finally {
      setSaving(false);
    }
  }

  const displayedTries = result === "flash" ? 1 : tryCount;
  const tryUnit = displayedTries === 1 ? t("common.try") : t("common.tries");
  const canSave = isManual ? Boolean(problemName.trim()) : Boolean(problem);
  const titleName = isManual
    ? problemName.trim() || t("attempt.manualClimbTitle")
    : problem
      ? localizedName(problem.nameJa, problem.nameEn)
      : t("common.problem");
  const metaLine = isManual
    ? manualArea?.areaName ?? ""
    : problem
      ? `${localizedName(problem.areaNameJa, problem.areaNameEn)} · ${localizedName(problem.boulderNameJa, problem.boulderNameEn)}`
      : "";
  const rawGrade = isManual ? grade : problem?.grade ?? "";
  const gradeLabel = rawGrade ? formatGrade(rawGrade) : "";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.problemRow}>
              <View style={styles.problemCopy}>
                <Text style={[styles.kicker, { color: theme.accent }]}>
                  {isManual ? t("attempt.logManualClimb") : t("attempt.logAttempt")}
                </Text>
                <Text style={[styles.problemName, { color: theme.text }]}>{titleName}</Text>
                {metaLine ? <Text style={[styles.problemMeta, { color: theme.muted }]}>{metaLine}</Text> : null}
              </View>
              {gradeLabel ? <Pill label={gradeLabel} theme={theme} tone="gold" /> : null}
            </View>

            {isManual ? (
              <>
                <Text style={[styles.label, { color: theme.text }]}>{t("attempt.problemName")}</Text>
                <TextInput
                  value={problemName}
                  onChangeText={setProblemName}
                  placeholder={t("attempt.problemNamePlaceholder")}
                  placeholderTextColor={theme.faint}
                  autoCorrect={false}
                  style={[styles.singleInput, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
                />

                <Text style={[styles.label, { color: theme.text }]}>{t("attempt.boulderNameOptional")}</Text>
                <TextInput
                  value={boulderName}
                  onChangeText={setBoulderName}
                  placeholder={t("attempt.boulderNamePlaceholder")}
                  placeholderTextColor={theme.faint}
                  autoCorrect={false}
                  style={[styles.singleInput, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
                />

                <Text style={[styles.label, { color: theme.text }]}>{t("attempt.gradeOptional")}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gradeRow}>
                  <Pressable
                    onPress={() => {
                      setGrade("");
                      void Haptics.selectionAsync();
                    }}
                    style={[
                      styles.gradeChip,
                      {
                        backgroundColor: !grade ? theme.accentSoft : theme.background,
                        borderColor: !grade ? theme.accent : theme.border
                      }
                    ]}
                  >
                    <Text style={[styles.gradeChipText, { color: !grade ? theme.accent : theme.muted }]}>
                      {t("attempt.noGrade")}
                    </Text>
                  </Pressable>
                  {gradeOrder.map((option) => {
                    const selected = option === grade;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => {
                          setGrade(option);
                          void Haptics.selectionAsync();
                        }}
                        style={[
                          styles.gradeChip,
                          {
                            backgroundColor: selected ? theme.accentSoft : theme.background,
                            borderColor: selected ? theme.accent : theme.border
                          }
                        ]}
                      >
                        <Text style={[styles.gradeChipText, { color: selected ? theme.accent : theme.muted }]}>
                          {formatGrade(option)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            ) : null}

            <Text style={[styles.label, { color: theme.text }]}>{t("attempt.result")}</Text>
            <SegmentedControl
              options={[
                { value: "attempt", label: t("attempt.attempt") },
                { value: "send", label: t("attempt.send") },
                { value: "flash", label: t("attempt.flash") }
              ]}
              value={result}
              onChange={(nextResult) => {
                setResult(nextResult);
                if (nextResult === "flash") setTryCount(1);
              }}
              theme={theme}
            />

            <Text style={[styles.label, { color: theme.text }]}>{t("attempt.numberOfTries")}</Text>
            <View style={[styles.tryStepper, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("attempt.decreaseTries")}
                disabled={tryCount <= 1 || result === "flash"}
                onPress={() => setTryCount((value) => Math.max(1, value - 1))}
                style={({ pressed }) => [styles.tryButton, pressed && styles.pressed, (tryCount <= 1 || result === "flash") && styles.disabled]}
              >
                <Text style={[styles.tryButtonText, { color: theme.accent }]}>−</Text>
              </Pressable>
              <View style={styles.tryValueWrap}>
                <Text style={[styles.tryValue, { color: theme.text }]}>{displayedTries}</Text>
                <Text style={[styles.tryUnit, { color: theme.muted }]}>{tryUnit}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("attempt.increaseTries")}
                disabled={result === "flash"}
                onPress={() => setTryCount((value) => Math.min(999, value + 1))}
                style={({ pressed }) => [styles.tryButton, pressed && styles.pressed, result === "flash" && styles.disabled]}
              >
                <Text style={[styles.tryButtonText, { color: theme.accent }]}>＋</Text>
              </Pressable>
            </View>
            <Text style={[styles.tryHint, { color: theme.faint }]}>{t("attempt.tryHint")}</Text>

            <Text style={[styles.label, { color: theme.text }]}>{t("attempt.howDidGradeFeel")}</Text>
            <View style={styles.difficultyGrid}>
              {difficultyOptions.map((option) => {
                const selected = option.value === difficulty;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      setDifficulty(option.value);
                      void Haptics.selectionAsync();
                    }}
                    style={[
                      styles.difficulty,
                      {
                        backgroundColor: selected ? theme.accentSoft : theme.background,
                        borderColor: selected ? theme.accent : theme.border
                      }
                    ]}
                  >
                    <Text style={[styles.difficultyText, { color: selected ? theme.accent : theme.muted }]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, { color: theme.text }]}>{t("attempt.attemptNotes")}</Text>
            <TextInput
              multiline
              value={notes}
              onChangeText={setNotes}
              placeholder={t("attempt.notesPlaceholder")}
              placeholderTextColor={theme.faint}
              style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
              textAlignVertical="top"
            />

            <Button
              label={saving ? t("attempt.saving") : result === "attempt" ? t("attempt.saveAttempt") : t("attempt.saveSend")}
              onPress={submit}
              theme={theme}
              disabled={saving || !canSave}
              style={styles.submit}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.46)" },
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 22,
    paddingBottom: 26
  },
  handle: { width: 42, height: 5, borderRadius: 3, alignSelf: "center", marginTop: 10, marginBottom: 21 },
  problemRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 24 },
  problemCopy: { flex: 1 },
  kicker: { fontSize: 10, fontWeight: "800", letterSpacing: 1.7, marginBottom: 5 },
  problemName: { fontSize: 25, lineHeight: 30, fontWeight: "800", letterSpacing: -0.65 },
  problemMeta: { fontSize: 13, marginTop: 5 },
  label: { fontSize: 13, fontWeight: "700", marginTop: 19, marginBottom: 9 },
  singleInput: { height: 48, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, fontSize: 15 },
  gradeRow: { gap: 8, paddingRight: 8 },
  gradeChip: { borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10 },
  gradeChipText: { fontSize: 12, fontWeight: "700" },
  difficultyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  difficulty: { borderWidth: 1, borderRadius: 13, paddingHorizontal: 11, paddingVertical: 10 },
  difficultyText: { fontSize: 12, fontWeight: "700" },
  tryStepper: { height: 58, borderWidth: 1, borderRadius: 16, flexDirection: "row", alignItems: "center" },
  tryButton: { width: 64, height: "100%", alignItems: "center", justifyContent: "center" },
  tryButtonText: { fontSize: 25, lineHeight: 28, fontWeight: "700" },
  tryValueWrap: { flex: 1, flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: 6 },
  tryValue: { fontSize: 24, lineHeight: 28, fontWeight: "800" },
  tryUnit: { fontSize: 11, fontWeight: "700" },
  tryHint: { fontSize: 10, lineHeight: 15, marginTop: 7 },
  pressed: { opacity: 0.62 },
  disabled: { opacity: 0.3 },
  input: { minHeight: 104, borderWidth: 1, borderRadius: 16, padding: 14, fontSize: 15, lineHeight: 21 },
  submit: { marginTop: 20, marginBottom: 6 }
});
