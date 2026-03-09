import React, { useState, useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Colors from '@/constants/Colors';
import GooseSplash from '@/components/GooseSplash';
import { useAppStore } from '@/lib/store';

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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.card },
          headerTintColor: Colors.text,
          headerTitleStyle: { fontWeight: '700', color: Colors.text },
          contentStyle: { backgroundColor: Colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Loot Goose 🪿', headerLargeTitle: true }} />
        <Stack.Screen name="create" options={{ title: 'New Hunt', presentation: 'modal' }} />
        <Stack.Screen name="hunt/[id]" options={{ title: 'Hunt' }} />
        <Stack.Screen name="hunt/complete" options={{ headerShown: false }} />
        <Stack.Screen name="library" options={{ title: 'Hunt Library 🗂' }} />
        <Stack.Screen
          name="camera"
          options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
