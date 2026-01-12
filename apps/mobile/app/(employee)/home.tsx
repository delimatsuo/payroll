/**
 * Employee Home Screen
 * Main dashboard showing next shift, weekly overview, and quick access to availability
 * Design inspired by Apple HIG: glanceable, focused, contextual
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, spacing, fontSize, borderRadius, shadows } from '../../src/theme';
import { useEmployeeAuth } from '../../src/hooks';
import { api } from '../../src/services/api';

const DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DAYS_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

type ShiftType = 'morning' | 'afternoon' | 'night' | 'custom';

type EmployeeShift = {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  shiftType: ShiftType;
  shiftLabel: string;
};

type Availability = {
  recurringAvailability: Record<number, { available: boolean; startTime?: string; endTime?: string }>;
  temporaryAvailability: Array<{
    id: string;
    startDate: string;
    endDate: string;
    type: 'unavailable' | 'available' | 'custom';
    reason?: string;
  }>;
};

// Shift type visual config
const SHIFT_CONFIG: Record<ShiftType, { icon: string; color: string; bgColor: string }> = {
  morning: { icon: 'sunny', color: '#92400E', bgColor: '#FEF3C7' },
  afternoon: { icon: 'partly-sunny', color: '#1E40AF', bgColor: '#DBEAFE' },
  night: { icon: 'moon', color: '#5B21B6', bgColor: '#EDE9FE' },
  custom: { icon: 'time', color: '#374151', bgColor: '#F3F4F6' },
};

export default function EmployeeHomeScreen() {
  const router = useRouter();
  const { user, activeLink, logout } = useEmployeeAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shifts, setShifts] = useState<EmployeeShift[]>([]);
  const [availability, setAvailability] = useState<Availability | null>(null);

  // Fetch employee data
  const fetchData = useCallback(async () => {
    try {
      // Fetch availability
      const availResult = await api.getAvailability();
      if (availResult.success !== false) {
        setAvailability({
          recurringAvailability: (availResult as any).recurringAvailability || {},
          temporaryAvailability: (availResult as any).temporaryAvailability || [],
        });
      }

      // Fetch actual shifts from API
      const scheduleResult = await api.getEmployeeUpcomingShifts(14);
      if (scheduleResult.success !== false && scheduleResult.shifts) {
        const mappedShifts: EmployeeShift[] = scheduleResult.shifts.map((shift) => ({
          id: shift.id,
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          shiftType: (shift.shiftType as ShiftType) || 'custom',
          shiftLabel: shift.shiftLabel || getShiftLabel(shift.startTime),
        }));
        setShifts(mappedShifts);
      } else {
        // No shifts found - show empty state
        setShifts([]);
      }
    } catch (err) {
      console.error('Error fetching employee data:', err);
      // Fall back to empty state on error
      setShifts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // Get current date info
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();

  // Find today's shift and next shift
  const { todayShift, nextShift, shiftStatus } = useMemo(() => {
    const todayShiftData = shifts.find((s) => s.date === today);

    // Find next upcoming shift
    const upcomingShifts = shifts
      .filter((s) => s.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

    const nextShiftData = upcomingShifts[0];

    // Determine shift status
    let status: 'none' | 'upcoming' | 'working' | 'finished' = 'none';

    if (todayShiftData) {
      const [startH, startM] = todayShiftData.startTime.split(':').map(Number);
      const [endH, endM] = todayShiftData.endTime.split(':').map(Number);
      const currentTotalMinutes = currentHour * 60 + currentMinutes;
      const startTotalMinutes = startH * 60 + startM;
      let endTotalMinutes = endH * 60 + endM;

      // Handle overnight shifts
      if (endTotalMinutes < startTotalMinutes) {
        endTotalMinutes += 24 * 60;
      }

      if (currentTotalMinutes >= startTotalMinutes && currentTotalMinutes < endTotalMinutes) {
        status = 'working';
      } else if (currentTotalMinutes < startTotalMinutes) {
        status = 'upcoming';
      } else {
        status = 'finished';
      }
    }

    return { todayShift: todayShiftData, nextShift: nextShiftData, shiftStatus: status };
  }, [shifts, today, currentHour, currentMinutes]);

  // Get week dates starting from today
  const weekDates = useMemo(() => {
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, []);

  // Count total shifts and hours this week
  const weekStats = useMemo(() => {
    const weekShifts = shifts.filter((s) => {
      const shiftDate = new Date(s.date);
      return shiftDate >= weekDates[0] && shiftDate <= weekDates[6];
    });

    let totalHours = 0;
    weekShifts.forEach((s) => {
      const [startH, startM] = s.startTime.split(':').map(Number);
      const [endH, endM] = s.endTime.split(':').map(Number);
      let hours = endH - startH + (endM - startM) / 60;
      if (hours < 0) hours += 24; // Overnight shift
      totalHours += hours;
    });

    return { count: weekShifts.length, hours: Math.round(totalHours) };
  }, [shifts, weekDates]);

  // Get availability summary
  const availabilitySummary = useMemo(() => {
    if (!availability) return null;

    const unavailableDays: string[] = [];
    const tempExceptions: string[] = [];

    // Check recurring
    Object.entries(availability.recurringAvailability).forEach(([day, data]) => {
      if (data && !data.available) {
        unavailableDays.push(DAYS_FULL[parseInt(day)] + 's');
      }
    });

    // Check temporary
    availability.temporaryAvailability.forEach((temp) => {
      if (temp.type === 'unavailable') {
        const start = new Date(temp.startDate + 'T12:00:00');
        const end = new Date(temp.endDate + 'T12:00:00');
        const label = temp.reason || formatDateRange(start, end);
        tempExceptions.push(label);
      }
    });

    return { unavailableDays, tempExceptions };
  }, [availability]);

  const navigateToAvailability = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(employee)/availability' as Href);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

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
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>
              Olá, {user?.name?.split(' ')[0] || 'Funcionário'}
            </Text>
            <Text style={styles.establishmentName}>
              {activeLink?.establishmentName || 'Estabelecimento'}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.profileButton,
              pressed && styles.profileButtonPressed,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              logout();
            }}
          >
            <Ionicons name="person-circle-outline" size={32} color={colors.text.tertiary} />
          </Pressable>
        </View>

        {/* Next/Current Shift Card */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
          {renderShiftCard()}
        </Animated.View>

        {/* Week Overview */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
          <Text style={styles.sectionTitle}>MEUS TURNOS ESTA SEMANA</Text>
          <View style={styles.weekCard}>
            <View style={styles.weekGrid}>
              {weekDates.map((date, idx) => {
                const dateStr = date.toISOString().split('T')[0];
                const dayShift = shifts.find((s) => s.date === dateStr);
                const isToday = dateStr === today;
                const config = dayShift ? SHIFT_CONFIG[dayShift.shiftType] : null;

                return (
                  <View key={idx} style={styles.weekDay}>
                    <Text style={[styles.weekDayLabel, isToday && styles.weekDayLabelToday]}>
                      {DAYS_SHORT[date.getDay()]}
                    </Text>
                    <Text style={[styles.weekDayNumber, isToday && styles.weekDayNumberToday]}>
                      {date.getDate()}
                    </Text>
                    {dayShift ? (
                      <View style={[styles.weekDayShift, { backgroundColor: config?.bgColor }]}>
                        <Ionicons
                          name={config?.icon as any}
                          size={14}
                          color={config?.color}
                        />
                        <Text style={[styles.weekDayTime, { color: config?.color }]}>
                          {dayShift.startTime.slice(0, 5)}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.weekDayOff}>
                        <Text style={styles.weekDayOffText}>-</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
            <View style={styles.weekStats}>
              <Text style={styles.weekStatsText}>
                {weekStats.count} turno{weekStats.count !== 1 ? 's' : ''} · {weekStats.hours} horas
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Availability Card */}
        <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
          <Pressable
            style={({ pressed }) => [
              styles.availabilityCard,
              pressed && styles.availabilityCardPressed,
            ]}
            onPress={navigateToAvailability}
          >
            <View style={styles.availabilityHeader}>
              <View style={styles.availabilityIcon}>
                <Ionicons name="calendar" size={20} color={colors.primary[600]} />
              </View>
              <Text style={styles.availabilityTitle}>Minha Disponibilidade</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.text.quaternary} />
            </View>

            {availabilitySummary && (
              <View style={styles.availabilitySummary}>
                {availabilitySummary.unavailableDays.length > 0 && (
                  <View style={styles.availabilityItem}>
                    <Ionicons name="close-circle" size={14} color={colors.warning.main} />
                    <Text style={styles.availabilityItemText}>
                      Indisponível: {availabilitySummary.unavailableDays.join(', ')}
                    </Text>
                  </View>
                )}
                {availabilitySummary.tempExceptions.map((exc, idx) => (
                  <View key={idx} style={styles.availabilityItem}>
                    <Ionicons name="calendar-outline" size={14} color={colors.info.main} />
                    <Text style={styles.availabilityItemText}>{exc}</Text>
                  </View>
                ))}
                {availabilitySummary.unavailableDays.length === 0 &&
                  availabilitySummary.tempExceptions.length === 0 && (
                    <View style={styles.availabilityItem}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.success.main} />
                      <Text style={styles.availabilityItemText}>
                        Disponível todos os dias
                      </Text>
                    </View>
                  )}
              </View>
            )}
          </Pressable>
        </Animated.View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );

  // Render the main shift card based on status
  function renderShiftCard() {
    // No shifts at all
    if (shifts.length === 0) {
      return (
        <View style={styles.shiftCardEmpty}>
          <View style={styles.shiftCardEmptyIcon}>
            <Ionicons name="calendar-outline" size={40} color={colors.text.quaternary} />
          </View>
          <Text style={styles.shiftCardEmptyTitle}>Aguardando Escala</Text>
          <Text style={styles.shiftCardEmptySubtitle}>
            A escala ainda não foi publicada.{'\n'}
            Atualize sua disponibilidade para ajudar!
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.shiftCardEmptyButton,
              pressed && styles.shiftCardEmptyButtonPressed,
            ]}
            onPress={navigateToAvailability}
          >
            <Ionicons name="calendar" size={18} color={colors.text.inverse} />
            <Text style={styles.shiftCardEmptyButtonText}>Atualizar Disponibilidade</Text>
          </Pressable>
        </View>
      );
    }

    // Currently working
    if (shiftStatus === 'working' && todayShift) {
      const config = SHIFT_CONFIG[todayShift.shiftType];
      const progress = calculateShiftProgress(todayShift);
      const remaining = calculateTimeRemaining(todayShift);

      return (
        <View style={[styles.shiftCard, { backgroundColor: config.bgColor }]}>
          <View style={styles.shiftCardBadge}>
            <View style={[styles.shiftCardBadgeDot, { backgroundColor: colors.success.main }]} />
            <Text style={[styles.shiftCardBadgeText, { color: config.color }]}>AGORA</Text>
          </View>

          <View style={styles.shiftCardContent}>
            <Ionicons name={config.icon as any} size={28} color={config.color} />
            <View style={styles.shiftCardInfo}>
              <Text style={[styles.shiftCardLabel, { color: config.color }]}>
                Você está trabalhando
              </Text>
              <Text style={[styles.shiftCardTime, { color: config.color }]}>
                {todayShift.startTime} - {todayShift.endTime}
              </Text>
              <Text style={[styles.shiftCardType, { color: config.color }]}>
                {todayShift.shiftLabel}
              </Text>
            </View>
          </View>

          <View style={styles.shiftProgress}>
            <View style={styles.shiftProgressBar}>
              <View
                style={[
                  styles.shiftProgressFill,
                  { width: `${progress}%`, backgroundColor: config.color },
                ]}
              />
            </View>
            <Text style={[styles.shiftProgressText, { color: config.color }]}>
              {Math.round(progress)}% · Termina em {remaining}
            </Text>
          </View>
        </View>
      );
    }

    // Day off today
    if (!todayShift && nextShift) {
      const nextDate = new Date(nextShift.date + 'T12:00:00');
      const config = SHIFT_CONFIG[nextShift.shiftType];

      return (
        <View style={styles.shiftCardDayOff}>
          <View style={styles.dayOffHeader}>
            <Text style={styles.dayOffEmoji}>😌</Text>
            <Text style={styles.dayOffTitle}>Você está de folga hoje</Text>
          </View>

          <View style={styles.nextShiftPreview}>
            <Text style={styles.nextShiftPreviewLabel}>PRÓXIMO TURNO</Text>
            <View style={[styles.nextShiftCard, { backgroundColor: config.bgColor }]}>
              <Ionicons name={config.icon as any} size={20} color={config.color} />
              <View style={styles.nextShiftInfo}>
                <Text style={[styles.nextShiftDay, { color: config.color }]}>
                  {formatShiftDate(nextDate)}
                </Text>
                <Text style={[styles.nextShiftTime, { color: config.color }]}>
                  {nextShift.startTime} - {nextShift.endTime}
                </Text>
              </View>
            </View>
          </View>
        </View>
      );
    }

    // Upcoming shift today
    if (shiftStatus === 'upcoming' && todayShift) {
      const config = SHIFT_CONFIG[todayShift.shiftType];
      const startsIn = calculateTimeUntilStart(todayShift);

      return (
        <View style={[styles.shiftCard, { backgroundColor: config.bgColor }]}>
          <View style={styles.shiftCardBadge}>
            <Text style={[styles.shiftCardBadgeText, { color: config.color }]}>HOJE</Text>
          </View>

          <View style={styles.shiftCardContent}>
            <Ionicons name={config.icon as any} size={28} color={config.color} />
            <View style={styles.shiftCardInfo}>
              <Text style={[styles.shiftCardLabel, { color: config.color }]}>
                {todayShift.shiftLabel}
              </Text>
              <Text style={[styles.shiftCardTime, { color: config.color }]}>
                {todayShift.startTime} - {todayShift.endTime}
              </Text>
            </View>
          </View>

          <View style={styles.shiftCountdown}>
            <Ionicons name="time-outline" size={16} color={config.color} />
            <Text style={[styles.shiftCountdownText, { color: config.color }]}>
              Começa em {startsIn}
            </Text>
          </View>
        </View>
      );
    }

    // Finished for today, show next shift
    if (nextShift) {
      const nextDate = new Date(nextShift.date + 'T12:00:00');
      const config = SHIFT_CONFIG[nextShift.shiftType];

      return (
        <View style={[styles.shiftCard, { backgroundColor: config.bgColor }]}>
          <View style={styles.shiftCardBadge}>
            <Text style={[styles.shiftCardBadgeText, { color: config.color }]}>PRÓXIMO</Text>
          </View>

          <View style={styles.shiftCardContent}>
            <Ionicons name={config.icon as any} size={28} color={config.color} />
            <View style={styles.shiftCardInfo}>
              <Text style={[styles.shiftCardLabel, { color: config.color }]}>
                {formatShiftDate(nextDate)}
              </Text>
              <Text style={[styles.shiftCardTime, { color: config.color }]}>
                {nextShift.startTime} - {nextShift.endTime}
              </Text>
              <Text style={[styles.shiftCardType, { color: config.color }]}>
                {nextShift.shiftLabel}
              </Text>
            </View>
          </View>
        </View>
      );
    }

    return null;
  }
}

// Helper function to determine shift label from start time
function getShiftLabel(startTime: string): string {
  const hour = parseInt(startTime.split(':')[0], 10);
  if (hour >= 5 && hour < 12) return 'Manhã';
  if (hour >= 12 && hour < 18) return 'Tarde';
  if (hour >= 18 && hour < 22) return 'Noite';
  return 'Madrugada';
}

function formatShiftDate(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const dateStr = date.toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  if (dateStr === todayStr) return 'Hoje';
  if (dateStr === tomorrowStr) return 'Amanhã';

  return `${DAYS_FULL[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)}`;
}

function formatDateRange(start: Date, end: Date): string {
  const formatDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
  if (start.toDateString() === end.toDateString()) {
    return formatDate(start);
  }
  return `${formatDate(start)} - ${formatDate(end)}`;
}

function calculateShiftProgress(shift: EmployeeShift): number {
  const now = new Date();
  const [startH, startM] = shift.startTime.split(':').map(Number);
  const [endH, endM] = shift.endTime.split(':').map(Number);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;

  if (endMinutes < startMinutes) endMinutes += 24 * 60;

  const totalDuration = endMinutes - startMinutes;
  const elapsed = currentMinutes - startMinutes;

  return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
}

function calculateTimeRemaining(shift: EmployeeShift): string {
  const now = new Date();
  const [endH, endM] = shift.endTime.split(':').map(Number);

  let endMinutes = endH * 60 + endM;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (endMinutes < currentMinutes) endMinutes += 24 * 60;

  const remaining = endMinutes - currentMinutes;
  const hours = Math.floor(remaining / 60);
  const minutes = remaining % 60;

  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

function calculateTimeUntilStart(shift: EmployeeShift): string {
  const now = new Date();
  const [startH, startM] = shift.startTime.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const remaining = startMinutes - currentMinutes;
  const hours = Math.floor(remaining / 60);
  const minutes = remaining % 60;

  if (hours === 0) return `${minutes} minutos`;
  if (minutes === 0) return `${hours} hora${hours > 1 ? 's' : ''}`;
  return `${hours}h ${minutes}min`;
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
  // Header
  header: {
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
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
  profileButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileButtonPressed: {
    opacity: 0.7,
  },
  // Section
  section: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.footnote,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  // Shift Card
  shiftCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.md,
  },
  shiftCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  shiftCardBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  shiftCardBadgeText: {
    fontSize: fontSize.caption1,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  shiftCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  shiftCardInfo: {
    flex: 1,
  },
  shiftCardLabel: {
    fontSize: fontSize.headline,
    fontWeight: '600',
  },
  shiftCardTime: {
    fontSize: fontSize.title2,
    fontWeight: '700',
    marginTop: spacing.xxs,
  },
  shiftCardType: {
    fontSize: fontSize.subhead,
    fontWeight: '500',
    marginTop: spacing.xxs,
    opacity: 0.8,
  },
  shiftProgress: {
    marginTop: spacing.md,
  },
  shiftProgressBar: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  shiftProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  shiftProgressText: {
    fontSize: fontSize.caption1,
    fontWeight: '500',
    marginTop: spacing.xs,
  },
  shiftCountdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  shiftCountdownText: {
    fontSize: fontSize.subhead,
    fontWeight: '500',
  },
  // Day Off Card
  shiftCardDayOff: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.md,
  },
  dayOffHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  dayOffEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  dayOffTitle: {
    fontSize: fontSize.headline,
    fontWeight: '600',
    color: colors.text.primary,
  },
  nextShiftPreview: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.light,
    paddingTop: spacing.md,
  },
  nextShiftPreviewLabel: {
    fontSize: fontSize.caption1,
    fontWeight: '600',
    color: colors.text.tertiary,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  nextShiftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  nextShiftInfo: {
    flex: 1,
  },
  nextShiftDay: {
    fontSize: fontSize.subhead,
    fontWeight: '600',
  },
  nextShiftTime: {
    fontSize: fontSize.body,
    fontWeight: '500',
    marginTop: 2,
  },
  // Empty State
  shiftCardEmpty: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.md,
  },
  shiftCardEmptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  shiftCardEmptyTitle: {
    fontSize: fontSize.headline,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  shiftCardEmptySubtitle: {
    fontSize: fontSize.subhead,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  shiftCardEmptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  shiftCardEmptyButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  shiftCardEmptyButtonText: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  // Week Overview
  weekCard: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  weekGrid: {
    flexDirection: 'row',
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
  },
  weekDayLabel: {
    fontSize: fontSize.caption2,
    fontWeight: '500',
    color: colors.text.tertiary,
  },
  weekDayLabelToday: {
    color: colors.primary[600],
  },
  weekDayNumber: {
    fontSize: fontSize.subhead,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 2,
  },
  weekDayNumberToday: {
    color: colors.primary[600],
  },
  weekDayShift: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
    minWidth: 36,
  },
  weekDayTime: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
  },
  weekDayOff: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    marginTop: spacing.xs,
    minWidth: 36,
    alignItems: 'center',
  },
  weekDayOffText: {
    fontSize: fontSize.subhead,
    color: colors.text.quaternary,
  },
  weekStats: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.light,
    alignItems: 'center',
  },
  weekStatsText: {
    fontSize: fontSize.footnote,
    color: colors.text.secondary,
  },
  // Availability Card
  availabilityCard: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  availabilityCardPressed: {
    backgroundColor: colors.neutral[100],
  },
  availabilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  availabilityIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  availabilityTitle: {
    flex: 1,
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text.primary,
  },
  availabilitySummary: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.light,
    gap: spacing.xs,
  },
  availabilityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  availabilityItemText: {
    fontSize: fontSize.footnote,
    color: colors.text.secondary,
  },
});
