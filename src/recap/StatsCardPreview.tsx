import { forwardRef, useImperativeHandle, useRef } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import ViewShot, { type ViewShotRef } from "react-native-view-shot";

import type { RecapSummary } from "../domain/types";
import type { AppTheme } from "../theme/theme";
import { STORY_HEIGHT, STORY_WIDTH } from "./recapStats";
import { StatsCard } from "./StatsCard";

export type StatsCardPreviewHandle = {
  getCardRef: () => ViewShotRef | null;
};

export const StatsCardPreview = forwardRef<
  StatsCardPreviewHandle,
  {
    stats: RecapSummary;
    theme: AppTheme;
    period: string;
    formatGrade: (grade: string) => string;
    gradeBars: Array<{ label: string; value: number }>;
    t: (key: string, params?: Record<string, string | number>) => string;
  }
>(function StatsCardPreview({ stats, theme, period, formatGrade, gradeBars, t }, ref) {
  const shotRef = useRef<ViewShotRef | null>(null);
  const previewWidth = Math.min(Dimensions.get("window").width - 48, 360);
  const scale = previewWidth / STORY_WIDTH;
  const previewHeight = STORY_HEIGHT * scale;

  useImperativeHandle(
    ref,
    () => ({
      getCardRef: () => shotRef.current
    }),
    []
  );

  return (
    <View style={styles.wrap}>
      <View style={{ width: previewWidth, height: previewHeight, overflow: "hidden" }}>
        <View
          style={{
            width: STORY_WIDTH,
            height: STORY_HEIGHT,
            transform: [
              { translateX: -(STORY_WIDTH * (1 - scale)) / 2 },
              { translateY: -(STORY_HEIGHT * (1 - scale)) / 2 },
              { scale }
            ]
          }}
        >
          <ViewShot
            ref={(node) => {
              shotRef.current = node;
            }}
            style={{ width: STORY_WIDTH, height: STORY_HEIGHT }}
          >
            <View collapsable={false} style={{ width: STORY_WIDTH, height: STORY_HEIGHT }}>
              <StatsCard
                stats={stats}
                theme={theme}
                t={t}
                period={period}
                formatGrade={formatGrade}
                gradeBars={gradeBars}
              />
            </View>
          </ViewShot>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center"
  }
});
