import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle
} from "react-native";

import type { AppTheme } from "../theme/theme";

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  action,
  theme
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  theme: AppTheme;
}) {
  return (
    <View style={styles.headerRow}>
      <View style={styles.headerCopy}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: theme.accent }]}>{eyebrow}</Text> : null}
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function Card({
  children,
  theme,
  style
}: PropsWithChildren<{ theme: AppTheme; style?: ViewStyle | ViewStyle[] }>) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow },
        style
      ]}
    >
      {children}
    </View>
  );
}

export function Pill({
  label,
  theme,
  tone = "neutral"
}: {
  label: string;
  theme: AppTheme;
  tone?: "neutral" | "accent" | "moss" | "gold";
}) {
  const colors = {
    neutral: { background: theme.background, text: theme.muted },
    accent: { background: theme.accentSoft, text: theme.accent },
    moss: { background: theme.mossSoft, text: theme.moss },
    gold: { background: theme.goldSoft, text: theme.gold }
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: colors.background }]}>
      <Text style={[styles.pillText, { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  theme,
  kind = "primary",
  disabled = false,
  compact = false,
  style
}: {
  label: string;
  onPress: () => void;
  theme: AppTheme;
  kind?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  compact?: boolean;
  style?: ViewStyle | ViewStyle[];
}) {
  const palette = {
    primary: { background: theme.accent, border: theme.accent, text: "#FFFFFF" },
    secondary: { background: theme.surface, border: theme.border, text: theme.text },
    danger: { background: theme.surface, border: theme.danger, text: theme.danger }
  }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: palette.background, borderColor: palette.border },
        pressed && { opacity: 0.72 },
        disabled && { opacity: 0.4 },
        style
      ]}
    >
      <Text style={[styles.buttonText, { color: palette.text }]}>{label}</Text>
    </Pressable>
  );
}

export function SectionTitle({
  title,
  detail,
  theme,
  style
}: {
  title: string;
  detail?: string;
  theme: AppTheme;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.sectionRow, style]}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {detail ? <Text style={[styles.sectionDetail, { color: theme.muted }]}>{detail}</Text> : null}
    </View>
  );
}

export function Metric({
  label,
  value,
  theme,
  accent = false
}: {
  label: string;
  value: string | number;
  theme: AppTheme;
  accent?: boolean;
}) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color: accent ? theme.accent : theme.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  theme
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  theme: AppTheme;
}) {
  return (
    <View style={[styles.segmented, { backgroundColor: theme.background, borderColor: theme.border }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              selected && { backgroundColor: theme.raised, shadowColor: theme.shadow }
            ]}
          >
            <Text style={[styles.segmentText, { color: selected ? theme.text : theme.muted }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function EmptyState({
  title,
  body,
  theme
}: {
  title: string;
  body: string;
  theme: AppTheme;
}) {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyMark, { borderColor: theme.border }]}>
        <Text style={[styles.emptyMarkText, { color: theme.faint }]}>○</Text>
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: theme.muted }]}>{body}</Text>
    </View>
  );
}

export function LoadingState({ theme }: { theme: AppTheme }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={theme.accent} />
    </View>
  );
}

export function BackButton({ label = "Back", onPress, theme }: { label?: string; onPress: () => void; theme: AppTheme }) {
  return (
    <Pressable onPress={onPress} style={styles.backButton} hitSlop={12}>
      <Text style={[styles.backIcon, { color: theme.accent }]}>‹</Text>
      <Text style={[styles.backLabel, { color: theme.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 24
  },
  headerCopy: { flex: 1 },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.8, marginBottom: 6 },
  title: { fontSize: 34, lineHeight: 38, fontWeight: "800", letterSpacing: -1.1 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 7, maxWidth: 310 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    padding: 18,
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  pill: {
    flexShrink: 0,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  pillText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
  button: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  buttonCompact: { minHeight: 38, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 8 },
  buttonText: { fontSize: 14, fontWeight: "700" },
  sectionRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 12
  },
  sectionTitle: { fontSize: 19, fontWeight: "700", letterSpacing: -0.35 },
  sectionDetail: { fontSize: 12, fontWeight: "600" },
  metric: { flex: 1, minWidth: 72 },
  metricValue: { fontSize: 28, lineHeight: 32, fontWeight: "800", letterSpacing: -0.8 },
  metricLabel: { fontSize: 11, fontWeight: "600", marginTop: 3, textTransform: "uppercase", letterSpacing: 0.8 },
  segmented: { flexDirection: "row", borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 3 },
  segment: {
    flex: 1,
    minHeight: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.07,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }
  },
  segmentText: { fontSize: 12, fontWeight: "700" },
  empty: { alignItems: "center", paddingHorizontal: 26, paddingVertical: 38 },
  emptyMark: { width: 58, height: 58, borderRadius: 29, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 15 },
  emptyMarkText: { fontSize: 32, fontWeight: "300" },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginBottom: 7 },
  emptyBody: { textAlign: "center", fontSize: 14, lineHeight: 20, marginBottom: 18, maxWidth: 280 },
  loading: { minHeight: 180, alignItems: "center", justifyContent: "center" },
  backButton: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginBottom: 18 },
  backIcon: { fontSize: 30, lineHeight: 25, marginRight: 3 },
  backLabel: { fontSize: 14, fontWeight: "700" }
});
