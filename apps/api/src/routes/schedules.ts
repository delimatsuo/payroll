import { Router, Request, Response } from 'express';
import { collections } from '../services/firebase';
import { requireAuth, loadEstablishment, requireEstablishment } from '../middleware/auth';
import { geminiService } from '../services/gemini';
import { scheduleValidator } from '../services/scheduleValidator';
import { sendScheduleNotification } from '../services/whatsapp';
import {
  GenerateScheduleSchema,
  UpdateShiftSchema,
  Schedule,
  Shift,
} from '../types';
import { FieldValue } from 'firebase-admin/firestore';

const router = Router();

// All routes require authentication and establishment
router.use(requireAuth);
router.use(loadEstablishment);
router.use(requireEstablishment);

/**
 * GET /schedules
 * List all schedules for the establishment
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const snapshot = await collections.schedules
      .where('establishmentId', '==', req.establishmentId)
      .orderBy('weekStartDate', 'desc')
      .limit(10)
      .get();

    const schedules = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
        publishedAt: data.publishedAt?.toDate?.() || data.publishedAt,
      };
    });

    res.json(schedules);
  } catch (error) {
    console.error('Error listing schedules:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao listar escalas',
    });
  }
});

/**
 * GET /schedules/:id
 * Get a specific schedule
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const doc = await collections.schedules.doc(req.params.id).get();

    if (!doc.exists) {
      res.status(404).json({
        error: 'Não encontrado',
        message: 'Escala não encontrada',
      });
      return;
    }

    const data = doc.data();

    // Verify ownership
    if (data?.establishmentId !== req.establishmentId) {
      res.status(403).json({
        error: 'Acesso negado',
        message: 'Esta escala não pertence ao seu estabelecimento',
      });
      return;
    }

    res.json({
      id: doc.id,
      ...data,
      createdAt: data?.createdAt?.toDate?.() || data?.createdAt,
      updatedAt: data?.updatedAt?.toDate?.() || data?.updatedAt,
      publishedAt: data?.publishedAt?.toDate?.() || data?.publishedAt,
    });
  } catch (error) {
    console.error('Error getting schedule:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao buscar escala',
    });
  }
});

/**
 * GET /schedules/week/:weekStartDate
 * Get schedule for a specific week
 */
router.get('/week/:weekStartDate', async (req: Request, res: Response) => {
  try {
    const { weekStartDate } = req.params;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartDate)) {
      res.status(400).json({
        error: 'Formato inválido',
        message: 'Data deve estar no formato YYYY-MM-DD',
      });
      return;
    }

    const snapshot = await collections.schedules
      .where('establishmentId', '==', req.establishmentId)
      .where('weekStartDate', '==', weekStartDate)
      .limit(1)
      .get();

    if (snapshot.empty) {
      res.status(404).json({
        error: 'Não encontrado',
        message: 'Não há escala para esta semana',
      });
      return;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    res.json({
      id: doc.id,
      ...data,
      createdAt: data?.createdAt?.toDate?.() || data?.createdAt,
      updatedAt: data?.updatedAt?.toDate?.() || data?.updatedAt,
      publishedAt: data?.publishedAt?.toDate?.() || data?.publishedAt,
    });
  } catch (error) {
    console.error('Error getting weekly schedule:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao buscar escala da semana',
    });
  }
});

/**
 * POST /schedules/generate
 * Generate a new schedule using AI
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const parsed = GenerateScheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Dados inválidos',
        message: 'Verifique a data de início da semana',
        details: parsed.error.errors,
      });
      return;
    }

    const { weekStartDate } = parsed.data;

    // Check if schedule already exists for this week
    const existingSnapshot = await collections.schedules
      .where('establishmentId', '==', req.establishmentId)
      .where('weekStartDate', '==', weekStartDate)
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      // Return existing schedule
      const existingDoc = existingSnapshot.docs[0];
      const existingData = existingDoc.data();
      res.json({
        id: existingDoc.id,
        ...existingData,
        createdAt: existingData?.createdAt?.toDate?.() || existingData?.createdAt,
        updatedAt: existingData?.updatedAt?.toDate?.() || existingData?.updatedAt,
        alreadyExists: true,
        message: 'Escala já existia para esta semana',
      });
      return;
    }

    // Get establishment data
    const establishment = req.establishment;
    if (!establishment) {
      res.status(400).json({
        error: 'Estabelecimento não encontrado',
        message: 'Configure seu estabelecimento antes de gerar escalas',
      });
      return;
    }

    // Get employees
    const employeesSnapshot = await collections.employees
      .where('establishmentId', '==', req.establishmentId)
      .where('status', 'in', ['pending', 'active'])
      .get();

    const employees = employeesSnapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name,
      restrictions: doc.data().restrictions,
    }));

    if (employees.length === 0) {
      res.status(400).json({
        error: 'Sem funcionários',
        message: 'Adicione funcionários antes de gerar uma escala',
      });
      return;
    }

    console.log('[POST /schedules/generate] Generating schedule for week:', weekStartDate);
    console.log('[POST /schedules/generate] Employees:', employees.length);
    console.log('[POST /schedules/generate] Operating hours:', establishment.operatingHours);

    // Generate schedule using Gemini
    const result = await geminiService.generateSchedule({
      weekStartDate,
      operatingHours: establishment.operatingHours,
      employees,
      minEmployeesPerShift: establishment.settings?.minEmployeesPerShift || 2,
    });

    if (!result.success) {
      res.status(400).json({
        error: 'Falha na geração',
        message: result.warnings.join('. ') || 'Não foi possível gerar a escala',
      });
      return;
    }

    // Calculate week end date
    const startDate = new Date(weekStartDate + 'T00:00:00');
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    const weekEndDate = endDate.toISOString().split('T')[0];

    // Create shifts with IDs
    const shifts: Shift[] = result.shifts.map((shift, index) => ({
      id: `shift-${index + 1}`,
      employeeId: shift.employeeId,
      employeeName: shift.employeeName,
      date: shift.date,
      dayOfWeek: shift.dayOfWeek,
      startTime: shift.startTime,
      endTime: shift.endTime,
      status: 'scheduled' as const,
    }));

    // Validate the generated schedule against CLT rules
    const validation = scheduleValidator.validateSchedule(
      shifts,
      establishment.operatingHours,
      establishment.settings?.minEmployeesPerShift || 2
    );

    // Combine warnings from generation and validation
    const allWarnings = [
      ...result.warnings,
      ...validation.warnings.map((w) => w.message),
    ];

    // If there are validation errors, still save as draft but include errors
    const validationErrors = validation.errors.map((e) => e.message);

    // Save schedule
    const schedule: Omit<Schedule, 'id'> = {
      establishmentId: req.establishmentId!,
      weekStartDate,
      weekEndDate,
      shifts,
      status: 'draft',
      generatedBy: 'ai',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await collections.schedules.add({
      ...schedule,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log('[POST /schedules/generate] Schedule created:', docRef.id);
    console.log('[POST /schedules/generate] Shifts:', shifts.length);
    console.log('[POST /schedules/generate] Validation:', { isValid: validation.isValid, errors: validationErrors.length, warnings: allWarnings.length });

    res.status(201).json({
      id: docRef.id,
      ...schedule,
      validation: {
        isValid: validation.isValid,
        errors: validationErrors,
        warnings: allWarnings,
      },
    });
  } catch (error) {
    console.error('Error generating schedule:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao gerar escala',
    });
  }
});

/**
 * PUT /schedules/:id
 * Update a schedule (edit shifts)
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const doc = await collections.schedules.doc(req.params.id).get();

    if (!doc.exists) {
      res.status(404).json({
        error: 'Não encontrado',
        message: 'Escala não encontrada',
      });
      return;
    }

    const data = doc.data();

    // Verify ownership
    if (data?.establishmentId !== req.establishmentId) {
      res.status(403).json({
        error: 'Acesso negado',
        message: 'Esta escala não pertence ao seu estabelecimento',
      });
      return;
    }

    // Update shifts if provided
    const { shifts } = req.body;
    if (shifts && Array.isArray(shifts)) {
      await collections.schedules.doc(req.params.id).update({
        shifts,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    res.json({ success: true, message: 'Escala atualizada' });
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao atualizar escala',
    });
  }
});

/**
 * PUT /schedules/:id/shifts/:shiftId
 * Update a specific shift
 */
router.put('/:id/shifts/:shiftId', async (req: Request, res: Response) => {
  try {
    const doc = await collections.schedules.doc(req.params.id).get();

    if (!doc.exists) {
      res.status(404).json({
        error: 'Não encontrado',
        message: 'Escala não encontrada',
      });
      return;
    }

    const data = doc.data();

    // Verify ownership
    if (data?.establishmentId !== req.establishmentId) {
      res.status(403).json({
        error: 'Acesso negado',
        message: 'Esta escala não pertence ao seu estabelecimento',
      });
      return;
    }

    const parsed = UpdateShiftSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Dados inválidos',
        message: 'Verifique os dados do turno',
        details: parsed.error.errors,
      });
      return;
    }

    // Find and update the shift
    const shifts: Shift[] = data?.shifts || [];
    const shiftIndex = shifts.findIndex((s: Shift) => s.id === req.params.shiftId);

    if (shiftIndex === -1) {
      res.status(404).json({
        error: 'Não encontrado',
        message: 'Turno não encontrado',
      });
      return;
    }

    // Get employee name if employeeId changed
    let employeeName = shifts[shiftIndex].employeeName;
    if (parsed.data.employeeId && parsed.data.employeeId !== shifts[shiftIndex].employeeId) {
      const empDoc = await collections.employees.doc(parsed.data.employeeId).get();
      if (empDoc.exists) {
        employeeName = empDoc.data()?.name || employeeName;
      }
    }

    shifts[shiftIndex] = {
      ...shifts[shiftIndex],
      ...parsed.data,
      employeeName,
    };

    await collections.schedules.doc(req.params.id).update({
      shifts,
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.json({ success: true, message: 'Turno atualizado', shift: shifts[shiftIndex] });
  } catch (error) {
    console.error('Error updating shift:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao atualizar turno',
    });
  }
});

/**
 * POST /schedules/:id/publish
 * Publish a schedule (makes it visible to employees)
 */
router.post('/:id/publish', async (req: Request, res: Response) => {
  try {
    const doc = await collections.schedules.doc(req.params.id).get();

    if (!doc.exists) {
      res.status(404).json({
        error: 'Não encontrado',
        message: 'Escala não encontrada',
      });
      return;
    }

    const data = doc.data();

    // Verify ownership
    if (data?.establishmentId !== req.establishmentId) {
      res.status(403).json({
        error: 'Acesso negado',
        message: 'Esta escala não pertence ao seu estabelecimento',
      });
      return;
    }

    if (data?.status === 'published') {
      res.json({ success: true, message: 'Escala já estava publicada' });
      return;
    }

    await collections.schedules.doc(req.params.id).update({
      status: 'published',
      publishedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Send WhatsApp notifications to employees
    const shifts: Shift[] = data?.shifts || [];
    const establishment = req.establishment;
    const establishmentName = establishment?.name || 'Estabelecimento';

    // Group shifts by employee
    const shiftsByEmployee = new Map<string, Shift[]>();
    for (const shift of shifts) {
      if (!shiftsByEmployee.has(shift.employeeId)) {
        shiftsByEmployee.set(shift.employeeId, []);
      }
      shiftsByEmployee.get(shift.employeeId)!.push(shift);
    }

    // Send notifications (don't block the response)
    const notificationPromises: Promise<void>[] = [];
    for (const [employeeId, employeeShifts] of shiftsByEmployee) {
      // Get employee phone
      const empDoc = await collections.employees.doc(employeeId).get();
      if (!empDoc.exists) continue;

      const phone = empDoc.data()?.phone;
      if (!phone) continue;

      // Format notification
      const weekStart = data?.weekStartDate;
      const weekEnd = data?.weekEndDate;

      notificationPromises.push(
        sendScheduleNotification(
          phone,
          establishmentName,
          weekStart,
          weekEnd,
          employeeShifts.map((s) => ({
            date: s.date,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
          }))
        ).catch((err) => {
          console.error(`Failed to notify employee ${employeeId}:`, err);
        })
      );
    }

    // Don't await all notifications - let them run in background
    Promise.all(notificationPromises).then(() => {
      console.log(`[PUBLISH] Sent ${notificationPromises.length} notifications`);
    });

    res.json({
      success: true,
      message: 'Escala publicada com sucesso',
      notificationsSent: shiftsByEmployee.size,
    });
  } catch (error) {
    console.error('Error publishing schedule:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao publicar escala',
    });
  }
});

/**
 * DELETE /schedules/:id
 * Delete a schedule
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const doc = await collections.schedules.doc(req.params.id).get();

    if (!doc.exists) {
      res.status(404).json({
        error: 'Não encontrado',
        message: 'Escala não encontrada',
      });
      return;
    }

    // Verify ownership
    if (doc.data()?.establishmentId !== req.establishmentId) {
      res.status(403).json({
        error: 'Acesso negado',
        message: 'Esta escala não pertence ao seu estabelecimento',
      });
      return;
    }

    await collections.schedules.doc(req.params.id).delete();

    res.json({ success: true, message: 'Escala removida' });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao remover escala',
    });
  }
});

export default router;
