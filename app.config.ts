import type { ExpoConfig, ConfigContext } from "expo/config";

/** Fields present at runtime in Expo 57 but not yet on ExpoConfig typings. */
type AndroidConfig = NonNullable<ExpoConfig["android"]> & {
  predictiveBackGestureEnabled?: boolean;
};

type AppConfig = ExpoConfig & {
  newArchEnabled?: boolean;
  android?: AndroidConfig;
};

export default ({ config }: ConfigContext): AppConfig => {
  const android: AndroidConfig = {
    package: "jp.opentopo.companion",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#000000"
    },
    predictiveBackGestureEnabled: true
  };

  return {
    ...config,
    name: "Tick Mark",
    slug: "opentopo-companion",
    version: "0.1.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    scheme: "opentopo",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "jp.opentopo.companion"
    },
    android,
    plugins: [
      "expo-sqlite",
      "react-native-maps",
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Tick Mark uses your location to show nearby climbing areas and boulders on the map.",
          locationAlwaysAndWhenInUsePermission: false,
          locationAlwaysPermission: false,
          motionUsagePermission: false
        }
      ],
      [
        "expo-media-library",
        {
          photosPermission: false,
          savePhotosPermission:
            "Tick Mark saves your recap story slides to Photos so you can share them to Instagram Stories.",
          isAccessMediaLocationEnabled: false,
          granularPermissions: ["photo"]
        }
      ]
    ]
  };
};
