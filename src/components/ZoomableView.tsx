import { type ElementRef, type ReactNode, useEffect, useMemo, useRef } from "react";
import { Animated, PanResponder, StyleSheet, View } from "react-native";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_MS = 280;
const DOUBLE_TAP_SCALE = 2.4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function touchDistance(touches: readonly { pageX: number; pageY: number }[]): number {
  if (touches.length < 2) return 0;
  const a = touches[0]!;
  const b = touches[1]!;
  return Math.hypot(b.pageX - a.pageX, b.pageY - a.pageY);
}

function touchMidpoint(touches: readonly { pageX: number; pageY: number }[]): { x: number; y: number } {
  const a = touches[0]!;
  const b = touches[1]!;
  return { x: (a.pageX + b.pageX) / 2, y: (a.pageY + b.pageY) / 2 };
}

function maxPan(size: number, scale: number): number {
  return Math.max(0, (size * (scale - 1)) / 2);
}

export function ZoomableView({
  width,
  height,
  resetKey,
  onScrollLockChange,
  children
}: {
  width: number;
  height: number;
  resetKey?: string | number;
  /** When true, parent ScrollViews should set scrollEnabled={false}. */
  onScrollLockChange?: (locked: boolean) => void;
  children: ReactNode;
}) {
  const frameRef = useRef<ElementRef<typeof View> | null>(null);
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const onScrollLockChangeRef = useRef(onScrollLockChange);
  onScrollLockChangeRef.current = onScrollLockChange;

  const state = useRef({
    scale: 1,
    x: 0,
    y: 0,
    pinchStartScale: 1,
    pinchStartDistance: 0,
    panStartX: 0,
    panStartY: 0,
    lastTapAt: 0,
    windowX: 0,
    windowY: 0,
    ignoreTapUntil: 0,
    gesturing: false,
    scrollLocked: false
  });

  const setScrollLocked = (locked: boolean) => {
    if (state.current.scrollLocked === locked) return;
    state.current.scrollLocked = locked;
    onScrollLockChangeRef.current?.(locked);
  };

  const applyTransform = (nextScale: number, nextX: number, nextY: number, animated = false) => {
    const clampedScale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    const maxX = maxPan(width, clampedScale);
    const maxY = maxPan(height, clampedScale);
    const clampedX = clamp(nextX, -maxX, maxX);
    const clampedY = clamp(nextY, -maxY, maxY);
    state.current.scale = clampedScale;
    state.current.x = clampedX;
    state.current.y = clampedY;
    if (clampedScale > 1.01 || state.current.gesturing) {
      setScrollLocked(true);
    } else {
      setScrollLocked(false);
    }
    if (animated) {
      Animated.parallel([
        Animated.spring(scale, { toValue: clampedScale, useNativeDriver: true, bounciness: 0, speed: 20 }),
        Animated.spring(translateX, { toValue: clampedX, useNativeDriver: true, bounciness: 0, speed: 20 }),
        Animated.spring(translateY, { toValue: clampedY, useNativeDriver: true, bounciness: 0, speed: 20 })
      ]).start();
      return;
    }
    scale.setValue(clampedScale);
    translateX.setValue(clampedX);
    translateY.setValue(clampedY);
  };

  const resetZoom = (animated = false) => {
    applyTransform(1, 0, 0, animated);
  };

  useEffect(() => {
    state.current.gesturing = false;
    resetZoom(false);
    setScrollLocked(false);
  }, [width, height, resetKey]);

  useEffect(() => {
    return () => {
      onScrollLockChangeRef.current?.(false);
    };
  }, []);

  const syncWindowOrigin = () => {
    frameRef.current?.measureInWindow((x, y) => {
      state.current.windowX = x;
      state.current.windowY = y;
    });
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Claim immediately when zoomed so the parent ScrollView never starts a scroll.
        onStartShouldSetPanResponder: (event) =>
          event.nativeEvent.touches.length >= 2 || state.current.scale > 1.01,
        onStartShouldSetPanResponderCapture: (event) =>
          event.nativeEvent.touches.length >= 2 || state.current.scale > 1.01,
        onMoveShouldSetPanResponder: (event, gesture) => {
          if (event.nativeEvent.touches.length >= 2) return true;
          if (state.current.scale > 1.01) {
            return Math.hypot(gesture.dx, gesture.dy) > 3;
          }
          return false;
        },
        onMoveShouldSetPanResponderCapture: (event, gesture) => {
          if (event.nativeEvent.touches.length >= 2) return true;
          if (state.current.scale > 1.01) {
            return Math.hypot(gesture.dx, gesture.dy) > 3;
          }
          return false;
        },
        onPanResponderTerminationRequest: () => state.current.scale <= 1.01,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (event) => {
          syncWindowOrigin();
          state.current.lastTapAt = 0;
          state.current.gesturing = true;
          const touches = event.nativeEvent.touches;
          if (touches.length >= 2 || state.current.scale > 1.01) {
            setScrollLocked(true);
          }
          state.current.panStartX = state.current.x;
          state.current.panStartY = state.current.y;
          state.current.pinchStartScale = state.current.scale;
          if (touches.length >= 2) {
            state.current.pinchStartDistance = touchDistance(touches);
          }
        },
        onPanResponderMove: (event, gesture) => {
          const touches = event.nativeEvent.touches;
          if (touches.length >= 2) {
            setScrollLocked(true);
            const distance = touchDistance(touches);
            if (state.current.pinchStartDistance <= 0) {
              state.current.pinchStartDistance = distance;
              state.current.pinchStartScale = state.current.scale;
              state.current.panStartX = state.current.x;
              state.current.panStartY = state.current.y;
              return;
            }
            if (distance <= 0) return;
            const nextScale = state.current.pinchStartScale * (distance / state.current.pinchStartDistance);
            const midpoint = touchMidpoint(touches);
            const focalX = midpoint.x - state.current.windowX - width / 2;
            const focalY = midpoint.y - state.current.windowY - height / 2;
            const scaleRatio = nextScale / state.current.pinchStartScale;
            const nextX = focalX - (focalX - state.current.panStartX) * scaleRatio;
            const nextY = focalY - (focalY - state.current.panStartY) * scaleRatio;
            applyTransform(nextScale, nextX, nextY);
            return;
          }
          if (state.current.scale > 1.01) {
            applyTransform(state.current.scale, state.current.panStartX + gesture.dx, state.current.panStartY + gesture.dy);
          }
        },
        onPanResponderRelease: () => {
          state.current.pinchStartDistance = 0;
          state.current.gesturing = false;
          state.current.ignoreTapUntil = Date.now() + 320;
          if (state.current.scale < 1.05) {
            resetZoom(true);
            setScrollLocked(false);
            return;
          }
          applyTransform(state.current.scale, state.current.x, state.current.y, true);
          setScrollLocked(true);
        },
        onPanResponderTerminate: () => {
          state.current.pinchStartDistance = 0;
          state.current.gesturing = false;
          state.current.ignoreTapUntil = Date.now() + 320;
          if (state.current.scale < 1.05) {
            resetZoom(true);
            setScrollLocked(false);
            return;
          }
          setScrollLocked(state.current.scale > 1.01);
        }
      }),
    [height, width]
  );

  function handleDoubleTap(pageX: number, pageY: number) {
    syncWindowOrigin();
    if (state.current.scale > 1.05) {
      resetZoom(true);
      setScrollLocked(false);
      return;
    }
    const focalX = pageX - state.current.windowX - width / 2;
    const focalY = pageY - state.current.windowY - height / 2;
    const nextScale = DOUBLE_TAP_SCALE;
    applyTransform(nextScale, -focalX * (nextScale - 1), -focalY * (nextScale - 1), true);
    setScrollLocked(true);
  }

  if (width <= 0 || height <= 0) {
    return <View style={styles.clip}>{children}</View>;
  }

  return (
    <View
      ref={frameRef}
      style={[styles.clip, { width, height }]}
      onLayout={syncWindowOrigin}
      onTouchEnd={(event) => {
        if (event.nativeEvent.touches.length > 0 || Date.now() < state.current.ignoreTapUntil) return;
        const now = Date.now();
        if (now - state.current.lastTapAt < DOUBLE_TAP_MS) {
          handleDoubleTap(event.nativeEvent.pageX, event.nativeEvent.pageY);
          state.current.lastTapAt = 0;
          return;
        }
        state.current.lastTapAt = now;
      }}
      {...responder.panHandlers}
    >
      <Animated.View
        style={{
          width,
          height,
          transform: [{ translateX }, { translateY }, { scale }]
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" }
});
