import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import {
  Body, Button, Callout, Card, Divider, gutter, IconBadge, Label, Screen, ScreenHeader,
} from '@/components/ui';
import { hasBackend } from '@/lib/supabase';
import { useApp, useTheme } from '@/state/AppProvider';
import { font, radius, space } from '@/theme';

/**
 * Sign-in.
 *
 * U-02: registration is deferred until the user attempts something that
 * genuinely requires it, so this screen is only ever reached from such an
 * attempt, never from a splash screen.
 *
 * With a backend configured, this is real Supabase Auth — a one-time code
 * emailed to you, no password field, ever, or Google sign-in as a second
 * real path onto the same account model. There is no separate sign-up
 * screen for either: the first successful code verification or Google
 * sign-in for a given identity *is* the account creation, same as it always
 * was for email. Without a backend, there is nowhere to send a code and no
 * OAuth provider to call, so sign-in falls back to a local,
 * unpersisted-past-this-device identity, exactly as this screen always
 * worked before real auth existed — the Google button is hidden entirely
 * rather than shown broken. Either way, phone and age verification (the
 * second step) stays self-attested — there is no real SMS provider wired up
 * here.
 */
export default function AuthScreen() {
  const theme = useTheme();
  const router = useRouter();
  const {
    signIn, sendSignInCode, verifySignInCode, signInWithGoogle, verifyAge, session,
  } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'identify' | 'code' | 'verify'>('identify');

  const continueWithGoogle = async () => {
    setGoogleBusy(true);
    setError(null);
    const result = await signInWithGoogle();
    setGoogleBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStep('verify');
  };

  const submitIdentify = async () => {
    if (!hasBackend) {
      signIn(name.trim());
      setStep('verify');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await sendSignInCode(email.trim(), name.trim());
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStep('code');
  };

  const resendCode = async () => {
    setBusy(true);
    setError(null);
    const result = await sendSignInCode(email.trim(), name.trim());
    setBusy(false);
    if (!result.ok) setError(result.error);
  };

  const submitCode = async () => {
    setBusy(true);
    setError(null);
    const result = await verifySignInCode(email.trim(), code.trim());
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStep('verify');
  };

  const title = step === 'identify' ? 'Sign in' : step === 'code' ? 'Enter the code' : 'Verify';
  const subtitle =
    step === 'identify' ? 'Only needed to contribute or book'
    : step === 'code' ? `Sent to ${email}`
    : 'Phone and age';

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader
        title={title}
        subtitle={subtitle}
        onBack={() => {
          if (step === 'code') {
            setStep('identify');
            setError(null);
          } else {
            router.back();
          }
        }}
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

            {hasBackend ? (
              <>
                <Label style={{ marginTop: space.md }}>Email</Label>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={theme.textFaint}
                  accessibilityLabel="Email"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
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
                  We'll email a one-time code — no password to set or remember.
                </Text>
              </>
            ) : null}

            {error ? (
              <Callout tone="danger" icon="alert-circle" title="Could not continue">
                <Body dim>{error}</Body>
              </Callout>
            ) : null}

            <Button
              label="Continue"
              full
              loading={busy}
              style={{ marginTop: space.lg }}
              disabled={!name.trim() || (hasBackend && !email.trim())}
              onPress={submitIdentify}
            />

            {hasBackend ? (
              <>
                <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg }]}>
                  <Divider style={{ flex: 1 }} />
                  <Text style={[font.small, { color: theme.textFaint }]}>or</Text>
                  <Divider style={{ flex: 1 }} />
                </View>
                <Button
                  label="Continue with Google"
                  variant="secondary"
                  icon="logo-google"
                  full
                  loading={googleBusy}
                  style={{ marginTop: space.md }}
                  onPress={continueWithGoogle}
                />
              </>
            ) : null}
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
            {hasBackend
              ? 'Prototype: a one-time emailed code is the entire account — no password is ever ' +
                'collected. Phone and age verification below remain self-attested; there is no real ' +
                'SMS provider wired up. Multi-factor authentication would be mandatory for business ' +
                'and internal roles.'
              : 'Prototype: no backend is configured, so this identity is local to this device only ' +
                'and nothing is created anywhere else. Phone and age verification below remain ' +
                'self-attested either way.'}
          </Text>
        </View>
      ) : step === 'code' ? (
        <View style={[gutter(), { gap: space.lg }]}>
          <Card>
            <View style={{ alignItems: 'center', gap: space.sm, marginBottom: space.lg }}>
              <IconBadge icon="mail" size={52} />
              <Text style={[font.title, { color: theme.text, textAlign: 'center' }]}>
                Check your email
              </Text>
              <Body dim style={{ textAlign: 'center' }}>
                Enter the 6-digit code sent to {email}.
              </Body>
            </View>

            <Label>Code</Label>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              placeholderTextColor={theme.textFaint}
              accessibilityLabel="One-time code"
              keyboardType="number-pad"
              maxLength={6}
              style={[
                font.body,
                {
                  color: theme.text,
                  backgroundColor: theme.cardMuted,
                  borderRadius: radius.md,
                  paddingHorizontal: space.md,
                  minHeight: 48,
                  marginTop: space.sm,
                  letterSpacing: 4,
                },
              ]}
            />

            {error ? (
              <Callout tone="danger" icon="alert-circle" title="Could not verify that code">
                <Body dim>{error}</Body>
              </Callout>
            ) : null}

            <Button
              label="Verify and continue"
              full
              loading={busy}
              style={{ marginTop: space.lg }}
              disabled={code.trim().length < 6}
              onPress={submitCode}
            />
            <Button label="Resend code" variant="ghost" full style={{ marginTop: space.sm }} onPress={resendCode} />
          </Card>
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
