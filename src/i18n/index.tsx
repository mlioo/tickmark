import { createContext, useContext, useMemo, type ReactNode } from "react";

import { en, type TranslationKey, type TranslationParams, type TranslationTree } from "./en";
import { ja } from "./ja";
import {
  type AppLocale,
  type LanguagePreference,
  localizedName,
  localeTag,
  resolveLocale,
  secondaryName
} from "./language";

const catalogs: Record<AppLocale, TranslationTree> = { en, ja };

function getNestedValue(tree: TranslationTree, key: string): string | undefined {
  const parts = key.split(".");
  let current: unknown = tree;
  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, token: string) => String(params[token] ?? ""));
}

function createTranslator(locale: AppLocale) {
  return (key: TranslationKey, params?: TranslationParams): string => {
    const value = getNestedValue(catalogs[locale], key) ?? getNestedValue(en, key) ?? key;
    return interpolate(value, params);
  };
}

interface I18nContextValue {
  locale: AppLocale;
  localeTag: string;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  localizedName: (ja: string, en: string) => string;
  secondaryName: (ja: string, en: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  preference,
  children
}: {
  preference: LanguagePreference;
  children: ReactNode;
}) {
  const locale = resolveLocale(preference);
  const value = useMemo<I18nContextValue>(() => {
    const tag = localeTag(locale);
    const t = createTranslator(locale);
    return {
      locale,
      localeTag: tag,
      t,
      localizedName: (nameJa, nameEn) => localizedName(nameJa, nameEn, locale, t("common.unnamed")),
      secondaryName: (nameJa, nameEn) => secondaryName(nameJa, nameEn, locale)
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used within I18nProvider");
  return context;
}

export { type AppLocale, type LanguagePreference, localizedPayloadValue } from "./language";
export type { TranslationKey } from "./en";

export function weekdayAbbreviations(tag: string): string[] {
  const formatter = new Intl.DateTimeFormat(tag, { weekday: "short" });
  return Array.from({ length: 7 }, (_, index) =>
    formatter.format(new Date(2024, 0, 7 + index)).replace(/\./g, "").toUpperCase()
  );
}

export function formatCountUnit(count: number, singularKey: TranslationKey, pluralKey: TranslationKey, t: I18nContextValue["t"]): string {
  return count === 1 ? t(singularKey) : t(pluralKey);
}
