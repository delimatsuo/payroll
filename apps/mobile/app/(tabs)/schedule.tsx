import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, fontSize, borderRadius, shadows } from '../../src/theme';
import { useEstablishment } from '../../src/hooks/useEstablishment';
import { DayTimelineView } from '../../src/components/schedule/DayTimelineView';
import { ShiftListView } from '../../src/components/schedule/ShiftListView';
import { ConflictAlert } from '../../src/components/schedule/ConflictAlert';
import { api } from '../../src/services/api';
import type { ShiftType, ShiftDefinition, ManagerSchedule } from '../../src/services/api';

const DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DAYS_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Default shift definitions for 24/7 operations
const DEFAULT_SHIFTS: ShiftDefinition[] = [
  { id: '1', type: 'morning', label: 'Manhã', startTime: '06:00', endTime: '14:00', minEmployees: 2 },
  { id: '2', type: 'afternoon', label: 'Tarde', startTime: '14:00', endTime: '22:00', minEmployees: 2 },
  { id: '3', type: 'night', label: 'Noite', startTime: '22:00', endTime: '06:00', minEmployees: 1 },
];

type GeneratedShift = {
  employeeId: string;
  employeeName: string;
  startTime: string;
  endTime: string;
  shiftType: ShiftType;
  shiftLabel: string;
};

// Types for availability
type RecurringAvailability = Record<number, {
  available: boolean;
  startTime?: string;
  endTime?: string;
}>;

type TemporaryAvailability = Array<{
  id: string;
  startDate: string;
  endDate: string;
  type: 'unavailable' | 'available' | 'custom';
  hours?: { startTime: string; endTime: string };
  reason?: string;
}>;

type EmployeeWithAvailability = {
  id: string;
  name: string;
  status: string;
  recurringAvailability?: RecurringAvailability;
  temporaryAvailability?: TemporaryAvailability;
  availabilityUpdatedAt?: string;
};

// Conflict tracking
type ShiftConflict = {
  shiftType: ShiftType;
  shiftLabel: string;
  required: number;
  available: number;
  unavailableEmployees: Array<{ id: string; name: string; reason: string }>;
};

/**
 * Check if an employee is available for a specific shift
 */
function isEmployeeAvailable(
  employee: EmployeeWithAvailability,
  date: Date,
  shiftStartTime: string,
  shiftEndTime: string
): { available: boolean; reason?: string } {
  const dayOfWeek = date.getDay();
  const dateStr = date.toISOString().split('T')[0];

  // 1. Check temporary availability first (takes precedence)
  if (employee.temporaryAvailability?.length) {
    const exception = employee.temporaryAvailability.find(
      (t) => dateStr >= t.startDate && dateStr <= t.endDate
    );

    if (exception) {
      if (exception.type === 'unavailable') {
        return { available: false, reason: exception.reason || 'Indisponível (temporário)' };
      }
      if (exception.type === 'custom' && exception.hours) {
        // Check if shift overlaps with available hours
        if (!timeRangesOverlap(
          shiftStartTime,
          shiftEndTime,
          exception.hours.startTime,
          exception.hours.endTime
        )) {
          return { available: false, reason: `Disponível apenas ${exception.hours.startTime}-${exception.hours.endTime}` };
        }
      }
      // type === 'available' means they're available
    }
  }

  // 2. Check recurring availability
  const recurring = employee.recurringAvailability?.[dayOfWeek];
  if (recurring) {
    if (!recurring.available) {
      return { available: false, reason: `Indisponível às ${DAYS_FULL[dayOfWeek]}s` };
    }

    // Check if they have specific hours
    if (recurring.startTime && recurring.endTime) {
      if (!timeRangesOverlap(
        shiftStartTime,
        shiftEndTime,
        recurring.startTime,
        recurring.endTime
      )) {
        return { available: false, reason: `Disponível apenas ${recurring.startTime}-${recurring.endTime}` };
      }
    }
  }

  return { available: true };
}

/**
 * Check if two time ranges overlap
 */
function timeRangesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const toMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  let s1 = toMinutes(start1);
  let e1 = toMinutes(end1);
  let s2 = toMinutes(start2);
  let e2 = toMinutes(end2);

  // Handle overnight shifts (end time is next day)
  if (e1 < s1) e1 += 24 * 60;
  if (e2 < s2) e2 += 24 * 60;

  // Check overlap
  return s1 < e2 && s2 < e1;
}

export default function ScheduleScreen() {
  const { establishment, employees, loading, refreshEstablishment } = useEstablishment();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [generating, setGenerating] = useState(false);
  const [generatedSchedule, setGeneratedSchedule] = useState<ManagerSchedule | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  // Get current week dates
  const weekDates = useMemo(() => {
    const dates: Date[] = [];
    const startOfWeek = new Date(selectedDate);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, [selectedDate]);

  // Get shift definitions (from establishment settings or use defaults)
  const shiftDefinitions = useMemo(() => {
    return establishment?.settings?.shiftDefinitions || DEFAULT_SHIFTS;
  }, [establishment?.settings?.shiftDefinitions]);

  // Calculate min employees per shift type for coverage display
  const minEmployeesPerShiftType = useMemo(() => {
    const result: Record<ShiftType, number> = {
      morning: 0,
      afternoon: 0,
      night: 0,
      custom: 0,
    };
    shiftDefinitions.forEach((def) => {
      result[def.type] = def.minEmployees;
    });
    return result;
  }, [shiftDefinitions]);

  // Build week schedule data with multiple shifts per day
  // Uses API-generated schedule if available, otherwise shows preview based on availability
  const weekSchedule = useMemo(() => {
    const activeEmployees = employees.filter((e) => e.status === 'active') as EmployeeWithAvailability[];

    return weekDates.map((date) => {
      const dayOfWeek = date.getDay();
      const dateStr = date.toISOString().split('T')[0];
      const dayHours = establishment?.operatingHours?.[dayOfWeek];
      const isOpen = dayHours?.isOpen ?? false;

      const openTime = dayHours?.openTime || '00:00';
      const closeTime = dayHours?.closeTime || '23:59';

      let shifts: GeneratedShift[] = [];
      const conflicts: ShiftConflict[] = [];

      // If we have a generated schedule from API, use those shifts
      if (generatedSchedule?.shifts) {
        const dayShifts = generatedSchedule.shifts.filter((s) => s.date === dateStr);
        shifts = dayShifts.map((s) => ({
          employeeId: s.employeeId,
          employeeName: s.employeeName,
          startTime: s.startTime,
          endTime: s.endTime,
          shiftType: (s.shiftType || 'custom') as ShiftType,
          shiftLabel: s.shiftLabel || 'Turno',
        }));
      } else if (isOpen && activeEmployees.length > 0) {
        // Fallback: Show preview based on availability (for when no schedule exists)
        const assignedEmployeeIds = new Set<string>();

        shiftDefinitions.forEach((shiftDef) => {
          const availableForShift: EmployeeWithAvailability[] = [];
          const unavailableList: Array<{ id: string; name: string; reason: string }> = [];

          activeEmployees.forEach((emp) => {
            if (assignedEmployeeIds.has(emp.id)) return;

            const availability = isEmployeeAvailable(
              emp,
              date,
              shiftDef.startTime,
              shiftDef.endTime
            );

            if (availability.available) {
              availableForShift.push(emp);
            } else {
              unavailableList.push({
                id: emp.id,
                name: emp.name,
                reason: availability.reason || 'Indisponível',
              });
            }
          });

          availableForShift.sort((a, b) => {
            const dateA = a.availabilityUpdatedAt ? new Date(a.availabilityUpdatedAt).getTime() : 0;
            const dateB = b.availabilityUpdatedAt ? new Date(b.availabilityUpdatedAt).getTime() : 0;
            return dateA - dateB;
          });

          const toAssign = Math.min(shiftDef.minEmployees, availableForShift.length);

          for (let i = 0; i < toAssign; i++) {
            const employee = availableForShift[i];
            assignedEmployeeIds.add(employee.id);

            shifts.push({
              employeeId: employee.id,
              employeeName: employee.name,
              startTime: shiftDef.startTime,
              endTime: shiftDef.endTime,
              shiftType: shiftDef.type,
              shiftLabel: shiftDef.label,
            });
          }

          if (toAssign < shiftDef.minEmployees) {
            conflicts.push({
              shiftType: shiftDef.type,
              shiftLabel: shiftDef.label,
              required: shiftDef.minEmployees,
              available: toAssign,
              unavailableEmployees: unavailableList,
            });
          }
        });
      }

      return {
        date,
        dayOfWeek,
        isOpen,
        openTime,
        closeTime,
        shifts,
        conflicts,
      };
    });
  }, [weekDates, establishment?.operatingHours, shiftDefinitions, employees, generatedSchedule]);

  // Get shifts for the selected day
  const selectedDayData = useMemo(() => {
    const dayOfWeek = selectedDate.getDay();
    return weekSchedule.find(
      (day) => day.date.getDate() === selectedDate.getDate()
    ) || weekSchedule[dayOfWeek];
  }, [selectedDate, weekSchedule]);

  const goToPreviousWeek = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 7);
    setSelectedDate(newDate);
  }, [selectedDate]);

  const goToNextWeek = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 7);
    setSelectedDate(newDate);
  }, [selectedDate]);

  const goToToday = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDate(new Date());
  }, []);

  const selectDate = useCallback((date: Date) => {
    Haptics.selectionAsync();
    setSelectedDate(date);
  }, []);

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (date: Date) => {
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const isDayOpen = (dayOfWeek: number) => {
    return establishment?.operatingHours?.[dayOfWeek]?.isOpen ?? false;
  };

  // Calculate week start date (Sunday) from selected date
  const getWeekStartDate = useCallback((date: Date): string => {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return d.toISOString().split('T')[0];
  }, []);

  // Load existing schedule for the week
  const loadWeekSchedule = useCallback(async (weekStart: string) => {
    setLoadingSchedule(true);
    try {
      const response = await api.getWeekSchedule(weekStart);
      if (response && !response.error) {
        setGeneratedSchedule(response as ManagerSchedule);
      } else {
        setGeneratedSchedule(null);
      }
    } catch {
      setGeneratedSchedule(null);
    } finally {
      setLoadingSchedule(false);
    }
  }, []);

  // Load schedule when week changes
  const weekStartDate = useMemo(() => getWeekStartDate(selectedDate), [selectedDate, getWeekStartDate]);

  // Effect to load schedule when week changes
  useMemo(() => {
    if (establishment?.id) {
      loadWeekSchedule(weekStartDate);
    }
  }, [weekStartDate, establishment?.id, loadWeekSchedule]);

  const handleGenerateSchedule = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (employees.length === 0) {
      Alert.alert(
        'Sem funcionários',
        'Adicione funcionários antes de gerar uma escala.',
        [{ text: 'OK' }]
      );
      return;
    }

    const minEmployees = establishment?.settings?.minEmployeesPerShift || 2;
    if (employees.length < minEmployees) {
      Alert.alert(
        'Funcionários insuficientes',
        `Você precisa de pelo menos ${minEmployees} funcionários para gerar uma escala.`,
        [{ text: 'OK' }]
      );
      return;
    }

    setGenerating(true);

    try {
      const response = await api.generateSchedule(weekStartDate);

      if (response.error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          'Erro ao gerar escala',
          response.message || 'Não foi possível gerar a escala. Tente novamente.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Schedule generated successfully
      setGeneratedSchedule(response as ManagerSchedule);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Check for warnings
      const validation = (response as any).validation;
      if (validation?.warnings?.length > 0 || validation?.errors?.length > 0) {
        const warnings = validation.warnings || [];
        const errors = validation.errors || [];
        const messages = [...errors, ...warnings];

        Alert.alert(
          response.alreadyExists ? 'Escala Existente' : 'Escala Gerada!',
          response.alreadyExists
            ? 'Já existe uma escala para esta semana.'
            : `Escala criada com ${(response as ManagerSchedule).shifts?.length || 0} turnos.` +
              (messages.length > 0 ? `\n\nAvisos:\n• ${messages.slice(0, 3).join('\n• ')}` : ''),
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          response.alreadyExists ? 'Escala Existente' : 'Escala Gerada!',
          response.alreadyExists
            ? 'Já existe uma escala para esta semana.'
            : `Escala criada com ${(response as ManagerSchedule).shifts?.length || 0} turnos.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error generating schedule:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Erro',
        'Não foi possível conectar ao servidor. Verifique sua conexão.',
        [{ text: 'OK' }]
      );
    } finally {
      setGenerating(false);
    }
  }, [employees, establishment, weekStartDate]);

  const getWeekRange = () => {
    const start = weekDates[0];
    const end = weekDates[6];

    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} – ${end.getDate()} de ${MONTHS[start.getMonth()]}`;
    }

    return `${start.getDate()} ${MONTHS[start.getMonth()].slice(0, 3)} – ${end.getDate()} ${MONTHS[end.getMonth()].slice(0, 3)}`;
  };

  if (loading) {
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
        <Text style={styles.largeTitle}>Escala</Text>
        <Pressable
          style={({ pressed }) => [
            styles.todayButton,
            pressed && styles.todayButtonPressed,
          ]}
          onPress={goToToday}
        >
          <Text style={styles.todayButtonText}>Hoje</Text>
        </Pressable>
      </View>

      {/* Week Navigation */}
      <View style={styles.weekNav}>
        <TouchableOpacity
          onPress={goToPreviousWeek}
          style={styles.navButton}
          activeOpacity={0.6}
        >
          <Ionicons name="chevron-back" size={24} color={colors.primary[600]} />
        </TouchableOpacity>
        <Text style={styles.weekRange}>{getWeekRange()}</Text>
        <TouchableOpacity
          onPress={goToNextWeek}
          style={styles.navButton}
          activeOpacity={0.6}
        >
          <Ionicons name="chevron-forward" size={24} color={colors.primary[600]} />
        </TouchableOpacity>
      </View>

      {/* Week Days Strip */}
      <View style={styles.weekDaysContainer}>
        <View style={styles.weekDays}>
          {weekDates.map((date, index) => {
            const dayOpen = isDayOpen(date.getDay());
            const selected = isSelected(date);
            const today = isToday(date);

            return (
              <Pressable
                key={index}
                style={({ pressed }) => [
                  styles.dayButton,
                  pressed && styles.dayButtonPressed,
                ]}
                onPress={() => selectDate(date)}
              >
                <Text style={[
                  styles.dayName,
                  selected && styles.dayNameSelected,
                  !dayOpen && styles.dayNameClosed,
                ]}>
                  {DAYS_SHORT[date.getDay()]}
                </Text>
                <View style={[
                  styles.dayNumberContainer,
                  selected && styles.dayNumberContainerSelected,
                  today && !selected && styles.dayNumberContainerToday,
                ]}>
                  <Text style={[
                    styles.dayNumber,
                    selected && styles.dayNumberSelected,
                    !dayOpen && !selected && styles.dayNumberClosed,
                  ]}>
                    {date.getDate()}
                  </Text>
                </View>
                {!dayOpen && (
                  <View style={styles.closedDot} />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Selected Day Card */}
        <View style={styles.selectedDayCard}>
          <View style={styles.selectedDayHeader}>
            <View>
              <Text style={styles.selectedDayTitle}>
                {DAYS_FULL[selectedDate.getDay()]}
              </Text>
              <Text style={styles.selectedDayDate}>
                {selectedDate.getDate()} de {MONTHS[selectedDate.getMonth()]}
              </Text>
            </View>
            <View style={[
              styles.statusBadge,
              !isDayOpen(selectedDate.getDay()) && styles.statusBadgeClosed,
            ]}>
              <View style={[
                styles.statusDot,
                !isDayOpen(selectedDate.getDay()) && styles.statusDotClosed,
              ]} />
              <Text style={[
                styles.statusText,
                !isDayOpen(selectedDate.getDay()) && styles.statusTextClosed,
              ]}>
                {isDayOpen(selectedDate.getDay()) ? 'Aberto' : 'Fechado'}
              </Text>
            </View>
          </View>

          {isDayOpen(selectedDate.getDay()) && establishment?.operatingHours && (
            <View style={styles.hoursInfo}>
              <Ionicons name="time" size={16} color={colors.text.tertiary} />
              <Text style={styles.hoursText}>
                {establishment.operatingHours[selectedDate.getDay()]?.openTime} – {establishment.operatingHours[selectedDate.getDay()]?.closeTime}
              </Text>
            </View>
          )}
        </View>

        {/* Conflict Alert */}
        {selectedDayData?.conflicts && selectedDayData.conflicts.length > 0 && (
          <View style={styles.gridSection}>
            <ConflictAlert
              conflicts={selectedDayData.conflicts}
              onResolve={(conflict) => {
                Alert.alert(
                  `Resolver: ${conflict.shiftLabel}`,
                  `Faltam ${conflict.required - conflict.available} funcionário(s) para este turno.\n\n` +
                  `Sugestões:\n` +
                  `1. Perguntar a funcionários indisponíveis se podem fazer exceção\n` +
                  `2. Aprovar turno com menos funcionários\n` +
                  `3. Adicionar funcionário temporário`,
                  [
                    { text: 'Fechar', style: 'cancel' },
                    {
                      text: 'Ver Detalhes',
                      onPress: () => {
                        const details = conflict.unavailableEmployees
                          .map((e) => `• ${e.name}: ${e.reason}`)
                          .join('\n');
                        Alert.alert('Funcionários Indisponíveis', details);
                      },
                    },
                  ]
                );
              }}
            />
          </View>
        )}

        {/* Day Timeline View */}
        <View style={styles.gridSection}>
          <DayTimelineView
            date={selectedDate}
            shifts={selectedDayData?.shifts || []}
            operatingHours={
              selectedDayData
                ? {
                    openTime: selectedDayData.openTime,
                    closeTime: selectedDayData.closeTime,
                    isOpen: selectedDayData.isOpen,
                  }
                : undefined
            }
            onShiftPress={(shift) => {
              Alert.alert(
                shift.employeeName,
                `${shift.shiftLabel}: ${shift.startTime} - ${shift.endTime}`,
                [{ text: 'OK' }]
              );
            }}
          />
        </View>

        {/* Shift List View */}
        {isDayOpen(selectedDate.getDay()) && (
          <View style={styles.gridSection}>
            <ShiftListView
              shifts={selectedDayData?.shifts || []}
              minEmployeesPerShift={minEmployeesPerShiftType}
              onShiftPress={(shift) => {
                Alert.alert(
                  shift.employeeName,
                  `${shift.shiftLabel}: ${shift.startTime} - ${shift.endTime}`,
                  [{ text: 'OK' }]
                );
              }}
              onAddShift={(shiftType) => {
                Alert.alert(
                  'Adicionar Turno',
                  `Adicionar funcionário ao turno ${
                    shiftType === 'morning' ? 'da Manhã' :
                    shiftType === 'afternoon' ? 'da Tarde' : 'da Noite'
                  }?`,
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Adicionar', onPress: () => {} },
                  ]
                );
              }}
            />
          </View>
        )}

        {/* Schedule Status & Generate Button */}
        <View style={styles.generateSection}>
          {generatedSchedule && (
            <View style={styles.scheduleStatusBadge}>
              <View style={[
                styles.scheduleStatusDot,
                generatedSchedule.status === 'published' && styles.scheduleStatusDotPublished,
              ]} />
              <Text style={styles.scheduleStatusText}>
                {generatedSchedule.status === 'draft' ? 'Rascunho' : 'Publicada'}
                {' • '}
                {generatedSchedule.shifts?.length || 0} turnos
              </Text>
            </View>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.generateButton,
              generating && styles.generateButtonDisabled,
              pressed && !generating && styles.generateButtonPressed,
              generatedSchedule && styles.generateButtonSecondary,
            ]}
            onPress={handleGenerateSchedule}
            disabled={generating || loadingSchedule}
          >
            {generating || loadingSchedule ? (
              <ActivityIndicator color={generatedSchedule ? colors.primary[600] : colors.text.inverse} />
            ) : (
              <>
                <Ionicons
                  name={generatedSchedule ? 'refresh' : 'sparkles'}
                  size={20}
                  color={generatedSchedule ? colors.primary[600] : colors.text.inverse}
                />
                <Text style={[
                  styles.generateButtonText,
                  generatedSchedule && styles.generateButtonTextSecondary,
                ]}>
                  {generatedSchedule ? 'Regenerar Escala' : 'Gerar Escala da Semana'}
                </Text>
              </>
            )}
          </Pressable>
          <Text style={styles.generateHint}>
            {generatedSchedule
              ? 'Regenerar irá substituir a escala atual'
              : 'Escala gerada automaticamente com IA'}
          </Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsSection}>
          <Text style={styles.statsSectionTitle}>EQUIPE DISPONÍVEL</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIconContainer, { backgroundColor: colors.primary[100] }]}>
                <Ionicons name="people" size={20} color={colors.primary[600]} />
              </View>
              <Text style={styles.statNumber}>{employees.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIconContainer, { backgroundColor: colors.success.light }]}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success.main} />
              </View>
              <Text style={styles.statNumber}>
                {employees.filter((e) => e.status === 'active').length}
              </Text>
              <Text style={styles.statLabel}>Ativos</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIconContainer, { backgroundColor: colors.info.light }]}>
                <Ionicons name="layers" size={20} color={colors.info.main} />
              </View>
              <Text style={styles.statNumber}>
                {establishment?.settings?.minEmployeesPerShift || 2}
              </Text>
              <Text style={styles.statLabel}>Mín/Turno</Text>
            </View>
          </View>
        </View>

        {/* Bottom spacing for tab bar */}
        <View style={{ height: spacing.xxxl + spacing.lg }} />
      </ScrollView>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  largeTitle: {
    fontSize: fontSize.largeTitle,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  todayButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[100],
  },
  todayButtonPressed: {
    backgroundColor: colors.primary[200],
  },
  todayButtonText: {
    fontSize: fontSize.subhead,
    fontWeight: '600',
    color: colors.primary[600],
  },
  // Week Navigation
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.primary,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekRange: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text.primary,
  },
  // Week Days
  weekDaysContainer: {
    backgroundColor: colors.background.primary,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
  },
  weekDays: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
  },
  dayButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  dayButtonPressed: {
    opacity: 0.7,
  },
  dayName: {
    fontSize: fontSize.caption1,
    fontWeight: '500',
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  dayNameSelected: {
    color: colors.primary[600],
  },
  dayNameClosed: {
    color: colors.text.quaternary,
  },
  dayNumberContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayNumberContainerSelected: {
    backgroundColor: colors.primary[600],
  },
  dayNumberContainerToday: {
    borderWidth: 2,
    borderColor: colors.primary[600],
  },
  dayNumber: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text.primary,
  },
  dayNumberSelected: {
    color: colors.text.inverse,
  },
  dayNumberClosed: {
    color: colors.text.quaternary,
  },
  closedDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text.quaternary,
    marginTop: spacing.xs,
  },
  // Content
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  // Selected Day Card
  selectedDayCard: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  selectedDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  selectedDayTitle: {
    fontSize: fontSize.title3,
    fontWeight: '600',
    color: colors.text.primary,
  },
  selectedDayDate: {
    fontSize: fontSize.subhead,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success.light,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  statusBadgeClosed: {
    backgroundColor: colors.neutral[100],
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success.main,
  },
  statusDotClosed: {
    backgroundColor: colors.neutral[400],
  },
  statusText: {
    fontSize: fontSize.caption1,
    fontWeight: '600',
    color: colors.success.dark,
  },
  statusTextClosed: {
    color: colors.text.tertiary,
  },
  hoursInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.light,
    gap: spacing.xs,
  },
  hoursText: {
    fontSize: fontSize.subhead,
    color: colors.text.secondary,
  },
  // Grid Section
  gridSection: {
    marginTop: spacing.md,
  },
  gridSectionTitle: {
    fontSize: fontSize.footnote,
    fontWeight: '500',
    color: colors.text.secondary,
    letterSpacing: 0.3,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  // Schedule Card
  scheduleCard: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
    ...shadows.sm,
    overflow: 'hidden',
  },
  // Day Detail
  dayDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
  },
  dayDetailTitle: {
    fontSize: fontSize.headline,
    fontWeight: '600',
    color: colors.text.primary,
  },
  shiftCountChip: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  shiftCountChipText: {
    fontSize: fontSize.caption1,
    fontWeight: '600',
    color: colors.primary[600],
  },
  noShiftsContent: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  noShiftsText: {
    fontSize: fontSize.subhead,
    color: colors.text.tertiary,
  },
  shiftsListContent: {
    padding: spacing.sm,
  },
  shiftListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  shiftListAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  shiftListAvatarText: {
    fontSize: fontSize.subhead,
    fontWeight: '600',
    color: colors.primary[600],
  },
  shiftListInfo: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  shiftListName: {
    fontSize: fontSize.body,
    fontWeight: '500',
    color: colors.text.primary,
  },
  shiftListTime: {
    fontSize: fontSize.footnote,
    color: colors.text.secondary,
    marginTop: 2,
  },
  emptySchedule: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.headline,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: fontSize.subhead,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  closedDayContent: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  closedIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  closedDayText: {
    fontSize: fontSize.headline,
    fontWeight: '600',
    color: colors.text.tertiary,
  },
  closedDaySubtext: {
    fontSize: fontSize.subhead,
    color: colors.text.quaternary,
    marginTop: spacing.xs,
  },
  // Generate Section
  generateSection: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    width: '100%',
    justifyContent: 'center',
    ...shadows.md,
  },
  generateButtonPressed: {
    backgroundColor: colors.primary[700],
    transform: [{ scale: 0.98 }],
  },
  generateButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  generateButtonSecondary: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  generateButtonText: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  generateButtonTextSecondary: {
    color: colors.primary[600],
  },
  generateHint: {
    fontSize: fontSize.footnote,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
  },
  scheduleStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.elevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
    ...shadows.sm,
  },
  scheduleStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.warning.main,
  },
  scheduleStatusDotPublished: {
    backgroundColor: colors.success.main,
  },
  scheduleStatusText: {
    fontSize: fontSize.subhead,
    color: colors.text.secondary,
  },
  // Stats Section
  statsSection: {
    marginTop: spacing.xl,
  },
  statsSectionTitle: {
    fontSize: fontSize.footnote,
    fontWeight: '500',
    color: colors.text.secondary,
    letterSpacing: 0.3,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statNumber: {
    fontSize: fontSize.title2,
    fontWeight: '700',
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: fontSize.caption1,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
});
