// The component kit. Small on purpose. Every screen is built from these.

import { Image } from 'expo-image';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type RefreshControlProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow, spacing, type as typeScale } from '@/theme';

// --- layout -----------------------------------------------------------------

export function Screen({
  children,
  scroll = true,
  padded = true,
  style,
  contentStyle,
  dark = false,
  edges,
  refreshControl,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  dark?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  refreshControl?: React.ReactElement<RefreshControlProps>;
}) {
  const bg = dark ? colors.surfaceInverse : colors.background;
  const inner = [padded && styles.padded, contentStyle];
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: bg }, style]} edges={edges ?? ['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, inner]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Stack({
  children,
  gap = spacing.md,
  row = false,
  align,
  justify,
  wrap = false,
  style,
}: {
  children: React.ReactNode;
  gap?: number;
  row?: boolean;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        { gap, flexDirection: row ? 'row' : 'column', alignItems: align, justifyContent: justify },
        wrap && { flexWrap: 'wrap' },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Spacer({ size = spacing.lg }: { size?: number }) {
  return <View style={{ height: size }} />;
}

export function Divider() {
  return <View style={styles.divider} />;
}

/** Sticks a footer (usually a button) above the home indicator. */
export function Footer({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }, style]}>
      {children}
    </View>
  );
}

// --- text -------------------------------------------------------------------

type TextVariant = keyof typeof typeScale;

export function Text({
  variant = 'body',
  color = colors.text,
  center = false,
  style,
  children,
  ...rest
}: {
  variant?: TextVariant;
  color?: string;
  center?: boolean;
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof RNText>, 'style' | 'children'>) {
  return (
    <RNText
      style={[typeScale[variant], { color }, center && { textAlign: 'center' }, style]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

export const Display = (p: Omit<React.ComponentProps<typeof Text>, 'variant'>) => <Text variant="display" {...p} />;
export const Title = (p: Omit<React.ComponentProps<typeof Text>, 'variant'>) => <Text variant="title" {...p} />;
export const Heading = (p: Omit<React.ComponentProps<typeof Text>, 'variant'>) => <Text variant="heading" {...p} />;
export const Body = (p: Omit<React.ComponentProps<typeof Text>, 'variant'>) => <Text variant="body" {...p} />;
export const Caption = (p: Omit<React.ComponentProps<typeof Text>, 'variant' | 'color'> & { color?: string }) => (
  <Text variant="caption" color={p.color ?? colors.textMuted} {...p} />
);
export const Label = (p: Omit<React.ComponentProps<typeof Text>, 'variant' | 'color'> & { color?: string }) => (
  <Text variant="label" color={p.color ?? colors.textMuted} {...p} style={[{ textTransform: 'uppercase' }, p.style]} />
);

/** A vouch, word for word, under the voucher's first name. */
export function Quote({ text, by, style }: { text: string; by?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.quote, style]}>
      <Text variant="quote" color={colors.text}>
        {'“'}
        {text}
        {'”'}
      </Text>
      {by ? (
        <Caption style={{ marginTop: spacing.sm }} color={colors.textSecondary}>
          {by}
        </Caption>
      ) : null}
    </View>
  );
}

// --- controls ---------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  full = true,
  small = false,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.primary, fg: colors.textInverse },
    secondary: { bg: colors.surface, fg: colors.primary, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.primary },
    accent: { bg: colors.accent, fg: colors.textInverse },
    danger: { bg: colors.surface, fg: colors.danger, border: colors.border },
  };
  const p = palette[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: p.bg, borderColor: p.border ?? 'transparent', borderWidth: p.border ? 1 : 0 },
        !full && { alignSelf: 'flex-start' },
        pressed && { opacity: 0.85 },
        isDisabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <RNText style={[typeScale.bodyStrong, small && { fontSize: 15 }, { color: p.fg }]}>{title}</RNText>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected = false,
  onPress,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      <RNText style={[typeScale.caption, { color: selected ? colors.textInverse : colors.text, fontWeight: '600' }]}>
        {label}
      </RNText>
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  error,
  style,
  ...input
}: { label?: string; hint?: string; error?: string | null; style?: StyleProp<ViewStyle> } & TextInputProps) {
  return (
    <View style={[{ gap: spacing.xs }, style]}>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, input.multiline && styles.inputMultiline, error && { borderColor: colors.danger }]}
        {...input}
      />
      {error ? (
        <Caption color={colors.danger}>{error}</Caption>
      ) : hint ? (
        <Caption>{hint}</Caption>
      ) : null}
    </View>
  );
}

// --- surfaces ---------------------------------------------------------------

export function Card({
  children,
  onPress,
  style,
  tone = 'surface',
  ...rest
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  tone?: 'surface' | 'alt' | 'highlight' | 'inverse' | 'success';
} & Omit<PressableProps, 'style' | 'children' | 'onPress'>) {
  const bg = {
    surface: colors.surface,
    alt: colors.surfaceAlt,
    highlight: colors.highlight,
    inverse: colors.surfaceInverse,
    success: colors.successSoft,
  }[tone];
  const content = <View style={[styles.card, { backgroundColor: bg }, style]}>{children}</View>;
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && { opacity: 0.9 }} {...rest}>
      {content}
    </Pressable>
  );
}

export function Avatar({
  uri,
  name,
  size = 48,
  ring = false,
  style,
}: {
  uri?: string | null;
  name?: string;
  size?: number;
  ring?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const initial = (name ?? '?').trim().charAt(0).toUpperCase();
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: colors.highlight },
        ring && { borderWidth: 3, borderColor: colors.accent },
        style,
      ]}
      accessibilityLabel={name ? `${name}'s photo` : 'Photo'}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} />
      ) : (
        <View style={styles.center}>
          <RNText style={{ fontSize: size * 0.42, fontWeight: '700', color: colors.primary }}>{initial}</RNText>
        </View>
      )}
    </View>
  );
}

/** Overlapping faces: the circle at a glance. */
export function FaceRow({
  people,
  size = 40,
  max = 6,
}: {
  people: { id: string; first_name: string; photo_url: string | null }[];
  size?: number;
  max?: number;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {shown.map((p, i) => (
        <View key={p.id} style={{ marginLeft: i === 0 ? 0 : -size * 0.3, zIndex: shown.length - i }}>
          <Avatar uri={p.photo_url} name={p.first_name} size={size} style={{ borderWidth: 2, borderColor: colors.background }} />
        </View>
      ))}
      {extra > 0 ? (
        <Caption style={{ marginLeft: spacing.sm }} color={colors.textSecondary}>
          +{extra}
        </Caption>
      ) : null}
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  left,
  right,
  onPress,
  style,
}: {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.8 }, style]}
    >
      {left}
      <View style={{ flex: 1, gap: 2 }}>
        <Body>{title}</Body>
        {subtitle ? <Caption>{subtitle}</Caption> : null}
      </View>
      {right}
    </Pressable>
  );
}

/** Honest progress: "Your circle is 3 people. Matches unlock at 10." */
export function Progress({ value, max, style }: { value: number; max: number; style?: StyleProp<ViewStyle> }) {
  const pct = Math.max(0, Math.min(1, max === 0 ? 0 : value / max));
  return (
    <View style={[styles.progressTrack, style]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max, now: value }}>
      <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
    </View>
  );
}

// --- states -----------------------------------------------------------------

export function Loading({ label }: { label?: string }) {
  return (
    <View style={[styles.center, { padding: spacing.xxl, gap: spacing.md }]}>
      <ActivityIndicator color={colors.primary} />
      {label ? <Caption>{label}</Caption> : null}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={[styles.center, { padding: spacing.xxl, gap: spacing.md }]}>
      <Body center color={colors.textSecondary}>
        {message}
      </Body>
      {onRetry ? <Button title="Try again" variant="secondary" full={false} onPress={onRetry} /> : null}
    </View>
  );
}

export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: { title: string; onPress: () => void };
}) {
  return (
    <View style={{ padding: spacing.xl, gap: spacing.md, alignItems: 'center' }}>
      <Heading center>{title}</Heading>
      {body ? (
        <Body center color={colors.textSecondary}>
          {body}
        </Body>
      ) : null}
      {action ? <Button title={action.title} variant="secondary" full={false} onPress={action.onPress} /> : null}
    </View>
  );
}

// --- styles -----------------------------------------------------------------

const styles = StyleSheet.create({
  flex: { flex: 1 },
  padded: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  scrollContent: { flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.md },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  quote: {
    paddingLeft: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  button: {
    minHeight: 52,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: { minHeight: 40, paddingHorizontal: spacing.lg },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  input: {
    ...typeScale.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  inputMultiline: { minHeight: 110, textAlignVertical: 'top', paddingTop: spacing.md },
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.accent, borderRadius: radius.pill },
});
