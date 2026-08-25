import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { AppTheme } from "../theme/theme";

type BarItem = { id?: string; label: string; value: number };

function BarRow({
  item,
  max,
  theme,
  color
}: {
  item: BarItem;
  max: number;
  theme: AppTheme;
  color?: string;
}): ReactNode {
  return (
    <>
      <Text numberOfLines={1} style={[styles.label, { color: theme.muted }]}>{item.label}</Text>
      <View style={[styles.track, { backgroundColor: theme.background }]}>
        <View
          style={[
            styles.bar,
            { backgroundColor: color ?? theme.moss, width: `${Math.max(7, (item.value / max) * 100)}%` }
          ]}
        />
      </View>
      <Text style={[styles.value, { color: theme.text }]}>{item.value}</Text>
    </>
  );
}

export function BarList({
  data,
  theme,
  color,
  emptyLabel = "",
  onPressItem
}: {
  data: BarItem[];
  theme: AppTheme;
  color?: string;
  emptyLabel?: string;
  onPressItem?: (item: BarItem) => void;
}) {
  const max = Math.max(1, ...data.map((item) => item.value));
  if (data.length === 0) {
    return <Text style={[styles.empty, { color: theme.muted }]}>{emptyLabel}</Text>;
  }
  return (
    <View style={styles.list}>
      {data.map((item) =>
        onPressItem ? (
          <Pressable
            key={item.id ?? item.label}
            accessibilityRole="button"
            onPress={() => onPressItem(item)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <BarRow item={item} max={max} theme={theme} color={color} />
          </Pressable>
        ) : (
          <View key={item.id ?? item.label} style={styles.row}>
            <BarRow item={item} max={max} theme={theme} color={color} />
          </View>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 11 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  pressed: { opacity: 0.68 },
  label: { width: 72, fontSize: 12, fontWeight: "600" },
  track: { height: 9, borderRadius: 8, flex: 1, overflow: "hidden" },
  bar: { height: "100%", borderRadius: 8 },
  value: { width: 22, textAlign: "right", fontSize: 12, fontWeight: "700" },
  empty: { fontSize: 13, lineHeight: 19, paddingVertical: 8 }
});
