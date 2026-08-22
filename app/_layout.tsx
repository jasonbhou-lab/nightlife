import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AgeGate } from '@/components/AgeGate';
import { AppProvider, useApp } from '@/state/AppProvider';

function Shell() {
  const { ready, theme } = useApp();

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.ground[0], alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.ground[0] },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="venue/[id]" />
        <Stack.Screen name="reviews/[id]" />
        <Stack.Screen name="menu/[id]" />
        <Stack.Screen name="hours/[id]" />
        <Stack.Screen name="book/[id]" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="review/new" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="events/index" />
        <Stack.Screen name="collection/[id]" />
        <Stack.Screen name="auth" options={{ animation: 'fade_from_bottom', presentation: 'modal' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      </Stack>
      {/* U-12: one age check per session, not a repeated interruption. */}
      <AgeGate />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Shell />
      </AppProvider>
    </SafeAreaProvider>
  );
}
