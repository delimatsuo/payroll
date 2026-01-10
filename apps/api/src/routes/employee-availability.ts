import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { auth, collections } from '../services/firebase';
import { geminiService } from '../services/gemini';
import {
  UpdateRecurringAvailabilitySchema,
  CreateTemporaryAvailabilitySchema,
  AvailabilityChatSchema,
  TemporaryAvailability,
} from '../types';
import { FieldValue } from 'firebase-admin/firestore';

const router = Router();

/**
 * Middleware to verify employee authentication
 * Employees use custom tokens with uid format: employee_<phoneHash>
 */
async function requireEmployeeAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Não autorizado',
      message: 'Token de autenticação não fornecido',
    });
    return;
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await auth.verifyIdToken(token);

    // Verify this is an employee token
    if (!decodedToken.uid.startsWith('employee_')) {
      res.status(403).json({
        error: 'Acesso negado',
        message: 'Esta rota é apenas para funcionários',
      });
      return;
    }

    // Get employee user data
    const phoneHash = decodedToken.uid.replace('employee_', '');
    const employeeUserDoc = await collections.employeeUsers.doc(phoneHash).get();

    if (!employeeUserDoc.exists) {
      res.status(404).json({
        error: 'Usuário não encontrado',
        message: 'Dados do funcionário não encontrados',
      });
      return;
    }

    // Attach to request
    (req as any).employeeUser = { id: phoneHash, ...employeeUserDoc.data() };
    next();
  } catch (error) {
    console.error('Employee auth error:', error);
    res.status(401).json({
      error: 'Não autorizado',
      message: 'Token inválido ou expirado',
    });
  }
}

/**
 * Helper to get employee ID from establishment link header
 */
function getEmployeeId(req: Request, res: Response): string | null {
  const employeeUser = (req as any).employeeUser;
  const establishmentId = req.headers['x-establishment-id'] as string;

  if (!establishmentId) {
    // Return first linked employee if no establishment specified
    if (employeeUser.establishmentLinks?.length > 0) {
      return employeeUser.establishmentLinks[0].employeeId;
    }
    res.status(400).json({
      error: 'Estabelecimento não especificado',
      message: 'Especifique o estabelecimento no header X-Establishment-Id',
    });
    return null;
  }

  // Find employee ID for this establishment
  const link = employeeUser.establishmentLinks?.find(
    (l: any) => l.establishmentId === establishmentId
  );

  if (!link) {
    res.status(403).json({
      error: 'Acesso negado',
      message: 'Você não está vinculado a este estabelecimento',
    });
    return null;
  }

  return link.employeeId;
}

// All routes require employee authentication
router.use(requireEmployeeAuth);

/**
 * GET /availability
 * Get my recurring and temporary availability
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const employeeId = getEmployeeId(req, res);
    if (!employeeId) return;

    const employeeDoc = await collections.employees.doc(employeeId).get();

    if (!employeeDoc.exists) {
      res.status(404).json({
        error: 'Funcionário não encontrado',
        message: 'Cadastro não encontrado',
      });
      return;
    }

    const data = employeeDoc.data()!;

    res.json({
      employeeId,
      recurringAvailability: data.recurringAvailability || {},
      temporaryAvailability: data.temporaryAvailability || [],
      updatedAt: data.availabilityUpdatedAt?.toDate?.() || null,
    });
  } catch (error) {
    console.error('Error getting availability:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Não foi possível carregar a disponibilidade',
    });
  }
});

/**
 * PUT /availability/recurring
 * Update recurring weekly availability pattern
 */
router.put('/recurring', async (req: Request, res: Response) => {
  try {
    const employeeId = getEmployeeId(req, res);
    if (!employeeId) return;

    const parsed = UpdateRecurringAvailabilitySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Dados inválidos',
        message: 'Verifique o formato da disponibilidade',
        details: parsed.error.errors,
      });
      return;
    }

    // Convert string keys to numbers
    const recurringAvailability: Record<number, any> = {};
    for (const [day, availability] of Object.entries(parsed.data)) {
      recurringAvailability[parseInt(day)] = availability;
    }

    await collections.employees.doc(employeeId).update({
      recurringAvailability,
      availabilityUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.json({
      success: true,
      message: 'Disponibilidade recorrente atualizada',
    });
  } catch (error) {
    console.error('Error updating recurring availability:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Não foi possível atualizar a disponibilidade',
    });
  }
});

/**
 * POST /availability/temporary
 * Add a temporary availability exception
 */
router.post('/temporary', async (req: Request, res: Response) => {
  try {
    const employeeId = getEmployeeId(req, res);
    if (!employeeId) return;

    const parsed = CreateTemporaryAvailabilitySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Dados inválidos',
        message: 'Verifique as datas e informações',
        details: parsed.error.errors,
      });
      return;
    }

    // Validate dates
    const startDate = new Date(parsed.data.startDate);
    const endDate = new Date(parsed.data.endDate);

    if (endDate < startDate) {
      res.status(400).json({
        error: 'Datas inválidas',
        message: 'A data de fim deve ser posterior à data de início',
      });
      return;
    }

    // Generate unique ID
    const id = randomBytes(8).toString('hex');

    const newTemporary: TemporaryAvailability = {
      id,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      type: parsed.data.type,
      hours: parsed.data.hours,
      reason: parsed.data.reason,
      createdAt: new Date(),
    };

    // Get current temporary availability and add new one
    const employeeDoc = await collections.employees.doc(employeeId).get();
    const currentTemporary = employeeDoc.data()?.temporaryAvailability || [];

    await collections.employees.doc(employeeId).update({
      temporaryAvailability: [...currentTemporary, newTemporary],
      availabilityUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.status(201).json({
      success: true,
      message: 'Exceção adicionada com sucesso',
      exception: newTemporary,
    });
  } catch (error) {
    console.error('Error adding temporary availability:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Não foi possível adicionar a exceção',
    });
  }
});

/**
 * DELETE /availability/temporary/:id
 * Remove a temporary availability exception
 */
router.delete('/temporary/:id', async (req: Request, res: Response) => {
  try {
    const employeeId = getEmployeeId(req, res);
    if (!employeeId) return;

    const { id } = req.params;

    const employeeDoc = await collections.employees.doc(employeeId).get();
    const currentTemporary = employeeDoc.data()?.temporaryAvailability || [];

    const filtered = currentTemporary.filter((t: any) => t.id !== id);

    if (filtered.length === currentTemporary.length) {
      res.status(404).json({
        error: 'Não encontrado',
        message: 'Exceção não encontrada',
      });
      return;
    }

    await collections.employees.doc(employeeId).update({
      temporaryAvailability: filtered,
      availabilityUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.json({
      success: true,
      message: 'Exceção removida com sucesso',
    });
  } catch (error) {
    console.error('Error removing temporary availability:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Não foi possível remover a exceção',
    });
  }
});

/**
 * POST /availability/chat
 * Interpret natural language availability request
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const employeeId = getEmployeeId(req, res);
    if (!employeeId) return;

    const parsed = AvailabilityChatSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Mensagem inválida',
        message: 'Envie uma mensagem válida',
      });
      return;
    }

    // Get current availability
    const employeeDoc = await collections.employees.doc(employeeId).get();
    const data = employeeDoc.data() || {};

    const result = await geminiService.interpretAvailabilityChange({
      message: parsed.data.message,
      currentRecurring: data.recurringAvailability,
      currentTemporary: data.temporaryAvailability,
    });

    res.json(result);
  } catch (error) {
    console.error('Error processing availability chat:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Não foi possível processar sua mensagem',
    });
  }
});

/**
 * POST /availability/chat/apply
 * Apply changes from chat interpretation
 */
router.post('/chat/apply', async (req: Request, res: Response) => {
  try {
    const employeeId = getEmployeeId(req, res);
    if (!employeeId) return;

    const { recurringChanges, temporaryChange } = req.body;

    const updates: Record<string, any> = {
      availabilityUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Apply recurring changes
    if (recurringChanges && Array.isArray(recurringChanges)) {
      const employeeDoc = await collections.employees.doc(employeeId).get();
      const currentRecurring = employeeDoc.data()?.recurringAvailability || {};

      for (const change of recurringChanges) {
        currentRecurring[change.day] = {
          available: change.available,
          startTime: change.startTime,
          endTime: change.endTime,
        };
      }

      updates.recurringAvailability = currentRecurring;
    }

    // Apply temporary change
    if (temporaryChange) {
      const employeeDoc = await collections.employees.doc(employeeId).get();
      const currentTemporary = employeeDoc.data()?.temporaryAvailability || [];

      const id = randomBytes(8).toString('hex');
      const newTemp: TemporaryAvailability = {
        id,
        startDate: temporaryChange.startDate,
        endDate: temporaryChange.endDate,
        type: temporaryChange.type,
        hours: temporaryChange.hours,
        reason: temporaryChange.reason,
        createdAt: new Date(),
      };

      updates.temporaryAvailability = [...currentTemporary, newTemp];
    }

    await collections.employees.doc(employeeId).update(updates);

    res.json({
      success: true,
      message: 'Disponibilidade atualizada com sucesso',
    });
  } catch (error) {
    console.error('Error applying availability changes:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Não foi possível aplicar as mudanças',
    });
  }
});

export default router;
