import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import * as Haptics from 'expo-haptics';
import { colors, spacing, fontSize, borderRadius } from '../../theme';

type Employee = {
  name: string;
  phone: string;
};

type ContactEmployeeInputProps = {
  onSubmit: (employees: Employee[]) => void;
  onSkip: () => void;
};

export function ContactEmployeeInput({ onSubmit, onSkip }: ContactEmployeeInputProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');

  const formatPhone = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  const normalizePhone = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    // Remove country code if present
    if (digits.startsWith('55') && digits.length > 11) {
      return digits.slice(2);
    }
    return digits.slice(0, 11);
  };

  const isDuplicate = (phone: string): boolean => {
    const normalized = normalizePhone(phone);
    return employees.some((e) => normalizePhone(e.phone) === normalized);
  };

  const pickContact = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permissão necessária',
          'Precisamos acessar seus contatos para adicionar funcionários. Você pode conceder permissão nas configurações do app.'
        );
        return;
      }

      const contact = await Contacts.presentContactPickerAsync();

      if (contact) {
        const name = contact.name ||
          [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
          'Sem nome';
        const phoneNumber = contact.phoneNumbers?.[0]?.number || '';

        if (!phoneNumber) {
          Alert.alert(
            'Sem telefone',
            `${name} não tem telefone cadastrado. Deseja adicionar manualmente?`,
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Adicionar',
                onPress: () => {
                  setManualName(name);
                  setManualPhone('');
                  setShowManualEntry(true);
                }
              },
            ]
          );
          return;
        }

        const normalizedPhone = normalizePhone(phoneNumber);

        if (isDuplicate(normalizedPhone)) {
          Alert.alert(
            'Telefone duplicado',
            `Este número já está na lista de funcionários.`
          );
          return;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setEmployees((prev) => [...prev, { name: name.trim(), phone: normalizedPhone }]);
      }
    } catch (error) {
      console.error('Error picking contact:', error);
      Alert.alert('Erro', 'Não foi possível acessar os contatos. Tente novamente.');
    }
  };

  const handleManualAdd = () => {
    if (!manualName.trim()) {
      Alert.alert('Nome obrigatório', 'Digite o nome do funcionário.');
      return;
    }

    const normalizedPhone = normalizePhone(manualPhone);

    if (normalizedPhone.length < 10) {
      Alert.alert('Telefone inválido', 'Digite um telefone válido com DDD.');
      return;
    }

    if (isDuplicate(normalizedPhone)) {
      Alert.alert('Telefone duplicado', 'Este número já está na lista.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setEmployees((prev) => [...prev, { name: manualName.trim(), phone: normalizedPhone }]);
    setManualName('');
    setManualPhone('');
    setShowManualEntry(false);
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

  const handleSubmit = () => {
    if (employees.length === 0) {
      Alert.alert(
        'Nenhum funcionário',
        'Adicione pelo menos um funcionário para continuar.',
        [{ text: 'OK' }]
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSubmit(employees);
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (employees.length > 0) {
      Alert.alert(
        'Descartar funcionários?',
        `Você adicionou ${employees.length} funcionário${employees.length > 1 ? 's' : ''}. Deseja descartá-los?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Descartar', style: 'destructive', onPress: onSkip },
        ]
      );
    } else {
      onSkip();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Adicione sua equipe</Text>
      <Text style={styles.subtitle}>
        Selecione funcionários da sua agenda ou digite manualmente
      </Text>

      {/* Primary Action - Contact Picker */}
      <Pressable
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.primaryButtonPressed,
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          pickContact();
        }}
      >
        <Ionicons name="person-add" size={20} color={colors.text.inverse} />
        <Text style={styles.primaryButtonText}>Selecionar dos Contatos</Text>
      </Pressable>

      {/* Secondary Action - Manual Entry */}
      <Pressable
        style={({ pressed }) => [
          styles.secondaryButton,
          pressed && styles.secondaryButtonPressed,
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowManualEntry(true);
        }}
      >
        <Ionicons name="create-outline" size={20} color={colors.primary[600]} />
        <Text style={styles.secondaryButtonText}>Digitar manualmente</Text>
      </Pressable>

      {/* Employee List */}
      {employees.length > 0 && (
        <View style={styles.listSection}>
          <Text style={styles.listTitle}>
            Funcionários adicionados ({employees.length}):
          </Text>

          {employees.map((employee, index) => (
            <View key={index} style={styles.employeeRow}>
              {editingIndex === index ? (
                <View style={styles.editForm}>
                  <TextInput
                    style={styles.editInput}
                    value={employee.name}
                    onChangeText={(text) => handleEdit(index, 'name', text)}
                    placeholder="Nome"
                    placeholderTextColor={colors.text.quaternary}
                    autoCapitalize="words"
                  />
                  <TextInput
                    style={styles.editInput}
                    value={formatPhone(employee.phone)}
                    onChangeText={(text) => handleEdit(index, 'phone', normalizePhone(text))}
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
                    <Text style={styles.employeePhone}>{formatPhone(employee.phone)}</Text>
                  </View>
                  <View style={styles.actions}>
                    <Pressable
                      style={styles.actionButton}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setEditingIndex(index);
                      }}
                      hitSlop={8}
                    >
                      <Ionicons name="pencil" size={18} color={colors.text.tertiary} />
                    </Pressable>
                    <Pressable
                      style={styles.actionButton}
                      onPress={() => handleRemove(index)}
                      hitSlop={8}
                    >
                      <Ionicons name="close-circle" size={20} color={colors.error.main} />
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Submit / Skip Buttons */}
      <View style={styles.footerButtons}>
        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            employees.length === 0 && styles.submitButtonDisabled,
            pressed && employees.length > 0 && styles.submitButtonPressed,
          ]}
          onPress={handleSubmit}
          disabled={employees.length === 0}
        >
          <Text style={[
            styles.submitButtonText,
            employees.length === 0 && styles.submitButtonTextDisabled,
          ]}>
            Continuar
          </Text>
          <Ionicons
            name="arrow-forward"
            size={18}
            color={employees.length === 0 ? colors.text.quaternary : colors.text.inverse}
          />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.skipLink, pressed && styles.skipLinkPressed]}
          onPress={handleSkip}
        >
          <Text style={styles.skipLinkText}>Pular por agora</Text>
        </Pressable>
      </View>

      {/* Manual Entry Modal */}
      <Modal
        visible={showManualEntry}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowManualEntry(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowManualEntry(false);
                setManualName('');
                setManualPhone('');
              }}
            >
              <Text style={styles.modalCancel}>Cancelar</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Novo funcionário</Text>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                handleManualAdd();
              }}
            >
              <Text style={[
                styles.modalDone,
                (!manualName.trim() || manualPhone.length < 10) && styles.modalDoneDisabled,
              ]}>
                Adicionar
              </Text>
            </Pressable>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nome</Text>
              <TextInput
                style={styles.modalInput}
                value={manualName}
                onChangeText={setManualName}
                placeholder="Ex: João Silva"
                placeholderTextColor={colors.text.quaternary}
                autoCapitalize="words"
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Telefone</Text>
              <TextInput
                style={styles.modalInput}
                value={formatPhone(manualPhone)}
                onChangeText={(text) => setManualPhone(normalizePhone(text))}
                placeholder="(11) 99999-9999"
                placeholderTextColor={colors.text.quaternary}
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    fontSize: fontSize.title3,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.subhead,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  primaryButtonPressed: {
    backgroundColor: colors.primary[700],
  },
  primaryButtonText: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary[600],
  },
  secondaryButtonPressed: {
    backgroundColor: colors.primary[50],
  },
  secondaryButtonText: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.primary[600],
  },
  listSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.light,
  },
  listTitle: {
    fontSize: fontSize.subhead,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  employeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
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
  editInput: {
    flex: 1,
    fontSize: fontSize.subhead,
    color: colors.text.primary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  doneButton: {
    padding: spacing.xs,
  },
  footerButtons: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  submitButtonPressed: {
    backgroundColor: colors.primary[700],
  },
  submitButtonDisabled: {
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  submitButtonText: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  submitButtonTextDisabled: {
    color: colors.text.quaternary,
  },
  skipLink: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  skipLinkPressed: {
    opacity: 0.7,
  },
  skipLinkText: {
    fontSize: fontSize.subhead,
    color: colors.text.secondary,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
  },
  modalCancel: {
    fontSize: fontSize.body,
    color: colors.text.secondary,
  },
  modalTitle: {
    fontSize: fontSize.headline,
    fontWeight: '600',
    color: colors.text.primary,
  },
  modalDone: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.primary[600],
  },
  modalDoneDisabled: {
    color: colors.text.quaternary,
  },
  modalContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  inputLabel: {
    fontSize: fontSize.subhead,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  modalInput: {
    fontSize: fontSize.body,
    color: colors.text.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
});
