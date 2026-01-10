/**
 * Employee Availability Screen
 * Apple-style availability management with calendar and chat input
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, spacing, fontSize, borderRadius, shadows } from '../../src/theme';
import { useEmployeeAuth } from '../../src/hooks';
import { api } from '../../src/services/api';

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DAYS_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

type RecurringDay = {
  available: boolean;
  startTime?: string;
  endTime?: string;
};

type TemporaryException = {
  id: string;
  startDate: string;
  endDate: string;
  type: 'unavailable' | 'available' | 'custom';
  hours?: { startTime: string; endTime: string };
  reason?: string;
};

type Availability = {
  recurringAvailability: Record<number, RecurringDay>;
  temporaryAvailability: TemporaryException[];
};

export default function AvailabilityScreen() {
  const { user, activeLink, logout } = useEmployeeAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [showRecurringEditor, setShowRecurringEditor] = useState(false);

  const fetchAvailability = useCallback(async () => {
    try {
      const result = await api.getAvailability();
      if (result.success !== false) {
        setAvailability({
          recurringAvailability: (result as any).recurringAvailability || {},
          temporaryAvailability: (result as any).temporaryAvailability || [],
        });
      }
    } catch (err) {
      console.error('Error fetching availability:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAvailability();
    setRefreshing(false);
  };

  const handleToggleDay = async (day: number) => {
    if (!availability) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const currentDay = availability.recurringAvailability[day];
    const newAvailable = !currentDay?.available;

    const newRecurring = {
      ...availability.recurringAvailability,
      [day]: { available: newAvailable },
    };

    // Optimistic update
    setAvailability(prev => prev ? { ...prev, recurringAvailability: newRecurring } : null);

    try {
      await api.updateRecurringAvailability({ [day]: { available: newAvailable } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      // Revert on error
      setAvailability(prev => prev ? {
        ...prev,
        recurringAvailability: availability.recurringAvailability,
      } : null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleRemoveException = async (id: string) => {
    Alert.alert(
      'Remover exceção',
      'Deseja remover esta exceção?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            try {
              await api.removeTemporaryAvailability(id);
              setAvailability(prev => prev ? {
                ...prev,
                temporaryAvailability: prev.temporaryAvailability.filter(t => t.id !== id),
              } : null);
            } catch (err) {
              Alert.alert('Erro', 'Não foi possível remover a exceção');
            }
          },
        },
      ]
    );
  };

  const handleChatSubmit = async () => {
    if (!chatMessage.trim()) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setChatLoading(true);

    try {
      const result = await api.chatAvailability(chatMessage);

      if ((result as any).understood) {
        Alert.alert(
          'Confirmar mudança',
          (result as any).confirmationMessage || 'Confirma essas mudanças?',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Confirmar',
              onPress: async () => {
                try {
                  await api.applyAvailabilityChanges({
                    recurringChanges: (result as any).recurringChanges,
                    temporaryChange: (result as any).temporaryChange,
                  });
                  setChatMessage('');
                  fetchAvailability();
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch (err) {
                  Alert.alert('Erro', 'Não foi possível aplicar as mudanças');
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Não entendi', (result as any).message);
      }
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível processar sua mensagem');
    } finally {
      setChatLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sair',
      'Deseja sair da sua conta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  // Generate 2-week calendar
  const getCalendarDays = () => {
    const days: Array<{ date: Date; dayOfWeek: number; isAvailable: boolean | 'partial' }> = [];
    const today = new Date();

    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dayOfWeek = date.getDay();

      // Check temporary exceptions first
      const dateStr = date.toISOString().split('T')[0];
      const exception = availability?.temporaryAvailability.find(
        t => dateStr >= t.startDate && dateStr <= t.endDate
      );

      let isAvailable: boolean | 'partial' = true;
      if (exception) {
        isAvailable = exception.type === 'available' ? true :
                      exception.type === 'custom' ? 'partial' : false;
      } else {
        isAvailable = availability?.recurringAvailability[dayOfWeek]?.available ?? true;
      }

      days.push({ date, dayOfWeek, isAvailable });
    }

    return days;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  const calendarDays = getCalendarDays();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary[600]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Olá, {user?.name?.split(' ')[0] || 'Funcionário'}</Text>
            <Text style={styles.establishmentName}>
              {activeLink?.establishmentName || 'Estabelecimento'}
            </Text>
          </View>
          <Pressable onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color={colors.text.tertiary} />
          </Pressable>
        </View>

        {/* 2-Week Calendar Preview */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
          <Text style={styles.sectionTitle}>Próximas 2 Semanas</Text>
          <View style={styles.calendarCard}>
            <View style={styles.calendarGrid}>
              {calendarDays.map((day, index) => {
                const isToday = day.date.toDateString() === new Date().toDateString();
                return (
                  <View key={index} style={styles.calendarDay}>
                    <Text style={[styles.calendarDayLabel, isToday && styles.calendarDayToday]}>
                      {DAYS_PT[day.dayOfWeek]}
                    </Text>
                    <Text style={[styles.calendarDayNumber, isToday && styles.calendarDayToday]}>
                      {day.date.getDate()}
                    </Text>
                    <View style={[
                      styles.availabilityDot,
                      day.isAvailable === true && styles.availabilityDotAvailable,
                      day.isAvailable === false && styles.availabilityDotUnavailable,
                      day.isAvailable === 'partial' && styles.availabilityDotPartial,
                    ]} />
                  </View>
                );
              })}
            </View>
            <View style={styles.calendarLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.availabilityDotAvailable]} />
                <Text style={styles.legendText}>Disponível</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.availabilityDotUnavailable]} />
                <Text style={styles.legendText}>Indisponível</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.availabilityDotPartial]} />
                <Text style={styles.legendText}>Parcial</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Recurring Availability */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
          <Text style={styles.sectionTitle}>Disponibilidade Semanal</Text>
          <View style={styles.recurringCard}>
            {DAYS_FULL.map((dayName, index) => {
              const dayData = availability?.recurringAvailability[index];
              const isAvailable = dayData?.available ?? true;

              return (
                <Pressable
                  key={index}
                  onPress={() => handleToggleDay(index)}
                  style={({ pressed }) => [
                    styles.dayRow,
                    index < 6 && styles.dayRowBorder,
                    pressed && styles.dayRowPressed,
                  ]}
                >
                  <Text style={styles.dayName}>{dayName}</Text>
                  <View style={styles.dayStatus}>
                    <Text style={[
                      styles.dayStatusText,
                      !isAvailable && styles.dayStatusTextUnavailable,
                    ]}>
                      {isAvailable ? 'Disponível' : 'Indisponível'}
                    </Text>
                    <Ionicons
                      name={isAvailable ? 'checkmark-circle' : 'close-circle'}
                      size={24}
                      color={isAvailable ? colors.success.main : colors.error.main}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Temporary Exceptions */}
        <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Exceções Temporárias</Text>
          </View>

          {availability?.temporaryAvailability.length ? (
            <View style={styles.exceptionsCard}>
              {availability.temporaryAvailability.map((exception, index) => (
                <View key={exception.id} style={[
                  styles.exceptionRow,
                  index < availability.temporaryAvailability.length - 1 && styles.exceptionRowBorder,
                ]}>
                  <View style={styles.exceptionInfo}>
                    <Text style={styles.exceptionDates}>
                      {formatDateRange(exception.startDate, exception.endDate)}
                    </Text>
                    <Text style={styles.exceptionType}>
                      {exception.type === 'unavailable' ? 'Indisponível' :
                       exception.type === 'custom' && exception.hours
                         ? `${exception.hours.startTime} - ${exception.hours.endTime}`
                         : 'Disponível'}
                      {exception.reason ? ` (${exception.reason})` : ''}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleRemoveException(exception.id)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.error.main} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Nenhuma exceção cadastrada</Text>
            </View>
          )}
        </Animated.View>

        {/* Chat Input */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Ou diga o que você precisa</Text>
          <View style={styles.chatCard}>
            <TextInput
              style={styles.chatInput}
              placeholder="Ex: Não posso trabalhar nas terças..."
              placeholderTextColor={colors.text.quaternary}
              value={chatMessage}
              onChangeText={setChatMessage}
              multiline
              maxLength={500}
            />
            <Pressable
              onPress={handleChatSubmit}
              disabled={!chatMessage.trim() || chatLoading}
              style={({ pressed }) => [
                styles.chatButton,
                (!chatMessage.trim() || chatLoading) && styles.chatButtonDisabled,
                pressed && styles.chatButtonPressed,
              ]}
            >
              {chatLoading ? (
                <ActivityIndicator size="small" color={colors.text.inverse} />
              ) : (
                <Ionicons name="send" size={20} color={colors.text.inverse} />
              )}
            </Pressable>
          </View>
        </Animated.View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');

  const formatDate = (d: Date) => {
    const day = d.getDate();
    const month = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    return `${day} ${month}`;
  };

  if (startDate === endDate) {
    return formatDate(start);
  }

  return `${formatDate(start)} - ${formatDate(end)}`;
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
    backgroundColor: colors.background.grouped,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  header: {
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: fontSize.subhead,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  establishmentName: {
    fontSize: fontSize.title1,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  logoutButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: fontSize.footnote,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  // Calendar
  calendarCard: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  calendarDayLabel: {
    fontSize: fontSize.caption2,
    color: colors.text.tertiary,
    fontWeight: '500',
  },
  calendarDayNumber: {
    fontSize: fontSize.subhead,
    color: colors.text.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  calendarDayToday: {
    color: colors.primary[600],
  },
  availabilityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    backgroundColor: colors.neutral[300],
  },
  availabilityDotAvailable: {
    backgroundColor: colors.success.main,
  },
  availabilityDotUnavailable: {
    backgroundColor: colors.error.main,
  },
  availabilityDotPartial: {
    backgroundColor: colors.warning.main,
  },
  calendarLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.light,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: fontSize.caption1,
    color: colors.text.tertiary,
  },
  // Recurring
  recurringCard: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
    overflow: 'hidden',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  dayRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
  },
  dayRowPressed: {
    backgroundColor: colors.overlay.light,
  },
  dayName: {
    fontSize: fontSize.body,
    color: colors.text.primary,
    fontWeight: '500',
  },
  dayStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dayStatusText: {
    fontSize: fontSize.subhead,
    color: colors.success.main,
    fontWeight: '500',
  },
  dayStatusTextUnavailable: {
    color: colors.error.main,
  },
  // Exceptions
  exceptionsCard: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
    overflow: 'hidden',
  },
  exceptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  exceptionRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
  },
  exceptionInfo: {
    flex: 1,
  },
  exceptionDates: {
    fontSize: fontSize.body,
    color: colors.text.primary,
    fontWeight: '500',
  },
  exceptionType: {
    fontSize: fontSize.footnote,
    color: colors.text.secondary,
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSize.subhead,
    color: colors.text.tertiary,
  },
  // Chat
  chatCard: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    ...shadows.sm,
  },
  chatInput: {
    flex: 1,
    fontSize: fontSize.body,
    color: colors.text.primary,
    minHeight: 44,
    maxHeight: 100,
    paddingVertical: spacing.sm,
  },
  chatButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  chatButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.95 }],
  },
});
