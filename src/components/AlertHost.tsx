import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { registerAlertHost, type AlertButton, type AlertRequest } from '@/lib/alert';
import { useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';

/**
 * Web-only render target for `alert()` — see src/lib/alert.ts for why this
 * exists. Mounted once, near the root, in app/_layout.tsx. Off web, `alert()`
 * bypasses this entirely and calls the real native Alert.alert.
 */
export function AlertHost() {
  const theme = useTheme();
  const [req, setReq] = useState<AlertRequest | null>(null);

  useEffect(() => {
    registerAlertHost(setReq);
    return () => registerAlertHost(null);
  }, []);

  if (!req) return null;

  const close = (button: AlertButton) => {
    setReq(null);
    button.onPress?.();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setReq(null)}>
      <Pressable
        onPress={() => setReq(null)}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: space.xl,
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            width: '100%',
            maxWidth: 380,
            backgroundColor: theme.card,
            borderRadius: radius.lg,
            padding: space.lg,
          }}
        >
          <Text style={[font.cardTitle, { color: theme.text }]}>{req.title}</Text>
          {req.message ? (
            <Text style={[font.body, { color: theme.textDim, marginTop: space.sm }]}>{req.message}</Text>
          ) : null}
          <View style={{ marginTop: space.lg, gap: space.xs }}>
            {req.buttons.map((b, i) => (
              <Pressable
                key={i}
                onPress={() => close(b)}
                accessibilityRole="button"
                accessibilityLabel={b.text}
                style={({ pressed }) => [
                  {
                    minHeight: 44,
                    borderRadius: radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: b.style === 'cancel' ? 'transparent' : theme.cardMuted,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text
                  style={[
                    font.bodyStrong,
                    {
                      color:
                        b.style === 'destructive' ? theme.closed : b.style === 'cancel' ? theme.textDim : theme.accent,
                    },
                  ]}
                >
                  {b.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
