import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, fontSize, borderRadius } from '../../theme';

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

type DayHours = {
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
};

type InlineTimePickerProps = {
  initialHours?: Record<number, DayHours>;
  onSubmit: (hours: Record<number, DayHours>) => void;
};

export function InlineTimePicker({ initialHours, onSubmit }: InlineTimePickerProps) {
  const [hours, setHours] = useState<Record<number, DayHours>>(() => {
    if (initialHours) return initialHours;
    // Default: Seg-Sex (Mon-Fri), 09:00-18:00
    const defaultHours: Record<number, DayHours> = {};
    for (let i = 0; i < 7; i++) {
      defaultHours[i] = {
        isOpen: i >= 1 && i <= 5, // Mon-Fri only
        openTime: '09:00',
        closeTime: '18:00',
      };
    }
    return defaultHours;
  });

  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const toggleDay = (day: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        isOpen: !prev[day]?.isOpen,
        openTime: prev[day]?.openTime || '09:00',
        closeTime: prev[day]?.closeTime || '18:00',
      },
    }));
  };

  const selectTime = (day: number, type: 'open' | 'close', time: string) => {
    Haptics.selectionAsync();
    setHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [type === 'open' ? 'openTime' : 'closeTime']: time,
      },
    }));
    setSelectedDay(null);
  };

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSubmit(hours);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dias de funcionamento</Text>
      <Text style={styles.hint}>Toque para ativar/desativar cada dia</Text>

      {/* Day toggles */}
      <View style={styles.daysRow}>
        {DAYS_PT.map((day, index) => (
          <Pressable
            key={index}
            style={({ pressed }) => [
              styles.dayButton,
              hours[index]?.isOpen && styles.dayButtonActive,
              pressed && styles.dayButtonPressed,
            ]}
            onPress={() => toggleDay(index)}
          >
            <Text
              style={[
                styles.dayText,
                hours[index]?.isOpen && styles.dayTextActive,
              ]}
            >
              {day}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Time for each open day */}
      <View style={styles.timesContainer}>
        {DAYS_PT.map((day, index) => {
          if (!hours[index]?.isOpen) return null;

          return (
            <View key={index} style={styles.dayTimeRow}>
              <Text style={styles.dayLabel}>{day}</Text>
              <Pressable
                style={styles.timeButton}
                onPress={() => setSelectedDay(selectedDay === index ? null : index)}
              >
                <Text style={styles.timeText}>
                  {hours[index]?.openTime} - {hours[index]?.closeTime}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.text.tertiary} />
              </Pressable>
            </View>
          );
        })}
      </View>

      {/* Time picker popup */}
      {selectedDay !== null && (
        <View style={styles.timePicker}>
          <Text style={styles.timePickerLabel}>Abre às</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {HOURS.map((time) => (
              <Pressable
                key={`open-${time}`}
                style={[
                  styles.timeOption,
                  hours[selectedDay]?.openTime === time && styles.timeOptionSelected,
                ]}
                onPress={() => selectTime(selectedDay, 'open', time)}
              >
                <Text
                  style={[
                    styles.timeOptionText,
                    hours[selectedDay]?.openTime === time && styles.timeOptionTextSelected,
                  ]}
                >
                  {time}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.timePickerLabel}>Fecha às</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {HOURS.map((time) => (
              <Pressable
                key={`close-${time}`}
                style={[
                  styles.timeOption,
                  hours[selectedDay]?.closeTime === time && styles.timeOptionSelected,
                ]}
                onPress={() => selectTime(selectedDay, 'close', time)}
              >
                <Text
                  style={[
                    styles.timeOptionText,
                    hours[selectedDay]?.closeTime === time && styles.timeOptionTextSelected,
                  ]}
                >
                  {time}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.confirmButton,
          pressed && styles.confirmButtonPressed,
        ]}
        onPress={handleConfirm}
      >
        <Text style={styles.confirmButtonText}>Confirmar horários</Text>
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
  title: {
    fontSize: fontSize.subhead,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  hint: {
    fontSize: fontSize.caption1,
    color: colors.text.tertiary,
    marginBottom: spacing.md,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  dayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  dayButtonActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  dayButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  dayText: {
    fontSize: fontSize.caption1,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  dayTextActive: {
    color: colors.text.inverse,
  },
  timesContainer: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  dayTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayLabel: {
    fontSize: fontSize.subhead,
    color: colors.text.secondary,
    width: 40,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.sm,
  },
  timeText: {
    fontSize: fontSize.subhead,
    color: colors.text.primary,
  },
  timePicker: {
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  timePickerLabel: {
    fontSize: fontSize.caption1,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  timeOption: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginRight: spacing.xs,
    backgroundColor: colors.background.secondary,
  },
  timeOptionSelected: {
    backgroundColor: colors.primary[600],
  },
  timeOptionText: {
    fontSize: fontSize.caption1,
    color: colors.text.secondary,
  },
  timeOptionTextSelected: {
    color: colors.text.inverse,
    fontWeight: '600',
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
