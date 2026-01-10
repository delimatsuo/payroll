import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { colors, spacing, fontSize, borderRadius } from '../../theme';

type QuickReplyButton = {
  label: string;
  value: string;
  variant?: 'primary' | 'secondary';
};

type QuickRepliesProps = {
  buttons: QuickReplyButton[];
  onSelect: (value: string) => void;
  disabled?: boolean;
};

export function QuickReplies({ buttons, onSelect, disabled = false }: QuickRepliesProps) {
  const handlePress = (value: string) => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(value);
  };

  return (
    <Animated.View entering={FadeInUp.duration(200).delay(100).springify()}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {buttons.map((button, index) => (
          <Pressable
            key={`${button.value}-${index}`}
            onPress={() => handlePress(button.value)}
            disabled={disabled}
            style={({ pressed }) => [
              styles.button,
              button.variant === 'primary' ? styles.primaryButton : styles.secondaryButton,
              pressed && styles.buttonPressed,
              disabled && styles.buttonDisabled,
            ]}
          >
            <Text
              style={[
                styles.buttonText,
                button.variant === 'primary' ? styles.primaryButtonText : styles.secondaryButtonText,
                disabled && styles.buttonTextDisabled,
              ]}
            >
              {button.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  button: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
  },
  primaryButton: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  secondaryButton: {
    backgroundColor: colors.background.elevated,
    borderColor: colors.primary[300],
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: fontSize.subhead,
    fontWeight: '600',
  },
  primaryButtonText: {
    color: colors.text.inverse,
  },
  secondaryButtonText: {
    color: colors.primary[600],
  },
  buttonTextDisabled: {
    color: colors.text.tertiary,
  },
});
