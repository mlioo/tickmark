import type { PropsWithChildren, ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { AppTheme } from "../../theme/theme";
import { STORY_HEIGHT, STORY_WIDTH } from "../recapStats";

export function StoryFrame({
  theme,
  kicker,
  footer,
  accent = "accent",
  children
}: PropsWithChildren<{
  theme: AppTheme;
  kicker?: string;
  footer?: ReactNode;
  accent?: "accent" | "moss" | "gold";
}>) {
  const accentColor = accent === "moss" ? theme.moss : accent === "gold" ? theme.gold : theme.accent;
  const soft =
    accent === "moss" ? theme.mossSoft : accent === "gold" ? theme.goldSoft : theme.accentSoft;

  return (
    <View style={[styles.frame, { backgroundColor: theme.background }]}>
      <View style={[styles.orbTop, { backgroundColor: soft }]} />
      <View style={[styles.orbBottom, { backgroundColor: theme.mossSoft }]} />
      <View style={styles.content}>
        {kicker ? <Text style={[styles.kicker, { color: accentColor }]}>{kicker}</Text> : null}
        <View style={styles.body}>{children}</View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </View>
  );
}

export function StoryHeroNumber({
  value,
  theme,
  accent = "accent"
}: {
  value: string | number;
  theme: AppTheme;
  accent?: "accent" | "moss" | "gold";
}) {
  const color = accent === "moss" ? theme.moss : accent === "gold" ? theme.gold : theme.accent;
  return <Text style={[styles.heroNumber, { color }]}>{value}</Text>;
}

export function StoryTitle({ children, theme }: PropsWithChildren<{ theme: AppTheme }>) {
  return <Text style={[styles.title, { color: theme.text }]}>{children}</Text>;
}

export function StorySubtitle({ children, theme }: PropsWithChildren<{ theme: AppTheme }>) {
  return <Text style={[styles.subtitle, { color: theme.muted }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  frame: {
    width: STORY_WIDTH,
    height: STORY_HEIGHT,
    overflow: "hidden"
  },
  orbTop: {
    position: "absolute",
    top: -180,
    right: -120,
    width: 520,
    height: 520,
    borderRadius: 260,
    opacity: 0.85
  },
  orbBottom: {
    position: "absolute",
    bottom: -220,
    left: -160,
    width: 560,
    height: 560,
    borderRadius: 280,
    opacity: 0.55
  },
  content: {
    flex: 1,
    paddingHorizontal: 88,
    paddingTop: 160,
    paddingBottom: 120,
    justifyContent: "space-between"
  },
  kicker: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 4,
    textTransform: "uppercase"
  },
  body: {
    flex: 1,
    justifyContent: "center",
    gap: 28
  },
  footer: {
    minHeight: 48
  },
  heroNumber: {
    fontSize: 220,
    lineHeight: 230,
    fontWeight: "800",
    letterSpacing: -8
  },
  title: {
    fontSize: 72,
    lineHeight: 82,
    fontWeight: "800",
    letterSpacing: -2.5,
    maxWidth: 860
  },
  subtitle: {
    fontSize: 36,
    lineHeight: 48,
    fontWeight: "500",
    maxWidth: 820
  }
});
