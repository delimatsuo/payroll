import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Pressable,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors, spacing, fontSize, borderRadius, shadows } from '../../src/theme';
import { useOnboarding } from '../../src/hooks';

const DAYS = [
  { id: 0, name: 'Domingo', short: 'Dom' },
  { id: 1, name: 'Segunda-feira', short: 'Seg' },
  { id: 2, name: 'Terça-feira', short: 'Ter' },
  { id: 3, name: 'Quarta-feira', short: 'Qua' },
  { id: 4, name: 'Quinta-feira', short: 'Qui' },
  { id: 5, name: 'Sexta-feira', short: 'Sex' },
  { id: 6, name: 'Sábado', short: 'Sáb' },
];

// Helper functions for time conversion
function parseTimeString(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function formatTimeToString(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function isOvernightHours(openTime: string, closeTime: string): boolean {
  const [openHour] = openTime.split(':').map(Number);
  const [closeHour] = closeTime.split(':').map(Number);
  return closeHour < openHour;
}

export default function OnboardingHoursScreen() {
  const router = useRouter();
  const { state, setOperatingHours, saveOperatingHours } = useOnboarding();
  const [loading, setLoading] = useState(false);

  // Time picker modal state
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<'openTime' | 'closeTime'>('openTime');
  const [tempOpenTime, setTempOpenTime] = useState('10:00');
  const [tempCloseTime, setTempCloseTime] = useState('22:00');

  const toggleDay = (dayId: number) => {
    Haptics.selectionAsync();
    const newHours = { ...state.operatingHours };
    newHours[dayId] = {
      ...newHours[dayId],
      isOpen: !newHours[dayId].isOpen,
    };
    setOperatingHours(newHours);
  };

  const handleTimePress = (dayId: number) => {
    Haptics.selectionAsync();
    const dayHours = state.operatingHours[dayId];
    setEditingDay(dayId);
    setTempOpenTime(dayHours.openTime || '10:00');
    setTempCloseTime(dayHours.closeTime || '22:00');
    setEditingField('openTime');
    setTimePickerVisible(true);
  };

  const handleTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (event.type === 'set' && selectedDate) {
      const timeString = formatTimeToString(selectedDate);
      if (editingField === 'openTime') {
        setTempOpenTime(timeString);
      } else {
        setTempCloseTime(timeString);
      }
    }
  };

  const handleSaveTime = () => {
    if (editingDay === null) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const newHours = { ...state.operatingHours };
    newHours[editingDay] = {
      ...newHours[editingDay],
      openTime: tempOpenTime,
      closeTime: tempCloseTime,
    };
    setOperatingHours(newHours);
    setTimePickerVisible(false);
    setEditingDay(null);
  };

  const handleCancelTime = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimePickerVisible(false);
    setEditingDay(null);
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleContinue = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    try {
      const result = await saveOperatingHours();

      if (result.success) {
        router.push('/(onboarding)/settings');
      } else {
        Alert.alert('Erro', result.error || 'Não foi possível salvar os horários');
      }
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  const openDays = Object.values(state.operatingHours).filter((h) => h.isOpen).length;
  const canContinue = openDays > 0;
  const editingDayName = editingDay !== null ? DAYS[editingDay].name : '';
  const showOvernightNote = isOvernightHours(tempOpenTime, tempCloseTime);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Progress Indicator - Step 2 of 5 */}
      <View style={styles.progress}>
        <View style={styles.progressDot} />
        <View style={[styles.progressDot, styles.progressDotActive]} />
        <View style={styles.progressDot} />
        <View style={styles.progressDot} />
        <View style={styles.progressDot} />
      </View>

      {/* Back Button */}
      <Pressable
        style={({ pressed }) => [
          styles.backButton,
          pressed && styles.backButtonPressed,
        ]}
        onPress={handleBack}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="chevron-back" size={28} color={colors.primary[600]} />
      </Pressable>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Dias de funcionamento</Text>
        <Text style={styles.subtitle}>
          Selecione os dias e ajuste os horários de funcionamento
        </Text>
      </View>

      {/* Days List */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          {DAYS.map((day, index) => {
            const dayHours = state.operatingHours[day.id];
            const isOpen = dayHours?.isOpen;
            const openTime = dayHours?.openTime || '10:00';
            const closeTime = dayHours?.closeTime || '22:00';
            const overnight = isOpen && isOvernightHours(openTime, closeTime);

            return (
              <View key={day.id}>
                {index > 0 && <View style={styles.separator} />}
                <View style={styles.dayRow}>
                  {/* Checkbox Area - Toggle Day */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.checkboxArea,
                      pressed && styles.dayRowPressed,
                    ]}
                    onPress={() => toggleDay(day.id)}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        isOpen && styles.checkboxActive,
                      ]}
                    >
                      {isOpen && (
                        <Ionicons name="checkmark" size={16} color="#FFF" />
                      )}
                    </View>
                    <View>
                      <Text
                        style={[
                          styles.dayName,
                          !isOpen && styles.dayNameInactive,
                        ]}
                      >
                        {day.name}
                      </Text>
                      {overnight && (
                        <Text style={styles.overnightBadge}>Fecha no dia seguinte</Text>
                      )}
                    </View>
                  </Pressable>

                  {/* Hours Area - Open Time Picker */}
                  {isOpen && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.hoursArea,
                        pressed && styles.hoursAreaPressed,
                      ]}
                      onPress={() => handleTimePress(day.id)}
                    >
                      <Text style={styles.dayHours}>
                        {openTime} – {closeTime}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.text.quaternary} />
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="time-outline" size={20} color={colors.info.main} />
          <Text style={styles.infoText}>
            Toque nos horários para ajustar. Horários noturnos (ex: 18h às 2h) são suportados.
          </Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.selectedInfo}>
          <Text style={styles.selectedText}>
            {openDays} {openDays === 1 ? 'dia selecionado' : 'dias selecionados'}
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            (!canContinue || loading) && styles.buttonDisabled,
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

      {/* Time Picker Modal */}
      <Modal
        visible={timePickerVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCancelTime}
      >
        <Pressable style={styles.modalOverlay} onPress={handleCancelTime}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            {/* Modal Handle */}
            <View style={styles.modalHandle} />

            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalHeaderButton,
                  pressed && styles.modalHeaderButtonPressed,
                ]}
                onPress={handleCancelTime}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Text style={styles.modalTitle}>{editingDayName}</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.modalHeaderButton,
                  pressed && styles.modalHeaderButtonPressed,
                ]}
                onPress={handleSaveTime}
              >
                <Text style={styles.modalDoneText}>Concluir</Text>
              </Pressable>
            </View>

            {/* Time Type Selector */}
            <View style={styles.timeTypeSelector}>
              <Pressable
                style={[
                  styles.timeTypeButton,
                  editingField === 'openTime' && styles.timeTypeButtonActive,
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setEditingField('openTime');
                }}
              >
                <Text
                  style={[
                    styles.timeTypeText,
                    editingField === 'openTime' && styles.timeTypeTextActive,
                  ]}
                >
                  Abertura
                </Text>
                <Text
                  style={[
                    styles.timeTypeValue,
                    editingField === 'openTime' && styles.timeTypeValueActive,
                  ]}
                >
                  {tempOpenTime}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.timeTypeButton,
                  editingField === 'closeTime' && styles.timeTypeButtonActive,
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setEditingField('closeTime');
                }}
              >
                <Text
                  style={[
                    styles.timeTypeText,
                    editingField === 'closeTime' && styles.timeTypeTextActive,
                  ]}
                >
                  Fechamento
                </Text>
                <Text
                  style={[
                    styles.timeTypeValue,
                    editingField === 'closeTime' && styles.timeTypeValueActive,
                  ]}
                >
                  {tempCloseTime}
                </Text>
              </Pressable>
            </View>

            {/* Overnight Note */}
            {showOvernightNote && (
              <View style={styles.overnightNote}>
                <Ionicons name="moon-outline" size={16} color={colors.warning.main} />
                <Text style={styles.overnightNoteText}>Fecha no dia seguinte</Text>
              </View>
            )}

            {/* Time Picker */}
            <View style={styles.pickerContainer}>
              <DateTimePicker
                value={parseTimeString(editingField === 'openTime' ? tempOpenTime : tempCloseTime)}
                mode="time"
                display="spinner"
                onChange={handleTimeChange}
                is24Hour={true}
                locale="pt-BR"
                style={styles.picker}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.grouped,
  },
  // Progress
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
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
  // Back Button
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  backButtonPressed: {
    opacity: 0.6,
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
  // Content
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  // Card
  card: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
    overflow: 'hidden',
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 56,
  },
  dayRowPressed: {
    backgroundColor: colors.overlay.light,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.light,
    marginLeft: spacing.md + 24 + spacing.md,
  },
  // Checkbox Area
  checkboxArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  dayName: {
    fontSize: fontSize.body,
    color: colors.text.primary,
    fontWeight: '500',
  },
  dayNameInactive: {
    color: colors.text.tertiary,
  },
  overnightBadge: {
    fontSize: fontSize.caption1,
    color: colors.warning.main,
    marginTop: 2,
  },
  // Hours Area
  hoursArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
    paddingLeft: spacing.sm,
  },
  hoursAreaPressed: {
    opacity: 0.6,
  },
  dayHours: {
    fontSize: fontSize.subhead,
    color: colors.text.secondary,
  },
  // Info Card
  infoCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.info.light,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
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
    paddingBottom: spacing.xl,
    backgroundColor: colors.background.primary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.light,
  },
  selectedInfo: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  selectedText: {
    fontSize: fontSize.footnote,
    color: colors.text.secondary,
  },
  button: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    height: 52,
    justifyContent: 'center',
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
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.elevated,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: spacing.xl,
  },
  modalHandle: {
    width: 36,
    height: 5,
    backgroundColor: colors.neutral[300],
    borderRadius: 3,
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
  modalHeaderButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    minWidth: 70,
  },
  modalHeaderButtonPressed: {
    opacity: 0.6,
  },
  modalTitle: {
    fontSize: fontSize.headline,
    fontWeight: '600',
    color: colors.text.primary,
  },
  modalCancelText: {
    fontSize: fontSize.body,
    color: colors.text.secondary,
  },
  modalDoneText: {
    fontSize: fontSize.body,
    color: colors.primary[600],
    fontWeight: '600',
    textAlign: 'right',
  },
  // Time Type Selector
  timeTypeSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  timeTypeButton: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  timeTypeButtonActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[600],
  },
  timeTypeText: {
    fontSize: fontSize.footnote,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  timeTypeTextActive: {
    color: colors.primary[600],
  },
  timeTypeValue: {
    fontSize: fontSize.title2,
    fontWeight: '600',
    color: colors.text.primary,
  },
  timeTypeValueActive: {
    color: colors.primary[600],
  },
  // Overnight Note
  overnightNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: colors.warning.light,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  overnightNoteText: {
    fontSize: fontSize.footnote,
    color: colors.warning.dark,
  },
  // Picker
  pickerContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  picker: {
    width: '100%',
    height: 200,
  },
});
