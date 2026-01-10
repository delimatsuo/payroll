import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, fontSize, borderRadius } from '../../theme';

type Employee = {
  name: string;
  phone: string;
  confidence?: number;
};

type InlineEmployeeListProps = {
  employees: Employee[];
  onSubmit: (employees: Employee[]) => void;
  onCancel: () => void;
};

export function InlineEmployeeList({
  employees: initialEmployees,
  onSubmit,
  onCancel,
}: InlineEmployeeListProps) {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  const handleRemove = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEmployees((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEdit = (index: number, field: 'name' | 'phone', value: string) => {
    setEmployees((prev) =>
      prev.map((emp, i) => (i === index ? { ...emp, [field]: value } : emp))
    );
  };

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Filter out empty entries
    const validEmployees = employees.filter((e) => e.name.trim());
    onSubmit(validEmployees);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {employees.length} funcionário{employees.length !== 1 ? 's' : ''} encontrado
        {employees.length !== 1 ? 's' : ''}
      </Text>

      {employees.map((employee, index) => (
        <View key={index} style={styles.employeeRow}>
          {editingIndex === index ? (
            <View style={styles.editForm}>
              <TextInput
                style={styles.input}
                value={employee.name}
                onChangeText={(text) => handleEdit(index, 'name', text)}
                placeholder="Nome"
                placeholderTextColor={colors.text.quaternary}
                autoCapitalize="words"
              />
              <TextInput
                style={styles.input}
                value={employee.phone}
                onChangeText={(text) => handleEdit(index, 'phone', text)}
                placeholder="Telefone"
                placeholderTextColor={colors.text.quaternary}
                keyboardType="phone-pad"
              />
              <Pressable
                style={styles.doneButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setEditingIndex(null);
                }}
              >
                <Ionicons name="checkmark" size={20} color={colors.primary[600]} />
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.employeeInfo}>
                <Text style={styles.employeeName}>{employee.name}</Text>
                <Text style={styles.employeePhone}>
                  {employee.phone ? formatPhone(employee.phone) : 'Sem telefone'}
                </Text>
              </View>

              <View style={styles.actions}>
                <Pressable
                  style={styles.actionButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setEditingIndex(index);
                  }}
                >
                  <Ionicons name="pencil" size={18} color={colors.text.tertiary} />
                </Pressable>
                <Pressable
                  style={styles.actionButton}
                  onPress={() => handleRemove(index)}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.error.main} />
                </Pressable>
              </View>
            </>
          )}
        </View>
      ))}

      <View style={styles.buttonRow}>
        <Pressable
          style={({ pressed }) => [
            styles.cancelButton,
            pressed && styles.cancelButtonPressed,
          ]}
          onPress={onCancel}
        >
          <Text style={styles.cancelButtonText}>Corrigir</Text>
        </Pressable>

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
    marginBottom: spacing.md,
  },
  employeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: fontSize.body,
    fontWeight: '500',
    color: colors.text.primary,
  },
  employeePhone: {
    fontSize: fontSize.caption1,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    padding: spacing.xs,
  },
  editForm: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: fontSize.subhead,
    color: colors.text.primary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  doneButton: {
    padding: spacing.xs,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  cancelButtonPressed: {
    backgroundColor: colors.background.secondary,
  },
  cancelButtonText: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  confirmButton: {
    flex: 1,
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
