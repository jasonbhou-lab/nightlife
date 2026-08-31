import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '@/state/AppProvider';
import { font, HIT } from '@/theme';

/**
 * PRD 5.1: five primary destinations on mobile — Home, Search, Tonight, Saved,
 * Profile. Tonight sits in the middle because it is the deliberate departure
 * from a general-purpose review app and the shortest path in Flow 1.
 */
export default function TabsLayout() {
  const { theme } = useApp();
  // A fixed per-platform guess (previously 28pt on iOS, 8dp on Android) only
  // ever matched one specific home-indicator/nav-bar height. Android's
  // varies by device and is 0 on none of them once edge-to-edge rendering is
  // in play (the OS default since Android 15), so a flat 8dp regularly sat
  // the tab bar's labels under the system nav bar instead of above it. The
  // real inset from SafeAreaProvider (mounted in app/_layout.tsx) is correct
  // on both platforms and needs no per-OS branch.
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textFaint,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.cardBorder,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 54 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarItemStyle: { minHeight: HIT },
        sceneStyle: { backgroundColor: theme.ground[0] },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size }) => <Ionicons name="search" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tonight"
        options={{
          title: 'Tonight',
          tabBarIcon: ({ color, size }) => <Ionicons name="moon" size={size} color={color} />,
          tabBarLabelStyle: { ...font.small, fontWeight: '700' },
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          tabBarIcon: ({ color, size }) => <Ionicons name="bookmark" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
