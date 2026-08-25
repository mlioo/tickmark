import { useColorScheme } from "react-native";

const light = {
  mode: "light" as const,
  background: "#F3F1EA",
  surface: "#FBFAF6",
  raised: "#FFFFFF",
  text: "#19211D",
  muted: "#6F7771",
  faint: "#A7ADA8",
  border: "#DDDCD4",
  accent: "#E35C35",
  accentPressed: "#C94A26",
  accentSoft: "#F8DED3",
  moss: "#286A4A",
  mossSoft: "#DCE9DF",
  gold: "#A66C14",
  goldSoft: "#F3E8CD",
  danger: "#B43D38",
  tab: "#FCFBF8",
  shadow: "#19211D"
};

const dark = {
  mode: "dark" as const,
  background: "#111713",
  surface: "#18201B",
  raised: "#202A24",
  text: "#F3F1EA",
  muted: "#A8B0AA",
  faint: "#717A74",
  border: "#303B34",
  accent: "#F07750",
  accentPressed: "#FF8A62",
  accentSoft: "#46291F",
  moss: "#72C796",
  mossSoft: "#1D3A2A",
  gold: "#E1B45F",
  goldSoft: "#3D321C",
  danger: "#EE7770",
  tab: "#18201B",
  shadow: "#000000"
};

export type AppTheme = typeof light | typeof dark;
export type ThemePreference = "system" | "light" | "dark";

export function useAppTheme(preference: ThemePreference = "system"): AppTheme {
  const systemTheme = useColorScheme();
  const resolvedTheme = preference === "system" ? systemTheme : preference;
  return resolvedTheme === "dark" ? dark : light;
}
