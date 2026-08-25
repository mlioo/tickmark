import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SQLiteProvider, useSQLiteContext } from "expo-sqlite";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import topoSeedJson from "./src/data/topo.seed.json";
import {
  getGradeSystemPreference,
  getLanguagePreference,
  getThemePreference,
  saveGradeSystemPreference,
  saveLanguagePreference,
  saveThemePreference
} from "./src/db/repository";
import { initializeDatabase } from "./src/db/schema";
import type { GradeSystem } from "./src/domain/grades";
import type { TopoSeed } from "./src/domain/types";
import { GradeSystemProvider } from "./src/grades/GradeSystemContext";
import { I18nProvider, useI18n, type LanguagePreference } from "./src/i18n";
import { LogScreen } from "./src/screens/LogScreen";
import { MoreScreen } from "./src/screens/MoreScreen";
import { ProgressScreen } from "./src/screens/ProgressScreen";
import { TopoScreen } from "./src/screens/TopoScreen";
import { type AppTheme, type ThemePreference, useAppTheme } from "./src/theme/theme";

type TabKey = "log" | "topo" | "progress" | "more";

const tabKeys: TabKey[] = ["log", "topo", "progress", "more"];

const requestedInitialTab = process.env.EXPO_PUBLIC_INITIAL_TAB as TabKey | undefined;
const initialTab = tabKeys.includes(requestedInitialTab as TabKey) ? requestedInitialTab! : "log";
const initialTopoArea = process.env.EXPO_PUBLIC_TOPO_AREA;
const initialTopoProblem = process.env.EXPO_PUBLIC_TOPO_PROBLEM;

const topoSeed = topoSeedJson as TopoSeed;

function TabIcon({ tab, color, knockout }: { tab: TabKey; color: string; knockout: string }) {
  if (tab === "log") {
    return (
      <View style={styles.iconBox}>
        <View style={[styles.notePage, { borderColor: color }]}>
          <View style={[styles.noteLine, { backgroundColor: color }]} />
          <View style={[styles.noteLine, styles.noteLineShort, { backgroundColor: color }]} />
          <View style={[styles.noteLine, styles.noteLineMid, { backgroundColor: color }]} />
        </View>
      </View>
    );
  }

  if (tab === "topo") {
    return (
      <View style={styles.iconBox}>
        <View style={styles.topoRoute}>
          {/* Background problem line — quieter, behind the pin */}
          <View style={styles.topoMap}>
            <View style={[styles.topoSeg, styles.topoSegA, { backgroundColor: color }]} />
            <View style={[styles.topoSeg, styles.topoSegB, { backgroundColor: color }]} />
            <View style={[styles.topoHold, styles.topoHoldA, { backgroundColor: color }]} />
            <View style={[styles.topoHold, styles.topoHoldB, { backgroundColor: color }]} />
            <View style={[styles.topoHold, styles.topoHoldC, { backgroundColor: color }]} />
          </View>
          {/* Foreground pin */}
          <View style={styles.topoPin}>
            <View style={[styles.topoPinTip, { borderTopColor: color }]} />
            <View style={[styles.topoPinHead, { backgroundColor: color }]}>
              <View style={[styles.topoPinHole, { backgroundColor: knockout }]} />
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (tab === "progress") {
    return (
      <View style={[styles.iconBox, styles.progressBars]}>
        <View style={[styles.progressBar, styles.progressBarA, { backgroundColor: color }]} />
        <View style={[styles.progressBar, styles.progressBarB, { backgroundColor: color }]} />
        <View style={[styles.progressBar, styles.progressBarC, { backgroundColor: color }]} />
      </View>
    );
  }

  return (
    <View style={[styles.iconBox, styles.moreDots]}>
      <View style={[styles.moreDot, { backgroundColor: color }]} />
      <View style={[styles.moreDot, { backgroundColor: color }]} />
      <View style={[styles.moreDot, { backgroundColor: color }]} />
    </View>
  );
}

function TabBar({ active, onChange, theme }: { active: TabKey; onChange: (tab: TabKey) => void; theme: AppTheme }) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const tabs = tabKeys.map((key) => ({ key, label: t(`tabs.${key}`) }));

  return (
    <View
      style={[
        styles.tabBar,
        {
          paddingBottom: Math.max(8, insets.bottom),
          backgroundColor: theme.tab,
          borderColor: theme.border,
          shadowColor: theme.shadow
        }
      ]}
    >
      {tabs.map((tab) => {
        const selected = active === tab.key;
        const color = selected ? theme.accent : theme.faint;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => [styles.tab, pressed && { opacity: 0.62 }]}
          >
            <TabIcon tab={tab.key} color={color} knockout={theme.tab} />
            <Text style={[styles.tabLabel, { color: selected ? theme.accent : theme.muted }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function CompanionApp() {
  const db = useSQLiteContext();
  const [languagePreference, setLanguagePreference] = useState<LanguagePreference>("system");

  useEffect(() => {
    let active = true;
    void getLanguagePreference(db).then((preference) => {
      if (active) setLanguagePreference(preference);
    });
    return () => {
      active = false;
    };
  }, [db]);

  function changeLanguagePreference(preference: LanguagePreference) {
    setLanguagePreference(preference);
    void saveLanguagePreference(db, preference);
  }

  return (
    <I18nProvider preference={languagePreference}>
      <CompanionAppContentWithSettings
        languagePreference={languagePreference}
        onLanguagePreferenceChange={changeLanguagePreference}
      />
    </I18nProvider>
  );
}

function CompanionAppContentWithSettings({
  languagePreference,
  onLanguagePreferenceChange
}: {
  languagePreference: LanguagePreference;
  onLanguagePreferenceChange: (preference: LanguagePreference) => void;
}) {
  const db = useSQLiteContext();
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const [gradeSystemPreference, setGradeSystemPreference] = useState<GradeSystem>("dankyu");
  const theme = useAppTheme(themePreference);
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [revision, setRevision] = useState(0);
  const activeIndexRef = useRef(tabKeys.indexOf(initialTab));
  const tabSwipeEnabledRef = useRef(true);

  useEffect(() => {
    let active = true;
    void getThemePreference(db).then((preference) => {
      if (active) setThemePreference(preference);
    });
    void getGradeSystemPreference(db).then((preference) => {
      if (active) setGradeSystemPreference(preference);
    });
    return () => {
      active = false;
    };
  }, [db]);

  useEffect(() => {
    function followLink(url: string | null) {
      if (!url) return;
      const route = url.replace(/^opentopo:\/\//, "").split(/[/?#]/)[0] as TabKey | undefined;
      if (route && tabKeys.includes(route)) changeTab(route);
    }
    void Linking.getInitialURL().then(followLink);
    const subscription = Linking.addEventListener("url", (event) => followLink(event.url));
    return () => subscription.remove();
  }, []);

  function changeTab(tab: TabKey) {
    activeIndexRef.current = tabKeys.indexOf(tab);
    setActiveTab(tab);
  }

  const swipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          tabSwipeEnabledRef.current &&
          Math.abs(gesture.dx) > 42 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.45,
        onPanResponderRelease: (_, gesture) => {
          if (!tabSwipeEnabledRef.current) return;
          if (Math.abs(gesture.dx) < 70) return;
          const direction = gesture.dx < 0 ? 1 : -1;
          const nextIndex = Math.max(0, Math.min(tabKeys.length - 1, activeIndexRef.current + direction));
          const next = tabKeys[nextIndex];
          if (next) changeTab(next);
        }
      }),
    []
  );

  const sharedProps = { theme, revision, onMutate: () => setRevision((value) => value + 1) };

  function changeThemePreference(preference: ThemePreference) {
    setThemePreference(preference);
    void saveThemePreference(db, preference);
  }

  function changeGradeSystemPreference(preference: GradeSystem) {
    setGradeSystemPreference(preference);
    void saveGradeSystemPreference(db, preference);
  }

  return (
    <GradeSystemProvider preference={gradeSystemPreference}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={["top"]}>
        <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
        <View style={styles.body} {...swipeResponder.panHandlers}>
          <View style={[styles.screen, activeTab !== "log" && styles.hidden]} pointerEvents={activeTab === "log" ? "auto" : "none"}>
            <LogScreen {...sharedProps} />
          </View>
          <View style={[styles.screen, activeTab !== "topo" && styles.hidden]} pointerEvents={activeTab === "topo" ? "auto" : "none"}>
            <TopoScreen {...sharedProps} visible={activeTab === "topo"} initialAreaId={initialTopoArea} initialProblemId={initialTopoProblem} />
          </View>
          <View style={[styles.screen, activeTab !== "progress" && styles.hidden]} pointerEvents={activeTab === "progress" ? "auto" : "none"}>
            <ProgressScreen
              theme={theme}
              revision={revision}
              onRecapVisibilityChange={(open) => {
                tabSwipeEnabledRef.current = !open;
              }}
            />
          </View>
          <View style={[styles.screen, activeTab !== "more" && styles.hidden]} pointerEvents={activeTab === "more" ? "auto" : "none"}>
            <MoreScreen
              {...sharedProps}
              themePreference={themePreference}
              onThemePreferenceChange={changeThemePreference}
              languagePreference={languagePreference}
              onLanguagePreferenceChange={onLanguagePreferenceChange}
              gradeSystemPreference={gradeSystemPreference}
              onGradeSystemPreferenceChange={changeGradeSystemPreference}
            />
          </View>
        </View>
        <TabBar active={activeTab} onChange={changeTab} theme={theme} />
      </SafeAreaView>
    </GradeSystemProvider>
  );
}

function LoadingApp() {
  const theme = useAppTheme();
  return (
    <I18nProvider preference="system">
      <LoadingAppContent theme={theme} />
    </I18nProvider>
  );
}

function LoadingAppContent({ theme }: { theme: AppTheme }) {
  const { t } = useI18n();
  return (
    <View style={[styles.loading, { backgroundColor: theme.background }]}>
      <ActivityIndicator color={theme.accent} size="large" />
      <Text style={[styles.loadingText, { color: theme.muted }]}>{t("app.preparingTopo")}</Text>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Suspense fallback={<LoadingApp />}>
        <SQLiteProvider
          databaseName="opentopo-companion.db"
          onInit={(db) => initializeDatabase(db, topoSeed)}
          useSuspense
        >
          <CompanionApp />
        </SQLiteProvider>
      </Suspense>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  body: { flex: 1 },
  screen: { ...StyleSheet.absoluteFill },
  hidden: { opacity: 0 },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 7,
    paddingHorizontal: 6,
    shadowOpacity: 0.09,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16
  },
  tab: { flex: 1, minHeight: 51, alignItems: "center", justifyContent: "center" },
  tabLabel: { fontSize: 10, fontWeight: "700", marginTop: 4 },
  iconBox: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  notePage: {
    width: 15,
    height: 18,
    borderWidth: 1.6,
    borderRadius: 2.5,
    paddingHorizontal: 2.5,
    paddingTop: 3.5,
    gap: 2.5
  },
  noteLine: { height: 1.5, borderRadius: 1, width: "100%" },
  noteLineShort: { width: "62%" },
  noteLineMid: { width: "78%" },
  topoRoute: {
    width: 22,
    height: 22
  },
  topoMap: {
    ...StyleSheet.absoluteFill,
    opacity: 0.45
  },
  // Soft arc behind the pin: A(1,17) → B(11,11) → C(20,15)
  topoHold: { position: "absolute", width: 2.4, height: 2.4, borderRadius: 1.2 },
  topoHoldA: { left: 0.2, top: 15.8 },
  topoHoldB: { left: 9.8, top: 9.8 },
  topoHoldC: { left: 18.8, top: 13.8 },
  topoSeg: { position: "absolute", height: 1.6, borderRadius: 0.8 },
  topoSegA: {
    left: 1.4,
    top: 13.4,
    width: 10.6,
    transform: [{ rotate: "-32deg" }]
  },
  topoSegB: {
    left: 11.2,
    top: 12.2,
    width: 8.8,
    transform: [{ rotate: "24deg" }]
  },
  topoPin: {
    position: "absolute",
    top: -1,
    left: 4,
    width: 14,
    height: 18,
    zIndex: 3,
    alignItems: "center"
  },
  topoPinTip: {
    position: "absolute",
    top: 4.5,
    width: 0,
    height: 0,
    borderLeftWidth: 5.8,
    borderRightWidth: 5.8,
    borderTopWidth: 8.5,
    borderLeftColor: "transparent",
    borderRightColor: "transparent"
  },
  topoPinHead: {
    width: 12.5,
    height: 12.5,
    borderRadius: 6.25,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1
  },
  topoPinHole: {
    width: 5,
    height: 5,
    borderRadius: 2.5
  },
  progressBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 2.5,
    paddingBottom: 1
  },
  progressBar: { width: 3.5, borderRadius: 1.5 },
  progressBarA: { height: 8 },
  progressBarB: { height: 12.5 },
  progressBarC: { height: 17 },
  moreDots: { flexDirection: "row", gap: 3 },
  moreDot: { width: 3.5, height: 3.5, borderRadius: 2 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { fontSize: 13, fontWeight: "600", marginTop: 14 }
});
