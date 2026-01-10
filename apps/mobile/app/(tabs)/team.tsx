import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Contacts from 'expo-contacts';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { colors, spacing, fontSize, borderRadius, shadows } from '../../src/theme';
import { useEstablishment } from '../../src/hooks/useEstablishment';
import { Employee } from '../../src/services/api';

export default function TeamScreen() {
  const { employees, loading, addEmployee, updateEmployee, removeEmployee, refreshEmployees } = useEstablishment();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const resetForm = useCallback(() => {
    setName('');
    setPhone('');
    setEditingEmployee(null);
  }, []);

  const normalizePhone = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    // Remove country code if present
    if (digits.startsWith('55') && digits.length > 11) {
      return digits.slice(2);
    }
    return digits.slice(0, 11);
  };

  const pickContact = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permissão necessária',
          'Precisamos acessar seus contatos para adicionar funcionários.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Digitar manualmente', onPress: openManualModal },
          ]
        );
        return;
      }

      const contact = await Contacts.presentContactPickerAsync();

      if (contact) {
        const contactName = contact.name ||
          [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
          'Sem nome';
        const phoneNumber = contact.phoneNumbers?.[0]?.number || '';

        if (!phoneNumber) {
          Alert.alert(
            'Sem telefone',
            `${contactName} não tem telefone cadastrado. Deseja digitar manualmente?`,
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Digitar',
                onPress: () => {
                  setName(contactName);
                  setPhone('');
                  setModalVisible(true);
                }
              },
            ]
          );
          return;
        }

        const normalizedPhone = normalizePhone(phoneNumber);

        // Check for duplicate
        const isDuplicate = employees.some(
          (e) => normalizePhone(e.phone) === normalizedPhone
        );

        if (isDuplicate) {
          Alert.alert(
            'Telefone duplicado',
            'Este número já está cadastrado na sua equipe.'
          );
          return;
        }

        // Add employee directly
        setSaving(true);
        const result = await addEmployee(contactName.trim(), normalizedPhone);
        setSaving(false);

        if (result.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('Erro', result.error || 'Não foi possível adicionar');
        }
      }
    } catch (error) {
      console.error('Error picking contact:', error);
      Alert.alert('Erro', 'Não foi possível acessar os contatos.');
    }
  }, [employees, addEmployee]);

  const openManualModal = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    resetForm();
    setModalVisible(true);
  }, [resetForm]);

  const openAddModal = useCallback(() => {
    // Primary action: open contact picker
    pickContact();
  }, [pickContact]);

  const openEditModal = useCallback((employee: Employee) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingEmployee(employee);
    setName(employee.name);
    setPhone(employee.phone);
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalVisible(false);
    setTimeout(resetForm, 300);
  }, [resetForm]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Erro', 'Digite o nome do funcionário');
      return;
    }

    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Erro', 'Digite um telefone válido');
      return;
    }

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const formattedPhone = phone.replace(/\D/g, '');
      let result;

      if (editingEmployee) {
        result = await updateEmployee(editingEmployee.id, {
          name: name.trim(),
          phone: formattedPhone,
        });
      } else {
        result = await addEmployee(name.trim(), formattedPhone);
      }

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        closeModal();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Erro', result.error || 'Não foi possível salvar');
      }
    } finally {
      setSaving(false);
    }
  }, [name, phone, editingEmployee, updateEmployee, addEmployee, closeModal]);

  const handleRemove = useCallback((employee: Employee) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Remover Funcionário',
      `Tem certeza que deseja remover ${employee.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            const result = await removeEmployee(employee.id);
            if (!result.success) {
              Alert.alert('Erro', result.error || 'Não foi possível remover');
            }
          },
        },
      ]
    );
  }, [removeEmployee]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshEmployees();
    setRefreshing(false);
  }, [refreshEmployees]);

  const formatPhoneDisplay = useCallback((value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  }, []);

  const getStatusConfig = useCallback((status: string) => {
    switch (status) {
      case 'active':
        return { color: colors.success.main, label: 'Ativo' };
      case 'inactive':
        return { color: colors.text.quaternary, label: 'Inativo' };
      case 'pending':
        return { color: colors.warning.main, label: 'Pendente' };
      default:
        return { color: colors.text.quaternary, label: status };
    }
  }, []);

  // Get availability status for display
  const getAvailabilityStatus = useCallback((employee: Employee) => {
    const emp = employee as any;
    const hasRecurring = emp.recurringAvailability && Object.keys(emp.recurringAvailability).length > 0;
    const hasTemporary = emp.temporaryAvailability && emp.temporaryAvailability.length > 0;
    const hasRestrictions = hasRecurring || hasTemporary;

    // Check if any day is marked as unavailable
    const hasUnavailableDays = hasRecurring && Object.values(emp.recurringAvailability).some(
      (day: any) => day?.available === false
    );

    if (!hasRestrictions) {
      return { icon: 'calendar-outline' as const, color: colors.text.quaternary, label: 'Sem restrições' };
    }
    if (hasUnavailableDays || hasTemporary) {
      return { icon: 'calendar' as const, color: colors.warning.main, label: 'Tem restrições' };
    }
    return { icon: 'calendar-outline' as const, color: colors.success.main, label: 'Disponível' };
  }, []);

  const renderEmployee = useCallback(({ item }: { item: Employee }) => {
    const status = getStatusConfig(item.status);
    const availability = getAvailabilityStatus(item);
    return (
      <Pressable
        style={({ pressed }) => [
          styles.employeeCard,
          pressed && styles.employeeCardPressed,
        ]}
        onPress={() => openEditModal(item)}
      >
        <View style={styles.employeeAvatar}>
          <Text style={styles.employeeInitial}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.employeeInfo}>
          <Text style={styles.employeeName}>{item.name}</Text>
          <View style={styles.employeeMetaRow}>
            <Text style={styles.employeePhone}>{formatPhoneDisplay(item.phone)}</Text>
            <View style={styles.availabilityBadge}>
              <Ionicons name={availability.icon} size={12} color={availability.color} />
            </View>
          </View>
        </View>
        <View style={styles.employeeRight}>
          <View style={[styles.statusDot, { backgroundColor: status.color }]} />
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleRemove(item)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="trash-outline" size={18} color={colors.error.main} />
          </TouchableOpacity>
        </View>
      </Pressable>
    );
  }, [getStatusConfig, getAvailabilityStatus, openEditModal, formatPhoneDisplay, handleRemove]);

  const renderEmptyList = useCallback(() => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="people" size={56} color={colors.text.quaternary} />
      </View>
      <Text style={styles.emptyTitle}>Nenhum funcionário</Text>
      <Text style={styles.emptySubtitle}>
        Adicione sua equipe para começar a criar escalas automáticas
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={pickContact}
        activeOpacity={0.8}
      >
        <Ionicons name="person-add" size={20} color={colors.text.inverse} />
        <Text style={styles.emptyButtonText}>Selecionar dos Contatos</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.emptySecondaryButton}
        onPress={openManualModal}
        activeOpacity={0.8}
      >
        <Ionicons name="create-outline" size={18} color={colors.primary[600]} />
        <Text style={styles.emptySecondaryButtonText}>Digitar manualmente</Text>
      </TouchableOpacity>
    </View>
  ), [pickContact, openManualModal]);

  if (loading && employees.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Equipe</Text>
        <Text style={styles.subtitle}>
          {employees.length} {employees.length === 1 ? 'pessoa' : 'pessoas'}
        </Text>
      </View>

      {/* List */}
      <FlatList
        data={employees}
        keyExtractor={(item) => item.id}
        renderItem={renderEmployee}
        contentContainerStyle={[
          styles.list,
          employees.length === 0 && styles.listEmpty,
        ]}
        ListEmptyComponent={renderEmptyList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary[600]}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      {employees.length > 0 && (
        <Pressable
          style={({ pressed }) => [
            styles.fab,
            pressed && styles.fabPressed,
          ]}
          onPress={openAddModal}
        >
          <Ionicons name="add" size={28} color={colors.text.inverse} />
        </Pressable>
      )}

      {/* Modal */}
      {modalVisible && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={styles.modalOverlay}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalKeyboard}
          >
            <Animated.View
              entering={SlideInDown.springify().damping(20)}
              exiting={SlideOutDown.duration(200)}
              style={styles.modalContent}
            >
              {/* Handle */}
              <View style={styles.modalHandle} />

              {/* Header */}
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={closeModal} style={styles.modalCancelButton}>
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>
                  {editingEmployee ? 'Editar' : 'Novo Funcionário'}
                </Text>
                <TouchableOpacity
                  onPress={handleSave}
                  style={styles.modalSaveButton}
                  disabled={saving || !name.trim() || !phone.trim()}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.primary[600]} />
                  ) : (
                    <Text style={[
                      styles.modalSaveText,
                      (!name.trim() || !phone.trim()) && styles.modalSaveTextDisabled,
                    ]}>
                      {editingEmployee ? 'Salvar' : 'Adicionar'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Form */}
              <View style={styles.modalForm}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Nome</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nome completo"
                    placeholderTextColor={colors.text.quaternary}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    autoFocus
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>WhatsApp</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="(11) 99999-9999"
                    placeholderTextColor={colors.text.quaternary}
                    value={formatPhoneDisplay(phone)}
                    onChangeText={(text) => setPhone(text.replace(/\D/g, ''))}
                    keyboardType="phone-pad"
                    maxLength={15}
                    returnKeyType="done"
                    onSubmitEditing={handleSave}
                  />
                </View>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.grouped,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Header
  header: {
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.largeTitle,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: fontSize.subhead,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  // List
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 120,
  },
  listEmpty: {
    flex: 1,
  },
  // Employee Card
  employeeCard: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  employeeCardPressed: {
    opacity: 0.9,
  },
  employeeAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  employeeInitial: {
    fontSize: fontSize.title3,
    fontWeight: '600',
    color: colors.primary[600],
  },
  employeeInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  employeeName: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text.primary,
  },
  employeePhone: {
    fontSize: fontSize.subhead,
    color: colors.text.secondary,
  },
  employeeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xxs,
  },
  availabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  employeeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  deleteButton: {
    padding: spacing.xs,
  },
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: fontSize.title2,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: fontSize.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    ...shadows.md,
  },
  emptyButtonText: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  emptySecondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  emptySecondaryButtonText: {
    fontSize: fontSize.subhead,
    color: colors.primary[600],
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 100,
    right: spacing.md,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  fabPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.9,
  },
  // Modal
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'flex-end',
  },
  modalKeyboard: {
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.elevated,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: spacing.xxl,
  },
  modalHandle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.neutral[300],
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
  },
  modalCancelButton: {
    minWidth: 70,
  },
  modalCancelText: {
    fontSize: fontSize.body,
    color: colors.text.link,
  },
  modalTitle: {
    fontSize: fontSize.headline,
    fontWeight: '600',
    color: colors.text.primary,
  },
  modalSaveButton: {
    minWidth: 70,
    alignItems: 'flex-end',
  },
  modalSaveText: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text.link,
  },
  modalSaveTextDisabled: {
    color: colors.text.quaternary,
  },
  modalForm: {
    padding: spacing.md,
    gap: spacing.md,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  inputLabel: {
    fontSize: fontSize.subhead,
    fontWeight: '500',
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  input: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.body,
    color: colors.text.primary,
  },
});
