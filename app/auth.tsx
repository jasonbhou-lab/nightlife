import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import {
  Body, Button, Callout, Card, Divider, gutter, IconBadge, Label, Screen, ScreenHeader,
} from '@/components/ui';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';

/**
 * Sign-in.
 *
 * U-02: registration is deferred until the user attempts something that
 * genuinely requires it, so this screen is only ever reached from such an
 * attempt, never from a splash screen.
 *
 * There is no real authentication here and deliberately no password field. A
 * prototype that collects credentials teaches people to hand them over.
 */
export default function AuthScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { signIn, verifyAge, session } = useApp();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'identify' | 'verify'>('identify');

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader
        title={step === 'identify' ? 'Sign in' : 'Verify'}
        subtitle={step === 'identify' ? 'Only needed to contribute or book' : 'Phone and age'}
        onBack={() => router.back()}
      />

      {step === 'identify' ? (
        <View style={[gutter(), { gap: space.lg }]}>
          <Card>
            <View style={{ alignItems: 'center', gap: space.sm, marginBottom: space.lg }}>
              <IconBadge icon="person-add" size={52} />
              <Text style={[font.title, { color: theme.text, textAlign: 'center' }]}>
                What should we call you
              </Text>
              <Body dim style={{ textAlign: 'center' }}>
                This name appears on your reviews. Your profile visibility is yours to set: public,
                followers only, or private.
              </Body>
            </View>

            <Label>Display name</Label>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Jordan M."
              placeholderTextColor={theme.textFaint}
              accessibilityLabel="Display name"
              autoCapitalize="words"
              style={[
                font.body,
                {
                  color: theme.text,
                  backgroundColor: theme.cardMuted,
                  borderRadius: radius.md,
                  paddingHorizontal: space.md,
                  minHeight: 48,
                  marginTop: space.sm,
                },
              ]}
            />

            <Button
              label="Continue"
              full
              style={{ marginTop: space.lg }}
              disabled={!name.trim()}
              onPress={() => {
                signIn(name.trim());
                setStep('verify');
              }}
            />
          </Card>

          <Card>
            <Label>What you can already do without this</Label>
            <View style={{ marginTop: space.sm, gap: space.sm }}>
              {[
                'Search and filter every listing',
                'Read reviews, including the ones that are not recommended',
                'See hours, menus, tap lists, and attributes',
                'Get directions and call the venue',
              ].map((t) => (
                <Text key={t} style={[font.body, { color: theme.textDim }]}>
                  • {t}
                </Text>
              ))}
            </View>
            <Divider style={{ marginVertical: space.md }} />
            <Label>What needs an account</Label>
            <View style={{ marginTop: space.sm, gap: space.sm }}>
              {[
                'Writing reviews and uploading photos',
                'Booking, waitlists, and table service',
                'Messaging a venue',
                'Age-gated venue content',
              ].map((t) => (
                <Text key={t} style={[font.body, { color: theme.textDim }]}>
                  • {t}
                </Text>
              ))}
            </View>
          </Card>

          <Text style={[font.small, { color: theme.onGroundFaint, textAlign: 'center', lineHeight: 17 }]}>
            Prototype: no password is collected, no account is created, and nothing leaves this
            device. Multi-factor authentication would be available to consumers and mandatory for
            business and internal roles.
          </Text>
        </View>
      ) : (
        <View style={[gutter(), { gap: space.lg }]}>
          <Callout tone="info" icon="shield-checkmark" title="Why this step exists">
            <Body dim>
              All five verticals here serve alcohol or permit tobacco, so reviewing and booking
              require a confirmed phone number and age verification. What standard is actually
              required, and whether it should differ for browsing versus transacting, is an open legal
              question in the PRD rather than something a product team settles alone.
            </Body>
          </Callout>

          <Card>
            <Label>Phone number</Label>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="(713) 555-0100"
              placeholderTextColor={theme.textFaint}
              keyboardType="phone-pad"
              accessibilityLabel="Phone number"
              style={[
                font.body,
                {
                  color: theme.text,
                  backgroundColor: theme.cardMuted,
                  borderRadius: radius.md,
                  paddingHorizontal: space.md,
                  minHeight: 48,
                  marginTop: space.sm,
                },
              ]}
            />
            <Text style={[font.small, { color: theme.textFaint, marginTop: space.sm }]}>
              Used for verification and transactional messages only. Marketing consent is separate and
              off by default.
            </Text>

            <Button
              label="Verify and finish"
              full
              style={{ marginTop: space.lg }}
              disabled={phone.replace(/\D/g, '').length < 10}
              onPress={() => {
                verifyAge();
                router.back();
              }}
            />
          </Card>

          {session.role !== 'guest' ? (
            <Button
              label="Skip for now"
              variant="ghost"
              full
              onPress={() => router.back()}
            />
          ) : null}
        </View>
      )}
    </Screen>
  );
}
