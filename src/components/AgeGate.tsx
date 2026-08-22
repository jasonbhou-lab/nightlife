import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Modal, Text, View } from 'react-native';

import { Body, Button, Card, IconBadge, Label } from '@/components/ui';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';

/**
 * Age gate (U-12 and PRD 9).
 *
 * Every one of the five verticals involves age-restricted activity, so the gate
 * is shown once per session and not again. Browsing is allowed after
 * self-attestation; reviewing, booking, and viewing age-gated venue content
 * require the verified role, which is a separate step.
 *
 * Deliberately *not* implemented here: any attempt to judge whether the
 * attestation is true, or to collect an ID or date of birth. What standard is
 * actually required — self-attestation for browsing versus verification for
 * transacting, and how that interacts with COPPA if minors reach the platform —
 * is PRD Open Question 3 and a question for counsel, not a product default.
 */
export function AgeGate() {
  const theme = useTheme();
  const { ageGateSeen, markAgeGateSeen, session, verifyAge } = useApp();

  if (ageGateSeen) return null;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={markAgeGateSeen}>
      <View style={{ flex: 1 }}>
        <LinearGradient colors={[...theme.ground]} style={{ flex: 1, justifyContent: 'center', padding: space.lg }}>
          <Card>
            <View style={{ alignItems: 'center', gap: space.md }}>
              <IconBadge icon="shield-checkmark" size={56} />
              <Text style={[font.title, { color: theme.text, textAlign: 'center' }]} accessibilityRole="header">
                Are you 21 or older?
              </Text>
              <Body dim style={{ textAlign: 'center' }}>
                Every venue on NightOut serves alcohol, permits tobacco use, or both. We ask once per
                session and will not ask again.
              </Body>
            </View>

            <View style={{ marginTop: space.lg, gap: space.sm }}>
              <Button
                label="Yes, I am 21 or older"
                full
                onPress={() => {
                  if (!session.ageVerified) verifyAge();
                  markAgeGateSeen();
                }}
              />
              <Button label="No, I am under 21" variant="ghost" full onPress={markAgeGateSeen} />
            </View>

            <View style={{ marginTop: space.lg, gap: 6 }}>
              <Label>What happens if you say no</Label>
              <Text style={[font.small, { color: theme.textDim, lineHeight: 17 }]}>
                You can still browse listings, read reviews, and get directions. You will not be able
                to write reviews, book, or see age-gated venue content until you verify.
              </Text>
              <Text style={[font.small, { color: theme.textFaint, lineHeight: 17, marginTop: 4 }]}>
                Entry ages vary by state and municipality and some venues here are 18+ with
                wristbanding. The venue&apos;s own door policy is the one that decides.
              </Text>
            </View>
          </Card>

          <View
            style={{
              marginTop: space.md,
              backgroundColor: 'rgba(255,255,255,0.12)',
              borderRadius: radius.md,
              padding: space.md,
              flexDirection: 'row',
              gap: space.sm,
            }}
          >
            <Ionicons name="information-circle" size={16} color={theme.onGroundDim} />
            <Text style={[font.small, { color: theme.onGroundDim, flex: 1, lineHeight: 16 }]}>
              Prototype build. Self-attestation only; no identity or age verification is performed,
              and the standard required for browsing versus transacting is an open legal question in
              the PRD.
            </Text>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}
