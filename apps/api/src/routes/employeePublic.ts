/**
 * Public Employee Routes
 * No authentication required - validated via secure tokens
 * These endpoints are called by the employee web portal
 */

import { Router, Request, Response } from 'express';
import { collections } from '../services/firebase';
import {
  validateEmployeeToken,
  resolveShortToken,
  markTokenUsed,
} from '../services/employeeToken';
import { FieldValue } from 'firebase-admin/firestore';

const router = Router();

/**
 * GET /employee/schedule/:token
 * Get employee's schedule (public, token-validated)
 */
router.get('/schedule/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { week } = req.query;

    // Try short token first, then full token
    let decoded = await resolveShortToken(token);
    if (!decoded.isValid) {
      decoded = validateEmployeeToken(token);
    }

    if (!decoded.isValid) {
      res.status(401).json({
        error: 'Token inválido',
        message: decoded.error || 'Link inválido ou expirado',
      });
      return;
    }

    // Get employee data
    const employeeDoc = await collections.employees.doc(decoded.employeeId).get();
    if (!employeeDoc.exists) {
      res.status(404).json({
        error: 'Funcionário não encontrado',
        message: 'Este funcionário não existe mais',
      });
      return;
    }

    const employee = employeeDoc.data();

    // Get establishment name
    const establishmentDoc = await collections.establishments.doc(decoded.establishmentId).get();
    const establishmentName = establishmentDoc.data()?.name || 'Estabelecimento';

    // Get schedules
    let weekStart = week as string;
    if (!weekStart) {
      // Default to current week
      const now = new Date();
      const day = now.getDay();
      now.setDate(now.getDate() - day);
      weekStart = now.toISOString().split('T')[0];
    }

    // Get all published schedules
    const schedulesSnapshot = await collections.schedules
      .where('establishmentId', '==', decoded.establishmentId)
      .where('status', '==', 'published')
      .orderBy('weekStartDate', 'desc')
      .limit(10)
      .get();

    // Extract shifts for this employee
    const shifts: any[] = [];
    schedulesSnapshot.docs.forEach((doc) => {
      const schedule = doc.data();
      const employeeShifts = (schedule.shifts || [])
        .filter((s: any) => s.employeeId === decoded.employeeId)
        .map((s: any) => ({
          ...s,
          scheduleId: doc.id,
          weekStartDate: schedule.weekStartDate,
        }));
      shifts.push(...employeeShifts);
    });

    // Sort by date
    shifts.sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      success: true,
      employeeId: decoded.employeeId,
      employeeName: employee?.name || 'Funcionário',
      establishmentName,
      shifts,
    });
  } catch (error) {
    console.error('Error getting employee schedule:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao buscar escala',
    });
  }
});

/**
 * GET /employee/availability/:token
 * Get employee's current availability settings
 */
router.get('/availability/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    // Try short token first, then full token
    let decoded = await resolveShortToken(token);
    if (!decoded.isValid) {
      decoded = validateEmployeeToken(token);
    }

    if (!decoded.isValid) {
      res.status(401).json({
        error: 'Token inválido',
        message: decoded.error || 'Link inválido ou expirado',
      });
      return;
    }

    // Get employee data
    const employeeDoc = await collections.employees.doc(decoded.employeeId).get();
    if (!employeeDoc.exists) {
      res.status(404).json({
        error: 'Funcionário não encontrado',
        message: 'Este funcionário não existe mais',
      });
      return;
    }

    const employee = employeeDoc.data();

    // Get establishment name
    const establishmentDoc = await collections.establishments.doc(decoded.establishmentId).get();
    const establishmentName = establishmentDoc.data()?.name || 'Estabelecimento';

    res.json({
      success: true,
      employeeId: decoded.employeeId,
      employeeName: employee?.name || 'Funcionário',
      establishmentName,
      recurringAvailability: employee?.recurringAvailability || {},
      temporaryAvailability: employee?.temporaryAvailability || [],
      notes: employee?.availabilityNotes || '',
    });
  } catch (error) {
    console.error('Error getting employee availability:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao buscar disponibilidade',
    });
  }
});

/**
 * POST /employee/availability/:token
 * Update employee's availability (public, token-validated)
 */
router.post('/availability/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { recurringAvailability, temporaryAvailability, notes } = req.body;

    // Try short token first, then full token
    let decoded = await resolveShortToken(token);
    if (!decoded.isValid) {
      decoded = validateEmployeeToken(token);
    }

    if (!decoded.isValid) {
      res.status(401).json({
        error: 'Token inválido',
        message: decoded.error || 'Link inválido ou expirado',
      });
      return;
    }

    // Validate action type
    if (decoded.action !== 'availability' && decoded.action !== 'schedule') {
      res.status(403).json({
        error: 'Ação não permitida',
        message: 'Este link não permite alteração de disponibilidade',
      });
      return;
    }

    // Update employee
    const updateData: any = {
      updatedAt: FieldValue.serverTimestamp(),
      availabilityUpdatedAt: FieldValue.serverTimestamp(),
    };

    if (recurringAvailability !== undefined) {
      updateData.recurringAvailability = recurringAvailability;
    }

    if (temporaryAvailability !== undefined) {
      updateData.temporaryAvailability = temporaryAvailability;
    }

    if (notes !== undefined) {
      updateData.availabilityNotes = notes;
    }

    await collections.employees.doc(decoded.employeeId).update(updateData);

    res.json({
      success: true,
      message: 'Disponibilidade salva com sucesso',
    });
  } catch (error) {
    console.error('Error updating employee availability:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao salvar disponibilidade',
    });
  }
});

/**
 * GET /swap/:token
 * Get swap request details
 */
router.get('/swap/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    // Try short token first, then full token
    let decoded = await resolveShortToken(token);
    if (!decoded.isValid) {
      decoded = validateEmployeeToken(token);
    }

    if (!decoded.isValid) {
      res.status(401).json({
        error: 'Token inválido',
        message: decoded.error || 'Link inválido ou expirado',
      });
      return;
    }

    if (!decoded.swapId) {
      res.status(400).json({
        error: 'Token inválido',
        message: 'Este link não é para uma troca',
      });
      return;
    }

    // Get swap request
    const swapDoc = await collections.swapRequests.doc(decoded.swapId).get();
    if (!swapDoc.exists) {
      res.status(404).json({
        error: 'Troca não encontrada',
        message: 'Esta solicitação de troca não existe mais',
      });
      return;
    }

    const swap = swapDoc.data();

    // Get requester name
    const requesterDoc = await collections.employees.doc(swap?.requesterId).get();
    const requesterName = requesterDoc.data()?.name || 'Colega';

    res.json({
      success: true,
      swapId: swapDoc.id,
      status: swap?.status || 'pending',
      requesterId: swap?.requesterId,
      requesterName,
      shiftDate: swap?.shiftDate,
      startTime: swap?.startTime,
      endTime: swap?.endTime,
      shiftLabel: swap?.shiftLabel,
      message: swap?.message,
      expiresAt: swap?.expiresAt?.toDate?.() || swap?.expiresAt,
    });
  } catch (error) {
    console.error('Error getting swap request:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao buscar troca',
    });
  }
});

/**
 * POST /swap/:token/respond
 * Accept or decline a swap request
 */
router.post('/swap/:token/respond', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { accept } = req.body;

    // Try short token first, then full token
    let decoded = await resolveShortToken(token);
    const isShortToken = decoded.isValid;
    if (!decoded.isValid) {
      decoded = validateEmployeeToken(token);
    }

    if (!decoded.isValid) {
      res.status(401).json({
        error: 'Token inválido',
        message: decoded.error || 'Link inválido ou expirado',
      });
      return;
    }

    if (!decoded.swapId) {
      res.status(400).json({
        error: 'Token inválido',
        message: 'Este link não é para uma troca',
      });
      return;
    }

    // Get swap request
    const swapDoc = await collections.swapRequests.doc(decoded.swapId).get();
    if (!swapDoc.exists) {
      res.status(404).json({
        error: 'Troca não encontrada',
        message: 'Esta solicitação de troca não existe mais',
      });
      return;
    }

    const swap = swapDoc.data();

    // Check if already handled
    if (swap?.status !== 'pending') {
      res.status(400).json({
        error: 'Troca já resolvida',
        message: 'Esta solicitação de troca já foi respondida',
      });
      return;
    }

    // Update swap request
    const newStatus = accept ? 'accepted' : 'declined';
    await collections.swapRequests.doc(decoded.swapId).update({
      status: newStatus,
      responderId: decoded.employeeId,
      respondedAt: FieldValue.serverTimestamp(),
    });

    // If accepted, update the schedule to swap the employee
    if (accept && swap?.scheduleId && swap?.shiftId) {
      const scheduleDoc = await collections.schedules.doc(swap.scheduleId).get();
      if (scheduleDoc.exists) {
        const schedule = scheduleDoc.data();
        const shifts = schedule?.shifts || [];

        // Find and update the shift
        const shiftIndex = shifts.findIndex((s: any) => s.id === swap.shiftId);
        if (shiftIndex >= 0) {
          // Get responder name
          const responderDoc = await collections.employees.doc(decoded.employeeId).get();
          const responderName = responderDoc.data()?.name || 'Funcionário';

          shifts[shiftIndex] = {
            ...shifts[shiftIndex],
            employeeId: decoded.employeeId,
            employeeName: responderName,
            swappedFrom: swap.requesterId,
            swappedAt: new Date().toISOString(),
          };

          await collections.schedules.doc(swap.scheduleId).update({
            shifts,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
    }

    // Mark token as used if it was a short token
    if (isShortToken) {
      await markTokenUsed(token);
    }

    res.json({
      success: true,
      message: accept ? 'Troca aceita com sucesso' : 'Troca recusada',
      status: newStatus,
    });
  } catch (error) {
    console.error('Error responding to swap:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao responder troca',
    });
  }
});

export default router;
