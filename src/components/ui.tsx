import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/state/AppProvider';
import { font, HIT, radius, space, type Theme } from '@/theme';

/**
 * Design-system primitives.
 *
 * Each of these maps to an element in the source prototype: the blue gradient
 * ground, the gradient hero card, the four-up white quick-action tiles, the
 * dark navy inset pill inside a white card, the bold section header with a
 * small white pill button at the right, and the white list row with a circular
 * icon badge on the left and a value pushed to the right edge.
 */

/* ------------------------------------------------------------------ screen */

export function Screen({
  children,
  scroll = true,
  contentStyle,
  edges = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pad = {
    paddingTop: edges ? insets.top + space.sm : 0,
    paddingBottom: space.xxxl + insets.bottom,
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.ground[0] }}>
      <LinearGradient
        colors={[...theme.ground]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      {scroll ? (
        <ScrollView
          contentContainerStyle={[pad, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad, contentStyle]}>{children}</View>
      )}
    </View>
  );
}

/** Screen title block sitting directly on the gradient ground. */
export function ScreenHeader({
  title,
  subtitle,
  right,
  onBack,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { paddingHorizontal: space.lg, marginBottom: space.lg, alignItems: 'flex-start' }]}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          style={[styles.glassCircle, { marginRight: space.md }]}
        >
          <Ionicons name="chevron-back" size={22} color={theme.onGround} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[font.display, { color: theme.onGround }]} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text style={[font.meta, { color: theme.onGroundDim, marginTop: 2 }]}>{subtitle}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/** Circular translucent button on the blue ground, as in the prototype's top bar. */
export function GlassButton({
  icon,
  onPress,
  label,
  badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  label: string;
  badge?: number;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={styles.glassCircle}
    >
      <Ionicons name={icon} size={20} color={theme.onGround} />
      {badge ? (
        <View style={[styles.badgeDot, { backgroundColor: theme.card }]}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: theme.text }}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/* -------------------------------------------------------------------- card */

export function Card({
  children,
  style,
  onPress,
  padded = true,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const base: StyleProp<ViewStyle> = [
    {
      backgroundColor: theme.card,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.cardBorder,
      padding: padded ? space.lg : 0,
    },
    theme.shadow,
    style,
  ];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] }]}
    >
      {children}
    </Pressable>
  );
}

/** The gradient feature card. */
export function HeroCard({
  icon,
  title,
  subtitle,
  value,
  valueCaption,
  onPress,
  footer,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value?: string;
  valueCaption?: string;
  onPress?: () => void;
  footer?: React.ReactNode;
}) {
  const theme = useTheme();
  const inner = (
    <LinearGradient
      colors={[...theme.hero]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ borderRadius: radius.lg, padding: space.lg }, theme.shadow]}
    >
      <View style={styles.row}>
        <View style={styles.heroBadge}>
          <Ionicons name={icon} size={22} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1, marginLeft: space.md }}>
          <Text style={[font.title, { color: '#FFFFFF' }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[font.meta, { color: 'rgba(255,255,255,0.78)', marginTop: 1 }]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {value ? (
          <View style={{ alignItems: 'flex-end', marginLeft: space.sm }}>
            <Text style={[font.title, { color: '#FFFFFF' }]}>{value}</Text>
            {valueCaption ? (
              <Text style={[font.small, { color: 'rgba(255,255,255,0.7)' }]}>{valueCaption}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
      {footer}
    </LinearGradient>
  );
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
      {inner}
    </Pressable>
  );
}

/** Four-up row of white tiles with an icon over a label. */
export function QuickActions({
  items,
}: {
  items: { key: string; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }[];
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { gap: space.sm }]}>
      {items.map((it) => (
        <Pressable
          key={it.key}
          onPress={it.onPress}
          accessibilityRole="button"
          accessibilityLabel={it.label}
          style={({ pressed }) => [
            {
              flex: 1,
              minHeight: 78,
              backgroundColor: theme.card,
              borderRadius: radius.md,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.cardBorder,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: space.md,
              gap: 6,
            },
            theme.shadow,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name={it.icon} size={22} color={theme.accent} />
          <Text style={[font.small, { color: theme.text }]} numberOfLines={1}>
            {it.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Circular accent badge, filled or soft. */
export function IconBadge({
  icon,
  size = 44,
  variant = 'soft',
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  size?: number;
  variant?: 'solid' | 'soft' | 'outline';
  color?: string;
}) {
  const theme = useTheme();
  const bg =
    variant === 'solid' ? color ?? theme.accent : variant === 'soft' ? theme.accentSoft : 'transparent';
  const fg = variant === 'solid' ? theme.accentText : color ?? theme.accentSoftText;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        borderWidth: variant === 'outline' ? 1.5 : 0,
        borderColor: fg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={size * 0.46} color={fg} />
    </View>
  );
}

/** The dark navy inset pill that holds the number that matters. */
export function InsetPill({
  value,
  caption,
  style,
  tone,
}: {
  value: string;
  caption?: string;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'warn' | 'good';
}) {
  const theme = useTheme();
  const valueColor =
    tone === 'warn' ? theme.warn : tone === 'good' ? theme.open : theme.insetText;
  return (
    <View
      style={[
        { backgroundColor: theme.inset, borderRadius: radius.md, padding: space.md, minHeight: 62, justifyContent: 'center' },
        style,
      ]}
    >
      <Text style={[font.cardTitle, { color: valueColor }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {caption ? (
        <Text style={[font.small, { color: theme.insetDim, marginTop: 2 }]} numberOfLines={2}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

/** White card with a badge, a title, and an inset pill underneath. */
export function StatCard({
  icon,
  title,
  value,
  caption,
  tone,
  onPress,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value: string;
  caption?: string;
  tone?: 'default' | 'warn' | 'good';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <Card style={[{ flex: 1 }, style]} onPress={onPress} accessibilityLabel={`${title}. ${value}. ${caption ?? ''}`}>
      <View style={[styles.row, { marginBottom: space.md }]}>
        <IconBadge icon={icon} size={34} />
        <Text style={[font.cardTitle, { color: theme.text, marginLeft: space.sm, flex: 1 }]} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <InsetPill value={value} caption={caption} tone={tone} />
    </Card>
  );
}

/** Bold section header on the ground, with an optional small white pill button. */
export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { marginBottom: space.md, alignItems: 'flex-end' }]}>
      <View style={{ flex: 1 }}>
        <Text style={[font.section, { color: theme.onGround }]} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text style={[font.meta, { color: theme.onGroundDim, marginTop: 2 }]}>{subtitle}</Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={8}
          style={({ pressed }) => [
            {
              backgroundColor: theme.card,
              borderRadius: radius.sm,
              paddingHorizontal: space.md,
              paddingVertical: space.sm,
              minHeight: 34,
              justifyContent: 'center',
            },
            theme.shadow,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={[font.small, { color: theme.text }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ----------------------------------------------------------------- buttons */

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  style,
  full,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'onGround';
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  full?: boolean;
}) {
  const theme = useTheme();
  const palettes: Record<string, { bg: string; fg: string; border?: string }> = {
    primary: { bg: theme.accent, fg: theme.accentText },
    secondary: { bg: theme.accentSoft, fg: theme.accentSoftText },
    ghost: { bg: 'transparent', fg: theme.text, border: theme.cardBorder },
    danger: { bg: theme.closedSoft, fg: theme.closed },
    onGround: { bg: theme.card, fg: theme.text },
  };
  const p = palettes[variant];
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        {
          minHeight: HIT,
          paddingHorizontal: space.lg,
          borderRadius: radius.md,
          backgroundColor: p.bg,
          borderWidth: p.border ? StyleSheet.hairlineWidth : 0,
          borderColor: p.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
          opacity: disabled ? 0.45 : 1,
          alignSelf: full ? 'stretch' : 'flex-start',
        },
        pressed && { opacity: 0.82 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={p.fg} /> : null}
      {icon && !loading ? <Ionicons name={icon} size={18} color={p.fg} /> : null}
      <Text style={[font.bodyStrong, { color: p.fg }]}>{label}</Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------- chips */

export function Chip({
  label,
  selected,
  onPress,
  onRemove,
  icon,
  tone = 'card',
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'card' | 'ground';
}) {
  const theme = useTheme();
  const bg = selected
    ? theme.accent
    : tone === 'ground'
      ? 'rgba(255,255,255,0.16)'
      : theme.cardMuted;
  const fg = selected ? theme.accentText : tone === 'ground' ? theme.onGround : theme.text;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          minHeight: 34,
          paddingHorizontal: space.md,
          borderRadius: radius.pill,
          backgroundColor: bg,
        },
        pressed && onPress && { opacity: 0.8 },
      ]}
    >
      {icon ? <Ionicons name={icon} size={14} color={fg} /> : null}
      <Text style={[font.small, { color: fg }]}>{label}</Text>
      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={10} accessibilityLabel={`Remove ${label}`} accessibilityRole="button">
          <Ionicons name="close" size={14} color={fg} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

/** Paid-placement label. Must stay visible at every breakpoint (F-SEARCH-09, U-11). */
export function AdLabel() {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.14)' : '#0B1220',
      }}
      accessibilityLabel="Paid placement, this venue paid for this position"
    >
      <Ionicons name="megaphone" size={11} color="#FFFFFF" />
      <Text style={[font.micro, { color: '#FFFFFF' }]}>PAID PLACEMENT</Text>
    </View>
  );
}

/* -------------------------------------------------------------- misc bits */

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: theme.cardBorder }, style]} />;
}

export function Label({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const theme = useTheme();
  return <Text style={[font.micro, { color: theme.textDim, textTransform: 'uppercase' }, style]}>{children}</Text>;
}

export function Body({
  children,
  dim,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  dim?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const theme = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[font.body, { color: dim ? theme.textDim : theme.text, lineHeight: 21 }, style]}
    >
      {children}
    </Text>
  );
}

/**
 * U-04: empty and error states name a specific next step instead of restating
 * the failure, so a call to action is required, not optional.
 */
export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  const theme = useTheme();
  return (
    <Card>
      <View style={{ alignItems: 'center', gap: space.md }}>
        <IconBadge icon={icon} size={52} />
        <Text style={[font.cardTitle, { color: theme.text, textAlign: 'center' }]}>{title}</Text>
        <Body dim style={{ textAlign: 'center' }}>
          {body}
        </Body>
        <Button label={actionLabel} onPress={onAction} />
      </View>
    </Card>
  );
}

/** A row of a label and a value, used all over the profile. */
export function KeyValue({
  label,
  value,
  note,
  caveat,
  stale,
}: {
  label: string;
  value: string;
  note?: string | null;
  caveat?: string;
  stale?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={{ paddingVertical: space.sm }}>
      <View style={[styles.row, { alignItems: 'flex-start' }]}>
        <Text style={[font.body, { color: theme.textDim, flex: 1, paddingRight: space.md }]}>{label}</Text>
        <View style={{ flexShrink: 0, maxWidth: '52%', alignItems: 'flex-end' }}>
          <Text style={[font.bodyStrong, { color: stale ? theme.warn : theme.text, textAlign: 'right' }]}>
            {value}
          </Text>
        </View>
      </View>
      {note ? (
        <Text style={[font.small, { color: stale ? theme.warn : theme.textFaint, marginTop: 2 }]}>
          {stale ? '⚠ ' : ''}
          {note}
        </Text>
      ) : null}
      {caveat ? (
        <Text style={[font.small, { color: theme.textFaint, marginTop: 4, fontStyle: 'italic' }]}>{caveat}</Text>
      ) : null}
    </View>
  );
}

/** Callout used for consumer alerts, closure notices, and compliance caveats. */
export function Callout({
  tone,
  icon,
  title,
  children,
}: {
  tone: 'warn' | 'danger' | 'info';
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  const map = {
    warn: { bg: theme.warnSoft, fg: theme.warn },
    danger: { bg: theme.closedSoft, fg: theme.closed },
    info: { bg: theme.accentSoft, fg: theme.accentSoftText },
  } as const;
  const c = map[tone];
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: radius.md, padding: space.md, gap: 4 }}>
      <View style={[styles.row, { gap: 6 }]}>
        <Ionicons name={icon} size={16} color={c.fg} />
        <Text style={[font.small, { color: c.fg, flex: 1 }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  glassCircle: {
    width: HIT,
    height: HIT,
    borderRadius: HIT / 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});

export function gutter(): ViewStyle {
  return { paddingHorizontal: space.lg };
}

export function useT(): Theme {
  return useTheme();
}
