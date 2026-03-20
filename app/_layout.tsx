import React, { useState, useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Colors from '@/constants/Colors';
import GooseSplash from '@/components/GooseSplash';
import { ToastProvider } from '@/components/Toast';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/lib/useTheme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const loadHunts = useAppStore((s) => s.loadHunts);

  useEffect(() => {
    const prepare = async () => {
      try {
        await loadHunts();
        await SplashScreen.hideAsync();
      } finally {
        setAppReady(true);
      }
    };
    prepare();
  }, []);

  if (!appReady || !splashDone) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" />
        {appReady && (
          <GooseSplash onFinished={() => setSplashDone(true)} />
        )}
      </GestureHandlerRootView>
    );
  }

  const C = useTheme();
  const isDark = C.bg === Colors.bg;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ToastProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: C.card },
            headerTintColor: C.text,
            headerTitleStyle: { fontWeight: '700', color: C.text },
            contentStyle: { backgroundColor: C.bg },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Loot Goose 🪿', headerLargeTitle: true }} />
          <Stack.Screen name="create" options={{ title: 'New Hunt', presentation: 'modal' }} />
          <Stack.Screen name="hunt/[id]" options={{ title: 'Hunt' }} />
          <Stack.Screen name="hunt/complete" options={{ headerShown: false }} />
          <Stack.Screen name="profile" options={{ title: 'My Stats' }} />
          <Stack.Screen name="library" options={{ title: 'Hunt Library 🗂' }} />
          <Stack.Screen
            name="camera"
            options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
          />
        </Stack>
      </ToastProvider>
    </GestureHandlerRootView>
  );
}
