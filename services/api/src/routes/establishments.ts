/**
 * Establishment Routes
 * Handles establishment CRUD operations
 */

import { Router, Request, Response } from 'express';
import { collections, serverTimestamp } from '../services/firebase';
import { requireAuth } from '../middleware/auth';
import {
  Establishment,
  EstablishmentSettings,
  OperatingHours,
} from '../types/models';
import { z } from 'zod';

const router = Router();

// Default settings for new establishments
const DEFAULT_SETTINGS: EstablishmentSettings = {
  minEmployeesPerShift: 2,
  swapsAllowed: true,
  swapsRequireApproval: true,
  maxSwapsPerMonth: 4,
  restrictionDeadlineHours: 72,
  reminderBeforeDeadlineHours: 24,
};

// Default operating hours (closed on Sunday, 10-22 Mon-Sat)
const DEFAULT_OPERATING_HOURS: Record<number, OperatingHours> = {
  0: { isOpen: false, openTime: '10:00', closeTime: '22:00' },
  1: { isOpen: true, openTime: '10:00', closeTime: '22:00' },
  2: { isOpen: true, openTime: '10:00', closeTime: '22:00' },
  3: { isOpen: true, openTime: '10:00', closeTime: '22:00' },
  4: { isOpen: true, openTime: '10:00', closeTime: '22:00' },
  5: { isOpen: true, openTime: '10:00', closeTime: '23:00' },
  6: { isOpen: true, openTime: '10:00', closeTime: '23:00' },
};

// Validation schemas
const establishmentTypeSchema = z.enum(['restaurant', 'store', 'bar', 'other']);

const createEstablishmentSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  type: establishmentTypeSchema,
});

const operatingHoursSchema = z.object({
  isOpen: z.boolean(),
  openTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato inválido (HH:mm)'),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato inválido (HH:mm)'),
});

const updateOperatingHoursSchema = z.record(
  z.string().regex(/^[0-6]$/),
  operatingHoursSchema
);

const updateSettingsSchema = z.object({
  minEmployeesPerShift: z.number().min(1).max(50).optional(),
  swapsAllowed: z.boolean().optional(),
  swapsRequireApproval: z.boolean().optional(),
  maxSwapsPerMonth: z.number().min(0).max(30).optional(),
  restrictionDeadlineHours: z.number().min(12).max(168).optional(),
  reminderBeforeDeadlineHours: z.number().min(6).max(48).optional(),
});

/**
 * GET /establishments
 * List all establishments for current manager
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const snapshot = await collections.establishments
      .where('managerId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const establishments = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Establishment[];

    res.json({
      success: true,
      data: establishments,
    });
  } catch (error) {
    console.error('Error listing establishments:', error);
    res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to list establishments',
    });
  }
});

/**
 * GET /establishments/:id
 * Get establishment by ID
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const doc = await collections.establishments.doc(id).get();

    if (!doc.exists) {
      res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Establishment not found',
      });
      return;
    }

    const establishment = { id: doc.id, ...doc.data() } as Establishment;

    // Check ownership
    if (establishment.managerId !== userId) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have access to this establishment',
      });
      return;
    }

    res.json({
      success: true,
      data: establishment,
    });
  } catch (error) {
    console.error('Error getting establishment:', error);
    res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to get establishment',
    });
  }
});

/**
 * POST /establishments
 * Create new establishment
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    // Validate input
    const validation = createEstablishmentSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: validation.error.errors[0].message,
      });
      return;
    }

    const input = validation.data;

    // Create establishment
    const establishmentData = {
      managerId: userId,
      name: input.name,
      type: input.type,
      operatingHours: DEFAULT_OPERATING_HOURS,
      settings: DEFAULT_SETTINGS,
      status: 'onboarding' as const,
      onboardingStep: 3, // Name/type done, next is operating hours
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await collections.establishments.add(establishmentData);
    const createdDoc = await docRef.get();
    const establishment = { id: createdDoc.id, ...createdDoc.data() } as Establishment;

    res.status(201).json({
      success: true,
      data: establishment,
      message: 'Establishment created successfully',
    });
  } catch (error) {
    console.error('Error creating establishment:', error);
    res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to create establishment',
    });
  }
});

/**
 * PATCH /establishments/:id
 * Update establishment
 */
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    // Get existing establishment
    const doc = await collections.establishments.doc(id).get();
    if (!doc.exists) {
      res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Establishment not found',
      });
      return;
    }

    const establishment = doc.data() as Establishment;
    if (establishment.managerId !== userId) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have access to this establishment',
      });
      return;
    }

    // Build updates
    const updates: any = {
      updatedAt: serverTimestamp(),
    };

    // Update name
    if (req.body.name) {
      if (req.body.name.length < 2) {
        res.status(400).json({
          success: false,
          error: 'ValidationError',
          message: 'Nome deve ter pelo menos 2 caracteres',
        });
        return;
      }
      updates.name = req.body.name;
    }

    // Update type
    if (req.body.type) {
      const typeValidation = establishmentTypeSchema.safeParse(req.body.type);
      if (!typeValidation.success) {
        res.status(400).json({
          success: false,
          error: 'ValidationError',
          message: 'Tipo de estabelecimento inválido',
        });
        return;
      }
      updates.type = req.body.type;
    }

    await collections.establishments.doc(id).update(updates);

    const updatedDoc = await collections.establishments.doc(id).get();
    const updatedEstablishment = { id: updatedDoc.id, ...updatedDoc.data() } as Establishment;

    res.json({
      success: true,
      data: updatedEstablishment,
      message: 'Establishment updated successfully',
    });
  } catch (error) {
    console.error('Error updating establishment:', error);
    res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to update establishment',
    });
  }
});

/**
 * PATCH /establishments/:id/operating-hours
 * Update operating hours
 */
router.patch('/:id/operating-hours', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    // Check ownership
    const doc = await collections.establishments.doc(id).get();
    if (!doc.exists) {
      res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Establishment not found',
      });
      return;
    }

    const establishment = doc.data() as Establishment;
    if (establishment.managerId !== userId) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have access to this establishment',
      });
      return;
    }

    // Validate operating hours
    const validation = updateOperatingHoursSchema.safeParse(req.body.operatingHours);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Invalid operating hours format',
      });
      return;
    }

    // Convert string keys to numbers
    const operatingHours: Record<number, OperatingHours> = {};
    for (const [key, value] of Object.entries(validation.data)) {
      operatingHours[parseInt(key)] = value as OperatingHours;
    }

    // Update onboarding step if in onboarding
    const updates: any = {
      operatingHours,
      updatedAt: serverTimestamp(),
    };

    if (establishment.status === 'onboarding' && establishment.onboardingStep === 3) {
      updates.onboardingStep = 4;
    }

    await collections.establishments.doc(id).update(updates);

    const updatedDoc = await collections.establishments.doc(id).get();
    const updatedEstablishment = { id: updatedDoc.id, ...updatedDoc.data() } as Establishment;

    res.json({
      success: true,
      data: updatedEstablishment,
      message: 'Operating hours updated successfully',
    });
  } catch (error) {
    console.error('Error updating operating hours:', error);
    res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to update operating hours',
    });
  }
});

/**
 * PATCH /establishments/:id/settings
 * Update establishment settings
 */
router.patch('/:id/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    // Check ownership
    const doc = await collections.establishments.doc(id).get();
    if (!doc.exists) {
      res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Establishment not found',
      });
      return;
    }

    const establishment = doc.data() as Establishment;
    if (establishment.managerId !== userId) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have access to this establishment',
      });
      return;
    }

    // Validate settings
    const validation = updateSettingsSchema.safeParse(req.body.settings);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: validation.error.errors[0].message,
      });
      return;
    }

    // Merge with existing settings
    const newSettings = {
      ...establishment.settings,
      ...validation.data,
    };

    // Update onboarding step if in onboarding
    const updates: any = {
      settings: newSettings,
      updatedAt: serverTimestamp(),
    };

    if (establishment.status === 'onboarding' && establishment.onboardingStep === 4) {
      updates.onboardingStep = 5;
    }

    await collections.establishments.doc(id).update(updates);

    const updatedDoc = await collections.establishments.doc(id).get();
    const updatedEstablishment = { id: updatedDoc.id, ...updatedDoc.data() } as Establishment;

    res.json({
      success: true,
      data: updatedEstablishment,
      message: 'Settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to update settings',
    });
  }
});

/**
 * POST /establishments/:id/activate
 * Complete onboarding and activate establishment
 */
router.post('/:id/activate', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    // Check ownership
    const doc = await collections.establishments.doc(id).get();
    if (!doc.exists) {
      res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Establishment not found',
      });
      return;
    }

    const establishment = doc.data() as Establishment;
    if (establishment.managerId !== userId) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have access to this establishment',
      });
      return;
    }

    await collections.establishments.doc(id).update({
      status: 'active',
      onboardingStep: 7,
      updatedAt: serverTimestamp(),
    });

    const updatedDoc = await collections.establishments.doc(id).get();
    const updatedEstablishment = { id: updatedDoc.id, ...updatedDoc.data() } as Establishment;

    res.json({
      success: true,
      data: updatedEstablishment,
      message: 'Establishment activated successfully',
    });
  } catch (error) {
    console.error('Error activating establishment:', error);
    res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to activate establishment',
    });
  }
});

export default router;
