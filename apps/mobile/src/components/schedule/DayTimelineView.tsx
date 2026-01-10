import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, fontSize, borderRadius } from '../../theme';

// Shift type definitions
type ShiftType = 'morning' | 'afternoon' | 'night' | 'custom';

type ShiftItem = {
  employeeId: string;
  employeeName: string;
  startTime: string;
  endTime: string;
  shiftType: ShiftType;
  shiftLabel: string;
};

type DayTimelineViewProps = {
  date: Date;
  shifts: ShiftItem[];
  operatingHours?: { openTime: string; closeTime: string; isOpen: boolean };
  onShiftPress?: (shift: ShiftItem) => void;
  onAddShift?: (hour: number) => void;
};

// Shift type colors
const SHIFT_COLORS = {
  morning: {
    background: '#FEF3C7',
    border: '#F59E0B',
    text: '#92400E',
  },
  afternoon: {
    background: '#DBEAFE',
    border: '#3B82F6',
    text: '#1E40AF',
  },
  night: {
    background: '#EDE9FE',
    border: '#8B5CF6',
    text: '#5B21B6',
  },
  custom: {
    background: '#F3F4F6',
    border: '#6B7280',
    text: '#374151',
  },
};

const SHIFT_ICONS: Record<ShiftType, string> = {
  morning: 'sunny',
  afternoon: 'partly-sunny',
  night: 'moon',
  custom: 'time',
};

// Parse time string to hours (decimal)
function parseTimeToHours(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours + minutes / 60;
}

// Format hour for display
function formatHour(hour: number): string {
  const h = Math.floor(hour);
  return `${h.toString().padStart(2, '0')}:00`;
}

export function DayTimelineView({
  date,
  shifts,
  operatingHours,
  onShiftPress,
  onAddShift,
}: DayTimelineViewProps) {
  // Calculate the hour range to display (from earliest shift start to latest shift end)
  const { startHour, endHour, hourLabels } = useMemo(() => {
    // Default to 6:00 - 00:00 for 24/7 operation
    let minHour = 6;
    let maxHour = 24;

    if (shifts.length > 0) {
      const starts = shifts.map((s) => parseTimeToHours(s.startTime));
      const ends = shifts.map((s) => {
        const end = parseTimeToHours(s.endTime);
        // Handle overnight shifts (end time is next day)
        return end < parseTimeToHours(s.startTime) ? end + 24 : end;
      });

      minHour = Math.min(...starts, minHour);
      maxHour = Math.max(...ends, maxHour);
    }

    // Round to whole hours
    minHour = Math.floor(minHour);
    maxHour = Math.ceil(maxHour);

    // Create hour labels
    const labels: number[] = [];
    for (let h = minHour; h <= maxHour; h++) {
      labels.push(h % 24);
    }

    return { startHour: minHour, endHour: maxHour, hourLabels: labels };
  }, [shifts]);

  // Group shifts by type for the summary
  const shiftsByType = useMemo(() => {
    const grouped: Record<ShiftType, ShiftItem[]> = {
      morning: [],
      afternoon: [],
      night: [],
      custom: [],
    };
    shifts.forEach((shift) => {
      grouped[shift.shiftType].push(shift);
    });
    return grouped;
  }, [shifts]);

  const HOUR_HEIGHT = 50;
  const totalHeight = hourLabels.length * HOUR_HEIGHT;

  // Calculate shift block position and height
  const getShiftStyle = (shift: ShiftItem) => {
    const startH = parseTimeToHours(shift.startTime);
    let endH = parseTimeToHours(shift.endTime);

    // Handle overnight shifts
    if (endH < startH) {
      endH += 24;
    }

    const top = (startH - startHour) * HOUR_HEIGHT;
    const height = (endH - startH) * HOUR_HEIGHT;
    const shiftColors = SHIFT_COLORS[shift.shiftType];

    return {
      position: 'absolute' as const,
      top,
      height: Math.max(height, HOUR_HEIGHT / 2),
      left: 60,
      right: spacing.md,
      backgroundColor: shiftColors.background,
      borderLeftWidth: 4,
      borderLeftColor: shiftColors.border,
      borderRadius: borderRadius.sm,
      padding: spacing.sm,
      justifyContent: 'center' as const,
    };
  };

  if (!operatingHours?.isOpen) {
    return (
      <View style={styles.closedContainer}>
        <Ionicons name="moon" size={32} color={colors.neutral[400]} />
        <Text style={styles.closedText}>Estabelecimento fechado</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Summary Header */}
      <View style={styles.summaryHeader}>
        <Text style={styles.summaryTitle}>TIMELINE DO DIA</Text>
        <View style={styles.summaryStats}>
          <Text style={styles.summaryCount}>
            {shifts.length} turno{shifts.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* Timeline */}
      <ScrollView
        style={styles.timelineScroll}
        contentContainerStyle={{ height: totalHeight }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hour lines and labels */}
        {hourLabels.map((hour, idx) => (
          <View
            key={idx}
            style={[styles.hourRow, { top: idx * HOUR_HEIGHT }]}
          >
            <Text style={styles.hourLabel}>{formatHour(hour)}</Text>
            <View style={styles.hourLine} />
          </View>
        ))}

        {/* Shift blocks */}
        {shifts.map((shift, idx) => (
          <Pressable
            key={`${shift.employeeId}-${idx}`}
            style={({ pressed }) => [
              getShiftStyle(shift),
              pressed && styles.shiftBlockPressed,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onShiftPress?.(shift);
            }}
          >
            <View style={styles.shiftContent}>
              <View style={styles.shiftHeader}>
                <Ionicons
                  name={SHIFT_ICONS[shift.shiftType] as any}
                  size={14}
                  color={SHIFT_COLORS[shift.shiftType].text}
                />
                <Text
                  style={[
                    styles.shiftLabel,
                    { color: SHIFT_COLORS[shift.shiftType].text },
                  ]}
                >
                  {shift.shiftLabel}
                </Text>
              </View>
              <Text
                style={[
                  styles.shiftEmployee,
                  { color: SHIFT_COLORS[shift.shiftType].text },
                ]}
                numberOfLines={1}
              >
                {shift.employeeName}
              </Text>
              <Text
                style={[
                  styles.shiftTime,
                  { color: SHIFT_COLORS[shift.shiftType].text },
                ]}
              >
                {shift.startTime} - {shift.endTime}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* Legend */}
      <View style={styles.legend}>
        {(['morning', 'afternoon', 'night'] as ShiftType[]).map((type) => (
          <View key={type} style={styles.legendItem}>
            <View
              style={[
                styles.legendColor,
                { backgroundColor: SHIFT_COLORS[type].border },
              ]}
            />
            <Text style={styles.legendText}>
              {type === 'morning' ? 'Manhã' : type === 'afternoon' ? 'Tarde' : 'Noite'}
              {shiftsByType[type].length > 0 && ` (${shiftsByType[type].length})`}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  closedContainer: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  closedText: {
    fontSize: fontSize.body,
    color: colors.text.tertiary,
    marginTop: spacing.md,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
  },
  summaryTitle: {
    fontSize: fontSize.footnote,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: 0.5,
  },
  summaryStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryCount: {
    fontSize: fontSize.footnote,
    color: colors.text.tertiary,
  },
  timelineScroll: {
    maxHeight: 400,
  },
  hourRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 50,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  hourLabel: {
    width: 50,
    paddingLeft: spacing.sm,
    fontSize: fontSize.caption2,
    color: colors.text.tertiary,
    fontVariant: ['tabular-nums'],
  },
  hourLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.light,
    marginTop: 8,
  },
  shiftBlockPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  shiftContent: {
    flex: 1,
  },
  shiftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  shiftLabel: {
    fontSize: fontSize.caption1,
    fontWeight: '600',
  },
  shiftEmployee: {
    fontSize: fontSize.subhead,
    fontWeight: '500',
  },
  shiftTime: {
    fontSize: fontSize.caption2,
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.light,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    fontSize: fontSize.caption1,
    color: colors.text.secondary,
  },
});
