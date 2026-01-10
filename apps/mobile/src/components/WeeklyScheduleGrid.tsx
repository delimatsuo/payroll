/**
 * Weekly Schedule Grid
 * Shows employee × day matrix with shifts at a glance
 * Inspired by 7shifts, When I Work, Deputy
 */

import { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, fontSize, borderRadius } from '../theme';

type Shift = {
  employeeId: string;
  startTime: string;
  endTime: string;
};

type DaySchedule = {
  date: Date;
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
  shifts: Shift[];
};

type Employee = {
  id: string;
  name: string;
  status: string;
};

type Props = {
  employees: Employee[];
  weekSchedule: DaySchedule[];
  onShiftPress?: (employeeId: string, date: Date, shift?: Shift) => void;
  onDayPress?: (date: Date) => void;
};

const DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const CELL_WIDTH = 56;
const NAME_WIDTH = 80;

// Get shift color based on time
function getShiftColor(startTime: string): { bg: string; text: string } {
  const hour = parseInt(startTime.split(':')[0]);

  if (hour < 12) {
    // Morning - amber
    return { bg: '#FEF3C7', text: '#92400E' };
  } else if (hour < 17) {
    // Afternoon - blue
    return { bg: '#DBEAFE', text: '#1E40AF' };
  } else {
    // Evening - purple
    return { bg: '#EDE9FE', text: '#5B21B6' };
  }
}

// Format shift time for display
function formatShiftTime(startTime: string, endTime: string): string {
  const start = startTime.replace(':00', '').replace(':30', ':30');
  const end = endTime.replace(':00', '').replace(':30', ':30');
  return `${start.replace(':00', '')}`;
}

export function WeeklyScheduleGrid({
  employees,
  weekSchedule,
  onShiftPress,
  onDayPress,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);

  // Get shifts for a specific employee on a specific day
  const getEmployeeShift = (employeeId: string, dayIndex: number): Shift | undefined => {
    const daySchedule = weekSchedule[dayIndex];
    return daySchedule?.shifts.find(s => s.employeeId === employeeId);
  };

  // Check if day is today
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Count shifts per day for header
  const getShiftCount = (dayIndex: number): number => {
    return weekSchedule[dayIndex]?.shifts.length || 0;
  };

  if (employees.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="people-outline" size={48} color={colors.text.quaternary} />
        <Text style={styles.emptyText}>Adicione funcionários para ver a escala</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Fixed header row */}
      <View style={styles.headerRow}>
        {/* Empty corner cell */}
        <View style={styles.cornerCell}>
          <Text style={styles.cornerText}>Equipe</Text>
        </View>

        {/* Day headers - horizontally scrollable */}
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          contentContainerStyle={styles.headerScrollContent}
        >
          {weekSchedule.map((day, index) => {
            const today = isToday(day.date);
            const shiftCount = getShiftCount(index);

            return (
              <Pressable
                key={index}
                style={({ pressed }) => [
                  styles.headerCell,
                  today && styles.headerCellToday,
                  !day.isOpen && styles.headerCellClosed,
                  pressed && styles.headerCellPressed,
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  onDayPress?.(day.date);
                }}
              >
                <Text style={[
                  styles.headerDayName,
                  today && styles.headerDayNameToday,
                  !day.isOpen && styles.headerDayNameClosed,
                ]}>
                  {DAYS_SHORT[day.date.getDay()]}
                </Text>
                <Text style={[
                  styles.headerDayNumber,
                  today && styles.headerDayNumberToday,
                  !day.isOpen && styles.headerDayNumberClosed,
                ]}>
                  {day.date.getDate()}
                </Text>
                {day.isOpen && shiftCount > 0 && (
                  <View style={styles.shiftCountBadge}>
                    <Text style={styles.shiftCountText}>{shiftCount}</Text>
                  </View>
                )}
                {!day.isOpen && (
                  <View style={styles.closedBadge}>
                    <Text style={styles.closedBadgeText}>-</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Employee rows - vertically scrollable */}
      <ScrollView
        style={styles.bodyScroll}
        showsVerticalScrollIndicator={false}
      >
        {employees.map((employee) => (
          <View key={employee.id} style={styles.employeeRow}>
            {/* Employee name - fixed */}
            <View style={styles.nameCell}>
              <Text style={styles.employeeName} numberOfLines={1}>
                {employee.name.split(' ')[0]}
              </Text>
              {employee.status !== 'active' && (
                <View style={styles.inactiveDot} />
              )}
            </View>

            {/* Shift cells - horizontally scrollable */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              scrollEnabled={false} // Synced with header
              contentContainerStyle={styles.rowScrollContent}
            >
              {weekSchedule.map((day, dayIndex) => {
                const shift = getEmployeeShift(employee.id, dayIndex);
                const today = isToday(day.date);

                if (!day.isOpen) {
                  return (
                    <View
                      key={dayIndex}
                      style={[styles.shiftCell, styles.shiftCellClosed]}
                    >
                      <View style={styles.closedIndicator} />
                    </View>
                  );
                }

                if (!shift) {
                  return (
                    <Pressable
                      key={dayIndex}
                      style={({ pressed }) => [
                        styles.shiftCell,
                        styles.shiftCellEmpty,
                        today && styles.shiftCellToday,
                        pressed && styles.shiftCellPressed,
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onShiftPress?.(employee.id, day.date);
                      }}
                    >
                      <Text style={styles.emptyShiftText}>-</Text>
                    </Pressable>
                  );
                }

                const shiftColor = getShiftColor(shift.startTime);

                return (
                  <Pressable
                    key={dayIndex}
                    style={({ pressed }) => [
                      styles.shiftCell,
                      today && styles.shiftCellToday,
                      pressed && styles.shiftCellPressed,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onShiftPress?.(employee.id, day.date, shift);
                    }}
                  >
                    <View style={[styles.shiftPill, { backgroundColor: shiftColor.bg }]}>
                      <Text style={[styles.shiftTime, { color: shiftColor.text }]}>
                        {formatShiftTime(shift.startTime, shift.endTime)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FEF3C7' }]} />
          <Text style={styles.legendText}>Manhã</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#DBEAFE' }]} />
          <Text style={styles.legendText}>Tarde</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#EDE9FE' }]} />
          <Text style={styles.legendText}>Noite</Text>
        </View>
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
  // Header
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
  },
  cornerCell: {
    width: NAME_WIDTH,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
    backgroundColor: colors.background.secondary,
  },
  cornerText: {
    fontSize: fontSize.caption1,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  headerScrollContent: {
    flexDirection: 'row',
  },
  headerCell: {
    width: CELL_WIDTH,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCellToday: {
    backgroundColor: colors.primary[50],
  },
  headerCellClosed: {
    backgroundColor: colors.neutral[50],
  },
  headerCellPressed: {
    opacity: 0.7,
  },
  headerDayName: {
    fontSize: fontSize.caption2,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  headerDayNameToday: {
    color: colors.primary[600],
  },
  headerDayNameClosed: {
    color: colors.text.quaternary,
  },
  headerDayNumber: {
    fontSize: fontSize.subhead,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 2,
  },
  headerDayNumberToday: {
    color: colors.primary[600],
  },
  headerDayNumberClosed: {
    color: colors.text.quaternary,
  },
  shiftCountBadge: {
    backgroundColor: colors.primary[600],
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginTop: 4,
  },
  shiftCountText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  closedBadge: {
    marginTop: 4,
  },
  closedBadgeText: {
    fontSize: fontSize.caption2,
    color: colors.text.quaternary,
  },
  // Body
  bodyScroll: {
    maxHeight: 300,
  },
  employeeRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
  },
  nameCell: {
    width: NAME_WIDTH,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
  employeeName: {
    fontSize: fontSize.footnote,
    fontWeight: '500',
    color: colors.text.primary,
    flex: 1,
  },
  inactiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.warning.main,
    marginLeft: 4,
  },
  rowScrollContent: {
    flexDirection: 'row',
  },
  // Shift cells
  shiftCell: {
    width: CELL_WIDTH,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border.light,
  },
  shiftCellToday: {
    backgroundColor: colors.primary[50] + '40',
  },
  shiftCellClosed: {
    backgroundColor: colors.neutral[50],
  },
  shiftCellEmpty: {
    backgroundColor: 'transparent',
  },
  shiftCellPressed: {
    backgroundColor: colors.overlay.light,
  },
  closedIndicator: {
    width: 16,
    height: 2,
    backgroundColor: colors.neutral[200],
    borderRadius: 1,
  },
  emptyShiftText: {
    fontSize: fontSize.caption1,
    color: colors.text.quaternary,
  },
  shiftPill: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
  },
  shiftTime: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Legend
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.light,
    backgroundColor: colors.background.secondary,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    fontSize: fontSize.caption2,
    color: colors.text.secondary,
  },
  // Empty state
  emptyContainer: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSize.subhead,
    color: colors.text.tertiary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
