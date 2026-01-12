/**
 * Schedule Validator Service
 * Validates schedules against Brazilian CLT labor laws and business rules
 */

import { Shift } from '../types';

type ValidationSeverity = 'error' | 'warning';

type ValidationIssue = {
  type: string;
  severity: ValidationSeverity;
  message: string;
  employeeId?: string;
  employeeName?: string;
  date?: string;
};

type ValidationResult = {
  isValid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

type EmployeeShiftInfo = {
  id: string;
  name: string;
  shifts: Shift[];
  workDates: string[];
  daysWorkedCount: number;
  hoursWorked: number;
};

/**
 * Validate a schedule against CLT rules and business constraints
 */
export function validateSchedule(
  shifts: Shift[],
  operatingHours: Record<number, { isOpen: boolean; openTime?: string; closeTime?: string }>,
  minEmployeesPerShift: number
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // Group shifts by employee
  const employeeShifts = groupShiftsByEmployee(shifts);

  // Group shifts by date
  const shiftsByDate = groupShiftsByDate(shifts);

  // 1. Validate minimum employees per day
  validateMinimumEmployees(shiftsByDate, operatingHours, minEmployeesPerShift, errors);

  // 2. Validate CLT rules per employee
  for (const [employeeId, info] of Object.entries(employeeShifts)) {
    // CLT Rule: Minimum 1 day off per week (DSR - Descanso Semanal Remunerado)
    validateWeeklyRest(info, errors);

    // CLT Rule: Maximum 6 consecutive work days
    validateConsecutiveDays(info, errors, warnings);

    // CLT Rule: Minimum 11 hours between shifts (inter-jornada)
    validateInterShiftRest(info, warnings);

    // CLT Guideline: Maximum 44 hours per week
    validateWeeklyHours(info, warnings);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Group shifts by employee ID
 */
function groupShiftsByEmployee(shifts: Shift[]): Record<string, EmployeeShiftInfo> {
  const grouped: Record<string, EmployeeShiftInfo> = {};

  for (const shift of shifts) {
    if (!grouped[shift.employeeId]) {
      grouped[shift.employeeId] = {
        id: shift.employeeId,
        name: shift.employeeName,
        shifts: [],
        workDates: [],
        daysWorkedCount: 0,
        hoursWorked: 0,
      };
    }

    grouped[shift.employeeId].shifts.push(shift);

    if (!grouped[shift.employeeId].workDates.includes(shift.date)) {
      grouped[shift.employeeId].workDates.push(shift.date);
      grouped[shift.employeeId].daysWorkedCount++;
    }

    // Calculate hours
    const hours = calculateShiftHours(shift.startTime, shift.endTime);
    grouped[shift.employeeId].hoursWorked += hours;
  }

  // Sort workDates for each employee
  for (const info of Object.values(grouped)) {
    info.workDates.sort();
  }

  return grouped;
}

/**
 * Group shifts by date
 */
function groupShiftsByDate(shifts: Shift[]): Record<string, Shift[]> {
  const grouped: Record<string, Shift[]> = {};

  for (const shift of shifts) {
    if (!grouped[shift.date]) {
      grouped[shift.date] = [];
    }
    grouped[shift.date].push(shift);
  }

  return grouped;
}

/**
 * Calculate hours between start and end time
 */
function calculateShiftHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let hours = endH - startH + (endM - startM) / 60;
  if (hours < 0) hours += 24; // Handle overnight shifts

  return hours;
}

/**
 * Validate minimum employees per open day
 */
function validateMinimumEmployees(
  shiftsByDate: Record<string, Shift[]>,
  operatingHours: Record<number, { isOpen: boolean }>,
  minEmployeesPerShift: number,
  errors: ValidationIssue[]
): void {
  for (const [date, dayShifts] of Object.entries(shiftsByDate)) {
    const dayOfWeek = new Date(date + 'T12:00:00').getDay();

    if (!operatingHours[dayOfWeek]?.isOpen) continue;

    // Count unique employees on this day
    const uniqueEmployees = new Set(dayShifts.map((s) => s.employeeId));
    const employeeCount = uniqueEmployees.size;

    if (employeeCount < minEmployeesPerShift) {
      const dayName = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][dayOfWeek];
      errors.push({
        type: 'understaffed',
        severity: 'error',
        message: `${dayName} (${date}): precisa de ${minEmployeesPerShift} funcionário(s), tem apenas ${employeeCount}`,
        date,
      });
    }
  }
}

/**
 * CLT Rule: Minimum 1 day off per week (DSR)
 */
function validateWeeklyRest(info: EmployeeShiftInfo, errors: ValidationIssue[]): void {
  if (info.daysWorkedCount > 6) {
    errors.push({
      type: 'no_weekly_rest',
      severity: 'error',
      message: `${info.name} não tem folga semanal (trabalha ${info.daysWorkedCount} dias)`,
      employeeId: info.id,
      employeeName: info.name,
    });
  }
}

/**
 * CLT Rule: Maximum 6 consecutive work days
 */
function validateConsecutiveDays(
  info: EmployeeShiftInfo,
  errors: ValidationIssue[],
  warnings: ValidationIssue[]
): void {
  if (info.workDates.length < 2) return;

  let consecutive = 1;
  let maxConsecutive = 1;

  for (let i = 1; i < info.workDates.length; i++) {
    const prevDate = new Date(info.workDates[i - 1] + 'T12:00:00');
    const currDate = new Date(info.workDates[i] + 'T12:00:00');

    const dayDiff = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

    if (dayDiff === 1) {
      consecutive++;
      maxConsecutive = Math.max(maxConsecutive, consecutive);
    } else {
      consecutive = 1;
    }
  }

  if (maxConsecutive > 6) {
    errors.push({
      type: 'excessive_consecutive_days',
      severity: 'error',
      message: `${info.name} trabalha ${maxConsecutive} dias consecutivos (máximo CLT: 6)`,
      employeeId: info.id,
      employeeName: info.name,
    });
  } else if (maxConsecutive === 6) {
    warnings.push({
      type: 'max_consecutive_days',
      severity: 'warning',
      message: `${info.name} trabalha 6 dias consecutivos (limite CLT)`,
      employeeId: info.id,
      employeeName: info.name,
    });
  }
}

/**
 * CLT Rule: Minimum 11 hours between shifts (inter-jornada)
 */
function validateInterShiftRest(info: EmployeeShiftInfo, warnings: ValidationIssue[]): void {
  const sortedShifts = [...info.shifts].sort((a, b) => {
    const aTime = new Date(`${a.date}T${a.startTime}`);
    const bTime = new Date(`${b.date}T${b.startTime}`);
    return aTime.getTime() - bTime.getTime();
  });

  for (let i = 1; i < sortedShifts.length; i++) {
    const prevShift = sortedShifts[i - 1];
    const currShift = sortedShifts[i];

    // Calculate end time of previous shift
    const prevEnd = new Date(`${prevShift.date}T${prevShift.endTime}`);
    // Handle overnight shifts
    if (prevShift.endTime < prevShift.startTime) {
      prevEnd.setDate(prevEnd.getDate() + 1);
    }

    // Calculate start time of current shift
    const currStart = new Date(`${currShift.date}T${currShift.startTime}`);

    const hoursBetween = (currStart.getTime() - prevEnd.getTime()) / (1000 * 60 * 60);

    if (hoursBetween > 0 && hoursBetween < 11) {
      warnings.push({
        type: 'insufficient_inter_shift_rest',
        severity: 'warning',
        message: `${info.name}: apenas ${Math.round(hoursBetween)}h entre turnos de ${prevShift.date} e ${currShift.date} (mínimo CLT: 11h)`,
        employeeId: info.id,
        employeeName: info.name,
        date: currShift.date,
      });
    }
  }
}

/**
 * CLT Guideline: Maximum 44 hours per week
 */
function validateWeeklyHours(info: EmployeeShiftInfo, warnings: ValidationIssue[]): void {
  if (info.hoursWorked > 44) {
    warnings.push({
      type: 'excessive_weekly_hours',
      severity: 'warning',
      message: `${info.name} trabalha ${Math.round(info.hoursWorked)}h/semana (limite CLT: 44h)`,
      employeeId: info.id,
      employeeName: info.name,
    });
  }
}

/**
 * Check if an employee is available for a specific day
 */
export function isEmployeeAvailable(
  dayOfWeek: number,
  date: string,
  restrictions?: {
    unavailableDays?: number[];
    unavailableTimeRanges?: Array<{ day: number; startTime: string; endTime: string }>;
  },
  recurringAvailability?: Record<number, { available: boolean }>,
  temporaryAvailability?: Array<{
    startDate: string;
    endDate: string;
    type: 'unavailable' | 'available' | 'custom';
  }>
): boolean {
  // Check recurring availability first (new system)
  if (recurringAvailability && recurringAvailability[dayOfWeek]) {
    if (!recurringAvailability[dayOfWeek].available) {
      return false;
    }
  }

  // Check temporary unavailability
  if (temporaryAvailability) {
    for (const temp of temporaryAvailability) {
      if (temp.type === 'unavailable' && date >= temp.startDate && date <= temp.endDate) {
        return false;
      }
    }
  }

  // Check legacy restrictions
  if (restrictions?.unavailableDays?.includes(dayOfWeek)) {
    return false;
  }

  return true;
}

export const scheduleValidator = {
  validateSchedule,
  isEmployeeAvailable,
};
