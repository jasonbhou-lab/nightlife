import React from 'react';
import { Text, View } from 'react-native';

import { Body, Button, Callout, Card, Label } from '@/components/ui';
import { useCatalogue } from '@/data/catalogue';
import { hasBackend } from '@/lib/supabase';
import { useTheme } from '@/state/AppProvider';
import { font, space } from '@/theme';

/**
 * Says which source the catalogue is coming from.
 *
 * The app falls back to bundled seed data whenever the backend is absent or
 * unreachable, which is deliberate — but a silent fallback would quietly show
 * stale venues as if they were live. U-05's principle applies to the data source
 * itself, not just to individual fields: if we cannot vouch for it, say so.
 */
export function BackendBanner({ compact = false }: { compact?: boolean }) {
  const theme = useTheme();
  const { source, error, loading, reload } = useCatalogue();

  if (source === 'remote' && !error) {
    if (compact) return null;
    return (
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.open }} />
          <Text style={[font.small, { color: theme.textDim, flex: 1 }]}>
            Live from Supabase
          </Text>
        </View>
      </Card>
    );
  }

  if (!hasBackend) {
    if (compact) return null;
    return (
      <Callout tone="info" icon="server-outline" title="Running on bundled sample data">
        <Body dim>
          No backend is configured, so the app is reading the seeded Houston database that ships
          with it. Add the Supabase URL and publishable key to .env and restart the bundler to
          switch over.
        </Body>
      </Callout>
    );
  }

  return (
    <Callout tone="warn" icon="cloud-offline" title="Showing sample data, not the database">
      <Body dim>
        {error ?? 'The backend could not be reached.'}
      </Body>
      <View style={{ marginTop: space.sm }}>
        <Label>What you are looking at</Label>
        <Body dim style={{ marginTop: 2 }}>
          The bundled seed, so browsing still works. Anything you write will stay on this device
          until the connection is back.
        </Body>
      </View>
      <Button
        label={loading ? 'Retrying…' : 'Try again'}
        variant="secondary"
        loading={loading}
        style={{ marginTop: space.md }}
        onPress={reload}
      />
    </Callout>
  );
}
