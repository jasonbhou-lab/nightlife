import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Body, Button, Callout, Screen, ScreenHeader, gutter } from '@/components/ui';
import { hasBackend } from '@/lib/supabase';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, space } from '@/theme';

/**
 * Where `nightout://auth/callback` actually lands — the redirect Supabase
 * sends the OS to once someone taps the magic-link email (see
 * `completeAuthFromUrl` in src/data/repository.ts). The token exchange
 * itself already happened by the time this screen mounts: AppProvider's
 * deep-link listener processes the URL app-wide, cold start or foreground,
 * whether or not this screen exists to see it. This screen only reflects
 * that outcome back — spinner while `session` hasn't updated yet, the error
 * AppProvider recorded if the link was expired or already used, or an
 * immediate bounce home once sign-in actually lands.
 */
export default function AuthCallbackScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session, authCallbackError } = useApp();

  const signedIn = session.role !== 'guest';

  useEffect(() => {
    if (signedIn) router.replace('/');
  }, [signedIn, router]);

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader title="Signing you in" onBack={() => router.replace('/auth')} />
      <View style={[gutter(), { gap: space.lg }]}>
        {!hasBackend ? (
          <Callout tone="danger" icon="alert-circle" title="No backend configured">
            <Body dim>This build has no Supabase backend, so there is no link to confirm.</Body>
          </Callout>
        ) : authCallbackError ? (
          <Callout tone="danger" icon="alert-circle" title="That link didn't work">
            <Body dim>{authCallbackError}</Body>
          </Callout>
        ) : (
          <View style={{ alignItems: 'center', gap: space.md, paddingTop: space.xl }}>
            <ActivityIndicator color={theme.text} />
            <Text style={[font.body, { color: theme.textDim }]}>Confirming your sign-in…</Text>
          </View>
        )}
        {!hasBackend || authCallbackError ? (
          <Button label="Back to sign in" full onPress={() => router.replace('/auth')} />
        ) : null}
      </View>
    </Screen>
  );
}
