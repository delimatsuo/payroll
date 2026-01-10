import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, fontSize, borderRadius } from '../../theme';

type ShiftType = 'morning' | 'afternoon' | 'night' | 'custom';

type ShiftConflict = {
  shiftType: ShiftType;
  shiftLabel: string;
  required: number;
  available: number;
  unavailableEmployees: Array<{ id: string; name: string; reason: string }>;
};

type ConflictAlertProps = {
  conflicts: ShiftConflict[];
  onResolve?: (conflict: ShiftConflict) => void;
};

const SHIFT_ICONS: Record<ShiftType, string> = {
  morning: 'sunny',
  afternoon: 'partly-sunny',
  night: 'moon',
  custom: 'time',
};

export function ConflictAlert({ conflicts, onResolve }: ConflictAlertProps) {
  if (conflicts.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="alert-circle" size={20} color={colors.warning.main} />
        <Text style={styles.headerText}>
          {conflicts.length} conflito{conflicts.length > 1 ? 's' : ''} de escala
        </Text>
      </View>

      {conflicts.map((conflict, idx) => (
        <View key={idx} style={styles.conflictItem}>
          <View style={styles.conflictHeader}>
            <View style={styles.conflictShift}>
              <Ionicons
                name={SHIFT_ICONS[conflict.shiftType] as any}
                size={16}
                color={colors.warning.dark}
              />
              <Text style={styles.conflictShiftLabel}>{conflict.shiftLabel}</Text>
            </View>
            <View style={styles.conflictCount}>
              <Text style={styles.conflictCountText}>
                {conflict.available}/{conflict.required} funcionários
              </Text>
            </View>
          </View>

          {conflict.unavailableEmployees.length > 0 && (
            <View style={styles.unavailableList}>
              {conflict.unavailableEmployees.slice(0, 3).map((emp, i) => (
                <View key={emp.id} style={styles.unavailableItem}>
                  <Text style={styles.unavailableName}>{emp.name}</Text>
                  <Text style={styles.unavailableReason}>{emp.reason}</Text>
                </View>
              ))}
              {conflict.unavailableEmployees.length > 3 && (
                <Text style={styles.moreText}>
                  +{conflict.unavailableEmployees.length - 3} mais
                </Text>
              )}
            </View>
          )}

          {onResolve && (
            <Pressable
              style={({ pressed }) => [
                styles.resolveButton,
                pressed && styles.resolveButtonPressed,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onResolve(conflict);
              }}
            >
              <Text style={styles.resolveButtonText}>Resolver</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary[600]} />
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.warning.light,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.warning.main,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  headerText: {
    fontSize: fontSize.subhead,
    fontWeight: '600',
    color: colors.warning.dark,
  },
  conflictItem: {
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.warning.main,
  },
  conflictHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conflictShift: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  conflictShiftLabel: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.warning.dark,
  },
  conflictCount: {
    backgroundColor: colors.error.light,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  conflictCountText: {
    fontSize: fontSize.caption1,
    fontWeight: '600',
    color: colors.error.main,
  },
  unavailableList: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(245, 158, 11, 0.3)',
  },
  unavailableItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  unavailableName: {
    fontSize: fontSize.footnote,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  unavailableReason: {
    fontSize: fontSize.caption1,
    color: colors.text.tertiary,
  },
  moreText: {
    fontSize: fontSize.caption1,
    color: colors.text.tertiary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  resolveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.md,
  },
  resolveButtonPressed: {
    backgroundColor: colors.primary[100],
  },
  resolveButtonText: {
    fontSize: fontSize.subhead,
    fontWeight: '600',
    color: colors.primary[600],
  },
});
