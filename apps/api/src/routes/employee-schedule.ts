/**
 * Employee Schedule Routes
 * Endpoints for employees to view their own schedules
 * Access control: Employees can ONLY see their own shifts
 */

import { Router, Request, Response } from 'express';
import { collections } from '../services/firebase';
import { verifyTokenWithRole, requireEmployee, loadEmployeeData } from '../middleware/roleAuth';
import { Shift } from '../types';

const router = Router();

// All routes require employee authentication
router.use(verifyTokenWithRole);
router.use(requireEmployee);
router.use(loadEmployeeData);

type EmployeeShift = {
  id: string;
  scheduleId: string;
  date: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  shiftType?: string;
  shiftLabel?: string;
  status: string;
};

type ScheduleInfo = {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  establishmentName: string;
  status: string;
  publishedAt?: Date;
};

/**
 * GET /employee/schedule
 * Get the authenticated employee's shifts
 * Returns only shifts assigned to this employee
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.employeeId || !req.establishmentId) {
      res.status(400).json({
        error: 'Dados incompletos',
        message: 'Funcionário ou estabelecimento não identificado',
      });
      return;
    }

    // Get today's date for filtering
    const today = new Date().toISOString().split('T')[0];

    // Find all published schedules for this establishment
    const schedulesSnapshot = await collections.schedules
      .where('establishmentId', '==', req.establishmentId)
      .where('status', '==', 'published')
      .where('weekEndDate', '>=', today) // Only current/future schedules
      .orderBy('weekEndDate', 'asc')
      .limit(4) // Current week + next 3 weeks
      .get();

    if (schedulesSnapshot.empty) {
      res.json({
        success: true,
        shifts: [],
        schedules: [],
        message: 'Nenhuma escala publicada',
      });
      return;
    }

    // Get establishment name
    const estDoc = await collections.establishments.doc(req.establishmentId).get();
    const establishmentName = estDoc.exists ? estDoc.data()?.name || 'Estabelecimento' : 'Estabelecimento';

    const allShifts: EmployeeShift[] = [];
    const scheduleInfos: ScheduleInfo[] = [];

    for (const scheduleDoc of schedulesSnapshot.docs) {
      const scheduleData = scheduleDoc.data();
      const scheduleId = scheduleDoc.id;

      // Filter shifts to only include this employee's shifts
      const allScheduleShifts: Shift[] = scheduleData.shifts || [];
      const myShifts = allScheduleShifts.filter(
        (shift) => shift.employeeId === req.employeeId
      );

      // Convert to response format
      for (const shift of myShifts) {
        allShifts.push({
          id: shift.id,
          scheduleId,
          date: shift.date,
          dayOfWeek: shift.dayOfWeek,
          startTime: shift.startTime,
          endTime: shift.endTime,
          shiftType: shift.shiftType,
          shiftLabel: shift.shiftLabel || getShiftLabel(shift.startTime),
          status: shift.status,
        });
      }

      // Add schedule info
      scheduleInfos.push({
        id: scheduleId,
        weekStartDate: scheduleData.weekStartDate,
        weekEndDate: scheduleData.weekEndDate,
        establishmentName,
        status: scheduleData.status,
        publishedAt: scheduleData.publishedAt?.toDate?.() || scheduleData.publishedAt,
      });
    }

    // Sort shifts by date
    allShifts.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.startTime.localeCompare(b.startTime);
    });

    res.json({
      success: true,
      shifts: allShifts,
      schedules: scheduleInfos,
      totalShifts: allShifts.length,
    });
  } catch (error) {
    console.error('Error fetching employee schedule:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao buscar sua escala',
    });
  }
});

/**
 * GET /employee/schedule/week/:weekStartDate
 * Get employee's shifts for a specific week
 */
router.get('/week/:weekStartDate', async (req: Request, res: Response) => {
  try {
    if (!req.employeeId || !req.establishmentId) {
      res.status(400).json({
        error: 'Dados incompletos',
        message: 'Funcionário ou estabelecimento não identificado',
      });
      return;
    }

    const { weekStartDate } = req.params;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartDate)) {
      res.status(400).json({
        error: 'Formato inválido',
        message: 'Data deve estar no formato YYYY-MM-DD',
      });
      return;
    }

    // Find schedule for this week
    const schedulesSnapshot = await collections.schedules
      .where('establishmentId', '==', req.establishmentId)
      .where('weekStartDate', '==', weekStartDate)
      .where('status', '==', 'published')
      .limit(1)
      .get();

    if (schedulesSnapshot.empty) {
      res.status(404).json({
        error: 'Não encontrado',
        message: 'Não há escala publicada para esta semana',
      });
      return;
    }

    const scheduleDoc = schedulesSnapshot.docs[0];
    const scheduleData = scheduleDoc.data();

    // Filter to only this employee's shifts
    const allShifts: Shift[] = scheduleData.shifts || [];
    const myShifts = allShifts
      .filter((shift) => shift.employeeId === req.employeeId)
      .map((shift) => ({
        id: shift.id,
        date: shift.date,
        dayOfWeek: shift.dayOfWeek,
        startTime: shift.startTime,
        endTime: shift.endTime,
        shiftType: shift.shiftType,
        shiftLabel: shift.shiftLabel || getShiftLabel(shift.startTime),
        status: shift.status,
      }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

    res.json({
      success: true,
      scheduleId: scheduleDoc.id,
      weekStartDate: scheduleData.weekStartDate,
      weekEndDate: scheduleData.weekEndDate,
      shifts: myShifts,
      totalShifts: myShifts.length,
    });
  } catch (error) {
    console.error('Error fetching weekly schedule:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao buscar escala da semana',
    });
  }
});

/**
 * GET /employee/schedule/upcoming
 * Get next N upcoming shifts for the employee
 */
router.get('/upcoming', async (req: Request, res: Response) => {
  try {
    if (!req.employeeId || !req.establishmentId) {
      res.status(400).json({
        error: 'Dados incompletos',
        message: 'Funcionário ou estabelecimento não identificado',
      });
      return;
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 10, 30);
    const today = new Date().toISOString().split('T')[0];

    // Get establishment name
    const estDoc = await collections.establishments.doc(req.establishmentId).get();
    const establishmentName = estDoc.exists ? estDoc.data()?.name || 'Estabelecimento' : 'Estabelecimento';

    // Find published schedules that include today or future
    const schedulesSnapshot = await collections.schedules
      .where('establishmentId', '==', req.establishmentId)
      .where('status', '==', 'published')
      .where('weekEndDate', '>=', today)
      .orderBy('weekEndDate', 'asc')
      .limit(8) // Get more to ensure we have enough shifts
      .get();

    const upcomingShifts: Array<{
      id: string;
      date: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      shiftType?: string;
      shiftLabel: string;
      establishmentName: string;
    }> = [];

    for (const scheduleDoc of schedulesSnapshot.docs) {
      const scheduleData = scheduleDoc.data();
      const allShifts: Shift[] = scheduleData.shifts || [];

      // Filter to this employee's future shifts
      const myFutureShifts = allShifts
        .filter((shift) => shift.employeeId === req.employeeId && shift.date >= today)
        .map((shift) => ({
          id: shift.id,
          date: shift.date,
          dayOfWeek: shift.dayOfWeek,
          startTime: shift.startTime,
          endTime: shift.endTime,
          shiftType: shift.shiftType,
          shiftLabel: shift.shiftLabel || getShiftLabel(shift.startTime),
          establishmentName,
        }));

      upcomingShifts.push(...myFutureShifts);
    }

    // Sort and limit
    upcomingShifts.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.startTime.localeCompare(b.startTime);
    });

    const limitedShifts = upcomingShifts.slice(0, limit);

    res.json({
      success: true,
      shifts: limitedShifts,
      hasMore: upcomingShifts.length > limit,
    });
  } catch (error) {
    console.error('Error fetching upcoming shifts:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao buscar próximos turnos',
    });
  }
});

/**
 * Helper function to determine shift label based on start time
 */
function getShiftLabel(startTime: string): string {
  const hour = parseInt(startTime.split(':')[0]);

  if (hour >= 5 && hour < 12) return 'Manhã';
  if (hour >= 12 && hour < 18) return 'Tarde';
  if (hour >= 18 && hour < 22) return 'Noite';
  return 'Madrugada';
}

export default router;
