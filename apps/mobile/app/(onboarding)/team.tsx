import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { colors, spacing, fontSize, borderRadius, shadows } from '../../src/theme';
import { api } from '../../src/services/api';
import { pickContact } from '../../src/services/contacts';

interface EmployeeInput {
  id: string;
  name: string;
  phone: string;
}

const MIN_EMPLOYEES = 2;

// Brazilian phone mask: (XX) XXXXX-XXXX
function formatPhoneNumber(value: string): string {
  const numbers = value.replace(/\D/g, '');

  if (numbers.length <= 2) {
    return numbers.length ? `(${numbers}` : '';
  }
  if (numbers.length <= 7) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  }
  if (numbers.length <= 11) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  }
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export default function OnboardingTeamScreen() {
  const router = useRouter();
  const [employees, setEmployees] = useState<EmployeeInput[]>([
    { id: generateId(), name: '', phone: '' },
  ]);
  const [loading, setLoading] = useState(false);

  const handleAddEmployee = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEmployees((prev) => [...prev, { id: generateId(), name: '', phone: '' }]);
  }, []);

  const handlePickFromContacts = useCallback(async () => {
    const contact = await pickContact();

    if (contact) {
      // Check if we have an empty slot to fill
      const emptySlotIndex = employees.findIndex(
        (emp) => emp.name.trim() === '' && emp.phone.replace(/\D/g, '') === ''
      );

      if (emptySlotIndex >= 0) {
        // Fill the empty slot
        setEmployees((prev) =>
          prev.map((emp, idx) =>
            idx === emptySlotIndex
              ? { ...emp, name: contact.name, phone: contact.phone }
              : emp
          )
        );
      } else {
        // Add new employee with contact data
        setEmployees((prev) => [
          ...prev,
          { id: generateId(), name: contact.name, phone: contact.phone },
        ]);
      }
    }
  }, [employees]);

  const handleRemoveEmployee = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEmployees((prev) => prev.filter((emp) => emp.id !== id));
  }, []);

  const handleUpdateEmployee = useCallback((id: string, field: 'name' | 'phone', value: string) => {
    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === id
          ? { ...emp, [field]: field === 'phone' ? formatPhoneNumber(value) : value }
          : emp
      )
    );
  }, []);

  const getValidEmployees = useCallback(() => {
    return employees.filter(
      (emp) => emp.name.trim().length >= 2 && emp.phone.replace(/\D/g, '').length === 11
    );
  }, [employees]);

  const handleContinue = async () => {
    Keyboard.dismiss();
    const validEmployees = getValidEmployees();

    if (validEmployees.length < MIN_EMPLOYEES) {
      Alert.alert(
        'Funcionários insuficientes',
        `Adicione pelo menos ${MIN_EMPLOYEES} funcionários para continuar.`,
        [{ text: 'OK' }]
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    try {
      const employeesData = validEmployees.map((emp) => ({
        name: emp.name.trim(),
        phone: emp.phone.replace(/\D/g, ''),
      }));

      const result = await api.createEmployeesBatch(employeesData);

      if (result.success !== false) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.push('/(onboarding)/complete');
      } else {
        Alert.alert('Erro', result.message || 'Não foi possível adicionar os funcionários');
      }
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Pular esta etapa?',
      'Você pode adicionar funcionários depois nas configurações.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Pular',
          onPress: () => router.push('/(onboarding)/complete'),
        },
      ]
    );
  };

  const validCount = getValidEmployees().length;
  const canContinue = validCount >= MIN_EMPLOYEES;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Progress Indicator - Step 4 of 5 */}
        <View style={styles.progress}>
          <View style={styles.progressDot} />
          <View style={styles.progressDot} />
          <View style={styles.progressDot} />
          <View style={[styles.progressDot, styles.progressDotActive]} />
          <View style={styles.progressDot} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Sua equipe</Text>
          <Text style={styles.subtitle}>
            Adicione os funcionários que vão trabalhar nas escalas
          </Text>
        </View>

        {/* Employee List */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {employees.map((employee, index) => (
            <Animated.View
              key={employee.id}
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(150)}
              layout={Layout.springify()}
              style={styles.employeeCard}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardBadge}>
                  <Text style={styles.cardBadgeText}>{index + 1}</Text>
                </View>
                {employees.length > 1 && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.removeButton,
                      pressed && styles.removeButtonPressed,
                    ]}
                    onPress={() => handleRemoveEmployee(employee.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle-outline" size={22} color={colors.text.tertiary} />
                  </Pressable>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nome</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nome do funcionário"
                  placeholderTextColor={colors.text.quaternary}
                  value={employee.name}
                  onChangeText={(text) => handleUpdateEmployee(employee.id, 'name', text)}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>WhatsApp</Text>
                <TextInput
                  style={styles.input}
                  placeholder="(00) 00000-0000"
                  placeholderTextColor={colors.text.quaternary}
                  value={employee.phone}
                  onChangeText={(text) => handleUpdateEmployee(employee.id, 'phone', text)}
                  keyboardType="phone-pad"
                  maxLength={15}
                />
              </View>
            </Animated.View>
          ))}

          {/* Add Buttons */}
          <View style={styles.addButtonsContainer}>
            <Pressable
              style={({ pressed }) => [
                styles.addButtonPrimary,
                pressed && styles.addButtonPressed,
              ]}
              onPress={handlePickFromContacts}
            >
              <Ionicons name="people" size={22} color={colors.primary[600]} />
              <Text style={styles.addButtonText}>Escolher dos contatos</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.addButtonSecondary,
                pressed && styles.addButtonSecondaryPressed,
              ]}
              onPress={handleAddEmployee}
            >
              <Ionicons name="create-outline" size={20} color={colors.text.secondary} />
              <Text style={styles.addButtonSecondaryText}>Digitar manualmente</Text>
            </Pressable>
          </View>

          {/* Info Card */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={20} color={colors.info.main} />
            <Text style={styles.infoText}>
              Após adicionar, você poderá enviar o PIN de acesso para cada funcionário.
            </Text>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          {/* Progress Info */}
          <View style={styles.progressInfo}>
            <Text style={styles.progressCount}>
              {validCount} de {MIN_EMPLOYEES} funcionários
            </Text>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  { width: `${Math.min((validCount / MIN_EMPLOYEES) * 100, 100)}%` },
                  validCount >= MIN_EMPLOYEES && styles.progressBarComplete,
                ]}
              />
            </View>
          </View>

          <View style={styles.footerButtons}>
            <Pressable
              style={({ pressed }) => [
                styles.skipButton,
                pressed && styles.skipButtonPressed,
              ]}
              onPress={handleSkip}
            >
              <Text style={styles.skipButtonText}>Pular</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                !canContinue && styles.buttonDisabled,
                loading && styles.buttonDisabled,
                pressed && canContinue && !loading && styles.buttonPressed,
              ]}
              onPress={handleContinue}
              disabled={!canContinue || loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.text.inverse} />
              ) : (
                <Text style={styles.buttonText}>Continuar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.grouped,
  },
  keyboardView: {
    flex: 1,
  },
  // Progress
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.neutral[200],
  },
  progressDotActive: {
    backgroundColor: colors.primary[600],
    width: 24,
  },
  // Header
  header: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.largeTitle,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.body,
    color: colors.text.secondary,
    lineHeight: 24,
  },
  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  // Employee Card
  employeeCard: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBadgeText: {
    fontSize: fontSize.footnote,
    fontWeight: '600',
    color: colors.primary[600],
  },
  removeButton: {
    padding: spacing.xs,
  },
  removeButtonPressed: {
    opacity: 0.6,
  },
  inputGroup: {
    marginBottom: spacing.sm,
  },
  inputLabel: {
    fontSize: fontSize.footnote,
    fontWeight: '500',
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.body,
    color: colors.text.primary,
  },
  // Add Buttons
  addButtonsContainer: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  addButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primary[300],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[50],
  },
  addButtonPressed: {
    backgroundColor: colors.primary[100],
  },
  addButtonText: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.primary[600],
  },
  addButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  addButtonSecondaryPressed: {
    opacity: 0.6,
  },
  addButtonSecondaryText: {
    fontSize: fontSize.footnote,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  // Info Card
  infoCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.info.light,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: fontSize.footnote,
    color: colors.info.dark,
    lineHeight: 20,
  },
  // Footer
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background.primary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.light,
  },
  progressInfo: {
    marginBottom: spacing.md,
  },
  progressCount: {
    fontSize: fontSize.footnote,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: colors.neutral[200],
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary[400],
    borderRadius: 2,
  },
  progressBarComplete: {
    backgroundColor: colors.success.main,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  skipButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.secondary,
  },
  skipButtonPressed: {
    backgroundColor: colors.neutral[200],
  },
  skipButtonText: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  button: {
    flex: 2,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    ...shadows.md,
  },
  buttonDisabled: {
    backgroundColor: colors.neutral[300],
    shadowOpacity: 0,
  },
  buttonPressed: {
    backgroundColor: colors.primary[700],
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text.inverse,
  },
});
