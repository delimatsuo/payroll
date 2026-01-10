import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, fontSize, borderRadius } from '../../theme';

type ShiftType = 'morning' | 'afternoon' | 'night' | 'custom';

type ShiftItem = {
  employeeId: string;
  employeeName: string;
  startTime: string;
  endTime: string;
  shiftType: ShiftType;
  shiftLabel: string;
};

type ShiftListViewProps = {
  shifts: ShiftItem[];
  minEmployeesPerShift: Record<ShiftType, number>;
  onShiftPress?: (shift: ShiftItem) => void;
  onAddShift?: (shiftType: ShiftType) => void;
};

const SHIFT_CONFIG: Record<
  ShiftType,
  { label: string; icon: string; bgColor: string; textColor: string; borderColor: string }
> = {
  morning: {
    label: 'Manhã',
    icon: 'sunny',
    bgColor: '#FEF3C7',
    textColor: '#92400E',
    borderColor: '#F59E0B',
  },
  afternoon: {
    label: 'Tarde',
    icon: 'partly-sunny',
    bgColor: '#DBEAFE',
    textColor: '#1E40AF',
    borderColor: '#3B82F6',
  },
  night: {
    label: 'Noite',
    icon: 'moon',
    bgColor: '#EDE9FE',
    textColor: '#5B21B6',
    borderColor: '#8B5CF6',
  },
  custom: {
    label: 'Personalizado',
    icon: 'time',
    bgColor: '#F3F4F6',
    textColor: '#374151',
    borderColor: '#6B7280',
  },
};

export function ShiftListView({
  shifts,
  minEmployeesPerShift,
  onShiftPress,
  onAddShift,
}: ShiftListViewProps) {
  // Group shifts by type
  const shiftsByType: Record<ShiftType, ShiftItem[]> = {
    morning: [],
    afternoon: [],
    night: [],
    custom: [],
  };

  shifts.forEach((shift) => {
    shiftsByType[shift.shiftType].push(shift);
  });

  // Order of shift types to display
  const shiftOrder: ShiftType[] = ['morning', 'afternoon', 'night'];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>TURNOS DO DIA</Text>
        <View style={styles.coverageChip}>
          <Text style={styles.coverageText}>{shifts.length} funcionários</Text>
        </View>
      </View>

      {shiftOrder.map((shiftType) => {
        const typeShifts = shiftsByType[shiftType];
        const config = SHIFT_CONFIG[shiftType];
        const required = minEmployeesPerShift[shiftType] || 1;
        const current = typeShifts.length;
        const isCovered = current >= required;

        return (
          <View key={shiftType} style={styles.shiftGroup}>
            {/* Group Header */}
            <View
              style={[
                styles.groupHeader,
                { backgroundColor: config.bgColor },
              ]}
            >
              <View style={styles.groupHeaderLeft}>
                <Ionicons
                  name={config.icon as any}
                  size={18}
                  color={config.textColor}
                />
                <Text style={[styles.groupTitle, { color: config.textColor }]}>
                  {config.label}
                </Text>
              </View>
              <View style={styles.groupHeaderRight}>
                <View
                  style={[
                    styles.coverageIndicator,
                    isCovered ? styles.coverageOk : styles.coverageWarning,
                  ]}
                >
                  <Text
                    style={[
                      styles.coverageIndicatorText,
                      isCovered ? styles.coverageOkText : styles.coverageWarningText,
                    ]}
                  >
                    {current}/{required}
                  </Text>
                  <Ionicons
                    name={isCovered ? 'checkmark-circle' : 'alert-circle'}
                    size={14}
                    color={isCovered ? colors.success.main : colors.warning.main}
                  />
                </View>
              </View>
            </View>

            {/* Employees in this shift */}
            {typeShifts.length === 0 ? (
              <View style={styles.emptyShift}>
                <Text style={styles.emptyShiftText}>
                  Nenhum funcionário atribuído
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.addButton,
                    pressed && styles.addButtonPressed,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onAddShift?.(shiftType);
                  }}
                >
                  <Ionicons name="add" size={16} color={colors.primary[600]} />
                  <Text style={styles.addButtonText}>Adicionar</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.shiftsList}>
                {typeShifts.map((shift, idx) => (
                  <Pressable
                    key={`${shift.employeeId}-${idx}`}
                    style={({ pressed }) => [
                      styles.shiftItem,
                      pressed && styles.shiftItemPressed,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onShiftPress?.(shift);
                    }}
                  >
                    <View
                      style={[
                        styles.avatar,
                        { backgroundColor: config.bgColor },
                      ]}
                    >
                      <Text style={[styles.avatarText, { color: config.textColor }]}>
                        {shift.employeeName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.shiftInfo}>
                      <Text style={styles.employeeName}>{shift.employeeName}</Text>
                      <Text style={styles.shiftTime}>
                        {shift.startTime} - {shift.endTime}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={colors.text.quaternary}
                    />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
  },
  headerTitle: {
    fontSize: fontSize.footnote,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: 0.5,
  },
  coverageChip: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  coverageText: {
    fontSize: fontSize.caption1,
    fontWeight: '600',
    color: colors.primary[600],
  },
  shiftGroup: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  groupTitle: {
    fontSize: fontSize.subhead,
    fontWeight: '600',
  },
  groupHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coverageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  coverageOk: {
    backgroundColor: colors.success.light,
  },
  coverageWarning: {
    backgroundColor: colors.warning.light,
  },
  coverageIndicatorText: {
    fontSize: fontSize.caption1,
    fontWeight: '600',
  },
  coverageOkText: {
    color: colors.success.main,
  },
  coverageWarningText: {
    color: colors.warning.main,
  },
  emptyShift: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
  },
  emptyShiftText: {
    fontSize: fontSize.subhead,
    color: colors.text.tertiary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[100],
  },
  addButtonPressed: {
    backgroundColor: colors.primary[200],
  },
  addButtonText: {
    fontSize: fontSize.subhead,
    fontWeight: '500',
    color: colors.primary[600],
  },
  shiftsList: {
    padding: spacing.sm,
    gap: spacing.xs,
  },
  shiftItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
  },
  shiftItemPressed: {
    backgroundColor: colors.neutral[200],
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: fontSize.subhead,
    fontWeight: '600',
  },
  shiftInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  employeeName: {
    fontSize: fontSize.body,
    fontWeight: '500',
    color: colors.text.primary,
  },
  shiftTime: {
    fontSize: fontSize.caption1,
    color: colors.text.secondary,
    marginTop: 2,
  },
});
