import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View
} from "react-native";
import ViewShot, { type ViewShotRef } from "react-native-view-shot";

import type { RecapSummary } from "../domain/types";
import type { AppTheme } from "../theme/theme";
import { RECAP_SLIDE_IDS, STORY_HEIGHT, STORY_WIDTH, type RecapSlideId } from "./recapStats";
import { RecapSlide } from "./slides/RecapSlides";

export type RecapStoryPagerHandle = {
  getSlideRef: (index: number) => ViewShotRef | null;
  slideCount: number;
  currentIndex: number;
};

export const RecapStoryPager = forwardRef<
  RecapStoryPagerHandle,
  {
    stats: RecapSummary;
    theme: AppTheme;
    period: string;
    formatGrade: (grade: string) => string;
    gradeBars: Array<{ label: string; value: number }>;
    t: (key: string, params?: Record<string, string | number>) => string;
    onIndexChange?: (index: number) => void;
  }
>(function RecapStoryPager(
  { stats, theme, period, formatGrade, gradeBars, t, onIndexChange },
  ref
) {
  const slideRefs = useRef<Array<ViewShotRef | null>>([]);
  const [index, setIndex] = useState(0);
  const previewWidth = Math.min(Dimensions.get("window").width - 48, 360);
  const scale = previewWidth / STORY_WIDTH;
  const previewHeight = STORY_HEIGHT * scale;

  useImperativeHandle(
    ref,
    () => ({
      getSlideRef: (slideIndex: number) => slideRefs.current[slideIndex] ?? null,
      slideCount: RECAP_SLIDE_IDS.length,
      currentIndex: index
    }),
    [index]
  );

  const slides = useMemo(() => RECAP_SLIDE_IDS, []);

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / previewWidth);
    const clamped = Math.max(0, Math.min(slides.length - 1, next));
    setIndex(clamped);
    onIndexChange?.(clamped);
  }

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        pagingEnabled
        nestedScrollEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={previewWidth}
        snapToAlignment="start"
        disableIntervalMomentum
        onMomentumScrollEnd={handleScrollEnd}
        style={{ width: previewWidth }}
        contentContainerStyle={{ width: previewWidth * slides.length }}
      >
        {slides.map((id: RecapSlideId, slideIndex) => (
          <View
            key={id}
            style={{
              width: previewWidth,
              height: previewHeight,
              overflow: "hidden"
            }}
          >
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
                  slideRefs.current[slideIndex] = node;
                }}
                style={{ width: STORY_WIDTH, height: STORY_HEIGHT }}
              >
                <View collapsable={false} style={{ width: STORY_WIDTH, height: STORY_HEIGHT }}>
                  <RecapSlide
                    id={id}
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
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {slides.map((id, slideIndex) => (
          <View
            key={id}
            style={[
              styles.dot,
              {
                backgroundColor: slideIndex === index ? theme.accent : theme.border
              }
            ]}
          />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: 16
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center"
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4
  }
});
