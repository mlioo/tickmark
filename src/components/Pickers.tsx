import { useEffect, useState, type ReactNode } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { getAreas, getProblems } from "../db/repository";
import type { AreaRow, ProblemRow } from "../domain/types";
import { useGradeSystem } from "../grades/GradeSystemContext";
import { useI18n } from "../i18n";
import type { AppTheme } from "../theme/theme";
import { Pill } from "./ui";

function PickerFrame({
  visible,
  title,
  subtitle,
  query,
  setQuery,
  onClose,
  theme,
  hideSearch = false,
  children
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  query: string;
  setQuery: (query: string) => void;
  onClose: () => void;
  theme: AppTheme;
  hideSearch?: boolean;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.frame, { backgroundColor: theme.background }]}>
        <View style={styles.topRow}>
          <View style={styles.titleCopy}>
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={[styles.close, { color: theme.accent }]}>{t("common.done")}</Text>
          </Pressable>
        </View>
        {hideSearch ? null : (
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("common.search")}
            placeholderTextColor={theme.faint}
            autoCorrect={false}
            style={[styles.search, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          />
        )}
        {children}
      </View>
    </Modal>
  );
}

export function AreaPicker({
  visible,
  onClose,
  onSelect,
  onSelectCustom,
  theme
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (area: AreaRow) => void;
  onSelectCustom: (areaName: string) => void;
  theme: AppTheme;
}) {
  const db = useSQLiteContext();
  const { t, localizedName, secondaryName } = useI18n();
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [query, setQuery] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState("");

  useEffect(() => {
    if (!visible) {
      setCustomMode(false);
      setCustomName("");
      setQuery("");
      return;
    }
    void getAreas(db, query).then(setAreas);
  }, [db, query, visible]);

  function submitCustom() {
    const name = customName.trim();
    if (!name) return;
    onSelectCustom(name);
  }

  return (
    <PickerFrame
      visible={visible}
      title={customMode ? t("pickers.customAreaTitle") : t("pickers.chooseArea")}
      subtitle={customMode ? t("pickers.customAreaSubtitle") : t("pickers.chooseAreaSubtitle")}
      query={query}
      setQuery={setQuery}
      onClose={onClose}
      theme={theme}
      hideSearch={customMode}
    >
      {customMode ? (
        <View style={styles.customForm}>
          <Text style={[styles.customLabel, { color: theme.text }]}>{t("pickers.customAreaName")}</Text>
          <TextInput
            value={customName}
            onChangeText={setCustomName}
            placeholder={t("pickers.customAreaPlaceholder")}
            placeholderTextColor={theme.faint}
            autoFocus
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={submitCustom}
            style={[styles.customInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          />
          <Text style={[styles.customHint, { color: theme.muted }]}>{t("pickers.customAreaHint")}</Text>
          <View style={styles.customActions}>
            <Pressable
              onPress={() => {
                setCustomMode(false);
                setCustomName("");
              }}
              style={({ pressed }) => [
                styles.secondaryAction,
                { borderColor: theme.border },
                pressed && { opacity: 0.72 }
              ]}
            >
              <Text style={[styles.secondaryActionText, { color: theme.muted }]}>{t("common.back")}</Text>
            </Pressable>
            <Pressable
              onPress={submitCustom}
              disabled={!customName.trim()}
              style={({ pressed }) => [
                styles.primaryAction,
                { backgroundColor: theme.accent, opacity: customName.trim() ? (pressed ? 0.85 : 1) : 0.4 }
              ]}
            >
              <Text style={styles.primaryActionText}>{t("pickers.startCustomSession")}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <FlatList
          data={areas}
          keyExtractor={(area) => area.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Pressable
              onPress={() => setCustomMode(true)}
              style={({ pressed }) => [
                styles.customEntry,
                { backgroundColor: theme.accentSoft, borderColor: theme.accent },
                pressed && { opacity: 0.8 }
              ]}
            >
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: theme.accent }]}>{t("pickers.addCustomArea")}</Text>
                <Text style={[styles.rowMeta, { color: theme.muted }]}>{t("pickers.addCustomAreaBody")}</Text>
              </View>
              <Text style={[styles.chevron, { color: theme.accent }]}>›</Text>
            </Pressable>
          }
          renderItem={({ item }) => {
            const secondary = secondaryName(item.nameJa, item.nameEn);
            return (
              <Pressable
                onPress={() => onSelect(item)}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                  pressed && { opacity: 0.72 }
                ]}
              >
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>{localizedName(item.nameJa, item.nameEn)}</Text>
                  <Text style={[styles.rowMeta, { color: theme.muted }]}>
                    {t("pickers.problemsMeta", {
                      secondary: secondary || localizedName(item.nameJa, item.nameEn),
                      prefecture: item.prefecture,
                      count: item.problemCount
                    })}
                  </Text>
                </View>
                <Text style={[styles.chevron, { color: theme.faint }]}>›</Text>
              </Pressable>
            );
          }}
        />
      )}
    </PickerFrame>
  );
}

export function ProblemPicker({
  visible,
  areaId,
  areaName,
  onClose,
  onSelect,
  onSelectManual,
  theme
}: {
  visible: boolean;
  areaId: string;
  areaName: string;
  onClose: () => void;
  onSelect: (problem: ProblemRow) => void;
  onSelectManual: () => void;
  theme: AppTheme;
}) {
  const db = useSQLiteContext();
  const { t, localizedName, secondaryName } = useI18n();
  const { formatGrade } = useGradeSystem();
  const [problems, setProblems] = useState<ProblemRow[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!visible || !areaId) return;
    void getProblems(db, areaId, query).then(setProblems);
  }, [areaId, db, query, visible]);

  return (
    <PickerFrame
      visible={visible}
      title={t("pickers.logClimb")}
      subtitle={areaName}
      query={query}
      setQuery={setQuery}
      onClose={onClose}
      theme={theme}
    >
      <FlatList
        data={problems}
        keyExtractor={(problem) => `${problem.areaId}:${problem.id}`}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Pressable
            onPress={onSelectManual}
            style={({ pressed }) => [
              styles.customEntry,
              { backgroundColor: theme.accentSoft, borderColor: theme.accent },
              pressed && { opacity: 0.8 }
            ]}
          >
            <View style={styles.rowCopy}>
              <Text style={[styles.rowTitle, { color: theme.accent }]}>{t("pickers.climbNotInTopo")}</Text>
              <Text style={[styles.rowMeta, { color: theme.muted }]}>{t("pickers.climbNotInTopoBody")}</Text>
            </View>
            <Text style={[styles.chevron, { color: theme.accent }]}>›</Text>
          </Pressable>
        }
        renderItem={({ item }) => {
          const secondary = secondaryName(item.nameJa, item.nameEn);
          return (
            <Pressable
              onPress={() => onSelect(item)}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: theme.surface, borderColor: theme.border },
                pressed && { opacity: 0.72 }
              ]}
            >
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>{localizedName(item.nameJa, item.nameEn)}</Text>
                <Text style={[styles.rowMeta, { color: theme.muted }]}>
                  {t("pickers.problemMeta", {
                    secondary: secondary || localizedName(item.nameJa, item.nameEn),
                    boulder: localizedName(item.boulderNameJa, item.boulderNameEn)
                  })}
                </Text>
              </View>
              {item.grade ? <Pill label={formatGrade(item.grade)} theme={theme} tone="gold" /> : null}
            </Pressable>
          );
        }}
      />
    </PickerFrame>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, paddingTop: 24, paddingHorizontal: 18 },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 17 },
  titleCopy: { flex: 1 },
  title: { fontSize: 27, fontWeight: "800", letterSpacing: -0.7 },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  close: { fontSize: 15, fontWeight: "700", paddingTop: 7 },
  search: { height: 48, borderRadius: 15, borderWidth: 1, paddingHorizontal: 14, fontSize: 15, marginBottom: 8 },
  list: { gap: 9, paddingTop: 3, paddingBottom: 28 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 72, borderWidth: StyleSheet.hairlineWidth, borderRadius: 17, paddingHorizontal: 15, paddingVertical: 12 },
  customEntry: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 72, borderWidth: 1, borderRadius: 17, paddingHorizontal: 15, paddingVertical: 12, marginBottom: 4 },
  rowCopy: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: "700" },
  rowMeta: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  chevron: { fontSize: 27, fontWeight: "300" },
  customForm: { paddingTop: 8 },
  customLabel: { fontSize: 13, fontWeight: "700", marginBottom: 9 },
  customInput: { height: 52, borderRadius: 15, borderWidth: 1, paddingHorizontal: 14, fontSize: 16 },
  customHint: { fontSize: 13, lineHeight: 19, marginTop: 12 },
  customActions: { flexDirection: "row", gap: 10, marginTop: 22 },
  secondaryAction: { height: 48, paddingHorizontal: 18, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  secondaryActionText: { fontSize: 15, fontWeight: "700" },
  primaryAction: { flex: 1, height: 48, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  primaryActionText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" }
});
