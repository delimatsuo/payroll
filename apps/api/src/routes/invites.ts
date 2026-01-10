import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db, collections } from '../services/firebase';
import { requireAuth, requireEstablishment } from '../middleware/auth';
import {
  sendEmployeeInvite,
  createInvite,
  validateInvite,
  markInviteAsUsed,
} from '../services/whatsapp';

const router = Router();

// Schema for sending invites
const SendInviteSchema = z.object({
  employeeId: z.string().min(1),
});

const SendBulkInvitesSchema = z.object({
  employeeIds: z.array(z.string().min(1)).min(1).max(50),
});

// Schema for validating invite
const ValidateInviteSchema = z.object({
  token: z.string().min(1),
});

// Schema for employee restrictions submission
const SubmitRestrictionsSchema = z.object({
  token: z.string().min(1),
  restrictions: z.object({
    unavailableDays: z.array(z.number().min(0).max(6)).optional(), // 0 = Sunday, 6 = Saturday
    unavailableTimeRanges: z.array(z.object({
      day: z.number().min(0).max(6),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
    })).optional(),
    maxHoursPerWeek: z.number().min(1).max(60).optional(),
    preferredShifts: z.array(z.enum(['morning', 'afternoon', 'evening', 'night'])).optional(),
    notes: z.string().max(500).optional(),
  }),
});

/**
 * POST /invites/send
 * Send invite to a single employee
 * Requires authentication and establishment
 */
router.post('/send', requireAuth, requireEstablishment, async (req: Request, res: Response) => {
  try {
    const body = SendInviteSchema.parse(req.body);
    const establishmentId = req.establishment!.id;
    const establishment = req.establishment!;

    // Get employee
    const employeeDoc = await collections.employees.doc(body.employeeId).get();

    if (!employeeDoc.exists) {
      return res.status(404).json({ error: 'Funcionário não encontrado' });
    }

    const employee = employeeDoc.data()!;

    // Verify employee belongs to this establishment
    if (employee.establishmentId !== establishmentId) {
      return res.status(403).json({ error: 'Funcionário não pertence a este estabelecimento' });
    }

    // Check if employee already has a pending invite
    if (employee.inviteStatus === 'sent' && employee.inviteSentAt) {
      const sentAt = employee.inviteSentAt.toDate();
      const hoursSinceSent = (Date.now() - sentAt.getTime()) / (1000 * 60 * 60);

      if (hoursSinceSent < 24) {
        return res.status(400).json({
          error: 'Convite já enviado recentemente. Aguarde 24h para reenviar.',
        });
      }
    }

    // Create invite token
    const { token, expiresAt } = await createInvite(body.employeeId, establishmentId);

    // Send WhatsApp message
    const result = await sendEmployeeInvite(
      employee.phone,
      employee.name,
      establishment.name,
      token
    );

    if (!result.success) {
      // Delete the invite if message failed
      await db.collection('invites').doc(token).delete();
      return res.status(500).json({
        error: 'Não foi possível enviar o convite via WhatsApp',
        details: result.error,
      });
    }

    // Update employee status
    await collections.employees.doc(body.employeeId).update({
      inviteStatus: 'sent',
      inviteSentAt: new Date(),
      inviteToken: token,
      inviteExpiresAt: expiresAt,
    });

    return res.json({
      success: true,
      message: 'Convite enviado com sucesso',
      messageId: result.messageId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    console.error('Send invite error:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /invites/send-bulk
 * Send invites to multiple employees
 * Requires authentication and establishment
 */
router.post('/send-bulk', requireAuth, requireEstablishment, async (req: Request, res: Response) => {
  try {
    const body = SendBulkInvitesSchema.parse(req.body);
    const establishmentId = req.establishment!.id;
    const establishment = req.establishment!;

    const results: Array<{
      employeeId: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const employeeId of body.employeeIds) {
      try {
        // Get employee
        const employeeDoc = await collections.employees.doc(employeeId).get();

        if (!employeeDoc.exists) {
          results.push({ employeeId, success: false, error: 'Funcionário não encontrado' });
          continue;
        }

        const employee = employeeDoc.data()!;

        // Verify employee belongs to this establishment
        if (employee.establishmentId !== establishmentId) {
          results.push({ employeeId, success: false, error: 'Funcionário não pertence a este estabelecimento' });
          continue;
        }

        // Create invite token
        const { token, expiresAt } = await createInvite(employeeId, establishmentId);

        // Send WhatsApp message
        const result = await sendEmployeeInvite(
          employee.phone,
          employee.name,
          establishment.name,
          token
        );

        if (!result.success) {
          await db.collection('invites').doc(token).delete();
          results.push({ employeeId, success: false, error: result.error });
          continue;
        }

        // Update employee status
        await collections.employees.doc(employeeId).update({
          inviteStatus: 'sent',
          inviteSentAt: new Date(),
          inviteToken: token,
          inviteExpiresAt: expiresAt,
        });

        results.push({ employeeId, success: true });

        // Rate limiting: wait 1 second between messages
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        results.push({
          employeeId,
          success: false,
          error: err instanceof Error ? err.message : 'Erro desconhecido',
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return res.json({
      success: true,
      message: `${successful} convite(s) enviado(s), ${failed} falha(s)`,
      results,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    console.error('Send bulk invites error:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /invites/validate/:token
 * Validate an invite token (public endpoint)
 */
router.get('/validate/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const validation = await validateInvite(token);

    if (!validation.valid) {
      return res.status(400).json({ valid: false, error: validation.error });
    }

    // Get employee and establishment info
    const [employeeDoc, establishmentDoc] = await Promise.all([
      collections.employees.doc(validation.employeeId!).get(),
      collections.establishments.doc(validation.establishmentId!).get(),
    ]);

    if (!employeeDoc.exists || !establishmentDoc.exists) {
      return res.status(400).json({ valid: false, error: 'Dados não encontrados' });
    }

    const employee = employeeDoc.data()!;
    const establishment = establishmentDoc.data()!;

    return res.json({
      valid: true,
      employee: {
        id: employeeDoc.id,
        name: employee.name,
      },
      establishment: {
        id: establishmentDoc.id,
        name: establishment.name,
        type: establishment.type,
      },
    });
  } catch (error) {
    console.error('Validate invite error:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /invites/submit-restrictions
 * Submit employee restrictions after accepting invite (public endpoint)
 */
router.post('/submit-restrictions', async (req: Request, res: Response) => {
  try {
    const body = SubmitRestrictionsSchema.parse(req.body);

    // Validate the invite
    const validation = await validateInvite(body.token);

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const employeeId = validation.employeeId!;

    // Update employee with restrictions
    await collections.employees.doc(employeeId).update({
      restrictions: body.restrictions,
      inviteStatus: 'completed',
      inviteCompletedAt: new Date(),
      status: 'active',
    });

    // Mark invite as used
    await markInviteAsUsed(body.token);

    return res.json({
      success: true,
      message: 'Restrições salvas com sucesso! Você agora faz parte da equipe.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    console.error('Submit restrictions error:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /invites/resend/:employeeId
 * Resend invite to an employee
 */
router.post('/resend/:employeeId', requireAuth, requireEstablishment, async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    const establishmentId = req.establishment!.id;
    const establishment = req.establishment!;

    // Get employee
    const employeeDoc = await collections.employees.doc(employeeId).get();

    if (!employeeDoc.exists) {
      return res.status(404).json({ error: 'Funcionário não encontrado' });
    }

    const employee = employeeDoc.data()!;

    // Verify employee belongs to this establishment
    if (employee.establishmentId !== establishmentId) {
      return res.status(403).json({ error: 'Funcionário não pertence a este estabelecimento' });
    }

    // Invalidate old invite if exists
    if (employee.inviteToken) {
      await db.collection('invites').doc(employee.inviteToken).update({
        used: true,
        invalidatedAt: new Date(),
        invalidatedReason: 'resend',
      });
    }

    // Create new invite token
    const { token, expiresAt } = await createInvite(employeeId, establishmentId);

    // Send WhatsApp message
    const result = await sendEmployeeInvite(
      employee.phone,
      employee.name,
      establishment.name,
      token
    );

    if (!result.success) {
      await db.collection('invites').doc(token).delete();
      return res.status(500).json({
        error: 'Não foi possível enviar o convite via WhatsApp',
        details: result.error,
      });
    }

    // Update employee status
    await collections.employees.doc(employeeId).update({
      inviteStatus: 'sent',
      inviteSentAt: new Date(),
      inviteToken: token,
      inviteExpiresAt: expiresAt,
    });

    return res.json({
      success: true,
      message: 'Convite reenviado com sucesso',
    });
  } catch (error) {
    console.error('Resend invite error:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
