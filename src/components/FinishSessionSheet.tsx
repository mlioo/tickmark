import { useEffect, useState } from "react";
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

import { finishSession } from "../db/repository";
import type { SessionRow } from "../domain/types";
import { useI18n } from "../i18n";
import type { AppTheme } from "../theme/theme";
import { Button } from "./ui";

function Rating({
  label,
  value,
  onChange,
  low,
  high,
  theme
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  low: string;
  high: string;
  theme: AppTheme;
}) {
  return (
    <View style={styles.ratingBlock}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <View style={styles.ratingRow}>
        {[1, 2, 3, 4, 5].map((rating) => (
          <Pressable
            key={rating}
            onPress={() => {
              onChange(rating);
              void Haptics.selectionAsync();
            }}
            style={[
              styles.rating,
              {
                backgroundColor: rating === value ? theme.mossSoft : theme.background,
                borderColor: rating === value ? theme.moss : theme.border
              }
            ]}
          >
            <Text style={[styles.ratingText, { color: rating === value ? theme.moss : theme.muted }]}>{rating}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.ratingLegend}>
        <Text style={[styles.legend, { color: theme.faint }]}>{low}</Text>
        <Text style={[styles.legend, { color: theme.faint }]}>{high}</Text>
      </View>
    </View>
  );
}

export function FinishSessionSheet({
  session,
  visible,
  onClose,
  onFinished,
  theme
}: {
  session: SessionRow | null;
  visible: boolean;
  onClose: () => void;
  onFinished: () => void;
  theme: AppTheme;
}) {
  const db = useSQLiteContext();
  const { t, localizedName } = useI18n();
  const [energy, setEnergy] = useState(3);
  const [weather, setWeather] = useState(3);
  const [mood, setMood] = useState(3);
  const [skin, setSkin] = useState(3);
  const [conditions, setConditions] = useState("");
  const [reflection, setReflection] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setEnergy(3);
    setWeather(3);
    setMood(3);
    setSkin(3);
    setConditions("");
    setReflection("");
  }, [visible]);

  async function submit() {
    if (!session || saving) return;
    setSaving(true);
    try {
      await finishSession(db, session.id, { energy, weather, mood, skin, conditions, reflection });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onFinished();
      onClose();
    } catch (error) {
      Alert.alert(
        t("alerts.couldNotFinishSession"),
        error instanceof Error ? error.message : t("common.pleaseTryAgain")
      );
    } finally {
      setSaving(false);
    }
  }

  const areaName = session ? localizedName(session.areaNameJa, session.areaNameEn) : "";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={[styles.kicker, { color: theme.moss }]}>{t("finishSession.kicker")}</Text>
            <Text style={[styles.title, { color: theme.text }]}>{t("finishSession.title")}</Text>
            <Text style={[styles.subtitle, { color: theme.muted }]}>
              {t("finishSession.subtitle", {
                area: areaName,
                attempts: session?.attemptCount ?? 0,
                sends: session?.sendCount ?? 0
              })}
            </Text>

            <Rating label={t("finishSession.energy")} value={energy} onChange={setEnergy} low={t("finishSession.empty")} high={t("finishSession.strong")} theme={theme} />
            <Rating label={t("finishSession.mood")} value={mood} onChange={setMood} low={t("finishSession.flat")} high={t("finishSession.psyched")} theme={theme} />
            <Rating label={t("finishSession.skin")} value={skin} onChange={setSkin} low={t("finishSession.done")} high={t("finishSession.fresh")} theme={theme} />
            <Rating label={t("finishSession.weather")} value={weather} onChange={setWeather} low={t("finishSession.weatherBad")} high={t("finishSession.weatherGood")} theme={theme} />

            <Text style={[styles.label, { color: theme.text }]}>{t("finishSession.conditions")}</Text>
            <TextInput
              value={conditions}
              onChangeText={setConditions}
              placeholder={t("finishSession.conditionsPlaceholder")}
              placeholderTextColor={theme.faint}
              style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
            />

            <Text style={[styles.label, { color: theme.text }]}>{t("finishSession.reflection")}</Text>
            <TextInput
              multiline
              value={reflection}
              onChangeText={setReflection}
              placeholder={t("finishSession.reflectionPlaceholder")}
              placeholderTextColor={theme.faint}
              textAlignVertical="top"
              style={[styles.input, styles.reflection, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
            />

            <Button
              label={saving ? t("finishSession.saving") : t("finishSession.finish")}
              onPress={submit}
              disabled={saving || !session}
              theme={theme}
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
    maxHeight: "94%",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 22,
    paddingBottom: 26
  },
  handle: { width: 42, height: 5, borderRadius: 3, alignSelf: "center", marginTop: 10, marginBottom: 21 },
  kicker: { fontSize: 10, fontWeight: "800", letterSpacing: 1.7, marginBottom: 5 },
  title: { fontSize: 28, lineHeight: 33, fontWeight: "800", letterSpacing: -0.7 },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 10 },
  ratingBlock: { marginTop: 18 },
  label: { fontSize: 13, fontWeight: "700", marginTop: 18, marginBottom: 9 },
  ratingRow: { flexDirection: "row", gap: 8 },
  rating: { flex: 1, height: 42, borderWidth: 1, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  ratingText: { fontSize: 13, fontWeight: "800" },
  ratingLegend: { flexDirection: "row", justifyContent: "space-between", marginTop: 5, paddingHorizontal: 2 },
  legend: { fontSize: 10, fontWeight: "600" },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  reflection: { minHeight: 105 },
  submit: { marginTop: 20, marginBottom: 6 }
});
