import { Router, Request, Response } from 'express';
import { collections } from '../services/firebase';
import { requireAuth, loadEstablishment, requireEstablishment } from '../middleware/auth';
import {
  CreateEmployeeSchema,
  UpdateEmployeeSchema,
  Employee,
} from '../types';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

const router = Router();

// All routes require authentication and establishment
router.use(requireAuth);
router.use(loadEstablishment);
router.use(requireEstablishment);

/**
 * GET /employees
 * List all employees for the establishment
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    console.log('[GET /employees] Fetching employees for establishment:', req.establishmentId);
    const snapshot = await collections.employees
      .where('establishmentId', '==', req.establishmentId)
      .orderBy('createdAt', 'desc')
      .get();
    console.log('[GET /employees] Found:', snapshot.size, 'employees');

    const employees = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
        inviteSentAt: data.inviteSentAt?.toDate?.() || data.inviteSentAt,
      };
    });

    res.json(employees);
  } catch (error) {
    console.error('Error listing employees:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao listar funcionários',
    });
  }
});

/**
 * GET /employees/:id
 * Get a specific employee
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const doc = await collections.employees.doc(req.params.id).get();

    if (!doc.exists) {
      res.status(404).json({
        error: 'Não encontrado',
        message: 'Funcionário não encontrado',
      });
      return;
    }

    const data = doc.data();

    // Verify ownership
    if (data?.establishmentId !== req.establishmentId) {
      res.status(403).json({
        error: 'Acesso negado',
        message: 'Este funcionário não pertence ao seu estabelecimento',
      });
      return;
    }

    res.json({
      id: doc.id,
      ...data,
      createdAt: data?.createdAt?.toDate?.() || data?.createdAt,
      updatedAt: data?.updatedAt?.toDate?.() || data?.updatedAt,
    });
  } catch (error) {
    console.error('Error getting employee:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao buscar funcionário',
    });
  }
});

/**
 * POST /employees
 * Add a new employee
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = CreateEmployeeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Dados inválidos',
        message: 'Verifique os dados do funcionário',
        details: parsed.error.errors,
      });
      return;
    }

    const { name, phone } = parsed.data;

    // Normalize phone number (remove non-digits)
    const normalizedPhone = phone.replace(/\D/g, '');

    // Check for duplicate phone in same establishment
    const existingSnapshot = await collections.employees
      .where('establishmentId', '==', req.establishmentId)
      .where('phone', '==', normalizedPhone)
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      res.status(400).json({
        error: 'Duplicado',
        message: 'Já existe um funcionário com este número de telefone',
      });
      return;
    }

    const employee: Omit<Employee, 'id'> = {
      establishmentId: req.establishmentId!,
      name,
      phone: normalizedPhone,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await collections.employees.add({
      ...employee,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.status(201).json({
      id: docRef.id,
      ...employee,
    });
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao adicionar funcionário',
    });
  }
});

/**
 * POST /employees/batch
 * Add multiple employees at once (used in onboarding)
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const BatchSchema = z.array(CreateEmployeeSchema).min(1).max(50);
    const parsed = BatchSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: 'Dados inválidos',
        message: 'Verifique os dados dos funcionários',
        details: parsed.error.errors,
      });
      return;
    }

    const employees = parsed.data;

    // Normalize all phone numbers and check for duplicates within batch
    const normalizedPhones = employees.map((e) => e.phone.replace(/\D/g, ''));
    const uniquePhones = new Set(normalizedPhones);

    if (uniquePhones.size !== normalizedPhones.length) {
      res.status(400).json({
        error: 'Duplicado',
        message: 'Existem números de telefone duplicados na lista',
      });
      return;
    }

    // Check for existing employees with same phones
    // Firestore 'in' operator is limited to 10 items, so we chunk the phones
    const existingPhones: string[] = [];
    const CHUNK_SIZE = 10;

    for (let i = 0; i < normalizedPhones.length; i += CHUNK_SIZE) {
      const chunk = normalizedPhones.slice(i, i + CHUNK_SIZE);
      const existingSnapshot = await collections.employees
        .where('establishmentId', '==', req.establishmentId)
        .where('phone', 'in', chunk)
        .get();

      existingSnapshot.docs.forEach((doc) => {
        existingPhones.push(doc.data().phone);
      });
    }

    if (existingPhones.length > 0) {
      res.status(400).json({
        error: 'Duplicado',
        message: `Já existem funcionários com estes telefones: ${existingPhones.join(', ')}`,
      });
      return;
    }

    // Create all employees in a batch
    const batch = collections.employees.firestore.batch();
    const createdEmployees: any[] = [];

    for (let i = 0; i < employees.length; i++) {
      const { name, phone } = employees[i];
      const normalizedPhone = normalizedPhones[i];

      const docRef = collections.employees.doc();
      const employee = {
        establishmentId: req.establishmentId!,
        name,
        phone: normalizedPhone,
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      batch.set(docRef, employee);
      createdEmployees.push({
        id: docRef.id,
        ...employee,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await batch.commit();

    res.status(201).json({
      success: true,
      message: `${createdEmployees.length} funcionários adicionados`,
      employees: createdEmployees,
    });
  } catch (error) {
    console.error('Error creating employees batch:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao adicionar funcionários',
    });
  }
});

/**
 * PUT /employees/:id
 * Update an employee
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const doc = await collections.employees.doc(req.params.id).get();

    if (!doc.exists) {
      res.status(404).json({
        error: 'Não encontrado',
        message: 'Funcionário não encontrado',
      });
      return;
    }

    // Verify ownership
    if (doc.data()?.establishmentId !== req.establishmentId) {
      res.status(403).json({
        error: 'Acesso negado',
        message: 'Este funcionário não pertence ao seu estabelecimento',
      });
      return;
    }

    const parsed = UpdateEmployeeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Dados inválidos',
        message: 'Verifique os dados do funcionário',
        details: parsed.error.errors,
      });
      return;
    }

    const updateData: any = {
      ...parsed.data,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Normalize phone if provided
    if (updateData.phone) {
      updateData.phone = updateData.phone.replace(/\D/g, '');

      // Check for duplicate phone
      const existingSnapshot = await collections.employees
        .where('establishmentId', '==', req.establishmentId)
        .where('phone', '==', updateData.phone)
        .limit(1)
        .get();

      if (!existingSnapshot.empty && existingSnapshot.docs[0].id !== req.params.id) {
        res.status(400).json({
          error: 'Duplicado',
          message: 'Já existe um funcionário com este número de telefone',
        });
        return;
      }
    }

    await collections.employees.doc(req.params.id).update(updateData);

    res.json({ success: true, message: 'Funcionário atualizado' });
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao atualizar funcionário',
    });
  }
});

/**
 * DELETE /employees/:id
 * Remove an employee
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const doc = await collections.employees.doc(req.params.id).get();

    if (!doc.exists) {
      res.status(404).json({
        error: 'Não encontrado',
        message: 'Funcionário não encontrado',
      });
      return;
    }

    // Verify ownership
    if (doc.data()?.establishmentId !== req.establishmentId) {
      res.status(403).json({
        error: 'Acesso negado',
        message: 'Este funcionário não pertence ao seu estabelecimento',
      });
      return;
    }

    await collections.employees.doc(req.params.id).delete();

    res.json({ success: true, message: 'Funcionário removido' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao remover funcionário',
    });
  }
});

export default router;
