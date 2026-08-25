import { getLocales } from "expo-localization";

export type LanguagePreference = "system" | "en" | "ja";
export type AppLocale = "en" | "ja";

export function resolveLocale(preference: LanguagePreference): AppLocale {
  if (preference === "en" || preference === "ja") return preference;
  const code = getLocales()[0]?.languageCode;
  return code === "ja" ? "ja" : "en";
}

export function localeTag(locale: AppLocale): string {
  return locale === "ja" ? "ja-JP" : "en";
}

export function localizedName(ja: string, en: string, locale: AppLocale, fallback = "Unnamed"): string {
  return locale === "ja" ? ja || en || fallback : en || ja || fallback;
}

export function secondaryName(ja: string, en: string, locale: AppLocale): string {
  const secondary = locale === "ja" ? en : ja;
  return secondary && secondary !== localizedName(ja, en, locale) ? secondary : "";
}

export function localizedPayloadValue(value: unknown, locale: AppLocale): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  return String(locale === "ja" ? (record.ja ?? record.en ?? "") : (record.en ?? record.ja ?? ""));
}
