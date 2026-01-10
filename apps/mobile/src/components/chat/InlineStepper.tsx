import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, fontSize, borderRadius } from '../../theme';

type InlineStepperProps = {
  value: number;
  min?: number;
  max?: number;
  label?: string;
  onChange: (value: number) => void;
  onSubmit: (value: number) => void;
};

export function InlineStepper({
  value,
  min = 1,
  max = 20,
  label = 'pessoas',
  onChange,
  onSubmit,
}: InlineStepperProps) {
  const handleDecrement = () => {
    if (value > min) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onChange(value - 1);
    }
  };

  const handleIncrement = () => {
    if (value < max) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onChange(value + 1);
    }
  };

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSubmit(value);
  };

  return (
    <View style={styles.container}>
      <View style={styles.stepperRow}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            value <= min && styles.buttonDisabled,
            pressed && value > min && styles.buttonPressed,
          ]}
          onPress={handleDecrement}
          disabled={value <= min}
        >
          <Ionicons
            name="remove"
            size={24}
            color={value <= min ? colors.text.quaternary : colors.primary[600]}
          />
        </Pressable>

        <View style={styles.valueContainer}>
          <Text style={styles.value}>{value}</Text>
          <Text style={styles.label}>{label}</Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            value >= max && styles.buttonDisabled,
            pressed && value < max && styles.buttonPressed,
          ]}
          onPress={handleIncrement}
          disabled={value >= max}
        >
          <Ionicons
            name="add"
            size={24}
            color={value >= max ? colors.text.quaternary : colors.primary[600]}
          />
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.confirmButton,
          pressed && styles.confirmButtonPressed,
        ]}
        onPress={handleConfirm}
      >
        <Text style={styles.confirmButtonText}>Confirmar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  buttonPressed: {
    backgroundColor: colors.primary[50],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  valueContainer: {
    alignItems: 'center',
    minWidth: 80,
  },
  value: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.primary[600],
  },
  label: {
    fontSize: fontSize.caption1,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  confirmButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  confirmButtonPressed: {
    backgroundColor: colors.primary[700],
  },
  confirmButtonText: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text.inverse,
  },
});
