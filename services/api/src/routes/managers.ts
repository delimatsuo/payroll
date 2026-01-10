/**
 * Manager Routes
 * Handles manager profile operations
 */

import { Router, Request, Response } from 'express';
import { collections, serverTimestamp, arrayUnion, arrayRemove } from '../services/firebase';
import { requireAuth } from '../middleware/auth';
import { Manager } from '../types/models';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createManagerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  phone: z.string().optional(),
});

const updateManagerSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  fcmToken: z.string().optional(),
});

/**
 * GET /managers/me
 * Get current manager profile
 */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const managerDoc = await collections.managers.doc(userId).get();

    if (!managerDoc.exists) {
      // Manager doesn't exist yet - they need to complete onboarding
      res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Manager profile not found. Please complete onboarding.',
      });
      return;
    }

    const manager = { id: managerDoc.id, ...managerDoc.data() } as Manager;

    res.json({
      success: true,
      data: manager,
    });
  } catch (error) {
    console.error('Error getting manager:', error);
    res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to get manager profile',
    });
  }
});

/**
 * POST /managers
 * Create manager profile (during onboarding)
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const user = req.user!;

    // Check if manager already exists
    const existingDoc = await collections.managers.doc(userId).get();
    if (existingDoc.exists) {
      res.status(409).json({
        success: false,
        error: 'AlreadyExists',
        message: 'Manager profile already exists',
      });
      return;
    }

    // Validate input
    const validation = createManagerSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: validation.error.errors[0].message,
      });
      return;
    }

    const input = validation.data;

    // Create manager document
    const managerData = {
      email: user.email || '',
      name: input.name,
      phone: input.phone || null,
      emailVerified: user.email_verified || false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      fcmTokens: [],
    };

    await collections.managers.doc(userId).set(managerData);

    // Fetch created document
    const createdDoc = await collections.managers.doc(userId).get();
    const manager = { id: createdDoc.id, ...createdDoc.data() } as Manager;

    res.status(201).json({
      success: true,
      data: manager,
      message: 'Manager profile created successfully',
    });
  } catch (error) {
    console.error('Error creating manager:', error);
    res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to create manager profile',
    });
  }
});

/**
 * PATCH /managers/me
 * Update current manager profile
 */
router.patch('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    // Check if manager exists
    const managerDoc = await collections.managers.doc(userId).get();
    if (!managerDoc.exists) {
      res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Manager profile not found',
      });
      return;
    }

    // Validate input
    const validation = updateManagerSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: validation.error.errors[0].message,
      });
      return;
    }

    const input = validation.data;
    const updates: any = {
      updatedAt: serverTimestamp(),
    };

    if (input.name) updates.name = input.name;
    if (input.phone !== undefined) updates.phone = input.phone || null;

    // Handle FCM token - add to array if not exists
    if (input.fcmToken) {
      updates.fcmTokens = arrayUnion(input.fcmToken);
    }

    await collections.managers.doc(userId).update(updates);

    // Fetch updated document
    const updatedDoc = await collections.managers.doc(userId).get();
    const manager = { id: updatedDoc.id, ...updatedDoc.data() } as Manager;

    res.json({
      success: true,
      data: manager,
      message: 'Manager profile updated successfully',
    });
  } catch (error) {
    console.error('Error updating manager:', error);
    res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to update manager profile',
    });
  }
});

/**
 * DELETE /managers/me/fcm-token
 * Remove FCM token (on logout or token refresh)
 */
router.delete('/me/fcm-token', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { token } = req.body;

    if (!token) {
      res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'FCM token is required',
      });
      return;
    }

    await collections.managers.doc(userId).update({
      fcmTokens: arrayRemove(token),
      updatedAt: serverTimestamp(),
    });

    res.json({
      success: true,
      message: 'FCM token removed successfully',
    });
  } catch (error) {
    console.error('Error removing FCM token:', error);
    res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to remove FCM token',
    });
  }
});

export default router;
