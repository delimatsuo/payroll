/**
 * Employee Routes
 * Handles employee CRUD operations
 */

import { Router, Request, Response } from 'express';
import { collections, serverTimestamp } from '../services/firebase';
import { requireAuth } from '../middleware/auth';
import { Employee, Establishment } from '../types/models';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createEmployeeSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  phone: z
    .string()
    .regex(/^\+55\d{10,11}$/, 'Telefone deve estar no formato +55XXXXXXXXXXX'),
});

const updateEmployeeSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().regex(/^\+55\d{10,11}$/).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

/**
 * Helper to check establishment ownership
 */
async function checkEstablishmentOwnership(
  establishmentId: string,
  userId: string
): Promise<{ valid: boolean; establishment?: Establishment; error?: string }> {
  const doc = await collections.establishments.doc(establishmentId).get();

  if (!doc.exists) {
    return { valid: false, error: 'Establishment not found' };
  }

  const establishment = { id: doc.id, ...doc.data() } as Establishment;

  if (establishment.managerId !== userId) {
    return { valid: false, error: 'You do not have access to this establishment' };
  }

  return { valid: true, establishment };
}

/**
 * GET /establishments/:establishmentId/employees
 * List all employees for an establishment
 */
router.get(
  '/establishments/:establishmentId/employees',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const { establishmentId } = req.params;
      const { status } = req.query;

      // Check ownership
      const ownership = await checkEstablishmentOwnership(establishmentId, userId);
      if (!ownership.valid) {
        res.status(ownership.error === 'Establishment not found' ? 404 : 403).json({
          success: false,
          error: ownership.error === 'Establishment not found' ? 'NotFound' : 'Forbidden',
          message: ownership.error,
        });
        return;
      }

      // Build query
      let query = collections.employees.where('establishmentId', '==', establishmentId);

      if (status && ['pending_invite', 'invite_sent', 'active', 'inactive'].includes(status as string)) {
        query = query.where('status', '==', status);
      }

      const snapshot = await query.orderBy('name', 'asc').get();

      const employees = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Employee[];

      res.json({
        success: true,
        data: employees,
      });
    } catch (error) {
      console.error('Error listing employees:', error);
      res.status(500).json({
        success: false,
        error: 'InternalError',
        message: 'Failed to list employees',
      });
    }
  }
);

/**
 * GET /employees/:id
 * Get employee by ID
 */
router.get('/employees/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const doc = await collections.employees.doc(id).get();

    if (!doc.exists) {
      res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Employee not found',
      });
      return;
    }

    const employee = { id: doc.id, ...doc.data() } as Employee;

    // Check ownership via establishment
    const ownership = await checkEstablishmentOwnership(employee.establishmentId, userId);
    if (!ownership.valid) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have access to this employee',
      });
      return;
    }

    res.json({
      success: true,
      data: employee,
    });
  } catch (error) {
    console.error('Error getting employee:', error);
    res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to get employee',
    });
  }
});

/**
 * POST /establishments/:establishmentId/employees
 * Create new employee
 */
router.post(
  '/establishments/:establishmentId/employees',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const { establishmentId } = req.params;

      // Check ownership
      const ownership = await checkEstablishmentOwnership(establishmentId, userId);
      if (!ownership.valid) {
        res.status(ownership.error === 'Establishment not found' ? 404 : 403).json({
          success: false,
          error: ownership.error === 'Establishment not found' ? 'NotFound' : 'Forbidden',
          message: ownership.error,
        });
        return;
      }

      // Validate input
      const validation = createEmployeeSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'ValidationError',
          message: validation.error.errors[0].message,
        });
        return;
      }

      const input = validation.data;

      // Check if phone already exists in this establishment
      const existingSnapshot = await collections.employees
        .where('establishmentId', '==', establishmentId)
        .where('phone', '==', input.phone)
        .limit(1)
        .get();

      if (!existingSnapshot.empty) {
        res.status(409).json({
          success: false,
          error: 'AlreadyExists',
          message: 'Um funcionário com este telefone já existe',
        });
        return;
      }

      // Create employee
      const employeeData = {
        establishmentId,
        name: input.name,
        phone: input.phone,
        status: 'pending_invite' as const,
        restrictions: [],
        swapsUsedThisMonth: 0,
        swapsResetAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await collections.employees.add(employeeData);
      const createdDoc = await docRef.get();
      const employee = { id: createdDoc.id, ...createdDoc.data() } as Employee;

      res.status(201).json({
        success: true,
        data: employee,
        message: 'Employee created successfully',
      });
    } catch (error) {
      console.error('Error creating employee:', error);
      res.status(500).json({
        success: false,
        error: 'InternalError',
        message: 'Failed to create employee',
      });
    }
  }
);

/**
 * PATCH /employees/:id
 * Update employee
 */
router.patch('/employees/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    // Get employee
    const doc = await collections.employees.doc(id).get();
    if (!doc.exists) {
      res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Employee not found',
      });
      return;
    }

    const employee = doc.data() as Employee;

    // Check ownership
    const ownership = await checkEstablishmentOwnership(employee.establishmentId, userId);
    if (!ownership.valid) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have access to this employee',
      });
      return;
    }

    // Validate input
    const validation = updateEmployeeSchema.safeParse(req.body);
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
    if (input.phone) updates.phone = input.phone;
    if (input.status) updates.status = input.status;

    await collections.employees.doc(id).update(updates);

    const updatedDoc = await collections.employees.doc(id).get();
    const updatedEmployee = { id: updatedDoc.id, ...updatedDoc.data() } as Employee;

    res.json({
      success: true,
      data: updatedEmployee,
      message: 'Employee updated successfully',
    });
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to update employee',
    });
  }
});

/**
 * DELETE /employees/:id
 * Delete (deactivate) employee
 */
router.delete('/employees/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    // Get employee
    const doc = await collections.employees.doc(id).get();
    if (!doc.exists) {
      res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Employee not found',
      });
      return;
    }

    const employee = doc.data() as Employee;

    // Check ownership
    const ownership = await checkEstablishmentOwnership(employee.establishmentId, userId);
    if (!ownership.valid) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have access to this employee',
      });
      return;
    }

    // Soft delete - set status to inactive
    await collections.employees.doc(id).update({
      status: 'inactive',
      updatedAt: serverTimestamp(),
    });

    res.json({
      success: true,
      message: 'Employee deactivated successfully',
    });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to delete employee',
    });
  }
});

export default router;
