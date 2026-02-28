export default {
  expo: {
    name: 'Loot Goose',
    slug: 'loot-goose',
    version: '1.0.0',
    scheme: 'lootgoose',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    newArchEnabled: true,
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: 'https://u.expo.dev/cfff5d3d-1899-423d-88fa-e43ebd9c3c5a',
    },
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'cover',
      backgroundColor: '#0D1117',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.lootgoose.app',
      infoPlist: {
        NSCameraUsageDescription: 'Loot Goose needs camera access to capture scavenger hunt items.',
        NSLocationWhenInUseUsageDescription: 'Loot Goose uses your location to verify you\'re at the right spot.',
        NSPhotoLibraryUsageDescription: 'Loot Goose needs photo library access to save hunt captures.',
      },
    },
    android: {
      package: 'com.lootgoose.app',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon-foreground.png',
        backgroundColor: '#0D1117',
      },
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
        },
      },
      permissions: [
        'CAMERA',
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE',
        'android.permission.CAMERA',
        'android.permission.RECORD_AUDIO',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
      ],
      edgeToEdgeEnabled: true,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-updates',
      'expo-secure-store',
      [
        'expo-camera',
        { cameraPermission: 'Loot Goose needs camera access to capture scavenger hunt items.' },
      ],
      [
        'expo-location',
        { locationWhenInUsePermission: 'Loot Goose uses your location to verify you\'re at the right spot.' },
      ],
      [
        'expo-media-library',
        {
          photosPermission: 'Loot Goose needs photo library access to save hunt recap cards.',
          savePhotosPermission: 'Loot Goose needs permission to save photos to your library.',
          isAccessMediaLocationEnabled: true,
        },
      ],
    ],
    extra: {
      router: {},
      eas: {
        projectId: 'cfff5d3d-1899-423d-88fa-e43ebd9c3c5a',
      },
    },
  },
};
