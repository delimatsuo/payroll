import { Router, Request, Response } from 'express';
import { collections } from '../services/firebase';
import { requireAuth, loadEstablishment, requireEstablishment } from '../middleware/auth';
import {
  CreateEstablishmentSchema,
  UpdateOperatingHoursSchema,
  UpdateEstablishmentSettingsSchema,
  Establishment,
} from '../types';
import { FieldValue } from 'firebase-admin/firestore';
import { geminiService } from '../services/gemini';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(requireAuth);
router.use(loadEstablishment);

/**
 * GET /establishment
 * Get current user's establishment
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.establishmentId) {
      res.status(404).json({
        error: 'Não encontrado',
        message: 'Estabelecimento não encontrado',
        needsOnboarding: true,
      });
      return;
    }

    const doc = await collections.establishments.doc(req.establishmentId).get();

    if (!doc.exists) {
      res.status(404).json({
        error: 'Não encontrado',
        message: 'Estabelecimento não encontrado',
        needsOnboarding: true,
      });
      return;
    }

    const data = doc.data();
    // Debug: Log operatingHours structure
    console.log('[GET /establishment] operatingHours:', JSON.stringify(data?.operatingHours, null, 2));
    res.json({
      id: doc.id,
      ...data,
      createdAt: data?.createdAt?.toDate?.() || data?.createdAt,
      updatedAt: data?.updatedAt?.toDate?.() || data?.updatedAt,
    });
  } catch (error) {
    console.error('Error getting establishment:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao buscar estabelecimento',
    });
  }
});

/**
 * GET /establishment/list
 * List all establishments owned by the user (multi-establishment support)
 */
router.get('/list', async (req: Request, res: Response) => {
  console.log('[GET /establishment/list] User:', req.user?.uid);
  try {
    const snapshot = await collections.establishments
      .where('ownerId', '==', req.user!.uid)
      .orderBy('createdAt', 'desc')
      .get();
    console.log('[GET /establishment/list] Found:', snapshot.size, 'establishments');

    const establishments = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data?.createdAt?.toDate?.() || data?.createdAt,
        updatedAt: data?.updatedAt?.toDate?.() || data?.updatedAt,
      };
    });

    res.json(establishments);
  } catch (error) {
    console.error('Error listing establishments:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao listar estabelecimentos',
    });
  }
});

/**
 * POST /establishment
 * Create a new establishment
 * Supports multiple establishments per user (for restaurant chains, etc.)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate input
    const parsed = CreateEstablishmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Dados inválidos',
        message: 'Verifique os dados informados',
        details: parsed.error.errors,
      });
      return;
    }

    const { name, type } = parsed.data;

    // Create establishment
    const establishment: Omit<Establishment, 'id'> = {
      name,
      type,
      ownerId: req.user!.uid,
      operatingHours: {},
      settings: {
        minEmployeesPerShift: 2,
        swapsAllowed: true,
        swapsRequireApproval: true,
        maxSwapsPerMonth: 4,
      },
      status: 'pending',
      onboardingStep: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await collections.establishments.add({
      ...establishment,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.status(201).json({
      id: docRef.id,
      ...establishment,
    });
  } catch (error) {
    console.error('Error creating establishment:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao criar estabelecimento',
    });
  }
});

/**
 * PUT /establishment
 * Update establishment basic info (name, type)
 */
router.put('/', requireEstablishment, async (req: Request, res: Response) => {
  try {
    const parsed = CreateEstablishmentSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Dados inválidos',
        message: 'Verifique os dados informados',
        details: parsed.error.errors,
      });
      return;
    }

    await collections.establishments.doc(req.establishmentId!).update({
      ...parsed.data,
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.json({ success: true, message: 'Estabelecimento atualizado' });
  } catch (error) {
    console.error('Error updating establishment:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao atualizar estabelecimento',
    });
  }
});

/**
 * PATCH /establishment/operating-hours
 * Update operating hours (onboarding step 2)
 */
router.patch('/operating-hours', requireEstablishment, async (req: Request, res: Response) => {
  try {
    const parsed = UpdateOperatingHoursSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Dados inválidos',
        message: 'Verifique os horários informados',
        details: parsed.error.errors,
      });
      return;
    }

    // Validate that close time is after open time (or handle overnight)
    for (const [day, hours] of Object.entries(parsed.data)) {
      if (hours.isOpen && hours.openTime && hours.closeTime) {
        const open = hours.openTime.split(':').map(Number);
        const close = hours.closeTime.split(':').map(Number);
        const openMinutes = open[0] * 60 + open[1];
        const closeMinutes = close[0] * 60 + close[1];

        // Allow overnight hours (close < open means next day)
        // Just validate format is correct
        if (open.length !== 2 || close.length !== 2) {
          res.status(400).json({
            error: 'Dados inválidos',
            message: `Formato de horário inválido para o dia ${day}`,
          });
          return;
        }
      }
    }

    // Convert string keys to numbers for storage
    const operatingHours: Record<number, any> = {};
    for (const [day, hours] of Object.entries(parsed.data)) {
      operatingHours[parseInt(day)] = hours;
    }

    await collections.establishments.doc(req.establishmentId!).update({
      operatingHours,
      onboardingStep: 2,
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.json({ success: true, message: 'Horários atualizados' });
  } catch (error) {
    console.error('Error updating operating hours:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao atualizar horários',
    });
  }
});

/**
 * PATCH /establishment/settings
 * Update establishment settings (onboarding step 3)
 */
router.patch('/settings', requireEstablishment, async (req: Request, res: Response) => {
  try {
    const parsed = UpdateEstablishmentSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Dados inválidos',
        message: 'Verifique as configurações informadas',
        details: parsed.error.errors,
      });
      return;
    }

    // Merge with existing settings
    const doc = await collections.establishments.doc(req.establishmentId!).get();
    const currentSettings = doc.data()?.settings || {};

    await collections.establishments.doc(req.establishmentId!).update({
      settings: {
        ...currentSettings,
        ...parsed.data,
      },
      onboardingStep: 3,
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.json({ success: true, message: 'Configurações atualizadas' });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao atualizar configurações',
    });
  }
});

/**
 * POST /establishment/activate
 * Activate establishment (complete onboarding)
 */
router.post('/activate', requireEstablishment, async (req: Request, res: Response) => {
  try {
    // Check if establishment has required data
    const doc = await collections.establishments.doc(req.establishmentId!).get();
    const data = doc.data();

    if (!data?.name || !data?.type) {
      res.status(400).json({
        error: 'Dados incompletos',
        message: 'Complete as informações do estabelecimento antes de ativar',
      });
      return;
    }

    // Check if has at least one open day
    const operatingHours = data.operatingHours || {};
    const hasOpenDay = Object.values(operatingHours).some((h: any) => h.isOpen);

    if (!hasOpenDay) {
      res.status(400).json({
        error: 'Dados incompletos',
        message: 'Configure ao menos um dia de funcionamento',
      });
      return;
    }

    // Check minimum employees (optional - can be activated without employees)
    const employeesSnapshot = await collections.employees
      .where('establishmentId', '==', req.establishmentId)
      .get();

    await collections.establishments.doc(req.establishmentId!).update({
      status: 'active',
      onboardingStep: null, // Clear onboarding step
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.json({
      success: true,
      message: 'Estabelecimento ativado com sucesso',
      employeeCount: employeesSnapshot.size,
    });
  } catch (error) {
    console.error('Error activating establishment:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao ativar estabelecimento',
    });
  }
});

// ==========================================================================
// CONVERSATIONAL SETTINGS CHANGES
// ==========================================================================

const ChatSettingsSchema = z.object({
  message: z.string().min(1).max(500),
});

/**
 * POST /establishment/chat
 * Interpret a natural language settings change request
 */
router.post('/chat', requireEstablishment, async (req: Request, res: Response) => {
  try {
    const parsed = ChatSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Mensagem inválida',
        message: 'Envie uma mensagem válida',
      });
      return;
    }

    // Get current establishment data
    const doc = await collections.establishments.doc(req.establishmentId!).get();
    const data = doc.data();

    if (!data) {
      res.status(404).json({
        error: 'Não encontrado',
        message: 'Estabelecimento não encontrado',
      });
      return;
    }

    const result = await geminiService.interpretSettingsChange({
      message: parsed.data.message,
      currentSettings: {
        name: data.name,
        type: data.type,
        operatingHours: data.operatingHours || {},
        settings: data.settings || {
          minEmployeesPerShift: 2,
          swapsAllowed: true,
          swapsRequireApproval: true,
          maxSwapsPerMonth: 4,
        },
      },
    });

    res.json(result);
  } catch (error) {
    console.error('Error processing chat settings:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao processar pedido',
    });
  }
});

const ApplyChangesSchema = z.object({
  changes: z.array(z.object({
    fieldPath: z.string(),
    newValue: z.unknown(),
  })),
});

/**
 * POST /establishment/chat/apply
 * Apply approved settings changes
 */
router.post('/chat/apply', requireEstablishment, async (req: Request, res: Response) => {
  try {
    const parsed = ApplyChangesSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Dados inválidos',
        message: 'Verifique as mudanças enviadas',
      });
      return;
    }

    const { changes } = parsed.data;

    if (changes.length === 0) {
      res.json({ success: true, message: 'Nenhuma mudança para aplicar' });
      return;
    }

    // Get current data
    const doc = await collections.establishments.doc(req.establishmentId!).get();
    const data = doc.data();

    if (!data) {
      res.status(404).json({
        error: 'Não encontrado',
        message: 'Estabelecimento não encontrado',
      });
      return;
    }

    // Build update object
    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    for (const change of changes) {
      const { fieldPath, newValue } = change;

      // Handle nested paths like "operatingHours.1" or "operatingHours.1.openTime"
      if (fieldPath.startsWith('operatingHours.')) {
        const parts = fieldPath.split('.');
        const day = parseInt(parts[1]);
        if (!isNaN(day) && day >= 0 && day <= 6) {
          const currentHours = data.operatingHours || {};

          if (parts.length === 2) {
            // Full object replacement: operatingHours.1
            currentHours[day] = newValue;
          } else if (parts.length === 3) {
            // Individual field: operatingHours.1.openTime or operatingHours.1.closeTime
            const field = parts[2];
            // Ensure currentHours[day] is an object (might be string or undefined)
            if (!currentHours[day] || typeof currentHours[day] !== 'object') {
              currentHours[day] = { isOpen: false };
            }
            currentHours[day][field] = newValue;
            // Auto-set isOpen to true when setting times
            if (field === 'openTime' || field === 'closeTime') {
              currentHours[day].isOpen = true;
            }
          }

          updates.operatingHours = currentHours;
        }
      } else if (fieldPath.startsWith('settings.')) {
        const settingKey = fieldPath.split('.')[1];
        const currentSettings = data.settings || {};
        currentSettings[settingKey] = newValue;
        updates.settings = currentSettings;
      } else if (fieldPath === 'name') {
        updates.name = newValue;
      } else if (fieldPath === 'type') {
        updates.type = newValue;
      }
    }

    await collections.establishments.doc(req.establishmentId!).update(updates);

    res.json({
      success: true,
      message: `${changes.length} mudança(s) aplicada(s) com sucesso`,
      appliedChanges: changes.length,
    });
  } catch (error) {
    console.error('Error applying chat settings:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao aplicar mudanças',
    });
  }
});

export default router;
