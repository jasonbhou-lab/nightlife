import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CatalogueProvider } from '@/data/catalogue';
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
        <Stack.Screen name="venue/edit" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="venue/offers" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="venue/bookings" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="venue/messages" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="venue/photos" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="reviews/[id]" />
        <Stack.Screen name="menu/[id]" />
        <Stack.Screen name="menu/edit" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="hours/[id]" />
        <Stack.Screen name="hours/edit" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="book/[id]" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="review/new" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="events/index" />
        <Stack.Screen name="collection/[id]" />
        <Stack.Screen name="messages/index" />
        <Stack.Screen name="messages/[id]" />
        <Stack.Screen name="community/index" />
        <Stack.Screen name="community/[id]" />
        <Stack.Screen name="photo/new" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="claim/new" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="claim/invite" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="moderation/index" />
        <Stack.Screen name="auth" options={{ animation: 'fade_from_bottom', presentation: 'modal' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        {/* Catalogue sits inside AppProvider because it reads the theme for its
            loading state, and outside the router so a source switch does not
            remount the navigation tree. */}
        <CatalogueProvider>
          <Shell />
        </CatalogueProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}
